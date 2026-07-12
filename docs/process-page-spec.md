# Process Page — Build Spec

> DRAFT — grill pending.
> **Vocabulary:** `CONTEXT.md` § "Process Page — concepts" — Fragments, the Thread, the Core, Stages.
> **Decision record:** `docs/adr/0004-process-scroll-driver.md` *(written after grill round 1)*; lineage: ADR-0002 (route-scoped canvas), ADR-0003 (pure geometry brains, thin renderers).
> **Reference:** the home globe system (`src/components/globe/`) — the process scene is built from its primitives, not from a fork of it.

## Open decisions (grill)

Resolved answers replace the strawman inline; struck rows are settled. Every question ships with a recommendation.

| # | Question | Recommendation |
|---|---|---|
| G1 | Scroll→state driver | ✅ **Resolved 2026-07-12:** ScrollTrigger, discrete boundary triggers — no scrub, no pin, no snap → ADR-0004 |
| G2 | Page composition | ✅ **Resolved:** full-viewport fixed canvas behind a scrolling copy column (~40ch); globe biased right-of-center per stage |
| G3 | Time-based vs scrubbed | ✅ **Resolved:** authored time-domain timelines fired at boundaries |
| G4 | Copy storage | ✅ **Resolved:** single `src/components/process/processContent.js` module |
| G5 | Name for the experience | ✅ **Resolved:** plainly **"Process"** — the worlds motif lives in the visuals and copy, not the experience name (Nathan) |
| G6 | The three candidate globes | ⛔ **Superseded by G13** — the trio itself was cut; "Seed Worlds" retired unused |
| G7 | The winning concept globe | ✅ **Resolved:** **the Core** (Nathan's term) — the globe the connected Fragments construct; ties Stage 2's selection into Stage 3's `core_identity` |
| G8 | The stroke + the steps | ✅ **Resolved:** **the Thread**; steps = **Stages**, tokens `STAGE_01…STAGE_05` |
| G9 | H1 register | ✅ **Resolved:** token + display H1; Nathan's direction "from core concept to full world, building from the inside out" → H1 `FROM CORE TO WORLD` (final line sign-off at solidify) |
| G10 | Stage headline register | ✅ **Resolved:** short declaratives — the chip carries the label register |
| G11 | Nav label + glyph | ✅ **Resolved:** `process` + `⊙` (matches the removed v1 link's label; `⊙` = a core inside a world, unclaimed in the glyph set) |
| G12 | CTA section | ✅ **Resolved:** `↳ start_project` primary + `⁕ featured_projects` secondary |
| G13 | Stage-1 visual (unspecified in the brief) | ✅ **Resolved — REDESIGN (Nathan):** the three-globe trio is cut (it implies SWM always pitches three concepts). S1 = ~84 panel **Fragments** drifting unconnected, "almost like an asteroid belt"; S2 = **the Thread** shoots from the would-be globe's center, chains Fragment to Fragment ("connecting the dots"), and the connected Fragments are **pulled inward to construct the Core** — one unified concept assembled from what the client gives us, then the foundation is added |
| G14 | Stage-3 light-up cascade variant | ✅ **Resolved:** `rows` (pole-to-pole waterfall) — the home hero keeps `sweep`; shipped as `?cascade` |
| G15 | Stage-5 rhythm | ✅ **Resolved:** loop cadence anchored to `?bpm` (default 122) |
| G16 | Mobile strategy | ✅ **Resolved:** full live scene (contain-fit); stills are reduced-motion-only |

## Purpose & goals

**Commercial:** walk a prospective music-industry client through how SWM builds a visual world — from first reference to a living brand system — and convert: `start_project`. The page is the sales narrative the work pages assume.

**Experiential:** the globe is the narrative device. The page doesn't describe the process next to a picture — the brand mark *performs* the process, one state per Stage, scroll-driven. A visitor who reads nothing still watches a world get built.

**Non-goals:** no CMS-driven copy (fixed editorial, no churn owner), no client media on panels (abstract states only — media worlds live at `/work`), no case-study content.

## Scope

**This build:** the `/process` route (gated until launch), the ProcessScene stage machine (5 states + transitions), the scroll driver, the complete copy deck, arrival choreography, nav re-add at un-gate, reduced-motion and mobile paths.

**Deferred:** panel media texturing (Fragments sampling actual client artwork), envelopment bridges *into* `/process` from other routes (arrivals are plain `ClientRouter` navs + the standing `swm:fill-release` insurance), per-stage deep links (`#stage-03` anchors are cheap — decide during build).

## User flow narrative

A visitor lands on `/process` from the nav (or a direct link). The RouteFill releases, `THE_PROCESS` scrambles in, the H1 resolves — and where the globe should be, there isn't one yet: ~84 dark panel **Fragments** drift unconnected right-of-center, almost an asteroid belt. Scrolling into **STAGE_01 / discovery**, the copy explains what we gather; the Fragments just drift — raw material, not yet a world. At **STAGE_02 / visual_language**, **the Thread** shoots out from the belt's empty center, hits a Fragment, then chains Fragment to Fragment, trim-path style — connecting the dots. As the last dot connects, the Fragments are pulled inward and construct a globe: **the Core** — one unified concept assembled from what the client gave us, the electric-blue foundation surfacing behind its panels as it closes. The Stage-3 headline arrives composed inside the Core's silhouette, then the camera pulls back, leaving the last step in the distance. At **STAGE_03 / core_identity**, the cascade fires: panel by panel, pole to pole, the Core lights up electric blue — the foundation goes solid. At **STAGE_04 / build_out**, panels emanate outward one by one and the whole world grows — assets extending the core. At **STAGE_05 / living_world**, the full-size globe runs rhythmic pattern loops — pole-to-pole cascades, equator-out radiation — a world with a pulse. The page closes on `YOUR WORLD NEXT`: `↳ start_project` opens the inquiry overlay in place; `⁕ featured_projects` exits to `/work`.

## 1. Page composition & layout

- **Route:** `src/pages/process.astro` — frontmatter + one React island, the `index.astro` mold (`src/pages/index.astro:31`, `client:only="react"`; the island owns GSAP orchestration so SSR HTML is copy-only). Island: `ProcessPage.jsx` (`src/components/process/`).
- **Body class:** extend `BaseLayout.astro`'s `class:list` (`src/layouts/BaseLayout.astro:88`) with `isProcess && 'route-process'` — server-side like `route-home`, no hydration flash. Chrome variants (nav treatment over the black field) key off it in CSS.
- **Scroll:** normal document flow. Lenis auto-inherits — the wheel-ownership exclusion is exact-match `/work` only (`src/lib/smoothScroll.js:29`); reduced motion never starts Lenis (native scroll).
- **Canvas:** one full-viewport `position: fixed` layer behind the copy (`z-index` below `.site-shell`'s 100), `aria-hidden`. The scene composes the globe right-of-center on desktop via group offset — copy column and globe share the frame rather than splitting it.
- **Copy column (desktop):** left-anchored, `max-width: ~40ch`, normal flow. Each Stage section: mono chip label → headline → blurb. Stage sections `min-height: 140vh` (scroll runway per state); hero `100vh`; CTA section `~90vh`.
- **Mobile (≤768px):** copy blocks full-width above a black gradient scrim (three-color discipline: black surface / white text / electric-blue accent); globe contain-fit at reduced fill fraction (`?fillfrac`, ~0.7 — **not** the home globe's mobile cover-overscan: the Stage-1 Fragment belt must fit whole).
- **Semantic fallback:** all copy is real DOM (`h1`/`h2`/`p`) in source order — the page reads completely with the canvas absent.
- **Background:** brand black `--color-black` (the F1 info-panel surface family), not electric blue — the page begins as the void the world is built in, and blue arrives *as the story event* in Stage 3.

## 2. Copy deck

Registers (brand-polish audit rule §4.4): **chrome = lowercase snake_case mono · display = squeezed caps · prose = sentence case**, em-dashes, triads. Scramble tokens use the house terminal cadence (`src/lib/scramble.js` — chars `01<>[]{}/\|=+*#%░▒▓█—`, 1.4s). Blurb budget: **≤45 words, ≤3 sentences** (acceptance-checklist item, not a suggestion).

| Key | Register | String |
|---|---|---|
| meta.title | — | `Process — Small World Media™` |
| meta.description | prose | `How Small World Media builds visual worlds for the music industry — discovery, visual language, core identity, build-out, and a living brand world.` |
| nav.label | chrome | `process` (glyph `⊙`) |
| hero.token | token | `THE_PROCESS` |
| hero.h1 | display | `FROM CORE TO WORLD` |
| hero.sub | prose | `Five stages, built from the inside out — from first signal to a fully realized world.` |
| hero.cue | chrome | `scroll_to_begin` |
| s1.token / s1.chip | token/chrome | `STAGE_01` / `discovery` |
| s1.headline | display-sm | `First, we listen.` |
| s1.blurb | prose | `Every world starts with a signal — your needs, your references, your audience. We map where you sit in the culture and gather the raw material a world is built from.` |
| s2.token / s2.chip | token/chrome | `STAGE_02` / `visual_language` |
| s2.headline | display-sm | `Connecting the dots.` |
| s2.blurb | prose | `We fold your references into a refined moodboard — one thread through the fragments, connecting the dots until the picture holds. What was scattered pulls together: a single, unified concept. The core.` |
| s2.captions | chrome | `references_folded` → `dots_connected` → `core_assembled` (scramble on Thread hops / assembly) |
| s3.token / s3.chip | token/chrome | `STAGE_03` / `core_identity` |
| s3.headline | display-sm | `The foundation goes solid.` |
| s3.blurb | prose | `The core takes its identity — logo, type, and color as one system. The anchor everything else hangs from. This is the moment the world lights up.` |
| s4.token / s4.chip | token/chrome | `STAGE_04` / `build_out` |
| s4.headline | display-sm | `The world expands.` |
| s4.blurb | prose | `The identity goes to work — event creative, album art, templates, mockups across physical and digital space. Each asset built from the one before it, pushing the world outward.` |
| s5.token / s5.chip | token/chrome | `STAGE_05` / `living_world` |
| s5.headline | display-sm | `A world in motion.` |
| s5.blurb | prose | `Complete guidelines. Finalized assets. A brand world with its own rhythm — every piece an extension of the original concept, moving with the music.` |
| cta.display | display | `YOUR WORLD NEXT` |
| cta.line | prose | `See where the process leads — or start one of your own.` |
| cta.primary | chrome | `↳ start_project` — dispatches `swm:open-overlay` (`src/components/SiteShell.jsx:55`), overlay opens in place |
| cta.secondary | chrome | `⁕ featured_projects` → `/work` (`.fp-cta` family + `CtaArrows`) |
| footer | — | `SiteFooter` unchanged (tagline is home-only by design) |

All strings live in `src/components/process/processContent.js` (G4) — one module carrying `{ id, token, chip, headline, blurb }` per Stage; the stage machine and the copy render from the same records.

## 3. ProcessScene — the stage machine

A new `useProcessScene` hook (`src/components/process/useProcessScene.js`) composing the globe primitives directly — **not** a fork or extension of `useGlobeScene` (that hook is fused to CMS thumbnails, the live-video scheduler, and drag interaction; per ADR-0003's grammar, the brains are reused and the consumer stays thin):

- `buildGlobeGeometry({ lonSegments: 12, latBands: 5, gapDeg, capDeg, radius })` (`src/components/globe/buildGlobeGeometry.js:72`) — panel records `{ geometry, row 0–6, lonIndex 0–11, centerDir, isPole }`. **Do not reduce the 12×(5+2) grid — the density is the mark.** The Stage-1 Fragments are these same 84 panels with scattered start transforms, not a separate system: every panel keeps its home `row`/`lonIndex` identity from birth, which is exactly what makes the assembly legible.
- Seeded scatter: Fragment belt transforms (position on a loose annulus, random orientation, drift phase) come from the deterministic PRNG utilities already in the codebase (`mulberry32`/`hashSeed`, `src/components/work/world/seededLayout.js`) — same belt every visit, tunable via `?scatter`/`?drift`.
- `createPanelMaterial({ fallbackColor })` (`src/components/globe/panelMaterial.js:82`) — untextured, so the fragment reduces to `uFallbackColor * uPower` (`panelMaterial.js:58-59`). **The entire visual language of this page is two uniforms per panel.** No shader change required; a `uTintColor/uTintMix` addition is the documented fallback only if grading demands separating structure color from lit color.
- `buildCascadeTimeline(panels, variant, totalRows)` (`src/components/globe/cascade.js:50`) — panel-array-generic; used verbatim for the Stage-3 light-up and as the delay-model reference for Stage-4/5 sequencing (`panelDelay`, `cascade.js:29`).
- Inner occlusion sphere per globe at `GAP_COLOR` electric blue (`src/components/globe/globeConfig.js:88` — note: the inline comment says black; the value `0x0000ff` is the truth. Fix the comment during build, cite the value meanwhile).
- Conventions inherited from `useGlobeScene.js`: tan-space `frameCamera` fit, render loop on the shared `gsap.ticker` with a **local** FPS gate (never `gsap.ticker.fps()`), IntersectionObserver + `document.hidden` ticker pause, teardown with `renderer.forceContextLoss()` (route-scoped canvas, ADR-0002 — this page is the site's third scene).

**API:** `{ goTo(stageId), setStageInstant(stageId), dispose }`. One active transition at a time: an interrupting `goTo` kills the running timeline and plays a compressed catch-up morph to the new target — fast-scrolling across three boundaries must never queue three full timelines. `setStageInstant` is the reduced-motion path: jump uniforms/transforms to the stage's rest pose and render one frame.

All transition eases: the house curve — `CustomEase` from `TURN_EASE_PATH` (`src/components/work/world/worldConfig.js:78`; steep launch, long settle, never overshoot). Exits/reversals run ≈0.7× their entrance durations.

### S1 — discovery (the Fragment belt)
No globe yet. The 84 panels drift as unconnected **Fragments** on a loose annulus right-of-center — "almost like an asteroid belt": seeded positions and orientations (`?scatter` governs spread), slow individual drift and tumble (`?drift`), no inner sphere. Visibility treatment: on the black field, dark panels at `uPower 0` would vanish — Fragments idle at a low shard glow (`uPower` ~0.35 against the `0x121212` fallback, reading as barely-lit slate), enough to register as material, not yet as light. The belt is the gathered raw references before they belong to anything.

### S2 — visual_language (the Thread + the assembly)
Two beats. **Connect:** the Thread (see §4) shoots out from the belt's empty center — the point where the globe *will* be — hits the nearest Fragment, then chains Fragment to Fragment through `?threadhops` (default 10) hops, trim-path style. Each hop pings: a scramble caption beat and a brief `uPower` blip on the struck Fragment, whose drift then damps to a gentle hold — claimed. **Assemble:** as the final dot connects (`dots_connected`), every Fragment is pulled inward: per-panel position + quaternion tweens from scatter transform to home `row`/`lonIndex` slot (`?assemble`, ~1.6s total, cascade-family stagger so the sphere closes in a visible order), while the electric-blue inner sphere scales in behind them — the foundation surfacing as the shell closes. The Thread's segments ride their endpoints inward and fade as the construction completes: **the Core** stands assembled (`core_assembled`) — one unified concept built from what was scattered, dark-panelled, blue structure in its gaps.

### S2→S3 — the zoom-out
The Core holds center-frame, large. The Stage-3 section arrives; its headline enters as DOM text (SplitText masked lines) composed within the globe's silhouette — text *in* the world, never GL-rendered type. Then the camera dollies back (`?zoomout`, ~1.0s) / group scales down so the globe sits small again — "the last step in the distance" — before its foundation moment.

### S3 — core_identity (the light-up)
The cascade fires: per-panel `gsap` tweens of `uniforms.uFallbackColor.value` (a `THREE.Color` — tween `r/g/b`) from near-black `0x121212` to electric blue `0x0000ff`, with the `uPower` CRT-flicker keyframes riding the same stagger (`FLICKER_KEYFRAMES`, `cascade.js:22`). Stagger variant: **`rows`** by default (pole-to-pole waterfall — Nathan's pick for this beat; the home hero keeps `sweep`, `DEFAULT_CASCADE_VARIANT`, `cascade.js:19`), switchable via `?cascade`. The globe settles center-frame at moderate size, now *solid*: a blue world where there was black structure. This is the page's single loudest beat — nothing else animates during it.

### S4 — build_out (the emanation)
Per-panel `mesh.scale.setScalar(k)`, 1→`?emanate` (default ~1.35), staggered by `?emanateorder` (default `sweep`, contrasting Stage 3's `rows` per the section-contrast rule): panel geometry is baked at radius with each mesh at the origin, so uniform mesh scale moves a panel outward along its own normal *and* enlarges it — the emanation is geometrically free. Simultaneously the globe group scales up (~1.6×) and the camera pulls back to keep contain-fit — the world visibly outgrows its old frame, each ring built off the one before.

### S5 — living_world (the rhythm)
Panels settle at the expanded radius; looping `uPower` pattern timelines run: the `rows` cascade (pole-to-pole waterfall) alternating with an **inverted `poles`** pattern (equator-out radiation — delay `= (maxRing − ring) · step`, a trivial third delay model beside `panelDelay`'s existing two). Loop cadence anchored to `?bpm` (default 122): one pattern pass per N beats, pulse amplitude modest (`uPower` 1.0 ↔ ~1.12, the flicker ceiling) — a heartbeat, not a strobe. Ambient yaw continues. This state idles indefinitely at the page's foot.

**Draw calls by stage:** ~85 throughout — the belt and the globe are the *same* 84 panel meshes (inner sphere joins at assembly), plus the SVG Thread overlay during S2. Home-globe parity with zero texture memory.

## 4. The Thread

A screen-space SVG overlay above the canvas (below copy), electric-blue stroke ~2px:

- **Path:** origin at the belt's center — the Core's center-to-be — then through the chained Fragments' projected centers (`Vector3.project(camera)` → viewport px; `?threadhops`+1 points re-projected per frame during S2, since the targets drift until claimed), gentle curvature per segment.
- **Draw-on:** `stroke-dasharray`/`stroke-dashoffset` tween — the house technique (`src/components/ProjectOverlay.jsx:15`, CheckIndicator: "stroke-dashoffset animation via GSAP (DrawSVG-style without plugin)"). Duration `?threadms` (900ms per hop), house curve, hop-by-hop with pings; a struck Fragment's drift damps so the drawn path holds its shape.
- **Hand-off:** during the assembly, each segment's endpoints track their Fragments inward; segments fade as their Fragments seat into the Core.
- **Why not in-scene** (`THREE.Line`/tube): 1px line-width platform limits, per-frame tube rebuilds against drifting targets, and the After-Effects trim-path reference is an annotation-layer read — depth occlusion is the anti-goal.
- **Reduced motion:** the Thread renders fully drawn, static.

## 5. Scroll choreography

- **Driver:** ScrollTrigger — registered **in the island only** (first use in the codebase; precedent already blessed in `docs/orbit-deck-viewer-spec.md:44`: "`ScrollTrigger.update` on Lenis scroll (standard pattern)"). One trigger per Stage section: `start: 'top 60%'`, `onEnter`/`onEnterBack` → `scene.goTo(stage)` + that section's copy timeline. **No scrub** (authored time-domain curves own the clock), **no pin** (the canvas is CSS-fixed — zero pin-spacer/Lenis interactions), **no snap** (affordance honesty: it's a document; the scrollbar behaves).
- **Lenis bridge:** `getLenis()?.on('scroll', ScrollTrigger.update)` with cleanup; `ScrollTrigger.refresh()` on `astro:page-load` and `document.fonts.ready`. Under reduced motion Lenis never exists and ScrollTrigger rides native scroll unchanged.
- **Copy entrances** (per section, the WorldCard OS-boot family — `src/components/work/WorldCard.jsx:134-156`): `ScrambleLabel` chip (1.4s house cadence) → SplitText masked-line headline (0.6s, stagger 0.1, `power3.out`) → blurb rise (0.4s, `power2.out`), overlapped, never fully sequential. Leave-back exits at ≈0.7×.
- **Arrival choreography** (mandatory — the brand-polish audit's #1 ethos gap is the detail page's missing arrival; this page does not repeat it): on island mount, dispatch `swm:fill-release` (the `src/components/work/detail/FeaturedProjectDetail.jsx:58` pattern; RouteFill's 2500ms safety valve covers pathological loads) → hero sequence: `THE_PROCESS` scramble → H1 SplitText lines → the Fragment belt materializes (per-Fragment scale 0→1, seeded stagger, house curve, ~0.9s) → scroll cue fade. Plays identically on direct load and client-side nav; once per mount.
- **Interrupt policy:** boundary spam resolves to the latest target via `goTo`'s kill-and-compress; copy timelines are per-section `useGSAP` scopes and self-clean.

## 6. Route, gating, nav, SEO

- **Gate (from the first build commit)** — the exact three-part disabled-route pattern:
  1. `src/pages/process.astro` frontmatter, before any work: `return Astro.redirect('/');` + re-enable comment (the `src/pages/specimen.astro:17-19` mold, tagged `v2:`).
  2. `netlify.toml`: `[[redirects]] from = "/process" to = "/" status = 302 force = true` (force overrides the meta-refresh page Astro emits for static routes — same blocks as `netlify.toml:7-24`).
  3. `astro.config.mjs:8`: add `'/process'` to `SITEMAP_EXCLUDE`.
- **No `/lab/process`:** the `?debug` tuning panel mounts on the gated route itself (the `VideoGlobe` `?debug` convention without a second route to maintain).
- **Nav re-add at un-gate:** one `<a href="/process">` in `.site-nav__links` at the marked slot (`src/components/SiteNav.jsx:253` — `{/* process link removed for v1 — the process page is a v2 workstream */}`) + one `.mobile-menu__item` in the mobile menu block; label `process`, glyph `⊙` inline-glyph/text in the existing icon family (the old EyeIcon was deleted in `8fe42e8`; `⊙` is unclaimed — a core inside a world).
- **Un-gate = 3 files in ONE commit** (redirect line + netlify block + sitemap entry) — forgetting the forced 302 is the canonical launch bug; it overrides the page even after the redirect line is gone.
- **SEO:** `BaseLayout` props per copy deck; OG uses the standing brand `og-image.png` (a Stage-5 render is a nice-to-have, not a gate).

## 7. Accessibility / reduced motion / mobile

- **Reduced motion** (`PREFERS_REDUCED_MOTION`, `globeConfig.js` export): native scroll (Lenis never starts); no timelines — each ScrollTrigger boundary calls `setStageInstant(stage)` and renders one frame (live stills, no idle ticker, no ambient yaw); the Thread pre-drawn; scramble labels snap to final text (`scrambleTo` already degrades — `src/lib/scramble.js`); copy appears without entrance motion. Every state remains reachable in both directions.
- **Mobile:** the full live experience — this scene (zero textures, zero video, transform + uniform tweens only) is strictly cheaper than the shipped home globe's 42–44fps iPhone baseline. `DPR_MAX` 1.5, contain-fit `?fillfrac` 0.7 (the belt fits whole). Stills are the RM path, not the mobile path.
- **Keyboard / screen reader:** pure document flow; `h1` → `h2` per Stage; canvas container `aria-hidden`; BaseLayout skip-link inherited; the single focus-visible recipe (`outline: 1px dashed var(--color-electric-blue); outline-offset: 4px`) on links and CTAs.

## 8. Performance budget

| Metric | Budget |
|---|---|
| Canvases | 1, route-scoped, full teardown + `forceContextLoss()` on nav (ADR-0002) |
| Draw calls | ≤ 90 peak (~85 throughout — belt and globe are the same meshes) |
| Texture memory | 0 (placeholder 1×1 only) |
| Frame budget | `FPS_CAP` 60 via local ticker gate; never `gsap.ticker.fps()` (shared with SiteShell + Lenis) |
| DPR | 2 desktop / 1.5 mobile |
| Idle cost | ticker removed when offscreen (`IntersectionObserver`) or `document.hidden`; S5 loop pauses with it |
| Device floor | ≥ home-globe baseline (42–44fps iPhone reference) — verify in the build's device pass |

## 9. Tunables

`PARAM()` query-knob convention (`src/components/globe/globeConfig.js:15`), read once at init, baked defaults:

| Knob | Default | Governs |
|---|---|---|
| `?stagems` | 1200 | base stage-transition duration (ms) |
| `?scatter` | 1.8 | Fragment-belt spread (annulus radius, world units) |
| `?drift` | 0.05 | Fragment drift/tumble rate |
| `?threadhops` | 10 | Fragments the Thread chains before assembly |
| `?threadms` | 900 | Thread draw duration per hop (ms) |
| `?assemble` | 1.6 | assembly duration, scatter→home (s) |
| `?zoomout` | 1.0 | S2→S3 dolly-back (s) |
| `?emanate` | 1.35 | S4 per-panel scale target |
| `?emanateorder` | sweep | S4 emanation stagger (`rows`/`poles`/`sweep`) |
| `?bpm` | 122 | S5 pattern-loop tempo |
| `?cascade` | rows | S3 light-up variant (`rows`/`poles`/`sweep`) |
| `?fillfrac` | 0.85 / 0.7 | camera fit fraction desktop / mobile |
| `?debug` | off | tuning panel (stage jump buttons, knob sliders, fps/draw stats) |

## 10. Build order

1. **P0 — scaffold:** gated `process.astro` (redirect + netlify 302 + sitemap exclude) + `ProcessPage.jsx` island + `route-process` body class + `processContent.js` stub. Define the missing tokens the page will consume (`--tracking-tight: -0.02em`, `--lh-body`, promote `--color-near-black` to `:root`) — pre-existing gaps, fixed at the point of first real use.
2. **P1 — scroll skeleton:** ScrollTrigger registration + Lenis bridge + 5 stub sections + stage machine logging states. De-risks the one novel integration first.
3. **P2 — scene core:** `useProcessScene` + S3/S4/S5 on the full 84-mesh globe (light-up, emanation, rhythm loops).
4. **P3 — Fragments + Thread + assembly:** seeded belt scatter + drift, Thread chain draw + captions, drift damping on connect, pull-in assembly with inner-sphere reveal, S2→S3 zoom-out.
5. **P4 — copy & chrome:** full copy deck, entrances, CTA section, `?debug` panel.
6. **P5 — RM / mobile / a11y / perf:** stills path, device pass, budget verification.
7. **P6 — launch:** nav re-add (desktop + mobile menus), un-gate (3 files, one commit), SEO verify, acceptance run.

## 11. Acceptance checklist

- [ ] All five Stages reachable by scroll in both directions; boundary spam resolves to the latest target with no queued timelines.
- [ ] Stage-3 light-up reads as the homepage cascade family (`rows` default); `?cascade` switches variants live.
- [ ] The Thread tracks the drifting Fragments with no visible detachment at 60fps; hop pings fire the captions; struck Fragments damp their drift.
- [ ] The assembly reads as construction: every Fragment seats into its home `row`/`lonIndex` slot; the blue inner sphere surfaces with completion; Thread segments ride inward and fade.
- [ ] Exits/reversals run ≈0.7× entrance durations throughout.
- [ ] Arrival: `swm:fill-release` on mount; hero choreography identical on direct load and client-nav; plays once per mount.
- [ ] Reduced motion: native scroll; per-boundary single-frame stills; Thread pre-drawn; no idle motion anywhere; copy unscrambled.
- [ ] Mobile: full live scene ≥ home-globe device baseline; the Fragment belt fits whole at contain 0.7.
- [ ] Perf: ≤90 draw calls peak; zero texture uploads; ticker pauses offscreen/hidden; teardown releases the GL context.
- [ ] Copy budget: every blurb ≤45 words and ≤3 sentences.
- [ ] Gate: `/process` 302s to `/` in production until un-gate; sitemap excludes it; un-gate is one 3-file commit.
- [ ] A11y: page fully readable with canvas absent; heading hierarchy intact; canvas `aria-hidden`; focus-visible recipe on all interactive chrome.
