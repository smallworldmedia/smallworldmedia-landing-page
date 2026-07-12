/**
 * processConfig.js — every tunable for the /process ProcessScene (spec §9).
 *
 * Knobs initialize from the URL (the PARAM convention) into the mutable
 * TUNING object. The scene reads TUNING at use-time — framing, the drift
 * tick, transition build — so the ?debug panel can live-tune without a
 * reload: instant for framing/drift/glow, next-beat for durations/orders
 * (jump or ↻ replay a stage to hear the change). The panel's copy_url
 * serializes non-default values back into the query string so a
 * dialed-in feel can be reloaded or shared.
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

export const DEBUG = PARAMS?.has('debug') ?? false;

/* — Baked defaults (spec §9 + feel extras). The panel's URL builder
   serializes only values that differ from these. — */
export const TUNING_DEFAULTS = {
  stageSeconds: 1.2, // ?stagems — base stage-transition duration
  scatter: 1.8, // ?scatter — Fragment-belt spread (annulus radius, world units)
  drift: 0.05, // ?drift — Fragment drift/tumble rate
  threadHops: 10, // ?threadhops — Fragments the Thread chains before assembly
  threadHopSeconds: 0.9, // ?threadms — Thread draw per hop
  assembleSeconds: 1.6, // ?assemble — assembly, scatter → home
  zoomOutSeconds: 1.0, // ?zoomout — S2→S3 dolly-back
  emanateScale: 1.35, // ?emanate — S4 per-panel scale target
  emanateOrder: 'sweep', // ?emanateorder — S4 stagger (contrasts S3's rows)
  bpm: 122, // ?bpm — S5 pattern-loop tempo
  cascadeVariant: 'rows', // ?cascade — S3 light-up (home hero keeps sweep)
  fillFraction: IS_MOBILE ? 0.7 : 0.85, // ?fillfrac — contain fit; the belt fits whole
  s3Fill: 0.6, // ?s3fill — post-zoom-out: the Core small, in the distance
  s45Fill: 0.92, // ?s45fill — build-out: outgrows the frame, stays contained
  idlePower: 0.35, // ?idlepower — Fragments idle: barely-lit slate
  pulseMin: 0.7, // ?pulsemin — S5 dip: the visible half of the heartbeat
  // (pure 0x0000ff saturates blue at uPower 1, so the over-brighten peak
  // is a no-op on lit panels — the traveling dim wave carries the pulse)
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
};

/* — Fixed constants — */
export const LIT_COLOR = 0x0000ff; // electric blue — the identity moment
export const PULSE_MAX = 1.12; // S5 rhythm ceiling (the flicker ceiling — heartbeat, not strobe)
export const DESKTOP_OFFSET_X = 0.28; // globe right-of-center (fraction of visible half-width)
export const EXIT_RATIO = 0.7; // exits/reversals ≈0.7× their entrance durations
export const PASS_BEATS = 8; // S5: one pattern pass per 8 beats
