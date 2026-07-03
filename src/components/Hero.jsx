/**
 * Hero — home page hero: the CMS video globe moment.
 *
 * Loom entrance: the globe starts scaled down over a solid black veil and
 * approaches slowly to rest — a planet looming toward the viewer — while the
 * veil thins on the same curve so the blue gradient arrives with it. Full
 * loom plays once per session; returning to the home page gets a short
 * settle instead. Knobs: ?loomms ?loomscale (?loom=1 forces the full pass).
 *
 * SCROLL_TO_ENTER is the /work CTA chip (fp-cta family), centered over the
 * resting planet, with the same scroll-fill interaction as [NEXT]/[PREVIOUS]:
 * wheel/touch fills it (scale grows, colours invert white/black → black/white),
 * stalling rubber-bands it back, and crossing the threshold pins it blue and
 * fires the Envelopment (?scroll tunes the resistance, /work convention).
 *
 * Envelopment (ADR-0002): the globe scales up through the viewport on the
 * house Turn curve while the persistent RouteFill covers, then client-
 * navigates to /work, which releases the fill over its World. Reduced motion:
 * everything rests immediately; entering is a plain navigation.
 * Knobs: ?envms ?envscale ?envcover (RouteFill adds ?fillcover ?fillrelease;
 * WorldCard's enter_world bridge adds ?entercover).
 */
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { navigate } from 'astro:transitions/client';
import VideoGlobe from './globe/VideoGlobe.jsx';
import CtaArrows from './work/CtaArrows.jsx';
import SiteFooter from './SiteFooter.jsx';
import { PREFERS_REDUCED_MOTION } from './globe/globeConfig.js';
import { TURN_EASE_PATH } from './work/world/worldConfig.js';

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
const ENV_SECONDS = PARAM('envms', 650) / 1000;
const ENV_SCALE = PARAM('envscale', 3.0);
const ENV_COVER_SECONDS = PARAM('envcover', 650) / 1000; // fade length from t=0; ≈ envms = solid at handoff

/* — Scroll-fill (mirrors /work's CTA choreography + knobs) — */
const SCROLL_TRIGGER = PARAM('scroll', 600); // px of wheel/touch to commit
const CTA_MAX_EXTRA = 0.3; // CTA scale at full fill / hover = 1 + this
const RM_WHEEL_THRESHOLD = 60; // reduced motion: modest intent → plain nav

export default function Hero({ globeAssets }) {
  const heroRef = useRef(null);
  const globeWrapRef = useRef(null);
  const armedRef = useRef(false);
  const departingRef = useRef(false);
  const accumRef = useRef(0);
  const idleRef = useRef(null);

  // CTA fill state — same model as /work: fill 0..1, mode drag|release|commit-pin
  const [fill, setFill] = useState(0);
  const [ctaMode, setCtaMode] = useState('drag');
  const [hover, setHover] = useState(false);

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
    tl.to(
      heroRef.current.querySelectorAll('.hero__enter-wrap, .hero__footer'),
      { autoAlpha: 0, duration: 0.2, ease: 'power2.out', overwrite: true },
      0
    );
    tl.to(
      globeWrapRef.current,
      { scale: ENV_SCALE, duration: ENV_SECONDS, ease: envEase },
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

  // ── Loom entrance + chrome reveal (CTA + footer fade in, opacity only) ──
  useGSAP(
    () => {
      const hero = heroRef.current;
      const globeWrap = globeWrapRef.current;
      const veil = hero.querySelector('.hero__veil');
      const chrome = hero.querySelectorAll('.hero__enter-wrap, .hero__footer');

      if (PREFERS_REDUCED_MOTION) {
        gsap.set(globeWrap, { scale: 1 });
        gsap.set(veil, { opacity: 0 });
        gsap.set(chrome, { autoAlpha: 1 });
        armedRef.current = true;
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
      gsap.set(chrome, { autoAlpha: 0 });

      const tl = gsap.timeline();
      // The approach and the gradient arrival share one curve — the blue
      // horizon fades up exactly as the planet comes to rest.
      tl.to(globeWrap, { scale: 1, duration, ease: loomEase }, 0);
      tl.to(veil, { opacity: 0, duration, ease: loomEase }, 0);
      tl.add(() => {
        armedRef.current = true;
      }, duration * 0.78);
      tl.to(chrome, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, duration * 0.78);
    },
    { scope: heroRef }
  );

  // ── Scroll-fill → envelopment (the /work wheel/touch accumulator) ──
  useEffect(() => {
    const clearIdle = () => {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    };
    // Stalled below the threshold → rubber-band the partly-filled CTA back.
    const scheduleRelease = () => {
      clearIdle();
      idleRef.current = setTimeout(() => {
        accumRef.current = 0;
        setCtaMode('release');
        setFill(0);
      }, 160);
    };

    const addDelta = (dy) => {
      if (!armedRef.current || departingRef.current) return;
      const a = Math.max(0, accumRef.current + dy); // downward intent only
      accumRef.current = a;

      if (PREFERS_REDUCED_MOTION) {
        if (a >= RM_WHEEL_THRESHOLD) beginEnvelopment();
        return;
      }
      if (a >= SCROLL_TRIGGER) {
        clearIdle();
        setCtaMode('commit-pin'); // blue flash, held while the passage plays
        setFill(1);
        beginEnvelopment();
      } else {
        setCtaMode('drag');
        setFill(a / SCROLL_TRIGGER);
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
      addDelta((touchY - y) * 2); // upward swipe = enter (the /work gain)
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

  // ── CTA presentation vars — the /work scroll choreography on the PRIMARY
  // palette: white/blue at rest, filling (or hovering) toward the primary's
  // hover state (blue/white), pinned solid blue at the threshold ──
  const scale = 1 + CTA_MAX_EXTRA * Math.max(fill, hover ? 1 : 0);
  const ctaReturn =
    ctaMode === 'commit-pin' ? '0s' : ctaMode === 'release' ? '0.4s' : '0.12s';
  const ctaEase =
    ctaMode === 'release' ? 'cubic-bezier(0.16, 1, 0.3, 1)' : 'ease-out';
  const pct =
    ctaMode === 'commit-pin'
      ? 100
      : Math.round(Math.min(1, Math.max(fill, hover ? 1 : 0)) * 100);
  const ctaColor = {
    '--cta-bg': `color-mix(in srgb, var(--color-white), var(--color-electric-blue) ${pct}%)`,
    '--cta-fg': `color-mix(in srgb, var(--color-electric-blue), var(--color-white) ${pct}%)`,
  };

  return (
    <section className="hero" ref={heroRef}>
      {/* Black start-state over the gradient; the loom thins it away */}
      <div className="hero__veil" aria-hidden="true" />
      <div className="hero__globe" ref={globeWrapRef}>
        <VideoGlobe assets={globeAssets} />
      </div>
      {/* The PRIMARY button (enter_world family), centered over the resting
          planet; the caret strip sits outside, emerging from behind it */}
      <div className="hero__enter-wrap">
        <button
          type="button"
          className="cta-primary hero__enter"
          style={{
            '--cta-scale': scale.toFixed(3),
            '--cta-return': ctaReturn,
            '--cta-ease': ctaEase,
            ...ctaColor,
          }}
          onClick={beginEnvelopment}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
        >
          scroll_to_enter
        </button>
        <CtaArrows direction="down" />
      </div>
      <div className="hero__footer">
        <SiteFooter noFill />
      </div>
    </section>
  );
}
