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
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { computeCoverUv } from './TextureManager.js';
import { getPlaceholderTexture } from './panelMaterial.js';
import {
  MAX_LIVE,
  PROMOTE_SCORE,
  DEMOTE_SCORE,
  SWAP_SCORE,
  MIN_LIVE_DWELL_SECONDS,
  CROSSFADE_SECONDS,
} from './globeConfig.js';

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
   */
  constructor({ panels, assets, poolHandle, textureManager }) {
    this.panels = panels;
    this.assets = assets;
    this.pool = poolHandle;
    this.textureManager = textureManager;
    this.disposed = false;

    // Next pool index for hidden swaps — starts after the initial assignment
    this.cursor = assets.length ? panels.length % assets.length : 0;
    /** @type {Array<Object|null>} slot index → panel currently holding it */
    this.slots = Array(MAX_LIVE).fill(null);

    this.scoreVec = new THREE.Vector3();
    this.now = 0;
  }

  score(panel, rotation) {
    return this.scoreVec.copy(panel.centerDir).applyEuler(rotation).z;
  }

  /**
   * @param {THREE.Euler} rotation - current globe rotation
   * @param {number} now - seconds since scene start
   */
  update(rotation, now) {
    if (this.disposed || !this.assets.length) return;
    this.now = now;

    const scored = this.panels.map((panel) => ({
      panel,
      score: this.score(panel, rotation),
    }));

    for (const { panel, score } of scored) {
      // Reset the per-trip swap latch once the panel comes around front
      if (score > 0) panel.swappedWhileHidden = false;

      if (
        panel.liveState === 'live' &&
        score < DEMOTE_SCORE &&
        now - panel.liveSince > MIN_LIVE_DWELL_SECONDS
      ) {
        this.demote(panel);
      }
    }

    // Promote the most prominent eligible panels into free slots
    const candidates = scored
      .filter(({ panel, score }) => !panel.liveState && score > PROMOTE_SCORE)
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
        gsap.to(uniforms.uMix, {
          value: 1,
          duration: CROSSFADE_SECONDS,
          ease: 'power2.out',
          overwrite: true,
        });
      })
      .catch(() => {
        // Slot reassigned/released or stream failed — roll back cleanly
        if (panel.liveState === 'pending') this.freePanel(panel, { releasePool: true });
      });
  }

  demote(panel) {
    panel.liveState = 'demoting';
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
      cursor: this.cursor,
    };
  }

  dispose() {
    this.disposed = true;
    this.panels.forEach((panel) => {
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
