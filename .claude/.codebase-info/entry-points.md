# Entry Points

*Last Updated: 2026-10-08*

## Routes

| URL | Page | Island (directive) | Data | Status |
|---|---|---|---|---|
| `/` | `src/pages/index.astro` | `LandingPage.jsx` → `Hero.jsx` (`client:only="react"`) | `GLOBE_ASSETS_QUERY` → `globe/buildAssetPool.js`; `FEATURED_WORLDS_QUERY` → `globe/buildWorldPools.js` (population modes, default `tides`; branch `refine/globe-worlds`) | live; `body.route-home` |
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
| `npm run build` | `astro build` → `dist/` (22 pages) |
| `npm run preview` | serve `dist/` |
| `npm run cms -- plan|apply|verify …` | CMS ingest CLI (`scripts/cms.mjs`), see `cms-pipeline.md` |
| `npm run test:cms` | `node --test` over the CMS suites (`scripts/test/cms/`, `cms-*`, `legacy-cms`) |
| `node --test scripts/test/footer-reveal.test.mjs` | the footer reveal channel's pure pieces (`footerRise` / `footerSpan` normalization, the dial seeder incl. `ZERO_OK`, the marks window, the hero-lift maths); not in `test:cms` |
| `node --test scripts/test/globe-worlds.test.mjs` | the home globe population modes' pure pieces (world pools, patterns, director ownership, the change clock, shared streams); not in `test:cms` |
| `node scripts/tunables-keys.mjs --check` | fails if a `?param` in code is missing from `docs/tunables-guide.md` |
| `node scripts/pager-probe.mjs …` | headless Playwright probe of `/work` pager scenarios |
| `node scripts/globe-probe.mjs [--mobile] [--rm] [--next=N] [--mode=off] [--paint] [--enter] [--footer] [--channel=chrome]` | headless probe of the home globe's population modes (dev server on :4322, the worktree port): samples `window.__swmPopStats` and the `<html>` tint. It gates integrity, black tiles, texture count, quiet holds, ⏭ landing, the world changing on its own clock, and the chrome wearing the world's colour. `--paint` checks that the hero gradient fades through in-between colours. `--enter` clicks Enter World on a world other than /work's first and gates the arrival (a snap: no outgoing card, the pager at its station, the world's accent, the key consumed). It also gates the passage cover: the Enter World chrome must be out before the loading bar shows (`enterLoaderAfterCta`, no bar under `--rm`, times in `report.enter.timing`), and the cover must be fully up from World 0's server-rendered card until the entered world's card, under `--rm` too (`enterFillHeld`). The breadcrumb return must reopen the same world as a snap (`returnNoTurn`), with the cover held the same way (`returnFillHeld`). `--footer` is the only scenario here that GESTURES: forced mobile at 390×844, it scrubs the resting home footer open with real touch events and gates the whole 10-07 round — the panel's climb against the hero's lift (`liftRatio` ≈ `?footerlift`, and `liftZeroAtRest`), the CTA and globe stroke riding with it, `--footer-panel-h` published in driven mode, the client marks' measured crossing of the fold (`marksFoldCrossRise` vs `?footermarksfrom`) and their hold through a retreat (the `--footer-peak` rule), plus the on-load word entrance actually drawing from ink 0. It loads with `?intro=replay` (the `--intro` default), and the on-load SLIDE is armed only on `introMode === 'full'`, so a default run reads `slide: null` / `panelLift: 0` and does **not** exercise the rise — pass `--intro=full` to measure it, and read no earlier than the beat + `?footerslides`. The desktop resting variant needs `--extra=&footerrest=0.62`; desktop's own default is 0. Failed image requests land in `report.imageFailures`, with a CORS hint on stderr. Screenshots and the full report (`report.json`, written on failed and crashed runs too, with its path printed to stderr) go to `--out`, default `scripts/shots/globe-*` |
| `node scripts/process-probe.mjs [--mobile] [--secs=30]` | headless probe of the `/process` discovery slide: samples `window.__swmProcessStats` (published by `ProcessDebugPanel` under `?debug=1`) for chip count, duplicate terms, overlaps, and each tour hold's subject vs seat, with a screenshot per hold |
| `node scripts/prep-client-logos.mjs [--check]` | normalize `Client Logos/` into `src/assets/client-logos/` |
| `node scripts/generate-manifests.mjs "Client" [--dry-run]` | scaffold TBD manifests |

Deploy: push to `feature/v1-launch` rebuilds the Netlify branch preview; a merge to `main` is the
launch. Draft deploy without touching production: `npm run build` then
`npx netlify-cli deploy --dir=dist --no-build --site <site-id>` (no `--prod`).
