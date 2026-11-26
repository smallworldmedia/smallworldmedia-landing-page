// Set order (11-14, Nathan): on a detail page every set sits where its first
// member ranks in Studio. buildContentFlow gives each set `rank` and `at`,
// flushGrid's `seat` anchor pins the band there, and the page seats every set
// that way.
//   node --test scripts/test/set-order.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildContentFlow, HERO_SPLIT_AT } from '../../src/components/work/detail/buildContentFlow.js'
import { computeFlushGrid, splitAtBreaks } from '../../src/components/work/detail/flushGrid.js'
import { cropLoss } from '../../src/lib/mediaSequence.js'

const still = (id, mediaType = 'static_1x1', extra = {}) => ({
  _id: id,
  title: id,
  mediaType,
  imageUrl: `https://cdn.example.invalid/${id}.jpg`,
  imageDimensions: { width: 1000, height: 1000 },
  ...extra,
})
const clip = (id, extra = {}) => ({ _id: id, title: id, mediaType: 'motion_16x9', playbackId: `pb-${id}`, videoAspectRatio: '16:9', ...extra })
const flyer = (id, group) => still(id, 'static_4x5', { displayGroup: group, groupType: 'admat', imageDimensions: { width: 1080, height: 1350 } })
const slide = (id, group) => still(id, 'carousel-slide', { displayGroup: group, groupType: 'carousel' })
const cover = (id) => still(id, 'album-art')
const ids = (list) => list.map((a) => a._id)

/* ── buildContentFlow: rank and at ── */

test('a set carries its first member\'s rank and sits before the first tile ranked after it', () => {
  const assets = [
    clip('hero'),
    still('t1'), // rank 1 → showcase 0
    flyer('a1', 'tour-admats'), // rank 2: the set's first member
    still('t2'), // rank 3 → showcase 1
    still('t3'), // rank 4 → showcase 2
    flyer('a2', 'tour-admats'),
    slide('s1', 'rollout'), // rank 6
    still('t4'), // rank 7 → showcase 3
    slide('s2', 'rollout'),
  ]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(ids(flow.showcase), ['t1', 't2', 't3', 't4'])
  assert.deepEqual(flow.admats.map((s) => [s.group, s.rank, s.at]), [['tour-admats', 2, 1]])
  assert.deepEqual(flow.carousels.map((s) => [s.group, s.rank, s.at]), [['rollout', 6, 3]])
})

test('one member ranked higher up pushes the whole set up to it; a set ranked after every tile sits at the end', () => {
  const assets = [
    clip('hero'),
    still('t1'),
    flyer('late-1', 'late-admats'), // rank 2: the lone early member
    still('t2'),
    still('t3'),
    still('t4'),
    flyer('late-2', 'late-admats'), // the rest of the set, far below
    flyer('late-3', 'late-admats'),
    flyer('end-1', 'end-admats'),
    flyer('end-2', 'end-admats'),
  ]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  const by = Object.fromEntries(flow.admats.map((s) => [s.group, s]))
  assert.equal(by['late-admats'].rank, 2)
  assert.equal(by['late-admats'].at, 1, 'before t2, where its first member ranks')
  assert.equal(by['late-admats'].items.length, 3, 'the whole set moves')
  assert.equal(by['end-admats'].rank, 8)
  assert.equal(by['end-admats'].at, flow.showcase.length, 'no tile ranks after it')
})

test('the hero counts as a member: its set has rank 0 and leads the grid', () => {
  const assets = [
    flyer('hero-flyer', 'tour-admats'),
    still('t1'),
    still('t2'),
    still('t3'),
    flyer('a2', 'tour-admats'),
    flyer('a3', 'tour-admats'),
  ]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(flow.admats.map((s) => [s.group, s.rank, s.at]), [['tour-admats', 0, 0]])
  assert.deepEqual(ids(flow.admats[0].items), ['a2', 'a3'], 'the hero itself stays in the hero slot')
  // NC: a hero outside the set leaves it at its own first member
  const other = buildContentFlow([clip('hero'), ...assets.slice(1)], { surface: 'detail' })
  assert.deepEqual(other.admats.map((s) => [s.rank, s.at]), [[4, 3]])
})

