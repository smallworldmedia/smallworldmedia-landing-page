/**
 * worldPatterns.js — cluster layouts for the home globe's population modes
 * (docs/globe-worlds-plan.md). Pure.
 *
 * The TAPE: every meridian-scroll tile has a coordinate (lon, s) — its
 * longitude index (0..lon-1, periodic) and the birth index of its row
 * (MeridianScroll numbers rows as they are born at the top pole; older rows
 * are lower). A pattern is a pure function over that endless, lon-periodic
 * tape, so a cluster travels pole-to-pole WITH its tiles and every row born
 * later simply continues the layout — nothing is laid out twice.
 *
 *   makePattern(name, { seed, weights, lon })
 *     → { name, owner(lon, s), depth(lon, s) }
 *   owner → region index 0..weights.length-1 (a project of the grouping, or a
 *           media kind for `facets`); regions take tape area ∝ weights
 *   depth → 0 at a region's heart … 1 at its frontier (the bloom stagger)
 *
 *   makeField(seed, { lon, grain }) → { value(lon, s) }  — a smooth threshold
 *   field, uniformized to [0,1] so "tiles with value < m" is a fraction m of
 *   the globe; Blend grows one world's islands through another with it.
 *
 * Everything is seeded (hashSeed/mulberry32 — the house PRNG in
 * work/world/seededLayout.js): the same seed always draws the same globe.
 */
import { hashSeed, mulberry32 } from '../work/world/seededLayout.js';

export const PATTERNS = ['continents', 'archipelago', 'gores', 'bands', 'spiral', 'facets'];

/* — Integer lattice hash + periodic value noise (no dependency: the repo has
   no noise helper and a stationary 2-octave value noise is all this needs). */
function hash3(seed, i, j) {
  let h = (seed ^ Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise at (u, v), periodic in u over `pu` lattice cells; 0..1. */
function valueNoise(seed, u, v, pu) {
  const i0 = Math.floor(u);
  const j0 = Math.floor(v);
  const fu = u - i0;
  const fv = v - j0;
  const su = fu * fu * (3 - 2 * fu);
  const sv = fv * fv * (3 - 2 * fv);
  const wa = ((i0 % pu) + pu) % pu;
  const wb = (wa + 1) % pu;
  const a = hash3(seed, wa, j0);
  const b = hash3(seed, wb, j0);
  const c = hash3(seed, wa, j0 + 1);
  const d = hash3(seed, wb, j0 + 1);
  const top = a + (b - a) * su;
  return top + (c + (d - c) * su - top) * sv;
}

/** Two-octave tape noise, lon-periodic; `grain` = feature size in tiles. */
function tapeNoise(seed, lon, x, y, grain) {
  const pu = Math.max(1, Math.round(lon / grain));
  const u = (x / lon) * pu;
  const v = y / grain;
  return 0.65 * valueNoise(seed, u, v, pu) + 0.35 * valueNoise(seed ^ 0x5bd1e995, u * 2, v * 2, pu * 2);
}

const wrapLon = (d, lon) => d - lon * Math.round(d / lon); // → [-lon/2, lon/2]

function shuffle(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Largest-remainder labels: `count` slots split ∝ weights, every region ≥ 1
 *  when there is room, shuffled. */
function apportion(weights, count, rand) {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (w / total) * count);
  const counts = exact.map(Math.floor);
  let left = count - counts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((e, i) => [e - counts[i] + rand() * 1e-6, i])
    .sort((a, b) => b[0] - a[0]);
  for (let n = 0; n < left; n++) counts[order[n % order.length][1]] += 1;
  if (count >= weights.length) {
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] > 0) continue;
      const donor = counts.indexOf(Math.max(...counts));
      counts[donor] -= 1;
      counts[i] = 1;
    }
  }
  const labels = [];
  counts.forEach((c, i) => {
    for (let n = 0; n < c; n++) labels.push(i);
  });
  return shuffle(labels, rand);
}

