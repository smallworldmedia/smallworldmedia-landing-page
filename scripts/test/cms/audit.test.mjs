import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import { checkout, clientDoc, tagDoc, reference, existingMedia } from './helpers.mjs'
import { CHECKS, auditDataset, expectedType, schemaFields } from '../../lib/cms/audit.mjs'
import { validatePatch } from '../../lib/cms/contract.mjs'
import { main } from '../../cms.mjs'

const target = { projectId: 'offline123', dataset: 'test' }
const project = { _id: 'project-example', _type: 'project', slug: { _type: 'slug', current: 'example-collection' }, client: reference(clientDoc._id), orderRank: '0|100000:' }
const image = (id, width, height, sha1hash = id) => ({ _id: id, _type: 'sanity.imageAsset', sha1hash, metadata: { dimensions: { width, height } } })
const muxDoc = (id, aspect = '9:16', status = 'ready') => ({ _id: id, _type: 'mux.videoAsset', assetId: `asset-${id}`, playbackId: `play-${id}`, status, data: { aspect_ratio: aspect } })
const videoRef = id => ({ _type: 'mux.video', asset: { _type: 'reference', _ref: id, _weak: true } })
const still = (id, fields = {}) => existingMedia(id, { title: id, slug: { _type: 'slug', current: id.toLowerCase() }, alt: 'A still.', description: 'A short description.', project: reference(project._id), image: { _type: 'image', asset: reference(`image-${id}`) }, ...fields })
// A still plus its image file, so only the seeded problem shows.
const framed = (doc, width = 1000, height = 1000) => [doc, image(`image-${doc._id}`, width, height)]
const clip = (id, fields = {}) => still(id, { mediaType: 'motion_9x16', image: undefined, video: videoRef(`mux-${id}`), orderRank: '0|i00000:', ...fields })
const manifest = rows => `# Collection\nclient: Example\nservices: branding\n\n| file | mediaType | title | sanityId |\n|---|---|---|---|\n${rows.map(r => `| ${r.join(' | ')} |`).join('\n')}\n`
const clean = () => ({
  docs: [clientDoc, tagDoc, project, still('mediaAsset-still'), image('image-mediaAsset-still', 1000, 1000), clip('mediaAsset-clip'), muxDoc('mux-mediaAsset-clip')],
  manifests: [{ file: 'media/Collection/_manifest.md', raw: manifest([['still.jpg', 'static_1x1', 'mediaAsset-still', 'mediaAsset-still'], ['clip.mp4', 'motion_9x16', 'mediaAsset-clip', 'mediaAsset-clip']]) }],
  muxAssets: [{ id: 'asset-mux-mediaAsset-clip', status: 'ready' }],
})
const checksOf = report => report.findings.map(f => f.check).sort()

test('expectedType: closest standard ratio within 10% in log space, otherwise *_other; stills have no 4:3', () => {
  assert.equal(expectedType(1920, 1080, 'image'), 'static_16x9')
  assert.equal(expectedType(1650, 1000, 'image'), 'static_16x9')
  assert.equal(expectedType(3840, 2560, 'image'), 'static_other')
  assert.equal(expectedType(1080, 1350, 'image'), 'static_4x5')
  assert.equal(expectedType(1440, 1080, 'image'), 'static_other')
  assert.equal(expectedType(1440, 1080, 'video'), 'motion_4x3')
  assert.equal(expectedType(1080, 1920, 'video'), 'motion_9x16')
})

test('a clean dataset reports nothing (negative control)', async () => {
  const report = auditDataset({ target, ...clean(), schema: await schemaFields(checkout) })
  assert.deepEqual(report.findings, [])
  assert.deepEqual(report.summary, { errors: 0, warnings: 0, infos: 0 })
  assert.equal(report.suggestedChanges, null)
  assert.match(report.mux, /1 live Mux assets checked/)
  assert.deepEqual(report.counts.mediaTypes, { motion_9x16: 1, static_1x1: 1 })
})

