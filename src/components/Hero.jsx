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
 * SCROLL_TO_ENTER is the PRIMARY button, restored beneath the tagline in a
 * left-anchored column (the home-hero refine retired chunk 3's orbiting
 * ring). The wheel/touch accumulator ([NEXT]/[PREVIOUS] family) drives its
 * fill: dragging mixes the pill white → electric blue and leans the CAMERA
 * in (rig.zoom — the globe truly approaches, no DOM scale), stalling
 * rubber-bands both back, and crossing the threshold pins the pill blue and
 * fires the Envelopment (?scroll tunes the resistance, /work convention).
 * Clicking the button (or keyboard Enter) commits the same way. One CTA on
 * every breakpoint. The tagline + button column takes its max-width from the
 * globe disc's left edge (?textgap) so the copy never overlaps the globe and
 * wraps when space is tight.
 *
 * Blob-tracking labels (chunk 6, HeroLabels — on by default now, ?herolabels
 * / the bench toggle): mono chips + leader strokes latched to the LIVE
 * panels via the scene api's onLiveChange subscription, running only
 * between the chrome beat and a commit, never under RM.
 *
 * While dragging, the RouteFill blue pre-covers on a power curve (up to
 * ?envpre % at the threshold) — video keeps playing under it. At commit the
 * pre-cover HOLDS wherever the drag left it (we simply stop emitting
 * progress); the hero owns the visual from there. Committing continues from
 * wherever the drag left rig.zoom.
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
import CtaArrows from './work/CtaArrows.jsx';
import SiteFooter from './SiteFooter.jsx';
import HeroText from './HeroText.jsx';
import HeroIntro from './hero/HeroIntro.jsx';
import HeroLabels from './hero/HeroLabels.jsx';
import { createHeroOverlay } from './hero/heroOverlay.js';
import {
  TUNING as HERO_TUNING,
  HERO_TUNE_ACTIVE,
  HERO_COMMIT_EASE_PATH,
  HERO_INTRO_EASE_PATH,
  GLOBE_STROKE_FRAC,
  subscribeHeroTune,
} from './hero/heroConfig.js';
import {
  PREFERS_REDUCED_MOTION,
  PANEL_CORNER_RADIUS as GLOBE_PANEL_CORNER_RADIUS,
} from './globe/globeConfig.js';
import { SCROLL_TRIGGER_HOME_PX, TOUCH_GAIN, RELEASE_MS } from '../lib/motion.js';

gsap.registerPlugin(useGSAP, CustomEase);

const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

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

/* — Replay settle — revisits skip the wordmark: veil 1→0 + rig.zoom
   0.92→1 on the intro curve, straight into the resting comp. The chrome
   beat keeps its loom-era place at duration·0.78; the full machine fires
   its own beat (HeroIntro). — */
const REPLAY_SECONDS = 1.2;
const REPLAY_ZOOM_FROM = 0.92;
const CHROME_BEAT_AT = 0.78;

/* — Envelopment (chunk-4 commit) — the dolly's destination scale; the
   timeline length and the rest of the choreography live on heroConfig's
   commit section (?commitms ?fillmode ?bluecascade ?recenterend
   ?zoomstart). */
const ENV_SCALE = PARAM('envscale', 3.0);

/* — Rounded panel tiles (note 5) — UV-space radius the home globe passes to
   VideoGlobe (lockup fidelity, the SWM mark's panels carry a corner radius).
   Home-only: /lab and /process get the default 0 (hard edges). Lives in
   globeConfig now so heroConfig's bench can seed ?corner from the same value. — */
const PANEL_CORNER_RADIUS = GLOBE_PANEL_CORNER_RADIUS;

/* — Commit beat map — ONE linear timeline `raw.p`, split by ?bluelead
   (note 4: "the blue fill should happen FIRST and then lead into the globe
   centering and zoom"):
   · BLUE LEADS over raw [0 .. blueLead]: the panels cascade to field blue
     (or, circle mode, the disc blooms to the silhouette) while the CAMERA
     HOLDS in the resting comp — the blue paints the globe where it sits,
     off-right and underside, at full effect.
   · CAMERA DIVES over raw [blueLead .. 1]: recenter (offsets/elev → 0) then
     dolly (rig.zoom → ?envscale), on the house Turn curve applied to the
     re-based progress `commitEase(seg(raw.p, blueLead, 1))` — the eased
     launch/settle the doctrine wants, just held until the globe is blue.
     ?recenterend / ?zoomstart are edges WITHIN that eased dive (cp-space).
   · The .hero__fill disc spreads to the viewport corners over the dive's
     tail, taking over from the by-then-blue globe at its edge → handoff at
     raw 1. Blue never blinks (it owns the front of the timeline outright),
     and the camera never moves before the globe is painted. — */
