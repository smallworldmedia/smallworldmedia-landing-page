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
} from './processConfig.js';

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
          // Suspended point cloud: slow LINEAR self-rotation only (the
          // whole-cloud rotation is globeGroup's yaw) — no positional
          // wobble; positions rest at beltPos.
          axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
          speedRatio: 0.6 + rand() * 0.8, // × TUNING.drift at tick time
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
        d.axis.set(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
        d.speedRatio = 0.5 + rand() * 0.9;
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
    let threadChain = [];     // claimed panels, hop order
    let threadDraw = { frac: 0, alpha: 1 };

    const renderFrame = () => renderer.render(scene, camera);

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

    /* — Blob-tracking labels (v2 deck, B4; refined P1 from the hero's
       HeroLabels port). A handful of mono chips latch onto drifting
       shards, scramble a term from the rolling DISCOVERY vocabulary, hold,
       release, and re-slot — the continuous gathering of notes and
       references, annotated live. S1 only; reduced motion never runs them.

       Ported from the home-hero refinement (HeroLabels.jsx):
       · a 1px LEADER line + a 3px ANCHOR DOT connect each chip to its
         shard (one SVG layer; the chip sits radially OUTWARD from the belt
         center by LEADER_LEN and the leader hits its nearest corner);
       · VIEWPORT + FRONT-FACING candidate selection — a chip only latches
         onto a shard that projects comfortably on-screen AND (for the 84
         keepers, which carry a face normal) is turned toward the camera;
       · NO-REPEAT round-robin — a slot prefers not to re-take the shard it
         just released;
       · per-frame EARLY FADE — a labeled shard that drifts out of frame or
         turns away fades early and frees its slot.
       Adapted to the process tick cadence (no heroOverlay/onFrame bridge):
       updateLabels runs in the render tick and refreshes the matrices it
       reads itself (discPx's idiom). — */
    const LABEL_TERMS = [
      'image_references', 'brand_cadence', 'artist_personality', 'artist_interests',
      'call_notes', 'inquiry_notes', 'preliminary_research', 'market_research',
      'music_catalog', 'market_gaps', 'pop_culture', 'industry_analysis',
      'genre_gaps', 'industry_opportunities', 'design_history', 'art_history',
      'industry_trends',
    ];
    const LABEL_SVG_NS = 'http://www.w3.org/2000/svg';
    const LEADER_LEN = 20; // px the chip sits outward from the belt center
    const LABEL_DOT_R = 1.5; // the 3px anchor dot
    const LABEL_FRONT_EPS = 0.05; // normal·view-axis floor (front-facing)
    const LABEL_NDC_BIND = 0.9; // pick only shards comfortably on-screen
    const LABEL_NDC_KEEP = 1.02; // hold until the anchor leaves the frame
    const labelsEl = chromeRefs?.labelsRef?.current ?? null;
    let labelsActive = false;
    let termCursor = 0;
    const labelSlots = [];
    let labelsSvg = null;
    if (labelsEl && !PREFERS_REDUCED_MOTION) {
      labelsSvg = document.createElementNS(LABEL_SVG_NS, 'svg');
      labelsSvg.setAttribute('class', 'process-labels__svg');
      labelsSvg.setAttribute('focusable', 'false');
      labelsEl.appendChild(labelsSvg);
      for (let i = 0; i < 4; i++) {
        const el = document.createElement('span');
        el.className = 'process-label';
        labelsEl.appendChild(el);
        const g = document.createElementNS(LABEL_SVG_NS, 'g');
        const line = document.createElementNS(LABEL_SVG_NS, 'line');
        line.setAttribute('class', 'process-labels__leader');
        const dot = document.createElementNS(LABEL_SVG_NS, 'circle');
        dot.setAttribute('class', 'process-labels__dot');
        dot.setAttribute('r', String(LABEL_DOT_R));
        g.append(line, dot);
        labelsSvg.appendChild(g);
        gsap.set([el, g], { autoAlpha: 0 });
        labelSlots.push({
          el, g, line, dot,
          target: null, // the live Vector3 (shard mesh.position or decoy.pos)
          panel: null, // the keeper panel (for the front-facing test) or null (decoy)
          last: null, // no-repeat guard: the target just released
          tl: null, // the cycle timeline (scramble in → hold → fade)
          dc: null, // the re-slot breath (delayedCall)
          fading: false, // early fade in flight (one-shot latch)
          w: 0, h: 0, // chip box, cached at bind
        });
      }
    }

    // Scratch — updateLabels/pick are synchronous, single-threaded.
    const lblNdc = new THREE.Vector3();
    const lblWorld = new THREE.Vector3();
    const lblNormal = new THREE.Vector3();
    const lblAxis = new THREE.Vector3();
    const lblDisc = new THREE.Vector3();

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

    const labelPool = () => {
      const pool = [];
      panels.forEach((p) => {
        if (p.driftFactor > 0.5) pool.push({ pos: p.mesh.position, panel: p });
      });
      if (decoyMesh.visible) {
        decoys.forEach((d) => {
          if (d.s > 0.5) pool.push({ pos: d.pos, panel: null });
        });
      }
      return pool;
    };
    // Pick-time visibility: front-facing AND the anchor projects comfortably
    // on-screen (|ndc| < BIND). Refreshes matrices itself (rare — bind time).
    const labelVisible = (cand) => {
      if (labelProminence(cand.panel) < LABEL_FRONT_EPS) return false;
      lblNdc.copy(cand.pos);
      globeGroup.localToWorld(lblNdc).project(camera);
      return (
        lblNdc.z <= 1 &&
        Math.abs(lblNdc.x) < LABEL_NDC_BIND &&
        Math.abs(lblNdc.y) < LABEL_NDC_BIND
      );
    };
    const pickTarget = (slot) => {
      refreshLabelMatrices();
      const taken = labelSlots.map((s) => s.target).filter(Boolean);
      const pool = labelPool().filter((c) => !taken.includes(c.pos) && labelVisible(c));
      if (!pool.length) return null;
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
      const term = LABEL_TERMS[termCursor % LABEL_TERMS.length];
      termCursor += 1;
      // Pre-set the final text so the box is measured at its final (mono)
      // size — the ONE layout read per bind; scramble never resizes it.
      slot.el.textContent = term;
      const box = slot.el.getBoundingClientRect();
      slot.w = box.width;
      slot.h = box.height;
      slot.tl?.kill();
      gsap.set([slot.el, slot.g], { autoAlpha: 0 });
      slot.tl = gsap
        .timeline({ onComplete: () => releaseLabel(slot) })
        .call(() => scrambleTo(slot.el, term), null, 0.01)
        .to([slot.el, slot.g], { autoAlpha: 0.85, duration: 0.2, ease: 'power2.out' }, 0.01)
        .to([slot.el, slot.g], { autoAlpha: 0, duration: 0.3, ease: 'power2.in' }, 1.7 + Math.random() * 1.3);
    };
    const releaseLabel = (slot) => {
      slot.last = slot.target;
      slot.target = null;
      slot.panel = null;
      slot.fading = false;
      if (!labelsActive || disposed) return;
      slot.dc?.kill();
      slot.dc = gsap.delayedCall(0.2 + Math.random() * 0.6, () => {
        slot.dc = null;
        if (!labelsActive || disposed || slot.target) return;
        const next = pickTarget(slot);
        if (next) bindLabel(slot, next);
        // no candidate — the slot idles; the next start/cycle fills it
      });
    };
    const earlyFadeLabel = (slot) => {
      if (slot.fading) return;
      slot.fading = true;
      slot.tl?.kill();
      slot.tl = null;
      gsap.to([slot.el, slot.g], {
        autoAlpha: 0,
        duration: 0.3,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: () => {
          if (!disposed) releaseLabel(slot);
        },
      });
    };
    const startLabels = (delay = 0) => {
      if (PREFERS_REDUCED_MOTION || !labelSlots.length || labelsActive) return;
      labelsActive = true;
      labelSlots.forEach((slot, i) => {
        slot.dc?.kill();
        slot.dc = gsap.delayedCall(delay + i * 0.45, () => {
          slot.dc = null;
          if (!labelsActive || disposed || slot.target) return;
          const next = pickTarget(slot);
          if (next) bindLabel(slot, next);
        });
      });
    };
    const stopLabels = () => {
      if (!labelsActive) return;
      labelsActive = false;
      labelSlots.forEach((slot) => {
        slot.tl?.kill();
        slot.tl = null;
        slot.dc?.kill();
        slot.dc = null;
        slot.target = null;
        slot.panel = null;
        slot.fading = false;
        gsap.to([slot.el, slot.g], { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
      });
    };
    const updateLabels = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      refreshLabelMatrices();
      // Belt center in screen px — the chip sits radially outward from it
      // (the hero's disc-center idiom; here it's the framed belt center).
      lblDisc.set(globeGroup.position.x, globeGroup.position.y, 0).project(camera);
      const dcx = (lblDisc.x * 0.5 + 0.5) * w;
      const dcy = (-lblDisc.y * 0.5 + 0.5) * h;
      labelSlots.forEach((slot) => {
        if (!slot.target) return;
        lblNdc.copy(slot.target);
        globeGroup.localToWorld(lblNdc).project(camera);
        // Let go when the anchor turns away or leaves the frame (KEEP
        // margin) — the label rides its shard out and frees the slot.
        const gone =
          lblNdc.z > 1 ||
          Math.abs(lblNdc.x) > LABEL_NDC_KEEP ||
          Math.abs(lblNdc.y) > LABEL_NDC_KEEP ||
          (slot.panel && labelProminence(slot.panel) < LABEL_FRONT_EPS);
        if (gone && !slot.fading) earlyFadeLabel(slot);
        const ax = (lblNdc.x * 0.5 + 0.5) * w;
        const ay = (-lblNdc.y * 0.5 + 0.5) * h;
        // Chip sits OUTWARD from the belt center by LEADER_LEN, centered on
        // that point; the leader connects the anchor to the nearest corner.
        let ox = ax - dcx;
        let oy = ay - dcy;
        const od = Math.hypot(ox, oy) || 1;
        ox /= od;
        oy /= od;
        const cx = ax + ox * LEADER_LEN - slot.w / 2;
        const cy = ay + oy * LEADER_LEN - slot.h / 2;
        slot.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
        const x1 = ax < cx + slot.w / 2 ? cx : cx + slot.w;
        const y1 = ay < cy + slot.h / 2 ? cy : cy + slot.h;
        slot.line.setAttribute('x1', x1.toFixed(1));
        slot.line.setAttribute('y1', y1.toFixed(1));
        slot.line.setAttribute('x2', ax.toFixed(1));
        slot.line.setAttribute('y2', ay.toFixed(1));
        slot.dot.setAttribute('cx', ax.toFixed(1));
        slot.dot.setAttribute('cy', ay.toFixed(1));
      });
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

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      threadMaterial.resolution.set(w, h); // Line2 screen-width lines need it
      if (!activeTl) {
        const { z, offsetX, offsetY } = framingFor(getPose(stage ?? 'stage-01'));
        camera.position.z = z;
        globeGroup.position.x = offsetX;
        globeGroup.position.y = offsetY;
        if (PREFERS_REDUCED_MOTION) {
          updateThread();
          renderFrame();
        }
      }
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
      const { z, offsetX, offsetY } = framingFor(pose);
      camera.position.z = z;
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
      tl.to(camera.position, { z: camera.position.z * 0.82, duration: 0.75 }, 0);
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

      // The Core holds large — dropping low on phones (?dropy).
      const { z, offsetX, offsetY } = framingFor(pose);
      tl.to(camera.position, { z, duration: assembleSeconds }, at0);
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
          if (pose.form === 'belt') beltDrifting = !PREFERS_REDUCED_MOTION;
          if (pose.decoys) startLabels(0.15);
        },
      });

      // A running Thread show never survives an interrupt — fade it fast.
      if (threadActive) {
        tl.to(threadDraw, { alpha: 0, duration: 0.25, ease: 'power2.in' }, 0);
        tl.call(clearThread, null, 0.26);
      }

      const { z, offsetX, offsetY } = framingFor(pose);
      const isLightUp = to === 'stage-03' && !reversing && !compressed;
      const frameDur = (isLightUp ? TUNING.zoomOutSeconds : TUNING.stageSeconds) * durMult;
      tl.to(camera.position, { z, duration: frameDur }, 0);
      tl.to(globeGroup.position, { x: offsetX, y: offsetY, duration: frameDur }, 0);

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

    /* — Render loop: shared gsap.ticker, local FPS gate (never
       gsap.ticker.fps — shared with SiteShell + Lenis). Belt drift and
       Thread reprojection ride the same tick. Reduced motion never runs
       the ticker: single frames only. — */
    let yaw = 0;
    const pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);
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
      yaw += AUTO_ROTATE_SPEED * step;
      globeGroup.rotation.set(pitch, yaw, tiltState.z);
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
      return { fps, calls: renderer.info.render.calls, stage };
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
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickerActive) gsap.ticker.remove(tick);
      if (activeTl) activeTl.kill();
      stopLoops();
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
        slot.dc?.kill();
        gsap.killTweensOf([slot.el, slot.g]);
        slot.el.remove();
        slot.g.remove();
      });
      labelsSvg?.remove();
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
