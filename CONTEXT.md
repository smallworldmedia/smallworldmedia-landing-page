# SWM Media Architecture — Domain Glossary

> Source of truth for terminology and structural rules governing the media library.
> Updated inline during design sessions. Not a spec — purely a glossary.

---

## Media Directory

The physical folder tree of client assets, located at `media/` inside the workspace. Synced via Dropbox. All media files are gitignored; only `_manifest.md` files are tracked.

## Client Folder

A top-level directory inside `media/` representing a single client (e.g., `media/Heavy House Society/`). Client folders are **flat by convention** — all root-level files belong to the client's general asset pool. If a file exists inside a subfolder, it belongs to a **Curated Collection**, not to the root.

## Curated Collection

Any subfolder within a Client Folder. Contains its own `_manifest.md` and a set of thematically related assets. There are two kinds:

### Artwork Catalog

A curated collection of album art covers for a record label client. Uses a Mode 1 manifest with `services: album art`. Powers the **Record Crate Browse** (HorizontalShowcase) component on the frontend. Does **not** get a sizzle reel, hero, or project page.

- **Canonical folder name:** `Artwork/` (case-insensitive). This is the detection signal — any subfolder named "Artwork" is auto-classified as an artwork catalog.
- **Example:** `media/Heavy House Society/Artwork/`
- **Asset type:** Square album art JPEGs (3000×3000px source, ingested as `album-art` mediaType)
- **Frontend destination:** HorizontalShowcase component, consumed from `showcaseGallery`

### Featured Project

A curated collection elevated to a first-class showcase by a `project` document with `isFeatured == true`. The **project doc is the control surface**: it owns membership in the Featured Projects experience, display order, and editorial copy — its media is the backing collection's assets.

- **Definition source:** `project.isFeatured` (membership) + `project.sortOrder` (order), authored in Sanity. *Not* derived from assets.
- **Invariant:** every Featured Project collection must have a `project` doc carrying its blurb/editorial copy. *(Some are currently missing — backfill required.)*
- **Hero:** the collection's sizzle reel (`isHero: true`) is the project's hero media — it is no longer what *defines* "featured".
- **Example collection:** `media/Heavy House Society/Branding 2026/`
- **Frontend destination:** the Featured Projects experience + Single Project Page (`/work/[slug]`) — `FeaturedProjectDetail`, laid out by the Content Population Hierarchy (see below)
- _Avoid_: defining "featured" by the existence of an isHero sizzle reel (the legacy collection-first model, now superseded)

## Root Manifest

A Mode 2 `_manifest.md` at the root of a Client Folder. Each row specifies its own `serviceType` because root assets are a mix of branding, promo, social, etc. All root manifest assets have `isHero: false`.

## Content Role

A classification on `mediaAsset` documents that controls frontend visibility. The field is **optional** — when not set, the asset is treated as **showcase** (the default).

| Value | Meaning | Portfolio grid | Project page |
|-------|---------|---------------|-------------|
| *(empty)* | Showcase — polished deliverables | ✅ Visible | ✅ Visible |
| `process` | Behind-the-scenes — screen recordings, exports, WIPs | ❌ Excluded | ✅ Visible (BTS section) |
| `supporting` | Contextual — event photos, reference shots | ❌ Excluded | ✅ Visible |

## Service Tag

