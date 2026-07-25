/**
 * SiteShell — Persistent site-wide shell (React island).
 *
 * Lives in BaseLayout with `transition:persist` so it survives
 * Astro page navigations without reloading. Contains:
 *   - InfoPanel (client drawer + SiteNav)
 *   - ProjectOverlay (inquiry form)
 *
 * Cross-island communication:
 *   - Listens for `swm:open-overlay` CustomEvent from Hero CTA
 *   - Scroll-to-toggle drawer works on all pages
 *
 * Architecture:
 * ┌────────────────────────────────────────┐
 * │  .site-shell (fixed, z-index 100)     │
 * │  ┌──────────────────────────────────┐  │
 * │  │ info-wrapper                     │  │
 * │  │   InfoPanel (client drawer)      │  │
 * │  │   SiteNav (bottom of wrapper)    │  │
 * │  └──────────────────────────────────┘  │
 * │  ProjectOverlay (when open)            │
 * └────────────────────────────────────────┘
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

import InfoPanel from './InfoPanel';
import ProjectOverlay from './ProjectOverlay';
import RouteFill from './RouteFill';
import { LENIS_TUNE_ACTIVE } from '../lib/lenisTune.js';

gsap.registerPlugin(useGSAP, Flip);

export default function SiteShell() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const shellRef = useRef(null);

  // A2b Lenis tuning bench — mount only AFTER hydration. LENIS_TUNE_ACTIVE
  // reads the URL, which must match server render; deferring to an effect keeps
  // the first client render byte-identical to SSR (see fp1Tune's mount note).
  // The panel is also CODE-SPLIT: the same effect that opens the gate pulls the
  // chunk in, so the bench (and its stylesheet, imported inside the panel) never
  // rides the shipped SiteShell payload. State holds the component itself, so
  // the setter needs the UPDATER form — setLenisTunePanel(Component) would treat
  // a function value as a reducer and call it.
  const [LenisTunePanel, setLenisTunePanel] = useState(null);
  useEffect(() => {
    if (!LENIS_TUNE_ACTIVE) return;
    // `alive` covers the late-resolve case: a ClientRouter navigation can unmount
    // this island before the chunk lands, and setState-after-unmount would warn.
    // React 19 StrictMode double-invokes this in dev — the second pass re-imports
    // from the module cache and re-sets, so the panel still arrives.
    let alive = true;
    import('./LenisTunePanel.jsx')
      .then((m) => {
        if (alive) setLenisTunePanel(() => m.default);
      })
      .catch(() => {
        /* dev bench only — a blocked/offline chunk just means no panel */
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleToggle = useCallback(() => {
    setIsInfoOpen((prev) => !prev);
  }, []);

  const handleOpenOverlay = useCallback(() => {
    setIsOverlayOpen(true);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  // Listen for Hero CTA custom event (cross-island communication)
  useEffect(() => {
    const handler = () => setIsOverlayOpen(true);
    window.addEventListener('swm:open-overlay', handler);
    return () => window.removeEventListener('swm:open-overlay', handler);
  }, []);

  // Track open state in a ref for GSAP closures
  const isOpenRef = useRef(isInfoOpen);
  useEffect(() => {
    isOpenRef.current = isInfoOpen;
  }, [isInfoOpen]);

  // F1 footer nav-slide gate: mark <html> while the info drawer or inquiry
  // overlay is open so the footer-reveal shell slide (global.css) backs off. A
  // transformed .site-shell becomes the containing block for the fixed overlay,
  // which would otherwise shift by the nav height when both are active at once.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-chrome-open', isInfoOpen || isOverlayOpen);
  }, [isInfoOpen, isOverlayOpen]);

  // Reserve the classic scrollbar's width as a DEVICE CONSTANT (→ --scrollbar-w),
  // measured off an off-screen probe rather than innerWidth − clientWidth. The
  // old measurement read the CURRENT route's scrollbar (≈15px on a scrollable
  // route, 0 on a locked one), so the nav/footer right inset — and with it the
  // right-edge items — jumped between pages. The probe reports the device's
  // scrollbar width the SAME on every route (0 on overlay-scrollbar systems),
  // so the inset is identical whether or not this page scrolls, while the
  // `max(--space-4, --scrollbar-w)` in global.css still reserves room to clear
  // the bar where it appears. Re-measured on resize (browser zoom, or plugging
  // a mouse that flips macOS overlay↔classic scrollbars, changes the width).
  useEffect(() => {
    const setSbw = () => {
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;visibility:hidden;pointer-events:none;';
      document.body.appendChild(probe);
      const w = Math.max(0, probe.offsetWidth - probe.clientWidth);
      probe.remove();
      document.documentElement.style.setProperty('--scrollbar-w', `${w}px`);
    };
    setSbw();
    window.addEventListener('resize', setSbw);
    return () => window.removeEventListener('resize', setSbw);
  }, []);

  // GSAP: initial closed position + resize tracking
  useGSAP(() => {
    const wrapper = shellRef.current?.querySelector('.info-wrapper');
    const panelContent = wrapper?.querySelector('.info-panel');
    if (!wrapper || !panelContent) return;

    let currentHeight = panelContent.getBoundingClientRect().height;

    if (!isOpenRef.current) {
      gsap.set(wrapper, { y: -(currentHeight + 1) });
    }

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const accurateHeight = panelContent.getBoundingClientRect().height;
        if (Math.abs(currentHeight - accurateHeight) > 0.5) {
          currentHeight = accurateHeight;
          if (!isOpenRef.current) {
            gsap.set(wrapper, { y: -(currentHeight + 1), overwrite: true });
          }
        }
      });
    });

    resizeObserver.observe(panelContent);
    return () => resizeObserver.disconnect();
  }, { scope: shellRef });

  // GSAP: open/close slide animation
  useGSAP(() => {
    const wrapper = shellRef.current?.querySelector('.info-wrapper');
    const panelContent = wrapper?.querySelector('.info-panel');
    if (!wrapper || !panelContent) return;

    const currentHeight = panelContent.getBoundingClientRect().height;

    if (isInfoOpen) {
      gsap.to(wrapper, {
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: true,
      });
    } else {
      gsap.to(wrapper, {
        y: -(currentHeight + 1),
        duration: 0.48,
        ease: 'power2.inOut',
        delay: 0.15,
        overwrite: true,
      });
    }
  }, { scope: shellRef, dependencies: [isInfoOpen] });

  return (
    <div className="site-shell" ref={shellRef}>
      {/* Envelopment bridge — persists across route swaps (ADR-0002).
          First in the shell so the nav chrome paints above the fill. */}
      <RouteFill />

      <InfoPanel
        isOpen={isInfoOpen}
        onToggle={handleToggle}
        onStartProject={handleOpenOverlay}
      />

      <ProjectOverlay
        isOpen={isOverlayOpen}
        onClose={handleCloseOverlay}
      />

      {LenisTunePanel && <LenisTunePanel />}
    </div>
  );
}
