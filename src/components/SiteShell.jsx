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

gsap.registerPlugin(useGSAP, Flip);

export default function SiteShell() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const shellRef = useRef(null);

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
        flipState={null}
      />
    </div>
  );
}
