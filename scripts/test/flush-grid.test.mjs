// flushGrid: the detail grid's placement (unchanged — a snapshot), any column
// count, and chunkFlushGrid at directory scale.
//   node --test scripts/test/flush-grid.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  computeFlushGrid,
  chunkFlushGrid,
  classifyTile,
  leastCropTile,
  tileClassOf,
  TILE_RATIO,
  splitAtBreaks,
  PORTRAIT_CROP,
  LANDSCAPE_CROP,
} from '../../src/components/work/detail/flushGrid.js'
import { cropLoss, sequenceRatio } from '../../src/lib/mediaSequence.js'

const rng = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
// A tile with no mediaType: ratioOf reads its dimensions and it takes the label
// edges (classifyTile). `_other` tiles (leastCropTile) are built with otherTile.
const tile = (i, ratio) => ({ _id: `a${i}`, imageDimensions: { width: Math.round(1000 * ratio), height: 1000 } })
const otherTile = (i, ratio) => ({ ...tile(i, ratio), mediaType: 'static_other' })
const RATIOS = [9 / 16, 4 / 5, 3 / 4, 1, 1.14, 4 / 3, 3 / 2, 16 / 9, 2, 4.77]
const seeded = (n, seed) => {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => tile(i, RATIOS[Math.floor(r() * RATIOS.length)]))
}
// The live directory's tile shapes in its default order (production, 11-03:
// 709 tiles — P portrait, S square, L landscape), so the cut rate is tested
// on the real mix, not only on noise.
const LIVE_MIX = [
  'LPPLLPPLLLLPPPLSSLSPPPPPLPSSSSPSSSSSSSSLSLPPLPLLSSLPPPPPLSLPPLLPPPPPPPPSSSSLLPLLLLLPSSPPLLPLLLLPSSLL',
  'LPPPPPPPPPPPPPPLLPPPSPLSPPPPPPPSPLPPPPPPPPPPPPLPSSSSPPSSSSSSPPPPLSPPLLLLLLLLPPLLLLLLLLPPPPPPPPPPPLPL',
  'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSLPPPPPPPPPPPPPPPPPPSSPPPPPPPPPPPSSSSPPSSSSPPLLLLPPPLPSPPSPLPPPPPLSP',
  'SLSSSSSSSSSSSSSSSSSSSSPSLPPPPSSSSPPLSSSPSSPPLLPSPPPPPLPPLSSSLPPSPLLLSSSSPLLSLLPPPPLLSPPPPPLSSPPPPPSP',
  'SPPPSPPPSPSPSPPPSPSPSPSPSPSSPSPSPSPSPSSPSSSSSSSPPSPSSPSPPSPSPPPSPLLPPSLSSPSSSSSSSSSSSSSPLLLPPPPPPPLP',
  'SPLSSLPPSLLPPPPPPSSLSPSLPPPPPPPPPPPSPPPPLPSSLPPPPSPSSSSSSSSSSSLLLLLLLPSLPPPPPPPPPPPPPPPPPPPSPPPPPPPP',
  'PPLSSLSSLSSLLPSSPLLLLLLLLPPSSPSLSPSPSPSPSSSLLSPSSPSPPSSLPSSLSSSSSSSSSSSSSSPPSSPPPPPPPPPPPPPPPLLSSPPP',
  'SPPPPPPPP',
].join('')
const liveItems = () => [...LIVE_MIX].map((t, i) => tile(i, { P: 0.5, S: 1, L: 16 / 9 }[t]))
// Row spans as tileRowsFor gives them at 1440 / 1024 / 390 (2px gap).
const WIDTHS = [
  { cols: 3, sqRows: 40, lsRows: 40 },
  { cols: 2, sqRows: 43, lsRows: 43 },
  { cols: 1, sqRows: 33, lsRows: 16 },
]
const ORBIT = { id: 'orbit', colStart: 0, colSpan: 3, rowSpan: 34, anchor: 'top' }
const DECK = (anchor) => ({ id: 'deck', colStart: 0, colSpan: 3, rowSpan: 68, anchor })
const SOLO = { id: 'deck-solo:sa', colStart: 0, colSpan: 3, rowSpan: 68, anchor: 'bottom' }
const BANNER = { id: 'banner:sc', colStart: 0, colSpan: 3, rowSpan: 38, anchor: 'bottom' }

const shares = (a, b) => a.col < b.col + b.colSpan && b.col < a.col + a.colSpan
const rowOverlap = (a, b) => Math.min(a.rowEnd, b.rowEnd) - Math.max(a.rowStart, b.rowStart)

/** The grid invariants: in bounds, no overlap past a bounded underlay, regions untouched. */
function assertValid({ placements, regions = [], totalRows }, { cols, sqRows }, where) {
  for (const p of placements) {
    assert.ok(p.col >= 0 && p.col + p.colSpan <= cols, `${where}: tile outside the columns`)
    assert.ok(p.rowStart >= 0 && p.rowEnd <= totalRows && p.rowEnd > p.rowStart, `${where}: tile outside the rows`)
    for (const r of regions) {
      const rr = { col: r.colStart, colSpan: r.colSpan, rowStart: r.rowStart, rowEnd: r.rowEnd }
      assert.ok(!(shares(p, rr) && rowOverlap(p, rr) > 0), `${where}: tile over region ${r.id}`)
    }
  }
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const a = placements[i], b = placements[j]
      if (!shares(a, b) || rowOverlap(a, b) <= 0) continue
      assert.ok(a.underlay || b.underlay, `${where}: tiles ${i} and ${j} overlap with neither an underlay`)
      assert.ok(rowOverlap(a, b) <= sqRows / 2, `${where}: underlay ${rowOverlap(a, b)} rows deep (bound ${sqRows / 2})`)
    }
  }
}

/** Rows of each column no tile or region covers, between 0 and totalRows. */
function openRows({ placements, regions = [], totalRows }, cols) {
  let open = 0
  for (let c = 0; c < cols; c++) {
    const iv = [
      ...placements.filter((p) => p.col <= c && c < p.col + p.colSpan).map((p) => [p.rowStart, p.rowEnd]),
      ...regions.filter((r) => r.colStart <= c && c < r.colStart + r.colSpan).map((r) => [r.rowStart, r.rowEnd]),
    ].sort((a, b) => a[0] - b[0])
    let cursor = 0
    for (const [s, e] of iv) {
      if (s > cursor) open += s - cursor
      cursor = Math.max(cursor, e)
    }
    if (totalRows > cursor) open += totalRows - cursor
  }
  return open
}

test('classifyTile: the portrait / square / landscape edges', () => {
  assert.equal(classifyTile(1.2), 'landscape')
  assert.equal(classifyTile(1.1999), 'square')
  assert.equal(classifyTile(0.9), 'square')
  assert.equal(classifyTile(0.8999), 'portrait')
  assert.equal(classifyTile(4.77), 'landscape')
})

