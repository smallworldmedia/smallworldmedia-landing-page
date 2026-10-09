/**
 * MeridianScroll.js — the brand globe's signature choreography.
 *
 * Rows of tiles travel pole-to-pole across the (fixed-tilt) globe: a row is born
 * at the top pole, grows outward down the meridians, and is consumed at the
 * bottom pole, each tile carrying ONE persistent media asset the whole journey.
 * The blue latitude lines are the gaps between rows, so they travel in sync for
 * free. This is the mechanism that visually states SWM's "world building".
 *
 * How it moves: the panelMaterial vertex shader (uUsePolarScroll) repositions a
 * tile's vertices from its canonical build band (uCanonTop) to a live polar-angle
 * top (uPolarTop), clamped to [0,π] so tiles pinch cleanly at the poles. This
 * driver just advances one continuous `scroll` angle and writes each row's
 * uPolarTop; the geometry does the reshaping. Rows are evenly spaced by `pitch`
 * and wrap through a range with a buffer beyond each pole, so a row is always
 * emerging and another consuming.
 *
 * Persistent assets, no crossfade: a tile keeps its asset for its entire visible
 * pass. Assets are only reassigned when a row WRAPS (bottom-pole → top-pole),
 * which happens while the row is parked past the pole (collapsed to a point,
 * invisible) — so the swap is never seen. That is what makes each asset read as
 * a persistent tile travelling, not a dissolve.
 *
 * Reconciliation with LivePanelScheduler: this driver is the sole owner of
 * panel.asset / texA, so the scheduler's hidden-hemisphere thumbnail cycling is
 * disabled (cycleThumbnails:false). Live video still promotes on the prominent
 * camera-facing rows and demotes as tiles scroll toward a pole — the scheduler's
 * score just works because centerDir is recomputed here every frame. Parked
 * (past-pole) tiles are flagged so the scheduler never streams video into a
 * collapsed row.
 *
 * Texture lifetime is refcount-balanced (TextureManager): a recycle releases the
 * row's outgoing thumbnails and loads its incoming ones, so residency stays
 * bounded by the pool. Only the (invisible) wrapping row loads per cycle.
 *
 * Tape coordinates (globe-worlds population modes, docs/globe-worlds-plan.md):
 * every row carries a monotonic BIRTH index — the initial rows are numbered in
 * scroll-0 order (initialBirth), each recycle takes the next — stamped on its
 * tiles as panel.tapeS. (lonIndex, tapeS) is the tile's place on an endless
 * tape, which worldPatterns lays client worlds over. An optional assignRow
 * hook (PopulationDirector) picks a recycled row's assets in place of the
 * pool cursor; without it the cursor runs exactly as before. advance() adds
 * extra travel for one frame: the director's tide transition surges the
 * scroll a full span, so the next world pours in from the top pole as rows
 * re-birth.
 */
import * as THREE from 'three';
import { assetKey } from './TextureManager.js';
import { loadTile } from './tileSwap.js';
import { SCROLL_VISIBLE_ROWS, SCROLL_PACE_SCALE } from './globeConfig.js';

/**
 * Birth index of row j of N at scroll 0. Row N-1 starts in the top buffer
 * (theta −pitch — the next to emerge, so the newest); rows 0..N-2 sit at
 * theta j·pitch, so row N-2 is the oldest (parked at the bottom pole, first to
 * wrap). Oldest → newest: N-2, N-3, …, 0, N-1. The scene stamps these at
 * build, before this driver exists (the initial layout needs them).
 */
export const initialBirth = (j, N) => (j === N - 1 ? N - 1 : N - 2 - j);

/** Row j's top polar angle at scroll 0 — exactly what thetaForRow(j) returns
 *  before this driver exists. The scene needs it to pose the globe for the
 *  initial layout, which runs ~250 lines before the constructor. */
export const scrollZeroTheta = (j, rows) => {
  const pitch = Math.PI / SCROLL_VISIBLE_ROWS;
  const lo = -pitch;
  const span = rows * pitch;
  return lo + ((((j * pitch - lo) % span) + span) % span);
};

