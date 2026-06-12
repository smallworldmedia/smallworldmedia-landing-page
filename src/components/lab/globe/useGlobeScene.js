/**
 * useGlobeScene.js — The only place three.js meets React.
 *
 * Owns the renderer/scene/camera, builds the panelized globe, assigns CMS
 * thumbnails, and runs the render loop on gsap.ticker with an internal
 * 30fps gate (never gsap.ticker.fps() — the ticker is shared with the
 * persistent SiteShell).
 *
 * Lifecycle: the whole scene rebuilds when assets/gapDeg/capDeg change
 * (lab tuning), and tears down fully on unmount — including
 * forceContextLoss(), so Astro view-transition navigation can't exhaust
 * the browser's WebGL context pool.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import buildGlobeGeometry from './buildGlobeGeometry.js';
import { createPanelMaterial } from './panelMaterial.js';
import TextureManager, { computeCoverUv } from './TextureManager.js';
import InteractionController from './InteractionController.js';
import LivePanelScheduler from './LivePanelScheduler.js';
import buildCascadeTimeline from './cascade.js';
import {
  LON_SEGMENTS,
  LAT_BANDS,
  RADIUS,
  INNER_SPHERE_SCALE,
  CAMERA_FOV,
  FILL_FRACTION,
  INITIAL_PITCH_DEG,
  FPS_CAP,
  DPR_MAX,
  PITCH_LIMIT_DEG,
  GAP_COLOR,
  PANEL_FALLBACK_COLOR,
  PREFERS_REDUCED_MOTION,
} from './globeConfig.js';

/**
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {Array} assets - globe asset pool from GLOBE_ASSETS_QUERY
 * @param {number} gapDeg - live-tunable panel gap (debug slider)
 * @param {number} capDeg - live-tunable polar cap size (debug slider)
 * @param {React.RefObject<string>} variantRef - current cascade variant
 * @param {(stats: Object) => void} onStats - debug readout sink (~2Hz)
 * @param {React.RefObject} poolRef - VideoSlotPool imperative handle (Stage 2 live tier)
 * @returns {React.RefObject<{ replayCascade: (variant: string) => void }>}
 */
