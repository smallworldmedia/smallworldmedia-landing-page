/**
 * processConfig.js — every tunable for the /process ProcessScene (spec §9).
 *
 * Knobs initialize from the URL (the PARAM convention) into the mutable
 * TUNING object. The scene reads TUNING at use-time — framing, the drift
 * tick, transition build — so the ?debug panel can live-tune without a
 * reload: instant for framing/drift/glow/stroke, next-beat for
 * durations/orders (jump or ↻ replay a stage to hear the change). The
 * panel's copy_url serializes non-default values back into the query
 * string so a dialed-in feel can be reloaded or shared.
 *
 * Defaults below are Nathan's 2026-07-15 dialed set (first back-at-desk
 * localhost round), baked from his copy_url — all values copied as
 * dialed; unlike the 07-13 bake, every knob was tuned against the
 * current blue-field system, so nothing needed re-interpretation.
 */

import { SCROLL_TRIGGER_PROCESS_PX } from '../../lib/motion.js';

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

export const DEBUG = PARAMS?.has('debug') ?? false;

/* — Baked defaults (spec §9 + feel extras). The panel's URL builder
   serializes only values that differ from these. — */
export const TUNING_DEFAULTS = {
  stageSeconds: 0.65, // ?stagems — base stage-transition duration
  scatter: 1.8, // ?scatter — Fragment-belt spread (annulus radius, world units)
  drift: 0.4, // ?drift — Fragment drift/tumble rate
  threadHops: 84, // ?threadhops — Fragments the Thread chains (84 = every bead on the string)
  threadHopSeconds: 0.1, // ?threadms — Thread draw per hop
  assembleSeconds: 1.9, // ?assemble — assembly, scatter → home
  zoomOutSeconds: 0.35, // ?zoomout — S2→S3 dolly-back (the bg contraction rides it)
  emanateScale: 1.3, // ?emanate — S4 per-panel scale target
  emanateOrder: 'poles', // ?emanateorder — S4 stagger (contrasts S3's rows)
  bpm: 141, // ?bpm — S5 pattern-loop tempo
  cascadeVariant: 'rows', // ?cascade — S3 light-up (home hero keeps sweep)
  fillFraction: 0.99, // ?fillfrac — contain fit; the belt fits whole (both breakpoints — Nathan's pick)
  s3Fill: 0.35, // ?s3fill — post-zoom-out: the Core small, in the distance
  s45Fill: 1.1, // ?s45fill — build-out: outgrows the frame, stays contained
  idlePower: 0.74, // ?idlepower — belt idle: under field brightness (strokes carry the read)
  pulseMin: 0.08, // ?pulsemin — S5 floor: how dark the falloff lands (0 = full black)
  holdBeats: 0.1, // ?hold — S5 envelope: beats held ON blue before the falloff
  decayBeats: 2, // ?decay — S5 envelope: beats of steep (expo) falloff to the floor
  pattern: 'cycle', // ?pattern — S5 sequencing (rows/equator/ripple/checker/random/cycle)
  strokePx: 2, // ?stroke — Fragment edge stroke width (screen px; 0 disables)
  mobileDrop: 0.4, // ?dropy — phone: Core sits low so the centered copy band gets clear air
  swipe: 'on', // ?swipe — one-section-per-swipe scroll (off = free document scroll)
  swipePx: SCROLL_TRIGGER_PROCESS_PX, // ?swipepx — wheel/touch px to commit a swipe (house constant; deliberately heavier than home//work's 600)
  swipeSeconds: 1.1, // ?swipems — the committed section glide (house Turn curve)
};

/* — The live knob set — mutate through the ?debug panel — */
export const TUNING = {
  stageSeconds: num('stagems', TUNING_DEFAULTS.stageSeconds * 1000) / 1000,
  scatter: num('scatter', TUNING_DEFAULTS.scatter),
  drift: num('drift', TUNING_DEFAULTS.drift),
  threadHops: num('threadhops', TUNING_DEFAULTS.threadHops),
  threadHopSeconds: num('threadms', TUNING_DEFAULTS.threadHopSeconds * 1000) / 1000,
  assembleSeconds: num('assemble', TUNING_DEFAULTS.assembleSeconds),
  zoomOutSeconds: num('zoomout', TUNING_DEFAULTS.zoomOutSeconds),
  emanateScale: num('emanate', TUNING_DEFAULTS.emanateScale),
  emanateOrder: str('emanateorder', TUNING_DEFAULTS.emanateOrder),
  bpm: num('bpm', TUNING_DEFAULTS.bpm),
  cascadeVariant: str('cascade', TUNING_DEFAULTS.cascadeVariant),
  fillFraction: num('fillfrac', TUNING_DEFAULTS.fillFraction),
  s3Fill: num('s3fill', TUNING_DEFAULTS.s3Fill),
  s45Fill: num('s45fill', TUNING_DEFAULTS.s45Fill),
  idlePower: num('idlepower', TUNING_DEFAULTS.idlePower),
  pulseMin: num('pulsemin', TUNING_DEFAULTS.pulseMin),
  holdBeats: num('hold', TUNING_DEFAULTS.holdBeats),
  decayBeats: num('decay', TUNING_DEFAULTS.decayBeats),
  pattern: str('pattern', TUNING_DEFAULTS.pattern),
  strokePx: num('stroke', TUNING_DEFAULTS.strokePx),
  mobileDrop: num('dropy', TUNING_DEFAULTS.mobileDrop),
  swipe: str('swipe', TUNING_DEFAULTS.swipe),
  // Own param (?swipepx) so /process dials independently of the ?scroll
  // shared by the hero + /work; ?scroll still honored for old copy_urls.
  swipePx: num('swipepx', num('scroll', TUNING_DEFAULTS.swipePx)),
  swipeSeconds: num('swipems', TUNING_DEFAULTS.swipeSeconds * 1000) / 1000,
};

/* — S5 pattern vocabulary (?pattern). `cycle` rotates through the rest,
   one pattern per 8-beat pass. — */
export const RHYTHM_PATTERNS = ['cycle', 'rows', 'equator', 'ripple', 'checker', 'random'];

/* — Fixed constants — */
export const LIT_COLOR = 0x0000ff; // electric blue — panel fill AND field; strokes/power do the separating
export const STROKE_COLOR = 0x000000; // Fragment edge stroke — black on the blue field
export const DESKTOP_OFFSET_X = 0.28; // globe right-of-center (fraction of visible half-width)
export const EXIT_RATIO = 0.7; // exits/reversals ≈0.7× their entrance durations
export const PASS_BEATS = 8; // S5: one pattern pass per 8 beats