/** Write one tile's pose from its row's top polar angle: the shader uniform AND
 *  the live centerDir every CPU-side consumer reads (the scheduler's score, the
 *  name band, initial prominence), AND the parked flag. THE one place that
 *  mapping lives, so a tile can never be posed for the shader but not for the
 *  latitude readers.
 *
 *  That exact split was a real bug: buildGlobeGeometry seeds centerDir at the
 *  canonical equator and the scene stamped only uPolarTop at scroll 0, so the
 *  initial layout planned the first world's client-name strip against a globe
 *  that reported every row at |y| = 0. The band gate admitted all 8 rows,
 *  parked buffers included, and the strip could land on row 0 — 14.45 deg from
 *  the pole, vK 0.25, four-times-condensed type for the whole first hold.
 *
 *  A row is "parked" (collapsed at/beyond a pole) when its center is not
 *  strictly inside (0, pi); the clamp keeps a parked row's centerDir pole-ward
 *  and sane rather than NaN. */
export const poseTile = (p, theta) => {
  const thetaC = theta + p.bandHeight / 2;
  p.parked = !(thetaC > 0 && thetaC < Math.PI);
  p.mesh.material.uniforms.uPolarTop.value = theta;
  const tc = Math.min(Math.max(thetaC, 0), Math.PI);
  const st = Math.sin(tc);
  p.centerDir.set(-Math.cos(p.phiC) * st, Math.cos(tc), Math.sin(p.phiC) * st);
};

