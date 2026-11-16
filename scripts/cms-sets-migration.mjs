#!/usr/bin/env node
import path from 'node:path'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createAdapters } from './lib/cms/adapters.mjs'
import { invariant, targetOf, validateDocument, GROUP_TYPES } from './lib/cms/contract.mjs'
import { ref, baseId, albumArtKey, projectKey, isProjectAlbumArt, newSet } from './lib/cms/sets.mjs'

// Sets migration (US-10): one Set document per (project, legacy displayGroup), plus one album-art set per
// project that has album art, written as `--changes` request files for the CMS runner. READ-ONLY: it reads
// the dataset and writes local JSON; the runner's plan -> Nathan's approval of that plan id -> apply does
// every Sanity write. Members get only `set`; the legacy displayGroup/groupType stay as they are.
export const HELP = `Sets migration: writes CMS --changes request files, never writes Sanity.
  node --env-file=.env.local scripts/cms-sets-migration.mjs --project-id ID --dataset NAME --out DIR
Each file holds at most 100 operations and keeps a set's create with all its member patches. Plan one file
at a time with: node --env-file=.env.local scripts/cms.mjs plan --changes DIR/FILE --project-id ID --dataset NAME
Never overwrites a file. Sets it cannot place are reported, never guessed.
`
export const FILE_PREFIX = '_cms-request_sets-migration-2026-11-'
const OPERATION_LIMIT = 100 // the runner's per-plan ceiling

// Which pieces join which set, how each set is keyed and typed, and the files that carry them. Pure: docs in, plan out.
export function planSetsMigration(docs, { limit = OPERATION_LIMIT } = {}) {
  const published = docs.filter(d => baseId(d._id) === d._id)
  const projects = new Map(published.filter(d => d._type === 'project').map(d => [d._id, d]))
  const existingSets = published.filter(d => d._type === 'mediaSet')
  const twinned = new Set(docs.filter(d => d._type === 'mediaAsset' && baseId(d._id) !== d._id).map(d => baseId(d._id)))
  const reported = { noProject: [], noType: [], mixedType: [], draftTwin: [], invalid: [], tooLarge: [] }
  let albumArtWithoutProject = 0, alreadyLinked = 0

  // A bucket is one (project, group) of pieces still to link; the album-art bucket has group null.
  const buckets = new Map()
  for (const piece of published.filter(d => d._type === 'mediaAsset')) {
    if (piece.set?._ref) { alreadyLinked++; continue }
    const album = isProjectAlbumArt(piece)
    if (!piece.displayGroup && !album) continue
    const projectId = piece.project?._ref, project = projects.get(projectId)
    if (!projectId && !piece.displayGroup) { albumArtWithoutProject++; continue }
    if (!project?.slug?.current) { reported.noProject.push({ id: piece._id, displayGroup: piece.displayGroup ?? null, project: projectId ?? null }); continue }
    const group = piece.displayGroup ?? null, id = `${projectId}|${group ?? ''}`
    if (!buckets.has(id)) buckets.set(id, { project, projectSlug: project.slug.current, group, pieces: [] })
    buckets.get(id).pieces.push(piece)
  }

  // A group several projects use (brand-guidelines-deck) becomes per-project: `<group>-<project slug>`.
  const groupProjects = new Map()
  for (const b of buckets.values()) if (b.group) groupProjects.set(b.group, new Set([...(groupProjects.get(b.group) ?? []), b.project._id]))
  const shared = b => b.group && (groupProjects.get(b.group).size > 1 || existingSets.some(s => s.slug?.current === b.group && s.project?._ref !== b.project._id))

  const units = []
  // Deterministic: project orderRank (unranked last), then project slug, then key.
  const cmp = (a, b) => a < b ? -1 : a > b ? 1 : 0
  const keyed = [...buckets.values()].map(b => ({ ...b, key: b.group ? projectKey(b.group, b.projectSlug, shared(b)) : albumArtKey(b.projectSlug) }))
  const order = (a, c) => cmp(a.project.orderRank ?? '￿', c.project.orderRank ?? '￿') || cmp(a.projectSlug, c.projectSlug) || cmp(a.key, c.key)
  for (const b of keyed.sort(order)) {
    const key = b.key, at = { key, project: b.projectSlug }
    const twins = b.pieces.filter(p => twinned.has(p._id))
    if (twins.length) { reported.draftTwin.push({ ...at, pieces: twins.map(p => p._id) }); continue }
    const existing = existingSets.find(s => s.project?._ref === b.project._id && s.slug?.current === key)
    let groupType = existing?.groupType
    if (!b.group) groupType = 'album-art'
    else if (!existing) {
      const values = [...new Set(b.pieces.map(p => p.groupType).filter(v => v != null))]
      if (!values.length) { reported.noType.push({ ...at, members: b.pieces.length, pieces: b.pieces.map(p => p._id) }); continue }
      if (values.length > 1 || !GROUP_TYPES.includes(values[0])) { reported.mixedType.push({ ...at, values, members: b.pieces.length }); continue }
      groupType = values[0]
    }
    const doc = existing ?? newSet({ projectSlug: b.projectSlug, projectId: b.project._id, key, groupType, allowAsHero: groupType === 'deck' })
    if (!existing) try { validateDocument(doc, { creation: true }) } catch (error) { reported.invalid.push({ ...at, id: doc._id, problem: error.message }); continue }
    const members = [...b.pieces].sort((p, q) => cmp(p.orderRank ?? '', q.orderRank ?? '') || cmp(p._id, q._id)).map(p => p._id)
    const operations = members.length + (existing ? 0 : 1)
    if (operations > limit) { reported.tooLarge.push({ ...at, members: members.length, operations }); continue }
    units.push({ id: doc._id, key, project: b.projectSlug, groupType, allowAsHero: doc.allowAsHero === true, create: existing ? null : doc, members, operations })
  }

  // A file is full at the limit; a set's create and all its member patches always travel together.
  const files = []
  for (const unit of units) {
    let file = files.at(-1)
    if (!file || file.operations + unit.operations > limit) files.push(file = { name: `${FILE_PREFIX}${files.length + 1}.json`, request: { version: 1, creates: [], patches: [] }, operations: 0, sets: [] })
    if (unit.create) file.request.creates.push(unit.create)
    for (const id of unit.members) file.request.patches.push({ id, type: 'mediaAsset', set: { set: ref(unit.id) }, unset: [] })
    file.operations += unit.operations; file.sets.push(unit.id); unit.file = file.name
  }
  return { files, sets: units.map(({ create, ...u }) => ({ ...u, created: !!create, members: u.members.length })), reported, notes: { albumArtWithoutProject, alreadyLinked } }
}

