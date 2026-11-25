import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { harness, existingMedia, reference, clientDoc, tagDoc, checkout } from './helpers.mjs'
import { parseManifest } from '../../lib/cms/manifest.mjs'
import { validatePatch, validateDocument, references } from '../../lib/cms/contract.mjs'
import { auditDataset, schemaFields } from '../../lib/cms/audit.mjs'
import { createAdapters } from '../../lib/cms/adapters.mjs'

const project = (id = 'project-example', slug = 'example-project') => ({ _id: id, _type: 'project', _rev: `r-${id}`, slug: { _type: 'slug', current: slug }, client: reference(clientDoc._id), orderRank: '0|100000:' })
const setDoc = (id, key, fields = {}) => ({ _id: id, _type: 'mediaSet', _rev: `r-${id}`, title: key, slug: { _type: 'slug', current: key }, project: reference('project-example'), groupType: 'admat', allowAsHero: false, ...fields })
const piece = (id, fields = {}) => existingMedia(id, { project: reference('project-example'), ...fields })

test('contract: a Set validates its own fields and a piece points at it', () => {
  const doc = { _id: 'mediaSet-a', _type: 'mediaSet', title: 'A', slug: { _type: 'slug', current: 'a-key' }, project: reference('project-example'), groupType: 'admat', allowAsHero: true }
  validateDocument(doc, { creation: true })
  validatePatch('mediaSet', { allowAsHero: false, groupType: 'deck' }, [])
  for (const bad of [{ groupType: 'sequence' }, { allowAsHero: 'yes' }, { allowAsHero: null }, { orderRank: '0|hzzzzz:' }, { project: 'project-example' }]) assert.throws(() => validatePatch('mediaSet', bad, []), undefined, JSON.stringify(bad))
  assert.throws(() => validatePatch('mediaSet', {}, ['title']), /Rejected unset/)
  // A set may exist without a project (Nathan, 11-24: a client's merch, banners or tour admats); its name, key and type stay required.
  validateDocument({ ...doc, project: undefined }, { creation: true })
  for (const k of ['title', 'slug', 'groupType']) assert.throws(() => validateDocument({ ...doc, [k]: undefined }, { creation: true }), new RegExp(`Required ${k}`))
  validatePatch('mediaAsset', { set: reference('mediaSet-a') }, []); validatePatch('mediaAsset', {}, ['set'])
  assert.throws(() => validatePatch('mediaAsset', { set: 'mediaSet-a' }, []))
  assert.throws(() => validatePatch('mediaAsset', { set: null }, []))
  validateDocument(existingMedia('mediaAsset-in-set', { mediaType: 'static_4x5', groupType: 'admat', set: reference('mediaSet-a') }))
  assert.deepEqual(references({ set: reference('mediaSet-a'), project: reference('project-example') }), [{ id: 'project-example', type: 'project' }, { id: 'mediaSet-a', type: 'mediaSet' }])
})

test('a changes request creates a set and links two pieces: creates plan first, apply and verify pass', async t => {
  const h = await harness(t, { docs: [project(), piece('mediaAsset-one'), piece('mediaAsset-two', { orderRank: '0|i00007:' })] })
  const set = setDoc('mediaSet-example-project-tour-admats', 'tour-admats'); delete set._rev
  const p = await h.plan({ changes: await h.changes({ creates: [set], patches: ['mediaAsset-one', 'mediaAsset-two'].map(id => ({ id, type: 'mediaAsset', set: { set: reference(set._id) }, unset: [] })) }) })
  assert.deepEqual(p.operations.map(o => [o.action, o.type, o.id]), [['create', 'mediaSet', set._id], ['patch', 'mediaAsset', 'mediaAsset-one'], ['patch', 'mediaAsset', 'mediaAsset-two']])
  assert.ok(!p.guards.some(g => g.type === 'mediaSet'), 'a set created in the plan needs no revision guard')
  assert.equal(h.stats.commits, 0, 'planning writes nothing')
  const result = await h.apply(p)
  assert.deepEqual([result.created, result.updated, result.failed, result.pending, result.issues], [1, 2, 0, 0, []])
  assert.deepEqual(h.db.get('mediaAsset-one').set, reference(set._id)); assert.deepEqual(h.db.get('mediaAsset-two').set, reference(set._id))
  assert.equal(h.db.get(set._id).slug.current, 'tour-admats'); assert.equal(h.db.get(set._id).allowAsHero, false)
  assert.equal(h.db.get('mediaAsset-one').orderRank, '0|hzzzzz:', 'linking never touches rank')
})

