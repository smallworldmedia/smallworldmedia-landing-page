/**
 * motion.js — the house motion authority (refinements master plan, Phase A).
 *
 * One home for cross-surface motion primitives so GSAP, CSS, and the Three.js
 * scenes read the same values. Two things live here:
 *
 * 1. The house SLOW PULSE — an ADSR envelope (slightly softened attack →
 *    slight hold → essentially linear falloff) that loops with an equal-length
 *    rest between hits. The CustomEase path below is the source of truth;
 *    `--ease-pulse` / `--duration-pulse` / `@keyframes house-pulse` in
 *    global.css are its hand-matched CSS approximation. Polarity is
 *    per-consumer and deliberate: enter_world DIMS (bright → dip → return),
 *    the inquiry next-field BRIGHTENS (dim → lift → return).
 *
 * 2. The house scroll-gesture constants — the wheel/touch accumulator idiom
 *    shared by the home Envelopment, the /work World Turn, and the /process
 *    quantizer. Per-surface trigger values are deliberate (700 on /process is
 *    heavier than 600 elsewhere — do not flatten them); the gain and release
 *    are the same everywhere and live here once.
 *
 * (The World Turn curve itself — TURN_EASE_PATH — stays in worldConfig.js
 * with its ?ease override; this module is for NEW cross-surface primitives.)
 */
import { CustomEase } from 'gsap/CustomEase';

/* ── House slow pulse ─────────────────────────────────────────────────────
   Envelope, normalized to one HIT (not the full cycle):
     attack  0 → 15%   softened ramp to peak (never a hard snap)
     hold   15 → 25%   slight sit at peak
     fall   25 → 100%  essentially linear back to rest
   The loop then rests for HOUSE_PULSE_ON_RATIO of the period — equal time
   on and off. Author/visualize: https://gsap.com/docs/v3/Eases/CustomEase */
export const HOUSE_PULSE_PATH = 'M0,0 C0.04,0.02 0.09,0.82 0.15,1 L0.25,1 L1,0';

export const HOUSE_PULSE_EASE = 'housePulse'; // canonical registered name
export const HOUSE_PULSE_PERIOD_S = 3.0; // full cycle: hit + equal rest
export const HOUSE_PULSE_ON_RATIO = 0.5; // hit occupies half the period

/** Register the canonical ease once; returns the ease name for tween vars. */
export function ensureHousePulse() {
  if (!CustomEase.get(HOUSE_PULSE_EASE)) {
    CustomEase.create(HOUSE_PULSE_EASE, HOUSE_PULSE_PATH);
  }
  return HOUSE_PULSE_EASE;
}

/**
 * The canonical pulse loop: tweens `prop` from its current value to `peak`
 * and back along the envelope, resting an equal interval between hits.
 * Returns the timeline (kill it on teardown). Callers own reduced-motion
 * gating — do not start a loop under prefers-reduced-motion.
 *
 *   housePulseLoop(gsap, el, { opacity: 0.62 })          // dim polarity
 *   housePulseLoop(gsap, label, { '--pulse-lift': 1 })   // brighten via var
 */
export function housePulseLoop(gsap, target, peakVars, periodS = HOUSE_PULSE_PERIOD_S) {
  const on = periodS * HOUSE_PULSE_ON_RATIO;
  return gsap.timeline({ repeat: -1, repeatDelay: periodS - on }).to(target, {
    ...peakVars,
    duration: on,
    ease: ensureHousePulse(),
  });
}

/* ── House scroll gesture ─────────────────────────────────────────────────
   The accumulator idiom: wheel/touch px fill toward a commit threshold,
   touch deltas gain ×TOUCH_GAIN, and a stall of RELEASE_MS rubber-bands
   back to rest. Surfaces read their own trigger (live-tunable via ?scroll;
   /process gets its own param at rebase so surfaces dial independently). */
export const SCROLL_TRIGGER_HOME_PX = 500; // home hero Envelopment
export const SCROLL_TRIGGER_WORK_PX = 500; // /work World Turn + detail next-project band
export const SCROLL_TRIGGER_PROCESS_PX = 500; // /process quantizer
// ^ unified at 500 per Nathan's 2026-07-16 dial (was 600/600/700) — the
//   Notion "takes too much scroll power" note, answered. Per-surface
//   exports stay so a future dial can split them again.
export const TOUCH_GAIN = 2; // touch deltas 2× — parity with wheel feel
export const RELEASE_MS = 160; // stall gap before the rubber-band release

/* The house commit GLIDE — what a threshold-crossing gesture settles
   into (Nathan's 2026-07-16 dial, baked from the /process ?swipems):
   the /process section glide, the hero Envelopment, and the detail
   next-project band all ride it. (The /work World-to-World TURN_DURATION
   is a scene transition, not a commit glide — it keeps its own 1700ms
   dial in worldConfig.js.) */
export const GLIDE_MS = 800;
export const GLIDE_SECONDS = GLIDE_MS / 1000;

/* ── Lenis tuning ─────────────────────────────────────────────────────────
   Spread into the Lenis constructor by smoothScroll.js. Empty = library
   defaults (today's shipped feel). The A2 dial-in session fills this in
   (lerp / duration / wheelMultiplier) — remember Lenis feeds Grid Socket
   parallax + the orbit scroll-kick, so retunes need a regression pass on
   document-scroll routes. */
export const LENIS_TUNING = {};
