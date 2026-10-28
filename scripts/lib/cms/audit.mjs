import path from 'node:path'
import { readFile, readdir, realpath } from 'node:fs/promises'
import { invariant, same, targetOf, isVideoType, closestType, FIELDS, CAPS, validateField, validateDocument, validatePatch, schemaHash, SUPPORTED_SCHEMA_HASH } from './contract.mjs'
import { parseManifest, legacySlug } from './manifest.mjs'

// `cms audit`: a read-only health check of one whole dataset, rerunnable any time. It codifies the
// mechanical checks of the October 2026 media audit. It never writes, uploads or touches drafts, and
// its report carries ids, labels, titles, sizes and problems only. Every fix it suggests still goes
// through plan → approval of that plan id → apply → verify.
export const AUDIT_PUBLICATION = 'Read-only: no writes, no uploads, no drafts touched. Fixes go through plan → approval → apply → verify.'
export const NOT_CHECKED = [
  'what is inside the frame (a 9:16 picture pillarboxed in a 16:9 file passes the size check)',
  'alt text and description quality (only presence and length)',
  'the deployed Studio schema against the local schema files',
  'the same video uploaded twice under different files (needs frame comparison)',
  'where each asset lands on the globe, /work and detail pages',
]
// [severity, meaning]. Errors break a page or a CMS plan; warnings are drift or waste; info is context.
export const CHECKS = {
  'dangling-reference': ['error', 'A reference points at a document that does not exist.'],
  'media-without-file': ['error', 'A mediaAsset has neither an image nor a video.'],
  'media-without-client': ['error', 'A mediaAsset has no client.'],
  'file-kind-mismatch': ['error', 'The mediaType says video and the file is an image, or the reverse.'],
  'invalid-value': ['error', 'A field fails the runner contract (scripts/lib/cms/contract.mjs).'],
  'slug-collision': ['error', 'Two published documents of one type share a slug.'],
  'mux-errored': ['error', 'A Mux video errored; it will not play.'],
  'mux-asset-missing': ['error', 'A Mux document points at a Mux asset that no longer exists.'],
  'manifest-missing-document': ['error', 'A manifest row is bound (sanityId) to a document that does not exist.'],
  'schema-fingerprint': ['warning', 'src/schemas changed since the runner contract was reviewed; plan refuses until SUPPORTED_SCHEMA_HASH is refreshed.'],
  'draft-pending': ['warning', 'An unpublished draft or release version exists; CMS plans touching that document stop until it is resolved in Studio.'],
  'label-ratio': ['warning', 'The aspect label breaks the approved label policy for its native size (see expectedType); padded files and eye calls belong in media/_audit-accepted.json.'],
  'album-art-not-square': ['warning', 'Album art is not square; the album wall crops it to 1:1.'],
  'album-art-without-release': ['info', 'Album art has no releaseInfo (queries.js fetches it; no component renders it today).'],
  'unused-image': ['warning', 'An image file no document references.'],
  'unused-video': ['warning', 'A Mux video document no document references (its Mux asset is stored and billed).'],
  'shared-file': ['warning', 'Several mediaAssets show the same file.'],
  'duplicate-image': ['warning', 'Several image files with identical bytes.'],
  'mux-not-ready': ['warning', 'A Mux video is not ready.'],
  'mux-asset-undocumented': ['warning', 'A Mux asset no Sanity document describes (stored and billed, never shown).'],
  'alt-missing': ['warning', 'A mediaAsset has no alt text.'],
  'text-too-long': ['warning', 'Alt text or description is over the Studio limit.'],
  'unknown-field': ['warning', 'A populated field the local schema does not define (a legacy leftover).'],
  'rank-collision': ['warning', 'Several documents share an orderRank; their order is ambiguous and appends refuse.'],
  'manifest-unreadable': ['warning', 'A manifest the runner cannot parse.'],
  'manifest-drift': ['warning', 'A manifest row disagrees with Sanity (Sanity is the editorial authority: fix the row, or plan the change).'],
  'manifest-duplicate-row': ['warning', 'Several manifest rows resolve to one document.'],
  'unbound-document': ['warning', 'A mediaAsset no manifest row resolves to.'],
  'manifest-pending-row': ['info', 'A manifest row with no document yet (pending intake; a video intake is a paid upload).'],
  'description-missing': ['info', 'A mediaAsset has no description.'],
  'accepted-stale': ['info', 'An entry in media/_audit-accepted.json no longer matches a finding (the label changed or the problem is gone); remove it.'],
}
export const ACCEPTED_FILE = 'media/_audit-accepted.json'
const SCHEMA_TYPES = ['mediaAsset', 'project', 'client', 'serviceTag', 'globeSettings', 'siteSettings']
const STANDARD = { '1x1': 1, '3x4': 3 / 4, '4x5': 4 / 5, '9x16': 9 / 16, '16x9': 16 / 9, '4x3': 4 / 3 }
const TOLERANCE = Math.log(1.1), EXTREME = Math.log(2.4)