test('an _other asset takes the class that crops it least (a tall, a wide and a near-square ratio); bucketed ones keep the label edges (11-12)', () => {
  // tall: 0.55 is near the 1:2 portrait (loss 0.09, a square's 0.45)
  assert.equal(tileClassOf(otherTile(0, 0.55)), 'portrait')
  // wide: 3:1 is nearer the 2:1 landscape (loss 0.33, a square's 0.67)
  assert.equal(tileClassOf(otherTile(0, 3)), 'landscape')
  // near-square: 1.3 loses 0.23 in a square, 0.35 in a landscape; the label edge (1.2) says landscape
  assert.equal(tileClassOf(otherTile(0, 1.3)), 'square')
  assert.equal(classifyTile(1.3), 'landscape')
  // and 0.85 (label: portrait) loses 0.15 in a square, 0.41 in a portrait
  assert.equal(tileClassOf(otherTile(0, 0.85)), 'square')
  assert.equal(classifyTile(0.85), 'portrait')
  // a bucketed asset (no _other label) keeps classifyTile at the same ratios
  assert.equal(tileClassOf(tile(0, 1.3)), 'landscape')
  assert.equal(tileClassOf(tile(0, 0.85)), 'portrait')
  // the edges are the shapes' geometric middles, √½ and √2
  assert.equal(leastCropTile(Math.SQRT1_2 - 0.001), 'portrait')
  assert.equal(leastCropTile(Math.SQRT1_2 + 0.001), 'square')
  assert.equal(leastCropTile(Math.SQRT2 - 0.001), 'square')
  assert.equal(leastCropTile(Math.SQRT2 + 0.001), 'landscape')
  // it is the lowest cropLoss of the three shapes, for every ratio on a sweep
  for (let r = 0.2; r <= 6; r += 0.013) {
    const best = Math.min(...Object.values(TILE_RATIO).map((s) => cropLoss(r, s)))
    assert.ok(Math.abs(cropLoss(r, TILE_RATIO[leastCropTile(r)]) - best) < 1e-9, `ratio ${r}`)
  }
  // a sequence counts when a frame is _other; its own ratio is the least-crop tile of the set
  const seq = { ...tile(0, 1.3), mediaType: 'static_4x5', frames: [tile(1, 1.3), otherTile(2, 1.3)], sequenceRatio: sequenceRatio([1.3, 1.3]) }
  assert.equal(tileClassOf(seq), 'square')
})

test('cropLoss: 0 at the same shape, symmetric in the pair, and the cost sequenceRatio sums', () => {
  assert.equal(cropLoss(2, 2), 0)
  assert.equal(cropLoss(4, 2), cropLoss(2, 4))
  assert.equal(cropLoss(1, 2), 0.5)
  assert.equal(sequenceRatio([1, 2, 2]), 2)
})

test('an _other mix in the bands where the pick differs from classifyTile still lays out valid and deterministic', () => {
  // Ratios in [0.707, 0.9) and [1.2, 1.414). Whether a given mix closes flush is the packer's own luck
  // (the same for any class mix); the real-asset hole comparison lives in the ticket's probe evidence.
  for (const w of WIDTHS) {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const rnd = rng(seed)
      const items = Array.from({ length: 60 }, (_, i) => {
        const r = rnd()
        // a mix: bucketed shapes with a few in-between _other ones
        if (r < 0.3) return otherTile(i, 0.72 + rnd() * 0.17)
        if (r < 0.6) return otherTile(i, 1.2 + rnd() * 0.2)
        return tile(i, RATIOS[Math.floor(rnd() * RATIOS.length)])
      })
      const out = computeFlushGrid(items, { cols: w.cols, sqRows: w.sqRows, lsRows: w.lsRows })
      assertValid(out, w, `${w.cols} cols, seed ${seed}`)
      assert.deepEqual(computeFlushGrid(items, { cols: w.cols, sqRows: w.sqRows, lsRows: w.lsRows }), out, 'deterministic')
      // placed in the class it was picked for, or (SQ-82) demoted to one square cell
      out.placements.forEach((p, i) => {
        if (p.type === tileClassOf(items[i])) return
        assert.ok(p.type === 'square' && p.colSpan === 1 && p.rowEnd - p.rowStart === w.sqRows, `${w.cols} cols, seed ${seed}: tile ${i} is neither its class nor one square cell`)
      })
    }
  }
})

test("the detail page's call is unchanged (snapshot of the 3-column placement, 11-03)", () => {
  // [tiles, seed, regions, sqRows] → the sha256 prefix of the whole result,
  // recorded from the code before columns and chunks were added. Re-taken
  // 11-04 at the v1-launch merge: domIndex moved off computeFlushGrid's
  // regions onto splitAtBreaks's sockets (the description bands), so every
  // case with a region changed hash. Placements, totalRows and the rest of
  // each region matched the old code, and `dom` pins the socket order
  // splitAtBreaks gives a grid without breaks: the old domIndex.
  // Re-taken 11-13 (SQ-82): two cases (12 tiles seed 2, 50 tiles seed 10) left
  // 80 and 40 rows open under a 4:5 portrait stretched 1 × 3; it now takes one
  // square cell and both close flat (0 open rows, same totalRows). The other
  // ten hashes are the old ones.
  const CASES = [
    [5, 1, [], 40, '1aab82f598ead89d', ''],
    [12, 2, [ORBIT], 40, '8853341d6a7ba680', '0'],
    [24, 3, [ORBIT, DECK('mid')], 40, 'ef56ae67328468e3', '0,12'],
    [36, 4, [DECK('top')], 40, '4794a39d2b68b773', '0'],
    [18, 5, [SOLO, BANNER], 40, '7ffe7b87da977bfd', '18,18'],
    [60, 6, [ORBIT, DECK('mid'), SOLO, BANNER], 40, '2fb3f79b89bc1aa3', '0,26,60,60'],
    [30, 7, [], 24, 'e7602e06ca3c1d66', ''],
    [44, 8, [ORBIT], 33, '01f48369cbf25ed4', '0'],
    [9, 9, [BANNER], 52, '9109c438c7107bbe', '9'],
    [50, 10, [DECK('top'), SOLO], 40, '424a6e83b4d37038', '0,50'],
    [1, 11, [ORBIT], 40, '689545a4433329f1', '0'],
    [0, 12, [ORBIT, DECK('mid')], 40, 'da03f93c748e23d3', '0,0'],
  ]
  for (const [n, seed, regions, sqRows, want, dom] of CASES) {
    const out = computeFlushGrid(seeded(n, seed), { regions, sqRows })
    const got = createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0, 16)
    const where = `${n} tiles, seed ${seed}, ${regions.map((r) => r.id).join('+') || 'no regions'}`
    assert.equal(got, want, where)
    const [seg, ...rest] = splitAtBreaks(out)
    assert.equal(rest.length, 0, `${where}: one segment`)
    assert.equal(seg.sockets.map((s) => s.domIndex).join(','), dom, `${where}: socket order`)
  }
})

