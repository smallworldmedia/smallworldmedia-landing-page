/**
 * liveFootageLayout — the geometry of the two US-4 detail sets (11-11, Nathan)
 * that FeaturedProjectDetail seats in grid sockets. Pure.
 *
 *   - live-footage: a grid of clips and photos (LiveFootageGrid).
 *       phone:   vertical media 2 across, horizontal media full width;
 *       desktop: vertical media 3 across, horizontal media 2 across.
 *     "Vertical" is a ratio under PORTRAIT_THRESHOLD (a square counts, as it
 *     does for a tile). Members keep their order: a row is a run of one
 *     orientation, filled to its column count, so a change of orientation (or
 *     the end of the set) leaves a partial row. A partial row of verticals is
 *     LEFT-ALIGNED at the full row's cell size; a LONE horizontal fills the
 *     container's full width at the horizontal shape (Nathan 11-11). Each
 *     orientation crops (cover) to ONE shape, "shortest asset wins": the
 *     WIDEST ratio among its members.
 *   - visuals: horizontal loops on the deck wall (AlbumArtViewer): 2 columns on
 *     a desktop, 1 (the container's full width) on a phone, at the set's
 *     sequenceRatio. The socket is as tall as the whole set (every loop once,
 *     so no loop repeats in view) up to `maxRows`, the deck wall's height by
 *     default (FeaturedProjectDetail, ?visualsrows); past it the wall drifts.
 *
 *   - mockups (US-5): the same deck-wall frame, but every piece at its OWN
 *     aspect, packed masonry-style (mockupsWall; DeckScroller `columns`).
 *
 * The socket height in grid rows comes from the measured grid (width + row
 * gap, useGridMetrics), through the row pitch like the banner and admat
 * walls; the fallbacks are the pre-measure server render.
 */
import { ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { sequenceRatio } from '../../../lib/mediaSequence.js';
import { GRID_ROW_PX } from './tileGrid.js';

/** Columns per orientation (v = vertical media, h = horizontal media). */
export const FOOTAGE_COLS = { desktop: { v: 3, h: 2 }, phone: { v: 2, h: 1 } };
/** Visuals wall columns. */
export const VISUALS_COLS = { desktop: 2, phone: 1 };
/** The grid width and gap assumed before the grid is measured. */
export const FOOTAGE_WIDTH_FALLBACK = 1440;
export const FOOTAGE_GAP_FALLBACK = 2;

const isVertical = (ratio) => ratio < PORTRAIT_THRESHOLD;

/** Grid rows (10px tracks + gap) tall enough for `px`. */
const rowsForPx = (px, gap) => Math.max(8, Math.ceil((px + gap) / (GRID_ROW_PX + gap)));

/**
 * The rows of a live-footage set: [{kind: 'v'|'h', cols, ratio, items}], in
 * member order. `cols` = {v, h} columns across.
 */
export function liveFootageLayout(items, { cols }) {
  const ratios = items.map((a) => ratioOf(a));
  const widest = { v: 0, h: 0 };
  ratios.forEach((r) => {
    const kind = isVertical(r) ? 'v' : 'h';
    widest[kind] = Math.max(widest[kind], r);
  });
  const rows = [];
  items.forEach((asset, i) => {
    const kind = isVertical(ratios[i]) ? 'v' : 'h';
    const last = rows[rows.length - 1];
    if (last && last.kind === kind && last.items.length < cols[kind]) last.items.push(asset);
    else rows.push({ kind, cols: cols[kind], ratio: widest[kind], items: [asset] });
  });
  // A lone horizontal fills the full width (Nathan 11-11), not half a row.
  for (const row of rows) if (row.kind === 'h' && row.items.length === 1) row.cols = 1;
  return rows;
}

/**
 * A live-footage set's plan at a grid width: its rows, each row's height in px
 * (a cell's width ÷ the row's shape) and the socket's height in grid rows.
 * `width` / `gap` are the measured flow width and row gap (null = fallback).
 */
export function liveFootagePlan(items, { phone = false, width, gap } = {}) {
  const w = width || FOOTAGE_WIDTH_FALLBACK;
  const g = width ? (gap ?? 0) : FOOTAGE_GAP_FALLBACK;
  const rows = liveFootageLayout(items, { cols: phone ? FOOTAGE_COLS.phone : FOOTAGE_COLS.desktop });
  const heights = rows.map((row) => (w - (row.cols - 1) * g) / row.cols / row.ratio);
  const px = heights.reduce((sum, h) => sum + h, 0) + (rows.length - 1) * g;
  return { rows, heights, gap: g, spanRows: rowsForPx(px, g) };
}

/**
 * A visuals set's wall: the page shape (sequenceRatio over the members), the
 * column count and the socket's height in grid rows: the whole set (its loops
 * stacked in `cols` columns) capped at `maxRows`, never under one loop.
 */
export function visualsWall(items, { phone = false, width, gap, maxRows = Infinity } = {}) {
  const w = width || FOOTAGE_WIDTH_FALLBACK;
  const g = width ? (gap ?? 0) : FOOTAGE_GAP_FALLBACK;
  const cols = phone ? VISUALS_COLS.phone : VISUALS_COLS.desktop;
  const ratio = sequenceRatio(items.map((a) => ratioOf(a)));
  const pageH = (w - (cols - 1) * g) / cols / ratio;
  const perCol = Math.max(1, Math.ceil(items.length / cols));
  const setRows = rowsForPx(perCol * pageH + (perCol - 1) * g, g);
  return { ratio, cols, spanRows: Math.max(rowsForPx(pageH, g), Math.min(setRows, maxRows)) };
}

/** Mockups wall columns (US-5): masonry, 2 across on a desktop, 1 on a phone. */
export const MOCKUPS_COLS = { desktop: 2, phone: 1 };

/**
 * A mockups set's wall (US-5): each piece at its OWN aspect (no crop, no shared
 * ratio), packed like masonry. Members go in set order, each into the SHORTEST
 * column so far (a tie takes the leftmost), so the columns end up within one
 * piece of each other. Returns `columns` (the assets per column, top to
 * bottom), `heights` (each column's px, gaps included), the fallback page
 * `ratio` and the socket's height in grid rows: the tallest column (the whole
 * set once, so no piece repeats in view) capped at `maxRows`, never under the
 * shortest piece. A 9x16 on a desktop is 1.8 times as tall as it is wide, so
 * the cap is what keeps a long set drifting.
 */
export function mockupsWall(items, { phone = false, width, gap, maxRows = Infinity } = {}) {
  const w = width || FOOTAGE_WIDTH_FALLBACK;
  const g = width ? (gap ?? 0) : FOOTAGE_GAP_FALLBACK;
  const cols = phone ? MOCKUPS_COLS.phone : MOCKUPS_COLS.desktop;
  const colW = (w - (cols - 1) * g) / cols;
  const columns = Array.from({ length: cols }, () => []);
  const heights = new Array(cols).fill(0);
  let shortest = Infinity;
  for (const asset of items) {
    const h = colW / ratioOf(asset);
    shortest = Math.min(shortest, h);
    const at = heights.indexOf(Math.min(...heights));
    columns[at].push(asset);
    heights[at] += h + g;
  }
  const tallest = Math.max(0, ...heights) - g;
  const floorRows = Number.isFinite(shortest) ? rowsForPx(shortest, g) : 8;
  return {
    ratio: sequenceRatio(items.map((a) => ratioOf(a))),
    cols,
    columns,
    heights,
    spanRows: Math.max(floorRows, Math.min(rowsForPx(tallest, g), maxRows)),
  };
}

/**
 * One mockups column's wrap cycle in a frame `h` tall (DeckScroller `columns`):
 * the column's pieces (`ratios`, each `colW` wide, `gap` between) repeat whole
 * until the cycle is at least the frame tall, so two rendered copies cover the
 * frame at any wrap offset and the seam reads last piece → first. `reps` = how
 * many times the column's list runs per copy, `cycle` = its px length.
 */
export function mixedCycle(ratios, { colW, h, gap }) {
  if (!ratios.length) return { reps: 0, cycle: 0 };
  const one = ratios.reduce((sum, r) => sum + colW / r + gap, 0);
  const reps = Math.max(1, Math.ceil(h / one));
  return { reps, cycle: reps * one };
}
