// The large-screen tier (SQ-74): the detail grid gains columns and the directory
// gets its large count from GRID_LARGE_PX up; both counts and the breakpoint are
// URL dials. Pure pieces only (tileGrid.js, directoryTune.js, sizesFor, flushGrid).
//   node --test scripts/test/large-grid.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GRID_LARGE_PX,
  DETAIL_LARGE_COLS,
  gridTierFor,
  gridColsFor,
  readGridLargePx,
  readDetailLargeCols,
  tileRowsFor,
  tileRowVars,
} from '../../src/components/work/detail/tileGrid.js'
import { computeFlushGrid } from '../../src/components/work/detail/flushGrid.js'
import { SSR_TUNE, PARAM_KEYS, readTune } from '../../src/components/work/directory/directoryTune.js'
import { sizesFor } from '../../src/components/work/directory/buildDirectoryTiles.js'

test('the breakpoint is 1920 CSS px and the columns step 1 / 2 / 3 below it, 4 at and above it', () => {
  assert.equal(GRID_LARGE_PX, 1920)
  assert.equal(DETAIL_LARGE_COLS, 4)
  const at = (vw) => gridColsFor(vw)
  assert.deepEqual([320, 768].map(at), [1, 1], 'phone: one column up to 768')
  assert.deepEqual([769, 1024].map(at), [2, 2], 'tablet: two columns 769 to 1024')
  assert.deepEqual([1025, 1440, 1728, 1919].map(at), [3, 3, 3, 3], 'desktop: three columns, a 1728 laptop unchanged')
  assert.deepEqual([1920, 2560, 3840].map(at), [4, 4, 4], 'large: four from the breakpoint (min-width, inclusive)')
  assert.deepEqual([1919, 1920].map((vw) => gridTierFor(vw)), ['desktop', 'large'])
  assert.equal(gridTierFor(700), 'phone')
  assert.equal(gridTierFor(900), 'tablet')
})

test('the breakpoint and the large column count follow their dials', () => {
  assert.equal(gridColsFor(2200, 2400), 3, 'a later breakpoint leaves 2200 on desktop')
  assert.equal(gridColsFor(2200, 2000), 4)
  assert.equal(gridColsFor(2560, GRID_LARGE_PX, 5), 5, 'the large count dials 4 vs 5')
  assert.equal(gridColsFor(1728, GRID_LARGE_PX, 5), 3, 'below the tier the large count never applies')
  assert.equal(gridColsFor(900, 800, 6), 2, 'a breakpoint dialed into the tablet band does not beat the tablet step')
})

test('?gridlarge: the dial wins when it is a width above the tablet band, else the default', () => {
  assert.equal(readGridLargePx(''), 1920)
  assert.equal(readGridLargePx('?gridlarge=2400'), 2400)
  assert.equal(readGridLargePx('?x=1&gridlarge=1600'), 1600)
  for (const bad of ['?gridlarge=', '?gridlarge=abc', '?gridlarge=800', '?gridlarge=1024', '?gridlarge=-5']) {
    assert.equal(readGridLargePx(bad), 1920, bad)
  }
})

test('?detaillargecols: an integer 3 to 6, anything else falls back to 4', () => {
  assert.equal(readDetailLargeCols(''), 4)
  for (const n of [3, 4, 5, 6]) assert.equal(readDetailLargeCols(`?detaillargecols=${n}`), n)
  for (const bad of ['2', '7', '4.5', '', 'abc', '-4', '0']) {
    assert.equal(readDetailLargeCols(`?detaillargecols=${bad}`), 4, `?detaillargecols=${bad}`)
  }
})

test('the directory: large cols 6 by default, ?dirlargecols re-dials it, ?dircols still dials the desktop band alone', () => {
  assert.equal(SSR_TUNE.largeCols, 6)
  assert.equal(SSR_TUNE.cols, 5, 'the desktop count is unchanged')
  assert.equal(PARAM_KEYS.largeCols, 'dirlargecols')
  assert.equal(readTune('', SSR_TUNE).largeCols, 6)
  assert.equal(readTune('?dirlargecols=7', SSR_TUNE).largeCols, 7)
  assert.equal(readTune('?dirlargecols=0', SSR_TUNE).largeCols, 6, 'garbage falls back')
  assert.equal(readTune('?dirlargecols=2.5', SSR_TUNE).largeCols, 6)
  const t = readTune('?dircols=4', SSR_TUNE)
  assert.deepEqual([t.cols, t.largeCols], [4, 6], '?dircols moves the desktop tier only')
})