test('the detail-shaped grids hold the invariants, regions included', () => {
  for (const [n, seed, regions] of [[24, 3, [ORBIT, DECK('mid')]], [60, 6, [ORBIT, DECK('mid'), SOLO, BANNER]], [50, 10, [DECK('top'), SOLO]]]) {
    const out = computeFlushGrid(seeded(n, seed), { regions, sqRows: 40 })
    assertValid(out, { cols: 3, sqRows: 40 }, `seed ${seed}`)
  }
})

test('1, 2 and 3 columns: valid, deterministic — a landscape spans min(2, cols)', () => {
  for (const w of WIDTHS) {
    for (const seed of [21, 22, 23]) {
      const items = seeded(80, seed)
      const out = computeFlushGrid(items, w)
      assertValid(out, w, `${w.cols} cols, seed ${seed}`)
      // One column can't leave a hole. At 2–3 a list's last rows can keep
      // one: the flush declines an underlay deeper than half a square (the
      // detail page's documented ragged edge).
      if (w.cols === 1) assert.equal(openRows(out, 1), 0, `seed ${seed}: open rows`)
      assert.deepEqual(computeFlushGrid(items, w), out, 'deterministic')
      for (const p of out.placements.filter((q) => q.type === 'landscape')) {
        assert.equal(p.colSpan, Math.min(2, w.cols))
      }
    }
  }
  // One column: a landscape takes its own row count, not a square's.
  const one = computeFlushGrid([tile(0, 16 / 9)], { cols: 1, sqRows: 33, lsRows: 16 })
  assert.equal(one.placements[0].rowEnd - one.placements[0].rowStart, 16)
})

test('chunkFlushGrid: chunks partition the list in order, each under maxRows', () => {
  for (const w of WIDTHS) {
    for (const [n, seed] of [[0, 1], [7, 2], [33, 3], [200, 4], [705, 5]]) {
      const items = seeded(n, seed)
      const chunks = chunkFlushGrid(items, w)
      let at = 0
      for (const c of chunks) {
        assert.equal(c.start, at, 'contiguous')
        assert.ok(c.end > c.start, 'non-empty')
        assert.equal(c.placements.length, c.end - c.start, 'placements align with the slice')
        assert.ok(c.totalRows <= 6000, `chunk of ${c.totalRows} rows`)
        assertValid(c, w, `${w.cols} cols, ${n} tiles, chunk ${c.start}`)
        at = c.end
      }
      assert.equal(at, n, 'every tile placed once')
      assert.deepEqual(chunkFlushGrid(items, w), chunks, 'deterministic')
    }
  }
  // A tight row budget cuts early (before the tile that overruns) and marks it.
  const tight = chunkFlushGrid(seeded(100, 9), { cols: 3, sqRows: 40, maxRows: 400 })
  assert.ok(tight.every((c) => c.totalRows <= 400))
  assert.ok(tight.some((c) => c.forced))
})

test('natural cuts stack into the single grid, row for row', () => {
  for (const w of WIDTHS) {
    for (const items of [liveItems(), seeded(705, 6)]) {
      const chunks = chunkFlushGrid(items, w)
      // Up to the first forced cut, the chunks are the one grid cut at flat rows.
      const firstForced = chunks.findIndex((c) => c.forced)
      const natural = firstForced === -1 ? chunks : chunks.slice(0, firstForced)
      const end = natural.length ? natural[natural.length - 1].end : 0
      const single = computeFlushGrid(items.slice(0, end), w)
      let offset = 0
      const stacked = natural.flatMap((c) => {
        const shifted = c.placements.map((p) => ({ ...p, rowStart: p.rowStart + offset, rowEnd: p.rowEnd + offset }))
        offset += c.totalRows
        return shifted
      })
      assert.deepEqual(stacked, single.placements, `${w.cols} cols`)
      assert.equal(offset, single.totalRows)
      // A natural cut is a flat row: everything above it is covered.
      for (const c of natural.filter((x) => x.end < items.length)) {
        assert.equal(openRows(c, w.cols), 0, 'a natural chunk is full')
      }
    }
  }
})

test('the live mix: forced cuts stay at or under 10%, and nothing is left open', () => {
  for (const w of WIDTHS) {
    const items = liveItems()
    const chunks = chunkFlushGrid(items, w)
    for (const c of chunks) assert.equal(openRows(c, w.cols), 0, `${w.cols} cols: chunk ${c.start} open rows`)
    const cuts = chunks.length - 1
    const forced = chunks.filter((c) => c.forced).length
    assert.ok(forced <= Math.floor(0.1 * cuts), `${w.cols} cols: ${forced} of ${cuts} cuts forced`)
  }
})

/* ── SQ-78: square album art always renders square (Nathan 11-13, every client) ── */
const cover = (i) => ({ _id: `c${i}`, mediaType: 'album-art' })
const SQ = 40
/** Every cover sits in a square box: 1×1, or 2×2 (two columns, two squares' rows). */
function assertCoversSquare(placements, items, where) {
  placements.forEach((p, i) => {
    if (items[i].mediaType !== 'album-art') return
    assert.ok(p.colSpan === 1 || p.colSpan === 2, `${where}: cover ${i} spans ${p.colSpan} columns`)
    assert.equal(p.rowEnd - p.rowStart, p.colSpan * SQ, `${where}: cover ${i} is ${p.colSpan} col × ${(p.rowEnd - p.rowStart) / SQ} sq`)
    assert.ok(!p.underlay, `${where}: cover ${i} is an underlay`)
  })
}
/** Whether n covers can close flat in `cols` columns with up to three 2×2s:
 *  each adds three squares of area, the rows must come out whole, and the
 *  2×2s must fit side by side in row pairs (the 1×1s fill any rest). */
const flatExists = (n, cols) =>
  [0, 1, 2, 3].some((p) => {
    const area = n + 3 * p
    const rows = area / cols
    return p <= n && area % cols === 0 && p <= Math.floor(rows / 2) * Math.floor(cols / 2)
  })

test("Nathan's Gruuv case: 15 covers at 6 columns close flat with one 2×2, none cropped to 1×2", () => {
  const items = Array.from({ length: 15 }, (_, i) => cover(i))
  for (const out of [computeFlushGrid(items, { cols: 6, sqRows: SQ }), chunkFlushGrid(items, { cols: 6, sqRows: SQ })[0]]) {
    assertCoversSquare(out.placements, items, '15 @ 6')
    assert.equal(out.placements.filter((p) => p.colSpan === 2).length, 1, 'one 2×2')
    assert.equal(openRows(out, 6), 0, 'flush bottom')
    assert.equal(out.totalRows, 3 * SQ, '15 + 3 = 18 squares = 3 full rows')
  }
})

