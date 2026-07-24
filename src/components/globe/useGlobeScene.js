/**
 * useGlobeScene.js — The only place three.js meets React.
 *
 * Owns the renderer/scene/camera, builds the panelized globe, assigns CMS
 * thumbnails, and runs the render loop on gsap.ticker with an internal
 * 60fps gate (FPS_CAP; never gsap.ticker.fps() — the ticker is shared
 * with the persistent SiteShell).
 *
 * Lifecycle: the whole scene rebuilds when assets/gapDeg/capDeg change
 * (lab tuning), and tears down fully on unmount — including
 * forceContextLoss(), so Astro view-transition navigation can't exhaust
 * the browser's WebGL context pool.
 *
 * Home-hero hooks (optional, null-safe — lab passes neither): rigRef gets a
 * { rig, apply } camera-rig handle (fill/fitCover/offset/elevation/zoom
 * framing); overlayRef's .update runs post-render each frame (heroOverlay
 * bridge); the returned api carries setBlueFill alongside replayCascade
 * (the chunk-4 commit's panel-by-panel blue), plus the chunk-5 intro pair:
 * setInk (gap-lattice ink — one white→blue lerp on the inner-sphere
 * material, which IS the lattice showing through the gaps),
 * releaseScheduler (ends a holdEntrance hold) and onLiveChange (chunk-6
 * labels — subscribe to the scheduler's live-panel transitions; the
 * subscription outlives scene rebuilds). holdEntrance (full-intro
 * mounts only, never under RM) keeps the scene in its dark pre-cascade
 * state — no entrance cascade on load (panels build with uPower 0, so the
 * dark panelized sphere + gap lattice reads as the line-art mark at glyph
 * scale) and no LivePanelScheduler promotion (no HLS decodes while the
 * globe is glyph-sized; thumbnails still load normally). The hold ends
 * when the owner fires replayCascade + releaseScheduler. At identity the
 * rig is bit-identical to the old fixed framing — see applyRig.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import buildGlobeGeometry, { buildScrollingGlobeGeometry } from './buildGlobeGeometry.js';
import { createPanelMaterial } from './panelMaterial.js';
import TextureManager, { computeCoverUv } from './TextureManager.js';
import InteractionController from './InteractionController.js';
import LivePanelScheduler from './LivePanelScheduler.js';
import MeridianScroll from './MeridianScroll.js';
import buildCascadeTimeline, { panelDelay } from './cascade.js';
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
  SCROLL_VISIBLE_ROWS,
  SCROLL_LAT_GAP_DEG,
  SCROLL_POLE_CORNER_TIP,
  SCROLL_POLE_CORNER_WIDE,
  SCROLL_POLE_CORNER_START,
  SCROLL_POLE_TIP_LIFT,
  SCROLL_POLE_CAP_DEG,
} from './globeConfig.js';

/* — Blue-fill surge (home-hero chunk 4) — the inverted-CRT two-beat, ONE
   cheap shape per panel per frame. t is the panel's local 0..1 progress
   through its surge window:
     beat 1 (t < SURGE_DIP_END): brightness dips linearly 1 → 0.7 — the
       screen "blinks", the power-on cascade's flicker inverted;
     beat 2: the blue smoothsteps 0 → 1 while brightness returns on the
       same curve (1 − depth·(1 − ss)), so the panel lands as flat field
       blue at full brightness.
   Continuous at the seam (both beats meet at 0.7), no overshoot at either
   end. Writes both uniforms; t ≤ 0 leaves the panel untouched — the
   setBlueFill(0) restore path owns that state. — */
