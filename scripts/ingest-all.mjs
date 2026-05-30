#!/usr/bin/env node
/**
 * ingest-all.mjs — Batch-process all _manifest.md files via ingest.mjs
 *
 * Usage:
 *   node scripts/ingest-all.mjs --dry-run          # preview all manifests
 *   node scripts/ingest-all.mjs --skip-upload       # create docs, skip image uploads
 *   node scripts/ingest-all.mjs                     # full ingestion with image uploads
 *
 * Finds every _manifest.md under media/ and runs ingest.mjs on each.
 */
import { execFileSync } from 'child_process'
import { readdirSync, statSync } from 'fs'
import path from 'path'

const MEDIA_DIR = path.resolve('media')
const INGEST_SCRIPT = path.resolve('scripts/ingest.mjs')

// Forward flags
const flags = process.argv.slice(2)

// Recursively find all _manifest.md files
function findManifests(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...findManifests(full))
    } else if (entry === '_manifest.md') {
      results.push(full)
    }
  }
  return results
}

const manifests = findManifests(MEDIA_DIR).sort()
console.log(`\n🔍 Found ${manifests.length} manifests\n`)

let success = 0
let failed = 0
const failures = []

for (let i = 0; i < manifests.length; i++) {
  const m = manifests[i]
  const label = path.relative(MEDIA_DIR, m)
  console.log(`\n── [${i + 1}/${manifests.length}] ${label} ──`)

  try {
    execFileSync('node', [INGEST_SCRIPT, m, ...flags], {
      stdio: 'inherit',
      cwd: process.cwd(),
    })
    success++
  } catch (err) {
    failed++
    failures.push(label)
    console.error(`  ❌ FAILED: ${label}`)
  }
}

console.log(`\n${'═'.repeat(50)}`)
console.log(`✅ Success: ${success}/${manifests.length}`)
if (failed > 0) {
  console.log(`❌ Failed:  ${failed}`)
  failures.forEach((f) => console.log(`   - ${f}`))
}
console.log(`${'═'.repeat(50)}\n`)
