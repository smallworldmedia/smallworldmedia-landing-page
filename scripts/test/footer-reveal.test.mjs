// The home footer's reveal channel (SQ-11, 10-07; desktop rests too since
// 10-09) — the parts that are checkable without a browser. The GEOMETRY is
// measured by `node scripts/globe-probe.mjs --footer`, which drives a real
// touch scrub (phone-only);
// this file holds the three things that probe cannot see:
//
//   1. the normalization math, including the ?footerrest=1 edge the channel
//      exists to avoid (a `:root` calc would divide by zero there);
//   2. the DE-FORK — every shipped default lives twice, once as a CSS fallback
//      (what the phone gets) and once in FOOTER_TUNE_DEFAULTS (what the bench
//      and the copied URL get). Drift means the two disagree silently;
//   3. the CSS source contract for the corrections that are invisible once
//      rendered: the parallax gated on [data-footer-rest], driven off the
//      normalized rise rather than raw progress, written to the individual
//      `translate` property, and the marks windowed over the PEAK rise.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  footerRise,
  footerSpan,
  navSlide,
  footerDamp,
  footerBrakeStep,
  footerTensionStep,
  FOOTER_BRAKE_TAIL,
  FOOTER_TUNE_DEFAULTS,
} from '../../src/lib/footerTune.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const css = fs.readFileSync(`${root}src/styles/global.css`, 'utf8')

/* — the normalization — */

test('footerRise is 0 in the resting pose and 1 at a full reveal', () => {
  // The whole channel: --footer-reveal is raw progress and parks at the floor,
  // so everything that must be INERT at rest reads this instead.
  assert.equal(footerRise(0.62, 0.62), 0)
  assert.equal(footerRise(1, 0.62), 1)
  assert.equal(Math.round(footerRise(0.81, 0.62) * 1e4) / 1e4, 0.5)
  // rest 0 — the document-scroll routes, where progress already starts at 0
  assert.equal(footerRise(0, 0), 0)
  assert.equal(footerRise(0.37, 0), 0.37)
})

test('footerRise clamps below the floor and past a full reveal', () => {
  // A release carry or a rubber-banded gesture can hand it either.
  assert.equal(footerRise(0.4, 0.62), 0)
  assert.equal(footerRise(-1, 0.62), 0)
  assert.equal(footerRise(1.4, 0.62), 1)
})

test('footerRise survives rest = 1 instead of dividing by zero', () => {
  // ?footerrest=1 is a legal dial (a footer that rests fully open). As a
  // `:root` calc, (p - 1) / (1 - 1) is why this math is in JS at all.
  assert.equal(footerRise(1, 1), 1)
  assert.equal(footerRise(0.5, 1), 1)
  assert.ok(Number.isFinite(footerRise(0.5, 1)))
  assert.equal(footerSpan(1), 0)
})

test('navSlide keeps the nav bar at the top of a page shorter than the fold', () => {
  // 11-14: a directory client with one tile. The page fits the viewport, the
  // footer is fully in view before any scroll (floor 1), and the bar had slid
  // a whole nav height off the top.
  assert.equal(navSlide(1, 1), 0)
  // Two tiles: the page scrolls a little, the reveal starts at 0.2963. The bar
  // starts in place and is gone by the page's end.
  assert.equal(navSlide(0.2963, 0.2963), 0)
  assert.equal(navSlide(1, 0.2963), 1)
  assert.ok(navSlide(0.6, 0.2963) > 0 && navSlide(0.6, 0.2963) < 0.6)
  // Any page taller than the fold: the reveal itself, as before.
  for (const p of [0, 0.37, 1]) assert.equal(navSlide(p, 0), footerRise(p, 0))
})

test('the nav slide and the directory filter read the nav progress, falling back to the reveal', () => {
  // Negative control: on the raw reveal, a one-tile page loses its bar.
  const shell = css.match(/html\[data-footer-revealed\]:not\(\[data-chrome-open\]\) \.site-shell \{[^}]*\}/)
  assert.ok(shell, 'the nav slide rule exists')
  assert.match(shell[0], /var\(--footer-nav-p, var\(--footer-reveal, 1\)\)/)
  const dir = fs.readFileSync(`${root}src/styles/directory.css`, 'utf8')
  const filter = dir.match(/html\[data-footer-revealed\][^{]*\.dir-filter \{[^}]*\}/)
  assert.ok(filter, 'the filter follow rule exists')
  assert.match(filter[0], /var\(--footer-nav-p, var\(--footer-reveal, 1\)\)/)
})

