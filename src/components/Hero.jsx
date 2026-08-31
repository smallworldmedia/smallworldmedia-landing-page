/**
 * Hero — home page hero: the CMS video globe moment.
 *
 * Intro entrance (chunk 5 — replaced the loom): sessionStorage
 * 'swm:hero-intro' gates three modes, decided ONCE at render time (a state
 * initializer, safe on the client:only island — VideoGlobe needs
 * holdEntrance as a prop before the scene builds, and HeroIntro must be in
 * the first commit so its layout effect seeds the glyph rig ahead of the
 * scene's build). FULL (first visit, or ?intro=full|a|c) mounts HeroIntro:
 * the stand-in wordmark "small world media" typeset at display scale with
 * the live globe framed exactly in the o of "world" over a HELD scene (no
 * entrance cascade, no live-video scheduler until the machine releases
 * them), then variant A's zoom or variant C's launch lands the resting
 * comp. REPLAY (revisit / FP-3 return, or ?intro=replay) is a ~1.2s settle
 * straight into the resting comp — veil 1→0 + rig.zoom 0.92→1 on the intro
 * curve, no wordmark, cascade auto-fires as always. Reduced motion renders
 * the static resting comp with instant chrome. The chrome beat — fired by
 * the machine at its own beat, or at settle·0.78 on replay — arms the
 * gesture, stamps data-chromed and broadcasts swm:hero-chrome; the ring,
 * micro CTA, hit target and HeroText all reveal themselves off that one
 * broadcast. Knobs: ?intro ?introms ?introhold ?introcascadeat ?heroink
 * ?introease (heroConfig's intro section, on the ?herotune bench).
 *
 * enter_world is the PRIMARY button — TAP ONLY on every breakpoint (08-30,
 * Nathan: the wheel/touch scroll-to-enter accumulator is RETIRED so the
 * button reads as the "tap to the next layer inward" mechanism the FP page
 * already hints at — inception style). It rests CENTERED in the viewport,
 * floating over the centered globe (the 08-30 comp mirrors mobile on
 * desktop); clicking it (or keyboard Enter) pins the fill blue and fires
 * the Envelopment. The caret strip and the disc-anchored column machinery
 * (--lead-top / --cta-slide) retired with the gesture.
 *
 * Blob-tracking labels (chunk 6, HeroLabels — on by default now, ?herolabels
 * / the bench toggle): mono chips + leader strokes latched to the LIVE
 * panels via the scene api's onLiveChange subscription, running only
 * between the chrome beat and a commit, never under RM.
 *
 * Envelopment (ADR-0002; chunk-4 commit): ONE master timeline drives an
 * eased proxy e 0→1 on the commit curve (HERO_COMMIT_EASE_PATH,
 * ?commitease) and every beat is a clamped remap of e — recenter
 * (offsets/elev → 0 by ?recenterend), the camera dolly through the
 * silhouette (rig.zoom → ?envscale from ?zoomstart), and the blue reaching
 * the viewport THROUGH the globe's shape: ?fillmode=panels surges each
 * panel to field blue on the cascade's own stagger (?bluecascade) before
 * the .hero__fill disc spreads to the corners; =circle blooms the
 * disc-clipped fill directly. At e=1 the persistent RouteFill snaps opaque
 * under the already-blue viewport and owns the cross-route frame while we
 * client-navigate to /work, which releases it over its World. Reduced
 * motion: everything rests immediately; entering is a plain navigation.
 * The ?herotune bench carries the commit knobs + a dry-run that plays the
 * passage and releases instead of navigating. Knobs: ?commitms ?fillmode
 * ?bluecascade ?recenterend ?zoomstart ?commitease ?envscale (RouteFill
 * adds ?fillcover ?fillrelease; WorldCard's enter_world bridge adds
 * ?entercover).
 */
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { navigate } from 'astro:transitions/client';
import VideoGlobe from './globe/VideoGlobe.jsx';
import HeroText from './HeroText.jsx';
import HeroIntro from './hero/HeroIntro.jsx';
import HeroLabels from './hero/HeroLabels.jsx';
import { createHeroOverlay } from './hero/heroOverlay.js';
import {
  TUNING as HERO_TUNING,
  HERO_TUNE_ACTIVE,
  COMMIT_TUNE_ACTIVE,
  HERO_INTRO_EASE_PATH,
  GLOBE_STROKE_FRAC,
  subscribeHeroTune,
} from './hero/heroConfig.js';
import {
  PREFERS_REDUCED_MOTION,
  PANEL_CORNER_RADIUS as GLOBE_PANEL_CORNER_RADIUS,
} from './globe/globeConfig.js';
import { housePulseLoop } from '../lib/motion.js';
// 08-30 (3), Nathan: the home→/work transition carries the FP→detail
// choreography — the SAME enter-tune vocabulary (cover duration, window
// model, pow curve) WorldCard/useWorldScene ride, so the two passages can
// never drift apart.
import {
  ENTER_TUNABLES,
  powInOut as enterPow,
  seg as enterSeg,
} from './work/world/enterTune.js';

gsap.registerPlugin(useGSAP, CustomEase);

/* — Intro session gate (chunk 5; replaced 'swm:loomed') — one read+write
   per page view, same try/catch idiom. RM decides first (dual-guard's
   outer half — nothing intro-shaped may run there); ?intro forces a mode
   regardless of the session flag; otherwise first visit = full, revisit
   (FP-3 returns included) = replay. — */
