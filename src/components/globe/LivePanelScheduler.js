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
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { computeCoverUv } from './TextureManager.js';
import { getPlaceholderTexture } from './panelMaterial.js';
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
   */
  constructor({ panels, assets, poolHandle, textureManager, onLiveChange = null }) {
    this.panels = panels;
    this.assets = assets;
    this.pool = poolHandle;
    this.textureManager = textureManager;
    this.onLiveChange = onLiveChange;
    this.disposed = false;

    // Next pool index for hidden swaps — starts after the initial assignment
    this.cursor = assets.length ? panels.length % assets.length : 0;
    /** @type {Array<Object|null>} slot index → panel currently holding it */
    this.slots = Array(MAX_LIVE).fill(null);

    this.scoreVec = new THREE.Vector3();
    this.projVec = new THREE.Vector3();
    this.now = 0;
    this.lastVisibleCount = 0;
  }

  /**
   * @param {THREE.Euler} rotation - current globe rotation
   * @param {number} now - seconds since scene start
   * @param {THREE.Camera} camera - for viewport visibility (overscan crop)
   */
  update(rotation, now, camera) {
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
        (((score < DEMOTE_SCORE || !visible) && now - panel.liveSince > MIN_LIVE_DWELL_SECONDS) ||
          now - panel.liveSince > (panel.liveMaxDwell ?? MAX_LIVE_DWELL_SECONDS))
      ) {
        this.demote(panel);
      }
    }

    // Promote the most prominent eligible on-screen panels into free slots
    const candidates = scored
      .filter(
        ({ panel, score, visible }) =>
          !panel.liveState &&
          visible &&
          score > PROMOTE_SCORE &&
          now - (panel.lastLiveEnd ?? -Infinity) > RELIVE_COOLDOWN_SECONDS
      )
      .sort((a, b) => b.score - a.score);
    for (const { panel } of candidates) {
      const slot = this.slots.indexOf(null);
      if (slot === -1) break;
      this.promote(panel, slot);
    }

    // Hidden-hemisphere cycling
    let swaps = 0;
    for (const { panel, score } of scored) {
      if (swaps >= MAX_SWAPS_PER_UPDATE) break;
      if (score < SWAP_SCORE && !panel.liveState && !panel.swappedWhileHidden && !panel.swapping) {
        this.swapHidden(panel);
        swaps += 1;
      }
    }
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
    return {
      live: this.slots.filter((p) => p?.liveState === 'live').length,
      pending: this.slots.filter((p) => p?.liveState === 'pending').length,
      visible: this.lastVisibleCount,
      cursor: this.cursor,
    };
  }

  dispose() {
    this.disposed = true;
    this.panels.forEach((panel) => {
      this.announceOff(panel); // teardown counts as a release — labels clear
      gsap.killTweensOf(panel.mesh.material.uniforms.uMix);
      if (panel.videoTexture) {
        panel.videoTexture.dispose();
        panel.videoTexture = null;
      }
      panel.liveState = null;
      panel.liveSlot = null;
    });
    this.slots.fill(null);
  }
}
