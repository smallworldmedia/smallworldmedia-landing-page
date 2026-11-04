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

- **Definition source:** `project.isFeatured` (membership) + `project.orderRank` (order), authored in Sanity. *Not* derived from assets.
- **Invariant:** every Featured Project collection must have a `project` doc carrying its blurb/editorial copy. Missing references require an explicit scoped proposal, not bulk reseeding.
- **Hero:** the first asset in the collection's `orderRank` sequence. It need not be a reel; `isHero` is retired and is not a current schema field.
- **Example collection:** `media/Heavy House Society/Branding 2026/`
- **Frontend destination:** the Featured Projects experience + Single Project Page (`/work/[slug]`) — `FeaturedProjectDetail`, laid out by the Content Population Hierarchy (see below)
- _Avoid_: defining "featured" by the existence of an isHero sizzle reel (the legacy collection-first model, now superseded)

## Root Manifest

A Mode 2 `_manifest.md` at the root of a Client Folder. Each row specifies its own `serviceType` because root assets are a mix of branding, promo, social, etc. Root intake does not assign a hero flag.

## Content Role

A classification on `mediaAsset` documents that controls frontend visibility. The field is **optional** — when not set, the asset is treated as **showcase** (the default).

| Value | Meaning | Portfolio grid | Project page |
|-------|---------|---------------|-------------|
| *(empty)* | Showcase — polished deliverables | ✅ Visible | ✅ Visible |
| `process` | Behind-the-scenes — screen recordings, exports, WIPs | ❌ Excluded | ✅ Visible (BTS section) |
| `supporting` | Contextual — event photos, reference shots | ❌ Excluded | ✅ Visible |

## Media Descriptors

The per-asset accessibility and search text on a `mediaAsset`, one pair for images and videos alike: `alt` (one line of what it shows, ≤150 characters) and `description` (fuller, ≤300, read only by screen readers and search, never shown on the page). Names people and brands the references name; never a ratio.

- _Avoid_: confusing `mediaAsset.description` with `project.description`, which is the project's editorial blurb (visible copy, uncapped). Descriptor rounds never touch blurbs.
- _Retired_: the `image.alt` subfield (never filled), replaced by the top-level `alt` on 2026-10-23.

## Service Tag

