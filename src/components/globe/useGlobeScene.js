/**
 * useGlobeScene.js — The only place three.js meets React.
 *
 * Owns the renderer/scene/camera, builds the panelized globe, assigns CMS
 * thumbnails, and runs the render loop on gsap.ticker with an internal
 * 60fps gate (FPS_CAP less ?globefpstol's slack; never gsap.ticker.fps() — the ticker is shared
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
 *
 * Population modes (globe-worlds, docs/globe-worlds-plan.md): with `worlds`
 * (buildWorldPools) and ?popmode on, a PopulationDirector decides each
 * scroll tile's asset — the initial layout and every re-born row — so the
 * globe shows featured-project worlds in clusters. Mode changes on the
 * ?poptune bench rebuild the director only, never the scene. Without a
 * popmode the director is never built and the globe is unchanged. As each
 * world takes the globe its projectColor becomes the lattice blue (the
 * accent below) and goes out through onWorldChange — Hero tints the home
 * chrome with it.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import buildGlobeGeometry, { buildScrollingGlobeGeometry } from './buildGlobeGeometry.js';
import { createPanelMaterial } from './panelMaterial.js';
import TextureManager, { assetKey } from './TextureManager.js';
import InteractionController from './InteractionController.js';
import { settleDebounce } from '../../lib/settleResize.js';
import { getScheme, onScheme } from '../../lib/colorScheme.js';
import { RAMP_A_RGB, RAMP_GLSL } from '../../lib/spectrumRamp.js';
import { nameStripPaints } from './nameTicker.js';
import LivePanelScheduler, { HANDOFF_BEAT_S } from './LivePanelScheduler.js';
import { preloadHls } from '../work/useHls.js';
import MeridianScroll, { initialBirth, poseTile, scrollZeroTheta } from './MeridianScroll.js';
import PopulationDirector from './PopulationDirector.js';
import { applyPlan, windowA, setWindowA } from './tileSwap.js';
import { TUNING as POP_TUNING, subscribePopTune } from './popConfig.js';
import buildCascadeTimeline, { panelDelay, delayOwner } from './cascade.js';
import { STREAM_TIERS, tierBucket } from './unitSpan.js';
import {
  LON_SEGMENTS,
  LAT_BANDS,
  RADIUS,
  INNER_SPHERE_SCALE,
  CAMERA_FOV,
  FIT_COVER,
  FILL_FRACTION,
  INITIAL_PITCH_DEG,
  GLOBE_FPS_GATE_S,
  globePixelRatio,
  PITCH_LIMIT_DEG,
  GAP_COLOR,
  gapHex,
  sceneAccent,
  IS_MOBILE,
  PANEL_FALLBACK_COLOR,
  PREFERS_REDUCED_MOTION,
  SCROLL_VISIBLE_ROWS,
  SCROLL_LAT_GAP_DEG,
  SCROLL_PACE_SCALE,
  SCROLL_POLE_CORNER_TIP,
  SCROLL_POLE_CORNER_WIDE,
  SCROLL_POLE_CORNER_START,
  SCROLL_POLE_TIP_LIFT,
  SCROLL_POLE_CAP_DEG,
} from './globeConfig.js';

gsap.registerPlugin(CustomEase);

/* — World accent clock (population modes) — the CSS accent's own fade,
   --project-color-fade on --ease-panel (global.css), so the lattice, the
   stroke ring and the home chrome change colour in lockstep. — */
