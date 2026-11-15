// Gesture page turns keep browser Back on the site (SQ-100): a wheel/drag
// commit pushes only while the document holds an honoured activation, and
// replaces otherwise; a browser back/forward drops the honour.
//   node --test scripts/test/gesture-history.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { trackActivation, gestureHistory } from '../../src/lib/gestureHistory.js'
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

test('server-side (no window): the shared gestureHistory() replaces', () => {
  assert.deepEqual(gestureHistory(), REPLACE)
})

test('no userActivation API: every gesture turn replaces', () => {
  const listeners = {}
  const win = { navigator: {}, addEventListener: (n, f) => ((listeners[n] ||= []).push(f)) }
  const t = trackActivation(win)
  listeners.click.forEach((f) => f({ type: 'click' }))
  assert.deepEqual(t.options(), REPLACE)
})

test('probe gate: skippable entries, push/replace and the /work restore', () => {
  assert.equal(verdict({ id: 'A', skippable: 0, before: ['/work/a'], after: ['/work/b'] }).pass, true)
  assert.match(verdict({ id: 'A', skippable: 2, before: ['/a'], after: ['/a'] }).fails[0], new RegExp(SKIPPABLE))
  assert.equal(verdict({ id: 'A', skippable: 0, before: ['/a'], after: ['/a', '/b'] }).pass, false)
  assert.equal(verdict({ id: 'H', skippable: 0, activated: true, before: ['/a'], after: ['/a', '/b'] }).pass, true)
  assert.equal(verdict({ id: 'H', skippable: 0, activated: true, before: ['/a'], after: ['/b'] }).pass, false)
  assert.equal(verdict({ id: 'R', skippable: 0, left: 'Kamino', restored: 'Rossi' }).pass, false)
  assert.equal(verdict({ id: 'R', skippable: 0, left: 'Kamino', restored: 'Kamino' }).pass, true)
  assert.equal(verdict({ id: 'K', skippable: 0, back: [{ expect: '/work', got: '/' }] }).pass, false)
})
