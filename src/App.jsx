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

  // GSAP-driven panel slide animation
  useGSAP(() => {
    const wrapper = shellRef.current?.querySelector('.info-wrapper');
    if (!wrapper) return;

    const panelContent = wrapper.querySelector('.info-panel');
    if (!panelContent) return;

    // Sub-pixel accurate height measurement
    const contentHeight = panelContent.getBoundingClientRect().height;

    if (isInfoOpen) {
      // Open: slide wrapper down to reveal content
      gsap.to(wrapper, {
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: true,
      });
    } else {
      // Closed: translate wrapper up by content height
      gsap.to(wrapper, {
        y: -(contentHeight + 1),
        duration: 0.48,
        ease: 'power2.inOut',
        overwrite: true,
      });
    }
  }, { scope: shellRef, dependencies: [isInfoOpen] });

  // Set initial position (closed, no animation)
  // Uses rAF + getBoundingClientRect for sub-pixel accuracy (offsetHeight rounds to int)
  useGSAP(() => {
    const wrapper = shellRef.current?.querySelector('.info-wrapper');
    const panelContent = wrapper?.querySelector('.info-panel');
    if (!wrapper || !panelContent) return;

    requestAnimationFrame(() => {
      const contentH = panelContent.getBoundingClientRect().height;
      gsap.set(wrapper, { y: -(contentH + 1) });
    });
  }, { scope: shellRef });

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
