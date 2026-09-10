# Directory Structure

*Last Updated: 2026-09-09*

```
.
├── astro.config.mjs          # Astro 5 static build, React + Sanity + sitemap integrations
├── netlify.toml              # build + forced redirects (disabled routes, moved projects)
├── sanity.config.ts / sanity.cli.ts   # Studio config (structure, orderable lists)
├── CONTEXT.md                # media-library domain glossary (read first for CMS work)
├── AGENTS.md / CLAUDE.md     # pointers to docs/agents/*
├── src/
│   ├── pages/                # routes: index, process, privacy, 404, work/{index,[slug],directory}, lab/globe, specimen
│   ├── layouts/BaseLayout.astro   # head, fonts, ClientRouter, persistent SiteShell + SiteTagline
│   ├── components/
│   │   ├── *.jsx             # site chrome: SiteShell, SiteNav, SiteFooter, SiteTagline, RouteFill,
│   │   │                     #   InfoPanel, ProjectOverlay, PrivacyOverlay/Content, ClientLogoTicker,
│   │   │                     #   Hero, HeroText, LandingPage, Lenis/Footer tune panels
│   │   ├── globe/            # video globe: scene hook, geometry, shader material, schedulers, textures
│   │   ├── hero/             # hero intro, labels, overlay projection, tune panels, heroConfig
│   │   ├── work/             # /work orchestrator, WorldCard, CTA arrows, benches, directory stack
│   │   │   ├── pager/        # usePagerGesture engine + GraticulePager (scale skin)
│   │   │   ├── world/        # three.js Worlds: useWorldScene, DRUM/ATLAS/FORME grids, bands, live video
│   │   │   └── detail/       # detail page: content flow, flush grid, sockets, DeckScroller, viewers
│   │   ├── process/          # /process stage machine, scroll driver, copy, debug panel, lockup globe
│   │   ├── specimen/, lab/   # dormant routes (redirected)
│   │   └── ui/SocialButton.jsx
│   ├── lib/                  # shared: dragMomentum, overlayWipe, scramble, charCut, smoothScroll,
│   │                         #   settleResize, motion, momentum, navAccent, projectColor, projectSlug,
│   │                         #   keywords, formatYearRange, constants, sanityClient, queries, *Tune
│   ├── schemas/              # Sanity types: client, project, mediaAsset, serviceTag, globeSettings
│   ├── styles/               # global.css (tokens + chrome) + per-route sheets + *-tune.css benches
│   └── assets/               # fonts/ (woff2), client-logos/ (normalized + manifest.json), lockup svg
├── public/                   # favicons, og-image, robots, icons/ sprite + social marks
├── scripts/
│   ├── cms.mjs               # npm run cms — plan / apply / verify
│   ├── lib/cms/              # manifest, contract, runner, adapters, state
│   ├── lib/legacy-cms-guard.mjs
│   ├── test/                 # node --test suites (cms/, cms-frontend, cms-generator, legacy-cms)
│   ├── generate-manifests.mjs, prep-client-logos.mjs, prepare-compress.mjs   # live utilities
│   ├── tunables-keys.mjs, tunables-guide-html.mjs, pager-probe.mjs           # docs + probe tooling
│   ├── seed/backfill/migrate/patch/sync/upload-*.mjs, ingest*.mjs           # retired / gated
│   └── shots/                # probe screenshot dumps (untracked noise)
├── docs/                     # plans, specs, ADRs (adr/), agent conventions (agents/), tunables guide
├── media/                    # Dropbox-synced client assets; gitignored except _manifest.md
└── Client Logos/             # raw logo intake (gitignored) → scripts/prep-client-logos.mjs
```

Organizing principle: **route-per-island**. Each `src/components/<area>/` maps to one route and owns
its canvas hook (`use*Scene.js`), config (`*Config.js` with `?param` reads), and benches. Cross-route
behavior lives in `src/lib/` or the flat chrome components.

Noise to ignore: `dist/`, `.astro/`, `.sanity/`, `.scratch/`, `.netlify/`, `node_modules/`,
`scripts/shots/`, loose mockup PNG/SVG/OTF files at the repo root.
