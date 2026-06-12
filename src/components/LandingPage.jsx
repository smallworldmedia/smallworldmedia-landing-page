import Hero from './Hero';

/**
 * LandingPage — Landing page content (React island).
 *
 * Only renders the Hero section. The SiteNav, info drawer,
 * and project overlay live in the persistent SiteShell
 * (rendered in BaseLayout with transition:persist), which
 * owns the start-project / follow-us actions.
 */
export default function LandingPage({ globeAssets }) {
  return (
    <div className="page-shell">
      <Hero globeAssets={globeAssets} />
    </div>
  );
}
