/**
 * colorScheme — the ONE module that decides the site's colour scheme (US-7).
 *
 * Four presets: `project` (today's site), `black` (monochrome), `blue` (every
 * project colour is brand blue) and `spectrum` (ribbons on black). CSS reads
 * only `html[data-scheme]`; canvases listen only to the `swm:scheme` window
 * event; a scheme change never re-renders React and writes nothing but
 * `data-scheme`. `useScheme()` exists for the picker widget's label alone.
 *
 * Runtime state lives in ONE place the inline pre-paint latch in BaseLayout.astro
 * shares: `window.__swmScheme = { applied, committed }`. `applied` is what the
 * page shows (a live preview included); `committed` is the last non-preview
 * choice (the stored one, never a `?scheme=` preview). The latch creates it
 * before first paint; this module only reads and writes it, resolving window,
 * document and localStorage lazily so importing it is side-effect free and
 * SSR-safe (Astro frontmatter imports `spectrumDeal` at build time).
 *
 * Every localStorage access is in a try/catch: a private window throws, and the
 * pick then applies for the page and falls back to `project` on the next load.
 * The privacy notice names this one stored value (11-14).
 */
import { useSyncExternalStore } from 'react';
import { projectInk } from './projectColor.js';

export const SCHEMES = ['project', 'black', 'blue', 'spectrum'];
export const DEFAULT_SCHEME = 'project';
export const SCHEME_STORAGE_KEY = 'swm:scheme';
export const SCHEME_EVENT = 'swm:scheme';

/** The five dealt palette colours of color-ref.png and the ink each one carries. */
export const SPECTRUM = {
  blue: { fill: '#1556e5', fg: '#ffffff' },
  red: { fill: '#fd361a', fg: '#0a0a0a' },
  green: { fill: '#077b3e', fg: '#ffffff' },
  yellow: { fill: '#fbb702', fg: '#0a0a0a' },
  periwinkle: { fill: '#a6bcda', fg: '#0a2577' },
};

/** Measured area shares of color-ref.png (ratios, not percentages of anything else). */
export const SPECTRUM_SHARES = { blue: 13.0, red: 12.0, green: 10.6, yellow: 6.2, periwinkle: 5.0 };

export const isScheme = (v) => SCHEMES.includes(v);

/** The shared state, created on first touch when the latch did not run. null on the server. */
function state() {
  if (typeof window === 'undefined') return null;
  const s = window.__swmScheme;
  if (s && typeof s === 'object') return s;
  return (window.__swmScheme = { applied: DEFAULT_SCHEME, committed: DEFAULT_SCHEME });
}

/** The applied scheme, a live preview included. */
export function getScheme() {
  const s = state();
  return s && isScheme(s.applied) ? s.applied : DEFAULT_SCHEME;
}

/** The last non-preview scheme (what is stored, or `project`). */
export function getCommittedScheme() {
  const s = state();
  return s && isScheme(s.committed) ? s.committed : DEFAULT_SCHEME;
}

/**
 * Apply `name`. A preview changes only what the page shows; a commit also becomes
 * the stored choice. An invalid name, or a call that changes nothing (same applied
 * scheme, same preview-ness), writes and dispatches nothing. Returns the applied name.
 */
export function setScheme(name, { preview = false } = {}) {
  const s = state();
  if (!s || !isScheme(name)) return getScheme();
  const prev = getScheme();
  const changed = preview ? prev !== name : prev !== name || getCommittedScheme() !== name;
  if (!changed) return prev;
  s.applied = name;
  document.documentElement.dataset.scheme = name;
  if (!preview) {
    s.committed = name;
    try {
      window.localStorage.setItem(SCHEME_STORAGE_KEY, name);
    } catch {
      /* private window / storage blocked: the pick applies for this page only */
    }
  }
  if (typeof CustomEvent === 'function') {
    window.dispatchEvent(new CustomEvent(SCHEME_EVENT, { detail: { scheme: name, prev, preview } }));
  }
  return name;
}

/** Subscribe to scheme changes; fn({ scheme, prev, preview }). Returns the unsubscribe. */
export function onScheme(fn) {
  if (typeof window === 'undefined') return () => {};
  const h = (e) => fn(e.detail);
  window.addEventListener(SCHEME_EVENT, h);
  return () => window.removeEventListener(SCHEME_EVENT, h);
}

const subscribe = (cb) => onScheme(cb);
const serverSnapshot = () => DEFAULT_SCHEME;
/** React hook for the picker widget's label ONLY: colour is CSS on data-scheme, never this. */
export function useScheme() {
  return useSyncExternalStore(subscribe, getScheme, serverSnapshot);
}

// Smooth weighted round-robin over the shares as integers (x10, sum 468), so a full
// cycle of 468 deals is exact and any prefix is stable. Built once, on first use.
let cycle = null;
function spectrumCycle() {
  if (cycle) return cycle;
  const keys = Object.keys(SPECTRUM_SHARES);
  const w = keys.map((k) => Math.round(SPECTRUM_SHARES[k] * 10));
  const sum = w.reduce((a, b) => a + b, 0);
  const run = w.map(() => 0);
  cycle = [];
  for (let i = 0; i < sum; i++) {
    let best = 0;
    for (let j = 0; j < keys.length; j++) {
      run[j] += w[j];
      if (run[j] > run[best]) best = j;
    }
    run[best] -= sum;
    cycle.push(keys[best]);
  }
  return cycle;
}

/** The palette key dealt to the project at `index` of the /work order. Pure. */
export function spectrumKeyAt(index) {
  const c = spectrumCycle();
  const n = Math.floor(Number(index));
  return c[(((Number.isFinite(n) ? n : 0) % c.length) + c.length) % c.length];
}

/** { slug: key } by position in `slugs`. */
export function spectrumDeal(slugs) {
  const out = {};
  slugs.forEach((slug, i) => {
    out[slug] = spectrumKeyAt(i);
  });
  return out;
}

const spectrumPair = (world) =>
  Object.hasOwn(SPECTRUM, world?.spectrum) ? SPECTRUM[world.spectrum] : SPECTRUM.blue;

/** The accent a canvas paints a world with, per scheme. world = { projectColor, spectrum }. */
export function schemeAccent(world, scheme = getScheme()) {
  if (scheme === 'black') return '#000000';
  if (scheme === 'blue') return '#0000ff';
  if (scheme === 'spectrum') return spectrumPair(world).fill;
  return world?.projectColor;
}

/** Ink for text ON schemeAccent: the pair's fg under spectrum, else the YIQ split. */
export function schemeInk(world, scheme = getScheme()) {
  if (scheme === 'spectrum') return spectrumPair(world).fg;
  return projectInk(schemeAccent(world, scheme));
}
