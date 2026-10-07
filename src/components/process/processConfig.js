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
 * Defaults below are Nathan's 2026-07-16 dialed set — the first pass
 * against the round-3 build (v2 deck: suspended flood, in-scene Thread,
 * S5 tilt/inner-stroke, splash), baked from his copy_url. Checkpoint
 * bake; further refinement to follow. Knobs he didn't touch keep the
 * 07-15 values.
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

/* — Globe-O, LIVE (08-28, Nathan — the 08-25 snapshot gains motion + the
   fill-circle-as-stroke ring). Consumed by liveLockupGlobe/useProcessCopy. — */
export const O_SPIN_DPS = num('ospin', -20); // ?ospin — spin around the polar axis, deg/s (negative = westward); 0 = still. 08-28 bake −20 (Nathan's dial; the cascade is retired — rotation carries the motion)
export const O_STROKE_PCT = Math.max(0, num('ostroke', 3)); // ?ostroke — outer-stroke ring, % proud, clamped ≥0 (≤ −100 would make the slot-height math divide toward Infinity); the home ?globestroke convention: the globe shrinks inside so globe + ring land AT the glyph height. 08-28 bake 3 (Nathan's dial)
export const O_PAD_EM = num('opad', 0.175); // ?opad — clear air each side of the O glyph slot, em of the title size (was the 0.26em CSS literal). 08-29 bake 0.175 (Nathan's dial)

/* — Resize doctrine (08-28, shared dial with /work): the camera re-eval
   TRAILS the window on a retargeted ease. — */
export const CAM_LAG_S = num('camlag', 0.7); // ?camlag — seconds; ~0 = instant

/* — Baked defaults (spec §9 + feel extras). The panel's URL builder
   serializes only values that differ from these. — */
export const TUNING_DEFAULTS = {
  stageSeconds: 0.65, // ?stagems — base stage-transition duration
  scatter: 2.05, // ?scatter — Fragment-belt spread (annulus radius, world units)
  drift: 0.09, // ?drift — suspended-cloud self-rotation rate (very slow — the v2 read)
  threadHops: 84, // ?threadhops — Fragments the Thread chains (84 = every bead on the string)
  threadHopSeconds: 0.1, // ?threadms — Thread draw per hop
  threadTight: 0.85, // ?threadtight — S1→S2: the camera opens dead on the Thread's FIRST bead at this fraction of the Core's rest distance (so the assembly's pull-back is real); floored at the cloud's near face
  threadDrift: 0.2, // ?threaddrift — S1→S2: how far back toward the wide the camera eases DURING the trace (0 = holds tight until the assembly, 1 = fully wide before it)
  assembleSeconds: 2.5, // ?assemble — assembly, scatter → home
  zoomOutSeconds: 0.6, // ?zoomout — S2→S3 dolly-back (the bg contraction rides it)
  emanateScale: 1.7, // ?emanate — S4 per-panel scale target
  emanateOrder: 'poles', // ?emanateorder — S4 stagger (contrasts S3's rows)
  bpm: 123, // ?bpm — S5 pattern-loop tempo
  cascadeVariant: 'rows', // ?cascade — S3 light-up (home hero keeps sweep)
  fillFraction: 0.98, // ?fillfrac — contain fit; the belt fits whole (both breakpoints — Nathan's pick)
  s3Fill: 0.31, // ?s3fill — post-zoom-out: the Core small, in the distance
  s45Fill: 1.1, // ?s45fill — build-out: outgrows the frame, stays contained
  idlePower: 0.54, // ?idlepower — belt idle: under field brightness (strokes carry the read)
  pulseMin: 0.06, // ?pulsemin — S5 floor: how dark the falloff lands (0 = full black)
  holdBeats: 2, // ?hold — S5 envelope + the S1 label pulse: beats held ON blue (S5 caps it at 45% of the cycle) before the falloff (Nathan 09-10: 2)
  decayBeats: 3, // ?decay — S5 envelope + the S1 label pulse: beats of steep (expo) falloff to the floor (Nathan 09-10: 3)
  pattern: 'cycle', // ?pattern — S5 sequencing (rows/equator/ripple/checker/random/cycle)
  decayCurve: 'expo', // ?decaycurve — S5 falloff shape: expo (baked feel) | linear (house-pulse read) — A/B toggle, v2 deck
  s5Zoom: 1.06, // ?s5zoom — S5 push-in over the S4 framing (world emphasized)
  s5TiltDeg: 33, // ?s5tilt — S5 axis lean toward ~2:00, eased in on the house curve
  s5Stroke: 1, // ?s5stroke — inner-stroke mix where the falloff lands (0 disables)
  strokePx: 1.75, // ?stroke — Fragment edge stroke width (screen px; 0 disables)

  /* — DISCOVERY round (09-09, Nathan): the S1 belt is a place the camera
     TRAVELS THROUGH, not a still life. Everything below is stage-01 only
     and unwinds as the Fragments assemble. — */
  fog: 0.56, // ?fog — atmospheric depth: how far the FURTHEST shard's fill AND stroke are pulled toward the field color (0 = off, 1 = it IS the field). Never opacity — the panels stay fully opaque
  fogSpan: 0.7, // ?fogspan — depth to full haze BEHIND the belt's establishing distance, × ?scatter (the window opens a quarter of this in front). Anchored in WORLD depth, not to the dolly: push the camera toward a far shard and it clears
  tour: 'on', // ?tour — the S1 camera tour (off = the static establishing frame the belt held before 09-09)
  tourTravel: 3.4, // ?tourtravel — seconds of glide per station, on the house Turn curve
  tourHold: 2.6, // ?tourhold — seconds the camera RESTS on a close-up (the label's reading beat)
  tourNear: 0.42, // ?tournear — closest station's dolly distance as a fraction of the establishing frame; the floor keeps the cloud's near face in front of the camera
  tourFar: 0.66, // ?tourfar — farthest close-up station, same units (stations land between near and far)
  labelPulse: 0.6, // ?labelpulse — how DARK a labelled shard's fill pulses, as a fraction of the belt's resting ?idlepower (1 = no pulse): the house envelope (?bpm ?hold ?decay) inverted — snap down, hold, expo recover — for as long as the chip names it
  labelLead: 136, // ?labellead — screen px between a chip and the shard it names (the leader's length); round 1 sat them 20px out and the pairing was hard to read
  tourShift: 1, // ?tourshift — how far a station must MOVE the camera from the last one, in multiples of the new station's half-frame width (1 = the frame slides by half its width, so most of what is in view is new); the picker takes the farthest candidates if none clears it
  tourReach: 0.34, // ?tourreach — how far off-centre a station SEATS its subject, as a multiplier on the baked compositional thirds (1× = the bake; 0 centres every shot, which is what the photography rule says not to do)
  spinFast: 4.4, // ?spinfast — the fast rotation tier's multiplier over the base ?drift rate
  spinFastFrac: 0.3, // ?spinfastfrac — fraction of shards seeded onto that fast tier (0 = one uniform rate, the pre-09-09 read)
  labelCount: 4, // ?labels — annotation chips alive at once on desktop (a phone takes min(this, 3)); needs a reload — slots are built at mount (Nathan 09-10: capped at 4)
  labelSize: 0, // ?labelsize — chip type size in px; 0 = the .process-label token (--text-mono). Live.
  labelCharMs: 22, // ?labelchar — ms between letter cuts in a chip's random-letter entrance (charCut.js)
  labelHold: 3.2, // ?labelhold — seconds a chip HOLDS at full strength after its letters land — ONLY when the tour is off; with the tour running a chip lives exactly as long as the camera holds its station
  mobileDrop: 0.02, // ?dropy — phone: Core drop (near-zero per the 07-16 dial; P5 device pass revisits)
  swipe: 'on', // ?swipe — one-section-per-swipe scroll (off = free document scroll)
  swipePx: SCROLL_TRIGGER_PROCESS_PX, // ?swipepx — wheel/touch px to commit a swipe (house constant, motion.js)
  swipeSeconds: 0.8, // ?swipems — the committed section glide (house Turn curve)
};

