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
 * P3 = Enter World lands inside the world on the globe (enter).
 * 10-06 bake (Nathan's dial): tides on by default, all media, cap 13,
 * weighted shares, a 6 s ± 0.2 hold, a 0.9 s surge, chaos 1. The seed stays
 * random per visit (his call).
 * 10-06 = client-name strips (names, nameStyle — nameTicker.js).
 * 10-07 = their placement rework: the ticker is gone (the strips are still),
 * the span comes from the MEASURED name (nameSpanMin/nameSpanMax) instead of a
 * random width, the type is smaller (nameSize), and the director places each
 * world's strip camera-relative — mid-latitude (nameBand), front-facing
 * (nameFace), in the quadrant opposite the last world's — or across a whole
 * latitude row (nameMode=band). Starting values, not yet dialed.
 */
import { PATTERNS } from './worldPatterns.js';
import { WORLD_POOL_CAP } from './buildWorldPools.js';
import { NAME_STYLES, NAME_MODES } from './nameTicker.js';
import { DELAY_ORDERS } from './cascade.js';

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
export { PATTERNS as POP_PATTERNS, NAME_STYLES as POP_NAME_STYLES, NAME_MODES as POP_NAME_MODES };

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
  mode: 'tides', // ?popmode — off | tides (POP_MODES). Nathan 10-06: tides is home's globe
  seed: 0, // ?popseed — the draw (start world, patterns, the change clock); resolved per visit below
  media: 'all', // ?popmedia — showcase | all | video | still | art (MEDIA_KINDS)
  cap: 13, // ?popcap — assets per world, ≤ WORLD_POOL_CAP (bounds texture residency)
  share: 'weighted', // ?popshare — equal | weighted (tape area ∝ each world's media count)
  group: 1, // ?popgroup — worlds on the globe at once, 1..3 (Nathan 09-26: one)
  layout: 'mix', // ?poplayout — one world: mix | facets (POP_LAYOUTS)
  patterns: Object.freeze(['continents', 'archipelago', 'spiral']), // ?poppattern — 2–3 worlds: the set each grouping draws from (comma list)
  hold: 6, // ?pophold — seconds a world holds before the next
  holdJit: 0.2, // ?popholdjit — ± fraction of the hold, drawn per change
  trans: 0.9, // ?poptrans — seconds a change takes (a tide rolls a full span in it)
  transitions: Object.freeze(['surge']), // ?poptransset — the set changes draw from (comma list, POP_TRANSITIONS)
  chaos: 1, // ?popchaos — 0 = editorial order + the set in turn; 1 = a random next world + transition every change
  live: 'shared', // ?poplive — shared | tile (POP_LIVE)
  color: 1, // ?popcolor — 1 = the world's projectColor drives the globe + chrome; 0 = brand blue
  enter: 1, // ?popenter — 1 = Enter World opens /work on the world on the globe; 0 = the first World
  names: 1, // ?popnames — name strips a world places (0 = none)
  nameMode: 'region', // ?popnamemode — region = a run of tiles sized to the name; band = a whole latitude row (NAME_MODES)
  nameSize: 0.62, // ?popnamesize — font px per strip height (was a baked 0.86 — Nathan 10-07: "reduced slightly")
  nameBand: 0.65, // ?popnameband — the middle fraction of pole-to-pole a strip may sit in
  nameFace: 0.5, // ?popnameface — front-facing width as a fraction of the circumference (0.5 = the visible half)
  nameSpanMin: 2, // ?popnamespanmin — fewest tiles a strip may use
  nameSpanMax: 6, // ?popnamespanmax — most tiles a strip may use (at the cap the type shrinks, the name is never cut)
  nameStyle: 'ink', // ?popnamestyle — ink = the world's colour on black; fill = black on the colour
  // — Panel grain (10-07): the FP pager scrim's dialed turbulence, carried onto
  //   the globe as a placeholder where the pole pinch would otherwise show warped,
  //   cropped media. Ships OFF (grainAmt 0) for Nathan to dial. —
  grainAmt: 0, // ?popgrainamt — grain master mix; 0 = off, and the shader gates the whole branch on it
  grainCells: 3.5, // ?popgraincells — grain tile repeats across ONE panel; tile-local, so the pole pinch never scales the cells
  grainFps: 30, // ?popgrainfps — re-times the shipped 8-frame held jitter (scrimNoise GRAIN_JITTER); 0 = frozen, and forced 0 under reduced motion
  grainStart: 0.45, // ?popgrainstart — the vK (= sin θ_center) below which grain is at FULL strength; sibling units to ?polestart (0.4), so the grain hands off to the pole cap with no gap
  grainRamp: 0.15, // ?popgrainramp — width of the media handoff smoothstep, same vK units (a crossfade, not a hard line)
  grainStagger: 0.07, // ?popgrainstagger — per-tile threshold spread, so a row's tiles cross the reveal in order instead of blinking on together (a row is iso-latitude, so without this they ARE simultaneous)
  grainOrder: 'sweep', // ?popgrainorder — which panelDelay ordering the stagger follows (DELAY_ORDERS)
  grainLive: 0, // ?popgrainlive — 1 = the grain band also withholds live video (real decode saving in ?poplive=tile only; in shared mode it just changes which clips win)
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
  enter: ['popenter', (n) => (n > 0 ? 1 : 0)],
  names: ['popnames', (n) => clamp(Math.round(n), 0, 4)],
  nameSize: ['popnamesize', (n) => clamp(Math.round(n * 100) / 100, 0.3, 1.2)],
  nameBand: ['popnameband', (n) => clamp(Math.round(n * 100) / 100, 0.1, 1)],
  nameFace: ['popnameface', (n) => clamp(Math.round(n * 100) / 100, 0.05, 1)],
  nameSpanMin: ['popnamespanmin', (n) => clamp(Math.round(n), 1, 12)],
  nameSpanMax: ['popnamespanmax', (n) => clamp(Math.round(n), 1, 12)],
  grainAmt: ['popgrainamt', (n) => clamp(Math.round(n * 100) / 100, 0, 1)],
  grainCells: ['popgraincells', (n) => clamp(Math.round(n * 10) / 10, 0.25, 32)],
  grainFps: ['popgrainfps', (n) => clamp(Math.round(n), 0, 60)],
  grainStart: ['popgrainstart', (n) => clamp(Math.round(n * 100) / 100, 0.02, 0.95)],
  grainRamp: ['popgrainramp', (n) => clamp(Math.round(n * 100) / 100, 0.02, 0.6)],
  grainStagger: ['popgrainstagger', (n) => clamp(Math.round(n * 100) / 100, 0, 0.4)],
  grainLive: ['popgrainlive', (n) => (n > 0 ? 1 : 0)],
};
/* — Single-choice knobs (value ∈ vocab) and set knobs (comma lists ⊂ vocab). — */
const CHOICE = {
  mode: ['popmode', POP_MODES],
  media: ['popmedia', POP_MEDIA],
  share: ['popshare', POP_SHARES],
  layout: ['poplayout', POP_LAYOUTS],
  live: ['poplive', POP_LIVE],
  nameStyle: ['popnamestyle', NAME_STYLES],
  nameMode: ['popnamemode', NAME_MODES],
  grainOrder: ['popgrainorder', DELAY_ORDERS],
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
