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
 *   4. Dense grid — remaining showcase assets in a flush grid,
 *      flowing around Grid Socket reserved regions (flushGrid.js) that
 *      float the composite occupants: AlbumArtViewer and BrandDeckViewer
 *      (both full-width — tiles flow above/below) —
 *      docs/orbit-deck-viewer-spec.md. A carousel is one horizontal strip in
 *      a socket of its own; an admat set gets its own flyer wall; a visuals
 *      set gets a loop wall and a live-footage set a LiveFootageGrid
 *      (liveFootageLayout.js). Every set sits where its first member ranks
 *      in Studio (11-14, the `seat` anchor). The description's later
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
import { projectColorVars } from '../../../lib/projectColor.js';
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
import { sequenceRatio, makeSequence, posterStill } from '../../../lib/mediaSequence.js';
import HeroSet from './HeroSet.jsx';
import BannerViewer, { BANNER_VISIBLE } from './BannerViewer.jsx';
import LiveFootageGrid from './LiveFootageGrid.jsx';
import { liveFootagePlan, visualsWall, mockupsWall } from './liveFootageLayout.js';
import ServiceTag from '../ServiceTag.jsx';
import { buildContentFlow, splitHero, ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { computeFlushGrid, splitAtBreaks, classifyTile, TILE_RATIO, PORTRAIT_CROP, LANDSCAPE_CROP } from './flushGrid.js';
import { LOGO_DIALS, assetIdOfUrl, detailLogo } from '../directory/logoTile.js';
import { readLogoDials } from '../directory/directoryTune.js';
import logoManifest from '../../../data/directory-logos.json';
import {
  GRID_ROW_PX,
  GRID_COLS,
  NARROW_PLACE_COLS,
  SQ_ROWS_FALLBACK,
  SQ_ROWS_NARROW,
  readPortraitCrop,
  readLandscapeCrop,
  useTileShape,
  useGridMetrics,
  tileRowsFor,
  tileRowVars,
  placementStyle,
} from './tileGrid.js';
import { formatYearRange } from '../../../lib/formatYearRange.js';
import { signalRouteReady } from '../../../lib/overlayWipe.js';
import { renderKeywords, KW_HIGHLIGHT_DETAIL } from '../../../lib/keywords.jsx';
import useKeywordWipe from './useKeywordWipe.js';
import { holdWanted, attachBlurbHold, ARM_EVENT } from '../../../lib/blurbHold.js';
import { HOLD_MQ, readBlurbTune } from '../../../lib/blurbHoldMath.js';

/* ── Socket region geometry (rows are 10px grid units, masonry.css) ──
   Px-fixed height (~65vh on a laptop) so the reserved region stays rigid.
   Both ORBIT and DECK reserve the full-width band (FULL_BAND): the
   re-choreographed left-anchored conveyor (bandLayout.js) spans the row,
   so tiles flow above/below it — not beside — and no shadowed page
   overhangs a left-column tile (the old "floating above the grid" bug).
   Where a band sits is Studio order's call (the seats, below).
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
/* A full-width band: computeFlushGrid clamps a region's span to the grid's
   columns (5, or the large tier's 3-6, tileGrid.js). */
const FULL_BAND = Infinity;
/* 11-10, Nathan — "Big flyers that play": an admat set gets one wall in the
   album-art slot, at a FIXED column count (4 desktop, 2 phone ≤ 768) so the
   flyers read big, and a socket sized from one flyer's height at the set's
   ratio (the old 34-row orbit band is ~406px; a 4x5 page in 4 columns is
   ~447px, so it would crop every one). The playing flyers ride one
   playerGate for the wall (SQ-52: DeckScroller `play`), which caps the
   players at 8 desktop / 4 phone however many pages show. 11-11 (Nathan,
   US-4): the wall 1.5 flyers tall (ADMAT_PAGES_TALL), and the cover wall
   shares the same fixed columns. Rows come from the measured grid (admatRows
   below); this is only the width they assume before it is measured.
   11-14 (Nathan: "match the number of columns in the project directory…
   media is getting scaled up too much with the current 4 column count"):
   above 1024px the walls take the grid's own count (5, 6 at the large tier,
   tileGrid.js), so a wall flyer is one grid column wide. The fixed 4 stays
   for a tablet and the 2 for a phone. ?wallcols=<2-8> re-dials the count
   above 1024px (4 = the fixed walls as they were). */
const WALL_COLS = 4;
const WALL_COLS_PHONE = 2;
const readWallCols = () => {
  const raw = new URLSearchParams(window.location.search).get('wallcols');
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 2 && n <= 8 ? n : null;
};
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
   pieces of media". One every BLURB_ROWS squares of the grid (the desktop
   count: 5 columns since 11-14, 3 when the 2 was approved) from the
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

