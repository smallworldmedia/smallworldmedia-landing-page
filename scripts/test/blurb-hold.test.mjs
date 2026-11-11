// The phone blurb hold (SQ-26, reworked SQ-27, 11-07) — the parts checkable
// without a browser. The BEHAVIOUR (arrival, hold, spring back, commit, both
// directions, the next-project band still committing) is measured by a real
// touch probe on a served build; this file pins what that probe cannot see
// cheaply:
//
//   1. the geometry — a section seats with its TOP on the viewport top, what
//      is too tall to hold, which seat a page meets next;
//   2. the arrival — the catch condition, and the spring that takes the page
//      onto the seat: velocity-continuous at the catch, never past the seat,
//      starting from rest without a velocity step;
//   3. the exit — momentum that decays at iOS's rate, distance v·τ;
//   4. the preview dials' parsing;
//   5. the shared rubber band's arithmetic (rubberBand.js stepAccum), which
//      the next-project band (one-sided) and the hold (signed) both ride;
//   6. the SOURCE contract that keeps desktop byte-identical: the section CSS
//      lives only inside the phone query, and the engine is gated on a finger.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  HOLD_MQ,
  PHONE_MQ,
  BLURB_PEEK,
  SEAT_TOL_PX,
  SNAP_PX,
  MOMENTUM_DECAY,
  MIN_V,
  BLURB_TRIGGER_PX,
  seatY,
  grownHeight,
  growHeight,
  entryProgress,
  latchProgress,
  offscreenSide,
  resetSide,
  holdable,
  seatWindow,
  fitTextScale,
  seatAtEnd,
  clampScroll,
  BLURB_TEXT,
  FIT_PASSES,
  shownPx,
  shownEnough,
  nextSeat,
  catchOmega,
  shouldCatch,
  catchStartV,
  springAt,
  momentumTau,
  momentumStep,
  momentumDistance,
  emaVelocity,
  readBlurbTune,
} from '../../src/lib/blurbHoldMath.js'
import { stepAccum } from '../../src/lib/rubberBand.js'
import { SCROLL_TRIGGER_WORK_PX, TOUCH_GAIN, LENIS_TUNING } from '../../src/lib/motion.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const css = fs.readFileSync(`${root}src/styles/project-detail.css`, 'utf8')
const omega = catchOmega(LENIS_TUNING.lerp)
const FRAME = 1000 / 60

/* — geometry — */

test('a section seats with its top on the viewport top', () => {
  // a section 900px below the top of the viewport, page at 1000
  const y = seatY(900, 1000, 5000)
  assert.equal(y, 1900)
  // at that scroll the section's top sits exactly on the viewport's
  assert.equal(900 - (y - 1000), 0)
})

test('a seat clamps to the page', () => {
  assert.equal(seatY(-5000, 100, 5000), 0)
  assert.equal(seatY(9000, 100, 5000), 5000)
})

test('a seated section leaves the peek of the next media showing below it', () => {
  const vh = 844
  const h = (1 - BLURB_PEEK) * vh // a GROWN section
  assert.equal(BLURB_PEEK, 0.12) // Nathan's 88% (SQ-30)
  // top at 0, so nothing above it, and the viewport below it is the peek
  assert.ok(Math.abs(vh - h - BLURB_PEEK * vh) < 1e-9)
})

test('a section that fits its seat window is held, a taller one is read natively', () => {
  const g = 1 - BLURB_PEEK
  assert.equal(holdable(g * 844, 844), true) // a grown section itself
  assert.equal(holdable(g * 844 + SEAT_TOL_PX, 844), true) // rounding
  assert.equal(holdable(g * 667 + 1, 667), true)
  assert.equal(holdable(g * 667 + 40, 667), false) // long copy on a short phone
  assert.equal(holdable(900, 667), false)
  assert.equal(holdable(0.6 * 844 + 40, 844, 0.4), false) // the peek dial moves the window
  assert.equal(holdable(0.6 * 844, 844, 0.4), true)
})

