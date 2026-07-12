import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';

// Built routes that shouldn't be indexed: v1-disabled redirect stubs, the
// v2-gated process page, + the Sanity Studio.
const SITEMAP_EXCLUDE = ['/work/directory', '/lab/globe', '/specimen', '/process'];

// https://astro.build/config
export default defineConfig({
  site: 'https://smallworldmedia.co',
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
