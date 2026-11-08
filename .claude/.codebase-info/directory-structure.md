# Directory Structure

*Last Updated: 2026-11-08*

```
.
├── astro.config.mjs          # Astro 5 static build, React + Sanity + sitemap integrations
├── netlify.toml              # build + forced redirects (disabled routes, moved projects)
├── sanity.config.ts / sanity.cli.ts   # Studio config (structure, orderable lists)
├── CONTEXT.md                # media-library domain glossary (read first for CMS work)
├── AGENTS.md / CLAUDE.md     # pointers to docs/agents/*
├── src/
│   ├── pages/                # routes: index, process, privacy, terms, 404, work/{index,[slug],directory}, lab/{globe,loader}, specimen
│   ├── layouts/BaseLayout.astro   # head, fonts, ClientRouter, persistent SiteShell + SiteTagline
│   ├── layouts/homeWarm.js        # the way home: warm copy of / for the router (SQ-33, ?homewarm)
│   ├── components/
│   │   ├── *.jsx             # site chrome: SiteShell, SiteNav, SiteFooter, SiteTagline, RouteFill,
│   │   │                     #   InfoPanel, ProjectOverlay, PrivacyOverlay/Content, ClientLogoTicker,
│   │   │                     #   Hero, HeroText, LandingPage, Lenis/Footer tune panels
│   │   ├── globe/            # video globe: scene hook, geometry, shader material, schedulers,
│   │   │                     #   textures, population modes (world pools, patterns, director, tile swaps,
│   │   │                     #   name strips, popConfig), media spans (unitSpan, mediaClass),
│   │   │                     #   clip fetch-ahead (streamPrefetch)
│   │   ├── hero/             # hero intro, labels, overlay projection, tune panels, heroConfig
│   │   ├── work/             # /work orchestrator, WorldCard, CTA arrows, benches, video recipes (useHls, imageConfig)
│   │   │   ├── pager/        # usePagerGesture engine + GraticulePager (scale skin)
│   │   │   ├── world/        # three.js Worlds: useWorldScene, DRUM/ATLAS/FORME grids, bands, live video
│   │   │   ├── detail/       # detail page: content flow, tile units (tileGrid), flush grid, sockets, DeckScroller, viewers
│   │   │   └── directory/    # /work/directory: DirectoryPage, grid, filter + FilterTag, player gate, tiles, bench
│   │   ├── process/          # /process stage machine, scroll driver, copy, debug panel, lockup globe
│   │   ├── specimen/, lab/   # dormant routes (redirected)
│   │   └── ui/               # SocialButton, CheckIndicator (the house check marks), useScrollThumb (the drawer's thumb), GlobeLoader (the globe loader)
│   ├── lib/                  # shared: dragMomentum, overlayWipe, scramble, charCut, smoothScroll,
│   │                         #   settleResize, motion, touchTune, rubberBand, blurbHold(+Math), momentum,
│   │                         #   navAccent, projectColor, projectSlug,
│   │                         #   mediaSequence, keywords, formatYearRange, constants, sanityClient,
│   │                         #   queries, siteCopy, directoryData, clientCoverage, *Tune
│   ├── schemas/              # Sanity types: client, project, mediaAsset, serviceTag,
│   │                         #   globeSettings + siteSettings (two singletons)
│   ├── styles/               # global.css (tokens + chrome) + per-route sheets (media-slot.css is shared by
│   │                         #   the detail grid and the directory) + *-tune.css benches
│   ├── data/                 # directory-logos/ (baked white marks) + directory-logos.json (11-05) and
│   │                         #   directory-alpha.json (measured transparency, SQ-20); all written by
│   │                         #   scripts/prep-directory-logos.mjs only
│   └── assets/               # fonts/ (woff2), client-logos/ (normalized + manifest.json), lockup svg
├── public/                   # favicons, og-image, robots, icons/ sprite + social marks
├── scripts/
│   ├── cms.mjs               # npm run cms — plan / apply / verify
│   ├── lib/cms/              # manifest, contract, runner, adapters, state, audit
│   ├── lib/legacy-cms-guard.mjs
│   ├── lib/unitGates.mjs, lib/netReport.mjs   # globe-probe's pure gate modules (media spans; the video diet)
│   ├── lib/logoInk.mjs       # sharp logo analysis for prep-directory-logos (key, trim, hold, twins)
│   ├── baselines/globe-units.json             # globe-probe's per-key records (written by --record-baseline only)
│   ├── test/                 # node --test suites (cms/, cms-frontend, cms-generator, legacy-cms,
│   │                         #   globe-worlds, footer-reveal, flush-grid, directory)
│   ├── generate-manifests.mjs, prep-client-logos.mjs, prep-directory-logos.mjs, prepare-compress.mjs   # live utilities
│   ├── tunables-keys.mjs, tunables-guide-html.mjs, pager-probe.mjs, process-probe.mjs, globe-probe.mjs, layout-probe.mjs   # docs + probe tooling
│   ├── globe-timing.mjs, globe-timing-report.mjs   # the home globe's video timing: record a run, then read it
│   ├── seed/backfill/migrate/patch/sync/upload-*.mjs, ingest*.mjs           # retired / gated
│   └── shots/                # probe screenshot dumps (untracked noise)
├── docs/                     # plans, specs, ADRs (adr/), agent conventions (agents/), tunables guide
├── media/                    # Dropbox-synced client assets; gitignored except _manifest.md + _audit-accepted.json
└── Client Logos/             # raw logo intake (gitignored) → scripts/prep-client-logos.mjs
```

Organizing principle: **route-per-island**. Each `src/components/<area>/` maps to one route and owns
its canvas hook (`use*Scene.js`), config (`*Config.js` with `?param` reads), and benches. Cross-route
behavior lives in `src/lib/` or the flat chrome components.

Noise to ignore: `dist/`, `.astro/`, `.sanity/`, `.scratch/`, `.netlify/`, `node_modules/`,
`scripts/shots/`, loose mockup PNG/SVG/OTF files at the repo root.
