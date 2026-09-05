/**
 * motion.js — the house motion authority (refinements master plan, Phase A).
 *
 * One home for cross-surface motion primitives so GSAP, CSS, and the Three.js
 * scenes read the same values. Two things live here:
 *
 * 1. The house SLOW PULSE — a slow-swell envelope (soft S-attack to a peak
 *    just past mid-hit, then an eased S-fall that lingers high before easing
 *    into rest) that loops with a shorter rest between hits. The CustomEase
 *    path below is the source of truth; `--ease-pulse` / `--duration-pulse` /
 *    `@keyframes house-pulse` in global.css are its hand-matched CSS
 *    approximation (stops sampled from this curve). Polarity is per-consumer
 *    and deliberate: enter_world DIMS (bright → dip → return), the inquiry
 *    next-field BRIGHTENS (dim → lift → return). Curve dialed by Nathan
 *    2026-07-17 via the ?fp1tune bench.
 *
 * 2. The house scroll-gesture constants — the wheel/touch accumulator idiom
 *    shared by the home Envelopment, the /work World Turn, the detail
 *    next-project band, and the /process quantizer: trigger 500px and the
 *    800ms commit glide (Nathan's 2026-07-16 dial), gain and release —
 *    all living here once.
 *
 * (The World Turn curve itself — TURN_EASE_PATH — stays in worldConfig.js
 * with its ?ease override; this module is for NEW cross-surface primitives.)
 */
import { CustomEase } from 'gsap/CustomEase';

/* ── House slow pulse ─────────────────────────────────────────────────────
   Envelope, normalized to one HIT (not the full cycle) — Nathan's 2026-07-17
   dial (?fp1tune bench):
     attack  0 → 45%    soft S-ramp swelling to the peak (no hard snap)
     peak      45%      crest (zero-length hold)
     fall   45 → 100%   eased S — lingers high, then eases down into rest
   The loop then rests for (1 − HOUSE_PULSE_ON_RATIO) of the period. Author/
   visualize: https://gsap.com/docs/v3/Eases/CustomEase */
export const HOUSE_PULSE_PATH =
  'M0,0 C0.12,0 0.27,1 0.45,1 L0.45,1 C0.6929,0.8833 0.7571,0.1167 1,0';

export const HOUSE_PULSE_EASE = 'housePulse'; // canonical registered name
export const HOUSE_PULSE_PERIOD_S = 2.3; // full cycle: hit + rest
export const HOUSE_PULSE_ON_RATIO = 0.75; // hit occupies 3/4 of the period

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
  const tl = gsap.timeline({ repeat: -1, repeatDelay: periodS - on }).to(target, {
    ...peakVars,
    duration: on,
    ease: ensureHousePulse(),
  });
  // House METRONOME (09-04, Nathan): every pulse loop is phase-locked to
  // the shared wall clock, so surfaces that arm at different moments
  // (enter_world, the pager's number cell + select_project hint, the
  // inquiry next-field) beat TOGETHER instead of drifting per arm time.
  // Manual pulse timelines (GraticulePager's armPulse) seek the same way.
  tl.totalTime((performance.now() / 1000) % periodS);
  return tl;
}

/* ── House scroll gesture ─────────────────────────────────────────────────
   The accumulator idiom: wheel/touch px fill toward a commit threshold,
   touch deltas gain ×TOUCH_GAIN, and a stall of RELEASE_MS rubber-bands
   back to rest. Surfaces read their own trigger (live-tunable via ?scroll;
   /process gets its own param at rebase so surfaces dial independently). */
export const SCROLL_TRIGGER_WORK_PX = 500; // /work World Turn + detail next-project band
export const SCROLL_TRIGGER_PROCESS_PX = 500; // /process quantizer
// ^ unified at 500 per Nathan's 2026-07-16 dial (was 600/600/700) — the
//   Notion "takes too much scroll power" note, answered. Per-surface
//   exports stay so a future dial can split them again. (The HOME trigger
//   retired 08-30 — the hero's enter_world is tap-only now.)
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

/* ── FP pager gesture (08-31 rework, docs/fp-pager-rework-approaches.md) ──
   The press-hold-slide-release wheel shared by every ?pager= variant.
   Wheeling is a pure-DOM scrub — the scene never turns mid-gesture; release
   commits exactly ONE goTo. Plain exports only: this module runs during SSR,
   so the ?detent/?wheeldetent live overrides resolve in the component via
   the PARAM helper, never here. */
