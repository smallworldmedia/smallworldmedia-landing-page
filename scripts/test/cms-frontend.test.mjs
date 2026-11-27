import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, evaluate } from 'groq-js'
import {
  FEATURED_PROJECT_DETAIL_QUERY,
  FEATURED_PROJECT_PATHS_QUERY,
  FEATURED_WORLDS_QUERY,
  DIRECTORY_QUERY,
} from '../../src/lib/queries.js'
import { buildContentFlow, ratioOf } from '../../src/components/work/detail/buildContentFlow.js'
import { toProjectSlug } from '../../src/lib/projectSlug.js'
import { buildDirectoryTiles, matchesFilter } from '../../src/components/work/directory/buildDirectoryTiles.js'
import { coverageOf, toDrawerRoster } from '../../src/lib/clientCoverage.js'
import {
  isSequenceGroup,
  makeSequence,
  sequenceRatio,
  sequenceFrame,
  frameBeats,
  weightedFrame,
  msToNextFrame,
  SEQUENCE_MAX_FRAMES,
} from '../../src/lib/mediaSequence.js'

const ref = (_ref) => ({ _type: 'reference', _ref })
const image = { _type: 'image', asset: ref('image-page') }
const video = { _type: 'mux.video', asset: ref('mux-ready') }
const base = {
  _type: 'mediaAsset', client: ref('client-fixture'), project: ref('project-fixture'),
  sourceFolder: '/original/checkout/media/Fixture/Branding', sourceManifest: 'Branding',
}
const media = (id, rank, fields) => ({ ...base, _id: id, orderRank: rank, title: id, ...fields })
// A piece's group is its Set document (the legacy displayGroup / groupType retire, 11-25).
const setOf = (key, groupType, project = 'project-fixture') => ({ _id: `mediaSet-${key}`, _type: 'mediaSet', title: key, slug: { current: key }, project: ref(project), groupType, allowAsHero: false })
const inSet = (key) => ({ set: ref(`mediaSet-${key}`) })
const documents = [
  setOf('reviewed-deck', 'deck'), setOf('reviewed-carousel', 'carousel'), setOf('soundcloud-banners', 'banner'),
  { _id: 'client-fixture', _type: 'client', name: 'Fixture', slug: { current: 'fixture' } },
  { _id: 'project-fixture', _type: 'project', title: 'Studio title', slug: { current: 'fixture-branding' }, client: ref('client-fixture'), isFeatured: true, orderRank: '0|hzzzzz:' },
  { _id: 'image-page', _type: 'sanity.imageAsset', url: 'https://example.invalid/page.jpg', metadata: { dimensions: { width: 1200, height: 1500 } } },
  { _id: 'mux-ready', _type: 'mux.videoAsset', playbackId: 'fixture-playback', status: 'ready', data: { status: 'ready', aspect_ratio: '4:3' } },
  media('hero', '0|hzzzzz:', { mediaType: 'featured-project-reel', video }),
  media('cover', '0|i00007:', { mediaType: 'album-art', image, releaseInfo: { releaseArtist: 'Studio artist', releaseTitle: 'Studio release' } }),
  media('page-2', '0|i0000f:', { mediaType: 'brand-deck', image, ...inSet('reviewed-deck'), brandDeckOrder: 2 }),
  media('page-1', '0|i0000n:', { mediaType: 'brand-deck', image, ...inSet('reviewed-deck'), brandDeckOrder: 1 }),
  media('slide-1', '0|i0000v:', { mediaType: 'carousel-slide', image, ...inSet('reviewed-carousel') }),
  media('slide-2', '0|i00013:', { mediaType: 'carousel-slide', image, ...inSet('reviewed-carousel') }),
  media('motion', '0|i0001b:', { mediaType: 'motion_other', video }),
  media('banner-2', '0|i0001c:', { mediaType: 'static_other', image, ...inSet('soundcloud-banners') }),
  media('banner-1', '0|i0001d:', { mediaType: 'static_other', image, ...inSet('soundcloud-banners') }),
  media('drafts.unapproved', '0|000000:', { mediaType: 'static_4x5', image }),
  media('other-project', '0|000001:', { project: ref('other-project'), mediaType: 'static_4x5', image }),
]
const query = async (source, dataset = documents, params = {}) =>
  (await evaluate(parse(source), { dataset, params })).get()

