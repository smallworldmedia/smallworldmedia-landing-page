import path from 'node:path'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { readFile, realpath, stat, lstat, open, rename, unlink } from 'node:fs/promises'
import { invariant, MEDIA_TYPES, isVideoType, digest } from './contract.mjs'

export const IMAGE_EXTS = ['.jpg','.jpeg','.png','.gif','.webp','.svg']
export const VIDEO_EXTS = ['.mp4','.mov','.webm']
const columnsAllowed = ['file','mediatype','servicetype','title','ishero','sortorder','aspectratio','contentrole','displaygroup','branddeckorder','sanityid']
const placeholder = v => /^(?:—|-|tbd|todo|pending|\?|\[.*\]|<.*>)$/i.test(v)
export const legacySlug = value => String(value).toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
function cells(line) { invariant(!line.includes('\\|'), 'Escaped pipe cells are unsupported; rename/review intake'); return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim()) }
export function parseManifest(raw) {
  invariant(typeof raw === 'string', 'Manifest must be text')
  const lines = raw.split(/\r?\n/), header = {}, assets = []
  let columns, headerLine = -1, separatorLine = -1, ended = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim()
    if (!line.startsWith('|')) {
      if (columns && line) ended = true
      if (!columns) {
        const kv = line.match(/^([\w /]+):\s*(.*)$/)
        if (kv) { const key = kv[1].trim().toLowerCase(); invariant(['client','services','year','project'].includes(key), `Unknown manifest header ${key}`); invariant(!Object.hasOwn(header, key), `Duplicate manifest header ${key}`); header[key] = kv[2].trim() }
        if (line.startsWith('# ') && !header.title) header.title = line.slice(2)
      }
      continue
    }
    invariant(!ended, 'Only one asset table is supported per scoped manifest')
    const values = cells(line)
    if (!columns) {
      columns = values.map(c => c.toLowerCase()); headerLine = index
      invariant(columns.includes('file') && columns.includes('mediatype'), 'Manifest table requires file and mediaType')
      invariant(new Set(columns).size === columns.length, 'Duplicate manifest columns')
      for (const c of columns) invariant(columnsAllowed.includes(c), `Unknown manifest column ${c}`)
      continue
    }
    if (values.every(v => /^:?-+:?$/.test(v))) { invariant(separatorLine < 0 && assets.length === 0 && values.length === columns.length, 'Invalid table separator'); separatorLine = index; continue }
    invariant(separatorLine >= 0 && values.length === columns.length, `Invalid cell count/table at line ${index+1}`)
    const row = Object.fromEntries(columns.map((c, i) => [c, values[i]])); row.line = index
    invariant(row.file && !placeholder(row.file), `Missing file at line ${index+1}`)
    invariant(MEDIA_TYPES.includes(row.mediatype), `Invalid/placeholder classification ${row.mediatype} at line ${index+1}`)
    for (const key of ['title','servicetype','sanityid','contentrole','displaygroup']) invariant(!row[key] || !placeholder(row[key]), `Unresolved ${key} at line ${index+1}`)
    invariant(!row.contentrole || ['process','supporting'].includes(row.contentrole), `Invalid contentRole at line ${index+1}`)
    invariant(!row.ishero || ['true','false'].includes(row.ishero), `Invalid legacy isHero at line ${index+1}`)
    for (const key of ['sortorder','branddeckorder']) invariant(!row[key] || /^\d+$/.test(row[key]), `Invalid ${key} at line ${index+1}`)
    assets.push(row)
  }
  invariant(header.client && !placeholder(header.client), 'Manifest requires resolved client')
  invariant(assets.length, 'Manifest has no scoped assets')
  if (header.year) invariant(/^20\d\d$/.test(header.year) && +header.year >= 2015 && +header.year <= 2030, 'Invalid manifest year')
  if (header.services) { header.services = header.services.split(',').map(v => v.trim()); invariant(header.services.every(v => v && !placeholder(v)), 'Unresolved services') }
  const files = assets.map(r => path.normalize(r.file)); invariant(new Set(files).size === files.length, 'Duplicate manifest file rows')
  const ids = assets.map(r => r.sanityid).filter(Boolean); invariant(new Set(ids).size === ids.length, 'Duplicate manifest sanityId')
  for (const r of assets) invariant(r.servicetype || header.services?.length, `Row ${r.file} requires explicit services (Mode 1 header or Mode 2 serviceType)`)
  return { header, assets, columns, headerLine, separatorLine, mode: header.services ? 1 : 2 }
}
export async function scopedFile(root, relative) {
  invariant(typeof relative === 'string' && relative.length && !path.isAbsolute(relative) && !relative.includes('\\') && !relative.split('/').includes('..'), 'Source path escape/absolute path rejected')
  const base = await realpath(root), file = await realpath(path.resolve(base, relative))
  invariant(file.startsWith(`${base}${path.sep}`), 'Source symlink escapes scope')
  invariant((await stat(file)).isFile(), `Not a regular source file: ${relative}`)
  return file
}
export async function fileHash(file) { const hash = createHash('sha256'); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest('hex') }
export function fileKind(file) { const ext = path.extname(file).toLowerCase(); if (IMAGE_EXTS.includes(ext)) return 'image'; if (VIDEO_EXTS.includes(ext)) return 'video'; throw new Error(`Unsupported extension ${ext}; PDFs require reviewed page-image exports`) }
export async function inspectFile(root, relative, mediaType, probe) {
  const file = await scopedFile(root, relative), kind = fileKind(file)
  invariant((kind === 'video') === isVideoType(mediaType), `File type/mediaType mismatch for ${relative}`)
  const hashBefore = await fileHash(file), size = (await stat(file)).size
  invariant(size > 0, `Empty media source ${relative}`)
  const dimensions = await probe(file, kind)
  invariant(Number.isFinite(dimensions.width) && dimensions.width > 0 && Number.isFinite(dimensions.height) && dimensions.height > 0, `Unresolved dimensions for ${relative}`)
  invariant(await fileHash(file) === hashBefore, `Source changed while probing ${relative}`)
  return { root: await realpath(root), relative, path: file, sha256: hashBefore, size, kind, dimensions }
}
export function boundManifest(raw, bindings) {
  const parsed = parseManifest(raw), lines = raw.split(/\r?\n/), newline = raw.includes('\r\n') ? '\r\n' : '\n'
  let cols = [...parsed.columns], at = cols.indexOf('sanityid')
  if (at < 0) { at = cols.length; cols.push('sanityid'); lines[parsed.headerLine] = `| ${[...cells(lines[parsed.headerLine]), 'sanityId'].join(' | ')} |`; lines[parsed.separatorLine] = `| ${cols.map(() => '---').join(' | ')} |` }
  for (const row of parsed.assets) {
    const vals = cells(lines[row.line]); while (vals.length < cols.length) vals.push('')
    if (bindings[row.file]) { invariant(!vals[at] || vals[at] === bindings[row.file], `Manifest identity changed for ${row.file}`); vals[at] = bindings[row.file] }
    lines[row.line] = `| ${vals.join(' | ')} |`
  }
  return lines.join(newline)
}
// The engine holds its run lock. Reject concurrent editorial edits, including after rename.
export async function writeBindings(plan, journal) {
  if (plan.scope.kind !== 'manifest') return
  const bindings = Object.fromEntries(plan.operations.filter(op => journal.operations[op.id]?.stage === 'done' || op.action === 'unchanged').map(op => [op.rowFile, op.id]))
  if (!Object.keys(bindings).length) return
  const output = boundManifest(plan.scope.original, bindings)
  const file = plan.scope.path, st = await lstat(file)
  invariant(st.isFile() && !st.isSymbolicLink(), 'Manifest must remain a regular file')
  const current = await readFile(file, 'utf8')
  const oldHash = journal.manifestHash || plan.scope.sha256
  invariant(digest(current) === oldHash || current === output, 'Manifest changed; refusing identity write-back. Restore reviewed intake or resolve manually.')
  if (current !== output) {
    const temp = `${file}.cms-${plan.id}.tmp`
    const handle = await open(temp, 'wx', st.mode & 0o777)
    try { await handle.writeFile(output); await handle.sync() } finally { await handle.close() }
    try { invariant(await readFile(file, 'utf8') === current, 'Manifest changed during identity write-back'); await rename(temp, file) } catch (error) { await unlink(temp).catch(() => {}); throw error }
  }
  journal.manifestHash = digest(output)
}
