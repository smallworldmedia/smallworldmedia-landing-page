import path from 'node:path'
import { readFile, realpath } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { toProjectSlug } from '../../../src/lib/projectSlug.js'
import { VERSION, SUPPORTED_SCHEMA_HASH, PUBLICATION, NO_EDIT_WINDOW, DELETE_TYPES, IRREVERSIBLE, invariant, keys, targetOf, digest, clean, same, validId, validMuxId, validRank, validatePatch, validateDocument, references, refersTo, patched, withoutSystem, appendRanks, schemaHash, closestType, isVideoType } from './contract.mjs'
import { checkoutLocked } from './state.mjs'
import { parseManifest, legacySlug, inspectFile, scopedFile, fileHash, boundManifest, writeBindings } from './manifest.mjs'

const ref = id => ({ _type: 'reference', _ref: id })
const published = docs => docs.filter(d => !d._id.startsWith('drafts.') && !d._id.startsWith('versions.'))
const byId = docs => new Map(docs.filter(Boolean).map(d => [d._id, d]))
const allIds = ids => [...new Set(ids.flatMap(id => [id, `drafts.${id}`]))]
async function fresh(sanity, ids) { return byId(await sanity.getDocuments(allIds(ids))) }
function noDraft(map, id) { invariant(!map.has(`drafts.${id}`), `Draft conflict: ${id}; resolve editorially before a refreshed plan`) }
async function uniqueResolve(docs, label, sanity) {
  const ids = [...new Set(docs.map(d => d._id.replace(/^drafts\./,'')))]
  invariant(ids.length === 1, `${label}: ${ids.length ? 'ambiguous' : 'not found'}; use explicit creation/binding`)
  const current = await fresh(sanity, ids); noDraft(current, ids[0]); invariant(current.has(ids[0]), `${label}: no published document`); return current.get(ids[0])
}
function collectionSnapshot(docs) {
  return docs.map(d => ({ id: d._id, rank: d.orderRank ?? null, project: d.project?._ref ?? null, sourceFolder: d.sourceFolder ?? null, sourceManifest: d.sourceManifest ?? null })).sort((a,b) => a.id.localeCompare(b.id))
}
async function captureCollection(sanity, selector) {
  const results = selector.projectOrder ? await sanity.findProjectOrder() : await sanity.findCollection(selector)
  const current = await fresh(sanity, results.map(d => d._id.replace(/^drafts\./,'')))
  const docs = [...current.values()]
  invariant(!docs.some(d => d._id.startsWith('drafts.')), 'Draft conflict in affected ordering collection')
  return { selector, snapshot: collectionSnapshot(docs), docs }
}
function mediaGrouping(doc) { invariant(doc.client?._ref && doc.sourceManifest && doc.sourceFolder, `Missing grouping on ${doc._id}; explicit reconciliation required`); return { clientId: doc.client._ref, sourceManifest: doc.sourceManifest } }
async function addCollection(collections, sanity, selector) { const old = collections.find(c => same(c.selector, selector)); if (old) return old; const c = await captureCollection(sanity, selector); collections.push(c); return c }
// A video rebind (set.video) also pins the Mux document it points at, like any other reference.
const opReferences = op => op.after ? [...references(op.after), ...(Object.hasOwn(op.set || {}, 'video') ? [{ id: op.after.video.asset._ref, type: 'mux.videoAsset' }] : [])] : []
// A delete's Sanity half is done from these stages on; its Mux half may still be pending.
const removed = (op, state) => op.action === 'delete' && ['deleted','mux-deleting','done'].includes(state?.stage)
// Sanity has no ifRevisionID on delete; an unset of this never-written field carries the guard in the same transaction.
const DELETE_GUARD_FIELD = 'swmDeleteRevisionGuard'
const muxSnapshot = asset => clean({ id: asset.id, status: asset.status, created_at: asset.created_at == null ? undefined : String(asset.created_at), duration: Number.isFinite(asset.duration) ? asset.duration : undefined })
function validMuxSnapshot(s, id) { keys(s, ['id','status','created_at','duration'], 'Mux asset snapshot'); invariant(validMuxId(s.id) && s.id === id && typeof s.status === 'string', 'Invalid Mux asset snapshot') }
function readyMuxDocument(video) { invariant(video?._type === 'mux.videoAsset' && video.status === 'ready' && video.playbackId && video.data?.aspect_ratio, 'Mux document missing readiness/playback/aspect'); return video }
async function readyVideo(sanity, mux, id) {
  const video = readyMuxDocument((await sanity.getDocuments([id])).find(Boolean))
  const asset = await mux.getAsset(video.assetId)
  invariant(readyMux(asset) && asset.id === video.assetId && asset.aspect_ratio === video.data.aspect_ratio && asset.playback_ids.some(p => p.policy === 'public' && p.id === video.playbackId), 'Mux readiness/playback/aspect verification failed')
}
async function resolveReferences(operations, sanity) {
  const created = new Map(operations.filter(o => o.action === 'create').map(o => [o.id, o.after]))
  const wanted = operations.flatMap(opReferences), externalIds = [...new Set(wanted.map(r => r.id).filter(id => !created.has(id)))]
  const current = await fresh(sanity, externalIds)
  for (const r of wanted) { invariant(validId(r.id), 'Unresolved reference'); const d = created.get(r.id) || current.get(r.id); noDraft(current, r.id); invariant(d && d._type === r.type, `Unresolved/wrong-type ${r.type} reference ${r.id}`) }
  for (const op of operations) if (op.after?._type === 'mediaAsset' && op.after.project?._ref) {
    const project = created.get(op.after.project._ref) || current.get(op.after.project._ref)
    invariant(project.client?._ref === op.after.client?._ref, `Project/client mismatch on ${op.id}`)
  }
  return externalIds.map(id => ({ id, rev: current.get(id)._rev, type: current.get(id)._type }))
}
// Deletes run last, in request order. A target may still be referenced at plan time only by a
// document this plan patches the reference out of, or deletes earlier.
async function planDeletes(deletes, operations, collections, informational, sanity, mux) {
  const deleted = new Set()
  for (const d of deletes) {
    keys(d, ['id','type','muxAsset'], 'delete'); invariant(DELETE_TYPES.includes(d.type), `Unsupported delete type ${d.type}`)
    invariant(d.muxAsset === undefined || d.muxAsset === true && d.type === 'mux.videoAsset', '"muxAsset": true applies only to a mux.videoAsset delete')
    if (d.type === 'mux.asset') {
      invariant(validMuxId(d.id) && mux, 'A Mux asset delete needs a valid Mux asset ID and Mux read access')
      const asset = await mux.findAsset(d.id); invariant(asset?.id === d.id, `Mux asset not found: ${d.id}`)
      invariant(!(await sanity.findMuxDocuments(d.id)).length, `Mux asset ${d.id} is described by a Sanity document; delete that mux.videoAsset with "muxAsset": true`)
      operations.push({ id: d.id, action: 'delete', type: d.type, before: muxSnapshot(asset), after: null, set: {}, unset: [], upload: false, diff: [] })
      continue
    }
    invariant(validId(d.id), 'Delete requires a published stable ID')
    const current = await fresh(sanity, [d.id]); noDraft(current, d.id)
    const before = current.get(d.id); invariant(before?._type === d.type, `Delete target/type not found: ${d.id}`)
    for (const blocker of await sanity.findDeleteBlockers(d.id)) {
      const patch = operations.find(o => o.id === blocker._id && o.action === 'patch')
      invariant(deleted.has(blocker._id) || patch && !refersTo(patch.after, d.id), `Delete of ${d.id} blocked by ${blocker._id} (${blocker._type}); patch its reference away or delete it earlier in this plan`)
    }
    let muxAsset
    if (d.muxAsset) {
      invariant(mux && validMuxId(before.assetId), `No Mux access or assetId for ${d.id}`)
      const asset = await mux.findAsset(before.assetId); invariant(asset?.id === before.assetId, `Mux asset ${before.assetId} not found; delete ${d.id} without "muxAsset"`)
      invariant((await sanity.findMuxDocuments(before.assetId)).every(doc => doc._id === d.id), `Another document describes Mux asset ${before.assetId}`)
      muxAsset = muxSnapshot(asset)
    }
    deleted.add(d.id)
    operations.push(clean({ id: d.id, action: 'delete', type: d.type, before, after: null, set: {}, unset: [], upload: false, diff: [], mux: muxAsset }))
    if (d.type === 'mediaAsset') { await addCollection(collections, sanity, mediaGrouping(before)); if (before.project?._ref) await addCollection(collections, sanity, { projectId: before.project._ref }) }
  }
  // The first-ranked member is the hero: say so when a delete changes it.
  const first = items => items.filter(s => validRank(s.rank)).sort((a,b) => a.rank < b.rank ? -1 : 1)[0]?.id ?? null
  for (const c of collections) {
    const was = first(c.snapshot), now = first(c.snapshot.filter(s => !deleted.has(s.id)))
    if (c.snapshot.some(s => deleted.has(s.id)) && was !== now) informational.push(`${JSON.stringify(c.selector)}: first-ranked (hero) asset changes ${was} -> ${now ?? 'none'}`)
  }
}
function diffOf(before, after, set, unset) { return [...new Set([...Object.keys(set), ...unset])].sort().map(field => ({ field, before: before?.[field] ?? null, after: after[field] ?? null })) }
export async function planChanges({ checkout, target, manifest, changes, sanity, probe, mux }) {
  target = targetOf(target); invariant(same(sanity.target, target), 'Adapter target mismatch')
  invariant(Boolean(manifest) !== Boolean(changes), 'Choose exactly one scoped manifest or changes request')
  checkout = await realpath(checkout)
  invariant(await schemaHash(checkout) === SUPPORTED_SCHEMA_HASH, 'Schema drift: review runner allowlist/validation and refresh its supported schema fingerprint before planning')
  const input = await realpath(path.resolve(manifest || changes)), original = await readFile(input, 'utf8')
  const scope = { kind: manifest ? 'manifest' : 'changes', path: input, root: path.dirname(input), sha256: digest(original), original }
  const operations = [], collections = [], informational = []
  if (manifest) {
    const { header, assets } = parseManifest(original)
    const client = await uniqueResolve(await sanity.findClients(legacySlug(header.client)), `Client ${header.client}`, sanity)
    const collection = await addCollection(collections, sanity, { clientId: client._id, sourceManifest: path.basename(scope.root) })
    const boundIds = assets.filter(r => r.sanityid).map(r => r.sanityid)
    invariant(boundIds.every(validId), 'Invalid sanityId')
    const bound = await fresh(sanity, boundIds)
    for (const id of boundIds) { noDraft(bound, id); invariant(bound.get(id)?._type === 'mediaAsset' && bound.get(id)?.client?._ref === client._id, `Binding ${id} is missing, wrong type or wrong client`) }
    // The intake folder can move; bound IDs and a unique stored grouping retain its identity.
    const groupingDocs = [...collection.docs, ...boundIds.map(id => bound.get(id))]
    const folders = [...new Set(groupingDocs.map(d => d.sourceFolder).filter(Boolean))]
    const names = [...new Set(groupingDocs.map(d => d.sourceManifest).filter(Boolean))]
    invariant(folders.length <= 1 && names.length <= 1, 'Ambiguous collection grouping; provide a narrowly reconciled intake')
    const sourceFolder = folders[0] || scope.root, sourceManifest = names[0] || path.basename(scope.root)
    if (sourceManifest !== path.basename(scope.root)) await addCollection(collections, sanity, { clientId: client._id, sourceManifest })
    const storedProjects = [...new Set(groupingDocs.map(d => d.project?._ref).filter(Boolean))]
    invariant(storedProjects.length <= 1, 'Collection has conflicting project references')
    let project
    if (header.project) project = await uniqueResolve(await sanity.findProjects({ clientId: client._id, slug: header.project }), `Project ${header.project}`, sanity)
    else if (storedProjects.length) { const current = await fresh(sanity, storedProjects); noDraft(current, storedProjects[0]); project = current.get(storedProjects[0]); invariant(project?._type === 'project', 'Missing collection project') }
    else if (sourceManifest.toLowerCase() !== 'artwork') {
      const slug = toProjectSlug(client.slug.current, sourceManifest), matches = await sanity.findProjects({ clientId: client._id, slug })
      if (matches.length) project = await uniqueResolve(matches, `Project ${slug}`, sanity)
    }
    if (project) { invariant(project.client?._ref === client._id, 'Project/client mismatch'); await addCollection(collections, sanity, { projectId: project._id }) }
    const existing = byId(collections.flatMap(c => c.docs).filter(d => d._type === 'mediaAsset' && d.client?._ref === client._id && d.sourceFolder === sourceFolder && d.sourceManifest === sourceManifest))
    for (const id of boundIds) existing.set(id, bound.get(id))
    const matched = new Set(), unboundRows = []
    for (const row of assets) {
      let before = row.sanityid ? bound.get(row.sanityid) : undefined
      const legacyId = `mediaAsset-${legacySlug(header.client)}-${legacySlug(row.title || path.basename(row.file, path.extname(row.file)))}`
      if (!before) before = existing.get(legacyId)
      if (!before && !row.sanityid) {
        const collision = await fresh(sanity, [legacyId]); noDraft(collision, legacyId)
        invariant(!collision.has(legacyId), `Legacy ID ${legacyId} exists outside the verified collection; resolve sanityId`)
      }
      if (before) { invariant(before.sourceFolder === sourceFolder && before.sourceManifest === sourceManifest, 'Bound identity crosses collection'); invariant(!matched.has(before._id), 'Duplicate resolved identity'); matched.add(before._id) }
      else unboundRows.push(row)
      const id = before?._id || `mediaAsset-${randomUUID()}`
      // Probe/hash every selected file, but never replay an old row's editorial metadata.
      const source = await inspectFile(scope.root, row.file, row.mediatype, probe)
      const suggestion = closestType(source.dimensions.width, source.dimensions.height, source.kind)
      if (/^(static|motion)_/.test(row.mediatype) && row.mediatype !== suggestion) informational.push(`${row.file}: native ${source.dimensions.width}×${source.dimensions.height}; nearest ${suggestion}; reviewed classification remains ${row.mediatype}`)
      if (before) {
        operations.push({ id, action: 'unchanged', type: 'mediaAsset', before, after: clean(before), set: {}, unset: [], source, upload: false, rowFile: row.file, diff: [] })
        if (row.title && row.title !== before.title || row.mediatype !== before.mediaType) informational.push(`${id}: manifest metadata differs from Studio; unchanged (request an explicit patch)`)
        continue
      }
      const tags = (row.servicetype ? row.servicetype.split(',').map(t => t.trim()) : header.services).map(legacySlug)
      const tagDocs = await sanity.findTags(tags), services = []
      for (const slug of tags) { const tag = await uniqueResolve(tagDocs.filter(d => d.slug?.current === slug || d._id === `serviceTag-${slug}` || d._id === `drafts.serviceTag-${slug}`), `Service ${slug}`, sanity); services.push({ ...ref(tag._id), _key: slug }) }
      const title = row.title || path.basename(row.file), set = { title, slug: { _type: 'slug', current: legacySlug(title) }, mediaType: row.mediatype, client: ref(client._id), services }
      if (project) set.project = ref(project._id)
      if (header.year) set.yearStart = +header.year
      for (const [col, field] of [['contentrole','contentRole'],['displaygroup','displayGroup']]) if (row[col]) set[field] = row[col]
      if (row.branddeckorder) set.brandDeckOrder = +row.branddeckorder
      const after = { _id: id, _type: 'mediaAsset', ...set, sourceFolder, sourceManifest }
      operations.push({ id, action: 'create', type: 'mediaAsset', before: null, after, set, unset: [], source, upload: true, rowFile: row.file, diff: [] })
    }
    const unmatched = [...existing.keys()].filter(id => !matched.has(id))
    invariant(!unboundRows.length || !unmatched.length, `Unbound new/renamed rows alongside unmatched legacy assets (${unmatched.join(', ')}); bind existing rows or use a separately reviewed explicit scope before adding`)
    const ranks = appendRanks([...byId(collections.flatMap(c => c.docs)).values()], unboundRows.length)
    let index = 0
    for (const op of operations) if (op.action === 'create') { op.set.orderRank = ranks[index++]; op.after.orderRank = op.set.orderRank; validateDocument(op.after, { creation: true }); op.diff = diffOf(null, op.after, { ...op.set, sourceFolder, sourceManifest }, []) }
    informational.push('Legacy isHero/sortOrder are not replayed. Existing media (including missing links) is unchanged; use an explicit upload patch for repair/replacement.')
  } else {
    const request = JSON.parse(original)
    keys(request, ['version','patches','creates','inspect','deletes'], 'changes request'); invariant(request.version === VERSION, 'Unsupported changes version')
    invariant(['patches','creates','inspect','deletes'].every(k => Array.isArray(request[k] || [])), 'Changes arrays required')
    invariant(['patches','creates','inspect','deletes'].some(k => request[k]?.length), 'Empty changes scope')
    for (const doc of request.creates || []) {
      invariant(['client','project'].includes(doc._type), 'Only explicit minimal client/project creations supported outside manifest')
      validateDocument(doc, { creation: true })
      const current = await fresh(sanity, [doc._id]); noDraft(current, doc._id); invariant(!current.has(doc._id), `Strict create conflict: ${doc._id}`)
      const { _id, _type, ...set } = doc
      operations.push({ id: _id, action: 'create', type: _type, before: null, after: clean(doc), set, unset: [], upload: false, diff: diffOf(null, doc, set, []) })
      if (_type === 'project' && doc.orderRank !== undefined) await addCollection(collections, sanity, { projectOrder: true })
    }
    for (const p of request.patches || []) {
      keys(p, ['id','type','set','unset','upload'], 'patch'); invariant(validId(p.id), 'Patch requires published stable ID')
      validatePatch(p.type, p.set || {}, p.unset || [])
      const current = await fresh(sanity, [p.id]); noDraft(current, p.id)
      const before = current.get(p.id); invariant(before && before._type === p.type, `Patch target/type not found: ${p.id}`)
      const after = patched(before, p.set || {}, p.unset || []); validateDocument(after)
      let source
      if (p.upload) { keys(p.upload, ['file'], 'upload'); invariant(p.type === 'mediaAsset', 'Uploads only attach to mediaAsset'); source = await inspectFile(scope.root, p.upload.file, after.mediaType, probe) }
      invariant(!Object.hasOwn(p.set || {}, 'mediaType') || isVideoType(before.mediaType) === isVideoType(after.mediaType), 'Image/video kind conversion requires editorial migration, not an ordinary patch')
      if (Object.hasOwn(p.set || {}, 'video')) {
        invariant(!p.upload && isVideoType(after.mediaType), 'A video rebind needs a video mediaType and no upload')
        const id = after.video.asset._ref, target = await fresh(sanity, [id]); noDraft(target, id); readyMuxDocument(target.get(id))
      }
      if (p.type === 'globeSettings') {
        // The globe renders video only (src/schemas/globeSettings.ts): a newly added pick must be a video asset.
        const added = [...new Set((after.picks || []).map(r => r._ref).filter(id => !(before.picks || []).some(r => r._ref === id)))]
        const targets = await fresh(sanity, added)
        for (const id of added) { noDraft(targets, id); const t = targets.get(id); invariant(t?._type === 'mediaAsset' && isVideoType(t.mediaType) && t.video?.asset?._ref, `Globe pick ${id} must be a published video mediaAsset`) }
      }
      const action = same(withoutSystem(before), withoutSystem(after)) && !source ? 'unchanged' : 'patch'
      operations.push(clean({ id: p.id, action, type: p.type, before, after, set: p.set || {}, unset: p.unset || [], source, upload: !!source, diff: diffOf(before, after, p.set || {}, p.unset || []) }))
      if (p.type === 'mediaAsset') { await addCollection(collections, sanity, mediaGrouping(before)); await addCollection(collections, sanity, mediaGrouping(after)); if (before.project?._ref) await addCollection(collections, sanity, { projectId: before.project._ref }); if (after.project?._ref && after.project._ref !== before.project?._ref) await addCollection(collections, sanity, { projectId: after.project._ref }) }
      if (p.type === 'project' && (Object.hasOwn(p.set || {}, 'orderRank') || (p.unset || []).includes('orderRank'))) await addCollection(collections, sanity, { projectOrder: true })
    }
    for (const id of request.inspect || []) { invariant(validId(id), 'Invalid inspect ID'); const current = await fresh(sanity, [id]); noDraft(current, id); const doc = current.get(id); invariant(doc, `Inspect document not found: ${id}`); validateDocument(doc); operations.push({ id, action: 'unchanged', type: doc._type, before: doc, after: doc, set: {}, unset: [], upload: false, diff: [] }) }
    await planDeletes(request.deletes || [], operations, collections, informational, sanity, mux)
  }
  invariant(new Set(operations.map(o => o.id)).size === operations.length, 'Duplicate operation identity')
  invariant(operations.length <= 100, 'Scope exceeds 100 documents; split into separately reviewed scopes')
  const guards = await resolveReferences(operations, sanity)
  const plan = { version: VERSION, createdAt: new Date().toISOString(), checkout, target, schemaHash: await schemaHash(checkout), publication: PUBLICATION, noEditWindow: NO_EDIT_WINDOW, scope, operations, guards, collections: collections.map(({ selector, snapshot }) => ({ selector, snapshot })), informational }
  plan.id = digest(plan)
  validatePlan(plan)
  return plan
}