test('the seat window is what holdable measures against', () => {
  for (const [vh, peek] of [[844, 0.1], [660, 0.1], [553, 0.1], [844, 0.4]]) {
    const w = seatWindow(vh, peek)
    assert.equal(w, (1 - peek) * vh + SEAT_TOL_PX)
    assert.equal(holdable(w, vh, peek), true)
    assert.equal(holdable(w + 0.01, vh, peek), false)
  }
})

/* — the text fit (SQ-28) — */

// The measured model: padding that does not scale + copy that rewraps, so height ~ a·s² + b.
const model = (a, b) => (s) => a * s * s + b
const WIN = seatWindow(844) // 0.88 × 844 + 2

test('a page whose tallest blurb fits at the target keeps the target in one measurement', () => {
  let n = 0
  const s = fitTextScale((x) => (n++, model(300, 100)(x)), WIN)
  assert.equal(s, BLURB_TEXT)
  assert.equal(n, 1)
})

test('a page with a long blurb takes the largest scale that measured as fitting', () => {
  // bedouin-like at 393×660 (svh): 0.942 of the window at scale 1 → over at 1.25
  const win = seatWindow(660)
  const a = (0.942 * (1 - BLURB_PEEK) * 660 - 90) // height 0.942 of the window at s=1, 90px of padding
  const h = model(a, 90)
  const seen = []
  const s = fitTextScale((x) => (seen.push(x), h(x)), win)
  assert.ok(s >= 1 && s < BLURB_TEXT, `scale ${s}`)
  assert.ok(h(s) <= win, 'the answer measured as fitting')
  assert.ok(seen.includes(s), 'and it was measured')
  assert.ok(seen.length <= FIT_PASSES)
  assert.ok(s > 1.02, 'it is not needlessly small') // the model fits well above 1
})

test('the fit never measures more than its passes and never answers a scale it did not measure fitting except the floor', () => {
  for (const a of [150, 300, 450, 600, 900, 1500]) {
    for (const vh of [553, 660, 844, 932]) {
      const win = seatWindow(vh)
      const seen = []
      const h = model(a, 120)
      const s = fitTextScale((x) => (seen.push(x), h(x)), win)
      assert.ok(seen.length <= FIT_PASSES)
      assert.ok(s >= 1 && s <= BLURB_TEXT)
      assert.ok(s === 1 || (h(s) <= win && seen.includes(s)), `a=${a} vh=${vh} s=${s}`)
    }
  }
})

test('a blurb that does not fit even at today’s size leaves the page at the floor', () => {
  assert.equal(fitTextScale(model(900, 100), seatWindow(553)), 1) // h(1) = 1000 > 499
  // and it stops measuring once it is at the floor
  let n = 0
  fitTextScale((x) => (n++, model(900, 100)(x)), seatWindow(553))
  assert.ok(n <= FIT_PASSES)
})

test('the floor is 1, or the target when that is lower', () => {
  assert.equal(fitTextScale(model(100, 50), WIN, 0.8), 0.8)
  assert.equal(fitTextScale(model(2000, 50), WIN, 0.8), 0.8) // nothing smaller to try
  assert.equal(fitTextScale(model(50, 50), WIN, 3), 3)
  assert.ok(fitTextScale(model(500, 50), WIN, 3) < 3)
})

test('an unmeasurable page keeps today’s size', () => {
  assert.equal(fitTextScale(() => NaN, WIN), 1)
  assert.equal(fitTextScale(() => Infinity, WIN), 1)
})

test('the page end and an overscroll', () => {
  assert.equal(seatAtEnd(5000, 5000), true)
  assert.equal(seatAtEnd(4998.5, 5000), true) // a section seat the end clamped
  assert.equal(seatAtEnd(4990, 5000), false)
  assert.equal(clampScroll(-42, 5000), 0) // the top bounce
  assert.equal(clampScroll(5060, 5000), 5000) // the bottom bounce
  assert.equal(clampScroll(1234.5, 5000), 1234.5)
  // a bounce that settles back never counts as movement: every sample reads 0
  const samples = [-30, -18, -9, -2, 0].map((y) => clampScroll(y, 5000))
  assert.deepEqual(samples.map((y, i) => (i ? y - samples[i - 1] : 0)), [0, 0, 0, 0, 0])
})

