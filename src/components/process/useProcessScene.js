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
 * P2 scope: S3 light-up (uFallbackColor + uPower cascade), S4 emanation
 * (per-panel mesh scale — geometry is baked at radius so uniform scale
 * pushes a panel out along its own normal), S5 rhythm loops on the ?bpm
 * grid. S1/S2 rest as the dark assembled Core until P3 lands the Fragment
 * belt, the Thread, and the pull-in assembly.
 *
 * API (spec §3): goTo(stageId) — one active transition at a time; an
 * interrupting goTo kills the running timeline and plays a compressed
 * catch-up morph. setStageInstant(stageId) — reduced-motion path: jump to
 * the stage's rest pose, render one frame.
 */
import { useRef, useLayoutEffect } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import buildGlobeGeometry from '../globe/buildGlobeGeometry.js';
import { createPanelMaterial } from '../globe/panelMaterial.js';
import buildCascadeTimeline, { panelDelay } from '../globe/cascade.js';
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

/* Per-stage rest poses. fill = contain-fit fraction (drives camera
   distance), panelScale = emanation radius, power/color = the two uniforms
   that are this page's entire visual language (spec §3). */
const POSES = {
  'stage-01': { fill: FILL_FRACTION, panelScale: 1, power: IDLE_POWER, color: PANEL_FALLBACK_COLOR, loops: false },
  'stage-02': { fill: FILL_FRACTION, panelScale: 1, power: IDLE_POWER, color: PANEL_FALLBACK_COLOR, loops: false },
  'stage-03': { fill: S3_FILL, panelScale: 1, power: 1, color: LIT_COLOR, loops: false },
  'stage-04': { fill: S45_FILL, panelScale: EMANATE_SCALE, power: 1, color: LIT_COLOR, loops: false },
  'stage-05': { fill: S45_FILL, panelScale: EMANATE_SCALE, power: 1, color: LIT_COLOR, loops: true },
};

/* Equator-out radiation — the trivial third delay model beside
   panelDelay's rows/poles/sweep (spec §3 S5): the inverse of `poles`. */
const maxRing = Math.floor((TOTAL_ROWS - 1) / 2);
const equatorOutDelay = (panel) => {
  const ring = Math.min(panel.row, TOTAL_ROWS - 1 - panel.row);
  return (maxRing - ring) * 0.22 + panel.lonIndex * 0.015 + Math.random() * 0.05;
};

