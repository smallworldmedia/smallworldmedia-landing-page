#!/usr/bin/env node
/** Local intake scaffolding only; never uploads, assigns IDs/ranks, or replaces manifests.
 * Usage: node scripts/generate-manifests.mjs "Client Name" [--dry-run]
 * Review classifications/services before using scripts/cms.mjs plan.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { IMAGE_EXTS, VIDEO_EXTS } from './lib/cms/manifest.mjs'
import { MEDIA_TYPES } from './lib/cms/contract.mjs'

const MEDIA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'media')
const extensions = new Set([...IMAGE_EXTS, ...VIDEO_EXTS])
const safeCell = value => {
  if (/[|\r\n]/.test(value)) throw new Error('Manifest names cannot contain pipes or line breaks; review/rename first')
  return value
}
const titleOf = file => safeCell(path.parse(file).name.replace(/[-_]/g, ' ').replace(/\s+v\d+$/i, '').replace(/\s+/g, ' ').trim())

// Keep page paths relative to their collection. Never traverse symlinks or absorb
// a nested collection that already owns a manifest.
export function getIngestibleFiles(directory, recursive = false, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) return []
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isFile()) return extensions.has(path.extname(entry.name).toLowerCase()) ? [safeCell(relative)] : []
    const child = path.join(directory, entry.name)
    if (recursive && entry.isDirectory() && !fs.existsSync(path.join(child, '_manifest.md'))) return getIngestibleFiles(child, true, relative)
    return []
  })
}

export function generateManifest(client, collection, files) {
  safeCell(client); if (collection) safeCell(collection)
  const artwork = collection?.toLowerCase() === 'artwork'
  const columns = ['file', 'mediaType', ...(!collection ? ['serviceType'] : []), 'title', 'contentRole', 'displayGroup', 'brandDeckOrder', 'sanityId']
  const rows = files.map(file => [file, artwork && IMAGE_EXTS.includes(path.extname(file).toLowerCase()) ? 'album-art' : 'TBD', ...(!collection ? ['TBD'] : []), titleOf(file), '', '', '', ''])
  return `# ${client} — ${collection || 'Root Assets'}\n\nclient: ${client}\n${collection ? `services: ${artwork ? 'album art' : 'TBD'}\n` : ''}year: ${new Date().getFullYear()}\n\nScaffold only — resolve every TBD using actual dimensions and visual review.\nUse the closest suitable aspect bucket; generic other types are not unreviewed defaults.\nNested deck/carousel pages need reviewed mediaType, displayGroup and page sequence.\nLeave sanityId empty for new files; the approved runner records stable bindings.\nRow order sequences new additions only; existing Studio orderRank remains authoritative.\nValid mediaType values — ${MEDIA_TYPES.join(', ')}.\n\n## Assets\n\n| ${columns.join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}\n`
}

export function processClient(clientName, { dryRun = false, force = false, mediaDir = MEDIA_DIR } = {}) {
  if (force) throw new Error('--force is retired: existing manifests and sanityId bindings must never be overwritten')
  if (!clientName || clientName === '.' || clientName === '..' || /[\\/]/.test(clientName)) throw new Error('Select one client folder name, not a path or the whole library')
  safeCell(clientName)
  const clientDir = path.join(mediaDir, clientName)
  const stat = fs.lstatSync(clientDir)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Client must be a real directory, not a symlink')
  const results = { created: [], skipped: [] }
  const collections = fs.readdirSync(clientDir, { withFileTypes: true }).filter(e => !e.name.startsWith('.') && e.isDirectory() && !e.isSymbolicLink()).map(e => e.name).sort()
  for (const collection of [null, ...collections]) {
    const directory = collection ? path.join(clientDir, collection) : clientDir
    const manifest = path.join(directory, '_manifest.md')
    // lstat also catches dangling symlinks; exclusive create closes the check/write race.
    try { fs.lstatSync(manifest); results.skipped.push(manifest); continue } catch (error) { if (error.code !== 'ENOENT') throw error }
    const files = getIngestibleFiles(directory, Boolean(collection))
    if (!files.length) continue
    const content = generateManifest(clientName, collection, files)
    if (!dryRun) fs.writeFileSync(manifest, content, { encoding: 'utf8', flag: 'wx' })
    results.created.push({ path: manifest, files: files.length, preview: content })
  }
  return results
}

export function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/generate-manifests.mjs "Client Name" [--dry-run]\nLocal scaffolds only; existing manifests are never replaced. No implicit whole-library scope.')
    return
  }
  if (args.includes('--force')) throw new Error('--force is retired: preserve existing manifests and stable bindings')
  const clients = args.filter(a => !a.startsWith('--'))
  if (clients.length !== 1 || args.some(a => a.startsWith('--') && a !== '--dry-run')) throw new Error('Provide exactly one client and optionally --dry-run')
  const dryRun = args.includes('--dry-run')
  const results = processClient(clients[0], { dryRun })
  for (const item of results.created) {
    console.log(`${dryRun ? 'Would create' : 'Created'} ${item.path} (${item.files} files)`)
    if (dryRun) console.log(item.preview)
  }
  for (const file of results.skipped) console.log(`Preserved existing ${file}`)
  console.log(`${results.created.length} ${dryRun ? 'proposed' : 'created'}, ${results.skipped.length} preserved. Review intake before CMS planning.`)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