test('sizesFor: the large clause leads, at the directory\'s 6 columns and the detail\'s 4, and follows ?gridlarge', () => {
  const dir = { phone: 2, tablet: 4, desktop: 5, large: 6 }
  assert.equal(sizesFor('square', 1, 'cover', dir), '(min-width: 1920px) 17vw, (max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw')
  assert.equal(sizesFor('landscape', 1.78, 'cover', dir), '(min-width: 1920px) 33vw, (max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw')
  assert.match(sizesFor('square', 1, 'cover'), /^\(min-width: 1920px\) 25vw, /, 'the default spec is the detail grid\'s 4')
  assert.match(sizesFor('square', 1, 'cover', { ...dir, largeFrom: 2400 }), /^\(min-width: 2400px\) 17vw, /)
})

test('tileRowsFor and tileRowVars carry the large count: a narrower tile in 4 columns than in 3', () => {
  const at = (cols) => tileRowsFor({ width: 2560, rowGap: 2, cols }, 1)
  assert.equal(at(4).cols, 4)
  assert.ok(at(4).sq < at(3).sq && at(5).sq < at(4).sq, 'more columns, shorter squares (the tile shape holds 1:1)')
  assert.equal(tileRowVars(at(4))['--grid-cols'], 4)
  assert.equal(tileRowVars(at(5))['--grid-cols'], 5)
  assert.equal(tileRowVars(null), undefined)
})

test('masonry.css takes its column count from --grid-cols (3 until the tier is measured) and keeps the ≤1024 / ≤768 steps', () => {
  const css = readFileSync(new URL('../../src/styles/masonry.css', import.meta.url), 'utf8')
  assert.match(css, /\.masonry-grid--detail \{[^}]*grid-template-columns: repeat\(var\(--grid-cols, 3\), 1fr\)/)
  assert.match(css, /@media \(max-width: 1024px\) \{\s*\.masonry-grid--detail \{\s*grid-template-columns: repeat\(2, 1fr\)/)
  assert.match(css, /@media \(max-width: 768px\) \{\s*\.masonry-grid--detail \{\s*grid-template-columns: 1fr/)
})

/* The flush grid at the large counts: a full-width band spans every column, tiles stay inside them, none overlaps a band. */
const tile = (i, ratio) => ({ _id: `a${i}`, imageDimensions: { width: Math.round(1000 * ratio), height: 1000 } })
const MIX = [1, 0.5, 16 / 9, 1, 1, 0.5, 16 / 9, 1, 0.5, 1, 1, 16 / 9, 1, 0.5, 1, 1, 1, 16 / 9, 0.5, 1].map((r, i) => tile(i, r))
const FULL = Infinity // FeaturedProjectDetail's FULL_BAND

for (const cols of [3, 4, 5, 6]) {
  test(`computeFlushGrid at ${cols} columns: full-width bands span them all, tiles stay inside, no tile over a band, breaks cut`, () => {
    const regions = [
      { id: 'orbit', colStart: 0, colSpan: FULL, rowSpan: 51, anchor: 'top' },
      { id: 'carousel:x', colStart: 0, colSpan: FULL, rowSpan: 43, anchor: 'mid' },
      { id: 'banner:y', colStart: 0, colSpan: FULL, rowSpan: 38, anchor: 'bottom' },
    ]
    const { placements, regions: out, totalRows } = computeFlushGrid(MIX, { cols, regions, sqRows: 40, breaks: 2, breakEvery: 2 })
    for (const r of out.filter((r) => ['orbit', 'carousel:x', 'banner:y'].includes(r.id))) {
      assert.equal(r.colSpan, cols, `${r.id} spans every column`)
      assert.equal(r.colStart, 0)
    }
    assert.equal(out.filter((r) => r.anchor === 'break').length, 2, 'both description bands cut the grid')
    for (const p of placements) {
      assert.ok(p.col >= 0 && p.col + p.colSpan <= cols, 'tile inside the columns')
      assert.ok(p.rowEnd <= totalRows)
      for (const r of out) {
        const clash = p.rowStart < r.rowEnd && r.rowStart < p.rowEnd
        assert.ok(!clash, `a tile is over ${r.id}`)
      }
    }
    assert.ok(placements.some((p) => p.colSpan === 2), 'a landscape takes two columns')
  })
}
