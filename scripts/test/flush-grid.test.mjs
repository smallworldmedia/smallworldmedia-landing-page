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
      out.placements.forEach((p, i) => assert.equal(p.type, tileClassOf(items[i]), 'placed in the class it was picked for'))
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
  const CASES = [
    [5, 1, [], 40, '1aab82f598ead89d', ''],
    [12, 2, [ORBIT], 40, '0edab619506b7925', '0'],
    [24, 3, [ORBIT, DECK('mid')], 40, 'ef56ae67328468e3', '0,12'],
    [36, 4, [DECK('top')], 40, '4794a39d2b68b773', '0'],
    [18, 5, [SOLO, BANNER], 40, '7ffe7b87da977bfd', '18,18'],
    [60, 6, [ORBIT, DECK('mid'), SOLO, BANNER], 40, '2fb3f79b89bc1aa3', '0,26,60,60'],
    [30, 7, [], 24, 'e7602e06ca3c1d66', ''],
    [44, 8, [ORBIT], 33, '01f48369cbf25ed4', '0'],
    [9, 9, [BANNER], 52, '9109c438c7107bbe', '9'],
    [50, 10, [DECK('top'), SOLO], 40, 'c8ac2ab154f236f1', '0,50'],
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
