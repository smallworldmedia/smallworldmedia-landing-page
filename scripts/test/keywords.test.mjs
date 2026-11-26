// The keyword-highlight switch (SQ-25, 11-07) — src/lib/keywords.jsx.
//
// Nathan turned the accent highlighting off sitewide but kept the bracket
// syntax, so the contract worth pinning is both halves of it:
//
//   OFF (shipped)  `[[word]]` renders as the plain word — no <mark class="kw">,
//                  no box, no second ink; a linked keyword is a prose link;
//                  kwWipe / kwSet touch nothing; the markers are still parsed
//                  and stripped, and `**bold**` is untouched.
//   ON (?kwhighlight=1, or KW_HIGHLIGHT = true)  the three-layer mark as
//                  before.
//   PER SURFACE (11-07)  a surface passes its own switch; the detail blurbs'
//                  KW_HIGHLIGHT_DETAIL is on, and the dial overrides it
//                  either way.
//
// keywords.jsx is JSX that pulls in react + gsap, so it is bundled with esbuild
// (already in node_modules via vite) into a temp CJS file and rendered with
// react-dom/server — the real renderer, not a source regex.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../../', import.meta.url))

const built = await build({
  stdin: {
    contents: `
      import * as kw from './src/lib/keywords.jsx';
      import { createElement, Fragment } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      export { kw, createElement, Fragment, renderToStaticMarkup };
    `,
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  loader: { '.jsx': 'jsx' },
  logLevel: 'silent',
})
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swm-kw-test-'))
const file = path.join(dir, 'keywords.bundle.cjs')
fs.writeFileSync(file, built.outputFiles[0].text)
const { kw, createElement, Fragment, renderToStaticMarkup } = createRequire(import.meta.url)(file)
fs.rmSync(dir, { recursive: true, force: true })

const html = (nodes) => renderToStaticMarkup(createElement(Fragment, null, nodes))

/** Run `fn` as if the page URL were `search` (the server has no window). */
function withSearch(search, fn) {
  globalThis.window = { location: { search } }
  try {
    return fn()
  } finally {
    delete globalThis.window
  }
}
const ON = '?kwhighlight=1'

/* — the shipped state — */

test('the shipped switch is off', () => {
  assert.equal(kw.KW_HIGHLIGHT, false)
  assert.equal(kw.kwHighlightOn(), false)
})

test('off renders a keyword as the plain word with no kw markup', () => {
  const out = html(kw.renderKeywords('the [[core]] of your world'))
  assert.equal(out, 'the core of your world')
  assert.ok(!out.includes('kw'))
})

test('off still strips the brackets and keeps the punctuation', () => {
  const out = html(kw.renderKeywords('for your [[audience]], not [[just fans]].'))
  assert.equal(out, 'for your audience, not just fans.')
})

test('off leaves bold and plain links alone', () => {
  const out = html(kw.renderKeywords('a **heavy** [HHS](/work/hhs) [[word]]'))
  assert.equal(out, 'a <b class="kw-em">heavy</b> <a class="prose-link" href="/work/hhs">HHS</a> word')
})

test('off keeps a linked keyword a link in the prose-link style', () => {
  assert.equal(
    html(kw.renderKeywords('see [[HHS]](/work/hhs) or [[Ext]](https://example.com/x)')),
    'see <a class="prose-link" href="/work/hhs">HHS</a> or ' +
      '<a class="prose-link" href="https://example.com/x" target="_blank" rel="noopener noreferrer">Ext</a>'
  )
})

test('stripKeywords is the same with the switch off or on', () => {
  const src = 'a [[b c]], **d** [e](/f) [[g]](/h)'
  const off = kw.stripKeywords(src)
  assert.equal(off, 'a b c, d e g')
  assert.equal(withSearch(ON, () => kw.stripKeywords(src)), off)
})

test('off keywordLines yields ordinary spaced words with no kw tokens', () => {
  const [line] = kw.keywordLines('a [[b c]], d[[e]] **f**')
  assert.ok(line.every((t) => t.kw === false))
  assert.deepEqual(
    line.map((t) => [t.sep, t.text, t.em]),
    [['', 'a', false], [' ', 'b', false], [' ', 'c,', false], [' ', 'd', false], ['', 'e', false], [' ', 'f', true]]
  )
})

test('off keywordLines keeps a linked keyword as a per-word link', () => {
  const [line] = kw.keywordLines('see [[two words]](/x)')
  assert.deepEqual(
    line.map((t) => [t.text, t.href, t.kw]),
    [['see', undefined, false], ['two', '/x', false], ['words', '/x', false]]
  )
})

test('off renderWordTokens draws no mark and a prose-link for a linked keyword', () => {
  const [line] = kw.keywordLines('a [[b]] [[c]](/x)')
  const out = html(kw.renderWordTokens(line, { wordClass: 'w', emClass: 'w--em' }))
  assert.ok(!out.includes('kw'))
  assert.equal(
    out,
    '<span class="w">a</span> <span class="w">b</span> <span class="w"><a class="prose-link" href="/x">c</a></span>'
  )
})

test('off kwWipe and kwSet never touch the root and append nothing', () => {
  const boom = { querySelectorAll: () => assert.fail('the root must not be queried') }
  const tl = { to: () => assert.fail('nothing may be appended to the timeline') }
  assert.equal(kw.kwWipe(tl, boom, 1), 0)
  assert.equal(kw.kwSet(boom, true), undefined)
})

/* — switched on — */

test('on (?kwhighlight=1) renders the three-layer mark as before', () => {
  const out = withSearch(ON, () => html(kw.renderKeywords('the [[core]] of')))
  assert.equal(
    out,
    'the <mark class="kw" data-kw="1"><span class="kw__box" aria-hidden="true"></span>' +
      '<span class="kw__base">core</span><span class="kw__ink" aria-hidden="true">core</span></mark> of'
  )
})

test('on splits a multi-word keyword per word and links it as kw-link', () => {
  const out = withSearch(ON, () => html(kw.renderKeywords('[[two words]](/x)')))
  assert.equal((out.match(/<mark class="kw"/g) || []).length, 2)
  assert.ok(out.startsWith('<a class="kw-link" href="/x">'))
  assert.ok(out.includes('​'))
})

test('on keywordLines and renderWordTokens emit kw tokens and marks', () => {
  withSearch(ON, () => {
    const [line] = kw.keywordLines('a [[b]] c')
    assert.deepEqual(line.map((t) => t.kw), [false, true, false])
    assert.equal(line[1].kwIndex, 0)
    const out = html(kw.renderWordTokens(line, { wordClass: 'w' }))
    assert.equal((out.match(/<mark class="kw"/g) || []).length, 1)
  })
})

test('on kwWipe appends the box and ink tweens at the given beat', () => {
  withSearch(ON, () => {
    const marks = [{ dataset: { kw: '0' }, querySelector: (s) => ({ sel: s }) }]
    const rootEl = { querySelectorAll: () => marks }
    const calls = []
    const tl = {
      to(targets, vars, at) {
        calls.push({ targets, vars, at })
        return this
      },
    }
    assert.equal(kw.kwWipe(tl, rootEl, 2), 1)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].vars.scaleX, 1)
    assert.equal(calls[1].vars.clipPath, 'inset(-0.35em 0% -0.35em 0)')
    assert.equal(calls[0].at, 2)
  })
})