test('published scoped detail query preserves hero, deck/carousel order and release metadata', async () => {
  const detail = await query(FEATURED_PROJECT_DETAIL_QUERY, documents, { projectId: 'project-fixture' })
  assert.deepEqual(detail.assets.map(({ _id }) => _id), ['hero', 'cover', 'page-2', 'page-1', 'slide-1', 'slide-2', 'motion', 'banner-2', 'banner-1'])
  assert.equal(detail.assets[1].releaseInfo.releaseTitle, 'Studio release')
  const flow = buildContentFlow(detail.assets)
  assert.deepEqual(flow.brandDecks[0].pages.map(({ _id }) => _id), ['page-1', 'page-2'])
  // Carousels group like decks (11-10): [{group, pages}], orderRank order within a group.
  assert.deepEqual(flow.carousels.map(({ group, pages }) => [group, pages.map(({ _id }) => _id)]), [['reviewed-carousel', ['slide-1', 'slide-2']]])
  assert.deepEqual(flow.admats, [])
  // groupType is the piece's Set's type, and null for a piece with no set (the cover: groupTypeOf infers album art).
  const typeOf = (id) => detail.assets.find((a) => a._id === id).groupType
  assert.deepEqual([typeOf('page-1'), typeOf('slide-1'), typeOf('slide-2'), typeOf('cover')], ['deck', 'carousel', 'carousel', null])
  // Banner groups (09-10): routed by displayGroup, orderRank order kept, out of the showcase.
  // 11-14: a set carries its Studio seat. banner-2 is the 8th asset (rank 7) and no tile
  // ranks after it, so the wall sits after both showcase tiles (cover, motion).
  assert.deepEqual(flow.banners, [{ group: 'soundcloud-banners', items: flow.banners[0].items, rank: 7, at: 2 }])
  assert.deepEqual(flow.banners[0].items.map(({ _id }) => _id), ['banner-2', 'banner-1'])
  assert.ok(!flow.showcase.some(({ _id }) => _id.startsWith('banner-')))
  assert.equal(ratioOf(flow.brandDecks[0].pages[0]), 4 / 5)
  assert.equal(ratioOf(detail.assets.find(({ _id }) => _id === 'motion')), 4 / 3)
})

test('appended media stays in the same world and does not change hero or route', async () => {
  const before = await query(FEATURED_PROJECT_PATHS_QUERY)
  const appended = [...documents, media('new-media', '0|i0001j:', { mediaType: 'motion_4x3', video })]
  const after = await query(FEATURED_PROJECT_PATHS_QUERY, appended)
  assert.deepEqual(after, before)
  assert.equal(toProjectSlug(after[0].clientSlug, after[0].collection), 'fixture-branding')
  const worlds = await query(FEATURED_WORLDS_QUERY, appended)
  assert.equal(worlds.length, 1)
  assert.equal(worlds[0].assets[0]._id, 'hero')
  assert.equal(worlds[0].assets.at(-1)._id, 'new-media')
  assert.equal(worlds[0].assets.at(-1).videoAspectRatio, '4:3')
  assert.equal(worlds[0].assets.at(-1).videoStatus, 'ready')
  // The Worlds projection carries groupType too: the globe's pools read it (11-10).
  assert.equal(worlds[0].assets.find((a) => a._id === 'slide-1').groupType, 'carousel')
  assert.equal(worlds[0].assets.find((a) => a._id === 'cover').groupType, null)
})

