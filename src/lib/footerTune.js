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
 *   lerp      — the WHEEL's weight where a host drives the panel (home, and
 *               /work's last World; 10-31): the damp per 60 Hz frame by which
 *               the painted reveal follows its target, Lenis's own
 *               (createFooterDrive in SiteFooter). It defaults to the house's
 *               baked Lenis lerp (LENIS_TUNING in motion.js), so the footer
 *               weighs what a document scroll does; 0 = the raw delta, the
 *               feel before it.
 *   brake     — the tail's brake on that target (footerBrakeStep below): over
 *               the last third of the rise a revealing delta's share falls,
 *               quadratically, to 1 − brake at the full reveal; 0 = off.
 *   touchGain /
 *   touchBrake — home's FINGER on that reveal (SQ-115; touch-only, home-only,
 *               baked 11-17, Nathan): the finger px → gesture px (its own
 *               number, 2, apart from the house TOUCH_GAIN that /work and
 *               /process keep) and the same tail made symmetric for a finger
 *               (footerTensionStep); touchBrake 0 = the plain clamp.
 *   touchLerp — the finger's follow (SQ-115 pass 2; baked 11-17, Nathan): the
 *               finger moves a TARGET, the panel following on the ticker once
 *               per frame by the wheel's own damp, so a slowed finger paints
 *               one even step a frame instead of one per touchmove; 0 = the
 *               raw finger painted on the touchmove.
 *
 * HOME ([data-footer-rest], 10-07; desktop too since 10-09) — the resting
 * footer's own four.
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
 * URL params (`?footerlockup=<rem>`, `?footertravel=<K>`, `?footerlerp=<lerp>`,
 * `?footerbrake=<b>`, `?footertouchgain=<g>`, `?footertouchbrake=<b>`, `?footertouchlerp=<l>`, `?footerlift=<k>`,
 * `?footermarksfrom`, `?footermarksto`, `?footermarkslift=<rem>`,
 * `?footerintro=<s>`) seed the state on load — with or without the bench
 * open, so a copied link previews the dialed values. copy_url emits only
 * non-defaults. Bake path: paste the blessed numbers into
 * FOOTER_TUNE_DEFAULTS / the global.css fallback.
 */

/* ── The reveal, normalized against its resting floor ─────────────────────
   The footer channel's progress is ABSOLUTE 0..1, and on home it rests at
   ?footerrest (0.59 on phones, 0.40 on desktop since 10-31) — never at 0. Everything that must be ABSENT
   in the resting pose (the hero parallax, the client marks) needs the
   reveal measured from that floor instead, which is the only number nobody
   held: broadcastReveal is the one place in the codebase with both the
   progress and the rest, and it used to throw the rest away.

   rest = 0 ⇒ rise === progress and span === 1, so /work, /process, the
   detail footers and ?footerrest=0 are byte-identical.

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

/* ── The nav slide's progress on a short page (11-14, Nathan: "when i select a
   client from the filter area on the project directory, the nav bar
   disappears") ─────────────────────────────────────────────────────────────
   The nav bar leaves as the footer arrives (global.css, F1), on the raw
   reveal. A page shorter than the fold has its footer in view before any
   scroll, so its reveal starts above 0 (`floor`: the progress at the top of
   the scroll) and the bar was gone on arrival: all of it on a page that fits
   the viewport (a client with one tile), part of it on one that nearly does.
   Measured from that floor the slide is 0 at the top of every page and 1 at
   its end. floor = 0 (any page taller than the fold plus the footer's travel)
   gives the reveal itself. floor = 1 is a page that cannot scroll: the bar
   stays, where footerRise would call the reveal complete. */
/** 0 at the top of the page's scroll, 1 at a full reveal. */
export const navSlide = (progress, floor = 0) => (floor >= 1 ? 0 : footerRise(progress, floor));

/* ── The driven reveal's weight (10-31, Nathan: "we need to implement some
   sort of weight to the scrolling when you reveal the full footer with the
   client logos. Right now, it's very sudden and slightly jarring. if there is
   a way to implement lenis here, and have just a bit of ease at the tail end
   of the scroll so it 'pumps the brakes'") ─────────────────────────────────
   The math createFooterDrive (SiteFooter) runs, pure so the test holds it. */
