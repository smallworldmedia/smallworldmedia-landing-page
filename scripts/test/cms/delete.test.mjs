import test from 'node:test'
import assert from 'node:assert/strict'
import { harness, existingMedia, reference } from './helpers.mjs'
import { clean, digest, validatePatch } from '../../lib/cms/contract.mjs'
import { validatePlan, preview, verifyRun } from '../../lib/cms/runner.mjs'

const rehash = plan => { const { id, ...body } = plan; return { ...body, id: digest(body) } }
const project = { _id: 'project-example', _type: 'project', _rev: 'r-project', slug: { _type: 'slug', current: 'example-collection' }, client: reference('client-example') }
const videoRef = id => ({ _type: 'mux.video', asset: { _type: 'reference', _ref: id, _weak: true } })
const muxDoc = (id, assetId = `asset-${id}`) => ({ _id: id, _type: 'mux.videoAsset', _rev: `r-${id}`, assetId, playbackId: `play-${id}`, status: 'ready', filename: `${id}.mp4`, data: { aspect_ratio: '9:16' } })
const muxAsset = id => ({ id, status: 'ready', created_at: '1700000000', playback_ids: [{ id: `play-${id}`, policy: 'public' }], aspect_ratio: '9:16' })
const video = (id, rank, mux) => existingMedia(id, { mediaType: 'motion_9x16', image: undefined, video: videoRef(mux), project: reference(project._id), orderRank: rank })
const pick = (key, id) => ({ _key: key, _type: 'reference', _ref: id })
const globe = picks => ({ _id: 'globeSettings', _type: 'globeSettings', _rev: 'r-globe', title: 'Globe Settings', picks })
async function sosaHarness(t, extra = []) {
  const docs = [project, video('mediaAsset-keep', '0|100000:', 'mux-keep'), video('mediaAsset-dupe', '0|100008:', 'mux-dupe'), muxDoc('mux-keep'), muxDoc('mux-dupe'), globe([pick('a', 'mediaAsset-keep'), pick('b', 'mediaAsset-dupe')]), ...extra]
  const h = await harness(t, { docs })
  for (const id of ['mux-keep', 'mux-dupe']) h.assets.set(`asset-${id}`, muxAsset(`asset-${id}`))
  return h
}
const swapPick = { id: 'globeSettings', type: 'globeSettings', set: { picks: [pick('a', 'mediaAsset-keep'), pick('b', 'mediaAsset-keep')] }, unset: [] }
const dropDupe = [{ id: 'mediaAsset-dupe', type: 'mediaAsset' }, { id: 'mux-dupe', type: 'mux.videoAsset', muxAsset: true }]