A Sanity `serviceTag` document representing a service SWM offers (e.g., "Branding", "3D Animation"). Assets reference service tags to power portfolio filtering. Service tags are **what you sell** — never use them for metadata roles like "process" or "supporting" (that's what Content Role is for).

## Cross-Tagging

The practice of assigning multiple service tags to a single asset when the work genuinely spans services. Example: HHS logo animations are tagged `live visuals` + `branding` + `3d animation` because the work serves all three. Applied on a case-by-case basis — not every asset in a multi-service project gets every tag.

## Manifest Modes

### Mode 1 (Curated Collection)

Header-level `services:` field applies to all rows. Used in Artwork Catalogs and Featured Projects where every asset shares the same service context.

### Mode 2 (Client Root)

Per-row `serviceType` column. Used in Root Manifests where assets span different services.

## CMS Intake and Editorial Authority

Manifests are versioned intake records; Sanity is the current editorial authority.
The provider-neutral `/swm:cms` workflow invokes `scripts/cms.mjs`: **scope → inspect → propose exact diff → approve → apply → verify**. See [the operational contract](docs/cms-workflow.md) and [manifest template](docs/_manifest-template.md).

- Preview reads only; explicit saved-plan approval names the project/dataset, exact document changes, uploads and publication impact. Implementation approval is not content approval.
- Approved changes target published documents only when no affected draft exists. Draft conflicts stop the operation; never automatically publish/discard drafts. A brief Studio no-edit window is required because revision checks cannot lock absent drafts or new collection members.
- Additions preserve existing editorial fields, media, release metadata, grouping values (`sourceFolder`/`sourceManifest`) and order. Explicit allowlisted `set`/`unset` patches change only approved fields.
- Optional manifest `sanityId` binds stable published identity; preserve existing IDs. Legacy matching must be unique and verified. Titles/filenames never redefine a bound identity, and title edits never implicitly rename routes. Bind selected manifests as used, not all manifests in a migration.
- New assets append in table row order after the collection's last valid `orderRank`. Invalid ranks and requested hero changes require explicit curation, never global rank resets. Legacy manifest `sortOrder`/`isHero`/`aspectRatio` values are informational only; do not add them to new scaffolds.
- Probe actual dimensions and inspect media with the available assistant; no mandatory model/provider. Use closest suitable aspect buckets, including `motion_4x3`. Placeholders and unresolved references block planning.
- Deck/carousel page paths may be nested beneath the manifest directory. PDFs require reviewed page-image exports; no path escapes or automatic whole-library execution.
- The runner integrates image/video/reel uploads, project references, readiness and aspect verification. Resume the saved run; uncertain responses require reconciliation, not duplicate uploads. CMS publication does not deploy the website.

Historical ADR-0001 names `sortOrder`; current schemas use `orderRank`. Its project-reference join decision remains in force; the older ordering field is superseded.

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

**Scoped workflow:**
1. Select the requested brand/pitch deck PDF (no whole-library sweep)
2. Export each page as a standalone JPEG and review the exports (e.g., `bedouin-brand-guidelines_01.jpg`, `_02.jpg`, …)
3. Create or update only the scoped intake with nested relative paths, `mediaType: brand-deck`, a shared `displayGroup`, and `brandDeckOrder`
4. Preview, approve and apply through the CMS runner — the **BrandDeckViewer** component renders the pages as a horizontal deck pager

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
| **FeaturedProjects** | Page orchestrator for the immersive Featured Projects experience: paginates vertically through featured projects, owns the shared WebGL canvas + pager, and receives the Envelopment hand-off from the home globe. *(Supersedes the legacy isHero-driven showcase.)* | `project` docs where `isFeatured == true`, ordered by `orderRank` |
| **FeaturedProjectsPreview** | The instanced, full-bleed (100vw×100vh) component that renders one featured project's **World** — the **World Shell**, floating **Tiles** across 3 depth tiers, and the identity card with the `enter_world` CTA. One instance per featured project. | One `project` + its showcase media (joined via `mediaAsset.project`) |
| **FeaturedProjectDetail** | Orchestrator for the `/work/[slug]` Single Project Page. Renders one Featured Project collection as an editorial page via the Content Population Hierarchy. | All `mediaAsset` docs sharing one `sourceFolder` + optional `project` doc |
| **SiteNav** | Fixed top navigation bar — globe, info pill, sitemap links. | Static |
| **ClientPanel** | Full-width blue info band below the nav: squeezed project title, client metadata chips (client_type, based_in), social links. | `client` document |
| **MediaSlot** | Single media container on the project page. Variants: `full` (full-bleed 16:9) and `split` (half-width, paired in a row). Mux HLS for video, Sanity CDN for stills, lazy + load-gated. Also the Project Directory's tile, in directory mode: a poster until the shared player gate lets the video play, the 5 s preview clip, srcset, and a `contain` fit for banners and alpha logos. | Single `mediaAsset` document |
| **ServiceTag** | Canonical display pill for a service tag — blue bg, black mono lowercase text. Display-only; the directory's filter control is **FilterTag**. | Single `serviceTag` reference |
| **DirectoryPage** | Route island for `/work/directory`, the **Project Directory**: the DirectoryFilter over the DirectoryGrid, then the SiteFooter in reveal mode. The filter lives in the URL (`?tag=a,b&client=slug`, rewritten with `replaceState`), and the drawer's client names re-filter it in place through `swm:directory-client`. | `getDirectoryData()`: the service tags, every client and the directory tiles (`DIRECTORY_QUERY`, fetched once per build) |
| **DirectoryGrid** | The directory's media grid, built on the detail grid's tile units (`tileGrid.js`): `chunkFlushGrid` blocks that stack without seams and mount only near the viewport, with one shared player gate capping the videos that play at once. A featured project's tiles link to its page; the rest are media only. | The filtered directory tiles |
| **DirectoryFilter** | The directory's sticky filter section under the nav, in the drawer's type, line height and scroll thumb: FilterTags (one row when shut, all of them when open; at ≤768 only the bar shows when shut) over a mono bar with `services (n)`, the active client's chip, the live count, `clear` and the `all_services` toggle. Opening pushes the grid down. | `serviceTag` docs in `sortOrder`, the tiles' tag presence |
| **FilterTag** | One service-tag filter: the drawer's oversized name type, a CheckIndicator box before the label (an eye inside when on, empty when off), the name in Title Case as stored. Tags OR together, and none on shows everything. | Single `serviceTag` |
| **CheckIndicator** | The shared check mark (`src/components/ui/CheckIndicator.jsx`): `circle-check` for the inquiry form, `square-eye` for FilterTag and the drawer's marked client. | Static |
| **SiteFooter** | Simple footer — near-black bar with SWM globe mark + copyright. Expanded variant with footer nav is a future iteration. | Static |
| **BandPager** | The shared band core both viewers assemble on (`BandPager.jsx`): fixed-height full-width Grid Socket occupant, pages at a slight isometric angle stacked right-of-center, transitions on the **World Turn curve** (same CustomEase + duration as Featured Project paging — one page per gesture, flicks never carry past the neighbor), idle auto-advance at the orbit cadence, depth as darkening (never opacity), top-right side column (counter + per-item content). | assets array + per-viewer side content |
| **BrandDeckViewer** | Brand/pitch-deck pages (`brand-deck`, ordered by `brandDeckOrder`) on the BandPager. Multi-deck projects get mono tab chips top-left (group order = orderRank, first tab default); the active deck's name sits under the counter in the side column. In the World it floats as a single composite element. *(World mount deferred.)* | `mediaAsset` docs with `mediaType: brand-deck`, grouped per project |
| **AlbumArtViewer** | A project's album-art covers on the BandPager — covers page exactly like deck pages (structure/animation cohesion by design; supersedes the retired 3D ring "AlbumArtOrbit", 2026-07-01). The focused cover's **ReleaseMeta** rises in the side column. Mounts only when the collection clears `ORBIT_MIN` — below it, covers fold back into the masonry flow. In the World it floats as a single composite element. *(World mount deferred.)* | `album-art` assets within a collection |
| **ReleaseMeta** | The focused cover's metadata chip stack in the AlbumArtViewer side column — scrambling artist—title headline, catalog number, date, Beatport/Spotify link buttons. Black mono chips mirroring the ClientPanel `base_in`/`client_type` family. Chips render conditionally per field; with no `releaseInfo` the asset title stands alone. (Replaces the retired Pull-out ReleaseCard panel.) | `mediaAsset.releaseInfo` on one `album-art` asset |
| **NextProjectCard** | *Future* — scroll-to-next-project transition at the bottom of FeaturedProjectDetail (three scroll states mocked in Figma). | Next Featured Project hero |
| **ProcessPage** | Route orchestrator island for `/process` — owns the Stage sections, scroll driver (ScrollTrigger, ADR-0004), copy render, and arrival choreography. *(v2 — spec'd, not built; `docs/process-page-spec.md`.)* | `processContent.js` (static) |
| **ProcessScene** | The process page's route-scoped canvas + stage machine (`useProcessScene`): 84 panel meshes morphing Fragment belt → Core → lit → expanded → rhythmic, built from the home globe primitives (ADR-0003 grammar). *(v2 — spec'd, not built.)* | none (untextured) |

> **Procedure**: Before creating any new component, check this table. If the component doesn't have a canonical name, propose one here first, get it approved, then implement.

### Featured Projects Preview — concepts

- **World** — one featured project's immersive scene: its World Shell, floating Tiles, and identity card. `enter_world` leaves the World for the project's detail page.
- **World Shell** — the faint, dense inverse-sphere backdrop the camera sits inside (denser lat/long than the home globe). Environment only — media does not live on it.
- **Tile** — a floating media piece (a showcase asset) suspended in the World's volume. Its spherical bend is a function of radial distance from view-center (edge Tiles curve to follow the Shell).
- **Composite element** — a media-type collection that floats in the World as a *single* element instead of many Tiles: a project's album art becomes one **AlbumArtOrbit**, its brand deck one **BrandDeckViewer**. Each occupies a depth tier and procedural position exactly like a Tile, and mounts only when the project has that media type. (No hover/overlay state — it lives in the field like any other element.)
- **Depth tier** — one of 3 discrete depth positions (Near / Mid / Far) a Tile occupies. Determines its scale, scroll parallax, and whether it can play live video (Near only). Exact Z values are tuned by live testing; X/Y within a tier is procedural (seeded per project, center kept clear for the card).
- **World Turn** — the vertical paging transition between Worlds: the current World (Shell + Tiles, as one rigid body) pitches about the X-axis, rolling up and out the top of the viewport as the next World rolls in from the bottom, with the spherical distortion exaggerated so it reads as physically travelling between Worlds. A pull-down meets elastic resistance before snapping to the next.
- **Envelopment** — the scroll transition from the home globe into the Featured Projects experience: the globe scales up to fill the viewport, fades through a solid blue/white fill, and the camera emerges inside the first World.

### Single Project Page — concepts

- **Grid Socket** — a reserved rectangular region in the detail-page masonry grid that dense placement flows around, occupied by a component floating on a layer *above* the grid plane with bounded overlap of neighboring tiles and subtle scroll parallax (pseudo-3D). The detail-page counterpart of the World's composite-element socket. Occupants: AlbumArtViewer and BrandDeckViewer — both full-width bands on the shared footprint. Precedence when both are present: the album band takes the prime top slot and the deck band is inserted mid-grid; a lone deck takes the top slot.
- **Pull-out** *(retired 2026-07-01 with the ring presentation)* — metadata now lives permanently in the AlbumArtViewer side column (ReleaseMeta) instead of behind a focus state.
- **Breadcrumb** — the `featured_projects` chip on every detail page; returns to `/work` and restores the World the visitor entered from (index persisted per tab in `sessionStorage`, key `swm:worldIndex`).

### Process Page — concepts

> Disambiguation: process-page terms never use bare **World** — that word is reserved for a featured project's `/work` scene (above). Here "world" appears only in copy, never as a concept name.

- **Fragment** — one of the 84 globe panels while it drifts unassembled in the Stage-1 belt: a gathered reference before it belongs to the world. Every Fragment carries its home `row`/`lonIndex` identity from birth. _Avoid_: shard, mote, particle.
- **the Thread** — the drawn stroke that shoots from the Core's center-to-be and connects Fragments dot-to-dot (trim-path draw; screen-space SVG). _Avoid_: stroke, trace, connector, line.
- **the Core** — the globe the connected Fragments pull inward to construct: the single unified concept the client's world is built from. Stage 3 gives it its identity (the blue light-up). _Avoid_: Chosen World, Seed World (retired term), winner, seed.
- **Stage** — one of the scroll-quantised scene states, each an authored time-domain transition fired at a section boundary: the five numbered Stages (`STAGE_01 discovery` → `STAGE_05 living_world`), bracketed since 2026-10-07 by the hero (the PROCESS lockup and its globe-O) and the CTA finale — seven in all (`STAGE_IDS`: `hero`, `stage-01` … `stage-05`, `cta`). _Avoid_: phase (reserved for build plans), step, section (the DOM element, not the state).
- **the BREAK** — the hero→Stage-1 transition: the lockup's globe-O winds up, hitches on one white impact frame and bursts into the Fragments, which cool into the Stage-1 belt (`processShatter` falloff; `docs/process-page-spec.md` §3 Hero).
- **the reform** — the BREAK in reverse, back up to the hero: the Fragments fly home into the O and the word returns first, the lockup taking the mark back as they land.

### Project Directory — concepts

- **Project Directory** — `/work/directory`: every published asset with an image or video, in one flush grid, filtered by service and by client. Reached from the nav's `project_directory` and the drawer's client names; `/work` still stops at its last World.
- **Directory tile** — one per asset, except grouped media: a deck, a carousel, a banner group or a sequence becomes one tile, keyed by its lane, client, project and `displayGroup` (one group slug can repeat across clients). A deck shows its lowest-`brandDeckOrder` page, a banner group or carousel its first member by `orderRank`, and a sequence cycles. Album covers are single square tiles. Banners and alpha logos letterbox (`fit: contain`). Built by `buildDirectoryTiles.js`, whose lanes come from `assetLane`, so the directory and the detail pages agree.
- **Directory order** — `project` by default: the featured projects first, in World order, then every other client by name. `?dirorder=mix` deals the clients round-robin.
- **Directory filter** — tags OR together, none on shows everything, and the client narrows on top. A tag the active client would empty dims; a tag with no tiles is hidden.
- **Client Roster** — every published `client` in Sanity, by name, listed in the info drawer (`toDrawerRoster`, `src/lib/clientCoverage.js`). A name is **live** when its Client Coverage holds a directory tile: a live name links to the directory filtered by that client, and the rest stay plain labels until a link lands in Sanity.
- **Client Coverage** — the clients a name stands for: itself, plus every client that names it as an `affiliations[].entity`, one hop only (`coverageOf`). A label, manager or owner pulls in its artists' work; an artist never pulls in a label's catalogue. Munchietown names DJ Tennis as its entity (`label-of`), so DJ Tennis filters to Munchietown's media.

## Content Population Hierarchy

The system that turns a Featured Project directory's contents into a page layout. **Pages are populated, not authored** — current CMS metadata is the layout instruction set. Intake proposes `mediaType`, `contentRole`, and `displayGroup`; the runner appends new `orderRank` values without replaying existing editorial metadata.

| Metadata | Layout role |
|---|---|
| `sourceFolder` / `sourceManifest` | Grouping key — defines which assets belong to the project page |
| First-ranked asset | Hero media — first in the collection's drag-to-order ranking, not a dedicated flag |
| `orderRank` | Studio-compatible rank — the current editorial sequence; new intake appends in row order |
| `mediaType` / aspect ratio | Slot sizing — landscape can go full-bleed; portrait/square always pairs into split rows |
| `contentRole` | Flow membership — showcase (empty) populates the main flow; `process`/`supporting` reserved for the future BTS section |
| `displayGroup` | Sub-grouping — assets sharing a `displayGroup` value render adjacent on the detail page (controlled adjacency) |
| `album-art` mediaType | **Dual-feed rule** — populates the AlbumArtViewer (detail page) and the Project Directory (one square tile per cover) |
| `brand-deck` mediaType | **Dual-feed rule** — held out of the flow; populates the BrandDeckViewer accordion (detail page), sorted by `brandDeckOrder`, and the Project Directory (one tile per deck) |
| `carousel-slide` mediaType | Held out of the flow — populates the to-be-built Carousel component, one carousel per `displayGroup`, slides in `orderRank` |

### Aspect Ratio Resolution Rules

Every asset MUST carry enough metadata for the renderer to compute its aspect ratio. The resolution cascade (defined in `buildContentFlow.js → ratioOf()`, shared by detail pages, /work Worlds, and the directory grid) is:

| Priority | Source | Example |
|---|---|---|
| 1 | **`mediaType` ratio bucket** (editorial truth) | `static_3x4` → 3/4, `motion_9x16` → 9/16, `motion_4x3` → 4/3, `album-art` → 1, `brand-deck` → 16/9 |
| 2 | **Mux `data.aspect_ratio`** | `"16:9"`, `"9:16"` — authoritative for video without a ratio bucket |
| 3 | **Sanity image `metadata.dimensions`** | `{ width: 3000, height: 4000 }` — authoritative for images without a ratio bucket |
| 4 | **Title-hint parsing** | Asset title containing "3x4", "9x16", "4x5" etc. |
| 5 | **Fallback** | 16 / 9 (landscape default) |

**Media-type assignment rule (2026-07-30):** ratio buckets are assigned by **closest aspect ratio** — the intent is for media to populate the container that best suits its native aspect. Non-exact aspects go to the nearest bucket (e.g. 25:32 ≈ 0.78 → `motion_4x5`; 850:937 ≈ 0.91 → `motion_4x5`; 4:3 sources → `motion_4x3`). This makes aspect editorial and immune to stale Mux data.

**Deliberate `MEDIA_TYPE_RATIOS` omissions:** `motion_other`, `static_other`, and `logo` have **no** map entry, so they fall through to real Mux/image dimensions — reserved for aspects no bucket suits (ultra-wide 4:1 banners, odd one-offs). Do not add map entries for them.

**Ingestion rules:**
- Videos/reels uploaded through the runner must reach Mux `ready`, with playback and final `data.aspect_ratio` metadata attached to the `mux.videoAsset` doc before media wiring. `preparing` is pending; resume the same saved run. No separate backfill command is required.
- Images uploaded to Sanity CDN carry dimensions automatically via `metadata.dimensions`.
- Assets with generic `mediaType` values (`motion_other`, `static_other`) rely on the synced Mux/image data above; re-type them to the closest ratio bucket unless their aspect genuinely fits no bucket.
- The `data-portrait` attribute is applied when `ratio < 1.2` (PORTRAIT_THRESHOLD), which clamps the container to `max(ratio, 3/4)` via CSS.

### Display Group (Controlled Adjacency)

Assets within a Featured Project can be sub-grouped by setting the `displayGroup` field. All assets sharing the same `displayGroup` value render adjacent in the detail page layout — groups are ordered by the lowest `orderRank` member within each group, and assets within a group maintain their individual `orderRank`.

- No group headers or visual dividers are rendered — this is **controlled adjacency**, not sectioning.
- Assets with no `displayGroup` form a single implicit "ungrouped" cluster.
- The `displayGroup` value is a **kebab-case slug** set in the manifest (e.g., `coachella-set-promo`, `developed-pitch-deck`, `womens-day-carousel`) — production data uses slugs, never display strings.

### Sequence (one tile, many stills)

A **sequence** is one tile that cuts through a set of stills on one shared clock, on the detail grid, the /work World and the home globe (`src/lib/mediaSequence.js`, Nathan 10-31). Set the same `displayGroup` ending in `-sequence` (e.g. `imperfect-records-logo-sequence`) on every member; Studio order is frame order. The group takes one tile at its first member's place instead of one tile per variant. Stills only: a video member keeps its own tile, and a group of one stays a plain tile. Up to 12 frames.

- **Rate:** one rate for every sequence on every route, `?seqms` (default 1000 ms). A hard cut, never a blend; reduced motion holds frame 0.
- **Shape:** the tile takes the member label shape that crops the set least (labels win, as in `ratioOf`). An opaque frame fills the tile (cover); a frame with transparency shows whole on near-black (contain), so a logo never loses its edges.
- **Album art on the home globe:** a project's still covers become one sequence panel automatically (no Studio edit), freeing the other panels. Animated covers keep their own tiles. The detail page and /work keep their album walls.

### Album Art Dual-Feed Rule

Any `album-art` asset within a Featured Project collection feeds into **two** surfaces:
1. **AlbumArtViewer** — the album-art band on the project detail page
2. **The Project Directory** — each cover is one square tile in the directory's grid

This is automatic — the `album-art` mediaType is the trigger; no additional tagging is needed.

**Minimum-count gate:** the orbit mounts only when the collection clears a tunable minimum cover count (`ORBIT_MIN`, ~6). Below the gate, the covers fold back into the showcase masonry flow (they tessellate as square tiles) rather than vanishing — real work stays on the page, it just doesn't earn an orbit.

### Brand Deck Dual-Feed Rule

Mirrors album art: any `brand-deck` asset feeds **two** contexts:
1. **BrandDeckViewer** — the horizontal deck pager on the Featured Project detail page / Featured Projects page
2. **Project Directory** — one tile per deck, not per page, showing the deck's first page (lowest `brandDeckOrder`)

`mediaType: brand-deck` is the trigger; `displayGroup` (kebab-case deck slug) bounds the deck; `brandDeckOrder` sequences pages. In the directory a deck is keyed by client, project and `displayGroup`, since one deck slug can repeat across clients; supporting decks are in, as on the detail pages.

### Carousel Convention

Social/editorial carousels (multi-slide posts) live in a subfolder, one image per slide. Each slide row uses `mediaType: carousel-slide`, `displayGroup` = the kebab-case slug of the carousel name (e.g. `womens-day-carousel`), and `orderRank` sequences the slides. `buildContentFlow` holds carousel slides out of the masonry flow — reserved for the to-be-built Carousel component, which renders one carousel per `displayGroup`.

### Brand Deck Convention

Brand and pitch decks must be exported as per-page JPEGs and placed in a subfolder. The subfolder name becomes the `displayGroup`, each page uses `mediaType: brand-deck`, and `brandDeckOrder` controls page sequence. The BrandDeckViewer component renders these as a horizontal deck pager.

**Flow algorithm** (`buildContentFlow.js`): after the hero and blurb, showcase assets are first clustered by `displayGroup`, then within each group they alternate full-bleed → split pair → full-bleed →… Portrait assets never render full-bleed. Projects with more videos naturally get more full-bleed slots; still-heavy projects pair into split rows. Media-type-specific components (`album-art`, `brand-deck`) are separated from the flow and routed to their dedicated components.

**Editorial copy layer**: an optional `project` document (slug = `{client-slug}-{collection-slug}`, e.g. `heavy-house-society-branding-2026`) supplies the overview blurb and display title. Without it the page falls back to the collection name and omits the blurb. The `project.contentBlocks` page-builder remains available as a manual override for hand-curated layouts (not yet wired).

## Route Map

| Route | Page | Component |
|---|---|---|
| `/` | Landing page — home globe; scroll triggers **Envelopment** into `/work` | `LandingPage` |
| `/work` | **Featured Projects** — immersive sphere experience (primary work destination) | `FeaturedProjects` |
| `/work/directory` | Project Directory — every asset in one flush grid, filtered by service tag and by client (`?tag=a,b&client=slug`) | `DirectoryPage` |
| `/work/[slug]` | Single Project Page (editorial layout) | `FeaturedProjectDetail` |
| `/process` | Process page — five-Stage globe narrative (v2; gated by the disabled-route pattern until launch) | `ProcessPage` |

> The legacy `/work/featured` (isHero-driven showcase) is retired — superseded by the project-doc-first experience at `/work`.
