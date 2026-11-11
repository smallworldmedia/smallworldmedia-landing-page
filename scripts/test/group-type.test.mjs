// Group types (11-10): which surfaces open a set's viewer. groupTypeOf, the
// surface table, assetLane per surface, and buildContentFlow's buckets.
//   node --test scripts/test/group-type.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  GROUP_TYPES,
  GROUP_SURFACES,
  groupTypeOf,
  opensOn,
  assetLane,
  buildContentFlow,
} from '../../src/components/work/detail/buildContentFlow.js'

const still = (id, mediaType, extra = {}) => ({
  _id: id,
  title: id,
  mediaType,
  imageUrl: `https://cdn.example.invalid/${id}.jpg`,
  imageDimensions: { width: 1200, height: 1500 },
  ...extra,
})
const clip = (id, mediaType, extra = {}) => ({ _id: id, title: id, mediaType, playbackId: `pb-${id}`, videoAspectRatio: '4:5', ...extra })
const ids = (list) => list.map((a) => a._id)
const SURFACES = ['globe', 'work', 'detail', 'directory']

test('groupTypeOf infers the type for a document with no groupType (pre-11-10)', () => {
  assert.equal(groupTypeOf(still('c', 'album-art')), 'album-art')
  assert.equal(groupTypeOf(still('p', 'brand-deck', { displayGroup: 'guidelines' })), 'deck')
  assert.equal(groupTypeOf(still('p', 'brand-deck')), 'deck')
  assert.equal(groupTypeOf(still('a', 'brand-deck', { displayGroup: 'jamback-jampacked-world-tour-2026-admats' })), 'admat')
  assert.equal(groupTypeOf(still('a', 'brand-deck', { displayGroup: 'admat' })), 'admat')
  assert.equal(groupTypeOf(still('a', 'brand-deck', { displayGroup: 'Rossi-Admats' })), 'admat')
  assert.equal(groupTypeOf(still('a', 'brand-deck', { displayGroup: 'admats-archive' })), 'deck') // NC: the suffix, not a substring
  assert.equal(groupTypeOf(still('s', 'carousel-slide', { displayGroup: 'womens-day-carousel' })), 'carousel')
  assert.equal(groupTypeOf(still('b', 'static_other', { displayGroup: 'soundcloud-banners' })), 'banner')
  assert.equal(groupTypeOf(still('b', 'static_other', { displayGroup: 'banner' })), 'banner')
  assert.equal(groupTypeOf(still('x', 'static_4x5')), null)
  assert.equal(groupTypeOf(still('x', 'static_4x5', { displayGroup: 'shots' })), null)
  assert.equal(groupTypeOf(clip('m', 'motion_9x16')), null)
})

test('groupType beats the inference; an unknown value falls back to it', () => {
  assert.equal(groupTypeOf(still('p', 'brand-deck', { displayGroup: 'guidelines', groupType: 'admat' })), 'admat')
  assert.equal(groupTypeOf(still('a', 'brand-deck', { displayGroup: 'x-admats', groupType: 'deck' })), 'deck')
  assert.equal(groupTypeOf(still('c', 'static_1x1', { groupType: 'album-art' })), 'album-art')
  assert.equal(groupTypeOf(still('c', 'static_4x5', { groupType: 'carousel' })), 'carousel')
  for (const bad of ['poster', '', null, undefined, 7]) {
    assert.equal(groupTypeOf(still('p', 'brand-deck', { displayGroup: 'guidelines', groupType: bad })), 'deck', `groupType ${String(bad)}`)
    assert.equal(groupTypeOf(still('x', 'static_4x5', { groupType: bad })), null, `groupType ${String(bad)}`)
  }
})

