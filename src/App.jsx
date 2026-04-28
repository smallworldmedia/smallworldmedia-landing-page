import { useState, useRef, useCallback, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

import InfoPanel from './sections/InfoPanel';
import Hero from './sections/Hero';
import ProjectOverlay from './sections/ProjectOverlay';

/**
 * App — Page shell.
 *
 * The InfoPanel contains its own nav bar + pill at its bottom edge.
 * In the closed state, the wrapper is translated up so only the nav bar
 * peeks into the viewport. GSAP animates the wrapper's y position.
 */
export default function App() {
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

  // Scroll → open info panel (one-shot)
  useEffect(() => {
    if (isInfoOpen) return; // Already open, no need

    const handler = () => {
      setIsInfoOpen(true);
    };

    window.addEventListener('wheel', handler, { once: true, passive: true });
    window.addEventListener('touchmove', handler, { once: true, passive: true });

    return () => {
      window.removeEventListener('wheel', handler);
      window.removeEventListener('touchmove', handler);
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
        overwrite: true,
      });
    }
  }, { scope: shellRef, dependencies: [isInfoOpen] });

  return (
    <div className="page-shell" ref={shellRef}>
      {/* Info panel — contains nav bar + pill at its bottom edge */}
      <InfoPanel isOpen={isInfoOpen} onToggle={handleToggle} />

      {/* Hero — always visible behind */}
      <Hero onStartProject={handleOpenOverlay} />

      {/* Project inquiry overlay */}
      <ProjectOverlay isOpen={isOverlayOpen} onClose={handleCloseOverlay} />
    </div>
  );
}
