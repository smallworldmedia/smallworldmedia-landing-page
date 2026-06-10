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
- **Frontend destination:** Single Project Page (`/work/[slug]`) with Sub-Nav, hero, and AdaptiveGallery
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

> **Procedure**: Before creating any new component, check this table. If the component doesn't have a canonical name, propose one here first, get it approved, then implement.

## Route Map

| Route | Page | Component |
|---|---|---|
| `/` | Landing page | `LandingPage` |
| `/work` | Project Directory (full media grid) | `ProjectDirectory` |
| `/work/featured` | Featured Projects (curated showcase) | `FeaturedProjects` |
| `/work/[slug]` | Single Project Page (editorial layout) | *TBD — future implementation* |
