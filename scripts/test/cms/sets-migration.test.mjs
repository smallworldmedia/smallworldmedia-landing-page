import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, readdir, readFile, rm, realpath } from 'node:fs/promises'
import { harness, existingMedia, reference, clientDoc } from './helpers.mjs'
import { planSetsMigration, summaryLines, main, FILE_PREFIX } from '../../cms-sets-migration.mjs'

const project = (id, slug, orderRank) => ({ _id: id, _type: 'project', _rev: `r-${id}`, slug: { _type: 'slug', current: slug }, client: reference(clientDoc._id), orderRank })
const rank = n => `0|${String(n).padStart(6, '0')}:`
let next = 0
// A piece of `projectId` in `displayGroup` (or, with none, loose); `fields` overrides anything.
const piece = (projectId, displayGroup, fields = {}) => existingMedia(`mediaAsset-${++next}`, { project: projectId ? reference(projectId) : undefined, displayGroup, orderRank: rank(next), ...fields })
const many = (n, projectId, displayGroup, fields) => Array.from({ length: n }, () => piece(projectId, displayGroup, fields))

const alpha = project('project-alpha', 'alpha', '0|100000:'), beta = project('project-beta', 'beta', '0|200000:'), gamma = project('project-gamma', 'gamma', '0|300000:')
function fixture() {
  next = 0
  const twin = piece('project-beta', 'twin-group', { groupType: 'deck' })
  return [clientDoc, alpha, beta, gamma,
    // the same deck key in two projects: split per project, deck sets can lead, so they start ON
    ...many(2, 'project-alpha', 'brand-guidelines-deck', { groupType: 'deck' }), piece('project-alpha', 'brand-guidelines-deck'),
    ...many(2, 'project-beta', 'brand-guidelines-deck', { groupType: 'deck' }),
    ...many(2, 'project-alpha', 'tour-admats', { groupType: 'admat' }),
    // album art: by groupType or mediaType, a project, no displayGroup; with no project it is left alone
    piece('project-alpha', undefined, { mediaType: 'album-art' }), piece('project-alpha', undefined, { groupType: 'album-art' }), piece(undefined, undefined, { mediaType: 'album-art' }),
    // reported, never guessed
    ...many(2, 'project-beta', 'mystery-group'), piece('project-beta', 'mixed-group', { groupType: 'admat' }), piece('project-beta', 'mixed-group', { groupType: 'merch' }),
    piece(undefined, 'orphan-group', { groupType: 'merch' }),
    twin, piece('project-beta', 'twin-group', { groupType: 'deck' }), { ...twin, _id: `drafts.${twin._id}` },
    // an ordinary piece with neither a group nor album art is nobody's member
    piece('project-alpha', undefined, { mediaType: 'static_1x1' }),
  ]
}
const byKey = result => Object.fromEntries(result.sets.map(s => [s.key, s]))
const opsOf = f => f.request.creates.length + f.request.patches.length

test('planSetsMigration: split deck per project, album-art set, deck allowAsHero true, no-type set reported not created', () => {
  const result = planSetsMigration(fixture()), sets = byKey(result)
  assert.deepEqual(Object.keys(sets), ['alpha-album-art', 'brand-guidelines-deck-alpha', 'tour-admats', 'brand-guidelines-deck-beta'], 'ordered by project orderRank, then key')
  assert.deepEqual(['brand-guidelines-deck-alpha', 'brand-guidelines-deck-beta'].map(k => [sets[k].id, sets[k].groupType, sets[k].allowAsHero, sets[k].members]), [
    ['mediaSet-alpha-brand-guidelines-deck-alpha', 'deck', true, 3], ['mediaSet-beta-brand-guidelines-deck-beta', 'deck', true, 2]])
  assert.deepEqual([sets['alpha-album-art'].id, sets['alpha-album-art'].groupType, sets['alpha-album-art'].allowAsHero, sets['alpha-album-art'].members], ['mediaSet-alpha-alpha-album-art', 'album-art', false, 2])
  assert.deepEqual([sets['tour-admats'].groupType, sets['tour-admats'].allowAsHero], ['admat', false])
  const creates = result.files.flatMap(f => f.request.creates)
  assert.deepEqual(creates.find(c => c._id === 'mediaSet-beta-brand-guidelines-deck-beta'), { _id: 'mediaSet-beta-brand-guidelines-deck-beta', _type: 'mediaSet', title: 'Brand guidelines deck beta', slug: { _type: 'slug', current: 'brand-guidelines-deck-beta' }, project: reference('project-beta'), groupType: 'deck', allowAsHero: true })
  assert.deepEqual(creates.filter(c => c.allowAsHero).map(c => c.groupType), ['deck', 'deck'], 'deck sets only')
  // reported, not created
  assert.ok(!('mystery-group' in sets) && !('mixed-group' in sets) && !('twin-group' in sets))
  assert.deepEqual(result.reported.noType.map(r => [r.key, r.project, r.members]), [['mystery-group', 'beta', 2]])
  assert.deepEqual(result.reported.mixedType.map(r => [r.key, r.values]), [['mixed-group', ['admat', 'merch']]])
  assert.deepEqual(result.reported.noProject.map(r => r.displayGroup), ['orphan-group'])
  assert.deepEqual(result.reported.draftTwin.map(r => [r.key, r.pieces.length]), [['twin-group', 1]])
  assert.equal(result.notes.albumArtWithoutProject, 1)
  // members get only `set`; legacy fields and the rest stay put
  for (const patch of result.files.flatMap(f => f.request.patches)) assert.deepEqual(Object.keys(patch.set), ['set'])
  const text = summaryLines(result).join('\n')
  assert.match(text, /4 sets \(4 to create, 9 piece links\) in 1 request files/); assert.match(text, /REPORTED 1 sets whose members carry no groupType/)
})

