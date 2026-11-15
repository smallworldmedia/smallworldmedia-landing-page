// The site colour scheme core (US-7, SQ-85): src/lib/colorScheme.js (the one module that
// decides the scheme), the inline pre-paint latch in BaseLayout.astro, and the
// spectrum deal. The module is imported FIRST, with no window or document defined, so
// that import itself is the SSR-safety test; every later test installs its own fakes.
//   node --test scripts/test/color-scheme.test.mjs
import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import React from 'react'
import { renderToString } from 'react-dom/server'

assert.equal(typeof globalThis.window, 'undefined')
const cs = await import('../../src/lib/colorScheme.js')
const {
  SCHEMES, DEFAULT_SCHEME, SCHEME_STORAGE_KEY, SCHEME_EVENT, SPECTRUM, SPECTRUM_SHARES,
  isScheme, getScheme, getCommittedScheme, setScheme, onScheme, useScheme,
  spectrumKeyAt, spectrumDeal, schemeAccent, schemeInk,
} = cs

const define = (k, value) => Object.defineProperty(globalThis, k, { value, configurable: true, writable: true })

function fakeRoot() {
  const props = new Map()
  const root = {
    dataset: {},
    style: { setProperty: (k, v) => props.set(k, v), getPropertyValue: (k) => props.get(k) ?? '' },
    setAttribute(k, v) {
      if (k === 'data-scheme') root.dataset.scheme = v
    },
    // ClientRouter replaces every attribute and the inline style of <html> on a swap
    wipe() {
      delete root.dataset.scheme
      props.clear()
    },
  }
  return root
}

function memStorage(initial = {}) {
  const m = new Map(Object.entries(initial))
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    map: m,
  }
}

const throwingStorage = () => ({
  getItem() {
    throw new Error('SecurityError: storage blocked')
  },
  setItem() {
    throw new Error('SecurityError: storage blocked')
  },
})

// A window + document the module can run against; `search` is the page's query string.
function setup({ storage = memStorage(), search = '' } = {}) {
  const win = new EventTarget()
  win.localStorage = storage
  win.location = { search }
  const doc = new EventTarget()
  doc.documentElement = fakeRoot()
  define('window', win)
  define('document', doc)
  return { win, doc, root: doc.documentElement, storage }
}

afterEach(() => {
  delete globalThis.window
  delete globalThis.document
})

// --- the latch, lifted out of BaseLayout.astro and run in a sandbox --------------------

const LAYOUT = fs.readFileSync(new URL('../../src/layouts/BaseLayout.astro', import.meta.url), 'utf8')
const latchSrc = (() => {
  for (const m of LAYOUT.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)) {
    if (m[1].includes('__swmScheme')) return m[1]
  }
  return ''
})()

function runLatch({ storage = memStorage(), search = '' } = {}) {
  const env = setup({ storage, search })
  const sandbox = { window: env.win, document: env.doc, URLSearchParams }
  vm.createContext(sandbox)
  vm.runInContext(latchSrc, sandbox)
  return env
}

// --- the scheme list, state and event -------------------------------------------------

test('the scheme list, default, storage key and event name are the contract', () => {
  assert.deepEqual(SCHEMES, ['project', 'black', 'blue', 'spectrum'])
  assert.equal(DEFAULT_SCHEME, 'project')
  assert.equal(SCHEME_STORAGE_KEY, 'swm:scheme')
  assert.equal(SCHEME_EVENT, 'swm:scheme')
  assert.ok(SCHEMES.every(isScheme))
  assert.equal(isScheme('purple'), false)
  assert.equal(isScheme(undefined), false)
})

test('importing with no window is safe and the pure helpers work', () => {
  assert.equal(typeof globalThis.window, 'undefined')
  assert.deepEqual(spectrumDeal(['a', 'b', 'c']), { a: 'blue', b: 'red', c: 'green' })
  assert.equal(getScheme(), 'project')
  assert.equal(getCommittedScheme(), 'project')
  assert.equal(setScheme('black'), 'project', 'no window: nothing to apply, nothing thrown')
  assert.equal(typeof onScheme(() => {}), 'function')
})