test('the cover wall is a set too: albumArtSeat is its first cover\'s rank and seat, null under the gate', () => {
  const assets = [clip('hero'), still('t1'), still('t2'), cover('c1'), still('t3'), cover('c2'), cover('c3'), cover('c4'), still('t4')]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(ids(flow.albumArt), ['c1', 'c2', 'c3', 'c4'])
  assert.deepEqual(flow.albumArtSeat, { rank: 3, at: 2 })
  // three covers: no wall, they ride the showcase at their own ranks
  const few = buildContentFlow(assets.filter((a) => a._id !== 'c4'), { surface: 'detail' })
  assert.equal(few.albumArtSeat, null)
  assert.deepEqual(ids(few.showcase), ['t1', 't2', 'c1', 't3', 'c2', 'c3', 't4'])
})

test('a seat never parts a split hero\'s thirds or a split video\'s own', () => {
  const D = 46.722633
  const hero = clip('hero', { videoDuration: D, splitIntoThirds: true })
  const tiles = ['t1', 't2', 't3', 't4', 't5', 't6'].map((id) => still(id))
  // the set's first member ranks between t4 and t5, exactly where the hero's thirds land
  const assets = [hero, ...tiles.slice(0, 4), flyer('a1', 'x-admats'), flyer('a2', 'x-admats'), ...tiles.slice(4)]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(ids(flow.showcase).slice(HERO_SPLIT_AT, HERO_SPLIT_AT + 2), ['hero~2of3', 'hero~3of3'])
  assert.equal(flow.admats[0].rank, 5)
  assert.equal(flow.showcase[flow.admats[0].at]._id, 't5', 'after the hero\'s thirds, before the next ranked tile')

  // a split showcase video: a set ranked right after it sits after all three thirds
  const split = clip('v', { videoDuration: D, splitIntoThirds: true })
  const flow2 = buildContentFlow([clip('h'), still('t1'), split, flyer('b1', 'y-admats'), flyer('b2', 'y-admats'), still('t2')], { surface: 'detail' })
  assert.deepEqual(ids(flow2.showcase), ['t1', 'v~1of3', 'v~2of3', 'v~3of3', 't2'])
  assert.equal(flow2.admats[0].at, 4)
  // and one ranked right before it sits before the first third
  const flow3 = buildContentFlow([clip('h'), still('t1'), flyer('b1', 'y-admats'), flyer('b2', 'y-admats'), split, still('t2')], { surface: 'detail' })
  assert.equal(flow3.admats[0].at, 1)
})

test('every set lane carries a seat: decks, banners, visuals, live footage, mockups', () => {
  const page = (id, group) => still(id, 'brand-deck', { displayGroup: group, imageDimensions: { width: 1600, height: 900 } })
  const loop = (id, group, type) => clip(id, { displayGroup: group, groupType: type })
  const assets = [
    clip('hero'),
    page('d1', 'guidelines'), // rank 1
    still('t1'),
    loop('v1', 'loops', 'visuals'), // rank 3
    still('t2'),
    still('b1', 'static_other', { displayGroup: 'soundcloud-banners' }), // rank 5
    loop('f1', 'show', 'live-footage'), // rank 6
    still('t3'),
    still('m1', 'static_4x5', { displayGroup: 'billboards', groupType: 'mockups' }), // rank 8
    page('d2', 'guidelines'),
    loop('v2', 'loops', 'visuals'),
    still('b2', 'static_other', { displayGroup: 'soundcloud-banners' }),
    loop('f2', 'show', 'live-footage'),
    still('m2', 'static_4x5', { displayGroup: 'billboards', groupType: 'mockups' }),
  ]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(ids(flow.showcase), ['t1', 't2', 't3'])
  const seat = (sets) => sets.map((s) => [s.group, s.rank, s.at])
  assert.deepEqual(seat(flow.brandDecks), [['guidelines', 1, 0]])
  assert.deepEqual(seat(flow.visuals), [['loops', 3, 1]])
  assert.deepEqual(seat(flow.banners), [['soundcloud-banners', 5, 2]])
  assert.deepEqual(seat(flow.liveFootage), [['show', 6, 2]])
  assert.deepEqual(seat(flow.mockups), [['billboards', 8, 3]])
})

