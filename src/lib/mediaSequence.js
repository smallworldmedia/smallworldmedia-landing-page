/**
 * mediaSequence.js — the house media SEQUENCE (10-31, Nathan): one tile that
 * cuts through a set of stills on one shared clock, wherever it shows — the
 * detail grid (MediaSlot), the /work World's DRUM plates (fpDrum + fpAtlas)
 * and the home globe's panels (buildWorldPools + PopulationDirector).
 *
 * What makes a sequence:
 *   - a displayGroup ending `-sequence` (Studio: the same name on every
 *     member; frame order = Studio order). buildContentFlow collapses the
 *     group into ONE showcase item carrying `frames`, so variants of a logo
 *     or a set of mockups take one tile instead of one tile each.
 *   - on the home globe only, a project's album art (buildWorldPools): one
 *     panel cycles the covers instead of a panel per cover.
 * Stills only: a video member keeps its own tile.
 *
 * The clock is the wall clock: frame = floor(now / interval) mod n. Every
 * sequence on every route changes on the same beat with nothing to subscribe
 * to (the house metronome idea, motion.js housePulseLoop). A hard cut, never a
 * blend (the globe's rule: the eye never sees two images mix). Reduced motion
 * holds frame 0.
 *
 * Fit (Nathan, 10-31): the tile takes the shape that crops the set LEAST
 * (sequenceRatio, over the members' label ratios — the label wins, as in
 * ratioOf). An opaque frame fills the tile (cover); a frame with transparency
 * shows whole on near-black (contain), so a logo never loses its edges.
 */

/** The one rate for every sequence, in ms per frame (?seqms; bake on Nathan's number). */
export const SEQUENCE_INTERVAL_MS = 1000;
/** Frames kept per authored sequence: the detail grid and the World's plates load every frame.
 *  (The globe loads one frame ahead, so its album-art sequence takes every cover.) */
export const SEQUENCE_MAX_FRAMES = 12;
/** The contain fill (--color-near-black), as the Sanity CDN's bg= hex. */
export const SEQUENCE_PAD_BG = '0a0a0a';

const GROUP_RE = /(^|-)sequence$/i;
/** displayGroup convention that collapses its members into one sequence tile. */
export const isSequenceGroup = (group) => GROUP_RE.test(group ?? '');

// ?seqms, re-read only when the query string changes (ClientRouter swaps keep
// the module alive across routes). 100 ms – 10 s; anything else → the default.
// The home bench (PopTunePanel) dials it live, over the URL until a reload.
const clampMs = (v) => (Number.isFinite(v) && v >= 100 ? Math.min(v, 10000) : SEQUENCE_INTERVAL_MS);
let lastSearch = null;
let intervalMs = SEQUENCE_INTERVAL_MS;
let benchMs = null;
export function sequenceIntervalMs() {
  if (benchMs != null) return benchMs;
  if (typeof location === 'undefined') return SEQUENCE_INTERVAL_MS;
  if (location.search !== lastSearch) {
    lastSearch = location.search;
    const raw = new URLSearchParams(lastSearch).get('seqms');
    intervalMs = clampMs(raw == null || raw === '' ? NaN : Number(raw));
  }
  return intervalMs;
}

/** The bench's live write (PopTunePanel). */
export function setSequenceIntervalMs(ms) {
  benchMs = clampMs(ms);
}

/** A copied bench link with the rate: ?seqms when off the default (as heroConfig.withHeroTilt). */
export function withSequenceRate(url) {
  const u = new URL(url);
  const ms = sequenceIntervalMs();
  if (ms !== SEQUENCE_INTERVAL_MS) u.searchParams.set('seqms', String(ms));
  else u.searchParams.delete('seqms');
  return u.toString();
}

let reduced = null;
const prefersReducedMotion = () =>
  (reduced ??=
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);

/** The frame a sequence of `n` shows at `now` (performance.now() ms). */
export function sequenceFrame(n, now = performance.now()) {
  if (!(n > 1) || prefersReducedMotion()) return 0;
  return Math.floor(now / sequenceIntervalMs()) % n;
}

/** ms until the next frame change — a DOM slot schedules its next cut here. */
export function msToNextFrame(now = performance.now()) {
  const ms = sequenceIntervalMs();
  return ms - (now % ms);
}

/**
 * The tile ratio that crops the set least: of the members' ratios, the one
 * that minimises Σ (1 − min(r, t) / max(r, t)) — the share of each picture a
 * cover fit loses (or a contain fit leaves empty). The sum is concave between
 * neighbouring ratios, so the best tile is always one of the members' own;
 * ties keep the earlier frame.
 */
export function sequenceRatio(ratios) {
  let best = ratios[0] ?? 1;
  let bestCost = Infinity;
  for (const t of ratios) {
    let cost = 0;
    for (const r of ratios) cost += 1 - Math.min(r, t) / Math.max(r, t);
    if (cost < bestCost - 1e-9) {
      best = t;
      bestCost = cost;
    }
  }
  return best;
}

/**
 * One sequence item: the lead's fields (so every one-item-one-image consumer
 * keeps working on frame 0), its own id, the frames and the tile ratio.
 * `ratios` are the frames' label ratios (ratioOf), passed in to keep this
 * module free of the content-flow import.
 */
export function makeSequence(id, frames, ratios, { cap = SEQUENCE_MAX_FRAMES } = {}) {
  const kept = frames.slice(0, cap);
  return { ...kept[0], _id: id, frames: kept, sequenceRatio: sequenceRatio(ratios.slice(0, kept.length)) };
}