export default function useProcessScene(containerRef) {
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

    /* — The 84 panels + inner occlusion sphere (same meshes birth-to-end:
       in P3 these same panels start scattered as the Fragment belt) — */
    const { panels, innerSphereGeometry } = buildGlobeGeometry({
      lonSegments: LON_SEGMENTS,
      latBands: LAT_BANDS,
      gapDeg: GAP_DEG,
      capDeg: CAP_DEG,
      radius: RADIUS,
    });
    panels.forEach((panel) => {
      panel.mesh = new THREE.Mesh(
        panel.geometry,
        createPanelMaterial({ fallbackColor: PANEL_FALLBACK_COLOR })
      );
      globeGroup.add(panel.mesh);
    });

    const innerMaterial = new THREE.MeshBasicMaterial({ color: GAP_COLOR });
    const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
    innerSphere.scale.setScalar(INNER_SPHERE_SCALE);
    globeGroup.add(innerSphere);

    /* — Framing: tan-space contain fit (mobile too — the belt must fit
       whole, spec §7; never the home globe's cover-overscan). The globe
       composes right-of-center on desktop via group offset. — */
    const framingFor = (pose) => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
      const tanH = tanV * (w / h);
      const tanFit = Math.min(tanV, tanH);
      const z = (RADIUS * pose.panelScale) / Math.sin(Math.atan(pose.fill * tanFit));
      const offsetX = IS_MOBILE ? 0 : z * tanH * DESKTOP_OFFSET_X;
      return { z, offsetX };
    };

    /* — Machine state — */
    let stage = null;
    let activeTl = null;
    let loopTl = null;

    const renderFrame = () => renderer.render(scene, camera);

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (!activeTl) {
        const { z, offsetX } = framingFor(POSES[stage ?? 'stage-01']);
        camera.position.z = z;
        globeGroup.position.x = offsetX;
        if (PREFERS_REDUCED_MOTION) renderFrame();
      }
    };

    const stopLoops = () => {
      if (loopTl) loopTl.kill();
      loopTl = null;
    };

    /* — S5: rhythm loops on the ?bpm grid — the rows waterfall alternating
       with equator-out radiation, one pass per PASS_BEATS, pulse amplitude
       capped at the flicker ceiling. Ambient yaw continues underneath. — */
    const buildRhythmLoop = () => {
      const beat = 60 / BPM;
      const pass = PASS_BEATS * beat;
      // Dip → peak → settle: the dip is the visible half (blue saturates
      // at uPower 1, see PULSE_MIN); the peak keeps the flicker ceiling.
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
        const scale = (pass - beat * 1.5) / spread; // every pulse lands inside its pass
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

    const applyPose = (pose) => {
      const { z, offsetX } = framingFor(pose);
      camera.position.z = z;
      globeGroup.position.x = offsetX;
      const color = new THREE.Color(pose.color);
      panels.forEach((p) => {
        const u = p.mesh.material.uniforms;
        u.uPower.value = pose.power;
        u.uFallbackColor.value.copy(color);
        p.mesh.scale.setScalar(pose.panelScale);
      });
    };

    /* — Transitions: discrete, time-domain, house curve; exits ≈0.7× — */
    const buildTransition = (from, to, compressed) => {
      const pose = POSES[to];
      const reversing = STAGE_IDS.indexOf(to) < STAGE_IDS.indexOf(from);
      const durMult = (compressed ? 0.65 : 1) * (reversing ? EXIT_RATIO : 1);
      const tl = gsap.timeline({
        defaults: { ease: turnEase },
        onComplete: () => {
          activeTl = null;
          if (pose.loops) startLoops();
        },
      });

      const { z, offsetX } = framingFor(pose);
      const isLightUp = to === 'stage-03' && !reversing && !compressed;
      const frameDur = (isLightUp ? ZOOM_OUT_SECONDS : STAGE_SECONDS) * durMult;
      tl.to(camera.position, { z, duration: frameDur }, 0);
      tl.to(globeGroup.position, { x: offsetX, duration: frameDur }, 0);

      const color = new THREE.Color(pose.color);

      if (isLightUp) {
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
        // Generic pose morph — also the compressed catch-up for interrupts.
        // Emanation (panel-scale change) staggers on its own order; flat
        // otherwise.
        const emanating = Math.abs(pose.panelScale - panels[0].mesh.scale.x) > 1e-3;
        const dur = STAGE_SECONDS * 0.6 * durMult;
        panels.forEach((p) => {
          const u = p.mesh.material.uniforms;
          const at = emanating ? panelDelay(p, EMANATE_ORDER, TOTAL_ROWS) * 0.55 * durMult : 0;
          tl.to(p.mesh.scale, { x: pose.panelScale, y: pose.panelScale, z: pose.panelScale, duration: dur }, at);
          tl.to(u.uPower, { value: pose.power, duration: dur }, at);
          tl.to(u.uFallbackColor.value, { r: color.r, g: color.g, b: color.b, duration: dur }, at);
        });
      }
      return tl;
    };

    const setStageInstant = (next) => {
      if (!POSES[next] || next === stage || disposed) return;
      if (DEBUG) console.info(`[ProcessScene] setStageInstant ${stage ?? '∅'} → ${next}`);
      if (activeTl) activeTl.kill();
      activeTl = null;
      stopLoops();
      applyPose(POSES[next]);
      stage = next;
      if (POSES[next].loops) startLoops();
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
       gsap.ticker.fps — the ticker is shared with SiteShell + Lenis).
       Reduced motion never runs the ticker: single frames only. — */
    let yaw = 0;
    const pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);
    let accumulated = 0;
    const tick = (_time, deltaMs) => {
      accumulated += deltaMs / 1000;
      if (accumulated < 1 / FPS_CAP) return;
      const step = accumulated;
      accumulated = 0;
      yaw += AUTO_ROTATE_SPEED * step;
      globeGroup.rotation.set(pitch, yaw, 0);
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

    // Rest pose up before the driver's arrival sync (same layout phase).
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