export const PAGER_HOLD_MS = 200; // press-and-hold engage threshold (tap below it = peek)
export const PAGER_SLOP_PX = 8; // vertical travel that promotes a press to engage before the timer
export const PAGER_DETENT_TOUCH_PX = 56; // finger travel per station (live ?detent)
export const PAGER_DETENT_WHEEL_PX = 90; // desktop wheel deltaY per station (live ?wheeldetent)
export const PAGER_STALL_COMMIT_MS = 450; // desktop wheel silence before the landing commits
export const PAGER_PEEK_MS = 900; // tap-peek hold before auto-retract
export const PAGER_FLICK_CARRY_S = 0.12; // release velocity carry (80ms sample window, ±2 detents cap)
export const PAGER_TAU_SCRUB = 0.05; // dt-invariant damper while the finger owns the tape
export const PAGER_TAU_GLIDE = 0.27; // rest-follow of an external Turn (the marker's glide τ)
export const PAGER_END_RESIST = 0.3; // beyond-range travel compression (cap 0.35 detent)
export const PAGER_KEY_COMMIT_MS = 400; // keyboard arrow-run debounce into one commit
/* ?pager=scale — the graticule's own dials (approach B). The pitch is the
   station spacing AND the finger's px-per-detent (1:1, magnet off), and
   THIS is its single source of truth: the skin resolves detentPx from
   these (or ?detent, floored at 8px) and writes it back as the inline
   --scale-pitch, so the scale and the finger can never drift apart. The
   global.css --scale-pitch token is the pre-hydration fallback only —
   keep it equal per tier so the SSR base transform lays out right. */
export const SCALE_PITCH_PX = 48; // desktop station pitch = touch detent (live ?detent) — 09-04 r8 vertical-space bump (was 44)
export const SCALE_PITCH_MOBILE_PX = 48; // <=768px tier pitch — HOLDS at 48 (the 667px-phone window check bounds it; see global.css --scale-rows)
export const SCALE_WHEEL_DETENT_PX = 100; // desktop wheel deltaY per station (live ?wheeldetent)
export const SCALE_END_RESIST = 0.2; // beyond-range compression — stiffer than the tape's 0.3
/* No stall-commit on this arm (09-03 round 6): a desktop wheel settle is a
   PREVIEW — the Turn evaluates only at disengage (mouse-out / touch release
   / keyboard), so settling on stations in sequence can never stack frozen
   Turns behind the pause scrim. The skin passes stallMs: Infinity. */
export const SCALE_MAGNET_EXP = 2.2; // magnet curve exponent (live ?magnet) — Nathan's 09-03 r6 bake (was 4)
export const SCALE_FLIP_TAU_S = 0.005; // flipper-box spring τ (live ?fliptau) — Nathan's 09-03 r6 bake (was 0.06)
/* ?pager=tuner — the signal tuner's own dials (approach C). The wheel
   pitch is per-arm (80 vs the tape's 90: a 1:1 strip wants a touch less
   travel per station); the lock window + scramble beat are the tuner's
   "hunting signal" — seeking between stations scrambles the readout at the
   textExit charCutMs cadence, locking within the window. */
export const TUNER_DETENT_WHEEL_PX = 80; // desktop wheel deltaY per station (live ?wheeldetent)
export const TUNER_IDLE_COMMIT_MS = 650; // desktop idle-at-detent auto-commit (?idlecommit=0 defeats)
export const TUNER_LOCK_WINDOW = 0.33; // |q − round(q)| at or under this = LOCKED (real text), beyond = SEEKING
export const TUNER_SCRAMBLE_MS = 35; // seeking readout char-cut cadence (the textExit charCutMs beat)
export const TUNER_HAPTIC_MS = 8; // navigator.vibrate tick per newly-locked station

/* ── Lenis tuning ─────────────────────────────────────────────────────────
   Spread into the Lenis constructor by smoothScroll.js. BAKED from the A2b
   dial session (2026-07-17): lerp 0.165 (tighter/faster settle than the 0.1
   library default) + wheelMultiplier 1.25 (less wheel effort per distance).
   Re-dial live any time on a detail page via ?lenistune=1 (LenisTunePanel), or
   the raw ?lerp/?wheelmult/?lenisdur params. Lenis feeds Grid Socket parallax +
   the orbit scroll-kick, so retunes need a regression pass on document-scroll
   routes.
   ⚠ This bake MOVED lerp (0.1→0.165) + wheelMultiplier (1→1.25), so the two
   calibration caveats below are now LIVE follow-ups, not hypotheticals.

   A2b LIVE DIAL (smoothScroll.js start() + ?lenistune=1 bench) — URL params
   override this bake on every Lenis document-scroll route; blessed values get
   baked HERE:
     ?lerp=0.1       Lenis lerp (library default 0.1 — smoothing per frame)
     ?wheelmult=1    wheelMultiplier (library default 1)
     ?lenisdur=0.9   duration in SECONDS — switches Lenis to duration mode,
                     which OVERRIDES lerp (pair with an easing at bake time)
   Candidate starting points for the dial session:
     lerp 0.14       tighter / faster settle
     lerp 0.075      heavier glide
     wheelmult 1.2   less wheel effort per scroll distance
     lenisdur ~0.9   fixed-length settle (+ easing) instead of lerp inertia
   Calibration caveats:
   - NextProjectBand's NP_ARM_MS=250 (?nparm) is tuned to the default
     lerp-0.1 inertia tail — re-check flick tails at the band if lerp moves.
   - TOUCH_GAIN=2 above encodes parity with the CURRENT touch feel — if the
     Lenis bake shifts it (touchMultiplier default 1), re-check touch parity.
   - The spec'd-but-dormant orbit scroll-kick (momentum.js kick(), zero
     importers today) will read getLenis().velocity, whose magnitude scales
     with lerp/wheelMultiplier — record the baked values so ?orbitkick gets
     dialed against them. */
export const LENIS_TUNING = {
  lerp: 0.165,
  wheelMultiplier: 1.25,
};
