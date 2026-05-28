import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sanity from '@sanity/astro';

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
  ],
});
