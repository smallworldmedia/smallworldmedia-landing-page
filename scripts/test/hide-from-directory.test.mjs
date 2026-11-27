/**
 * "Hide from Project Directory" (mediaAsset.hideFromDirectory): a ticked piece is
 * skipped by the Project Directory's read ONLY; its project page, the /featured-projects worlds
 * and the home globe keep it, and its tags still count for its project. The queries
 * are the real exports of src/lib/queries.js, run through groq-js over an in-memory
 * dataset; the contract is the real module. Nothing here reaches Sanity.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, evaluate } from 'groq-js'
import * as queries from '../../src/lib/queries.js'
import { FEATURED_PROJECT_PATHS_QUERY, GLOBE_ASSETS_QUERY, FEATURED_PROJECT_DETAIL_QUERY, FEATURED_WORLDS_QUERY, DIRECTORY_QUERY } from '../../src/lib/queries.js'
import { FIELDS, SUPPORTED_SCHEMA_HASH, schemaHash, validatePatch, validateField, validateDocument } from '../lib/cms/contract.mjs'
import { checkout, reference, existingMedia } from './cms/helpers.mjs'

const run = async (source, dataset, params = {}) => (await evaluate(parse(source), { dataset, params })).get()
const key = id => ({ ...reference(id), _key: id })
const img = id => ({ _id: id, _type: 'sanity.imageAsset', url: `https://cdn.example/${id}.jpg`, metadata: { dimensions: { width: 1000, height: 1000 }, hasAlpha: false, isOpaque: true } })
const mux = id => ({ _id: id, _type: 'mux.videoAsset', playbackId: `play-${id}`, data: { status: 'ready', aspect_ratio: '16:9', duration: 20 } })
const still = (id, fields) => ({ _id: id, _type: 'mediaAsset', title: id, mediaType: 'static_1x1', client: reference('client'), project: reference('p1'), image: { _type: 'image', asset: reference(`img-${id}`) }, ...fields })

/** P1: m1 (a reel, the hero), m2 (a still tagged "shown"), e1 + e2 (event photos, the only pieces tagged "photo"). */
const build = (flags = { e1: true, e2: true }) => {
  const f = id => (flags[id] === undefined ? {} : { hideFromDirectory: flags[id] })
  return [
    { _id: 'client', _type: 'client', name: 'Client', slug: { current: 'client' } },
    { _id: 'tag-shown', _type: 'serviceTag', name: 'Shown', slug: { current: 'shown' }, sortOrder: 1 },
    { _id: 'tag-photo', _type: 'serviceTag', name: 'Photo', slug: { current: 'photo' }, sortOrder: 2 },
    { _id: 'p1', _type: 'project', title: 'p1', slug: { current: 'p1' }, client: reference('client'), isFeatured: true, orderRank: '0|a:' },
    { _id: 'm1', _type: 'mediaAsset', title: 'm1', mediaType: 'motion_16x9', sourceFolder: 'folder', sourceManifest: 'col', client: reference('client'), project: reference('p1'), orderRank: '0|a:', video: { _type: 'mux.video', asset: reference('mux-m1') }, ...f('m1') }, mux('mux-m1'),
    still('m2', { orderRank: '0|b:', services: [key('tag-shown')], ...f('m2') }), img('img-m2'),
    still('e1', { orderRank: '0|c:', services: [key('tag-photo')], ...f('e1') }), img('img-e1'),
    still('e2', { orderRank: '0|d:', services: [key('tag-photo')], ...f('e2') }), img('img-e2'),
    { _id: 'globeSettings', _type: 'globeSettings', picks: [key('e1'), key('m2')] },
    { _id: 'siteSettings', _type: 'siteSettings', directoryShuffle: false },
  ]
}
const ids = rows => rows.map(r => r._id)

test('the directory skips a ticked piece; the project page, /featured-projects and the globe keep it', async () => {
  const data = build()
  assert.deepEqual(ids((await run(DIRECTORY_QUERY, data)).assets).sort(), ['m1', 'm2'])
  assert.deepEqual(ids((await run(FEATURED_PROJECT_DETAIL_QUERY, data, { projectId: 'p1' })).assets), ['m1', 'm2', 'e1', 'e2'])
  assert.deepEqual(ids((await run(FEATURED_WORLDS_QUERY, data)).find(w => w.slug === 'p1').assets), ['m1', 'm2', 'e1', 'e2'])
  assert.deepEqual(ids((await run(GLOBE_ASSETS_QUERY, data)).picks), ['e1', 'm2'])
})

test("a ticked piece's tags still count for its project (only the directory tile goes)", async () => {
  const data = build()
  const p1 = (await run(FEATURED_PROJECT_PATHS_QUERY, data)).find(r => r.slug === 'p1')
  assert.deepEqual(p1.services.map(s => s.slug), ['shown', 'photo'])
  const detail = await run(FEATURED_PROJECT_DETAIL_QUERY, data, { projectId: 'p1' })
  assert.deepEqual(detail.project.services.map(s => s.slug), ['shown', 'photo'])
})

test('only the directory read carries the clause, once', () => {
  const carriers = Object.entries(queries).filter(([name, v]) => name.endsWith('_QUERY') && typeof v === 'string' && v.includes('hideFromDirectory != true'))
  assert.deepEqual(carriers.map(([name]) => name), ['DIRECTORY_QUERY'])
  assert.equal(DIRECTORY_QUERY.split('hideFromDirectory != true').length, 2)
})

test('content that predates the field reads unchanged: missing, false and null give identical directory results', async () => {
  const missing = await run(DIRECTORY_QUERY, build({}))
  assert.deepEqual(await run(DIRECTORY_QUERY, build({ m1: false, m2: false, e1: false, e2: false })), missing)
  assert.deepEqual(await run(DIRECTORY_QUERY, build({ e1: null, e2: null })), missing)
  assert.deepEqual(ids(missing.assets).sort(), ['e1', 'e2', 'm1', 'm2'])
})

test('the contract accepts hideFromDirectory true/false on a mediaAsset and refuses anything else', () => {
  assert.ok(FIELDS.mediaAsset.includes('hideFromDirectory'), 'in the mediaAsset allowlist')
  assert.ok(!FIELDS.project.includes('hideFromDirectory'), 'only a mediaAsset can be hidden from the directory')
  validatePatch('mediaAsset', { hideFromDirectory: true })
  validatePatch('mediaAsset', { hideFromDirectory: false })
  validatePatch('mediaAsset', {}, ['hideFromDirectory'])
  for (const bad of ['true', 'yes', 1, 0, [], {}]) assert.throws(() => validatePatch('mediaAsset', { hideFromDirectory: bad }), /Invalid hideFromDirectory/, `refuses ${JSON.stringify(bad)}`)
  assert.throws(() => validateField('hideFromDirectory', null), /unset/)
  validateDocument({ ...existingMedia('mediaAsset-x', { orderRank: '0|a:' }), hideFromDirectory: true })
})

test('the Studio schema defines the field and the runner fingerprint was refreshed with it', async () => {
  const schema = await readFile(new URL('../../src/schemas/mediaAsset.ts', import.meta.url), 'utf8')
  const field = /name: 'hideFromDirectory',([\s\S]*?)\n    \}\),/.exec(schema)?.[1] ?? ''
  assert.match(field, /type: 'boolean'/)
  assert.match(field, /initialValue: false/)
  assert.match(field, /title: 'Hide from Project Directory'/)
  assert.equal(await schemaHash(checkout), SUPPORTED_SCHEMA_HASH)
})
