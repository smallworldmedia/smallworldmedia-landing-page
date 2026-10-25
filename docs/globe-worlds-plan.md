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
     `surgePanel` shape from `useGlobeScene.js:108-119` as of P8, 10-16).
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
- **Untouched:** `panelMaterial.js` and `buildGlobeGeometry.js` (both shared with /process),
  `buildAssetPool.js` and `GLOBE_ASSETS_QUERY` (/process), and all of `src/components/process/`.
  (Until the media spans, `cascade.js` and `VideoSlotPool.jsx` were on this list too.)
- **Modified:** `index.astro`, `LandingPage.jsx`, `Hero.jsx`, `VideoGlobe.jsx`, `useGlobeScene.js`,
  `MeridianScroll.js`, `LivePanelScheduler.js`, `TextureManager.js`, and in P3
  `FeaturedProjects.jsx` and `useWorldScene.js`. The snap also reached `WorldScene.jsx`,
  `GraticulePager.jsx` and `usePagerGesture.js`; see the P3 log. The media spans (§ Media spans)
  modified two files that were on the Untouched list:
  - `VideoSlotPool.jsx` (/work too): every pooled stream is clipped to the preview window through
    `muxStream` (P0) and fetches no audio (P0v); the globe's default pin is `GLOBE_STREAM_PARAMS`
    (`?globeres`, P0c); an optional per-assign `params` (P6b) keeps the clip, and the default is
    the pool's streamParams.
  - `cascade.js`: `delayOwner`: a unit's members take their lead's delay, in the entrance and the
    blue fill (P4a); a panel outside a unit owns itself, and /process's panels never form units,
    so its cascade is unchanged.
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

## Media spans

Media spans join a globe tile to its neighbours so that one asset spans them as one picture. They
were built on `refine/globe-worlds` from P0a to P7 (10-10 to 10-16; the commits are in the
Status log). They shipped OFF behind `?popunits` until Nathan turned them on on 10-23 (Q1), and
`?popunits=0` is today's globe: the probe's `legacyParity` holds every phase to the units-off records. The design contract for the
round is a scratch file and not in the repo. This section is the repo's record of it. Where the
code that landed differs from the contract's text, "As built" below states what landed and cites
the commit. Code comments cite this section by name, and its question numbers (Q1–Q27) are the
contract's, so comments that cite Q3, Q7 and Q8 still resolve.

### What a unit is (O1, O2)

- **Unit.** One classed asset across 2×1 tiles (`h`, a horizontal pair), 1×2 tiles (`v`, a
  vertical pair) or 2×2 tiles (`q`, a quad). All members show the asset's one class texture,
  and each member crops its own slice of it. The first member is the lead. A tile that isn't in
  a unit is a single.
- **Seams: the mullion (O2).** The unit texture runs behind the lattice gaps. Each gap hides its
  own strip of the picture, `Gφ/(2Pφ − Gφ)` = **0.018676** of the unit's width per column seam,
  and the same fraction of its height per row seam. A straight line in the picture continues
  straight across the gap. Name strips keep their split windows (`nameWindow`), untouched.
- **The CPU route (O1).** `panelMaterial.js` is not edited. `director.place()` re-derives each
  member's A window (the poster's) every frame from its own live pose, right after
  `scroller.update`.
  - H: `q = vK`, so the picture is exact at every latitude. H has no latitude limit.
  - V/Q: `q = kappaOwn = √(vK · sin θ₂)`, the geometric mean of the two rows' pinch. The columns
    align exactly, and each row shows a warp of `½|ln(sin θtop / sin θbottom)|`.
- **The video window.** `B = cover(V, aTex) ∘ A`, where `V` is Mux's exact picture ratio. texB
  rides texA per frame, so the video registers with the poster.
- **Eligibility.** A V/Q unit is placed only where its warp stays within `ε = UNIT_EPS = 0.15`
  for its whole planned life:
  - the top row starts at θ ≥ θN = 47.61°;
  - it ends at θ + D ≤ θS = 102.39°;
  - the bottom row stays in front of the live horizon: θ + Pθ + D ≤ θh;
  - it clears the grain band when `?popgrainamt` > 0. With g = 0.67, that is sin θ ≥ g at both
    ends.

  H pairs take only the grain clause.
- **Travel budget D** includes the landing time:

  | Case | D |
  |---|---|
  | advance | 19.2° |
  | relayout | 20.1° |
  | held arrive | 22.0° |
  | replay initial layout, or a single world | ∞, so H only |
  | reduced motion | 0 |

  Before the first tick the horizon is null, so the initial layout is H only (M4). The first V/Q
  units come with the first change. Under `?poptransset=tide` every row is re-born, so V/Q
  units leave with their rows. Tides carry H pairs only (Q16).

### Derivations

These are the figures `unitSpan.js` implements and `scripts/test/globe-worlds.test.mjs` pins
(T1–T10, T30).

```
Lattice (read live off a scroll panel):
  Pφ = 30°   Pθ = 30°   phiLen = bandH = 28.9°   Gφ = Gθ = 1.1°
Member fractions (n = 2):
  member 0 → [0, 0.490662]   member 1 → [0.509338, 1]   seam = Gφ/(2Pφ − Gφ) = 0.018676
Unit aspects, S(cols, rows) = (cols·Pφ − Gφ) / (rows·Pθ − Gθ):
  S_h = 2.038062   S_v = 0.490662   S_q = 1      (S follows the live lattice: ?gapdeg 2 → S_h 2.00692)
Shader mirror (panelMaterial.js, read-only):
  vK = sin(clamp(θc, 0, π))   mUv = (0.5 + (vUv.x − 0.5)·vK, vUv.y)   uv = mUv·s + o
A = compose(coverWindow(aTex, S), memberWindow(…))    B = compose(coverWindow(V, aTex), A)
V/Q scale: q = √(vK · max(sin θ₂, 1e-3)), θ₂ = θ ± Pθ (vK when θ₂ leaves (0, π))
ε window: thetaBound(k, Pθ) = atan2(k·sin Pθ, 1 − k·cos Pθ)
  θN = thetaBound((1 + ε)^−2) = 47.61°   θS = thetaBound((1 + ε)^2) = 102.39°   (ε = 0.15)
Travel budget: pace·(land + hold·(1 + holdJit) + trans); defaults pace 2°/s, hold 6, holdJit 0.4, trans 0.6 (Nathan 10-23)
  advance (land 0.6 s) 19.2° · relayout (land 1.05 s) 20.1° · held arrive 22.0° · RM 0 · replay/single ∞
Class texture: W × H = round(T1·(cols·Pφ − Gφ)/phiLen) × round(T1·(rows·Pθ − Gθ)/bandH)
  T1 = GLOBE_T1 (THUMB_WIDTH: 512 desktop, 384 phone) → h 1043×512 (phone 783×384), v 512×1043, q 1043×1043
  TQ = round(T1·(2Pθ − Gθ)/bandH) = 1043 at T1 512, 783 at T1 384
Decode budget: MAX_LIVE × mp(pinShort, 16/9): desktop 7 × 0.9216 = 6.4512 MP at its 720 pin (Nathan 10-23, Q22;
  2.86944 at 480), phone 4 × 0.40992 = 1.63968 MP at the 480 pin (3.6864 MP under ?globeres=720p)
```

### The class rule (O3)

The label proposes, and the native ratio vetoes. `classOf` (`mediaClass.js`) runs once at
build time, in `buildWorldPools.toGlobeAsset`.

1. **Native ratio.** A video's is Mux's `videoAspectRatio`, and only when
   `videoStatus === 'ready'`. Anything else, 'preparing' included, leaves it unknown: a video
   never falls back to an image size. An image's (a still or album art) is Sanity's
   `imageDimensions`, else the `-WxH` in the CDN URL. An asset whose ratio is unknown, or
   extreme (|ln r| ≥ ln 2.4), is single only (Q5).
2. **Bands.** The label's band and the native band are the two candidates. Each band is exact
   ±10% in log space: `h` around 16:9, `v` around 9:16, otherwise `o` (Q4).
3. **Winner.** The candidate whose slot keeps more of the native picture (`kept`) wins.
4. **Result.** `h` or `v` gives that class. Otherwise r ∈ [0.75, 1.334] gives the `q`
   candidate, and anything else is single.

The result travels as `u` on the globe asset, beside `s`, the source's short side (P2). The
switch is `CLASS_SOURCE = 'veto'`, and `'label'` is kept for Nathan's Q3. Example: RH8CMzFM is
labelled 16x9 but is natively 9:16, so it is a V pair under veto. Under label it would be an H
pair keeping 27.6% of its height.

**Quads are elected per world** (`unitSpan.electQuads`; `?popquads`, default 1). The candidates
are `q` assets whose real source short side is ≥ 0.9·TQ, so the source clamp shrinks a quad by
at most 10%. Each asset loads **one texture per session**: its class texture, or the legacy
square while it is single only or an un-elected `q`. Its singles and its members share that
texture.