test('planSetsMigration: files hold at most 100 operations, keep each set with its members, and are deterministic', () => {
  next = 0
  const docs = [clientDoc, alpha, beta, gamma, ...many(60, 'project-alpha', 'set-a', { groupType: 'merch' }), ...many(50, 'project-alpha', 'set-b', { groupType: 'merch' }), ...many(30, 'project-beta', 'set-c', { groupType: 'merch' }), ...many(100, 'project-gamma', 'set-d', { groupType: 'merch' })]
  const result = planSetsMigration(docs)
  assert.deepEqual(result.files.map(f => [f.name, opsOf(f), f.sets]), [[`${FILE_PREFIX}1.json`, 61, ['mediaSet-alpha-set-a']], [`${FILE_PREFIX}2.json`, 82, ['mediaSet-alpha-set-b', 'mediaSet-beta-set-c']]])
  for (const f of result.files) {
    assert.ok(opsOf(f) <= 100)
    for (const id of f.sets) assert.ok(f.request.creates.some(c => c._id === id) && f.request.patches.some(p => p.set.set._ref === id), `${id}: create and members in one file`)
    assert.deepEqual([...new Set(f.request.patches.map(p => p.set.set._ref))].sort(), [...f.sets].sort(), 'no member points at a set from another file')
  }
  assert.deepEqual(result.reported.tooLarge.map(r => [r.key, r.members]), [['set-d', 100]], '1 create + 100 members cannot stay together under the runner limit')
  assert.deepEqual(planSetsMigration(docs), result, 'the same dataset plans the same files')
  assert.deepEqual(planSetsMigration([...docs].reverse()).files.map(f => f.sets), result.files.map(f => f.sets), 'input order does not matter')
  // members run in orderRank order
  const first = result.files[0].request.patches.map(p => p.id)
  assert.deepEqual(first, [...first].sort((a, b) => docs.find(d => d._id === a).orderRank < docs.find(d => d._id === b).orderRank ? -1 : 1))
})

test('rerunning planSetsMigration links only what is unlinked and never creates an existing set', () => {
  next = 0
  const [a, b] = many(2, 'project-alpha', 'tour-admats', { groupType: 'admat' })
  const existing = { _id: 'mediaSet-alpha-tour-admats', _type: 'mediaSet', title: 'Tour admats', slug: { _type: 'slug', current: 'tour-admats' }, project: reference('project-alpha'), groupType: 'admat', allowAsHero: true }
  const result = planSetsMigration([alpha, existing, { ...a, set: reference(existing._id) }, b])
  assert.deepEqual(result.files.map(f => [f.request.creates.length, f.request.patches.map(p => p.id)]), [[0, [b._id]]])
  assert.deepEqual([result.sets[0].created, result.sets[0].allowAsHero, result.notes.alreadyLinked], [false, true, 1], 'the existing set keeps its own toggle')
  assert.deepEqual(planSetsMigration([alpha, { ...a, set: reference(existing._id) }]).files, [])
})

test('the request files plan and apply through the runner against the fake adapters', async t => {
  const docs = fixture().filter(d => (d._type !== 'mediaAsset' || d.project) && d.displayGroup !== 'twin-group')
  const result = planSetsMigration(docs)
  const h = await harness(t, { docs })
  for (const f of result.files) {
    await h.changes(f.request)
    const p = await h.plan({ changes: path.join(h.media, 'changes.json') })
    const applied = await h.apply(p)
    assert.deepEqual([applied.failed, applied.pending, applied.issues], [0, 0, []])
  }
  const linked = [...h.db.values()].filter(d => d._type === 'mediaAsset' && d.set)
  assert.equal(linked.length, 9)
  assert.equal([...h.db.values()].filter(d => d._type === 'mediaSet').length, 4)
  for (const d of linked) assert.equal(h.db.get(d.set._ref).project._ref, d.project._ref, 'every member shares its set\'s project')
})

test('cms-sets-migration CLI: reads only, writes request files with wx, never overwrites', async t => {
  const out = await mkdtemp(path.join(await realpath(process.env.CMS_TEST_TMP || os.tmpdir()), 'swm-sets-migration-'))
  t.after(() => rm(out, { recursive: true, force: true }))
  const calls = [], logs = [], docs = fixture()
  const options = { env: {}, log: line => logs.push(line), adaptersFactory: async args => { calls.push(args); return { sanity: { snapshot: async () => docs } } } }
  const argv = ['--project-id', 'offline123', '--dataset', 'test', '--out', path.join(out, 'requests')]
  assert.equal(await main(argv, options), 0)
  assert.deepEqual(calls.map(c => c.write), [false], 'read-only adapters')
  assert.deepEqual(await readdir(path.join(out, 'requests')), [`${FILE_PREFIX}1.json`])
  const written = JSON.parse(await readFile(path.join(out, 'requests', `${FILE_PREFIX}1.json`), 'utf8'))
  assert.deepEqual(Object.keys(written), ['version', 'creates', 'patches']); assert.equal(written.version, 1)
  assert.match(logs.join('\n'), /Nothing was written to Sanity/)
  await assert.rejects(main(argv, options), /EEXIST/)
  assert.equal(await main([], { log() {} }), 0)
  await assert.rejects(main(['--project-id', 'offline123', '--dataset', 'test'], options), /--out/)
})
