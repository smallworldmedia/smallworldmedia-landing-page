#!/usr/bin/env node
/**
 * migrate-year-fields.mjs — Migrate legacy year/displayTitle/overview fields
 * on project and mediaAsset documents to the new schema shape.
 *
 * Migrations:
 *   project.year           → project.yearStart  (if yearStart is unset)
 *   project.displayTitle   → parse into title + yearStart/yearEnd (if present)
 *   project.overview       → project.description (if description is unset)
 *   mediaAsset.year        → mediaAsset.yearStart (if yearStart is unset)
 *
 * After migration, the orphaned fields (year, displayTitle, overview) are
 * unset so Studio stops showing "Unknown fields found".
 *
 * Usage:
 *   node scripts/migrate-year-fields.mjs            # dry run (default-safe)
 *   node scripts/migrate-year-fields.mjs --apply    # write patches
 */
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'

// ── Load token from .env.local if not in environment ──
if (!process.env.SANITY_WRITE_TOKEN) {
  try {
    const env = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8')
    const m = env.match(/SANITY_WRITE_TOKEN="?([^"\n]+)"?/)
    if (m) process.env.SANITY_WRITE_TOKEN = m[1]
  } catch {
    // ignore
  }
}

const APPLY = process.argv.includes('--apply')
const DRY_RUN = !APPLY

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

/**
 * Try to extract a year range from a displayTitle like "Branding 2024–2025".
 * Returns { cleanTitle, yearStart, yearEnd } or null if no year pattern found.
 */
function parseDisplayTitle(raw) {
  if (!raw) return null
  // Match patterns: "Title 2024", "Title 2024–2025", "Title 2024-2025"
  const m = raw.match(/^(.+?)\s+(\d{4})\s*[–\-]\s*(\d{4})\s*$/)
  if (m) {
    return {
      cleanTitle: m[1].trim() || null,
      yearStart: parseInt(m[2], 10),
      yearEnd: parseInt(m[3], 10),
    }
  }
  // Single year: "Title 2024"
  const s = raw.match(/^(.+?)\s+(\d{4})\s*$/)
  if (s) {
    return {
      cleanTitle: s[1].trim() || null,
      yearStart: parseInt(s[2], 10),
      yearEnd: null,
    }
  }
  return null
}

async function main() {
  console.log(`\n🔄 Year-field migration ${DRY_RUN ? '(DRY RUN)' : '(APPLY)'}`)
  console.log('='.repeat(56))

  // ── PROJECTS ──
  const projects = await client.fetch(`*[_type == "project" && !(_id in path("drafts.**"))]{
    _id,
    title,
    year,
    yearStart,
    yearEnd,
    isOngoing,
    displayTitle,
    overview,
    description
  }`)

  const projectPatches = []

  for (const p of projects) {
    const sets = {}
    const unsets = []

    // 1. displayTitle → parse into title + yearStart/yearEnd
    if (p.displayTitle) {
      const parsed = parseDisplayTitle(p.displayTitle)
      if (parsed) {
        // Set title from displayTitle (only if current title is empty)
        if (!p.title && parsed.cleanTitle) {
          sets.title = parsed.cleanTitle
        }
        // Set yearStart/yearEnd from the embedded date range
        if (!p.yearStart && parsed.yearStart) {
          sets.yearStart = parsed.yearStart
        }
        if (!p.yearEnd && parsed.yearEnd) {
          sets.yearEnd = parsed.yearEnd
        }
      }
      unsets.push('displayTitle')
    }

    // 2. year → yearStart (only if yearStart isn't already set via displayTitle above)
    if (p.year && !p.yearStart && !sets.yearStart) {
      sets.yearStart = p.year
    }
    if (p.year) {
      unsets.push('year')
    }

    // 3. overview → description
    if (p.overview && !p.description) {
      sets.description = p.overview
    }
    if (p.overview) {
      unsets.push('overview')
    }

    if (Object.keys(sets).length || unsets.length) {
      projectPatches.push({ id: p._id, title: p.title || p.displayTitle || p._id, sets, unsets })
    }
  }

  console.log(`\nProjects scanned: ${projects.length}`)
  console.log(`Projects to patch: ${projectPatches.length}`)
  for (const p of projectPatches) {
    const actions = []
    for (const [k, v] of Object.entries(p.sets)) actions.push(`  SET ${k} = ${JSON.stringify(v)}`)
    for (const k of p.unsets) actions.push(`  UNSET ${k}`)
    console.log(`\n  📄 ${p.title} (${p.id})`)
    actions.forEach((a) => console.log(`    ${a}`))
  }

  // ── MEDIA ASSETS ──
  const assets = await client.fetch(`*[_type == "mediaAsset" && defined(year) && !(_id in path("drafts.**"))]{
    _id, title, year, yearStart
  }`)

  const assetPatches = []
  for (const a of assets) {
    if (a.year && !a.yearStart) {
      assetPatches.push({ id: a._id, title: a.title || a._id, yearStart: a.year })
    } else if (a.year) {
      // yearStart already set — just unset the old field
      assetPatches.push({ id: a._id, title: a.title || a._id, yearStart: null })
    }
  }

  console.log(`\nMedia assets with legacy 'year': ${assets.length}`)
  console.log(`Media assets to patch: ${assetPatches.length}`)
  if (assetPatches.length <= 20) {
    for (const a of assetPatches) {
      const action = a.yearStart ? `SET yearStart = ${a.yearStart}, UNSET year` : `UNSET year`
      console.log(`  📷 ${a.title} → ${action}`)
    }
  }

  // ── APPLY ──
  if (DRY_RUN) {
    console.log(`\nDry run — no mutations. Re-run with --apply to write.\n`)
    return
  }

  const BATCH = 50
  let done = 0

  // Patch projects
  for (let i = 0; i < projectPatches.length; i += BATCH) {
    const slice = projectPatches.slice(i, i + BATCH)
    let tx = client.transaction()
    for (const p of slice) {
      tx = tx.patch(p.id, (patch) => {
        if (Object.keys(p.sets).length) patch = patch.set(p.sets)
        if (p.unsets.length) patch = patch.unset(p.unsets)
        return patch
      })
    }
    const res = await tx.commit()
    done += slice.length
    console.log(`  ✅ Projects batch ${Math.floor(i / BATCH) + 1}: ${slice.length} (txn ${res.transactionId})`)
  }

  // Patch assets
  for (let i = 0; i < assetPatches.length; i += BATCH) {
    const slice = assetPatches.slice(i, i + BATCH)
    let tx = client.transaction()
    for (const a of slice) {
      tx = tx.patch(a.id, (patch) => {
        if (a.yearStart) patch = patch.set({ yearStart: a.yearStart })
        return patch.unset(['year'])
      })
    }
    const res = await tx.commit()
    done += slice.length
    console.log(`  ✅ Assets batch ${Math.floor(i / BATCH) + 1}: ${slice.length} (txn ${res.transactionId})`)
  }

  console.log(`\n✨ Done — ${done} documents patched.\n`)
}

main().catch((e) => {
  console.error('❌ Migration failed:', e.message)
  process.exit(1)
})
