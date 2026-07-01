/**
 * flushGrid — dense tessellating grid placement with reserved regions.
 *
 * Pure math module (ADR-0003): simulates CSS Grid dense placement for the
 * detail-page showcase grid, extended with **Grid Socket reserved regions** —
 * rectangular blocks that tile placement flows around and that participate
 * in the flush-bottom pass (docs/orbit-deck-viewer-spec.md § Grid Socket).
 * The GridSocket layer positions composite components (AlbumArtOrbit,
 * BrandDeckViewer) over the resolved region rects.
 *
 * Model: each grid column holds a list of free row segments. A tile takes
 * the earliest row where `colSpan` adjacent columns are all free for
 * `rowSpan` rows — unlike the previous column-pointer sim this backfills
 * gaps, matching real `grid-auto-flow: dense`. Regions are pre-occupied
 * rects, so tiles fill above, beside, and below them.
 *
 * Anchors:
 *   `top` — region rows start at 0 (directly below the blurb).
 *   `mid` — two-pass: place tiles without the region, pick the tile row
 *           boundary nearest the natural midpoint, pin the region there,
 *           re-place everything around it. Deterministic.
 *
 * Flush pass, two stages:
 *   1. Guarded — every tile stretches down to the next occupied thing in
 *      every column it spans (closing interior gaps and flushing the bottom
 *      edge) without ever creating an overlap.
 *   2. Forced — a residual gap (a 2-col tile pinned by its deeper neighbor
 *      column) is filled by stretching the tile above it anyway; the tile is
 *      flagged `underlay: true` and the renderer paints it beneath intact
 *      tiles. This is what the old bottom-stretch did implicitly (and
 *      unguardedly); here it is explicit, bounded, and never crosses a
 *      region — regions are inviolable and never stretch (the socket band
 *      must stay rigid).
 *
 * Known ragged edge: a column whose final occupant is a region (no tile
 * below it while other columns run deeper) keeps a tail gap — nothing exists
 * to stretch. Curated content avoids this; the acceptance pass eyeballs it.
 */
import { ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';

/* ── Tessellating tile sizes ──
   Designed so 1 portrait = 2 squares = 2 landscapes (stacked),
   guaranteeing the grid can always back-fill with zero gaps. */
export const TILE_SIZES = {
  portrait:  { colSpan: 1, rowSpan: 48 },
  square:    { colSpan: 1, rowSpan: 24 },
  landscape: { colSpan: 2, rowSpan: 24 },
};

export function classifyTile(ratio) {
  if (ratio >= PORTRAIT_THRESHOLD) return 'landscape';
  if (ratio >= 0.9) return 'square';
  return 'portrait';
}

/** Free segments for each column, minus the given blocked rects. */
function freeSegments(cols, blocked) {
  return Array.from({ length: cols }, (_, c) => {
    const blocks = blocked
      .filter((r) => r.colStart <= c && c < r.colStart + r.colSpan)
      .map((r) => [r.rowStart, r.rowEnd])
      .sort((a, b) => a[0] - b[0]);

    const free = [];
    let cursor = 0;
    for (const [s, e] of blocks) {
      if (s > cursor) free.push({ start: cursor, end: s });
      cursor = Math.max(cursor, e);
    }
    free.push({ start: cursor, end: Infinity });
    return free;
  });
}

/**
 * Earliest row where columns c0..c0+colSpan-1 are all free for rowSpan rows.
 * The optimum is always some covered column's segment start (skyline
 * argument), so those are the only candidates checked.
 */
function earliestFit(segs, c0, colSpan, rowSpan) {
  const candidates = new Set();
  for (let j = 0; j < colSpan; j++) {
    for (const s of segs[c0 + j]) candidates.add(s.start);
  }

  for (const r of [...candidates].sort((a, b) => a - b)) {
    let ok = true;
    for (let j = 0; j < colSpan && ok; j++) {
      ok = segs[c0 + j].some((s) => s.start <= r && s.end >= r + rowSpan);
    }
    if (ok) return r;
  }
  return null; // unreachable — every column ends in an Infinity segment
}

/** Subtract [row, row+rowSpan) from each covered column's free segments. */
function occupy(segs, c0, colSpan, row, rowSpan) {
  const end = row + rowSpan;
  for (let j = 0; j < colSpan; j++) {
    const next = [];
    for (const s of segs[c0 + j]) {
      if (s.end <= row || s.start >= end) {
        next.push(s);
        continue;
      }
      if (s.start < row) next.push({ start: s.start, end: row });
      if (s.end > end) next.push({ start: end, end: s.end });
    }
    segs[c0 + j] = next;
  }
}

/** Dense-place every showcase asset around the blocked rects. */
function placeAll(showcase, cols, blocked) {
  const segs = freeSegments(cols, blocked);

  return showcase.map((asset) => {
    const type = classifyTile(ratioOf(asset));
    const { colSpan, rowSpan } = TILE_SIZES[type];

    let best = null;
    for (let c = 0; c <= cols - colSpan; c++) {
      const r = earliestFit(segs, c, colSpan, rowSpan);
      if (r != null && (best === null || r < best.row)) best = { row: r, col: c };
    }

    occupy(segs, best.col, colSpan, best.row, rowSpan);
    return {
      col: best.col,
      colSpan,
      rowStart: best.row,
      rowEnd: best.row + rowSpan,
      type,
    };
  });
}

/**
 * Stage 1 — guarded stretch: each tile extends down to the next occupied
 * thing in every column it spans (other tiles, regions, or the grid
 * bottom). Closes interior gaps and flushes the bottom edge without ever
 * creating an overlap. Targets derive from immutable rowStarts, so the
 * pass is order-independent.
 */
function guardedStretch(placements, regions, totalRows) {
  for (const p of placements) {
    let target = totalRows;

    for (const other of placements) {
      if (other === p || other.rowStart < p.rowEnd) continue;
      const sharesCol =
        other.col < p.col + p.colSpan && other.col + other.colSpan > p.col;
      if (sharesCol) target = Math.min(target, other.rowStart);
    }
    for (const r of regions) {
      if (r.rowStart < p.rowEnd) continue;
      const sharesCol =
        r.colStart < p.col + p.colSpan && r.colStart + r.colSpan > p.col;
      if (sharesCol) target = Math.min(target, r.rowStart);
    }

    if (target > p.rowEnd) p.rowEnd = target;
  }
}

/**
 * Stage 2 — forced fill: walk each column's residual gaps and stretch the
 * tile ending exactly at the gap's top across it, flagging it `underlay`
 * (painted beneath intact tiles). The stretch clamps at the first region
 * boundary in any spanned column; a gap with no tile above it (or capped
 * by a region) stays — the documented ragged edge.
 */
function forcedFill(placements, regions, cols, totalRows) {
  const covers = (x, xStart, xSpan, c) => xStart <= c && c < xStart + xSpan;

  for (let c = 0; c < cols; c++) {
    const intervals = [
      ...placements
        .filter((p) => covers(p, p.col, p.colSpan, c))
        .map((p) => ({ start: p.rowStart, end: p.rowEnd })),
      ...regions
        .filter((r) => covers(r, r.colStart, r.colSpan, c))
        .map((r) => ({ start: r.rowStart, end: r.rowEnd })),
    ].sort((a, b) => a.start - b.start);

    let cursor = 0;
    for (const iv of [...intervals, { start: totalRows, end: totalRows }]) {
      if (iv.start > cursor) {
        // Gap [cursor, iv.start) — the tile ending at its top is unique
        // (column intervals are disjoint).
        const above = placements.find(
          (p) => covers(p, p.col, p.colSpan, c) && p.rowEnd === cursor
        );
        if (above) {
          let target = iv.start;
          for (const r of regions) {
            const sharesCol =
              r.colStart < above.col + above.colSpan &&
              r.colStart + r.colSpan > above.col;
            if (sharesCol && r.rowStart >= above.rowEnd) {
              target = Math.min(target, r.rowStart);
            }
          }
          if (target > above.rowEnd) {
            above.rowEnd = target;
            above.underlay = true;
          }
        }
      }
      cursor = Math.max(cursor, iv.end);
    }
  }
}

/**
 * Compute flush-grid placements, flowing around reserved socket regions.
 *
 * @param {Array<Object>} showcase - showcase assets (orderRank order)
 * @param {Object} [opts]
 * @param {number} [opts.cols=3]
 * @param {Array<{id: string, colStart: number, colSpan: number, rowSpan: number, anchor: 'top'|'mid'}>} [opts.regions=[]]
 *        Caller guarantees same-anchor regions don't overlap.
 * @returns {{
 *   placements: Array<{col: number, colSpan: number, rowStart: number, rowEnd: number, type: string, underlay?: boolean}>,
 *   regions: Array<{id: string, colStart: number, colSpan: number, rowStart: number, rowEnd: number, anchor: string, domIndex: number}>,
 *   totalRows: number
 * }} `regions[].domIndex` = showcase index where the socket belongs in DOM
 *    order (single-column flow reads correctly); placements align 1:1 with
 *    the showcase array. `underlay` tiles must paint beneath intact tiles.
 */
export function computeFlushGrid(showcase, { cols = 3, regions = [] } = {}) {
  // Clamp horizontal extent defensively; row geometry is the caller's contract.
  const norm = regions.map((r) => {
    const colSpan = Math.min(r.colSpan, cols);
    return {
      ...r,
      colSpan,
      colStart: Math.max(0, Math.min(r.colStart, cols - colSpan)),
    };
  });

  const resolved = norm
    .filter((r) => r.anchor !== 'mid')
    .map((r) => ({ ...r, rowStart: 0, rowEnd: r.rowSpan }));
  const mids = norm.filter((r) => r.anchor === 'mid');

  let placements;
  if (mids.length === 0) {
    placements = placeAll(showcase, cols, resolved);
  } else {
    // Pass 1 — natural grid without the mid regions.
    const natural = placeAll(showcase, cols, resolved);
    const naturalEnd = Math.max(
      0,
      ...natural.map((p) => p.rowEnd),
      ...resolved.map((r) => r.rowEnd)
    );

    // Row boundaries where a tile ends; nearest one to the midpoint wins
    // (ties → higher). Multiple mids stack downward from there.
    const boundaries = [...new Set([0, ...natural.map((p) => p.rowEnd)])].sort(
      (a, b) => a - b
    );
    const midpoint = naturalEnd / 2;
    let boundary = boundaries.reduce((best, b) =>
      Math.abs(b - midpoint) < Math.abs(best - midpoint) ? b : best
    );

    for (const r of mids) {
      resolved.push({ ...r, rowStart: boundary, rowEnd: boundary + r.rowSpan });
      boundary += r.rowSpan;
    }

    // Pass 2 — re-place everything around the pinned regions.
    placements = placeAll(showcase, cols, resolved);
  }

  const totalRows = Math.max(
    0,
    ...placements.map((p) => p.rowEnd),
    ...resolved.map((r) => r.rowEnd)
  );

  guardedStretch(placements, resolved, totalRows);
  forcedFill(placements, resolved, cols, totalRows);

  // DOM slot: before the first tile that starts at/below the region.
  for (const r of resolved) {
    const idx = placements.findIndex((p) => p.rowStart >= r.rowStart);
    r.domIndex = idx === -1 ? placements.length : idx;
  }

  return { placements, regions: resolved, totalRows };
}
