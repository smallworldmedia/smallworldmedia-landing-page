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
 * @param {string} [props.ariaLabel]
 */
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { getLenis } from '../../../lib/smoothScroll.js';
import { IMG_FORMAT } from '../imageConfig.js';

const PARAMS =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const num = (key, fallback) => {
  const n = PARAMS ? parseFloat(PARAMS.get(key)) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

const VISIBLE_ROWS = num('deckvrows', 2); // Nathan's 08-25 bake (was 2.5)
const GAP_PX = num('deckwgap', 2); // 1–2px black between pages
const DRIFT_PX_S = num('deckdrift', 8); // idle rate — Nathan's 08-25 bake (was 12)
const SCROLL_GEAR = num('deckgear', 0.08); // column px per scrolled px — Nathan's 08-25 bake (was 0.5 → 0.3 → 0.08)

// Two visible rows render pages ~half the frame tall (retina columns can
// exceed 700px) — the detail-slot width budget, not the grid-tile one.
const IMG_WIDTH = 1400;
const pageSrc = (p) =>
  p.imageUrl
    ? `${p.imageUrl}?w=${IMG_WIDTH}&${IMG_FORMAT}`
    : `https://image.mux.com/${p.playbackId}/thumbnail.webp?width=${IMG_WIDTH}&fit_mode=preserve`;

export default function DeckScroller({ pages, ratio, cols: fixedCols, ariaLabel }) {
  const frameRef = useRef(null);
  const stripRefs = useRef([]);
  // Per-column scroll offsets + cycle heights, owned by the ticker (never state).
  const motionRef = useRef({ offsets: [], cycleH: 0, dirs: [] });
  const [layout, setLayout] = useState(null); // { cols, perCol }

  // ── Layout: columns sized so ~VISIBLE_ROWS page-rows fill the frame ──
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;
    const measure = () => {
      const w = frame.clientWidth;
      const h = frame.clientHeight;
      if (!w || !h) return;
      const idealPageH = h / VISIBLE_ROWS;
      const cols = fixedCols ?? Math.max(2, Math.round(w / (idealPageH * ratio)));
      const colW = (w - (cols - 1) * GAP_PX) / cols;
      const pageH = colW / ratio;
      // Enough pages per strip cycle that TWO rendered copies cover the
      // frame at any wrap offset.
      const perCol = Math.max(2, Math.ceil((h + pageH) / (pageH + GAP_PX)));
      motionRef.current.cycleH = perCol * (pageH + GAP_PX);
      setLayout((cur) =>
        cur && cur.cols === cols && cur.perCol === perCol ? cur : { cols, perCol }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    return () => ro.disconnect();
  }, [ratio, pages.length, fixedCols]);

  // ── Drive: idle drift + Lenis scroll coupling, alternating per column ──
  useEffect(() => {
    if (!layout) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const m = motionRef.current;
    m.offsets = new Array(layout.cols).fill(0);
    m.dirs = Array.from({ length: layout.cols }, (_, i) => (i % 2 === 0 ? 1 : -1));

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
        if (strip && m.cycleH > 0) {
          strip.style.transform = `translate3d(0, ${(-mod(m.offsets[i], m.cycleH)).toFixed(2)}px, 0)`;
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
  }, [layout]);

  if (!pages.length) return null;

  // Column i cycles pages (i + n·cols) mod N — reading order runs across
  // the wall then wraps, and every column stays populated on short decks.
  const columnPages = (col, perCol) =>
    Array.from({ length: perCol }, (_, n) => pages[(col + n * layout.cols) % pages.length]);

  return (
    <div
      className="deck-scroller"
      ref={frameRef}
      role="img"
      aria-label={ariaLabel}
      style={{ '--deck-wgap': `${GAP_PX}px`, '--deck-ratio': ratio }}
    >
      {layout &&
        Array.from({ length: layout.cols }, (_, col) => {
          const cycle = columnPages(col, layout.perCol);
          return (
            <div className="deck-scroller__col" key={col}>
              <div
                className="deck-scroller__strip"
                ref={(el) => {
                  stripRefs.current[col] = el;
                }}
              >
                {/* the cycle twice — the wrap shows copy 2 while copy 1 rewinds */}
                {[0, 1].map((copy) =>
                  cycle.map((p, n) => (
                    <img
                      key={`${copy}-${n}`}
                      className="deck-scroller__page"
                      src={pageSrc(p)}
                      alt=""
                      loading="lazy"
                      draggable={false}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
