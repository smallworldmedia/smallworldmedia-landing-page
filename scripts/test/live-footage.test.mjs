// US-4 (11-11, Nathan): the geometry of a live-footage grid and a visuals wall
// on the project page (liveFootageLayout.js; pure).
//   node --test scripts/test/live-footage.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  liveFootageLayout,
  liveFootagePlan,
  visualsWall,
  FOOTAGE_COLS,
  VISUALS_COLS,
  mockupsWall,
  mixedCycle,
  MOCKUPS_COLS,
} from '../../src/components/work/detail/liveFootageLayout.js'
import { GRID_ROW_PX } from '../../src/components/work/detail/tileGrid.js'

const still = (id, mediaType) => ({ _id: id, title: id, mediaType, imageUrl: `https://cdn.example.invalid/${id}.jpg` })
const clip = (id, mediaType) => ({ _id: id, title: id, mediaType, playbackId: `pb-${id}` })
const ids = (row) => row.items.map((a) => a._id)
const shape = (rows) => rows.map((r) => [r.kind, r.cols, ids(r), +r.ratio.toFixed(4)])

// Acceptance 5: a set mixing a 4x3 video, 3x4 stills and 9x16 stills.
const mixed = () => [
  still('v-34-a', 'static_3x4'),
  still('v-916-a', 'static_9x16'),
  still('v-34-b', 'static_3x4'),
  still('v-916-b', 'static_9x16'),
  still('v-34-c', 'static_3x4'),
  clip('h-43', 'motion_4x3'),
]

test('phone: verticals 2 across cropped to 3x4, the 4x3 full width', () => {
  const rows = liveFootageLayout(mixed(), { cols: FOOTAGE_COLS.phone })
  assert.deepEqual(shape(rows), [
    ['v', 2, ['v-34-a', 'v-916-a'], 0.75],
    ['v', 2, ['v-34-b', 'v-916-b'], 0.75],
    ['v', 2, ['v-34-c'], 0.75], // a trailing partial row, left-aligned at the full cell size
    ['h', 1, ['h-43'], +(4 / 3).toFixed(4)],
  ])
})

test('desktop: verticals 3 across, horizontals 2 across', () => {
  const items = [...mixed(), clip('h-169', 'motion_16x9'), clip('h-43b', 'motion_4x3')]
  const rows = liveFootageLayout(items, { cols: FOOTAGE_COLS.desktop })
  assert.deepEqual(shape(rows), [
    ['v', 3, ['v-34-a', 'v-916-a', 'v-34-b'], 0.75],
    ['v', 3, ['v-916-b', 'v-34-c'], 0.75],
    ['h', 2, ['h-43', 'h-169'], +(16 / 9).toFixed(4)], // shortest wins: the widest horizontal ratio
    ['h', 1, ['h-43b'], +(16 / 9).toFixed(4)], // a lone horizontal fills the full width (Nathan 11-11)
  ])
})

test('members keep their order: a change of orientation ends the row, nothing is moved', () => {
  const items = [still('v1', 'static_3x4'), clip('h1', 'motion_16x9'), still('v2', 'static_3x4'), still('v3', 'static_3x4')]
  const rows = liveFootageLayout(items, { cols: FOOTAGE_COLS.desktop })
  assert.deepEqual(rows.map((r) => [r.kind, ids(r)]), [['v', ['v1']], ['h', ['h1']], ['v', ['v2', 'v3']]])
  // a partial row of verticals keeps the full row's cell size; a lone horizontal goes full width
  assert.deepEqual(rows.map((r) => r.cols), [3, 1, 3])
  assert.deepEqual(rows.flatMap(ids), ['v1', 'h1', 'v2', 'v3'])
  // a square counts as vertical, as it does for a tile; one shape per orientation across the whole set
  const sq = liveFootageLayout([still('sq', 'static_1x1'), still('v', 'static_3x4')], { cols: FOOTAGE_COLS.desktop })
  assert.deepEqual(shape(sq), [['v', 3, ['sq', 'v'], 1]])
  assert.deepEqual(liveFootageLayout([], { cols: FOOTAGE_COLS.desktop }), [])
})

