#!/usr/bin/env node
/**
 * generate-manifests.mjs — Scaffold _manifest.md files for client folders.
 *
 * Scans the media/ directory and generates skeleton manifest files
 * with file listings, inferred mediaType values, and placeholder fields.
 *
 * Usage:
 *   node scripts/generate-manifests.mjs                    # scaffold all clients missing manifests
 *   node scripts/generate-manifests.mjs "Heavy House Society"  # scaffold one client
 *   node scripts/generate-manifests.mjs --dry-run          # preview only
 *   node scripts/generate-manifests.mjs --force            # overwrite existing manifests
 *
 * See docs/_manifest-template.md for the manifest format specification.
 * See CONTEXT.md for folder structure and terminology.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEDIA_DIR = path.resolve(__dirname, '..', 'media')

// ── Configuration ──────────────────────────────────────────────────────────

const INGESTIBLE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
  '.mp4', '.mov', '.webm'
])

const EXCLUDED_FILES = new Set([
  '.ds_store', 'thumbs.db', '.dropbox', 'icon\r', '.icon',
  '_manifest.md', '.gitkeep'
])

const SOURCE_EXTENSIONS = new Set([
  '.psd', '.ai', '.aep', '.prproj', '.blend', '.indd',
  '.arw', '.cr2', '.dng', '.nef', '.orf',
  '.pdf', '.wav', '.mp3', '.aif', '.flac',
  '.zip', '.rar', '.7z', '.dmg'
])

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'])
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.webm'])

// ── Media type inference ────────────────────────────────────────────────────

function inferMediaType(filename, parentIsArtwork) {
  const ext = path.extname(filename).toLowerCase()

  if (parentIsArtwork && IMAGE_EXTENSIONS.has(ext)) {
    return 'album-art'
  }

  if (IMAGE_EXTENSIONS.has(ext)) {
    // Can't determine aspect ratio from filename alone — use static_other as default
    return 'static_other'
  }

  if (VIDEO_EXTENSIONS.has(ext)) {
    return 'motion_other'
  }

  return 'unknown'
}

// ── Title generation ────────────────────────────────────────────────────────

function generateTitle(filename) {
  const name = path.parse(filename).name
  return name
    // Replace common separators with spaces
    .replace(/[-_]/g, ' ')
    // Remove version suffixes like v1, v2
    .replace(/\s+v\d+$/i, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Manifest generation ─────────────────────────────────────────────────────

function generateRootManifest(clientName, files) {
  const year = new Date().getFullYear()
  const rows = files.map((f, i) => {
    const mediaType = inferMediaType(f, false)
    const title = generateTitle(f)
    return `| ${f} | ${mediaType} | <!-- serviceType --> | ${title} | ${i + 1} |`
  })

  return `# ${clientName} — Root Assets

client: ${clientName}
year: ${year}

## Assets

| file | mediaType | serviceType | title | sortOrder |
|------|-----------|-------------|-------|-----------|
${rows.join('\n')}
`
}

function generateArtworkManifest(clientName, files) {
  const year = new Date().getFullYear()
  const rows = files.map((f, i) => {
    const title = generateTitle(f)
    return `| ${f} | album-art | ${title} | ${i + 1} |`
  })

  return `# ${clientName} — Artwork

client: ${clientName}
services: album art
year: ${year}

## Assets

| file | mediaType | title | sortOrder |
|------|-----------|-------|-----------|
${rows.join('\n')}
`
}

function generateProjectManifest(clientName, projectName, files) {
  const year = new Date().getFullYear()
  const rows = files.map((f, i) => {
    const mediaType = inferMediaType(f, false)
    const title = generateTitle(f)
    return `| ${f} | ${mediaType} | ${title} | ${i + 1} | |`
  })

  return `# ${clientName} — ${projectName}

client: ${clientName}
services: <!-- define services -->
year: ${year}

## Assets

| file | mediaType | title | sortOrder | displayGroup |
|------|-----------|-------|-----------|--------------|
${rows.join('\n')}
`
}

// ── File scanning ───────────────────────────────────────────────────────────

function getIngestibleFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
    .filter(f => {
      if (EXCLUDED_FILES.has(f.toLowerCase())) return false
      const ext = path.extname(f).toLowerCase()
      if (SOURCE_EXTENSIONS.has(ext)) return false
      if (!INGESTIBLE_EXTENSIONS.has(ext)) return false
      // Must be a file, not a directory
      return fs.statSync(path.join(dirPath, f)).isFile()
    })
    .sort()
}

function getSubfolders(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
    .filter(f => {
      if (f.startsWith('.')) return false
      return fs.statSync(path.join(dirPath, f)).isDirectory()
    })
    .sort()
}

function isArtworkFolder(folderName) {
  return folderName.toLowerCase() === 'artwork'
}

// ── Main ────────────────────────────────────────────────────────────────────

function processClient(clientName, opts) {
  const clientDir = path.join(MEDIA_DIR, clientName)
  const results = { created: [], skipped: [], errors: [] }

  if (!fs.existsSync(clientDir)) {
    results.errors.push(`Client folder not found: ${clientDir}`)
    return results
  }

  // 1. Root manifest
  const rootManifestPath = path.join(clientDir, '_manifest.md')
  const rootFiles = getIngestibleFiles(clientDir)

  if (rootFiles.length > 0) {
    if (fs.existsSync(rootManifestPath) && !opts.force) {
      results.skipped.push({ path: rootManifestPath, reason: 'exists' })
    } else {
      const content = generateRootManifest(clientName, rootFiles)
      if (opts.dryRun) {
        results.created.push({ path: rootManifestPath, files: rootFiles.length, preview: content })
      } else {
        fs.writeFileSync(rootManifestPath, content, 'utf-8')
        results.created.push({ path: rootManifestPath, files: rootFiles.length })
      }
    }
  }

  // 2. Subfolders (Artwork Catalogs + Featured Projects)
  const subfolders = getSubfolders(clientDir)
  for (const folder of subfolders) {
    const subDir = path.join(clientDir, folder)
    const manifestPath = path.join(subDir, '_manifest.md')
    const files = getIngestibleFiles(subDir)

    if (files.length === 0) continue

    if (fs.existsSync(manifestPath) && !opts.force) {
      results.skipped.push({ path: manifestPath, reason: 'exists' })
      continue
    }

    let content
    if (isArtworkFolder(folder)) {
      content = generateArtworkManifest(clientName, files)
    } else {
      content = generateProjectManifest(clientName, folder, files)
    }

    if (opts.dryRun) {
      results.created.push({ path: manifestPath, files: files.length, preview: content })
    } else {
      fs.writeFileSync(manifestPath, content, 'utf-8')
      results.created.push({ path: manifestPath, files: files.length })
    }
  }

  return results
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const opts = {
  dryRun: args.includes('--dry-run'),
  force: args.includes('--force')
}
const clientFilter = args.find(a => !a.startsWith('--'))

if (!fs.existsSync(MEDIA_DIR)) {
  console.error('❌ Media directory not found:', MEDIA_DIR)
  console.error('   Expected: media/ in project root')
  process.exit(1)
}

// Gather clients
let clients
if (clientFilter) {
  clients = [clientFilter]
} else {
  clients = fs.readdirSync(MEDIA_DIR)
    .filter(f => {
      if (f.startsWith('.')) return false
      return fs.statSync(path.join(MEDIA_DIR, f)).isDirectory()
    })
    .sort()
}

console.log(`🏗️  Manifest Generator${opts.dryRun ? ' (DRY RUN)' : ''}`)
console.log(`   Media dir: ${MEDIA_DIR}`)
console.log(`   Clients: ${clients.length}`)
console.log('')

let totalCreated = 0
let totalSkipped = 0
let totalErrors = 0

for (const client of clients) {
  const results = processClient(client, opts)

  if (results.created.length === 0 && results.skipped.length === 0 && results.errors.length === 0) {
    continue // No ingestible files — skip silently
  }

  console.log(`📂 ${client}`)

  for (const c of results.created) {
    const relPath = path.relative(MEDIA_DIR, c.path)
    const flag = opts.dryRun ? '(would create)' : '✅'
    console.log(`   ${flag} ${relPath} — ${c.files} files`)
    totalCreated++
  }

  for (const s of results.skipped) {
    const relPath = path.relative(MEDIA_DIR, s.path)
    console.log(`   ⏭️  ${relPath} — already exists`)
    totalSkipped++
  }

  for (const e of results.errors) {
    console.log(`   ❌ ${e}`)
    totalErrors++
  }
}

console.log('')
console.log(`✨ Done: ${totalCreated} created, ${totalSkipped} skipped, ${totalErrors} errors`)
