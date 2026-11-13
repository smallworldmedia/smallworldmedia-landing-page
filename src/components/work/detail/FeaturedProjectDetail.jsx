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
 *      docs/orbit-deck-viewer-spec.md. A carousel is one horizontal strip in
 *      a socket of its own; an admat set gets its own flyer wall in the
 *      album-art slot; a visuals set gets a loop wall and a live-footage set a
 *      LiveFootageGrid, both mid-grid sockets (liveFootageLayout.js). The description's later
 *      paragraphs cut it into stacked grids, a text band between each.
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
import { Fragment, useEffect, useRef, useState } from 'react';
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
import { DECK_GAP_PX } from './DeckScroller.jsx';
import { carouselVisible, carouselSlideH, carouselRows } from './horizontalStrip.js';
import { sequenceRatio } from '../../../lib/mediaSequence.js';
import BannerViewer, { BANNER_VISIBLE } from './BannerViewer.jsx';
import LiveFootageGrid from './LiveFootageGrid.jsx';
import { liveFootagePlan, visualsWall, mockupsWall } from './liveFootageLayout.js';
import ServiceTag from '../ServiceTag.jsx';
import { buildContentFlow, splitHero, groupTypeOf, ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { computeFlushGrid, splitAtBreaks } from './flushGrid.js';
import {
  GRID_ROW_PX,
  SQ_ROWS_FALLBACK,
  useTileShape,
  useGridMetrics,
  tileRowsFor,
  tileRowVars,
  placementStyle,
} from './tileGrid.js';
import { formatYearRange } from '../../../lib/formatYearRange.js';
import { renderKeywords, KW_HIGHLIGHT_DETAIL } from '../../../lib/keywords.jsx';
import useKeywordWipe from './useKeywordWipe.js';
import { holdWanted, attachBlurbHold, attachBlurbFit, ARM_EVENT } from '../../../lib/blurbHold.js';
import { HOLD_MQ, PHONE_MQ, readBlurbTune } from '../../../lib/blurbHoldMath.js';

/* ── Socket region geometry (rows are 10px grid units, masonry.css) ──
   Px-fixed height (~65vh on a laptop) so the reserved region stays rigid.
   Both ORBIT and DECK reserve the full-width band (colSpan 3): the
   re-choreographed left-anchored conveyor (bandLayout.js) spans the row,
   so tiles flow above/below it — not beside — and no shadowed page
   overhangs a left-column tile (the old "floating above the grid" bug).
   Orbit still outranks deck for the top slot when a page has both.
   11-11 (Nathan, US-4): the cover wall 1.5x taller (34 → 51 rows ≈ 609px; its
   ≤1024 band, 26 → 39, is in masonry.css), at a fixed 4 columns desktop / 2 phone. */
const ORBIT_REGION_ROWS = 51;
/* 08-25 (2), Nathan: the deck sockets DOUBLED (34 → 68 rows ≈ 814px) — the
   tabbed viewer shows 2 big page columns (cols forced below), the poster
   wall gets ~4 larger flyers. The orbit keeps its original band height. */
const DECK_REGION_ROWS = 68;
/* 09-10, Nathan: banner sockets (SoundCloud headers) size to ONE AND A HALF
   banners at the grid's current width — rows derive from the measured width
   below; this is only the pre-measure fallback (≈ a 1200px grid). */
const BANNER_REGION_ROWS_FALLBACK = 38;
const ORBIT_REGION = { id: 'orbit', colStart: 0, colSpan: 3, rowSpan: ORBIT_REGION_ROWS, anchor: 'top' };
/* 11-10, Nathan — "Big flyers that play": an admat set gets one wall in the
   album-art slot, at a FIXED column count (4 desktop, 2 phone ≤ 768) so the
   flyers read big, and a socket sized from one flyer's height at the set's
   ratio (the old 34-row orbit band is ~406px; a 4x5 page in 4 columns is
   ~447px, so it would crop every one). The playing flyers ride one
   playerGate for the wall (SQ-52: DeckScroller `play`), which caps the
   players at 8 desktop / 4 phone however many pages show. 11-11 (Nathan,
   US-4): the wall 1.5 flyers tall (ADMAT_PAGES_TALL), and the cover wall
   shares the same fixed columns. Rows come from the measured grid (admatRows
   below); this is only the width they assume before it is measured. */
const WALL_COLS = 4;
const WALL_COLS_PHONE = 2;
const ADMAT_PAGES_TALL = 1.5;
const ADMAT_WIDTH_FALLBACK = 1440;
const ADMAT_GAP_FALLBACK = 2;
/* 11-11, Nathan (US-4): a carousel is ONE row of slides travelling sideways
   (DeckScroller axis 'x'), in a socket of its own one slide tall at the
   width ?carouselvis slides share (horizontalStrip.js) — the rows come from
   the measured grid (carouselRegionRows below); this is the 1440px-grid
   fallback before it is measured (3.5 slides of 4x5 across). */
const CAROUSEL_REGION_ROWS_FALLBACK = 43;
/* Text bands (11-03, Nathan): the description's first paragraph is the
   intro blurb; each later one is its own band down the grid, "after a few
   pieces of media". One every BLURB_ROWS squares of the 3-col grid from the
   top of the tile field, closed up to an even spread only when the grid is
   too short (flushGrid pinBreaks). Nathan 11-03: 2 approved ("the two
   paragraphs look great"), and 3+ go "every couple of rows" — not spread
   through the whole grid. ?blurbrows=<squares> re-dials it live. */
const BLURB_ROWS = 2;
/* US-4 (11-11): a visuals wall is as tall as its whole set, up to the deck
   wall's height (DECK_REGION_ROWS; a phone, VISUALS_ROWS_PHONE = the deck's
   ≤1024 band), so a long set drifts like a deck. ?visualsrows=<grid rows>
   re-dials the cap live (one value for every width). */
const VISUALS_ROWS_PHONE = 26;
const readVisualsRows = () => {
  const v = parseFloat(new URLSearchParams(window.location.search).get('visualsrows'));
  return Number.isFinite(v) && v > 0 ? v : null;
};
const readBlurbRows = () => {
  const v = parseFloat(new URLSearchParams(window.location.search).get('blurbrows'));
  return Number.isFinite(v) && v > 0 ? v : BLURB_ROWS;
};

/* Chunks (11-05, Nathan): a video flagged `splitIntoThirds` in Sanity shows
   as three tiles, each its own third (expandChunks, buildContentFlow.js). The
   flag arrives with the data, so the server render already splits. A flagged
   HERO plays its first third in the hero slot; thirds 2 and 3 are the 5th and
   6th showcase tiles (splitHero, HERO_SPLIT_AT). Dev
   overrides, read after mount: ?chunks=<asset slug or id>[,…] splits that
   video without the flag (what to try before the flag is on in Sanity);
   ?chunkgap=<tiles> puts that many tiles between one chunk and the next
   (default 0: the three sit together). */
const CHUNKS_NONE = { only: [], gap: 0 };
const readChunkTune = () => {
  const q = new URLSearchParams(window.location.search);
  const gap = parseInt(q.get('chunkgap'), 10);
  return {
    only: (q.get('chunks') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    gap: Number.isFinite(gap) && gap > 0 ? gap : 0,
  };
};

/* The keyword wipe, mounted when its blurb may play (its hook arms on mount). */
function KeywordWipe({ target }) {
  useKeywordWipe(target);
  return null;
}

/* The blurb copy, with its own keyword wipe: the intro and each band play
   theirs as they scroll in. On a phone with the reading hold (SQ-26) the
   entrance waits for the section to SEAT (blurbHold's ARM_EVENT), not for it
   to scroll in; with no hold (desktop, reduced motion, ?blurbhold=0) it
   plays as before. */
function BlurbCopy({ paragraphs }) {
  const ref = useRef(null);
  const [armed, setArmed] = useState(() => !holdWanted());
  useEffect(() => {
    if (armed) return undefined;
    const section = ref.current?.closest('.project-blurb');
    if (!section) return undefined;
    const arm = () => setArmed(true);
    section.addEventListener(ARM_EVENT, arm, { once: true });
    return () => section.removeEventListener(ARM_EVENT, arm);
  }, [armed]);
  return (
    <div className="project-blurb__copy" ref={ref}>
      {paragraphs.map((para, i) => (
        <p className="project-blurb__text" key={i}>
          {renderKeywords(para, KW_HIGHLIGHT_DETAIL)}
        </p>
      ))}
      {armed && <KeywordWipe target={ref} />}
    </div>
  );
}

/* The phone reading sections (SQ-26, SQ-27): each blurb is a CSS section
   (project-detail.css, ≤768px) and, for a finger, the page holds on it —
   lib/blurbHold.js. This owns the lifecycle: attach while the phone query
   matches, detach when it stops (resize-aware), and the ?blurbpeek and
   ?blurbair dials (the growth, ?blurbgrow, lives in the hold). The
   text fit (SQ-28, attachBlurbFit) rides the phone query alone: the sections
   are CSS on every phone, held or not, and it goes on first so the hold reads
   the fitted heights. */
function useBlurbHold(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const { peek, air } = readBlurbTune(window.location.search);
    if (peek != null) root.style.setProperty('--blurb-peek', String(peek));
    if (air != null) root.style.setProperty('--blurb-air', `${air}rem`);
    const phone = window.matchMedia(PHONE_MQ);
    const mq = window.matchMedia(HOLD_MQ);
    let detachFit = null;
    let detach = null;
    const sync = () => {
      if (phone.matches) detachFit ??= attachBlurbFit(root);
      else if (detachFit) {
        detachFit();
        detachFit = null;
      }
      if (holdWanted()) detach ??= attachBlurbHold(root);
      else if (detach) {
        detach();
        detach = null;
      }
    };
    sync();
    phone.addEventListener('change', sync);
    mq.addEventListener('change', sync);
    return () => {
      phone.removeEventListener('change', sync);
      mq.removeEventListener('change', sync);
      detach?.();
      detachFit?.();
      root.style.removeProperty('--blurb-peek');
      root.style.removeProperty('--blurb-air');
    };
  }, [rootRef]);
}

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
    // navSync: the nav + tagged elements fade to it on the cover's own clock.
    new CustomEvent('swm:envelop', {
      detail: {
        duration: NEXT_COVER_SECONDS,
        color: next.color,
        color2: next.colorSecondary,
        navSync: true,
      },
    })
  );
  setTimeout(() => {
    departing = false;
    navigate(`/work/${next.slug}`);
  }, NEXT_COVER_SECONDS * 1000 + 60);
}

