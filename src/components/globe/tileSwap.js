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
import { namePinch } from './nameTicker.js';
import { unitA } from './unitSpan.js';

/** A unit member's texA window from its own live pose: the ONE rule both writers
 *  use (windowA, so loadTile's bind; PopulationDirector.place). θ in the globe frame. */
export function unitWindowOf(panel, m, aTex) {
  const y = Math.min(Math.max(panel.centerDir.y, -1), 1);
  return unitA(m, namePinch(y), Math.acos(y), aTex);
}

/** THE texA window rule, for every texA writer: the texture's MEASURED aspect
 *  (userData.aspect: a class texture, a name strip; a legacy thumbnail has none
 *  and is square) covered onto the panel. A unit member (P4b) takes its own
 *  window inside the unit picture instead, unless the probe's kill switch
 *  globalThis.__swmNoUnitWindows is set (true or 'bind': globe-probe's --negctl
 *  and --negctl=bind). */
export function windowA(panel, asset, tex) {
  if (asset?.place && !globalThis.__swmNoUnitWindows) return unitWindowOf(panel, asset, tex?.userData?.aspect ?? asset.tex?.aspect ?? 1);
  const { scale, offset } = computeCoverUv(tex?.userData?.aspect ?? 1, panel.panelAspect);
  return { s: scale, o: offset };
}

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
    const { s: scale, o: offset } = windowA(panel, asset, tex); // THE window rule (measured aspect; P4b: a member's own window)
    u.texA.value = tex;
    u.uvScaleA.value.set(scale[0], scale[1]);
    u.uvOffsetA.value.set(offset[0], offset[1]);
    u.uHasTexA.value = 1;
    // A PLANNED member (the director's plan) is right on its FIRST bound frame (windowA,
    // above). A BORN member (MeridianScroll's born pair) binds while parked past the south
    // pole (recycle runs before poseTile), and place() writes its window before its first
    // unparked render (P4b, d0e430f). The probe's nc-bind covers planned binds only; born
    // pairs are covered by the unit test "spans: through a tide’s travel, place() after
    // each frame’s scroll keeps whole units registered and seamless, born pairs from their
    // first frame (P4b)". The hook reads only panel and asset.
    if (asset.place) panel._skewTheta = Math.acos(Math.min(Math.max(panel.centerDir.y, -1), 1));
    panel._bound = asset; // place() counts any unit record shown without this bind (snaps, gated 0)
    panel.unitCentre = null; // a fresh bind re-derives it next frame (place)
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

/** applyPlan's skip test: the texture AND the unit slot. A same-texture tile that
 *  moves between single and member (or between units) must still swap, so its
 *  window changes under the dip. With units off this is assetKey + '|-'. */
export const placeKey = (a) => `${assetKey(a)}|${a?.place ? `${a.place.uid}:${a.kx}:${a.ky}` : '-'}`;

/** One stagger delay per connected group of unit ids, old ∪ new: a new unit and
 *  every unit it breaks dip together, so no unit is ever seen half-swapped.
 *  Union-find over panels and `u:<uid>` nodes; one Math.random() per group, in plan order. */
export function sharedDelays(plan, spread) {
  const parent = new Map();
  const add = (x) => (parent.has(x) ? x : (parent.set(x, x), x));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const join = (a, b) => {
    const ra = find(add(a));
    const rb = find(add(b));
    if (ra !== rb) parent.set(rb, ra);
  };
  for (const [panel, asset] of plan) {
    add(panel);
    const was = (panel.swapAsset || panel.asset)?.place?.uid;
    const now = asset?.place?.uid;
    if (was) join(panel, `u:${was}`);
    if (now) join(panel, `u:${now}`);
  }
  const drawn = new Map();
  const out = new Map();
  for (const [panel] of plan) {
    const root = find(panel);
    if (!drawn.has(root)) drawn.set(root, Math.random() * spread);
    out.set(panel, drawn.get(root));
  }
  return out;
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
  const s0 = panel.tapeS; // a re-born row stamps a new tape index (MeridianScroll.recycle)
  const swapNow = () => {
    if (panel.swapAsset !== asset) return;
    // Landing on a tile whose row was re-born under the dip is the stale-swap
    // race: counted for the probe (staleLanded, gated to 0). recycle cancels these first.
    if (panel.tapeS !== s0) owner.staleLanded = (owner.staleLanded || 0) + 1;
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
 * (or swapping to) their planned asset are left alone. animate → a `style`
 * swap (blink | surge) per tile at a random delay within `spread`; else — or
 * style 'cut' — every tile at once (its live video drops first). onBound(asset)
 * fires as each tile's new texture lands. Returns { flips, span } — the swaps
 * started and the seconds until the last one lands. `delays` (a Map panel → s,
 * from sharedDelays) replaces the per-tile draw; tiles are skipped by placeKey.
 */
export function applyPlan(owner, plan, { animate, style = 'blink', spread = 0.6, dur = 0.45, onBound = null, delays = null } = {}) {
  let flips = 0;
  let span = 0;
  for (const [panel, asset] of plan) {
    if (placeKey(panel.swapAsset || panel.asset) === placeKey(asset)) continue;
    flips += 1;
    if (animate && style !== 'cut') {
      const delay = delays ? (delays.get(panel) ?? 0) : Math.random() * spread;
      swapTile(owner, panel, asset, { style, delay, dur, onBound });
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