### Knobs (the knob ledger)

Every span knob is a `?param` with a tunables-guide row. No phase baked a default: each shipped
as today's behaviour, or off. Nathan's 10-23 bake set three of them (Q1, Q7, Q8) and the desktop `?globeres` (Q22);
his 10-24 shape set (Q28) added `?popshapes`, default `wide`.

| Param | Key | Phase | Default | Range | Reload? |
|---|---|---|---|---|---|
| `?popunits` | `units` | P3 | `1` (on: Nathan 10-23, Q1; was `0`, off) | `n > 0` → 1, else 0 | live (bench segment) |
| `?popunitmax` | `unitMax` | P4a | `4` (Nathan 10-23, Q7; was `1`) | 1–6, rounded | live (bench row) |
| `?popquads` | `quads` | P5 | `1` (classic only) | 0–2, rounded | live (bench row) |
| `?popshapes` | `shapes` | 10-24 | `wide` (Nathan 10-24, Q28) | `wide` \| `classic` | live (bench segment) |
| `?poptier` | `tier` | P6b | `auto` | `auto` \| `today` \| `lean` | live (read at each stream start) |
| `?popequiv` | `equiv` | P7 | `32` (Nathan 10-24; `12` on 10-23, Q8; was `0`, off) | ≤ 0 → 0, else 4–32 rounded | live (bench row) |
| `?globedpr` | `GLOBE_DPR_MAX` | P0c | 3 on phones (bake B, `8732aa8`), `DPR_MAX` (2) on desktop | 1–3 | URL-only, load time |
| `?globeres` | `GLOBE_STREAM_PARAMS` | P0c | 720p on desktop (Nathan 10-23, Q22; was `STREAM_PARAMS`, 480p), `STREAM_PARAMS` (480p) on phones | `270p` \| `480p` \| `720p` \| `1080p`, else the default | URL-only, load time |
| `?globethumb` | `GLOBE_T1` | P7 | `THUMB_WIDTH` (512 desktop, 384 phone) | 256–1024, rounded | URL-only, load time |
| `?popunitlook` | `unitLook` | P9 | `rows` | `rows` \| `flat` | not built: P9 only on Nathan's yes to Q2 |

`?globedpr`, `?globeres` and `?globethumb` reach `/lab/globe` too, which mounts the same
VideoGlobe (in dev and preview; Netlify redirects `/lab/globe` to `/` in production). `?popcap` and `?popmedia` re-decorate under units, because the quad election reads
the selection (P5).

The defaults set before P0a are outside the phases, and are recorded here:
- /work's `?dpr` is 3 on phones and 2 on desktop (P0c, `113b085`).
- /work's `?wallpx` has a desktop floor, `Math.round(768 * Math.max(1.5, WALL_DPR))`, and
  `?fpstol` is 0, unbaked (PF, `d2967ca`; Q23).
- `?globedpr`'s phone default is 3 (bake B, `8732aa8`).
- Home's `?footerrest` is 0.62 on desktop by default (bake A, `ba7cf2c`), and 0.59 on phones.

Both look bakes keep their `?param` as an A/B override: `?globedpr=1.5` is the old phone globe,
and `?footerrest=0` is the old desktop footer (Q27). The guide rows for these knobs are their
commits' own, and P8 checked each default against the code.

### Modules

**New:**
- `src/components/globe/unitSpan.js` (P1, with later phases appending): the import-free
  arithmetic. It holds the lattice, `frac`, `unitAspect`, `kappaOwn`, `memberWindow`,
  `compose`, `coverWindow`, `unitA`, `thetaBound`, `unitSkewBound`, `texSpec`, `eligibleH`,
  `eligibleVQ`, `grainClear`, `quadEligible`, `electQuads` and `liveB`. It also holds the
  source and picture readers (`sourceShort`, `urlDims`, `parseRatio`, `sourceDims`,
  `decodedAspect`, `pictureAspect`, `frameOf`, `mp`) and, from P6b, the tiers:
  `STREAM_RUNGS`, `TIER_RANK`, `STREAM_TIERS`, `PHONEHD_MIN_RATIO` 2.25, `tierBucket`,
  `rungAtMost` and `pinShortOf`.
- `src/components/globe/mediaClass.js` (P1): `CLASS_SOURCE`, `nativeRatio`, `classOf`.
- `scripts/lib/unitGates.mjs` (P0b; every later phase adds its gates): the span gates, the
  baseline reader and writer, and the `--expect-fail` checker.
- `scripts/baselines/globe-units.json` (P0b, P3, P4a, P5, P6b, P7): the records.

**Existing files, and what each gained:**
- `buildWorldPools.js`: `u` and `s` on every globe asset, from `classOf` and the video track
  (P2). In P7, `selectPool` takes the `?popequiv` budget and weights.
- `src/lib/queries.js`: `videoTrack` (`max_width`, `max_height`) on `FEATURED_WORLDS_QUERY`'s
  assets (P2).
- `buildContentFlow.js`: exports `MEDIA_TYPE_RATIOS` (P1).
- `PopulationDirector.js`:
  - `decorate` pools by class and elects quads (P3, P5).
  - `planUnits`, keep-first and shared delays (P4a).
  - `place()` runs after each frame's scroll and writes the A and B windows (P4b, P6a).
  - The V/Q eligibility (P5); `joinGroup` and the unit chip (P6a); `onTune('tier')` (P6b).
  - `selectFor`'s budget, and `GLOBE_T1` (P7).
  - `unitStats` and the telemetry fields below (P0b to P7).
- `MeridianScroll.js`: a re-born row cancels its in-flight swap (P0a); born pairs.
- `tileSwap.js`: `windowA`, the one texA window rule. It gives a unit member its own window, and
  loadTile's bind hook writes it on the member's first bound frame (P3, P4b). `placeKey` (the
  asset key plus the place's uid and cell) lets the shared-delay swap skip a tile already
  showing that placement (P4a).
- `TextureManager.js`: class-texture URLs, a measured `userData.aspect`, and the residency
  ledger `stats()` (P0b, P3, P7).
- `LivePanelScheduler.js`: the live window and `decodeStats` (P0b). From P6a, a unit joins and
  leaves its stream as one. From P6b: `tierFor`, `bucket`, `pinParams`, `decodeBudget`,
  `planOf` and `tierCall`.
- `useGlobeScene.js`: the per-frame `place()` after the scroll, `r1`, the stats clock, and the
  DPR bucket read from the renderer (P0b to P6b).
- `VideoSlotPool.jsx`: an optional per-assign `params` (P6b; see Parity).
- `cascade.js`: `delayOwner` (P4a; see Parity).
- `popConfig.js`, `PopTunePanel.jsx`: the knobs and the bench's spans group (P3 to P7).
- `HeroLabels.jsx`: one chip per unit, at the unit's centre (P6a), and the fading-chip latch
  (P7).
- `globeConfig.js`: `GLOBE_T1` and `globePixelRatio` (P7).
- `nameTicker.js`: exports `STRIP_H` (P7).

### The probe: levels, gates, runs, controls, baselines

`scripts/globe-probe.mjs` (its usage header lists every flag) runs the span gates through
`scripts/lib/unitGates.mjs`. Each gate records `{ n, floor, vacuous, worst, bound }`, and a gate
passes only when it is non-vacuous and ok. `--level` is cumulative: `off < tex < h < vq < live <
tier`. A tide run caps at `h`; `--rm` and `&poplive=tile` cap at `vq`.

| Level | Gates |
|---|---|
| off | `texReqShape`, `thumbVariants`, `legacyParity`, `unitsVacuous`, `staleLanded`, `texBudget`, `texPeak` |
| tex | `liveReg` |
| h | `unitWhole`, `bornWhole`, `unitRepeats`, `memberStills`, `neighbourRule`, `unitSeam`, `unitRegister`, `snaps`, `skew` |
| vq | `unitColumns`, `unitRows`, `unitWarp`, `initVQ`, `unitShapes` |
| live | `unitLiveSplit`, `chipsPerUnit`, `unitRegisterB` |
| tier | `decodeReal`, `streamTier`, `videoDensityMax` |

`report.net` adds P0's four network gates (`streamClip`, `segmentsPerRendition`, `loops`,
`audio`). The Status log's older "N gates" counts (09-26, 10-07) count the pass block's keys. They
are records, and they stay as written.

**The run matrix (units on).** Every run passes `--units --level=<L>` and must exit 0. Since 10-23 the default `?popequiv` (32 since 10-24)
makes `neighbourRule` report-only in every run; only `--extra="&popequiv=0"` judges it. The keys
are records in `scripts/baselines/globe-units.json`:

