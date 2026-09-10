# Architecture

*Last Updated: 2026-09-09*

## Summary

The site is a statically built Astro 5 app. Every public route is a `.astro` page that fetches its
Sanity data at build time and mounts one large React island (`client:only="react"` on `/`, `/process`;
`client:load` on `/work` and `/work/[slug]`). Each island owns a route-scoped three.js canvas plus the
route's wheel/touch model; Lenis smooth scroll is on only where the island does not own the wheel
(detail pages, /process).

Two persistent islands in `src/layouts/BaseLayout.astro` survive `ClientRouter` soft navigations:
`SiteShell` (nav, info drawer, inquiry overlay, `RouteFill`) and `SiteTagline` (tagline pill, privacy
pill + overlay). Routes talk to them only through `window` CustomEvents (`swm:*`) and `<html>` data
attributes, never through shared React state. See `communication.md`.

Cross-route transitions follow ADR-0002 "Envelopment": a route swap bridged by the persisted
`RouteFill` blue panel and `overviews_loading` bar, not a shared canvas. The leaving island dispatches
`swm:envelop`, navigates with `setTimeout` + `navigate()`, and the arriving island releases the fill.

## High-Level Diagram

```
Sanity (b60h4u7o/production) ──build-time GROQ──▶ .astro pages ──props──▶ React islands
   ▲                                                   │
   │ npm run cms (plan/apply/verify)                   ├─ /          LandingPage → Hero → VideoGlobe → useGlobeScene
media/**/_manifest.md + Mux uploads                    ├─ /work      FeaturedProjects → WorldScene → useWorldScene
                                                       ├─ /work/:slug FeaturedProjectDetail → flushGrid + DeckScroller
                                                       └─ /process   ProcessPage → useProcessScene + scroll driver
BaseLayout.astro: <ClientRouter/> + persistent SiteShell (RouteFill, InfoPanel, ProjectOverlay) + SiteTagline
              ◀──── swm:* window events + <html data-*> latches ────▶ route islands
```

## Components

| Component | Lives in | Responsibility |
|---|---|---|
| Home hero + video globe | `src/components/Hero.jsx`, `src/components/globe/`, `src/components/hero/` | Intro modes, panelized video sphere fed by Mux HLS, `enter_world` commit into /work |
| /work Worlds | `src/components/work/FeaturedProjects.jsx`, `src/components/work/world/` | One World per featured project; World Turn between them; DRUM media grid; pager (`scale` skin over `usePagerGesture`) |
| Detail page | `src/components/work/detail/` | Content Population Hierarchy → flush grid with sockets, deck/album walls, next-project band |
| /process | `src/components/process/` | Five-stage narrative: ScrollTrigger-driven stage machine reusing the globe geometry/material |
| Persistent chrome | `src/components/SiteShell.jsx`, `SiteNav.jsx`, `SiteFooter.jsx`, `SiteTagline.jsx`, `RouteFill.jsx`, overlays | Nav, drawer, inquiry form (Netlify Forms), privacy, footer reveal, route-fill bridge, logo ticker |
| Shared motion libs | `src/lib/` | `dragMomentum`, `overlayWipe`, `scramble`, `charCut`, `smoothScroll`, `settleResize` — single sources of truth |
| Data layer | `src/lib/sanityClient.js`, `src/lib/queries.js`, `src/schemas/` | Build-time fetch, GROQ, Sanity schema for the Studio at `/studio` |
| CMS toolchain | `scripts/cms.mjs`, `scripts/lib/cms/` | Preview-first ingest of manifests into Sanity + Mux; `node --test` suite |

## Data Flow

1. Build: each page runs `sanityFetch(QUERY)` (`src/lib/sanityClient.js`, CDN, drafts excluded), shapes
   the result (`buildAssetPool` for globe routes, `buildContentFlow` for /work), and passes plain props
   into the island. No client-side Sanity calls.
2. Runtime media: images via Sanity CDN / Mux thumbnails (`globe/TextureManager.js`), video via hls.js
   into a fixed `<video>` pool (`globe/VideoSlotPool.jsx`); schedulers (`LivePanelScheduler`,
   `world/worldLive.js`) promote a handful of visible tiles to live video at ~2 Hz.
3. Content ingest: `media/<Client>/<Collection>/_manifest.md` → `npm run cms plan` → approve →
   `apply` (Sanity docs + Mux uploads, journaled) → `verify`. See `cms-pipeline.md`.

## Key Decisions & Constraints

- ADRs in `docs/adr/`: 0001 project-doc-first featured projects; 0002 Envelopment route swap; 0003
  math-first composites (one geometry brain, thin renderer per surface, e.g. `work/bandLayout.js`);
  0004 /process is ScrollTrigger + house accumulator quantizer.
- Production branch is `main` and still serves the old landing page; all v1 work lives on
  `feature/v1-launch` with a stable Netlify branch preview. Merge to main is the launch.
- `/work/directory`, `/lab/globe`, `/specimen` are built but redirected at Netlify and by
  `Astro.redirect` in frontmatter; their components are dormant, not deleted.
- Every knob is a URL `?param` first, baked only on Nathan's stated value (`docs/tunables-guide.md`,
  gated by `scripts/tunables-keys.mjs --check`).
- Playwright is deliberately not a dependency; `scripts/pager-probe.mjs` resolves it from the npx cache.
