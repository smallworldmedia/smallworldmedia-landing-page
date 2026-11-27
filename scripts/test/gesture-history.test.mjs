// Gesture page turns keep browser Back on the site (SQ-100): a wheel/drag
// commit pushes only while the document holds an honoured activation, and
// replaces otherwise; a browser back/forward drops the honour.
//   node --test scripts/test/gesture-history.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { trackActivation, gestureHistory, browserAnimated, trackUAVisual } from '../../src/lib/gestureHistory.js'
import { formatRow, appendRow, CAP } from '../../src/lib/historyLog.js'
import { verdict, SKIPPABLE } from '../history-probe.mjs'

function fakeWindow() {
  const listeners = {}
  const win = {
    navigator: { userActivation: { isActive: false } },
    addEventListener: (n, f) => ((listeners[n] ||= []).push(f)),
  }
  const fire = (n, active = false) => {
    win.navigator.userActivation.isActive = active
    ;(listeners[n] || []).forEach((f) => f({ type: n }))
  }
  return { win, fire }
}

const REPLACE = { history: 'replace' }
const PUSH = { history: 'push' }

test('a cold visit (no click, no key) replaces: wheel/drag never activate', () => {
  const { win, fire } = fakeWindow()
  const t = trackActivation(win)
  assert.deepEqual(t.options(), REPLACE)
  fire('touchend', false) // the end of a drag carries no activation
  assert.deepEqual(t.options(), REPLACE)
})

test('a click or a key anywhere earlier makes the turn push (sticky)', () => {
  for (const type of ['click', 'pointerdown', 'pointerup', 'keydown', 'touchend']) {
    const { win, fire } = fakeWindow()
    const t = trackActivation(win)
    fire(type, true)
    fire('touchend', false) // a later drag does not clear it
    assert.deepEqual(t.options(), PUSH, type)
  }
})

test('a browser back/forward (popstate) drops the honour until the next activation', () => {
  const { win, fire } = fakeWindow()
  const t = trackActivation(win)
  fire('click', true)
  fire('popstate')
  assert.deepEqual(t.options(), REPLACE)
  fire('click', true)
  assert.deepEqual(t.options(), PUSH)
})

test('server-side, with no window, the shared gestureHistory() replaces', () => {
  assert.deepEqual(gestureHistory(), REPLACE)
})

test('no userActivation API: every gesture turn replaces', () => {
  const listeners = {}
  const win = { navigator: {}, addEventListener: (n, f) => ((listeners[n] ||= []).push(f)) }
  const t = trackActivation(win)
  listeners.click.forEach((f) => f({ type: 'click' }))
  assert.deepEqual(t.options(), REPLACE)
})

test('probe gate judges skippable entries, push or replace, and the /featured-projects restore', () => {
  assert.equal(verdict({ id: 'A', skippable: 0, before: ['/featured-projects/a'], after: ['/featured-projects/b'] }).pass, true)
  assert.match(verdict({ id: 'A', skippable: 2, before: ['/a'], after: ['/a'] }).fails[0], new RegExp(SKIPPABLE))
  assert.equal(verdict({ id: 'A', skippable: 0, before: ['/a'], after: ['/a', '/b'] }).pass, false)
  assert.equal(verdict({ id: 'H', skippable: 0, activated: true, before: ['/a'], after: ['/a', '/b'] }).pass, true)
  assert.equal(verdict({ id: 'H', skippable: 0, activated: true, before: ['/a'], after: ['/b'] }).pass, false)
  assert.equal(verdict({ id: 'R', skippable: 0, left: 'Kamino', restored: 'Rossi' }).pass, false)
  assert.equal(verdict({ id: 'R', skippable: 0, left: 'Kamino', restored: 'Kamino' }).pass, true)
  assert.equal(verdict({ id: 'K', skippable: 0, back: [{ expect: '/featured-projects', got: '/' }] }).pass, false)
})

