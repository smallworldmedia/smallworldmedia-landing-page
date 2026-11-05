/**
 * A featured project's service tags are the union of its media's tags
 * (queries.js PROJECT_SERVICES), run through the real queries over an
 * in-memory dataset: deduplicated, in the serviceTag documents' Studio order,
 * independent of the project's own (soon retired) `services` field.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parse, evaluate } from 'groq-js'
import { FEATURED_PROJECT_PATHS_QUERY, FEATURED_PROJECT_DETAIL_QUERY, FEATURED_WORLDS_QUERY } from '../../src/lib/queries.js'

const ref = (_ref) => ({ _type: 'reference', _ref })
const tag = (slug, sortOrder, name = slug) => ({ _id: `tag-${slug}`, _type: 'serviceTag', name, slug: { current: slug }, sortOrder })
const project = (id, rank, fields = {}) => ({ _id: id, _type: 'project', title: id, slug: { current: id }, client: ref('client'), isFeatured: true, orderRank: rank, ...fields })
const media = (id, projectId, tags, fields = {}) => ({
  _id: id,
  _type: 'mediaAsset',
  orderRank: `0|${id}:`,
  mediaType: 'static_1x1',
  sourceManifest: 'm',
  project: ref(projectId),
  services: tags.map((t) => ({ ...ref(`tag-${t}`), _key: t })),
  ...fields,
})
const query = async (source, dataset, params) => (await evaluate(parse(source), { dataset, params })).get()
const slugs = (services) => services.map((s) => s.slug)

const documents = [
  { _id: 'client', _type: 'client', name: 'Client', slug: { current: 'client' } },
  // Studio order: branding, album-art, logo-design (not alphabetical, not creation order)
  tag('logo-design', 30), tag('branding', 10), tag('album-art', 20), tag('web-design', 40), tag('unused', 50),
  // The project's own list is stale: it is not read.
  project('p-mixed', '0|a:', { services: [ref('tag-web-design'), ref('tag-unused')] }),
  media('m1', 'p-mixed', ['logo-design', 'branding']),
  media('m2', 'p-mixed', ['branding']),
  media('m3', 'p-mixed', ['album-art', 'logo-design']),
  media('m4', 'p-mixed', []),
  media('m-draft', 'p-mixed', ['web-design'], { _id: 'drafts.m-draft' }),
  project('p-bare', '0|b:'),
  media('b1', 'p-bare', []),
  project('p-empty', '0|c:', { services: [ref('tag-branding')] }),
  project('p-other', '0|d:'),
  media('o1', 'p-other', ['web-design']),
]

test('the union of the media tags, deduplicated, in Studio order', async () => {
  const rows = await query(FEATURED_PROJECT_PATHS_QUERY, documents)
  assert.deepEqual(slugs(rows.find((r) => r.slug === 'p-mixed').services), ['branding', 'album-art', 'logo-design'])
  assert.deepEqual(rows.find((r) => r.slug === 'p-mixed').services[0], { name: 'branding', slug: 'branding' })
})

test('the project\'s own services field is not read, and a draft asset adds no tag', async () => {
  const rows = await query(FEATURED_PROJECT_PATHS_QUERY, documents)
  const mixed = slugs(rows.find((r) => r.slug === 'p-mixed').services)
  assert.ok(!mixed.includes('web-design') && !mixed.includes('unused'))
  // a project whose list names a tag no media carries shows none
  assert.deepEqual(rows.find((r) => r.slug === 'p-empty').services, [])
})

test('untagged media, no media and a missing services field give no tags, not a crash', async () => {
  const rows = await query(FEATURED_PROJECT_PATHS_QUERY, documents)
  assert.deepEqual(rows.find((r) => r.slug === 'p-bare').services, [])
  const noField = documents.map((d) => (d._type === 'project' ? Object.fromEntries(Object.entries(d).filter(([k]) => k !== 'services')) : d))
  const again = await query(FEATURED_PROJECT_PATHS_QUERY, noField)
  assert.deepEqual(slugs(again.find((r) => r.slug === 'p-mixed').services), ['branding', 'album-art', 'logo-design'])
})

test('one project\'s media never lend their tags to another', async () => {
  const rows = await query(FEATURED_PROJECT_PATHS_QUERY, documents)
  assert.deepEqual(slugs(rows.find((r) => r.slug === 'p-other').services), ['web-design'])
})

test('the detail page and the /work Worlds read the same tags', async () => {
  const detail = await query(FEATURED_PROJECT_DETAIL_QUERY, documents, { projectId: 'p-mixed' })
  const worlds = await query(FEATURED_WORLDS_QUERY, documents)
  const want = ['branding', 'album-art', 'logo-design']
  assert.deepEqual(slugs(detail.project.services), want)
  assert.deepEqual(slugs(worlds.find((w) => w.slug === 'p-mixed').services), want)
})
