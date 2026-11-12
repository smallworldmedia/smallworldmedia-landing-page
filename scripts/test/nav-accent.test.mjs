// The nav-accent control point's passage choreography (SQ-64): a passage's colour
// change rides the passage's own duration + curve (easeToCss → a CSS linear()), a
// HELD accent paints black and remembers the colour until it is released, and a
// retarget that is already underway does not restart.
//   node --test scripts/test/nav-accent.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

// A document just big enough for navAccent: <html> with an inline style (setProperty /
// removeProperty / a write log), a classList, and offsetWidth (the style flush).
function fakeDom() {
  const props = new Map()
  const log = []
  const classes = new Set()
  const root = {
    style: {
      transition: '',
      setProperty(k, v) {
        props.set(k, v)
        log.push(['set', k, v])
      },
      removeProperty(k) {
        props.delete(k)
        log.push(['remove', k])
      },
    },
    classList: {
      add: (c) => classes.add(c),
      remove: (...cs) => cs.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c),
    },
    get offsetWidth() {
      log.push(['flush'])
      return 0
    },
  }
  globalThis.document = { documentElement: root }
  globalThis.CSS = { supports: () => true }
  return { props, log, classes }
}

const nav = await import('../../src/lib/navAccent.js')
const { easeToCss, NAV_BLACK, applyNavAccent, holdNavAccent, releaseNavAccent, retargetNavAccent, reapplyNavAccent, clearNavAccent, isNavAccentHeld } = nav
const cubicIn = (t) => t * t * t
const fade = { seconds: 0.6, ease: cubicIn }

test('easeToCss samples an easing into a linear() with pinned endpoints', () => {
  const css = easeToCss(cubicIn, 4)
  assert.equal(css, 'linear(0, 0.0156, 0.125, 0.4219, 1)')
  const pts = easeToCss((t) => t, 48).slice('linear('.length, -1).split(', ').map(Number)
  assert.equal(pts.length, 49)
  assert.equal(pts[0], 0)
  assert.equal(pts[48], 1)
  assert.ok(Math.abs(pts[24] - 0.5) < 1e-9, 'the identity ease stays linear at the midpoint')
})

test('easeToCss pins the endpoints even when the ease overshoots them, and rejects a non-function', () => {
  const css = easeToCss((t) => (t === 0 ? 0.2 : t === 1 ? 0.8 : t), 2)
  assert.equal(css, 'linear(0, 0.5, 1)')
  assert.equal(easeToCss('power2.in'), null)
})

test('a faded apply overrides the duration + curve only for the flush that starts the transition', () => {
  const { props, log } = fakeDom()
  clearNavAccent()
  log.length = 0
  applyNavAccent('#B63947', undefined, true, { fade })
  const set = log.findIndex((l) => l[0] === 'set' && l[1] === '--project-color-fade')
  const ease = log.findIndex((l) => l[0] === 'set' && l[1] === '--accent-ease')
  const color = log.findIndex((l) => l[0] === 'set' && l[1] === '--project-color')
  const flush = log.findIndex((l) => l[0] === 'flush')
  const dropped = log.findIndex((l) => l[0] === 'remove' && l[1] === '--project-color-fade')
  assert.equal(log[set][2], '600ms')
  assert.match(log[ease][2], /^linear\(0, /)
  assert.ok(set < color && ease < color, 'the clock is set before the colour changes')
  assert.ok(color < flush && flush < dropped, 'flushed with the clock in force, then dropped')
  assert.equal(props.has('--project-color-fade'), false)
  assert.equal(props.has('--accent-ease'), false)
  assert.equal(props.get('--project-color'), '#B63947')
})

test('a faded apply that starts part-way in sets a negative --accent-delay for the starting flush only', () => {
  const { props, log } = fakeDom()
  clearNavAccent()
  log.length = 0
  applyNavAccent('#B63947', undefined, true, { fade: { ...fade, delay: -0.25 } })
  const delay = log.findIndex((l) => l[0] === 'set' && l[1] === '--accent-delay')
  const flush = log.findIndex((l) => l[0] === 'flush')
  const dropped = log.findIndex((l) => l[0] === 'remove' && l[1] === '--accent-delay')
  assert.equal(log[delay][2], '-250ms')
  assert.ok(delay < flush && flush < dropped, 'in force across the flush, then dropped')
  assert.equal(props.has('--accent-delay'), false)
  log.length = 0
  applyNavAccent('#F99B2F', undefined, true, { fade })
  assert.equal(log.some((l) => l[0] === 'set' && l[1] === '--accent-delay'), false, 'no phase offset, none written')
})

test('a held accent paints black, remembers the colour, and a release paints it on the lift clock', () => {
  const { props, log } = fakeDom()
  clearNavAccent()
  holdNavAccent()
  assert.equal(isNavAccentHeld(), true)
  applyNavAccent('#B63947', '#ffffff', false) // /work's first apply, under the cover
  assert.equal(props.get('--project-color'), NAV_BLACK, 'the nav stays black through the swap')
  reapplyNavAccent() // the after-swap re-assert
  assert.equal(props.get('--project-color'), NAV_BLACK)
  log.length = 0
  releaseNavAccent(fade)
  assert.equal(isNavAccentHeld(), false)
  assert.equal(props.get('--project-color'), '#B63947')
  assert.equal(props.get('--project-color-2'), '#ffffff')
  assert.ok(log.some((l) => l[0] === 'set' && l[1] === '--project-color-fade' && l[2] === '600ms'), 'rode the lift duration')
})

test('releaseNavAccent with no fade is a cut, and does nothing when nothing is held', () => {
  const { props, log } = fakeDom()
  clearNavAccent()
  log.length = 0
  releaseNavAccent(null)
  assert.equal(log.length, 0, 'not held: no writes')
  holdNavAccent()
  applyNavAccent('#84F104', undefined, false)
  log.length = 0
  releaseNavAccent(null)
  assert.equal(props.get('--project-color'), '#84F104')
  assert.equal(log.some((l) => l[1] === '--project-color-fade' && l[0] === 'set'), false, 'a cut sets no fade clock')
})

test('retargetNavAccent starts a passage fade once, never restarts it, and never fights a hold', () => {
  const { props, log } = fakeDom()
  clearNavAccent()
  applyNavAccent('#B63947', undefined, false)
  assert.equal(retargetNavAccent('#F99B2F', undefined, fade), true)
  assert.equal(props.get('--project-color'), '#F99B2F')
  log.length = 0
  assert.equal(retargetNavAccent('#F99B2F', undefined, fade), false, 'already heading there')
  assert.equal(log.length, 0)
  holdNavAccent()
  assert.equal(retargetNavAccent('#000000', undefined, fade), false, 'a held accent is not retargeted')
})

test('retargetNavAccent with no fade cuts, and no colour falls back to the brand blue (vars removed)', () => {
  const { props, log } = fakeDom()
  clearNavAccent()
  applyNavAccent('#B63947', undefined, false)
  log.length = 0
  assert.equal(retargetNavAccent(undefined, undefined, null), true)
  assert.equal(props.has('--project-color'), false)
  assert.equal(log.some((l) => l[1] === '--project-color-fade' && l[0] === 'set'), false)
})

test('clearNavAccent drops a hold, so a route that never tints is never left black-held', () => {
  fakeDom()
  holdNavAccent()
  clearNavAccent()
  assert.equal(isNavAccentHeld(), false)
})