/* ── flushGrid: the seat anchor ── */

const rng = (seed) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const tile = (i, ratio) => ({ _id: `a${i}`, imageDimensions: { width: Math.round(1000 * ratio), height: 1000 } })
const RATIOS = [9 / 16, 4 / 5, 1, 1, 1, 4 / 3, 16 / 9, 2]
const seeded = (n, seed) => {
  const r = rng(seed)
  return Array.from({ length: n }, (_, i) => tile(i, RATIOS[Math.floor(r() * RATIOS.length)]))
}
const band = (id, at, rowSpan = 51, anchor = 'seat') => ({ id, colStart: 0, colSpan: Infinity, rowSpan, anchor, at })
const rowsOf = (out) => out.regions.map((r) => [r.id, r.rowStart, r.rowEnd])
const overlap = (a, b) => a.rowStart < b.rowEnd && b.rowStart < a.rowEnd

/** No tile over a band, no band over a band. */
function assertClear({ placements, regions }, where) {
  const bands = regions.filter((r) => r.anchor !== 'break')
  for (const r of bands) {
    for (const p of placements) assert.ok(!overlap(p, r), `${where}: a tile is over ${r.id}`)
    for (const q of bands) if (q !== r) assert.ok(!overlap(q, r), `${where}: ${q.id} is over ${r.id}`)
  }
}

test('a seat sits right below the tiles before `at`: none of them under it, and its top is the lowest of their ends', () => {
  let checked = 0
  for (const cols of [3, 5, 6]) {
    for (let seed = 1; seed <= 40; seed++) {
      const items = seeded(24, seed * 7 + cols)
      const regions = [band('carousel:a', 3, 43), band('orbit', 9), band('admat:b', 17, 60)]
      const out = computeFlushGrid(items, { cols, sqRows: 40, regions })
      assertClear(out, `cols ${cols} seed ${seed}`)
      let above = 0
      for (const r of regions) {
        const got = out.regions.find((x) => x.id === r.id)
        const before = out.placements.slice(0, r.at)
        for (const p of before) assert.ok(p.rowEnd <= got.rowStart, `cols ${cols} seed ${seed}: a tile ranked before ${r.id} is under it`)
        assert.equal(got.rowStart, Math.max(above, ...before.map((p) => p.rowEnd)), `cols ${cols} seed ${seed}: ${r.id}`)
        assert.equal(got.colSpan, cols)
        above = got.rowEnd
        checked++
      }
    }
  }
  assert.equal(checked, 360)
})

test('NC: the old mid-grid anchor ignores `at`: the same bands land together at the grid\'s middle', () => {
  const items = seeded(24, 11)
  const regions = [band('carousel:a', 3, 43), band('orbit', 9), band('admat:b', 17, 60)]
  const seat = computeFlushGrid(items, { cols: 5, sqRows: 40, regions })
  const mid = computeFlushGrid(items, { cols: 5, sqRows: 40, regions: regions.map((r) => ({ ...r, anchor: 'mid' })) })
  const at = (out, id) => out.regions.find((r) => r.id === id)
  // seated: tiles lie between the bands; mid: the three stack with nothing between
  assert.ok(at(seat, 'orbit').rowStart > at(seat, 'carousel:a').rowEnd)
  assert.ok(at(seat, 'admat:b').rowStart > at(seat, 'orbit').rowEnd)
  assert.equal(at(mid, 'orbit').rowStart, at(mid, 'carousel:a').rowEnd)
  assert.equal(at(mid, 'admat:b').rowStart, at(mid, 'orbit').rowEnd)
  const first3 = Math.max(...mid.placements.slice(0, 3).map((p) => p.rowEnd))
  assert.ok(at(mid, 'carousel:a').rowStart > first3, 'mid does not sit under the first three tiles')
})

