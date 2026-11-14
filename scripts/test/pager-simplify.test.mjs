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
  assert.ok(!FP.includes('--scale-fill-pxs'), 'no pager rule re-declares or scales it')
  assert.match(GLOBAL, /PREVIOUS\/NEXT chips' client-name ticker speed/)
  const guide = read('docs/tunables-guide.md')
  assert.ok(!/`\?(fillpxs|unfill|boxgap)`/.test(guide), 'the tunables guide drops the removed dials')
  assert.match(guide, /`\?inkfaint`/, 'and documents the new faint-ink dial')
  // the ≤768 clip marquee stays
  assert.ok(find(FP, '.fp .fp-scale__name[data-marquee] .fp-scale__name-track').length > 0)
  assert.match(PAGER, /toggleAttribute\('data-marquee'/)
})

test('the scrim is plain black on EVERY tier (no tint, blur or grain; opaque) — the 09-04 bake is gone', () => {
  // r12b (11-13, Nathan: the black pager on desktop too): nothing is declared on
  // .fp for the scrim any more — the ::before's own fallbacks are the recipe.
  const fpRules = rules(FP).filter((r) => r.selector.startsWith(".fp[data-pager='scale']") && !r.selector.includes('::before'))
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
  const track = find(FP, '.fp .fp-scale__name-track')[0]
  const gapVar = decl(track, '--marquee-gap')
  assert.equal(gapVar, 'var(--space-6)')
  assert.equal(decl(track, 'gap'), 'var(--marquee-gap)')
  const rolling = find(FP, '.fp .fp-scale__name[data-marquee] .fp-scale__name-track')[0]
  assert.equal(decl(rolling, 'padding-right'), 'var(--marquee-gap)', 'the track = 2(w + gap), so -50% = w + gap')
  // the loop still ends at -50%, linear, on --marquee-s; the wall-clock phase lock and the RM gate are unchanged
  assert.equal(decl(rolling, 'animation'), 'fp-scale-marquee var(--marquee-s, 6s) linear infinite')
  const kf = stripComments(FP).match(/@keyframes fp-scale-marquee\s*\{[\s\S]*?\n\}/)[0]
  assert.match(kf, /to\s*\{\s*transform:\s*translateX\(-50%\)/)
  assert.match(PAGER, /track\.style\.animationDelay = `\$\{-\(\(performance\.now\(\) \/ 1000\) % durS\)\.toFixed\(3\)\}s`/)
  assert.ok(find(FP, '.fp .fp-scale__name[data-marquee] .fp-scale__name-track', '(prefers-reduced-motion').length > 0)
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
  const desk = find(FP, '.fp .fp-scale', DESK)[0]
  assert.ok(desk, 'a desktop-only .fp-scale rule declares the scale')
  assert.equal(decl(desk, '--pager-u'), 'max(1px, calc(var(--pager-vw) * 1vw / 24.315))')
  // 24.315 = today's fixed roster name: --text-mono × --scale-roster × the 14px root (derived, so a drift fails here)
  const mono = parseFloat(rootDecl('--text-mono')) // rem
  const roster = parseFloat(rootDecl('--scale-roster'))
  assert.ok(Math.abs(mono * roster * 14 - 24.315) < 0.01, `${mono} × ${roster} × 14 ≠ 24.315`)
  // phones do not change: the base unit is 1px and nothing re-declares it on the phone tier
  const base = find(FP, '.fp .fp-scale')[0]
  assert.equal(decl(base, '--pager-u'), '1px')
  assert.equal(decl(base, '--pager-rem'), 'calc(14 * var(--pager-u))')
  for (const r of rules(FP).filter((r) => r.media?.includes('max-width: 768px'))) {
    assert.equal(decl(r, '--pager-u'), null, 'the ≤768 tier never touches the unit')
  }
})

test('desktop scale: every px / rem / text / space the pager paints is a multiple of the unit, in the units it had', () => {
  const desk = find(FP, '.fp .fp-scale', DESK)[0]
  // pitch: the CSS source of truth, = motion.js SCALE_PITCH_PX × u (the floor reproduces today's 48)
  const pitchPx = Number(motion.match(/SCALE_PITCH_PX = (\d+)/)[1])
  assert.equal(decl(desk, '--scale-pitch'), `calc(${pitchPx} * var(--pager-u))`)
  assert.equal(rootDecl('--scale-pitch'), `${pitchPx}px`, 'the :root fallback (and the ≤768 tier) holds the fixed pitch')
  // each rem token keeps its own rem number, now × the pager's rem
  for (const t of ['--text-mono', '--text-link', '--text-secondary', '--lh-mono', '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--scale-w', '--scale-num-h']) {
    const n = parseFloat(rootDecl(t))
    assert.ok(rootDecl(t).endsWith('rem'), `${t} is a rem token at :root`)
    assert.equal(decl(desk, t), `calc(${n} * var(--pager-rem))`, t)
  }
  // the 2400px name cap scales too; the sel cap follows it
  assert.equal(decl(desk, '--scale-name-max'), 'calc(2400 * var(--pager-u))')
  assert.equal(decl(desk, '--scale-name-sel-max'), 'var(--scale-name-max)')
  // the box height resolves against the pager's OWN pitch (it was a :root token, which would freeze at 48)
  assert.equal(
    decl(find(FP, '.fp .fp-scale')[0], '--scale-box-h'),
    'calc(var(--scale-pitch) / (var(--scale-sel) * var(--scale-sel-bump)))'
  )
  // and no raw rem / sizeable px literal is left in any pager rule outside the ≤768 tier
  // (hairlines 1px / 0.5px, the 2px outline and the -2px clip overdraw stay physical)
  const physical = new Set(['0px', '0.5px', '1px', '2px', '-2px'])
  for (const r of rules(FP).filter((r) => /\.fp-scale\b/.test(r.selector) && !r.media?.includes('max-width: 768px'))) {
    for (const m of r.body.matchAll(/(?<![\w.-])(-?\d*\.?\d+)(rem|px)\b/g)) {
      if (r.media?.includes(DESK) && /^--/.test(r.body.slice(Math.max(0, m.index - 40), m.index).split(';').pop().trim())) continue
      assert.ok(m[2] === 'px' && physical.has(m[1] + 'px'), `${r.selector}: ${m[0]} should scale with --pager-u / --pager-rem`)
    }
  }
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