test('a referenced asset cannot be planned for delete until the plan patches the reference away', async t => {
  const h = await sosaHarness(t)
  await assert.rejects(h.plan({ changes: await h.changes({ deletes: [dropDupe[0]] }) }), /blocked by globeSettings/)
  // Weak references block too: the Mux document is still described by its mediaAsset.
  await assert.rejects(h.plan({ changes: await h.changes({ patches: [swapPick], deletes: [dropDupe[1]] }) }), /blocked by mediaAsset-dupe/)
  const p = await h.plan({ changes: await h.changes({ patches: [swapPick], deletes: dropDupe }) })
  assert.deepEqual(p.operations.map(o => [o.action, o.id]), [['patch', 'globeSettings'], ['delete', 'mediaAsset-dupe'], ['delete', 'mux-dupe']])
  assert.ok(p.guards.some(g => g.id === 'mediaAsset-keep' && g.type === 'mediaAsset'))
  const text = preview(p)
  assert.match(text, /0 creates; 1 patches; 0 unchanged; 2 deletes \(1 Mux assets\)/)
  assert.match(text, /irreversible/); assert.match(text, /picks\[b\] #2 -> #2: .*mediaAsset-dupe.*mediaAsset-keep/)
  assert.match(text, /\+ Mux asset asset-mux-dupe \(ready\), deleted permanently/)
  assert.deepEqual([h.stats.commits, h.stats.muxDeletes], [0, 0])
})

test('patch, then revision-guarded deletes, then the Mux asset; verify confirms absence; re-apply is a no-op', async t => {
  const h = await sosaHarness(t)
  const p = await h.plan({ changes: await h.changes({ patches: [swapPick], deletes: dropDupe }) })
  const report = await h.apply(p)
  assert.deepEqual([report.updated, report.deleted, report.failed, report.pending], [1, 2, 0, 0])
  assert.ok(!h.db.has('mediaAsset-dupe') && !h.db.has('mux-dupe') && !h.assets.has('asset-mux-dupe'))
  assert.ok(h.db.has('mediaAsset-keep') && h.assets.has('asset-mux-keep'))
  assert.deepEqual(h.db.get('globeSettings').picks.map(r => r._ref), ['mediaAsset-keep', 'mediaAsset-keep'])
  assert.ok(report.routes.includes('/') && report.routes.includes('/work/example-collection'))
  const counts = { ...h.stats }
  assert.equal((await h.apply(p)).deleted, 2); assert.deepEqual([h.stats.commits, h.stats.muxDeletes], [counts.commits, counts.muxDeletes])
  h.assets.set('asset-mux-dupe', muxAsset('asset-mux-dupe'))
  const corrupted = await verifyRun({ plan: p, journal: await h.store.journal(p.id), sanity: h.sanity, mux: h.mux })
  assert.equal(corrupted.failed, 1); assert.match(corrupted.issues[0].message, /Mux asset still present/)
})

test('a reference or revision that changes after planning stops the delete before any write', async t => {
  const drifts = {
    'weak-referrer': [h => h.db.set('siteSettings', { _id: 'siteSettings', _type: 'siteSettings', _rev: 'r-site', feature: { ...reference('mediaAsset-dupe'), _weak: true } }), /blocked: siteSettings now reference/],
    'draft-referrer': [h => h.db.set('drafts.globeSettings', { ...globe([pick('b', 'mediaAsset-dupe')]), _id: 'drafts.globeSettings' }), /Draft conflict: globeSettings/],
    'release-version': [h => h.db.set('versions.r1.mediaAsset-dupe', { ...h.db.get('mediaAsset-dupe'), _id: 'versions.r1.mediaAsset-dupe' }), /Ordering\/member/],
    'revision': [h => { h.db.get('mediaAsset-dupe')._rev = 'someone-else' }, /Stale revision: mediaAsset-dupe/],
  }
  for (const [drift, [apply, message]] of Object.entries(drifts)) {
    const h = await sosaHarness(t)
    const p = await h.plan({ changes: await h.changes({ patches: [{ ...swapPick, set: { picks: [pick('a', 'mediaAsset-keep')] } }], deletes: [{ id: 'mediaAsset-dupe', type: 'mediaAsset' }] }) })
    apply(h)
    await assert.rejects(h.apply(p), message, drift)
    assert.ok(h.db.has('mediaAsset-dupe'), drift); assert.equal(h.stats.muxDeletes, 0)
  }
  // An edit landing between the last read and the write fails the in-transaction revision guard.
  const raced = await sosaHarness(t)
  const rp = await raced.plan({ changes: await raced.changes({ patches: [swapPick], deletes: dropDupe }) })
  const blockers = raced.sanity.findDeleteBlockers; raced.sanity.findDeleteBlockers = async id => { const found = await blockers(id); if (id === 'mediaAsset-dupe') raced.db.get(id)._rev = 'raced'; return found }
  await assert.rejects(raced.apply(rp), /Revision conflict/)
  assert.ok(raced.db.has('mediaAsset-dupe') && raced.db.has('mux-dupe')); assert.equal(raced.stats.muxDeletes, 0)
  // The Mux half rechecks too: a document that starts describing the asset stops it.
  const h = await sosaHarness(t)
  const p = await h.plan({ changes: await h.changes({ patches: [swapPick], deletes: dropDupe }) })
  await assert.rejects(h.apply(p, { onStage(stage, op) { if (stage === 'committed' && op.id === 'mux-dupe') h.db.set('mux-twin', muxDoc('mux-twin', 'asset-mux-dupe')) } }), /described by mux-twin/)
  assert.ok(h.assets.has('asset-mux-dupe')); assert.equal(h.stats.muxDeletes, 0)
})

test('an interrupted delete resumes the Mux half only; a Mux 404 on resume counts as gone', async t => {
  const h = await sosaHarness(t)
  const p = await h.plan({ changes: await h.changes({ patches: [swapPick], deletes: dropDupe }) })
  await assert.rejects(h.apply(p, { onStage(stage, op) { if (stage === 'committed' && op.id === 'mux-dupe') throw new Error('simulated interruption') } }), /stopped at committing/)
  assert.ok(!h.db.has('mux-dupe') && h.assets.has('asset-mux-dupe'))
  const commits = h.stats.commits
  const report = await h.apply(p); assert.equal(report.deleted, 2); assert.equal(h.stats.commits, commits); assert.equal(h.stats.muxDeletes, 1)
  const h2 = await sosaHarness(t)
  const p2 = await h2.plan({ changes: await h2.changes({ patches: [swapPick], deletes: dropDupe }) })
  const remove = h2.mux.deleteAsset; h2.mux.deleteAsset = async id => { await remove(id); throw new Error('response lost') }
  await assert.rejects(h2.apply(p2), /stopped at mux-deleting/); h2.mux.deleteAsset = remove
  assert.equal((await h2.apply(p2)).deleted, 2); assert.equal(h2.stats.muxDeletes, 2)
})

test('a Mux-only delete needs an existing asset that no document describes', async t => {
  const h = await sosaHarness(t)
  h.assets.set('erroredAsset1', { id: 'erroredAsset1', status: 'errored', created_at: '1700000000' })
  await assert.rejects(h.plan({ changes: await h.changes({ deletes: [{ id: 'asset-mux-keep', type: 'mux.asset' }] }) }), /described by a Sanity document/)
  await assert.rejects(h.plan({ changes: await h.changes({ deletes: [{ id: 'missingAsset', type: 'mux.asset' }] }) }), /not found/)
  await assert.rejects(h.plan({ changes: await h.changes({ deletes: [{ id: 'mediaAsset-keep', type: 'mediaAsset', muxAsset: true }] }) }), /applies only/)
  const p = await h.plan({ changes: await h.changes({ deletes: [{ id: 'erroredAsset1', type: 'mux.asset' }] }) })
  assert.match(preview(p), /DELETE mux.asset erroredAsset1: Mux asset errored, created 2023-11-14; no Sanity document/)
  const report = await h.apply(p); assert.deepEqual([report.deleted, report.failed], [1, 0]); assert.ok(!h.assets.has('erroredAsset1'))
  assert.equal(h.stats.commits, 0)
})

test('an unreferenced image asset deletes; a still-used one is blocked; the hero change is reported', async t => {
  const image = { _id: 'image-unused', _type: 'sanity.imageAsset', _rev: 'r-image', originalFilename: 'old.jpg', size: 10, metadata: { dimensions: { width: 10, height: 10 } } }
  const h = await sosaHarness(t, [image, existingMedia('mediaAsset-still')])
  await assert.rejects(h.plan({ changes: await h.changes({ deletes: [{ id: 'image-existing', type: 'sanity.imageAsset' }] }) }), /blocked by mediaAsset-still/)
  const p = await h.plan({ changes: await h.changes({ deletes: [{ id: 'image-unused', type: 'sanity.imageAsset' }] }) })
  assert.match(preview(p), /"old.jpg" 10x10, 10 bytes; file removed/)
  assert.equal((await h.apply(p)).deleted, 1); assert.ok(!h.db.has('image-unused'))
  const hero = await h.plan({ changes: await h.changes({ patches: [{ ...swapPick, set: { picks: [pick('b', 'mediaAsset-dupe')] } }], deletes: [{ id: 'mediaAsset-keep', type: 'mediaAsset' }] }) })
  assert.ok(hero.informational.some(n => /hero\) asset changes mediaAsset-keep -> mediaAsset-dupe/.test(n)))
})

