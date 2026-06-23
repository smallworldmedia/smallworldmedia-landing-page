/**
 * useWorldScene.js — three.js for one Featured Project World at a time.
 *
 * A persistent renderer/scene/camera sits inside the World Shell; only the
 * Tiles swap when the active project changes (cheap — no context churn).
 *
 * Distortion is a single post-process LENS pass (ycw/three-lens-distortion,
 * vendored, XY-controllable) over the whole composited frame, so Tiles and the
 * Shell grid warp by the *same* function — negative = the inside-a-sphere pull.
 * Tiles are placed flat at real Z depths (layering before the warp).
 *
 * Parallax is layered, not a camera rotation: pointer movement translates each
 * depth tier by an amount that scales with how close it is (nearest tier moves
 * most), with the World Shell on the smallest, base amount. That staggered
 * motion is what sells the depth/sphere on top of the lens.
 *
 * P2 = stills only. Live video (Near tier) and the World Turn land in P3.
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {Object|null} world - the active World ({ slug, showcase: [...] })
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { LensDistortionPassGen } from './vendor/lensDistortion.js';
import { buildShell } from './buildShell.js';
import { placeTiles } from './seededLayout.js';
import {
  CAMERA_FOV,
  DPR_MAX,
  FPS_CAP,
  MAX_TILES,
  MIN_TILES,
  THUMB_SIZE,
  DEPTH_TIERS,
  SHELL_RADIUS,
  PARALLAX,
  PARALLAX_LERP,
  BG_COLOR,
  TILE_FALLBACK_COLOR,
  LENS_DISTORTION_X,
  LENS_DISTORTION_Y,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

const tileSrc = (t) =>
  t.playbackId
    ? `https://image.mux.com/${t.playbackId}/thumbnail.jpg?width=${THUMB_SIZE}` // native aspect (no forced square crop)
    : t.imageUrl
      ? `${t.imageUrl}?w=${THUMB_SIZE}&auto=format&fit=max`
      : null;

/** Cover-fit a texture into a plane of `planeAspect` via the texture transform. */
function applyCover(material, texture, planeAspect, texAspect) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.center.set(0.5, 0.5);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (texAspect > planeAspect) {
    texture.repeat.set(planeAspect / texAspect, 1);
  } else {
    texture.repeat.set(1, texAspect / planeAspect);
  }
  material.map = texture;
  material.color.set(0xffffff);
  material.needsUpdate = true;
}