/** Lenis's damp (lenis.mjs `damp`: lerp(x, to, 1 − e^(−λ·dt)), λ = lerp × 60,
    dt in s), so a lerp means here what it means to Lenis, at any frame rate.
    lerp ≤ 0 lands at once. */
export const footerDamp = (x, to, lerp, dt) =>
  lerp > 0 ? x + (to - x) * (1 - Math.exp(-Math.min(lerp, 1) * 60 * dt)) : to;
/** The share of the rise the tail brake works over: its last third. */
export const FOOTER_BRAKE_TAIL = 1 / 3;
/** The target after a delta `dp` (in progress) from `p`, clamped to [rest, 1].
    A retracting delta moves it plainly. A revealing one brakes in the tail:
    there d rise / d u = 1 − b·s², s running 0 → 1 across the tail and u being
    the delta in rise units. Solved in closed form (u = T·atanh(√b·s)/√b), so a
    delta of any size lands where the same distance in small steps would: a
    mouse notch brakes as a trackpad's stream of deltas does. At b 0.5 the
    tail asks 1.25× its distance, about 8% more wheel for the whole reveal. */
export function footerBrakeStep(p, dp, rest = 0, brake = 0) {
  return dp > 0 ? footerTensionStep(p, dp, rest, brake) : Math.min(1, Math.max(rest, p + dp));
}

/** The same tail, symmetric: a finger's version of footerBrakeStep (SQ-115,
    home's touch path). A finger must round-trip (up d px, down d px puts the
    panel back), so a delta of either sign moves a coordinate U that is plain
    below the tail and the brake's own stretch inside it: U = r0 + T·atanh(k·
    (rise − r0)/T)/k, k = √b, r0 = 1 − T. The panel reads U back through tanh,
    so the tail asks the finger for more going up and hands it back going down.
    Clamped to [rest, 1]; b 0 is exactly that clamp. Closed form, like the
    brake: one big delta lands where many small ones of the same total do. */
export function footerTensionStep(p, dp, rest = 0, tension = 0) {
  const span = footerSpan(rest);
  const b = Math.min(0.9, Math.max(0, tension));
  if (!(b > 0) || !(span > 0)) return Math.min(1, Math.max(rest, p + dp));
  const T = FOOTER_BRAKE_TAIL;
  const k = Math.sqrt(b);
  const r0 = 1 - T;
  const rise = footerRise(p, rest);
  const u = (rise > r0 ? r0 + (T * Math.atanh((k * (rise - r0)) / T)) / k : rise) + dp / span;
  const out = u > r0 ? Math.min(1, r0 + (T * Math.tanh((k * (u - r0)) / T)) / k) : Math.max(0, u);
  return rest + out * span;
}

/* ── The driven reveal's follower (10-31 wheel; SQ-115 pass 2 adds the finger) ──
   The ticker loop createFooterDrive (SiteFooter) runs, here so a test can hold
   it with a fake ticker. A delta moves a TARGET through its lane's step, and the
   painted progress follows on the ticker by footerDamp at the lane's lerp, once
   per frame. A lane is that pair: the WHEEL's (footerBrakeStep, ?footerlerp) and
   home's FINGER's (footerTensionStep, ?footertouchlerp, default 0 = the raw
   finger, painted on the touchmove as before). */
