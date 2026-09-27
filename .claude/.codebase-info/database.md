# Data Model (Sanity)

*Last Updated: 2026-09-09*

Sanity project `b60h4u7o`, dataset `production`. Schema in `src/schemas/*.ts`, registered by
`src/schemas/index.ts`; Studio structure in `sanity.config.ts`. `CONTEXT.md` is the glossary for the
media-library terms (Client Folder, Curated Collection, Artwork Catalog, Featured Project).

## Document types

| Type | Key fields | References |
|---|---|---|
| `client` | `name`, `slug`, `clientType` (artist/label/management/promoter-event), `city`, `country`, `affiliations[]{entity, relationship}`, `links[]{platform,url}` | `affiliations.entity` → client |
| `project` | `title?`, `slug`, `description`, `yearStart/yearEnd/isOngoing`, `isFeatured`, `projectColor`, `projectColorSecondary`, `orderRank` (LexoRank) | `client` → client; `services[]` → serviceTag |
| `mediaAsset` | `title`, `slug`, `mediaType` (album-art, logo, featured-project-reel, brand-deck, carousel-slide, `static_*`, `motion_*` by aspect), `image` (hotspot+alt) or `video` (`mux.video`), `releaseInfo{…}` (album-art), `brandDeckOrder`, `contentRole` (process/supporting; empty = showcase), `displayGroup`, `sourceFolder`/`sourceManifest` (read-only provenance), `orderRank` | `client` → client; `project` → project; `services[]` → serviceTag |
| `serviceTag` | `name`, `slug`, `sortOrder` | — |
| `globeSettings` | singleton `_id: "globeSettings"`, `picks[]` | → mediaAsset |

Conventions: `isHero` is retired; the first asset by `orderRank` is the hero. Drafts are excluded
from every site query. Ordering uses LexoRank via `@sanity/orderable-document-list` (Studio lists:
"Featured Projects (drag to order)" and per-project "Featured Project Assets", which exclude
brand-deck/carousel-slide/album-art and any `contentRole`).

## Queries (`src/lib/queries.js`) → consumers

| Query | Used by |
|---|---|
| `GLOBE_ASSETS_QUERY` (picks / featured / heroes / autoFill tiers) | `/`, `/process`, `/lab/globe` via `globe/buildAssetPool.js` |
| `FEATURED_WORLDS_QUERY` | `src/pages/work/index.astro` |
| `FEATURED_PROJECT_PATHS_QUERY`, `FEATURED_PROJECT_DETAIL_QUERY` (`$projectId`) | `src/pages/work/[slug].astro`; paths order drives `NextProjectBand` adjacency |
| `MEDIA_GRID_QUERY`, `ALBUM_ART_QUERY`, `SERVICE_TAGS_QUERY` | dormant `/work/directory` |

`scripts/test/cms-frontend.test.mjs` evaluates these real queries with `groq-js` against fixtures.

## Content flow on the site
`work/detail/buildContentFlow.js` partitions a project's assets into hero / showcase / brandDecks
(cap 12 pages) / albumArt buckets; the same function feeds both `/work` Worlds and the detail grid.
Project accent colors reach CSS through `lib/projectColor.js` as `--project-color*`.
