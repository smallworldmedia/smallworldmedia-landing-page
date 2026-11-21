// SQ-124: the house pulse on the compositor — the pure helpers behind GraticulePager's
// rest beat (motion.js housePulseKeyframes / housePulseStartMs) and the file-level
// assertions that the skin no longer runs it on GSAP.
//   node --test scripts/test/house-pulse-compositor.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import gsap from 'gsap'
import { CustomEase } from 'gsap/CustomEase'
import {
  HOUSE_PULSE_ON_RATIO,
  HOUSE_PULSE_PERIOD_S,
  HOUSE_PULSE_STEPS,
  ensureHousePulse,
  housePulseKeyframes,
  housePulseStartMs,
} from '../../src/lib/motion.js'

gsap.registerPlugin(CustomEase)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8')
const ease = gsap.parseEase(ensureHousePulse())
const PERIOD_MS = HOUSE_PULSE_PERIOD_S * 1000
const HIT_MS = PERIOD_MS * HOUSE_PULSE_ON_RATIO

// The WAAPI value of a keyframe list at a cycle fraction (linear between stops).
function valueAt(frames, offset) {
  for (let i = 1; i < frames.length; i++) {
    if (offset <= frames[i].offset) {
      const a = frames[i - 1]
      const b = frames[i]
      const t = (offset - a.offset) / (b.offset - a.offset)
      return a.opacity + (b.opacity - a.opacity) * t
    }
  }
  return frames.at(-1).opacity
}

test('keyframes: offsets climb 0 → 1, the hit fills ON_RATIO of the cycle, the rest holds', () => {
  const f = housePulseKeyframes(ease, 0, 1)
  assert.equal(f.length, HOUSE_PULSE_STEPS + 2)
  assert.equal(f[0].offset, 0)
  assert.ok(Math.abs(f[HOUSE_PULSE_STEPS].offset - HOUSE_PULSE_ON_RATIO) < 1e-12)
  assert.equal(f.at(-1).offset, 1)
  for (let i = 1; i < f.length; i++) assert.ok(f[i].offset > f[i - 1].offset, `offset ${i} climbs`)
  assert.equal(f[0].opacity, 0)
  assert.ok(Math.abs(f[HOUSE_PULSE_STEPS].opacity) < 1e-9, 'the hit ends back at rest')
  assert.equal(f.at(-1).opacity, 0, 'the rest span holds the rest value')
})

test('keyframes: a sample sits on the crest and the crest is the envelope peak', () => {
  const f = housePulseKeyframes(ease, 0, 1)
  const peak = f.reduce((m, k) => (k.opacity > m.opacity ? k : m))
  assert.ok(Math.abs(peak.offset - 0.45 * HOUSE_PULSE_ON_RATIO) < 1e-9, 'peak at 45% of the hit')
  assert.ok(Math.abs(peak.opacity - 1) < 1e-3)
})

test('keyframes: the straight lines between samples stay inside one 8-bit opacity step of the curve', () => {
  for (const [from, to] of [
    [0, 1], // the veil and the number's white twin
    [1, 0.55], // the select_project hint's ink: white → 55%
  ]) {
    const f = housePulseKeyframes(ease, from, to)
    let worst = 0
    for (let i = 0; i < 4000; i++) {
      const x = i / 4000 // a fraction of the hit
      const want = from + (to - from) * ease(x)
      worst = Math.max(worst, Math.abs(valueAt(f, x * HOUSE_PULSE_ON_RATIO) - want))
    }
    assert.ok(worst < 1 / 255, `${from}→${to}: worst error ${worst} is under 1/255`)
  }
})

test('keyframes: the hint runs the inverse polarity (white at rest, dips to 55% at the crest)', () => {
  const f = housePulseKeyframes(ease, 1, 0.55)
  assert.equal(f[0].opacity, 1)
  assert.equal(f.at(-1).opacity, 1)
  assert.ok(Math.abs(Math.min(...f.map((k) => k.opacity)) - 0.55) < 1e-3)
})

test('start: in the rest span the animation starts at timeline 0, which is the metronome', () => {
  assert.equal(housePulseStartMs(PERIOD_MS * 10 + HIT_MS, PERIOD_MS, HIT_MS), 0)
  assert.equal(housePulseStartMs(PERIOD_MS * 10 + PERIOD_MS - 1, PERIOD_MS, HIT_MS), 0)
  assert.equal(housePulseStartMs(123456.789, PERIOD_MS, HIT_MS) === 0, 123456.789 % PERIOD_MS >= HIT_MS)
})

test('start: inside a hit it waits for the next downbeat, on a multiple of the period', () => {
  for (const now of [PERIOD_MS * 7, PERIOD_MS * 7 + 1, PERIOD_MS * 7 + HIT_MS / 2, PERIOD_MS * 7 + HIT_MS - 1]) {
    const s = housePulseStartMs(now, PERIOD_MS, HIT_MS)
    assert.ok(s > now, `${now}: starts later`)
    assert.ok(s - now <= PERIOD_MS, `${now}: within one period`)
    assert.ok(Math.abs(s / PERIOD_MS - Math.round(s / PERIOD_MS)) < 1e-9, `${now}: a downbeat`)
  }
})

test('skin: GraticulePager runs the rest pulse as web animations on the metronome, not GSAP', () => {
  const src = read('src/components/work/pager/GraticulePager.jsx')
  const arm = src.slice(src.indexOf('const killPulse'), src.indexOf('const syncPulse'))
  assert.match(arm, /housePulseKeyframes\(/)
  assert.match(arm, /housePulseStartMs\(/)
  assert.match(arm, /\.animate\(/)
  assert.match(arm, /iterations: Infinity/)
  assert.match(arm, /a\.cancel\(\)/, 'killPulse cancels the animations')
  assert.match(arm, /removeProperty\('color'\)/, 'killPulse clears the hint ink')
  assert.match(arm, /PREFERS_REDUCED_MOTION \|\| !pulseOn\) return/, 'no beat under reduced motion, nor unless ?scalepulse asks for it')
  // Nathan 11-20: the rest pulse is off by default; ?scalepulse=1 previews it.
  assert.match(src, /const pulseOn = PARAM\('scalepulse', 0\) !== 0;/, 'off by default, ?scalepulse=1 previews it')
  assert.doesNotMatch(arm, /gsap\.(timeline|set|to)\(/, 'no per-frame GSAP tween in the pulse')
  assert.doesNotMatch(src, /joinHousePulse/)
  const sync = src.slice(src.indexOf('const syncPulse'), src.indexOf('const syncPulse') + 300)
  assert.match(sync, /!pulseAnimsRef\.current && !pulseTimerRef\.current/, 'a Turn leaves a beating pulse alone')
})
