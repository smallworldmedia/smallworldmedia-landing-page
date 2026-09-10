import test from 'node:test'
import assert from 'node:assert/strict'
import {Readable} from 'node:stream'
import {createAdapters} from '../../lib/cms/adapters.mjs'

const target = {projectId: 'test123', dataset: 'test'}
const env = {SANITY_READ_TOKEN: 'fake-read', SANITY_WRITE_TOKEN: 'fake-write', MUX_TOKEN_ID: 'fake-id', MUX_TOKEN_SECRET: 'fake-secret'}
function fixture(options = {}) {
  const calls = []
  const asset = {_id: 'image-test-40x20-png', metadata: {dimensions: {width: 40, height: 20, aspectRatio: 2}}}
  const documents = [{_id: 'media-one', _rev: 'r1'}, {_id: 'drafts.media-one', _rev: 'r2'}]
  const client = {
    async getDocuments(ids) { calls.push(['documents', ids]); return ids.map(id => documents.find(doc => doc._id === id) || null) },
    async fetch(...args) { calls.push(['query', ...args]); return documents },
    async mutate(...args) { calls.push(['commit', ...args]); return {transactionId: 'transaction'} },
    assets: {async upload(...args) { calls.push(['image', ...args]); return asset }},
  }
  const uploads = {
    async create(...args) { calls.push(['create', ...args]); return {id: 'upload1', url: 'https://upload.invalid/?secret=signed'} },
    async retrieve(...args) { calls.push(['retrieve', ...args]); return {id: 'upload1', url: 'https://upload.invalid/?secret=signed', status: 'waiting'} },
    list(...args) { calls.push(['list', ...args]); return (async function* () {
      yield {id: 'unrelated', new_asset_settings: {passthrough: 'other'}}
      yield {id: 'upload1', url: 'https://upload.invalid/?secret=signed', status: 'asset_created', asset_id: 'asset1', new_asset_settings: {passthrough: 'op1'}}
    })() },
  }
  const dependencies = {
    createSanityClient(config) { calls.push(['sanityConfig', config]); return client },
    createMuxClient(config) { calls.push(['muxConfig', config]); return {video: {uploads, assets: {async retrieve(id) { calls.push(['asset', id]); return {id, status: 'ready'} }}}} },
    createReadStream(path) { calls.push(['stream', path]); return Readable.from([Buffer.from('test')]) },
    async stat() { return {isFile: () => true, size: 4} },
    async fetch(...args) { calls.push(['put', ...args]); return {ok: true, body: {async cancel() {}}} },
    sharp(path) { calls.push(['sharp', path]); return {async metadata() { return {width: 40, height: 20, orientation: 6} }} },
    async execFile(...args) { calls.push(['exec', ...args]); return {stdout: JSON.stringify({streams: [{codec_type: 'video', width: 1920, height: 1080, side_data_list: [{rotation: -90}]}], format: {duration: '2.5'}})} },
    ...options.dependencies,
  }
  return {calls, client, uploads, dependencies, asset, async adapters(extra = {}) { return createAdapters({target, env, dependencies, ...extra}) }}
}

test('construction is inert, target frozen and all writes default-denied before SDK or file access', async () => {
  const f = fixture(); const a = await f.adapters({env: {}})
  assert.deepEqual(a.sanity.target, target); assert.ok(Object.isFrozen(a.sanity.target))
  for (const fn of [() => a.sanity.commit([{create: {_id: 'a', _type: 'mediaAsset'}}]),
    () => a.sanity.uploadImage({path: 'file', operationId: 'op'}),
    () => a.mux.createUpload({operationId: 'op'}),
    () => a.mux.putUpload({url: 'https://upload.invalid/', path: 'file', size: 4})]) {
    await assert.rejects(fn, /read-only/)
  }
  assert.deepEqual(f.calls, [])
})

test('fresh document endpoint expands draft twins, removes nulls, avoids CDN and does not construct Mux', async () => {
  const f = fixture(); const a = await f.adapters()
  assert.equal((await a.sanity.getDocuments(['media-one', 'drafts.media-one', 'absent'])).length, 2)
  const config = f.calls.find(c => c[0] === 'sanityConfig')[1]
  assert.deepEqual({...target, useCdn: false, perspective: 'raw', maxRetries: 0, token: 'fake-read', apiVersion: '2025-02-19'}, config)
  assert.deepEqual(f.calls.find(c => c[0] === 'documents')[1], ['media-one', 'drafts.media-one', 'absent', 'drafts.absent'])
  assert.ok(!f.calls.some(c => c[0] === 'muxConfig'))
  assert.deepEqual(await a.sanity.getDocuments([]), [])
})