test('1–20 covers at 2, 4, 5 and 6 columns: always square, flat wherever a square-preserving fill exists', () => {
  for (const cols of [2, 4, 5, 6]) {
    for (let n = 1; n <= 20; n++) {
      const items = Array.from({ length: n }, (_, i) => cover(i))
      const out = computeFlushGrid(items, { cols, sqRows: SQ })
      const where = `${n} covers @ ${cols}`
      assertCoversSquare(out.placements, items, where)
      assertValid(out, { cols, sqRows: SQ }, where)
      if (flatExists(n, cols)) assert.equal(openRows(out, cols), 0, `${where}: flat`)
      const [chunk, ...rest] = chunkFlushGrid(items, { cols, sqRows: SQ })
      assert.equal(rest.length, 0, `${where}: one chunk`)
      assert.deepEqual(chunk.placements, out.placements, `${where}: the directory places as the detail grid`)
    }
  }
})

test('covers mixed with portraits, landscapes and plain squares stay square on both surfaces', () => {
  const kind = { A: cover, P: (i) => tile(i, 0.5), L: (i) => tile(i, 16 / 9), S: (i) => tile(i, 1) }
  for (const cols of [2, 4, 5, 6]) {
    for (let seed = 1; seed <= 12; seed++) {
      for (let n = 1; n <= 20; n++) {
        const r = rng(seed * 100 + n)
        const items = Array.from({ length: n }, (_, i) => kind['AAAPPLS'[Math.floor(r() * 7)]](i))
        const out = computeFlushGrid(items, { cols, sqRows: SQ })
        const where = `${n} mixed @ ${cols}, seed ${seed}`
        assertCoversSquare(out.placements, items, where)
        assertValid(out, { cols, sqRows: SQ }, where)
        assert.deepEqual(computeFlushGrid(items, { cols, sqRows: SQ }), out, `${where}: deterministic`)
      }
    }
    // Directory scale: every chunk keeps its covers square.
    const r = rng(cols)
    const long = Array.from({ length: 240 }, (_, i) => kind['AAAPPLS'[Math.floor(r() * 7)]](i))
    for (const c of chunkFlushGrid(long, { cols, sqRows: SQ })) {
      assertCoversSquare(c.placements, long.slice(c.start, c.end), `${cols} cols, chunk ${c.start}`)
      assertValid(c, { cols, sqRows: SQ }, `${cols} cols, chunk ${c.start}`)
    }
  }
})

test('non-album squares still stretch as before; where no square fill exists the gap stays or a neighbour stretches', () => {
  // 15 plain squares at 6 columns: the three over the short last row stretch to 1 × 2 sq, as today.
  const plain = Array.from({ length: 15 }, (_, i) => tile(i, 1))
  const out = computeFlushGrid(plain, { cols: 6, sqRows: SQ })
  assert.equal(out.placements.filter((p) => p.rowEnd - p.rowStart === 2 * SQ).length, 3)
  assert.ok(out.placements.every((p) => p.colSpan === 1))

  // 4 covers at 3 columns: 4 + 3p never makes whole rows of 3 and no 2×2
  // closes the gap, so the covers stay 1×1 and two squares stay open (the
  // accepted ragged edge), where the old flush cropped two covers to 1 × 2.
  const four = Array.from({ length: 4 }, (_, i) => cover(i))
  const f = computeFlushGrid(four, { cols: 3, sqRows: SQ })
  assertCoversSquare(f.placements, four, '4 @ 3')
  assert.ok(f.placements.every((p) => p.colSpan === 1), 'nothing promotes')
  assert.equal(openRows(f, 3), 2 * SQ, 'two squares stay open')

  // Swap the last cover for a plain square: a 2×2 cover plus the plain
  // square stretching over its short column closes it flat.
  const mix = [cover(0), cover(1), cover(2), tile(3, 1)]
  const m = computeFlushGrid(mix, { cols: 3, sqRows: SQ })
  assertCoversSquare(m.placements, mix, 'mix @ 3')
  assert.ok(m.placements[3].rowEnd - m.placements[3].rowStart > SQ, 'the plain square stretches')
  assert.equal(openRows(m, 3), 0, 'flat')

  // One column: no 2×2 exists, every cover stays 1×1.
  const one = computeFlushGrid([cover(0), tile(1, 0.5), cover(2)], { cols: 1, sqRows: 33, lsRows: 16 })
  assert.ok(one.placements.every((p) => p.colSpan === 1))
  assert.equal(one.placements[0].rowEnd - one.placements[0].rowStart, 33)

  // A full-width top region: the covers flow below it and still close flat.
  const items = Array.from({ length: 15 }, (_, i) => cover(i))
  const reg = computeFlushGrid(items, { cols: 6, sqRows: SQ, regions: [{ id: 'orbit', colStart: 0, colSpan: 6, rowSpan: 34, anchor: 'top' }] })
  assertCoversSquare(reg.placements, items, 'below a region')
  assert.equal(openRows(reg, 6), 0)
})

/* ── SQ-82: a non-album piece takes one square cell when that closes the bottom (Nathan 11-13) ── */
const motion45 = (i = 'm') => ({ _id: `m${i}`, mediaType: 'motion_4x5' })
/** A piece that took one square cell its class does not give it. */
const isDemoted = (p, item) => p.type !== tileClassOf(item)
/** Gruuv's shape: 14 covers and one 4:5 motion piece at index `at`. */
const gruuv = (at) => {
  const items = Array.from({ length: 14 }, (_, i) => cover(i))
  items.splice(at, 0, motion45())
  return items
}

test("Nathan's Gruuv shape: a 4:5 motion piece among 14 covers at 6 columns takes one square cell and the bottom closes", () => {
  for (const at of [0, 7, 14]) {
    const items = gruuv(at)
    for (const out of [computeFlushGrid(items, { cols: 6, sqRows: SQ }), chunkFlushGrid(items, { cols: 6, sqRows: SQ })[0]]) {
      const where = `motion piece at ${at}`
      assert.equal(openRows(out, 6), 0, `${where}: flush bottom`)
      const p = out.placements[at]
      assert.ok(isDemoted(p, items[at]), `${where}: the portrait is demoted`)
      assert.equal(p.type, 'square')
      assert.equal(p.colSpan, 1)
      assert.equal(p.rowEnd - p.rowStart, SQ, `${where}: one square, not stretched`)
      assert.ok(!p.underlay)
      assertCoversSquare(out.placements, items, where)
      assert.equal(out.placements.filter((q, i) => isDemoted(q, items[i])).length, 1, `${where}: nothing else demoted`)
      assert.equal(out.placements.filter((q) => q.colSpan === 2).length, 1, `${where}: one cover promoted beside it`)
      assert.equal(out.totalRows, 3 * SQ)
    }
    assert.deepEqual(chunkFlushGrid(items, { cols: 6, sqRows: SQ })[0].placements, computeFlushGrid(items, { cols: 6, sqRows: SQ }).placements, `${at}: the directory places as the detail grid`)
  }
})

