/**
 * ClientPanel — Full-width project info band (Figma "Client Panel").
 *
 * Brand-blue band below the nav: squeezed-display project title
 * ("client / collection") on the left, client metadata chips
 * (client_type, based_in) and social links on the right.
 *
 * Chips and socials render only when the client document carries the
 * data — city/country/links are populated per client in Sanity.
 *
 * @param {Object} props
 * @param {Object} props.client       - client doc (name, clientType, city, country, links)
 * @param {string} props.displayTitle - collection name or project doc title
 */

import SocialButton, { SOCIAL_ICONS } from '../../ui/SocialButton.jsx';

export default function ClientPanel({ client, displayTitle }) {
  const basedIn = [client?.city, client?.country].filter(Boolean).join(', ');
  const socials = (client?.links ?? []).filter((l) => SOCIAL_ICONS[l.platform]);

  return (
    <section className="client-panel">
      <h1 className="client-panel__title">
        {client?.name?.toLowerCase() === displayTitle?.toLowerCase()
          ? displayTitle
          : <>{client?.name} / {displayTitle}</>}
      </h1>

      <div className="client-panel__meta">
        <div className="client-panel__chips">
          {client?.clientType && (
            <p className="client-chip">
              <span className="client-chip__glyph" aria-hidden="true">✳</span>
              client_type: {client.clientType}
            </p>
          )}
          {basedIn && (
            <p className="client-chip">
              <span className="client-chip__glyph" aria-hidden="true">⌖</span>
              based_in: {basedIn.toLowerCase()}
            </p>
          )}
        </div>

        {socials.length > 0 && (
          <div className="client-panel__socials">
            {socials.map((link) => (
              <SocialButton
                key={link.platform}
                platform={link.platform}
                url={link.url}
                clientName={client.name}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
