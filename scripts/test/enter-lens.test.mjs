// The home → /work dive carries the FP → detail lens deepen (SQ-34): the lens
// channel is the SAME ramp the World's applyEnter builds (lens window, power-
// inOut), so the two passages cannot drift. enterLens is the one source Hero reads.
//   node --test scripts/test/enter-lens.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { ENTER_TUNABLES, ENTER_TUNE_DEFAULTS, ENTER_LENS_Y, enterLens, powInOut, seg } from '../../src/components/work/world/enterTune.js'

// useWorldScene.js applyEnter, restated: enterRamp.v scales ENTER_TUNABLES.lens.
const worldLens = (p, t) => t.lens * powInOut(seg(p, t.lensStart, t.lensEnd), t.pow)

test('the lens is off at the start of the passage and at the full amount at the end', () => {
  assert.ok(enterLens(0) === 0) // -0 === 0: lens is negative, 0 times it is -0
  assert.ok(Math.abs(enterLens(1) - ENTER_TUNE_DEFAULTS.lens) < 1e-12)
})

test('the home ramp is the World ramp at every progress', () => {
  for (let i = 0; i <= 40; i++) {
    const p = i / 40
    assert.equal(enterLens(p, ENTER_TUNE_DEFAULTS), worldLens(p, ENTER_TUNE_DEFAULTS))
  }
})

test('the ramp follows the tuned window and exponent', () => {
  const t = { ...ENTER_TUNE_DEFAULTS, lensStart: 0.25, lensEnd: 0.75, pow: 2 }
  assert.ok(enterLens(0.2, t) === 0)
  assert.equal(enterLens(0.8, t), t.lens)
  assert.ok(Math.abs(enterLens(0.5, t) - t.lens / 2) < 1e-12)
  assert.equal(enterLens(0.6, t), worldLens(0.6, t))
})

test('a home override replaces only the full-ramp amount', () => {
  const p = 0.7
  const base = enterLens(p, ENTER_TUNE_DEFAULTS)
  const dialed = enterLens(p, ENTER_TUNE_DEFAULTS, -0.22)
  assert.ok(Math.abs(dialed / base - -0.22 / ENTER_TUNE_DEFAULTS.lens) < 1e-9)
  assert.equal(enterLens(1, ENTER_TUNE_DEFAULTS, -0.22), -0.22)
})

test('the live tunables are read at call time', () => {
  const saved = ENTER_TUNABLES.lens
  ENTER_TUNABLES.lens = -0.3
  try {
    assert.equal(enterLens(1), -0.3)
  } finally {
    ENTER_TUNABLES.lens = saved
  }
})

test('y rides 1.1 times x like the World', () => {
  assert.equal(ENTER_LENS_Y, 1.1)
})
