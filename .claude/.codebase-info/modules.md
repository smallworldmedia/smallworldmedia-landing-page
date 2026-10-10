# Modules

*Last Updated: 2026-10-10*

## Site chrome (`src/components/*.jsx`)

| File | Purpose |
|---|---|
| `SiteShell.jsx` | Persistent island: `InfoPanel` + `ProjectOverlay` + `RouteFill`; owns `data-chrome-open`, `--scrollbar-w`; lazy-loads Lenis/Footer tune panels |
| `SiteNav.jsx` | Fixed top bar (lockup, info pill, links); home/process variants are CSS off `body.route-*` |
| `SiteFooter.jsx` | Hero bookend (`noFill`) or sticky-reveal links footer driven by `--footer-reveal` + `data-footer-revealed`; exports `FOOTER_REVEAL_EVENT` names |
| `SiteTagline.jsx` | Persistent island: tagline pill + privacy pill, hosts `PrivacyOverlay`, letter-cut exit via `lib/charCut.js` |
| `RouteFill.jsx` | ADR-0002 blue bridge + `overviews_loading` bar; the single nav-accent control point |
| `ProjectOverlay.jsx` / `PrivacyOverlay.jsx` / `PrivacyContent.jsx` | Inquiry form (Netlify Forms) and privacy overlay, both on `lib/overlayWipe.js`; privacy copy shared with `/privacy` |
| `InfoPanel.jsx` | Slide-down client drawer with SiteNav seated at its bottom |
| `ClientLogoTicker.jsx` | Logo band above the links footer; rides `DragMomentum`; assets via `import.meta.glob` + `src/assets/client-logos/manifest.json` |
| `Hero.jsx` (~1000 lines) | Home hero: intro modes (full/replay/rm via sessionStorage), globe rig, `enter_world` commit, footer reveal |
| `LandingPage.jsx`, `HeroText.jsx` | Island wrapper; hidden `<h1>` |

## Globe (`src/components/globe/`)
`VideoGlobe.jsx` (component) · `useGlobeScene.js` (the only three.js↔React boundary; `gsap.ticker`
loop, `forceContextLoss` teardown) · `buildGlobeGeometry.js` (panelized sphere + pole wedges) ·
`panelMaterial.js` (unlit shader: cover-fit, `uMix` A↔B, `uPower` cascade, `uBlueMix`) · `cascade.js`
· `LivePanelScheduler.js` (~2 Hz promote/demote) · `VideoSlotPool.jsx` (fixed HLS pool) ·
`TextureManager.js` (refcounted Mux thumbnails) · `buildAssetPool.js` (pure build-time ordering) ·
`MeridianScroll.js` · `InteractionController.js` (yaw/pitch skin over `lib/dragMomentum`) ·
`globeConfig.js` (tunables; re-exports drag constants from `dragMomentum`).

## Hero (`src/components/hero/`)
`heroConfig.js` (TUNING store + pub/sub + ease paths) · `heroOverlay.js` (scene→DOM disc projection)
· `HeroIntro.jsx` · `HeroLabels.jsx` · `HeroTunePanel.jsx` / `CommitTunePanel.jsx` (benches).

