// The phone blurb hold (SQ-26, 11-07) — the parts checkable without a browser.
// The BEHAVIOUR (seat, hold, spring back, commit, both directions, the
// next-project band still committing) is measured by a real touch probe on a
// served build; this file pins what that probe cannot see cheaply:
//
//   1. the geometry — where a section seats, where a commit lands, what
//      counts as the centre being crossed;
//   2. the preview dials' parsing (?blurbhold, ?blurbsec, ?scroll);
//   3. the shared rubber band's arithmetic (rubberBand.js stepAccum), which
//      the next-project band (one-sided) and the hold (signed) both ride;
//   4. the SOURCE contract that keeps desktop byte-identical: the section CSS
//      lives only inside the phone query, and the engine is gated on a finger.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  HOLD_MQ,
  PHONE_MQ,
  BLURB_SEC,
  SEAT_TOL_PX,
  centreOffset,
  seatY,
  commitY,
  crossedCentre,
  readBlurbTune,
} from '../../src/lib/blurbHoldMath.js'
import { stepAccum } from '../../src/lib/rubberBand.js'
import { SCROLL_TRIGGER_WORK_PX, TOUCH_GAIN } from '../../src/lib/motion.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const css = fs.readFileSync(`${root}src/styles/project-detail.css`, 'utf8')

/* — geometry — */

test('a section seats with its centre on the viewport centre', () => {
  // 844 viewport, a 675px section 900px below the top of the viewport, page at 1000
  const y = seatY(900, 675, 844, 1000, 5000)
  assert.equal(y, 1000 + 900 + 675 / 2 - 844 / 2)
  // at that scroll the section's centre sits exactly on the viewport's
  assert.equal(centreOffset(900 - (y - 1000), 675, 844), 0)
})

test('a seat clamps to the page', () => {
  assert.equal(seatY(-5000, 675, 844, 100, 5000), 0)
  assert.equal(seatY(9000, 675, 844, 100, 5000), 5000)
})

test('a forward commit lands the next content, a backward one the previous', () => {
  // seated section: top at 84.5, height 675 (0.8 of 844, centred)
  const top = (844 - 675) / 2
  const fwd = commitY(1, top, 675, 844, 2000, 9000)
  assert.equal(fwd, 2000 + top + 675) // the section's bottom edge on the viewport top
  const back = commitY(-1, top, 675, 844, 2000, 9000)
  assert.equal(back, 2000 + top - 844) // the section's top edge on the viewport bottom
})

test('a commit clamps to the page', () => {
  assert.equal(commitY(1, 84, 675, 844, 8900, 9000), 9000)
  assert.equal(commitY(-1, 84, 675, 844, 300, 9000), 0)
})

test('crossing the centre is a sign change, in either direction', () => {
  assert.equal(crossedCentre(40, -3), true) // scrolling down past the centre
  assert.equal(crossedCentre(-40, 3), true) // scrolling up past it
  assert.equal(crossedCentre(40, 0), true) // landing exactly on it
  assert.equal(crossedCentre(40, 12), false) // still above
  assert.equal(crossedCentre(-40, -12), false)
})

test('leaving the seat is not a crossing, so a commit glide cannot re-catch its own section', () => {
  assert.equal(crossedCentre(0, -9), false)
  assert.equal(crossedCentre(0, 9), false)
})

/* — the dials — */

test('the dials default to the hold on, 0.8 sections, the house trigger', () => {
  assert.deepEqual(readBlurbTune(''), { hold: true, sec: null, trigger: null })
  assert.equal(BLURB_SEC, 0.8)
})

test('?blurbhold=0 turns the hold off and nothing else does', () => {
  assert.equal(readBlurbTune('?blurbhold=0').hold, false)
  assert.equal(readBlurbTune('?blurbhold=1').hold, true)
  assert.equal(readBlurbTune('?blurbhold=junk').hold, true)
})

test('?blurbsec and ?scroll take positive numbers only', () => {
  assert.equal(readBlurbTune('?blurbsec=0.6').sec, 0.6)
  assert.equal(readBlurbTune('?blurbsec=0').sec, null)
  assert.equal(readBlurbTune('?blurbsec=-1').sec, null)
  assert.equal(readBlurbTune('?scroll=300').trigger, 300)
  assert.equal(readBlurbTune('?scroll=nope').trigger, null)
})

/* — the shared rubber band — */

test('an unsigned band never goes below zero and commits at the trigger', () => {
  let s = stepAccum(0, -300, 500)
  assert.equal(s.accum, 0) // the next-project band only fills onward
  s = stepAccum(0, 250, 500)
  assert.deepEqual([s.accum, s.fill, s.commit], [250, 0.5, 0])
  s = stepAccum(s.accum, 250, 500)
  assert.deepEqual([s.accum, s.fill, s.commit], [500, 1, 1])
})

test('a signed band runs both ways, commits with its sign, and crosses zero', () => {
  let s = stepAccum(0, -250, 500, true)
  assert.deepEqual([s.accum, s.fill, s.commit], [-250, -0.5, 0])
  s = stepAccum(s.accum, 100, 500, true) // back toward the seat
  assert.deepEqual([s.accum, s.fill, s.commit], [-150, -0.3, 0])
  s = stepAccum(s.accum, -400, 500, true)
  assert.equal(s.commit, -1)
  assert.equal(s.fill, -1) // the fill never draws past the trigger
})

test('the house trigger is 100px of finger at the house gain', () => {
  // The hold's copy travels trigger / gain: its full pull is the finger's.
  assert.equal(SCROLL_TRIGGER_WORK_PX / TOUCH_GAIN, 100)
  assert.equal(stepAccum(0, 99 * TOUCH_GAIN, SCROLL_TRIGGER_WORK_PX).commit, 0)
  assert.equal(stepAccum(0, 100 * TOUCH_GAIN, SCROLL_TRIGGER_WORK_PX).commit, 1)
})

/* — the source contract — */

test('the hold needs a finger, the sections do not', () => {
  assert.match(HOLD_MQ, /pointer: coarse/)
  assert.ok(HOLD_MQ.startsWith(PHONE_MQ))
  assert.equal(PHONE_MQ, '(max-width: 768px)')
  assert.equal(SEAT_TOL_PX, 2) // NextProjectBand's atEnd tolerance
})

test('the 80% section rule lives only inside the phone query', () => {
  // Outside it the desktop CSS must be byte-identical: strip every
  // @media (max-width: 768px) block and the section rule must be gone.
  let depth = 0
  let outside = ''
  const lines = css.split('\n')
  let inPhone = false
  for (const line of lines) {
    if (!inPhone && /^@media \(max-width: 768px\)\s*\{/.test(line)) {
      inPhone = true
      depth = 1
      continue
    }
    if (inPhone) {
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
      if (depth <= 0) inPhone = false
      continue
    }
    outside += line + '\n'
  }
  assert.ok(!/--blurb-sec/.test(outside), 'section height leaked outside the phone query')
  assert.match(css, /min-height: calc\(var\(--blurb-sec, 0\.8\) \* 100svh\)/)
})