test('opensOn matches the table for all 20 (type, surface) pairs', () => {
  const expected = {
    'album-art': { globe: true, work: true, detail: true, directory: true },
    deck: { globe: false, work: true, detail: true, directory: true },
    banner: { globe: false, work: false, detail: true, directory: true },
    admat: { globe: true, work: false, detail: true, directory: true },
    carousel: { globe: false, work: true, detail: true, directory: true },
  }
  assert.deepEqual([...GROUP_TYPES].sort(), Object.keys(expected).sort())
  assert.deepEqual(Object.keys(GROUP_SURFACES).sort(), Object.keys(expected).sort())
  let pairs = 0
  for (const type of GROUP_TYPES) {
    for (const surface of SURFACES) {
      assert.equal(opensOn(still('x', 'static_4x5', { groupType: type }), surface), expected[type][surface], `${type} on ${surface}`)
      pairs++
    }
  }
  assert.equal(pairs, 20)
  assert.equal(opensOn(still('x', 'static_4x5'), 'detail'), false) // an ungrouped piece opens no viewer
  assert.equal(opensOn(still('x', 'static_4x5', { groupType: 'deck' }), 'sheet'), false) // an unknown surface opens nothing
})

test('assetLane with a surface applies the table', () => {
  const admat = still('ad', 'brand-deck', { displayGroup: 'jamback-world-tour-2026-admats' })
  assert.deepEqual(SURFACES.map((s) => assetLane(admat, s)), ['admat', null, 'admat', 'admat'])
  const motionAdmat = clip('ad-m', 'motion_4x5', { groupType: 'admat', displayGroup: 'jamback-world-tour-2026-admats' })
  // SQ-52: an animated flyer is a member of its set's wall on the project page only.
  assert.deepEqual(SURFACES.map((s) => assetLane(motionAdmat, s)), ['showcase', null, 'admat', 'showcase'])
  assert.equal(assetLane({ ...motionAdmat, contentRole: 'process' }, 'globe'), 'role')
  assert.equal(assetLane({ ...motionAdmat, contentRole: 'process' }, 'directory'), 'role')
  assert.equal(assetLane({ ...motionAdmat, contentRole: 'process' }, 'detail'), 'admat') // the type outranks the role on the page that plays it

  const deck = still('d', 'brand-deck', { displayGroup: 'guidelines' })
  assert.deepEqual(SURFACES.map((s) => assetLane(deck, s)), [null, 'deck', 'deck', 'deck'])
  const banner = still('b', 'static_other', { displayGroup: 'soundcloud-banners' })
  assert.deepEqual(SURFACES.map((s) => assetLane(banner, s)), [null, null, 'banner', 'banner'])
  const carousel = still('s', 'carousel-slide', { displayGroup: 'womens-day-carousel' })
  assert.deepEqual(SURFACES.map((s) => assetLane(carousel, s)), [null, 'carousel', 'carousel', 'carousel'])
  const cover = still('c', 'album-art')
  assert.deepEqual(SURFACES.map((s) => assetLane(cover, s)), ['album-art', 'album-art', 'album-art', 'album-art'])

  // A -sequence still is a sequence on every surface, whatever its type.
  const seq = still('q', 'brand-deck', { displayGroup: 'logo-sequence', groupType: 'deck' })
  assert.deepEqual(SURFACES.map((s) => assetLane(seq, s)), ['sequence', 'sequence', 'sequence', 'sequence'])
  assert.equal(assetLane(seq), 'sequence')

  // An empty shell rides nothing; an ungrouped piece keeps role / showcase.
  const shell = { _id: 'shell', mediaType: 'brand-deck', groupType: 'deck' }
  assert.deepEqual([...SURFACES, undefined].map((s) => assetLane(shell, s)), [null, null, null, null, null])
  assert.deepEqual(SURFACES.map((s) => assetLane(still('x', 'static_4x5'), s)), ['showcase', 'showcase', 'showcase', 'showcase'])
  assert.deepEqual(SURFACES.map((s) => assetLane(still('x', 'static_4x5', { contentRole: 'process' }), s)), ['role', 'role', 'role', 'role'])
})

