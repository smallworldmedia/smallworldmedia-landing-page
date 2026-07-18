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
 * ?envpre % at the threshold) — video keeps playing under it. Committing
 * continues from wherever the drag left rig.zoom, so the blue is already
 * rising when the passage takes over and is solid at navigation.
 *
 * Envelopment (ADR-0002): the camera dollies through the globe's silhouette
 * (rig.zoom → ?envscale) on the house Turn curve while the persistent
 * RouteFill covers, then client-navigates to /work, which releases the fill
 * over its World. Reduced motion: everything rests immediately; entering is
 * a plain navigation. Knobs: ?envms ?envscale ?envcover (RouteFill adds
 * ?fillcover ?fillrelease; WorldCard's enter_world bridge adds ?entercover).
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
  RING_MOBILE,
  subscribeHeroTune,
} from './hero/heroConfig.js';
import { PREFERS_REDUCED_MOTION, IS_MOBILE } from './globe/globeConfig.js';
import { TURN_EASE_PATH } from './work/world/worldConfig.js';
import { SCROLL_TRIGGER_HOME_PX, TOUCH_GAIN, RELEASE_MS, GLIDE_MS } from '../lib/motion.js';

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

/* — Envelopment — steep launch on the house Turn curve. The RouteFill starts
   fading in the moment the trigger fires (t=0) and ramps across the whole
   scale-up, reaching solid right as navigation fires — an early, gradual
   arrival of the blue rather than a late snap. Defaults per Nathan's
   feel-pass 2026-07-02. */
const ENV_SECONDS = PARAM('envms', GLIDE_MS) / 1000; // house commit glide (motion.js)
const ENV_SCALE = PARAM('envscale', 3.0);
const ENV_COVER_SECONDS = PARAM('envcover', GLIDE_MS) / 1000; // fade length from t=0; ≈ envms = solid at handoff

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

  const beginEnvelopment = () => {
    if (departingRef.current) return;
    departingRef.current = true;
    armedRef.current = false;
    clearTimeout(idleRef.current);

    if (PREFERS_REDUCED_MOTION) {
      navigate('/work'); // no theatrics — /work initializes already inside
      return;
    }

    const envEase = CustomEase.create('swmEnvelop', TURN_EASE_PATH);
    const tl = gsap.timeline({ onComplete: () => navigate('/work') });
    // Chrome out — the ring stays: pinned blue, riding the growing disc
    // until the RouteFill swallows it (chunk 4 rewrites this beat fully).
    tl.to(
      heroRef.current.querySelectorAll(
        '.hero__enter-hit, .hero__micro-cta, .hero__footer, .hero__text'
      ),
      { autoAlpha: 0, duration: 0.2, ease: 'power2.out', overwrite: true },
      0
    );
    // The passage is now a camera move: rig.zoom dollies through the
    // silhouette on the same curve the DOM scale used to ride. overwrite
    // takes the proxy over from a live drag/release tween — the zoom
    // continues from wherever the gesture left it.
    tl.to(
      zoomRef.current,
      {
        v: ENV_SCALE,
        duration: ENV_SECONDS,
        ease: envEase,
        overwrite: 'auto',
        onUpdate: applyZoom,
      },
      0
    );
    // Cover from the very first frame of the passage: the fill's power2.in
    // ease keeps it subtle early and lets it swallow the screen by the end.
    tl.add(() => {
      window.dispatchEvent(
        new CustomEvent('swm:envelop', { detail: { duration: ENV_COVER_SECONDS } })
      );
    }, 0);
  };

  // Click/keyboard commit (hit target + micro CTA) — pin the ring like a
  // crossed threshold, then run the same passage.
  const onEnterClick = () => {
    ringRef.current?.setFill(1, 'commit-pin');
    beginEnvelopment();
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
        <VideoGlobe assets={globeAssets} rigRef={rigRef} overlayRef={overlayRef} />
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
      {heroTuneOn && <HeroTunePanel rigRef={rigRef} />}
    </section>
  );
}
