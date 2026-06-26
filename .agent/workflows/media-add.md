---
description: Add new media assets to an existing featured project. Scans for unmanifested files, proposes classifications for confirmation, then runs the full ingest pipeline (ingest → ingest-videos → backfill). Use when you've dropped new files into a project's media folder.
---

# Media Add — Add Assets to an Existing Project

Add new media files to a project that has already been ingested into Sanity.
The most common day-to-day media workflow: drop files, invoke `/media-add`,
confirm classifications, and the pipeline handles the rest.

---

## Trigger

User drops new files into an existing project's media folder and invokes
`/media-add`. They will specify which project folder has the new files.

---

## Steps

### 1. Locate the project folder and manifest

Ask the user which project has new files. Resolve the folder path:

```bash
# Verify the manifest exists
ls "media/{ProjectFolder}/_manifest.md"
```

If no manifest exists, redirect to `/media-import` instead.

### 2. Detect new files (diff against manifest)

Scan the folder for files not yet listed in the existing manifest:

```bash
# List all media files in the folder
find "media/{ProjectFolder}" -maxdepth 1 \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.gif' \
     -o -iname '*.webp' -o -iname '*.svg' -o -iname '*.mp4' -o -iname '*.mov' \
     -o -iname '*.webm' \) \
  -not -name '.*' | sort
```

Cross-reference against the existing manifest's `file` column. Report only
the **net-new files** — files on disk that have no manifest row.

Present the diff clearly:

```
📂 {ProjectFolder} — {N} new files detected

Already in manifest: {M} files
New (not yet ingested):
  1. new-asset-01.jpg
  2. new-promo-video.mp4
  3. updated-poster.png
```

If zero new files are found, report that and stop.

### 3. Classify new assets — ASK BEFORE PROCEEDING

For each new file, propose a classification. Use these signals:
- **File extension** → image (`.jpg`, `.png`) vs video (`.mp4`, `.mov`)
- **Filename patterns** → e.g., `_9x16` → `motion_9x16`, `_4x5` → `static_4x5`
- **Existing manifest context** → inherit `services:` header if Mode 1 manifest
- **Gemini visual analysis** (optional) → use `mcp_proxima_analyze_file` with
  `provider: gemini` on ambiguous files to determine aspect ratio and service type

Present the proposed classification in a confirmation table:

```
📋 Proposed classifications for {N} new files:

Manifest header context:
  client: {client}
  services: {services from header, if Mode 1}

| # | File | mediaType | serviceType | Title (proposed) |
|---|------|-----------|-------------|------------------|
| 1 | new-asset-01.jpg | static_other | branding | New Asset 01 |
| 2 | new-promo-video.mp4 | motion_other | promo video | New Promo Video |
| 3 | updated-poster.png | static_16x9 | event / tour creative | Updated Poster |

⚠️ Please confirm or correct these before I proceed:
  - Are the mediaTypes correct? (see valid types below)
  - Are the serviceTypes correct?
  - Any title adjustments?
  - Any contentRole tags? (leave empty = showcase, or: process, supporting)

Note: Hero is determined by sort order — the first asset (sortOrder 1) is
automatically the hero. No isHero flag is needed.
```

**DO NOT PROCEED until the user confirms.** This is the quality gate.

### 4. Update the manifest

After confirmation, append the new rows to the existing manifest table.
Assign `sortOrder` values continuing from the highest existing value.

For Mode 1 manifests (curated collection — shared `services:` header):
- Append rows with: `file`, `mediaType`, `title`, `sortOrder`
- Do NOT add a `serviceType` column (the header `services:` applies to all)

For Mode 2 manifests (client root — per-row `serviceType`):
- Append rows with: `file`, `mediaType`, `serviceType`, `title`, `sortOrder`

**Preserve the exact existing table format** — match column order and widths.

> **Hero = first in sort order.** There is no `isHero` column. The asset with
> `sortOrder: 1` is automatically treated as the hero on the detail page.
> To change the hero, reorder assets in Sanity Studio (drag-and-drop).

### 5. Run the ingest pipeline

// turbo-all

Execute the three-step pipeline:

```bash
# Step 1: Create Sanity docs + upload images
node scripts/ingest.mjs "media/{ProjectFolder}/_manifest.md"
```

```bash
# Step 2: Upload videos to Mux (only processes assets missing video field)
node scripts/ingest-videos.mjs --manifest "media/{ProjectFolder}/_manifest.md"
```

```bash
# Step 3: Link assets to their project doc (only patches unlinked assets)
node scripts/backfill-project-refs.mjs --apply
```

All three scripts are idempotent — they skip assets that have already been
processed. Safe to re-run on a manifest with existing + new rows.

### 6. Verify and report

After ingestion completes, report results:

```
✅ Media Add complete for {ProjectFolder}

  New assets ingested: {N}
    Images uploaded to Sanity CDN: {n}
    Videos uploaded to Mux: {n}
    Project refs linked: {n}

  Total assets in manifest: {M}

  🎯 Next steps:
    - Open Studio → Featured Project Assets → {Project} to drag-reorder
    - New assets default to end of the list (highest sortOrder)
```

### 7. Commit manifest changes

```bash
git add "media/{ProjectFolder}/_manifest.md"
git commit -m "feat(media): add {N} assets to {ProjectFolder}"
```

---

## Reference

### Valid `mediaType` values

**Layout types:** `album-art`, `logo`, `featured-project-reel`, `brand-deck`, `carousel-slide`

**Static formats:** `static_1x1`, `static_3x4`, `static_4x5`, `static_9x16`, `static_16x9`, `static_other`

**Motion formats:** `motion_1x1`, `motion_3x4`, `motion_4x5`, `motion_9x16`, `motion_16x9`, `motion_other`

### Valid `serviceType` values

| Value | Description |
|-------|-------------|
| `album art` | Cover artwork for music releases |
| `audio-reactive-media` | Audio-reactive visuals, generative music-driven content |
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

### Content roles

| Value | When to use |
|-------|-------------|
| *(empty)* | Polished deliverables — the default (showcase) |
| `process` | BTS, screen recordings, WIPs |
| `supporting` | Contextual assets — event photos, reference shots |

### Filename-based mediaType heuristics

| Pattern | Inferred mediaType |
|---------|--------------------|
| `*_9x16.mp4` / `*_9x16.mov` | `motion_9x16` |
| `*_4x5.mp4` / `*_4x5.mov` | `motion_4x5` |
| `*_16x9.mp4` / `*_16x9.mov` | `motion_16x9` |
| `*_1x1.mp4` / `*_1x1.mov` | `motion_1x1` |
| `*.mp4` / `*.mov` (no ratio hint) | `motion_other` |
| `*.jpg` / `*.png` (square-ish) | `static_1x1` |
| `*.jpg` / `*.png` (no ratio hint) | `static_other` |
| `*.svg` | `static_other` (likely logo) |

### Related workflows

- `/media-import` — First-time setup for a new client folder
- `/media-curate` — Bulk classification across all client folders
- `/deploy-schema` — Deploy Sanity schema changes