## /work (`src/components/work/`)
| File | Purpose |
|---|---|
| `FeaturedProjects.jsx` (~900) | Orchestrator: wheel/touch accumulator → CTA fill → World Turn; scroll-up-to-home at World 0; driven footer at last World; lazy benches; legacy `?pager=rail` |
| `WorldCard.jsx` | Identity card, OS-window boot entrance; fires the real enter commit |
| `CtaArrows.jsx`, `textExit.js` | Caret strips; text-out choreography (`TEXT_TUNABLES`) |
| `pager/usePagerGesture.js` | Shared gesture engine: press-hold engage, scrub + detent magnet, wrap, end resistance, stall commit; only `requestGoTo` fires a Turn |
| `pager/GraticulePager.jsx` | The `scale` skin (SSR'd default). Tape/tuner arms removed; survive as tuning presets |
| `bandLayout.js`, `scrimNoise.js`, `useHls.js`, `imageConfig.js`, `ServiceTag.jsx` | Shared math/recipes/hooks |
| `*TunePanel.jsx`, `fp1Tune.js`, `FeaturedDeckDebugPanel.jsx` | `?entertune`, `?texttune`, `?scrimtune`, `?fp1tune` benches |
| `ProjectDirectory.jsx`, `MediaGrid.jsx`, `MediaCard.jsx`, `AlbumArtTicker.jsx`, `FilterBar.jsx`, `Lightbox.jsx` | Dormant directory route |

### `work/world/`
`useWorldScene.js` (~1200; renderer, slotA/slotB Turn, EffectComposer → lens distortion → output,
enter ramp, resize, `swm:fp-freeze` gate) · `WorldScene.jsx` (shell + `VideoSlotPool`) ·
`worldConfig.js` (all tunables, `FPGRID` default 3 = DRUM) · `buildShell.js` (inverse-sphere
graticule) · `seededLayout.js` · `fpGridCells.js` · `fpAtlas.js` / `fpForme.js` / `fpDrum.js` (+
`fpDrumTrim.js`, `fpDrumWall.js`) · `worldBands.js` · `worldLive.js` · `enterTune.js` ·
`vendor/lensDistortion.js`.

### `work/detail/`
`FeaturedProjectDetail.jsx` (orchestrator) · `buildContentFlow.js` (assets → hero/showcase/decks/
albumArt/banners buckets; `isBannerGroup` routes any displayGroup ending `-banner(s)` to `banners`) ·
`flushGrid.js` (pure placement with socket regions) · `GridSocket.jsx` (parallax on `gsap.ticker`;
hands `--socket-rows` to CSS) · `DeckScroller.jsx` (+ `BrandDeckViewer`, `AlbumArtViewer`,
`BannerViewer` — one-column full-width wall sized to 1.5 banners, rows derived from the measured
flow width through the grid row pitch; ≤1024 spans `--socket-rows`, masonry.css) ·
`MediaSlot.jsx` · `ClientPanel.jsx` · `ScrambleLabel.jsx` · `DetailProgressBar.jsx` (shared with
/process) · `NextProjectBand.jsx` · `useKeywordWipe.js` · `BandPager.jsx` (tabled, unmounted).

## /process (`src/components/process/`)
Seven scene stages, `STAGE_IDS = hero, stage-01…05, cta`. The field (since 10-10, w9c, the black
opening): hero/S1/S2 on black, S3/S4 on blue (the lit panel IS the blue, so the world reads as a
black line drawing), S5 and the CTA on the home hero's `to top` gradient (the CTA's ramp reaches
higher, `?ctaramp`); `?opening=blue` is the pre-w9c arm. The hero's globe-O BREAKS into the S1
belt (wind-up, hitch, white impact, cooling falloff) and re-forms on the way back up; S2 rests on the
Thread (the dots connected): the belt ghosts, each hit pings its panel and settles it at the bead level
(lit on black via `?s2lit`, dark on the blue arm), leaving a white hit dot (dots == the
`dots_connected NN/42` counter), and every return to S2 replays it (since 10-09, w9b); S2→S3 assembles
the Core, then the solid field grows out of it and the cascade ignites (`?ignite`); `cta` is the
finale (the world resolves on the beat and one freed shard lifts wearing a `first_contact` chip).
Spec: `docs/process-page-spec.md`.