test('plan: row heights follow the cell width ÷ the row shape; the socket is whole grid rows tall', () => {
  const items = [still('a', 'static_3x4'), still('b', 'static_3x4'), still('c', 'static_3x4'), clip('d', 'motion_16x9'), clip('e', 'motion_16x9')]
  const plan = liveFootagePlan(items, { phone: false, width: 1440, gap: 2 })
  assert.equal(plan.gap, 2)
  const cellV = (1440 - 2 * 2) / 3
  const cellH = (1440 - 2) / 2
  assert.deepEqual(plan.heights.map((h) => +h.toFixed(2)), [+(cellV / 0.75).toFixed(2), +(cellH / (16 / 9)).toFixed(2)])
  const px = plan.heights[0] + plan.heights[1] + 2
  assert.equal(plan.spanRows, Math.ceil((px + 2) / (GRID_ROW_PX + 2)))
  // the span holds the content, and not a whole extra row's pitch beyond it
  const spanPx = plan.spanRows * GRID_ROW_PX + (plan.spanRows - 1) * 2
  assert.ok(spanPx >= px && spanPx - px < GRID_ROW_PX + 2)
  // a phone is narrower and puts the horizontals full width, so it is taller per piece
  const phone = liveFootagePlan(items, { phone: true, width: 390, gap: 2 })
  assert.deepEqual(phone.rows.map((r) => [r.kind, r.cols, r.items.length]), [['v', 2, 2], ['v', 2, 1], ['h', 1, 1], ['h', 1, 1]])
  // before the grid is measured the fallback width and gap apply
  assert.equal(liveFootagePlan(items, {}).gap, 2)
  assert.equal(liveFootagePlan(items, {}).spanRows, plan.spanRows)
})

test('visuals wall: 2 columns on a desktop, 1 on a phone; as tall as the whole set, capped at maxRows', () => {
  const items = [clip('l1', 'motion_16x9'), clip('l2', 'motion_16x9'), clip('l3', 'motion_4x3')]
  const pitch = (px) => Math.ceil((px + 2) / (GRID_ROW_PX + 2))
  const desk = visualsWall(items, { phone: false, width: 1440, gap: 2 })
  assert.equal(desk.cols, VISUALS_COLS.desktop)
  assert.equal(desk.cols, 2)
  assert.equal(desk.ratio, 16 / 9) // sequenceRatio: the shape that crops the set least
  const deskPx = (1440 - 2) / 2 / (16 / 9)
  // 3 loops in 2 columns: 2 loops per column, every loop once
  assert.equal(desk.spanRows, pitch(2 * deskPx + 2))
  const phone = visualsWall(items, { phone: true, width: 390, gap: 2 })
  assert.equal(phone.cols, 1)
  assert.equal(phone.spanRows, pitch(3 * (390 / (16 / 9)) + 2 * 2))
  assert.ok(phone.spanRows < desk.spanRows)
  // a long set stops at the cap and drifts; the cap never cuts under one loop
  const many = Array.from({ length: 18 }, (_, i) => clip(`m${i}`, 'motion_16x9'))
  assert.equal(visualsWall(many, { phone: false, width: 1440, gap: 2, maxRows: 68 }).spanRows, 68)
  assert.equal(visualsWall(many, { phone: false, width: 1440, gap: 2, maxRows: 3 }).spanRows, pitch(deskPx))
  // one loop: one loop tall
  assert.equal(visualsWall([items[0]], { phone: false, width: 1440, gap: 2, maxRows: 68 }).spanRows, pitch(deskPx))
})

// US-5: the mockups wall — every piece at its own aspect, masonry columns.
const mockupSet = () => [
  clip('a-169', 'motion_16x9'),
  clip('b-916', 'motion_9x16'),
  clip('c-169', 'motion_16x9'),
  still('d-34', 'static_3x4'),
  still('e-169', 'static_16x9'),
]
const ratioById = { 'a-169': 16 / 9, 'b-916': 9 / 16, 'c-169': 16 / 9, 'd-34': 3 / 4, 'e-169': 16 / 9 }
const pitchRows = (px) => Math.ceil((px + 2) / (GRID_ROW_PX + 2))

