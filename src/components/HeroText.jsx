import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

/**
 * HeroText — DOM text overlay for the hero section.
 *
 * Uses gsap.matchMedia() for responsive animation axis switching:
 * - Desktop/tablet: Y-axis drift (top→center, bottom→center), 10s linear yoyo
 * - Mobile (≤576px): X-axis drift (left→center, right→center), 10s linear yoyo
 *
 * Same two .tagline elements are reused across all breakpoints —
 * CSS repositions them, GSAP switches the animation axis.
 */
export default function HeroText() {
  const containerRef = useRef(null);

  useGSAP(() => {
    const container = containerRef.current;
    if (!container) return;

    const leftTag = container.querySelector('.tagline--left');
    const rightTag = container.querySelector('.tagline--right');
    const title = container.querySelector('.hero__title');

    // --- Hero title: one-shot slide-up + fade ---
    // Centering is CSS layout-based (left:0 + width:100% + text-align:center),
    // so GSAP only needs to animate y and opacity — no transform centering needed.
    if (title) {
      gsap.set(title, { opacity: 0, y: 40 });
      gsap.to(title, {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: 'expo.out',
        delay: 0.675,
      });
    }

    // --- Responsive tagline animations via matchMedia ---
    const mm = gsap.matchMedia();

    // Desktop / Tablet (>768px): Y-axis drift
    mm.add('(min-width: 769px)', () => {
      if (leftTag) {
        gsap.set(leftTag, { opacity: 0, y: '-30vh', x: 0 });

        gsap.to(leftTag, {
          opacity: 1,
          duration: 0.35,
          ease: 'none',
          delay: 1.35,
        });

        gsap.fromTo(leftTag,
          { y: '-30vh' },
          {
            y: 0,
            duration: 10,
            ease: 'none',
            repeat: -1,
            yoyo: true,
          }
        );
      }

      if (rightTag) {
        gsap.set(rightTag, { opacity: 0, y: '30vh', x: 0 });

        gsap.to(rightTag, {
          opacity: 1,
          duration: 0.35,
          ease: 'none',
          delay: 2.0,
        });

        gsap.fromTo(rightTag,
          { y: '30vh' },
          {
            y: 0,
            duration: 10,
            ease: 'none',
            repeat: -1,
            yoyo: true,
          }
        );
      }
    });

    // Mobile (≤768px): X-axis drift
    mm.add('(max-width: 768px)', () => {
      // Left/top tagline: drifts from 20% left → 50% center
      if (leftTag) {
        gsap.set(leftTag, { opacity: 0, x: '-30vw', y: 0 });

        gsap.to(leftTag, {
          opacity: 1,
          duration: 0.35,
          ease: 'none',
          delay: 1.35,
        });

        gsap.fromTo(leftTag,
          { x: '-30vw' },
          {
            x: 0,
            duration: 10,
            ease: 'none',
            repeat: -1,
            yoyo: true,
          }
        );
      }

      // Right/bottom tagline: drifts from 20% right → 50% center
      if (rightTag) {
        gsap.set(rightTag, { opacity: 0, x: '30vw', y: 0 });

        gsap.to(rightTag, {
          opacity: 1,
          duration: 0.35,
          ease: 'none',
          delay: 2.0,
        });

        gsap.fromTo(rightTag,
          { x: '30vw' },
          {
            x: 0,
            duration: 10,
            ease: 'none',
            repeat: -1,
            yoyo: true,
          }
        );
      }
    });

    // matchMedia cleanup is automatic via useGSAP's context
  }, { scope: containerRef });

  return (
    <div className="hero__text" ref={containerRef}>
      {/* Taglines — shared across all breakpoints, CSS repositions per breakpoint */}
      <span className="tagline tagline--left" aria-hidden="true">
        {'VISUAL_WORLDS\nFOR THE MUSIC\nINDUSTRY'}
      </span>
      <span className="tagline tagline--right" aria-hidden="true">
        {'VISUAL_WORLDS\nFOR THE MUSIC\nINDUSTRY'}
      </span>

      {/* Hero title — primary heading for SEO */}
      <h1 className="hero__title">
        SMALL WORLD MEDIA™
      </h1>
    </div>
  );
}
