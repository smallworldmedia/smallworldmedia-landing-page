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
 * Live-video Near tier: WorldLiveScheduler promotes Near (tier 0) Tiles into
 * the VideoSlotPool's HLS slots at ~2Hz; each live Tile carries a video overlay
 * plane parented to its mesh, whose opacity is composited per frame here
 * (liveMix × appear-fade × slot crossfade). A World Turn suspends everything
 * back to stills — the Turn is the incoming World's still-preload window.
 *
 * @param {React.RefObject<HTMLElement>} containerRef
 * @param {Object|null} world - the active World ({ slug, showcase: [...] })
 * @param {number} index - the active World's index (drives Turn direction)
 * @param {React.RefObject} poolRef - VideoSlotPool imperative handle (live tier)
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
import { createWorldBand } from './worldBands.js';
import WorldLiveScheduler from './worldLive.js';
import {
  CAMERA_FOV,
  DPR_MAX,
  FPS_CAP,
  MAX_TILES,
  MIN_TILES,
  THUMB_SIZE,
  DEPTH_TIERS,
  SHELL_RADIUS,
  SHELL_LINE_COLOR,
  PARALLAX,
  PARALLAX_LERP,
  TILE_FALLBACK_COLOR,
  TILE_SPAWN_FRAC,
  TILE_SPAWN_SCALE,
  TILE_APPEAR_DURATION,
  TILE_APPEAR_FADE,
  LENS_DISTORTION_X,
  LENS_DISTORTION_Y,
  TURN_DURATION,
  TURN_EXIT_ANGLE,
  TURN_ENTER_ANGLE,
  TURN_LENS_SPIKE,
  TURN_RECEDE,
  TURN_EASE_PATH,
  SHELL_SPIN,
  WORLD_MAX_LIVE,
  BANDS_ENABLED,
  BAND_TIER,
  BAND_TUNABLES,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

// Half-angle tangent of the camera's vertical FOV — maps a depth to the
// visible half-height there, so the band can be pinned to a quadrant fraction.
const BAND_TAN_V = Math.tan((CAMERA_FOV * Math.PI) / 360);

// S2: how far to dim a project accent when it tints the background grid, so a
// bright accent (e.g. lime) stays a faint field rather than a glaring wall.
const GRID_TINT_DIM = 0.6;

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

export default function useWorldScene(containerRef, world, index, poolRef) {
  const apiRef = useRef(null);
  const prevIndexRef = useRef(null);
  const shellRef = useRef(null);

  // ── Setup: renderer / composer / scene / camera / shell / loop (mount once) ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    let disposed = false;

    // Transparent canvas: the black→blue gradient lives on the DOM (.fp-canvas)
    // so it stays clean/monotonic like the home hero (the lens pass would warp a
    // WebGL background). The grid + tiles composite over it.
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, DPR_MAX));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
    camera.position.set(0, 0, 0);

    const shell = buildShell();
    scene.add(shell);
    shellRef.current = shell;

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
      // opacity = crossfade multiplier for the whole slot (the Turn drives it);
      // each Tile's own load-in `appear` (0..1) multiplies on top of it.
      // tiles: { mesh, texture, tierIndex, baseX, baseY, appear, drift* }
      // bands: composite deck/album bodies (worldBands.js records)
      return { pivot, tierGroups, tiles: [], bands: [], opacity: 1 };
    };
    const slotA = makeSlot();
    const slotB = makeSlot();
    let activeSlot = slotA;
    let idleSlot = slotB;
    let currentSlug = null;
    // Projects whose push-out reveal has already played. The push-out is a
    // per-project *first-view* reveal, not tied to texture-load timing: a World
    // seen before just snaps its tiles to rest (revisits don't re-animate).
    const seenWorlds = new Set();

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

    // Live-video Near tier — same eligibility rule as the globe: no pool under
    // reduced motion (stills only), and ?live=0 turns the tier off entirely.
    // The scheduler holds the ref, not the handle: the pool mounts a render
    // after hydration (see WorldScene) and updates no-op until it exists.
    const scheduler =
      poolRef && WORLD_MAX_LIVE > 0 && !PREFERS_REDUCED_MOTION
        ? new WorldLiveScheduler(poolRef)
        : null;
    if (scheduler && new URLSearchParams(window.location.search).has('debug')) {
      window.__worldLiveStats = () => scheduler.getStats();
    }
    if (new URLSearchParams(window.location.search).has('debug')) {
      window.__worldBandStats = () =>
        [slotA, slotB].map((s) =>
          s.bands.map((b) => ({
            phase: Number(b.phase.toFixed(2)),
            appear: Number(b.appear.toFixed(2)),
            planes: b.group.children.length,
            visible: b.group.children.filter((m) => m.visible).length,
          }))
        );
    }

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();

    // Slot-level crossfade multiplier (final tile opacity = appear × slot.opacity,
    // composited every frame in applyParallax).
    const setSlotOpacity = (slot, o) => {
      slot.opacity = o;
    };

    const clearSlot = (slot) => {
      for (const t of slot.tiles) {
        gsap.killTweensOf(t); // stop any in-flight appear/push-out
        scheduler?.freeTile(t, { releasePool: true }); // overlay + pool slot, if live
        slot.tierGroups[t.tierIndex].remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        if (t.texture) t.texture.dispose();
      }
      slot.tiles = [];
      for (const b of slot.bands) b.dispose();
      slot.bands = [];
    };

    // Build a World's Tiles into a slot (replacing whatever it held).
    const buildSlot = (slot, w) => {
      clearSlot(slot);
      const pool = w?.showcase || [];
      if (!pool.length) return;
      // First time this World is shown → its tiles push out from center; on any
      // later visit they just resolve at rest (no re-run of the reveal).
      const firstView = w?.slug != null && !seenWorlds.has(w.slug);
      if (w?.slug != null) seenWorlds.add(w.slug);
      // Cycle the available showcase up to a minimum density so sparse
      // Worlds still fill the field (the globe's autoFill convention).
      const count = Math.min(MAX_TILES, Math.max(MIN_TILES, pool.length));
      const chosen = Array.from({ length: count }, (_, i) => pool[i % pool.length]);
      // Composite bands (deck / album stacks) claim seeded positions in the
      // same field so tiles space around them; their depth is pinned to the
      // band tier afterwards.
      const bandDefs = BANDS_ENABLED
        ? [
            w?.brandDecks?.length && {
              items: w.brandDecks,
              ratio: w.brandDecks[0].ratio || 16 / 9,
            },
            w?.albumArt?.length && {
              items: w.albumArt,
              ratio: w.albumArt[0].ratio || 1,
            },
          ].filter(Boolean)
        : [];
      const placements = placeTiles(
        [...chosen, ...bandDefs.map((b) => ({ ratio: b.ratio }))],
        {
          seed: w.slug,
          aspect: camera.aspect || 1,
        }
      );

      chosen.forEach((tile, i) => {
        const pl = placements[i];
        const tierIndex = i % DEPTH_TIERS.length;
        const material = new THREE.MeshBasicMaterial({
          color: TILE_FALLBACK_COLOR,
          toneMapped: false,
          transparent: true, // so the Turn can crossfade the slot (opacity 1 = identical to opaque)
          opacity: 0, // load-gated: stays hidden until its texture arrives (no blank tile)
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
          appear: 0, // 0 = hidden at spawn (near center) → 1 = visible at rest
          driftAxis: pl.driftAxis,
          driftSign: pl.driftSign,
          driftAmp: pl.driftAmp,
          // Live tier (WorldLiveScheduler-managed; Near tier only)
          playbackId: tile.playbackId || null,
          liveState: null,
          liveMix: 0, // 0 = still → 1 = video overlay fully up
          liveSlot: null,
          liveSince: 0,
          lastLiveAt: 0, // round-robin recency for slot rotation
          videoMesh: null,
          videoTexture: null,
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
            // First-view → play the push-out (from near-center to rest on the
            // Turn F-curve; applyParallax reads rec.appear each frame). Revisit
            // or reduced-motion → resolve at rest with no travel.
            if (firstView && !PREFERS_REDUCED_MOTION) {
              rec.appear = 0;
              gsap.to(rec, {
                appear: 1,
                duration: TILE_APPEAR_DURATION,
                ease: turnRollEase,
                overwrite: true,
              });
            } else {
              rec.appear = 1;
            }
          },
          undefined,
          () => { } // failed load → tile stays hidden (appear 0)
        );
      });

      // Composite bands — pinned to the band tier. FP2: the deck is FORCED into
      // the TOP-RIGHT quadrant (+x right, +y up) rather than its seeded slot, so
      // it lands consistently clear of the header/nav for any project. The
      // anchor (half-extents × BAND_TUNABLES.pos*) is re-read live in
      // applyParallax so the debug panel can nudge the placement without a rebuild.
      bandDefs.forEach((def, j) => {
        const z = DEPTH_TIERS[BAND_TIER] + (j === 0 ? -0.18 : 0.18);
        const halfH = Math.abs(z) * BAND_TAN_V;
        const halfW = halfH * (camera.aspect || 1);
        // A second band tucks inboard so two decks (deck + album) don't overlap.
        const inboard = j === 0 ? 1 : 0.6;
        const anchorW = halfW * inboard;
        const band = createWorldBand({
          items: def.items,
          ratio: def.ratio,
          placement: {
            x: anchorW * BAND_TUNABLES.posX,
            y: halfH * BAND_TUNABLES.posY,
            z,
          },
          parent: slot.tierGroups[BAND_TIER],
          loader,
          ease: turnRollEase,
          tune: BAND_TUNABLES,
        });
        // Half-extents kept so applyParallax can re-derive the rest position
        // from the live pos* tunables each frame (top-right quadrant nudging).
        band.anchorW = anchorW;
        band.anchorH = halfH;
        slot.bands.push(band);
        if (firstView && !PREFERS_REDUCED_MOTION) {
          gsap.to(band, {
            appear: 1,
            duration: TILE_APPEAR_DURATION,
            ease: turnRollEase,
            overwrite: true,
          });
        } else {
          band.appear = 1;
        }
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
        if (scheduler) {
          scheduler.attach(activeSlot.tiles);
          schedClock = 1; // next frame runs a scheduler beat immediately
        }
        return;
      }

      finishTurnInstant(); // collapse a prior Turn before starting a new one

      // Live video suspends to stills for the Turn: overlays fade fast and
      // free their HLS slots, so the incoming World's stills own the network.
      scheduler?.suspend();

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
          // Turn settled → the new World's Near tier may go live again. Its
          // stills preloaded during the Turn, so promote on the next frame.
          if (scheduler) {
            scheduler.attach(incoming.tiles);
            schedClock = 1;
          }
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
      // Per tile: lerp spawn(near-center) → rest(+drift) by `appear`, scale up
      // out of the center, and composite its load-in over the slot crossfade.
      for (const t of slot.tiles) {
        const k = t.appear;
        // resting position incl. the subtle per-tile micro-drift on one seeded axis
        let restX = t.baseX;
        let restY = t.baseY;
        if (t.driftAxis === 'x') restX += eased.x * t.driftSign * t.driftAmp;
        else restY += eased.y * t.driftSign * t.driftAmp;
        const spawnX = t.baseX * TILE_SPAWN_FRAC;
        const spawnY = t.baseY * TILE_SPAWN_FRAC;
        t.mesh.position.x = spawnX + (restX - spawnX) * k;
        t.mesh.position.y = spawnY + (restY - spawnY) * k;
        t.mesh.scale.setScalar(TILE_SPAWN_SCALE + (1 - TILE_SPAWN_SCALE) * k);
        // Opacity ramps to full over the first TILE_APPEAR_FADE of the push-out,
        // then holds while it settles; multiplied by the slot's Turn crossfade.
        const fade = TILE_APPEAR_FADE > 0 ? Math.min(1, k / TILE_APPEAR_FADE) : 1;
        t.mesh.material.opacity = fade * slot.opacity;
        // Live overlay rides the same composite, scaled by its own crossfade.
        if (t.videoMesh) t.videoMesh.material.opacity = t.liveMix * fade * slot.opacity;
      }
      // Composite bands: same spawn→rest push-out and load-fade compositing
      // as a Tile, applied to the whole body; page poses come from the band.
      for (const b of slot.bands) {
        // FP2/FP1: re-anchor to the live top-right placement each frame so the
        // panel's deck-position sliders move the deck without a rebuild.
        if (b.anchorW != null) {
          b.baseX = b.anchorW * BAND_TUNABLES.posX;
          b.baseY = b.anchorH * BAND_TUNABLES.posY;
        }
        const k = b.appear;
        b.group.position.x = b.baseX * TILE_SPAWN_FRAC + b.baseX * (1 - TILE_SPAWN_FRAC) * k;
        b.group.position.y = b.baseY * TILE_SPAWN_FRAC + b.baseY * (1 - TILE_SPAWN_FRAC) * k;
        b.group.scale.setScalar(TILE_SPAWN_SCALE + (1 - TILE_SPAWN_SCALE) * k);
        const fade = TILE_APPEAR_FADE > 0 ? Math.min(1, k / TILE_APPEAR_FADE) : 1;
        b.paint(fade * slot.opacity);
      }
    };

    // ── Render loop (gsap.ticker, internally FPS-gated; shared with SiteShell) ──
    let accumulated = 0;
    let sceneTime = 0; // for the scheduler's dwell clocks
    let schedClock = 0; // ~2Hz live-tier cadence, globe convention
    const tick = (_t, deltaMs) => {
      accumulated += deltaMs / 1000;
      if (accumulated < 1 / FPS_CAP) return;
      const dt = accumulated; // seconds since last render (for time-based motion)
      accumulated = 0;
      sceneTime += dt;

      if (scheduler) {
        schedClock += dt;
        if (schedClock >= 0.5) {
          scheduler.update(sceneTime);
          schedClock = 0;
        }
      }

      eased.x += (target.x - eased.x) * PARALLAX_LERP;
      eased.y += (target.y - eased.y) * PARALLAX_LERP;

      // Base layer: the World Shell / grid moves the least; a slow Y-spin drifts
      // the grid lines left→right.
      if (!PREFERS_REDUCED_MOTION) shell.rotation.y += SHELL_SPIN * dt;
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
        if (scheduler) poolRef.current?.resumeAll();
      } else if (!run && tickerActive) {
        gsap.ticker.remove(tick);
        tickerActive = false;
        if (scheduler) poolRef.current?.pauseAll(); // no decode while not rendering
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
      scheduler?.dispose();
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
    // S2: the background grid ingests the focused project's accent (dimmed to
    // keep the lat/long lines a faint field rather than a bright wall); a
    // colourless project restores the default deep-blue grid.
    const shell = shellRef.current;
    if (shell) {
      const target = new THREE.Color(world?.projectColor || SHELL_LINE_COLOR);
      if (world?.projectColor) target.multiplyScalar(GRID_TINT_DIM);
      // Cross-fade the grid to the focused accent on the SAME house curve +
      // duration as the World Turn, so the field recolours as the roll plays.
      gsap.to(shell.material.color, {
        r: target.r,
        g: target.g,
        b: target.b,
        duration: TURN_DURATION,
        ease: turnRollEase,
        overwrite: true,
      });
    }
  }, [world?.slug, index]);
}
