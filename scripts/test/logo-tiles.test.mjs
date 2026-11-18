// The Project Directory's logo tiles: a white mark on black in a square or a
// landscape canvas (logoTile.js), which assets become one (buildDirectoryTiles
// with the prep manifest), and the baked set itself (src/data).
//   node --test scripts/test/logo-tiles.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  DENSITY_REF,
  INK,
  LOGO_DIALS,
  assetIdOfUrl,
  canvasOf,
  detailLogo,
  logoLayout,
  placeOriginal,
} from '../../src/components/work/directory/logoTile.js'
import { buildDirectoryTiles } from '../../src/components/work/directory/buildDirectoryTiles.js'
import { ratioOf } from '../../src/components/work/detail/buildContentFlow.js'
import { classifyTile } from '../../src/components/work/detail/flushGrid.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ── the layout ───────────────────────────────────────────────────────────────
const mark = (aspect, density = 0.3, cx = 0.5, cy = 0.5) => ({ aspect, density, cx, cy })

// The ink a layout gives a mark, in square cells (a canvas is 1 tall, `ratio` wide).
const inkOf = (lay, density) => ((lay.width / 100) * lay.ratio * (lay.height / 100)) * density
// The box a layout gives a mark, in square cells.
const boxOf = (lay) => (lay.width / 100) * lay.ratio * (lay.height / 100)
// The 11-13 law (the ink evened out), which ?dirlogoink=1 brings back.
const OLD = { ink: 1, ratioPow: 0.5, pad: 0.13 } // the 11-13 law, at SQ-81's pad
/** The first pass of the box law (11-18): the dials the references were calibrated at. */
const FIRST = { ink: 0, ratioPow: 0.5, pad: 0.13, size: 0.5 }

test('the canvas follows the balanced size, not the raw aspect: a mark takes a square when its balanced box fits one', () => {
  // the 11-13 law: the same 2:1 shape, a dense mark balances small and fits a square, a thin one needs the landscape
  assert.equal(canvasOf(mark(2, 0.8), OLD), 'square')
  assert.equal(canvasOf(mark(2, 0.2), OLD), 'landscape')
  // the P icon (1.68:1) and Sidney Charles (2.12:1), wide by aspect, were square at their balanced size
  assert.equal(canvasOf(mark(1.68, 0.48), OLD), 'square')
  assert.equal(canvasOf(mark(2.12, 0.43), OLD), 'square')
  // the box law (11-18): the shape decides, not the ink, and both now take landscapes
  assert.equal(canvasOf(mark(2, 0.8)), canvasOf(mark(2, 0.2)))
  assert.equal(canvasOf(mark(1.68, 0.48)), 'landscape')
  assert.equal(canvasOf(mark(2.12, 0.43)), 'landscape')
  // a thin wordmark is landscape however it is shaped, a square badge a square
  assert.equal(canvasOf(mark(8.8, 0.5)), 'landscape')
  assert.equal(canvasOf(mark(1, 0.25)), 'square')
  assert.equal(logoLayout(mark(3, 0.3)).ratio, 2)
  assert.equal(logoLayout(mark(1, 0.3)).ratio, 1)
})

test('the shrink dial: how much smaller than it wants a mark may go to take a square', () => {
  const near = mark(2.2, 0.35) // wants ~15% more width than a square's padded box
  assert.equal(canvasOf(near, { shrink: 0.3 }), 'square')
  assert.equal(canvasOf(near, { shrink: 0 }), 'landscape')
})

