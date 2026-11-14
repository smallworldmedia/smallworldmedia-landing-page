// scrollKick: only a scroll the user made kicks a scroll-coupled wall (SQ-77).
//   node --test scripts/test/scroll-kick.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INTENT_GRACE_MS,
  initialScrollIntent,
  reduceScrollIntent,
  isScrollKey,
} from '../../src/lib/scrollKick.js'

// Feed a run of events; return the velocity each 'frame' let through.
const run = (events, state = initialScrollIntent()) => {
  const out = []
  for (const ev of events) {
    const r = reduceScrollIntent(state, ev)
    state = r.state
    if (ev.type === 'frame') out.push(r.velocity)
  }
  return { out, state }
}
const frames = (vs, t0 = 0, dt = 16) => vs.map((velocity, i) => ({ type: 'frame', velocity, now: t0 + i * dt }))

test('a non-user jump (restore, swap scroll, scrollTo) gives no kick for the frames Lenis holds it', () => {
  // Lenis holds the whole jump as one velocity sample for 400 ms (~25 frames)
  const held = Array(25).fill(1129)
  assert.deepEqual(run(frames(held)).out, Array(25).fill(0))
  // ...and a jump up (the ClientRouter's scroll to the top) the same
  assert.deepEqual(run(frames(Array(25).fill(-4200))).out, Array(25).fill(0))
})

test('a user scroll passes Lenis velocity through unchanged, today\'s coupling', () => {
  const smooth = [0, 12.5, 23.1, 30.4, 28, 22.2, 15.9, 9.1, 4.4, 1.2, 0.3] // a wheel notch's lerp
  const { out } = run([{ type: 'intent', now: 0 }, ...frames(smooth, 1)])
  assert.deepEqual(out, smooth)
})

test('the latch holds through the lerp tail and clears once the scroll settles', () => {
  const evs = [{ type: 'intent', now: 0 }, ...frames([5, 3, 1, 0.2], 16), ...frames([0, 0], 16 + 4 * 16 + INTENT_GRACE_MS)]
  const { out, state } = run(evs)
  assert.deepEqual(out, [5, 3, 1, 0.2, 0, 0])
  assert.equal(state.user, false)
  // after settling, a later jump nobody made is muted again
  assert.deepEqual(run(frames([900, 900], 2000), state).out, [0, 0])
})

test('a 0-velocity frame right after the input keeps the latch (motion starts next frame)', () => {
  const { out } = run([{ type: 'intent', now: 0 }, ...frames([0, 0, 40, 38], 10)])
  assert.deepEqual(out, [0, 0, 40, 38])
})

test('a navigation clears a live latch: the swap\'s scroll does not kick', () => {
  const { out } = run([{ type: 'intent', now: 0 }, ...frames([20], 16), { type: 'nav' }, ...frames([-3000, -3000], 48)])
  assert.deepEqual(out, [20, 0, 0])
})

test('a jump\'s held velocity stays out after a user input, until a fresh sample', () => {
  const { out } = run([...frames([1129, 1129]), { type: 'intent', now: 40 }, ...frames([1129, 1129, 18.4, 18.4], 48)])
  assert.deepEqual(out, [0, 0, 0, 0, 18.4, 18.4])
})

test('Lenis finishing a scroll settles the latch, so a later scrollTo with no wall ticking in between stays muted', () => {
  // a wheel scroll while no wall ticks (no frame steps), Lenis' scrollend, then a jump
  const { out } = run([{ type: 'intent', now: 0 }, { type: 'settle', now: 900 }, ...frames([1500, 1500], 3000)])
  assert.deepEqual(out, [0, 0])
})

test('a scrollend that lands just after a new wheel input keeps the new scroll latched', () => {
  const { out } = run([{ type: 'intent', now: 1000 }, { type: 'settle', now: 1010 }, ...frames([14, 12], 1016)])
  assert.deepEqual(out, [14, 12])
})

test('scroll keys latch; a modified key (Alt+← = back) or Enter does not', () => {
  assert.equal(isScrollKey({ key: 'ArrowDown' }), true)
  assert.equal(isScrollKey({ key: ' ' }), true)
  assert.equal(isScrollKey({ key: 'PageDown' }), true)
  assert.equal(isScrollKey({ key: 'ArrowLeft', altKey: true }), false)
  assert.equal(isScrollKey({ key: 'ArrowDown', metaKey: true }), false)
  assert.equal(isScrollKey({ key: 'Enter' }), false)
})
