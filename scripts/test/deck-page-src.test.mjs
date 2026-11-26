// SQ-79: a deck wall page loads at its drawn width x the screen's density, never past its source.
// The rung math behind DeckScroller's srcset + sizes (src/components/work/imageConfig.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { DECK_WIDTHS, deckPageImage, deckPageWidth, deckSourceWidth, deckWidths } from '../../src/components/work/imageConfig.js'

const SANITY = 'https://cdn.sanity.io/images/p/production/abc-3840x2160.jpg'
const still = (width) => ({ imageUrl: SANITY, imageDimensions: width ? { width, height: Math.round(width * 0.5625) } : undefined })
const mux = { playbackId: 'PLAYBACK' }

// What a browser does with `srcset` (w descriptors) + `sizes` in px: the first candidate, smallest first,
// whose width covers the slot x the screen's density; the widest when none does.
function pick({ srcSet }, sizesPx, dpr) {
  const rungs = srcSet.split(', ').map((c) => Number(c.match(/ (\d+)w$/)[1]))
  const need = sizesPx * dpr
  return rungs.find((w) => w >= need) ?? rungs.at(-1)
}

// the drawn page width of a two-across wall: (frame - gutter) / 2, quantized as the wall stores it
const twoAcross = (frame) => deckPageWidth(0, (frame - 2) / 2)

test('phone, DPR 3, two across: a rung below the old fixed 1400 that still covers drawn width x 3', () => {
  const wide = twoAcross(390 - 32)
  const w = pick(deckPageImage(still(3840)), wide, 3)
  assert.ok(w < 1400, `rung ${w}`)
  assert.ok(w >= wide * 3, `rung ${w} < ${wide * 3}`)
  assert.equal(w, 800)
})

test('desktop 1440, DPR 2, two across: the 1600 rung', () => {
  const wide = twoAcross(1440 - 64)
  assert.equal(pick(deckPageImage(still(3840)), wide, 2), 1600)
})

test('Studio Display 2560, DPR 2, two across: 2560, up from 1400, covering drawn width x 2', () => {
  const wide = twoAcross(2560 - 64)
  const w = pick(deckPageImage(still(3840)), wide, 2)
  assert.equal(w, 2560)
  assert.ok(w >= wide * 2)
})

test('a 1920-wide source caps the ladder at 1920: no rung and no request above it', () => {
  const img = deckPageImage(still(1920))
  assert.deepEqual(deckWidths(1920), [480, 800, 1200, 1600, 1920])
  const wide = twoAcross(2560 - 64)
  assert.equal(pick(img, wide, 2), 1920) // the wall wants 2500, the source has 1920
  for (const [, w] of img.srcSet.matchAll(/w=(\d+)&/g)) assert.ok(Number(w) <= 1920, `w=${w}`)
  assert.ok(!img.srcSet.includes('2560'))
})

test('an 8000-wide source still tops out at the ladder end', () => {
  assert.equal(deckWidths(8000).at(-1), DECK_WIDTHS.at(-1))
})

test('a source narrower than the smallest rung is the only rung', () => {
  assert.deepEqual(deckWidths(400), [400])
})

test('Sanity urls carry fit=max, the descriptor matches the w param, and src is the 1200 rung', () => {
  const img = deckPageImage(still(3840))
  for (const c of img.srcSet.split(', ')) {
    const [, w] = c.match(/w=(\d+)&/)
    assert.ok(c.includes('fit=max') && c.includes('auto=format'))
    assert.ok(c.endsWith(` ${w}w`))
  }
  assert.ok(img.src.includes('w=1200&'))
})

test('a still with no metadata reads its width from the CDN url; with neither it keeps fit=max over the full ladder', () => {
  assert.equal(deckSourceWidth(still(0)), 3840) // -3840x2160 in SANITY
  const blind = deckPageImage({ imageUrl: 'https://cdn.sanity.io/images/p/production/abc.jpg' })
  assert.equal(blind.srcSet.split(', ').length, DECK_WIDTHS.length)
  assert.ok(blind.srcSet.split(', ').every((c) => c.includes('fit=max')))
})

test('Mux: a portrait poster tops out at the 1080 source, a 16:9 one at 1920; never the 3840 rung', () => {
  const portrait = deckPageImage(mux, 4 / 5)
  assert.equal(deckSourceWidth(mux, 4 / 5), 1080)
  assert.deepEqual([...portrait.srcSet.matchAll(/width=(\d+)&/g)].map((m) => Number(m[1])), [480, 800, 1080])
  assert.equal(pick(portrait, twoAcross(2560 - 64), 2), 1080)
  const wide = deckPageImage(mux, 16 / 9)
  assert.equal(deckSourceWidth(mux, 16 / 9), 1920)
  assert.equal(Math.max(...[...wide.srcSet.matchAll(/width=(\d+)&/g)].map((m) => Number(m[1]))), 1920)
  assert.ok(portrait.srcSet.includes('image.mux.com/PLAYBACK/thumbnail.webp'))
})

test('the wall page width steps up a quantum at a time and never drops below its peak', () => {
  assert.equal(deckPageWidth(0, 1250), 1264)
  assert.equal(deckPageWidth(1264, 1260), 1264) // within the same step: unchanged, so the layout state is too
  assert.equal(deckPageWidth(1264, 180), 1264) // a shrink keeps the rung already loaded
  assert.equal(deckPageWidth(1264, 1300), 1312) // a growth steps up
})
