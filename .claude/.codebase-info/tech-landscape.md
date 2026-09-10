# Tech Landscape

*Last Updated: 2026-09-09*

## Languages & Runtimes
- JavaScript (ESM, `"type": "module"`); React components are `.jsx`, helpers `.js`/`.mjs`.
- TypeScript only in `src/schemas/*.ts` and `sanity.config.ts` / `sanity.cli.ts`; `tsconfig.json` extends `astro/tsconfigs/strict`.
- Node for build and the CMS CLI (`node --test` for tests).

## Frameworks & Libraries

| Category | Package | Role |
|---|---|---|
| Core | `astro` 5, `@astrojs/react`, `react` 19 | Static build, islands, `ClientRouter` view transitions |
| Motion | `gsap` 3.15, `@gsap/react` | Timelines, ScrollTrigger, CustomEase, Flip, ScrambleText; `useGSAP` in components |
| 3D | `three` 0.184 | Globe, Worlds, process stage; EffectComposer + vendored lens-distortion pass |
| Scroll | `lenis` | Single instance in `src/lib/smoothScroll.js`, ticked by `gsap.ticker` |
| Video | `hls.js`, Mux (`@mux/mux-node`, `sanity-plugin-mux-input`) | HLS playback pools; Mux uploads from the CMS CLI |
| CMS | `sanity` 5, `@sanity/astro`, `@sanity/client`, `@sanity/orderable-document-list`, `@sanity/vision`, `lexorank` | Studio at `/studio`, build-time queries, drag ordering |
| Images | `sharp` | CMS probe/dimension checks, client-logo prep |
| SEO | `@astrojs/sitemap` | Sitemap with disabled-route exclusions |
| Dev | `groq-js` (only devDependency) | Evaluates real GROQ against fixtures in tests |
| Styling | `styled-components` is installed but plain CSS files under `src/styles/` are the system |

## Infrastructure
- **Hosting:** Netlify site `smallworldmedia-landingpage`, `netlify.toml` (build `npm run build`, publish `dist`, forced redirects). Production branch `main`; branch deploy for `feature/v1-launch`. Netlify Forms handles the inquiry form (hidden mirror form in `BaseLayout.astro`).
- **CMS:** Sanity project `b60h4u7o`, dataset `production`, CDN reads. Studio served by the Astro integration.
- **Video:** Mux (public playback), Sanity CDN for images.
- **Fonts:** self-hosted PP Neue Montreal + others in `src/assets/fonts/` (woff2 tracked); Inter from Google Fonts.

## Source-of-Truth Files

| Concern | File |
|---|---|
| Build + integrations | `astro.config.mjs` |
| Hosting, redirects | `netlify.toml` |
| Scripts, deps | `package.json` |
| Sanity schema + Studio structure | `src/schemas/index.ts`, `sanity.config.ts` |
| GROQ | `src/lib/queries.js` |
| Design tokens | `src/styles/global.css` |
| Tunables inventory | `docs/tunables-guide.md` (+ `scripts/tunables-keys.mjs`) |
| Media glossary | `CONTEXT.md` |
| Manifest contract | `docs/_manifest-template.md` |
| Env var names | `.env.example` (values in `.env.local`, gitignored; never commit) |

Env names in use: `SANITY_READ_TOKEN`, `SANITY_WRITE_TOKEN`, `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`,
`PLAYWRIGHT_PATH`. `PUBLIC_SANITY_*` are listed but unread (values hardcoded in config).
