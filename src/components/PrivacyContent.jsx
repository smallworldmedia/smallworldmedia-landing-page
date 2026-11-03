/**
 * PrivacyContent — the privacy policy's ONE source (09-08). Rendered
 * statically by /privacy (direct links, crawlers) and inside the
 * PrivacyOverlay the privacy pill opens in place. Styles: global.css
 * `.privacy*`, which /terms shares.
 *
 * The copy is the 10-13 policy from `main` (PR #42), with three v1 changes.
 * The outside services are the ones this site loads (Sanity images and Mux
 * video; no jsDelivr), and the session-storage sentence stays (11-02). The
 * QuickBooks integration section is gone with QuickBooks (11-03); "Clients"
 * names only the services a client deals with (Postmark for invoices, Stripe
 * and Wise for payments), not the books behind them (Nathan). The site sets
 * no cookies and runs no analytics, so no consent banner is needed. Revisit
 * the copy, and move the date, if a service, a cookie or analytics is ever
 * added.
 */
const EMAIL = 'hello@smallworld.media';

export default function PrivacyContent({ home = true }) {
  return (
    <div className="privacy">
      <h1 className="privacy__title">Privacy Policy</h1>
      <p className="privacy__updated">Last updated: November 3, 2026</p>

      <div className="privacy__section">
        <p>
          Small World Media LLC (“Small World Media”, “we”, “us”) is a creative studio in San Diego,
          California. This policy explains what information we collect through this website,
          smallworld.media, and from the clients we work with, and how we use it.
        </p>
      </div>

      <section className="privacy__section">
        <h2>This website</h2>
        <p>
          We don’t use analytics, advertising trackers or cookies on this site. A few values are kept
          in your browser’s session storage so animations and navigation behave. They never leave
          your device and disappear when the tab closes.
        </p>
        <ul>
          <li>
            <strong>Contact form.</strong> When you send an inquiry, we receive the name, email
            address, project details and message you enter. Our host, Netlify, processes the form and
            delivers it to us by email. We use it only to reply to you and to discuss the project you
            asked about.
          </li>
          <li>
            <strong>Hosting and delivery.</strong> Like any website, the services that deliver these
            pages receive your IP address and basic request details (browser, time, page requested).
            These are Netlify (hosting), Google Fonts (typefaces), Sanity (images) and Mux (video).
            Their own privacy policies govern that data.
          </li>
        </ul>
      </section>

      <section className="privacy__section">
        <h2>Clients</h2>
        <p>
          If you work with us, we keep what we need to run your project and bill for it: your name,
          company, email and postal address, and the invoices we send and the payments we receive.
        </p>
        <ul>
          <li>
            <strong>Invoices.</strong> We email invoices through Postmark. The email notes when its
            payment link is opened, so we know the invoice has been seen.
          </li>
          <li>
            <strong>Payments.</strong> You can pay by US bank transfer through a Stripe payment link,
            through Wise, or by direct bank transfer or wire. Stripe and Wise handle the payment
            details you give them, under their own privacy policies.
          </li>
          <li>
            <strong>No selling or sharing.</strong> We don’t sell, rent or share client information,
            apart from the services named here and our accountant or tax preparer when needed for
            our own filings.
          </li>
        </ul>
      </section>

      <section className="privacy__section">
        <h2>Retention</h2>
        <p>
          We keep contact-form messages for as long as we need them to work with you, and invoices
          and payment records for as long as tax and business record-keeping rules require.
        </p>
      </section>

      <section className="privacy__section">
        <h2>Your choices</h2>
        <p>
          You can ask us what information we hold about you, or ask us to correct or delete it, by
          emailing <a href={`mailto:${EMAIL}`}>{EMAIL}</a>. California residents have these rights
          under the CCPA. We don’t sell or share personal information as those terms are defined
          there.
        </p>
      </section>

      <section className="privacy__section">
        <h2>Children</h2>
        <p>
          This site isn’t directed to children under 13, and we don’t knowingly collect their
          information.
        </p>
      </section>

      <section className="privacy__section">
        <h2>Changes</h2>
        <p>If we change this policy, we’ll update it here and change the date at the top.</p>
      </section>

      <section className="privacy__section">
        <h2>Contact</h2>
        <p>
          Small World Media LLC · San Diego, California · <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      </section>

      <nav className="privacy__links" aria-label="Legal">
        {home && <a href="/">← return_home</a>}
        <a href="/terms">terms_of_use →</a>
      </nav>
    </div>
  );
}