test('ink 1 is the 11-13 law: every mark gets the same ink, on a landscape canvas as on a square (the target is absolute, not a share of the canvas)', () => {
  assert.ok(Math.abs(LOGO_DIALS.size * DENSITY_REF - INK) < 1e-12, 'size × DENSITY_REF = INK')
  const marks = [mark(1, 0.3), mark(1.3, 0.5), mark(3, 0.3), mark(4.2, 0.33), mark(7, 0.74), mark(8.8, 0.5)]
  const canvases = new Set()
  for (const m of marks) {
    const lay = logoLayout(m, { weight: 1, ...OLD })
    canvases.add(lay.canvas)
    assert.ok(Math.abs(inkOf(lay, m.density) - INK) < 1e-9, `aspect ${m.aspect}: ink ${inkOf(lay, m.density)}`)
  }
  assert.equal(canvases.size, 2, 'the set covers both canvases')
  // a landscape mark's ink equals a square mark's of the same density
  const wide = logoLayout(mark(3, 0.3), { weight: 1, ...OLD })
  const sq = logoLayout(mark(1, 0.3), { weight: 1, ...OLD })
  assert.equal(wide.canvas, 'landscape')
  assert.equal(sq.canvas, 'square')
  assert.ok(Math.abs(inkOf(wide, 0.3) - inkOf(sq, 0.3)) < 1e-9)
})

test('the calibration: at the first pass the references (HHS, Cheetah Print) keep the boxes they had, within 5%; the default takes them a little smaller', () => {
  // The heights the references had before SQ-81, in cell units (the old law, default dials).
  const BEFORE = { 'heavy house society logo white': 0.74, 'Cheetah Print Primary Logo — Gold': 0.679 }
  const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/directory-logos.json'), 'utf8'))
  for (const [title, h0] of Object.entries(BEFORE)) {
    const m = Object.values(manifest).find((x) => x.file && x.title === title)
    assert.ok(m, `${title} is in the set`)
    const lay = logoLayout(m, FIRST)
    assert.equal(lay.canvas, 'square', `${title}: a square`)
    assert.ok(Math.abs(lay.height / 100 / h0 - 1) <= 0.05, `${title}: height ${lay.height / 100} vs ${h0}`)
    // Nathan's second pass (11-18): "the overall scale of the logos reduced just a bit"
    const now = logoLayout(m).height / lay.height
    assert.ok(now < 0.99 && now > 0.85, `${title}: ${now} of the first pass's height`)
  }
})

test('every baked mark balances to its box: size × aspect^(1 − 2·ratio), or held by its padded box; none above it', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/directory-logos.json'), 'utf8'))
  const inner = 1 - 2 * LOGO_DIALS.pad
  for (const m of Object.values(manifest).filter((x) => x.file && !x.twinOf)) {
    const lay = logoLayout(m)
    const box = boxOf(lay)
    const want = LOGO_DIALS.size * m.aspect ** (1 - 2 * LOGO_DIALS.ratioPow) // 0.5 = one box for all
    // before SQ-81 the ink spread was 0.108 to 0.494 (4.6×); under the 11-13 law the boxes ran 0.17 to 0.66 (3.9×)
    const held = lay.height / 100 >= inner - 1e-9 || ((lay.width / 100) * lay.ratio) >= lay.ratio - 2 * LOGO_DIALS.pad - 1e-9
    assert.ok(box <= want + 1e-9, `${m.title}: box ${box} is over the law's ${want}`)
    assert.ok(held || Math.abs(box - want) < 1e-9, `${m.title}: box ${box}, neither the law's ${want} nor held by its box`)
  }
})

test('the box law (Nathan 11-18): a mark\'s height follows its width ÷ height, not its ink', () => {
  const free = { pad: 0, size: 0.05, shrink: 0 } // no mark below is held by its canvas, at any ratio
  for (const [ratioPow, same] of [[0, (l) => l.height], [0.5, boxOf], [1, (l) => (l.width / 100) * l.ratio]]) {
    const v = [mark(1, 0.8), mark(1.5, 0.1), mark(3, 0.4), mark(4.8, 0.23)].map((m) => {
      const lay = logoLayout(m, { ...free, ratioPow })
      return ratioPow === 0 ? lay.height / 100 : same(lay)
    })
    for (const x of v) assert.ok(Math.abs(x - v[0]) < 1e-9, `ratio ${ratioPow}: ${v.join(', ')}`)
  }
  // ink 0: a solid badge and a thin script of one shape get one box
  assert.ok(Math.abs(boxOf(logoLayout(mark(1, 0.8))) - boxOf(logoLayout(mark(1, 0.2)))) < 1e-9)
})