export function validatePlan(plan) {
  keys(plan, ['version','createdAt','checkout','target','schemaHash','publication','noEditWindow','scope','operations','guards','collections','informational','id'], 'plan')
  const { id, ...body } = plan
  invariant(plan.version === VERSION && digest(body) === id, 'Invalid plan version/hash; preview and approve a fresh saved plan')
  targetOf(plan.target)
  invariant(plan.publication === PUBLICATION && plan.noEditWindow === NO_EDIT_WINDOW, 'Invalid publication/locking policy')
  invariant(typeof plan.checkout === 'string' && path.isAbsolute(plan.checkout), 'Invalid checkout')
  invariant(plan.schemaHash === SUPPORTED_SCHEMA_HASH, 'Unsupported schema fingerprint')
  keys(plan.scope, ['kind','path','root','sha256','original'], 'scope')
  invariant(['manifest','changes'].includes(plan.scope.kind) && path.isAbsolute(plan.scope.path) && path.dirname(plan.scope.path) === plan.scope.root && digest(plan.scope.original) === plan.scope.sha256, 'Invalid source scope')
  invariant(Array.isArray(plan.operations) && plan.operations.length > 0 && plan.operations.length <= 100, 'Invalid operations')
  invariant(new Set(plan.operations.map(o => o.id)).size === plan.operations.length, 'Duplicate operation IDs')
  for (const [index, op] of plan.operations.entries()) {
    keys(op, ['id','action','type','before','after','set','unset','source','upload','rowFile','diff','mux'], 'operation')
    invariant(validId(op.id) && ['create','patch','unchanged','delete'].includes(op.action) && typeof op.upload === 'boolean', 'Invalid operation identity/action')
    if (op.action === 'delete') {
      invariant(plan.scope.kind === 'changes' && DELETE_TYPES.includes(op.type), 'Deletes need an explicit changes request')
      invariant(op.after === null && same(op.set, {}) && same(op.unset, []) && !op.upload && op.source === undefined && op.rowFile === undefined && same(op.diff, []), 'A delete carries no fields, upload or diff')
      invariant(plan.operations.slice(index).every(o => o.action === 'delete'), 'Deletes run after every other operation')
      if (op.type === 'mux.asset') { invariant(op.mux === undefined, 'Invalid Mux asset delete'); validMuxSnapshot(op.before, op.id); continue }
      invariant(op.before?._id === op.id && op.before._type === op.type && typeof op.before._rev === 'string', 'Invalid delete before/revision')
      if (op.mux !== undefined) { invariant(op.type === 'mux.videoAsset', 'Only a Mux document delete can take its Mux asset'); validMuxSnapshot(op.mux, op.before.assetId) }
      continue
    }
    invariant(op.mux === undefined, 'Only a delete can remove a Mux asset')
    validatePatch(op.type, op.set, op.unset)
    invariant(op.after._id === op.id && op.after._type === op.type, 'Operation/after mismatch')
    if (op.action === 'create') {
      invariant(op.before === null && op.unset.length === 0, 'Invalid create before/unset')
      validateDocument(op.after, { creation: true })
      const expected = { _id: op.id, _type: op.type, ...op.set }
      if (op.type === 'mediaAsset') { invariant(plan.scope.kind === 'manifest' && op.upload && !op.after.image && !op.after.video, 'Media creates require manifest upload'); expected.sourceFolder = op.after.sourceFolder; expected.sourceManifest = op.after.sourceManifest; invariant(typeof expected.sourceFolder === 'string' && typeof expected.sourceManifest === 'string', 'Invalid grouping') }
      invariant(same(expected, op.after), 'Create fields differ from approved set')
    } else {
      invariant(op.before?._id === op.id && op.before?._type === op.type && typeof op.before._rev === 'string', 'Invalid before/revision')
      invariant(same(patched(op.before, op.set, op.unset), op.after), 'After differs from explicit patch')
      if (op.action === 'unchanged') invariant(!op.upload && same(op.before, op.after), 'Unchanged operation has writes')
      validateDocument(op.after)
    }
    if (op.source) {
      keys(op.source, ['root','relative','path','sha256','size','kind','dimensions'], 'source')
      invariant(op.source.root === plan.scope.root && path.resolve(op.source.root, op.source.relative) === op.source.path && !path.isAbsolute(op.source.relative) && !op.source.relative.split('/').includes('..'), 'Source path escape')
      invariant(/^[a-f0-9]{64}$/.test(op.source.sha256) && Number.isSafeInteger(op.source.size) && op.source.size > 0 && ['image','video'].includes(op.source.kind), 'Invalid source hash/size/kind')
      invariant((op.source.kind === 'video') === isVideoType(op.action === 'unchanged' ? parseManifest(plan.scope.original).assets.find(r => r.file === op.rowFile)?.mediatype : op.after.mediaType), 'Source kind mismatch')
      keys(op.source.dimensions, ['width','height','aspectRatio','duration'], 'dimensions')
      invariant(op.source.dimensions.width > 0 && op.source.dimensions.height > 0, 'Invalid dimensions')
    }
    const diffSet = op.action === 'create' && op.type === 'mediaAsset' ? { ...op.set, sourceFolder: op.after.sourceFolder, sourceManifest: op.after.sourceManifest } : op.set
    invariant(same(op.diff, diffOf(op.before, op.after, diffSet, op.unset)), 'Displayed diff differs from approved mutations')
    invariant(!op.upload || op.source, 'Upload missing source')
    if (plan.scope.kind === 'manifest') invariant(typeof op.rowFile === 'string' && op.rowFile === op.source?.relative, 'Manifest row/source mismatch')
  }
  invariant(Array.isArray(plan.guards) && Array.isArray(plan.collections) && Array.isArray(plan.informational), 'Invalid guards/collections')
  for (const g of plan.guards) { keys(g, ['id','rev','type'], 'reference guard'); invariant(validId(g.id) && typeof g.rev === 'string' && ['client','project','serviceTag','mux.videoAsset','mediaAsset'].includes(g.type), 'Invalid reference guard') }
  const created = new Map(plan.operations.filter(o => o.action === 'create').map(o => [o.id,o.type]))
  for (const r of plan.operations.flatMap(opReferences)) invariant(created.get(r.id) === r.type || plan.guards.some(g => g.id === r.id && g.type === r.type), `Missing reference guard ${r.id}`)
  const deletedIds = plan.operations.filter(o => o.action === 'delete').map(o => o.id)
  for (const id of deletedIds) invariant(!plan.guards.some(g => g.id === id) && !plan.operations.some(o => o.after && refersTo(o.after, id)), `Plan both keeps and deletes ${id}`)
  for (const c of plan.collections) {
    keys(c, ['selector','snapshot'], 'collection'); keys(c.selector, ['clientId','sourceManifest','projectId','projectOrder'], 'collection selector')
    invariant(c.selector.projectOrder === true || validId(c.selector.projectId) || validId(c.selector.clientId) && typeof c.selector.sourceManifest === 'string' && c.selector.sourceManifest.length, 'Unscoped collection selector')
    invariant(Array.isArray(c.snapshot), 'Invalid ordering snapshot')
    for (const item of c.snapshot) { keys(item, ['id','rank','project','sourceFolder','sourceManifest'], 'snapshot'); invariant(validId(item.id), 'Invalid snapshot ID') }
    invariant(new Set(c.snapshot.map(s => s.id)).size === c.snapshot.length, 'Duplicate ordering snapshot ID')
  }
  const requireCollection = selector => invariant(plan.collections.some(c => same(c.selector, selector)), `Missing required ordering snapshot ${JSON.stringify(selector)}`)
  for (const op of plan.operations) {
    if (op.type === 'mediaAsset' && (plan.scope.kind === 'manifest' || op.action !== 'unchanged')) {
      for (const doc of [op.after, op.before].filter(Boolean)) { requireCollection(mediaGrouping(doc)); if (doc.project?._ref) requireCollection({ projectId: doc.project._ref }) }
    }
    if (op.type === 'project' && (Object.hasOwn(op.set, 'orderRank') || op.unset.includes('orderRank'))) requireCollection({ projectOrder: true })
  }
  for (const collection of plan.collections) {
    const relevant = plan.operations.filter(op => op.action !== 'unchanged' && [op.after, op.before].some(doc => doc && inCollection(doc, collection.selector)))
    const changesOrder = relevant.some(op => op.action === 'create' || Object.hasOwn(op.set, 'orderRank') || op.unset.includes('orderRank') || op.type === 'mediaAsset' && (Object.hasOwn(op.set, 'client') || Object.hasOwn(op.set, 'project') || op.unset.includes('project')))
    if (!changesOrder) continue
    const projected = new Map(collection.snapshot.map(item => [item.id, item]))
    for (const op of relevant) { projected.delete(op.id); if (op.after && inCollection(op.after, collection.selector)) projected.set(op.id, collectionSnapshot([op.after])[0]) }
    appendRanks([...projected.values()].map(item => ({ _id: item.id, orderRank: item.rank })), 0)
  }
  return plan
}

