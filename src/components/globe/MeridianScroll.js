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
 */
import * as THREE from 'three';
import { computeCoverUv } from './TextureManager.js';
import { SCROLL_VISIBLE_ROWS, SCROLL_PACE_SCALE } from './globeConfig.js';

export default class MeridianScroll {
  /**
   * @param {Object} opts
   * @param {Array}  opts.panels - scrolling panels ({ mesh, row, lonIndex, phiC, bandHeight, panelAspect, asset })
   * @param {Array}  opts.assets - full ordered asset pool
   * @param {TextureManager} opts.textureManager
   * @param {number} opts.cascadeSpeed - flow-speed knob (heroConfig cascadeSpeed)
   * @param {LivePanelScheduler|null} [opts.scheduler]
   */
  constructor({ panels, assets, textureManager, cascadeSpeed, scheduler = null }) {
    this.assets = assets;
    this.textureManager = textureManager;
    this.scheduler = scheduler;
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
      // truth for the playbackId currently bound to texA (seeded from the build-
      // time assignment, whose loadThumbnail ref this tile now owns); scrollToken
      // orders overlapping recycles so a stalled load can't double-release.
      p.heldThumbId = p.asset?.playbackId ?? null;
      p.scrollToken = 0;
    }
    this.rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, tiles]) => tiles);
    const N = this.rows.length;

    this.pitch = Math.PI / SCROLL_VISIBLE_ROWS;
    this.lo = -this.pitch; // one buffer above the top pole
    this.span = N * this.pitch; // range width; the extra rows buffer beyond each pole

    // Polar scroll rate (rad/s). Non-positive speed parks the flow.
    const speed = Number.isFinite(cascadeSpeed) && cascadeSpeed > 0 ? cascadeSpeed : 0;
    this.rate = (this.pitch * speed) / SCROLL_PACE_SCALE;

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
      if (prev != null && theta < prev - this.pitch) this.recycle(this.rows[j]);
      this.rowTheta[j] = theta;
      this.rowPrevTheta[j] = theta;

      const tiles = this.rows[j];
      // Tile center latitude; a row is "parked" (collapsed at/beyond a pole) when
      // its center is not strictly inside (0, π). Clamp the value used for
      // centerDir so a parked row still yields a sane (pole-ward) direction.
      for (const p of tiles) {
        const thetaC = theta + p.bandHeight / 2;
        p.parked = !(thetaC > 0 && thetaC < Math.PI);
        p.mesh.material.uniforms.uPolarTop.value = theta;
        const tc = Math.min(Math.max(thetaC, 0), Math.PI);
        const st = Math.sin(tc);
        p.centerDir.set(-Math.cos(p.phiC) * st, Math.cos(tc), Math.sin(p.phiC) * st);
      }
    }
  }

  /** Reassign a parked row's 12 tiles to fresh pool assets (refcount-balanced). */
  recycle(tiles) {
    if (this.disposed || !this.assets.length) return;
    for (const p of tiles) {
      const asset = this.nextPoolAsset();
      // A live/pending video would now stream the wrong tile — demote it (the
      // row is parked/invisible, so this is silent).
      if (this.scheduler) this.scheduler.notifyContentChange(p);
      this.loadThumb(p, asset);
    }
  }

  /** Swap a tile's still (texA) to a new asset. Instant — the tile is parked.
   *  Ownership is single-sourced through panel.heldThumbId (the id actually bound
   *  to texA), NOT a per-call prevId snapshot of panel.asset — panel.asset
   *  advances at load START, so under overlapping recycles a prevId snapshot
   *  would leak the truly-displayed texture and double-release the intermediate
   *  one. Each loadThumbnail(+1) is balanced by exactly one release: the winning
   *  load releases the previously-held id (and becomes the new held ref), a
   *  superseded/failed load releases its own id. */
  loadThumb(panel, asset) {
    const id = asset.playbackId;
    const token = (panel.scrollToken = (panel.scrollToken || 0) + 1);
    panel.asset = asset; // logical current asset (centerDir/scheduler); texA follows on resolve
    this.textureManager
      .loadThumbnail(id)
      .then((tex) => {
        if (this.disposed || panel.scrollToken !== token) {
          this.textureManager.release(id); // superseded or torn down — release THIS load's ref
          return;
        }
        const u = panel.mesh.material.uniforms;
        const { scale, offset } = computeCoverUv(1, panel.panelAspect);
        u.texA.value = tex;
        u.uvScaleA.value.set(scale[0], scale[1]);
        u.uvOffsetA.value.set(offset[0], offset[1]);
        u.uHasTexA.value = 1;
        // Release the texture this tile WAS displaying (already ref-bumped above,
        // so a same-id reload can never dip to 0), then take ownership.
        if (panel.heldThumbId) this.textureManager.release(panel.heldThumbId);
        panel.heldThumbId = id;
      })
      .catch(() => {
        this.textureManager.release(id); // failed load — release its own +1
      });
  }

  /** @param {number} dt - seconds since last frame (called every rendered frame) */
  update(dt) {
    if (this.disposed || this.rate <= 0) return;
    this.scroll += this.rate * dt;
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
