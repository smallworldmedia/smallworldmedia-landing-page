# Manifest Template — `_manifest.md`

Manifests are versioned intake records, not a mirror of current editorial content.
Sanity is the editorial authority. Use the scoped preview-first runner in
[CMS workflow](cms-workflow.md); adding files never replays old row metadata.

## Two modes

### Mode 1 — Curated Collection

Header `services:` applies to rows without their own `serviceType`.

```markdown
# Example Client — Branding

client: Example Client
services: branding
year: 2026
project: example-client-branding

## Assets

| file | mediaType | title | displayGroup | brandDeckOrder | sanityId |
| --- | --- | --- | --- | --- | --- |
| logo.png | logo | Primary Logo | | | |
| Brand Guidelines/page_01.jpg | brand-deck | Guidelines Page 01 | brand-guidelines | 1 | |
| Brand Guidelines/page_02.jpg | brand-deck | Guidelines Page 02 | brand-guidelines | 2 | |
```

### Mode 2 — Client Root

Each row supplies its own comma-separated service names.

```markdown
# Example Client — Root Assets

client: Example Client
year: 2026

## Assets

| file | mediaType | serviceType | title | contentRole | displayGroup | sanityId |
| --- | --- | --- | --- | --- | --- | --- |
| promo.mp4 | motion_4x3 | promo video | Promo | | | |
| poster.jpg | static_4x5 | event / tour creative | Tour Poster | | | |
| Carousel/slide_01.jpg | carousel-slide | social media | Slide 01 | | campaign-carousel | |
| Carousel/slide_02.jpg | carousel-slide | social media | Slide 02 | | campaign-carousel | |
```

Examples assume these client, service and project documents already exist; names
are illustrative, not instructions to seed them. New client/project creations
require explicit proposals. Never invent tags or featured status.

## Header contract

| Field | Meaning |
| --- | --- |
| `client` | Required resolved client name. Ambiguous/missing matches block planning. |
| `services` | Comma-separated existing service names. Required unless every row supplies `serviceType`. |
| `year` | Optional; when supplied, integer 2015–2030 (current runner/schema range). |
| `project` | Optional existing project slug; reference resolution is part of the scoped plan. |

Do not append inline HTML comments to header values. Placeholder values such as
`TBD` and `<!-- define services -->` are deliberately rejected.

## Table contract

Use exactly one asset table. Headers are case-insensitive; empty optional cells
must retain their pipe delimiters. Unknown columns and duplicate files/IDs fail.

| Column | Meaning |
| --- | --- |
| `file` | Required manifest-relative file path; nested subfolders are supported. No absolute paths, `..`, backslashes or symlink escapes. PDFs are not uploadable. |
| `mediaType` | Required reviewed current schema value (below). |
| `serviceType` | Optional comma-separated services, overriding header `services` for that row; one source is required for every row. |
| `title` | Reviewed display title; recommended for every row. Changing it does not change a bound ID or implicitly rename a slug/route. |
| `contentRole` | Empty for showcase; `process` for BTS or `supporting` for contextual material. |
| `displayGroup` | Optional kebab-case group slug, e.g. `brand-guidelines` or `campaign-carousel`. |
| `brandDeckOrder` | Page number for deck pages, starting at 1. |
| `sanityId` | Optional stable published document ID. Leave blank for new assets; the runner records successful bindings back into this selected manifest. Preserve existing bindings. |

Legacy `isHero` and numeric `sortOrder` columns are accepted for compatibility
but are **informational only**. Do not add them to new scaffolds. There is no
manifest `orderRank` column. Legacy `aspectRatio` is also accepted as informational;
actual probed dimensions take precedence. New assets append in **table row
order** after the current collection's last valid Studio-compatible `orderRank`;
existing order and hero remain unchanged. Rank/hero changes require an explicit
curation diff. Deck pages use `brandDeckOrder`; carousel slides use `orderRank`.

Missing/invalid existing ranks are conflicts to resolve explicitly, not a reason
to reseed the collection. Legacy rows without `sanityId` require unique verified
identity matching; ambiguous/renamed rows must be resolved, never duplicated.
Binding happens as selected manifests are used, not through a bulk migration.

## Current media types

- Layout: `album-art`, `logo`, `featured-project-reel`, `brand-deck`, `carousel-slide`
- Static: `static_1x1`, `static_3x4`, `static_4x5`, `static_9x16`, `static_16x9`, `static_other`
- Motion: `motion_1x1`, `motion_3x4`, `motion_4x3`, `motion_4x5`, `motion_9x16`, `motion_16x9`, `motion_other`

Use actual dimensions/file metadata and visual inspection by the available
assistant; no particular classifier/model provider is required. Select the
closest suitable aspect bucket. Generic `*_other` types are for genuinely
unsuitable bucket matches, not unknown/unreviewed files. A scaffold's `TBD` must
be resolved before planning. A reel is a video type, not a hero flag.

## Decks, carousels and release metadata

Export PDF source decks to reviewed per-page images before intake. Keep the PDF
out of the table. Preserve nested relative paths, assign `brand-deck`, a shared
`displayGroup`, and `brandDeckOrder`. Carousels use one image per row,
`carousel-slide`, a shared group and reviewed row order for new slides.

Album-art release metadata is **not** parsed from `### Release:` prose or a
second table. Use an explicit allowlisted `releaseInfo` patch in the changes
request after review. Existing release metadata and unrelated fields are never
replaced by a routine addition.

## Local scaffolding

```sh
node scripts/generate-manifests.mjs "Example Client" --dry-run
node scripts/generate-manifests.mjs "Example Client"
```

Scaffolding performs no CMS calls. It requires one client, preserves every existing
manifest, and rejects `--force`. It lists nested files within a collection without
absorbing subfolders that already have their own manifest. Root files remain
separate from collections. Classifications, services and nested deck/carousel
conventions still require review; nothing is automatically featured or published.
