import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PREFERS_REDUCED_MOTION } from './globe/globeConfig.js';

/**
 * HeroText — DOM text overlay for the hero section.
 *
 * 2026-07-16 home recomposition (Nathan's HP-1 call): the twin drifting
 * mono taglines become ONE statement block, vertically centered on the
 * LEFT of the viewport, set in the /process prose register (the
 * detail-blurb body voice) — the homepage speaks the same language as
 * the process page. Quiet fade-in; no drift.
 *
 * Reveal rides the entrance's chrome beat (swm:hero-chrome — fired by the
 * intro machine in full mode, at settle·0.78 on replay) instead of a fixed
 * delay, so the lead lands with the rest of the chrome whatever the
 * entrance length. Guards: the hero's data-chromed latch covers a mount
 * that races the event, and a safety timeout shows the line if the beat
 * never arrives. Reduced motion: instantly visible.
 */

// Safety net only — past the default full intro's beat (variant A fires it
// ~3.7s in at ?introms=5000, and the bench's 8000 ceiling keeps it under
// this), so it can never preempt the choreography it backs up.
const CHROME_SAFETY_MS = 6000;

export default function HeroText() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const lead = container?.querySelector('.hero__lead');
    if (!lead) return undefined;

    if (PREFERS_REDUCED_MOTION) {
      gsap.set(lead, { autoAlpha: 1 });
      return undefined;
    }

    gsap.set(lead, { autoAlpha: 0, y: 10 });
    let shown = false;
    let timer = null;
    const show = () => {
      if (shown) return;
      shown = true;
      clearTimeout(timer);
      window.removeEventListener('swm:hero-chrome', show);
      gsap.to(lead, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' });
    };

    if (container.closest('.hero')?.dataset.chromed === '1') {
      show(); // the beat already fired before this mount — the race guard
    } else {
      window.addEventListener('swm:hero-chrome', show);
      timer = setTimeout(show, CHROME_SAFETY_MS);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener('swm:hero-chrome', show);
      gsap.killTweensOf(lead);
    };
  }, []);

  return (
    <div className="hero__text" ref={containerRef}>
      <p className="hero__lead" aria-hidden="true">
        Visual worlds for the music industry.
      </p>

      {/* Visually-hidden h1 — the wordmark moved to the persistent nav,
          but the page keeps its primary heading for SEO/a11y */}
      <h1 className="sr-only">SMALL WORLD MEDIA™</h1>
    </div>
  );
}
