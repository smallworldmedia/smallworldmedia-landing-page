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
 * Stages: S1 drifting Fragment belt (seeded, empty center) → S2 the Thread
 * chains ?threadhops Fragments then the pull-in assembly constructs the
 * Core over the surfacing inner sphere → S3 zoom-out + the ?cascade
 * light-up → S4 per-panel emanation → S5 ?bpm rhythm loops.
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
  PANEL_FALLBACK_COLOR,
  PREFERS_REDUCED_MOTION,
} from '../globe/globeConfig.js';
import { TURN_EASE_PATH } from '../work/world/worldConfig.js';
import {
  IS_MOBILE,
  DEBUG,
  STAGE_SECONDS,
  SCATTER,
  DRIFT,
  THREAD_HOPS,
  THREAD_HOP_SECONDS,
  ASSEMBLE_SECONDS,
  ZOOM_OUT_SECONDS,
  EMANATE_SCALE,
  EMANATE_ORDER,
  BPM,
  CASCADE_VARIANT,
  FILL_FRACTION,
  LIT_COLOR,
  IDLE_POWER,
  PULSE_MAX,
  PULSE_MIN,
  S3_FILL,
  S45_FILL,
  DESKTOP_OFFSET_X,
  EXIT_RATIO,
  PASS_BEATS,
} from './processConfig.js';

gsap.registerPlugin(CustomEase);

const NOOP_API = { goTo: () => {}, setStageInstant: () => {}, getStage: () => null };
const TOTAL_ROWS = LAT_BANDS + 2;
const STAGE_IDS = ['stage-01', 'stage-02', 'stage-03', 'stage-04', 'stage-05'];
const IDENTITY_QUAT = new THREE.Quaternion();
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/* The belt's framing radius: annulus outer edge + shard half-extent. */
const BELT_FRAME_R = SCATTER * 1.15 + 0.45;

/* Per-stage rest poses. form: 'belt' (scattered Fragments, no inner
   sphere) or 'core' (assembled globe). frameR = effective radius the
   contain fit frames; panelScale = emanation; power/color = the two
   uniforms that are this page's entire visual language (spec §3).
   Reduced motion keeps stage-02 as the connected belt (Thread pre-drawn,
   static) so the narrative survives as stills. */
const POSES = {
  'stage-01': { form: 'belt', frameR: BELT_FRAME_R, fill: FILL_FRACTION, panelScale: 1, power: IDLE_POWER, color: PANEL_FALLBACK_COLOR, loops: false },
  'stage-02': { form: PREFERS_REDUCED_MOTION ? 'belt' : 'core', frameR: PREFERS_REDUCED_MOTION ? BELT_FRAME_R : 1, fill: FILL_FRACTION, panelScale: 1, power: IDLE_POWER, color: PANEL_FALLBACK_COLOR, loops: false },
  'stage-03': { form: 'core', frameR: 1, fill: S3_FILL, panelScale: 1, power: 1, color: LIT_COLOR, loops: false },
  'stage-04': { form: 'core', frameR: EMANATE_SCALE, fill: S45_FILL, panelScale: EMANATE_SCALE, power: 1, color: LIT_COLOR, loops: false },
  'stage-05': { form: 'core', frameR: EMANATE_SCALE, fill: S45_FILL, panelScale: EMANATE_SCALE, power: 1, color: LIT_COLOR, loops: true },
};

/* Equator-out radiation — the trivial third delay model beside
   panelDelay's rows/poles/sweep (spec §3 S5): the inverse of `poles`. */
const maxRing = Math.floor((TOTAL_ROWS - 1) / 2);
const equatorOutDelay = (panel) => {
  const ring = Math.min(panel.row, TOTAL_ROWS - 1 - panel.row);
  return (maxRing - ring) * 0.22 + panel.lonIndex * 0.015 + Math.random() * 0.05;
};