// The breadcrumb back (10-06, Nathan): /work reopens this project's World as
// a SNAP — the same continuity as Enter World from the globe. The cover wears
// the project's accent and holds until that World's card is up (/work's
// fillOnCardRef). RM keeps the plain navigation but still cuts the cover in,
// so /work's first World never shows before the restored one.
function goBackToWork(e, color) {
  try {
    sessionStorage.setItem('swm:returnToWork', '1');
  } catch {
    /* storage unavailable */
  }
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab/window
  if (PREFERS_REDUCED_MOTION) {
    window.dispatchEvent(new CustomEvent('swm:envelop', { detail: { duration: 0, color } }));
    return;
  }
  e.preventDefault();
  if (departing) return;
  departing = true;
  window.dispatchEvent(
    new CustomEvent('swm:envelop', { detail: { duration: NEXT_COVER_SECONDS, color } })
  );
  setTimeout(() => {
    departing = false;
    navigate('/work');
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
      style={
        marquee
          ? {
              '--marquee-s': `${loopSeconds.toFixed(2)}s`,
              // 09-05: phase-locked to the wall clock (the pager-ticker
              // finding) — a re-arm (resize re-measure, a soft nav to the
              // next detail page) resumes the scroll where the clock says,
              // never from zero.
              '--marquee-phase': `${(-((performance.now() / 1000) % loopSeconds)).toFixed(3)}s`,
            }
          : undefined
      }
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

  const [chunkTune, setChunkTune] = useState(CHUNKS_NONE);
  // A flagged hero plays its first third here; the other two ride the showcase (buildContentFlow).
  const hero = splitHero(assets[0], chunkTune).hero ?? null;
  useEffect(() => setChunkTune(readChunkTune()), []);
  // `mockups` (US-5, SQ-58's lane) is absent until that lands: default it empty.
  const { showcase, albumArt, brandDecks, carousels, banners, admats, visuals, liveFootage, mockups = [] } = buildContentFlow(assets, {
    surface: 'detail',
    chunks: chunkTune,
  });

  // Banner sockets want a height in BANNERS, not rows, and tiles a shape:
  // measure the flow width (the grid is full-bleed inside it) and convert.
  // Runs at every width — the ≤1024 in-flow bands read the same rows via
  // --socket-rows and --tile-*-rows.
  const flowRef = useRef(null);
  const pageRef = useRef(null);
  useBlurbHold(pageRef);
  const tileShape = useTileShape();
  const gridMetrics = useGridMetrics(flowRef);
  const [blurbRows, setBlurbRows] = useState(BLURB_ROWS);
  useEffect(() => setBlurbRows(readBlurbRows()), []);
  const [visualsRowsParam, setVisualsRowsParam] = useState(null);
  useEffect(() => setVisualsRowsParam(readVisualsRows()), []);
  // A span of N rows is N tracks plus N-1 row gaps tall, so convert the
  // wanted pixel height through the row PITCH (track + gap), not the track.
  const bannerRows = (group) => {
    if (!gridMetrics?.width) return BANNER_REGION_ROWS_FALLBACK;
    const ratio = ratioOf(group.items[0]);
    const wantPx = (BANNER_VISIBLE * gridMetrics.width) / ratio;
    const pitch = GRID_ROW_PX + gridMetrics.rowGap;
    return Math.max(8, Math.ceil((wantPx + gridMetrics.rowGap) / pitch));
  };

  // The cover and flyer walls: fixed columns, 4 desktop / 2 phone.
  const wallCols = gridMetrics?.cols === 1 ? WALL_COLS_PHONE : WALL_COLS;
  // An admat wall: rows 1.5 flyers tall (the same row-pitch conversion as the
  // banners, rounded up) at the shape that crops the set's flyers least — a
  // set can mix 4x5 and 9x16 motion with 3x4 stills, so not the first one's.
  const admatRatio = (set) => sequenceRatio(set.items.map(ratioOf));
  const admatRows = (set) => {
    const width = gridMetrics?.width || ADMAT_WIDTH_FALLBACK;
    const gap = gridMetrics?.width ? gridMetrics.rowGap : ADMAT_GAP_FALLBACK;
    const pageH = width / wallCols / admatRatio(set);
    return Math.max(8, Math.ceil((ADMAT_PAGES_TALL * pageH + gap) / (GRID_ROW_PX + gap)));
  };
  // A carousel: one slide tall at ?carouselvis slides across (the set's
  // least-crop shape again, since the strip holds one shape).
  const carouselRatio = (set) => sequenceRatio(set.pages.map(ratioOf));
  const carouselRegionRows = (set) => {
    if (!gridMetrics?.width) return CAROUSEL_REGION_ROWS_FALLBACK;
    const vis = carouselVisible(gridMetrics.cols === 1, window.location.search);
    const slideH = carouselSlideH(gridMetrics.width, vis, DECK_GAP_PX, carouselRatio(set));
    return carouselRows(slideH, gridMetrics.rowGap, GRID_ROW_PX);
  };

  // US-4 sets (liveFootageLayout.js): a visuals wall (2 columns, 1 on a phone,
  // the whole set up to the deck wall's height) and a live-footage grid per
  // set, sized from the measured grid.
  const setGeo = { phone: gridMetrics?.cols === 1, width: gridMetrics?.width, gap: gridMetrics?.rowGap };
  const visualsMaxRows = visualsRowsParam ?? (setGeo.phone ? VISUALS_ROWS_PHONE : DECK_REGION_ROWS);
  const visualsWalls = visuals.map((set) => ({ ...set, ...visualsWall(set.items, { ...setGeo, maxRows: visualsMaxRows }) }));
  // A mockups wall (US-5): masonry columns, every piece at its own aspect, the
  // same height cap as a visuals wall.
  const mockupsWalls = mockups.map((set) => ({ ...set, ...mockupsWall(set.items, { ...setGeo, maxRows: visualsMaxRows }) }));
  const footageGrids = liveFootage.map((set) => ({ ...set, plan: liveFootagePlan(set.items, setGeo) }));

  // Tile spans, through the same pitch (tileGrid.js). ≤ 1024 the spans
  // reach CSS as custom properties.
  const tileRows = tileRowsFor(gridMetrics, tileShape);

  // ── Deck-as-featured (08-25, Nathan — bedouin/saga) ──
  // When the collection's FIRST-RANKED asset is a brand-deck page, that
  // page's WHOLE deck group is the featured media: the DeckScroller wall
  // leads the flow where the hero slot would sit, and the group leaves the
  // grid socket (any other decks keep it). buildContentFlow skipped the
  // hero page (assets[0] convention), so it folds back into its group here.
  // 11-10: by GROUP TYPE — an admat or carousel hero is a plain hero image.
  const heroIsDeck = !!hero && groupTypeOf(hero) === 'deck';
  let heroDecks = null;
  let deckSets = brandDecks;
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
    deckSets = brandDecks.filter((d) => d.group !== key);
  }
  // Carousels left the deck walls (11-11, Nathan — "carousels read like
  // socials"): each is a horizontal strip in a socket of its own (below), not
  // a tab or a poster column, so the decks lay out exactly as before.

  // ── Poster decks split out (08-25 (2), Nathan — bedouin SA tour) ──
  // Deck groups whose pages are PORTRAIT (flyers/posters compiled as a
  // deck) each get their OWN dedicated socket instead of riding the tabbed
  // guidelines viewer — a 4:5 wall wants its own frame, and the flyers
  // read as a separate body of work. Landscape decks share the tab socket.
  const tabbedDecks = deckSets.filter(
    (d) => !(d.pages[0] && ratioOf(d.pages[0]) < PORTRAIT_THRESHOLD)
  );
  const posterDecks = deckSets.filter(
    (d) => d.pages[0] && ratioOf(d.pages[0]) < PORTRAIT_THRESHOLD
  );

  // ── Socket regions from the content flow ──
  // Orbit outranks deck: a lone deck takes the top anchor, a deck sharing
  // the page with an orbit inserts mid-grid (spec § Placement). Poster
  // decks sit BELOW the rest of the grid (08-25 (2), Nathan — the SA tour
  // wall closes the tile field as a 'bottom' region).
  const regions = [];
  if (albumArt.length > 0) regions.push(ORBIT_REGION);
  // Admat walls take the album-art slot (11-10): the first holds the top
  // anchor when no cover wall does, the rest stack mid-grid after it. A deck
  // yields the top anchor to any of them.
  admats.forEach((set, i) => {
    regions.push({
      ...ORBIT_REGION,
      id: `admat:${set.group}`,
      rowSpan: admatRows(set),
      anchor: albumArt.length === 0 && i === 0 ? 'top' : 'mid',
    });
  });
  // Visuals walls and live-footage grids (US-4) stack mid-grid after the admats.
  for (const set of visualsWalls) {
    regions.push({ ...ORBIT_REGION, id: `visuals:${set.group}`, rowSpan: set.spanRows, anchor: 'mid' });
  }
  for (const set of mockupsWalls) {
    regions.push({ ...ORBIT_REGION, id: `mockups:${set.group}`, rowSpan: set.spanRows, anchor: 'mid' });
  }
  for (const set of footageGrids) {
    regions.push({ ...ORBIT_REGION, id: `footage:${set.group}`, rowSpan: set.plan.spanRows, anchor: 'mid' });
  }
  if (tabbedDecks.length > 0) {
    regions.push({
      id: 'deck',
      colStart: 0,
      colSpan: 3,
      rowSpan: DECK_REGION_ROWS,
      anchor: albumArt.length > 0 || admats.length > 0 ? 'mid' : 'top',
    });
  }
  // Carousel strips (11-11): one socket each, placed where the deck walls put
  // them before — a portrait set (4x5 posts) closes the tile field like a
  // poster deck; a landscape set takes the top anchor when nothing else holds
  // it, else sits mid-grid.
  let topFree = albumArt.length === 0 && admats.length === 0 && tabbedDecks.length === 0;
  for (const set of carousels) {
    let anchor = 'mid';
    if (carouselRatio(set) < PORTRAIT_THRESHOLD) anchor = 'bottom';
    else if (topFree) {
      anchor = 'top';
      topFree = false;
    }
    regions.push({
      id: `carousel:${set.group}`,
      colStart: 0,
      colSpan: 3,
      rowSpan: carouselRegionRows(set),
      anchor,
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
  // Banner walls close the tile field after any poster deck (09-10).
  for (const b of banners) {
    regions.push({
      id: `banner:${b.group}`,
      colStart: 0,
      colSpan: 3,
      rowSpan: bannerRows(b),
      anchor: 'bottom',
    });
  }

  const isPortraitHero = hero && !heroIsDeck && ratioOf(hero) < PORTRAIT_THRESHOLD;

  // Service tags — the union of the media's tags (queries.js PROJECT_SERVICES)
  const services = project?.services ?? [];

  // Project date — prefer project doc, fall back to newest asset yearStart
  const yearDisplay =
    formatYearRange(project?.yearStart, project?.yearEnd, project?.isOngoing) ??
    (assets.reduce((max, a) => Math.max(max, a.yearStart ?? 0), 0) || null);

  // Editorial copy comes from the optional project document. A blank line
  // in the Sanity `description` (a `text` field, Enter works in Studio) is a
  // paragraph break; single newlines stay soft.
  const displayTitle = project?.title || null;
  const paragraphs = (project?.description ?? '')
    .split(/\n\s*\n/)
    .map((para) => para.trim())
    .filter(Boolean);
  const asides = paragraphs.slice(1);

  // ── Compute flush grid placements around the reserved regions ──
  // (≤ 1024 the CSS spans govern; the 3-col placement keeps the fallback
  // there so the sockets' DOM order — and where the bands cut — matches the
  // server render.) Each later paragraph cuts a break row.
  const flush = computeFlushGrid(showcase, {
    regions,
    sqRows: tileRows?.cols === 3 ? tileRows.sq : SQ_ROWS_FALLBACK,
    breaks: asides.length,
    breakEvery: blurbRows,
  });
  const segments = splitAtBreaks(flush);
  // No tiles to break up → no breaks; the intro keeps every paragraph.
  const introParas = flush.regions.some((r) => r.anchor === 'break')
    ? paragraphs.slice(0, 1)
    : paragraphs;

  // An admat set's wall: the album-art DeckScroller at the set's least-crop
  // ratio, fixed columns, every flyer on it (showAll), animated ones playing
  // (play). Nothing until the grid is measured, so a phone never flashes the
  // desktop column count.
  const admatWall = (id) => {
    const set = admats.find((a) => `admat:${a.group}` === id);
    if (!gridMetrics) return null;
    return (
      <AlbumArtViewer
        covers={set.items}
        ratio={admatRatio(set)}
        cols={wallCols}
        showAll
        play
        ariaLabel="tour flyers"
      />
    );
  };

  // A visuals set's wall (US-4): the deck wall at the set's ratio, loops playing.
  const visualsWallNode = (id) => {
    const set = visualsWalls.find((v) => `visuals:${v.group}` === id);
    return <AlbumArtViewer covers={set.items} ratio={set.ratio} cols={set.cols} showAll play ariaLabel="visuals" />;
  };

  // A mockups set's wall (US-5): the same wall, each piece at its own aspect.
  const mockupsWallNode = (id) => {
    const set = mockupsWalls.find((m) => `mockups:${m.group}` === id);
    return <AlbumArtViewer covers={set.items} ratio={set.ratio} columns={set.columns} showAll play ariaLabel="mockups" />;
  };

  // A carousel's strip: ONE row of slides in reading order travelling left.
  // A motion page plays while it is on screen (an animated flyer progression).
  const carouselWall = (id) => {
    const set = carousels.find((c) => `carousel:${c.group}` === id);
    return (
      <AlbumArtViewer
        covers={set.pages}
        ratio={carouselRatio(set)}
        axis="x"
        rows={1}
        play
        ariaLabel={`${set.group} carousel`}
      />
    );
  };

  // Sockets interleave with tiles at their domIndex so single-column
  // (in-flow) layouts read in the right order.
  const socketNodes = (seg, i) =>
    seg.sockets.filter((s) => s.domIndex === i).map((s) => (
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
        ) : s.id.startsWith('banner:') ? (
          <BannerViewer banners={banners.find((b) => `banner:${b.group}` === s.id)} />
        ) : s.id.startsWith('admat:') ? (
          admatWall(s.id)
        ) : s.id.startsWith('carousel:') ? (
          carouselWall(s.id)
        ) : s.id.startsWith('visuals:') ? (
          visualsWallNode(s.id)
        ) : s.id.startsWith('mockups:') ? (
          mockupsWallNode(s.id)
        ) : s.id.startsWith('footage:') ? (
          <LiveFootageGrid plan={footageGrids.find((f) => `footage:${f.group}` === s.id).plan} />
        ) : gridMetrics ? (
          <AlbumArtViewer covers={albumArt} cols={wallCols} />
        ) : null}
      </GridSocket>
    ));

  /* ---- Blurb section (shared between portrait & landscape layouts) ---- */
  const blurbSection = (
    <section className="project-blurb">
      {introParas.length > 0 && <BlurbCopy paragraphs={introParas} />}

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
      ref={pageRef}
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
          reopens the World you entered from (nav link starts fresh), as a
          snap under the project-coloured cover (goBackToWork). */}
      <a
        href="/work"
        className="detail-breadcrumb"
        onClick={(e) => goBackToWork(e, project?.projectColor || undefined)}
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

      <main
        className="project-detail__flow"
        ref={flowRef}
        style={tileRowVars(tileRows)}
      >
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
            their occupants over the reserved regions. Each break cuts it:
            the grid above ends flush, the paragraph's band follows in flow
            (the intro blurb's own styling), the next grid picks up below. */}
        {segments.map((seg, k) => (
          <Fragment key={k}>
            {(seg.tiles.length > 0 || seg.sockets.length > 0) && (
              <div className="masonry-grid--detail">
                {seg.tiles.flatMap((p, i) => [
                  ...socketNodes(seg, i),
                  <MediaSlot
                    key={showcase[p.index]._id}
                    asset={showcase[p.index]}
                    // A logo keeps its edges (Nathan 11-12: TBH Logo White, an
                    // 8.9:1 wordmark, showed 23% of its width in a 2:1 tile):
                    // it scales down to fit, on the slot's near-black.
                    fit={showcase[p.index].mediaType === 'logo' ? 'contain' : undefined}
                    data-tile={p.type}
                    style={placementStyle(p)}
                  />,
                ])}
                {socketNodes(seg, seg.tiles.length)}
              </div>
            )}
            {seg.breaks.length > 0 && (
              // Keyed by its paragraphs: a regroup remounts the band, so its
              // keyword wipe re-arms on the new copy.
              <section className="project-blurb" key={seg.breaks.join()}>
                <BlurbCopy
                  paragraphs={seg.breaks.map((id) => asides[Number(id.split(':')[1])])}
                />
              </section>
            )}
          </Fragment>
        ))}
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