test('assetLane with no surface keeps the legacy chain and ignores groupType', () => {
  assert.equal(assetLane(still('ad', 'brand-deck', { displayGroup: 'x-admats' })), 'deck')
  assert.equal(assetLane(still('p', 'brand-deck', { displayGroup: 'guidelines', groupType: 'admat' })), 'deck')
  assert.equal(assetLane(still('c', 'static_1x1', { groupType: 'album-art' })), 'showcase')
  assert.equal(assetLane(still('s', 'carousel-slide')), 'carousel')
  assert.equal(assetLane(still('b', 'static_other', { displayGroup: 'x-banners' })), 'banner')
  assert.equal(assetLane(still('r', 'static_4x5', { contentRole: 'process' })), 'role')
})

// A page with every lane. Jamback-style admats carry no groupType (pre-11-10).
const mixed = () => [
  clip('hero', 'featured-project-reel'),
  still('shot-a', 'static_4x5'),
  still('cover-1', 'album-art'),
  clip('reel-a', 'motion_9x16'),
  still('cover-2', 'album-art'),
  still('deck-p2', 'brand-deck', { displayGroup: 'guidelines', brandDeckOrder: 2 }),
  still('deck-p1', 'brand-deck', { displayGroup: 'guidelines', brandDeckOrder: 1 }),
  still('cover-3', 'album-art'),
  still('ban-1', 'static_other', { displayGroup: 'soundcloud-banners' }),
  still('ban-2', 'static_other', { displayGroup: 'soundcloud-banners' }),
  still('seq-1', 'static_16x9', { displayGroup: 'logo-sequence' }),
  still('seq-2', 'static_16x9', { displayGroup: 'logo-sequence' }),
  still('cover-4', 'album-art'),
  still('bts-1', 'static_4x5', { contentRole: 'process' }),
  still('ad-3', 'brand-deck', { displayGroup: 'jamback-world-tour-2026-admats', brandDeckOrder: 3 }),
  still('ad-1', 'brand-deck', { displayGroup: 'jamback-world-tour-2026-admats', brandDeckOrder: 1 }),
  still('ad-2', 'brand-deck', { displayGroup: 'jamback-world-tour-2026-admats', brandDeckOrder: 2 }),
  still('slide-b1', 'carousel-slide', { displayGroup: 'b-carousel' }),
  still('slide-a1', 'carousel-slide', { displayGroup: 'a-carousel' }),
  still('slide-b2', 'carousel-slide', { displayGroup: 'b-carousel' }),
  { _id: 'shell', title: 'shell', mediaType: 'static_4x5' },
  clip('reel-b', 'motion_16x9'),
]

test('NEGATIVE CONTROL buildContentFlow with no surface keeps the legacy output', () => {
  // Captured from the pre-11-10 function on this fixture, before the change.
  const legacy = {
    showcase: ['shot-a', 'reel-a', 'sequence:logo-sequence', 'reel-b'],
    albumArt: ['cover-1', 'cover-2', 'cover-3', 'cover-4'],
    brandDecks: [
      { group: 'guidelines', pages: ['deck-p1', 'deck-p2'] },
      { group: 'jamback-world-tour-2026-admats', pages: ['ad-1', 'ad-2', 'ad-3'] }, // an admat page is a deck page
    ],
    banners: [{ group: 'soundcloud-banners', items: ['ban-1', 'ban-2'] }],
    bts: ['bts-1'],
  }
  const flow = buildContentFlow(mixed())
  assert.deepEqual(Object.keys(flow), ['showcase', 'albumArt', 'brandDecks', 'carousels', 'banners', 'admats', 'bts'])
  assert.deepEqual(ids(flow.showcase), legacy.showcase)
  assert.deepEqual(ids(flow.albumArt), legacy.albumArt)
  assert.deepEqual(flow.brandDecks.map((d) => ({ group: d.group, pages: ids(d.pages) })), legacy.brandDecks)
  assert.deepEqual(flow.banners.map((b) => ({ group: b.group, items: ids(b.items) })), legacy.banners)
  assert.deepEqual(ids(flow.bts), legacy.bts)
  // The documented changes: carousels grouped (was a flat, alphabetised list) and an empty admats bucket.
  assert.deepEqual(flow.carousels.map((c) => ({ group: c.group, pages: ids(c.pages) })), [
    { group: 'b-carousel', pages: ['slide-b1', 'slide-b2'] },
    { group: 'a-carousel', pages: ['slide-a1'] },
  ])
  assert.deepEqual(flow.admats, [])
  // A surface that opens everything on this page (no admat, no deck/banner dropped) matches it too.
  const withSurface = buildContentFlow(mixed().filter((a) => !a.displayGroup?.endsWith('admats')), { surface: 'detail' })
  assert.deepEqual(ids(withSurface.showcase), legacy.showcase)
  assert.deepEqual(ids(withSurface.albumArt), legacy.albumArt)
})

