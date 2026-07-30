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
 * @param {Object|null} [props.nextProject] - next-in-chain card data ({ slug,
 *   clientName, color, index }) — renders the far-right next_project chip
 */

import SocialButton, { SOCIAL_ICONS } from '../../ui/SocialButton.jsx';
import CtaArrows from '../CtaArrows.jsx';
import { projectColorVars } from '../../../lib/projectColor.js';
import { navigate } from 'astro:transitions/client';
import { PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';

// next_project rides the house Envelopment bridge (ADR-0002), same commit
// shape as WorldCard.enterWorld / the NextProjectBand passage: cover with the
// NEXT project's accent, then client-navigate; the arriving page releases it.
const NEXT_COVER_SECONDS = 0.6;
let departing = false;
function goNextProject(e, next) {
  try {
    // The breadcrumb's return-restore should reopen /work on the world we
    // land in — same handshake NextProjectBand writes at commit (which also
    // writes before its reduced-motion branch, so RM riders get it too).
    if (next.index != null) sessionStorage.setItem('swm:worldIndex', String(next.index));
  } catch {
    /* storage unavailable */
  }
  if (PREFERS_REDUCED_MOTION) return; // plain ClientRouter navigation
  e.preventDefault();
  if (departing) return;
  departing = true;
  window.dispatchEvent(
    // S2: the enter fill ingests the NEXT project's accent (blank → blue).
    new CustomEvent('swm:envelop', { detail: { duration: NEXT_COVER_SECONDS, color: next.color } })
  );
  setTimeout(() => {
    departing = false;
    navigate(`/work/${next.slug}`);
  }, NEXT_COVER_SECONDS * 1000 + 60);
}

export default function ClientPanel({
  client,
  displayTitle,
  projectColor,
  projectColorSecondary,
  nextProject = null,
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

        {/* Far right: where the chain goes next — chip-voice label + the
            looping caret strip cut horizontal. Same envelopment commit as
            the NextProjectBand at the page's foot. */}
        {nextProject && (
          <a
            className="client-panel__next"
            href={`/work/${nextProject.slug}`}
            onClick={(e) => goNextProject(e, nextProject)}
            aria-label={`Next project: ${nextProject.clientName}`}
          >
            next_project: {nextProject.clientName?.toLowerCase()}
            <CtaArrows direction="right" />
          </a>
        )}
      </div>
    </section>
  );
}
