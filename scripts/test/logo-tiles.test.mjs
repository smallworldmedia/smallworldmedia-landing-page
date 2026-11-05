// The Project Directory's logo tiles: a white mark on black in a square or a
// landscape canvas (logoTile.js), which assets become one (buildDirectoryTiles
// with the prep manifest), and the baked set itself (src/data).
//   node --test scripts/test/logo-tiles.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { LOGO_DIALS, canvasOf, logoLayout } from '../../src/components/work/directory/logoTile.js'
import { buildDirectoryTiles } from '../../src/components/work/directory/buildDirectoryTiles.js'
import { ratioOf } from '../../src/components/work/detail/buildContentFlow.js'
import { classifyTile } from '../../src/components/work/detail/flushGrid.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ── the layout ───────────────────────────────────────────────────────────────
const mark = (aspect, density = 0.3, cx = 0.5, cy = 0.5) => ({ aspect, density, cx, cy })

test('a mark wider than the landscape aspect takes a landscape canvas, the rest a square', () => {
  assert.equal(canvasOf(0.75), 'square')
  assert.equal(canvasOf(1.59), 'square')
  assert.equal(canvasOf(1.6), 'landscape')
  assert.equal(canvasOf(8.8), 'landscape')
  assert.equal(canvasOf(1.9, 2), 'square', 'the threshold is a dial')
  assert.equal(logoLayout(mark(3)).ratio, 2)
  assert.equal(logoLayout(mark(1)).ratio, 1)
})

test('every mark sits inside its canvas minus the padding, on both shapes', () => {
  for (const aspect of [0.4, 0.75, 1, 1.5, 1.6, 2.1, 4, 8.8]) {
    for (const density of [0.1, 0.3, 0.8]) {
      for (const weight of [0, 0.4, 1]) {
        const lay = logoLayout(mark(aspect, density, 0.62, 0.38), { weight })
        const pad = LOGO_DIALS.pad
        const padX = (pad / lay.ratio) * 100 // the margin in percent of the canvas's width
        const eps = 1e-9
        assert.ok(lay.left >= padX - eps && lay.left + lay.width <= 100 - padX + eps, `x ${aspect}/${density}/${weight}`)
        assert.ok(lay.top >= pad * 100 - eps && lay.top + lay.height <= 100 - pad * 100 + eps, `y ${aspect}/${density}/${weight}`)
      }
    }
  }
})

test('the box keeps the mark\'s own aspect on its canvas', () => {
  for (const aspect of [0.75, 1, 2.1, 8.8]) {
    const lay = logoLayout(mark(aspect))
    // width and height are percents of a canvas `ratio` wide and 1 tall
    assert.ok(Math.abs((lay.width * lay.ratio) / lay.height - aspect) < 1e-9, `aspect ${aspect}`)
  }
})

test('weight 0 fills the padded box; weight 1 gives a dense badge less box than a thin script', () => {
  const fill = logoLayout(mark(1, 0.8), { weight: 0 })
  assert.ok(Math.abs(fill.height - (1 - 2 * LOGO_DIALS.pad) * 100) < 1e-9, 'fills the padded height')
  const dense = logoLayout(mark(1, 0.8), { weight: 1 })
  const thin = logoLayout(mark(1, 0.2), { weight: 1 })
  assert.ok(dense.height < thin.height, 'the dense mark is smaller')
  // at weight 1 the ink areas are equal wherever neither is capped by its box
  const a = logoLayout(mark(1, 0.7), { weight: 1 })
  const b = logoLayout(mark(1.2, 0.6), { weight: 1 })
  const ink = (lay, d) => d * lay.width * lay.height * lay.ratio
  assert.ok(Math.abs(ink(a, 0.7) - ink(b, 0.6)) / ink(a, 0.7) < 1e-9, 'equal ink area')
})

test('centre 1 moves the mark so its centre of mass lands on the canvas centre, 0 leaves the box centred', () => {
  // dense, so weight 1 sizes it well under its box and there is room to move
  const heavyRight = mark(1, 0.8, 0.6, 0.5)
  const box = logoLayout(heavyRight, { center: 0, weight: 1, pad: 0.1 })
  assert.ok(Math.abs(box.left + box.width / 2 - 50) < 1e-9, 'box centred')
  const mass = logoLayout(heavyRight, { center: 1, weight: 1, pad: 0.1 })
  assert.ok(mass.width < 80, 'smaller than its padded box')
  const massAt = mass.left + mass.width * 0.6 // in percent of the canvas's width
  assert.ok(Math.abs(massAt - 50) < 1e-9, 'mass centred')
  // a mark that fills its box has no room to move
  const tight = logoLayout(heavyRight, { center: 1, weight: 0 })
  assert.ok(Math.abs(tight.left + tight.width / 2 - 50) < 1e-9)
})

