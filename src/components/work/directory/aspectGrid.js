/**
 * aspectGrid — the Project Directory's aspect-aware packer (?dirpack=aspect,
 * SQ-20). Each tile takes its OWN shape at its cell width instead of one of
 * three cell classes (chunkFlushGrid), and the grid still closes flush: no
 * hole rows and a level bottom, with every crop as small as it can be.
 *
 * Spans: one column below a 1.2 ratio, two up to 3, every column from 3 (the
 * banners and wide wordmarks). A tile's rows are its ratio at that width,
 * clamped between a third of a square and two squares.
 *
 * Packing (a skyline): the lowest column (leftmost on a tie) takes the tile,
 * of the next `look` unplaced ones, whose placement costs least: its own crop
 * plus, for a wide tile, the crop that levelling the columns under it adds,
 * and for a one-column tile how far its top lands from its neighbours' (a
 * tile may also snap to a neighbour's height when that crops it least). A
 * tile moves at most `look` places from its list order: the oldest one is
 * placed outright before it would fall further behind.
 *
 * Levelling ("whichever edge will be cropped less", Nathan 11-05): a run of
 * columns is brought to one line by resizing the tiles on top of them.
 * Growing a cell crops the media's sides, shrinking it crops top and bottom;
 * the line is the one whose WORST resized tile crops least, and a column's
 * change is spread one row at a time over its top few one-column tiles, each
 * row to the tile it crops least. Media always cover (a really transparent
 * face contains, fitOf).
 *
 * Chunks: as chunkFlushGrid, so DirectoryGrid mounts media per chunk. A chunk
 * closes once it holds `minTiles` and its skyline levels within CUT_OK; at
 * `maxTiles` it levels where that costs least, handing its last few tiles to
 * the next chunk if that helps. The list's last chunk closes the same way;
 * tiles it can't level are laid as justified bands (spans shared by ratio,
 * one height), which is also how fewer tiles than columns fill the width.
 *
 * Short lists (one chunk's worth, a small filter; Nathan's option b, 11-05):
 * the whole list is also laid as justified bands in list order, split where
 * the squared crop is least, so a short list gets wider tiles; that layout
 * wins when it crops less than the skyline's.
 *
 * Output: chunkFlushGrid's shape. A chunk's placements are in the order
 * placed (the DOM and focus order), each naming its tile by `index` into
 * `items`; [start, end) counts placements, not items.
 */
import { ratioOf } from '../detail/buildContentFlow.js';
import { GRID_ROW_PX } from '../detail/tileGrid.js';

/** The lookahead window's default (?dirlook). */
export const LOOK = 8;
/** A chunk may close once its level costs no more crop than this. */
const CUT_OK = 0.03;
/** One-column tiles: what a top far from both neighbours costs (at a square or more). */
const MISMATCH = 0.04;
/** A tile later in the window costs this much more (the list order, all else equal). */
const ORDER_BIAS = 0.002;
/** A plan's summed crop counts this much beside its worst tile's. */
const SUM_WEIGHT = 0.15;
/** A column's change is spread over at most this many of its top tiles. */
const DEPTH = 6;
/** A logo tile is a canvas (LogoMark places the mark inside it): resizing it barely shows. */
const LOGO_WEIGHT = 0.3;

/** colSpan for a ratio: 1 below 1.2, 2 below 3, every column from 3. */
export function spanOf(ratio, cols) {
  if (ratio >= 3) return cols;
  return Math.min(ratio >= 1.2 ? 2 : 1, cols);
}

/** The crop (or letterbox) share of a ratio-`r` face in a w × h cell. */
export const lossOf = (r, cell) => 1 - Math.min(r, cell) / Math.max(r, cell);

/**
 * @param {Array<Object>} items - tiles in list order (ratioOf reads each)
 * @param {Object} opts
 * @param {number} opts.cols - columns
 * @param {number} opts.width - the grid's width, px
 * @param {number} [opts.gap=2] - the row and column gap, px
 * @param {number} [opts.look=LOOK] - the lookahead window (and the most a tile moves)
 * @param {number} [opts.minTiles=32]
 * @param {number} [opts.maxTiles=64]
 * @returns {Array<{start: number, end: number, placements: Array<Object>, totalRows: number, forced: boolean}>}
 */