/* — Voronoi family (continents / archipelago / facets): stratified-jitter
   seeds per BLOCK of tape rows, labels apportioned per block, positions
   domain-warped by noise so frontiers read ragged, not polygonal. — */
const VORONOI = {
  continents: { perRegion: 2, block: 8, warp: 0.7 },
  archipelago: { perRegion: 5, block: 8, warp: 0.5 },
  facets: { perRegion: 3, block: 8, warp: 0.6 },
};

function voronoiPattern(name, seed, weights, lon) {
  const { perRegion, block, warp } = VORONOI[name];
  const count = Math.max(weights.length, Math.round(perRegion * weights.length));
  const cols = Math.max(1, Math.round(Math.sqrt((count * lon) / block)));
  const rowsN = Math.ceil(count / cols);
  const cache = new Map();
  const seedsFor = (b) => {
    let arr = cache.get(b);
    if (arr) return arr;
    const rand = mulberry32(hashSeed(`${seed}:${name}:${b}`));
    const strata = [];
    for (let r = 0; r < rowsN; r++) for (let c = 0; c < cols; c++) strata.push([c, r]);
    shuffle(strata, rand);
    const labels = apportion(weights, count, rand);
    arr = labels.map((label, n) => {
      const [c, r] = strata[n % strata.length];
      return { x: ((c + rand()) / cols) * lon, y: b * block + ((r + rand()) / rowsN) * block, label };
    });
    cache.set(b, arr);
    // The tape only moves forward — drop blocks far behind the live window.
    for (const k of cache.keys()) if (k < b - 3) cache.delete(k);
    return arr;
  };
  const warpSeed = hashSeed(`${seed}:${name}:warp`);
  const nearest = (lonI, s) => {
    const x = lonI + 0.5 + warp * 2 * (tapeNoise(warpSeed, lon, lonI + 0.5, s + 0.5, 2) - 0.5);
    const y = s + 0.5 + warp * 2 * (tapeNoise(warpSeed ^ 0x9e3779b9, lon, lonI + 0.5, s + 0.5, 2) - 0.5);
    const b = Math.floor(y / block);
    let d1 = Infinity;
    let d2 = Infinity;
    let label = 0;
    for (let bb = b - 1; bb <= b + 1; bb++) {
      for (const p of seedsFor(bb)) {
        const dx = wrapLon(x - p.x, lon);
        const dy = y - p.y;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          label = p.label;
        } else if (d < d2) d2 = d;
      }
    }
    const r1 = Math.sqrt(d1);
    const r2 = Math.sqrt(d2);
    return { label, depth: Math.min(1, (2 * r1) / (r1 + r2 || 1)) };
  };
  return {
    name,
    owner: (lonI, s) => nearest(lonI, s).label,
    depth: (lonI, s) => nearest(lonI, s).depth,
  };
}

/* — Gores (and spiral): longitude sectors, each region twice around the
   globe (A B A B …) with widths ∝ weights; every boundary wanders per row, so
   the gores' edges wiggle as they flow. Spiral twists the sectors a fixed
   longitude per row, so each gore corkscrews pole-to-pole. — */
function gorePattern(name, seed, weights, lon) {
  const rand = mulberry32(hashSeed(`${seed}:${name}`));
  const repeat = 2;
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const sectors = [];
  for (let r = 0; r < repeat; r++) {
    weights.forEach((w, label) => sectors.push({ label, w: (w / total) * (lon / repeat) }));
  }
  const offset = rand() * lon;
  let acc = 0;
  const starts = sectors.map((sec) => {
    const at = acc;
    acc += sec.w;
    return at;
  });
  const twist = name === 'spiral' ? (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.25) : 0;
  const amp = 0.45;
  const jitterSeed = hashSeed(`${seed}:${name}:edge`);
  const locate = (lonI, s) => {
    const x = lonI + 0.5 - offset - twist * s;
    // Boundary i wanders along s with its own noise stream (lon-free: an edge
    // is one meridian-ish line per row).
    const edge = (i) => starts[i] + amp * 2 * (tapeNoise(jitterSeed + i, lon, 0, s * 0.5, 2) - 0.5);
    const e0 = edge(0);
    const rel = (((x - e0) % lon) + lon) % lon;
    let idx = sectors.length - 1;
    for (let i = 1; i < sectors.length; i++) {
      if (rel < edge(i) - e0) {
        idx = i - 1;
        break;
      }
    }
    const lo = edge(idx) - e0;
    const hi = idx + 1 < sectors.length ? edge(idx + 1) - e0 : lon;
    const half = Math.max((hi - lo) / 2, 0.5);
    return { label: sectors[idx].label, depth: Math.min(1, Math.abs(rel - (lo + hi) / 2) / half) };
  };
  return {
    name,
    owner: (lonI, s) => locate(lonI, s).label,
    depth: (lonI, s) => locate(lonI, s).depth,
  };
}

