// SQ-75 (11-13): the /work pager simplified toward the mobile menu — file-level
// assertions on the CSS / JS, the house style for skin work.
//   node --test scripts/test/pager-simplify.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')

// A flat rule list: { media, selector, body } — one level of @media nesting,
// which is all these two sheets use around the rules under test.
function rules(css) {
  const src = stripComments(css)
  const out = []
  let i = 0
  const walk = (media, end) => {
    while (i < end) {
      const open = src.indexOf('{', i)
      if (open === -1 || open >= end) return
      const head = src.slice(i, open).trim()
      let depth = 1
      let j = open + 1
      while (depth && j < src.length) {
        if (src[j] === '{') depth++
        else if (src[j] === '}') depth--
        j++
      }
      if (head.startsWith('@media')) {
        const save = i
        i = open + 1
        walk(head, j - 1)
        i = j
        void save
      } else if (!head.startsWith('@')) {
        out.push({ media, selector: head.replace(/\s+/g, ' '), body: src.slice(open + 1, j - 1) })
        i = j
      } else {
        i = j // @keyframes etc.
      }
    }
  }
  walk(null, src.length)
  return out
}
const find = (css, selector, media = null) =>
  rules(css).filter((r) => r.selector === selector && (media === null ? !r.media : r.media?.includes(media)))
const decl = (rule, prop) => {
  const m = rule.body.match(new RegExp(`(?:^|[;\\s])${prop.replace(/[-]/g, '\\-')}\\s*:\\s*([^;]+);`))
  return m ? m[1].replace(/\s+/g, ' ').trim() : null
}

const GLOBAL = read('src/styles/global.css')
const FP = read('src/styles/featured-projects.css')
const PAGER = read('src/components/work/pager/GraticulePager.jsx')

test('the menu item size is ONE token and .mobile-menu__item reads it', () => {
  const root = find(GLOBAL, ':root')
  const tok = root.map((r) => decl(r, '--text-menu-item')).find(Boolean)
  assert.equal(tok, 'clamp(2.286rem, 9vw, 3.429rem)', 'the token keeps the menu\'s old hardcoded value')
  const item = find(GLOBAL, '.mobile-menu__item')[0]
  assert.equal(decl(item, 'font-size'), 'var(--text-menu-item)')
})

test('the phone SELECTED name paints at the menu token — derived, not hand-tuned', () => {
  const name = find(FP, '.fp .fp-scale__name', '(max-width: 768px)')[0]
  assert.ok(name, 'a ≤768 .fp-scale__name rule exists')
  // base = token ÷ the selected paint (sel × bump); the row's own transform
  // multiplies back by exactly that at the lens, so painted = token.
  assert.equal(
    decl(name, 'font-size'),
    'calc(var(--text-menu-item) / (var(--scale-sel) * var(--scale-sel-bump)))'
  )
  // the selected paint is sel × bump at the lens (w1 = wd = 1): the --sel formula the claim rests on
  assert.match(
    stripComments(FP),
    /--sel:\s*calc\(\s*1 \+ \(var\(--scale-sel\) - 1\) \* var\(--wd\) \+\s*\(var\(--scale-sel\) \* var\(--scale-sel-bump\) - var\(--scale-sel\)\) \* var\(--w1\) \* var\(--w1\)\s*\)/
  )
  // no ≤768 re-introduction of a px/rem name size
  assert.equal(find(FP, '.fp .fp-scale__name').map((r) => decl(r, 'font-size')).filter(Boolean).length, 0)
})

test('the faint-ink role token exists at 0.9 and the non-selected rows read it', () => {
  const root = find(GLOBAL, ':root')
  const faint = root.map((r) => decl(r, '--ink-faint')).find(Boolean)
  assert.ok(faint, '--ink-faint is defined on :root')
  assert.match(faint, /color-mix\(\s*in oklab,\s*var\(--color-black\),\s*var\(--color-white\) calc\(var\(--ink-faint-l, 0\.9\) \* 100%\)\s*\)/)
  assert.match(stripComments(GLOBAL), /var\(--ink-muted-l, 0\.58\)/, '--ink-muted itself did not move')
  const station = find(FP, '.fp .fp-scale__station')[0]
  const color = decl(station, 'color')
  assert.match(color, /var\(--ink-faint\)/)
  // the falloff dials still ride on top of the base
  for (const d of ['--scale-ink-floor', '--wi']) assert.ok(color.includes(d), d)
})

