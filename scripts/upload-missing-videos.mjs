#!/usr/bin/env node
/**
 * upload-missing-videos.mjs — Upload 27 identified video files to Mux
 * and wire them into their existing Sanity mediaAsset documents.
 *
 * Usage:
 *   node scripts/upload-missing-videos.mjs              # upload all
 *   node scripts/upload-missing-videos.mjs --dry-run    # preview only
 */
import Mux from '@mux/mux-node'
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'

// ── Load env ──
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envLocal = fs.readFileSync(envPath, 'utf-8')
  for (const [, key, val] of envLocal.matchAll(/^(\w+)="?([^"\n]+)"?$/gm)) {
    if (!process.env[key]) process.env[key] = val
  }
}

const MUX_TOKEN_ID = process.env.MUX_TOKEN_ID
const MUX_TOKEN_SECRET = process.env.MUX_TOKEN_SECRET
const SANITY_TOKEN = process.env.SANITY_WRITE_TOKEN

if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
  console.error('❌ Missing MUX_TOKEN_ID or MUX_TOKEN_SECRET in .env.local')
  process.exit(1)
}
if (!SANITY_TOKEN) {
  console.error('❌ Missing SANITY_WRITE_TOKEN in .env.local')
  process.exit(1)
}

const DRY_RUN = process.argv.includes('--dry-run')

const mux = new Mux({ tokenId: MUX_TOKEN_ID, tokenSecret: MUX_TOKEN_SECRET })
const sanity = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: SANITY_TOKEN,
})

const BASE = path.resolve('media')

