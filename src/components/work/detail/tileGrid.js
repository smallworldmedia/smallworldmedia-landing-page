/**
 * tileGrid — the flush grid's tile units: the 10px row pitch, the tile shape,
 * the measured grid metrics and the spans they give. The detail page's grid
 * (FeaturedProjectDetail) reads them; computeFlushGrid (flushGrid.js) places
 * the tiles in the rows they produce.
 */
import { useEffect, useState } from 'react';

export const GRID_ROW_PX = 10;
/* Tile shape (10-27, the square-tiles round): a square tile's cell width ÷
   height, held at every window width. Nathan's bake = 1 — squares stay
   1:1 because most square media is album art, landscapes ≈ 2:1, portraits
   ≈ 1:2. Before it the cells were a fixed 24 rows, so every tile's shape
   followed the window (squares went wide as the window grew). Spans come
   from the measured column width through the row pitch, so the 10px rows
   — and every socket band sized in them — stay as they are.
   ?tileshape=<n> re-dials it live. */
export const TILE_SHAPE = 1;
export const readTileShape = () => {
  const v = parseFloat(new URLSearchParams(window.location.search).get('tileshape'));
  return Number.isFinite(v) && v > 0 ? v : TILE_SHAPE;
};
/* Rows whose span (N tracks + N-1 gaps) is closest to px. */
export const rowsFor = (px, gap) => Math.max(8, Math.round((px + gap) / (GRID_ROW_PX + gap)));
/* Square span before the grid is measured (server render, first client
   frame): TILE_SHAPE on a 1440px grid with the 2px --space-1 gap, so a
   laptop's first paint is already final. */
export const SQ_ROWS_FALLBACK = rowsFor((1440 - 2 * 2) / 3 / TILE_SHAPE, 2);

/* The large-screen tier (SQ-74): from this viewport width up (CSS px) the
   detail grid gains columns (3 → DETAIL_LARGE_COLS, 4) and the directory gets
   its large count (?dirlargecols, 6). ONE value shared by the grid's JS
   (gridTierFor, here), the directory's <img sizes> (buildDirectoryTiles.js
   sizesFor) and the CSS column count, which is NOT a media query: masonry.css
   reads --grid-cols, which FeaturedProjectDetail writes from the measured
   tier, so the server render keeps today's 3 columns and the tier lands after
   mount, and both dials (?gridlarge=<px>, ?detaillargecols=<n>) reach the CSS.
   Both are read after mount, like ?tileshape. */
export const GRID_LARGE_PX = 1920;
export const readGridLargePx = (search = window.location.search) => {
  const v = parseFloat(new URLSearchParams(search).get('gridlarge'));
  return Number.isFinite(v) && v > 1024 ? v : GRID_LARGE_PX;
};

/* The detail grid's columns at the large tier (Nathan 11-13: compare 4 and 5);
   ?detaillargecols=<3-6> re-dials it. */
export const DETAIL_LARGE_COLS = 4;
export const readDetailLargeCols = (search = window.location.search) => {
  const raw = new URLSearchParams(search).get('detaillargecols');
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 3 && n <= 6 ? n : DETAIL_LARGE_COLS;
};

/* The grid's tier at a viewport width, by the masonry.css breakpoints
   (phone ≤ 768 · tablet ≤ 1024 · desktop · large from `largePx` up), and the
   detail grid's columns in each (3 / 2 / 1 below the tier, `largeCols` at it). */
export const GRID_COLS = { phone: 1, tablet: 2, desktop: 3 };
export const gridTierFor = (vw, largePx = GRID_LARGE_PX) =>
  vw <= 768 ? 'phone' : vw <= 1024 ? 'tablet' : vw >= largePx ? 'large' : 'desktop';
export const gridColsFor = (vw, largePx = GRID_LARGE_PX, largeCols = DETAIL_LARGE_COLS) => {
  const tier = gridTierFor(vw, largePx);
  return tier === 'large' ? largeCols : GRID_COLS[tier];
};

/* The live tile shape: TILE_SHAPE on the server render, ?tileshape after mount. */
export function useTileShape() {
  const [tileShape, setTileShape] = useState(TILE_SHAPE);
  useEffect(() => setTileShape(readTileShape()), []);
  return tileShape;
}

/* The flow's width (the grid is full-bleed inside it), the grid's row gap, its
   tier and the detail grid's column count in it, and the large tier's width
   (the dial), re-measured whenever the flow resizes. null until mount. */
export function useGridMetrics(flowRef, gridSelector = '.masonry-grid--detail') {
  const [gridMetrics, setGridMetrics] = useState(null);
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return undefined;
    const measure = () => {
      const grid = el.querySelector(gridSelector);
      const rowGap = grid ? parseFloat(getComputedStyle(grid).rowGap) || 0 : 0;
      // Column count by the masonry.css breakpoints (3 / 2 ≤ 1024 / 1 ≤ 768)
      // and the large tier (4 from GRID_LARGE_PX)
      const largePx = readGridLargePx();
      const tier = gridTierFor(window.innerWidth, largePx);
      const cols = tier === 'large' ? readDetailLargeCols() : GRID_COLS[tier];
      setGridMetrics({ width: el.clientWidth, rowGap, cols, tier, largePx });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [flowRef, gridSelector]);
  return gridMetrics;
}

/* Tile spans, through the row PITCH (track + gap): square = one column at the
   tile shape, portrait = two squares (the tessellation), landscape = two
   columns × one square — so in a single column it keeps that shape at its
   own row count. null until the grid is measured. */
export function tileRowsFor(metrics, shape) {
  if (!metrics?.width) return null;
  const { width, rowGap: g, cols } = metrics;
  const colW = (width - (cols - 1) * g) / cols;
  const sq = rowsFor(colW / shape, g);
  return { sq, pt: 2 * sq, ls: cols === 1 ? rowsFor(colW / (2 * shape), g) : sq, cols };
}

/* The column count (--grid-cols) and, ≤ 1024, the spans reach CSS as custom
   properties (masonry.css). */
export const tileRowVars = (tileRows) =>
  tileRows
    ? {
        '--grid-cols': tileRows.cols,
        '--tile-sq-rows': tileRows.sq,
        '--tile-pt-rows': tileRows.pt,
        '--tile-ls-rows': tileRows.ls,
      }
    : undefined;

/* A placement's cell (computeFlushGrid's 0-based col / rows → CSS lines). */
export const placementStyle = (p) => ({
  gridColumn: `${p.col + 1} / span ${p.colSpan}`,
  gridRow: `${p.rowStart + 1} / ${p.rowEnd + 1}`,
  // Forced-fill tiles paint beneath intact neighbors
  zIndex: p.underlay ? 0 : 1,
});
