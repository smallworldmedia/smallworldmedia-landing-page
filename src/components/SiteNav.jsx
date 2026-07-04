/**
 * SiteNav — Fixed top navigation bar (shared site-wide).
 *
 * Blue bar: SWM globe mark + info pill on the left, sitemap links with
 * glyph prefixes on the right.
 *
 * Home (globe) variant — `body.route-home` drives the steady states in CSS,
 * so there is no hydration flash and the ClientRouter body-attribute swap
 * restores the standard bar automatically:
 *   - the sitemap links hide; a `start_project` pill takes the top-right
 *     slot and a `follow_us` pill sits fixed at the bottom-right (portaled
 *     to the site shell so the drawer transform can't capture its fixed
 *     positioning).
 *   - on Envelopment (`swm:envelop` while home) the pills translate out of
 *     the viewport and the standard links slide down into place, so /work
 *     arrives with the bar already seated. Arriving back home eases the
 *     pills in. Reduced motion: steady states only, no choreography.
 *
 * Props (all optional — when omitted, links fall back to navigation):
 *   onStartProject  — callback for "start_project" click
 *   onInfoToggle    — callback for info pill click
 *   isInfoOpen      — controls info pill label ("info" vs "close")
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';

/** Minimal inline glyph icons (Figma uses Simple Design System icons) */
function HeartIcon() {
  return (
    <svg className="site-nav__icon site-nav__icon--sm" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 13.5S2.5 10.2 2.5 6.4C2.5 4.5 4 3 5.8 3 7 3 7.7 3.6 8 4.2 8.3 3.6 9 3 10.2 3 12 3 13.5 4.5 13.5 6.4c0 3.8-5.5 7.1-5.5 7.1Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function EjectIcon() {
  return (
    <svg className="site-nav__pill-icon" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true">
      <path d="M1 6 5 1l4 5H1Z" />
      <rect x="1" y="8.5" width="8" height="2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="site-nav__pill-icon" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function SiteNav({
  onStartProject,
  onInfoToggle,
  isInfoOpen = false,
}) {
  const pillLabel = isInfoOpen ? 'close' : 'info';
  const PillIcon = isInfoOpen ? CloseIcon : EjectIcon;

  const linksRef = useRef(null);
  const startRef = useRef(null);
  const followRef = useRef(null);
  const envTlRef = useRef(null);
  // Portal target for the fixed follow pill — client-only (island is SSR'd)
  const [shellEl, setShellEl] = useState(null);
  useEffect(() => {
    setShellEl(document.querySelector('.site-shell'));
  }, []);

  const handleStartProject = (e) => {
    if (onStartProject) {
      e.preventDefault();
      onStartProject();
    }
    // Otherwise let the <a href="/"> navigate normally
  };

  const handleInfoClick = (e) => {
    if (onInfoToggle) {
      e.preventDefault();
      onInfoToggle();
    }
    // Otherwise let the <a href="/"> navigate normally
  };

  // ── Home ↔ site choreography ──
  useEffect(() => {
    const isHome = () => document.body.classList.contains('route-home');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const allEls = () =>
      [
        linksRef.current,
        startRef.current,
        followRef.current,
        ...(linksRef.current ? [...linksRef.current.children] : []),
      ].filter(Boolean);

    // Envelopment: pills exit through the viewport edges while the standard
    // links drop in from above — riding the passage, so /work lands seated.
    const onEnvelop = () => {
      if (!isHome() || reducedMotion) return;
      const tl = gsap.timeline();
      envTlRef.current = tl;
      if (startRef.current) {
        tl.to(startRef.current, { y: -64, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0);
      }
      if (followRef.current) {
        tl.to(followRef.current, { y: 90, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0);
      }
      if (linksRef.current) {
        gsap.set(linksRef.current, { visibility: 'visible' });
        tl.fromTo(
          linksRef.current.children,
          { y: -34, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.07, ease: 'power3.out' },
          0.18
        );
      }
    };

    // Route landed: restore CSS steady states — unless the envelop
    // choreography is still gliding the links in over the swap (it ends on
    // the same values the site steady state uses; its inline styles are
    // cleared on the next swap instead).
    const onSwap = () => {
      const els = allEls();
      if (isHome()) {
        envTlRef.current?.kill();
        envTlRef.current = null;
        gsap.killTweensOf(els);
        gsap.set(els, { clearProps: 'all' });
        if (!reducedMotion) {
          const pills = [startRef.current, followRef.current].filter(Boolean);
          gsap.fromTo(
            pills,
            { autoAlpha: 0, y: (i, el) => (el === startRef.current ? -18 : 22) },
            { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'all' }
          );
        }
      } else if (!envTlRef.current?.isActive()) {
        gsap.killTweensOf(els);
        gsap.set(els, { clearProps: 'all' });
      }
    };

    window.addEventListener('swm:envelop', onEnvelop);
    document.addEventListener('astro:after-swap', onSwap);
    return () => {
      envTlRef.current?.kill();
      window.removeEventListener('swm:envelop', onEnvelop);
      document.removeEventListener('astro:after-swap', onSwap);
    };
  }, []);

  return (
    <nav className="site-nav">
      <div className="site-nav__brand">
        <a href="/" className="site-nav__logo" aria-label="Small World Media home">
          <img src="/icons/SWM-globe_white.svg" alt="" width="38" height="38" />
        </a>
        <button
          className="site-nav__pill"
          onClick={handleInfoClick}
          aria-label={isInfoOpen ? 'Close info panel' : 'Open info panel'}
          aria-expanded={isInfoOpen}
          type="button"
        >
          {pillLabel}
          <PillIcon />
        </button>
      </div>

      <div className="site-nav__right">
        <div className="site-nav__links" ref={linksRef}>
          <a
            href="/"
            className="site-nav__link"
            onClick={handleStartProject}
          >
            <span className="site-nav__glyph">↳</span>
            start_project
          </a>
          <a href="/work" className="site-nav__link">
            <span className="site-nav__glyph">⁕</span>
            featured_projects
          </a>
          <a
            href="https://instagram.com/smallworldmedia"
            className="site-nav__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HeartIcon />
            follow_us
          </a>
          {/* process link removed for v1 — the process page is a v2 workstream */}
        </div>

        {/* Home variant: primary actions as pills (steady state via
            body.route-home in CSS) */}
        <div className="site-nav__start-slot">
          <button
            type="button"
            className="site-nav__pill site-nav__home-cta site-nav__home-start"
            ref={startRef}
            onClick={handleStartProject}
          >
            <span className="site-nav__glyph">↳</span>
            start_project
          </button>
        </div>
      </div>

      {shellEl &&
        createPortal(
          <a
            href="https://instagram.com/smallworldmedia"
            className="site-nav__pill site-nav__home-cta site-nav__home-follow"
            ref={followRef}
            target="_blank"
            rel="noopener noreferrer"
          >
            <HeartIcon />
            follow_us
          </a>,
          shellEl
        )}
    </nav>
  );
}
