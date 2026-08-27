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
import { ENTER_TUNABLES, powInOut, seg } from './enterTune.js';
import { buildAtlasSlot, applyAtlasSlot, ORDER_SHELL } from './fpAtlas.js';
import {
  createFormeLattice,
  buildFormeSlot,
  applyFormeSlot,
  formeTurnApply,
  PANE_DRIFT,
  PP_DRIFT,
  BREATHE,
} from './fpForme.js';
import { createDrum, buildDrumSlot } from './fpDrum.js';
import {
  FPGRID,
  CAM_LOOK,
  ARC_DEG,
  DRUM_TURN_MUL,
  DRUM_CREEP,
  CAMERA_FOV,
  DPR_MAX,
  MSAA_SAMPLES,
  FPS_CAP,
  MAX_TILES,
  MIN_TILES,
  thumbForCount,
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
  FANOUT_STAGGER,
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
  WORLD_MAX_VIDEO_TILES,
  BANDS_ENABLED,
  BAND_TIER,
  BAND_TUNABLES,
  BAND_HEIGHT,
  BAND_MAX_PAGES,
  TILE_HEIGHT,
  SCATTER_FRAC,
  FIELD_OFFSET_Y,
  FIELD_SPREAD_X,
  FIELD_SPREAD_Y,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';
import {
  FAN_X,
  FAN_Y,
  FAN_FALLOFF,
  FAN_DEPTH,
  PILE_X,
  PILE_Y,
  PILE_FALLOFF,
  SHOW_LIFT,
  REF_PAGE_W,
  pageFitScale,
} from '../bandLayout.js';

// Half-angle tangent of the camera's vertical FOV — maps a depth to the
// visible half-height there, so the band can be pinned to a quadrant fraction.
const BAND_TAN_V = Math.tan((CAMERA_FOV * Math.PI) / 360);

// Converging cumulative offset (step, step·r, step·r², …) — bandLayout's `cum`,
// re-derived here (it isn't exported) to size the band keep-out footprints.
const cumSpread = (step, r, n) =>
  n > 0 ? (step * (1 - Math.pow(r, n))) / (1 - r) : 0;

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

const tileSrc = (t, thumb) =>
  t.playbackId
    ? `https://image.mux.com/${t.playbackId}/thumbnail.webp?width=${thumb}` // native aspect (no forced square crop)
    : t.imageUrl
      ? `${t.imageUrl}?w=${thumb}&auto=format&fit=max`
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
  const formeLatticeRef = useRef(null); // FORME pane lattice material (S2 tint)

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
    // fp-grid: page wipes (register plates / FORME re-deal) cut with world-space
    // clipping planes — material-agnostic, so video overlays keep their built-in
    // sRGB decode. Enabling costs nothing while no material carries planes.
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
    camera.position.set(0, 0, 0);

    const shell = buildShell();
    // fp-grid: everything in the scene is transparent AND sphere-centered, so
    // the painter sort (keyed on object world position ≈ origin for all of it)
    // is arbitrary — draw order must be explicit. The shell draws AFTER the
    // plates (media sits beyond it, "pressed under glass"); accent borders,
    // just inside the shell, draw last and win their shared cell lines.
    if (FPGRID > 0) shell.renderOrder = ORDER_SHELL;
    scene.add(shell);
    shellRef.current = shell;

    // FORME: the pane lattice is scene-level and NEVER re-deals; the true
    // shell dims into deep atmosphere behind it.
    let formeStatics = null;
    if (FPGRID === 2) {
      const w0 = container.clientWidth || 1;
      const h0 = container.clientHeight || 1;
      formeStatics = createFormeLattice(scene, w0 / h0);
      formeLatticeRef.current = formeStatics.material;
      shell.material.opacity = shell.material.opacity * 0.45;
    }

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
    // ATLAS: tiny per-slot radius bias so two Worlds' plates are never coplanar
    // while both are up during a Turn (the Z_JITTER doctrine, radially).
    slotA.atlasBias = 0;
    slotB.atlasBias = 0.03;
    let activeSlot = slotA;
    let idleSlot = slotB;

    // DRUM: shell + both slot pivots fuse into one rigid revolving body;
    // the Turn rotates the roll group to ABSOLUTE index × ARC_DEG targets
    // (idle creep, when Nathan turns it on, is absorbed by the next Turn).
    let drum = null;
    let drumAdv = 0; // settled advance, degrees (index × ARC_DEG)
    if (FPGRID === 3) {
      drum = createDrum(scene, shell);
      drum.body.add(slotA.pivot);
      drum.body.add(slotB.pivot);
    }
    let currentSlug = null;
    // Projects whose push-out reveal has already played. The push-out is a
    // per-project *first-view* reveal, not tied to texture-load timing: a World
    // seen before just snaps its tiles to rest (revisits don't re-animate).
    const seenWorlds = new Set();

    // Post-processing: scene → lens distortion → sRGB output.
    // 08-25 AA: the composer's internal targets bypass the context's MSAA
    // (`antialias: true` on the renderer only covers direct-to-canvas), so
    // the tile grid rendered with hard jaggies. A multisampled target
    // (WebGL2) restores 4× MSAA through the whole pass chain; setSize
    // resizes it in place, samples preserved. ?msaa to A/B (0 = off).
    const msaaTarget = new THREE.WebGLRenderTarget(1, 1, {
      samples: MSAA_SAMPLES,
      type: THREE.HalfFloatType,
    });
    const composer = new EffectComposer(renderer, msaaTarget);
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
    // Enter-the-World lens channel (0..1) — a second additive term, driven
    // only by the enter_world commit (see the 'swm:enter-world' listener
    // below). ENTER_TUNABLES.lens is NEGATIVE: the ramp DEEPENS the base
    // inside-a-sphere pull. (The retired +ENTER_LENS_SWELL crossed zero into
    // an outward barrel bow + shrink — the 08-25 "bowing outward" bug.)
    const enterRamp = { v: 0 };
    const applyLens = () => {
      lensPass.distortion.x =
        LENS_DISTORTION_X + TURN_LENS_SPIKE * lensSpike.v + ENTER_TUNABLES.lens * enterRamp.v;
      lensPass.distortion.y =
        LENS_DISTORTION_Y +
        TURN_LENS_SPIKE * 1.1 * lensSpike.v +
        ENTER_TUNABLES.lens * 1.1 * enterRamp.v;
    };

    // ── Enter-the-World ramp — "zooming further into the world" (08-25 rework) ──
    // On enter_world commit, WorldCard dispatches 'swm:enter-world' (same
    // detail as its 'swm:envelop': { duration, color }). The scene answers
    // with the commit-choreography model (Hero.beginEnvelopment, 08-25): ONE
    // linear master progress; each channel rides its own [start, end] window
    // shaped by powInOut(ENTER_TUNABLES.pow) — smooth both ends, no overshoot:
    //   · LENS over [lensStart, lensEnd] — the distortion deepen above, so the
    //     curvature intensifies (further inside the sphere), and
    //   · MOVE over [moveStart, moveEnd] — camera dolly toward the tiles
    //     (`dolly` world units) + projection zoom 1→`scale`, scaling the WHOLE
    //     frame (shell grid included) UP in sync with the deepening lens,
    // one gesture under the rising color cover. ENTER_TUNABLES is read fresh
    // every update, so the ?entertune=1 bench moves the next run live.
    // detail.dryRun (the bench's ▶): hold at full ramp, then unwind to rest —
    // a real commit never unwinds (the scene unmounts on arrival at the
    // detail route, ADR-0002). Reduced motion: WorldCard never dispatches, and
    // the guard here keeps a stray dispatch from moving the camera.
    let enterTween = null;
    const enterProg = { p: 0 }; // the linear master (channels window it)
    const applyEnter = () => {
      const t = ENTER_TUNABLES;
      enterRamp.v = powInOut(seg(enterProg.p, t.lensStart, t.lensEnd), t.pow);
      const move = powInOut(seg(enterProg.p, t.moveStart, t.moveEnd), t.pow);
      camera.position.z = -t.dolly * move; // toward −Z (the tiles)
      camera.zoom = 1 + (Math.max(0.05, t.scale) - 1) * move;
      camera.updateProjectionMatrix();
      applyLens();
    };
    const onEnterWorld = (e) => {
      if (PREFERS_REDUCED_MOTION) return; // plain cover, no ramp
      enterTween?.kill();
      enterTween = gsap.to(enterProg, {
        p: 1,
        duration: e?.detail?.duration ?? ENTER_TUNABLES.enterMs / 1000,
        ease: 'none', // linear master — the channels carry the curve
        onUpdate: applyEnter,
        onComplete: e?.detail?.dryRun
          ? () => {
              // Bench rehearsal: hold the arrived frame, then unwind so the
              // next ▶ starts from rest (Hero's dry-run return convention).
              enterTween = gsap.to(enterProg, {
                p: 0,
                duration: 0.6,
                delay: ENTER_TUNABLES.holdMs / 1000,
                ease: 'expo.out',
                onUpdate: applyEnter,
              });
            }
          : undefined,
      });
    };
    window.addEventListener('swm:enter-world', onEnterWorld);

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
      // Invalidate any in-flight staggered build: deferred batches captured
      // the old generation and abort instead of populating a cleared slot.
      slot.buildGen = (slot.buildGen || 0) + 1;
      for (const t of slot.tiles) {
        gsap.killTweensOf(t); // stop any in-flight appear/push-out
        scheduler?.freeTile(t, { releasePool: true }); // overlay + pool slot, if live
        slot.tierGroups[t.tierIndex].remove(t.mesh);
        t.mesh.geometry.dispose();
        t.mesh.material.dispose();
        if (t.texture) t.texture.dispose();
        t.extraDispose?.(); // fp-grid extras (accent border geometry/material)
      }
      slot.tiles = [];
      for (const b of slot.bands) b.dispose();
      slot.bands = [];
    };

    // Build a World's Tiles into a slot (replacing whatever it held).
    const buildSlot = (slot, w) => {
      clearSlot(slot);
      // First time this World is shown → its tiles push out from center; on any
      // later visit they just resolve at rest (no re-run of the reveal).
      const firstView = w?.slug != null && !seenWorlds.has(w.slug);
      if (w?.slug != null) seenWorlds.add(w.slug);
      // fp-grid mode 1 (ATLAS): media as on-sphere plates locked into the
      // graticule's cells — composition, appear, and register plates live in
      // fpAtlas.js; records stay scheduler/clearSlot-compatible.
      if (FPGRID > 0) {
        const ctx = {
          camera,
          loader,
          firstView,
          ease: turnRollEase,
          isStale: () => disposed,
        };
        if (FPGRID === 1) buildAtlasSlot(slot, w, ctx);
        else if (FPGRID === 2) buildFormeSlot(slot, w, ctx);
        else
          buildDrumSlot(slot, w, {
            ...ctx,
            arcOffsetDeg: slot.drumArcOffset || 0,
            drum,
          });
        return;
      }
      const pool = w?.showcase || [];
      if (!pool.length) return;
      // Cycle the available showcase up to a minimum density so sparse
      // Worlds still fill the field (the globe's autoFill convention).
      const count = Math.min(MAX_TILES, Math.max(MIN_TILES, pool.length));
      // Video-first: promote up to the live budget of video assets to the front
      // (Near) tier so every loaded video actually plays — no posters frozen on a
      // non-live tile. Image assets fill the rest of the field on the back tiers.
      const videoPool = pool.filter((a) => a.playbackId);
      const stillPool = pool.filter((a) => !a.playbackId && a.imageUrl);
      const videoCount = Math.min(videoPool.length, WORLD_MAX_VIDEO_TILES, count);
      const stillNeed = count - videoCount;
      const stillTiles = stillPool.length
        ? Array.from({ length: stillNeed }, (_, j) => stillPool[j % stillPool.length])
        : []; // no stills → don't pad the field with frozen video posters
      const chosen = [...videoPool.slice(0, videoCount), ...stillTiles];
      // Tier per tile: videos → Near (0, live-eligible + prominent); stills →
      // Mid/Far. A video-less World keeps the original all-tier spread.
      const tierOf = (i) =>
        videoCount > 0
          ? i < videoCount
            ? 0
            : 1 + ((i - videoCount) % 2)
          : i % DEPTH_TIERS.length;
      // Thumbnail size scales inverse to field density — fewer tiles → bigger thumb.
      const thumb = thumbForCount(chosen.length);
      // Composite bands (deck / album stacks) are FORCED to the top-right
      // quadrant (see the creation block below), so instead of claiming seeded
      // slots they hand placeTiles rectangular keep-outs over their REAL
      // footprints — tiles space around where the deck actually sits.
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
      // Per-band anchor geometry, hoisted so the keep-out rects here and the
      // band creation block (bandDefs.forEach below) derive from the SAME values.
      const bandGeom = bandDefs.map((def, j) => {
        const z = DEPTH_TIERS[BAND_TIER] + (j === 0 ? -0.18 : 0.18);
        const halfH = Math.abs(z) * BAND_TAN_V;
        const halfW = halfH * (camera.aspect || 1);
        // A second band tucks inboard so two decks (deck + album) don't overlap.
        const inboard = j === 0 ? 1 : 0.6;
        return { z, halfH, halfW, anchorW: halfW * inboard };
      });
      // Keep-out rects: each band's world footprint (front page + fan/pile
      // spread around the forced anchor) mapped into the seeded layout's
      // normalized centers frame. BAND_TUNABLES is read at BUILD time — live
      // ?bandx/?bandy (posX/posY) nudges re-key the rect on the next
      // buildSlot, not per frame.
      const excludeRects = bandDefs.map((def, j) => {
        const g = bandGeom[j];
        // Anchor — same derivation the band creation block uses.
        const bx = g.anchorW * BAND_TUNABLES.posX;
        const by = g.halfH * BAND_TUNABLES.posY;
        // Band body: up to BAND_MAX_PAGES pages fit in a BAND_HEIGHT square,
        // area-normalized by ratio (worldBands sizing — pageFitScale shrinks
        // squarer pages toward the deck page's area), px-tuned stack
        // distances scaled by unit.
        const fitScale = pageFitScale(def.ratio, BAND_TUNABLES.albumScale);
        const pageW =
          (def.ratio >= 1 ? BAND_HEIGHT : BAND_HEIGHT * def.ratio) * fitScale;
        const pageH =
          (def.ratio >= 1 ? BAND_HEIGHT / def.ratio : BAND_HEIGHT) * fitScale;
        const unit = pageW / REF_PAGE_W;
        const tune = BAND_TUNABLES;
        const fanX = FAN_X * unit * tune.spacingMul * tune.fanMul;
        const fanY = FAN_Y * unit * tune.spacingMul * tune.fanMul;
        const pileX = PILE_X * unit * tune.spacingMul * tune.pileMul;
        const pileY = PILE_Y * unit * tune.spacingMul * tune.pileMul;
        const homeX = tune.homeX * pageW; // front-card anchor, left of group origin
        const n = Math.min(def.items.length, BAND_MAX_PAGES);
        const fanDepth = Math.min(n - 1, FAN_DEPTH); // visible waiting-fan depth
        const parkDepth = Math.max(0, n - 2); // settled-pile depth at max phase
        // In-plane reach of each stack from the group origin (bandPose
        // extremes): the fan spreads +x/right of homeX and drifts down; the
        // pile tucks −x/left past homeX and drifts up (+ the SHOW_LIFT arc).
        const fanReach = cumSpread(fanX, FAN_FALLOFF, fanDepth);
        const pileReach =
          n > 1 ? pileX + cumSpread(pileX, PILE_FALLOFF, parkDepth) : 0;
        const fanDrop = cumSpread(fanY, FAN_FALLOFF, fanDepth);
        const pileRise =
          (n > 1 ? pileY + cumSpread(pileY, PILE_FALLOFF, parkDepth) : 0) +
          SHOW_LIFT * unit;
        // X extents are asymmetric (pile-heavy left; homeX pre-tucks the fan
        // right), so center the rect on the TRUE span rather than a symmetric
        // max about the anchor — a symmetric rect over-reached ~0.4 world on
        // the right, which displaced tiles paid for. Both sides + half a
        // TILE_HEIGHT tile (the rect excludes tile CENTERS, but tiles have
        // size); ~10% margin on the half-span.
        const rightW = pageW / 2 + homeX + fanReach + TILE_HEIGHT / 2;
        const leftW = pageW / 2 - homeX + pileReach + TILE_HEIGHT / 2;
        const cxW = bx + (rightW - leftW) / 2;
        const halfXw = ((rightW + leftW) / 2) * 1.1;
        const halfYw =
          (pageH / 2 + Math.max(fanDrop, pileRise) + TILE_HEIGHT / 2) * 1.1;
        // World → normalized centers frame: invert seededLayout's stage-2 map
        //   x = nx·halfW·SCATTER_FRAC·FIELD_SPREAD_X
        //   y = ny·halfH·SCATTER_FRAC·FIELD_SPREAD_Y + FIELD_OFFSET_Y·halfH
        // using the band's own z as the reference depth — tiles at other tiers
        // have slightly different half-extents; the margin above absorbs that.
        const normX = g.halfW * SCATTER_FRAC * FIELD_SPREAD_X;
        const normY = g.halfH * SCATTER_FRAC * FIELD_SPREAD_Y;
        return {
          cx: cxW / normX,
          cy: (by - FIELD_OFFSET_Y * g.halfH) / normY,
          halfX: halfXw / normX,
          halfY: halfYw / normY,
        };
      });
      // Ring-capacity gate: the centers ring holds ~3 displaced tiles clear
      // of ONE rect; two rects exceed it at aspect ≤1.5 (measured — tiles
      // strand inside a band with nowhere left to go). If a World ever ships
      // BOTH bands, only the deck (j=0, the dominant top-right fan) reserves
      // its footprint and the album stack accepts overlap. No production
      // World has both today (audited 2026-07-24).
      if (excludeRects.length > 1) excludeRects.length = 1;
      const placements = placeTiles(chosen, {
        seed: w.slug,
        aspect: camera.aspect || 1,
        tiers: chosen.map((_, i) => tierOf(i)), // matches the input 1:1
        excludeRects,
      });

      // Everything above (composition, placements, keep-outs) is cheap math and
      // stays synchronous. The mesh/material/load churn below is what stacked
      // the Turn's trigger frame, so it's staggered across animation frames.

      // Stale-build guard: clearSlot bumps the slot generation, so a deferred
      // batch from a superseded build (a new Turn / teardown arrived mid-build)
      // aborts instead of adding meshes to a cleared slot (leak + ghost tiles).
      const gen = slot.buildGen;

      // Fan-out reference radius: appear delays scale with resting distance
      // from center so the field blooms inner→outer (masks load jitter).
      let maxR = 0;
      for (const pl of placements) maxR = Math.max(maxR, Math.hypot(pl.x, pl.y));
      // Bloom origin: delays anchor to the BUILD, not each texture's arrival,
      // so a late-loading tile sheds the stagger it already waited out instead
      // of re-paying it (keeps the sequence outward even on cold loads).
      const bloomT0 = performance.now();

      const createTile = (tile, i) => {
        const pl = placements[i];
        const tierIndex = tierOf(i);
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
        // push (never reassign): the live scheduler holds this array reference,
        // so late-created tiles are promotable without a re-attach.
        slot.tiles.push(rec);

        const src = tileSrc(tile, thumb);
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
                // Bloom: inner tiles launch first, outer later — one coherent
                // outward sequence instead of random per-texture pops.
                delay: Math.max(
                  0,
                  FANOUT_STAGGER * (maxR > 0 ? Math.hypot(pl.x, pl.y) / maxR : 0) -
                    (performance.now() - bloomT0) / 1000
                ),
                ease: turnRollEase,
                // Property-scoped on purpose: `true` would kill a concurrent
                // liveMix crossfade on the same rec; nothing else tweens appear.
                overwrite: 'auto',
              });
            } else {
              rec.appear = 1;
            }
          },
          undefined,
          () => { } // failed load → tile stays hidden (appear 0)
        );
      };

      // Composite bands — pinned to the band tier. FP2: the deck is FORCED into
      // the TOP-RIGHT quadrant (+x right, +y up) rather than its seeded slot, so
      // it lands consistently clear of the header/nav for any project. The
      // anchor (half-extents × BAND_TUNABLES.pos*) is re-read live in
      // applyParallax so the debug panel can nudge the placement without a rebuild.
      const createBand = (def, j) => {
        // Anchor geometry hoisted to bandGeom (shared with the keep-out rects).
        const { z, halfH, anchorW } = bandGeom[j];
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
        // push (never reassign) — same identity contract as slot.tiles.
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
      };

      // Bands are the heaviest single items (up to BAND_MAX_PAGES planes +
      // loads each) → each gets a whole frame to itself after the tile batches.
      const scheduleBand = (j) => {
        if (j >= bandDefs.length) return;
        requestAnimationFrame(() => {
          if (disposed || slot.buildGen !== gen) return; // superseded mid-build
          createBand(bandDefs[j], j);
          scheduleBand(j + 1);
        });
      };

      // Build-stagger: the first tile batch runs synchronously so the field is
      // never empty-started; later batches ride successive rAF callbacks. rAF
      // directly (not the FPS_CAP-gated gsap ticker) — build cadence shouldn't
      // wait on render cadence. Tiles are opacity-0 until their texture lands,
      // so the progressive creation is invisible.
      // ≥ the video budget so every Near/video tile is created in the
      // synchronous batch — "videos start first" must survive a ?vtiles bump.
      const TILE_BATCH = Math.max(5, WORLD_MAX_VIDEO_TILES);
      const runBatch = (start) => {
        if (disposed || slot.buildGen !== gen) return; // superseded mid-build
        const end = Math.min(start + TILE_BATCH, chosen.length);
        for (let i = start; i < end; i++) createTile(chosen[i], i);
        if (end < chosen.length) requestAnimationFrame(() => runBatch(end));
        else scheduleBand(0);
      };
      runBatch(0);
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
        // DRUM: reduced-motion paging still advances the absolute drum angle
        // (instantly); the new arc is dressed at the new rest pose.
        if (FPGRID === 3) {
          if (direction) drumAdv += (direction > 0 ? 1 : -1) * ARC_DEG;
          activeSlot.drumArcOffset = -drumAdv;
          if (drum) {
            drum.state.adv = drumAdv;
            drum.applyRoll();
          }
        }
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
      const s = direction > 0 ? 1 : -1; // forward rolls up (+), back rolls down (−)
      // FORME: the incoming build is wave-driven (the re-deal master below),
      // not the first-view appear — flag it before the build.
      if (FPGRID === 2) incoming.formeViaTurn = true;
      // DRUM: the incoming arc dresses one ARC_DEG below (forward) or above
      // (back) — absolute target bookkeeping.
      const drumTarget = FPGRID === 3 ? drumAdv + (direction > 0 ? 1 : -1) * ARC_DEG : 0;
      if (FPGRID === 3) incoming.drumArcOffset = -drumTarget;
      buildSlot(incoming, w);

      let apply;
      if (FPGRID === 3) {
        // ── DRUM conveyor: the whole rigid body (grid + both arcs) rotates
        // to the absolute target on the house curve; the lens spike rides
        // the same master. No crossfade — the travel is physical. The roll
        // itself is applied in tick from drum.state.
        incoming.pivot.rotation.x = 0;
        incoming.pivot.position.z = 0;
        setSlotOpacity(incoming, 1);
        setSlotOpacity(outgoing, 1);
        const startAdv = drum ? drum.state.adv : drumAdv; // absorbs idle creep
        apply = (e) => {
          if (drum) drum.state.adv = startAdv + (drumTarget - startAdv) * e;
          lensSpike.v = Math.sin(Math.PI * e);
          applyLens();
        };
      } else if (FPGRID === 2) {
        // ── FORME re-deal: nothing travels. Pivots stay pinned; a dealloc
        // wavefront sweeps the outgoing blocks (bottom→top going forward),
        // the incoming allocates one beat behind, and the lens spike rides
        // the SAME eased master — finishTurnInstant's progress(1) still
        // lands the exact end state.
        incoming.pivot.rotation.x = 0;
        incoming.pivot.position.z = 0;
        setSlotOpacity(incoming, 1);
        setSlotOpacity(outgoing, 1);
        apply = (e) => {
          lensSpike.v = formeTurnApply(e, outgoing, incoming, s);
          applyLens();
        };
      } else {
        // Both pivots rotate the same direction, kept a fixed angle apart, so the
        // field reads as one continuous roll: outgoing center→off, incoming off→center.
        incoming.pivot.rotation.x = -s * TURN_ENTER_ANGLE; // staged off-center
        incoming.pivot.position.z = 0;
        setSlotOpacity(incoming, 0);
        setSlotOpacity(outgoing, 1);

        // `e` is the eased progress (the tween applies turnRollEase), so the roll
        // and the recede/lens pulse all ride the same curve and settle with it.
        apply = (e) => {
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
      }

      const prog = { p: 0 };
      turnTween = gsap.to(prog, {
        p: 1,
        // DRUM: 120° at the stock 1.7s sweeps ~2× today's apparent Turn
        // speed — the mode stretches the same house curve (?drumturn).
        duration: TURN_DURATION * (FPGRID === 3 ? DRUM_TURN_MUL : 1),
        ease: turnRollEase, // the CustomEase shapes the whole gesture
        onUpdate: () => apply(prog.p),
        onComplete: () => {
          clearSlot(outgoing);
          outgoing.pivot.rotation.x = 0;
          outgoing.pivot.position.z = 0;
          if (FPGRID === 3) {
            drumAdv = drumTarget;
            if (drum) {
              drum.state.adv = drumAdv;
              drum.applyRoll();
            }
          }
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

    // FORME pane parallax state (computed once per tick, world units / UV):
    let paneOX = 0;
    let paneOY = 0;
    let breatheX = 0;
    let breatheY = 0;

    const applyParallax = (slot) => {
      // ATLAS: one rigid body — no tier gains, no drift, no planar travel; the
      // appear is an on-sphere slerp and parallax is the camera's head-turn
      // (applied once in tick). Tier groups stay at rest.
      if (FPGRID === 1 || FPGRID === 3) {
        // DRUM shares ATLAS's composite: slerp appear + opacity + borders —
        // the conveyor motion itself lives on the drum's roll group.
        applyAtlasSlot(slot);
        return;
      }
      // FORME: the pane is one body (translated in tick); records composite
      // their allocation gates + ink breathing here.
      if (FPGRID === 2) {
        applyFormeSlot(slot, paneOY, breatheX, breatheY);
        return;
      }
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
      // the grid lines left→right. (Grid modes: SHELL_SPIN defaults to 0 —
      // cell-locked media may not crawl off.)
      if (!PREFERS_REDUCED_MOTION) shell.rotation.y += SHELL_SPIN * dt;
      if (FPGRID === 1) {
        // ATLAS parallax = the head-turn: a small camera look-around pans grid
        // and plates with ZERO relative slip (everything is camera-centered);
        // signs match the legacy field feel (pointer right → content left,
        // pointer down → content up).
        camera.rotation.y = -eased.x * CAM_LOOK;
        camera.rotation.x = -eased.y * CAM_LOOK;
        shell.position.set(0, 0, 0);
      } else if (FPGRID === 2) {
        // FORME: pane (lattice + both slots) drifts as ONE body over the
        // shell's smaller base drift; the lens principal point leans toward
        // the cursor; images breathe inside their immobile frames.
        paneOX = -eased.x * PANE_DRIFT;
        paneOY = eased.y * PANE_DRIFT;
        breatheX = eased.x * BREATHE;
        breatheY = -eased.y * BREATHE;
        if (formeStatics) formeStatics.lattice.position.set(paneOX, paneOY, 0);
        slotA.pivot.position.x = paneOX;
        slotA.pivot.position.y = paneOY;
        slotB.pivot.position.x = paneOX;
        slotB.pivot.position.y = paneOY;
        lensPass.principalPoint.set(eased.x * PP_DRIFT, -eased.y * PP_DRIFT);
        shell.position.set(eased.x * PARALLAX, -eased.y * PARALLAX, 0);
      } else if (FPGRID === 3) {
        // DRUM: pointer micro-rotates the ENTIRE drum (grid + media, one
        // heavy instrument); idle creep (Nathan's toggle, ?creep deg/s) walks
        // the conveyor when no Turn owns it — the next Turn's absolute
        // target absorbs any drift.
        if (drum) {
          if (DRUM_CREEP && !turnTween && !PREFERS_REDUCED_MOTION)
            drum.state.adv += DRUM_CREEP * dt;
          drum.applyRoll();
          drum.parallax.rotation.y = -eased.x * CAM_LOOK * 0.8;
          drum.parallax.rotation.x = -eased.y * CAM_LOOK * 0.8;
        }
      } else {
        shell.position.set(eased.x * PARALLAX, -eased.y * PARALLAX, 0);
      }
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
      window.removeEventListener('swm:enter-world', onEnterWorld);
      enterTween?.kill();
      if (tickerActive) gsap.ticker.remove(tick);
      scheduler?.dispose();
      clearSlot(slotA);
      clearSlot(slotB);
      scene.remove(slotA.pivot);
      scene.remove(slotB.pivot);
      formeStatics?.dispose();
      formeLatticeRef.current = null;
      drum?.dispose();
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
      // FORME: the pane lattice ingests the same dimmed accent as the shell —
      // the whole page recolours as the re-deal plays.
      if (formeLatticeRef.current) {
        gsap.to(formeLatticeRef.current.color, {
          r: target.r,
          g: target.g,
          b: target.b,
          duration: TURN_DURATION,
          ease: turnRollEase,
          overwrite: true,
        });
      }
    }
  }, [world?.slug, index]);
}
