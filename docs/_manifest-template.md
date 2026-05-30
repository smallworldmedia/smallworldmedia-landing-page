# Manifest Template — `_manifest.md`

Place this file in any project folder to enable automated ingestion.
The ingest script (`scripts/ingest.mjs`) will parse it and create/update
Sanity `mediaAsset` documents for every file listed.

---

## Format

There are **two manifest modes** depending on where the manifest lives:

### Mode 1: Curated Collection (artwork catalogs, featured projects)

All assets share a single service context. The `services:` header applies to every row.

```markdown
# {Project Title}

client: {client-name}              <!-- must match a seeded client name -->
services: branding, album art      <!-- comma-separated — applied to ALL rows -->
year: 2024
project: {project-slug}            <!-- optional: links to a project doc -->

## Assets

| file | mediaType | title | isHero | sortOrder |
|------|-----------|-------|--------|-----------|
| hhs-brand-01_logo-primary.png | logo | HHS Logo Primary | true | 1 |
| hhs-brand-02_logo-mark.png | logo | HHS Logo Mark | false | 2 |
```

### Mode 2: Client Root (mixed assets in a flattened directory)

Each asset may belong to a different service. Use the `serviceType` column.

```markdown
# {Client Name} — Root Assets

client: {client-name}
year: 2024

## Assets

| file | mediaType | serviceType | title | isHero | sortOrder |
|------|-----------|-------------|-------|--------|-----------|
| spotify-promo_v2.mp4 | motion_9x16 | promo video | Spotify Promo | false | 1 |
| brand-guidelines.pdf | brand-deck | branding | Brand Guidelines | false | 2 |
| tour-poster.jpg | static_16x9 | event / tour creative | Tour Poster | false | 3 |
```

> **Fallback rule:** If a row has a `serviceType` value, the ingestion script uses it.
> If `serviceType` is missing or blank, it falls back to the header `services:` field.

---

## Field Reference

### Header Fields

| Field     | Required | Description |
|-----------|----------|-------------|
| `client`  | ✅       | Client name (exact match from CMS) |
| `services`| Mode 1 ✅ / Mode 2 ❌ | Comma-separated service tag names (applied to all rows) |
| `year`    | ✅       | Project year |
| `project` | ❌       | Slug of an existing project document |

### Asset Table Columns

| Column        | Required | Description |
|---------------|----------|-------------|
| `file`        | ✅       | Filename (same directory) or relative path (`../subfolder/file.jpg`) |
| `mediaType`   | ✅       | Asset format/shape — drives the renderer (video player vs lightbox) |
| `serviceType` | Mode 2 ✅ / Mode 1 ❌ | Per-asset service classification — drives portfolio filtering |
| `contentRole` | ❌       | `process` or `supporting` — leave empty for showcase (default). See below. |
| `title`       | ✅       | Display name in the CMS and frontend |
| `isHero`      | ❌       | `true` = project thumbnail (default: `false`) |
| `sortOrder`   | ❌       | Display order (lower = first) |

### Content Roles

Most assets are **showcase** content (polished deliverables) — this is the default when `contentRole` is not set. Only tag the exceptions:

| Value | When to use | Frontend behavior |
|-------|-------------|-------------------|
| *(empty)* | Polished deliverables — the default | Appears in portfolio grid + project page |
| `process` | BTS, screen recordings, WIPs | Project page only (e.g., "Behind the Scenes" section) |
| `supporting` | Contextual assets — event photos, reference shots | Project page only, not in main portfolio grid |

### Valid `mediaType` values

**Layout types:** `album-art`, `logo`, `featured-project-reel`, `brand-deck`

**Static formats:** `static_1x1`, `static_3x4`, `static_4x5`, `static_9x16`, `static_16x9`, `static_other`

**Motion formats:** `motion_1x1`, `motion_3x4`, `motion_4x5`, `motion_9x16`, `motion_16x9`, `motion_other`

### Valid `serviceType` values

These must match existing `serviceTag` documents in Sanity:

| Value | Description |
|-------|-------------|
| `album art` | Cover artwork for music releases |
| `branding` | Identity systems, brand guidelines |
| `merch design` | Merchandise, apparel, product mockups |
| `logo design` | Standalone logo/mark work |
| `web design` | Website design and development |
| `live visuals` | Real-time visual content for live performances |
| `2d animation` | Motion graphics, animated flyers |
| `3d animation` | 3D renders, visualizers |
| `promo video` | Promotional video content |
| `event / tour creative` | Flyers, tour posters, event branding |
| `social media` | Platform-specific content (stories, posts) |

---

## Album Art Extension

For `album-art` media types, add streaming links with a sub-table
immediately after the asset row:

```markdown
| file | mediaType | title | isHero | sortOrder |
|------|-----------|-------|--------|-----------|
| hhs-art-01_deep-dive-ep.jpg | album-art | Deep Dive EP | false | 1 |

### Release: Deep Dive EP
- artist: Various Artists
- catalog: HHS-001
- date: 2024-03-15
- spotify: https://open.spotify.com/album/...
- apple-music: https://music.apple.com/album/...
- soundcloud: https://soundcloud.com/...
```

---

## Ingestion Resolution

The `services` field on the `mediaAsset` Sanity schema is an **array of references**
to `serviceTag` documents. The ingestion script resolves service names to references:

```
Manifest "serviceType: promo video"
  → GROQ: *[_type == "serviceTag" && name == "promo video"][0]._id
  → mediaAsset.services = [{ _ref: "tag-id-xyz" }]
```

This means:
- **Filenames never carry service metadata** — they're just disk locators
- **`mediaType`** drives the frontend renderer (image vs video, aspect ratio)
- **`serviceType` / `services:`** drives portfolio filtering ("Show me all branding")

---

## Example: Complete Root Manifest (Mode 2)

```markdown
# Bedouin — Root Assets

client: Bedouin
year: 2024

## Assets

| file | mediaType | serviceType | title | isHero | sortOrder |
|------|-----------|-------------|-------|--------|-----------|
| bedouin_spotify-promo_v2.mp4 | motion_9x16 | promo video | Spotify Promo v2 | false | 1 |
| dear-miami_promo_1_v1.mp4 | motion_9x16 | promo video | Dear Miami Promo | false | 2 |
| 01_bedouin_costa-rica_122724.jpg | static_16x9 | event / tour creative | Costa Rica 12/27 | false | 3 |
| tour-listing.jpg | static_16x9 | event / tour creative | SA Tour Listing | false | 4 |
```