test('a -sequence group is ONE showcase tile: frames in Studio order, the least-crop shape, stills only (10-31)', async () => {
  const still = (id, url, width, height, hasAlpha = false) => ({ _id: id, _type: 'sanity.imageAsset', url, metadata: { dimensions: { width, height }, hasAlpha } })
  const img = (id) => ({ _type: 'image', asset: ref(id) })
  const seqDocs = [
    ...documents,
    still('image-logo-a', 'https://example.invalid/logo-a.png', 2000, 465, true),
    still('image-logo-b', 'https://example.invalid/logo-b.png', 2000, 465, true),
    still('image-logo-c', 'https://example.invalid/logo-c.jpg', 1920, 1080),
    setOf('fixture-logo-sequence', 'merch'), setOf('solo-sequence', 'merch'),
    media('logo-a', '0|i0001e:', { mediaType: 'static_16x9', image: img('image-logo-a'), ...inSet('fixture-logo-sequence') }),
    media('logo-b', '0|i0001f:', { mediaType: 'static_16x9', image: img('image-logo-b'), ...inSet('fixture-logo-sequence') }),
    media('logo-clip', '0|i0001g:', { mediaType: 'motion_16x9', video, ...inSet('fixture-logo-sequence') }), // a video member keeps its own tile
    media('logo-c', '0|i0001h:', { mediaType: 'static_16x9', image: img('image-logo-c'), ...inSet('fixture-logo-sequence') }),
    media('solo', '0|i0001i:', { mediaType: 'static_4x5', image, ...inSet('solo-sequence') }), // a group of one stays a plain tile
  ]
  const detail = await query(FEATURED_PROJECT_DETAIL_QUERY, seqDocs, { projectId: 'project-fixture' })
  const flow = buildContentFlow(detail.assets)
  const ids = flow.showcase.map(({ _id }) => _id)
  // ORBIT_MIN folds the one cover in; the sequence sits at its first frame's place, the clip and the solo at theirs.
  assert.deepEqual(ids, ['cover', 'motion', 'sequence:fixture-logo-sequence', 'logo-clip', 'solo'])
  const seq = flow.showcase[2]
  assert.deepEqual(seq.frames.map(({ _id }) => _id), ['logo-a', 'logo-b', 'logo-c'])
  assert.equal(seq.imageUrl, 'https://example.invalid/logo-a.png') // frame 0's fields: every one-image consumer keeps working
  assert.deepEqual(seq.frames.map((f) => f.imageHasAlpha), [true, true, false]) // the query carries what the fit reads
  assert.equal(ratioOf(seq), 16 / 9) // the labels' shape, not the 4.3:1 files (labels win, as in ratioOf)
  assert.equal(isSequenceGroup('fixture-logo-sequence'), true)
  assert.equal(isSequenceGroup('sequence'), true)
  assert.equal(isSequenceGroup('sequences-archive'), false) // NC: the suffix, not a substring
  assert.equal(isSequenceGroup(undefined), false)
})

test('directory query carries a video\'s length (an admat set holds an animated flyer for its clip), null for a still', async () => {
  const timed = [
    ...documents,
    { _id: 'mux-long', _type: 'mux.videoAsset', playbackId: 'long-playback', status: 'ready', data: { status: 'ready', aspect_ratio: '4:5', duration: 19.5 } },
    setOf('tour-admats', 'admat'),
    media('flyer-clip', '0|i0001e:', { mediaType: 'brand-deck', ...inSet('tour-admats'), video: { _type: 'mux.video', asset: ref('mux-long') } }),
  ]
  const { assets } = await query(DIRECTORY_QUERY, timed)
  const durationOf = (id) => assets.find((a) => a._id === id).videoDuration
  assert.equal(durationOf('flyer-clip'), 19.5)
  assert.equal(durationOf('cover'), null)
})