const REPORT_TEXT = {
  noProject: 'pieces with a displayGroup but no project (a set needs a project), not placed',
  noType: 'sets whose members carry no groupType, not created (set the type, then rerun)',
  mixedType: 'sets whose members disagree on groupType, or hold a value outside the ten types, not created',
  draftTwin: 'sets held back because a member has a draft or release version (resolve it in Studio, then rerun)',
  invalid: 'sets whose key or id the runner would refuse, not created',
  tooLarge: 'sets with more members than one request file holds, not created',
}
export function summaryLines({ files, sets, reported, notes }) {
  const lines = [`${sets.length} sets (${sets.filter(s => s.created).length} to create, ${sets.reduce((n, s) => n + s.members, 0)} piece links) in ${files.length} request files`]
  for (const f of files) lines.push(`${f.name}: ${f.operations} operations, ${f.sets.length} sets`)
  for (const s of sets) lines.push(`  ${s.key} [${s.project}] ${s.groupType}${s.allowAsHero ? ' hero-capable' : ''}${s.created ? '' : ' (exists)'}: ${s.members} members -> ${s.file}`)
  lines.push(`Already linked: ${notes.alreadyLinked} pieces. Album art with no project (left alone): ${notes.albumArtWithoutProject}.`)
  for (const [name, items] of Object.entries(reported)) if (items.length) lines.push(`REPORTED ${items.length} ${REPORT_TEXT[name]}`, ...items.map(i => `  ${JSON.stringify(i)}`))
  return lines
}

function parse(argv) {
  if (!argv.length || ['help', '--help', '-h'].includes(argv[0])) return null
  const flags = {}
  for (let i = 0; i < argv.length; i += 2) { const key = argv[i]?.replace(/^--/, ''); invariant(argv[i]?.startsWith('--') && ['project-id', 'dataset', 'out'].includes(key) && !Object.hasOwn(flags, key) && argv[i + 1] && !argv[i + 1].startsWith('--'), `Invalid/duplicate argument ${argv[i]}`); flags[key] = argv[i + 1] }
  invariant(flags.out, 'Requires --out DIR')
  return flags
}
export async function main(argv = process.argv.slice(2), { env = process.env, log = console.log, adaptersFactory = createAdapters } = {}) {
  const flags = parse(argv)
  if (!flags) { log(HELP); return 0 }
  const target = targetOf({ projectId: flags['project-id'], dataset: flags.dataset })
  const adapters = await adaptersFactory({ target, env, write: false })
  const result = planSetsMigration(await adapters.sanity.snapshot())
  const out = path.resolve(flags.out)
  if (result.files.length) await mkdir(out, { recursive: true })
  // 'wx': a rerun never overwrites a request file Nathan may already have planned.
  for (const f of result.files) await writeFile(path.join(out, f.name), `${JSON.stringify(f.request, null, 2)}\n`, { flag: 'wx' })
  for (const line of summaryLines(result)) log(line)
  if (result.files.length) log(`Written to ${out}. Nothing was written to Sanity.`)
  return 0
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code }).catch(error => { console.error(`Sets migration stopped: ${error.message}`); process.exitCode = 1 })
}
