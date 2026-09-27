# Globe Worlds: three ways to populate the home globe by featured project

*Branch `refine/globe-worlds` (worktree `../swm-globe-worlds`, off `feature/v1-launch` 18957ae). Plan approved 2026-09-23; re-scoped at the P2 checkpoint (2026-09-26: Blend becomes pointer / drag travel between worlds, Procession drops, Dive folds into P3). Status: P3 done (Enter World lands inside the world on the globe), at the P3 checkpoint — see the Status log at the end.*

## Context

Today the home globe is a flat, tiered pool (`GLOBE_ASSETS_QUERY` → `buildAssetPool`) that is
video-only and round-robins across clients so no client's work clusters. The globe therefore reads
as a random sample of the media directory. The goal is the opposite: from first load the globe
should read as client worlds. Coherent clusters of one project's media make "we build full
concepts and long-term brand visions" obvious. The same idea should carry into the Enter World
dive, so the world you see on the globe is the world you land inside on /work.

The deliverable is a branch with three switchable population modes on one shared engine. Every
knob is a live `?param` with a new bench, so they can be dialed side by side. Nothing gets baked
until you give the numbers.

1. **Tides** (time-driven, your idea #1): groupings of 1–3 projects in irregular clusters, cycling
   through varied transitions and patterns, with dialable unpredictability.
2. **Blend** (input-driven, your idea #2): the pointer's X-Y position, or dragging the globe,
   scrubs one world into another.
3. **Procession + Dive** (attention-driven, your pick): the meridian scroll carries a river of
   world territories. Hovering or tapping one blooms it across the globe, and Enter World dives
   into it.

Facts the design rests on:
- 13 featured projects. Their showcase media is lopsided: COCO Pre-2026 has 33 videos while
  Munchietown has 1 video and 11 stills; Hurry Up Slowly and Imperfect Records are mostly stills.
  So the globe has to learn to show stills.
- The resting scroll pace (cascadeSpeed 2) is about 90 s pole to pole, one new row every ~15 s.
  Any transition that uses the scroll must surge it.
- A tile flow built on a cross-dissolve was rejected on 07-18 because assets must stay persistent.
  Nothing here dissolves. At rest the tiles keep their assets. Visible changes either arrive from
  the pole or hide under a blink or blue surge.
- /work always opens at World 0 today (`FeaturedProjects.jsx:307-321` restores only on a
  detail-page return). Setting an index after mount plays a World Turn (`useWorldScene.js:1173-1178`).

## Setup (your answer: worktree)

```
git worktree add "../swm-globe-worlds" -b refine/globe-worlds feature/v1-launch   # off 18957ae
cd "../swm-globe-worlds" && npm install
npm run dev -- --port 4322        # runs beside :4321 in this checkout
```
- The worktree is a sibling of `swm-pass-2`. The uncommitted /process work in this checkout stays
  untouched, and this plan never edits `panelMaterial.js` (the file that work modifies), so the
  later merge will not conflict.
- The first commit on the branch is this plan as `docs/globe-worlds-plan.md`, then one commit per
  phase. Nothing is pushed unless you ask.
- Execution runs inline in this session. The Explore subagents failed through the model-gateway
  earlier (503 at 127.0.0.1:18764), and every phase ends in a dial session with you, so the phases
  form one sequential chain. Once `node ~/.claude/model-gateway/model-gateway.js doctor` reports
  healthy, the pure P1 pieces (`buildWorldPools`, `worldPatterns` with their tests, and
  `globe-probe.mjs`) can go to board executors instead.

## The shared engine (built once, used by all three modes)

1. **Worlds data on `/`.** `src/pages/index.astro` also fetches `FEATURED_WORLDS_QUERY`. The query
   is unchanged; it already feeds /work. A new pure `src/components/globe/buildWorldPools.js`
   reuses `buildContentFlow()` (`work/detail/buildContentFlow.js`), so a globe cluster holds the
   same media as that project's /work World.
   - Each project carries: `slug` (same rule as `work/index.astro`:
     `p.slug || toProjectSlug(clientSlug, collection)`), `clientName`, `title`, `projectColor`.
   - Each asset carries `{id, kind: video|still|art, playbackId?, imageUrl?, videoAspectRatio?,
     mediaType}`, with a hard cap of 32 per project.
   - Video status accepts ready and preparing (the `buildAssetPool` rule).
   - `globeAssets`, `GLOBE_ASSETS_QUERY` and `buildAssetPool` stay exactly as they are. /process
     and the default path use them.
2. **Stills on the globe.** `TextureManager.js` loads by asset.
   - Keys are `playbackId ?? imageUrl`, so video keys are unchanged (parity).
   - Stills request `?w=T&h=T&fit=crop&auto=format`, square like Mux smartcrop, so
     `computeCoverUv(1, …)` stays uniform.
   - `LivePanelScheduler.js` skips assets with no `playbackId`, so stills never promote to live video.
3. **Tape coordinates.** Every scroll tile gets a coordinate `(lon, s)`: its `lonIndex` plus a
   monotonic birth index that `MeridianScroll` gives each row. Initial rows are ordered by their
   scroll-0 θ, and each recycle adds 1.
   - Patterns are pure functions over this lon-periodic tape. Clusters travel pole to pole with
     their tiles, and they extend forever as new rows are born.
4. **MeridianScroll hooks** (`MeridianScroll.js`):
   - An optional `assign(panel)` callback replaces `nextPoolAsset()`. When it is absent, today's
     cursor runs (parity).
   - A new `setRateScale(k)` drives the tide surge and the procession flow.
   - Its refcount-safe `loadThumb` moves into the new `tileSwap.js`, so the scroller and the
     director share one ownership path and the `heldThumbId` fix stays single-sourced.
5. **Tile swap primitive** (`src/components/globe/tileSwap.js`). `swapTile(panel, asset,
   {style, delay, ms})` has three styles:
   - `blink`: a CRT dip on `uPower` with the swap at the bottom (the cascade flicker vocabulary).
   - `surge`: the commit's blue two-beat on `uBlueMix` with the swap under full blue (the
     `surgePanel` shape from `useGlobeScene.js:80-91`).
   - `cut`.

   A live tile first calls a new `scheduler.dropLive(panel)`, which releases the video instantly
   under the dip instead of running the 0.6 s video→still fade. Staggers reuse `panelDelay` from
   `cascade.js` read-only, or a distance-from-origin delay. There are **no shader changes**; only
   existing uniforms are used.
6. **PopulationDirector** (`src/components/globe/PopulationDirector.js`). `useGlobeScene` builds it
   only when `popmode` is not `off` and the globe is in conveyor mode. It:
   - owns tile→(project, asset) assignment, including the initial build assignment, so the very
     first cascade already reveals clustered worlds. It keeps a per-project cursor and never puts
     the same asset on a lon or row neighbor.
   - warm-prefetches the current and next grouping. It holds its own texture refs, so a swap never
     waits on the network or shows a black tile.
   - waits for the intro hold (`releaseScheduler`) and the entrance cascade, and freezes when the
     commit engages `setBlueFill`.
   - ticks after `scroller.update`, reading yaw and drag from the existing
     `InteractionController` / `lib/dragMomentum.js` (no second drag engine).
   - exposes `focusProject()`, `next()` and `stats()`.

   Under reduced motion it lays out the first grouping as static clusters, with no transitions,
   no input and no video.
7. **Patterns** (`src/components/globe/worldPatterns.js`, pure). Seeded with `hashSeed` and
   `mulberry32` from `work/world/seededLayout.js`, which /process already shares. The patterns:
   - **continents**: Voronoi on the tape, about 2 seeds per project.
   - **archipelago**: about 5 seeds per project.
   - **gores**: longitude sectors with jittered edges.
   - **bands**: stream ranges with jittered edges.
   - **spiral**: gores with a longitude offset per row, so clusters corkscrew as they travel.
   - **facets**: for 1-project groupings, Voronoi cells drawn by media kind, so one world reads as
     a system.

   The module also provides the coherent threshold field τ(lon, s) that Blend uses. Each
   project's share is equal, or weighted by its media count.
8. **Bench.** `?poptune=1` mounts `src/components/hero/PopTunePanel.jsx`.
   - It is lazily imported after hydration (the `Hero.jsx:474-491` HeroTunePanel convention) and
     reuses the `hero-tune__*` chrome. It sits bottom-right; `?herotune` is top-right and `?debug`
     is bottom-left.
   - `src/components/globe/popConfig.js` holds the `TUNING`, `PARAM_KEYS`, subscribe and
     `copy_url` pieces, following the `heroConfig.js` idiom. `copy_url` writes only off-default
     values.
   - Sliders are live because TUNING is read at use time. Switching mode rebuilds only the
     director, never the scene.
   - Readout: grouping names, phase and ETA, focus, integrity, black tiles, flips/s, textures,
     live videos per project, fps, seed.
   - Buttons: ⏭ next grouping, ↻ reroll seed, ↺ reset, copy_url.
   - It publishes `window.__swmPopStats` for the probe (the `ProcessDebugPanel.jsx:107` idiom).

## Option A: Tides

- Groupings of `popgroup` projects (1–3, default 2) hold for `pophold` seconds (± `popholdjit`).
  Each change brings a new pattern.
- The next grouping comes from `poppair`:
  - `sequence`: editorial order.
  - `relay`: A+B → B+C. The world that carries over keeps its tiles untouched.
  - `lineage`: one client across two eras, i.e. COCO (Pre-2026) ↔ COCO and Heavy House Society
    (Pre-2026) ↔ Heavy House Society. This is the literal "long-term brand vision" read.
  - `random`.

  `popcarry` sets the chance of keeping one world.
- Each change picks one transition from `poptransset`:
  - **tide** (default, persistent): the conveyor surges. The rate scale launches steeply and
    settles with no overshoot, so the new grouping pours in from the top pole and the old one
    drains out the bottom in `poptrans` seconds. `popboost` caps the surge's peak speed; `auto`
    derives it from `poptrans`.
  - **blink** or **surge**: in place, staggered by `popstagger`.
  - **bloom**: in place; each new cluster grows outward from its Voronoi seed.
  - **cut**.
- Unpredictability:
  - `popchaos` 0 is the strict editorial sequence; 1 randomizes partner, pattern and transition on
    every change.
  - The seed is random per visit; `popseed` pins a run while dialing.
  - `popstray` adds rare tiles from the partner world inside a cluster.

## Option B: Blend

- Worlds A and B are both kept warm. Each tile carries a threshold τ from the coherent field and
  shows B once τ < m (the blend value). As m rises, B's islands grow organically through A like a
  level set, not a wipe.
- `popinput` chooses the source of m:
  - `pointer` (desktop): the X position across the viewport, with a critically damped follow
    (`popfollow`) and no overshoot.
  - `drag` (mobile default): the globe's existing drag yaw. Spinning `popdragrange`° moves A→B,
    and the momentum carries the blend.
  - `auto`: a slow drift, used as the idle fallback.
- `popaxis` sets what Y does:
  - `grain`: Y reshapes the field live, from continents to speckle.
  - `quad`: four worlds sit at the viewport corners and X and Y each blend a pair, making a true
    X-Y pad.
  - `none`.
- Flip hygiene: `pophyst` hysteresis, a `popflip` ms blink and a per-frame flip cap. After
  `pophold` seconds with no input it moves to the next pair.

## Option C: Procession + Dive

- **Rest.** New rows are born from a river of territories. Each featured project owns `popspan`
  rows of the tape, with a ragged, Voronoi-jittered frontier to the next.
  - `popflow` scales the scroll pace so a new world rises from the top pole at a readable cadence.
  - `poplanes`=2 runs two worlds side by side.
  - There are no timers and no in-place swaps; the brand motion alone carries world after world.
- **Dive.** Hover on desktop or tap on mobile does an analytic ray–sphere pick in globe space
  (cheap, and works with the shader-displaced tiles) to find the tile, then its project.
  - That world blooms tile by tile outward from the pointer (`popbloom` s, blink swaps ordered by
    tape distance) until it fills the globe. Rows born meanwhile keep its media.
  - When the pointer leaves or goes idle for `popdive` s, it recedes back into the procession.
  - Focus is the dived world, or else the territory under the camera center.
- This is the full "diving deeper" ladder: all worlds → one world → inside it.

## Shared: enter the world you see (Phase 3)

- `getFocusProject()` joins the scene api:
  - Tides: the grouping lead, or whichever world has the largest visible share.
  - Blend: the dominant side of m.
  - Procession: the dived or facing territory.
- `Hero.jsx` `beginEnvelopment` writes `sessionStorage['swm:enterWorld'] = slug` before
  `navigate('/work')`, when `popenter` is on.
- `FeaturedProjects.jsx` consumes that key once on mount and finds the World index by slug. The
  arrival is a **snap**: a one-shot direction-0 `goToWorld` in `useWorldScene.js`, with no World
  Turn from World 0, applied before `swm:fill-release`. The `swm:returnToWork` restore stays as is.
- Optional: the commit's blue surge starts from the focus cluster. The director computes delays by
  distance from the cluster's centroid; `cascade.js` stays untouched.
- As built (P3): see the P3 entry in the Status log. The optional focus-cluster surge is not built.

## Params (all new, prefixed `pop`; `cluster`, `jitter`, `hold` and `pattern` are taken elsewhere)

| group | keys (defaults) |
|---|---|
| gate / global | `poptune=1` (strict gate) · `popmode` off\|tides\|blend\|procession (off; P1 ships off\|tides) · `popseed` (random per visit) · `popmedia` showcase\|all\|video\|still\|art (showcase = the /work showcase Tiles, videos + stills; all adds album art) · `popcap` (24 desktop / 16 mobile) · `popshare` equal\|weighted · `popenter` 1\|0 (1; live since P3) |
| tides | `popgroup` (2) · `poppattern` (continents,archipelago,spiral) — both live since P1 · P2: `pophold` (8) · `popholdjit` (0.3) · `poptrans` (1.6) · `poptransset` (tide) · `poppair` (relay) · `popcarry` (0.5) · `popchaos` (0.35) · `popstray` (0) · `popstagger` (random). `popboost` is dropped: the surge's peak is whatever pours the new grouping in within `poptrans`. |
| blend | `popinput` (pointer; drag on touch) · `popaxis` (grain) · `popgrain` (2.5) · `popfollow` (0.35) · `pophyst` (0.04) · `popflip` (160) · `popdragrange` (180) |
| procession | `popspan` (3) · `popflow` (2) · `poplanes` (1) · `popbloom` (1.2) · `popdive` (2.5) |

Defaults are starting points. `media`, `cap` and `share` apply live on the client, because the
pools ship tagged by kind up to the hard cap.

## Phases and your checkpoints

| phase | builds | you judge |
|---|---|---|
| P0 | worktree, npm install, plan doc commit | — |
| P1 | engine items 1–8, `popmode=tides` with holds only (static first grouping) | Do the clusters read as client worlds on first load? Pattern family? Stills OK? |
| P2 | Tides: groupings, all transitions, chaos, relay/lineage | Dial session, then send copy_url |
| P3 | Enter the world you see (/work snap arrival); with one world on the globe, this is the Dive | Does home → /work land inside the right world? |
| P4 | Blend, re-scoped 09-26: pointer / drag travel between worlds (not two worlds mixed) | Dial session |
| P5 | Procession + Dive: dropped 09-26 (one world at a time leaves no river; the Dive is P3) | — |
| P6 | Your pick → bake only your numbers (bake law), park or remove the losing modes, final docs | — |

## Parity and blast radius

- With no `popmode`, the globe is today's globe. The director is never built, MeridianScroll runs
  its old cursor, and video texture keys are unchanged.
- **Untouched:** `panelMaterial.js`, `cascade.js` (`panelDelay` read-only), `buildGlobeGeometry.js`
  (all three shared with /process), `VideoSlotPool.jsx` (/work), `buildAssetPool.js` and
  `GLOBE_ASSETS_QUERY` (/process), and all of `src/components/process/`.
- **Modified:** `index.astro`, `LandingPage.jsx`, `Hero.jsx`, `VideoGlobe.jsx`, `useGlobeScene.js`,
  `MeridianScroll.js`, `LivePanelScheduler.js`, `TextureManager.js`, and in P3
  `FeaturedProjects.jsx` and `useWorldScene.js`. The snap also reached `WorldScene.jsx`,
  `GraticulePager.jsx` and `usePagerGesture.js`; see the P3 log.
- **New:** `buildWorldPools.js`, `worldPatterns.js`, `PopulationDirector.js`, `tileSwap.js`,
  `popConfig.js`, `PopTunePanel.jsx`, `scripts/globe-probe.mjs`,
  `scripts/test/globe-worlds.test.mjs`, `docs/globe-worlds-plan.md`.
- **Docs:** a new `docs/tunables-guide.md` section plus a bench-table row. At the end, update the
  codebase map: new globe modules, the `swm:enterWorld` key in communication.md, and the bench in
  patterns.md.

## Verification

1. `node --test scripts/test/globe-worlds.test.mjs`. New pure tests cover:
   - `buildWorldPools` on a fixture: same showcase set as `buildContentFlow`, caps, kinds.
   - `worldPatterns`: seed determinism, share within ±10 %, no duplicate asset on neighbors,
     continuity across the longitude wrap.
2. `node scripts/tunables-keys.mjs --check` after every param change, with the guide rows added.
3. `node scripts/globe-probe.mjs`. It is a new sibling of process-probe (both existing probes are
   route-specific). It keeps their SwiftShader launch doctrine, reads `__swmPopStats` and saves
   screenshots.
   - Runs: `--mode=tides --secs=45`, `--mode=blend --sweep` (mouse sweeps),
     `--mode=procession --dive` (hover a territory, wait for the bloom, then the recede).
   - Each runs at 1440×900 and at `--mobile` 390×844, plus a `--rm` run.
   - Pass: integrity ≥ 0.95 during holds, 0 black visible tiles after warm-up, bounded texture
     count, no console or page errors.
4. Regression: `node scripts/process-probe.mjs --secs=15` and
   `node scripts/pager-probe.mjs --variant=scale --root=.fp-scale --scenario=rest`. In P3 also
   check: a home commit with a focus slug lands on that World with no Turn, and the breadcrumb
   return still restores.
5. `npm run build` at each phase end. Compare the size of `dist/index.html` before and after
   (props payload).
6. By eye at 1440 and 390, then on your iPhone via `npm run dev -- --host --port 4322`, against the
   original 42–44 fps mobile gate.

## Risks to watch

- **Persistence doctrine.** `tide` is the default. The in-place styles (blink, surge, bloom) are
  there for you to judge, and you can drop them per mode.
- **Mobile texture residency.** Warm grouping plus prefetch has to stay near today's ~96 bound
  textures; the probe reports the count.
- **Small pools.** Bedouin's showcase is 6 videos (its other 48 assets are deck pages), Nusonido
  has 8 and Munchietown 12. Their assets repeat inside a cluster, but never on adjacent tiles.
- **Stills crop to center.** `FEATURED_WORLDS_QUERY` has no `image.hotspot`. Add it only if the
  crops look wrong.
- **The P3 /work change** must not regress the detail-page return restore.

## Out of scope (later ideas)

- Per-cluster lattice tint in the project color (the shader is shared with /process).
- Cluster-anchored labels. First try the existing `?herolabels=1`, which already names live
  panels by client.
- The camera diving toward the focus cluster during the commit.
- Any CMS or schema change, and the merge to main.

## Status log

- 2026-09-23 · P0 · worktree + branch created, `npm install`, this plan committed.
- 2026-09-23 · P1 · engine items 1–8 + `popmode=tides` holds.
  - Landed: `buildWorldPools` (13 worlds, 257 assets, /work showcase parity; no ids in the
    props), stills on the globe (`TextureManager.loadAsset`, square Sanity crops), tape
    coordinates + MeridianScroll `assignRow` / `setRateScale`, `tileSwap.js` (the single
    refcount-safe `loadTile`, blink / surge / cut, `applyPlan`), `LivePanelScheduler.dropLive`
    (stills and mid-swap tiles never promote), `PopulationDirector` (patterns, neighbour rule,
    current + NEXT grouping held warm, freeze under the commit's blue, `window.__swmPopStats`),
    `popConfig` + `PopTunePanel` (readout under mode; phones start as a `⌁ worlds` chip),
    `scripts/globe-probe.mjs`, 9 unit tests.
  - Verified: unit 9/9 · `tunables-keys --check` PASS (295 keys) · globe-probe desktop, mobile,
    RM and off all pass (integrity 1.0 in holds, 0 black after warm-up, ≤ 57 cached / 44 GPU
    textures desktop and 36 mobile, no flips in a hold, ⏭ lands in 1.1–1.6 s and as a 0.26 s cut
    under RM, clean console) · pager-probe rest on /work clean · `npm run build` 22 pages.
    /process imports none of the modules this branch changes, and `/lab/globe` redirects to `/`.
  - Payload: `dist/index.html` 190 → 247 KB raw (+57 KB), +10 KB gzip / +6 KB brotli, shipped
    even with `popmode` off. P6 settles it: a winning mode lets home drop the flat
    `globeAssets` (the director feeds every tile), or `off` wins and `globeWorlds` goes.
  - Found: the probes' `new URL(import.meta.url).pathname` percent-encodes this Dropbox path and
    mkdirs a stray `Small%20World%20Media` tree. Fixed in globe-probe; pager-probe still has it,
    so pass it an explicit `--out`.
  - A ⏭ re-lays all 96 tiles, the carried world's too (each grouping draws a new pattern). P2's
    relay transitions keep the carried world's tiles in place.
- 2026-09-26 · P1 checkpoint (Nathan). Two worlds on the globe at once weaken the "visual
  worlds" read; one world at a time makes it obvious what building a world means for each
  client. He likes the video repetition. He asked (Q1) whether one loaded video can feed many
  tiles, saving compute while more videos play, and (Q2) whether each world's projectColor can
  drive the globe's blue, the background gradient, the nav and the slide-down drawer, as on
  /work.
- 2026-09-26 · pager-probe's default `--out` percent-encoded path fixed (`fileURLToPath`,
  d4f471c). That commit also swept a stale Dropbox git index and reverted P1; 0c8b14d restored
  it additively. In this worktree, `git status` before every commit.
- 2026-09-26 · P2 · one world at a time, and the world changes on its own.
  - Landed: `popgroup` defaults to 1 (Nathan's call); `poplayout` mix | facets lays out one
    world, and 2–3 worlds keep the pattern set. A world holds `pophold` s ± `popholdjit`, then
    the next takes the globe over `poptrans` s through a transition from `poptransset`:
    - **tide** (default): MeridianScroll `advance()` surges the scroll one full span on
      power3.out, and every row re-births once, so the new world pours in from the top pole and
      nothing changes in place.
    - **blink / surge**: in place, through `applyPlan`'s style.
    - **cut**: under RM, before the entrance, and under the commit.

    `popchaos` runs from 0 (the /work order and the set in turn) to 1 (a random next world,
    never one of the last 4, and a random transition). The next world is planned and its
    textures warmed as each hold begins. `poptrans` defaults to 2.4 s, not the plan's 1.6,
    because the tide rolls a full pole-to-pole span. 13 unit tests (tide, chaos, cut and
    shared streams are new).
  - Q1 · shared streams (`poplive=shared`, the default under a popmode): the scheduler spends
    one VideoSlotPool slot and one VideoTexture per clip, bound on every tile showing it, so
    repeats play in sync. `tile` is today's one decode per tile. A lower `popcap` means more
    repeats per decode.
  - Q2 · world colour (`popcolor=1`): the lattice, inner sphere and pole caps ink tweens to
    the world's projectColor over 1.7 s on the panel curve (`uBlueColor` set at runtime;
    panelMaterial untouched). The scene api's `onWorldChange` feeds Hero →
    `applyNavAccent(…, { tint: 'pop-tint' })`: the /work accent vars on `<html>`. The hero
    gradient, globe stroke / fill, pill hover, Enter World CTA and the passage's colour
    read `--project-color`.
  - Verified: unit 13/13 · `tunables-keys --check` PASS (303 keys). P2's tuple-map popConfig had
    hidden every pop key from the extractor, which now reads that idiom. globe-probe:
    - **desktop** `--next=1 --paint`: every gate. 7 decodes lit 31 tiles, ≤ 42 textures, and
      the ⏭ tide landed in 2.5 s. The gradient passed through 4 in-between colours.
    - **mobile** 30 s: TOBEHONEST → Munchietown → COCO (Pre-2026) → Andhera Records on the
      clock. 4 decodes lit 22 tiles, ≤ 34 textures, and the accent landed on #FDED22.
    - **RM**: no video and no self-change; ⏭ is a 0.6 s cut and the colour lands at once.
    - **off**: no stats and no tint.

    Soft navs: Enter World carries the world's colour into /work, which then fades to World
    0's colour (the P3 gap). Back home starts blue and re-tints when the globe greets its
    world. pager-probe rest on /work is clean; `npm run build` builds 22 pages;
    `dist/index.html` stays at 247 KB (P2 ships no new props).
  - Open at the checkpoint:
    - One world at a time reshapes the other options: Blend becomes pointer / drag travel
      between worlds (not two worlds mixed on the globe), Procession's multi-world river drops,
      and Dive folds into P3.
    - Accent text (open-menu pill ink, drawer strong text, CTA label) can snap at the end of
      the 1.7 s fade (the custom-property paint trap); backgrounds fade.
    - The open menu inks the accent on white (as /work does), which has low contrast for light
      worlds (Munchietown, Andhera Records, Heavy House Society).
- 2026-09-26 · P2 checkpoint (Nathan): go ahead with the re-scope, starting with P3. Blend
  becomes pointer / drag travel between worlds (P4), Procession's multi-world river drops, and
  the Dive folds into P3.
- 2026-09-26 · P3 · Enter World lands inside the world on the globe.
  - Landed:
    - `?popenter` (default 1; on the bench, "enter world · lands in world | first").
    - The Enter World click stops the change clock: `director.hold()`, through the scene api's
      `popHold`. Unlike `freeze`, a change already rolling lands on its own curve.
    - The passage keeps the world's colour. The slug of the world on the globe (from
      `onWorldChange`, else `getFocusProject()`) goes to /work through
      `sessionStorage['swm:enterWorld']`, on the passage and on the RM path alike.
    - /work consumes the key once on mount and **snaps**: `snapRef` holds the target index for
      the arrival's commit.
      - The staging effect stages one entering card with no outgoing card, so no Turn.
      - `useWorldScene` drives direction 0.
      - `GraticulePager` steps to the station at once (`follow(i, true)` → `stepRM`) with no
        announcement.
      - The accent effect waits for the snapped world.
      - `swm:fill-release` waits for the snapped card, so the cover never lifts on World 0.
    - No key, an unknown slug, or `popenter=0` → the `swm:returnToWork` restore runs as before.
  - Blast radius beyond the plan's P3 list:
    - The snap reaches the pager: `WorldScene.jsx`, `GraticulePager.jsx`, `usePagerGesture.js`.
    - The clock hold: `PopulationDirector.js` (`hold`; `slug` and `held` in the stats) and
      `useGlobeScene.js` (`popHold`).
    - The knob: `popConfig.js`, `PopTunePanel.jsx`.
  - globe-probe `--enter`: 10 gates. It clicks Enter World on a world whose slug and colour
    differ from World 0's, then follows the arrival with an in-page recorder
    (MutationObserver + rAF). Polling from Node sampled 3 times in 3.2 s under SwiftShader and
    missed the arrival. Failed image requests now land in `report.imageFailures`.
  - Verified:
    - Unit 13/13 · `tunables-keys --check` PASS (304 keys).
    - globe-probe `--enter` desktop, mobile and RM: all 18 gates. `--next=1 --paint` 9/9;
      `--mode=off` 3/3.
    - `--extra="&popenter=0"` lands on World 0. Its one failing gate, `clean`, is two GSAP
      "target null" warnings on the COCO Branding 2026 detail page; a direct load of that page
      reproduces them, so they predate P3.
    - pager-probe rest is clean. `npm run build` builds 22 pages, and `dist/index.html` stays
      at 247 KB.
    - Production build (preview on :3333): all 18 gates, in headless SwiftShader timings: the
      cover at 1.15 s, the snap at 3.77 s, the card at 4.35 s, the fill held until the card.
  - Found:
    - **Sanity's image CDN enforces the project's CORS allowlist on images.** A preview on
      :4323 got a 403 on every still, the globe showed black tiles, and the probe's noise
      filter hid why.
      - On the list: localhost:4321, :4322 and :3333, smallworld.media, and Netlify deploy
        previews (`*--smallworldmedia-landingpage.netlify.app`).
      - Off it: the bare `smallworldmedia-landingpage.netlify.app` and 127.0.0.1. www 301s to
        the apex, so it is fine.
      - /work's world textures already depended on this; the globe's stills now do too.
    - The ClientRouter swap wipes the `<html>` accent until RouteFill's after-swap re-applies
      it, so the nav blinks brand blue over the world-coloured cover: ~165 ms in the headless
      production run, ~250 ms in dev. It predates P3, and on a real machine it may last a
      frame or less. A fix would carry the accent onto `newDocument` in `astro:before-swap`.
  - Open at the checkpoint:
    - Does home → /work land inside the right world, on desktop and on the phone?
    - The breadcrumb return still plays a Turn from World 0 and fades from its colour (the
      plan kept that restore as is). The same snap could serve it.
    - Reduced motion has no cover, so World 0's server-rendered card shows until hydration
      snaps to the world (~3.3 s headless in dev). A brief RM cover would hide it.
