#!/usr/bin/env node
/**
 * backfill-project-refs.mjs — Set mediaAsset.project references for assets
 * whose curated collection maps to an existing project document.
 *
 * Implements the project→media join from docs/adr/0001: matches each asset's
 * (clientSlug, sourceManifest) to a project slug via toProjectSlug(), and sets
 * the `project` reference where a matching project exists and the ref is unset
 * or different. This is a PATCH (never a re-ingest), so Mux video refs and all
 * other fields are left untouched.
 *
 * It also reports featured projects with ZERO matching assets — these are the
 * stale / mismatched docs (e.g. HHS live-visuals vs. the Branding 2026
 * collection) that need manual reconciliation (P0 step 2).
 *
 * Usage:
 *   node scripts/backfill-project-refs.mjs            # dry run (default-safe)
 *   node scripts/backfill-project-refs.mjs --apply    # write patches
 */
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'
import { toProjectSlug } from '../src/lib/projectSlug.js'

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

async function main() {
  const projects = await client.fetch(`*[_type=="project" && !(_id in path("drafts.**"))]{
    _id, "slug": slug.current, "clientSlug": client->slug.current, isFeatured
  }`)
  const bySlug = new Map(projects.map((p) => [p.slug, p]))

  const assets = await client.fetch(`*[_type=="mediaAsset" && !(_id in path("drafts.**"))]{
    _id, "clientSlug": client->slug.current, sourceManifest, "projectRef": project._ref
  }`)

  const patches = []
  const perProject = {}
  const projectHasAnyAsset = new Set()
  let alreadyOk = 0
  let skipped = 0

  for (const a of assets) {
    if (!a.clientSlug || !a.sourceManifest) { skipped++; continue }
    const slug = toProjectSlug(a.clientSlug, a.sourceManifest)
    const proj = bySlug.get(slug)
    if (!proj) continue
    projectHasAnyAsset.add(proj.slug)
    if (a.projectRef === proj._id) { alreadyOk++; continue }
    patches.push({ assetId: a._id, projectId: proj._id })
    perProject[proj.slug] = (perProject[proj.slug] || 0) + 1
  }

  console.log(`\n🔗 Project-ref backfill ${DRY_RUN ? '(DRY RUN)' : '(APPLY)'}`)
  console.log('='.repeat(56))
  console.log(`Projects: ${projects.length} (featured: ${projects.filter((p) => p.isFeatured).length})`)
  console.log(`Assets scanned: ${assets.length}`)
  console.log(`Already linked correctly: ${alreadyOk}`)
  console.log(`Would set/update refs: ${patches.length}`)
  if (skipped) console.log(`Skipped (missing client/sourceManifest): ${skipped}`)

  if (Object.keys(perProject).length) {
    console.log(`\nPer-project matches (assets to link):`)
    for (const [slug, n] of Object.entries(perProject).sort()) console.log(`  +${n}  ${slug}`)
  }

  const orphanFeatured = projects.filter((p) => p.isFeatured && !projectHasAnyAsset.has(p.slug))
  if (orphanFeatured.length) {
    console.log(`\n⚠️  Featured projects with NO matching assets (reconcile — slug ≠ collection):`)
    for (const p of orphanFeatured) console.log(`   - ${p.slug}`)
  }

  if (DRY_RUN) {
    console.log(`\nDry run — no mutations. Re-run with --apply to write.`)
    return
  }

  const BATCH = 50
  let done = 0
  for (let i = 0; i < patches.length; i += BATCH) {
    const slice = patches.slice(i, i + BATCH)
    let tx = client.transaction()
    for (const p of slice) {
      tx = tx.patch(p.assetId, (patch) =>
        patch.set({ project: { _type: 'reference', _ref: p.projectId } })
      )
    }
    const res = await tx.commit()
    done += slice.length
    console.log(`  ✅ Batch ${Math.floor(i / BATCH) + 1}: ${slice.length} (txn ${res.transactionId})`)
  }
  console.log(`\n✨ Done — ${done} mediaAsset.project refs set.`)
}

main().catch((e) => {
  console.error('❌ Backfill failed:', e.message)
  process.exit(1)
})
