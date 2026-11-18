// US-10 sets migration: the pre-apply oracle. READ-ONLY (published perspective, drafts dropped, like the site build).
// Applies media/_sets-migration/_cms-request_sets-migration-*.json in memory over a live snapshot, then reports:
// (1) a field-level diff of what the site's set-aware projections return (MEDIA_FIELDS and FEATURED_WORLDS_QUERY
//     coalesce groupType/displayGroup from the set; setId/setAllowsHero feed only the hero rule) for every piece;
// (2) the site's own FEATURED_PROJECT_DETAIL_QUERY + buildContentFlow (detail/work/globe), per touched project, on a
//     dataset cut to that project's pieces plus every non-media document and the assets they reference.
// Published perspective (drafts dropped), like the site build. Usage (from the checkout): node --env-file=.env.local scripts/cms-sets-migration-oracle.mjs media/_sets-migration --only 2
// Run it on a file's projects right before that file's plan (the full-dataset form of its slower predecessor took 19+ min).
import { createRequire } from 'node:module'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const ROOT = process.cwd(), req = createRequire(path.join(ROOT, 'package.json'))
const { createClient } = await import(req.resolve('@sanity/client'))
const { parse, evaluate } = await import(req.resolve('groq-js'))
const Q = await import(pathToFileURL(path.join(ROOT, 'src/lib/queries.js')).href)
const { buildContentFlow } = await import(pathToFileURL(path.join(ROOT, 'src/components/work/detail/buildContentFlow.js')).href)
const [dir, ...rest] = process.argv.slice(2)
const only = rest.includes('--only') ? new Set(rest[rest.indexOf('--only') + 1].split(',').map(Number)) : null
const TYPES = ['mediaAsset', 'mediaSet', 'project', 'client', 'serviceTag', 'sanity.imageAsset', 'mux.videoAsset'] // never secrets.* / mux.apiKey
const client = createClient({ projectId: 'b60h4u7o', dataset: 'production', apiVersion: '2024-01-01', useCdn: false, perspective: 'raw',
  // The runner's own names (docs/cms-workflow.md). Without a token the read is public: published only, so drafts
  // vanish and the draft notes below can never fire. Refuse that rather than report a clean run.
  token: process.env.SANITY_READ_TOKEN || process.env.SANITY_WRITE_TOKEN })
if (!client.config().token) throw new Error('No SANITY_READ_TOKEN or SANITY_WRITE_TOKEN: run with node --env-file=.env.local')
const raw = await client.fetch(`*[_type in $types && !(_id in path("versions.**"))]`, { types: TYPES })
const drafts = new Set(raw.filter(d => d._id.startsWith('drafts.')).map(d => d._id.slice(7)))
const before = raw.filter(d => !d._id.startsWith('drafts.'))
console.log(`snapshot: ${before.length} published documents, ${drafts.size} drafts`)
const files = (await readdir(dir)).filter(f => /^_cms-request_sets-migration-.*\.json$/.test(f)).sort((a, b) => Number(a.match(/-(\d+)\.json$/)[1]) - Number(b.match(/-(\d+)\.json$/)[1]))
const after = structuredClone(before), byId = new Map(after.map(d => [d._id, d])), touched = new Set(), patched = new Set()
let creates = 0, links = 0
for (const f of files) {
  const n = Number(f.match(/-(\d+)\.json$/)[1]); if (only && !only.has(n)) continue
  const r = JSON.parse(await readFile(path.join(dir, f), 'utf8'))
  for (const doc of r.creates || []) { if (byId.has(doc._id)) throw new Error(`create collides: ${doc._id}`); after.push(doc); byId.set(doc._id, doc); touched.add(doc.project?._ref); creates++ }
  for (const p of r.patches || []) { const d = byId.get(p.id); if (!d) throw new Error(`patch target missing: ${p.id}`); Object.assign(d, p.set || {}); for (const k of p.unset || []) delete d[k]; patched.add(p.id); links++; if (drafts.has(p.id)) console.log(`  note: ${p.id} has a draft (the plan blocks on it)`) }
}
console.log(`applied in memory: ${creates} sets, ${links} links, ${touched.size} projects`)
// (1) Field level: the two coalesced fields, emulated exactly as MEDIA_FIELDS writes them.
const beforeById = new Map(before.map(d => [d._id, d]))
const eff = (d, docs) => { const s = d.set?._ref ? docs.get(d.set._ref) : null
  return { groupType: s?.groupType ?? d.groupType ?? null, displayGroup: (s && s.groupType !== 'album-art' ? s.slug?.current ?? null : null) ?? d.displayGroup ?? null } }
let fieldDiffs = 0
for (const id of patched) { const a = eff(beforeById.get(id), beforeById), b = eff(byId.get(id), byId)
  if (a.groupType !== b.groupType || a.displayGroup !== b.displayGroup) { fieldDiffs++; console.log(`  FIELD ${id} [${byId.get(id).project?._ref}] ${JSON.stringify(a)} -> ${JSON.stringify(b)}`) } }
console.log(`field-level: ${fieldDiffs} of ${patched.size} linked pieces read differently`)
// (2) The page flows, per touched featured project.
const reduce = (docs, pid) => { const media = docs.filter(d => d._type === 'mediaAsset' && d.project?._ref === pid), refs = new Set(media.flatMap(d => [d.image?.asset?._ref, d.video?.asset?._ref]).filter(Boolean))
  return docs.filter(d => d._type === 'mediaAsset' ? d.project?._ref === pid : (d._type === 'sanity.imageAsset' || d._type === 'mux.videoAsset') ? refs.has(d._id) : true) }
const run = async (docs, q, params = {}) => (await evaluate(parse(q), { dataset: docs, params })).get()
const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'setId' || k === 'setAllowsHero' ? undefined : x)))
const ids = l => (l || []).map(a => a._id)
const shape = flow => Object.fromEntries(Object.entries(flow).map(([k, v]) => [k, Array.isArray(v) ? v.map(x => x?._id ?? ((x?.pages || x?.items) ? { type: x.type ?? null, ids: ids(x.pages || x.items) } : x)) : v && typeof v === 'object' && (v.items || v.pages) ? { type: v.type, ids: ids(v.items || v.pages) } : v]))
let changed = 0, checked = 0
for (const pid of touched) {
  const p = beforeById.get(pid); if (!p?.isFeatured) { console.log(`  ${p?.slug?.current ?? pid}: not featured (no project page)`); continue }
  const t0 = Date.now(), A = await run(reduce(before, pid), Q.FEATURED_PROJECT_DETAIL_QUERY, { projectId: pid }), B = await run(reduce(after, pid), Q.FEATURED_PROJECT_DETAIL_QUERY, { projectId: pid })
  const q = JSON.stringify(strip(A)) === JSON.stringify(strip(B)) ? 'same' : 'DIFFERS'
  const flows = ['detail', 'work', 'globe'].map(surface => [surface, JSON.stringify(shape(buildContentFlow(A.assets, { surface }))) === JSON.stringify(shape(buildContentFlow(B.assets, { surface })))])
  const bad = flows.filter(([, same]) => !same).map(([s]) => s); checked++
  if (bad.length || q !== 'same') changed++
  console.log(`  ${p.slug.current}: ${A.assets.length} pieces, query ${q}, flows ${bad.length ? 'CHANGE on ' + bad.join(',') : 'same'} (hero ${A.assets[0]?._id}${B.assets[0]?.setAllowsHero ? ', its set may lead' : ''}) ${Date.now() - t0} ms`)
}
console.log(`${checked} featured projects checked x 3 surfaces: ${changed} change`)
