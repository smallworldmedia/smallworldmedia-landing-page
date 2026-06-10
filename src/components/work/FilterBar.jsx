/**
 * FilterBar — Horizontal scrollable strip of service-tag pills.
 * Lives inside the fixed .work-chrome container.
 *
 * - "All" pill is brand blue with black text; outlined when a tag is active.
 * - Active service pills show an animated × icon on the LEFT.
 * - Directional scroll arrows appear based on scroll position:
 *     → right arrow: more pills to the right
 *     ← left arrow: scrolled past the start, can scroll back
 * - When all pills fit, both arrows are hidden.
 *
 * Arrows live in absolutely-positioned containers so they
 * never affect the filter-bar's width measurement (prevents flicker).
 */
import { useRef, useLayoutEffect, useState, useEffect, useCallback } from 'react';
import gsap from 'gsap';

/** Scroll threshold to avoid sub-pixel false positives */
const SCROLL_THRESHOLD = 4;

export default function FilterBar({ tags, activeSlugs, onToggle }) {
  if (!tags?.length) return null;

  const barRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const debounceRef = useRef(null);

  /**
   * Measure scroll state: which directions can the user scroll?
   * Called on resize, scroll, and mount.
   */
  const measure = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;

    const doesOverflow = bar.scrollWidth > bar.clientWidth;
    if (!doesOverflow) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    setCanScrollLeft(bar.scrollLeft > SCROLL_THRESHOLD);
    setCanScrollRight(
      bar.scrollLeft + bar.clientWidth < bar.scrollWidth - SCROLL_THRESHOLD
    );
  }, []);

  // Resize listener
  useEffect(() => {
    measure();

    const onResize = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(measure, 80);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [measure, tags.length]);

  // Scroll listener on the bar
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    bar.addEventListener('scroll', measure, { passive: true });
    return () => bar.removeEventListener('scroll', measure);
  }, [measure]);

  const hasActiveTag = activeSlugs.size > 0;

  return (
    <div className="filter-bar__wrapper">
      <div className="filter-bar__inner">
        {/* Left arrow — scroll-back hint */}
        <ScrollArrow visible={canScrollLeft} direction="left" />

        <div
          ref={barRef}
          className="filter-bar"
          role="toolbar"
          aria-label="Filter by service"
        >
          <button
            className={`filter-bar__pill filter-bar__pill--all${
              !hasActiveTag ? ' filter-bar__pill--all-active' : ''
            }`}
            onClick={() => onToggle(null)}
          >
            All
          </button>

          {tags.map((tag) => {
            const isActive = activeSlugs.has(tag.slug);
            return (
              <FilterPill
                key={tag.slug}
                name={tag.name}
                isActive={isActive}
                onClick={() => onToggle(tag.slug)}
              />
            );
          })}
        </div>

        {/* Right arrow — scroll-forward hint */}
        <ScrollArrow visible={canScrollRight} direction="right" />
      </div>
    </div>
  );
}

/** Individual pill with animated × dismiss icon on the LEFT */
function FilterPill({ name, isActive, onClick }) {
  const iconRef = useRef(null);

  useLayoutEffect(() => {
    const el = iconRef.current;
    if (!el) return;

    if (isActive) {
      gsap.fromTo(
        el,
        { scale: 0, rotate: -90, opacity: 0 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.2, ease: 'back.out(1.4)' }
      );
    } else {
      gsap.to(el, {
        scale: 0, rotate: 90, opacity: 0,
        duration: 0.12, ease: 'power4.in',
      });
    }
  }, [isActive]);

  return (
    <button
      className={`filter-bar__pill${isActive ? ' filter-bar__pill--active' : ''}`}
      onClick={onClick}
      aria-pressed={isActive}
    >
      <span
        ref={iconRef}
        className="filter-bar__x"
        aria-hidden="true"
        style={{ scale: 0, opacity: 0 }}
      >
        ×
      </span>
      {name}
    </button>
  );
}

/**
 * Directional scroll arrow with GSAP slide-in/slide-out.
 *
 * @param {'left'|'right'} direction - Which edge the arrow sits on
 * @param {boolean} visible - Whether the arrow should be shown
 *
 * GSAP lifecycle:
 *   visible=true  → slide in from edge + start bounce loop
 *   visible=false → pause bounce + slide out past edge
 *
 * Bounce direction matches arrow direction (left arrow bounces left, etc).
 */
function ScrollArrow({ visible, direction = 'right' }) {
  const containerRef = useRef(null);
  const arrowRef = useRef(null);
  const bounceRef = useRef(null);
  const isFirstRender = useRef(true);

  const isLeft = direction === 'left';
  const offscreenX = isLeft ? -60 : 60;
  const bounceX = isLeft ? -8 : 8;

  // Create bounce loop once on mount
  useEffect(() => {
    const arrow = arrowRef.current;
    if (!arrow) return;

    bounceRef.current = gsap.timeline({ repeat: -1, yoyo: true, paused: true });
    bounceRef.current.to(arrow, {
      x: bounceX,
      duration: 0.6,
      ease: 'power2.inOut',
    });

    return () => {
      if (bounceRef.current) {
        bounceRef.current.kill();
        bounceRef.current = null;
      }
    };
  }, [bounceX]);

  // React to visibility changes — slide in/out
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      gsap.set(container, { x: visible ? 0 : offscreenX });
      if (visible && bounceRef.current) bounceRef.current.play();
      return;
    }

    gsap.killTweensOf(container);

    if (visible) {
      gsap.to(container, {
        x: 0,
        duration: 0.3,
        ease: 'power3.out',
        onComplete: () => {
          if (bounceRef.current) bounceRef.current.play();
        },
      });
    } else {
      if (bounceRef.current) bounceRef.current.pause();
      gsap.to(container, {
        x: offscreenX,
        duration: 0.18,
        ease: 'power4.in',
      });
    }
  }, [visible, offscreenX]);

  return (
    <div
      ref={containerRef}
      className={`filter-bar__arrow-container filter-bar__arrow-container--${direction}`}
      aria-hidden="true"
    >
      <span ref={arrowRef} className="filter-bar__arrow">
        {isLeft ? '←' : '→'}
      </span>
    </div>
  );
}
