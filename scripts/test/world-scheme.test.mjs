// What the /work scene paints under each colour scheme (US-7, SQ-91): the pure parts.
// worldConfig.js is import-safe in node (it reads window only behind guards).
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SHELL_LINE_COLOR,
  SCHEME_GRID_LEVEL,
  drumAccentFor,
  glowColorFor,
  gridGrey,
  hex6,
  shellLineFor,
  schemePaintPlan,
  rampMixFor,
  tabPairFor,
} from '../../src/components/work/world/worldConfig.js'
import {
  applyRamp,
  patchBasicFragment,
  rampUniforms,
} from '../../src/components/work/world/worldRamp.js'
import { RAMP_A_RGB } from '../../src/lib/spectrumRamp.js'
import { SPECTRUM } from '../../src/lib/colorScheme.js'
import { ShaderLib } from 'three'

const red = { slug: 'a', projectColor: '#ff3300', spectrum: 'green' }
const lime = { slug: 'b', projectColor: '#a3e635', spectrum: 'red' }
const plain = { slug: 'c' } // a colourless World, no spectrum key

test('the default grid level is 0.16 (11-17: lightened slightly from the 0.12 starting value)', () => {
  assert.equal(SCHEME_GRID_LEVEL, 0.16)
})

test('project scheme paints the World colour, or today deep blue when it has none', () => {
  assert.equal(drumAccentFor(red, 'project'), '#ff3300')
  assert.equal(drumAccentFor(plain, 'project'), SHELL_LINE_COLOR)
  assert.equal(glowColorFor(red, 'project'), '#ff3300')
  assert.equal(glowColorFor(plain, 'project'), SHELL_LINE_COLOR)
})

test('black scheme paints #000000 borders, wall borders and tab fills for every World', () => {
  for (const w of [red, lime, plain]) assert.equal(drumAccentFor(w, 'black'), '#000000')
})

test('blue scheme paints brand blue for every World, with or without a project colour', () => {
  for (const w of [red, lime, plain]) assert.equal(drumAccentFor(w, 'blue'), '#0000ff')
})

test('spectrum scheme is keyless: every World gets the blue fill, whatever its spectrum key or project colour', () => {
  for (const w of [red, lime, plain, { spectrum: 'nope' }, null])
    assert.equal(drumAccentFor(w, 'spectrum'), SPECTRUM.blue.fill)
})

test('spectrum glow and shell line are the blue fill for every World too (the shell line still takes the grid dim)', () => {
  for (const w of [red, lime, plain, { spectrum: 'nope' }, null]) {
    assert.equal(glowColorFor(w, 'spectrum'), SPECTRUM.blue.fill)
    assert.deepEqual(shellLineFor(w, 'spectrum'), { color: SPECTRUM.blue.fill, tinted: true })
  }
})

test('the ramp mix is 1 under spectrum and exactly 0 under project, black and blue', () => {
  assert.equal(rampMixFor('spectrum'), 1)
  for (const s of ['project', 'black', 'blue', undefined]) assert.equal(rampMixFor(s), 0)
})

test('the spine tab pair is yellow with near-black ink under spectrum, and null (as before) under the others', () => {
  assert.deepEqual(tabPairFor('spectrum'), { fill: '#fbb702', ink: '#0a0a0a' })
  assert.equal(tabPairFor('spectrum').fill, SPECTRUM.yellow.fill)
  assert.equal(tabPairFor('spectrum').ink, SPECTRUM.yellow.fg)
  for (const s of ['project', 'black', 'blue']) assert.equal(tabPairFor(s), null)
})

test('the ramp patch reaches three\'s real basic fragment shader: ramp in diffuse\'s place, declarations once', () => {
  const src = ShaderLib.basic.fragmentShader
  const out = patchBasicFragment(src)
  assert.notEqual(out, src)
  assert.match(out, /vec4 diffuseColor = vec4\( mix\( diffuse, spectrumRamp\( gl_FragCoord\.x \/ uRampW \) \* uRampLevel, uRampMix \), opacity \);/)
  assert.equal(out.includes('vec4 diffuseColor = vec4( diffuse, opacity );'), false)
  for (const decl of ['uniform vec3 uRamp[9];', 'uniform float uRampMix;', 'uniform float uRampW;', 'uniform float uRampLevel;'])
    assert.equal(out.split(decl).length - 1, 1, decl)
  assert.ok(out.indexOf('vec3 spectrumRamp(float t)') < out.indexOf('void main() {'))
})

