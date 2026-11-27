# Data Model (Sanity)

*Last Updated: 2026-11-27*

Sanity project `b60h4u7o`, dataset `production`. Schema in `src/schemas/*.ts`, registered by
`src/schemas/index.ts`; Studio structure in `sanity.config.ts`, with its custom panes in `src/studio/` (US-10). `CONTEXT.md` is the glossary for the
media-library terms (Client Folder, Curated Collection, Artwork Catalog, Featured Project).

## Document types

| Type | Key fields | References |
|---|---|---|
| `client` | `name`, `slug`, `clientType` (artist/label/management/promoter-event), `city`, `country`, `affiliations[]{entity, relationship}`, `links[]{platform,url}` | `affiliations.entity` → client |
| `project` | `title?`, `slug`, `description`, `yearStart/yearEnd/isOngoing`, `isFeatured`, `projectColor`, `projectColorSecondary`, `orderRank` (LexoRank) | `client` → client (no `services`: a project's tags are its media's, see below; the field was cleared by plan df2af68c and left the schema 11-26) |
| `mediaAsset` | `title`, `slug`, `mediaType` (album-art, logo, featured-project-reel, brand-deck, carousel-slide, `static_*`, `motion_*` by aspect), `image` (hotspot) or `video` (`mux.video`), `alt` (≤150) + `description` (≤300, screen-reader/search only — not the project blurb) for both, `releaseInfo{…}` (album-art), `brandDeckOrder`, `contentRole` (process/supporting; empty = showcase), `sourceFolder`/`sourceManifest` (read-only provenance), `splitIntoThirds` (11-05: boolean, video only, default off, hidden on other types; the detail grid plays the video as three tiles, one per third), `collaborators[]` (SQ-76, 11-13: the other clients credited on the piece, a featured or co-billed artist or a co-presenting promoter or label; unique; a label's release artists are never added), `hideFromSite` (SQ-83, 11-13: boolean "Hide from site", default off; a ticked piece stays published with its rank and set, and every site read skips it), `hideFromDirectory` (11-17: boolean "Hide from Project Directory", default off; only the directory's read skips a ticked piece: its project page, /work and the globe keep it, and its tags still count for its project), `set` (US-10, 11-16: the piece's Set document, which holds its group; Studio offers only its own project's sets, or the project-less ones for a piece with no project. The site projects `groupType` = the set's type and `displayGroup` = its key through `MEDIA_FIELDS` and `FEATURED_WORLDS_QUERY`; the type → surfaces table is site code, `GROUP_SURFACES` in `work/detail/buildContentFlow.js`, read through `groupTypeOf`, which still types a piece with no set from its mediaType. The piece's own `displayGroup` / `groupType` left the schema 11-25, `39f91bc`), `orderRank` | `client` → client; `collaborators[]` → client; `project` → project; `set` → mediaSet; `services[]` → serviceTag |
| `mediaSet` | (US-10, 11-16) a set the site shows together: `title` ("Name", Studio only), `slug` ("Key": what the site groups by, so the `-sequence`/`-banner(s)`/`-admats` endings still route; unique dataset-wide, so a key two projects shared becomes `<key>-<project slug>`), `groupType` ("Type", the ten values), `allowAsHero` ("Can be the hero", default off). No `orderRank`: order is the members' ranks, and a set sits at its lowest member's. `_id` `mediaSet-<project slug>-<key>` (a set with no project: `mediaSet-<client slug>-<key>`); an album-art set's key is `<project slug>-album-art` (one per project; covers with no project have none) | `project` → project (optional since 11-25, a78be23: a client's merch, banners or admats with no project; a piece with no project picks only from these in Studio, and every member shares its set's project or lack of one) |
| `serviceTag` | `name`, `slug`, `sortOrder` | — |
| `globeSettings` | singleton `_id: "globeSettings"`, `picks[]` (writable through `npm run cms` changes as the whole keyed array) | → mediaAsset |
| `siteSettings` | singleton `_id: "siteSettings"` (10-08), `footerBlurb` (≤400) + `tagline` (≤160) + `infoBlurb` (≤400, optional, 11-12: the info drawer's blurb; empty keeps the shipped copy): site-wide studio copy as marked plain `text` (the `keywords.jsx` markers), not Portable Text; `directoryShuffle` (11-05: boolean, "Project Directory: shuffle the order"; read at build, so it takes effect on the next deploy; outside the CLI's `schemaHash`) | — |

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
from every site query. So is a mediaAsset ticked `hideFromSite` (SQ-83, 11-13): every mediaAsset
selection in `src/lib/queries.js` carries `&& hideFromSite != true` and the globe picks read
`picks[@->hideFromSite != true]->`; `!= true` reads a missing field as visible, and a hidden hero
hands the hero to the next visible piece by `orderRank`. `scripts/test/hide-from-site.test.mjs`
checks every selection's clause and runs the queries with `groq-js` over a hidden-piece fixture. A mediaAsset ticked `hideFromDirectory` (11-17) is skipped by `DIRECTORY_QUERY` alone (`&& hideFromDirectory != true` on its asset filter); `scripts/test/hide-from-directory.test.mjs` checks that no other query carries it. Ordering uses LexoRank. "Featured Projects (drag to order)" is still `@sanity/orderable-document-list`, which lists one `_type` only, so since US-10 (11-16) each per-project "Featured Project Assets" list is a custom component pane (`src/studio/ProjectAssetsPane.jsx`): one row per loose piece and ONE row per set (at its lowest member's rank), dragged by a handle or moved with Move up / Move down. A set move rewrites its members as one contiguous run; a member move (on the Set page) writes one rank. Both patch the published doc and its draft twin in one transaction (`src/studio/setRows.js`, pure, `scripts/test/studio-set-rows.test.mjs`; `useProjectRows.js` listens and writes). The top row is labelled Hero / Hero: whole set / Hero (first piece) by the site's own rule (`src/lib/setHero.js`); a row whose pieces are all `hideFromSite` is skipped, as the page skips it. Pieces with no set keep the old exclusions (brand-deck, carousel-slide, any `contentRole`); a piece in a set is listed whatever its type. The Set page (`src/studio/SetFormInput.jsx`, the form's root input for `mediaSet` only) shows the set's fields, then its media in order, and says why it won't lead. "Featured Project Sets" lists sets by project.

