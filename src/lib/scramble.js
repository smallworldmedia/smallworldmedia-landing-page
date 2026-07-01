/**
 * scramble — the house in-place text scramble (chrome kit).
 *
 * One char set, one entry point, shared by WorldCard's PROJECT_## reveal
 * and the detail-page chrome (deck tabs, orbit front caption). Reduced
 * motion degrades to an instant text set.
 */
import { gsap } from 'gsap';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';

gsap.registerPlugin(ScrambleTextPlugin);

/** Dancing-symbol set for scramble reveals. */
export const SCRAMBLE_CHARS = '01<>[]{}/\\|=+*#%░▒▓█—';

/**
 * Scramble `el`'s text to `text` in place. Returns the tween (or null
 * under reduced motion, where the text just snaps).
 */
export function scrambleTo(el, text, { duration = 0.5, speed = 0.8 } = {}) {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    el.textContent = text;
    return null;
  }
  return gsap.to(el, {
    duration,
    ease: 'none',
    scrambleText: { text, chars: SCRAMBLE_CHARS, speed },
  });
}
