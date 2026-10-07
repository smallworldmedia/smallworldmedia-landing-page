/**
 * footerTune.js — the footer reveal channel's DEV-ONLY live tuning state (the
 * ?footertune=1 bench — FooterTunePanel, mounted by SiteShell, top-left) plus
 * the one piece of channel MATH both the broadcaster and the probe need: the
 * reveal normalized against its resting floor (footerRise / footerSpan below).
 * Knobs, in the lenisTune pub/sub shape:
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
 * MOBILE HOME ([data-footer-rest], 10-07) — the resting footer's own four.
 * They are the footer channel's knobs, so they live here beside the other
 * two rather than in ClientLogoTicker's dial block:
 *
 *   liftK     — the fraction of the panel's own climb the hero follows, as
 *               `--footer-lift-k`. Nathan: "have the globe and Enter World
 *               button scroll up slightly, maybe at half the rate of the
 *               actual scroll" — 0.5 is that "maybe", so it is a dial and
 *               not a bake. 0 turns the parallax off (see ZERO_OK).
 *   marksFrom /
 *   marksTo /
 *   marksLift — the client marks' own fade+settle window over
 *               `--footer-rise-peak` (`--footer-marks-from/-to/-lift`); the
 *               ?logofrom/?logoto shape, one tier in from the band's.
 *
 * URL params (`?footerlockup=<rem>`, `?footertravel=<K>`, `?footerlift=<k>`,
 * `?footermarksfrom`, `?footermarksto`, `?footermarkslift=<rem>`,
 * `?footerintro=<s>`) seed the state on load — with or without the bench
 * open, so a copied link previews the dialed values. copy_url emits only
 * non-defaults. Bake path: paste the blessed numbers into
 * FOOTER_TUNE_DEFAULTS / the global.css fallback.
 */

/* ── The reveal, normalized against its resting floor ─────────────────────
   The footer channel's progress is ABSOLUTE 0..1, and on mobile home it
   rests at ?footerrest (0.62) — never at 0. Everything that must be ABSENT
   in the resting pose (the hero parallax, the client marks) needs the
   reveal measured from that floor instead, which is the only number nobody
   held: broadcastReveal is the one place in the codebase with both the
   progress and the rest, and it used to throw the rest away.

   rest = 0 ⇒ rise === progress and span === 1, so desktop, /work and the
   detail footers are byte-identical.

   Computed in JS, never as a `:root` calc: `calc((reveal - rest) / (1 -
   rest))` divides by zero at the legal dial value ?footerrest=1 and goes
   invalid at computed-value time, silently killing the consumer's WHOLE
   declaration. The ternary costs one branch and has no edge case. Pure and
   exported so scripts/test/footer-reveal.test.mjs can hold it. */
/** 0 in the resting pose, 1 at a full reveal. */
export const footerRise = (progress, rest = 0) =>
  rest >= 1 ? 1 : Math.min(1, Math.max(0, (progress - rest) / (1 - rest)));
/** The travel the floor left, in panel heights — rise × span × panelH is the
    panel's own climb in px, so a consumer can convert the rise back to px. */
export const footerSpan = (rest = 0) => Math.min(1, Math.max(0, 1 - rest));

export const FOOTER_TUNE_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('footertune') === '1';

export const FOOTER_TUNE_DEFAULTS = Object.freeze({
  lockupRem: 3.2, // mirrors the global.css `--footer-lockup-h` fallback
  travelK: 1.8, // reveal travel = K × panel height of scroll (1 = old feel)
  // ── mobile home ([data-footer-rest]) ──
  liftK: 0.5, // mirrors the global.css `--footer-lift-k` fallback
  marksFrom: 0.6, // mirrors `--footer-marks-from` — MEASURED, see the guide
  marksTo: 0.9, // mirrors `--footer-marks-to`
  marksLift: 1.25, // mirrors `--footer-marks-lift` (rem)
  introS: 0.45, // the on-load word fade's duration AND stagger budget (s)
});

const PARAM_KEYS = {
  lockupRem: 'footerlockup',
  travelK: 'footertravel',
  liftK: 'footerlift',
  marksFrom: 'footermarksfrom',
  marksTo: 'footermarksto',
  marksLift: 'footermarkslift',
  introS: 'footerintro',
};

/* Keys where 0 is a LEGAL dialed value, not a typo. The seeder's `n > 0`
   guard is right for lockupRem/travelK/marksTo/introS — a zero there is a
   collapsed panel, no travel, a divide-by-zero window or an instant
   "entrance" — but it silently swallowed ?footerlift=0, which is the one
   way to answer "is the parallax carrying this?" by turning it off. Scoped
   per key rather than relaxed for everyone. */
const ZERO_OK = new Set(['liftK', 'marksFrom', 'marksLift']);

// Live, mutable tuning state (panel writes; SiteFooter + the cascade read).
const state = { ...FOOTER_TUNE_DEFAULTS };

// Seed from the URL so a copied tuning link reopens/previews in the same shape.
if (typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const raw = p.get(param);
    if (raw == null) continue;
    const n = parseFloat(raw);
    if (Number.isFinite(n) && (n > 0 || ZERO_OK.has(key))) state[key] = n;
  }
}

export const getFooterTuneState = () => state;

/** Reveal-travel multiplier — SiteFooter sizes its spacer by this. */
export const getFooterTravelK = () => state.travelK;

/** The resting footer's on-load word fade — duration AND stagger budget, s. */
export const getFooterIntroS = () => state.introS;

/* The knobs that reach the cascade: state key → [custom property, unit].
   The shipped default lives in the CSS FALLBACK, so a value at its default
   REMOVES the property rather than pinning it — the inline <html> style
   stays inert for everyone off the bench. (introS never reaches CSS: the
   entrance is a GSAP timeline and reads getFooterIntroS() at fire time.) */
const CSS_KNOBS = {
  lockupRem: ['--footer-lockup-h', 'rem'],
  liftK: ['--footer-lift-k', ''],
  marksFrom: ['--footer-marks-from', ''],
  marksTo: ['--footer-marks-to', ''],
  marksLift: ['--footer-marks-lift', 'rem'],
};

/** Push every dialed knob onto the cascade (no-op at defaults). */
export function applyFooterTune() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  for (const [key, [prop, unit]] of Object.entries(CSS_KNOBS)) {
    if (Math.abs(state[key] - FOOTER_TUNE_DEFAULTS[key]) > 1e-9) {
      root.setProperty(prop, `${state[key]}${unit}`);
    } else {
      root.removeProperty(prop);
    }
  }
}
// Apply any URL-seeded values immediately (no-op at defaults) — and re-apply
// after a soft nav. These are inline <html> properties and the Astro
// ClientRouter REPLACES <html> wholesale on a swap (the 08-25 attribute-wipe
// rule), so every knob here was lost on the first soft nav until a slider
// moved — the latent bug the tunables guide records for ?footerlockup. One
// re-assert closes it for the whole family.
if (typeof window !== 'undefined') {
  applyFooterTune();
  document.addEventListener('astro:after-swap', applyFooterTune);
}

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
