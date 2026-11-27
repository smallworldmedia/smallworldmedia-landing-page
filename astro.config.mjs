import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';

// Built routes that shouldn't be indexed: v1-disabled redirect stubs + the
// Sanity Studio. (/process un-gated 08-29, disabled again for v1 11-12;
// the directory, live 11-03, at /services since 11-27.)
const SITEMAP_EXCLUDE = ['/lab/globe', '/lab/loader', '/specimen', '/process'];

// The embedded Studio is local-dev only: a production build emits no /studio, so
// the live site's /studio and /studio/* serve the 404 page (the hosted Studio,
// `sanity deploy`, is the editor). Astro's config can't see the command, but the
// CLI's argv names it.
const IS_DEV = process.argv.includes('dev');

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
      ...(IS_DEV ? { studioBasePath: '/studio' } : {}),
    }),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname.replace(/\/$/, '');
        return !SITEMAP_EXCLUDE.includes(path) && !path.startsWith('/studio');
      },
    }),
  ],
});