test('refused: a set from another project, a second set on an existing key, a duplicate key in one request, a key patched onto a taken one', async t => {
  const other = setDoc('mediaSet-other-admats', 'other-admats', { project: reference('project-other') })
  const taken = setDoc('mediaSet-taken', 'taken-key')
  const h = await harness(t, { docs: [project(), project('project-other', 'other-project'), other, taken, piece('mediaAsset-one'), { ...piece('mediaAsset-loose'), project: undefined, orderRank: '0|i00007:' }] })
  const link = (id, to) => ({ patches: [{ id, type: 'mediaAsset', set: { set: reference(to) }, unset: [] }] })
  await assert.rejects(h.plan({ changes: await h.changes(link('mediaAsset-one', other._id)) }), /Set\/project mismatch on mediaAsset-one/)
  const create = (id, key) => ({ _id: id, _type: 'mediaSet', title: key, slug: { _type: 'slug', current: key }, project: reference('project-example'), groupType: 'admat', allowAsHero: false })
  await assert.rejects(h.plan({ changes: await h.changes({ creates: [create('mediaSet-second', 'taken-key')] }) }), /Set key taken-key already belongs to mediaSet-taken/)
  await assert.rejects(h.plan({ changes: await h.changes({ creates: [create('mediaSet-new-a', 'fresh-key'), create('mediaSet-new-b', 'fresh-key')] }) }), /Set key fresh-key already belongs to mediaSet-new-a/)
  await assert.rejects(h.plan({ changes: await h.changes({ patches: [{ id: 'mediaSet-other-admats', type: 'mediaSet', set: { slug: { _type: 'slug', current: 'taken-key' } }, unset: [] }] }) }), /Set key taken-key already belongs to mediaSet-taken/)
  assert.deepEqual([h.stats.commits, h.stats.images, h.stats.uploads], [0, 0, 0], 'a refused plan writes nothing')
  // A piece with no project joins only a set with no project (retirement step 2, 11-25), and a project's piece never joins one.
  await assert.rejects(h.plan({ changes: await h.changes(link('mediaAsset-loose', 'mediaSet-taken')) }), /Set\/project mismatch on mediaAsset-loose: its set belongs to another project/)
  const looseSet = create('mediaSet-loose-banners', 'loose-banners'); delete looseSet.project
  const loose = await h.plan({ changes: await h.changes({ creates: [looseSet], patches: link('mediaAsset-loose', looseSet._id).patches }) })
  assert.deepEqual(loose.operations.map(o => [o.action, o.id]), [['create', 'mediaSet-loose-banners'], ['patch', 'mediaAsset-loose']])
  await assert.rejects(h.plan({ changes: await h.changes({ creates: [looseSet], patches: link('mediaAsset-one', looseSet._id).patches }) }), /Set\/project mismatch on mediaAsset-one: its set belongs to no project/)
  // A set keeps its own key when patched to it.
  await h.plan({ changes: await h.changes({ patches: [{ id: 'mediaSet-taken', type: 'mediaSet', set: { slug: { _type: 'slug', current: 'taken-key' }, allowAsHero: true }, unset: [] }] }) })
  // A dangling set reference is refused like any other.
  await assert.rejects(h.plan({ changes: await h.changes(link('mediaAsset-one', 'mediaSet-nowhere')) }), /Unresolved\/wrong-type mediaSet reference/)
})

test('intake: a row joins the set its displayGroup names, a missing set is created first, album art gets its project set', async t => {
  const table = rows => `# Collection\nclient: Example\nservices: branding\nproject: example-project\n\n| file | mediaType | title | displayGroup | groupType | sanityId |\n|---|---|---|---|---|---|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`
  const existing = setDoc('mediaSet-example-project-existing-group', 'existing-group', { groupType: 'merch' })
  const elsewhere = setDoc('mediaSet-other-brand-guidelines-deck', 'brand-guidelines-deck', { project: reference('project-other'), groupType: 'deck' })
  const h = await harness(t, { docs: [project(), project('project-other', 'other-project'), existing, elsewhere] })
  const rows = [['a.jpg', 'static_1x1', 'A', 'tour-admats', 'admat', ''], ['b.jpg', 'static_1x1', 'B', 'tour-admats', 'admat', ''], ['c.jpg', 'album-art', 'C', '', 'album-art', ''], ['d.jpg', 'static_1x1', 'D', 'loose-group', '', ''],
    ['e.jpg', 'static_1x1', 'E', 'brand-guidelines-deck', 'deck', ''], ['f.jpg', 'static_1x1', 'F', 'existing-group', 'merch', '']]
  for (const [file] of rows) await h.file(file)
  const manifest = path.join(h.media, '_manifest.md'); await writeFile(manifest, table(rows))
  const p = await h.plan({ manifest })
  const types = p.operations.map(o => `${o.type}:${o.id}`)
  assert.deepEqual(p.operations.filter(o => o.type === 'mediaSet').map(o => [o.id, o.after.slug.current, o.after.groupType, o.after.allowAsHero]), [
    ['mediaSet-example-project-tour-admats', 'tour-admats', 'admat', false],
    ['mediaSet-example-project-example-project-album-art', 'example-project-album-art', 'album-art', false],
    ['mediaSet-example-project-brand-guidelines-deck-example-project', 'brand-guidelines-deck-example-project', 'deck', false]], 'one set per key; a key another project holds becomes per-project')
  const at = id => types.findIndex(x => x.endsWith(`:${id}`)), assetOf = title => p.operations.find(o => o.after.title === title)
  for (const title of ['A', 'B', 'C', 'E']) assert.ok(at(assetOf(title).after.set._ref) < at(assetOf(title).id), `the set for ${title} is created before the piece`)
  assert.deepEqual([assetOf('A').after.set, assetOf('B').after.set].map(s => s._ref), ['mediaSet-example-project-tour-admats', 'mediaSet-example-project-tour-admats'])
  assert.equal(assetOf('D').after.set, undefined); assert.match(p.informational.join('\n'), /d\.jpg: displayGroup loose-group has no set in example-project and no groupType column/)
  assert.equal(assetOf('F').after.set._ref, existing._id); assert.ok(!types.includes(`mediaSet:${existing._id}`), 'an existing set is linked, not recreated')
  assert.equal(p.operations.filter(o => o.type === 'mediaAsset').every(o => o.set.orderRank), true, 'ranks go to pieces only')
  const result = await h.apply(p)
  assert.deepEqual([result.created, result.failed, result.pending, result.issues], [9, 0, 0, []])
  assert.deepEqual(h.db.get(assetOf('A').id).set, reference('mediaSet-example-project-tour-admats'))
  assert.equal(h.db.get(assetOf('A').id).displayGroup, 'tour-admats'); assert.equal(h.db.get(assetOf('A').id).groupType, 'admat', 'the legacy fields are still written')
  const bound = parseManifest(await readFile(manifest, 'utf8')).assets
  assert.deepEqual(bound.map(r => r.sanityid), p.operations.filter(o => o.type === 'mediaAsset').map(o => o.id), 'only pieces are written back to the manifest')
  // Rerunning is a no-op: every row is bound, so no set is planned again.
  const again = await h.plan({ manifest })
  assert.deepEqual([...new Set(again.operations.map(o => o.action))], ['unchanged'])
})