test('setScheme preview applies without storing; the commit stores and dispatches preview:false', () => {
  const { root, storage } = setup()
  const seen = []
  onScheme((d) => seen.push(d))
  assert.equal(setScheme('black', { preview: true }), 'black')
  assert.equal(root.dataset.scheme, 'black')
  assert.equal(storage.map.has('swm:scheme'), false, 'a preview is never stored')
  assert.equal(getScheme(), 'black')
  assert.equal(getCommittedScheme(), 'project')
  assert.equal(setScheme('black'), 'black')
  assert.equal(storage.map.get('swm:scheme'), 'black')
  assert.equal(getCommittedScheme(), 'black')
  assert.deepEqual(seen, [
    { scheme: 'black', prev: 'project', preview: true },
    { scheme: 'black', prev: 'black', preview: false },
  ])
})

test('an invalid name is a no-op: no attribute, no event, no storage write', () => {
  const { root, storage } = setup()
  let events = 0
  onScheme(() => events++)
  setScheme('blue')
  events = 0
  assert.equal(setScheme('purple'), 'blue')
  assert.equal(setScheme(undefined, { preview: true }), 'blue')
  assert.equal(root.dataset.scheme, 'blue')
  assert.equal(events, 0)
  assert.equal(storage.map.get('swm:scheme'), 'blue')
})

test('a call that changes nothing dispatches and writes nothing; Escape (commit of the committed) restores', () => {
  const { storage } = setup()
  const seen = []
  onScheme((d) => seen.push(d))
  setScheme('blue')
  setScheme('blue')
  setScheme('blue', { preview: true })
  assert.equal(seen.length, 1, 'same applied scheme, same preview-ness: nothing')
  setScheme('spectrum', { preview: true })
  setScheme('spectrum', { preview: true })
  assert.equal(seen.length, 2)
  assert.equal(storage.map.get('swm:scheme'), 'blue')
  assert.equal(setScheme(getCommittedScheme()), 'blue')
  assert.equal(seen.length, 3)
  assert.deepEqual(seen[2], { scheme: 'blue', prev: 'spectrum', preview: false })
})

// The privacy notice keeps the value only "if you change the site's color scheme": a
// restore of the committed scheme (the widget's Escape after a preview) is not a pick.
test('storage is written only when the committed scheme changes', () => {
  const { storage } = setup()
  const seen = []
  onScheme((d) => seen.push(d))
  setScheme('black', { preview: true })
  assert.equal(setScheme(getCommittedScheme()), 'project')
  assert.deepEqual(seen[1], { scheme: 'project', prev: 'black', preview: false }, 'the settled event still fires')
  assert.equal(storage.map.has('swm:scheme'), false, 'a visitor who never picked leaves nothing stored')

  // A ?scheme= preview over a stored pick: committing the stored scheme again writes nothing.
  let writes = 0
  const counted = memStorage({ 'swm:scheme': 'black' })
  const setItem = counted.setItem
  counted.setItem = (k, v) => {
    writes++
    setItem(k, v)
  }
  const { win } = setup({ storage: counted })
  win.__swmScheme = { applied: 'blue', committed: 'black' }
  assert.equal(setScheme('black'), 'black')
  assert.equal(writes, 0)
  assert.equal(setScheme('spectrum'), 'spectrum')
  assert.equal(writes, 1, 'a real pick is stored')
  assert.equal(counted.map.get('swm:scheme'), 'spectrum')
})

test('onScheme unsubscribes', () => {
  setup()
  let n = 0
  const off = onScheme(() => n++)
  setScheme('black')
  off()
  setScheme('blue')
  assert.equal(n, 1)
})

test('a throwing localStorage does not throw out of get or set; the scheme applies for the page', () => {
  const { root } = setup({ storage: throwingStorage() })
  assert.doesNotThrow(() => getScheme())
  assert.doesNotThrow(() => getCommittedScheme())
  assert.doesNotThrow(() => setScheme('black'))
  assert.equal(root.dataset.scheme, 'black')
  assert.equal(getScheme(), 'black')
})

test('useScheme reads project on the server whatever the page holds', () => {
  setup()
  setScheme('black')
  const Label = () => React.createElement('span', null, useScheme())
  assert.equal(renderToString(React.createElement(Label)), '<span>project</span>')
})

// --- the spectrum deal ------------------------------------------------------------------

