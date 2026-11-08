/**
 * blurbHoldMath — the arithmetic and the dials of the phone blurb hold
 * (SQ-26 11-07, reworked SQ-27 11-07; the engine is blurbHold.js). Pure, so
 * scripts/test/blurb-hold.test.mjs pins it without a browser.
 *
 * Units: px and ms (a velocity is px/ms), a rate is per ms. Geometry is a
 * section's rect against the viewport's: `top` is its getBoundingClientRect()
 * top, `h` its height, `vh` the viewport's height, `scrollY` where the page is
 * now, `max` the farthest it can go. `dir` is the page's direction of travel,
 * +1 = down the document.
 */

/** The reading sections are CSS, on every phone-width page. */
export const PHONE_MQ = '(max-width: 768px)';
/** The hold also needs a finger: a narrow desktop window has sections but no hold. */
export const HOLD_MQ = `${PHONE_MQ} and (pointer: coarse)`;
/** The next media a seated section leaves showing below it, as a fraction of the
    viewport (Nathan 11-07: "retain the same percent of the upcoming media being
    visible at the bottom"; ?blurbpeek re-dials it). A section is 1 - peek tall. */
export const BLURB_PEEK = 0.1;
/** px a seated page may drift before it stops counting as seated (NextProjectBand's atEnd tolerance). */
export const SEAT_TOL_PX = 2;
/** A catch lands when the page is within this many px of the seat (then it snaps). */
export const SNAP_PX = 0.5;
/** iOS's native momentum, UIScrollView .normal: the velocity keeps this fraction per ms. */
export const MOMENTUM_DECAY = 0.998;
/** px/ms under which a momentum has stopped. */
export const MIN_V = 0.01;
/** Share of the viewport a section must cover for a resting page to be eased onto its seat. */
export const REST_COVER = 0.5;
/** Share of a section (or the viewport, whichever is smaller) that must be on screen for its entrance to play at rest. */
export const SHOWN_COVER = 0.25;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ── geometry: top-seated sections ── */

/** The page position that seats a section: its top on the viewport's top. */
export const seatY = (top, scrollY, max) => clamp(scrollY + top, 0, max);

/**
 * Can the page hold on this section? Only a section that fits the seat window
 * the CSS gives it ((1 - peek) of the viewport, its top under the nav, the next
 * media peeking below). A taller one (long copy, a short phone) would trap copy
 * the hold does not let the page scroll to: it is seated at its top and read
 * with native scroll.
 */
export const holdable = (h, vh, peek = BLURB_PEEK) => h <= (1 - peek) * vh + SEAT_TOL_PX;

/** px of a section on screen. */
export const shownPx = (top, h, vh) => Math.max(0, Math.min(top + h, vh) - Math.max(top, 0));

/** Is enough of the section on screen for its entrance to play where the page rests? */
export const shownEnough = (top, h, vh) => shownPx(top, h, vh) >= SHOWN_COVER * Math.min(h, vh);

/**
 * The seat a page travelling `dir` meets next: of the sections' seat
 * positions (page y that seats each), the nearest strictly ahead of `y`.
 * A seat the page has just left is behind it, so it is never caught again
 * until the direction reverses. Returns the index, or -1.
 */
export function nextSeat(seats, y, dir) {
  let best = -1;
  for (let i = 0; i < seats.length; i++) {
    const ahead = (seats[i] - y) * dir;
    if (ahead <= SEAT_TOL_PX) continue;
    if (best < 0 || ahead < (seats[best] - y) * dir) best = i;
  }
  return best;
}

/* ── arrival: the footer's slowdown, velocity-continuous ── */

/**
 * The damp's rate, per ms. Lenis's own λ = lerp × 60 per s (lenis.mjs `damp`,
 * as footerTune.js footerDamp has it), so the lerp means here what it means to
 * the page's scroll and the driven footer: LENIS_TUNING.lerp, ?blurbcatch.
 */
export const catchOmega = (lerp) => (Math.min(lerp, 1) * 60) / 1000;