test('no demotion where the layout is already flat', () => {
  // 3 columns: a 4:5 portrait (1 × 2) beside 4 covers fills two full rows
  const items = [motion45(), cover(0), cover(1), cover(2), cover(3)]
  const out = computeFlushGrid(items, { cols: 3, sqRows: SQ })
  assert.equal(openRows(out, 3), 0)
  assert.ok(out.placements.every((p, i) => !isDemoted(p, items[i])))
  assert.equal(out.placements[0].rowEnd - out.placements[0].rowStart, 2 * SQ)
  // and where covers alone close it, a portrait that cannot help stays a portrait
  const nine = [...Array.from({ length: 9 }, (_, i) => cover(i)), motion45()]
  const n = computeFlushGrid(nine, { cols: 3, sqRows: SQ })
  assert.equal(openRows(n, 3), 0)
  assert.ok(n.placements.every((p, i) => !isDemoted(p, nine[i])))
})

test('no demotion where the square would crop the piece more than the slot it has today', () => {
  // 9:16 loses 44% as a square against 11% in its 1 × 2 tile; 16:9 loses 44% against 11% in 2 × 1.
  // Gruuv's shape with the 4:5 swapped for a 9:16 is the same count, so it closes only by cropping
  // the piece to a square: it stays a portrait and the ragged edge stays (square cover wins).
  const tall = { _id: 'tall', mediaType: 'motion_9x16' }
  const items = [...Array.from({ length: 14 }, (_, i) => cover(i)), tall]
  const out = computeFlushGrid(items, { cols: 6, sqRows: SQ })
  assertCoversSquare(out.placements, items, '9:16')
  assert.ok(out.placements.every((p, i) => !isDemoted(p, items[i])), '9:16 kept its class')
  assert.ok(openRows(out, 6) > 0, 'the ragged edge stays')
  // a 16:9 never qualifies either, wherever the list ends
  for (let n = 5; n <= 16; n++) {
    const wide = [...Array.from({ length: n }, (_, i) => cover(i)), tile(99, 16 / 9)]
    const w = computeFlushGrid(wide, { cols: 6, sqRows: SQ })
    assert.ok(w.placements.every((p, i) => !isDemoted(p, wide[i])), `${n} covers + a 16:9`)
  }
})

test('square album art is never demoted or stretched, and a demotion is the swap the rule allows', () => {
  const kind = { A: cover, P: () => motion45(), W: (i) => tile(i, 1.25), T: (i) => tile(i, 0.75), L: (i) => tile(i, 16 / 9) }
  let demoted = 0
  for (const cols of [2, 4, 5, 6]) {
    for (let seed = 1; seed <= 12; seed++) {
      for (let n = 3; n <= 24; n++) {
        const r = rng(seed * 1000 + n)
        const items = Array.from({ length: n }, (_, i) => kind['AAAAPWTL'[Math.floor(r() * 8)]](i))
        const out = computeFlushGrid(items, { cols, sqRows: SQ })
        const where = `${n} @ ${cols}, seed ${seed}`
        assertCoversSquare(out.placements, items, where)
        assertValid(out, { cols, sqRows: SQ }, where)
        out.placements.forEach((p, i) => {
          if (!isDemoted(p, items[i])) return
          demoted++
          assert.notEqual(items[i].mediaType, 'album-art', `${where}: a cover is never demoted`)
          assert.ok(p.colSpan === 1 && p.rowEnd - p.rowStart === SQ && !p.underlay, `${where}: tile ${i} is one rigid square`)
          // the rule: the square crops it less than its class tile does
          const ratio = items[i].imageDimensions ? items[i].imageDimensions.width / items[i].imageDimensions.height : 0.8
          assert.ok(cropLoss(ratio, 1) < cropLoss(ratio, TILE_RATIO[tileClassOf(items[i])]) + 1e-9, `${where}: tile ${i} (${ratio}) loses more as a square`)
        })
        assert.deepEqual(computeFlushGrid(items, { cols, sqRows: SQ }), out, `${where}: deterministic`)
      }
    }
  }
  assert.ok(demoted > 0, 'the mix does demote somewhere')
})

test('the promotions run first so a 2×2 cover that alone closes the bottom leaves the portrait in its class', () => {
  // a 4:5 portrait (2 squares) and 7 covers = 9 squares at 4 columns: one 2×2 makes 12, three whole rows
  const items = [motion45(), ...Array.from({ length: 7 }, (_, i) => cover(i))]
  const out = computeFlushGrid(items, { cols: 4, sqRows: SQ })
  assert.equal(openRows(out, 4), 0)
  assert.ok(out.placements.every((p, i) => !isDemoted(p, items[i])))
  assert.equal(out.placements.filter((p) => p.colSpan === 2).length, 1)
  assert.equal(out.placements[0].rowEnd - out.placements[0].rowStart, 2 * SQ, 'the portrait keeps its 1 × 2')
})

// ── The portrait crop cap (SQ-117, Nathan 11-17) ──
// Nusonido (project-nusonido-nusonido), as the live page lists it (11-17): the MMW Promo and Promo 1 thirds,
// the 8-Bit Visualizer's thirds 2 and 3 (16:9; its first rides the hero), Promo 2, the Wynwood Teaser's three
// thirds (all 9:16), Pixel Diffuse (1:1) and two 4:5 pieces (Pixel Loop Metallic 750:937, The Power Preview).
const NUSONIDO = [9 / 16, 9 / 16, 9 / 16, 9 / 16, 9 / 16, 9 / 16, 16 / 9, 16 / 9, 9 / 16, 9 / 16, 9 / 16, 9 / 16, 1, 750 / 937, 0.8]
const nusonido = () => NUSONIDO.map((r, i) => tile(i, r))
/** cropLoss of a placed tile: its picture against the box it was drawn in. */
const boxCrop = (p, ratio, sqRows) => cropLoss(ratio, p.colSpan / ((p.rowEnd - p.rowStart) / sqRows))
/** The 9:16 tiles (portrait class, ratio 0.5625) drawn past the cap. */
const over = (out, sqRows, cap) =>
  out.placements.flatMap((p, i) => (NUSONIDO[i] === 9 / 16 && boxCrop(p, NUSONIDO[i], sqRows) > cap + 1e-9 ? [i] : []))