test('a zero value of the dial keeps the highlights off', () => {
  assert.equal(withSearch('?kwhighlight=0', () => kw.kwHighlightOn()), false)
  assert.equal(withSearch('?other=1', () => kw.kwHighlightOn()), false)
  assert.equal(withSearch('?kwhighlight=1', () => kw.kwHighlightOn()), true)
})

/* — per surface (the detail blurbs, 11-07) — */

test('the detail blurbs switch is on while the sitewide one stays off', () => {
  assert.equal(kw.KW_HIGHLIGHT_DETAIL, true)
  assert.equal(kw.kwHighlightOn(kw.KW_HIGHLIGHT_DETAIL), true)
  assert.equal(kw.kwHighlightOn(), false)
})

test('a surface switch draws the mark with no dial and leaves the default surface plain', () => {
  const src = 'the [[core]] of'
  assert.ok(html(kw.renderKeywords(src, kw.KW_HIGHLIGHT_DETAIL)).includes('<mark class="kw"'))
  assert.equal(html(kw.renderKeywords(src)), 'the core of')
})

test('the dial overrides a surface switch both ways', () => {
  assert.equal(withSearch('?kwhighlight=0', () => kw.kwHighlightOn(true)), false)
  assert.equal(withSearch('?kwhighlight=1', () => kw.kwHighlightOn(false)), true)
  assert.equal(withSearch('?other=1', () => kw.kwHighlightOn(true)), true)
})

test('kwWipe and kwSet follow the surface switch they are given', () => {
  const boom = { querySelectorAll: () => assert.fail('the root must not be queried') }
  const tl = { to: () => assert.fail('nothing may be appended to the timeline') }
  assert.equal(withSearch('?kwhighlight=0', () => kw.kwWipe(tl, boom, 0, { surface: true })), 0)
  assert.equal(withSearch('?kwhighlight=0', () => kw.kwSet(boom, true, true)), undefined)
  const marks = [{ dataset: { kw: '0' }, querySelector: (sel) => ({ sel }) }]
  const calls = []
  const rec = { to(...a) { calls.push(a); return this } }
  assert.equal(kw.kwWipe(rec, { querySelectorAll: () => marks }, 0, { surface: true }), 1)
  assert.equal(calls.length, 2)
})