A Sanity `serviceTag` document representing a service SWM offers (e.g., "Branding", "3D Animation"). Assets reference service tags to power portfolio filtering. Service tags are **what you sell** — never use them for metadata roles like "process" or "supporting" (that's what Content Role is for).

## Cross-Tagging

The practice of assigning multiple service tags to a single asset when the work genuinely spans services. Example: HHS logo animations are tagged `live visuals` + `branding` + `3d animation` because the work serves all three. Applied on a case-by-case basis — not every asset in a multi-service project gets every tag.

## Manifest Modes

### Mode 1 (Curated Collection)

Header-level `services:` field applies to all rows. Used in Artwork Catalogs and Featured Projects where every asset shares the same service context.

### Mode 2 (Client Root)

Per-row `serviceType` column. Used in Root Manifests where assets span different services.

## File Exclusion Rules

Only web-ready media is ingested. The generator script and ingestion pipeline skip everything else.

**Ingestible:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.svg`, `.mp4`, `.mov`, `.webm`

**Excluded:**
- System files: `.DS_Store`, `Thumbs.db`, `.dropbox`
- Source/project files: `.psd`, `.ai`, `.aep`, `.prproj`, `.blend`, `.indd`
- RAW photos: `.arw`, `.cr2`, `.dng`, `.nef`, `.orf`
- Audio: `.wav`, `.mp3`, `.aif`, `.flac`
- Documents: `.pdf` (export deck pages as individual JPGs — see **PDF → JPEG Pipeline** below)
- Archives: `.zip`, `.rar`, `.7z`, `.dmg`

## PDF → JPEG Pipeline

Brand decks and pitch decks are delivered as PDFs but cannot be ingested directly (PDFs are excluded). Instead, each PDF must be **separated into per-page JPEGs** before ingestion.

**Workflow (pending):**
1. Identify all brand deck / pitch deck PDFs in the media directory
2. Export each page as a standalone JPEG (e.g., `bedouin-brand-guidelines_01.jpg`, `_02.jpg`, …)
3. Create or update the manifest with one row per page, using `mediaType: brand-deck`
4. Ingest normally — the **BrandDeckViewer** component renders the pages as an accordion

**Known PDFs awaiting conversion:**
- `Andhera/DEVELOPED Artist Workshop/` — DEVELOPED Pitch Deck
- `Andhera/Branding/` — Step & Repeat Pattern
- `Bedouin/` — Bedouin Brand Guidelines, Human By Default Brand Guidelines, Saga Brand Guidelines

> The 5 orphan `mediaAsset` docs that were created from these PDFs in a legacy ingestion were deleted on 2026-06-11.

## Folder Flattening

The one-time process of collapsing organizational subfolders (that are not Artwork Catalogs or Featured Projects) into the client root. Completed in Phase 9. After flattening, the only subfolders that remain are intentional Curated Collections.

---

## Frontend Component Vocabulary

Canonical names for UI components. All implementation work **must** use these terms. When building or iterating on a component, verify it against this table before naming files or variables.

| Component | Role | Data Source |
|---|---|---|
| **ProjectDirectory** | Top-level orchestrator for the `/work` route. Manages filter state, progressive loading, and lightbox. | All `mediaAsset` documents (excluding `album-art`) |
| **MediaGrid** | Responsive, aspect-ratio-aware CSS grid container. Uses `grid-auto-flow: dense` for packing. | Filtered asset array from ProjectDirectory |
| **MediaCard** | Individual grid cell. Handles image display and auto-playing Mux video previews. Duotone hover overlay with dynamic metadata. | Single `mediaAsset` document |
| **AlbumArtTicker** | Horizontal auto-scrolling ticker for album art collections. Populates inline within the MediaGrid. | `album-art` mediaType assets, grouped by client |
| **FilterBar** | Horizontal scrollable strip of service tag pills. Sticky below header while scrolling. | `serviceTag` documents |
| **Lightbox** | Full-screen overlay for detailed asset viewing. Video mode with sound; image mode with full resolution. | Single `mediaAsset` (triggered from MediaCard) |
| **FeaturedProjects** | Page orchestrator for the immersive Featured Projects experience: paginates vertically through featured projects, owns the shared WebGL canvas + pager, and receives the Envelopment hand-off from the home globe. *(Supersedes the legacy isHero-driven showcase.)* | `project` docs where `isFeatured == true`, ordered by `sortOrder` |
| **FeaturedProjectsPreview** | The instanced, full-bleed (100vw×100vh) component that renders one featured project's **World** — the **World Shell**, floating **Tiles** across 3 depth tiers, and the identity card with the `enter_world` CTA. One instance per featured project. | One `project` + its showcase media (joined via `mediaAsset.project`) |
| **FeaturedProjectDetail** | Orchestrator for the `/work/[slug]` Single Project Page. Renders one Featured Project collection as an editorial page via the Content Population Hierarchy. | All `mediaAsset` docs sharing one `sourceFolder` + optional `project` doc |
| **SiteNav** | Fixed top navigation bar — globe, info pill, sitemap links. | Static |
| **ClientPanel** | Full-width blue info band below the nav: squeezed project title, client metadata chips (client_type, based_in), social links. | `client` document |
| **MediaSlot** | Single media container on the project page. Variants: `full` (full-bleed 16:9) and `split` (half-width, paired in a row). Mux HLS for video, Sanity CDN for stills, lazy + load-gated. | Single `mediaAsset` document |
| **ServiceTag** | Canonical display pill for a service tag — blue bg, black mono lowercase text. Display-only (FilterBar pills are the interactive variant). | Single `serviceTag` reference |
| **SiteFooter** | Simple footer — near-black bar with SWM globe mark + copyright. Expanded variant with footer nav is a future iteration. | Static |
| **BrandDeckViewer** | Renders a project's brand/pitch-deck pages (`brand-deck`, ordered by `brandDeckOrder`). In the World it floats as a single composite element (depth tier + procedural position like a Tile; in-World visual TBD); on the `/work/[slug]` detail page it renders as an expanding accordion / vertical scroll. *(Build deferred — the socket contract lands with the World.)* | `mediaAsset` docs with `mediaType: brand-deck`, grouped per project |
| **AlbumArtOrbit** | A 3D elliptical ring/carousel of a project's album-art covers, slowly auto-rotating. Floats in the World as a single composite element (depth tier + procedural position like a Tile) when the project has album art; also embeds in the `/work/[slug]` detail page. *(Build deferred — the socket contract lands with the World.)* | `album-art` assets within a collection |
| **NextProjectCard** | *Future* — scroll-to-next-project transition at the bottom of FeaturedProjectDetail (three scroll states mocked in Figma). | Next Featured Project hero |

> **Procedure**: Before creating any new component, check this table. If the component doesn't have a canonical name, propose one here first, get it approved, then implement.

### Featured Projects Preview — concepts

- **World** — one featured project's immersive scene: its World Shell, floating Tiles, and identity card. `enter_world` leaves the World for the project's detail page.
- **World Shell** — the faint, dense inverse-sphere backdrop the camera sits inside (denser lat/long than the home globe). Environment only — media does not live on it.
- **Tile** — a floating media piece (a showcase asset) suspended in the World's volume. Its spherical bend is a function of radial distance from view-center (edge Tiles curve to follow the Shell).
- **Composite element** — a media-type collection that floats in the World as a *single* element instead of many Tiles: a project's album art becomes one **AlbumArtOrbit**, its brand deck one **BrandDeckViewer**. Each occupies a depth tier and procedural position exactly like a Tile, and mounts only when the project has that media type. (No hover/overlay state — it lives in the field like any other element.)
- **Depth tier** — one of 3 discrete depth positions (Near / Mid / Far) a Tile occupies. Determines its scale, scroll parallax, and whether it can play live video (Near only). Exact Z values are tuned by live testing; X/Y within a tier is procedural (seeded per project, center kept clear for the card).
- **World Turn** — the vertical paging transition between Worlds: the current World (Shell + Tiles, as one rigid body) pitches about the X-axis, rolling up and out the top of the viewport as the next World rolls in from the bottom, with the spherical distortion exaggerated so it reads as physically travelling between Worlds. A pull-down meets elastic resistance before snapping to the next.
- **Envelopment** — the scroll transition from the home globe into the Featured Projects experience: the globe scales up to fill the viewport, fades through a solid blue/white fill, and the camera emerges inside the first World.

## Content Population Hierarchy

The system that turns a Featured Project directory's contents into a page layout. **Pages are populated, not authored** — the manifest/tagging metadata set at ingestion is the layout instruction set. This is why the manifest system records `sortOrder`, `isHero`, `mediaType`, `contentRole`, and `displayGroup` on every asset.

| Metadata | Layout role |
|---|---|
| `sourceFolder` / `sourceManifest` | Grouping key — defines which assets belong to the project page |
| `isHero` | The sizzle reel — always the first full-bleed slot |
| `sortOrder` | Manifest row order — the sequence assets flow into slots |
| `mediaType` / aspect ratio | Slot sizing — landscape can go full-bleed; portrait/square always pairs into split rows |
| `contentRole` | Flow membership — showcase (empty) populates the main flow; `process`/`supporting` reserved for the future BTS section |
| `displayGroup` | Sub-grouping — assets sharing a `displayGroup` value render adjacent on the detail page (controlled adjacency) |
| `album-art` mediaType | **Dual-feed rule** — populates both the AlbumArtOrbit (detail page) and AlbumArtTicker (project directory) |
| `brand-deck` mediaType | **Dual-feed rule** — held out of the flow; populates the BrandDeckViewer accordion (detail page) and a grouped deck presence (project directory), sorted by `brandDeckOrder` |
| `carousel-slide` mediaType | Held out of the flow — populates the to-be-built Carousel component, one carousel per `displayGroup`, slides in `sortOrder` |

### Aspect Ratio Resolution Rules

Every asset MUST carry enough metadata for the renderer to compute its native aspect ratio. The resolution cascade (defined in `buildContentFlow.js → ratioOf()`) is:

| Priority | Source | Example |
|---|---|---|
| 1 | **Mux `data.aspect_ratio`** | `"16:9"`, `"9:16"`, `"4:5"` — authoritative for video |
| 2 | **Sanity image `metadata.dimensions`** | `{ width: 3000, height: 4000 }` — authoritative for images |
| 3 | **Title-hint parsing** | Asset title containing "3x4", "9x16", "4x5" etc. |
| 4 | **`mediaType` lookup** | `static_3x4` → 3/4, `motion_9x16` → 9/16, `album-art` → 1 |
| 5 | **Fallback** | 16 / 9 (landscape default) |

**Ingestion rules:**
- Videos uploaded to Mux **must** have `data.aspect_ratio` back-synced to the `mux.videoAsset` doc. Run the Mux backfill script after any bulk video ingestion.
- Images uploaded to Sanity CDN carry dimensions automatically via `metadata.dimensions`.
- Assets with generic `mediaType` values (`motion_other`, `static_other`) **must** include a ratio hint in the title (e.g. "Framework LA 3x4") or be re-typed to a ratio-encoding value (e.g. `static_3x4`).
- The `data-portrait` attribute is applied when `ratio < 1.2` (PORTRAIT_THRESHOLD), which clamps the container to `max(ratio, 3/4)` via CSS.

### Display Group (Controlled Adjacency)

Assets within a Featured Project can be sub-grouped by setting the `displayGroup` field. All assets sharing the same `displayGroup` value render adjacent in the detail page layout — groups are ordered by the lowest `sortOrder` member within each group, and assets within a group maintain their individual `sortOrder`.

- No group headers or visual dividers are rendered — this is **controlled adjacency**, not sectioning.
- Assets with no `displayGroup` form a single implicit "ungrouped" cluster.
- The `displayGroup` value is a **kebab-case slug** set in the manifest (e.g., `coachella-set-promo`, `developed-pitch-deck`, `womens-day-carousel`) — production data uses slugs, never display strings.

### Album Art Dual-Feed Rule

Any `album-art` asset within a Featured Project collection feeds into **two** components:
1. **AlbumArtOrbit** — the orbiting component on the project detail page
2. **AlbumArtTicker** — the horizontal scrolling ticker on the project directory page

This is automatic — the `album-art` mediaType is the trigger; no additional tagging is needed.

### Brand Deck Dual-Feed Rule

Mirrors album art: any `brand-deck` asset feeds **two** contexts:
1. **BrandDeckViewer** — the expandable accordion on the Featured Project detail page / Featured Projects page
2. **Project Directory** — a grouped deck presence (one card per deck, not per page)

`mediaType: brand-deck` is the trigger; `displayGroup` (kebab-case deck slug) bounds the deck; `brandDeckOrder` sequences pages. *(Until the directory deck component exists, deck pages surface in the directory grid as individual cards.)*

### Carousel Convention

Social/editorial carousels (multi-slide posts) live in a subfolder, one image per slide. Each slide row uses `mediaType: carousel-slide`, `displayGroup` = the kebab-case slug of the carousel name (e.g. `womens-day-carousel`), and `sortOrder` sequences the slides. `buildContentFlow` holds carousel slides out of the masonry flow — reserved for the to-be-built Carousel component, which renders one carousel per `displayGroup`.

### Brand Deck Convention

Brand and pitch decks must be exported as per-page JPEGs and placed in a subfolder. The subfolder name becomes the `displayGroup`, each page uses `mediaType: brand-deck`, and `brandDeckOrder` controls page sequence. The BrandDeckViewer component renders these as an expandable accordion.

**Flow algorithm** (`buildContentFlow.js`): after the hero and blurb, showcase assets are first clustered by `displayGroup`, then within each group they alternate full-bleed → split pair → full-bleed →… Portrait assets never render full-bleed. Projects with more videos naturally get more full-bleed slots; still-heavy projects pair into split rows. Media-type-specific components (`album-art`, `brand-deck`) are separated from the flow and routed to their dedicated components.

**Editorial copy layer**: an optional `project` document (slug = `{client-slug}-{collection-slug}`, e.g. `heavy-house-society-branding-2026`) supplies the overview blurb and display title. Without it the page falls back to the collection name and omits the blurb. The `project.contentBlocks` page-builder remains available as a manual override for hand-curated layouts (not yet wired).

## Route Map

| Route | Page | Component |
|---|---|---|
| `/` | Landing page — home globe; scroll triggers **Envelopment** into `/work` | `LandingPage` |
| `/work` | **Featured Projects** — immersive sphere experience (primary work destination) | `FeaturedProjects` |
| `/work/directory` | Project Directory — full media grid + filters | `ProjectDirectory` |
| `/work/[slug]` | Single Project Page (editorial layout) | `FeaturedProjectDetail` |

> The legacy `/work/featured` (isHero-driven showcase) is retired — superseded by the project-doc-first experience at `/work`.
