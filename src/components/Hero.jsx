/**
 * Hero — home page hero: the CMS video globe moment.
 *
 * Loom entrance: the globe starts scaled down over a solid black veil and
 * approaches slowly to rest — a planet looming toward the viewer — while the
 * veil thins on the same curve so the blue gradient arrives with it. Full
 * loom plays once per session; returning to the home page gets a short
 * settle instead. Knobs: ?loomms ?loomscale (?loom=1 forces the full pass).
 * The chrome beat (duration·0.78) fires swm:hero-chrome + stamps
 * data-chromed on the section — the ring, micro CTA, hit target and
 * HeroText all reveal themselves off that one broadcast.
 *
 * SCROLL_TO_ENTER is the circular ring CTA (ScrollRing) orbiting the globe's
 * screen disc — chunk 3 of the hero rework retired the centered PRIMARY
 * button. The wheel/touch accumulator ([NEXT]/[PREVIOUS] family) drives it:
 * dragging fills the ring white → blue and leans the CAMERA in (rig.zoom —
 * the globe truly approaches, no DOM scale), stalling rubber-bands both back,
 * and crossing the threshold pins the ring blue, eases its spin to rest and
 * fires the Envelopment (?scroll tunes the resistance, /work convention).
 * Mobile keeps the ring by default (?ringmobile=1) over a contain-fit comp;
 * ?ringmobile=0 restores the approved overscan with a bottom micro CTA.
 * The ring is pointer-inert; the click/keyboard commit path is the
 * .hero__enter-hit target the overlay pins to the disc center.
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
import HeroTunePanel from './hero/HeroTunePanel.jsx';
import ScrollRing from './hero/ScrollRing.jsx';
import { createHeroOverlay } from './hero/heroOverlay.js';
import {
  TUNING as HERO_TUNING,
  HERO_TUNE_ACTIVE,
  HERO_COMMIT_EASE_PATH,
  RING_MOBILE,
  subscribeHeroTune,
} from './hero/heroConfig.js';
import { PREFERS_REDUCED_MOTION, IS_MOBILE } from './globe/globeConfig.js';
import { SCROLL_TRIGGER_HOME_PX, TOUCH_GAIN, RELEASE_MS } from '../lib/motion.js';

gsap.registerPlugin(useGSAP, CustomEase);

const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

/* — Loom — long approach, long settle: eases in gently, sustains through the
   middle, then decelerates into rest with no overshoot (house rule). */
const LOOM_EASE_PATH = 'M0,0 C0.3,0.12 0.38,1 1,1';
const LOOM_SECONDS = PARAM('loomms', 4800) / 1000;
const LOOM_SCALE = PARAM('loomscale', 0.62);
// Returning to home within a session: a short settle, not the full approach.
const REPLAY_SECONDS = 1.3;
const REPLAY_SCALE = 0.86;

/* — Envelopment (chunk-4 commit) — the dolly's destination scale; the
   timeline length and the rest of the choreography live on heroConfig's
   commit section (?commitms ?fillmode ?bluecascade ?recenterend
   ?zoomstart). */
const ENV_SCALE = PARAM('envscale', 3.0);

/* — Commit beat map — TWO progress spaces off ONE timeline:
   · camera MOTION (recenter/zoom) keys off the eased e — the house curve
     owns every translation (?recenterend ?zoomstart are e-space edges);
   · the blue's EVENT TIMING (cascade sweep, fill spread) keys off the
     timeline's RAW progress. The Turn curve reaches e≈0.65 by 25% of raw
     time — windows hung on e compress to a ~70ms blink and the
     panel-by-panel beat becomes imperceptible at any ?commitms. Raw-space
     windows keep the sweep legible while the motion still settles on the
     curve. One timeline, one clock — a linear sibling proxy, not a second
     tween loop. — */
