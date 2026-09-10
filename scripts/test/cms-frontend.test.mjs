import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, evaluate } from 'groq-js'
import {
  FEATURED_PROJECT_DETAIL_QUERY,
  FEATURED_PROJECT_PATHS_QUERY,
  FEATURED_WORLDS_QUERY,
} from '../../src/lib/queries.js'
import { buildContentFlow, ratioOf } from '../../src/components/work/detail/buildContentFlow.js'
import { toProjectSlug } from '../../src/lib/projectSlug.js'

const ref = (_ref) => ({ _type: 'reference', _ref })
const image = { _type: 'image', asset: ref('image-page') }
const video = { _type: 'mux.video', asset: ref('mux-ready') }
const base = {
  _type: 'mediaAsset', client: ref('client-fixture'), project: ref('project-fixture'),
  sourceFolder: '/original/checkout/media/Fixture/Branding', sourceManifest: 'Branding',
}
const media = (id, rank, fields) => ({ ...base, _id: id, orderRank: rank, title: id, ...fields })
const documents = [
  { _id: 'client-fixture', _type: 'client', name: 'Fixture', slug: { current: 'fixture' } },
  { _id: 'project-fixture', _type: 'project', title: 'Studio title', slug: { current: 'fixture-branding' }, client: ref('client-fixture'), isFeatured: true, orderRank: '0|hzzzzz:' },
  { _id: 'image-page', _type: 'sanity.imageAsset', url: 'https://example.invalid/page.jpg', metadata: { dimensions: { width: 1200, height: 1500 } } },
  { _id: 'mux-ready', _type: 'mux.videoAsset', playbackId: 'fixture-playback', status: 'ready', data: { status: 'ready', aspect_ratio: '4:3' } },
  media('hero', '0|hzzzzz:', { mediaType: 'featured-project-reel', video }),
  media('cover', '0|i00007:', { mediaType: 'album-art', image, releaseInfo: { releaseArtist: 'Studio artist', releaseTitle: 'Studio release' } }),
  media('page-2', '0|i0000f:', { mediaType: 'brand-deck', image, displayGroup: 'reviewed-deck', brandDeckOrder: 2 }),
  media('page-1', '0|i0000n:', { mediaType: 'brand-deck', image, displayGroup: 'reviewed-deck', brandDeckOrder: 1 }),
  media('slide-1', '0|i0000v:', { mediaType: 'carousel-slide', image, displayGroup: 'reviewed-carousel' }),
  media('slide-2', '0|i00013:', { mediaType: 'carousel-slide', image, displayGroup: 'reviewed-carousel' }),
  media('motion', '0|i0001b:', { mediaType: 'motion_other', video }),
  media('drafts.unapproved', '0|000000:', { mediaType: 'static_4x5', image }),
  media('other-project', '0|000001:', { project: ref('other-project'), mediaType: 'static_4x5', image }),
]
const query = async (source, dataset = documents, params = {}) =>
  (await evaluate(parse(source), { dataset, params })).get()

test('published scoped detail query preserves hero, deck/carousel order and release metadata', async () => {
  const detail = await query(FEATURED_PROJECT_DETAIL_QUERY, documents, { projectId: 'project-fixture' })
  assert.deepEqual(detail.assets.map(({ _id }) => _id), ['hero', 'cover', 'page-2', 'page-1', 'slide-1', 'slide-2', 'motion'])
  assert.equal(detail.assets[1].releaseInfo.releaseTitle, 'Studio release')
  const flow = buildContentFlow(detail.assets)
  assert.deepEqual(flow.brandDecks[0].pages.map(({ _id }) => _id), ['page-1', 'page-2'])
  assert.deepEqual(flow.carousels.map(({ _id }) => _id), ['slide-1', 'slide-2'])
  assert.equal(ratioOf(flow.brandDecks[0].pages[0]), 4 / 5)
  assert.equal(ratioOf(detail.assets.at(-1)), 4 / 3)
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
})
