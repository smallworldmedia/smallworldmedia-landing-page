/**
 * useWorldScene.js — three.js for the Featured Project Worlds.
 *
 * A persistent renderer/scene/camera sits inside the World Shell. Tiles live in
 * one of two render **slots** (slotA / slotB): normally only the active slot is
 * populated, but during a **World Turn** both are briefly co-present — the
 * outgoing World rolls out while the incoming rolls in — then the outgoing slot
 * is torn down (cheap; no context churn).
 *
 * Each slot is a roll **pivot** (rotated around the X axis for the Turn) holding
 * one Group per depth tier. The Shell is shared room and never turns.
 *
 * Distortion is a single post-process LENS pass (ycw/three-lens-distortion,
 * vendored, XY-controllable) over the whole composited frame, so Tiles and the
 * Shell grid warp by the *same* function — negative = the inside-a-sphere pull.
 * The Turn spikes that distortion at its midpoint for a cohesive "whoosh".
 *
 * Parallax is layered, not a camera rotation: pointer movement translates each
 * depth tier by an amount that scales with how close it is (nearest tier moves
 * most), with the World Shell on the smallest, base amount. That staggered
 * motion is what sells the depth/sphere on top of the lens.
 *
 * P3 here = the World Turn. Live video (Near tier) lands next.
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {Object|null} world - the active World ({ slug, showcase: [...] })
 * @param {number} index - the active World's index (drives Turn direction)
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
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
  TURN_DURATION,
  TURN_EXIT_ANGLE,
  TURN_ENTER_ANGLE,
  TURN_LENS_SPIKE,
  TURN_RECEDE,
  TURN_EASE_PATH,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

gsap.registerPlugin(CustomEase);

// The single ease that shapes the whole World Turn (roll + recede + lens).
// Authored as a GSAP CustomEase path in worldConfig (?ease= to override live).
const turnRollEase = CustomEase.create('fpTurnRoll', TURN_EASE_PATH);

/** Hermite smoothstep over [a,b]. */
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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

