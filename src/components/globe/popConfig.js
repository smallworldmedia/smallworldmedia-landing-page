/**
 * popConfig.js — live tuning state for the home globe's POPULATION MODES
 * (docs/globe-worlds-plan.md): the featured-project worlds laid over the
 * meridian scroll, so the globe reads as client worlds instead of a sample of
 * the media directory.
 *
 * Every knob seeds from the URL — always, not only under the bench, the
 * heroConfig convention (?popmode=tides works on its own) — into the mutable
 * TUNING object. ?poptune=1 mounts the PopTunePanel bench, which writes
 * TUNING through setPopTune → publish(key). useGlobeScene subscribes: a mode
 * change rebuilds the PopulationDirector (never the scene), poplive swaps the
 * scheduler's video mode, a layout knob re-lays the current world, anything
 * else is read at use time. popTuneCopyUrl() serializes the off-default values
 * plus the seed (the seed is what reproduces the globe on screen).
 *
 * P1 = the engine + holds (mode, seed, media, cap, share, group, patterns).
 * P2 (09-26, Nathan: ONE world at a time reads strongest — group defaults to
 * 1) = the timed change between worlds (hold, holdJit, trans, transitions,
 * chaos), the one-world layout, shared video streams (live) and the world's
 * projectColor on the globe + chrome (color).
 */
import { IS_MOBILE } from './globeConfig.js';
import { PATTERNS } from './worldPatterns.js';
import { WORLD_POOL_CAP } from './buildWorldPools.js';

const search = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const POP_TUNE_ACTIVE = search().get('poptune') === '1';

/* — Vocabulary (the URL seed validates against these; the bench selects
   from them). Modes join the list as their phases land. — */
export const POP_MODES = ['off', 'tides'];
export const POP_MEDIA = ['showcase', 'all', 'video', 'still', 'art'];
export const POP_SHARES = ['equal', 'weighted'];
/** One world on the globe: mix = its media interleaved (no asset on a
 *  neighbour); facets = regions by media kind (the world read as a system). */
export const POP_LAYOUTS = ['mix', 'facets'];
/** How one world gives way to the next: tide = the scroll surges a full
 *  pole-to-pole span, the new world pours in from the top pole as the old
 *  drains out the bottom (persistent — no tile changes in place); blink /
 *  surge = in place, each tile under a CRT dip / a flood of the accent;
 *  cut = at once. */
export const POP_TRANSITIONS = ['tide', 'blink', 'surge', 'cut'];
/** shared = one decoded stream feeds every tile showing that clip; tile = one
 *  decode per live tile (today's scheduler). */
export const POP_LIVE = ['shared', 'tile'];
export { PATTERNS as POP_PATTERNS };

/** popmedia → the media kinds a world's pool keeps (null = its whole pool:
 *  hero + showcase Tiles + album art). showcase = the /work World's Tiles —
 *  videos and stills, no album art. */
export const MEDIA_KINDS = {
  showcase: ['video', 'still'],
  all: null,
  video: ['video'],
  still: ['still'],
  art: ['art'],
};

// A fresh draw per visit unless ?popseed pins it (resolved once, at load).
const randomSeed = () => Math.floor(Math.random() * 1e6);