const INTRO_SESSION_KEY = 'swm:hero-intro';
const decideIntroMode = () => {
  if (typeof window === 'undefined' || PREFERS_REDUCED_MOTION) return 'rm';
  const p = new URLSearchParams(window.location.search).get('intro');
  const forced =
    p === 'full' || p === 'a' || p === 'c' ? 'full' : p === 'replay' ? 'replay' : null;
  let seen = false;
  try {
    seen = sessionStorage.getItem(INTRO_SESSION_KEY) === '1';
    sessionStorage.setItem(INTRO_SESSION_KEY, '1');
  } catch {
    /* storage unavailable — every visit is the first */
  }
  return forced ?? (seen ? 'replay' : 'full');
};

/* — 08-24: the lockup-morph machine (HeroIntro's chars→globe launch) is
   RETIRED from the default path — the nav carries the full lockup now, so
   the entrance no longer spells the wordmark. ?intro=a|c still mounts the
   old machine for reference/comparison; without it, 'full' runs the ARRIVE
   settle below. — */
const INTRO_FORCED_VARIANT = (() => {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search).get('intro');
  return p === 'a' || p === 'c';
})();

/* — Replay settle — revisits skip the wordmark: veil 1→0 + rig.zoom
   0.92→1 on the intro curve, straight into the resting comp. The chrome
   beat keeps its loom-era place at duration·0.78; the forced-variant
   machine fires its own beat (HeroIntro). — */
const REPLAY_SECONDS = 1.2;
const REPLAY_ZOOM_FROM = 0.92;
const CHROME_BEAT_AT = 0.78;

/* — Arrive settle (08-24) — the DEFAULT first-visit entrance: the globe
   subtly scales into the resting comp (rig.zoom 0.94→1 on the intro curve)
   while the panel cascade paints it; the veil thins across the same window.
   Chrome beat + live-video scheduler release at the settle's beat point.
   Longer than the replay settle so the cascade has room to read. — */
const ARRIVE_SECONDS = 2.2;
const ARRIVE_ZOOM_FROM = 0.94;
const ARRIVE_CASCADE_AT = 0.4; // s into the settle — panels cascade as it scales

/* — Envelopment (chunk-4 commit) — the dolly's destination scale; the
   timeline length and the rest of the choreography live on heroConfig's
   commit section (?commitms ?fillmode ?bluecascade ?recenterend
   ?zoomstart). */
/* 08-25: ?envscale moved into heroConfig TUNING (envScale) so the typed
   commit panel can dial it live — read from HERO_TUNING at commit time. */

/* Power in-out easing for the commit's camera channels — smooth at BOTH ends
   (zero velocity in, zero velocity out; no overshoot), curvature set by pow.
   Each channel gets its own window on the LINEAR dive progress, so recenter
   and zoom overlap into one cohesive fluid motion (Nathan, 08-25) instead of
   compounding through the flat-tailed Turn curve. */
const powInOut = (t, pow) =>
  t < 0.5 ? 0.5 * Math.pow(2 * t, pow) : 1 - 0.5 * Math.pow(2 * (1 - t), pow);

/* — Rounded panel tiles (note 5) — UV-space radius the home globe passes to
   VideoGlobe (lockup fidelity, the SWM mark's panels carry a corner radius).
   Home-only: /lab and /process get the default 0 (hard edges). Lives in
   globeConfig now so heroConfig's bench can seed ?corner from the same value. — */
const PANEL_CORNER_RADIUS = GLOBE_PANEL_CORNER_RADIUS;

/* — Commit beat map (08-25: CONCURRENT windows — the blue-first doctrine is
   retired per Nathan: "the blue panel fill occurs DURING the zoom and center
   motion"). ONE linear timeline `raw.p`; every channel is a window on it:
   · BLUE over [?bluestart .. ?blueend]: the panels cascade to field blue
     (or, circle mode, the disc blooms to the silhouette) WHILE the camera
     moves — fully overlapping choreography.
   · RECENTER over [?recenterstart .. ?recenterend] and DOLLY over
     [?zoomstart .. ?zoomend] (rig.zoom → ?envscale), each on its own
     power-inOut curve (?campow) — smooth both ends, no overshoot.
   · The .hero__fill disc spreads to the viewport corners over
     [?blueend .. 0.98], taking over from the painted globe at its edge →
     handoff at raw 1. — */
const SPREAD_PANELS_END = 0.98; // raw: .hero__fill disc fully covers the viewport
const SPREAD_CIRCLE_END = 0.98;
const FILL_DISC_PAD = 1.03; // fill circle slightly proud of the disc (bgMorph precedent)
const CHROME_OUT_SECONDS = 0.2; // the one real-time beat — the chrome exit
const HANDOFF_COVER_SECONDS = 0.05; // RouteFill's snap under the covered viewport
const DRYRUN_RETURN_SECONDS = 0.6; // rig back to the resting pose, expo.out

/* Clamped remap: where a beat lives on its progress window. */
const seg = (e, a, b) => Math.min(1, Math.max(0, (e - a) / (b - a)));

/* — 08-30: the scroll-fill gesture is RETIRED (SCROLL_TRIGGER / drag lean /
   RouteFill pre-cover all gone with it) — enter_world is TAP ONLY on every
   breakpoint. The pill's presentation reduces to rest / hover / commit-pin
   (the presentation vars block). — */

/* — Globe outer stroke (Globe/Homepage): a flat electric-blue disc behind the
   canvas, sized GLOBE_STROKE_FRAC proud of the globe disc so only a thin ring
   shows at the silhouette (the lockup mark's outer stroke), scaling with the
   intro zoom. The fraction (?globestroke, default 5%, 0 = off) is sourced from
   heroConfig so HeroIntro can compensate the glyph framing by the same amount
   (globe + stroke = the lockup "o"). — */

