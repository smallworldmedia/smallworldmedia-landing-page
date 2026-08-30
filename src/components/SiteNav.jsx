/**
 * SiteNav — Fixed top navigation bar (shared site-wide).
 *
 * Blue bar: the SWM inline lockup (08-24 — the full "Small World Media"
 * lockup replaced the bare globe mark, inlined from the shared
 * src/assets/swm-lockup-inline.svg the footer also uses) + info pill on
 * the left, sitemap links with glyph prefixes on the right. The home
 * variant — `body.route-home`, set server-side by BaseLayout (no
 * hydration flash) and swapped off by the ClientRouter on navigation —
 * is CSS-only: the bar goes transparent, the info pill's blue accents go
 * black, and the LINKS ROW (+ mobile menu pill) stays hidden —
 * the sitemap only comes into view after the scroll-trigger commit lands
 * on the featured-projects page (or any non-home route).
 *
 * Props (all optional — when omitted, links fall back to navigation):
 *   onStartProject  — callback for "start_project" click
 *   onInfoToggle    — callback for info pill click
 *   isInfoOpen      — controls info pill label ("info" vs "close")
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import gsap from 'gsap';
// The brand lockup, inlined (footer precedent) — one source of truth in
// src/assets; native blue artwork, no recolor filter.
import lockupSvg from '../assets/swm-lockup-inline.svg?raw';

/* ── NAV micro-interaction (08-29, Nathan) ── The merged bracket/fxrule
   system is RETIRED (brackets forced label gutters between glyph and text;
   the pinned current-page underline didn't land). Hover/focus now carries
   the FOOTER NAV's underline idiom (CSS text-decoration in global.css) —
   one link language across nav + footer. data-current/aria-current are
   still maintained below (a11y + any future current-page treatment). */

/* Safety net for the home chrome gate — past the default full intro's beat
   (HeroText's CHROME_SAFETY_MS idiom), so it can never preempt the
   choreography it backs up; a failed hero can never leave the nav hidden. */
