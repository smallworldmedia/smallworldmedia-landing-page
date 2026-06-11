import { useCallback } from 'react';
import Hero from './Hero';

/**
 * LandingPage — Landing page content (React island).
 *
 * Only renders the Hero section. The SiteNav, info drawer,
 * and project overlay now live in the persistent SiteShell
 * (rendered in BaseLayout with transition:persist).
 *
 * The Hero CTA dispatches a custom DOM event to communicate
 * with the SiteShell (separate React island):
 *   window.dispatchEvent(new CustomEvent('swm:open-overlay'))
 */
export default function LandingPage() {
  const handleStartProject = useCallback(() => {
    window.dispatchEvent(new CustomEvent('swm:open-overlay'));
  }, []);

  return (
    <div className="page-shell">
      <Hero onStartProject={handleStartProject} />
    </div>
  );
}
