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
} from '../../src/components/work/world/worldConfig.js'
import { SPECTRUM } from '../../src/lib/colorScheme.js'

const red = { slug: 'a', projectColor: '#ff3300', spectrum: 'green' }
const lime = { slug: 'b', projectColor: '#a3e635', spectrum: 'red' }
const plain = { slug: 'c' } // a colourless World, no spectrum key

test('the default grid level is the 0.12 starting value', () => {
  assert.equal(SCHEME_GRID_LEVEL, 0.12)
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

test('spectrum scheme paints the dealt palette fill, and blue when the spectrum key is missing or unknown', () => {
  assert.equal(drumAccentFor(red, 'spectrum'), SPECTRUM.green.fill)
  assert.equal(drumAccentFor(lime, 'spectrum'), SPECTRUM.red.fill)
  assert.equal(drumAccentFor(plain, 'spectrum'), SPECTRUM.blue.fill)
  assert.equal(drumAccentFor({ spectrum: 'nope' }, 'spectrum'), SPECTRUM.blue.fill)
})

test('black shell grid level 0.12 is #1f1f1f, 0 is #000000, 1 is #ffffff, 0.3 is #4d4d4d', () => {
  assert.equal(shellLineFor(red, 'black', 0.12).color, '#1f1f1f')
  assert.equal(shellLineFor(red, 'black', 0).color, '#000000')
  assert.equal(shellLineFor(red, 'black', 1).color, '#ffffff')
  assert.equal(shellLineFor(red, 'black', 0.3).color, '#4d4d4d')
  assert.equal(shellLineFor(red, 'black').color, '#1f1f1f') // the default level
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
  assert.equal(glowColorFor(red, 'spectrum'), SPECTRUM.green.fill)
})

test('project shell line is exactly today, the World colour tinted or the untinted deep blue', () => {
  assert.deepEqual(shellLineFor(red, 'project'), { color: '#ff3300', tinted: true })
  assert.deepEqual(shellLineFor(plain, 'project'), { color: SHELL_LINE_COLOR, tinted: false })
  assert.deepEqual(shellLineFor(null, 'project'), { color: SHELL_LINE_COLOR, tinted: false })
})

test('blue and spectrum shell lines follow the scheme accent through the same tint', () => {
  assert.deepEqual(shellLineFor(red, 'blue'), { color: '#0000ff', tinted: true })
  assert.deepEqual(shellLineFor(plain, 'blue'), { color: '#0000ff', tinted: true })
  assert.deepEqual(shellLineFor(lime, 'spectrum'), { color: SPECTRUM.red.fill, tinted: true })
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
