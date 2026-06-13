/**
 * patch-project-data.mjs — Batch-populate missing client info & project blurbs.
 *
 * Run:  node scripts/patch-project-data.mjs
 *
 * Patches two document types:
 *   1. client  — city, country, links (social URLs)
 *   2. project — description, year, services[]
 */

import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
  token: process.env.SANITY_WRITE_TOKEN,
});

/* ------------------------------------------------------------------ */
/*  CLIENT PATCHES — city, country, links                             */
/* ------------------------------------------------------------------ */

const clientPatches = [
  {
    id: 'client-kamino',
    set: {
      city: 'Brooklyn',
      country: 'United States',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/kamino' },
        { _key: 'sc', platform: 'SoundCloud', url: 'https://soundcloud.com/kamino' },
        { _key: 'bp', platform: 'Beatport', url: 'https://www.beatport.com/artist/kamino/256545' },
        { _key: 'sp', platform: 'Spotify', url: 'https://open.spotify.com/artist/1qOIMgaEjSmQJFaYWqFBli' },
      ],
    },
  },
  {
    id: 'client-tobehonest',
    set: {
      city: 'Los Angeles',
      country: 'United States',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/tobehonestmusic' },
        { _key: 'sp', platform: 'Spotify', url: 'https://open.spotify.com/artist/1DPQMEicFIQKwVViVhpPwh' },
        { _key: 'bp', platform: 'Beatport', url: 'https://www.beatport.com/artist/tobehonest/878023' },
        { _key: 'sc', platform: 'SoundCloud', url: 'https://soundcloud.com/tobehonestmusic' },
      ],
    },
  },
  {
    id: 'client-nusonido',
    set: {
      clientType: 'label',
      city: 'Miami',
      country: 'United States',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/nusonido' },
        { _key: 'sc', platform: 'SoundCloud', url: 'https://soundcloud.com/nusonido' },
        { _key: 'bp', platform: 'Beatport', url: 'https://www.beatport.com/label/nusonido/113771' },
      ],
    },
  },
  {
    id: 'client-munchietown',
    set: {
      clientType: 'brand',
      city: 'Miami',
      country: 'United States',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/munchietown' },
      ],
    },
  },
  {
    id: 'client-bellaire',
    set: {
      city: 'Lille',
      country: 'France',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/bellaire.music' },
        { _key: 'sp', platform: 'Spotify', url: 'https://open.spotify.com/artist/4q5uPGBlRmSVEVxBJpxXGP' },
        { _key: 'sc', platform: 'SoundCloud', url: 'https://soundcloud.com/bellaire-music' },
      ],
    },
  },
  {
    id: 'client-hurry-up-slowly',
    set: {
      city: 'Miami',
      country: 'United States',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/hurryupslowly' },
        { _key: 'web', platform: 'Website', url: 'https://hurryupslowly.io' },
      ],
    },
  },
  {
    id: 'client-imperfect-records',
    set: {
      city: 'Miami',
      country: 'United States',
      links: [
        { _key: 'ig', platform: 'Instagram', url: 'https://www.instagram.com/imperfect.records' },
        { _key: 'sc', platform: 'SoundCloud', url: 'https://soundcloud.com/imperfectrecords' },
      ],
    },
  },
];

/* ------------------------------------------------------------------ */
/*  PROJECT PATCHES — description, year, services[]                   */
/* ------------------------------------------------------------------ */

/** Helper — reference array for service tags */
const svcRef = (slug) => ({
  _type: 'reference',
  _ref: `serviceTag-${slug}`,
  _key: slug,
});

const projectPatches = [
  {
    id: 'project-kamino',
    set: {
      description:
        'A ground-up visual rebrand for Kamino — new logo system, custom typography, motion identity, and a full suite of promotional assets spanning social, streaming platforms, and touring collateral.',
      year: 2026,
      services: [
        svcRef('branding'),
        svcRef('logo-design'),
        svcRef('promo-video'),
        svcRef('2d-animation'),
        svcRef('event-tour-creative'),
      ],
    },
  },
  {
    id: 'project-tobehonest',
    set: {
      description:
        'End-to-end creative direction for TOBEHONEST — logo design, brand typography, album artwork, animated release promos, and touring admat across multiple headline campaigns.',
      year: 2025,
      services: [
        svcRef('branding'),
        svcRef('logo-design'),
        svcRef('album-art'),
        svcRef('promo-video'),
        svcRef('2d-animation'),
        svcRef('event-tour-creative'),
      ],
    },
  },
  {
    id: 'project-nusonido-nusonido',
    set: {
      description:
        'Immersive visual identity for Nusonido — a label and creative platform by Calussa. Includes live visual loops, 8-bit generative art, event promos, and branded motion content for Wynwood showcases and Miami Music Week.',
      year: 2025,
      services: [
        svcRef('live-visuals'),
        svcRef('promo-video'),
        svcRef('event-tour-creative'),
        svcRef('generative-media'),
      ],
    },
  },
  {
    id: 'project-munchietown-munchietown',
    set: {
      description:
        'Visual world-building for Munchietown — DJ Tennis\'s culinary and music brand. Character design, illustrated event posters, animated promos, and custom artwork for pop-up events across Miami, Mexico City, and Puerto Rico.',
      year: 2025,
      services: [
        svcRef('character-design'),
        svcRef('illustration'),
        svcRef('event-tour-creative'),
        svcRef('promo-video'),
      ],
    },
  },
  {
    id: 'project-bellaire-bellaire',
    set: {
      description:
        'Motion-forward creative for Bellaire — jazzy, soulful house producer out of Lille. Branded promo videos, event visuals, and textured motion loops built for social and live performance environments.',
      year: 2025,
      services: [
        svcRef('promo-video'),
        svcRef('event-tour-creative'),
      ],
    },
  },
  {
    id: 'project-hurry-up-slowly',
    set: {
      description:
        'Full visual identity for Hurry Up Slowly — Miami\'s immersive music and art event brand by Calussa. Brand system, logo suite, label artwork, event collateral for MMW, merchandise, and animated release promos.',
      year: 2026,
    },
  },
  {
    id: 'project-imperfect-records',
    set: {
      description:
        'Brand identity and creative toolkit for Imperfect Records — a Miami-based label. Custom logo system, animated logotypes, character-driven illustration series (Club Kids), album art templates, and promotional motion content.',
      year: 2026,
    },
  },
];

/* ------------------------------------------------------------------ */
/*  EXECUTE                                                            */
/* ------------------------------------------------------------------ */

async function run() {
  const tx = client.transaction();

  for (const { id, set } of clientPatches) {
    console.log(`  → client  ${id}`);
    tx.patch(id, (p) => p.set(set));
  }

  for (const { id, set } of projectPatches) {
    console.log(`  → project ${id}`);
    tx.patch(id, (p) => p.set(set));
  }

  const result = await tx.commit();
  console.log(`\n✓ Committed ${result.results.length} patches.`);
}

run().catch((err) => {
  console.error('✗ Mutation failed:', err.message);
  process.exit(1);
});
