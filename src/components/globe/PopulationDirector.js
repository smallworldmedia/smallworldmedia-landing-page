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
 *
 * P1 = Tides holds: the grouping changes only from the bench — ⏭ next (relay:
 * A+B → B+C), a reroll or a layout knob — as a warm, staggered blink relayout
 * (tileSwap.applyPlan). The current AND the next grouping's textures are
 * held warm (the director's own refs), so a swap never waits on the network
 * — ⏭ lands on decoded textures, as P2's hold timer will. Swaps land as
 * cuts whenever the screens aren't free to blink (intro hold, entrance
 * cascade, the commit's blue fill, reduced motion).
 *
 * Tile assets are decorated once with their world (stats/focus) and the chip
 * copy HeroLabels reads (clientName, services).
 */
import gsap from 'gsap';
import * as THREE from 'three';
import { assetKey } from './TextureManager.js';
import { loadTile, applyPlan, cancelSwap } from './tileSwap.js';
import { selectPool, WORLD_KINDS } from './buildWorldPools.js';
import { makePattern } from './worldPatterns.js';
import { hashSeed, mulberry32 } from '../work/world/seededLayout.js';
import { TUNING, POP_DEFAULTS, MEDIA_KINDS } from './popConfig.js';

const RELAYOUT_SPREAD = 0.6; // s — bench relayout stagger window
const RELAYOUT_DUR = 0.45; // s — one tile's blink
const GRID = 64; // tape grid key stride (lon < GRID)
const FACING = 0.05; // prominence floor for "visible" in the stats

export default class PopulationDirector {
  /**
   * @param {Object} opts
   * @param {Array} opts.panels - scroll-globe panels (lonIndex, row, tapeS stamped at build)
   * @param {Array} opts.worlds - buildWorldPools output
   * @param {TextureManager} opts.textureManager
   * @param {() => (LivePanelScheduler|null)} opts.getScheduler
   * @param {() => THREE.Euler} opts.getRotation - the globe's live rotation
   * @param {() => boolean} opts.canAnimate - false → swaps land as cuts
   */
  constructor({ panels, worlds, textureManager, getScheduler, getRotation, canAnimate }) {
    this.panels = panels;
    this.worlds = worlds;
    this.textureManager = textureManager;
    this.getScheduler = getScheduler;
    this.getRotation = getRotation;
    this.canAnimate = canAnimate;
    this.disposed = false;
    this.frozen = false;
    this.busy = false;
    this.busyCall = null;
    this.layoutToken = 0;
    this.flips = 0; // tiles re-laid in place (monotonic; births aren't flips)
    this.flipsSampled = 0;
    this.countFlip = () => (this.flips += 1);
    this.warm = new Map(); // texture key → its load promise; one director ref per key
    this.upcoming = null; // the next grouping, pre-warmed
    this.lon = 1 + Math.max(...panels.map((p) => p.lonIndex));
    const byRow = new Map();
    for (const p of panels) {
      if (!byRow.has(p.row)) byRow.set(p.row, []);
      byRow.get(p.row).push(p);
    }
    this.rows = [...byRow.values()];
    this.pools = worlds.map((w, wi) =>
      w.assets.map((a) => ({ ...a, clientName: w.clientName, services: w.services, world: wi }))
    );
    this._v = new THREE.Vector3();
    this.assignRow = this.assignRow.bind(this);
    this.reseed();
    this.grouping = this.makeGrouping();
  }

  /** Seed-derived start: which world leads the first grouping. */
  reseed() {
    this.seed = TUNING.seed;
    this.start = Math.floor(mulberry32(hashSeed(`${this.seed}:start`))() * this.worlds.length);
    this.step = 0;
  }

  makeGrouping(forcedPattern = null, step = this.step) {
    const n = this.worlds.length;
    const size = Math.min(TUNING.group, n);
    const lead = (this.start + step) % n;
    const members = Array.from({ length: size }, (_, i) => (lead + i) % n);
    const seed = hashSeed(`${this.seed}:${step}`);
    const set = TUNING.patterns.length ? TUNING.patterns : POP_DEFAULTS.patterns;
    const name = forcedPattern || set[Math.floor(mulberry32(seed ^ 0x9e3779b9)() * set.length)];
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
    return {
      members,
      regionWorld,
      pools,
      name,
      seed,
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
    const grid = new Map();
    const plan = new Map();
    for (const p of order) plan.set(p, this.pick(p, grid));
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

  /** Hold a ref on every asset of the current grouping and the next one.
   *  Resolves once the CURRENT grouping's textures have settled — including
   *  keys an earlier prefetch is still loading. */
  warmGrouping() {
    const now = this.warmPools(this.grouping.pools);
    this.upcoming = this.makeGrouping(null, this.step + 1);
    this.warmPools(this.upcoming.pools);
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
    const keep = new Set([...this.grouping.pools, ...(this.upcoming?.pools ?? [])].flat().map(assetKey));
    for (const k of this.warm.keys()) {
      if (keep.has(k)) continue;
      this.warm.delete(k);
      this.textureManager.release(k);
    }
  }

  /** Re-lay the whole globe with a fresh grouping (bench actions). */
  relayout({ reseed = false, pattern = null } = {}) {
    if (this.disposed) return;
    if (reseed) this.reseed();
    this.grouping = this.makeGrouping(pattern);
    const plan = this.planAll(this.byProminence());
    const bornAt = new Map([...plan.keys()].map((p) => [p, p.tapeS]));
    const token = ++this.layoutToken;
    this.busy = true;
    this.warmGrouping().then(() => {
      if (this.disposed || token !== this.layoutToken) return;
      // A row re-born while the textures warmed already took the new
      // grouping from assignRow — its planned picks belong to its old place.
      for (const [p, s] of bornAt) if (p.tapeS !== s) plan.delete(p);
      const { span } = applyPlan(this, plan, {
        animate: !this.frozen && this.canAnimate(),
        spread: RELAYOUT_SPREAD,
        dur: RELAYOUT_DUR,
        onBound: this.countFlip,
      });
      if (this.busyCall) this.busyCall.kill();
      this.busyCall = gsap.delayedCall(span, () => {
        this.busy = false;
        this.releaseCold();
      });
    });
  }

  next() {
    this.step += 1;
    this.relayout();
  }

  show(pattern) {
    this.relayout({ pattern });
  }

  /** A popConfig change (useGlobeScene forwards the key). */
  onTune(key) {
    if (key === 'seed') this.relayout({ reseed: true });
    else if (key === 'patterns') {
      if (!TUNING.patterns.includes(this.grouping.name)) this.relayout();
    } else this.relayout();
  }

  /** The commit engaged its blue fill: land every in-flight swap now and
   *  hold still (later relayouts cut under the blue) until unfreeze. */
  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    for (const p of this.panels) cancelSwap(p, this, { complete: true });
  }

  unfreeze() {
    this.frozen = false;
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
   *  videos per world — published as window.__swmPopStats (bench + probe). */
  sample(rotation, { fps = null, gpuTextures = null, dt = 0.5 } = {}) {
    const g = this.grouping;
    const shares = new Map();
    const live = new Map();
    let visible = 0;
    let black = 0;
    let inGroup = 0;
    for (const p of this.panels) {
      if (p.parked) continue;
      if (this._v.copy(p.centerDir).applyEuler(rotation).z <= FACING) continue;
      visible += 1;
      if (!p.mesh.material.uniforms.uHasTexA.value) black += 1;
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
      phase: this.frozen ? 'frozen' : this.busy ? 'relayout' : 'hold',
      grouping: g.members.map(label),
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
      live: [...live].map(([w, c]) => `${this.worlds[w].clientName} ${c}`),
      fps,
    };
    this.flipsSampled = this.flips;
    if (typeof window !== 'undefined') window.__swmPopStats = stats;
    return stats;
  }

  dispose() {
    this.disposed = true;
    if (this.busyCall) this.busyCall.kill();
    for (const p of this.panels) cancelSwap(p);
    for (const k of this.warm.keys()) this.textureManager.release(k);
    this.warm.clear();
    if (typeof window !== 'undefined') delete window.__swmPopStats;
  }
}
