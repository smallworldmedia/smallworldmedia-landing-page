#!/usr/bin/env node
/**
 * ingest.mjs — Parse _manifest.md files and create mediaAsset documents in Sanity.
 *
 * Usage:
 *   node scripts/ingest.mjs <manifest-path>                 # ingest one manifest
 *   node scripts/ingest.mjs <manifest-path> --dry-run       # preview only
 *   node scripts/ingest.mjs <manifest-path> --skip-upload   # create docs without uploading images
 *
 * Requires SANITY_WRITE_TOKEN in environment or .env.local
 */
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'

// ── Load token from .env.local if not in environment ──
if (!process.env.SANITY_WRITE_TOKEN) {
  try {
    const envLocal = fs.readFileSync(
      path.resolve(process.cwd(), '.env.local'),
      'utf-8'
    )
    const match = envLocal.match(/SANITY_WRITE_TOKEN="?([^"\n]+)"?/)
    if (match) process.env.SANITY_WRITE_TOKEN = match[1]
  } catch {
    // ignore
  }
}

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

const DRY_RUN = process.argv.includes('--dry-run')
const SKIP_UPLOAD = process.argv.includes('--skip-upload')
const manifestPath = process.argv[2]

if (!manifestPath || manifestPath.startsWith('--')) {
  console.error('Usage: node scripts/ingest.mjs <path-to-_manifest.md> [--dry-run] [--skip-upload]')
  process.exit(1)
}

// ── Utility ──
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── PARSER ──
function parseManifest(raw, manifestDir) {
  const lines = raw.split('\n')
  const header = {}
  const assets = []
  let inTable = false
  let columns = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Parse header key-value pairs
    const kvMatch = trimmed.match(/^(\w[\w\s/]*?):\s*(.+)$/)
    if (kvMatch && !inTable && trimmed[0] !== '|') {
      const key = kvMatch[1].trim().toLowerCase()
      header[key] = kvMatch[2].trim()
      continue
    }

    // H1 title
    if (trimmed.startsWith('# ') && !header.title) {
      header.title = trimmed.slice(2).trim()
      continue
    }

    // Table header
    if (trimmed.startsWith('|') && trimmed.includes('file')) {
      columns = trimmed
        .split('|')
        .filter(Boolean)
        .map((c) => c.trim().toLowerCase())
      inTable = true
      continue
    }

    // Table separator
    if (trimmed.startsWith('|') && trimmed.includes('---')) continue

    // Table data row
    if (trimmed.startsWith('|') && inTable) {
      const cells = trimmed
        .split('|')
        .filter(Boolean)
        .map((c) => c.trim())
      const row = {}
      columns.forEach((col, i) => {
        row[col] = cells[i] || ''
      })
      assets.push(row)
      continue
    }

    // End table on non-table line
    if (inTable && !trimmed.startsWith('|') && trimmed.length > 0) {
      inTable = false
    }
  }

  // Parse services into array
  if (header.services) {
    header.services = header.services.split(',').map((s) => s.trim())
  }

  return { header, assets }
}

// ── RESOLVE REFERENCES ──
async function resolveClient(clientName) {
  const slug = toSlug(clientName)
  const id = `client-${slug}`
  const doc = await client.getDocument(id)
  if (!doc) throw new Error(`Client not found: "${clientName}" (tried ID: ${id})`)
  return { _type: 'reference', _ref: id }
}

async function resolveServiceTags(tagNames) {
  const refs = []
  for (const name of tagNames) {
    const slug = toSlug(name)
    const id = `serviceTag-${slug}`
    const doc = await client.getDocument(id)
    if (!doc) {
      console.warn(`  ⚠️  Service tag not found: "${name}" (tried ID: ${id})`)
      continue
    }
    refs.push({
      _key: slug,
      _type: 'reference',
      _ref: id,
    })
  }
  return refs
}

async function resolveProject(projectSlug) {
  if (!projectSlug) return undefined
  const results = await client.fetch(
    `*[_type == "project" && slug.current == $slug][0]._id`,
    { slug: projectSlug }
  )
  if (!results) {
    console.warn(`  ⚠️  Project not found: "${projectSlug}"`)
    return undefined
  }
  return { _type: 'reference', _ref: results }
}

