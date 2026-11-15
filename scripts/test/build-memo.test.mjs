// buildMemo (src/lib/buildMemo.js): one Sanity read per build, and on the dev
// server one per page load (11-14: the drawer's client list on :4322 was four
// clients behind Sanity, because `astro dev` kept the build's memo for as long
// as the module lived).
//
// The module reads import.meta.env.DEV, which only Vite defines, so each case
// bundles it with that value set the way Vite would set it.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swm-build-memo-'))

async function memoFor(name, define) {
  const outfile = path.join(tmp, `${name}.mjs`)
  await build({
    entryPoints: [`${root}src/lib/buildMemo.js`],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
    define,
  })
  return (await import(outfile)).buildMemo
}

/** Runs `fn` with Date.now() under the test's control. */
async function withClock(fn) {
  const real = Date.now
  let now = 1_000_000
  Date.now = () => now
  try {
    await fn((ms) => {
      now += ms
    })
  } finally {
    Date.now = real
  }
}

test('a build keeps the first result for its whole run', async () => {
  const buildMemo = await memoFor('build', { 'import.meta.env.DEV': 'false' })
  let loads = 0
  const get = buildMemo(async () => ++loads)
  await withClock(async (tick) => {
    assert.equal(await get(), 1)
    tick(60_000)
    assert.equal(await get(), 1)
    assert.equal(loads, 1)
  })
})

test('with no import.meta.env at all (a Node bundle) it behaves as a build', async () => {
  const buildMemo = await memoFor('bare', {})
  let loads = 0
  const get = buildMemo(async () => ++loads)
  await withClock(async (tick) => {
    await get()
    tick(60_000)
    await get()
    assert.equal(loads, 1)
  })
})

test('the dev server shares one request across a page, then reads again', async () => {
  const buildMemo = await memoFor('dev', { 'import.meta.env.DEV': 'true' })
  let loads = 0
  let release
  const get = buildMemo(
    () =>
      new Promise((resolve) => {
        const n = ++loads
        release = () => resolve(n)
      })
  )
  await withClock(async (tick) => {
    // The page asks, the read is slow, the layout asks while it is in flight
    // and again just after it lands: one request.
    const a = get()
    tick(10_000)
    const b = get()
    release()
    assert.equal(await a, 1)
    assert.equal(await b, 1)
    await new Promise((r) => setImmediate(r))
    tick(500)
    assert.equal(await get(), 1)
    assert.equal(loads, 1)
    // A reload a few seconds later: Sanity is read again.
    tick(5_000)
    const c = get()
    release()
    assert.equal(await c, 2)
    assert.equal(loads, 2)
  })
})

test('a failed read is never kept', async () => {
  const buildMemo = await memoFor('fail', { 'import.meta.env.DEV': 'false' })
  let loads = 0
  const get = buildMemo(async () => {
    if (++loads === 1) throw new Error('offline')
    return 'ok'
  })
  await assert.rejects(get(), /offline/)
  await new Promise((r) => setImmediate(r))
  assert.equal(await get(), 'ok')
  assert.equal(loads, 2)
})
