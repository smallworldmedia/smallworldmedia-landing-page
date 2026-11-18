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
 *   `seat`   — Studio order (Nathan 11-14: a set sits where its first
 *              member ranks). The region carries `at`, a showcase index, and
 *              is pinned DURING placement, just before tile `at`: on the
 *              first row at or below everything placed so far where its
 *              columns are free. No earlier tile ever sits below it; later
 *              tiles may back-fill the holes it leaves above, as dense
 *              placement does everywhere. Seats with one `at` stack in the
 *              caller's order; `at` 0 is the top of the grid, `at` past the
 *              last tile its end. The detail page seats every set this way.
 *              Two rules keep the back-fill near the seam: a split video's
 *              tiles stay on one side of every seat (placeAll), and where a
 *              piece must be cut to a square to close a hole, the search
 *              takes the pieces nearest the seat before the least-cropped
 *              ones (`pulled`, computeFlushGrid).
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
 * A portrait (a 9:16 or any tall piece) stretches in neither stage past the
 * crop cap (SQ-117, PORTRAIT_CROP, mayStretch): the hole it leaves goes to the
 * same promotions and demotions, and one they cannot close is stretched after
 * all (finishOpen), so the cap never leaves a page more open than before it.
 * A landscape is held the same way (SQ-119, LANDSCAPE_CROP): the hole the
 * portrait cap leaves is no longer closed by a 16:9 drawn 2 × 2, and a page
 * the two caps leave worse than the portrait cap alone kept it is given that
 * layout back (computeFlushGrid).
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
function earliestFit(segs, c0, colSpan, rowSpan, from = 0) {
  const candidates = new Set();
  for (let j = 0; j < colSpan; j++) {
    for (const s of segs[c0 + j]) if (s.end > from) candidates.add(Math.max(s.start, from));
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

/**
 * The portrait crop cap (SQ-117, Nathan 11-17: "a max amount that we can
 * tolerate cropping, instead favoring using a square asset when present to
 * fill the grid out to have the 9x16 content stay truer to its aspect ratio").
 * A portrait-class tile (a 9:16 or any other tall piece, still or video) may
 * not be STRETCHED by either flush stage to a box that crops it more than
 * this (cropLoss, the house's one cost), unless the stretch crops it no more
 * than the box it has: a 9:16 is cropped 0.11 in its 1 × 2 and 0.41 stretched
 * to 1 × 3, 0.56 to 1 × 4. The hole the refused stretch leaves is closed the
 * way any hole is, by computeFlushGrid's search (a cover promoted, a piece
 * demoted to one square cell); a hole that search cannot close is stretched
 * after all (`finishOpen`), and a page that would still be more open than before
 * the cap keeps its layout from before it. 1 = off: no
 * stretch is refused and the layout is exactly the one before the cap.
 * PROPOSED; ?portraitcrop=<0-1> re-dials it (tileGrid.js readPortraitCrop).
 */
export const PORTRAIT_CROP = 0.2;
/**
 * The landscape crop cap (SQ-119): the same guard for a LANDSCAPE-class tile
 * (16:9, 4:3, 2:1, any wide piece, still or video). The portrait cap leaves a
 * hole, findFlat counts a layout flat once both stretch passes have run, and a
 * landscape over the hole used to close it unchecked: a 16:9 drawn 2 × 2 is
 * cropped 0.437 where its 2 × 1 crops it 0.111 (Nusonido and TOBEHONEST at
 * 1440). A landscape stretches in neither stage past this cap (mayStretch)
 * unless the stretch crops it no more than the box it has, and the hole goes
 * to the same search; one it cannot close is stretched after all, and a page
 * the cap would leave worse than before it, in open rows or in the worst crop
 * of either class, keeps its layout from before it (computeFlushGrid).
 * 1 = off: the layout the portrait cap drew (2c6770d). PROPOSED;
 * ?landscapecrop=<0-1> re-dials it (tileGrid.js readLandscapeCrop).
 */
export const LANDSCAPE_CROP = 0.2;
/** A portrait-class placement → its picture's ratio, so a stretch can price the new box. */
const TALL = new WeakMap();
/** The same for a landscape-class placement (LANDSCAPE_CROP). */
const WIDE = new WeakMap();
/** Stretches mayStretch has refused a landscape: computeFlushGrid reads it to know the landscape cap changed anything. */
let wideRefused = 0;
/** May `p` stretch down to `rowEnd`? `lim` = { sqRows, cap, wide }, the portrait and landscape caps; null = no cap. */
function mayStretch(p, rowEnd, lim) {
  const tall = TALL.get(p);
  const ratio = tall ?? WIDE.get(p);
  if (!lim || ratio === undefined) return true;
  const cap = tall === undefined ? lim.wide : lim.cap;
  if (cap >= 1) return true; // off: no crop reaches 1
  const loss = (end) => cropLoss(ratio, p.colSpan / ((end - p.rowStart) / lim.sqRows));
  const after = loss(rowEnd);
  const ok = after <= cap + 1e-9 || after <= loss(p.rowEnd) + 1e-9;
  if (!ok && tall === undefined) wideRefused++;
  return ok;
}

/** Dense-place one asset at its earliest fit (leftmost on a tie). `how`
 *  resizes it: 'big' a square cover promoted to 2×2 (two columns, two
 *  squares' rows), 'small' a piece demoted to one square cell (SQ-82). */
function placeOne(segs, asset, cols, sizes, how, from = 0) {
  const type = how === 'small' ? 'square' : tileClassOf(asset);
  const { colSpan, rowSpan } = how === 'big' ? { colSpan: 2, rowSpan: 2 * sizes.square.rowSpan } : sizes[type];

  let best = null;
  for (let c = 0; c <= cols - colSpan; c++) {
    const r = earliestFit(segs, c, colSpan, rowSpan, from);
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
  else if (type === 'portrait') TALL.set(p, ratioOf(asset));
  else if (type === 'landscape') WIDE.set(p, ratioOf(asset));
  return p;
}

/** The first row at or below `from` where columns c0..c0+colSpan-1 are all
 *  free for `rowSpan` rows. A break cut splits every column's free rows, so
 *  a band found here never straddles one. */
function bandFit(segs, c0, colSpan, from, rowSpan) {
  let row = from;
  for (let j = 0; j < colSpan; j++) {
    const s = segs[c0 + j].find((x) => x.end - Math.max(x.start, row) >= rowSpan);
    if (s.start > row) {
      row = s.start;
      j = -1; // a column moved the row: check them all again
    }
  }
  return row;
}

/** Dense-place every showcase asset around the blocked rects; `resize` maps
 *  an index to 'big' or 'small' (placeOne). `seats` (anchor 'seat', sorted by
 *  `at`) are pinned on the way, each just before tile `at`, below everything
 *  placed so far (`floor`): the tiles before it and the seats before it.
 *  Returns the placements and the seats with their rows. */
function placeAll(showcase, cols, blocked, sizes, resize = NONE, seats = NO_SEATS) {
  const segs = freeSegments(cols, blocked);
  const seated = [];
  let next = 0;
  let floor = 0;
  const pin = () => {
    const r = seats[next++];
    const row = bandFit(segs, r.colStart, r.colSpan, floor, r.rowSpan);
    occupy(segs, r.colStart, r.colSpan, row, r.rowSpan);
    seated.push({ ...r, rowStart: row, rowEnd: row + r.rowSpan });
    floor = row + r.rowSpan;
  };
  // A split video's tiles (its thirds, side by side in the list) stay on one
  // side of every seat. Dense placement alone can drop one third into a hole
  // above a band and the others below it; then they all start below it. The
  // run is tried on a copy of the free segments first (occupy swaps a column's
  // array, never edits one, so a shallow copy is a full snapshot).
  const startRow = (i, of) => {
    let end = i;
    while (end < showcase.length && showcase[end].chunk?.of === of) end++;
    let from = 0;
    for (;;) {
      const trial = segs.slice();
      const rows = [];
      for (let j = i; j < end; j++) rows.push(placeOne(trial, showcase[j], cols, sizes, resize.get(j), from).rowStart);
      const parting = seated.filter((r) => rows.some((x) => x < r.rowStart) && rows.some((x) => x >= r.rowEnd));
      if (parting.length === 0) return from;
      from = Math.max(...parting.map((r) => r.rowEnd));
    }
  };
  let run = null; // the split video being placed
  let runFrom = 0; // the row its tiles may not start above
  const placements = showcase.map((asset, i) => {
    while (next < seats.length && seats[next].at <= i) pin();
    const of = asset.chunk?.of ?? null;
    if (of !== run) {
      run = of;
      runFrom = of !== null && seated.length > 0 ? startRow(i, of) : 0;
    }
    const p = placeOne(segs, asset, cols, sizes, resize.get(i), runFrom);
    if (p.rowEnd > floor) floor = p.rowEnd;
    return p;
  });
  while (next < seats.length) pin();
  return { placements, seated };
}
const NONE = new Map();
const NO_SEATS = [];

/**
 * Stage 1 — guarded stretch: each tile extends down to the next occupied
 * thing in every column it spans (other tiles, regions, or the grid
 * bottom). Closes interior gaps and flushes the bottom edge without ever
 * creating an overlap. Targets derive from immutable rowStarts, so the
 * pass is order-independent. A portrait stays put where the stretch would
 * crop it past the cap (mayStretch).
 */
function guardedStretch(placements, regions, totalRows, lim = null) {
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

    if (target > p.rowEnd && mayStretch(p, target, lim)) p.rowEnd = target;
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

function forcedFill(placements, regions, cols, totalRows, maxUnderlay = MAX_UNDERLAY_ROWS, lim = null) {
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
          if (target > above.rowEnd && collateral <= maxUnderlay && mayStretch(above, target, lim)) {
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
function pinBreaks(place, cols, resolved, sqRows, laid, count, every, lim) {
  if (count <= 0 || laid.placements.length === 0) return laid;

  const start = Math.min(...laid.placements.map((p) => p.rowStart));
  const end = Math.max(...laid.placements.map((p) => p.rowEnd));
  const even = (end - start) / (count + 1);
  const step = Math.min(every, even);
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
    // A full-width socket band is never cut (a seat re-pins around the cut in
    // the trial below; this skips the rows inside it as it stands).
    const bands = [...resolved, ...laid.seated];
    const inside = (b) => bands.some((r) => r.rowStart < b && b < r.rowEnd);
    let best = { row: floor, holes: Infinity, dist: Infinity };
    for (const row of new Set(laid.placements.map((p) => p.rowEnd))) {
      if (row < floor || inside(row)) continue;
      const holes = holeRows(place, cols, [...resolved, cut(i, row)], sqRows, lim);
      const dist = Math.abs(row - target);
      if (
        holes < best.holes ||
        (holes === best.holes && (dist < best.dist || (dist === best.dist && row < best.row)))
      ) {
        best = { row, holes, dist };
      }
    }
    resolved.push(cut(i, best.row));
    laid = place(resolved);
    floor = best.row;
  }
  return laid;
}

/** Rows no tile or region covers, summed over the columns, once both
 *  stretch passes have run on a trial layout: the open holes a cut leaves. */
function holeRows(place, cols, resolved, sqRows, lim) {
  const { placements, seated } = place(resolved);
  const all = [...resolved, ...seated];
  const end = Math.max(0, ...placements.map((p) => p.rowEnd), ...all.map((r) => r.rowEnd));
  guardedStretch(placements, all, end, lim);
  forcedFill(placements, all, cols, end, sqRows / 2, lim);
  return openRows(placements, all, cols, end);
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
 * @param {Array<{id: string, colStart: number, colSpan: number, rowSpan: number, anchor: 'top'|'mid'|'bottom'|'seat', at?: number}>} [opts.regions=[]]
 *        Caller guarantees same-anchor regions don't overlap. A 'seat'
 *        region carries `at`, the showcase index it sits before (none = the
 *        end), and seats with one `at` stack in the order given.
 * @param {number} [opts.sqRows=24] - a square tile's row span (tileSizes);
 *        the underlay bound scales with it (half a landscape).
 * @param {number} [opts.lsRows=sqRows] - a landscape's row span in a single
 *        column (tileRowsFor's `ls`); two or more columns span 2 × sqRows.
 * @param {number} [opts.breaks=0] - break rows to cut (pinBreaks), ids
 *        `break:0`…; anchor `'break'`, zero rows.
 * @param {number} [opts.breakEvery=2] - break pitch in SQUARES (× sqRows),
 *        > 0.
 * @param {number} [opts.portraitCrop=1] - the portrait crop cap (PORTRAIT_CROP):
 *        1 = off, the layout before it. The detail page passes the dial;
 *        chunkFlushGrid (the directory) leaves it off.
 * @param {number} [opts.landscapeCrop=1] - the landscape crop cap (LANDSCAPE_CROP),
 *        the same dial for a landscape-class tile: 1 = off, the layout the
 *        portrait cap drew. Never leaves a page worse than that layout in open
 *        rows or in the worst crop of either class.
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
  const { cols = 3, sqRows = 24, landscapeCrop = 1 } = opts;
  const refused = wideRefused;
  const out = finishOpen(showcase, opts, findFlat(showcase, opts));
  // The landscape cap changed nothing unless it refused a stretch somewhere in the search.
  if (landscapeCrop >= 1 || wideRefused === refused) return out;
  // The layout the page had before this cap (2c6770d's, the portrait cap alone) is the floor: this one
  // stands only where it is no worse in open rows or in the worst crop of either class, and better in one.
  const prior = computeFlushGrid(showcase, { ...opts, landscapeCrop: 1 });
  const score = (o) => [
    openRows(o.placements, o.regions, cols, o.totalRows),
    worstCrop(o, TALL, sqRows),
    worstCrop(o, WIDE, sqRows),
  ];
  const [now, was] = [score(out), score(prior)];
  const noWorse = now.every((v, i) => v <= was[i] + 1e-9);
  return noWorse && now.some((v, i) => v < was[i] - 1e-9) ? out : prior;
}

/** The worst crop in a layout among the placements `map` prices (TALL: portraits, WIDE: landscapes), each against its drawn box. */
function worstCrop(o, map, sqRows) {
  return o.placements.reduce((m, p) => {
    const ratio = map.get(p);
    return ratio === undefined ? m : Math.max(m, cropLoss(ratio, p.colSpan / ((p.rowEnd - p.rowStart) / sqRows)));
  }, 0);
}

/**
 * What a hole the caps left open becomes. The portrait cap (PORTRAIT_CROP) and
 * the landscape cap (LANDSCAPE_CROP) refuse the stretches that closed holes
 * before them, and findFlat then looks for a layout whose pieces close them
 * without one. A layout it cannot close flat has its holes stretched shut
 * after all, by both flush stages with no cap, and where even that leaves more
 * open than the page had before the caps (a rigid cover over a hole only a
 * stretched portrait closed), or closes it with a portrait cropped harder than
 * any the page had before them, the page keeps its layout from before them.
 * Either way: today's behaviour for a hole no square can fill.
 */
function finishOpen(showcase, opts, out) {
  const { cols = 3, sqRows = 24, portraitCrop = 1, landscapeCrop = 1 } = opts;
  const open = (o) => openRows(o.placements, o.regions, cols, o.totalRows);
  if ((portraitCrop >= 1 && landscapeCrop >= 1) || open(out) === 0) return out;
  guardedStretch(out.placements, out.regions, out.totalRows);
  forcedFill(out.placements, out.regions, cols, out.totalRows, sqRows / 2);
  const before = findFlat(showcase, { ...opts, portraitCrop: 1, landscapeCrop: 1 });
  if (open(out) > 0) return open(before) < open(out) ? before : out;
  // Closed, but a portrait stretched past the worst the page had before the cap
  // would defeat the cap's point: that page keeps its layout from before it.
  return worstCrop(out, TALL, sqRows) > worstCrop(before, TALL, sqRows) + 1e-9 && open(before) === 0 ? before : out;
}

/** The first layout with nothing open: the base, else covers promoted, else pieces demoted (below); failing that, the one with the fewest open rows. */
function findFlat(showcase, opts) {
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
  // flat layouts at that count, the least pulled (below), then the least
  // crop, then the nearest the end.
  // Up to three swaps, from the 2 × cols pieces and the `cols` covers nearest
  // the end: a wider pool closed no more of the live directory's views (11-13)
  // and costs layouts in proportion.
  const swaps = demotable(showcase, base, opts.sqRows ?? 24).slice(0, 2 * cols);
  const near = art.slice(0, cols);
  const cost = (small) => small.reduce((s, i) => s + cropLoss(ratioOf(showcase[i]), 1), 0);
  // With seats (11-14) a demoted piece fits the one-cell holes a band leaves
  // above it, so a piece from the page's end can land in the first rows, above
  // every set it ranks after. `pulled` counts how far past each seat the tiles
  // above it rank; with no seat it is 0 and the crop decides as before.
  const pulled = (out) => {
    let far = 0;
    for (const r of out.regions) {
      if (r.anchor !== 'seat') continue;
      out.placements.forEach((p, j) => {
        if (j >= r.at && p.rowStart < r.rowStart) far += 1 + j - r.at;
      });
    }
    return far;
  };
  for (let k = 1; k <= 3 && swaps.length > 0; k++) {
    let flat = null;
    for (let d = 1; d <= Math.min(k, swaps.length); d++) {
      for (const small of combos(swaps, d)) {
        for (const big of combos(near, k - d)) {
          const out = trial(small, big);
          const h = holes(out);
          if (h === 0) {
            const c = cost(small);
            const far = pulled(out);
            if (!flat || far < flat.far || (far === flat.far && c < flat.cost - 1e-9)) flat = { out, cost: c, far };
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
  { cols = 3, regions = [], sqRows = 24, lsRows = sqRows, breaks = 0, breakEvery = 2, portraitCrop = 1, landscapeCrop = 1 },
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
    .filter((r) => r.anchor !== 'mid' && r.anchor !== 'bottom' && r.anchor !== 'seat')
    .map((r) => ({ ...r, rowStart: 0, rowEnd: r.rowSpan }));
  const mids = norm.filter((r) => r.anchor === 'mid');
  const bottoms = norm.filter((r) => r.anchor === 'bottom');
  // Seats ride every placement pass (placeAll), so a break cut above one
  // moves it with the tiles it follows. The sort is stable: one `at`, the
  // caller's order.
  const seats = norm
    .filter((r) => r.anchor === 'seat')
    .map((r) => ({ ...r, at: Number.isFinite(r.at) ? r.at : showcase.length }))
    .sort((a, b) => a.at - b.at);
  const place = (blocked) => placeAll(showcase, cols, blocked, sizes, resize, seats);

  let laid;
  if (mids.length === 0) {
    laid = place(resolved);
  } else {
    // Pass 1 — natural grid without the mid regions.
    const natural = place(resolved);
    const naturalEnd = Math.max(
      0,
      ...natural.placements.map((p) => p.rowEnd),
      ...natural.seated.map((r) => r.rowEnd),
      ...resolved.map((r) => r.rowEnd)
    );

    // Row boundaries where a tile ends; nearest one to the midpoint wins
    // (ties → higher). Multiple mids stack downward from there.
    const boundaries = [...new Set([0, ...natural.placements.map((p) => p.rowEnd)])].sort(
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
    laid = place(resolved);
  }

  const lim = { sqRows, cap: portraitCrop, wide: landscapeCrop };
  laid = pinBreaks(place, cols, resolved, sqRows, laid, breaks, breakEvery * sqRows, lim);
  const { placements } = laid;
  resolved.push(...laid.seated);

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

  guardedStretch(placements, resolved, totalRows, lim);
  forcedFill(placements, resolved, cols, totalRows, sqRows / 2, lim);

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
