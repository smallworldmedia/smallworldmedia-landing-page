# Directory Structure

*Last Updated: 2026-11-20*

```
.
├── astro.config.mjs          # Astro 5 static build, React + Sanity + sitemap integrations
├── netlify.toml              # build, immutable cache on hashed /_astro/*, forced redirects (disabled routes, moved projects)
├── sanity.config.ts / sanity.cli.ts   # Studio config (structure, orderable lists; the per-project asset lists are src/studio/ panes since US-10)
├── CONTEXT.md                # media-library domain glossary (read first for CMS work)
├── AGENTS.md / CLAUDE.md     # pointers to docs/agents/*
├── src/
│   ├── pages/                # routes: index, process, privacy, terms, 404, work/{index,[slug],directory}, lab/{globe,loader}, specimen
│   ├── layouts/BaseLayout.astro   # head, fonts, the colour-scheme latch, ClientRouter, persistent SiteShell + SiteTagline + SiteScheme
│   ├── layouts/homeWarm.js        # the way home: warm copy of / for the router (SQ-33, ?homewarm)
│   ├── components/
│   │   ├── *.jsx             # site chrome: SiteShell, SiteNav, SiteFooter, SiteTagline, RouteFill,
│   │   │                     #   InfoPanel, ProjectOverlay, PrivacyOverlay/Content, ClientLogoTicker,
│   │   │                     #   Hero, HeroText, LandingPage, Lenis/Footer tune panels,
│   │   │                     #   SiteScheme (the colour-scheme corner pager) + schemeSwatches.jsx (its art: the eye and its globe irises)
│   │   ├── siteSchemeLogic.js    # SiteScheme's pure half (stations, wheel guard, the globe's strips for the project iris, ?scheme* dials)
│   │   ├── globe/            # video globe: scene hook, geometry, shader material, schedulers,
│   │   │                     #   textures, population modes (world pools, patterns, director, tile swaps,
│   │   │                     #   name strips, popConfig), media spans (unitSpan, mediaClass),
│   │   │                     #   clip fetch-ahead (streamPrefetch)
│   │   ├── hero/             # hero intro, labels, overlay projection, tune panels, heroConfig
│   │   ├── work/             # /work orchestrator, WorldCard, CTA arrows, benches, video recipes (useHls, imageConfig)
│   │   │   ├── pager/        # usePagerGesture engine + GraticulePager (scale skin)
│   │   │   ├── world/        # three.js Worlds: useWorldScene, DRUM/ATLAS/FORME grids, bands, live video, worldRamp (spectrum's line ramp)
│   │   │   ├── detail/       # detail page: content flow, tile units (tileGrid), flush grid, sockets, DeckScroller, viewers
│   │   │   └── directory/    # /work/directory: DirectoryPage, grid, filter + FilterTag, serviceGroups, player gate, tiles, bench
│   │   ├── process/          # /process stage machine, scroll driver, copy, debug panel, lockup globe
│   │   ├── specimen/, lab/   # dormant routes (redirected)
│   │   └── ui/               # SocialButton, CheckIndicator (the house check marks), useScrollThumb (the drawer's thumb), GlobeLoader (the globe loader)
│   ├── lib/                  # shared: dragMomentum, overlayWipe, scramble, charCut, smoothScroll,
│   │                         #   settleResize, motion, touchTune, rubberBand, blurbHold(+Math), momentum,
│   │                         #   gestureHistory, historyLog (the ?histlog=1 history HUD),
│   │                         #   navAccent, projectColor, colorScheme (the site colour scheme), spectrumDeal
│   │                         #   (the build-time spectrum deal), spectrumRamp (ramp A for the WebGL scenes), projectSlug,
│   │                         #   mediaSequence, keywords, formatYearRange, constants, sanityClient,
│   │                         #   queries, buildMemo, siteCopy, directoryData, clientCoverage, scrollKick, *Tune,
│   │                         #   setHero (which sets may lead a project page; the Studio reads it too)
│   ├── studio/               # Studio-only (US-10): ProjectAssetsPane (one row per piece or set), ReorderList,
│   │                         #   SetFormInput (a Set's media), setRows (pure ordering), useProjectRows (listen + write)
│   ├── schemas/              # Sanity types: client, project, mediaAsset, mediaSet (a set, US-10), serviceTag,
│   │                         #   globeSettings + siteSettings (two singletons)
│   ├── styles/               # global.css (tokens + chrome) + pager-scale.css (the graticule pager's skin) + site-scheme.css (the corner pager's seat and its eye)
│   │                         #   + scheme.css (the black and blue colour schemes and the parked spectrum, every rule under html[data-scheme]), all four loaded by the layout in that order
│   │                         #   + per-route sheets (media-slot.css is shared by
│   │                         #   the detail grid and the directory) + *-tune.css benches
│   ├── data/                 # directory-logos/ (baked white marks) + directory-logos.json (11-05) and
│   │                         #   directory-alpha.json (measured transparency, SQ-20); all written by
│   │                         #   scripts/prep-directory-logos.mjs only
│   └── assets/               # fonts/ (woff2), client-logos/ (normalized + manifest.json), lockup svg
├── public/                   # favicons, og-image, robots, icons/ sprite + social marks
├── scripts/
│   ├── cms.mjs               # npm run cms — plan / apply / verify
│   ├── cms-sets-migration.mjs   # US-10: writes the sets migration's --changes request files (read-only)
│   ├── cms-sets-migration-oracle.mjs   # US-10: pre-apply oracle, one migration file over a live snapshot (read-only)
│   ├── lib/cms/              # manifest, contract, runner, adapters, state, audit, sets (Set ids and keys)
│   ├── lib/legacy-cms-guard.mjs
│   ├── lib/unitGates.mjs, lib/netReport.mjs   # globe-probe's pure gate modules (media spans; the video diet)
│   ├── lib/scheme-gate.mjs   # scheme-probe's pure gates (colour maths, the page gates, the corner widget's twenty-two, `midChange` the latest, SQ-132)
│   ├── lib/scheme-leak-probe.mjs   # SQ-113's scheme-flip memory probe (one arm per fresh browser; measurement only)
│   ├── lib/plateauGate.mjs   # memory-probe's pure gates: a sampled count plateaus or climbs (SQ-129); the opening step stays under a cap (`stepGate`, SQ-133); the resting footprint plateaus over hold rounds (`roundGate`, SQ-136)
│   ├── lib/navWipeGate.mjs, lib/legalScrollGate.mjs   # nav-wipe-probe's and legal-scroll-probe's pure gates
│   ├── lib/restoreFlashGate.mjs   # history-probe's /work return gate: no first-World frame or media before the restored card (SQ-131)
│   ├── lib/logoInk.mjs       # sharp logo analysis for prep-directory-logos (key, trim, hold, twins)
│   ├── baselines/globe-units.json             # globe-probe's per-key records (written by --record-baseline only)
│   ├── test/                 # node --test suites (cms/, cms-frontend, cms-generator, legacy-cms,
│   │                         #   globe-worlds, footer-reveal, build-memo, flush-grid, directory, large-grid, scroll-kick, color-scheme, scheme-gate,
│   │                         #   scheme-css, spectrum-deal, spectrum-ramp, nav-accent, globe-scheme, world-scheme, site-scheme,
│   │                         #   set-order: a detail page's sets in Studio order; set-hero, set-hero-flow: a set as the hero;
│   │                         #   studio-set-rows: the Studio's set rows and moves; cms/sets, cms/sets-migration)
│   ├── generate-manifests.mjs, prep-client-logos.mjs, prep-directory-logos.mjs, prepare-compress.mjs   # live utilities
│   ├── tunables-keys.mjs, tunables-guide-html.mjs, pager-probe.mjs, process-probe.mjs, globe-probe.mjs, layout-probe.mjs, scroll-kick-probe.mjs, scheme-probe.mjs   # docs + probe tooling
│   ├── palette-measure.mjs   # colour-family shares of an image (OKLCH classifier; the scheme probe's shares gate imports it)
│   ├── media-load-probe.mjs  # how long a media tile sits in view unpainted while a page scrolls (a measurement, not a gate)
│   ├── memory-probe.mjs      # does any resource count climb per globe world or scheme flip (SQ-129, the iPhone tab-kill hunt); bisect arms (SQ-133), reclaim readings (SQ-134) and hold-and-cycle rounds with a globe-only arm (SQ-136)
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
