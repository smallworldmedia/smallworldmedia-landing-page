# Project Directory: rebuilt from the detail page's grid

*Built on 2026-11-03 on branch `feature/project-directory` (worktree `../swm-project-directory`, off `feature/v1-launch` at `ccb6a5a`), while `feature/v1-launch` carried on in the main checkout. The plan was approved on 11-03, and its approved text is kept below. Status: all 13 commits have landed on the branch, and the four small fixes of 11-04 after them. It was folded into `feature/v1-launch` on 11-04 (`0032532`) and pushed on 11-05 (`4168495`); the worktree and both branches are retired. The open calls come first.*

## Open calls (Nathan)

1. **The drawer's hover mark.**
   - Since the roster grew to 20 names a column (`1f3df96`), its rows sit edge to edge at line-height 0.8.
   - So the house label underline crosses the row below on every name that has one, up to 4.5px into its capitals at 1440.
   - The focus ring crosses both neighbours.
   - No underline offset clears: at 1024 and 800 the next row's ink starts 1px under the baseline.
   - The branch keeps the house rule, as planned, until Nathan picks:
     - (a) keep the house underline;
     - (b) the accent colour on hover, with no underline (the active client wears the same colour, and its eye tells them apart);
     - (c) the filter's empty box after the name on hover and focus, which needs no room between rows.
   - The directory filter's tags, whose rows are 4px apart, mostly clear. Their underline touches at 1024 and crosses 0.5px on one tag at 1440, and their ring touches descenders above on 4 or 5 tags at each width.
2. **The tablet nav, from 769 to 991px.**
   - Five links don't fit below about 933px, so under 992px the row keeps the four it shipped with.
   - The options: keep that, fold the links into the menu pill below 992px, or shorten the label.
3. **The footer's link list.** Add `project_directory`?
4. **The 11 names without media (§6 below).**
   - Nathan says which client or clients each one stands for.
   - The links then land through one `--changes` plan, where `plan` prints the id and `apply` and `verify` run on his yes. Or he edits them in Studio.
5. **Near-duplicate clients.**
   - COCO (92 assets) sits beside COCO Records (none), and Rossi. beside HOMEGRWXN.
   - The options: merge them, rename them, or keep them.
6. **The directory's numbers.**
   - `?dirdwell` holds the agent's default until Nathan names a number. `?dirplayers` went from 6 and 3 to 8 and 4 on Nathan's 11-05 "up the number of videos playing".
   - 11-05, Nathan: five columns on a desktop (`?dircols`) and two on a phone (`?dirphonecols`); the filter loads open with `album-art` ticked; the order is a Studio switch (`siteSettings.directoryShuffle`, a new random order every load, `?dirorder=shuffle` to try it). The tablet band (769–1024px) holds 4 (`?dirtabletcols`), the agent's pick, approved by Nathan 11-05.
7. **The drawer at 59 names.**
   - It has 20 rows a column, up from 14.
   - The first-open cascade grows from 0.8 to 1.16 s.
   - Long names wrap to two lines: Mungo Sound Machine at 1440, and four names at 390.
8. **The fold, a draft deploy, and the push.**
   - First, `feature/v1-launch` takes `fix/nav-and-image-race` on its own: `git merge --no-ff fix/nav-and-image-race` in the main checkout. The branch is off `ccb6a5a`, merges cleanly onto `e468dd4`, and touches none of the main checkout's uncommitted files.
   - Once the description bands are committed, merge `feature/v1-launch` into this branch in the worktree, and resolve and verify the conflicts there: `FeaturedProjectDetail.jsx`, `flushGrid.js`, the map, the launch plan and the tunables guide.
   - Then fold this branch onto the launch tip in the main checkout with `git merge --no-ff feature/project-directory`, the house merge commit.
   - The draft deploy should answer 200 at `/work/directory` and list it in the sitemap.
9. **A dimmed tag's focus ring.** A tag the active client would empty is dimmed to 0.35 as a whole button, so its focus ring dims with it: under `?client=dj-tennis` it reads 89,89,89 on black where an undimmed tag's reads 255,255,255. Keep it, or dim only the label and the box so that the ring stays full.

## What landed

| # | Commit | What |
|---|---|---|
| 1 | `18fd851` | The old directory is retired: its six components, `work.css`, its queries, `preferMaxQuality`, and the probe's lightbox check. |
| 2 | `c90d6df` | The detail grid's tile units (`tileGrid.js`) and slot styles (`media-slot.css`) are lifted out. The detail pages' output is byte-identical. |
| 3 | `d76ac6f` | Shared data pieces: `MEDIA_FIELDS`, `assetLane` and `featuredRoutes`. The output is identical. |
| 4 | `6901cc5` | flushGrid at directory scale: column-aware sizes and `chunkFlushGrid`. |
| 5 | `9439903` | The directory's data: `DIRECTORY_QUERY`, Client Coverage, the tiles and the memoized fetch. |
| 6 | `8874ea0` | `CheckIndicator` and `useScrollThumb` are lifted out, with no visual change. |
| 7 | `1f3df96` | The drawer's Client Roster comes from Sanity (59 names). |
| 8 | `b9c1f38` | MediaSlot's directory mode and the player gate. |
| 9 | `43ca86c` | The directory page: grid, filter, URL state and the `?dirtune` bench. It was dev only at this point. |
| — | `8f0d281` | The nav lockup's hit area stops at the bar (found on the way). |
| 10 | `6fd55fb` | `globe-probe --directory`; the directory's players owe the 5 s preview clip. |
| 11 | `251e7b3` | The route goes on, with the nav's `project_directory` link. |
| — | `79c3e03` | That link's mark is a folder (Nathan, 11-03). |
| 12 | `5c66f49` | The drawer's names filter the directory. |
| 13 | `759187c` | This doc, the glossary, the tunables guide and the codebase map. |
| — | `ee8431d` | Merges `fix/nav-and-image-race`, which is off `ccb6a5a` so that `feature/v1-launch` can take it alone: the nav fix again, as `895b992`, and `4499fc3`, an image that loads before hydration shows, now in every mode (11-04). |
| — | `d9914e5` | MediaSlot's plain `<video>` wraps at its clip, not the detail cap. |
| — | `6943ec8` | A tile that Tab reaches lands below the stuck filter (`scroll-margin-top`, `--dir-filter-h`). |
| — | `4251093` | `globe-probe --directory` gates the keyboard (`tabReach`, `ringShows`), with `--keyctl=escape\|ring` as the controls. |
| — | this commit | This doc and the codebase map. |