test('spectrumKeyAt: the first twelve deals', () => {
  const first = Array.from({ length: 12 }, (_, i) => spectrumKeyAt(i))
  assert.deepEqual(first, [
    'blue', 'red', 'green', 'yellow', 'periwinkle', 'blue', 'red', 'green', 'blue', 'red', 'green', 'yellow',
  ])
})

test('spectrumKeyAt: no two adjacent keys are equal in the first 48', () => {
  for (let i = 1; i < 48; i++) assert.notEqual(spectrumKeyAt(i), spectrumKeyAt(i - 1), `deal ${i}`)
})

test('spectrumKeyAt: a full cycle of 468 deals is exactly 130/120/106/62/50, and it repeats', () => {
  const counts = {}
  for (let i = 0; i < 468; i++) counts[spectrumKeyAt(i)] = (counts[spectrumKeyAt(i)] ?? 0) + 1
  assert.deepEqual(counts, { blue: 130, red: 120, green: 106, yellow: 62, periwinkle: 50 })
  for (let i = 0; i < 20; i++) assert.equal(spectrumKeyAt(i + 468), spectrumKeyAt(i))
  assert.deepEqual(SPECTRUM_SHARES, { blue: 13.0, red: 12.0, green: 10.6, yellow: 6.2, periwinkle: 5.0 })
})

test('spectrumDeal maps by position in the list', () => {
  const slugs = ['coco', 'hhs', 'rozales', 'jeff', 'goldie', 'sixth']
  const deal = spectrumDeal(slugs)
  slugs.forEach((s, i) => assert.equal(deal[s], spectrumKeyAt(i)))
  assert.deepEqual(spectrumDeal([]), {})
})

// --- accents and inks --------------------------------------------------------------------

test('schemeAccent for all four schemes, an undefined projectColor and a missing spectrum key', () => {
  const w = { projectColor: '#84F104', spectrum: 'red' }
  assert.equal(schemeAccent(w, 'project'), '#84F104')
  assert.equal(schemeAccent({ spectrum: 'red' }, 'project'), undefined, 'project leaves an uncoloured world uncoloured')
  assert.equal(schemeAccent(undefined, 'project'), undefined)
  assert.equal(schemeAccent(w, 'black'), '#000000')
  assert.equal(schemeAccent(w, 'blue'), '#0000ff')
  assert.equal(schemeAccent(w, 'spectrum'), SPECTRUM.red.fill)
  assert.equal(schemeAccent({ projectColor: '#84F104' }, 'spectrum'), SPECTRUM.blue.fill, 'no spectrum key: blue')
  assert.equal(schemeAccent({ spectrum: 'constructor' }, 'spectrum'), SPECTRUM.blue.fill, 'not an own key: blue')
})

test('schemeAccent and schemeInk default to the applied scheme', () => {
  setup()
  const w = { projectColor: '#84F104', spectrum: 'green' }
  assert.equal(schemeAccent(w), '#84F104')
  setScheme('blue', { preview: true })
  assert.equal(schemeAccent(w), '#0000ff')
  setScheme('spectrum', { preview: true })
  assert.equal(schemeAccent(w), SPECTRUM.green.fill)
  assert.equal(schemeInk(w), SPECTRUM.green.fg)
})

test('schemeInk: the pair fg under spectrum, projectInk of the accent elsewhere', () => {
  for (const [key, pair] of Object.entries(SPECTRUM)) {
    assert.equal(schemeInk({ spectrum: key }, 'spectrum'), pair.fg, key)
  }
  assert.equal(schemeInk({}, 'spectrum'), SPECTRUM.blue.fg)
  assert.equal(schemeInk({ projectColor: '#84F104' }, 'project'), '#0a0a0a')
  assert.equal(schemeInk({ projectColor: '#AC232F' }, 'project'), '#ffffff')
  assert.equal(schemeInk({ projectColor: '#84F104' }, 'black'), '#ffffff', 'ink for black')
  assert.equal(schemeInk({ projectColor: '#84F104' }, 'blue'), '#ffffff', 'ink for brand blue')
  assert.equal(schemeInk({}, 'project'), undefined)
})

// --- the latch ----------------------------------------------------------------------------