/**
 * Take the page now? `d` is the px left to the seat ahead (> 0), `v` the page's
 * speed toward it (px/ms). A damp toward the seat started at distance v / ω has
 * exactly speed v, so it is the farthest the slowdown can begin without a
 * velocity step. The frame look-ahead (`frameMs`, the cadence the check runs
 * at) makes the check land on the last frame that is still that far or
 * farther, so the seat is taken at d >= v / ω rather than a frame past it.
 */
export const shouldCatch = (d, v, omega, frameMs) =>
  d > SEAT_TOL_PX && v > 0 && omega > 0 && d <= v / omega + v * frameMs;

/**
 * The speed the slowdown starts at: the page's own, but never more than ω·d,
 * which is what a critically damped spring can start at without overshooting
 * (it is also what the damp starts at). Zero for a page at rest.
 */
export const catchStartV = (d, v, omega) => Math.max(0, Math.min(v, omega * d));

/**
 * A critically damped spring (ω) toward the seat: the footer's damp, but with
 * a start velocity of its own, so a page already moving carries on at its speed
 * and a page at rest starts from zero velocity (a damp from rest would jump to
 * ω·d at once). `e0` = signed px from the seat, `v0` = signed px/ms toward it.
 * e(t) = (e0 + (v0 + ω e0) t) e^-ωt; it never crosses zero when |v0| <= ω|e0|.
 * @returns {{ e: number, v: number }} the offset from the seat and the velocity at t ms
 */
export function springAt(e0, v0, omega, t) {
  const decay = Math.exp(-omega * t);
  const k = v0 + omega * e0;
  return { e: (e0 + k * t) * decay, v: (v0 - omega * k * t) * decay };
}

/* ── exit: natural momentum ── */

/** τ of the exponential: the velocity falls by 1/e every τ ms (iOS: 499.5ms at 0.998). */
export const momentumTau = (decay = MOMENTUM_DECAY) => -1 / Math.log(decay);

/** One momentum step of `dt` ms: the new velocity and the distance covered. */
export function momentumStep(v, dt, decay = MOMENTUM_DECAY) {
  const next = v * Math.pow(decay, dt);
  return { v: next, dy: (v - next) * momentumTau(decay) };
}

/** Where a release velocity v (px/ms) ends up if nothing stops it: v·τ. */
export const momentumDistance = (v, decay = MOMENTUM_DECAY) => v * momentumTau(decay);

/** A velocity average: the first sample stands, then each pulls the average `alpha` of the way. */
export const emaVelocity = (avg, sample, alpha = 0.4) => (avg === 0 ? sample : avg + (sample - avg) * alpha);

/**
 * The preview dials, read from a URL search string:
 *   ?blurbhold=0         the hold off (plain sections); default on
 *   ?blurbpeek=<f>       the media left showing below a seat, a fraction of the viewport; default BLURB_PEEK
 *   ?blurbcatch=<lerp>   the arrival slowdown's lerp (0…1]; default LENIS_TUNING.lerp
 *   ?blurbdecel=<f>      the exit momentum's per-ms velocity factor (0…1); default MOMENTUM_DECAY
 *   ?scroll=<px>         the commit trigger, shared with /work and the next-project band
 * @returns {{ hold: boolean, peek: number|null, catchLerp: number|null, decel: number|null, trigger: number|null }} null = unset
 */
export function readBlurbTune(search) {
  const q = new URLSearchParams(search);
  const num = (k) => {
    const n = parseFloat(q.get(k));
    return Number.isFinite(n) ? n : null;
  };
  const within = (n, lo, hi) => (n != null && n > lo && n < hi ? n : null);
  const peek = num('blurbpeek');
  const catchLerp = num('blurbcatch');
  const trigger = num('scroll');
  return {
    hold: num('blurbhold') !== 0,
    peek: within(peek, 0, 1),
    catchLerp: catchLerp != null && catchLerp > 0 ? Math.min(catchLerp, 1) : null,
    decel: within(num('blurbdecel'), 0, 1),
    trigger: trigger != null && trigger > 0 ? trigger : null,
  };
}