test('shownPx counts the part of a section on screen', () => {
  assert.equal(shownPx(100, 700, 844), 700)
  assert.equal(shownPx(-300, 700, 844), 400) // top cut off
  assert.equal(shownPx(600, 700, 844), 244) // bottom cut off
  assert.equal(shownPx(900, 700, 844), 0)
  assert.equal(shownPx(-800, 700, 844), 0)
})

test('an entrance plays once a quarter of the section is on screen', () => {
  assert.equal(shownEnough(700, 760, 844), false) // 144px of 760
  assert.equal(shownEnough(600, 760, 844), true) // 244px
  assert.equal(shownEnough(-100, 1400, 667), true) // a tall one, a quarter of the viewport
})

test('the seat a page meets next is the nearest one ahead in its direction', () => {
  const seats = [1000, 2600, 4200]
  assert.equal(nextSeat(seats, 0, 1), 0)
  assert.equal(nextSeat(seats, 1500, 1), 1)
  assert.equal(nextSeat(seats, 5000, 1), -1)
  assert.equal(nextSeat(seats, 5000, -1), 2) // coming back up
  assert.equal(nextSeat(seats, 1500, -1), 0)
  assert.equal(nextSeat(seats, 500, -1), -1)
})

test('a seat the page has just left is not met again until the direction reverses', () => {
  const seats = [1000, 2600]
  // seated at 1000, committed down: the seat is behind, the next one ahead
  assert.equal(nextSeat(seats, 1000 + 40, 1), 1)
  // standing on it is not ahead either way
  assert.equal(nextSeat(seats, 1000, 1), 1)
  assert.equal(nextSeat(seats, 1000, -1), -1)
  // turn back down the page and the same seat is ahead again
  assert.equal(nextSeat(seats, 1000 + 40, -1), 0)
})

/* — arrival — */

test('the slowdown runs on Lenis’s rate at the house lerp', () => {
  assert.equal(LENIS_TUNING.lerp, 0.165)
  assert.ok(Math.abs(omega - (0.165 * 60) / 1000) < 1e-12)
  assert.equal(catchOmega(2), catchOmega(1)) // lerp is capped at 1 as in footerDamp
})

test('the page is taken when it is v/ω from the seat, a frame early', () => {
  const v = 3 // px/ms
  const edge = v / omega // 303px
  assert.equal(shouldCatch(edge, v, omega, FRAME), true)
  assert.equal(shouldCatch(edge + v * FRAME, v, omega, FRAME), true) // the last frame that is still far enough
  assert.equal(shouldCatch(edge + v * FRAME + 1, v, omega, FRAME), false) // not yet
  assert.equal(shouldCatch(edge - 100, v, omega, FRAME), true) // late is still caught
})

test('nothing is caught that is at rest, moving away, or on the seat', () => {
  assert.equal(shouldCatch(200, 0, omega, FRAME), false)
  assert.equal(shouldCatch(200, -2, omega, FRAME), false)
  assert.equal(shouldCatch(SEAT_TOL_PX, 2, omega, FRAME), false)
  assert.equal(shouldCatch(200, 2, 0, FRAME), false)
})

test('the slowdown starts at the page’s own speed, capped at what cannot overshoot', () => {
  assert.equal(catchStartV(300, 1, omega), 1) // far enough: its own speed
  assert.ok(Math.abs(catchStartV(100, 5, omega) - omega * 100) < 1e-12) // too fast: ω·d
  assert.equal(catchStartV(300, 0, omega), 0) // from rest
})

test('the spring begins at the page’s position and velocity', () => {
  const s = springAt(-300, 1.2, omega, 0)
  assert.equal(s.e, -300)
  assert.equal(s.v, 1.2)
})