| Key | Extra flags | From |
|---|---|---|
| `u-desktop` | none (1440×900 @1, lodpi) | P3 |
| `u-mobile` | `--mobile` (390×844 @2, phone) | P3 |
| `u-rm` | `--rm --next=1` (stills, capped at vq; see As built 1) | P3 |
| `u-tide` | `--extra="&poptransset=tide&popunitmax=6" --secs=40` (capped at h) | P3 |
| `u-tile` | `--extra="&poplive=tile"` (capped at vq) | P4a |
| `u-arrive` | `--intro=full --warm=10 --secs=30` (held reveal; `initVQ` 0) | P5 |
| `u-hidpi` | `--dsf=2` (hidpi) | P6b |
| `u-phonehd` | `--mobile --dsf=3` (phonehd, 480 pin) | P6b |
| `u-phonehd720` | `--mobile --dsf=3 --extra="&globeres=720p"` | P6b |
| `u-equiv` | `--extra="&popequiv=13"` (`neighbourRule` report-only) | P7 |
| `u-thumb-phonehd` | `--mobile --dsf=3 --extra="&globethumb=512" --texmb=96` | P7 |

Levels by phase: P3 tex; P4a and P4b h; P5 vq; P6a live; P6b and P7 tier. The units-off keys
are `off-desktop`, `off-mobile`, `off-rm`, `off-tide` and `off-flat` (P0b; the file's
`recorded` date is 10-15), and `off-phonehd` (`--mobile --dsf=3`, P6b, 10-16). Since Nathan's 10-23 bake (Q1), a units-off run passes
`--units=0`, and a bare run is a units run, so it needs `--level`.

**Negative controls (MUSTFAIL).** Each control is one run that must exit 2. Then
`node scripts/lib/unitGates.mjs --expect-fail=<gates> <report.json>` must exit 0:

| Control | Flags | Must fail | Phase |
|---|---|---|---|
| `nc-texmb` | `--units=0 --texmb=1 --baseline=off-desktop` | `texBudget` | P0b |
| `nc-texpeak` | `--units=0 --texpeak=1 --baseline=off-desktop` | `texPeak` | P0b |
| `nc-sneak` | `--units=0 --extra="&popunits=1" --baseline=off-desktop` (`--units=0` since 10-23: `--extra` comes first in the URL, and its `&popunits` wins) | `legacyParity,texReqShape,unitsVacuous` | P3 |
| `nc-units0` | `--units=0 --level=h --baseline=u-desktop` | `unitsVacuous` | P4a |
| `nc-windows` | `--units --level=h --negctl --baseline=u-desktop` | `unitSeam,unitRegister` | P4b |
| `nc-bind` | `--units --level=h --negctl=bind --baseline=u-desktop` | `skew` | P4b |
| `nc-windows-vq` | `--units --level=vq --negctl --baseline=u-desktop` | `unitSeam,unitRegister,unitColumns,unitRows` (and `unitWarp`, As built 4) | P5 |
| `nc-decode` | `--units --level=tier --decodemax=0.3 --baseline=u-desktop` | `decodeReal` | P6b |
| `nc-density` | `--units --level=tier --densitymax=1 --baseline=u-desktop` | `videoDensityMax` | P6b |
| `nc-density-hidpi` | `--units --level=tier --dsf=2 --densitymax=0.4 --baseline=u-hidpi` | `videoDensityMax` | P6b |
| `nc-density-phonehd` | `--units --level=tier --mobile --dsf=3 --densitymax=0.4 --baseline=u-phonehd` | `videoDensityMax` | P6b |
| `nc-pin` | `--units --level=tier --negctl=pin --baseline=u-desktop` | `streamTier` | P6b |
| `nc-thumb` | `--units=0 --extra="&globethumb=384" --baseline=off-desktop` | `legacyParity` | P7 |

P6a's gates have no probe control. Their negative controls are unit tests: T24 (a per-member join
splits a unit) and T25 (a stale B misregisters).

**Baselines and seeds.** All 17 records in `scripts/baselines/globe-units.json` hold seed 42,
which is the probe's default. A record stores the seed as the string `"42"`. So the first passing
seed was 42 for every run type, and no key needed the vacuity retries (7, 9, 11, 13). A record
is written only from an all-pass `--record-baseline` run. Re-run without the flag, on that seed,
it must exit 0, and nobody edits the file by hand. A home run with no record under its key exits
2: it fails `legacyParity` (units off) and, except under `--mode=off`, `texPeak` (unless
`--texpeak` is passed) as vacuous. With no `--baseline`, the key
is the `--out` folder's name, so pass the key that matches the run.

