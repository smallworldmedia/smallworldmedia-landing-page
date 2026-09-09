/**
 * PrivacyContent — the privacy notice's ONE source (09-08). Rendered
 * statically by /privacy (direct links, crawlers) and inside the
 * PrivacyOverlay the privacy pill opens in place. Styles: global.css
 * `.privacy*`.
 *
 * The site sets no cookies and runs no tracking scripts, so no consent
 * banner is required; this states that plainly and covers the one place
 * personal data is handled (the project inquiry form → Netlify Forms →
 * studio email). Revisit if analytics or any cookie-setting service is
 * ever added.
 */
export default function PrivacyContent({ home = true }) {
  return (
    <div className="privacy">
      <h1 className="privacy__title">Privacy</h1>
      <p className="privacy__updated">Last updated: July 2026</p>

      <section className="privacy__section">
        <h2>No cookies, no tracking</h2>
        <p>
          This site sets no cookies and runs no advertising or cross-site tracking. A few values
          are kept in your browser's session storage purely to make animations and navigation
          behave (they never leave your device and disappear when the tab closes).
        </p>
      </section>

      <section className="privacy__section">
        <h2>The project inquiry form</h2>
        <p>
          When you send a project inquiry, the name, email address, selected services, and message
          you provide are delivered to us via Netlify Forms (our hosting provider's form service)
          and arrive in our studio inbox. We use them only to reply to you about your project. We
          don't sell or share them, and we don't add you to any mailing list.
        </p>
      </section>

      <section className="privacy__section">
        <h2>Hosting</h2>
        <p>
          The site is hosted on Netlify, which — like any web host — keeps standard server logs (IP
          address, requested page, time) for security and operations.
        </p>
      </section>

      <section className="privacy__section">
        <h2>Questions</h2>
        <p>
          Ask us anything about your data through the project inquiry form, or via{' '}
          <a href="https://instagram.com/smallworldmedia" target="_blank" rel="noopener noreferrer">
            Instagram
          </a>
          .
        </p>
      </section>

      {home && (
        <a className="privacy__home" href="/">
          ← return_home
        </a>
      )}
    </div>
  );
}
