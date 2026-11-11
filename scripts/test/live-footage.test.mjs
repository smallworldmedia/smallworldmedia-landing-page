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
    ['h', 2, ['h-43b'], +(16 / 9).toFixed(4)],
  ])
})

test('members keep their order: a change of orientation ends the row, nothing is moved', () => {
  const items = [still('v1', 'static_3x4'), clip('h1', 'motion_16x9'), still('v2', 'static_3x4'), still('v3', 'static_3x4')]
  const rows = liveFootageLayout(items, { cols: FOOTAGE_COLS.desktop })
  assert.deepEqual(rows.map((r) => [r.kind, ids(r)]), [['v', ['v1']], ['h', ['h1']], ['v', ['v2', 'v3']]])
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

test('visuals wall: 2 columns on a desktop, 1 on a phone, one whole loop tall at the set ratio', () => {
  const items = [clip('l1', 'motion_16x9'), clip('l2', 'motion_16x9'), clip('l3', 'motion_4x3')]
  const desk = visualsWall(items, { phone: false, width: 1440, gap: 2 })
  assert.equal(desk.cols, VISUALS_COLS.desktop)
  assert.equal(desk.cols, 2)
  assert.equal(desk.ratio, 16 / 9) // sequenceRatio: the shape that crops the set least
  const deskPx = (1440 - 2) / 2 / (16 / 9)
  assert.equal(desk.spanRows, Math.ceil((deskPx + 2) / (GRID_ROW_PX + 2)))
  const phone = visualsWall(items, { phone: true, width: 390, gap: 2 })
  assert.equal(phone.cols, 1)
  assert.equal(phone.spanRows, Math.ceil((390 / (16 / 9) + 2) / (GRID_ROW_PX + 2)))
  assert.ok(phone.spanRows < desk.spanRows)
})
