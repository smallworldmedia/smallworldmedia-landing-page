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

/* The live tile shape: TILE_SHAPE on the server render, ?tileshape after mount. */
export function useTileShape() {
  const [tileShape, setTileShape] = useState(TILE_SHAPE);
  useEffect(() => setTileShape(readTileShape()), []);
  return tileShape;
}

/* The flow's width (the grid is full-bleed inside it), the grid's row gap and
   its column count, re-measured whenever the flow resizes. null until mount. */
export function useGridMetrics(flowRef, gridSelector = '.masonry-grid--detail') {
  const [gridMetrics, setGridMetrics] = useState(null);
  useEffect(() => {
    const el = flowRef.current;
    if (!el) return undefined;
    const measure = () => {
      const grid = el.querySelector(gridSelector);
      const rowGap = grid ? parseFloat(getComputedStyle(grid).rowGap) || 0 : 0;
      // Column count by the masonry.css breakpoints (3 / 2 ≤ 1024 / 1 ≤ 768)
      const cols = window.matchMedia('(max-width: 768px)').matches
        ? 1
        : window.matchMedia('(max-width: 1024px)').matches ? 2 : 3;
      setGridMetrics({ width: el.clientWidth, rowGap, cols });
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

/* ≤ 1024 the spans reach CSS as custom properties (masonry.css). */
export const tileRowVars = (tileRows) =>
  tileRows
    ? {
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