export const POP_DEFAULTS = Object.freeze({
  mode: 'off', // ?popmode — off | tides (POP_MODES)
  seed: 0, // ?popseed — the draw (start world, patterns, the change clock); resolved per visit below
  media: 'showcase', // ?popmedia — showcase | all | video | still | art (MEDIA_KINDS)
  cap: IS_MOBILE ? 16 : 24, // ?popcap — assets per world, ≤ WORLD_POOL_CAP (bounds texture residency)
  share: 'equal', // ?popshare — equal | weighted (tape area ∝ each world's media count)
  group: 1, // ?popgroup — worlds on the globe at once, 1..3 (Nathan 09-26: one)
  layout: 'mix', // ?poplayout — one world: mix | facets (POP_LAYOUTS)
  patterns: Object.freeze(['continents', 'archipelago', 'spiral']), // ?poppattern — 2–3 worlds: the set each grouping draws from (comma list)
  hold: 8, // ?pophold — seconds a world holds before the next
  holdJit: 0.3, // ?popholdjit — ± fraction of the hold, drawn per change
  trans: 2.4, // ?poptrans — seconds a change takes (a tide rolls a full span in it)
  transitions: Object.freeze(['tide']), // ?poptransset — the set changes draw from (comma list, POP_TRANSITIONS)
  chaos: 0.35, // ?popchaos — 0 = editorial order + the set in turn; 1 = a random next world + transition every change
  live: 'shared', // ?poplive — shared | tile (POP_LIVE)
  color: 1, // ?popcolor — 1 = the world's projectColor drives the globe + chrome; 0 = brand blue
});

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/* — URL param names + the clamp each NUMERIC knob stores through. — */
const NUMERIC = {
  seed: ['popseed', (n) => Math.abs(Math.round(n))],
  cap: ['popcap', (n) => clamp(Math.round(n), 1, WORLD_POOL_CAP)],
  group: ['popgroup', (n) => clamp(Math.round(n), 1, 3)],
  hold: ['pophold', (n) => clamp(n, 2, 60)],
  holdJit: ['popholdjit', (n) => clamp(n, 0, 0.9)],
  trans: ['poptrans', (n) => clamp(n, 0.3, 8)],
  chaos: ['popchaos', (n) => clamp(n, 0, 1)],
  color: ['popcolor', (n) => (n > 0 ? 1 : 0)],
};
/* — Single-choice knobs (value ∈ vocab) and set knobs (comma lists ⊂ vocab). — */
const CHOICE = {
  mode: ['popmode', POP_MODES],
  media: ['popmedia', POP_MEDIA],
  share: ['popshare', POP_SHARES],
  layout: ['poplayout', POP_LAYOUTS],
  live: ['poplive', POP_LIVE],
};
const SETS = {
  patterns: ['poppattern', PATTERNS],
  transitions: ['poptransset', POP_TRANSITIONS],
};

// Live, mutable tuning state (the bench writes, the director reads).
export const TUNING = { ...POP_DEFAULTS, seed: randomSeed() };

if (typeof window !== 'undefined') {
  const p = search();
  for (const [key, [param, store]] of Object.entries(NUMERIC)) {
    const n = parseFloat(p.get(param));
    if (Number.isFinite(n)) TUNING[key] = store(n);
  }
  for (const [key, [param, vocab]] of Object.entries(CHOICE)) {
    const v = p.get(param);
    if (vocab.includes(v)) TUNING[key] = v;
  }
  for (const [key, [param, vocab]] of Object.entries(SETS)) {
    const list = (p.get(param) || '').split(',').filter((n) => vocab.includes(n));
    if (list.length) TUNING[key] = Object.freeze([...new Set(list)]);
  }
}

/* pub/sub — useGlobeScene subscribes; the key tells it what to redo. */
const subs = new Set();
export function subscribePopTune(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function publish(key) {
  subs.forEach((fn) => fn(key));
}

export function setPopTune(key, value) {
  let v = value;
  if (NUMERIC[key]) v = NUMERIC[key][1](value);
  else if (SETS[key]) v = Object.freeze([...value]);
  if (TUNING[key] === v) return;
  TUNING[key] = v;
  publish(key);
}

/** Back to the defaults — the seed and mode stay (a reset re-dials the look,
 *  it doesn't reroll the globe or switch the population off under you). */
export function resetPopTune() {
  const { seed, mode } = TUNING;
  Object.assign(TUNING, POP_DEFAULTS, { seed, mode });
  publish('*');
}

export const rerollSeed = () => setPopTune('seed', randomSeed());

/** Shareable bench URL — poptune=1, the seed, and only off-default values. */
export function popTuneCopyUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('poptune', '1');
  for (const [key, [param]] of Object.entries(NUMERIC)) {
    if (key === 'seed' || TUNING[key] !== POP_DEFAULTS[key]) p.set(param, String(TUNING[key]));
    else p.delete(param);
  }
  for (const [key, [param]] of Object.entries(CHOICE)) {
    if (TUNING[key] !== POP_DEFAULTS[key]) p.set(param, TUNING[key]);
    else p.delete(param);
  }
  for (const [key, [param]] of Object.entries(SETS)) {
    const val = TUNING[key].join(',');
    if (val !== POP_DEFAULTS[key].join(',')) p.set(param, val);
    else p.delete(param);
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