/* — The live knob set — mutate through the ?debug panel — */
export const TUNING = {
  stageSeconds: num('stagems', TUNING_DEFAULTS.stageSeconds * 1000) / 1000,
  scatter: num('scatter', TUNING_DEFAULTS.scatter),
  drift: num('drift', TUNING_DEFAULTS.drift),
  threadHops: num('threadhops', TUNING_DEFAULTS.threadHops),
  threadHopSeconds: num('threadms', TUNING_DEFAULTS.threadHopSeconds * 1000) / 1000,
  threadTight: num('threadtight', TUNING_DEFAULTS.threadTight),
  threadDrift: num('threaddrift', TUNING_DEFAULTS.threadDrift),
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
  decayCurve: str('decaycurve', TUNING_DEFAULTS.decayCurve),
  s5Zoom: num('s5zoom', TUNING_DEFAULTS.s5Zoom),
  s5TiltDeg: num('s5tilt', TUNING_DEFAULTS.s5TiltDeg),
  s5Stroke: num('s5stroke', TUNING_DEFAULTS.s5Stroke),
  strokePx: num('stroke', TUNING_DEFAULTS.strokePx),
  fog: num('fog', TUNING_DEFAULTS.fog),
  fogSpan: num('fogspan', TUNING_DEFAULTS.fogSpan),
  tour: str('tour', TUNING_DEFAULTS.tour),
  tourTravel: num('tourtravel', TUNING_DEFAULTS.tourTravel),
  tourHold: num('tourhold', TUNING_DEFAULTS.tourHold),
  tourNear: num('tournear', TUNING_DEFAULTS.tourNear),
  tourFar: num('tourfar', TUNING_DEFAULTS.tourFar),
  tourShift: num('tourshift', TUNING_DEFAULTS.tourShift),
  tourReach: num('tourreach', TUNING_DEFAULTS.tourReach),
  labelPulse: num('labelpulse', TUNING_DEFAULTS.labelPulse),
  labelLead: num('labellead', TUNING_DEFAULTS.labelLead),
  spinFast: num('spinfast', TUNING_DEFAULTS.spinFast),
  spinFastFrac: num('spinfastfrac', TUNING_DEFAULTS.spinFastFrac),
  labelCount: num('labels', TUNING_DEFAULTS.labelCount),
  labelSize: num('labelsize', TUNING_DEFAULTS.labelSize),
  labelCharMs: num('labelchar', TUNING_DEFAULTS.labelCharMs),
  labelHold: num('labelhold', TUNING_DEFAULTS.labelHold),
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
/* S5 inner stroke: the "brown-blue" visible when panels go dark (v2 deck).
   First swatches — Nathan confirms at the feel pass. A = the resting ink,
   B = the warmer end of the per-panel offset color drift. */
export const S5_STROKE_A = 0x3e3a52;
export const S5_STROKE_B = 0x53402f;
export const DESKTOP_OFFSET_X = 0.28; // globe right-of-center (fraction of visible half-width)
export const EXIT_RATIO = 0.7; // exits/reversals ≈0.7× their entrance durations
// S5: one pattern pass per 6 beats (07-30 rhythm rework — was 8; tighter
// changeovers, with the full-pass hit spread killing the dead tail).
export const PASS_BEATS = 6;