export function chunkAspectGrid(items, { cols, width, gap = 2, look = LOOK, minTiles = 32, maxTiles = 64 } = {}) {
  const pitch = GRID_ROW_PX + gap;
  const colW = (width - (cols - 1) * gap) / cols;
  const rowsOf = (px) => Math.max(1, Math.round((px + gap) / pitch));
  const sq = rowsOf(colW);
  const minRows = Math.max(1, Math.ceil(sq / 3));
  const maxRows = 2 * sq;
  const reach = 4 * sq; // the most a column is ever moved by levelling
  const wOf = (s) => s * colW + (s - 1) * gap;
  const hOf = (n) => n * GRID_ROW_PX + (n - 1) * gap;
  const clampRows = (n) => Math.min(maxRows, Math.max(minRows, n));
  const lossAt = (t, n) => t.weight * lossOf(t.r, wOf(t.s) / hOf(n));

  const info = items.map((it, index) => {
    const r = ratioOf(it) || 1;
    return { index, r, span: spanOf(r, cols), weight: it.logo ? LOGO_WEIGHT : 1 };
  });
  const natural = (t, s) => clampRows(rowsOf(wOf(s) / t.r));

  const chunks = [];
  let done = 0; // placements in finished chunks
  const pool = info.map((t) => t.index); // unplaced, in list order
  let placed = []; // this chunk's tiles: { index, r, weight, s, col, rowStart, rowEnd }
  let opener = null; // a wide tile a chunk was closed for: it opens the next one
  let opened = false; // this chunk began with an opener

  /* ── The skyline and what each column can do ── */
  function survey(list) {
    const heights = new Array(cols).fill(0);
    const byCol = Array.from({ length: cols }, () => []);
    for (const t of list) {
      for (let c = t.col; c < t.col + t.s; c++) {
        byCol[c].push(t);
        if (t.rowEnd > heights[c]) heights[c] = t.rowEnd;
      }
    }
    const units = new Array(cols);
    for (let c = 0; c < cols; c++) {
      const col = byCol[c].sort((a, b) => b.rowEnd - a.rowEnd);
      const stack = [];
      for (const t of col) {
        if (t.s !== 1 || stack.length === DEPTH) break;
        stack.push(t);
      }
      if (stack.length) {
        units[c] = { kind: 'flex', cols: [c], h: heights[c], stack, ...curves(stack) };
        continue;
      }
      const top = col[0];
      const free = top && top.rowEnd === heights[c] && [...Array(top.s).keys()].every((k) => heights[top.col + k] === top.rowEnd);
      units[c] = free
        ? { kind: 'group', tile: top, cols: [...Array(top.s).keys()].map((k) => top.col + k), h: heights[c] }
        : { kind: 'fixed', cols: [c], h: heights[c] };
    }
    return { heights, units };
  }

  /* A flex column's cost of moving by ±d rows: one row at a time, each to the
     stack tile it crops least. `path` keeps the order, to apply it. */
  function curves(stack) {
    const walk = (dir) => {
      const rows = stack.map((t) => t.rowEnd - t.rowStart);
      const hit = new Array(stack.length).fill(false);
      const out = [{ worst: 0, sum: 0, path: [] }];
      const path = [];
      for (let d = 1; d <= reach; d++) {
        let best = -1;
        let bestLoss = Infinity;
        for (let i = 0; i < stack.length; i++) {
          const n = rows[i] + dir;
          if (n < minRows) continue;
          const l = lossAt(stack[i], n);
          if (l < bestLoss) {
            bestLoss = l;
            best = i;
          }
        }
        if (best < 0) break;
        rows[best] += dir;
        hit[best] = true;
        path.push(best);
        let worst = 0;
        let sum = 0;
        for (let i = 0; i < stack.length; i++) {
          if (!hit[i]) continue;
          const l = lossAt(stack[i], rows[i]);
          worst = Math.max(worst, l);
          sum += l;
        }
        out.push({ worst, sum, path: path.slice() });
      }
      return out;
    };
    return { up: walk(1), down: walk(-1) };
  }

  /* What moving one unit by d rows costs (null: it can't). */
  function unitCost(u, d) {
    if (d === 0) return { worst: 0, sum: 0 };
    if (u.kind === 'fixed') return null;
    if (u.kind === 'group') {
      const n = u.tile.rowEnd - u.tile.rowStart + d;
      if (n < minRows || Math.abs(d) > reach) return null;
      const l = lossAt(u.tile, n);
      return { worst: l, sum: l };
    }
    return (d > 0 ? u.up : u.down)[Math.abs(d)] ?? null;
  }

  /* The cheapest line for columns `want` (and every column a wide tile on top
     of them ties in): { L, worst, sum, units } or null. */
  function levelPlan(sv, want) {
    const units = [];
    const seen = new Set();
    const queue = [...want];
    while (queue.length) {
      const c = queue.pop();
      if (seen.has(c)) continue;
      const u = sv.units[c];
      for (const k of u.cols) seen.add(k);
      units.push(u);
      for (const k of u.cols) if (!seen.has(k)) queue.push(k);
    }
    const hs = units.map((u) => u.h);
    let lo = Math.min(...hs);
    let hi = Math.max(...hs);
    const fixed = units.filter((u) => u.kind === 'fixed');
    if (fixed.length) {
      if (fixed.some((u) => u.h !== fixed[0].h)) return null;
      lo = hi = fixed[0].h;
    } else {
      lo = Math.max(lo - sq, 0); // shrinking the tall columns may crop least
    }
    let best = null;
    for (let L = hi; L >= lo; L--) {
      let worst = 0;
      let sum = 0;
      let ok = true;
      for (const u of units) {
        const k = unitCost(u, L - u.h);
        if (!k) {
          ok = false;
          break;
        }
        worst = Math.max(worst, k.worst);
        sum += k.sum;
      }
      if (!ok) continue;
      if (!best || worst < best.worst - 1e-9 || (Math.abs(worst - best.worst) <= 1e-9 && sum < best.sum - 1e-9)) {
        best = { L, worst, sum, units };
      }
    }
    return best;
  }

  /* Apply a plan: resize and re-stack the units' top tiles to its line. */
  function applyPlan(plan) {
    for (const u of plan.units) {
      const d = plan.L - u.h;
      if (!d) continue;
      if (u.kind === 'group') {
        u.tile.rowEnd += d;
        continue;
      }
      const steps = (d > 0 ? u.up : u.down)[Math.abs(d)].path;
      const rows = u.stack.map((t) => t.rowEnd - t.rowStart);
      for (const i of steps) rows[i] += Math.sign(d);
      // the stack runs top-down; rebuild it bottom-up from its lowest tile's start
      let at = u.stack[u.stack.length - 1].rowStart;
      for (let i = u.stack.length - 1; i >= 0; i--) {
        u.stack[i].rowStart = at;
        u.stack[i].rowEnd = at + rows[i];
        at += rows[i];
      }
    }
  }

  /* The candidates for one tile at the lowest column c0. */
  function candidates(t, sv, c0, forced) {
    const { heights } = sv;
    const out = [];
    if (t.span === 1) {
      const n0 = natural(t, 1);
      const tryRows = new Set([n0]);
      for (const nb of [c0 - 1, c0 + 1]) {
        if (nb < 0 || nb >= cols) continue;
        const n = heights[nb] - heights[c0];
        if (n >= minRows && n <= maxRows) tryRows.add(n);
      }
      for (const n of tryRows) {
        const top = heights[c0] + n;
        let gapTo = Infinity;
        for (const nb of [c0 - 1, c0 + 1]) if (nb >= 0 && nb < cols) gapTo = Math.min(gapTo, Math.abs(top - heights[nb]));
        const mis = gapTo === Infinity ? 0 : MISMATCH * Math.min(1, gapTo / sq);
        out.push({ cost: lossAt({ ...t, s: 1 }, n) + mis, s: 1, col: c0, n });
      }
      return out;
    }
    const s = t.span;
    const n = natural(t, s);
    const own = lossAt({ ...t, s }, n);
    for (let x = Math.max(0, c0 - s + 1); x <= Math.min(c0, cols - s); x++) {
      const plan = levelPlan(sv, [...Array(s).keys()].map((k) => x + k));
      if (!plan) continue;
      out.push({ cost: Math.max(own, plan.worst) + SUM_WEIGHT * plan.sum, s, col: x, n, plan });
    }
    if (forced) {
      // it can't wait: one column at its clamped height is the other way
      const n1 = natural(t, 1);
      out.push({ cost: lossAt({ ...t, s: 1 }, n1), s: 1, col: c0, n: n1 });
    }
    return out;
  }

  function placeNext() {
    const sv = survey(placed);
    const { heights } = sv;
    let c0 = 0;
    for (let c = 1; c < cols; c++) if (heights[c] < heights[c0]) c0 = c;
    const p = done + placed.length;
    const i0 = pool[0];
    const mustPlace = p - i0 >= look - 1;
    const forced = mustPlace || opener != null;
    const window = opener != null ? [opener] : mustPlace ? [i0] : pool.slice(0, look);
    if (!placed.length) opened = opener != null;
    opener = null;
    let best = null;
    window.forEach((idx, rank) => {
      for (const cand of candidates(info[idx], sv, c0, forced)) {
        const cost = cand.cost + ORDER_BIAS * rank;
        if (!best || cost < best.cost - 1e-9) best = { ...cand, cost, idx };
      }
    });
    if (!best) {
      // every wide tile in the window is blocked: the oldest goes now, forced
      for (const cand of candidates(info[i0], sv, c0, true)) if (!best || cand.cost < best.cost) best = { ...cand, idx: i0 };
    }
    if (best.idx === i0 && info[i0].span > 1 && best.cost > CUT_OK && placed.length) {
      // a wide tile that can't wait and has no level line here: closing the
      // chunk may crop less, and it then opens the next one on a flat line
      // (all of it may go back only for a full-width tile, which then fills a
      // fresh chunk's first row, and never from a chunk an opener started)
      const shut = closeChoice(false, info[i0].span === cols && !opened, i0);
      if (shut && shut.score < best.cost) {
        applyClose(shut, false);
        opener = i0;
        return;
      }
    }
    if (best.plan) applyPlan(best.plan);
    const rowStart = best.plan ? best.plan.L : heights[best.col];
    const t = info[best.idx];
    placed.push({ index: t.index, r: t.r, weight: t.weight, s: best.s, col: best.col, rowStart, rowEnd: rowStart + best.n });
    pool.splice(pool.indexOf(best.idx), 1);
  }

  /* Justified bands for tiles a level couldn't take (and fewer tiles than
     columns): as many bands as keep each near a square tall, each sharing the
     columns by ratio at the one height (up to four squares) that crops its
     worst tile least. */
  function bands(list, from) {
    const out = [];
    let worst = 0;
    let sum = 0;
    let at = from;
    const sumR = list.reduce((s, t) => s + t.r, 0);
    const nb = Math.min(list.length, Math.max(Math.ceil(list.length / cols), Math.round((sumR * colW) / width)));
    for (let b = 0; b < nb; b++) {
      const band = list.slice(Math.round((b * list.length) / nb), Math.round(((b + 1) * list.length) / nb));
      const spans = band.map(() => 1);
      for (let left = cols - band.length; left > 0; left--) {
        let k = 0;
        for (let i = 1; i < band.length; i++) if (band[i].r / spans[i] > band[k].r / spans[k]) k = i;
        spans[k]++;
      }
      let bestN = minRows;
      let bestW = Infinity;
      for (let n = minRows; n <= 2 * maxRows; n++) {
        const w = Math.max(...band.map((t, i) => lossAt({ ...t, s: spans[i] }, n)));
        if (w < bestW - 1e-9) {
          bestW = w;
          bestN = n;
        }
      }
      let col = 0;
      band.forEach((t, i) => {
        const l = lossAt({ ...t, s: spans[i] }, bestN);
        sum += l;
        out.push({ index: t.index, r: t.r, weight: t.weight, s: spans[i], col, rowStart: at, rowEnd: at + bestN });
        col += spans[i];
      });
      worst = Math.max(worst, bestW);
      at += bestN;
    }
    return { tiles: out, worst, sum, rows: at };
  }

  /* Close the chunk: level it, after handing back (`last`: laying as bands)
     the k tiles whose removal makes the cheapest level. */
  function close(last) {
    const best = closeChoice(last);
    // nothing levels with ≤ cols handed back: bands take the rest (k = all always can)
    if (!best) return close(true);
    applyClose(best, last);
  }

  /* `all`: every tile may go back (a wide tile then opens the chunk afresh).
     `after`: only tiles later in the list than it may go back, so the opener
     placed first takes nobody's turn (each tile still moves at most `look`). */
  function closeChoice(last, all = false, after = -1) {
    const kMax = last ? placed.length : Math.min(placed.length - (all ? 0 : 1), cols);
    let best = null;
    for (let k = 0; k <= kMax; k++) {
      if (k && placed[placed.length - k].index < after) break;
      const keep = placed.slice(0, placed.length - k);
      const plan = keep.length ? levelPlan(survey(keep), [...Array(cols).keys()]) : { L: 0, worst: 0, sum: 0, units: [] };
      if (!plan) continue;
      let worst = plan.worst;
      let sum = plan.sum;
      if (last && k) {
        const b = bands(placed.slice(placed.length - k).map((t) => info[t.index]), plan.L);
        worst = Math.max(worst, b.worst);
        sum += b.sum;
      }
      const score = worst + SUM_WEIGHT * sum + 0.001 * k;
      if (!best || score < best.score - 1e-9) best = { k, plan, score };
    }
    return best;
  }

  function applyClose({ k, plan }, last) {
    const full = placed.length >= maxTiles;
    const back = placed.splice(placed.length - k, k);
    applyPlan(plan); // its units hold the kept tiles themselves
    let totalRows = plan.L;
    if (k && last) {
      const b = bands(back.map((t) => info[t.index]), plan.L);
      placed.push(...b.tiles);
      totalRows = b.rows;
    } else if (k) {
      pool.push(...back.map((t) => t.index));
      pool.sort((a, b) => a - b);
    }
    if (placed.length) finish(totalRows, full); // (all handed back: the chunk starts over)
  }

  function finish(totalRows, forced) {
    chunks.push({
      start: done,
      end: done + placed.length,
      totalRows,
      forced,
      placements: placed.map((t) => ({
        index: t.index,
        col: t.col,
        colSpan: t.s,
        rowStart: t.rowStart,
        rowEnd: t.rowEnd,
        type: t.s > 1 ? 'landscape' : t.r < 0.9 ? 'portrait' : 'square',
        cell: wOf(t.s) / hOf(t.rowEnd - t.rowStart),
      })),
    });
    done += placed.length;
    placed = [];
  }

  /* A short list (one chunk's worth, a small filter) may do better as
     justified bands in list order: every tile wider, the whole list one
     chunk. The bands are the cheapest split by squared crop (so one bad crop
     costs more than several small ones); each band's spans are the split of
     the columns, and its height the one, up to four squares, that crops it
     least. */
  const penalty = (t, s, n) => lossAt({ ...t, s }, n) ** 2;
  function bandCost(band) {
    let best = null;
    const spans = new Array(band.length);
    const split = (i, left) => {
      if (i === band.length - 1) {
        spans[i] = left;
        for (let n = minRows; n <= 2 * maxRows; n++) {
          let cost = 0;
          for (let k = 0; k < band.length; k++) cost += penalty(band[k], spans[k], n);
          if (!best || cost < best.cost - 1e-12) best = { cost, n, spans: spans.slice() };
        }
        return;
      }
      for (let s = 1; s <= left - (band.length - 1 - i); s++) {
        spans[i] = s;
        split(i + 1, left - s);
      }
    };
    split(0, cols);
    return best;
  }
  function justify() {
    const n = info.length;
    const cost = new Array(n + 1).fill(Infinity);
    const from = new Array(n + 1);
    cost[0] = 0;
    for (let i = 1; i <= n; i++) {
      for (let k = 1; k <= Math.min(cols, i); k++) {
        const b = bandCost(info.slice(i - k, i));
        if (cost[i - k] + b.cost < cost[i]) {
          cost[i] = cost[i - k] + b.cost;
          from[i] = { k, b };
        }
      }
    }
    const rows = [];
    for (let i = n; i > 0; i -= from[i].k) rows.unshift({ at: i - from[i].k, ...from[i] });
    const tiles = [];
    let at = 0;
    for (const { at: i0, k, b } of rows) {
      let col = 0;
      for (let j = 0; j < k; j++) {
        const t = info[i0 + j];
        tiles.push({ index: t.index, r: t.r, weight: t.weight, s: b.spans[j], col, rowStart: at, rowEnd: at + b.n });
        col += b.spans[j];
      }
      at += b.n;
    }
    return { tiles, rows: at, cost: cost[n] };
  }

  while (pool.length) {
    placeNext();
    if (!pool.length) break;
    if (placed.length >= minTiles) {
      const plan = levelPlan(survey(placed), [...Array(cols).keys()]);
      if (plan && plan.worst <= CUT_OK) {
        applyPlan(plan);
        finish(plan.L, false);
        continue;
      }
    }
    if (placed.length >= maxTiles) close(false);
  }
  if (placed.length) close(true);

  if (info.length > 1 && info.length <= maxTiles) {
    let skyline = 0;
    for (const ch of chunks) {
      for (const p of ch.placements) skyline += (info[p.index].weight * lossOf(info[p.index].r, p.cell)) ** 2;
    }
    const j = justify();
    if (j.cost < skyline - 1e-12) {
      chunks.length = 0;
      done = 0;
      placed = j.tiles;
      finish(j.rows, false);
    }
  }
  return chunks;
}