// ── UPLOAD IMAGE ──
async function uploadImage(filePath) {
  if (SKIP_UPLOAD) return undefined
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️  File not found: ${filePath}`)
    return undefined
  }

  const ext = path.extname(filePath).toLowerCase()
  const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.tiff']
  if (!imageExts.includes(ext)) {
    console.log(`  ⏭  Skipping non-image: ${path.basename(filePath)}`)
    return undefined
  }

  console.log(`  📤 Uploading ${path.basename(filePath)}...`)
  const imageAsset = await client.assets.upload(
    'image',
    fs.createReadStream(filePath),
    { filename: path.basename(filePath) }
  )
  return {
    _type: 'image',
    asset: {
      _type: 'reference',
      _ref: imageAsset._id,
    },
  }
}

// ── BUILD DOCUMENT ──
function buildDoc(row, header, clientRef, serviceRefs, projectRef, imageField, manifestDir) {
  const fileName = row.file
  const slug = toSlug(row.title || path.basename(fileName, path.extname(fileName)))
  const clientSlug = toSlug(header.client)
  const docId = `mediaAsset-${clientSlug}-${slug}`

  // Normalize mediaType column (handles both 'mediatype' and 'mediaType' from headers)
  const mediaType = row.mediatype || row['mediaType'] || 'static_other'

  const doc = {
    _id: docId,
    _type: 'mediaAsset',
    title: row.title || fileName,
    slug: { _type: 'slug', current: slug },
    mediaType,
    client: clientRef,
    services: serviceRefs.length > 0 ? serviceRefs : undefined,
    project: projectRef,
    year: header.year ? parseInt(header.year, 10) : undefined,
    isHero: row.ishero === 'true',
    sortOrder: row.sortorder ? parseInt(row.sortorder, 10) : undefined,
    contentRole: row.contentrole || row['contentRole'] || undefined,
    sourceFolder: manifestDir,
    sourceManifest: path.basename(manifestDir),
  }

  if (imageField) {
    doc.image = imageField
  }

  return doc
}

// ── MAIN ──
async function main() {
  const absPath = path.resolve(manifestPath)
  if (!fs.existsSync(absPath)) {
    console.error(`❌ Manifest not found: ${absPath}`)
    process.exit(1)
  }

  const manifestDir = path.dirname(absPath)
  const raw = fs.readFileSync(absPath, 'utf-8')
  const { header, assets } = parseManifest(raw, manifestDir)

  console.log(`\n📋 Manifest: ${absPath}`)
  console.log(`   Title:    ${header.title || '(untitled)'}`)
  console.log(`   Client:   ${header.client}`)
  console.log(`   Services: ${(header.services || []).join(', ')}`)
  console.log(`   Year:     ${header.year || '—'}`)
  console.log(`   Assets:   ${assets.length}`)
  if (DRY_RUN) console.log('   ⚠️  DRY RUN — no mutations')
  if (SKIP_UPLOAD) console.log('   ⏭  SKIP UPLOAD — no image uploads')

  // Resolve references
  const clientRef = await resolveClient(header.client)
  const headerServiceRefs = await resolveServiceTags(header.services || [])
  const projectRef = await resolveProject(header.project)

  // Pre-cache resolved service tags to avoid redundant GROQ lookups
  const serviceTagCache = new Map()
  for (const ref of headerServiceRefs) {
    serviceTagCache.set(ref._key, ref)
  }

  const mutations = []

  for (const row of assets) {
    const filePath = path.join(manifestDir, row.file)
    const imageField = DRY_RUN ? undefined : await uploadImage(filePath)

    // ── SERVICE TYPE RESOLUTION ──
    // Priority: per-row serviceType → header services → empty
    const rowServiceType = row.servicetype || row['serviceType'] || ''
    let serviceRefs

    if (rowServiceType) {
      // Mode 2: resolve the per-row serviceType value
      const rowTags = rowServiceType.split(',').map((s) => s.trim())
      const rowRefs = []
      for (const tag of rowTags) {
        const slug = toSlug(tag)
        if (serviceTagCache.has(slug)) {
          rowRefs.push(serviceTagCache.get(slug))
        } else {
          const resolved = await resolveServiceTags([tag])
          resolved.forEach((r) => serviceTagCache.set(r._key, r))
          rowRefs.push(...resolved)
        }
      }
      serviceRefs = rowRefs
    } else {
      // Mode 1: fall back to header-level services
      serviceRefs = headerServiceRefs
    }

    const doc = buildDoc(row, header, clientRef, serviceRefs, projectRef, imageField, manifestDir)

    if (DRY_RUN) {
      const svcLabel = rowServiceType ? `[row: ${rowServiceType}]` : '[header]'
      console.log(`  📝 ${doc.title} → ${doc._id} (${doc.mediaType}) ${svcLabel}`)
    }

    mutations.push({ createOrReplace: doc })
  }

  if (DRY_RUN) {
    console.log(`\n✅ Dry run complete — ${mutations.length} assets would be created.`)
    return
  }

  if (mutations.length === 0) {
    console.log('\n⚠️  No assets to ingest.')
    return
  }

  // Batch mutations (Sanity limit: 100 per transaction)
  const BATCH_SIZE = 50
  let created = 0
  for (let i = 0; i < mutations.length; i += BATCH_SIZE) {
    const batch = mutations.slice(i, i + BATCH_SIZE)
    const result = await client.mutate(batch)
    created += batch.length
    console.log(`  ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} docs (txn: ${result.transactionId})`)
  }

  console.log(`\n✨ Done — ${created} media assets ingested.`)
}

main().catch((err) => {
  console.error('❌ Ingest failed:', err.message)
  process.exit(1)
})
