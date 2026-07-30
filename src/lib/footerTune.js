/**
 * footerTune.js — DEV-ONLY live tuning state for the sticky-reveal footer:
 * the ?footertune=1 bench (FooterTunePanel, mounted by SiteShell, top-left).
 * Two knobs, in the lenisTune pub/sub shape:
 *
 *   lockupRem — height of the SWM lockup art (rem) → written to
 *               `--footer-lockup-h` on <html>; the CSS fallback (3.2rem in
 *               global.css) IS the shipped default, so the property is only
 *               set while a non-default value is dialed. The lockup height
 *               drives panel height → spacer height → reveal travel;
 *               SiteFooter's ResizeObserver re-measures automatically.
 *   travelK   — reveal-travel multiplier: the spacer reserves K × panel-height
 *               of scroll, so the footer rises over a longer, one-natural-
 *               scroll-motion stretch instead of parking partway (the
 *               halfway-scoot fix, half b). SiteFooter reads it via
 *               getFooterTravelK() and re-sizes on publish.
 *
 * URL params (`?footerlockup=<rem>`, `?footertravel=<K>`) seed the state on
 * load — with or without the bench open, so a copied link previews the dialed
 * values. copy_url emits only non-defaults. Bake path: paste the blessed
 * numbers into FOOTER_TUNE_DEFAULTS / the global.css fallback.
 */

export const FOOTER_TUNE_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('footertune') === '1';

export const FOOTER_TUNE_DEFAULTS = Object.freeze({
  lockupRem: 3.2, // mirrors the global.css `--footer-lockup-h` fallback
  travelK: 1.8, // reveal travel = K × panel height of scroll (1 = old feel)
});

const PARAM_KEYS = {
  lockupRem: 'footerlockup',
  travelK: 'footertravel',
};

// Live, mutable tuning state (panel writes; SiteFooter + the cascade read).
const state = { ...FOOTER_TUNE_DEFAULTS };

// Seed from the URL so a copied tuning link reopens/previews in the same shape.
if (typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const raw = p.get(param);
    if (raw == null) continue;
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) state[key] = n;
  }
}

export const getFooterTuneState = () => state;

/** Reveal-travel multiplier — SiteFooter sizes its spacer by this. */
export const getFooterTravelK = () => state.travelK;

/**
 * Push the lockup height onto the cascade. The shipped default lives in the
 * CSS fallback, so at-default we REMOVE the property rather than pin it —
 * keeps the inline style inert for everyone off the bench.
 */
export function applyFooterTune() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  if (Math.abs(state.lockupRem - FOOTER_TUNE_DEFAULTS.lockupRem) > 1e-9) {
    root.setProperty('--footer-lockup-h', `${state.lockupRem}rem`);
  } else {
    root.removeProperty('--footer-lockup-h');
  }
}
// Apply any URL-seeded lockup height immediately (no-op at defaults).
if (typeof window !== 'undefined') applyFooterTune();

/* pub/sub — SiteFooter re-measures its spacer on travelK changes; the panel
   re-renders its readouts. */
const subs = new Set();
export function subscribeFooterTune(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function publish() {
  subs.forEach((fn) => fn());
}

export function setFooterTune(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  applyFooterTune();
  publish();
}
export function resetFooterTune() {
  Object.assign(state, FOOTER_TUNE_DEFAULTS);
  applyFooterTune();
  publish();
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Shareable tuning URL — footertune=1 plus only the non-default knobs. */
export function footerTuneUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('footertune', '1');
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    if (Math.abs(state[key] - FOOTER_TUNE_DEFAULTS[key]) > 1e-9) {
      p.set(param, String(round2(state[key])));
    } else {
      p.delete(param);
    }
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