test('footerSpan is the travel the rise is normalized over', () => {
  assert.equal(footerSpan(0), 1)
  assert.equal(Math.round(footerSpan(0.62) * 1e4) / 1e4, 0.38)
  assert.equal(footerSpan(1.3), 0)
})

/* — the de-fork: one number, two homes — */

// The shipped default IS the CSS fallback (house doctrine: a value at its
// default REMOVES the inline property rather than pinning it, so the cascade
// stays inert for everyone off the bench). FOOTER_TUNE_DEFAULTS has to agree
// with it or the phone and the tune panel render different pages.
const fallback = (prop) => {
  const m = css.match(new RegExp(`var\\(${prop},\\s*([0-9.]+)`))
  assert.ok(m, `global.css has no fallback for ${prop}`)
  return Number(m[1])
}

test('the hero-lift and marks defaults match their CSS fallbacks', () => {
  assert.equal(FOOTER_TUNE_DEFAULTS.liftK, fallback('--footer-lift-k'))
  assert.equal(FOOTER_TUNE_DEFAULTS.marksFrom, fallback('--footer-marks-from'))
  assert.equal(FOOTER_TUNE_DEFAULTS.marksTo, fallback('--footer-marks-to'))
  assert.equal(FOOTER_TUNE_DEFAULTS.marksLift, fallback('--footer-marks-lift'))
  assert.equal(FOOTER_TUNE_DEFAULTS.lockupRem, fallback('--footer-lockup-h'))
})

/* The 10-08 desktop resting-footer knobs joined CSS_KNOBS, so they are under the
   same contract and need the same guard — without this the de-fork check covered
   5 of 8 and would not have noticed the three new ones drifting. */
test('the desktop resting-footer defaults match their CSS fallbacks', () => {
  assert.equal(FOOTER_TUNE_DEFAULTS.topPad, fallback('--footer-rest-top-pad'))
  assert.equal(FOOTER_TUNE_DEFAULTS.blurbFill, fallback('--footer-blurb-fill'))
})

/* --ticker-foot-clearance is the one knob whose fallback is NOT a literal: it is
   derived from the four tokens the reserve it replaced was built from, precisely
   so the two cannot drift (see global.css). So assert the CHAIN, not a number —
   this is what catches a token moving underneath the baked default.
   Resolved at the base tier on purpose: the knob only applies above 769px, so
   --lh-link's phone step-down never reaches it. --pill-pad-y is an alias. */
