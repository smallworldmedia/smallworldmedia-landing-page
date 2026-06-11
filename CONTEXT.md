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

A curated collection representing a specific scope of creative work. Uses a Mode 1 manifest with project-specific service tags. Gets its own project page (`/work/[slug]`) with a sizzle reel as hero and editorial layout.

- **Example:** `media/Heavy House Society/Live Visuals 2026/`
- **Frontend destination:** Single Project Page (`/work/[slug]`) — `FeaturedProjectDetail`, laid out by the Content Population Hierarchy (see below)
- **Hero:** The user creates sizzle reels for featured projects; these are marked `isHero: true`

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
- Documents: `.pdf` (export deck pages as individual JPGs instead)
- Archives: `.zip`, `.rar`, `.7z`, `.dmg`

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
| **FeaturedProjects** | Dedicated page for showcasing Featured Project collections. Pulls metadata from Featured Project curated collections. | Featured Project subfolders (`isHero: true`, sizzle reels) |
| **FeaturedProjectDetail** | Orchestrator for the `/work/[slug]` Single Project Page. Renders one Featured Project collection as an editorial page via the Content Population Hierarchy. | All `mediaAsset` docs sharing one `sourceFolder` + optional `project` doc |
| **SiteNav** | Fixed top navigation bar — globe, info pill, sitemap links. | Static |
| **ClientPanel** | Full-width blue info band below the nav: squeezed project title, client metadata chips (client_type, based_in), social links. | `client` document |
| **MediaSlot** | Single media container on the project page. Variants: `full` (full-bleed 16:9) and `split` (half-width, paired in a row). Mux HLS for video, Sanity CDN for stills, lazy + load-gated. | Single `mediaAsset` document |
| **ServiceTag** | Canonical display pill for a service tag — blue bg, black mono lowercase text. Display-only (FilterBar pills are the interactive variant). | Single `serviceTag` reference |
| **SiteFooter** | Simple footer — near-black bar with SWM globe mark + copyright. Expanded variant with footer nav is a future iteration. | Static |
| **AlbumArtOrbit** | *Future* — orbiting album art component, populated only when a project directory carries album-art assets. | `album-art` assets within a collection |
| **NextProjectCard** | *Future* — scroll-to-next-project transition at the bottom of FeaturedProjectDetail (three scroll states mocked in Figma). | Next Featured Project hero |

> **Procedure**: Before creating any new component, check this table. If the component doesn't have a canonical name, propose one here first, get it approved, then implement.

## Content Population Hierarchy

The system that turns a Featured Project directory's contents into a page layout. **Pages are populated, not authored** — the manifest/tagging metadata set at ingestion is the layout instruction set. This is why the manifest system records `sortOrder`, `isHero`, `mediaType`, and `contentRole` on every asset.

| Metadata | Layout role |
|---|---|
| `sourceFolder` / `sourceManifest` | Grouping key — defines which assets belong to the project page |
| `isHero` | The sizzle reel — always the first full-bleed slot |
| `sortOrder` | Manifest row order — the sequence assets flow into slots |
| `mediaType` / aspect ratio | Slot sizing — landscape can go full-bleed; portrait/square always pairs into split rows |
| `contentRole` | Flow membership — showcase (empty) populates the main flow; `process`/`supporting` reserved for the future BTS section |
| `album-art` mediaType | Held out of the flow — populates the future AlbumArtOrbit when present in the directory |

**Flow algorithm** (`buildContentFlow.js`): after the hero and blurb, showcase assets alternate full-bleed → split pair → full-bleed →… Portrait assets never render full-bleed. Projects with more videos naturally get more full-bleed slots; still-heavy projects pair into split rows. Media-type-specific components populate based on presence in the directory.

**Editorial copy layer**: an optional `project` document (slug = `{client-slug}-{collection-slug}`, e.g. `heavy-house-society-live-visuals-2026`) supplies the overview blurb and display title. Without it the page falls back to the collection name and omits the blurb. The `project.contentBlocks` page-builder remains available as a manual override for hand-curated layouts (not yet wired).

## Route Map

| Route | Page | Component |
|---|---|---|
| `/` | Landing page | `LandingPage` |
| `/work` | Project Directory (full media grid) | `ProjectDirectory` |
| `/work/featured` | Featured Projects (curated showcase) | `FeaturedProjects` |
| `/work/[slug]` | Single Project Page (editorial layout) | `FeaturedProjectDetail` |
