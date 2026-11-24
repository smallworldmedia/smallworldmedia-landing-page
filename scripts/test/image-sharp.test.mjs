// SQ-150: DOM images (Mux thumbnails, client logos) are fetched at drawn width x DPR, never less sharp.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { DPR_CAP, isSharp, neededWidth } from '../lib/imageSharpGate.mjs'
import { AUTO_SIZES, MUX_SOURCE_SHORT, deckPageImage } from '../../src/components/work/imageConfig.js'
import { BAL_K, BAL_MAX, BAL_MIN, BAL_REF_AR, DENSITIES, LOGO_H, balance, rungs } from '../prep-client-logo-sizes.mjs'

const ROOT = new URL('../../', import.meta.url)
const read = (p) => readFileSync(new URL(p, ROOT), 'utf8')

// --- the gate -------------------------------------------------------------------------------

test('gate: a file as wide as drawn width x dpr passes, one pixel under fails (the negative control)', () => {
  assert.equal(isSharp(1236, 412, 3, 1920), true)
  assert.equal(isSharp(1237, 412, 3, 1920), true)
  assert.equal(isSharp(1235, 412, 3, 1920), false) // undersized: natural < rendered x dpr
})

test('gate: the source caps the demand, so a file as wide as its source passes', () => {
  assert.equal(neededWidth(412, 3, 1080), 1080)
  assert.equal(isSharp(1080, 412, 3, 1080), true)
  assert.equal(isSharp(1079, 412, 3, 1080), false)
})

test('gate: dpr is capped at 3', () => {
  assert.equal(DPR_CAP, 3)
  assert.equal(neededWidth(100, 4, Infinity), 300)
  assert.equal(isSharp(300, 100, 4, null), true)
})

test('gate: an unloaded image or a bad number is not sharp', () => {
  assert.equal(isSharp(0, 10, 1, null), false)
  assert.equal(isSharp(NaN, 10, 1, null), false)
  assert.equal(isSharp(50, undefined, 1, null), false)
})

// --- Mux thumbnails: the detail grid's tiles --------------------------------------------------

// What a browser does with `srcset` (w descriptors) + the tile's laid-out width (sizes=auto): the smallest
// rung that covers drawn width x dpr, else the widest.
const pickW = ({ srcSet }, drawn, dpr) => {
  const rungs = srcSet.split(', ').map((c) => Number(c.match(/ (\d+)w$/)[1]))
  return rungs.find((w) => w >= drawn * dpr) ?? rungs.at(-1)
}
const PID = 'PLAYBACK'

test('Mux tile: sizes=auto falls back to the full viewport (a phone column exactly)', () => {
  assert.equal(AUTO_SIZES, 'auto, 100vw')
})

test('Mux tile: every rung is sharp at 390@3, 412@1.75 and 1440@2 for a 9:16 and a 16:9 source, and never past the source', () => {
  for (const [ratio, source] of [[9 / 16, MUX_SOURCE_SHORT], [16 / 9, Math.round(MUX_SOURCE_SHORT * (16 / 9))]]) {
    const img = deckPageImage({ playbackId: PID }, ratio)
    for (const [drawn, dpr] of [[390, 3], [412, 1.75], [412, 1], [720, 2], [1440, 2], [1440, 1]]) {
      const w = pickW(img, drawn, dpr)
      assert.ok(isSharp(w, drawn, dpr, source), `ratio ${ratio.toFixed(2)} drawn ${drawn}@${dpr}: rung ${w}`)
      assert.ok(w <= source, `rung ${w} past the source ${source}`)
    }
  }
})

test('Mux tile: a phone at DPR 1.75 takes 800, not the old fixed 1400', () => {
  assert.equal(pickW(deckPageImage({ playbackId: PID }, 9 / 16), 412, 1.75), 800)
})

test('Mux tile: a chunk poster is cut at its own start, every rung', () => {
  const img = deckPageImage({ playbackId: PID }, 16 / 9, 15.574)
  for (const c of img.srcSet.split(', ')) assert.match(c, /time=15\.574 \d+w$/)
  assert.match(img.src, /time=15\.574$/)
})

test('Mux tile: the default time is frame 0, as the deck wall asks', () => {
  assert.match(deckPageImage({ playbackId: PID }, 16 / 9).src, /time=0$/)
})

// --- client logos --------------------------------------------------------------------------------

const manifest = JSON.parse(read('src/assets/client-logos/manifest.json'))
const sized = JSON.parse(read('src/assets/client-logos/sized/manifest.json'))
const pngs = manifest.filter((m) => m.file.endsWith('.png'))

test('logos: the generator mirrors the ticker\'s optical-balance constants', () => {
  const src = read('src/components/ClientLogoTicker.jsx')
  const num = (name) => Number(src.match(new RegExp(`const ${name} = ([\\d.]+);`))[1])
  assert.equal(num('BAL_K'), BAL_K)
  assert.equal(num('BAL_REF_AR'), BAL_REF_AR)
  assert.equal(num('BAL_MIN'), BAL_MIN)
  assert.equal(num('BAL_MAX'), BAL_MAX)
  assert.match(read('src/styles/global.css'), new RegExp(`--logo-h: ${LOGO_H}px;`))
})

test('logos: every PNG has a rung per density and each rung\'s file exists', () => {
  assert.ok(pngs.length > 20)
  for (const m of pngs) {
    const set = sized[m.file]
    assert.deepEqual(set.map((r) => r.x), DENSITIES, m.file)
    for (const r of set) if (r.file) assert.ok(existsSync(new URL(`src/assets/client-logos/sized/${r.file}`, ROOT)), r.file)
  }
})

test('logos: at 1x, 2x, 3x the density pick is sharp at the 28 px desktop and 22 px phone marks, never past the source', () => {
  for (const m of pngs) {
    const set = sized[m.file]
    for (const logoH of [28, 22]) {
      const drawnW = (logoH * balance(m.w, m.h) * m.w) / m.h // the mark's drawn width, CSS px
      for (const dpr of [1, 1.5, 2, 3, 4]) {
        // a browser takes the smallest density >= its DPR, else the largest
        const r = set.find((c) => c.x >= dpr) ?? set.at(-1)
        assert.ok(isSharp(r.w, drawnW, dpr, m.w), `${m.file} ${logoH}px @${dpr}: ${r.w} wide for ${drawnW.toFixed(1)}`)
        assert.ok(r.w <= m.w && r.h <= m.h, `${m.file} rung past its source`)
      }
    }
  }
})

test('logos: the rungs save pixels at 1x and 2x (negative control: they are not the original)', () => {
  const r = rungs('x', 555, 104) // ayita: drawn ~21 px tall
  assert.ok(r[0].w < 555 && r[0].file)
  assert.equal(r[0].h, Math.ceil(LOGO_H * balance(555, 104)))
  assert.equal(isSharp(r[0].w - 1, (LOGO_H * balance(555, 104) * 555) / 104, 1, 555), false)
})