Each commit message carries its own checks.

## Where the build differs from the plan

- The nav mark is a folder drawn like the heart (Nathan, 11-03), not ⊞.
- Below 992px the desktop nav row keeps the four links it shipped with (open call 2).
- `robots.txt` also stopped disallowing the route. That's a fourth un-gate file the plan didn't name; without it, the sitemap would list a page robots blocks.
- The drawer sends `swm:directory-client` synchronously, inside the click, not on the next frame. A React click handler runs in no gsap context, so the context trap the frame guarded against can't occur.
- The drawer's underline clearance check failed (open call 1).
- `DIRECTORY_QUERY` projects `MEDIA_FIELDS` whole, `description` included. The tiles keep only the face fields MediaSlot reads (`slim()` in `buildDirectoryTiles.js`), so the island's payload still leaves `description` out, as planned.

---

## The plan as approved (2026-11-03)

### Context

Nathan wants the site's project directory built on a new branch, starting from the media grid on the
project detail page (`/work/[slug]`). Nothing from the old directory may be reused. That old
directory has been dormant since the v1 cut `adc06ab` (07-01), and `/work/directory` redirects to
`/work`.

What he asked for:
- **Filter section:** at the top of the grid, full width, sticky on scroll. It expands to show every
  service tag and pushes the grid down as it opens.
- **Tags:** oversized labels with a checkbox and an eye icon, in the house Sans with first-letter
  capitals. Type scale, line height, spacing and the scroll-bar choreography all copy the InfoPanel
  drawer.
- **Client filter:** the media is filterable by client name through the drawer, so the drawer
  changes too.
- **A note for later:** fun filters (rainbow order, checkerboard, a colour slider).

Live data (production, read 11-03):
- **Assets:** 948 published (700 images, 248 Mux videos).
  - Every asset has `services[]` and a `client`.
  - 886 carry no `contentRole`. Of the 62 that do, 59 are supporting deck pages, which the detail
    pages show as decks.
  - 542 of the 886 belong to the 15 featured projects.
- **Grouped media:**
  - 10 decks, counted by client: 6 showcase decks (227 pages) and 4 supporting ones (59 pages).
  - `displayGroup` repeats across clients (four share "brand-guidelines-deck"), so a deck is keyed
    by client, project and group.
  - Also 13 banners in 5 groups, 1 carousel of 9 slides, 1 sequence of 4 frames, 142 album covers
    and 22 logos.
  - All of this collapses to about 705 tiles.
- **Service tags:** 15, stored in Title Case. 14 have media; VFX has none.
- **Clients:** 59, of which 47 have media. One client link exists: Munchietown → `label-of` → DJ
  Tennis.
- **Palette:** 504 of 700 images carry Sanity's palette. Videos carry none.

Glossary (`CONTEXT.md`): the component vocabulary still names the old components, and new names are
proposed there before they're built. The names in this plan are that proposal.
- The Brand Deck Dual-Feed Rule already says one card per deck in the directory.
- The Album Art rule points at the old ticker, so it changes.
- The route map keeps `/work/directory`.

Nathan's calls (11-03):
- **Tag control:** an oversized square checkbox before the label: an eye inside when on, empty when
  off.
- **Selection:** nothing on = everything. Tags on narrow to media carrying any of them. Turning the
  last one off shows everything again.
- **Casing:** Title Case as stored, no transform.
- **Old code:** deleted first, in its own commit. Pieces that live pages use stay.
- **Drawer roster:** every name filters.
  - The list comes from Sanity (all 59 clients).
  - Names with no media of their own get linked to the clients whose media they stand for: "DJ
    Tennis should be linked to all Munchietown assets".
- **Tile click:** a featured project's tiles open its page. Other tiles are media only. No hover
  label.
- **Entry points:** `project_directory` returns to the nav, on desktop and in the phone menu, and the
  drawer names lead to the directory too. /work still stops at its last World.

Defaults this plan adopts (vetoable):
- Supporting decks are in, as on the detail pages.
- Grouped tiles show a still face. A sequence still cycles.
- The directory's payload leaves out `description`, the screen-reader-only text; `alt` stays. That
  cuts the payload by about 30%.

### Commits, in order

1. Retire the old directory (§1).
2. Extract the detail grid's units. The detail page's output stays identical (§2).
3. Shared data pieces (`MEDIA_FIELDS`, `assetLane`, `featuredRoutes`). Output identical (§2).
4. flushGrid: column-aware sizes and `chunkFlushGrid`, with tests (§2).
5. Directory data: query, coverage, tiles, the memoized fetch, with tests (§2, §4).
6. Shared UI: `CheckIndicator` variants and `useScrollThumb`. No visual change (§3).
7. The drawer's roster comes from Sanity; names are still plain labels (§4).
8. MediaSlot's directory mode and the player gate, with tests (§2).
9. The directory page: grid, filter, URL state, bench. Production still redirects (§2, §3, §5).
10. Probe and network rule for the directory (§2).
11. The route goes on, plus the nav link (§5).
12. Drawer names filter the directory (§4).
13. Docs, glossary, tunables guide, codebase map (§7).

Every commit:
- `git -C <wt> status` first;
- explicit paths only;
- `git show --stat` after;
- its focused check passes before the next commit starts.

### 0. Branch: a separate worktree

Nathan, 11-03: this session works on a new branch while he stays on `feature/v1-launch` in his other
session. The main checkout is his. This session never switches its branch, never edits its files,
and never touches `:4322`.

