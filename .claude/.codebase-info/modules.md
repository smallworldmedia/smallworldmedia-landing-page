# Modules

*Last Updated: 2026-09-09*

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
albumArt buckets) · `flushGrid.js` (pure placement with socket regions) · `GridSocket.jsx`
(parallax on `gsap.ticker`) · `DeckScroller.jsx` (+ `BrandDeckViewer`, `AlbumArtViewer`) ·
`MediaSlot.jsx` · `ClientPanel.jsx` · `ScrambleLabel.jsx` · `DetailProgressBar.jsx` (shared with
/process) · `NextProjectBand.jsx` · `useKeywordWipe.js` · `BandPager.jsx` (tabled, unmounted).

## /process (`src/components/process/`)
`ProcessPage.jsx` (thin) · `useProcessScene.js` (~2600; stage machine reusing globe geometry +
material, api `{goTo, applyTuning, replay, stats, dispose}`) · `useProcessScrollDriver.js`
(ScrollTrigger per section + accumulator quantizer, `lenis.scrollTo` glides) · `useProcessCopy.js`
(arrival splash + per-stage boot entrances) · `processConfig.js` (mutable TUNING from `?params`,
`copy_url`) · `processContent.js` (copy deck, no CMS) · `liveLockupGlobe.js` (live globe-O) ·
`ProcessStepCtas.jsx` · `ProcessDebugPanel.jsx` (`?debug`).

## Shared libs (`src/lib/`)
| Module | Role | Consumers |
|---|---|---|
| `dragMomentum.js` | THE drag + inertia engine (`DragMomentum`, `DRAG_CHOREO`) | `globe/InteractionController`, `ClientLogoTicker` |
| `overlayWipe.js` | THE overlay wipe (`wipeIn`/`wipeOut`, clip-path up from bottom, inverse out) | Privacy, Project overlays, mobile menu |
| `scramble.js`, `charCut.js` | House scramble; random-letter hard cut (successor for arriving chrome text) | cards, chrome, tagline, pager |
| `smoothScroll.js` | Single Lenis on `gsap.ticker`; off on `/` and `/work`; `getLenis()` may be null | layout script, process driver, GridSocket |
| `settleResize.js` | `settleDebounce` resize doctrine | scene hooks |
| `motion.js`, `momentum.js`, `navAccent.js`, `projectColor.js`, `projectSlug.js`, `keywords.jsx`, `formatYearRange.js`, `constants.js` | Ease paths, accumulators, nav accent + `--project-color` writers, slug fallback, `[[word]]` keyword markers, formatting |
| `sanityClient.js`, `queries.js` | `sanityFetch`, all GROQ | pages |
| `lenisTune.js`, `footerTune.js` | Bench publishers | tune panels |