// Walk a native momentum (iOS rate, 60Hz) toward a seat the way the engine's
// scroll handler does, take the page at the first frame shouldCatch says, and
// play the spring out. Returns what the oracle measures.
function arrive(v0, seatAhead) {
  let y = 0
  let v = v0
  let prev = y
  for (let n = 0; n < 5000; n++) {
    const d = seatAhead - y
    if (shouldCatch(d, v, omega, FRAME)) {
      const start = catchStartV(d, v, omega)
      const e0 = -d
      let t = 0
      let maxPast = 0
      let lastE = e0
      let monotone = true
      let steps = 0
      while (t < 5000) {
        t += FRAME
        const s = springAt(e0, start, omega, t)
        if (s.e > maxPast) maxPast = s.e
        if (s.e < lastE - 1e-9) monotone = false // moving away from the seat
        lastE = s.e
        steps++
        if (Math.abs(s.e) <= SNAP_PX) break
      }
      return { d, v, start, step: v - start, maxPast, monotone, settleMs: t, steps }
    }
    const next = momentumStep(v, FRAME)
    prev = y
    y += next.dy
    v = next.v
    if (y > seatAhead + 1) return { missed: true, prev }
  }
  return { missed: true }
}

test('the catch is velocity-continuous, never past the seat, and settles', () => {
  for (const v0 of [0.8, 1.5, 3, 5, 8]) {
    const seatAhead = momentumDistance(v0) * 0.75 // native momentum would carry well past it
    const r = arrive(v0, seatAhead)
    assert.ok(!r.missed, `v0 ${v0} was never caught`)
    assert.ok(r.d >= r.v / omega - 1e-6, `v0 ${v0} was caught late (${r.d} < ${r.v / omega})`)
    assert.ok(r.step < 1e-9, `v0 ${v0} stepped by ${r.step} px/ms at the catch`)
    assert.ok(r.maxPast <= 0, `v0 ${v0} overshot by ${r.maxPast}`)
    assert.ok(r.monotone, `v0 ${v0} backed off the seat`)
    assert.ok(r.settleMs < 2500, `v0 ${v0} took ${r.settleMs}ms`)
  }
})

test('a page that was going to stop short is not caught', () => {
  const v0 = 2
  const seatAhead = momentumDistance(v0) * 1.3 // beyond where the momentum dies
  assert.equal(arrive(v0, seatAhead).missed, true)
})

test('a spring never passes the seat for any speed the catch can start at', () => {
  for (const d of [20, 80, 300, 700]) {
    for (const f of [0, 0.25, 0.5, 1]) {
      const v0 = f * omega * d // up to the cap
      let lastE = -d
      for (let t = 0; t <= 4000; t += 8) {
        const { e } = springAt(-d, v0, omega, t)
        assert.ok(e <= 1e-9, `d ${d} f ${f} passed the seat at ${t}ms (${e})`)
        assert.ok(e >= lastE - 1e-9, `d ${d} f ${f} backed off at ${t}ms`)
        lastE = e
      }
    }
  }
})

test('a page eased on from rest starts without a velocity step', () => {
  const s0 = springAt(-250, 0, omega, 0)
  assert.equal(s0.v, 0)
  // the first frame's velocity is small and builds: a damp from rest would open at ω·d
  const first = springAt(-250, 0, omega, FRAME).v
  assert.ok(first > 0 && first < 0.25 * omega * 250, `first frame ${first}`)
  // it still gets there
  assert.ok(Math.abs(springAt(-250, 0, omega, 1200).e) < 1)
})

test('at the edge of the catch the spring is the footer’s damp', () => {
  // ė = ω·d start velocity, e(t) = e0·exp(-ωt): footerDamp's own solution
  const d = 300
  const s = springAt(-d, omega * d, omega, 200)
  assert.ok(Math.abs(s.e - -d * Math.exp(-omega * 200)) < 1e-9)
})

/* — exit — */

test('the exit momentum decays at the rate iOS scrolls at', () => {
  assert.equal(MOMENTUM_DECAY, 0.998)
  assert.ok(Math.abs(momentumTau() - 499.5) < 0.1)
})

test('momentum covers v·τ in all, whatever the frame rate', () => {
  for (const v0 of [0.5, 2, 6]) {
    for (const frame of [FRAME, 8.3, 33]) {
      let v = v0
      let dist = 0
      while (Math.abs(v) >= MIN_V) {
        const s = momentumStep(v, frame)
        dist += s.dy
        v = s.v
      }
      const want = momentumDistance(v0) - momentumDistance(MIN_V) // it stops when it is slower than MIN_V
      assert.ok(Math.abs(dist - want) / want < 0.002, `v0 ${v0} @ ${frame}ms covered ${dist}, wanted ${want}`)
    }
  }
  assert.ok(Math.abs(momentumDistance(2) - 2 * 499.5) < 0.5)
})

