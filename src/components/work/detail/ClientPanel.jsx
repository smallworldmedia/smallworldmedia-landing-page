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
 * @param {string} [props.projectColor]          - S2 accent (hex); tints the band bg
 * @param {string} [props.projectColorSecondary] - S2 second palette color (hex)
 */

import SocialButton, { SOCIAL_ICONS } from '../../ui/SocialButton.jsx';
import { projectColorVars } from '../../../lib/projectColor.js';

export default function ClientPanel({
  client,
  displayTitle,
  projectColor,
  projectColorSecondary,
}) {
  const basedIn = [client?.city, client?.country].filter(Boolean).join(', ');
  const socials = (client?.links ?? []).filter((l) => SOCIAL_ICONS[l.platform]);

  return (
    <section
      className="client-panel"
      // S2: this project's accent tints the band background (blank → brand
      // blue). Requires FeaturedProjectDetail to pass projectColor — until it
      // does, the prop is undefined and the CSS var falls back to blue.
      style={projectColorVars(projectColor, projectColorSecondary)}
    >
      <h1 className="client-panel__title">
        {!displayTitle || client?.name?.toLowerCase() === displayTitle?.toLowerCase()
          ? (client?.name ?? displayTitle)
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

        {/* The next_project chip left this row (08-30, Nathan): it rides
            inline with the breadcrumb under the panel now — right-anchored,
            NOT sticky (FeaturedProjectDetail renders it). */}
      </div>
    </section>
  );
}