// The Mux plugin keeps its token in secrets.mux; system documents live under _.
export const secretDocument = doc => doc?._type === 'mux.apiKey' || /^(?:drafts\.)?(?:secrets|_)\./.test(doc?._id ?? '')
const baseId = id => id.replace(/^drafts\./, '').replace(/^versions\.[^.]+\./, '')
const group = (items, key) => { const map = new Map(); for (const item of items) { const k = key(item); if (k == null) continue; if (!map.has(k)) map.set(k, []); map.get(k).push(item) } return map }
const tally = (items, key) => Object.fromEntries([...group(items, key)].map(([k, v]) => [k, v.length]).sort())

// Nathan's label policy (decisions page, 10-09; R1–R4): a standard ratio within 10% → the runner's
// closestType(); otherwise wider than 2.4:1 or taller than 1:2.4 → *_other; otherwise a label on the
// other neighbouring standard stays (an eye call); otherwise closestType(). Stills have no 4:3 type.
// Padding needs eyes (the label follows the content), so padded files go in the accepted list.
export function expectedType(width, height, kind, current = null) {
  const r = width / height, prefix = kind === 'video' ? 'motion' : 'static', closest = closestType(width, height, kind)
  const ratios = Object.entries(STANDARD).filter(([k]) => kind === 'video' || k !== '4x3').sort((a, b) => a[1] - b[1])
  if (ratios.some(([, v]) => Math.abs(Math.log(r / v)) <= TOLERANCE)) return closest
  if (Math.abs(Math.log(r)) >= EXTREME) return `${prefix}_other`
  const neighbours = [ratios.findLast(([, v]) => v < r), ratios.find(([, v]) => v > r)].filter(Boolean).map(([k]) => `${prefix}_${k}`)
  return neighbours.includes(current) ? current : closest
}
// Native display size: Sanity image metadata for stills; Mux's display aspect (then track size) for video.
function nativeSize(doc, images, videos) {
  if (doc.video?.asset?._ref) {
    const data = videos.get(doc.video.asset._ref)?.data, m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(data?.aspect_ratio || '')
    if (m && +m[1] > 0 && +m[2] > 0) return { kind: 'video', width: +m[1], height: +m[2] }
    const track = data?.tracks?.find(t => t.type === 'video')
    return track?.max_width > 0 && track?.max_height > 0 ? { kind: 'video', width: track.max_width, height: track.max_height } : null
  }
  const d = images.get(doc.image?.asset?._ref)?.metadata?.dimensions
  return d?.width > 0 && d?.height > 0 ? { kind: 'image', width: d.width, height: d.height } : null
}
function* refsOf(value, at = '') {
  if (Array.isArray(value)) { for (const [i, v] of value.entries()) yield* refsOf(v, `${at}[${i}]`); return }
  if (!value || typeof value !== 'object') return
  if (typeof value._ref === 'string') yield { path: at, ref: value._ref }
  for (const [k, v] of Object.entries(value)) if (k !== '_system' && v && typeof v === 'object') yield* refsOf(v, at ? `${at}.${k}` : k)
}

