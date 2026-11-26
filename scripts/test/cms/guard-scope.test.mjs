import test from 'node:test'
import assert from 'node:assert/strict'
import { harness, existingMedia, reference } from './helpers.mjs'

// Apply guards each operation with only the collections that operation touches (its snapshot membership, or its resulting
// document); the pre-loop and verify passes read every collection. h.stats.collections counts findCollection/findProjectOrder calls.
const videoB1 = existingMedia('mediaAsset-b1', { mediaType: 'motion_1x1', video: { _type: 'mux.video', asset: reference('muxAsset-old') }, sourceManifest: 'Other', orderRank: '0|hzzzzx:' })
const titled = id => ({ id, type: 'mediaAsset', set: { title: `${id} new` } })
const member = (id, sourceManifest) => existingMedia(id, { sourceManifest, orderRank: '0|i00007:' })
async function setup(t, patches, extra = {}, b1 = existingMedia('mediaAsset-b1', { sourceManifest: 'Other', orderRank: '0|hzzzzx:' })) {
  const docs = [existingMedia('mediaAsset-a1'), existingMedia('mediaAsset-a2', { orderRank: '0|hzzzzy:' }), b1]
  const h = await harness(t, { docs }); await h.file('b1.mp4')
  const p = await h.plan({ changes: await h.changes({ patches, ...extra }) })
  return { h, p }
}
const uploadB1 = { id: 'mediaAsset-b1', type: 'mediaAsset', upload: { file: 'b1.mp4' } }
// The expected count, written out from the contract and not from the runner: one touched-collection read per guard pass.
const touched = (p, op) => p.collections.filter(c => c.snapshot.some(s => s.id === op.id)).length

test('apply reads only the collections each operation touches: full before the loop and at verify, scoped per op, one more scoped pass after an upload', async t => {
  const { h, p } = await setup(t, [titled('mediaAsset-a1'), titled('mediaAsset-a2'), uploadB1], {}, videoB1)
  assert.equal(p.collections.length, 2); assert.deepEqual(p.operations.map(o => o.id), ['mediaAsset-a1', 'mediaAsset-a2', 'mediaAsset-b1'])
  const before = h.stats.collections, report = await h.apply(p)
  assert.deepEqual([report.updated, report.failed, report.pending], [3, 0, 0])
  const perOp = p.operations.reduce((n, op) => n + touched(p, op) * (op.upload ? 2 : 1), 0)
  assert.equal(perOp, 4)
  // Before the loop (2) + a1 (1) + a2 (1) + b1 before and after its upload (1 + 1) + verify (2); the old runner read 2 + 3 ops x 2 passes x 2 + 2 = 16.
  assert.equal(h.stats.collections - before, p.collections.length + perOp + p.collections.length)
  assert.equal(h.stats.collections - before, 8)
})

test('a member that lands in the collection the next operation touches stops the apply before that operation commits', async t => {
  const { h, p } = await setup(t, [titled('mediaAsset-a1'), titled('mediaAsset-b1')])
  await assert.rejects(h.apply(p, { onStage(stage, op) { if (stage === 'done' && op.id === 'mediaAsset-a1') h.db.set('mediaAsset-added', member('mediaAsset-added', 'Other')) } }), /Ordering\/member/)
  assert.equal(h.stats.commits, 1); assert.equal(h.db.get('mediaAsset-b1').title, 'Old title')
})

test('a member that lands in a collection no remaining operation touches lets the writes finish and the verify report carries it', async t => {
  const { h, p } = await setup(t, [titled('mediaAsset-a1'), titled('mediaAsset-b1')])
  const report = await h.apply(p, { onStage(stage, op) { if (stage === 'done' && op.id === 'mediaAsset-a1') h.db.set('mediaAsset-added', member('mediaAsset-added', 'Collection')) } })
  assert.equal(h.stats.commits, 2); assert.equal(h.db.get('mediaAsset-b1').title, 'mediaAsset-b1 new'); assert.equal(report.updated, 2)
  const scope = report.issues.find(i => i.id === 'scope')
  assert.match(scope?.message, /Ordering\/member/); assert.ok(report.failed >= 1)
})

test('a delete is guarded by the collection its snapshot lists, though it has no resulting document', async t => {
  const { h, p } = await setup(t, [titled('mediaAsset-a1')], { deletes: [{ id: 'mediaAsset-b1', type: 'mediaAsset' }] })
  assert.deepEqual(p.operations.map(o => o.id), ['mediaAsset-a1', 'mediaAsset-b1'])
  await assert.rejects(h.apply(p, { onStage(stage, op) { if (stage === 'done' && op.id === 'mediaAsset-a1') h.db.set('mediaAsset-added', member('mediaAsset-added', 'Other')) } }), /Ordering\/member/)
  assert.equal(h.stats.commits, 1); assert.ok(h.db.has('mediaAsset-b1'))
})

test('a member that lands in the operation\'s own collection during an upload is caught before the commit', async t => {
  const { h, p } = await setup(t, [uploadB1], {}, videoB1)
  await assert.rejects(h.apply(p, { onStage(stage) { if (stage === 'uploaded') h.db.set('mediaAsset-added', member('mediaAsset-added', 'Other')) } }), /Ordering\/member/)
  assert.equal(h.stats.commits, 0); assert.equal(h.stats.uploads, 1); assert.deepEqual(h.db.get('mediaAsset-b1').video, videoB1.video)
})
