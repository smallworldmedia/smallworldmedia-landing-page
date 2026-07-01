# Featured Projects Preview — Build Plan

> Phased implementation plan for the immersive Featured Projects experience at `/work`.
> **Vocabulary:** `CONTEXT.md` § "Featured Projects Preview — concepts".
> **Decisions:** `docs/adr/0001-featured-project-media-join.md`, `docs/adr/0002-envelopment-transition.md`.
> Grilled & solidified 2026-06-22.

## Summary

`/work` becomes a full-bleed WebGL experience: the camera sits **inside** a faint, dense inverse sphere (the **World Shell**). Each featured project is a **World** — its showcase assets float as **Tiles** at procedural seeded X/Y across **3 depth tiers** (Near/Mid/Far), with spherical distortion driven by radial distance from view-center. A centered identity card shows the client, project + year, service tags, and an `enter_world` CTA into the detail page. Vertical paging moves between Worlds via the **World Turn** (X-axis roll, elastic resistance → snap). The home globe hands off into `/work` via the **Envelopment** (route swap under a persistent solid-fill overlay).

## Architecture notes

- **Render:** Astro island at `/work` (`client:only="react"`), reusing the globe's modules where possible — `panelMaterial.js` (sRGB VideoTexture decode), `TextureManager`, `LivePanelScheduler` (the tiered live/still illusion), config patterns in `globeConfig.js`.
- **Video budget:** mirror the globe — only **Near** Tiles promote to live HLS (≤3 concurrent; hard cap = `MAX_LIVE`), the rest are Mux-thumbnail stills that crossfade up as they near center. **Live video suspends to stills during a World Turn** (two Worlds briefly co-present); the turn's resistance phase is the incoming World's still-preload window.
- **One World mounted at a time:** paging data-swaps the World (teardown current Tiles/textures → build next). `forceContextLoss`-grade cleanup discipline between Worlds.
- **Self-contained:** `/work` initializes "already inside" on direct load and under reduced-motion; Envelopment is additive.
- **Reduced-motion / mobile:** no auto-rotation/inertia, instant (or minimal) Turns, stills-only, fewer Tiles; reuse the globe's `PREFERS_REDUCED_MOTION` + `IS_MOBILE` patterns. Mobile perf gate before ship (globe baseline: 42–44fps iPhone).
- **SEO / a11y:** render a semantic, visually-hidden fallback (featured project list with titles + links to `/work/[slug]`) so the canvas experience is crawlable and navigable without WebGL.

## Phases

- **P0 — Data prep** (scriptable, low-risk; mutates Sanity)
  1. Backfill `mediaAsset.project` refs on featured collections — `scripts/backfill-project-refs.mjs` (patch, **never** re-ingest). Dry-run → apply.
  2. Reconcile project docs: fix the stale `heavy-house-society-live-visuals-2026` (Live Visuals folded into **Branding 2026**); confirm every featured collection has a `project` doc with copy.
  3. Install `@sanity/orderable-document-list`; set the featured `sortOrder` (drag-reorder in Studio).
- **P1 — Route + orchestrator:** `/work` (FeaturedProjects island), GROQ for featured projects + their showcase media via the reference join, vertical paging skeleton, dynamic pager, semantic fallback.
- **P2 — WorldScene (three.js):** World Shell (dense faint inverse sphere), Tiles (depth tiers, seeded XY, radial distortion). Stills first (Mux thumbnails / Sanity CDN).
- **P3 — Motion + chrome:** live-tier video (globe scheduler reuse), identity card, World Turn (GSAP timeline, elastic resistance, stills-during-turn).
- **P4 — Socket contract:** composite-element slots for `AlbumArtOrbit` / `BrandDeckViewer` — data-gated (non-empty `albumArt` / `brandDecks` from `buildContentFlow`), placed in the depth-tier system like a Tile, **stubbed** (real components deferred).
- **P5 — Transitions:** Envelopment from home (`/` → `/work`, persistent solid-fill overlay + `ClientRouter`); `enter_world` → `/work/[slug]` via the same fill bridge.

### Later (out of this build)
- ~~Build the real `AlbumArtOrbit` and `BrandDeckViewer`~~ → **spec'd & activated 2026-07-01** as its own detail-page build (Lenis + Grid Socket + momentum engine + both components): see `docs/orbit-deck-viewer-spec.md` + ADR-0003. World composite mounts remain deferred.
- Relocate the masonry grid to `/work/directory`; retire `/work/featured`.
- Wire the directory dual-feed for decks/carousels.

## Open tuning (resolved by live testing — not blockers)
- Depth-tier Z values; World Shell lat/long density (denser than the globe's 12×5); Tile count cap (~12–18/World); World Turn easing/resistance weight; live-promotion thresholds inside the sphere.
