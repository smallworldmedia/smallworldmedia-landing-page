/**
 * SiteNav — Fixed top navigation bar (Figma "Navigation").
 *
 * Black bar: rotating SWM globe + info pill on the left,
 * sitemap links with glyph prefixes on the right.
 *
 * The info pill is a static link back to the landing page for now —
 * the landing page's animated InfoPill/InfoPanel pairing stays
 * landing-only until a shared site chrome pass.
 */

/** Minimal inline glyph icons (Figma uses Simple Design System icons) */
function FolderIcon() {
  return (
    <svg className="site-nav__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-9Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

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

function EyeIcon() {
  return (
    <svg className="site-nav__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.2" />
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

export default function SiteNav() {
  return (
    <nav className="site-nav">
      <div className="site-nav__brand">
        <a href="/" className="site-nav__logo" aria-label="Small World Media home">
          <img src="/swm-globe.gif" alt="" width="38" height="38" />
        </a>
        <a href="/" className="site-nav__pill">
          info
          <EjectIcon />
        </a>
      </div>

      <div className="site-nav__links">
        <a href="/" className="site-nav__link">
          <span className="site-nav__glyph">↳</span>
          start_project
        </a>
        <a href="/work/featured" className="site-nav__link">
          <span className="site-nav__glyph">⁕</span>
          featured_projects
        </a>
        <a href="/work" className="site-nav__link">
          <FolderIcon />
          project_directory
        </a>
        <a href="#" className="site-nav__link">
          <HeartIcon />
          follow_us
        </a>
        <a href="#" className="site-nav__link">
          <EyeIcon />
          process
        </a>
      </div>
    </nav>
  );
}