/* — Bands: stream ranges — each region owns a run of rows, heights ∝
   weights, cycling; the frontier row is ragged by longitude so a band's edge
   reads as a coastline, not a latitude line. — */
function bandPattern(name, seed, weights, lon) {
  const rand = mulberry32(hashSeed(`${seed}:${name}`));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const bandRows = 3;
  const heights = weights.map((w) => Math.max(1, Math.round((bandRows * weights.length * w) / total)));
  const cycle = heights.reduce((a, b) => a + b, 0);
  const phase = rand() * cycle;
  const amp = 0.8;
  const jitterSeed = hashSeed(`${seed}:${name}:edge`);
  const locate = (lonI, s) => {
    const y = s + 0.5 + phase + amp * 2 * (tapeNoise(jitterSeed, lon, lonI + 0.5, s * 0.35, 3) - 0.5);
    const q = ((y % cycle) + cycle) % cycle;
    let acc = 0;
    for (let i = 0; i < heights.length; i++) {
      if (q < acc + heights[i]) {
        return { label: i, depth: Math.min(1, Math.abs(q - (acc + heights[i] / 2)) / (heights[i] / 2)) };
      }
      acc += heights[i];
    }
    return { label: heights.length - 1, depth: 1 };
  };
  return {
    name,
    owner: (lonI, s) => locate(lonI, s).label,
    depth: (lonI, s) => locate(lonI, s).depth,
  };
}

/**
 * @param {string} name - one of PATTERNS
 * @param {{ seed: number|string, weights: number[], lon: number }} opts
 */
export function makePattern(name, { seed, weights, lon }) {
  const w = weights?.length ? weights : [1];
  if (w.length === 1) return { name, owner: () => 0, depth: () => 0 };
  if (VORONOI[name]) return voronoiPattern(name, seed, w, lon);
  if (name === 'gores' || name === 'spiral') return gorePattern(name, seed, w, lon);
  if (name === 'bands') return bandPattern(name, seed, w, lon);
  return voronoiPattern('continents', seed, w, lon);
}

/**
 * Smooth threshold field over the tape, uniformized: value() is ~uniform on
 * [0,1] (an empirical CDF of the raw noise), so `value < m` covers a fraction
 * m of the tiles while staying spatially coherent — islands grow, not specks.
 * @param {number|string} seed
 * @param {{ lon: number, grain: number }} opts - grain = feature size, tiles
 */
export function makeField(seed, { lon, grain }) {
  const base = hashSeed(`${seed}:field:${grain}`);
  const g = Math.max(0.6, grain);
  const raw = (lonI, s) => tapeNoise(base, lon, lonI + 0.5, s + 0.5, g);
  const rand = mulberry32(base);
  const sample = [];
  for (let i = 0; i < 2048; i++) sample.push(raw(Math.floor(rand() * lon), Math.floor(rand() * 512)));
  sample.sort((a, b) => a - b);
  const cdf = (v) => {
    let lo = 0;
    let hi = sample.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sample[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return lo / sample.length;
  };
  return { grain: g, value: (lonI, s) => cdf(raw(lonI, s)) };
}
