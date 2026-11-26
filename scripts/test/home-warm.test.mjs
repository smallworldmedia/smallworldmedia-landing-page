// The way home skips the network (SQ-33): homeWarm keeps an in-memory copy of
// `/` and serves it to the ClientRouter's own loader for a navigation home;
// every other fetch, destination and a form post go to the network as before.
//   node --test scripts/test/home-warm.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { installHomeWarm, TTL_MS } from '../../src/layouts/homeWarm.js'

const ORIGIN = 'https://smallworld.media'
const HOME_HTML = '<html><head><meta name="astro-view-transitions-enabled"></head><body>home</body></html>'

function fakeWindow(path = '/work/') {
  const listeners = {}
  const calls = []
  const win = {
    location: { href: ORIGIN + path, pathname: path, origin: ORIGIN },
    navigator: {},
    document: { addEventListener: (n, f) => ((listeners[n] ||= []).push(f)) },
    requestIdleCallback: (cb) => cb(),
    setTimeout: (cb) => cb(),
    fetch: async (input) => {
      calls.push(String(input))
      return new Response(String(input) === '/' ? HOME_HTML : 'net', { headers: { 'content-type': 'text/html' } })
    },
  }
  const fire = (n, e) => (listeners[n] || []).forEach((f) => f(e))
  return { win, calls, fire }
}

// Stands in for Astro's defaultLoader: fetches event.to.href through the global fetch.
function prepEvent(win, href, extra = {}) {
  const e = { to: new URL(href, ORIGIN), formData: undefined, ...extra }
  e.loader = async () => {
    const r = await win.fetch(e.to.href, {})
    e.html = await r.text()
  }
  return e
}

test('a navigation home is served the warmed copy with no network fetch', async () => {
  const { win, calls, fire } = fakeWindow()
  const realFetch = win.fetch
  const { warm } = installHomeWarm(win)
  fire('astro:page-load')
  await warm()
  assert.deepEqual(calls, ['/'])
  const e = prepEvent(win, '/')
  fire('astro:before-preparation', e)
  await e.loader()
  assert.equal(e.html, HOME_HTML)
  assert.deepEqual(calls, ['/'], 'the router fetch never reached the network')
  assert.equal(win.fetch, realFetch, 'the global fetch is restored')
})

test('other destinations and a form post keep their network load', async () => {
  const { win, calls, fire } = fakeWindow()
  installHomeWarm(win)
  fire('astro:page-load')
  await new Promise((r) => setImmediate(r))
  for (const e of [prepEvent(win, '/work/rossi/'), prepEvent(win, '/?popseed=1'), prepEvent(win, '/', { formData: {} })]) {
    fire('astro:before-preparation', e)
    await e.loader()
    assert.equal(e.html, 'net')
  }
  assert.equal(calls.length, 4)
})

test('home itself never warms, and a stale copy falls through to the network', async (t) => {
  const home = fakeWindow('/')
  installHomeWarm(home.win)
  home.fire('astro:page-load')
  assert.deepEqual(home.calls, [])

  const { win, calls, fire } = fakeWindow()
  const { warm } = installHomeWarm(win)
  await warm()
  const now = Date.now()
  t.mock.method(Date, 'now', () => now + TTL_MS + 1)
  const e = prepEvent(win, '/')
  fire('astro:before-preparation', e)
  await e.loader()
  assert.deepEqual(calls, ['/', ORIGIN + '/'])
})