- **Create:** `git worktree add "../swm-project-directory" -b feature/project-directory feature/v1-launch`.
  - The base is the local tip, `ccb6a5a` today, which includes the unpushed touch dials. His later
    commits come in by merging `feature/v1-launch`.
  - Checked 11-03: the path, the branch name and port 4330 are all free.
  - The path is a sibling in `Website/`, like `swm-globe-worlds` and `swm-process`.
  - Not `EnterWorktree`, which branches from `origin/main`. Every Edit, Write and commit targets the
    worktree by absolute path.
- **node_modules without `npm ci`:**
  - `mkdir node_modules .astro`.
  - Flag both before anything lands in them: `xattr -w 'com.apple.fileprovider.ignore#P' 1 node_modules .astro`.
    The main `node_modules` carries the same flag.
  - `cp -cR <main>/node_modules/. node_modules/`, an APFS clone of the exact installed tree.
  - Drop the copied `node_modules/.vite`.
  - If the clone misbehaves, stop and ask before any install.
- **`.env.local`:** copied with `cp`, checked with `cmp -s`, never printed.
- **Dev server:** `npx astro dev --port 4330 --host`, from the worktree.
  - 4330 is on the Sanity CORS list. Never 4321, 4322, 4323, 3352 or 3353.
  - Probes pin `GLOBE_PROBE_BASE=http://localhost:4330`.
  - A build stops that server first (the Vite dev/build collision), then serves the result with
    `astro preview`.
- **Git:**
  - No reset, stash, amend or rebase. Push only on Nathan's word.
  - `.git` is local-only, so an unpushed commit has no Dropbox copy.
  - This branch never commits `docs/.session-context.md`.
  - Codebase-map edits made on both branches may conflict at the fold. Resolve them there.

### 1. Retire the old directory (commit 1)

The chain is dormant: `directory.astro:25` redirects before its fetches, and no live page imports any
of it. The build still emits its chunks, though: about 9.4 KB of JS and 7.5 KB of CSS that nothing
links.

- **Delete:**
  - `src/components/work/`: ProjectDirectory, MediaGrid, MediaCard, AlbumArtTicker, FilterBar,
    Lightbox.
  - `src/styles/work.css`. Only the directory imports it, and it also carries dead `.featured-*`
    rules.
- **Cut from live files:**
  - `queries.js`: the three directory queries.
  - `imageConfig.js`: `IMG_WIDTH_STANDARD` and `IMG_WIDTH_WIDE`.
  - `useHls.js`: the `preferMaxQuality` branch, which only Lightbox passed. Remove it in one change
    across :38, :54, :230, :285, :291 (that line becomes `!preferMinQuality`) and :306, or the hook
    throws.
  - `global.css`: the `--text-headline` and `--lh-headline` tokens.
  - `masonry.css`:
    - The original `.masonry-grid` base rules go (:12-25, :110, :152), with the class on
      `FeaturedProjectDetail.jsx:531`. `masonry-grid--detail` stays.
    - They're inert on the detail grid: `columns` is unset, and multi-column never applies to a grid
      container; `gap` beats `column-gap`; the children are reset.
    - Fix the stale comments at masonry.css:1-10 and project-detail.css:302-306.
  - Comments naming the old components: sanityClient, work/index.astro, FeaturedProjects,
    buildContentFlow, imageConfig, useHls, hlsVideoOnly, global.css:693 and ServiceTag.
  - Probe:
    - `netReport.mjs` loses `lightboxMaster` (:84-87).
    - Its test in `globe-worlds.test.mjs` (:1208-1221) goes.
    - The bare-master test at :1137-1138 is re-pointed to `/about`, not deleted.
    - `globe-probe.mjs:44`'s comment is updated.
    - The `/work/directory` clip exemption stays until commit 10.
  - `directory.astro` becomes a bare redirect stub, with no imports and no fetches.
  - `CONTEXT.md`: the six old names leave the vocabulary, and the Album Art rule drops the ticker.
- **Stays:**
  - `useHls` / `hlsVideoOnly` / `hlsPrimed`, `imageConfig`'s other exports, and `ratioOf`;
  - masonry's `--detail` and socket rules;
  - `ServiceTag`, `.stag` and `.sr-only`;
  - the route list at `runner.mjs:578`.
- **Check:**
  - A search of `src` and `scripts` for every removed name finds nothing.
  - The build has the same page count and no directory chunks.
  - `/work/<slug>` is pixel-identical before and after at 1440, 1024 and 390.
  - `npm run test:cms`, `node --test scripts/test/globe-worlds.test.mjs` and
    `node scripts/tunables-keys.mjs --check` pass.

### 2. The grid (commits 2–5, 8–10)

**Extract, don't fork** (commits 2–3; the detail page's output stays byte-identical):
- **`src/components/work/detail/tileGrid.js`** takes the grid units out of `FeaturedProjectDetail.jsx`:
  - `GRID_ROW_PX`, `TILE_SHAPE` and `readTileShape`, `rowsFor`, `SQ_ROWS_FALLBACK` (:65-84);
  - `useTileShape()` (:235-236);
  - `useGridMetrics(flowRef, gridSelector?) → {width, rowGap, cols}` (:237-253);
  - `tileRowsFor(metrics, shape)` (:264-274);
  - `tileRowVars()` (:532-540);
  - `placementStyle(p)` (:550-555), with the same key order so the style string doesn't change.
- **What stays in the detail page:** sockets, banner rows, its 3-column call and the bare
  `<MediaSlot>` children. Its tiles stay non-links.
- **`.media-slot` CSS** (project-detail.css:301-367) moves verbatim to `src/styles/media-slot.css`,
  which `[slug].astro` imports ahead of project-detail.css.
- **`queries.js`:** a `MEDIA_FIELDS` constant holds the detail query's asset fields (:211-227)
  verbatim. The detail query interpolates it, in the same order.
- **`buildContentFlow.js`** exports `assetLane(asset)`: sequence, album-art, deck, carousel, banner,
  role or showcase. That is the precedence at :187-206, and its own loop switches on it.
- **`src/lib/projectSlug.js`** gains `featuredRoutes(rows)`, taken from `[slug].astro:30-34`, so a
  tile's link can't drift from the real routes.
- **Proof:**
  - Build before and after with no dev server running.
  - Normalize the hashed asset names, then `diff -r` the `/work` HTML: no differences.
  - Pixel-diff all 15 detail pages at three widths.

