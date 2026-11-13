// The info drawer's push-down and its Site Settings blurb (SQ-70, 11-12) — the
// parts checkable without a browser. The GEOMETRY (the bar's top edge on the
// viewport's bottom edge, the lockstep trace, the zoom sequencing) is measured
// by `node scripts/info-push-probe.mjs`; this file holds what that probe cannot
// pin:
//
//   1. src/lib/infoPush.js — the measured distance (0 off home, backs out the
//      push already applied), the var it writes, and requestInfoClose's
//      run-now / run-after contract, with a stand-in document;
//   2. the CSS source contract — every pushed surface reads --info-push through
//      the individual `translate` property and ONLY under [data-footer-rest],
//      so no other route can ever move;
//   3. the Site Settings field — optional, fetched with the rest of the site
//      copy, today's copy as the empty-field fallback.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))
const css = fs.readFileSync(`${root}src/styles/global.css`, 'utf8')
const schema = fs.readFileSync(`${root}src/schemas/siteSettings.ts`, 'utf8')
const queries = fs.readFileSync(`${root}src/lib/queries.js`, 'utf8')

/* — a stand-in document: just what infoPush.js touches — */

function stage({ latch = true, barTop = 796.8125, innerHeight = 900 } = {}) {
  const props = new Map()
  const bar = latch && barTop !== null ? { getBoundingClientRect: () => ({ top: barTop + Number.parseFloat(props.get('--info-push') || 0) }) } : null
  globalThis.window = Object.assign(new EventTarget(), {
    innerHeight,
    matchMedia: () => ({ matches: false }),
  })
  globalThis.document = {
    documentElement: {
      hasAttribute: (n) => latch && n === 'data-footer-rest',
      style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) },
    },
    querySelector: (s) => (s === '.site-footer--links' ? bar : null),
  }
  return props
}

const mod = await import(`${root}src/lib/infoPush.js`)

test('the drawer\'s slide is one definition for the drawer and the push', () => {
  assert.deepEqual(mod.INFO_OPEN, { duration: 0.6, ease: 'power3.out' })
  assert.deepEqual(mod.INFO_CLOSE, { duration: 0.48, ease: 'power2.inOut', delay: 0.15 })
})

test('measureInfoPush is the bar\'s top edge to the viewport bottom — not the drawer\'s height', () => {
  stage()
  assert.equal(mod.measureInfoPush(), 900 - 796.8125)
})

test('measureInfoPush is 0 off home (no latch) or before the footer panel mounts', () => {
  stage({ latch: false })
  assert.equal(mod.measureInfoPush(), 0)
  stage({ barTop: null })
  assert.equal(mod.measureInfoPush(), 0)
})

test('measureInfoPush backs out the push already applied, so it is stable mid-tween', () => {
  const props = stage()
  mod.pushTo(40, null) // a jump: infoPush.v = 40, --info-push painted
  assert.equal(props.get('--info-push'), '40px')
  assert.ok(Math.abs(mod.measureInfoPush() - (900 - 796.8125)) < 1e-9)
  mod.pushTo(0, null)
})

test('a push of 0 removes the var instead of leaving 0px on <html>', () => {
  const props = stage()
  mod.pushTo(25, null)
  assert.ok(props.has('--info-push'))
  mod.pushTo(0, null)
  assert.equal(props.has('--info-push'), false)
})

test('requestInfoClose runs now when nothing holds it, and after when the shell defers', () => {
  stage()
  let ran = 0
  mod.requestInfoClose(() => ran++)
  assert.equal(ran, 1, 'no shell listening: the zoom starts at once')

  let done
  window.addEventListener(mod.INFO_CLOSE_EVENT, (e) => {
    e.detail.deferred = true
    done = e.detail.done
  })
  mod.requestInfoClose(() => ran++)
  assert.equal(ran, 1, 'the shell took it: nothing runs yet')
  done()
  assert.equal(ran, 2, 'the close landed: the zoom starts')
})

/* — the CSS source contract — */

const ruleFor = (selector) => {
  const at = css.indexOf(selector)
  assert.ok(at >= 0, `${selector} rule missing`)
  return css.slice(at, css.indexOf('}', at))
}