test('the selected row reads --color-white for name and number (one colour on the station)', () => {
  const color = decl(find(FP, '.fp .fp-scale__station')[0], 'color')
  // pure white weighted by --w1 (1 only on the detented row), faint otherwise
  assert.match(color, /color-mix\(in srgb, var\(--color-white\) calc\(var\(--w1\) \* 100%\), var\(--ink-faint\)\)/)
  // the name inherits that colour — no row-level colour of its own to defeat it
  assert.equal(find(FP, '.fp .fp-scale__name').map((r) => decl(r, 'color')).filter(Boolean).length, 0)
  assert.equal(find(FP, '.fp .fp-scale__name[data-sel]').map((r) => decl(r, 'color')).filter(Boolean).length, 0)
})

test('.fp-scale__box paints no fill', () => {
  const boxes = rules(FP).filter((r) => /\.fp-scale__box\b/.test(r.selector))
  assert.ok(boxes.length > 0)
  for (const r of boxes) {
    assert.equal(decl(r, 'background'), null, r.selector)
    assert.equal(decl(r, 'background-color'), null, r.selector)
  }
})

test('the desktop fill ticker is gone: no data-fill, ?fillpxs, ?unfill or --scale-fill-pxs in src', () => {
  const files = []
  ;(function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(jsx?|astro|css|mjs)$/.test(e)) files.push(p)
    }
  })(join(ROOT, 'src'))
  for (const f of files) {
    const s = readFileSync(f, 'utf8')
    for (const needle of ['data-fill', 'fillpxs', '--scale-fill-pxs', 'fp-scale-fill', "PARAM('unfill'", '--scale-box-gap', 'boxgap']) {
      assert.ok(!s.includes(needle), `${f} still mentions ${needle}`)
    }
  }
  const guide = read('docs/tunables-guide.md')
  assert.ok(!/`\?(fillpxs|unfill|boxgap)`/.test(guide), 'the tunables guide drops the removed dials')
  assert.match(guide, /`\?inkfaint`/, 'and documents the new faint-ink dial')
  // the ≤768 clip marquee stays
  assert.ok(find(FP, '.fp .fp-scale__name[data-marquee] .fp-scale__name-track').length > 0)
  assert.match(PAGER, /toggleAttribute\('data-marquee'/)
})

test('phone scrim: plain black (no tint, blur or grain); the desktop recipe is intact', () => {
  const phone = find(FP, ".fp[data-pager='scale']", '(max-width: 768px)')
  assert.equal(phone.length, 1)
  const p = phone[0]
  assert.equal(decl(p, '--scrim-tint'), '0')
  assert.equal(decl(p, '--scrim-bf'), 'none')
  assert.equal(decl(p, '--scrim-noise'), 'none')
  assert.equal(decl(p, '--scrim-grain-anim'), 'none')
  assert.equal(decl(p, '--pager-scrim'), '1', 'opaque by default (the menu\'s own); ?scrimtune dials it')
  assert.equal(decl(p, '--scrim-noise-size'), null, 'the ≤768 grain tile size is gone')

  const desk = find(FP, ".fp[data-pager='scale']")[0]
  assert.equal(decl(desk, '--scrim-tint'), '0.75')
  assert.equal(decl(desk, '--scrim-bf'), 'blur(7.5px)')
  assert.equal(decl(desk, '--scrim-noise-size'), '184px')
  assert.match(decl(desk, '--scrim-noise'), /^url\("data:image\/svg\+xml,.*baseFrequency%3D'0\.84'.*slope%3D'0\.82'/)
  const before = find(FP, ".fp[data-pager='scale']::before")[0]
  assert.match(decl(before, 'background-color'), /var\(--scrim-tint, 0\)/)
  assert.ok(FP.includes('@keyframes fp-scrim-grain'), 'the desktop grain driver stays')
  assert.equal((decl(find(FP, ".fp[data-pager='scale'].is-pager-engaged::before, .fp[data-pager='scale'].is-scrimtune-hold::before")[0], 'animation') || '').startsWith('var(--scrim-grain-anim, fp-scrim-grain'), true)

  // the phone-only grain recipe is deleted: no mobile grain constant, no mobile tier in the dials
  const noise = read('src/components/work/scrimNoise.js')
  assert.ok(!noise.includes('SCRIM_GRAIN_MOBILE'))
  assert.ok(!PAGER.includes('SCRIM_GRAIN_MOBILE'))
  assert.ok(!/--scrim-noise-size:\s*90px/.test(FP))
})

test('the ?scrimtune bench opens on the phone scrim at ≤768', () => {
  const bench = read('src/components/work/ScrimTunePanel.jsx')
  assert.match(bench, /matchMedia\('\(max-width: 768px\)'\)/)
  assert.match(bench, /scrim: 1, tint: 0, blur: 0, type: 'none'/)
})