const BLUE_PANELS_START = 0.35; // raw: cascade sweep begins after the dolly's violent phase…
const BLUE_PANELS_END = 0.7; // …every panel is field blue here
const SPREAD_PANELS_START = 0.72; // raw: .hero__fill disc → farthest corner
const SPREAD_PANELS_END = 0.96;
const GROW_CIRCLE_START = 0.3; // raw: .hero__fill radius 0 → disc edge…
const GROW_CIRCLE_END = 0.68;
const SPREAD_CIRCLE_START = 0.68; // …then disc edge → farthest corner
const SPREAD_CIRCLE_END = 0.95;
const FILL_DISC_PAD = 1.03; // fill circle slightly proud of the disc (bgMorph precedent)
const CHROME_OUT_SECONDS = 0.2; // the one real-time beat — the chrome exit
const HANDOFF_COVER_SECONDS = 0.05; // RouteFill's snap under the covered viewport
const DRYRUN_RETURN_SECONDS = 0.6; // rig back to the resting pose, expo.out

/* Clamped remap: where a beat lives on its progress space (eased e for
   motion, raw p for the blue's windows — see the beat map above). */
const seg = (e, a, b) => Math.min(1, Math.max(0, (e - a) / (b - a)));

/* — Scroll-fill (mirrors /work's CTA choreography + knobs) — */
const SCROLL_TRIGGER = PARAM('scroll', SCROLL_TRIGGER_HOME_PX); // px of wheel/touch to commit
const RM_WHEEL_THRESHOLD = 60; // reduced motion: modest intent → plain nav

/* — Drag weight: what the gesture moves before it commits — */
const ENV_LEAN = PARAM('envlean', 25) / 100; // camera zoom extra at full drag
const ENV_PRE_COVER = PARAM('envpre', 45) / 100; // blue opacity at full drag (f² curve)

/* — Hit target: base diameter (the 44px a11y floor); the overlay scales it
   up to ≈ the disc radius so the whole globe center is clickable. — */
const HIT_BASE_PX = 44;