test('`at` 0 is the top anchor and `at` past the last tile is the bottom anchor, placement for placement', () => {
  for (const cols of [3, 5]) {
    for (let seed = 1; seed <= 20; seed++) {
      const items = seeded(19, seed * 3 + cols)
      const top = computeFlushGrid(items, { cols, sqRows: 40, regions: [band('orbit', 0, 51, 'top')] })
      const seatTop = computeFlushGrid(items, { cols, sqRows: 40, regions: [band('orbit', 0)] })
      assert.deepEqual(seatTop.placements, top.placements)
      assert.deepEqual(rowsOf(seatTop), rowsOf(top))
      const bottom = computeFlushGrid(items, { cols, sqRows: 40, regions: [band('banner:x', 0, 38, 'bottom')] })
      for (const at of [items.length, items.length + 5, undefined]) {
        const seatEnd = computeFlushGrid(items, { cols, sqRows: 40, regions: [band('banner:x', at, 38)] })
        assert.deepEqual(seatEnd.placements, bottom.placements, `at ${at}`)
        assert.deepEqual(rowsOf(seatEnd), rowsOf(bottom), `at ${at}`)
      }
    }
  }
})

test('seats with one `at` stack in the order given; a later `at` never sits above an earlier one', () => {
  const items = seeded(20, 5)
  const out = computeFlushGrid(items, { cols: 5, sqRows: 40, regions: [band('first', 6, 30), band('second', 6, 45), band('late', 12), band('early', 2, 20)] })
  const at = (id) => out.regions.find((r) => r.id === id)
  assert.equal(at('second').rowStart, at('first').rowEnd, 'stacked, first on top')
  assert.ok(at('early').rowEnd <= at('first').rowStart)
  assert.ok(at('late').rowStart >= at('second').rowEnd)
  assert.deepEqual(out.regions.filter((r) => r.anchor === 'seat').map((r) => r.id), ['early', 'first', 'second', 'late'], 'returned in seat order')
  assertClear(out, 'stack')
})

test('with description bands: no cut runs through a seat, earlier tiles stay above it, and the DOM puts it before the tiles below', () => {
  for (const cols of [3, 5, 6]) {
    for (let seed = 1; seed <= 25; seed++) {
      const items = seeded(30, seed * 13 + cols)
      const regions = [band('orbit', 4), band('carousel:a', 15, 43), band('banner:x', 30, 38)]
      const out = computeFlushGrid(items, { cols, sqRows: 40, regions, breaks: 3, breakEvery: 2 })
      const where = `cols ${cols} seed ${seed}`
      assertClear(out, where)
      const cuts = out.regions.filter((r) => r.anchor === 'break')
      assert.equal(cuts.length, 3, where)
      for (const r of regions) {
        const got = out.regions.find((x) => x.id === r.id)
        for (const c of cuts) assert.ok(!(got.rowStart < c.rowStart && c.rowStart < got.rowEnd), `${where}: a cut runs through ${r.id}`)
        for (const p of out.placements.slice(0, r.at)) assert.ok(p.rowEnd <= got.rowStart, `${where}: a tile ranked before ${r.id} is under it`)
      }
      // Each seat renders in exactly one segment. In the DOM (the reading order
      // on a phone) it comes after every tile ranked before `at`, in its own
      // segment and in the ones above, and before the first tile below it. A
      // later tile that back-filled a hole above it may read after it.
      const segments = splitAtBreaks(out)
      for (const r of regions) {
        const k = segments.findIndex((seg) => seg.sockets.some((s) => s.id === r.id))
        assert.equal(segments.filter((seg) => seg.sockets.some((s) => s.id === r.id)).length, 1, `${where}: ${r.id} in one segment`)
        const sock = segments[k].sockets.find((s) => s.id === r.id)
        segments[k].tiles.forEach((t, i) => {
          if (i < sock.domIndex) assert.ok(t.rowStart < sock.rowStart, `${where}: a tile before ${r.id} in the DOM starts under it`)
          if (t.index < r.at) assert.ok(i < sock.domIndex, `${where}: a tile ranked before ${r.id} reads after it`)
        })
        if (sock.domIndex < segments[k].tiles.length) assert.ok(segments[k].tiles[sock.domIndex].rowStart >= sock.rowStart, where)
        for (const later of segments.slice(k + 1)) {
          for (const t of later.tiles) assert.ok(t.index >= r.at, `${where}: a tile ranked before ${r.id} is in a segment below it`)
        }
      }
    }
  }
})