**Since Nathan's 10-23 bake the records are stale.** Every one was recorded at the old defaults:
units off, `?popunitmax` 1, `?popequiv` 0, a hold of ± 0.2, a 0.9 s change, name size 0.62, band
0.65, face 0.5, span max 6, and a 480p desktop pin; and, since 10-24, the classic shapes, one name
strip and a 45.5° tilt. Re-record them at the next probe pass. Until
then, a run reproduces its record only with the old values in `--extra`, placed after the run's
own flags (the page and the probe both read a param's first value):
`&popholdjit=0.2&poptrans=0.9&popnamesize=0.62&popnameband=0.65&popnameface=0.5&popnamespanmax=6&popunitmax=1&popequiv=0&popshapes=classic&popnames=1&herotilt=45.5`,
plus `&globeres=480p` on desktop. The units-off keys also pass `--units=0`. Both hold for the
negative controls, which judge against the same records.

**The one-rerun rule.** A one-off non-vacuous gate failure can hit a transition sample whose
name placement lags a step (`namesSlice`). Rerun once after wait-quiet, and keep both runs in
the evidence. Two failures stop the phase. A vacuous gate also gets one rerun. Never lower a
floor or weaken a gate.

### `window.__swmPopStats`

The director publishes it about twice a second whenever `?popmode` ≠ off. It is not gated on
`?debug`. The tunables guide's Debug globals row names every field. The span fields are `tex`,
`upload`, `r1`, `decode` `{ mp, budget, pinShort, bucket, streams[…] }`, `layout`, `staleLanded`,
`bornCancelled` and `units`. `units` is `null` unless `?popunits` is on and the lattice exists.
Otherwise it holds:
- `texClass` and `liveReg` (P3);
- `placed`, `bornH`, `members`, `liveMembers`, `whole`, `orphans`, `orphansFront`, `repeats`,
  `clock`, `D`, `thetaH`, `initVQ` and `initThetaH` (P4a);
- `seam`, `register`, `snaps`, `skewBad` and `skewChecks` (P4b; the counters are cumulative);
- `cols`, `rows` and `warp` (P5);
- `liveSplit`, `chipsPerUnit` and `registerB` (P6a);
- `density` `{ n, worst }` (P6b).

**The A7 guards** (P6a, `8e74419`, and P7-6): `place()` writes a member's texB, and `registerB`
and `density` count the member, only when its stream was lit for this unit
(`liveUid === place.uid`).

### As built (where the contract's text does not hold)

1. **u-rm runs `--units --level=<L> --rm --next=1`** (A11), though the contract's §8.5 row
   says `--rm`. RM's clock is static and the initial plan is H only (M4), so ⏭ poses the first
   V/Q plan. A record stores no flags, so RECORD and UNITS both pass `--next=1`. P5, `56b6031`.
2. **Born pairs.** The contract puts the bind hook's guarantee on every member (O6 point 1, and
   §4.7's comment at `tileSwap.js`). It holds as written only for a planned member, which is
   right on its first bound frame. A born member, from MeridianScroll's born pair, binds while
   parked past the south pole (recycle runs before poseTile). `place()` writes its window before
   its first unparked render. `nc-bind` covers planned binds only. Born pairs are covered by the
   unit test "spans: through a tide’s travel, place() after each frame’s scroll keeps whole
   units registered and seamless, born pairs from their first frame (P4b)". P4b, `d0e430f`. P8
   rewords the tileSwap.js comment to match.
3. **An elected id's class.** The contract's §4.8 says an elected id uses its q texture
   everywhere. In fact `decorate()` pools an id by its FIRST classed occurrence. An id classed h
   or v in an earlier world keeps that class in a later world that elects it, so no quad forms
   there. No id is in two worlds today. P5, `56b6031`.
4. **`nc-windows-vq` also fails `unitWarp`.** The contract's expect-fail row names only four
   gates. P5, `56b6031`.
5. **A7.** texB and `registerB` are written only when `liveUid === P.uid`. P6a, `8e74419`. P7
   gives `density` the same guard (P7-6, `eadf842`).
6. **`neighbourRule`'s REF.** Take the contract's §4.10 7-key line, or the code. Never take
   §8.3's listing, which prints P4a's 4-key line. P6b, `cdcf25d`.
7. **P3's latent `liveReg` false miss under `?poplive=tile`.** A recycled class tile keeps its
   old B and `liveVideo` while loadTile binds a new A. It is known and has not fired: u-tile's
   `liveReg` worst was 0 at P6a, and 0 against a bound of 0.001 at P7 (n 48). P3, `c7f382d`.
8. **What P7 landed beyond the contract's text** (`eadf842`):
   - `report.darkThumbs`, report-only: every class texture home received whose luma mean is
     < 16 or whose sd is < 6 (0–255), measured from the bytes already received. It comes with
     `darkThumbsScan { measured, failed }`.
   - The finite guard: each P4b gate fails a non-finite worst (P7-1).
   - `report.argv` and the resolved `report.negctl`, both report-only (P7-5).
   - A lead lit as another clip's single carries no unit centre (P7-2).
   - The fading-chip latch (P7-3, as landed after the fix round, A10). On 'off', a slot keeps
     its unit's members (`heldMembers`) when the panel had a unit centre, and `null` otherwise.
     While the latch is set, the frame loop re-derives the anchor every frame from live poses:
     the members' normalized sum, or the tile's own `centerDir`. With units off, every chip
     takes the own-tile branch. One LOOK desk run: 117 polls, 453 chip reads, 0 jumps to a new
     centre.
   - P7's Adaptations A1–A10 are in its commit message.
9. **The guide's `__swmPopStats` row** gains `decode`'s `budget`, `pinShort` and `bucket`, and
   `units.density`. It drops "both null until P6b". P6b, `cdcf25d`; reworded in P8.
10. **Report-only fields.** `report.json` gains `dsf` and `canvas` in P6b (`cdcf25d`), and
    `argv`, `negctl` and `darkThumbs` in P7 (`eadf842`). The probe's usage header names them.
11. **`&poptier=today` and the tier level.** Under `&poptier=today`, no stream carries a tier
    plan, so `streamTier` has no sample, and a `--level=tier` run exits 2 on `streamTier` alone.
    Judge a today run at `--level=live`. The orchestrator's comparison capture found this on
    10-16.

### Defaults, and Nathan's questions

Each question has a default, which is what ships if Nathan says nothing. His answers bake later,
one commit per knob default. The numbers are the contract's §13, and code comments cite them.

| # | Question | Default (or answer) |
|---|---|---|
| Q1 | Turn units on? | Answered 10-23: on (`?popunits=1`); `?popunits=0` is today's globe |
| Q2 | Build S2, the per-fragment crop (P9)? | No. The CPU route ships, and P9 is never built |
| Q3 | Class source: the label alone, or the label with a native veto? | Veto (`CLASS_SOURCE = 'veto'`) |
| Q4 | Class band width | ±10% in log space around 16:9 and 9:16 |
| Q5 | Extremes (\|ln r\| ≥ ln 2.4): single, or span? | Single |
| Q6 | Quads per world | 1 (`?popquads`) |
| Q7 | Unit repeats: once per asset per plan, or at every admissible spot? | Answered 10-23: up to 4 (`?popunitmax=4`; 1 = once, 6 = every spot) |
| Q8 | Fewer assets? | Answered 10-23: `?popequiv` 12, with `?popcap` 13 kept: a world places from at most 13 assets weighing 12 tile-equivalents. Re-dialed 10-24 under the wide shapes: 32 |
| Q9 | Phone renditions | Superseded: the phone pin is 480p (10-09), and P0 pinned it on both devices (the desktop globe pins 720p since 10-23, Q22) |
| Q10 | The phone's pixel ratio | Answered: 3 on phones at 480p (bake B, `8732aa8`); `?globedpr=1.5` is the old globe |
| Q11 | T1 768 on large Retina displays? | 512 (`THUMB_WIDTH`); `?globethumb=768` to compare |
| Q12 | Dark first frames | Keep `time=0`; darkThumbs is reported only. P7's lists (`eadf842`): u-desktop and u-mobile list the same four near-black class textures (mean < 16, none flat): jowrx35j (v), iYkHH8HX (h), fRj7mEI5 (v) and qRA02wwe (q). zNq4h02h and ewG9MiP4 were never requested as class textures at seed 42, so they were not measured. The only flat texture is bedouin's 2fInI023 (v, mean 126.9, sd 3.2), listed by u-tide only |
| Q13 | Registered (`time=0` crop) posters for single-only videos too? | No: singles keep today's smartcrop square |
| Q14 | HiDPI desktop: 720p pairs and a 1080p quad inside today's decode budget? | Yes (`?poptier=auto`); lodpi pairs stay at 480p; `?poptier=today` for the A/B |
| Q15 | Seams: mullion or split? | Mullion |
| Q16 | Tides carry H pairs only? | Accept |
| Q17 | One chip per unit, at its centre? | Yes |
| Q18 | Desktop /work at full res? | Answered: DPR 2 (P0c, `113b085`) |
| Q19 | (inform) The strict 15 s detail cap | Done in P0 (`wrapAtDetailCap`) |
| Q20 | The phone decode budget at DPR 3 | Follows the pin: 1.63968 MP at 480p, 3.6864 MP under `?globeres=720p` |
| Q21 | COCO and bedouin show no live video on phones under the corner preset | Answered: a bug, which F2 (`876404c`) fixes |
| Q22 | HiDPI tiers at the lowest rung with density ≥ 1? Desktop globe at 720p? | Answered 10-23: the desktop globe pins 720p (`?globeres=720p` was in his dial); phones keep 480p. The tiers keep `auto`, which he did not dial |
| Q23 | The deck wall's flicker | Fixed in PF (`d2967ca`). Open: (a) `?fpstol` 0; (b) the wall canvas on a 1× screen, 1152 |
| Q24 | MSAA 2 at DPR ≥ 2; the globe without antialias | Neither taken |
| Q25 | Desktop footer at rest, 0.62 | Keep 0.62, the value he approved |
| Q26 | The tagline's per-frame watcher on desktop home | Leave it |
| Q27 | Remove the baked knobs' `?param` reads at the fold? | Answered 10-24: keep them as overrides for now ("keep URL parameters for now") |
| Q28 | Which span for which aspect? | Answered 10-24: 16:9 and 4:3 a 3×2 (else its 2×1 pair, else a single); 9:16, 3:4 and 4:5 a 1×2 for now (his 2×3 later); every sharp square a quad, no election; `?popequiv` stays 12 with a 3×2 weighing 6, and he re-dials. Behind `?popshapes`: `wide` by default, `classic` = the 10-23 set |

### Open

**Nathan's open calls:**
- Should a single's corner touching its own unit count as a neighbour?
- Should desktop quads favour frontal positions? P5's LOOK framed 0 frontal quads in over 600
  desktop polls.
- On a 3× phone, should pairs play at 720 as well as quads? The evidence is the orchestrator's
  phone comparison of 10-16 (`/private/tmp/swm-units-probe/P6b-compare/CAPTURES.txt`). At the
  held frame, the quad at 720 against 480 gave +24% and +25% Laplacian (390 and 430 wide),
  decoded 1.338 MP against 1.357 MP, and ran 3 live streams against 4. Video bytes were within
  run spread. The quad call stays open until he answers, and the default (q 720) ships.
  On phones `GLOBE_STREAM_PARAMS` stays the 480p literal that T33 asserts (desktop pins 720p since 10-23,
  Q22).
- Q2, Q11, Q12, Q23(a) and (b), Q25 and Q27 above.

**Next steps (P8 runs no probe):**
- Re-measure the first units batch's frame rate on a quiet machine. At P7 it ran at about half
  of P6b's rate (02:06-02:09). No load was logged during that batch. P7's PROGRESS.md logged a
  load average of 9.5, with Illustrator near 85% CPU, at 02:10:39 just after it, then 4.7 and
  14.4 at later runs (`eadf842`). u-desktop read 10 fps against P6b's 21, u-rm 23 against 51
  (P7's commit message, from `fix/fps-changes.txt`).
  P7 did not re-run the batch, so whether load caused this is not shown.
- Give the watch run's `texPeak` a bound, with `--baseline=u-hidpi` or `--texpeak`. P7's
  `watch/u-hidpi-today` passed no `--baseline`, so its key defaulted to the folder's name and
  `texPeak` was vacuous. It was the only failing gate (39/40).

**Deferred to this plan** (the P7 notes; no action taken yet):
- **The born-pair control.** Born pairs are covered by the unit test only, and `nc-bind`
  covers planned binds.
- **The namesSlice decision.** The one-rerun rule stands.
- **P3's latent `liveReg` false miss** under `?poplive=tile` (As built 7).
- **The watches**, as P7 measured them (`eadf842`'s commit message):
  - `bornCancelled` was 10 on u-hidpi (DSF 2, auto; 0 on its rerun) and 0 on
    `watch/u-hidpi-today` (DSF 2, `&poptier=today`). rec/u-equiv read 7 (DSF 1) and
    rec/u-thumb-phonehd 9 (DSF 3), both record runs; their check runs read 0. Every other P7
    run read 0. So it is not a DSF-2 effect, and not recording either (u-hidpi is a check run)
    (`eadf842`). Its cause is open. The probe does not gate it.
  - `unitSeam`'s sampling floor is 20. Across the passing runs its n ran from 32 on u-tile to
    123 on u-tide. The two stalled runs read exactly 20. Every worst was 0, against a bound of
    0.0001.
  - off-mobile's `texPeak` was 33.8 against a bound of 38.87.
  - u-arrive's `decodeReal` was 2.67 against 2.869 (n 23, over 1 world change), below P6b's
    2.856 (n 25, over 4 changes; about 0.45% headroom). Not like for like: P7's run saw fewer
    changes at half P6b's frame rate (`eadf842`).

**P7's "Left open"**, as written in `eadf842`'s commit message (each item with its tier):
- SHOULD-B (a later hardening pass):
  - P4a's review: R01/R01b, R02-R04, R05-R08, R17, R21, R62/R63.
  - P1's review: T3 (R07); T3 and T7 (R15-R17); T4 (R02, R03); T7 (R01); T8 (C24, C29-C33);
    T9 (R19, R20).
  - P3's review: R03, R05.
  - P5's review: a test for PopTunePanel's `quads / world` row, and the same for P7's
    `tile budget` row. Mutant P01 (the row dropped) survives the suite and the scanner.
- NIT:
  - P1's nits, and T30.
  - P2's R6 and R9.
  - P3's R14-R17.
  - P4a's gate-scope boundaries (R09-R11, R35, R57) and W01-W05 (the delay wiring).
  - P4a's recycle/birthPairs `exclude` option.
  - P6b's R6 (the probe's deviceScaleFactor line) and R13 (the bench's 'video tier' onPick).
  - P6a's N10 (a parked lead keeps a frozen unitCentre, so its chip fading after the
    park-detach anchors at a point that no longer follows the rows, for at most 0.3 s past the
    pole). P7-3's latch engages on 'off' only, not on the frame loop's gone fade, so it does
    not cover N10.
  - The review round's: darkThumbs' listing has no test of its own (report-only; darkThumb's
    cases are in T20).

**Leftovers P8 did not take** (code outside P8's docs-and-comments scope):
- `tunables-keys.mjs --check` counts a key as documented when its `?param` appears anywhere in
  the guide, so deleting a knob's own row still passes while another row names it. A row check,
  or a rule that a table row's first cell be the backticked `?param`, is open (P3's review).
- `PopulationDirector`'s constructor JSDoc lacks `getPace`, `getHorizon` and `revealHeld`, and
  the test file duplicates `GRID = 64` (P4a's review). `PopulationDirector.js:160` declares three
  counters on one line (P4b's review).
- A note on the wording only: the contract's §9 T21 and §8.3 mix two measures. 3.4e-4 is the
  sample-point shift, while `liveReg` and `registerB` gate on the window-component difference,
  which is about twice the shift (P3's t21.log: shift 3.409e-4, err 6.818e-4).

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
- 2026-10-06 · P3 checkpoint (Nathan). Enter World lands in the world on the globe. Yes to
  the breadcrumb snap and to a short RM cover. He baked his dial (below). He also asked for:
  a quicker CTA exit with the loading bar after it; the tagline's extended blurb as home's
  default (his priority: say what SWM is at once); and client-name ticker tiles.
- 2026-10-06 · the P3 round.
  - Landed:
    - **Bake** (Nathan's URL): `tides` on by default, `all` media, cap 13, `weighted`, a 6 s ±
      0.2 hold, a 0.9 s `surge`, chaos 1. The seed stays random per visit (his call).
      `?popmode=off` restores the pre-worlds globe.
    - **Breadcrumb snap.** The detail breadcrumb covers in the project's colour (0.6 s), then
      navigates. /work's `swm:returnToWork` restore arms `snapRef`, so the return is the arrival
      snap: no Turn, no fade from World 0's colour, the fill held until the card. Under RM it
      is an instant cover and a plain link.
    - **RM cover.** Both RM Enter World paths dispatch `swm:envelop {duration: 0}` in the
      world's colour before navigating, so World 0's server-rendered card never shows.
    - **CTA exit.** The Enter World chrome fades out in 0.2 s at the click. The passage cover
      carries no loader any more; `swm:loader-start` fires `?loaderlead` ms (350) after the
      chrome is out. RouteFill fades the bar up over 0.3 s instead of popping it.
    - **Tagline.** At rest on home (`body.route-home` with no `data-chrome-open`,
      `data-menu-open` or `data-footer-revealed`), the chip shows the extended blurb. Any
      other state abbreviates it to "VISUAL WORLDS for the music industry." through a GSAP
      morph: the capsule resizes from its anchored corner over `?tagmorph` ms (600), the words
      leave and arrive in a stagger, and the extended blurb returns on rest. SiteNav now sets
      the `data-menu-open` latch. On phones the long blurb is a 4-line paragraph at 0.82 em.
    - **Name ticker** (`nameTicker.js`). The world's `clientName` appears in the FP card face
      (OT Neue Montreal Squeezed 600, uppercase, -0.02 em), drawn once per world and style into
      a repeating CanvasTexture. A strip spans 1–3 adjacent tiles of a row:
      - Tile *k* samples the window *k* tile-widths along the strip, and the director slides
        every window on one clock, so the name runs across the lattice gaps as one ticker.
        Only uvScaleA / uvOffsetA move; panelMaterial is untouched.
      - `?popnames` (2) sets the strip rows on the visible face. Each strip row carries two
        strips half a globe apart, and each pair sits a quarter globe on from the last, so a
        strip always faces the viewer even though the globe drifts at only 2°/s.
      - `?popnamespan` (`2,3`), `?popnamespeed` (0.6 tile heights/s), `?popnamestyle`
        (ink | fill). The bench has a "names" group. **`?popnamespan` and `?popnamespeed` were
        retired on 10-07** with the ticker and the tape-pure placement — see the round below.
      - Strips warm with their grouping and hold still under RM. `__swmPopStats.nameTiles`
        counts the visible ones.
  - Verified:
    - Unit 15/15 (new: the strip cadence / runs / facing guarantee, and one shared texture per
      world with continuous windows).
    - `tunables-keys --check` PASS (309 keys).
    - globe-probe default, `--enter`, `--rm --enter` and `--mobile`: every gate. `--enter` adds
      `returnNoTurn`, and the breadcrumb return passes it on both paths.
    - pager-probe rest is clean. `npm run build` builds 22 pages.
    - Visible name tiles at the default (2): 2–8 at 1440 and 3–7 at 390, never 0 across 3
      seeds × 30 s. Before the stagger: 0–2, with long empty stretches.
    - Tagline: long at rest; short on /process, with the info drawer and with the footer up;
      long again back home and once the footer shuts.
    - Production preview in installed Chrome (real GPU):
      - CTA out by 210 ms; the loader starts at ~610 ms.
      - Passage cover lifts 330 ms after /work's page-load.
      - RM cover: up 67 ms after the click and released at ~300 ms, as soon as the entered
        world's card replaces World 0's SSR card. A cold first fetch took ~1.3 s.
  - Open for Nathan:
    - The ticker defaults: count, widths, pace, and `ink` vs `fill`. Dark project colours read
      faintly in `ink` (TOBEHONEST grey on black).
    - The phone blurb's 0.82 em.
    - The loader's ~550 ms start (`?loaderlead`).
- 2026-10-07 · probe cover gates (Nathan: "add both").
  - `globe-probe --enter` now gates the two 10-06 passage fixes, so a regression fails the run:
    - `enterLoaderAfterCta`: the Enter World chrome (`.hero__lead-col`) reaches opacity 0
      before the loading bar's first visible frame. Under RM the bar never shows.
      `report.enter.timing` keeps both times: 219 ms → 616 ms in SwiftShader.
    - `enterFillHeld` no longer exempts RM. The cover must be fully up when /work's first card
      appears (World 0's SSR card) and stay up until the entered world's card. `returnFillHeld`
      applies the same rule to the breadcrumb return.
  - Verified: `--enter`, `--rm --enter` and `--mobile --enter` pass every gate. Each new gate
    was replayed over the recorded logs, with mutations that break it:
    - a cover dip after the first card;
    - a 0.6 cover at the swap;
    - the loader 1 ms before the chrome is out.

    Every mutation fails its gate.
  - Unreproduced one-off: 1 of 3 `--rm --enter` runs (seed 42, TOBEHONEST) failed the older
    `colour` gate. The chrome read brand blue with no `pop-tint`, although the world was
    `#404040`. The other two runs and 11 traced RM loads tinted correctly.
    - Under RM the director greets its world at once. A clear landing after that greet would
      leave the chrome blue for the whole visit, because only ⏭ changes the world under RM.
    - The suspect is RouteFill's mount-time `syncNavAccent()` on home.
    - If the failure recurs, trace `html` class changes with a MutationObserver. Patching
      `classList` breaks the add.
  - The probe saves its full report as `report.json` beside the shots in `--out` (default
    `scripts/shots/globe-*`), on failed and crashed runs too, and prints the path to stderr.
    Stdout is unchanged, so no run needs repeating to recover a report cut off by `tail`.
  - Phone viewing: run the worktree server as `astro dev --host --port 4322`. Sanity's CORS list
    has `http://192.168.1.19:4322` since 10-07 (Nathan's yes); without that entry, stills load
    black from a LAN origin.
- 2026-10-07 · client-name placement rework (Nathan: "the text is too big and the longer client
  names are clipped … let's also remove the horizontal ticker effect"). The names are no longer
  laid over the scroll tape at all.
  - **Why the model had to move.** `nameCell(lon, s)` was pure over the tape, so it could only
    see a tile's `(lonIndex, tapeS)`. All three of his placement asks — a mid-latitude band, the
    front-facing half, a region that alternates between worlds — are about where a panel is RIGHT
    NOW relative to the camera, and a row's latitude changes continuously all the way down its
    ~90 s pole-to-pole pass. So placement moved into `PopulationDirector.planNames()`, decided
    ONCE PER WORLD CHANGE against the live scene (`panel.centerDir` unrotated = the latitude;
    `centerDir.applyEuler(getRotation()).z` = facing) and keyed by PANEL. `nameCell` is gone.
  - **No more ticker.** `tickNames(dt)` and `?popnamespeed` / `POP_DEFAULTS.nameSpeed` are gone,
    along with the 96-panel-per-frame uniform write they carried. `placeNames()` replaces it: it
    reconciles each strip tile's RESTING window (tile *k* on slice *k*) and writes only when the
    value actually changes, so at rest the strips cost nothing. It has to be a loop rather than a
    bind hook — `loadTile` fires from three places (a row's re-birth, `applyPlan`,
    `initialLayout`) and `layIn`'s kept-texture strip takes a new window with no load at all.
    The per-tile random `phase` went with it (a still strip must start at a glyph, not mid-one).
  - **Span from the measured name** — the actual clipping fix. A tile shows
    `panelAspect / stripAspect` of the strip, so a 2–3 tile strip only ever showed 33–75% of a
    typical name; the ticker hid the rest by scrolling it past. `measureNameAspect()` measures the
    label on a module-level 2D context with the real font string (falling back to a glyph-count
    estimate until `document.fonts.check` passes — the first layout plans before anything warms,
    and the next change measures for real), and `nameSpan()` returns
    `clamp(ceil(stripAspect / panelAspect), ?popnamespanmin, ?popnamespanmax)`. In region mode the
    canvas is then padded to EXACTLY `span × panelAspect` strip heights with the name centred, so
    `computeCoverUv` hands each tile exactly `1/span` of it: the name reads once, edge to edge, no
    `RepeatWrapping`. At the max clamp the drawing shrinks the type instead of cutting the name.
  - **Smaller type.** `?popnamesize` (0.62, was a baked 0.86) is font px per strip height. It also
    shortens the strip, because the name's width scales with the px and its clear space does not.
  - **The gates.** `?popnameband` (0.65) = the middle fraction of pole-to-pole a strip may sit in
    (|`centerDir.y`| ≤ 0.85), measured on the row so a strip is never half in. `?popnameface`
    (0.5 = the visible half) gates EVERY tile of the strip, not just its start.
  - **Alternation.** `makeGrouping` stamps `nameQuad` = `NAME_QUADS[(step + seeded) % 4]`, walking
    lower-left → upper-right → upper-left → lower-right (Nathan's example is the first move), so
    `?popseed` still replays the same globe. The quadrants partition the ADMISSIBLE region, split
    at that region's OWN mid-point — not the screen's, because the 40° brand tilt pushes the whole
    front-facing mid-latitude band below centre, and an absolute `y >= 0` test would make the
    upper quadrants unreachable.
  - **Relaxation, as predicted.** Band + facing + quadrant leaves roughly 12–16 admissible tiles
    of 96. The gates relax in order — quadrant, then facing, never the latitude band — and the
    relaxation is published (`namePlaced.relaxed`), shown on the bench and gated by the probe.
    Observed: a span-6 name (`Imperfect Records`) spans half the globe, so it can only sit centred
    and the quadrant relaxes. `?popnamespanmax` is the knob that trades width for alternation.
  - **The band variant.** `?popnamemode=band` draws the name across a whole latitude row, the
    natural strip repeating around the globe, still — the row walking with the step so the band
    moves between worlds. It needed the two blockers gone: the old `span ≤ floor(L/2)` clamp and
    the two-starts-half-a-globe-apart loop.
  - **Accepted consequence.** A row re-born at the pole has |y| ≈ 1, outside any band, so names
    refresh at a world change and not at a birth. That costs almost nothing under the default
    `surge` (in place, against the live rotation), but under `?poptransset=tide` EVERY row
    re-births, so the globe carries no strips at all until a non-tide change. Chosen deliberately
    over re-laying strips in place after a tide, which would break the persistence doctrine and
    flip tiles inside a hold (the probe's `quietHolds` gate).
  - **Stats.** `__swmPopStats` keeps `nameTiles` and adds `nameStrips`, `nameMode`, `nameMaxY`
    (live, a diagnostic — a placed strip drifts out of the band with its row), `nameSlices` (per
    slice: the `lo`/`hi` of the strip the tile actually RENDERS, the slice width `w` it should
    be, and the tile's pinch `vk`) and `namePlaced` — the placement's own measurements at the
    moment of the change: mode, span, tiles, the wanted and actual quadrant, any relaxation, and the
    `yMax`/`zMin` it achieved against the `yLimit`/`zLimit` it had to clear.
  - Verified: unit 19/19 (the old cadence and ticker tests are replaced by the band / facing /
    quadrant / span / stillness / band-mode contract), `tunables-keys --check` PASS (313 keys),
    `npm run build`, and globe-probe default / `--mobile` / `--rm` / `--rm --next=2` /
    `--extra="&popnamemode=band"` — 12/12 gates each, including the four new ones
    `namesPlaced`, `namesInBand`, `namesFrontFacing`, `namesStill`. What the runs measured:
    spans 5 / 4 / 2 over three worlds walking UR → UL → LR with no relaxation, every placed
    tile inside the band and in front (worst |y| 0.72 of a 0.85 limit, worst z +0.26 of 0),
    and 61 resting-window comparisons with zero movement. Two notes for the dial: on
    `--mobile` the worst placed |y| is 0.8513 against the same 0.8526 limit, so
    `?popnameband` 0.65 has almost no margin on a phone's grid; and `namesStill` must be
    read hold-to-hold, because `step` advances when a change STARTS while the tiles are
    still swapping, so a transition sample can hold the previous world's strip.
  - Open for Nathan's dial: every one of `?popnamesize`, `?popnameband`, `?popnameface`,
    `?popnamespanmin`, `?popnamespanmax`, `?popnames` and `?popnamemode` ships as a URL param with
    a bench row and no baked number — he has given none. (10-23: he dialed four, now the
    defaults: `?popnamesize` 0.83, `?popnameband` 0.57, `?popnameface` 0.44 and
    `?popnamespanmax` 4. `?popnamespanmin`, `?popnames` and `?popnamemode` stay as they were.)
  - **The pole pinch — why the first world read "TOHOST" (10-07, second round).** The rework
    above shipped green and still rendered `TOBEHONEST` as `TOHOST` on the first world, while
    `ANDHERA RECORDS` lower down read perfectly. The texture, the published UVs, the panel
    aspect and the span were each dumped and each correct; the defect is DOWNSTREAM of all of
    them. `panelMaterial`'s fragment stage centre-crops a scroll tile's media sampling by
    `vK = sin(θ_center)` — the pole-pinch compensation, written for photos: a tile narrowed
    toward a pole would otherwise squash its picture, so the shader samples only the middle `vK`
    at constant pixel density and lets the silhouette crop. For text that is fatal. Tile k did
    not render `[k/span, (k+1)/span]`; it rendered the middle `vK` of that slice, losing
    `(1−vK)/2` at each edge. At the `UR` placement (|y| 0.72 → vK 0.70) each tile showed 70% of
    its two characters; at the 0.65 band's edge (|y| 0.85) only 53%. The lower-left placement
    read because its θ is nearer 90° and vK nearer 1 — nothing was being cropped.
  - **The fix: undo the pinch CPU-side, for name tiles only** (`nameTicker.nameWindow`, applied
    in `placeNames`). `scaleX = slice/vK` and the offset recentred, so `vUv.x` 0..1 reaches the
    shader as `mUv.x = 0.5 ± vK/2` and renders exactly `[k·slice, (k+1)·slice]` at any latitude.
    `panelMaterial` is untouched, Nathan's middle-65% band is untouched, and the glyphs
    foreshorten with the latitude — the sphere's own longitude convergence, correct for type
    wrapped around a globe, and not the squash the pinch exists to prevent. The alternative
    (tighten `?popnameband` until vK ≈ 1) was rejected: vK ≥ 0.9 needs |y| ≤ 0.436, about 29% of
    the polar span, which contradicts the ask. The span is NOT divided by vK as well — that
    would roughly double a run at the band edge, past the front-facing half, and the facing gate
    would relax and put half the name behind the globe.
  - **Recomputed every frame, deliberately.** vK moves as a row scrolls pole-ward, so a window
    frozen at the change drifts: ~12° of travel inside one hold is a 10% sampling error, a glyph
    sliver repeated across every lattice gap. `placeNames` already ran every frame (it only ever
    wrote on a change), so this adds no loop — just writes on the ≤ span tiles carrying a strip,
    against the 96 `uPolarTop` writes the scroll driver already makes in the same frame. What is
    still is the RENDERED slice, not the uniforms: exactly `slice` wide and centred on
    `(k+½)·slice` at every latitude. `update()` runs before the scroll applies, so the window is
    one frame stale in vK — measured at ≤ 1.3% of a slice on a 12 fps warm-up frame.
  - **The gate that would have caught it.** `nameSlices` now publishes, per slice, the strip
    range the tile actually RENDERS (the shader's own crop arithmetic re-derived from the live
    uniforms and the tile's latitude), the slice width it should be, and its pinch. New probe
    gate `namesSlice`: every tile renders a full slice (`hi−lo = w`) in register (`lo ≡ k·w`),
    both read as a FRACTION OF A SLICE because the defect is multiplicative — 30% at the
    placement that read "TOHOST", 48% at the band edge, against a 5% tolerance. `namesStill` now
    compares that rendered range hold-to-hold (mod the repeat) instead of the raw `uvOffsetA`,
    which legitimately moves now. Both skip tiles under 40% pinch: a strip that has scrolled on
    to the pole is a sliver nothing reads, and the pinch changes too fast there to measure in a
    frame (band mode hits this every change, the outgoing row dying at the pole). The honest
    limit: near the equator an uncompensated tile is off by less than the tolerance — correct,
    because there it renders ≥ 95% of its slice and the name reads anyway.
  - Verified on this round: unit 21/21 (two new — the window/render round-trip over a sweep of
    vK and k with the uncompensated window as the negative control, and band mode's wrapped
    window; plus the registration test that scrolls a placed row and asserts the rendered range
    holds while the uniforms move), `tunables-keys --check` PASS (314 keys), `npm run build`
    23 pages, and globe-probe default / `--mobile` / `--rm` / `--rm --next=2` /
    `--extra="&popnamemode=band"` — 13/13 gates each, worst rendered-width error 0.49% of a
    slice. Read by eye in `01-warm.png`: `TOBEHONEST` complete across its 3 upper-right tiles
    on both desktop and `--mobile`, and `ANDHERA RECORDS` complete across 4 lower-left tiles in
    `02-end.png`. That shot is the one that read "TOHOST" before.

- 2026-10-07 · mobile home footer reveal · the scroll-up reveals the rest of the footer and the
  logo ticker, the globe and `enter_world` rise at half the rate, and the footer text no longer
  loads abruptly. Builds on 10-07's resting footer variant (`?footerrest`, 0.62 at the time; re-baked 0.59 on 10-08).
  - **The rise channel.** `broadcastReveal` is the one place that holds both the progress and
    the resting floor, so it publishes the normalization next to the raw reveal: `--footer-rise`
    (0 in the resting pose, 1 at a full reveal), `--footer-rise-peak`, and `--footer-span`
    (1 − rest). In JS, not as a `:root` calc — `?footerrest=1` is a legal dial and
    `(p − 1) / (1 − 1)` is not a number. GEOMETRY rides the live rise; every FADE rides the
    peak, because "footer exits are masked via `--footer-peak`, never faded".
  - **The lift.** One gated custom property, `--hero-lift` under `html[data-footer-rest]`,
    = rise × `?footerlift` × span × `--footer-panel-h`, written to the individual `translate`
    property on the globe, the ring, the labels, the lead column and the commit fill.
    `translate` pre-multiplies the `transform` those elements already carry from the dolly and
    the lockup scale. Gated because `translate: 0 0px` is not `none` — ungated it would put the
    whole hero on the compositor on the document-scroll routes too. `.hero__fill` is
    `position: fixed; inset: 0`, so it also gets a static `bottom` bleed of one panel height;
    lifted without it, it opens a bare strip at the bottom of the viewport.
  - **The marks.** The client roll fades + settles over a window on the PEAK rise. Its start is
    the FIXED POINT of its own measurement: at rise 0.6 the roll's top edge sits exactly on the
    fold at 390×844, so the fade begins on its first visible pixel. The arithmetic guess off
    static CSS said 0.42; a 16-step scrub said 0.66; the interpolated crossing says 0.60.
  - **The entrance.** `STAGGER_ON = 0.85` sat above the 0.62 floor, so the resting footer's
    stagger loop never fired and the blurb simply existed. Retired that loop (it now also
    guards on `:not([data-footer-rest])`), and the entrance is armed inside `chromeBeat` — the
    beat the CTA and the tagline already use — as a per-word `autoAlpha` fade with no y (the
    sequential rise read as stutter). The hidden ground is `[data-footer-in]` in CSS, removed on
    every bail path including a 3 s safety timer: absence means VISIBLE, so a beat that never
    arrives costs the animation, not the text.
  - **The lag.** The driven footer repainted through React state on every touchmove. `footerP`
    state is gone; `paintDrivenFooter` writes the panel transform and the channel imperatively,
    the same way scroll mode already did. On the page Nathan called laggy this matters more than
    anything else in the round.
  - **The measurement gap.** Nothing in the repo could move a finger, so every figure in the
    design round was arithmetic off static CSS. `globe-probe.mjs --footer` now drives a real
    touch scrub through CDP at a mobile viewport and asserts 12 gates on observed pixels,
    including the two that encode the actual bugs: `liftZeroAtRest` (a lift windowed over raw
    progress starts a third of the way up on the first paint) and `blurbNotFinalOnFirstFrame`
    (a rAF watcher installed before any page script, because "no animation" and "an animation
    whose threshold was never crossed" look identical once settled).
  - Verified on this round: unit 58/58 (16 new), `tunables-keys --check` PASS (319 keys),
    `npm run build` 23 pages, and `globe-probe --footer` 12/12 against `astro preview` —
    panel climb 106.86px, hero lift 53.39px, ratio 0.4996 against a dialed 0.5 — the two absolute
    figures are `(1 − rest) × panel-h` at that round's 0.62 floor; the 10-08 re-bake to 0.59 moves
    them to 115.3/57.6 and leaves the ratio alone.

- 2026-10-09 · Nathan's bakes · (A) the desktop home footer rests open by default; (B) phones
  render the globe at full resolution. Nathan: "can we push the globe page footer work (visible
  when i define ?footerrest) to be live"; "yes to phone globe at full res , it looks so much
  better and does not stutter. i think we can stay at 480p i see no discernable difference".
  - **A — `FOOTER_REST_DESKTOP = 0.62`** in `Hero.jsx`, beside the phone's 0.59. Every desktop
    look of the variant on 10-08 ran at `?footerrest=0.62`, so the bake is that pose. Proof it
    reproduces the look: on the preview build at DSF 2, 1440×900 and 1728×992, a no-param load
    and `?footerrest=0.62` read identically on every field. Clearance/peek 112.7/75.7px at
    1440×900 (105.0/68.0 at 0.59) and 114.4/77.5 at 1728×992; the blurb is one line at both,
    and the clipping floor is 0.183 / 0.197. `?footerrest=0` is the old desktop footer.
    The tagline's `maskLive()` rAF now stays live on desktop home (it retires only at ≤768px):
    +0.10–0.13 style recalcs per frame at rest against `?footerrest=0`, with durations inside
    run-to-run noise. Not retired in this commit. `globe-probe --footer` (phone), default and
    `--mobile` all exit 0 with no gate change; unit tests add `the desktop footer rest is its
    own bake`.
  - **B — `GLOBE_DPR_MAX` defaults to 3 on phones** (Nathan's Q10); desktop stays `DPR_MAX` (2),
    and /process keeps `DPR_MAX` (1.5 phone). `?globedpr=1.5` is the old phone look, and
    `?globeres` keeps the 480p pin. The name strips now scale by the ratio the canvas actually
    renders at (`NAME_STRIP_H` in globeConfig.js), not by the caps' ratio: 512 on a DSF-3 phone,
    341 on a DSF-2 phone (the caps' ratio drew 512), 256 on every desktop at the default. Read
    off the preview's canvas: phone DSF 3 `/` 3.00 (was 1.50), `/?globedpr=1.5` 1.50, `/work`
    3.00; DSF-2 phone 2.00; desktop DSF 2 2.00. The strip heights were read at runtime and match.
    `globe-probe` default and `--mobile` exit 0. Mobile bytes are 13.09 MB, inside 480p's
    13–15 MB.

- 2026-10-10 · P0a · `3232f6b` · a re-born row cancels its in-flight swap, so the born asset
  survives (MeridianScroll, tileSwap; T16). Tests 30, `--check` 341 keys. OFFSET, units off, seed
  42: every run exit 0 with every gate true.
- 2026-10-14 · P0b · `ba9a7fa` · unit telemetry (`tex`, `upload`, `r1`, `decode`, `layout`,
  `staleLanded`), `scripts/lib/unitGates.mjs`, and the five units-off records in
  `scripts/baselines/globe-units.json`. Tests 32, 341 keys. RECORD: off-desktop, off-mobile, off-rm
  and off-tide exit 0 with 23 pass keys each, off-flat 9; OFFSET against those records 25 each
  (off-flat 10).
  MUSTFAIL `nc-texmb` and `nc-texpeak` each fail only their gate.
- 2026-10-15 · P1 · `cd6def0` · `unitSpan.js` and `mediaClass.js` arithmetic, inert. Tests 43,
  341 keys.
- 2026-10-15 · P2 · `7326e94` · globe assets classed at build (`u`, `s`; `videoTrack` on the
  query). Tests 43, 341 keys. OFFSET exit 0, 25 pass keys (off-flat 10).
- 2026-10-15 · P3 · `c7f382d` · `?popunits` class textures: one texture per asset, at its
  measured aspect. Tests 47, 342 keys. u-* runs at level tex exit 0; MUSTFAIL `nc-sneak`.
- 2026-10-15 · P4a · `7016521` · H pairs planned as whole units (`planUnits`, shared delays,
  `placeKey`; `?popunitmax`). Tests 58, 343 keys. u-desktop 28 pass keys; MUSTFAIL `nc-units0`.
- 2026-10-15 · P4b · `d0e430f` · per-frame unit windows after the scroll (loadTile's bind hook
  and `director.place()`). Tests 63, 343 keys. u-desktop 32 pass keys; MUSTFAIL `nc-windows` and
  `nc-bind`.
- 2026-10-15 · P5 · `56b6031` · vertical pairs and elected 2×2 quads inside the warp window
  (`?popquads`). Tests 66, 344 keys. u-desktop 37 pass keys; u-rm runs with `--next=1` (A11);
  u-arrive new; the u-tide record rerun accepted; MUSTFAIL `nc-windows-vq`.
- 2026-10-15 · P6a · `8e74419` · a unit joins and leaves its stream as one, with one chip at the
  unit centre. Tests 68, 344 keys. u-desktop 40/40. No probe control; T24 and T25 are the unit
  tests' controls.
- 2026-10-16 · P6b · `cdcf25d` · per-stream video tiers inside today's decode budget
  (`?poptier`). Tests 71, 345 keys. u-desktop, u-mobile, u-arrive, u-hidpi, u-phonehd and
  u-phonehd720 43/43, u-rm 36/36, u-tide 33/33, u-tile 38/38; off-phonehd 25/25. MUSTFAIL
  `nc-decode`, `nc-density`, `nc-density-hidpi`, `nc-density-phonehd` and `nc-pin`.
- 2026-10-16 · P7 · `eadf842` · globe-only `?globethumb` and the `?popequiv` tile budget, plus
  P7-1 to P7-6 (darkThumbs, the finite guard, argv and negctl, the fading-chip latch, density
  parity). Tests 72, 347 keys. OFFSET 25/25 (off-flat 10/10); UNITS 43/43 on every tier key, u-rm
  36/36, u-tide 33/33, u-tile 38/38 and u-equiv 42/42. u-hidpi's first run stalled under load,
  and its one rerun passed 43/43. MUSTFAIL `nc-thumb` (`legacyParity`). The watch run
  `watch/u-hidpi-today` failed `texPeak` alone, vacuously (no `--baseline`).
- 2026-10-16 · P8 · docs: `## Media spans` above; Parity moves `VideoSlotPool.jsx` and
  `cascade.js` to Modified; the tunables guide (header counts 347 params across 30 reader files,
  the probe's span flags and gates, the `__swmPopStats` row, re-cited globe and World tables);
  the probe's usage header (seed 42, the run matrix, the controls); the video diet's stale
  claims in three older docs; the bakes' stale comments. No probe run and no browser: the
  latest run counts are P7's, above.
- 2026-10-23 · bake · Nathan's dial (`/?popunits=1&poptune=1&popseed=690425&popholdjit=0.4&poptrans=0.6&popnamesize=0.83&popnameband=0.57&popnameface=0.44&popnamespanmax=4&popunitmax=4&popequiv=12&globeres=720p`)
  baked as six commits, with coupled knobs sharing one: `f9ba340` the clock (hold ± 0.4, a 0.6 s
  change), `a528914` the name strips (size 0.83, band 0.57, face 0.44, span max 4), `b3a5c9f` Q7
  (`?popunitmax` 4), `525e04c` Q8 (`?popequiv` 12), `e117c98` Q1 (spans on) and `85656dc` Q22 (the
  desktop pin 720p; phones keep 480p). Not baked: `popseed` (random per visit, his 10-06 call)
  and `poptune` (the bench). The `?param` reads stay as overrides (Q27). Tests 93, 347 keys. No
  probe run and no browser: the records predate the bake (Baselines and seeds above).
- 2026-10-24 · shapes · Nathan's shape set (Q28), behind `?popshapes` (`wide`, the default;
  `classic` = the 10-23 set). mediaClass stamps a second class `uw` by family (≥ √(4/3) a 3×2,
  ≤ √(4/5) a 1×2, else a quad; the same label proposal and native veto). A sharp 3×2 (spanSharp)
  forms one; a soft one, or one with no room (born rows, outside [θN, θS]), forms its 2×1 pair
  (`UNIT_FALLBACK`); every sharp square is a quad (no election). One texture per asset keeps its
  picture's aspect, clamped to the span of the slots it serves (its own, the fallback, the
  single), so every slot crops as it would the source: a 3:4 single shows 75% of its picture,
  not the 32% a 1×2-shaped texture would leave it. Wide plans the two-row units in a pass of
  their own first; in one pass, the pairs of the row below took their cells (T37's board: h 29
  v 4 q 0 w 0, then h 22 v 6 q 1 w 1). Census of the home island (283 assets, T1 512): 44 3×2s,
  10 soft ones to pairs, 128 1×2s, 89 quads, 6 soft squares and 6 others single. At
  `?popequiv` 12 a world selects 3–6 assets (6 3×2s over the 15 worlds) and its textures weigh
  ≈ 1.5× classic's (worst world pair ≈ 43 MiB against 29, RGBA + mips, estimated). The gates
  read `?popshapes` (a wide class size is a curve); the probe records are classic's, so a wide
  run needs its own keys recorded. Tests 96, 348 keys. No probe run and no browser.
- 2026-10-24 · bake · Nathan's second round, from a bench screenshot ("doing what i am looking
  for"): `?popequiv` 32 (the slider's top; Q8 re-dialed), `?popnames` 0 (no name strips) and
  `?herotilt` −10 (was 45.5), the angle fitted to his screenshot's three latitude gap lines
  under the desktop rest rig (fill 0.85, elevation 8: rms 0.08°, and a 5° step costs ≥ 0.46°),
  so the north pole sits out of sight at load. Two fixes ride with the tilt: the drag clamp
  bounds the SHOWN tilt to ±40°, widened to take in a rest set past it (clamping pitch alone
  left −90° reachable from a −10° rest), and VideoGlobe seeds the first build's prominence order
  with the rest tilt (it ranked panels under 40°, 58° from where the camera now faces). At 32 a
  wide world selects 6–13 assets (17 3×2s, 79 1×2s and 39 quads over the 15 worlds) and its
  textures weigh ≈ 2.4× those at 12 (worst world pair ≈ 108 MiB against 43, estimated).
  `?popquads` does nothing under wide. Tests 96, 348 keys. A headless look at :4322 showed the
  new tilt; no probe run.
- 2026-10-25 · bench · Nathan, undecided on the tilt: the worlds bench (`?poptune=1`) gains an
  orientation group, a `tilt` toggle between `new` −10 and `old` 45.5 (heroConfig
  `TILT_PRESETS`), written through `setHeroTune('tiltDeg')`, so it flips live. The first
  layout's prominence order follows the tilt only on a reload (`?herotilt=45.5` for the old
  load), and copy_url carries `?herotilt` when it is off the default (`withHeroTilt`, kept in
  heroConfig so the key scanner does not read the bench's `['world', 'blue']` options as a key
  pair). No default changed. Tests 96, 348 keys; a headless click flipped new → old → new.