test("buildContentFlow(surface 'detail'): admats group by displayGroup in brandDeckOrder, out of decks and showcase", () => {
  const pages = Array.from({ length: 16 }, (_, k) => 16 - k) // incoming orderRank order is the reverse of brandDeckOrder
  const assets = [
    clip('hero', 'featured-project-reel'),
    still('deck-p1', 'brand-deck', { displayGroup: 'guidelines', brandDeckOrder: 1 }),
    ...pages.map((n) => still(`flyer-${n}`, 'brand-deck', { displayGroup: 'jamback-jampacked-world-tour-2026-admats', brandDeckOrder: n })),
  ]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.equal(flow.admats.length, 1)
  assert.equal(flow.admats[0].group, 'jamback-jampacked-world-tour-2026-admats')
  assert.deepEqual(ids(flow.admats[0].items), Array.from({ length: 16 }, (_, k) => `flyer-${k + 1}`))
  assert.deepEqual(flow.brandDecks.map((d) => d.group), ['guidelines']) // the admat set is not a deck
  assert.ok(!flow.showcase.some((a) => a._id.startsWith('flyer-')))

  // Ties keep incoming orderRank order; groups order by first appearance; a typed set needs no `-admats` name.
  const tied = buildContentFlow(
    [
      clip('hero', 'featured-project-reel'),
      still('z-1', 'static_4x5', { groupType: 'admat', displayGroup: 'zeta', brandDeckOrder: 0 }),
      still('a-1', 'static_4x5', { groupType: 'admat', displayGroup: 'alpha' }),
      still('z-2', 'static_4x5', { groupType: 'admat', displayGroup: 'zeta' }),
      still('a-2', 'static_4x5', { groupType: 'admat', displayGroup: 'alpha' }),
      still('n-1', 'static_4x5', { groupType: 'admat', displayGroup: 'nogroup-set' }),
      still('n-2', 'static_4x5', { groupType: 'admat' }), // no displayGroup: the 'admat' bucket
      still('n-3', 'static_4x5', { groupType: 'admat' }),
    ],
    { surface: 'detail' }
  )
  assert.deepEqual(tied.admats.map((s) => [s.group, ids(s.items)]), [['zeta', ['z-1', 'z-2']], ['alpha', ['a-1', 'a-2']], ['admat', ['n-2', 'n-3']]])
  assert.deepEqual(ids(tied.showcase), ['n-1']) // a set of one is a showcase tile
})

test('an admat set of one rides the showcase at its orderRank place; a motion member keeps its own tile off the page', () => {
  const assets = [
    clip('hero', 'featured-project-reel'),
    still('shot-a', 'static_4x5'),
    still('lone', 'brand-deck', { displayGroup: 'rossi-admats' }),
    still('shot-b', 'static_4x5'),
    clip('flyer-motion', 'motion_4x5', { groupType: 'admat', displayGroup: 'rossi-admats' }),
    still('shot-c', 'static_4x5'),
  ]
  for (const surface of ['globe', 'directory']) {
    const flow = buildContentFlow(assets, { surface })
    assert.deepEqual(flow.admats, [], surface) // the still member is alone: the clip is not a member
    assert.deepEqual(ids(flow.showcase), ['shot-a', 'lone', 'shot-b', 'flyer-motion', 'shot-c'], surface)
  }
  const work = buildContentFlow(assets, { surface: 'work' })
  assert.deepEqual(ids(work.showcase), ['shot-a', 'shot-b', 'shot-c']) // admats are not on /work
  assert.deepEqual(work.admats, [])
})

