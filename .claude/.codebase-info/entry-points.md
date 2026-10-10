# Entry Points

*Last Updated: 2026-10-10*

## Routes

| URL | Page | Island (directive) | Data | Status |
|---|---|---|---|---|
| `/` | `src/pages/index.astro` | `LandingPage.jsx` → `Hero.jsx` (`client:only="react"`) | `GLOBE_ASSETS_QUERY` → `globe/buildAssetPool.js` | live; `body.route-home` |
| `/process` | `src/pages/process.astro` | `process/ProcessPage.jsx` (`client:only`) | same globe pool + `process/processContent.js` | live; `body.route-process` |
| `/work` | `src/pages/work/index.astro` | `work/FeaturedProjects.jsx` (`client:load`) | `FEATURED_WORLDS_QUERY` → `work/detail/buildContentFlow.js` | live |
| `/work/[slug]` | `src/pages/work/[slug].astro` | `work/detail/FeaturedProjectDetail.jsx` (`client:load`) | `FEATURED_PROJECT_PATHS_QUERY` (paths + next chain), `FEATURED_PROJECT_DETAIL_QUERY` | live |
| `/privacy` | `src/pages/privacy.astro` | none (SSR `PrivacyContent.jsx`) | static | live |
| `/404` | `src/pages/404.astro` | none | static | live |
| `/studio` | `@sanity/astro` integration | Sanity Studio | — | live, sitemap-excluded |
| `/work/directory` | `src/pages/work/directory.astro` | `work/ProjectDirectory.jsx` | grid/album/tag queries | **redirected** → `/work` |
| `/lab/globe` | `src/pages/lab/globe.astro` | `lab/VideoGlobeLab.jsx` | globe pool | **redirected** → `/` |
| `/specimen` | `src/pages/specimen.astro` | `specimen/FontSpecimen.jsx` | static | **redirected** → `/` |

Disabled pages return `Astro.redirect()` above their fetches, and `netlify.toml` adds a forced 302 so
the CDN beats Astro's meta-refresh stub. Also: `/work/homegrwxn` → `/work/rossi` (301),
`/work/bellaire` → `/work` (302).

## Layout

`src/layouts/BaseLayout.astro`: head (OG/Twitter, canonical from `Astro.site`, font preloads with
`?url` imports), `<ClientRouter />`, `global.css` + four `*-tune.css` sheets (kept at layout level on
purpose), server-computed `body.route-*` classes, skip link, hidden Netlify contact form,
`<SiteShell client:load transition:persist>` and `<SiteTagline client:load transition:persist>`,
`<div id="main"><slot /></div>`, and an inline script that runs Lenis `syncRoute()` on
`astro:page-load` and arms the `swm:returnToWork` sessionStorage flag on popstate.

## Commands

| Command | Does |
|---|---|
| `npm run dev` | `astro dev` on :4321 (`--host` for phone testing) |
| `npm run build` | `astro build` → `dist/` (24 pages; grows with featured projects) |
| `npm run preview` | serve `dist/` |
| `npm run cms -- plan|apply|verify …` | CMS ingest CLI (`scripts/cms.mjs`), see `cms-pipeline.md` |
| `npm run test:cms` | `node --test` over `scripts/test/**` |
| `node scripts/tunables-keys.mjs --check` | fails if a `?param` in code is missing from `docs/tunables-guide.md` |
| `node scripts/pager-probe.mjs …` | headless Playwright probe of `/work` pager scenarios |
| `node scripts/process-probe.mjs [--mobile] [--secs=30] [--extra="&knob=…"]` | headless probe of `/process?debug=1`: samples the S1 tour (`window.__swmProcessStats` + the live `__swmProcessPeek()`) for chip count, duplicate terms, overlaps, keep-out and each tour hold's subject vs seat. Modes: `--walk [--back]` (contact sheets + `walk.json` per beat: fps, keep-out, draw calls), `--walk --break` (`break-track.json`: reversals / overshoots), `--buried [--every=120] [--secs=150] [--cpu=4]` (chip cover on real pixels, readable namings, pick cost), `--transition` (S1→S2 camera path); `report.json` also carries `chipStats`, the scene's `?debug` chip bench (per-station fill, binds, draw calls, leader×chip crossings, bank wraps) |
| `node scripts/prep-client-logos.mjs [--check]` | normalize `Client Logos/` into `src/assets/client-logos/` |
| `node scripts/generate-manifests.mjs "Client" [--dry-run]` | scaffold TBD manifests |

Deploy: push to `feature/v1-launch` rebuilds the Netlify branch preview; a merge to `main` is the
launch. Draft deploy without touching production: `npm run build` then
`npx netlify-cli deploy --dir=dist --no-build --site <site-id>` (no `--prod`).