test('applyRamp wires a material to the SHARED uniforms by reference, one program key, the level its own', () => {
  const a = applyRamp({}, 0.6)
  const b = applyRamp({}, 0.6)
  const c = applyRamp({})
  const shaders = [a, b, c].map((m) => {
    const shader = { uniforms: {}, fragmentShader: ShaderLib.basic.fragmentShader }
    m.onBeforeCompile(shader)
    assert.match(shader.fragmentShader, /spectrumRamp/)
    return shader
  })
  for (const s of shaders) {
    assert.equal(s.uniforms.uRamp, rampUniforms.uRamp)
    assert.equal(s.uniforms.uRampMix, rampUniforms.uRampMix)
    assert.equal(s.uniforms.uRampW, rampUniforms.uRampW)
  }
  assert.equal(shaders[0].uniforms.uRampLevel, shaders[1].uniforms.uRampLevel)
  assert.equal(shaders[0].uniforms.uRampLevel.value, 0.6)
  assert.equal(shaders[2].uniforms.uRampLevel.value, 1)
  assert.equal(a.customProgramCacheKey(), c.customProgramCacheKey())
  assert.equal(rampUniforms.uRamp.value, RAMP_A_RGB)
  assert.equal(rampUniforms.uRampMix.value, 0) // a fresh scene starts on the flat colour
})

test('black shell grid level 0.12 is #1f1f1f, 0.16 is #292929, 0 is #000000, 1 is #ffffff, 0.3 is #4d4d4d', () => {
  assert.equal(shellLineFor(red, 'black', 0.12).color, '#1f1f1f')
  assert.equal(shellLineFor(red, 'black', 0).color, '#000000')
  assert.equal(shellLineFor(red, 'black', 1).color, '#ffffff')
  assert.equal(shellLineFor(red, 'black', 0.3).color, '#4d4d4d')
  assert.equal(shellLineFor(red, 'black', 0.16).color, '#292929')
  assert.equal(shellLineFor(red, 'black').color, '#292929') // the default level
})

test('black shell grid out-of-range levels clamp, and no World tint applies', () => {
  assert.equal(gridGrey(-4), '#000000')
  assert.equal(gridGrey(9), '#ffffff')
  assert.equal(shellLineFor(red, 'black', 0.12).tinted, false)
})

test('black shell grid is the same for two different Worlds (nothing to tween between them)', () => {
  assert.deepEqual(shellLineFor(red, 'black', 0.12), shellLineFor(lime, 'black', 0.12))
  assert.deepEqual(shellLineFor(red, 'black', 0.12), shellLineFor(plain, 'black', 0.12))
})

test('the black glow takes the grid grey, every other scheme the border accent', () => {
  assert.equal(glowColorFor(red, 'black', 0.3), '#4d4d4d')
  assert.equal(glowColorFor(red, 'blue'), '#0000ff')
  assert.equal(glowColorFor(red, 'spectrum'), SPECTRUM.blue.fill)
})

test('project shell line is exactly today, the World colour tinted or the untinted deep blue', () => {
  assert.deepEqual(shellLineFor(red, 'project'), { color: '#ff3300', tinted: true })
  assert.deepEqual(shellLineFor(plain, 'project'), { color: SHELL_LINE_COLOR, tinted: false })
  assert.deepEqual(shellLineFor(null, 'project'), { color: SHELL_LINE_COLOR, tinted: false })
})

test('the blue shell line follows the scheme accent through the same tint', () => {
  assert.deepEqual(shellLineFor(red, 'blue'), { color: '#0000ff', tinted: true })
  assert.deepEqual(shellLineFor(plain, 'blue'), { color: '#0000ff', tinted: true })
})

test('hex6 normalises a THREE-land number and a hex string alike', () => {
  assert.equal(hex6(0x020098), '#020098')
  assert.equal(hex6('#A3E635'), '#a3e635')
})

test('a preview event writes colours only, a settled event also repaints the tabs, neither rebuilds a slot', () => {
  assert.deepEqual(schemePaintPlan(true), { colors: true, tabs: false })
  assert.deepEqual(schemePaintPlan(false), { colors: true, tabs: true })
  assert.equal('rebuild' in schemePaintPlan(false), false)
})