test('the baked set: Sunday Brunch and RozálesD get one box (the 11-13 law gave RozálesD 2.8× the badge\'s)', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'src/data/directory-logos.json'), 'utf8'))
  const by = (t) => Object.values(manifest).find((x) => x.file && x.title.startsWith(t))
  const sb = by('SB Logo Single Stack White')
  const rd = by('RozálesD')
  assert.ok(sb && rd, 'both are in the set')
  assert.ok(boxOf(logoLayout(rd, OLD)) / boxOf(logoLayout(sb, OLD)) > 2.5, 'the old gap')
  assert.ok(Math.abs(boxOf(logoLayout(rd, { ratioPow: 0.5 })) / boxOf(logoLayout(sb, { ratioPow: 0.5 })) - 1) < 0.01, 'one box at ratio 0.5')
  // Nathan's second pass (11-18): the wider mark gives up a little box to the squarer one.
  const r = boxOf(logoLayout(rd)) / boxOf(logoLayout(sb))
  assert.ok(r < 0.95 && r > 0.6, `the wide mark a bit smaller at the default ratio: ${r}`)
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

test('weight 0 fills the padded box; at ink 1, weight 1 gives a dense badge less box than a thin script', () => {
  const fill = logoLayout(mark(1, 0.8), { weight: 0 })
  assert.ok(Math.abs(fill.height - (1 - 2 * LOGO_DIALS.pad) * 100) < 1e-9, 'fills the padded height')
  const dense = logoLayout(mark(1, 0.8), { weight: 1, ...OLD })
  const thin = logoLayout(mark(1, 0.2), { weight: 1, ...OLD })
  assert.ok(dense.height < thin.height, 'the dense mark is smaller')
  // at weight 1 the ink areas are equal wherever neither is capped by its box
  const a = logoLayout(mark(1, 0.7), { weight: 1, ...OLD })
  const b = logoLayout(mark(1.2, 0.6), { weight: 1, ...OLD })
  const ink = (lay, d) => d * lay.width * lay.height * lay.ratio
  assert.ok(Math.abs(ink(a, 0.7) - ink(b, 0.6)) / ink(a, 0.7) < 1e-9, 'equal ink area')
})

test('centre 1 moves the mark so its centre of mass lands on the canvas centre, 0 leaves the box centred', () => {
  // sized well under its box, so there is room to move
  const heavyRight = mark(1, 0.8, 0.6, 0.5)
  const box = logoLayout(heavyRight, { center: 0, weight: 1, pad: 0.1, size: 0.3 })
  assert.ok(Math.abs(box.left + box.width / 2 - 50) < 1e-9, 'box centred')
  const mass = logoLayout(heavyRight, { center: 1, weight: 1, pad: 0.1, size: 0.3 })
  assert.ok(mass.width < 80, 'smaller than its padded box')
  const massAt = mass.left + mass.width * 0.6 // in percent of the canvas's width
  assert.ok(Math.abs(massAt - 50) < 1e-9, 'mass centred')
  // a mark that fills its box has no room to move
  const tight = logoLayout(heavyRight, { center: 1, weight: 0 })
  assert.ok(Math.abs(tight.left + tight.width / 2 - 50) < 1e-9)
})

// ── the detail page: the same layout, the original placed by its ink ───────────
test('placeOriginal maps the file\'s trim rect onto the layout box (the ink lands where logoLayout put it)', () => {
  const box = { left: 20, top: 30, width: 50, height: 25 }
  const trim = [0.1, 0.2, 0.5, 0.4]
  const img = placeOriginal(box, trim)
  assert.ok(Math.abs(img.left + trim[0] * img.width - box.left) < 1e-9, 'ink left')
  assert.ok(Math.abs(img.top + trim[1] * img.height - box.top) < 1e-9, 'ink top')
  assert.ok(Math.abs(trim[2] * img.width - box.width) < 1e-9, 'ink width')
  assert.ok(Math.abs(trim[3] * img.height - box.height) < 1e-9, 'ink height')
  assert.deepEqual(placeOriginal(box, [0, 0, 1, 1]), box, 'an untrimmed file is its box')
})

