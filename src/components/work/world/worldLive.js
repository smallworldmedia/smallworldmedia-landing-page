/**
 * worldLive.js — Live-video Near tier for the Featured Project Worlds.
 *
 * The World analogue of the globe's LivePanelScheduler, minus the prominence
 * scoring: Tiles don't move relative to the camera, so eligibility is simply
 * "Near tier (tier 0) + has a Mux playbackId + still already showing". Called
 * at ~2Hz from the render loop, never per frame.
 *
 *  - Promote: an eligible Tile takes a free VideoSlotPool slot → its HLS video
 *    crossfades up over the still (an overlay plane parented to the tile mesh,
 *    so it inherits parallax / push-out / Turn transforms). After each
 *    attach(), a fill window promotes candidates into ALL free slots in
 *    parallel as their stills land, until the field is full; later (rotation)
 *    promotions serialize, and each resolved promotion immediately re-enters
 *    update() so the next waiting stream starts without waiting for a beat.
 *  - Rotate: when every slot is full and another eligible Tile is waiting, the
 *    longest-lived Tile past LIVE_DWELL_SECONDS fades back to its still and
 *    the waiting one takes the slot — the field keeps moving.
 *  - Suspend: a World Turn fades all live Tiles back to stills fast and frees
 *    their slots; the Turn is the incoming World's still-preload window.
 *
 * Live state lives on the tile records built by useWorldScene ({ liveState,
 * liveMix, liveSlot, liveSince, videoMesh, videoTexture }); the per-frame
 * opacity composite (liveMix × appear-fade × slot crossfade) happens in
 * useWorldScene's applyParallax, not here.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import {
  WORLD_MAX_LIVE,
  LIVE_DWELL_SECONDS,
  LIVE_CROSSFADE_SECONDS,
  LIVE_SUSPEND_SECONDS,
} from './worldConfig.js';

const NEAR_TIER = 0;
// Overlay sits just proud of its parent tile plane (tiles live around z −3.6
// with ≥0.1 z-jitter separation, so this can never cross another tile).
const OVERLAY_Z = 0.012;

export default class WorldLiveScheduler {
  /**
   * @param {React.RefObject} poolRef - VideoSlotPool ref. Read lazily (the pool
   * mounts a render after hydration); until it resolves, updates no-op.
   */
  constructor(poolRef) {
    this.poolRef = poolRef;
    this.tiles = [];
    this.suspended = false;
    this.disposed = false;
    /** @type {Array<Object|null>} slot index → tile record holding it */
    this.slots = Array(WORLD_MAX_LIVE).fill(null);
    this.now = 0;
    this.needsInitialFill = false;
  }

  /** Point the scheduler at the active World's tile records (post-build/Turn). */
  attach(tiles) {
    this.tiles = tiles;
    this.suspended = false;
    this.needsInitialFill = true; // first beat fills all free slots at once
  }

  update(now) {
    if (this.disposed || this.suspended || !this.poolRef.current) return;
    this.now = now;

    // Eligible as soon as the still is up (t.texture): HLS startup then hides
    // inside the push-out — the first-frame gate in promote() means the video
    // can never reveal early, so promoting during the travel is safe.
    const candidates = this.tiles.filter(
      (t) => t.playbackId && t.tierIndex === NEAR_TIER && t.texture && !t.liveState
    );
    if (!candidates.length) return;

    // Fill window after attach(): the user is staring at an empty field, so
    // parallel startup beats serialized bandwidth-sharing — fill every free
    // slot now. Duplicate-safe: promote() writes slots[] synchronously and
    // pickCandidate excludes every playbackId already slotted (incl. pending).
    if (this.needsInitialFill) {
      let free;
      while ((free = this.slots.indexOf(null)) !== -1) {
        const next = this.pickCandidate(candidates);
        if (!next) break;
        this.promote(next, free);
      }
      // Stay in the fill window until the field is actually full — cold-load
      // stills straggle across beats, and each should start streaming the
      // moment it lands, not chained behind the prior stream's first frame.
      // Sparse Worlds that can never fill every slot just keep promoting new
      // candidates immediately (desired); rotation below needs all slots
      // busy, so it stays unreachable while this is set.
      this.needsInitialFill = this.slots.includes(null);
      return;
    }

    // Steady-state (rotation) beats stay serialized: concurrent first-segment
    // fetches split bandwidth and make *every* video late — one pending stream
    // at a time, each resolution chaining the next via promote()'s update().
    if (this.slots.some((t) => t?.liveState === 'pending')) return;

    const free = this.slots.indexOf(null);
    if (free !== -1) {
      const next = this.pickCandidate(candidates);
      if (next) this.promote(next, free);
      return;
    }

    // All slots busy: rotate the longest-lived tile out once it has dwelled,
    // but only when a *different* stream is waiting (no pointless churn).
    const waiting = this.pickCandidate(candidates);
    if (!waiting) return;
    const oldest = this.slots
      .filter((t) => t?.liveState === 'live')
      .sort((a, b) => a.liveSince - b.liveSince)[0];
    if (oldest && now - oldest.liveSince > LIVE_DWELL_SECONDS) {
      this.demote(oldest, LIVE_CROSSFADE_SECONDS);
    }
  }

  // Cover-fit the video into the tile plane. The plane was sized from the
  // asset's own ratio so this is ~identity, but the stream's true dimensions
  // guard against any drift between the Sanity ratio and the Mux rendition.
  coverFit(texture, tile, video) {
    const planeAspect =
      tile.mesh.geometry.parameters.width / tile.mesh.geometry.parameters.height;
    const texAspect =
      video.videoWidth > 0 && video.videoHeight > 0
        ? video.videoWidth / video.videoHeight
        : planeAspect;
    texture.center.set(0.5, 0.5);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    if (texAspect > planeAspect) texture.repeat.set(planeAspect / texAspect, 1);
    else texture.repeat.set(1, texAspect / planeAspect);
  }

  // Sparse Worlds cycle their showcase, so two tiles can share a playbackId —
  // never spend two decode slots on the same stream. Least-recently-live wins,
  // so a freed slot round-robins through the tier instead of re-promoting the
  // stream that just left it.
  pickCandidate(candidates) {
    const liveIds = new Set(
      this.slots.filter(Boolean).map((t) => t.playbackId)
    );
    const waiting = candidates.filter((t) => !liveIds.has(t.playbackId));
    waiting.sort((a, b) => (a.lastLiveAt || 0) - (b.lastLiveAt || 0));
    return waiting[0] || null;
  }

  promote(tile, slot) {
    tile.liveState = 'pending';
    tile.liveSlot = slot;
    this.slots[slot] = tile;

    this.poolRef.current
      .assign(slot, tile.playbackId)
      .then((video) => {
        if (this.disposed || tile.liveState !== 'pending') return;
        const texture = new THREE.VideoTexture(video);
        // Built-in materials decode video textures in-shader (DECODE_VIDEO_TEXTURE),
        // so tagging sRGB is enough — no manual decode like the globe's shader.
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        this.coverFit(texture, tile, video);
        tile.videoTexture = texture;

        const { width, height } = tile.mesh.geometry.parameters;
        const overlay = new THREE.Mesh(
          new THREE.PlaneGeometry(width, height),
          new THREE.MeshBasicMaterial({
            map: texture,
            toneMapped: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
        );
        overlay.position.z = OVERLAY_Z;
        tile.mesh.add(overlay); // inherits parallax / push-out / Turn roll
        tile.videoMesh = overlay;

        tile.liveState = 'live';
        tile.liveSince = this.now;
        gsap.to(tile, {
          liveMix: 1,
          duration: LIVE_CROSSFADE_SECONDS,
          ease: 'power2.out',
          overwrite: 'auto',
        });

        // Stream is up — start the next waiting one now instead of waiting
        // out the beat (this.now may be a beat stale; dwell clocks tolerate
        // it). update()'s guards keep this to one new pending stream at most.
        if (!this.disposed && !this.suspended) this.update(this.now);
      })
      .catch(() => {
        // Slot reassigned/released or stream failed — roll back cleanly
        if (tile.liveState === 'pending') this.freeTile(tile, { releasePool: true });
        // A failed startup shouldn't stall the chain — try the next candidate.
        if (!this.disposed && !this.suspended) this.update(this.now);
      });
  }

  demote(tile, duration) {
    tile.liveState = 'demoting';
    gsap.to(tile, {
      liveMix: 0,
      duration,
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => this.freeTile(tile, { releasePool: true }),
    });
  }

  /**
   * World Turn starting (or World torn down): everything back to stills fast,
   * slots freed so the incoming World's stills own the network.
   */
  suspend() {
    this.suspended = true;
    for (const tile of [...this.slots]) {
      if (!tile) continue;
      if (tile.liveState === 'live') this.demote(tile, LIVE_SUSPEND_SECONDS);
      else this.freeTile(tile, { releasePool: true }); // pending → cancel outright
    }
  }

  /** Release a tile's live resources. Safe to call on tiles that never went live. */
  freeTile(tile, { releasePool }) {
    gsap.killTweensOf(tile, 'liveMix');
    if (tile.liveState) tile.lastLiveAt = this.now; // round-robin recency

    const slot = tile.liveSlot;
    if (slot != null && this.slots[slot] === tile) {
      if (releasePool && !this.disposed) this.poolRef.current?.releaseSlot(slot);
      this.slots[slot] = null;
    }
    if (tile.videoMesh) {
      tile.mesh.remove(tile.videoMesh);
      tile.videoMesh.geometry.dispose();
      tile.videoMesh.material.dispose();
      tile.videoMesh = null;
    }
    if (tile.videoTexture) {
      tile.videoTexture.dispose();
      tile.videoTexture = null;
    }
    tile.liveMix = 0;
    tile.liveSlot = null;
    tile.liveState = null;
  }

  getStats() {
    const nearIds = new Set(
      this.tiles
        .filter((t) => t.playbackId && t.tierIndex === NEAR_TIER)
        .map((t) => t.playbackId)
    );
    return {
      live: this.slots.filter((t) => t?.liveState === 'live').length,
      pending: this.slots.filter((t) => t?.liveState === 'pending').length,
      nearCandidates: nearIds.size, // unique streams the tier can rotate through
    };
  }

  dispose() {
    this.disposed = true;
    for (const tile of [...this.slots]) {
      if (tile) this.freeTile(tile, { releasePool: false });
    }
    this.tiles = [];
  }
}
