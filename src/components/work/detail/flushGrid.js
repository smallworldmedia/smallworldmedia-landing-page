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
 * Square album art (SQ-78) never stretches in either stage: where the bottom
 * would need it, computeFlushGrid promotes covers to 2×2 instead (see
 * isSquareArt), and a gap no promotion closes stays open. Where promoting
 * alone cannot close it, a non-album portrait or landscape may take a single
 * 1×1 cell instead (SQ-82, demotable), rigid like a cover.
 *
 * Known ragged edge: a column whose final occupant is a region (no tile
 * below it while other columns run deeper) keeps a tail gap — nothing exists
 * to stretch. Curated content avoids this; the acceptance pass eyeballs it.
 *
 * Columns: the detail page places at 3; any count from 1 works (a landscape
 * spans min(2, cols)). A list far longer than a detail page places in
 * stacked chunks (chunkFlushGrid).
 */
import { ratioOf, isOtherAsset, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { cropLoss } from '../../../lib/mediaSequence.js';

/* ── Tessellating tile sizes ──
   Designed so 1 portrait = 2 squares = 2 landscapes (stacked),
   guaranteeing the grid can always back-fill with zero gaps. `sq` is a
   square tile's row span. tileRowsFor (tileGrid.js) derives it from the
   measured column width so tiles hold their shape at every window width
   (?tileshape, 10-27); the default 24 is the old fixed cell, 286px tall
   whatever the column width. In a single column a landscape can't span
   two, so it takes `ls` rows — the landscape's own shape at that width. */
const tileSizes = (sq, cols = 3, ls = sq) => ({
  portrait:  { colSpan: 1, rowSpan: 2 * sq },
  square:    { colSpan: 1, rowSpan: sq },
  landscape: { colSpan: Math.min(2, cols), rowSpan: cols === 1 ? ls : sq },
});

export function classifyTile(ratio) {
  if (ratio >= PORTRAIT_THRESHOLD) return 'landscape';
  if (ratio >= 0.9) return 'square';
  return 'portrait';
}

/** The shape each class gives its media, width ÷ height, at the baked tile
 *  shape (TILE_SHAPE 1): a portrait is two squares tall, a landscape two
 *  columns wide. */
export const TILE_RATIO = { portrait: 0.5, square: 1, landscape: 2 };

/**
 * The class whose shape crops a ratio-`ratio` picture least (cropLoss, the
 * house's one cost); a tie keeps the earlier of portrait, square, landscape.
 * Equal crop sits at the geometric middle of two shapes: √½ between portrait
 * and square, √2 between square and landscape.
 */
export function leastCropTile(ratio) {
  let best = 'square';
  let bestLoss = Infinity;
  for (const [type, shape] of Object.entries(TILE_RATIO)) {
    const loss = cropLoss(ratio, shape);
    if (loss < bestLoss - 1e-9) {
      best = type;
      bestLoss = loss;
    }
  }
  return best;
}

/**
 * The class a tile takes. The ratio-bucketed assets keep the label edges
 * (classifyTile): their shape is editorial. An `_other` asset (isOtherAsset)
 * has no bucket, and Nathan's note (11-12) is that it FILLS its tile "favoring
 * whichever side will get cropped less", so it takes the class that crops it
 * least: a 1.3:1 still is a square, not a landscape.
 */
export function tileClassOf(asset) {
  const ratio = ratioOf(asset);
  return isOtherAsset(asset) ? leastCropTile(ratio) : classifyTile(ratio);
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

/**
 * Square album art (SQ-78, Nathan 11-13: "square album art always is
 * displayed as square", every client's): a cover only ever sits in a square
 * box, 1×1 or 2×2. Its placement is RIGID: neither flush stage stretches it
 * (a 1×1 stretched over a short column is the 1 col × 2 sq box, the cover
 * cropped to a strip). Where the bottom needs filling, computeFlushGrid
 * promotes covers to 2×2 instead (promote). Rigidity rides a WeakSet so the
 * placements themselves stay plain data.
 */
export const isSquareArt = (asset) => asset.mediaType === 'album-art' && tileClassOf(asset) === 'square';
const RIGID = new WeakSet();

/** Dense-place one asset at its earliest fit (leftmost on a tie). `how`
 *  resizes it: 'big' a square cover promoted to 2×2 (two columns, two
 *  squares' rows), 'small' a piece demoted to one square cell (SQ-82). */
function placeOne(segs, asset, cols, sizes, how) {
  const type = how === 'small' ? 'square' : tileClassOf(asset);
  const { colSpan, rowSpan } = how === 'big' ? { colSpan: 2, rowSpan: 2 * sizes.square.rowSpan } : sizes[type];

  let best = null;
  for (let c = 0; c <= cols - colSpan; c++) {
    const r = earliestFit(segs, c, colSpan, rowSpan);
    if (r != null && (best === null || r < best.row)) best = { row: r, col: c };
  }

  occupy(segs, best.col, colSpan, best.row, rowSpan);
  const p = {
    col: best.col,
    colSpan,
    rowStart: best.row,
    rowEnd: best.row + rowSpan,
    type,
  };
  if (how === 'small' || isSquareArt(asset)) RIGID.add(p);
  return p;
}

/** Dense-place every showcase asset around the blocked rects; `resize` maps
 *  an index to 'big' or 'small' (placeOne). */
function placeAll(showcase, cols, blocked, sizes, resize = NONE) {
  const segs = freeSegments(cols, blocked);
  return showcase.map((asset, i) => placeOne(segs, asset, cols, sizes, resize.get(i)));
}
const NONE = new Map();

/**
 * Stage 1 — guarded stretch: each tile extends down to the next occupied
 * thing in every column it spans (other tiles, regions, or the grid
 * bottom). Closes interior gaps and flushes the bottom edge without ever
 * creating an overlap. Targets derive from immutable rowStarts, so the
 * pass is order-independent.
 */
function guardedStretch(placements, regions, totalRows) {
  for (const p of placements) {
    if (RIGID.has(p)) continue;
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
        if (above && !RIGID.has(above)) {
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
function pinBreaks(showcase, cols, resolved, sizes, sqRows, placements, count, every, resize) {
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
      const holes = holeRows(showcase, cols, [...resolved, cut(i, row)], sizes, sqRows, resize);
      const dist = Math.abs(row - target);
      if (
        holes < best.holes ||
        (holes === best.holes && (dist < best.dist || (dist === best.dist && row < best.row)))
      ) {
        best = { row, holes, dist };
      }
    }
    resolved.push(cut(i, best.row));
    placements = placeAll(showcase, cols, resolved, sizes, resize);
    floor = best.row;
  }
  return placements;
}

/** Rows no tile or region covers, summed over the columns, once both
 *  stretch passes have run on a trial layout: the open holes a cut leaves. */
function holeRows(showcase, cols, resolved, sizes, sqRows, resize) {
  const placements = placeAll(showcase, cols, resolved, sizes, resize);
  const end = Math.max(0, ...placements.map((p) => p.rowEnd), ...resolved.map((r) => r.rowEnd));
  guardedStretch(placements, resolved, end);
  forcedFill(placements, resolved, cols, end, sqRows / 2);
  return openRows(placements, resolved, cols, end);
}

/** Rows no tile or region covers in [0, end), summed over the columns. */
function openRows(placements, resolved, cols, end) {
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
 * @param {number} [opts.lsRows=sqRows] - a landscape's row span in a single
 *        column (tileRowsFor's `ls`); two or more columns span 2 × sqRows.
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
 *    segments. Square album art (isSquareArt) is 1×1 or, promoted, a
 *    2-column `square` of 2 × sqRows rows; it never stretches. A piece
 *    demoted to one cell (demotable, SQ-82) is a `square` of sqRows rows, its
 *    `type` the cell it fills rather than its class, and rigid the same way.
 */
export function computeFlushGrid(showcase, opts = {}) {
  const base = layoutFlush(showcase, opts, NONE);
  const cols = opts.cols ?? 3;
  const holes = (out) => openRows(out.placements, out.regions, cols, out.totalRows);
  let best = { out: base, holes: holes(base) };
  // Nothing open, or nothing to resize (one column has no 2×2): done.
  if (cols < 2 || best.holes === 0) return base;
  const art = showcase.flatMap((a, i) => (isSquareArt(a) ? [i] : [])).reverse();
  const trial = (small, big) =>
    layoutFlush(showcase, opts, new Map([...small.map((i) => [i, 'small']), ...big.map((i) => [i, 'big'])]));

  // Promote covers to 2×2 (SQ-78): one 2×2 adds three squares of area, so a
  // short last row closes with the right count. Fewest promotions first,
  // the covers nearest the list's end first; the first flat layout wins.
  // With none, the fewest open rows wins, and an unhelped grid keeps its
  // ragged edge rather than a stretched cover.
  const pools = [art.slice(0, 3 * cols), art.slice(0, 2 * cols), art.slice(0, 2 * cols)];
  for (let k = 1; k <= pools.length && art.length > 0; k++) {
    for (const pick of combos(pools[k - 1], k)) {
      const out = trial([], pick);
      const h = holes(out);
      if (h === 0) return out;
      if (h < best.holes) best = { out, holes: h };
    }
  }

  // Demote non-album pieces to one square cell (SQ-82), alone or beside
  // promotions (a demotion shifts the area count by one, a promotion by
  // three: only together do some counts close). Fewest swaps first; of the
  // flat layouts at that count, the least crop, then the nearest the end.
  // Up to three swaps, from the 2 × cols pieces and the `cols` covers nearest
  // the end: a wider pool closed no more of the live directory's views (11-13)
  // and costs layouts in proportion.
  const swaps = demotable(showcase, base, opts.sqRows ?? 24).slice(0, 2 * cols);
  const near = art.slice(0, cols);
  const cost = (small) => small.reduce((s, i) => s + cropLoss(ratioOf(showcase[i]), 1), 0);
  for (let k = 1; k <= 3 && swaps.length > 0; k++) {
    let flat = null;
    for (let d = 1; d <= Math.min(k, swaps.length); d++) {
      for (const small of combos(swaps, d)) {
        for (const big of combos(near, k - d)) {
          const out = trial(small, big);
          const h = holes(out);
          if (h === 0) {
            const c = cost(small);
            if (!flat || c < flat.cost - 1e-9) flat = { out, cost: c };
          } else if (h < best.holes) best = { out, holes: h };
        }
      }
    }
    if (flat) return flat.out;
  }
  return best.out;
}

/**
 * The pieces that may take a single square cell (SQ-82), nearest the list's
 * end first. Not a cover (square album art is rigid already) and not a
 * square-class piece (its tile IS 1×1; non-album squares keep stretching),
 * and a square must crop the piece less than the box the base layout gives
 * it today (a 4:5 portrait loses 20% as a square against 37.5% stretched
 * over a 1×2), so the swap never costs the piece more.
 */
function demotable(showcase, base, sqRows) {
  const out = [];
  showcase.forEach((a, i) => {
    if (isSquareArt(a) || tileClassOf(a) === 'square') return;
    const p = base.placements[i];
    const slot = p.colSpan / ((p.rowEnd - p.rowStart) / sqRows);
    const r = ratioOf(a);
    if (cropLoss(r, 1) < cropLoss(r, slot) - 1e-9) out.push(i);
  });
  return out.reverse();
}

/** Every k-subset of `list`, in lexicographic order of its positions. */
function* combos(list, k, from = 0) {
  if (k === 0) {
    yield [];
    return;
  }
  for (let i = from; i <= list.length - k; i++) {
    for (const rest of combos(list, k - 1, i + 1)) yield [list[i], ...rest];
  }
}

/** computeFlushGrid's layout with the pieces in `resize` promoted (2×2) or demoted (1×1). */
function layoutFlush(
  showcase,
  { cols = 3, regions = [], sqRows = 24, lsRows = sqRows, breaks = 0, breakEvery = 2 },
  resize
) {
  const sizes = tileSizes(sqRows, cols, lsRows);

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
    placements = placeAll(showcase, cols, resolved, sizes, resize);
  } else {
    // Pass 1 — natural grid without the mid regions.
    const natural = placeAll(showcase, cols, resolved, sizes, resize);
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
    placements = placeAll(showcase, cols, resolved, sizes, resize);
  }

  placements = pinBreaks(showcase, cols, resolved, sizes, sqRows, placements, breaks, breakEvery * sqRows, resize);

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

/**
 * One flush grid cut into stacked chunks, for lists far longer than a detail
 * page (the Project Directory, ~700 tiles). Each chunk renders as its own
 * grid one row gap below the last, so a chunk can unmount and still hold its
 * height, and no grid nears the browsers' line limits (Firefox clamps a grid
 * at 10,000 lines; a directory-sized list in one grid runs past that).
 *
 * A chunk ends at the first FLAT state after `minTiles`: every column's free
 * space starts on the same row with nothing open above it. The rest then
 * places exactly as a fresh grid would, so natural chunks stacked one row
 * gap apart ARE the single grid, row for row. With no flat state by
 * `maxTiles` (or past `maxRows`), the cut goes at the least ragged point
 * seen and the chunk flushes like the bottom of a detail page (`forced`).
 * Dense back-fill stays inside its chunk, so the list's order holds.
 *
 * @param {Array<Object>} items - assets in list order (ratioOf reads each)
 * @param {Object} [opts] - cols / sqRows / lsRows as computeFlushGrid;
 *        minTiles, maxTiles, maxRows bound each chunk
 * @returns {Array<{start: number, end: number, placements: Array<Object>, totalRows: number, forced: boolean}>}
 *   [start, end) indexes `items`; placements align 1:1 with that slice.
 */
export function chunkFlushGrid(
  items,
  { cols = 3, sqRows = 24, lsRows = sqRows, minTiles = 32, maxTiles = 64, maxRows = 6000 } = {}
) {
  const sizes = tileSizes(sqRows, cols, lsRows);
  const chunks = [];
  let start = 0;
  while (start < items.length) {
    const segs = freeSegments(cols, []);
    let end = items.length;
    let forced = false;
    let best = null; // the least ragged cut seen past minTiles: { at, score }
    for (let i = start; i < items.length; i++) {
      placeOne(segs, items[i], cols, sizes);
      const n = i - start + 1;
      // Each column's open tail starts at its last segment; anything open
      // above a tail is a hole. Ragged = the tails' shortfall + the holes.
      const tails = segs.map((s) => s[s.length - 1].start);
      const top = Math.max(...tails);
      if (top > maxRows && n > 1) {
        end = best ? best.at : i; // this tile overruns: cut before it
        forced = true;
        break;
      }
      if (n < minTiles) continue;
      let score = 0;
      for (const s of segs) {
        score += top - s[s.length - 1].start;
        for (let k = 0; k < s.length - 1; k++) score += s[k].end - s[k].start;
      }
      if (score === 0) {
        end = i + 1;
        break;
      }
      if (!best || score < best.score) best = { at: i + 1, score };
      if (n >= maxTiles) {
        end = best.at;
        forced = true;
        break;
      }
    }
    const { placements, totalRows } = computeFlushGrid(items.slice(start, end), { cols, sqRows, lsRows });
    chunks.push({ start, end, placements, totalRows, forced });
    start = end;
  }
  return chunks;
}