export function auditDataset({ target, docs, muxAssets = null, manifests = null, accepted = null, schema = {}, fingerprint = true, checkedAt = new Date().toISOString() }) {
  const found = Object.fromEntries(Object.keys(CHECKS).map(k => [k, []]))
  const add = (check, item) => found[check].push(item)
  docs = docs.filter(d => !secretDocument(d))
  const all = new Set(docs.map(d => d._id))
  const published = docs.filter(d => baseId(d._id) === d._id), byId = new Map(published.map(d => [d._id, d]))
  const ofType = type => published.filter(d => d._type === type)
  const media = ofType('mediaAsset')
  const images = new Map(ofType('sanity.imageAsset').map(d => [d._id, d])), videos = new Map(ofType('mux.videoAsset').map(d => [d._id, d]))
  if (!fingerprint) add('schema-fingerprint', { problem: 'src/schemas hash differs from SUPPORTED_SCHEMA_HASH' })

  // Drafts and release versions count as users: a draft still showing a file keeps it in use.
  const referenced = new Set()
  for (const doc of docs) for (const { path: at, ref } of refsOf(doc)) {
    referenced.add(ref)
    if (!all.has(ref)) add('dangling-reference', { id: doc._id, path: at, ref, ...(all.has(`drafts.${ref}`) ? { note: 'only a draft exists' } : {}) })
  }
  for (const doc of docs) if (baseId(doc._id) !== doc._id) add('draft-pending', { id: doc._id, type: doc._type, published: byId.has(baseId(doc._id)) })

  for (const doc of media) {
    const imageRef = doc.image?.asset?._ref, videoRef = doc.video?.asset?._ref
    if (!imageRef && !videoRef) add('media-without-file', { id: doc._id, mediaType: doc.mediaType ?? null })
    if (!doc.client?._ref) add('media-without-client', { id: doc._id })
    const wantsVideo = isVideoType(doc.mediaType), wantsImage = /^static_/.test(doc.mediaType || '') || ['album-art', 'logo'].includes(doc.mediaType)
    if (wantsVideo && imageRef && !videoRef || wantsImage && videoRef && !imageRef) add('file-kind-mismatch', { id: doc._id, mediaType: doc.mediaType, file: videoRef ? 'video' : 'image' })
    const size = nativeSize(doc, images, videos), family = /^(static|motion)_/.exec(doc.mediaType || '')?.[1]
    if (size && family && (family === 'motion') === (size.kind === 'video')) {
      const suggested = expectedType(size.width, size.height, size.kind, doc.mediaType)
      if (suggested !== doc.mediaType) add('label-ratio', { id: doc._id, title: doc.title ?? null, mediaType: doc.mediaType, native: `${size.width}×${size.height}`, ratio: +(size.width / size.height).toFixed(3), suggested })
    }
    if (doc.mediaType === 'album-art') {
      if (size && Math.abs(Math.log(size.width / size.height)) > TOLERANCE) add('album-art-not-square', { id: doc._id, native: `${size.width}×${size.height}` })
      if (!doc.releaseInfo) add('album-art-without-release', { id: doc._id, title: doc.title ?? null })
    }
    if (!doc.alt?.trim?.()) add('alt-missing', { id: doc._id, title: doc.title ?? null })
    if (!doc.description?.trim?.()) add('description-missing', { id: doc._id })
    for (const field of ['alt', 'description']) if (typeof doc[field] === 'string' && doc[field].length > CAPS.mediaAsset[field]) add('text-too-long', { id: doc._id, field, length: doc[field].length, limit: CAPS.mediaAsset[field] })
  }
  for (const [file, ids] of group(media, d => d.video?.asset?._ref || d.image?.asset?._ref)) if (ids.length > 1) add('shared-file', { file, ids: ids.map(d => d._id) })
  for (const [sha1hash, list] of group([...images.values()], d => d.sha1hash)) if (list.length > 1) add('duplicate-image', { sha1hash, ids: list.map(d => d._id) })
  for (const doc of images.values()) if (!referenced.has(doc._id)) add('unused-image', { id: doc._id, ...(doc.metadata?.dimensions ? { size: `${doc.metadata.dimensions.width}×${doc.metadata.dimensions.height}` } : {}) })

  // Mux: the live asset list (when credentials are present) outranks the status copied into Sanity.
  const live = muxAssets && new Map(muxAssets.map(a => [a.id, a]))
  for (const doc of videos.values()) {
    if (!referenced.has(doc._id)) add('unused-video', { id: doc._id, assetId: doc.assetId ?? null })
    if (live && !live.has(doc.assetId)) { add('mux-asset-missing', { id: doc._id, assetId: doc.assetId ?? null }); continue }
    const status = live ? live.get(doc.assetId).status : doc.status || doc.data?.status
    if (status === 'errored') add('mux-errored', { id: doc._id, assetId: doc.assetId ?? null })
    else if (status !== 'ready') add('mux-not-ready', { id: doc._id, status: status ?? null })
  }
  if (live) { const described = new Set([...videos.values()].map(v => v.assetId)); for (const a of muxAssets) if (!described.has(a.id)) add('mux-asset-undocumented', { assetId: a.id, status: a.status ?? null, duration: a.duration ?? null }) }

  for (const doc of published.filter(d => FIELDS[d._type])) {
    const problems = new Map()
    try { validateDocument(doc) } catch (error) { problems.set(error.message, null) }
    for (const field of FIELDS[doc._type]) if (doc[field] !== undefined) try { validateField(field, doc[field]) } catch (error) { if (!problems.has(error.message)) problems.set(error.message, field) }
    for (const [problem, field] of problems) add('invalid-value', { id: doc._id, ...(field ? { field } : {}), problem })
  }
  for (const [key, list] of group(published, d => d.slug?.current ? `${d._type}:${d.slug.current}` : null)) if (list.length > 1) add('slug-collision', { type: list[0]._type, slug: key.slice(key.indexOf(':') + 1), ids: list.map(d => d._id) })
  // Media order only matters inside one page: its project, or its client collection when it has none.
  const rankScope = d => d._type !== 'mediaAsset' ? d._type : `mediaAsset:${d.project?._ref || `${d.client?._ref}:${d.sourceManifest}`}`
  for (const list of group(published, d => d.orderRank ? `${rankScope(d)}|${d.orderRank}` : null).values()) if (list.length > 1) add('rank-collision', { type: list[0]._type, orderRank: list[0].orderRank, ids: list.map(d => d._id) })
  const unknown = new Map()
  for (const doc of published) { const names = schema[doc._type]; if (!names) continue; for (const k of Object.keys(doc)) if (!k.startsWith('_') && !names.has(k)) { const key = `${doc._type}.${k}`; if (!unknown.has(key)) unknown.set(key, []); unknown.get(key).push(doc._id) } }
  for (const [key, ids] of unknown) add('unknown-field', { type: key.slice(0, key.indexOf('.')), field: key.slice(key.indexOf('.') + 1), count: ids.length, ids })

  // Manifests: a row binds by sanityId, else by the runner's legacy id (client + title or file name).
  let rowCount = 0
  if (manifests) {
    const bound = new Map()
    for (const { file: manifest, raw } of manifests) {
      let parsed
      try { parsed = parseManifest(raw) } catch (error) { add('manifest-unreadable', { manifest, problem: error.message }); continue }
      const { header, assets, columns } = parsed
      for (const row of assets) {
        rowCount++
        const id = row.sanityid || `mediaAsset-${legacySlug(header.client)}-${legacySlug(row.title || path.basename(row.file, path.extname(row.file)))}`
        const doc = byId.get(id)
        if (doc?._type !== 'mediaAsset') { add(row.sanityid ? 'manifest-missing-document' : 'manifest-pending-row', { manifest, file: row.file, ...(row.sanityid ? { id } : {}) }); continue }
        if (!bound.has(id)) bound.set(id, [])
        bound.get(id).push({ manifest, file: row.file })
        for (const [column, field, value] of [['mediatype', 'mediaType', row.mediatype], ['title', 'title', row.title || undefined], ['contentrole', 'contentRole', row.contentrole || undefined], ['displaygroup', 'displayGroup', row.displaygroup || undefined], ['branddeckorder', 'brandDeckOrder', row.branddeckorder ? Number(row.branddeckorder) : undefined]]) {
          if (!columns.includes(column) || column === 'title' && value === undefined) continue
          if ((value ?? null) !== (doc[field] ?? null)) add('manifest-drift', { id, manifest, file: row.file, field, manifestValue: value ?? null, sanityValue: doc[field] ?? null })
        }
      }
    }
    for (const [id, rows] of bound) if (rows.length > 1) add('manifest-duplicate-row', { id, rows })
    for (const doc of media) if (!bound.has(doc._id)) add('unbound-document', { id: doc._id, sourceManifest: doc.sourceManifest ?? null })
  }

  // Accepted exceptions are decisions already made: an entry hides only its exact finding (for a label,
  // only while the label is the one decided), and one that matches nothing is reported so the list stays true.
  const kept = [], used = new Set()
  for (const [check, items] of Object.entries(found)) found[check] = items.filter(item => {
    const index = (accepted || []).findIndex(a => a.check === check && a.id === item.id && (a.mediaType == null || a.mediaType === item.mediaType))
    if (index < 0) return true
    used.add(index); kept.push({ check, ...item, reason: accepted[index].reason }); return false
  })
  for (const [index, a] of (accepted || []).entries()) if (!used.has(index)) add('accepted-stale', { check: a.check, id: a.id, ...(a.mediaType ? { mediaType: a.mediaType } : {}) })

  const findings = Object.entries(found).filter(([, items]) => items.length).map(([check, items]) => ({ check, severity: CHECKS[check][0], meaning: CHECKS[check][1], count: items.length, items }))
  const summary = Object.fromEntries(['error', 'warning', 'info'].map(s => [`${s}s`, findings.filter(f => f.severity === s).reduce((n, f) => n + f.count, 0)]))
  // Only mechanical fixes become a draft request, never for a document with a pending draft: the
  // suggested label, and a legacy video shape (a muxVideo type, a strong reference) rewritten to the
  // shape the runner writes when its Mux document exists.
  const sets = new Map(), suggest = (id, set) => { if (!all.has(`drafts.${id}`)) sets.set(id, { ...sets.get(id), ...set }) }
  for (const item of found['label-ratio']) suggest(item.id, { mediaType: item.suggested })
  for (const item of found['invalid-value']) {
    const ref = item.field === 'video' && byId.get(item.id)?.video?.asset?._ref
    if (ref && videos.has(ref)) suggest(item.id, { video: { _type: 'mux.video', asset: { _type: 'reference', _ref: ref, _weak: true } } })
  }
  const patches = [...sets].map(([id, set]) => ({ id, type: 'mediaAsset', set, unset: [] }))
  for (const p of patches) validatePatch(p.type, p.set, p.unset)
  return {
    audit: 'cms', target, checkedAt, publication: AUDIT_PUBLICATION,
    mux: live ? `${muxAssets.length} live Mux assets checked` : 'live Mux not checked (no MUX_TOKEN_ID/MUX_TOKEN_SECRET); statuses come from Sanity',
    manifests: manifests ? `${manifests.length} manifests, ${rowCount} rows under media/` : 'not checked (no media/ folder in this checkout)',
    counts: { documents: tally(published, d => d._type), drafts: docs.length - published.length, mediaTypes: tally(media, d => d.mediaType) },
    summary, findings,
    accepted: accepted ? { file: ACCEPTED_FILE, count: kept.length, items: kept } : null,
    suggestedChanges: patches.length ? { note: 'Review every row first: some labels are deliberate editorial calls. Save what you keep as a changes request, then plan it.', request: { version: 1, patches } } : null,
    notChecked: NOT_CHECKED,
  }
}