test('iPhone walk gate (SQ-105): a snap forward, a stale page and a lost entry all fail', () => {
  const ok = { dir: 'back', expect: '/featured-projects', got: '/featured-projects', dom: '/featured-projects', trail: ['/featured-projects'] }
  assert.equal(verdict({ id: 'P1', skippable: 0, back: [ok] }).pass, true)
  // Result 1: Back reaches /featured-projects, then the page turns forward to the detail.
  const snap = verdict({ id: 'P1', skippable: 0, back: [{ ...ok, got: '/featured-projects/a', dom: '/featured-projects/a', trail: ['/featured-projects', '/featured-projects/a'] }] })
  assert.equal(snap.pass, false)
  assert.match(snap.fails[0], /Back landed \/featured-projects\/a, expected \/featured-projects/)
  // Lands, but moves on within the watch (and back again) — still a snap.
  const flick = verdict({ id: 'P1', skippable: 0, back: [{ ...ok, trail: ['/featured-projects', '/featured-projects/a', '/featured-projects'] }] })
  assert.match(flick.fails[0], /moved on after landing/)
  // The URL changed but the router never swapped: the detail page stays up.
  const stale = verdict({ id: 'P2', skippable: 0, back: [{ ...ok, expect: '/featured-projects/a', got: '/featured-projects/a', dom: '/featured-projects/b', trail: ['/featured-projects/a'] }] })
  assert.match(stale.fails[0], /to \/featured-projects\/a still shows \/featured-projects\/b/)
  // Result 2: the second Back leaves the site (the /featured-projects entry is gone).
  const lost = verdict({ id: 'P2', skippable: 0, back: [{ ...ok, got: 'about:blank', dom: null, trail: ['about:blank'] }] })
  assert.match(lost.fails[0], /Back landed about:blank, expected \/featured-projects/)
  // Forward is judged the same way; an about: page has no canonical to compare.
  assert.match(verdict({ id: 'P2', skippable: 0, back: [{ ...ok, dir: 'forward', expect: '/featured-projects/b', got: '/featured-projects/a', dom: '/featured-projects/a', trail: ['/featured-projects/a'] }] }).fails[0], /^Forward landed/)
  assert.equal(verdict({ id: 'P1', skippable: 0, back: [{ dir: 'back', expect: 'about:blank', got: 'about:blank', dom: null, trail: ['about:blank'] }] }).pass, true)
  // The World /featured-projects reopens on is judged with the walk.
  assert.equal(verdict({ id: 'P2', skippable: 0, left: 'Cheetah Print', restored: 'COCO', back: [ok] }).pass, false)
})

// SQ-105: an edge-swipe Back the browser already animated skips the router's
// view transition for that traversal only.
function fakeRouter() {
  const on = {}
  const target = { addEventListener: (n, f) => ((on[n] ||= []).push(f)) }
  const fire = (n, e) => (on[n] || []).forEach((f) => f(e))
  trackUAVisual(target, target)
  const swap = (navigationType) => {
    let skipped = false
    fire('astro:before-preparation', { navigationType })
    fire('astro:before-swap', { navigationType, viewTransition: { skipTransition: () => (skipped = true) } })
    return skipped
  }
  return { fire, swap }
}

test('browserAnimated reads hasUAVisualTransition off the popstate', () => {
  assert.equal(browserAnimated({ hasUAVisualTransition: true }), true)
  assert.equal(browserAnimated({ hasUAVisualTransition: false }), false)
  assert.equal(browserAnimated({}), false) // engines without the field
  assert.equal(browserAnimated(undefined), false)
})

test('a popstate with hasUAVisualTransition skips that traversal\'s view transition', () => {
  const r = fakeRouter()
  r.fire('popstate', { hasUAVisualTransition: true })
  assert.equal(r.swap('traverse'), true)
  assert.equal(r.swap('push'), false, 'the next navigation animates again')
  // The real order (histlog): ClientRouter's own popstate listener dispatches
  // before-preparation first, then ours sees the popstate, then the swap.
  let skipped = false
  r.fire('astro:before-preparation', { navigationType: 'traverse' })
  r.fire('popstate', { hasUAVisualTransition: true })
  r.fire('astro:before-swap', { navigationType: 'traverse', viewTransition: { skipTransition: () => (skipped = true) } })
  assert.equal(skipped, true)
})

test('a popstate without the flag, and a push after a flagged pop, keep their animation', () => {
  const r = fakeRouter()
  r.fire('popstate', { hasUAVisualTransition: false })
  assert.equal(r.swap('traverse'), false)
  r.fire('popstate', { hasUAVisualTransition: true })
  assert.equal(r.swap('push'), false, 'a push that starts before the flagged pop swaps is not skipped')
})

test('histlog rows: numbered, capped, and one readable line each', () => {
  let rows = []
  for (let i = 0; i < CAP + 5; i++) rows = appendRow(rows, { t: i * 100, kind: 'REPL', path: '/featured-projects', len: 2, keys: ['index'] })
  assert.equal(rows.length, CAP)
  assert.equal(rows[0].n, 6)
  assert.equal(rows[rows.length - 1].n, CAP + 5)
  assert.equal(
    formatRow({ n: 7, t: 3240, kind: 'PUSH', path: '/featured-projects/a', len: 4, keys: ['index', 'scrollX', 'scrollY'], world: 1, ua: [true, true] }),
    '07 +3.2s PUSH /featured-projects/a len4 {index,scrollX,scrollY} w1 ua1/1'
  )
  assert.equal(
    formatRow({ n: 12, t: 9000, kind: 'POP', path: '/featured-projects', len: 4, keys: null, ua: [false, true], uav: true }),
    '12 +9.0s POP /featured-projects len4 null ua0/1 uav1'
  )
  assert.equal(formatRow({ n: 1, t: 0, kind: 'SHOW', path: '/featured-projects', len: 3, keys: ['index'], note: 'bfcache' }), '01 +0.0s SHOW /featured-projects len3 {index} bfcache')
})