export default function useWorldScene(containerRef, world) {
  const apiRef = useRef(null);

  // ── Setup: renderer / composer / scene / camera / shell / loop (mount once) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(BG_COLOR);
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
    camera.position.set(0, 0, 0);

    const shell = buildShell();
    scene.add(shell);

    // One group per depth tier — parallax translates each by a tier-scaled amount.
    const tierGroups = DEPTH_TIERS.map(() => {
      const g = new THREE.Group();
      scene.add(g);
      return g;
    });
    // Nearest tier (smallest |z|) gets the largest parallax; the Shell is the base (1×).
    const tierGain = DEPTH_TIERS.map((z) => SHELL_RADIUS / Math.abs(z));

    // Post-processing: scene → lens distortion → sRGB output.
    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    composer.addPass(new RenderPass(scene, camera));
    const LensDistortionPass = LensDistortionPassGen({ THREE, Pass, FullScreenQuad });
    const lensPass = new LensDistortionPass({
      distortion: new THREE.Vector2(LENS_DISTORTION_X, LENS_DISTORTION_Y),
      principalPoint: new THREE.Vector2(0, 0),
      focalLength: new THREE.Vector2(1, 1),
      skew: 0,
    });
    composer.addPass(lensPass);
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    let tiles = []; // { mesh, texture, tierIndex }

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const clearTiles = () => {
      for (const t of tiles) {
        tierGroups[t.tierIndex].remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        if (t.texture) t.texture.dispose();
      }
      tiles = [];
    };

    const buildTiles = (w) => {
      clearTiles();
      const pool = w?.showcase || [];
      if (!pool.length) return;
      // Cycle the available showcase up to a minimum density so sparse
      // Worlds still fill the field (the globe's autoFill convention).
      const count = Math.min(MAX_TILES, Math.max(MIN_TILES, pool.length));
      const chosen = Array.from({ length: count }, (_, i) => pool[i % pool.length]);
      const placements = placeTiles(chosen, {
        seed: w.slug,
        aspect: camera.aspect || 1,
      });

      chosen.forEach((tile, i) => {
        const pl = placements[i];
        const tierIndex = i % DEPTH_TIERS.length;
        const material = new THREE.MeshBasicMaterial({
          color: TILE_FALLBACK_COLOR,
          toneMapped: false,
        });
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(pl.width, pl.height),
          material
        );
        // Flat (faces the camera) — the lens pass provides cohesive distortion.
        mesh.position.set(pl.x, pl.y, pl.z);
        tierGroups[tierIndex].add(mesh);

        const rec = {
          mesh,
          texture: null,
          tierIndex,
          baseX: pl.x,
          baseY: pl.y,
          driftAxis: pl.driftAxis,
          driftSign: pl.driftSign,
          driftAmp: pl.driftAmp,
        };
        tiles.push(rec);

        const src = tileSrc(tile);
        if (!src) return;
        loader.load(
          src,
          (texture) => {
            if (disposed || !tiles.includes(rec)) {
              texture.dispose();
              return;
            }
            rec.texture = texture;
            // Texture matches the asset's native aspect, so cover-fit is
            // ~identity and the image shows proportionately without cropping.
            const texAspect = tile.ratio || 1;
            applyCover(material, texture, pl.width / pl.height, texAspect);
          },
          undefined,
          () => { } // failed load → tile keeps fallback color
        );
      });
    };

    // ── Pointer parallax (listen on window so DOM overlays don't swallow it) ──
    const target = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    const onPointer = (e) => {
      if (PREFERS_REDUCED_MOTION) return;
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onPointer);

    // ── Render loop (gsap.ticker, internally FPS-gated; shared with SiteShell) ──
    let accumulated = 0;
    const tick = (_t, deltaMs) => {
      accumulated += deltaMs / 1000;
      if (accumulated < 1 / FPS_CAP) return;
      accumulated = 0;

      eased.x += (target.x - eased.x) * PARALLAX_LERP;
      eased.y += (target.y - eased.y) * PARALLAX_LERP;

      // Depth parallax — continuous, tethered to pointer position.
      // Base layer: the World Shell / grid moves the least.
      shell.position.set(eased.x * PARALLAX, -eased.y * PARALLAX, 0);
      // Staggered layers: nearest tier moves most (tierGain), far less.
      for (let i = 0; i < tierGroups.length; i++) {
        const amp = PARALLAX * tierGain[i];
        tierGroups[i].position.set(eased.x * amp, -eased.y * amp, 0);
      }

      // Per-tile micro-drift — subtle individual motion on one seeded axis,
      // tethered to pointer position.
      for (const t of tiles) {
        if (t.driftAxis === 'x') {
          t.mesh.position.x = t.baseX + eased.x * t.driftSign * t.driftAmp;
        } else {
          t.mesh.position.y = t.baseY + eased.y * t.driftSign * t.driftAmp;
        }
      }

      composer.render();
    };

    let tickerActive = false;
    let inView = true;
    const syncTicker = () => {
      const run = inView && !document.hidden;
      if (run && !tickerActive) {
        gsap.ticker.add(tick);
        tickerActive = true;
      } else if (!run && tickerActive) {
        gsap.ticker.remove(tick);
        tickerActive = false;
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        syncTicker();
      },
      { threshold: 0.02 }
    );
    io.observe(container);
    const onVisibility = () => syncTicker();
    document.addEventListener('visibilitychange', onVisibility);
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    syncTicker();

    apiRef.current = { buildTiles };

    return () => {
      disposed = true;
      apiRef.current = null;
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      if (tickerActive) gsap.ticker.remove(tick);
      clearTiles();
      tierGroups.forEach((g) => scene.remove(g));
      shell.geometry.dispose();
      shell.material.dispose();
      lensPass.dispose();
      outputPass.dispose?.();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);

  // ── Swap Tiles when the active World changes ──
  useEffect(() => {
    apiRef.current?.buildTiles(world);
  }, [world?.slug]);
}
