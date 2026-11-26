/**
 * ctaNames — the pure logic behind /work's [PREVIOUS] / [NEXT] chips reading
 * the NEIGHBOURING client names (SQ-80, Nathan 11-13). Kept out of the JSX so
 * node --test can reach it (scripts/test/cta-names.test.mjs).
 *
 *   ctaNamesOn(search)          ?ctanames=0 restores the words (the A/B); on by default
 *   neighbourName(...)          the name the chip should read, or the kept/empty fallback
 *   rollGeometry(...)           whether the name overflows its label box, and if so the
 *                               marquee's shift / duration / wall-clock phase
 */

// The marquee's trailing gap, per copy, in em. Both the CSS (padding-right on
// each copy, so the two-copy track's -50% travel is exactly copy + gap) and
// the duration below read it — one number, passed to the CSS as --cta-name-gap.
export const NAME_GAP_EM = 1.5;

// 1px of slack: offsetWidth/clientWidth are whole pixels, so a name a hair
// wider than the box (a 14px phone "BEDOUIN" is 62.6 in a 62.3 box) measures
// 63 against 62 — that is a fit (it clips a side-bearing), not a ticker.
const FIT_SLACK_PX = 1;

/** ?ctanames=0 (or off/false) restores the words; anything else — names. */
export function ctaNamesOn(search) {
  const v = new URLSearchParams(search ?? '').get('ctanames');
  return !(v === '0' || v === 'off' || v === 'false');
}

/**
 * The client name `step` Worlds from `index` (-1 previous, +1 next), or `kept`
 * when there is none. The [PREVIOUS] chip wipes OUT at World 0 while still
 * mounted, so the caller passes the last real name as `kept` and the label
 * holds through the wipe instead of blanking.
 */
export function neighbourName(worlds, index, step, kept = '') {
  const name = worlds?.[index + step]?.clientName;
  return typeof name === 'string' && name.trim() ? name.trim() : kept;
}

/**
 * Overflow + marquee geometry for one name. `textW` = the single copy's width,
 * `windowW` = the label box, `gapPx` = NAME_GAP_EM at the label's font size,
 * `pxs` = roll speed in unscaled px/s (the pager's --scale-fill-pxs), `nowMs`
 * = performance.now().
 *
 * A name that fits returns { rolls: false } — centred, still. A wider one
 * returns the loop: `shiftPx` is exactly one copy plus one gap (the two-copy
 * track's -50% travel), `durS` runs it at `pxs`, and `delayS` is the negative
 * wall-clock phase (r11h) so a remount lands mid-roll instead of at zero.
 */
export function rollGeometry({ textW, windowW, gapPx, pxs, nowMs }) {
  if (!(textW > 0) || !(windowW > 0) || textW <= windowW + FIT_SLACK_PX) return { rolls: false };
  const shiftPx = textW + gapPx;
  const durS = shiftPx / Math.max(pxs, 1);
  return {
    rolls: true,
    shiftPx,
    durS,
    delayS: -((nowMs / 1000) % durS),
  };
}