test('every check fires on its seeded problem, and only mechanical fixes are suggested', async () => {
  const { docs, manifests } = clean()
  const seeded = [
    ...framed(still('mediaAsset-dangling', { project: reference('project-gone') })),
    still('mediaAsset-nofile', { image: undefined, orderRank: '0|900000:' }),
    ...framed(still('mediaAsset-noclient', { client: undefined, orderRank: '0|910000:' })),
    ...framed(still('mediaAsset-kind', { mediaType: 'motion_16x9', orderRank: '0|920000:' })),
    ...framed(still('mediaAsset-wide', { orderRank: '0|a00000:' }), 1600, 900),
    ...framed(still('mediaAsset-widedraft', { orderRank: '0|a10000:' }), 1600, 900), { ...still('mediaAsset-widedraft'), _id: 'drafts.mediaAsset-widedraft' },
    ...framed(still('mediaAsset-album', { mediaType: 'album-art', releaseInfo: undefined, orderRank: '0|b00000:' }), 1000, 600),
    image('image-unused', 10, 10), muxDoc('mux-unused'),
    still('mediaAsset-share-a', { image: { _type: 'image', asset: reference('image-shared') }, orderRank: '0|c00000:' }),
    still('mediaAsset-share-b', { image: { _type: 'image', asset: reference('image-shared') }, orderRank: '0|d00000:' }), image('image-shared', 1000, 1000),
    image('image-twin-a', 10, 10, 'same-bytes'), image('image-twin-b', 10, 10, 'same-bytes'),
    clip('mediaAsset-preparing', { orderRank: '0|e00000:' }), muxDoc('mux-mediaAsset-preparing', '9:16', 'preparing'),
    clip('mediaAsset-errored', { orderRank: '0|f00000:' }), muxDoc('mux-mediaAsset-errored'),
    clip('mediaAsset-gone', { orderRank: '0|g00000:' }), muxDoc('mux-mediaAsset-gone'),
    ...framed(still('mediaAsset-noalt', { alt: undefined, description: undefined, orderRank: '0|h00000:' })),
    ...framed(still('mediaAsset-longalt', { alt: 'x'.repeat(151), orderRank: '0|j00000:' })),
    ...framed(still('mediaAsset-legacy', { isHero: true, orderRank: '0|k00000:' })),
    ...framed(still('mediaAsset-badrole', { contentRole: 'hero', orderRank: '0|m00000:' })),
    clip('mediaAsset-muxvideo', { video: { _type: 'muxVideo', asset: { _type: 'reference', _ref: 'mux-mediaAsset-muxvideo' } }, orderRank: '0|n00000:' }), muxDoc('mux-mediaAsset-muxvideo'),
    { ...project, _id: 'project-twin', orderRank: '0|200000:' },
    ...framed(still('mediaAsset-rank', { orderRank: '0|hzzzzz:' })),
  ]
  const live = [...docs, ...seeded].filter(d => d._type === 'mux.videoAsset' && d._id !== 'mux-mediaAsset-gone')
    .map(d => ({ id: d.assetId, status: d._id === 'mux-mediaAsset-errored' ? 'errored' : d._id === 'mux-mediaAsset-preparing' ? 'preparing' : 'ready' }))
  const extraManifests = [
    { file: 'media/Broken/_manifest.md', raw: 'not a manifest' },
    { file: 'media/Other/_manifest.md', raw: manifest([['gone.jpg', 'static_1x1', 'Gone', 'mediaAsset-never'], ['later.jpg', 'static_1x1', 'Later Shot', ''], ['wide.jpg', 'static_16x9', 'mediaAsset-wide', 'mediaAsset-wide'], ['again.jpg', 'static_1x1', 'mediaAsset-still', 'mediaAsset-still']]) },
  ]
  const report = auditDataset({ target, docs: [...docs, ...seeded], muxAssets: [...live, { id: 'asset-orphan', status: 'ready' }], manifests: [...manifests, ...extraManifests], schema: await schemaFields(checkout), fingerprint: false })
  assert.deepEqual(checksOf(report), Object.keys(CHECKS).sort(), 'every check needs a seeded case')
  const items = check => report.findings.find(f => f.check === check).items
  assert.deepEqual(items('label-ratio').map(i => [i.id, i.suggested]), [['mediaAsset-wide', 'static_16x9'], ['mediaAsset-widedraft', 'static_16x9']])
  assert.deepEqual(items('dangling-reference').map(i => [i.id, i.path, i.ref]), [['mediaAsset-dangling', 'project', 'project-gone']])
  assert.deepEqual(items('mux-asset-missing').map(i => i.id), ['mux-mediaAsset-gone'])
  assert.deepEqual(items('mux-asset-undocumented').map(i => i.assetId), ['asset-orphan'])
  assert.deepEqual(items('unknown-field').map(i => `${i.type}.${i.field}`), ['mediaAsset.isHero'])
  assert.deepEqual(items('manifest-drift').map(i => [i.id, i.field, i.manifestValue, i.sanityValue]), [['mediaAsset-wide', 'mediaType', 'static_16x9', 'static_1x1']])
  assert.deepEqual(items('draft-pending').map(i => i.id), ['drafts.mediaAsset-widedraft'])
  assert.equal(report.summary.errors, report.findings.filter(f => f.severity === 'error').reduce((n, f) => n + f.count, 0))
  // Suggestions: the label and the legacy video shape; the drafted twin of the label gets nothing.
  const patches = report.suggestedChanges.request.patches
  assert.deepEqual(patches.map(p => [p.id, Object.keys(p.set)]), [['mediaAsset-wide', ['mediaType']], ['mediaAsset-muxvideo', ['video']]])
  for (const p of patches) validatePatch(p.type, p.set, p.unset)
})

