/**
 * blurbHoldMath — the arithmetic and the dials of the phone blurb hold
 * (SQ-26, 11-07; the engine is blurbHold.js). Pure, so
 * scripts/test/blurb-hold.test.mjs pins it without a browser.
 *
 * Geometry is a section's rect against the viewport's: `top` / `h` are the
 * section's getBoundingClientRect() top and height, `vh` the viewport's
 * height, `scrollY` where the page is now, `max` the farthest it can go.
 */

/** The 80% reading sections are CSS, on every phone-width page. */
export const PHONE_MQ = '(max-width: 768px)';
/** The hold also needs a finger: a narrow desktop window has sections but no hold. */
export const HOLD_MQ = `${PHONE_MQ} and (pointer: coarse)`;
/** Nathan's 11-07: "80% scroll sections" (?blurbsec re-dials it). */
export const BLURB_SEC = 0.8;
/** px a seated page may drift before it stops counting as seated (NextProjectBand's atEnd tolerance). */
export const SEAT_TOL_PX = 2;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/** The section's centre, measured from the viewport's (0 = seated). */
export const centreOffset = (top, h, vh) => top + h / 2 - vh / 2;

/** The page position that seats a section: its centre on the viewport's. */
export const seatY = (top, h, vh, scrollY, max) => clamp(scrollY + top + h / 2 - vh / 2, 0, max);

/**
 * Where a commit glides to: forward (+1) puts the section's bottom edge at
 * the viewport's top (the next content leads), backward (-1) puts its top
 * edge at the viewport's bottom (the previous content fills the screen).
 */
export const commitY = (dir, top, h, vh, scrollY, max) =>
  clamp(dir > 0 ? scrollY + top + h : scrollY + top - vh, 0, max);

/**
 * A scroll that moved the page from `dPrev` to `dCur` (centre offsets)
 * carried the section's centre across the viewport's. Leaving the seat
 * (dPrev = 0) is not a crossing; landing on it is.
 */
export const crossedCentre = (dPrev, dCur) => (dPrev > 0 && dCur <= 0) || (dPrev < 0 && dCur >= 0);

/**
 * The preview dials, read from a URL search string:
 *   ?blurbhold=0     the hold off (plain 80% sections); default on
 *   ?blurbsec=<f>    the section height as a fraction of the viewport; default BLURB_SEC
 *   ?scroll=<px>     the commit trigger, shared with /work and the next-project band
 * @returns {{ hold: boolean, sec: number|null, trigger: number|null }} null = unset
 */
export function readBlurbTune(search) {
  const q = new URLSearchParams(search);
  const num = (k) => {
    const n = parseFloat(q.get(k));
    return Number.isFinite(n) ? n : null;
  };
  const sec = num('blurbsec');
  const trigger = num('scroll');
  return {
    hold: num('blurbhold') !== 0,
    sec: sec != null && sec > 0 ? sec : null,
    trigger: trigger != null && trigger > 0 ? trigger : null,
  };
}