export default function useWorldScene(containerRef, world, index) {
  const apiRef = useRef(null);
  const prevIndexRef = useRef(null);

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

    // Nearest tier (smallest |z|) gets the largest parallax; the Shell is the base (1×).
    const tierGain = DEPTH_TIERS.map((z) => SHELL_RADIUS / Math.abs(z));

    // Two render slots so two Worlds can co-exist during a Turn. Each slot is a
    // roll pivot (X-axis rotation) holding one Group per depth tier; parallax
    // translates the tier groups *inside* the pivot, so it composes with a roll.
    const makeSlot = () => {
      const pivot = new THREE.Group();
      scene.add(pivot);
      const tierGroups = DEPTH_TIERS.map(() => {
        const g = new THREE.Group();
        pivot.add(g);
        return g;
      });
      return { pivot, tierGroups, tiles: [] }; // tiles: { mesh, texture, tierIndex, baseX, baseY, drift* }
    };
    const slotA = makeSlot();
    const slotB = makeSlot();
    let activeSlot = slotA;
    let idleSlot = slotB;
    let currentSlug = null;

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

    // Lens spike (0..1) added to the base distortion during a Turn.
    const lensSpike = { v: 0 };
    const applyLens = () => {
      lensPass.distortion.x = LENS_DISTORTION_X + TURN_LENS_SPIKE * lensSpike.v;
      lensPass.distortion.y = LENS_DISTORTION_Y + TURN_LENS_SPIKE * 1.1 * lensSpike.v;
    };

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    const setSlotOpacity = (slot, o) => {
      for (const t of slot.tiles) t.mesh.material.opacity = o;
    };

    const clearSlot = (slot) => {
      for (const t of slot.tiles) {
        slot.tierGroups[t.tierIndex].remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        if (t.texture) t.texture.dispose();
      }
      slot.tiles = [];
    };

    // Build a World's Tiles into a slot (replacing whatever it held).
    const buildSlot = (slot, w) => {
      clearSlot(slot);
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
          transparent: true, // so the Turn can crossfade the slot (opacity 1 = identical to opaque)
        });
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(pl.width, pl.height),
          material
        );
        // Flat (faces the camera) — the lens pass provides cohesive distortion.
        mesh.position.set(pl.x, pl.y, pl.z);
        slot.tierGroups[tierIndex].add(mesh);

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
        slot.tiles.push(rec);

        const src = tileSrc(tile);
        if (!src) return;
        loader.load(
          src,
          (texture) => {
            if (disposed || !slot.tiles.includes(rec)) {
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

    // ── World Turn — the two Worlds roll as one rigid pair ──
    // One eased progress `e` (the CustomEase `turnRollEase`) drives everything:
    // the roll, the recede, the lens spike and the crossfade. Because the curve
    // is flat (zero velocity) at both ends, every effect keyed off `e` glides
    // into rest with it — no separate easing/window per effect.
    let turnTween = null;

    // Settle any in-flight Turn to its end state (slots swapped, outgoing cleared).
    const finishTurnInstant = () => {
      const tw = turnTween;
      if (!tw) return;
      tw.progress(1); // fires onComplete: swaps slots + clears the outgoing one
      tw.kill();
    };

    const goToWorld = (w, direction) => {
      // direction: +1 forward (roll up/out top), -1 back (roll down/out bottom),
      // 0 = initial/instant. Reduced motion always swaps instantly.
      if (!currentSlug || direction === 0 || PREFERS_REDUCED_MOTION || !w) {
        finishTurnInstant();
        buildSlot(activeSlot, w);
        activeSlot.pivot.rotation.x = 0;
        activeSlot.pivot.position.z = 0;
        setSlotOpacity(activeSlot, 1);
        lensSpike.v = 0;
        applyLens();
        currentSlug = w?.slug ?? null;
        return;
      }

      finishTurnInstant(); // collapse a prior Turn before starting a new one

      const outgoing = activeSlot;
      const incoming = idleSlot;
      buildSlot(incoming, w);

      // Both pivots rotate the same direction, kept a fixed angle apart, so the
      // field reads as one continuous roll: outgoing center→off, incoming off→center.
      const s = direction > 0 ? 1 : -1; // forward rolls up (+), back rolls down (−)
      incoming.pivot.rotation.x = -s * TURN_ENTER_ANGLE; // staged off-center
      incoming.pivot.position.z = 0;
      setSlotOpacity(incoming, 0);
      setSlotOpacity(outgoing, 1);

      // `e` is the eased progress (the tween applies turnRollEase), so the roll
      // and the recede/lens pulse all ride the same curve and settle with it.
      const apply = (e) => {
        outgoing.pivot.rotation.x = s * TURN_EXIT_ANGLE * e;
        incoming.pivot.rotation.x = -s * TURN_ENTER_ANGLE * (1 - e);
        // There-and-back pulse for depth + distortion. Keyed off the eased `e`
        // (not raw time), so it inherits the curve's zero-velocity ends → glides
        // into rest with the roll instead of cutting off (the old abrupt stop).
        const pulse = Math.sin(Math.PI * e); // 0→1→0
        const z = -TURN_RECEDE * pulse;
        outgoing.pivot.position.z = z;
        incoming.pivot.position.z = z;
        lensSpike.v = pulse;
        applyLens();
        // Crossfade follows the roll so the leaving World dims as it rolls away.
        setSlotOpacity(outgoing, 1 - smoothstep(0.4, 0.95, e));
        setSlotOpacity(incoming, smoothstep(0.05, 0.6, e));
      };

      const prog = { p: 0 };
      turnTween = gsap.to(prog, {
        p: 1,
        duration: TURN_DURATION,
        ease: turnRollEase, // the CustomEase shapes the whole gesture
        onUpdate: () => apply(prog.p),
        onComplete: () => {
          clearSlot(outgoing);
          outgoing.pivot.rotation.x = 0;
          outgoing.pivot.position.z = 0;
          lensSpike.v = 0;
          applyLens();
          activeSlot = incoming;
          idleSlot = outgoing;
          currentSlug = w.slug;
          turnTween = null;
        },
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

    const applyParallax = (slot) => {
      for (let i = 0; i < slot.tierGroups.length; i++) {
        const amp = PARALLAX * tierGain[i];
        slot.tierGroups[i].position.set(eased.x * amp, -eased.y * amp, 0);
      }
      // Per-tile micro-drift — subtle individual motion on one seeded axis.
      for (const t of slot.tiles) {
        if (t.driftAxis === 'x') {
          t.mesh.position.x = t.baseX + eased.x * t.driftSign * t.driftAmp;
        } else {
          t.mesh.position.y = t.baseY + eased.y * t.driftSign * t.driftAmp;
        }
      }
    };

    // ── Render loop (gsap.ticker, internally FPS-gated; shared with SiteShell) ──
    let accumulated = 0;
    const tick = (_t, deltaMs) => {
      accumulated += deltaMs / 1000;
      if (accumulated < 1 / FPS_CAP) return;
      accumulated = 0;

      eased.x += (target.x - eased.x) * PARALLAX_LERP;
      eased.y += (target.y - eased.y) * PARALLAX_LERP;

      // Base layer: the World Shell / grid moves the least.
      shell.position.set(eased.x * PARALLAX, -eased.y * PARALLAX, 0);
      // Both slots get parallax (idle is empty outside a Turn — negligible).
      applyParallax(slotA);
      applyParallax(slotB);

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

    apiRef.current = { goToWorld };

    return () => {
      disposed = true;
      apiRef.current = null;
      finishTurnInstant();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      if (tickerActive) gsap.ticker.remove(tick);
      clearSlot(slotA);
      clearSlot(slotB);
      scene.remove(slotA.pivot);
      scene.remove(slotB.pivot);
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

  // ── Drive the World Turn when the active World changes ──
  useEffect(() => {
    if (!apiRef.current) return;
    const prev = prevIndexRef.current;
    const direction = prev == null ? 0 : Math.sign(index - prev);
    prevIndexRef.current = index;
    apiRef.current.goToWorld(world, direction);
  }, [world?.slug, index]);
}
