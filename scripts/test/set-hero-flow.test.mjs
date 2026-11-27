// A set leads the project page (US-10, Nathan 11-16): buildContentFlow's `heroSet`.
//   node --test scripts/test/set-hero-flow.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildContentFlow } from '../../src/components/work/detail/buildContentFlow.js'

const still = (id, mediaType = 'static_1x1', extra = {}) => ({
  _id: id,
  title: id,
  mediaType,
  imageUrl: `https://cdn.example.invalid/${id}.jpg`,
  imageDimensions: { width: 1000, height: 1000 },
  ...extra,
})
const clip = (id, extra = {}) => ({ _id: id, title: id, mediaType: 'motion_16x9', playbackId: `pb-${id}`, videoAspectRatio: '16:9', ...extra })
// A piece the way MEDIA_FIELDS projects it: the Set document's type and key win, setId and the toggle ride along.
const inSet = (set, allows, type, group) => ({ setId: set, setAllowsHero: allows, groupType: type, displayGroup: group })
const flyer = (id, extra) => still(id, 'static_4x5', { imageDimensions: { width: 1080, height: 1350 }, ...extra })
const ids = (list) => list.map((a) => a._id)
const noSetFields = (flow) => JSON.parse(JSON.stringify(flow, (k, v) => (k === 'setId' || k === 'setAllowsHero' ? undefined : v)))

const admatRun = (allows) => [
  flyer('a1', inSet('mediaSet-tour', allows, 'admat', 'tour-admats')),
  still('t1'),
  flyer('a2', inSet('mediaSet-tour', allows, 'admat', 'tour-admats')),
  still('t2'),
  flyer('a3', inSet('mediaSet-tour', allows, 'admat', 'tour-admats')),
  still('t3'),
]

test('a first piece whose set may lead: heroSet holds every member in rank order, the set is in no bucket and has no seat', () => {
  const flow = buildContentFlow(admatRun(true), { surface: 'detail' })
  assert.deepEqual(flow.heroSet.group, 'tour-admats')
  assert.deepEqual(flow.heroSet.type, 'admat')
  assert.deepEqual(ids(flow.heroSet.items), ['a1', 'a2', 'a3'], 'the first piece is in it too')
  assert.deepEqual(flow.admats, [], 'not seated a second time')
  assert.deepEqual(ids(flow.showcase), ['t1', 't2', 't3'])
  // another set of the same type further down keeps its own seat
  const two = [...admatRun(true), flyer('b1', inSet('mediaSet-late', false, 'admat', 'late-admats')), flyer('b2', inSet('mediaSet-late', false, 'admat', 'late-admats'))]
  const both = buildContentFlow(two, { surface: 'detail' })
  assert.deepEqual(both.admats.map((s) => s.group), ['late-admats'])
  assert.deepEqual(ids(both.heroSet.items), ['a1', 'a2', 'a3'])
})

test('members are the first piece\'s Set document, not whatever shares its key', () => {
  const assets = [
    ...admatRun(true).slice(0, 3),
    flyer('x1', inSet('mediaSet-other', true, 'admat', 'tour-admats')), // same key, another Set document
    flyer('x2', inSet('mediaSet-other', true, 'admat', 'tour-admats')),
  ]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(ids(flow.heroSet.items), ['a1', 'a2'])
  assert.deepEqual(flow.admats.map((s) => ids(s.items)), [['x1', 'x2']])
})

test('toggle off leaves the output exactly the output for the same pieces with no set fields', () => {
  const off = admatRun(false)
  const flowOff = buildContentFlow(off, { surface: 'detail' })
  const plain = off.map(({ setId, setAllowsHero, ...rest }) => rest)
  assert.equal('heroSet' in flowOff, false)
  assert.deepEqual(noSetFields(flowOff), buildContentFlow(plain, { surface: 'detail' }))
  // and with no Set document at all (an admat is not a legacy leader)
  assert.equal('heroSet' in buildContentFlow(plain, { surface: 'detail' }), false)
})

