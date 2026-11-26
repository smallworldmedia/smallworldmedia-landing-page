// ctaNames: /work's [PREVIOUS] / [NEXT] chips read the neighbouring client names (SQ-80).
//   node --test scripts/test/cta-names.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { NAME_GAP_EM, ctaNamesOn, neighbourName, rollGeometry } from '../../src/lib/ctaNames.js'

const worlds = [
  { slug: 'cheetah-print', clientName: 'Cheetah Print', title: 'Spots' },
  { slug: 'hhs', clientName: 'Heavy House Society', title: 'Brand' },
  { slug: 'bedouin', clientName: 'Bedouin', title: 'Tour' },
]

test('the neighbours read the CLIENT name, not the project title', () => {
  assert.equal(neighbourName(worlds, 1, -1), 'Cheetah Print')
  assert.equal(neighbourName(worlds, 1, 1), 'Bedouin')
})

test('World 0 has no previous and the last World no next: nothing, or the kept name', () => {
  assert.equal(neighbourName(worlds, 0, -1), '')
  assert.equal(neighbourName(worlds, 2, 1), '')
  // the previous chip wipes out while still mounted: it holds the last real name
  assert.equal(neighbourName(worlds, 0, -1, 'Cheetah Print'), 'Cheetah Print')
  assert.equal(neighbourName([], 0, 1), '')
  assert.equal(neighbourName(undefined, 0, 1), '')
})

test('a neighbour with no client name falls back (the chip then shows the word)', () => {
  assert.equal(neighbourName([{}, { clientName: '  ' }, { clientName: 'X' }], 1, -1), '')
  assert.equal(neighbourName([{ clientName: 'A' }, { clientName: '  ' }], 0, 1, 'kept'), 'kept')
})

test('?ctanames: names by default, =0 (or off/false) restores the words', () => {
  assert.equal(ctaNamesOn(''), true)
  assert.equal(ctaNamesOn('?pager=rail'), true)
  assert.equal(ctaNamesOn('?ctanames=1'), true)
  assert.equal(ctaNamesOn('?ctanames=0'), false)
  assert.equal(ctaNamesOn('?x=1&ctanames=off'), false)
  assert.equal(ctaNamesOn(undefined), true)
})

test('a name that fits the label box sits still: no roll', () => {
  assert.deepEqual(rollGeometry({ textW: 50, windowW: 62, gapPx: 19, pxs: 30, nowMs: 1234 }), { rolls: false })
  // exactly the box, and a whole-pixel measuring wobble over it, are both fits
  assert.equal(rollGeometry({ textW: 62, windowW: 62, gapPx: 19, pxs: 30, nowMs: 0 }).rolls, false)
  assert.equal(rollGeometry({ textW: 63, windowW: 62, gapPx: 19, pxs: 30, nowMs: 0 }).rolls, false)
  // two pixels over is a name that runs past the box: it rolls
  assert.equal(rollGeometry({ textW: 64, windowW: 62, gapPx: 19, pxs: 30, nowMs: 0 }).rolls, true)
  // an unmeasured (display:none / not yet laid out) box never arms a roll
  assert.equal(rollGeometry({ textW: 0, windowW: 62, gapPx: 19, pxs: 30, nowMs: 0 }).rolls, false)
  assert.equal(rollGeometry({ textW: 90, windowW: 0, gapPx: 19, pxs: 30, nowMs: 0 }).rolls, false)
})

test('a wider name rolls by exactly one copy + one gap, at the pager speed', () => {
  const g = rollGeometry({ textW: 90, windowW: 62, gapPx: 19.2, pxs: 30, nowMs: 0 })
  assert.equal(g.rolls, true)
  assert.equal(g.shiftPx, 90 + 19.2) // NOT 90 + 19.2/2: the wrap lands on the same pixels
  assert.ok(Math.abs(g.durS - (90 + 19.2) / 30) < 1e-9)
  assert.equal(g.delayS, -0)
})

test('the roll phase is the wall clock: a remount at the same time lands at the same spot', () => {
  const a = rollGeometry({ textW: 90, windowW: 62, gapPx: 19.2, pxs: 30, nowMs: 100000 })
  const b = rollGeometry({ textW: 90, windowW: 62, gapPx: 19.2, pxs: 30, nowMs: 100000 })
  assert.equal(a.delayS, b.delayS)
  // delay is negative, within one period, and (now mod period) in magnitude
  assert.ok(a.delayS <= 0 && a.delayS > -a.durS)
  assert.ok(Math.abs(-a.delayS - ((100000 / 1000) % a.durS)) < 1e-9)
  // a later mount is further into the same loop (modulo the period)
  const c = rollGeometry({ textW: 90, windowW: 62, gapPx: 19.2, pxs: 30, nowMs: 101000 })
  const advance = (((-c.delayS - -a.delayS) % a.durS) + a.durS) % a.durS
  assert.ok(Math.abs(advance - (1 % a.durS)) < 1e-9)
})

test('the marquee gap is one shared number', () => {
  assert.equal(NAME_GAP_EM, 1.5)
})