test('the ticker foot clearance default equals its derived CSS chain', () => {
  const token = (name) => {
    const m = css.match(new RegExp(`--${name}:\\s*([0-9.]+)rem`))
    assert.ok(m, `global.css has no rem value for --${name}`)
    return Number(m[1])
  }
  assert.match(
    css,
    /var\(\s*--ticker-foot-clearance,\s*calc\(/,
    'the clearance must keep a derived calc() fallback, not a literal',
  )
  const derived =
    token('footer-bottom-inset') + token('lh-link') + 2 * token('space-4') + token('space-6')
  assert.equal(
    Number(derived.toFixed(3)),
    FOOTER_TUNE_DEFAULTS.tickerFoot,
    `derived ${derived.toFixed(3)}rem vs baked ${FOOTER_TUNE_DEFAULTS.tickerFoot}rem`,
  )
})

/* ?footerrest is the one shipped default with NO CSS fallback twin — it is read
   in JS at module load and latches [data-footer-rest], so the cascade never
   sees it. It forked anyway: `globe-probe --footer` has to KNOW the floor to
   gate that the panel parks on it, so the number lives in Hero.jsx and again
   as the probe's FOOTER_REST_EXPECT default. Nothing held them equal, and a
   re-bake that moved only Hero's copy would not fail a test — it would fail
   the PROBE, later, reading as a regression in the footer rather than as a
   stale gate. Both are parsed from source: Hero.jsx is an island (importing it
   drags in the whole hero) and the probe runs a browser on import. */
test('the footer rest bake and the probe gate that checks it are one number', () => {
  const read = (file, re, what) => {
    const m = fs.readFileSync(`${root}${file}`, 'utf8').match(re)
    assert.ok(m, `${file} no longer declares ${what} the way this test reads it`)
    return Number(m[1])
  }
  const baked = read(
    'src/components/Hero.jsx',
    /const FOOTER_REST_MOBILE = ([0-9.]+)/,
    'FOOTER_REST_MOBILE',
  )
  const gate = read(
    'scripts/globe-probe.mjs',
    /const FOOTER_REST_EXPECT = Number\(arg\('footerrest', ([0-9.]+)\)\)/,
    'FOOTER_REST_EXPECT',
  )
  assert.equal(
    gate,
    baked,
    `globe-probe gates ?footerrest=${gate} but Hero bakes ${baked} — move both`,
  )
  // It must also stay clear of the blurb's clipping floor: the blurb box ends
  // at 0.415 of the 281.2px panel at 390x844 (swept 10-08), below which the
  // resting pose cuts the studio blurb off mid-line.
  assert.ok(baked > 0.42, `a rest of ${baked} clips the blurb (floor is ~0.415)`)
  assert.ok(baked <= 1, `?footerrest is a 0..1 fraction, got ${baked}`)
})

/* The DESKTOP rest (10-09, Nathan: "push the globe page footer work (visible
   when i define ?footerrest) to be live"; re-baked to a 0.40 sliver on 10-31)
   is its own bake, FOOTER_REST_DESKTOP, not the phone's number. It has NO gate
   twin to pair with: the probe's --footer scenario is phone-only (`MOBILE =
   FOOTER || …` in globe-probe.mjs), so the pair test above has nothing to hold
   it against. What it CAN be held to is its own clipping floor, (blurb bottom −
   panel top) / panel height, read at DSF 2 with ?footerslide=0, settled. 10-09,
   off the preview build: 0.1831 at 1440×900 (257.9px panel) and 0.1966 at
   1728×992 (270.3px), where the blurb is one line (the ?footerblurbfill fill).
   10-31, off the dev server, which re-read both within 0.0002: the NARROW
   desktop band, below the fill's ~1130px crossover, wraps the blurb to two
   lines at the 1.4rem floor, which raises the floor to 0.2371 (266px panel;
   1024×768, 820×1180 and 800×600 read alike). That band's floor is the
   largest, so it is the one held. */
test('the desktop footer rest is its own bake', () => {
  const hero = fs.readFileSync(`${root}src/components/Hero.jsx`, 'utf8')
  const m = hero.match(/const FOOTER_REST_DESKTOP = ([0-9.]+)/)
  assert.ok(m, 'Hero.jsx no longer declares FOOTER_REST_DESKTOP the way this test reads it')
  const baked = Number(m[1])
  assert.ok(baked <= 1, `?footerrest is a 0..1 fraction, got ${baked}`)
  assert.ok(baked > 0.2371, `a desktop rest of ${baked} clips the two-line blurb (floor is 0.2371 @1024x768)`)
  const ROUTE = /IS_MOBILE \? FOOTER_REST_MOBILE : FOOTER_REST_DESKTOP/
  assert.match(hero, ROUTE) // the routing: phones rest at the phone bake, desktop at its own
  const swapped = hero.replace(ROUTE, 'IS_MOBILE ? FOOTER_REST_DESKTOP : FOOTER_REST_MOBILE')
  assert.notEqual(swapped, hero) // the control ran: the anchor occurs, and the swap changed the text
  assert.doesNotMatch(swapped, ROUTE) // a swapped ternary fails the match
})

test('the marks window opens before it closes and inside the rise', () => {
  const { marksFrom, marksTo } = FOOTER_TUNE_DEFAULTS
  assert.ok(marksFrom >= 0 && marksFrom < marksTo, `${marksFrom} < ${marksTo}`)
  assert.ok(marksTo <= 1, 'a window that closes past rise 1 never completes')
})

/* — the CSS source contract — */

/** The rule (selector + body) containing `needle`. */
const ruleFor = (needle) => {
  const i = css.indexOf(needle)
  assert.ok(i > 0, `global.css is missing: ${needle}`)
  const open = css.lastIndexOf('{', i)
  const close = css.indexOf('}', i)
  const prev = Math.max(
    css.lastIndexOf('}', open),
    css.lastIndexOf('*/', open),
    css.lastIndexOf('{', open - 1)
  )
  return { selector: css.slice(prev + 1, open).trim(), body: css.slice(open + 1, close) }
}

test('--hero-lift is declared only under [data-footer-rest]', () => {
  // Correction 2. `translate: 0 0px` is NOT `none`: an ungated rule would put
  // every hero element on the compositor on the document-scroll routes too,
  // where the footer has no resting pose to lift off.
  const lines = [...css.matchAll(/^\s*--hero-lift:/gm)]
  assert.ok(lines.length >= 1, 'no --hero-lift declaration at all')
  for (const m of lines) {
    const { selector } = ruleFor(css.slice(m.index, m.index + 12))
    assert.match(selector, /\[data-footer-rest\]/, `ungated --hero-lift under: ${selector}`)
  }
})

test('the hero lift drives off the normalized rise, never raw progress', () => {
  // Correction 1's other half. --footer-reveal parks at the rest (0.40 on
  // desktop, 0.59 on phones), so a lift windowed over it starts partway up on
  // the very first paint.
  const { body } = ruleFor('--hero-lift: calc(')
  assert.match(body, /var\(--footer-rise,/)
  assert.doesNotMatch(body, /--footer-reveal/)
  // and it is normalized by the travel, not by raw panel height
  assert.match(body, /var\(--footer-span,/)
  assert.match(body, /var\(--footer-panel-h,/)
})

test('the lift is written to `translate`, not `transform`', () => {
  // Correction 3. The hero elements already carry `transform` from the globe
  // dolly and the lockup scale; `translate` pre-multiplies it instead of
  // fighting it, and is the only one of the two that is safe to clobber.
  // 11-12 (SQ-70): the open info drawer's --info-push rides the same property,
  // so the lift may carry that one extra term (scripts/test/info-push.test.mjs).
  assert.match(css, /translate: 0 calc\(var\(--hero-lift, 0px\) \* -1( \+ var\(--info-push, 0px\))?\)/)
  assert.doesNotMatch(css, /transform:[^;]*--hero-lift/)
})

test('the lift selector group holds the whole hero but not the label SVG', () => {
  const { selector } = ruleFor('translate: 0 calc(var(--hero-lift, 0px) * -1')
  for (const sel of ['.hero__globe', '.hero__globe-stroke', '.hero-labels', '.hero__lead-col', '.hero__fill']) {
    assert.ok(selector.includes(sel), `the lift misses ${sel}`)
  }
  // .hero-labels__svg rides .hero-labels; lifting both doubles the travel.
  assert.ok(!selector.includes('.hero-labels__svg'), 'the label SVG is lifted twice')
})

test('the client marks are windowed over the PEAK rise', () => {
  // Correction 1. "Footer exits are masked via --footer-peak, never faded":
  // the roll is still in full view for most of a downward gesture, so a
  // window over the live rise dims it away on screen.
  const { body } = ruleFor('--mk-p: clamp(')
  assert.match(body, /var\(--footer-rise-peak,/)
  assert.doesNotMatch(body, /var\(--footer-rise,/)
})

test('reduced motion zeroes the lift and skips the entrance ground', () => {
  // The gesture SNAPS between the floor and 1 under reduced motion, so a live
  // lift is a jump cut; and a ground with no entrance to lift it is a
  // permanently invisible blurb. Both are explicit, not side effects.
  const lift = ruleFor('--hero-lift: 0px')
  assert.match(lift.selector, /\[data-footer-rest\]/)
  assert.ok(
    /@media \(prefers-reduced-motion: reduce\) \{[^]*?--hero-lift: 0px/.test(css),
    'the lift-zero rule is not inside a reduced-motion query'
  )
  const ground = css.slice(css.indexOf('html[data-footer-in] .site-footer__blurb'))
  assert.match(
    ground,
    /@media \(prefers-reduced-motion: reduce\) \{\s*html\[data-footer-in\][^]*?opacity: 1/,
    'the entrance ground has no reduced-motion escape'
  )
})

test('the footer link row is not drawn under the resting variant, at any width', () => {
  // 10-08 (Nathan): the links are removed from the globe-page footer variant.
  // This replaces the landscape-rotation escape that used to be asserted here.
  // That escape existed because .site-footer__nav was killed only inside
  // @media (max-width: 768px) while [data-footer-rest] is viewport-ungated, so
  // a 844px-wide landscape phone showed five links the retired stagger loop
  // would never reveal. Killing the ROW under the variant makes that state
  // unreachable, so the escape is gone and this is the invariant that matters:
  // the row must not come back above the breakpoint.
  assert.match(
    css,
    /html\[data-footer-rest\] \.site-footer__nav \{\s*display: none/,
    'the footer nav row is not hidden under [data-footer-rest]'
  )
  assert.ok(
    !/@media \(min-width: 769px\) \{\s*html\[data-footer-rest\] \.site-footer__link/.test(css),
    'the superseded landscape escape for .site-footer__link is still present'
  )
})

test('the footer band reserves ONE tagline row, not a lockup-over-pill column', () => {
  // 11-05 (Nathan): the lockup took the VISUAL WORLDS pill's seat beside the
  // copyright, so the band's min-height counts the taller of the lockup art
  // and the pill box once. The stacked calc added the lockup art + --space-2 on
  // top of the pill; a regression to it puts that dead height back in every
  // links footer (detail, process, /work).
  assert.match(
    css,
    /--tagline-row-h:\s*max\(var\(--lockup-art-h\),\s*calc\(var\(--lh-link\) \+ 2 \* var\(--pill-pad-y\)\)\);/,
    'the row token is not the taller of the lockup art and the pill box',
  )
  const inner = ruleFor('min-height: calc(var(--tagline-row-h)')
  const minHeight = inner.body.match(/^\s*min-height:.*$/m)
  assert.ok(minHeight, 'the band lost its min-height')
  assert.equal(
    minHeight[0].trim(),
    'min-height: calc(var(--tagline-row-h) + var(--footer-top-pad) + var(--footer-bottom-inset));',
    'the band no longer counts the one row plus its pads',
  )
  // the lockup wrapper is that same row height, so the row cannot outgrow what the band reserves;
  // its optical left edge keeps the pre-SQ-22 seat, the pill's text inset (Nathan 11-05: "retain the
  // same 11px positioning"), derived from the same tokens as before
  assert.match(
    ruleFor('margin-left: calc(var(--pill-pad-x) - var(--lockup-bleed))').body,
    /height: var\(--tagline-row-h\)/,
    'the lockup lost its row height or its --pill-pad-x optical seat',
  )
})

/* — the URL seeder — */

/** A fresh footerTune instance under a stubbed window/document. */
const freshTune = async (search) => {
  const props = new Map()
  globalThis.window = { location: { search } }
  globalThis.document = {
    documentElement: {
      style: {
        setProperty: (k, v) => props.set(k, v),
        removeProperty: (k) => props.delete(k),
      },
    },
    addEventListener: () => {},
  }
  try {
    const mod = await import(`../../src/lib/footerTune.js?seed=${encodeURIComponent(search)}`)
    return { state: mod.getFooterTuneState(), props }
  } finally {
    delete globalThis.window
    delete globalThis.document
  }
}

test('?footerlift=0 is honoured — 0 is a legal dial, not a typo', async () => {
  // The seeder's `n > 0` guard swallowed it: "parallax off" was undialable,
  // which is exactly the A/B a reviewer asks for first.
  const { state, props } = await freshTune('?footerlift=0')
  assert.equal(state.liftK, 0)
  assert.equal(props.get('--footer-lift-k'), '0', 'the dialed 0 never reached the cascade')
})

test('?footertravel=0 is still ignored — it would collapse the spacer', async () => {
  const { state } = await freshTune('?footertravel=0')
  assert.equal(state.travelK, FOOTER_TUNE_DEFAULTS.travelK)
})

test('a dialed knob reaches the cascade and an undialed page stays inert', async () => {
  const dialed = await freshTune('?footermarksfrom=0.3&footerintro=0.9')
  assert.equal(dialed.state.marksFrom, 0.3)
  assert.equal(dialed.props.get('--footer-marks-from'), '0.3')
  assert.equal(dialed.state.introS, 0.9)
  // introS never reaches CSS — the entrance is a GSAP timeline.
  assert.equal(dialed.props.has('--footer-intro'), false)

  const plain = await freshTune('')
  assert.deepEqual({ ...plain.state }, { ...FOOTER_TUNE_DEFAULTS })
  assert.equal(plain.props.size, 0, 'a page off the bench pinned inline properties')
})

test('?footerlerp=0 and ?footerbrake=0 are honoured, and neither reaches the cascade', async () => {
  // 0 is each one's A/B: the raw wheel delta from before 10-31, and the target
  // with no tail brake. createFooterDrive reads them in JS, never as CSS.
  const { state, props } = await freshTune('?footerlerp=0&footerbrake=0')
  assert.equal(state.lerp, 0)
  assert.equal(state.brake, 0)
  assert.equal(props.size, 0)
})

/* — the driven hosts' wheel (10-31, Nathan: "some sort of weight to the
   scrolling when you reveal the full footer … implement lenis here, and have
   just a bit of ease at the tail end of the scroll so it 'pumps the brakes'") —
   createFooterDrive (SiteFooter.jsx) is a ticker loop around these two. */

test('footerDamp is Lenis’s damp: the same glide at any frame rate', () => {
  // lenis.mjs: damp(x, y, lerp * 60, dt) = lerp(x, y, 1 - exp(-lerp * 60 * dt))
  assert.equal(footerDamp(0, 1, 0.1, 1 / 60), 1 - Math.exp(-0.1))
  const lerp = FOOTER_TUNE_DEFAULTS.lerp
  const at30 = footerDamp(0.4, 1, lerp, 1 / 30)
  const at60 = footerDamp(footerDamp(0.4, 1, lerp, 1 / 60), 1, lerp, 1 / 60)
  const at120 = [1, 2, 3, 4].reduce((x) => footerDamp(x, 1, lerp, 1 / 120), 0.4)
  assert.ok(Math.abs(at30 - at60) < 1e-12 && Math.abs(at30 - at120) < 1e-12, `${at30} ${at60} ${at120}`)
  // It approaches and never passes the target: the house curve, no overshoot.
  let x = 0.4
  for (let i = 0; i < 120; i++) {
    const next = footerDamp(x, 1, lerp, 1 / 60)
    assert.ok(next > x && next < 1)
    x = next
  }
  // lerp 0 is ?footerlerp=0, the raw delta: it lands at once.
  assert.equal(footerDamp(0.4, 0.9, 0, 1 / 60), 0.9)
})

test('the house lerp is the footer wheel’s default: one number, two homes', () => {
  // motion.js imports gsap's CustomEase, so it is read as source, like Hero.jsx above.
  const src = fs.readFileSync(`${root}src/lib/motion.js`, 'utf8')
  const m = src.match(/export const LENIS_TUNING = \{\s*lerp: ([0-9.]+)/)
  assert.ok(m, 'motion.js no longer declares LENIS_TUNING.lerp the way this test reads it')
  assert.equal(FOOTER_TUNE_DEFAULTS.lerp, Number(m[1]), 'the footer and the document scroll weigh differently')
})

test('footerBrakeStep: plain travel below the tail, a brake inside it, any delta size alike', () => {
  const rest = 0.4
  const b = 0.5
  const span = footerSpan(rest)
  const tail = rest + (1 - FOOTER_BRAKE_TAIL) * span // where the brake starts: 0.8
  const near = (a, e, tol = 1e-9) => assert.ok(Math.abs(a - e) < tol, `${a} vs ${e}`)
  // Below the tail, and on every retracting delta, the delta moves the target plainly.
  near(footerBrakeStep(rest, 0.2, rest, b), 0.6)
  near(footerBrakeStep(0.95, -0.1, rest, b), 0.85)
  near(footerBrakeStep(0.45, -0.2, rest, b), rest) // clamped at the floor
  near(footerBrakeStep(0.9, 0.05, rest, 0), 0.95) // ?footerbrake=0
  // Inside the tail a revealing delta moves it less, and less the nearer the top.
  const at = (p, d = 1e-8) => (footerBrakeStep(p, d, rest, b) - p) / d // a delta's share at p
  near(at(tail), 1, 1e-4)
  assert.ok(at(0.9) < 1 && at(0.95) < at(0.9))
  near(at(1 - 1e-5), 1 - b, 1e-3) // the share at the top is 1 − brake
  // A mouse notch lands where a trackpad's stream of small deltas does.
  const one = footerBrakeStep(rest, 0.5, rest, b)
  let many = rest
  for (let i = 0; i < 5000; i++) many = footerBrakeStep(many, 0.5 / 5000, rest, b)
  near(one, many, 1e-6)
  // It reaches the full reveal, after the distance the closed form gives:
  // the tail asks atanh(√b)/√b of its own length (1.2465 at b 0.5).
  const k = Math.sqrt(b)
  const full = span * (1 - FOOTER_BRAKE_TAIL + (FOOTER_BRAKE_TAIL * Math.atanh(k)) / k)
  assert.ok(footerBrakeStep(rest, full * 0.999, rest, b) < 1)
  near(footerBrakeStep(rest, full * 1.0001, rest, b), 1)
  near(full / span, 1.0822, 1e-4) // about 8% more wheel for the whole reveal
  // A brake past 0.9 is held there, so the target still reaches 1.
  near(footerBrakeStep(rest, 10, rest, 5), 1)
  // rest 0 is /work's footer: the same law over the whole travel.
  near(footerBrakeStep(0, 0.5, 0, b), 0.5)
  assert.ok(footerBrakeStep(0.9, 0.05, 0, b) < 0.95)
})

test('footerTensionStep — b 0 is the plain clamp, byte for byte', () => {
  /* SQ-115, 11-17: home's FINGER on the reveal ("the footer reveal stops
     slamming into its full reveal" on a phone). Hero's touch branch used the
     plain clamp at the HOUSE gain (5 since 11-03), so rest → full was ~41px of
     finger. footerTensionStep is the wheel brake's tail made symmetric, so a
     finger round-trips; the gain and the tension are two dials, defaulting to
     today's feel. The tests below hold the step and the dials' wiring. */
  for (const rest of [0, 0.4, 0.59]) {
    for (const p of [rest, (rest + 1) / 2, 0.95, 1]) {
      for (const dp of [-2, -0.3, -0.01, 0, 0.01, 0.3, 2]) {
        const plain = Math.min(1, Math.max(rest, p + dp))
        assert.equal(footerTensionStep(p, dp, rest, 0), plain)
        assert.equal(footerTensionStep(p, dp, rest), plain) // the default is off
      }
    }
  }
})

/** Up d, then down d, from p: where it ends. */
const roundTrip = (step, p, d, rest, b) => step(step(p, d, rest, b), -d, rest, b)

test('footerTensionStep — a finger up d px then down d px puts the panel back', () => {
  const near = (a, e, tol = 1e-9) => assert.ok(Math.abs(a - e) < tol, `${a} vs ${e}`)
  for (const [rest, b] of [[0.59, 0.5], [0.59, 0.7], [0.4, 0.5], [0, 0.9]]) {
    const span = footerSpan(rest)
    const tail = rest + (1 - FOOTER_BRAKE_TAIL) * span
    // A start in the tail, and one below it; d stays short of the clamp at 1.
    for (const p of [tail + 0.02 * span, tail + 0.1 * span, tail - 0.05 * span, rest + 0.02 * span]) {
      for (const d of [0.001, 0.01, 0.04]) {
        if (footerTensionStep(p, d, rest, b) >= 1) continue
        near(roundTrip(footerTensionStep, p, d, rest, b), p)
      }
    }
  }
  // The control the round trip is judged by: the WHEEL's brake brakes only the
  // revealing direction, so the same walk through footerBrakeStep does not come back.
  const rest = 0.59
  const p = rest + 0.9 * footerSpan(rest)
  assert.ok(Math.abs(roundTrip(footerBrakeStep, p, 0.02, rest, 0.5) - p) > 1e-3)
})

test('footerTensionStep — monotone in dp, inside [rest, 1], and it reaches exactly 1', () => {
  for (const [rest, b] of [[0.59, 0.5], [0.4, 0.9], [0, 0.3]]) {
    for (const p of [rest, rest + 0.5 * footerSpan(rest), 0.97, 1]) {
      let last = -Infinity
      for (let dp = -1.5; dp <= 1.5; dp += 0.005) {
        const q = footerTensionStep(p, dp, rest, b)
        assert.ok(q >= last, `not monotone at p ${p}, dp ${dp}`)
        assert.ok(q >= rest && q <= 1, `${q} left [${rest}, 1]`)
        last = q
      }
      assert.equal(last, 1, 'a big enough delta must land exactly on the full reveal')
      assert.equal(footerTensionStep(p, -1.5, rest, b), rest)
    }
  }
  // A tension past 0.9 is held there, so the top is still reached.
  assert.equal(footerTensionStep(0.59, 10, 0.59, 5), 1)
})

test('footerTensionStep — the local rate falls to 1 − b at the end of the tail, either way', () => {
  const near = (a, e, tol) => assert.ok(Math.abs(a - e) < tol, `${a} vs ${e}`)
  for (const [rest, b] of [[0.59, 0.5], [0.59, 0.7], [0, 0.3]]) {
    const span = footerSpan(rest)
    const tail = rest + (1 - FOOTER_BRAKE_TAIL) * span
    const d = 1e-8
    // Plain at the tail's start and below it.
    near((footerTensionStep(tail, d, rest, b) - tail) / d, 1, 1e-4)
    near((footerTensionStep(tail - 0.05, d, rest, b) - (tail - 0.05)) / d, 1, 1e-6)
    // At the top: up from just under it, and down from the full reveal itself.
    const top = 1 - 1e-5
    near((footerTensionStep(top, d, rest, b) - top) / d, 1 - b, 2e-3)
    near((1 - footerTensionStep(1, -d, rest, b)) / d, 1 - b, 2e-3)
    // And it falls through the tail.
    const mid = tail + 0.5 * (1 - tail)
    const r1 = (footerTensionStep(mid, d, rest, b) - mid) / d
    assert.ok(r1 < 1 && r1 > 1 - b)
  }
})

test('footerTensionStep — one large delta lands where many small ones of the same total do', () => {
  const near = (a, e, tol = 1e-6) => assert.ok(Math.abs(a - e) < tol, `${a} vs ${e}`)
  for (const [p0, total, rest, b] of [[0.59, 0.3, 0.59, 0.5], [0.85, 0.1, 0.59, 0.7], [0.95, -0.2, 0.59, 0.5], [0.4, 0.4, 0.4, 0.9]]) {
    const one = footerTensionStep(p0, total, rest, b)
    let many = p0
    for (let i = 0; i < 5000; i++) many = footerTensionStep(many, total / 5000, rest, b)
    near(one, many)
  }
})

test('footerBrakeStep is the forward half of footerTensionStep, so the wheel keeps its curve', () => {
  const near = (a, e) => assert.ok(Math.abs(a - e) < 1e-12, `${a} vs ${e}`)
  for (const dp of [0.001, 0.05, 0.2, 1]) {
    for (const p of [0.4, 0.8, 0.95]) near(footerBrakeStep(p, dp, 0.4, 0.5), footerTensionStep(p, dp, 0.4, 0.5))
  }
  // Retracting stays plain, tension or not.
  near(footerBrakeStep(0.95, -0.1, 0.4, 0.5), 0.85)
})

test('?footertouchgain is unset by default, 0 is refused, and ?footertouchbrake=0 is honoured', async () => {
  const plain = await freshTune('')
  assert.equal(plain.state.touchGain, null, 'the gain follows the house TOUCH_GAIN unless dialed')
  assert.equal(plain.state.touchBrake, 0, 'the default is today’s feel')
  const dialed = await freshTune('?footertouchgain=2&footertouchbrake=0.5')
  assert.equal(dialed.state.touchGain, 2)
  assert.equal(dialed.state.touchBrake, 0.5)
  assert.equal(dialed.props.size, 0, 'the finger dials are JS reads, never CSS')
  const zero = await freshTune('?footertouchgain=0&footertouchbrake=0')
  assert.equal(zero.state.touchGain, null, 'a gain of 0 would pin the panel')
  assert.equal(zero.state.touchBrake, 0)
})

test('Hero’s touch path reads the finger dials and rides footerTensionStep, the wheel path does not', () => {
  const src = fs.readFileSync(`${root}src/components/Hero.jsx`, 'utf8')
  assert.match(src, /\(touchY - y\) \* \(getFooterTouchGain\(\) \?\? TOUCH_GAIN\)/, 'the finger lost its own gain')
  assert.match(
    src,
    /footerTensionStep\(footerPRef\.current, dy \/ SCROLL_TRIGGER_HOME_PX, FOOTER_REST, getFooterTouchBrake\(\)\)/,
    'addDelta’s touch branch lost the tension',
  )
  assert.match(src, /const to = footerTensionStep\(p, vel \* RELEASE_MS, FOOTER_REST, getFooterTouchBrake\(\)\)/, 'the release carry skips the tension')
  assert.match(src, /drive\.add\(dy \/ SCROLL_TRIGGER_HOME_PX, footerPRef\.current\)/, 'the wheel path changed')
})
