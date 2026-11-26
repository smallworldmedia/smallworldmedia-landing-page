// US-4 C: the /work wall plate's atlas layout per axis (src/components/work/world/fpDrumWall.js).
// y = DeckScroller columns (decks, album art), x = a carousel's rows, travel on u.
import test from 'node:test'
import assert from 'node:assert/strict'
import { layoutCols, layoutRows } from '../../src/components/work/world/fpDrumWall.js'

const W = 1152
const GAP = Math.max(1, Math.round(W / 320))
const pages = (n) => Array.from({ length: n }, (_, i) => ({ id: i }))

test('y axis: a fixed column count lays out that many columns, cycle stretched to a multiple of 16', () => {
  const H = 1152 // a square plate
  const l = layoutCols({ W, H, GAP, ratio: 1, pages: pages(12), colsOverride: 4 })
  assert.equal(l.cols, 4)
  assert.equal(l.rows, 0)
  assert.equal(l.atlasH % 16, 0)
  assert.ok(l.sigma >= 1)
  // column i, row n holds pages[(i + n·cols) % N]
  const c1 = l.cells.filter((c) => Math.abs(c.x - (l.pageW + GAP + 16)) < 1e-6)
  assert.equal(c1[0].page.id, 1)
  assert.equal(c1[1].page.id, 5)
})

test('x axis: one row of slides reads 1..N left to right and holds the whole set', () => {
  const ratio = 0.8
  const across = 3.5
  const H = Math.round(W / (across * ratio)) // a footprint sized for one row
  const l = layoutRows({ W, H, GAP, ratio, pages: pages(9), across })
  assert.equal(l.rows, 1)
  assert.equal(l.cols, 0)
  assert.equal(l.cells.length, 9)
  assert.deepEqual(l.cells.map((c) => c.page.id), [0, 1, 2, 3, 4, 5, 6, 7, 8])
  // cells advance left to right and the cycle tiles the atlas (multiple of 16) for the Repeat wrap
  for (let i = 1; i < l.cells.length; i++) assert.ok(l.cells[i].x > l.cells[i - 1].x)
  assert.equal(l.atlasW % 16, 0)
  assert.ok(l.sigma >= 1)
  // 3.5 slides across the plate width
  assert.ok(Math.abs(W / (l.pageW + GAP) - across) < 0.2)
  // shader geometry: (W, H, row pitch, rows)
  assert.equal(l.geom[3], 1)
})

test('x axis: a set shorter than the window repeats whole so the strip never runs dry', () => {
  const l = layoutRows({ W, H: 330, GAP, ratio: 1, pages: pages(3), across: 3.5 })
  assert.ok(l.cells.length >= 5)
  assert.equal(l.cells.length % 3, 0)
  assert.deepEqual(l.cells.slice(0, 4).map((c) => c.page.id), [0, 1, 2, 0])
})

test('x axis: a long set is capped by the atlas width, not dropped to a window', () => {
  const l = layoutRows({ W: 896, H: 821, GAP, ratio: 0.8, pages: pages(12), across: 1.5 })
  assert.ok(l.atlasW <= 8192 + 16)
  assert.ok(l.cells.length >= 12 || l.atlasW > 8192 - 700)
})

test('x axis: a tall footprint takes a second row (alternating travel), slides fill the plate height', () => {
  const l = layoutRows({ W, H: 380, GAP, ratio: 1.78, pages: pages(6), across: 3.5 })
  assert.equal(l.rows, 2)
  const slideH = (380 - GAP) / 2
  assert.ok(Math.abs(l.cells[0].h - slideH) < 1e-6)
  // row r cycles pages (r + k·rows) % N
  const row1 = l.cells.filter((c) => c.y > 0)
  assert.equal(row1[0].page.id, 1)
  assert.equal(row1[1].page.id, 3)
})