test('a legacy deck hero (no Set document) still leads: its whole group in brandDeckOrder, other decks keep the socket', () => {
  const deck = (id, group, order) => still(id, 'brand-deck', { displayGroup: group, groupType: 'deck', brandDeckOrder: order })
  const assets = [deck('p2', 'guide', 2), still('t1'), deck('p1', 'guide', 1), deck('o1', 'other', 1), deck('o2', 'other', 2)]
  const flow = buildContentFlow(assets, { surface: 'detail' })
  assert.deepEqual(flow.heroSet, { group: 'guide', type: 'deck', items: [assets[2], assets[0]] })
  assert.deepEqual(flow.brandDecks.map((d) => [d.group, ids(d.pages)]), [['other', ['o1', 'o2']]])
  // a deck Set document switched off leads as its first page, as a plain hero
  const off = assets.map((a, i) => (a.displayGroup === 'guide' ? { ...a, ...inSet('mediaSet-guide', false, 'deck', 'guide') } : a))
  const flowOff = buildContentFlow(off, { surface: 'detail' })
  assert.equal('heroSet' in flowOff, false)
  assert.deepEqual(flowOff.brandDecks.map((d) => d.group), ['guide', 'other'])
  // the lead is the detail page's: /featured-projects and the globe read no heroSet
  assert.equal('heroSet' in buildContentFlow(assets, { surface: 'work' }), false)
  assert.equal('heroSet' in buildContentFlow(assets), false)
})

test('a banner set (or live footage) cannot lead, toggle on or not', () => {
  const banner = (id) => still(id, 'static_other', inSet('mediaSet-sc', true, 'banner', 'soundcloud-banners'))
  const assets = [banner('b1'), still('t1'), banner('b2')]
  assert.equal('heroSet' in buildContentFlow(assets, { surface: 'detail' }), false)
  assert.equal('heroSet' in buildContentFlow(assets, { surface: 'detail', heroSetPreview: true }), false)
  const footage = [clip('f1', inSet('mediaSet-live', true, 'live-footage', 'live')), clip('f2', inSet('mediaSet-live', true, 'live-footage', 'live'))]
  assert.equal('heroSet' in buildContentFlow(footage, { surface: 'detail' }), false)
})

test('?heroset preview: a legacy visuals set (no Set document) leads; without it the page is unchanged', () => {
  const loop = (id) => clip(id, { mediaType: 'motion_9x16', videoAspectRatio: '9:16', groupType: 'visuals', displayGroup: 'loops' })
  const assets = [loop('v1'), still('t1'), loop('v2'), loop('v3'), still('t2')]
  const plain = buildContentFlow(assets, { surface: 'detail' })
  assert.equal('heroSet' in plain, false)
  assert.deepEqual(ids(plain.visuals[0].items), ['v2', 'v3'], 'today: the first piece is the hero, the rest ride the wall')
  const flow = buildContentFlow(assets, { surface: 'detail', heroSetPreview: true })
  assert.deepEqual(flow.heroSet.type, 'visuals')
  assert.deepEqual(ids(flow.heroSet.items), ['v1', 'v2', 'v3'])
  assert.deepEqual(flow.visuals, [])
  assert.deepEqual(ids(flow.showcase), ['t1', 't2'])
  // the preview needs a set to lead: an ungrouped first piece stays a plain hero
  assert.equal('heroSet' in buildContentFlow([clip('hero'), still('t1')], { surface: 'detail', heroSetPreview: true }), false)
})

