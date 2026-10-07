/**
 * useProcessScene — the ProcessScene stage machine (spec §3).
 *
 * The site's third route-scoped canvas (ADR-0002): five scene states, one
 * authored time-domain transition per boundary, all on the house Turn
 * curve. Built from the home globe's primitives per ADR-0003's grammar —
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
 * LIT_COLOR blue from birth and never tweens — the page speaks through
 * uPower, the black edge stroke (uStrokeMix), and the STAGED BACKGROUND.
 * P2 (Nathan): S1/S2 play on a blank BRAND-WHITE canvas (blue Fragments,
 * black-stroked, gathering as blue elements); at the S3 solidify the blue
 * fill EMANATES from the Core's screen-space disc to flood the canvas —
 * the world sits on BLUE, never black; S5 crossfades to the home hero's
 * black→blue gradient.
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
 * Stages: S1 drifting Fragment belt (seeded, empty center) → S2 the Thread
 * chains ?threadhops Fragments with STRAIGHT segments from the center,
 * then the pull-in assembly seats beads in HOP ORDER (string pulled taut;
 * the unchained swept up behind) → S3 field-contraction + cascade
 * light-up (strokes burn off) → S4 per-panel emanation over the
 * dissolving core → S5 musical rhythm loops (?pattern/?hold/?decay).
 *
 * Live tuning: every knob is read from the mutable TUNING object at
 * use-time (framing, the drift tick, transition build), so the ?debug
 * panel applies changes without a reload — applyTuning() re-seeds the
 * belt / re-frames / re-strokes / rebuilds a running loop, replay()
 * re-runs the current stage's transition from the previous rest pose.
 *
 * API (spec §3): goTo(stageId) — one active transition at a time; an
 * interrupting goTo kills the running timeline and plays a compressed
 * catch-up morph. setStageInstant(stageId) — reduced-motion path: jump to
 * the stage's rest pose, render one frame (RM's stage-02 still is the
 * connected belt with the Thread fully drawn).
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
import { scrambleTo } from '../../lib/scramble.js';
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
  S5_STROKE_A,
  S5_STROKE_B,
  DESKTOP_OFFSET_X,
  EXIT_RATIO,
  PASS_BEATS,
  CAM_LAG_S,
} from './processConfig.js';
import { settleDebounce } from '../../lib/settleResize.js';

gsap.registerPlugin(CustomEase);

const NOOP_API = {
  goTo: () => {},
  setStageInstant: () => {},
  getStage: () => null,
  materializeBelt: () => {},
  getStats: () => ({ fps: 0, calls: 0, stage: null }),
  applyTuning: () => {},
  replay: () => {},
};
const TOTAL_ROWS = LAT_BANDS + 2;
const STAGE_IDS = ['stage-01', 'stage-02', 'stage-03', 'stage-04', 'stage-05'];
const IDENTITY_QUAT = new THREE.Quaternion();
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* Per-stage rest poses, computed fresh from TUNING at every use so live
   tuning applies. form: 'belt' (scattered Fragments, no inner sphere) or
   'core' (assembled globe). frameR = effective radius the contain fit
   frames; panelScale = emanation; power/stroke = the panel language;
   innerScale = the filled-core sphere (0 = dissolved — S4/S5, where it
   would block the expanded world's gap-lattice); bg = the staged
   background ('blue' brand opening — S1/S2 / 'black' solidified world — S3/S4,
   grows from the Core at the solidify / 'gradient' home-hero — S5. White copy
   throughout. The white blank-canvas start is retired).
   Reduced motion keeps stage-02 as the connected belt (Thread pre-drawn,
   static) so the narrative survives as stills. */
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
  // Fragments gather on blue (STROKE_COLOR separates them), as the world does
  // from S3 on. The P2 white-canvas experiment is reverted.
  bg: 'blue',
  loops: false,
  decoys: true, // the S1 flood — culled at the refinement
});
const getPose = (id) => {
  switch (id) {
    case 'stage-01':
      return beltPose();
    case 'stage-02':
      return PREFERS_REDUCED_MOTION
        ? { ...beltPose(), decoys: false } // RM still: the REFINED belt — flood already culled
        : { form: 'core', frameR: 1, fill: TUNING.fillFraction, panelScale: 1, power: TUNING.idlePower, stroke: 1, innerScale: INNER_SPHERE_SCALE, bg: 'blue', loops: false };
    case 'stage-03':
      // Rev: at the solidify the Core's field floods to brand BLACK (grows
      // from the core over the blue opening) — the world sits on black from
      // P3 on (matches the homepage globe's black backdrop).
      return { form: 'core', frameR: 1, fill: TUNING.s3Fill, panelScale: 1, power: 1, stroke: 0, innerScale: INNER_SPHERE_SCALE, bg: 'black', loops: false };
    case 'stage-04':
      // Rev: the built world keeps sitting on the brand-BLACK field (P3→P4).
      return { form: 'core', frameR: TUNING.emanateScale, fill: TUNING.s45Fill, panelScale: TUNING.emanateScale, power: 1, stroke: 0, innerScale: 0, bg: 'black', loops: false };
    case 'stage-05':
      // v2 deck (B8): slight push-in over the S4 framing (?s5zoom) and an
      // axis lean toward ~2:00 (?s5tilt) — the world, emphasized, off-axis.
      return { form: 'core', frameR: TUNING.emanateScale, fill: TUNING.s45Fill * TUNING.s5Zoom, panelScale: TUNING.emanateScale, power: 1, stroke: 0, innerScale: 0, bg: 'gradient', loops: true, tilt: -THREE.MathUtils.degToRad(TUNING.s5TiltDeg) };
    default:
      return null;
  }
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

export default function useProcessScene(containerRef, captionRef, chromeRefs) {
  const apiRef = useRef(NOOP_API);

  // Layout effect: the scroll driver's useGSAP (called after this hook)
  // syncs the arrival stage on mount — the machine must exist by then.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    const turnEase = CustomEase.create('processTurn', TURN_EASE_PATH);

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
        panel.beltPos = slots[order[i]];
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
       black, the Fragment stroke's color on the blue field. — */
    const ATTACH_DEPTH = RADIUS * 0.06;
    const threadMaterial = new LineMaterial({
      color: STROKE_COLOR,
      linewidth: TUNING.strokePx,
      transparent: true,
      dashed: true,
      gapSize: 1e6, // trim-path draw: dashSize = drawn length, one dash
    });
    const threadGeometry = new LineGeometry();
    threadGeometry.setPositions([0, 0, 0, 0, 0, 0]);
    const threadLine = new Line2(threadGeometry, threadMaterial);
    threadLine.visible = false;
    globeGroup.add(threadLine);

    /* — Framing: tan-space contain fit (mobile too — the belt must fit
       whole, spec §7; never the home cover-overscan). Right-of-center on
       desktop via group offset. — */
    const framingFor = (pose) => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
      const tanH = tanV * (w / h);
      const tanFit = Math.min(tanV, tanH);
      const z = (RADIUS * pose.frameR) / Math.sin(Math.atan(pose.fill * tanFit));
      const offsetX = IS_MOBILE ? 0 : z * tanH * DESKTOP_OFFSET_X;
      // Phone: the Core drops below the centered copy band (?dropy) — the
      // vertical analog of the desktop offset. The sparse belt reads fine
      // behind full-width copy and stays centered.
      const offsetY = IS_MOBILE && pose.form === 'core' ? -(z * tanV * TUNING.mobileDrop) : 0;
      return { z, offsetX, offsetY };
    };

    /* — Machine state — */
    let stage = null;
    let activeTl = null;
    // S5 axis lean (v2 deck, B8). The tick re-asserts rotation every
    // frame, so the tilt MUST live here and be read there — a tween on
    // globeGroup.rotation directly would be overwritten next frame.
    const tiltState = { z: 0 };
    let loopTl = null;
    let beltDrifting = false; // tick writes belt transforms only while true
    let beltHidden = !PREFERS_REDUCED_MOTION; // arrival: shards absent until materializeBelt()
    let threadActive = false; // tick reprojects the Thread only while true
    // The tour's stations, blend and camera solutions live with the tour
    // itself (below the resize doctrine — they ride camLag); only the latch
    // has to be up here, because applyCamLag/retargetCam must stand down
    // while the tour owns camera.position.
    let tourTl = null;
    let tourActive = false;
    let threadChain = [];     // claimed panels, hop order
    let threadDraw = { frac: 0, alpha: 1 };

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
    const poseFog = (pose) => (pose.form === 'belt' ? Math.max(TUNING.fog, 0) : 0);
    const applyFogUniforms = () => {
      const span = Math.max(TUNING.fogSpan * TUNING.scatter, 0.05);
      // uFogNear/Far are VIEW depths. Fixing them to the establishing
      // distance (not camera.position.z) is what makes the window still in
      // world terms: the dolly shortens every shard's view depth as it
      // pushes in, so what it approaches comes forward out of the haze.
      const baseZ = framingFor(getPose('stage-01')).z;
      const near = baseZ - span * 0.25;
      const far = baseZ + span;
      fogState.near = near;
      fogState.far = far;
      for (let i = 0; i < panels.length; i++) {
        const u = panels[i].mesh.material.uniforms;
        u.uFogAmount.value = fogState.amount;
        u.uFogNear.value = near;
        u.uFogFar.value = far;
      }
      const du = decoyMaterial.uniforms;
      du.uFogAmount.value = fogState.amount;
      du.uFogNear.value = near;
      du.uFogFar.value = far;
    };

    // Every render path funnels through here — the tick, the reduced-motion
    // single frames, the arrival stamp — so the haze can never be a frame
    // stale behind the dolly it is measured against.
    const renderFrame = () => {
      applyFogUniforms();
      renderer.render(scene, camera);
    };

    /* — The staged background. The page's base is the brand-BLUE opening
       (S1/S2); the home-hero gradient is S5. In between, `blueEl` is the
       SOLIDIFY FIELD — repurposed to brand BLACK (see .process-bg__blue in
       process.css): the S2→S3 solidify GROWS it out of the Core's live
       screen-space disc (clip-path circle tracking the dolly per frame) to
       flood the canvas black; the reverse shrinks it back into the Core,
       restoring the blue opening. Stage jumps / compressed catch-ups
       crossfade instead — a morph only reads against its dolly. data-bg on
       the island root re-skins the DOM accents (captions, tokens, copy) per
       field (white copy on both blue and black). — */
    const rootEl = chromeRefs?.rootRef?.current ?? null;
    // The solidify field layer (brand black); shown only from P3 (bg:'black').
    const blueEl = chromeRefs?.blueRef?.current ?? null;
    const gradientEl = chromeRefs?.gradientRef?.current ?? null;

    const setBgAttr = (bg) => {
      rootEl?.setAttribute('data-bg', bg);
    };

    /* The Core's live screen-space disc — projected fresh so the
       contraction chases the dolly exactly. render() hasn't run for this
       frame yet, so refresh the camera's inverse ourselves. */
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
      const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
      const r = (RADIUS / (tanV * dist)) * (h / 2);
      return { cx, cy, r, w, h };
    };

    const bgInstant = (bg) => {
      setBgAttr(bg);
      if (blueEl) {
        gsap.killTweensOf(blueEl);
        gsap.set(blueEl, { autoAlpha: bg === 'black' ? 1 : 0, clipPath: 'none' });
      }
      if (gradientEl) {
        gsap.killTweensOf(gradientEl);
        gsap.set(gradientEl, { autoAlpha: bg === 'gradient' ? 1 : 0 });
      }
    };

    /* The contraction/expansion — the blue field becomes the Core (and
       back). Rides the caller's window (the S2↔S3 dolly). Endpoints are
       tl.call()s, NOT tl.set()s: a set is itself a tween of blueEl, and
       any killTweensOf(blueEl) (bgInstant on a stage jump) would silently
       eat it — the stuck-clipped-circle bug this note commemorates. */
    const bgMorph = (tl, at, dur, expanding) => {
      if (!blueEl) return;
      const proxy = { t: expanding ? 1 : 0 };
      const stamp = () => {
        const { cx, cy, r, w, h } = discPx();
        const cover = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
        const radius = cover + (r * 1.03 - cover) * proxy.t;
        blueEl.style.clipPath = `circle(${radius.toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px)`;
      };
      tl.call(() => {
        stamp(); // no unclipped first frame on the expansion
        gsap.set(blueEl, { autoAlpha: 1 });
      }, null, at);
      tl.to(proxy, { t: expanding ? 0 : 1, duration: dur, ease: turnEase, onUpdate: stamp }, at);
      tl.call(() => {
        // Contraction hands off to the WebGL core — same blue, seamless.
        gsap.set(blueEl, expanding ? { clipPath: 'none' } : { autoAlpha: 0, clipPath: 'none' });
      }, null, at + dur);
    };

    /* Generic background leg for every other from→to (jumps, compressed
       catch-ups, the S5 gradient beats). */
    const bgCrossfade = (tl, at, dur, toBg) => {
      if (blueEl) {
        tl.call(() => gsap.set(blueEl, { clipPath: 'none' }), null, at);
        tl.to(blueEl, { autoAlpha: toBg === 'black' ? 1 : 0, duration: dur, ease: 'power2.inOut' }, at);
      }
      if (gradientEl) {
        tl.to(gradientEl, { autoAlpha: toBg === 'gradient' ? 1 : 0, duration: dur, ease: 'power2.inOut' }, at);
      }
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
    };
    const clearThread = () => {
      threadActive = false;
      threadCamActive = false; // the camera is the assembly's (or an interrupt's) now
      threadChain = [];
      threadDraw = { frac: 0, alpha: 1 };
      threadLine.visible = false;
    };

    /* Greedy nearest-neighbor chain from the belt center, computed at
       goTo time from live positions (drift is slow; endpoints stay live
       via per-frame projection). */
    const buildChain = () => {
      const pool = [...panels];
      const chain = [];
      const cursor = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < Math.min(TUNING.threadHops, pool.length); i++) {
        let best = 0;
        let bestDist = Infinity;
        pool.forEach((p, idx) => {
          const dist = cursor.distanceToSquared(p.mesh.position);
          if (dist < bestDist) {
            bestDist = dist;
            best = idx;
          }
        });
        const picked = pool.splice(best, 1)[0];
        chain.push(picked);
        cursor.copy(picked.mesh.position);
      }
      return chain;
    };

    const fireCaption = (text) => {
      const el = captionRef?.current;
      if (el) scrambleTo(el, text);
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
    const LABEL_TERMS = [
      'image_references', 'brand_cadence', 'artist_personality', 'artist_interests',
      'call_notes', 'inquiry_notes', 'preliminary_research', 'market_research',
      'music_catalog', 'market_gaps', 'pop_culture', 'industry_analysis',
      'genre_gaps', 'industry_opportunities', 'design_history', 'art_history',
      'industry_trends',
    ];
    const LABEL_FRONT_EPS = 0.05; // normal·view-axis floor (front-facing)
    const LABEL_NDC_BIND = 0.86; // pick only shards comfortably on-screen
    const LABEL_BIND_FACING = 0.4; // normal·view-axis floor to TAKE a chip (≈66° of square); the keep floor stays LABEL_FRONT_EPS
    const LABEL_HAZE_MAX = 0.45; // a target more hazed than this is too faint to be pointed at
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
    let termCursor = 0;
    const labelSlots = [];
    const labelGroup = new THREE.Group();
    scene.add(labelGroup);
    // Shared across every slot — one plane, one disc, scaled per frame.
    const labelPlaneGeo = new THREE.PlaneGeometry(1, 1);
    const labelDotGeo = new THREE.CircleGeometry(1, 12);

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
      const leaderMat = new THREE.LineBasicMaterial({
        transparent: true, depthWrite: false, opacity: 0,
      });
      const dotMat = new THREE.MeshBasicMaterial({
        transparent: true, depthWrite: false, opacity: 0,
      });
      const leaderGeo = new THREE.BufferGeometry();
      leaderGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const group = new THREE.Group();
      const chip = new THREE.Mesh(labelPlaneGeo, chipMat);
      const leader = new THREE.Line(leaderGeo, leaderMat);
      const dot = new THREE.Mesh(labelDotGeo, dotMat);
      group.add(chip, leader, dot);
      group.visible = false;
      labelGroup.add(group);
      return {
        group, chip, leader, leaderGeo, dot,
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
        last: null, // no-repeat guard: the target just released
        tl: null, // the cycle timeline (chip in → hold → fade)
        cut: null, // the running random-letter entrance (charCut clock)
        dc: null, // the re-slot breath (delayedCall)
        fading: false, // early fade in flight (one-shot latch)
      };
    };

    if (labelsEl && !PREFERS_REDUCED_MOTION) {
      readLabelStyle();
      document.fonts?.ready.then(readLabelStyle);
      /* Slot count is fixed at mount (the HeroLabels convention) — ?labels
         needs a reload, not an applyTuning. Desktop is capped at 4 (Nathan
         09-10); a phone takes at most three: a term like
         INDUSTRY_OPPORTUNITIES is around 200px, which is half a 390px
         viewport, so three chips there already fill the frame. */
      const labelSlotCount = Math.max(
        1,
        Math.round(IS_MOBILE ? Math.min(TUNING.labelCount, 3) : TUNING.labelCount) || 1
      );
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
    const pulseOff = (panel) => {
      if (!panel?.pulse) return;
      panel.pulse.kill();
      panel.pulse = null;
      const u = panel.mesh.material.uniforms.uPower;
      gsap.killTweensOf(u);
      gsap.to(u, { value: getPose(stage)?.power ?? 1, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    };
    const heldTerms = () => new Set(labelSlots.map((s) => s.term).filter(Boolean));
    const termFor = (cand) => termOf.get(cand.pos) ?? peekTerm();
    const drawChip = (slot) => {
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      const w = slot.textW;
      const h = Math.max(Math.ceil(labelStyle.line), 1);
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
      ctx.clearRect(0, 0, w, h);
      labelCtxFont(slot);
      ctx.fillStyle = labelStyle.css;
      let x = 1;
      for (let i = 0; i < slot.chars.length; i++) {
        const adv = ctx.measureText(slot.chars[i]).width + labelStyle.track;
        if (slot.shown[i]) ctx.fillText(slot.chars[i], x, h / 2);
        x += adv;
      }
      slot.texture.needsUpdate = true;
    };

    // Scratch — updateLabels/pick are synchronous, single-threaded.
    const lblNdc = new THREE.Vector3();
    const lblWorld = new THREE.Vector3();
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
       chip out from under the stage's own type — and text over text is the
       one read the layer must never produce. Measure the live stage copy
       (token + headline + blurb, not the 140vh section box around them) and
       hand it to chipInFrame as a keep-out. */
    const copyEl = rootEl?.querySelector('.process-stage[data-stage="stage-01"]') ?? null;
    const copyParts = copyEl
      ? [...copyEl.querySelectorAll('.process-stage__chip, .process-stage__headline, .process-stage__blurb')]
      : [];
    const copyKeep = { x0: 0, y0: 0, x1: 0, y1: 0 };
    const measureCopy = () => {
      if (!copyParts.length) return null;
      const base = container.getBoundingClientRect();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const el of copyParts) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        x0 = Math.min(x0, r.left - base.left);
        y0 = Math.min(y0, r.top - base.top);
        x1 = Math.max(x1, r.right - base.left);
        y1 = Math.max(y1, r.bottom - base.top);
      }
      if (x0 === Infinity) return null;
      copyKeep.x0 = x0; copyKeep.y0 = y0; copyKeep.x1 = x1; copyKeep.y1 = y1;
      return copyKeep;
    };
    const labelView = () => {
      const vw = container.clientWidth || 1;
      const vh = container.clientHeight || 1;
      const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
      return { vw, vh, tanV, tanH: tanV * (camera.aspect || 1), keep: measureCopy() };
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
       lblChip and returns the outward unit vector, or null off-screen. */
    const chipSeat = (worldPos, view, out) => {
      if (!toPx(worldPos, view, lblA)) return null;
      lblWorld.set(globeGroup.position.x, globeGroup.position.y, 0);
      const centre = toPx(lblWorld, view, lblB);
      let ox = centre ? lblA.x - centre.x : 1;
      let oy = centre ? lblA.y - centre.y : 0;
      const od = Math.hypot(ox, oy) || 1;
      ox /= od;
      oy /= od;
      // Phones get a shorter leader for the same reason they get fewer chips:
      // the frame cannot spare 64px of empty run either side of a chip that is
      // already half its width.
      const lead = Math.max(TUNING.labelLead, 0) * (IS_MOBILE ? 0.6 : 1);
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
        if (p.driftFactor > 0.5) pool.push({ pos: p.mesh.position, panel: p });
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
     *  inside the frame can still hang its label off the edge. */
    const chipInFrame = (view, x, y, w, h) =>
      x - w / 2 > 4 && x + w / 2 < view.vw - 4 && y - h / 2 > 4 && y + h / 2 < view.vh - 4 &&
      !(view.keep &&
        x + w / 2 > view.keep.x0 && x - w / 2 < view.keep.x1 &&
        y + h / 2 > view.keep.y0 && y - h / 2 < view.keep.y1);
    const chipClear = (cand, view, probeSlot) => {
      lblWorld.copy(cand.pos);
      globeGroup.localToWorld(lblWorld);
      if (!chipSeat(lblWorld, view, seatOut)) return false;
      const w = measureChars(probeSlot, [...termFor(cand)]);
      const h = Math.max(labelStyle.line, 8);
      if (!chipInFrame(view, lblChip.x, lblChip.y, w, h)) return false;
      for (const slot of labelSlots) {
        if (!slot.target || !slot.box) continue;
        if (boxesHit(lblChip.x, lblChip.y, w, h, slot.box)) return false;
      }
      return !seatBehindShard(view, lblChip.x, lblChip.y, w, h, lblA.depth - labelLift());
    };
    const pickTarget = (slot) => {
      refreshLabelMatrices();
      const view = labelView();
      const taken = labelSlots.map((s) => s.target).filter(Boolean);
      const held = heldTerms();
      const open = labelPool().filter(
        (c) => !taken.includes(c.pos) && !held.has(termOf.get(c.pos)) && labelVisible(c)
      );
      // Prefer somewhere the chip can actually be read; fall back to the
      // merely-visible set rather than idling a slot.
      const clear = open.filter((c) => chipClear(c, view, slot));
      const pool = clear.length ? clear : open;
      if (!pool.length) return null;
      // The tour's SUBJECT gets a chip first when it hasn't got one: the
      // camera framed it deliberately, so it is the shard the viewer is being
      // asked to look at (see the tour, below).
      const subject = tourSubjectPanel();
      if (subject && !taken.includes(subject.mesh.position)) {
        // A readable seat first; failing that, any seat — the drift rules
        // re-slot it if it really cannot be read, but the framed shard
        // going unnamed is the worse failure.
        const hit = pool.find((c) => c.panel === subject) ?? open.find((c) => c.panel === subject);
        if (hit) return hit;
      }
      // No-repeat: prefer any candidate that isn't the one this slot just
      // released; fall back to the full set only if that's all there is.
      const fresh = pool.filter((c) => c.pos !== slot.last);
      const choose = fresh.length ? fresh : pool;
      return choose[Math.floor(Math.random() * choose.length)];
    };

    const bindLabel = (slot, cand) => {
      slot.target = cand.pos;
      slot.panel = cand.panel;
      slot.fading = false;
      let term = termOf.get(cand.pos);
      if (!term) {
        const next = termAt(0);
        termCursor += next.step;
        term = next.term;
        termOf.set(cand.pos, term);
      }
      slot.term = term;
      slot.cut?.kill();
      slot.tl?.kill();
      slot.chars = [...term];
      slot.shown = slot.chars.map(() => false);
      slot.strikes = 0;
      slot.textW = measureChars(slot, slot.chars);
      // Seat the box NOW, not on the next painted frame: a sibling slot
      // picking in the same beat has to be able to see this one, and a chip
      // fading up from opacity 0 is skipped by updateLabels for a frame or two.
      slot.box = null;
      lblWorld.copy(slot.target);
      globeGroup.localToWorld(lblWorld);
      if (chipSeat(lblWorld, labelView(), seatOut)) {
        slot.box = {
          x: lblChip.x,
          y: lblChip.y,
          w: slot.textW,
          h: Math.max(labelStyle.line, 1),
          depth: lblA.depth,
        };
      }
      slot.mats[1].color.copy(labelStyle.color);
      slot.mats[2].color.copy(labelStyle.color);
      pulseOn(slot.panel);
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
      slot.tl = gsap
        .timeline()
        .to(slot.mats, { opacity: LABEL_HOLD_ALPHA, duration: 0.12, ease: 'power2.out' }, 0);
      if (!tourActive) {
        const hold = Math.max(TUNING.labelHold, 0.4);
        const out = slot.cut.duration + hold;
        slot.tl
          .to(slot.mats, { opacity: 0, duration: 0.3, ease: 'power2.in' }, out)
          .call(() => releaseLabel(slot));
      }
    };

    const releaseLabel = (slot) => {
      slot.cut?.kill();
      slot.cut = null;
      pulseOff(slot.panel);
      slot.last = slot.target;
      slot.term = '';
      slot.target = null;
      slot.panel = null;
      slot.box = null;
      slot.fading = false;
      slot.group.visible = false;
      if (!labelsActive || disposed) return;
      // Between stations the slots stay empty: the next arrival fills them.
      if (tourActive && !atStation) return;
      slot.dc?.kill();
      slot.dc = gsap.delayedCall(0.35 + Math.random() * 0.7, () => {
        slot.dc = null;
        if (!labelsActive || disposed || slot.target) return;
        if (tourActive && !atStation) return;
        const next = pickTarget(slot);
        if (next) bindLabel(slot, next);
        // no candidate — the slot idles; the next start/cycle fills it
      });
    };
    /** @param {boolean} quick a chip yielding a contested seat has to clear
     *  it FAST — the whole point is to stop two words sharing a spot, and a
     *  leisurely fade leaves them sharing it anyway. */
    const earlyFadeLabel = (slot, quick = false) => {
      if (slot.fading) return;
      slot.fading = true;
      slot.tl?.kill();
      slot.tl = null;
      // The shard left frame mid-entrance: land the remaining letters so the
      // chip fades as a whole word rather than a half-typed one.
      slot.cut?.finish();
      gsap.to(slot.mats, {
        opacity: 0,
        duration: quick ? 0.16 : 0.3,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: () => {
          if (!disposed) releaseLabel(slot);
        },
      });
    };
    /** Fill every empty slot, staggered — the arrival burst at a station and
     *  the first start share it. */
    const fillLabels = (delay, stagger) => {
      let at = delay;
      labelSlots.forEach((slot) => {
        if (slot.target) return;
        slot.dc?.kill();
        // Slightly uneven stagger (Nathan, 09-10): the chips arrive one
        // after another with a little human unevenness, not on a grid.
        at += stagger * (0.6 + Math.random() * 0.8);
        const attempt = () => {
          slot.dc = null;
          if (!labelsActive || disposed || slot.target) return;
          const next = pickTarget(slot);
          if (next) {
            bindLabel(slot, next);
          } else if (tourActive && atStation && performance.now() - stationAt < STATION_FILL_MS) {
            // No readable seat this instant — a close station frames few
            // shards and they keep drifting. Try again briefly, inside the
            // arrival window, so a straggler still belongs to the entrance.
            slot.dc = gsap.delayedCall(0.25 + Math.random() * 0.25, attempt);
          }
        };
        slot.dc = gsap.delayedCall(at, attempt);
      });
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
      slot.fading = true; // no yield may interrupt the exit
      slot.tl?.kill();
      slot.tl = null;
      slot.cut?.finish(); // any letter still landing lands, then leaves
      slot.dc?.kill();
      slot.dc = gsap.delayedCall(delay, () => {
        slot.dc = null;
        slot.cut = cutSchedule(slot.chars.length, {
          stepMs: CHAR_CUT.outStepMs,
          onCut: (i) => {
            slot.shown[i] = false;
            drawChip(slot);
          },
          onComplete: () => {
            gsap.to(slot.mats, {
              opacity: 0,
              duration: 0.12,
              ease: 'power2.in',
              overwrite: 'auto',
              onComplete: () => {
                if (!disposed) releaseLabel(slot);
              },
            });
          },
        });
      });
    };
    const clearLabels = () => {
      let k = 0;
      labelSlots.forEach((slot) => {
        if (!slot.target || slot.fading) {
          slot.dc?.kill();
          slot.dc = null;
          return;
        }
        cutOutLabel(slot, k * LEAVE_STAGGER + Math.random() * LEAVE_STAGGER);
        k += 1;
      });
    };
    const startLabels = (delay = 0) => {
      if (PREFERS_REDUCED_MOTION || !labelSlots.length || labelsActive) return;
      labelsActive = true;
      fillLabels(delay, 0.28);
    };
    const stopLabels = () => {
      if (!labelsActive) return;
      labelsActive = false;
      labelSlots.forEach((slot) => {
        pulseOff(slot.panel);
        slot.tl?.kill();
        slot.tl = null;
        slot.cut?.kill();
        slot.cut = null;
        slot.dc?.kill();
        slot.dc = null;
        slot.term = '';
        slot.target = null;
        slot.panel = null;
        slot.box = null;
        slot.fading = false;
        gsap.to(slot.mats, {
          opacity: 0,
          duration: 0.2,
          overwrite: 'auto',
          onComplete: () => {
            slot.group.visible = false;
          },
        });
      });
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
        lblWorld.copy(slot.target);
        globeGroup.localToWorld(lblWorld);
        const anchorZ = lblWorld.z;
        if (!chipSeat(lblWorld, view, seatOut)) {
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
        const wPx0 = slot.textW;
        const hPx0 = Math.max(labelStyle.line, 1);
        const gone =
          Math.abs(ndcX) > LABEL_NDC_KEEP ||
          Math.abs(ndcY) > LABEL_NDC_KEEP ||
          // A generous margin: the chip is a rigid plane, so reaching the
          // frustum edge CUTS it rather than fading it. Start the fade far
          // enough out that it finishes before the edge does that.
          !chipInFrame(view, lblChip.x, lblChip.y, wPx0 + 72, hPx0 + 40) ||
          (slot.panel && labelProminence(slot.panel) < LABEL_FRONT_EPS);
        // Held station: a chip that has cut in STAYS until the camera leaves
        // (Nathan, 09-10 — the drift-time yields read as flicker). The
        // frustum may clip a chip riding out at the edge; it does not fade.
        if (gone && !slot.fading && !heldStation()) earlyFadeLabel(slot);
        slot.group.visible = true;

        const wPx = slot.textW;
        const hPx = Math.max(labelStyle.line, 1);
        slot.box = { x: lblChip.x, y: lblChip.y, w: wPx, h: hPx, depth: lblA.depth };
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
        lblWorld.copy(slot.target); // chipSeat borrowed lblWorld for the group centre
        globeGroup.localToWorld(lblWorld);
        lblNormal.copy(camera.position).sub(lblWorld).normalize().multiplyScalar(LABEL_ROOT_EPS);
        const rootX = lblWorld.x + lblNormal.x;
        const rootY = lblWorld.y + lblNormal.y;
        const rootZ = lblWorld.z + lblNormal.z;
        const pos = slot.leaderGeo.attributes.position;
        pos.setXYZ(0, rootX, rootY, rootZ);
        pos.setXYZ(1, pxToWorldX(edgeX), pxToWorldY(edgeY), lift);
        pos.needsUpdate = true;
        slot.leaderGeo.computeBoundingSphere();

        slot.dot.position.set(rootX, rootY, rootZ);
        slot.dot.scale.setScalar((LABEL_DOT_PX / 2) * perPx);
      });

      /* Drift occlusion. The bind test seats a chip somewhere readable, but
         its shard keeps moving and the cloud keeps turning, so a chip can
         still end up behind a bank of shards showing three letters. Every
         chip is re-measured every frame against the cached circles and gives
         up once it is mostly covered — the slot re-slots somewhere it can be
         read. Partial cover stays: a word clipped at one end is the read that
         pairs it with its shard, and only a word cut to a stray syllable is
         noise. */
      if (heldStation()) {
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
            cutOutLabel(a.box.depth > b.box.depth ? a : b);
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
          if (probe.strikes >= CHIP_COVER_STRIKES) earlyFadeLabel(probe, true);
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
          earlyFadeLabel(a.box.depth > b.box.depth ? a : b, true);
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
        retargetCam();
      },
      { settleMs: 300, maxWaitMs: 2000 }
    );
    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      if (w === viewW && h === viewH) return; // re-stamping clears the buffer
      viewW = w;
      viewH = h;
      renderer.setSize(w, h, false);
      threadMaterial.resolution.set(w, h); // Line2 screen-width lines need it
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
    let tourSeatCursor = 0;
    let tourLegCount = 0;
    const tourFrom = { wide: true, panel: null, u: 0, v: 0, k: 1 };
    const tourTo = { wide: true, panel: null, u: 0, v: 0, k: 1 };
    const tourBlend = { t: 1 };
    // The chips' clock (09-10): true while the camera holds a station, false
    // on the road between two. releaseLabel refuses to rebind on the road.
    let atStation = true;
    let stationAt = 0; // performance.now() of the last arrival — the fill window
    const STATION_FILL_MS = 1200; // late fills only this long after arrival, so the set reads as one entrance
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
      const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
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
    const nextStation = (st) => {
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
      const tanH = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2) * (camera.aspect || 1);
      const scored = [];
      for (const p of panels) {
        if (p.driftFactor <= 0.5 || p === tourTo.panel) continue;
        // A subject has to STAY a subject: it is framed for travel + hold
        // (~6s), so no fast spinner (the tier turns away mid-shot), and it
        // must face the camera squarely now so a slow tumble cannot take it
        // past the chip's front-facing floor before the hold ends.
        if (p.drift.speedRatio > 1.2) continue;
        if (labelProminence(p) < TOUR_SUBJECT_FACING) continue;
        probe.panel = p;
        stationCam(probe, tourCamB);
        const halfW = Math.max((tourCamB.z - tourSubject.z) * tanH, 0.05);
        const shift = Math.hypot(tourCamB.x - camera.position.x, tourCamB.y - camera.position.y) / halfW;
        scored.push({ p, shift });
      }
      if (!scored.length) {
        // Nothing squarely facing and slow this beat — rather than fall back
        // to the wide, take any free shard: the camera keeps moving in close.
        for (const p of panels) {
          if (p.driftFactor <= 0.5 || p === tourTo.panel) continue;
          probe.panel = p;
          stationCam(probe, tourCamB);
          const halfW = Math.max((tourCamB.z - tourSubject.z) * tanH, 0.05);
          scored.push({ p, shift: Math.hypot(tourCamB.x - camera.position.x, tourCamB.y - camera.position.y) / halfW });
        }
        if (!scored.length) {
          st.wide = true; // an empty belt (tuning edge) — nothing to frame
          st.panel = null;
          return st;
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
      return st;
    };

    const stopTour = () => {
      if (tourTl) {
        tourTl.kill();
        tourTl = null;
      }
      gsap.killTweensOf(tourBlend);
      tourActive = false;
      atStation = true;
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
      nextStation(tourTo);
      tourBlend.t = 0;
      // Leaving the shot: every chip lets go, and none rebinds on the road.
      atStation = false;
      clearLabels();
      const travel = Math.max(TUNING.tourTravel, 0.1);
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
            if (labelsActive) fillLabels(0, 0.14);
          },
        })
        // The hold — t stays at 1 while the camera keeps TRACKING the
        // subject, which is what makes a rest read as a held shot rather
        // than a frozen one.
        .to(tourBlend, { t: 1, duration: Math.max(TUNING.tourHold, 0) });
    };

    const startTour = () => {
      if (PREFERS_REDUCED_MOTION || disposed || tourActive) return;
      if (TUNING.tour === 'off' || TUNING.tour === '0') return;
      // Callers only reach here with the camera resting on the belt's
      // establishing frame (an applyPose, a transition that just landed, the
      // arrival materialize). camLag may be carrying another stage's framing
      // if a resize landed there — the tour's base is the belt's contain fit,
      // so restate it.
      camLag.z = framingFor(getPose('stage-01')).z;
      tourActive = true;
      tourLegCount = 0;
      tourTo.wide = true;
      tourTo.panel = null;
      tourBlend.t = 1;
      // The wide is a station too: hold it (the arrival's chips get their
      // beat) before the first leg pushes in.
      atStation = true;
      stationAt = performance.now();
      tourTl?.kill();
      tourTl = gsap
        .timeline({ onComplete: tourLeg })
        .to(tourBlend, { t: 1, duration: Math.max(TUNING.tourHold, 0) });
    };

    const stopLoops = () => {
      if (!loopTl) return;
      loopTl.kill();
      loopTl = null;
      // Restore the belt/S2 ink: black stroke, color tweens dead. The
      // caller's transition owns easing uStrokeMix to its pose value.
      panels.forEach((p) => {
        gsap.killTweensOf(p.mesh.material.uniforms.uStrokeColor.value);
        p.mesh.material.uniforms.uStrokeColor.value.copy(strokeColor);
      });
    };

    /* — S5 rhythm engine (the musical rework). Envelope per hit: snap to
       full blue (attack) → HOLD on blue (?hold beats) → STEEP falloff
       (expo — fast first, long tail) down to ?pulsemin. Patterns spread
       one hit per panel per PASS_BEATS-beat pass (checker alternates per
       beat instead); `cycle` rotates the whole vocabulary, one pattern
       per pass. Between hits a panel rests dark — the waves are light. — */
    const ripplePanel =
      panels.find((p) => p.row === Math.floor(TOTAL_ROWS / 2) && p.lonIndex === 0) ?? panels[0];

    const patternHits = (name, pi, beat, pass) => {
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
            panels.map((p) => p.centerDir.angleTo(ripplePanel.centerDir) + rand() * 0.12)
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

    const buildRhythmLoop = () => {
      const beat = 60 / TUNING.bpm;
      const pass = PASS_BEATS * beat;
      const names =
        TUNING.pattern === 'cycle'
          ? ['rows', 'equator', 'ripple', 'checker', 'random']
          : [TUNING.pattern];
      const attack = Math.min(0.07, beat * 0.15);
      // ?decaycurve (v2 deck, B8): the baked expo falloff vs. the house
      // pulse's essentially-linear read — Nathan A/Bs without a code edit.
      const decayEase = TUNING.decayCurve === 'linear' ? 'none' : 'expo.out';
      const strokeOn = TUNING.s5Stroke > 0.01 && TUNING.strokePx > 0.01;
      const tl = gsap.timeline({ repeat: -1 });
      const totalLen = names.length * pass;
      names.forEach((name, pi) => {
        const hits = patternHits(name, pi, beat, pass);
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
            const start = pi * pass + t;
            // Loop-seam clamp: tails may spill BETWEEN patterns (that's
            // the overlap), but never past totalLen — the tl.set pin must
            // stay the timeline's true end or the repeat drifts off the
            // beat grid. Only the final pattern's last hits compress.
            const decayFit = Math.max(
              Math.min(decay, totalLen - start - hold - attack),
              0.05
            );
            const keyframes = [
              { value: 1.0, duration: attack, ease: 'power2.out' },
              { value: 1.0, duration: hold, ease: 'none' },
              { value: TUNING.pulseMin, duration: decayFit, ease: decayEase },
            ];
            // B8: the brown-blue inner stroke surfaces as the light dies —
            // uStrokeMix rides the envelope INVERSELY (lit = no ink, dark =
            // inked lattice), same grid, same falloff shape.
            const strokeKeyframes = [
              { value: 0, duration: attack, ease: 'power2.out' },
              { value: 0, duration: hold, ease: 'none' },
              { value: TUNING.s5Stroke, duration: decayFit, ease: decayEase },
            ];
            tl.to(p.mesh.material.uniforms.uPower, { keyframes }, start);
            if (strokeOn) {
              tl.to(p.mesh.material.uniforms.uStrokeMix, { keyframes: strokeKeyframes }, start);
            }
          });
        });
      });
      // B8: per-panel offset color drift — each shard's stroke wanders
      // between the two brown-blues on its own phase (subtle, alive).
      if (strokeOn) {
        panels.forEach((p, i) => {
          const phase = (i / panels.length) * pass * 0.5;
          tl.fromTo(
            p.mesh.material.uniforms.uStrokeColor.value,
            { r: s5StrokeA.r, g: s5StrokeA.g, b: s5StrokeA.b },
            {
              r: s5StrokeB.r,
              g: s5StrokeB.g,
              b: s5StrokeB.b,
              duration: Math.max((totalLen - phase) / 2, pass / 2),
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

    const startLoops = () => {
      if (PREFERS_REDUCED_MOTION) return; // stills: no idle motion anywhere
      stopLoops();
      // The rhythm's ink is the S5 brown-blue; the belt's black returns
      // with stopLoops (any transition away).
      panels.forEach((p) => p.mesh.material.uniforms.uStrokeColor.value.copy(s5StrokeA));
      loopTl = buildRhythmLoop();
    };

    /* — Instant pose application (arrival sync + every RM boundary) — */
    const applyPose = (pose) => {
      stopTour(); // an instant pose owns the camera outright
      const { z, offsetX, offsetY } = framingFor(pose);
      // x/y as well as z: the S1 tour trucks the camera off-axis, and an
      // instant pose must land on the establishing frame, not on wherever
      // the path happened to be.
      camera.position.set(0, 0, z);
      globeGroup.position.x = offsetX;
      globeGroup.position.y = offsetY;
      const belt = pose.form === 'belt';
      if (!belt) beltHidden = false; // past the belt narrative — never re-hide
      panels.forEach((p) => {
        const u = p.mesh.material.uniforms;
        u.uPower.value = pose.power;
        u.uStrokeMix.value = pose.stroke;
        u.uStrokeWidthPx.value = TUNING.strokePx;
        p.mesh.scale.setScalar(belt && beltHidden ? 0 : pose.panelScale);
        if (belt) {
          p.mesh.position.copy(p.beltPos);
          p.mesh.quaternion.copy(p.beltQuat);
          p.driftFactor = 1;
        } else {
          p.mesh.position.copy(p.homeOffset).multiplyScalar(pose.panelScale);
          p.mesh.quaternion.copy(IDENTITY_QUAT);
          p.driftFactor = 0;
        }
      });
      innerSphere.visible = pose.innerScale > 0.001;
      innerSphere.scale.setScalar(Math.max(pose.innerScale, 0.001));
      gsap.killTweensOf(tiltState);
      tiltState.z = pose.tilt ?? 0;
      // Decoy pool snaps with the pose: full flood in stage-01, gone
      // everywhere else (RM stills included — stage-02's still is the
      // already-refined belt).
      decoyMaterial.uniforms.uPower.value = pose.power;
      decoyMaterial.uniforms.uStrokeMix.value = pose.stroke;
      decoyMaterial.uniforms.uStrokeWidthPx.value = TUNING.strokePx;
      decoys.forEach((d) => {
        gsap.killTweensOf(d);
        gsap.killTweensOf(d.pos); // a killed mid-fall leaves pos displaced —
        if (d.beltPos) d.pos.copy(d.beltPos); // snap back to the belt slot
        d.s = pose.decoys && !(belt && beltHidden) ? 1 : 0;
      });
      decoyMesh.visible = Boolean(pose.decoys) && !(belt && beltHidden);
      composeDecoys();
      bgInstant(pose.bg);
      gsap.killTweensOf(fogState);
      fogState.amount = poseFog(pose);
      beltDrifting = belt && !PREFERS_REDUCED_MOTION;
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

    /* — S1→S2 authored show: the Thread connects, then the assembly.
       The string is the MECHANISM now, not an annotation: beads seat in
       hop order (a string pulled taut), the unchained swept up behind
       them ordered by how close they float to the center. — */
    const buildConnectAndAssemble = (pose) => {
      stopLabels(); // the gathering annotation ends where the refinement begins
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        onComplete: () => {
          activeTl = null;
        },
      });
      threadChain = buildChain();
      threadDraw = { frac: 0, alpha: 1 };
      threadActive = true;

      tl.call(() => fireCaption('references_folded'), null, 0);

      // B5 (v2 deck): push INTO the floating cloud while the flood sheds
      // its decoys. 07-30 rework: the shed is PROLONGED — exits spread
      // across ~3.5s of the Thread's connect phase (half flicker, half
      // fall out of frame) so the cull itself reads as the refinement,
      // leaving the 84 keepers for the string to claim.
      const HEAD = 0.55;
      // From wherever the tour left the lens, glide to a TIGHT station on the
      // first bead (?threadtight, the tour's dolly units) — one gesture, never
      // a cut — then creep back toward the wide across the trace
      // (?threaddrift of the way). The tick solves the station live while
      // threadCamActive; the assembly below takes the camera over at at0.
      const tight = THREE.MathUtils.clamp(TUNING.threadTight, 0.05, 1);
      const drift = THREE.MathUtils.clamp(TUNING.threadDrift, 0, 1);
      threadSt.panel = threadChain[0] ?? null;
      threadSt.k = tight;
      threadSt.coreZ = framingFor(pose).z;
      threadCam.t = 0;
      threadCamFrom.copy(camera.position);
      threadCamActive = Boolean(threadSt.panel);
      tl.to(threadCam, { t: 1, duration: 0.75 }, 0);
      // The haze belongs to the gathering: it burns off across the connect and
      // assembly, so the Core arrives with no atmosphere at all (Nathan:
      // "fade to no atmospheric effect on the second slide").
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
      const hopSeconds = TUNING.threadHopSeconds;
      threadChain.forEach((panel, i) => {
        const at = HEAD + i * hopSeconds;
        tl.to(threadDraw, { frac: (i + 1) / threadChain.length, duration: hopSeconds, ease: turnEase }, at);
        tl.call(
          () => {
            gsap.to(panel, { driftFactor: 0.12, duration: 0.6, ease: 'power2.out' });
            gsap.timeline()
              .to(panel.mesh.material.uniforms.uPower, { value: TUNING.idlePower * 0.55, duration: 0.1, ease: 'power2.in' })
              .to(panel.mesh.material.uniforms.uPower, { value: TUNING.idlePower * 0.85, duration: 0.45, ease: 'sine.out' });
          },
          null,
          at + hopSeconds
        );
      });

      const connectEnd = HEAD + threadChain.length * hopSeconds;
      tl.to(
        threadSt,
        { k: tight + (1 - tight) * drift, duration: Math.max(connectEnd - HEAD, 0.1), ease: 'sine.inOut' },
        HEAD
      );
      tl.call(() => fireCaption('dots_connected'), null, connectEnd);

      // Assemble: the pull. Chained Fragments seat in HOP ORDER across
      // the leading window (the taut-string read); the rest follow,
      // nearest-to-center first, while the blue foundation surfaces
      // behind the shell and the string rides its beads inward.
      const assembleSeconds = TUNING.assembleSeconds;
      const at0 = connectEnd + 0.15;
      tl.call(() => {
        beltDrifting = false;
        panels.forEach((p) => {
          gsap.killTweensOf(p);
          p.driftFactor = 0; // assembled — the belt never reclaims these
        });
      }, null, at0);

      const perDur = Math.min(assembleSeconds * 0.45, 1.1);
      const staggerWindow = assembleSeconds - perDur;
      const chainShare = Math.min(0.75, threadChain.length / panels.length + 0.4);
      const chainedWindow = staggerWindow * chainShare;
      const chainSet = new Set(threadChain);
      const rest = panels
        .filter((p) => !chainSet.has(p))
        .sort((a, b) => a.mesh.position.lengthSq() - b.mesh.position.lengthSq());
      const delayFor = new Map();
      threadChain.forEach((p, i) => {
        delayFor.set(p, threadChain.length > 1 ? (i / (threadChain.length - 1)) * chainedWindow : 0);
      });
      rest.forEach((p, i) => {
        const t = rest.length > 1 ? i / (rest.length - 1) : 0;
        delayFor.set(p, chainedWindow * 0.55 + t * (staggerWindow - chainedWindow * 0.55));
      });
      panels.forEach((p) => {
        const at = at0 + delayFor.get(p);
        tl.to(p.mesh.position, { x: p.homeOffset.x, y: p.homeOffset.y, z: p.homeOffset.z, duration: perDur }, at);
        tweenQuat(tl, p.mesh, IDENTITY_QUAT, perDur, at);
      });

      tl.call(() => {
        innerSphere.visible = true;
      }, null, at0);
      tl.to(innerSphere.scale, { x: INNER_SPHERE_SCALE, y: INNER_SPHERE_SCALE, z: INNER_SPHERE_SCALE, duration: assembleSeconds * 0.8 }, at0 + assembleSeconds * 0.15);
      // No fade — the string is a real line in the scene now (B3): the
      // closing shell and the surfacing inner sphere OCCLUDE it away, the
      // beads swallowing their own string.

      // The Core holds large — dropping low on phones (?dropy). The pull
      // back to the wide rides the assembly itself: the live thread station
      // hands the camera over a hair before the tween records its start.
      const { z, offsetX, offsetY } = framingFor(pose);
      tl.call(() => {
        threadCamActive = false;
      }, null, Math.max(at0 - 0.01, 0));
      tl.to(camera.position, { x: 0, y: 0, z, duration: assembleSeconds }, at0);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: assembleSeconds }, at0);

      tl.call(() => {
        clearThread();
        fireCaption('core_assembled');
      }, null, at0 + assembleSeconds);
      return tl;
    };

    /* — Generic transitions: discrete, time-domain, house curve; exits
       ≈0.7×. Form-aware — also the compressed catch-up for interrupts. — */
    const buildTransition = (from, to, compressed) => {
      const pose = getPose(to);
      const fromPose = getPose(from ?? 'stage-01');
      const reversing = STAGE_IDS.indexOf(to) < STAGE_IDS.indexOf(from);

      if (to === 'stage-02' && from === 'stage-01' && !compressed) {
        return buildConnectAndAssemble(pose);
      }

      const durMult = (compressed ? 0.65 : 1) * (reversing ? EXIT_RATIO : 1);
      stopLabels();
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        onComplete: () => {
          activeTl = null;
          if (pose.loops) startLoops();
          if (pose.form === 'belt') {
            beltDrifting = !PREFERS_REDUCED_MOTION;
            startTour(); // back on the belt — the camera resumes its walk
          }
          if (pose.decoys) startLabels(0.15);
        },
      });

      // A running Thread show never survives an interrupt — fade it fast.
      if (threadActive) {
        threadCamActive = false; // this timeline owns camera.position from 0
        tl.to(threadDraw, { alpha: 0, duration: 0.25, ease: 'power2.in' }, 0);
        tl.call(clearThread, null, 0.26);
      }

      const { z, offsetX, offsetY } = framingFor(pose);
      const isLightUp = to === 'stage-03' && !reversing && !compressed;
      const frameDur = (isLightUp ? TUNING.zoomOutSeconds : TUNING.stageSeconds) * durMult;
      // x/y ride the same window: a transition that interrupts the S1 tour
      // (or reverses back onto the belt) must land on the establishing frame,
      // which is also where startTour picks the path back up.
      tl.to(camera.position, { x: 0, y: 0, z, duration: frameDur }, 0);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: frameDur }, 0);

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

      // Background beat. The blue↔black boundary rides the S2↔S3 dolly as the
      // black solidify field emanating from / receding into the Core: forward
      // (light-up) the black GROWS out of the solidifying Core to flood the
      // canvas; reverse it SHRINKS back into the Core and the blue opening
      // returns. Every other pairing crossfades.
      tl.call(() => setBgAttr(pose.bg), null, 0);
      if (pose.bg !== fromPose.bg) {
        const grow = isLightUp && fromPose.bg === 'blue' && pose.bg === 'black';
        const shrink =
          !compressed && reversing && fromPose.bg === 'black' && pose.bg === 'blue';
        if (grow || shrink) bgMorph(tl, 0, frameDur, grow);
        else bgCrossfade(tl, 0, Math.max(frameDur * 0.6, 0.3), pose.bg);
      }

      const toBelt = pose.form === 'belt';
      // The pose table alone lies mid-show: interrupting the S1→S2 Thread
      // sequence arrives here with from='stage-02' (form core) while the
      // belt is still live — the tick would keep stamping belt transforms
      // over this morph's position tweens. Judge by actual state too.
      const fromBelt =
        fromPose?.form === 'belt' || beltDrifting || threadActive;

      if (fromBelt || toBelt) {
        // The tick hands the belt to gsap until onComplete re-arms it.
        beltDrifting = false;
        panels.forEach((p) => {
          gsap.killTweensOf(p);
          gsap.killTweensOf(p.mesh.scale); // in-flight materialize
          if (!toBelt) p.driftFactor = 0;
        });
      }

      // The decoy flood follows the pose: flickers back with a belt
      // return, sheds fast on any path that leaves stage-01 (interrupts
      // included — buildConnectAndAssemble owns the authored cull).
      if (pose.decoys && !decoyMesh.visible && !beltHidden) {
        decoysIn(tl, frameDur * 0.25, TUNING.stageSeconds * durMult);
      } else if (pose.decoys && decoyMesh.visible && !beltHidden) {
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
        decoysOut(tl, 0, Math.min(0.4, frameDur));
      }

      if (isLightUp && !fromBelt) {
        // S2→S3: the field contracts into the Core while the camera
        // dollies back, then the page's single loudest beat — the cascade
        // flicker with the black ink burning off on the same delay model.
        const at = frameDur * 0.7;
        tl.add(buildCascadeTimeline(panels, TUNING.cascadeVariant, TOTAL_ROWS), at);
        panels.forEach((p) => {
          tl.to(
            p.mesh.material.uniforms.uStrokeMix,
            { value: 0, duration: 0.3, ease: 'power2.out' },
            at + panelDelay(p, TUNING.cascadeVariant, TOTAL_ROWS)
          );
        });
      } else {
        // Pose morph. Emanation (panel-scale change) staggers on its own
        // order; form changes tween shard transforms scatter ↔ home.
        // v2 deck (B7): the emanation answers a beat AFTER the scroll
        // commit (EMANATE_LAG — weight/tension), with a wider stagger
        // spread and a seeded per-panel jitter for a livelier offset.
        const EMANATE_LAG = 0.16;
        const emanating = !toBelt && Math.abs(pose.panelScale - panels[0].mesh.scale.x) > 1e-3;
        const dur = TUNING.stageSeconds * 0.6 * durMult;
        panels.forEach((p) => {
          const u = p.mesh.material.uniforms;
          const at = emanating
            ? (EMANATE_LAG + panelDelay(p, TUNING.emanateOrder, TOTAL_ROWS) * 0.85 + (p.drift.phase / (Math.PI * 2)) * 0.12) * durMult
            : 0;
          const target = toBelt
            ? p.beltPos
            : { x: p.homeOffset.x * pose.panelScale, y: p.homeOffset.y * pose.panelScale, z: p.homeOffset.z * pose.panelScale };
          tl.to(p.mesh.position, { x: target.x, y: target.y, z: target.z, duration: dur }, at);
          tweenQuat(tl, p.mesh, toBelt ? p.beltQuat : IDENTITY_QUAT, dur, at);
          tl.to(p.mesh.scale, { x: pose.panelScale, y: pose.panelScale, z: pose.panelScale, duration: dur }, at);
          tl.to(u.uPower, { value: pose.power, duration: dur }, at);
          tl.to(u.uStrokeMix, { value: pose.stroke, duration: dur }, at);
          if (toBelt) tl.set(p, { driftFactor: 1 }, at + dur);
        });
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
      return tl;
    };

    const setStageInstant = (next) => {
      if (!getPose(next) || next === stage || disposed) return;
      if (DEBUG) console.info(`[ProcessScene] setStageInstant ${stage ?? '∅'} → ${next}`);
      if (activeTl) activeTl.kill();
      activeTl = null;
      gsap.killTweensOf(camLag); // a surviving resize-lag tween would drag the camera back
      stopLoops();
      panels.forEach((p) => gsap.killTweensOf(p));
      applyPose(getPose(next));
      // RM narrative still for stage-02: the connected belt, Thread drawn,
      // caption snapped to its final text (scramble degrades, spec §7).
      if (next === 'stage-02' && PREFERS_REDUCED_MOTION) {
        threadChain = buildChain();
        threadDraw = { frac: 1, alpha: 1 };
        threadActive = true;
        threadChain.forEach((p) => {
          p.driftFactor = 0.12;
          p.mesh.material.uniforms.uPower.value = TUNING.idlePower * 0.85;
        });
        if (captionRef?.current) captionRef.current.textContent = 'dots_connected';
      } else {
        clearThread();
      }
      stage = next;
      if (getPose(next).loops) startLoops();
      // Instant non-RM arrivals (scroll restoration) get the annotation
      // layer too; RM never runs it (startLabels self-gates).
      stopLabels();
      if (getPose(next).decoys && !beltHidden) startLabels(0.3);
      if (getPose(next).form === 'belt' && !beltHidden) startTour();
      updateThread();
      renderFrame();
    };

    const goTo = (next) => {
      if (!getPose(next) || next === stage || disposed) return;
      if (PREFERS_REDUCED_MOTION) {
        setStageInstant(next);
        return;
      }
      if (DEBUG) console.info(`[ProcessScene] goTo ${stage ?? '∅'} → ${next}`);
      if (beltHidden) {
        // Scrolled ahead of the arrival's materialize beat — surface the
        // shards instantly; the Thread must never chain invisible targets.
        beltHidden = false;
        const heldPose = getPose(stage ?? 'stage-01');
        panels.forEach((p) => p.mesh.scale.setScalar(heldPose.panelScale));
        if (heldPose.decoys) {
          decoyMesh.visible = true;
          decoys.forEach((d) => {
            gsap.killTweensOf(d);
            gsap.killTweensOf(d.pos);
            if (d.beltPos) d.pos.copy(d.beltPos);
            d.s = 1;
          });
          composeDecoys();
        }
      }
      const interrupted = Boolean(activeTl);
      if (activeTl) activeTl.kill();
      stopTour(); // the transition owns the camera from here
      gsap.killTweensOf(camLag); // the transition owns the camera now — drop any resize-lag chase
      stopLoops();
      activeTl = buildTransition(stage ?? 'stage-01', next, interrupted);
      stage = next;
    };

    /* — Arrival beat (spec §5, reworked v2 deck B4): the flood flickers
       in — quick, snappy, slightly randomized offsets (blink to a
       fraction, dip, land) — the continuous-gathering read. Panels and
       decoys share the treatment; labels start once the cloud holds. — */
    const FLICKER_IN = (delay) => ({
      keyframes: [
        { x: 0.6, y: 0.6, z: 0.6, duration: 0.07 },
        { x: 0.18, y: 0.18, z: 0.18, duration: 0.06 },
        { x: 1, y: 1, z: 1, duration: 0.3, ease: 'power3.out' },
      ],
      delay,
      ease: 'none',
    });
    const materializeBelt = () => {
      if (!beltHidden || disposed) return;
      beltHidden = false;
      panels.forEach((p) => {
        const delay = (p.drift.phase / (Math.PI * 2)) * 1.1; // seeded, snappy spread
        gsap.to(p.mesh.scale, FLICKER_IN(delay));
      });
      if (getPose(stage ?? 'stage-01').decoys) {
        decoyMesh.visible = true;
        decoys.forEach((d) => {
          gsap.killTweensOf(d);
          const delay = (d.phase / (Math.PI * 2)) * 1.1;
          gsap.to(d, {
            keyframes: [
              { s: 0.5, duration: 0.07 },
              { s: 0.14, duration: 0.06 },
              { s: 1, duration: 0.3, ease: 'power3.out' },
            ],
            delay,
            ease: 'none',
          });
        });
      }
      startLabels(0.7);
      startTour();
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
      if (labelSlots.length) restyleLabels(); // ?labelsize
      const pose = getPose(stage ?? 'stage-01');
      if (!activeTl) {
        const { z, offsetX, offsetY } = framingFor(pose);
        camera.position.z = z;
        globeGroup.position.x = offsetX;
        globeGroup.position.y = offsetY;
        tiltState.z = pose.tilt ?? 0; // ?s5tilt applies live at rest
        if (pose.form === 'belt' && !threadActive) {
          panels.forEach((p) => {
            if (p.driftFactor > 0.5) {
              p.mesh.material.uniforms.uPower.value = TUNING.idlePower;
              // The tick no longer stamps positions (suspended cloud) —
              // a re-seed re-spreads the resting belt here instead.
              p.mesh.position.copy(p.beltPos);
            }
          });
          decoyMaterial.uniforms.uPower.value = TUNING.idlePower;
          decoyMaterial.uniforms.uStrokeWidthPx.value = TUNING.strokePx;
        }
      }
      if (loopTl) startLoops(); // rebuild on the new bpm/pattern/envelope grid
      // ?fog / ?fogspan are instant (the uniforms are stamped every render);
      // only the STRENGTH needs restating, and never over a running fade.
      if (!activeTl) fogState.amount = poseFog(pose);
      // ?tourreach / ?tournear / ?tourfar / the leg timings rebuild the path
      // in place (the walk restarts from the wide).
      if (tourActive) {
        stopTour();
        startTour();
      } else if (!activeTl && pose.form === 'belt' && !beltHidden) {
        startTour(); // ?tour flipped back on from the panel
      }
      if (PREFERS_REDUCED_MOTION) {
        applyPose(pose);
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
      const prev = STAGE_IDS[Math.max(idx - 1, 0)];
      if (activeTl) activeTl.kill();
      activeTl = null;
      stopLoops();
      clearThread();
      stage = null; // force both calls through the dedupe
      setStageInstant(prev);
      if (prev !== current) goTo(current);
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
       are. — */
    const drag = PREFERS_REDUCED_MOTION
      ? null
      : new DragMomentum(container, {
          ambient: { x: AUTO_ROTATE_SPEED, y: 0 },
          sensitivity: DRAG_SENSITIVITY,
          maxSpeed: MAX_FLICK_SPEED,
          reducedMotion: PREFERS_REDUCED_MOTION,
          touch: false,
        });

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
      if (accumulated < 1 / FPS_CAP) return;
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
      if (labelsActive) updateLabels();
      if (threadActive) updateThread();
      renderFrame();
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
      if (tourTl) tourTl.paused(!shouldRun);
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

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // Rest pose up before the driver's arrival sync (same layout phase):
    // no globe yet — the drifting Fragment belt on the blue field.
    applyPose(getPose('stage-01'));
    renderFrame();

    const getStats = () => {
      const now = performance.now();
      const fps = Math.round((statFrames / Math.max(now - statStamp, 1)) * 1000);
      statFrames = 0;
      statStamp = now;
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
        }));
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
          };
        }
      }
      // Slot states for the probe: b bound · f fading · d waiting on a delayedCall · - idle
      const slots = labelSlots.map((s) => (s.target ? (s.fading ? 'f' : 'b') : s.dc ? 'd' : '-')).join('');
      const cam = [camera.position.x, camera.position.y, camera.position.z].map((v) => +v.toFixed(3));
      return { fps, calls: renderer.info.render.calls, stage, chips, slots, atStation, cam, tour: subject ?? (tourActive ? 'wide' : 'off') };
    };

    apiRef.current = {
      goTo,
      setStageInstant,
      getStage: () => stage,
      materializeBelt,
      getStats,
      applyTuning,
      replay,
    };

    /* — Teardown (ADR-0002): full release, context loss included — */
    return () => {
      disposed = true;
      apiRef.current = NOOP_API;
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      settleReframe.cancel();
      gsap.killTweensOf(camLag);
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickerActive) gsap.ticker.remove(tick);
      if (activeTl) activeTl.kill();
      stopLoops();
      stopTour();
      gsap.killTweensOf(fogState);
      drag?.dispose();
      if (blueEl) gsap.killTweensOf(blueEl);
      if (gradientEl) gsap.killTweensOf(gradientEl);
      panels.forEach((panel) => {
        gsap.killTweensOf(panel);
        gsap.killTweensOf(panel.mesh.scale);
        gsap.killTweensOf(panel.mesh.material.uniforms.uPower);
        gsap.killTweensOf(panel.mesh.material.uniforms.uStrokeMix);
        panel.geometry.dispose();
        panel.mesh.material.dispose();
      });
      stopLabels();
      labelSlots.forEach((slot) => {
        slot.tl?.kill();
        slot.cut?.kill();
        slot.dc?.kill();
        gsap.killTweensOf(slot.mats);
        slot.mats.forEach((m) => m.dispose());
        slot.leaderGeo.dispose();
        slot.texture.dispose();
        slot.group.removeFromParent();
      });
      labelPlaneGeo.dispose();
      labelDotGeo.dispose();
      decoys.forEach((d) => gsap.killTweensOf(d));
      decoyGeometry.dispose();
      decoyMaterial.dispose();
      innerSphereGeometry.dispose();
      innerMaterial.dispose();
      threadGeometry.dispose();
      threadMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return apiRef;
}
