# Perf & Bloat Pass — Homepage Globe + /work Featured Projects

## Context

The homepage (`/`) and Featured Projects (`/work`) are the two most compute-heavy
pages on the SWM site — each mounts a persistent three.js scene with a live-HLS
video tier. Nathan reported five concrete issues plus openness to trimming bloat:

1. **Globe frame-drop** on video playback, worst when click-dragging the globe to
   reveal new panels.
2. **Globe video too soft** — wants crisper playback (at the same time as #1).
3. **/work scroll-trigger lag** on the World-Turn transition to the next project.
4. **Deck viewer overlaps media** — the Brand Deck should *take the place of* the
   tiles in the upper-right quadrant, not sit on top of them.
5. **Video assets should load faster** on both pages.
6. **General bloat** accumulated over the build.

A read-only parallel review (6 agents) confirmed every root cause at file:line and
corrected two of my hypotheses (see Notes). Nathan's decisions this pass:
**480p globe video; fewer tiles but MORE live videos + more staggered fan-out on
/work; dials+stagger for the scroll-lag now (prebuild deferred until the mobile
breakpoint config / HR-6 is locked); include lazy-`hls.js` with a Safari +
reduced-motion test gate as a required merge check.**

Two hypotheses were **refuted / refined** and shape the plan:
- Globe VideoTexture uploads are NOT the drag cost — three r184 gates them to
  `requestVideoFrameCallback` (presented frames, ~24-30fps), so they're a modest
  constant. The drag stutter is an **uncapped live-video promotion burst**.
- The 250×230 World Shell is a single `LineSegments` draw call built once at mount
  — over-dense, but NOT the Turn-frame bottleneck (that's the synchronous build).

---

## Progress — updated 2026-07-24

- **DONE — Stage 1 (cheap defaults):** WS2 globe 480p; WS3 density dials (superseded on
  /work, see below); WS5 webp + `WORLD_MAX_LIVE` 4 + `THUMB_SIZE`; WS6 dead consts + Mux
  preconnect. Commit `14bf4ce`.
- **DONE — /work field rework (beyond the original plan, from live feedback):** nav-safe
  framing (`FIELD_OFFSET_Y`/`SPREAD_X`/`SPREAD_Y` in `placeTiles`), `MAX_TILES`→7,
  video-first composition (video→Near front tier, capped at play budget), count-linked
  thumb (fewer tiles → bigger), `DPR_MAX` 2→1.5 for memory. Commits `ee3389e`,
  `c7eeaff`, `ec26afa`. Absorbs the WS3 density intent and adds nav-inset + video-priority
  + a memory cut. `/work` 1.1 GB Chrome memory diagnosed = stable GPU/video baseline, NOT
  a leak.
- **DONE — Stage 2 (burst + latency):** WS1 globe `MAX_PROMOTES_PER_UPDATE`=2 + drag-defer
  (promotions skip while `controller.dragging`; demotes/swaps unaffected) + pointer-lifecycle
  hardening in InteractionController (primary-button-only, `lostpointercapture`/`blur` →
  release) so a swallowed pointerup can't strand the defer flag. WS5 worldLive fill window
  (parallel promote into all free slots per attach, persists until the field is full) +
  event-driven promote chaining on resolve/reject. Headless-verified: /work fills 4 slots
  in ~2s (was serialized), globe holds 0 promotions through a 6s drag then refills to 7
  in ~2.5s post-release.
- **TODO — Stage 3 (structural):** WS3 build-stagger + fan-out; WS4 deck exclude-rect
  (the /work deck-band still sits low / overlaps — it's outside the new tile safe-region).
  ← **next**
- **TODO — Stage 4 (bundle diet):** code-split benches + lazy-`hls.js` (Safari/RM gate).
- **DEFERRED:** full idle-prebuild (mobile density / HR-6). Optional: webp on the 5
  detail-page Mux sites; live-res 720→540 if memory needs more.

---

## Workstream 1 — Globe frame-drop (complaint #1)

Root cause (confirmed `LivePanelScheduler.js:139-153`): the promote loop fills
**every** free slot in one 2Hz beat with no cap (unlike swaps, capped at
`MAX_SWAPS_PER_UPDATE=4`). A drag synchronizes events — panels past `DEMOTE_SCORE`
demote together, their 0.6s crossfades complete together (release burst), then 1-2
beats later the loop refills all freed slots + newly-revealed panels → up to
**7 `new Hls()` + MSE setup on ~one frame**. The scheduler also runs regardless of
drag state (no `controller.dragging` gate).

| Change | File | Effort |
|---|---|---|
| **Cap promotions per beat** — add `MAX_PROMOTES_PER_UPDATE` (1–2), break the promote loop after N, mirroring the existing `MAX_SWAPS_PER_UPDATE` pattern | `LivePanelScheduler.js:149-153` (+ const near `:41`) | S |
| **Defer promotions during active drag** — thread `controller.dragging` into `scheduler.update()`, early-skip the promote loop while true (flag already exists `InteractionController.js:58,116`) | `useGlobeScene.js:721-724`, `LivePanelScheduler.js:138-153` | S |
| **(Secondary) rear-hemisphere visibility cull** — set `panel.mesh.visible = score > margin` per beat (reuse the scores already computed for stats), cutting ~99 draw calls → ~50. Use a margin behind score 0 + hysteresis so nothing pops at the silhouette | `useGlobeScene.js` (per-beat, reuse `:728-734` scores) | M |
| **(Secondary) adaptive DPR downshift** — the tick already computes achieved fps (`:736-737`); under sustained <45fps lower `setPixelRatio` (2→1.25) with hysteresis | `useGlobeScene.js:199,726-743` | M |

The cap + defer pair is the fix; the two secondary levers are baseline/robustness
(fold in if the burst-fix alone doesn't fully settle weak GPUs). Keep `MAX_LIVE=7` —
Nathan wants *more* live video, not less, and cap+defer smooths the burst without
cutting the live count.

---

## Workstream 2 — Globe video resolution → 480p (complaint #2)

Root cause: desktop video is gated **twice** — `STREAM_PARAMS` caps the Mux manifest
at 270p (`globeConfig.js:60`) AND `preferMinQuality` pins hls to the lowest rung
(`VideoSlotPool.jsx:44` → `useHls.js:104-114`). Filtering is NOT the cap — the
LinearFilter magnification is correct; the source is simply under-provisioned for
the ~250-500 device-px center panels.

| Change | File | Effort |
|---|---|---|
| Desktop `STREAM_PARAMS` → `'min_resolution=480p&max_resolution=480p'` (collapse the manifest to one rung so `preferMinQuality`'s level-0 lock lands ON 480p — the exact pattern mobile already uses). **Do NOT** bump `max_resolution` alone — level-0 would then pick the lowest sub-480p rung | `globeConfig.js:58-60` (desktop branch) | S |
| Fix the stale `'30fps gate'` comment (code caps at 60) | `useGlobeScene.js:6` | S |
| **(Optional, 4K only)** `THUMB_WIDTH` 512→640 for the pre-video still on large displays | `globeConfig.js:51` | S |

Leave filtering untouched (`LivePanelScheduler.js:190-195`, `TextureManager.js:34-37`)
— adding mipmaps to a video texture is wasted at panel scale. Mobile (540p) is already
correctly provisioned. Decode cost ~3×/panel at 480p is trivial for desktop hardware
decoders, and Workstream 1 frees the headroom.

---

## Workstream 3 — /work scroll-lag: dials + stagger (complaint #3)

Root cause (confirmed): `commitTurn`→`setActive`→ index effect →`goToWorld`→
`buildSlot(incoming)` runs **synchronously on the trigger frame** —
`placeTiles` + up to `MAX_TILES(16)` PlaneGeometry+Material + 16 `loader.load` + up
to 2 `createWorldBand` (each 8 planes+loads) + ~32 tween registrations, on the same
frame React re-renders (`useWorldScene.js:454, :288, :296-367, :374-409`). Then a
texture-upload train hits the next frames, and both slots render co-present for
`TURN_DURATION=1.7s`.

**Approach: dials + stagger (prebuild deferred until mobile density is locked).**

| Change | File | Effort |
|---|---|---|
| **Stagger the build across frames** — chunk the tile-create loop + the two `createWorldBand` calls so each rAF frame allocates/loads ~4-6 tiles instead of ~32 in one stack. Tiles are already `opacity:0` until their texture lands (`:304/:352`), so progressive creation is invisible. Must interleave with the Turn tween so late tiles still crossfade | `useWorldScene.js:296-367, :374-409` | M |
| **Staggered fan-out (Nathan's idea)** — add a per-tile `delay` on the `firstView` appear tween keyed to resting radius or index (inner tiles bloom out first, outer later), converting "random pop as each texture lands" into a coherent outward sequence that *masks* the load-time jitter | `useWorldScene.js:352-359` (appear tween) | S |
| **Density cut — fewer tiles** (Nathan) `MAX_TILES` 16→**12**, `MIN_TILES` 8→**6** (desktop). Lower floor also kills duplicate-cover clutter on thin projects (`:271-272`). Both are `?max`/`?min`-tunable | `worldConfig.js:33-34` | S |
| **Fewer deck pages** `BAND_MAX_PAGES` 8→**5** AND `BAND_PAGE_CAP` 8→**5** (must stay matched or the client requests pages the payload didn't ship). A 5-page stack still reads as a deck | `worldConfig.js:110`, `pages/work/index.astro:30` | S |
| **(Optional) lower shell density** `SHELL_MERIDIANS/PARALLELS` 250/230 → ~90/60 (mount-cost + 736KB→~115KB buffer; visually near-identical faint grid). Design call — flag before committing | `worldConfig.js:144-145` | S |

**Deferred (not this pass):** full idle-prebuild of the ±1 Worlds. Its cost is
concentrated in mobile VRAM (2-3 resident Worlds) — the exact axis HR-6 hasn't
finalized — so building it now means tuning the cache depth twice. Revisit only if
the Turn still hitches after the dials, and after mobile density is locked.

---

## Workstream 4 — Deck overlap fix (complaint #4)

Root cause (confirmed): `buildSlot` appends band **placeholders** to the phyllotaxis
sequence (`useWorldScene.js:289`), reserving a slot at a seed-arbitrary golden angle
in the OUTER annulus — then `bandDefs.forEach` **discards** that slot and hard-forces
the deck to top-right (`anchorW*BAND_POS_X, halfH*BAND_POS_Y`, `:374-393`). So the
deck's real footprint is unreserved and tiles land under it. `placeTiles` only clears
the central disc (`CENTER_CLEAR_FRAC`) — no rectangular exclusion exists.

**Fix — give `placeTiles` a rectangular keep-out keyed to the deck's ACTUAL rect:**

1. In `buildSlot`, before `placeTiles`, build one normalized `excludeRect` per band:
   `cx = BAND_POS_X * inboard` (inboard = 1 deck / 0.6 album, same value as `:379`),
   `cy = BAND_POS_Y` — these ARE the deck center in `placeTiles`' normalized frame
   (same +x-right/+y-up convention, no flip). `halfX/halfY` from the deck world
   footprint (`pageW` + fan-right + pile-left spread from `bandLayout.js:50-63`,
   `pageH`) ÷ band-tier half-extents, + ~10-15% margin.
2. Pass `excludeRects` as a 3rd `placeTiles` option.
3. In `placeTiles`, after the annulus clamp (`seededLayout.js:84-86`), test each
   center against every rect; if inside, displace to the nearest rect edge (mirror
   the radial `innerR` clamp).
4. **Drop** the band placeholders from the `placeTiles` input (`:289`) — the rect now
   does the reservation, and removing the phantom slot stops it perturbing the
   phyllotaxis `n`/angle.

| File | Effort |
|---|---|
| `seededLayout.js:60-88` (add `excludeRects` param + post-clamp displacement) | M |
| `useWorldScene.js:288-294` (compute zones, pass rects, drop placeholders) | M |

Key off `BAND_POS_X/BAND_POS_Y` (not a new const) so it tracks the live `?bandx`/
`?bandy` tunables + the deck debug panel. `excludeRects` is an array (deck + album can
coexist). The tile-count cut (WS3) mitigates any crowding of the remaining quadrants;
if needed, nudge `CLUSTER_RADIUS` up ~0.05-0.1.

---

## Workstream 5 — Faster video/still loads (complaint #5) + MORE live video

| Change | File | Effort | Note |
|---|---|---|---|
| **Preconnect** `stream.mux.com` + `image.mux.com` with `crossorigin` (both fetched with CORS) — removes a cold DNS+TLS+TCP handshake from the first globe manifest, first globe still, AND first /work still. Highest-ROI, both surfaces | `layouts/BaseLayout.astro:85` | S |
| **Build-time preload** first ~7 globe panel stills (`<link rel=preload as=image crossorigin>`) from the already-computed pool, so they fetch in parallel with the `client:only` bundle instead of after hydration. Device-neutral width (512), stills-only (params branch on `IS_MOBILE`, unknowable at build) | `pages/index.astro:24` → BaseLayout head | M |
| **MORE live videos + fill them fast** (Nathan) — raise `WORLD_MAX_LIVE` 3→**4** (desktop); pay for it with the tile cut. AND fix worldLive latency: **parallel first-fill** (promote all free slots on the first beat after `attach()`, gated by an "initial fill done" flag; keep one-at-a-time for later rotations) + **event-driven promote** (in `promote().then`, if slots free + candidates waiting, call `update()` immediately instead of waiting the next 0.5s beat) | `worldConfig.js:89`, `worldLive.js:73,76-80,129-164` | M |
| **Right-size + webp /work stills** — `THUMB_SIZE` 1024 (2× oversampled even for Near at DPR2) → tier-aware (Near ~768 / Mid ~512 / Far ~384) or flat ~640, and `.jpg`→`.webp` on the Mux thumbnail branch (~40-60% fewer bytes). Apply the webp switch to globe stills + band pages too | `worldConfig.js:35`, `useWorldScene.js:102`, `TextureManager.js:20`, `worldBands.js:61` | S |
| **(Secondary) HLS config** `POOL_HLS_CONFIG` + `lowLatencyMode:false` (Mux VOD isn't LL-HLS) + `backBufferLength:0` (4s loop replays from forward buffer). Minor startup shave + steadier memory | `VideoSlotPool.jsx:31-34` | S |
| **(Optional) idle-prefetch ±1 Worlds' Near stills** so a Turn reveals stills instantly | `useWorldScene.js:454,500-505` | M |

---

## Workstream 6 — Bundle diet (complaint #6) — everything, incl. lazy hls.js

Confirmed: **zero code-splitting** in `src/` — every dev bench + hls.js is a static
import into a shipped, hydrated island.

| Change | File | Effort | KB (both target pages) |
|---|---|---|---|
| **Lazy-load `hls.js`** — drop the top-level import; `const { default: Hls } = await import('hls.js')` on the MSE branch only (Safari native-HLS + reduced-motion skip it). Poster/crossfade masks the async tick. **Required merge gate:** globe promote + /work live + Lightbox + detail MediaSlot/NextProjectBand, each × {normal, reduced-motion} × {Chrome, Safari}; verify the `Hls.Events.ERROR` path handles a failed dynamic chunk | `useHls.js:28` + attach body (5 consumers unchanged) | M | ~130 gzip |
| **Code-split the 4 dev benches** — keep the hydration-safe `?param`+`useState`-flip gate, replace the static import with `import().then(m => setPanel(...))`. **LenisTunePanel first** (in `SiteShell`, ships on EVERY route via the persistent shell) | `SiteShell.jsx:32-33`, `Hero.jsx:74`, `FeaturedProjects.jsx:31-35`, `ProcessPage.jsx:20` | M | ~4-9 gzip |
| **Move dev-bench CSS into the (now lazy) panels** — drop `lenis-tune.css` + `hero-tune.css` from `BaseLayout`, `fp1-tune.css` from `/work` | `BaseLayout.astro:16,19`, `work/index.astro:17` | S | few KB |
| **Delete dead consts** `CURVE_STRENGTH`, `BG_COLOR` (zero import sites, self-labeled superseded/legacy) | `worldConfig.js:48,153` | S | ~0 |
| **(Optional cleanliness)** dedupe `IS_MOBILE` + `PARAM(key,fallback)` into `src/lib` (near-0 KB — gzip already collapses; maintainability only) | multiple | M | ~0 |

**Not touched (confirmed non-issues):** `styled-components` + `@mux/mux-node` have
zero `src/` usages — they're transitive Sanity Studio deps, only in the `/studio`
bundle. `three/examples` imports are legit tree-shaken subsets. The home globe uses
three CORE only. Dev-only routes (`/lab/globe`, `/specimen`, `/work/directory`,
`/process`) are separate entry chunks — 0 KB on `/` and `/work`, deprioritized.

---

## Suggested sequencing

1. **Cheap, high-impact defaults first** (all `?param`-reversible): WS2 (480p one-liner),
   WS3 density dials, WS5 `WORLD_MAX_LIVE`+webp+stills, WS6 dead consts + preconnect.
   Verify the globe crisps up and /work reads calmer.
2. **Burst + latency fixes:** WS1 promote cap + drag-defer; WS5 worldLive parallel-fill
   + event-driven promote.
3. **Structural:** WS3 build-stagger + staggered fan-out; WS4 deck exclusion-rect.
4. **Bundle diet:** WS6 code-split benches + dev CSS, then **lazy-hls.js last** with the
   full Safari/RM test matrix as the merge gate.

---

## Verification

**Local scene verification recipe** (from the session-context playbook):
- `/` HMRs onto Nathan's `:4321` dev server fine. For `/work` (and to un-gate `/process`
  if touched), run a scratch server `npm run dev -- --port 4408` (dev mode) and drive it
  with the `/tmp/pw-verify` playwright-core + chromium-headless-shell harness (ANGLE metal
  + autoplay flags). Kill scratch servers after + `git checkout -- .astro` (the scratch
  server dirties the `.astro/` cache).

**Per-workstream checks:**
- **WS1 (frame-drop):** with `?debug`, watch the FPS stat while click-dragging the globe
  fast to reveal new panels — the drag should stay smooth (no burst hitch). Confirm live
  panels still fill within ~2-3s after release (cap spreads them over beats).
- **WS2 (resolution):** load `/` on desktop, compare a center panel's video sharpness
  before/after; confirm via network panel the Mux manifest returns a single 480p rung.
  Sanity-check mobile still requests 540p.
- **WS3 (scroll-lag):** scroll-trigger to the next project repeatedly; the Turn should fire
  without a click-frame stall. Confirm tiles bloom outward in a staggered sequence, not a
  random pop. Sparse projects should read calmer (no duplicated covers).
- **WS4 (deck):** open a project WITH a Brand Deck; confirm no media tile sits under the
  top-right deck and tiles cluster around it. Test a project with BOTH deck + album art.
  Re-check `?bandx`/`?bandy` nudging still moves the deck (rect tracks it).
- **WS5 (loads):** cold-load `/` and `/work` with network throttling; confirm first stills
  paint sooner (preconnect + preload), /work live tier fills faster (parallel first-fill),
  and still requests are `.webp` at the reduced sizes.
- **WS6 (bundle):** `npm run build`; diff the `/` and `/work` entry-chunk sizes before/after
  — hls.js + benches should no longer be in the initial chunks. Load each page with the dev
  `?param`s to confirm the benches still mount (now async).
- **WS6 lazy-hls MERGE GATE (required):** the full matrix — globe promote, /work live tier,
  Lightbox, detail MediaSlot + NextProjectBand video — each under {normal, reduced-motion}
  × {Chrome, Safari}. Confirm Safari native-HLS still plays and a blocked dynamic chunk
  degrades to poster, not a crash.

**Overall:** no regression in the hero intro/lockup, the process page, or reduced-motion
(stills-only) paths. Everything density/quality is `?param`-tunable, so Nathan can dial the
final feel on the real projects after the mechanics land.
