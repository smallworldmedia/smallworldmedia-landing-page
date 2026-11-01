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

/* House scramble pace — the cadence of a terminal working-indicator (per
   Nathan: the Claude Code ascii shimmer). One token SET, consumed by every
   scramble site-wide (scrambleTo + WorldCard's PROJECT_## tab).

   09-09 round 2 (Nathan, after verifying the /process chrome and the FP
   card's tab were running the same choreography): they were — same duration,
   same speed, same char set — except the card alone passed a revealDelay
   that scrambleTo never did. That beat is a TOKEN now, so the two are
   identical rather than merely alike, and the whole reveal is FASTER: the
   window drops 1.4s → 0.85s.

   The speed token rises with it on purpose. gsap's scrambleText refresh rate
   scales with `speed`, so holding 0.25 over a shorter window would thin the
   shimmer out to a few sparse flickers; 0.4 × 0.85 ≈ 0.25 × 1.4, which keeps
   the SAME number of character changes — the cadence Nathan dialled — and
   just spends them sooner. Every scramble on the site rides these: the FP
   card tab, the detail chrome, the hero chips, the /process token and its
   Thread captions. */
export const SCRAMBLE_DURATION = 0.85; // s, full reveal
export const SCRAMBLE_SPEED = 0.4; // char refresh rate (gsap scrambleText)
export const SCRAMBLE_REVEAL_DELAY = 0.06; // s held on pure symbols before real chars land

/**
 * Scramble `el`'s text to `text` in place. Returns the tween (or null
 * under reduced motion, where the text just snaps).
 */
export function scrambleTo(
  el,
  text,
  {
    duration = SCRAMBLE_DURATION,
    speed = SCRAMBLE_SPEED,
    revealDelay = SCRAMBLE_REVEAL_DELAY,
  } = {}
) {
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
    scrambleText: { text, chars: SCRAMBLE_CHARS, speed, revealDelay },
  });
}