const ACCENT_SECONDS = 1.7;
const ACCENT_EASE = 'swmAccentPanel';
const accentEase = () =>
  CustomEase.get(ACCENT_EASE) || CustomEase.create(ACCENT_EASE, 'M0,0 C0.22,1 0.36,1 1,1');

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
// Enter World lens target multisamples — the /work World's MSAA_SAMPLES default, so
// the dive's AA matches the direct render the frame before it (SQ-34).
const ENTER_LENS_MSAA = 4;
const SURGE_DIP_END = 0.35; // default dip share — live-tunable via setBlueFillTuning (08-25)
const SURGE_DIP_DEPTH = 0.3; // default brightness floor = 1 − depth = 0.7
function surgePanel(uniforms, t, dipEnd, dipDepth) {
  if (t <= 0) return;
  if (t < dipEnd) {
    uniforms.uPower.value = 1 - dipDepth * (t / dipEnd);
    uniforms.uBlueMix.value = 0;
  } else {
    const s = (t - dipEnd) / (1 - dipEnd);
    const ss = s * s * (3 - 2 * s); // smoothstep — flat ends, no overshoot
    uniforms.uPower.value = 1 - dipDepth * (1 - ss);
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
 * @param {Array} [hero.worlds] - featured-project pools (buildWorldPools) for
 *        the population modes; used only under ?popmode on the scroll globe
 * @returns {React.RefObject<{ replayCascade: (variant: string) => void,
 *          setBlueFill: (p: number, variant?: string) => void,
 *          setInk: (t: number) => void, releaseScheduler: () => void,
 *          onLiveChange: (cb: Function) => (() => void),
 *          onWorldChange: (cb: Function) => (() => void),
 *          getFocusProject: () => (string|null), popHold: () => void,
 *          setEnterLens: (x: number|null, y?: number) => void }>}
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
    tiltDeg = null,
    cornerRadius = 0,
    worlds = null,
  } = {}
) {
  // Live-panel transition subscribers (chunk-6 labels) — hook-level, like
  // the api object itself, so a subscription survives scene rebuilds (the
  // old scheduler's dispose announces 'off' for everything it showed; the
  // new one announces fresh 'live's into the same set). Lazy init keeps
  // the Set a one-time allocation (Hero's overlayRef idiom).
  const liveSubsRef = useRef(null);
  if (liveSubsRef.current === null) liveSubsRef.current = new Set();
  // Population-world subscribers (Hero's chrome tint) — hook-level the same
  // way; the latest announcement replays on subscribe, since the scene can
  // greet (reduced motion) before Hero's effect subscribes.
  const worldHubRef = useRef(null);
  if (worldHubRef.current === null) worldHubRef.current = { subs: new Set(), last: null };
  const apiRef = useRef(null);
  if (apiRef.current === null) {
    const liveSubs = liveSubsRef.current;
    const worldHub = worldHubRef.current;
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
      // Population modes (?popmode): the /work slug of the world in view
      // (null when no director), the ?poptune bench's actions, and Enter
      // World's hold on the change clock.
      getFocusProject: () => null,
      popNext: () => {},
      popShow: () => {},
      popHold: () => {},
      // Enter World dive lens (SQ-34): (x, y) routes frames through the lens
      // pass at that distortion, (null) back to the direct render.
      setEnterLens: () => {},
      // Subscribe to live-panel transitions (LivePanelScheduler's
      // onLiveChange events, panel object included — the consumer projects
      // panel.centerDir itself). Scene-independent: never reset at
      // teardown, so a label layer can subscribe once and hold on.
      onLiveChange: (cb) => {
        liveSubs.add(cb);
        return () => liveSubs.delete(cb);
      },
      // Subscribe to the population world taking the globe — { slug, color,
      // animate }, color its projectColor (null = brand blue). Never reset.
      onWorldChange: (cb) => {
        worldHub.subs.add(cb);
        if (worldHub.last) cb(worldHub.last);
        return () => worldHub.subs.delete(cb);
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
      // resting tilt; the tick applies (tiltDeg − INITIAL) as an offset. Seeded from the caller (home:
      // ?herotilt) so the first build ranks its panels under the tilt the first frame shows.
      tiltDeg: Number.isFinite(tiltDeg) ? tiltDeg : INITIAL_PITCH_DEG,
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
    renderer.setPixelRatio(globePixelRatio(window.devicePixelRatio));
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

    /* — Spectrum ramp (wave 4) — everything the canvas draws as line or gap (the inner sphere between the
       panels, the pole caps, the corner fringe, the surge) continues the DOM ring's conic gradient: ramp A,
       0 at 12 o'clock, clockwise, about the ring's centre. ONE uniform object each, shared by reference by
       every material: the stops, the mix (0 = the flat accent, today's output; 1 = the ramp) and the centre in
       drawing-buffer px, y up (gl_FragCoord's frame). A scheme change writes uniforms only. — */
    const rampStops = { value: RAMP_A_RGB };
    const rampMix = { value: 0 };
    const rampCenter = { value: new THREE.Vector2() };
    const rampUniforms = { ramp: rampStops, mix: rampMix, center: rampCenter };
    const rampBuf = new THREE.Vector2();
    const rampCss = [0, 0]; // the same centre in CSS px, y down: what the debug hook reports
    const rampNdc = new THREE.Vector3();
    // The ring's centre is where Hero's overlay (heroOverlay.js) puts it: the globe group's origin (it never
    // leaves the origin; only its rotation moves) projected through the camera, NDC to the canvas box.
    // The camera changes only in applyRig, so this is written there, after its projection is final.
    const placeRampCenter = (w, h) => {
      camera.updateMatrixWorld();
      rampNdc.set(0, 0, 0).project(camera);
      renderer.getDrawingBufferSize(rampBuf);
      rampCenter.value.set((rampNdc.x * 0.5 + 0.5) * rampBuf.x, (rampNdc.y * 0.5 + 0.5) * rampBuf.y);
      rampCss[0] = (rampNdc.x * 0.5 + 0.5) * w;
      rampCss[1] = (rampNdc.y * -0.5 + 0.5) * h;
    };

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
      placeRampCenter(w, h);
    };

    // Read the container box into the cache and resize the drawing buffer —
    // init + resize only. Guarded to a genuine size change: re-stamping an
    // identical canvas size clears the buffer (a between-frames flicker), and
    // this is the ONLY place layout is read. Re-frames on the new box.
    // 08-28 (Nathan): a live drag clears the buffer faster than the
    // FPS-gated tick repaints it, so mid-resize the canvas reads blank and
    // the stroke disc shows through — make that the DESIGN: the first real
    // resize of a gesture fades the canvas out (blue disc + ring = the rest
    // state, the lockup mark), and once the gesture settles the globe fades
    // back in over it.
    let resizeFaded = false;
    const fadeBackIn = settleDebounce(
      () => {
        if (disposed || !resizeFaded) return;
        resizeFaded = false;
        requestAnimationFrame(() => {
          // one frame so the tick paints the final size before the reveal
          if (disposed) return;
          gsap.to(renderer.domElement, {
            opacity: 1,
            duration: 0.45,
            ease: 'power2.out',
            overwrite: true,
          });
        });
      },
      { settleMs: 300, maxWaitMs: 2000 }
    );
    /* — Enter lens (SQ-34) —
       The home → /work dive carries the lens deepen the /work World plays on
       the FP card → detail passage. The globe renders straight to the canvas
       at rest; for the passage ONLY it routes through the World's recipe — an
       MSAA sRGB target, then LensDistortionPass last (needsSwap false, so the
       composer allocates one target, not two) — so the first composer frame at
       lens 0 matches the direct one (same AA, same output encoding; there is
       no tone mapping on either renderer). Built at idle after mount in its own
       lazy chunk (the same modules /work loads, so the home bundle does not
       grow) and warmed there: the scene's render-target shader variants and
       the lens program compile now, so the commit pays only for sizing the
       target. At rest the target is 1x1 and nothing renders through it.
       setEnterLens(x, y) engages it and sets the distortion; (null) releases. */
    let enterLens = null; // { composer, pass, target } once built; null before the idle build lands
    let lensRouted = false; // true while frames go through the composer
    let lensIdle = null; // pending idle build — { cancel }
    const sizeEnterLens = (full) => {
      // Exactly the canvas's drawing buffer (integers), so lens 0 is a texel-exact copy.
      const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
      enterLens.composer.setPixelRatio(1);
      enterLens.composer.setSize(full ? buf.x : 1, full ? buf.y : 1);
    };
    const buildEnterLens = async () => {
      const [{ EffectComposer }, { RenderPass }, { Pass, FullScreenQuad }, { LensDistortionPassGen }] =
        await Promise.all([
          import('three/examples/jsm/postprocessing/EffectComposer.js'),
          import('three/examples/jsm/postprocessing/RenderPass.js'),
          import('three/examples/jsm/postprocessing/Pass.js'),
          import('../work/world/vendor/lensDistortion.js'),
        ]);
      if (disposed) return;
      const target = new THREE.WebGLRenderTarget(1, 1, {
        samples: ENTER_LENS_MSAA,
        type: THREE.UnsignedByteType,
        colorSpace: THREE.SRGBColorSpace,
      });
      const composer = new EffectComposer(renderer, target);
      composer.addPass(new RenderPass(scene, camera));
      // The three members the vendored pass uses — never the THREE namespace itself:
      // handing the whole object over keeps all of three out of tree-shaking (+208 KB
      // on the home bundle, measured).
      const LensDistortionPass = LensDistortionPassGen({
        THREE: {
          Vector2: THREE.Vector2,
          ShaderMaterial: THREE.ShaderMaterial,
          UniformsUtils: THREE.UniformsUtils,
        },
        Pass,
        FullScreenQuad,
      });
      const pass = new LensDistortionPass({ distortion: new THREE.Vector2(0, 0) });
      pass.needsSwap = false;
      composer.addPass(pass);
      enterLens = { composer, pass, target };
      sizeEnterLens(false);
      // Warm: the scene's materials for a render target (their output colour
      // space differs from the canvas's, so a second program set), then the
      // lens quad for the canvas (the null target, where its sRGB encode lives).
      renderer.setRenderTarget(target);
      renderer.compile(scene, camera);
      renderer.setRenderTarget(null);
      renderer.compile(new THREE.Mesh(new THREE.BufferGeometry(), pass._fsQuad.material), camera);
    };
    const scheduleEnterLens = () => {
      if (PREFERS_REDUCED_MOTION) return; // RM cuts the cover, no dive
      const run = () => buildEnterLens().catch(() => {}); // a failed chunk = the passage goes lens-less
      if (typeof requestIdleCallback === 'function') {
        const id = requestIdleCallback(run, { timeout: 4000 });
        lensIdle = { cancel: () => cancelIdleCallback(id) };
      } else {
        const id = setTimeout(run, 1500);
        lensIdle = { cancel: () => clearTimeout(id) };
      }
    };
    scheduleEnterLens();
    apiRef.current.setEnterLens = (x, y) => {
      if (disposed || !enterLens) return; // not warmed yet: the passage goes lens-less
      if (x == null) {
        if (!lensRouted) return;
        lensRouted = false;
        sizeEnterLens(false); // hand the big target back
        return;
      }
      if (!lensRouted) {
        sizeEnterLens(true);
        lensRouted = true;
      }
      enterLens.pass.distortion.set(x, y);
    };
    // ?debug probe: the same scene state through both paths, read back. Lens 0
    // on the composer path must equal the direct render (no pop at the switch).
    // programs = GL programs, so the probe can show the commit compiled none.
    if (new URLSearchParams(window.location.search).has('debug')) {
      const grab = () => {
        const gl = renderer.getContext();
        const buf = renderer.getDrawingBufferSize(new THREE.Vector2());
        const px = new Uint8Array(buf.x * buf.y * 4);
        gl.readPixels(0, 0, buf.x, buf.y, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return px;
      };
      window.__globeLens = {
        ready: () => !!enterLens,
        programs: () => renderer.info.programs.length,
        routed: () => lensRouted,
        lens: () => (enterLens ? [enterLens.pass.distortion.x, enterLens.pass.distortion.y] : null),
        diff: (keep) => {
          if (!enterLens) return null;
          renderer.render(scene, camera); // the direct path, for the read-back (not the tick's call)
          const a = grab();
          const was = lensRouted;
          if (!was) sizeEnterLens(true);
          enterLens.pass.distortion.set(0, 0);
          enterLens.composer.render(0);
          const b = grab();
          if (!was) sizeEnterLens(false);
          let max = 0, sum = 0, over8 = 0;
          for (let i = 0; i < a.length; i++) {
            const d = Math.abs(a[i] - b[i]);
            if (d > max) max = d;
            if (d > 8) over8++;
            sum += d;
          }
          if (keep) window.__globeLens.last = { w: renderer.getDrawingBufferSize(new THREE.Vector2()).x, a, b };
          return { pixels: a.length / 4, max, mean: sum / a.length, over8 };
        },
      };
    }
    const measure = () => {
      if (disposed) return;
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      if (w === viewW && h === viewH) return;
      viewW = w;
      viewH = h;
      if (!resizeFaded) {
        resizeFaded = true;
        gsap.to(renderer.domElement, {
          opacity: 0,
          duration: 0.12,
          ease: 'none',
          overwrite: true,
        });
      }
      fadeBackIn();
      renderer.setSize(w, h, false);
      if (lensRouted) sizeEnterLens(true); // the target follows the canvas mid-passage
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
        createPanelMaterial({
          fallbackColor: PANEL_FALLBACK_COLOR,
          cornerRadius,
          ramp: rampUniforms,
        })
      );
      // Scroll globe: spread the rows into a proper sphere from the very first
      // frame (so the intro glyph reads as a globe, not an equatorial band) even
      // before MeridianScroll starts animating. The shader repositions vertices,
      // so bounds are stale — turn off frustum culling.
      if (conveyorMode) {
        const u = panel.mesh.material.uniforms;
        u.uUsePolarScroll.value = 1;
        u.uCanonTop.value = panel.canonTop;
        // MeridianScroll's scroll-0 pose through the driver's OWN writer, so the
        // live centerDir/parked land here too — not just the shader uniform.
        // Stamping the uniform alone is what let the initial layout plan the
        // first world's client name against a globe still seeded at the
        // canonical equator (every row reporting |y| = 0), so the name band
        // admitted every row and the strip could be born at the pole.
        // It also fixes the last row, whose old `row * scrollPitch` read 210 deg
        // where thetaForRow says -30 deg.
        poseTile(panel, scrollZeroTheta(panel.row, totalRows));
        panel.mesh.frustumCulled = false;
        // Tape coordinate (the population modes' pattern space) — stamped
        // now because the initial layout runs before MeridianScroll exists.
        panel.tapeS = initialBirth(panel.row, totalRows);
      }
      globeGroup.add(panel.mesh);
    });

    const innerMaterial = new THREE.MeshBasicMaterial({ color: GAP_COLOR });
    /* The gap and the pole caps (this one material) take the ring's ramp under spectrum. Its colour stays
       lerp(white, accent, inkT), so the intro still starts white; the ramp replaces the ACCENT in that lerp:
       colour += mix * inkT * (ramp - accent). At rampW 0 the term is +0 and the output is today's, bit for
       bit. The accent is the shared inkBlue (below), linear like the material colour. */
    const rampWeight = { value: 0 }; // rampMix * inkT, written by paintInk
    const rampAccent = { value: null }; // inkBlue, linked where it is built
    innerMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uRamp = rampStops;
      shader.uniforms.uRampCenter = rampCenter;
      shader.uniforms.uRampWeight = rampWeight;
      shader.uniforms.uRampAccent = rampAccent;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec2 uRampCenter;
uniform float uRampWeight;
uniform vec3 uRampAccent;
${RAMP_GLSL}`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  vec2 rampD = gl_FragCoord.xy - uRampCenter;
  diffuseColor.rgb += uRampWeight * (spectrumRamp(atan(rampD.x, rampD.y) * 0.15915494309189535) - uRampAccent);
}`
        );
    };
    innerMaterial.customProgramCacheKey = () => 'swm-spectrum-ramp';
    const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
    innerSphere.scale.setScalar(INNER_SPHERE_SCALE);
    globeGroup.add(innerSphere);

    /* — CMS thumbnails — */
    // Assign the pool in initial-prominence order (under the resting tilt:
    // the brand mark's INITIAL_PITCH on /lab, ?herotilt on home) so curated
    // picks (pool head) land on the panels facing the camera at load
    const initialRotation = new THREE.Euler(
      THREE.MathUtils.degToRad(tuneRef.current.tiltDeg), 0, 0
    );
    const initialScore = (p) => p.centerDir.clone().applyEuler(initialRotation).z;
    const byProminence = [...panels].sort((a, b) => initialScore(b) - initialScore(a));
    const textureManager = new TextureManager(renderer); // a decoded still reaches the GPU from the tick, one a frame
    // Declared ahead of their section (the live tier below) — the population
    // director's hooks read them.
    let scheduler = null;
    let scroller = null;
    let director = null;
    let posed = false; // the tick has set the globe's rotation at least once (getHorizon is null until then, M4)
    const hzQ = new THREE.Quaternion();
    const hzV = new THREE.Vector3();
    const buildDirector = () =>
      new PopulationDirector({
        panels,
        worlds,
        textureManager,
        getScheduler: () => scheduler,
        getScroller: () => scroller,
        getRotation: () => globeGroup.rotation,
        canAnimate: () => popCanAnimate(),
        onWorld: (world, info) => onPopWorld(world, info), // the accent section below
        // Span budget inputs (P4a, PopulationDirector.travelBudget / planUnits).
        getPace: () =>
          scroller
            ? (scroller.rate * scroller.rateScale * 180) / Math.PI
            : PREFERS_REDUCED_MOTION
              ? 0
              : ((180 / SCROLL_VISIBLE_ROWS) * tuneRef.current.cascadeSpeed) / SCROLL_PACE_SCALE, // before the scroller exists
        getHorizon: (rot = globeGroup.rotation) => {
          // No pose yet: no horizon, and the plan places H pairs only. initialRotation is the resting tilt without the camera's elevation, not the rendered pose (M4).
          if (!posed) return null;
          // camera → globe frame (at `rot`: the live pose, or the one the plan ahead predicts); θh = its colatitude + the visible cap's half-angle
          hzQ.setFromEuler(rot).invert();
          hzV.copy(camera.position).sub(globeGroup.position).applyQuaternion(hzQ);
          const d = hzV.length();
          return Math.acos(THREE.MathUtils.clamp(hzV.y / d, -1, 1)) + Math.acos(Math.min(RADIUS / d, 1));
        },
        revealHeld: hold,
        // The fast handoff's forecast: the live scheduler's admission, or a fresh one's while the intro hold defers
        // it (called once stills settle, after this effect has run, so tierFor below is set).
        forecast: (clips) => (scheduler ? scheduler.predictStarts(clips) : LivePanelScheduler.forecast(clips, { tierFor })),
        // The plan ahead: the clips a board landing at `rot` starts, and the spin that carries the globe there.
        landing: (rot) => (scheduler ? scheduler.landingClips(rot) : LivePanelScheduler.landingClips(panels, rot)),
        getSpin: () => (PREFERS_REDUCED_MOTION ? 0 : THREE.MathUtils.degToRad(tuneRef.current.yawSpeed)),
      });
    const popAvailable = conveyorMode && worlds?.length > 0;
    if (popAvailable && POP_TUNING.mode !== 'off') director = buildDirector();
    const thumbnailLoads = director
      ? director.initialLayout(byProminence) // clustered worlds from the very first reveal
      : byProminence.map((panel, idx) => {
          if (!assets?.length) return Promise.resolve();
          const asset = assets[idx % assets.length];
          panel.asset = asset;
          // The tile owns this build-time ref (MeridianScroll's recycles release
          // it through heldThumbId; see tileSwap.loadTile).
          if (conveyorMode) panel.heldThumbId = assetKey(asset);
          return textureManager
            .loadThumbnail(asset.playbackId)
            .then((texture) => {
              if (disposed) return;
              // A slow initial load can resolve AFTER MeridianScroll has already
              // recycled this tile (which released this asset's ref and re-owns
              // texA). Bail then, or we'd bind texA to a released/disposed texture.
              // heldThumbId holds this load's key from the start (conveyor mode)
              // until a recycle's bind takes it over; off the scroll path it's
              // unset and this is a no-op.
              if (conveyorMode && panel.heldThumbId != null && panel.heldThumbId !== assetKey(asset)) return;
              const { uniforms } = panel.mesh.material;
              uniforms.texA.value = texture;
              setWindowA(uniforms, windowA(panel, asset, texture));
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
      // The fast handoff: the player and the first world's clips load in the stills' wake, while the intro hold
      // still defers the scheduler (with no hold it is already starting them).
      if (!disposed && director?.handoffFast) {
        preloadHls();
        if (!scheduler) director.prefetchLaid();
      }
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
    const lineInk = new THREE.Color(GAP_COLOR); // what the lines between panels draw: the ring's colour (the accent, white under black)
    rampAccent.value = lineInk;
    let inkT = 1; // kept so a world accent change re-inks at the intro's point
    const paintInk = () => {
      innerMaterial.color.lerpColors(inkWhite, lineInk, inkT);
      rampWeight.value = rampMix.value * inkT; // the ramp enters on the intro's clock too: white until the ink arrives
    };
    apiRef.current.setInk = (t) => {
      if (disposed) return;
      inkT = Math.min(Math.max(t, 0), 1);
      paintInk();
    };

    /* — World accent (population modes) — the lattice blue becomes the
       world's projectColor. inkBlue is the ink target (inner sphere + pole
       caps — the lattice), and every panel's uBlueColor (the commit surge,
       the rounded-corner fringe) shares that one Color, so a single write
       retints the lot. Tweened on the CSS accent's clock and lerped in gamma
       sRGB — how the browser interpolates the chrome's legacy colours — so
       the stroke ring and the home chrome change in lockstep. onWorldChange
       carries the change out to Hero. Idle without a director. — */
    /* The colour scheme (swm:scheme, SQ-90) rides the same tween. A scheme
       names the accent (schemeAccent: black and blue are constants, spectrum
       the one palette blue under the ramp (wave 4), project the world's own colour) and the
       world-less gap colour, which is also the fog the distance recedes into.
       The fog colour is ONE Color shared by every panel, so it fades with the
       lattice on the accent's clock instead of snapping. Under 'project' the
       gap is GAP_COLOR and nothing here moves. */
    const fogColor = new THREE.Color(GAP_COLOR);
    const fogFrom = { r: 0, g: 0, b: 0 };
    const fogTo = { r: 0, g: 0, b: 0 };
    const fogTarget = new THREE.Color(GAP_COLOR);
    let popWorld = null; // the world on the globe, raw (onPopWorld)
    const accentFrom = { r: 0, g: 0, b: 0 };
    const accentTo = { r: 0, g: 0, b: 0 };
    const accentClock = { t: 1 };
    const accentTarget = new THREE.Color(GAP_COLOR);
    const lineFrom = { r: 0, g: 0, b: 0 };
    const lineTo = { r: 0, g: 0, b: 0 };
    const lineTarget = new THREE.Color(GAP_COLOR);
    let accentTween = null;
    const lerpRGB = (color, a, b, k) =>
      color.setRGB(a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k, THREE.SRGBColorSpace);
    const paintAccent = () => {
      const k = accentClock.t;
      lerpRGB(inkBlue, accentFrom, accentTo, k);
      lerpRGB(lineInk, lineFrom, lineTo, k);
      lerpRGB(fogColor, fogFrom, fogTo, k);
      paintInk();
    };
    /** The accent `scheme` paints the globe with. ?popcolor 0 takes the world out of it. */
    const accentFor = (scheme) => sceneAccent(POP_TUNING.color ? popWorld : null, scheme);
    /* The ramp mix rides the accent's clock (ACCENT_SECONDS, the same ease) and snaps where the accent does
       (reduced motion, the load's scheme). It follows the SCHEME, not the world: a world change under spectrum
       leaves it at 1, so the tween it already has in flight is not restarted. Uniform writes only. */
    let rampTarget = 0;
    let rampTween = null;
    const setRampMix = (to, animate) => {
      if (to === rampTarget && (rampTween || rampMix.value === to)) return;
      rampTarget = to;
      if (rampTween) rampTween.kill();
      rampTween = null;
      if (animate) {
        rampTween = gsap.to(rampMix, {
          value: to,
          duration: ACCENT_SECONDS,
          ease: accentEase(),
          onUpdate: paintInk,
          onComplete: () => {
            rampTween = null;
          },
        });
      } else {
        rampMix.value = to;
        paintInk();
      }
    };
    const setAccent = (color, animate, scheme = getScheme()) => {
      setRampMix(scheme === 'spectrum' ? 1 : 0, animate);
      inkBlue.getRGB(accentFrom, THREE.SRGBColorSpace); // from where it is — mid-change included
      fogColor.getRGB(fogFrom, THREE.SRGBColorSpace);
      accentTarget.set(color).getRGB(accentTo, THREE.SRGBColorSpace);
      lineInk.getRGB(lineFrom, THREE.SRGBColorSpace);
      // ONE entity with the outline ring: the panel lines draw the ring's colour, the accent everywhere but black (white).
      // The accent itself stays the panel fill, the surge and the fringe.
      lineTarget.set(scheme === 'black' ? 0xffffff : color).getRGB(lineTo, THREE.SRGBColorSpace);
      fogTarget.set(gapHex(scheme)).getRGB(fogTo, THREE.SRGBColorSpace);
      if (accentTween) accentTween.kill();
      accentTween = null;
      accentClock.t = animate ? 0 : 1;
      if (animate) {
        accentTween = gsap.to(accentClock, {
          t: 1,
          duration: ACCENT_SECONDS,
          ease: accentEase(),
          onUpdate: paintAccent,
        });
      } else paintAccent();
    };
    for (const p of panels) {
      const u = p.mesh.material.uniforms;
      u.uBlueColor.value = inkBlue;
      u.uFogColor.value = fogColor;
    }
    // Hero tints the chrome with the world's RAW colour and palette key: the DOM
    // takes the scheme from CSS (html[data-scheme]), the canvas from schemeAccent.
    const onPopWorld = (world, { animate }) => {
      if (disposed) return;
      popWorld = world;
      const color = (POP_TUNING.color && world?.projectColor) || null;
      setAccent(accentFor(getScheme()), animate);
      const hub = worldHubRef.current;
      hub.last = { slug: world?.slug ?? null, color, spectrum: (POP_TUNING.color && world?.spectrum) || null, animate };
      hub.subs.forEach((cb) => cb(hub.last));
    };
    // A scheme change: the accent, gap and fog ease to it (a PREVIEW writes
    // nothing else); a settled one also repaints the name strips in place.
    const unsubscribeScheme = onScheme(({ scheme, preview }) => {
      if (disposed) return;
      setAccent(accentFor(scheme), !PREFERS_REDUCED_MOTION, scheme);
      if (!preview) textureManager.recolorNames(scheme);
    });
    if (getScheme() !== 'project') setAccent(accentFor(getScheme()), false); // the load's scheme, before the first frame
    // The probe's read of what the scene paints (target colours, so a fade in flight reads settled) and how many strips it has drawn.
    const hex = (c) => `#${c.getHexString()}`;
    const schemeDebug = (window.__swmSchemeDebug = window.__swmSchemeDebug || {});
    const globeDebug = () => ({
      accent: hex(accentTarget),
      gap: hex(new THREE.Color().lerpColors(inkWhite, lineTarget, inkT)),
      fog: hex(fogTarget),
      strips: nameStripPaints(),
      // the outline ramp (wave 4): the mix the scene is heading to (a fade in flight reads settled) and the centre
      // the shaders measure the angle from, CSS px with y down, the DOM ring's centre
      ramp: { mix: rampTarget, center: [rampCss[0], rampCss[1]] },
    });
    schemeDebug.globe = globeDebug;
    // Reduced motion has no clock and no entrance to wait for — the first
    // world takes its colour at once.
    if (director && PREFERS_REDUCED_MOTION) director.greet(false);

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
    // 08-25: surge shape live-tunable (Hero stamps from TUNING via
    // setBlueFillTuning — the ?bluesurge/?bluedipend/?bluedipdepth knobs).
    let blueSurge = 0.15; // per-panel surge length, cascade delay-units
    let blueDipEnd = SURGE_DIP_END;
    let blueDipDepth = SURGE_DIP_DEPTH;
    let blueDelays = null;
    let blueVariant = null;
    let blueWindow = 1;
    let blueEngaged = false;
    const panelIndex = new Map(panels.map((p, i) => [p, i])); // a unit member → its lead's baked delay
    const bakeBlueDelays = (variant) => {
      if (blueDelays && blueVariant === variant) return;
      if (!blueDelays) blueDelays = new Float32Array(panels.length);
      let max = 0;
      for (let i = 0; i < panels.length; i += 1) {
        const d = panelDelay(panels[i], variant, totalRows);
        blueDelays[i] = d;
        if (d > max) max = d;
      }
      blueWindow = max + blueSurge; // the last panel completes exactly at p=1
      blueVariant = variant;
    };
    apiRef.current.setBlueFillTuning = ({ surge, dipEnd, dipDepth } = {}) => {
      if (surge != null && Number.isFinite(surge) && surge > 0 && surge !== blueSurge) {
        blueSurge = surge;
        blueVariant = null; // window derives from surge — force a rebake
      }
      if (dipEnd != null && Number.isFinite(dipEnd)) {
        blueDipEnd = Math.min(Math.max(dipEnd, 0.01), 0.95);
      }
      if (dipDepth != null && Number.isFinite(dipDepth)) {
        blueDipDepth = Math.min(Math.max(dipDepth, 0), 1);
      }
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
        entranceSettled = true; // every screen is back at full power
        if (director) director.unfreeze();
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
        // …and so would a population swap: land them all, then hold still.
        if (director) director.freeze();
      }
      bakeBlueDelays(variant);
      for (let i = 0; i < panels.length; i += 1) {
        surgePanel(
          panels[i].mesh.material.uniforms,
          Math.min(Math.max((p * blueWindow - blueDelays[panelIndex.get(delayOwner(panels[i]))]) / blueSurge, 0), 1),
          blueDipEnd,
          blueDipDepth
        );
      }
    };

    /* — Population swaps may blink a screen only when nothing else owns
       uPower: after the entrance cascade has landed (or a dry-run restored
       every screen), never during a cascade replay or the commit's fill,
       never under reduced motion. Otherwise swaps land as cuts. — */
    let entranceSettled = false;
    const popCanAnimate = () => {
      if (blueEngaged || PREFERS_REDUCED_MOTION) return false;
      if (cascadeTl) {
        if (cascadeTl.isActive()) return false;
        if (cascadeTl.progress() >= 1) entranceSettled = true;
      }
      return entranceSettled;
    };

    /* — Live video tier (Stage 2; stills only under reduced motion) + the
       meridian scroll (home hero) — both deferred under the intro hold: no HLS
       decodes and no content flow while the globe is glyph-sized. The scheduler
       and scroll start together; releaseScheduler (idempotent) starts them and
       latches the release for any later rebuild; without a hold they start here
       exactly as before. (The scroll globe is already positioned as a sphere at
       build; deferring MeridianScroll only holds the MOTION, not the layout.) — */
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
    // Stream tiers (?poptier, units only): a rung per stream from the unit class
    // it lights and the DPR bucket. The bucket reads the renderer's effective
    // ratio, min(devicePixelRatio, GLOBE_DPR_MAX), once (O9: no re-tier on
    // resize). Null keeps the pool's pin (GLOBE_STREAM_PARAMS) for every stream.
    const bucket = tierBucket(IS_MOBILE, renderer.getPixelRatio());
    const tierFor = (cls) => {
      if (!director || !POP_TUNING.units || POP_TUNING.tier === 'today') return null;
      const rung = STREAM_TIERS[POP_TUNING.tier]?.[bucket]?.[cls];
      return rung ? { rung, floor: POP_TUNING.tier === 'lean' ? 270 : 480 } : null;
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
              tierFor,
              bucket,
            })
          : null;
      // One decode per clip (?poplive=shared) only under a population mode;
      // the flat globe keeps its per-tile decodes.
      scheduler?.setShared(!!director && POP_TUNING.live === 'shared');
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
              assignRow: director ? director.assignRow : null,
            })
          : null;
    };
    if (!hold) startScheduler();
    apiRef.current.releaseScheduler = () => {
      schedulerReleasedRef.current = true;
      startScheduler();
    };

    /* — Population modes (?popmode / the ?poptune bench) — a mode change
       builds or drops the director (never the scene) and re-lays the globe;
       any other pop knob goes to the director (onTune decides what to redo).
       Dropping back to off re-lays the flat pool through the same swap path
       and hands the lattice + chrome back to brand blue; every change
       re-checks the live tier's mode (?poplive, a reset). */
    const tileOwner = {
      textureManager,
      get disposed() {
        return disposed;
      },
      dropLive: (p) => scheduler?.dropLive(p),
    };
    const relayoutFlat = () => {
      if (!assets?.length) return;
      const plan = new Map();
      byProminence.forEach((p, i) => {
        plan.set(p, scroller ? scroller.nextPoolAsset() : assets[i % assets.length]);
      });
      applyPlan(tileOwner, plan, { animate: popCanAnimate() });
    };
    const unsubscribePop = popAvailable
      ? subscribePopTune((key) => {
          if (disposed) return;
          const want = POP_TUNING.mode !== 'off';
          if (want && !director) {
            director = buildDirector();
            if (scroller) scroller.assignRow = director.assignRow;
            director.relayout();
            if (PREFERS_REDUCED_MOTION) director.greet(false);
          } else if (!want && director) {
            director.dispose();
            director = null;
            if (scroller) scroller.assignRow = null;
            relayoutFlat();
            onPopWorld(null, { animate: !PREFERS_REDUCED_MOTION });
          } else if (director && key !== 'mode') {
            director.onTune(key);
          }
          scheduler?.setShared(!!director && POP_TUNING.live === 'shared');
        })
      : null;
    apiRef.current.getFocusProject = () => (director ? director.focusProject() : null);
    apiRef.current.popNext = () => director?.next();
    apiRef.current.popShow = (name) => director?.show(name);
    apiRef.current.popHold = () => director?.hold();

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
    // 10-07 (Nathan): drag-to-spin is OFF on phones for the HOME globe —
    // "it's fighting with page scroll and is not worth having both" (that
    // page's vertical gesture drives the resting footer's reveal). 10-27
    // (Nathan): off on desktop too, so the globe's pose is known ahead and a
    // world's board can be planned (and its clips fetched) before it lands
    // (PopulationDirector.planAhead). The gate is `conveyorMode`: this hook
    // is also /lab/globe's scene, and the lab keeps its drag everywhere.
    const controller = new InteractionController(container, {
      still: conveyorMode,
      drag: !conveyorMode,
    });
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

    // R1 (span telemetry, report-only): device-px height of the most
    // camera-facing unparked tile, from its top and bottom edge on its own meridian.
    const r1A = new THREE.Vector3();
    const r1B = new THREE.Vector3();
    const onSphere = (v, phi, theta) =>
      v.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(RADIUS);
    const frontRowPx = () => {
      let best = null;
      let bestZ = -Infinity;
      for (const p of panels) {
        if (p.parked || p.phiC == null) continue;
        const z = scoreVec.copy(p.centerDir).applyEuler(globeGroup.rotation).z;
        if (z > bestZ) {
          bestZ = z;
          best = p;
        }
      }
      const top = best?.mesh.material.uniforms.uPolarTop?.value;
      if (top == null) return null;
      globeGroup.localToWorld(onSphere(r1A, best.phiC, top)).project(camera);
      globeGroup.localToWorld(onSphere(r1B, best.phiC, top + best.bandHeight)).project(camera);
      return Math.round((Math.abs(r1A.y - r1B.y) / 2) * viewH * renderer.getPixelRatio());
    };

    const tick = (_time, deltaMs) => {
      const dt = deltaMs / 1000;
      accumulated += dt;
      // gsap's ticker reports whole-ms deltas, so a strict 1/FPS_CAP gate skips
      // a 120 Hz screen's 8 + 8 = 16 ms pair and waits for a third frame: 44-47
      // renders a second in a 17/25 ms rhythm (SQ-120). ?globefpstol (2 ms of
      // slack by default; 0 = the strict gate) gives an even 60, the World's
      // ?fpstol pattern. GLOBE_FPS_GATE_S is 1/FPS_CAP − the slack, in seconds.
      if (accumulated < GLOBE_FPS_GATE_S) return;
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
      // Orientation offset (read live; home seeds it from ?herotilt): tilt is
      // applied as (tiltDeg − INITIAL_PITCH), so /lab's default 40 → 0 offset →
      // parity; yaw is an absolute spin (default 0 → parity).
      const orient = tuneRef.current;
      const tiltOff = THREE.MathUtils.degToRad(orient.tiltDeg - INITIAL_PITCH_DEG);
      // Clamp the drag in every mode so the SHOWN tilt (pitch + tiltOff) stays
      // within ±limit, widened to take in a rest the bench parks past it — the
      // globe holds a bounded orientation, so a drag can never strand it past
      // vertical. (Clamping pitch alone, as before 10-24, bounded the shown
      // tilt to rest − 2·limit … rest: fine at the 45.5° bake, past vertical at
      // Nathan's −10°.) /lab (tiltOff 0, rest = limit) keeps ±limit exactly.
      const rest = THREE.MathUtils.degToRad(orient.tiltDeg);
      pitch = Math.max(Math.min(-pitchLimit, rest) - tiltOff, Math.min(Math.max(pitchLimit, rest) - tiltOff, pitch));
      // Steady auto-rotation (?yawspeed, read live): accumulate continuous yaw at
      // yawSpeed °/s, wrapped bounded. 0 → spinYaw stays 0 → parity (fixed globe).
      // Auto-rotation is MOTION, so it is suppressed under reduced motion (the
      // globe holds its pose); the static tilt/yaw offsets below still apply.
      if (!PREFERS_REDUCED_MOTION) {
        spinYaw = (spinYaw + THREE.MathUtils.degToRad(orient.yawSpeed) * step) % (Math.PI * 2);
      }
      globeGroup.rotation.set(
        pitch + tiltOff,
        yaw + spinYaw + THREE.MathUtils.degToRad(orient.yawDeg),
        0
      );
      posed = true;

      // Meridian scroll (home hero): advance the pole-to-pole tile travel on the
      // fixed-tilt globe (writes each row's uPolarTop + refreshes centerDir).
      // Per frame — the polar scroll is continuous. Null-safe: lab/RM never
      // construct it. Runs before render so the frame reflects it, and before
      // the scheduler tick so prominence scores read the fresh centerDir.
      // The population clock (?popmode) runs first: a tide queues its surge
      // on the scroller, which lands it this same frame.
      if (director) director.update(step);
      if (scroller) scroller.update(step);
      // Unit windows (media spans): from the poses this frame renders, so the
      // scroll a tide just landed is in them. No-op with ?popunits off.
      if (director) director.place();
      // Sequence tiles (one panel cycling a project's covers): cut to the shared
      // clock's frame, after place() so the frame renders in this frame's window.
      if (director) director.stepSequences();

      const texBefore = renderer.info.memory.textures;
      const r0 = performance.now();
      // One decoded still onto the GPU per rendered frame (SQ-123): the upload is
      // here, timed with the render, instead of inside a draw that binds ten at once.
      textureManager.pump();
      if (lensRouted) {
        enterLens.composer.render(step); // the Enter World dive only
      } else {
        renderer.render(scene, camera);
      }
      if (director) director.noteRender(performance.now() - r0, renderer.info.memory.textures - texBefore);
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
      const fast = !!scheduler?.handoffFast; // ?pophandoff=fast: a 0.1 s beat, and a change starts its own clips
      if (scheduler && schedClock >= (fast ? HANDOFF_BEAT_S : 0.5)) {
        // dragging defers promotions only — no Hls startups mid-gesture
        // …and while a population relayout is mid-swap (the fast handoff: the worlds it lands may start).
        const busy = !!director?.busy;
        scheduler.update(globeGroup.rotation, sceneTime, camera, controller.dragging || (busy && !fast), busy && fast ? director.incomingWorlds() : null);
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
        const fps = Math.round(framesRendered / statClock);
        if (director) {
          director.sample(globeGroup.rotation, {
            fps,
            gpuTextures: renderer.info.memory.textures,
            dt: statClock,
            r1: frontRowPx(),
          });
        }
        onStats({
          fps,
          textures: renderer.info.memory.textures,
          ...(scheduler ? scheduler.getStats() : {}),
          topPanels: top.map((t) => `${t.id}:${t.score.toFixed(2)}`),
        });
        framesRendered = 0;
        statClock = 0;
      }
    };

    /* — Pause when offscreen or tab hidden — */
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
      apiRef.current.getFocusProject = () => null;
      apiRef.current.popNext = () => {};
      apiRef.current.popShow = () => {};
      apiRef.current.popHold = () => {};
      apiRef.current.setEnterLens = () => {};
      lensIdle?.cancel();
      if (enterLens) {
        enterLens.composer.dispose(); // both targets + the copy pass
        enterLens.pass.dispose();
      }
      if (window.__globeLens) delete window.__globeLens;
      if (unsubscribePop) unsubscribePop();
      unsubscribeScheme();
      if (window.__swmSchemeDebug?.globe === globeDebug) delete window.__swmSchemeDebug.globe;
      if (accentTween) accentTween.kill();
      if (rampTween) rampTween.kill();
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      fadeBackIn.cancel();
      gsap.killTweensOf(renderer.domElement);
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickerActive) gsap.ticker.remove(tick);
      if (cascadeTl) cascadeTl.kill();
      if (scheduler) scheduler.dispose();
      if (scroller) scroller.dispose();
      if (director) director.dispose();
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
  }, [assets, worlds, gapDeg, capDeg]);

  return apiRef;
}
