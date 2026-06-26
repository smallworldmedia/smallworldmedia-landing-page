#!/usr/bin/env node
/**
 * strip-hero-flags.mjs — Remove ALL isHero flags from mediaAsset documents.
 *
 * The isHero field has been retired. First-in-order (orderRank asc) IS the
 * hero — no flag needed. This script unsets every remaining isHero field.
 *
 * DRY RUN by default. Pass --commit to actually mutate.
 *
 *   node scripts/strip-hero-flags.mjs          # preview
 *   node scripts/strip-hero-flags.mjs --commit # apply
 */
import { createClient } from '@sanity/client';
import fs from 'fs';
import path from 'path';

const COMMIT = process.argv.includes('--commit');

// ── Load token from .env.local if not in environment ──
if (!process.env.SANITY_WRITE_TOKEN) {
  try {
    const envLocal = fs.readFileSync(
      path.resolve(process.cwd(), '.env.local'),
      'utf-8'
    );
    const match = envLocal.match(/SANITY_WRITE_TOKEN="?([^"\n]+)"?/);
    if (match) process.env.SANITY_WRITE_TOKEN = match[1];
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
});

async function run() {
  const assets = await client.fetch(`
    *[_type == "mediaAsset" && defined(isHero) && !(_id in path("drafts.**"))] {
      _id,
      title,
      isHero,
      sourceFolder
    }
  `);

  console.log(`Found ${assets.length} assets with isHero field defined\n`);

  if (assets.length === 0) {
    console.log('✅ Nothing to do — no isHero flags remain.\n');
    return;
  }

  for (const a of assets) {
    const folderShort = (a.sourceFolder || '').split('/media/')[1] || a.sourceFolder || 'unknown';
    console.log(`  🗑️  "${a.title}" (${folderShort}) — isHero: ${a.isHero}`);
  }

  console.log(`\n────────────────────────────────────`);
  console.log(`Total: ${assets.length} fields to unset`);

  if (!COMMIT) {
    console.log('\n🔒 DRY RUN — no changes made. Pass --commit to apply.\n');
    return;
  }

  console.log('\n⏳ Stripping isHero from all assets...');

  for (const a of assets) {
    await client.patch(a._id).unset(['isHero']).commit();
  }

  console.log(`\n✅ Done. Removed isHero from ${assets.length} documents.\n`);
}

run().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
