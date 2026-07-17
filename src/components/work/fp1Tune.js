/**
 * fp1Tune.js — DEV-ONLY live tuning bench for the HOUSE PULSE CURVE, demoed on
 * the FP-1 enter_world dim (WorldCard). Gated behind `?fp1tune=1`; absent
 * without it, so the shipped pulse stays exactly motion.js's default.
 *
 * The panel (Fp1TunePanel.jsx) writes a module-level tuning `state`; WorldCard
 * reads it (only when FP1_TUNE_ACTIVE) to build a live CustomEase pulse on the
 * visible CTA, and subscribes so any slider move re-creates that pulse. This
 * is a bench, not a shipped surface: the deliverable is the generated
 * HOUSE_PULSE_PATH string (+ period/dim/rest) Nathan hands back to bake as the
 * house token in motion.js.
 *
 * Envelope model (one HIT, normalized 0..1):
 *   attack  M0,0 → (peakX,1)   soft cubic ramp; two control points regenerated
 *                              from `attackSoft` (0 hard → 1 very soft; 0.5 =
 *                              the exact house control points)
 *   hold    (peakX,1) → (holdEndX,1)   flat sit at peak
 *   fall    (holdEndX,1) → (1,0)   linear by default; `fallEase` bows it into
 *                              a held-high eased return
 * At defaults the generated path is byte-identical to motion.js HOUSE_PULSE_PATH.
 */
import { CustomEase } from 'gsap/CustomEase';
import {
  HOUSE_PULSE_PERIOD_S,
  HOUSE_PULSE_ON_RATIO,
} from '../../lib/motion.js';

export const FP1_TUNE_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('fp1tune') === '1';

/* House defaults — mirror motion.js + WorldCard's shipped enter_world dim.
   These are the values the panel opens on, and the anchors copy_url diffs
   against (only non-defaults serialise). */
export const FP1_DEFAULTS = Object.freeze({
  peakX: 0.15, // attack: x where the value hits the peak (1)
  attackSoft: 0.5, // attack softness 0 hard → 1 very soft; 0.5 = house cubics
  holdEndX: 0.25, // hold: x where the flat sit at peak ends
  fallEase: 0, // fall: 0 linear (house) → 1 fully eased return
  period: HOUSE_PULSE_PERIOD_S, // full cycle seconds (hit + equal rest)
  dim: 0.62, // enter_world peak dim opacity at the dip's deepest point
  rest: 0.4, // rest beat before the first hit (entrance/Turn only)
  onRatio: HOUSE_PULSE_ON_RATIO, // hit occupies this fraction of the period
});

/* URL param names for copy_url / seed-on-load. fp1dim/fp1period/fp1rest reuse
   WorldCard's existing knobs on purpose (a shared tuning URL stays coherent if
   fp1tune is later dropped). */
const PARAM_KEYS = {
  peakX: 'fp1peakx',
  attackSoft: 'fp1soft',
  holdEndX: 'fp1holdx',
  fallEase: 'fp1fall',
  period: 'fp1period',
  dim: 'fp1dim',
  rest: 'fp1rest',
  onRatio: 'fp1on',
};

// Live, mutable tuning state (panel writes, WorldCard reads).
const state = { ...FP1_DEFAULTS };

// Seed from the URL so a copied tuning link reopens in the same shape.
if (FP1_TUNE_ACTIVE && typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const raw = p.get(param);
    if (raw == null) continue;
    const n = parseFloat(raw);
    if (Number.isFinite(n)) state[key] = n;
  }
}

export const getFp1State = () => state;