const SURGE_DIP_END = 0.35;
const SURGE_DIP_DEPTH = 0.3; // brightness floor = 1 − depth = 0.7
function surgePanel(uniforms, t) {
  if (t <= 0) return;
  if (t < SURGE_DIP_END) {
    uniforms.uPower.value = 1 - SURGE_DIP_DEPTH * (t / SURGE_DIP_END);
    uniforms.uBlueMix.value = 0;
  } else {
    const s = (t - SURGE_DIP_END) / (1 - SURGE_DIP_END);
    const ss = s * s * (3 - 2 * s); // smoothstep — flat ends, no overshoot
    uniforms.uPower.value = 1 - SURGE_DIP_DEPTH * (1 - ss);
    uniforms.uBlueMix.value = ss;
  }
}

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
 * @param {boolean} [hero.holdEntrance] - chunk-5 intro hold: no auto cascade,
 *        no scheduler until releaseScheduler(). Forced off under reduced motion.
 * @returns {React.RefObject<{ replayCascade: (variant: string) => void,
 *          setBlueFill: (p: number, variant?: string) => void,
 *          setInk: (t: number) => void, releaseScheduler: () => void,
 *          onLiveChange: (cb: Function) => (() => void) }>}
 */
export default function useGlobeScene(
  containerRef,
  assets,
  gapDeg,
  capDeg,
  variantRef,
  onStats,
  poolRef,
  {
    rigRef = null,
    overlayRef = null,
    holdEntrance = false,
    cascadeSpeed = null,
    cornerRadius = 0,
  } = {}
) {
  // Live-panel transition subscribers (chunk-6 labels) — hook-level, like
  // the api object itself, so a subscription survives scene rebuilds (the
  // old scheduler's dispose announces 'off' for everything it showed; the
  // new one announces fresh 'live's into the same set). Lazy init keeps
  // the Set a one-time allocation (Hero's overlayRef idiom).
  const liveSubsRef = useRef(null);
  if (liveSubsRef.current === null) liveSubsRef.current = new Set();
  const apiRef = useRef(null);
  if (apiRef.current === null) {
    const liveSubs = liveSubsRef.current;
    apiRef.current = {
      replayCascade: () => {},
      setBlueFill: () => {},
      setInk: () => {},
      releaseScheduler: () => {},
      // Dev bench (?herotune) live tuning — pole cap/corner uniforms, brand
      // orientation, scroll pace. No-ops until the scene effect assigns the
      // real closures (and after teardown); the owner calls them optionally.
      setPoleTuning: () => {},
      setGlobeOrientation: () => {},
      setCascadeSpeed: () => {},
      setPoleCap: () => {},
      // Subscribe to live-panel transitions (LivePanelScheduler's
      // onLiveChange events, panel object included — the consumer projects
      // panel.centerDir itself). Scene-independent: never reset at
      // teardown, so a label layer can subscribe once and hold on.
      onLiveChange: (cb) => {
        liveSubs.add(cb);
        return () => liveSubs.delete(cb);
      },
    };
  }
  // The hold releases ONCE per mount and stays released across scene
  // rebuilds (lab-style gap/cap retunes mid-session) — a rebuild after the
  // intro must come up live, not re-held.
  const schedulerReleasedRef = useRef(false);

  // Dev-bench live tuning state (?herotune) — hook-level so a value survives a
  // scene rebuild (lab gap/cap retune), the same way RIG is carried via rigRef.
  // Seeded from the baked config/props; the bench mutates it through the api
  // setters, and each scene build re-seeds its uniforms/rotation/scroll from it.
  // Untouched, every field equals the shipped default → parity (the seed writes
  // are provable no-ops, and /lab never calls the setters).
  const tuneRef = useRef(null);
  if (tuneRef.current === null) {
    tuneRef.current = {
      lift: SCROLL_POLE_TIP_LIFT,
      tip: SCROLL_POLE_CORNER_TIP,
      wide: SCROLL_POLE_CORNER_WIDE,
      start: SCROLL_POLE_CORNER_START,
      cornerR: cornerRadius,
      tiltDeg: INITIAL_PITCH_DEG, // brand tilt; the tick applies (tiltDeg − INITIAL) as an offset
      yawDeg: 0, // static brand spin offset
      yawSpeed: 0, // steady auto-rotation, degrees/second (0 = fixed)
      cascadeSpeed: Number.isFinite(cascadeSpeed) ? cascadeSpeed : 4,
      capDeg: SCROLL_POLE_CAP_DEG, // pole-cap angular radius, degrees (0 = off)
    };
  }

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let disposed = false;
    // RM dual-guard: a hold is meaningless when the cascade reveals
    // instantly and the scheduler never exists — no-op it there so reduced
    // motion can never be left staring at a dark, held sphere.
    const hold = holdEntrance && !PREFERS_REDUCED_MOTION && !schedulerReleasedRef.current;

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
      : { fill: FILL_FRACTION, fitCover: null, offsetX: 0, offsetY: 0, elevDeg: 0, roll: 0, zoom: 1 };

    // Canvas CSS px — measured ONLY by measure() (init + resize), never in
    // applyRig. applyRig is the per-frame rig handle (gesture zoom, the
    // commit/intro launches) and also feeds the overlay loop; keeping the
    // clientWidth/clientHeight read out of it means the hot path never
    // touches layout. That matters with the label layer on (?herolabels):
    // it writes SVG geometry every frame, and a clientWidth read after those
    // writes would force a synchronous reflow. (Adversarial review flag,
    // 2026-07-18 — refuted on frame-ordering but closed at the source.)
    let viewW = 1;
    let viewH = 1;

    const applyRig = () => {
      if (disposed) return; // a stale handle post-teardown must be a no-op
      const w = viewW;
      const h = viewH;
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
      // Camera roll about the view axis (the local +Z, which runs through the
      // camera and the origin it's looking at, so the globe center stays fixed
      // on-screen). A POSITIVE roll tilts the whole composition to the RIGHT:
      // rotateZ(+θ) turns the camera's right axis to (cosθ, sinθ), so a point
      // on the world horizon's right side projects to (+x, −y) — the horizon
      // dips down-to-the-right and the globe's top leans right. roll 0 skips
      // the call entirely, keeping the view matrix bit-identical to before
      // (the parity guarantee). Rolls globe + labels together, as intended.
      if (RIG.roll) camera.rotateZ(THREE.MathUtils.degToRad(RIG.roll));
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

    // Read the container box into the cache and resize the drawing buffer —
    // init + resize only. Guarded to a genuine size change: re-stamping an
    // identical canvas size clears the buffer (a between-frames flicker), and
    // this is the ONLY place layout is read. Re-frames on the new box.
    const measure = () => {
      if (disposed) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      if (w === viewW && h === viewH) return;
      viewW = w;
      viewH = h;
      renderer.setSize(w, h, false);
      applyRig();
    };
    // Seed the cache + first frame UNCONDITIONALLY (measure()'s change-guard
    // is for the resize path; init must always frame once, as before).
    viewW = container.clientWidth || 1;
    viewH = container.clientHeight || 1;
    renderer.setSize(viewW, viewH, false);
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

    // Conveyor/scroll mode (home hero, note 6): a finite cascadeSpeed means the
    // brand meridian-scroll globe — rows of tiles travel pole-to-pole on the
    // fixed-tilt sphere (MeridianScroll). lab/other callers pass null → the
    // fixed globe with legacy yaw auto-rotate.
    const conveyorMode = cascadeSpeed != null && Number.isFinite(cascadeSpeed);
    const scrollPitch = Math.PI / SCROLL_VISIBLE_ROWS;
    // Row count for cascade sequencing (buildCascadeTimeline/panelDelay): the
    // scroll grid stacks SCROLL_VISIBLE_ROWS + 2 rows; the fixed globe is
    // LAT_BANDS + 2 (pole rings included).
    const totalRows = conveyorMode ? SCROLL_VISIBLE_ROWS + 2 : LAT_BANDS + 2;

    const { panels, innerSphereGeometry } = conveyorMode
      ? buildScrollingGlobeGeometry({
          lonSegments: LON_SEGMENTS,
          rows: SCROLL_VISIBLE_ROWS + 2, // + one buffer row beyond each pole
          gapDeg,
          latGapDeg: SCROLL_LAT_GAP_DEG,
          pitchRad: scrollPitch,
          radius: RADIUS,
        })
      : buildGlobeGeometry({
          lonSegments: LON_SEGMENTS,
          latBands: LAT_BANDS,
          gapDeg,
          capDeg,
          radius: RADIUS,
        });

    panels.forEach((panel) => {
      panel.mesh = new THREE.Mesh(
        panel.geometry,
        // Rounded tiles only when the caller asks (the home hero passes ~0.12
        // for lockup fidelity); /process (its own hook) and /lab (no override)
        // get the default 0 — hard edges, untouched.
        createPanelMaterial({ fallbackColor: PANEL_FALLBACK_COLOR, cornerRadius })
      );
      // Scroll globe: spread the rows into a proper sphere from the very first
      // frame (so the intro glyph reads as a globe, not an equatorial band) even
      // before MeridianScroll starts animating. The shader repositions vertices,
      // so bounds are stale — turn off frustum culling.
      if (conveyorMode) {
        const u = panel.mesh.material.uniforms;
        u.uUsePolarScroll.value = 1;
        u.uCanonTop.value = panel.canonTop;
        u.uPolarTop.value = panel.row * scrollPitch; // MeridianScroll's scroll-0 layout
        panel.mesh.frustumCulled = false;
      }
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
          // A slow initial load can resolve AFTER MeridianScroll has already
          // recycled this tile (which released this asset's ref and re-owns
          // texA). Bail then, or we'd bind texA to a released/disposed texture.
          // heldThumbId is set once the scroll driver exists; before that (or off
          // the scroll path) it's null and this is a no-op.
          if (conveyorMode && panel.heldThumbId != null && panel.heldThumbId !== asset.playbackId) return;
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
      cascadeTl = buildCascadeTimeline(panels, variant, totalRows);
    };
    // Entrance auto-start — SKIPPED under the intro hold: panels sit at
    // their built state (uPower 0 — dark screens, lit lattice) until the
    // owner fires replayCascade at its own beat. Thumbnails have still
    // loaded above, so the cascade reveals real tiles whenever it comes.
    Promise.allSettled(thumbnailLoads).then(() => {
      if (!disposed && !hold) startCascade(variantRef.current);
    });
    apiRef.current.replayCascade = (variant) => {
      if (!disposed) startCascade(variant);
    };

    /* — Gap-lattice ink (chunk-5 intro) — the "lines" of the mark are the
       inner sphere showing through the panel gaps, so ONE material color
       lerp inks the whole lattice: t 0 = white (the line-art wordmark
       state), 1 = GAP_COLOR (the resting electric blue). Colors are baked
       once per build; lerpColors mutates in place — nothing allocates per
       call. Idle unless the intro drives it: the material initializes at
       GAP_COLOR, and only a heroInk intro ever writes t < 1. — */
    const inkWhite = new THREE.Color(0xffffff);
    const inkBlue = new THREE.Color(GAP_COLOR);
    apiRef.current.setInk = (t) => {
      if (disposed) return;
      innerMaterial.color.lerpColors(inkWhite, inkBlue, Math.min(Math.max(t, 0), 1));
    };

    /* — Commit blue-fill (home-hero chunk 4) — p 0..1 sweeps the whole
       cascade window: each panel's surge (surgePanel above) is delayed by
       the SAME per-variant stagger model the power-on cascade uses
       (panelDelay — sweep/rows/poles), so the blue arrives through the
       globe's own choreography, never a flat fade. p is driven from
       OUTSIDE per frame (Hero's master eased e — the no-second-clock
       doctrine; nothing here ticks). Delays are baked once per variant
       (jitter frozen, Float32Array — zero per-frame allocations).
       setBlueFill(0) fully restores (uBlueMix 0, uPower 1) for the
       dry-run release; a fresh mount never needs it — every material
       initializes uBlueMix at 0 (panelMaterial). — */
    const BLUE_SURGE = 0.15; // per-panel surge length, cascade delay-units
    let blueDelays = null;
    let blueVariant = null;
    let blueWindow = 1;
    let blueEngaged = false;
    const bakeBlueDelays = (variant) => {
      if (blueDelays && blueVariant === variant) return;
      if (!blueDelays) blueDelays = new Float32Array(panels.length);
      let max = 0;
      for (let i = 0; i < panels.length; i += 1) {
        const d = panelDelay(panels[i], variant, totalRows);
        blueDelays[i] = d;
        if (d > max) max = d;
      }
      blueWindow = max + BLUE_SURGE; // the last panel completes exactly at p=1
      blueVariant = variant;
    };
    apiRef.current.setBlueFill = (p, variant = variantRef.current) => {
      if (disposed) return;
      if (p <= 0) {
        if (!blueEngaged) return; // never engaged — uniforms already clean
        blueEngaged = false;
        for (let i = 0; i < panels.length; i += 1) {
          const u = panels[i].mesh.material.uniforms;
          u.uBlueMix.value = 0;
          u.uPower.value = 1;
        }
        return;
      }
      if (!blueEngaged) {
        blueEngaged = true;
        // The commit owns uPower now — a still-running entrance cascade
        // would fight the surge writes (commit-during-cascade edge).
        if (cascadeTl) {
          cascadeTl.kill();
          cascadeTl = null;
        }
      }
      bakeBlueDelays(variant);
      for (let i = 0; i < panels.length; i += 1) {
        surgePanel(
          panels[i].mesh.material.uniforms,
          Math.min(Math.max((p * blueWindow - blueDelays[i]) / BLUE_SURGE, 0), 1)
        );
      }
    };

    /* — Live video tier (Stage 2; stills only under reduced motion) + the
       meridian scroll (home hero) — both deferred under the intro hold: no HLS
       decodes and no content flow while the globe is glyph-sized. The scheduler
       and scroll start together; releaseScheduler (idempotent) starts them and
       latches the release for any later rebuild; without a hold they start here
       exactly as before. (The scroll globe is already positioned as a sphere at
       build; deferring MeridianScroll only holds the MOTION, not the layout.) — */
    let scheduler = null;
    let scroller = null;
    // Live-event dispatcher — ONE stable closure handed to the scheduler
    // (whichever path constructs it, including a releaseScheduler under
    // holdEntrance), fanning out to the hook-level subscriber set. Hoisted
    // emit closure, event cadence (≤2Hz) — never on the frame path.
    let liveEvtPanel = null;
    let liveEvtState = null;
    const liveEmit = (cb) => cb(liveEvtPanel, liveEvtState);
    const emitLiveChange = (panel, state) => {
      liveEvtPanel = panel;
      liveEvtState = state;
      liveSubsRef.current.forEach(liveEmit);
    };
    const startScheduler = () => {
      if (disposed || scheduler || scroller) return;
      scheduler =
        poolRef?.current && assets?.length && !PREFERS_REDUCED_MOTION
          ? new LivePanelScheduler({
              panels,
              assets,
              poolHandle: poolRef.current,
              textureManager,
              onLiveChange: emitLiveChange,
              // The scroll driver owns panel.asset/texA under conveyor mode —
              // stop the scheduler's hidden-hemisphere swap fighting it over texA.
              cycleThumbnails: !conveyorMode,
            })
          : null;
      // Meridian scroll: independent of the video pool (thumbnails only), so it
      // runs whenever conveyor mode is on and motion is allowed, scheduler or
      // not. Handed the scheduler so it can demote live video as rows recycle.
      scroller =
        conveyorMode && assets?.length && !PREFERS_REDUCED_MOTION
          ? new MeridianScroll({
              panels,
              assets,
              textureManager,
              cascadeSpeed: tuneRef.current.cascadeSpeed, // bench-tunable pace (seeded from the prop)
              scheduler,
            })
          : null;
    };
    if (!hold) startScheduler();
    apiRef.current.releaseScheduler = () => {
      schedulerReleasedRef.current = true;
      startScheduler();
    };

    /* — Dev bench live tuning (?herotune) — pole cap / corner rounding uniforms,
       brand orientation, scroll pace. All gated by the owner opting in (Hero's
       stampGlobeTuning); /lab never calls these. Pole/corner writes go to every
       panel's uniforms (persisted in tuneRef so a scene rebuild re-seeds them);
       orientation is read live in the tick; pace forwards to MeridianScroll. — */
    const applyPoleUniforms = () => {
      const t = tuneRef.current;
      for (const panel of panels) {
        const u = panel.mesh.material.uniforms;
        u.uCornerR.value = t.cornerR;
        u.uPoleTipLift.value = t.lift;
        u.uPoleCornerTip.value = t.tip;
        u.uPoleCornerWide.value = t.wide;
        u.uPoleCornerStart.value = t.start;
      }
    };
    applyPoleUniforms(); // seed from tuneRef (= config defaults when untuned → no-op)
    apiRef.current.setPoleTuning = ({ lift, tip, wide, start, cornerR } = {}) => {
      if (disposed) return;
      const t = tuneRef.current;
      if (lift != null) t.lift = lift;
      if (tip != null) t.tip = tip;
      if (wide != null) t.wide = wide;
      if (start != null) t.start = start;
      if (cornerR != null) t.cornerR = cornerR;
      applyPoleUniforms();
    };
    apiRef.current.setGlobeOrientation = ({ tiltDeg, yawDeg, yawSpeed } = {}) => {
      if (disposed) return;
      const t = tuneRef.current;
      if (tiltDeg != null) t.tiltDeg = tiltDeg;
      if (yawDeg != null) t.yawDeg = yawDeg;
      if (yawSpeed != null) t.yawSpeed = yawSpeed;
      // read live in the tick — no re-apply needed
    };
    apiRef.current.setCascadeSpeed = (s) => {
      if (disposed) return;
      if (Number.isFinite(s)) tuneRef.current.cascadeSpeed = s;
      if (scroller) scroller.setSpeed(tuneRef.current.cascadeSpeed);
    };

    /* — Pole caps (home scroll globe only) — a small spherical cap in the
       inner-sphere blue at EACH pole, sitting just outside the panel surface, to
       occlude the residual sliver convergence the height-eat leaves at the exact
       pole point. Shares innerMaterial so it matches the gap blue and inks with
       the intro. Angular radius (tuneRef.capDeg) is bench-tunable; 0 hides it.
       Rebuilt (not scaled) on a size change — angular coverage can't be scaled
       off the sphere; the geometry is tiny and only rebuilds on a slider move. — */
    const CAP_RADIUS = RADIUS * 1.003; // just outside the panels (occludes the pinch)
    let poleCaps = null; // { top, bottom } meshes, lazily created
    const applyPoleCap = () => {
      if (!conveyorMode) return; // fixed globes (/lab) keep their pole wedges — untouched
      const ang = THREE.MathUtils.degToRad(Math.max(tuneRef.current.capDeg, 0));
      const off = ang <= 1e-4;
      if (!poleCaps) {
        const top = new THREE.Mesh(new THREE.BufferGeometry(), innerMaterial);
        const bottom = new THREE.Mesh(new THREE.BufferGeometry(), innerMaterial);
        top.frustumCulled = false;
        bottom.frustumCulled = false;
        globeGroup.add(top, bottom);
        poleCaps = { top, bottom };
      }
      poleCaps.top.geometry.dispose();
      poleCaps.bottom.geometry.dispose();
      poleCaps.top.visible = !off;
      poleCaps.bottom.visible = !off;
      // theta runs from +Y (0) to −Y (π): a cap at each pole is a thetaLength=ang
      // slice off each end. Radial segs keep the rim circular; few rings suffice.
      poleCaps.top.geometry = off
        ? new THREE.BufferGeometry()
        : new THREE.SphereGeometry(CAP_RADIUS, 32, 12, 0, Math.PI * 2, 0, ang);
      poleCaps.bottom.geometry = off
        ? new THREE.BufferGeometry()
        : new THREE.SphereGeometry(CAP_RADIUS, 32, 12, 0, Math.PI * 2, Math.PI - ang, ang);
    };
    applyPoleCap(); // build at the seeded size (no-op off the scroll path)
    apiRef.current.setPoleCap = (deg) => {
      if (disposed || !conveyorMode) return;
      if (Number.isFinite(deg)) tuneRef.current.capDeg = deg;
      applyPoleCap();
    };

    /* — Interaction + render loop — */
    // Conveyor mode holds the globe FIXED at the brand tilt (still ambient); the
    // content flows via ContentConveyor, not rotation. Legacy callers (lab) keep
    // the yaw auto-rotate. A drag always settles back to rest and the ±40° pitch
    // clamp stays on in every mode, so a drag can never strand the globe.
    const controller = new InteractionController(container, { still: conveyorMode });
    const pitchLimit = THREE.MathUtils.degToRad(PITCH_LIMIT_DEG);
    let yaw = 0;
    let pitch = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);
    let spinYaw = 0; // accumulated steady auto-rotation (?yawspeed); 0 unless the bench dials it

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
      // Clamp the step: gsap.ticker runs lagSmoothing(0) globally, so a tab-hidden
      // → visible resume (tick removed while hidden, re-added on resume) delivers
      // one deltaMs spanning the whole hidden span. Unclamped that snaps the yaw
      // auto-rotation and jumps the meridian scroll on the first frame back. 0.1s
      // (~3–6 frames) is far above any real frame so normal motion is untouched.
      const step = Math.min(accumulated, 0.1);
      accumulated = 0;

      const { dYaw, dPitch } = controller.update(step);
      yaw += dYaw;
      pitch += dPitch;
      // Clamp drag pitch to ±limit in every mode — the globe holds a bounded
      // orientation (fixed brand tilt under the conveyor, gentle yaw drift under
      // legacy), so a drag can never strand it past vertical.
      pitch = Math.max(-pitchLimit, Math.min(pitchLimit, pitch));
      // Dev-bench orientation offset (?herotune, read live): tilt is applied as
      // (tiltDeg − INITIAL_PITCH) so the default 40 → 0 offset → parity; yaw is
      // an absolute spin (default 0 → parity). Added AFTER the drag clamp so the
      // bench can push the brand tilt past the ±40° drag range.
      const orient = tuneRef.current;
      // Steady auto-rotation (?yawspeed, read live): accumulate continuous yaw at
      // yawSpeed °/s, wrapped bounded. 0 → spinYaw stays 0 → parity (fixed globe).
      // Auto-rotation is MOTION, so it is suppressed under reduced motion (the
      // globe holds its pose); the static tilt/yaw offsets below still apply.
      if (!PREFERS_REDUCED_MOTION) {
        spinYaw = (spinYaw + THREE.MathUtils.degToRad(orient.yawSpeed) * step) % (Math.PI * 2);
      }
      globeGroup.rotation.set(
        pitch + THREE.MathUtils.degToRad(orient.tiltDeg - INITIAL_PITCH_DEG),
        yaw + spinYaw + THREE.MathUtils.degToRad(orient.yawDeg),
        0
      );

      // Meridian scroll (home hero): advance the pole-to-pole tile travel on the
      // fixed-tilt globe (writes each row's uPolarTop + refreshes centerDir).
      // Per frame — the polar scroll is continuous. Null-safe: lab/RM never
      // construct it. Runs before render so the frame reflects it, and before
      // the scheduler tick so prominence scores read the fresh centerDir.
      if (scroller) scroller.update(step);

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

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(container);

    /* — Teardown — */
    return () => {
      disposed = true;
      apiRef.current.replayCascade = () => {};
      apiRef.current.setBlueFill = () => {};
      apiRef.current.setInk = () => {};
      apiRef.current.releaseScheduler = () => {};
      apiRef.current.setPoleTuning = () => {};
      apiRef.current.setGlobeOrientation = () => {};
      apiRef.current.setCascadeSpeed = () => {};
      apiRef.current.setPoleCap = () => {};
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickerActive) gsap.ticker.remove(tick);
      if (cascadeTl) cascadeTl.kill();
      if (scheduler) scheduler.dispose();
      if (scroller) scroller.dispose();
      controller.dispose();
      textureManager.disposeAll();
      panels.forEach((panel) => {
        panel.geometry.dispose();
        panel.mesh.material.dispose();
      });
      innerSphereGeometry.dispose();
      innerMaterial.dispose();
      if (poleCaps) {
        poleCaps.top.geometry.dispose();
        poleCaps.bottom.geometry.dispose();
      }
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [assets, gapDeg, capDeg]);

  return apiRef;
}
