/**
 * popConfig.js — live tuning state for the home globe's POPULATION MODES
 * (docs/globe-worlds-plan.md): the featured-project worlds laid over the
 * meridian scroll in irregular clusters, so the globe reads as client worlds
 * instead of a sample of the media directory.
 *
 * Every knob seeds from the URL — always, not only under the bench, the
 * heroConfig convention (?popmode=tides works on its own) — into the mutable
 * TUNING object. ?poptune=1 mounts the PopTunePanel bench, which writes
 * TUNING through setPopTune → publish(key). useGlobeScene subscribes: a mode
 * change rebuilds the PopulationDirector (never the scene), a layout knob
 * re-lays the current grouping, anything else is read at use time.
 * popTuneCopyUrl() serializes the off-default values plus the seed (the seed
 * is what reproduces the globe on screen).
 *
 * Sections land with their phases: P1 = the engine + Tides holds (mode,
 * seed, media, cap, share, group, patterns).
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
  seed: 0, // ?popseed — the draw (grouping start, patterns); resolved per visit below
  media: 'showcase', // ?popmedia — showcase | all | video | still | art (MEDIA_KINDS)
  cap: IS_MOBILE ? 16 : 24, // ?popcap — assets per world, ≤ WORLD_POOL_CAP (bounds texture residency)
  share: 'equal', // ?popshare — equal | weighted (tape area ∝ each world's media count)
  group: 2, // ?popgroup — worlds per grouping, 1..3
  patterns: Object.freeze(['continents', 'archipelago', 'spiral']), // ?poppattern — the set each grouping draws from (comma list)
});

/* URL param names — NUMERIC knobs; the vocab knobs ride the *_PARAM names. */
const PARAM_KEYS = {
  seed: 'popseed',
  cap: 'popcap',
  group: 'popgroup',
};
const MODE_PARAM = 'popmode';
const MEDIA_PARAM = 'popmedia';
const SHARE_PARAM = 'popshare';
const PATTERN_PARAM = 'poppattern';

const clampCap = (n) => Math.min(Math.max(Math.round(n), 1), WORLD_POOL_CAP);
const clampGroup = (n) => Math.min(Math.max(Math.round(n), 1), 3);

// Live, mutable tuning state (the bench writes, the director reads).
export const TUNING = { ...POP_DEFAULTS, seed: randomSeed() };

if (typeof window !== 'undefined') {
  const p = search();
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const n = parseFloat(p.get(param));
    if (!Number.isFinite(n)) continue;
    if (key === 'cap') TUNING.cap = clampCap(n);
    else if (key === 'group') TUNING.group = clampGroup(n);
    else TUNING.seed = Math.abs(Math.round(n));
  }
  const mode = p.get(MODE_PARAM);
  if (POP_MODES.includes(mode)) TUNING.mode = mode;
  const media = p.get(MEDIA_PARAM);
  if (POP_MEDIA.includes(media)) TUNING.media = media;
  const share = p.get(SHARE_PARAM);
  if (POP_SHARES.includes(share)) TUNING.share = share;
  const pats = (p.get(PATTERN_PARAM) || '').split(',').filter((n) => PATTERNS.includes(n));
  if (pats.length) TUNING.patterns = Object.freeze([...new Set(pats)]);
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
  if (key === 'cap') v = clampCap(value);
  else if (key === 'group') v = clampGroup(value);
  else if (key === 'patterns') v = Object.freeze([...value]);
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
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    if (key === 'seed' || TUNING[key] !== POP_DEFAULTS[key]) p.set(param, String(TUNING[key]));
    else p.delete(param);
  }
  const vocab = [
    [MODE_PARAM, TUNING.mode, POP_DEFAULTS.mode],
    [MEDIA_PARAM, TUNING.media, POP_DEFAULTS.media],
    [SHARE_PARAM, TUNING.share, POP_DEFAULTS.share],
    [PATTERN_PARAM, TUNING.patterns.join(','), POP_DEFAULTS.patterns.join(',')],
  ];
  for (const [param, val, def] of vocab) {
    if (val !== def) p.set(param, val);
    else p.delete(param);
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