test('per-frame deltas decay geometrically with no end time', () => {
  let v = 3
  let prev = momentumStep(v, FRAME)
  v = prev.v
  for (let i = 0; i < 40; i++) {
    const s = momentumStep(v, FRAME)
    const ratio = s.dy / prev.dy
    assert.ok(Math.abs(ratio - Math.pow(0.998, FRAME)) < 1e-9)
    prev = s
    v = s.v
  }
  assert.ok(Math.abs(Math.pow(0.998, FRAME) - 0.967) < 0.001)
  assert.ok(momentumStep(3, FRAME, 0.99).dy < momentumStep(3, FRAME).dy) // a stronger decay carries less
})

test('the release velocity is an average that follows the finger', () => {
  assert.equal(emaVelocity(0, 2), 2)
  assert.ok(Math.abs(emaVelocity(2, 0, 0.5) - 1) < 1e-12)
  let v = 0
  for (const s of [0.2, 0.9, 1.6, 2.4, 3]) v = emaVelocity(v, s)
  assert.ok(v > 1.5 && v < 3)
})

/* — the dials — */

test('the dials default to the hold on and the house numbers', () => {
  assert.deepEqual(readBlurbTune(''), { hold: true, end: true, grow: true, peek: null, air: null, text: null, catchLerp: null, decel: null, trigger: null })
})

test('?blurbgrow=0 turns the growth off and nothing else does', () => {
  assert.equal(readBlurbTune('?blurbgrow=0').grow, false)
  assert.equal(readBlurbTune('?blurbgrow=1').grow, true)
  assert.equal(readBlurbTune('?blurbgrow=junk').grow, true)
  assert.equal(readBlurbTune('?blurbhold=0').grow, true)
})

test('?blurbair takes a rem from 0 to 8 and nothing else', () => {
  assert.equal(readBlurbTune('?blurbair=1.5').air, 1.5)
  assert.equal(readBlurbTune('?blurbair=0').air, 0) // no extra air is a value, not an unset dial
  assert.equal(readBlurbTune('?blurbair=8').air, 8)
  assert.equal(readBlurbTune('?blurbair=8.1').air, null)
  assert.equal(readBlurbTune('?blurbair=-1').air, null)
  assert.equal(readBlurbTune('?blurbair=nope').air, null)
})

test('?blurbtext takes a target above 0 up to 3 and nothing else', () => {
  assert.equal(readBlurbTune('?blurbtext=1.25').text, 1.25)
  assert.equal(readBlurbTune('?blurbtext=1').text, 1)
  assert.equal(readBlurbTune('?blurbtext=3').text, 3)
  assert.equal(readBlurbTune('?blurbtext=0.8').text, 0.8)
  assert.equal(readBlurbTune('?blurbtext=0').text, null)
  assert.equal(readBlurbTune('?blurbtext=-1').text, null)
  assert.equal(readBlurbTune('?blurbtext=3.01').text, null)
  assert.equal(readBlurbTune('?blurbtext=nope').text, null)
})

test('?blurbend=0 turns the page-end slowdown off and nothing else does', () => {
  assert.equal(readBlurbTune('?blurbend=0').end, false)
  assert.equal(readBlurbTune('?blurbend=1').end, true)
  assert.equal(readBlurbTune('?blurbend=junk').end, true)
  assert.equal(readBlurbTune('?blurbhold=0').end, true)
})

test('?blurbhold=0 turns the hold off and nothing else does', () => {
  assert.equal(readBlurbTune('?blurbhold=0').hold, false)
  assert.equal(readBlurbTune('?blurbhold=1').hold, true)
  assert.equal(readBlurbTune('?blurbhold=junk').hold, true)
})

test('?blurbpeek takes a fraction between 0 and 1 only', () => {
  assert.equal(readBlurbTune('?blurbpeek=0.2').peek, 0.2)
  assert.equal(readBlurbTune('?blurbpeek=0').peek, null)
  assert.equal(readBlurbTune('?blurbpeek=1').peek, null)
  assert.equal(readBlurbTune('?blurbpeek=-1').peek, null)
  assert.equal(readBlurbTune('?blurbpeek=nope').peek, null)
  assert.equal(readBlurbTune('?blurbsec=0.6').peek, null) // the old dial is gone
})

