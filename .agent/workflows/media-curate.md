---
description: Batch-classify service types and media types across existing client folders using Gemini visual analysis. Use for first-pass bulk curation of manifests with placeholder values.
---

# Media Curate — Batch Root Manifest Classification

Use this workflow for the first pass of classifying service types across all
existing client folders. Uses Gemini visual analysis to pre-classify assets,
then presents findings in batch format for efficient user confirmation.

This is the **bulk migration** workflow — for ongoing single-client imports,
use `/media-import` instead.

---

## Prerequisites
- The `media/` directory exists inside the workspace
- `scripts/generate-manifests.mjs` exists
- Root manifests have been scaffolded (run generator first if needed)
- Gemini is available via `mcp_proxima_analyze_file` or `mcp_proxima_ask_gemini`

## Trigger
User invokes `/media-curate` to batch-classify service types across client folders.

---

## Steps

### 1. Generate all missing manifests

```bash
# Scaffold manifests for all clients that don't have them yet
node scripts/generate-manifests.mjs --dry-run
# If preview looks good:
node scripts/generate-manifests.mjs
```

### 2. Identify manifests needing curation

Find root manifests that still have placeholder `<!-- serviceType -->` values:

```bash
grep -rl "<!-- serviceType -->" media/*/_manifest.md 2>/dev/null
```

### 3. Batch-curate by client (visual analysis)

For each client with uncurated root manifests, follow this process:

#### a. Visual pre-classification with Gemini

Use `mcp_proxima_analyze_file` with `provider: gemini` on a **representative sample**
(up to 5 files per client) to understand the client's asset mix.

Ask Gemini:
> "What type of creative service does this asset represent?
> Choose from: branding, logo design, album art, live visuals, 2d animation,
> 3d animation, promo video, event / tour creative, social media, web design.
> Explain your reasoning briefly."

For video files, also ask about aspect ratio:
> "What is the approximate aspect ratio of this video? (16:9, 9:16, 1:1, 4:5, 3:4)"

#### b. Pattern-based grouping

After analyzing the sample, extend classifications to all files using filename
patterns and file extensions. Group results:

```
📂 {ClientName} — Root Assets ({N} files)

Group 1: Branding ({n} files)
  ✦ Based on: Gemini analysis of logo-primary.png, visual identity patterns
  - logo-primary.png → static_other → branding
  - logo-mark.png → static_other → branding
  - brand-guide-page-01.jpg → static_other → branding

Group 2: Event / Tour Creative ({n} files)
  ✦ Based on: Gemini analysis of tour-poster.jpg, event flyer patterns
  - tour-poster-jan.jpg → static_16x9 → event / tour creative
  - tour-poster-feb.jpg → static_16x9 → event / tour creative

Group 3: Promo Video ({n} files)
  ✦ Based on: Extension + naming pattern
  - spotify-promo-v2.mp4 → motion_9x16 → promo video
  - ig-story-promo.mp4 → motion_9x16 → social media

⚠️ Uncertain (need your input):
  - abstract-render-01.mp4 → motion_other → ???

Does this grouping look correct? Any changes needed?
```

#### c. User confirmation

Wait for the user to confirm or modify the groupings. Apply corrections.

#### d. Update manifest

After confirmation, update the root manifest with the classified service types.
Replace all `<!-- serviceType -->` placeholders with the confirmed values.
Also update `mediaType` values if Gemini's aspect ratio analysis provides better
specificity than the default `static_other` / `motion_other`.

### 4. Handle featured project subfolders

For non-Artwork subfolders that still need `services:` defined:

```
📂 {ClientName} / {ProjectName} ({n} files)

Gemini classified this project as primarily: {inferred service}
Files: file1.mp4, file2.jpg, ...

What services does this project cover?
```

### 5. Commit curated manifests

After each batch of clients is curated:

```bash
git add media/**/_manifest.md
git commit -m "feat(media): curate {N} client root manifests"
```

### 6. Progress tracking

After each curation session, report progress:

```
📊 Curation Progress
   Curated: {n}/{total} client root manifests
   Remaining: {list of uncurated clients}
   Next batch: {suggested next 5 clients}
```

---

## Tiered Approach

Process clients in priority tiers:

### Tier 1 — High-volume clients (10+ root assets)
These have the most complex asset mixes and benefit most from visual analysis.
Do these first to establish classification patterns.

### Tier 2 — Medium-volume clients (3-9 root assets)
Often have clear patterns. Gemini analysis on 1-2 samples is usually sufficient.

### Tier 3 — Low-volume clients (1-2 root assets)
Simple — can often be classified from filename alone. Batch multiple clients together.

---

## Reference

- [CONTEXT.md](../CONTEXT.md) — Domain glossary and folder rules
- [docs/_manifest-template.md](../docs/_manifest-template.md) — Manifest format specification

### Valid service types

| Value | Common visual signals |
|-------|----------------------|
| `album art` | Square format, typography-heavy, release-style artwork |
| `branding` | Logos, color palettes, brand guidelines, identity systems |
| `logo design` | Isolated mark/wordmark on solid background |
| `web design` | Browser mockups, UI screenshots |
| `live visuals` | Tunnels, particles, reactive geometry, stage content |
| `2d animation` | Motion graphics, animated flyers, kinetic type |
| `3d animation` | 3D renders, product visualizations, CG environments |
| `promo video` | Artist promos, music videos, promotional edits |
| `event / tour creative` | Flyers, tour posters, event branding, lineup cards |
| `social media` | Stories, carousels, posts — platform-specific content |

### Media type refinement

During visual analysis, refine aspect ratios where possible:

| Extension | Default | Refine to |
|-----------|---------|-----------|
| `.jpg`/`.png` | `static_other` | `static_1x1`, `static_16x9`, `static_9x16`, etc. |
| `.mp4`/`.mov` | `motion_other` | `motion_1x1`, `motion_16x9`, `motion_9x16`, etc. |
| `.svg` | `static_other` | Usually `logo` if it's a vector mark |
