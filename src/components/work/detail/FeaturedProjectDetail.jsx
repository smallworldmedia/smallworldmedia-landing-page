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
 *   4. Dense grid — remaining showcase assets in a flush 3-col grid
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
import ClientPanel from './ClientPanel.jsx';
import MediaSlot from './MediaSlot.jsx';
import SiteFooter from './SiteFooter.jsx';
import ServiceTag from '../ServiceTag.jsx';
import { buildContentFlow, ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { formatYearRange } from '../../../lib/formatYearRange.js';

/* ── Tessellating tile sizes ──
   Designed so 1 portrait = 2 squares = 2 landscapes (stacked),
   guaranteeing the grid can always back-fill with zero gaps. */
const TILE_SIZES = {
  portrait:  { colSpan: 1, rowSpan: 48 },
  square:    { colSpan: 1, rowSpan: 24 },
  landscape: { colSpan: 2, rowSpan: 24 },
};

function classifyTile(ratio) {
  if (ratio >= PORTRAIT_THRESHOLD) return 'landscape';
  if (ratio >= 0.9) return 'square';
  return 'portrait';
}

/**
 * Simulate CSS Grid dense placement, then stretch the bottom row
 * so every column ends at the same height → flush bottom edge.
 *
 * Algorithm:
 *   1. For each asset in order, find the earliest grid position
 *      where the tile fits (mimics grid-auto-flow: dense).
 *   2. Track each column's free-row pointer.
 *   3. After all items are placed, find the global max row.
 *   4. Stretch the last item in each column to reach that max row.
 */
function computeFlushGrid(showcase, cols = 3) {
  const colFreeAt = new Array(cols).fill(0);

  const placements = showcase.map((asset) => {
    const ratio = ratioOf(asset);
    const type = classifyTile(ratio);
    const { colSpan, rowSpan } = TILE_SIZES[type];

    // Dense placement: earliest position where colSpan adjacent columns are free
    let bestRow = Infinity;
    let bestCol = 0;

    for (let c = 0; c <= cols - colSpan; c++) {
      let earliest = 0;
      for (let j = 0; j < colSpan; j++) {
        earliest = Math.max(earliest, colFreeAt[c + j]);
      }
      if (earliest < bestRow) {
        bestRow = earliest;
        bestCol = c;
      }
    }

    const rowStart = bestRow;
    const rowEnd = rowStart + rowSpan;

    // Update column pointers
    for (let j = 0; j < colSpan; j++) {
      colFreeAt[bestCol + j] = rowEnd;
    }

    return { col: bestCol, colSpan, rowStart, rowEnd, type };
  });

  // ── Flush bottom: stretch last item in each column to max row ──
  const maxRow = Math.max(...colFreeAt);

  for (let c = 0; c < cols; c++) {
    let lastIdx = -1;
    let latestEnd = 0;

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      // Does this placement occupy column c?
      if (p.col <= c && p.col + p.colSpan > c && p.rowEnd >= latestEnd) {
        latestEnd = p.rowEnd;
        lastIdx = i;
      }
    }

    if (lastIdx >= 0 && placements[lastIdx].rowEnd < maxRow) {
      placements[lastIdx].rowEnd = maxRow;
    }
  }

  return placements;
}


export default function FeaturedProjectDetail({ assets, client, project, collection }) {
  const hero = assets[0] ?? null;
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

  // ── Compute flush grid placements ──
  const placements = computeFlushGrid(showcase);

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

        {/* Dense grid — flush bottom via explicit placement */}
        {showcase.length > 0 && (
          <div className="masonry-grid masonry-grid--detail">
            {showcase.map((a, i) => {
              const p = placements[i];
              return (
                <MediaSlot
                  key={a._id}
                  asset={a}
                  data-tile={p.type}
                  style={{
                    gridColumn: `${p.col + 1} / span ${p.colSpan}`,
                    gridRow: `${p.rowStart + 1} / ${p.rowEnd + 1}`,
                  }}
                />
              );
            })}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
