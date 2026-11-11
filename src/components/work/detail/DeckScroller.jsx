/**
 * DeckScroller — the orthographic deck-page wall (08-25, Nathan).
 *
 * Replaces the BandPager PRESENTATION for brand decks (the pager itself is
 * TABLED, not deleted — AlbumArtViewer still owns it): a full-width black
 * frame in the masonry grid's deck socket, filled edge-to-edge with columns
 * of deck pages under hairline black gutters (the playing-card reference —
 * pages read as one lattice with 2px of black between them). Columns drift
 * vertically at a very slow idle rate in ALTERNATING directions; document
 * scroll adds |Lenis-smoothed scroll delta| × gear to every column's rate
 * in its own direction — scrolling the page accelerates the wall, riding
 * the same scroll weight as everything else on the route. Each column's
 * strip wraps seamlessly (its page cycle repeats) and the frame CROPS:
 * deliberately a peek inside the deck as you pass, never the whole
 * contents, and no per-page interaction needed.
 *
 * Orthographic by construction — flat DOM planes, no perspective, inert to
 * the pointer (the page scroll IS the control).
 *
 * Reduced motion: a static wall (no drift, no scroll coupling).
 *
 * Knobs (?param, worldConfig convention — reload to apply). Defaults =
 * Nathan's 08-25 bake (was vrows 2.5 / drift 12 / gear 0.5):
 *   ?deckvrows=2     page rows visible in the frame (sizes the columns)
 *   ?deckwgap=2      gutter px between pages (black shows through)
 *   ?deckdrift=8     idle drift, px/s
 *   ?deckgear=0.08   scroll coupling — px of column travel per px of
 *                    (Lenis-smoothed) page scroll
 *
 * @param {Object} props
 * @param {Array<Object>} props.pages - deck pages (brandDeckOrder-sorted)
 * @param {number} props.ratio - page aspect (w/h)
 * @param {number} [props.cols] - FIXED column count (08-25 (2): the tabbed
 *        grid viewer forces 2 big spreads). Omitted = derived from
 *        ?deckvrows against the frame height, as before.
 * @param {boolean} [props.showAll] - opt-in (11-10, the admat wall): every
 *        page reaches the wall. Each strip cycle is raised to at least
 *        ceil(pages ÷ cols) pages, so cols × perCol ≥ N — a frame about one
 *        page tall would otherwise cycle only cols × 2 of them. Off = the
 *        frame-derived cycle, unchanged.
 * @param {boolean} [props.play] - opt-in (11-10, the admat wall): a page with
 *        a playbackId plays while ONE playerGate for the wall grants it (the
 *        directory's cap and dwell; the detail clip, DETAIL_MAX_SECONDS). Its
 *        frame-0 poster is the loading and ungranted state. Off = every page
 *        a still, unchanged.
 * @param {'y'|'x'} [props.axis='y'] - 'x' (US-4, 11-11, the carousel): `rows`
 *        horizontal strips instead of columns. Row 0 reads forward (page 1 → N,
 *        left to right) and travels LEFTWARD, odd rows the other way; the same
 *        idle drift, Lenis kick, viewport gate and reduced-motion hold as the
 *        columns. Each page is as wide as its row is tall × ratio, so the
 *        frame's height sets how many slides show (horizontalStrip.js).
 * @param {number} [props.rows=1] - horizontal strips (axis 'x' only)
 * @param {Array<Array<Object>>} [props.columns] - US-5, the mockups wall: the
 *        pieces already packed into columns (liveFootageLayout mockupsWall,
 *        shortest column next). Each piece keeps its OWN aspect (no crop, no
 *        shared `ratio`), and each column wraps on its own cycle (mixedCycle).
 *        Omitted = the one-ratio wall, unchanged.
 * @param {string} [props.ariaLabel]
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { getLenis } from '../../../lib/smoothScroll.js';
import {
  IMG_FORMAT,
  DETAIL_MAX_SECONDS,
  DIRECTORY_PLAYERS,
  DIRECTORY_DWELL_MS,
  muxPoster,
} from '../imageConfig.js';
import { createPlayerGate } from '../directory/playerGate.js';
import GatedVideo from './GatedVideo.jsx';
import { horizontalLayout } from './horizontalStrip.js';
import { mixedCycle } from './liveFootageLayout.js';
import { ratioOf } from './buildContentFlow.js';

const PARAMS =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const num = (key, fallback) => {
  const n = PARAMS ? parseFloat(PARAMS.get(key)) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const VISIBLE_ROWS = num('deckvrows', 2); // Nathan's 08-25 bake (was 2.5)
const GAP_PX = num('deckwgap', 2); // 1–2px black between pages
export const DECK_GAP_PX = GAP_PX; // the carousel socket sizes its slides through the same gutter
const DRIFT_PX_S = num('deckdrift', 8); // idle rate — Nathan's 08-25 bake (was 12)
const SCROLL_GEAR = num('deckgear', 0.08); // column px per scrolled px — Nathan's 08-25 bake (was 0.5 → 0.3 → 0.08)

// Two visible rows render pages ~half the frame tall (retina columns can
// exceed 700px) — the detail-slot width budget, not the grid-tile one.
const IMG_WIDTH = 1400;
const pageSrc = (p) =>
  p.imageUrl
    ? `${p.imageUrl}?w=${IMG_WIDTH}&${IMG_FORMAT}`
    : `https://image.mux.com/${p.playbackId}/thumbnail.webp?width=${IMG_WIDTH}&fit_mode=preserve`;

/* One page of the wall. Its own component so a page can grow more than a
   still: in play mode, a page with a playbackId is the media-slot
   directory face — its frame-0 poster, and a fresh keyed GatedVideo over it
   while the gate grants it play. The wrapper takes the wall's ratio, so the
   strip's cycle height holds whatever the page is. */
