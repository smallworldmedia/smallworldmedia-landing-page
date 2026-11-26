/**
 * lenisTune.js — DEV-ONLY live tuning bench for the house SCROLL FEEL (Lenis):
 * the A2b dial. Gated behind `?lenistune=1` (LENIS_TUNE_ACTIVE); inert without
 * it, so shipped scroll stays smoothScroll's default (LENIS_TUNING, empty
 * today). This is a bench, not a shipped surface — the deliverable is the
 * `export const LENIS_TUNING = {…}` block copy_values emits, which Nathan
 * pastes into motion.js to bake the feel.
 *
 * Live, not reload: Lenis reads `this.options.lerp / .duration /
 * .wheelMultiplier / .easing` on every wheel event (lenis.mjs §631-635, §356),
 * so a slider mutating `getLenis().options.*` registers on the next scroll —
 * no page reload, the only way to actually FEEL a lerp change. The tune
 * re-applies on every `astro:page-load` because start() rebuilds Lenis per
 * route (smoothScroll.js); the panel lives in the persistent SiteShell, so a
 * dialed feel survives project→project navigation.
 *
 * Param names mirror smoothScroll's existing dial (`?lerp` / `?wheelmult` /
 * `?lenisdur`) on purpose: a copy_url link both reopens the panel in the same
 * shape AND feeds start()'s constructor, so the very first scroll after load is
 * already tuned. Voice/chrome mirror the fp1Tune bench (mono, near-black).
 */
import { getLenis } from './smoothScroll.js';

export const LENIS_TUNE_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('lenistune') === '1';

/* Lenis (1.3.x) library defaults — the values the panel opens on and copy_url
   diffs against. `duration` 0 = OFF (lerp inertia mode); > 0 switches Lenis to
   duration mode in SECONDS, which OVERRIDES lerp — same rule as `?lenisdur`. */
export const LENIS_DEFAULTS = Object.freeze({
  lerp: 0.1,
  wheelMultiplier: 1,
  duration: 0,
});

/* URL param names for copy_url / seed-on-load — the same keys smoothScroll's
   start() reads, so a tuning URL stays coherent whether or not lenistune runs. */
const PARAM_KEYS = {
  lerp: 'lerp',
  wheelMultiplier: 'wheelmult',
  duration: 'lenisdur',
};

/* Lenis' own default easing (lenis.mjs §373). The constructor only assigns it
   when `duration` is a number at build time; smoothScroll builds with neither,
   so runtime duration mode must supply an easing itself or advance() falls back
   to lerp (`if (this.duration && this.easing)`). */
const DEFAULT_EASING = (t) => Math.min(1, 1.001 - 2 ** (-10 * t));

// Live, mutable tuning state (panel writes, applyLenisTune drives Lenis).
const state = { ...LENIS_DEFAULTS };

// Seed from the URL so a copied tuning link reopens in the same shape.
if (LENIS_TUNE_ACTIVE && typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const raw = p.get(param);
    if (raw == null) continue;
    const n = parseFloat(raw);
    // > 0 only, matching smoothScroll: a negative lerp diverges and a negative
    // duration pins eased progress at 0 (unscrollable); 0 is meaningless.
    if (Number.isFinite(n) && n > 0) state[key] = n;
  }
}

export const getLenisTuneState = () => state;

/** True when Lenis is driving the current route (null on /work + reduced motion). */
export const isLenisLive = () => getLenis() != null;

/**
 * Push the current state onto the LIVE Lenis instance. No-op when Lenis is off
 * (returns false so the panel can show "off here"). duration 0 → clear duration
 * AND easing so Lenis is back to clean lerp inertia; > 0 → duration mode, with
 * the default easing seeded if smoothScroll left none.
 */
export function applyLenisTune() {
  const lenis = getLenis();
  if (!lenis) return false;
  lenis.options.lerp = state.lerp;
  lenis.options.wheelMultiplier = state.wheelMultiplier;
  if (state.duration > 0) {
    lenis.options.duration = state.duration;
    if (typeof lenis.options.easing !== 'function') lenis.options.easing = DEFAULT_EASING;
  } else {
    lenis.options.duration = undefined;
    lenis.options.easing = undefined;
  }
  return true;
}

/* pub/sub — the panel subscribes to re-render its status/mode readout. */
const subs = new Set();
export function subscribeLenisTune(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function publish() {
  subs.forEach((fn) => fn());
}

export function setLenisTune(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  applyLenisTune();
  publish();
}
export function resetLenisTune() {
  Object.assign(state, LENIS_DEFAULTS);
  applyLenisTune();
  publish();
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

/** Current mode, for the panel readout. */
export function lenisMode() {
  return state.duration > 0
    ? `duration ${round4(state.duration)}s (overrides lerp)`
    : `lerp ${round4(state.lerp)}`;
}

/** The LENIS_TUNING block Nathan pastes into motion.js to bake the feel. */
export function lenisCopyBlock() {
  const s = state;
  const lines = [];
  if (s.duration > 0) {
    lines.push(
      `  duration: ${round4(s.duration)}, // seconds — Lenis duration mode; overrides lerp (Lenis applies its default easing unless you pass one)`,
    );
  } else {
    lines.push(`  lerp: ${round4(s.lerp)},`);
  }
  lines.push(`  wheelMultiplier: ${round4(s.wheelMultiplier)},`);
  return `export const LENIS_TUNING = {\n${lines.join('\n')}\n};`;
}

/** Shareable tuning URL — lenistune=1 plus only the params that differ / apply. */
export function lenisTuneUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('lenistune', '1');
  // Mode knob: duration wins when on (it overrides lerp), else lerp if dialed.
  p.delete('lerp');
  p.delete('lenisdur');
  if (state.duration > 0) {
    p.set('lenisdur', String(round4(state.duration)));
  } else if (Math.abs(state.lerp - LENIS_DEFAULTS.lerp) > 1e-9) {
    p.set('lerp', String(round4(state.lerp)));
  }
  if (Math.abs(state.wheelMultiplier - LENIS_DEFAULTS.wheelMultiplier) > 1e-9) {
    p.set('wheelmult', String(round4(state.wheelMultiplier)));
  } else {
    p.delete('wheelmult');
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}

// Re-apply on every route swap: start() rebuilds Lenis per route without the
// live values (the ClientRouter drops the query string), so the dialed feel
// would reset on navigation. rAF defers past start() — both run inside the
// astro:page-load handler and listener order isn't guaranteed.
if (LENIS_TUNE_ACTIVE && typeof document !== 'undefined') {
  document.addEventListener('astro:page-load', () => {
    requestAnimationFrame(() => {
      applyLenisTune();
      publish(); // refresh the panel's live/off readout for the new route
    });
  });
}