export default function useProcessScene(containerRef, threadRef, captionRef) {
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

    /* Seeded belt: even annulus spread (phyllotaxis + jitter, the
       seededLayout idiom) with an empty center — the Core's center-to-be,
       where the Thread fires from. Same belt every visit. */
    const rand = mulberry32(hashSeed('process-belt'));
    const innerR = SCATTER * 0.55;
    const outerR = SCATTER * 1.15;
    panels.forEach((panel, i) => {
      // Re-bake the shard to its own local origin (see header note).
      panel.homeOffset = panel.centerDir.clone().multiplyScalar(RADIUS);
      panel.geometry.translate(-panel.homeOffset.x, -panel.homeOffset.y, -panel.homeOffset.z);

      const t = (i + 0.5) / panels.length;
      const r = Math.sqrt(innerR * innerR + t * (outerR * outerR - innerR * innerR));
      const ang = i * GOLDEN_ANGLE + rand() * 0.5;
      panel.beltPos = new THREE.Vector3(
        Math.cos(ang) * r,
        Math.sin(ang) * r,
        (rand() - 0.5) * SCATTER * 0.5
      );
      panel.beltQuat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2)
      );
      panel.drift = {
        axis: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize(),
        speed: DRIFT * (0.6 + rand() * 0.8),          // rad/s tumble
        wobbleDir: new THREE.Vector3(rand() - 0.5, rand() - 0.5, (rand() - 0.5) * 0.4).normalize(),
        amp: 0.05 + rand() * 0.09,                     // world-unit wobble
        freq: 0.25 + rand() * 0.35,
        phase: rand() * Math.PI * 2,
      };
      panel.driftFactor = 1; // 1 free-drifting → damped on claim → 0 assembled

      panel.mesh = new THREE.Mesh(
        panel.geometry,
        createPanelMaterial({ fallbackColor: PANEL_FALLBACK_COLOR })
      );
      globeGroup.add(panel.mesh);
    });

    const innerMaterial = new THREE.MeshBasicMaterial({ color: GAP_COLOR });
    const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
    innerSphere.scale.setScalar(0.001); // surfaces at the assembly
    innerSphere.visible = false;
    globeGroup.add(innerSphere);

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
      return { z, offsetX };
    };

    /* — Machine state — */
    let stage = null;
    let activeTl = null;
    let loopTl = null;
    let beltDrifting = false; // tick writes belt transforms only while true
    let threadActive = false; // tick reprojects the Thread only while true
    let threadChain = [];     // claimed panels, hop order
    let threadDraw = { frac: 0, alpha: 1 };

    const renderFrame = () => renderer.render(scene, camera);

    /* — The Thread: screen-space SVG polyline through the chained
       Fragments' projected centroids, drawn dashoffset-style (the house
       CheckIndicator technique). Re-projected per frame while active —
       the targets drift until claimed, then ride the assembly inward. — */
    const projected = new THREE.Vector3();
    const shardCentroid = (panel, out) =>
      globeGroup.localToWorld(out.copy(panel.mesh.position));
    const updateThread = () => {
      const path = threadRef?.current;
      if (!path) return;
      if (!threadActive || threadChain.length === 0) {
        path.setAttribute('d', '');
        return;
      }
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const px = [];
      // Origin: the belt's empty center — the Core's center-to-be.
      projected.set(0, 0, 0);
      globeGroup.localToWorld(projected).project(camera);
      px.push({ x: (projected.x * 0.5 + 0.5) * w, y: (-projected.y * 0.5 + 0.5) * h });
      threadChain.forEach((panel) => {
        shardCentroid(panel, projected).project(camera);
        px.push({ x: (projected.x * 0.5 + 0.5) * w, y: (-projected.y * 0.5 + 0.5) * h });
      });
      let d = `M ${px[0].x.toFixed(1)} ${px[0].y.toFixed(1)}`;
      for (let i = 1; i < px.length - 1; i++) {
        const mx = (px[i].x + px[i + 1].x) / 2;
        const my = (px[i].y + px[i + 1].y) / 2;
        d += ` Q ${px[i].x.toFixed(1)} ${px[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      }
      const last = px[px.length - 1];
      d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
      path.setAttribute('d', d);
      const len = path.getTotalLength();
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${(1 - threadDraw.frac) * len}`;
      path.style.opacity = `${threadDraw.alpha}`;
    };
    const clearThread = () => {
      threadActive = false;
      threadChain = [];
      threadDraw = { frac: 0, alpha: 1 };
      threadRef?.current?.setAttribute('d', '');
    };

    /* Greedy nearest-neighbor chain from the belt center, computed at
       goTo time from live positions (drift is slow; endpoints stay live
       via per-frame projection). */
    const buildChain = () => {
      const pool = [...panels];
      const chain = [];
      const cursor = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < Math.min(THREAD_HOPS, pool.length); i++) {
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

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      threadRef?.current?.ownerSVGElement?.setAttribute('viewBox', `0 0 ${w} ${h}`);
      if (!activeTl) {
        const { z, offsetX } = framingFor(POSES[stage ?? 'stage-01']);
        camera.position.z = z;
        globeGroup.position.x = offsetX;
        if (PREFERS_REDUCED_MOTION) {
          updateThread();
          renderFrame();
        }
      }
    };

    const stopLoops = () => {
      if (loopTl) loopTl.kill();
      loopTl = null;
    };

    /* — S5 rhythm loops (see P2 notes: the dip is the visible half —
       pure 0x0000ff saturates blue at uPower 1) — */
    const buildRhythmLoop = () => {
      const beat = 60 / BPM;
      const pass = PASS_BEATS * beat;
      const pulse = [
        { value: PULSE_MIN, duration: beat * 0.5, ease: 'sine.in' },
        { value: PULSE_MAX, duration: beat * 0.5, ease: 'sine.inOut' },
        { value: 1.0, duration: beat * 0.5, ease: 'sine.out' },
      ];
      const tl = gsap.timeline({ repeat: -1 });
      ['rows', 'equator'].forEach((pattern, pi) => {
        const delays = panels.map((p) =>
          pattern === 'equator' ? equatorOutDelay(p) : panelDelay(p, 'rows', TOTAL_ROWS)
        );
        const spread = Math.max(...delays) || 1;
        const scale = (pass - beat * 1.5) / spread;
        panels.forEach((p, i) => {
          tl.to(p.mesh.material.uniforms.uPower, { keyframes: pulse }, pi * pass + delays[i] * scale);
        });
      });
      return tl;
    };

    const startLoops = () => {
      if (PREFERS_REDUCED_MOTION) return; // stills: no idle motion anywhere
      stopLoops();
      loopTl = buildRhythmLoop();
    };

    /* — Instant pose application (arrival sync + every RM boundary) — */
    const applyPose = (pose) => {
      const { z, offsetX } = framingFor(pose);
      camera.position.z = z;
      globeGroup.position.x = offsetX;
      const color = new THREE.Color(pose.color);
      const belt = pose.form === 'belt';
      panels.forEach((p) => {
        const u = p.mesh.material.uniforms;
        u.uPower.value = pose.power;
        u.uFallbackColor.value.copy(color);
        p.mesh.scale.setScalar(pose.panelScale);
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
      innerSphere.visible = !belt;
      innerSphere.scale.setScalar(belt ? 0.001 : INNER_SPHERE_SCALE);
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

    /* — S1→S2 authored show: the Thread connects, then the assembly — */
    const buildConnectAndAssemble = (pose) => {
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

      // Connect: hop-by-hop trim-path draw; each strike blips the
      // Fragment's power and damps its drift to a gentle hold — claimed.
      threadChain.forEach((panel, i) => {
        const at = i * THREAD_HOP_SECONDS;
        tl.to(threadDraw, { frac: (i + 1) / threadChain.length, duration: THREAD_HOP_SECONDS, ease: turnEase }, at);
        tl.call(
          () => {
            gsap.to(panel, { driftFactor: 0.12, duration: 0.6, ease: 'power2.out' });
            gsap.timeline()
              .to(panel.mesh.material.uniforms.uPower, { value: 0.9, duration: 0.12, ease: 'power1.in' })
              .to(panel.mesh.material.uniforms.uPower, { value: 0.45, duration: 0.5, ease: 'sine.out' });
          },
          null,
          at + THREAD_HOP_SECONDS
        );
      });

      const connectEnd = threadChain.length * THREAD_HOP_SECONDS;
      tl.call(() => fireCaption('dots_connected'), null, connectEnd);

      // Assemble: every Fragment pulls inward to its home row/lonIndex
      // slot (cascade-family stagger — the sphere closes in a visible
      // order) while the blue foundation surfaces behind the shell and
      // the Thread rides its endpoints inward and fades.
      const at0 = connectEnd + 0.15;
      tl.call(() => {
        beltDrifting = false;
        panels.forEach((p) => {
          gsap.killTweensOf(p);
          p.driftFactor = 0; // assembled — the belt never reclaims these
        });
      }, null, at0);

      const perDur = ASSEMBLE_SECONDS * 0.55;
      const delays = panels.map((p) => panelDelay(p, CASCADE_VARIANT, TOTAL_ROWS));
      const spread = Math.max(...delays) || 1;
      panels.forEach((p, i) => {
        const at = at0 + (delays[i] / spread) * (ASSEMBLE_SECONDS - perDur);
        tl.to(p.mesh.position, { x: p.homeOffset.x, y: p.homeOffset.y, z: p.homeOffset.z, duration: perDur }, at);
        tweenQuat(tl, p.mesh, IDENTITY_QUAT, perDur, at);
      });

      tl.call(() => {
        innerSphere.visible = true;
      }, null, at0);
      tl.to(innerSphere.scale, { x: INNER_SPHERE_SCALE, y: INNER_SPHERE_SCALE, z: INNER_SPHERE_SCALE, duration: ASSEMBLE_SECONDS * 0.8 }, at0 + ASSEMBLE_SECONDS * 0.15);
      tl.to(threadDraw, { alpha: 0, duration: ASSEMBLE_SECONDS * 0.7, ease: 'power2.in' }, at0 + ASSEMBLE_SECONDS * 0.25);

      // The Core holds center-frame, large.
      const { z, offsetX } = framingFor(pose);
      tl.to(camera.position, { z, duration: ASSEMBLE_SECONDS }, at0);
      tl.to(globeGroup.position, { x: offsetX, duration: ASSEMBLE_SECONDS }, at0);

      tl.call(() => {
        clearThread();
        fireCaption('core_assembled');
      }, null, at0 + ASSEMBLE_SECONDS);
      return tl;
    };

    /* — Generic transitions: discrete, time-domain, house curve; exits
       ≈0.7×. Form-aware — also the compressed catch-up for interrupts. — */
    const buildTransition = (from, to, compressed) => {
      const pose = POSES[to];
      const reversing = STAGE_IDS.indexOf(to) < STAGE_IDS.indexOf(from);

      if (to === 'stage-02' && from === 'stage-01' && !compressed) {
        return buildConnectAndAssemble(pose);
      }

      const durMult = (compressed ? 0.65 : 1) * (reversing ? EXIT_RATIO : 1);
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        onComplete: () => {
          activeTl = null;
          if (pose.loops) startLoops();
          if (pose.form === 'belt') beltDrifting = !PREFERS_REDUCED_MOTION;
        },
      });

      // A running Thread show never survives an interrupt — fade it fast.
      if (threadActive) {
        tl.to(threadDraw, { alpha: 0, duration: 0.25, ease: 'power2.in' }, 0);
        tl.call(clearThread, null, 0.26);
      }

      const { z, offsetX } = framingFor(pose);
      const isLightUp = to === 'stage-03' && !reversing && !compressed;
      const frameDur = (isLightUp ? ZOOM_OUT_SECONDS : STAGE_SECONDS) * durMult;
      tl.to(camera.position, { z, duration: frameDur }, 0);
      tl.to(globeGroup.position, { x: offsetX, duration: frameDur }, 0);

      const color = new THREE.Color(pose.color);
      const toBelt = pose.form === 'belt';
      const fromBelt = POSES[from]?.form === 'belt';

      if (fromBelt || toBelt) {
        // The tick hands the belt to gsap until onComplete re-arms it.
        beltDrifting = false;
        panels.forEach((p) => {
          gsap.killTweensOf(p);
          if (!toBelt) p.driftFactor = 0;
        });
      }

      if (isLightUp && !fromBelt) {
        // S2→S3: dolly back first, then the page's single loudest beat —
        // the cascade timeline verbatim (flicker), color riding the same
        // delay model. Nothing else animates during it.
        const at = frameDur * 0.7;
        tl.add(buildCascadeTimeline(panels, CASCADE_VARIANT, TOTAL_ROWS), at);
        panels.forEach((p) => {
          tl.to(
            p.mesh.material.uniforms.uFallbackColor.value,
            { r: color.r, g: color.g, b: color.b, duration: 0.35, ease: 'power2.out' },
            at + panelDelay(p, CASCADE_VARIANT, TOTAL_ROWS)
          );
        });
      } else {
        // Pose morph. Emanation (panel-scale change) staggers on its own
        // order; form changes tween shard transforms scatter ↔ home.
        const emanating = !toBelt && Math.abs(pose.panelScale - panels[0].mesh.scale.x) > 1e-3;
        const dur = STAGE_SECONDS * 0.6 * durMult;
        panels.forEach((p) => {
          const u = p.mesh.material.uniforms;
          const at = emanating ? panelDelay(p, EMANATE_ORDER, TOTAL_ROWS) * 0.55 * durMult : 0;
          const target = toBelt
            ? p.beltPos
            : { x: p.homeOffset.x * pose.panelScale, y: p.homeOffset.y * pose.panelScale, z: p.homeOffset.z * pose.panelScale };
          tl.to(p.mesh.position, { x: target.x, y: target.y, z: target.z, duration: dur }, at);
          tweenQuat(tl, p.mesh, toBelt ? p.beltQuat : IDENTITY_QUAT, dur, at);
          tl.to(p.mesh.scale, { x: pose.panelScale, y: pose.panelScale, z: pose.panelScale, duration: dur }, at);
          tl.to(u.uPower, { value: pose.power, duration: dur }, at);
          tl.to(u.uFallbackColor.value, { r: color.r, g: color.g, b: color.b, duration: dur }, at);
          if (toBelt) tl.set(p, { driftFactor: 1 }, at + dur);
        });
        if (toBelt) {
          tl.to(innerSphere.scale, { x: 0.001, y: 0.001, z: 0.001, duration: dur * 0.5 }, 0);
          tl.call(() => {
            innerSphere.visible = false;
          }, null, dur * 0.5 + 0.01);
        } else if (!innerSphere.visible || innerSphere.scale.x < INNER_SPHERE_SCALE * 0.99) {
          tl.call(() => {
            innerSphere.visible = true;
          }, null, 0);
          tl.to(innerSphere.scale, { x: INNER_SPHERE_SCALE, y: INNER_SPHERE_SCALE, z: INNER_SPHERE_SCALE, duration: dur * 0.6 }, 0);
        }
      }
      return tl;
    };

    const setStageInstant = (next) => {
      if (!POSES[next] || next === stage || disposed) return;
      if (DEBUG) console.info(`[ProcessScene] setStageInstant ${stage ?? '∅'} → ${next}`);
      if (activeTl) activeTl.kill();
      activeTl = null;
      stopLoops();
      panels.forEach((p) => gsap.killTweensOf(p));
      applyPose(POSES[next]);
      // RM narrative still for stage-02: the connected belt, Thread drawn,
      // caption snapped to its final text (scramble degrades, spec §7).
      if (next === 'stage-02' && POSES['stage-02'].form === 'belt') {
        threadChain = buildChain();
        threadDraw = { frac: 1, alpha: 1 };
        threadActive = true;
        threadChain.forEach((p) => {
          p.driftFactor = 0.12;
          p.mesh.material.uniforms.uPower.value = 0.45;
        });
        if (captionRef?.current) captionRef.current.textContent = 'dots_connected';
      } else {
        clearThread();
      }
      stage = next;
      if (POSES[next].loops) startLoops();
      updateThread();
      renderFrame();
    };

    const goTo = (next) => {
      if (!POSES[next] || next === stage || disposed) return;
      if (PREFERS_REDUCED_MOTION) {
        setStageInstant(next);
        return;
      }
      if (DEBUG) console.info(`[ProcessScene] goTo ${stage ?? '∅'} → ${next}`);
      const interrupted = Boolean(activeTl);
      if (activeTl) activeTl.kill();
      stopLoops();
      activeTl = buildTransition(stage ?? 'stage-01', next, interrupted);
      stage = next;
    };

    /* — Render loop: shared gsap.ticker, local FPS gate (never
       gsap.ticker.fps — shared with SiteShell + Lenis). Belt drift and
       Thread reprojection ride the same tick. Reduced motion never runs
       the ticker: single frames only. — */
    let yaw = 0;
    const pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);
    let accumulated = 0;
    let sceneTime = 0;
    const tick = (_time, deltaMs) => {
      accumulated += deltaMs / 1000;
      if (accumulated < 1 / FPS_CAP) return;
      const step = accumulated;
      accumulated = 0;
      sceneTime += step;
      yaw += AUTO_ROTATE_SPEED * step;
      globeGroup.rotation.set(pitch, yaw, 0);
      if (beltDrifting) {
        panels.forEach((p) => {
          if (p.driftFactor <= 0) return;
          const d = p.drift;
          p.mesh.position
            .copy(p.beltPos)
            .addScaledVector(d.wobbleDir, Math.sin(sceneTime * d.freq * Math.PI * 2 + d.phase) * d.amp * p.driftFactor);
          p.mesh.rotateOnAxis(d.axis, d.speed * step * p.driftFactor);
        });
      }
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
    // no globe yet — the drifting Fragment belt.
    applyPose(POSES['stage-01']);
    renderFrame();

    apiRef.current = { goTo, setStageInstant, getStage: () => stage };

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
      panels.forEach((panel) => {
        gsap.killTweensOf(panel);
        gsap.killTweensOf(panel.mesh.material.uniforms.uPower);
        panel.geometry.dispose();
        panel.mesh.material.dispose();
      });
      innerSphereGeometry.dispose();
      innerMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  return apiRef;
}
