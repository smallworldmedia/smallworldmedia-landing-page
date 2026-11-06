// The Project Directory's aspect-aware packer (?dirpack=aspect, SQ-20):
// every chunk flush (no overlap, no uncovered row), every tile placed once
// and at most `look` places from its list order, crops bounded, the same
// input giving the same output; and the fit that goes with it.
//   node --test scripts/test/aspect-grid.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { chunkAspectGrid, spanOf, lossOf, LOOK } from '../../src/components/work/directory/aspectGrid.js'
import { fitOf, isTransparent, groundOf } from '../../src/components/work/directory/buildDirectoryTiles.js'

/* Every ratio class the directory holds: ≤9:16, 3:4–4:5, 1:1, 4:3, 16:9, a
   SoundCloud banner, a tagline. */
const CLASSES = [0.5625, 0.75, 0.8, 1, 1.333, 1.778, 2.4, 4.77, 21]
const VIEWS = [
  { cols: 2, width: 393 },
  { cols: 4, width: 900 },
  { cols: 5, width: 1440 },
]

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/* A directory-like mix: mostly squares and portraits, some wides, a few extremes. */
const WEIGHTS = [10, 20, 10, 35, 2, 12, 2, 2, 1]
function list(n, seed) {
  const rand = rng(seed)
  const total = WEIGHTS.reduce((s, w) => s + w, 0)
  return Array.from({ length: n }, (_, i) => {
    let x = rand() * total
    let k = 0
    while (x >= WEIGHTS[k]) x -= WEIGHTS[k++]
    return { _id: `t${i}`, tileRatio: CLASSES[k] }
  })
}

const GAP = 2
const pitch = 12
/* The crop a tile can't escape: its ratio clamped to 2 squares tall / ⅓ square short. */
function clampLoss(r, { cols, width }) {
  const colW = (width - (cols - 1) * GAP) / cols
  const s = spanOf(r, cols)
  const w = s * colW + (s - 1) * GAP
  const sq = Math.round((colW + GAP) / pitch)
  const h = Math.min(2 * sq, Math.max(Math.ceil(sq / 3), Math.round((w / r + GAP) / pitch))) * pitch - GAP
  return lossOf(r, w / h)
}

/** Check one packing; returns per-tile crops for the caller's bounds. */
function check(items, view, look = LOOK) {
  const chunks = chunkAspectGrid(items, { ...view, gap: GAP, look })
  const seen = new Set()
  let pos = 0
  const crops = []
  for (const [k, ch] of chunks.entries()) {
    assert.equal(ch.start, pos, `chunk ${k} starts where the last ended`)
    assert.equal(ch.end - ch.start, ch.placements.length)
    const grid = Array.from({ length: view.cols }, () => new Array(ch.totalRows).fill(0))
    for (const p of ch.placements) {
      assert.ok(!seen.has(p.index), `tile ${p.index} placed once`)
      seen.add(p.index)
      assert.ok(Math.abs(pos - p.index) <= look, `tile ${p.index} at ${pos}: moved more than ${look}`)
      pos++
      assert.ok(p.rowEnd > p.rowStart && p.rowStart >= 0 && p.rowEnd <= ch.totalRows, `tile ${p.index} inside its chunk`)
      assert.ok(p.col >= 0 && p.col + p.colSpan <= view.cols, `tile ${p.index} inside the columns`)
      for (let c = p.col; c < p.col + p.colSpan; c++)
        for (let r = p.rowStart; r < p.rowEnd; r++) grid[c][r]++
      const ratio = items[p.index].tileRatio
      crops.push({ ratio, loss: lossOf(ratio, p.cell), floor: clampLoss(ratio, view) })
    }
    for (let c = 0; c < view.cols; c++)
      for (let r = 0; r < ch.totalRows; r++)
        assert.equal(grid[c][r], 1, `chunk ${k} col ${c} row ${r}: ${grid[c][r] ? 'overlap' : 'hole'}`)
  }
  assert.equal(seen.size, items.length, 'every tile placed')
  return crops
}

/* The bounds (stated): on directory-sized lists no tile crops more than 0.35
   beyond what its own clamp forces, the mean stays ≤ 5% and ≤ 2% of tiles
   crop over 25%. A list of a dozen or fewer can't always fill the width
   without widening a tile (one portrait alone in five columns), so there a
   tile crops at most 0.45 beyond its clamp and the mean stays ≤ 20%. */
const BOUND = 0.35
const SMALL_BOUND = 0.45

test('n = 1…12: flush, every tile once, crop bounded, at 2 / 4 / 5 columns', () => {
  for (const view of VIEWS) {
    const all = []
    for (let n = 1; n <= 12; n++) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const crops = check(list(n, seed * 100 + n), view)
        for (const c of crops)
          assert.ok(c.loss <= c.floor + SMALL_BOUND + 1e-9, `${view.cols} cols n=${n} seed ${seed}: ratio ${c.ratio} crops ${c.loss.toFixed(3)}`)
        all.push(...crops)
      }
    }
    const mean = all.reduce((s, c) => s + c.loss, 0) / all.length
    assert.ok(mean <= 0.1, `${view.cols} cols: small-list mean ${mean.toFixed(3)}`)
  }
})

/* A short filtered list (one chunk's worth) is laid as justified bands when
   that crops less (Nathan's option b, 11-05): bigger tiles, and across
   n = 13…64 the mean stays ≤ 6% with ≤ 2% of tiles over 25% (measured: 5
   columns 5.0% / 1.6%). */
