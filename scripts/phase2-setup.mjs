#!/usr/bin/env node
/**
 * phase2-setup.mjs — Set heroes and create project documents for Phase 2
 */
import { createClient } from '@sanity/client'
import fs from 'fs'
import path from 'path'

// Load token
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envLocal = fs.readFileSync(envPath, 'utf-8')
  for (const [, key, val] of envLocal.matchAll(/^(\w+)="?([^"\n]+)"?$/gm)) {
    if (!process.env[key]) process.env[key] = val
  }
}

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
})

async function main() {
  const mutations = []

  // ── 1. Set heroes for Kamino and TOBEHONEST ──
  // Kamino: Use "01 Kamino Rebrand Launch Promo" (motion) as hero
  mutations.push({
    patch: {
      id: 'mediaAsset-kamino-01-kamino-rebrand-launch-promo',
      set: { isHero: true },
    },
  })

  // TOBEHONEST: Use "Menace Animation" as hero
  mutations.push({
    patch: {
      id: 'mediaAsset-tobehonest-menace-animation',
      set: { isHero: true },
    },
  })

  // ── 2. Create project documents ──

  // Kamino
  mutations.push({
    createOrReplace: {
      _id: 'project-kamino',
      _type: 'project',
      title: 'Kamino',
      slug: { _type: 'slug', current: 'kamino' },
      client: { _type: 'reference', _ref: 'client-kamino' },
      isFeatured: true,
      year: 2025,
      blurb: 'Comprehensive brand identity and visual system for Kamino, a multi-faceted DJ/producer project. Deliverables span logo design, album artwork, animated tour posters, SoundCloud branding, merchandise mockups, and promotional video content — all unified under a bold, color-driven aesthetic.',
      services: [
        { _key: 'branding', _type: 'reference', _ref: 'serviceTag-branding' },
        { _key: 'album-art', _type: 'reference', _ref: 'serviceTag-album-art' },
        { _key: 'promo-video', _type: 'reference', _ref: 'serviceTag-promo-video' },
        { _key: 'event-tour-creative', _type: 'reference', _ref: 'serviceTag-event-tour-creative' },
        { _key: 'merch-design', _type: 'reference', _ref: 'serviceTag-merch-design' },
      ],
    },
  })

  // TOBEHONEST
  mutations.push({
    createOrReplace: {
      _id: 'project-tobehonest',
      _type: 'project',
      title: 'TOBEHONEST',
      slug: { _type: 'slug', current: 'tobehonest' },
      client: { _type: 'reference', _ref: 'client-tobehonest' },
      isFeatured: true,
      year: 2025,
      blurb: 'Brand identity and visual content for TOBEHONEST, including custom typography, logo animations, album artwork, tour poster design, and YouTube visualizers — establishing a dark, high-contrast aesthetic across all touchpoints.',
      services: [
        { _key: 'branding', _type: 'reference', _ref: 'serviceTag-branding' },
        { _key: 'album-art', _type: 'reference', _ref: 'serviceTag-album-art' },
        { _key: 'promo-video', _type: 'reference', _ref: 'serviceTag-promo-video' },
        { _key: 'event-tour-creative', _type: 'reference', _ref: 'serviceTag-event-tour-creative' },
        { _key: '2d-animation', _type: 'reference', _ref: 'serviceTag-2d-animation' },
      ],
    },
  })

  // Hurry Up Slowly
  mutations.push({
    createOrReplace: {
      _id: 'project-hurry-up-slowly',
      _type: 'project',
      title: 'Hurry Up Slowly',
      slug: { _type: 'slug', current: 'hurry-up-slowly' },
      client: { _type: 'reference', _ref: 'client-hurry-up-slowly' },
      isFeatured: true,
      year: 2026,
      blurb: 'End-to-end label identity for Hurry Up Slowly, an independent electronic music label. Deliverables include full branding system, label artwork standards, SoundCloud and Beatport platform assets, animated promotional videos, and artist-specific release artwork.',
      services: [
        { _key: 'branding', _type: 'reference', _ref: 'serviceTag-branding' },
        { _key: 'album-art', _type: 'reference', _ref: 'serviceTag-album-art' },
        { _key: 'promo-video', _type: 'reference', _ref: 'serviceTag-promo-video' },
        { _key: 'logo-design', _type: 'reference', _ref: 'serviceTag-logo-design' },
      ],
    },
  })

  // Imperfect Records
  mutations.push({
    createOrReplace: {
      _id: 'project-imperfect-records',
      _type: 'project',
      title: 'Imperfect Records',
      slug: { _type: 'slug', current: 'imperfect-records' },
      client: { _type: 'reference', _ref: 'client-imperfect-records' },
      isFeatured: true,
      year: 2026,
      blurb: 'Full brand identity and creative direction for Imperfect Records, a forward-thinking electronic music label. Deliverables encompass logo system, character-driven club illustrations, animated branding assets, album artwork, and a comprehensive brand deck establishing visual language and guidelines.',
      services: [
        { _key: 'branding', _type: 'reference', _ref: 'serviceTag-branding' },
        { _key: 'album-art', _type: 'reference', _ref: 'serviceTag-album-art' },
        { _key: 'promo-video', _type: 'reference', _ref: 'serviceTag-promo-video' },
        { _key: '2d-animation', _type: 'reference', _ref: 'serviceTag-2d-animation' },
        { _key: 'character-design', _type: 'reference', _ref: 'serviceTag-character-design' },
        { _key: 'illustration', _type: 'reference', _ref: 'serviceTag-illustration' },
      ],
    },
  })

  console.log(`\n🚀 Phase 2 Setup — ${mutations.length} mutations`)
  
  const result = await client.mutate(mutations)
  console.log(`✅ Done (txn: ${result.transactionId})`)
  console.log('   - Set hero: Kamino → 01 Kamino Rebrand Launch Promo')
  console.log('   - Set hero: TOBEHONEST → Menace Animation')
  console.log('   - Created project: Kamino')
  console.log('   - Created project: TOBEHONEST')
  console.log('   - Created project: Hurry Up Slowly')
  console.log('   - Created project: Imperfect Records')
}

main().catch((err) => {
  console.error('❌ Failed:', err.message)
  process.exit(1)
})