export default function useGlobeScene(containerRef, assets, gapDeg, capDeg, variantRef, onStats, poolRef) {
  const apiRef = useRef({ replayCascade: () => {} });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;

    /* — Renderer / scene / camera — */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 50);

    const frameCamera = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Fit the sphere to FILL_FRACTION of the limiting (smaller) fov axis
      const fovV = THREE.MathUtils.degToRad(CAMERA_FOV);
      const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
      const fitFov = Math.min(fovV, fovH);
      camera.position.z = RADIUS / Math.sin((FILL_FRACTION * fitFov) / 2);
      camera.updateProjectionMatrix();
    };
    frameCamera();

    /* — Globe meshes — */
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const { panels, innerSphereGeometry } = buildGlobeGeometry({
      lonSegments: LON_SEGMENTS,
      latBands: LAT_BANDS,
      gapDeg,
      capDeg,
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

    /* — CMS thumbnails — */
    // Assign the pool in initial-prominence order (under the brand-mark
    // tilt) so curated picks (pool head) land on the panels facing the
    // camera at load
    const initialRotation = new THREE.Euler(
      THREE.MathUtils.degToRad(INITIAL_PITCH_DEG), 0, 0
    );
    const initialScore = (p) => p.centerDir.clone().applyEuler(initialRotation).z;
    const byProminence = [...panels].sort((a, b) => initialScore(b) - initialScore(a));
    const textureManager = new TextureManager();
    const thumbnailLoads = byProminence.map((panel, idx) => {
      if (!assets?.length) return Promise.resolve();
      const asset = assets[idx % assets.length];
      panel.asset = asset;
      return textureManager
        .loadThumbnail(asset.playbackId)
        .then((texture) => {
          if (disposed) return;
          const { uniforms } = panel.mesh.material;
          const { scale, offset } = computeCoverUv(1, panel.panelAspect);
          uniforms.texA.value = texture;
          uniforms.uvScaleA.value.set(scale[0], scale[1]);
          uniforms.uvOffsetA.value.set(offset[0], offset[1]);
          uniforms.uHasTexA.value = 1;
        })
        .catch(() => {}); // failed thumb → panel keeps fallback color
    });

    /* — Cascade — */
    let cascadeTl = null;
    const startCascade = (variant) => {
      if (cascadeTl) cascadeTl.kill();
      if (PREFERS_REDUCED_MOTION) {
        panels.forEach((p) => {
          p.mesh.material.uniforms.uPower.value = 1; // instant reveal
        });
        return;
      }
      cascadeTl = buildCascadeTimeline(panels, variant, LAT_BANDS + 2);
    };
    Promise.allSettled(thumbnailLoads).then(() => {
      if (!disposed) startCascade(variantRef.current);
    });
    apiRef.current.replayCascade = (variant) => {
      if (!disposed) startCascade(variant);
    };

    /* — Live video tier (Stage 2; stills only under reduced motion) — */
    const scheduler =
      poolRef?.current && assets?.length && !PREFERS_REDUCED_MOTION
        ? new LivePanelScheduler({
            panels,
            assets,
            poolHandle: poolRef.current,
            textureManager,
          })
        : null;

    /* — Interaction + render loop — */
    const controller = new InteractionController(container);
    const pitchLimit = THREE.MathUtils.degToRad(PITCH_LIMIT_DEG);
    let yaw = 0;
    let pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);

    let accumulated = 0;
    let framesRendered = 0;
    let statClock = 0;
    let schedClock = 0;
    let sceneTime = 0;
    const scoreVec = new THREE.Vector3();

    const tick = (_time, deltaMs) => {
      const dt = deltaMs / 1000;
      accumulated += dt;
      if (accumulated < 1 / FPS_CAP) return;
      const step = accumulated;
      accumulated = 0;

      const { dYaw, dPitch } = controller.update(step);
      yaw += dYaw;
      pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch + dPitch));
      globeGroup.rotation.set(pitch, yaw, 0);

      renderer.render(scene, camera);
      framesRendered += 1;
      sceneTime += step;

      schedClock += step;
      if (scheduler && schedClock >= 0.5) {
        scheduler.update(globeGroup.rotation, sceneTime);
        schedClock = 0;
      }

      statClock += step;
      if (statClock >= 0.5) {
        const top = panels
          .map((p) => ({
            id: `L${p.lonIndex}R${p.row}`,
            score: scoreVec.copy(p.centerDir).applyEuler(globeGroup.rotation).z,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 6);
        onStats({
          fps: Math.round(framesRendered / statClock),
          textures: renderer.info.memory.textures,
          ...(scheduler ? scheduler.getStats() : {}),
          topPanels: top.map((t) => `${t.id}:${t.score.toFixed(2)}`),
        });
        framesRendered = 0;
        statClock = 0;
      }
    };

    /* — Pause when offscreen or tab hidden (MediaCard observer convention) — */
    let tickerActive = false;
    let inView = true;
    const syncTicker = () => {
      const shouldRun = inView && !document.hidden;
      if (shouldRun && !tickerActive) {
        gsap.ticker.add(tick);
        tickerActive = true;
        poolRef?.current?.resumeAll();
      } else if (!shouldRun && tickerActive) {
        gsap.ticker.remove(tick);
        tickerActive = false;
        poolRef?.current?.pauseAll();
      }
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

    const resizeObserver = new ResizeObserver(frameCamera);
    resizeObserver.observe(container);

    /* — Teardown — */
    return () => {
      disposed = true;
      apiRef.current.replayCascade = () => {};
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickerActive) gsap.ticker.remove(tick);
      if (cascadeTl) cascadeTl.kill();
      if (scheduler) scheduler.dispose();
      controller.dispose();
      textureManager.disposeAll();
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
  }, [assets, gapDeg, capDeg]);

  return apiRef;
}
