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
 *   `top`    — region rows start at 0 (directly below the blurb).
 *   `mid`    — two-pass: place tiles without the region, pick the tile row
 *              boundary nearest the natural midpoint, pin the region there,
 *              re-place everything around it. Deterministic.
 *   `bottom` — pinned AFTER everything (08-25 (2), the SA tour wall): the
 *              region starts at the grid's natural end (bottoms stack), no
 *              tile ever places below it, and the guarded stretch flushes
 *              the tile field down to its top edge.
 *   `break`  — zero-height full-width cuts (11-03, the description's later
 *              paragraphs): `opts.breaks` of them, pinned last of the
 *              in-field regions (pinBreaks). splitAtBreaks cuts the grid
 *              there so each text band sits between two grids.
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
   guaranteeing the grid can always back-fill with zero gaps. `sq` is a
   square tile's row span. FeaturedProjectDetail derives it from the
   measured column width so tiles hold their shape at every window width
   (?tileshape, 10-27); the default 24 is the old fixed cell, 286px tall
   whatever the column width. */
const tileSizes = (sq) => ({
  portrait:  { colSpan: 1, rowSpan: 2 * sq },
  square:    { colSpan: 1, rowSpan: sq },
  landscape: { colSpan: 2, rowSpan: sq },
});

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
function placeAll(showcase, cols, blocked, sizes) {
  const segs = freeSegments(cols, blocked);

  return showcase.map((asset) => {
    const type = classifyTile(ratioOf(asset));
    const { colSpan, rowSpan } = sizes[type];

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
 *
 * 08-25 (Nathan — the bedouin "saga tulum promo covering the tiles above
 * it"): the stretch is BOUNDED. An unbounded stretch on a multi-column
 * tile could double its box under a neighbor (a 26-row under-paint), and
 * where TWO stretched underlays overlapped, DOM order — not z-index —
 * decided who painted on top: the lower tile's media covered the tile
 * above it. A stretch whose collateral overlap with any OTHER placement
 * exceeds MAX_UNDERLAY_ROWS is rejected — the residual gap stays open
 * (near-black ground, the same accepted ragged edge) instead of a
 * building-sized underlay reading as a broken grid.
 */
const MAX_UNDERLAY_ROWS = 12; // half a landscape — a peek, never a second tile

function forcedFill(placements, regions, cols, totalRows, maxUnderlay = MAX_UNDERLAY_ROWS) {
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
          // Collateral bound: how deep would the stretched box run under
          // any other placement in the columns it spans?
          let collateral = 0;
          for (const other of placements) {
            if (other === above) continue;
            const sharesCol =
              other.col < above.col + above.colSpan &&
              other.col + other.colSpan > above.col;
            if (sharesCol && other.rowStart < target && other.rowEnd > above.rowEnd) {
              collateral = Math.max(
                collateral,
                Math.min(target, other.rowEnd) - Math.max(above.rowEnd, other.rowStart)
              );
            }
          }
          if (target > above.rowEnd && collateral <= maxUnderlay) {
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
 * Break rows (11-03, Nathan: a description's later paragraphs get their own
 * text bands down the grid). A break is a region of NO rows: it still splits
 * every column's free segments, so no tile may straddle it, and both stretch
 * passes flush the tiles above it down to its row — a clean cut.
 *
 * Spacing: one break every `every` rows down from the top of the tile field,
 * closed up to an even spread only when the field is too short to hold them
 * all at that pitch (Nathan 11-03: 3+ paragraphs go "every couple of rows",
 * not spread through the whole grid). Pinned one at a
 * time against the placement the break before it left, each on a row where
 * a tile ends, at or below that break. A cut re-packs every tile after it,
 * so the nearest row can strand a hole the single grid never had (cheetah
 * print, 11-03: one square left open at the grid's foot): the row that
 * leaves the fewest hole rows wins, then the one nearest the target (ties →
 * the earlier row). With no tile below the last break, the rest share its
 * row — one band. No tiles at all → no breaks.
 */
function pinBreaks(showcase, cols, resolved, sizes, sqRows, placements, count, every) {
  if (count <= 0 || placements.length === 0) return placements;

  const start = Math.min(...placements.map((p) => p.rowStart));
  const end = Math.max(...placements.map((p) => p.rowEnd));
  const even = (end - start) / (count + 1);
  const step = Math.min(every, even);
  // A full-width socket band is never cut.
  const inside = (b) => resolved.some((r) => r.rowStart < b && b < r.rowEnd);
  const cut = (i, row) => ({
    id: `break:${i}`,
    colStart: 0,
    colSpan: cols,
    rowSpan: 0,
    rowStart: row,
    rowEnd: row,
    anchor: 'break',
  });

  let floor = start;
  for (let i = 0; i < count; i++) {
    const target = start + (i + 1) * step;
    let best = { row: floor, holes: Infinity, dist: Infinity };
    for (const row of new Set(placements.map((p) => p.rowEnd))) {
      if (row < floor || inside(row)) continue;
      const holes = holeRows(showcase, cols, [...resolved, cut(i, row)], sizes, sqRows);
      const dist = Math.abs(row - target);
      if (
        holes < best.holes ||
        (holes === best.holes && (dist < best.dist || (dist === best.dist && row < best.row)))
      ) {
        best = { row, holes, dist };
      }
    }
    resolved.push(cut(i, best.row));
    placements = placeAll(showcase, cols, resolved, sizes);
    floor = best.row;
  }
  return placements;
}

/** Rows no tile or region covers, summed over the columns, once both
 *  stretch passes have run on a trial layout: the open holes a cut leaves. */
function holeRows(showcase, cols, resolved, sizes, sqRows) {
  const placements = placeAll(showcase, cols, resolved, sizes);
  const end = Math.max(0, ...placements.map((p) => p.rowEnd), ...resolved.map((r) => r.rowEnd));
  guardedStretch(placements, resolved, end);
  forcedFill(placements, resolved, cols, end, sqRows / 2);

  const spans = [
    ...placements.map((p) => [p.col, p.colSpan, p.rowStart, p.rowEnd]),
    ...resolved.map((r) => [r.colStart, r.colSpan, r.rowStart, r.rowEnd]),
  ].sort((a, b) => a[2] - b[2]);
  let holes = 0;
  for (let c = 0; c < cols; c++) {
    let cursor = 0;
    for (const [c0, n, s, e] of spans) {
      if (c < c0 || c >= c0 + n) continue;
      if (s > cursor) holes += s - cursor;
      cursor = Math.max(cursor, e);
    }
    holes += end - cursor;
  }
  return holes;
}

/**
 * Compute flush-grid placements, flowing around reserved socket regions.
 *
 * @param {Array<Object>} showcase - showcase assets (orderRank order)
 * @param {Object} [opts]
 * @param {number} [opts.cols=3]
 * @param {Array<{id: string, colStart: number, colSpan: number, rowSpan: number, anchor: 'top'|'mid'|'bottom'}>} [opts.regions=[]]
 *        Caller guarantees same-anchor regions don't overlap.
 * @param {number} [opts.sqRows=24] - a square tile's row span (tileSizes);
 *        the underlay bound scales with it (half a landscape).
 * @param {number} [opts.breaks=0] - break rows to cut (pinBreaks), ids
 *        `break:0`…; anchor `'break'`, zero rows.
 * @param {number} [opts.breakEvery=2] - break pitch in SQUARES (× sqRows),
 *        > 0.
 * @returns {{
 *   placements: Array<{col: number, colSpan: number, rowStart: number, rowEnd: number, type: string, underlay?: boolean}>,
 *   regions: Array<{id: string, colStart: number, colSpan: number, rowStart: number, rowEnd: number, anchor: string}>,
 *   totalRows: number
 * }} placements align 1:1 with the showcase array. `underlay` tiles must
 *    paint beneath intact tiles. splitAtBreaks turns this into rendered
 *    segments.
 */
export function computeFlushGrid(
  showcase,
  { cols = 3, regions = [], sqRows = 24, breaks = 0, breakEvery = 2 } = {}
) {
  const sizes = tileSizes(sqRows);

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
    .filter((r) => r.anchor !== 'mid' && r.anchor !== 'bottom')
    .map((r) => ({ ...r, rowStart: 0, rowEnd: r.rowSpan }));
  const mids = norm.filter((r) => r.anchor === 'mid');
  const bottoms = norm.filter((r) => r.anchor === 'bottom');

  let placements;
  if (mids.length === 0) {
    placements = placeAll(showcase, cols, resolved, sizes);
  } else {
    // Pass 1 — natural grid without the mid regions.
    const natural = placeAll(showcase, cols, resolved, sizes);
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
    placements = placeAll(showcase, cols, resolved, sizes);
  }

  placements = pinBreaks(showcase, cols, resolved, sizes, sqRows, placements, breaks, breakEvery * sqRows);

  // Bottom regions — pinned at the natural end AFTER placement (tiles can
  // never flow below them), stacking downward. Added to `resolved` before
  // the flush passes so the guarded stretch clamps at the first bottom
  // region's top edge (full-width regions flush the whole tile field).
  let bottomRow = Math.max(
    0,
    ...placements.map((p) => p.rowEnd),
    ...resolved.map((r) => r.rowEnd)
  );
  for (const r of bottoms) {
    resolved.push({ ...r, rowStart: bottomRow, rowEnd: bottomRow + r.rowSpan });
    bottomRow += r.rowSpan;
  }

  const totalRows = Math.max(
    0,
    ...placements.map((p) => p.rowEnd),
    ...resolved.map((r) => r.rowEnd)
  );

  guardedStretch(placements, resolved, totalRows);
  forcedFill(placements, resolved, cols, totalRows, sqRows / 2);

  return { placements, regions: resolved, totalRows };
}

/**
 * Cut a resolved grid at its break rows into stacked segments, one CSS grid
 * each with rows rebased to its own top, so the band at a break sits between
 * two grids in normal flow at its own height. Tiles never straddle a break,
 * so each lands whole in one segment. Without breaks: one segment, the whole
 * grid.
 *
 * @returns {Array<{
 *   tiles: Array<{index: number, col: number, colSpan: number, rowStart: number, rowEnd: number, type: string, underlay?: boolean}>,
 *   sockets: Array<Object>,
 *   breaks: Array<string>
 * }>} `tiles[].index` = the showcase index. `sockets[].domIndex` = the
 *    segment tile index the socket renders before (single-column flow reads
 *    in order). `breaks` = ids of the breaks closing the segment (its band).
 */
export function splitAtBreaks({ placements, regions }) {
  const cuts = regions.filter((r) => r.anchor === 'break');
  const edges = [0, ...new Set(cuts.map((r) => r.rowStart).sort((a, b) => a - b))];

  return edges.map((lo, k) => {
    const hi = edges[k + 1] ?? Infinity;
    const within = (row) => row >= lo && row < hi;
    const tiles = placements.flatMap((p, index) =>
      within(p.rowStart)
        ? [{ ...p, index, rowStart: p.rowStart - lo, rowEnd: p.rowEnd - lo }]
        : []
    );
    const sockets = regions
      .filter((r) => r.anchor !== 'break' && within(r.rowStart))
      .map((r) => {
        // DOM slot: before the first tile that starts at/below the region.
        const slot = tiles.findIndex((t) => t.rowStart >= r.rowStart - lo);
        return {
          ...r,
          rowStart: r.rowStart - lo,
          rowEnd: r.rowEnd - lo,
          domIndex: slot === -1 ? tiles.length : slot,
        };
      });
    return { tiles, sockets, breaks: cuts.filter((r) => r.rowStart === hi).map((r) => r.id) };
  });
}