function DeckPage({ page, play, gate, own }) {
  const ref = useRef(null);
  const [canPlay, setCanPlay] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const live = !!play && !!page.playbackId; // the poster face from the first paint; the gate arrives after

  useEffect(() => {
    if (!live || !gate) return undefined;
    return gate.watch(ref.current, { video: true }, (state) => setCanPlay(state.play));
  }, [gate, live]);

  if (!live) {
    return (
      <img
        className="deck-scroller__page"
        src={pageSrc(page)}
        alt=""
        loading="lazy"
        draggable={false}
        style={own ? { aspectRatio: own } : undefined}
      />
    );
  }
  return (
    <div ref={ref} className="media-slot" style={{ '--slot-ratio': own ?? 'var(--deck-ratio)' }}>
      <img
        className={`media-slot__media${loaded ? ' media-slot__media--loaded' : ''}`}
        src={muxPoster(page.playbackId, IMG_WIDTH)}
        alt=""
        loading="lazy"
        draggable={false}
        onLoad={() => setLoaded(true)}
      />
      {canPlay && <GatedVideo key={page.playbackId} playbackId={page.playbackId} clip={DETAIL_MAX_SECONDS} />}
    </div>
  );
}

/* The wall's one playerGate (play mode): ONE observer over every playing
   page, DIRECTORY_PLAYERS grants at once (8 desktop, 4 phone, the directory's
   split), none under reduced motion. null until the effect has built it. */
function useWallGate(play) {
  const [gate, setGate] = useState(null);
  useEffect(() => {
    if (!play) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const phone = window.matchMedia('(max-width: 768px)').matches;
    const g = createPlayerGate({
      cap: reduced ? 0 : phone ? DIRECTORY_PLAYERS.phone : DIRECTORY_PLAYERS.desktop,
      dwellMs: DIRECTORY_DWELL_MS,
    });
    setGate(g);
    return () => {
      g.destroy();
      setGate(null);
    };
  }, [play]);
  return gate;
}