const SPREAD_PANELS_END = 0.98; // raw: .hero__fill disc fully covers the viewport
const SPREAD_CIRCLE_END = 0.98;
const FILL_DISC_PAD = 1.03; // fill circle slightly proud of the disc (bgMorph precedent)
const CHROME_OUT_SECONDS = 0.2; // the one real-time beat — the chrome exit
const HANDOFF_COVER_SECONDS = 0.05; // RouteFill's snap under the covered viewport
const DRYRUN_RETURN_SECONDS = 0.6; // rig back to the resting pose, expo.out

/* Clamped remap: where a beat lives on its progress window. */
const seg = (e, a, b) => Math.min(1, Math.max(0, (e - a) / (b - a)));

/* — Scroll-fill (mirrors /work's CTA choreography + knobs) — */
const SCROLL_TRIGGER = PARAM('scroll', SCROLL_TRIGGER_HOME_PX); // px of wheel/touch to commit
const RM_WHEEL_THRESHOLD = 60; // reduced motion: modest intent → plain nav

/* — Drag weight: what the gesture moves before it commits — */
const ENV_LEAN = PARAM('envlean', 25) / 100; // camera zoom extra at full drag
const ENV_PRE_COVER = PARAM('envpre', 45) / 100; // blue opacity at full drag (f² curve)

/* — CTA fill presentation (restored from the pre-ring button): the pill
   scales to 1 + this at full drag fill or hover, and mixes white → electric
   blue by the same fraction (pinned solid blue at commit). — */
