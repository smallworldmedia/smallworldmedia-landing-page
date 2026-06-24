/**
 * FeaturedProjectDetail — Single Project Page orchestrator (/work/[slug]).
 *
 * Renders one Featured Project curated collection as an editorial page.
 * Layout is *populated, not authored*: the collection's contents drive
 * the structure via the Content Population Hierarchy (buildContentFlow):
 *
 *   1. ClientPanel — blue info band (title, client meta, socials)
 *   2. Hero slot — the collection's sizzle reel (isHero), full-bleed
 *   3. Project blurb — overview copy + client/date fields + ServiceTags
 *   4. Masonry grid — remaining showcase assets in a 3-col masonry flow
 *   5. SiteFooter
 *
 * SiteNav, info drawer, and project overlay are handled by the
 * persistent SiteShell in BaseLayout (transition:persist).
 *
 * @param {Object} props
 * @param {Array<Object>} props.assets    - collection assets (sortOrder asc)
 * @param {Object}        props.client    - client document
 * @param {Object|null}   props.project   - optional project doc (editorial copy)
 * @param {string}        props.collection - curated collection name (sourceManifest)
 */
import ClientPanel from './ClientPanel.jsx';
import MediaSlot from './MediaSlot.jsx';
import SiteFooter from './SiteFooter.jsx';
import ServiceTag from '../ServiceTag.jsx';
import { buildContentFlow, ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { formatYearRange } from '../../../lib/formatYearRange.js';

export default function FeaturedProjectDetail({ assets, client, project, collection }) {
  const hero = assets.find((a) => a.isHero) ?? assets[0];
  const { showcase } = buildContentFlow(assets);

  const isPortraitHero = hero && ratioOf(hero) < PORTRAIT_THRESHOLD;

  // Service tags — prefer project-level tags, fall back to asset-derived union
  const services =
    project?.services?.length > 0
      ? project.services
      : [
          ...new Map(
            assets.flatMap((a) => a.services ?? []).map((s) => [s.slug, s])
          ).values(),
        ];

  // Project date — prefer project doc, fall back to newest asset yearStart
  const yearDisplay =
    formatYearRange(project?.yearStart, project?.yearEnd, project?.isOngoing) ??
    (assets.reduce((max, a) => Math.max(max, a.yearStart ?? 0), 0) || null);

  // Editorial copy comes from the optional project document
  const displayTitle = project?.title || null;
  const overview = project?.description ?? null;

  /* ---- Blurb section (shared between portrait & landscape layouts) ---- */
  const blurbSection = (
    <section className="project-blurb">
      {overview && <p className="project-blurb__text">{overview}</p>}

      <div className="project-blurb__details">
        <div className="detail-field">
          <span className="detail-field__label">client</span>
          <span className="detail-field__value">{client?.name}</span>
        </div>
        {yearDisplay && (
          <div className="detail-field">
            <span className="detail-field__label">date</span>
            <span className="detail-field__value">{yearDisplay}</span>
          </div>
        )}
        {services.length > 0 && (
          <div className="project-blurb__tags">
            {services.map((s) => (
              <ServiceTag key={s.slug} name={s.name} />
            ))}
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div className="project-detail">
      <ClientPanel
        client={client}
        displayTitle={displayTitle}
        year={yearDisplay}
        services={services}
      />

      <main className="project-detail__flow">
        {/* Portrait hero → side-by-side band; landscape → stacked full-bleed */}
        {isPortraitHero ? (
          <div
            className="hero-band"
            style={{ '--hero-ratio': ratioOf(hero) }}
          >
            <MediaSlot asset={hero} />
            {blurbSection}
          </div>
        ) : (
          <>
            {hero && <MediaSlot asset={hero} />}
            {blurbSection}
          </>
        )}

        {/* Masonry content flow — 3-col grid of showcase assets */}
        {showcase.length > 0 && (
          <div className="masonry-grid masonry-grid--detail">
            {showcase.map((a) => (
              <MediaSlot key={a._id} asset={a} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