export async function loadManifests(checkout) {
  const root = path.join(checkout, 'media'), found = []
  async function walk(dir) {
    for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) await walk(file)
      else if (entry.isFile() && entry.name === '_manifest.md') found.push({ file: path.relative(checkout, file), raw: await readFile(file, 'utf8') })
    }
  }
  try { await walk(root) } catch (error) { if (error.code === 'ENOENT' && error.path === root) return null; throw error }
  return found
}
// The accepted list: {version: 1, accepted: [{check, id, mediaType?, reason, decided?}]}. Absent is fine;
// a malformed one stops the audit, since silently ignoring it would resurface or hide decisions.
export async function loadAccepted(checkout) {
  let raw
  try { raw = await readFile(path.join(checkout, ACCEPTED_FILE), 'utf8') } catch (error) { if (error.code === 'ENOENT') return null; throw error }
  let data
  try { data = JSON.parse(raw) } catch { invariant(false, `${ACCEPTED_FILE} is not valid JSON`) }
  invariant(data?.version === 1 && Array.isArray(data.accepted), `${ACCEPTED_FILE} needs version 1 and an accepted list`)
  for (const [i, a] of data.accepted.entries()) {
    invariant(CHECKS[a?.check] && a.check !== 'accepted-stale', `${ACCEPTED_FILE} entry ${i + 1}: unknown check ${a?.check}`)
    invariant(typeof a.id === 'string' && a.id && typeof a.reason === 'string' && a.reason.trim(), `${ACCEPTED_FILE} entry ${i + 1}: id and reason are required`)
    invariant(a.mediaType === undefined || typeof a.mediaType === 'string', `${ACCEPTED_FILE} entry ${i + 1}: mediaType must be text`)
  }
  return data.accepted
}
// Every name in each schema file (nested fields and orderings included): generous on purpose, so only
// fields the schema never mentions are flagged.
export async function schemaFields(checkout) {
  const fields = {}
  for (const type of SCHEMA_TYPES) {
    let source
    try { source = await readFile(path.join(checkout, 'src/schemas', `${type}.ts`), 'utf8') } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    fields[type] = new Set([...source.matchAll(/\bname:\s*['"]([A-Za-z_]\w*)['"]/g)].map(m => m[1]))
    // @sanity/orderable-document-list adds its field without naming it in the file.
    if (source.includes('orderRankField(')) fields[type].add('orderRank')
  }
  return fields
}
// One read at a time: Sanity snapshot, then the Mux list, then local files.
export async function runAudit({ checkout, target, sanity, mux = null }) {
  target = targetOf(target); invariant(same(sanity.target, target), 'Adapter target mismatch')
  checkout = await realpath(checkout)
  const docs = await sanity.snapshot()
  const muxAssets = mux ? await mux.listAssets() : null
  const manifests = await loadManifests(checkout)
  const accepted = await loadAccepted(checkout)
  const schema = await schemaFields(checkout)
  const fingerprint = await schemaHash(checkout) === SUPPORTED_SCHEMA_HASH
  return auditDataset({ target, docs, muxAssets, manifests, accepted, schema, fingerprint })
}
