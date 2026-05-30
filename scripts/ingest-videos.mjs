#!/usr/bin/env node
/**
 * ingest-videos.mjs — Upload video files to Mux and wire them into existing
 * mediaAsset documents in Sanity.
 *
 * Prerequisites:
 *   - Mux API credentials in .env.local:
 *       MUX_TOKEN_ID="..."
 *       MUX_TOKEN_SECRET="..."
 *   - @mux/mux-node installed: npm install @mux/mux-node
 *   - Existing mediaAsset documents (from ingest.mjs) with motion_ mediaTypes
 *
 * Usage:
 *   node scripts/ingest-videos.mjs                  # upload all videos
 *   node scripts/ingest-videos.mjs --dry-run        # preview only
 *   node scripts/ingest-videos.mjs --manifest <path> # single manifest
 *   node scripts/ingest-videos.mjs --max-size 100   # skip files over 100 MB
 *
 * How it works:
 *   1. Finds all mediaAsset docs with motion_* mediaTypes that have NO video field
 *   2. Matches each to its source file via sourceFolder + filename from manifest
 *   3. Uploads to Mux via Direct Upload
 *   4. Creates mux.videoAsset document in Sanity
 *   5. Patches the mediaAsset document with the video reference
 */
import Mux from '@mux/mux-node'
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

// ── Load env ──
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envLocal = fs.readFileSync(envPath, 'utf-8')
  for (const [, key, val] of envLocal.matchAll(/^(\w+)="?([^"\n]+)"?$/gm)) {
    if (!process.env[key]) process.env[key] = val
  }
}

// ── Validate credentials ──
const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET
const SANITY_TOKEN = process.env.SANITY_WRITE_TOKEN

if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  console.error('❌ Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET in .env.local')
  console.error('   Get your API tokens from: https://dashboard.mux.com/settings/access-tokens')
  process.exit(1)
}

if (!SANITY_TOKEN) {
  console.error('❌ Missing SANITY_WRITE_TOKEN in .env.local')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')
const manifestFlag = process.argv.indexOf('--manifest')
const singleManifest = manifestFlag !== -1 ? process.argv[manifestFlag + 1] : null
const maxSizeFlag = process.argv.indexOf('--max-size')
const MAX_SIZE_MB = maxSizeFlag !== -1 ? Number(process.argv[maxSizeFlag + 1]) : Infinity

// ── Clients ──
const mux = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET })

const sanity = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: SANITY_TOKEN,
})

// ── Video extensions ──
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'])

function isVideo(filename) {
  return VIDEO_EXTS.has(path.extname(filename).toLowerCase())
}

// ── Find video assets needing upload ──
async function findVideoAssetsNeedingUpload() {
  // Query Sanity for all motion mediaAssets that don't have a video field yet
  const query = singleManifest
    ? `*[_type == "mediaAsset" && mediaType match "motion_*" && !defined(video) && sourceFolder == $folder]{
        _id, title, mediaType, sourceFolder, sourceManifest
      }`
    : `*[_type == "mediaAsset" && (mediaType match "motion_*" || mediaType == "featured-project-reel") && !defined(video)]{
        _id, title, mediaType, sourceFolder, sourceManifest
      }`

  const params = singleManifest
    ? { folder: path.dirname(path.resolve(singleManifest)) }
    : {}

  return sanity.fetch(query, params)
}

// ── Parse manifest to map doc IDs to filenames ──
function parseManifestForVideos(manifestPath) {
  if (!fs.existsSync(manifestPath)) return new Map()

  const raw = fs.readFileSync(manifestPath, 'utf-8')
  const lines = raw.split('\n')
  const map = new Map() // title → filename
  let inTable = false
  let columns = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('|') && trimmed.includes('file')) {
      columns = trimmed.split('|').filter(Boolean).map((c) => c.trim().toLowerCase())
      inTable = true
      continue
    }
    if (trimmed.startsWith('|') && trimmed.includes('---')) continue
    if (trimmed.startsWith('|') && inTable) {
      const cells = trimmed.split('|').filter(Boolean).map((c) => c.trim())
      const row = {}
      columns.forEach((col, i) => { row[col] = cells[i] || '' })
      if (row.file && isVideo(row.file)) {
        const title = row.title || row.file
        map.set(title, row.file)
      }
      continue
    }
    if (inTable && !trimmed.startsWith('|') && trimmed.length > 0) {
      inTable = false
    }
  }

  return map
}