test('Nusonido at 1440: the flush stretch drew the Wynwood thirds 1 × 4; with the cap no 9:16 crops past 0.2, nothing is left open, and squares fill the hole', () => {
  const w = { cols: 5, sqRows: 24, breaks: 1, breakEvery: 2 }
  const today = computeFlushGrid(nusonido(), { ...w, portraitCrop: 1 })
  // The cause: the 4:5 pair falls into cols 0-1, leaving 3 columns × 2 squares open under the Wynwood thirds.
  assert.deepEqual(over(today, 24, PORTRAIT_CROP), [9, 10, 11], 'before: the three Wynwood thirds are stretched past the cap')
  assert.ok(boxCrop(today.placements[9], 9 / 16, 24) > 0.55, 'before: a 1 × 4, 0.556')

  const out = computeFlushGrid(nusonido(), { ...w, portraitCrop: PORTRAIT_CROP })
  assertValid(out, { cols: 5, sqRows: 24 }, 'capped')
  assert.deepEqual(over(out, 24, PORTRAIT_CROP), [], 'no 9:16 past the cap')
  assert.equal(openRows(out, 5), 0, 'no hole')
  // The holes now hold square cells: Pixel Diffuse and the 4:5 piece the search turned into one (SQ-82), both rigid 1 × 1.
  const cells = out.placements.flatMap((p, i) => (p.type === 'square' ? [i] : []))
  assert.deepEqual(cells, [12, 14], 'the two square-class pieces')
  for (const i of cells) assert.equal(out.placements[i].rowEnd - out.placements[i].rowStart, 24, `tile ${i} is one square cell`)
  assert.ok(out.placements[14].rowStart < today.placements[14].rowStart, 'the 4:5 piece moved up from the end into a hole')
  assert.deepEqual(computeFlushGrid(nusonido(), { ...w, portraitCrop: PORTRAIT_CROP }), out, 'deterministic')
})

test('Nusonido at 1920 (6 columns): the cap leaves fewer 9:16 stretched; the one hole no square closes keeps its stretch', () => {
  const w = { cols: 6, sqRows: 20, breaks: 1, breakEvery: 2 }
  const today = over(computeFlushGrid(nusonido(), { ...w, portraitCrop: 1 }), 20, PORTRAIT_CROP)
  const out = computeFlushGrid(nusonido(), { ...w, portraitCrop: PORTRAIT_CROP })
  assertValid(out, { cols: 6, sqRows: 20 }, 'capped')
  assert.ok(today.length >= 4, `before: ${today.length} stretched 9:16 tiles`)
  assert.equal(openRows(out, 6), 0, 'no hole')
  assert.deepEqual(over(out, 20, PORTRAIT_CROP), [5], 'one third is still stretched, 1 × 3: the last open cell has no square left to take it')
})

test('portraitCrop 1 is the layout before the cap, byte for byte (Nusonido at 5, 6, 3, 2 and 1 columns, with and without a break)', () => {
  // sha256 prefixes recorded from flushGrid.js before the cap (0e3b29b).
  const WANT = {
    '5 0': '07ab8e55dd1c4038', '5 1': 'f55779461a135b0c',
    '6 0': '2c8a5b7be8105e08', '6 1': '13eb22320a39338e',
    '3 0': '1486cc56a0f1b37c', '3 1': 'fe106b77267b3ac3',
    '2 0': '1215a2f0a0491209', '2 1': '0475be1bfda64472',
    '1 0': '189326ba22a08747', '1 1': 'ad8e02dde3e6115c',
  }
  for (const w of [{ cols: 5, sqRows: 24 }, { cols: 6, sqRows: 20 }, { cols: 3, sqRows: 40 }, { cols: 2, sqRows: 43 }, { cols: 1, sqRows: 33, lsRows: 16 }]) {
    for (const breaks of [0, 1]) {
      const out = computeFlushGrid(nusonido(), { ...w, breaks, breakEvery: 2, portraitCrop: 1 })
      const got = createHash('sha256').update(JSON.stringify(out)).digest('hex').slice(0, 16)
      assert.equal(got, WANT[`${w.cols} ${breaks}`], `${w.cols} cols, ${breaks} breaks`)
      // and with both caps dialled off (?portraitcrop=1&landscapecrop=1), the same bytes
      const both = computeFlushGrid(nusonido(), { ...w, breaks, breakEvery: 2, portraitCrop: 1, landscapeCrop: 1 })
      assert.equal(createHash('sha256').update(JSON.stringify(both)).digest('hex').slice(0, 16), WANT[`${w.cols} ${breaks}`], `${w.cols} cols, ${breaks} breaks, both off`)
    }
  }
})

test('a page with no square candidate is unchanged, as there is nothing for the search to use and every hole stretches as before', () => {
  const sq = 24
  for (const items of [
    Array.from({ length: 7 }, (_, i) => tile(i, 9 / 16)), // one 9:16 alone on the last row
    Array.from({ length: 8 }, (_, i) => tile(i, i % 4 === 3 ? 16 / 9 : 9 / 16)),
    Array.from({ length: 11 }, (_, i) => tile(i, 0.5)),
  ]) {
    for (const cols of [3, 4, 5, 6]) {
      const capped = computeFlushGrid(items, { cols, sqRows: sq, portraitCrop: PORTRAIT_CROP })
      assert.deepEqual(capped, computeFlushGrid(items, { cols, sqRows: sq, portraitCrop: 1 }), `${items.length} tiles @ ${cols}`)
    }
  }
})

test('a stretch that crops a tall piece LESS is not refused (1 × 2 → 1 × 4 for a 1:4 strip)', () => {
  // A 1:4 strip is cropped 0.5 in its 1 × 2 and 0 in a 1 × 4: the cap holds back a stretch that costs crop, not one that saves it.
  const strips = [tile(0, 0.25), tile(1, 0.25), tile(2, 0.25), tile(3, 0.25)]
  const out = computeFlushGrid(strips, { cols: 3, sqRows: 24, portraitCrop: PORTRAIT_CROP })
  assert.deepEqual(out, computeFlushGrid(strips, { cols: 3, sqRows: 24, portraitCrop: 1 }))
  assert.equal(out.placements.filter((p) => p.rowEnd - p.rowStart === 4 * 24).length, 2, 'the two over the open cells stretch to 1 × 4')
})

