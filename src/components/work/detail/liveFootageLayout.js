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