test('a canvas ratio stands in for a tile\'s own shape in the flush grid (ratioOf, classifyTile)', () => {
  const wide = { mediaType: 'logo', imageDimensions: { width: 3000, height: 300 }, tileRatio: 2 }
  assert.equal(ratioOf(wide), 2)
  assert.equal(classifyTile(ratioOf(wide)), 'landscape')
  const tall = { mediaType: 'logo', imageDimensions: { width: 300, height: 400 }, tileRatio: 1 }
  assert.equal(classifyTile(ratioOf(tall)), 'square')
  assert.equal(ratioOf({ mediaType: 'logo', imageDimensions: { width: 300, height: 400 } }), 0.75, 'no tileRatio: as before')
})

// ── which assets become logo tiles ───────────────────────────────────────────
let rank = 0
const asset = (id, fields = {}) => ({
  _id: id,
  title: id,
  mediaType: 'logo',
  clientSlug: 'acme',
  orderRank: `0|${String(rank++).padStart(6, '0')}:`,
  services: [{ name: 'Logo Design', slug: 'logo-design' }],
  imageUrl: `https://cdn.example.invalid/${id}.png`,
  imageDimensions: { width: 1200, height: 600 },
  imageHasAlpha: true,
  imageAssetId: `image-${id}`,
  ...fields,
})
const LOGOS = {
  'image-mark': { file: 'a.png', src: '/m/a.png', w: 900, h: 300, aspect: 3, density: 0.3, cx: 0.5, cy: 0.5 },
  'image-twin': { twinOf: 'image-mark' },
  'image-held-logo': { hold: 'multi-colour' },
  'image-held-static': { hold: 'multi-colour' },
}
const build = (assets) => buildDirectoryTiles({ assets, worlds: [], clients: [], logos: LOGOS })
const ids = (tiles) => tiles.map((t) => t._id)

test('a logo in the set is a logo tile: its baked mark and numbers, contain, no file of its own shown', () => {
  const [t] = build([asset('mark')])
  assert.deepEqual(t.logo, { src: '/m/a.png', w: 900, h: 300, aspect: 3, density: 0.3, cx: 0.5, cy: 0.5 })
  assert.equal(t.fit, 'contain')
  assert.deepEqual(t.services, ['logo-design'], 'it keeps its tags, so the filter finds it')
})

test('a twin of a mark, a held `logo` and a held still tagged logo-design stay out; a held still with no logo tag and a logo outside the set stay as tiles', () => {
  const tiles = build([
    asset('mark'),
    asset('twin'),
    asset('held-logo'),
    asset('held-tagged', { mediaType: 'static_16x9', imageAssetId: 'image-held-static' }),
    asset('held-static', { mediaType: 'static_16x9', services: [{ name: 'Branding', slug: 'branding' }] }),
    asset('new-upload', { imageAssetId: 'image-new' }),
  ])
  assert.deepEqual(ids(tiles), ['mark', 'held-static', 'new-upload'])
  assert.ok(tiles[0].logo)
  assert.equal(tiles[1].logo, undefined)
  assert.equal(tiles[2].logo, undefined)
})

test('with no logo set the directory builds as it always did', () => {
  const tiles = buildDirectoryTiles({ assets: [asset('mark'), asset('twin')], worlds: [], clients: [] })
  assert.deepEqual(ids(tiles), ['mark', 'twin'])
  assert.ok(tiles.every((t) => !t.logo))
})

// ── the baked set ────────────────────────────────────────────────────────────
test('the manifest and the baked files agree: every mark has its file, no file is orphaned, every twin has a mark', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/directory-logos.json'), 'utf8'))
  const dir = join(ROOT, 'src/data/directory-logos')
  const files = new Set(readdirSync(dir).filter((f) => f.endsWith('.png')))
  const used = new Set()
  for (const [id, m] of Object.entries(manifest)) {
    if (m.file) {
      used.add(m.file)
      assert.ok(existsSync(join(dir, m.file)), `${id}: ${m.file} exists`)
      assert.ok(m.aspect > 0 && m.density > 0 && m.density <= 1, `${id}: numbers`)
      assert.ok(m.cx >= 0 && m.cx <= 1 && m.cy >= 0 && m.cy <= 1, `${id}: centre of mass inside the box`)
    }
    if (m.twinOf) assert.ok(manifest[m.twinOf]?.file, `${id}: twin of a real mark`)
    assert.ok(Boolean(m.file) + Boolean(m.hold) + Boolean(m.twinOf) >= 1, `${id}: a verdict`)
  }
  for (const f of files) assert.ok(used.has(f), `${f} is in the manifest`)
})