test('a hole only a stretch closes is never closed with a portrait cropped harder than the page had before the cap', () => {
  // 7 tiles around a 46-row seat at tile 5 (5 columns, 24 rows a square). The capped search leaves a hole no square
  // closes, the uncapped finish used to close it with a 9:16 stretched 1 × 4 (0.583); the layout from before the cap
  // worst-crops a portrait 0.408 (a 1 × 3), so that page keeps it.
  const ratios = [9 / 16, 0.8, 16 / 9, 9 / 16, 9 / 16, 0.75, 0.75]
  const items = ratios.map((r, i) => tile(i, r))
  const regions = [{ id: 'carousel:k', colStart: 0, colSpan: 5, rowSpan: 46, anchor: 'seat', at: 5 }]
  const worst = (out) => Math.max(...out.placements.flatMap((p, i) => (p.type === 'portrait' ? [boxCrop(p, ratios[i], 24)] : [])))
  const capped = computeFlushGrid(items, { cols: 5, sqRows: 24, regions, portraitCrop: PORTRAIT_CROP })
  const today = computeFlushGrid(items, { cols: 5, sqRows: 24, regions, portraitCrop: 1 })
  assert.equal(openRows(capped, 5), 0)
  assert.ok(worst(capped) <= worst(today) + 1e-9, `${worst(capped)} > ${worst(today)}`)
  assert.ok(worst(capped) < 0.42)
})

test('with the cap on, covers stay square and rigid, and grids stay valid and deterministic', () => {
  const kind = { A: cover, P: (i) => tile(i, 9 / 16), Q: (i) => tile(i, 0.8), L: (i) => tile(i, 16 / 9), S: (i) => tile(i, 1) }
  for (const cols of [5, 6]) {
    for (let seed = 1; seed <= 6; seed++) {
      for (let n = 3; n <= 19; n += 2) {
        const r = rng(seed * 1000 + n)
        const items = Array.from({ length: n }, (_, i) => kind['AAPPQLS'[Math.floor(r() * 7)]](i))
        const opts = { cols, sqRows: SQ, portraitCrop: PORTRAIT_CROP }
        const out = computeFlushGrid(items, opts)
        const where = `${n} mixed @ ${cols}, seed ${seed}`
        assertCoversSquare(out.placements, items, where)
        assertValid(out, { cols, sqRows: SQ }, where)
        assert.deepEqual(computeFlushGrid(items, opts), out, `${where}: deterministic`)
        // A cap never leaves more open rows than the page had before it.
        assert.ok(openRows(out, cols) <= openRows(computeFlushGrid(items, { ...opts, portraitCrop: 1 }), cols), `${where}: open rows`)
      }
    }
  }
})

// ── The landscape crop cap (SQ-119) ──
// TOBEHONEST (project-tobehonest), as the live page lists it (11-18): five portraits, the set's seat after them, two 4:3
// landscape-class pieces, a 9:16, a 2:1, a 3:4, a 16:9 and a 4:5, one break. Rebuilt from the page's layout-probe record.
const TBH = [0.75, 0.8, 0.8, 0.75, 9 / 16, 4 / 3, 4 / 3, 9 / 16, 2, 0.75, 16 / 9, 0.8]
const tobehonest = () => TBH.map((r, i) => tile(i, r))
const TBH_SEAT = [{ id: 'set', colStart: 0, colSpan: 5, rowSpan: 51, anchor: 'seat', at: 5 }]
const sha = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16)

test('landscapeCrop 1 is the layout the portrait cap drew (2c6770d), byte for byte, for Nusonido, TOBEHONEST and a mixed corpus', () => {
  // sha256 prefixes recorded from flushGrid.js at 2c6770d (portraitCrop 0.2, no landscape cap).
  const WANT = {
    'nuso 5 0': 'a244fc9b7b117554', 'nuso 5 1': '9867fb76a83b50d3', 'nuso 6 0': '620b8fe019680cd1', 'nuso 6 1': '083ef3d910762978',
    'nuso 3 0': '1486cc56a0f1b37c', 'nuso 3 1': 'fe106b77267b3ac3', 'nuso 2 0': '8963b78303fee5f2', 'nuso 2 1': 'f5ce150394a31790',
    'nuso 1 0': '189326ba22a08747', 'nuso 1 1': 'ad8e02dde3e6115c', 'tbh 5': '47f11484b0895231', 'tbh 6': '30b224b4ad09c458',
    mixed: '6f39e6ffd55813e9',
  }
  const got = {}
  for (const w of [{ cols: 5, sqRows: 24 }, { cols: 6, sqRows: 20 }, { cols: 3, sqRows: 40 }, { cols: 2, sqRows: 43 }, { cols: 1, sqRows: 33, lsRows: 16 }]) {
    for (const breaks of [0, 1]) {
      got[`nuso ${w.cols} ${breaks}`] = sha(computeFlushGrid(nusonido(), { ...w, breaks, breakEvery: 2, portraitCrop: PORTRAIT_CROP, landscapeCrop: 1 }))
    }
  }
  for (const w of [{ cols: 5, sqRows: 24 }, { cols: 6, sqRows: 20 }]) {
    got[`tbh ${w.cols}`] = sha(computeFlushGrid(tobehonest(), { ...w, regions: TBH_SEAT, breaks: 1, breakEvery: 2, portraitCrop: PORTRAIT_CROP, landscapeCrop: 1 }))
  }
  const kind = { A: cover, P: (i) => tile(i, 9 / 16), Q: (i) => tile(i, 0.8), L: (i) => tile(i, 16 / 9), S: (i) => tile(i, 1), W: (i) => tile(i, 4 / 3) }
  const mixed = []
  for (const cols of [5, 6]) {
    for (let seed = 1; seed <= 6; seed++) {
      for (let n = 3; n <= 19; n += 2) {
        const r = rng(seed * 1000 + n)
        const items = Array.from({ length: n }, (_, i) => kind['AAPPQLSW'[Math.floor(r() * 8)]](i))
        mixed.push(computeFlushGrid(items, { cols, sqRows: SQ, portraitCrop: PORTRAIT_CROP, landscapeCrop: 1 }))
      }
    }
  }
  got.mixed = sha(mixed)
  assert.deepEqual(got, WANT)
})

/** The landscape-class tiles of a layout that were STRETCHED past the cap: cropped more than the cap and more than their own 2 × 1. */
const stretchedWide = (out, ratios, sqRows, cap) =>
  out.placements.flatMap((p, i) => {
    if (classifyTile(ratios[i]) !== 'landscape' || p.type !== 'landscape') return []
    const crop = boxCrop(p, ratios[i], sqRows)
    return crop > cap + 1e-9 && crop > cropLoss(ratios[i], TILE_RATIO.landscape) + 1e-9 ? [i] : []
  })
/** The worst cropLoss among the tiles of one class (`classes` picks them by the picture's own ratio), against the box each is drawn in. */
const worstOf = (out, ratios, sqRows, is) => Math.max(0, ...out.placements.map((p, i) => (is(ratios[i]) ? boxCrop(p, ratios[i], sqRows) : 0)))
const isTall = (r) => classifyTile(r) === 'portrait'
const isWide = (r) => classifyTile(r) === 'landscape'