test('mockups wall: 2 columns on a desktop, 1 on a phone', () => {
  assert.deepEqual(MOCKUPS_COLS, { desktop: 2, phone: 1 })
  assert.equal(mockupsWall(mockupSet(), { phone: false, width: 1440, gap: 2 }).columns.length, 2)
  const phone = mockupsWall(mockupSet(), { phone: true, width: 390, gap: 2 })
  assert.equal(phone.cols, 1)
  // a phone's one column takes the set whole, in set order
  assert.deepEqual(phone.columns.map((c) => c.map((a) => a._id)), [['a-169', 'b-916', 'c-169', 'd-34', 'e-169']])
})

test('mockups wall: a 9x16 beside a 16x9 — shortest column next, set order kept, columns balanced', () => {
  const wall = mockupsWall(mockupSet(), { phone: false, width: 1440, gap: 2 })
  const colW = (1440 - 2) / 2
  const hOf = (id) => colW / ratioById[id]
  // a → col 0; the tall 9x16 b → col 1; c (col 0 is shorter) → col 0; d (col 0 still shorter) → col 0; e → col 1
  assert.deepEqual(wall.columns.map((c) => c.map((a) => a._id)), [['a-169', 'c-169', 'd-34'], ['b-916', 'e-169']])
  // each column's px = its pieces at their own aspect + a gap after each
  assert.deepEqual(
    wall.heights.map((h) => +h.toFixed(3)),
    wall.columns.map((c) => +c.reduce((s, a) => s + hOf(a._id) + 2, 0).toFixed(3))
  )
  // balanced: the columns end within one piece of each other
  const tallestPiece = Math.max(...Object.keys(ratioById).map(hOf))
  assert.ok(Math.abs(wall.heights[0] - wall.heights[1]) <= tallestPiece, `${wall.heights}`)
  // the 9x16 is taller than it is wide, the 16x9 wider than tall, uncropped: height = width ÷ own ratio
  assert.ok(hOf('b-916') > colW && hOf('a-169') < colW)
  // within a column the pieces keep set order
  const order = wall.columns.flat().map((a) => a._id)
  for (const col of wall.columns) {
    const idx = col.map((a) => ['a-169', 'b-916', 'c-169', 'd-34', 'e-169'].indexOf(a._id))
    assert.deepEqual(idx, [...idx].sort((x, y) => x - y))
  }
  assert.equal(order.length, 5)
})

test('mockups wall: the socket holds the tallest column, capped at maxRows, never under the shortest piece', () => {
  const colW = (1440 - 2) / 2
  const wall = mockupsWall(mockupSet(), { phone: false, width: 1440, gap: 2 })
  assert.equal(wall.spanRows, pitchRows(Math.max(...wall.heights) - 2))
  const capped = mockupsWall(mockupSet(), { phone: false, width: 1440, gap: 2, maxRows: 60 })
  assert.equal(capped.spanRows, 60)
  // the cap never cuts under the shortest piece (a 16x9)
  assert.equal(mockupsWall(mockupSet(), { phone: false, width: 1440, gap: 2, maxRows: 1 }).spanRows, pitchRows(colW / (16 / 9)))
  // a phone is one narrow column of everything
  const phone = mockupsWall(mockupSet(), { phone: true, width: 390, gap: 2 })
  assert.equal(phone.spanRows, pitchRows(phone.heights[0] - 2))
  // before the grid is measured the fallback width and gap apply
  assert.equal(mockupsWall(mockupSet()).spanRows, wall.spanRows)
  assert.deepEqual(mockupsWall([]).columns, [[], []])
})

test('mockups cycle: a column repeats whole until it covers the frame, so the seam reads last → first', () => {
  const colW = 719
  const ratios = [16 / 9, 9 / 16]
  const one = colW / (16 / 9) + 2 + colW / (9 / 16) + 2
  // a frame shorter than the column: one run is the cycle
  assert.deepEqual(mixedCycle(ratios, { colW, h: 500, gap: 2 }), { reps: 1, cycle: one })
  // a frame taller than the column: whole repeats, cycle ≥ the frame
  const tall = mixedCycle(ratios, { colW, h: one * 2.5, gap: 2 })
  assert.equal(tall.reps, 3)
  assert.ok(Math.abs(tall.cycle - 3 * one) < 1e-6 && tall.cycle >= one * 2.5)
  // an empty column has no cycle, so its strip never moves
  assert.deepEqual(mixedCycle([], { colW, h: 500, gap: 2 }), { reps: 0, cycle: 0 })
})
