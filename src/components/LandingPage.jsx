import { useState, useRef, useCallback, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';

import InfoPanel from './InfoPanel';
import Hero from './Hero';
import ProjectOverlay from './ProjectOverlay';

// Register GSAP plugins — previously in main.jsx
gsap.registerPlugin(useGSAP, Flip);

/**
 * LandingPage — Page shell (React island).
 *
 * This is the single React island that hydrates the entire
 * landing page. GSAP orchestration (Flip states, scroll→panel,
 * overlay↔hero) requires a unified React tree.
 *
 * The InfoPanel contains its own nav bar + pill at its bottom edge.
 * In the closed state, the wrapper is translated up so only the nav bar
 * peeks into the viewport. GSAP animates the wrapper's y position.
 */
export default function LandingPage() {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [sceneAnimPaused, setSceneAnimPaused] = useState(false);
  const shellRef = useRef(null);
  const animTimerRef = useRef(null);
  const flipStateRef = useRef(null);

  // Pause scene when overlay covers it OR during entrance animations
  const scenePaused = sceneAnimPaused || isOverlayOpen;

  const handleToggle = useCallback(() => {
    setIsInfoOpen((prev) => !prev);
  }, []);

  const handleOpenOverlay = useCallback((ctaElement) => {
    // Capture Flip state of the hero CTA button before overlay opens
    if (ctaElement) {
      flipStateRef.current = Flip.getState(ctaElement);
    }
    setIsOverlayOpen(true);
  }, []);

  const handleCloseOverlay = useCallback(() => {
    flipStateRef.current = null;
    setIsOverlayOpen(false);
  }, []);

  // Desktop only: scroll down → open info panel, scroll up → close
  useEffect(() => {
    const DESKTOP_MIN = 1025; // matches CSS breakpoint (max-width: 1024px)
    const DELTA_THRESHOLD = 4; // ignore tiny trackpad noise

    const handler = (e) => {
      if (window.innerWidth < DESKTOP_MIN) return;
      if (Math.abs(e.deltaY) < DELTA_THRESHOLD) return;

      if (e.deltaY > 0 && !isInfoOpen) {
        setIsInfoOpen(true);
      } else if (e.deltaY < 0 && isInfoOpen) {
        setIsInfoOpen(false);
      }
    };

    window.addEventListener('wheel', handler, { passive: true });

    return () => {
      window.removeEventListener('wheel', handler);
    };
  }, [isInfoOpen]);

  // Track open state in a ref to avoid stale closures in event listeners/observers
  const isOpenRef = useRef(isInfoOpen);
  useEffect(() => {
    isOpenRef.current = isInfoOpen;
  }, [isInfoOpen]);

  // GSAP-driven panel slide animation + Resize handling
  useGSAP(() => {
    const wrapper = shellRef.current?.querySelector('.info-wrapper');
    const panelContent = wrapper?.querySelector('.info-panel');
    if (!wrapper || !panelContent) return;

    let currentHeight = panelContent.getBoundingClientRect().height;

    // Set initial closed position instantly
    if (!isOpenRef.current) {
      gsap.set(wrapper, { y: -(currentHeight + 1) });
    }

    // ResizeObserver ensures the closed state stays perfectly hidden off-screen
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        const accurateHeight = panelContent.getBoundingClientRect().height;

        if (Math.abs(currentHeight - accurateHeight) > 0.5) {
          currentHeight = accurateHeight;

          if (!isOpenRef.current) {
            // Snaps to new height instantly without animation to prevent it leaking into view
            gsap.set(wrapper, { y: -(currentHeight + 1), overwrite: true });
          }
        }
      });
    });

    resizeObserver.observe(panelContent);

    return () => resizeObserver.disconnect();
  }, { scope: shellRef }); // Runs once, handles own state via refs

  // Handle open/close animations independently triggered by state changes
  useGSAP(() => {
    const wrapper = shellRef.current?.querySelector('.info-wrapper');
    const panelContent = wrapper?.querySelector('.info-panel');
    if (!wrapper || !panelContent) return;

    const currentHeight = panelContent.getBoundingClientRect().height;

    if (isInfoOpen) {
      // Pause WebGL scene during entrance animation — frees GPU for GSAP
      setSceneAnimPaused(true);
      clearTimeout(animTimerRef.current);
      animTimerRef.current = setTimeout(() => setSceneAnimPaused(false), 1500);

      gsap.to(wrapper, {
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: true,
      });
    } else {
      // Cancel any lingering pause timer from the open animation
      clearTimeout(animTimerRef.current);
      setSceneAnimPaused(false);

      // Slight delay lets scrollbar scaleY exit play first
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
    <div className="page-shell" ref={shellRef}>
      {/* Info panel — contains nav bar + pill at its bottom edge */}
      <InfoPanel isOpen={isInfoOpen} onToggle={handleToggle} />

      {/* Hero — always visible behind */}
      <Hero onStartProject={handleOpenOverlay} scenePaused={scenePaused} />

      {/* Project inquiry overlay */}
      <ProjectOverlay
        isOpen={isOverlayOpen}
        onClose={handleCloseOverlay}
        flipState={flipStateRef.current}
      />
    </div>
  );
}