test('manifest drift compares only the columns a manifest carries', async () => {
  const { docs, muxAssets } = clean()
  const raw = manifest([['still.jpg', 'static_4x5', 'Renamed', 'mediaAsset-still'], ['clip.mp4', 'motion_9x16', '', 'mediaAsset-clip']])
  const report = auditDataset({ target, docs, muxAssets, manifests: [{ file: 'media/Collection/_manifest.md', raw }], schema: await schemaFields(checkout) })
  assert.deepEqual(report.findings.find(f => f.check === 'manifest-drift').items.map(i => [i.field, i.manifestValue, i.sanityValue]), [['mediaType', 'static_4x5', 'static_1x1'], ['title', 'Renamed', 'mediaAsset-still']])
  assert.deepEqual(checksOf(report), ['manifest-drift'])
})

test('secrets and system documents never reach the report, even if the reader returns them', async () => {
  const { docs, manifests, muxAssets } = clean()
  const leaked = [{ _id: 'secrets.mux', _type: 'mux.apiKey', token: 'SECRET-TOKEN-VALUE', owner: reference('SECRET-REF') }, { _id: '_.groups.editors', _type: 'system.group', members: ['SECRET-MEMBER'] }]
  const report = auditDataset({ target, docs: [...docs, ...leaked], manifests, muxAssets, schema: await schemaFields(checkout) })
  const baseline = auditDataset({ target, docs, manifests, muxAssets, schema: await schemaFields(checkout) })
  assert.deepEqual(report.counts, baseline.counts)
  const text = JSON.stringify(report)
  assert.ok(!text.includes('SECRET-TOKEN-VALUE') && !text.includes('SECRET-MEMBER') && !text.includes('secrets.mux'))
  assert.deepEqual(report.findings, [])
})

test('cms audit: read-only adapters, Mux only with credentials, exit 1 only on errors', async t => {
  const root = await mkdtemp(path.join(await realpath(process.env.CMS_TEST_TMP || os.tmpdir()), 'swm-cms-audit-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.join(root, 'src/schemas'), { recursive: true }); await mkdir(path.join(root, 'media/Collection'), { recursive: true })
  for (const name of ['mediaAsset', 'project', 'client', 'serviceTag', 'globeSettings', 'siteSettings']) await writeFile(path.join(root, 'src/schemas', `${name}.ts`), await readFile(path.join(checkout, 'src/schemas', `${name}.ts`)))
  const { docs, manifests, muxAssets } = clean()
  await writeFile(path.join(root, manifests[0].file), manifests[0].raw)
  const calls = { write: [], mux: 0 }
  const run = async (dataset, env) => {
    const outputs = []
    const code = await main(['audit', '--project-id', target.projectId, '--dataset', target.dataset, '--checkout', root], {
      env, log: text => outputs.push(text),
      adaptersFactory: async ({ write }) => { calls.write.push(write); return { sanity: { target, snapshot: async () => dataset }, mux: { listAssets: async () => { calls.mux++; return muxAssets } } } },
    })
    return { code, report: JSON.parse(outputs.at(-1)) }
  }
  const quiet = await run(docs, {})
  assert.equal(quiet.code, 0); assert.equal(calls.mux, 0); assert.match(quiet.report.mux, /not checked/)
  assert.match(quiet.report.manifests, /1 manifests, 2 rows/)
  const withMux = await run(docs, { MUX_TOKEN_ID: 'id', MUX_TOKEN_SECRET: 'secret' })
  assert.equal(withMux.code, 0); assert.equal(calls.mux, 1); assert.deepEqual(withMux.report.findings, [])
  const broken = await run([...docs, still('mediaAsset-dangling', { project: reference('project-gone') })], {})
  assert.equal(broken.code, 1); assert.ok(broken.report.summary.errors >= 1)
  assert.deepEqual(calls.write, [false, false, false])
  await assert.rejects(main(['audit', '--project-id', target.projectId], { adaptersFactory: async () => ({}) }), /Explicit projectId and dataset/)
})