/* A set that leads the page (US-10, Nathan 11-16): the project's first piece belongs to a Set
   document whose "Can be the hero" is on, so the whole set leads in its own viewer at hero
   height (HeroSet.jsx, `.hero-set`), the blurb below it and the set nowhere else. Dev dials,
   read after mount: ?heroset=1 treats every project's first piece's set as if its toggle were
   on, legacy sets (no Set document yet) included, so a lead can be seen before the toggle or the
   migration; ?herosetvh=<dvh> is the box's height (default HERO_SET_VH, PROPOSED). */
const HERO_SET_VH = 70;
const HERO_SET_NONE = { preview: false, vh: HERO_SET_VH };
const readHeroSet = () => {
  const q = new URLSearchParams(window.location.search);
  const vh = parseFloat(q.get('herosetvh'));
  return { preview: q.get('heroset') === '1', vh: Number.isFinite(vh) && vh > 0 ? vh : HERO_SET_VH };
};

/* A logo on the detail grid is laid out as it is on the directory's logo tiles
   (SQ-81, Nathan 11-13: "there shouldnt be this kind of disconnect between the
   detail page and project directory media grids"): the same canvas choice, pad,
   balanced size and centring (directory/logoTile.js, steered by the same
   ?dirlogo* dials), but the asset's OWN artwork, its colours as uploaded,
   placed by its ink. A logo with no baked mark (held, or new) or an opaque
   file keeps its tile class's shape with a padded contain. The canvas is the
   tile's shape in the flush grid (`tileRatio`, ratioOf), as on the directory.
   A sequence or a video is left as it is. */
const LOGO_MARKS = logoManifest;
function withLogo(asset, dials) {
  if (asset.mediaType !== 'logo' || !asset.imageUrl || asset.playbackId || asset.frames?.length) return asset;
  const own = TILE_RATIO[classifyTile(ratioOf(asset))];
  const logo = detailLogo(LOGO_MARKS[assetIdOfUrl(asset.imageUrl)], { hasAlpha: !!asset.imageHasAlpha, own }, dials);
  return { ...asset, tileRatio: logo.ratio, logo };
}

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
   matches, detach when it stops (resize-aware), and the ?blurbair and
   ?blurbtext dials (?blurbpeek lives in the hold). The text size is one
   number on every page (SQ-99, project-detail.css --blurb-text) and the
   sections are as tall as their copy, so only the hold needs a script. It
   waits for `ready` (the grid measured): at or under 1024px the grid
   re-places once after the measure (tileGrid.js NARROW_PLACE_COLS), which
   re-cuts the sections, so it attaches to the settled page, once. */
function useBlurbHold(rootRef, ready) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !ready) return undefined;
    const { air, text } = readBlurbTune(window.location.search);
    if (air != null) root.style.setProperty('--blurb-air', `${air}rem`);
    if (text != null) root.style.setProperty('--blurb-text', String(text));
    const mq = window.matchMedia(HOLD_MQ);
    let detach = null;
    const sync = () => {
      if (holdWanted()) detach ??= attachBlurbHold(root);
      else if (detach) {
        detach();
        detach = null;
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
      detach?.();
      root.style.removeProperty('--blurb-air');
      root.style.removeProperty('--blurb-text');
    };
  }, [rootRef, ready]);
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
        spectrum: next.spectrum,
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
function goBackToWork(e, color, spectrum) {
  try {
    sessionStorage.setItem('swm:returnToWork', '1');
  } catch {
    /* storage unavailable */
  }
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab/window
  if (PREFERS_REDUCED_MOTION) {
    window.dispatchEvent(new CustomEvent('swm:envelop', { detail: { duration: 0, color, spectrum } }));
    return;
  }
  e.preventDefault();
  if (departing) return;
  departing = true;
  window.dispatchEvent(
    new CustomEvent('swm:envelop', { detail: { duration: NEXT_COVER_SECONDS, color, spectrum } })
  );
  setTimeout(() => {
    departing = false;
    navigate('/work');
  }, NEXT_COVER_SECONDS * 1000 + 60);
}