test("buildContentFlow(surface 'detail'): an animated flyer joins its set's wall in brandDeckOrder; a lone one rides the showcase", () => {
  const assets = [
    clip('hero', 'featured-project-reel'),
    still('shot-a', 'static_4x5'),
    still('still-3', 'brand-deck', { displayGroup: 'hhs-admats', brandDeckOrder: 3 }),
    clip('motion-1', 'motion_4x5', { groupType: 'admat', displayGroup: 'hhs-admats', brandDeckOrder: 1 }),
    clip('motion-2', 'motion_4x5', { groupType: 'admat', displayGroup: 'hhs-admats', brandDeckOrder: 2 }),
    clip('solo-motion', 'motion_4x5', { groupType: 'admat', displayGroup: 'sc-admats' }),
    still('shot-b', 'static_4x5'),
  ]
  const detail = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(detail.admats.map((s) => [s.group, ids(s.items)]), [['hhs-admats', ['motion-1', 'motion-2', 'still-3']]])
  assert.deepEqual(ids(detail.showcase), ['shot-a', 'solo-motion', 'shot-b']) // a set of one is a showcase tile, played by its own slot
  assert.deepEqual(detail.brandDecks, [])
  // NC: the same page on the globe and the directory keeps each animated flyer its own tile; only the stills are a set.
  for (const surface of ['globe', 'directory']) {
    const flow = buildContentFlow(assets, { surface })
    assert.deepEqual(flow.admats, [], surface)
    assert.deepEqual(ids(flow.showcase), ['shot-a', 'still-3', 'motion-1', 'motion-2', 'solo-motion', 'shot-b'], surface)
  }
})

test("buildContentFlow(surface 'detail'): carousels group like decks; /work and detail open them, the globe does not", () => {
  const assets = [
    clip('hero', 'featured-project-reel'),
    still('s-a1', 'carousel-slide', { displayGroup: 'womens-day-carousel' }),
    still('s-b1', 'carousel-slide', { displayGroup: 'know-before-you-go' }),
    still('s-a2', 'carousel-slide', { displayGroup: 'womens-day-carousel' }),
  ]
  const detail = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(detail.carousels.map((c) => [c.group, ids(c.pages)]), [['womens-day-carousel', ['s-a1', 's-a2']], ['know-before-you-go', ['s-b1']]])
  assert.deepEqual(buildContentFlow(assets, { surface: 'work' }).carousels, detail.carousels)
  assert.deepEqual(buildContentFlow(assets, { surface: 'globe' }).carousels, [])
  assert.deepEqual(ids(buildContentFlow(assets, { surface: 'globe' }).showcase), []) // dropped, not shown as stills
})

test('a surface drops the pieces of a set it does not open', () => {
  const globe = buildContentFlow(mixed(), { surface: 'globe' })
  assert.deepEqual(globe.brandDecks, [])
  assert.deepEqual(globe.banners, [])
  assert.deepEqual(globe.carousels, [])
  assert.deepEqual(globe.admats.map((s) => [s.group, ids(s.items)]), [['jamback-world-tour-2026-admats', ['ad-1', 'ad-2', 'ad-3']]])
  assert.deepEqual(ids(globe.albumArt), ['cover-1', 'cover-2', 'cover-3', 'cover-4'])

  const work = buildContentFlow(mixed(), { surface: 'work' })
  assert.deepEqual(work.banners, [])
  assert.deepEqual(work.admats, [])
  assert.deepEqual(work.brandDecks.map((d) => d.group), ['guidelines']) // the admat pages are gone, the deck stays
  assert.equal(work.carousels.length, 2)

  const dir = buildContentFlow(mixed(), { surface: 'directory' })
  assert.equal(dir.banners.length, 1)
  assert.equal(dir.admats.length, 1)
  assert.equal(dir.brandDecks.length, 1)
})
