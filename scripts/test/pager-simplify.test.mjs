// SQ-75 (11-13): the /featured-projects pager simplified toward the mobile menu — file-level
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
// SQ-87: the pager's skin (every rule whose subject is a .fp-scale element) lives in its own sheet,
// scoped :is(.fp, .swm-corner) — the /featured-projects stage or the corner wrapper — at the specificity of a bare .fp.
const PS = read('src/styles/pager-scale.css')
const SCOPE = ':is(.fp, .swm-corner)'
const sc = (sel) => sel.replace(/(^|, )\.fp /g, `$1${SCOPE} `)
const findPS = (selector, media = null) => find(PS, sc(selector), media)
const PAGER = read('src/components/work/pager/GraticulePager.jsx')

test('the menu item size is ONE token and .mobile-menu__item reads it', () => {
  const root = find(GLOBAL, ':root')
  const tok = root.map((r) => decl(r, '--text-menu-item')).find(Boolean)
  assert.equal(tok, 'clamp(2.286rem, 9vw, 3.429rem)', 'the token keeps the menu\'s old hardcoded value')
  const item = find(GLOBAL, '.mobile-menu__item')[0]
  assert.equal(decl(item, 'font-size'), 'var(--text-menu-item)')
})

test('the phone SELECTED name paints at the menu token — derived, not hand-tuned', () => {
  const name = findPS('.fp .fp-scale__name', '(max-width: 768px)')[0]
  assert.ok(name, 'a ≤768 .fp-scale__name rule exists')
  // base = token ÷ the selected paint (sel × bump); the row's own transform
  // multiplies back by exactly that at the lens, so painted = token.
  assert.equal(
    decl(name, 'font-size'),
    'calc(var(--text-menu-item) / (var(--scale-sel) * var(--scale-sel-bump)))'
  )
  // the selected paint is sel × bump at the lens (w1 = wd = 1): the --sel formula the claim rests on
  assert.match(
    stripComments(PS),
    /--sel:\s*calc\(\s*1 \+ \(var\(--scale-sel\) - 1\) \* var\(--wd\) \+\s*\(var\(--scale-sel\) \* var\(--scale-sel-bump\) - var\(--scale-sel\)\) \* var\(--w1\) \* var\(--w1\)\s*\)/
  )
  // no ≤768 re-introduction of a px/rem name size
  assert.equal(findPS('.fp .fp-scale__name').map((r) => decl(r, 'font-size')).filter(Boolean).length, 0)
})

test('the faint-ink role token exists at 0.9 and the non-selected rows read it', () => {
  const root = find(GLOBAL, ':root')
  const faint = root.map((r) => decl(r, '--ink-faint')).find(Boolean)
  assert.ok(faint, '--ink-faint is defined on :root')
  assert.match(faint, /color-mix\(\s*in oklab,\s*var\(--color-black\),\s*var\(--color-white\) calc\(var\(--ink-faint-l, 0\.9\) \* 100%\)\s*\)/)
  assert.match(stripComments(GLOBAL), /var\(--ink-muted-l, 0\.58\)/, '--ink-muted itself did not move')
  const station = findPS('.fp .fp-scale__station')[0]
  const color = decl(station, 'color')
  assert.match(color, /var\(--ink-faint\)/)
  // the falloff dials still ride on top of the base
  for (const d of ['--scale-ink-floor', '--wi']) assert.ok(color.includes(d), d)
})

test('the selected row reads --color-white for name and number (one colour on the station)', () => {
  const color = decl(findPS('.fp .fp-scale__station')[0], 'color')
  // pure white weighted by --w1 (1 only on the detented row), faint otherwise
  assert.match(color, /color-mix\(in srgb, var\(--color-white\) calc\(var\(--w1\) \* 100%\), var\(--ink-faint\)\)/)
  // the name inherits that colour — no row-level colour of its own to defeat it
  assert.equal(findPS('.fp .fp-scale__name').map((r) => decl(r, 'color')).filter(Boolean).length, 0)
  assert.equal(findPS('.fp .fp-scale__name[data-sel]').map((r) => decl(r, 'color')).filter(Boolean).length, 0)
})