test('?blurbcatch is a lerp, ?blurbdecel a per-ms factor, ?blurbscroll px', () => {
  assert.equal(readBlurbTune('?blurbcatch=0.3').catchLerp, 0.3)
  assert.equal(readBlurbTune('?blurbcatch=5').catchLerp, 1)
  assert.equal(readBlurbTune('?blurbcatch=0').catchLerp, null)
  assert.equal(readBlurbTune('?blurbdecel=0.99').decel, 0.99)
  assert.equal(readBlurbTune('?blurbdecel=1').decel, null)
  assert.equal(readBlurbTune('?blurbdecel=0').decel, null)
  assert.equal(readBlurbTune('?blurbscroll=200').trigger, 200)
  assert.equal(readBlurbTune('?blurbscroll=nope').trigger, null)
  assert.equal(readBlurbTune('?blurbscroll=0').trigger, null)
  // ?scroll is the World Turn's and the next-project band's; it no longer moves the hold
  assert.equal(readBlurbTune('?scroll=300').trigger, null)
})

test('a lower lerp takes the page earlier and a higher one later', () => {
  const v = 3
  assert.ok(v / catchOmega(0.08) > v / omega)
  assert.ok(v / catchOmega(0.4) < v / omega)
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
  assert.equal(SCROLL_TRIGGER_WORK_PX / TOUCH_GAIN, 100)
  assert.equal(stepAccum(0, 99 * TOUCH_GAIN, SCROLL_TRIGGER_WORK_PX).commit, 0)
  assert.equal(stepAccum(0, 100 * TOUCH_GAIN, SCROLL_TRIGGER_WORK_PX).commit, 1)
})

test('a held blurb lets go sooner: 60px of finger, either way (Nathan 11-11)', () => {
  // The hold's copy travels trigger / gain: its full pull is the finger's.
  assert.equal(BLURB_TRIGGER_PX / TOUCH_GAIN, 60)
  assert.ok(BLURB_TRIGGER_PX < SCROLL_TRIGGER_WORK_PX)
  assert.equal(stepAccum(0, 59 * TOUCH_GAIN, BLURB_TRIGGER_PX, true).commit, 0)
  assert.equal(stepAccum(0, 60 * TOUCH_GAIN, BLURB_TRIGGER_PX, true).commit, 1)
  assert.equal(stepAccum(0, -60 * TOUCH_GAIN, BLURB_TRIGGER_PX, true).commit, -1)
  // the hold reads its own constant, never the house one
  const src = fs.readFileSync(fileURLToPath(new URL('../../src/lib/blurbHold.js', import.meta.url)), 'utf8')
  assert.match(src, /tune\.trigger \?\? BLURB_TRIGGER_PX/)
  assert.doesNotMatch(src, /SCROLL_TRIGGER_WORK_PX/)
})

/* — the source contract — */

test('the hold needs a finger, the sections do not', () => {
  assert.match(HOLD_MQ, /pointer: coarse/)
  assert.ok(HOLD_MQ.startsWith(PHONE_MQ))
  assert.equal(PHONE_MQ, '(max-width: 768px)')
  assert.equal(SEAT_TOL_PX, 2) // NextProjectBand's atEnd tolerance
})