test('album art leads as the whole cover wall without the preview or the toggle (11-24); a lone cover is the plain hero', () => {
  const cover = (id, extra = {}) => still(id, 'album-art', { groupType: 'album-art', ...extra })
  const flow = buildContentFlow([cover('c1'), still('t1'), cover('c2'), cover('c3')], { surface: 'detail' })
  assert.deepEqual([flow.heroSet.type, ids(flow.heroSet.items), flow.albumArt, flow.albumArtSeat], ['album-art', ['c1', 'c2', 'c3'], [], null])
  assert.deepEqual(ids(flow.showcase), ['t1'])
  const off = (id) => cover(id, { setId: 'mediaSet-art', setAllowsHero: false })
  assert.deepEqual(ids(buildContentFlow([off('c1'), off('c2')], { surface: 'detail' }).heroSet.items), ['c1', 'c2'], 'the Set toggle off still leads')
  // NC: one cover is just the hero; a cover not first stays in the cover wall; other surfaces never lead
  assert.equal('heroSet' in buildContentFlow([cover('c1'), still('t1')], { surface: 'detail' }), false)
  assert.equal('heroSet' in buildContentFlow([still('t0'), cover('c1'), cover('c2')], { surface: 'detail' }), false)
  assert.equal('heroSet' in buildContentFlow([cover('c1'), cover('c2')], { surface: 'work' }), false)
})

test('every type the hero box holds leads from its own lane; a set of one is just the hero', () => {
  const cover = (id) => still(id, 'album-art', { groupType: 'album-art' })
  const covers = [cover('c1'), still('t1'), cover('c2'), cover('c3')]
  const art = buildContentFlow(covers, { surface: 'detail', heroSetPreview: true })
  assert.deepEqual([art.heroSet.type, ids(art.heroSet.items), art.albumArt, art.albumArtSeat], ['album-art', ['c1', 'c2', 'c3'], [], null])

  const slide = (id) => still(id, 'carousel-slide', { groupType: 'carousel', displayGroup: 'roll' })
  const roll = buildContentFlow([slide('s1'), slide('s2')], { surface: 'detail', heroSetPreview: true })
  assert.deepEqual([roll.heroSet.type, ids(roll.heroSet.items), roll.carousels], ['carousel', ['s1', 's2'], []])

  const fp = (id) => clip(id, { mediaType: 'motion_4x5', videoAspectRatio: '4:5', groupType: 'flyer-progression', displayGroup: 'r2' })
  const prog = buildContentFlow([fp('f1'), still('t1'), fp('f2')], { surface: 'detail', heroSetPreview: true })
  assert.deepEqual([prog.heroSet.type, ids(prog.heroSet.items), prog.carousels], ['flyer-progression', ['f1', 'f2'], []])

  const mock = (id) => still(id, 'static_4x5', { groupType: 'mockups', displayGroup: 'mocks' })
  const mocks = buildContentFlow([mock('m1'), mock('m2')], { surface: 'detail', heroSetPreview: true })
  assert.deepEqual([mocks.heroSet.type, ids(mocks.heroSet.items), mocks.mockups], ['mockups', ['m1', 'm2'], []])

  // merch: only the stills are members; a motion piece keeps its own tile
  const tee = (id) => still(id, 'static_4x5', { groupType: 'merch', displayGroup: 'tees' })
  const merch = buildContentFlow([tee('e1'), clip('reel', { groupType: 'merch', displayGroup: 'tees' }), tee('e2')], { surface: 'detail', heroSetPreview: true })
  assert.deepEqual([merch.heroSet.type, ids(merch.heroSet.items), ids(merch.showcase)], ['merch', ['e1', 'e2'], ['reel']])

  // a set of one is not a set: the piece leads on its own (a deck of one keeps leading, as it did)
  const one = buildContentFlow([flyer('solo', { groupType: 'admat', displayGroup: 'one-admats' }), still('t1')], { surface: 'detail', heroSetPreview: true })
  assert.equal('heroSet' in one, false)
})

test('a leading set does not split its first piece into thirds, and the other pieces keep their order', () => {
  const D = 90
  const hero = clip('hero', { groupType: 'visuals', displayGroup: 'loops', splitIntoThirds: true, videoDuration: D })
  const assets = [hero, clip('v2', { groupType: 'visuals', displayGroup: 'loops' }), still('t1'), still('t2')]
  const flow = buildContentFlow(assets, { surface: 'detail', heroSetPreview: true })
  assert.deepEqual(ids(flow.heroSet.items), ['hero', 'v2'])
  assert.deepEqual(ids(flow.showcase), ['t1', 't2'], 'no spliced thirds in the grid')
})
