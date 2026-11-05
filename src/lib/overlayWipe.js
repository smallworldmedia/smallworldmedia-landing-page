/**
 * overlayWipe — THE overlay wipe (09-08, Nathan: one choreography for every
 * wipe-in overlay — the project inquiry, the mobile menu, the privacy page).
 *
 * In: the surface wipes UP from the bottom edge on the house Turn curve
 * (TURN_EASE_PATH). Out: the INVERSE wipe — erased back down to the bottom
 * edge, never a fade. autoAlpha brackets the wipe so `visibility` keeps
 * gating pointer events while closed (clip-path alone does not).
 *
 * CustomEase names are global — register the curve once, here.
 */
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from '../components/work/world/worldConfig.js';

export const OVERLAY_WIPE_EASE = 'overlayWipe';
export const ensureOverlayWipe = () => {
  if (!CustomEase.get(OVERLAY_WIPE_EASE)) CustomEase.create(OVERLAY_WIPE_EASE, TURN_EASE_PATH);
  return OVERLAY_WIPE_EASE;
};

export const CLIP_OPEN = 'inset(0% 0 0 0)';
export const CLIP_CLOSED = 'inset(100% 0 0 0)'; // hidden at the bottom edge — opens upward
// The flipped edge (11-03, /work's [PREVIOUS]): the BOTTOM edge travels up to
// the top — for chrome that leaves toward the top of the screen.
export const CLIP_OPEN_UP = 'inset(0 0 0% 0)';
export const CLIP_CLOSED_UP = 'inset(0 0 100% 0)';

export const WIPE_IN_S = 0.45;
export const WIPE_OUT_S = 0.35;

/** Append the wipe-in to `tl` (creates one if absent). Returns the timeline.
 *  `closed`/`open` pick the edge (CLIP_CLOSED_UP → CLIP_OPEN_UP: the inverse
 *  of wipeOut's up-edge exit); `closed: null` runs from the current clip — a
 *  re-entry caught mid-wipe-out reverses from where it is. */
export function wipeIn(el, tl = gsap.timeline(), duration = WIPE_IN_S, closed = CLIP_CLOSED, open = CLIP_OPEN) {
  if (PREFERS_REDUCED_MOTION) {
    const to = { autoAlpha: 1, duration: 0.35, ease: 'power2.out', overwrite: true };
    if (closed) tl.fromTo(el, { autoAlpha: 0 }, to);
    else tl.to(el, to);
    return tl;
  }
  tl.set(el, closed ? { autoAlpha: 1, clipPath: closed, overwrite: true } : { autoAlpha: 1, overwrite: true });
  tl.to(el, { clipPath: open, duration, ease: ensureOverlayWipe() });
  return tl;
}

/** The inverse wipe out; autoAlpha drops once it lands. Returns the timeline.
 *  `closed` picks the edge (CLIP_CLOSED_UP from a CLIP_OPEN_UP start). */
export function wipeOut(el, duration = WIPE_OUT_S, closed = CLIP_CLOSED) {
  if (PREFERS_REDUCED_MOTION) {
    return gsap.timeline().to(el, { autoAlpha: 0, duration: 0.3, ease: 'power2.inOut', overwrite: true });
  }
  return gsap
    .timeline()
    .to(el, { clipPath: closed, duration, ease: ensureOverlayWipe(), overwrite: true })
    .set(el, { autoAlpha: 0 });
}
