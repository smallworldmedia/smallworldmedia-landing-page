/**
 * processConfig.js — every tunable for the /process ProcessScene (spec §9).
 *
 * Query-knob convention (globeConfig.js PARAM): read once at init, baked
 * defaults. Live tuning on the gated route: /process?debug + this set.
 */

export const IS_MOBILE =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

const PARAMS =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

const num = (key, fallback) => {
  const raw = PARAMS?.get(key);
  const n = raw == null ? NaN : parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
};
const str = (key, fallback) => PARAMS?.get(key) || fallback;

/* — Spec §9 knob table — */
export const STAGE_SECONDS = num('stagems', 1200) / 1000; // base stage-transition duration
export const SCATTER = num('scatter', 1.8); // Fragment-belt spread (annulus radius, world units)
export const DRIFT = num('drift', 0.05); // Fragment drift/tumble rate
export const THREAD_HOPS = num('threadhops', 10); // Fragments the Thread chains before assembly
export const THREAD_HOP_SECONDS = num('threadms', 900) / 1000; // Thread draw per hop
export const ASSEMBLE_SECONDS = num('assemble', 1.6); // assembly, scatter → home
export const ZOOM_OUT_SECONDS = num('zoomout', 1.0); // S2→S3 dolly-back
export const EMANATE_SCALE = num('emanate', 1.35); // S4 per-panel scale target
export const EMANATE_ORDER = str('emanateorder', 'sweep'); // S4 stagger (contrasts S3's rows)
export const BPM = num('bpm', 122); // S5 pattern-loop tempo
export const CASCADE_VARIANT = str('cascade', 'rows'); // S3 light-up (home hero keeps sweep)
export const FILL_FRACTION = num('fillfrac', IS_MOBILE ? 0.7 : 0.85); // contain fit — the belt fits whole
export const DEBUG = PARAMS?.has('debug') ?? false; // tuning panel (P4)

/* — Stage poses — */
export const LIT_COLOR = 0x0000ff; // electric blue — the identity moment
export const IDLE_POWER = 0.35; // Fragments idle: barely-lit slate, material not yet light
export const PULSE_MAX = 1.12; // S5 rhythm ceiling (the flicker ceiling — heartbeat, not strobe)
export const PULSE_MIN = 0.7; // S5 dip — the visible half: pure 0x0000ff saturates blue at
// uPower 1, so spec §3's over-brighten peak reads as a no-op on lit panels;
// the traveling dim wave carries the pulse instead (peak kept for headroom
// if panels ever carry graded/textured states).
export const S3_FILL = 0.6; // post-zoom-out: the Core small again, the last step in the distance
export const S45_FILL = 0.92; // build-out/living world: outgrows the old frame, stays contained
export const DESKTOP_OFFSET_X = 0.28; // globe right-of-center (fraction of visible half-width)
export const EXIT_RATIO = 0.7; // exits/reversals ≈0.7× their entrance durations
export const PASS_BEATS = 8; // S5: one pattern pass per 8 beats