const CTA_MAX_EXTRA = 0.3;

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
  const accumRef = useRef(0);
  const idleRef = useRef(null);
  const leadColRef = useRef(null); // the tagline + scroll_to_enter button column
  const strokeRef = useRef(null); // globe outer-stroke disc (tracks the overlay disc)

  // scroll_to_enter button fill state — the /work model (fill 0..1, mode
  // drag|release|commit-pin) restored from the pre-ring button. The gesture
  // path writes it via setCta; a per-drag React render was fine before the
  // ring and stays fine now (the heavy work is the rig/overlay, not this).
  const [ctaFill, setCtaFill] = useState(0);
  const [ctaMode, setCtaMode] = useState('drag');
  const [ctaHover, setCtaHover] = useState(false);
  const setCta = (f, mode) => {
    setCtaFill(f);
    setCtaMode(mode);
  };

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

  // Gesture-owned camera zoom — a proxy so drag writes, the release
  // rubber-band, the replay settle and the envelopment glide all continue
  // from the same value (GSAP overwrite arbitration on one target).
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
  const [introOn, setIntroOn] = useState(introMode === 'full');
  const [introRun, setIntroRun] = useState(0); // bench replays remount by key
  // The machine owns the rig (glyph pose → launch) until its handoff — the
  // tuning effect defers to it; a bench write mid-intro lands at the stamp.
  const introDoneRef = useRef(introMode !== 'full');

  // The chrome beat: arm the gesture, stamp the latch, broadcast — the
  // HeroText lead / labels reveal themselves off the event (they can mount
  // after it fires), Hero fades what it owns directly (the CTA button wrap +
  // footer). Fired by the replay settle / RM path here, and by HeroIntro's
  // machine in full mode.
  const chromeBeat = (instant) => {
    const hero = heroRef.current;
    if (!hero) return;
    armedRef.current = true;
    hero.dataset.chromed = '1';
    window.dispatchEvent(new CustomEvent('swm:hero-chrome'));
    const owned = hero.querySelectorAll('.hero__enter-wrap, .hero__footer');
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

  // Bench action (?herotune): re-run the full machine. The scene can't
  // re-hold mid-session — the live-video scheduler is already running and
  // stays running (accepted; the bench note says so) — but the cascade
  // replays and the glyph rig re-seeds through the live handle.
  const onReplayIntro = () => {
    if (introMode === 'rm' || departingRef.current) return;
    armedRef.current = false; // re-arms at the machine's chrome beat
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
    clearTimeout(idleRef.current);
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
      '.hero__lead-col, .hero__footer, .hero-labels'
    );
    // Commit-time snapshot of the bench knobs — the timeline is one shot;
    // a mid-flight TUNING write waits for the next commit/dry-run.
    const { fillMode, blueCascade, blueLead, recenterEnd, zoomStart, commitMs } = HERO_TUNING;

    // Recenter/zoom starts — FROM wherever the live rig sits (the resting
    // TUNING pose, a bench value, a mid-drag lean), never from defaults.
    // The master onUpdate owns the zoom proxy now: kill a live drag/release
    // tween instead of tweening over it (the old separate zoom tween died
    // with chunk 4 — zoom is a remap of e like everything else).
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
      // p is RAW timeline progress; the fill windows are re-based on blueLead
      // so the blue fills the globe FIRST (over [0, blueLead]) and only then
      // spreads to the corners (over [blueLead, end]) as the camera dives.
      if (!fill) return;
      let radius;
      const r0 = disc.r * FILL_DISC_PAD;
      if (fillMode === 'circle') {
        // circle: the disc blooms 0 → the silhouette over [0, blueLead] (this
        // mode's "paint the globe" beat, in place of the panel cascade), then
        // spreads disc → corners over [blueLead, end].
        const grow = seg(p, 0, blueLead);
        if (grow <= 0) return;
        const spread = seg(p, blueLead, SPREAD_CIRCLE_END);
        radius = spread > 0 ? r0 + (coverRadius() - r0) * spread : r0 * grow;
      } else {
        // panels: the panels are field blue by blueLead; the div takes over
        // at the disc edge and carries the blue to the corners after it.
        const spread = seg(p, blueLead, SPREAD_PANELS_END);
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
    // t=0 `swm:envelop` dispatch is GONE — the hero owns the passage visual
    // now, and the drag's pre-cover simply holds where it left off (we stop
    // emitting `swm:fill-progress` the moment the commit starts).
    const handoff = () => {
      unsub();
      commitKillRef.current = null;
      window.dispatchEvent(
        new CustomEvent('swm:envelop', { detail: { duration: HANDOFF_COVER_SECONDS } })
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
      setCta(0, 'release');
      // Let the drag's held pre-cover go too — the rehearsal must leave no
      // residue on the persistent RouteFill (no-op if it was never raised).
      window.dispatchEvent(
        new CustomEvent('swm:fill-progress', { detail: { value: 0, duration: 0.4 } })
      );
      gsap.to(chrome, { autoAlpha: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      accumRef.current = 0;
      departingRef.current = false;
      armedRef.current = true; // the gesture is live again
    };

    /* — ONE linear master timeline `raw.p` (see the beat map). The blue owns
       the front outright (paints the globe over [0, blueLead] while the
       camera holds); the camera dive rides the house Turn curve applied to
       the re-based progress after blueLead, so the eased launch/settle is
       preserved — just delayed until the globe is blue. `raw.p` is linear so
       the blue reads at any ?commitms; the only other clock is the 0.2s
       real-time chrome exit (house-sanctioned exception). — */
    const commitEase = CustomEase.create('swmHeroCommit', HERO_COMMIT_EASE_PATH);
    const raw = { p: 0 };
    const tl = gsap.timeline({ onComplete: dryRun ? releaseDryRun : handoff });
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
          // 1) BLUE LEADS — panels surge to field blue over [0, blueLead] on
          //    the cascade's own stagger while the camera is still (circle
          //    mode blooms the disc instead — driveFill owns that below).
          if (fillMode === 'panels') {
            sceneApi?.setBlueFill(seg(p, 0, blueLead), blueCascade);
          }
          driveFill(p);
          // 2) CAMERA DIVES — after blueLead, on the Turn curve: recenter the
          //    now-blue globe to the axis, then dolly through it. cp holds at
          //    0 until blueLead, so the globe does not move before it is blue.
          if (handle) {
            const cp = commitEase(seg(p, blueLead, 1));
            const rc = seg(cp, 0, recenterEnd);
            handle.rig.offsetX = startX * (1 - rc);
            handle.rig.offsetY = startY * (1 - rc);
            handle.rig.elevDeg = startElev * (1 - rc);
            const z = seg(cp, zoomStart, 1);
            zoomRef.current.v = startZoom + (ENV_SCALE - startZoom) * z;
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

  // Click/keyboard commit (the button) — pin the fill like a crossed
  // threshold, then run the same passage. (Keyboard Enter fires click
  // natively; no drag disambiguation needed — the button isn't over the
  // spin-draggable disc.)
  const onEnterClick = () => {
    setCta(1, 'commit-pin');
    beginEnvelopment();
  };

  // Bench rehearsal (?herotune) — pin the fill like a real threshold cross,
  // then play the commit timeline with the dry-run release instead of the
  // navigation.
  const onCommitDryRun = () => {
    setCta(1, 'commit-pin');
    beginEnvelopment({ dryRun: true });
  };

  // ── Entrance dispatch — by the render-time intro mode (chunk 5) ──
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

      if (introMode === 'replay') {
        // Revisit settle: straight into the resting comp on the intro
        // curve — the veil thins exactly as the camera closes the last 8%
        // (rig.zoom, not a DOM scale — the loom's transform died with
        // chunk 5). zoom rides the gesture proxy so a drag mid-settle
        // takes over cleanly (killTweensOf arbitration, one target). This
        // layout effect runs BEFORE the scene's passive build — pre-seed
        // the rig-carry so the very first rendered frame is already at
        // 0.92 (HeroIntro's pre-seed idiom; the resting pose comes from
        // TUNING, which the tuning effect re-stamps identically).
        zoomRef.current.v = REPLAY_ZOOM_FROM;
        if (!rigRef.current) {
          rigRef.current = {
            rig: {
              fill: HERO_TUNING.fill,
              fitCover: HERO_TUNING.fitCover,
              offsetX: HERO_TUNING.offsetX,
              offsetY: HERO_TUNING.offsetY,
              elevDeg: HERO_TUNING.elevDeg,
              roll: HERO_TUNING.roll,
              zoom: REPLAY_ZOOM_FROM,
            },
            apply: () => {},
          };
        } else {
          applyZoom();
        }
        const settleEase = CustomEase.create('swmHeroIntroSettle', HERO_INTRO_EASE_PATH);
        gsap.set(veil, { opacity: 1 });
        const tl = gsap.timeline();
        tl.to(
          zoomRef.current,
          { v: 1, duration: REPLAY_SECONDS, ease: settleEase, onUpdate: applyZoom },
          0
        );
        tl.to(veil, { opacity: 0, duration: REPLAY_SECONDS, ease: settleEase }, 0);
        tl.add(() => chromeBeat(false), REPLAY_SECONDS * CHROME_BEAT_AT);
        return;
      }

      // full — HeroIntro owns the entrance end to end (veil, glyph rig,
      // cascade beat, chrome beat, scheduler release); nothing to conduct.
    },
    { scope: heroRef }
  );

  // ── Tagline/CTA column sized to the gap LEFT of the globe ──
  // The column spans [viewport-left, globe-left-edge] and centre-justifies the
  // tagline + CTA within that empty gap (CSS owns the centring; its own padding
  // keeps the copy clear of the globe). We cache the disc every frame (3 number
  // writes, zero alloc — this also keeps the overlay bridge running when labels
  // are off) and write the column's --lead-gap (the globe's left-edge px, less
  // ?textgap) only on a "dirty" frame — armed by the chrome beat, window resize
  // and bench comp changes, NEVER per frame (a width write relayouts the text).
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;
    const disc = { cx: 0, cy: 0, r: 0 };
    let dirty = true; // compute once as soon as the first real disc lands
    const writeGap = () => {
      const col = leadColRef.current;
      if (!col || !disc.r) return;
      // The globe's LEFT edge in px (less a textGap breathing margin) — the
      // width of the gap the column spans and centres its content within.
      const px = Math.max(0, Math.round(disc.cx - disc.r - HERO_TUNING.textGap));
      col.style.setProperty('--lead-gap', `${px}px`);
    };
    const unframe = overlay.onFrame((frame) => {
      disc.cx = frame.disc.cx;
      disc.cy = frame.disc.cy;
      disc.r = frame.disc.r;
      if (dirty && disc.r) {
        dirty = false;
        writeGap();
      }
    });
    const mark = () => {
      dirty = true;
    };
    window.addEventListener('swm:hero-chrome', mark);
    window.addEventListener('resize', mark);
    const unTune = subscribeHeroTune(mark);
    if (heroRef.current?.dataset.chromed === '1') mark(); // beat already fired
    return () => {
      unframe();
      window.removeEventListener('swm:hero-chrome', mark);
      window.removeEventListener('resize', mark);
      unTune();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ── Scroll-fill → envelopment (the /work wheel/touch accumulator) ──
  useEffect(() => {
    const clearIdle = () => {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    };

    // Drag weight: the button fills, the CAMERA leans toward the globe
    // (rig.zoom — direct write, the accumulator itself paces it) and the
    // blue pre-covers with the gesture (f² keeps the fade subtle early).
    const dragTo = (f) => {
      setCta(f, 'drag');
      gsap.killTweensOf(zoomRef.current); // take over from a live release
      zoomRef.current.v = 1 + ENV_LEAN * f;
      applyZoom();
      window.dispatchEvent(
        new CustomEvent('swm:fill-progress', { detail: { value: ENV_PRE_COVER * f * f } })
      );
    };

    // Stalled below the threshold → rubber-band the button fill, camera and
    // blue back on the shared release curve.
    const scheduleRelease = () => {
      clearIdle();
      idleRef.current = setTimeout(() => {
        accumRef.current = 0;
        setCta(0, 'release');
        gsap.to(zoomRef.current, {
          v: 1,
          duration: 0.4,
          ease: 'expo.out',
          overwrite: 'auto',
          onUpdate: applyZoom,
        });
        window.dispatchEvent(
          new CustomEvent('swm:fill-progress', { detail: { value: 0, duration: 0.4 } })
        );
      }, RELEASE_MS);
    };

    const addDelta = (dy) => {
      if (!armedRef.current || departingRef.current) return;
      // The inquiry overlay owns the screen — scrolling under it must not
      // arm the envelopment (wheel events bubble to window regardless)
      if (document.querySelector('.project-overlay')?.dataset.open === 'true') return;
      const a = Math.max(0, accumRef.current + dy); // downward intent only
      accumRef.current = a;

      if (PREFERS_REDUCED_MOTION) {
        if (a >= RM_WHEEL_THRESHOLD) beginEnvelopment();
        return;
      }
      if (a >= SCROLL_TRIGGER) {
        clearIdle();
        // Pinned solid blue — held while the passage plays.
        setCta(1, 'commit-pin');
        beginEnvelopment();
      } else {
        dragTo(a / SCROLL_TRIGGER);
        scheduleRelease();
      }
    };

    const onWheel = (e) => addDelta(e.deltaY);
    let touchY = null;
    const onTouchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e) => {
      if (touchY === null) return;
      const y = e.touches[0]?.clientY ?? touchY;
      addDelta((touchY - y) * TOUCH_GAIN); // upward swipe = enter (the house gain)
      touchY = y;
    };
    const onTouchEnd = () => {
      touchY = null;
      if (!departingRef.current) scheduleRelease();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      clearIdle();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── scroll_to_enter button presentation vars (restored from the pre-ring
  // button) — the /work scroll choreography on the PRIMARY palette: white/blue
  // at rest, filling (or hovering) toward the primary's hover state
  // (blue/white), pinned solid blue at the threshold. --cta-return/--cta-ease
  // give each mode its own transition timing (drag snappy, release the house
  // rubber-band curve, commit-pin instant). ──
  const ctaScale = 1 + CTA_MAX_EXTRA * Math.max(ctaFill, ctaHover ? 1 : 0);
  const ctaReturn = ctaMode === 'commit-pin' ? '0s' : ctaMode === 'release' ? '0.4s' : '0.12s';
  const ctaEase = ctaMode === 'release' ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'ease-out';
  const ctaPct =
    ctaMode === 'commit-pin'
      ? 100
      : Math.round(Math.min(1, Math.max(ctaFill, ctaHover ? 1 : 0)) * 100);
  const ctaColor = {
    '--cta-bg': `color-mix(in srgb, var(--color-white), var(--color-electric-blue) ${ctaPct}%)`,
    '--cta-fg': `color-mix(in srgb, var(--color-electric-blue), var(--color-white) ${ctaPct}%)`,
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
      {/* Left-anchored statement column — the tagline (HeroText's .hero__lead,
          the /process prose voice) THEN the scroll_to_enter button beneath it.
          The column's --lead-max (Hero writes it from the globe disc's left
          edge) clamps its width so the copy clears the globe and wraps when
          tight; the button inherits it and left-aligns under the wrapped lead.
          The column is pointer-inert (drag-to-spin reaches the canvas); only
          the button opts back in. Revealed on the chrome beat, faded on the
          commit (it's the .hero__lead-col in the chrome NodeList). */}
      <div className="hero__lead-col" ref={leadColRef}>
        <HeroText />
        <div className="hero__enter-wrap">
          <button
            type="button"
            className="cta-primary hero__enter"
            style={{
              '--cta-scale': ctaScale.toFixed(3),
              '--cta-return': ctaReturn,
              '--cta-ease': ctaEase,
              ...ctaColor,
            }}
            onClick={onEnterClick}
            onPointerEnter={() => setCtaHover(true)}
            onPointerLeave={() => setCtaHover(false)}
          >
            scroll_to_enter
          </button>
          <CtaArrows direction="down" />
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
      <div className="hero__footer">
        <SiteFooter noFill tagline={false} />
      </div>
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
      {HeroTunePanel && (
        <HeroTunePanel rigRef={rigRef} onDryRun={onCommitDryRun} onReplayIntro={onReplayIntro} />
      )}
    </section>
  );
}