test('the reading section rule lives only inside the phone query', () => {
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
  assert.ok(!/--blurb-peek/.test(outside), 'section height leaked outside the phone query')
  assert.ok(!/--blurb-text|--blurb-clear|--blurb-air|data-blurb-fit|data-blurb-grow/.test(outside), 'the text fit, the air, the growth or the nav clearance leaked outside the phone query')
  // the detail blurbs scale from the shared token, which itself stays untouched
  assert.match(css, /font-size: calc\(var\(--text-blurb\) \* var\(--blurb-text, 1\)\)/)
  // the copy clears the nav and the pinned breadcrumb chip: one custom property, derived, used by both section rules
  assert.match(css, /--blurb-clear: calc\(var\(--nav-height, 2\.929rem\) \+ 0\.857rem \+ 1\.857rem \+ 0\.571rem\)/)
  // …and a minimum extra gap (?blurbair) above the copy beyond it
  assert.match(css, /padding-block: calc\(var\(--blurb-clear\) \+ var\(--blurb-air, 1\.5rem\)\) 0\.857rem/)
  assert.match(css, /\.hero-band>\.project-blurb \{\s*justify-content: center;\s*padding-top: calc\(var\(--blurb-clear\) \+ var\(--blurb-air, 1\.5rem\)\)/)
  // the desktop rule's flex-basis 50vw is a HEIGHT in the phone column: a compact intro must size to its copy
  assert.match(css, /\.hero-band>\.project-blurb \{[^}]*flex: 0 0 auto;/)
  // growing sections are compact until the script gives them a height; the fit measures them by their copy even then
  assert.match(css, /\.project-detail\[data-blurb-grow\] \.project-blurb \{\s*min-height: 0;/)
  assert.match(css, /\.project-detail\[data-blurb-fit\] \.project-blurb \{\s*min-height: 0 !important;/)
  // the browser must not counter-scroll the growth
  assert.match(css, /overflow-anchor: none;/)
  // the chip really does pin at nav + 0.857rem and stand 1.857rem tall (what --blurb-clear is derived from)
  assert.match(css, /\.detail-breadcrumb \{\s*position: sticky;\s*top: calc\(2\.929rem \+ 0\.857rem\)/)
  assert.match(css, /margin: 0\.571rem 0 calc\(-1\.857rem - 0\.571rem\) 0\.571rem/)
  assert.ok(!/--blurb-sec/.test(css), 'the retired ?blurbsec variable is still styled')
  // the grown size (what no-script, reduced motion and ?blurbgrow=0 sit at) is 88% of the small viewport
  assert.match(css, /min-height: calc\(\(1 - var\(--blurb-peek, 0\.12\)\) \* 100svh\)/)
})

/* — growth (SQ-30) — */

test('a section grows to 88% of the VISIBLE viewport, never under its own content', () => {
  assert.equal(grownHeight(300, 844), 0.88 * 844)
  assert.equal(grownHeight(300, 660), 0.88 * 660)
  assert.equal(grownHeight(300, 844, 0.4), 0.6 * 844) // the peek dial
  assert.equal(grownHeight(800, 844), 800) // a blurb that can never fit is its content
  // the toolbars: the visible viewport is the taller one, so the same section grows further with them collapsed
  assert.ok(grownHeight(300, 844) > grownHeight(300, 760))
})

test('the height lerps from compact to grown with progress, clamped', () => {
  assert.equal(growHeight(300, 700, 0), 300)
  assert.equal(growHeight(300, 700, 1), 700)
  assert.equal(growHeight(300, 700, 0.25), 400)
  assert.equal(growHeight(300, 700, -1), 300)
  assert.equal(growHeight(300, 700, 2), 700)
})

test('entering from below, progress runs 0 to 1 as the top travels from the bottom edge to the seat', () => {
  const vh = 844
  assert.equal(entryProgress(vh, 300, vh, 1), 0) // top on the bottom edge
  assert.equal(entryProgress(vh + 500, 300, vh, 1), 0) // still below: clamped
  assert.equal(entryProgress(0, 300, vh, 1), 1) // on the seat
  assert.equal(entryProgress(SEAT_TOL_PX, 300, vh, 1), 1) // within the seat tolerance IS the seat
  assert.equal(entryProgress(-90, 300, vh, 1), 1) // past it: clamped
  let prev = -1
  for (let top = vh; top >= 0; top -= 20) {
    const p = entryProgress(top, 300, vh, 1)
    assert.ok(p >= prev, `monotone at top=${top}`)
    prev = p
  }
  assert.ok(Math.abs(entryProgress(vh / 2, 300, vh, 1) - 0.5) < 0.01)
})

test('entering from above, progress runs 0 to 1 from the compact bottom reaching the top edge to the seat', () => {
  const vh = 844
  const hc = 300
  assert.equal(entryProgress(-hc, hc, vh, -1), 0) // the bottom on the top edge
  assert.equal(entryProgress(-hc - 400, hc, vh, -1), 0) // still above: clamped
  assert.equal(entryProgress(0, hc, vh, -1), 1) // on the seat
  assert.equal(entryProgress(-SEAT_TOL_PX, hc, vh, -1), 1)
  assert.equal(entryProgress(120, hc, vh, -1), 1) // past it (its top below the seat): clamped
  let prev = -1
  for (let top = -hc; top <= 0; top += 10) {
    const p = entryProgress(top, hc, vh, -1)
    assert.ok(p >= prev, `monotone at top=${top}`)
    prev = p
  }
  assert.ok(Math.abs(entryProgress(-hc / 2, hc, vh, -1) - 0.5) < 0.01)
})

test('the entry from below reads only the top, so a section growing at its bottom never feeds back into its progress', () => {
  for (const top of [900, 700, 300, 40, 0]) assert.equal(entryProgress(top, 120, 844, 1), entryProgress(top, 900, 844, 1))
  // and from above the compact height is the scale: halfway in is half of ITS height, whatever that is
  for (const hc of [250, 600]) assert.ok(Math.abs(entryProgress(-hc / 2, hc, 844, -1) - 0.5) < 0.01)
})

test('progress is a latch: it only increases within an entry, so leaving keeps the height', () => {
  assert.equal(latchProgress(0.4, 0.2), 0.4) // the page turned back, or the section is leaving
  assert.equal(latchProgress(0.4, 0.7), 0.7)
  assert.equal(latchProgress(1, 0), 1)
  // an entry from below, then the page reverses and the section leaves below: height never shrinks
  const vh = 844
  let p = 0
  const heights = []
  for (const top of [844, 600, 400, 250, 400, 600, 800]) {
    p = latchProgress(p, entryProgress(top, 300, vh, 1))
    heights.push(growHeight(300, grownHeight(300, vh), p))
  }
  for (let i = 1; i < heights.length; i++) assert.ok(heights[i] >= heights[i - 1])
  assert.ok(heights[3] > 300 && heights[3] === heights[6])
})

test('which edge a section is entirely off', () => {
  assert.equal(offscreenSide(844, 300, 844), 1) // top exactly on the bottom edge
  assert.equal(offscreenSide(1200, 300, 844), 1)
  assert.equal(offscreenSide(-300, 300, 844), -1) // bottom exactly on the top edge
  assert.equal(offscreenSide(-900, 300, 844), -1)
  assert.equal(offscreenSide(843, 300, 844), 0) // a pixel of it on screen
  assert.equal(offscreenSide(-299, 300, 844), 0)
  assert.equal(offscreenSide(0, 742, 844), 0)
})

test('a grown section resets at once below the viewport and only at rest above it', () => {
  const vh = 844
  // fully below: nothing visible moves, so now, rest or not
  assert.equal(resetSide(900, 742, vh, false), 1)
  assert.equal(resetSide(900, 742, vh, true), 1)
  // fully above: only with the page at rest (a programmatic scroll ends iOS's momentum)
  assert.equal(resetSide(-900, 742, vh, false), 0)
  assert.equal(resetSide(-900, 742, vh, true), -1)
  // anything on screen never resets, at rest or not
  for (const top of [-700, -300, 0, 400, 800]) {
    assert.equal(resetSide(top, 742, vh, true), 0, `on screen at ${top}`)
    assert.equal(resetSide(top, 742, vh, false), 0)
  }
})

test('the fit window is the worst case the growth can reach', () => {
  // the fit measures against the SMALL viewport, 0.88 × svh: what the section grows to when the toolbars are shown
  for (const svh of [553, 660, 844]) {
    assert.equal(seatWindow(svh), grownHeight(0, svh) + SEAT_TOL_PX)
    assert.ok(grownHeight(0, svh + 90) > seatWindow(svh)) // collapsed toolbars: a taller viewport, so a bigger window than the fit needed
  }
  // a blurb whose content just fits that window is held at its grown height at the small viewport
  const content = 0.88 * 660
  assert.equal(grownHeight(content, 660), content)
  assert.equal(holdable(grownHeight(content, 660), 660), true)
})