/* ── the row above a band ── */

// A band sits under the row of the tiles ranked before it, and later tiles
// complete that row. The Hurry Up Slowly shape (11-14): three 4x5 pieces from
// the page's end crop least as one square cell, so the SQ-82 search demoted
// them, and as squares they fitted the holes above the cover wall, the mockups
// and the banners: tiles 10-12 read before tiles 6-9 and before every set.
const HUS = [9 / 16, 9 / 16, 9 / 16, 1, 4 / 5, 4 / 5, 3 / 4, 3 / 4, 3 / 4, 3 / 4, 4 / 5, 4 / 5, 4 / 5, 9 / 16]
const husTiles = () => HUS.map((r, i) => tile(i, r))
const husBands = () => [band('orbit', 6, 51), band('mockups', 6, 107), band('banner', 10, 38)]
const aboveBand = (out, id) => {
  const r = out.regions.find((x) => x.id === id)
  return out.placements.map((p, i) => (p.rowStart < r.rowStart ? i : -1)).filter((i) => i >= 0)
}
const demoted = (out) => out.placements.map((p, i) => (p.type === 'square' && HUS[i] !== 1 ? i : -1)).filter((i) => i >= 0)

test('the row above a band fills from the tiles right after it, not from the page\'s end', () => {
  const out = computeFlushGrid(husTiles(), { cols: 5, sqRows: 24, regions: husBands() })
  assertClear(out, 'hus')
  assert.deepEqual(aboveBand(out, 'orbit'), [0, 1, 2, 3, 4, 5, 6, 7, 8], 'the six tiles before the wall, then the next three')
  for (const id of ['orbit', 'mockups', 'banner']) {
    const got = aboveBand(out, id)
    assert.deepEqual(got, got.map((_, k) => k), `${id}: the tiles above it are the page's first ${got.length}, none skipped`)
  }
  assert.ok(demoted(out).every((i) => i < 10), 'no piece from the page\'s end is cut to a square')
})

test('NC: crop alone picks the page\'s end, and with no seat the search is as it was', () => {
  // The three 4x5 pieces at the end crop less as squares than the pieces by
  // the wall, so the crop cost on its own still chooses them (the old result).
  const sq = (i) => cropLoss(HUS[i], 1)
  assert.ok(sq(10) + sq(11) + sq(12) < sq(4) + sq(7) + sq(8) - 1e-9)
  // No seat: nothing is pulled, so the same tiles lay out with no demotion,
  // and a band on a legacy anchor does not count as a seat either.
  assert.deepEqual(demoted(computeFlushGrid(husTiles(), { cols: 5, sqRows: 24 })), [])
  const legacy = computeFlushGrid(husTiles(), { cols: 5, sqRows: 24, regions: [band('orbit', 6, 51, 'top'), band('banner', 10, 38, 'bottom')] })
  const again = computeFlushGrid(husTiles(), { cols: 5, sqRows: 24, regions: [band('orbit', undefined, 51, 'top'), band('banner', undefined, 38, 'bottom')] })
  assert.deepEqual(legacy.placements, again.placements, 'a legacy anchor ignores `at`')
})

/* ── a split video's tiles and a band ── */

// The HHS 2024-25 shape (11-14): the cover wall seats after three tiles; of
// the hero's two spliced thirds, one fitted a hole above the wall and the
// other landed under it.
const third = (of, k, n) => ({ ...tile(`${of}${k}`, 2), _id: `${of}~${k}of${n}`, chunk: { of, index: k - 1, count: n } })
const sideOfBand = (out, id, i) => (out.placements[i].rowStart < out.regions.find((r) => r.id === id).rowStart ? 'above' : 'below')

