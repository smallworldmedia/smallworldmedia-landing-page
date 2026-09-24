/**
 * tileSwap.js — the ONE refcount-safe way to put an asset on a globe tile,
 * plus the in-place swap styles the population modes use
 * (docs/globe-worlds-plan.md).
 *
 * loadTile(owner, panel, asset, onBound?) — MeridianScroll's former
 * loadThumb, generalized to still assets (assetKey). Ownership is
 * single-sourced through panel.heldThumbId (the key actually bound to texA),
 * NOT a per-call snapshot of panel.asset — panel.asset advances at load
 * START, so under overlapping loads a snapshot would leak the displayed
 * texture and double-release the intermediate one. Each loadAsset (+1) is
 * balanced by exactly one release: the winning load releases the previously
 * held key (and becomes the new held ref), a superseded/failed load releases
 * its own. panel.scrollToken orders overlapping loads. An already-decoded
 * texture binds synchronously (a warm swap lands on the same frame). Returns
 * a promise that settles once this load has bound or bowed out (the build's
 * cascade waits on it). owner = anything with { textureManager, disposed }
 * (the scroll driver, the population director).
 *
 * swapTile(owner, panel, asset, opts) — change a tile's asset without a
 * cross-dissolve (07-18: assets are PERSISTENT — the eye must never see two
 * images blend). The swap happens where the tile shows no media at all:
 *   blink  CRT power-down → swap at black → the power-on flicker back up
 *          (the entrance cascade's screen vocabulary)
 *   surge  the commit's inverted-CRT two-beat INTO electric blue, swap under
 *          full blue, the blue drains to reveal the new asset
 *   cut    swap at `delay`, uniforms untouched (the intro hold's dark tiles
 *          stay dark)
 * Only existing panelMaterial uniforms move (uPower, uBlueMix). A live video
 * on the tile is dropped at the swap instant (owner.dropLive), under the dip.
 */
import gsap from 'gsap';
import { assetKey, computeCoverUv } from './TextureManager.js';

export function loadTile(owner, panel, asset, onBound = null) {
  const tm = owner.textureManager;
  const key = assetKey(asset);
  // null (not undefined) marks the tile as loadTile-owned from here on, so
  // MeridianScroll's constructor never seeds a ref this tile doesn't hold.
  if (panel.heldThumbId === undefined) panel.heldThumbId = null;
  const token = (panel.scrollToken = (panel.scrollToken || 0) + 1);
  panel.asset = asset; // logical current asset (centerDir/scheduler); texA follows on bind
  const bind = (tex) => {
    if (owner.disposed || panel.scrollToken !== token) {
      tm.release(key); // superseded or torn down — release THIS load's ref
      return;
    }
    const u = panel.mesh.material.uniforms;
    const { scale, offset } = computeCoverUv(1, panel.panelAspect);
    u.texA.value = tex;
    u.uvScaleA.value.set(scale[0], scale[1]);
    u.uvOffsetA.value.set(offset[0], offset[1]);
    u.uHasTexA.value = 1;
    panel.shownAsset = asset; // what texA shows (panel.asset leads it while a load is in flight)
    // Release what this tile WAS showing (already ref-bumped above, so a
    // same-key reload can never dip to 0), then take ownership.
    if (panel.heldThumbId) tm.release(panel.heldThumbId);
    panel.heldThumbId = key;
    if (onBound) onBound(asset);
  };
  const pending = tm.loadAsset(asset);
  const ready = tm.peek(key);
  if (ready) {
    bind(ready);
    return Promise.resolve();
  }
  return pending.then(bind, () => tm.release(key)); // failed load — release its own +1
}

export const SWAP_STYLES = ['blink', 'surge', 'cut'];

function killSwap(panel) {
  if (panel.swapTl) panel.swapTl.kill();
  panel.swapTl = null;
}

/**
 * @param {Object} owner - { textureManager, disposed, dropLive?(panel) }
 * @param {Object} panel
 * @param {Object} asset
 * @param {Object} [opts]
 * @param {'blink'|'surge'|'cut'} [opts.style='blink']
 * @param {number} [opts.delay=0] - seconds before the swap begins
 * @param {number} [opts.dur=0.45] - seconds, the whole blink/surge envelope
 * @param {Function} [opts.onBound] - (asset) once the new texture is on texA
 */
