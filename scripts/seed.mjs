#!/usr/bin/env node
/**
 * seed.mjs — Seed the SWM Portfolio Sanity project with
 * service tags and client documents.
 *
 * Usage:
 *   node scripts/seed.mjs               # seed both
 *   node scripts/seed.mjs --tags-only   # seed tags only
 *   node scripts/seed.mjs --clients-only # seed clients only
 *   node scripts/seed.mjs --dry-run     # preview mutations
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

// ── CONFIG ──
const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

const DRY_RUN = process.argv.includes('--dry-run')
const TAGS_ONLY = process.argv.includes('--tags-only')
const CLIENTS_ONLY = process.argv.includes('--clients-only')

// ── Utility: kebab-case slug ──
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── SERVICE TAGS (14) ──
// Ordered as they should appear in the inquiry form.
const SERVICE_TAGS = [
  'Branding',
  'Live Visuals',
  'Album Art',
  'Event / Tour Creative',
  'Illustration',
  'Character Design',
  '2D Animation',
  '3D Animation',
  'Logo Design',
  'Web Design',
  'Audio Reactive Media',
  'Promo Video',
  'VFX',
  'Generative Media',
]

// ── CLIENTS (57) ──
const CLIENTS = [
  { name: 'Andhera Records', type: 'label' },
  { name: 'Annabel Englund', type: 'artist' },
  { name: 'Audiojack', type: 'artist' },
  { name: 'Bedouin', type: 'artist' },
  { name: 'Bellaire', type: 'artist' },
  { name: 'Calussa', type: 'artist' },
  { name: 'CID', type: 'artist' },
  { name: 'Circus Music', type: 'label' },
  { name: 'COCO', type: 'label' },
  { name: 'Detlef', type: 'artist' },
  { name: 'DJ Tennis', type: 'artist' },
  { name: "D'Witches", type: 'artist' },
  { name: 'Easier Said', type: 'label' },
  { name: 'Facu Baez', type: 'artist' },
  { name: 'Fletch', type: 'artist' },
  { name: 'Friends & Disco', type: 'promoter-event' },
  { name: 'Front Left', type: 'label' },
  { name: 'Gio Lucca', type: 'artist' },
  { name: 'Gruuv', type: 'label' },
  { name: 'Heavy House Society', type: 'label' },
  { name: 'Helix Records', type: 'label' },
  { name: 'HOMEGRWXN', type: 'label' },
  { name: 'Hurry Up Slowly', type: 'promoter-event' },
  { name: 'Imperfect Records', type: 'label' },
  { name: 'Jade Bern', type: 'artist' },
  { name: 'Jamback', type: 'artist' },
  { name: 'James Wyler', type: 'artist' },
  { name: 'Jeff Sorkowitz', type: 'artist' },
  { name: 'Jonas Blue', type: 'artist' },
  { name: 'Kamino', type: 'artist' },
  { name: 'Kyle Walker', type: 'artist' },
  { name: 'Ky William', type: 'artist' },
  { name: 'Le Yora', type: 'artist' },
  { name: 'Lee Ann Roberts', type: 'artist' },
  { name: 'Louder Than Silence', type: 'label' },
  { name: 'Malóne', type: 'artist' },
  { name: 'Maximo', type: 'artist' },
  { name: 'Momentum Records', type: 'label' },
  { name: 'MOONLGHT', type: 'artist' },
  { name: 'Munchietown', type: 'artist' },
  { name: 'Mungo Sound Machine', type: 'artist' },
  { name: 'Nusonido', type: 'label' },
  { name: 'Offstage', type: 'artist' },
  { name: 'One Of Us', type: 'label' },
  { name: 'Paige Tomlinson', type: 'artist' },
  { name: 'Panorama360', type: 'promoter-event' },
  { name: 'Pulse Artists', type: 'management' },
  { name: 'Rossi.', type: 'artist' },
  { name: 'Salomé Le Chat', type: 'artist' },
  { name: 'Sam Wolfe', type: 'artist' },
  { name: 'Short Circuit', type: 'label' },
  { name: 'Sidney Charles', type: 'artist' },
  { name: 'Sosa', type: 'artist' },
  { name: 'Sunday Brunch', type: 'promoter-event' },
  { name: 'TOBEHONEST', type: 'artist' },
  { name: 'Ultra Records', type: 'label' },
  { name: 'WIKKA', type: 'label' },
]

// ── SEED FUNCTIONS ──
async function seedServiceTags() {
  console.log('\n📌 Seeding Service Tags...')
  const mutations = SERVICE_TAGS.map((name, i) => {
    const slug = toSlug(name)
    const doc = {
      _id: `serviceTag-${slug}`,
      _type: 'serviceTag',
      name,
      slug: { _type: 'slug', current: slug },
      sortOrder: (i + 1) * 10,
    }
    return { createOrReplace: doc }
  })

  if (DRY_RUN) {
    console.log(`  [dry-run] Would create ${mutations.length} service tags:`)
    mutations.forEach((m) => console.log(`    • ${m.createOrReplace.name}`))
    return
  }

  const result = await client.mutate(mutations)
  console.log(`  ✅ Created ${mutations.length} service tags (txn: ${result.transactionId})`)
}

async function seedClients() {
  console.log('\n👥 Seeding Clients...')
  const mutations = CLIENTS.map(({ name, type }) => {
    const slug = toSlug(name)
    const doc = {
      _id: `client-${slug}`,
      _type: 'client',
      name,
      slug: { _type: 'slug', current: slug },
      clientType: type,
    }
    return { createOrReplace: doc }
  })

  if (DRY_RUN) {
    console.log(`  [dry-run] Would create ${mutations.length} clients:`)
    mutations.forEach((m) => {
      const d = m.createOrReplace
      console.log(`    • ${d.name} (${d.clientType})`)
    })
    return
  }

  const result = await client.mutate(mutations)
  console.log(`  ✅ Created ${mutations.length} clients (txn: ${result.transactionId})`)
}

// ── RUN ──
async function main() {
  console.log('🌱 SWM Portfolio Seed Script')
  console.log(`   Project: b60h4u7o | Dataset: production`)
  if (DRY_RUN) console.log('   ⚠️  DRY RUN — no mutations will be made')

  if (!CLIENTS_ONLY) await seedServiceTags()
  if (!TAGS_ONLY) await seedClients()

  console.log('\n✨ Done.')
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