test('saved delete plans cannot be tampered into field writes, early deletes or kept-and-deleted targets', async t => {
  const h = await sosaHarness(t)
  const p = await h.plan({ changes: await h.changes({ patches: [swapPick], deletes: dropDupe }) })
  const withFields = clean(p); withFields.operations[1].set = { title: 'x' }
  assert.throws(() => validatePlan(rehash(withFields)), /no fields/)
  const early = clean(p); early.operations.reverse()
  assert.throws(() => validatePlan(rehash(early)), /Deletes run after/)
  const kept = clean(p); kept.operations[0].after.picks[1]._ref = 'mediaAsset-dupe'; kept.operations[0].set.picks[1]._ref = 'mediaAsset-dupe'; kept.operations[0].diff = []
  assert.throws(() => validatePlan(rehash(kept)))
  const muxOnPatch = clean(p); muxOnPatch.operations[0].mux = p.operations[2].mux
  assert.throws(() => validatePlan(rehash(muxOnPatch)), /Only a delete/)
})

test('globe picks: keyed references only, and a newly added pick must be a video asset', async t => {
  validatePatch('globeSettings', { picks: [pick('a', 'mediaAsset-x'), pick('b', 'mediaAsset-x')] }, [])
  for (const picks of [[{ _type: 'reference', _ref: 'mediaAsset-x' }], [pick('a', 'mediaAsset-x'), pick('a', 'mediaAsset-y')], [{ ...pick('a', 'mediaAsset-x'), _weak: true }]]) assert.throws(() => validatePatch('globeSettings', { picks }, []))
  assert.throws(() => validatePatch('globeSettings', { title: 'x' }, []))
  const h = await sosaHarness(t)
  await assert.rejects(h.plan({ changes: await h.changes({ patches: [{ ...swapPick, set: { picks: [pick('a', 'mediaAsset-keep'), pick('c', 'client-example')] } }] }) }), /video mediaAsset/)
  const still = existingMedia('mediaAsset-still'); h.db.set(still._id, still)
  await assert.rejects(h.plan({ changes: await h.changes({ patches: [{ ...swapPick, set: { picks: [pick('a', 'mediaAsset-still')] } }] }) }), /video mediaAsset/)
})
