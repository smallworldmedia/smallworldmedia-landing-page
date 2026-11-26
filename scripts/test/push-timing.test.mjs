// A click-started passage creates its history entry inside the tap's gesture (SQ-141):
// holdEntry() pushes in the handler and the passage's end replaces; the probe gate fails a
// push past WebKit's ~1 s gesture carry or outside an activation.
//   node --test scripts/test/push-timing.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { holdEntry } from '../../src/lib/gestureHistory.js'
import { pushTimingVerdict, MAX_PUSH_MS } from '../lib/pushTimingGate.mjs'

function fakeWindow(state = { index: 3, scrollX: 0, scrollY: 0 }) {
  const entries = [{ state, url: '/' }]
  let at = 0
  const on = {}
  const win = {
    scrollX: 0,
    scrollY: 120,
    history: {
      get state() {
        return entries[at].state
      },
      pushState(s, _t, url) {
        entries.splice(at + 1, Infinity, { state: s, url })
        at++
      },
      replaceState(s, _t, url) {
        entries[at] = { state: s, url: url ?? entries[at].url }
      },
    },
    addEventListener: (n, f) => ((on[n] ||= []).push(f)),
    removeEventListener: (n, f) => (on[n] = (on[n] || []).filter((g) => g !== f)),
  }
  const back = () => {
    at--
    const fs = on.popstate || []
    on.popstate = []
    fs.forEach((f) => f({ state: entries[at].state }))
  }
  return { win, entries, back, at: () => at }
}

test('holdEntry pushes the destination at once, with the state ClientRouter keeps', () => {
  const { win, entries } = fakeWindow()
  holdEntry('/work', win)
  assert.equal(entries.length, 2)
  assert.deepEqual(entries[1], { state: { index: 4, scrollX: 0, scrollY: 0 }, url: '/work' })
  // The page left keeps its scroll, as ClientRouter's own push records it.
  assert.equal(entries[0].state.scrollY, 120)
  assert.equal(entries[0].state.index, 3)
})

test('the passage end commits the arrival as a REPLACE of the held entry (no second push)', () => {
  const { win } = fakeWindow()
  const arrive = holdEntry('/work', win)
  assert.deepEqual(arrive(), { history: 'replace' })
})

test('a Back during the passage drops the arrival; the held entry stays forward only', () => {
  const { win, entries, back, at } = fakeWindow()
  const arrive = holdEntry('/work', win)
  back()
  assert.equal(at(), 0)
  assert.equal(arrive(), null)
  assert.equal(entries.length, 2) // Forward reaches /work; Back from home leaves (nothing stray behind it)
})

test('a page with no router state still gets an indexed entry', () => {
  const { win, entries } = fakeWindow(null)
  holdEntry('/', win)
  assert.equal(entries[1].state.index, 1)
})

const rec = (pushT, active, extra = {}) => ({
  id: 'TE',
  dest: '^/work$',
  inputs: [
    { t: 1000, type: 'pointerdown' },
    { t: 1080, type: 'click' },
  ],
  pushes: [{ t: pushT, path: '/work/', active }],
  ...extra,
})

test('gate, a push in the tap with a live activation passes', () => {
  const v = pushTimingVerdict(rec(1082, true))
  assert.equal(v.pass, true)
  assert.equal(v.ms, 2)
})

test('gate negative control, the before-state Enter (1160 ms + fetch, isActive false) fails', () => {
  // Nathan's 11-25 iPhone walk: PREP 1160 ms after the zoom_in tap, PUSH after the fetch, ua0.
  const v = pushTimingVerdict(rec(1080 + 1160 + 180, false))
  assert.equal(v.pass, false)
  assert.match(v.fails[0], new RegExp(`> ${MAX_PUSH_MS} ms`))
  assert.match(v.fails[1], /isActive false/)
})

test('gate, late but activated, or quick but unactivated, each fail on their own', () => {
  assert.equal(pushTimingVerdict(rec(1080 + 1001, true)).pass, false)
  assert.equal(pushTimingVerdict(rec(1100, false)).pass, false)
  assert.equal(pushTimingVerdict(rec(1100, null)).pass, false) // no API: cannot judge, never a pass
})

test('gate, no push to the destination, or no input before it, fails', () => {
  assert.match(pushTimingVerdict(rec(1100, true, { pushes: [{ t: 1100, path: '/', active: true }] })).fails[0], /no push/)
  assert.match(pushTimingVerdict(rec(900, true)).fails[0], /no input/)
})

test('gate, the first push to the destination is the one judged', () => {
  const v = pushTimingVerdict(
    rec(0, true, {
      pushes: [
        { t: 1085, path: '/work', active: true },
        { t: 3000, path: '/work/', active: false },
      ],
    })
  )
  assert.equal(v.pass, true)
})