// Keyed arrays (globe picks, services) print per item, so a one-pick swap reads as one line.
function diffLines(d) {
  const keyed = v => Array.isArray(v) && v.every(x => typeof x?._key === 'string')
  if (!keyed(d.before) || !keyed(d.after)) return [`  ${d.field}: ${JSON.stringify(d.before)} -> ${JSON.stringify(d.after)}`]
  const old = new Map(d.before.map((x, i) => [x._key, [i, x]])), next = new Map(d.after.map((x, i) => [x._key, [i, x]])), lines = []
  for (const [k, [i, x]] of next) { const prev = old.get(k); if (!prev) lines.push(`  ${d.field}[${k}] added at #${i + 1}: ${JSON.stringify(x)}`); else if (prev[0] !== i || !same(prev[1], x)) lines.push(`  ${d.field}[${k}] #${prev[0] + 1} -> #${i + 1}: ${JSON.stringify(prev[1])} -> ${JSON.stringify(x)}`) }
  for (const [k, [i, x]] of old) if (!next.has(k)) lines.push(`  ${d.field}[${k}] removed from #${i + 1}: ${JSON.stringify(x)}`)
  return lines.length ? lines : [`  ${d.field}: unchanged`]
}
function deleteSummary(op) {
  const b = op.before, created = Number.isFinite(+b.created_at) ? `, created ${new Date(+b.created_at * 1000).toISOString().slice(0,10)}` : ''
  if (op.type === 'mediaAsset') return `${JSON.stringify(b.title)} ${b.mediaType}${b.project?._ref ? ` in ${b.project._ref}` : ''}`
  if (op.type === 'mux.videoAsset') return `${b.filename ? `${JSON.stringify(b.filename)}, ` : ''}asset ${b.assetId}, ${b.status}${op.mux ? `\n  + Mux asset ${op.mux.id} (${op.mux.status}), deleted permanently` : '\n  Mux asset kept'}`
  if (op.type === 'sanity.imageAsset') return `${b.originalFilename ? `${JSON.stringify(b.originalFilename)} ` : ''}${b.metadata?.dimensions?.width}x${b.metadata?.dimensions?.height}, ${b.size} bytes; file removed`
  return `Mux asset ${b.status}${created}; no Sanity document; deleted permanently`
}
export function preview(plan) {
  validatePlan(plan)
  const counts = { create: 0, patch: 0, unchanged: 0, delete: 0, uploads: 0 }, muxDeletes = plan.operations.filter(op => op.type === 'mux.asset' || op.mux).length
  for (const op of plan.operations) { counts[op.action]++; if (op.upload) counts.uploads++ }
  return [`Target ${plan.target.projectId}/${plan.target.dataset}`, `Plan ${plan.id}`, `Scope ${plan.scope.path}`, `${counts.create} creates; ${counts.patch} patches; ${counts.unchanged} unchanged; ${counts.delete} deletes (${muxDeletes} Mux assets); ${counts.uploads} uploads`, plan.publication, plan.noEditWindow,
    ...(counts.delete ? [IRREVERSIBLE] : []),
    ...plan.operations.map(op => op.action === 'delete' ? `DELETE ${op.type} ${op.id}: ${deleteSummary(op)}` : `${op.action.toUpperCase()} ${op.type} ${op.id}${op.upload ? ` [${op.source.kind} upload ${op.source.relative}, sha256 ${op.source.sha256}]` : ''}\n${op.diff.flatMap(diffLines).join('\n')}`),
    ...plan.informational.map(note => `INFO ${note}`), 'No mutation/upload has occurred. Approval must name this saved plan ID and target.'].join('\n')
}