test('scoped queries use parameters and raw drafts, and broad media discovery is rejected', async () => {
  const f = fixture(); const a = await f.adapters()
  await assert.rejects(() => a.sanity.find({}), /clientId/)
  await assert.rejects(() => a.sanity.find({clientId: 'client-one'}), /scope/)
  await a.sanity.findCollection({clientId: 'client-one', sourceManifest: 'set-one'})
  await a.sanity.findProjects({clientId: 'client-one', slug: 'project-one'})
  await a.sanity.findClients('client-one')
  await a.sanity.findTags(['tag-one'])
  await a.sanity.findProjectOrder()
  await a.sanity.findCollection({projectId: 'project-one', sourceManifest: 'ignored'})
  const queries = f.calls.filter(c => c[0] === 'query')
  assert.equal(queries.length, 6)
  for (const [, query, params, opts] of queries) {
    assert.equal(opts.perspective, 'raw'); assert.equal(opts.cache, 'no-store')
    assert.ok(!query.includes('!(_id in path'))
    assert.ok(!query.includes('set-one'))
    assert.ok(params)
  }
  assert.match(queries[0][1], /client\._ref == \$clientId.*sourceManifest == \$sourceManifest/)
  assert.deepEqual(queries[5][2], {projectId: 'project-one'})
  assert.ok(!queries[5][1].includes('sourceManifest'))
})

test('reads require authentication to detect drafts, but Mux credentials remain lazy', async () => {
  const f = fixture(); const a = await f.adapters({env: {SANITY_READ_TOKEN: 'fake'}})
  await a.sanity.findClients('one')
  await assert.rejects(() => a.mux.getUpload('one'), /MUX_TOKEN_ID/)
  const empty = await f.adapters({env: {}})
  await assert.rejects(() => empty.sanity.getDocuments(['one']), /SANITY_READ_TOKEN/)
})

test('commit allows strict create/guarded patch only and requires sync visibility', async () => {
  const f = fixture(); const a = await f.adapters({write: true})
  for (const mutation of [{createOrReplace: {_id: 'a'}}, {createIfNotExists: {_id: 'a'}}, {delete: {id: 'a'}},
    {patch: {id: 'a', set: {title: 'x'}}}, {patch: {id: 'a', ifRevisionID: 'r', query: '*[]'}},
    {create: {_type: 'mediaAsset'}}, {create: {_id: 'a', _type: 'mediaAsset'}, delete: {id: 'b'}}]) {
    await assert.rejects(() => a.sanity.commit([mutation]))
  }
  assert.deepEqual(f.calls, [])
  const mutations = [{create: {_id: 'a', _type: 'mediaAsset'}}, {patch: {id: 'b', ifRevisionID: 'r', set: {title: 'new'}}}]
  await a.sanity.commit(mutations)
  assert.deepEqual(f.calls.find(c => c[0] === 'commit'), ['commit', mutations, {visibility: 'sync', returnDocuments: true, autoGenerateArrayKeys: false}])
  assert.equal(f.calls[0][1].token, 'fake-write')
})

test('Sanity image upload streams, requests dimensions, returns full asset and closes stream', async () => {
  const f = fixture(); const a = await f.adapters({write: true})
  assert.deepEqual(await a.sanity.uploadImage({path: '/local/test.png', operationId: 'op1'}), f.asset)
  const call = f.calls.find(c => c[0] === 'image')
  assert.equal(call[1], 'image'); assert.ok(call[2] instanceof Readable); assert.ok(call[2].destroyed)
  assert.deepEqual(call[3], {filename: 'test.png', label: 'op1', extract: ['image']})
})

test('Mux direct upload uses current explicit basic/public settings and zero retries', async () => {
  const f = fixture(); const a = await f.adapters({write: true})
  const upload = await a.mux.createUpload({operationId: 'op1'})
  assert.deepEqual(Object.keys(upload).sort(), ['id', 'url'])
  assert.equal(f.calls.find(c => c[0] === 'muxConfig')[1].maxRetries, 0)
  assert.deepEqual(f.calls.find(c => c[0] === 'create'), ['create', {
    cors_origin: '*', new_asset_settings: {video_quality: 'basic', playback_policies: ['public'], passthrough: 'op1'},
  }, {maxRetries: 0}])
  await assert.rejects(() => a.mux.createUpload({operationId: 'x'.repeat(256)}), /255/)
})

test('Mux reconciliation exhausts async iterator and strips signed URL; retrieve retains transient resume URL', async () => {
  const f = fixture(); const a = await f.adapters()
  const found = await a.mux.findUpload('op1')
  assert.equal(found.id, 'upload1'); assert.equal(found.asset_id, 'asset1'); assert.ok(!('url' in found))
  assert.equal(await a.mux.findUpload('missing'), null)
  assert.match((await a.mux.getUpload('upload1')).url, /^https:/)
  assert.deepEqual(await a.mux.getAsset('asset1'), {id: 'asset1', status: 'ready'})
})

test('Mux reconciliation rejects ambiguity and unsupported/incomplete pagination rather than assuming absence', async () => {
  const f = fixture(); const a = await f.adapters()
  f.uploads.list = () => (async function* () {
    yield {id: 'a', new_asset_settings: {passthrough: 'op1'}}
    yield {id: 'b', new_asset_settings: {passthrough: 'op1'}}
  })()
  await assert.rejects(() => a.mux.findUpload('op1'), /Ambiguous/)
  f.uploads.list = () => Promise.resolve({data: []})
  await assert.rejects(() => a.mux.findUpload('op1'), /manual reconciliation/)
  f.uploads.list = () => (async function* () { yield {id: 'a'}; throw new Error('network failed signed-url secret') })()
  await assert.rejects(() => a.mux.findUpload('op1'), error => /manual reconciliation/.test(error.message) && !/secret/.test(error.message))
})