export function swapTile(owner, panel, asset, { style = 'blink', delay = 0, dur = 0.45, onBound = null } = {}) {
  // A superseded swap just stops: the new envelope tweens on from wherever
  // the uniforms are (no snap back to full power mid-dip).
  killSwap(panel);
  const u = panel.mesh.material.uniforms;
  panel.swapping = true; // the live scheduler skips a tile mid-swap
  panel.swapAsset = asset;
  panel.swapStyle = style;
  const swapNow = () => {
    if (panel.swapAsset !== asset) return;
    panel.swapAsset = null;
    owner.dropLive?.(panel);
    loadTile(owner, panel, asset, onBound);
  };
  const tl = gsap.timeline({
    delay,
    onComplete: () => {
      panel.swapping = false;
      panel.swapTl = null;
    },
  });
  if (style === 'cut') {
    tl.call(swapNow, null, 0);
  } else if (style === 'surge') {
    // Beat 1 — the commit's blink (brightness 1 → 0.7) as the blue rises;
    // brightness returns while the blue lands full; swap under the blue;
    // the blue drains (smooth, no overshoot) onto the new asset.
    tl.to(u.uPower, { value: 0.7, duration: dur * 0.16, ease: 'none' }, 0)
      .to(u.uBlueMix, { value: 1, duration: dur * 0.32, ease: 'power1.inOut' }, dur * 0.1)
      .to(u.uPower, { value: 1, duration: dur * 0.26, ease: 'power1.inOut' }, dur * 0.16)
      .call(swapNow, null, dur * 0.44)
      .to(u.uBlueMix, { value: 0, duration: dur * 0.54, ease: 'power2.inOut' }, dur * 0.46);
  } else {
    // blink — power down to black, swap, then the power-on flicker (pulse →
    // dip → settle; unlike the entrance it lands on 1, no over-bright). A
    // superseded surge's leftover blue drains inside the dip.
    tl.to(u.uPower, { value: 0, duration: dur * 0.36, ease: 'power2.in' }, 0);
    if (u.uBlueMix.value > 0) tl.to(u.uBlueMix, { value: 0, duration: dur * 0.36, ease: 'none' }, 0);
    tl.call(swapNow, null, dur * 0.36).to(
      u.uPower,
      {
        keyframes: [
          { value: 0.55, duration: dur * 0.14, ease: 'power1.in' },
          { value: 0.2, duration: dur * 0.1, ease: 'none' },
          { value: 1, duration: dur * 0.4, ease: 'power2.out' },
        ],
      },
      dur * 0.38
    );
  }
  panel.swapTl = tl;
}

/**
 * Lay a whole plan (Map panel → asset) onto the tiles. Tiles already showing
 * (or swapping to) their planned asset are left alone. animate → a blink per
 * tile at a random delay within `spread`; else a cut (the tile's live video
 * drops first). onBound(asset) fires as each tile's new texture lands.
 * Returns { flips, span } — the swaps started and the seconds until the last
 * one lands.
 */
export function applyPlan(owner, plan, { animate, spread = 0.6, dur = 0.45, onBound = null } = {}) {
  let flips = 0;
  let span = 0;
  for (const [panel, asset] of plan) {
    if (assetKey(panel.swapAsset || panel.asset) === assetKey(asset)) continue;
    flips += 1;
    if (animate) {
      const delay = Math.random() * spread;
      swapTile(owner, panel, asset, { style: 'blink', delay, dur, onBound });
      span = Math.max(span, delay + dur);
    } else {
      cancelSwap(panel);
      owner.dropLive?.(panel);
      loadTile(owner, panel, asset, onBound);
    }
  }
  return { flips, span };
}

/**
 * Stop a tile's in-flight swap. complete=true lands it now (the asset swaps
 * immediately) — the commit's freeze, so the blue fill always starts from
 * the intended asset. An animated style snaps its screen back to full power,
 * no blue; a cut leaves the uniforms alone.
 */
export function cancelSwap(panel, owner = null, { complete = false } = {}) {
  if (!panel.swapTl) return;
  killSwap(panel);
  panel.swapping = false;
  if (panel.swapStyle !== 'cut') {
    const u = panel.mesh.material.uniforms;
    u.uPower.value = 1;
    u.uBlueMix.value = 0;
  }
  const asset = panel.swapAsset;
  panel.swapAsset = null;
  if (complete && owner && asset) {
    owner.dropLive?.(panel);
    loadTile(owner, panel, asset);
  }
}