export default function Hero({ globeAssets }) {
  const heroRef = useRef(null);
  const globeWrapRef = useRef(null);
  const armedRef = useRef(false);
  const departingRef = useRef(false);
  const accumRef = useRef(0);
  const idleRef = useRef(null);
  const ringRef = useRef(null); // ScrollRing imperative handle ({ setFill })
  const hitRef = useRef(null); // the a11y commit button over the disc center
  const microRef = useRef(null); // mobile variant-0 micro CTA

  // Camera rig + overlay bridge (home-hero rework, chunk 2). The scene fills
  // rigRef with { rig, apply }; the overlay is created here (lazy ref init —
  // pure, SSR-safe) so the ring/hit/labels can onFrame() before or after the
  // scene mounts.
  const rigRef = useRef(null);
  const overlayRef = useRef(null);
  if (overlayRef.current === null) overlayRef.current = createHeroOverlay();

  // Scene api mirror ({ replayCascade, setBlueFill } — VideoGlobe aliases
  // the hook's api ref here) + the commit's blue surface (chunk 4).
  const sceneApiRef = useRef(null);
  const fillRef = useRef(null);
  // Live commit teardown — kills the master timeline / overlay sub (or the
  // dry-run return tween) if the island unmounts or a new commit starts
  // while one is still settling.
  const commitKillRef = useRef(null);
  useEffect(() => () => commitKillRef.current?.(), []);

  // Gesture-owned camera zoom — a proxy so drag writes, the release
  // rubber-band and the envelopment glide all continue from the same value
  // (GSAP overwrite arbitration on one target).
  const zoomRef = useRef({ v: 1 });
  const applyZoom = () => {
    const handle = rigRef.current;
    if (!handle) return;
    handle.rig.zoom = zoomRef.current.v;
    handle.apply();
  };

  // Push the hero tuning (URL-seeded; the resting comp without params) onto
  // the live rig, and re-push on any bench change. zoom is deliberately not
  // written here — it's gesture-owned (zoomRef), never a bench value.
  useEffect(() => {
    const applyTuning = () => {
      const handle = rigRef.current;
      if (!handle) return;
      handle.rig.fill = HERO_TUNING.fill;
      handle.rig.fitCover = HERO_TUNING.fitCover;
      handle.rig.offsetX = HERO_TUNING.offsetX;
      handle.rig.offsetY = HERO_TUNING.offsetY;
      handle.rig.elevDeg = HERO_TUNING.elevDeg;
      handle.apply();
    };
    applyTuning();
    return subscribeHeroTune(applyTuning);
  }, []);

  // Hero rig tuning bench — mount only AFTER hydration (SiteShell's
  // LenisTunePanel convention): HERO_TUNE_ACTIVE reads the URL, which must
  // not influence the first client render (SSR parity).
  const [heroTuneOn, setHeroTuneOn] = useState(false);
  useEffect(() => {
    if (HERO_TUNE_ACTIVE) setHeroTuneOn(true);
  }, []);

  // Mobile variant 0 (?ringmobile=0): swap the ring for the micro CTA. Same
  // post-hydration gate as the bench — IS_MOBILE/RING_MOBILE must not touch
  // the first client render (SSR parity); the swap lands while the chrome is
  // still veiled, so it is never seen.
  const [microCta, setMicroCta] = useState(false);
  useEffect(() => {
    if (IS_MOBILE && !RING_MOBILE) setMicroCta(true);
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
      '.hero__enter-hit, .hero__micro-cta, .hero__footer, .hero__text'
    );
    // Commit-time snapshot of the bench knobs — the timeline is one shot;
    // a mid-flight TUNING write waits for the next commit/dry-run.
    const { fillMode, blueCascade, recenterEnd, zoomStart, commitMs } = HERO_TUNING;

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
      // p is RAW timeline progress — the blue's windows live in raw space
      // (see the beat map: e-space windows compress to a blink on the
      // front-loaded Turn curve).
      if (!fill) return;
      let radius;
      if (fillMode === 'circle') {
        // circle: bloom 0 → just past the disc edge, then spread out.
        const grow = seg(p, GROW_CIRCLE_START, GROW_CIRCLE_END);
        if (grow <= 0) return;
        const r0 = disc.r * FILL_DISC_PAD;
        const spread = seg(p, SPREAD_CIRCLE_START, SPREAD_CIRCLE_END);
        radius = spread > 0 ? r0 + (coverRadius() - r0) * spread : r0 * grow;
      } else {
        // panels: the div takes over from the fully-blued globe at the
        // disc edge and carries the blue to the corners.
        const spread = seg(p, SPREAD_PANELS_START, SPREAD_PANELS_END);
        if (spread <= 0) return;
        const r0 = disc.r * FILL_DISC_PAD;
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
      ringRef.current?.setFill(0, 'release');
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

    /* — ONE master timeline, TWO progress reads (see the beat map): the
       eased proxy e drives the camera motion, the linear sibling proxy p
       (same timeline, same span — not a second clock) drives the blue's
       windows. The only other clock is the 0.2s real-time chrome exit
       (house-sanctioned exception). — */
    const commitEase = CustomEase.create('swmHeroCommit', HERO_COMMIT_EASE_PATH);
    const ev = { e: 0 };
    const raw = { p: 0 };
    const tl = gsap.timeline({ onComplete: dryRun ? releaseDryRun : handoff });
    // Chrome out — the ring stays: pinned blue, riding the growing disc
    // until the spreading blue swallows it.
    tl.to(
      chrome,
      { autoAlpha: 0, duration: CHROME_OUT_SECONDS, ease: 'power2.out', overwrite: true },
      0
    );
    // Linear sibling FIRST — inserted before the eased tween so raw.p is
    // fresh when the eased tween's onUpdate reads it each tick.
    tl.to(raw, { p: 1, duration: commitMs / 1000, ease: 'none' }, 0);
    tl.to(
      ev,
      {
        e: 1,
        duration: commitMs / 1000,
        ease: commitEase,
        onUpdate: () => {
          const e = ev.e;
          if (handle) {
            // Recenter on the curve's front: offsets/elevation glide to
            // the axis so the dolly dives through a centered planet.
            const rc = seg(e, 0, recenterEnd);
            handle.rig.offsetX = startX * (1 - rc);
            handle.rig.offsetY = startY * (1 - rc);
            handle.rig.elevDeg = startElev * (1 - rc);
            // Dolly through the silhouette, continuing from the drag's lean.
            const z = seg(e, zoomStart, 1);
            zoomRef.current.v = startZoom + (ENV_SCALE - startZoom) * z;
            handle.rig.zoom = zoomRef.current.v;
            handle.apply(); // ONE apply for every rig write this frame
          }
          // The blue arrives through the globe's shape: panels surge to
          // field blue on the cascade's own stagger, then the DOM fill
          // takes over past the disc edge (circle mode skips the panels
          // and blooms the disc-clipped fill directly — no setBlueFill).
          // Raw-space windows: legible at any ?commitms.
          if (fillMode === 'panels') {
            sceneApi?.setBlueFill(seg(raw.p, BLUE_PANELS_START, BLUE_PANELS_END), blueCascade);
          }
          driveFill(raw.p);
        },
      },
      0
    );
    commitKillRef.current = () => {
      tl.kill();
      unsub();
    };
  };

  // Click/keyboard commit (hit target + micro CTA) — pin the ring like a
  // crossed threshold, then run the same passage.
  const onEnterClick = () => {
    ringRef.current?.setFill(1, 'commit-pin');
    beginEnvelopment();
  };

  // Bench rehearsal (?herotune) — pin the ring like a real threshold cross,
  // then play the commit timeline with the dry-run release instead of the
  // navigation.
  const onCommitDryRun = () => {
    ringRef.current?.setFill(1, 'commit-pin');
    beginEnvelopment({ dryRun: true });
  };

  // The hit target is disc-sized, so a drag-to-spin gesture can start AND
  // end on it — browsers still fire click for that. Track the pointer-down
  // point and swallow clicks that traveled like a drag (keyboard clicks
  // carry no coordinates and pass untouched).
  const hitDownRef = useRef(null);
  const onHitPointerDown = (e) => {
    hitDownRef.current = { x: e.clientX, y: e.clientY };
  };
  const onHitClick = (e) => {
    const down = hitDownRef.current;
    hitDownRef.current = null;
    if (down && e.detail > 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
      return; // a spin drag that happened to end over the target
    }
    onEnterClick();
  };

  // ── Loom entrance + chrome beat ──
  useGSAP(
    () => {
      const hero = heroRef.current;
      const globeWrap = globeWrapRef.current;
      const veil = hero.querySelector('.hero__veil');
      // The chrome beat: arm the gesture, stamp the latch, broadcast — the
      // ring / micro CTA / HeroText reveal themselves off the event (they
      // can mount after this effect runs), Hero fades what it owns directly.
      const chromeBeat = (instant) => {
        armedRef.current = true;
        hero.dataset.chromed = '1';
        window.dispatchEvent(new CustomEvent('swm:hero-chrome'));
        const owned = hero.querySelectorAll('.hero__enter-hit, .hero__footer');
        if (instant) gsap.set(owned, { autoAlpha: 1 });
        else gsap.to(owned, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
      };

      if (PREFERS_REDUCED_MOTION) {
        gsap.set(globeWrap, { scale: 1 });
        gsap.set(veil, { opacity: 0 });
        chromeBeat(true);
        return;
      }

      let loomed = false;
      try {
        loomed = sessionStorage.getItem('swm:loomed') === '1';
        sessionStorage.setItem('swm:loomed', '1');
      } catch {
        /* storage unavailable — always loom */
      }
      const full = !loomed || PARAM('loom', 0) === 1;
      const duration = full ? LOOM_SECONDS : REPLAY_SECONDS;
      const fromScale = full ? LOOM_SCALE : REPLAY_SCALE;
      const loomEase = CustomEase.create('swmLoom', LOOM_EASE_PATH);

      gsap.set(globeWrap, { scale: fromScale, transformOrigin: '50% 50%' });
      gsap.set(veil, { opacity: 1 });

      const tl = gsap.timeline();
      // The approach and the gradient arrival share one curve — the blue
      // horizon fades up exactly as the planet comes to rest.
      tl.to(globeWrap, { scale: 1, duration, ease: loomEase }, 0);
      tl.to(veil, { opacity: 0, duration, ease: loomEase }, 0);
      tl.add(() => chromeBeat(false), duration * 0.78);
    },
    { scope: heroRef }
  );

  // ── Hit target follows the disc (transform-only, the overlay cadence) ──
  useEffect(() => {
    if (microCta) return undefined; // variant 0's micro CTA is its own button
    const hit = hitRef.current;
    const overlay = overlayRef.current;
    if (!hit || !overlay) return undefined;
    return overlay.onFrame((frame) => {
      // Diameter ≈ disc radius (radius ≈ 0.5·disc.r), never under the 44px
      // a11y floor. Scale-only sizing — no width/height writes, no layout.
      // --hit-inv counter-scales the focus outline to a constant weight.
      const s = Math.max(1, frame.disc.r / HIT_BASE_PX);
      hit.style.transform = `translate3d(${frame.disc.cx}px, ${frame.disc.cy}px, 0) scale(${s})`;
      hit.style.setProperty('--hit-inv', String(1 / s));
    });
  }, [microCta]);

  // ── Micro CTA reveal (variant 0) — chrome beat, with the latch covering
  // its post-hydration mount landing after the beat (RM fires it instantly) ──
  useEffect(() => {
    if (!microCta) return undefined;
    const el = microRef.current;
    if (!el) return undefined;
    const reveal = () => {
      if (PREFERS_REDUCED_MOTION) gsap.set(el, { autoAlpha: 1 });
      else gsap.to(el, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
    };
    if (el.closest('.hero')?.dataset.chromed === '1') {
      reveal();
      return undefined;
    }
    const onChrome = () => reveal();
    window.addEventListener('swm:hero-chrome', onChrome, { once: true });
    return () => window.removeEventListener('swm:hero-chrome', onChrome);
  }, [microCta]);

  // ── Scroll-fill → envelopment (the /work wheel/touch accumulator) ──
  useEffect(() => {
    const clearIdle = () => {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    };

    // Drag weight: the ring fills, the CAMERA leans toward the globe
    // (rig.zoom — direct write, the accumulator itself paces it) and the
    // blue pre-covers with the gesture (f² keeps the fade subtle early).
    const dragTo = (f) => {
      ringRef.current?.setFill(f, 'drag');
      gsap.killTweensOf(zoomRef.current); // take over from a live release
      zoomRef.current.v = 1 + ENV_LEAN * f;
      applyZoom();
      window.dispatchEvent(
        new CustomEvent('swm:fill-progress', { detail: { value: ENV_PRE_COVER * f * f } })
      );
    };

    // Stalled below the threshold → rubber-band ring, camera and blue back
    // on the shared release curve.
    const scheduleRelease = () => {
      clearIdle();
      idleRef.current = setTimeout(() => {
        accumRef.current = 0;
        ringRef.current?.setFill(0, 'release');
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
        // Pinned blue, spin easing to rest — held while the passage plays.
        ringRef.current?.setFill(1, 'commit-pin');
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

  return (
    <section className="hero" ref={heroRef}>
      {/* Black start-state over the gradient; the loom thins it away */}
      <div className="hero__veil" aria-hidden="true" />
      <div className="hero__globe" ref={globeWrapRef}>
        <VideoGlobe
          assets={globeAssets}
          rigRef={rigRef}
          overlayRef={overlayRef}
          sceneApiRef={sceneApiRef}
        />
      </div>
      {microCta ? (
        /* Mobile variant 0 — bottom micro cue over the overscan globe */
        <button type="button" className="hero__micro-cta" ref={microRef} onClick={onEnterClick}>
          <span className="hero__micro-cta-label">scroll_to_enter</span>
          <CtaArrows direction="down" />
        </button>
      ) : (
        <>
          {/* The ring CTA orbiting the disc (pointer-inert) + the invisible
              commit target the overlay pins to the disc center (the a11y
              click/keyboard path — matches the old button's click) */}
          <ScrollRing ringRef={ringRef} overlay={overlayRef.current} />
          <button
            type="button"
            className="hero__enter-hit"
            ref={hitRef}
            aria-label="Enter featured projects"
            onPointerDown={onHitPointerDown}
            onClick={onHitClick}
          />
        </>
      )}
      {/* The statement lead — left-center, the /process prose voice
          (2026-07-16 recomposition; the line moved out of the footer) */}
      <HeroText />
      <div className="hero__footer">
        <SiteFooter noFill tagline={false} />
      </div>
      {/* Commit blue-fill — the envelopment surface (chunk 4). Starts hidden
          (CSS opacity/visibility) on EVERY fresh mount — a reverse arrival
          included — and only the commit timeline ever reveals it. */}
      <div className="hero__fill" ref={fillRef} aria-hidden="true" />
      {heroTuneOn && <HeroTunePanel rigRef={rigRef} onDryRun={onCommitDryRun} />}
    </section>
  );
}