Client Coverage (11-03, `src/lib/clientCoverage.js`) reads `client.affiliations[].entity` one hop: a
name covers its own media plus that of every client naming it as entity, so a label, manager or
owner pulls in its artists' work and an artist never pulls in a label's catalogue (Munchietown names
DJ Tennis, `label-of`, so DJ Tennis filters to Munchietown's media). The drawer lists every published
`client`; a name whose coverage holds no media stays a plain label until an affiliation lands.
Since SQ-76 (11-13) a piece also counts for every client in its `collaborators`: a tile is in a
name's coverage when its client or any collaborator is (`tileInCoverage`), and the hop stays one,
so a collaborator never pulls in the host client's other work.

## Queries (`src/lib/queries.js`) → consumers

| Query | Used by |
|---|---|
| `GLOBE_ASSETS_QUERY` (picks / featured / heroes / autoFill tiers) | `/`, `/process`, `/lab/globe` via `globe/buildAssetPool.js` |
| `PROJECT_COLORS_QUERY` (project colour tokens, /work World order) | `src/pages/process.astro` → `lib/projectColor.js` `colorPool` → /process chip fills |
| `FEATURED_WORLDS_QUERY` | `src/pages/work/index.astro`; `src/pages/index.astro` via `globe/buildWorldPools.js` (the home globe's population modes). Its assets carry `imageDimensions`, Mux's `videoAspectRatio` / `videoStatus` and `videoTrack` (`max_width`, `max_height`), which `buildWorldPools.toGlobeAsset` turns into the media spans' class `u` (`globe/mediaClass.js`) and source short side `s` at build time, and `imageHasAlpha` (`image.asset->metadata.hasAlpha`), which pads a transparent sequence frame whole on near-black instead of cropping it |
| `FEATURED_PROJECT_PATHS_QUERY`, `FEATURED_PROJECT_DETAIL_QUERY` (`$projectId`; paths and `FEATURED_WORLDS_QUERY` take `collection` from the first-RANKED asset's `sourceManifest`, the route-slug fallback and the page title when the project has none, fc95ea5; its assets add `splitIntoThirds` and `"videoDuration": video.asset->data.duration` for `expandChunks`, 11-05, detail only, not `MEDIA_FIELDS`) | `src/pages/work/[slug].astro`; paths order drives `NextProjectBand` adjacency |
| `DIRECTORY_QUERY` (11-03; 11-10 adds `"videoDuration": video.asset->data.duration`, how long an admat tile holds an animated flyer; SQ-73, 11-13, adds `splitIntoThirds`, so a flagged video is three directory tiles): `shuffle` (`siteSettings.directoryShuffle`, 11-05; null while unset), each asset's `imageAssetId` (`image.asset._ref`, the logo marks' and the measured transparency's key, 11-05) and `imageIsOpaque` (`image.asset->metadata.isOpaque`, SQ-20, for `fitOf`), `tags` in `sortOrder`, every published `client` with `umbrellas` (`affiliations[].entity->slug.current`), `worlds` (`FEATURED_PROJECT_PATHS_QUERY`, the World order) and every published asset with an image or video as `MEDIA_FIELDS` + `orderRank`, `clientSlug`, `collaboratorSlugs` (SQ-76: `collaborators[]->slug.current`), `projectId`, `projectRank` | `src/lib/directoryData.js` `getDirectoryData()` (one fetch per build) → `/services` via `work/directory/buildDirectoryTiles.js`, and `BaseLayout.astro`'s Client Roster via `toDrawerRoster` |
| `SITE_COPY_QUERY` (the `siteSettings` singleton) | `src/lib/siteCopy.js`, awaited by `BaseLayout.astro` (every route) and `src/pages/index.astro` |

Sets (US-10, 11-16): `MEDIA_FIELDS` projects `setId` (`set._ref`) and `setAllowsHero` (`set->allowAsHero`), and projects `groupType` as `set->groupType` and `displayGroup` as the set's key (`select(set->groupType != "album-art" => set->slug.current)`: an album-art set's key is not a displayGroup, so covers keep null), from the Set only since `58596e9` (11-25); `FEATURED_WORLDS_QUERY` takes the same two. A piece with no set projects both null. `scripts/test/cms-frontend.test.mjs` pins the projection with `groq-js`.

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
(`wallDecks`, a carousel plate travelling sideways since 11-11) and admats and banners leave; on the detail page each admat set is one playing wall, each carousel a horizontal strip, and (US-4, 11-11) the `visuals` and `liveFootage` buckets a loop wall and a live-footage grid; merch stills collapse into one sequence on all four surfaces. US-5 (11-11): `mockups` open on globe/detail/directory (dropped on `/work`) and `flyer-progression` everywhere, each with a lane per surface (`SURFACE_LANE`): a cycling sequence on the globe (and /work for a progression, animated members as their Mux poster), on detail a full-width `mockups` strip (SQ-154, 11-24: every piece at its own aspect, travelling sideways) or a carousel strip that plays its motion pages, and on the directory one tile that flips through the set.
A set as the hero (US-10, detail only): when `assets[0]` belongs to a set that may lead (`leadsAsSet`, `src/lib/setHero.js`: its Set's "Can be the hero" on and a type in `HERO_SET_TYPES`, or album art, which always leads (11-24); a piece with no set keeps the old rule, only a deck or album art leads), `buildContentFlow` returns `heroSet` (`heroSetOf`: every member on the hero's lane, deck and admat pages in `brandDeckOrder`; a set of one never leads, except a deck) and those members join no bucket. `FeaturedProjectDetail` draws it in the hero slot through `HeroSet.jsx` at `?herosetvh` dvh (70, PROPOSED); `?heroset=1` previews any first set leading. /work, the globe and the next-project band still show the first piece.
A displayGroup ending `-sequence` collapses into one showcase item carrying `frames`
(`lib/mediaSequence.js`); on the home globe, `buildWorldPools` also folds a project's still album art
into one.
Project accent colors reach CSS through `lib/projectColor.js` as `--project-color*`, and the
/process chips through `colorPool` (distinct colours, dealt modulo). On home
(`?popcolor`), the globe world's `projectColor` also drives the globe's
ink and the home chrome.