/* pub/sub — WorldCard subscribes to re-create its live pulse on any change. */
const subs = new Set();
export function subscribeFp1(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function publish() {
  subs.forEach((fn) => fn());
}

export function setFp1(key, value) {
  if (state[key] === value) return;
  state[key] = value;
  publish();
}
export function resetFp1() {
  Object.assign(state, FP1_DEFAULTS);
  publish();
}

/* Attack control-point x fractions locked to the house shape so peakX scales
   the whole attack coherently: 0.04/0.15 and 0.09/0.15. */
const CP1X_RATIO = 0.04 / 0.15;
const CP2X_RATIO = 0.09 / 0.15;

const round4 = (n) => Math.round(n * 1e4) / 1e4;
const fmt = (n) => String(round4(n));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Regenerate the CustomEase path string from the current (or a given) state.
 * At FP1_DEFAULTS this returns exactly motion.js HOUSE_PULSE_PATH.
 */
export function buildHousePulsePath(s = state) {
  const { peakX, attackSoft, holdEndX, fallEase } = s;

  // Attack cubic. x fractions locked to the house ratios (scale with peakX);
  // control-point y morphs with softness, piecewise so attackSoft=0.5 lands on
  // the house control points (cp1y 0.02, cp2y 0.82) exactly.
  const a = attackSoft;
  const cp1y =
    a <= 0.5 ? lerp(0.35, 0.02, a / 0.5) : lerp(0.02, 0.0, (a - 0.5) / 0.5);
  const cp2y =
    a <= 0.5 ? lerp(0.55, 0.82, a / 0.5) : lerp(0.82, 1.0, (a - 0.5) / 0.5);
  const cp1x = peakX * CP1X_RATIO;
  const cp2x = peakX * CP2X_RATIO;
  const attack = `C${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(peakX)},1`;

  const hold = `L${fmt(holdEndX)},1`;

  // Fall: a literal linear L (house) unless eased, so the default string stays
  // byte-identical to the house token. Bows from a straight line (f=0) to a
  // held-high S that lingers at peak then eases into rest (f=1).
  let fall;
  if (fallEase <= 0) {
    fall = 'L1,0';
  } else {
    const f = Math.min(1, fallEase);
    const segx = 1 - holdEndX;
    const lin1x = holdEndX + segx / 3;
    const lin1y = 1 - 1 / 3;
    const lin2x = holdEndX + (2 * segx) / 3;
    const lin2y = 1 - 2 / 3;
    const soft1x = holdEndX + segx * 0.5;
    const soft2x = holdEndX + segx * 0.5;
    const f1x = lerp(lin1x, soft1x, f);
    const f1y = lerp(lin1y, 1, f);
    const f2x = lerp(lin2x, soft2x, f);
    const f2y = lerp(lin2y, 0, f);
    fall = `C${fmt(f1x)},${fmt(f1y)} ${fmt(f2x)},${fmt(f2y)} 1,0`;
  }

  return `M0,0 ${attack} ${hold} ${fall}`;
}

/** Snapshot the live pulse values WorldCard consumes. */
export function getLivePulse() {
  return {
    path: buildHousePulsePath(state),
    period: state.period,
    dim: state.dim,
    rest: state.rest,
    onRatio: state.onRatio,
  };
}

/**
 * Build a paused pulse loop on `target` from the CURRENT live state — the
 * live-tuning counterpart of motion.js housePulseLoop, specialised to the
 * enter_world opacity dim. Recreates the CustomEase under a stable temp name
 * (overwritten each call, so the registry never leaks) and passes the returned
 * function straight to the tween. Caller owns play/kill.
 */
export function liveHousePulseLoop(gsap, target) {
  const s = state;
  const ease = CustomEase.create('housePulseLive', buildHousePulsePath(s));
  const on = s.period * s.onRatio;
  return gsap.timeline({ repeat: -1, repeatDelay: s.period - on }).to(target, {
    opacity: s.dim,
    duration: on,
    ease,
  });
}

/** Compact block Nathan pastes back — the values to bake as the house token. */
export function fp1CopyBlock() {
  const s = state;
  return [
    `HOUSE_PULSE_PATH = '${buildHousePulsePath(s)}'`,
    `HOUSE_PULSE_PERIOD_S = ${round4(s.period)}`,
    `enter_world dim (peak opacity) = ${round4(s.dim)}`,
    `rest beat (fp1rest) = ${round4(s.rest)}`,
    `on-ratio = ${round4(s.onRatio)}`,
    `// shape: peakX ${round4(s.peakX)} · attackSoft ${round4(s.attackSoft)} · holdEndX ${round4(s.holdEndX)} · fallEase ${round4(s.fallEase)}`,
  ].join('\n');
}

/** Shareable tuning URL — fp1tune=1 plus only the params that differ from default. */
export function fp1TuneUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('fp1tune', '1');
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    if (Math.abs(state[key] - FP1_DEFAULTS[key]) > 1e-9) {
      p.set(param, String(round4(state[key])));
    } else {
      p.delete(param);
    }
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
