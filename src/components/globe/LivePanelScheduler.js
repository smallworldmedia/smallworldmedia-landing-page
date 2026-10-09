/**
 * LivePanelScheduler.js — Migrates "live video" status between panels and
 * cycles hidden-hemisphere thumbnails through the asset pool.
 *
 * Called at ~2Hz (not per frame). Prominence score = panel center normal
 * rotated by the globe, read on the camera axis (.z): 1 = dead center,
 * -1 = fully hidden.
 *
 *  - Promote: score > PROMOTE_SCORE and a slot is free → HLS video fades in
 *    over the thumbnail (uMix 0→1) once frames are presenting.
 *  - Demote: score < DEMOTE_SCORE (hysteresis) after MIN_LIVE_DWELL —
 *    uMix fades back to the thumbnail, then the slot frees.
 *  - Hidden swap: score < SWAP_SCORE → texA quietly advances to the next
 *    pool asset; the inner sphere occludes the rear hemisphere so swaps are
 *    never visible. One swap per panel per trip behind the globe.
 *
 * Optional onLiveChange(panel, 'live'|'off') announces the transitions
 * outward (the home hero's tracking labels) — see the constructor JSDoc.
 * Events only; nothing outside ever polls scheduler internals.
 *
 * Globe-worlds population modes: a still tile (no playbackId) never promotes,
 * a tile mid-swap (panel.swapping — tileSwap.js) never promotes, and
 * dropLive(panel) frees a tile's video instantly, under a swap's dip.
 * setShared(true) (?poplive=shared) spends the decode budget per CLIP instead
 * of per tile: one slot, one <video>, one VideoTexture per playbackId, bound
 * on every tile showing it (see updateShared).
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { computeCoverUv } from './TextureManager.js';
import { getPlaceholderTexture } from './panelMaterial.js';
import { TUNING as POP_TUNING } from './popConfig.js';
import { namePinch } from './nameTicker.js';
import {
  MAX_LIVE,
  RADIUS,
  PROMOTE_SCORE,
  DEMOTE_SCORE,
  SWAP_SCORE,
  MIN_LIVE_DWELL_SECONDS,
  MAX_LIVE_DWELL_SECONDS,
  RELIVE_COOLDOWN_SECONDS,
  CROSSFADE_SECONDS,
} from './globeConfig.js';

// NDC margin for "on screen" — matters in mobile cover-overscan, where a
// panel can face the camera yet sit cropped outside the viewport
const VIEWPORT_NDC_LIMIT = 1.05;

const MAX_SWAPS_PER_UPDATE = 4; // spread thumbnail fetches out over time
// Spread Hls/MSE startups across beats — a drag release frees several slots
// at once, and refilling them all in one beat stacks player setups on a frame
const MAX_PROMOTES_PER_UPDATE = 2;

function parseAspect(ratio) {
  if (typeof ratio !== 'string') return 1;
  const [w, h] = ratio.split(':').map(Number);
  return w > 0 && h > 0 ? w / h : 1;
}

export default class LivePanelScheduler {
  /**
   * @param {Object} opts
   * @param {Array} opts.panels - panel records with { mesh, centerDir, panelAspect, asset }
   * @param {Array} opts.assets - full ordered asset pool
   * @param {Object} opts.poolHandle - VideoSlotPool imperative handle (ref.current)
   * @param {TextureManager} opts.textureManager
   * @param {(panel: Object, state: 'live'|'off') => void} [opts.onLiveChange]
   *        Live-transition events (home-hero labels, chunk 6): 'live' when a
   *        promotion's crossfade COMPLETES (the panel is actually showing
   *        video), 'off' at demote start and on any slot release/teardown.
   *        The liveAnnounced latch guarantees exactly one 'off' per 'live' —
   *        a pending rollback that never presented frames emits nothing.
   * @param {boolean} [opts.cycleThumbnails=true] - hidden-hemisphere thumbnail
   *        cycling. The home-hero ContentConveyor owns panel.asset/texA now, so
   *        it passes false to stop the scheduler fighting it over texA; lab and
   *        other callers keep the default rear-hemisphere swap.
   */
  constructor({
    panels,
    assets,
    poolHandle,
    textureManager,
    onLiveChange = null,
    cycleThumbnails = true,
  }) {
    this.panels = panels;
    this.assets = assets;
    this.pool = poolHandle;
    this.textureManager = textureManager;
    this.onLiveChange = onLiveChange;
    this.cycleThumbnails = cycleThumbnails;
    this.disposed = false;

    // Next pool index for hidden swaps — starts after the initial assignment
    this.cursor = assets.length ? panels.length % assets.length : 0;
    /** @type {Array<Object|null>} slot index → panel currently holding it
     *  (shared mode: the stream holding it) */
    this.slots = Array(MAX_LIVE).fill(null);
    this.shared = false;
    /** shared mode: playbackId → { id, slot, state, texture, panels, since, maxDwell } */
    this.streams = new Map();
    this.clipLastEnd = new Map(); // shared mode: playbackId → when its stream ended (cooldown)

    this.scoreVec = new THREE.Vector3();
    this.projVec = new THREE.Vector3();
    this.now = 0;
    this.lastVisibleCount = 0;
  }

  /**
   * @param {THREE.Euler} rotation - current globe rotation
   * @param {number} now - seconds since scene start
   * @param {THREE.Camera} camera - for viewport visibility (overscan crop)
   * @param {boolean} [dragging=false] - user is mid-drag: skip promotions
   *        (no Hls startups during the gesture); demotes and hidden swaps
   *        still run
   */
  update(rotation, now, camera, dragging = false) {
    if (this.disposed || !this.assets.length) return;
    this.now = now;

    const scored = this.panels.map((panel) => {
      const dir = this.scoreVec.copy(panel.centerDir).applyEuler(rotation);
      const score = dir.z;
      let visible = score > 0;
      if (visible && camera) {
        this.projVec.copy(dir).multiplyScalar(RADIUS).project(camera);
        visible =
          Math.abs(this.projVec.x) <= VIEWPORT_NDC_LIMIT &&
          Math.abs(this.projVec.y) <= VIEWPORT_NDC_LIMIT;
      }
      return { panel, score, visible };
    });
    this.lastVisibleCount = scored.filter((s) => s.visible).length;

    // Shared streams run on the scroll globe only, where the hidden-hemisphere
    // cycle below is off (cycleThumbnails false), so its latch never matters.
    if (this.shared) {
      this.updateShared(scored, dragging);
    } else {
      for (const { panel, score, visible } of scored) {
        // Reset the per-trip swap latch once the panel comes around front
        if (score > 0) panel.swappedWhileHidden = false;

        // Pole-adjacent panels never fall below the (low) demote threshold, so
        // a hard max dwell rotates every slot; the cooldown below stops the
        // same prominent panel from immediately re-winning it. Dwell is
        // jittered per promote (±25%) so slots filled together don't all
        // fade in one synchronized wave.
        if (
          panel.liveState === 'live' &&
          // Parked (past-pole, collapsed) scroll tiles demote immediately —
          // streaming video into an invisible about-to-recycle row is wasted.
          (panel.parked ||
            // Drifting INTO the grain band gives the slot back — without this
            // a tile promoted at mid-latitude holds its decode all the way to
            // the pole, under static, and the gate buys nothing.
            this.grainHidden(panel) ||
            ((score < DEMOTE_SCORE || !visible) && now - panel.liveSince > MIN_LIVE_DWELL_SECONDS) ||
            now - panel.liveSince > (panel.liveMaxDwell ?? MAX_LIVE_DWELL_SECONDS))
        ) {
          this.demote(panel);
        }
      }

      // Promote the most prominent eligible on-screen panels into free slots.
      // Deferred entirely mid-drag — panels demoted by the gesture would refill
      // immediately and stutter the drag; the beat after release catches up.
      if (!dragging) {
        const candidates = scored
          .filter(
            ({ panel, score, visible }) =>
              !panel.liveState &&
              panel.asset?.playbackId && // stills have no stream
              !panel.swapping &&
              !panel.parked && // never stream into a collapsed past-pole scroll tile
              !this.grainHidden(panel) && // nor into one whose media is under static
              visible &&
              score > PROMOTE_SCORE &&
              now - (panel.lastLiveEnd ?? -Infinity) > RELIVE_COOLDOWN_SECONDS
          )
          .sort((a, b) => b.score - a.score);
        let promotes = 0;
        for (const { panel } of candidates) {
          if (promotes >= MAX_PROMOTES_PER_UPDATE) break;
          const slot = this.slots.indexOf(null);
          if (slot === -1) break;
          this.promote(panel, slot);
          promotes += 1;
        }
      }
    }

    // Hidden-hemisphere cycling — skipped when a ContentConveyor owns texA.
    if (this.cycleThumbnails) {
      let swaps = 0;
      for (const { panel, score } of scored) {
        if (swaps >= MAX_SWAPS_PER_UPDATE) break;
        if (score < SWAP_SCORE && !panel.liveState && !panel.swappedWhileHidden && !panel.swapping) {
          this.swapHidden(panel);
          swaps += 1;
        }
      }
    }
  }

  /**
   * The content conveyor advanced this panel's asset — any live video here now
   * streams the wrong tile. Demote it (crossfade back to the now-correct still);
   * the promote loop re-establishes video on the new asset if it stays prominent.
   * A 'pending' promotion is left alone: it's brief and will rotate off on its
   * own, and cancelling an in-flight pool assign cleanly isn't worth the churn.
   */
  notifyContentChange(panel) {
    if (this.disposed) return;
    if (this.shared) this.detach(panel); // the stream plays on for its other copies
    else if (panel.liveState === 'live') this.demote(panel);
  }

  /**
   * A population swap is changing this tile's asset under a dip to black or
   * blue — release its video NOW (no crossfade back to the still: the screen
   * is dark, and the still is about to change too). Pending promotions roll
   * back through the same liveState check the pool resolve already makes.
   */
  dropLive(panel) {
    if (this.disposed) return;
    if (this.shared) {
      this.detach(panel);
      return;
    }
    if (!panel.liveState) return;
    gsap.killTweensOf(panel.mesh.material.uniforms.uMix);
    this.freePanel(panel, { releasePool: true });
  }

  /**
   * Switch the live tier between one decode per tile (default) and shared
   * streams (the population modes, ?poplive). Everything live drops first; the
   * next update re-lights the prominent tiles under the new mode.
   */
  setShared(on) {
    const want = !!on;
    if (this.disposed || want === this.shared) return;
    for (const s of [...this.streams.values()]) this.releaseStream(s);
    for (const p of this.panels) {
      if (!p.liveState) continue;
      gsap.killTweensOf(p.mesh.material.uniforms.uMix);
      this.freePanel(p, { releasePool: true });
    }
    this.shared = want;
  }

  /* — Shared streams (?poplive=shared) — the decode budget is spent per CLIP,
     not per tile: one slot, one <video>, ONE VideoTexture per playbackId,
     bound into texB on every tile showing that clip (each with its own cover
     crop), so a world whose clips repeat across the globe lights every repeat
     for one decode — and the repeats run in sync, the same frame on every
     copy. A tile joins while it shows the clip (not parked, not mid-swap) and
     leaves the instant its content changes (recycle, a swap's dip,
     dropLive). A stream starts for the most prominent visible clips (their
     tiles' scores summed), ends when none of its tiles is on screen after
     MIN_LIVE_DWELL or at its jittered max dwell (every copy crossfades back
     to the still), then its clip cools down before it can win a slot again. — */
  updateShared(scored, dragging) {
    const now = this.now;
    const seen = new Set();
    for (const { panel, score, visible } of scored) {
      const s = panel.liveStream;
      if (!s) continue;
      if (panel.parked || panel.asset?.playbackId !== s.id) this.detach(panel);
      else if (visible && score >= DEMOTE_SCORE && !this.grainHidden(panel)) seen.add(s);
    }
    for (const s of [...this.streams.values()]) {
      if (s.state !== 'live') continue;
      const age = now - s.since;
      if (!s.panels.size || (!seen.has(s) && age > MIN_LIVE_DWELL_SECONDS) || age > s.maxDwell) {
        this.endStream(s);
      }
    }
    // Joining costs no decode — it runs mid-drag too.
    for (const { panel } of scored) {
      if (!this.canJoin(panel)) continue;
      const s = this.streams.get(panel.asset.playbackId);
      if (s?.state === 'live') this.attach(panel, s);
    }
    // New streams wait out a drag or a population relayout, like promotes.
    if (dragging) return;
    const clips = new Map();
    for (const { panel, score, visible } of scored) {
      if (!visible || score <= PROMOTE_SCORE || !this.canJoin(panel)) continue;
      const id = panel.asset.playbackId;
      if (this.streams.has(id)) continue;
      if (now - (this.clipLastEnd.get(id) ?? -Infinity) <= RELIVE_COOLDOWN_SECONDS) continue;
      clips.set(id, (clips.get(id) || 0) + score);
    }
    let starts = 0;
    for (const [id] of [...clips].sort((a, b) => b[1] - a[1])) {
      if (starts >= MAX_PROMOTES_PER_UPDATE) break;
      const slot = this.slots.indexOf(null);
      if (slot === -1) break;
      this.startStream(id, slot);
      starts += 1;
    }
  }

  /* The grain band (?popgrainlive, default 0). A tile whose media is fully
     hidden under static has nothing to show, so it should not hold a decode —
     the budget goes to mid-latitudes where the eye is. Nathan approved the
     trade-off 10-07; the cost is more promote/demote churn where he is looking.

     Threshold mirrors the shader through namePinch — the existing exact JS
     mirror of vK — rather than a second sqrt that would disagree by a few
     degrees. Uses grainStart alone, NOT the per-tile stagger: a slot decision
     wants a stable boundary, not one that flickers with the reveal order.

     Scroll tiles only (canonTop is stamped only in conveyor mode); the fixed
     globe has no pinch and no grain, and must not be gated by latitude. */
  grainHidden(panel) {
    if (!POP_TUNING.grainLive || !(POP_TUNING.grainAmt > 0)) return false;
    if (panel.canonTop === undefined || !panel.centerDir) return false;
    return namePinch(panel.centerDir.y) < POP_TUNING.grainStart;
  }

  /* The shared-mode choke point: the join loop, the clip-score accumulation
     and the resolve-time attach sweep all pass through here, so the grain gate
     lands in ONE place instead of three that could drift apart. (Gating the
     score loop while the attach sweep still bound pole tiles would be strictly
     worse than not gating at all.) */
  canJoin(panel) {
    return (
      !!panel.asset?.playbackId &&
      !panel.liveState &&
      !panel.parked &&
      !panel.swapping &&
      !this.grainHidden(panel)
    );
  }

  startStream(id, slot) {
    const stream = { id, slot, state: 'pending', texture: null, panels: new Set(), since: this.now, maxDwell: 0, releaseCall: null };
    this.streams.set(id, stream);
    this.slots[slot] = stream;
    this.pool
      .assign(slot, id)
      .then((video) => {
        if (this.disposed || this.streams.get(id) !== stream) return;
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.NoColorSpace; // raw upload — the tile mode's contract (promote)
        texture.minFilter = THREE.LinearFilter;
        stream.texture = texture;
        stream.state = 'live';
        stream.since = this.now;
        stream.maxDwell = MAX_LIVE_DWELL_SECONDS * (0.75 + Math.random() * 0.5);
        for (const p of this.panels) if (p.asset?.playbackId === id && this.canJoin(p)) this.attach(p, stream);
        if (!stream.panels.size) this.releaseStream(stream); // every copy left while it loaded
      })
      .catch(() => {
        // Slot released under it (releaseStream rejects the waiter) or the
        // stream failed — a released stream is already gone from the map.
        if (this.streams.get(id) === stream) this.releaseStream(stream);
      });
  }

  attach(panel, stream) {
    const { uniforms } = panel.mesh.material;
    const { scale, offset } = computeCoverUv(parseAspect(panel.asset.videoAspectRatio), panel.panelAspect);
    uniforms.texB.value = stream.texture;
    uniforms.uVideoB.value = 1;
    uniforms.uvScaleB.value.set(scale[0], scale[1]);
    uniforms.uvOffsetB.value.set(offset[0], offset[1]);
    stream.panels.add(panel);
    panel.liveStream = stream;
    panel.liveState = 'live';
    gsap.to(uniforms.uMix, {
      value: 1,
      duration: CROSSFADE_SECONDS,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => {
        if (!this.disposed && panel.liveStream === stream && panel.liveState === 'live') this.announceLive(panel);
      },
    });
  }

  /** A copy leaves its stream at once (its content is changing or it has
   *  collapsed past a pole) — the stream plays on for the others. */
  detach(panel) {
    const s = panel.liveStream;
    if (!s) return;
    s.panels.delete(panel);
    this.clearCopy(panel);
  }

  clearCopy(panel) {
    this.announceOff(panel);
    const { uniforms } = panel.mesh.material;
    gsap.killTweensOf(uniforms.uMix);
    uniforms.uMix.value = 0;
    uniforms.uVideoB.value = 0;
    uniforms.texB.value = getPlaceholderTexture(); // never leave a sampler unbound
    panel.liveStream = null;
    panel.liveState = null;
  }

  /** Every copy crossfades back to its still, then the slot frees. */
  endStream(stream) {
    if (stream.state !== 'live' || !stream.panels.size) {
      this.releaseStream(stream);
      return;
    }
    stream.state = 'demoting';
    for (const p of stream.panels) {
      p.liveState = 'demoting';
      this.announceOff(p); // the label fades with the crossfade, as in demote()
      gsap.to(p.mesh.material.uniforms.uMix, { value: 0, duration: CROSSFADE_SECONDS, ease: 'power2.out', overwrite: true });
    }
    stream.releaseCall = gsap.delayedCall(CROSSFADE_SECONDS, () => this.releaseStream(stream));
  }

  releaseStream(stream) {
    if (this.streams.get(stream.id) !== stream) return;
    stream.releaseCall?.kill();
    for (const p of stream.panels) this.clearCopy(p);
    stream.panels.clear();
    this.streams.delete(stream.id);
    this.clipLastEnd.set(stream.id, this.now);
    if (this.slots[stream.slot] === stream) {
      this.slots[stream.slot] = null;
      if (!this.disposed) this.pool.releaseSlot(stream.slot);
    }
    stream.texture?.dispose();
    stream.texture = null;
  }

  promote(panel, slot) {
    panel.liveState = 'pending';
    this.slots[slot] = panel;
    panel.liveSlot = slot;
    const { playbackId } = panel.asset;

    this.pool
      .assign(slot, playbackId)
      .then((video) => {
        if (this.disposed || panel.liveState !== 'pending') return;
        const texture = new THREE.VideoTexture(video);
        // Raw upload by design: three forces a linear internal format for
        // video textures regardless of colorSpace, so the shader decodes
        // sRGB manually (uVideoB). NoColorSpace makes that contract explicit.
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        panel.videoTexture = texture;

        const { uniforms } = panel.mesh.material;
        const { scale, offset } = computeCoverUv(
          parseAspect(panel.asset.videoAspectRatio),
          panel.panelAspect
        );
        uniforms.texB.value = texture;
        uniforms.uVideoB.value = 1;
        uniforms.uvScaleB.value.set(scale[0], scale[1]);
        uniforms.uvOffsetB.value.set(offset[0], offset[1]);

        panel.liveState = 'live';
        panel.liveSince = this.now;
        panel.liveMaxDwell = MAX_LIVE_DWELL_SECONDS * (0.75 + Math.random() * 0.5);
        gsap.to(uniforms.uMix, {
          value: 1,
          duration: CROSSFADE_SECONDS,
          ease: 'power2.out',
          overwrite: true,
          // 'live' fires only once frames are truly on screen. A demote
          // before then kills this tween (overwrite on the same uniform),
          // so a never-shown panel never announces.
          onComplete: () => {
            if (!this.disposed && panel.liveState === 'live') this.announceLive(panel);
          },
        });
      })
      .catch(() => {
        // Slot reassigned/released or stream failed — roll back cleanly
        if (panel.liveState === 'pending') this.freePanel(panel, { releasePool: true });
      });
  }

  /* — Label events (chunk 6) — the latch pair: announceLive marks the
     panel, announceOff only fires for a marked panel and clears the mark,
     so every consumer sees balanced live/off pairs no matter which path
     (demote, rollback, dispose) frees the slot. Null-safe: without a
     callback both are no-ops beyond the flag write. — */
  announceLive(panel) {
    if (!this.onLiveChange) return;
    panel.liveAnnounced = true;
    this.onLiveChange(panel, 'live');
  }

  announceOff(panel) {
    if (!this.onLiveChange || !panel.liveAnnounced) return;
    panel.liveAnnounced = false;
    this.onLiveChange(panel, 'off');
  }

  demote(panel) {
    panel.liveState = 'demoting';
    // 'off' at demote START — the label fades while the crossfade back to
    // the thumbnail plays, not after.
    this.announceOff(panel);
    const { uniforms } = panel.mesh.material;
    gsap.to(uniforms.uMix, {
      value: 0,
      duration: CROSSFADE_SECONDS,
      ease: 'power2.out',
      overwrite: true,
      onComplete: () => this.freePanel(panel, { releasePool: true }),
    });
  }

  freePanel(panel, { releasePool }) {
    this.announceOff(panel); // no-op when demote already announced (latch)
    const slot = panel.liveSlot;
    if (slot != null && this.slots[slot] === panel) {
      if (releasePool && !this.disposed) this.pool.releaseSlot(slot);
      this.slots[slot] = null;
    }
    if (panel.videoTexture) {
      const { uniforms } = panel.mesh.material;
      uniforms.uMix.value = 0;
      uniforms.uVideoB.value = 0;
      uniforms.texB.value = getPlaceholderTexture(); // never leave a sampler unbound
      panel.videoTexture.dispose();
      panel.videoTexture = null;
    }
    panel.liveSlot = null;
    if (panel.liveState) panel.lastLiveEnd = this.now;
    panel.liveState = null;
  }

  swapHidden(panel) {
    const nextAsset = this.assets[this.cursor % this.assets.length];
    this.cursor += 1;
    panel.swapping = true;

    this.textureManager
      .loadThumbnail(nextAsset.playbackId)
      .then((texture) => {
        if (this.disposed) return;
        const previousId = panel.asset?.playbackId;
        const { uniforms } = panel.mesh.material;
        const { scale, offset } = computeCoverUv(1, panel.panelAspect);
        uniforms.texA.value = texture;
        uniforms.uvScaleA.value.set(scale[0], scale[1]);
        uniforms.uvOffsetA.value.set(offset[0], offset[1]);
        uniforms.uHasTexA.value = 1;
        panel.asset = nextAsset;
        if (previousId) this.textureManager.release(previousId);
      })
      .catch(() => {
        this.textureManager.release(nextAsset.playbackId);
      })
      .finally(() => {
        panel.swapping = false;
        panel.swappedWhileHidden = true;
      });
  }

  getStats() {
    if (this.shared) {
      const streams = [...this.streams.values()];
      return {
        live: streams.filter((s) => s.state === 'live').length, // decodes, not tiles
        pending: streams.filter((s) => s.state === 'pending').length,
        liveTiles: streams.reduce((n, s) => n + s.panels.size, 0),
        visible: this.lastVisibleCount,
        cursor: this.cursor,
      };
    }
    return {
      live: this.slots.filter((p) => p?.liveState === 'live').length,
      pending: this.slots.filter((p) => p?.liveState === 'pending').length,
      visible: this.lastVisibleCount,
      cursor: this.cursor,
    };
  }

  dispose() {
    this.disposed = true;
    for (const s of this.streams.values()) {
      s.releaseCall?.kill();
      s.texture?.dispose();
    }
    this.streams.clear();
    this.panels.forEach((panel) => {
      this.announceOff(panel); // teardown counts as a release — labels clear
      gsap.killTweensOf(panel.mesh.material.uniforms.uMix);
      if (panel.videoTexture) {
        panel.videoTexture.dispose();
        panel.videoTexture = null;
      }
      panel.liveState = null;
      panel.liveSlot = null;
      panel.liveStream = null;
    });
    this.slots.fill(null);
  }
}