test('a baked mark on the detail page takes the directory\'s canvas and box, and its file is placed by its ink', () => {
  const m = { file: 'a.png', aspect: 2.1, density: 0.43, cx: 0.5, cy: 0.5, trim: [0.05, 0.1, 0.9, 0.8] }
  const plan = detailLogo(m, { hasAlpha: true, own: 1 })
  const lay = logoLayout(m)
  assert.equal(plan.ratio, lay.ratio, 'one canvas rule, whatever tile shape the file had before')
  assert.equal(plan.ratio, 2, 'Sidney Charles-like: a landscape under the box law, not the square tile it had')
  assert.equal(detailLogo(m, { hasAlpha: true, own: 2 }, OLD).ratio, 1, 'and the dials reach it: a square under the 11-13 law')
  assert.deepEqual(plan.box, lay)
  assert.ok(Math.abs(plan.img.left + 0.05 * plan.img.width - lay.left) < 1e-9)
  assert.ok(Math.abs(0.8 * plan.img.height - lay.height) < 1e-9)
})

test('a held logo, an unbaked one and an opaque file get a padded contain at the same pad share, in their own tile shape', () => {
  for (const [mark_, hasAlpha] of [[{ hold: 'multi-colour' }, true], [undefined, true], [{ file: 'a.png', aspect: 1, density: 0.4, trim: [0, 0, 1, 1] }, false]]) {
    for (const own of [1, 2]) {
      const plan = detailLogo(mark_, { hasAlpha, own })
      assert.equal(plan.ratio, own, 'the tile keeps its shape')
      assert.equal(plan.img, undefined, 'no ink placement')
      const pad = LOGO_DIALS.pad
      assert.ok(Math.abs(plan.box.top - pad * 100) < 1e-9, 'a pad share of the height above')
      assert.ok(Math.abs(plan.box.height - (1 - 2 * pad) * 100) < 1e-9, 'and below')
      assert.ok(Math.abs(plan.box.left - (pad / own) * 100) < 1e-9, 'the same margin at the sides')
      assert.ok(Math.abs(plan.box.left * 2 + plan.box.width - 100) < 1e-9, 'centred')
    }
  }
  assert.equal(detailLogo(undefined, { hasAlpha: true, own: 1 }, { pad: 0.2 }).box.top, 20, 'the dial reaches the detail page')
})

test('assetIdOfUrl names the manifest key a Sanity CDN url belongs to', () => {
  const hash = '2589ad8cb2783129a03a510836da05f0e5c318a5'
  assert.equal(assetIdOfUrl(`https://cdn.sanity.io/images/b60h4u7o/production/${hash}-1506x689.png`), `image-${hash}-1506x689-png`)
  assert.equal(assetIdOfUrl(`https://cdn.sanity.io/images/b60h4u7o/production/${hash}-1506x689.svg?w=1400`), `image-${hash}-1506x689-svg`)
  assert.equal(assetIdOfUrl(undefined), null)
  assert.equal(assetIdOfUrl('https://example.com/logo.png'), null)
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
      // the trim: the ink's box in the original, whose size the id carries; it has the mark's aspect
      const [x, y, w, h] = m.trim
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.0001 && y + h <= 1.0001, `${id}: trim inside the file`)
      const [, ow, oh] = /-(\d+)x(\d+)-[a-z]+$/.exec(id)
      assert.ok(Math.abs((w * ow) / (h * oh) / m.aspect - 1) < 0.01, `${id}: trim aspect ${(w * ow) / (h * oh)} vs ${m.aspect}`)
    }
    if (m.twinOf) assert.ok(manifest[m.twinOf]?.file, `${id}: twin of a real mark`)
    assert.ok(Boolean(m.file) + Boolean(m.hold) + Boolean(m.twinOf) >= 1, `${id}: a verdict`)
  }
  for (const f of files) assert.ok(used.has(f), `${f} is in the manifest`)
})
