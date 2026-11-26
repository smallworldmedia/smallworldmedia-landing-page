// horizontalStrip: the carousel strip's geometry (US-4 B) — slides visible across,
// the socket rows one slide tall, and the x axis's wrap cycle.
//   node --test scripts/test/horizontal-strip.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CAROUSEL_VIS_DESKTOP,
  CAROUSEL_VIS_PHONE,
  carouselVisible,
  carouselSlideH,
  carouselRows,
  horizontalLayout,
  mixedStripCycle,
} from '../../src/components/work/detail/horizontalStrip.js'

test('?carouselvis defaults to 3.5 across on desktop and 1.5 on a phone, and a good override wins on both', () => {
  assert.equal(carouselVisible(false, ''), CAROUSEL_VIS_DESKTOP)
  assert.equal(carouselVisible(true, ''), CAROUSEL_VIS_PHONE)
  assert.equal(CAROUSEL_VIS_DESKTOP, 3.5)
  assert.equal(CAROUSEL_VIS_PHONE, 1.5)
  assert.equal(carouselVisible(false, '?carouselvis=2'), 2)
  assert.equal(carouselVisible(true, '?carouselvis=2.25'), 2.25)
  // junk and non-positive values fall back to the default
  assert.equal(carouselVisible(false, '?carouselvis=abc'), 3.5)
  assert.equal(carouselVisible(true, '?carouselvis=0'), 1.5)
  assert.equal(carouselVisible(true, '?carouselvis=-1'), 1.5)
})

test('vis slides and the gaps between them fill the width exactly', () => {
  const ratio = 0.8
  for (const [width, vis, gap] of [[1440, 3.5, 2], [390, 1.5, 2], [1000, 2, 4]]) {
    const slideH = carouselSlideH(width, vis, gap, ratio)
    const slideW = slideH * ratio
    // vis slides = vis·slideW + (vis − 1)·gap wide: the strip shows 3.5 slides and 2.5 gutters
    assert.ok(Math.abs(vis * slideW + (vis - 1) * gap - width) < 1e-6, `${width}/${vis}/${gap}`)
  }
})

test('socket rows are one slide tall, rounded up to the 10px row pitch', () => {
  const rowGap = 2
  const slideH = carouselSlideH(1440, 3.5, 2, 0.8) // ≈ 512px
  const rows = carouselRows(slideH, rowGap, 10)
  // N rows are N tracks + N − 1 gaps tall: at least one slide, less than one more row of it
  const px = rows * 10 + (rows - 1) * rowGap
  assert.ok(px >= slideH, `${px} < ${slideH}`)
  assert.ok(px - slideH < 10 + rowGap, `${px} too far past ${slideH}`)
  assert.equal(rows, 43)
  // the floor keeps a sliver of a strip from collapsing the socket
  assert.equal(carouselRows(4, rowGap, 10), 8)
})

test('a wrap cycle covers the frame at any offset and continues the set in order', () => {
  const base = { w: 1440, h: 512, lines: 1, ratio: 0.8, gap: 2 }
  for (const n of [1, 2, 3, 5, 7, 12]) {
    const { pageW, perLine, cycle } = horizontalLayout({ ...base, n })
    // two copies cover the frame at the worst wrap offset (cycle ≥ frame + one page)
    assert.ok(cycle >= base.w + pageW - 1e-6, `n=${n}: cycle ${cycle} too short`)
    // a whole number of repeats of the set, so the seam reads n → 1
    assert.equal(perLine % n, 0, `n=${n}: perLine ${perLine} breaks the order at the seam`)
    assert.ok(Math.abs(cycle - perLine * (pageW + base.gap)) < 1e-6)
  }
  // 3 slides in a 4.5-slide frame: 6 pages (3, then 3 again), not 5
  assert.equal(horizontalLayout({ ...base, n: 3 }).perLine, 6)
})