export default function DeckScroller({
  pages,
  ratio,
  cols: fixedCols,
  showAll,
  play,
  axis = 'y',
  rows = 1,
  columns,
  ariaLabel,
}) {
  const horizontal = axis === 'x';
  const frameRef = useRef(null);
  const stripRefs = useRef([]);
  // Per-line (column on y, row on x) scroll offsets + cycle lengths, owned by
  // the ticker (never state).
  const motionRef = useRef({ offsets: [], cycle: 0, cycles: null, dirs: [] });
  // A mixed wall (columns): which pieces, so the layout re-measures only on a new set.
  const mixKey = columns ? columns.map((c) => c.map((p) => p._id).join('.')).join('|') : '';
  const [layout, setLayout] = useState(null); // { lines, perLine }
  const gate = useWallGate(play);

  // ── Layout: columns sized so ~VISIBLE_ROWS page-rows fill the frame
  //    (x: `rows` strips, page width from the row height × ratio) ──
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => {
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      if (!w || !h) return;
      let lines;
      let perLine;
      let reps = null;
      motionRef.current.cycles = null;
      if (columns) {
        lines = columns.length;
        const colW = (w - (lines - 1) * GAP_PX) / lines;
        const cyc = columns.map((col) => mixedCycle(col.map(ratioOf), { colW, h, gap: GAP_PX }));
        reps = cyc.map((c) => c.reps);
        perLine = 0;
        motionRef.current.cycles = cyc.map((c) => c.cycle);
      } else if (horizontal) {
        lines = rows;
        const x = horizontalLayout({ w, h, lines, ratio, gap: GAP_PX, n: pages.length });
        perLine = x.perLine;
        motionRef.current.cycle = x.cycle;
      } else {
        const idealPageH = h / VISIBLE_ROWS;
        lines = fixedCols ?? Math.max(2, Math.round(w / (idealPageH * ratio)));
        const colW = (w - (lines - 1) * GAP_PX) / lines;
        const pageH = colW / ratio;
        // Enough pages per strip cycle that TWO rendered copies cover the
        // frame at any wrap offset.
        const framePerCol = Math.max(2, Math.ceil((h + pageH) / (pageH + GAP_PX)));
        perLine = showAll
          ? Math.max(framePerCol, Math.ceil(pages.length / lines))
          : framePerCol;
        motionRef.current.cycle = perLine * (pageH + GAP_PX);
      }
      setLayout((cur) =>
        cur && cur.lines === lines && cur.perLine === perLine && String(cur.reps) === String(reps)
          ? cur
          : { lines, perLine, reps }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [ratio, pages.length, fixedCols, showAll, horizontal, rows, mixKey]);

  // ── Drive: idle drift + Lenis scroll coupling, alternating per line ──
  useEffect(() => {
    if (!layout) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const m = motionRef.current;
    m.offsets = new Array(layout.lines).fill(0);
    m.dirs = Array.from({ length: layout.lines }, (_, i) => (i % 2 === 0 ? 1 : -1));

    const mod = (x, n) => ((x % n) + n) % n;
    const tick = (_t, deltaMs) => {
      const dt = Math.min(deltaMs, 100) / 1000; // clamp tab-return spikes
      // Lenis velocity ≈ px advanced this frame (already smoothed) — the
      // wall follows the same scroll weight as the page.
      const kick = Math.abs(getLenis()?.velocity ?? 0) * SCROLL_GEAR;
      const step = DRIFT_PX_S * dt + kick;
      for (let i = 0; i < m.offsets.length; i++) {
        m.offsets[i] += m.dirs[i] * step;
        const strip = stripRefs.current[i];
        const cycle = m.cycles ? m.cycles[i] : m.cycle;
        if (strip && cycle > 0) {
          const at = (-mod(m.offsets[i], cycle)).toFixed(2);
          strip.style.transform = horizontal
            ? `translate3d(${at}px, 0, 0)`
            : `translate3d(0, ${at}px, 0)`;
        }
      }
    };

    // Tick only near the viewport (GridSocket convention).
    let ticking = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !ticking) {
          gsap.ticker.add(tick);
          ticking = true;
        } else if (!entry.isIntersecting && ticking) {
          gsap.ticker.remove(tick);
          ticking = false;
        }
      },
      { rootMargin: '120px' }
    );
    io.observe(frameRef.current);
    return () => {
      io.disconnect();
      if (ticking) gsap.ticker.remove(tick);
    };
  }, [layout, horizontal]);

  if (!pages.length) return null;

  // Line i cycles pages (i + n·lines) mod N — reading order runs across the
  // wall then wraps, and every line stays populated on short sets.
  // A mixed wall (columns): the column's own pieces, repeated whole to its cycle.
  const linePages = (line, perLine) =>
    columns
      ? Array.from({ length: layout.reps[line] }, () => columns[line]).flat()
      : Array.from({ length: perLine }, (_, n) => pages[(line + n * layout.lines) % pages.length]);

  return (
    <div
      className={`deck-scroller${horizontal ? ' deck-scroller--x' : ''}`}
      ref={frameRef}
      role="img"
      aria-label={ariaLabel}
      style={{ '--deck-wgap': `${GAP_PX}px`, '--deck-ratio': ratio }}
    >
      {layout &&
        Array.from({ length: layout.lines }, (_, line) => {
          const cycle = linePages(line, layout.perLine);
          return (
            <div className="deck-scroller__col" key={line}>
              <div
                className="deck-scroller__strip"
                ref={(el) => {
                  stripRefs.current[line] = el;
                }}
              >
                {/* the cycle twice — the wrap shows copy 2 while copy 1 rewinds */}
                {[0, 1].map((copy) =>
                  cycle.map((p, n) => (
                    <DeckPage key={`${copy}-${n}`} page={p} play={play} gate={gate} own={columns ? ratioOf(p) : undefined} />
                  ))
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