| File | Purpose |
|---|---|
| `useProcessScene.js` (~10050) | The stage machine on the globe geometry + `panelMaterial` (depth haze via `uFogAmount`, receding into `uFogColor` = the live field; the break's heat rides `uBlueMix`). The field (w9c): poses name a role that `fieldOf` resolves; a live `bgState` (`setLayers`/`setRamp`/`setClip`, `bgInstant`) paints the staged DOM layers, `bgMorph` grows/shrinks the solid out of the Core's disc at S2⇄S3, `bgCrossfade` is one linear blend from the LIVE opacities (monotonic from any interrupted state), `liveField()` feeds `uFogColor` on panels and decoys every frame, `fieldAt`/`rampAt` read the colour under a point (chip keys; `ctaEdgeInk`, the `?ctaink` auto verdict), and `inkHome`/`inkGoHome` ease S5's tinted edge ink home on every step. Builds every transition; break/reform flights fly a midpoint bow, `matchSlots` deals each shard its belt slot. S1→S2 `buildConnect` (the Thread strings the beads, `restThread` holds it at S2's rest), S2→S3 `buildAssembleAndIgnite` (`buildAssembly` → `buildIgnition`: field grow + cascade), S3→S2 `buildUnassemble` (data `'reconnect'`: the S2 replay, rushable). S2's refine (w9b): the ghost rides the per-panel fog channel in `applyFogUniforms`, `s2Hit` pings on `uBlueMix` and settles at `s2BeadPower()` (`?s2lit` on black, `?s2dark` × idle on blue), the hit dots are one `InstancedMesh` (`s2DotMesh`, composed each render by `composeS2Dots`, giving way to copy via `s2DotKeepSync`/`s2DotGive`); `killS2Fx` clears it at build time. Reduced motion runs no ticker: it renders on demand (mount, `setStageInstant`, `applyTuning`, a resize, and `rmScrollSettle` — one frame after a native scroll settles). Loops via `startLoops` on the pose's `loops.kind`: `heartbeat` (S4 unison `uPower` dip, recovered in unison on exit), `rhythm` (S5 count-in → unison drop, brand-book page readout + page chips, tap/touch ripple cue), `breathe` (CTA). API: `goTo`, `setStageInstant`, `getStage`, `leaveLabels`, `leaveThreadWords`, `setHeroMark`, `setCopyBeat`, `s2RevealAt`, `s3Ignition` (`{at, dur}` — the one window the field grow and S3's copy lead ride), `s4PushAt`, `getStats`, `getFlightTrack`, `getChipBoxes`, `applyTuning`, `replay` |
| `useProcessScrollDriver.js` | One ScrollTrigger per `.process-hero, .process-stage, .process-cta`; house accumulator quantizer (pinch, zoom, back-swipe and find-in-page pass through); `lenis.scrollTo` glides; the commit fires the break; resize gate + `settleResize` re-seat at rests and mid-glide (its fallback runs the refresh ScrollTrigger's mobile resize heuristic skips, judged against `measuredVp`, the viewport of the last refresh); reduced motion = CSS scroll-snap (`process.css`), no quantizer |
| `useProcessCopy.js` | Arrival splash + per-stage boot entrances. Registers the hero mark (`setHeroMark`: `onWind`, `onBreak`, `onReformStart`, `onReform`) and the `COPY_BEAT` cues (`setCopyBeat`): the scene times each beat, the DOM answers. An entry is `{ lead }` (holds the whole entrance) or `{ rises }` (holds only the blurb — S2's waits for `s2RevealAt`); `?s3head` picks S3's: `assembly` (the headline lands as the Core assembles, the blurb rises on the ignition) or `ignition` (the whole card waits) |
| `processConfig.js` | `TUNING_DEFAULTS` → mutable `TUNING` from `?params`, `copy_url`; colours, `EXIT_RATIO`, `s5DropAt`, `beatKeyed`; the field table (w9c): `FIELDS` {black, blue} rows (`hex`, `thread`, `dot`, `ink`), `fieldOf(role)` (`open` \| `solid` \| `gradient` × `?opening` → the colour name `data-bg` carries), `S5_RAMP`, `ctaRamp()`, `ctaInk(edge)` |
| `processContent.js` | Copy deck (no CMS), `[[word]]` keyword marks |
| `ProcessPage.jsx` | Island shell: scene + driver + copy, the staged background layers (SSRs `data-bg`/`data-opening` on `.process-page`, so first paint is the opening field), `DetailProgressBar` (broadcast; seat, width and skin overridden in `process.css` — above [next] on desktop, above the privacy pill on phones), CTA hover/focus → `swm:process-cta-hover` |
| `liveLockupGlobe.js` | The lockup's live globe-O (`DragMomentum` with `touch: false`; survives WebGL context loss) |
| `ProcessStepCtas.jsx` | Steppers labelled `next: <token>` (plain text since 10-09; only the caret strips loop) |
| `ProcessDebugPanel.jsx` | `?debug` bench; publishes `window.__swmProcessStats` (500 ms snapshot) and the live reads `__swmProcessPeek()`, `__swmProcessChips()`, `__swmProcessTrack()` that `scripts/process-probe.mjs` samples, plus `__swmProcessApi()` (the scene's API itself, for harnesses that call `setStageInstant`/`replay` mid-show). Under `?debug` the scene also answers a harness-set `window.__swmProcessPix` (a per-render pixel colour probe) |
| `lockupGlobeSnapshot.js`, `ProcessMeter.jsx` | Dormant: superseded by `liveLockupGlobe.js` and `DetailProgressBar` |

Chips (inside `useProcessScene.js`): in-scene canvas-texture chips for the S1 tour, the Thread's
words, the S3 spec sheet, the S5 page chips and the CTA. Square, filled from the project colour pool
dealt modulo, ink from `lib/projectColor.js` `chipInk`; a shard keeps its word and fill. One exit
path, `leaveLabels` (letter cut + fill retract). `keepBoxes()` keeps chips off copy and chrome;
`exactCover` raycasts whether a nearer shard covers a seat; `?chipcover=off|bind|hold` picks the
cover test (`hold` predicts the station's drift, `holdCover`). Counts since 10-09 (w9b, PROPOSED):
`?labels` 8 on desktop, `?labelsm` 5 on phones (slots fixed at mount); the S1 bank `LABEL_TERMS`
holds 84 words, one per belt panel. Leaders and root dots are batched into one `LineSegments` + one
`InstancedMesh` (a second pair for the depthTest-off CTA chip): `makeLabelBatch` / `flushLabelBatch`,
layered by `LABEL_ORDER` (no leader or dot paints over a chip); N chips cost ≈ N + 2 draw calls.
`leaderCrosses` refuses an S1 seat whose leader would cross another chip.

## Shared libs (`src/lib/`)
| Module | Role | Consumers |
|---|---|---|
| `dragMomentum.js` | THE drag + inertia engine (`DragMomentum`, `DRAG_CHOREO`; `touch: false` leaves fingers to a page gesture) | `globe/InteractionController`, `ClientLogoTicker`, `process/useProcessScene`, `process/liveLockupGlobe` |
| `overlayWipe.js` | THE overlay wipe (`wipeIn`/`wipeOut`, clip-path up from bottom, inverse out) | Privacy, Project overlays, mobile menu |
| `scramble.js`, `charCut.js` | House scramble; random-letter hard cut (successor for arriving chrome text) | cards, chrome, tagline, pager |
| `smoothScroll.js` | Single Lenis on `gsap.ticker`; off on `/` and `/work`; `getLenis()` may be null | layout script, process driver, GridSocket |
| `settleResize.js` | `settleDebounce` resize doctrine | scene hooks |
| `projectColor.js` | `--project-color*` vars, ink pickers (`projectInk`, `chipInk`), `colorPool` (distinct colours in /work order) | /work cards + detail, `/process` chips |
| `motion.js`, `momentum.js`, `navAccent.js`, `projectSlug.js`, `keywords.jsx`, `formatYearRange.js`, `constants.js` | Ease paths, accumulators, nav accent, slug fallback, `[[word]]` keyword markers, formatting |
| `sanityClient.js`, `queries.js` | `sanityFetch`, all GROQ | pages |
| `lenisTune.js`, `footerTune.js` | Bench publishers | tune panels |