test('rows share the frame height, and each row repeats whole when the rows interleave the set', () => {
  // 2 rows of a 4-page set: row 0 reads 0,2 / row 1 reads 1,3 — the cycle must be a
  // multiple of n / gcd(n, lines) = 2 pages so each row's seam continues its own sequence
  const two = horizontalLayout({ w: 1000, h: 402, lines: 2, ratio: 1, gap: 2, n: 4 })
  assert.equal(two.pageW, 200) // (402 − 2) / 2 tall, square
  assert.equal(two.perLine % 2, 0)
  // a page is as wide as its row is tall × the ratio
  assert.equal(horizontalLayout({ w: 1000, h: 400, lines: 1, ratio: 1.5, gap: 2, n: 4 }).pageW, 600)
})

// US-5, the mockups strip: every piece at its OWN aspect on one shared row height.
test('mixed strip: each piece is rowH × its ratio wide and the cycle covers the frame at any wrap offset', () => {
  const ratios = [9 / 16, 4 / 5, 4 / 3] // a 3-piece set, 9:16, 4:5, 4:3
  const gap = 2
  const rowH = 300
  const widths = ratios.map((r) => rowH * r) // 168.75, 240, 400
  const one = widths.reduce((s, x) => s + x + gap, 0) // 814.75
  // a 1440 frame needs two runs of the set per copy: 2 × 814.75 ≥ 1440
  const c = mixedStripCycle(ratios, { rowH, w: 1440, gap })
  assert.equal(c.reps, 2)
  assert.ok(Math.abs(c.cycle - 2 * one) < 1e-9)
  // two copies cover the frame at the worst wrap offset (just under one cycle): cycle ≥ frame
  assert.ok(c.cycle >= 1440)
  // a frame shorter than the set: one run is the cycle
  assert.deepEqual(mixedStripCycle(ratios, { rowH, w: 500, gap }), { reps: 1, cycle: one, seen: 3 })
  // a frame landing exactly on a whole run needs no extra repeat
  assert.equal(mixedStripCycle(ratios, { rowH, w: one, gap }).reps, 1)
  assert.equal(mixedStripCycle(ratios, { rowH, w: one + 1, gap }).reps, 2)
})

test('mixed strip: `seen` counts the first-copy pieces that start inside the frame; an empty row never moves', () => {
  const ratios = [9 / 16, 4 / 5, 4 / 3]
  // 168.75+2, 240+2, 400+2: starts at 0, 170.75, 412.75, then the second run at 814.75…
  assert.equal(mixedStripCycle(ratios, { rowH: 300, w: 170, gap: 2 }).seen, 1)
  assert.equal(mixedStripCycle(ratios, { rowH: 300, w: 171, gap: 2 }).seen, 2)
  // 1440 wide: the second run's pieces start at 814.75, 985.5, 1227.5 — all inside, the third run's 1629.5 not
  assert.equal(mixedStripCycle(ratios, { rowH: 300, w: 1440, gap: 2 }).seen, 6)
  assert.deepEqual(mixedStripCycle([], { rowH: 300, w: 1440, gap: 2 }), { reps: 0, cycle: 0, seen: 0 })
  // a degenerate frame (no row height) still terminates
  assert.ok(mixedStripCycle(ratios, { rowH: -50, w: 1440, gap: 0 }).seen >= 0)
})

test('mixed strip: a one-ratio set draws as horizontalLayout does (one shared piece width)', () => {
  // the carousel path is unchanged: pageW = rowH × ratio; the mixed cycle of n equal pieces is the same width
  const rowH = 512
  const one = horizontalLayout({ w: 1440, h: rowH, lines: 1, ratio: 0.8, gap: 2, n: 3 })
  const mixed = mixedStripCycle([0.8, 0.8, 0.8], { rowH, w: 1440, gap: 2 })
  assert.equal(one.pageW, rowH * 0.8)
  assert.ok(Math.abs(mixed.cycle / (mixed.reps * 3) - (one.pageW + 2)) < 1e-9)
})