test('every pushed surface reads --info-push on `translate`, gated on [data-footer-rest]', () => {
  assert.match(ruleFor('html[data-footer-rest] .site-footer--links {'), /translate: 0 calc\(var\(--footer-slide, 0px\) \+ var\(--info-push, 0px\)\)/)
  const hero = ruleFor('html[data-footer-rest] .hero__globe,')
  assert.match(hero, /translate: 0 calc\(var\(--hero-lift, 0px\) \* -1 \+ var\(--info-push, 0px\)\)/)
  const tagline = ruleFor('html[data-footer-rest] .site-tagline,')
  assert.match(tagline, /html\[data-footer-rest\] \.site-privacy/)
  assert.match(tagline, /translate: 0 var\(--info-push, 0px\)/)
  assert.match(ruleFor('html[data-footer-rest] .hero {'), /background-position: 0 var\(--info-push, 0px\)/)
})

test('--info-push is read nowhere outside a [data-footer-rest] rule', () => {
  // Every rule whose body reads the var carries the latch in its selector, so
  // an ungated read would be a route that can move.
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const readers = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => body.includes('var(--info-push'))
  assert.ok(readers.length >= 4, 'footer, hero group, tagline + privacy, hero backdrop')
  for (const [, selector] of readers) assert.match(selector, /data-footer-rest/, selector.trim())
})

test('the drawer\'s bold cut: the **bold** marker looks like the old <strong>', () => {
  assert.match(css, /\.description__text strong,\s*\n\.description__text \.kw-em \{/)
})

/* — the Site Settings field — */

test('infoBlurb is an optional text field beside footerBlurb', () => {
  const at = schema.indexOf("name: 'infoBlurb'")
  assert.ok(at > schema.indexOf("name: 'footerBlurb'"), 'declared after footerBlurb')
  const field = schema.slice(at, schema.indexOf('defineField', at))
  assert.match(field, /type: 'text'/)
  assert.match(field, /title: 'Info panel blurb'/)
  assert.doesNotMatch(field, /required\(\)/, 'a required field would flag the live singleton in Studio')
})

test('the site-copy query fetches infoBlurb', () => {
  const q = queries.slice(queries.indexOf('SITE_COPY_QUERY'))
  assert.match(q.slice(0, q.indexOf('`;', q.indexOf('`'))), /infoBlurb/)
})

// siteCopy.js imports a Sanity client that reads import.meta.env; bundle it with
// that one import stubbed so getSiteCopy runs for real against a canned reply.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'swm-site-copy-'))
await build({
  entryPoints: [`${root}src/lib/siteCopy.js`],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: path.join(tmp, 'siteCopy.mjs'),
  logLevel: 'silent',
  plugins: [
    {
      name: 'stub-sanity-client',
      setup(b) {
        b.onResolve({ filter: /sanityClient\.js$/ }, () => ({ path: 'stub', namespace: 'stub' }))
        b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
          contents: 'export const sanityFetch = () => globalThis.__siteCopyReply()',
          loader: 'js',
        }))
      },
    },
  ],
})

let load = 0
async function copyFor(reply) {
  globalThis.__siteCopyReply = () => (reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply))
  const m = await import(`${path.join(tmp, 'siteCopy.mjs')}?n=${load++}`) // fresh memo each time
  return { copy: await m.getSiteCopy(), fallback: m.SITE_COPY_FALLBACK }
}

test('the fallback is the drawer\'s copy as it shipped', async () => {
  const { fallback } = await copyFor({})
  assert.equal(
    fallback.infoBlurb.replace(/\*\*/g, ''),
    'Small World Media is a multidisciplinary creative studio specializing in design and motion ' +
      'across 2D, 3D, and experimental techniques for the music industry.'
  )
  assert.ok(fallback.infoBlurb.startsWith('**Small World Media**'))
})

test('an empty, blank, missing or failed infoBlurb leaves the panel on today\'s copy', async () => {
  for (const reply of [{ infoBlurb: '' }, { infoBlurb: '  \n ' }, {}, null, new Error('offline')]) {
    const { copy, fallback } = await copyFor(reply)
    assert.equal(copy.infoBlurb, fallback.infoBlurb)
  }
})

test('a filled infoBlurb comes through trimmed, and the other copy is untouched', async () => {
  const { copy, fallback } = await copyFor({ infoBlurb: '  **SWM** makes [[worlds]].  ' })
  assert.equal(copy.infoBlurb, '**SWM** makes [[worlds]].')
  assert.equal(copy.footerBlurb, fallback.footerBlurb)
  assert.equal(copy.tagline, fallback.tagline)
})
