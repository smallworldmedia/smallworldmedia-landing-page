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
  // ── the resting footer's on-load slide (10-08, Nathan: "slide up into
  //    position slightly on first page load… offset text animation just
  //    slightly to allow for slide up") ──
  //    The distance is a FRACTION OF THE PANEL'S OWN RESTING REVEAL, not a
  //    rem. 10-08 (Nathan): "we want the full globe to be in view on the page
  //    load, so the starting position of the footer needs to be lower before
  //    it slides up". What the start has to clear is `rest x panel-h -
  //    0.065 x vh`. The ring's diameter is `fill x (1+GLOBE_STROKE_FRAC) x
  //    cos(alpha) x MIN(vw, vh)` -- 0.87 x min on desktop, 0.988 x min on a
  //    phone -- centred at vh/2, so in LANDSCAPE (min = vh) its bottom sits at
  //    0.935 vh. In PORTRAIT the fit axis is WIDTH, so the radius stops
  //    shrinking with height while the centre vh/2 keeps falling: the overlap
  //    then grows about 1px per 2px of lost height. Either way it GROWS as the
  //    window shortens (measured 98.5px at 1440x900, 104.9 at 1280x800, 78.9
  //    at 1440x1200), so no fixed rem can hold it. As a fraction of the
  //    reveal the need is 0.63 / 0.66 / 0.50, rising to 0.71 at 1440x700 --
  //    always < 1, so 1 (the panel starting flush at the fold) clears the
  //    globe at EVERY viewport, width- or height-fit, while the footer stays
  //    ignorant of the globe's geometry. At a full 390x844 the phone does not
  //    overlap at all, so the slide there is pure entrance -- but browser
  //    chrome eats visible height, and past some height the resting panel does
  //    reach the ring, which is a `rest` question and not a slide one.
  //    THE PHONE FIGURES THAT STOOD HERE (panel top 77.5 vh, ~32px of overlap
  //    by ~700px, ?footerrest <= 0.51) were read off the PRE-SANITY 306px
  //    panel. The shorter blurb re-wrapped it to 281px (Hero.jsx), which moves
  //    every one of them -- and the ring's bottom in vh moves with the height
  //    too, because below 390px-square the fit axis is WIDTH. Rather than
  //    carry a stale chain, see ?footerrest in docs/tunables-guide.md for the
  //    current measured reading; the desktop fractions above are unaffected,
  //    and they are what sets slideK.
  slideK: 1,
  slideS: 0.7, // the rise's own duration (s) -- see the tween in SiteFooter
  slideLeadS: 0.12, // how long the word fade waits for the slide (s)
  bandFadeS: 0.55, // the band's MINIMUM fade-in (s) -- a floor, not a duration
  // ── the DESKTOP resting variant's layout (10-08, Nathan) ──
  //    The lockup is hidden here, so the inner's 08-29 min-height — built to
  //    reserve the fixed tagline stack — reserves a column this panel does
  //    not draw, and `align-items: flex-end` parked the blurb at the bottom
  //    of it: measured 64.90px from the panel's top to the blurb's first
  //    line where --footer-top-pad alone is 18.00px. Dropping the reserve
  //    lands it at exactly the pad, and what the reserve was really paying
  //    for (the fixed copyright's own box) moves BELOW the band, which is
  //    where the band now sits under this variant's order: 1.
  topPad: 1.286, // rem — mirrors the `--footer-rest-top-pad` fallback
  //    The band's foot clearance: --footer-bottom-inset + --lh-link +
  //    2 x --pill-pad-y + --space-6, i.e. the privacy pill's own box seated
  //    on the shared inset, plus one row gap. Measured: the pill overlapped
  //    the marks row by 25.97px and the copyright by 10.00px; this clears
  //    them by 12.02 and 27.99. Desktop only — at <=768px the lockup, the
  //    (c) line and the privacy pill are all display:none, so there is
  //    nothing down there to clear.
  tickerFoot: 4.427, // rem — mirrors the `--ticker-foot-clearance` fallback
  //    The one-line blurb's share of its own measure (10-08, Nathan: "scale
  //    up to maintain the full width of the viewport, beyond any viewport
  //    width… value that makes the blurb run on only one line"). See the
  //    global.css block for why the divisor is MEASURED and why a bare vw
  //    coefficient cannot do this. 1 is flush and tipped to two lines at
  //    1024w, so the bake keeps ~0.5% of the measure in hand.
  blurbFill: 0.995,
});

