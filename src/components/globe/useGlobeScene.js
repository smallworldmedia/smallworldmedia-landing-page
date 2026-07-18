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
 *
 * Home-hero hooks (optional, null-safe — lab passes neither): rigRef gets a
 * { rig, apply } camera-rig handle (fill/fitCover/offset/elevation/zoom
 * framing); overlayRef's .update runs post-render each frame (heroOverlay
 * bridge). At identity the rig is bit-identical to the old fixed framing —
 * see applyRig.
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
  FIT_COVER,
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
 * @param {Object} [hero] - home-hero hooks; lab/other callers omit and are unaffected
 * @param {React.RefObject} [hero.rigRef] - receives { rig, apply }: mutate .rig
 *        (fill/fitCover/offsetX/offsetY/elevDeg/zoom), then call .apply() to re-frame
 * @param {React.RefObject} [hero.overlayRef] - overlay bridge (heroOverlay);
 *        its .current.update(ctx) runs once per rendered frame, post-render
 * @returns {React.RefObject<{ replayCascade: (variant: string) => void }>}
 */
export default function useGlobeScene(
  containerRef,
  assets,
  gapDeg,
  capDeg,
  variantRef,
  onStats,
  poolRef,
  { rigRef = null, overlayRef = null } = {}
) {
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

    /* — Camera rig (replaces frameCamera) —
       RIG is the mutable camera pose the outside world drives through rigRef
       (home hero: tuning bench + the scroll gesture's zoom). Identity RIG
       reproduces the pre-rig frameCamera output exactly:
         · fill=FILL_FRACTION, zoom=1 → dist = RADIUS / sin(atan(FILL_FRACTION
           · tanFit)) — the old position.z expression (the trailing ÷1 is
           exact in IEEE);
         · fitCover=null → the device FIT_COVER picks the fit axis, exactly
           the old hard-coded branch (the mobile ring variant overrides to
           contain-fit on a cover-fit device);
         · elevDeg=0 → position.set(0, -sin(0)·d, cos(0)·d) = (0, 0, d), and
           lookAt(origin) from (0,0,d) with the default up resolves to the
           identity rotation the camera already had (exact in FP:
           normalize(0,0,d) = (0,0,1) and the basis cross products are exact);
         · offsetX=offsetY=0 → clearViewOffset(), and r184's
           updateProjectionMatrix applies .view only when .enabled — the
           projection matrix is built from fov/aspect/near/far alone,
           bit-identical to before.
       Values carry across a scene rebuild (lab gap/cap retune) so an outside
       mutation isn't reset when the globe regenerates. */
    const carried = rigRef?.current?.rig;
    const RIG = carried
      ? { ...carried }
      : { fill: FILL_FRACTION, fitCover: null, offsetX: 0, offsetY: 0, elevDeg: 0, zoom: 1 };

    // Canvas CSS px — cached here (applyRig runs at init + resize) so the
    // per-frame overlay call never reads clientWidth (layout) in the loop.
    let viewW = 1;
    let viewH = 1;

    const applyRig = () => {
      if (disposed) return; // a stale handle post-teardown must be a no-op
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      // Re-size only when the box actually changed — apply() also runs on
      // every gesture zoom write, and re-stamping an identical canvas size
      // still clears the drawing buffer (a between-frames flicker).
      if (w !== viewW || h !== viewH) renderer.setSize(w, h, false);
      viewW = w;
      viewH = h;
      camera.aspect = w / h;
      // Tan-space fit: contain (desktop) sizes the globe against the
      // smaller fov axis; cover (mobile overscan) against the larger one,
      // so fill > 1 crops the globe's edges past the viewport.
      // fitCover null = "device FIT_COVER" — like fill's null, the rig's
      // reset state stays honest on both breakpoints.
      const tanV = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2);
      const tanH = tanV * camera.aspect;
      const coverEff = RIG.fitCover ?? FIT_COVER;
      const tanFit = coverEff ? Math.max(tanV, tanH) : Math.min(tanV, tanH);
      // fill null = "device FILL_FRACTION" — the hero bench's reset state.
      const fillEff = RIG.fill ?? FILL_FRACTION;
      // Zoom is a dolly divisor; floor the distance just outside the sphere
      // (surface + near plane + margin) so a deep envelopment zoom can never
      // carry the camera inside the globe — by then the globe already
      // overfills the viewport many times over, so the saturation is unseen.
      const dist = Math.max(
        RADIUS / Math.sin(Math.atan(fillEff * tanFit)) / RIG.zoom,
        RADIUS * 1.15
      );
      // Elevation orbits the camera in the y/z plane, always facing center.
      const er = THREE.MathUtils.degToRad(RIG.elevDeg);
      camera.position.set(0, -Math.sin(er) * dist, Math.cos(er) * dist);
      camera.lookAt(0, 0, 0);
      // View offset: fractions of the half-viewport, ALWAYS re-stamped with
      // fresh px so a resize can never leave a stale offset baked in. At 0/0
      // clear instead of stamping a zero offset — setViewOffset flips
      // .view.enabled on and the projection math takes the .view branch;
      // clearing keeps the identity matrix bit-identical (parity guarantee).
      if (RIG.offsetX !== 0 || RIG.offsetY !== 0) {
        camera.setViewOffset(w, h, (-RIG.offsetX * w) / 2, (-RIG.offsetY * h) / 2, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    applyRig();
    // Expose the rig to the owner (Hero): mutate .rig, then call .apply() —
    // nothing here re-applies on its own. Left in place at teardown so the
    // next scene build can carry the values; apply() is disposed-guarded.
    if (rigRef) rigRef.current = { rig: RIG, apply: applyRig };

    /* — Globe meshes — */
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Persistent overlay call context — mutated per frame, never reallocated
    // (the overlay bridge is a zero-allocation path, heroOverlay.js).
    const overlayCtx = { camera, globeGroup, w: 1, h: 1 };

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
      // Overlay bridge (home hero): hand the just-rendered frame to the DOM
      // overlay — after render, so every matrix is the one drawn. Null-safe:
      // lab/other callers pass no overlayRef and skip entirely.
      if (overlayRef?.current) {
        overlayCtx.w = viewW;
        overlayCtx.h = viewH;
        overlayRef.current.update(overlayCtx);
      }
      framesRendered += 1;
      sceneTime += step;

      schedClock += step;
      if (scheduler && schedClock >= 0.5) {
        scheduler.update(globeGroup.rotation, sceneTime, camera);
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

    const resizeObserver = new ResizeObserver(applyRig);
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