// ── Upload a single video to Mux ──
async function uploadToMux(filePath, filename) {
  console.log(`  📤 Uploading to Mux: ${filename}`)

  // Create a direct upload URL
  const upload = await mux.video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      encoding_tier: 'baseline',
    },
  })

  // Upload the file via PUT
  const fileBuffer = fs.readFileSync(filePath)
  const response = await fetch(upload.url, {
    method: 'PUT',
    body: fileBuffer,
    headers: {
      'Content-Length': String(fileBuffer.length),
    },
  })

  if (!response.ok) {
    throw new Error(`Mux upload failed: ${response.status} ${response.statusText}`)
  }

  // Poll until the upload is complete and asset is created
  console.log(`  ⏳ Waiting for Mux to process...`)
  let asset = null
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 3000))
    const uploadStatus = await mux.video.uploads.retrieve(upload.id)

    if (uploadStatus.asset_id) {
      asset = await mux.video.assets.retrieve(uploadStatus.asset_id)
      if (asset.status === 'ready' || asset.status === 'preparing') {
        // 'preparing' is fine — playback ID is assigned, video is still encoding
        break
      }
    }

    if (uploadStatus.status === 'errored') {
      throw new Error(`Mux upload errored for ${filename}`)
    }
  }

  if (!asset) {
    throw new Error(`Timed out waiting for Mux asset: ${filename}`)
  }

  const playbackId = asset.playback_ids?.[0]?.id
  console.log(`  ✅ Mux Asset: ${asset.id} | Playback: ${playbackId || 'pending'}`)

  return { assetId: asset.id, playbackId, data: asset }
}

// ── Create mux.videoAsset doc and patch mediaAsset ──
async function wireMuxToSanity(mediaAssetId, muxData, filename) {
  const videoAssetId = `muxAsset-${muxData.assetId}`

  // Create the mux.videoAsset document
  const videoAssetDoc = {
    _id: videoAssetId,
    _type: 'mux.videoAsset',
    assetId: muxData.assetId,
    playbackId: muxData.playbackId || '',
    status: muxData.data.status,
    filename,
    data: muxData.data,
  }

  await sanity.createOrReplace(videoAssetDoc)

  // Patch the mediaAsset document with video reference
  await sanity.patch(mediaAssetId).set({
    video: {
      _type: 'mux.video',
      asset: {
        _type: 'reference',
        _ref: videoAssetId,
        _weak: true,
      },
    },
  }).commit()

  console.log(`  🔗 Wired ${mediaAssetId} → ${videoAssetId}`)
}

// ── Find all manifests ──
function findAllManifests(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) {
      results.push(...findAllManifests(full))
    } else if (entry === '_manifest.md') {
      results.push(full)
    }
  }
  return results
}

// ── MAIN ──
async function main() {
  console.log('\n🎬 Video Ingestion Pipeline')
  console.log('═'.repeat(50))
  if (DRY_RUN) console.log('⚠️  DRY RUN — no uploads or mutations\n')

  // Step 1: Find video assets in Sanity that need uploading
  const needsUpload = await findVideoAssetsNeedingUpload()
  console.log(`📊 Found ${needsUpload.length} video assets needing Mux upload\n`)

  if (needsUpload.length === 0) {
    console.log('✅ All video assets already have Mux videos wired.')
    return
  }

  // Step 2: Build a title → filename map from all manifests
  const manifests = singleManifest
    ? [path.resolve(singleManifest)]
    : findAllManifests(path.resolve('media'))

  const titleToFile = new Map()
  for (const m of manifests) {
    const vidMap = parseManifestForVideos(m)
    const manifestDir = path.dirname(m)
    for (const [title, filename] of vidMap) {
      titleToFile.set(title, path.join(manifestDir, filename))
    }
  }

  // Step 3: Match and upload
  let uploaded = 0
  let skipped = 0
  let failed = 0
  const failures = []

  for (const asset of needsUpload) {
    const filePath = titleToFile.get(asset.title)

    if (!filePath || !fs.existsSync(filePath)) {
      console.log(`  ⏭  Skip: ${asset.title} — file not found`)
      skipped++
      continue
    }

    const fileSizeMB = fs.statSync(filePath).size / 1024 / 1024
    if (fileSizeMB > MAX_SIZE_MB) {
      console.log(`  🐘 Deferred: ${asset.title} (${fileSizeMB.toFixed(0)} MB > ${MAX_SIZE_MB} MB limit)`)
      skipped++
      continue
    }

    if (DRY_RUN) {
      const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1)
      console.log(`  📝 Would upload: ${asset.title} (${sizeMB} MB) → ${asset._id}`)
      uploaded++
      continue
    }

    try {
      const muxData = await uploadToMux(filePath, path.basename(filePath))
      await wireMuxToSanity(asset._id, muxData, path.basename(filePath))
      uploaded++
    } catch (err) {
      console.error(`  ❌ Failed: ${asset.title} — ${err.message}`)
      failures.push(asset.title)
      failed++
    }
  }

  console.log(`\n${'═'.repeat(50)}`)
  console.log(`✅ Uploaded: ${uploaded}`)
  if (skipped > 0) console.log(`⏭  Skipped: ${skipped}`)
  if (failed > 0) {
    console.log(`❌ Failed:  ${failed}`)
    failures.forEach((f) => console.log(`   - ${f}`))
  }
  console.log(`${'═'.repeat(50)}\n`)
}

main().catch((err) => {
  console.error('❌ Video ingest failed:', err.message)
  process.exit(1)
})
