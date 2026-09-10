import {createReadStream} from 'node:fs'
import {stat} from 'node:fs/promises'
import {basename, resolve} from 'node:path'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'

const runFile = promisify(execFile)
const API_VERSION = '2025-02-19'
const text = (value, name) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`)
  return value
}
const twins = ids => [...new Set(ids.flatMap(id => {
  text(id, 'document ID')
  const published = id.replace(/^drafts\./, '')
  return [published, `drafts.${published}`]
}))]
const dimensions = (width, height) => {
  if (!(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0)) {
    throw new Error('Media has no valid dimensions')
  }
  return {width, height, aspectRatio: width / height}
}
const operation = id => {
  text(id, 'operationId')
  if ([...id].length > 255) throw new Error('operationId exceeds Mux passthrough limit (255 characters)')
  return id
}
// Reconciliation records omit signed upload URLs. Only create/get expose them
// transiently for PUT/resume; no adapter writes them to disk.
const uploadRecord = upload => {
  if (!upload || typeof upload.id !== 'string') throw new Error('Mux returned an invalid upload')
  const {id, status, asset_id, new_asset_settings} = upload
  return {id, status, ...(asset_id ? {asset_id} : {}),
    ...(new_asset_settings ? {new_asset_settings: {
      passthrough: new_asset_settings.passthrough,
      video_quality: new_asset_settings.video_quality,
      playback_policies: new_asset_settings.playback_policies,
    }} : {})}
}
async function providerCall(label, fn) {
  try { return await fn() } catch (error) {
    // SDK errors may contain request headers or a signed URL. Preserve only status.
    const status = Number.isInteger(error?.statusCode) ? error.statusCode : error?.status
    const safe = new Error(`${label} failed${Number.isInteger(status) ? ` (HTTP ${status})` : ''}`)
    if (Number.isInteger(status)) { safe.status = status; safe.statusCode = status }
    throw safe
  }
}

/**
 * No I/O occurs at construction. All writes require write === true.
 * dependencies is a test seam: createSanityClient(config), createMuxClient(config),
 * fetch, createReadStream, stat, sharp, execFile (promise-returning).
 * Read credentials are required too: unauthenticated reads cannot reliably detect drafts.
 */
export async function createAdapters({target, env = process.env, write = false, dependencies = {}} = {}) {
  const fixedTarget = Object.freeze({
    projectId: text(target?.projectId, 'target.projectId'),
    dataset: text(target?.dataset, 'target.dataset'),
  })
  if (!/^[a-z0-9]+$/.test(fixedTarget.projectId) || !/^[a-z0-9][a-z0-9_-]*$/.test(fixedTarget.dataset)) {
    throw new Error('Invalid Sanity target')
  }
  const streamFile = dependencies.createReadStream || createReadStream
  const statFile = dependencies.stat || stat
  const allowWrite = () => { if (write !== true) throw new Error('Adapter is read-only; writes require write: true') }
  let sanityPromise, muxPromise
  const sanityClient = () => sanityPromise ||= (async () => {
    const token = write === true ? env.SANITY_WRITE_TOKEN : (env.SANITY_READ_TOKEN || env.SANITY_WRITE_TOKEN)
    text(token, write === true ? 'SANITY_WRITE_TOKEN' : 'SANITY_READ_TOKEN or SANITY_WRITE_TOKEN')
    const factory = dependencies.createSanityClient || (await import('@sanity/client')).createClient
    return factory({...fixedTarget, apiVersion: API_VERSION, token, useCdn: false, perspective: 'raw', maxRetries: 0})
  })()
  const muxClient = () => muxPromise ||= (async () => {
    const config = {tokenId: text(env.MUX_TOKEN_ID, 'MUX_TOKEN_ID'),
      tokenSecret: text(env.MUX_TOKEN_SECRET, 'MUX_TOKEN_SECRET'), maxRetries: 0}
    if (dependencies.createMuxClient) return dependencies.createMuxClient(config)
    const {default: Mux} = await import('@mux/mux-node')
    return new Mux(config)
  })()
  const query = async (filter, params) => {
    const client = await sanityClient()
    return providerCall('Sanity query', () => client.fetch(`*[${filter}] | order(_id asc)`, params,
      {perspective: 'raw', cache: 'no-store'}))
  }
  const sanity = {
    target: fixedTarget,
    async getDocuments(ids) {
      if (!Array.isArray(ids)) throw new Error('ids must be an array')
      const expanded = twins(ids)
      if (!expanded.length) return []
      const client = await sanityClient()
      const documents = []
      // Document endpoint reads the authoritative store, not the GROQ search index.
      for (let index = 0; index < expanded.length; index += 100) {
        const rows = await providerCall('Sanity document read', () => client.getDocuments(expanded.slice(index, index + 100)))
        documents.push(...rows.filter(Boolean))
      }
      return documents
    },
    async find({clientId, sourceManifest, sourceFolder, projectSlug, ids} = {}) {
      if (ids !== undefined) {
        if (clientId || sourceManifest || sourceFolder || projectSlug) throw new Error('ids cannot be combined with scope filters')
        return sanity.getDocuments(ids)
      }
      text(clientId, 'clientId')
      if (!sourceManifest && !sourceFolder && !projectSlug) throw new Error('A manifest, folder, or project scope is required')
      const clauses = ['_type == "mediaAsset"', 'client._ref == $clientId']
      const params = {clientId}
      for (const [key, value, field] of [
        ['sourceManifest', sourceManifest, 'sourceManifest'],
        ['sourceFolder', sourceFolder, 'sourceFolder'],
        ['projectSlug', projectSlug, 'project->slug.current'],
      ]) {
        if (value !== undefined) { params[key] = text(value, key); clauses.push(`${field} == $${key}`) }
      }
      return query(clauses.join(' && '), params)
    },
    findCollection({clientId, sourceManifest, projectId}) {
      if (projectId !== undefined) {
        text(projectId, 'projectId')
        // Include every project member, even a mismatched client, so the runner
        // sees the complete ordering boundary and can detect ownership conflicts.
        return query('_type == "mediaAsset" && project._ref == $projectId', {projectId})
      }
      text(sourceManifest, 'sourceManifest')
      return sanity.find({clientId, sourceManifest})
    },
    findProjects({clientId, slug}) {
      text(clientId, 'clientId')
      text(slug, 'slug')
      return query('_type == "project" && client._ref == $clientId && slug.current == $slug', {clientId, slug})
    },
    findClients(slug) {
      text(slug, 'slug')
      return query('_type == "client" && slug.current == $slug', {slug})
    },
    findTags(slugs) {
      if (!Array.isArray(slugs)) throw new Error('slugs must be an array')
      slugs.forEach(slug => text(slug, 'slug'))
      if (!slugs.length) return Promise.resolve([])
      return query('_type == "serviceTag" && slug.current in $slugs', {slugs})
    },
    // Explicit ordering snapshot only; not a general inventory query.
    findProjectOrder() { return query('_type == "project"', {}) },
    async commit(mutations) {
      allowWrite()
      if (!Array.isArray(mutations) || !mutations.length) throw new Error('Nonempty mutation array required')
      for (const mutation of mutations) {
        if (!mutation || Object.keys(mutation).length !== 1) throw new Error('Only strict create and guarded patch mutations are allowed')
        if (mutation.create) {
          text(mutation.create._id, 'create._id'); text(mutation.create._type, 'create._type')
        } else if (mutation.patch) {
          text(mutation.patch.id, 'patch.id'); text(mutation.patch.ifRevisionID, 'patch.ifRevisionID')
          if ('query' in mutation.patch) throw new Error('Query patches are not allowed')
        } else throw new Error('Only strict create and guarded patch mutations are allowed')
      }
      const client = await sanityClient()
      return providerCall('Sanity commit', () => client.mutate(mutations,
        {visibility: 'sync', returnDocuments: true, autoGenerateArrayKeys: false}))
    },
    async uploadImage({path, operationId}) {
      allowWrite(); operation(operationId)
      const client = await sanityClient()
      const body = streamFile(path)
      try {
        const asset = await providerCall('Sanity image upload', () => client.assets.upload('image', body,
          {filename: basename(path), label: operationId, extract: ['image']}))
        dimensions(asset?.metadata?.dimensions?.width, asset?.metadata?.dimensions?.height)
        if (!asset?._id) throw new Error('Sanity image upload returned no asset ID')
        return asset
      } finally { body.destroy() }
    },
  }
  const mux = {
    async createUpload({operationId}) {
      allowWrite(); operation(operationId)
      const client = await muxClient()
      // Mux Node 14.1.1; modern settings verified against current API documentation.
      const upload = await providerCall('Mux create upload', () => client.video.uploads.create({
        cors_origin: '*', new_asset_settings: {
          video_quality: 'basic', playback_policies: ['public'], passthrough: operationId,
        },
      }, {maxRetries: 0}))
      text(upload?.id, 'Mux upload ID'); text(upload?.url, 'Mux upload URL')
      return {id: upload.id, url: upload.url}
    },
    async getUpload(id) {
      text(id, 'upload ID')
      const client = await muxClient()
      const upload = await providerCall('Mux get upload', () => client.video.uploads.retrieve(id, {maxRetries: 0}))
      // Transient resume capability only: callers MUST NOT journal this URL.
      return {...uploadRecord(upload), ...(upload.url ? {url: upload.url} : {})}
    },
    async getAsset(id) {
      text(id, 'asset ID')
      const client = await muxClient()
      return providerCall('Mux get asset', () => client.video.assets.retrieve(id, {maxRetries: 0}))
    },
    async findUpload(operationId) {
      operation(operationId)
      const client = await muxClient()
      if (typeof client.video.uploads.list !== 'function') throw new Error('Mux upload reconciliation unsupported; manual reconciliation required')
      // The SDK async iterator follows every page. A plain array/first-page response
      // is NOT accepted: it cannot establish that a previous upload is absent.
      const matches = new Map()
      await providerCall('Mux upload reconciliation (manual reconciliation required on failure)', async () => {
        const pages = client.video.uploads.list({limit: 100}, {maxRetries: 0})
        if (typeof pages?.[Symbol.asyncIterator] !== 'function') throw new Error('Unsupported pagination')
        let count = 0
        for await (const upload of pages) {
          if (++count > 100000) throw new Error('Reconciliation scan limit reached')
          if (upload.new_asset_settings?.passthrough === operationId) matches.set(upload.id, uploadRecord(upload))
        }
      })
      if (matches.size > 1) throw new Error('Ambiguous Mux uploads for operationId; manual reconciliation required')
      return [...matches.values()][0] || null
    },
    async putUpload({url, path, size}) {
      allowWrite()
      let parsed
      try { parsed = new URL(url) } catch { throw new Error('Invalid Mux upload URL') }
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Mux upload URL must use HTTPS without userinfo')
      if (!Number.isSafeInteger(size) || size <= 0) throw new Error('Upload size must be a positive integer')
      const info = await statFile(path)
      if (!info.isFile() || info.size !== size) throw new Error('Upload file size changed')
      const body = streamFile(path)
      try {
        const response = await providerCall('Mux upload PUT', () => (dependencies.fetch || globalThis.fetch)(url, {
          method: 'PUT', body, duplex: 'half', redirect: 'error',
          headers: {'Content-Length': String(size), 'Content-Type': 'application/octet-stream'},
        }))
        if (!response.ok) throw new Error(`Mux upload PUT failed (HTTP ${response.status})`)
        await response.body?.cancel()
        return {ok: true}
      } finally { body.destroy() }
    },
  }
  async function probe(path, kind) {
    text(path, 'media path')
    if (kind === 'image') {
      const sharp = dependencies.sharp || (await import('sharp')).default
      const metadata = await sharp(path).metadata()
      const rotated = [5, 6, 7, 8].includes(metadata.orientation)
      return dimensions(rotated ? metadata.height : metadata.width, rotated ? metadata.width : metadata.height)
    }
    if (kind !== 'video') throw new Error('probe kind must be image or video')
    const result = await (dependencies.execFile || runFile)('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', resolve(path),
    ], {encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, timeout: 30000})
    const data = JSON.parse(result.stdout)
    const video = data.streams?.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic)
    if (!video) throw new Error('No video stream found')
    // Coded dimensions are not display dimensions for anamorphic sources. Reject
    // before upload instead of planning one ratio and receiving another from Mux.
    // ffprobe uses absent/N/A/0:1 for unspecified SAR (conventional square pixels).
    const sar = video.sample_aspect_ratio
    if (sar !== undefined && sar !== 'N/A' && sar !== '0:1') {
      const match = /^(\d+):(\d+)$/.exec(String(sar))
      if (!match || Number(match[1]) <= 0 || Number(match[2]) <= 0 || Number(match[1]) !== Number(match[2])) {
        throw new Error('Unsupported non-square or invalid sample aspect ratio; normalize/export this video with square pixels (SAR 1:1) before uploading')
      }
    }
    const rotation = Number(video.side_data_list?.find(side => side.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0)
    if (!Number.isFinite(rotation) || Math.abs(rotation / 90 - Math.round(rotation / 90)) > 0.001) {
      throw new Error('Unsupported video rotation')
    }
    const rotated = Math.abs(Math.round(rotation / 90)) % 2 === 1
    const measured = dimensions(Number(rotated ? video.height : video.width), Number(rotated ? video.width : video.height))
    const duration = Number(video.duration ?? data.format?.duration)
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Video has no valid duration')
    return {...measured, duration}
  }
  return {sanity, mux, probe}
}