test('.fp-scale__box paints no fill', () => {
  const boxes = rules(PS).filter((r) => /\.fp-scale__box\b/.test(r.selector))
  assert.ok(boxes.length > 0)
  for (const r of boxes) {
    assert.equal(decl(r, 'background'), null, r.selector)
    assert.equal(decl(r, 'background-color'), null, r.selector)
  }
})

test('the desktop fill ticker is gone, with no data-fill, ?fillpxs or ?unfill in src (--scale-fill-pxs stays at :root for the SQ-80 chips)', () => {
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
    for (const needle of ['data-fill', 'fillpxs', 'fp-scale-fill', "PARAM('unfill'", '--scale-box-gap', 'boxgap']) {
      assert.ok(!s.includes(needle), `${f} still mentions ${needle}`)
    }
  }
  // r12c (integrator): the token itself STAYS — SQ-80's CtaArrows reads it off <html> as the
  // PREVIOUS/NEXT name ticker's speed (falls back to 30). At :root, unscaled by the pager unit.
  const fillPxs = find(GLOBAL, ':root').map((r) => decl(r, '--scale-fill-pxs')).find(Boolean)
  assert.equal(fillPxs, '30')
  assert.ok(!PAGER.includes('--scale-fill-pxs'), 'the pager no longer reads it')
  assert.ok(!PS.includes('--scale-fill-pxs'), 'no pager rule re-declares or scales it')
  assert.match(GLOBAL, /PREVIOUS\/NEXT chips' client-name ticker speed/)
  const guide = read('docs/tunables-guide.md')
  assert.ok(!/`\?(fillpxs|unfill|boxgap)`/.test(guide), 'the tunables guide drops the removed dials')
  assert.match(guide, /`\?inkfaint`/, 'and documents the new faint-ink dial')
  // the ≤768 clip marquee stays
  assert.ok(findPS('.fp .fp-scale__name[data-marquee] .fp-scale__name-track').length > 0)
  assert.match(PAGER, /toggleAttribute\('data-marquee'/)
})

test('the scrim is plain black on EVERY tier (no tint, blur or grain; opaque) — the 09-04 bake is gone', () => {
  // r12b (11-13, Nathan: the black pager on desktop too): nothing is declared on
  // .fp for the scrim any more — the ::before's own fallbacks are the recipe.
  const fpRules = [...rules(FP), ...rules(PS)].filter((r) => r.selector.includes("[data-pager='scale']") && !r.selector.includes('::before'))
  for (const r of fpRules) {
    for (const prop of ['--scrim-tint', '--scrim-bf', '--scrim-noise', '--scrim-noise-size', '--scrim-grain-anim', '--pager-scrim']) {
      assert.equal(decl(r, prop), null, `${r.selector} (${r.media ?? 'all tiers'}) must not declare ${prop}`)
    }
  }
  assert.ok(!/data:image\/svg\+xml,[^"]*baseFrequency/.test(FP), 'the baked RGB-turbulence data-URI is deleted')
  assert.ok(!FP.includes('blur(7.5px)'), 'no baked 7.5px backdrop blur')

  // depth 1 on every tier: the global token (no ≤768 override left)
  const depth = find(GLOBAL, ':root').map((r) => decl(r, '--pager-scrim')).find(Boolean)
  assert.equal(depth, '1', 'opaque by default (the menu\'s own); ?scrimtune dials it')

  const before = find(FP, ".fp[data-pager='scale']::before")[0]
  assert.match(decl(before, 'background-color'), /var\(--scrim-tint, 0\)/, 'tint falls back to 0')
  assert.match(decl(before, 'background-color'), /var\(--color-black\)/)
  assert.equal(decl(before, 'background-image'), 'var(--scrim-noise, none)')
  assert.equal(decl(before, 'backdrop-filter'), 'var(--scrim-bf, none)')
  const hold = find(FP, ".fp[data-pager='scale'].is-pager-engaged::before, .fp[data-pager='scale'].is-scrimtune-hold::before")[0]
  assert.equal(decl(hold, 'animation'), 'var(--scrim-grain-anim, none)', 'no grain driver runs by default')
  assert.ok(FP.includes('@keyframes fp-scrim-grain'), 'the keyframes stay for the ?grainfps dial')

  // the phone-only grain recipe is deleted: no mobile grain constant
  const noise = read('src/components/work/scrimNoise.js')
  assert.ok(!noise.includes('SCRIM_GRAIN_MOBILE'))
  assert.ok(!PAGER.includes('SCRIM_GRAIN_MOBILE'))
})

test('the ?scrimtune bench opens on the black scrim at every width', () => {
  const bench = read('src/components/work/ScrimTunePanel.jsx')
  assert.ok(!/matchMedia/.test(bench), 'no width-dependent defaults')
  assert.match(bench, /const DEFAULTS = \{[\s\S]*?scrim: 1,[\s\S]*?tint: 0,[\s\S]*?blur: 0,[\s\S]*?type: 'none',[\s\S]*?amount: 0,/)
  assert.match(bench, /useState\(DEFAULTS\)/)
  assert.match(bench, /setS\(DEFAULTS\)/)
})

test('phone clip edge: the selected-name cap runs to the VIEWPORT edge — no right pad (desktop caps unchanged)', () => {
  const root = find(GLOBAL, ':root', '(max-width: 768px)')
  const cap = root.map((r) => decl(r, '--scale-name-sel-max')).find(Boolean)
  assert.ok(cap, 'the ≤768 sel cap is declared')
  // painted right edge = (seat + cap) × (sel × bump) = 100vw exactly: derived, never a px constant
  assert.equal(
    cap.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')'),
    'calc(100vw / (var(--scale-sel) * var(--scale-sel-bump)) - var(--scale-w) - var(--space-2))'
  )
  assert.ok(!/--space-4/.test(cap), 'the --space-4 right pad is gone')
  assert.ok(!/\d+px/.test(cap), 'no hard-coded px value')
  // the roster cap IS the sel cap (r11d), so every clipping row ends at the same place
  assert.equal(root.map((r) => decl(r, '--scale-name-max')).find(Boolean), 'var(--scale-name-sel-max)')
  // desktop: untouched
  const desk = find(GLOBAL, ':root')
  assert.equal(desk.map((r) => decl(r, '--scale-name-max')).find(Boolean), '2400px')
  assert.equal(desk.map((r) => decl(r, '--scale-name-sel-max')).find(Boolean), 'var(--scale-name-max)')
  // the box width write still follows the (computed) cap
  assert.match(PAGER, /const capOf = \(el\) => parseFloat\(getComputedStyle\(el\)\.maxWidth\)/)
  assert.match(PAGER, /Math\.min\(selW, selCap\)/)
})

test('seamless marquee: the loop travels exactly one copy + one gap (trailing pad = the gap)', () => {
  const track = findPS('.fp .fp-scale__name-track')[0]
  const gapVar = decl(track, '--marquee-gap')
  assert.equal(gapVar, 'var(--space-6)')
  assert.equal(decl(track, 'gap'), 'var(--marquee-gap)')
  const rolling = findPS('.fp .fp-scale__name[data-marquee] .fp-scale__name-track')[0]
  assert.equal(decl(rolling, 'padding-right'), 'var(--marquee-gap)', 'the track = 2(w + gap), so -50% = w + gap')
  // the loop still ends at -50%, linear, on --marquee-s; the wall-clock phase lock and the RM gate are unchanged
  assert.equal(decl(rolling, 'animation'), 'fp-scale-marquee var(--marquee-s, 6s) linear infinite')
  const kf = stripComments(PS).match(/@keyframes fp-scale-marquee\s*\{[\s\S]*?\n\}/)[0]
  assert.match(kf, /to\s*\{\s*transform:\s*translateX\(-50%\)/)
  assert.match(PAGER, /track\.style\.animationDelay = `\$\{-\(\(performance\.now\(\) \/ 1000\) % durS\)\.toFixed\(3\)\}s`/)
  assert.ok(findPS('.fp .fp-scale__name[data-marquee] .fp-scale__name-track', '(prefers-reduced-motion').length > 0)
  // geometry: translateX(-50%) of the track must equal one copy + one gap, for any copy width w
  const gap = 12
  for (const w of [119, 257, 324]) {
    const track = 2 * w + gap + gap // two copies, the gap between them, the trailing pad
    assert.equal(track / 2, w + gap)
  }
})

// ── r12c (Nathan 11-13): the desktop pager scales with the viewport, cohesive with the
// project directory's filter ─────────────────────────────────────────────────────────

const DESK = '(min-width: 769px)'
const motion = read('src/lib/motion.js')
const rootDecl = (prop) => find(GLOBAL, ':root').map((r) => decl(r, prop)).find(Boolean)

test('desktop scale: ONE unit anchored on the directory filter tag (2.4vw), floored at today\'s roster name', () => {
  // the anchor IS the directory filter tags' size token
  assert.equal(rootDecl('--text-drawer-name'), '2.4vw')
  assert.equal(rootDecl('--pager-vw'), '2.4', 'the roster name in vw defaults to the filter tag\'s 2.4vw')
  const desk = findPS('.fp .fp-scale', DESK)[0]
  assert.ok(desk, 'a desktop-only .fp-scale rule declares the scale')
  assert.equal(decl(desk, '--pager-u'), 'max(1px, calc(var(--pager-vw) * 1vw / 24.315))')
  // 24.315 = today's fixed roster name: --text-mono × --scale-roster × the 14px root (derived, so a drift fails here)
  const mono = parseFloat(rootDecl('--text-mono')) // rem
  const roster = parseFloat(rootDecl('--scale-roster'))
  assert.ok(Math.abs(mono * roster * 14 - 24.315) < 0.01, `${mono} × ${roster} × 14 ≠ 24.315`)
  // phones do not change: the base unit is 1px and nothing re-declares it on the phone tier
  const base = findPS('.fp .fp-scale')[0]
  assert.equal(decl(base, '--pager-u'), '1px')
  assert.equal(decl(base, '--pager-rem'), 'calc(14 * var(--pager-u))')
  for (const r of rules(PS).filter((r) => r.media?.includes('max-width: 768px'))) {
    assert.equal(decl(r, '--pager-u'), null, 'the ≤768 tier never touches the unit')
  }
})

// the chip family — root width, lens + den, pointer, hint, the rest hit pad — stays at its pre-r12c size
const CHIP_TOKENS = ['--scale-w', '--scale-num-h', '--text-link', '--lh-mono']
const WHEEL_RULE = '.fp .fp-scale__window, .fp .fp-scale__freeze'
const CHIP_RULES = [
  '.fp .fp-scale::after',
  '.fp .fp-scale__pointer',
  '.fp .fp-scale__lens, .fp .fp-scale__den',
  '.fp .fp-scale__hint',
  '.fp .fp-scale__chip',
  // 11-17: /featured-projects's pointer slide (the arrow's own rules, scoped off the corner's eye); raw rem like the triangle
  ':is(.fp, .swm-corner) .fp-scale:not(.swm-corner__pager) .fp-scale__pointer',
  ':is(.fp, .swm-corner) .fp-scale:not(.swm-corner__pager)[data-open] .fp-scale__pointer',
]

test('desktop scale: the WHEEL text is a multiple of the unit, in the units it had', () => {
  const desk = findPS('.fp .fp-scale', DESK)[0]
  // pitch: the CSS source of truth, = motion.js SCALE_PITCH_PX × u (the floor reproduces today's 48)
  const pitchPx = Number(motion.match(/SCALE_PITCH_PX = (\d+)/)[1])
  assert.equal(decl(desk, '--scale-pitch'), `calc(${pitchPx} * var(--pager-u))`)
  assert.equal(rootDecl('--scale-pitch'), `${pitchPx}px`, 'the :root fallback (and the ≤768 tier) holds the fixed pitch')
  // the rem tokens the wheel reads keep their own rem number, now × the pager's rem — declared on the
  // wheel window and the [select_project] pause label ONLY (descendants inherit), never on the root
  const wheel = findPS(WHEEL_RULE, DESK)[0]
  assert.ok(wheel, 'a desktop-only rule scales the wheel window and the pause label')
  for (const t of ['--scale-w', '--text-mono', '--text-secondary', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6']) {
    const n = parseFloat(rootDecl(t))
    assert.ok(rootDecl(t).endsWith('rem'), `${t} is a rem token at :root`)
    assert.equal(decl(wheel, t), `calc(${n} * var(--pager-rem))`, t)
    assert.equal(decl(desk, t), null, `${t} is not scaled on the pager root (it would scale the chip)`)
  }
  assert.equal(decl(wheel, '--scale-pad'), 'var(--space-4)', 'the station pad follows the scaled --space-4')
  // the 2400px name cap scales too; the sel cap follows it
  assert.equal(decl(desk, '--scale-name-max'), 'calc(2400 * var(--pager-u))')
  assert.equal(decl(desk, '--scale-name-sel-max'), 'var(--scale-name-max)')
  // the box height resolves against the pager's OWN pitch (it was a :root token, which would freeze at 48)
  assert.equal(
    decl(findPS('.fp .fp-scale')[0], '--scale-box-h'),
    'calc(var(--scale-pitch) / (var(--scale-sel) * var(--scale-sel-bump)))'
  )
  // and no raw rem / sizeable px literal is left in any pager rule outside the ≤768 tier
  // (hairlines 1px / 0.5px, the 2px outline and the -2px clip overdraw stay physical)
  // — except the chip family, which keeps its raw pre-r12c rem on purpose (next test), and the open
  // hit pad, whose right edge is asserted there too
  const physical = new Set(['0px', '0.5px', '1px', '2px', '-2px'])
  const unscaled = new Set([...CHIP_RULES.map(sc), sc('.fp .fp-scale[data-open]::after')])
  for (const r of rules(PS).filter(
    (r) => /\.fp-scale\b/.test(r.selector) && !r.media?.includes('max-width: 768px') && !unscaled.has(r.selector)
  )) {
    for (const m of r.body.matchAll(/(?<![\w.-])(-?\d*\.?\d+)(rem|px)\b/g)) {
      if (r.media?.includes(DESK) && /^--/.test(r.body.slice(Math.max(0, m.index - 40), m.index).split(';').pop().trim())) continue
      assert.ok(m[2] === 'px' && physical.has(m[1] + 'px'), `${r.selector}: ${m[0]} should scale with --pager-u / --pager-rem`)
    }
  }
})

test('desktop scale: the CHIP keeps its pre-r12c size — the root width, lens + den, pointer, hint and rest hit pad read no pager unit', () => {
  // no desktop-media rule re-declares a chip token anywhere but the wheel rule (and it carries only --scale-w there,
  // the stations' number column, never the root's)
  const wheel = findPS(WHEEL_RULE, DESK)[0]
  for (const r of rules(PS).filter((r) => r.media?.includes(DESK))) {
    for (const t of [...CHIP_TOKENS, '--text-link']) {
      if (decl(r, t) !== null) assert.equal(r.selector, sc(WHEEL_RULE), `${t} is declared on ${r.selector}`)
    }
  }
  assert.equal(decl(wheel, '--text-link'), null)
  assert.equal(decl(wheel, '--scale-num-h'), null)
  assert.equal(decl(wheel, '--lh-mono'), null)
  // the root's own width is the UNSCALED --scale-w (the root rule never gets the wheel's re-declaration)
  assert.equal(decl(findPS('.fp .fp-scale')[0], 'width'), 'var(--scale-w)')
  assert.equal(decl(findPS('.fp .fp-scale', DESK)[0], '--scale-w'), null)
  // every chip rule is pre-r12c: no --pager-u / --pager-rem in it
  for (const sel of CHIP_RULES) {
    const rs = findPS(sel)
    assert.ok(rs.length > 0, `${sel} exists`)
    for (const r of rs) assert.ok(!/--pager-/.test(r.body), `${sel} reads a pager unit`)
  }
  // the rest hit pad and the pointer triangle are back on plain rem
  assert.equal(decl(findPS('.fp .fp-scale::after')[0], 'inset'), '-0.75rem -1rem -0.75rem 0')
  const ptr = findPS('.fp .fp-scale__pointer')[0]
  assert.equal(decl(ptr, 'border-left'), '0.571rem solid currentColor')
  assert.equal(decl(ptr, 'margin-top'), '-0.429rem')
  // the engaged hit pad still reaches 4rem past the number column; the column (3 pager-rem) is wider than the
  // chip root (3rem), so it spans the difference: 4rem at u = 1px, 7 pager-rem − 3rem in general
  const open = findPS('.fp .fp-scale[data-open]::after')[0]
  assert.equal(decl(open, 'right'), 'calc(3rem - 7 * var(--pager-rem))')
})

test('11-17 /featured-projects\'s pointer slides in from the viewport\'s left edge instead of fading, on the eye\'s curve, and snaps under reduced motion', () => {
  // Nathan 11-17: "yes lets update the pager with the updated arrow choreography" (the scheme eye's SQ-107 pass 11)
  const W = ':is(.fp, .swm-corner) .fp-scale:not(.swm-corner__pager)'
  const rest = findPS(`${W} .fp-scale__pointer`)[0]
  const open = findPS(`${W}[data-open] .fp-scale__pointer`)[0]
  assert.ok(rest && open, 'both rules exist, scoped off the corner\'s eye')
  // at rest: beyond the edge by its seat (--space-1) + its own width (0.571rem) + 1px, fully opaque
  assert.equal(decl(rest, '--pointer-off'), 'calc(-1 * (var(--space-1) + 0.571rem + 1px))')
  assert.equal(decl(rest, 'translate'), 'var(--pointer-off) 0')
  assert.equal(decl(rest, 'opacity'), '1')
  assert.equal(decl(rest, 'transition'), 'translate 0.2s var(--ease-draw)')
  // deployed: at its seat, after the fade's old 80 ms, on --ease-draw (no overshoot)
  assert.equal(decl(open, 'translate'), '0 0')
  assert.equal(decl(open, 'opacity'), '1')
  assert.equal(decl(open, 'transition'), 'translate 0.2s var(--ease-draw) 80ms')
  // the spring on `transform` is untouched: the slide is the separate `translate` property
  const base = findPS('.fp .fp-scale__pointer')[0]
  assert.equal(decl(base, 'transform'), 'translateY(var(--box-dy, 0px))')
  // reduced motion names both selectors (equal specificity, later in the sheet), so it snaps
  const rm = rules(PS).filter((r) => r.media?.includes('prefers-reduced-motion') && /transition: none/.test(r.body))
  const rmSel = rm.map((r) => r.selector).join(', ')
  for (const sel of [`${W} .fp-scale__pointer`, `${W}[data-open] .fp-scale__pointer`]) assert.ok(rmSel.includes(sel), `reduced motion snaps ${sel}`)
  // the corner's eye sets no translate of its own, so the scope is what keeps the slide off it
  assert.ok(!/translate:/.test(read('src/styles/site-scheme.css').match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__pointer \{([^}]*)\}/)?.[1] ?? 'x'), 'the eye\'s arrow rule has no translate')
})

test('desktop scale: the pitch is READ from the CSS, and the wheel/box pad follow it', () => {
  // registered <length> so the computed value is resolved px
  const prop = stripComments(GLOBAL).match(/@property --scale-pitch\s*\{([\s\S]*?)\}/)
  assert.ok(prop, '@property --scale-pitch is registered')
  assert.match(prop[1], /syntax:\s*'<length>'/)
  assert.match(prop[1], /initial-value:\s*48px/)
  // the skin reads it back at mount, tier change and resize
  assert.match(PAGER, /getComputedStyle\(rootRef\.current\)\.getPropertyValue\('--scale-pitch'\)/)
  assert.match(PAGER, /window\.addEventListener\('resize', measure\)/)
  assert.match(PAGER, /detentDial \?\? \(mobileTier\(\) \? SCALE_PITCH_MOBILE_PX : deskPitch\)/)
  // desktop never writes the inline pitch (that would pin it); ≤768 and ?detent still do
  assert.match(PAGER, /mobileTier\(\) \|\| detentDial !== null \? \{ '--scale-pitch': `\$\{detentPx\}px` \} : \{\}/)
  // the wheel detent + the box pad ride the same factor; ?wheeldetent stays absolute
  assert.match(PAGER, /const pitchK = mobileTier\(\) \|\| detentDial !== null \? 1 : deskPitch \/ SCALE_PITCH_PX/)
  assert.match(PAGER, /PARAM\('wheeldetent', SCALE_WHEEL_DETENT_PX \* pitchK\)/)
  assert.match(PAGER, /Math\.round\(6 \* pitchK\)/)
  // choreography stays locked: usePagerGesture is untouched and no timing / spring constant moved
  const gesture = read('src/components/work/pager/usePagerGesture.js')
  assert.ok(!/pitchK|--pager-/.test(gesture))
  for (const c of ['SCALE_END_RESIST', 'SCALE_MAGNET_EXP', 'SCALE_FLIP_TAU_S']) assert.ok(PAGER.includes(c))
})

test('?pagervw: the dial writes --pager-vw on the pager root (0 = the fixed pre-r12c size), and is documented', () => {
  assert.match(PAGER, /const pagerVw = PARAM\('pagervw', -1\)/)
  assert.match(PAGER, /pagerVw >= 0 \? \{ '--pager-vw': pagerVw \} : \{\}/)
  // 0 → u = max(1px, 0) = 1px: every length is today's
  assert.match(read('docs/tunables-guide.md'), /`\?pagervw`/)
})

// ── SQ-87: the pager mounts outside .fp (the site-wide scheme widget, in a .swm-corner wrapper) ──

test('the skin moved: no pager-element rule is left in featured-projects.css, every moved rule is scoped to .fp or .swm-corner', () => {
  // what stays in the page sheet has .fp itself (the scrim, the stage dim) as its subject
  const left = rules(FP).filter((r) => /\.fp-scale/.test(r.selector))
  assert.deepEqual(left.map((r) => r.selector), ['.fp.is-fp-frozen :not(.fp-scale, .fp-scale *)'])
  const moved = rules(PS)
  assert.ok(moved.length > 60, 'the skin sheet carries the pager rules')
  for (const r of moved) {
    for (const part of r.selector.split(/,(?![^(]*\))/).map((s) => s.trim())) {
      assert.ok(part.startsWith(`${SCOPE}`) || part.startsWith(":is(.fp[data-pager='scale'], .swm-corner)"), `${part} is not scoped`)
      assert.ok(!/^\.fp[ [.]/.test(part), `${part} keeps a bare .fp ancestor`)
    }
  }
  // state rules keyed off a host class carry the corner's twin (and keep /featured-projects's own)
  const sels = moved.map((r) => r.selector).join('\n')
  assert.match(sels, /:is\(\.fp\[data-pager='scale'\], \.swm-corner\)\.is-pager-engaged \.fp-scale/)
  assert.match(sels, /:is\(\.fp, \.swm-corner\)\[data-turning\] \.fp-scale__den/)
  // the sheet loads once, from the layout, right after global.css; /featured-projects still loads its own
  const layout = read('src/layouts/BaseLayout.astro')
  assert.match(layout, /import '\.\.\/styles\/global\.css';\n(?:\/\/.*\n)*import '\.\.\/styles\/pager-scale\.css';/)
  assert.ok(!/pager-scale\.css/.test(read('src/pages/featured-projects/index.astro')), 'one import site')
})

test('GraticulePager is mountable anywhere: additive props whose defaults are the old URL-param reads and strings', () => {
  assert.match(PAGER, /pauseOn: pauseOnProp,\s*hintOn: hintOnProp,\s*wrap: wrapProp,\s*labels: labelsProp,\s*onPreview,\s*className,\s*renderStation,\s*renderLens,/)
  assert.match(PAGER, /const wrap = count > 1 && \(wrapProp \?\? PARAM\('wrap', 1\) > 0\)/)
  assert.match(PAGER, /const hintOn = hintOnProp \?\? PARAM\('selectlabel', 1\) > 0/)
  assert.match(PAGER, /const pauseOn = pauseOnProp \?\? PARAM\('pause', 1\) > 0/)
  // the default strings are /featured-projects's own
  assert.match(PAGER, /nav: 'Featured project pager'/)
  assert.match(PAGER, /hint: 'select_project'/)
  assert.match(PAGER, /station: \(i, n, name\) => `Go to \$\{name\} \(project \$\{i \+ 1\} of \$\{n\}\)`/)
  assert.match(PAGER, /live: \(i, n, name\) => `Project \$\{i \+ 1\} of \$\{n\} — \$\{name\}`/)
  // and they are what renders
  assert.match(PAGER, /aria-label=\{labels\.nav\}/)
  assert.match(PAGER, /\{labels\.hint\}/)
  assert.match(PAGER, /labels\.station\(i, count, nameOf\(w\)\)/)
  assert.match(PAGER, /labels\.live\(i, count, nameOf\(w\)\)/)
  // onPreview rides the setStation path (every detent); commit still goes only through land()
  assert.match(PAGER, /prevDetentRef\.current = un;\s*onPreview\?\.\(i\);/)
  assert.match(PAGER, /\$\{className \? ` \$\{className\}` : ''\}/)
  // the pause lane never runs with pauseOn false: no freeze chip, no globalTimeline.pause, no event
  assert.match(PAGER, /if \(!pauseOn\) return undefined;/)
  assert.match(PAGER, /\{pauseOn && \(\s*<span className="fp-scale__freeze"/)
  assert.match(PAGER, /if \(pauseOn\) setFrozen\(false\)/)
  // no .fp ancestor: both host lookups are optional-chained / guarded
  assert.match(PAGER, /const fp = rootRef\.current\?\.closest\('\.fp'\);\s*if \(!fp\) return undefined;/)
  assert.match(PAGER, /const fpEl = rootRef\.current\?\.closest\('\.fp'\);/)
  assert.match(PAGER, /fpEl\?\.classList\.add\('is-fp-frozen'\)/)
  assert.match(PAGER, /fpEl\?\.classList\.remove\('is-fp-frozen'\)/)
})

test('renderStation / renderLens: host art in the rows and the chip, the engine and the marquee untouched', () => {
  // a row's content is the host's art, in real rows and clones alike (one map over every slot); the button keeps its aria
  assert.match(PAGER, /\{renderStation \? \(\s*(?:\/\/.*\s*)*renderStation\(w, i\)\s*\) : \(/)
  assert.match(PAGER, /aria-hidden=\{clone \|\| undefined\}/)
  assert.match(PAGER, /aria-current=\{!clone && i === active \? 'true' : undefined\}/)
  // the default row is the old number + two-copy name track, byte for byte
  assert.match(PAGER, /\{pad2\(i\)\}\s*\{\/\*[\s\S]*?\*\/\}\s*<span className="fp-scale__name" aria-hidden="true">\s*<span className="fp-scale__name-track">/)
  // the marquee pass tolerates a row with no .fp-scale__name (it only ever runs on what it finds)
  assert.match(PAGER, /children\[un \+ cloneOff\]\?\.querySelector\('\.fp-scale__name'\)/)
  assert.match(PAGER, /if \(el && el !== nameEl\) \{/)
  assert.match(PAGER, /if \(!nameEl\) return;/)
  // the lens art: its own wrapper inside the chip, from `active`; the digit spans stay in the markup
  assert.match(PAGER, /\{renderLens && worlds\[active\] && \(\s*(?:\/\/.*\s*)*<span className="fp-scale__lens-art">\{renderLens\(worlds\[active\], active\)\}<\/span>/)
  for (const cls of ['fp-scale__num', 'fp-scale__peak', 'fp-scale__den']) assert.ok(PAGER.includes(`className="${cls}"`), cls)
  // choreography stays locked: the gesture hook and the constants are not part of this change
  const gesture = read('src/components/work/pager/usePagerGesture.js')
  assert.ok(!/onPreview|renderStation|renderLens|swm-corner/.test(gesture))
})