const PARAM_KEYS = {
  lockupRem: 'footerlockup',
  travelK: 'footertravel',
  liftK: 'footerlift',
  marksFrom: 'footermarksfrom',
  marksTo: 'footermarksto',
  marksLift: 'footermarkslift',
  introS: 'footerintro',
  slideK: 'footerslide',
  slideS: 'footerslides',
  slideLeadS: 'footerslidelead',
  bandFadeS: 'logofademin',
  topPad: 'footertoppad',
  tickerFoot: 'tickerfoot',
  blurbFill: 'footerblurbfill',
};

/* Keys where 0 is a LEGAL dialed value, not a typo. The seeder's `n > 0`
   guard is right for lockupRem/travelK/marksTo/introS — a zero there is a
   collapsed panel, no travel, a divide-by-zero window or an instant
   "entrance" — but it silently swallowed ?footerlift=0, which is the one
   way to answer "is the parallax carrying this?" by turning it off. Scoped
   per key rather than relaxed for everyone. */
/* The slide's three join them: ?footerslide=0 is the one way to see the
   entrance without the slide, ?footerslides=0 the one way to see the start
   pose with no travel time, and ?footerslidelead=0 the one way to see the
   text and the slide start together. */
/* topPad/tickerFoot join them: 0 is how you see the pose this round fixed —
   the blurb hard against the panel's top edge, the band flush with its foot.
   blurbFill does NOT -- and no longer for the reason first written here. The
   10-08 max() floor means ?footerblurbfill=0 resolves to the 1.4rem baseline,
   not to a collapsed blurb; it stays out because every value at or below
   ~0.863 at 1440w is ALREADY clamped by that floor and therefore inert, so
   admitting 0 would only publish a dial position that cannot do anything.
   bandFadeS joins the set: 0 is the one way to see the band without the
   minimum fade. */
const ZERO_OK = new Set([
  'liftK',
  'marksFrom',
  'marksLift',
  'slideK',
  'slideS',
  'slideLeadS',
  'topPad',
  'tickerFoot',
  'bandFadeS', // 0 = no floor, dial the fade off
]);

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

/** The resting footer's on-load word fade — duration AND stagger budget, s.
    The slide used to borrow this; it carries its own `slideS` since 10-08,
    because a full-reveal rise is ~9x the travel this number was sized for. */
export const getFooterIntroS = () => state.introS;

/** How far the resting panel slides up into place on a first load, as a
    fraction of its own resting reveal (1 = it starts flush at the fold). */
export const getFooterSlideK = () => state.slideK;
/** That rise's own duration, s. */
export const getFooterSlideS = () => state.slideS;
/** How long the word fade waits for that slide, s. */
export const getFooterSlideLeadS = () => state.slideLeadS;
/* Seconds, read at paint time like the slide's own timings and deliberately
   out of CSS_KNOBS: the gate is a clock the JS walks, not a value CSS can
   hold. 0 removes the floor entirely (ZERO_OK). */
export const getLogoFadeMinS = () => state.bandFadeS;

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
  /* All three are declared ONLY in a var() fallback, never on an element, so
     an inline <html> value actually reaches them. --footer-top-pad itself is
     declared on `.site-footer__inner` (global.css), where the element's own
     declaration would beat anything inherited from <html> — hence the
     variant reads its own `--footer-rest-top-pad` instead of dialing that. */
  topPad: ['--footer-rest-top-pad', 'rem'],
  tickerFoot: ['--ticker-foot-clearance', 'rem'],
  blurbFill: ['--footer-blurb-fill', ''],
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