**flushGrid at directory scale** (commit 4):
- **Column-aware tile sizes:**
  - A landscape tile spans `min(2, cols)` columns; in one column it takes the landscape row count.
  - The detail call is unchanged.
  - This also fixes a latent crash: `placeAll` finds no spot for a tile wider than the grid.
- **`chunkFlushGrid(items, {cols, sqRows, lsRows, minTiles: 32, maxTiles: 64, maxRows: 6000})`**
  returns `[{start, end, placements, totalRows, forced}]`.
  - **The cut:** after `minTiles`, the list is cut at the first flat state, where every column's free
    space starts on the same row with no holes above it. The rest then places exactly as a fresh
    grid would, so the chunks, stacked one row-gap apart, read as a single grid with no seams.
  - **Forced cuts:** if no flat state arrives by `maxTiles` or `maxRows`, the cut goes at the least
    ragged point and the chunk is marked `forced`. A forced chunk flushes like the bottom of a
    detail page.
  - **Firefox:** every chunk stays under Firefox's 10,000-line grid clamp. One grid would need about
    16,000 rows at 3 columns and 29,000 at 1.
  - **Order:** dense back-fill can't pull a tile from hundreds of places later into an early hole,
    so project order holds.

**The data** (commit 5):
- **`DIRECTORY_QUERY`**, one fetch:
  - `tags` in `sortOrder`;
  - `clients{name, slug, umbrellas: affiliations[].entity->slug.current}`, every published client;
  - `worlds`: `FEATURED_PROJECT_PATHS_QUERY`, the World order;
  - `assets`: every published asset with an image or video, as `MEDIA_FIELDS` plus `orderRank`,
    `clientSlug`, `projectId` and `projectRank`, without `description`.
- **`src/lib/directoryData.js` `getDirectoryData()`** memoizes the fetch and the tiles for the whole
  build, like `getSiteCopy()` (`siteCopy.js:45-52`). The page and the drawer's roster (§4) read the
  same result.
- **`src/lib/clientCoverage.js`** (pure): `coverageOf(slug, clients) → Set | null`. It returns the
  slug plus every client whose `umbrellas` include it, one hop only.
