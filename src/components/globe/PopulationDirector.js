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
    this.busy = false;
    this.busyCall = null;
    this.layoutToken = 0;
    this.changing = null; // the timed change in flight (tide | blink | surge | cut)
    this.tide = null; // { t, T, D, done, scroller } while a tide rolls
    this.greeted = false; // the first world announced (after the entrance)
    this.flips = 0; // tiles re-laid in place (monotonic; births aren't flips)
    this.flipsSampled = 0;
    this.countFlip = () => (this.flips += 1);
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
    this.pools = worlds.map((w, wi) =>
      w.assets.map((a) => ({ ...a, clientName: w.clientName, services: w.services, world: wi }))
    );
    this._v = new THREE.Vector3();
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

  /** Hold a ref on every asset of the current grouping, and plan + warm the
   *  next one. Resolves once the CURRENT grouping's textures have settled —
   *  including keys an earlier prefetch is still loading. */
  warmGrouping() {
    const now = this.warmPools(this.grouping.pools);
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
    const keep = new Set([...this.grouping.pools, ...(this.upcoming?.pools ?? [])].flat().map(assetKey));
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
    this.warmPools(this.upcoming.pools);
  }

  beginHold() {
    const r = mulberry32(hashSeed(`${this.seed}:${this.step}:hold`))();
    this.holdLeft = TUNING.hold * (1 + TUNING.holdJit * (2 * r - 1));
  }

  /** Per rendered frame, from the scene's tick (before the scroll update, so
   *  a tide's travel lands the same frame). */
  update(dt) {
    if (this.disposed || this.frozen || !this.canAnimate()) return;
    if (!this.greeted) this.greet(true);
    if (this.tide) {
      this.rollTide(dt);
      return;
    }
    if (this.busy || this.worlds.length < 2) return;
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
    else if (key === 'trans' || key === 'live') {
      // read at the next change / the scene swaps the live tier
    } else this.relayout(); // media, cap, share, group, reset
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
    for (const p of this.panels) {
      if (p.liveState === 'live') liveTiles += 1;
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
      phase: this.frozen ? 'frozen' : this.changing ? 'transition' : this.busy ? 'relayout' : 'hold',
      grouping: g.members.map(label),
      world: label(this.lead),
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
