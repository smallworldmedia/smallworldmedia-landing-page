#!/usr/bin/env node
/**
 * backfill-order-rank.mjs — One-time script to set orderRank on mediaAssets
 * that have a sortOrder but no orderRank.
 *
 * The @sanity/orderable-document-list plugin requires `orderRank` for drag-
 * to-order to work.  The ingest script previously only wrote `sortOrder`;
 * this backfill bridges the gap for existing assets.
 *
 * Usage:
 *   node scripts/backfill-order-rank.mjs              # dry run
 *   node scripts/backfill-order-rank.mjs --apply      # write patches
 */
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'

// ── Load token ──
if (!process.env.SANITY_WRITE_TOKEN) {
  try {
    const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8')
    const m = env.match(/SANITY_WRITE_TOKEN="?([^"\n]+)"?/)
    if (m) process.env.SANITY_WRITE_TOKEN = m[1]
  } catch { /* ignore */ }
}

const APPLY = process.argv.includes('--apply')

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

function sortOrderToRank(sortOrder) {
  const hex = Math.max(0, sortOrder).toString(16).padStart(6, '0')
  return `0|${hex}:`
}

async function main() {
  // Find assets with sortOrder but no orderRank
  const assets = await client.fetch(
    `*[_type == "mediaAsset" && defined(sortOrder) && !defined(orderRank) && !(_id in path("drafts.**"))] {
      _id, sortOrder
    }`
  )

  console.log(`\n📊 Order Rank Backfill ${APPLY ? '(APPLY)' : '(DRY RUN)'}`)
  console.log('='.repeat(56))
  console.log(`Assets needing orderRank: ${assets.length}`)

  if (assets.length === 0) {
    console.log('✅ Nothing to do — all assets already have orderRank.')
    return
  }

  if (!APPLY) {
    console.log(`\nDry run — re-run with --apply to write ${assets.length} patches.`)
    return
  }

  const BATCH = 50
  let done = 0
  for (let i = 0; i < assets.length; i += BATCH) {
    const slice = assets.slice(i, i + BATCH)
    let tx = client.transaction()
    for (const a of slice) {
      tx = tx.patch(a._id, (p) =>
        p.set({ orderRank: sortOrderToRank(a.sortOrder) })
      )
    }
    const res = await tx.commit()
    done += slice.length
    console.log(`  ✅ Batch ${Math.floor(i / BATCH) + 1}: ${slice.length} (txn ${res.transactionId})`)
  }

  console.log(`\n✨ Done — ${done} orderRank values set.`)
}

main().catch((e) => {
  console.error('❌ Backfill failed:', e.message)
  process.exit(1)
})