- **`src/components/work/directory/buildDirectoryTiles.js`** (pure, build time):
  - **Lanes:** from `assetLane`, so the directory and the detail pages agree.
    - Decks, carousels, banner groups and sequences group under `lane:client:project:displayGroup`.
      Everything else is one tile.
    - The `role` lane stays out. Album covers are single tiles. The hero stays.
  - **Faces:**
    - A deck shows its lowest `brandDeckOrder` page.
    - A banner group or carousel shows its first member by `orderRank`.
    - A sequence cycles (`makeSequence`); a one-member group is a plain tile.
  - **A tile** is the slim face MediaSlot already reads (`_id, title, alt, mediaType, imageUrl,
    imageDimensions, imageHasAlpha, playbackId, videoAspectRatio, frames?, sequenceRatio?`). On top
    of that it carries:
    - `client`;
    - `services` (slugs, the group's union);
    - `href` (the featured route, or null);
    - `label` (the project title);
    - `fit`.
  - **Fit:** `'contain'` when the image has alpha or when a cover crop would lose more than half of
    it. Banners (4.77:1) and wide logos letterbox on near-black.
  - **Order:**
    - `project` (the default): featured projects first, in World order and each by `orderRank`.
      Then everything else by client name, project rank (no project last), `orderRank`, then
      `_id`. A group sits at its first member's place.
    - `orderTiles(tiles, 'mix')` round-robins across clients.
  - **Filter helpers:** `matchesFilter(tile, {tags, coverage})` and
    `tagPresence(tiles, coverage) → {any, inClient}` feed the filter.
- **Payload:** about 705 tiles, roughly 0.5 MB of raw props. Budget: if the gzipped
  `dist/work/directory/index.html` goes over 150 KB, the tiles move to a prerendered
  `directory.json` fetched at hydration.

**MediaSlot's directory mode** (commit 8). The detail page passes none of the new props, so it
renders as today.
- **New props:**
  - `clip`: the directory passes `PREVIEW_SECONDS`, which is 5 s. The default stays the detail cap.
  - `sizes`: adds `srcSet` and `sizes` to images, frames and posters (Sanity `w=`, Mux `width=`).
  - `gate`.
  - `fit`, written as `data-fit`.
- **With a gate:**
  - The slot has no observer of its own.
  - A lazy `<img loading="lazy" decoding="async">` poster always renders.
  - The `<video>` mounts only while the gate grants it play.
  - On revoke, the video is emptied (`removeAttribute('src'); load()`) before it unmounts, because
    useHls's native path never detaches.
  - A sequence ticks only while the tile is near the viewport.
- **`src/components/work/directory/playerGate.js` `createPlayerGate({cap, dwellMs})`:**
  - One shared IntersectionObserver (thresholds 0 and 0.5) replaces up to about 705 per-tile ones.
  - A video earns play after `dwellMs` at least half visible.
  - Grants go first-come up to the cap. Dropping under half visible hands the grant on.
  - Under reduced motion the cap is 0, so only posters show.
- **`imageConfig.js`:**
  - `wrapAt(s)`; `wrapAtDetailCap` is kept, because a test imports it.
  - The defaults the probe imports: 6 players on desktop and 3 on phones (under the globe's 7 and
    4), a 300 ms dwell, and srcset widths from 480 to 2000.
- **`sizesFor(type, ratio, fit)`** keeps cover-cropped portraits sharp.

**DirectoryGrid** (commit 9):
- **`src/components/work/directory/DirectoryGrid.jsx({tiles})`:**
  - It measures with `useGridMetrics` and chunks with `chunkFlushGrid`.
  - It renders `.dir-flow` with one `.dir-grid` per chunk at its exact height (`--chunk-rows`), so
    an unmounted chunk still holds its space and the footer reveal stays put.
- **Mounting:**
  - One IntersectionObserver (rootMargin 200%) mounts tiles only in chunks near the viewport and
    unmounts far ones. That bounds the DOM and the image memory on iOS.
  - The first window is chunk 0, so the server render matches the first client render.
  - SSR ships chunk 0 at 3 columns, exact at 1440 like the detail page's first paint, plus empty
    placeholders for the rest.
- **Tile markup:**
  - A tile with an `href` renders as `<a class="dir-tile" aria-label={label}>`, otherwise as a
    `<div>`.
  - Focus is an inset 2px cream outline; neighbours would paint over an outer one.
  - No hover label.
- **`src/styles/directory-grid.css`:**
  - `.dir-flow`'s gap equals the row gap, which is what makes the stack seamless.
  - Columns are 3, 2 and 1 at the detail grid's breakpoints (1024, 768).
  - The tile resets from masonry.css are re-scoped to `.dir-tile`.
  - A fallback covers the frame before the grid is measured.
- **A filter change** re-chunks in milliseconds. The scroll jump is §3's.

**New knobs.** Each ships as a `?param` with a bench control, per the tunables rule. Defaults hold
until Nathan names a number.
- `?dirorder`: `project`, `mix` or `shuffle`.
- `?dirplayers`: 8 on desktop, 4 on phones (6 and 3 until 11-05).
- `?dirdwell`: 300 ms.
- `?dirphonecols`: 1, the detail grid's phone layout, or 2 to compare.
- All four are read in DirectoryPage's mount effect.
- `?dirtune=1` opens a small bench with a control for each:
  `src/components/work/directory/DirectoryTunePanel.jsx`, in the house tune-panel style.
- `?tileshape` already works here through `useTileShape`.

**Probe and tests** (commit 10, plus each commit's own):
- **`globe-probe.mjs --directory[=QUERY]`:**
  - It loads `/work/directory?QUERY`.
  - It refuses the scenario flags `--detail` refuses; `--rm` and `--noclip` are allowed.
  - **The run:** hold for two preview lengths, take 12 slow steps, fling 20 steps, then hold again.
    It samples the live `<video>`s and the posters in view.
  - **Gates:**
    - the diet gates, now owing the 5 s clip;
    - `directoryCovered`: every video tile held half-visible got a master, unless the cap was full;
    - `playersCapped`;
    - `flingDwell`: no master is requested during the fling, once past the dwell;
    - `noErrors`;
    - `posterOnly` under `--rm`: no masters, no `<video>`, and posters in view.
  - It exits 2 on a miss. A `--noclip` run must fail; that's the negative control.
- **`netReport.mjs`:** the directory owes the preview clip, replacing the exemption.
- **`scripts/test/flush-grid.test.mjs`:**
  - Tiles stay inside the grid and never overlap. Underlays are bounded.
  - Regions are respected and the columns are covered.
  - `classifyTile` at its edges.
  - 1 and 2 columns don't throw, and the output is deterministic.
  - A snapshot of the detail page's call, taken at commit 2.
  - Seeded lists of up to 705 tiles at 1 to 3 columns.
  - Chunks partition the list contiguously and each stays under `maxRows`.
  - Natural cuts equal the single-grid result, and forced cuts stay at or under 10% on a mix shaped
    like the live data.
- **`scripts/test/directory.test.mjs`:**
  - **Grouping:** two clients' `brand-guidelines-deck` give 2 tiles; a one-member sequence is a plain
    tile; the deck face is right; services are the group's union.
  - **Links:** only featured tiles get one.
  - **Order:** `project` follows World order; `mix` keeps the same tiles with no two same-client
    neighbours while two clients remain.
  - **`matchesFilter`:** its full truth table.
  - **Coverage:**
    - DJ Tennis → {dj-tennis, munchietown}, and Munchietown → itself.
    - In a chain A→B→C, C covers {C, B}.
    - Nulls and unknown slugs behave.
  - **`tagPresence`.**
  - **`playerGate`** with a fake observer and timers: dwell, cap, handover, and cap 0 under reduced
    motion.
  - **Fit:** 4.77 is contain, 4.0 is cover, alpha is contain.
- **`cms-frontend.test.mjs`:** `DIRECTORY_QUERY` runs through groq-js on the fixture, then
  `buildDirectoryTiles`; Munchietown's tiles show under `?client=dj-tennis`.
- **`globe-worlds.test.mjs`:**
  - :1062 expects the preview clip, plus a trailing-slash case.
  - New: a directory master clipped at the detail cap fails `streamClip`.
  - New: a session playing past 5 s fails `loops`.

### 3. The filter section: `DirectoryFilter` + `FilterTag` (commits 6, 9)

**The recipe it copies**, measured from `SiteShell.jsx:180-224`, `InfoPanel.jsx:34-165` and
`global.css:1554-1675` / 4270-4368:
- **Drawer:**
  - opens in 0.6 s `power3.out`;
  - closes in 0.48 s `power2.inOut` after 0.15 s;
  - the nav rides its bottom edge.
- **Names:**
  - enter with x −16 → 0 and opacity 0 → 1, 0.35 s `power3.out`, 0.02 apart;
  - the header enters in 0.35 s at `'-=0.3'`.
- **Scroll thumb:**
  - 4px, pill-shaped, in `--project-color` (electric blue fallback), `max(ratio × track, 20)` tall;
  - scales in from `center top` in 0.3 s `power3.out` after 0.6 s;
  - retracts in 0.2 s `power3.inOut` before the drawer closes;
  - appears at ≤768 only.
- **Type:**
  - Names use `--font-body` (ABC Areal, the house Sans; there is no `--font-sans`): 400, 2.4vw,
    line-height 0.8, −0.02em. At ≤768: 1.571rem / 0.9.
  - The header is Iosevka Term: 0.95vw, uppercase, −0.07em, line-height 1. At ≤768: 11px.
- **Spacing:**
  - list gap 4px;
  - columns `clamp(0.571rem, 2vw, 1.714rem)`;
  - padding `--space-4`.
- **What the drawer lacks and the filter adds:** a reduced-motion branch, and `data-lenis-prevent`.

```
┌ .dir-filter (sticky, under the nav) ──────────────────────────────────────┐
│ ▢ Branding  ◉ Album Art  ▢ Event / Tour Creative  ▢ 2D Animation  …      │ row 1, collapsed (>768)
│ ▢ Promo Video  ▢ Logo Design  ▢ Web Design  …                            │ revealed on expand
├ [DJ Tennis ×] · 12 OF 705 · × clear all                     see less ↑ ┤ bar rides the bottom edge
└───────────────────────────────────────────────────────────────────────────┘
  grid, pushed down as the section opens
```

- **Collapsed:**
  - Above 768px it shows one row of tags. At ≤768 it shows the bar alone.
  - Tags the collapse hides are `inert` and re-measured on resize, so Tab never lands on one.
- **Tags:**
  - Each is a `<button role="checkbox" aria-checked>` inside
    `#dir-filter-tags[role=group][data-lenis-prevent]`, showing `name` as stored.
  - A tag with no tiles is hidden (VFX today).
  - A tag the active client would empty is dimmed to 0.35 with `aria-disabled`.
- **Type tokens:**
  - The drawer's name and header recipes become tokens in `global.css`, with their ≤768 overrides.
  - `.clients__*` and `.dir-filter__*` both read them.
  - The tokens are shared, not the classes, because `.clients__header` turns sticky at ≤768.
- **The checkbox** is `src/components/ui/CheckIndicator.jsx` `{checked, variant}`, moved out of
  `ProjectOverlay.jsx:22-94`.
  - `circle-check` is the inquiry form's, unchanged.
  - `square-eye` (new):
    - A 16-unit square, an almond eye path and a pupil, sized in em beside the label.
    - The stroke width rides `--check-stroke`. The eye draws with `pathLength="1"`; not with
      `non-scaling-stroke`, which breaks the draw.
    - **On:** the square's alpha goes 0.35 → 1 in 0.2 s, the eye draws in 0.35 s `power3.out`, and
      the pupil fades in at +0.15 s. That's the form's split of circle fade and check draw.
    - **Off:** everything goes in 0.2 s `power2.inOut`.
    - **Reduced motion:** zero durations.
- **The bar**, in the mono header type:
  - (`services (n)` dropped 11-05, Nathan);
  - the active client as a chip (`aria-label="Clear client: DJ Tennis"`, truncated at 45vw);
  - a polite live count, the numbers alone in mono ("works" is for screen readers only, 11-05);
  - "× clear all" (the house `CloseIcon` before it), only while something is filtered;
  - at ≤768, while shut and anything is ticked, `n active` ("1 active") just left of the toggle; open,
    the tags show it, so it goes;
  - the toggle (`aria-expanded`, `aria-controls`): `see all` shut and `see less` open, and at ≤768
    `filters` / `close filters`, since shut there hides every tag, then an arrow with a stem (drawn
    like `CloseIcon`), down shut and turned up open (11-05, Nathan; no underscores, no triangle).
    These are in the sans link tier (`--text-link`), lowercase; the count keeps the mono header type.
  - A ticked tag's label fills: the keyword highlight's box, brand blue under white ink, wiping in
    while the eye draws (11-05, Nathan: the default album-art tick read as off).
- **Motion:** `useGSAP` + `contextSafe`. Each toggle kills the previous timeline and starts from the
  current height.
  - **Open:**
    - The region goes to `min(scrollHeight, cap)` in 0.6 s `power3.out`, then to `height: auto`.
    - Revealed tags slide x −16 → 0 and fade 0 → 1 in 0.35 s `power3.out`, 0.02 apart, from 0.15 s.
    - The cap is `calc(100dvh − nav − bar)`. Past it the region scrolls inside
      (`overscroll-behavior: contain`) and wears the drawer's thumb.
    - The thumb comes from `src/components/ui/useScrollThumb.js`, lifted out of
      `InfoPanel.jsx:78-165`.
  - **Close:** the thumb retracts in 0.2 s `power3.inOut`, then the height closes in 0.48 s
    `power2.inOut` from 0.15 s.
  - **Reduced motion:** instant.
- **Hover and focus:** the house label underline (`global.css:1279-1283`) and focus ring
  (:1325-1329).
- **Push while stuck:** `overflow-anchor: none` goes on the scroller (`html:has(.dir-page)`). On the
  grid alone, Chrome anchors to another node and cancels the push.
- **Sticky seat** (`src/styles/directory.css`):
  - `position: sticky; top: var(--nav-height); z-index: 20`, on black, with `top` transitioning like
    the shell's back-off.
  - **Desktop footer reveal:** the nav slides up under
    `html[data-footer-revealed]:not([data-chrome-open])` (`global.css:2732`). The filter follows
    under the same selector:
    `top: calc((1 − var(--footer-reveal, 1)) × var(--nav-height)); transition: none`.
    - It moves on `top`, not a transform, which would drag an unstuck filter off the grid.
    - At ≤768 the nav doesn't slide, so the filter doesn't either.
  - The drawer (z 100) covers the filter. Opening the drawer cancels the footer slide, and nav and
    filter ease back together.
- **A filter change while stuck:**
  - First, jump instantly to the filter's sticking point:
    `getLenis()?.scrollTo(y, {immediate: true, force: true})`, else `window.scrollTo`.
  - Then apply the filter.
  - A smooth glide would load every tile on the way, and could land in the footer.

### 4. The drawer: the roster from Sanity, then names that filter (commits 5, 7, 12)

- **Roster** (commit 5): `toDrawerRoster(clients, tiles) → [{name, slug, live}]` in
  `clientCoverage.js`.
  - It derives from `getDirectoryData()` (§2), so the drawer and the grid can't disagree.
  - `live` means the client's coverage holds at least one tile.
  - Sorting uses `localeCompare('en', {sensitivity: 'base', ignorePunctuation: true})`.
  - If BaseLayout's fetch fails, the roster is `[]` with a warning. The directory page itself fails
    the build loudly.
- **Commit 7, the roster only:**
  - `BaseLayout.astro` passes the roster to `<SiteShell roster>`, which hands it to InfoPanel.
    - That's about 6 KB of HTML per page.
    - It's identical on every page, so the persisted shell never re-renders.
  - InfoPanel builds its three columns from `roster`, keyed by slug.
  - `CLIENTS` in constants.js retires; InfoPanel is its only importer.
  - `.info-panel` gets `inert={!isOpen}`. Nothing makes the closed drawer inert today, so links
    would be tabbable off screen.
  - `.clients` gets `data-lenis-prevent`.
  - Today that makes 59 names: 48 live (the 47 with media, plus DJ Tennis), and 11 plain until §6
    links them.
- **Commit 12, names filter:**
  - **Markup:**
    - A live name becomes `<a className="clients__item" href="/work/directory?client=slug">`.
    - The active name gets `href="/work/directory"`, so clicking it clears the filter, plus
      `aria-current` and the eye indicator after it. The eye goes after the name so the column's
      left edge stays clean.
    - Plain names stay spans.
  - **Click:**
    - A modifier or middle click is left to the browser.
    - Otherwise SiteShell's new `onClose()` closes the drawer.
    - On the directory, `preventDefault()` and dispatch `swm:directory-client {slug | null}` on the
      next frame.
    - Elsewhere, ClientRouter soft-navigates to the href.
  - The drawer reads `location` when it opens, to mark the active client.
  - **Styles:**
    - a pointer and the house underline (check it clears the next row at line-height 0.8);
    - `[aria-current]` in `var(--project-color, var(--color-electric-blue))`;
    - rewrite the comment at `global.css:1666-1667`.

### 5. The page, the route and the nav (commits 9, 11)

**DirectoryPage** (commit 9): `src/components/work/directory/DirectoryPage.jsx`, a `client:load`
island.
- **Props:** `{tags, clients, tiles}` from `getDirectoryData()`.
- **Root:**
  - `.dir-page` carries `data-nav-accent-page=""`; without it, RouteFill keeps the previous page's
    accent.
  - It has `padding-top: var(--nav-height)`.
- **Scroll:**
  - Unlock it on `html:has(.dir-page)` and its body, as `project-detail.css:8-19` does for the detail
    page.
  - Lenis runs here, since `smoothScroll.js:30-33` exempts only `/` and `/work`.
- **Footer:** it ends with `<SiteFooter />` in reveal mode, like the detail page.
  - SiteFooter's ResizeObserver watches only its own panel (`SiteFooter.jsx:751`).
  - It now observes `#main` too, so a filter that shrinks the page re-measures the reveal.
  - Check the detail page and /process after this change.
- **URL state:** `?tag=a,b&client=slug`.
  - **Read** in a `useLayoutEffect`. Unknown or empty slugs are dropped, tags the client would empty
    are pruned, and the URL is rewritten if anything changed.
  - **Written** with `history.replaceState(history.state, '', url)`; a null state breaks Astro's
    Back (`router.js:393-395`).
  - **No unfiltered frame:** until the URL is read, `data-pending` holds `.dir-flow` at
    `visibility: hidden`. Heights hold, and chunk 0's in-view posters still start loading.
  - **Scroll restore:** `history.state?.scrollY` is re-applied on the next frame, because Astro
    restores scroll before the island hydrates.
  - **The `swm:directory-client` event** sets or clears the client in place.
- **While it's being built:** `directory.astro` renders in dev only:
  `if (import.meta.env.PROD) return Astro.redirect('/work')`.

**Route on** (commit 11), all in one commit, per the "canonical launch bug" note at
`process-page-spec.md:236`:
- Remove the PROD redirect.
- Delete the forced 302 at `netlify.toml:5-11`. The /lab/globe and /specimen blocks stay.
- Drop `/work/directory` from `SITEMAP_EXCLUDE` (`astro.config.mjs:8`).
- **SiteNav:** `⊞ project_directory` goes after featured_projects, on desktop (:347) and in the phone
  menu (:421).
  - ⊞ is in ⊙'s Unicode block and falls back to the same system face as today's glyphs.
  - `refreshCurrent` (:199-220) learns the new href, so featured_projects isn't marked current on
    the directory.
  - Check that five links fit at 769–1024px.
- **Back to /work:** Back from the directory to /work re-arms `swm:returnToWork`
  (`BaseLayout.astro:180-190`), which reopens the World the visitor left. Keep it, and update the
  comment at `FeaturedProjects.jsx:302-304`.

### 6. Data step: links for the names without media (Nathan supplies them)

- **The model already exists, so no schema change:**
  - `client.affiliations[]{entity → client, relationship}`. The schema calls the entity the
    "related labels, management companies, or parent entities" (`src/schemas/client.ts:44-78`).
  - **Coverage rule:** a name covers its own media, plus the media of every client that names it as
    entity.
  - **Effect:** a label, manager or owner pulls in its children's work, and an artist never pulls in
    a whole label's catalogue.
- **Today:** Munchietown → `label-of` → DJ Tennis, so "DJ Tennis" already filters to Munchietown's
  12 assets.
- **Still unlinked:** Annabel Englund, Audiojack, COCO Records, Circus Music, D'Witches, Easier Said,
  HOMEGRWXN, Helix Records, Malóne, Panorama360, Ultra Records. Each is a plain name until linked.
- **How the links land:**
  - Nathan says which client or clients each name stands for, for example "COCO Records ← COCO" or
    "HOMEGRWXN ← Rossi.".
  - One `--changes` file patches each child's `affiliations` as the whole keyed array.
    `contract.mjs:40,72` already validates the field.
  - `plan` is read-only and prints the plan id. `apply` and `verify` run only on his yes to that id,
    in the plain `node --env-file=.env.local scripts/cms.mjs …` form.
  - Or he edits them in Studio himself.
- **Spelling:** names follow Sanity's spelling, for example "Le Yora" and "HOMEGRWXN".
- **Near-duplicates:** "COCO" (92 assets) beside "COCO Records" (0), and "Rossi." beside
  "HOMEGRWXN", stay until the data changes. Merging, renaming or keeping them is his call.

### 7. Docs and bookkeeping (commit 13)

- **`CONTEXT.md`:**
  - Add DirectoryPage, DirectoryGrid, DirectoryFilter, FilterTag and the shared CheckIndicator to
    the vocabulary.
  - Point ServiceTag's note to FilterTag.
  - New terms: **Client Roster** and **Client Coverage**.
  - The Album Art rule: album art joins the directory as square tiles.
  - The route map marks `/work/directory` live.
- **Tunables:**
  - `tag` and `client` join the `IGNORE` set at `scripts/tunables-keys.mjs:26`, since they're route
    state (like the form's `email`), and get a line under "Not a tunable" (guide :786).
  - Add a row for each new §2 knob, and the `?dirtune=1` bench under "Bench panels at a glance".
  - The `?tileshape` row gains `/work/directory`.
  - `node scripts/tunables-keys.mjs --check` passes.
- **`docs/project-directory-plan.md`:** this plan, its status and §8's note. Add a dated line at
  `docs/v1-launch-plan.md:90`.
- **The codebase map**, via `/codebase-mapper:update-codebase-map`:
  - entry-points and modules;
  - communication: the event, the roster prop chain, the URL state, `data-pending`;
  - database, directory-structure and patterns.

### 8. Later: fun filters (a note only; nothing here builds them)

This lands in `docs/project-directory-plan.md` under "Later". It can also be filed as a GitHub issue,
on Nathan's yes.

- **One colour key per asset, stored in Sanity:**
  - Computed at ingest by the CMS pipeline, with one backfill plan for the existing assets.
  - Images come from a 64px Sanity CDN render, videos from Mux thumbnails at a few times. sharp,
    already a dependency, reduces each to a dominant colour.
  - Stored as `colorKey {hex, l, c, h}` (OKLCH) on `mediaAsset`. That's a schema change, so it gets
    its own commit, and the runner's schema fingerprint is re-recorded.
  - **Why not Sanity's built-in palette:**
    - only 504 of 700 images have it (`extract: ['image']`, `adapters.mjs:199`);
    - Sanity never adds it after upload;
    - videos get none.
  - **Alternative:** a generated `colorKeys.json` in the repo. It leaves Sanity untouched, but it
    drifts.
- **Rainbow order:** sort by OKLCH hue. Low-chroma assets collect at the end, ordered by lightness.
- **Checkerboard:**
  - Each asset is light or dark by OKLCH L; the threshold is a tunable.
  - The flush grid knows each tile's row and column, so it can fill cells by parity from a light
    queue and a dark queue. That gives a real checkerboard, not an alternating list.
- **Colour slider:**
  - A stepped hue ramp: 12 steps plus a neutral one.
  - The stop is dragged on the house drag engine (`src/lib/dragMomentum.js`).
  - It shows the assets in the stop's step. A chroma floor keeps greys from matching every hue.
- **Other ideas:** still/motion, shape, a year scrubber, shuffle, an order by each World's
  `projectColor`.

### Verification

- **Unit tests and checks:**
  - `node --test scripts/test/flush-grid.test.mjs` and `node --test scripts/test/directory.test.mjs`;
  - `npm run test:cms`, which includes `cms-frontend` with `DIRECTORY_QUERY`;
  - `node --test scripts/test/globe-worlds.test.mjs`;
  - `node scripts/tunables-keys.mjs --check`.
- **The detail page doesn't move:**
  - Commits 2–3 give a normalized `dist` HTML diff that comes back empty, and pixel-identical
    screenshots of all 15 detail pages at three widths.
  - `globe-probe.mjs --detail=<slug>` passes as before.
- **The probe:** run against `:4330` with `GLOBE_PROBE_BASE`.
  - These must pass: `--directory`, `--directory=client=dj-tennis` and `--directory --rm`.
  - This must exit 2 on `streamClip`: `--directory --noclip`.
- **Browser:** Playwright, one browser at a time, at 1440 and 390. Use the :4330 dev server through
  commit 10, and `astro preview` after commit 11.
  - **Filter:**
    - The collapsed state at each width.
    - Open and close frames at 0, 0.3 and 0.6 s.
    - Tab skips hidden tags, Space toggles a tag, and reduced motion is instant.
  - **Sticky:** the filter sticks under the nav. At footer reveal 0.5 and 1: no gap at 1440 and no
    slide at 390.
  - **URL:**
    - `history.state.index` survives toggles.
    - A toggle deep in the grid lands at the sticking point.
    - Back and forward restore the filter and the scroll with no unfiltered frame.
  - **Drawer:**
    - It shows 59 names, 11 of them plain.
    - From `/`, DJ Tennis opens the directory with 12 tiles and the chip.
    - Reopening shows the eye, and clicking that name again clears the filter in place.
  - **Grid:**
    - Chunk seams are invisible.
    - Banners letterbox.
    - Featured tiles link to their project; the others don't.
    - Tabbing through 100 tiles keeps focus visible, and the mount window follows it.
    - `dist/work/directory/index.html` gzips to 150 KB or less.
  - **Regressions:**
    - The inquiry form's check is unchanged.
    - `?client=calussa` reaches the footer without scrolling.
    - At 2560×1080 the info pill stays on screen.
- **On Nathan's phone, at the machine:** scroll feel, video start-up, memory across a long scroll,
  and `?dirphonecols=2` against 1.
- **After the route goes on, on a draft deploy:** `curl -sI …/work/directory` returns 200 and the
  sitemap lists it.

### Open calls (none block the build)

- **The drawer at 59 names:**
  - It grows to 20 rows per column, up from 14.
  - The first-open cascade grows from 0.8 s to 1.16 s at 0.02 apart. It stays that way unless he
    wants the total held.
  - At 2560×1080 the panel plus nav reaches about 1068 of 1080px.
- **Phone columns:** 1, as on the detail grid, or 2 (`?dirphonecols`).
- **Extreme ratios:** Salomé Le Chat's 21:1 piece is a sliver even when letterboxed. A full-width band
  tile is a later option.
- **Near-duplicate names:** they stay until §6's links land.
- **Detail-page follow-ups seen on the way:** not changed here; separate commits on his word.
  - Videos autoplay under reduced motion.
  - Posters are eager 1400px images with no srcset.
  - Holes appear at ≤1024 under the sparse auto-flow.
  - useHls's native path never detaches.
  - Alpha logos are cover-cropped.
