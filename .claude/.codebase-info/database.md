# Data Model (Sanity)

*Last Updated: 2026-11-11*

Sanity project `b60h4u7o`, dataset `production`. Schema in `src/schemas/*.ts`, registered by
`src/schemas/index.ts`; Studio structure in `sanity.config.ts`. `CONTEXT.md` is the glossary for the
media-library terms (Client Folder, Curated Collection, Artwork Catalog, Featured Project).

## Document types

| Type | Key fields | References |
|---|---|---|
| `client` | `name`, `slug`, `clientType` (artist/label/management/promoter-event), `city`, `country`, `affiliations[]{entity, relationship}`, `links[]{platform,url}` | `affiliations.entity` → client |
| `project` | `title?`, `slug`, `description`, `yearStart/yearEnd/isOngoing`, `isFeatured`, `projectColor`, `projectColorSecondary`, `orderRank` (LexoRank) | `client` → client; `services[]` → serviceTag (dead data since 11-05: no query reads it; retirement = a hashed-schema edit, after the retag) |
| `mediaAsset` | `title`, `slug`, `mediaType` (album-art, logo, featured-project-reel, brand-deck, carousel-slide, `static_*`, `motion_*` by aspect), `image` (hotspot) or `video` (`mux.video`), `alt` (≤150) + `description` (≤300, screen-reader/search only — not the project blurb) for both, `releaseInfo{…}` (album-art), `brandDeckOrder`, `contentRole` (process/supporting; empty = showcase), `displayGroup` (a name ending `-banner(s)` routes to the banner wall, one ending `-sequence` makes its stills one cycling tile), `groupType` (11-10: `album-art`/`deck`/`banner`/`admat`/`carousel`, plus `merch`/`visuals`/`live-footage` since 11-11, the set a piece belongs to; every type but album-art also needs `displayGroup`; the type → surfaces table is site code, `GROUP_SURFACES` in `work/detail/buildContentFlow.js`, read through `groupTypeOf`, which infers a type for documents without the field; projected by `MEDIA_FIELDS` and `FEATURED_WORLDS_QUERY`), `sourceFolder`/`sourceManifest` (read-only provenance), `splitIntoThirds` (11-05: boolean, video only, default off, hidden on other types; the detail grid plays the video as three tiles, one per third), `orderRank` | `client` → client; `project` → project; `services[]` → serviceTag |
| `serviceTag` | `name`, `slug`, `sortOrder` | — |
| `globeSettings` | singleton `_id: "globeSettings"`, `picks[]` (writable through `npm run cms` changes as the whole keyed array) | → mediaAsset |
| `siteSettings` | singleton `_id: "siteSettings"` (10-08), `footerBlurb` (≤400) + `tagline` (≤160): site-wide studio copy as marked plain `text` (the `keywords.jsx` markers), not Portable Text; `directoryShuffle` (11-05: boolean, "Project Directory: shuffle the order"; read at build, so it takes effect on the next deploy; outside the CLI's `schemaHash`) | — |

**`siteSettings` holds MARKED PLAIN TEXT, not Portable Text.** Both fields are `type: 'text'`
(`footerBlurb` rows 3 / max 400, `tagline` rows 2 / max 160) carrying the house marker vocabulary
that `src/lib/keywords.jsx` parses — `**bold**`, `[[keyword]]`, `[[keyword]](/href)`,
`[label](/href)` — the same format the `project.description` fields already use. One vocabulary,
one parser, no new dependency; there is still **zero Portable Text in the repo**. A newline is a
LINE BREAK, which is how the tagline pill's three-line lockup survives an editor rewording it.
It is a second singleton rather than more fields on `globeSettings` because that document is named
and iconned for the homepage globe. Both are pinned in `sanity.config.ts` via
`S.document().documentId(…)` and filtered out of `newDocumentOptions`. Seeded and published in
`production`. **The hosted Studio's deployed schema manifest is stale**, so the type will not appear
there until the Studio is redeployed; a local Studio picks it up from the repo.

Conventions: `isHero` is retired; the first asset by `orderRank` is the hero. Drafts are excluded
from every site query. Ordering uses LexoRank via `@sanity/orderable-document-list` (Studio lists:
"Featured Projects (drag to order)" and per-project "Featured Project Assets", which exclude
brand-deck/carousel-slide/album-art and any `contentRole`).

Client Coverage (11-03, `src/lib/clientCoverage.js`) reads `client.affiliations[].entity` one hop: a
name covers its own media plus that of every client naming it as entity, so a label, manager or
owner pulls in its artists' work and an artist never pulls in a label's catalogue (Munchietown names
DJ Tennis, `label-of`, so DJ Tennis filters to Munchietown's media). The drawer lists every published
`client`; a name whose coverage holds no media stays a plain label until an affiliation lands.

## Queries (`src/lib/queries.js`) → consumers

| Query | Used by |
|---|---|
| `GLOBE_ASSETS_QUERY` (picks / featured / heroes / autoFill tiers) | `/`, `/process`, `/lab/globe` via `globe/buildAssetPool.js` |
| `PROJECT_COLORS_QUERY` (project colour tokens, /work World order) | `src/pages/process.astro` → `lib/projectColor.js` `colorPool` → /process chip fills |
| `FEATURED_WORLDS_QUERY` | `src/pages/work/index.astro`; `src/pages/index.astro` via `globe/buildWorldPools.js` (the home globe's population modes). Its assets carry `imageDimensions`, Mux's `videoAspectRatio` / `videoStatus` and `videoTrack` (`max_width`, `max_height`), which `buildWorldPools.toGlobeAsset` turns into the media spans' class `u` (`globe/mediaClass.js`) and source short side `s` at build time, and `imageHasAlpha` (`image.asset->metadata.hasAlpha`), which pads a transparent sequence frame whole on near-black instead of cropping it |
| `FEATURED_PROJECT_PATHS_QUERY`, `FEATURED_PROJECT_DETAIL_QUERY` (`$projectId`; paths and `FEATURED_WORLDS_QUERY` take `collection` from the first-RANKED asset's `sourceManifest`, the route-slug fallback and the page title when the project has none, fc95ea5; its assets add `splitIntoThirds` and `"videoDuration": video.asset->data.duration` for `expandChunks`, 11-05, detail only, not `MEDIA_FIELDS`) | `src/pages/work/[slug].astro`; paths order drives `NextProjectBand` adjacency |
| `DIRECTORY_QUERY` (11-03; 11-10 adds `"videoDuration": video.asset->data.duration`, how long an admat tile holds an animated flyer): `shuffle` (`siteSettings.directoryShuffle`, 11-05; null while unset), each asset's `imageAssetId` (`image.asset._ref`, the logo marks' and the measured transparency's key, 11-05) and `imageIsOpaque` (`image.asset->metadata.isOpaque`, SQ-20, for `fitOf`), `tags` in `sortOrder`, every published `client` with `umbrellas` (`affiliations[].entity->slug.current`), `worlds` (`FEATURED_PROJECT_PATHS_QUERY`, the World order) and every published asset with an image or video as `MEDIA_FIELDS` + `orderRank`, `clientSlug`, `projectId`, `projectRank` | `src/lib/directoryData.js` `getDirectoryData()` (one fetch per build) → `/work/directory` via `work/directory/buildDirectoryTiles.js`, and `BaseLayout.astro`'s Client Roster via `toDrawerRoster` |
| `SITE_COPY_QUERY` (the `siteSettings` singleton) | `src/lib/siteCopy.js`, awaited by `BaseLayout.astro` (every route) and `src/pages/index.astro` |

Media descriptors: `FEATURED_PROJECT_DETAIL_QUERY` projects `alt` + `description` through `MEDIA_FIELDS`
(11-03), the asset fields every grid of slots reads, and `DIRECTORY_QUERY` projects the same; the
directory's tiles then keep only the face MediaSlot reads, `alt` but not `description`. The WebGL
surfaces (globe, Worlds) don't need them. `MEDIA_FIELDS` also carries `imageHasAlpha`, for the
sequences and the directory's letterboxed logos.

A project's service tags (11-05, SQ-14): the `PROJECT_SERVICES` fragment is their one owner. It
returns the deduplicated union of the project's media's own `services`, in serviceTag `sortOrder`
(name breaks ties), through a nested `^.^`. The worlds, paths, directory-worlds and detail queries
all use it; untagged media give `[]`. `scripts/test/project-services.test.mjs` pins it with `groq-js`.

`scripts/test/cms-frontend.test.mjs` evaluates these real queries with `groq-js` against fixtures
(`DIRECTORY_QUERY` through `buildDirectoryTiles` too, 11-03);
`scripts/test/globe-worlds.test.mjs` does the same for `FEATURED_WORLDS_QUERY` → `buildWorldPools`.

## Content flow on the site
`work/detail/buildContentFlow.js` partitions a project's assets into hero / showcase / brandDecks
(cap 12 pages) / albumArt buckets; the same function feeds both `/work` Worlds and the detail grid.
Each caller names its surface (`{surface: 'work' | 'detail' | 'globe' | 'directory'}`, 11-10), so a
set shows only where its group type opens (`GROUP_SURFACES`): on `/work` carousels join the deck walls
(`wallDecks`) and admats and banners leave; on the detail page each admat set is one playing wall.
A displayGroup ending `-sequence` collapses into one showcase item carrying `frames`
(`lib/mediaSequence.js`); on the home globe, `buildWorldPools` also folds a project's still album art
into one.
Project accent colors reach CSS through `lib/projectColor.js` as `--project-color*`, and the
/process chips through `colorPool` (distinct colours, dealt modulo). On home
(`?popcolor`), the globe world's `projectColor` also drives the globe's
ink and the home chrome.