test('directory query: published media in World order, a deck as one tile, the label covering its child (11-03)', async () => {
  const dirDocs = [
    ...documents,
    { _id: 'tag-branding', _type: 'serviceTag', name: 'Branding', slug: { current: 'branding' }, sortOrder: 2 },
    { _id: 'tag-album', _type: 'serviceTag', name: 'Album Art', slug: { current: 'album-art' }, sortOrder: 1 },
    { _id: 'drafts.tag-vfx', _type: 'serviceTag', name: 'VFX', slug: { current: 'vfx' }, sortOrder: 0 },
    { _id: 'client-dj', _type: 'client', name: 'DJ Tennis', slug: { current: 'dj-tennis' } },
    { _id: 'client-munchie', _type: 'client', name: 'Munchietown', slug: { current: 'munchietown' }, affiliations: [{ _key: 'a', entity: ref('client-dj'), relationship: 'label-of' }] },
    { ...base, _id: 'munchie-cover', orderRank: '0|z00001:', title: 'munchie-cover', client: ref('client-munchie'), project: undefined, mediaType: 'album-art', image, services: [ref('tag-album')] },
    { ...base, _id: 'munchie-shell', orderRank: '0|z00002:', title: 'munchie-shell', client: ref('client-munchie'), project: undefined, mediaType: 'static_4x5' },
  ]
  const data = await query(DIRECTORY_QUERY, dirDocs)
  assert.deepEqual(data.tags.map((t) => t.slug), ['album-art', 'branding']) // sortOrder; drafts out
  assert.deepEqual(data.clients.find((c) => c.slug === 'munchietown').umbrellas, ['dj-tennis'])
  assert.ok(!data.assets.some((a) => a._id.startsWith('drafts.') || a._id === 'munchie-shell')) // published, with media
  const tiles = buildDirectoryTiles(data)
  // The featured World first (its hero included), the deck as one tile at its first page's place, its face page 1.
  assert.deepEqual(tiles.map((t) => t._id), ['hero', 'cover', 'page-1', 'slide-1', 'motion', 'banner-2', 'other-project', 'munchie-cover'])
  assert.equal(tiles[0].href, '/featured-projects/fixture-branding')
  assert.equal(tiles[0].label, 'Studio title')
  // ?client=dj-tennis: DJ Tennis has no media of its own; Munchietown names it, so its cover shows.
  const dj = coverageOf('dj-tennis', data.clients)
  assert.deepEqual(tiles.filter((t) => matchesFilter(t, { tags: new Set(), coverage: dj })).map((t) => t._id), ['munchie-cover'])
  assert.deepEqual(toDrawerRoster(data.clients, tiles).map((r) => [r.name, r.live]), [['DJ Tennis', true], ['Fixture', true], ['Munchietown', true]])
})

test('directory query: a collaborator-only name is live and filters to exactly its pieces; the host client keeps them (SQ-76)', async () => {
  const mk = (id, rank, fields) => ({ ...base, _id: id, orderRank: rank, title: id, project: undefined, mediaType: 'album-art', image, ...fields })
  const tag = { _id: 'tag-album', _type: 'serviceTag', name: 'Album Art', slug: { current: 'album-art' }, sortOrder: 1 }
  const clients = [
    { _id: 'client-kamino', _type: 'client', name: 'Kamino', slug: { current: 'kamino' } },
    { _id: 'client-guest', _type: 'client', name: 'Guest Artist', slug: { current: 'guest-artist' } },
    { _id: 'client-nobody', _type: 'client', name: 'Nobody', slug: { current: 'nobody' } },
  ]
  const dirDocs = [
    ...documents.filter((d) => d._type === 'sanity.imageAsset'),
    tag,
    ...clients,
    mk('belong', '0|a00001:', { client: ref('client-kamino'), collaborators: [{ _key: 'a', ...ref('client-guest') }], services: [ref('tag-album')] }),
    mk('falling', '0|a00002:', { client: ref('client-kamino'), collaborators: [{ _key: 'a', ...ref('client-guest') }], services: [ref('tag-album')] }),
    mk('solo', '0|a00003:', { client: ref('client-kamino'), services: [ref('tag-album')] }),
  ]
  const data = await query(DIRECTORY_QUERY, dirDocs)
  assert.deepEqual(data.assets.find((a) => a._id === 'belong').collaboratorSlugs, ['guest-artist'])
  assert.equal(data.assets.find((a) => a._id === 'solo').collaboratorSlugs ?? null, null, 'no field: nothing read')
  const tiles = buildDirectoryTiles(data)
  assert.deepEqual(tiles.map((t) => [t._id, t.client, t.collaborators]), [
    ['belong', 'kamino', ['guest-artist']], ['falling', 'kamino', ['guest-artist']], ['solo', 'kamino', []],
  ])
  const show = (slug) => tiles.filter((t) => matchesFilter(t, { tags: new Set(), coverage: coverageOf(slug, data.clients) })).map((t) => t._id)
  assert.deepEqual(show('guest-artist'), ['belong', 'falling'], 'the collaborator filters to exactly its pieces')
  assert.deepEqual(show('kamino'), ['belong', 'falling', 'solo'], 'the host client still shows them')
  const live = Object.fromEntries(toDrawerRoster(data.clients, tiles).map((r) => [r.slug, r.live]))
  assert.deepEqual(live, { kamino: true, 'guest-artist': true, nobody: false })
})

