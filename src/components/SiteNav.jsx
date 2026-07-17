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

/* ── NAV micro-interaction (default = kinetic rule; ?navfx=3 = brackets) ──
   The kinetic rule + current-page state are the DEFAULT nav — no param.
   ?navfx=3 selects the BRACKETS ALT (the /work chip language), read ONCE at
   hydration (the CtaArrows ?caret idiom). The island is client:load +
   transition:persist and never remounts, so the const holds for the whole
   session across client navs (the param drops off the URL after the first
   swap — by design). Rendered as data-navfx="3" on both chrome roots
   (.site-nav and the portaled .mobile-menu) when the alt is selected; the
   alt's CSS lives in global.css scoped under [data-navfx="3"]. Any other
   value (or none) → null → the promoted default. */
const NAVFX = (() => {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('navfx') === '3' ? '3' : null;
})();

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
  const processRef = useRef(null); // home-variant ⊙ process pill (HP-1)
  const followRef = useRef(null);
  const envTlRef = useRef(null);
  const menuRef = useRef(null);
  const fxRuleRef = useRef(null); // kinetic rule (sibling of the links row)
  const [menuOpen, setMenuOpen] = useState(false);
  // Portal target for the fixed follow pill + mobile menu — client-only
  // (island is SSR'd)
  const [shellEl, setShellEl] = useState(null);
  useEffect(() => {
    setShellEl(document.querySelector('.site-shell'));
  }, []);

  // Two-pass activation for the ?navfx=3 alt: the island is SSR'd and React
  // 19 hydration adopts the server DOM without patching attribute mismatches
  // — so the data-navfx="3" attribute must land as a post-mount UPDATE
  // (server render and first client render match). With no param the state
  // stays null: zero re-render, DOM byte-identical. The kinetic rule element
  // renders UNCONDITIONALLY now — it is in the server DOM too, so it hydrates
  // clean.
  const [navfx, setNavfx] = useState(null);
  useEffect(() => {
    if (NAVFX) setNavfx(NAVFX);
  }, []);
  const fxAttr = navfx ? { 'data-navfx': navfx } : {};

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

  // ── Home ↔ site choreography ──
  useEffect(() => {
    const isHome = () => document.body.classList.contains('route-home');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const allEls = () =>
      [
        linksRef.current,
        startRef.current,
        processRef.current,
        followRef.current,
        ...(linksRef.current ? [...linksRef.current.children] : []),
      ].filter(Boolean);

    // Envelopment: pills exit through the viewport edges while the standard
    // links drop in from above — riding the passage, so /work lands seated.
    const onEnvelop = () => {
      if (!isHome() || reducedMotion) return;
      const tl = gsap.timeline();
      envTlRef.current = tl;
      if (processRef.current) {
        tl.to(processRef.current, { y: -64, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0);
      }
      if (startRef.current) {
        tl.to(startRef.current, { x: 90, autoAlpha: 0, duration: 0.4, ease: 'power2.in' }, 0);
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
          const pills = [processRef.current, startRef.current, followRef.current].filter(Boolean);
          gsap.fromTo(
            pills,
            {
              autoAlpha: 0,
              x: (i, el) => (el === startRef.current ? 18 : 0),
              y: (i, el) =>
                el === processRef.current ? -18 : el === followRef.current ? 22 : 0,
            },
            { autoAlpha: 1, x: 0, y: 0, duration: 0.5, ease: 'power3.out', clearProps: 'all' }
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

  // ── Current-page state (data-current + aria-current) ──
  // Derived from window.location on hydrate and on every astro:after-swap
  // (the island never remounts). Href-keyed by construction: start_project
  // is an interception (never current) and follow_us is external (never
  // current) — only featured_projects (/work, /work/*) and process
  // (/process) can match. The attributes survive the choreography onSwap
  // wipe (killTweensOf + clearProps strips inline STYLES only) and the
  // envelop stagger (transforms, not attributes). UNCONDITIONAL: aria-current
  // is a strict a11y win and data-current is the kinetic rule's resting seat
  // — both run with no URL param. Deps [shellEl]: the portaled mobile items
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

  // ── Kinetic rule (desktop, default) ──
  // One shared 1px rule gliding under the hovered link, resting under the
  // current one. The fxrule is a SIBLING of the links row — invisible to
  // the envelop stagger (which reads linksRef.children) and to onSwap's
  // killTweensOf/clearProps (allEls() never collects it), so its inline
  // transform/width/opacity are owned here and survive every swap. The
  // anchors' offsetParent is .site-nav__right (position: relative), the
  // same box the rule is absolute in — offsetLeft/offsetWidth map 1:1
  // with no rect math, and the envelop tween only moves anchors in Y, so
  // X measurements are always valid. Skipped under the ?navfx=3 brackets
  // alt (the rule is display:none there). Deps [navfx]: the fxrule element
  // renders unconditionally (ref populated at mount), and the effect tears
  // down and stays dormant if the alt activates post-mount.
  useEffect(() => {
    if (navfx === '3') return undefined;
    const rule = fxRuleRef.current;
    const linksEl = linksRef.current;
    if (!rule || !linksEl) return undefined;

    let visible = false;
    const suppressed = (fn) => {
      rule.style.transition = 'none';
      fn();
      void rule.offsetWidth; // commit the suppressed move before restoring
      rule.style.transition = '';
    };
    const place = (el) => {
      rule.style.transform = `translateX(${el.offsetLeft}px)`;
      rule.style.width = `${el.offsetWidth}px`;
    };
    const hide = () => {
      rule.style.opacity = '0';
      visible = false;
    };
    const moveTo = (el, { instant = false } = {}) => {
      // Never seat a 0-width rule at x:0 — the row is display:none
      // (≤768px) or visibility:hidden (route-home) and offsets read 0.
      if (!el || el.offsetWidth === 0) {
        hide();
        return;
      }
      if (!visible || instant) {
        // Materialize in place: position with transitions suppressed,
        // then fade in — never fly in from x:0.
        suppressed(() => place(el));
      } else {
        place(el);
      }
      rule.style.opacity = '1';
      visible = true;
    };
    const currentLink = () => linksEl.querySelector('[data-current]');
    const goHome = () => moveTo(currentLink());

    const onEnter = (e) => moveTo(e.currentTarget);
    const onLeave = () => goHome();
    const onFocusIn = (e) => {
      const link = e.target.closest('.site-nav__link');
      if (link) moveTo(link);
    };
    const onFocusOut = (e) => {
      // Intra-row Tab moves fire focusout+focusin per stop — only a true
      // row exit sends the rule home (kills the per-stop flicker).
      if (e.relatedTarget && linksEl.contains(e.relatedTarget)) return;
      goHome();
    };
    // Re-seat to the new current link after a swap — navigation reads as
    // the rule traveling to where you went. Two frames, not a microtask:
    // rAF still runs after refreshCurrent's after-swap listener updates
    // data-current, but a microtask fires before the swapped-in page has
    // laid out, so the rule glided to a pre-layout transient (~10px right
    // of the current link). Double-rAF lets layout settle before we measure.
    const onSwap = () =>
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!disposed) goHome();
        }),
      );
    let raf = 0;
    const onResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        moveTo(currentLink(), { instant: true });
      });
    };

    const links = [...linksEl.querySelectorAll('.site-nav__link')];
    links.forEach((l) => l.addEventListener('mouseenter', onEnter));
    linksEl.addEventListener('mouseleave', onLeave);
    linksEl.addEventListener('focusin', onFocusIn);
    linksEl.addEventListener('focusout', onFocusOut);
    document.addEventListener('astro:after-swap', onSwap);
    window.addEventListener('resize', onResize);

    // First seat: transition-suppressed under the current link
    // (data-current is already fresh — the refresh effect ran at mount).
    // Re-seat once metrics settle after the webfont swap.
    moveTo(currentLink(), { instant: true });
    let disposed = false;
    document.fonts?.ready?.then(() => {
      if (!disposed) moveTo(currentLink(), { instant: true });
    });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      links.forEach((l) => l.removeEventListener('mouseenter', onEnter));
      linksEl.removeEventListener('mouseleave', onLeave);
      linksEl.removeEventListener('focusin', onFocusIn);
      linksEl.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('astro:after-swap', onSwap);
      window.removeEventListener('resize', onResize);
    };
  }, [navfx]);

  return (
    <nav className="site-nav" {...fxAttr}>
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
        {/* The .site-nav__label spans wrap each link's text (the ?navfx=3
            brackets target them). Styling-inert: the span is the same
            flex-item box as the anonymous text node it wraps, event bubbling
            for the start_project interception is unchanged, and
            .site-nav__links still has the same direct children — the envelop
            stagger's choreography input. */}
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
            process
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

        {/* The kinetic rule (default) — a SIBLING of the links row, so it
            escapes both the envelop stagger and onSwap's killTweensOf/
            clearProps wipe (allEls() never collects it). Rendered
            unconditionally (hydrates clean; hidden by CSS under ?navfx=3);
            its inline transform/width/opacity are owned by the kinetic-rule
            effect. */}
        <span className="site-nav__fxrule" aria-hidden="true" ref={fxRuleRef} />

        {/* Home variant: primary actions as pills (steady state via
            body.route-home in CSS) */}
        <div className="site-nav__start-slot">
          <a
            href="/process"
            className="site-nav__pill site-nav__home-cta site-nav__home-process"
            ref={processRef}
          >
            <span className="site-nav__glyph">⊙</span>
            process
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

      {shellEl &&
        createPortal(
          <>
            <button
              type="button"
              className="site-nav__pill site-nav__home-cta site-nav__home-start"
              ref={startRef}
              onClick={handleStartProject}
            >
              <span className="site-nav__glyph">↳</span>
              start_project
            </button>
            <a
              href="https://instagram.com/smallworldmedia"
              className="site-nav__pill site-nav__home-cta site-nav__home-follow"
              ref={followRef}
              target="_blank"
              rel="noopener noreferrer"
            >
              <HeartIcon />
              follow_us
            </a>
          </>,
          shellEl
        )}

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
            {...fxAttr}
          >
            <div className="mobile-menu__bar">
              <img src="/icons/SWM-globe_white.svg" alt="" width="38" height="38" />
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
                process
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
