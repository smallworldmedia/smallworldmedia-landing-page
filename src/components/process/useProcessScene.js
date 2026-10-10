/**
 * useProcessScene — the ProcessScene stage machine (spec §3).
 *
 * The site's third route-scoped canvas (ADR-0002): seven scene states
 * (STAGE_IDS — hero, stage-01 … stage-05, cta; 10-07: the hero's globe-O
 * and the CTA finale joined the five Stages), one authored time-domain
 * transition per boundary, on the house Turn curve — the BREAK's falloff
 * rides its own processShatter curve (below). Built from the home globe's primitives per ADR-0003's grammar —
 * buildGlobeGeometry / createPanelMaterial / the cascade delay model are
 * reused directly; useGlobeScene is NOT forked (it is fused to CMS
 * textures, the live scheduler, and drag).
 *
 * The belt and the globe are the same 84 meshes: every panel keeps its
 * home row/lonIndex identity from birth. Each shard's geometry is re-baked
 * to its own local origin at build (translate by −centerDir·R) so
 * position/quaternion mean shard placement and in-place tumble; the home
 * pose is position = centerDir·R·k with scale k — for k = ?emanate this is
 * exactly the baked-at-radius uniform-scale emanation, decomposed.
 *
 * Visual language (2026-07-13 refinement round): the panel color is
 * LIT_COLOR blue from birth and never tweens (the break's white heat and
 * the reform's are the exception — uBlueMix) — the page speaks through
 * uPower, the black edge stroke (uStrokeMix), and the STAGED BACKGROUND.
 * 10-07 (w4): panel colour still never tweens; only the SEAMS do — the
 * inner sphere showing between the panels as the lat/long lattice is
 * GAP_COLOR blue through S2 and turns ?coreseam (black | white) at the S3
 * ignition, because a blue sphere under full-power #0000FF panels erased
 * every seam and the light-up resolved into a featureless disc.
 * Until w9c the hero, S1 and S2 played on the ELECTRIC-BLUE field (blue
 * Fragments told apart by their black strokes — the blueprint read) and a
 * BLACK field grew out of the Core for S3/S4. 10-10 (w9c — Nathan: "start
 * on black instead of blue … when it goes to phase 3, it switches to the
 * blue background"): the order is REVERSED, through ONE field table
 * (processConfig FIELDS / fieldOf — poses name a role: open | solid |
 * gradient; ?opening=blue is the pre-w9c order). The hero, S1 and S2 play
 * on BLACK (the Fragments read by their light — power; the strokes still
 * separate overlaps); at S2→S3's IGNITION the BLUE field — the Core's light
 * flooding the page — GROWS out of the Core's live screen-space disc
 * (bgMorph) and S3/S4 hold it, the lit world drawn by its black edge ink and
 * seams (FIELDS.blue.ink) — the Core goes INTO that light and the cascade
 * draws its ink back (?ignite, buildIgnition); the S3→S2 step shrinks it back into the Core. S5
 * brings the home hero's black→blue gradient in and the CTA's ramp reaches
 * higher (?ctaramp). Jumps and compressed catch-ups crossfade, monotonic
 * (bgCrossfade). The depth haze and S2's ghost recede into the LIVE field
 * (uFogColor, every frame).
 * The filled core dissolves during the S4 emanation so the expanded
 * world's gap-lattice (its lat/long lines) reads clean through.
 *
 * S1, the DISCOVERY round (09-09, Nathan): the belt is a place the camera
 * TRAVELS THROUGH, not a still life. A seeded camera TOUR glides between
 * close-up stations pushed into the cloud — the establishing wide is seen
 * once, on arrival, and never returned to (Nathan 09-10: the zoom-out is
 * saved for S2's assembly, so it reads as a reveal) — so the shards and
 * their annotation chips read at size and the reader is inside the
 * gathering. Shards tumble on SEEDED axes at two rate
 * tiers (?spinfast / ?spinfastfrac). An ATMOSPHERIC DEPTH haze (?fog) pulls
 * each shard's fill and stroke toward the field color by view depth — never
 * opacity, the panels stay fully opaque — and burns off as they assemble.
 * The chips carry the house random-letter entrance (charCut.js) instead of
 * the scramble, and the whole field takes the home globe's drag + flick.
 *
 * The HERO is a stage (10-07, Nathan): the PROCESS lockup's globe-O BREAKS
 * into the stage-01 belt. While the hero rests, the lockup's own canvas
 * (liveLockupGlobe) draws the mark and the 84 shards wait, hidden. The
 * shatter WINDS the O up (an additive rev, ?owind, and a white burn
 * through its panel shader), holds one dead-still white beat, and on the
 * impact frame these shards take it over — white-hot, at the lockup's exact
 * screen size, deep behind the belt (?shatterdepth) — and BREAK: equator
 * first, a radial blast into each shard's belt slot on its own side of the O
 * (w2: slots matched by screen angle; each chord bowed outward at its
 * midpoint, never reversing or overshooting) on the processShatter curve
 * (a quarter of the screen chord in a tenth of a second, then the long
 * hang), a white shock ring running out along the O's tilted equator,
 * each shard cooling to the belt's navy as it comes forward out of the
 * haze, its tumble decaying straight into the drift, while the decoy flood
 * arrives on the inverse of its S1→S2 cull — burned white with the shards
 * and cooling on the same clock (10-07, final review: they were the field's
 * blue, unseen in the burst). Scrolling back to the top flies
 * them home into the O (the reform — the word returns first, the world
 * after it) and hands the mark back. The copy hook owns the DOM side
 * through the controller it registers here (setHeroMark).
 *
 * Stages: hero the globe-O → S1 drifting Fragment belt (seeded, empty center) → S2 the Thread
 * chains ?threadhops Fragments with STRAIGHT segments from the center
 * (10-07, w4: over ?threadsecs, cadence ?threadaccel; the beads S1 named
 * wear their words again, the card's lead line counts them), then the
 * camera pulls back to the whole CONNECTED constellation and S2 rests on it
 * (10-09, w9 — Nathan: "hold the animation of the core being assembled
 * until you scroll to Core Assembly") → S3 the pull-in assembly seats beads
 * in HOP ORDER (string pulled taut; the unchained swept up behind; each
 * bead brightens back to the Core's power as it seats), and once the Core
 * is whole THE IGNITION (s3Ignition — one window): the solid field (blue
 * since w9c) grows out of it, the Core goes out for a breath, then the
 * cascade light-up (the ink burns off where the field is black, seams turn) → S4
 * per-panel emanation over the dissolving core → S5 musical rhythm loops
 * (?pattern/?hold/?decay) → CTA (10-07, w7: the world RESOLVES on the next
 * beat of S5's grid, steps back into the free rect beside the ask, and one
 * shard lifts free, turns and wears a first_contact chip that answers the
 * CTA's hover; the world then breathes, or holds lit — ?ctaloop).
 * Scrolling back off S3 de-ignites the Core (the field shrinks back into
 * it) and un-peels it onto the constellation, Thread still drawn; off S2
 * the Thread retracts and the flood returns (w9).
 *
 * Live tuning: every knob is read from the mutable TUNING object at
 * use-time (framing, the drift tick, transition build), so the ?debug
 * panel applies changes without a reload — applyTuning() re-seeds the
 * belt / re-frames / re-strokes / rebuilds a running loop, replay()
 * re-runs the current stage's transition from the previous rest pose.
 *
 * API (spec §3): goTo(stageId) — one active transition at a time; an
 * interrupting goTo kills the running timeline and plays a compressed
 * catch-up morph — except a forward step during the S1→S2 show, which
 * fast-forwards it (?showrush) and plays the step when it lands;
 * goTo(id, { cut: true }) (the bench, the driver's jumps) always cuts.
 * setStageInstant(stageId) — reduced-motion path: jump to
 * the stage's rest pose, render one frame (stage-02's rest is the
 * connected belt with the Thread fully drawn — since w9 in motion too).
 * 10-07 (final review) — the rest of the returned api: getStage();
 * leaveLabels(quick, nextId) / leaveThreadWords(quick) — the driver's
 * commit takes the chips (S1 + S3 spec sheet + CTA, and the Thread's words)
 * the moment the reader commits; setHeroMark(mark) / setCopyBeat(fn) — the
 * copy hook registers the O's DOM controller and its COPY_BEAT cue;
 * s4PushAt() — when S3→S4's push-in starts (the copy's S4 lead);
 * 10-09 (w9): s2RevealAt() — when the connect show's pull back to the
 * constellation starts (the S2 blurb's rise lead); s3Ignition() — { at, dur }
 * of S2→S3's ignition window (the copy's S3 lead; w9b's field rides it);
 * getStats({ peek }) — the bench's readout (peek = the live read);
 * getFlightTrack() / getChipBoxes() — ?debug probe reads (the break track,
 * the chips as last painted); applyTuning() / replay() — the bench.
 */
import { useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import buildGlobeGeometry from '../globe/buildGlobeGeometry.js';
import { createPanelMaterial } from '../globe/panelMaterial.js';
import buildCascadeTimeline, { panelDelay } from '../globe/cascade.js';
import { mulberry32, hashSeed } from '../work/world/seededLayout.js';
import { scrambleTo, SCRAMBLE_DURATION } from '../../lib/scramble.js';
import { CHAR_CUT, cutSchedule } from '../../lib/charCut.js';
import DragMomentum from '../../lib/dragMomentum.js';
import {
  LON_SEGMENTS,
  LAT_BANDS,
  GAP_DEG,
  CAP_DEG,
  RADIUS,
  INNER_SPHERE_SCALE,
  CAMERA_FOV,
  FPS_CAP,
  DPR_MAX,
  AUTO_ROTATE_SPEED,
  INITIAL_PITCH_DEG,
  PITCH_LIMIT_DEG,
  DRAG_SENSITIVITY,
  MAX_FLICK_SPEED,
  GAP_COLOR,
  PREFERS_REDUCED_MOTION,
} from '../globe/globeConfig.js';
import { TURN_EASE_PATH } from '../work/world/worldConfig.js';
import {
  IS_MOBILE,
  DEBUG,
  TUNING,
  LIT_COLOR,
  STROKE_COLOR,
  WHITE_COLOR,
  S5_STROKE_A,
  S5_STROKE_B,
  DESKTOP_OFFSET_X,
  EXIT_RATIO,
  PASS_BEATS,
  CAM_LAG_S,
  FRAME_GATE_SLACK,
  FIELDS,
  S5_RAMP,
  fieldOf,
  ctaRamp,
  ctaInk,
  seamColor,
  s5DropAt,
  beatKeyed,
} from './processConfig.js';
import { settleDebounce } from '../../lib/settleResize.js';
import { chipInk, relLum } from '../../lib/projectColor.js';
import { STAGES, CTA } from './processContent.js';

gsap.registerPlugin(CustomEase);

const NOOP_API = {
  goTo: () => {},
  setStageInstant: () => {},
  getStage: () => null,
  leaveLabels: () => {},
  leaveThreadWords: () => {},
  setHeroMark: () => {},
  setCopyBeat: () => {},
  s4PushAt: () => 0,
  s2RevealAt: () => 0, // 10-09 (w9)
  s3Ignition: () => ({ at: 0, dur: 0 }), // 10-09 (w9)
  getStats: () => ({ fps: 0, calls: 0, stage: null }),
  applyTuning: () => {},
  replay: () => {},
};
const TOTAL_ROWS = LAT_BANDS + 2;
// 10-07 (w7, cta-finale): the CTA is a stage — the walk's last beat.
const STAGE_IDS = ['hero', 'stage-01', 'stage-02', 'stage-03', 'stage-04', 'stage-05', 'cta'];
// The break's fixed beats (10-07 — constants, not knobs): the dead-still
// white hold before the impact, the burn inside the wind-up, the launch
// spread, the cooling (a fraction of the flight — see buildShatter), and
// the shock ring's run (O radii, px, s).
const BREAK_HITCH = 0.05;
const BREAK_BURN = 0.28;
const BREAK_STAGGER = 0.08;
const BREAK_COOL = 0.62;
const SHOCK = { from: 1.05, to: 3.2, px: 3, seconds: 0.35 };
const IDENTITY_QUAT = new THREE.Quaternion();
/* 10-07 (final review): the lens's half-angle tangent. CAMERA_FOV never
   changes at runtime (the camera is built with it once), so one constant
   serves every projection site — it was re-derived at twelve. */
const TAN_V = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* Per-stage rest poses, computed fresh from TUNING at every use so live
   tuning applies. form: 'belt' (scattered Fragments, no inner sphere) or
   'core' (assembled globe). frameR = effective radius the contain fit
   frames; panelScale = emanation; power/stroke = the panel language;
   innerScale = the filled-core sphere (0 = dissolved — S4/S5, where it
   would block the expanded world's gap-lattice); bg = the staged
   background's ROLE (10-10, w9c — a role, not a colour: 'open' the opening
   field — hero/S1/S2 / 'solid' the other field, grown from the Core at the
   ignition — S3/S4 / 'gradient' the home hero's ramp — S5 and the CTA, whose
   `ramp` is the black stop's height). processConfig's fieldOf resolves the
   role × ?opening to the colour (black → blue → gradient by default; the
   pre-w9c blue → black on ?opening=blue). White copy throughout. The white
   blank-canvas start is retired).
   Reduced motion keeps stage-02 as the connected belt (Thread pre-drawn,
   static) so the narrative survives as stills — and since 10-09 (w9) so
   does motion: `thread: true` marks that belt (no tour, no haze, beads
   claimed, the phone lift).
   10-07 (w4): innerColor = the SEAMS — the inner sphere's colour, which is
   what reads between the panels as the lat/long lattice. GAP_COLOR blue
   through S2 (the blueprint read); ?coreseam (black | white) from S3 on, where
   the lit panels are the same #0000FF and a blue sphere erased every seam.
   Every pose also carries its stage `id` (getPose) — the phone lift measures
   that stage's copy card. */
// 10-10 (w9c): the lit world's edge ink on the SOLID field (S3/S4) — the
// field table's row: 1 on blue, 0 on black (?opening=blue = w9b's 0).
const solidInk = () => FIELDS[fieldOf('solid')].ink;
// 10-10 (w9c fix2, cta-ink-phone): ?ctaink auto's verdict — does the black
// edge ink outread the lit world on the field under the CTA world's lower
// silhouette? (1 | 0.) The scene registers it at mount — the rest geometry
// and the ramp live there — and poseFor('cta') reads it.
let ctaEdgeInk = () => 1;
const beltPose = () => ({
  form: 'belt',
  frameR: TUNING.scatter * 1.15 + 0.45,
  fill: TUNING.fillFraction,
  panelScale: 1,
  power: TUNING.idlePower,
  stroke: 1,
  innerScale: 0,
  // Nathan (rev): the opening is the BRAND-BLUE field again — the white
  // blank-canvas start read as jarring. White copy/chrome sits over it and the
  // Fragments gather on blue (STROKE_COLOR separates them); the world goes
  // black from S3 on. The P2 white-canvas experiment is reverted.
  // 10-10 (w9c, Nathan: "start on black instead of blue"): REVERSED — the
  // opening is BLACK and the Fragments read by their light (the strokes
  // still separate overlaps); blue grows out of the Core at S3. The role
  // keeps the order in one place (?opening=blue = the rev above).
  bg: 'open',
  innerColor: GAP_COLOR,
  loops: false,
  decoys: true, // the S1 flood — culled at the refinement
});
const poseFor = (id) => {
  switch (id) {
    case 'hero':
      // 10-07: the shards ARE the globe-O here — hidden in the scene while
      // the lockup's own canvas draws the mark (the shatter takes it over).
      // The belt's framing and haze, so the break never moves the camera
      // and the shards come forward out of the same air the belt hangs in.
      // Reduced motion keeps an empty field: the real O glyph stays.
      return { ...beltPose(), form: 'hero', decoys: false };
    case 'stage-01':
      return beltPose();
    case 'stage-02':
      // 10-09 (w9, s2-hold — Nathan: "hold the animation of the core being
      // assembled until you scroll to Core Assembly"): S2 rests on the
      // REFINED, CONNECTED belt — the flood culled, the Thread drawn through
      // its claimed beads — in motion as it always was under reduced motion.
      // `thread` keys every S2-only branch (poseFog, the phone lift, the
      // tour gates, the Thread's string-in and claims); the Core is S3's.
      return { ...beltPose(), decoys: false, thread: true };
    case 'stage-03':
      // Rev: at the solidify the Core's field floods to brand BLACK (grows
      // from the core over the blue opening) — the world sits on black from
      // P3 on (matches the homepage globe's black backdrop).
      // 10-07 (w5): NO loop — the seams and the spec sheet own S3's rest
      // (whether S3 should pulse too is Nathan's call).
      // 10-10 (w9c): the SOLID field — BLUE by default: the Core's light
      // floods the page at the ignition. On blue the lit #0000FF panels ARE
      // the field, so the black edge ink draws the Core with its seams (the
      // table's `ink`: 1 on blue, 0 on black — ?opening=blue keeps w9b's 0).
      return { form: 'core', frameR: 1, fill: TUNING.s3Fill, panelScale: 1, power: 1, stroke: solidInk(), innerScale: INNER_SPHERE_SCALE, bg: 'solid', innerColor: seamColor(), loops: false };
    case 'stage-04':
      // Rev: the built world keeps sitting on the brand-BLACK field (P3→P4).
      // 10-07 (w5, s4-heartbeat): `loops` names its KIND now (startLoops
      // dispatches on it) — S4 rests on a faint unison heartbeat every 2
      // beats, so S5's drop pays off a build instead of starting cold.
      // 10-08 (w8): a dip of the world's light (uPower), not the stroke.
      // 10-10 (w9c): S4 holds the solid field (blue by default) — at power 1,
      // no seams (innerScale 0), the world at stroke 0 would be INVISIBLE on
      // blue; the table's ink outlines every tile, and the heartbeat dims them
      // inside their outlines.
      return { form: 'core', frameR: TUNING.emanateScale, fill: TUNING.s45Fill, panelScale: TUNING.emanateScale, power: 1, stroke: solidInk(), innerScale: 0, bg: 'solid', innerColor: seamColor(), loops: { kind: 'heartbeat', every: 2 } };
    case 'stage-05':
      // v2 deck (B8): slight push-in over the S4 framing (?s5zoom) and an
      // axis lean toward ~2:00 (?s5tilt) — the world, emphasized, off-axis.
      // 10-10 (w9c): the home hero's ramp, as built (S5_RAMP); S5's ink is
      // its rhythm's own (lit = no ink — buildS5Loop).
      return { form: 'core', frameR: TUNING.emanateScale, fill: TUNING.s45Fill * TUNING.s5Zoom, panelScale: TUNING.emanateScale, power: 1, stroke: 0, innerScale: 0, bg: 'gradient', ramp: S5_RAMP, innerColor: seamColor(), loops: { kind: 'rhythm' }, tilt: -THREE.MathUtils.degToRad(TUNING.s5TiltDeg) };
    case 'cta':
      // 10-07 (w7, cta-finale): the S5 world RESOLVED — full power, no ink
      // (the resolve's target, and pulseOn's rest for the freed shard) —
      // stepped back into the FREE rect beside the ask (framingFor: ?ctafill
      // of that rect's fit). After the resolve it breathes or holds lit
      // (?ctaloop); `finale` = THE TURN (?finale).
      // 10-10 (w9c, "have the gradient cover more of the background on phase
      // 6"): the ramp's black stop reaches ?ctaramp up the viewport — and the
      // world, standing higher into the blue, takes the blue field's edge ink
      // with its light (?ctaink auto: where the ink outreads it — fix2 below;
      // never at the pre-w9c 0.4, so the blue arm keeps w9b's ink-less resolve).
      // 10-10 (w9c fix2, cta-ink-phone): field-aware, not ramp-aware — the
      // phone's world sits over the ramp's near-black top and goes ink-free.
      return {
        ...poseFor('stage-05'),
        fill: TUNING.ctaFill,
        ramp: ctaRamp(),
        stroke: ctaInk(ctaEdgeInk()),
        loops: TUNING.ctaLoop === 'hold' ? false : { kind: 'breathe' },
        finale: TUNING.finale !== 'off',
      };
    default:
      return null;
  }
};
// 10-07 (w4, phone-core-lift): every pose knows its stage — framingFor's
// phone lift reads that stage's copy card (phoneCardTop).
const getPose = (id) => {
  const p = poseFor(id);
  return p && { id, ...p };
};

/* Per-shard tumble, seeded (09-09, Nathan: "some of the fragments rotating
   at a faster rate than the others on different rotation axes, governed by
   random seed"). Two things vary, both drawn from the belt's own PRNG so a
   re-seed is reproducible:
   · AXIS — most shards tumble on a free 3D axis; a seeded minority spins on
     a CARDINAL one, which reads as a clean flat turn against the general
     wobble and keeps the cloud from looking uniformly noisy;
   · RATE — a ?spinfastfrac slice lands on a FAST tier (× ?spinfast), the
     rest on the slow base. The contrast is what makes the field read as
     depth rather than one drifting sheet, and it is what a close-up needs:
     at the wide every shard turned alike. */
const spinAxis = (rand) => {
  const pick = rand();
  if (pick < 0.1) return new THREE.Vector3(1, 0, 0);
  if (pick < 0.2) return new THREE.Vector3(0, 1, 0);
  if (pick < 0.3) return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
};
const spinRate = (rand) =>
  rand() < TUNING.spinFastFrac
    ? Math.max(TUNING.spinFast, 0) * (0.7 + rand() * 0.6)
    : 0.4 + rand() * 0.8;

/* Equator-out radiation — the trivial third delay model beside
   panelDelay's rows/poles/sweep (spec §3 S5): the inverse of `poles`. */
const maxRing = Math.floor((TOTAL_ROWS - 1) / 2);
const equatorOutDelay = (panel) => {
  const ring = Math.min(panel.row, TOTAL_ROWS - 1 - panel.row);
  return (maxRing - ring) * 0.22 + panel.lonIndex * 0.015 + Math.random() * 0.05;
};

/* Recover the panel's NATURAL spherical param as a 0..1 attribute for the
   edge stroke — pole wedges replace `uv` with a planar projection whose
   border doesn't hug the wedge silhouette (see panelMaterial.js). Must
   run BEFORE the local-origin re-bake (positions still on the sphere).
   The ±π seam panel unwraps by shifting negatives up a turn. */
const bakeEdgeUv = (geometry) => {
  const pos = geometry.attributes.position;
  const n = pos.count;
  const phi = new Float32Array(n);
  const theta = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const x = pos.getX(k);
    const y = pos.getY(k);
    const z = pos.getZ(k);
    const r = Math.sqrt(x * x + y * y + z * z) || 1;
    theta[k] = Math.acos(Math.min(Math.max(y / r, -1), 1));
    phi[k] = Math.atan2(z, -x); // x = −r·cosφ·sinθ, z = r·sinφ·sinθ
  }
  let phiMin = Infinity;
  let phiMax = -Infinity;
  for (let k = 0; k < n; k++) {
    if (phi[k] < phiMin) phiMin = phi[k];
    if (phi[k] > phiMax) phiMax = phi[k];
  }
  if (phiMax - phiMin > Math.PI) {
    phiMin = Infinity;
    phiMax = -Infinity;
    for (let k = 0; k < n; k++) {
      if (phi[k] < 0) phi[k] += Math.PI * 2;
      if (phi[k] < phiMin) phiMin = phi[k];
      if (phi[k] > phiMax) phiMax = phi[k];
    }
  }
  let thMin = Infinity;
  let thMax = -Infinity;
  for (let k = 0; k < n; k++) {
    if (theta[k] < thMin) thMin = theta[k];
    if (theta[k] > thMax) thMax = theta[k];
  }
  const uv = new Float32Array(n * 2);
  const phiRange = phiMax - phiMin || 1;
  const thRange = thMax - thMin || 1;
  for (let k = 0; k < n; k++) {
    uv[k * 2] = (phi[k] - phiMin) / phiRange;
    uv[k * 2 + 1] = (theta[k] - thMin) / thRange;
  }
  geometry.setAttribute('aEdgeUv', new THREE.BufferAttribute(uv, 2));
};

export default function useProcessScene(containerRef, chromeRefs) {
  const apiRef = useRef(NOOP_API);

  // Layout effect: the scroll driver's useGSAP (called after this hook)
  // syncs the arrival stage on mount — the machine must exist by then.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    const turnEase = CustomEase.create('processTurn', TURN_EASE_PATH);
    // The break's flight curve: a near-vertical launch (≈37% of the way in
    // 0.11s of a 2.6s flight) into a long, flat hang — y never passes 1, so
    // no shard overshoots its slot. That tail is the suspended animation.
    const shatterEase = CustomEase.create('processShatter', 'M0,0 C0.04,0.7 0.2,1 1,1');

    /* — Renderer / scene / camera — */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 50);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    /* — The 84 panels + inner occlusion sphere — */
    const { panels, innerSphereGeometry } = buildGlobeGeometry({
      lonSegments: LON_SEGMENTS,
      latBands: LAT_BANDS,
      gapDeg: GAP_DEG,
      capDeg: CAP_DEG,
      radius: RADIUS,
    });
    const strokeColor = new THREE.Color(STROKE_COLOR);
    const s5StrokeA = new THREE.Color(S5_STROKE_A);
    const s5StrokeB = new THREE.Color(S5_STROKE_B);
    panels.forEach((panel) => {
      // Edge-stroke UVs first (needs on-sphere positions), then re-bake
      // the shard to its own local origin (see header note).
      bakeEdgeUv(panel.geometry);
      panel.homeOffset = panel.centerDir.clone().multiplyScalar(RADIUS);
      panel.geometry.translate(-panel.homeOffset.x, -panel.homeOffset.y, -panel.homeOffset.z);
      // Shard extent about its own origin — the annotation chips test against
      // it as a screen circle when choosing a readable seat.
      panel.geometry.computeBoundingSphere();
      panel.geometry.computeBoundingBox(); // 10-08 (w8 fix2): exactCover's rays take the box test before the triangles
      panel.boundRadius = panel.geometry.boundingSphere?.radius ?? 0.2;
      panel.driftFactor = 1; // 1 free-drifting → damped on claim → 0 assembled
      panel.mesh = new THREE.Mesh(
        panel.geometry,
        createPanelMaterial({ fallbackColor: LIT_COLOR })
      );
      panel.mesh.material.uniforms.uStrokeColor.value.copy(strokeColor);
      globeGroup.add(panel.mesh);
    });

    /* — Decoy pool (v2 deck, B4): stage-01 floods with MORE shards than
       the final 84 — raw gathered material, culled at the refinement.
       A separate pool so the panels array's invariants (cascade, thread
       hops, assembly order, rhythm) never see them — and ONE InstancedMesh
       so the whole flood costs a single draw call (the ≤90 budget).
       Decoys never individuate: they flicker out at S1→S2. — */
    const DECOY_COUNT = 36;
    const decoyProto = panels.find((p) => p.row === Math.floor(TOTAL_ROWS / 2)) ?? panels[0];
    const decoyGeometry = decoyProto.geometry.clone();
    const decoyMaterial = createPanelMaterial({ fallbackColor: LIT_COLOR });
    decoyMaterial.uniforms.uStrokeColor.value.copy(strokeColor);
    // 10-07 (final review): the flood takes the break's white heat on the
    // panels' clock (decoysArrive) — uBlueMix is that burn here too.
    decoyMaterial.uniforms.uBlueColor.value.set(WHITE_COLOR);
    decoyGeometry.computeBoundingSphere();
    const decoyRadius = decoyGeometry.boundingSphere?.radius ?? 0.2;
    const decoyMesh = new THREE.InstancedMesh(decoyGeometry, decoyMaterial, DECOY_COUNT);
    decoyMesh.frustumCulled = false; // instances spread far beyond the proto's bounds
    decoyMesh.visible = false;
    globeGroup.add(decoyMesh);
    const decoys = Array.from({ length: DECOY_COUNT }, () => ({
      pos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      axis: new THREE.Vector3(1, 0, 0),
      speedRatio: 1,
      scale: 1,
      phase: 0,
      s: 0, // flicker scale factor — gsap-driven, composed into the matrix
    }));
    const decoyM4 = new THREE.Matrix4();
    const decoyScaleV = new THREE.Vector3();
    const decoySpin = new THREE.Quaternion();
    const composeDecoys = () => {
      decoys.forEach((d, i) => {
        decoyScaleV.setScalar(Math.max(d.scale * d.s, 0.0001));
        decoyM4.compose(d.pos, d.quat, decoyScaleV);
        decoyMesh.setMatrixAt(i, decoyM4);
      });
      decoyMesh.instanceMatrix.needsUpdate = true;
    };

    /* Seeded belt: one slot cloud for panels + decoys — phyllotaxis
       annulus with an empty center (the Core's center-to-be, where the
       Thread fires from), deterministically shuffled so decoys interleave
       with the keepers instead of ringing the rim. Deterministic for a
       given ?scatter, so live re-seeding through applyTuning keeps the
       same belt shape.
       v2 deck (B4): the cloud is SUSPENDED — zero collisions. A few
       deterministic relaxation passes push near pairs apart in 3D (the
       z spread does the heavy lifting where the annulus is dense), then
       clamp back to the belt envelope. */
    const seedBelt = () => {
      const rand = mulberry32(hashSeed('process-belt'));
      const innerR = TUNING.scatter * 0.55;
      const outerR = TUNING.scatter * 1.15;
      const zMax = TUNING.scatter * 0.3;
      const total = panels.length + decoys.length;
      const slots = Array.from({ length: total }, (_, i) => {
        const t = (i + 0.5) / total;
        const r = Math.sqrt(innerR * innerR + t * (outerR * outerR - innerR * innerR));
        const ang = i * GOLDEN_ANGLE + rand() * 0.5;
        return new THREE.Vector3(
          Math.cos(ang) * r,
          Math.sin(ang) * r,
          (rand() - 0.5) * 2 * zMax
        );
      });
      const MIN_SEP = 0.52 * (TUNING.scatter / 1.8); // tracks the spread knob
      const push = new THREE.Vector3();
      for (let iter = 0; iter < 8; iter++) {
        for (let i = 0; i < total; i++) {
          for (let j = i + 1; j < total; j++) {
            push.subVectors(slots[i], slots[j]);
            const dist = push.length();
            if (dist > 0.0001 && dist < MIN_SEP) {
              push.multiplyScalar(((MIN_SEP - dist) / dist) * 0.5);
              slots[i].add(push);
              slots[j].sub(push);
            }
          }
        }
        slots.forEach((s) => {
          const r = Math.hypot(s.x, s.y);
          const clamped = Math.min(Math.max(r, innerR * 0.9), outerR * 1.12);
          if (r > 0.0001 && Math.abs(clamped - r) > 0.0001) {
            s.x *= clamped / r;
            s.y *= clamped / r;
          }
          s.z = Math.min(Math.max(s.z, -zMax * 1.4), zMax * 1.4);
        });
      }
      const order = slots.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
      panels.forEach((panel, i) => {
        // 10-07 (w2 fix): the slot INDEX survives a re-seed — matchSlots
        // permutes it at every impact, so a bench touch re-spreads the slot
        // geometry under the LIVE assignment instead of snapping a matched
        // cloud (and every shard still in the air) back to the seeded order.
        // The identity until the first break.
        if (panel.slotIx == null) panel.slotIx = i;
        panel.beltPos = slots[order[panel.slotIx]];
        panel.beltQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2)
        );
        panel.drift = {
          // Suspended point cloud: LINEAR self-rotation only (the whole-cloud
          // rotation is globeGroup's yaw) — no positional wobble; positions
          // rest at beltPos. Axis and rate are the seeded tiers above.
          axis: spinAxis(rand),
          speedRatio: spinRate(rand), // × TUNING.drift at tick time
          phase: rand() * Math.PI * 2, // seeded stagger for entrances
        };
      });
      decoys.forEach((d, i) => {
        // Keep the slot itself: the prolonged cull (decoysOut) tweens d.pos
        // off-frame for the falling cohort — belt returns restore from here.
        d.beltPos = slots[order[panels.length + i]];
        d.pos.copy(d.beltPos);
        d.quat.setFromEuler(
          new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2)
        );
        d.axis.copy(spinAxis(rand)); // the decoy flood tumbles on the same tiers
        d.speedRatio = spinRate(rand);
        d.scale = 0.72 + rand() * 0.26; // raw material reads slightly smaller
        d.phase = rand() * Math.PI * 2;
      });
      composeDecoys();
    };
    seedBelt();

    const innerMaterial = new THREE.MeshBasicMaterial({ color: GAP_COLOR });
    const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
    innerSphere.scale.setScalar(0.001); // surfaces at the assembly
    innerSphere.visible = false;
    globeGroup.add(innerSphere);

    /* — The globe-O's stand-in (10-07). heroGroup is a WORLD-space frame —
       not under globeGroup, whose yaw must not carry it — seated on the
       lockup's live screen disc: centred on the O, ?shatterdepth × the
       belt's camera distance deep, scaled so one unit is the O's radius.
       heroQuat is the lockup's own orientation (the brand pitch wrapping
       its spin), so the shards seat on the meridians the mark is showing.
       heroCore is the white disc behind them at the RING's radius: burned
       white, the lockup's tiles, lattice and ring are one white disc, and
       this is that disc — the swap frame is white on white. Every panel's
       uBlueColor goes white with it (the scene never uses the commit fill
       otherwise), so uBlueMix is the shards' white-hot burn. — */
    const heroGroup = new THREE.Group();
    scene.add(heroGroup);
    const heroQuat = new THREE.Quaternion();
    const heroEuler = new THREE.Euler();
    const heroCoreGeometry = new THREE.CircleGeometry(1, 64);
    const heroCoreMaterial = new THREE.MeshBasicMaterial({ color: WHITE_COLOR }); // --color-white, the ring's fill
    const heroCore = new THREE.Mesh(heroCoreGeometry, heroCoreMaterial);
    heroCore.visible = false;
    heroGroup.add(heroCore);
    let heroRingK = 1.035; // ring radius ÷ globe radius — restated from the live mark
    // Its own PRNG: drawing from the belt's would reshuffle every slot.
    const breakRand = mulberry32(hashSeed('process-break'));
    panels.forEach((p) => {
      p.mesh.material.uniforms.uBlueColor.value.set(WHITE_COLOR);
      // The flight record a break (or a reform) steps every frame
      p.fl = {
        t: 0,
        S: new THREE.Vector3(),
        N: new THREE.Vector3(), // the bow (w2): world space on a burst, re-solved per frame on a reform
        Sq: new THREE.Quaternion(),
        Bq: new THREE.Quaternion(),
        theta: 0,
        s0: 1,
        t0: 0, // scene time at the impact — the drift's clock through the flight
        done: true,
        // The break runs EQUATOR FIRST: the sphere lets go where it spins
        // fastest, the caps a beat behind (polar-ness + a seeded scatter).
        delay: BREAK_STAGGER * (0.55 * Math.abs(p.centerDir.y) + 0.45 * breakRand()),
        span: 0.9 + breakRand() * 0.2, // ± a tenth on the flight, so no two land together
      };
    });

    /* The shock: a white ring on the O's own tilted equator, run out to
       3.2 O radii while it thins to nothing — a line that thins, never one
       that fades. Depth-tested with the scene, so the flying shards cut
       it. ?oshock gates it. */
    const shockGeometry = new LineGeometry();
    const shockPts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      shockPts.push(Math.cos(a), 0, Math.sin(a));
    }
    shockGeometry.setPositions(shockPts);
    const shockMaterial = new LineMaterial({ color: WHITE_COLOR, linewidth: SHOCK.px }); // --color-white
    const shockRing = new Line2(shockGeometry, shockMaterial);
    shockRing.visible = false;
    shockRing.frustumCulled = false;
    heroGroup.add(shockRing);

    /* — The Thread, promoted to a true in-scene line (v2 deck, B3). It
       was a screen-space SVG overlay composited above the whole render —
       impossible to occlude. Now a Line2 (screen-width wide line) child
       of globeGroup with depthTest on: opaque Fragments in front of a
       segment hide it, and as the shell assembles the surfacing inner
       sphere swallows the interior chords — the string is obscured INTO
       the globe instead of fading out on top of it. Segments stay
       STRAIGHT (world-space chords; no intermediate vertices), and each
       hop attaches via the shard's INSIDE normal — the concave side —
       so a shard facing the camera hides its own connection point. Ink
       black, the Fragment stroke's color on the blue field.
       10-08 (w8, ?threadink): mid-trace that ink and width read as one
       more shard edge (only dots_connected NN/42 proved the trace) — the
       A/B `white` draws it in the leader's WHITE_COLOR; the same
       LineMaterial, dash and alpha draw. `stroke` (today) is the default.
       10-10 (w9c): `auto` (PROPOSED default) = the field table's thread ink
       for the OPENING field the string always draws on (the reconnect
       starts after the shrink; the assembly swallows it before the grow):
       white on black — a black string is invisible there — the stroke ink
       on blue. threadWhite() is the one test (the keep-out rides it). — */
    const ATTACH_DEPTH = RADIUS * 0.06;
    const threadInk = () =>
      TUNING.threadInk === 'white' ? WHITE_COLOR : TUNING.threadInk === 'stroke' ? STROKE_COLOR : FIELDS[fieldOf('open')].thread;
    const threadWhite = () => threadInk() === WHITE_COLOR;
    const threadMaterial = new LineMaterial({
      color: threadInk(),
      linewidth: TUNING.strokePx,
      transparent: true,
      dashed: true,
      gapSize: 1e6, // trim-path draw: dashSize = drawn length, one dash
    });
    const threadGeometry = new LineGeometry();
    threadGeometry.setPositions([0, 0, 0, 0, 0, 0]);
    const threadLine = new Line2(threadGeometry, threadMaterial);
    threadLine.visible = false;
    /* 10-07 (w4 fix): the Thread's words (S2) sit OVER their string — a
       black chord struck BRAND_CADENCE through on the phone walk. The line
       is the first transparent draw and stamps no depth, so a chip (also
       transparent, depthWrite off) paints over it while both still test
       against the opaque shards — the shards keep hiding the line AND the
       chips; only line-over-chip is gone. */
    threadMaterial.depthWrite = false;
    threadLine.renderOrder = -1;
    globeGroup.add(threadLine);
    /* 10-08 (w8 fix, ?threadink white): the line runs UNDER the copy, and
       white over white letters read as strikethrough (the stroke ink showed
       between them). Where it crosses the type — the keep boxes' BARE rects
       (keepBoxes: the copy first, then the chrome), refilled every frame
       while the white arm draws (syncThreadKeep) — it takes the stroke ink.
       `stroke` never fills the list: 0 rects, the loop does nothing.
       10-10 (w9c): any WHITE string — `auto` on the black opening too
       (threadWhite); there the stroke ink IS the field, so under the type
       the string simply goes. */
    const THREAD_KEEP_MAX = 16;
    const threadKeep = {
      rects: { value: Array.from({ length: THREAD_KEEP_MAX }, () => new THREE.Vector4()) },
      count: { value: 0 },
      ink: { value: new THREE.Color(STROKE_COLOR) },
    };
    threadMaterial.uniforms.keepRects = threadKeep.rects;
    threadMaterial.uniforms.keepCount = threadKeep.count;
    threadMaterial.uniforms.keepInk = threadKeep.ink;
    threadMaterial.fragmentShader = threadMaterial.fragmentShader
      .replace(
        'uniform float opacity;',
        `uniform float opacity;
        uniform vec4 keepRects[${THREAD_KEEP_MAX}];
        uniform int keepCount;
        uniform vec3 keepInk;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        for (int i = 0; i < ${THREAD_KEEP_MAX}; i++) {
          if (i >= keepCount) break;
          vec4 k = keepRects[i];
          if (all(greaterThanEqual(gl_FragCoord.xy, k.xy)) && all(lessThanEqual(gl_FragCoord.xy, k.zw))) {
            diffuseColor.rgb = keepInk;
            break;
          }
        }`
      );

    /* — Framing: tan-space contain fit (mobile too — the belt must fit
       whole, spec §7; never the home cover-overscan). Right-of-center on
       desktop via group offset. — */
    const framingFor = (pose) => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const tanV = TAN_V;
      const tanH = tanV * (w / h);
      const tanFit = Math.min(tanV, tanH);
      /* 10-07 (w7, cta-finale): the CTA frames into its FREE rect
         (ctaRestGeom) — ?ctafill of that rect's contain fit, the globe's
         centre on the rect's centre. */
      if (pose.id === 'cta') {
        const { rect } = ctaRestGeom();
        const rw = Math.max(rect.x1 - rect.x0, 1);
        const rh = Math.max(rect.y1 - rect.y0, 1);
        const tanR = Math.max(pose.fill, 0.05) * (Math.min(rw, rh) / h) * tanV;
        // never past the far plane (a degenerate rect framed the world out of it)
        const zc = Math.min((RADIUS * pose.frameR) / Math.sin(Math.atan(tanR)), camera.far * 0.8);
        return {
          z: zc,
          offsetX: (((rect.x0 + rect.x1) / 2 - w / 2) / (w / 2)) * zc * tanH,
          offsetY: -(((rect.y0 + rect.y1) / 2 - h / 2) / (h / 2)) * zc * tanV,
        };
      }
      const z = (RADIUS * pose.frameR) / Math.sin(Math.atan(pose.fill * tanFit));
      const offsetX = IS_MOBILE ? 0 : z * tanH * DESKTOP_OFFSET_X;
      /* Phone: the vertical analog of the desktop offset. 10-07 (w4,
         phone-core-lift): the copy cards are BOTTOM-anchored since 09-08, so
         the old drop (?dropy, tuned for a centred band) left the S2 Core —
         the first world on the page, the Thread's payoff — half under its
         card. The Core now LIFTS just far enough to keep ?cardgap px of air
         above the card at the section's centred rest, never past the nav
         (room clamps at 0, so S4/S5's frame-filling world gets no lift), and
         ?dropy stays the fine adjustment subtracted after it. The sparse
         belt reads fine behind full-width copy and stays centred. */
      // 10-09 (w9, s2-hold): …and S2's connected constellation (pose.thread)
      // — its card grew a lead line, and the string is the payoff, so it
      // lifts clear of the card the same way (its rPx is the belt's bound).
      let offsetY = 0;
      if (IS_MOBILE && (pose.form === 'core' || pose.thread)) {
        const rPx = ((pose.fill * tanFit) / tanV) * (h / 2); // the Core's screen radius
        const need = h / 2 + rPx + TUNING.cardGap - phoneCardTop(pose.id, h);
        const room = h / 2 - rPx - navBottomPx();
        const liftPx = Math.max(0, Math.min(need, room));
        offsetY = ((2 * liftPx) / h) * z * tanV - z * tanV * TUNING.mobileDrop;
      }
      return { z, offsetX, offsetY };
    };
    /* 10-07 (w4, phone-core-lift): where a stage's copy card starts, px from
       the canvas top, AT THE SECTION'S CENTRED REST (the driver rests each
       section at top + (offsetHeight − innerHeight)/2) — never the live
       scroll, so a transition built mid-glide frames the same rest the
       settle lands on. Layout boxes only (offsetTop inside the
       position:relative section): the blurb's entrance rise is a transform
       and must not move the card. Lazy DOM (client:only islands go stale),
       cached until the resize settle or the webfont lands. */
    const CARD_PARTS = '.process-stage__chip, .process-stage__headline, .process-stage__blurb, .process-stage__caption';
    const cardTops = new Map();
    let navBottom = null;
    const phoneCardTop = (id, h) => {
      if (cardTops.has(id)) return cardTops.get(id);
      let top = h; // no card — nothing to clear
      const sec = id ? document.querySelector(`.process-page .process-section[data-stage="${id}"]`) : null;
      const first = sec?.querySelector(CARD_PARTS);
      if (sec && first) {
        const secTopAtRest = -(sec.offsetHeight - window.innerHeight) / 2;
        top = secTopAtRest + first.offsetTop - container.getBoundingClientRect().top;
      }
      cardTops.set(id, top);
      return top;
    };
    const navBottomPx = () => {
      if (navBottom == null) {
        const nav = document.querySelector('.site-nav');
        navBottom = nav ? Math.max(nav.getBoundingClientRect().bottom - container.getBoundingClientRect().top, 0) : 0;
      }
      return navBottom;
    };
    /* 10-07 (w7, cta-finale): THE CTA'S REST, predicted — the scene frames
       it (and picks the shard it frees) while the page is still gliding
       there. The rest is the document end (the driver's last stop): the
       links footer fully risen, the desktop nav slid away (global.css F1;
       a phone's bar stays). From layout boxes only — offset chains, never
       rects: the copy's entrance rises are transforms — lazy (client:only),
       cached until the resize settle or the webfont lands (forgetCards).
       · copy — the CTA's display, line, actions (+ the phone's in-flow
         back_to_top), container px at the rest;
       · footerTop — the risen panel's top edge;
       · rect — THE FREE RECT the globe sits in: the viewport above the
         footer minus the copy. Two candidates, the roomier short side wins:
         right of the copy column (desktop) or the band between the bar and
         the copy, less ?cardgap (the phone's bottom-anchored card) —
         neither roomy enough (CTA_RECT_MIN, a short phone): the whole field
         above the footer. */
    const CTA_PARTS = '.process-cta__display, .process-cta__line, .process-cta__actions, .process-cta__top';
    const CTA_RECT_MIN = 0.25; // the free rect's short side, at least this share of the field's (else the field)
    let ctaRest = null;
    const docOffset = (el) => {
      let x = 0;
      let y = 0;
      for (let n = el; n; n = n.offsetParent) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      return { x, y };
    };
    const ctaRestGeom = () => {
      if (ctaRest) return ctaRest;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const base = container.getBoundingClientRect();
      const doc = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);
      const footerH = document.querySelector('.site-footer--links')?.offsetHeight ?? 0;
      const footerTop = Math.min(window.innerHeight - footerH - base.top, h);
      const copy = [];
      document.querySelectorAll(`.process-page .process-cta :is(${CTA_PARTS})`).forEach((el) => {
        if (!el.offsetWidth || !el.offsetHeight) return; // display:none (desktop's phone-only chip)
        const o = docOffset(el);
        const x0 = o.x - window.scrollX - base.left;
        const y0 = o.y - maxScroll - base.top;
        copy.push({ x0, y0, x1: x0 + el.offsetWidth, y1: y0 + el.offsetHeight });
      });
      const top = IS_MOBILE ? navBottomPx() : 0;
      let rect = { x0: 0, y0: top, x1: w, y1: footerTop };
      if (copy.length) {
        const right = Math.max(...copy.map((b) => b.x1));
        const copyTop = Math.min(...copy.map((b) => b.y0));
        const side = { x0: Math.min(right + 2 * KEEP_PAD, w), y0: top, x1: w, y1: footerTop };
        const band = { x0: 0, y0: top, x1: w, y1: Math.max(copyTop - TUNING.cardGap, top) };
        const short = (r) => Math.min(r.x1 - r.x0, r.y1 - r.y0);
        const free = short(side) >= short(band) ? side : band;
        // 10-07 (w7): a SHORT phone has no free rect worth the name (375×667:
        // a 76px band; 320×640: none) — framed into it the world shrank past
        // the camera's far plane and vanished. Under CTA_RECT_MIN of the
        // field's short side the world takes the whole field above the
        // footer, behind the copy (S5's phone look, the frame-filling world
        // under the card).
        if (short(free) >= CTA_RECT_MIN * short(rect)) rect = free;
      }
      ctaRest = { copy, footerTop, footerH, rect, top };
      return ctaRest;
    };
    const forgetCards = () => {
      cardTops.clear();
      navBottom = null;
      ctaRest = null; // 10-07 (w7)
    };

    /* — Machine state — */
    let stage = null;
    let activeTl = null;
    // 10-07 (choreo-2): a forward step DURING the S1→S2 show doesn't cut it
    // — the show fast-forwards (?showrush) and this stage plays when it lands
    // (buildConnect's onComplete). `stage` stays 'stage-02' until
    // then; a second forward step only replaces it.
    let pendingNext = null;
    // 10-07 (choreo-2): every kill of the running transition goes through
    // here. A killed timeline is NOT dead to a live tween of its timeScale
    // (the show's rush ramp, or its ease back to ×1): each ramp tick calls
    // timeScale() → totalTime(), which re-adds a killed root child to the
    // global timeline — a jump inside the 0.3s ramp resurrected the show
    // over the reform (the O vanished, the next break flew from nowhere).
    // Ramp first, then the timeline — always at build time, never from the
    // timeline's own .call().
    const killActiveTl = () => {
      if (!activeTl) return;
      gsap.killTweensOf(activeTl);
      activeTl.kill();
    };
    // S5 axis lean (v2 deck, B8). The tick re-asserts rotation every
    // frame, so the tilt MUST live here and be read there — a tween on
    // globeGroup.rotation directly would be overwritten next frame.
    const tiltState = { z: 0 };
    let loopTl = null;
    let beltDrifting = false; // tick writes belt transforms only while true
    // 10-07, the hero: `heroIntact` = the shards are still the (hidden) O —
    // at the hero rest and through the wind-up, until the impact breaks it.
    let heroIntact = false;
    let heroMark = null; // the copy hook's controller (setHeroMark) — the DOM side of the O
    /* 10-07 (w4 fix): the copy hook's COPY_BEAT cue (setCopyBeat) — a
       section's copy lead counts from the scene's own beat, not the 60%
       line: (stage, 'full') as a transition is built whole and forward (S3:
       the light-up), 'plain' for a compressed / reversed / from-the-belt
       build (no breath, no cascade — skip the lead), 'queued' when the step
       lands during the S1→S2 show (it plays when the rushed show lands). */
    let copyBeat = null;
    let flightActive = false; // tick steps the break/reform paths while true
    let flightMode = 'burst';
    let sideTl = null; // the break's long tail + the decoy flood — runs past activeTl
    let heroReforming = false; // a reform is flying home: the word is back, the O isn't yet
    let impactAt = null; // performance.now() of the last impact — the probe aligns on it
    let replaying = false; // a bench replay: the full wind-up, from the O's rest seat
    let threadActive = false; // tick reprojects the Thread only while true
    // The tour's stations, blend and camera solutions live with the tour
    // itself (below the resize doctrine — they ride camLag); only the latch
    // has to be up here, because applyCamLag/retargetCam must stand down
    // while the tour owns camera.position.
    let tourTl = null;
    let tourActive = false;
    let tourLegTravel = 0; // 10-08 (w8b): the leg's glide, s, at the head of tourTl (0 = a wide's hold) — the predicted hold's camera clock
    let threadChain = [];     // claimed panels, hop order
    let threadDraw = { frac: 0, alpha: 1 };
    // 10-09 (w9, s2-hold): the last show's chain outlives the Thread — the
    // S2→S3 assembly swallows the line (clearThread) but S3→S2 un-peels the
    // Core back onto THIS string, and an instant S2 (a reload, a jump, the
    // bench) re-draws it rather than inventing a new one (s2Chain).
    let lastChain = [];
    // 10-09 (w9): a copy box kept out while still HIDDEN — S2's blurb waits
    // for the dots (useProcessCopy's rise lead), so the Thread's words must
    // never seat where it is about to rise (keepBoxes reads it).
    let keepHeld = null;

    /* — Atmospheric depth (09-09, Nathan). The belt is deep and the camera
       now travels into it, so distance has to READ: each shard's fill AND
       its black edge stroke are pulled toward the field color by view depth
       (panelMaterial's uFog*). Deliberately not opacity — every panel stays
       fully opaque; a shard far back is the same solid mesh, painted closer
       to the blue it sits on, the way haze eats a distant ridgeline.

       The window is ANCHORED IN WORLD DEPTH and deliberately ASYMMETRIC:
       it opens a quarter-span in FRONT of the belt's establishing distance
       (the group sits at z=0 and the camera looks down −Z, so that distance
       is the stage-01 contain-fit z) and reaches full weight ?fogspan ×
       ?scatter BEHIND it. Front-of-field shards therefore stay crisp and
       only what is genuinely further away recedes — a symmetric window
       hazed half the cloud at the establishing wide and read as a blue
       wash. Round 1 measured the window from the camera's OWN position, so
       a close-up hazed the same relative depth the wide did — which meant
       a far shard stayed just as faded as the camera pushed toward it.
       Nathan (09-10): haze is a property of the AIR between lens and
       shard, so the window sits still and the dolly moves through it — a
       shard the camera approaches clears.

       `amount` is the global strength, tweened to 0 as the Fragments
       assemble: the haze belongs to the gathering, not to the built
       world. — */
    const fogState = { amount: 0, near: 0, far: 1 };
    // The hero shares the belt's air: the O's shards start deep in it.
    // 10-09 (w9): S2's constellation is a belt with NO air (Nathan: "fade to
    // no atmospheric effect on the second slide") — the connect show burns
    // it off and the rest keeps it at 0.
    const poseFog = (pose) =>
      (pose.form === 'belt' && !pose.thread) || pose.form === 'hero' ? Math.max(TUNING.fog, 0) : 0;
    const fogV = new THREE.Vector3(); // 10-09 (w9b): a ghosted panel's world centre
    const applyFogUniforms = () => {
      const span = Math.max(TUNING.fogSpan * TUNING.scatter, 0.05);
      // uFogNear/Far are VIEW depths. Fixing them to the establishing
      // distance (not camera.position.z) is what makes the window still in
      // world terms: the dolly shortens every shard's view depth as it
      // pushes in, so what it approaches comes forward out of the haze.
      const baseZ = framingFor(getPose('stage-01')).z;
      /* 10-07 (w3, s1-air): ?fogride lets the window TRAVEL WITH THE LENS
         for a share of the push-in — 0 (the bake) holds it world-still as
         above; 0.7 slides near and far toward the shot by 70% of how far the
         camera has come in from the establishing distance. World-still, a
         lens that is inside the cloud has the whole window BEHIND it — every
         shard clears and a close-up loses the depth layering that makes the
         belt read as a place; riding, the close-up keeps it (the near shards
         crisp, the far ones still sinking into the field). Never on a
         pull-back: a camera behind baseZ rides nothing — the hero and the
         break hold the establishing frame, so they ride 0 either way. hazeAt
         (the chips' haze) reads the same fogState, so the chips ride too.
         A/B for Nathan against his 09-10 call (he untied the window from the
         dolly). */
      const ride = Math.max(baseZ - camera.position.z, 0) * Math.max(TUNING.fogRide, 0);
      const near = baseZ - span * 0.25 - ride;
      const far = baseZ + span - ride;
      fogState.near = near;
      fogState.far = far;
      /* 10-09 (w9b, s2-ghost): a GHOSTED panel's haze is the belt's composed
         with its ghost g = progress × ?s2ghost: every fragment's weight is
         1 − (1 − haze)(1 − g), i.e. g + (1 − g)·amount·ramp — the same
         channel, so fill AND stroke go toward the field together, never
         opacity. The ramp's near end first slides forward to the panel's
         own front (by the progress λ: none at λ 0), so at λ 1 every vertex
         is on the ramp and the composition is exact; then the window is
         re-solved as (nn, ff, amount') with the slope (1 − g)·amount and the
         offset g. With no air left (S2's rest, amount 0) it is a flat g. A
         panel with no ghost — every panel, wherever ?s2ghost is 0 or nothing
         is ghosted — takes the shared values exactly as before. */
      const G = Math.min(Math.max(TUNING.s2Ghost, 0), 1);
      let ghostM = false;
      /* 10-10 (w9c): WHAT the haze and the ghost recede into — the live
         field (liveField: the DOM layers' composite, linear), not the
         material's birth GAP_COLOR blue. Black on the opening by default, so
         a far shard sinks into black; it follows the grow, the shrink and
         every crossfade frame by frame (no jump: the layers are
         continuous). The colour only — never opacity; nothing moves. */
      const fieldNow = liveField();
      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const u = p.mesh.material.uniforms;
        u.uFogColor.value.copy(fieldNow);
        const lam = p.gh.k;
        if (G > 0 && lam > 0) {
          if (!ghostM) {
            globeGroup.updateMatrix();
            ghostM = true;
          }
          const g = lam * G;
          const A = Math.max(fogState.amount, 0);
          const tail = (1 - g) * A;
          if (tail < 1e-5) {
            u.uFogAmount.value = g + tail;
            u.uFogNear.value = -1e5;
            u.uFogFar.value = -1e5 + 1e-3;
          } else {
            fogV.copy(p.mesh.position).applyMatrix4(globeGroup.matrix);
            const front = camera.position.z - fogV.z - (p.boundRadius || 0.2) * p.mesh.scale.x;
            const n1 = near - Math.max(near - front, 0) * lam;
            const span1 = Math.max(far - n1, 1e-4);
            const nn = n1 - (g * span1) / tail;
            u.uFogAmount.value = g + tail;
            u.uFogNear.value = nn;
            u.uFogFar.value = nn + (span1 * (g + tail)) / tail;
          }
          continue;
        }
        u.uFogAmount.value = fogState.amount;
        u.uFogNear.value = near;
        u.uFogFar.value = far;
      }
      const du = decoyMaterial.uniforms;
      du.uFogColor.value.copy(fieldNow);
      du.uFogAmount.value = fogState.amount;
      du.uFogNear.value = near;
      du.uFogFar.value = far;
    };

    // Every render path funnels through here — the tick, the reduced-motion
    // single frames, the arrival stamp — so the haze can never be a frame
    // stale behind the dolly it is measured against.
    const renderFrame = () => {
      applyFogUniforms();
      composeS2Dots(); // 10-09 (w9b): S2's hit dots, on this frame's line
      if (labelSlots.length) flushLabelBatch(); // 10-09 (w9b): the chips' leaders + dots, one call each
      renderer.render(scene, camera);
      if (DEBUG) samplePix();
    };
    /* 10-09 (w9b, ?debug): the S2 harness's per-frame COLOUR PROBE — armed
       only when a harness sets window.__swmProcessPix = { ids, pts, out }
       (ids: panel indices or 'all'): right after each render ONE readPixels
       of the whole buffer, then per listed panel the per-channel median RGBA
       of its face centre and four points 0.3 of its screen radius off it (the
       median shrugs off a line or dot crossing one; null = off screen) and the
       five points' spread (0 = all on one flat face — the clean reads), plus
       any listed screen points (css px). Never armed off a harness. */
    const pixBuf = { a: null, w: 0, h: 0 };
    const pixW = new THREE.Vector3();
    const pixA = { x: 0, y: 0, depth: 0, perPx: 0 };
    const samplePix = () => {
      const probe = typeof window !== 'undefined' ? window.__swmProcessPix : null;
      if (!probe?.out) return;
      const gl = renderer.getContext();
      const W = gl.drawingBufferWidth;
      const H = gl.drawingBufferHeight;
      if (!pixBuf.a || pixBuf.w !== W || pixBuf.h !== H) Object.assign(pixBuf, { a: new Uint8Array(W * H * 4), w: W, h: H });
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixBuf.a);
      const view = screenView();
      const pr = W / Math.max(view.vw, 1);
      const read = (x, y) => {
        const px = Math.round(x * pr);
        const py = Math.round((view.vh - y) * pr);
        if (px < 0 || py < 0 || px >= W || py >= H) return null;
        const o = (py * W + px) * 4;
        return [pixBuf.a[o], pixBuf.a[o + 1], pixBuf.a[o + 2], pixBuf.a[o + 3]];
      };
      const med = (v) => v.slice().sort((x, y) => x - y)[v.length >> 1];
      globeGroup.updateMatrixWorld();
      const row = { t: +(performance.now() / 1000).toFixed(4), f: +sceneTime.toFixed(4), p: [], q: [] };
      const ids = probe.ids === 'all' ? panels.map((_, i) => i) : probe.ids ?? [];
      ids.forEach((id) => {
        const p = panels[id];
        pixW.copy(p.mesh.position);
        globeGroup.localToWorld(pixW);
        if (!toPx(pixW, view, pixA)) {
          row.p.push(null);
          return;
        }
        const r = (0.3 * (p.boundRadius || 0.2) * p.mesh.scale.x) / Math.max(pixA.perPx, 1e-6);
        const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].map(([ox, oy]) => read(pixA.x + ox, pixA.y + oy)).filter(Boolean);
        // [r, g, b, a] medians + the five points' spread (blue + red range: 0 = all on one flat face)
        row.p.push(
          pts.length < 5
            ? null
            : [...[0, 1, 2, 3].map((c) => med(pts.map((q) => q[c]))), Math.max(...pts.map((q) => q[2])) - Math.min(...pts.map((q) => q[2])) + Math.max(...pts.map((q) => q[0])) - Math.min(...pts.map((q) => q[0]))]
        );
      });
      (probe.pts ?? []).forEach(([x, y]) => row.q.push(read(x, y)));
      probe.out.push(row);
      if (probe.out.length > 4000) probe.out.shift();
    };

    /* — The staged background. Until 10-10 the page's base was the brand-BLUE
       opening (hero/S1/S2) and the layer that grew out of the Core at
       S2→S3 was BLACK. 10-10 (w9c — Nathan: "start on black instead of
       blue … when it goes to phase 3, it switches to the blue background"):
       the FIELD TABLE (processConfig FIELDS / fieldOf) names the colours and
       the poses name ROLES —
       · `open` — the page's own base (process.css, keyed on the root's
         data-opening): BLACK by default;
       · `solid` — `solidEl` (.process-bg__blue, a historical handle), the
         OTHER field: BLUE by default. S2→S3's ignition GROWS it out of the
         Core's live screen-space disc (clip-path circle tracking the dolly
         per frame) — the Core's light flooding the page; the reverse
         shrinks it back into the Core, restoring the opening (and opens
         w9b's reconnect);
       · `gradient` — the home hero's `to top` ramp (S5; the CTA's black
         stop reaches higher — pose.ramp, the element's --ps-ramp).
       DOM order is the stack: base < gradient < solid. Stage jumps and
       compressed catch-ups CROSSFADE (bgCrossfade — monotonic from whatever
       the layers show); a morph only reads against its dolly (so a bench
       jump ONTO S3 still grows: it plays the light-up's dolly). data-bg on
       the island root names the field's COLOUR (black | blue | gradient)
       for the DOM chrome (copy, tokens and captions are white on every
       field; the steppers' keyline still reads it). bgState mirrors every
       layer write — the self-heal, the haze's colour and peek read it. — */
    const rootEl = chromeRefs?.rootRef?.current ?? null;
    // The SOLID field layer (blue by default since w9c); shown on S3/S4.
    const solidEl = chromeRefs?.blueRef?.current ?? null;
    const gradientEl = chromeRefs?.gradientRef?.current ?? null;
    // s / g = the solid / gradient layers' opacity; ramp = the gradient's
    // black stop (fraction of the viewport up); cover = the share of the
    // viewport the solid's clip circle covers (1 = unclipped).
    // clip = the live circle ({ cx, cy, radius, w, h }, null = unclipped —
    // 10-10 (w9c fix R3): a crossfade picks a killed morph's circle up here)
    const bgState = { s: 0, g: 0, ramp: S5_RAMP, cover: 1, clip: null };

    // 10-10 (w9c fix R4): the ROLE last written, so a live ?opening flip
    // (applyTuning) re-resolves the colour name mid-step too — the timeline's
    // own call already fired under the old opening
    let bgRole = 'open';
    const setBgAttr = (role) => {
      bgRole = role;
      rootEl?.setAttribute('data-bg', fieldOf(role));
    };
    // autoAlpha's shape (visibility hidden at 0), written straight to the
    // element — the layers have NO tweens of their own since w9c (every fade
    // is a proxy inside its timeline), so nothing can eat an endpoint.
    const paintLayer = (el, a) => {
      if (!el) return;
      el.style.opacity = a >= 1 ? '1' : a.toFixed(4);
      el.style.visibility = a > 0 ? 'inherit' : 'hidden';
    };
    const setLayers = (s, g) => {
      bgState.s = s;
      bgState.g = g;
      paintLayer(solidEl, s);
      paintLayer(gradientEl, g);
    };
    const setRamp = (r) => {
      bgState.ramp = r;
      gradientEl?.style.setProperty('--ps-ramp', r.toFixed(4));
    };
    // null = unclipped (the whole canvas)
    const setClip = (c) => {
      if (!solidEl) return;
      if (!c) {
        solidEl.style.clipPath = 'none';
        bgState.cover = 1;
        bgState.clip = null;
        return;
      }
      solidEl.style.clipPath = `circle(${c.radius.toFixed(1)}px at ${c.cx.toFixed(1)}px ${c.cy.toFixed(1)}px)`;
      bgState.cover = Math.min((Math.PI * c.radius * c.radius) / Math.max(c.w * c.h, 1), 1);
      bgState.clip = c;
    };
    // A role's resting layers (g null = any: hidden under the opaque solid)
    const layersFor = (role) => (role === 'solid' ? { s: 1, g: null } : role === 'gradient' ? { s: 0, g: 1 } : { s: 0, g: 0 });
    // re-asserts the opening's own tokens (process.css) — the bench's ?opening
    const setOpening = () => rootEl?.setAttribute('data-opening', fieldOf('open'));

    /* 10-10 (w9c): THE LIVE FIELD, in the panels' working (linear) space —
       what the depth haze and S2's ghost recede into (uFogColor on every
       panel AND the decoy pool, applyFogUniforms — every frame, so it rides
       the grow, the shrink and every crossfade without a jump). The DOM's
       own composite, in sRGB: the solid over (the gradient over the base);
       a clipped solid counts by the share of the viewport its circle covers,
       and the gradient by its ramp's mean (the foot's blue × ramp / 2 — the
       DOM interpolates it in sRGB). At every rest it is exactly the field. */
    const hexRgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    // 10-10 (w9c fix R5): the two fields' triples ONCE — liveField runs every
    // rendered frame, so it picks them by reference and writes three scratch
    // channels (no arrays, no closures per frame)
    const FIELD_RGB = { black: hexRgb(FIELDS.black.hex), blue: hexRgb(FIELDS.blue.hex) };
    const fieldLin = new THREE.Color();
    const fieldChan = (i, base, solid, m, sEff) => {
      const grad = FIELD_RGB.blue[i] * m + FIELD_RGB.black[i] * (1 - m); // the ramp's mean: foot blue, top black
      const under = grad * bgState.g + base[i] * (1 - bgState.g);
      return solid[i] * sEff + under * (1 - sEff);
    };
    const liveField = () => {
      const base = FIELD_RGB[fieldOf('open')];
      const solid = FIELD_RGB[fieldOf('solid')];
      const m = Math.min(Math.max(bgState.ramp, 0), 1) / 2;
      const sEff = bgState.s * bgState.cover;
      return fieldLin.setRGB(fieldChan(0, base, solid, m, sEff), fieldChan(1, base, solid, m, sEff), fieldChan(2, base, solid, m, sEff), THREE.SRGBColorSpace);
    };

    /* The Core's live screen-space disc — projected fresh so the solid
       field's grow/shrink chases the dolly exactly. render() hasn't run for
       this frame yet, so refresh the camera's inverse ourselves. */
    const projectedCenter = new THREE.Vector3();
    const discPx = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      projectedCenter.set(globeGroup.position.x, globeGroup.position.y, 0).project(camera);
      const cx = (projectedCenter.x * 0.5 + 0.5) * w;
      const cy = (-projectedCenter.y * 0.5 + 0.5) * h;
      const dist = Math.max(camera.position.z, 0.001);
      const tanV = TAN_V;
      const r = (RADIUS / (tanV * dist)) * (h / 2);
      return { cx, cy, r, w, h };
    };

    // A pose's field, at once (applyPose — every rest, reduced motion's stills)
    const bgInstant = (pose) => {
      setBgAttr(pose.bg);
      setClip(null);
      const T = layersFor(pose.bg);
      setLayers(T.s, T.g ?? 0);
      setRamp(pose.ramp ?? S5_RAMP);
    };

    /* The grow/shrink — the solid field emanates out of the Core's disc
       (S2→S3's ignition) and recedes back into it (S3→S2), the opening under
       it. Rides the caller's window (the ignition / the de-ignite). Endpoints
       are tl.call()s, NOT tl.set()s: a set is itself a tween of the layer,
       and any kill of the layer's tweens would silently eat it — the
       stuck-clipped-circle bug this note commemorates (since w9c the layers
       carry no tweens at all; the rule stands). */
    const bgMorph = (tl, at, dur, expanding) => {
      if (!solidEl) return;
      const proxy = { t: expanding ? 1 : 0 };
      const stamp = () => {
        const { cx, cy, r, w, h } = discPx();
        const cover = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
        setClip({ cx, cy, radius: cover + (r * 1.03 - cover) * proxy.t, w, h });
      };
      tl.call(() => {
        stamp(); // no unclipped first frame on the expansion
        // the shrink starts covering the whole canvas: whatever lies under
        // it goes now, unseen — the opening is what it uncovers
        setLayers(1, expanding ? bgState.g : 0);
      }, null, at);
      tl.to(proxy, { t: expanding ? 0 : 1, duration: dur, ease: turnEase, onUpdate: stamp }, at);
      tl.call(() => {
        // Grown: the solid is the whole canvas, unclipped (anything under it
        // dropped). Shrunk: it ends on the Core's own rim and goes — the
        // opening is back.
        setClip(null);
        if (expanding) setLayers(1, 0);
        else setLayers(0, bgState.g);
      }, null, at + dur);
    };

    /* Generic background leg for every other from→to (jumps, compressed
       catch-ups, the S5 gradient beats, the CTA's taller ramp).
       10-10 (w9c, MONOTONIC): it was a simultaneous fade of both layers, so
       S4→S5 showed the base mid-fade (the black solid fading out while the
       gradient faded in: the blue opening leaked through the dip). Now ONE
       proxy u drives both layers so the page is an exact linear blend
       between what the layers showed at the start and the pose — no pixel
       ever leaves its from–to interval, from a rest or from a killed fade
       mid-burst. In the stack's terms: a target ABOVE its source fades in
       and drops the source at the end (→ solid: the gradient holds under it);
       a target BELOW is set to 1 underneath and the source fades out (S4→S5:
       the gradient at 1 under the solid). The ramp moves where it shows
       (S5↔CTA: monotonic per pixel); a hidden gradient takes its stop at
       once.
       10-10 (w9c fix R3): a CIRCLE a killed grow/shrink left (a step back
       inside the ignition's window, or one taken during the reconnect's
       shrink) is picked up where it stands — unclipping it at the start
       flooded the page with the solid in one frame. The circle keeps its
       centre: onto the solid it GROWS from its live radius until it covers
       the viewport, then unclips; off it, whatever the target shows under it
       fades in OUTSIDE the circle first (the solid still covers the inside),
       then the circle SHRINKS from its live radius to nothing. A fixed
       centre and a radius that only grows or only shrinks change every pixel
       once, so each one still moves monotonically; the endpoints stay on the
       fade's own updates (a killed one leaves a circle the next step picks
       up again). */
    const bgCrossfade = (tl, at, dur, pose) => {
      const T = layersFor(pose.bg);
      const rT = pose.ramp ?? bgState.ramp;
      const fade = { u: 0 };
      let s0 = 0;
      let g0 = 0;
      let r0 = rT;
      let c0 = null; // the live circle (R3), else null
      let cR = 0; // the radius that covers the viewport from its centre
      const clipLeg = (u) => {
        if (T.s >= 1) {
          if (u >= 1) {
            setClip(null);
            setLayers(1, 0);
            return;
          }
          setClip({ ...c0, radius: c0.radius + (Math.max(cR, c0.radius) - c0.radius) * u });
          return;
        }
        const split = Math.abs(T.g - g0) > 1e-3 || r0 !== rT;
        const p1 = split ? Math.min(u * 2, 1) : 1;
        const p2 = split ? Math.max(u * 2 - 1, 0) : u;
        if (u >= 1) {
          setClip(null);
          setLayers(0, T.g);
        } else {
          setLayers(1, g0 + (T.g - g0) * p1);
          setClip({ ...c0, radius: c0.radius * (1 - p2) });
        }
        if (r0 !== rT) setRamp(r0 + (rT - r0) * p1);
      };
      tl.to(
        fade,
        {
          u: 1,
          duration: dur,
          ease: 'power2.inOut',
          onStart: () => {
            s0 = bgState.s;
            g0 = bgState.g;
            r0 = bgState.ramp;
            c0 = bgState.clip && s0 > 0 ? { ...bgState.clip } : null;
            if (c0) cR = Math.hypot(Math.max(c0.cx, c0.w - c0.cx), Math.max(c0.cy, c0.h - c0.cy));
            else setClip(null);
            // the gradient shows outside a circle, else only past the solid
            if ((c0 ? 1 : 1 - s0) * g0 < 1e-3) {
              setRamp(rT);
              r0 = rT;
            }
          },
          onUpdate: () => {
            const u = fade.u;
            if (c0) {
              clipLeg(u);
              return;
            }
            const s = s0 + (T.s - s0) * u;
            let g = T.g == null ? g0 : bgState.g;
            if (T.g != null) {
              // the base's weight, linear in u: (1 − s)(1 − g) = (1 − u)·b0 + u·bT
              const free = 1 - s;
              if (free > 1e-6) g = 1 - ((1 - u) * (1 - s0) * (1 - g0) + u * (1 - T.s) * (1 - T.g)) / free;
            } else if (u >= 1) g = 0;
            setLayers(s, Math.min(Math.max(g, 0), 1));
            if (r0 !== rT) setRamp(r0 + (rT - r0) * u);
          },
        },
        at
      );
    };

    /* — The Thread update: rebuild the polyline through the chained
       Fragments' live attachment points (group-local — the line rides
       globeGroup's rotation for free). Targets drift until claimed, then
       ride the assembly inward as the string pulls taut. The trim-path
       draw is the dashed material: dashSize = drawn world-length. — */
    const attachV = new THREE.Vector3();
    const prevV = new THREE.Vector3();
    const attachPoint = (panel, out) =>
      out
        .copy(panel.centerDir)
        .multiplyScalar(-ATTACH_DEPTH)
        .applyQuaternion(panel.mesh.quaternion)
        .add(panel.mesh.position);
    const updateThread = () => {
      if (!threadActive || threadChain.length === 0) {
        threadLine.visible = false;
        return;
      }
      // Origin: the belt's empty center — the Core's center-to-be.
      const pts = [0, 0, 0];
      prevV.set(0, 0, 0);
      let totalLen = 0;
      threadChain.forEach((panel) => {
        attachPoint(panel, attachV);
        totalLen += attachV.distanceTo(prevV);
        pts.push(attachV.x, attachV.y, attachV.z);
        prevV.copy(attachV);
      });
      threadGeometry.setPositions(pts);
      threadLine.computeLineDistances();
      threadMaterial.dashSize = Math.max(threadDraw.frac, 0.0001) * totalLen;
      threadMaterial.opacity = threadDraw.alpha;
      threadLine.visible = threadDraw.frac > 0.0001 && threadDraw.alpha > 0.0001;
      syncThreadKeep();
    };
    // the white arm's type rects, in drawing-buffer px (gl_FragCoord: y up)
    const syncThreadKeep = () => {
      let n = 0;
      if (threadWhite() && threadLine.visible) {
        const keep = keepBoxes();
        const pr = renderer.getPixelRatio();
        const vh = container.clientHeight || 1;
        for (let i = 0; i < keep.length && n < THREAD_KEEP_MAX; i++) {
          if (keep[i].held) continue; // 10-09 (w9 fix): no type painted there yet
          const b = keep[i].bare;
          threadKeep.rects.value[n++].set(b.x0 * pr, (vh - b.y1) * pr, b.x1 * pr, (vh - b.y0) * pr);
        }
      }
      threadKeep.count.value = n;
    };
    const clearThread = () => {
      threadActive = false;
      threadCamActive = false; // the camera is the assembly's (or an interrupt's) now
      threadChain = [];
      threadDraw = { frac: 0, alpha: 1 };
      threadLine.visible = false;
      keepHeld = null; // 10-09 (w9)
    };

    /* Greedy nearest-neighbor chain from the belt center, computed at
       goTo time from live positions (drift is slow; endpoints stay live
       via per-frame projection).
       10-07 (w5, thread-word-yield): the same shape, but the trace LEANS
       toward the words. Choosing each next bead it takes a NAMED one (a shard
       the S1 tour named — termOf) whose distance is within (1 +
       THREAD_NAMED_SLACK) of the nearest's: the greedy outward walk rarely
       passed the shards S1 named, so ≈40% of desktop shows picked no word
       back up. Small enough that the trace still reads as ONE outward
       string. ?threadhead=word (the default since the integration pass —
       centre picked a word up in only ~31–61% of shows) starts the walk ON
       the last S1 station's subject when it was named — the shard the reader
       was just looking at — instead of the belt centre (?threadhead=centre,
       the pre-w5 start, is the A/B). */
    const THREAD_NAMED_SLACK = 0.35;
    const threadHeadPanel = () => {
      if (TUNING.threadHead !== 'word') return null;
      // the station the camera last held (the tour is stopped by now, so the
      // frozen blend says which side of the road it was on)
      const st = tourBlend.t > 0.5 ? tourTo : tourFrom;
      return !st.wide && st.panel && termOf.has(st.panel.mesh.position) ? st.panel : null;
    };
    let threadPoolNamed = 0; // ?debug: panels S1 had named when the chain was strung
    let threadShape = null; // ?debug: { len, out } of the last chain
    // 10-09 (w9): `belt` measures the walk on the belt SLOTS — an S2 strung
    // from the Core (S3→S2 with no show behind it) chains the constellation
    // it is about to become, not the Core's neighbours. termOf stays keyed on
    // the live mesh.position (the object, not the coordinates).
    const buildChain = ({ belt = false } = {}) => {
      const posOf = (p) => (belt ? p.beltPos : p.mesh.position);
      const pool = [...panels];
      threadPoolNamed = pool.reduce((n, p) => n + (termOf.has(p.mesh.position) ? 1 : 0), 0);
      const chain = [];
      const cursor = new THREE.Vector3(0, 0, 0);
      const head = threadHeadPanel();
      if (head) cursor.copy(posOf(head)); // its own bead is hop one (distance 0)
      const namedReach = (1 + THREAD_NAMED_SLACK) ** 2; // the distances below are SQUARED
      // 10-07 (w4, s2-core-uniform): the bound is read ONCE. Re-reading
      // pool.length inside the test shrank it with every splice, so "84"
      // always stopped at 42 (i meets the halved pool) — ?threadhops now
      // means what it says, and its default is 42 to keep the approved look.
      const hops = Math.min(TUNING.threadHops, pool.length);
      for (let i = 0; i < hops; i++) {
        let best = 0;
        let bestDist = Infinity;
        pool.forEach((p, idx) => {
          const dist = cursor.distanceToSquared(posOf(p));
          if (dist < bestDist) {
            bestDist = dist;
            best = idx;
          }
        });
        if (!termOf.has(pool[best].mesh.position)) {
          const reach = bestDist * namedReach;
          let namedDist = Infinity;
          pool.forEach((p, idx) => {
            if (!termOf.has(p.mesh.position)) return;
            const dist = cursor.distanceToSquared(posOf(p));
            if (dist <= reach && dist < namedDist) {
              namedDist = dist;
              best = idx;
            }
          });
        }
        const picked = pool.splice(best, 1)[0];
        chain.push(picked);
        cursor.copy(posOf(picked));
      }
      // 10-07 (w5): ?debug readout of the string's shape — the trace's
      // length and the share of hops that step OUTWARD from the belt centre,
      // so the named-bead lean can be checked against "ONE outward string"
      // by number, not only by contact sheet
      let len = 0;
      let out = 0;
      for (let i = 1; i < chain.length; i++) {
        const a = posOf(chain[i - 1]);
        const b = posOf(chain[i]);
        len += a.distanceTo(b);
        if (b.lengthSq() > a.lengthSq()) out += 1;
      }
      threadShape = { len: +len.toFixed(2), out: +(out / Math.max(chain.length - 1, 1)).toFixed(2) };
      return chain;
    };

    /* 10-07 (w4): one caption writer at a time — a new scramble (or the
       Thread's counter) kills the one still running, so two scrambles never
       fight over the line (the show's captions now land seconds apart, not
       tens).
       10-07 (w6): per STAGE and per ELEMENT. A caption is found at fire time
       — the stage's .process-stage__readout (S5's scrambled span), else its
       .process-stage__caption (S2's whole line) — never a mount-time ref
       (client:only DOM goes stale; and the one shared captionRef re-pointed
       at whichever stage rendered a caption last, so S5's readout would have
       taken S2's Thread pings). The single-writer rule is per element (el →
       tween): a jump from S2 to S5 never kills S2's scramble mid-run and
       strands noise on its line. */
    const captionTweens = new Map();
    const stageEl = (stageId, sel) =>
      (chromeRefs?.rootRef?.current ?? document).querySelector(`.process-stage[data-stage="${stageId}"] ${sel}`);
    const captionEl = (stageId) =>
      stageEl(stageId, '.process-stage__readout') ?? stageEl(stageId, '.process-stage__caption');
    const captionBusy = (el) => Boolean(el && captionTweens.get(el)?.isActive());
    const fireCaption = (stageId, text) => {
      const el = captionEl(stageId);
      if (!el) return null;
      captionTweens.get(el)?.kill();
      const tw = scrambleTo(el, text);
      if (tw) captionTweens.set(el, tw);
      else captionTweens.delete(el);
      return tw;
    };
    /* 10-07 (w4, thread-words): the Thread COUNTS its beads —
       `dots_connected 07/42`. The label scrambles in once, on the first hop
       after references_folded has had its reading beat; every hop after
       writes plain text (a scramble per 0.1s hop would be noise), waiting
       for that one scramble to land rather than cutting it off. */
    const CAPTION_READ_S = SCRAMBLE_DURATION + 0.55; // references_folded lands, then holds this long
    let countOn = false; // this show's counter has scrambled in (buildConnect resets it)
    /* 10-09 (w9 fix): the lead line's FIRST beat waits for the headline — S2's
       card reads headline → dots_connected → blurb, and references_folded at
       the show's 0 scrambled blurb-size noise under a headline still in its
       mask (first glyph +0.05s, the headline landed +0.8s). It pings on the
       first hop that finds the headline landed (s2HeadLanded — the DOM's
       word, as the Thread's words wait on it), and the count's reading beat
       (CAPTION_READ_S) runs from THAT ping. */
    let foldedAt = Infinity; // show time references_folded pinged (buildConnect resets it)
    const pingFolded = (at) => {
      if (foldedAt !== Infinity || !s2HeadLanded()) return;
      foldedAt = at;
      fireCaption('stage-02', 'references_folded');
    };
    /* 10-07 (w4 fix): the LIVE count. The one scramble (0.85s) spans ~8
       hops, so scrambling the count in landed it stale (09/42, then the
       next plain write jumped to 18): the scramble names the LABEL alone
       and its onComplete writes the count as it stands. */
    let countText = '';
    const countFmt = (n, total) => `dots_connected ${String(n).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
    const threadCount = (n, total, at) => {
      const el = captionEl('stage-02');
      if (!el || at < foldedAt + CAPTION_READ_S) return;
      countText = countFmt(n, total);
      if (!countOn) {
        countOn = true;
        const tw = fireCaption('stage-02', 'dots_connected'); // the label's one entrance
        tw?.eventCallback('onComplete', () => {
          el.textContent = countText;
        });
        if (!tw) el.textContent = countText;
      } else if (!captionBusy(el)) {
        el.textContent = countText;
      }
    };
    const threadCountEnd = (total) => {
      if (!total) return;
      if (!countOn) {
        threadCount(total, total, Infinity);
        return;
      }
      const el = captionEl('stage-02');
      if (!el) return;
      countText = countFmt(total, total);
      // a scramble still running lands it (its onComplete reads countText)
      if (!captionBusy(el)) el.textContent = countText;
    };

    /* 10-09 (w9, s2-hold): THE CONNECTED CONSTELLATION — S2's rest without
       the show. Every way onto S2 that is not the S1→S2 show (an instant
       pose, reduced motion, a jump, a compressed catch-up, S3→S2's un-peel)
       ends here: the chain (the last show's, else one strung on the belt
       slots), each bead CLAIMED as the show leaves it (drift damped to
       S2_CLAIM_DRIFT, DARK at s2BeadPower() — w9b), and the card's lead line
       on its full count — plain text, no scramble (spec §7: an arrival that
       did not watch the count reads the result).
       10-09 (w9b): …and the rest of it — every shard the string did not reach
       GHOSTED toward the field (?s2ghost), a white DOT where the line meets
       each bead (?s2dot), the count == the dots. */
    const S2_CLAIM_DRIFT = 0.12;
    /* 10-09 (w9b, s2-ping-dark — Nathan: "they ping and become dark"): a
       struck bead settles DARK — ?s2dark × ?idlepower, full stroke (w9's
       claim was a constant 0.85×, S2_CLAIM_POWER). ONE helper at every site
       that read the constant, so the bench moves the rest live (applyTuning)
       and peek's claims count it.
       10-10 (w9c, s2-refine-on-black): FIELD-AWARE — renamed s2BeadPower.
       "Dark" was the blue field's word: on blue a dimmer bead reads deeper
       than its ghosted neighbours (which haze toward the bright field). On
       the BLACK opening the ghost hazes toward black too, so a dark bead
       (?s2dark × ?idlepower ≈ 0.24) sinks below its ghost (≈ 0.27 — 0.97:1)
       and the refine vanishes. There the bead settles LIT (?s2lit, uPower
       absolute — 1 = the solid #0000FF): the struck shard becomes the
       defined thing while the rest dims toward the field; the white dot
       sits on it at ≈ 8.6:1. ?s2lit 0 restores w9b's dark on any field
       (arm b); ?opening=blue never reads ?s2lit. */
    const s2BeadPower = () =>
      fieldOf('open') === 'black' && TUNING.s2Lit > 0
        ? Math.min(TUNING.s2Lit, 1)
        : TUNING.idlePower * Math.max(TUNING.s2Dark, 0);
    /* 10-09 (w9b): the one colour S2's refine OWNS — the DOT's white
       (s2DotMat). 10-09 (w9b fix R2): the ghost and the ping own none, so the
       object no longer pretends to hold them: the GHOST is the fog channel's
       mix toward uFogColor (panelMaterial's default GAP_COLOR — the scene
       never writes it; S1's depth haze reads the same uniform), the PING the
       heat channel toward uBlueColor (set WHITE_COLOR at mount for the
       break's burn). A field-aware w9c re-points THOSE uniforms (and the haze
       with them), not this. Never opacity anywhere.
       10-10 (w9c): done — uFogColor follows the live field (applyFogUniforms),
       so the ghost recedes into black on the opening; the dot reads the
       field table's dot ink (white on both fields). */
    const S2_INK = { dot: FIELDS[fieldOf('open')].dot };
    /* 10-09 (w9b, s2-ghost — Nathan: "have the panels decrease their fill
       opacity to start as well as their stroke opacity"): each panel's ghost
       PROGRESS, 0..1 (× ?s2ghost, read live — applyFogUniforms composes it
       into the per-panel haze). Its own object, so the many
       gsap.killTweensOf(panel) of the belt/assembly never take it. */
    panels.forEach((p) => {
      p.gh = { k: 0 };
    });
    /* 10-09 (w9b, s2-dots — "with each hit on a panel creating a dot at the
       hit point that persists as the line draws"): ONE InstancedMesh, one
       instance per struck bead. Each frame (renderFrame, beside the fog —
       after every tween, so never a frame behind the line) a dot sits where
       the Thread VISIBLY meets its bead (s2DotEnd — 10-09 w9b fix R1: not the
       vertex's face-plane projection, which the hidden end left floating
       short of the line), then lifted LABEL_ROOT_EPS (or two radii) further
       up the ray so it paints over the face — a nudge along the ray moves
       nothing on screen. ?s2dot screen px wide at any depth. Enters by
       GROWING (S2_DOT_IN, no overshoot), leaves by shrinking (× EXIT_RATIO)
       — never a fade. Depth-tested (a nearer shard hides it), no depth
       write; renderOrder 0, between the Thread (−1) and the chips' leaders. */
    const S2_DOT_IN = 0.12;
    const s2DotGeo = new THREE.CircleGeometry(1, 20);
    const s2DotMat = new THREE.MeshBasicMaterial({ color: S2_INK.dot, transparent: true, depthWrite: false });
    const s2DotMesh = new THREE.InstancedMesh(s2DotGeo, s2DotMat, panels.length);
    s2DotMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    s2DotMesh.count = 0;
    s2DotMesh.visible = false;
    s2DotMesh.frustumCulled = false; // the instances ride the whole belt
    s2DotMesh.renderOrder = 0;
    scene.add(s2DotMesh);
    /* 10-09 (w9b fix, R2 screen): A DOT GIVES WAY TO THE TYPE. The copy and
       the chrome paint over the canvas, so a white dot in a blurb or on the
       bar read as a stray mark in the letters (the reconnect's rest: one on
       "will", one under the 37/42). Each dot SHRINKS with its distance to the
       nearest keep box (keepBoxes' BARE type, + S2_DOT_AIR; a held box skipped
       — nothing painted there yet): full size two dot-widths clear, nothing at
       the box's air — its radius stays under that distance, so it never
       touches the type and is never cut (a per-pixel mask left a half-dot on
       a box's edge at rest); continuous with the drift, so no pop, and never
       a fade — the dot's own grow/shrink idiom. The instance still draws (at
       0 under the type), so the count still equals the struck dots. */
    const S2_DOT_AIR = 6;
    const s2KeepR = []; // pooled, grown to the list (the chrome comes last — no cap may drop the bar)
    let s2KeepN = 0;
    const s2DotKeepSync = () => {
      const keep = keepBoxes();
      s2KeepN = 0;
      for (let i = 0; i < keep.length; i++) {
        if (keep[i].held) continue;
        const b = keep[i].bare;
        const r = s2KeepR[s2KeepN] ?? (s2KeepR[s2KeepN] = { x0: 0, y0: 0, x1: 0, y1: 0 });
        s2KeepN += 1;
        r.x0 = b.x0 - S2_DOT_AIR;
        r.y0 = b.y0 - S2_DOT_AIR;
        r.x1 = b.x1 + S2_DOT_AIR;
        r.y1 = b.y1 + S2_DOT_AIR;
      }
    };
    // the dot's scale for screen (x, y): 0 in a keep box's air → 1 at `band` px clear of it
    const s2DotGive = (x, y, band) => {
      let d = band;
      for (let i = 0; i < s2KeepN; i++) {
        const r = s2KeepR[i];
        d = Math.min(d, Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.y0 - y, 0, y - r.y1)));
      }
      return band > 0 ? d / band : 1;
    };
    const s2DotG = { x: 0, y: 0, depth: 0, perPx: 0 };
    // chain = the dots' beads in hop order; d[i] = { k: drawn scale 0..1,
    // hit: struck and not yet retracted }; idx[n] = the chain index instance
    // n drew (peek); retract: the trim is going back (any way off S2)
    const s2Dots = { chain: [], d: [], idx: new Int16Array(panels.length), retract: false };
    /** Build time only (never inside a timeline's own call — the GSAP trap). */
    const s2DotsSet = (chain, struck = false) => {
      s2Dots.d.forEach((d) => gsap.killTweensOf(d));
      s2Dots.chain = chain;
      s2Dots.d = chain.map(() => ({ k: struck ? 1 : 0, hit: struck }));
      s2Dots.retract = false;
    };
    const s2DotShrink = (d) => {
      d.hit = false;
      gsap.to(d, { k: 0, duration: S2_DOT_IN * EXIT_RATIO, ease: 'power2.in', overwrite: 'auto' });
    };
    const s2DotV = new THREE.Vector3();
    const s2DotW = new THREE.Vector3();
    const s2DotP = new THREE.Vector3();
    const s2DotT = new THREE.Vector3();
    const s2DotPrev = new THREE.Vector3();
    const s2DotP0 = new THREE.Vector3();
    const s2DotE = new THREE.Vector3();
    const s2DotM4 = new THREE.Matrix4();
    /* 10-09 (w9b fix, R1 screen): WHERE THE LINE VISIBLY MEETS ITS BEAD. The
       string attaches ATTACH_DEPTH behind the shard (w9: the concave side, "a
       shard facing the camera hides its own connection point"), so on the
       tight lens the line goes INTO the face 60–140 px short of its vertex —
       and a dot on the vertex's own view ray sat on that hidden end, the line
       stopping short of it. The dot goes to the incoming segment's VISIBLE END
       instead: the last point of (previous vertex → this one) that this
       bead's own shard does not hide — where the line enters the face, or
       slips under its rim. The shard is tested as what it is: its sphere
       patch (radius R × scale about mesh.position − that × its face normal,
       inside its home lat/long bounds — buildGlobeGeometry's partial
       SphereGeometry), FRONT faces only (the panel material culls its back,
       so a shard seen from behind hides nothing — the raycaster's own rule);
       near the rim and in the facets' sag, where a sphere and its chords
       part, its own triangles answer (S2_EDGE_BAND, S2_SAG — ≈1 µs a test).
       The end: a coarse march back from the vertex, then a bisection — it
       slides with the line's own visible end and steps only when THAT does (a
       rim sweeping the hop mid-assembly). Measured against three's own
       raycaster on the shard (?debug, armed — peek s2.dotEnd): 0 px over
       30.3k dot-frames of a show + reconnect (the sphere alone: up to 23 px
       for 4–13 frames at a grazing rim, 5 px in the sag). The dot then
       sits on the shard along that ray (the rim's depth when the line slips
       under it) and lifts up the ray as before. A vertex its shard does not
       hide is its own end. All group-local (the line's own space). */
    const s2CamL = new THREE.Vector3();
    const s2GInv = new THREE.Matrix4();
    const s2Oc = { C: new THREE.Vector3(), Q: new THREE.Quaternion(), rho: 1, patch: null, t: 0, p: null };
    const s2OcD = new THREE.Vector3();
    const s2OcX = new THREE.Vector3();
    const wrapPi = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
    // a shard's home lat/long bounds (SphereGeometry's convention: θ = acos y, φ = atan2(z, −x))
    const patchOf = (p) => {
      if (p.patch) return p.patch;
      const pos = p.geometry.attributes.position;
      const v = new THREE.Vector3();
      const phC = Math.atan2(p.centerDir.z, -p.centerDir.x);
      let thMin = Infinity;
      let thMax = -Infinity;
      let phH = 0;
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).add(p.homeOffset).normalize(); // the re-bake undone: on the home sphere
        const th = Math.acos(Math.min(Math.max(v.y, -1), 1));
        thMin = Math.min(thMin, th);
        thMax = Math.max(thMax, th);
        phH = Math.max(phH, Math.abs(wrapPi(Math.atan2(v.z, -v.x) - phC)));
      }
      p.patch = { thMin, thMax, phC, phH };
      return p.patch;
    };
    const s2OcFor = (p) => {
      const rho = RADIUS * p.mesh.scale.x;
      s2Oc.rho = Math.max(rho, 1e-6);
      s2Oc.C.copy(p.centerDir).applyQuaternion(p.mesh.quaternion).multiplyScalar(-rho).add(p.mesh.position);
      s2Oc.Q.copy(p.mesh.quaternion).invert();
      s2Oc.patch = patchOf(p);
      s2Oc.p = p;
    };
    /* The EDGE BAND: the facets are chords, so within a few hundredths of a
       radian of the patch's rim the sphere's answer and the triangles' part
       (measured: a grazing ray, 19–21° to the face, entering the sphere up to
       0.008 rad outside the bounds and still striking a facet — 12–23 px off
       the line for 4–13 frames). There, and only there, the shard's own
       triangles answer — in its local frame, front faces only, no allocation. */
    const S2_EDGE_BAND = 0.03; // rad of arc on the unit sphere
    // …and where the line PIERCES the face: a point between the sphere and its
    // chords (the facets sag ≤ 0.004 R below it — a pole wedge's 4×3 cell) is
    // the triangles' call too, or the dot runs ahead of the line's end
    const S2_SAG = 0.006;
    const s2TriRay = new THREE.Ray();
    const s2TriA = new THREE.Vector3();
    const s2TriB = new THREE.Vector3();
    const s2TriC = new THREE.Vector3();
    const s2TriHit = new THREE.Vector3();
    const s2HidesTri = (L) => {
      const { p } = s2Oc;
      const sc = Math.max(p.mesh.scale.x, 1e-6);
      s2TriRay.origin.copy(s2CamL).sub(p.mesh.position).applyQuaternion(s2Oc.Q).multiplyScalar(1 / sc);
      s2TriRay.direction.copy(s2OcD).applyQuaternion(s2Oc.Q);
      const pos = p.geometry.attributes.position;
      const ix = p.geometry.index;
      let best = Infinity;
      for (let k = 0; k + 2 < ix.count; k += 3) {
        s2TriA.fromBufferAttribute(pos, ix.getX(k));
        s2TriB.fromBufferAttribute(pos, ix.getX(k + 1));
        s2TriC.fromBufferAttribute(pos, ix.getX(k + 2));
        if (s2TriRay.intersectTriangle(s2TriA, s2TriB, s2TriC, true, s2TriHit)) best = Math.min(best, s2TriHit.distanceTo(s2TriRay.origin) * sc);
      }
      if (!(best > 1e-6 && best < L - 1e-5)) return false;
      s2Oc.t = best;
      return true;
    };
    /** Does the shard set up by s2OcFor hide group-local point `q` from the lens? (s2Oc.t = its hit) */
    const s2Hides = (q) => {
      s2OcD.copy(q).sub(s2CamL);
      const L = s2OcD.length();
      if (L < 1e-6) return false;
      s2OcD.multiplyScalar(1 / L);
      s2OcX.copy(s2CamL).sub(s2Oc.C);
      const b = s2OcD.dot(s2OcX);
      const c = s2OcX.lengthSq() - s2Oc.rho * s2Oc.rho;
      if (c <= 0) return false; // the lens inside the sphere sees only back faces — culled
      const disc = b * b - c;
      if (disc <= 0) return false;
      const t = -b - Math.sqrt(disc); // the front face, where the ray enters
      if (t <= 1e-6 || t >= L - 1e-5) return false;
      s2OcX.copy(s2OcD).multiplyScalar(t).add(s2CamL).sub(s2Oc.C).multiplyScalar(1 / s2Oc.rho).applyQuaternion(s2Oc.Q);
      const { thMin, thMax, phC, phH } = s2Oc.patch;
      const th = Math.acos(Math.min(Math.max(s2OcX.y, -1), 1));
      // how far inside the bounds the entry lies, as arc (φ scaled by sin θ — a pole wedge's φ is short)
      const inside = Math.min(th - thMin, thMax - th, (phH - Math.abs(wrapPi(Math.atan2(s2OcX.z, -s2OcX.x) - phC))) * Math.sin(th));
      if (inside <= -S2_EDGE_BAND) return false;
      // 10-09 (w9b fix): the rim's band, or a point in the facets' sag — the triangles
      if (inside < S2_EDGE_BAND || q.distanceToSquared(s2Oc.C) > (s2Oc.rho * (1 - S2_SAG)) ** 2) return s2HidesTri(L);
      s2Oc.t = t;
      return true;
    };
    /** The visible end of (p0 → p1) into `out` — group-local, on the shard along its ray — for the
     *  shard s2OcFor set up (or `hides`, the debug check's triangles). Returns the end's s, 0..1. */
    const s2DotEnd = (p0, p1, out, hides = s2Hides) => {
      let s = 1;
      let tHi = Infinity;
      if (hides(p1)) {
        let hi = 1;
        let lo = -1;
        tHi = s2Oc.t;
        for (let j = 1; j <= 8; j++) {
          const sj = 1 - j / 8;
          out.lerpVectors(p0, p1, sj);
          if (!hides(out)) {
            lo = sj;
            break;
          }
          hi = sj;
          tHi = s2Oc.t;
        }
        if (lo < 0) s = 0; // the whole hop under its own shard: where it went under
        else {
          for (let j = 0; j < 10; j++) {
            const m = (lo + hi) / 2;
            out.lerpVectors(p0, p1, m);
            if (hides(out)) {
              hi = m;
              tHi = s2Oc.t;
            } else lo = m;
          }
          s = lo;
        }
      }
      out.lerpVectors(p0, p1, s);
      if (Number.isFinite(tHi)) {
        s2OcD.copy(out).sub(s2CamL);
        const L = s2OcD.length();
        if (tHi < L) out.copy(s2CamL).addScaledVector(s2OcD, tHi / L); // onto the rim it slips under
      }
      return s;
    };
    // ?debug: the worst anchor error of the last composed frame, px — the dot's
    // centre vs the line's VISIBLE END (s2DotEnd, before the lift) — measured
    // where the dots are placed (peek between frames would read the dots
    // against panels a GSAP tick has already moved). Armed
    // (window.__swmProcessDotCheck = true), `dotEnd` re-finds each end on the
    // shard's own TRIANGLES (the raycaster, independent of the patch model)
    // and reports the worst screen distance to the dot, px.
    let s2DotErrNow = 0;
    let s2DotEndNow = 0;
    const s2DotA = { x: 0, y: 0, depth: 0, perPx: 0 };
    const s2DotB = { x: 0, y: 0, depth: 0, perPx: 0 };
    const s2DotPx = (dotW, endLocal) => {
      const view = screenView();
      s2DotW.copy(endLocal).applyMatrix4(globeGroup.matrix);
      if (!toPx(dotW, view, s2DotA) || !toPx(s2DotW, view, s2DotB)) return 0;
      return Math.hypot(s2DotA.x - s2DotB.x, s2DotA.y - s2DotB.y);
    };
    const s2ExactHits = [];
    const s2ExactW = new THREE.Vector3();
    const s2ExactE = new THREE.Vector3();
    const s2HidesExact = (p) => (q) => {
      s2ExactW.copy(q).applyMatrix4(globeGroup.matrix);
      s2OcD.copy(s2ExactW).sub(camera.position);
      const L = s2OcD.length();
      coverRay.set(camera.position, s2OcD.normalize());
      coverRay.far = L - 1e-5;
      s2ExactHits.length = 0;
      p.mesh.raycast(coverRay, s2ExactHits);
      if (!s2ExactHits.length) return false;
      s2Oc.t = s2ExactHits[0].distance; // world units ≡ group-local (globeGroup is never scaled)
      return true;
    };
    const composeS2Dots = () => {
      const { chain, d } = s2Dots;
      const px = Math.max(TUNING.s2Dot, 0);
      let n = 0;
      s2DotErrNow = 0;
      s2DotEndNow = 0;
      if (chain.length) {
        globeGroup.updateMatrix(); // the tick's yaw/pitch, this frame (globeGroup's parent is the scene)
        s2GInv.copy(globeGroup.matrix).invert();
        s2CamL.copy(camera.position).applyMatrix4(s2GInv);
        const check = DEBUG && window.__swmProcessDotCheck;
        if (check) {
          globeGroup.updateMatrixWorld(true); // the raycaster reads matrixWorld
          if (Array.isArray(window.__swmProcessDotRows)) window.__swmProcessDotRows.push(['F', +performance.now().toFixed(1)]);
        }
        const vh = container.clientHeight || 1;
        const view = screenView();
        s2DotKeepSync(); // fix R2 (screen): the type's boxes, this frame
        // the trim's drawn length — a dot the retract has passed goes
        const drawn = threadActive && threadChain === chain ? threadMaterial.dashSize : 0;
        let cum = 0;
        s2DotPrev.set(0, 0, 0);
        for (let i = 0; i < chain.length; i++) {
          const p = chain[i];
          const dot = d[i];
          attachPoint(p, s2DotV);
          cum += s2DotV.distanceTo(s2DotPrev);
          s2DotP0.copy(s2DotPrev);
          s2DotPrev.copy(s2DotV);
          if (s2Dots.retract && dot.hit && drawn < cum - 1e-6) s2DotShrink(dot);
          if (px <= 0 || dot.k <= 1e-3) continue;
          s2OcFor(p);
          const sA = s2DotEnd(s2DotP0, s2DotV, s2DotE);
          s2DotP.copy(s2DotE).applyMatrix4(globeGroup.matrix);
          const depth = camera.position.z - s2DotP.z;
          if (depth <= 0.05) continue;
          const r = (px / 2) * ((depth * TAN_V * 2) / vh);
          s2DotT.copy(camera.position).sub(s2DotP).normalize().multiplyScalar(Math.max(LABEL_ROOT_EPS, r * 2));
          s2DotP.add(s2DotT);
          // fix R2 (screen): giving way to the type (0 under it, full 2 dot-widths clear)
          const give = toPx(s2DotP, view, s2DotG) ? s2DotGive(s2DotG.x, s2DotG.y, px * 2) : 1;
          const k = r * dot.k * give;
          if (DEBUG) {
            // this frame's anchor error: the dot's centre vs the line's visible end (px)
            s2DotErrNow = Math.max(s2DotErrNow, s2DotPx(s2DotP, s2DotE));
            if (check) {
              const sE = s2DotEnd(s2DotP0, s2DotV, s2ExactE, s2HidesExact(p));
              const e = s2DotPx(s2DotP, s2ExactE);
              s2DotEndNow = Math.max(s2DotEndNow, e);
              // armed rows for the harness: [chain index, dot x, dot y (px), s (patch), s (triangles), px apart]
              if (Array.isArray(window.__swmProcessDotRows)) window.__swmProcessDotRows.push([i, +s2DotA.x.toFixed(1), +s2DotA.y.toFixed(1), +sA.toFixed(4), +sE.toFixed(4), +e.toFixed(2)]);
            }
          }
          s2DotM4.makeScale(k, k, k).setPosition(s2DotP);
          s2DotMesh.setMatrixAt(n, s2DotM4);
          s2Dots.idx[n] = i;
          n += 1;
        }
      }
      s2DotMesh.count = n;
      s2DotMesh.visible = n > 0;
      if (n) s2DotMesh.instanceMatrix.needsUpdate = true;
    };
    /* 10-09 (w9b): ONE HIT — the per-hop moment of the S1→S2 show and of the
       reconnect: the bead's ghost lifts, it PINGS (one white flash on the
       heat channel, ?s2ping: attack S2_PING_IN on power2.out, the fall over
       S2_PING_OUT on sine.out — monotone both ways, no overshoot), settles
       DARK (s2BeadPower, under the flash) with its drift damped, and its DOT
       grows. ?s2ping 0 keeps w9's dip-and-settle (to ?s2dark). Its own
       timeline, real time (a rushed show strikes faster; each hit still
       reads), tracked in s2Fx so every build path kills them at BUILD time
       (killS2Fx) — the heat it leaves is coolHero's (> 1e-3) or exactly 0. */
    const S2_PING_IN = 0.04;
    const S2_PING_OUT = 0.35;
    const s2Fx = new Set();
    const s2Hit = (panel, i) => {
      if (disposed) return;
      const u = panel.mesh.material.uniforms;
      const fx = gsap.timeline({ onComplete: () => s2Fx.delete(fx) });
      fx.data = panel;
      s2Fx.add(fx);
      gsap.to(panel, { driftFactor: S2_CLAIM_DRIFT, duration: 0.6, ease: 'power2.out' });
      fx.to(panel.gh, { k: 0, duration: S2_PING_IN + 0.08, ease: 'power2.out', overwrite: 'auto' }, 0);
      const peak = Math.min(Math.max(TUNING.s2Ping, 0), 1);
      if (peak > 0) {
        fx.to(u.uBlueMix, { value: peak, duration: S2_PING_IN, ease: 'power2.out' }, 0);
        fx.to(u.uBlueMix, { value: 0, duration: S2_PING_OUT, ease: 'sine.out' }, S2_PING_IN);
        fx.to(u.uPower, { value: s2BeadPower(), duration: S2_PING_IN + S2_PING_OUT, ease: 'sine.out' }, 0);
      } else {
        fx.to(u.uPower, { value: TUNING.idlePower * 0.55, duration: 0.1, ease: 'power2.in' }, 0);
        fx.to(u.uPower, { value: s2BeadPower(), duration: 0.45, ease: 'sine.out' }, 0.1);
      }
      const dot = s2Dots.chain[i] === panel ? s2Dots.d[i] : null;
      if (dot) {
        dot.hit = true;
        fx.to(dot, { k: 1, duration: S2_DOT_IN, ease: 'power2.out' }, 0);
      }
    };
    const killS2Fx = () => {
      s2Fx.forEach((fx) => {
        fx.kill();
        const mix = fx.data.mesh.material.uniforms.uBlueMix;
        if (mix.value <= 1e-3) mix.value = 0; // under coolHero's floor; above it coolHero cools it
      });
      s2Fx.clear();
    };
    const s2Chain = () => {
      if (!lastChain.length) lastChain = buildChain({ belt: true });
      return lastChain;
    };
    // 10-09 (w9b): `n` of `total` — the reconnect counts 00 → 42 in plain writes
    const writeS2Count = (n, total = n) => {
      const el = captionEl('stage-02');
      if (!el || !total) return;
      captionTweens.get(el)?.kill();
      captionTweens.delete(el);
      countOn = true; // the label has had its entrance — a late hop only writes text
      countText = countFmt(n, total);
      el.textContent = countText;
    };
    const claimBead = (p) => {
      p.driftFactor = S2_CLAIM_DRIFT;
      p.mesh.material.uniforms.uPower.value = s2BeadPower();
    };
    /** Instant: the Thread drawn whole through its claimed beads.
     *  10-09 (w9b): THE CONNECTED REST — the beads dark with their dots, every
     *  other shard ghosted, 42/42. */
    const restThread = () => {
      threadChain = s2Chain();
      threadDraw = { frac: 1, alpha: 1 };
      threadActive = true;
      threadCamActive = false;
      const beads = new Set(threadChain);
      panels.forEach((p) => {
        gsap.killTweensOf(p.gh);
        p.gh.k = beads.has(p) ? 0 : 1;
      });
      threadChain.forEach(claimBead);
      s2DotsSet(threadChain, true);
      writeS2Count(threadChain.length);
    };

    /* — Annotation labels. IN-SCENE since 09-09 round 2 (Nathan: the chips
       must sit at their panel's z, so they layer against each other and are
       COVERED by shards in front of them — that occlusion is what tells you
       which panel a chip is naming).

       They used to be DOM chips in a fixed overlay with an SVG leader,
       composited above the whole render, which made occlusion impossible —
       exactly the problem the Thread hit in the v2 deck (B3) and solved the
       same way: it stopped being a screen-space overlay and became a real
       line in the scene. The chips follow it now. Each slot is a small group
       — a text plane, a leader line, an anchor dot — living at its panel's
       WORLD POSITION, so the depth buffer does the layering for free: nearer
       chips paint over farther ones, and any shard in front hides the chip
       outright. Nothing here projects to screen space to be drawn.

       The chip is a plane, not a sprite, and it never needs billboarding:
       this camera is axis-aligned and never rotates, so a plane in the world
       XY plane already faces it dead-on. It IS re-scaled every frame so the
       text holds a constant SIZE ON SCREEN however far the tour has dollied
       — a chip that shrank with distance would be unreadable at exactly the
       moment the haze made its panel interesting.

       Type is drawn to a canvas texture rather than set in the DOM, so
       .process-label in process.css stays the source of truth: a hidden
       probe hands the canvas its face, size, tracking and colour. Letters
       land on the house random-letter cut — the same shuffled clock the DOM
       sites run (charCut's cutSchedule), painting one more glyph per tick
       instead of un-hiding one more span.

       Ported from the home-hero refinement and kept: VIEWPORT + FRONT-FACING
       candidate selection, NO-REPEAT round-robin, and the per-frame EARLY
       FADE when a labelled shard turns away or leaves frame. New at this
       round: a bind is REJECTED when its chip would land on top of a chip
       already out, which stops the clustering the longer leaders would
       otherwise make worse. S1 only; reduced motion never runs them. — */
    // 10-07 (w4): + audience_profile (in the opening set — S1's blurb names
    // [[audience]] and it had no chip) and fan_culture. Copy, for Nathan.
    // 10-09 (w9b, term-bank): 19 → 84 — ONE WORD PER BELT PANEL, so with
    // more chips up at once no two fragments share a word until 84 have been
    // named (the decoys deal from the same bank; the cursor only moves on a
    // first naming, termOf keeps every re-bind on its word). The 65 below run
    // AFTER the original 19, in the order they were written (no two of a
    // family side by side). Copy, Nathan's to strike — a struck word swaps in
    // from the reserve in docs/process-page-spec.md § S1 chips (keep the
    // no-shared-neighbour rule).
    const LABEL_TERMS = [
      'image_references', 'brand_cadence', 'audience_profile', 'artist_personality',
      'artist_interests', 'call_notes', 'inquiry_notes', 'preliminary_research',
      'market_research', 'music_catalog', 'market_gaps', 'pop_culture', 'fan_culture',
      'industry_analysis', 'genre_gaps', 'industry_opportunities', 'design_history',
      'art_history', 'industry_trends',
      'voice_memos', 'flyer_archive', 'press_photos', 'tour_setlists', 'film_stills',
      'lyric_themes', 'reference_tracks', 'camera_roll', 'fan_art', 'scene_history',
      'label_brief', 'liner_notes', 'photo_books', 'stage_wardrobe', 'genre_tropes',
      'working_titles', 'found_objects', 'record_collection', 'past_artwork',
      'press_clippings', 'hometown_scene', 'ticket_stubs', 'zine_library',
      'concert_footage', 'rough_mixes', 'fan_fashion', 'sample_sources', 'poster_walls',
      'music_videos', 'artist_bio', 'local_slang', 'sleeve_archive', 'vintage_ads',
      'notebook_scans', 'runway_shows', 'peer_artwork', 'dj_sets', 'street_signage',
      'listener_cities', 'festival_lineups', 'past_interviews', 'comment_sections',
      'label_roster', 'lyric_drafts', 'comic_books', 'artist_drawings', 'adjacent_genres',
      'magazine_scans', 'streaming_data', 'listening_notes', 'venue_photos',
      'career_timeline', 'merch_archive', 'club_culture', 'fashion_editorials',
      'song_stories', 'fan_rituals', 'release_formats', 'reading_list',
      'musical_influences', 'session_footage', 'family_photos', 'social_feeds',
      'texture_scans', 'exhibition_catalogs',
    ];
    const LABEL_FRONT_EPS = 0.05; // normal·view-axis floor (front-facing)
    const LABEL_NDC_BIND = 0.86; // pick only shards comfortably on-screen
    const LABEL_BIND_FACING = 0.4; // normal·view-axis floor to TAKE a chip (≈66° of square); the keep floor stays LABEL_FRONT_EPS
    // A target more hazed than this is too faint to be pointed at. 10-07
    // (w3): 0.45 → 0.25 — at 0.45 a resting shard is ≈#0000e0, 1.18:1 on the
    // field, and a saturated project-colour chip read as naming a ghost; at
    // 0.25 (≈#0000d3) its black stroke still holds ≈1.8:1.
    const LABEL_HAZE_MAX = 0.25;
    const LABEL_NDC_KEEP = 1.05; // hold until the anchor leaves the frame
    const LABEL_HOLD_ALPHA = 0.85; // the resting strength
    const LABEL_DOT_PX = 3; // anchor dot diameter, screen px
    const LABEL_ROOT_EPS = 0.012; // world units the dot/leader root sits up the view ray off the shard's face
    /* How far in front of its own shard the whole trio sits. Two jobs, and
       the second is why it is not a hairline: the dot and leader sit ON their
       shard and would z-fight it, AND a chip left exactly coplanar gets
       chopped by every neighbour that drifts within a few hundredths of its
       depth — at close range that is most of them, and a word cut into thirds
       reads as broken rather than as depth. Lifting by a fraction of the
       belt's own shard spacing means only a shard CLEARLY in front covers a
       chip, which is the read that identifies the pairing. */
    const labelLift = () => TUNING.scatter * 0.16;
    const labelsEl = chromeRefs?.labelsRef?.current ?? null;
    let labelsActive = false;
    /* 10-07 (w3, chip-exit): the layer is LEAVING — every live chip is on
       its house letter cut and nothing may rebind; labelsActive drops when
       the last one releases (the tick keeps pinning them to their shards
       until then). leaveLabels sets it, startLabels / stopLabels clear it. */
    let labelsLeaving = false;
    /* 10-07 (w3, tour glance/linger): how many chips the current station
       may carry — a glance names half the slots, everything else all. */
    let chipCap = Infinity;
    let termCursor = 0;
    /* Project colours (Nathan, 10-07): every chip that cuts in takes the
       NEXT colour of the pool (the distinct project colour tokens, /work
       order), wrapping to the first at the end — so a station's set reads as
       a run of the studio's palette, and the run keeps moving. Only the chip
       FILL takes the colour; the shards, leaders and dots keep theirs. */
    const chipColors = chromeRefs?.chipColors ?? [];
    let chipColorCursor = 0;
    /* 10-09 (w9b, ?debug): the chip bench's station log — one row per S1
       station (the opening wide, every leg's arrival): its cap, the tour
       chips' bind offsets from the arrival (s), the most up at once and the
       most draw calls on a held frame; plus the LEADER×CHIP crossings (a
       live leader through ANOTHER live chip's box — an episode once a pair
       holds it 3 frames). The ?labels / ?labelsm candidates' table reads it
       through peek's chipStats. Bench only — nothing reads it back.
       10-09 (w9b, term-bank): + the bank's TURNOVER, split the way Nathan
       meant "so we don't have repeats": `first` S1 first namings, `wraps`
       those whose word was already on ANOTHER shard (the bank wrapped —
       the repeat Nathan named; `wrapAt` the first, performance.now()), and
       `renames` binds of a shard that already had its word (a shard keeps
       its word — by design, not a repeat); per station `rep` = the most
       live chips sharing one fill on a held frame (6g). */
    const chipBench = DEBUG ? { legs: [], xEp: 0, xFrames: 0, xRun: new Map(), first: 0, wraps: 0, wrapAt: null, renames: 0, xLog: [] } : null;
    const benchArrive = (kind) => {
      if (!chipBench) return;
      chipBench.legs.push({ n: tourLegCount, kind, cap: Number.isFinite(chipCap) ? chipCap : labelSlots.length, at: performance.now(), binds: [], max: 0, calls: 0, rep: 0 });
      if (chipBench.legs.length > 200) chipBench.legs.shift();
    };
    // Liang–Barsky: does segment (x0,y0)→(x1,y1) enter box b (centre x/y, w/h)
    // grown by `pad` px each side? (10-09, w9b: the bench at 0; the S1 seat's
    // leader rule, leaderCrosses, with CHIP_X_PAD)
    const segHitsBox = (x0, y0, x1, y1, b, pad = 0) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      let t0 = 0;
      let t1 = 1;
      const hw = b.w / 2 + pad;
      const hh = b.h / 2 + pad;
      // 10-09 (w9b fix R4): the four edges as scalars — called per sibling
      // per seat try, so no arrays per call (same order, same tests)
      for (let e = 0; e < 4; e++) {
        const p = e === 0 ? -dx : e === 1 ? dx : e === 2 ? -dy : dy;
        const q = e === 0 ? x0 - (b.x - hw) : e === 1 ? b.x + hw - x0 : e === 2 ? y0 - (b.y - hh) : b.y + hh - y0;
        if (Math.abs(p) < 1e-9) {
          if (q < 0) return false;
        } else {
          const r = q / p;
          if (p < 0) t0 = Math.max(t0, r);
          else t1 = Math.min(t1, r);
          if (t0 > t1) return false;
        }
      }
      return true;
    };
    const benchFrame = () => {
      const live = labelSlots.filter((s) => s.target && s.box && !s.fading && !familyHeld(s) && s.group.visible);
      const leg = chipBench.legs[chipBench.legs.length - 1];
      if (leg && atStation) {
        leg.max = Math.max(leg.max, live.length);
        const byFill = new Map();
        live.forEach((s) => byFill.set(s.fill, (byFill.get(s.fill) ?? 0) + 1));
        byFill.forEach((n) => (leg.rep = Math.max(leg.rep, n)));
      }
      const seen = new Set();
      for (const a of live) {
        if (!(a.leadK > 0.05)) continue;
        for (const b of live) {
          if (a === b || !segHitsBox(a.box.ax, a.box.ay, a.box.ex, a.box.ey, b.box)) continue;
          const k = `${labelSlots.indexOf(a)}>${labelSlots.indexOf(b)}`;
          seen.add(k);
          const n = (chipBench.xRun.get(k) ?? 0) + 1;
          chipBench.xRun.set(k, n);
          if (n === 3) {
            chipBench.xEp += 1;
            // 10-09 (w9b, 6e): what each crossing episode is — the leader's
            // chip (a) and the crossed chip (b): age since its bind (s) and the
            // seat it took (strict | loose | subject), on a station or the road
            const now = performance.now();
            chipBench.xLog.push({ aAge: +((now - (a.benchAt ?? now)) / 1000).toFixed(2), bAge: +((now - (b.benchAt ?? now)) / 1000).toFixed(2), aPath: a.benchPath ?? null, bPath: b.benchPath ?? null, st: atStation });
            if (chipBench.xLog.length > 400) chipBench.xLog.shift();
          }
        }
      }
      for (const k of [...chipBench.xRun.keys()]) if (!seen.has(k)) chipBench.xRun.delete(k);
      if (seen.size) chipBench.xFrames += 1;
    };
    /* 10-07 (w7, cta-finale): THE TURN's state — the fourth chip family (the
       CTA's first_contact, CTA.contact) and the shard it names. While `panel`
       is set the TICK owns its transform (composeContact): a blend on k (0 =
       its home slot, riding the globe; 1 = its free rest). The globe keeps
       spinning under it, so the rest is solved in WORLD space at the freeing
       (F — the lifted offset from the globe's centre; qW — the seeded face-
       the-lens orientation) and counter-rotated every frame: the shard holds
       still in the frame while the world turns behind it. `held` = EVERY
       shard that has worn the word, held out of the S1 pool, the tour's
       subjects and the S3 spec sheet (specHeld) — 10-07 (w7 fix): not just
       the latest; a second CTA visit on another spin frees another shard,
       and the first must not take a LABEL_TERMS word in first_contact's fill
       (a shard keeps its word; one per CTA visit at most). `active` = the
       chip's gate at the CTA rest (contactBeat binds it, and re-seats it on
       a later beat if a cut takes it); `hover` = the CTA actions' hover /
       focus (swm:process-cta-hover). The rest are ?debug readouts (perf ms). */
    const CONTACT_TERM = String(CTA.contact ?? 'first_contact').toUpperCase();
    const contact = {
      panel: null,
      k: 0,
      F: new THREE.Vector3(),
      qW: new THREE.Quaternion(),
      held: new Set(),
      active: false,
      dc: null,
      hover: false,
      fits: null, // the pick's predicted seat fitted the rest frame: 1 outward, −1 inward (10-07, w7), false none
      room: null, // …and its room, px (pickContact)
      at: null, // …and where it predicted the shard and the chip at the rest, px [sx, sy, cx, cy]
      pool: null, // …and its pool: [candidates, fitting outward, …on the limb, inward-only, …on the limb]
      nz: null, // …and its face's lens share (≤ CONTACT_LIMB = a limb shard; 10-07, w7 fix)
      commitAt: null,
      resolveAt: null,
      landAt: null,
      seatedAt: null,
      tries: 0,
    };
    const CHIP_WIPE_S = 0.2; // the fill's wipe in (out runs at EXIT_RATIO)
    const STROKE_CSS = `#${new THREE.Color(STROKE_COLOR).getHexString()}`; // ?chipkey's keyline: the shards' edge ink
    /* 10-08 (w8, ?chipkey auto — brief-chip-fill-field-blue): the keyline
       ONLY on a fill that sinks into the field live behind it — WCAG
       contrast ≤ CHIP_KEY_AUTO_MAX against that stage's field, or S5/the
       CTA's gradient at the chip's own height (the home hero's `to top`
       ramp: electric blue at the foot → black at the ramp, sRGB). Not
       beatKeyed's 3:1 (the ● on two fields): against blue that keys most
       of the pool. At 1.5:1 on blue: #3D32FF (1.27) and the dark red
       #8F1C1B (1.04) key; the bright fills do not.
       10-10 (w9c): the field comes from the table (FIELDS / fieldOf — black
       on hero/S1/S2 and blue on S3/S4 by default) and the gradient's black
       stop from the pose's ramp (S5 0.4, the CTA ?ctaramp). */
    const CHIP_KEY_AUTO_MAX = 1.5;
    const contrastOf = (a, b) => {
      const la = relLum(a);
      const lb = relLum(b);
      if (la == null || lb == null) return Infinity;
      return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    };
    const hexCssOf = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
    const fieldAt = (y) => {
      const pose = getPose(stage ?? 'stage-01');
      const bg = pose?.bg ?? 'open';
      if (bg !== 'gradient') return hexCssOf(FIELDS[fieldOf(bg)].hex);
      return rampAt(y, pose.ramp);
    };
    // the gradient at container y, its black stop `ramp` up the field (10-10,
    // w9c fix2: split out — the CTA's ink verdict reads the CTA's ramp from
    // any stage, ctaEdgeInk)
    const rampAt = (y, ramp) => {
      const h = container.clientHeight || 1;
      const r = Math.min(Math.max(ramp ?? S5_RAMP, 0.05), 1);
      // 0 = black (above the ramp's stop), 1 = the blue foot — sRGB, as the DOM paints it
      const t = Math.min(Math.max((y / h - (1 - r)) / r, 0), 1);
      const top = FIELDS.black.hex;
      const foot = FIELDS.blue.hex;
      const ch = (sh) => Math.round(((top >> sh) & 255) * (1 - t) + ((foot >> sh) & 255) * t);
      return hexCssOf((ch(16) << 16) | (ch(8) << 8) | ch(0));
    };
    const chipKeyed = (slot) =>
      TUNING.chipKey === 'on' ||
      (TUNING.chipKey === 'auto' &&
        contrastOf(slot.fill, fieldAt(slot.box?.y ?? (container.clientHeight || 2) / 2)) <= CHIP_KEY_AUTO_MAX);
    /* 10-07 (w3, opening-wide-beat): one 16-letter term typed in at
       ?labelchar — the beat the last chip of a set needs before its
       station's reading hold may start counting. */
    const CHIP_TYPE_IN_S = () => (Math.max(TUNING.labelCharMs, 0) * 16) / 1000;
    const labelSlots = [];
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);
    // Shared across every slot — one plane, one disc, scaled per frame.
    const labelPlaneGeo = new THREE.PlaneGeometry(1, 1);
    const labelDotGeo = new THREE.CircleGeometry(1, 12);
    /* 10-09 (w9b, more-chips): THE LEADERS AND DOTS ARE BATCHED. Each slot
       used to draw three calls (chip, leader Line, dot Mesh) — 3N, which is
       what held the count at 4 under the 100-call budget. Now every slot's
       leader is two vertices of ONE LineSegments (RGBA vertex colour: the
       slot's leader colour at its own opacity) and every dot one instance of
       ONE InstancedMesh: N chips + 2. The per-slot API stays — slot.leader
       ({ a, b }: root → drawn end, world) and slot.dot ({ p, r }: centre,
       world radius) are what updateLabels writes, and slot.mats[1] / [2]
       stay the leader's and dot's { opacity, color, depthTest } that every
       family sets — flushLabelBatch packs them each render. A slot drawn
       with depthTest off (the CTA's first_contact) packs into a second pair
       (it draws over the world). ORDER, deliberately: the Thread −1, the S2
       hit dots 0, leaders 1, dots 2, chips 3 — a leader or dot never paints
       over any chip (chips, transparent and depth-sorted among themselves,
       always draw after every leader). */
    const LABEL_ORDER = { leader: 1, dot: 2, chip: 3 };
    /* Slot count is fixed at mount (the HeroLabels convention) — ?labels
       needs a reload, not an applyTuning. History: Nathan 09-10 capped the
       desktop at 4 and a phone took min(?labels, 3) (a term like
       INDUSTRY_OPPORTUNITIES is ≈200px, half a 390px viewport). 10-09 (w9b,
       more-chips): Nathan — "a lot more chips… now that they are
       differentiated by color". The leaders + dots are batched (N + 2
       calls, not 3N), so the count is measured, not capped: ?labels is the
       desktop's, ?labelsm the phone's own knob (no longer min(?labels, 3)).
       10-09 (w9b fix R7): read HERE, before the batches — each is sized from
       it (a fixed 32 silently dropped the leader + dot of every slot past it
       on a URL ?labels above the slider's 16). */
    const labelSlotCount = Math.max(1, Math.round(IS_MOBILE ? TUNING.labelCountMobile : TUNING.labelCount) || 1);
    const makeLabelBatch = (depthTest) => {
      const max = labelSlotCount; // one leader + one dot per slot, at most
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 6), 3).setUsage(THREE.DynamicDrawUsage));
      lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(max * 8), 4).setUsage(THREE.DynamicDrawUsage));
      lineGeo.setDrawRange(0, 0);
      const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      // The dots' opacity is binary (0 or LABEL_HOLD_ALPHA — set, never
      // tweened: the trio leaves by the draw), so the batch's material
      // carries it and a slot at 0 is simply left out.
      const dotMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest, opacity: LABEL_HOLD_ALPHA });
      const dots = new THREE.InstancedMesh(labelDotGeo, dotMat, max);
      dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      dots.count = 0;
      lines.renderOrder = LABEL_ORDER.leader;
      dots.renderOrder = LABEL_ORDER.dot;
      // the batches move every frame — their cached bounds would cull them
      lines.frustumCulled = false;
      dots.frustumCulled = false;
      lines.visible = false;
      dots.visible = false;
      labelGroup.add(lines, dots);
      return { lines, dots, max };
    };
    const labelBatches = [makeLabelBatch(true), makeLabelBatch(false)];
    const batchM = new THREE.Matrix4();
    const flushLabelBatch = () => {
      const counts = labelBatches.map(() => ({ l: 0, d: 0 }));
      for (const slot of labelSlots) {
        if (!slot.target || !slot.group.visible) continue;
        const k = slot.mats[1].depthTest === false ? 1 : 0;
        const B = labelBatches[k];
        const c = counts[k];
        const lm = slot.mats[1];
        if (lm.opacity > 0.002 && c.l < B.max) {
          const pos = B.lines.geometry.attributes.position.array;
          const col = B.lines.geometry.attributes.color.array;
          const { a, b } = slot.leader;
          pos.set([a.x, a.y, a.z, b.x, b.y, b.z], c.l * 6);
          col.set([lm.color.r, lm.color.g, lm.color.b, lm.opacity, lm.color.r, lm.color.g, lm.color.b, lm.opacity], c.l * 8);
          c.l += 1;
        }
        if (slot.mats[2].opacity > 0.002 && c.d < B.max) {
          batchM.makeScale(slot.dot.r, slot.dot.r, slot.dot.r).setPosition(slot.dot.p);
          B.dots.setMatrixAt(c.d, batchM);
          if (c.d === 0) B.dots.material.color.copy(slot.mats[2].color);
          c.d += 1;
        }
      }
      labelBatches.forEach((B, k) => {
        const c = counts[k];
        B.lines.geometry.setDrawRange(0, c.l * 2);
        B.lines.visible = c.l > 0;
        if (c.l) {
          B.lines.geometry.attributes.position.needsUpdate = true;
          B.lines.geometry.attributes.color.needsUpdate = true;
        }
        B.dots.count = c.d;
        B.dots.visible = c.d > 0;
        if (c.d) B.dots.instanceMatrix.needsUpdate = true;
      });
    };

    /* Style probe: process.css keeps owning the chips' typography. Read once
       at mount and again when the webfont lands (the first read would
       otherwise measure a fallback face and every chip would be the wrong
       width for the rest of the session). */
    const labelStyle = {
      font: '500 13px sans-serif',
      css: '#ffffff',
      color: new THREE.Color(0xffffff),
      track: 0,
      line: 16,
      padX: 6, // the fill's inset around the glyph run, px (the probe's padding)
      padY: 2,
    };
    const readLabelStyle = () => {
      if (!labelsEl || disposed) return;
      const probe = document.createElement('span');
      probe.className = 'process-label';
      probe.textContent = 'M';
      labelsEl.appendChild(probe);
      const cs = getComputedStyle(probe);
      const cssSize = parseFloat(cs.fontSize) || 13;
      // ?labelsize overrides the token's px; line and tracking (em-relative
      // in the CSS) scale with it so the chip keeps its proportions.
      const size = TUNING.labelSize > 0 ? TUNING.labelSize : cssSize;
      const k = size / cssSize;
      const line = parseFloat(cs.lineHeight);
      labelStyle.line = (Number.isFinite(line) ? line : cssSize * 1.3) * k;
      labelStyle.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
      labelStyle.css = cs.color || 'rgb(255,255,255)';
      labelStyle.track = (parseFloat(cs.letterSpacing) || 0) * k;
      labelStyle.padX = (parseFloat(cs.paddingLeft) || 0) * k;
      labelStyle.padY = (parseFloat(cs.paddingTop) || 0) * k;
      probe.remove();
      labelStyle.color.setStyle(labelStyle.css);
    };
    /** ?labelsize live: re-read the probe and repaint every bound chip at
     *  the new size (the canvas re-allocates — see drawChip). */
    const restyleLabels = () => {
      readLabelStyle();
      for (const slot of labelSlots) {
        if (!slot.term) continue;
        slot.textW = measureChars(slot, slot.chars);
        drawChip(slot);
      }
    };

    const makeLabelSlot = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      // depthWrite off across the trio: they are transparent, so they must
      // TEST against the shards (that is the occlusion) without stamping the
      // buffer and punching holes in whatever draws after them.
      const chipMat = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, depthWrite: false, opacity: 0,
      });
      // 10-09 (w9b): the leader's and dot's "materials" are their batch
      // entries' state (flushLabelBatch packs them) — the families keep
      // setting opacity / color / depthTest on slot.mats[1] / [2] as before.
      const leaderMat = { opacity: 0, color: new THREE.Color(0xffffff), depthTest: true, dispose() {} };
      const dotMat = { opacity: 0, color: new THREE.Color(0xffffff), depthTest: true, dispose() {} };
      const group = new THREE.Group();
      const chip = new THREE.Mesh(labelPlaneGeo, chipMat);
      chip.renderOrder = LABEL_ORDER.chip;
      group.add(chip);
      group.visible = false;
      labelGroup.add(group);
      return {
        group, chip,
        leader: { a: new THREE.Vector3(), b: new THREE.Vector3() }, // 10-09 (w9b): root → drawn end, world (the batch's segment)
        dot: { p: new THREE.Vector3(), r: 0 }, // 10-09 (w9b): centre + world radius (the batch's instance)
        canvas, ctx, texture,
        mats: [chipMat, leaderMat, dotMat],
        term: '', // the word on the chip — the supply skips words already out
        strikes: 0, // consecutive frames measured as mostly covered
        chars: [], // the term, per code point
        shown: [], // which have been cut in
        textW: 0, // chip width in screen px (the canvas is this × DPR)
        box: null, // last painted chip box in screen px — the anti-overlap test
        target: null, // the live Vector3 (shard mesh.position or decoy.pos)
        panel: null, // the keeper panel (for the front-facing test) or null (decoy)
        decoy: null, // the decoy it names (its cull scale `s` — a leaving chip's shard gone)
        last: null, // no-repeat guard: the target just released
        tl: null, // the cycle timeline (chip in → hold → fade)
        cut: null, // the running random-letter entrance (charCut clock)
        dc: null, // the re-slot breath (delayedCall)
        fading: false, // early fade in flight (one-shot latch)
        retracting: false, // the fill's retract is running — the last beat of every exit
        cutWait: null, // a leaving chip's letter cut, still waiting out its stagger (cutOutLabel)
        fill: null, // the shard's project colour (fillOf — dealt on its first naming; STROKE_CSS when the pool is empty)
        ink: '', // chipInk(fill) — the higher-contrast glyph colour on that fill
        sign: 1, // 1 = seated outward from the belt's centre, −1 = flipped inward (the frame edge)
        fillK: 0, // 0..1 how far the fill has wiped across
        leadK: 0, // 10-07 (final review): 0..1 how far the leader has drawn out from its root (rides fillK's clock)
        fillFrom: 0, // 0 = wipes from the left edge, 1 = from the right
        thread: false, // 10-07 (w4): a Thread word — held on its bead until the pull (threadLabelsActive's)
        spec: false, // 10-07 (w5): an S3 spec chip — held on the Core until it turns away or the stage leaves (specActive's)
        cta: false, // 10-07 (w7): the CTA's first_contact chip — held on the freed shard until the CTA leaves (contact.active's)
        page: false, // 10-08 (w8): an S5 page chip — the chapter's word on the world, held for its page (pageActive's)
      };
    };

    if (labelsEl && !PREFERS_REDUCED_MOTION) {
      readLabelStyle();
      document.fonts?.ready.then(readLabelStyle);
      // labelSlotCount: read at mount beside the batches it sizes (LABEL_ORDER)
      for (let i = 0; i < labelSlotCount; i++) labelSlots.push(makeLabelSlot());
    }

    /* Canvas paint. One glyph at a time, advancing by the probe's tracking —
       hand-advanced rather than via ctx.letterSpacing, because the per-char
       loop is exactly what the letter cut needs anyway. */
    const labelCtxFont = (slot) => {
      slot.ctx.font = labelStyle.font;
      slot.ctx.textBaseline = 'middle';
    };
    const measureChars = (slot, chars) => {
      slot.ctx.setTransform(1, 0, 0, 1, 0, 0);
      labelCtxFont(slot);
      let w = 0;
      for (const ch of chars) w += slot.ctx.measureText(ch).width + labelStyle.track;
      return Math.max(Math.ceil(w - labelStyle.track) + 2, 1); // shed the trailing track, +2 for AA
    };
    /* The chip's BOX (10-07): the glyph run plus the fill's inset each side.
       Every seat, collision and leader-edge test measures this, not the
       bare text — the fill is what a neighbour would collide with. */
    const chipW = (textW) => textW + 2 * labelStyle.padX;
    const chipH = () => Math.max(labelStyle.line, 1) + 2 * labelStyle.padY;
    /* Term supply. The rolling cursor keeps the vocabulary moving, but it
       must SKIP anything currently on screen: yields rebind often enough now
       to burn through all 17 terms inside one chip's lifetime, and two chips
       reading the same word is the one mistake an annotation layer cannot
       make. peekTerm is non-consuming — the anti-overlap test has to measure
       the real word, not an average. */
    const termAt = (offset) => {
      const held = new Set(labelSlots.map((s) => s.term).filter(Boolean));
      for (let k = 0; k < LABEL_TERMS.length; k++) {
        const term = LABEL_TERMS[(termCursor + offset + k) % LABEL_TERMS.length].toUpperCase();
        if (!held.has(term)) return { term, step: k + 1 };
      }
      return { term: LABEL_TERMS[termCursor % LABEL_TERMS.length].toUpperCase(), step: 1 };
    };
    const peekTerm = () => termAt(0).term;
    /* A shard KEEPS ITS WORD (Nathan, 09-10). A chip that fades and comes
       back on the same shard reading something else breaks the claim that
       the shard IS that thing — the label was naming it, not decorating it.
       Keyed by the live target (a mesh.position or decoy.pos — stable
       object identities), so a shard re-picked by any slot, at any later
       point in the belt's life, gets the word it was first given. The pool
       therefore skips a shard whose word is currently on screen elsewhere. */
    const termOf = new Map();
    /* 10-07 (w3): a shard keeps its COLOUR too — the fill is dealt with the
       word, on the shard's FIRST naming, and reused on every re-bind. Same
       key as termOf (mesh.position / decoy.pos — the shard's own object,
       which matchSlots never moves: it permutes the beltPos references), so
       the colour survives break → reform → re-break. The pool cursor only
       advances on a first naming, so new names still run the palette in
       Nathan's modulo order. */
    const fillOf = new Map();
    /* 10-07 (w5, s3-spec-sheet): the S3 spec words, keyed the same way but
       NEVER in termOf — the spec pool skips a named shard, and a shard that
       wore a spec word never takes ANOTHER spec word (a shard keeps its word
       on the Core). */
    const specOf = new Map();
    /* 10-07 (w5 fix): …but only each word's LATEST shard (specSeat: word →
       pos) is held out of the S1 pool and the tour's subjects (specHeld). A
       word re-seats on a fresh panel every time its shard turns away, so
       holding out every shard it ever wore drained the belt over a long S3
       dwell (≈2 a revolution per word, one a beat under a drag) — and a tour
       subject the pool could not name went unnamed. The S1 pool now loses
       at most 4 (3 on a phone); a retired spec shard is anonymous again once
       it is back in the belt. */
    const specSeat = new Map();
    /* 10-07 (final review): …and each spec WORD keeps one colour (word →
       fill), dealt on its first seat. A word re-seats on a fresh shard every
       time its shard turns away, and dealing per shard gave LOGO_SUITE teal
       on one visit and orange on the next — the S5 ● (the chapter's
       remembered S3 fill) followed whichever seat came last. A fresh shard
       takes its word's colour; a shard's own fillOf is never overwritten
       (pickSpecSeat only offers a shard unnamed or already wearing this
       word, so the two agree). */
    const specFillOf = new Map();
    const specHeld = (pos) => {
      // 10-07 (w7): …and every shard that wore the CTA's first_contact (w7
      // fix: all of them, not the latest — a shard keeps its word).
      if (contact.held.has(pos)) return true;
      const w = specOf.get(pos);
      return w !== undefined && specSeat.get(w) === pos;
    };
    /* The labelled shard DARKENS on the house pulse (Nathan, 09-10): the S5
       envelope (?bpm ?hold ?decay) inverted — snap down to ?labelpulse,
       hold, expo recover to lit — looping for as long as the chip names
       it. Decoys are one instanced draw and cannot pulse per shard. */
    const pulseOn = (panel) => {
      if (!panel || TUNING.labelPulse >= 0.999) return;
      const u = panel.mesh.material.uniforms.uPower;
      gsap.killTweensOf(u);
      const beat = 60 / Math.max(TUNING.bpm, 1);
      // The belt rests at ?idlepower, not full — the floor is a FRACTION of
      // that resting level, and the recover lands back on it.
      const rest = getPose(stage)?.power ?? 1;
      const floor = rest * Math.max(TUNING.labelPulse, 0);
      const attack = Math.min(0.07, beat * 0.15);
      const hold = Math.max(TUNING.holdBeats * beat, 0.02);
      const decay = Math.max(TUNING.decayBeats * beat, 0.08);
      const decayEase = TUNING.decayCurve === 'linear' ? 'none' : 'expo.out';
      panel.pulse = gsap.timeline({ repeat: -1 }).to(u, {
        keyframes: [
          { value: floor, duration: attack, ease: 'power2.out' },
          { value: floor, duration: hold, ease: 'none' },
          { value: rest, duration: decay, ease: decayEase },
        ],
      });
    };
    /* 10-07 (w5): `power` = where the recover lands — the NEXT stage's
       power when a leave runs ahead of a transition (leaveLabels): an S3 spec
       chip's shard recovering to S3's full power while S3→S2's morph takes it
       to ?idlepower would race it and strand the shard lit on S2. */
    /* 10-09 (w9b): the default recover is the shard's OWN rest on this stage —
       a bead on S2's live string rests DARK (s2BeadPower), not at the pose's
       bare level. setStageInstant S3→S2 lays restThread and THEN stops the
       chips (stopLabels), so an S3 spec chip's shard that is a bead recovered
       to ?idlepower over the claim: 41/42 dark, one bead lit (the S2 harness,
       interrupts, `s2cut`, both widths). leaveLabels passes its own. */
    const restPowerOf = (panel) => {
      const pose = getPose(stage);
      if (pose?.thread && threadActive && threadChain.includes(panel)) return s2BeadPower();
      return pose?.power ?? 1;
    };
    const pulseOff = (panel, power = restPowerOf(panel)) => {
      if (!panel?.pulse) return;
      panel.pulse.kill();
      panel.pulse = null;
      const u = panel.mesh.material.uniforms.uPower;
      gsap.killTweensOf(u);
      gsap.to(u, { value: power, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    };
    const heldTerms = () => new Set(labelSlots.map((s) => s.term).filter(Boolean));
    // 10-07 (w5): a spec candidate carries its own word (cand.term)
    const termFor = (cand) => cand.term ?? termOf.get(cand.pos) ?? peekTerm();
    const drawChip = (slot) => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      const w = chipW(slot.textW);
      const h = Math.max(Math.ceil(chipH()), 1);
      const cw = Math.max(Math.ceil(w * dpr), 1);
      const chh = Math.max(Math.ceil(h * dpr), 1);
      if (slot.canvas.width !== cw || slot.canvas.height !== chh) {
        slot.canvas.width = cw; // resizing resets the 2d state — font is re-set below
        slot.canvas.height = chh;
        // three allocates a CanvasTexture's GPU storage ONCE (texStorage2D,
        // immutable) and later uploads are texSubImage2D into it — so a
        // shorter term painted into a slot that last held a longer one left
        // the old word's tail on the plane ("INQUIRY_NOTES" + "…YSIS"). Free
        // the GL texture on a size change and it reallocates at the new size.
        slot.texture.dispose();
      }
      const ctx = slot.ctx;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // The whole backing store (the ceil'd px), so the fill leaves no
      // transparent sliver along the far edges — the corners stay sharp.
      const W = cw / dpr;
      const H = chh / dpr;
      ctx.clearRect(0, 0, W, H);
      if (slot.fill) {
        // The box wipes in from the side its leader lands on (fillFrom), and
        // the letters exist only where it has reached — the kw highlight's
        // box-then-ink idiom, so no glyph ever sits on the bare field.
        const fw = W * slot.fillK;
        const fx = slot.fillFrom ? W - fw : 0;
        ctx.fillStyle = slot.fill;
        ctx.fillRect(fx, 0, fw, H);
        // 10-07 (w3, ?chipkey — Nathan's A/B, off): a 1px keyline in the
        // shards' own edge ink, riding the wipe (fx/fw) — #3D32FF is all but
        // the field's blue, and the dark reds sit equiluminant with it.
        // 10-08 (w8): `auto` keys only a fill that sinks (chipKeyed).
        slot.keyed = chipKeyed(slot);
        if (slot.keyed && fw > 1) {
          ctx.strokeStyle = STROKE_CSS;
          ctx.lineWidth = 1;
          ctx.strokeRect(fx + 0.5, 0.5, fw - 1, H - 1);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(fx, 0, fw, H);
        ctx.clip();
      }
      labelCtxFont(slot);
      ctx.fillStyle = slot.ink || labelStyle.css;
      let x = labelStyle.padX + 1;
      for (let i = 0; i < slot.chars.length; i++) {
        const adv = ctx.measureText(slot.chars[i]).width + labelStyle.track;
        if (slot.shown[i]) ctx.fillText(slot.chars[i], x, H / 2);
        x += adv;
      }
      if (slot.fill) ctx.restore();
      slot.texture.needsUpdate = true;
    };

    // Scratch — updateLabels/pick are synchronous, single-threaded.
    const lblNdc = new THREE.Vector3();
    const lblWorld = new THREE.Vector3();
    // 10-07 (w3 fix): chipSeat's own — it used to borrow lblWorld for the
    // belt's centre, which is the very vector chipFits hands it, so the
    // inward (−1) pass measured a chip seated on the centre, not the shard.
    const lblCentre = new THREE.Vector3();
    const lblNormal = new THREE.Vector3();
    const lblAxis = new THREE.Vector3();

    // Refresh the matrices we read (render hasn't run for this frame yet —
    // discPx's guarantee, reused).
    const refreshLabelMatrices = () => {
      camera.updateMatrixWorld();
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      globeGroup.updateMatrixWorld();
    };
    // Front-facing: the shard's world face normal · (shard→camera). >EPS
    // faces the camera. Decoys have no stable normal — always "front" (only
    // the viewport test gates them).
    const labelProminence = (panel) => {
      if (!panel) return 1;
      lblNormal.copy(panel.centerDir).applyQuaternion(panel.mesh.quaternion);
      lblNormal.transformDirection(globeGroup.matrixWorld);
      lblWorld.copy(panel.mesh.position);
      globeGroup.localToWorld(lblWorld);
      lblAxis.copy(camera.position).sub(lblWorld).normalize();
      return lblNormal.dot(lblAxis);
    };

    /* Screen geometry. The camera is axis-aligned and never rotates, so the
       whole projection is arithmetic on world x/y over view depth — no
       matrices, and the inverse (screen px back to world at a given depth)
       is just as direct, which is what places the chip. */
    /* The copy column is DOM painted OVER the canvas, so depth cannot keep a
       chip out from under the page's own type — and text over text is the
       one read the layer must never produce.

       10-07 (w3, keep-out): KEEP BOXES — every piece of type and chrome the
       reader can see right now, as a LIST of padded boxes (never a union: a
       union of the hero and S1 copy mid-glide would blank half the frame).
       Round 1 measured stage-01's copy alone, once, as one box, so chips
       landed on the hero lockup on every scroll-back, on the [next] stepper
       and on the header's featured_projects link. Covered:
         · the copy of every .process-section whose rect meets the viewport
           — hero token + title + the globe-O slot while it shows; a stage's
           chip, headline, blurb and caption; the CTA's display, line and
           actions (+ the phone's in-flow back_to_top);
         · the fixed chrome: the header (lockup, pills, links), the
           [previous]/[next] steppers, the tagline + privacy pills, the
           status bar, the footer's links once it has risen.
       Queried LAZILY at use (client:only island DOM goes stale — never hold a
       mount-time ref; the header and the pills are not even this island's),
       only what is visible (checkVisibility: opacity + visibility, so the
       hidden [previous] on the hero and a faded tagline don't count), every
       rect read in one batch with no write between. Memoised for ~a frame:
       the tick, a bind and the stats share one read. THE helper later beats
       reuse (the Thread's words, the S3 spec chips, the CTA chip). */
    const KEEP_PAD = 12; // px of clear air a chip keeps from any keep box
    const KEEP_COPY = [
      '.process-hero__token', '.process-hero__title', '.process-hero__globe-o',
      '.process-stage__chip', '.process-stage__headline', '.process-stage__blurb', '.process-stage__caption',
      '.process-stage__next', // 10-08 (w8): the phone's ?nexttease line
      '.process-cta__display', '.process-cta__line', '.process-cta__actions', '.process-cta__top',
    ].join(', ');
    const KEEP_CHROME = [
      '.site-nav__lockup', '.site-nav__pill', '.site-nav__link',
      '.process-stepnav__cta', '.site-tagline__pill', '.site-privacy', '.detail-progress',
      '.site-footer__link',
    ].join(', ');
    const keepList = [];
    let keepAt = -Infinity;
    const keepEls = [];
    /* 10-07 (w3): a box LEADS its own motion. The commit's glide carries the
       copy column ~70px a frame past the fixed canvas, and the scene's tick
       can measure a frame behind the scroll that paints with it (Lenis and
       this tick share gsap.ticker in mount order; the FPS gate can skip a
       frame) — the phone walk caught MUSIC_CATALOG over DISCOVERY for a
       frame as the copy swept up through it. So each box is stretched,
       in the direction it is moving, by KEEP_LEAD × its last displacement
       (the last measure under 80ms ago — a resting page stretches nothing). */
    const KEEP_LEAD = 2;
    const keepPrev = new WeakMap(); // element → [left, top, at] (mutated in place)
    /* 10-07 (final review): the per-frame cost. The tick runs this every
       frame a chip is live (60Hz is 16.7ms, past the 12ms memo), and it used
       to re-query the whole page each time. Now the ELEMENT LIST is cached
       and rebuilt only when what it would find can change — the set of
       sections meeting the viewport (a bit mask), the footer's reveal, the
       viewport size, a cached element leaving the DOM, or KEEP_LIST_MS of
       age (chrome mounted later still joins) — and the boxes are pooled.
       The rects are still read EVERY call: KEEP_LEAD needs a fresh
       displacement each frame. */
    const KEEP_LIST_MS = 500;
    let keepSections = null;
    let keepKey = '';
    let keepListAt = -Infinity;
    const keepPool = [];
    const keepElsLive = () => {
      for (let i = 0; i < keepEls.length; i++) if (!keepEls[i].isConnected) return false;
      return true;
    };
    const keepBoxes = () => {
      const now = performance.now();
      if (now - keepAt < 12) return keepList;
      keepAt = now;
      keepList.length = 0;
      const base = container.getBoundingClientRect();
      if (!keepSections || !keepSections.every((sec) => sec.isConnected)) {
        keepSections = [...document.querySelectorAll('.process-page .process-section')];
        keepKey = '';
      }
      let mask = 0;
      keepSections.forEach((sec, i) => {
        const r = sec.getBoundingClientRect();
        if (r.bottom > base.top && r.top < base.bottom) mask |= 1 << i;
      });
      const footer = document.documentElement.hasAttribute('data-footer-revealed');
      const key = `${mask}|${footer ? 1 : 0}|${Math.round(base.width)}x${Math.round(base.height)}`;
      if (key !== keepKey || now - keepListAt > KEEP_LIST_MS || !keepElsLive()) {
        keepKey = key;
        keepListAt = now;
        keepEls.length = 0;
        keepSections.forEach((sec, i) => {
          if (mask & (1 << i)) sec.querySelectorAll(KEEP_COPY).forEach((el) => keepEls.push(el));
        });
        document.querySelectorAll(KEEP_CHROME).forEach((el) => keepEls.push(el));
        // 10-07 (w7): the risen footer PANEL itself, not only its links — the
        // CTA rest's chip must sit above it (only while it is revealed).
        if (footer) {
          const panel = document.querySelector('.site-footer--links');
          if (panel) keepEls.push(panel);
        }
      }
      const vw = base.width;
      const vh = base.height;
      for (let i = 0; i < keepEls.length; i++) {
        const el = keepEls[i];
        // 10-09 (w9): keepHeld counts while hidden (S2's blurb, waiting on the dots)
        const shown = !el.checkVisibility || el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
        if (!shown && el !== keepHeld) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const prev = keepPrev.get(el);
        let mx = 0; // the element's own displacement since the last measure
        let my = 0;
        if (prev && now - prev[2] < 80) {
          mx = r.left - prev[0];
          my = r.top - prev[1];
        }
        if (prev) {
          prev[0] = r.left;
          prev[1] = r.top;
          prev[2] = now;
        } else {
          keepPrev.set(el, [r.left, r.top, now]);
        }
        const dx = mx * KEEP_LEAD;
        const dy = my * KEEP_LEAD;
        const x0 = r.left - base.left - KEEP_PAD + Math.min(dx, 0);
        const y0 = r.top - base.top - KEEP_PAD + Math.min(dy, 0);
        const x1 = r.right - base.left + KEEP_PAD + Math.max(dx, 0);
        const y1 = r.bottom - base.top + KEEP_PAD + Math.max(dy, 0);
        if (x1 < 0 || y1 < 0 || x0 > vw || y0 > vh) continue;
        const k = keepPool[keepList.length] ?? (keepPool[keepList.length] = { x0: 0, y0: 0, x1: 0, y1: 0, bare: { x0: 0, y0: 0, x1: 0, y1: 0 } });
        k.x0 = x0;
        k.y0 = y0;
        k.x1 = x1;
        k.y1 = y1;
        // 10-09 (w9 fix): a HELD box (still hidden) keeps chips off the seat
        // it is about to rise into, but nothing is painted there yet — the
        // white Thread's type mask skips it (syncThreadKeep)
        k.held = !shown;
        /* 10-07 (w3 fix): and the BARE type where it paints this frame — the
           element box led by ONE displacement (the frame the tick can run
           behind), no air, no anticipation. Only a chip on this snaps out;
           one inside the rest of the led air is cut (updateLabels), so a
           chip leaving ahead of the phone's sweeping copy runs its letter
           cut until the type actually reaches it. */
        k.bare.x0 = r.left - base.left + Math.min(mx, 0);
        k.bare.y0 = r.top - base.top + Math.min(my, 0);
        k.bare.x1 = r.right - base.left + Math.max(mx, 0);
        k.bare.y1 = r.bottom - base.top + Math.max(my, 0);
        keepList.push(k);
      }
      return keepList;
    };
    /** Does a chip box (centre x/y, size w×h, screen px) cross a keep box?
     *  `grow` widens (or, negative, shrinks) every box first. `bare` tests
     *  the type where it paints this frame instead (no air, one frame of
     *  lead — the snap-out grows it by half the air). */
    const hitsKeep = (keep, x, y, w, h, grow = 0, bare = false) => {
      for (let i = 0; i < keep.length; i++) {
        const k = bare ? keep[i].bare : keep[i];
        if (
          x + w / 2 > k.x0 - grow && x - w / 2 < k.x1 + grow &&
          y + h / 2 > k.y0 - grow && y - h / 2 < k.y1 + grow
        ) return true;
      }
      return false;
    };
    /** 10-07 (final review): THE screen view — viewport px and the lens
     *  tangents — filled into `out` IN PLACE (it was rebuilt as a fresh
     *  object at nine sites, three of them per frame). The default is one
     *  shared object for the synchronous one-shot readers (pickView,
     *  stepReach, trackFrame); a caller that holds its view across another
     *  reader's call passes its own (labelView, the bow, the contact pick). */
    const sharedView = { vw: 1, vh: 1, tanV: TAN_V, tanH: TAN_V };
    const screenView = (out = sharedView) => {
      out.vw = container.clientWidth || 1;
      out.vh = container.clientHeight || 1;
      out.tanV = TAN_V;
      out.tanH = TAN_V * (camera.aspect || 1);
      return out;
    };
    const labelViewOut = { vw: 1, vh: 1, tanV: TAN_V, tanH: TAN_V, keep: keepList };
    const labelView = () => {
      screenView(labelViewOut);
      labelViewOut.keep = keepBoxes();
      return labelViewOut;
    };
    const toPx = (world, view, out) => {
      const depth = camera.position.z - world.z;
      if (depth <= 0.05) return null;
      out.x = view.vw / 2 + ((world.x - camera.position.x) / (depth * view.tanH)) * (view.vw / 2);
      out.y = view.vh / 2 - ((world.y - camera.position.y) / (depth * view.tanV)) * (view.vh / 2);
      out.depth = depth;
      // world units per screen px AT THIS DEPTH — the chip's scale factor
      out.perPx = (depth * view.tanV * 2) / view.vh;
      return out;
    };
    const lblA = { x: 0, y: 0, depth: 0, perPx: 0 };
    const lblB = { x: 0, y: 0, depth: 0, perPx: 0 };
    const lblChip = { x: 0, y: 0 };

    /* Where a chip WOULD land for a given anchor: outward from the belt's
       centre by the leader length, the direction taken in screen space so it
       reads as "away from the cloud" whatever the dolly is doing. Fills
       lblChip and returns the outward unit vector, or null off-screen.
       10-07 (w3): `sign` −1 seats it INWARD instead — the bind flips a chip
       whose outward seat would hang off the frame edge (a phone's 390px
       could not hold INQUIRY_NOTES outward of a right-third subject), and
       the slot keeps that side for its life. */
    // Phones get a shorter leader for the same reason they get fewer chips:
    // the frame cannot spare 64px of empty run either side of a chip that is
    // already half its width.
    const chipLead = () => Math.max(TUNING.labelLead, 0) * (IS_MOBILE ? 0.6 : 1);
    const chipSeat = (worldPos, view, out, sign = 1) => {
      if (!toPx(worldPos, view, lblA)) return null;
      lblCentre.set(globeGroup.position.x, globeGroup.position.y, 0);
      const centre = toPx(lblCentre, view, lblB);
      let ox = centre ? lblA.x - centre.x : 1;
      let oy = centre ? lblA.y - centre.y : 0;
      const od = (Math.hypot(ox, oy) || 1) * (sign < 0 ? -1 : 1);
      ox /= od;
      oy /= od;
      const lead = chipLead();
      lblChip.x = lblA.x + ox * lead;
      lblChip.y = lblA.y + oy * lead;
      out.ox = ox;
      out.oy = oy;
      return out;
    };
    const seatOut = { ox: 1, oy: 0 };

    const labelPool = () => {
      const pool = [];
      panels.forEach((p) => {
        // 10-07 (w5): never a shard that holds an S3 spec word (specHeld)
        if (p.driftFactor > 0.5 && !specHeld(p.mesh.position)) pool.push({ pos: p.mesh.position, panel: p });
      });
      if (decoyMesh.visible) {
        decoys.forEach((d) => {
          if (d.s > 0.9) pool.push({ pos: d.pos, panel: null, decoy: d });
        });
      }
      return pool;
    };
    // Pick-time visibility: front-facing AND the anchor projects comfortably
    // on-screen (|ndc| < BIND).
    /* A decoy is a flat shard too: its face normal is the proto's centerDir
       under its own quaternion. Round 3 called every decoy "front-facing",
       so an edge-on one — a hairline — could take a chip. */
    const decoyProminence = (d) => {
      lblNormal.copy(decoyProto.centerDir).applyQuaternion(d.quat);
      lblNormal.transformDirection(globeGroup.matrixWorld);
      lblWorld.copy(d.pos);
      globeGroup.localToWorld(lblWorld);
      lblAxis.copy(camera.position).sub(lblWorld).normalize();
      return lblNormal.dot(lblAxis);
    };
    /* How far into the haze a target sits (0 crisp → 1 the field colour).
       A chip on a shard the haze has all but erased points at nothing. */
    const hazeAt = (cand) => {
      if (fogState.amount <= 0) return 0;
      lblWorld.copy(cand.pos);
      globeGroup.localToWorld(lblWorld);
      const depth = camera.position.z - lblWorld.z;
      const w = (depth - fogState.near) / Math.max(fogState.far - fogState.near, 1e-4);
      return Math.min(Math.max(w, 0), 1) * fogState.amount;
    };
    const labelVisible = (cand) => {
      // Bind-time facing floor is STRICTER than the keep floor: a shard
      // 80° off square still "faces" the lens but reads as a sliver, and a
      // chip on a sliver reads as a chip on nothing (Nathan, 09-10).
      const facing = cand.panel ? labelProminence(cand.panel) : decoyProminence(cand.decoy);
      if (facing < LABEL_BIND_FACING) return false;
      if (hazeAt(cand) > LABEL_HAZE_MAX) return false;
      lblNdc.copy(cand.pos);
      globeGroup.localToWorld(lblNdc).project(camera);
      return (
        lblNdc.z <= 1 &&
        Math.abs(lblNdc.x) < LABEL_NDC_BIND &&
        Math.abs(lblNdc.y) < LABEL_NDC_BIND
      );
    };
    /* Anti-overlap: would this candidate's chip land on a chip already out?
       Boxes come from the last painted frame (slot.box), and the candidate is
       sized with a nominal width — the term isn't chosen until bind, and a
       rough box is enough to break up clustering. */
    /* Would a shard already be sitting in front of this seat? A chip that
       latches into a spot it is 70% hidden in is noise — the occlusion only
       reads as depth when it happens to a chip you could otherwise see. Each
       shard is tested as its bounding circle in screen px, which is generous
       (it over-rejects at the corners) and costs one projection per shard on
       a cadence of seconds, not frames.

       The DECOY FLOOD counts. It is easy to forget because the haze paints a
       distant decoy almost exactly the colour of the field it sits on — but
       it is still an opaque mesh writing depth, so it hides a chip just as
       hard as a shard you can see. Leaving the pool out of this test was
       what left words trailing a stray glyph poking out from behind a panel
       that looked like empty blue. */
    const lblCircle = new THREE.Vector3();
    /* Every shard reduced to a screen-space circle ONCE per frame, then every
       coverage question is arithmetic. Projecting inside the sample loop
       instead cost 7 projections per sample point and made the test too
       expensive to run on more than one chip a frame — which was the reason
       badly-buried chips lingered long enough to be read as garbage. */
    const occluders = [];
    let occStamp = -1;
    const pushOccluder = (view, pos, radius) => {
      lblCircle.copy(pos);
      globeGroup.localToWorld(lblCircle);
      if (!toPx(lblCircle, view, lblB)) return;
      occluders.push({
        x: lblB.x,
        y: lblB.y,
        // The bounding SPHERE circumscribes a flat shard, so the raw radius
        // claims more cover than the quad has; 0.85 lands nearer its real
        // silhouette and stops clear chips being told to move.
        r: (radius * 0.85) / lblB.perPx,
        depth: lblB.depth,
      });
    };
    const buildOccluders = (view, stamp) => {
      if (occStamp === stamp) return;
      occStamp = stamp;
      occluders.length = 0;
      for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        if (p.driftFactor > 0.5) pushOccluder(view, p.mesh.position, p.boundRadius || 0.2);
      }
      if (decoyMesh.visible) {
        for (let i = 0; i < decoys.length; i++) {
          const d = decoys[i];
          const scale = d.scale * d.s;
          if (scale > 0.05) pushOccluder(view, d.pos, decoyRadius * scale);
        }
      }
    };
    const coveredAt = (x, y, reach, depth) => {
      for (let i = 0; i < occluders.length; i++) {
        const o = occluders[i];
        if (o.depth >= depth || o.depth <= 0.05) continue; // behind the chip
        const dx = o.x - x;
        const dy = o.y - y;
        const reachR = o.r + reach;
        if (dx * dx + dy * dy < reachR * reachR) return true;
      }
      return false;
    };
    let occTick = 0;
    const seatBehindShard = (view, chipX, chipY, w, h, depth) => {
      buildOccluders(view, (occTick += 1)); // a pick is off-cadence — rebuild
      return coveredAt(chipX, chipY, Math.max(w, h) / 2, depth);
    };

    /* How much of a chip may be hidden before it should give up. A chip
       clipped at one end still reads (and the clipping is what pairs it with
       its shard); one cut down to a stray syllable is just noise sitting next
       to whatever else is on screen. Sampled across the chip's width. */
    const CHIP_COVER_MAX = 0.4;
    const CHIP_COVER_SAMPLES = 7;
    /* Two strikes, not one. A single sample can catch a shard mid-sweep across
       a chip that is about to be clear again, and yielding on that turns the
       layer twitchy: every yield is a rebind, every rebind is another chance
       to collide, and the churn feeds itself. */
    const CHIP_COVER_STRIKES = 2;
    const chipCoverage = (slot) => {
      if (!slot.box) return 0;
      const { x, y, w, depth } = slot.box;
      const near = depth - labelLift();
      let hit = 0;
      for (let k = 0; k < CHIP_COVER_SAMPLES; k++) {
        const sx = x - w / 2 + (w * (k + 0.5)) / CHIP_COVER_SAMPLES;
        if (coveredAt(sx, y, 1, near)) hit += 1;
      }
      return hit / CHIP_COVER_SAMPLES;
    };
    /* 10-08 (w8, reg1-occluded-chip-bare-leader, option b): the EXACT cover
       of a seat, at the bind only — the share of the chip box's
       CHIP_COVER_SAMPLES points (across its width, at its centre line) whose
       ray from the lens strikes a panel mesh or a decoy NEARER than the
       chip's lifted depth (raycaster.far is that depth along each ray, so
       any hit at all is a cover). The screen-circle guard (coveredAt, the
       fixer's) over-called cover at close-ups — a bounding circle claims a
       shard's corners — and starved the tour subject (namings 17.3 → 11.7
       /100s); the triangles do not. FrontSide like the render, so a back
       panel the lens cannot see never covers. Never per frame: one reused
       Raycaster, scratch vectors, the visible meshes listed per call. The
       decoy pool's bounding sphere is recomputed first — three caches it on
       the first raycast and the decoys have drifted since. */
    const coverRay = new THREE.Raycaster();
    const coverDir = new THREE.Vector3();
    const coverHits = [];
    const coverObjs = [];
    const coverSphere = new THREE.Sphere();
    const exactCover = (view, x, y, w, depth) => {
      coverObjs.length = 0;
      // 10-08 (w8 fix2): only the shards that reach NEARER than the chip
      // can cover it (far clips every hit behind it), so the rest are culled
      // once here, not tested by all seven rays — the S5 page walk calls this
      // up to 17× a look. Same hits, same answer: the raycast's own bounding
      // sphere, in world. With the panels' bounding box and the first-hit
      // stop below, a phone page bind measured mean 4.2 → 2.9 ms, max 9 → 5.
      const camZ = camera.position.z;
      for (let i = 0; i < panels.length; i++) {
        const m = panels[i].mesh;
        if (!m.visible || m.scale.x <= 0.05) continue;
        coverSphere.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
        if (camZ - coverSphere.center.z - coverSphere.radius < depth) coverObjs.push(m);
      }
      if (decoyMesh.visible) {
        decoyMesh.computeBoundingSphere();
        coverObjs.push(decoyMesh);
      }
      let hit = 0;
      for (let k = 0; k < CHIP_COVER_SAMPLES; k++) {
        const sx = x - w / 2 + (w * (k + 0.5)) / CHIP_COVER_SAMPLES;
        // the camera never rotates (toPx's model): NDC → a view-space ray
        coverDir.set(((sx / view.vw) * 2 - 1) * view.tanH, (1 - (y / view.vh) * 2) * view.tanV, -1).normalize();
        coverRay.set(camera.position, coverDir);
        coverRay.far = Math.max(depth, 0.05) / -coverDir.z;
        coverHits.length = 0;
        // any hit is a cover — stop at the first (no sort, no rest of the list)
        for (let j = 0; j < coverObjs.length && !coverHits.length; j++) coverObjs[j].raycast(coverRay, coverHits);
        if (coverHits.length) hit += 1;
      }
      return hit / CHIP_COVER_SAMPLES;
    };

    /* Clear air demanded between two chips, px. Generous on purpose: two
       boxes that merely ABUT do not overlap, but their words run together
       into one unreadable string — which is the failure you actually see, not
       glyphs on glyphs. Roughly two characters' worth keeps them separate
       words. Governs both the bind-time rejection and the drift yield. */
    const CHIP_PAD = 28;
    const boxesHit = (ax, ay, aw, ah, box, pad = CHIP_PAD) =>
      Math.abs(ax - box.x) < (aw + box.w) / 2 + pad &&
      Math.abs(ay - box.y) < (ah + box.h) / 2 + pad;
    /** The chip's whole box has to be on screen — the NDC tests govern the
     *  ANCHOR, and the chip now sits ?labellead beyond it, so a shard well
     *  inside the frame can still hang its label off the edge. `m` is the
     *  clear margin to the frame edge, px. */
    const inFrame = (view, x, y, w, h, m = 4) =>
      x - w / 2 > m && x + w / 2 < view.vw - m && y - h / 2 > m && y + h / 2 < view.vh - m;
    // 10-07 (w3): a bind leaves this much more room to the edge than the
    // per-frame clamp's 4px (updateLabels), so the clamp rarely has to act.
    const CHIP_EDGE_SLACK = 12;
    const CHIP_EDGE_M = 4;
    const chipInFrame = (view, x, y, w, h, m = CHIP_EDGE_M, keepGrow = 0) =>
      inFrame(view, x, y, w, h, m) && !hitsKeep(view.keep, x, y, w, h, keepGrow);
    /* Where a candidate's chip may sit — outward first, inward if the
       outward seat fails (10-07, w3: the frame edge) — or 0 when neither
       side passes. `strict` is the readable seat (frame + keep-out + clear
       of other chips + not buried behind a shard); loose is only in frame and
       off every keep box: the fallback never seats text over text. The side
       that passed rides the candidate to the bind (cand.sign). */
    // 10-07 (w5): keepGrow — extra air from the keep boxes at the bind (a
    // Thread word: the camera's creep carried seats placed flush against the
    // copy into it, and the keep-out cut them ~0.7s after they typed in).
    // 10-08 (w8): `exact` — the seat must also pass exactCover (the real
    // triangles, ≤ CHIP_COVER_MAX). On by default for the LOOSE seat (S1's
    // fallback pool and the tour subject's last resort, the Thread words'
    // fallback): it had no occlusion test at all, and the held station keeps
    // a buried bind for its whole shot. The strict path keeps its own
    // screen-circle test untouched; the S5 page chips ask for both (the
    // emanated world's shards are not drift occluders).
    // 10-08 (w8b): `from` −1 tries the inward side only (?chipcover hold:
    // an outward seat that fails the predicted hold gives the flip its try);
    // `w0` the chip's box width when the caller has measured it already.
    /* 10-09 (w9b, more-chips 6e): THE LEADER RULE — S1's readable seat
       refuses a chip whose leader would run through another live chip's box,
       or whose box would sit on another chip's leader. Measured, not
       guessed: with the count raised the leader×chip crossings per bind
       rose with N (desktop 0.067 at 4 → 0.138 / 0.156 / 0.231 / 0.265 at
       6 / 8 / 10 / 12; phone 0.131 at 3 → 0.227 at 5), and the batch draws
       every chip over every leader, so a crossing reads as a line diving
       under another word. Each leader is taken root → its chip's CENTRE
       (the run inside its own box only reaches a box within CHIP_X_PAD of
       it: strict seats already keep CHIP_PAD 28 px apart, and a loose seat
       that close is refused here, no loss). The margin is the drift's: past
       the bind the held station still moves (the camera tracks its subject,
       the cloud turns), and at 8 chips a 6 px margin left 0.098 crossings
       per bind, 18 of 20 born > 0.6 s after their binds; 20 px read 0.058 —
       under today's 0.067 at 4 — at the same reach (0.89) and readable
       namings. S1 only (stage-01 — the tour's chips): the Thread words, the S3 spec sheet, the S5 pages and the CTA keep their
       seats exactly. Bind time only — a held station never yields. BOTH
       seats take it: the first cut (strict only) moved nothing — the bench's
       crossing log (?debug chipStats.xLog) put 36 of 38 episodes on a LOOSE
       seat (at 8 chips the strict pool often runs dry and the fallback,
       subject included, tested no other chip), 21 of them born within
       0.6 s of a bind. A slot with no seat idles for the station; a leader
       under a word is not worth naming one more shard. */
    const CHIP_X_PAD = 20;
    const leaderCrosses = (probeSlot, ax, ay, x, y, w, h) => {
      const me = { x, y, w, h };
      return labelSlots.some(
        (s) => s !== probeSlot && s.target && s.box && (segHitsBox(ax, ay, x, y, s.box, CHIP_X_PAD) || segHitsBox(s.box.ax, s.box.ay, s.box.x, s.box.y, me, CHIP_X_PAD))
      );
    };
    const chipFits = (cand, view, probeSlot, strict, keepGrow = 0, exact = !strict, from = 1, w0 = 0) => {
      lblWorld.copy(cand.pos);
      globeGroup.localToWorld(lblWorld);
      const w = w0 || chipW(measureChars(probeSlot, [...termFor(cand)]));
      const h = Math.max(chipH(), 8);
      for (let sign = from; sign >= -1; sign -= 2) {
        if (!chipSeat(lblWorld, view, seatOut, sign)) return 0;
        if (!chipInFrame(view, lblChip.x, lblChip.y, w, h, CHIP_EDGE_M + (strict ? CHIP_EDGE_SLACK : 0), keepGrow)) continue;
        if (stage === 'stage-01' && leaderCrosses(probeSlot, lblA.x, lblA.y, lblChip.x, lblChip.y, w, h)) continue; // 10-09 (w9b, 6e): strict AND loose
        if (strict) {
          if (labelSlots.some((s) => s.target && s.box && boxesHit(lblChip.x, lblChip.y, w, h, s.box))) continue;
          if (seatBehindShard(view, lblChip.x, lblChip.y, w, h, lblA.depth - labelLift())) continue;
        }
        if (exact && exactCover(view, lblChip.x, lblChip.y, w, lblA.depth - labelLift()) > CHIP_COVER_MAX) continue; // the side flip still gets its try
        cand.sign = sign;
        return sign;
      }
      return 0;
    };
    /* 10-08 (w8b, s1-cover-follow-through): ?chipcover — THE S1 TOUR CHIPS'
       cover rule, one switch. The Thread words, spec, page and CTA chips keep
       their own (chipFits' other callers never read it).
       · off  — pre-w8 seating exactly (w8/pre's pickTarget): the strict
         seat's screen circle only; the loose fallback and the subject's last
         resort take no cover test at all.
       · bind — w8 as shipped: the exact cover on the loose seats, at the bind.
       · hold — bind, plus the exact cover as an EXTRA refusal on the strict
         seat (seatBehindShard stays) and the PREDICTED hold (holdCover). */
    const chipCoverMode = () => (TUNING.chipCover === 'off' || TUNING.chipCover === 'hold' ? TUNING.chipCover : 'bind');
    /* ?debug: what an S1 pick costs (ms — the whole pickTarget, where the
       arms differ), in a ring the probe drains by count; and the STRICT seats
       a pick returned whose exact cover is over CHIP_COVER_MAX — the ones
       seatBehindShard's screen circle passed (the strict-path residue). Both
       through getStats({ peek }) for process-probe --buried. */
    const PICK_RING = 256;
    const pickCost = DEBUG ? { n: 0, ms: new Float32Array(PICK_RING) } : null;
    const strictSeen = DEBUG ? { n: 0, over: 0, last: [] } : null;
    let pickPath = null; // the seat the last pick returned: 'strict' | 'loose'
    const noteStrict = (cand, slot) => {
      const view = labelView();
      lblWorld.copy(cand.pos);
      globeGroup.localToWorld(lblWorld);
      if (!chipSeat(lblWorld, view, seatOut, cand.sign)) return;
      const term = termFor(cand);
      const cover = exactCover(view, lblChip.x, lblChip.y, chipW(measureChars(slot, [...term])), lblA.depth - labelLift());
      strictSeen.n += 1;
      if (cover <= CHIP_COVER_MAX) return;
      strictSeen.over += 1;
      strictSeen.last.push({ id: cand.panel ? panels.indexOf(cand.panel) : 'decoy', term, cover: +cover.toFixed(2), mode: chipCoverMode(), t: +(performance.now() / 1000).toFixed(2) });
      if (strictSeen.last.length > 16) strictSeen.last.shift();
    };
    /* 10-08 (w8b, s1-cover-follow-through (d)): THE PREDICTED HOLD
       (?chipcover hold). A chip that binds clear can still be buried by its
       station's own drift, and the held-station rule (Nathan 09-10: no
       drift-time yields — they read as flicker) then keeps it under the
       nearer shard for the rest of the shot (w8 confirm2: the subject
       FAN_CULTURE, 4.6s). S1's drift is deterministic, so the bind looks
       ahead — pageHolds' way (pose, test, restore) with S1's extra moving
       parts. A look poses the world at +τ from its CURRENT state:
       · the cloud's yaw at the drag engine's velocity (the ambient
         AUTO_ROTATE_SPEED — a live drag or flick skips the look-ahead; the
         bind-time exact test still stands);
       · the camera solved from both stations live and blended on the TOUR
         clock (tourTl's time + τ through the glide's turnEase, then held) —
         it TRACKS the subject, so every look has its own lens;
       · each shard's linear self-rotation and the decoys' spin, as the tick
         turns them (rotations about one axis add: one angle per look).
       Looks every HOLD_STEP_S across the station's REMAINING hold (tourTl's
       time left, ≤ HOLD_STEPS_MAX looks), cheapest first: the group's yaw
       and the lens (the group's own matrix only); the seat — behind the
       lens, stranded or into a keep box = the chip leaves there anyway, the
       walk ends; the prefilter (holdFlag: each shard and decoy bounded by a
       sphere about its own origin, so its spin needs no pose — which could
       reach the chip's sample row nearer than the chip at all?); then ONLY
       the flagged are spun to +τ and raycast, exactCover's seven rays and
       its rule (a no from the prefilter is exactCover's no). A seat covered
       (> CHIP_COVER_MAX) on more than HOLD_COVER_SHARE of its looks is
       refused (10-08 (w8b fix, rc4): allow = ⌊n × 0.15⌋, so ONE covered
       look rides only on a walk of 7–8 looks — more than 2.4s of the
       station left; with ≤ 6 looks, every glance's late rebind, any covered
       look refuses the seat). 10-08 (w8b fix2, c1-m1): that one look can be
       the FIRST (τ = left / n, 0.35–0.8s — the chip's first read), so hold's
       bind-time burials are ≈ 0, not 0: the confirm's 60s smoke bound the
       subject CALL_NOTES 0.07 visible at its first measure (most likely the
       never-buried fallback's tolerated look; 0 in the 27 pooled runs). If
       Nathan picks hold: refuse a covered first look outright, uncounted
       toward the share. A shard's quaternion is SAVED by
       copy the first time a look spins it and RESTORED by copy, its
       matrixWorld rebuilt after the group's (the decoys are spun into
       scratch matrices, never into their own state); the camera position
       copied back; the camera's matrices are never touched (the label path
       reads camera.position). Scratch grown once — no allocation per look. */
    const HOLD_STEP_S = 0.4;
    const HOLD_STEPS_MAX = 8; // a 4.5s hold looks every ~0.56s — a pass shorter than a step is a brief one anyway (but a covered LOOK rides only at 7–8 looks: see HOLD_COVER_SHARE above)
    const HOLD_COVER_SHARE = 0.15;
    const HOLD_LOOKS = 16; // looks a pick may run in all (two look-aheads), the subject's first — the phone's cost ceiling (p95 ≤ 4ms at 4× CPU)
    /* 10-08 (w8b iteration 1): the SUBJECT's fallback. The first pooled
       hold arm (d×5, m×3) left the station's subject unnamed at its arrival
       on 4.0/27 holds desktop and 2.7/27 phone (off: 2.0 / 1.0) — the look
       refuses at CHIP_COVER_MAX (3 of the 7 samples), well short of a
       burial (the probe's < 0.2 of the box visible ≈ 5 of 7). A subject
       with no seat that holds now takes one that is never BURIED: the same
       walk, a second count — the looks over HOLD_BURY_COVER (5 of 7 and up)
       on no more than the brief share — at the bind still exact-clean.
       Strict before loose, as ever; no look added (the walk only ends on
       the second count instead of the first). The rest of the pool keeps
       the strict rule — it has other shards to offer. */
    const HOLD_BURY_COVER = 0.6;
    const holdQ = panels.map(() => new THREE.Quaternion()); // a spun shard's own quaternion, as it was
    const holdTouched = new Uint8Array(panels.length);
    let holdAnyTouched = false;
    const holdRot = new THREE.Euler();
    const holdCam = new THREE.Vector3();
    const holdCamA = new THREE.Vector3();
    const holdCamB = new THREE.Vector3();
    const holdSpin = new THREE.Quaternion();
    const holdDQt = new THREE.Quaternion();
    const holdPt = new THREE.Vector3();
    const holdScale = new THREE.Vector3();
    const holdParent = new THREE.Matrix4(); // the decoy pool's world matrix at the look
    const holdLocal = new THREE.Matrix4();
    const holdObjs = new Int16Array(panels.length); // flagged shards (indices, holdObjN of them) / decoys / the decoys' world matrices at the look
    const holdDecs = new Int16Array(DECOY_COUNT);
    let holdObjN = 0;
    let holdDecN = 0;
    const holdDM = Array.from({ length: DECOY_COUNT }, () => new THREE.Matrix4());
    const holdDecoy = new THREE.Mesh(decoyGeometry, decoyMaterial); // one decoy, as InstancedMesh.raycast tests each
    holdDecoy.matrixAutoUpdate = false;
    // each shard's / a decoy's reach from its own origin, whatever its spin:
    // the baked geometry's bounding sphere, off-centre or not
    const holdReach = panels.map((p) => p.geometry.boundingSphere.center.length() + p.geometry.boundingSphere.radius);
    const decoyReach = (decoyGeometry.boundingSphere?.center.length() ?? 0) + decoyRadius;
    const holdBegin = () => {
      holdRot.copy(globeGroup.rotation);
      holdCam.copy(camera.position);
    };
    // the spun shards' own quaternions back (their matrixWorld: the caller's, after the group's)
    const holdRestoreShards = (rebuild = true) => {
      if (!holdAnyTouched) return;
      for (let i = 0; i < panels.length; i++) {
        if (!holdTouched[i]) continue;
        panels[i].mesh.quaternion.copy(holdQ[i]);
        if (rebuild) panels[i].mesh.updateMatrixWorld(); // after the group's: the raycast and the renderer read it
        holdTouched[i] = 0;
      }
      holdAnyTouched = false;
    };
    // every walk ends here, early or not (holdCover, checkHold); `all` — ?debug's reference rebuilt every matrix
    const holdRestore = (all = false) => {
      globeGroup.rotation.copy(holdRot);
      camera.position.copy(holdCam);
      globeGroup.updateWorldMatrix(false, false);
      holdRestoreShards(!all);
      if (all) globeGroup.updateMatrixWorld();
    };
    // the group's yaw and the lens at +τ (the children's matrices untouched)
    const holdPose = (tau, t0, yawRate) => {
      globeGroup.rotation.set(holdRot.x, holdRot.y + yawRate * tau, holdRot.z);
      globeGroup.updateWorldMatrix(false, false);
      if (tourActive) {
        const at = t0 + tau;
        const blend = at < tourLegTravel ? turnEase(Math.max(at / tourLegTravel, 0)) : 1;
        stationCam(tourFrom, holdCamA);
        stationCam(tourTo, holdCamB);
        camera.position.lerpVectors(holdCamA, holdCamB, blend);
      }
    };
    /* The prefilter. A sphere's screen extent, bounded generously (its
       radius at its NEAREST depth, widened by the off-axis parallax, + 2px),
       against the chip's sample row; and nearer than the chip at all (the
       raycast's far). Same objects as exactCover (the visible shards, the
       decoy pool's live instances). */
    const sphereOnRow = (view, c, r, x, y, w, depth) => {
      const dz = camera.position.z - c.z;
      if (dz - r >= depth) return false;
      const near = dz - r;
      if (near <= 0.1) return true;
      const ox = c.x - camera.position.x;
      const oy = c.y - camera.position.y;
      const cx = view.vw / 2 + (ox / (dz * view.tanH)) * (view.vw / 2);
      const cy = view.vh / 2 - (oy / (dz * view.tanV)) * (view.vh / 2);
      const R = ((r * view.vh) / (2 * near * view.tanV)) * (1 + (Math.abs(ox) + Math.abs(oy)) / dz) + 2;
      return Math.abs(cy - y) < R && cx > x - w / 2 - R && cx < x + w / 2 + R;
    };
    const holdFlag = (view, x, y, w, depth) => {
      holdObjN = 0;
      holdDecN = 0;
      const G = globeGroup.matrixWorld;
      const g = Math.max(globeGroup.scale.x, globeGroup.scale.y, globeGroup.scale.z);
      for (let i = 0; i < panels.length; i++) {
        const m = panels[i].mesh;
        if (!m.visible || m.scale.x <= 0.05) continue;
        holdPt.copy(m.position).applyMatrix4(G);
        if (sphereOnRow(view, holdPt, holdReach[i] * Math.max(m.scale.x, m.scale.y, m.scale.z) * g, x, y, w, depth)) holdObjs[holdObjN++] = i;
      }
      if (decoyMesh.visible) {
        for (let i = 0; i < Math.min(decoyMesh.count, decoys.length, DECOY_COUNT); i++) {
          const d = decoys[i];
          holdPt.copy(d.pos).applyMatrix4(G);
          if (sphereOnRow(view, holdPt, decoyReach * Math.max(d.scale * d.s, 0.0001) * g, x, y, w, depth)) holdDecs[holdDecN++] = i;
        }
      }
      return holdObjN + holdDecN;
    };
    /* exactCover over the flagged only, the world at +τ (0 = as it stands):
       a flagged shard spun (its quaternion saved first) and its own
       matrixWorld rebuilt under the posed group; a flagged decoy's matrix
       composed as composeDecoys would (τ 0: read back as drawn). Seven rays, first hit
       stops a ray — exactCover's rule. */
    const holdRay = (view, x, y, w, depth, tau) => {
      const k = beltDrifting && tau > 0 ? TUNING.drift * tau : 0;
      // τ 0: the shards' matrices as they stand (the pick refreshed them) — nothing touched, nothing to restore
      for (let j = 0; j < holdObjN && tau > 0; j++) {
        const i = holdObjs[j];
        const p = panels[i];
        if (!holdTouched[i]) {
          holdQ[i].copy(p.mesh.quaternion);
          holdTouched[i] = 1;
          holdAnyTouched = true;
        }
        if (k > 0 && p.driftFactor > 0) p.mesh.quaternion.copy(holdQ[i]).multiply(holdSpin.setFromAxisAngle(p.drift.axis, p.drift.speedRatio * k * p.driftFactor));
        else p.mesh.quaternion.copy(holdQ[i]);
        p.mesh.updateMatrixWorld();
      }
      if (holdDecN) {
        holdParent.multiplyMatrices(globeGroup.matrixWorld, decoyMesh.matrix);
        for (let j = 0; j < holdDecN; j++) {
          const d = decoys[holdDecs[j]];
          if (k > 0) {
            holdDQt.copy(d.quat).multiply(holdSpin.setFromAxisAngle(d.axis, d.speedRatio * k));
            holdLocal.compose(d.pos, holdDQt, holdScale.setScalar(Math.max(d.scale * d.s, 0.0001)));
          } else decoyMesh.getMatrixAt(holdDecs[j], holdLocal);
          holdDM[j].multiplyMatrices(holdParent, holdLocal);
        }
      }
      let hit = 0;
      for (let s = 0; s < CHIP_COVER_SAMPLES; s++) {
        const sx = x - w / 2 + (w * (s + 0.5)) / CHIP_COVER_SAMPLES;
        coverDir.set(((sx / view.vw) * 2 - 1) * view.tanH, (1 - (y / view.vh) * 2) * view.tanV, -1).normalize();
        coverRay.set(camera.position, coverDir);
        coverRay.far = Math.max(depth, 0.05) / -coverDir.z;
        coverHits.length = 0;
        for (let j = 0; j < holdObjN && !coverHits.length; j++) panels[holdObjs[j]].mesh.raycast(coverRay, coverHits);
        for (let j = 0; j < holdDecN && !coverHits.length; j++) {
          holdDecoy.matrixWorld.copy(holdDM[j]);
          holdDecoy.raycast(coverRay, coverHits);
        }
        if (coverHits.length) hit += 1;
      }
      return hit / CHIP_COVER_SAMPLES;
    };
    // the cover at a seat: the prefilter, then the flagged raycast (0 when nothing could reach)
    const holdCoverAt = (view, x, y, w, depth, tau) => (holdFlag(view, x, y, w, depth) ? holdRay(view, x, y, w, depth, tau) : 0);
    /* One seat as the chip would sit at +τ (the group and lens posed):
       updateLabels' frame clamp, then the cover. Fills lblChip; null = the
       chip would have LEFT by then — behind the lens, stranded
       (updateLabels' rule: the anchor off the frame, the clamp shoving the
       box over half a leader or back over its own dot), or into a keep box
       — and a chip that leaves does not come back. `w`/`h` the chip's box
       (chipW, chipH). */
    const holdSeat = { x: 0, y: 0, cover: 0, depth: 0 };
    const seatAt = (pos, sign, view, w, h, tau) => {
      lblWorld.copy(pos).applyMatrix4(globeGroup.matrixWorld); // posed by holdPose (τ 0: the pick's refresh)
      if (!chipSeat(lblWorld, view, seatOut, sign)) return null;
      const m = CHIP_EDGE_M;
      const seatX = lblChip.x;
      const seatY = lblChip.y;
      lblChip.x = Math.min(Math.max(lblChip.x, m + w / 2), view.vw - m - w / 2);
      lblChip.y = Math.min(Math.max(lblChip.y, m + h / 2), view.vh - m - h / 2);
      const clamped = lblChip.x !== seatX || lblChip.y !== seatY;
      if (
        lblA.x < m || lblA.x > view.vw - m || lblA.y < m || lblA.y > view.vh - m ||
        Math.hypot(lblChip.x - seatX, lblChip.y - seatY) > chipLead() * 0.5 ||
        (clamped && Math.abs(lblChip.x - lblA.x) < w / 2 + LABEL_DOT_PX * 2 && Math.abs(lblChip.y - lblA.y) < h / 2 + LABEL_DOT_PX * 2) ||
        hitsKeep(view.keep, lblChip.x, lblChip.y, w, h)
      )
        return null;
      holdSeat.x = lblChip.x;
      holdSeat.y = lblChip.y;
      holdSeat.depth = lblA.depth - labelLift();
      holdSeat.cover = holdCoverAt(view, holdSeat.x, holdSeat.y, w, holdSeat.depth, tau);
      return holdSeat;
    };
    // the drift ahead is the tour's own only while nothing else moves the world
    const holdLeft = () =>
      tourActive && tourTl && !flightActive && !(drag && (drag.dragging || gsap.isTweening(drag.vel))) ? tourTl.duration() - tourTl.time() : 0;
    let holdBudget = 0; // looks a pick may still run (pickHold sets it)
    let holdOut = false; // the budget could not cover a whole look-ahead: the pick stops walking
    /* A seat the look-ahead refused stays refused for HOLD_NO_S of the tour
       clock — the arrival's picks (one per slot, ~0.3s apart) would
       otherwise walk the same doomed seats again; a later rebind, with less
       of the hold left to cover, tries it afresh. Per side, cleared when the
       tour moves on.
       10-08 (w8b fix, rc2): keyed on the tour's CLOCK (tourTl), not its leg
       count — the memo's times are tourTl's, and a restart (S1 → S2 → S1, a
       bench edit's stopTour + startTour) lands on leg 0 again with a fresh
       clock from 0: a memo from the old wide (t ≈ 3.5) read t0 − t < 0 and
       refused its seats for most of the returning wide. Every leg builds a
       new tourTl too (tourLeg), and holdWide's re-arm clears before the
       wide's first pick. */
    const HOLD_NO_S = 1;
    const holdNoOut = new Map();
    const holdNoIn = new Map();
    let holdNoTl = null;
    const holdRefused = DEBUG ? { cand: null, sign: 1 } : null; // ?debug: the last seat the look-ahead refused (checkHold validates it too)
    /* 2 = the seat holds; 1 = (`soft`, the subject's walk) it is never
       buried; 0 = refused (or no looks left to tell — the pick moves on).
       The memo keeps a refused seat's grade (a leg has one subject, so a
       seat is walked soft or not all leg long). */
    const holdCover = (cand, view, w, h, soft = false) => {
      const left = holdLeft();
      if (left < HOLD_STEP_S) return 2; // nothing ahead to hold (or a live drag: the bind-time test stands)
      if (holdNoTl !== tourTl) {
        holdNoOut.clear();
        holdNoIn.clear();
        holdNoTl = tourTl;
      }
      const t0 = tourTl.time();
      const no = cand.sign === -1 ? holdNoIn : holdNoOut;
      const memo = no.get(cand.pos);
      if (memo && t0 - memo.t < HOLD_NO_S) return soft ? memo.grade : 0;
      const n = Math.min(Math.ceil(left / HOLD_STEP_S), HOLD_STEPS_MAX);
      if (holdBudget < n) {
        holdOut = true;
        return 0;
      }
      const allow = Math.floor(n * HOLD_COVER_SHARE);
      const yawRate = drag ? drag.vel.x : AUTO_ROTATE_SPEED;
      let covered = 0;
      let buried = 0;
      holdBegin();
      for (let k = 1; k <= n && (soft ? buried : covered) <= allow; k++) {
        const tau = (left * k) / n;
        holdBudget -= 1;
        holdPose(tau, t0, yawRate);
        const seat = seatAt(cand.pos, cand.sign, view, w, h, tau);
        if (holdAudit) {
          holdAudit.looks += 1;
          if (seat && holdObjN + holdDecN) holdAudit.rayLooks += 1;
        }
        if (!seat) break; // the chip leaves here anyway
        if (seat.cover > CHIP_COVER_MAX) covered += 1;
        if (seat.cover > HOLD_BURY_COVER) buried += 1;
      }
      holdRestore();
      if (holdAudit) holdAudit.aheads += 1;
      if (covered <= allow) return 2;
      const grade = soft && buried <= allow ? 1 : 0;
      no.set(cand.pos, { t: t0, grade });
      if (holdRefused) {
        holdRefused.cand = cand;
        holdRefused.sign = cand.sign;
      }
      return grade;
    };
    /* A seat that holds: chipFits' seat (strict: the screen circle and the
       chips; either: frame + keep-out), the EXACT cover at the bind on
       either path — the strict one too, (c): seatBehindShard stays, and the
       side flip gets its try — then the predicted hold on the side that
       passed, the flip again if the outward side fails either. Returns
       'held' | 'soft' (`soft`, the subject's walk: no side holds, one is
       never buried — cand.sign left on it) | 'fits' (the seat passed
       chipFits but not the cover or the hold) | '' (no seat). */
    const holdW = new Map(); // a pick's chip widths by word (measureChars sets the font and measures every glyph)
    const seatHolds = (cand, view, slot, strict, soft = false) => {
      const term = termFor(cand);
      let w = holdW.get(term);
      if (w === undefined) {
        w = chipW(measureChars(slot, term));
        holdW.set(term, w);
      }
      const h = chipH();
      let fits = '';
      let softSign = 0;
      for (let from = 1; from >= -1; from -= 2) {
        const sign = chipFits(cand, view, slot, strict, 0, false, from, w);
        if (!sign) break;
        fits = 'fits';
        from = sign;
        lblWorld.copy(cand.pos);
        globeGroup.localToWorld(lblWorld);
        chipSeat(lblWorld, view, seatOut, sign);
        const depth = lblA.depth - labelLift();
        if (holdCoverAt(view, lblChip.x, lblChip.y, w, depth, 0) > CHIP_COVER_MAX) continue;
        const grade = holdCover(cand, view, w, h, soft && !softSign);
        if (grade === 2) return 'held';
        if (grade === 1) softSign = sign;
      }
      if (!softSign) return fits;
      cand.sign = softSign;
      return 'soft';
    };
    /* ?chipcover hold's pick — LAZY: the candidates walked in random order
       and tested one at a time, cheapest first (the strict seat, the exact
       cover, the look-ahead), stopping at the first that holds — not the
       whole open pool's strict seat first (off / bind's `clear`), which a
       phone at 4× CPU could not afford on top of the look-ahead. The same
       rules as bind's: the subject first (its readable seat, else its loose
       one with the exact cover); then the rest, strict seats only while any
       exists (`clear` non-empty — then a pick that finds none that holds
       binds nothing: the slot stays empty this station rather than seat a
       chip the drift will bury), loose ones (exact + hold) only when none
       does. The slot's last shard is tried last, not dropped (bind's
       no-repeat). A subject whose seats fail the hold takes one that is
       never buried (HOLD_BURY_COVER — iteration 1), strict before loose;
       with none it goes unnamed THIS pick — a rebind, with less of the hold
       left to cover, may seat it. */
    const pickHold = (slot, view, open, taken) => {
      const subject = tourSubjectPanel();
      holdBudget = HOLD_LOOKS; // the subject draws first
      holdOut = false;
      holdW.clear();
      if (subject && !taken.includes(subject.mesh.position)) {
        const own = open.find((c) => c.panel === subject);
        if (own) {
          const strict = seatHolds(own, view, slot, true, true);
          if (strict === 'held') {
            pickPath = 'strict';
            if (holdAudit) holdAudit.subj.held += 1;
            return own;
          }
          const strictSign = own.sign;
          const loose = holdOut ? '' : seatHolds(own, view, slot, false, strict !== 'soft');
          if (loose === 'held' || strict === 'soft' || loose === 'soft') {
            pickPath = loose === 'held' || strict !== 'soft' ? 'loose' : 'strict';
            if (pickPath === 'strict') own.sign = strictSign;
            if (holdAudit) holdAudit.subj[loose === 'held' ? 'held' : 'soft'] += 1;
            return own;
          }
          if (holdAudit) holdAudit.subj[holdOut ? 'out' : strict || loose ? 'refused' : 'noSeat'] += 1;
        } else if (holdAudit) holdAudit.subj.closed += 1;
      }
      const rest = open.filter((c) => c.panel !== subject);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const last = rest.findIndex((c) => c.pos === slot.last);
      if (last >= 0) rest.push(rest.splice(last, 1)[0]);
      let anyStrict = false;
      for (let i = 0; i < rest.length && !holdOut; i++) {
        const r = seatHolds(rest[i], view, slot, true);
        if (r === 'held') {
          pickPath = 'strict';
          return rest[i];
        }
        if (r) anyStrict = true;
      }
      if (anyStrict || holdOut) return null; // a strict seat exists (bind's `clear`): the loose ones are not tried
      for (let i = 0; i < rest.length && !holdOut; i++) {
        if (seatHolds(rest[i], view, slot, false) === 'held') {
          pickPath = 'loose';
          return rest[i];
        }
      }
      return null;
    };
    /* ?debug: the predictor against what happened — at the bind, the
       predicted centre and cover at +1s and +2s (the hold's own lazy pose),
       beside exactCover on the WHOLE world posed (every shard and decoy
       spun, every matrix rebuilt — the reference the prefilter and the
       flagged raycast must equal: `refMiss`); at those times, the live
       seat's (the same anchor and side, exactCover off the live world,
       whether the chip is still bound or not — the drift does not care).
       For the bound chip and the last refused seat. The last 64 through
       getStats({ peek }).holdCheck. */
    const HOLD_CHECK_AT = [1, 2];
    const holdCheck = DEBUG ? [] : null;
    let holdSeq = 0; // the entries' ids (the probe merges its reads by them)
    /* ?debug: the RESTORE, audited — a signature of everything a look
       moves (the camera, the group's and every shard's matrixWorld and
       quaternion, the decoys' quaternions and instance matrices) before and
       after each hold pick and each check; `bad` counts any difference (a
       leak would twitch the frame or feed a later raycast a stale world). */
    // `subj`: what each hold pick did with an open subject (iteration 1); `refMissAt`: the last misses, {tau, cover, ref}
    const holdAudit = DEBUG ? { n: 0, bad: 0, refMiss: 0, refLooks: 0, aheads: 0, looks: 0, rayLooks: 0, subj: { held: 0, soft: 0, refused: 0, out: 0, noSeat: 0, closed: 0 }, refMissAt: [] } : null;
    const worldSig = () => {
      let sig = camera.position.x * 3 + camera.position.y * 5 + camera.position.z * 7;
      const g = globeGroup.matrixWorld.elements;
      for (let j = 0; j < 16; j++) sig += g[j] * (j + 1);
      for (let i = 0; i < panels.length; i++) {
        const m = panels[i].mesh;
        const e = m.matrixWorld.elements;
        for (let j = 0; j < 16; j++) sig += e[j] * (i + j + 1);
        sig += (m.quaternion.x + 2 * m.quaternion.y + 3 * m.quaternion.z + 4 * m.quaternion.w) * (i + 1);
      }
      for (let i = 0; i < decoys.length; i++) {
        const q = decoys[i].quat;
        sig += (q.x + 2 * q.y + 3 * q.z + 4 * q.w) * (i + 1);
      }
      const a = decoyMesh.instanceMatrix.array;
      for (let j = 0; j < a.length; j++) sig += a[j] * ((j % 97) + 1);
      return sig;
    };
    // ?debug only: the whole world at +τ — every shard and decoy spun as the tick would, every matrix rebuilt
    const refQ = DEBUG ? panels.map(() => new THREE.Quaternion()) : null;
    const refDQ = DEBUG ? decoys.map(() => new THREE.Quaternion()) : null;
    const refIM = DEBUG ? new Float32Array(decoyMesh.instanceMatrix.array.length) : null;
    const refCover = (view, x, y, w, depth, tau) => {
      panels.forEach((p, i) => refQ[i].copy(p.mesh.quaternion));
      decoys.forEach((d, i) => refDQ[i].copy(d.quat));
      refIM.set(decoyMesh.instanceMatrix.array);
      const hadBS = decoyMesh.boundingSphere ? decoyMesh.boundingSphere.clone() : null;
      const k = beltDrifting ? TUNING.drift * tau : 0;
      panels.forEach((p) => p.driftFactor > 0 && k > 0 && p.mesh.rotateOnAxis(p.drift.axis, p.drift.speedRatio * k * p.driftFactor));
      decoys.forEach((d) => k > 0 && d.quat.multiply(holdSpin.setFromAxisAngle(d.axis, d.speedRatio * k)));
      if (decoyMesh.visible && k > 0) composeDecoys();
      globeGroup.updateMatrixWorld();
      const cover = exactCover(view, x, y, w, depth);
      panels.forEach((p, i) => p.mesh.quaternion.copy(refQ[i]));
      decoys.forEach((d, i) => d.quat.copy(refDQ[i]));
      decoyMesh.instanceMatrix.array.set(refIM);
      decoyMesh.instanceMatrix.needsUpdate = true;
      if (hadBS) decoyMesh.boundingSphere.copy(hadBS);
      globeGroup.updateMatrixWorld();
      return cover;
    };
    const checkHold = (cand, sign, slot, refused) => {
      const left = holdLeft();
      if (left < HOLD_CHECK_AT[0] + 0.1) return;
      refreshLabelMatrices();
      const view = labelView();
      const term = termFor(cand);
      const w = chipW(measureChars(slot, term));
      const h = chipH();
      const t0 = tourTl.time();
      const yawRate = drag ? drag.vel.x : AUTO_ROTATE_SPEED;
      const sig = worldSig();
      const entry = { seq: holdSeq++, term, id: cand.panel ? panels.indexOf(cand.panel) : 'decoy', subject: cand.panel != null && cand.panel === tourSubjectPanel(), refused, left: +left.toFixed(2), pred: [], act: [] };
      let refAll = false;
      holdBegin();
      for (const tau of HOLD_CHECK_AT) {
        if (tau > left - 0.1) break;
        holdPose(tau, t0, yawRate);
        const seat = seatAt(cand.pos, sign, view, w, h, tau);
        if (!seat) {
          entry.pred.push({ tau, gone: true });
          continue;
        }
        const pred = { tau, x: +seat.x.toFixed(1), y: +seat.y.toFixed(1), cover: +seat.cover.toFixed(3) };
        const { x: sx, y: sy, depth: sd, cover: sc } = seat; // unrounded: the reference casts the same rays
        holdRestoreShards(); // the reference spins from the shards as they stand
        refAll = true;
        const ref = refCover(view, sx, sy, w, sd, tau);
        holdAudit.refLooks += 1;
        if (Math.abs(ref - sc) > 1e-9) {
          holdAudit.refMiss += 1;
          holdAudit.refMissAt.push({ tau, cover: +sc.toFixed(3), ref: +ref.toFixed(3), x: pred.x, y: pred.y, w: +w.toFixed(1) });
          if (holdAudit.refMissAt.length > 8) holdAudit.refMissAt.shift();
        }
        pred.ref = +ref.toFixed(3);
        entry.pred.push(pred);
      }
      holdRestore(refAll);
      holdAudit.n += 1;
      if (worldSig() !== sig) holdAudit.bad += 1;
      holdCheck.push(entry);
      if (holdCheck.length > 64) holdCheck.shift();
      const pos = cand.pos;
      entry.pred.forEach(({ tau }) =>
        gsap.delayedCall(tau, () => {
          if (disposed) return;
          refreshLabelMatrices();
          const v = labelView();
          const seat = seatAt(pos, sign, v, w, h, 0); // τ 0: the live world, nothing posed
          entry.act.push(seat ? { tau, x: +seat.x.toFixed(1), y: +seat.y.toFixed(1), cover: +exactCover(v, seat.x, seat.y, w, seat.depth).toFixed(3), bound: slot.target === pos } : { tau, gone: true });
        })
      );
    };
    const pickSeat = (slot) => {
      refreshLabelMatrices();
      const view = labelView();
      const mode = chipCoverMode();
      const taken = labelSlots.map((s) => s.target).filter(Boolean);
      const held = heldTerms();
      const open = labelPool().filter(
        (c) => !taken.includes(c.pos) && !held.has(termOf.get(c.pos)) && labelVisible(c)
      );
      if (mode === 'hold') return pickHold(slot, view, open, taken); // 10-08 (w8b): ?chipcover hold walks lazily (pickHold)
      // Prefer somewhere the chip can actually be read; fall back to the
      // merely-visible set rather than idling a slot — 10-07 (w3): never
      // onto type (the fallback is filtered through the keep boxes too).
      const clear = open.filter((c) => chipFits(c, view, slot, true));
      // 10-08 (w8): the loose pool is judged cheaply (frame + keep-out); the
      // EXACT cover (chipFits' default on a loose seat) runs only on the
      // candidates actually tried below — usually the one chosen — so a
      // close-up's full fallback never raycasts the whole cloud.
      const pool = clear.length ? clear : open.filter((c) => chipFits(c, view, slot, false, 0, false));
      if (!pool.length) return null;
      pickPath = clear.length ? 'strict' : 'loose';
      // The tour's SUBJECT gets a chip first when it hasn't got one: the
      // camera framed it deliberately, so it is the shard the viewer is being
      // asked to look at (see the tour, below).
      const subject = tourSubjectPanel();
      if (subject && !taken.includes(subject.mesh.position)) {
        // A readable seat first; failing that, any seat off the type — the
        // drift rules re-slot it if it really cannot be read, but the framed
        // shard going unnamed is the worse failure. 10-07 (w3): text over
        // text is worse still, so a subject whose only seat lands on copy
        // goes unnamed.
        // 10-08 (w8): a readable seat (clear), else the loose seat WITH the
        // exact cover — a subject buried behind a nearer shard goes unnamed
        // rather than wear a bare leader for its whole station.
        // 10-08 (w8b): ?chipcover off — the pre-w8 rule (the pool's seat,
        // else any loose seat, neither cover-tested).
        const hit =
          mode === 'off'
            ? pool.find((c) => c.panel === subject) ?? open.find((c) => c.panel === subject && chipFits(c, view, slot, false, 0, false))
            : clear.find((c) => c.panel === subject) ?? open.find((c) => c.panel === subject && chipFits(c, view, slot, false));
        if (hit) {
          pickPath = clear.includes(hit) ? 'strict' : 'loose';
          return hit;
        }
      }
      // No-repeat: prefer any candidate that isn't the one this slot just
      // released; fall back to the full set only if that's all there is.
      const fresh = pool.filter((c) => c.pos !== slot.last);
      const choose = fresh.length ? fresh : pool;
      // (off: the loose pool is drawn at random too, untested — pre-w8)
      if (clear.length || mode === 'off') return choose[Math.floor(Math.random() * choose.length)];
      // 10-08 (w8): the loose pool — in random order, the first whose seat
      // passes the exact cover (it re-picks the side: cand.sign).
      for (let i = choose.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choose[i], choose[j]] = [choose[j], choose[i]];
      }
      return choose.find((c) => chipFits(c, view, slot, false)) ?? null;
    };
    const pickTarget = (slot) => {
      if (!pickCost) return pickSeat(slot);
      // ?chipcover hold: the restore audit's 'before' (outside the clock)
      const audit = chipCoverMode() === 'hold';
      if (audit) refreshLabelMatrices();
      const sig = audit ? worldSig() : 0;
      const t0 = performance.now();
      const cand = pickSeat(slot);
      pickCost.ms[pickCost.n % PICK_RING] = performance.now() - t0;
      pickCost.n += 1;
      if (audit) {
        holdAudit.n += 1;
        if (worldSig() !== sig) holdAudit.bad += 1;
      }
      if (cand && pickPath === 'strict') noteStrict(cand, slot); // after the clock: the ?debug raycast is not the pick's cost
      if (chipCoverMode() === 'hold') {
        // …nor the predictor's checks: the bound seat, and the last one refused
        if (cand) checkHold(cand, cand.sign, slot, false);
        if (holdRefused.cand && holdRefused.cand !== cand) checkHold(holdRefused.cand, holdRefused.sign, slot, true);
        holdRefused.cand = null;
      }
      return cand;
    };

    /* 10-08 (w8): THE HELD FAMILIES, one place — a chip that is not S1's
       tour layer (a Thread word, an S3 spec chip, the CTA's first_contact,
       an S5 page chip): no ?labelhold auto-exit, the held rules in
       updateLabels, and chipsLive's liveness. It replaces three copies of
       the flag list (bindLabel, updateLabels ×2) that the fifth family
       would otherwise have grown into four. */
    const familyHeld = (slot) => slot.thread || slot.spec || slot.cta || slot.page;
    const bindLabel = (slot, cand) => {
      if (chipBench && tourActive && atStation && !familyHeld(slot)) {
        const leg = chipBench.legs[chipBench.legs.length - 1];
        leg?.binds.push(+((performance.now() - leg.at) / 1000).toFixed(3)); // 10-09 (w9b, ?debug)
      }
      if (chipBench) {
        slot.benchAt = performance.now(); // 10-09 (w9b, ?debug): the crossing log's ages
        slot.benchPath = pickPath;
      }
      slot.target = cand.pos;
      slot.panel = cand.panel;
      slot.decoy = cand.decoy ?? null;
      slot.fading = false;
      slot.retracting = false;
      slot.cutWait = null;
      // 10-07 (w5): a spec chip's word is the annotation (specOf, set by the
      // spec beat) — no LABEL_TERMS draw, no termOf entry.
      // 10-07 (w7): so is the CTA's first_contact (cand.term).
      // 10-08 (w8): and an S5 page chip's chapter word.
      let term = slot.spec || slot.cta || slot.page ? cand.term : termOf.get(cand.pos);
      if (chipBench && term && !familyHeld(slot)) chipBench.renames += 1; // 10-09 (w9b, ?debug)
      if (!term) {
        const next = termAt(0);
        termCursor += next.step;
        term = next.term;
        if (chipBench) {
          // 10-09 (w9b, ?debug): a first naming — did the bank wrap onto a word another shard wears?
          chipBench.first += 1;
          if ([...termOf.values()].includes(term)) {
            chipBench.wraps += 1;
            chipBench.wrapAt ??= performance.now();
          }
        }
        termOf.set(cand.pos, term);
      }
      slot.term = term;
      slot.cut?.kill();
      slot.tl?.kill();
      slot.chars = [...term];
      slot.shown = slot.chars.map(() => false);
      slot.strikes = 0;
      slot.textW = measureChars(slot, slot.chars);
      gsap.killTweensOf(slot, 'fillK,leadK');
      // 10-07 (w3): the shard's own colour (fillOf), dealt on its first
      // naming only; the ink is the higher-contrast of the two (chipInk).
      // 10-08 (w8): an S5 page chip wears its WORD's colour first (specFillOf
      // — the S3 chip's, which the ● reads too), never its seat's.
      let fill = slot.page ? specFillOf.get(term) ?? fillOf.get(cand.pos) : fillOf.get(cand.pos);
      if (fill === undefined && slot.spec) fill = specFillOf.get(term); // 10-07 (final review)
      if (fill === undefined && chipColors.length) {
        fill = chipColors[chipColorCursor++ % chipColors.length];
      }
      if (fill !== undefined && !fillOf.has(cand.pos)) fillOf.set(cand.pos, fill);
      if (fill !== undefined && (slot.spec || slot.page) && !specFillOf.has(term)) specFillOf.set(term, fill);
      // 10-07 (final review): EVERY chip is filled — an empty pool (no
      // featured project with a parseable projectColor) falls back to the
      // shards' black edge ink, so every chip takes the wipe in and the
      // retract out; the unfilled opacity-fade branches are gone.
      slot.fill = fill ?? STROKE_CSS;
      slot.ink = chipInk(slot.fill) ?? labelStyle.css;
      slot.fillK = 0;
      slot.leadK = 0;
      slot.fillFrom = 0;
      slot.sign = cand.sign === -1 ? -1 : 1; // the side the pick found room on
      // Seat the box NOW, not on the next painted frame: a sibling slot
      // picking in the same beat has to be able to see this one, and a chip
      // fading up from opacity 0 is skipped by updateLabels for a frame or two.
      slot.box = null;
      lblWorld.copy(slot.target);
      globeGroup.localToWorld(lblWorld);
      if (chipSeat(lblWorld, labelView(), seatOut, slot.sign)) {
        slot.box = {
          x: lblChip.x,
          y: lblChip.y,
          w: chipW(slot.textW),
          h: chipH(),
          depth: lblA.depth,
          // 10-09 (w9b fix R3): the leader's root too — a sibling picking in
          // the same beat tests this leader (leaderCrosses); without it the
          // segment is NaN, segHitsBox calls it a hit, every seat is refused
          ax: lblA.x,
          ay: lblA.y,
        };
        // The seat is radial: a chip right of its shard takes the leader on
        // its left side, so the fill wipes in from the left (and vice versa).
        slot.fillFrom = seatOut.ox < 0 ? 1 : 0;
      }
      slot.mats[1].color.copy(labelStyle.color);
      slot.mats[2].color.copy(labelStyle.color);
      // 10-07 (w7 fix): first_contact draws OVER the world. Its shard stands
      // off the sphere in front of everything, but a limb shard's INWARD seat
      // (a phone — pickContact) puts the chip over the face at that shard's
      // depth, behind the Core's near panels: the depth test buried it to a
      // few pink slivers in the seams. Every other chip keeps the occlusion
      // test — set on each bind, the slots are shared by all four families.
      slot.mats.forEach((m) => {
        m.depthTest = !slot.cta;
      });
      // 10-07 (w4): a Thread word's bead does not pulse — the claim stamp
      // already marks it, and the pulse's release would kill uPower tweens
      // (the pull's per-bead restore) from inside the show's own timeline.
      // 10-07 (w7): nor does the freed shard at the CTA — its pulse answers
      // the CTA's hover/focus (swm:process-cta-hover), not the naming.
      // 10-08 (w8): nor an S5 page chip's — the rhythm owns every panel's
      // uPower there, and pulseOn's killTweensOf would cut that shard's hits
      // out of the loop for good.
      if (!slot.thread && !slot.cta && !slot.page) pulseOn(slot.panel);
      drawChip(slot); // the empty box: the chip is at opacity 0 until the tl runs
      gsap.killTweensOf(slot.mats);
      slot.mats.forEach((m) => {
        m.opacity = 0;
      });
      // The house random-letter entrance, on the shared clock — one more
      // glyph painted per tick where a DOM chip would un-hide one more span.
      slot.cut = cutSchedule(slot.chars.length, {
        stepMs: TUNING.labelCharMs,
        onCut: (i) => {
          slot.shown[i] = true;
          drawChip(slot);
        },
      });
      // Quicker in, longer hold (Nathan): the chip's own reveal is a blink —
      // the letters carry the entrance — and the rest is the reading beat.
      // With the TOUR running the beat is the camera's (Nathan, 09-10): a
      // chip cuts in as the camera arrives at a station and holds for as
      // long as the camera holds that framing — it never fades out of a shot
      // that is still being held. The leg that leaves the station is what
      // fades it (see tourLeg). ?labelhold only times the tour-off path.
      slot.tl = gsap.timeline();
      // A project colour at the 0.85 hold would mix with the field and stop
      // being that colour: the filled chip sits at full strength, and its
      // entrance is the wipe, not a fade. Leader + dot keep the hold.
      // 10-07 (final review): SET to it, not faded up — the dot cuts on at
      // frame 0 and the leader DRAWS OUT from it (leadK) on the fill's clock;
      // a zero-length line paints nothing, so no ghost line leads the box.
      slot.tl
        .set(slot.mats[0], { opacity: 1 }, 0)
        .set([slot.mats[1], slot.mats[2]], { opacity: LABEL_HOLD_ALPHA }, 0)
        .to(slot, { fillK: 1, leadK: 1, duration: CHIP_WIPE_S, ease: 'power3.out', onUpdate: () => drawChip(slot) }, 0);
      // 10-07 (w4): a Thread word holds until the pull (leaveThreadWords).
      // 10-07 (w5): a spec chip until its shard turns away or S3 leaves.
      // 10-07 (w7): the CTA's first_contact until the CTA leaves.
      // 10-08 (w8): an S5 page chip until its page ends (pageEnd).
      if (!tourActive && !familyHeld(slot)) {
        const hold = Math.max(TUNING.labelHold, 0.4);
        const out = slot.cut.duration + hold;
        // 10-07 (w3, chip-exit): a chip leaves the way it came — the fill
        // retracts into its leader (the letters are clipped to it, so they go
        // with the box); an opacity fade smeared the colour through mud on the
        // field. 10-07 (final review): and the leader draws back to its root
        // on the same clock (leadK), the dot cutting off at the end — no fade.
        // (The entrance's tween ended long before `out`; no kill needed — and
        // a kill inside this tl's own call would take its later tweens.)
        const exit = CHIP_WIPE_S * EXIT_RATIO;
        slot.tl
          .to(slot, { fillK: 0, leadK: 0, duration: exit, ease: turnEase, onUpdate: () => drawChip(slot) }, out)
          .set([slot.mats[1], slot.mats[2]], { opacity: 0 })
          .call(() => releaseLabel(slot));
      }
    };

    const releaseLabel = (slot) => {
      slot.cut?.kill();
      slot.cut = null;
      // 10-07 (w7 fix): first_contact's chip never owns its shard's pulse —
      // the CTA's hover/focus does (onCtaHover; every way off the CTA kills
      // it). A re-seat at the rest (a resize strands the chip, a keep box
      // cuts it) must leave a held hover pulsing.
      if (!slot.cta) pulseOff(slot.panel);
      slot.last = slot.target;
      slot.term = '';
      slot.target = null;
      slot.panel = null;
      slot.decoy = null;
      slot.box = null;
      slot.fading = false;
      slot.retracting = false;
      slot.cutWait = null;
      slot.thread = false;
      slot.spec = false; // 10-07 (w5): the spec beat re-seats its word, not this path
      slot.cta = false; // 10-07 (w7): contactBeat re-seats first_contact, not this path
      slot.page = false; // 10-08 (w8): the next page turn seats its own word
      slot.group.visible = false;
      if (!labelsActive || disposed) return;
      // 10-07 (w3): the layer is leaving — nothing rebinds; the last chip
      // out switches the layer off.
      if (labelsLeaving) {
        if (!labelSlots.some((s) => s.target)) {
          labelsActive = false;
          labelsLeaving = false;
        }
        return;
      }
      // Between stations the slots stay empty: the next arrival fills them.
      if (tourActive && !atStation) return;
      slot.dc?.kill();
      slot.dc = gsap.delayedCall(0.35 + Math.random() * 0.7, () => {
        slot.dc = null;
        if (!labelsActive || labelsLeaving || disposed || slot.target) return;
        if (tourActive && !atStation) return;
        if (liveChips() >= chipCap) return; // a glance names only so many
        const next = pickTarget(slot);
        if (next) bindLabel(slot, next);
        // no candidate — the slot idles; the next start/cycle fills it
      });
    };
    /** Chips bound and not on their way out — the station's live set. */
    const liveChips = () => labelSlots.reduce((n, s) => n + (s.target && !s.fading ? 1 : 0), 0);
    /* 10-07 (w3, chip-exit): a chip's exit is its entrance reversed — the
       fill retracts into the leader side (drawChip clips the letters to it,
       so the word goes with the box), CHIP_WIPE_S at the exit ratio on the
       Turn curve. An opacity fade of the whole chip smeared a project colour
       through mud on the blue (yellow → grey-mauve) — the S1→S2 commit
       showed it on every walk. 10-07 (final review): the leader draws back
       into its root on the same clock (leadK) and the dot cuts off at the
       end — the trio leaves by the draw, never a fade. */
    const retractChip = (slot, onComplete) => {
      const exit = CHIP_WIPE_S * EXIT_RATIO;
      slot.retracting = true;
      gsap.killTweensOf(slot, 'fillK,leadK');
      gsap.killTweensOf(slot.mats);
      gsap.to(slot, {
        fillK: 0,
        leadK: 0,
        duration: exit,
        ease: turnEase,
        onUpdate: () => drawChip(slot),
        onComplete: () => {
          slot.mats[1].opacity = 0;
          slot.mats[2].opacity = 0;
          onComplete?.();
        },
      });
    };
    /** A chip that must go NOW (its shard left the frame, a contested seat):
     *  straight to the retract. 10-07 (final review): the `quick` flag went
     *  with the fade — the retract (CHIP_WIPE_S × EXIT_RATIO) is already
     *  quicker than the old quick fade, so a contested seat clears as fast. */
    const earlyFadeLabel = (slot) => {
      if (slot.fading) return;
      slot.fading = true;
      slot.tl?.kill();
      slot.tl = null;
      // 10-07 (final review): the shard left frame mid-entrance — STOP the
      // letters where they are (retractNow's way). Finishing them landed the
      // rest of the word in one frame just before the box took it away; the
      // retract clips whatever is already shown, so a half word leaves clean.
      slot.cut?.kill();
      slot.cut = null;
      retractChip(slot, () => {
        if (!disposed) releaseLabel(slot);
      });
    };
    /* 10-07 (w3, keep-out): the one exit that is not a letter cut — a chip
       whose box reaches the bare type of a keep box (a shard flying home on
       the reform, a leg sweeping it across the column faster than its cut
       can run) goes in one frame. Text over text, even for a few frames, is
       the read this layer must never produce. */
    const snapOutLabel = (slot) => {
      slot.dc?.kill();
      slot.dc = null;
      slot.tl?.kill();
      slot.tl = null;
      gsap.killTweensOf(slot, 'fillK,leadK');
      gsap.killTweensOf(slot.mats);
      releaseLabel(slot);
    };
    /** Fill every empty slot, staggered — the arrival burst at a station and
     *  the first start share it. 10-07 (w3): at most up to the station's
     *  chip cap, and it returns its LAST scheduled offset (the opening wide
     *  holds until that chip has typed in — holdWide). */
    const fillLabels = (delay, stagger) => {
      let at = delay;
      let room = chipCap - liveChips();
      labelSlots.forEach((slot) => {
        if (slot.target) return;
        slot.dc?.kill();
        slot.dc = null;
        if (room <= 0) return;
        room -= 1;
        // Slightly uneven stagger (Nathan, 09-10): the chips arrive one
        // after another with a little human unevenness, not on a grid.
        at += stagger * (0.6 + Math.random() * 0.8);
        const attempt = () => {
          slot.dc = null;
          if (!labelsActive || labelsLeaving || disposed || slot.target) return;
          if (liveChips() >= chipCap) return;
          const next = pickTarget(slot);
          if (next) {
            bindLabel(slot, next);
          } else if (tourActive && atStation && performance.now() - stationAt < stationFill) {
            // No readable seat this instant — a close station frames few
            // shards and they keep drifting. Try again briefly, inside the
            // arrival window, so a straggler still belongs to the entrance.
            slot.dc = gsap.delayedCall(0.25 + Math.random() * 0.25, attempt);
          }
        };
        slot.dc = gsap.delayedCall(at, attempt);
      });
      return at;
    };
    /** Every live chip lets go — the camera is leaving the shot. Each
     *  chip's letters CUT OUT in random order (the house exit cadence), the
     *  chips themselves slightly staggered, so the set leaves as a stutter
     *  rather than a dissolve (Nathan, 09-10). */
    const LEAVE_STAGGER = 0.07;
    /** The house exit for one chip: letters cut out in random order, the
     *  last one taking the leader and dot with it, then the slot releases. */
    const cutOutLabel = (slot, delay = 0) => {
      if (!slot.target || slot.fading) return;
      // 10-07 (w3 fix): a chip still WIPING IN (a commit landing on its
      // arrival) reverses its entrance instead — killing its tl below would
      // freeze the fill at a sliver for the whole letter cut.
      if (slot.fillK < 1) {
        retractNow(slot);
        return;
      }
      slot.fading = true; // no yield may interrupt the exit
      slot.tl?.kill();
      slot.tl = null;
      slot.cut?.finish(); // any letter still landing lands, then leaves
      slot.dc?.kill();
      const run = () => {
        slot.dc = null;
        slot.cutWait = null;
        slot.cut = cutSchedule(slot.chars.length, {
          stepMs: CHAR_CUT.outStepMs,
          onCut: (i) => {
            slot.shown[i] = false;
            drawChip(slot);
          },
          onComplete: () => endChip(slot),
        });
      };
      slot.cutWait = run; // hurryCut can start it before its stagger is up
      slot.dc = gsap.delayedCall(delay, run);
    };
    /* The last beat of a letter-cut exit: the box retracts into its leader
       (the wipe in reverse, at the exit ratio) while the leader draws back
       with it — one curve for both (10-07, w3: the Turn curve, was
       power2.in; final review: every chip is filled, no fade branch). */
    const endChip = (slot) => {
      retractChip(slot, () => {
        if (!disposed) releaseLabel(slot);
      });
    };
    /* 10-07 (w3 fix): a LEAVING chip that cannot finish its cut in place
       goes straight to its last beat — its shard is gone (a culled decoy,
       hazed out, flying home in the reform: the leader would point at bare
       field over the forming hero) or another leaving chip has run into it
       (text over text while the Thread camera swings). The letters still on
       it go with the box (drawChip clips them to the fill). */
    const retractNow = (slot) => {
      if (!slot.target || slot.retracting) return;
      slot.fading = true;
      slot.dc?.kill();
      slot.dc = null;
      slot.cutWait = null;
      slot.tl?.kill();
      slot.tl = null;
      slot.cut?.kill();
      slot.cut = null;
      endChip(slot);
    };
    /** 10-07 (w3 fix): a leaving chip still waiting out its stagger starts
     *  its cut NOW — the copy's led air has reached it (the phone's commit
     *  sweeps the column through the chips inside a stagger). */
    const hurryCut = (slot) => {
      if (!slot.cutWait) return;
      slot.dc?.kill();
      slot.cutWait();
    };
    const clearLabels = () => {
      let k = 0;
      labelSlots.forEach((slot) => {
        if (!slot.target) {
          // a pending (re)bind — the shot it was for is over
          slot.dc?.kill();
          slot.dc = null;
          return;
        }
        // 10-07 (w3): already leaving — its own exit runs on. (This used to
        // kill its dc too, which for a chip still inside its cut's stagger
        // was the exit itself: the chip hung there, fading, forever.)
        if (slot.fading) return;
        cutOutLabel(slot, k * LEAVE_STAGGER + Math.random() * LEAVE_STAGGER);
        k += 1;
      });
    };
    /** @returns {number} the last chip's scheduled offset, s (0 when it
     *  self-gates) — holdWide adds it to the opening wide's hold. 10-07 (w3):
     *  a layer still LEAVING (a quick S2 → S1) restarts: the chips still on
     *  their cut keep it and rebind on release. */
    const startLabels = (delay = 0) => {
      if (PREFERS_REDUCED_MOTION || !labelSlots.length || (labelsActive && !labelsLeaving)) return 0;
      labelsLeaving = false;
      labelsActive = true;
      return fillLabels(delay, fillStagger(0.28));
    };
    /* 10-07 (w7): ONE liveness test for the chip families — S1's labels (the
       layer's own gate), the Thread's words, the S3 spec sheet and the CTA's
       first_contact — at every site that asks "is any chip up?" (the tick's
       per-frame pass, the stats' keep list, the hard stop). `thread` false
       leaves the Thread's words out (leaveLabels: leaveThreadWords owns
       their exit). */
    // 10-08 (w8): the families through familyHeld (the S5 page chips joined).
    const chipsLive = (thread = true) =>
      labelsActive || labelSlots.some((s) => s.target && familyHeld(s) && (thread || !s.thread));
    /* 10-07 (w3, chip-exit): the layer LEAVES the house way — every live chip
       on its random-letter cut (the tour-leg exit, staggered), pinned to its
       shard by the tick until it releases; the last release switches the
       layer off. The S1→S2 commit, the S1→hero reform and any jump off the
       belt. The label PULSES end here, at once, before the caller builds its
       timeline: a release-time pulseOff kills every uPower tween on that
       shard — the Thread's per-bead claims, a transition's pose tween. */
    /* 10-07 (w5): and the S3 SPEC SHEET — its schedule stops (nothing
       re-seats) and its chips take the same exit. `quick` (handoff 7e, a
       commit from stage-01 back to the hero; w5 fix, any exit off stage-03 —
       the Core moves under its chips): every chip straight to its last
       beat — the fill's retract, the reverse's quick exit — so the PROCESS
       letters re-enter over a clean field instead of chips still mid-cut
       0.3–0.48s later. `nextId`: the stage the leave runs ahead of — the
       pulses recover to ITS power (pulseOff). */
    const leaveLabels = (quick = false, nextId = null) => {
      specActive = false;
      specDc?.kill();
      specDc = null;
      // 10-07 (w7): the CTA's first_contact the same way (its beat stops)
      contact.active = false;
      contact.dc?.kill();
      contact.dc = null;
      // 10-08 (w8): and the S5 page chips (no page turn seats another)
      pageActive = false;
      pageDc?.kill();
      pageDc = null;
      if (!chipsLive(false)) return;
      const next = getPose(nextId ?? stage);
      const power = next?.power;
      // 10-09 (w9, s2-hold): onto S2's constellation a shard that is a Thread
      // bead recovers to its CLAIM (10-09, w9b: s2BeadPower — w9's 0.85×) — the
      // bare level outlived a cut's power tween and left the bead lit on S2
      // (an S3 spec chip on a bead, bench jump 03→02: 41/42 claimed).
      // 10-09 (w9 fix): only where the destination chain is already FIXED —
      // the live string, or off S3 (every S3→S2 path strings s2Chain(), so
      // building it here builds the very chain they use). Off S1 the show
      // strings a NEW chain from the head station after this runs: the last
      // show's chain dimmed a chip's shard that was no bead this time (0.459
      // against the belt's 0.54 until the ignition). From S1 the pulse
      // recovers to the plain level; the hop stamps (or the compressed
      // morph, bead-aware) claim the beads.
      const fixed = threadActive || stage === 'stage-03';
      const beads = next?.thread && power != null && fixed ? new Set(threadActive ? threadChain : s2Chain()) : null;
      labelSlots.forEach((s) => pulseOff(s.panel, beads?.has(s.panel) ? s2BeadPower() : power)); // 10-09 (w9b): the dark level
      if (labelsActive) labelsLeaving = true;
      if (quick) {
        labelSlots.forEach((s) => {
          if (s.target) {
            retractNow(s);
            return;
          }
          s.dc?.kill(); // a pending (re)bind — the shot it was for is over
          s.dc = null;
        });
      } else {
        clearLabels();
      }
      if (labelsActive && !labelSlots.some((s) => s.target)) {
        labelsActive = false;
        labelsLeaving = false;
      }
    };
    /** The hard stop — an instant pose (setStageInstant), the break (the
     *  hero carries no chips) and teardown. Everything leaves on one short
     *  beat, nothing rebinds. */
    const stopLabels = () => {
      labelsLeaving = false;
      threadLabelsActive = false; // 10-07 (w4): the Thread's words stop with them
      specActive = false; // 10-07 (w5): and the S3 spec sheet
      specDc?.kill();
      specDc = null;
      contact.active = false; // 10-07 (w7): and the CTA's first_contact
      contact.dc?.kill();
      contact.dc = null;
      pageActive = false; // 10-08 (w8): and the S5 page chips
      pageDc?.kill();
      pageDc = null;
      if (!chipsLive()) return;
      labelsActive = false;
      labelSlots.forEach((slot) => {
        pulseOff(slot.panel);
        slot.tl?.kill();
        slot.tl = null;
        slot.cut?.kill();
        slot.cut = null;
        slot.dc?.kill();
        slot.dc = null;
        slot.cutWait = null;
        slot.term = '';
        slot.target = null;
        slot.panel = null;
        slot.decoy = null;
        slot.box = null;
        slot.fading = false;
        slot.thread = false;
        slot.spec = false;
        slot.cta = false;
        slot.page = false;
        // 10-07 (w3): the retract (slot.fill outlives the reset above, so
        // drawChip still has its colour for the whole exit). 10-07 (final
        // review): every chip is filled — the eased-less 0.2s fade is gone.
        retractChip(slot, () => {
          slot.group.visible = false;
        });
      });
    };

    /* 10-07 (w4, thread-words): THE THREAD PICKS THE WORDS BACK UP. The S1
       chips leave at the S1→S2 commit, and "connecting the dots" used to
       connect nameless dots — so as the trace strikes a bead the S1 tour
       NAMED, that bead wears its word again in its remembered fill (termOf /
       fillOf, keyed on the shard's own mesh.position), typed in on the house
       random-letter cut: your references, folded into one concept. A bead
       never named gets no chip — nothing is invented here.
       · Its own gate: threadLabelsActive, independent of labelsActive /
         labelsLeaving (the S1 layer may still be LEAVING when the first hop
         strikes — its gate refuses every bind) and of heldStation (no tour
         runs during the Thread).
       · Seats through the S1 path — labelVisible, then chipFits strict and
         loose (frame, keep-out, other chips, not behind a shard) — never a
         parallel test; updateLabels pins it, with held-station rules (no
         drift yields: a word blinking off mid-trace reads as a glitch).
       · ≤ the slot count at once, ≤ ?threadwords per show, first-come along
         the chain, and nothing before S2's own keyword wipe has landed.
         10-09 (w9): …before S2's HEADLINE has landed — the blurb (and its
         wipe) now rises only once the dots are connected, after every word
         has gone; the card's first read is the headline and the count. The
         hidden blurb's box is kept out all the while (keepHeld), so no word
         seats where it is about to rise.
       · All of them leave together at the pull (at0) on the house exit —
         the staggered letter cut, the fill retracting into the leader. A
         commit off S2 (either way), a jump and every hard stop clear them
         too; a reverse takes them on the quick beat, so none rides the
         belt's return. */
    let threadLabelsActive = false;
    /* 10-07 (w4 fix): the BIND window, separate from threadLabelsActive
       (which also keeps a bound word under the held rules until the pull).
       The show's timeline closes it one whole word-life before at0 — the
       letters typed in, the fill's wipe and THREAD_WORD_READ to read it — so
       a bead struck (or a pending one retried) on the last hops never types
       in only to be cut ~0.3s later: the per-hop blink "one shot" rules out. */
    let threadBindOpen = false;
    const THREAD_WORD_READ = 0.6;
    let threadWordsLeft = 0;
    let threadWordsBound = []; // this show's words (?debug stats: the probe counts them)
    let threadWordsMiss = {}; // ?debug: why a struck bead got no word (reason → count)
    const missWord = (why) => {
      threadWordsMiss[why] = (threadWordsMiss[why] ?? 0) + 1;
    };
    const threadChipsLive = () => labelSlots.some((s) => s.thread && s.target);
    /** Has stage-02's headline landed? Read off the DOM (lazily: the copy
     *  hook owns that timeline — its masked lines rise from yPercent 110),
     *  so a re-timed entrance can never let a word in early. 10-09 (w9):
     *  was the keyword wipe, which now waits for the dots (s2RevealAt). */
    const s2HeadLanded = () => {
      const lines = document.querySelectorAll('.process-page .process-stage[data-stage="stage-02"] .process-stage__headline .process-line');
      if (!lines.length) return true;
      return Math.abs(Number(gsap.getProperty(lines[lines.length - 1], 'yPercent'))) <= 0.5;
    };
    /* 10-07 (w4): a named bead the trace struck while its seat was not
       ready (S2's wipe still running, the bead off the Thread camera's tight
       frame, an S1 chip still leaving on it or wearing its word) waits here,
       in chain order, and is tried again on every later hop — the first
       walk bound ONE word of five named beads because each got exactly one
       look at the instant of its strike. First-come along the chain still
       holds: the queue is tried oldest first, before the new bead. */
    let threadWordsPending = [];
    // 10-07 (w5, ?debug): a pending bead's LAST failed look — tallied as
    // `left:<why>` when the bind window closes on it (threadMiss counts only
    // first looks, so a bead that waited out the wipe and still never seated
    // said nothing about why).
    const pendingWhy = new Map();
    const closeThreadBind = () => {
      threadBindOpen = false;
      threadWordsPending.forEach((p) => missWord(`left:${pendingWhy.get(p) ?? 'none'}`));
      threadWordsPending = [];
    };
    const startThreadWords = () => {
      threadWordsBound = [];
      threadWordsMiss = {};
      threadWordsPending = [];
      pendingWhy.clear();
      threadWordsLeft = PREFERS_REDUCED_MOTION || !labelSlots.length ? 0 : Math.max(Math.round(TUNING.threadWords), 0);
      threadLabelsActive = threadWordsLeft > 0;
      threadBindOpen = threadLabelsActive; // buildConnect's tl closes it
      // 10-09 (w9): the blurb's box is out of bounds while it waits (lazy DOM)
      keepHeld = threadLabelsActive ? stageEl('stage-02', '.process-stage__blurb') : null;
    };
    /** One look at one struck bead: null when it took a chip, else why not. */
    const tryThreadWord = (panel) => {
      const pos = panel.mesh.position;
      const term = termOf.get(pos);
      if (labelSlots.some((s) => s.target === pos)) return 's1-leaving'; // an S1 chip still leaving on it
      if (heldTerms().has(term)) return 'dup'; // its word is on screen elsewhere — never two at once
      const slot = labelSlots.find((s) => !s.target);
      if (!slot) return 'no-slot';
      refreshLabelMatrices();
      const view = labelView();
      const cand = { pos, panel, decoy: null };
      /* labelVisible's facing and haze floors, but NOT its pick margin
         (LABEL_NDC_BIND 0.86): that margin exists because S1's touring camera
         carries a chip bound near the edge off it, and the Thread camera holds
         nearly still on the first bead — so with it the first walk's named
         beads were "unseen" at ndc 0.9. Here the dot only has to be on screen;
         the SEAT is the test, as for every chip: chipFits = chipInFrame +
         keep-out (+ clear of chips and shards when strict). */
      // 10-07 (w5, thread-word-yield): HALF the S1 facing floor — the bead is
      // lit and strung, so it reads at a steeper angle than a cold shard; the
      // seat (chipFits) still decides, and the leader root keeps
      // LABEL_FRONT_EPS (it must sit on a visible face).
      if (labelProminence(panel) < LABEL_BIND_FACING * 0.5) return 'unseen:facing';
      if (hazeAt(cand) > LABEL_HAZE_MAX) return 'unseen:haze';
      lblNdc.copy(pos);
      globeGroup.localToWorld(lblNdc).project(camera);
      if (lblNdc.z > 1 || Math.abs(lblNdc.x) >= 1 || Math.abs(lblNdc.y) >= 1) return 'unseen:frame';
      /* 10-07 (w5, thread-word-yield): the DOT keeps the bind's edge room
         too (CHIP_EDGE_M + CHIP_EDGE_SLACK, the box's own bind margin). A
         dot 1–4px inside the frame passed the NDC test and was STRANDED on
         the next frames (updateLabels' CHIP_EDGE_M) as the Thread camera
         crept — a word typed in and cut 0.1s later, the late blink. */
      const dotM = CHIP_EDGE_M + CHIP_EDGE_SLACK;
      const dotX = ((lblNdc.x + 1) / 2) * view.vw;
      const dotY = ((1 - lblNdc.y) / 2) * view.vh;
      if (dotX < dotM || dotX > view.vw - dotM || dotY < dotM || dotY > view.vh - dotM) return 'edge';
      // 10-08 (w8, chip-cover-exact): BOTH seats take the exact cover — the
      // strict one's screen circle reads only the DRIFTING shards, and the
      // Thread's beads are assembling: an S2 word bound behind a nearer
      // shard and stayed buried for its whole bead (the probe's --buried,
      // ARTIST_INTERESTS 15/15 samples under 0.2).
      if (!chipFits(cand, view, slot, true, CHIP_EDGE_SLACK, true) && !chipFits(cand, view, slot, false, CHIP_EDGE_SLACK)) return 'no-seat';
      // 10-07 (w5): the copy gate LAST — `wipe` now means "seatable, waiting
      // on S2's keyword wipe", so the ?debug tally tells a bead that was
      // ready at its strike from one that never was. 10-09 (w9): `head` —
      // waiting on S2's headline (the wipe comes after the words now).
      if (!s2HeadLanded()) return 'head';
      slot.dc?.kill();
      slot.dc = null;
      slot.thread = true;
      threadWordsLeft -= 1;
      threadWordsBound.push({ term, fill: fillOf.get(pos) ?? null, id: panels.indexOf(panel) });
      bindLabel(slot, cand);
      return null;
    };
    const bindThreadWord = (panel) => {
      if (!threadLabelsActive || disposed) return;
      // 10-07 (w4 fix): too close to the pull for a word to be read — no
      // new bind, and the pending queue stops with it.
      if (!threadBindOpen) {
        if (termOf.has(panel.mesh.position)) missWord('closing'); // ?debug
        return;
      }
      if (termOf.has(panel.mesh.position)) threadWordsPending.push(panel);
      else missWord('unnamed'); // never named in S1 — no chip, nothing invented
      threadWordsPending = threadWordsPending.filter((p) => {
        if (threadWordsLeft <= 0) return false;
        const why = tryThreadWord(p);
        if (why) pendingWhy.set(p, why);
        if (why && p === panel) missWord(why); // ?debug: a bead's first look only
        else if (!why && p !== panel) missWord('late'); // ?debug: bound on a retry
        return Boolean(why);
      });
    };
    /** @param {boolean} quick the reverse: straight to each chip's last
     *  beat (the retract), so nothing rides the belt's return. */
    const leaveThreadWords = (quick = false) => {
      threadLabelsActive = false;
      keepHeld = null; // 10-09 (w9): the words are going — the blurb rises on its own box
      let k = 0;
      labelSlots.forEach((slot) => {
        if (!slot.thread || !slot.target) return;
        if (quick) {
          retractNow(slot);
          return;
        }
        if (slot.fading) return;
        cutOutLabel(slot, k * LEAVE_STAGGER + Math.random() * LEAVE_STAGGER);
        k += 1;
      });
    };

    /* 10-07 (w5, s3-spec-sheet): THE SPEC SHEET — the third chip family (S1's
       labels, the Thread's words, these). After the page's loudest beat S3
       held a blank disc for 4+s while its blurb is the most concrete sentence
       on the page; now the solid Core is NAMED, one word per beat (60/?bpm),
       in copy order — logo_suite, type_pairings, color_palette,
       layout_sensibility (processContent: STAGES[2].annotations): "here is
       what you get", and a first taste of S5's tempo.
       · A MODE on the S1 machinery, not a fork: slot.spec rides bindLabel,
         updateLabels and the house exits the way slot.thread does, with its
         own gate (specActive). No tour gates (heldStation / atStation /
         tourSubjectPanel), no ?labelhold auto-fade, no LABEL_TERMS draw.
       · specOf (not termOf) remembers which shard wore which word: a return
         visit re-seats a word on its old shard when that one faces the lens
         again; the fill comes from fillOf (dealt on a shard's first naming).
       · Seats: Core panels facing the lens (≥ LABEL_BIND_FACING) in the OUTER
         ring (≥ half the projected radius out, so the leader reads as reaching
         off the body), ≥60° of polar angle from every other spec chip, through
         chipFits (strict and OUTWARD only: frame + keep-out + clear of the
         other chips, off the body). ?s3notes is a CEILING: a phone (or a desktop
         whose left limb runs into the copy) that seats three shows three. A beat
         whose next word finds no seat tries the next word in copy order.
       · The tagged shard pulses (pulseOn: ?labelpulse × S3's full power, on
         ?bpm). Once it turns past SPEC_LET_GO its chip cuts out on the house
         exit and the word re-seats on a later beat, on a fresh panel.
       · Starts on EVERY S3 arrival, never inside the cascade: the light-up's
         own timeline starts it once the last row has settled; reverse and
         compressed arrivals on landing; an instant pose at once. Leaves with
         leaveLabels (every transition, and the driver's commit off S3 either
         way); stops with stopLabels. Reduced motion has no chip slots. */
    const SPEC_TERMS = (STAGES.find((st) => st.id === 'stage-03')?.annotations ?? []).map((t) => t.toUpperCase());
    const SPEC_LET_GO = LABEL_BIND_FACING * 0.5; // ≈78° off square: past it the shard reads as a sliver
    const SPEC_GAP = Math.PI / 3; // 60° of polar angle between two spec chips' shards
    let specActive = false;
    let specDc = null; // the beat clock (a delayedCall chain)
    // 10-08 (w8): the S5 page chips' gate and their one-beat retry (the
    // family lives with the S5 loop — pageTurn / pageEnd)
    let pageActive = false;
    let pageDc = null;
    let specLog = []; // ?debug: this visit's binds — { term, t (s from start), id (panel), ang (deg) }
    let specT0 = 0;
    const specChipsLive = () => labelSlots.some((s) => s.spec && s.target);
    const specCeil = () =>
      Math.min(Math.max(Math.round(TUNING.s3Notes), 0), SPEC_TERMS.length, labelSlots.length);
    const specC = { x: 0, y: 0, depth: 0, perPx: 0 }; // the Core's centre, px
    const specP = { x: 0, y: 0, depth: 0, perPx: 0 };
    /** A target's polar angle about the Core's projected centre (specC). */
    const specAngle = (pos, view) => {
      lblWorld.copy(pos);
      globeGroup.localToWorld(lblWorld);
      if (!toPx(lblWorld, view, specP)) return null;
      return Math.atan2(specP.y - specC.y, specP.x - specC.x);
    };
    const angGap = (a, b) => {
      const d = Math.abs(a - b) % (Math.PI * 2);
      return d > Math.PI ? Math.PI * 2 - d : d;
    };
    const pickSpecSeat = (word, slot, view) => {
      lblCentre.set(globeGroup.position.x, globeGroup.position.y, 0);
      if (!toPx(lblCentre, view, specC)) return null;
      const ringPx = (RADIUS * 0.5) / specC.perPx; // half the Core's projected radius
      const angles = [];
      labelSlots.forEach((sl) => {
        if (!sl.spec || !sl.target) return;
        const a = specAngle(sl.target, view);
        if (a != null) angles.push(a);
      });
      const taken = labelSlots.map((sl) => sl.target).filter(Boolean);
      const cands = [];
      panels.forEach((p) => {
        const pos = p.mesh.position;
        if (taken.includes(pos) || termOf.has(pos) || contact.held.has(pos)) return; // 10-07 (w7): nor first_contact's
        const own = specOf.get(pos);
        if (own && own !== word) return;
        const facing = labelProminence(p); // borrows lblWorld — read before specAngle
        if (facing < LABEL_BIND_FACING) return;
        const ang = specAngle(pos, view);
        if (ang == null) return;
        if (Math.hypot(specP.x - specC.x, specP.y - specC.y) < ringPx) return;
        if (angles.some((a) => angGap(a, ang) < SPEC_GAP)) return;
        cands.push({ pos, panel: p, decoy: null, term: word, ang, facing, own: own ? 1 : 0 });
      });
      // its old shard first, then the squarest face (the longest life)
      cands.sort((a, b) => b.own - a.own || b.facing - a.facing);
      // 10-07 (w5 fix): the OUTWARD readable seat only — no loose fallback,
      // no inward side. A left-limb shard's outward seat runs into the copy,
      // and its inward seat is a box over the Core's own face: buried behind
      // the nearer panels at the limb (LAYOUT_SENSIBILITY counted live while
      // only a bare dot and two bracket ends showed), a leader across the
      // body once the shard comes round. seatBehindShard cannot catch it —
      // the assembled Core's panels are not occluders (buildOccluders takes
      // the DRIFTING shards) — so the side is the gate. A word without a
      // seat tries again next beat.
      return cands.find((c) => chipFits(c, view, slot, true) === 1) ?? null;
    };
    const specBeat = () => {
      specDc = null;
      if (!specActive || disposed) return;
      specDc = gsap.delayedCall(60 / Math.max(TUNING.bpm, 1), specBeat);
      const ceil = specCeil();
      if (labelSlots.filter((sl) => sl.spec && sl.target && !sl.fading).length >= ceil) return;
      const slot = labelSlots.find((sl) => !sl.target);
      if (!slot) return;
      // a word still on screen (its chip leaving, too) waits for its release
      const held = new Set(labelSlots.filter((sl) => sl.spec && sl.target).map((sl) => sl.term));
      refreshLabelMatrices();
      const view = labelView();
      for (let k = 0; k < ceil; k++) {
        const word = SPEC_TERMS[k];
        if (held.has(word)) continue;
        const cand = pickSpecSeat(word, slot, view);
        if (!cand) continue;
        slot.dc?.kill();
        slot.dc = null;
        specOf.set(cand.pos, word);
        specSeat.set(word, cand.pos); // 10-07 (w5 fix): its latest shard — the one S1 holds out
        slot.spec = true;
        bindLabel(slot, cand);
        specLog.push({
          term: word,
          t: +((performance.now() - specT0) / 1000).toFixed(2),
          id: panels.indexOf(cand.panel),
          ang: Math.round(THREE.MathUtils.radToDeg(cand.ang)),
        });
        return; // one bind per beat
      }
    };
    const startSpecSheet = (delay = 0) => {
      if (PREFERS_REDUCED_MOTION || !labelSlots.length || specActive || specCeil() <= 0) return;
      specActive = true;
      specLog = [];
      specT0 = performance.now() + delay * 1000;
      specDc?.kill();
      specDc = gsap.delayedCall(delay, specBeat);
    };

    /* 10-07 (w3 fix): has a LEAVING chip's shard gone from the shot? A
       culled decoy (its pos stays put while it scales out — the reform's
       INDUSTRY_OPPORTUNITIES hung a bare bar over empty field), a shard
       flying home in the reform or scaled out, or one the haze has taken. */
    const hazeProbe = { pos: null };
    const leaveTargetGone = (slot) => {
      if (slot.panel) {
        if (flightActive && flightMode === 'reform') return true;
        if (slot.panel.mesh.scale.x < 0.05) return true;
      } else if (!decoyMesh.visible || (slot.decoy && slot.decoy.s < 0.5)) {
        return true;
      }
      hazeProbe.pos = slot.target;
      return hazeAt(hazeProbe) > LABEL_HAZE_MAX;
    };

    /* Per frame: place each bound slot's trio in WORLD space at its panel's
       own depth. Everything else — which chip is in front of which, and
       which shards cover them — is the depth buffer's job. */
    const updateLabels = () => {
      const view = labelView();
      refreshLabelMatrices();
      labelSlots.forEach((slot) => {
        const visible = slot.mats[0].opacity > 0.002;
        if (!slot.target || !visible) {
          slot.group.visible = false;
          return;
        }
        // 10-07 (w3 fix): the layer is leaving and this chip's shard has gone
        // — it does not finish its letter cut over bare field (retractNow).
        if ((labelsLeaving || familyHeld(slot)) && slot.fading && !slot.retracting && leaveTargetGone(slot)) retractNow(slot);
        lblWorld.copy(slot.target);
        globeGroup.localToWorld(lblWorld);
        const anchorZ = lblWorld.z;
        if (!chipSeat(lblWorld, view, seatOut, slot.sign)) {
          // Behind the lens — let go and hide this frame.
          slot.group.visible = false;
          if (!slot.fading) earlyFadeLabel(slot);
          return;
        }
        const { perPx } = lblA;
        // Let go when the anchor turns away or leaves the frame (KEEP margin)
        // — the chip rides its shard out and frees the slot.
        const ndcX = (lblA.x / view.vw) * 2 - 1;
        const ndcY = 1 - (lblA.y / view.vh) * 2;
        const wPx0 = chipW(slot.textW);
        const hPx0 = chipH();
        const gone =
          Math.abs(ndcX) > LABEL_NDC_KEEP ||
          Math.abs(ndcY) > LABEL_NDC_KEEP ||
          // A generous margin: start the exit well before the edge.
          !inFrame(view, lblChip.x, lblChip.y, wPx0 + 72, hPx0 + 40) ||
          (slot.panel && labelProminence(slot.panel) < LABEL_FRONT_EPS);
        /* 10-07 (w3): THE FRAME CLAMP. The chip is a rigid plane, and the
           held-station rule below keeps it through drift, so a seat that
           drifted past the edge used to be CUT by the frustum — a phone hung
           INQUIRY_NOTES off the right edge for a second. The box is held
           CHIP_EDGE_M inside the frame instead and the leader re-aims at
           where it actually sits (root still on the face, line still ending
           at the box edge that faces it). */
        const seatX = lblChip.x;
        const seatY = lblChip.y;
        const m = CHIP_EDGE_M;
        lblChip.x = Math.min(Math.max(lblChip.x, m + wPx0 / 2), view.vw - m - wPx0 / 2);
        lblChip.y = Math.min(Math.max(lblChip.y, m + hPx0 / 2), view.vh - m - hPx0 / 2);
        const clamped = lblChip.x !== seatX || lblChip.y !== seatY;
        if (clamped) {
          const dx = lblChip.x - lblA.x;
          const dy = lblChip.y - lblA.y;
          const d = Math.hypot(dx, dy) || 1;
          seatOut.ox = dx / d;
          seatOut.oy = dy / d;
        }
        // The clamp cannot help a chip whose SHARD is at the edge: the dot
        // off-frame, or the box shoved more than half a leader off its seat.
        // 10-07 (w3 fix): or shoved back over its own anchor — any chip wider
        // than one leader can get there inside the half-leader allowance (a
        // phone's 82px leader, most words), and then the dot sits under the
        // fill and the leader doubles back under the word.
        const stranded =
          lblA.x < m || lblA.x > view.vw - m || lblA.y < m || lblA.y > view.vh - m ||
          Math.hypot(lblChip.x - seatX, lblChip.y - seatY) > chipLead() * 0.5 ||
          (clamped &&
            Math.abs(lblChip.x - lblA.x) < wPx0 / 2 + LABEL_DOT_PX * 2 &&
            Math.abs(lblChip.y - lblA.y) < hPx0 / 2 + LABEL_DOT_PX * 2);
        // Held station: a chip that has cut in STAYS until the camera leaves
        // (Nathan, 09-10 — the drift-time yields read as flicker) — edge drift
        // is the clamp's; a stranded chip leaves by the house cut. 10-07
        // (w4): a Thread word is always held — it stays on its bead until
        // the pull.
        // 10-07 (w5): so is an S3 spec chip — until its shard turns away
        // (SPEC_LET_GO), when it cuts out and its word re-seats on a beat.
        // 10-07 (w7): and the CTA's first_contact — until the CTA leaves.
        // 10-08 (w8): and an S5 page chip — for its page, unless its shard
        // turns away (the spec rule: it cuts out; the next page seats anew).
        const held = familyHeld(slot) || heldStation();
        const turned = (slot.spec || slot.page) && slot.panel && labelProminence(slot.panel) < SPEC_LET_GO;
        if (!slot.fading) {
          if (gone && !held) earlyFadeLabel(slot);
          else if ((stranded || turned) && held) {
            if (slot.thread) missWord('cut:stranded'); // 10-07 (w5, ?debug): a Thread word cut before the pull
            cutOutLabel(slot);
          }
        }
        /* 10-07 (w3, keep-out): a chip whose box enters a keep box leaves by
           the letter cut, held station or not; one that gets within half the
           air of the BARE type (a leg or the reform sweeping it in faster
           than a cut runs) goes at once. Half, not none: at line-height 1 a
           text line's glyph box overhangs its element's box by a few px
           (the probe caught a leaving chip grazing the blurb's first line).
           10-07 (w3 fix): "the bare type" is where it paints THIS frame (the
           keep box's `bare`), not its led air — and a chip already leaving
           that the air reaches starts its cut now instead of waiting out its
           stagger, so the phone's commit sweep meets chips mid-cut. */
        if (hitsKeep(view.keep, lblChip.x, lblChip.y, wPx0, hPx0, KEEP_PAD / 2, true)) {
          if (slot.thread && !slot.fading) missWord('cut:snap'); // 10-07 (w5, ?debug)
          snapOutLabel(slot);
          return;
        }
        if (hitsKeep(view.keep, lblChip.x, lblChip.y, wPx0, hPx0)) {
          if (slot.thread && !slot.fading) missWord('cut:keep'); // 10-07 (w5, ?debug)
          if (!slot.fading) cutOutLabel(slot);
          else hurryCut(slot);
        }
        slot.group.visible = true;

        const wPx = chipW(slot.textW);
        const hPx = chipH();
        // ax/ay: the anchor dot, px (the ?debug chip getter — w3 fix probes)
        slot.box = { x: lblChip.x, y: lblChip.y, w: wPx, h: hPx, depth: lblA.depth, ax: lblA.x, ay: lblA.y };
        /* Screen px → world AT THE LIFTED DEPTH. The chip sits ?scatter×0.16
           in front of its shard's z (so only a shard clearly nearer covers
           it), and it has to be unprojected at THAT depth: round 3 solved px
           at the anchor's depth and then wrote a nearer z, which is not a
           move along the view ray — it pushed every chip, leader and dot
           outward from the screen centre by depth/(depth − lift), most at the
           frame edges and in the close-ups. That was the anchor dot hanging
           off the shard's face (Nathan, 09-10). */
        const lift = anchorZ + labelLift();
        const liftDepth = Math.max(lblA.depth - labelLift(), 0.05);
        const perPxLift = (liftDepth * view.tanV * 2) / view.vh;
        const pxToWorldX = (px) =>
          camera.position.x + ((px - view.vw / 2) / (view.vw / 2)) * liftDepth * view.tanH;
        const pxToWorldY = (py) =>
          camera.position.y - ((py - view.vh / 2) / (view.vh / 2)) * liftDepth * view.tanV;
        slot.chip.position.set(pxToWorldX(lblChip.x), pxToWorldY(lblChip.y), lift);
        slot.chip.scale.set(wPx * perPxLift, hPx * perPxLift, 1);

        /* The leader AIMS AT THE CHIP'S CENTRE (09-09 round 2, Nathan — it
           used to grab the nearest corner, which read as pointing at the end
           of the word rather than at the label) and STOPS at the box edge, so
           the line never crosses the type it is naming. Since the seat is
           radial, that edge is the middle of whichever side faces the shard. */
        const hx = wPx / 2;
        const hy = hPx / 2;
        const ax = Math.abs(seatOut.ox);
        const ay = Math.abs(seatOut.oy);
        const t = Math.min(
          ax > 1e-4 ? hx / ax : Infinity,
          ay > 1e-4 ? hy / ay : Infinity
        );
        const edgeX = lblChip.x - seatOut.ox * t;
        const edgeY = lblChip.y - seatOut.oy * t;
        /* The dot and the leader's ROOT sit on the shard's own face — the
           shard's origin IS its face centre (geometry re-baked to centerDir·R
           at build) — nudged a hair up the view ray so they paint over the
           face instead of z-fighting into it. A nudge along the ray moves
           nothing on screen. The leader climbs from there to the lifted chip
           edge; in profile it now leaves the face rather than floating
           beside it. */
        lblWorld.copy(slot.target); // labelProminence (the `gone` test) borrows lblWorld
        globeGroup.localToWorld(lblWorld);
        lblNormal.copy(camera.position).sub(lblWorld).normalize().multiplyScalar(LABEL_ROOT_EPS);
        const rootX = lblWorld.x + lblNormal.x;
        const rootY = lblWorld.y + lblNormal.y;
        const rootZ = lblWorld.z + lblNormal.z;
        // 10-09 (w9b): into the slot's batch entry (flushLabelBatch packs it)
        slot.leader.a.set(rootX, rootY, rootZ);
        // 10-07 (final review): the line runs root → box edge only as far as
        // leadK has drawn it (the entrance draws it out, the exit back in).
        const lk = slot.leadK;
        slot.leader.b.set(rootX + (pxToWorldX(edgeX) - rootX) * lk, rootY + (pxToWorldY(edgeY) - rootY) * lk, rootZ + (lift - rootZ) * lk);

        slot.dot.p.set(rootX, rootY, rootZ);
        slot.dot.r = (LABEL_DOT_PX / 2) * perPx;
        // 10-09 (w9b, ?debug): where the drawn leader ends on screen (the bench's crossings)
        slot.box.ex = lblA.x + (edgeX - lblA.x) * lk;
        slot.box.ey = lblA.y + (edgeY - lblA.y) * lk;
      });
      if (chipBench && tourActive && labelsActive) benchFrame();

      /* 10-07 (w3 fix): LEAVING chips ride their shards through their cut,
         and a camera move (the Thread's swing, a tour leg) can carry two of
         them into each other — text over text for the rest of the cut. When
         their boxes cross, the farther skips the rest of its cut and goes
         straight to its retract (depth arbitrates, as below). */
      for (let i = 0; i < labelSlots.length; i++) {
        const a = labelSlots[i];
        if (!a.target || !a.box || !a.fading || a.retracting) continue;
        for (let j = i + 1; j < labelSlots.length; j++) {
          const b = labelSlots[j];
          if (!b.target || !b.box || !b.fading || b.retracting) continue;
          if (!boxesHit(a.box.x, a.box.y, a.box.w, a.box.h, b.box, 0)) continue;
          retractNow(a.box.depth > b.box.depth ? a : b);
          break;
        }
      }

      /* Drift occlusion. The bind test seats a chip somewhere readable, but
         its shard keeps moving and the cloud keeps turning, so a chip can
         still end up behind a bank of shards showing three letters. Every
         chip is re-measured every frame against the cached circles and gives
         up once it is mostly covered — the slot re-slots somewhere it can be
         read. Partial cover stays: a word clipped at one end is the read that
         pairs it with its shard, and only a word cut to a stray syllable is
         noise. */
      // 10-07 (w4): the Thread's words take the held rules too. (w5): and
      // the S3 spec sheet. (w7): and the CTA's first_contact.
      // 10-08 (w8): and the S5 page chips.
      if (heldStation() || threadLabelsActive || specActive || contact.active || pageActive) {
        /* Persistent for the shot — with ONE exception. Two chips that have
           drifted into a true intersection are text over text, the read the
           layer must never produce, so the farther one leaves by the house
           letter cut and re-seats. Mere proximity (the bind-time pad) does
           not count here; only glyph boxes actually crossing. */
        for (let i = 0; i < labelSlots.length; i++) {
          const a = labelSlots[i];
          if (!a.target || !a.box || a.fading) continue;
          for (let j = i + 1; j < labelSlots.length; j++) {
            const b = labelSlots[j];
            if (!b.target || !b.box || b.fading) continue;
            if (!boxesHit(a.box.x, a.box.y, a.box.w, a.box.h, b.box, 0)) continue;
            const far = a.box.depth > b.box.depth ? a : b;
            if (far.thread) missWord('cut:cross'); // 10-07 (w5, ?debug)
            cutOutLabel(far);
            break;
          }
        }
        return;
      }
      buildOccluders(view, (occTick += 1));
      for (const probe of labelSlots) {
        if (!probe.target || !probe.box || probe.fading || probe.mats[0].opacity <= 0.3) continue;
        if (chipCoverage(probe) > CHIP_COVER_MAX) {
          probe.strikes = (probe.strikes || 0) + 1;
          if (probe.strikes >= CHIP_COVER_STRIKES) earlyFadeLabel(probe);
        } else {
          probe.strikes = 0;
        }
      }

      /* Drift collisions. The bind test keeps chips off each other at the
         moment they latch, but both are riding shards that keep moving, so
         two can still wander together. DEPTH arbitrates, the same rule that
         governs everything else here: the FARTHER chip yields — it fades
         early and re-slots somewhere clear, and the nearer one, the one the
         viewer reads as in front, keeps its seat. Text over text is mush
         whichever order it paints in, so one of them has to go.
         n ≤ 8, so the pairwise sweep is free. */
      for (let i = 0; i < labelSlots.length; i++) {
        const a = labelSlots[i];
        if (!a.target || !a.box || a.fading) continue;
        for (let j = i + 1; j < labelSlots.length; j++) {
          const b = labelSlots[j];
          if (!b.target || !b.box || b.fading) continue;
          if (!boxesHit(a.box.x, a.box.y, a.box.w, a.box.h, b.box)) continue;
          earlyFadeLabel(a.box.depth > b.box.depth ? a : b);
          break;
        }
      }
    };

    /* — Decoy choreography (`s` rides gsap; the tick composes it).
       Two registers (Nathan 07-30): the DEFAULT cull is the snappy
       flicker-out (interrupts / generic transitions — stays fast); the
       PROLONGED cull is the authored S1→S2 read — exits spread across a
       few seconds of the connect phase so the user takes notice, split
       into two cohorts: half flicker out with a drawn-out stutter, half
       FALL out of frame (d.pos tweened down past the frustum; the tick's
       belt-drift quat spin keeps them tumbling on the way down). What
       remains is the material that builds the world. — */
    const decoysOut = (tl, at, window, prolonged = false) => {
      if (!decoyMesh.visible) return;
      const fallDist = TUNING.scatter * 3.2; // safely past the frustum floor
      decoys.forEach((d, i) => {
        gsap.killTweensOf(d);
        gsap.killTweensOf(d.pos);
        const jitter = (d.phase / (Math.PI * 2)) * window;
        if (prolonged && i % 2 === 1) {
          // Falling cohort: gravity read — steep accelerating drop with a
          // seeded sideways drift; scale zeroes once it's out of frame.
          const fallDur = 1.0 + (d.phase / (Math.PI * 2)) * 0.4;
          tl.to(
            d.pos,
            {
              y: d.pos.y - fallDist,
              x: d.pos.x + Math.sin(d.phase) * 0.45,
              duration: fallDur,
              ease: 'power2.in',
            },
            at + jitter
          );
          tl.set(d, { s: 0 }, at + jitter + fallDur);
        } else if (prolonged) {
          // Flickering cohort: the scale-jitter exit, slowed to read.
          tl.to(
            d,
            {
              keyframes: [
                { s: d.s * 0.45, duration: 0.12 },
                { s: d.s * 0.85, duration: 0.14 },
                { s: d.s * 0.3, duration: 0.1 },
                { s: d.s * 0.7, duration: 0.12 },
                { s: 0, duration: 0.3, ease: 'power2.in' },
              ],
              ease: 'none',
            },
            at + jitter
          );
        } else {
          tl.to(
            d,
            {
              keyframes: [
                { s: d.s * 0.45, duration: 0.05 },
                { s: d.s * 0.8, duration: 0.05 },
                { s: 0, duration: 0.16, ease: 'power2.in' },
              ],
              ease: 'none',
            },
            at + jitter
          );
        }
      });
      tl.call(() => {
        decoyMesh.visible = false;
      }, null, at + window + (prolonged ? 1.5 : 0.3));
    };
    const decoysIn = (tl, at, window) => {
      // 10-07 (final review): the belt-return flood is navy (only the break
      // lights it) — reset at build, while it is still hidden.
      gsap.killTweensOf(decoyMaterial.uniforms.uBlueMix);
      decoyMaterial.uniforms.uBlueMix.value = 0;
      tl.call(() => {
        // Belt return mirrors the cull: fallen decoys re-seat on their
        // belt slots before the flicker-in surfaces them.
        decoys.forEach((d) => {
          gsap.killTweensOf(d.pos);
          if (d.beltPos) d.pos.copy(d.beltPos);
        });
        composeDecoys();
        decoyMesh.visible = true;
      }, null, at);
      decoys.forEach((d) => {
        gsap.killTweensOf(d);
        const jitter = (d.phase / (Math.PI * 2)) * window;
        tl.fromTo(
          d,
          { s: 0 },
          {
            keyframes: [
              { s: 0.5, duration: 0.07 },
              { s: 0.14, duration: 0.06 },
              { s: 1, duration: 0.3, ease: 'power3.out' },
            ],
            ease: 'none',
          },
          at + jitter
        );
      });
    };

    /* — The globe-O ↔ belt BREAK and REFORM (10-07, Nathan) — */
    const flInv = new THREE.Matrix4();
    const flGroupQ = new THREE.Quaternion();
    const flA = new THREE.Vector3();
    const flB = new THREE.Vector3();
    const flC = new THREE.Vector3();
    const flQ = new THREE.Quaternion();
    const flT = new THREE.Quaternion();
    const flR = new THREE.Quaternion();

    /* Seat heroGroup on the lockup's disc — the mark's LIVE rect, so a
       reform converges on the O wherever the gliding page has it. `restSeat`
       (the break only): an O wholly off screen breaks from its scroll-0 REST
       seat instead — a bench replay from further down still shows the burst.
       No mark (reduced motion never registers one; a bench jump can beat
       it) → a centred O of a plausible size. */
    const placeHero = (restSeat = false) => {
      const vw = container.clientWidth || 1;
      const vh = container.clientHeight || 1;
      const m = heroMark?.mark?.() ?? null;
      let cx = vw / 2;
      let cy = vh / 2;
      let globeR = vh * 0.07;
      heroRingK = 1.035;
      if (m) {
        const box = container.getBoundingClientRect();
        cx = m.cx - box.left;
        cy = m.cy - box.top;
        if (restSeat && (cy + m.ringR < 0 || cy - m.ringR > vh)) cy += m.scrollY;
        globeR = Math.max(m.globeR, 1);
        heroRingK = m.ringR / globeR;
      }
      const tanV = TAN_V;
      const camZ = camera.position.z;
      // Deep behind the belt — the burst comes FORWARD out of the haze —
      // and always inside the far plane, whatever the dial says.
      const depth = Math.min(camZ * Math.max(TUNING.shatterDepth, 1), camera.far * 0.9);
      const perPx = (2 * depth * tanV) / vh; // world units per CSS px at that depth
      heroGroup.position.set(
        camera.position.x + (cx - vw / 2) * perPx,
        camera.position.y - (cy - vh / 2) * perPx,
        camZ - depth
      );
      heroGroup.scale.setScalar(Math.max((globeR * perPx) / RADIUS, 1e-3));
      heroEuler.set(m?.pitch ?? THREE.MathUtils.degToRad(INITIAL_PITCH_DEG), m?.yaw ?? 0, 0);
      heroQuat.setFromEuler(heroEuler); // XYZ: the pitch wraps the spin, as the lockup nests them
      heroGroup.updateMatrixWorld();
    };
    // A shard's seat on the O, in world space.
    const heroWorld = (p, out) =>
      out.copy(p.homeOffset).applyQuaternion(heroQuat).multiplyScalar(heroGroup.scale.x).add(heroGroup.position);
    /* 10-07 (w2, the shatter judge): the flight's BOW. Every path is the
       chord bowed at its midpoint — P(u) = S + u(T − S) + 2u(1 − u)·N, a
       quadratic Bézier whose control point is the chord's midpoint + N —
       replacing the blast point at the seat (S→K→T), which was back-loaded
       (5/31/64/90% of the screen chord at +0.11/0.36/0.82/1.54s) and walked
       34 of 84 desktop shards BACKWARDS at launch (the reform overshot as
       many seats). N is radial out of the O at the seat, in the image plane
       (the camera never rotates: the view axis is z — a burst toward the
       lens reads as a zoom, not a break), ?shatterkick O radii long, but
       never more than BOW_CLAMP of the chord AS SEEN: along the chord the
       progress is u + 2u(1 − u)·(N·Δ̂)/|Δ|, whose slope stays ≥ 0.1 while
       |N·Δ̂| ≤ 0.45|Δ| — no reversal at launch, no overshoot at landing, by
       construction. Measured on SCREEN, at the midpoint's depth: a 3D clamp
       still let near slots overshoot under perspective. */
    const BOW_CLAMP = 0.45;
    const bowView = { vw: 1, vh: 1, tanV: 1, tanH: 1 };
    const bowA = { x: 0, y: 0, depth: 0, perPx: 0 };
    const bowB = { x: 0, y: 0, depth: 0, perPx: 0 };
    const bowM = new THREE.Vector3();
    const syncBowView = () => {
      screenView(bowView); // 10-07 (final review): the one helper
    };
    // N for the chord seat ↔ end (both world), radial on the SEAT's side.
    const bowOf = (seat, end, out) => {
      out.subVectors(seat, heroGroup.position);
      out.z = 0;
      if (out.lengthSq() < 1e-12) out.set(1, 0, 0);
      out.normalize();
      const a = toPx(seat, bowView, bowA);
      const b = toPx(end, bowView, bowB);
      const chordPx = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      // world units per px at the chord midpoint's depth (= dMid / fPx)
      bowM.addVectors(seat, end).multiplyScalar(0.5);
      const perPx = (2 * Math.max(camera.position.z - bowM.z, 0.05) * bowView.tanV) / bowView.vh;
      const reach = Math.min(
        Math.max(TUNING.shatterKick, 0) * heroGroup.scale.x * RADIUS,
        BOW_CLAMP * chordPx * perPx
      );
      return out.multiplyScalar(Math.max(reach, 0));
    };
    const syncGroupFrame = () => {
      globeGroup.updateMatrixWorld();
      flInv.copy(globeGroup.matrixWorld).invert();
      globeGroup.getWorldQuaternion(flGroupQ).invert();
    };

    /* 10-07 (w2, the director's slot match): at the impact each shard takes
       the belt slot on ITS OWN SIDE of the O — seats and slots both sorted by
       SCREEN ANGLE about the O's centre, assigned in circular order at the
       rotation that minimises the total angular error — so the cloud
       explodes outward instead of shards crossing the O to reach a slot on
       its far side. Only the beltPos REFERENCES move (the slot vectors are
       the seeded ones; the decoys keep theirs): a shard's word (termOf, keyed
       by its mesh.position), its rest attitude (beltQuat) and its drift tier
       are its own; everything else reads live positions. The slot INDEX
       (slotIx) moves with the reference, so applyTuning → seedBelt re-seeds
       the slot geometry under the live assignment (a slider touch on the
       hung belt must not reshuffle it). Revert = drop the call in breakHero
       (slotIx then stays the identity). */
    const matchSlots = () => {
      const o = toPx(heroGroup.position, bowView, bowA);
      if (!o) return;
      const ox = o.x;
      const oy = o.y;
      const ang = (world) => {
        const q = toPx(world, bowView, bowB);
        return q ? Math.atan2(q.y - oy, q.x - ox) : 0;
      };
      const seatA = panels.map((p) => ang(heroWorld(p, flC)));
      const pool = panels.map((p) => p.beltPos);
      const poolIx = panels.map((p) => p.slotIx);
      const slotA = pool.map((v) => ang(flC.copy(v).applyMatrix4(globeGroup.matrixWorld)));
      const si = seatA.map((_, i) => i).sort((a, b) => seatA[a] - seatA[b]);
      const ti = slotA.map((_, j) => j).sort((a, b) => slotA[a] - slotA[b]);
      const n = si.length;
      const TAU = Math.PI * 2;
      let bestK = 0;
      let best = Infinity;
      for (let k = 0; k < n; k++) {
        let err = 0;
        for (let i = 0; i < n && err < best; i++) {
          const d = slotA[ti[(i + k) % n]] - seatA[si[i]];
          err += Math.abs(((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI);
        }
        if (err < best) {
          best = err;
          bestK = k;
        }
      }
      si.forEach((pi, i) => {
        const j = ti[(i + bestK) % n];
        panels[pi].beltPos = pool[j];
        panels[pi].slotIx = poolIx[j];
      });
    };

    /* The impact frame: the shards BECOME the O — every one on its seat,
       white-hot, the white core behind them — and the lockup is told to
       stand down (the copy hook hides it and blows the letters off).
       Parented to globeGroup from here on: the belt is where they go.
       `flash` (the authored break): white whatever the lockup's heat — a
       break with no wind-up still lands on a white impact frame. */
    const breakHero = (restSeat = false, flash = false) => {
      if (!heroIntact) return;
      heroIntact = false;
      placeHero(restSeat);
      const hs = heroGroup.scale.x;
      // The shards take over at the lockup's OWN heat: white-hot off the
      // wind-up, part-charged when a further scroll overtakes it, cold on
      // a jump — the swap frame always matches the O it replaces. The
      // authored break always flashes.
      const heat = flash ? 1 : (heroMark?.lockup?.()?.charge.k ?? 1);
      syncGroupFrame();
      syncBowView();
      matchSlots();
      panels.forEach((p) => {
        const f = p.fl;
        heroWorld(p, f.S);
        bowOf(f.S, flA.copy(p.beltPos).applyMatrix4(globeGroup.matrixWorld), f.N);
        p.mesh.position.copy(f.S).applyMatrix4(flInv);
        p.mesh.quaternion.copy(flGroupQ).multiply(heroQuat);
        p.mesh.scale.setScalar(hs);
        f.Sq.copy(p.mesh.quaternion);
        f.s0 = hs;
        f.t = 0;
        p.driftFactor = 0;
        const u = p.mesh.material.uniforms;
        gsap.killTweensOf(u.uBlueMix);
        u.uBlueMix.value = heat;
        u.uPower.value = TUNING.idlePower;
        u.uStrokeMix.value = 1;
        u.uStrokeWidthPx.value = TUNING.strokePx;
      });
      gsap.killTweensOf(heroCore.scale);
      heroCore.scale.setScalar(heroRingK);
      heroCore.visible = true;
      // Draw the replica NOW, BEFORE the DOM O is told to hide — not at the
      // next FPS-gated tick: both land in this frame's paint, and a frame
      // with neither would blink.
      renderFrame();
      heroMark?.onBreak?.();
    };

    /* Arm a flight. The tumble is a seeded number of turns about the
       shard's own drift axis, PRE-WOUND into the target (q = slerp(S, T·R(−θ),
       u)·R(θu)) so it lands exactly on T whatever θ is, and its rate rides
       the ease's slope — fastest off the break, dying into the drift. */
    const beginFlight = (mode) => {
      flightMode = mode;
      flightActive = true;
      trackBegin(mode);
      panels.forEach((p) => {
        const f = p.fl;
        f.theta = Math.max(TUNING.shatterSpin, 0) * Math.PI * 2 * (0.5 + p.drift.phase / (Math.PI * 2));
        if (mode === 'burst') {
          f.Bq.copy(p.beltQuat).multiply(flR.setFromAxisAngle(p.drift.axis, -f.theta));
          f.t0 = sceneTime;
        } else {
          f.S.copy(p.mesh.position);
          f.Sq.copy(p.mesh.quaternion);
          f.s0 = p.mesh.scale.x;
        }
        f.t = 0;
        f.done = false;
      });
    };

    /* One frame of flight (the tick, after the group's rotation lands).
       Each shard rides its bowed chord (bowOf) on its eased t:
       · burst — seat → belt slot. Seat and bow stay pinned in WORLD space
         where the O broke; the slot is the belt's own, so it rides the
         cloud's yaw and the landing is exact.
       · reform — wherever it was → seat, the break run backwards. The seat
         is LIVE (the page is usually still gliding home and the lockup
         spinning out of sight), so the bow is re-solved from it every frame,
         and a shard that has landed keeps riding it until the hand-back
         (w2: frozen, the far-first shards drifted off their spinning seats
         for the last 0.2s). */
    const stepFlight = () => {
      syncGroupFrame();
      const burst = flightMode === 'burst';
      if (!burst) {
        placeHero();
        syncBowView();
      }
      const hs = heroGroup.scale.x;
      panels.forEach((p) => {
        const f = p.fl;
        // A landed shard is the belt's again (its drift is live) — stepped
        // exactly once at t = 1, then left alone.
        if (f.done && burst) return;
        // 10-07 (w2 fix): floored at 0 — the house Turn curve (the reform's
        // ease) dips 0.13% below zero before it launches, and on a long
        // chord that, with the bow's 2u(1 − u) gone negative, walked a few
        // shards back up to 4px at the reform's start (break track). The
        // shared path stays as it is; the burst's ease never dips.
        const u = Math.max(f.t, 0);
        if (u >= 1) f.done = true;
        const bow = 2 * u * (1 - u);
        let spin = f.theta * u;
        if (burst) {
          flA.copy(f.S).applyMatrix4(flInv);
          flB.copy(f.N).applyQuaternion(flGroupQ);
          p.mesh.position.copy(flA).lerp(p.beltPos, u).addScaledVector(flB, bow);
          flQ.slerpQuaternions(f.Sq, f.Bq, u);
          p.mesh.scale.setScalar(f.s0 + (1 - f.s0) * u);
          // The belt's own drift runs under the whole flight, so the tumble
          // hands over to it with no change of speed: the ease's slope dies
          // to zero at the landing, the drift's never does. Hung, not parked.
          spin += p.drift.speedRatio * TUNING.drift * (sceneTime - f.t0);
          if (f.done) p.driftFactor = 1;
        } else {
          heroWorld(p, flC);
          bowOf(flC, flA.copy(f.S).applyMatrix4(globeGroup.matrixWorld), flB).applyQuaternion(flGroupQ);
          flC.applyMatrix4(flInv);
          p.mesh.position.copy(f.S).lerp(flC, u).addScaledVector(flB, bow);
          flT.copy(flGroupQ).multiply(heroQuat).multiply(flR.setFromAxisAngle(p.drift.axis, -f.theta));
          flQ.slerpQuaternions(f.Sq, flT, u);
          p.mesh.scale.setScalar(f.s0 + (hs - f.s0) * u);
        }
        p.mesh.quaternion.copy(flQ).multiply(flR.setFromAxisAngle(p.drift.axis, spin));
      });
    };

    // Any new beat ends a flight where it stands (the next transition tweens
    // from the live transforms) and drops the break's side clock. A break
    // cut short is remembered for exactly one transition: the S1→S2 show
    // lands it (landFlight) rather than start from shards frozen mid-air.
    let burstCut = false;
    const stopFlight = () => {
      sideTl?.kill();
      sideTl = null;
      shockRing.visible = false; // a shock cut mid-run must not hang in the air
      burstCut = flightActive && flightMode === 'burst';
      if (!flightActive) return;
      flightActive = false;
      panels.forEach((p) => gsap.killTweensOf(p.fl));
    };
    // A reader who scrolls on while the break is still settling: the
    // stragglers finish their own paths on a short beat (same Bézier, so no
    // seam), and each takes the drift on its landing frame, as it would have.
    const landFlight = (tl, dur) => {
      if (!burstCut) return;
      burstCut = false;
      const flying = panels.filter((p) => !p.fl.done);
      if (!flying.length) return;
      flying.forEach((p) => tl.to(p.fl, { t: 1, duration: dur, ease: 'power2.out' }, 0));
      flightActive = true;
      trackBegin('land');
      tl.call(() => {
        flightActive = false;
      }, null, dur + 0.05);
    };
    /* 10-07 (w2): the BREAK TRACK — ?debug only (nothing is allocated or
       computed without it). The path was tuned on an analytic model; this is
       the measurement: every rendered frame of a flight (burst, reform, a
       landFlight), each shard's SCREEN position with the live start and end
       of its chord (burst: the pinned seat → the slot riding the yaw;
       reform: where it hung → the LIVE seat), its half-size on screen and
       its eased t, plus the O's screen centre and radius. Bounded: the last
       TRACK_KEEP flights, TRACK_FRAMES frames each. The bench publishes it
       (window.__swmProcessTrack); process-probe --walk --break reads it. */
    const TRACK_FRAMES = 420;
    const TRACK_KEEP = 4;
    const TRACK_PER = 8; // x, y, start x, y, end x, y, half-size px, eased t
    const TRACK_STRIDE = 4 + panels.length * TRACK_PER; // + ms since the flight began, O cx, cy, r
    const track = DEBUG ? [] : null;
    let trackRec = null;
    const trackBegin = (mode) => {
      if (!track) return;
      trackRec = { mode, t0: performance.now(), n: 0, buf: new Float32Array(TRACK_FRAMES * TRACK_STRIDE) };
      track.push(trackRec);
      if (track.length > TRACK_KEEP) track.shift();
    };
    const trkW = new THREE.Vector3();
    const trkPx = { x: 0, y: 0, depth: 0, perPx: 0 };
    const trackFrame = () => {
      const r = trackRec;
      if (!r || r.n >= TRACK_FRAMES) return;
      const view = screenView(); // 10-07 (final review): the one helper
      globeGroup.updateMatrixWorld();
      const b = r.buf;
      const o = r.n * TRACK_STRIDE;
      const put = (k, world, sized) => {
        const q = toPx(world, view, trkPx);
        b[k] = q ? q.x : NaN;
        b[k + 1] = q ? q.y : NaN;
        return q ? sized / q.perPx : NaN;
      };
      b[o] = performance.now() - r.t0;
      b[o + 3] = put(o + 1, heroGroup.position, heroGroup.scale.x * RADIUS);
      const burst = r.mode !== 'reform';
      panels.forEach((p, i) => {
        const k = o + 4 + i * TRACK_PER;
        const f = p.fl;
        trkW.copy(p.mesh.position).applyMatrix4(globeGroup.matrixWorld);
        b[k + 6] = put(k, trkW, (p.boundRadius || 0.2) * p.mesh.scale.x);
        put(k + 2, burst ? f.S : trkW.copy(f.S).applyMatrix4(globeGroup.matrixWorld), 0);
        put(k + 4, burst ? trkW.copy(p.beltPos).applyMatrix4(globeGroup.matrixWorld) : heroWorld(p, trkW), 0);
        b[k + 7] = f.t;
      });
      r.n += 1;
    };
    const getFlightTrack = () =>
      track
        ? track.map((r) => ({
            mode: r.mode, t0: r.t0, frames: r.n, shards: panels.length, per: TRACK_PER, stride: TRACK_STRIDE,
            data: Array.from(r.buf.subarray(0, r.n * TRACK_STRIDE)),
          }))
        : null;

    // Whatever interrupts a break inherits a clean field: hot shards cool on
    // a short beat and the white core folds away.
    const coolHero = () => {
      panels.forEach((p) => {
        const mix = p.mesh.material.uniforms.uBlueMix;
        if (mix.value > 1e-3) gsap.to(mix, { value: 0, duration: 0.3, ease: 'power2.out', overwrite: true });
      });
      // 10-07 (final review): the decoy flood's heat too — killed first, a
      // break cut inside its first 0.06s has not lit it yet.
      const decoyHeat = decoyMaterial.uniforms.uBlueMix;
      gsap.killTweensOf(decoyHeat);
      if (decoyHeat.value > 1e-3) gsap.to(decoyHeat, { value: 0, duration: 0.3, ease: 'power2.out' });
      if (heroCore.visible) {
        gsap.to(heroCore.scale, {
          x: 0.001,
          y: 0.001,
          z: 0.001,
          duration: 0.2,
          ease: 'power2.in',
          overwrite: true,
          onComplete: () => {
            heroCore.visible = false;
          },
        });
      }
    };

    /* The decoy flood ARRIVES on the inverse of its S1→S2 cull (Nathan:
       "the inverse of the additional fragments … in tandem with slight
       offsets as the starting O globe deconstructs"): the falling cohort is
       thrown UP from below the frame and decelerates into its slot — the
       fall run backwards, its apex the suspension — and the flicker cohort
       runs its stutter backwards. Same cohorts, same seeded jitter.
       10-07 (final review): every kill at BUILD time. The opening call used
       to kill them itself — a gsap.killTweensOf inside a timeline's own
       .call() takes that timeline's LATER tweens of the target — so every
       rise below died with it and the flood never arrived (each decoy sat
       at s 0 through the hang; the dark flecks the films showed were the
       84 shards cooling). `cool` (the break): the flood is WHITE-HOT with
       the burst and cools to navy on the shards' own clock — one uniform
       for the whole InstancedMesh, so it reads as staggered white flecks
       with the O's own shards (their offsets are the seeded starts), and
       lands before the chips: the palette never shares the heat. */
    const decoysArrive = (tl, at, window, cool = 0) => {
      const fallDist = TUNING.scatter * 3.2;
      const heat = decoyMaterial.uniforms.uBlueMix;
      decoys.forEach((d) => {
        gsap.killTweensOf(d);
        gsap.killTweensOf(d.pos);
      });
      gsap.killTweensOf(heat);
      tl.call(() => {
        decoys.forEach((d, i) => {
          d.pos.copy(d.beltPos);
          if (i % 2 === 1) {
            d.pos.y -= fallDist;
            d.pos.x += Math.sin(d.phase) * 0.45;
          }
          d.s = 0;
        });
        composeDecoys();
        decoyMesh.visible = true;
      }, null, at);
      if (cool > 0) {
        tl.fromTo(heat, { value: 1 }, { value: 0, duration: cool, ease: 'sine.inOut', immediateRender: false }, at);
      }
      decoys.forEach((d, i) => {
        const frac = d.phase / (Math.PI * 2);
        const start = at + frac * window;
        if (i % 2 === 1) {
          tl.to(d.pos, { x: d.beltPos.x, y: d.beltPos.y, duration: 1.0 + frac * 0.4, ease: 'power2.out' }, start);
          // Grows in on the way up: invisible below a wide frame, but a
          // phone's taller frustum would otherwise show it pop at the floor.
          tl.to(d, { s: 1, duration: 0.3, ease: 'power2.out' }, start);
        } else {
          // The stutter lands on the house decel: a linear last step would
          // stop dead in its slot.
          tl.to(
            d,
            {
              keyframes: [
                { s: 0.7, duration: 0.18, ease: 'power2.out' },
                { s: 0.3, duration: 0.1 },
                { s: 0.85, duration: 0.12 },
                { s: 0.45, duration: 0.1 },
                { s: 1, duration: 0.3, ease: 'power3.out' },
              ],
              ease: 'none',
            },
            start
          );
        }
      });
    };

    // 08-28 (Nathan): the /work resize doctrine — the buffer tracks the
    // window instantly (no stretched frames), the CAMERA re-evaluation
    // (aspect + the contain-fit framing) TRAILS on a retargeted ease
    // (?camlag — the TouchDesigner lag), and the old mid-transition skip
    // now CATCHES UP on settle instead of holding stale framing until the
    // next stage change.
    let viewW = 0;
    let viewH = 0;
    const camLag = { aspect: 1, z: 0, x: 0, y: 0 };
    let camSeeded = false;
    const applyCamLag = () => {
      // Aspect has no other owner — apply it even mid-transition (holding it
      // stale renders the whole show anamorphic on a resized buffer). The
      // POSITION framing is the transitions' property: defer while one runs;
      // settle catches up.
      camera.aspect = camLag.aspect;
      camera.updateProjectionMatrix();
      if (!activeTl) {
        // The S1 tour is the sole writer of camera.position while it runs
        // (it composes camLag.z × its own station fraction, per frame) — a
        // resize retargets the BASE and the tick re-derives from it.
        if (!tourActive) camera.position.z = camLag.z;
        globeGroup.position.x = camLag.x;
        globeGroup.position.y = camLag.y;
      }
      if (PREFERS_REDUCED_MOTION) {
        updateThread();
        renderFrame();
      }
    };
    const retargetCam = () => {
      // Re-sync the shadow state from the LIVE rig first — transitions,
      // applyPose and the tune bench write the camera directly between
      // resizes; tweening from stale shadow values would snap the camera
      // backward on the first onUpdate.
      camLag.aspect = camera.aspect;
      // Mid-tour, camera.position is a subject-tracking solution, not the
      // contain fit — reading it back would fold a close-up's distance into
      // the base and walk the establishing framing in a little every resize.
      if (!tourActive) camLag.z = camera.position.z;
      camLag.x = globeGroup.position.x;
      camLag.y = globeGroup.position.y;
      const { z, offsetX, offsetY } = framingFor(getPose(stage ?? 'stage-01'));
      const aspect = (container.clientWidth || 1) / (container.clientHeight || 1);
      if (PREFERS_REDUCED_MOTION) {
        // RM doctrine: single frames only — stamp, render once, done.
        camLag.aspect = aspect;
        camLag.z = z;
        camLag.x = offsetX;
        camLag.y = offsetY;
        applyCamLag();
        return;
      }
      gsap.to(camLag, {
        aspect,
        z,
        x: offsetX,
        y: offsetY,
        duration: Math.max(0.01, CAM_LAG_S),
        ease: 'power3.out',
        overwrite: true,
        onUpdate: applyCamLag,
      });
    };
    const settleReframe = settleDebounce(
      () => {
        if (activeTl) {
          settleReframe(); // still transitioning — re-arm, land after
          return;
        }
        forgetCards(); // 10-07 (w4): the phone lift re-measures its card at the settled size
        retargetCam();
      },
      { settleMs: 300, maxWaitMs: 2000 }
    );
    // 10-07 (w4): the card's height is the webfont's — re-measure when it
    // lands and re-frame a resting Core onto it.
    document.fonts?.ready.then(() => {
      if (disposed) return;
      forgetCards();
      settleReframe();
    });
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      if (w === viewW && h === viewH) return; // re-stamping clears the buffer
      viewW = w;
      viewH = h;
      forgetCards(); // 10-07 (w4): a new size moves every card (the settle re-measures again)
      renderer.setSize(w, h, false);
      threadMaterial.resolution.set(w, h); // Line2 screen-width lines need it
      shockMaterial.resolution.set(w, h);
      if (!camSeeded) {
        camSeeded = true;
        const { z, offsetX, offsetY } = framingFor(getPose(stage ?? 'stage-01'));
        camLag.aspect = w / h;
        camLag.z = z;
        camLag.x = offsetX;
        camLag.y = offsetY;
        applyCamLag();
        return;
      }
      retargetCam();
      settleReframe();
    };

    /* — The DISCOVERY tour (09-09, reworked round 2 for INTENT). Stage-01
       used to hold one establishing frame while the belt turned; the camera
       travels it now.

       Round 1 flew to seeded points in space, which moved well but framed
       nothing in particular — Nathan's note: "some of the camera angles zoom
       in, and it's not really zooming in on anything." A camera move has to
       be about a subject. So a station is no longer a position: it is a
       SHARD — preferring one that is currently carrying an annotation chip,
       because that is the thing the page is asking you to read — plus the
       SEAT it should occupy in frame and how close to stand.

       That makes each leg a real tracking shot. The subject's world position
       is read live every frame and the camera solves for the position that
       puts it on its seat, so as the cloud turns the camera follows it
       rather than letting it drift out of a fixed frame. A leg tweens a
       single 0→1 blend between the PREVIOUS station's solution and the
       NEXT's, both evaluated live, so the move tracks both subjects on the
       way across and settles into holding the new one.

       Seats are thirds, never the centre, and they are chosen to respect the
       copy: on desktop the column owns the left, so subjects sit right of
       centre; on a phone the copy is bottom-anchored, so they sit high. The
       first station of every cycle is the establishing wide — you are shown
       the whole field before being taken into it.

       Ownership: while the tour runs it is the only writer of
       camera.position; any goTo kills it and the transition tweens the
       camera home from wherever the path left it — never a cut. The camera
       never ROTATES, so every projection in this file (the label placement,
       discPx, the contain fit) keeps its "looks down −Z from (x, y, z)"
       assumption intact. — */
    const SEATS_DESKTOP = [
      { u: 0.34, v: 0.22 },
      { u: 0.3, v: -0.26 },
      { u: 0.42, v: -0.04 },
      { u: 0.22, v: 0.3 },
      { u: 0.38, v: 0.08 },
    ];
    const SEATS_MOBILE = [
      { u: 0.24, v: 0.34 },
      { u: -0.22, v: 0.3 },
      { u: 0.04, v: 0.42 },
      { u: -0.26, v: 0.2 },
      { u: 0.26, v: 0.24 },
    ];
    const tourSeats = () => (IS_MOBILE ? SEATS_MOBILE : SEATS_DESKTOP);
    const TOUR_SUBJECT_FACING = 0.75; // normal·view-axis floor for a station's subject (≈41° of square — a slow tumble over the leg cannot take it under the chip's 0.4 bind floor)
    /* 10-07 (w3, tour glance/linger): every leg used to be ?tourtravel +
       ?tourhold (3.4 + 2.6s) — a 6.0s metronome the eye stops following by
       the third stop. Each leg is now a GLANCE (both × ?tourglance, half the
       chips) or a LINGER (travel × 1.12, hold × 1.23 ≈ 3.8 + 3.2s, every
       chip), drawn ≈50/50 from the tour's own seeded PRNG (its own seed, as
       the break's is: drawing from the belt's would reshuffle the slots),
       never three of a kind in a row. A linger's 7s shot outlasts the ~6s
       the subject filter was tuned for, so it takes only the slower half of
       the slow tier (TOUR_LINGER.speed); an empty pool retries at the
       standing 1.2 and the leg drops to a glance. ?tourglance 1 = today
       (every leg even, all chips). */
    const TOUR_LINGER = { travel: 1.12, hold: 1.23, speed: 0.8 };
    const TOUR_SPEED_MAX = 1.2; // a subject's drift.speedRatio ceiling (no fast spinner)
    const tourRand = mulberry32(hashSeed('process-tour'));
    let tourKind = 'wide'; // the leg being flown: wide | glance | linger | even (?tourglance 1)
    let tourKindRun = 0; // how many legs in a row have been tourKind
    let tourSeatCursor = 0;
    let tourLegCount = 0;
    const tourFrom = { wide: true, panel: null, u: 0, v: 0, k: 1 };
    const tourTo = { wide: true, panel: null, u: 0, v: 0, k: 1 };
    const tourBlend = { t: 1 };
    // The chips' clock (09-10): true while the camera holds a station, false
    // on the road between two. releaseLabel refuses to rebind on the road.
    let atStation = true;
    let stationAt = 0; // performance.now() of the last arrival — the fill window (holdWide sets it ahead)
    const STATION_FILL_MS = 1200; // late fills only this long after arrival, so the set reads as one entrance
    /* 10-09 (w9b, more-chips): the arrival's staggers (0.28 s on the opening
       wide, 0.14 s at a leg's arrival) were tuned for 4 chips. With N the set
       still enters as ONE beat: each stagger is capped so N of them span
       FILL_SPAN (≈1.4 s — bound 1.2–1.6 s after arrival, never one frame);
       up to N = 5 (wide) / 10 (a station) nothing changes. The late-fill
       window (stationFill) stretches to the last chip's first try + one
       retry when that runs past STATION_FILL_MS, so the last one's miss
       still belongs to the entrance (holdWide's fix, for every station). */
    const FILL_SPAN = 1.4;
    const fillStagger = (base) => Math.min(base, FILL_SPAN / Math.max(labelSlots.length, 1));
    let stationFill = STATION_FILL_MS;
    /** True while the tour holds a shot: chips are persistent, no yields. */
    const heldStation = () => tourActive && atStation;
    const tourCamA = new THREE.Vector3();
    const tourCamB = new THREE.Vector3();
    const tourSubject = new THREE.Vector3();
    /* The S1→S2 hand-off (Nathan 09-10): the connect show opens TIGHT on the
       Thread's first bead — a station like any tour stop, solved live so the
       yawing cloud cannot walk the bead out from under the lens — eases back
       a little as the trace runs (?threaddrift), and only pulls fully wide
       WITH the assembly, so the Core's arrival is the reveal. */
    const threadSt = { panel: null, k: 1, coreZ: 1 };
    const threadCam = { t: 0 };
    const threadCamFrom = new THREE.Vector3();
    let threadCamActive = false;
    /* The connect camera: dead on the first bead (x/y), at ?threadtight × the
       CORE's rest distance — not the tour's subject-relative dolly, because
       the point is to sit CLOSER than where the assembly will leave the lens,
       so the pull-back is real. Floored at the cloud's near face (a smaller
       margin than the tour's: this lens holds still) and at half a unit in
       front of the bead itself. */
    const threadCamSolve = (out) => {
      tourSubject.copy(threadSt.panel.mesh.position);
      globeGroup.localToWorld(tourSubject);
      const floor = TUNING.scatter * 1.15 * 1.12 + 0.25;
      const z = Math.max(threadSt.k * threadSt.coreZ, tourSubject.z + 0.5, floor);
      return out.set(tourSubject.x, tourSubject.y, z);
    };

    /** The shard the camera is currently framing — the label picker gives it
     *  a chip first, so the framed subject is the one that gets named. */
    const tourSubjectPanel = () =>
      tourActive && !tourTo.wide && tourBlend.t > 0.5 ? tourTo.panel : null;

    /* Solve the camera position that seats `st`'s subject at (u, v) in NDC,
       `dist` in front of it. The floor keeps the lens outside the cloud's
       near face — a subject that has rotated to the far side would otherwise
       pull the camera in among the shards (or behind them). Framing survives
       the clamp because the seat is solved from the RESULTING depth. */
    const stationCam = (st, out) => {
      const baseZ = camLag.z;
      if (!st || st.wide || !st.panel) return out.set(0, 0, baseZ);
      tourSubject.copy(st.panel.mesh.position);
      globeGroup.localToWorld(tourSubject);
      const floor = TUNING.scatter * 1.15 * 1.12 + 0.6;
      const z = Math.max(tourSubject.z + st.k * baseZ, floor);
      const depth = z - tourSubject.z;
      const tanV = TAN_V;
      const tanH = tanV * (camera.aspect || 1);
      return out.set(
        tourSubject.x - st.u * depth * tanH,
        tourSubject.y - st.v * depth * tanV,
        z
      );
    };

    /* Choose the next station: always a close-up. The establishing wide
       used to return every ?tourstops-th leg as the breath between shots;
       Nathan (09-10) cut it — the pull-back is saved for S2's assembly so
       the Core arrives as a reveal — and its slot in the cycle is just
       another tracked subject on the next unused seat. */
    // 10-07 (w3): `maxSpeed` is the subject's drift.speedRatio ceiling — a
    // linger asks for TOUR_LINGER.speed (its 7s shot needs the slowest
    // tumblers), everything else the standing 1.2. Returns whether the pick
    // met that ceiling: false when the slow pool was empty and the subject
    // came from the 1.2 retry (or the any-free-shard fallback), so the
    // caller can drop the leg to a glance.
    const nextStation = (st, maxSpeed = TOUR_SPEED_MAX) => {
      tourLegCount += 1;
      refreshLabelMatrices();
      /* The subject is chosen for NOVELTY (Nathan, 09-10): each stop has to
         put NEW shards in frame, or the stops read as the same shot nudged
         and their chips repeat. So the pool is every free, front-facing
         shard — not just what the current frame holds — and each candidate
         is scored by how far its station would MOVE the camera, in
         half-frame widths at that station's depth. Anything clearing
         ?tourshift is fair game; if nothing does, the farthest few are. */
      const seats = tourSeats();
      const seat = seats[tourSeatCursor % seats.length];
      tourSeatCursor += 1;
      const spread = Math.max(TUNING.tourReach, 0) / 0.34; // the bake IS 1×
      const probe = {
        wide: false,
        panel: null,
        u: seat.u * spread,
        v: seat.v * spread,
        k: TUNING.tourNear + Math.random() * Math.max(TUNING.tourFar - TUNING.tourNear, 0),
      };
      const tanH = TAN_V * (camera.aspect || 1);
      const scoreAt = (ceil) => {
        const out = [];
        for (const p of panels) {
          if (p.driftFactor <= 0.5 || p === tourTo.panel) continue;
          // 10-07 (w5 fix): never a shard the S1 pool cannot name (labelPool
          // holds out a spec word's shard) — the framed shard would go
          // unnamed, the worse failure pickTarget's subject rule exists for.
          if (specHeld(p.mesh.position)) continue;
          // A subject has to STAY a subject: it is framed for travel + hold
          // (~6s), so no fast spinner (the tier turns away mid-shot), and it
          // must face the camera squarely now so a slow tumble cannot take it
          // past the chip's front-facing floor before the hold ends.
          if (p.drift.speedRatio > ceil) continue;
          if (labelProminence(p) < TOUR_SUBJECT_FACING) continue;
          probe.panel = p;
          stationCam(probe, tourCamB);
          const halfW = Math.max((tourCamB.z - tourSubject.z) * tanH, 0.05);
          const shift = Math.hypot(tourCamB.x - camera.position.x, tourCamB.y - camera.position.y) / halfW;
          out.push({ p, shift });
        }
        return out;
      };
      let scored = scoreAt(maxSpeed);
      let met = scored.length > 0;
      if (!met && maxSpeed < TOUR_SPEED_MAX) scored = scoreAt(TOUR_SPEED_MAX);
      if (!scored.length) {
        // Nothing squarely facing and slow this beat — rather than fall back
        // to the wide, take any free shard: the camera keeps moving in close.
        for (const p of panels) {
          if (p.driftFactor <= 0.5 || p === tourTo.panel || specHeld(p.mesh.position)) continue;
          probe.panel = p;
          stationCam(probe, tourCamB);
          const halfW = Math.max((tourCamB.z - tourSubject.z) * tanH, 0.05);
          scored.push({ p, shift: Math.hypot(tourCamB.x - camera.position.x, tourCamB.y - camera.position.y) / halfW });
        }
        if (!scored.length) {
          st.wide = true; // an empty belt (tuning edge) — nothing to frame
          st.panel = null;
          return false;
        }
      }
      const clear = scored.filter((c) => c.shift >= Math.max(TUNING.tourShift, 0));
      let pool = clear;
      if (!pool.length) {
        scored.sort((a, b) => b.shift - a.shift);
        pool = scored.slice(0, 3);
      }
      const pick = pool[Math.floor(Math.random() * pool.length)];
      st.wide = false;
      st.panel = pick.p;
      st.u = probe.u;
      st.v = probe.v;
      st.k = probe.k;
      return met;
    };

    const stopTour = () => {
      if (tourTl) {
        tourTl.kill();
        tourTl = null;
      }
      gsap.killTweensOf(tourBlend);
      tourActive = false;
      atStation = true;
      chipCap = Infinity; // off the tour, every slot may name
    };

    /* 10-07 (w3, tour glance/linger): the next leg's kind. ≈50/50 off the
       tour's own PRNG, except that a third leg in a row of one kind is never
       drawn — the eye has to keep being surprised. */
    const pickLegKind = () => {
      if (tourKindRun >= 2 && (tourKind === 'glance' || tourKind === 'linger')) {
        return tourKind === 'glance' ? 'linger' : 'glance';
      }
      return tourRand() < 0.5 ? 'glance' : 'linger';
    };

    const tourLeg = () => {
      if (disposed || !tourActive) return;
      // The station just held becomes the one we travel FROM, so the blend
      // always crosses between two live solutions.
      tourFrom.wide = tourTo.wide;
      tourFrom.panel = tourTo.panel;
      tourFrom.u = tourTo.u;
      tourFrom.v = tourTo.v;
      tourFrom.k = tourTo.k;
      // 10-07 (w3): a GLANCE or a LINGER (pickLegKind). ?tourglance ≥ 1 is
      // the old even metronome exactly — every leg ?tourtravel + ?tourhold,
      // every chip. A drawn linger whose slow pool is empty drops to a
      // glance; a FORCED one (two glances behind it) keeps its length on the
      // 1.2 subject — a third glance would break the rule outright, a chip
      // whose shard turns away early fades on its own facing floor.
      const glance = Math.max(TUNING.tourGlance, 0.1);
      const even = glance >= 0.999;
      let kind = even ? 'even' : pickLegKind();
      const forced = !even && tourKindRun >= 2 && (tourKind === 'glance' || tourKind === 'linger');
      const met = nextStation(tourTo, kind === 'linger' ? TOUR_LINGER.speed : TOUR_SPEED_MAX);
      if (kind === 'linger' && !met && !forced) kind = 'glance';
      tourKindRun = kind === tourKind ? tourKindRun + 1 : 1;
      tourKind = kind;
      const travelK = kind === 'glance' ? glance : kind === 'linger' ? TOUR_LINGER.travel : 1;
      const holdK = kind === 'glance' ? glance : kind === 'linger' ? TOUR_LINGER.hold : 1;
      // A glance names HALF the slots (rounded up) — the arrival fill and
      // every rebind honour chipCap; the lingers and the even tour all.
      chipCap = kind === 'glance' ? Math.ceil(labelSlots.length / 2) : Infinity;
      tourBlend.t = 0;
      // Leaving the shot: every chip lets go, and none rebinds on the road.
      atStation = false;
      clearLabels();
      const travel = Math.max(TUNING.tourTravel, 0.1) * travelK;
      tourLegTravel = travel;
      tourTl?.kill();
      tourTl = gsap
        .timeline({ onComplete: tourLeg })
        // The glide, on the house Turn curve.
        .to(tourBlend, {
          t: 1,
          duration: travel,
          ease: turnEase,
          // Arriving: the Turn curve is steep early and long in the settle,
          // so the framing has all but landed well before the tween ends.
          // The chips cut in on the BLEND, not the clock — as the shot
          // lands, not after it.
          onUpdate: () => {
            if (atStation || tourBlend.t < 0.9) return;
            atStation = true;
            stationAt = performance.now();
            benchArrive(tourKind); // 10-09 (w9b, ?debug)
            stationFill = STATION_FILL_MS;
            if (labelsActive) stationFill = Math.max(STATION_FILL_MS, fillLabels(0, fillStagger(0.14)) * 1000 + 350); // 10-09 (w9b): N chips, one entrance
          },
        })
        // The hold — t stays at 1 while the camera keeps TRACKING the
        // subject, which is what makes a rest read as a held shot rather
        // than a frozen one.
        .to(tourBlend, { t: 1, duration: Math.max(TUNING.tourHold, 0) * holdK });
    };

    const startTour = () => {
      if (PREFERS_REDUCED_MOTION || disposed || tourActive) return;
      if (TUNING.tour === 'off' || TUNING.tour === '0') return;
      // Callers only reach here with the camera resting on the belt's
      // establishing frame (an applyPose, a transition that just landed, the
      // break out of the globe-O). camLag may be carrying another stage's framing
      // if a resize landed there — the tour's base is the belt's contain fit,
      // so restate it.
      camLag.z = framingFor(getPose('stage-01')).z;
      tourActive = true;
      tourLegCount = 0;
      tourKind = 'wide';
      tourKindRun = 0;
      chipCap = Infinity; // the wide names every slot
      tourTo.wide = true;
      tourTo.panel = null;
      tourBlend.t = 1;
      // The wide is a station too: hold it (the arrival's chips get their
      // beat) before the first leg pushes in.
      atStation = true;
      stationAt = performance.now();
      stationFill = STATION_FILL_MS; // 10-09 (w9b): holdWide opens the wide's window at its last chip
      benchArrive('wide'); // 10-09 (w9b, ?debug)
      tourLegTravel = 0;
      tourTl?.kill();
      tourTl = gsap
        .timeline({ onComplete: tourLeg })
        .to(tourBlend, { t: 1, duration: Math.max(TUNING.tourHold, 0) });
    };

    /* 10-07 (w3, opening-wide-beat): the wide holds until its chips have
       TYPED IN. startTour's ?tourhold (2.6s) is counted from the tour's
       start, but the chips start later (the break's T×0.73, a landing
       transition's 0.15s) and the last one types in a stagger after that —
       so the first push-in used to cut across the arrival, the wide's own
       chips leaving as they finished typing. `lead` is startLabels' return,
       the last chip's offset from NOW: the wide re-arms to lead + one chip's
       type-in (?labelchar × 16 letters) + the full ?tourhold, the arrival
       window restarting with it. Only on the WIDE, only while the tour is
       live; startLabels' 0 (reduced motion, already live, no slots) is a
       no-op, so the plain ?tourhold stands. */
    const holdWide = (lead) => {
      if (!(lead > 0) || !tourActive || !tourTo.wide) return;
      // 10-07 (w3 fix): the arrival window opens at the LAST chip's first
      // try, not now — four slots stagger out to ~1.1–1.6s, past
      // STATION_FILL_MS, so the last one's miss used to get no retry.
      stationAt = performance.now() + lead * 1000;
      tourLegTravel = 0;
      tourTl?.kill();
      tourTl = gsap
        .timeline({ onComplete: tourLeg })
        .to(tourBlend, { t: 1, duration: lead + CHIP_TYPE_IN_S() + Math.max(TUNING.tourHold, 0) });
    };

    /* 10-07 (w6) — S5's live state, OUTSIDE loopTl: a rebuild (applyTuning,
       a tap cue) starts the loop from time 0, and the readout continues
       (p.03 → p.04) instead of restarting at p.01. Leaving S5 resets it
       (s5Reset — goTo / setStageInstant onto any other stage).
       · s5Phase — count_in (the lights-down + the held beat) · drop (the
         unison hit, pass 1 not yet risen) · groove (the cycle) · cue (a tap's
         ripple pass) · null off S5. getStats().s5 reads it.
       · s5Pass — passes since this S5 rest began (1 = the first after the
         drop, which keeps the LIVE readout); s5Chapter — the brand-book page
         on the readout (-1 = the live readout).
       · loopOrigin — the beat grid's zero on loopTl (the drop, else 0): the
         ● blinks on it and a tap cue quantises to it.
       · lastPattern — the pattern of the pass in flight; a cue resumes the
         cycle AFTER it. */
    let s5Phase = null;
    let s5Pass = 0;
    let s5Chapter = -1;
    let s5Tail = null; // the readout's text (written, or scrambling toward) — dedupe
    let loopOrigin = 0;
    let lastPattern = null;
    let s5DropT = null; // performance.now() the scheduled drop lands (the bench's clock)
    let s5BuildT = null; // performance.now() the S4→S5 intro transition was built (the copy's cue)
    let cueDc = null; // a tap cue waiting for its beat
    let cuePending = null; // …its panel (taps are ignored while one waits)
    let cueLog = []; // ?debug: this S5 rest's cues — { id, at (tap), fired }
    const S5_COPY = STAGES.find((st) => st.id === 'stage-05') ?? {};
    const S5_CHAPTERS = S5_COPY.chapters ?? [];
    const S5_CYCLE = ['rows', 'equator', 'ripple', 'checker', 'random'];
    const s5Names = () => (TUNING.pattern === 'cycle' ? S5_CYCLE : [TUNING.pattern]);
    // the copy deck's captions, {bpm} filled at fire time ('live_123_bpm')
    const s5Caption = (i) =>
      (S5_COPY.captions?.[i] ?? '').replace('{bpm}', String(Math.round(TUNING.bpm)));
    const pad2 = (n) => String(n).padStart(2, '0');
    // The ●: a colour swap on the beat grid (.is-on), never opacity.
    const s5Lamp = (on) => {
      stageEl('stage-05', '.process-stage__beat')?.classList.toggle('is-on', on);
    };

    /* 10-07 (w7): THE S5 GRID, one place — seconds from loop time `now` to
       the next beat on the loop's grid (zero at loopOrigin; the ● blinks on
       it). The tap cue quantises to it (scheduleCue) and the CTA's resolve
       lands on it (goTo reads it before stopLoops kills the loop). Always
       ahead: a press exactly on a beat waits for the next one. */
    const nextBeatIn = (now) => {
      const beat = 60 / TUNING.bpm;
      const k = Math.floor((now - loopOrigin) / beat + 1e-6) + 1;
      return Math.max(loopOrigin + k * beat - now, 0);
    };

    const stopLoops = (keepInk = false) => {
      loopTl?.kill();
      loopTl = null;
      // Restore the belt/S2 ink: black stroke, color tweens dead. The
      // caller's transition owns easing uStrokeMix to its pose value.
      // 10-07 (w5): UNCONDITIONALLY — S5's rhythm sets the brown-blue ink,
      // and a loop that never built (a hidden tab) must not strand it on the
      // next stage. (10-08 (w8): the S4 heartbeat no longer inks — it dips
      // uPower, and every way out of S4 takes power to its pose.)
      // 10-07 (w7 fix): …except `keepInk` — the authored S5→CTA step holds
      // S5's ink through its beat wait (a black lattice for up to a beat
      // before the resolve); the CTA's timeline puts the black back once the
      // resolve has taken the ink out (buildTransition, ctaArrive).
      panels.forEach((p) => {
        gsap.killTweensOf(p.mesh.material.uniforms.uStrokeColor.value);
        if (!keepInk) p.mesh.material.uniforms.uStrokeColor.value.copy(strokeColor);
      });
      // 10-07 (w6): a cue waiting on its beat dies with the loop it would
      // have rebuilt, and the ● goes dark (its blink child died with loopTl;
      // reduced motion's still keeps it lit — there is no loop to stop).
      cueDc?.kill();
      cueDc = null;
      cuePending = null;
      // 10-08 (w8): a page chip's second look dies with its loop too
      pageDc?.kill();
      pageDc = null;
      if (!PREFERS_REDUCED_MOTION) s5Lamp(false);
    };

    /* 10-07 (w6, s5-chapters): THE S5 READOUT — `● p.0N/05 <this> → <next>`.
       The counter is a plain write; ONLY the tail scrambles (fireCaption's
       per-element writer), and only when its text changes — the line never
       re-scrambles whole. The ● wears `fill` (a chapter's remembered S3 spec
       fill, else pool[0]) and takes the white keyline when that fill sinks
       into the field (beatKeyed). If the whole line would WRAP, the tail
       drops its '→ next' (the worst case, '● p.04/05 layout_sensibility →
       brand_components', 46 characters, measured 10-07: 289px desktop, 316px
       of the 358px a 390 phone gives it — it fits; a phone under ~350px
       drops the tail). */
    // The caption shrink-wraps its text (a flex item on flex-start), so the
    // measure is its SECTION's content box — the widest the line may get.
    const s5Fits = (line) => {
      const p = stageEl('stage-05', '.process-stage__caption');
      const box = p?.parentElement;
      if (!p || !box) return true;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (!(avail > 0)) return true;
      /* 10-07 (w7): measured inside a ZERO-SIZE clip box — the bare nowrap
         span (up to ~320px past a phone caption's left edge) widened the
         page's scrollable overflow for the frame it lived, and a phone at
         the document end lost ~500px of scroll to the clamp on every page
         turn (S5's loop kept paging under the CTA). The run's width is the
         same; the layout never sees it. */
      const m = document.createElement('span');
      m.style.cssText =
        'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
      const run = document.createElement('span');
      run.style.whiteSpace = 'nowrap';
      run.textContent = line;
      m.appendChild(run);
      p.appendChild(m);
      const w = run.getBoundingClientRect().width;
      m.remove();
      return w <= avail + 0.5;
    };
    const s5Counter = () =>
      s5Chapter < 0 || !S5_CHAPTERS.length ? '' : `p.${pad2(s5Chapter + 1)}/${pad2(S5_CHAPTERS.length)}`;
    // 10-07 (final review): the WORD's colour (specFillOf), not its latest
    // seat's — the ● matches the chip the visitor saw on every visit.
    const s5Fill = () => {
      const word = s5Chapter < 0 ? null : S5_CHAPTERS[s5Chapter];
      return (word ? specFillOf.get(word.toUpperCase()) : undefined) ?? chipColors[0] ?? null;
    };
    const s5Readout = (tail, short = tail) => {
      const counter = s5Counter();
      const counterEl = stageEl('stage-05', '.process-stage__counter');
      if (counterEl && counterEl.textContent !== counter) counterEl.textContent = counter;
      const beatEl = stageEl('stage-05', '.process-stage__beat');
      const fill = s5Fill();
      if (beatEl && fill) {
        beatEl.style.setProperty('--beat-color', fill);
        beatEl.toggleAttribute('data-key', beatKeyed(fill));
      }
      const text = short !== tail && !s5Fits(`● ${counter} ${tail}`) ? short : tail;
      if (text === s5Tail) return;
      s5Tail = text;
      fireCaption('stage-05', text);
    };
    // The page the readout is on, as it stands (pass 1: the live tempo).
    const s5Show = () => {
      if (s5Chapter < 0) {
        s5Readout(s5Caption(1));
        return;
      }
      const cur = S5_CHAPTERS[s5Chapter];
      const next = S5_CHAPTERS[(s5Chapter + 1) % S5_CHAPTERS.length];
      s5Readout(`${cur} → ${next}`, cur);
    };
    /* 10-08 (w8, s5-pages-on-the-world): THE PAGE TURNS ON THE WORLD — the
       fifth chip family. S5's meaning (the brand book coming alive) lived
       only in the ~11px readout, and its first page came 6.0s in; now every
       page turn seats the chapter's word as an in-scene chip:
       · AT THE PASS HEAD (pageTurn, from s5OnPass — the intro's pass 1 at
         the live hold's release instead, with the readout), on a front-facing shard
         near where that pass's light starts: candidates rank by their first
         hit in the pass (patternHits — the rows' top row, the equator, the
         ripple's origin, the checker's first parity, the random order's
         head) and the first whose seat passes chipFits strict AND the exact
         cover (the emanated world's shards are not drift occluders) AND
         holds for its whole page as the world turns (pageHolds) takes it,
         either side of its shard. No readable seat: one more look a beat
         on (pageDc), then the page goes without a chip — the readout still
         pages.
       · Its word keeps ONE colour, the S3 chip's (specFillOf); a chapter S3
         never showed (brand_components, or a word ?s3notes left out) is
         dealt the next pool colour once, at its first turn, and remembered —
         the ● reads the same map, so chip, ● and S3 chip agree.
       · A shard keeps its word: never one S1 named (termOf), the CTA's
         (contact.held) or another word's (specOf); the seat is recorded
         (specOf / specSeat), so S1 and the CTA hold it out after.
       · Types in on the house char cut and the fill's wipe, holds, and
         leaves on the house exit (letters out, the fill retracting into its
         leader) at pageEnd: whole beats before the next pass head (pageLead
         — the longest chapter's exit, on the beat grid), so it is gone
         before the next page's chip arrives. One page chip at a time: a
         turn that finds the last one still up (a rebuild cut its exit
         short) retracts it at once.
       · The tap cue's ripple pass KEEPS the page's chip (the cue keeps its
         page: the counter stays, the tail reads cue_ripple) — the one-shot
         carries its own pageEnd, so the chip leaves before the resumed
         cycle turns the page.
       · Leaves with leaveLabels (the driver's commit off S5 either way, and
         every transition; the CTA's resolve therefore starts with the chip
         already cutting out, long before first_contact types in), stops
         with stopLabels; a hidden tab holds it (the loop's own calls; pageDc
         in syncTicker); applyTuning's rebuild turns a fresh page (the old
         chip retracts); reduced motion has no slots, so no chapter chip (RM
         chips are Nathan's call). ?s5chip off = no chips (the readout pages
         alone, as before). */
    const PAGE_TRIES = 2; // looks per page: the head, then one beat on
    const PAGE_CANDS = 24; // the earliest-lit shards tried (the light's start, not the whole world)
    const PAGE_LIVE_READ_S = 1.0; // live_123_bpm reads at least this long once its scramble lands
    let pageLog = []; // ?debug: this S5 rest's page chips — { p, term, at (performance.now ms), id | null, hit, fill }
    let s5LiveHold = false; // the intro's pass 1: p.01 waits for live_123_bpm to be read (buildS5Loop)
    const PAGE_EXIT_S =
      (CHAR_CUT.outStepMs * Math.max(0, ...S5_CHAPTERS.map((w) => w.length))) / 1000 + CHIP_WIPE_S * EXIT_RATIO;
    const pageLead = (beat) => Math.max(Math.ceil(PAGE_EXIT_S / beat - 1e-6), 1) * beat;
    /* 10-08 (w8): the seat must HOLD for the page — the world turns under
       the chip (AUTO_ROTATE_SPEED, ~0.33 rad over a page), and a seat that
       read at the head drifted into the copy 1.3s in and snapped out (the
       harness: TYPE_PAIRINGS, desktop). The candidate's chip is re-seated
       on the SAME side at half and all of its life with the world spun
       ahead (only the group's own matrix — the children are untouched),
       and must stay in frame, off the keep boxes and facing (SPEC_LET_GO,
       the rule that would cut it). A drag can still beat the prediction;
       the keep-out cut stays the guard.
       10-08 (w8 fix): two looks were not the path. A near shard low in the
       frame moves ~160px/s, and the CTA→S5 return's TYPE_PAIRINGS grazed
       the `next:` pill's air between them — the keep-out cut it 0.61s into
       a 2.7s page (?debug pageLog). The page is now walked in
       PAGE_HOLD_STEPS and each step tests the box SWEPT from the last one
       (the two boxes' bound), so no keep box fits between two looks. And
       the leader's ROOT is held off the type too, swept the same way: a
       root dot inside a keep box's air read as the line pointing at the
       chrome (TYPE_PAIRINGS' root 7px from the `previous` pill). Page
       chips only — S1's seat is untouched.
       10-08 (w8 fix2, R1): and the seat must stay UNCOVERED over the page.
       The walk tested frame, facing and keep-out but not cover, and the
       held rule (pageActive) skips the drift give-up, so the spin carried
       a chip that bound clear behind a nearer shard and held it there a
       whole page — LOGO_SUITE read down to 'TE' on the phone's CTA→S5
       return, TYPE_PAIRINGS 0.63 → 0.18 visible on desktop (confirm1
       pagecover). Each step now also takes exactCover on the spun world,
       the shards' own matrices updated with the group's (the raycast reads
       those, not the group's), at PAGE_COVER_MAX: one sample of seven, not
       chipFits' two — a page chip lives a whole page, and a clipped end is
       all it may lose. Still bind time only, and the held rule stands. */
    const PAGE_HOLD_STEPS = 16;
    const PAGE_COVER_MAX = 0.25;
    const pageHolds = (cand, view, life) => {
      const w = chipW(measureChars(labelSlots[0], [...cand.term]));
      const h = Math.max(chipH(), 8);
      const d = LABEL_DOT_PX;
      const y0 = globeGroup.rotation.y;
      let ok = true;
      let cx = 0; // the last step's chip centre and root dot (the sweep's start)
      let cy = 0;
      let ax = 0;
      let ay = 0;
      for (let k = 0; k <= PAGE_HOLD_STEPS && ok; k++) {
        globeGroup.rotation.y = y0 + (AUTO_ROTATE_SPEED * life * k) / PAGE_HOLD_STEPS;
        globeGroup.updateWorldMatrix(false, true); // the shards too: exactCover raycasts their matrixWorld
        if (labelProminence(cand.panel) < SPEC_LET_GO) ok = false; // borrows lblWorld — before the seat
        lblWorld.copy(cand.pos);
        globeGroup.localToWorld(lblWorld);
        if (!ok || !chipSeat(lblWorld, view, seatOut, cand.sign) || !inFrame(view, lblChip.x, lblChip.y, w, h, CHIP_EDGE_M)) {
          ok = false;
        } else if (
          k > 0 &&
          (hitsKeep(view.keep, (cx + lblChip.x) / 2, (cy + lblChip.y) / 2, w + Math.abs(lblChip.x - cx), h + Math.abs(lblChip.y - cy)) ||
            hitsKeep(view.keep, (ax + lblA.x) / 2, (ay + lblA.y) / 2, d + Math.abs(lblA.x - ax), d + Math.abs(lblA.y - ay)))
        ) {
          ok = false;
        } else if (exactCover(view, lblChip.x, lblChip.y, w, lblA.depth - labelLift()) > PAGE_COVER_MAX) {
          ok = false; // last: the raycast only for a step the cheap tests passed
        }
        cx = lblChip.x;
        cy = lblChip.y;
        ax = lblA.x;
        ay = lblA.y;
      }
      globeGroup.rotation.y = y0;
      globeGroup.updateWorldMatrix(false, true); // the shards back too: the next seat's raycast reads them
      return ok;
    };
    const bindPage = (term, name, life) => {
      const slot = labelSlots.find((sl) => !sl.target);
      if (!slot) return false;
      refreshLabelMatrices();
      const view = labelView();
      const { beat, pass } = s5Env();
      const hits = patternHits(name, Math.max(s5Names().indexOf(name), 0), beat, pass);
      const taken = labelSlots.map((sl) => sl.target).filter(Boolean);
      const cands = [];
      panels.forEach((p, i) => {
        const pos = p.mesh.position;
        if (taken.includes(pos) || termOf.has(pos) || contact.held.has(pos)) return;
        const own = specOf.get(pos);
        if (own && own !== term) return;
        const cand = { pos, panel: p, decoy: null, term, hit: Math.min(...hits[i]) };
        if (labelVisible(cand)) cands.push(cand);
      });
      cands.sort((a, b) => a.hit - b.hit);
      const cand = cands
        .slice(0, PAGE_CANDS)
        .find((c) => chipFits(c, view, slot, true, 0, true) && pageHolds(c, view, life));
      if (!cand) return false;
      slot.dc?.kill();
      slot.dc = null;
      specOf.set(cand.pos, term);
      specSeat.set(term, cand.pos);
      slot.page = true;
      bindLabel(slot, cand);
      pageLog.push({ p: s5Chapter + 1, term, at: Math.round(performance.now()), id: panels.indexOf(cand.panel), hit: +cand.hit.toFixed(2), fill: slot.fill });
      return true;
    };
    // 10-08 (w8 fix): a look binds only with this many beats of HOLD left
    // before pageEnd — the intro's late p.01 (2 beats after its head) gets
    // one look, not a second that typed in and left inside a beat.
    const PAGE_HOLD_MIN = 1.5;
    // `late` (s) — how far past its pass head this page turns (the intro's
    // pass 1, after the live hold); its chip's life is that much shorter.
    const pageTurn = (name, late = 0) => {
      pageDc?.kill();
      pageDc = null;
      labelSlots.forEach((sl) => {
        if (sl.page && sl.target) retractNow(sl);
      });
      if (!pageActive || disposed || s5Chapter < 0) return;
      const term = S5_CHAPTERS[s5Chapter].toUpperCase();
      if (!specFillOf.has(term) && chipColors.length) {
        specFillOf.set(term, chipColors[chipColorCursor++ % chipColors.length]);
      }
      const { beat, pass } = s5Env();
      // the hold a look at k would get: from it to pageEnd
      const holdAt = (k) => pass - pageLead(beat) - late - k * beat;
      const look = (k) => {
        pageDc = null;
        if (!pageActive || disposed || stage !== 'stage-05' || activeTl) return;
        // its life: from this look to the end of its exit (pageEnd + PAGE_EXIT_S)
        if (holdAt(k) >= PAGE_HOLD_MIN * beat && bindPage(term, name, holdAt(k) + PAGE_EXIT_S)) return;
        if (k + 1 < PAGE_TRIES && holdAt(k + 1) >= PAGE_HOLD_MIN * beat) pageDc = gsap.delayedCall(beat, look, [k + 1]);
        else pageLog.push({ p: s5Chapter + 1, term, at: Math.round(performance.now()), id: null });
      };
      look(0);
    };
    const pageEnd = () => {
      pageDc?.kill();
      pageDc = null;
      labelSlots.forEach((sl) => {
        if (sl.page && sl.target && !sl.fading) cutOutLabel(sl);
      });
    };
    // Every regular pass start (a tl.call at the pass head, inside the
    // cycle) turns a page — even when ?pattern pins one pattern (the passes
    // still turn the pages). 10-08 (w8): from the FIRST pass (it kept the
    // live readout until pass 2: p.01 came 6.0s after the commit), the chip
    // on the world at the head; the intro's pass 1 holds the READOUT's p.01
    // until live_123_bpm has been read (s5LiveHold — buildS5Loop).
    // 10-08 (w8 fix): the hold holds the CHIP too — it typed LOGO_SUITE onto
    // the world 0.16s after "goes live" landed, ~1s before the readout left
    // live_123_bpm (the ● still the pool's first colour, not the chip's).
    // The page turns as ONE event at the hold's release: chip, p.01 and ●.
    const s5OnPass = (name) => {
      lastPattern = name;
      s5Phase = 'groove';
      s5Pass += 1;
      s5Chapter = S5_CHAPTERS.length ? (s5Pass - 1) % S5_CHAPTERS.length : -1;
      if (s5Pass === 1 && s5LiveHold) return;
      pageTurn(name);
      s5Show();
    };
    // A tap's ripple pass: the tail names it; the page stays where it was.
    const s5OnCue = () => {
      s5Phase = 'cue';
      s5Readout('cue_ripple'); // NEW COPY — Nathan to approve
    };
    const s5Reset = () => {
      s5Phase = null;
      s5Pass = 0;
      s5Chapter = -1;
      s5Tail = null;
      lastPattern = null;
      s5DropT = null;
      cueLog = [];
      s5LiveHold = false; // 10-08 (w8)
      pageLog = [];
    };
    // An intro is about to play: the last visit's page never shows through
    // the morph (count_in scrambles in from blank, at the intro's build).
    const s5Clear = () => {
      const counterEl = stageEl('stage-05', '.process-stage__counter');
      if (counterEl) counterEl.textContent = '';
      const el = captionEl('stage-05');
      if (el) {
        captionTweens.get(el)?.kill();
        captionTweens.delete(el);
        el.textContent = '';
      }
      s5Tail = '';
    };
    // Reduced motion: the still — the live readout, the ● lit.
    const s5Still = () => {
      s5Chapter = -1;
      s5Readout(s5Caption(1));
      s5Lamp(true);
    };

    /* — S5 rhythm engine (the musical rework). Envelope per hit: snap to
       full blue (attack) → HOLD on blue (?hold beats) → STEEP falloff
       (expo — fast first, long tail) down to ?pulsemin. Patterns spread
       one hit per panel per PASS_BEATS-beat pass (checker alternates per
       beat instead); `cycle` rotates the whole vocabulary, one pattern
       per pass. Between hits a panel rests dark — the waves are light. — */
    const ripplePanel =
      panels.find((p) => p.row === Math.floor(TOTAL_ROWS / 2) && p.lonIndex === 0) ?? panels[0];

    // 10-07 (w6, s5-tap-cue): `origin` — the ripple's source (a tap cue's
    // shard; the equator's lon-0 panel otherwise).
    const patternHits = (name, pi, beat, pass, origin = ripplePanel) => {
      // 07-30 rhythm rework (Nathan: "less downtime between changeovers"):
      // hits spread across the FULL pass minus a half-beat of headroom.
      // The old reserve (pass − envelope span) crammed every attack into
      // the pass head and left a ~1.1s dead tail at each changeover; now
      // late hits keep firing to the boundary and their decay tails spill
      // into the next pattern's pass — the overlap that keeps the energy
      // continuous. buildRhythmLoop clamps only the loop-seam tails.
      const spreadWindow = Math.max(pass - beat * 0.5, beat);
      const single = (delays) => {
        const max = Math.max(...delays) || 1;
        return delays.map((d) => [(d / max) * spreadWindow]);
      };
      switch (name) {
        case 'equator':
          return single(panels.map(equatorOutDelay));
        case 'ripple': {
          const rand = mulberry32(hashSeed(`process-ripple-${pi}`));
          return single(
            panels.map((p) => p.centerDir.angleTo(origin.centerDir) + rand() * 0.12)
          );
        }
        case 'random': {
          const rand = mulberry32(hashSeed(`process-random-${pi}`));
          const order = panels.map((_, i) => i);
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
          }
          const delays = new Array(panels.length);
          order.forEach((panelIdx, rank) => {
            delays[panelIdx] = rank;
          });
          return single(delays);
        }
        case 'checker':
          // Per-beat alternation: the two parities trade flashes on the
          // beat grid — each panel hits every 2 beats, all pass long.
          return panels.map((p) => {
            const parity = (p.row + p.lonIndex) % 2;
            return Array.from(
              { length: Math.max(1, Math.floor(PASS_BEATS / 2)) },
              (_, k) => (k * 2 + parity) * beat
            );
          });
        case 'rows':
        default:
          return single(panels.map((p) => panelDelay(p, 'rows', TOTAL_ROWS)));
      }
    };

    // 10-07 (w6): the S5 grid, read fresh from TUNING (live dials apply).
    const s5Env = () => {
      const beat = 60 / TUNING.bpm;
      return {
        beat,
        pass: PASS_BEATS * beat,
        attack: Math.min(0.07, beat * 0.15),
        // ?decaycurve (v2 deck, B8): the baked expo falloff vs. the house
        // pulse's essentially-linear read — Nathan A/Bs without a code edit.
        decayEase: TUNING.decayCurve === 'linear' ? 'none' : 'expo.out',
        strokeOn: TUNING.s5Stroke > 0.01 && TUNING.strokePx > 0.01,
      };
    };

    /* 10-07 (w6, s5-drop): ONE HIT — buildRhythmLoop's per-panel envelope,
       factored verbatim so the unison drop and the cue ride the very same
       hit: attack to full blue (power2.out), HOLD, the ?decaycurve falloff to
       ?pulsemin; the inner stroke rides it inversely when the S5 ink is on.
       `hold` / `decay` in seconds (the loop's per-panel clamps happen first). */
    const hitEnvelope = (tl, p, start, hold, decay, env) => {
      const { attack, decayEase, strokeOn } = env;
      const keyframes = [
        { value: 1.0, duration: attack, ease: 'power2.out' },
        { value: 1.0, duration: hold, ease: 'none' },
        { value: TUNING.pulseMin, duration: decay, ease: decayEase },
      ];
      // B8: the brown-blue inner stroke surfaces as the light dies —
      // uStrokeMix rides the envelope INVERSELY (lit = no ink, dark =
      // inked lattice), same grid, same falloff shape.
      const strokeKeyframes = [
        { value: 0, duration: attack, ease: 'power2.out' },
        { value: 0, duration: hold, ease: 'none' },
        { value: TUNING.s5Stroke, duration: decay, ease: decayEase },
      ];
      tl.to(p.mesh.material.uniforms.uPower, { keyframes }, start);
      if (strokeOn) {
        tl.to(p.mesh.material.uniforms.uStrokeMix, { keyframes: strokeKeyframes }, start);
      }
    };

    /* 10-07 (w6): options for the drop and the cue — `rot` starts the cycle
       at pattern `rot` (a cue resumes AFTER the interrupted one; each pattern
       keeps its own seed), `names` / `seeds` a one-off pass (the cue's
       ripple), `origin` the ripple's source, `repeat` 0 for a one-shot,
       `seam` false skips the loop-seam clamp (a one-shot's tails spill into
       the cycle that follows, like any changeover), `ink` false skips the
       colour drift, `onPass(name)` a call at every pass head (the readout).
       10-08 (w8): `onPassEnd` a call `endLead` s before every pass's end
       (the page chip's exit — pageEnd / pageLead). */
    const buildRhythmLoop = ({
      names = s5Names(),
      seeds = null,
      rot = 0,
      origin = ripplePanel,
      repeat = -1,
      seam = true,
      ink = true,
      onPass = null,
      onPassEnd = null,
      endLead = 0,
    } = {}) => {
      const env = s5Env();
      const { beat, pass, attack, strokeOn } = env;
      /* 10-07 (w6 integration): repeatRefresh — at every wrap GSAP rewinds
         each child tween to the start value it recorded on its FIRST play
         (onRepeat fires before that rewind, so it can't undo it). Those starts
         were the arrival's light (pose power 1 after a cut or a compressed
         step; the drop's tail after the intro), so every ~14.6s the whole
         globe re-lit for ≈1.5s before the rows pass reached it. Refreshing
         re-records each hit from the live value instead: the panels rest on
         the floor across the wrap, as the engine says they do between hits. */
      const tl = gsap.timeline({ repeat, repeatRefresh: true });
      const totalLen = names.length * pass;
      names.forEach((_, si) => {
        const pi = (si + rot) % names.length;
        const name = names[pi];
        const at = si * pass;
        if (onPass) tl.call(onPass, [name], at);
        if (onPassEnd) tl.call(onPassEnd, null, at + Math.max(pass - endLead, 0));
        const hits = patternHits(name, seeds ? seeds[pi] : pi, beat, pass, origin);
        panels.forEach((p, i) => {
          const times = hits[i];
          // Envelope must clear before the panel's next hit.
          const cycleLen = times.length > 1 ? times[1] - times[0] : pass;
          const hold = Math.min(TUNING.holdBeats * beat, cycleLen * 0.45);
          const decay = Math.max(
            Math.min(TUNING.decayBeats * beat, cycleLen - hold - attack * 1.5),
            0.08
          );
          times.forEach((t) => {
            const start = at + t;
            // Loop-seam clamp: tails may spill BETWEEN patterns (that's
            // the overlap), but never past totalLen — the tl.set pin must
            // stay the timeline's true end or the repeat drifts off the
            // beat grid. Only the final pattern's last hits compress.
            // 10-07 (w6 fix): the HOLD compresses too, once the decay is down
            // to its 0.05s floor — the decay alone couldn't fit the last ~2
            // beats of hits (a 2-beat hold), so the cycle ran 31.76 beats, not
            // 30 (measured): every pass head after the first wrap landed off
            // the ● and the tap cue's beat grid, plus a 0.85s dead seam
            // (Nathan 07-30: "less downtime between changeovers"). Those
            // late hits now hold to the seam and cut on the downbeat.
            const room = totalLen - start - attack;
            const holdFit = seam ? Math.max(Math.min(hold, room - 0.05), 0) : hold;
            const decayFit = seam ? Math.max(Math.min(decay, room - holdFit), 0.05) : decay;
            hitEnvelope(tl, p, start, holdFit, decayFit, env);
          });
        });
      });
      // B8: per-panel offset color drift — each shard's stroke wanders
      // between the two brown-blues on its own phase (subtle, alive).
      // 10-07 (w6): FROM the ink it has (a .to, not a fromTo off A — no jump
      // at a hand-over). A .to records its start ONCE and every repeat swings
      // back to it, so every start must hand it A: a fresh start sets A, and
      // a cue eases each shard back to A across its ripple pass (buildS5Loop)
      // — the drift spans A ↔ B on every visit, the bake's range.
      // 10-07 (w6 fix): the yoyo ends AT totalLen (the pass/2 floor is gone):
      // with ?pattern pinned (totalLen = one pass) the floor ran the drift to
      // 1.49 passes and the pages turned every 8.96 beats instead of 6. In
      // the cycle the floor never bound, so the bake's drift is unchanged.
      if (strokeOn && ink) {
        panels.forEach((p, i) => {
          const phase = (i / panels.length) * pass * 0.5;
          tl.to(
            p.mesh.material.uniforms.uStrokeColor.value,
            {
              r: s5StrokeB.r,
              g: s5StrokeB.g,
              b: s5StrokeB.b,
              duration: (totalLen - phase) / 2,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: 1,
            },
            phase
          );
        });
      }
      tl.set({}, {}, totalLen); // exact loop length — passes stay on the grid
      return tl;
    };

    /* 10-07 (w5, s4-heartbeat): S4's resting pulse — the S5 hit's timing
       (attack ≤0.07s power2.out, then the ?decaycurve fall over 2 beats, cut
       to fit the period), every panel in unison. The first pulse lands ONE
       PERIOD after the settle (the delay), then the tl.set pin keeps every
       repeat on the ?bpm grid.
       10-08 (w8, experience-1): on uPower now, not uStrokeMix. The stroke
       route was measured dead: at ?heartbeat 1 (full brown-blue ink on the
       1.75px inner edge) the sphere's mean value moved under 1/255 — the
       ink lives on a hairline of a full-blue field. The pulse is a unison
       DIP-AND-RETURN of the world's light: each panel drops to the rest ×
       (1 − ?heartbeat) on the attack and recovers to the rest on the decay
       curve — a swell is impossible (#0000FF at power 1 is already the
       blue channel's ceiling). The dip is the S4→S5 count-in's lights-down
       in miniature, so the count-in reads as this beat surfacing.
       The REPEAT TRAP (w6): the tween's first-play start is the rest (the
       landing's morph ends on pose.power; startLoops puts it back on a
       rebuild at rest), the decay ends on the rest before the period's pin,
       and repeatRefresh re-reads the live value at each wrap anyway — a
       wrap can never snap to a stale start. ONE tween over the 84 uniforms
       (unison: a per-panel copy bought nothing). The ink stays out — the
       S5 loop sets its own (buildS5Loop). */
    /* 10-08 (w8b, r1-heartbeat-exit): the pulse's SHAPE, one place — the
       loop below and an S4 exit's recovery (buildTransition) read the same
       attack, decay, curve, rest and floor. */
    const heartbeatShape = (every = getPose('stage-04').loops?.every ?? 2, depth = TUNING.heartbeat) => {
      const beat = 60 / TUNING.bpm;
      const period = Math.max(every, 1) * beat;
      const attack = Math.min(0.07, beat * 0.15);
      const decay = Math.max(Math.min(2 * beat, period - attack), 0.05);
      const decayEase = TUNING.decayCurve === 'linear' ? 'none' : 'expo.out';
      const rest = getPose('stage-04').power;
      const floor = rest * (1 - Math.min(Math.max(depth, 0), 1));
      return { period, attack, decay, decayEase, rest, floor };
    };
    /* …and a dip's RECOVERY from its live value, one place (the S4 exit in
       buildTransition; 10-08 (w8b fix, rc3): a bench rebuild in startLoops):
       the pulse's decay × EXIT_RATIO — expo is self-similar, so from any
       live value it is the same curve, faster; ?decaycurve linear keeps the
       pulse's slope × 1/EXIT_RATIO over what is left. */
    const recoverSecs = (hb, live) => {
      const span = hb.decayEase === 'none' ? (hb.rest - live) / Math.max(hb.rest - hb.floor, 1e-3) : 1;
      return hb.decay * EXIT_RATIO * Math.min(span, 1);
    };
    const buildHeartbeat = (every, depth) => {
      const { period, attack, decay, decayEase, rest, floor } = heartbeatShape(every, depth);
      return gsap
        .timeline({ repeat: -1, repeatRefresh: true, delay: period, data: 'heartbeat' })
        .to(
          panels.map((p) => p.mesh.material.uniforms.uPower),
          {
            keyframes: [
              { value: floor, duration: attack, ease: 'power2.out' },
              { value: rest, duration: decay, ease: decayEase },
            ],
          },
          0
        )
        .set({}, {}, period); // exact period — the beat never drifts
    };

    /* 10-07 (w6, s5-drop / s5-tap-cue): S5's loop is ONE non-repeating
       PARENT (loopTl, the single owner — paused/killed as one) holding:
       · the INTRO (opts.intro — only from buildTransition's S4→S5, forward,
         whole): count_in on the readout, the LIGHTS-DOWN (every panel to
         ?pulsemin, the ink up to ?s5stroke, over one beat on the decay
         curve), a held breath, then the DROP — all 84 panels hit together
         (one unison flash, not a strobe) at s5DropAt() after the commit, the
         copy's [[goes live]] wipe on the same clock; the readout goes live.
         Pass 1 rises out of the drop's hold (the cycle child at drop + hold).
       · or the CUE (opts.cue — a tap, on its beat): every panel released to
         the floor over one beat while ONE ripple pass spreads from the
         tapped shard (the tail reads cue_ripple), then the cycle resumes
         after the pattern it interrupted.
       · the CYCLE child (repeat −1; the readout's page turns at each pass
         head) and the BLINK child (repeat −1: the ● on at the beat, off at
         half a beat — a colour swap), both on the beat grid from loopOrigin.
       Any start without the drop (applyTuning mid-count-in, setStageInstant,
       a compressed or reversed arrival) goes straight to the groove and its
       first pass writes the CURRENT readout — count_in is never stranded. */
    const buildS5Loop = (opts, keepInk) => {
      const env = s5Env();
      const { beat, pass, decayEase, strokeOn } = env;
      const parent = gsap.timeline();
      // 10-08 (w8): every pass's page chip leaves pageLead before its end
      const pages = { onPassEnd: pageEnd, endLead: pageLead(beat) };
      s5LiveHold = false;
      const powers = panels.map((p) => p.mesh.material.uniforms.uPower);
      const inks = panels.map((p) => p.mesh.material.uniforms.uStrokeMix);
      // The rhythm's ink is the S5 brown-blue (the belt's black returns with
      // stopLoops); a cue keeps each shard's drifted colour.
      // 10-10 (w9c fix R1): …except an ink still SHOWING at the intro (S4's
      // edge ink on the blue solid rides the S4→S5 morph): a copy there snaps
      // the visible outline black → brown-blue in one frame, so those panels
      // turn on the count-in's lights-down beat instead (floor, below). Done by
      // the beat, long before the cycle's drift records its start (grooveAt +
      // its phase ≥ drop + hold > beat — the repeat trap's A start holds).
      const inkTurn = [];
      panels.forEach((p, i) => {
        const u = p.mesh.material.uniforms;
        if (opts.intro && strokeOn && u.uStrokeMix.value > 0.01) inkTurn.push(u.uStrokeColor.value);
        else u.uStrokeColor.value.copy(keepInk ? keepInk[i] : s5StrokeA);
      });
      const floor = (tl) => {
        tl.to(powers, { value: TUNING.pulseMin, duration: beat, ease: decayEase }, 0);
        if (strokeOn) tl.to(inks, { value: TUNING.s5Stroke, duration: beat, ease: decayEase }, 0);
        if (inkTurn.length) tl.to(inkTurn, { r: s5StrokeA.r, g: s5StrokeA.g, b: s5StrokeA.b, duration: beat, ease: decayEase }, 0);
      };
      let grooveAt = 0;
      let rot = 0;
      loopOrigin = 0;
      if (opts.cue) {
        floor(parent);
        // 10-07 (w6 fix): …and eases it back to A across the ripple pass, so
        // the resumed cycle's drift (a .to — it records its start once, at
        // pass + phase, past this tween's end) swings A ↔ B again. Starting
        // from the kept colour left each shard drifting [tap colour ↔ B] for
        // the rest of the visit, and every further tap pushed the field
        // toward B. stopLoops kills these with the rest of the ink tweens.
        if (strokeOn) {
          parent.to(
            panels.map((p) => p.mesh.material.uniforms.uStrokeColor.value),
            { r: s5StrokeA.r, g: s5StrokeA.g, b: s5StrokeA.b, duration: pass, ease: 'sine.inOut' },
            0
          );
        }
        const ri = S5_CYCLE.indexOf('ripple');
        parent.add(
          buildRhythmLoop({ names: ['ripple'], seeds: [ri], origin: opts.cue, repeat: 0, seam: false, ink: false, onPass: s5OnCue, ...pages }),
          0
        );
        const names = s5Names();
        const li = names.indexOf(lastPattern);
        rot = li >= 0 ? (li + 1) % names.length : 0;
        grooveAt = pass;
      } else if (opts.intro) {
        s5Phase = 'count_in';
        s5Pass = 0;
        s5Chapter = -1;
        lastPattern = null;
        // the drop lands s5DropAt() after the commit; this parent starts at
        // the landing (transitionDur in) — never sooner than one beat on
        const drop = Math.max(s5DropAt() - (opts.transitionDur ?? 0), beat);
        const hold = Math.min(TUNING.holdBeats * beat, pass * 0.45);
        const decay = Math.max(Math.min(TUNING.decayBeats * beat, pass - hold - env.attack * 1.5), 0.08);
        s5DropT = performance.now() + drop * 1000;
        parent.call(() => s5Readout(s5Caption(0)), null, 0); // count_in (written at the build — a no-op unless a rebuild cleared it)
        floor(parent);
        parent.call(
          () => {
            s5Phase = 'drop';
            s5DropT = performance.now();
            s5Readout(s5Caption(1)); // live_123_bpm — NEW COPY
          },
          null,
          drop
        );
        panels.forEach((p) => hitEnvelope(parent, p, drop, hold, decay, env));
        loopOrigin = drop;
        grooveAt = drop + hold;
        /* 10-08 (w8): pages from the FIRST pass, but live_123_bpm owns the
           drop — its 0.85s scramble lands only ≈0.12s before pass 1's head
           (the drop's 2-beat hold), so the READOUT's p.01 waits whole beats
           until the live line has read for PAGE_LIVE_READ_S: 2 beats at
           123bpm, p.01 starting ≈3.6s after the commit (it was 6.0s, at pass
           2). 10-08 (w8 fix): its chip waits with it (s5OnPass) and turns
           with p.01 here, its life short by the wait (pageTurn's `late`). */
        s5LiveHold = true;
        const liveBeats = Math.max(Math.ceil((SCRAMBLE_DURATION + PAGE_LIVE_READ_S - hold) / beat - 1e-6), 0);
        parent.call(
          () => {
            s5LiveHold = false;
            if (s5Pass === 1 && s5Phase === 'groove') {
              pageTurn(lastPattern, liveBeats * beat); // 10-08 (w8 fix): the chip with p.01 (s5OnPass)
              s5Show();
            }
          },
          null,
          grooveAt + liveBeats * beat
        );
      } else {
        s5Phase = 'groove';
      }
      parent.add(buildRhythmLoop({ rot, onPass: s5OnPass, ...pages }), grooveAt);
      const blink = gsap
        .timeline({ repeat: -1 })
        .call(s5Lamp, [true], 0)
        .call(s5Lamp, [false], beat * 0.5)
        .set({}, {}, beat);
      parent.add(blink, loopOrigin);
      return parent;
    };

    /* 10-07 (w7, cta-finale): THE CTA BREATHES (?ctaloop breathe) — after
       the resolve every panel but the freed shard (it answers the CTA's
       hover — two tweens on one uPower would fight) breathes in unison: up
       to BREATHE.peak over BREATHE.attack s (sine.out), a BREATHE.decay-beat
       fall to BREATHE.floor on the ?decaycurve, one breath every
       BREATHE.every beats at ?bpm. uPower only — the ink stays out. The
       first breath lands on the resolve's beat grid (one beat on for an
       arrival without a resolve). repeatRefresh: the w6 REPEAT TRAP — a
       wrap rewinds each .to to the start it recorded on its FIRST play (the
       resolve's full light), so without it every breath would flash to 1
       first; refreshed, each one re-records from the live floor. Constants,
       not knobs (the brief's shape). */
    const BREATHE = { peak: 0.9, attack: 0.14, floor: 0.35, decay: 6, every: 8 };
    /* 10-10 (w9c fix2, cta-ink-phone): ?ctaink auto's EYE. The black edge
       ink goes on only where it OUTREADS the lit world (WCAG, the chipkey
       test's contrastOf) on the field under the world's LOWER SILHOUETTE, at
       its dimmest resting light — the breathe's floor (full power on
       ?ctaloop hold and under reduced motion: no breath). The silhouette
       point: framingFor's — the free rect's centre plus the world's screen
       radius (?ctafill × the rect's short side / 2) × √3/2, the median
       column of a disc's lower edge. Desktop's world stands in the ramp's
       blue (≈129 there: ink 1.32 vs lit 1.14 at the floor) and keeps its
       ink; the phone's sits over the ramp's near-black top (≈35: ink 1.03 vs
       lit 1.47) and goes ink-free. Binary on purpose: a partial mix takes
       the edge THROUGH the field's colour (1:1 at mix 1 − field/light).
       Never getPose here (poseFor('cta') reads this). ctaRestGeom is cached
       until the resize settle or the webfont, and nothing re-inks a resting
       world on a resize — the next arrival reads the new verdict. */
    const ctaLitAt = new THREE.Color();
    ctaEdgeInk = () => {
      const { rect } = ctaRestGeom();
      const short = Math.min(Math.max(rect.x1 - rect.x0, 1), Math.max(rect.y1 - rect.y0, 1));
      const rPx = (Math.max(TUNING.ctaFill, 0.05) * short) / 2;
      const under = rampAt((rect.y0 + rect.y1) / 2 + rPx * (Math.sqrt(3) / 2), ctaRamp());
      const low = PREFERS_REDUCED_MOTION || TUNING.ctaLoop === 'hold' ? 1 : BREATHE.floor;
      const lit = hexCssOf(ctaLitAt.setHex(LIT_COLOR).multiplyScalar(low).getHex()); // uPower scales the linear fill
      return contrastOf(STROKE_CSS, under) > contrastOf(lit, under) ? 1 : 0;
    };
    const buildBreathe = () => {
      const { beat, decayEase } = s5Env();
      const lights = panels.filter((p) => p !== contact.panel).map((p) => p.mesh.material.uniforms.uPower);
      const since = contact.resolveAt == null ? null : (performance.now() - contact.resolveAt) / 1000;
      const delay = since == null ? beat : (beat - (since % beat)) % beat;
      return gsap
        .timeline({ repeat: -1, repeatRefresh: true, delay })
        .to(lights, { value: BREATHE.peak, duration: BREATHE.attack, ease: 'sine.out' }, 0)
        .to(lights, { value: BREATHE.floor, duration: BREATHE.decay * beat, ease: decayEase }, BREATHE.attack)
        .set({}, {}, BREATHE.every * beat); // exact period — the breath stays on the grid
    };

    /* 10-07 (w5): ONE switch for every rest loop — onComplete, setStageInstant
       and applyTuning's rebuild all land here, and it dispatches on the
       current pose's `loops.kind`. opts: { intro, transitionDur } (w6 — the
       S4→S5 landing) / { cue } (w6 — a tap); w7: 'breathe' (the CTA). */
    const startLoops = (opts = {}) => {
      if (PREFERS_REDUCED_MOTION) return; // stills: no idle motion anywhere
      // 10-07 (w6): a cue keeps the drift's ink — read before stopLoops
      // puts the belt's black back.
      const keepInk = opts.cue
        ? panels.map((p) => p.mesh.material.uniforms.uStrokeColor.value.clone())
        : null;
      stopLoops();
      const loops = getPose(stage ?? 'stage-01')?.loops;
      switch (loops?.kind) {
        case 'heartbeat': {
          // 10-07 (w5 fix): a rebuild AT REST (applyTuning — any bench edit)
          // lands mid-pulse, and the killed pulse leaves the world where it
          // had it — held for a whole period (the delay), or for good at
          // ?heartbeat 0. The rest comes back first. (A landing already sits
          // on the pose; the rhythm is left alone — its panels keep their
          // light until their next hit.)
          // 10-08 (w8): the pulse is on uPower now (buildHeartbeat), so the
          // rest it restores is the pose's POWER; the stroke is no longer
          // the heartbeat's, and the ?strokepx gate went with it.
          // 10-08 (w8b fix, rc3): …but a rebuild INSIDE a dip (a bench edit
          // lands in one about one time in four) SNAPPED every panel from as
          // low as rest × (1 − ?heartbeat) to the rest — the one-frame jump the S4
          // exit no longer makes. The beat completes instead: one unison
          // tween from the live values on the pulse's own recovery
          // (recoverSecs, the exit's), the rebuilt loop's first child — a
          // goTo mid-recovery reads it as a dip (goTo's `dip`), stopLoops
          // kills it with the loop. The new pulse keeps its one-period delay
          // (0.975s at 123 bpm), past the recovery (≤ decay × 0.7 ≈ 0.63s),
          // so the two never write uPower at once. A rebuild clear of a dip
          // (≥ 0.995 of the rest) restores exactly as before.
          const hb = heartbeatShape(loops.every ?? 2);
          const powers = panels.map((p) => p.mesh.material.uniforms.uPower);
          let dipFrom = Infinity;
          if (!activeTl) {
            powers.forEach((u) => {
              gsap.killTweensOf(u);
              dipFrom = Math.min(dipFrom, u.value);
            });
            if (!(dipFrom < hb.rest * 0.995)) powers.forEach((u) => (u.value = hb.rest));
          }
          const pulse = TUNING.heartbeat > 0.001 ? buildHeartbeat(loops.every ?? 2, TUNING.heartbeat) : null; // ?heartbeat 0 = the static S4
          if (dipFrom < hb.rest * 0.995) {
            const owner = gsap.timeline({
              data: 'heartbeat',
              // the static S4 (?heartbeat 0): nothing loops once the beat has completed
              onComplete: pulse ? undefined : () => loopTl === owner && (loopTl = null),
            });
            owner.to(powers, { value: hb.rest, duration: Math.max(recoverSecs(hb, dipFrom), 0.05), ease: hb.decayEase }, 0);
            if (pulse) owner.add(pulse, 0); // at its own delay — the first pulse one period on, as ever
            loopTl = owner;
          } else loopTl = pulse;
          break;
        }
        case 'rhythm':
          // 10-08 (w8): the page chips ride the rhythm (?s5chip; no slots
          // under reduced motion — and startLoops never runs there)
          pageActive = TUNING.s5Chip !== 'off' && labelSlots.length > 0;
          loopTl = buildS5Loop(opts, keepInk);
          break;
        case 'breathe':
          loopTl = buildBreathe(); // 10-07 (w7): the CTA
          break;
        default:
          // 10-07 (w7): ?ctaloop hold, flipped live at the CTA rest — the
          // world it holds is the resolve's, fully lit (a breath may have
          // been anywhere on its fall).
          if (stage === 'cta' && !activeTl) {
            const power = getPose('cta').power;
            panels.forEach((p) => {
              if (p === contact.panel) return;
              const u = p.mesh.material.uniforms.uPower;
              gsap.killTweensOf(u);
              u.value = power;
            });
          }
          break;
      }
      if (loopTl && !tickerActive) loopTl.paused(true); // a hidden tab starts it held (syncTicker resumes it)
    };

    /* — 10-07 (w7, cta-finale): THE TURN. On the authored S5→CTA step (and
       an instant CTA arrival) ONE shard leaves the world: the visitor's.
       · THE PICK (pickContact, at the commit — the page is still gliding):
         shards with no word (termOf / an S3 word's current seat — a shard
         keeps its word; never a polar-cap wedge, which lifted reads as a
         sliver) on the near hemisphere, judged at the CTA's predicted REST
         (the free rect's framing, ctaRestGeom; the rest keep boxes,
         ctaRestKeep): the lifted shard on screen and clear of the type, and
         its chip's seat — outward, or INWARD (chipSeat −1, the S1 flip) —
         inside the frame and clear of every keep box. Among those a LIMB
         shard comes first (CONTACT_LIMB: its face ≥ 45° off the lens axis —
         a face-on shard lifting toward the lens barely reads as leaving;
         w7 fix: on a 390 phone it read as a black hole with a lit sliver);
         then the outward seat; then the seat in the OPEN SPACE — the most
         ROOM (its clear runs to a keep box, the world's disc or the frame
         edge, the tighter axis); then the most limb-ward. On a 1440 desktop
         that is the left limb, the chip in the field under or above the ask
         (a corner pocket beside the world when no unnamed limb shard sits
         there); a phone's band has no room beside the globe, so a limb
         shard's outward seat leaves the frame or meets the copy and its
         INWARD seat wins, the chip over the face (room 0 — the most
         limb-ward). None fits: the most limb-ward clear shard lifts anyway
         and the chip waits (getStats().cta.fits / .room / .pool / .nz).
       · THE LIFT: along its own home direction to ×(?emanate + ?liftk), on
         the Turn curve over ?ctasecs from the resolve; THE TURN: to a seeded
         rest — its face turned to the rest lens, tilted 8–18° off square and
         rolled 35–70° (seeded per shard) — an object that turned, not a
         billboard. Both are solved in WORLD space at the pick and
         counter-rotated every frame (composeContact), because the globe
         keeps its ambient spin: the shard holds still while the world turns
         behind it. One eased scalar (contact.k) drives both, slerp'd from
         its home pose — not tweenQuat: a fixed local target would ride the
         spin away.
       · Leaving to S5 (authored) it flies home on k → 0 at the exit ratio;
         every other exit bakes its live pose and the morph carries it like
         any panel; an instant pose snaps it home first. — */
    const ctV = new THREE.Vector3();
    const ctN = new THREE.Vector3();
    const ctCam = new THREE.Vector3();
    const ctAxis = new THREE.Vector3();
    const ctHome = new THREE.Vector3();
    const ctQ = new THREE.Quaternion();
    const ctQ2 = new THREE.Quaternion();
    const ctInv = new THREE.Quaternion();
    const ctA = { x: 0, y: 0, depth: 0 };
    const ctC = { x: 0, y: 0, depth: 0 };
    const CONTACT_FACE_MIN = 0.02; // the near hemisphere: the face normal's lens-ward share at the pick
    const CONTACT_LIMB = 0.7; // …and the LIMB: at most this share (the face ≥ 45° off the lens axis)
    const CTA_RESOLVE_S = 0.07; // the resolve's attack — the S5 hit's (s5Env attack at the bake)
    const CONTACT_ROOM = 200; // px — a seat's clear run each way counts up to this (pickContact's room)
    // A point (x, y relative to the lens axis) seen by the REST camera at (0, 0, camZ).
    const restPx = (x, y, z, camZ, view, out) => {
      const depth = camZ - z;
      if (depth <= 0.05) return null;
      out.x = view.vw / 2 + (x / (depth * view.tanH)) * (view.vw / 2);
      out.y = view.vh / 2 - (y / (depth * view.tanV)) * (view.vh / 2);
      out.depth = depth;
      return out;
    };
    /* The keep boxes AT THE REST (keepBoxes' pad): the CTA copy, the risen
       footer, a phone's bar, and the fixed steppers where they will sit —
       [next] rides the footer up (process.css), by the reveal still to come. */
    const ctaRestKeep = (geom) => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const base = container.getBoundingClientRect();
      const pad = (b) => ({ x0: b.x0 - KEEP_PAD, y0: b.y0 - KEEP_PAD, x1: b.x1 + KEEP_PAD, y1: b.y1 + KEEP_PAD });
      const keep = geom.copy.map(pad);
      keep.push(pad({ x0: 0, y0: geom.footerTop, x1: w, y1: h }));
      if (geom.top > 0) keep.push(pad({ x0: 0, y0: 0, x1: w, y1: geom.top }));
      const reveal =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--footer-reveal')) || 0;
      document.querySelectorAll('.process-stepnav__cta').forEach((el) => {
        if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const rise = el.closest('.process-stepnav--next') ? (1 - Math.min(reveal, 1)) * geom.footerH : 0;
        keep.push(
          pad({
            x0: r.left - base.left,
            y0: r.top - base.top - rise,
            x1: r.right - base.left,
            y1: r.bottom - base.top - rise,
          })
        );
      });
      return keep;
    };
    const pickContact = () => {
      const pose = getPose('cta');
      const { z, offsetX, offsetY } = framingFor(pose);
      const geom = ctaRestGeom();
      const keep = ctaRestKeep(geom);
      const tanV = TAN_V;
      const view = screenView({}); // 10-07 (final review): its own — it outlives other readers' calls
      const lift = pose.panelScale + Math.max(TUNING.liftK, 0);
      const probe = labelSlots[0];
      const cw = probe ? chipW(measureChars(probe, [...CONTACT_TERM])) : 0;
      const ch = Math.max(chipH(), 8);
      const lead = chipLead();
      const G = globeGroup.quaternion; // the spin as it stands — the rest is frozen here
      if (!restPx(offsetX, offsetY, 0, z, view, ctC)) return null;
      // the world's silhouette at the rest, px (perspective: R / √(z² − R²))
      const Rw = RADIUS * pose.frameR;
      const discPx = (Rw / Math.sqrt(Math.max(z * z - Rw * Rw, 1e-6)) / tanV) * (view.vh / 2);
      /* ROOM — how open the field around a chip seat is: its clear runs
         left, right, up and down (each to the first keep box, the world's
         disc or the frame edge, capped at CONTACT_ROOM px), the TIGHTER
         axis's span, halved — open space is room both ways, so a seat
         pinned under the frame top (a long free row, 18px above it) reads
         tight. A seat over the world has none (a phone's band: every seat). */
      const discSpan = (a0, a1, c) => {
        // the disc's half-extent across the band [a0, a1] (0 = misses it)
        const d = Math.abs(Math.min(Math.max(c, a0), a1) - c);
        return d < discPx ? Math.sqrt(discPx * discPx - d * d) : 0;
      };
      const roomOf = (x, y) => {
        const x0 = x - cw / 2;
        const x1 = x + cw / 2;
        const y0 = y - ch / 2;
        const y1 = y + ch / 2;
        const hx = discSpan(y0, y1, ctC.y); // the disc's x half-extent in the chip's row
        const hy = discSpan(x0, x1, ctC.x); // …its y half-extent in the chip's column
        if (x1 > ctC.x - hx && x0 < ctC.x + hx && hx > 0) return 0; // over the world
        let l = x0;
        let r = view.vw - x1;
        let u = y0;
        let d = view.vh - y1;
        if (hx > 0) {
          if (ctC.x + hx <= x0) l = Math.min(l, x0 - (ctC.x + hx));
          if (ctC.x - hx >= x1) r = Math.min(r, ctC.x - hx - x1);
        }
        if (hy > 0) {
          if (ctC.y + hy <= y0) u = Math.min(u, y0 - (ctC.y + hy));
          if (ctC.y - hy >= y1) d = Math.min(d, ctC.y - hy - y1);
        }
        keep.forEach((k) => {
          if (k.y0 < y1 && k.y1 > y0) {
            if (k.x1 <= x0) l = Math.min(l, x0 - k.x1);
            if (k.x0 >= x1) r = Math.min(r, k.x0 - x1);
          }
          if (k.x0 < x1 && k.x1 > x0) {
            if (k.y1 <= y0) u = Math.min(u, y0 - k.y1);
            if (k.y0 >= y1) d = Math.min(d, k.y0 - y1);
          }
        });
        const cap = (v) => Math.min(Math.max(v, 0), CONTACT_ROOM);
        return Math.min(cap(l) + cap(r), cap(u) + cap(d)) / 2;
      };
      let best = null;
      const pool = [0, 0, 0, 0, 0]; // ?debug: candidates · fitting outward · …on the limb · inward-only · …on the limb
      panels.forEach((p) => {
        const pos = p.mesh.position;
        // a shard keeps its word: never one the S1 tour named, nor an S3
        // spec word's CURRENT seat (the specHeld rule — a retired spec shard
        // is anonymous again); a shard that wore first_contact may wear it again
        const spec = specOf.get(pos);
        if (termOf.has(pos) || (spec !== undefined && specSeat.get(spec) === pos)) return;
        // never a polar-cap wedge: lifted and turned, a sliver reads as nothing
        if (p.row === 0 || p.row === TOTAL_ROWS - 1) return;
        ctN.copy(p.centerDir).applyQuaternion(G);
        if (ctN.z < CONTACT_FACE_MIN) return;
        ctV.copy(p.homeOffset).applyQuaternion(G).multiplyScalar(lift);
        if (!restPx(offsetX + ctV.x, offsetY + ctV.y, ctV.z, z, view, ctA)) return;
        if (
          Math.abs((ctA.x / view.vw) * 2 - 1) > LABEL_NDC_BIND ||
          Math.abs(1 - (ctA.y / view.vh) * 2) > LABEL_NDC_BIND
        ) return;
        const rPx = ((p.boundRadius || 0.2) * pose.panelScale * view.vh) / (ctA.depth * view.tanV * 2);
        const clear = !hitsKeep(keep, ctA.x, ctA.y, rPx * 2, rPx * 2);
        let ox = ctA.x - ctC.x;
        let oy = ctA.y - ctC.y;
        const d = Math.hypot(ox, oy) || 1;
        ox /= d;
        oy /= d;
        const seats = (s) =>
          clear &&
          cw > 0 &&
          inFrame(view, ctA.x + s * ox * lead, ctA.y + s * oy * lead, cw, ch, CHIP_EDGE_M + CHIP_EDGE_SLACK) &&
          !hitsKeep(keep, ctA.x + s * ox * lead, ctA.y + s * oy * lead, cw, ch);
        // 10-07 (w7): the OUTWARD seat first; the INWARD one (chipSeat's
        // sign −1, the S1 flip) only when no shard's outward seat fits — a
        // phone walk whose spin put every unnamed limb shard's outward seat
        // off the 390 frame lifted a shard whose chip then never seated.
        const out = seats(1);
        const sign = out ? 1 : seats(-1) ? -1 : 0;
        const fits = sign !== 0;
        const x = ctA.x + (sign || 1) * ox * lead;
        const y = ctA.y + (sign || 1) * oy * lead;
        // a seat that fits, then the limb (CONTACT_LIMB — a face-on shard
        // lifting toward the lens barely reads as leaving), then the outward
        // side, then the open space: the roomiest seat (in 16px steps), then
        // the most limb-ward. 10-07 (w7 fix): the limb outranks the SIDE —
        // a 390 phone's outward seats fit only on near-face shards (the band
        // has no room beside the globe), and the lifted face shard read as a
        // black hole with a lit sliver beside it; a limb shard on its inward
        // seat stands off the sphere, its chip over the face as before.
        const room = fits ? Math.floor(roomOf(x, y) / 16) * 16 : 0;
        const limb = ctN.z <= CONTACT_LIMB;
        pool[0] += 1;
        if (out) pool[1] += 1;
        if (out && limb) pool[2] += 1;
        if (sign === -1) pool[3] += 1;
        if (sign === -1 && limb) pool[4] += 1;
        const score = (fits ? 8000 : 0) + (clear ? 4000 : 0) + (limb ? 2000 : 0) + (out ? 1000 : 0) + room;
        if (!best || score > best.score || (score === best.score && ctN.z < best.nz)) {
          best = { panel: p, score, fits, sign, room, nz: ctN.z, F: ctV.clone(), n: ctN.clone(), at: [ctA.x, ctA.y, x, y] };
        }
      });
      if (!best) return null;
      // THE TURN's rest, in world space: align · tilt · roll, over the spin.
      const rand = mulberry32(hashSeed(`process-contact-${panels.indexOf(best.panel)}`));
      ctCam.set(-offsetX - best.F.x, -offsetY - best.F.y, z - best.F.z).normalize();
      const qW = new THREE.Quaternion().setFromUnitVectors(best.n, ctCam).multiply(G);
      ctAxis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5); // a seeded direction…
      ctAxis.addScaledVector(ctCam, -ctAxis.dot(ctCam)); // …made square to the lens ray (the tilt's axis)
      if (ctAxis.lengthSq() < 1e-6) ctAxis.set(1, 0, 0);
      ctAxis.normalize();
      ctQ.setFromAxisAngle(ctAxis, THREE.MathUtils.degToRad(8 + rand() * 10));
      ctQ2.setFromAxisAngle(ctCam, THREE.MathUtils.degToRad((35 + rand() * 35) * (rand() < 0.5 ? -1 : 1)));
      qW.premultiply(ctQ).premultiply(ctQ2);
      return { panel: best.panel, F: best.F, qW, fits: best.fits && best.sign, room: best.room, at: best.at.map(Math.round), pool, nz: +best.nz.toFixed(2) };
    };
    const freeContact = (pick, k = 0) => {
      contact.panel = pick.panel;
      contact.F.copy(pick.F);
      contact.qW.copy(pick.qW);
      contact.k = k;
      contact.fits = pick.fits;
      contact.room = pick.room;
      contact.at = pick.at;
      contact.pool = pick.pool;
      contact.nz = pick.nz;
    };
    // The tick's (after the spin lands): the freed shard's pose on k, counter-rotated.
    const composeContact = () => {
      const p = contact.panel;
      const k = Math.min(Math.max(contact.k, 0), 1); // the Turn curve dips a hair under 0 at launch
      ctInv.copy(globeGroup.quaternion).invert();
      ctV.copy(contact.F).applyQuaternion(ctInv);
      ctHome.copy(p.homeOffset).multiplyScalar(p.mesh.scale.x);
      p.mesh.position.lerpVectors(ctHome, ctV, k);
      ctQ.copy(ctInv).multiply(contact.qW);
      p.mesh.quaternion.slerpQuaternions(IDENTITY_QUAT, ctQ, k);
    };
    /* Let the shard go: `home` snaps it into its slot (an instant pose, the
       flight home's last frame); otherwise its live pose stays for the morph
       to carry. `kill` false from inside a timeline's own call (the GSAP
       killTweensOf trap). A hover pulse dies with it (no tween — the caller
       recovers the light when there is time to). */
    const releaseContact = (home = true, kill = true) => {
      if (kill) gsap.killTweensOf(contact);
      const p = contact.panel;
      if (!p) return;
      if (!home) composeContact();
      if (p.pulse) {
        p.pulse.kill();
        p.pulse = null;
      }
      if (home) {
        p.mesh.position.copy(p.homeOffset).multiplyScalar(p.mesh.scale.x);
        p.mesh.quaternion.copy(IDENTITY_QUAT);
      }
      contact.panel = null;
      contact.k = 0;
    };
    /* first_contact — the fourth chip family, a MODE on the S1 machinery
       (slot.cta, the spec sheet's pattern): from the landing, one look per
       beat until it seats — the freed shard facing the lens, its readable
       seat (chipFits strict: frame + keep-out incl. the risen footer +
       clear of other chips; OUTWARD first, inward where the pick found
       nothing else — a phone) — the next pool fill on its
       first naming (fillOf), held until the CTA leaves (leaveLabels' letter
       cut), re-seated on a later beat if a keep box cuts it. No pulse of
       its own: the CTA's hover/focus drives the shard (onCtaHover). Reduced
       motion has no chip slots. */
    const contactBeat = () => {
      contact.dc = null;
      if (!contact.active || disposed || !contact.panel) return;
      contact.dc = gsap.delayedCall(60 / Math.max(TUNING.bpm, 1), contactBeat);
      if (activeTl || labelSlots.some((sl) => sl.cta && sl.target)) return; // in flight, or up / still leaving
      const slot = labelSlots.find((sl) => !sl.target);
      if (!slot) return;
      contact.tries += 1;
      refreshLabelMatrices();
      if (labelProminence(contact.panel) < LABEL_BIND_FACING) return;
      const cand = { pos: contact.panel.mesh.position, panel: contact.panel, decoy: null, term: CONTACT_TERM };
      // 10-07 (w7): either side — chipFits tries the outward seat first,
      // so the inward one is taken only where the pick found no other
      if (!chipFits(cand, labelView(), slot, true)) return;
      slot.dc?.kill();
      slot.dc = null;
      slot.cta = true;
      contact.held.add(cand.pos);
      bindLabel(slot, cand);
      contact.seatedAt = performance.now();
    };
    const startContact = (delay = 0) => {
      if (PREFERS_REDUCED_MOTION || !labelSlots.length || !contact.panel || contact.active) return;
      contact.active = true;
      contact.tries = 0;
      contact.dc?.kill();
      contact.dc = gsap.delayedCall(delay, contactBeat);
    };
    /* The CTA's actions → the freed shard (ProcessPage dispatches in a rAF):
       hover / focus pulses it on the house envelope (pulseOn — the S1 label
       pulse: snap down to ?labelpulse × the CTA's full power, hold, recover,
       for as long as it lasts); off recovers. Only at the rest — a landing
       picks up a hover already held. */
    const onCtaHover = (e) => {
      contact.hover = Boolean(e.detail?.on);
      const p = contact.panel;
      if (!p || stage !== 'cta' || activeTl) return;
      if (contact.hover) pulseOn(p);
      else pulseOff(p);
    };
    if (!PREFERS_REDUCED_MOTION) window.addEventListener('swm:process-cta-hover', onCtaHover);

    /* — Instant pose application (arrival sync + every RM boundary) — */
    const applyPose = (pose) => {
      stopTour(); // an instant pose owns the camera outright
      stopFlight();
      const { z, offsetX, offsetY } = framingFor(pose);
      // x/y as well as z: the S1 tour trucks the camera off-axis, and an
      // instant pose must land on the establishing frame, not on wherever
      // the path happened to be.
      camera.position.set(0, 0, z);
      globeGroup.position.x = offsetX;
      globeGroup.position.y = offsetY;
      const belt = pose.form === 'belt';
      // The hero rest: the lockup draws the O, the shards wait unseen.
      const hero = pose.form === 'hero';
      heroIntact = hero;
      heroReforming = false;
      gsap.killTweensOf(heroCore.scale);
      heroCore.visible = false;
      panels.forEach((p) => {
        const u = p.mesh.material.uniforms;
        gsap.killTweensOf(u.uBlueMix);
        u.uBlueMix.value = 0;
        gsap.killTweensOf(p.gh); // 10-09 (w9b): no ghost off S2 (restThread lays S2's)
        p.gh.k = 0;
        u.uPower.value = pose.power;
        u.uStrokeMix.value = pose.stroke;
        u.uStrokeWidthPx.value = TUNING.strokePx;
        p.mesh.scale.setScalar(hero ? 0 : pose.panelScale);
        if (belt || hero) {
          p.mesh.position.copy(p.beltPos);
          p.mesh.quaternion.copy(p.beltQuat);
          p.driftFactor = belt ? 1 : 0;
        } else {
          p.mesh.position.copy(p.homeOffset).multiplyScalar(pose.panelScale);
          p.mesh.quaternion.copy(IDENTITY_QUAT);
          p.driftFactor = 0;
        }
      });
      innerSphere.visible = pose.innerScale > 0.001;
      innerSphere.scale.setScalar(Math.max(pose.innerScale, 0.001));
      gsap.killTweensOf(innerMaterial.color); // 10-07 (w4): the seams snap with the pose
      innerMaterial.color.setHex(pose.innerColor ?? GAP_COLOR);
      gsap.killTweensOf(tiltState);
      tiltState.z = pose.tilt ?? 0;
      // Decoy pool snaps with the pose: full flood in stage-01, gone
      // everywhere else (RM stills included — stage-02's still is the
      // already-refined belt).
      decoyMaterial.uniforms.uPower.value = pose.power;
      decoyMaterial.uniforms.uStrokeMix.value = pose.stroke;
      decoyMaterial.uniforms.uStrokeWidthPx.value = TUNING.strokePx;
      gsap.killTweensOf(decoyMaterial.uniforms.uBlueMix); // 10-07 (final review): the break's heat
      decoyMaterial.uniforms.uBlueMix.value = 0;
      decoys.forEach((d) => {
        gsap.killTweensOf(d);
        gsap.killTweensOf(d.pos); // a killed mid-fall leaves pos displaced —
        if (d.beltPos) d.pos.copy(d.beltPos); // snap back to the belt slot
        d.s = pose.decoys ? 1 : 0;
      });
      decoyMesh.visible = Boolean(pose.decoys);
      composeDecoys();
      bgInstant(pose);
      gsap.killTweensOf(fogState);
      fogState.amount = poseFog(pose);
      beltDrifting = belt && !PREFERS_REDUCED_MOTION;
      s2DotsSet([]); // 10-09 (w9b): the hit dots go with the string (restThread re-lays S2's)
    };

    const tweenQuat = (tl, mesh, target, duration, at) => {
      const start = mesh.quaternion.clone();
      const proxy = { t: 0 };
      tl.to(
        proxy,
        {
          t: 1,
          duration,
          ease: turnEase,
          onUpdate: () => mesh.quaternion.slerpQuaternions(start, target, proxy.t),
        },
        at
      );
    };

    /* — 10-07 (w5, s4-out-then-in): the S4 emanation's schedule, ONE copy.
       v2 deck (B7): the emanation answers a beat AFTER the scroll commit
       (EMANATE_LAG — weight/tension), with a wider stagger spread and a
       seeded per-panel jitter for a livelier offset. emanateAt(p) is a
       panel's burst start on a forward step, s (× durMult in a transition). — */
    const EMANATE_LAG = 0.16;
    const emanateAt = (p) =>
      EMANATE_LAG +
      panelDelay(p, TUNING.emanateOrder, TOTAL_ROWS) * 0.85 +
      (p.drift.phase / (Math.PI * 2)) * 0.12;
    /* When S3→S4's PUSH-IN starts, s into the transition: the last panel's
       burst 35% done (≈1.15s at the bake) — burst, settle, THEN the approach
       (they used to share the same 0.25s, so neither read). ?s4push > 0
       overrides it. THE one number: buildTransition starts the camera on it
       and the copy's COPY_BEAT['stage-04'] lead is it − 0.35, so BUILD_WORLD
       rises with the push (the api's s4PushAt). The span is sampled once per
       ?emanateorder — the jitter it carries moves the push ≤0.04s. */
    let s4Span = null;
    const s4PushAt = () => {
      if (TUNING.s4Push > 0) return TUNING.s4Push;
      if (!panels.length) return 0;
      if (s4Span?.order !== TUNING.emanateOrder) {
        s4Span = { order: TUNING.emanateOrder, at: Math.max(...panels.map(emanateAt)) };
      }
      return s4Span.at + 0.35 * TUNING.stageSeconds * 0.6;
    };

    /* — 10-09 (w9, s2-hold): the S2/S3 split's clocks, ONE copy each (the
       s4PushAt pattern — the copy hook reads them through the api).
       THREAD_HEAD is the cull's head start before the first hop; the pull
       back to the constellation waits for the last hop's claim plus the
       settle (the riser's held BREATH when ?threadaccel ≠ 1 — part of the
       riser's gesture; the even cadence keeps its old 0.15s). — */
    const THREAD_HEAD = 0.55;
    const THREAD_BREATH = 0.45;
    const THREAD_SETTLE = 0.15;
    const threadRiser = () => Math.abs(Math.max(TUNING.threadAccel, 0.05) - 1) > 1e-6;
    /** s into the S1→S2 show: the last hop's claim — the dots are connected. */
    const s2ConnectEnd = () =>
      Math.min(TUNING.threadHops, panels.length) > 0 ? THREAD_HEAD + Math.max(TUNING.threadSeconds, 0.1) : THREAD_HEAD;
    /** s into the S1→S2 show: the pull back to the whole constellation —
     *  THE number S2's blurb rises on (COPY_BEAT['stage-02'].rises). */
    const s2RevealAt = () => s2ConnectEnd() + (threadRiser() ? THREAD_BREATH : THREAD_SETTLE);
    /** S2→S3's IGNITION window, s into that transition: `at` = the Core is
     *  whole (?assemble), `dur` = the field's grow (?zoomout). THE number
     *  S3's copy leads from (COPY_BEAT['stage-03']) and w9b's field rides;
     *  the breath, the cascade and the seams keep their pre-w9 offsets
     *  inside it (the Core goes out at at + dur·0.5, ignites at
     *  at + dur·0.5 + 0.5). */
    const s3Ignition = () => ({ at: Math.max(TUNING.assembleSeconds, 0.3), dur: Math.max(TUNING.zoomOutSeconds, 0.05) });

    /* — S1→S2 authored show: the Thread CONNECTS, then the reveal.
       The string is the MECHANISM, not an annotation: each hop claims its
       bead. 10-09 (w9, s2-hold — Nathan: "once the dots are connected, then
       the main blurb text comes up, and then let's hold the animation of the
       core being assembled until you scroll to Core Assembly"): connect
       ONLY. The cull, the hop-by-hop draw and its claims, the words and the
       counter, the tight lens creeping back — as before; then, the dots
       connected, the camera pulls back to frame the whole constellation
       (the reveal Nathan saved for S2, 09-10) while S2's blurb rises (the
       copy's rise lead — s2RevealAt). The shards stay in the belt, claimed
       and damped, the string drawn through them (updateThread follows the
       drifting attach points). The assembly is S3's (buildAssembleAndIgnite). — */
    const buildConnect = (pose) => {
      // The gathering annotation ends where the refinement begins. 10-07
      // (w3, chip-exit): it LEAVES — each chip on its letter cut, fills
      // retracting — instead of the hard stop's blanket fade, which smeared
      // the project colours through mud as the Thread began.
      leaveLabels();
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        // goTo knows the show by this tag: a forward step rushes it instead
        // of cutting it.
        data: 'connect',
        onComplete: () => {
          activeTl = null;
          // The reader stepped on while it played: the show has landed, now
          // their stage plays whole (nothing running, so uncompressed).
          const queued = pendingNext;
          pendingNext = null;
          if (queued) goTo(queued);
        },
      });
      landFlight(tl, 0.45);
      threadChain = buildChain();
      lastChain = threadChain; // 10-09 (w9): S3→S2 un-peels back onto it
      s2DotsSet(threadChain); // 10-09 (w9b): this show's dots, none struck
      threadDraw = { frac: 0, alpha: 1 };
      threadActive = true;
      startThreadWords();
      countOn = false;
      foldedAt = Infinity; // 10-09 (w9 fix): references_folded pings on the first hop past the headline (pingFolded)
      /* 10-09 (w9b, s2-dots): the count IS the dots — every show opens on the
         first show's empty line, never the last visit's `42/42` over 0 dots
         (written at the commit, S2's card still below the fold). */
      const capEl = captionEl('stage-02');
      if (capEl) {
        captionTweens.get(capEl)?.kill();
        captionTweens.delete(capEl);
        capEl.textContent = '';
      }
      // 10-09 (w9): S2's own arrival, whole — its blurb waits for the dots
      // (COPY_BEAT['stage-02'].rises); the headline lands on the line.
      copyBeat?.('stage-02', 'full');

      // B5 (v2 deck): push INTO the floating cloud while the flood sheds
      // its decoys. 07-30 rework: the shed is PROLONGED — exits spread
      // across ~3.5s of the Thread's connect phase (half flicker, half
      // fall out of frame) so the cull itself reads as the refinement,
      // leaving the 84 keepers for the string to claim.
      const HEAD = THREAD_HEAD;
      // From wherever the tour left the lens, glide to a TIGHT station on the
      // first bead (?threadtight, the tour's dolly units) — one gesture, never
      // a cut — then creep back toward the wide across the trace
      // (?threaddrift of the way). The tick solves the station live while
      // threadCamActive; the reveal below takes the camera over at at0.
      // 10-09 (w9): ?threadtight stays a fraction of the CORE's rest
      // distance (pre-w9's S2 framing: frame 1 at ?fillfrac) — S2's own
      // rest is the constellation's wide now, ≈2.8× further back.
      const tight = THREE.MathUtils.clamp(TUNING.threadTight, 0.05, 1);
      const drift = THREE.MathUtils.clamp(TUNING.threadDrift, 0, 1);
      threadSt.panel = threadChain[0] ?? null;
      threadSt.k = tight;
      threadSt.coreZ = framingFor({ form: 'core', frameR: 1, fill: TUNING.fillFraction }).z;
      threadCam.t = 0;
      threadCamFrom.copy(camera.position);
      threadCamActive = Boolean(threadSt.panel);
      tl.to(threadCam, { t: 1, duration: 0.75 }, 0);
      // The haze belongs to the gathering: it burns off across the connect,
      // so the constellation rests with no atmosphere at all (Nathan: "fade
      // to no atmospheric effect on the second slide").
      gsap.killTweensOf(fogState);
      tl.to(
        fogState,
        { amount: 0, duration: Math.max(TUNING.assembleSeconds, 0.3), ease: 'power2.inOut' },
        0.2
      );
      decoysOut(tl, 0.15, 3.4, true);

      // Connect: hop-by-hop trim-path draw; each strike stamps the
      // Fragment a shade darker (claimed) and damps its drift to a
      // gentle hold — the bead is on the string.
      /* 10-07 (w4, thread-riser): hop i starts at HEAD + T·(i/N)^q — the
         whole trace is ?threadsecs (T) whatever ?threadhops (N) is, and
         ?threadaccel (q) shapes its cadence. q = 1 is the even metronome and
         reproduces the old ?threadms = 100 × 42 hops to the frame (same
         starts, same 0.1s draws, connectEnd 4.75s). q < 1 is THE RISER — a
         deliberate, gesture-level departure from the Turn curve that exists
         only when q ≠ 1: the hops crowd toward the end like a drum roll, the
         tension releasing into a held BREATH before the pull (Nathan's A/B:
         84 beads at q 0.6 keeps the 4.2s connect at twice the beads). Each
         draw still rides turnEase; the claim fires as the next hop starts. */
      const N = threadChain.length;
      const T = Math.max(TUNING.threadSeconds, 0.1);
      const q = Math.max(TUNING.threadAccel, 0.05);
      const riser = threadRiser();
      const hopAt = (i) => HEAD + T * (N ? (i / N) ** q : 0);
      /* 10-09 (w9b, s2-ghost): every shard GHOSTS as the lens finds the
         first bead — over the cull's head start on the Turn curve, done
         before the first strike (hopAt(1)); each hit lifts its bead's. */
      const ghostIn = Math.max(Math.min(HEAD + 0.05, (N ? hopAt(1) : HEAD) - 0.02), 0.1);
      panels.forEach((p) => tl.to(p.gh, { k: 1, duration: ghostIn }, 0));
      threadChain.forEach((panel, i) => {
        const at = hopAt(i);
        const next = hopAt(i + 1);
        tl.to(threadDraw, { frac: (i + 1) / N, duration: next - at, ease: turnEase }, at);
        tl.call(
          () => {
            s2Hit(panel, i); // 10-09 (w9b): un-ghost, ping, dark, dot (w9: the dip-and-settle claim)
            // 10-07 (w4, thread-words): the bead's S1 word, and the count.
            bindThreadWord(panel);
            pingFolded(next);
            threadCount(i + 1, N, next);
          },
          null,
          next
        );
      });

      const connectEnd = s2ConnectEnd(); // N ? HEAD + T : HEAD
      tl.to(
        threadSt,
        { k: tight + (1 - tight) * drift, duration: Math.max(connectEnd - HEAD, 0.1), ease: 'sine.inOut' },
        HEAD
      );
      /* 10-07 (w4, thread-riser): the riser's last hops crowd into its last
         second, and the tight lens on the first bead left them striking off
         screen (84 beads at q 0.6: 4 of the last 30 in frame). So under the
         riser only, the lens backs out to the Core's own distance (k → 1)
         across that last second — the drum roll is SEEN — instead of the
         cadence being flattened. overwrite:'auto' hands k over from the drift
         above; the even default never runs this (today's look, exactly). */
      if (riser && N) {
        const rampAt = Math.max(connectEnd - 1, HEAD);
        tl.to(threadSt, { k: 1, duration: connectEnd - rampAt, ease: turnEase, overwrite: 'auto' }, rampAt);
      }
      // 10-07 (w4): dots_connected is the counter now (threadCount, per hop);
      // here it lands on the full count, whatever a short ?threadsecs skipped.
      tl.call(() => {
        pingFolded(connectEnd); // ?threadhops 0 (no hop calls): the line still gets its first beat
        threadCountEnd(N);
      }, null, connectEnd);

      // The pull (at0): after the riser's BREATH, or the even cadence's
      // settle (s2RevealAt — the same number the copy reads).
      const at0 = s2RevealAt();
      // The Thread's words leave together on the pull (the house exit; a
      // chip lives for one camera station).
      tl.call(() => leaveThreadWords(), null, at0);
      // 10-07 (w4 fix): …and none binds once a whole word-life no longer
      // fits before it (≈1.15s: typed in, wiped, THREAD_WORD_READ).
      tl.call(closeThreadBind, null, Math.max(at0 - (CHIP_TYPE_IN_S() + CHIP_WIPE_S + THREAD_WORD_READ), HEAD));

      // THE REVEAL (10-09, w9): the camera pulls back to frame the whole
      // connected constellation — S2's rest framing (the belt's contain fit,
      // lifted clear of the card on a phone) over ?assemble, the length the
      // pull rode the assembly before. The live thread station hands the
      // camera over a hair before the tween records its start.
      const { z, offsetX, offsetY } = framingFor(pose);
      const pullSecs = Math.max(TUNING.assembleSeconds, 0.3);
      tl.call(() => {
        threadCamActive = false;
      }, null, Math.max(at0 - 0.01, 0));
      tl.to(camera.position, { x: 0, y: 0, z, duration: pullSecs }, at0);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: pullSecs }, at0);
      return tl;
    };

    /* — THE ASSEMBLY (07-13, the string pulled taut) — shared since 10-09
       (w9): S2→S3 plays it from the constellation (it closed the S1→S2 show
       before). Chained Fragments seat in HOP ORDER across the leading window
       (the taut-string read); the rest follow, nearest-to-center first,
       while the blue foundation surfaces behind the shell and the string
       rides its beads inward — no fade: the closing shell and the surfacing
       inner sphere OCCLUDE it (B3), the beads swallowing their own string.
       10-07 (w4, s2-core-uniform): a bead's claim stamp leaves it at 0.85×
       ?idlepower, so each brightens back to `power` as it seats (the last
       lands ≈at0 + 2.15s) — the Core built on the way in is never MOTTLED;
       overwrite:'auto' takes any stamp still running. Returns the time the
       last panel lands (at0 + ?assemble). Kills run at BUILD time. — */
    const buildAssembly = (tl, at0, chain, power) => {
      const assembleSeconds = Math.max(TUNING.assembleSeconds, 0.3);
      // the seams are blue before the inner sphere surfaces — an interrupted
      // colour tween is killed HERE (a killTweensOf inside this timeline's
      // own call is the trap that eats its later tweens); at0 only sets the hex.
      gsap.killTweensOf(innerMaterial.color);
      tl.call(() => {
        beltDrifting = false;
        panels.forEach((p) => {
          gsap.killTweensOf(p);
          p.driftFactor = 0; // assembled — the belt never reclaims these
        });
      }, null, at0);

      const perDur = Math.min(assembleSeconds * 0.45, 1.1);
      const staggerWindow = assembleSeconds - perDur;
      const chainShare = Math.min(0.75, chain.length / panels.length + 0.4);
      const chainedWindow = staggerWindow * chainShare;
      const chainSet = new Set(chain);
      const rest = panels
        .filter((p) => !chainSet.has(p))
        .sort((a, b) => a.mesh.position.lengthSq() - b.mesh.position.lengthSq());
      const delayFor = new Map();
      chain.forEach((p, i) => {
        delayFor.set(p, chain.length > 1 ? (i / (chain.length - 1)) * chainedWindow : 0);
      });
      rest.forEach((p, i) => {
        const t = rest.length > 1 ? i / (rest.length - 1) : 0;
        delayFor.set(p, chainedWindow * 0.55 + t * (staggerWindow - chainedWindow * 0.55));
      });
      /* 10-09 (w9b): S2's refine leaves with the seating — a ghosted shard
         clears as it flies in (gone by the time it seats), and a bead's DOT
         rides it in and is swallowed as it lands (all by the Core's whole,
         the ignition's at — none at the S3 rest). */
      const dotOf = new Map(s2Dots.chain.map((p, i) => [p, s2Dots.d[i]]));
      const dotOut = S2_DOT_IN * EXIT_RATIO;
      panels.forEach((p) => {
        const at = at0 + delayFor.get(p);
        tl.to(p.mesh.position, { x: p.homeOffset.x, y: p.homeOffset.y, z: p.homeOffset.z, duration: perDur }, at);
        tweenQuat(tl, p.mesh, IDENTITY_QUAT, perDur, at);
        if (chainSet.has(p)) {
          tl.to(p.mesh.material.uniforms.uPower, { value: power, duration: perDur, overwrite: 'auto' }, at);
        }
        if (p.gh.k > 1e-4) tl.to(p.gh, { k: 0, duration: perDur }, at);
        const dot = dotOf.get(p);
        if (dot && (dot.hit || dot.k > 0)) {
          const out = Math.max(at + perDur - dotOut, 0);
          tl.call(() => {
            dot.hit = false;
          }, null, out);
          tl.to(dot, { k: 0, duration: dotOut, ease: 'power2.in' }, out);
        }
      });

      tl.call(() => {
        innerSphere.visible = true;
        innerMaterial.color.setHex(GAP_COLOR); // killed at build (above) — only the hex here
      }, null, at0);
      tl.to(innerSphere.scale, { x: INNER_SPHERE_SCALE, y: INNER_SPHERE_SCALE, z: INNER_SPHERE_SCALE, duration: assembleSeconds * 0.8 }, at0 + assembleSeconds * 0.15);
      return at0 + assembleSeconds;
    };

    /* — THE IGNITION (10-07, w4, s3-ignition; one window since 10-09, w9 —
       s3Ignition). From `at` the solid field GROWS out of the Core's live
       disc over `dur` (the solidify; bgMorph chases the dolly); as it lands
       (half the window) the Core goes OUT — every panel to 0 power on the
       Turn curve, ≈0.3s dark on the field, only the inner sphere's lattice
       holding its shape — then IGNITES at at + dur·0.5 + 0.5: the page's
       single loudest beat, the cascade flicker, the ink going to the pose's
       on the same delay model, the seams turning to ?coreseam just after it
       so the lattice survives the light; the Core is named once its last row
       has settled (w5, the spec sheet — never inside the cascade).
       10-10 (w9c): the solid is BLUE by default — a black Core silhouette on
       the flood, then the cascade lights it into the field (#0000FF on
       #0000FF) and it stands as its edge ink + seams: a line drawing. On
       ?opening=blue it is w9b's black flood and burn-off, unchanged.
       10-10 (w9c fix, scr-1 — ?ignite): …but that black silhouette sat on
       the blue flood for ≈1s and the cascade then DISSOLVED it into the
       field: the light-up read inverted. `auto` (PROPOSED): on a solid that
       IS the lit colour the Core goes INTO the light instead of out — as the
       flood lands every panel rises to full power and its ink goes, the Core
       one with the light it floods the page with — and the cascade DRAWS it
       back, the edge ink in on the cascade's own order and delays, the seams
       turning just after: the line drawing assembles in the light. Same
       window, same ignition beat (the copy and the spec sheet keep their
       clocks). On a black solid (?opening=blue) and on `dark` it is the
       blackout and the flicker, as built.
       Returns the ignition (the cascade's start). — */
    const buildIgnition = (tl, at, dur, pose) => {
      const lightAt = at + dur * 0.5 + 0.5;
      const intoLight = TUNING.ignite !== 'dark' && FIELDS[fieldOf(pose.bg)]?.hex === LIT_COLOR;
      tl.call(() => setBgAttr(pose.bg), null, at);
      bgMorph(tl, at, dur, true);
      panels.forEach((p) => {
        const u = p.mesh.material.uniforms;
        tl.to(u.uPower, { value: intoLight ? 1 : 0, duration: 0.2, ease: turnEase }, at + dur * 0.5);
        if (intoLight) tl.to(u.uStrokeMix, { value: 0, duration: 0.2, ease: turnEase }, at + dur * 0.5);
      });
      // The cascade's head `set 0`s render AT CREATION (gsap's zero-duration
      // rule — fireTease's note): into the light it is only the clock, so the
      // live levels go back in this same synchronous call (no frame sees 0)
      const live = intoLight ? panels.map((p) => p.mesh.material.uniforms.uPower.value) : null;
      const cascadeTl = buildCascadeTimeline(panels, TUNING.cascadeVariant, TOTAL_ROWS);
      const cascadeDur = cascadeTl.duration();
      if (intoLight) {
        cascadeTl.kill();
        panels.forEach((p, i) => (p.mesh.material.uniforms.uPower.value = live[i]));
      } else {
        tl.add(cascadeTl, lightAt);
      }
      tl.call(startSpecSheet, null, lightAt + cascadeDur);
      panels.forEach((p) => {
        // 10-10 (w9c): to the pose's ink — 0 on the black solid (?opening=blue,
        // the burn-off as built); on the blue solid S3 keeps its edge ink
        // (FIELDS.blue.ink 1): lit, the panels ARE the field, so the light
        // turns the Core into its line drawing (into the light: from 0 —
        // the cascade drawing it)
        tl.to(
          p.mesh.material.uniforms.uStrokeMix,
          { value: pose.stroke, duration: 0.3, ease: 'power2.out' },
          lightAt + panelDelay(p, TUNING.cascadeVariant, TOTAL_ROWS)
        );
      });
      const seam = new THREE.Color(pose.innerColor ?? GAP_COLOR);
      tl.to(innerMaterial.color, { r: seam.r, g: seam.g, b: seam.b, duration: 1.3 }, lightAt + 0.15);
      return lightAt;
    };

    /* — S2→S3 authored (10-09, w9, s2-hold — Nathan: "it doesn't make sense
       that the core is assembled prior to the core_assembly section"): the
       constellation ASSEMBLES (the pull, hop-order seating, the inner
       sphere surfacing, the Thread swallowed by its beads) and once the Core
       is whole the IGNITION plays (s3Ignition().at). The camera is ONE leg on
       the Turn curve from the constellation's wide to S3's framing across
       both beats: both sit back from the Core (≈2.87 vs ≈3.23 Core radii over
       tanFit at the bake — ?fillfrac on the belt's ?scatter bound, ?s3fill
       on the Core), so it only ever pulls back, never out then in. The
       authored step only (forward, whole, not a jump — a queued step after
       the rushed show is whole); anything else is the generic morph. — */
    const buildAssembleAndIgnite = (pose) => {
      leaveLabels(false, 'stage-03');
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        data: 'assemble',
        onComplete: () => {
          activeTl = null;
          startSpecSheet(); // every S3 landing names the Core (it dedupes)
        },
      });
      // S3's own arrival, whole: its copy leads from the ignition
      copyBeat?.('stage-03', 'full');
      const { at: ignAt, dur } = s3Ignition();
      const chain = threadActive && threadChain.length ? threadChain : s2Chain();
      threadCamActive = false;
      /* 10-09 (w9 fix): a commit taken mid-?tease — cancelTease only kills
         the flicker — left the equator row wherever it stood, and a shard
         that is no bead held it (0.18–1.12) through the whole assembly until
         the ignition's blackout (≈2.85s). Every panel off its S2 rest glides
         back to it first, on the tease's own settle (0.6s, the Turn curve);
         a bead's seat then takes it up (buildAssembly's overwrite:'auto' —
         built after this, so it wins). Read at BUILD time. */
      const beadSet = new Set(chain);
      panels.forEach((p) => {
        const u = p.mesh.material.uniforms.uPower;
        const restPower = beadSet.has(p) ? s2BeadPower() : TUNING.idlePower; // 10-09 (w9b): a bead's rest is dark
        if (Math.abs(u.value - restPower) > 1e-3) tl.to(u, { value: restPower, duration: 0.6 }, 0);
      });
      const whole = buildAssembly(tl, 0, chain, TUNING.idlePower);
      tl.call(clearThread, null, whole); // swallowed — lastChain keeps the string for the way back
      buildIgnition(tl, ignAt, dur, pose);
      const { z, offsetX, offsetY } = framingFor(pose);
      tl.to(camera.position, { x: 0, y: 0, z, duration: ignAt + dur }, 0);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: ignAt + dur }, 0);
      // no air on S2 or S3 — a show rushed short of its burn-off lands it here
      if (fogState.amount > 1e-4) {
        gsap.killTweensOf(fogState);
        tl.to(fogState, { amount: 0, duration: dur, ease: 'power2.inOut' }, 0);
      }
      return tl;
    };

    /* — S3→S2 authored (10-09, w9): the light-up run backwards, then the
       assembly (w4's reverse un-peel, moved here with the assembly).
       DE-IGNITE over the grow's window × EXIT_RATIO — the black field shrinks
       back into the Core (bgMorph; 10-10 (w9c): the SOLID field — blue on the
       black opening, black on ?opening=blue), the seams return to the blueprint blue,
       the light falls to ?idlepower and the ink comes back — then UN-PEEL at
       the exit ratio (?assemble × 0.7, outermost belt slot first) onto the
       constellation, minus the flood. The camera is one leg in, S3 → the
       constellation's wide. No tour. The authored step only; anything else
       morphs.
       10-09 (w9b, s2-reconnect — Nathan: "make sure we have the line drawing
       choreography occurring not only as the user goes through the first
       time but if they go back to that phase, it reconnects the dots"): the
       w9 string drawn WHOLE as the un-peel started is gone. Every shard lands
       GHOSTED and unclaimed, and then the Thread RECONNECTS them on the same
       chain (s2Chain), hop by hop at the show's cadence (?threadsecs,
       ?threadaccel) — each hit pings, goes dark and leaves its dot; the lead
       line counts 00 → 42 in plain writes (no scramble, no
       references_folded: the card is already whole), and the beads re-wear
       their S1 words. No tight lens: the camera is already landing on the
       rest. The string starts as early as it can while every hop still finds
       its bead landed (the first hops may overlap the un-peel's tail).
       'reconnect' is RUSHABLE like 'connect' (goTo's rush rule): a forward
       step plays the rest as a time-lapse, then S3 whole. — */
    const buildUnassemble = (pose) => {
      leaveLabels(true, 'stage-02'); // the spec chips, on the quick retract
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        data: 'reconnect',
        onComplete: () => {
          activeTl = null;
          beltDrifting = !PREFERS_REDUCED_MOTION;
          // a step taken while it played (the rush) lands now, whole
          const queued = pendingNext;
          pendingNext = null;
          if (queued) goTo(queued);
        },
      });
      copyBeat?.('stage-02', 'plain');
      const d1 = s3Ignition().dur * EXIT_RATIO;
      const A = Math.max(TUNING.assembleSeconds, 0.3);
      const span = A * EXIT_RATIO;
      const dur = Math.min(A * 0.45, 1.1) * EXIT_RATIO;
      const peelSpan = Math.max(span - dur, 0);
      // De-ignite. Kills at BUILD time (never in this timeline's own calls).
      tl.call(() => setBgAttr(pose.bg), null, 0);
      bgMorph(tl, 0, d1, false);
      gsap.killTweensOf(innerMaterial.color);
      const gap = new THREE.Color(GAP_COLOR);
      tl.to(innerMaterial.color, { r: gap.r, g: gap.g, b: gap.b, duration: d1 }, 0);
      beltDrifting = false;
      panels.forEach((p) => {
        gsap.killTweensOf(p);
        gsap.killTweensOf(p.gh);
        p.driftFactor = 0;
        tl.to(p.mesh.material.uniforms.uPower, { value: TUNING.idlePower, duration: d1 }, 0);
        tl.to(p.mesh.material.uniforms.uStrokeMix, { value: 1, duration: d1 }, 0);
      });
      // The string, from nothing: the same chain, undrawn, none struck.
      const chain = s2Chain();
      threadChain = chain;
      threadDraw = { frac: 0, alpha: 1 };
      threadActive = true;
      threadCamActive = false;
      s2DotsSet(chain);
      writeS2Count(0, chain.length); // dots_connected 00/42 — the card's lead line, plain
      startThreadWords();
      // Un-peel: each panel takes the assembly's own per-panel length at the
      // exit ratio, staggered across the rest of the span, outermost slot
      // first — landing GHOSTED, free (drift 1: no bead is claimed yet).
      const peelRank = new Map(
        [...panels].sort((a, b) => b.beltPos.lengthSq() - a.beltPos.lengthSq()).map((p, i) => [p, i])
      );
      const landAt = (p) => d1 + (peelRank.get(p) / Math.max(panels.length - 1, 1)) * peelSpan + dur;
      panels.forEach((p) => {
        const at = d1 + (peelRank.get(p) / Math.max(panels.length - 1, 1)) * peelSpan;
        tl.to(p.mesh.position, { x: p.beltPos.x, y: p.beltPos.y, z: p.beltPos.z, duration: dur }, at);
        tweenQuat(tl, p.mesh, p.beltQuat, dur, at);
        tl.to(p.gh, { k: 1, duration: dur }, at);
        tl.set(p, { driftFactor: 1 }, at + dur);
      });
      // The foundation sinks across the scatter (the assembly's surfacing, reversed).
      tl.to(innerSphere.scale, { x: 0.001, y: 0.001, z: 0.001, duration: span * 0.8 }, d1);
      tl.call(() => {
        innerSphere.visible = false;
      }, null, d1 + span * 0.8 + 0.01);
      // the constellation turns again once it has landed (the forward show's beads drift as they are struck)
      tl.call(() => {
        beltDrifting = !PREFERS_REDUCED_MOTION;
      }, null, d1 + span);
      // RECONNECT — hop i strikes at S + T·((i+1)/N)^q, S the earliest start
      // at which no hop strikes a bead still in flight
      const N = chain.length;
      // ?reconnectsecs (0 = the show's own ?threadsecs) — the shorter arm
      const T = Math.max(TUNING.reconnectSecs > 0 ? TUNING.reconnectSecs : TUNING.threadSeconds, 0.1);
      const q = Math.max(TUNING.threadAccel, 0.05);
      const hopOff = (i) => T * (N ? (i / N) ** q : 0);
      let S = d1 + dur;
      chain.forEach((p, i) => {
        S = Math.max(S, landAt(p) - hopOff(i + 1));
      });
      chain.forEach((panel, i) => {
        const at = S + hopOff(i);
        const next = S + hopOff(i + 1);
        tl.to(threadDraw, { frac: (i + 1) / N, duration: next - at, ease: turnEase }, at);
        tl.call(
          () => {
            s2Hit(panel, i);
            bindThreadWord(panel);
            writeS2Count(i + 1, N);
          },
          null,
          next
        );
      });
      const end = S + hopOff(N);
      const settleAt = end + (threadRiser() ? THREAD_BREATH : THREAD_SETTLE);
      // the words leave together on the settle (the show's pull); none binds
      // once a whole word-life no longer fits before it
      tl.call(() => leaveThreadWords(), null, settleAt);
      tl.call(closeThreadBind, null, Math.max(settleAt - (CHIP_TYPE_IN_S() + CHIP_WIPE_S + THREAD_WORD_READ), S));
      const { z, offsetX, offsetY } = framingFor(pose);
      tl.to(camera.position, { x: 0, y: 0, z, duration: d1 + span }, 0);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: d1 + span }, 0);
      return tl;
    };

    /* — hero → stage-01, the authored BREAK (10-07, Nathan: "a more sudden
       break apart fragmentation, an eye catching breaking of the globe that
       then has a smooth dramatic falloff that creates the effect of the
       panels getting caught in suspended animation").
       Four movements on one clock:
       · WIND — the lockup revs (?owind, ADDED to its ambient spin) and, for
         the last BREAK_BURN of it, bleaches white until the O is one white
         disc; the copy hook pinches the O, draws the word in toward it and
         burns the token down like a fuse (heroMark.onWind).
       · HITCH — BREAK_HITCH of dead-still white: the impact frame.
       · BREAK — the shards take the O over (breakHero) and blast out,
         equator first, on processShatter; the white core folds INWARD while
         the shock ring runs out along the O's tilted equator.
       · FALLOFF — the same curve's long tail: each shard cools to the belt's
         navy as it comes forward out of the haze, its tumble decaying into
         the drift; the decoys arrive on the inverse of their S1→S2 cull.
         Hung, not parked: the belt's yaw overtakes the flight mid-hang.
       Only the splash's cue (and the bench) gets the full wind. A reader who
       scrolls into the break gets the impact on the spot, FLASHED white: the
       O is about to glide off the top of the frame (the driver breaks it on
       the swipe's commit, not at stage-01's line — probe, 10-07: even a
       0.12s burn landed with the O out of frame), so its shards burst while
       it is still in view and hang in the scene as the word scrolls away.
       The camera holds the belt's establishing frame throughout — the
       shards are the subject. activeTl covers the wind and BURST_LOCK of the
       burst; the rest runs on sideTl, so the authored S1→S2 show is never
       "interrupted" by a cloud that is merely still settling, and the tour
       and the chips start on the settled wide off that same clock. */
    const BURST_LOCK = 0.6; // s after the impact the machine counts the break as in progress
    const buildShatter = ({ cue = false } = {}) => {
      stopLabels();
      const T = Math.max(TUNING.shatterSeconds, 0.3);
      const lockup = heroMark?.lockup?.() ?? null;
      const charge = Math.max(TUNING.shatterCharge, 0);
      const wind = lockup && cue ? charge : 0;
      const hitch = cue && wind > BREAK_HITCH * 2 ? BREAK_HITCH : 0;
      const restSeat = replaying; // the bench breaks the O from its rest seat
      const tl = gsap.timeline({
        onComplete: () => {
          activeTl = null;
        },
      });
      if (lockup && wind > 0) {
        // Anticipation accelerates INTO the break — never eases out of it.
        // The rev builds across the whole wind and the burn is only its
        // tail, so the spin is seen accelerating before the white takes it.
        const burn = Math.min(BREAK_BURN, wind - hitch);
        gsap.killTweensOf(lockup.charge);
        tl.to(lockup.charge, { boost: THREE.MathUtils.degToRad(Math.max(TUNING.oWind, 0)), duration: wind, ease: 'power2.in' }, 0);
        tl.to(lockup.charge, { k: 1, duration: burn, ease: 'power3.in' }, wind - hitch - burn);
        heroMark?.onWind?.(wind - hitch);
      }
      tl.call(
        () => {
          breakHero(restSeat, true);
          impactAt = performance.now();
          beginFlight('burst');
          beltDrifting = true; // decoys tumble on the way up; shards take the drift as they land
          sideTl?.kill();
          sideTl = gsap.timeline();
          let last = 0;
          panels.forEach((p) => {
            const f = p.fl;
            const dur = T * f.span;
            last = Math.max(last, f.delay + dur);
            sideTl.to(f, { t: 1, duration: dur, ease: shatterEase }, f.delay);
            // White-hot through the explosive frames, then cooling to the
            // belt's navy across the hang — the heat mix only: uPower stays
            // at idle (a panel at full power IS the field's blue). The heat
            // is painted OVER the haze, so it is what keeps a shard legible
            // while it is still deep in the haze (the bow front-loads the
            // flight since w2; the 0.62·T timing stands): a cool that lands
            // early leaves navy in full haze, a cloud that all
            // but vanishes (probe, 10-07: 0.6s dropped it out at +0.7s). It
            // lands before the chips — the palette never shares the heat.
            sideTl.to(
              p.mesh.material.uniforms.uBlueMix,
              { value: 0, duration: T * BREAK_COOL, ease: 'sine.inOut' },
              f.delay
            );
          });
          sideTl.call(() => {
            flightActive = false;
          }, null, last + 0.05);
          // The white core folds inward while everything else flies out.
          sideTl.to(heroCore.scale, { x: 0.001, y: 0.001, z: 0.001, duration: 0.16, ease: 'power2.in' }, 0);
          sideTl.call(() => {
            heroCore.visible = false;
          }, null, 0.17);
          if (TUNING.shatterShock !== 'off' && TUNING.shatterShock !== '0') {
            const r0 = SHOCK.from * RADIUS;
            const r1 = SHOCK.to * RADIUS;
            shockRing.quaternion.copy(heroQuat); // the O's own tilted equator
            shockRing.scale.setScalar(r0);
            shockMaterial.linewidth = SHOCK.px;
            shockRing.visible = true;
            sideTl.to(shockRing.scale, { x: r1, y: r1, z: r1, duration: SHOCK.seconds, ease: 'expo.out' }, 0);
            sideTl.to(shockMaterial, { linewidth: 0, duration: SHOCK.seconds, ease: 'power2.out' }, 0);
            sideTl.call(() => {
              shockRing.visible = false;
            }, null, SHOCK.seconds);
          }
          decoysArrive(sideTl, 0.06, 0.5, T * BREAK_COOL);
          // The settled wide is the tour's first station, and the chips wipe
          // in on it once the shards are all but still — and cool: the
          // palette never shares the screen with the heat.
          sideTl.call(startTour, null, T * 0.5);
          sideTl.call(() => holdWide(startLabels(0)), null, T * 0.73);
        },
        null,
        wind
      );
      tl.to({}, { duration: BURST_LOCK }, wind);
      return tl;
    };

    /* — → hero, the REFORM: the break run backwards, over ?reform.
       The WORD returns first — the copy hook cuts PR·CESS back in at the
       offsets the blast threw them to, around an EMPTY O slot, and closes
       them in on the house curve while the shards fly home
       (heroMark.onReformStart): the missing letter is the world. The shards
       leave from wherever they hang, far ones first, along each one's chord
       to its seat on the O, bowed outward at the midpoint (bowOf, re-solved
       every frame from the LIVE seat — the page is usually still gliding
       home), on processTurn, warming toward white
       along the way while the white core regrows behind them. On the
       landing frame the lockup takes the mark back over the identical white
       disc (burned and revving out of sight since the reform began), then
       cools to blue and spins down to its ambient. Rides buildTransition's
       shared legs (camera, haze, field, tilt, inner sphere).
       Every kill here runs at BUILD time: a gsap.killTweensOf inside one of
       this timeline's own calls also kills its later tweens of that target.
       10-07 (w2): its own length, ?reform — no longer ?shatter × the exit
       ratio (1.82s): the Turn curve's tail is 35% of its time on the last
       0.6% of the way, so that held an already-whole white O for ≈0.6s. */
    const buildReform = (tl, compressed) => {
      const D = Math.max(TUNING.reformSeconds, 0.3) * (compressed ? 0.65 : 1);
      const lead = Math.min(0.2, D * 0.2);
      const dur = D - lead;
      const boost = THREE.MathUtils.degToRad(Math.max(TUNING.oWind, 0));
      heroReforming = true;
      heroMark?.onReformStart?.(D);
      const lockup = heroMark?.lockup?.() ?? null;
      if (lockup) {
        gsap.killTweensOf(lockup.charge);
        lockup.charge.k = 1;
        lockup.charge.boost = boost;
      }
      gsap.killTweensOf(heroCore.scale);
      // Far shards first, from where they hang NOW: the nearest leave last,
      // so the cloud closes on the O together.
      placeHero();
      syncGroupFrame();
      let far = 1e-6;
      const dist = panels.map((p) => {
        const u = p.mesh.material.uniforms;
        gsap.killTweensOf(p);
        gsap.killTweensOf(p.mesh.scale);
        gsap.killTweensOf(u.uBlueMix);
        gsap.killTweensOf(u.uPower);
        gsap.killTweensOf(u.uStrokeMix);
        const d = heroWorld(p, flC).applyMatrix4(flInv).distanceTo(p.mesh.position);
        far = Math.max(far, d);
        return d;
      });
      tl.call(
        () => {
          beltDrifting = false;
          heroCore.visible = false; // a core caught mid-fold regrows on its cue below
          panels.forEach((p) => {
            p.driftFactor = 0;
          });
          beginFlight('reform');
        },
        null,
        0
      );
      panels.forEach((p, i) => {
        const at = lead * (1 - dist[i] / far);
        const u = p.mesh.material.uniforms;
        tl.to(p.fl, { t: 1, duration: dur, ease: turnEase }, at);
        tl.to(u.uPower, { value: TUNING.idlePower, duration: dur }, at);
        tl.to(u.uStrokeMix, { value: 1, duration: dur }, at);
        // The cooling, reversed: each shard warms as it is drawn back into
        // the deep haze (the heat paints over it, so the flight home stays
        // legible — a late heat left a navy ghost of the O for most of the
        // reform), and settles into white on its seat.
        tl.to(u.uBlueMix, { value: 1, duration: dur * 0.85, ease: 'sine.out' }, at + dur * 0.15);
      });
      const coreAt = D * 0.7;
      tl.call(() => {
        heroCore.scale.setScalar(0.001);
        heroCore.visible = true;
      }, null, coreAt);
      tl.to(
        heroCore.scale,
        { x: () => heroRingK, y: () => heroRingK, z: () => heroRingK, duration: D - coreAt, ease: 'power2.out' },
        coreAt
      );
      tl.call(
        () => {
          // The landing frame, DOM first: the white O over the identical
          // white disc, then the replica goes (it is under it either way).
          flightActive = false;
          heroReforming = false;
          heroIntact = true;
          heroMark?.onReform?.();
          panels.forEach((p) => p.mesh.scale.setScalar(0));
          heroCore.visible = false;
          const mark = heroMark?.lockup?.() ?? null;
          if (mark) {
            gsap.killTweensOf(mark.charge);
            mark.charge.k = 1;
            mark.charge.boost = boost;
            gsap.to(mark.charge, { k: 0, duration: 0.45, ease: 'power2.out' });
            gsap.to(mark.charge, { boost: 0, duration: 1.2, ease: 'power2.out' });
          }
        },
        null,
        D
      );
    };

    /* — Generic transitions: discrete, time-domain, house curve; exits
       ≈0.7×. Form-aware — also the compressed catch-up for interrupts. — */
    const buildTransition = (from, to, compressed, opts = {}) => {
      const pose = getPose(to);
      const fromPose = getPose(from ?? 'stage-01');
      const reversing = STAGE_IDS.indexOf(to) < STAGE_IDS.indexOf(from);
      const toHero = pose.form === 'hero';
      /* 10-07 (w7, cta-finale): THE TURN's two authored ends — the arrival
         (S5 → CTA, forward, whole, not a jump) plays the resolve + the lift;
         the return (CTA → S5, whole, not a jump) flies the freed shard home
         at the exit ratio. Any other way off the CTA (a jump, Home, a
         compressed catch-up, a return interrupted mid-flight) BAKES its live
         pose (releaseContact(false)) — the morph or the reform carries it
         like any panel. A hover pulse never rides a transition: killed with
         no tween (the morph takes uPower to its pose). */
      const ctaArrive = to === 'cta' && from === 'stage-05' && !reversing && !compressed && !opts.cut;
      const ctaReturn = from === 'cta' && to === 'stage-05' && Boolean(contact.panel) && !compressed && !opts.cut;
      if (contact.panel) {
        if (contact.panel.pulse) {
          contact.panel.pulse.kill();
          contact.panel.pulse = null;
        }
        if (!ctaReturn) releaseContact(false);
      }

      // The break is its own authored beat — from an intact O.
      if (to === 'stage-01' && from === 'hero' && heroIntact) {
        return buildShatter(opts);
      }
      // A jump out of the hero, or a wind-up overtaken by a further scroll:
      // the O breaks on the spot and this transition flies its shards.
      if (heroIntact && !toHero) breakHero(replaying);
      // A reform the reader scrolled out of: the word was already coming
      // back — the blast takes it again, and the shards go where this goes.
      if (heroReforming && !toHero) {
        heroReforming = false;
        heroMark?.onBreak?.();
      }
      // 10-09 (w9b): S2's hits stop HERE, at build time — a ping killed
      // mid-flash leaves its heat to coolHero (or at exactly 0 under its floor)
      killS2Fx();
      // Whatever a break left white-hot cools on a short beat (the reform
      // keeps the heat — it is about to burn them white again).
      if (!toHero) coolHero();

      if (to === 'stage-02' && from === 'stage-01' && !compressed) {
        return buildConnect(pose);
      }
      // 10-09 (w9, s2-hold): the assembly is S3's — S2→S3 assembles, then
      // ignites; S3→S2 de-ignites, then un-peels. The authored steps only
      // (whole, not a jump); a compressed catch-up or a jump morphs below.
      if (to === 'stage-03' && from === 'stage-02' && !compressed && !opts.cut) {
        return buildAssembleAndIgnite(pose);
      }
      if (to === 'stage-02' && from === 'stage-03' && !compressed && !opts.cut) {
        return buildUnassemble(pose);
      }

      const durMult = (compressed ? 0.65 : 1) * (reversing ? EXIT_RATIO : 1);
      // 10-07 (w3, chip-exit): a stage change is a LEAVE, not a hard stop —
      // S1→hero (the reform) and any jump off the belt cut the chips out on
      // the house exit; nothing rebinds while they go.
      // 10-07 (w5): the pulses recover to THIS stage's power (pulseOff).
      // 10-07 (w5 fix): off S3 the spec chips take the QUICK retract — the
      // Core moves under them every way out (S2's swell, S4's burst), and the
      // slow letter cut rode bare boxes out to the frame edges.
      leaveLabels(from === 'stage-03', to);
      /* 10-07 (w6, s5-drop): ONE predicate for S5's intro — the count-in and
         the drop play only on the authored step: from S4, forward, whole
         (not compressed, not a jump). It feeds BOTH the copy's cue ('full' =
         the stage-05 lead runs, so [[goes live]] wipes on the drop) and the
         landing's startLoops({ intro }); every other arrival goes straight
         to the groove. ?countin 0 = no intro. */
      const s5Intro =
        to === 'stage-05' &&
        from === 'stage-04' &&
        !reversing &&
        !compressed &&
        !opts.cut &&
        TUNING.countIn > 0;
      if (s5Intro) {
        // the readout opens the count-in NOW (the copy's lead counts from
        // here too): the 0.85s scramble lands with the morph, so count_in
        // reads through the held beats instead of only its last 0.2s
        s5Clear();
        s5Chapter = -1;
        s5Readout(s5Caption(0)); // count_in — NEW COPY
        s5BuildT = performance.now();
      } else if (to === 'stage-05') {
        // 10-07 (w7, item 7a): EVERY other S5 arrival opens blank too — the
        // last visit's page (p.03/05 …) never shows through the morph; the
        // groove's first pass writes a fresh page on the landing (10-08,
        // w8: p.01 — chapters page from the first pass; no drop, no live
        // line to hold for).
        s5Clear();
      }
      /* 10-08 (w8b, r1-heartbeat-exit): THE BEAT COMPLETES. stopLoops kills
         the S4 heartbeat where it stands, and the morph below reaches the
         panels' light only on its own schedule — S4→S3's pull-out from
         +0.64s, staggered — so a commit inside a dip (about one in four)
         HELD the world up to 22% dark, then lit it panel by panel, then S3
         took it down (dip → frozen hold → staggered rise → fall). Now an exit
         that finds the world below the heartbeat's rest (opts.dip: goTo saw
         the loop, or an exit still finishing one) recovers it from its live
         value on the pulse's own curve (?decaycurve) at the exit ratio, every
         panel in unison from 0 — the morph's per-panel power tween stands
         down (both end on the same lit rest: S3, S5 and the CTA share S4's
         power). Never a snap, and never longer than the exit already is
         (clamped below), so the S3 landing and the S5 count-in keep their
         clocks. A destination with other light (a jump to S2, the belt, the
         reform) keeps the morph: there the dip just falls on with the rest. */
      const hb = opts.dip ? heartbeatShape() : null;
      let livePower = Infinity;
      if (hb) panels.forEach((p) => (livePower = Math.min(livePower, p.mesh.material.uniforms.uPower.value)));
      // (below 0.995 of the rest: the expo tail past it is under 1/255 of the
      // blue, and a commit there builds the morph exactly as before)
      const recover = Boolean(hb) && !ctaArrive && Math.abs(pose.power - hb.rest) < 1e-3 && livePower < hb.rest * 0.995;
      const tl = gsap.timeline({
        data: recover ? 'recover' : undefined,
        defaults: { ease: turnEase },
        onComplete: () => {
          activeTl = null;
          if (pose.loops) startLoops(s5Intro ? { intro: true, transitionDur: tl.duration() } : undefined);
          // 10-07 (w5): every S3 landing names the Core (the light-up's own
          // call got there first; startSpecSheet dedupes).
          if (to === 'stage-03') startSpecSheet();
          if (pose.form === 'belt') {
            beltDrifting = !PREFERS_REDUCED_MOTION;
            // back on the belt — the camera resumes its walk (10-09, w9: not
            // on S2's constellation, which rests on its wide)
            if (!pose.thread) startTour();
          }
          // 10-07 (w3): landed back on the belt's wide — it holds until the
          // chips have typed in (holdWide), as the break's opening does.
          if (pose.decoys) holdWide(startLabels(0.15));
          /* 10-07 (w7, cta-finale): the CTA lands — the freed shard (if this
             arrival freed one) starts looking for its first_contact seat on
             the beat, and a hover already held picks up its pulse. */
          if (to === 'cta') {
            contact.landAt = performance.now();
            if (contact.panel) {
              startContact(0);
              if (contact.hover) pulseOn(contact.panel);
            }
          }
        },
      });

      // A running Thread show never survives an interrupt: this timeline owns
      // camera.position from 0 (the string itself is handled below, once
      // frameDur is known — 10-09, w9).
      if (threadActive) threadCamActive = false;

      // 10-07 (w7 fix): THE PICK before the morph is built, so the freed
      // shard sits out of it on the arrival as well as the return (the
      // morph's `p !== contact.panel` guard) — composeContact owns it.
      let ctaPick = null;
      if (ctaArrive) {
        gsap.killTweensOf(contact);
        ctaPick = pose.finale && !PREFERS_REDUCED_MOTION ? pickContact() : null;
        if (ctaPick) freeContact(ctaPick, 0);
      }

      const { z, offsetX, offsetY } = framingFor(pose);
      // 10-09 (w9): a forward arrival on S3 that is not the authored S2→S3
      // (a jump off the belt) still GROWS the black field over ?zoomout.
      // 10-10 (w9c): the SOLID field (fieldOf('solid') — blue by default).
      const isLightUp = to === 'stage-03' && !reversing && !compressed;
      const toBelt = pose.form === 'belt';
      // The pose table alone lies mid-show: interrupting S2→S3's assembly
      // arrives here with from='stage-03' (form core) while the belt is still
      // live — the tick would keep stamping belt transforms over this morph's
      // position tweens. Judge by actual state too.
      const fromBelt =
        fromPose?.form === 'belt' || fromPose?.form === 'hero' || beltDrifting || threadActive;
      /* 10-09 (w9): the un-peel (w4's reverse of the assembly) and the
         light-up's breath + ignition left this morph with the assembly — S3↔S2
         authored (buildUnassemble / buildIgnition). */
      const frameDur = (isLightUp ? TUNING.zoomOutSeconds : TUNING.stageSeconds) * durMult;
      /* 10-09 (w9, s2-hold): THE STRING follows the pose. Off S2 it RETRACTS
         (the trim path drawn back to the centre, never a fade): on S2→S1's
         own beat when that step plays whole, else on the interrupt's quick
         0.25s. Onto S2 (a compressed catch-up, a jump, a reload's re-drive)
         it is strung on the last show's chain (s2Chain) and DRAWS across the
         frame window from wherever it stands — each bead claimed in the
         morph below; the lead line reads the full count at once. */
      if (threadActive && !pose.thread) {
        const whole = from === 'stage-02' && to === 'stage-01' && !compressed;
        const retract = whole ? frameDur : 0.25;
        tl.to(threadDraw, { frac: 0, duration: retract, ease: whole ? turnEase : 'power2.in' }, 0);
        tl.call(clearThread, null, retract + 0.01);
      }
      // 10-09 (w9b, s2-dots): off S2 every dot goes as the trim passes it
      // (composeS2Dots — hop order reversed; a string already gone, at once)
      if (!pose.thread) {
        s2Dots.retract = true;
        // 10-09 (w9b fix R1): a dot caught MID-SHRINK (hit already false, k
        // partial — an S2→S3 assembly interrupted forward kills its dot-out
        // tween with the timeline) is past the trim's reach: it finishes going
        // here, at build time. Measured: 3–4 dots stranded on the S4 rest.
        s2Dots.d.forEach((d) => {
          if (!d.hit && d.k > 1e-3) s2DotShrink(d);
        });
      }
      if (pose.thread) {
        if (!threadActive || !threadChain.length) {
          threadChain = s2Chain();
          threadDraw = { frac: 0, alpha: 1 };
        }
        threadDraw.alpha = 1;
        threadActive = true;
        threadCamActive = false;
        keepHeld = null;
        tl.to(threadDraw, { frac: 1, duration: frameDur }, 0);
        writeS2Count(threadChain.length);
        // 10-09 (w9b): the CONNECTED REST — every bead's dot at once, each
        // growing across the morph window (the count is already full)
        if (s2Dots.chain !== threadChain) s2DotsSet(threadChain);
        s2Dots.retract = false;
        s2Dots.d.forEach((d) => {
          gsap.killTweensOf(d);
          d.hit = true;
          if (d.k < 1) tl.to(d, { k: 1, duration: frameDur }, 0);
        });
      }
      const s2Beads = pose.thread ? new Set(threadChain) : null;
      /* 10-09 (w9b, s2-ghost): the ghost follows the pose — onto S2 (a plain
         arrival) every shard the string does not run through ghosts and the
         beads clear, across the morph window; anywhere else it lifts over
         the step (S2→S1 whole or interrupted, the reform, every jump). */
      panels.forEach((p) => {
        gsap.killTweensOf(p.gh);
        const k = pose.thread && !toHero ? (s2Beads.has(p) ? 0 : 1) : 0;
        if (Math.abs(p.gh.k - k) > 1e-4) tl.to(p.gh, { k, duration: pose.thread ? TUNING.stageSeconds * 0.6 * durMult : frameDur }, 0);
      });
      /* 10-07 (w5, s4-out-then-in): S3→S4 is BURST, SETTLE, APPROACH — the
         panels emanate at S3's distance (the ×1.7 world bursting toward the
         frame), and only once the last burst is 35% done (s4PushAt) does the
         camera push in over ?s4pushsecs on the Turn curve. The reverse is that
         run backwards at the exit ratio: the pull-out FIRST (0 → 0.84s), the
         contraction from its midpoint on the reversed stagger × 0.7 (≈1.2s
         in all at the bake, measured on 15fps sheets; the plan guessed ≈1.4s).
         Only the authored step: a compressed catch-up, a jump (cut)
         or an arrival from the belt keep the one-window morph. */
      const pushIn = to === 'stage-04' && !reversing && !compressed && !fromBelt && !opts.cut;
      const pullOut = from === 'stage-04' && to === 'stage-03' && reversing && !compressed && !opts.cut;
      const pushAt = pushIn ? s4PushAt() : 0;
      const pushSecs = Math.max(TUNING.s4PushSecs, 0.05) * (pullOut ? EXIT_RATIO : 1);
      // 10-07 (w4 fix): the copy's lead starts NOW when this stage's own
      // arrival plays whole (S3: the breath + ignition above); a compressed,
      // reversed or from-the-belt build skips it (S3's Core is already lit).
      // 10-07 (w5): S4's lead is the push (COPY_BEAT reads s4PushAt), so only
      // an arrival that pushes plays it.
      // 10-07 (w6): S5's lead is the drop (COPY_BEAT reads s5DropAt), so
      // only an arrival that plays the intro sends 'full' (s5Intro).
      copyBeat?.(
        to,
        !reversing && !compressed && !fromBelt && (to !== 'stage-04' || pushIn) && (to !== 'stage-05' || s5Intro)
          ? 'full'
          : 'plain'
      );
      // x/y ride the same window: a transition that interrupts the S1 tour
      // (or reverses back onto the belt) must land on the establishing frame,
      // which is also where startTour picks the path back up.
      // 10-07 (w5): S3↔S4's camera rides the push / pull-out window instead.
      const camAt = pushIn ? pushAt : 0;
      // 10-07 (w7, cta-finale): the CTA's pull-back into its free rect runs
      // ?ctasecs from the commit; the return comes back at the exit ratio.
      const ctaSecs = Math.max(TUNING.ctaSeconds, 0.05);
      const camDur = ctaArrive
        ? ctaSecs
        : ctaReturn
        ? ctaSecs * EXIT_RATIO
        : pushIn || pullOut
        ? pushSecs
        : frameDur;
      tl.to(camera.position, { x: 0, y: 0, z, duration: camDur }, camAt);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: camDur }, camAt);

      // Atmospheric depth follows the FORM: full on the gathering belt, gone
      // the moment the Fragments are one body.
      const fogTarget = poseFog(pose);
      if (Math.abs(fogState.amount - fogTarget) > 1e-4) {
        gsap.killTweensOf(fogState);
        tl.to(fogState, { amount: fogTarget, duration: frameDur, ease: 'power2.inOut' }, 0);
      }

      // S5 axis lean rides the same window (house curve — "the same
      // synced animation curve"); eases back to upright on the way out.
      const tiltTarget = pose.tilt ?? 0;
      if (Math.abs(tiltState.z - tiltTarget) > 1e-4) {
        gsap.killTweensOf(tiltState);
        tl.to(tiltState, { z: tiltTarget, duration: frameDur }, 0);
      }

      // Background beat. The opening↔solid boundary rides the S2↔S3 dolly as
      // the solid field emanating from / receding into the Core: forward
      // (light-up) it GROWS out of the solidifying Core to flood the canvas;
      // reverse it SHRINKS back into the Core and the opening returns. Every
      // other pairing crossfades (monotonic — bgCrossfade).
      // 10-07 (mech-1): judged from the LIVE layers, as the haze and tilt
      // are — not the pose table alone. A burst of goTo()s kills each
      // crossfade a frame or two in (S5→S4 strands the gradient at ~0.98,
      // and the solid→solid legs after it never ran one), and a killed
      // grow/shrink leaves the solid field clipped: whatever the field
      // actually shows, this transition lands it on its pose.
      // 10-10 (w9c): roles, not colours (FIELDS / fieldOf — the opening is
      // black by default, the solid blue); the live layers are bgState (no
      // layer tweens left to read). The S5↔CTA ramp rides the camera's
      // window (?ctasecs; the return at the exit ratio) — the black stop
      // climbing as the world pulls back.
      const bgTarget = layersFor(pose.bg);
      const bgRamp = pose.ramp ?? bgState.ramp;
      tl.call(() => setBgAttr(pose.bg), null, 0);
      if (
        pose.bg !== fromPose.bg ||
        Math.abs(bgState.s - bgTarget.s) > 0.01 ||
        (bgTarget.g != null && Math.abs(bgState.g - bgTarget.g) > 0.01) ||
        bgState.clip || // 10-10 (w9c fix R3): any live circle (cover reads 1 once its area passes the viewport's, corners still bare)
        (pose.bg === 'gradient' && Math.abs(bgState.ramp - bgRamp) > 1e-3)
      ) {
        // 10-10 (w9c fix R3): a circle still live (a killed morph's) is the
        // crossfade's to pick up — a morph would restart it from its own end
        const liveClip = Boolean(bgState.clip);
        const grow = !liveClip && isLightUp && fromPose.bg === 'open' && pose.bg === 'solid';
        // A jump back off the solid (Home, back_to_top, a bench jump)
        // crossfades: its dolly flies the shards to the O or the belt, not
        // into the Core, so a shrink would close on a spot the world is
        // leaving.
        const shrink =
          !liveClip && !compressed && !opts.cut && reversing && fromPose.bg === 'solid' && pose.bg === 'open';
        if (grow || shrink) bgMorph(tl, 0, frameDur, grow);
        else bgCrossfade(tl, 0, ctaArrive || ctaReturn ? camDur : Math.max(frameDur * 0.6, 0.3), pose);
      }

      // 10-09 (w9): S1↔S2 is belt to belt — with every shard already on its
      // slot nothing moves but the string, the flood and the light, so the
      // cloud keeps its spin through the step (no stall at the commit).
      const onSlot = (p) => p.mesh.position.distanceToSquared(p.beltPos) < 1e-8;
      const settled = toBelt && panels.every(onSlot);
      if (fromBelt || toBelt) {
        // The tick hands the belt to gsap until onComplete re-arms it.
        if (!settled) beltDrifting = false;
        panels.forEach((p) => {
          gsap.killTweensOf(p);
          gsap.killTweensOf(p.mesh.scale); // in-flight materialize
          if (!toBelt) p.driftFactor = 0;
        });
      }

      // The decoy flood follows the pose: flickers back with a belt
      // return, sheds fast on any path that leaves stage-01 (interrupts
      // included — buildConnect owns the authored cull).
      if (pose.decoys && !decoyMesh.visible) {
        decoysIn(tl, frameDur * 0.25, TUNING.stageSeconds * durMult);
      } else if (pose.decoys && decoyMesh.visible) {
        // Interrupting the prolonged S1→S2 cull mid-flight kills its exit
        // tweens with the timeline, stranding fallen/half-scaled decoys
        // (visible never flipped, so the decoysIn branch can't restore).
        // Re-seat the pool on its belt slots as this morph starts.
        tl.call(
          () => {
            decoys.forEach((d) => {
              gsap.killTweensOf(d);
              gsap.killTweensOf(d.pos);
              if (d.beltPos) d.pos.copy(d.beltPos);
              d.s = 1;
            });
            composeDecoys();
          },
          null,
          0
        );
      } else if (!pose.decoys && decoyMesh.visible) {
        // The snappy flicker — on a reform too: the raw material leaves
        // first, then the O's own shards go home (the arrival, reversed).
        decoysOut(tl, 0, Math.min(0.4, frameDur));
      }

      if (toHero) {
        if (heroIntact) {
          // Scrolled back inside the wind-up: the break never happened. The
          // O cools and spins down to its ambient, the word un-gathers and
          // the token cuts back in (anything the wind seated goes again).
          panels.forEach((p) => p.mesh.scale.setScalar(0));
          heroCore.visible = false;
          const lockup = heroMark?.lockup?.() ?? null;
          if (lockup) {
            gsap.killTweensOf(lockup.charge);
            tl.to(lockup.charge, { k: 0, boost: 0, duration: 0.3, ease: 'power2.out' }, 0);
          }
          heroMark?.onReform?.();
        } else {
          buildReform(tl, compressed);
        }
      } else {
        // Pose morph. Emanation (panel-scale change) staggers on its own
        // order (emanateAt — the lag, stagger and jitter); form changes
        // tween shard transforms scatter ↔ home.
        const emanating = !toBelt && Math.abs(pose.panelScale - panels[0].mesh.scale.x) > 1e-3;
        const dur = TUNING.stageSeconds * 0.6 * durMult;
        /* 10-07 (w5, s4-out-then-in): the pull-out's contraction — the
           forward schedule mirrored (last to burst contracts first) × the
           exit ratio, from the pull-out's midpoint. */
        const fwdAt = pullOut && emanating ? new Map(panels.map((p) => [p, emanateAt(p)])) : null;
        const fwdLast = fwdAt ? Math.max(...fwdAt.values()) : 0;
        const contractAt = pushSecs * 0.5;
        /* 10-10 (w9c fix R1): S4's edge ink (1 on the blue solid) RIDES into
           S5's count-in, which takes it from the live value to ?s5stroke as
           it turns the S5 brown-blue (buildS5Loop). Tweening it to S5's pose
           (0) first erased the outline over the morph and the count-in drew
           it back ≈0.26s later — an out-and-back. Only when the count-in
           inks (strokeOn); on ?opening=blue S4's ink is 0 and this is w9b's. */
        const inkRides = s5Intro && s5Env().strokeOn;
        panels.forEach((p) => {
          const u = p.mesh.material.uniforms;
          const at = fwdAt
            ? contractAt + (fwdLast - fwdAt.get(p)) * EXIT_RATIO
            : emanating
            ? emanateAt(p) * durMult
            : 0;
          const target = toBelt
            ? p.beltPos
            : { x: p.homeOffset.x * pose.panelScale, y: p.homeOffset.y * pose.panelScale, z: p.homeOffset.z * pose.panelScale };
          // 10-07 (w7): the freed shard's pose is contact.k's (composeContact)
          // 10-09 (w9): a shard already on its belt slot (S1↔S2) keeps its
          // spin — no tween back to the slot's seed orientation.
          if (p !== contact.panel && !(toBelt && onSlot(p))) {
            tl.to(p.mesh.position, { x: target.x, y: target.y, z: target.z, duration: dur }, at);
            tweenQuat(tl, p.mesh, toBelt ? p.beltQuat : IDENTITY_QUAT, dur, at);
          }
          tl.to(p.mesh.scale, { x: pose.panelScale, y: pose.panelScale, z: pose.panelScale, duration: dur }, at);
          // 10-09 (w9): onto S2 each bead on the string is CLAIMED (a shade
          // darker, its drift damped — restThread's values); off it, freed.
          const bead = Boolean(s2Beads?.has(p));
          // 10-07 (w7): the CTA arrival's light is the resolve's (below)
          if (!ctaArrive) {
            if (!recover) tl.to(u.uPower, { value: bead ? s2BeadPower() : pose.power, duration: dur }, at); // 10-08 (w8b): the beat's recovery owns it (below); 10-09 (w9b): a bead's rest is dark
            if (!inkRides) tl.to(u.uStrokeMix, { value: pose.stroke, duration: dur }, at);
          }
          if (toBelt) tl.to(p, { driftFactor: bead ? S2_CLAIM_DRIFT : 1, duration: dur }, at);
        });
      }

      /* 10-10 (w9c): THE INK'S COLOUR rides the step — goTo kept whatever
         S5's rhythm left (the brown-blues; stopLoops(true)), and every step
         eases it home to the edge black on the morph's window, from the live
         colour (a burst picks it up mid-way). The resolve does it on its own
         beat (below). Killed at build time, never in this timeline's calls. */
      const inkCols = panels.map((p) => p.mesh.material.uniforms.uStrokeColor.value);
      const inkHome = inkCols.some((c) => !c.equals(strokeColor));
      if (inkHome) gsap.killTweensOf(inkCols);
      /* 10-10 (w9c fix R2): the ease is on what SHOWS — the edge's ink term
         (colour × mix, linear): the brown-blue's share only ever falls,
         s·m = min(m, m₀·(1 − k)). A panel the groove left lit (mix 0) going
         to an inked rest took the brown-blue in with its mix and lost it
         again (≈30/255 red/green out-and-back on 23–38 panels, S5→S4 and
         S5→CTA); at mix 0 it now takes the black at once (unseen), a fully
         inked one eases exactly as before (s = 1 − k). Inserted after the
         mix tweens, so it reads this frame's mix. */
      const inkFrom = inkHome ? panels.map((p, i) => ({ c: inkCols[i].clone(), m: p.mesh.material.uniforms.uStrokeMix.value })) : null;
      const inkGoHome = (dur, ease, at) => {
        const k = { v: 0 };
        const step = () =>
          panels.forEach((p, i) => {
            const m = p.mesh.material.uniforms.uStrokeMix.value;
            const s = Math.min(1, (inkFrom[i].m * (1 - k.v)) / Math.max(m, 1e-4));
            inkCols[i].copy(strokeColor).lerp(inkFrom[i].c, s);
          });
        tl.to(k, { v: 1, duration: dur, ...(ease ? { ease } : null), onUpdate: step, onComplete: step }, at);
      };
      if (inkHome && !ctaArrive) inkGoHome(TUNING.stageSeconds * 0.6 * durMult, null, 0);

      /* 10-07 (w7, cta-finale): THE RESOLVE — on S5's next beat (goTo read
         the phase before stopLoops: opts.beatWait) the whole world snaps lit
         in UNISON, the S5 hit's attack (CTA_RESOLVE_S, power2.out): every
         panel to full power, the ink out. Then THE LIFT from the same beat
         (pickContact → freeContact; contact.k on the Turn curve over
         ?ctasecs) while the camera pulls back into the free rect. Reduced
         motion never builds this (an instant pose).
         10-10 (w9c): the ink goes to the pose's (?ctaink — the black edge ink
         on the taller blue ramp; 0 = w9b's ink out) in S5's brown-blue easing
         to black on the same attack. */
      if (ctaArrive) {
        const wait = Math.max(opts.beatWait ?? 0, 0);
        const powers = panels.map((p) => p.mesh.material.uniforms.uPower);
        const inks = panels.map((p) => p.mesh.material.uniforms.uStrokeMix);
        gsap.killTweensOf(powers);
        gsap.killTweensOf(inks);
        tl.to(powers, { value: pose.power, duration: CTA_RESOLVE_S, ease: 'power2.out' }, wait);
        tl.to(inks, { value: pose.stroke, duration: CTA_RESOLVE_S, ease: 'power2.out' }, wait);
        tl.call(
          () => {
            contact.resolveAt = performance.now();
          },
          null,
          wait
        );
        // 10-07 (w7 fix): S5's ink rode the wait (goTo's stopLoops(keepInk));
        // the black goes back once the resolve has the stroke at 0 — values
        // only, no kill inside this timeline's own call.
        // 10-10 (w9c): EASED with the resolve (its attack, from the beat) —
        // the CTA's ink is the field-aware ctaInk (> 0 over the taller blue
        // ramp), so a snap at the resolve's end would show.
        if (inkHome) inkGoHome(CTA_RESOLVE_S, 'power2.out', wait); // 10-10 (w9c fix R2): the visible ink falls (above)
        if (ctaPick) tl.to(contact, { k: 1, duration: ctaSecs }, wait);
      } else if (ctaReturn) {
        // THE RETURN: the shard flies home on k → 0 with the camera (both at
        // the exit ratio), then snaps into its slot — from inside this
        // timeline's own call, so no killTweensOf there (the GSAP trap).
        gsap.killTweensOf(contact);
        const retDur = ctaSecs * EXIT_RATIO;
        tl.to(contact, { k: 0, duration: retDur }, 0);
        tl.call(() => releaseContact(true, false), null, retDur);
      }

      // The filled core tracks its pose scale — surfacing into S2/S3,
      // DISSOLVING under the S4 emanation (it was blocking the expanded
      // world's gap-lattice), returning on the way back.
      const innerTarget = Math.max(pose.innerScale, 0.001);
      if (Math.abs(innerSphere.scale.x - innerTarget) > 1e-4) {
        const innerDur = TUNING.stageSeconds * 0.6 * durMult;
        if (pose.innerScale > 0.001) {
          tl.call(() => {
            innerSphere.visible = true;
          }, null, 0);
        }
        tl.to(innerSphere.scale, { x: innerTarget, y: innerTarget, z: innerTarget, duration: innerDur }, 0);
        if (pose.innerScale <= 0.001) {
          tl.call(() => {
            innerSphere.visible = false;
          }, null, innerDur + 0.01);
        }
      }

      /* 10-07 (w4, s3-ignition): THE SEAMS. ONE tween, outside the inner-
         scale gate (a pairing that keeps the scale never runs that gate).
         Panel colour still never tweens — only the seams do: blue through
         S2, ?coreseam from S3 on. The authored ignition turns them just after
         the cascade (buildIgnition — 10-09, w9); every pairing here rides the
         frame window. Killed at BUILD time, and only tweened when the live
         colour is off its pose. */
      gsap.killTweensOf(innerMaterial.color);
      const seamHex = pose.innerColor ?? GAP_COLOR;
      if (innerMaterial.color.getHex() !== seamHex) {
        const c = new THREE.Color(seamHex);
        tl.to(innerMaterial.color, { r: c.r, g: c.g, b: c.b, duration: frameDur }, 0);
      }
      /* 10-08 (w8b, r1-heartbeat-exit): the dip's recovery (see `recover`
         above) — added LAST, so its length can be held inside the exit as
         built: the pulse's decay × EXIT_RATIO (expo is self-similar, so from
         any live value it is the same curve, faster — never slower than the
         beat itself would have been; ?decaycurve linear keeps the pulse's
         slope × 1/EXIT_RATIO over what is left), clamped to tl.duration() so
         the landing's onComplete (startLoops' count-in, the spec sheet) never
         moves. One tween over the 84 uniforms: unison. */
      if (recover) {
        const secs = Math.max(Math.min(recoverSecs(hb, livePower), tl.duration() || Infinity), 0.05);
        tl.to(
          panels.map((p) => p.mesh.material.uniforms.uPower),
          { value: pose.power, duration: secs, ease: hb.decayEase },
          0
        );
      }
      return tl;
    };

    const setStageInstant = (next) => {
      if (!getPose(next) || next === stage || disposed) return;
      if (DEBUG) console.info(`[ProcessScene] setStageInstant ${stage ?? '∅'} → ${next}`);
      killActiveTl();
      activeTl = null;
      pendingNext = null; // a killed show never lands, so nothing it queued may fire later
      gsap.killTweensOf(camLag); // a surviving resize-lag tween would drag the camera back
      stopLoops();
      if (next !== 'stage-05') s5Reset(); // 10-07 (w6): leaving S5 — the next visit opens on the live readout
      // 10-07 (w7 fix): …on a blank one as goTo leaves it (reduced motion's
      // still is the live readout itself, never paged — it keeps it).
      if (stage === 'stage-05' && next !== 'stage-05' && !PREFERS_REDUCED_MOTION) s5Clear();
      resetReach(); // 10-07 (w5): applyPose re-seats every panel
      cancelTease();
      killS2Fx(); // 10-09 (w9b): applyPose zeroes the heat
      panels.forEach((p) => gsap.killTweensOf(p));
      releaseContact(true); // 10-07 (w7): an instant pose snaps the freed shard home first
      // Whole, or already coming back together (the word is up).
      const wasWhole = heroIntact || heroReforming;
      applyPose(getPose(next));
      // The DOM O follows the scene either way: an instant pose off the hero
      // breaks it (the copy hook's cue), one onto the hero re-forms it.
      if (wasWhole && next !== 'hero') heroMark?.onBreak?.();
      // 10-09 (w9, s2-hold): S2's rest is the connected constellation in
      // motion AND reduced motion (it was RM's still alone) — the Thread drawn
      // through its claimed beads, the lead line on its full count, plain
      // (scramble degrades, spec §7). Everywhere else the string is gone.
      if (getPose(next).thread) restThread();
      else clearThread();
      stage = next;
      /* 10-07 (w7, cta-finale): an instant CTA (scroll restoration, a
         superseded jump's re-sync) lands RESOLVED with the shard already
         freed and turned (k = 1) — the breath excludes it, so it is freed
         before the loop starts. Reduced motion's still is the resolved
         world alone (no lift, no chip). */
      if (next === 'cta') {
        contact.commitAt = null;
        contact.resolveAt = null;
        contact.landAt = performance.now();
        contact.seatedAt = null;
        contact.fits = null;
        contact.room = null;
        contact.at = null;
        contact.pool = null;
        contact.nz = null;
        contact.tries = 0;
        const pick = getPose(next).finale && !PREFERS_REDUCED_MOTION ? pickContact() : null;
        if (pick) {
          freeContact(pick, 1);
          composeContact();
        }
      }
      // 10-07 (w7, item 7a): a non-intro S5 arrival opens on a blank readout
      if (next === 'stage-05' && !PREFERS_REDUCED_MOTION) s5Clear();
      if (getPose(next).loops) startLoops();
      // 10-07 (w6): reduced motion's S5 is a still — the live readout, ● lit.
      if (next === 'stage-05' && PREFERS_REDUCED_MOTION) s5Still();
      // Instant non-RM arrivals (scroll restoration) get the annotation
      // layer too; RM never runs it (startLabels self-gates).
      // 10-07 (w3): the tour starts FIRST so the wide it opens on can hold
      // for the chips (holdWide needs a live tour on its wide).
      stopLabels();
      // 10-08 (w8 fix): …which also closed the S5 page gate startLoops had
      // just opened — an instant S5 (the driver's mount sync, a reload
      // scrolled there) paged the readout alone for the whole visit. Re-armed
      // after the hard stop, as first_contact re-starts below; no loop (RM,
      // a hidden-tab start still builds one) = no chip.
      if (next === 'stage-05' && loopTl) pageActive = TUNING.s5Chip !== 'off' && labelSlots.length > 0;
      if (contact.panel) {
        startContact(0.3); // 10-07 (w7): first_contact, as the S1 chips start
        if (contact.hover) pulseOn(contact.panel);
      }
      // 10-09 (w9): S2's constellation rests on its wide — no tour
      if (getPose(next).form === 'belt' && !getPose(next).thread) startTour();
      if (getPose(next).decoys) holdWide(startLabels(0.3));
      if (next === 'stage-03') startSpecSheet(); // 10-07 (w5): an instant S3 is named at once
      if (next === 'hero') {
        // The O is whole again: the lockup comes back cold and at its
        // ambient spin (a bench replay; at load the copy hook isn't
        // registered yet and runs its own splash).
        heroMark?.onReform?.();
        const lockup = heroMark?.lockup?.() ?? null;
        if (lockup) {
          gsap.killTweensOf(lockup.charge);
          lockup.charge.k = 0;
          lockup.charge.boost = 0;
        }
      }
      updateThread();
      renderFrame();
    };

    // opts.cue — the splash's own break (and the bench's): the full wind-up.
    // opts.cut — a jump (the bench, the driver's back_to_top / Home / End
    // glide): it never rushes the S1→S2 show, it cuts it like any jump.
    const goTo = (next, opts = {}) => {
      if (!getPose(next) || disposed) return;
      if (next === stage) {
        // 10-07 (choreo-2): back onto S2 while the show is rushing (or a
        // bench jump to it) — the show eases back to real time and plays
        // out; nothing is queued any more.
        if (pendingNext) {
          pendingNext = null;
          if (DEBUG) console.info(`[ProcessScene] show back to ×1 (on ${stage})`);
          gsap.to(activeTl, { timeScale: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
          // 10-07 (w4 fix): the commit that queued the step took the
          // Thread's words; the show plays out again, so its gate re-opens
          // with what is left of ?threadwords — while words can still bind.
          if ((activeTl?.data === 'connect' || activeTl?.data === 'reconnect') && threadBindOpen) threadLabelsActive = threadWordsLeft > 0;
        }
        return;
      }
      // An arrival is a rest pose, never a transition: the driver's boundary
      // triggers can fire before its own mount sync has set the stage.
      if (PREFERS_REDUCED_MOTION || stage == null) {
        setStageInstant(next);
        return;
      }
      // 10-07 (w4, thread-words): off stage-02 the Thread's words go — a
      // rush, a jump or a step back alike (the driver's commit usually got
      // there first); back toward the belt on the quick beat (the retract),
      // so none rides the shards' return.
      if (stage === 'stage-02' && (threadLabelsActive || threadChipsLive())) {
        leaveThreadWords(STAGE_IDS.indexOf(next) < STAGE_IDS.indexOf(stage));
      }
      // A forward step during the S1→S2 show: the payoff is never cut off
      // for a reader skimming — the rest of it plays as a time-lapse (the
      // Thread snaps taut, the lens pulls back — 10-09, w9: the Core is S3's
      // now, so a queued S3 then assembles whole) and their stage
      // follows it whole. The decoy cull and the haze burn-off are inside
      // the show and rush with it; the per-bead claim pulses are their own
      // timelines and keep real time.
      // 10-09 (w9b): …and so does S3→S2's RECONNECT
      if (
        (activeTl?.data === 'connect' || activeTl?.data === 'reconnect') &&
        !opts.cut &&
        STAGE_IDS.indexOf(next) > STAGE_IDS.indexOf(stage)
      ) {
        if (DEBUG) console.info(`[ProcessScene] show rush ×${TUNING.showRush} → queued ${next}`);
        if (!pendingNext) {
          gsap.to(activeTl, {
            timeScale: Math.max(TUNING.showRush, 1),
            duration: 0.3,
            ease: 'power2.in',
            overwrite: true,
          });
        }
        pendingNext = next;
        copyBeat?.(next, 'queued'); // 10-07 (w4 fix): its copy waits for the landing
        return;
      }
      pendingNext = null; // a backward step or a jump cuts the show as before
      if (DEBUG) console.info(`[ProcessScene] goTo ${stage ?? '∅'} → ${next}`);
      // 10-07 (w5): the S4 reach lets go with NO tween (the transition tweens
      // from the live positions), and the S2 foreshadow never outlives its rest.
      resetReach();
      cancelTease();
      /* 10-08 (w8b, r1-heartbeat-exit): a commit off the S4 heartbeat — read
         before stopLoops kills the loop, which leaves the world wherever the
         dip had it — or one that cuts short an exit still finishing that beat
         (a quick S4 → S3 → S4). The transition completes the beat
         (buildTransition, opts.dip); a commit clear of a dip finds nothing to
         recover and builds exactly as before.
         10-08 (w8b fix, scr-1): the second read only matters to an input with
         NO glide lock — the bench's stage buttons (a direct goTo) and ?swipe
         off's free scroll across a 60% line. Measured (fix/hb): the bench's
         04 at +0.12s after the S4→S3 goTo found 0.958 on a 'recover' exit
         and rose on in unison (≤ 0.0084 a frame, 0.995 at +0.14s). The
         quantizer (wheel, touch, keys, the steppers) holds lockUntil for
         ?swipems + 80ms, so its quickest S4 → S3 → S4 lands the second goTo
         +0.88s after the first, with the recovery long done (0.995 at
         +0.30s, the tween out at decay × EXIT_RATIO ≈ 0.63s): `recover`
         then finds the rest and builds the plain morph. */
      const dip = loopTl?.data === 'heartbeat' || activeTl?.data === 'recover';
      const interrupted = Boolean(activeTl);
      killActiveTl();
      stopFlight(); // a break or reform still in the air ends where it stands
      stopTour(); // the transition owns the camera from here
      gsap.killTweensOf(camLag); // the transition owns the camera now — drop any resize-lag chase
      /* 10-07 (w7, cta-finale): the CTA's RESOLVE lands on S5's next beat —
         the phase is read off the live loop HERE, before stopLoops kills it
         (nextBeatIn, the tap cue's grid). No loop (a hidden tab, an S5
         arrival still in flight) resolves at once. */
      const beatWait = next === 'cta' && stage === 'stage-05' && loopTl ? nextBeatIn(loopTl.time()) : 0;
      if (next === 'cta') {
        contact.commitAt = performance.now();
        contact.resolveAt = null;
        contact.landAt = null;
        contact.seatedAt = null;
        contact.fits = null;
        contact.room = null;
        contact.at = null;
        contact.pool = null;
        contact.nz = null;
        contact.tries = 0;
      }
      // 10-07 (w7 fix): the resolve's step keeps S5's ink until the resolve
      // (buildTransition's ctaArrive — the same predicate: forward from S5,
      // whole, not a jump).
      // 10-10 (w9c): EVERY step keeps the live ink colour now — buildTransition
      // eases it back to the edge black (inkHome). With S3/S4 inked on the
      // blue field (stroke 1), S5→S4's snap from the brown-blue to black at
      // full mix was a visible jump (w9b snapped it at S5's floor mix too).
      stopLoops(true);
      if (next !== 'stage-05') s5Reset(); // 10-07 (w6): the page cursor lives only while S5 does
      // 10-07 (w7 fix): …and its readout blanks as S5 LEAVES — the section is
      // already off screen at the commit, and scrolling back up from the CTA
      // it re-entered showing the last visit's page until the trigger fired.
      if (stage === 'stage-05' && next !== 'stage-05') s5Clear();
      activeTl = buildTransition(stage ?? 'stage-01', next, interrupted, { ...opts, beatWait, dip });
      stage = next;
      // Built while the scene is idled (a hidden tab): start paused like
      // everything else, or lagSmoothing(0) lands it in one jump on return.
      if (!tickerActive) activeTl?.paused(true);
    };

    /* — Live tuning (the ?debug panel): re-seed the belt (the drift tick
       reads beltPos, so the spread updates in place), re-frame the
       resting camera, re-stroke, rebuild a running rhythm loop, refresh
       idle glow. Duration/order/hops/pattern knobs apply to the NEXT
       transition or loop pass — jump or replay a stage to hear them. — */
    const applyTuning = () => {
      if (disposed) return;
      seedBelt();
      panels.forEach((p) => {
        p.mesh.material.uniforms.uStrokeWidthPx.value = TUNING.strokePx;
      });
      threadMaterial.linewidth = TUNING.strokePx; // the string shares the ink width
      threadMaterial.color.set(threadInk()); // 10-08 (w8): ?threadink, live
      // 10-08 (w8): ?herov from the bench (ProcessPage renders the first value)
      if (TUNING.heroV === 'centre') rootEl?.setAttribute('data-herov', 'centre');
      else rootEl?.removeAttribute('data-herov');
      if (labelSlots.length) restyleLabels(); // ?labelsize
      // 10-10 (w9c): ?opening from the bench — the root's tokens (the
      // opening's own colour, the solid layer's, the overscroll's) and the
      // dot ink re-point at once; the layers re-lay at the rest (below)
      setOpening();
      setBgAttr(bgRole); // 10-10 (w9c fix R4): the colour name follows the tokens, mid-step too
      s2DotMat.color.set(FIELDS[fieldOf('open')].dot);
      syncThreadKeep();
      const pose = getPose(stage ?? 'stage-01');
      if (!activeTl) {
        // 10-10 (w9c): ?opening / ?ctaramp / ?ctaink live at a rest — the
        // field and the field-aware ink (S3/S4, the CTA) land on the pose
        // (S5's ink is its loop's)
        bgInstant(pose);
        if (stage === 'stage-03' || stage === 'stage-04' || stage === 'cta') {
          panels.forEach((p) => {
            p.mesh.material.uniforms.uStrokeMix.value = pose.stroke;
          });
        }
        const { z, offsetX, offsetY } = framingFor(pose);
        camera.position.z = z;
        globeGroup.position.x = offsetX;
        globeGroup.position.y = offsetY;
        tiltState.z = pose.tilt ?? 0; // ?s5tilt applies live at rest
        innerMaterial.color.setHex(pose.innerColor ?? GAP_COLOR); // 10-07 (w4): ?coreseam live at rest
        // 10-09 (w9): S2's constellation is a resting belt too — every
        // shard re-seats (its beads keep their claim, a shade darker)
        if (pose.form === 'belt' && (!threadActive || pose.thread)) {
          const beads = pose.thread ? new Set(threadChain) : null;
          panels.forEach((p) => {
            if (p.driftFactor > 0.5 || pose.thread) {
              p.mesh.material.uniforms.uPower.value = beads?.has(p) ? s2BeadPower() : TUNING.idlePower; // 10-09 (w9b): ?s2dark live
              // The tick no longer stamps positions (suspended cloud) —
              // a re-seed re-spreads the resting belt here instead.
              p.mesh.position.copy(p.beltPos);
            }
          });
          decoyMaterial.uniforms.uPower.value = TUNING.idlePower;
          decoyMaterial.uniforms.uStrokeWidthPx.value = TUNING.strokePx;
        }
      }
      // Rebuild on the new bpm/pattern/envelope grid. 10-07 (w5): at any
      // looping rest, not only a running loop — ?heartbeat 0 → 0.4 builds
      // one from nothing (0 tears it down: startLoops stops first).
      if (loopTl || (!activeTl && pose.loops)) startLoops();
      // ?fog / ?fogspan are instant (the uniforms are stamped every render);
      // only the STRENGTH needs restating, and never over a running fade.
      if (!activeTl) fogState.amount = poseFog(pose);
      // ?tourreach / ?tournear / ?tourfar / the leg timings rebuild the path
      // in place (the walk restarts from the wide).
      if (tourActive) {
        stopTour();
        startTour();
      } else if (!activeTl && pose.form === 'belt' && !pose.thread) {
        startTour(); // ?tour flipped back on from the panel (10-09, w9: never on S2)
      }
      if (PREFERS_REDUCED_MOTION) {
        applyPose(pose);
        if (pose.thread) restThread(); // 10-09 (w9): applyPose freed the beads
        updateThread();
        renderFrame();
      }
    };

    /* — Replay the current stage's transition from the previous rest
       pose — the tuning loop's ear: hear duration/order changes without
       scrolling back and forth. — */
    const replay = () => {
      if (disposed || !stage) return;
      const current = stage;
      const idx = STAGE_IDS.indexOf(current);
      // The hero has no predecessor: its replay is the REFORM, from the belt
      // (and stage-01's is the break, from the whole O).
      const prev = current === 'hero' ? 'stage-01' : STAGE_IDS[Math.max(idx - 1, 0)];
      killActiveTl();
      activeTl = null;
      pendingNext = null;
      stopLoops();
      clearThread();
      stage = null; // force both calls through the dedupe
      setStageInstant(prev);
      // The bench hears the break whole — the wind-up too — from the O's
      // rest seat, wherever the page is scrolled.
      replaying = true;
      if (prev !== current) goTo(current, { cue: true });
      replaying = false;
    };

    /* — Pointer drag + flick (09-09, Nathan: the home globe's interaction
       choreography, carried onto /process). The SAME engine the hero globe
       and the footer logo ticker ride (src/lib/dragMomentum.js): deltas pass
       through 1:1 while the pointer is down, release flicks on the EMA
       velocity, and the spin settles back to the ambient drift over 0.35s —
       the field never stops dead. The ±40° pitch clamp is the home globe's,
       so a drag can never strand the belt edge-on.

       TOUCH stands down (the engine's `touch: false`): this page's swipe
       quantizer walks the sections with a finger, and a globe that ate the
       pan would trap the reader mid-walk. Mouse and pen drag; a finger
       pages. The canvas only RECEIVES pointers where the copy column isn't
       (process.css hands the layer its pointer-events back) — so the gesture
       lives in the open field beside the words, which is where the shards
       are.
       10-07 (w6, s5-tap-cue): `cursor: false` — the SCENE owns the cursor on
       every stage now (grab / grabbing, and pointer over a shard a click
       would cue at the S5 rest — the tap cue below); the engine itself is
       untouched (it is shared with the home globe and the logo ticker). — */
    const drag = PREFERS_REDUCED_MOTION
      ? null
      : new DragMomentum(container, {
          ambient: { x: AUTO_ROTATE_SPEED, y: 0 },
          sensitivity: DRAG_SENSITIVITY,
          maxSpeed: MAX_FLICK_SPEED,
          reducedMotion: PREFERS_REDUCED_MOTION,
          touch: false,
          cursor: false,
        });

    /* — 10-07 (w5, s4-reach): S4 REACHES FOR THE HAND. "Pushes the world
       outward to pull your audience inward", made literal: at the S4 rest
       (nothing in flight), each front-facing panel within REACH_RADIUS ×
       min(vw, vh) of the mouse leans out along its own home direction by up
       to ?reach × its offset — position = homeOffset × (scale + reach ×
       ?reach). A critically damped follow (reach += (target − reach) ·
       (1 − e^(−8·dt))): it eases toward the hand and settles, never past it
       (no overshoot). A pointer that leaves the field or rests REACH_IDLE_MS
       drops every target to 0. Desktop mouse/pen only (a phone's finger
       pages the sections; the swipe owns touch); reduced motion never ticks.
       goTo zeroes the state with NO tween — activeTl stops the writes and the
       transition tweens from the live positions. — */
    const REACH_RADIUS = 0.22;
    const REACH_IDLE_MS = 2000;
    const REACH_RATE = 8;
    const reachPtr = { x: 0, y: 0, on: false, at: 0 };
    const reachPx = { x: 0, y: 0, depth: 0, perPx: 0 };
    let reachMax = 0; // the largest live lean, 0..1 (the tick skips the pass at 0 with no hand)
    // 10-07 (w6): the tap cue's press (declared here — the shared move
    // listener measures its travel).
    const tapDown = { id: null, x: 0, y: 0, t: 0, travel: 0, touch: false };
    const onReachMove = (e) => {
      // 10-08 (w8, s5-tap-touch): the press's travel FIRST, any pointer —
      // a finger's tap is measured too; the reach stays mouse/pen.
      if (tapDown.id === e.pointerId) {
        tapDown.travel = Math.max(tapDown.travel, Math.hypot(e.clientX - tapDown.x, e.clientY - tapDown.y));
      }
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      const r = container.getBoundingClientRect();
      reachPtr.x = e.clientX - r.left;
      reachPtr.y = e.clientY - r.top;
      reachPtr.on = true;
      reachPtr.at = performance.now();
    };
    const onReachLeave = () => {
      reachPtr.on = false;
    };
    const reachOn = !IS_MOBILE && !PREFERS_REDUCED_MOTION;
    // 10-07 (w6): ONE pointermove listener — the S4 reach reads it, and so
    // do the tap cue's travel test and the S5 hover pick (a pen or mouse on
    // any device: the reach's own IS_MOBILE gate stays in the tick).
    if (!PREFERS_REDUCED_MOTION) {
      container.addEventListener('pointermove', onReachMove, { passive: true });
      container.addEventListener('pointerleave', onReachLeave);
    }
    const resetReach = () => {
      panels.forEach((p) => {
        p.reach = 0;
      });
      reachMax = 0;
    };
    const stepReach = (dt) => {
      const live = TUNING.reach > 0 && reachPtr.on && performance.now() - reachPtr.at < REACH_IDLE_MS;
      if (!live && reachMax <= 0) return;
      const view = screenView(); // 10-07 (final review): the one helper
      const radius = REACH_RADIUS * Math.min(view.vw, view.vh);
      const k = 1 - Math.exp(-REACH_RATE * dt);
      if (live) refreshLabelMatrices();
      let max = 0;
      panels.forEach((p) => {
        let target = 0;
        if (live && labelProminence(p) > LABEL_FRONT_EPS) {
          lblWorld.copy(p.mesh.position);
          globeGroup.localToWorld(lblWorld);
          if (toPx(lblWorld, view, reachPx)) {
            target = Math.max(0, 1 - Math.hypot(reachPx.x - reachPtr.x, reachPx.y - reachPtr.y) / radius);
          }
        }
        const prev = p.reach ?? 0;
        let r = prev + (target - prev) * k;
        if (target === 0 && r < 1e-3) r = 0; // land exactly on the rest
        p.reach = r;
        max = Math.max(max, r);
        // the live scale is the rest's panelScale (a live ?emanate can't split them)
        const sc = p.mesh.scale.x + r * Math.max(TUNING.reach, 0);
        p.mesh.position.set(p.homeOffset.x * sc, p.homeOffset.y * sc, p.homeOffset.z * sc);
      });
      reachMax = max;
    };

    /* — 10-07 (w6, s5-tap-cue): THE VISITOR PLAYS THE WORLD. At the S5 rest
       a mouse/pen CLICK (travel < 6px, < 250ms — the drag engine flags every
       press as a drag, so the test is our own) on a front-facing shard cues
       the NEXT pass: on the next beat of the grid (loopOrigin) the loop is
       rebuilt fresh from that shard — every panel released to the floor
       while one ripple spreads from it (the readout's tail: cue_ripple), then
       the cycle resumes after the pattern it cut. loopTl stays the single
       owner (startLoops({ cue })); a tap while a cue waits is ignored;
       ?tapcue off = the field only drags. 10-08 (w8, s5-tap-touch): a
       FINGER cues too — at the S5 rest only (cueable() at the press), the
       same slop/time test (a swipe travels or runs long: no cue, and the
       quantizer steps on its travel; a tap has none, so it never steps),
       one finger (a second pointer cancels the press: a pinch never cues),
       no cursor writes, and the drag engine stays touch: false (no spin on
       a finger). Pointer events only: the compat mouse events and click a
       browser sends after a touch never reach these listeners, and
       cuePending refuses a second schedule. The pick projects panel centres (toPx — no
       Raycaster): the nearest viewer-facing centre within its own projected
       core (TAP_CORE; a finger, the whole circle). The only affordance is the cursor: pointer over a cueable
       shard, grab elsewhere, grabbing while pressed — on every stage. — */
    const TAP_SLOP_PX = 6;
    const TAP_MAX_MS = 250;
    const pickPx = { x: 0, y: 0, depth: 0, perPx: 0 };
    const pickView = () => screenView(); // 10-07 (final review): the one helper
    // 10-07 (w6 fix): pointer means THIS shard. The bound circle (the shard's
    // corners, so it overlaps its neighbours) on every front-facing shard
    // covered the whole zoomed S5 sphere — 50 of 54 hovered field points read
    // pointer and grab was gone. Now: the shard's core (TAP_CORE of that
    // radius) on a shard facing the viewer (the chip bind floor,
    // LABEL_BIND_FACING); the seams and the limb read grab. The click uses
    // the same pick, so the cursor never promises a cue a click won't fire.
    const TAP_CORE = 0.6;
    // 10-08 (w8 fix): a FINGER picks with the whole bound circle (core 1 —
    // the nearest facing centre wins where circles overlap). The core keeps
    // the CURSOR honest, and a finger has no cursor: at 0.6 about a third
    // of the taps on the phone's S5 world (the seams between cores) did
    // nothing, with nothing to say why.
    const pickPanel = (x, y, core = TAP_CORE) => {
      refreshLabelMatrices();
      const view = pickView();
      let best = null;
      let bestD = Infinity;
      panels.forEach((p) => {
        if (labelProminence(p) <= LABEL_BIND_FACING) return;
        lblWorld.copy(p.mesh.position);
        globeGroup.localToWorld(lblWorld);
        if (!toPx(lblWorld, view, pickPx)) return;
        const radius = (core * (p.boundRadius || 0.2) * p.mesh.scale.x) / Math.max(pickPx.perPx, 1e-6);
        const d = Math.hypot(pickPx.x - x, pickPx.y - y);
        if (d <= radius && d < bestD) {
          best = p;
          bestD = d;
        }
      });
      return best;
    };
    // A click would cue here and now (the S5 rest, the groove or a cue's
    // own pass, nothing waiting).
    const cueable = () =>
      TUNING.tapCue !== 'off' &&
      stage === 'stage-05' &&
      !activeTl &&
      Boolean(loopTl) &&
      !cuePending &&
      (s5Phase === 'groove' || s5Phase === 'cue');
    const fireCue = () => {
      const panel = cuePending;
      cueDc = null;
      cuePending = null;
      if (!panel || disposed || stage !== 'stage-05' || activeTl || !loopTl) return;
      const entry = cueLog[cueLog.length - 1];
      if (entry && entry.id === panels.indexOf(panel)) entry.fired = Math.round(performance.now());
      startLoops({ cue: panel });
    };
    const scheduleCue = (panel) => {
      const wait = nextBeatIn(loopTl.time()); // 10-07 (w7): the grid's one helper (the CTA's resolve reads it too)
      cuePending = panel;
      cueLog.push({ id: panels.indexOf(panel), at: Math.round(performance.now()), fired: null });
      cueDc = gsap.delayedCall(wait, fireCue);
      if (!tickerActive) cueDc.paused(true);
    };
    let cursorNow = null;
    const setCursor = (c) => {
      if (c === cursorNow) return;
      cursorNow = c;
      container.style.cursor = c;
    };
    if (drag) setCursor('grab');
    // The resting cursor: pointer over a shard a click would cue, else grab.
    // 10-07 (final review): the pick (matrices + 84 projections) runs on a
    // pointer move and on every CURSOR_PICK_EVERY-th frame while the pointer
    // rests — the shards turn slowly under a still pointer — not every frame.
    const CURSOR_PICK_EVERY = 4;
    let cursorFrame = 0;
    let cursorHit = false;
    let cursorPickAt = -1; // reachPtr.at of the last pick (a move since → pick now)
    const restCursor = () => {
      if (!reachPtr.on || !cueable()) {
        cursorHit = false;
        cursorFrame = 0;
        return 'grab';
      }
      if (cursorFrame === 0 || reachPtr.at !== cursorPickAt) {
        cursorPickAt = reachPtr.at;
        cursorHit = Boolean(pickPanel(reachPtr.x, reachPtr.y));
      }
      cursorFrame = (cursorFrame + 1) % CURSOR_PICK_EVERY;
      return cursorHit ? 'pointer' : 'grab';
    };
    const onTapDown = (e) => {
      if (!drag || e.button !== 0) return;
      const touch = e.pointerType === 'touch';
      // 10-08 (w8): a second finger cancels a finger's press (a pinch)
      if (touch && tapDown.id != null && tapDown.id !== e.pointerId) {
        tapDown.id = null;
        return;
      }
      // mouse/pen anywhere (the cursor reads the press); a finger only where it could cue
      if (touch ? !e.isPrimary || !cueable() : e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      tapDown.id = e.pointerId;
      tapDown.x = e.clientX;
      tapDown.y = e.clientY;
      tapDown.t = performance.now();
      tapDown.travel = 0;
      tapDown.touch = touch;
      if (!touch) setCursor('grabbing');
    };
    const onTapUp = (e) => {
      if (tapDown.id == null || tapDown.id !== e.pointerId) return;
      const tap =
        e.type === 'pointerup' &&
        performance.now() - tapDown.t < TAP_MAX_MS &&
        Math.max(tapDown.travel, Math.hypot(e.clientX - tapDown.x, e.clientY - tapDown.y)) < TAP_SLOP_PX;
      tapDown.id = null;
      if (tap && cueable()) {
        const r = container.getBoundingClientRect();
        const panel = pickPanel(e.clientX - r.left, e.clientY - r.top, tapDown.touch ? 1 : TAP_CORE);
        if (panel) scheduleCue(panel);
      }
      if (!tapDown.touch) setCursor(restCursor()); // 10-08 (w8): a finger has no cursor
    };
    if (drag) {
      container.addEventListener('pointerdown', onTapDown);
      container.addEventListener('pointerup', onTapUp);
      container.addEventListener('pointercancel', onTapUp);
      container.addEventListener('lostpointercapture', onTapUp);
    }

    /* — 10-07 (w5, stepper-tease): THE S2 FORESHADOW. S2's Core is the
       longest still on the page and nothing on it says what comes next; once
       per page visit, after ?tease seconds with no input (wheel, key, touch,
       pointer) at the S2 rest, ONE row of S3's cascade flickers — the same
       buildCascadeTimeline, on the equator row's panels, from the first
       panel's ignition (no dead lead) — and the row settles back to its
       rest (?idlepower; a Thread bead's dimmer claim) on the Turn curve: a hint of the light-up to come. Never
       inside a transition; any goTo / instant pose cancels it (and an
       unfired one re-arms on the next S2 rest); reduced motion never ticks.
       10-09 (w9, s2-hold): S2 rests on the CONSTELLATION now, so the row
       that flickers is the equator row's shards scattered through the belt
       — the same code; whether it still reads as a foreshadow is Nathan's. — */
    let teaseTl = null;
    let teaseFlick = null; // the row's cascade (paused — teaseTl drives its playhead)
    let teaseFired = false;
    let teaseRestAt = null; // performance.now() the current S2 rest began
    let lastInputAt = 0;
    const onTeaseInput = () => {
      lastInputAt = performance.now();
    };
    const TEASE_EVENTS = ['wheel', 'keydown', 'pointerdown', 'pointermove', 'touchstart'];
    if (!PREFERS_REDUCED_MOTION) {
      TEASE_EVENTS.forEach((ev) => window.addEventListener(ev, onTeaseInput, { passive: true }));
    }
    const teaseRow = panels.filter((p) => p.row === Math.floor(TOTAL_ROWS / 2));
    const cancelTease = () => {
      teaseRestAt = null;
      teaseTl?.kill();
      teaseTl = null;
      teaseFlick?.kill(); // paused, it would sit in the root timeline forever
      teaseFlick = null;
    };
    const fireTease = () => {
      teaseFired = true;
      // each panel glides back to where it rested — a Thread bead sits at
      // its dark claim (10-09, w9b: s2BeadPower), not the bare idle level
      const rest = teaseRow.map((p) => p.mesh.material.uniforms.uPower.value);
      const flick = buildCascadeTimeline(teaseRow, TUNING.cascadeVariant, TOTAL_ROWS).pause();
      teaseFlick = flick;
      /* 10-09 (w9b, tease-reconcile): no first-frame SNAP. The cascade opens
         on a `set 0` per panel (the ignition's blackout, where 0 is already
         the value) — played from its first lit child it dropped every row
         panel to 0 on one frame (w9's sheets: a bead's 0.459 → 0). Those
         sets go, so each panel's flicker starts from its LIVE level (a dark
         bead, a ghosted shard — the ghost is the fog channel, untouched) and
         the settle below takes it back there on the Turn curve. The
         cascade module is the globe's (not this file's) — the row's copy is
         edited here, never the builder. A head set at the timeline's own
         time RENDERS AT CREATION (gsap's zero-duration rule: its start ==
         the parent's time and nothing is paused yet), so the row already
         read 0 when the builder returned: put each panel's live level back
         in the same synchronous call (no frame sees the 0). */
      flick.getChildren(false, true, false).forEach((c) => {
        if (c.duration() === 0) flick.remove(c);
      });
      teaseRow.forEach((p, i) => (p.mesh.material.uniforms.uPower.value = rest[i]));
      const lit = flick.getChildren(false, true, false).filter((c) => c.duration() > 0);
      const first = lit.length ? Math.min(...lit.map((c) => c.startTime())) : 0;
      teaseTl = gsap
        .timeline({
          onComplete: () => {
            teaseTl = null;
            teaseFlick?.kill();
            teaseFlick = null;
          },
        })
        .add(flick.tweenFromTo(Math.max(first - 0.05, 0), flick.duration(), { ease: 'none' }))
        .to(
          teaseRow.map((p) => p.mesh.material.uniforms.uPower),
          { value: (i) => rest[i], duration: 0.6, ease: turnEase }
        );
    };
    const stepTease = () => {
      if (teaseFired || teaseTl || !(TUNING.tease > 0) || stage !== 'stage-02' || activeTl) {
        if (stage !== 'stage-02' || activeTl) teaseRestAt = null;
        return;
      }
      const now = performance.now();
      if (teaseRestAt == null) teaseRestAt = now;
      if (now - Math.max(teaseRestAt, lastInputAt) >= TUNING.tease * 1000) fireTease();
    };

    /* — Render loop: shared gsap.ticker, local FPS gate (never
       gsap.ticker.fps — shared with SiteShell + Lenis). Belt drift, the
       camera tour and Thread reprojection ride the same tick. Reduced
       motion never runs the ticker: single frames only. — */
    let yaw = 0;
    let pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);
    const pitchLimit = THREE.MathUtils.degToRad(PITCH_LIMIT_DEG);
    let accumulated = 0;
    let sceneTime = 0;
    let statFrames = 0;
    let statStamp = typeof performance !== 'undefined' ? performance.now() : 0;
    const tick = (_time, deltaMs) => {
      accumulated += deltaMs / 1000;
      // 10-07 (perf-1): a whole-ms tolerance under the cap — the ticker's
      // 16ms deltas failed the strict check and drew 2 frames in 3. The
      // step stays the real elapsed time, so drift and tour speeds hold.
      if (accumulated < 1 / FPS_CAP - FRAME_GATE_SLACK) return;
      const step = accumulated;
      accumulated = 0;
      sceneTime += step;
      statFrames += 1;
      // Ambient drift and the drag are one channel — the engine returns the
      // ambient when no pointer is down, so this is the same rotation the
      // scene always had until someone grabs it.
      const { dx, dy } = drag ? drag.update(step) : { dx: AUTO_ROTATE_SPEED * step, dy: 0 };
      yaw += dx;
      pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch + dy));
      globeGroup.rotation.set(pitch, yaw, tiltState.z);
      if (contact.panel) composeContact(); // 10-07 (w7): the freed shard holds still while the world turns
      if (flightActive) stepFlight(); // after the yaw lands: the belt slots ride it
      if (tourActive) {
        // Both stations solved LIVE from their subjects' current positions,
        // then blended: the move tracks both while it crosses, and the hold
        // keeps tracking the one it landed on.
        stationCam(tourFrom, tourCamA);
        stationCam(tourTo, tourCamB);
        camera.position.lerpVectors(tourCamA, tourCamB, tourBlend.t);
      } else if (threadCamActive) {
        // S1→S2 connect: tracking the Thread's first bead, tight.
        threadCamSolve(tourCamB);
        camera.position.lerpVectors(threadCamFrom, tourCamB, threadCam.t);
      }
      if (beltDrifting) {
        // Suspended point cloud (v2 deck): slow LINEAR self-rotation at
        // per-shard varied speeds; positions rest — the whole-cloud
        // rotation is the group yaw above. No wobble.
        panels.forEach((p) => {
          if (p.driftFactor <= 0) return;
          const d = p.drift;
          p.mesh.rotateOnAxis(d.axis, d.speedRatio * TUNING.drift * step * p.driftFactor);
        });
        decoys.forEach((d) => {
          d.quat.multiply(decoySpin.setFromAxisAngle(d.axis, d.speedRatio * TUNING.drift * step));
        });
      }
      if (decoyMesh.visible) composeDecoys(); // flicker tweens + spin land here
      // 10-07 (w4): the Thread's words ride the same per-frame pass — only
      // once one is bound (w4 fix: the open gate alone ran keepBoxes' DOM
      // reads every frame of a Thread that may name nothing; a bind builds
      // its own view).
      // 10-07 (w5): and the S3 spec chips, once one is bound.
      // 10-07 (w7): and the CTA's first_contact (chipsLive — one predicate).
      if (chipsLive()) updateLabels();
      // 10-07 (w5): the S4 reach (desktop, at rest) and the S2 foreshadow.
      if (reachOn && stage === 'stage-04' && !activeTl) stepReach(step);
      // 10-07 (w6): the scene's cursor — the hover pick runs only where a
      // click could cue (setCursor writes on change only). A press the
      // engine already let go of (a window blur) stops reading as grabbing.
      if (drag) {
        // 10-08 (w8): a finger's press is not the engine's (touch: false) —
        // it lapses once too long to be a tap instead.
        if (tapDown.id != null && (tapDown.touch ? performance.now() - tapDown.t > TAP_MAX_MS : !drag.dragging)) tapDown.id = null;
        if (tapDown.id == null) setCursor(restCursor());
      }
      stepTease();
      if (threadActive) updateThread();
      if (track && flightActive) trackFrame(); // ?debug: the frame as it renders
      renderFrame();
      // 10-09 (w9b, ?debug): the station's draw calls, a held frame's worst
      if (chipBench && tourActive && atStation && chipBench.legs.length) {
        const leg = chipBench.legs[chipBench.legs.length - 1];
        leg.calls = Math.max(leg.calls, renderer.info.render.calls);
      }
    };
    globeGroup.rotation.set(pitch, 0, 0);

    /* — Idle budget: ticker + S5 loop pause offscreen or tab-hidden — */
    let tickerActive = false;
    let inView = true;
    const syncTicker = () => {
      const shouldRun = inView && !document.hidden && !PREFERS_REDUCED_MOTION;
      if (shouldRun && !tickerActive) {
        gsap.ticker.add(tick);
        tickerActive = true;
      } else if (!shouldRun && tickerActive) {
        gsap.ticker.remove(tick);
        tickerActive = false;
      }
      if (loopTl) loopTl.paused(!shouldRun);
      if (cueDc) cueDc.paused(!shouldRun); // 10-07 (w6): a tap cue waits on the same beat grid
      if (pageDc) pageDc.paused(!shouldRun); // 10-08 (w8): and a page chip's second look
      if (tourTl) tourTl.paused(!shouldRun);
      // The transition and the break's hang hold too: lagSmoothing(0) would
      // otherwise land a hidden tab's whole interval in one frame on return.
      if (activeTl) activeTl.paused(!shouldRun);
      if (sideTl) sideTl.paused(!shouldRun);
    };
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        syncTicker();
      },
      { threshold: 0.15 }
    );
    intersectionObserver.observe(container);
    const onVisibility = () => syncTicker();
    document.addEventListener('visibilitychange', onVisibility);
    syncTicker();
    // 10-10 (w9b): reduced motion paints on demand, and a native scroll's
    // stage-switch frame lands MID-scroll — the S2 dots' give-way then reads
    // the leaving card's rect (a phone kept ~half its dots hidden under the
    // counter's 42/42). One frame after the scroll settles re-reads the copy
    // at rest.
    const rmScrollSettle = PREFERS_REDUCED_MOTION
      ? settleDebounce(
          () => {
            if (disposed || !inView) return;
            updateThread();
            renderFrame();
          },
          { settleMs: 150, maxWaitMs: 1200 }
        )
      : null;
    if (rmScrollSettle) window.addEventListener('scroll', rmScrollSettle, { passive: true });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // Rest pose up before the driver's arrival sync (same layout phase):
    // the hero — the shards wait unseen while the lockup draws the O.
    applyPose(getPose('hero'));
    // 10-07 (w6): reduced motion's S5 readout is a still from the first
    // frame — it reads right as the section scrolls in, before its line.
    if (PREFERS_REDUCED_MOTION) s5Still();
    // Compile every program now, the hidden ones included (the white core,
    // the shock ring, the Thread, the chips): a first-use compile on the
    // impact frame would stall the break on exactly the frame it must land.
    renderer.compile(scene, camera);
    renderFrame();

    /* 10-07 (w3): every chip ON SCREEN, the leaving ones too (box centre +
       size, px, as last painted) — the probe's keep-out and frame-edge
       checks. Also a live getter (window.__swmProcessChips under ?debug):
       the 500ms stats are too stale to judge a chip against copy that is
       entering or gliding. */
    const chipBoxes = () =>
      labelSlots
        .filter((s) => s.target && s.box && s.group.visible && s.mats[0].opacity > 0.05)
        .map((s) => ({
          term: s.term,
          x: Math.round(s.box.x), y: Math.round(s.box.y), w: Math.round(s.box.w), h: Math.round(s.box.h),
          fading: s.fading,
          // 10-07 (w3 fix): on its last beat (the retract), and the anchor
          // dot — a box over its own dot is the clamp's failure
          retracting: s.retracting,
          ax: Math.round(s.box.ax), ay: Math.round(s.box.ay),
        }));
    // 10-07 (w5): any panel uniform's [min, max] — uPower (the Core's
    // light; 10-08 (w8): the S4 heartbeat's dip — unison reads min = max)
    // and uStrokeMix (S5's ink).
    const panelSpread = (name = 'uPower') => {
      let lo = Infinity;
      let hi = -Infinity;
      panels.forEach((p) => {
        // 10-09 (w9): a panel's own field (driftFactor) as well as a uniform
        const v = name in p ? p[name] : p.mesh.material.uniforms[name].value;
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      });
      return [+lo.toFixed(3), +hi.toFixed(3)];
    };
    /* 10-09 (w9, ?debug): the shards' worst distance off the current pose's
       slots — the belt's, or the Core's home × panelScale (world units; the
       freed CTA shard excepted, the hero has no slot read). */
    const slotV = new THREE.Vector3();
    const slotErr = () => {
      const pose = getPose(stage ?? 'stage-01');
      if (!pose || pose.form === 'hero') return null;
      let m = 0;
      panels.forEach((p) => {
        if (p === contact.panel) return;
        const t = pose.form === 'belt' ? p.beltPos : slotV.copy(p.homeOffset).multiplyScalar(pose.panelScale);
        m = Math.max(m, p.mesh.position.distanceTo(t));
      });
      return +m.toFixed(4);
    };
    /* The Core's vertical silhouette on screen: a sphere of RADIUS at the
       group's position, seen from the camera — its tangent rays, exact. */
    const liftReadout = () => {
      const h = container.clientHeight || 1;
      const tanV = TAN_V;
      const pose = getPose(stage ?? 'stage-01');
      // 10-09 (w9): S2's constellation lifts on its belt bound (framingFor)
      const R = pose?.thread ? RADIUS * pose.frameR : RADIUS;
      const dy = globeGroup.position.y - camera.position.y;
      const dz = camera.position.z - globeGroup.position.z;
      const dist = Math.hypot(dy, dz);
      if (dist <= R) return null;
      const mid = Math.atan2(dy, dz);
      const half = Math.asin(R / dist);
      const toY = (ang) => h / 2 - (Math.tan(ang) / tanV) * (h / 2);
      return {
        coreTop: Math.round(toY(mid + half)),
        coreBottom: Math.round(toY(mid - half)),
        cardTop: pose?.form === 'core' || pose?.thread ? Math.round(phoneCardTop(pose.id, h)) : null,
        navBottom: Math.round(navBottomPx()),
      };
    };
    // 10-10 (w9c fix R6): S2's beads at the bead level — over the string only
    // (0 off S2), so the count means the same on every field
    const beadsAtLevel = () =>
      threadActive ? threadChain.filter((p) => Math.abs(p.mesh.material.uniforms.uPower.value - s2BeadPower()) < 1e-3).length : 0;
    /* 10-10 (w9c fix R2, peek only): each panel's EDGE as the shader composes
       it on the stroke's line, before the haze — fill × uPower × (1 − mix) +
       ink × mix — in sRGB 0..255. Scoring mix × ink alone could not see a
       black ink move at all (the edge goes black ↔ lit fill as mix moves). */
    const edgeLin = new THREE.Color();
    const edgeOut = { r: 0, g: 0, b: 0 };
    const edgeOf = (p) => {
      const u = p.mesh.material.uniforms;
      const m = Math.min(Math.max(u.uStrokeMix.value, 0), 1) * (u.uStrokeWidthPx.value > 0.01 ? 1 : 0);
      const P = u.uPower.value;
      const F = u.uFallbackColor.value;
      const C = u.uStrokeColor.value;
      edgeLin.setRGB(F.r * P * (1 - m) + C.r * m, F.g * P * (1 - m) + C.g * m, F.b * P * (1 - m) + C.b * m);
      edgeLin.getRGB(edgeOut, THREE.SRGBColorSpace);
      return [Math.round(Math.min(edgeOut.r, 1) * 255), Math.round(Math.min(edgeOut.g, 1) * 255), Math.round(Math.min(edgeOut.b, 1) * 255)];
    };
    // 10-07 (w5): { peek } reads without restarting the fps window — the
    // probes' fine-grained sampling (__swmProcessPeek) leaves the 500ms
    // publish's fps honest.
    const getStats = ({ peek = false } = {}) => {
      const now = performance.now();
      const fps = Math.round((statFrames / Math.max(now - statStamp, 1)) * 1000);
      if (!peek) {
        statFrames = 0;
        statStamp = now;
      }
      /* Discovery-slide readouts for the bench: how many chips are actually
         live (a starved layer is the failure the bind rules can cause), and
         where the tour's subject sits in NDC — the proof that a station
         frames a labelled shard on its seat rather than empty field. */
      const chips = labelSlots
        .filter((s) => s.target && s.box && !s.fading && s.mats[0].opacity > 0.3)
        .map((s) => ({
          term: s.term,
          // which shard (panel index) or decoy ('d' + index) the chip names —
          // the probe checks a target never changes its word
          id: s.panel ? panels.indexOf(s.panel) : `d${decoys.findIndex((d) => d.pos === s.target)}`,
          x: Math.round(s.box.x), y: Math.round(s.box.y), w: Math.round(s.box.w),
          // 10-07 (w3): the box's height and the chip's dealt fill (null =
          // the plain body-face chip) — the probe checks a shard keeps its
          // FILL as well as its word.
          h: Math.round(s.box.h),
          fill: s.fill,
          key: Boolean(s.keyed), // 10-08 (w8): ?chipkey drew its keyline (on, or auto's sinking fill)
        }));
      const vis = chipBoxes();
      const keep = chipsLive() ? keepBoxes().map((b) => [b.x0, b.y0, b.x1, b.y1].map(Math.round)) : [];
      let subject = null;
      const st = tourActive && !tourTo.wide && tourTo.panel ? tourTo : null;
      if (st) {
        tourSubject.copy(st.panel.mesh.position);
        globeGroup.localToWorld(tourSubject);
        const view = labelView();
        const px = toPx(tourSubject, view, { x: 0, y: 0, depth: 0, perPx: 0 });
        if (px) {
          subject = {
            u: +(((px.x / view.vw) * 2 - 1).toFixed(2)),
            v: +((1 - (px.y / view.vh) * 2).toFixed(2)),
            seatU: +st.u.toFixed(2),
            seatV: +st.v.toFixed(2),
            blend: +tourBlend.t.toFixed(2),
            labelled: labelSlots.some((s) => s.panel === st.panel && s.target),
            id: panels.indexOf(st.panel), // 10-07 (w5 fix): never a spec word's shard (specHeld)
          };
        }
      }
      // Slot states for the probe: b bound · f fading · d waiting on a delayedCall · - idle
      const slots = labelSlots.map((s) => (s.target ? (s.fading ? 'f' : 'b') : s.dc ? 'd' : '-')).join('');
      const cam = [camera.position.x, camera.position.y, camera.position.z].map((v) => +v.toFixed(3));
      return {
        fps, calls: renderer.info.render.calls, stage, chips, vis, keep, slots, atStation, cam,
        tour: subject ?? (tourActive ? 'wide' : 'off'),
        // 10-07 (w3): the leg being flown (wide | glance | linger | even) and
        // its chip cap (null = every slot)
        leg: tourActive ? tourKind : null,
        legN: tourActive ? tourLegCount : null, // 0 = the opening wide
        cap: Number.isFinite(chipCap) ? chipCap : null,
        // the globe-O: still whole (the lockup draws it) / which flight is in the air
        hero: heroIntact,
        flight: flightActive ? flightMode : null,
        // 10-07 (final review): the decoy flood — how many are up (s > 0.5)
        // and its heat (the break's white, 0 = navy). The arrival used to
        // kill its own rises and leave all 36 at s 0.
        decoys: decoyMesh.visible ? decoys.reduce((n, d) => n + (d.s > 0.5 ? 1 : 0), 0) : 0,
        decoyHeat: +decoyMaterial.uniforms.uBlueMix.value.toFixed(2),
        impactAt, // performance.now() of the last break's impact — the probe's beat anchor
        /* 10-07 (w4) bench readouts: the Thread's words this show (term,
           fill, bead), how many chain beads S1 named, the panels' uPower spread [min, max] (a uniform Core
           reads min = max), the seam hex, and the phone lift — the Core's
           silhouette top/bottom against its card and the nav, px. */
        threadWords: threadWordsBound,
        threadMiss: threadWordsMiss,
        threadNamed: threadChain.reduce((n, p) => n + (termOf.has(p.mesh.position) ? 1 : 0), 0), // chain beads S1 named
        threadPool: threadPoolNamed, // 10-07 (w5): …of the panels S1 named in all
        threadShape, // 10-07 (w5): the last chain's length and outward-hop share
        // each chain bead in hop order: 1 = on screen now, 0 = off (the riser A/B's "do the last hops land in frame")
        threadFrame: threadChain
          .map((p) => {
            lblNdc.copy(p.mesh.position);
            globeGroup.localToWorld(lblNdc).project(camera);
            return lblNdc.z <= 1 && Math.abs(lblNdc.x) < 1 && Math.abs(lblNdc.y) < 1 ? 1 : 0;
          })
          .join(''),
        power: panelSpread(),
        // 10-08 (w8b): the panels' MEAN uPower to 5 places — an S4 exit's
        // recovery moves under 0.001 a frame near its rest, which [min, max]'s
        // 3 places would read as a frozen hold (the --into harness).
        powerMean: +(panels.reduce((a, p) => a + p.mesh.material.uniforms.uPower.value, 0) / panels.length).toFixed(5),
        sceneT: +sceneTime.toFixed(4), // …and the scene's drawn-frame clock: a 120Hz rAF reads each 60fps frame twice
        // 10-08 (w8b fix): the transition in flight — its data ('recover' = an
        // S4 exit completing a dip; goTo's `dip` reads it), 'morph' otherwise
        tl: activeTl ? activeTl.data ?? 'morph' : null,
        // 10-09 (w9, ?debug): the transition's own clock, and the S2/S3
        // clocks the copy leads from (the S2 harness lines them up)
        tlT: activeTl ? +activeTl.time().toFixed(3) : null,
        clocks: { s2Connect: +s2ConnectEnd().toFixed(3), s2Reveal: +s2RevealAt().toFixed(3), s3Ignition: s3Ignition() },
        thread: threadActive ? { n: threadChain.length, frac: +threadDraw.frac.toFixed(3), on: threadLine.visible } : null,
        innerScale: +innerSphere.scale.x.toFixed(3),
        beltDrifting,
        // …and whether a landing is EXACT: the shards' worst distance off the
        // current pose's slots (world units; peek only), the drift spread
        // (S2's beads at S2_CLAIM_DRIFT) and the solid field's live state
        // (10-10 (w9c): `field` — the layers, the clip, the ramp, the fog)
        slotErr: peek ? slotErr() : undefined,
        drift: panelSpread('driftFactor'),
        fog: +fogState.amount.toFixed(3), // S2's constellation rests with no air
        // S2's claims, counted: [beads on the string, panels drift-damped, panels dimmed to the claim]
        // 10-10 (w9c fix R6): the third counts the STRING's beads at the bead
        // level — over every panel it read the whole lit world on black
        // (s2BeadPower() = ?s2lit = 1 = a lit S3/S5 panel's power)
        claims: [threadActive ? threadChain.length : 0, panels.filter((p) => p.driftFactor > 0 && p.driftFactor < 0.5).length, beadsAtLevel()],
        /* 10-09 (w9b, ?debug): S2's refine — ghost (worst / panels over 0.01,
           as the composed weight progress × ?s2ghost), the dark beads (at
           s2BeadPower), the dots (struck / drawn / fully grown, and the worst
           anchor error vs the line's own vertex, px — peek only) and the
           panels' heat (max uBlueMix: one ping per hit, 0 at rest) */
        s2: {
          ghostMax: +Math.max(...panels.map((p) => p.gh.k * Math.min(Math.max(TUNING.s2Ghost, 0), 1))).toFixed(3),
          ghosted: panels.filter((p) => p.gh.k * Math.min(Math.max(TUNING.s2Ghost, 0), 1) > 0.01).length,
          dark: beadsAtLevel(), // 10-10 (w9c fix R6): the string's beads at the bead level, on every field
          dotsOn: s2Dots.d.reduce((n, d) => n + (d.hit ? 1 : 0), 0),
          dotsDrawn: s2DotMesh.count,
          dotsGrown: s2Dots.d.reduce((n, d) => n + (d.k >= 0.999 ? 1 : 0), 0),
          dotErr: +s2DotErrNow.toFixed(3), // the last composed frame's worst, px (vs the line's visible end — fix R1)
          dotEnd: +s2DotEndNow.toFixed(3), // …vs the end the shard's own triangles give, px (armed: __swmProcessDotCheck)
          heat: +Math.max(...panels.map((p) => p.mesh.material.uniforms.uBlueMix.value)).toFixed(4),
          // every panel with heat on it now: [index, heat] (the harness counts one peak per hit)
          hot: panels.reduce((a, p, i) => (p.mesh.material.uniforms.uBlueMix.value > 1e-3 ? (a.push([i, +p.mesh.material.uniforms.uBlueMix.value.toFixed(4)]), a) : a), []),
          fx: s2Fx.size,
        },
        chain: lastChain.map((p) => panels.indexOf(p)), // S2's beads by panel index (the last show's, or the slot-strung one)
        // …and any bead off its claim: [panel index, power, a chip pulse on it]
        claimsOff: threadActive ? threadChain.filter((p) => Math.abs(p.mesh.material.uniforms.uPower.value - s2BeadPower()) >= 1e-3).map((p) => [panels.indexOf(p), +p.mesh.material.uniforms.uPower.value.toFixed(3), Boolean(p.pulse)]) : [],
        // 10-10 (w9c): the layers as bgState holds them (a = the solid's
        // opacity, as before; g the gradient's, ramp its black stop, cover
        // the clip's share), data-bg, and the haze's live colour (sRGB hex);
        // clip keeps w9b's meaning (a clip-path is ON — the circle can still
        // trim the corners after its area passes the viewport's, cover 1)
        field: solidEl
          ? {
              a: +bgState.s.toFixed(3),
              clip: Boolean(solidEl.style.clipPath && solidEl.style.clipPath !== 'none'),
              g: +bgState.g.toFixed(3),
              ramp: +bgState.ramp.toFixed(3),
              cover: +bgState.cover.toFixed(3),
              bg: rootEl?.getAttribute('data-bg') ?? null,
              opening: fieldOf('open'),
              fog: `#${liveField().getHexString(THREE.SRGBColorSpace)}`,
            }
          : null,
        // 10-08 (w8b, ?debug): ?chipcover's arm; the S1 picks' cost ring (peek
        // only — n picks so far, ms[i % 256]) and the strict seats over
        // CHIP_COVER_MAX (pickTarget)
        chipCover: chipCoverMode(),
        pick: peek && pickCost ? { n: pickCost.n, ms: Array.from(pickCost.ms, (v) => +v.toFixed(3)) } : undefined,
        strictOver: strictSeen,
        // 10-09 (w9b, ?debug): the chip bench's station log + leader×chip crossings (peek only)
        chipStats: peek && chipBench ? { legs: chipBench.legs, xEp: chipBench.xEp, xFrames: chipBench.xFrames, slots: labelSlots.length, first: chipBench.first, wraps: chipBench.wraps, wrapAt: chipBench.wrapAt, renames: chipBench.renames, xLog: chipBench.xLog } : undefined,
        holdCheck: peek && holdCheck ? holdCheck : undefined,
        holdAudit, // 10-08 (w8b, ?debug): the predicted hold vs what happened (checkHold)
        ink: panelSpread('uStrokeMix'), // 10-07 (w5): the stroke [min, max] (10-08: S5's ink; the heartbeat is on `power`)
        // 10-07 (w6): the stroke's COLOUR — panel 0's hex and whether every
        // panel shares it (the belt's black off the loops; S5's drift varies)
        inkHex: (() => {
          const hex = panels[0].mesh.material.uniforms.uStrokeColor.value.getHexString();
          return { hex: `#${hex}`, uniform: panels.every((p) => p.mesh.material.uniforms.uStrokeColor.value.getHexString() === hex) };
        })(),
        edge: peek ? panels.map(edgeOf) : undefined, // 10-10 (w9c fix R2): every panel's composed edge, sRGB [r, g, b]
        seam: innerSphere.visible ? `#${innerMaterial.color.getHexString()}` : null,
        lift: IS_MOBILE ? liftReadout() : null,
        /* 10-07 (w5) bench readouts: the S3 spec sheet (on = binding; log =
           this visit's binds in order — term, s from its start, panel, polar
           angle deg), the S4 heartbeat's loop kind, the reach state (max lean
           now, 0..1), the S2 foreshadow (armed / fired this visit). */
        spec: specActive || specChipsLive() ? { on: specActive, log: specLog } : null,
        loop: loopTl ? getPose(stage ?? 'stage-01')?.loops?.kind ?? null : null,
        /* 10-07 (w6) the S5 clock for the harness: phase (count_in | drop |
           groove | cue), passes since the rest began (1 = the live pass),
           the readout's page (-1 = live), the drop (performance.now ms —
           scheduled, then actual) and the intro's build (the copy's cue),
           the loop's time and its beat zero (s), the pending cue's panel,
           this rest's cues, the panels lit now (uPower > 0.9 — a cue's
           ripple starts at its shard), and the spin (yaw, rad) for the
           click-stall check. */
        s5:
          stage === 'stage-05' || s5Phase
            ? {
                phase: s5Phase,
                pass: s5Pass,
                chapter: s5Chapter,
                dropAt: s5DropT == null ? null : Math.round(s5DropT),
                buildAt: s5BuildT == null ? null : Math.round(s5BuildT),
                t: loopTl ? +loopTl.time().toFixed(3) : null,
                origin: +loopOrigin.toFixed(3),
                cue: cuePending ? panels.indexOf(cuePending) : null,
                cues: cueLog,
                hot: panels.reduce((a, p, i) => (p.mesh.material.uniforms.uPower.value > 0.9 ? [...a, i] : a), []),
                yaw: +yaw.toFixed(4),
                cursor: cursorNow,
                // 10-08 (w8): the page chips — the gate and this rest's log
                // ({ p, term, at (performance.now ms), id | null (no seat),
                // hit (s into its pass), fill })
                pageOn: pageActive,
                pages: pageLog,
              }
            : null,
        reach: +reachMax.toFixed(3),
        tease: { fired: teaseFired, running: Boolean(teaseTl), row: peek ? teaseRow.map((p) => +p.mesh.material.uniforms.uPower.value.toFixed(4)) : undefined }, // 10-09 (w9b, ?debug peek): the row's live power
        /* 10-07 (w7, cta-finale) the CTA for the harness: the commit /
           resolve / landing / chip-seat clocks (performance.now ms; the
           resolve vs S5's grid is resolveAt − commitAt against the beat),
           the freed shard (panel index, k, its live screen px), the chip
           (term, fill, box — up and not leaving), its beat tries, whether
           the pick fit at the predicted rest, the loop (breathe | hold),
           the hover, and the free rect it frames into. */
        cta:
          stage === 'cta' || contact.panel
            ? (() => {
                const slot = labelSlots.find((s) => s.cta && s.target && !s.fading);
                let px = null;
                if (contact.panel) {
                  tourSubject.copy(contact.panel.mesh.position);
                  globeGroup.localToWorld(tourSubject);
                  const p = toPx(tourSubject, labelView(), { x: 0, y: 0, depth: 0, perPx: 0 });
                  if (p) px = [Math.round(p.x), Math.round(p.y)];
                }
                const r = stage === 'cta' ? ctaRestGeom().rect : null;
                return {
                  commitAt: contact.commitAt == null ? null : Math.round(contact.commitAt),
                  resolveAt: contact.resolveAt == null ? null : Math.round(contact.resolveAt),
                  landAt: contact.landAt == null ? null : Math.round(contact.landAt),
                  seatedAt: contact.seatedAt == null ? null : Math.round(contact.seatedAt),
                  freed: contact.panel ? panels.indexOf(contact.panel) : null,
                  // its live uPower — the hover pulse dips it (?labelpulse × 1)
                  power: contact.panel ? +contact.panel.mesh.material.uniforms.uPower.value.toFixed(3) : null,
                  k: +contact.k.toFixed(3),
                  px,
                  chip: slot ? { term: slot.term, fill: slot.fill, box: slot.box ? [slot.box.x, slot.box.y, slot.box.w, slot.box.h].map(Math.round) : null } : null,
                  tries: contact.tries,
                  fits: contact.fits,
                  room: contact.room,
                  predicted: contact.at, // vs px / chip.box at the rest: the rest geometry's proof
                  pool: contact.pool,
                  nz: contact.nz, // ≤ 0.7: the pick sat on the limb
                  // panels lit past the breath's peak (uPower > 0.9), the freed shard
                  // aside — 0 through every breath; a wrap that flashed (the
                  // repeat trap) would read the whole world
                  lit: panels.reduce((n, p) => n + (p !== contact.panel && p.mesh.material.uniforms.uPower.value > 0.9 ? 1 : 0), 0),
                  loop: TUNING.ctaLoop,
                  hover: contact.hover,
                  rect: r ? [r.x0, r.y0, r.x1, r.y1].map(Math.round) : null,
                };
              })()
            : null,
      };
    };

    apiRef.current = {
      goTo,
      setStageInstant,
      getStage: () => stage,
      // 10-07 (w3 fix): the driver's commit — the chips leave the moment the
      // reader commits off the belt, not when the glide crosses a line.
      leaveLabels,
      // 10-07 (w4): and the Thread's words, on a commit off stage-02.
      leaveThreadWords,
      // The copy hook's side of the O: where the mark sits, its live lockup,
      // and the break/reform cues (useProcessCopy registers it on mount).
      setHeroMark: (mark) => {
        heroMark = mark ?? null;
      },
      // 10-07 (w4 fix): and its COPY_BEAT cue (copyBeat).
      setCopyBeat: (fn) => {
        copyBeat = fn ?? null;
      },
      // 10-07 (w5): when S3→S4's push-in starts — the copy's S4 lead.
      s4PushAt,
      // 10-09 (w9, s2-hold): the S2 blurb's rise (the pull back to the
      // constellation) and S2→S3's ignition window — the copy's S2/S3 leads.
      s2RevealAt,
      s3Ignition,
      getStats,
      getFlightTrack, // ?debug: the break track (null without it)
      getChipBoxes: chipBoxes, // ?debug: the chips as last painted (w3 probe)
      applyTuning,
      replay,
    };

    /* — Teardown (ADR-0002): full release, context loss included — */
    return () => {
      disposed = true;
      ctaEdgeInk = () => 1; // 10-10 (w9c fix2): the module's default — never this island's stale DOM
      apiRef.current = NOOP_API;
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      settleReframe.cancel();
      gsap.killTweensOf(camLag);
      document.removeEventListener('visibilitychange', onVisibility);
      if (rmScrollSettle) {
        window.removeEventListener('scroll', rmScrollSettle);
        rmScrollSettle.cancel();
      }
      if (tickerActive) gsap.ticker.remove(tick);
      pendingNext = null;
      killActiveTl(); // the show rush's timeScale ramp too
      stopFlight();
      stopLoops();
      stopTour();
      releaseContact(true); // 10-07 (w7): the freed shard's tweens + pulse
      window.removeEventListener('swm:process-cta-hover', onCtaHover);
      gsap.killTweensOf(fogState);
      drag?.dispose();
      // 10-07 (w5): the reach's pointer, the foreshadow's input watch + row
      container.removeEventListener('pointermove', onReachMove);
      container.removeEventListener('pointerleave', onReachLeave);
      // 10-07 (w6): the tap cue's press/release, and the cursor it owned
      container.removeEventListener('pointerdown', onTapDown);
      container.removeEventListener('pointerup', onTapUp);
      container.removeEventListener('pointercancel', onTapUp);
      container.removeEventListener('lostpointercapture', onTapUp);
      container.style.cursor = '';
      TEASE_EVENTS.forEach((ev) => window.removeEventListener(ev, onTeaseInput));
      cancelTease();
      // 10-10 (w9c): the field layers carry no tweens of their own (every
      // fade is a proxy inside a killed timeline) — nothing to kill here.
      panels.forEach((panel) => {
        gsap.killTweensOf(panel);
        gsap.killTweensOf(panel.mesh.scale);
        gsap.killTweensOf(panel.mesh.material.uniforms.uPower);
        gsap.killTweensOf(panel.mesh.material.uniforms.uStrokeMix);
        gsap.killTweensOf(panel.mesh.material.uniforms.uBlueMix);
        gsap.killTweensOf(panel.fl);
        panel.geometry.dispose();
        panel.mesh.material.dispose();
      });
      stopLabels();
      labelSlots.forEach((slot) => {
        slot.tl?.kill();
        slot.cut?.kill();
        slot.dc?.kill();
        gsap.killTweensOf(slot, 'fillK,leadK'); // 10-07 (w3): the fill's wipe/retract (final review: and the leader's draw)
        gsap.killTweensOf(slot.mats);
        slot.mats.forEach((m) => m.dispose());
        slot.texture.dispose();
        slot.group.removeFromParent();
      });
      // 10-09 (w9b): the leader + dot batches
      labelBatches.forEach((B) => {
        B.lines.geometry.dispose();
        B.lines.material.dispose();
        B.dots.material.dispose();
        B.dots.dispose();
      });
      labelPlaneGeo.dispose();
      labelDotGeo.dispose();
      // 10-09 (w9b): S2's hits, ghosts and dots
      killS2Fx();
      panels.forEach((p) => gsap.killTweensOf(p.gh));
      s2Dots.d.forEach((d) => gsap.killTweensOf(d));
      s2DotGeo.dispose();
      s2DotMat.dispose();
      s2DotMesh.dispose();
      decoys.forEach((d) => gsap.killTweensOf(d));
      gsap.killTweensOf(decoyMaterial.uniforms.uBlueMix);
      decoyGeometry.dispose();
      decoyMaterial.dispose();
      innerSphereGeometry.dispose();
      innerMaterial.dispose();
      gsap.killTweensOf(heroCore.scale);
      heroCoreGeometry.dispose();
      heroCoreMaterial.dispose();
      gsap.killTweensOf(shockRing.scale);
      gsap.killTweensOf(shockMaterial);
      shockGeometry.dispose();
      shockMaterial.dispose();
      heroMark = null;
      copyBeat = null;
      threadGeometry.dispose();
      threadMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return apiRef;
}