test('sequence shape: the member ratio that crops the set least; the frame cap; one wall clock (10-31)', () => {
  // Billboard mockups: two 16:9 boards and a 4:5 poster — the tile is 16:9 (cost 0.55), not 4:5 (1.10).
  assert.equal(sequenceRatio([16 / 9, 4 / 5, 16 / 9]), 16 / 9)
  assert.equal(sequenceRatio([4 / 5, 1, 9 / 16]), 4 / 5) // 0.50 vs 0.64 vs 0.73
  assert.equal(sequenceRatio([1, 16 / 9]), 1) // a tie keeps the earlier frame
  assert.equal(sequenceRatio([]), 1)
  const frames = Array.from({ length: SEQUENCE_MAX_FRAMES + 2 }, (_, i) => ({ _id: `f${i}`, imageUrl: `u${i}` }))
  const seq = makeSequence('sequence:x', frames, frames.map(() => 1))
  assert.equal(seq.frames.length, SEQUENCE_MAX_FRAMES)
  assert.equal(makeSequence('sequence:x', frames, frames.map(() => 1), { cap: Infinity }).frames.length, frames.length)
  assert.equal(seq._id, 'sequence:x')
  // The clock: floor(now / 1000 ms) mod n — every tile on every route in phase, nothing to subscribe to.
  assert.deepEqual([0, 999, 1000, 2500, 3000].map((t) => sequenceFrame(3, t)), [0, 0, 1, 2, 0])
  assert.equal(sequenceFrame(1, 5000), 0) // one frame never cycles
  assert.equal(msToNextFrame(2500), 500)
})

test('weighted beats: a still weighs 1, an animated flyer its clip (<= the preview) in beats; every cut lands on the wall clock (SQ-53)', () => {
  const still = { _id: 's' }
  const flyer = (d) => ({ _id: 'f', playbackId: 'pb', videoDuration: d })
  assert.equal(frameBeats(still, 5), 1)
  assert.equal(frameBeats(flyer(20), 5), 5, 'capped at the preview clip')
  assert.equal(frameBeats(flyer(3.2), 5), 4, 'a shorter clip rounds up to whole beats')
  assert.equal(frameBeats(flyer(5), 5), 5)
  assert.equal(frameBeats(flyer(undefined), 5), 5, 'an unknown length plays the whole clip')
  assert.equal(frameBeats(flyer(20), 5, 500), 10, 'beats follow the interval')
  // 1 still + one 20 s flyer at 1000 ms: Σ6 beats, the still owns beat 0, the flyer beats 1-5.
  const weights = [still, flyer(20)].map((f) => frameBeats(f, 5))
  assert.deepEqual(weights, [1, 5])
  const at = (beat) => weightedFrame(weights, beat * 1000)
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(at), [0, 1, 1, 1, 1, 1, 0, 1], 'the cycle repeats every 6 beats')
  // Cuts land on whole beats: nothing changes inside a beat, and the frame is a pure function of the clock.
  assert.deepEqual([1000, 1001, 1999.9, 5999].map((t) => weightedFrame(weights, t)), [1, 1, 1, 1])
  assert.equal(weightedFrame(weights, 6000), 0)
  assert.equal(weightedFrame(weights, 6000 + 6 * 1000 * 1234), 0)
  // All weights 1 is sequenceFrame; one frame never cycles.
  assert.deepEqual([0, 999, 1000, 2500, 3000].map((t) => weightedFrame([1, 1, 1], t)), [0, 0, 1, 2, 0])
  assert.equal(weightedFrame([5], 3000), 0)
  // 4 flyers (Short Circuit): 4 x 5 beats = 20, each owns 5.
  const four = [20, 19, 20, 19].map((d) => frameBeats(flyer(d), 5))
  assert.deepEqual([0, 4999, 5000, 10000, 15000, 19999, 20000].map((t) => weightedFrame(four, t)), [0, 0, 1, 2, 3, 3, 0])
})

