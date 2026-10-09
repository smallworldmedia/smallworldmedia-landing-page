// The mobile home footer's reveal channel (SQ-11, 10-07) — the parts that are
// checkable without a browser. The GEOMETRY is measured by
// `node scripts/globe-probe.mjs --footer`, which drives a real touch scrub;
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
import { footerRise, footerSpan, FOOTER_TUNE_DEFAULTS } from '../../src/lib/footerTune.js'

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
  // Correction 1's other half. --footer-reveal parks at 0.62, so a lift
  // windowed over it starts a third of the way up on the very first paint.
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
  assert.match(css, /translate: 0 calc\(var\(--hero-lift, 0px\) \* -1\)/)
  assert.doesNotMatch(css, /transform:[^;]*--hero-lift/)
})

test('the lift selector group holds the whole hero but not the label SVG', () => {
  const { selector } = ruleFor('translate: 0 calc(var(--hero-lift, 0px) * -1)')
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
