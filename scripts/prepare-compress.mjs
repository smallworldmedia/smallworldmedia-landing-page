#!/usr/bin/env node
import fs from 'fs'
import path from 'path'

const mediaDir = path.resolve('media')
const targetDir = path.resolve('media/_TO_COMPRESS')

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v'])
function isVideo(filename) {
  return VIDEO_EXTS.has(path.extname(filename).toLowerCase())
}

function findAllManifests(dir) {
  const results = []
  for (const entry of fs.readdirSync(dir)) {
    // Avoid recursion into targetDir itself
    if (entry === '_TO_COMPRESS' || entry.startsWith('.')) continue
    const full = path.join(dir, entry)
    if (fs.statSync(full).isDirectory()) {
      results.push(...findAllManifests(full))
    } else if (entry === '_manifest.md') {
      results.push(full)
    }
  }
  return results
}

function parseManifestForVideos(manifestPath) {
  if (!fs.existsSync(manifestPath)) return new Map()
  const raw = fs.readFileSync(manifestPath, 'utf-8')
  const lines = raw.split('\n')
  const map = new Map()
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
        map.set(row.title || row.file, row.file)
      }
      continue
    }
    if (inTable && !trimmed.startsWith('|') && trimmed.length > 0) {
      inTable = false
    }
  }
  return map
}

async function run() {
  const manifests = findAllManifests(mediaDir)
  const mapping = {}
  let copiedCount = 0

  for (const m of manifests) {
    const vidMap = parseManifestForVideos(m)
    const manifestDir = path.dirname(m)
    for (const [title, filename] of vidMap) {
      const filePath = path.join(manifestDir, filename)
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        const sizeMB = stats.size / 1024 / 1024
        if (sizeMB > 100) {
          const destPath = path.join(targetDir, filename)
          console.log(`Copying: ${filename} (${sizeMB.toFixed(1)} MB)`)
          fs.copyFileSync(filePath, destPath)
          
          // Store relative path to workspace root
          const relativeSource = path.relative(process.cwd(), filePath)
          mapping[filename] = relativeSource
          copiedCount++
        }
      }
    }
  }

  fs.writeFileSync(
    path.join(targetDir, 'mapping.json'),
    JSON.stringify(mapping, null, 2),
    'utf-8'
  )
  console.log(`\nDone! Copied ${copiedCount} files to media/_TO_COMPRESS`)
  console.log(`Mapping saved to media/_TO_COMPRESS/mapping.json`)
}

run().catch(console.error)
