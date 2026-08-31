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
 *      float the composite occupants: AlbumArtViewer and BrandDeckViewer
 *      (both full-width — tiles flow above/below; deck takes the top
 *      anchor when alone, mid when an orbit outranks it) —
 *      docs/orbit-deck-viewer-spec.md.
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
 * @param {Object|null}   props.nextProject - next-in-chain card data (NextProjectBand)
 */
import { useEffect, useRef, useState } from 'react';
import { navigate } from 'astro:transitions/client';
import ClientPanel from './ClientPanel.jsx';
import CtaArrows from '../CtaArrows.jsx';
import { PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';
import MediaSlot from './MediaSlot.jsx';
import DetailProgressBar from './DetailProgressBar.jsx';
import NextProjectBand from './NextProjectBand.jsx';
import SiteFooter from '../../SiteFooter.jsx';
import GridSocket from './GridSocket.jsx';
import BrandDeckViewer from './BrandDeckViewer.jsx';
import AlbumArtViewer from './AlbumArtViewer.jsx';
import ServiceTag from '../ServiceTag.jsx';
import { buildContentFlow, ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { computeFlushGrid } from './flushGrid.js';
import { formatYearRange } from '../../../lib/formatYearRange.js';

/* ── Socket region geometry (rows are 10px grid units, masonry.css) ──
   Px-fixed height (~65vh on a laptop) so the reserved region stays rigid.
   Both ORBIT and DECK reserve the full-width band (colSpan 3): the
   re-choreographed left-anchored conveyor (bandLayout.js) spans the row,
   so tiles flow above/below it — not beside — and no shadowed page
   overhangs a left-column tile (the old "floating above the grid" bug).
   Orbit still outranks deck for the top slot when a page has both. */
const ORBIT_REGION_ROWS = 34;
/* 08-25 (2), Nathan: the deck sockets DOUBLED (34 → 68 rows ≈ 814px) — the
   tabbed viewer shows 2 big page columns (cols forced below), the poster
   wall gets ~4 larger flyers. The orbit keeps its original band height. */
const DECK_REGION_ROWS = 68;
const ORBIT_REGION = { id: 'orbit', colStart: 0, colSpan: 3, rowSpan: ORBIT_REGION_ROWS, anchor: 'top' };

/* ── next_project chip (08-30, Nathan — moved out of the ClientPanel meta
   row): rides INLINE with the breadcrumb under the panel — right-anchored
   to the viewport, NOT sticky (the breadcrumb alone pins; this scrolls
   away with the content). Its max-width matches the breadcrumb's rendered
   box, so long client names overflow the name window — the field then
   scrolls on repeat (marquee): JS measures the single copy against the
   window, and only an actual overflow mounts the duplicate + animation
   (reduced motion never marquees — the name just clips). Commit rides the
   same envelopment bridge as before. ── */
const NEXT_COVER_SECONDS = 0.6;
const MARQUEE_PX_PER_S = 30; // loop pace — one copy-width per this many px/s
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

function DetailNextChip({ next }) {
  const windowRef = useRef(null);
  const copyRef = useRef(null);
  const [marquee, setMarquee] = useState(false);
  const [loopSeconds, setLoopSeconds] = useState(0);

  useEffect(() => {
    const measure = () => {
      const win = windowRef.current;
      const copy = copyRef.current;
      if (!win || !copy) return;
      if (PREFERS_REDUCED_MOTION) {
        setMarquee(false);
        return;
      }
      // Measure the SINGLE copy against its window (the duplicate mounts
      // only after this flips true, so the measurement is never polluted).
      const over = copy.scrollWidth > win.clientWidth + 1;
      setMarquee(over);
      // Loop travel = one copy incl. its marquee gap (offsetWidth counts the
      // [data-marquee] padding on the next frame; the pre-pad width is close
      // enough — the pace knob absorbs the difference).
      if (over) setLoopSeconds(Math.max(2, copy.scrollWidth / MARQUEE_PX_PER_S));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [next]);

  // The WHOLE label line is the scrolling field ("next_project: name") —
  // a static prefix outside the window would eat the breadcrumb-width cap
  // and leave the name a few px (observed: one letter). Short labels that
  // fit stay static; the rest tick past whole.
  const label = `next_project: ${next.clientName?.toLowerCase() ?? ''}`;
  return (
    <a
      className="detail-next"
      href={`/work/${next.slug}`}
      onClick={(e) => goNextProject(e, next)}
      aria-label={`Next project: ${next.clientName}`}
      data-marquee={marquee || undefined}
      style={marquee ? { '--marquee-s': `${loopSeconds.toFixed(2)}s` } : undefined}
    >
      <span className="detail-next__window" ref={windowRef} aria-hidden="true">
        <span className="detail-next__track">
          <span className="detail-next__copy" ref={copyRef}>{label}</span>
          {marquee && <span className="detail-next__copy">{label}</span>}
        </span>
      </span>
      <CtaArrows direction="right" />
    </a>
  );
}

export default function FeaturedProjectDetail({ assets, client, project, collection, nextProject }) {
  // Release the Envelopment fill if this arrival came through the
  // enter_world bridge (ADR-0002). No-op on direct loads.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);
  // The nav accent itself is applied by the persistent RouteFill route
  // controller (before paint, from the data-nav-accent-* attributes below) so
  // the shell nav is already this project's colour on the first frame — no
  // post-hydration broadcast, no brand-blue flash.

  const hero = assets[0] ?? null;
  const { showcase, albumArt, brandDecks } = buildContentFlow(assets);

  // ── Deck-as-featured (08-25, Nathan — bedouin/saga) ──
  // When the collection's FIRST-RANKED asset is a brand-deck page, that
  // page's WHOLE deck group is the featured media: the DeckScroller wall
  // leads the flow where the hero slot would sit, and the group leaves the
  // grid socket (any other decks keep it). buildContentFlow skipped the
  // hero page (assets[0] convention), so it folds back into its group here.
  const heroIsDeck = hero?.mediaType === 'brand-deck';
  let heroDecks = null;
  let gridDecks = brandDecks;
  if (heroIsDeck) {
    const key = hero.displayGroup ?? 'deck';
    const rest = brandDecks.find((d) => d.group === key)?.pages ?? [];
    heroDecks = [
      {
        group: key,
        pages: [hero, ...rest].sort(
          (a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0)
        ),
      },
    ];
    gridDecks = brandDecks.filter((d) => d.group !== key);
  }

  // ── Poster decks split out (08-25 (2), Nathan — bedouin SA tour) ──
  // Deck groups whose pages are PORTRAIT (flyers/posters compiled as a
  // deck) each get their OWN dedicated socket instead of riding the tabbed
  // guidelines viewer — a 4:5 wall wants its own frame, and the flyers
  // read as a separate body of work. Landscape decks share the tab socket.
  const tabbedDecks = gridDecks.filter(
    (d) => !(d.pages[0] && ratioOf(d.pages[0]) < PORTRAIT_THRESHOLD)
  );
  const posterDecks = gridDecks.filter(
    (d) => d.pages[0] && ratioOf(d.pages[0]) < PORTRAIT_THRESHOLD
  );

  // ── Socket regions from the content flow ──
  // Orbit outranks deck: a lone deck takes the top anchor, a deck sharing
  // the page with an orbit inserts mid-grid (spec § Placement). Poster
  // decks sit BELOW the rest of the grid (08-25 (2), Nathan — the SA tour
  // wall closes the tile field as a 'bottom' region).
  const regions = [];
  if (albumArt.length > 0) regions.push(ORBIT_REGION);
  if (tabbedDecks.length > 0) {
    regions.push({
      id: 'deck',
      colStart: 0,
      colSpan: 3,
      rowSpan: DECK_REGION_ROWS,
      anchor: albumArt.length > 0 ? 'mid' : 'top',
    });
  }
  for (const d of posterDecks) {
    regions.push({
      id: `deck-solo:${d.group}`,
      colStart: 0,
      colSpan: 3,
      rowSpan: DECK_REGION_ROWS,
      anchor: 'bottom',
    });
  }

  const isPortraitHero = hero && !heroIsDeck && ratioOf(hero) < PORTRAIT_THRESHOLD;

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
          // 2 fixed page columns (08-25 (2)) — big spreads, not a lattice
          <BrandDeckViewer decks={tabbedDecks} cols={2} />
        ) : s.id.startsWith('deck-solo:') ? (
          // A poster deck's dedicated wall — single group, no tabs, the
          // group name chip carries the identity.
          <BrandDeckViewer
            decks={posterDecks.filter((d) => `deck-solo:${d.group}` === s.id)}
          />
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
    // S2: declares this project's accent for the RouteFill route controller to
    // apply to the shell nav BEFORE paint on arrival (data-nav-accent absent →
    // brand-blue fallback). data-nav-accent-page marks this as an accent route.
    <div
      className="project-detail"
      data-nav-accent-page=""
      data-nav-accent={project?.projectColor || undefined}
      data-nav-accent-2={project?.projectColorSecondary || undefined}
    >
      <ClientPanel
        client={client}
        displayTitle={displayTitle}
        year={yearDisplay}
        services={services}
        projectColor={project?.projectColor}
        projectColorSecondary={project?.projectColorSecondary}
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
        {/* Inline SVG return arrow (08-30 (3), Nathan): the ↩ codepoint
            carries an emoji presentation on iOS — a drawn glyph can't be
            hijacked by the emoji font. Strokes ride currentColor. */}
        <span className="detail-breadcrumb__glyph" aria-hidden="true">
          <svg viewBox="0 0 15 13" fill="none">
            <path
              d="M14 1v3a4 4 0 0 1-4 4H2"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M6 4 2 8l4 4"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </span>
        featured_projects
      </a>

      {/* next_project chip — INLINE with the breadcrumb (08-30, Nathan):
          right-anchored, same height-neutral row, deliberately NOT sticky
          (only the breadcrumb pins; this scrolls up with the content). */}
      {nextProject && <DetailNextChip next={nextProject} />}

      <main className="project-detail__flow">
        {/* Deck hero → the featured deck's wall leads the flow; portrait
            hero → side-by-side band; landscape → stacked full-bleed */}
        {heroDecks ? (
          <>
            <div className="hero-deck">
              <BrandDeckViewer decks={heroDecks} />
            </div>
            {blurbSection}
          </>
        ) : isPortraitHero ? (
          <div
            className="hero-band"
            style={{ '--hero-ratio': ratioOf(hero) }}
          >
            <MediaSlot asset={hero} eager />
            {blurbSection}
          </div>
        ) : (
          <>
            {hero && <MediaSlot asset={hero} eager />}
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

      {/* Continuation: the next project's card + the resistance gesture
          that carries the user into it (chain wraps last → first). */}
      {nextProject && <NextProjectBand next={nextProject} />}

      {/* Scroll status bar (08-30 (2), Nathan — replaced the ProcessMeter
          promotion): accent capsule over a darker tint, no count; appears
          on first scroll, wipes out left→right at the media's end. */}
      <DetailProgressBar />

      <SiteFooter />
    </div>
  );
}