export default function Hero({ globeAssets }) {
  const heroRef = useRef(null);
  const veilRef = useRef(null);
  const armedRef = useRef(false);
  const departingRef = useRef(false);
  const enterWrapRef = useRef(null); // FP-1 fill-pulse target (see the pulse effect)
  const strokeRef = useRef(null); // globe outer-stroke disc (tracks the overlay disc)

  // enter_world button state — tap-only (08-30): the drag fill model reduced
  // to one commit-pin flag; hover pours via ctaHover below.
  const [ctaPinned, setCtaPinned] = useState(false);

  // FP-1 fill pulse, home reading (08-27): loop --cta-pulse 0 → 1 → 0 on the
  // house envelope. Lives on the wrap (no React inline style there); the
  // button's --cta-bg color-mix folds it in below. Reduced motion: never runs.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const wrap = enterWrapRef.current;
    if (!wrap) return undefined;
    gsap.set(wrap, { '--cta-pulse': 0 }); // explicit start value for the var tween
    const pulse = housePulseLoop(gsap, wrap, { '--cta-pulse': 1 });
    return () => pulse.kill();
  }, []);
  const [ctaHover, setCtaHover] = useState(false);

  // Camera rig + overlay bridge (home-hero rework, chunk 2). The scene fills
  // rigRef with { rig, apply }; the overlay is created here (lazy ref init —
  // pure, SSR-safe) so the ring/hit/labels can onFrame() before or after the
  // scene mounts.
  const rigRef = useRef(null);
  const overlayRef = useRef(null);
  if (overlayRef.current === null) overlayRef.current = createHeroOverlay();

  // Scene api mirror ({ replayCascade, setBlueFill, setInk,
  // releaseScheduler } — VideoGlobe aliases the hook's api ref here; the
  // intro machine drives the chunk-5 pair) + the commit's blue surface.
  const sceneApiRef = useRef(null);
  const fillRef = useRef(null);
  // Live commit teardown — kills the master timeline / overlay sub (or the
  // dry-run return tween) if the island unmounts or a new commit starts
  // while one is still settling.
  const commitKillRef = useRef(null);
  useEffect(() => () => commitKillRef.current?.(), []);

  // Camera zoom proxy — the entrance settles and the envelopment glide
  // continue from the same value (GSAP overwrite arbitration on one target;
  // the drag gesture that used to share it retired 08-30).
  const zoomRef = useRef({ v: 1 });
  const applyZoom = () => {
    const handle = rigRef.current;
    if (!handle) return;
    handle.rig.zoom = zoomRef.current.v;
    handle.apply();
  };

  // ── Intro mode — decided ONCE at render (chunk 5) ──
  // A state initializer, not an effect: VideoGlobe needs holdEntrance
  // before the scene builds, and HeroIntro must be in the first commit so
  // its layout effect seeds the glyph rig ahead of the scene's build.
  const [introMode] = useState(decideIntroMode);
  // HeroIntro mounts ONLY under the forced variants (?intro=a|c) — the
  // default 'full' entrance is the arrive settle (no wordmark machine).
  const [introOn, setIntroOn] = useState(introMode === 'full' && INTRO_FORCED_VARIANT);
  const [introRun, setIntroRun] = useState(0); // bench replays remount by key
  // The machine owns the rig (glyph pose → launch) until its handoff — the
  // tuning effect defers to it; a bench write mid-intro lands at the stamp.
  // The arrive/replay settles never own the pose (zoom rides the gesture
  // proxy), so they count as "done" from the start.
  const introDoneRef = useRef(!(introMode === 'full' && INTRO_FORCED_VARIANT));

  // The chrome beat: arm the button, stamp the latch, broadcast — the
  // labels reveal themselves off the event (they can mount after it fires),
  // Hero fades what it owns directly (the CTA button wrap). Fired by the
  // replay settle / RM path here, and by HeroIntro's machine in full mode.
  const chromeBeat = (instant) => {
    const hero = heroRef.current;
    if (!hero) return;
    armedRef.current = true;
    hero.dataset.chromed = '1';
    // Dispatch OUTSIDE the caller's gsap context. A tween created
    // synchronously inside a context-owned animation's callback is ADOPTED
    // by that context (gsap 3.11 context inheritance) — SiteNav's reveal
    // tween was adopted into this island's useGSAP context and REVERTED at
    // unmount, re-hiding the nav after the commit swap (08-25 bug, caught
    // by stack trap). One rAF breaks the adoption chain for every listener.
    requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('swm:hero-chrome')));
    // 08-30: the hero lockup (and its word-beat entrance) retired — the NAV
    // carries the brand on home now. The done broadcast SiteTagline keys its
    // one-time intro off still fires, straight from this beat (rAF-deferred,
    // the 08-25 adoption doctrine).
    requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent('swm:hero-lockup-done'))
    );
    const owned = hero.querySelectorAll('.hero__enter-wrap');
    if (instant) gsap.set(owned, { autoAlpha: 1 });
    else gsap.to(owned, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
  };

  // Push the hero tuning (URL-seeded; the resting comp without params) onto
  // the live rig, and re-push on any bench change. zoom is deliberately not
  // written here — it's gesture-owned (zoomRef), never a bench value.
  const stampTuning = () => {
    const handle = rigRef.current;
    if (!handle) return;
    handle.rig.fill = HERO_TUNING.fill;
    handle.rig.fitCover = HERO_TUNING.fitCover;
    handle.rig.offsetX = HERO_TUNING.offsetX;
    handle.rig.offsetY = HERO_TUNING.offsetY;
    handle.rig.elevDeg = HERO_TUNING.elevDeg;
    handle.rig.roll = HERO_TUNING.roll;
    handle.apply();
  };
  // Push the globe's own tunables (pole cap / corner rounding, brand
  // orientation, scroll pace) onto the live scene api. Independent of the
  // camera rig AND the intro machine — the pole treatment applies during the
  // intro too — so this is ungated. No-op until the globe api is up (VideoGlobe
  // aliases it), and the values equal the baked defaults unless a URL/bench
  // change moved them, so an untouched load is a no-op.
  const stampGlobeTuning = () => {
    const api = sceneApiRef.current;
    if (!api) return;
    api.setPoleTuning({
      lift: HERO_TUNING.poleLift,
      tip: HERO_TUNING.poleTip,
      wide: HERO_TUNING.poleWide,
      start: HERO_TUNING.poleStart,
      cornerR: HERO_TUNING.cornerR,
    });
    api.setGlobeOrientation({
      tiltDeg: HERO_TUNING.tiltDeg,
      yawDeg: HERO_TUNING.yawDeg,
      yawSpeed: HERO_TUNING.yawSpeed,
    });
    api.setCascadeSpeed(HERO_TUNING.cascadeSpeed);
    api.setPoleCap(HERO_TUNING.poleCapDeg);
    // 08-25: commit blue-fill surge shape (?bluesurge ?bluedipend ?bluedipdepth).
    api.setBlueFillTuning?.({
      surge: HERO_TUNING.blueSurge,
      dipEnd: HERO_TUNING.blueDipEnd,
      dipDepth: HERO_TUNING.blueDipDepth,
    });
  };
  useEffect(() => {
    const applyTuning = () => {
      stampGlobeTuning(); // globe uniforms/orientation/pace — always, intro included
      if (!introDoneRef.current) return; // the intro machine owns the camera rig
      stampTuning();
    };
    applyTuning();
    return subscribeHeroTune(applyTuning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The machine's handoff: restore the device fit axis + TUNING pose (the
  // launch ended on the contain-equivalent fill — the same fill·tanFit
  // product, so the axis swap is seamless), then drop the wordmark layer.
  const onIntroDone = () => {
    introDoneRef.current = true;
    stampTuning();
    setIntroOn(false);
  };

  // Bench action (?herotune): re-run the entrance. Default path = the arrive
  // settle (cascade replays; the live-video scheduler is already running and
  // stays running — accepted, the bench note says so). Forced ?intro=a|c =
  // remount the old machine by key (glyph rig re-seeds through the live
  // handle).
  const onReplayIntro = () => {
    if (introMode === 'rm' || departingRef.current) return;
    armedRef.current = false; // re-arms at the entrance's chrome beat
    if (!INTRO_FORCED_VARIANT) {
      runEntranceSettle(ARRIVE_SECONDS, ARRIVE_ZOOM_FROM, true);
      return;
    }
    introDoneRef.current = false;
    setIntroRun((n) => n + 1);
    setIntroOn(true);
  };

  // Hero rig tuning bench — mount only AFTER hydration (SiteShell's
  // LenisTunePanel convention): HERO_TUNE_ACTIVE reads the URL, which must
  // not influence the first client render (SSR parity). Code-split on the same
  // effect, so neither the bench nor its stylesheet (imported inside the panel)
  // rides the shipped hero payload. The state holds the component, so the setter
  // takes the UPDATER form — setHeroTunePanel(Component) would run a function
  // value as a reducer instead of storing it.
  // Typed commit-choreography panel (?committune=1) — same lazy-mount
  // convention; number inputs instead of sliders (Nathan, 08-25).
  const [CommitTunePanel, setCommitTunePanel] = useState(null);
  useEffect(() => {
    if (!COMMIT_TUNE_ACTIVE) return undefined;
    let alive = true;
    import('./hero/CommitTunePanel.jsx')
      .then((m) => {
        if (alive) setCommitTunePanel(() => m.default);
      })
      .catch(() => {
        /* dev bench only */
      });
    return () => {
      alive = false;
    };
  }, []);

  const [HeroTunePanel, setHeroTunePanel] = useState(null);
  useEffect(() => {
    if (!HERO_TUNE_ACTIVE) return;
    // `alive` guards the late resolve (a ClientRouter swap can unmount the hero
    // before the chunk lands). StrictMode's dev double-invoke re-imports from
    // the module cache and re-sets, so the second pass still mounts the panel.
    let alive = true;
    import('./hero/HeroTunePanel.jsx')
      .then((m) => {
        if (alive) setHeroTunePanel(() => m.default);
      })
      .catch(() => {
        /* dev bench only — a blocked/offline chunk just means no panel */
      });
    return () => {
      alive = false;
    };
  }, []);

  // Blob-tracking labels (chunk 6) — on by default now (TUNING.labels;
  // ?herolabels=0 forces off) with RM's outer guard here (HeroLabels dual-
  // guards inside). Same post-hydration gate — the URL-seeded flag must
  // not touch the first client render — plus a live tune subscription so
  // the bench toggle mounts/unmounts the layer and a labelMax change
  // re-keys it (the slot count is a mount-time build).
  const [labelsOn, setLabelsOn] = useState(false);
  const [labelsMax, setLabelsMax] = useState(2);
  useEffect(() => {
    const sync = () => {
      setLabelsOn(HERO_TUNING.labels && !PREFERS_REDUCED_MOTION);
      setLabelsMax(HERO_TUNING.labelMax);
    };
    sync();
    return subscribeHeroTune(sync);
  }, []);

  // Scene is mounting — release the Envelopment fill if this arrival came
  // through it (/work first-World scroll-up home, FP-3 — the reverse passage
  // under the persistent RouteFill, ADR-0002). No-op on direct loads: the
  // fill is only ever up mid-passage.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);

  const beginEnvelopment = ({ dryRun = false } = {}) => {
    if (departingRef.current) return;
    departingRef.current = true;
    armedRef.current = false;
    commitKillRef.current?.(); // a dry-run return tween may still be settling
    commitKillRef.current = null;

    if (PREFERS_REDUCED_MOTION) {
      // RM dual-guard: no theatrics — and nothing to rehearse on a dry run.
      if (dryRun) {
        departingRef.current = false;
        armedRef.current = true;
        return;
      }
      navigate('/work'); // /work initializes already inside
      return;
    }

    const handle = rigRef.current;
    const sceneApi = sceneApiRef.current;
    const fill = fillRef.current;
    const chrome = heroRef.current.querySelectorAll(
      '.hero__lead-col, .hero-labels'
    );
    // Commit-time snapshot of the bench knobs — the timeline is one shot;
    // a mid-flight TUNING write waits for the next commit/dry-run.
    const {
      fillMode,
      blueCascade,
      blueStart,
      blueEnd,
      recenterStart,
      recenterEnd,
      zoomStart,
      zoomEnd,
      camPow,
      envScale,
      commitMs,
    } = HERO_TUNING;

    // Recenter/zoom starts — FROM wherever the live rig sits (the resting
    // TUNING pose, a bench value, a mid-settle zoom), never from defaults.
    // The master onUpdate owns the zoom proxy: kill any live settle tween
    // instead of tweening over it (zoom is a remap of e like everything
    // else).
    gsap.killTweensOf(zoomRef.current);
    const startX = handle ? handle.rig.offsetX : 0;
    const startY = handle ? handle.rig.offsetY : 0;
    const startElev = handle ? handle.rig.elevDeg : 0;
    const startZoom = zoomRef.current.v;

    // Latest overlay disc, cached per scene frame (hoisted once per commit;
    // the stamp path allocates nothing per frame beyond the style string).
    const disc = { cx: 0, cy: 0, r: 0, w: 1, h: 1 };
    const unsub = overlayRef.current.onFrame((frame) => {
      disc.cx = frame.disc.cx;
      disc.cy = frame.disc.cy;
      disc.r = frame.disc.r;
      disc.w = frame.w;
      disc.h = frame.h;
    });

    /* .hero__fill — the DOM surface the blue reaches the viewport through.
       Its visibility flips ON only once its window opens (the fillOn latch),
       and every state flip is an IMPERATIVE gsap.set fired from the running
       timeline — NEVER tl.set: a set is itself a tween of the element, and
       any killTweensOf on it would silently eat the scheduled flip (the
       /process bgMorph stuck-clipped-circle bug commemorates this). */
    let fillOn = false;
    const coverRadius = () =>
      Math.hypot(Math.max(disc.cx, disc.w - disc.cx), Math.max(disc.cy, disc.h - disc.cy));
    const driveFill = (p) => {
      // p is RAW timeline progress; the fill windows key off blueEnd (08-25:
      // the blue paints DURING the camera motion over [blueStart, blueEnd])
      // — the disc→corners spread takes over once the globe is painted.
      if (!fill) return;
      let radius;
      const r0 = disc.r * FILL_DISC_PAD;
      if (fillMode === 'circle') {
        // circle: the disc blooms 0 → the silhouette over the blue window
        // (this mode's "paint the globe" beat, in place of the panel
        // cascade), then spreads disc → corners over [blueEnd, end].
        const grow = seg(p, blueStart, blueEnd);
        if (grow <= 0) return;
        const spread = seg(p, blueEnd, SPREAD_CIRCLE_END);
        radius = spread > 0 ? r0 + (coverRadius() - r0) * spread : r0 * grow;
      } else {
        // panels: the panels are field blue by blueEnd; the div takes over
        // at the disc edge and carries the blue to the corners after it.
        const spread = seg(p, blueEnd, SPREAD_PANELS_END);
        if (spread <= 0) return;
        radius = r0 + (coverRadius() - r0) * spread;
      }
      // Clip BEFORE the reveal — no unclipped first frame (bgMorph).
      fill.style.clipPath = `circle(${radius.toFixed(1)}px at ${disc.cx.toFixed(1)}px ${disc.cy.toFixed(1)}px)`;
      if (!fillOn) {
        fillOn = true;
        gsap.set(fill, { autoAlpha: 1 });
      }
    };

    // e=1, real commit: the viewport is already solid blue — the persistent
    // RouteFill snaps opaque under one beat and owns the cross-route frame;
    // the hero island (fill div included) unmounts with the swap. The old
    // t=0 `swm:envelop` dispatch is GONE — the hero owns the passage visual.
    const handoff = () => {
      unsub();
      commitKillRef.current = null;
      window.dispatchEvent(
        // loader: true — the home→/work passage shows the overviews_loading
        // bar on the RouteFill while the World builds (08-25; other
        // passages stay bare).
        new CustomEvent('swm:envelop', { detail: { duration: HANDOFF_COVER_SECONDS, loader: true } })
      );
      navigate('/work');
    };

    // e=1, dry run (?herotune bench): same passage, then hand everything
    // back — blue restored, fill cleared, rig eased home, chrome returns.
    const releaseDryRun = () => {
      unsub();
      sceneApi?.setBlueFill(0); // full restore — uBlueMix 0, uPower 1
      // Endpoint flip — imperative, never tl.set (see driveFill's note).
      if (fill) gsap.set(fill, { autoAlpha: 0, clipPath: 'none' });
      if (handle) {
        // Back to the resting TUNING pose + zoom 1 — one proxy, one
        // apply() per frame, expo.out (house release curve, no overshoot).
        const fx = handle.rig.offsetX;
        const fy = handle.rig.offsetY;
        const fe = handle.rig.elevDeg;
        const fz = zoomRef.current.v;
        const back = { t: 0 };
        const backTween = gsap.to(back, {
          t: 1,
          duration: DRYRUN_RETURN_SECONDS,
          ease: 'expo.out',
          onUpdate: () => {
            handle.rig.offsetX = fx + (HERO_TUNING.offsetX - fx) * back.t;
            handle.rig.offsetY = fy + (HERO_TUNING.offsetY - fy) * back.t;
            handle.rig.elevDeg = fe + (HERO_TUNING.elevDeg - fe) * back.t;
            zoomRef.current.v = fz + (1 - fz) * back.t;
            handle.rig.zoom = zoomRef.current.v;
            handle.apply();
          },
        });
        commitKillRef.current = () => backTween.kill();
      }
      setCtaPinned(false);
      gsap.to(chrome, { autoAlpha: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      departingRef.current = false;
      armedRef.current = true; // the button is live again
    };

    /* — ONE linear master timeline `raw.p` (see the beat map). Blue, recenter
       and dolly each ease through their own window on it, fully concurrent
       (08-25 — the blue-first hold and the shared Turn-curve remap both
       retired; ?commitease and ?bluelead with them). `raw.p` is linear so
       every window reads at any ?commitms; the only other clock is the 0.2s
       real-time chrome exit (house-sanctioned exception). — */
    const raw = { p: 0 };
    const tl = gsap.timeline({ onComplete: dryRun ? releaseDryRun : handoff });
    // 08-27 (4), Nathan: the overviews_loading chrome opens EARLY —
    // ?loaderlead ms after the commit starts, over the spreading blue (it
    // used to exist only between the handoff and /work's release, no time to
    // run its charge). rAF-deferred dispatch so RouteFill's tweens are never
    // adopted into this island's gsap context; dry runs stay bare.
    if (!dryRun) {
      gsap.delayedCall(Math.max(0, HERO_TUNING.loaderLeadMs) / 1000, () =>
        requestAnimationFrame(() =>
          window.dispatchEvent(new CustomEvent('swm:loader-start'))
        )
      );
    }
    // Chrome out — the button stays until the spreading blue swallows it.
    tl.to(
      chrome,
      { autoAlpha: 0, duration: CHROME_OUT_SECONDS, ease: 'power2.out', overwrite: true },
      0
    );
    tl.to(
      raw,
      {
        p: 1,
        duration: commitMs / 1000,
        ease: 'none',
        onUpdate: () => {
          const p = raw.p;
          // CONCURRENT CHANNELS (08-25, Nathan): the blue paints DURING the
          // camera motion — panels surge to field blue over the blue window
          // [blueStart, blueEnd] on the cascade's own stagger (circle mode
          // blooms the disc instead — driveFill owns that below) WHILE each
          // camera channel (recenter, dolly) rides its OWN power-inOut
          // window on the same linear timeline. Everything overlaps as one
          // cohesive motion; the windows are the choreography.
          if (fillMode === 'panels') {
            sceneApi?.setBlueFill(seg(p, blueStart, blueEnd), blueCascade);
          }
          driveFill(p);
          if (handle) {
            const rc = powInOut(seg(p, recenterStart, recenterEnd), camPow);
            handle.rig.offsetX = startX * (1 - rc);
            handle.rig.offsetY = startY * (1 - rc);
            handle.rig.elevDeg = startElev * (1 - rc);
            const z = powInOut(seg(p, zoomStart, zoomEnd), camPow);
            zoomRef.current.v = startZoom + (envScale - startZoom) * z;
            handle.rig.zoom = zoomRef.current.v;
            handle.apply(); // ONE apply for every rig write this frame
          }
        },
      },
      0
    );
    commitKillRef.current = () => {
      tl.kill();
      unsub();
    };
  };

  // Click/keyboard commit (the button) — THE way in (tap-only, 08-30).
  // 08-30 (3), Nathan: the passage carries the FP→detail choreography —
  // the RouteFill cover rises over ?enterms while the CAMERA dives on the
  // enter-tune window model (the open-ended moveEnd-2 read: still steeply
  // mid-rise at the handoff, never parked), then client-navigate. One
  // gesture vocabulary across home→/work→detail. The old chunk-4 master
  // timeline (blue cascade + recenter + fill spread) is retired from this
  // path — the ?herotune bench's dry-run still rehearses it for reference.
  const onEnterClick = () => {
    if (departingRef.current) return;
    setCtaPinned(true);
    if (PREFERS_REDUCED_MOTION) {
      navigate('/work'); // RM: plain navigation, no theatrics
      return;
    }
    departingRef.current = true;
    armedRef.current = false;
    commitKillRef.current?.(); // a bench dry-run may still be settling
    const { enterMs, scale, moveStart, moveEnd, pow } = ENTER_TUNABLES;
    const coverS = enterMs / 1000;
    window.dispatchEvent(
      // loader: true — home→/work still shows overviews_loading while the
      // World builds (the FP→detail passage stays bare). Brand blue: home
      // never knows the arriving World's accent, and home IS blue.
      new CustomEvent('swm:envelop', { detail: { duration: coverS, loader: true } })
    );
    // 08-31: the tagline's letters cut out in random order under the rising
    // cover — the FP→detail letter-exit carried to this passage (the
    // persistent SiteTagline island owns the cuts + the after-swap restore).
    window.dispatchEvent(new CustomEvent('swm:tagline-exit'));
    // The camera dive under the rising cover — rig.zoom rides the SAME
    // window + pow the World's projection zoom rides in useWorldScene.
    gsap.killTweensOf(zoomRef.current);
    const startZoom = zoomRef.current.v;
    const raw = { p: 0 };
    const tl = gsap.to(raw, {
      p: 1,
      duration: coverS,
      ease: 'none',
      onUpdate: () => {
        const z = enterPow(enterSeg(raw.p, moveStart, moveEnd), pow);
        zoomRef.current.v = startZoom + (scale - startZoom) * z;
        applyZoom();
      },
    });
    commitKillRef.current = () => tl.kill();
    // setTimeout, not delayedCall — the island's gsap context dies with the
    // swap and must not take the navigation with it (WorldCard's idiom).
    setTimeout(() => navigate('/work'), enterMs + 60);
  };

  // Bench rehearsal (?herotune) — pin the fill like a real commit, then
  // play the commit timeline with the dry-run release instead of the
  // navigation.
  const onCommitDryRun = () => {
    setCtaPinned(true);
    beginEnvelopment({ dryRun: true });
  };

  // ── Entrance dispatch — by the render-time intro mode (chunk 5) ──
  // The scene api can lag the settle's early beats (three build + textures) —
  // retry until it lands rather than dropping the beat (a missed cascade on a
  // held entrance would leave the globe dark).
  const withSceneApi = (fn) => {
    const attempt = () => {
      const api = sceneApiRef.current;
      if (api) fn(api);
      else gsap.delayedCall(0.15, attempt);
    };
    attempt();
  };
  // Shared settle: veil 1→0 + rig.zoom from→1 on the intro curve, straight
  // into the resting comp (rig.zoom, not a DOM scale). zoom rides the gesture
  // proxy so a drag mid-settle takes over cleanly (killTweensOf arbitration,
  // one target). `arrive` adds the cascade + scheduler release (the held
  // first-visit build); the replay scene cascades on its own at mount.
  const runEntranceSettle = (secs, from, arrive) => {
    const veil = veilRef.current;
    zoomRef.current.v = from;
    applyZoom();
    const settleEase = CustomEase.create('swmHeroIntroSettle', HERO_INTRO_EASE_PATH);
    gsap.set(veil, { opacity: 1 });
    const tl = gsap.timeline();
    tl.to(zoomRef.current, { v: 1, duration: secs, ease: settleEase, onUpdate: applyZoom }, 0);
    tl.to(veil, { opacity: 0, duration: secs, ease: settleEase }, 0);
    if (arrive) {
      tl.add(() => withSceneApi((api) => api.replayCascade('sweep')), ARRIVE_CASCADE_AT);
      tl.add(() => withSceneApi((api) => api.releaseScheduler()), secs * CHROME_BEAT_AT);
    }
    tl.add(() => chromeBeat(false), secs * CHROME_BEAT_AT);
  };
  useGSAP(
    () => {
      const veil = veilRef.current;

      if (introMode === 'rm') {
        // RM dual-guard's other half: no theatrics — the static resting
        // comp, instant chrome, veil gone.
        gsap.set(veil, { opacity: 0 });
        chromeBeat(true);
        return;
      }

      if (introMode === 'replay' || (introMode === 'full' && !INTRO_FORCED_VARIANT)) {
        // Arrive (default first visit) / replay (revisit) settle. This
        // layout effect runs BEFORE the scene's passive build — pre-seed
        // the rig-carry so the very first rendered frame is already at the
        // from-zoom (HeroIntro's pre-seed idiom; the resting pose comes
        // from TUNING, which the tuning effect re-stamps identically).
        const arrive = introMode === 'full';
        const from = arrive ? ARRIVE_ZOOM_FROM : REPLAY_ZOOM_FROM;
        if (!rigRef.current) {
          rigRef.current = {
            rig: {
              fill: HERO_TUNING.fill,
              fitCover: HERO_TUNING.fitCover,
              offsetX: HERO_TUNING.offsetX,
              offsetY: HERO_TUNING.offsetY,
              elevDeg: HERO_TUNING.elevDeg,
              roll: HERO_TUNING.roll,
              zoom: from,
            },
            apply: () => {},
          };
        }
        runEntranceSettle(arrive ? ARRIVE_SECONDS : REPLAY_SECONDS, from, arrive);
        return;
      }

      // forced variant (?intro=a|c) — HeroIntro owns the entrance end to end
      // (veil, glyph rig, cascade beat, chrome beat, scheduler release);
      // nothing to conduct.
    },
    { scope: heroRef }
  );

  // ── (08-30) The disc-anchored column effect is RETIRED — the CTA column
  // is viewport-centered by CSS on every breakpoint (no --lead-top /
  // --cta-slide / --lockup-center-y writes). The overlay bridge stays warm
  // through the globe-stroke subscriber below (and computes on demand for
  // the commit's own subscription regardless). ──

  // ── Globe outer stroke — track the live disc every frame ──
  // Transform-only (a 200px base circle translated + scaled to the live
  // diameter, just proud of the disc), so it's compositor-cheap despite running
  // per frame. Hidden until the first real disc lands; sized proud so only a
  // thin ring shows past the (opaque) globe silhouette — the lockup outer stroke
  // that scales through the intro zoom / commit. Off entirely at ?globestroke=0.
  useEffect(() => {
    const overlay = overlayRef.current;
    const el = strokeRef.current;
    if (!overlay || !el || GLOBE_STROKE_FRAC <= 0) return undefined;
    const BASE = 200;
    let shown = false;
    const unframe = overlay.onFrame((frame) => {
      const { cx, cy, r } = frame.disc;
      if (!r) return;
      const d = 2 * r * (1 + GLOBE_STROKE_FRAC);
      el.style.transform = `translate(${(cx - d / 2).toFixed(1)}px, ${(cy - d / 2).toFixed(1)}px) scale(${(d / BASE).toFixed(4)})`;
      if (!shown) {
        shown = true;
        el.style.visibility = 'visible';
      }
    });
    return unframe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── (08-30) The wheel/touch scroll-fill accumulator is RETIRED —
  // enter_world commits on tap/click/Enter only, on every breakpoint (the
  // "tap to the next layer inward" mechanism). Drag lean, rubber-band
  // release and the RouteFill pre-cover all went with it. ──

  // ── enter_world button presentation vars — tap-only model (08-30): the
  // pill rests on the pulsing brand-blue base, hover pours WHITE over it,
  // and a commit pins the poured state while the passage plays. No slide,
  // no scaling — the button lives at the viewport center. ──
  const ctaPct = ctaPinned || ctaHover ? 100 : 0;
  const ctaColor = {
    // 08-27 (4) redial (Nathan): the DEFAULT state is BRAND BLUE, pulsing
    // down to --color-dim-gray on the house pulse (--cta-pulse 0..1, tweened
    // on the wrap so React's inline style here never fights GSAP's var
    // writes). Hover and the scroll charge pour WHITE over the breathing
    // base (ctaPct swamps the pulse — no gating logic), the label crossing
    // to blue for legibility — the chip lands on /work already wearing that
    // page's white enter_world skin.
    '--cta-bg': `color-mix(in srgb, color-mix(in srgb, var(--color-electric-blue), var(--color-dim-gray) calc(var(--cta-pulse, 0) * 100%)), var(--color-white) ${ctaPct}%)`,
    '--cta-fg': `color-mix(in srgb, var(--color-white), var(--color-electric-blue) ${ctaPct}%)`,
  };

  return (
    <section className="hero" ref={heroRef}>
      {/* Black start-state over the gradient — the intro field: it paints
          BELOW the canvas, so the wordmark phase gets black + live globe
          for free. The machine (full) / settle (replay) thins it away. */}
      <div className="hero__veil" ref={veilRef} aria-hidden="true" />
      {/* Globe outer stroke — behind the canvas, tracks the disc (Hero effect). */}
      {GLOBE_STROKE_FRAC > 0 && (
        <div className="hero__globe-stroke" ref={strokeRef} aria-hidden="true" />
      )}
      <div className="hero__globe">
        <VideoGlobe
          assets={globeAssets}
          rigRef={rigRef}
          overlayRef={overlayRef}
          sceneApiRef={sceneApiRef}
          holdEntrance={introMode === 'full'}
          cascadeSpeed={HERO_TUNING.cascadeSpeed}
          cornerRadius={PANEL_CORNER_RADIUS}
        />
      </div>
      {/* enter_world column — CENTERED in the viewport on every breakpoint
          (08-30, the tap-only comp: the button floats at the centered
          globe's heart — "tap to the next layer inward"). The hero lockup
          and caret strip that used to share this band are RETIRED (the NAV
          carries the brand on home now). Pointer-inert wrapper (drag-to-spin
          reaches the canvas); only the button opts back in. Revealed on the
          chrome beat, faded on the commit (.hero__lead-col in the chrome
          NodeList). HeroText keeps the sr-only h1 (SEO/a11y). */}
      <div className="hero__lead-col">
        <HeroText />
        <div className="hero__enter-wrap" ref={enterWrapRef}>
          <button
            type="button"
            className="cta-primary hero__enter"
            style={ctaColor}
            onClick={onEnterClick}
            onPointerEnter={() => setCtaHover(true)}
            onPointerLeave={() => setCtaHover(false)}
          >
            enter_world
          </button>
        </div>
      </div>
      {/* Blob-tracking labels (chunk 6) — on by default now (?herolabels=0
          forces off); chips latch onto LIVE panels between the chrome beat
          and a commit. Keyed by the
          bench's max so a slot-count change rebuilds cleanly. Part of the
          commit's chrome NodeList (.hero-labels) — the chrome-out fades
          the layer and a dry-run restores it. */}
      {labelsOn && (
        <HeroLabels key={labelsMax} overlay={overlayRef.current} sceneApiRef={sceneApiRef} />
      )}
      {/* hero footer bar RETIRED (08-27, Nathan): the persistent SiteTagline
          island (BaseLayout) owns the lower-left now — its one-time intro
          keys off swm:hero-lockup-done above. */}
      {/* Commit blue-fill — the envelopment surface (chunk 4). Starts hidden
          (CSS opacity/visibility) on EVERY fresh mount — a reverse arrival
          included — and only the commit timeline ever reveals it. */}
      <div className="hero__fill" ref={fillRef} aria-hidden="true" />
      {/* The logo→globe intro machine (chunk 5) — full mode only; the key
          remounts it for bench replays. Sits after VideoGlobe in the tree
          so its passive machine effect runs with the scene api live. */}
      {introOn && (
        <HeroIntro
          key={introRun}
          rigRef={rigRef}
          sceneApiRef={sceneApiRef}
          veilRef={veilRef}
          onChromeBeat={() => chromeBeat(false)}
          onDone={onIntroDone}
        />
      )}
      {CommitTunePanel && <CommitTunePanel onDryRun={onCommitDryRun} />}
      {HeroTunePanel && (
        <HeroTunePanel rigRef={rigRef} onDryRun={onCommitDryRun} onReplayIntro={onReplayIntro} />
      )}
    </section>
  );
}
