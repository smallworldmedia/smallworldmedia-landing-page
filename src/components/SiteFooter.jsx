/**
 * SiteFooter — Simple site footer (Figma "Footer", simple variant).
 *
 * The home-hero composition is THE footer site-wide: studio tagline +
 * copyright line (the old SWM globe-mark variant is retired — one footer,
 * everywhere). `noFill` drops both background fills for overlay use (the
 * home hero bookends its transparent nav with it); `tagline` overrides the
 * default studio line. The expanded variant with footer nav links exists
 * in the Figma (hidden layer "links footer") — future iteration.
 */
export default function SiteFooter({
  noFill = false,
  tagline = 'Visual Worlds for the Music Industry',
}) {
  return (
    <footer className={`site-footer${noFill ? ' site-footer--nofill' : ''}`}>
      <div className="site-footer__bar">
        <p className="site-footer__tagline">{tagline}</p>
        <p className="site-footer__copy">
          ©{new Date().getFullYear()} Small World Media LLC. All Rights Reserved.
          {' · '}
          <a className="site-footer__privacy" href="/privacy">privacy</a>
        </p>
      </div>
    </footer>
  );
}
