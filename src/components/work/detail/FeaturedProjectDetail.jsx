/**
 * FeaturedProjectDetail — Single Project Page orchestrator (/work/[slug]).
 *
 * Renders one Featured Project curated collection as an editorial page.
 * Layout is *populated, not authored*: the collection's contents drive
 * the structure via the Content Population Hierarchy (buildContentFlow):
 *
 *   1. ClientPanel — blue info band (title, client meta, socials)
 *   2. Hero slot — the collection's first-ranked asset (assets[0]), full-bleed
 *   3. Project blurb — overview copy + client/date fields + ServiceTags
 *   4. Dense grid — remaining showcase assets in a flush 3-col grid,
 *      flowing around Grid Socket reserved regions (flushGrid.js) that
 *      float the composite occupants: AlbumArtOrbit (2-col, top anchor)
 *      and BrandDeckViewer (full-width; top when alone, mid when an
 *      orbit outranks it) — docs/orbit-deck-viewer-spec.md.
 *   5. SiteFooter
 *
 * SiteNav, info drawer, and project overlay are handled by the
 * persistent SiteShell in BaseLayout (transition:persist).
 *
 * @param {Object} props
 * @param {Array<Object>} props.assets    - collection assets (orderRank asc)
 * @param {Object}        props.client    - client document
 * @param {Object|null}   props.project   - optional project doc (editorial copy)
 * @param {string}        props.collection - curated collection name (sourceManifest)
 */
import { useEffect } from 'react';
import ClientPanel from './ClientPanel.jsx';
import MediaSlot from './MediaSlot.jsx';
import SiteFooter from '../../SiteFooter.jsx';
import GridSocket from './GridSocket.jsx';
import BrandDeckViewer from './BrandDeckViewer.jsx';
import AlbumArtViewer from './AlbumArtViewer.jsx';
import ServiceTag from '../ServiceTag.jsx';
import { buildContentFlow, ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { computeFlushGrid } from './flushGrid.js';
import { formatYearRange } from '../../../lib/formatYearRange.js';

/* ── Socket region geometry (rows are 10px grid units, masonry.css) ──
   Both composite bands share one footprint: full-width, px-fixed height
   (~65vh on a laptop) so the reserved region stays rigid. The album band
   mirrors the deck band by design (cohesion of structure and weight);
   orbit still outranks deck for the top slot when a page has both. */
const DECK_REGION_ROWS = 34;
const ORBIT_REGION = { id: 'orbit', colStart: 0, colSpan: 3, rowSpan: DECK_REGION_ROWS, anchor: 'top' };


export default function FeaturedProjectDetail({ assets, client, project, collection }) {
  // Release the Envelopment fill if this arrival came through the
  // enter_world bridge (ADR-0002). No-op on direct loads.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);

  const hero = assets[0] ?? null;
  const { showcase, albumArt, brandDecks } = buildContentFlow(assets);

  // ── Socket regions from the content flow ──
  // Orbit outranks deck: a lone deck takes the top anchor, a deck sharing
  // the page with an orbit inserts mid-grid (spec § Placement).
  const regions = [];
  if (albumArt.length > 0) regions.push(ORBIT_REGION);
  if (brandDecks.length > 0) {
    regions.push({
      id: 'deck',
      colStart: 0,
      colSpan: 3,
      rowSpan: DECK_REGION_ROWS,
      anchor: albumArt.length > 0 ? 'mid' : 'top',
    });
  }

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

  // ── Compute flush grid placements around the reserved regions ──
  const { placements, regions: sockets } = computeFlushGrid(showcase, { regions });

  // Sockets interleave with tiles at their domIndex so single-column
  // (in-flow) layouts read in the right order.
  const socketsAt = new Map();
  for (const s of sockets) {
    if (!socketsAt.has(s.domIndex)) socketsAt.set(s.domIndex, []);
    socketsAt.get(s.domIndex).push(s);
  }
  const socketNodes = (i) =>
    (socketsAt.get(i) ?? []).map((s) => (
      <GridSocket key={`socket-${s.id}`} region={s}>
        {s.id === 'deck' ? (
          <BrandDeckViewer decks={brandDecks} />
        ) : (
          <AlbumArtViewer covers={albumArt} />
        )}
      </GridSocket>
    ));

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

      {/* Breadcrumb back to the Featured Projects experience. Sits under
          the client panel on the left, rides sticky under the nav once the
          panel scrolls away. Clicking arms the return-restore — /work
          reopens the World you entered from (nav link starts fresh). */}
      <a
        href="/work"
        className="detail-breadcrumb"
        onClick={() => {
          try {
            sessionStorage.setItem('swm:returnToWork', '1');
          } catch {
            /* storage unavailable */
          }
        }}
      >
        <span className="detail-breadcrumb__glyph" aria-hidden="true">↩</span>
        featured_projects
      </a>

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

        {/* Dense grid — flush bottom via explicit placement; sockets float
            their occupants over the reserved regions */}
        {(showcase.length > 0 || sockets.length > 0) && (
          <div className="masonry-grid masonry-grid--detail">
            {showcase.flatMap((a, i) => {
              const p = placements[i];
              return [
                ...socketNodes(i),
                <MediaSlot
                  key={a._id}
                  asset={a}
                  data-tile={p.type}
                  style={{
                    gridColumn: `${p.col + 1} / span ${p.colSpan}`,
                    gridRow: `${p.rowStart + 1} / ${p.rowEnd + 1}`,
                    // Forced-fill tiles paint beneath intact neighbors
                    zIndex: p.underlay ? 0 : 1,
                  }}
                />,
              ];
            })}
            {socketNodes(showcase.length)}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