test('n = 13…64: short lists take wider tiles; mean ≤ 6%, ≤ 2% over 25%', () => {
  for (const view of VIEWS) {
    const all = []
    for (let n = 13; n <= 64; n++) {
      for (const seed of [1, 2, 3, 4, 5]) all.push(...check(list(n, seed * 100 + n), view))
    }
    const mean = all.reduce((s, c) => s + c.loss, 0) / all.length
    const over = all.filter((c) => c.loss > 0.25).length
    assert.ok(mean <= 0.06, `${view.cols} cols: short-list mean ${mean.toFixed(3)}`)
    assert.ok(over <= 0.02 * all.length, `${view.cols} cols: ${over} of ${all.length} over 25%`)
  }
})

test('every ratio class alone, and one of each', () => {
  for (const view of VIEWS) {
    for (const r of CLASSES) {
      for (const n of [1, 3, 7, 40]) check(Array.from({ length: n }, (_, i) => ({ _id: `${r}-${i}`, tileRatio: r })), view)
    }
    check(CLASSES.map((r, i) => ({ _id: `c${i}`, tileRatio: r })), view)
  }
})

test('n = 700: flush and chunked; mean crop ≤ 5%, ≤ 2% of tiles over 25%', () => {
  for (const view of VIEWS) {
    for (const seed of [7, 8]) {
      const items = list(700, seed)
      const crops = check(items, view)
      const mean = crops.reduce((s, c) => s + c.loss, 0) / crops.length
      const over = crops.filter((c) => c.loss > 0.25).length
      assert.ok(mean <= 0.05, `${view.cols} cols seed ${seed}: mean ${mean.toFixed(3)}`)
      assert.ok(over <= 0.02 * crops.length, `${view.cols} cols seed ${seed}: ${over} over 25%`)
      // per tile: all but the ≤ 2% above (a full-width banner forced into one column) stay within BOUND
      const outside = crops.filter((c) => c.loss > c.floor + BOUND + 1e-9).length
      assert.ok(outside <= 0.02 * crops.length, `${view.cols} cols seed ${seed}: ${outside} tiles past the bound`)
      const chunks = chunkAspectGrid(items, { ...view, gap: GAP })
      assert.ok(chunks.length > 5, 'a long list is chunked')
    }
  }
})

test('many mixes: flush and no tile moves more than the lookahead', () => {
  for (const view of VIEWS) for (let seed = 1; seed <= 40; seed++) check(list(300, 1000 + seed), view)
})

test('the lookahead bounds the move: look 1 keeps the list order', () => {
  const items = list(120, 9)
  check(items, VIEWS[2], 3)
  const order = chunkAspectGrid(items, { ...VIEWS[2], gap: GAP, look: 1 }).flatMap((c) => c.placements.map((p) => p.index))
  assert.deepEqual(order.slice(0, 20), [...Array(20).keys()])
})

test('deterministic: the same input gives the same output', () => {
  const items = list(300, 11)
  assert.deepEqual(chunkAspectGrid(items, { ...VIEWS[0], gap: GAP }), chunkAspectGrid(items, { ...VIEWS[0], gap: GAP }))
})

test('spans: 1 below 1.2, 2 below 3, every column from 3', () => {
  assert.equal(spanOf(0.8, 5), 1)
  assert.equal(spanOf(1.19, 5), 1)
  assert.equal(spanOf(1.2, 5), 2)
  assert.equal(spanOf(2.99, 5), 2)
  assert.equal(spanOf(3, 5), 5)
  assert.equal(spanOf(1.78, 1), 1)
})

/* ── fit: letterbox only what is really transparent ── */
const face = (extra = {}) => ({
  imageUrl: 'https://cdn.example.invalid/a.png',
  imageDimensions: { width: 1000, height: 1000 },
  imageAssetId: 'image-abc-1000x1000-png',
  ...extra,
})

test('fitOf: opaque alpha covers, measured clear contains, unknown alpha contains', () => {
  assert.equal(fitOf(face({ imageHasAlpha: true, imageIsOpaque: true })), 'cover', 'isOpaque: an alpha channel with nothing clear')
  const measured = { 'image-abc-1000x1000-png': { clear: 0.004, lum: 0.5 } }
  assert.equal(fitOf(face({ imageHasAlpha: true, imageIsOpaque: false }), measured), 'cover', 'measured under 2% clear')
  const clear = { 'image-abc-1000x1000-png': { clear: 0.4, lum: 0.1 } }
  assert.equal(fitOf(face({ imageHasAlpha: true, imageIsOpaque: false }), clear), 'contain', 'measured 40% clear')
  assert.equal(fitOf(face({ imageHasAlpha: true, imageIsOpaque: false })), 'contain', 'not measured yet: the safe default')
  assert.equal(fitOf(face({ imageHasAlpha: true })), 'contain', 'isOpaque unknown, not measured')
  assert.equal(isTransparent(face({ imageHasAlpha: true, imageIsOpaque: true })), false)
  assert.equal(groundOf(face({ imageHasAlpha: true, imageIsOpaque: false }), clear), 'light', 'dark ink on clear: a light ground')
  assert.equal(groundOf(face({ imageHasAlpha: true, imageIsOpaque: false }), { 'image-abc-1000x1000-png': { clear: 0.4, lum: 0.8 } }), undefined)
  assert.equal(groundOf(face({ imageHasAlpha: true, imageIsOpaque: true }), clear), undefined, 'an opaque face keeps the dark ground')
})