export const FOOTER_WHEEL = {
  step: (p, dp, rest) => footerBrakeStep(p, dp, rest, getFooterBrake()),
  lerp: () => getFooterLerp(),
};
export const FOOTER_FINGER = {
  step: (p, dp, rest) => footerTensionStep(p, dp, rest, getFooterTouchBrake()),
  lerp: () => getFooterTouchLerp(),
};
/** `ticker` is gsap's: add(fn) / remove(fn), fn(time, deltaMs). */
export function makeFooterDrive(set, rest, ticker) {
  let value = rest;
  let target = rest;
  let running = false;
  let lane = FOOTER_WHEEL;
  const stop = () => {
    if (running) ticker.remove(tick);
    running = false;
  };
  function tick(_time, deltaMs) {
    value = footerDamp(value, target, lane.lerp(), Math.min(deltaMs, 100) / 1000);
    if (Math.abs(target - value) < 1e-4) {
      value = target;
      stop();
    }
    set(value);
  }
  return {
    /** A delta in progress units (px / the host's trigger px), taken from the
        painted progress `from` when the drive is at rest. */
    add(dp, from, nextLane = FOOTER_WHEEL) {
      lane = nextLane;
      if (!running) value = target = from;
      target = lane.step(target, dp, rest);
      if (!(lane.lerp() > 0)) {
        // lerp 0: the raw delta, painted with it (the wheel before 10-31; the finger today)
        stop();
        value = target;
        set(value);
      } else if (!running && target !== value) {
        running = true;
        ticker.add(tick);
      }
    },
    stop,
    /** Where the reveal is headed: the target while the drive runs, else `from`. */
    goal: (from) => (running ? target : from),
  };
}

export const FOOTER_TUNE_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('footertune') === '1';

export const FOOTER_TUNE_DEFAULTS = Object.freeze({
  lockupRem: 3.2, // mirrors the global.css `--footer-lockup-h` fallback
  travelK: 1.8, // reveal travel = K × panel height of scroll (1 = old feel)
  // ── the driven hosts' wheel (home, /work's last World; 10-31, Nathan) ──
  lerp: 0.165, // mirrors LENIS_TUNING.lerp (motion.js): the house's baked Lenis feel (the test holds the two equal); 0 = the raw delta
  brake: 0.5, // the tail brake's strength, b (footerBrakeStep); 0 = off. A pick, flagged for Nathan 10-31
  // ── home's FINGER on that reveal (SQ-115; touch-only, home-only) ──
  touchGain: 2, // finger px → gesture px, home's own (the house TOUCH_GAIN is 5). Nathan 11-17
  touchBrake: 0.5, // the same tail, symmetric (footerTensionStep), under the finger; 0 = the plain clamp. Nathan 11-17
  touchLerp: 0.35, // the finger moves a target and the panel follows on the ticker (footerDamp), once per frame; 0 = the raw finger. Nathan 11-17
  // ── home rest ([data-footer-rest], both tiers since 10-09) ──
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
  //    window shortens (measured at 1440x900, 1280x800, 1440x1200 and
  //    1440x700 on the panel BEFORE the Sanity blurb re-wrapped it, so the
  //    figures are retired, not restated), so no fixed rem can hold it. As a
  //    fraction of the reveal the need stayed under 1 at every viewport
  //    measured, so 1 (the panel starting flush at the fold) clears the
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
  lerp: 'footerlerp',
  brake: 'footerbrake',
  touchGain: 'footertouchgain',
  touchBrake: 'footertouchbrake',
  touchLerp: 'footertouchlerp',
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
   minimum fade. lerp and brake join it too (10-31): ?footerlerp=0 is the raw
   delta the wheel drove before, and ?footerbrake=0 the target with no brake. */
const ZERO_OK = new Set([
  'lerp',
  'brake',
  'touchBrake', // 0 = the finger's plain clamp (touchGain stays out: 0 would pin the panel)
  'touchLerp', // 0 = the raw finger painted on the touchmove
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

/** The driven hosts' wheel weight and tail brake (createFooterDrive), read per
    frame and per delta, so the bench's sliders act on the next wheel event. */
export const getFooterLerp = () => state.lerp;
export const getFooterBrake = () => state.brake;

/** Home's finger on the reveal (SQ-115), read per touch event so the bench's
    sliders act on the next touchmove. The gain is home's own number (2); the
    house TOUCH_GAIN no longer reaches the home footer. The brake is
    footerTensionStep's b; 0 = the plain clamp. */
export const getFooterTouchGain = () => state.touchGain;
export const getFooterTouchBrake = () => state.touchBrake;
/** The finger's follow, a lerp as ?footerlerp is (the lane's `lerp`, read per frame). */
export const getFooterTouchLerp = () => state.touchLerp;

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