test('a landscape is never stretched past the cap: the 4:3 and the 16:9 that the portrait cap left over holes hold their boxes, the 4:5 takes a square cell', () => {
  // 2:1, 3:4, 4:3, 16:9 and a 4:5 at 5 columns. At 2c6770d the 4:3 is drawn 2 × 3 (0.500) and the 16:9 2 × 2 (0.438) over the hole the
  // 4:5 leaves; the cap sends the 4:5 into one square cell (0.200) and both wide pieces keep a box that crops less.
  const ratios = [2, 0.75, 4 / 3, 16 / 9, 0.8]
  const items = ratios.map((r, i) => tile(i, r))
  const w = { cols: 5, sqRows: 24 }
  const prior = computeFlushGrid(items, { ...w, portraitCrop: PORTRAIT_CROP, landscapeCrop: 1 })
  const out = computeFlushGrid(items, { ...w, portraitCrop: PORTRAIT_CROP, landscapeCrop: LANDSCAPE_CROP })
  assertValid(out, w, 'capped')
  assert.deepEqual(stretchedWide(prior, ratios, 24, LANDSCAPE_CROP), [2, 3], 'before: the 4:3 and the 16:9 are stretched past the cap')
  assert.deepEqual(stretchedWide(out, ratios, 24, LANDSCAPE_CROP), [], 'no landscape stretched past the cap')
  assert.ok(worstOf(out, ratios, 24, isWide) <= 0.25 + 1e-9, `worst landscape ${worstOf(out, ratios, 24, isWide)}`)
  assert.equal(openRows(out, 5), 0, 'no hole')
  assert.ok(out.totalRows < prior.totalRows, 'and the page is shorter')
  assert.ok(worstOf(out, ratios, 24, isTall) <= worstOf(prior, ratios, 24, isTall) + 1e-9, 'no portrait cropped harder')
  assert.deepEqual(out, computeFlushGrid(items, { ...w, portraitCrop: 1, landscapeCrop: LANDSCAPE_CROP }), 'the landscape cap alone reaches the same layout')
  assert.deepEqual(out, computeFlushGrid(items, { ...w, portraitCrop: PORTRAIT_CROP, landscapeCrop: LANDSCAPE_CROP }), 'deterministic')
  assert.deepEqual(computeFlushGrid(items, { ...w, portraitCrop: PORTRAIT_CROP, landscapeCrop: 1 }), prior, 'landscapeCrop 1: the layout from before the cap')
})

test('Nusonido and TOBEHONEST at 1440, no layout closes the hole without a 16:9 drawn 2 × 2, so each keeps the portrait cap layout (the page is never left worse)', () => {
  // Nusonido's tiles cover 29 squares, 28 with a 4:5 turned into one cell (SQ-82), and a 5-column grid is flat at a multiple of 5.
  // Only a stretch adds area; the portrait cap refuses the 9:16 and 4:5 ones, so the one that fits is the 16:9's (+2). TOBEHONEST's
  // second grid is the same problem. The landscape cap finds no flat layout without that stretch, the stretch after all crops the
  // 16:9 exactly as it did, and the page keeps the layout from before the cap rather than a worse one.
  const w = { cols: 5, sqRows: 24, breaks: 1, breakEvery: 2, portraitCrop: PORTRAIT_CROP }
  for (const [name, ratios, items, extra] of [
    ['Nusonido', NUSONIDO, nusonido(), {}],
    ['TOBEHONEST', TBH, tobehonest(), { regions: TBH_SEAT }],
  ]) {
    const prior = computeFlushGrid(items, { ...w, ...extra, landscapeCrop: 1 })
    const out = computeFlushGrid(items, { ...w, ...extra, landscapeCrop: LANDSCAPE_CROP })
    assertValid(out, w, name)
    assert.equal(openRows(out, 5), 0, `${name}: no hole`)
    assert.deepEqual(out, prior, `${name}: the portrait cap's layout`)
    assert.ok(Math.abs(worstOf(out, ratios, 24, isWide) - cropLoss(16 / 9, 1)) < 1e-9, `${name}: the 16:9 is 2 × 2, ${worstOf(out, ratios, 24, isWide)}`)
  }
})

test('with the landscape cap on, no page is left worse than the portrait cap drew it, and grids stay valid, rigid and deterministic', () => {
  const kind = { A: cover, P: (i) => tile(i, 9 / 16), Q: (i) => tile(i, 0.8), L: (i) => tile(i, 16 / 9), S: (i) => tile(i, 1), W: (i) => tile(i, 4 / 3), T: (i) => tile(i, 2) }
  let better = 0
  let viaAlone = 0
  for (const cols of [5, 6]) {
    for (let seed = 1; seed <= 6; seed++) {
      for (let n = 3; n <= 19; n += 2) {
        const r = rng(seed * 1000 + n)
        const items = Array.from({ length: n }, (_, i) => kind['AAPPQLSWT'[Math.floor(r() * 9)]](i))
        const ratios = items.map((a) => (a.imageDimensions ? a.imageDimensions.width / a.imageDimensions.height : 1))
        const opts = { cols, sqRows: SQ, portraitCrop: PORTRAIT_CROP }
        const out = computeFlushGrid(items, { ...opts, landscapeCrop: LANDSCAPE_CROP })
        const prior = computeFlushGrid(items, { ...opts, landscapeCrop: 1 })
        const where = `${n} mixed @ ${cols}, seed ${seed}`
        assertCoversSquare(out.placements, items, where)
        assertValid(out, { cols, sqRows: SQ }, where)
        assert.deepEqual(computeFlushGrid(items, { ...opts, landscapeCrop: LANDSCAPE_CROP }), out, `${where}: deterministic`)
        assert.ok(openRows(out, cols) <= openRows(prior, cols), `${where}: open rows`)
        assert.ok(worstOf(out, ratios, SQ, isTall) <= worstOf(prior, ratios, SQ, isTall) + 1e-9, `${where}: worst portrait`)
        const [was, now] = [worstOf(prior, ratios, SQ, isWide), worstOf(out, ratios, SQ, isWide)]
        assert.ok(now <= was + 1e-9, `${where}: worst landscape ${now} > ${was}`)
        if (now < was - 1e-9) better++
        // a page the portrait cap's search led away from a layout that suits both gets the landscape cap's own
        const alone = computeFlushGrid(items, { ...opts, portraitCrop: 1, landscapeCrop: LANDSCAPE_CROP })
        if (JSON.stringify(out) === JSON.stringify(alone) && JSON.stringify(out) !== JSON.stringify(prior)) viaAlone++
      }
    }
  }
  assert.ok(better > 0, 'the cap improves some page of the mix')
  assert.ok(viaAlone > 0, 'and some page takes the layout the landscape cap alone draws')
})