test('latch parity: it names all four schemes and the storage key, in the module order', () => {
  assert.ok(latchSrc, 'BaseLayout.astro carries an is:inline latch')
  for (const name of SCHEMES) assert.ok(latchSrc.includes(`'${name}'`), name)
  assert.ok(latchSrc.includes(`'${SCHEME_STORAGE_KEY}'`))
  const list = latchSrc.match(/names = \[([^\]]*)\]/)
  assert.ok(list, 'the latch holds its scheme list as `names`')
  assert.deepEqual([...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]), SCHEMES)
})

test('latch order: data-scheme is set before any after-swap wiring, after theme-color, before ClientRouter', () => {
  const setAt = latchSrc.indexOf("setAttribute('data-scheme'")
  const callAt = latchSrc.search(/\bassert\(\);/)
  const wireAt = latchSrc.indexOf("'astro:after-swap'")
  assert.ok(setAt > -1 && callAt > setAt && wireAt > callAt, 'set, then call, then listen')
  assert.equal(latchSrc.split("'astro:after-swap'").length - 1, 1, 'ONE after-swap listener')
  const at = (s) => LAYOUT.indexOf(s)
  assert.ok(at('name="theme-color"') < at('<script is:inline>') && at('<script is:inline>') < at('<ClientRouter'))
})

test('latch: ?scheme= beats storage as a preview, is never stored, and survives a soft navigation', () => {
  const { root, storage, win, doc } = runLatch({ storage: memStorage({ 'swm:scheme': 'black' }), search: '?scheme=blue' })
  assert.equal(root.dataset.scheme, 'blue')
  assert.equal(win.__swmScheme.committed, 'black')
  assert.equal(getScheme(), 'blue')
  assert.equal(getCommittedScheme(), 'black')
  assert.equal(storage.map.get('swm:scheme'), 'black')
  root.wipe()
  doc.dispatchEvent(new Event('astro:after-swap'))
  assert.equal(root.dataset.scheme, 'blue')
  assert.equal(storage.map.get('swm:scheme'), 'black')
})

test('latch: the stored scheme applies without a param; nothing stored and no param is project', () => {
  assert.equal(runLatch({ storage: memStorage({ 'swm:scheme': 'spectrum' }) }).root.dataset.scheme, 'spectrum')
  assert.equal(runLatch().root.dataset.scheme, 'project')
  assert.equal(runLatch({ storage: memStorage({ 'swm:scheme': 'purple' }), search: '?scheme=green' }).root.dataset.scheme, 'project')
})

test('latch: a throwing localStorage does not throw and falls back to project on the next load', () => {
  const first = runLatch({ storage: throwingStorage(), search: '' })
  assert.equal(first.root.dataset.scheme, 'project')
  assert.doesNotThrow(() => setScheme('black'))
  assert.equal(first.root.dataset.scheme, 'black', 'applies for the page')
  const next = runLatch({ storage: throwingStorage() })
  assert.equal(next.root.dataset.scheme, 'project', 'a new load starts from project')
  assert.equal(runLatch({ storage: throwingStorage(), search: '?scheme=blue' }).root.dataset.scheme, 'blue')
})

test('latch: ?schemefade sets --scheme-fade (finite, >= 0) and re-sets it after a swap', () => {
  const { root, doc } = runLatch({ search: '?schemefade=250' })
  assert.equal(root.style.getPropertyValue('--scheme-fade'), '250ms')
  root.wipe()
  doc.dispatchEvent(new Event('astro:after-swap'))
  assert.equal(root.style.getPropertyValue('--scheme-fade'), '250ms')
  assert.equal(runLatch({ search: '?schemefade=0' }).root.style.getPropertyValue('--scheme-fade'), '0ms')
  for (const bad of ['-5', 'abc', '', 'Infinity']) {
    assert.equal(runLatch({ search: `?schemefade=${bad}` }).root.style.getPropertyValue('--scheme-fade'), '', bad)
  }
})

test('latch: setScheme after the latch keeps the shared state in one place', () => {
  const { win, root } = runLatch({ storage: memStorage({ 'swm:scheme': 'blue' }) })
  const state = win.__swmScheme
  setScheme('spectrum')
  assert.equal(win.__swmScheme, state, 'the module writes the latch\'s own object')
  assert.deepEqual({ ...state }, { applied: 'spectrum', committed: 'spectrum' })
  assert.equal(root.dataset.scheme, 'spectrum')
})