test('audit: a dataset with no sets has 0 errors and only info set-missing findings', () => {
  const image = id => ({ _id: id, _type: 'sanity.imageAsset', sha1hash: id, metadata: { dimensions: { width: 1000, height: 1000 } } })
  const cover = (id, fields) => piece(id, { title: id, slug: { _type: 'slug', current: id.toLowerCase() }, alt: 'A still.', description: 'A description.', image: { _type: 'image', asset: reference(`image-${id}`) }, ...fields })
  const docs = [clientDoc, tagDoc, project(), cover('mediaAsset-cover', { mediaType: 'album-art', groupType: 'album-art', releaseInfo: { releaseTitle: 'x' }, orderRank: '0|100000:' }), cover('mediaAsset-admat', { groupType: 'admat', displayGroup: 'tour-admats', orderRank: '0|200000:' }), cover('mediaAsset-plain', { orderRank: '0|300000:' }),
    image('image-mediaAsset-cover'), image('image-mediaAsset-admat'), image('image-mediaAsset-plain')]
  const report = auditDataset({ target: { projectId: 'offline123', dataset: 'test' }, docs })
  assert.equal(report.summary.errors, 0)
  assert.deepEqual(report.findings.map(f => [f.check, f.severity, f.items.map(i => i.id)]), [['set-missing', 'info', ['mediaAsset-cover', 'mediaAsset-admat']]])
})

test('matching sets audit clean, and the same dataset with a drifted member reports set-drift', async () => {
  const image = id => ({ _id: id, _type: 'sanity.imageAsset', sha1hash: id, metadata: { dimensions: { width: 1000, height: 1000 } } })
  const deck = setDoc('mediaSet-example-project-tour-admats', 'tour-admats')
  const member = piece('mediaAsset-admat', { title: 'x', slug: { _type: 'slug', current: 'x' }, alt: 'A.', description: 'D.', image: { _type: 'image', asset: reference('image-x') }, groupType: 'admat', displayGroup: 'tour-admats', set: reference(deck._id) })
  const audit = docs => auditDataset({ target: { projectId: 'offline123', dataset: 'test' }, docs: [clientDoc, tagDoc, project(), deck, image('image-x'), ...docs], schema })
  const schema = await schemaFields(checkout)
  assert.deepEqual(audit([member]).findings, [])
  const drifted = audit([{ ...member, displayGroup: 'old-admats' }]).findings
  assert.deepEqual(drifted.map(f => [f.check, f.severity, f.items.map(i => [i.field, i.value, i.setValue])]), [['set-drift', 'info', [['displayGroup', 'old-admats', 'tour-admats']]]])
})

test('adapter: findSets reads every Set document, drafts included, with a parameterised raw query', async () => {
  const calls = []
  const adapters = await createAdapters({ target: { projectId: 'test123', dataset: 'test' }, env: { SANITY_READ_TOKEN: 'fake' }, dependencies: { createSanityClient: () => ({ async fetch(...args) { calls.push(args); return [] } }) } })
  await adapters.sanity.findSets()
  assert.equal(calls.length, 1); assert.match(calls[0][0], /_type == "mediaSet"/); assert.deepEqual(calls[0][2], { perspective: 'raw', cache: 'no-store' })
})
