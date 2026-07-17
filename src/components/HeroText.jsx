import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * HeroText — DOM text overlay for the hero section.
 *
 * 2026-07-16 home recomposition (Nathan's HP-1 call): the twin drifting
 * mono taglines become ONE statement block, vertically centered on the
 * LEFT of the viewport, set in the /process prose register (the
 * detail-blurb body voice) — the homepage speaks the same language as
 * the process page. Quiet fade-in; no drift.
 */
export default function HeroText() {
  const containerRef = useRef(null);

  useGSAP(() => {
    const lead = containerRef.current?.querySelector('.hero__lead');
    if (!lead) return;
    gsap.fromTo(
      lead,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out', delay: 1.35 }
    );
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