// ── Explicit file-to-doc mapping (from audit) ──
const MAPPING = [
  // COCO Live Visuals 2025 — BG loops
  { id: 'mediaAsset-coco-bg-abstract-cloud-drip', file: 'COCO/COCO Live Visuals 2025/BG_Abstract_Cloud-Drip.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-brick-ruins', file: 'COCO/COCO Live Visuals 2025/BG_Brick-Ruins.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-cloud-timelapse', file: 'COCO/COCO Live Visuals 2025/BG_Cloud-Timelapse.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-mirror-clouds', file: 'COCO/COCO Live Visuals 2025/BG_Mirror-Clouds.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-northern-lights', file: 'COCO/COCO Live Visuals 2025/BG_Northern-Lights.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-room-with-a-view', file: 'COCO/COCO Live Visuals 2025/BG_Room-With-A-View.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-sidewalk', file: 'COCO/COCO Live Visuals 2025/BG_Sidewalk.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-bg-uk-countryside', file: 'COCO/COCO Live Visuals 2025/BG_UK-Countryside.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-cloud-cube', file: 'COCO/COCO Live Visuals 2025/Cloud-Cube.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-clouds', file: 'COCO/COCO Live Visuals 2025/Clouds.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-coco-logo-cloud-cube', file: 'COCO/COCO Live Visuals 2025/COCO-Logo_Cloud-Cube.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-coco-logo-clouds', file: 'COCO/COCO Live Visuals 2025/COCO-Logo_Clouds.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-coco-logo-mirror-clouds', file: 'COCO/COCO Live Visuals 2025/COCO-Logo_Mirror-Clouds.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-morph-cube', file: 'COCO/COCO Live Visuals 2025/Morph-Cube.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-vinyl-earth-zoom', file: 'COCO/COCO Live Visuals 2025/Vinyl_Earth-Zoom.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  // COCO Live Visuals 2025 — recordings
  { id: 'mediaAsset-coco-coco-visuals-1', file: 'COCO/COCO Live Visuals 2025/coco-visuals_1.MP4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-coco-visuals-2', file: 'COCO/COCO Live Visuals 2025/coco-visuals_2.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-coco-visuals-3', file: 'COCO/COCO Live Visuals 2025/coco-visuals_3.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  { id: 'mediaAsset-coco-coco-visuals-4', file: 'COCO/COCO Live Visuals 2025/coco-visuals_4.mp4', fixFolder: 'COCO/COCO Live Visuals 2025' },
  // Bedouin promo videos
  { id: 'mediaAsset-bedouin-brooklyn-knockdown-center-promo', file: 'Bedouin/Bedouin Promo Videos/BKC Promo/bedouin-saga_promo_v2-beat_story.mp4' },
  { id: 'mediaAsset-bedouin-saga-tulum-bedouin-account', file: 'Bedouin/Bedouin Promo Videos/Tulum Saga/saga-tulum_bedouin-account_v1.mp4' },
  { id: 'mediaAsset-bedouin-saga-tulum-saga-account', file: 'Bedouin/Bedouin Promo Videos/Tulum Saga/saga-tulum_saga-account_v3.mp4' },
  { id: 'mediaAsset-bedouin-saga-tulum-trailer-final', file: 'Bedouin/Bedouin Promo Videos/Tulum Saga/saga_tulum_trailer_final.mp4' },
  // COCO Branding 2026 — mispathed videos
  { id: 'mediaAsset-coco-the-cause-announce-video-4x5', file: 'COCO/COCO Branding 2026/Announce/4x5.mp4', fixFolder: 'COCO/COCO Branding 2026/Announce' },
  { id: 'mediaAsset-coco-the-cause-announce-video-9x16', file: 'COCO/COCO Branding 2026/Announce/9x16.mp4', fixFolder: 'COCO/COCO Branding 2026/Announce' },
  { id: 'mediaAsset-coco-the-cause-london-video-4x5', file: 'COCO/COCO Branding 2026/4x5.mp4', fixFolder: 'COCO/COCO Branding 2026' },
  { id: 'mediaAsset-coco-the-cause-london-video-9x16', file: 'COCO/COCO Branding 2026/9x16.mp4', fixFolder: 'COCO/COCO Branding 2026' },
]

// ── Upload a single video to Mux ──
async function uploadToMux(filePath, filename) {
  console.log(`  📤 Uploading to Mux: ${filename}`)

  const upload = await mux.video.uploads.create({
    cors_origin: '*',
    new_asset_settings: {
      playback_policy: ['public'],
      encoding_tier: 'baseline',
    },
  })

  const fileBuffer = fs.readFileSync(filePath)
  const response = await fetch(upload.url, {
    method: 'PUT',
    body: fileBuffer,
    headers: { 'Content-Length': String(fileBuffer.length) },
  })

  if (!response.ok) {
    throw new Error(`Mux upload failed: ${response.status} ${response.statusText}`)
  }

  console.log(`  ⏳ Waiting for Mux to process...`)
  let asset = null
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((r) => setTimeout(r, 3000))
    const uploadStatus = await mux.video.uploads.retrieve(upload.id)

    if (uploadStatus.asset_id) {
      asset = await mux.video.assets.retrieve(uploadStatus.asset_id)
      if (asset.status === 'ready' || asset.status === 'preparing') break
    }

    if (uploadStatus.status === 'errored') {
      throw new Error(`Mux upload errored for ${filename}`)
    }
  }

  if (!asset) throw new Error(`Timed out waiting for Mux asset: ${filename}`)

  const playbackId = asset.playback_ids?.[0]?.id
  console.log(`  ✅ Mux Asset: ${asset.id} | Playback: ${playbackId || 'pending'}`)
  return { assetId: asset.id, playbackId, data: asset }
}

// ── Wire Mux asset to Sanity ──
async function wireMuxToSanity(mediaAssetId, muxData, filename, patchFields) {
  const videoAssetId = `muxAsset-${muxData.assetId}`

  // Create the mux.videoAsset document
  await sanity.createOrReplace({
    _id: videoAssetId,
    _type: 'mux.videoAsset',
    assetId: muxData.assetId,
    playbackId: muxData.playbackId || '',
    status: muxData.data.status,
    filename,
    data: muxData.data,
  })

  // Patch the mediaAsset with video ref + optional sourceFolder/sourceFile fix
  const patch = {
    video: {
      _type: 'mux.video',
      asset: { _type: 'reference', _ref: videoAssetId, _weak: true },
    },
    sourceFile: filename,
    ...patchFields,
  }

  await sanity.patch(mediaAssetId).set(patch).commit()
  console.log(`  🔗 Wired ${mediaAssetId} → ${videoAssetId}`)
}

// ── MAIN ──
async function main() {
  console.log('\n🎬 Missing Video Upload — 27 assets')
  console.log('═'.repeat(55))
  if (DRY_RUN) console.log('⚠️  DRY RUN — no uploads or mutations\n')

  let uploaded = 0
  let failed = 0
  const failures = []

  for (let i = 0; i < MAPPING.length; i++) {
    const entry = MAPPING[i]
    const filePath = path.join(BASE, entry.file)
    const filename = path.basename(filePath)
    const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1)

    console.log(`\n[${i + 1}/${MAPPING.length}] ${entry.id}`)
    console.log(`  📁 ${entry.file} (${sizeMB} MB)`)

    if (DRY_RUN) {
      console.log(`  📝 Would upload → Mux → patch Sanity`)
      uploaded++
      continue
    }

    try {
      const muxData = await uploadToMux(filePath, filename)

      // Build optional patch fields for mispathed docs
      const patchFields = {}
      if (entry.fixFolder) {
        patchFields.sourceFolder = path.join(BASE, entry.fixFolder)
      }

      await wireMuxToSanity(entry.id, muxData, filename, patchFields)
      uploaded++
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`)
      failures.push(entry.id)
      failed++
    }
  }

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`✅ Uploaded: ${uploaded}`)
  if (failed > 0) {
    console.log(`❌ Failed:  ${failed}`)
    failures.forEach((f) => console.log(`   - ${f}`))
  }
  console.log(`${'═'.repeat(55)}\n`)
}

main().catch((err) => {
  console.error('❌ Upload failed:', err.message)
  process.exit(1)
})
