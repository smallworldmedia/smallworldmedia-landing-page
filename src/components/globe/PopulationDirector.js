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
 * tile's resting window onto its own slice of the strip — against
 * panelMaterial's pole pinch, which centre-crops the sampling and is what
 * rendered TOBEHONEST as "TOHOST" (nameTicker.nameWindow).
 * A row re-born at the pole is outside the band by construction, so names
 * refresh at a change, not at a birth — and a `tide` (which re-births every
 * row) therefore carries no strips at all.
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { assetKey } from './TextureManager.js';
import { loadTile, applyPlan, cancelSwap, sharedDelays } from './tileSwap.js';
import { selectPool, WORLD_KINDS } from './buildWorldPools.js';
import { makePattern } from './worldPatterns.js';
import { hashSeed, mulberry32 } from '../work/world/seededLayout.js';
import { TUNING, POP_DEFAULTS, MEDIA_KINDS } from './popConfig.js';
import { SCROLL_VISIBLE_ROWS, GLOBE_T1 } from './globeConfig.js';
import { lattice, texSpec, unitAspect, thetaBound, eligibleH, eligibleVQ, unitA, unitSkewBound, rendered, electQuads, quadEligible, coverWindow, frac, UNIT_EPS, UNIT_SHAPE, UNIT_CLASSES, T_ENTRANCE, liveB, pictureAspect } from './unitSpan.js';
import {
  nameAsset,
  nameSpan,
  nameBandLimit,
  nameFaceLimit,
  namePinch,
  nameWindow,
  nameRendered,
  NAME_QUADS,
} from './nameTicker.js';

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
  constructor({ panels, worlds, textureManager, getScheduler, getScroller = () => null, getRotation, canAnimate, onWorld = null, getPace = () => 0, getHorizon = () => Math.PI, revealHeld = false }) {
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
    this.staleLanded = 0; // swaps that landed on a re-born row (tileSwap.swapNow; gated to 0)
    this._render = { ms: new Float32Array(240), up: new Uint8Array(240), i: 0, n: 0 }; // last 240 frames
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
    // The span lattice, read off a live scroll panel. Null on the fixed globe, so units never run there.
    this.L = panels[0]?.bandHeight > 0 ? lattice(panels[0], this.lon, SCROLL_VISIBLE_ROWS) : null;
    this.getPace = getPace; // °/s the rows travel right now (0 = still: reduced motion)
    this.getHorizon = getHorizon; // rad: the live horizon colatitude θh (camera in the globe frame)
    this.revealHeld = revealHeld; // the entrance waits on a held reveal (--intro=full)
    // The ε window (unitSpan.thetaBound): V/Q leads live inside [θN, θS] for their whole planned life.
    this.W = this.L
      ? { thetaN: thetaBound((1 + UNIT_EPS) ** -2, this.L.Pth), thetaS: thetaBound((1 + UNIT_EPS) ** 2, this.L.Pth), thetaH: null, Pth: this.L.Pth }
      : null;
    this.placed = { h: 0, v: 0, q: 0 }; // units placed, cumulative (births included)
    this.bornH = 0; // H pairs formed inside a born row
    this.initVQ = 0; // V/Q units in the initial layout (0 by construction: its plan has no horizon, M4)
    this.initThetaH = null; // the horizon the initial layout's plan saw: null while useGlobeScene's `posed` latch holds (M4)
    this.lastD = null; // the travel budget the last plan used (rad)
    this.unitSnaps = 0; this.skewBad = 0; this.skewChecks = 0;
    this.skewMax = this.L ? unitSkewBound(this.L) : 0; // the per-frame skew bound, derived from UNIT_EPS and the lattice (m7)
    this.decorSig = null;
    this.pools = this.decorate();
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

  /** The pool a world places from: ?popmedia's kinds and ?popcap, and under
   *  units the ?popequiv budget. makeGrouping places from it, and decorate() elects quads
   *  over it, so a candidate the selection leaves out is never elected. */
  selectFor(list) {
    // ?popequiv (units on): a tile-equivalent budget per world. An asset weighs the
    // class it COULD form (pair 2, quad-eligible 4, else 1), never its election,
    // because the election reads this selection; an eligible 'q' left un-elected
    // still counts 4, so the budget is never exceeded.
    const budget = TUNING.units && this.L && TUNING.equiv > 0 ? TUNING.equiv : null;
    const weigh = (a) => (a.u === 'h' || a.u === 'v' ? 2 : quadEligible(a, GLOBE_T1, this.L) ? 4 : 1);
    return selectPool(list, { kinds: MEDIA_KINDS[TUNING.media] ?? null, cap: TUNING.cap, budget, weigh });
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
    let pools = members.map((w) => this.selectFor(this.pools[w]));
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

  /** The pool records. Units off: exactly the old spread. Units on: each 'h'/'v'
   *  asset, and each 'q' candidate a world elected, also gets its ONE class
   *  texture (tex, pooled by id) and the unit class it may form (unitCls: a
   *  quad only in the world that elected it). */
  decorate() {
    const on = !!(TUNING.units && this.L);
    this.decorSig = this.sigOf();
    // Each world elects its first ?popquads 'q' candidates (editorial order) in the pool it PLACES from
    // (selectFor) whose real source short side ≥ 0.9 × the quad texture side. Keyed by world (m9).
    const elected = new Set();
    if (on && TUNING.quads > 0) this.worlds.forEach((w, wi) => {
      for (const id of electQuads(this.selectFor(w.assets), TUNING.quads, GLOBE_T1, this.L)) elected.add(`${wi}|${id}`);
    });
    const qIds = new Set([...elected].map((k) => k.slice(k.indexOf('|') + 1)));
    const clsById = new Map(); // the texture variant, pooled by id
    if (on) for (const w of this.worlds) for (const a of w.assets) {
      const id = a.playbackId || a.imageUrl;
      const c = a.u === 'h' || a.u === 'v' ? a.u : a.u === 'q' && qIds.has(id) ? 'q' : null;
      if (c && !clsById.has(id)) clsById.set(id, c);
    }
    return this.worlds.map((w, wi) =>
      w.assets.map((a) => {
        const r = { ...a, clientName: w.clientName, services: w.services, world: wi };
        const id = a.playbackId || a.imageUrl;
        const c = on ? clsById.get(id) : null;
        if (c) {
          r.tex = texSpec(a, c, GLOBE_T1, this.L);
          if (c !== 'q' || elected.has(`${wi}|${id}`)) r.unitCls = c; // a quad only where this world elected it
        }
        return r;
      })
    );
  }

  sigOf() {
    // Constant with units off, so a knob never rebuilds today's records. The selection knobs are in it because
    // the quad election reads the selection (decorate → selectFor); ?popequiv's budget selects too, and T1 sizes both.
    return TUNING.units && this.L ? `1|${TUNING.quads}|${TUNING.cap}|${TUNING.media}|${TUNING.equiv}|${GLOBE_T1}` : '0';
  }

  /** A knob that changes the records (units, quads, cap, media, equiv) rebuilds them; the relayout that follows re-warms. */
  redecorate() {
    if (this.sigOf() !== this.decorSig) this.pools = this.decorate();
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
    // A parked row is collapsed at/beyond a pole with centerDir clamped to
    // |y| = 1, which slips through at ?popnameband=1 (yLimit = 1).
    const rows = this.rows.filter(
      (r) => r.length && !r[0].parked && Math.abs(r[0].centerDir.y) <= yLimit
    );
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

  /** Each strip tile's RESTING window: tile k RENDERS the k-th slice of the
   *  strip, so the name reads across the lattice gaps as one — still.
   *  nameWindow owns the arithmetic (and why it is not just k · the slice
   *  width: panelMaterial's pole pinch centre-crops the sampling, which is
   *  what rendered TOBEHONEST as "TOHOST"). tileSwap's cover-fit centres a
   *  texture on its tile and nothing else writes uvScaleA/uvOffsetA, so the
   *  director reconciles them here. A loop rather than a bind hook because
   *  loadTile fires from three places (a row's re-birth, applyPlan,
   *  initialLayout) and layIn's kept-texture strip takes a new window with no
   *  load at all.
   *
   *  The pinch moves as the row scrolls pole-ward, so the window is
   *  recomputed every frame — but this loop already ran every frame, the
   *  writes land only on the ≤ span tiles that carry a strip, and the scroll
   *  driver writes uPolarTop for all 96 panels in the same frame anyway. The
   *  alternative (recompute at the change and let it drift) loses register at
   *  the seams: 12° of travel inside one hold is a 10% sampling error, a
   *  glyph sliver repeated across every gap. The RENDERED slice stays exactly
   *  `slice` wide and centred on (k+½)·slice at every latitude — that
   *  invariant, not a frozen uniform, is what the probe's namesSlice /
   *  namesStill gates assert. update() runs before the scroll applies, so the
   *  pinch used here is one frame stale: ~0.0006 of vK, a sub-0.1% window
   *  error the gates' tolerances carry. */
  placeNames() {
    for (const p of this.panels) {
      const a = p.shownAsset;
      if (a?.kind !== 'name') continue;
      const u = p.mesh.material.uniforms;
      const w = nameWindow(a.k, this.nameSliceOf(p), namePinch(p.centerDir.y), { band: a.mode === 'band' });
      if (Math.abs(u.uvScaleA.value.x - w.scaleX) > 1e-6) u.uvScaleA.value.x = w.scaleX;
      if (Math.abs(u.uvOffsetA.value.x - w.offsetX) > 1e-6) u.uvOffsetA.value.x = w.offsetX;
    }
  }

  /** One tile's natural share of the strip it shows = cover-fit's own x scale
   *  (TextureManager.computeCoverUv) for the strip's real aspect. Read off the
   *  bound texture, so a region strip (padded to exactly `span` tiles → 1/span)
   *  and a band strip (the natural name + gap, repeating) take one rule. */
  nameSliceOf(panel) {
    const aspect = panel.mesh.material.uniforms.texA.value?.userData?.aspect || 1;
    return Math.min(1, panel.panelAspect / aspect);
  }

  /** Every member of P shows P (from what the tiles SHOW, not what they plan). */
  wholeUnit(P) {
    return P.members.every((m) => m.shownAsset?.place === P && !m.parked);
  }

  /** Per rendered frame, right after the scroll (useGlobeScene): every unparked
   *  unit member's texA window from its own live pose, through a 1e-9 dead-band
   *  (unitSeam is relative to a member's rendered width, which shrinks with vK).
   *  The name strips do the same (placeNames); persistence forbids changing the
   *  picture, not moving the window. A whole unit's lead also carries unitCentre
   *  for its chip, and a live or demoting member that joined as its unit gets its
   *  texB re-derived from this frame's A (P6a). A strict no-op with units off (T18). */
  place() {
    if (!TUNING.units || !this.L || globalThis.__swmNoUnitWindows === true) return;
    const W = this.W;
    for (const p of this.panels) {
      const m = p.shownAsset;
      const P = m?.place;
      if (!P || p.parked) continue;
      if (p._bound !== m) {
        this.unitSnaps += 1;
        continue;
      }
      const u = p.mesh.material.uniforms;
      const y = Math.min(Math.max(p.centerDir.y, -1), 1);
      const theta = Math.acos(y);
      const aTex = u.texA.value?.userData?.aspect ?? m.tex?.aspect ?? 1;
      const w = unitA(m, namePinch(y), theta, aTex);
      const off = Math.max(
        Math.abs(u.uvScaleA.value.x - w.s[0]),
        Math.abs(u.uvScaleA.value.y - w.s[1]),
        Math.abs(u.uvOffsetA.value.x - w.o[0]),
        Math.abs(u.uvOffsetA.value.y - w.o[1])
      );
      // Skew: last frame's window may differ from this one only by the pose
      // change. skewMax is the closed-form max |d window / dθ| (unitSpan.unitSkewBound:
      // H anywhere; V/Q with the lead inside [θN, θS], where it lives by construction)
      // times SKEW_MARGIN, so a retuned UNIT_EPS raises the bound along with the slope.
      const lead = Math.acos(Math.min(Math.max(P.members[0].centerDir.y, -1), 1));
      if (this.wholeUnit(P) && (P.rows === 1 || (lead >= W.thetaN && lead <= W.thetaS))) {
        this.skewChecks += 1;
        if (off > this.skewMax * Math.abs(theta - (p._skewTheta ?? theta)) + 1e-6) this.skewBad += 1;
      }
      if (off > 1e-9) {
        u.uvScaleA.value.set(w.s[0], w.s[1]);
        u.uvOffsetA.value.set(w.o[0], w.o[1]);
      }
      p._skewTheta = theta;
      // The lead carries the unit's centre for its chip (HeroLabels.dirOf), unless it is lit as
      // something else: a lead re-dealt to another clip may have joined that stream as a single.
      if (P.members[0] === p) {
        if (this.wholeUnit(P) && (!p.liveStream || p.liveUid === P.uid)) {
          p._uc ??= new THREE.Vector3();
          p._uc.set(0, 0, 0);
          for (const q of P.members) p._uc.add(q.centerDir);
          p.unitCentre = p._uc.normalize();
        } else p.unitCentre = null;
      }
      // texB rides texA per frame: the clip's picture (metadata ratio; decoded only as a fallback) through this frame's A (B = cover(V, aTex) ∘ A).
      // Only on a copy that joined as this unit: a tile still showing the record while its next clip loads may
      // have joined that clip's stream as a single (canJoin), and its B is attach's single cover.
      const video = p.liveStream?.video;
      if (video && p.liveUid === P.uid && (p.liveState === 'live' || p.liveState === 'demoting')) {
        const b = liveB(pictureAspect(m, video), aTex, w);
        if (
          Math.max(
            Math.abs(u.uvScaleB.value.x - b.s[0]),
            Math.abs(u.uvScaleB.value.y - b.s[1]),
            Math.abs(u.uvOffsetB.value.x - b.o[0]),
            Math.abs(u.uvOffsetB.value.y - b.o[1])
          ) > 1e-9
        ) {
          u.uvScaleB.value.set(b.s[0], b.s[1]);
          u.uvOffsetB.value.set(b.o[0], b.o[1]);
        }
      }
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
    const picks = tiles.map((p) => this.pick(p, grid));
    if (TUNING.units && this.L && !(TUNING.grainAmt > 0)) this.birthPairs(tiles, picks, grid);
    return picks;
  }

  /** A fresh board, tiles decided in `order` (most prominent first, so each
   *  world's lead assets land where the eye is). */
  planAll(order, { land = 0, initial = false } = {}) {
    this.namePlan = this.planNames();
    const grid = new Map();
    const plan = new Map();
    if (TUNING.units && this.L) this.planUnits(order, grid, plan, this.travelBudget(land, initial), initial);
    for (const p of order) if (!plan.has(p)) plan.set(p, this.pick(p, grid));
    this.namePlan = new Map(); // a strip is only ever placed by the plan that chose it
    return plan;
  }

  /** How far (rad) a unit's rows may travel before the next plan replaces it:
   *  landing + the longest hold + the next change. */
  travelBudget(land, initial) {
    const pace = this.getPace();
    if (!(pace > 0)) return 0; // rows still (reduced motion)
    if (this.worlds.length < 2) return Infinity; // no clock: the layout lives forever
    if (initial && !this.revealHeld) return Infinity; // replay: the first hold's start is unbounded
    return (pace * ((initial ? T_ENTRANCE : land) + TUNING.hold * (1 + TUNING.holdJit) + TUNING.trans) * Math.PI) / 180;
  }

  /** Units first, then (planAll) singles. Names were placed first and are never
   *  members. Every footprint lies in ONE owner region, and its outer
   *  4-neighbours are free of its key. Records are fresh objects { ...asset, place, kx, ky }. */
  planUnits(order, grid, plan, D, initial) {
    const g = this.grouping;
    const L = this.lon;
    const W = this.W;
    W.thetaH = this.getHorizon(); // null until the tick has posed the globe: then H pairs only (M4)
    if (initial) this.initThetaH = W.thetaH; // the latch, judged live by the initVQ gate
    this.lastD = D;
    const gT = TUNING.grainAmt > 0 ? TUNING.grainStart + TUNING.grainRamp + TUNING.grainStagger : 0;
    const cell = new Map();
    for (const p of this.panels) cell.set(p.tapeS * GRID + p.lonIndex, p);
    const thetaOf = (p) => Math.acos(Math.min(Math.max(p.centerDir.y, -1), 1));
    const ownerOf = (p) => g.pattern.owner(p.lonIndex, p.tapeS);
    const free = (p) => !!p && !p.parked && !plan.has(p) && !this.namePlan.has(p);
    const count = new Map(); // key → units in this plan
    const admissible = (lead, cls) => (cls === 'h' ? eligibleH(thetaOf(lead), D, gT) : W.thetaH != null && eligibleVQ(thetaOf(lead), D, W, gT));
    const outerFree = (members, key) => {
      const inside = new Set(members);
      for (const m of members) {
        for (const [dl, ds] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const q = cell.get((m.tapeS + ds) * GRID + ((m.lonIndex + dl + L) % L));
          if (q && !inside.has(q) && grid.get(q.tapeS * GRID + q.lonIndex) === key) return false;
        }
      }
      return true;
    };
    const footprint = (lead, cls) => {
      const { cols, rows } = UNIT_SHAPE[cls];
      const r = ownerOf(lead);
      const out = [];
      for (let ky = 0; ky < rows; ky++) {
        for (let kx = 0; kx < cols; kx++) {
          const m = cell.get((lead.tapeS - ky) * GRID + ((lead.lonIndex + kx) % L)); // ky 1 = one row south (tapeS − 1)
          if (!free(m) || ownerOf(m) !== r) return null;
          out.push(m); // index k → kx = k % cols, ky = floor(k / cols)
        }
      }
      return out;
    };
    const claim = (P, recs) => {
      P.members.forEach((m, k) => {
        plan.set(m, recs[k]);
        grid.set(m.tapeS * GRID + m.lonIndex, P.key);
      });
      count.set(P.key, (count.get(P.key) || 0) + 1);
    };
    // 1 — keep first: an intact unit whose asset is still in its region's pool (and may still form that class
    // there), still admissible, keeps its records (zero flips), refreshed to the region's world (m10).
    for (const p of order) {
      const P = p.shownAsset?.place;
      if (!P || P.members[0] !== p || !UNIT_CLASSES.has(P.cls)) continue;
      const intact = P.members.every((m) => free(m) && m.asset === m.shownAsset && m.asset?.place === P && !m.swapAsset);
      const r = ownerOf(p);
      const rec = g.pools[r]?.find((a) => assetKey(a) === P.key);
      if (!intact || P.members.some((m) => ownerOf(m) !== r) || rec?.unitCls !== P.cls) continue;
      if ((count.get(P.key) || 0) >= TUNING.unitMax || !admissible(p, P.cls) || !outerFree(P.members, P.key)) continue;
      // The member records are the unit's own objects (claim/birthPairs spread them), so this never touches a pool
      // record. A shared id kept across a world change now announces the new world.
      for (const m of P.members) Object.assign(m.asset, { world: rec.world, clientName: rec.clientName, services: rec.services });
      claim(P, P.members.map((m) => m.asset));
    }
    // 2 — new units, most prominent lead first, walking the region pool in editorial order.
    g.ucursor ??= [];
    for (const p of order) {
      if (!free(p)) continue;
      const r = ownerOf(p);
      const pool = g.pools[r];
      if (!pool?.length) continue;
      const c0 = g.ucursor[r] ?? g.cursor[r];
      for (let t = 0; t < pool.length; t++) {
        const i = (c0 + t) % pool.length;
        const a = pool[i];
        const cls = a.unitCls; // the class THIS region's world may form (decorate)
        if (!cls || !UNIT_CLASSES.has(cls)) continue;
        const key = assetKey(a);
        if ((count.get(key) || 0) >= TUNING.unitMax || !admissible(p, cls)) continue;
        const members = footprint(p, cls);
        if (!members || !outerFree(members, key)) continue;
        const { cols, rows } = UNIT_SHAPE[cls];
        const P = { uid: `${cls}:${p.lonIndex}:${p.tapeS}:${key}`, key, cls, cols, rows, n: members.length, S: unitAspect(cols, rows, this.L), L: this.L, members, born: false };
        claim(P, members.map((m, k) => ({ ...a, place: P, kx: k % cols, ky: Math.floor(k / cols) })));
        g.ucursor[r] = (i + 1) % pool.length; // the region's next unit takes the next classed asset
        if (i === g.cursor[r] % pool.length) g.cursor[r] = (i + 1) % pool.length; // …and singles don't open on it
        this.placed[cls] += 1;
        if (initial && cls !== 'h') this.initVQ += 1;
        break;
      }
    }
  }

  /** H pairs inside a born row (MeridianScroll.recycle → assignRow): lon pairs
   *  never wrap; the pick must be an 'h' asset; same owner region; outer
   *  neighbours free of its key; within ?popunitmax on the board. No V/Q: a born
   *  row sits in the north buffer (θ < 0), outside [θN, θS]. */
  birthPairs(tiles, picks, grid) {
    const g = this.grouping;
    const L = this.lon;
    const s = tiles[0].tapeS;
    const idx = new Map(tiles.map((p, i) => [p.lonIndex, i]));
    const keyAt = (lon) => assetKey(picks[idx.get((lon + L) % L)]);
    const onBoard = this.unitCountByKey();
    for (let lon = 0; lon + 1 < L; lon++) {
      const i = idx.get(lon);
      const j = idx.get(lon + 1);
      const a = picks[i];
      if (i == null || j == null || a?.unitCls !== 'h' || a.place || picks[j]?.kind === 'name') continue;
      const key = assetKey(a);
      if ((onBoard.get(key) || 0) >= TUNING.unitMax || g.pattern.owner(lon, s) !== g.pattern.owner(lon + 1, s)) continue;
      if (keyAt(lon - 1) === key || keyAt(lon + 2) === key) continue;
      if ([s - 1, s + 1].some((r) => grid.get(r * GRID + lon) === key || grid.get(r * GRID + lon + 1) === key)) continue;
      const P = { uid: `h:${lon}:${s}:${key}`, key, cls: 'h', cols: 2, rows: 1, n: 2, S: unitAspect(2, 1, this.L), L: this.L, members: [tiles[i], tiles[j]], born: true };
      picks[i] = { ...a, place: P, kx: 0, ky: 0 };
      picks[j] = { ...a, place: P, kx: 1, ky: 0 };
      onBoard.set(key, (onBoard.get(key) || 0) + 1);
      this.bornH += 1;
      this.placed.h += 1;
      lon += 1;
    }
  }

  /** Units on the board now (planned or in flight), counted by key. */
  unitCountByKey() {
    const seen = new Set();
    const n = new Map();
    for (const p of this.panels) {
      const P = (p.swapAsset || p.asset)?.place;
      if (!P || seen.has(P)) continue;
      seen.add(P);
      n.set(P.key, (n.get(P.key) || 0) + 1);
    }
    return n;
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
    const plan = this.planAll(order, { initial: true });
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
    const units = !!(TUNING.units && this.L);
    // Units off: planned now, as always. Units on: planned once the textures are
    // warm, against the poses the change lands on (travelBudget counts the landing).
    let plan = units ? null : this.planAll(this.byProminence());
    const bornAt = plan ? new Map([...plan.keys()].map((p) => [p, p.tapeS])) : null;
    const token = ++this.layoutToken;
    this.busy = true;
    this.warmGrouping().then(() => {
      if (this.disposed || token !== this.layoutToken) return;
      if (units) plan = this.planAll(this.byProminence(), { land: spread + dur });
      // A row re-born while the textures warmed already took the new
      // grouping from assignRow — its planned picks belong to its old place.
      else for (const [p, s] of bornAt) if (p.tapeS !== s) plan.delete(p);
      // A strip tile already showing its world's strip keeps the texture
      // (applyPlan skips a same-key tile) — but takes its new window.
      for (const [p, a] of plan) {
        if (a.kind === 'name' && !p.swapAsset && assetKey(p.shownAsset) === assetKey(a)) {
          p.asset = a;
          p.shownAsset = a;
        }
      }
      const animate = !this.frozen && this.canAnimate();
      const { span } = applyPlan(this, plan, {
        animate,
        style,
        spread,
        dur,
        onBound: this.countFlip,
        delays: units && animate && style !== 'cut' ? sharedDelays(plan, spread) : null,
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
    if (key === '*' || key === 'units' || key === 'quads' || key === 'cap' || key === 'media' || key === 'equiv') {
      this.redecorate();
      this.relayout();
      return;
    }
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
    else if (key === 'trans' || key === 'live' || key === 'enter' || key === 'tier') {
      // read at the next change / the scene swaps the live tier / Hero reads it at Enter World / the scheduler reads the tier at each stream start
    } else this.relayout(); // share, group, unitMax, the name knobs (media, cap and a reset's '*' re-decorate first, above)
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

  /** Per rendered frame (useGlobeScene): the render call's ms, and whether it
   *  uploaded a new GPU texture (renderer.info.memory.textures grew). */
  noteRender(ms, uploaded) {
    const r = this._render;
    r.ms[r.i] = ms;
    r.up[r.i] = uploaded > 0 ? 1 : 0;
    r.i = (r.i + 1) % r.ms.length;
    r.n = Math.min(r.n + 1, r.ms.length);
  }

  uploadStats() {
    const r = this._render;
    const up = [];
    const idle = [];
    for (let k = 0; k < r.n; k++) (r.up[k] ? up : idle).push(r.ms[k]);
    idle.sort((a, b) => a - b);
    const r2 = (x) => Math.round(x * 100) / 100;
    return {
      n: up.length,
      msMax: up.length ? r2(Math.max(...up)) : 0,
      idleP95: idle.length ? r2(idle[Math.floor(0.95 * (idle.length - 1))]) : 0,
    };
  }

  /** Residency, plus the ref ledger: at rest every ref is a tile's (heldThumbId)
   *  or the warm set's, so refs − tiles − warm must be 0. Null mid-change. A
   *  FAILED load is not in flight, so it never holds the ledger open. */
  texStats() {
    const t = this.textureManager.stats();
    const quiet = !this.busy && !this.tide && t.pending === 0 && !this.panels.some((p) => p.swapping);
    const held = this.panels.reduce((n, p) => n + (p.heldThumbId ? 1 : 0), 0);
    return { ...t, refDrift: quiet ? t.refs - held - this.warm.size : null };
  }

  /** Same-texture neighbours: right and up pairs among unparked, non-name tiles.
   *  Two members of ONE unit share a key by design and are skipped. unitAdj =
   *  the pairs touching a member; minPool = the grouping's smallest pool. */
  layoutStats() {
    const at = new Map();
    for (const p of this.panels) {
      if (!p.parked && p.shownAsset && p.shownAsset.kind !== 'name') at.set(p.tapeS * GRID + p.lonIndex, p);
    }
    let adj = 0;
    let unitAdj = 0;
    for (const p of at.values()) {
      const right = at.get(p.tapeS * GRID + ((p.lonIndex + 1) % this.lon));
      const up = at.get((p.tapeS + 1) * GRID + p.lonIndex);
      for (const q of [right, up]) {
        if (!q || assetKey(q.shownAsset) !== assetKey(p.shownAsset)) continue;
        const uid = p.shownAsset.place?.uid;
        if (uid && uid === q.shownAsset.place?.uid) continue;
        adj += 1;
        if (p.shownAsset.place || q.shownAsset.place) unitAdj += 1;
      }
    }
    return { adj, unitAdj, minPool: Math.min(...this.grouping.pools.map((pool) => pool.length)) };
  }

  /** Span telemetry (docs/globe-worlds-plan.md § Media spans). Plain
   *  numbers only: never a panel, never a Place (it is cyclic). */
  unitStats(r1) {
    const r9 = (x) => Math.round(x * 1e9) / 1e9;
    const diff = (s, o, w) =>
      Math.max(Math.abs(s.x - w.s[0]), Math.abs(s.y - w.s[1]), Math.abs(o.x - w.o[0]), Math.abs(o.y - w.o[1]));
    const isLive = (p) => p.liveState === 'live' || p.liveState === 'demoting';
    const aTexOf = (p) => p.mesh.material.uniforms.texA.value?.userData?.aspect ?? p.shownAsset?.tex?.aspect ?? 1;
    const out = {};

    // — P3 — which texture each cached key is; texB's register on live class textures.
    const clsOf = new Map();
    for (const pool of this.pools) for (const a of pool) clsOf.set(assetKey(a), a.tex?.cls ?? 'legacy');
    out.texClass = { h: 0, v: 0, q: 0, legacy: 0 };
    for (const k of this.textureManager.cache.keys()) if (clsOf.has(k)) out.texClass[clsOf.get(k)] += 1;
    const sched = this.getScheduler();
    const liveReg = { n: 0, worst: 0 };
    for (const p of this.panels) {
      const video = p.liveStream?.video ?? p.liveVideo;
      if (!p.asset?.tex || p.shownAsset !== p.asset || !isLive(p) || !(video?.videoWidth > 0) || !sched?.liveWindow) continue;
      const u = p.mesh.material.uniforms;
      liveReg.n += 1;
      liveReg.worst = Math.max(liveReg.worst, diff(u.uvScaleB.value, u.uvOffsetB.value, sched.liveWindow(p, video)));
    }
    out.liveReg = { n: liveReg.n, worst: r9(liveReg.worst) };

    // — P4a — the units the tiles show.
    const places = new Map(); // Place → its unparked showing tiles
    let members = 0;
    let liveMembers = 0;
    for (const p of this.panels) {
      const P = p.shownAsset?.place;
      if (!P || p.parked) continue;
      members += 1;
      if (isLive(p)) liveMembers += 1;
      if (!places.has(P)) places.set(P, []);
      places.get(P).push(p);
    }
    const rot = this.getRotation();
    const perKey = new Map();
    let torn = 0;
    let orphans = 0;
    let orphansFront = 0;
    for (const [P, tiles] of places) {
      if (P.members.every((m) => m.shownAsset?.place === P)) {
        perKey.set(P.key, (perKey.get(P.key) || 0) + 1);
        continue;
      }
      if (P.members.some((m) => m.swapAsset || m.swapping)) continue; // mid-change: not torn yet
      torn += 1;
      orphans += tiles.length;
      for (const t of tiles) if (this._v.copy(t.centerDir).applyEuler(rot).z > FACING) orphansFront += 1;
    }
    const deg = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(((x * 180) / Math.PI) * 100) / 100);
    const pace = this.getPace();
    Object.assign(out, {
      placed: { ...this.placed },
      bornH: this.bornH,
      members,
      liveMembers,
      whole: { n: places.size, torn },
      orphans,
      orphansFront,
      repeats: Math.max(0, ...perKey.values()),
      clock: !(pace > 0) ? 'static' : this.frozen || this.held || this.worlds.length < 2 || !this.canAnimate() ? 'stopped' : 'running',
      D: deg(this.lastD),
      thetaH: deg(this.W.thetaH),
      initVQ: this.initVQ,
      initThetaH: deg(this.initThetaH),
    });

    // — P4b — what whole units RENDER: the shader's mUv, re-derived from the uniforms and the pose.
    const seam = { n: 0, worst: 0 };
    const register = { n: 0, worst: 0 };
    for (const [P] of places) {
      if (!this.wholeUnit(P)) continue;
      for (const m of P.members) {
        const u = m.mesh.material.uniforms;
        const y = Math.min(Math.max(m.centerDir.y, -1), 1);
        register.n += 1;
        register.worst = Math.max(register.worst, diff(u.uvScaleA.value, u.uvOffsetA.value, unitA(m.shownAsset, namePinch(y), Math.acos(y), aTexOf(m))));
      }
      if (P.cols !== 2) continue;
      for (let ky = 0; ky < P.rows; ky++) {
        const left = P.members[ky * 2];
        const right = P.members[ky * 2 + 1];
        const uL = left.mesh.material.uniforms;
        const uR = right.mesh.material.uniforms;
        const [l0, r0] = rendered(uL.uvScaleA.value.x, uL.uvOffsetA.value.x, namePinch(left.centerDir.y));
        const [l1, r1x] = rendered(uR.uvScaleA.value.x, uR.uvOffsetA.value.x, namePinch(right.centerDir.y));
        const wL = r0 - l0;
        seam.n += 1;
        seam.worst = Math.max(seam.worst, Math.max(Math.abs(l1 - r0 - (wL * P.L.Gphi) / P.L.phiLen), Math.abs(r1x - l1 - wL)) / wL);
      }
    }
    Object.assign(out, {
      seam: { n: seam.n, worst: r9(seam.worst) },
      register: { n: register.n, worst: r9(register.worst) },
      snaps: this.unitSnaps,
      skewBad: this.skewBad,
      skewChecks: this.skewChecks,
    });

    // — P5 — V/Q: columns align across the row seam, rows keep the mullion, warp stays inside ε.
    const cols = { n: 0, worst: 0 };
    const rows = { n: 0, worst: 0 };
    const warp = { n: 0, worst: 0 };
    for (const [P] of places) {
      if (P.rows !== 2 || !this.wholeUnit(P)) continue;
      for (let kx = 0; kx < P.cols; kx++) {
        const top = P.members[kx];
        const bot = P.members[P.cols + kx];
        const uT = top.mesh.material.uniforms;
        const uB = bot.mesh.material.uniforms;
        const [lt, rt] = rendered(uT.uvScaleA.value.x, uT.uvOffsetA.value.x, namePinch(top.centerDir.y));
        const [lb, rb] = rendered(uB.uvScaleA.value.x, uB.uvOffsetA.value.x, namePinch(bot.centerDir.y));
        cols.n += 1;
        cols.worst = Math.max(cols.worst, Math.max(Math.abs(lt - lb), Math.abs(rt - rb)) / (rt - lt));
        const hT = uT.uvScaleA.value.y;
        const hB = uB.uvScaleA.value.y;
        const gap = uT.uvOffsetA.value.y - (uB.uvOffsetA.value.y + hB); // Yt0 − Yb1
        rows.n += 1;
        rows.worst = Math.max(rows.worst, Math.abs(gap - (hB * P.L.Gth) / P.L.bandH), Math.abs(hT - hB));
      }
      for (const m of P.members) {
        const vK = namePinch(m.centerDir.y);
        const C = coverWindow(aTexOf(m), P.S);
        const [a, b] = frac(m.shownAsset.kx, P.cols, P.L.Pphi, P.L.Gphi, P.L.phiLen);
        const qMeas = (vK * m.mesh.material.uniforms.uvScaleA.value.x) / (C.s[0] * (b - a));
        warp.n += 1;
        warp.worst = Math.max(warp.worst, Math.abs(Math.log(vK / qMeas)));
      }
    }
    Object.assign(out, {
      cols: { n: cols.n, worst: r9(cols.worst) },
      rows: { n: rows.n, worst: r9(rows.worst) },
      warp: { n: warp.n, worst: r9(warp.worst) },
    });

    // — P6a — a unit's stream and chip; texB's register on whole live units.
    const liveSplit = { n: 0, split: 0 };
    const registerB = { n: 0, worst: 0 };
    let chipsPerUnit = 0;
    for (const [P] of places) {
      if (!this.wholeUnit(P)) continue;
      chipsPerUnit = Math.max(chipsPerUnit, P.members.filter((m) => m.liveAnnounced).length);
      const lit = P.members.filter((m) => m.liveStream);
      if (!lit.length) continue;
      const s = P.members[0].liveStream;
      liveSplit.n += 1;
      if (!s || !P.members.every((m) => m.liveStream === s && m.liveUid === P.uid)) liveSplit.split += 1;
      for (const m of lit) {
        if (m.liveUid !== P.uid) continue; // joined as something else (counted split above): not this unit's B
        const video = m.liveStream.video;
        if (!(video?.videoWidth > 0)) continue;
        const u = m.mesh.material.uniforms;
        const A = { s: [u.uvScaleA.value.x, u.uvScaleA.value.y], o: [u.uvOffsetA.value.x, u.uvOffsetA.value.y] };
        const V = pictureAspect(m.shownAsset, video); // Mux's exact ratio; the decoded frame only as a fallback (m6)
        registerB.n += 1;
        registerB.worst = Math.max(registerB.worst, diff(u.uvScaleB.value, u.uvOffsetB.value, liveB(V, aTexOf(m), A)));
      }
    }
    Object.assign(out, { liveSplit, chipsPerUnit, registerB: { n: registerB.n, worst: r9(registerB.worst) } });

    // — P6b — texB texels per device px (vertical), against the front row's R1 (R1 is report-only).
    const density = { n: 0, worst: 0 };
    if (r1 > 0) {
      for (const p of this.panels) {
        const video = p.liveStream?.video;
        if (!p.shownAsset?.place || p.parked || !(video?.videoHeight > 0)) continue;
        if (p.liveUid !== p.shownAsset.place.uid) continue; // lit as something else: not this unit's B (A7)
        density.n += 1;
        density.worst = Math.max(density.worst, (video.videoHeight * p.mesh.material.uniforms.uvScaleB.value.y) / r1);
      }
    }
    out.density = { n: density.n, worst: Math.round(density.worst * 1000) / 1000 };

    return out;
  }

  /** ~2 Hz from the scene's stat clock: visible shares, integrity (visible
   *  tiles showing a world of the current grouping), black tiles, live
   *  videos per world, the change clock — published as window.__swmPopStats
   *  (bench + probe). */
  sample(rotation, { fps = null, gpuTextures = null, dt = 0.5, r1 = null } = {}) {
    const g = this.grouping;
    const shares = new Map();
    const live = new Map();
    let visible = 0;
    let black = 0;
    let inGroup = 0;
    let liveTiles = 0;
    let nameTiles = 0;
    let nameMaxY = 0;
    // Strip slice k → { lo, hi } of the strip the tile actually RENDERS (so
    // after panelMaterial's pole-pinch crop — the uniforms alone cannot show
    // it, which is how "TOHOST" passed every gate), and `w`, the slice it
    // should be. The probe's namesSlice (full width, in register) and
    // namesStill (unmoving between two holds) gates both read this.
    const nameSlices = {};
    const r6 = (n) => Math.round(n * 1e6) / 1e6;
    for (const p of this.panels) {
      if (p.liveState === 'live') liveTiles += 1;
      if (p.parked) continue;
      if (this._v.copy(p.centerDir).applyEuler(rotation).z <= FACING) continue;
      visible += 1;
      if (!p.mesh.material.uniforms.uHasTexA.value) black += 1;
      if (p.shownAsset?.kind === 'name') {
        nameTiles += 1;
        nameMaxY = Math.max(nameMaxY, Math.abs(p.centerDir.y));
        const u = p.mesh.material.uniforms;
        const vk = namePinch(p.centerDir.y);
        const [lo, hi] = nameRendered(u.uvScaleA.value.x, u.uvOffsetA.value.x, vk);
        // vk rides along so the gate can tell a readable tile from a sliver a
        // strip has since scrolled to the pole, where the pinch itself is
        // changing faster than one frame of measurement can follow.
        nameSlices[p.shownAsset.k] = { lo: r6(lo), hi: r6(hi), w: r6(this.nameSliceOf(p)), vk: r6(vk) };
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
      nameSlices,
      live: [...live].map(([w, c]) => `${this.worlds[w].clientName} ${c}`),
      fps,
      // Span telemetry (docs/globe-worlds-plan.md § Media spans). Plain data: no panels, no cycles.
      tex: this.texStats(),
      upload: this.uploadStats(),
      r1,
      decode: this.getScheduler()?.decodeStats?.() ?? null,
      layout: this.layoutStats(),
      staleLanded: this.staleLanded,
      bornCancelled: this.getScroller()?.bornCancelled ?? 0,
      units: TUNING.units && this.L ? this.unitStats(r1) : null,
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
