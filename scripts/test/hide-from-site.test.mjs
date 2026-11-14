/**
 * "Hide from site" (mediaAsset.hideFromSite): a ticked piece is skipped by every
 * site read. The queries are the real exports of src/lib/queries.js, run through
 * groq-js over an in-memory dataset; the contract and the audit are the real
 * modules. Nothing here reaches Sanity.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parse, evaluate } from 'groq-js'
import * as queries from '../../src/lib/queries.js'
import { FEATURED_PROJECT_PATHS_QUERY, GLOBE_ASSETS_QUERY, FEATURED_PROJECT_DETAIL_QUERY, FEATURED_WORLDS_QUERY, DIRECTORY_QUERY } from '../../src/lib/queries.js'
import { FIELDS, SUPPORTED_SCHEMA_HASH, schemaHash, validatePatch, validateField, validateDocument } from '../lib/cms/contract.mjs'
import { auditDataset, schemaFields } from '../lib/cms/audit.mjs'
import { checkout, clientDoc, reference, existingMedia, harness } from './cms/helpers.mjs'

const CLAUSE = 'hideFromSite != true'

// ── (a) every mediaAsset-selecting filter in the site's GROQ carries the clause ──

/** The text of every filter `[...]` that opens with `_type == "mediaAsset"`, brackets and strings respected. */
function mediaFilters(source) {
  const found = []
  for (const match of source.matchAll(/\*\[\s*_type == "mediaAsset"/g)) {
    const open = match.index + 1
    let depth = 0, quoted = false, end = -1
    for (let i = open; i < source.length; i++) {
      const c = source[i]
      if (c === '"' && source[i - 1] !== '\\') quoted = !quoted
      else if (!quoted && c === '[') depth++
      else if (!quoted && c === ']' && --depth === 0) { end = i; break }
    }
    assert.ok(end > open, `unterminated mediaAsset filter near: ${source.slice(match.index, match.index + 60)}`)
    found.push(source.slice(open, end + 1))
  }
  return found
}
/** The filter of every `picks[...]->` dereference (the globe's hand-picked panels). */
const pickFilters = source => [...source.matchAll(/\bpicks\[([^\]]*)\]->/g)].map(m => m[1])

const siteQueries = Object.entries(queries).filter(([name, v]) => name.endsWith('_QUERY') && typeof v === 'string')

test('every exported query is parsed from the real module, and each mediaAsset selection carries the hidden clause', () => {
  assert.ok(siteQueries.length >= 6, 'the query exports were found')
  let selections = 0
  for (const [name, source] of siteQueries) {
    for (const filter of mediaFilters(source)) { selections++; assert.ok(filter.includes(CLAUSE), `${name}: a mediaAsset filter lacks "${CLAUSE}": ${filter.slice(0, 120)}`) }
  }
  // 3 (paths) + 2 (globe) + 2 (detail) + 3 (worlds) + 1 (directory) + the world rows the directory embeds
  assert.ok(selections >= 11, `only ${selections} mediaAsset selections were found; the parser lost some`)
})

test('the globe picks dereference only visible targets', () => {
  const filters = pickFilters(GLOBE_ASSETS_QUERY)
  assert.equal(filters.length, 1, 'the picks dereference was found')
  assert.ok(filters[0].includes(CLAUSE), `picks filter lacks the clause: ${filters[0]}`)
})

// ── the queries run over a dataset with hidden pieces ──

const run = async (source, dataset, params = {}) => (await evaluate(parse(source), { dataset, params })).get()
const key = id => ({ ...reference(id), _key: id })
const mux = (id, playbackId = `play-${id}`) => ({ _id: id, _type: 'mux.videoAsset', playbackId, data: { status: 'ready', aspect_ratio: '16:9', duration: 20 } })
const img = id => ({ _id: id, _type: 'sanity.imageAsset', url: `https://cdn.example/${id}.jpg`, metadata: { dimensions: { width: 1000, height: 1000 }, hasAlpha: false, isOpaque: true } })
const clip = (id, fields) => ({ _id: id, _type: 'mediaAsset', title: id, mediaType: 'motion_16x9', sourceFolder: 'folder', client: reference('client'), video: { _type: 'mux.video', asset: reference(`mux-${id}`) }, ...fields })
const still = (id, fields) => ({ _id: id, _type: 'mediaAsset', title: id, mediaType: 'static_1x1', client: reference('client'), image: { _type: 'image', asset: reference(`img-${id}`) }, ...fields })
const proj = (id, orderRank) => ({ _id: id, _type: 'project', title: id, slug: { current: id }, client: reference('client'), isFeatured: true, orderRank })

/** P1: m1 (first ranked, HIDDEN reel), m2 (reel), m3 (still, tagged "shown"), m4 (HIDDEN still, the only one tagged "only-hidden").
 *  P2: every piece hidden. Globe picks: m2, m1 (hidden), m3. */