test('a piece in a Set document projects the set\'s type and key, and the hero rule inputs; a piece with no set projects no group, whatever legacy fields it keeps (US-10, 11-25)', async () => {
  const setDocs = [
    { _id: 'mediaSet-tour', _type: 'mediaSet', title: 'Tour', slug: { current: 'tour-admats' }, project: ref('project-fixture'), groupType: 'admat', allowAsHero: true },
    { _id: 'mediaSet-covers', _type: 'mediaSet', title: 'Covers', slug: { current: 'fixture-album-art' }, project: ref('project-fixture'), groupType: 'album-art', allowAsHero: false },
  ]
  const piece = (id, rank, fields) => media(id, rank, { mediaType: 'static_4x5', image, ...fields })
  const withSets = [
    ...documents,
    ...setDocs,
    // the piece's own legacy fields say deck / legacy-group: the Set document wins
    piece('set-flyer', '0|i0001k:', { set: ref('mediaSet-tour'), displayGroup: 'legacy-group', groupType: 'deck' }),
    piece('set-flyer-2', '0|i0001l:', { set: ref('mediaSet-tour') }),
    piece('set-cover', '0|i0001m:', { mediaType: 'album-art', set: ref('mediaSet-covers') }),
    // taken out of its set in Studio, the legacy fields left behind (Andhera Shop Item Pages, 11-25): no group
    piece('left-set', '0|i0001n:', { mediaType: 'motion_4x3', image: undefined, video, displayGroup: 'tour-admats', groupType: 'admat' }),
  ]
  const detail = await query(FEATURED_PROJECT_DETAIL_QUERY, withSets, { projectId: 'project-fixture' })
  const get = (id) => detail.assets.find((a) => a._id === id)
  const pick = (a) => [a.setId, a.setAllowsHero, a.groupType, a.displayGroup]
  assert.deepEqual(pick(get('set-flyer')), ['mediaSet-tour', true, 'admat', 'tour-admats'])
  assert.deepEqual(pick(get('set-flyer-2')), ['mediaSet-tour', true, 'admat', 'tour-admats'], 'a member with no legacy fields still reads the set')
  assert.deepEqual(pick(get('set-cover')), ['mediaSet-covers', false, 'album-art', null], 'an album-art member keeps displayGroup null')
  // A piece with no set projects no group: its own legacy displayGroup / groupType are never read.
  assert.deepEqual(pick(get('left-set')), [null, null, null, null], 'a legacy displayGroup / groupType without a set is ignored')
  for (const id of ['hero', 'cover', 'motion']) assert.deepEqual(pick(get(id)), [null, null, null, null], id)
  // The same columns reach the directory's pieces; /featured-projects's Worlds read the two coalesced fields only.
  const dir = await query(DIRECTORY_QUERY, withSets)
  assert.deepEqual(pick(dir.assets.find((a) => a._id === 'set-flyer')), ['mediaSet-tour', true, 'admat', 'tour-admats'])
  const worlds = await query(FEATURED_WORLDS_QUERY, withSets)
  const world = (id) => worlds[0].assets.find((a) => a._id === id)
  assert.deepEqual([world('set-flyer').groupType, world('set-flyer').displayGroup], ['admat', 'tour-admats'])
  assert.deepEqual([world('set-cover').groupType, world('set-cover').displayGroup], ['album-art', null])
  assert.equal('setId' in world('set-flyer'), false)
  // The page's flow groups the set by the projected key: a wall of two flyers, not the legacy deck.
  const flow = buildContentFlow(detail.assets, { surface: 'detail' })
  assert.deepEqual(flow.admats.map((s) => [s.group, s.items.map((a) => a._id)]), [['tour-admats', ['set-flyer', 'set-flyer-2']]])
  assert.ok(flow.showcase.some((a) => a._id === 'left-set'), 'the piece left out of the set is an ordinary showcase tile')
})