test('Mux PUT streams with duplex half and fixed size, refuses redirects, closes body', async () => {
  const f = fixture(); const a = await f.adapters({write: true})
  assert.deepEqual(await a.mux.putUpload({url: 'https://upload.invalid/?secret=signed', path: '/local/test.mov', size: 4}), {ok: true})
  const [, , options] = f.calls.find(c => c[0] === 'put')
  assert.equal(options.method, 'PUT'); assert.equal(options.duplex, 'half'); assert.equal(options.redirect, 'error')
  assert.equal(options.headers['Content-Length'], '4'); assert.ok(options.body instanceof Readable); assert.ok(options.body.destroyed)
  await assert.rejects(() => a.mux.putUpload({url: 'http://upload.invalid/', path: 'file', size: 4}), /HTTPS/)
  await assert.rejects(() => a.mux.putUpload({url: 'https://upload.invalid/', path: 'file', size: 5}), /size changed/)
})

test('provider errors redact secrets and preserve revision conflict status', async () => {
  const f = fixture(); const a = await f.adapters({write: true})
  f.client.mutate = async () => { throw Object.assign(new Error('TOKEN_SECRET signed-url'), {statusCode: 409}) }
  await assert.rejects(() => a.sanity.commit([{patch: {id: 'a', ifRevisionID: 'r', set: {title: 'a'}}}]), error => {
    assert.equal(error.statusCode, 409); assert.ok(!/SECRET|signed-url/.test(error.message)); assert.equal(error.cause, undefined); return true
  })
})

test('probe applies image EXIF rotation and ffprobe display matrix rotation with no shell', async () => {
  const f = fixture(); const a = await f.adapters({env: {}})
  assert.deepEqual(await a.probe('/local/image.jpg', 'image'), {width: 20, height: 40, aspectRatio: 0.5})
  const measured = await a.probe('/local/video; unsafe.mov', 'video')
  assert.deepEqual(measured, {width: 1080, height: 1920, aspectRatio: 1080 / 1920, duration: 2.5})
  const [, binary, args, options] = f.calls.find(c => c[0] === 'exec')
  assert.equal(binary, 'ffprobe'); assert.equal(args.at(-1), '/local/video; unsafe.mov'); assert.equal(options.timeout, 30000)
  assert.ok(!f.calls.some(c => /Config$/.test(c[0])))
  await assert.rejects(() => a.probe('anything', 'audio'), /kind/)
})

test('probe rejects anamorphic SAR before any provider operation, including rotated sources', async () => {
  for (const rotation of [0, 90]) {
    const f = fixture({dependencies: {async execFile() { return {stdout: JSON.stringify({streams: [
      {codec_type: 'video', width: 1440, height: 1080, sample_aspect_ratio: '4:3', display_aspect_ratio: '16:9',
        side_data_list: [{rotation}], duration: '4'},
    ]})} }}})
    const a = await f.adapters()
    await assert.rejects(() => a.probe('anamorphic.mov', 'video'), /normalize\/export.*square pixels \(SAR 1:1\)/)
    assert.ok(!f.calls.some(c => /Config$/.test(c[0])))
  }
})

test('probe accepts square and unspecified SAR but rejects invalid ratios', async () => {
  for (const sar of ['1:1', '2:2', 'N/A', '0:1', undefined, 'bogus', '1:0']) {
    const f = fixture({dependencies: {async execFile() { return {stdout: JSON.stringify({streams: [
      {codec_type: 'video', width: 1920, height: 1080, sample_aspect_ratio: sar, duration: '4'},
    ]})} }}})
    const a = await f.adapters()
    if (sar === 'bogus' || sar === '1:0') {
      await assert.rejects(() => a.probe('video.mov', 'video'), /sample aspect ratio/)
    } else {
      assert.equal((await a.probe('video.mov', 'video')).aspectRatio, 16 / 9)
    }
  }
})

test('probe fails closed on invalid media and skips attached pictures', async () => {
  const f = fixture({dependencies: {async execFile() { return {stdout: JSON.stringify({streams: [
    {codec_type: 'video', width: 10, height: 10, disposition: {attached_pic: 1}},
    {codec_type: 'video', width: 100, height: 200, tags: {rotate: '90'}, duration: '4'},
  ]})} }}})
  const a = await f.adapters()
  assert.deepEqual(await a.probe('video.mov', 'video'), {width: 200, height: 100, aspectRatio: 2, duration: 4})
  const broken = fixture({dependencies: {sharp() { return {async metadata() { return {} }} }}})
  await assert.rejects(() => broken.adapters().then(a => a.probe('broken', 'image')), /dimensions/)
})