export default class MeridianScroll {
  /**
   * @param {Object} opts
   * @param {Array}  opts.panels - scrolling panels ({ mesh, row, lonIndex, phiC, bandHeight, panelAspect, asset })
   * @param {Array}  opts.assets - full ordered asset pool
   * @param {TextureManager} opts.textureManager
   * @param {number} opts.cascadeSpeed - flow-speed knob (heroConfig cascadeSpeed)
   * @param {LivePanelScheduler|null} [opts.scheduler]
   * @param {(tiles: Array) => Array|null} [opts.assignRow] - a recycled row's
   *        assets (same order as tiles, which arrive in lon order with tapeS
   *        already stamped); null = the pool cursor
   */
  constructor({ panels, assets, textureManager, cascadeSpeed, scheduler = null, assignRow = null }) {
    this.assets = assets;
    this.textureManager = textureManager;
    this.scheduler = scheduler;
    this.assignRow = assignRow;
    this.disposed = false;

    // Group panels into rows (each = the 12 longitude tiles at one row index).
    const byRow = new Map();
    for (const p of panels) {
      if (!byRow.has(p.row)) byRow.set(p.row, []);
      byRow.get(p.row).push(p);
      p.mesh.frustumCulled = false; // shader repositions vertices — bounds are stale
      p.mesh.material.uniforms.uUsePolarScroll.value = 1;
      p.mesh.material.uniforms.uCanonTop.value = p.canonTop;
      // Thumbnail-ownership bookkeeping. heldThumbId is the single source of
      // truth for the texture key currently bound to texA (seeded from the build-
      // time assignment, whose loadThumbnail ref this tile now owns — unless the
      // build already went through loadTile, which tracks it itself); scrollToken
      // orders overlapping loads so a stalled one can't double-release (never
      // reset — a build-time loadTile may still be in flight).
      if (p.heldThumbId === undefined) p.heldThumbId = assetKey(p.asset);
      p.scrollToken ||= 0;
    }
    this.rows = [...byRow.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, tiles]) => tiles.sort((a, b) => a.lonIndex - b.lonIndex));
    const N = this.rows.length;
    this.rowBirth = this.rows.map((_, j) => initialBirth(j, N));
    this.nextBirth = N;
    this.rows.forEach((tiles, j) => {
      for (const p of tiles) p.tapeS = this.rowBirth[j];
    });

    this.pitch = Math.PI / SCROLL_VISIBLE_ROWS;
    this.lo = -this.pitch; // one buffer above the top pole
    this.span = N * this.pitch; // range width; the extra rows buffer beyond each pole

    // Polar scroll rate (rad/s). Non-positive speed parks the flow.
    const speed = Number.isFinite(cascadeSpeed) && cascadeSpeed > 0 ? cascadeSpeed : 0;
    this.rate = (this.pitch * speed) / SCROLL_PACE_SCALE;
    this.rateScale = 1; // population-mode multiplier on the pace (setRateScale)
    this.extra = 0; // population-mode travel queued for the next update (advance)

    // Source pool cursor — start past the initial assignment so fresh rows don't
    // immediately repeat the tiles already on screen.
    this.cursor = assets.length ? panels.length % assets.length : 0;

    this.scroll = 0;
    this.rowTheta = new Array(N).fill(0);
    this.rowPrevTheta = new Array(N).fill(null);
    this._dir = new THREE.Vector3();

    // Seed positions/centerDir at scroll 0 so the scheduler has live data before
    // the first update(), and the first frame renders in place.
    this.applyScroll();
  }

  /** Live pace change (the ?herotune bench). Recomputes the polar scroll rate
   *  from a new cascadeSpeed; non-positive parks the flow (update() early-outs).
   *  Pitch is fixed at build, so this is just the rate. No re-seed needed. */
  setSpeed(cascadeSpeed) {
    const speed = Number.isFinite(cascadeSpeed) && cascadeSpeed > 0 ? cascadeSpeed : 0;
    this.rate = (this.pitch * speed) / SCROLL_PACE_SCALE;
  }

  /** Population-mode pace multiplier (the tide surge, the procession flow) on
   *  top of the bench pace — 1 = the plain cascadeSpeed pace. */
  setRateScale(k) {
    this.rateScale = Number.isFinite(k) && k > 0 ? k : 0;
  }

  /** Extra polar travel (rad) on top of the pace, landed by the next update —
   *  the tide transition's surge, driven per frame by its own curve (even with
   *  the pace parked). Rows wrap (and re-birth) as they cross the bottom pole,
   *  exactly as at rest. The wrap test needs one frame's travel < span − pitch;
   *  the tide stays far below it. */
  advance(dTheta) {
    if (Number.isFinite(dTheta) && dTheta > 0) this.extra += dTheta;
  }

  nextPoolAsset() {
    const asset = this.assets[this.cursor % this.assets.length];
    this.cursor += 1;
    return asset;
  }

  /** Current top polar angle of row j, wrapped into [lo, lo+span). */
  thetaForRow(j) {
    const raw = j * this.pitch + this.scroll - this.lo;
    return this.lo + ((raw % this.span) + this.span) % this.span;
  }

  /** Write every row's uPolarTop + refresh centerDir/parked; recycle on wrap. */
  applyScroll() {
    for (let j = 0; j < this.rows.length; j++) {
      const theta = this.thetaForRow(j);
      const prev = this.rowPrevTheta[j];
      // Wrap = theta jumped backward (bottom-pole buffer → top-pole buffer). The
      // row is parked/invisible here, so reassigning its assets is unseen.
      if (prev != null && theta < prev - this.pitch) this.recycle(this.rows[j], j);
      this.rowTheta[j] = theta;
      this.rowPrevTheta[j] = theta;

      for (const p of this.rows[j]) poseTile(p, theta);
    }
  }

  /** Re-birth a parked row (the next tape index) and reassign its 12 tiles —
   *  the assignRow hook's picks, else fresh pool assets. Instant, the row is
   *  parked; refcount-balanced through loadTile (tileSwap.js). */
  recycle(tiles, j) {
    const s = (this.rowBirth[j] = this.nextBirth++);
    for (const p of tiles) p.tapeS = s;
    if (this.disposed) return;
    const picks = this.assignRow ? this.assignRow(tiles) : null;
    if (!picks && !this.assets.length) return;
    tiles.forEach((p, i) => {
      const asset = picks ? picks[i] : this.nextPoolAsset();
      if (!asset) return;
      // A live/pending video would now stream the wrong tile — demote it (the
      // row is parked/invisible, so this is silent).
      if (this.scheduler) this.scheduler.notifyContentChange(p);
      loadTile(this, p, asset);
    });
  }

  /** @param {number} dt - seconds since last frame (called every rendered frame) */
  update(dt) {
    if (this.disposed) return;
    const pace = this.rate > 0 && this.rateScale > 0 ? this.rate * this.rateScale * dt : 0;
    const travel = pace + this.extra;
    this.extra = 0;
    if (travel <= 0) return;
    this.scroll += travel;
    if (this.scroll >= this.span) this.scroll -= this.span; // keep bounded
    this.applyScroll();
  }

  dispose() {
    // Stops update() and makes in-flight loads self-release (token guard). The
    // driver is torn down immediately before TextureManager.disposeAll(), which
    // clears the cache regardless of refcount.
    this.disposed = true;
  }
}