const build = (hidden = { m1: true, m4: true, h1: true, h2: true }) => {
  const h = id => (hidden[id] === undefined ? {} : { hideFromSite: hidden[id] })
  return [
    { _id: 'client', _type: 'client', name: 'Client', slug: { current: 'client' } },
    { _id: 'tag-shown', _type: 'serviceTag', name: 'Shown', slug: { current: 'shown' }, sortOrder: 1 },
    { _id: 'tag-only-hidden', _type: 'serviceTag', name: 'Only hidden', slug: { current: 'only-hidden' }, sortOrder: 2 },
    proj('p1', '0|a:'), proj('p2', '0|b:'),
    clip('m1', { orderRank: '0|a:', sourceManifest: 'col-a', project: reference('p1'), ...h('m1') }), mux('mux-m1'),
    clip('m2', { orderRank: '0|b:', sourceManifest: 'col-b', project: reference('p1'), ...h('m2') }), mux('mux-m2'),
    still('m3', { orderRank: '0|c:', sourceManifest: 'col-b', project: reference('p1'), services: [key('tag-shown')], ...h('m3') }), img('img-m3'),
    still('m4', { orderRank: '0|d:', sourceManifest: 'col-b', project: reference('p1'), services: [key('tag-only-hidden')], ...h('m4') }), img('img-m4'),
    still('h1', { orderRank: '0|a:', sourceManifest: 'col-p2', project: reference('p2'), services: [key('tag-only-hidden')], ...h('h1') }), img('img-h1'),
    clip('h2', { orderRank: '0|b:', sourceManifest: 'col-p2', project: reference('p2'), ...h('h2') }), mux('mux-h2'),
    { _id: 'globeSettings', _type: 'globeSettings', picks: [key('m2'), key('m1'), key('m3')] },
    { _id: 'siteSettings', _type: 'siteSettings', directoryShuffle: false },
  ]
}
const ids = rows => rows.map(r => r._id)

test('hidden pieces are absent from every site query result (project page, /work worlds, directory, globe)', async () => {
  const data = build()
  const detail = await run(FEATURED_PROJECT_DETAIL_QUERY, data, { projectId: 'p1' })
  assert.deepEqual(ids(detail.assets), ['m2', 'm3'])
  assert.deepEqual((await run(FEATURED_PROJECT_DETAIL_QUERY, data, { projectId: 'p2' })).assets, [])
  const worlds = await run(FEATURED_WORLDS_QUERY, data)
  assert.deepEqual(ids(worlds.find(w => w.slug === 'p1').assets), ['m2', 'm3'])
  assert.deepEqual(worlds.find(w => w.slug === 'p2').assets, [])
  const directory = await run(DIRECTORY_QUERY, data)
  assert.deepEqual(ids(directory.assets).sort(), ['m2', 'm3'])
  const globe = await run(GLOBE_ASSETS_QUERY, data)
  assert.ok(!ids(globe.autoFill).includes('m1') && !ids(globe.autoFill).includes('h2'), 'auto-fill skips hidden reels')
  assert.deepEqual(ids(globe.autoFill), ['m2'])
})

test('the first-ranked piece hidden: the next visible one by orderRank is the hero, never an empty hero', async () => {
  const data = build()
  const paths = await run(FEATURED_PROJECT_PATHS_QUERY, data)
  const p1 = paths.find(r => r.slug === 'p1')
  assert.equal(p1.hero.playbackId, 'play-mux-m2')
  assert.equal(p1.collection, 'col-b', 'the route/title fallback reads the first VISIBLE piece')
  const globe = await run(GLOBE_ASSETS_QUERY, data)
  assert.deepEqual(ids(globe.heroes.filter(Boolean)), ['m2'])
  // unhidden, the first-ranked piece is the hero again
  const back = await run(FEATURED_PROJECT_PATHS_QUERY, build({}))
  assert.equal(back.find(r => r.slug === 'p1').hero.playbackId, 'play-mux-m1')
  assert.equal(back.find(r => r.slug === 'p1').collection, 'col-a')
})

test('a globe pick pointing at a hidden piece is skipped: no hole, no null', async () => {
  const globe = await run(GLOBE_ASSETS_QUERY, build())
  assert.deepEqual(ids(globe.picks), ['m2', 'm3'])
  assert.ok(globe.picks.every(Boolean))
  assert.deepEqual(ids((await run(GLOBE_ASSETS_QUERY, build({}))).picks), ['m2', 'm1', 'm3'], 'unticked, the pick returns in place')
})

test('a service tag or collection made only of hidden pieces does not appear', async () => {
  const data = build()
  const paths = await run(FEATURED_PROJECT_PATHS_QUERY, data)
  assert.deepEqual(paths.find(r => r.slug === 'p1').services.map(s => s.slug), ['shown'], 'the tag only a hidden piece carries is gone')
  const p2 = paths.find(r => r.slug === 'p2')
  assert.deepEqual(p2.services, [])
  assert.equal(p2.collection ?? null, null)
  assert.equal(p2.hero ?? null, null)
  const detail = await run(FEATURED_PROJECT_DETAIL_QUERY, data, { projectId: 'p1' })
  assert.deepEqual(detail.project.services.map(s => s.slug), ['shown'])
  const worlds = await run(FEATURED_WORLDS_QUERY, data)
  assert.deepEqual(worlds.find(w => w.slug === 'p2').services, [])
})