async function sourceGuards(plan, journal) {
  invariant(await realpath(plan.checkout) === plan.checkout && await schemaHash(plan.checkout) === plan.schemaHash, 'Checkout/schema drift; generate a refreshed plan')
  invariant(await realpath(plan.scope.path) === plan.scope.path && await realpath(plan.scope.root) === plan.scope.root, 'Scope path changed')
  const original = await readFile(plan.scope.path, 'utf8'), hash = digest(original)
  if (plan.scope.kind === 'manifest') {
    const bindings = Object.fromEntries(plan.operations.filter(op => journal.operations[op.id]?.stage === 'done' || op.action === 'unchanged').map(op => [op.rowFile, op.id]))
    invariant(hash === (journal.manifestHash || plan.scope.sha256) || original === boundManifest(plan.scope.original, bindings), 'Manifest hash changed; refresh plan')
  } else invariant(hash === plan.scope.sha256, 'Changes request hash changed; refresh plan')
  for (const op of plan.operations) if (op.source) { invariant(await scopedFile(op.source.root, op.source.relative) === op.source.path, 'Source path changed'); invariant(await fileHash(op.source.path) === op.source.sha256, `Source hash changed: ${op.source.relative}`) }
}
function inCollection(doc, selector) {
  if (selector.projectOrder) return doc._type === 'project'
  if (selector.projectId) return doc._type === 'mediaAsset' && doc.project?._ref === selector.projectId
  return doc._type === 'mediaAsset' && doc.client?._ref === selector.clientId && doc.sourceManifest === selector.sourceManifest
}
async function remoteGuards(plan, journal, sanity) {
  invariant(same(sanity.target, plan.target), 'Adapter target mismatch')
  // A Mux-only delete has no Sanity document; its Mux checks run once, at its own write.
  const documentOps = plan.operations.filter(o => o.type !== 'mux.asset')
  const current = await fresh(sanity, [...documentOps.map(o => o.id), ...plan.guards.map(g => g.id)])
  for (const op of documentOps) {
    noDraft(current, op.id)
    const state = journal.operations[op.id], actual = current.get(op.id)
    if (op.action === 'delete') { if (removed(op, state)) invariant(!actual, `Deleted document reappeared: ${op.id}`); else invariant(actual?._rev === op.before._rev, `Stale revision: ${op.id}`); continue }
    if (state?.stage === 'done') invariant(same(withoutSystem(actual), withoutSystem(state.expected || op.after)), `Completed document changed: ${op.id}`)
    else if (op.action === 'create') invariant(!actual, `Strict create conflict: ${op.id}`)
    else invariant(actual?._rev === op.before._rev, `Stale revision: ${op.id}`)
  }
  for (const g of plan.guards) {
    noDraft(current, g.id)
    const op = plan.operations.find(o => o.id === g.id), done = journal.operations[g.id]?.stage === 'done'
    if (!done) invariant(current.get(g.id)?._rev === g.rev && current.get(g.id)?._type === g.type, `Reference revision conflict: ${g.id}`)
    else invariant(op && current.get(g.id)?._type === g.type, `Reference changed: ${g.id}`)
  }
  for (const op of plan.operations) if (op.after?._type === 'mediaAsset' && op.after.project?._ref) {
    const plannedProject = plan.operations.find(p => p.id === op.after.project._ref)?.after
    const project = plannedProject || current.get(op.after.project._ref)
    invariant(project?.client?._ref === op.after.client?._ref, `Project/client mismatch on ${op.id}`)
  }
  for (const c of plan.collections) {
    const expected = new Map(c.snapshot.map(s => [s.id, s]))
    for (const op of plan.operations) if (journal.operations[op.id]?.stage === 'done' || removed(op, journal.operations[op.id])) {
      expected.delete(op.id)
      const doc = journal.operations[op.id].expected || op.after
      if (doc && inCollection(doc, c.selector)) expected.set(op.id, collectionSnapshot([doc])[0])
    }
    const actual = await captureCollection(sanity, c.selector)
    invariant(same(actual.snapshot, [...expected.values()].sort((a,b) => a.id.localeCompare(b.id))), 'Ordering/member snapshot changed; refresh plan, never reseed ranks')
  }
}
function journalCheck(plan, journal) {
  keys(journal, ['version','planId','target','operations','manifestHash','startedAt','finishedAt'], 'journal')
  invariant(journal.version === VERSION && journal.planId === plan.id && same(journal.target, plan.target), 'Journal target/identity mismatch')
  keys(journal.operations, plan.operations.map(o => o.id), 'journal operations')
  for (const op of plan.operations) {
    const s = journal.operations[op.id]; if (!s) continue
    keys(s, ['stage','uploadId','assetId','expected','muxDocument','transactionId','imageAssetId','operationId','failure'], 'journal operation')
    const stages = op.action === 'delete' ? (op.type === 'mux.asset' ? ['new','mux-deleting','done'] : op.mux ? ['new','committing','deleted','mux-deleting','done'] : ['new','committing','done'])
      : !op.upload ? ['new','committing','done'] : op.source.kind === 'image' ? ['new','image-uploading','ready','committing','done'] : ['new','creating-upload','created-upload','sending','uploaded','pending','ready','committing','done']
    invariant(stages.includes(s.stage), 'Invalid journal stage for operation')
    if (op.action === 'delete') { invariant(!s.expected && !s.uploadId && !s.assetId && !s.imageAssetId && !s.muxDocument && !s.operationId, 'Journal delete carries media state'); continue }
    invariant(!s.operationId || s.operationId === `${plan.id}:${op.id}`, 'Journal operation identity mismatch')
    if (op.upload && s.stage !== 'new') invariant(s.operationId === `${plan.id}:${op.id}`, 'Missing journal operation identity')
    if (op.upload && op.source.kind === 'video' && !['new','creating-upload'].includes(s.stage)) invariant(typeof s.uploadId === 'string' && /^[a-zA-Z0-9_-]+$/.test(s.uploadId), 'Missing/invalid journal upload ID')
    if (['ready','committing','done'].includes(s.stage)) {
      invariant(s.expected, 'Journal stage requires expected document')
      if (op.upload && op.source.kind === 'image') invariant(typeof s.imageAssetId === 'string' && /^image-[a-zA-Z0-9_-]+$/.test(s.imageAssetId), 'Missing journal image asset ID')
      if (op.upload && op.source.kind === 'video') {
        invariant(typeof s.assetId === 'string' && /^[a-zA-Z0-9_-]+$/.test(s.assetId) && s.muxDocument, 'Missing journal Mux asset/document')
        keys(s.muxDocument, ['_id','_type','assetId','playbackId','status','filename','data'], 'Mux journal document')
        keys(s.muxDocument.data, ['id','status','aspect_ratio','playback_ids','duration'], 'Mux journal data')
        invariant(Array.isArray(s.muxDocument.data.playback_ids), 'Invalid journal playback IDs')
        for (const playback of s.muxDocument.data.playback_ids) keys(playback, ['id','policy'], 'Mux playback')
        invariant(s.muxDocument._type === 'mux.videoAsset' && s.muxDocument.status === 'ready' && readyMux(s.muxDocument.data) && s.muxDocument.data.id === s.assetId && s.muxDocument.data.playback_ids.some(p => p.policy === 'public' && p.id === s.muxDocument.playbackId) && s.muxDocument.filename === path.basename(op.source.relative), 'Invalid journal Mux readiness/playback')
        const ratio = s.muxDocument.data.aspect_ratio.split(':').map(Number), expectedRatio = op.source.dimensions.width / op.source.dimensions.height
        invariant(Math.abs(ratio[0]/ratio[1] - expectedRatio)/expectedRatio <= 0.025, 'Journal Mux aspect differs from source')
      }
    }
    if (s.expected) {
      const { image, video, ...expected } = s.expected, { image: oldImage, video: oldVideo, ...after } = op.after
      invariant(same(expected, after), 'Journal expected document differs from plan')
      if (!op.upload) invariant(same(s.expected, op.after), 'Journal unexpected media write')
      else if (op.source.kind === 'image') invariant(same(video, oldVideo) && same(image, { _type: 'image', asset: ref(s.imageAssetId) }) && /^image-/.test(s.imageAssetId), 'Journal image identity mismatch')
      else invariant(same(image, oldImage) && same(video, { _type: 'mux.video', asset: { ...ref(`muxAsset-${s.assetId}`), _weak: true } }) && s.muxDocument?._id === `muxAsset-${s.assetId}` && s.muxDocument?.assetId === s.assetId, 'Journal Mux identity mismatch')
    }
  }
}
function readyMux(asset) { return asset?.status === 'ready' && typeof asset.id === 'string' && asset.playback_ids?.some(p => p.policy === 'public' && typeof p.id === 'string' && p.id) && /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(asset.aspect_ratio || '') && asset.aspect_ratio.split(':').every(n => +n > 0) }
async function uploadMedia(plan, op, state, journal, store, adapters, options) {
  const save = () => store.saveJournal(plan.id, journal), source = op.source
  state.operationId = `${plan.id}:${op.id}`
  if (source.kind === 'image') {
    invariant(state.stage !== 'image-uploading', 'Image upload outcome uncertain; reconcile uploaded asset manually before retry (no automatic duplicate)')
    if (state.stage !== 'ready') {
      state.stage = 'image-uploading'; await save()
      const asset = await adapters.sanity.uploadImage({ path: source.path, operationId: state.operationId })
      invariant(/^image-/.test(asset._id) && asset.metadata?.dimensions?.width > 0 && asset.metadata?.dimensions?.height > 0, 'Uploaded image missing dimensions')
      invariant(asset.metadata.dimensions.width === source.dimensions.width && asset.metadata.dimensions.height === source.dimensions.height, 'Uploaded image dimensions differ from approved source')
      state.imageAssetId = asset._id; state.expected = { ...op.after, image: { _type: 'image', asset: ref(asset._id) } }; state.stage = 'ready'; await save()
    }
    return true
  }
  const mux = adapters.mux
  invariant(mux, 'Mux adapter unavailable')
  if (state.stage === 'creating-upload') {
    const recovered = await mux.findUpload(state.operationId)
    invariant(recovered?.id, 'Mux creation outcome uncertain; no reconciled upload. Stop for review, never blindly duplicate.')
    state.uploadId = recovered.id; state.stage = 'created-upload'; await save()
  }
  if (state.stage === 'new') {
    state.stage = 'creating-upload'; await save()
    const created = await mux.createUpload({ operationId: state.operationId })
    invariant(created?.id, 'Mux upload creation returned no ID')
    state.uploadId = created.id; state.stage = 'created-upload'; await save()
    await options.onStage?.('created-upload', op)
  }
  if (state.stage === 'ready') return true
  let upload = await mux.getUpload(state.uploadId)
  if (upload.asset_id) { state.assetId = upload.asset_id; state.stage = 'uploaded'; await save() }
  else if (['created-upload','sending'].includes(state.stage)) {
    invariant(upload.status === 'waiting' && upload.url, 'Known Mux upload cannot be resumed; review rather than replacing')
    state.stage = 'sending'; await save()
    await mux.putUpload({ url: upload.url, path: source.path, size: source.size })
    state.stage = 'uploaded'; await save()
    await options.onStage?.('uploaded', op)
  }
  for (let attempt = 0; attempt < (options.pollAttempts ?? 20); attempt++) {
    if (!state.assetId) { upload = await mux.getUpload(state.uploadId); invariant(!['errored','cancelled','timed_out'].includes(upload.status), `Mux upload ${upload.status}; retained for review`); if (upload.asset_id) { state.assetId = upload.asset_id; await save() } }
    if (state.assetId) {
      const asset = await mux.getAsset(state.assetId)
      invariant(asset.status !== 'errored', 'Mux asset errored; retained for review')
      if (readyMux(asset)) {
        invariant(asset.id === state.assetId, 'Mux asset identity mismatch')
        const ratio = asset.aspect_ratio.split(':').map(Number), expectedRatio = source.dimensions.width/source.dimensions.height
        invariant(Math.abs(ratio[0]/ratio[1] - expectedRatio)/expectedRatio <= 0.025, 'Mux final aspect differs from approved source')
        const playbackId = asset.playback_ids.find(p => p.policy === 'public').id, muxId = `muxAsset-${asset.id}`
        state.muxDocument = { _id: muxId, _type: 'mux.videoAsset', assetId: asset.id, playbackId, status: 'ready', filename: path.basename(source.relative), data: { id: asset.id, status: 'ready', aspect_ratio: asset.aspect_ratio, playback_ids: asset.playback_ids.map(p => ({ id: p.id, policy: p.policy })), ...(Number.isFinite(asset.duration) ? { duration: asset.duration } : {}) } }
        state.expected = { ...op.after, video: { _type: 'mux.video', asset: { ...ref(muxId), _weak: true } } }; state.stage = 'ready'; await save(); return true
      }
    }
    if (attempt + 1 < (options.pollAttempts ?? 20)) await (options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms))))(options.pollInterval ?? 3000)
  }
  state.stage = 'pending'; await save(); return false
}
async function readyMediaGuard(op, state, sanity, mux) {
  if (!op.upload) { if (Object.hasOwn(op.set, 'video')) await readyVideo(sanity, mux, op.after.video.asset._ref); return }
  invariant(state.expected, 'Upload must have a verified expected document')
  if (op.source.kind === 'video') {
    const asset = await mux.getAsset(state.assetId)
    invariant(readyMux(asset) && asset.id === state.assetId && asset.aspect_ratio === state.muxDocument?.data?.aspect_ratio && asset.playback_ids.some(p => p.policy === 'public' && p.id === state.muxDocument.playbackId), 'Cached Mux asset no longer ready with approved playback/aspect; previous media retained')
  } else {
    const docs = await fresh(sanity, [state.imageAssetId]); noDraft(docs, state.imageAssetId)
    const image = docs.get(state.imageAssetId)
    invariant(image?._type === 'sanity.imageAsset' && image.metadata?.dimensions?.width === op.source.dimensions.width && image.metadata?.dimensions?.height === op.source.dimensions.height, 'Cached image asset/dimensions changed; previous media retained')
  }
}
async function reconcileCommits(plan, journal, sanity, store) {
  for (const op of plan.operations) {
    const state = journal.operations[op.id]; if (state?.stage !== 'committing') continue
    if (op.action === 'delete') {
      const docs = await fresh(sanity, [op.id]); noDraft(docs, op.id)
      if (!docs.has(op.id)) state.stage = op.mux ? 'deleted' : 'done'
      else if (docs.get(op.id)._rev === op.before._rev) state.stage = 'new'
      else throw new Error(`Uncertain delete conflict: ${op.id}; manual review required`)
      await store.saveJournal(plan.id, journal); continue
    }
    const docs = await fresh(sanity, [op.id, ...(state.muxDocument ? [state.muxDocument._id] : [])]); noDraft(docs, op.id)
    if (same(withoutSystem(docs.get(op.id)), withoutSystem(state.expected))) {
      if (state.muxDocument) invariant(same(withoutSystem(docs.get(state.muxDocument._id)), state.muxDocument), 'Partial Mux/Sanity transaction detected; review')
      state.stage = 'done'; await store.saveJournal(plan.id, journal)
    } else if (op.action === 'create' ? !docs.has(op.id) : docs.get(op.id)?._rev === op.before._rev) { state.stage = op.upload ? 'ready' : 'new'; await store.saveJournal(plan.id, journal) }
    else throw new Error(`Uncertain commit conflict: ${op.id}; manual review required`)
  }
}
// Sanity half first (live blocker check, then revision-guarded delete), then the Mux half,
// which runs only once no document describes the asset. A Mux 404 on resume means already gone.
async function applyDelete(plan, op, state, journal, store, sanity, mux, options) {
  const save = () => store.saveJournal(plan.id, journal)
  if (op.type !== 'mux.asset' && state.stage === 'new') {
    const blockers = await sanity.findDeleteBlockers(op.id)
    invariant(!blockers.length, `Delete of ${op.id} blocked: ${blockers.map(b => b._id).join(', ')} now reference it`)
    state.stage = 'committing'; await save()
    const result = await sanity.commit([{ patch: { id: op.id, ifRevisionID: op.before._rev, unset: [DELETE_GUARD_FIELD] } }, { delete: { id: op.id } }])
    await options.onStage?.('committed', op)
    state.transactionId = result?.transactionId || null; state.stage = op.mux ? 'deleted' : 'done'; await save()
  }
  const assetId = op.type === 'mux.asset' ? op.id : op.mux?.id
  if (!assetId || state.stage === 'done') return
  invariant(mux, 'Mux adapter unavailable')
  if (state.stage !== 'mux-deleting') {
    const docs = await sanity.findMuxDocuments(assetId)
    invariant(!docs.length, `Mux asset ${assetId} is described by ${docs.map(d => d._id).join(', ')}; stopped before deleting it`)
    state.stage = 'mux-deleting'; await save()
  }
  await mux.deleteAsset(assetId)
  state.stage = 'done'; await save()
}
export async function applyPlan({ plan, confirm, checkout, store, sanity, mux, ...options }) {
  validatePlan(plan); invariant(confirm === plan.id, 'Exact saved-plan confirmation required')
  invariant(await realpath(checkout) === plan.checkout, 'Plan belongs to another checkout')
  invariant(same(await store.readPlan(plan.id), plan), 'Apply must consume the exact locally saved plan')
  return checkoutLocked(checkout, () => store.locked(plan.id, async () => {
    const journal = await store.journal(plan.id) || { version: VERSION, planId: plan.id, target: plan.target, startedAt: new Date().toISOString(), operations: {} }
    journalCheck(plan, journal)
    invariant(same(sanity.target, plan.target), 'Adapter target mismatch')
    await sourceGuards(plan, journal)
    await reconcileCommits(plan, journal, sanity, store)
    await remoteGuards(plan, journal, sanity)
    await store.saveJournal(plan.id, journal)
    for (const op of plan.operations) {
      const state = journal.operations[op.id] ||= { stage: 'new' }
      if (state.stage === 'done') continue
      if (op.action === 'unchanged') { state.stage = 'done'; state.expected = op.after; await store.saveJournal(plan.id, journal); continue }
      delete state.failure
      try {
        await sourceGuards(plan, journal); await remoteGuards(plan, journal, sanity)
        if (op.action === 'delete') { await applyDelete(plan, op, state, journal, store, sanity, mux, options); await options.onStage?.('done', op); continue }
        if (op.upload && !await uploadMedia(plan, op, state, journal, store, { sanity, mux }, options)) continue
        state.expected ||= op.after
        // Uploads may take minutes: repeat source, references, drafts, revisions and membership before committing.
        await sourceGuards(plan, journal); await remoteGuards(plan, journal, sanity)
        journalCheck(plan, journal)
        await readyMediaGuard(op, state, sanity, mux)
        const mutations = []
        if (state.muxDocument) { const docs = await fresh(sanity, [state.muxDocument._id]); noDraft(docs, state.muxDocument._id); invariant(!docs.has(state.muxDocument._id), 'Mux document collision; review'); mutations.push({ create: state.muxDocument }) }
        if (op.action === 'create') mutations.push({ create: state.expected })
        else { const set = { ...op.set }; if (op.upload) set[op.source.kind === 'image' ? 'image' : 'video'] = state.expected[op.source.kind === 'image' ? 'image' : 'video']; const patch = { id: op.id, ifRevisionID: op.before._rev }; if (Object.keys(set).length) patch.set = set; if (op.unset.length) patch.unset = op.unset; mutations.push({ patch }) }
        state.stage = 'committing'; await store.saveJournal(plan.id, journal)
        const result = await sanity.commit(mutations)
        await options.onStage?.('committed', op)
        state.transactionId = result?.transactionId || null; state.stage = 'done'; await store.saveJournal(plan.id, journal)
        await writeBindings(plan, journal); await store.saveJournal(plan.id, journal)
        await options.onStage?.('done', op)
      } catch (error) {
        // Never persist provider errors: they can embed signed URLs or credentials.
        state.failure = 'Operation stopped; inspect stage and provider IDs. No cleanup or rollback performed.'
        await store.saveJournal(plan.id, journal)
        const stopped = new Error(`CMS operation ${op.id} stopped at ${state.stage}. ${error.message?.includes('https://') ? 'Provider failure (details suppressed to avoid URL disclosure).' : error.message}`)
        try { stopped.report = await verifyRun({ plan, journal, sanity, mux }) } catch { /* Malformed state is reported by the original guard, never repaired silently. */ }
        throw stopped
      }
    }
    await writeBindings(plan, journal); await store.saveJournal(plan.id, journal)
    const report = await verifyRun({ plan, journal, sanity, mux })
    if (!report.pending && !report.failed) { journal.finishedAt = new Date().toISOString(); await store.saveJournal(plan.id, journal) }
    return report
  }))
}
export async function verifyRun({ plan, journal, sanity, mux }) {
  validatePlan(plan); invariant(same(sanity.target, plan.target), 'Adapter target mismatch'); invariant(journal, 'No run journal; apply has not started'); journalCheck(plan, journal)
  const report = { run: plan.id, target: plan.target, created: 0, updated: 0, unchanged: 0, deleted: 0, pending: 0, failed: 0, issues: [], unattached: [], routes: ['/work','/work/directory'], publication: PUBLICATION, resume: `node scripts/cms.mjs apply --plan <saved-plan-path> --confirm ${plan.id}` }
  const docs = await fresh(sanity, plan.operations.filter(o => o.type !== 'mux.asset').map(o => o.id))
  for (const op of plan.operations) {
    const state = journal.operations[op.id], actual = docs.get(op.id)
    if (state?.stage !== 'done') { if (state?.failure) report.failed++; else report.pending++; if (state?.uploadId || state?.imageAssetId) report.unattached.push({ id: op.id, stage: state.stage, uploadId: state.uploadId || null, assetId: state.assetId || state.imageAssetId || null }); continue }
    try {
      if (op.action === 'delete') {
        if (op.type !== 'mux.asset') invariant(!actual && !docs.has(`drafts.${op.id}`), `Deleted document still present: ${op.id}`)
        const assetId = op.type === 'mux.asset' ? op.id : op.mux?.id
        if (assetId) invariant(await mux.findAsset(assetId) === null, `Mux asset still present: ${assetId}`)
        if (op.type === 'mediaAsset' && op.before.project?._ref) { const project = (await sanity.getDocuments([op.before.project._ref])).find(d => d._id === op.before.project._ref); if (project?.slug?.current) report.routes.push(`/work/${project.slug.current}`) }
        report.deleted++; continue
      }
      noDraft(docs, op.id)
      invariant(same(withoutSystem(actual), withoutSystem(state.expected || op.after)), `Verification mismatch: ${op.id}`)
      const rr = references(actual), targets = await fresh(sanity, rr.map(r => r.id))
      for (const r of rr) { noDraft(targets, r.id); invariant(targets.get(r.id)?._type === r.type, `Missing reference ${r.id}`) }
      if (actual._type === 'mediaAsset') {
        if (isVideoType(actual.mediaType)) {
          invariant(actual.video?.asset?._ref, 'Missing video reference')
          await readyVideo(sanity, mux, actual.video.asset._ref)
        } else {
          invariant(actual.image?.asset?._ref, 'Missing image reference')
          const image = (await sanity.getDocuments([actual.image.asset._ref])).find(Boolean)
          invariant(image?.metadata?.dimensions?.width > 0 && image?.metadata?.dimensions?.height > 0, 'Image dimensions missing')
          if (op.upload) invariant(image.metadata.dimensions.width === op.source.dimensions.width && image.metadata.dimensions.height === op.source.dimensions.height, 'Image dimensions changed')
        }
      }
      if (op.type === 'project' && actual.slug?.current) report.routes.push(`/work/${actual.slug.current}`)
      if (op.type === 'globeSettings' && op.action === 'patch') report.routes.push('/')
      if (op.type === 'mediaAsset' && actual.project?._ref) { const project = targets.get(actual.project._ref); if (project?.slug?.current) report.routes.push(`/work/${project.slug.current}`) }
      report[op.action === 'create' ? 'created' : op.action === 'patch' ? 'updated' : 'unchanged']++
    } catch (error) { report.failed++; report.issues.push({ id: op.id, message: error.message?.includes('https://') ? 'Provider verification failure (details suppressed).' : error.message }) }
  }
  try { await remoteGuards(plan, journal, sanity) } catch (error) { report.issues.push({ id: 'scope', message: error.message }); if (!report.failed) report.failed++ }
  report.routes = [...new Set(report.routes)]
  return report
}
