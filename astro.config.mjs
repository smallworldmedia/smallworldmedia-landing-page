import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';

// Built routes that shouldn't be indexed: v1-disabled redirect stubs + the
// Sanity Studio. (/process un-gated 08-29, disabled again for v1 11-12;
// /work/directory 11-03.)
const SITEMAP_EXCLUDE = ['/lab/globe', '/lab/loader', '/specimen', '/process'];

// https://astro.build/config
export default defineConfig({
  site: 'https://smallworld.media',
  output: 'static',
  integrations: [
    react(),
    sanity({
      projectId: 'b60h4u7o',
      dataset: 'production',
      useCdn: true,
      studioBasePath: '/studio',
    }),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return !SITEMAP_EXCLUDE.includes(path) && !path.startsWith('/studio');
      },
    }),
  ],
});
