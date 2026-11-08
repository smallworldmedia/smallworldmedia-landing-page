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
/** The detail blurbs' text scale TARGET on a phone, a multiple of --text-blurb (SQ-28 11-07, Nathan:
    "increase the size of the description text on mobile"). A proposal: Nathan bakes the number;
    ?blurbtext re-dials it. The fit lowers it per page until every blurb sits inside its seat window. */
export const BLURB_TEXT = 1.25;
/** Measurements the fit may take (measure, guess, measure, guess, measure). */
export const FIT_PASSES = 3;
/** A re-guess aims this far under the fit: lines rewrap, so height is only roughly s². */
export const FIT_MARGIN = 0.97;
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
export const holdable = (h, vh, peek = BLURB_PEEK) => h <= seatWindow(vh, peek);

/** The tallest a section may be and still be held: the seat window plus the seat tolerance. */
export const seatWindow = (vh, peek = BLURB_PEEK) => (1 - peek) * vh + SEAT_TOL_PX;

/**
 * The text scale one page's blurbs share (SQ-28): `target`, or the largest
 * scale under it at which the tallest blurb (content height, min-height
 * disregarded) still fits `win` (seatWindow of the SMALL viewport, so the hold
 * works in either iOS toolbar state). `heightAt(s)` measures that tallest
 * height at scale s. Height grows about with s² (lines rewrap), so each pass
 * re-guesses from its own measurement; at most `passes` measurements, and the
 * answer is a scale that measured as fitting. Floor 1, today's size (or the
 * target, when that is lower): a blurb that does not fit even there stays read
 * natively, as before.
 */
export function fitTextScale(heightAt, win, target = BLURB_TEXT, passes = FIT_PASSES) {
  const floor = Math.min(1, target);
  let s = target;
  for (let i = 0; i < passes; i++) {
    const h = heightAt(s);
    if (!Number.isFinite(h)) return floor;
    if (h <= win) return s;
    if (s <= floor) return floor;
    s = Math.max(floor, s * Math.sqrt(win / h) * FIT_MARGIN);
  }
  return floor;
}

/** Does a section's seat coincide with the document's end? (a seat clamps to the end when the section sits within the last viewport) */
export const seatAtEnd = (seat, max) => Math.abs(seat - max) <= SEAT_TOL_PX;

/** The scroll position a sample can mean: an overscroll at either end (iOS's bounce) is not movement. */
export const clampScroll = (y, max) => clamp(y, 0, max);

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
 *   ?blurbtext=<f>       the detail blurbs' text scale target, a multiple of --text-blurb (0 < f <= 3); default BLURB_TEXT, lowered per page to fit
 *   ?blurbend=0          the page's end is not an arrival target (no slowdown onto it); default on
 *   ?blurbcatch=<lerp>   the arrival slowdown's lerp (0…1]; default LENIS_TUNING.lerp
 *   ?blurbdecel=<f>      the exit momentum's per-ms velocity factor (0…1); default MOMENTUM_DECAY
 *   ?scroll=<px>         the commit trigger, shared with /work and the next-project band
 * @returns {{ hold: boolean, end: boolean, peek: number|null, text: number|null, catchLerp: number|null, decel: number|null, trigger: number|null }} null = unset
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
  const text = num('blurbtext');
  return {
    hold: num('blurbhold') !== 0,
    end: num('blurbend') !== 0,
    peek: within(peek, 0, 1),
    text: text != null && text > 0 && text <= 3 ? text : null,
    catchLerp: catchLerp != null && catchLerp > 0 ? Math.min(catchLerp, 1) : null,
    decel: within(num('blurbdecel'), 0, 1),
    trigger: trigger != null && trigger > 0 ? trigger : null,
  };
}