test('a band never parts a split video\'s tiles: they sit together on one side of it', () => {
  const items = [tile(0, 9 / 16), tile(1, 1), tile(2, 2), tile(3, 9 / 16), third('v', 2, 3), third('v', 3, 3), tile(6, 1), tile(7, 1), tile(8, 2), tile(9, 1)]
  const out = computeFlushGrid(items, { cols: 5, sqRows: 24, regions: [band('orbit', 3, 51)] })
  assertClear(out, 'thirds')
  assert.equal(sideOfBand(out, 'orbit', 4), sideOfBand(out, 'orbit', 5), 'both thirds on one side')

  // NC: the same two tiles with no `chunk` mark are ordinary tiles, and dense
  // placement parts them: one above the wall, one under it.
  const plain = items.map(({ chunk, ...rest }) => rest)
  const loose = computeFlushGrid(plain, { cols: 5, sqRows: 24, regions: [band('orbit', 3, 51)] })
  assert.deepEqual([sideOfBand(loose, 'orbit', 4), sideOfBand(loose, 'orbit', 5)], ['above', 'below'])

  // With no seat the mark changes nothing: placement for placement the same.
  assert.deepEqual(computeFlushGrid(items, { cols: 5, sqRows: 24 }).placements, computeFlushGrid(plain, { cols: 5, sqRows: 24 }).placements)
  const top = [band('orbit', undefined, 51, 'top')]
  assert.deepEqual(computeFlushGrid(items, { cols: 5, sqRows: 24, regions: top }).placements, computeFlushGrid(plain, { cols: 5, sqRows: 24, regions: top }).placements)
})

test('seeded: with seats, every run of split tiles is on one side of every band, and no earlier tile drops under a band', () => {
  let runs = 0
  for (const cols of [3, 5, 6]) {
    for (let seed = 1; seed <= 40; seed++) {
      const items = seeded(24, seed * 5 + cols)
      for (const at of [6, 14]) items.splice(at, 3, third(`v${at}`, 1, 3), third(`v${at}`, 2, 3), third(`v${at}`, 3, 3))
      const regions = [band('carousel:a', 3, 43), band('orbit', 9), band('admat:b', 17, 60)]
      const out = computeFlushGrid(items, { cols, sqRows: 40, regions })
      const where = `cols ${cols} seed ${seed}`
      assertClear(out, where)
      for (const r of regions) {
        for (const at of [6, 14]) {
          const sides = new Set([at, at + 1, at + 2].map((i) => sideOfBand(out, r.id, i)))
          assert.equal(sides.size, 1, `${where}: ${r.id} parts the split video at ${at}`)
          runs++
        }
        const got = out.regions.find((x) => x.id === r.id)
        for (const p of out.placements.slice(0, r.at)) assert.ok(p.rowEnd <= got.rowStart, `${where}: a tile ranked before ${r.id} is under it`)
      }
    }
  }
  assert.equal(runs, 720)
})

/* ── the page ── */

test('FeaturedProjectDetail seats every set: no type-chosen anchor is left, and the regions go in rank order', () => {
  const src = readFileSync(new URL('../../src/components/work/detail/FeaturedProjectDetail.jsx', import.meta.url), 'utf8')
  assert.match(src, /anchor: 'seat', at \}/)
  assert.doesNotMatch(src, /anchor: '(top|mid|bottom)'/)
  assert.doesNotMatch(src, /anchor: \w+ [=?]/) // no computed anchor either
  assert.match(src, /const regions = seats\.sort\(\(x, y\) => x\.rank - y\.rank\)\.map\(\(x\) => x\.region\)/)
  for (const id of ["'orbit'", '`admat:', '`visuals:', '`mockups:', '`footage:', "'deck'", '`carousel:', '`deck-solo:', '`banner:']) {
    assert.ok(src.includes(`seat(${id}`), `${id} is seated`)
  }
})