test('content that predates the field reads unchanged: field missing, false and null give identical results', async () => {
  const missing = build({}), off = build({ m1: false, m2: false, m3: false, m4: false, h1: false, h2: false }), nulled = build({ m1: null, m2: null })
  for (const [name, source] of siteQueries) {
    const params = { projectId: 'p1' }
    const base = await run(source, missing, params)
    assert.deepEqual(await run(source, off, params), base, `${name}: false reads like missing`)
    assert.deepEqual(await run(source, nulled, params), base, `${name}: null reads like missing`)
  }
  // and the dataset with nothing hidden still has its first piece as hero
  const paths = await run(FEATURED_PROJECT_PATHS_QUERY, missing)
  assert.equal(paths.find(r => r.slug === 'p1').hero.playbackId, 'play-mux-m1')
})

// ── (b) the runner contract ──

test('the contract accepts hideFromSite true/false on a mediaAsset and refuses anything else', () => {
  assert.ok(FIELDS.mediaAsset.includes('hideFromSite'), 'in the mediaAsset allowlist')
  assert.ok(!FIELDS.project.includes('hideFromSite'), 'only a mediaAsset can be hidden')
  validatePatch('mediaAsset', { hideFromSite: true })
  validatePatch('mediaAsset', { hideFromSite: false })
  validatePatch('mediaAsset', {}, ['hideFromSite'])
  for (const bad of ['true', 'yes', 1, 0, [], {}]) assert.throws(() => validatePatch('mediaAsset', { hideFromSite: bad }), /Invalid hideFromSite/, `refuses ${JSON.stringify(bad)}`)
  assert.throws(() => validateField('hideFromSite', null), /unset/)
  assert.throws(() => validatePatch('project', { hideFromSite: true }), /Rejected set field: hideFromSite/)
  validateDocument({ ...existingMedia('mediaAsset-x', { orderRank: '0|a:' }), hideFromSite: true })
})

test('the Studio schema defines the field and the runner fingerprint was refreshed with it', async () => {
  const schema = await readFile(new URL('../../src/schemas/mediaAsset.ts', import.meta.url), 'utf8')
  const field = /name: 'hideFromSite',([\s\S]*?)\n    \}\),/.exec(schema)?.[1] ?? ''
  assert.match(field, /type: 'boolean'/)
  assert.match(field, /initialValue: false/)
  assert.match(field, /title: 'Hide from site'/)
  assert.equal(await schemaHash(checkout), SUPPORTED_SCHEMA_HASH)
})

test('a changes request sets hideFromSite true then false: the plan prints before/after, apply keeps rank and set', async t => {
  const old = existingMedia('mediaAsset-flip', { orderRank: '0|i00001:' })
  const h = await harness(t, { docs: [old] })
  const flip = async value => {
    const plan = await h.plan({ changes: await h.changes({ patches: [{ id: old._id, type: 'mediaAsset', set: { hideFromSite: value }, unset: [] }] }) })
    return { plan, op: plan.operations.find(o => o.id === old._id) ?? plan.operations[0] }
  }
  const hide = await flip(true)
  assert.equal(hide.op.before.hideFromSite, undefined)
  assert.equal(hide.op.after.hideFromSite, true)
  await h.apply(hide.plan)
  assert.equal(h.db.get(old._id).hideFromSite, true)
  const show = await flip(false)
  assert.equal(show.op.before.hideFromSite, true)
  assert.equal(show.op.after.hideFromSite, false)
  await h.apply(show.plan)
  const back = h.db.get(old._id)
  assert.equal(back.hideFromSite, false)
  for (const k of ['orderRank', 'groupType', 'project', 'title']) assert.deepEqual(back[k], old[k], `${k} untouched`)
  await assert.rejects(h.changes({ patches: [{ id: old._id, type: 'mediaAsset', set: { hideFromSite: 'yes' }, unset: [] }] }).then(changes => h.plan({ changes })), /Invalid hideFromSite/)
})

// ── the audit ──

test('the audit lists a hidden piece as one info row, never an error or warning, and keeps its image in use', async () => {
  const hidden = existingMedia('mediaAsset-hidden', { title: 'Not announced', hideFromSite: true, alt: 'A still.', description: 'A description.', image: { _type: 'image', asset: reference('image-hidden') }, services: undefined })
  const image = { _id: 'image-hidden', _type: 'sanity.imageAsset', sha1hash: 'h', metadata: { dimensions: { width: 1000, height: 1000 } } }
  const report = auditDataset({ target: { projectId: 'offline123', dataset: 'test' }, docs: [clientDoc, hidden, image], schema: await schemaFields(checkout) })
  assert.deepEqual(report.findings.map(f => [f.check, f.severity]), [['hidden-from-site', 'info']])
  assert.deepEqual(report.findings[0].items, [{ id: 'mediaAsset-hidden', title: 'Not announced' }])
  assert.deepEqual(report.summary, { errors: 0, warnings: 0, infos: 1 })
})