function DetailNextChip({ next, accentVars }) {
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
      // WCAG 2.5.3: the name must contain the visible "next_project: name" line.
      aria-label={label}
      data-marquee={marquee || undefined}
      style={
        marquee
          ? {
              ...accentVars,
              '--marquee-s': `${loopSeconds.toFixed(2)}s`,
              // 09-05: phase-locked to the wall clock (the pager-ticker
              // finding) — a re-arm (resize re-measure, a soft nav to the
              // next detail page) resumes the scroll where the clock says,
              // never from zero.
              '--marquee-phase': `${(-((performance.now() / 1000) % loopSeconds)).toFixed(3)}s`,
            }
          : accentVars
      }
    >
      <span className="detail-next__window" ref={windowRef} aria-hidden="true">
        <span className="detail-next__track">
          <span className="detail-next__copy" ref={copyRef}>{label}</span>
          {/* The loop's second copy is painted from data-copy (CSS ::before), so
              the DOM text — what a screen reader's name must contain, WCAG
              2.5.3 — holds the label once. */}
          {marquee && <span className="detail-next__copy" data-copy={label} />}
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
    signalRouteReady(); // the page is mounted: the nav menu's wipe may uncover (SQ-108)
  }, []);
  // The nav accent itself is applied by the persistent RouteFill route
  // controller (before paint, from the data-nav-accent-* attributes below) so
  // the shell nav is already this project's colour on the first frame — no
  // post-hydration broadcast, no brand-blue flash.

  const [chunkTune, setChunkTune] = useState(CHUNKS_NONE);
  useEffect(() => setChunkTune(readChunkTune()), []);
  const [heroSetTune, setHeroSetTune] = useState(HERO_SET_NONE);
  useEffect(() => setHeroSetTune(readHeroSet()), []);
  // `mockups` (US-5, SQ-58's lane) is absent until that lands: default it empty.
  const [logoDials, setLogoDials] = useState(LOGO_DIALS);
  useEffect(() => setLogoDials(readLogoDials(window.location.search)), []);
  const { showcase: flowShowcase, albumArt, albumArtSeat, brandDecks, carousels, banners, admats, visuals, liveFootage, mockups = [], heroSet } = buildContentFlow(assets, {
    surface: 'detail',
    chunks: chunkTune,
    heroSetPreview: heroSetTune.preview,
  });
  // The hero slot: a leading merch set is ONE cycling sequence (posters for any motion piece);
  // otherwise the first piece, a flagged video playing its first third here, the other two riding
  // the showcase (buildContentFlow). Any other leading set has its own viewer, below.
  const hero =
    heroSet?.type === 'merch'
      ? makeSequence(`sequence:${heroSet.group}`, heroSet.items.map(posterStill), heroSet.items.map(ratioOf))
      : (splitHero(assets[0], chunkTune).hero ?? null);
  const showcase = flowShowcase.map((a) => withLogo(a, logoDials));

  // Banner sockets want a height in BANNERS, not rows, and tiles a shape:
  // measure the flow width (the grid is full-bleed inside it) and convert.
  // Runs at every width — the ≤1024 in-flow bands read the same rows via
  // --socket-rows and --tile-*-rows.
  const flowRef = useRef(null);
  const pageRef = useRef(null);
  const tileShape = useTileShape();
  const gridMetrics = useGridMetrics(flowRef);
  useBlurbHold(pageRef, !!gridMetrics);
  const [blurbRows, setBlurbRows] = useState(BLURB_ROWS);
  useEffect(() => setBlurbRows(readBlurbRows()), []);
  const [portraitCrop, setPortraitCrop] = useState(PORTRAIT_CROP);
  useEffect(() => setPortraitCrop(readPortraitCrop()), []);
  const [landscapeCrop, setLandscapeCrop] = useState(LANDSCAPE_CROP);
  useEffect(() => setLandscapeCrop(readLandscapeCrop()), []);
  const [visualsRowsParam, setVisualsRowsParam] = useState(null);
  useEffect(() => setVisualsRowsParam(readVisualsRows()), []);
  const [wallColsParam, setWallColsParam] = useState(null);
  useEffect(() => setWallColsParam(readWallCols()), []);
  // Above 1024px (the desktop and large tiers) the grid places by its own
  // measured columns; before the measure it assumes the desktop count.
  const wide = !gridMetrics || gridMetrics.tier === 'desktop' || gridMetrics.tier === 'large';
  // A span of N rows is N tracks plus N-1 row gaps tall, so convert the
  // wanted pixel height through the row PITCH (track + gap), not the track.
  const bannerRows = (group) => {
    if (!gridMetrics?.width) return BANNER_REGION_ROWS_FALLBACK;
    const ratio = ratioOf(group.items[0]);
    const wantPx = (BANNER_VISIBLE * gridMetrics.width) / ratio;
    const pitch = GRID_ROW_PX + gridMetrics.rowGap;
    return Math.max(8, Math.ceil((wantPx + gridMetrics.rowGap) / pitch));
  };

  // The cover and flyer walls: the grid's columns above 1024px (?wallcols
  // re-dials them), a fixed 4 on a tablet and 2 on a phone. Before the
  // measure they assume the desktop count, like the tiles.
  const wallCols = !wide
    ? gridMetrics.cols === 1 ? WALL_COLS_PHONE : WALL_COLS
    : wallColsParam ?? gridMetrics?.cols ?? GRID_COLS.desktop;
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

  // ── A set as the hero (08-25 deck-as-featured, Nathan — bedouin/saga; US-10 any set) ──
  // When the collection's FIRST-RANKED asset belongs to a set that may lead
  // (src/lib/setHero.js: a deck, or a Set document with "Can be the hero" on),
  // the WHOLE set is the featured media: its own viewer leads the flow where the
  // hero slot would sit (the DeckScroller wall for a deck), and the set leaves
  // the grid (buildContentFlow's `heroSet` is in no bucket and has no seat).
  // A merch set leads as one sequence in the ordinary hero slot (`hero`, above).
  const heroWall = heroSet && heroSet.type !== 'merch' ? heroSet : null;
  // Carousels left the deck walls (11-11, Nathan — "carousels read like
  // socials"): each is a horizontal strip in a socket of its own (below), not
  // a tab or a poster column, so the decks lay out exactly as before.

  // ── Poster decks split out (08-25 (2), Nathan — bedouin SA tour) ──
  // Deck groups whose pages are PORTRAIT (flyers/posters compiled as a
  // deck) each get their OWN dedicated socket instead of riding the tabbed
  // guidelines viewer — a 4:5 wall wants its own frame, and the flyers
  // read as a separate body of work. Landscape decks share the tab socket.
  const tabbedDecks = brandDecks.filter(
    (d) => !(d.pages[0] && ratioOf(d.pages[0]) < PORTRAIT_THRESHOLD)
  );
  const posterDecks = brandDecks.filter(
    (d) => d.pages[0] && ratioOf(d.pages[0]) < PORTRAIT_THRESHOLD
  );

  // ── Socket regions from the content flow ──
  // Studio order seats every set (Nathan 11-14: "the order of the sets is
  // based on the position of the first media asset in the studio ranking.
  // Even if all of the set items were not together in order and one of them
  // was higher up, the whole set would get pushed up to that position").
  // Each band sits in the tile order where its first-ranked member would
  // (`at`, buildContentFlow), whatever its type: the cover wall, a flyer
  // wall, a visuals, mockups or live-footage set, a carousel strip, a deck
  // or a banner wall. Sets with no tile between their first members stack in
  // rank order. The tabbed decks share one socket, at the first of them
  // (deck groups come in rank order). Until 11-14 the TYPE chose the place:
  // covers and the first flyer wall on top, portrait carousels, poster decks
  // and banners at the end, the rest mid-grid.
  const seats = [];
  const seat = (id, rowSpan, { rank, at }) =>
    seats.push({ rank, region: { id, colStart: 0, colSpan: FULL_BAND, rowSpan, anchor: 'seat', at } });
  if (albumArt.length > 0) seat('orbit', ORBIT_REGION_ROWS, albumArtSeat);
  for (const set of admats) seat(`admat:${set.group}`, admatRows(set), set);
  for (const set of visualsWalls) seat(`visuals:${set.group}`, set.spanRows, set);
  for (const set of mockupsWalls) seat(`mockups:${set.group}`, set.spanRows, set);
  for (const set of footageGrids) seat(`footage:${set.group}`, set.plan.spanRows, set);
  if (tabbedDecks.length > 0) seat('deck', DECK_REGION_ROWS, tabbedDecks[0]);
  for (const set of carousels) seat(`carousel:${set.group}`, carouselRegionRows(set), set);
  for (const d of posterDecks) seat(`deck-solo:${d.group}`, DECK_REGION_ROWS, d);
  for (const b of banners) seat(`banner:${b.group}`, bannerRows(b), b);
  const regions = seats.sort((x, y) => x.rank - y.rank).map((x) => x.region);

  const isPortraitHero = hero && !heroWall && ratioOf(hero) < PORTRAIT_THRESHOLD;

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
  // (Above 1024 it places in the measured tier's columns: the desktop count,
  // or the large tier's, which ?detaillargecols can dial below it; before the
  // measure, and on the server, in the desktop count. ≤ 1024 the CSS spans
  // govern the shapes and the placement gives the sockets' and tiles' DOM
  // order, which pieces resize and where the bands cut: those pages keep the
  // 3-column placement they were dialed against, tileGrid.js
  // NARROW_PLACE_COLS, so they re-place once after the measure, as the large
  // tier does.) Each later paragraph cuts a break row.
  const placeCols = !wide ? NARROW_PLACE_COLS : tileRows ? tileRows.cols : GRID_COLS.desktop;
  const flush = computeFlushGrid(showcase, {
    regions,
    cols: placeCols,
    sqRows: !wide ? SQ_ROWS_NARROW : tileRows?.cols === placeCols ? tileRows.sq : SQ_ROWS_FALLBACK,
    breaks: asides.length,
    breakEvery: blurbRows,
    // The caps hold a stretch the grid draws: above 1024px only (readPortraitCrop, readLandscapeCrop).
    portraitCrop: wide ? portraitCrop : 1,
    landscapeCrop: wide ? landscapeCrop : 1,
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

  // The two nav chips (breadcrumb, next_project) carry the accent INLINE, the
  // ClientPanel's way (Nathan 11-20): they used to inherit it from <html>,
  // which the route controller only writes once the page hydrates, so a hard
  // reload painted them brand blue first. Inline, the server-rendered HTML
  // already has the colour; the schemes re-point inline carriers
  // ([style*='--project-color'], scheme.css) the same as <html>.
  const accentVars = projectColorVars(project?.projectColor, project?.projectColorSecondary);

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
      data-nav-spectrum={project?.spectrum || undefined}
    >
      <ClientPanel
        client={client}
        displayTitle={displayTitle}
        year={yearDisplay}
        services={services}
        projectColor={project?.projectColor}
        projectColorSecondary={project?.projectColorSecondary}
        spectrum={project?.spectrum}
      />

      {/* Breadcrumb back to the Featured Projects experience. Sits under
          the client panel on the left, rides sticky under the nav once the
          panel scrolls away. Clicking arms the return-restore — /work
          reopens the World you entered from (nav link starts fresh), as a
          snap under the project-coloured cover (goBackToWork). */}
      <a
        href="/work"
        className="detail-breadcrumb"
        style={accentVars}
        onClick={(e) => goBackToWork(e, project?.projectColor || undefined, project?.spectrum || undefined)}
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
      {nextProject && <DetailNextChip next={nextProject} accentVars={accentVars} />}

      <main
        className="project-detail__flow"
        ref={flowRef}
        style={tileRowVars(tileRows)}
      >
        {/* A leading set (a deck, or any set with "Can be the hero" on) →
            its own viewer at hero height, the blurb below; portrait hero →
            side-by-side band; landscape → stacked full-bleed. The walls wait
            for the grid's measure (a phone never flashes the desktop column
            count); a deck's wall takes its columns from its own box. */}
        {heroWall ? (
          <>
            <div className="hero-deck" style={{ '--hero-set-vh': heroSetTune.vh }}>
              {(gridMetrics || heroWall.type === 'deck') && (
                <HeroSet set={heroWall} cols={wallCols} geo={setGeo} />
              )}
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
                    // it scales down to fit, on the slot's near-black, padded
                    // and balanced as on the directory (withLogo, SQ-81).
                    fit={showcase[p.index].mediaType === 'logo' ? 'contain' : undefined}
                    logo={showcase[p.index].logo}
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
