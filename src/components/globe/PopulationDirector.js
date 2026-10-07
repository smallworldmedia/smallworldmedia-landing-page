/**
 * PopulationDirector.js — decides which featured-project world every home
 * globe tile shows (docs/globe-worlds-plan.md). useGlobeScene builds it only
 * when ?popmode is on and the globe is the meridian scroll; absent, the globe
 * is exactly today's (MeridianScroll's pool cursor, the flat asset pool).
 *
 * A GROUPING is 1–3 worlds (buildWorldPools, /work World order) plus a
 * pattern (worldPatterns) over the scroll's tape: tile (lonIndex, tapeS)
 * belongs to region pattern.owner(lon, s) and takes the next asset from that
 * region's pool — never the asset already on a lon or row neighbour. The
 * initial layout paints the whole globe before the first cascade, so the very
 * first reveal is clustered worlds; after that MeridianScroll asks assignRow()
 * for every row it re-births at the top pole, so the grouping keeps pouring
 * in with the brand motion and a cluster travels pole-to-pole with its tiles.
 * One world (?popgroup=1, the default since Nathan's P1 read on 09-26: two
 * worlds sharing the globe weaken "we build whole worlds") is one region —
 * its media interleaved (?poplayout=mix) or split into regions by media kind
 * (facets).
 *
 * P2 — the world changes on its own. It holds ?pophold s (± ?popholdjit),
 * then the next one takes the globe through a transition from ?poptransset:
 *   tide   the scroll surges one full span over ?poptrans s on the house
 *          out-curve (power3.out: steep launch, smooth settle into the rest
 *          pace, no overshoot) — every row re-births once, so the new world
 *          pours in from the top pole while the old one drains out the
 *          bottom; no tile changes in place (the persistence doctrine)
 *   blink / surge   in place, staggered across ?poptrans (tileSwap)
 *   cut    at once
 * ?popchaos 0 walks the /work order and the transition set in turn; 1 draws a
 * random next world (never a recent one) and transition every change. The
 * next world is decided — and its textures warmed — as each hold begins, so a
 * change never waits on the network. The clock (update, from the scene's
 * tick) runs only while the screens are free to animate (canAnimate) and the
 * commit hasn't frozen the globe; under reduced motion the first world holds.
 * onWorld(world, { animate }) fires once the entrance has landed (greet) and
 * as each later world takes the globe — the scene tints the lattice and the
 * home chrome with its projectColor. ⏭ on the bench runs the next change now.
 * Enter World holds the clock (hold) so the world you dive into is the world
 * /work opens on.
 *
 * Tile assets are decorated once with their world (stats/focus) and the chip
 * copy HeroLabels reads (clientName, services).
 *
 * 10-06 — client-name strips (nameTicker): a run of adjacent tiles shows the
 * world's clientName in the FP card face (?popnames, ?popnamestyle). The
 * strip belongs to the world that owns its first tile, warms with the
 * grouping, and travels pole-to-pole with its row like any tile.
 *
 * 10-07 — their PLACEMENT (Nathan: too big, long names clipped, no ticker).
 * planNames() chooses the strips ONCE PER WORLD CHANGE against the live
 * scene, panel-keyed, because all three of his asks are about where a panel
 * is RIGHT NOW relative to the camera and none can be expressed over the
 * scroll tape (a row's latitude changes all the way down its pass):
 *   mid-latitude  |centerDir.y| inside ?popnameband of pole-to-pole
 *   front-facing  every tile's camera-rotated .z clears ?popnameface
 *   alternating   the strip's quadrant of that region walks NAME_QUADS
 *                 (lower-left, upper-right, upper-left, lower-right)
 * The span comes from the MEASURED name (nameSpan), so the whole name reads
 * at rest instead of being cut; ?popnamemode=band draws it across a whole
 * latitude row instead. The ticker is gone: placeNames() only reconciles each
 * tile's resting window, so at rest there are no per-frame uniform writes.
 * A row re-born at the pole is outside the band by construction, so names
 * refresh at a change, not at a birth — and a `tide` (which re-births every
 * row) therefore carries no strips at all.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { assetKey } from './TextureManager.js';
import { loadTile, applyPlan, cancelSwap } from './tileSwap.js';
import { selectPool, WORLD_KINDS } from './buildWorldPools.js';
import { makePattern } from './worldPatterns.js';
import { hashSeed, mulberry32 } from '../work/world/seededLayout.js';
import { TUNING, POP_DEFAULTS, MEDIA_KINDS } from './popConfig.js';
import { nameAsset, nameSpan, nameBandLimit, nameFaceLimit, NAME_QUADS } from './nameTicker.js';

const RELAYOUT_SPREAD = 0.6; // s — bench relayout stagger window
const RELAYOUT_DUR = 0.45; // s — one tile's blink
const GRID = 64; // tape grid key stride (lon < GRID)
const FACING = 0.05; // prominence floor for "visible" in the stats
const RECENT = 4; // chaos never jumps back to one of the last RECENT worlds
const TIDE_EASE = gsap.parseEase('power3.out');

export default class PopulationDirector {
  /**
   * @param {Object} opts
   * @param {Array} opts.panels - scroll-globe panels (lonIndex, row, tapeS stamped at build)
   * @param {Array} opts.worlds - buildWorldPools output
   * @param {TextureManager} opts.textureManager
   * @param {() => (LivePanelScheduler|null)} opts.getScheduler
   * @param {() => (MeridianScroll|null)} [opts.getScroller] - the tide's travel
   * @param {() => THREE.Euler} opts.getRotation - the globe's live rotation
   * @param {() => boolean} opts.canAnimate - false → swaps land as cuts, the clock waits
   * @param {(world: Object|null, info: { animate: boolean }) => void} [opts.onWorld]
   */
  constructor({ panels, worlds, textureManager, getScheduler, getScroller = () => null, getRotation, canAnimate, onWorld = null }) {
    this.panels = panels;
    this.worlds = worlds;
    this.textureManager = textureManager;
    this.getScheduler = getScheduler;
    this.getScroller = getScroller;
    this.getRotation = getRotation;
    this.canAnimate = canAnimate;
    this.onWorld = onWorld;
    this.disposed = false;
    this.frozen = false;
    this.held = false; // Enter World: no new change starts (one in flight lands)
    this.busy = false;
    this.busyCall = null;
    this.layoutToken = 0;
    this.changing = null; // the timed change in flight (tide | blink | surge | cut)
    this.tide = null; // { t, T, D, done, scroller } while a tide rolls
    this.greeted = false; // the first world announced (after the entrance)
    this.flips = 0; // tiles re-laid in place (monotonic; births aren't flips)
    this.flipsSampled = 0;
    this.countFlip = () => (this.flips += 1);
    this.names = new Map(); // nameKey → its name-strip asset (one texture per key)
    this.namePlan = new Map(); // panel → its strip, for the layout in flight (planNames)
    this.namePlaced = null; // that placement's own measurements (bench + probe)
    this.warm = new Map(); // texture key → its load promise; one director ref per key
    this.upcoming = null; // the next grouping, pre-warmed
    this.upcomingKind = null; // …and the transition that will bring it
    this.lon = 1 + Math.max(...panels.map((p) => p.lonIndex));
    const byRow = new Map();
    for (const p of panels) {
      if (!byRow.has(p.row)) byRow.set(p.row, []);
      byRow.get(p.row).push(p);
    }
    this.rows = [...byRow.values()];
    // Derived, never assumed: 12 lon × 6 visible rows happens to make it 1.
    this.panelAspect = panels[0]?.panelAspect || 1;
    this.pools = worlds.map((w, wi) =>
      w.assets.map((a) => ({ ...a, clientName: w.clientName, services: w.services, world: wi }))
    );
    this._v = new THREE.Vector3();
    this._n = new THREE.Vector3(); // planNames' own scratch (byProminence owns _v)
    this.assignRow = this.assignRow.bind(this);
    this.reseed();
    this.grouping = this.makeGrouping();
    this.beginHold();
  }

  /** Seed-derived start: which world leads first; the change history resets. */
  reseed() {
    this.seed = TUNING.seed;
    this.lead = Math.floor(mulberry32(hashSeed(`${this.seed}:start`))() * this.worlds.length);
    this.history = [];
    this.step = 0;
  }

  makeGrouping({ pattern = null, step = this.step, lead = this.lead } = {}) {
    const n = this.worlds.length;
    const size = Math.min(TUNING.group, n);
    const members = Array.from({ length: size }, (_, i) => (lead + i) % n);
    const seed = hashSeed(`${this.seed}:${step}`);
    const set = TUNING.patterns.length ? TUNING.patterns : POP_DEFAULTS.patterns;
    const name =
      size === 1
        ? TUNING.layout // one world: mix | facets
        : pattern || set[Math.floor(mulberry32(seed ^ 0x9e3779b9)() * set.length)];
    const kinds = MEDIA_KINDS[TUNING.media] ?? null;
    let pools = members.map((w) => selectPool(this.pools[w], { kinds, cap: TUNING.cap }));
    let regionWorld = members;
    if (size === 1 && name === 'facets') {
      // One world read as a system: its media kinds become the regions.
      const byKind = WORLD_KINDS.map((k) => pools[0].filter((a) => a.kind === k)).filter((l) => l.length);
      if (byKind.length > 1) {
        pools = byKind;
        regionWorld = byKind.map(() => members[0]);
      }
    }
    const weights = TUNING.share === 'weighted' ? pools.map((l) => l.length) : pools.map(() => 1);
    // The name quadrant walks NAME_QUADS by step, from a seeded start — so
    // consecutive worlds land far apart (Nathan: lower-left, then upper-right)
    // and a pinned ?popseed still replays the same globe.
    const quadFrom = Math.floor(mulberry32(hashSeed(`${this.seed}:namequad`))() * NAME_QUADS.length);
    return {
      members,
      regionWorld,
      pools,
      name,
      seed,
      nameQuad: NAME_QUADS[(((step + quadFrom) % NAME_QUADS.length) + NAME_QUADS.length) % NAME_QUADS.length],
      pattern: makePattern(name, { seed, weights, lon: this.lon }),
      cursor: pools.map(() => 0),
    };
  }

  /* — Assignment. grid: Map (s·GRID + lon) → texture key of the tiles
     already decided, for the neighbour rule. The region's cursor walks its
     pool in editorial order, skipping any asset already on a lon or row
     neighbour (a pool of 1–2 can't always comply — it repeats). — */
  pick(panel, grid) {
    const g = this.grouping;
    const L = this.lon;
    const lon = panel.lonIndex;
    const s = panel.tapeS;
    // A strip this layout's planNames already placed on this panel. Consumed,
    // so a row re-born later (at the pole) can never inherit it.
    const strip = this.namePlan.get(panel);
    if (strip) {
      this.namePlan.delete(panel);
      return strip;
    }
    const r = g.pattern.owner(lon, s);
    const pool = g.pools[r];
    const near = [
      grid.get(s * GRID + ((lon + L - 1) % L)),
      grid.get(s * GRID + ((lon + 1) % L)),
      grid.get((s - 1) * GRID + lon),
      grid.get((s + 1) * GRID + lon),
    ];
    let c = g.cursor[r];
    let asset = pool[c % pool.length];
    for (let t = 0; t < pool.length; t++) {
      const a = pool[(c + t) % pool.length];
      if (!near.includes(assetKey(a))) {
        asset = a;
        c += t;
        break;
      }
    }
    g.cursor[r] = (c + 1) % pool.length;
    grid.set(s * GRID + lon, assetKey(asset));
    return asset;
  }

  /** How a world's strip is drawn — pure in (its name, the dials, the tile
   *  aspect), so warmSet and planNames always agree on the texture. The span
   *  is the tile count the MEASURED name needs to read at rest. */
  nameLayout(w) {
    if (TUNING.nameMode === 'band') return { mode: 'band', span: this.lon, panelAspect: this.panelAspect };
    const span = nameSpan(this.worlds[w]?.clientName, TUNING.nameSize, this.panelAspect, {
      min: TUNING.nameSpanMin,
      max: Math.min(TUNING.nameSpanMax, this.lon),
    });
    return { mode: 'region', span, panelAspect: this.panelAspect };
  }

  /** A world's strip asset (one per nameKey — one texture, refcounted per
   *  tile). Null for a world without a clientName. */
  nameFor(w) {
    const world = this.worlds[w];
    if (!world?.clientName) return null;
    const asset = nameAsset(world, w, {
      style: TUNING.nameStyle,
      size: TUNING.nameSize,
      ...this.nameLayout(w),
    });
    if (!this.names.has(asset.nameKey)) this.names.set(asset.nameKey, asset);
    return this.names.get(asset.nameKey);
  }

  /** Where this world's name goes, decided once against the LIVE scene (see
   *  the header): a Map panel → its strip tile ({ ...asset, k }), plus the
   *  placement's own measurements on this.namePlaced.
   *
   *  region  every candidate is a run of `span` adjacent tiles of one
   *          band row; it must be wholly front-facing, and its quadrant OF
   *          THE FRONT-FACING REGION (split at that region's own mid-point,
   *          not the screen's — the brand tilt pushes the whole region below
   *          centre) must be the grouping's. The most frontal candidate wins.
   *          Band + facing + quadrant leaves a small admissible set, so the
   *          gates relax in order: quadrant first, then facing — never the
   *          latitude band, and the relaxation is reported.
   *  band    `names` whole latitude rows inside the band, the row walking
   *          with the step so the band moves between worlds. */
  planNames() {
    this.namePlaced = null;
    const plan = new Map();
    const count = TUNING.names;
    if (!count) return plan;
    const g = this.grouping;
    const L = this.lon;
    const rot = this.getRotation();
    const yLimit = nameBandLimit(TUNING.nameBand);
    const zLimit = nameFaceLimit(TUNING.nameFace);
    const band = TUNING.nameMode === 'band';
    // Rows whose latitude is inside the band. One row = one latitude, and
    // centerDir is unrotated, so row[0] speaks for all 12 tiles.
    const rows = this.rows.filter((r) => r.length && Math.abs(r[0].centerDir.y) <= yLimit);
    if (!rows.length) return plan;
    const v = this._n;
    const rotated = (p) => v.copy(p.centerDir).applyEuler(rot);
    const draw = mulberry32(hashSeed(`${this.seed}:namerow`))();
    let relaxed = null;
    let quad = null;
    let span = 0;

    if (band) {
      const from = Math.floor(draw * rows.length) + this.step;
      for (let i = 0; i < Math.min(count, rows.length); i++) {
        const row = rows[(((from + i) % rows.length) + rows.length) % rows.length];
        const at = new Map(row.map((p) => [p.lonIndex, p]));
        const s = row[0].tapeS;
        const base = this.nameFor(g.regionWorld[g.pattern.owner(0, s)]);
        if (!base) continue;
        span = L;
        for (let k = 0; k < L; k++) {
          const p = at.get(k);
          if (p) plan.set(p, { ...base, k });
        }
      }
    } else {
      const cands = [];
      for (const row of rows) {
        const at = new Map(row.map((p) => [p.lonIndex, p]));
        const s = row[0].tapeS;
        for (let st = 0; st < L; st++) {
          const base = this.nameFor(g.regionWorld[g.pattern.owner(st, s)]);
          if (!base) continue;
          const span = Math.min(base.span, L);
          const tiles = [];
          for (let k = 0; k < span; k++) tiles.push(at.get((st + k) % L));
          if (tiles.some((p) => !p)) continue;
          let minZ = Infinity;
          let cx = 0;
          let cy = 0;
          for (const p of tiles) {
            const d = rotated(p);
            minZ = Math.min(minZ, d.z);
            cx += d.x / span;
            cy += d.y / span;
          }
          cands.push({ row, tiles, base, minZ, cx, cy });
        }
      }
      let pool = cands.filter((c) => c.minZ >= zLimit);
      if (!pool.length) {
        pool = cands;
        relaxed = 'facing';
      }
      // The quadrants partition the ADMISSIBLE region, split at its own
      // mid-point, so all four stay reachable under the brand tilt.
      const mid = (f) => {
        const xs = pool.map(f);
        return (Math.min(...xs) + Math.max(...xs)) / 2;
      };
      const xm = mid((c) => c.cx);
      const ym = mid((c) => c.cy);
      const quadOf = (c) => (c.cy >= ym ? 'U' : 'L') + (c.cx >= xm ? 'R' : 'L');
      let want = pool.filter((c) => quadOf(c) === g.nameQuad);
      if (!want.length) {
        want = pool;
        relaxed = relaxed || 'quadrant';
      }
      want.sort((a, b) => b.minZ - a.minZ); // the most frontal run wins
      const usedRows = new Set();
      for (const c of want) {
        if (usedRows.size >= count) break;
        if (usedRows.has(c.row)) continue;
        usedRows.add(c.row);
        if (quad == null) quad = quadOf(c);
        span = Math.max(span, c.tiles.length);
        c.tiles.forEach((p, k) => plan.set(p, { ...c.base, k }));
      }
    }

    let yMax = 0;
    let zMin = Infinity;
    for (const p of plan.keys()) {
      yMax = Math.max(yMax, Math.abs(p.centerDir.y));
      zMin = Math.min(zMin, rotated(p).z);
    }
    this.namePlaced = {
      step: this.step,
      mode: band ? 'band' : 'region',
      span,
      tiles: plan.size,
      want: band ? null : g.nameQuad,
      quad,
      relaxed,
      yLimit: Math.round(yLimit * 1e4) / 1e4,
      yMax: plan.size ? Math.round(yMax * 1e4) / 1e4 : null,
      zLimit: Math.round(zLimit * 1e4) / 1e4,
      zMin: plan.size ? Math.round(zMin * 1e4) / 1e4 : null,
    };
    return plan;
  }

  /** A grouping's textures: its pools + its worlds' name strips. */
  warmSet(g) {
    if (!TUNING.names) return g.pools;
    const strips = [...new Set(g.regionWorld)].map((w) => this.nameFor(w)).filter(Boolean);
    return [...g.pools, strips];
  }

  /** Each strip tile's RESTING window: tile k shows the k-th slice of the
   *  strip (k · the slice width), so the name reads across the lattice gaps
   *  as one — still. tileSwap's cover-fit centres a texture on its tile, and
   *  nothing else writes uvOffsetA, so the director reconciles it here. A
   *  loop rather than a bind hook because loadTile fires from three places
   *  (a row's re-birth, applyPlan, initialLayout) and layIn's kept-texture
   *  strip takes a new window with no load at all. Writes only on a change,
   *  so at rest this costs nothing (the ticker's per-frame writes are gone). */
  placeNames() {
    for (const p of this.panels) {
      const a = p.shownAsset;
      if (a?.kind !== 'name') continue;
      const u = p.mesh.material.uniforms;
      const x = a.k * u.uvScaleA.value.x;
      const want = x - Math.floor(x); // band: the window wraps the repeat
      if (Math.abs(u.uvOffsetA.value.x - want) > 1e-6) u.uvOffsetA.value.x = want;
    }
  }

  /** MeridianScroll's hook: assets for a re-born row (lon order, tapeS set). */
  assignRow(tiles) {
    if (this.disposed) return null;
    const s = tiles[0].tapeS;
    const grid = new Map();
    for (const row of this.rows) {
      const rs = row[0].tapeS;
      if (rs !== s - 1 && rs !== s + 1) continue;
      for (const p of row) grid.set(rs * GRID + p.lonIndex, assetKey(p.swapAsset || p.asset));
    }
    return tiles.map((p) => this.pick(p, grid));
  }

  /** A fresh board, tiles decided in `order` (most prominent first, so each
   *  world's lead assets land where the eye is). */
  planAll(order) {
    this.namePlan = this.planNames();
    const grid = new Map();
    const plan = new Map();
    for (const p of order) plan.set(p, this.pick(p, grid));
    this.namePlan = new Map(); // a strip is only ever placed by the plan that chose it
    return plan;
  }

  byProminence() {
    const rot = this.getRotation();
    return this.panels
      .map((p) => [p, this._v.copy(p.centerDir).applyEuler(rot).z])
      .sort((a, b) => b[1] - a[1])
      .map(([p]) => p);
  }

  /** Build time: lay the first grouping (no animation — the entrance cascade
   *  reveals it). Returns the tile loads the cascade waits on. */
  initialLayout(order) {
    const plan = this.planAll(order);
    this.warmGrouping();
    return [...plan].map(([p, a]) => loadTile(this, p, a));
  }

  /** Hold a ref on every asset of the current grouping, and plan + warm the
   *  next one. Resolves once the CURRENT grouping's textures have settled —
   *  including keys an earlier prefetch is still loading. */
  warmGrouping() {
    const now = this.warmPools(this.warmSet(this.grouping));
    this.planNext();
    return now;
  }

  warmPools(pools) {
    const loads = [];
    for (const pool of pools) {
      for (const a of pool) {
        const k = assetKey(a);
        if (!this.warm.has(k)) this.warm.set(k, this.textureManager.loadAsset(a));
        loads.push(this.warm.get(k));
      }
    }
    return Promise.allSettled(loads);
  }

  /** Drop the warm refs neither the current nor the next grouping needs. */
  releaseCold() {
    const keep = new Set(
      [...this.warmSet(this.grouping), ...(this.upcoming ? this.warmSet(this.upcoming) : [])].flat().map(assetKey)
    );
    for (const k of this.warm.keys()) {
      if (keep.has(k)) continue;
      this.warm.delete(k);
      this.textureManager.release(k);
    }
  }

  /* — The change clock. Every draw is seeded (seed : step : what), so a
     pinned ?popseed replays the same sequence of worlds, holds and
     transitions. — */

  /** The world after the current one: the /work order (A+B → B+C for 2–3
   *  worlds), or — with probability ?popchaos — any world not shown lately. */
  nextLead(step) {
    const n = this.worlds.length;
    if (n < 2) return this.lead;
    const rand = mulberry32(hashSeed(`${this.seed}:${step}:next`));
    if (rand() >= TUNING.chaos) return (this.lead + 1) % n;
    const recent = new Set([this.lead, ...this.history.slice(0, Math.min(RECENT, n - 2))]);
    const open = this.worlds.map((_, i) => i).filter((i) => !recent.has(i));
    return open[Math.floor(rand() * open.length)];
  }

  /** The transition that brings step's world: the set in turn, or — with
   *  probability ?popchaos — any of it. */
  nextKind(step) {
    const set = TUNING.transitions.length ? TUNING.transitions : POP_DEFAULTS.transitions;
    const rand = mulberry32(hashSeed(`${this.seed}:${step}:kind`));
    return rand() < TUNING.chaos ? set[Math.floor(rand() * set.length)] : set[step % set.length];
  }

  planNext() {
    const step = this.step + 1;
    this.upcoming = this.makeGrouping({ step, lead: this.nextLead(step) });
    this.upcomingKind = this.nextKind(step);
    this.warmPools(this.warmSet(this.upcoming));
  }

  beginHold() {
    const r = mulberry32(hashSeed(`${this.seed}:${this.step}:hold`))();
    this.holdLeft = TUNING.hold * (1 + TUNING.holdJit * (2 * r - 1));
  }

  /** Per rendered frame, from the scene's tick (before the scroll update, so
   *  a tide's travel lands the same frame). */
  update(dt) {
    if (this.disposed) return;
    this.placeNames();
    if (this.frozen || !this.canAnimate()) return;
    if (!this.greeted) this.greet(true);
    if (this.tide) {
      this.rollTide(dt);
      return;
    }
    if (this.held || this.busy || this.worlds.length < 2) return;
    this.holdLeft -= dt;
    if (this.holdLeft <= 0) this.advance();
  }

  /** The first world takes its colour — after the entrance has landed (the
   *  intro is the brand's own blue), or at once (reduced motion). */
  greet(animate) {
    if (this.greeted || this.disposed) return;
    this.greeted = true;
    this.emitWorld(animate);
  }

  emitWorld(animate) {
    if (!this.greeted || !this.onWorld) return;
    this.onWorld(this.worlds[this.lead] ?? null, { animate });
  }

  /** The next world takes the globe (the hold ran out, or ⏭). */
  advance() {
    if (this.disposed || this.busy) return;
    const animate = !this.frozen && this.canAnimate();
    const kind = animate ? this.upcomingKind : 'cut';
    this.step += 1;
    this.history = [this.lead, ...this.history].slice(0, RECENT);
    this.grouping = this.upcoming ?? this.makeGrouping({ lead: this.nextLead(this.step) });
    this.lead = this.grouping.members[0];
    this.changing = kind;
    this.emitWorld(animate);
    if (kind === 'tide' && this.startTide()) return;
    // No scroll to surge (the scene is still held) → the tide lands as a blink.
    const dur = Math.min(Math.max(TUNING.trans * 0.3, 0.3), 0.9);
    this.layIn({ style: kind === 'tide' ? 'blink' : kind, spread: Math.max(TUNING.trans - dur, 0), dur });
  }

  startTide() {
    const scroller = this.getScroller();
    if (!scroller) return false;
    this.busy = true;
    this.tide = { t: 0, T: TUNING.trans, D: scroller.span, done: 0, scroller };
    return true;
  }

  rollTide(dt) {
    const td = this.tide;
    td.t = Math.min(td.t + dt, td.T);
    const to = TIDE_EASE(td.t / td.T) * td.D;
    td.scroller.advance(to - td.done);
    td.done = to;
    if (td.t >= td.T) {
      this.tide = null;
      this.settle();
    }
  }

  /** A change (or a bench relayout) has landed: the next world is planned and
   *  warmed, its hold starts, the textures nobody needs go cold. */
  settle() {
    this.busy = false;
    this.changing = null;
    this.planNext();
    this.beginHold();
    this.releaseCold();
  }

  /** Re-lay the whole globe onto the current grouping, in place: a staggered
   *  `style` swap per tile (a cut when the screens aren't free to animate). */
  layIn({ style = 'blink', spread = RELAYOUT_SPREAD, dur = RELAYOUT_DUR } = {}) {
    const plan = this.planAll(this.byProminence());
    const bornAt = new Map([...plan.keys()].map((p) => [p, p.tapeS]));
    const token = ++this.layoutToken;
    this.busy = true;
    this.warmGrouping().then(() => {
      if (this.disposed || token !== this.layoutToken) return;
      // A row re-born while the textures warmed already took the new
      // grouping from assignRow — its planned picks belong to its old place.
      for (const [p, s] of bornAt) if (p.tapeS !== s) plan.delete(p);
      // A strip tile already showing its world's strip keeps the texture
      // (applyPlan skips a same-key tile) — but takes its new window.
      for (const [p, a] of plan) {
        if (a.kind === 'name' && !p.swapAsset && assetKey(p.shownAsset) === assetKey(a)) {
          p.asset = a;
          p.shownAsset = a;
        }
      }
      const { span } = applyPlan(this, plan, {
        animate: !this.frozen && this.canAnimate(),
        style,
        spread,
        dur,
        onBound: this.countFlip,
      });
      if (this.busyCall) this.busyCall.kill();
      this.busyCall = gsap.delayedCall(span, () => this.settle());
    });
  }

  /** Re-lay the whole globe with a fresh grouping (bench actions). */
  relayout({ reseed = false, pattern = null } = {}) {
    if (this.disposed) return;
    this.tide = null; // a bench action takes over from a rolling tide
    this.changing = null;
    if (reseed) this.reseed();
    this.grouping = this.makeGrouping({ pattern });
    this.emitWorld(true); // a reseed can change the world — and a reset the colour knob
    this.layIn();
  }

  next() {
    if (!this.busy) this.advance();
  }

  show(pattern) {
    this.relayout({ pattern });
  }

  /** A popConfig change (useGlobeScene forwards the key). */
  onTune(key) {
    if (key === 'seed') this.relayout({ reseed: true });
    else if (key === 'patterns') {
      if (this.grouping.members.length > 1 && !TUNING.patterns.includes(this.grouping.name)) this.relayout();
      else if (!this.busy) this.planNext();
    } else if (key === 'layout') {
      if (this.grouping.members.length === 1) this.relayout();
      else if (!this.busy) this.planNext();
    } else if (key === 'hold' || key === 'holdJit') {
      if (!this.busy) this.beginHold(); // a new hold starts now, on the new dial
    } else if (key === 'transitions' || key === 'chaos') {
      if (!this.busy) this.planNext(); // re-draw the next world + transition
    } else if (key === 'color') this.emitWorld(true);
    else if (key === 'trans' || key === 'live' || key === 'enter') {
      // read at the next change / the scene swaps the live tier / Hero reads it at Enter World
    } else this.relayout(); // media, cap, share, group, the name knobs, reset
  }

  /** The commit engaged its blue fill: land every in-flight swap now and
   *  hold still (later relayouts cut under the blue) until unfreeze. A tide
   *  stops where it is; the stragglers scroll out at the rest pace. */
  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    for (const p of this.panels) cancelSwap(p, this, { complete: true });
    if (this.tide) {
      this.tide = null;
      this.settle();
    }
  }

  unfreeze() {
    this.frozen = false;
  }

  /** Enter World (the CTA's dive): the clock stops, so no new world starts
   *  under the passage — the one you clicked is the one /work opens on. Unlike
   *  freeze, a change already rolling lands on its own curve. Never released:
   *  the navigation follows and the scene unmounts with the page. */
  hold() {
    this.held = true;
  }

  dropLive(panel) {
    this.getScheduler()?.dropLive(panel);
  }

  /** The world the viewer is looking at: the largest visible share, else the
   *  grouping lead. → its /work slug. */
  focusProject() {
    const w = this.focusWorld ?? this.grouping.members[0];
    return this.worlds[w]?.slug ?? null;
  }

  /** ~2 Hz from the scene's stat clock: visible shares, integrity (visible
   *  tiles showing a world of the current grouping), black tiles, live
   *  videos per world, the change clock — published as window.__swmPopStats
   *  (bench + probe). */
  sample(rotation, { fps = null, gpuTextures = null, dt = 0.5 } = {}) {
    const g = this.grouping;
    const shares = new Map();
    const live = new Map();
    let visible = 0;
    let black = 0;
    let inGroup = 0;
    let liveTiles = 0;
    let nameTiles = 0;
    let nameMaxY = 0;
    const nameUv = {}; // strip slice k → its resting uvOffsetA.x (the probe's stillness gate)
    for (const p of this.panels) {
      if (p.liveState === 'live') liveTiles += 1;
      if (p.parked) continue;
      if (this._v.copy(p.centerDir).applyEuler(rotation).z <= FACING) continue;
      visible += 1;
      if (!p.mesh.material.uniforms.uHasTexA.value) black += 1;
      if (p.shownAsset?.kind === 'name') {
        nameTiles += 1;
        nameMaxY = Math.max(nameMaxY, Math.abs(p.centerDir.y));
        nameUv[p.shownAsset.k] = Math.round(p.mesh.material.uniforms.uvOffsetA.value.x * 1e6) / 1e6;
      }
      const w = p.shownAsset?.world; // what texA shows, not the load in flight
      if (w == null) continue;
      shares.set(w, (shares.get(w) || 0) + 1);
      if (g.members.includes(w)) inGroup += 1;
      if (p.liveState === 'live') live.set(w, (live.get(w) || 0) + 1);
    }
    let best = null;
    for (const [w, c] of shares) if (best == null || c > shares.get(best)) best = w;
    this.focusWorld = best;
    const label = (w) => {
      const x = this.worlds[w];
      return x.title ? `${x.clientName} · ${x.title}` : x.clientName;
    };
    const stats = {
      mode: TUNING.mode,
      phase: this.frozen ? 'frozen' : this.changing ? 'transition' : this.busy ? 'relayout' : 'hold',
      grouping: g.members.map(label),
      world: label(this.lead),
      slug: this.worlds[this.lead]?.slug ?? null, // what Enter World hands /work
      held: this.held,
      next: this.upcoming ? label(this.upcoming.members[0]) : null,
      transition: this.changing ?? this.upcomingKind,
      holdLeft: this.busy ? null : Math.max(0, Math.round(this.holdLeft * 10) / 10),
      color: TUNING.color ? (this.worlds[this.lead]?.projectColor ?? null) : null,
      pattern: g.name,
      seed: this.seed,
      step: this.step,
      focus: this.focusProject(),
      integrity: visible ? inGroup / visible : 1,
      visible,
      black,
      flips: this.flips,
      flipsPerSec: (this.flips - this.flipsSampled) / dt,
      warm: this.warm.size,
      textures: this.textureManager.cache.size,
      gpuTextures,
      streams: this.getScheduler()?.getStats().live ?? 0, // decodes
      liveTiles,
      nameTiles, // visible tiles showing a name strip
      nameStrips: TUNING.names, // strips a world places (0 = names off)
      nameMode: TUNING.nameMode,
      // Where this world's strips were PLACED, measured off the live scene at
      // the moment of the change (the probe's band / facing / quadrant gates).
      namePlaced: this.namePlaced,
      // Live, as the strips travel: a placed strip drifts out of the band with
      // its row, so this is a diagnostic, not a gate.
      nameMaxY: nameTiles ? Math.round(nameMaxY * 1e4) / 1e4 : null,
      nameUv,
      live: [...live].map(([w, c]) => `${this.worlds[w].clientName} ${c}`),
      fps,
    };
    this.flipsSampled = this.flips;
    if (typeof window !== 'undefined') window.__swmPopStats = stats;
    return stats;
  }

  dispose() {
    this.disposed = true;
    this.tide = null;
    if (this.busyCall) this.busyCall.kill();
    for (const p of this.panels) cancelSwap(p);
    for (const k of this.warm.keys()) this.textureManager.release(k);
    this.warm.clear();
    if (typeof window !== 'undefined') delete window.__swmPopStats;
  }
}