const CHROME_SAFETY_MS = 6000;

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

  const navRef = useRef(null); // the visual bar — home chrome gate target
  const linksRef = useRef(null);
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Portal target for the mobile menu — client-only (island is SSR'd)
  const [shellEl, setShellEl] = useState(null);
  useEffect(() => {
    setShellEl(document.querySelector('.site-shell'));
  }, []);

  const handleStartProject = (e) => {
    if (onStartProject) {
      e.preventDefault();
      setMenuOpen(false);
      onStartProject();
    }
    // Otherwise let the <a href="/"> navigate normally
  };

  // ── Mobile menu (≤768px full-screen takeover) — fade + item stagger ──
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (menuOpen) {
      if (reducedMotion) {
        gsap.set(menu, { autoAlpha: 1 });
        gsap.set(menu.querySelectorAll('.mobile-menu__item'), { clearProps: 'all' });
      } else {
        const tl = gsap.timeline();
        tl.fromTo(menu, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3, ease: 'power2.out', overwrite: true });
        tl.fromTo(
          menu.querySelectorAll('.mobile-menu__item'),
          { y: 26, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.45, stagger: 0.07, ease: 'power3.out' },
          0.08
        );
      }
    } else {
      gsap.to(menu, {
        autoAlpha: 0,
        duration: reducedMotion ? 0 : 0.25,
        ease: 'power2.inOut',
        overwrite: true,
      });
    }
    return undefined;
  }, [menuOpen, shellEl]);

  // Escape closes; any route swap closes (navigation from a menu item).
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    const onSwap = () => setMenuOpen(false);
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('astro:after-swap', onSwap);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('astro:after-swap', onSwap);
    };
  }, [menuOpen]);

  const handleInfoClick = (e) => {
    if (onInfoToggle) {
      e.preventDefault();
      onInfoToggle();
    }
    // Otherwise let the <a href="/"> navigate normally
  };

  // ── Route-swap hygiene ──
  // Route landed: wipe any inline GSAP state off the links row so every
  // page opens on the CSS steady state (killTweensOf + clearProps strips
  // inline STYLES only — data-current/aria-current survive).
  useEffect(() => {
    const onSwap = () => {
      const els = [
        linksRef.current,
        ...(linksRef.current ? [...linksRef.current.children] : []),
      ].filter(Boolean);
      gsap.killTweensOf(els);
      gsap.set(els, { clearProps: 'all' });
    };
    document.addEventListener('astro:after-swap', onSwap);
    return () => document.removeEventListener('astro:after-swap', onSwap);
  }, []);

  // ── Current-page state (data-current + aria-current) ──
  // Derived from window.location on hydrate and on every astro:after-swap
  // (the island never remounts). Href-keyed by construction: start_project
  // is an interception (never current) and follow_us is external (never
  // current) — only featured_projects (/work, /work/*) and process
  // (/process) can match. The attributes survive the route-swap hygiene
  // wipe (killTweensOf + clearProps strips inline STYLES only, never
  // attributes). UNCONDITIONAL: aria-current is a strict a11y win and
  // data-current stays maintained for any future current-page treatment
  // (the fxrule underline it used to seat is retired, 08-29) — both run
  // with no URL param. Deps [shellEl]: the portaled mobile items
  // only exist after the setShellEl effect re-renders, so re-run once the
  // portal lands and a hard load of /work also marks the menu items (desktop
  // links refresh twice, harmlessly).
  useEffect(() => {
    const refreshCurrent = () => {
      const path = window.location.pathname.replace(/\/$/, '') || '/';
      const isCurrent = (href) =>
        (href === '/work' && (path === '/work' || path.startsWith('/work/'))) ||
        (href === '/process' && path === '/process');
      [linksRef.current, menuRef.current].filter(Boolean).forEach((root) => {
        root.querySelectorAll('a[href="/work"], a[href="/process"]').forEach((el) => {
          if (isCurrent(el.getAttribute('href'))) {
            el.setAttribute('data-current', 'true');
            el.setAttribute('aria-current', 'page');
          } else {
            el.removeAttribute('data-current');
            el.removeAttribute('aria-current');
          }
        });
      });
    };
    refreshCurrent();
    document.addEventListener('astro:after-swap', refreshCurrent);
    return () => document.removeEventListener('astro:after-swap', refreshCurrent);
  }, [shellEl]);

  // ── Home chrome gate + brand arrival choreography ──
  // Fresh HOME load: the bar stays hidden until the hero settles and fires
  // its chrome beat ('swm:hero-chrome' + the durable .hero[data-chromed="1"]
  // latch — the HeroText consumer pattern; safety timer covers a failed
  // hero). On home the bar shows ONLY the info pill in the LEFT CORNER (the
  // nav lockup + links are CSS-hidden on route-home — the lockup lives
  // centered in the hero instead).
  //
  // EVERY after-swap re-asserts bar visibility unconditionally (clearProps).
  // This is deliberate belt-and-suspenders: a swap during the island
  // teardown was observed reverting the reveal tween's inline styles (nav
  // landed on /work at opacity 0 — 08-25 bug), so visibility off-home is
  // never left to a one-shot listener again.
  //
  // HOME → OFF-HOME swap (the globe commit landing on /work) additionally
  // runs the 08-25 brand arrival: the info pill eases RIGHT from the corner
  // to its resting slot (making way), then the nav lockup slides DOWN from
  // above the frame into place — its fills already on the nav ink token
  // (--nav-ink-l) via CSS, so it lands in the correct light/dark state.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    let wasHome = document.body.classList.contains('route-home');

    const runBrandArrival = () => {
      const logo = nav.querySelector('.site-nav__logo');
      const pill = nav.querySelector('.site-nav__pill');
      if (!logo || !pill) return;
      // ≤768px the lockup is absolutely CENTERED in the bar (08-25 phone
      // order: info left, lockup center, menu right) — the pill already owns
      // the corner on home AND off-home, so there is nothing to make way for:
      // skip the slide, keep only the lockup drop (its GSAP transform
      // composes with the CSS `translate` centering).
      const centered = window.matchMedia('(max-width: 768px)').matches;
      const slide = logo.offsetWidth + 10; // lockup slot + the brand gap
      gsap.killTweensOf([logo, pill]);
      const tl = gsap.timeline({
        onComplete: () => gsap.set([logo, pill], { clearProps: 'all' }),
      });
      if (!centered) {
        tl.fromTo(
          pill,
          { x: -slide },
          { x: 0, duration: 0.5, ease: 'power3.inOut' },
          0
        );
      }
      tl.fromTo(
        logo,
        { yPercent: -180, autoAlpha: 0 },
        { yPercent: 0, autoAlpha: 1, duration: 0.45, ease: 'power3.out' },
        centered ? 0 : 0.38 // "then" — the drop starts as the pill settles
      );
    };

    // 08-25: the sitemap links stagger in on page load (Nathan's call —
    // links live on home again, no /work detour needed). Runs at the beat
    // on home, immediately on any other fresh load; clearProps on complete
    // so the CSS hover underline meets a clean row.
    const staggerLinks = () => {
      const items = nav.querySelectorAll('.site-nav__links a');
      if (!items.length) return;
      gsap.fromTo(
        items,
        { y: -10, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'all',
        }
      );
    };

    const onSwap = () => {
      const isHome = document.body.classList.contains('route-home');
      gsap.killTweensOf(nav);
      gsap.set(nav, { clearProps: 'opacity,visibility' }); // never hidden after a swap
      if (wasHome && !isHome) runBrandArrival();
      wasHome = isHome;
    };
    document.addEventListener('astro:after-swap', onSwap);

    // Initial-load gate (home only, beat not yet fired).
    let timer = null;
    let onBeat = null;
    if (wasHome && document.querySelector('.hero')?.dataset.chromed !== '1') {
      gsap.set(nav, { autoAlpha: 0 });
      let shown = false;
      const show = () => {
        if (shown) return;
        shown = true;
        clearTimeout(timer);
        window.removeEventListener('swm:hero-chrome', onBeat);
        gsap.to(nav, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
        staggerLinks();
      };
      onBeat = show;
      window.addEventListener('swm:hero-chrome', onBeat);
      timer = setTimeout(show, CHROME_SAFETY_MS);
    } else {
      // Fresh load off-home (or a pre-latched home): stagger the links in
      // once at hydration. Persisted island — this never re-runs on swaps.
      staggerLinks();
    }

    return () => {
      clearTimeout(timer);
      if (onBeat) window.removeEventListener('swm:hero-chrome', onBeat);
      document.removeEventListener('astro:after-swap', onSwap);
      gsap.killTweensOf(nav);
      gsap.set(nav, { clearProps: 'opacity,visibility' });
    };
  }, []);

  return (
    <nav className="site-nav" ref={navRef}>
      <div className="site-nav__brand">
        <a href="/" className="site-nav__logo" aria-label="Small World Media home">
          <span
            className="site-nav__lockup"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: lockupSvg }}
          />
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
        {/* The .site-nav__label spans wrap each link's text (the CSS hover
            underline targets them — glyphs stay undecorated). Styling-inert:
            the span is the same flex-item box as the anonymous text node it
            wraps, and event bubbling for the start_project interception is
            unchanged. */}
        <div className="site-nav__links" ref={linksRef}>
          <a
            href="/"
            className="site-nav__link"
            onClick={handleStartProject}
          >
            <span className="site-nav__glyph">↳</span>
            <span className="site-nav__label">start_project</span>
          </a>
          <a href="/work" className="site-nav__link">
            <span className="site-nav__glyph">⁕</span>
            <span className="site-nav__label">featured_projects</span>
          </a>
          <a href="/process" className="site-nav__link">
            <span className="site-nav__glyph">⊙</span>
            <span className="site-nav__label">process</span>
          </a>
          <a
            href="https://instagram.com/smallworldmedia"
            className="site-nav__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            <HeartIcon />
            <span className="site-nav__label">follow_us</span>
          </a>
        </div>

        {/* Mobile: links collapse into a full-screen menu (≤768px, CSS-gated) */}
        <button
          type="button"
          className="site-nav__pill site-nav__menu-pill"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? 'close' : 'menu'}
          {menuOpen ? <CloseIcon /> : <EjectIcon />}
        </button>
      </div>

      {/* Mobile menu panel — portaled to the shell (the drawer's translateY
          would capture a fixed box); brand black takeover, its own top row
          mirrors the nav geometry so close sits where menu was */}
      {shellEl &&
        createPortal(
          <div
            className="mobile-menu"
            ref={menuRef}
            data-open={menuOpen}
            aria-hidden={!menuOpen}
          >
            <div className="mobile-menu__bar">
              {/* Real home link (matches the nav-bar logo) — the fullscreen
                  panel covers the bar's logo, so this one must navigate.
                  Close on click: same-route "/" navigation never fires
                  astro:after-swap, so the swap-close listener won't run. */}
              <a
                href="/"
                className="site-nav__logo"
                aria-label="Small World Media home"
                onClick={() => setMenuOpen(false)}
              >
                <span
                  className="site-nav__lockup"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: lockupSvg }}
                />
              </a>
              <button
                type="button"
                className="site-nav__pill mobile-menu__close"
                onClick={() => setMenuOpen(false)}
              >
                close
                <CloseIcon />
              </button>
            </div>
            <nav className="mobile-menu__items" aria-label="Site menu">
              <a href="/" className="mobile-menu__item" onClick={handleStartProject}>
                <span className="site-nav__glyph">↳</span>
                <span className="site-nav__label">start_project</span>
              </a>
              <a href="/work" className="mobile-menu__item">
                <span className="site-nav__glyph">⁕</span>
                <span className="site-nav__label">featured_projects</span>
              </a>
              <a href="/process" className="mobile-menu__item">
                <span className="site-nav__glyph">⊙</span>
                <span className="site-nav__label">process</span>
              </a>
              <a
                href="https://instagram.com/smallworldmedia"
                className="mobile-menu__item"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
              >
                <HeartIcon />
                <span className="site-nav__label">follow_us</span>
              </a>
            </nav>
          </div>,
          shellEl
        )}
    </nav>
  );
}
