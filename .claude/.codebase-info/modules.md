# Modules

*Last Updated: 2026-10-08*

## Site chrome (`src/components/*.jsx`)

| File | Purpose |
|---|---|
| `SiteShell.jsx` | Persistent island: `InfoPanel` + `ProjectOverlay` + `RouteFill`; owns `data-chrome-open`, `--scrollbar-w`; lazy-loads Lenis/Footer tune panels. Passes `siteCopy` straight through to `InfoPanel` → `SiteNav` (10-08) |
| `SiteNav.jsx` | Fixed top bar (lockup, info pill, links); home/process variants are CSS off `body.route-*` — four fills repo-wide: base `--color-electric-blue` (`global.css:784`), `body.route-home` **brand black** (`--color-black`, new 10-08: it was the only transparent nav besides /process, so the turning sphere tracked through behind the links), `html:has(.fp)` / `html.fp-tint` the project accent, and `body.route-process` transparent (`process.css:28`). No JS ever writes a nav background — `lib/navAccent.js` only publishes custom properties on `<html>` — and the fill must live in `background`, never `opacity`, because the bar's own `autoAlpha` is animated on the home chrome gate; sets `html[data-menu-open]` while the mobile menu is up. The mobile menu's foot renders the SAME tagline the pill does, parsed from the `siteCopy` prop rather than a shared word-array (10-08) |
| `SiteFooter.jsx` | Hero bookend (`noFill`) or sticky-reveal links footer, and THE writer of the reveal channel: absolute `--footer-reveal` / `--footer-peak`, their rest-normalized twins `--footer-rise` / `--footer-rise-peak` over `--footer-span`, and the measured `--footer-panel-h` (driven mode too, so home can use it as a parallax denominator). Home rests part-revealed wherever `?footerrest` is nonzero — the phone default, and any width when the dial is passed explicitly (10-07) — so the on-load word entrance is armed off a fail-open `[data-footer-in]` ground instead of a progress threshold (the old `STAGGER_ON` watch loop is retired, and it never fired from a 0.62 floor), and a touch scrub paints imperatively instead of through a React render. `armFooterEntrance(reduced, slide)` takes a second argument: with it the resting panel also rises into place on the wipe ease at timeline position 0 over `?footerslides` (0.7 s), written as `translate: 0 var(--footer-slide)` in px because `paint()` owns the panel's whole `transform` string (see `patterns.md`), with the words and the band line held back `?footerslidelead` (0.12 s) so the slide leads; the property is removed on completion and by `resetFooterEntrance()`. **The panel is parked LOW for as long as `--footer-slide` is set**, so one `dropSlide()` owns every non-animating exit — the reduced/no-words branch, `resetFooterEntrance()`, and the missing-blurb bail, which returns before `entranceShown` and so is re-entered by Hero's `FOOTER_IN_SAFETY_MS` timer: without the clear, a missing blurb parked the whole panel off the fold for the visit instead of being cosmetic (fixed 10-08). It also kills the held `slideTween`, so a soft nav mid-rise cannot keep rewriting the property after cleanup removed it. It also publishes `--footer-band-p` = `min(rise, elapsed / ?logofademin)`, the band's rise held back by a clock so a flick cannot skip the fade: the rise spans only ~95px at 1440×900, less than one wheel notch, so position alone made the dim band pop to full. A FLOOR, not a duration — a slow scrub beats the clock and `min()` leaves it alone, which is why it is a JS clock and not `transition: opacity` (a transition would impose its time on the slow case as lag, and the file says as much where it refuses one on the band). It owns a small rAF that runs only while the gate is closed, re-arms whenever the rise returns to its floor, and is torn down by `clearReveal()`. A separate effect publishes `--footer-blurb-em`, the blurb's width in em measured from a nowrap clone (weights, marks and all) and re-measured on `document.fonts.ready` — gated on the blurb's own computed first font-family via `document.fonts.check`/`load`, because every face is `font-display: swap` and a cold load would otherwise measure the fallback and publish a divisor ~7% too narrow. That measurement is what lets the one-line fill follow edited copy instead of one baked string, and it is what made the blurb safe to move into Sanity (10-08): `blurb` is now ONE MARKED STRING (`siteSettings.footerBlurb`, threaded `index.astro` → `LandingPage` → `Hero`), not the old `[emphasised opening, rest]` pair, parsed by `keywordLines()` and drawn by `renderWordTokens()`. Its highlights need BOTH a colour and a driver: `global.css` binds `--kw-bg`/`--kw-ink` on `.site-footer__blurb` and rests the box OPEN there, and `playFooterEntrance` winds them back with `kwSet(blurb, false)` before appending `kwWipe` to the same timeline as the words (reduced motion takes `kwSet(blurb, true)`). `broadcastReveal` additionally sets the one-way `[data-footer-seen]` latch (+ `sessionStorage 'swm:footer-seen'`, re-asserted on `astro:after-swap`) the first time the GATED `--footer-band-p` passes 0.999 — not the rise, because the latch is a hard `opacity: 1` at a specificity the ramp cannot beat, so latching on the rise would paint over the minimum fade on exactly the quick scroll it exists for — the threshold is that high because the CSS ramp has already reached 0.9994 there, so the handoff is invisible where latching at 0.6 would be a visible 0.24 jump. It is deliberately NOT cleared by `clearReveal()`, and an unreadable store fails toward the DIM pose. Note it also fires on `/work`, where `rest = 0`, so a full reveal there pre-brightens home's band. The distance is `?footerslide` × the panel's OWN resting reveal, resolved at arm time by `restingRevealPx()` (`innerHeight − panelTop`, forcing the one style flush that makes the rect the post-latch pose; channel fallback `(1 − --footer-span) × --footer-panel-h`). The default 1 starts it flush at the fold so **the whole hero globe is in view at load** (10-08): the ring's diameter is `fill × (1 + GLOBE_STROKE_FRAC) × cos α × min(vw, vh)` (0.87 × min desktop, 0.988 × min phone) centred at `vh/2`, so in landscape its bottom is `0.935 vh` and the panel-over-ring overlap is `rest × panel-h − 0.065 × vh` — 98.5px at 1440×900, 104.9 at 1280×800, 78.9 at 1440×1200; in portrait the fit axis is WIDTH, so r stops shrinking while the centre falls. Either way it grows as the window shortens, so only a fraction of the reveal holds across viewports and a fixed rem cannot. The footer stays ignorant of the globe: nothing here reads hero geometry. Above 768px the variant also re-lays the panel (10-08): the August `min-height` reserve on `.site-footer__inner` paid for the fixed tagline stack when that stack sat over the panel's bottom, but under this variant the band is `order: 1` and the nav is hidden, so the reserve only pushed the blurb 64.9px down (`--footer-rest-top-pad`, 18px, replaces it) while the lockup it paid for is now `display: none` and the bottom-fixed © / privacy pill landed ON the marks row. What the reserve was really buying moved from above the blurb to below the band as `--ticker-foot-clearance` (fallback derived from the same tokens, so the two cannot drift): +12.02px and +27.99px of clearance at a full reveal. The blurb and the band's lead-in line share one `--footer-blurb-size` so the em-derived odometer scales coherently. It also HOLDS the band's word odometer through the entrance (10-08): `armFooterEntrance` sets `[data-footer-settling]` beside `--footer-slide` and `settleOdometer()` clears it from both the timeline's `onComplete` and `dropSlide()`, so the latch inherits the slide's already-hardened bail coverage and absence means running. The roll is a main-thread animation that froze and then jumped a whole word under the entrance's load — holding it beats phase-locking it for a word-indexed odometer (`patterns.md`). Exports `FOOTER_REVEAL_EVENT` names |
| `SiteTagline.jsx` | Persistent island: tagline pill + privacy pill, hosts `PrivacyOverlay`, letter-cut exit via `lib/charCut.js`. Two states: the extended blurb while home is at rest (`body.route-home`, no `data-chrome-open` / `data-menu-open` / `data-footer-revealed`), else "VISUAL WORLDS for the music industry."; a GSAP morph between them (`?tagmorph`), re-evaluated by a MutationObserver on `<html>` and on `astro:after-swap`. Its `maskLive` rAF is the ONLY thing that un-hides `.site-tagline__copy` and `.site-tagline__lockup` (ungated `visibility:hidden` ground, `display:none` only at ≤768px), so its `[data-footer-rest]` stand-down tests the TIER (`matchMedia`), not the latch — keyed on the latch alone it blanks the white lockup and the © for the session at desktop width, and `global.css:2525` has already taken the pill. **Its copy is Sanity data since 10-08** — a `siteCopy` prop from `BaseLayout`, parsed with `keywordLines()`. The three baked structures are GONE (`TAGLINE_LINES`, `TAGLINE_LONG_LINES`, `TAGLINE_LONG_SPLIT`) along with the `TAGLINE_LINES` / `EM_LINE` / `TAGLINE_LONG_SPLIT` exports: the Medium cut used to be POSITIONAL — a line index (`EM_LINE = 0`) and a word count (`LONG_EM_WORDS = 3`) — which cannot survive copy an editor can reword, so it is now the `**bold**` marker, travelling with the word. `labelLong` / `labelShort` / `shortChars` (the letter exit's budget) are derived from the live copy instead of a frozen string |
| `RouteFill.jsx` | ADR-0002 blue bridge + `overviews_loading` bar; the single nav-accent control point |
| `ProjectOverlay.jsx` / `PrivacyOverlay.jsx` / `PrivacyContent.jsx` | Inquiry form (Netlify Forms) and privacy overlay, both on `lib/overlayWipe.js`; privacy copy shared with `/privacy` |
| `InfoPanel.jsx` | Slide-down client drawer with SiteNav seated at its bottom; relays `siteCopy` to it. Its studio blurb is the ONE still baked in source — Nathan's deliberate call on 10-08, where the other two moved to `siteSettings` — and it is plain JSX with a `<strong>`, not marked copy, so it never reaches `keywords.jsx`. `.description__text strong` carries `--weight-medium` to match the footer's cut (both surfaces resolve to ABC Areal first, a variable face at 400..700, so 500 is a real instance) and KEEPS its 08-30 project-accent colour, so the drawer's subject wears weight AND hue where the footer's wears only weight |
| `ClientLogoTicker.jsx` | Logo band above the links footer; rides `DragMomentum`; assets via `import.meta.glob` + `src/assets/client-logos/manifest.json`. Owns the band copy: `COPY`, `SPECTRUM_PHRASE` (`'full spectrum'`) and `leadParts(copy, phrase)` → `[before, phrase, after]`, so the phrase is wrapped in `.logo-ticker__spectrum` for the 127 BPM ink pulse without a hard-coded split. Its dials cover the band and the house pulse: `?logorestop` (resting band opacity) plus a `rootDial()` helper that writes bare numeric tokens on `<html>` for `?inkmuted` (`--ink-muted-l`), `?pulsebpm` (`--swm-bpm`) and `?pulsereps` (`--swm-pulse-reps`, clamped 1..5 — how many times the 5-hue walk sweeps per half note, so the cycling rate moves while the BPM boundary does not). The word odometer's CSS roll is gated by two `<html>` latches this island does NOT own: `[data-footer-revealed]` runs it, and `[data-footer-settling]` (`SiteFooter`) holds it through the on-load entrance |
| `Hero.jsx` (~1000 lines) | Home hero: intro modes (full/replay/rm via sessionStorage), globe rig, `enter_world` commit (the CTA chrome fades out in 0.2 s, then `swm:loader-start`; under the population modes it holds the clock and hands /work the world on the globe, `swm:enterWorld`; RM covers instantly), footer reveal. It owns the resting-footer latch `[data-footer-rest]` and the scroll accumulator that advances the reveal off its `?footerrest` floor — `FOOTER_REST_MOBILE` 0.62 is the phone DEFAULT, not the gate: an explicitly passed `?footerrest` reaches any width, and the whole `[data-footer-rest]` CSS variant is viewport-ungated, so the desktop variant is dialable with no layout fork. `addDelta` has two callers, `onWheel` and `onTouchMove`, both registered unconditionally — the wheel already drives the home footer on desktop; the `--hero-lift` parallax rides that channel (CSS-derived, half rate by default) and the footer's entrance is armed inside `chromeBeat`. Its centred CTA's visible label is **`zoom_in`** (10-08); `enter_world` survives as the name of the commit, its event and its CSS, so the two no longer match on screen — with `armFooterEntrance(PREFERS_REDUCED_MOTION, introMode === 'full')`, so the resting panel's slide plays only on the first view in a tab, reusing the existing `sessionStorage 'swm:hero-intro'` decision (`full` / `replay` / `rm`) rather than a second "recently" mechanism; `introMode` is declared below the effect but read inside its callback, which React runs after the render body. Under the `[data-footer-rest]` variant the footer links yield too (`.site-footer__nav { display: none }`, 10-08) |
| `LandingPage.jsx`, `HeroText.jsx` | Island wrapper (relays `siteCopy` from `index.astro` to `Hero`); hidden `<h1>` |

## Globe (`src/components/globe/`)
`VideoGlobe.jsx` (component) · `useGlobeScene.js` (the only three.js↔React boundary; `gsap.ticker`
loop, `forceContextLoss` teardown; under the population modes the world-colour ink tween and the api's
`onWorldChange` and `popHold`) · `buildGlobeGeometry.js` (panelized sphere + pole wedges) ·
`panelMaterial.js` (unlit shader: cover-fit, `uMix` A↔B, `uPower` cascade, `uBlueMix`, and the
latitude-banded grain term) · `panelGrain.js` (the grain rig: one turbulence tile, the SHARED uniform
holders every panel points at, the held-jitter clock; `{uniforms, assign, update, dispose}`) ·
`cascade.js` (`DELAY_ORDERS` is the authority on the orderings `panelDelay` actually implements; the
older `CASCADE_VARIANTS` omits `random`)
· `LivePanelScheduler.js` (~2 Hz promote/demote; `dropLive` under a swap; `setShared` = one decode
per clip on every tile showing it; `?popgrainlive=1` withholds live video from tiles still inside the
grain band, gated in `canJoin` so the join loop, the clip score and the resolve-time attach sweep all
see it) · `VideoSlotPool.jsx`
(fixed HLS pool) · `TextureManager.js` (refcounted Mux thumbnails + square Sanity stills + name
strips, keyed by `assetKey` = playbackId | imageUrl | nameKey) · `buildAssetPool.js` (pure build-time ordering) · `MeridianScroll.js` (row conveyor;
stamps tape coordinates `(lonIndex, tapeS)`, optional `assignRow` hook, `advance()` extra travel
for the tide; exports `poseTile(panel, theta)` — the ONE place the row angle becomes both the
`uPolarTop` uniform and the live `centerDir` every CPU-side latitude reader uses — and
`scrollZeroTheta(row, rows)`, the scroll-0 angle `useGlobeScene` needs to pose tiles for the
initial layout, which runs before the scroller exists) · `InteractionController.js`
(yaw/pitch skin over `lib/dragMomentum`) · `globeConfig.js` (tunables; re-exports drag constants from
`dragMomentum`).

**Population modes** (branch `refine/globe-worlds`, `docs/globe-worlds-plan.md`; `tides` is home's
default since Nathan's 10-06 bake, and `?popmode=off` restores the pre-worlds globe):
`buildWorldPools.js` (pure: `FEATURED_WORLDS_QUERY` → one pool per featured project, /work showcase
parity) · `worldPatterns.js` (pure, seeded cluster patterns over the tape) · `PopulationDirector.js`
(one world at a time by default; tile → world assignment; the change clock, a hold then a tide /
blink / surge / cut; current + next world held warm; freeze under the commit's blue; `hold()` at the
Enter World click stops the clock but lets a change in flight land; `onWorld` feeds the scene's
colour; name strips placed camera-relative once per world change by `planNames` (`warmSet` holds
their textures), then reconciled per frame by `placeNames`; publishes `window.__swmPopStats`) ·
`nameTicker.js` (client-name strips: the world's `clientName` in the FP card face baked once per
world + style into a CanvasTexture, with `nameSpan` sizing the strip from the MEASURED text; pure
`namePinch` / `nameWindow` / `nameRendered` compensate `panelMaterial`'s pole pinch so a strip
renders its exact tape slice at any latitude) · `tileSwap.js` (THE refcount-safe `loadTile` + blink
/ surge / cut swaps, `applyPlan`; cover-fit reads a texture's `userData.aspect`) · `popConfig.js`
(`?pop*` TUNING + pub/sub; Nathan's baked defaults).

**Panel grain** (`panelGrain.js` + the grain term in `panelMaterial.js`, 8 `?popgrain*` knobs, ships
OFF at `grainAmt: 0`): a panel shows static instead of media until it has travelled far enough from a
pole, so the pinched, cropped media near the poles is never exposed. Three things make it work:
- **One recipe, two surfaces.** The tile IS the FP pager scrim's dialed grain, imported from
  `work/scrimNoise.js` (`SCRIM_GRAIN` / `SCRIM_GRAIN_MOBILE`, `GRAIN_TILE_PX`, `GRAIN_JITTER`,
  `noiseDataUri()`), so Nathan's 09-04 dial moves both. This is the one `work/` → `globe/` dependency.
- **The grain does not warp.** It samples `mUv`, the same pinch-compensated tile UV the media samples,
  so cells hold constant pixel density as a scroll tile narrows toward a pole. Measured pole-vs-equator
  cell size ratio 0.975; pinch-scaled grain would read 2-4× finer at the pole.
- **The reveal is a wavefront, with no timeline.** A row is iso-latitude, so `vK` is a flat varying and
  every tile in a row would cross one threshold on the same frame. Each tile's THRESHOLD is instead
  offset by its place in a `panelDelay` ordering, so the row arrives staggered with no gsap and no new
  rAF. `vK = sin(θ)` is symmetric about the equator, so one threshold also returns a row to static at
  the far pole.

The texture is `RepeatWrapping` + `NearestFilter`, no mipmaps, `NoColorSpace`. Nearest is load-bearing:
under linear filtering the minified tile averages into mush and `?popgraincells` reads BACKWARDS (more
repeats measure smoother). It deliberately avoids `TextureManager`'s loader, whose
`setCrossOrigin('anonymous')` is meaningless for a `data:` URI and is the hazard class that has produced
black WebGL stills here before.

## Hero (`src/components/hero/`)
`heroConfig.js` (TUNING store + pub/sub + ease paths; `GLOBE_STROKE_FRAC` — `?globestroke`, baked 6 %
desktop / 5 % mobile — is ONE source of truth consumed by both `Hero` (ring `1+FRAC` proud) and
`HeroIntro` (globe `1/(1+FRAC)` smaller inside the lockup "o"), so thinning the ring GROWS the globe in
the "o") · `heroOverlay.js` (scene→DOM disc projection)
· `HeroIntro.jsx` · `HeroLabels.jsx` · `HeroTunePanel.jsx` / `CommitTunePanel.jsx` / `PopTunePanel.jsx`
(benches; the last is `?poptune=1`).

## /work (`src/components/work/`)
| File | Purpose |
|---|---|
| `FeaturedProjects.jsx` (~900) | Orchestrator: wheel/touch accumulator → CTA fill → World Turn; scroll-up-to-home at World 0; driven footer at last World; lazy benches; legacy `?pager=rail`. Enter World arrival: consumes `swm:enterWorld` once and snaps (`snapRef` = target index: one entering card and no Turn, direction 0 in `useWorldScene`, instant pager step; the fill is released on the snapped card). The `swm:returnToWork` restore (the detail breadcrumb back) snaps the same way |
| `WorldCard.jsx` | Identity card, OS-window boot entrance; fires the real enter commit. Its card CTA's visible label is **`zoom_in`** (10-08, was `enter_world`) — one literal, rendered once per card, and `enter_world` survives as the name of the commit, its event and its CSS, so the two no longer match on screen (the same split as Hero's centred CTA) |
| `CtaArrows.jsx`, `textExit.js` | Caret strips; text-out choreography (`TEXT_TUNABLES`) |
| `pager/usePagerGesture.js` | Shared gesture engine: press-hold engage, scrub + detent magnet, wrap, end resistance, stall commit; only `requestGoTo` fires a Turn; `follow(i, instant)` steps without the glide |
| `pager/GraticulePager.jsx` | The `scale` skin (SSR'd default). Tape/tuner arms removed; survive as tuning presets. On a `snapRef` arrival it jumps to the station and skips the announcement |
| `bandLayout.js`, `scrimNoise.js`, `useHls.js`, `imageConfig.js`, `ServiceTag.jsx` | Shared math/recipes/hooks. `scrimNoise.js` owns the house grain recipe and is now consumed by `globe/panelGrain.js` as well — the one `work/` → `globe/` dependency; `noiseDataUri()` (bare `data:` URI) is split out of `noiseUri()` (CSS `url()` wrapper) so WebGL and CSS share it |
| `*TunePanel.jsx`, `fp1Tune.js`, `FeaturedDeckDebugPanel.jsx` | `?entertune`, `?texttune`, `?scrimtune`, `?fp1tune` benches |
| `ProjectDirectory.jsx`, `MediaGrid.jsx`, `MediaCard.jsx`, `AlbumArtTicker.jsx`, `FilterBar.jsx`, `Lightbox.jsx` | Dormant directory route |

### `work/world/`
`useWorldScene.js` (~1200; renderer, slotA/slotB Turn, EffectComposer → lens distortion → output,
enter ramp, resize, `swm:fp-freeze` gate; a `snapRef` arrival drives direction 0, no Turn) ·
`WorldScene.jsx` (shell + `VideoSlotPool`) ·
`worldConfig.js` (all tunables, `FPGRID` default 3 = DRUM) · `buildShell.js` (inverse-sphere
graticule) · `seededLayout.js` · `fpGridCells.js` · `fpAtlas.js` / `fpForme.js` / `fpDrum.js` (+
`fpDrumTrim.js`, `fpDrumWall.js`) · `worldBands.js` · `worldLive.js` · `enterTune.js` ·
`vendor/lensDistortion.js`.

### `work/detail/`
`FeaturedProjectDetail.jsx` (orchestrator; the breadcrumb back covers in the project colour, then navigates) · `buildContentFlow.js` (assets → hero/showcase/decks/
albumArt/banners buckets; `isBannerGroup` routes any displayGroup ending `-banner(s)` to `banners`) ·
`flushGrid.js` (pure placement with socket regions) · `GridSocket.jsx` (parallax on `gsap.ticker`;
hands `--socket-rows` to CSS) · `DeckScroller.jsx` (+ `BrandDeckViewer`, `AlbumArtViewer`,
`BannerViewer` — one-column full-width wall sized to 1.5 banners, rows derived from the measured
flow width through the grid row pitch; ≤1024 spans `--socket-rows`, masonry.css) ·
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
| `dragMomentum.js` | THE drag + inertia engine (`DragMomentum`, `DRAG_CHOREO`); `drag: false` installs no pointer listeners at all — ambient-only, the surface leaves the gesture to the page (the phone home globe) | `globe/InteractionController`, `ClientLogoTicker` |
| `overlayWipe.js` | THE overlay wipe (`wipeIn`/`wipeOut`, clip-path up from bottom, inverse out) | Privacy, Project overlays, mobile menu |
| `scramble.js`, `charCut.js` | House scramble; random-letter hard cut (successor for arriving chrome text) | cards, chrome, tagline, pager |
| `smoothScroll.js` | Single Lenis on `gsap.ticker`; off on `/` and `/work`; `getLenis()` may be null | layout script, process driver, GridSocket |
| `settleResize.js` | `settleDebounce` resize doctrine | scene hooks |
| `motion.js`, `momentum.js`, `navAccent.js`, `projectColor.js`, `projectSlug.js`, `keywords.jsx`, `formatYearRange.js`, `constants.js` | Ease paths, accumulators, nav accent + `--project-color` writers, slug fallback, the house marker grammar, formatting. `navAccent`'s published-token list is the contract: a derivation it computes but does not write to `<html>` reaches nobody, and because the `--project-color*` fallbacks are dead code (`coding-style.md`) the consumer silently gets the registration's brand blue instead — `--project-color-on-black` was computed-but-unpublished until 10-08, which is why the privacy pill never inked from the accent |
| `keywords.jsx` | THE house rich-text grammar and ITS TWO RENDERERS (10-08). Four markers: `**bold**`, `[[keyword]]`, `[[keyword]](/href)`, `[label](/href)` — one `KW_RE` 3-way alternation, bold is capture group **6**. `renderKeywords` emits PROSE; `keywordLines(text)` emits PER-WORD TOKENS (one array per line, newline = line break) for surfaces that animate word by word, and `renderWordTokens(tokens, {wordClass, emClass, separators})` builds the shared `<mark class="kw">` markup from them. Grammar, punctuation rule and `data-kw` reading order are shared, so copy behaves the same whichever surface renders it; `separators: false` suits a surface that spaces words in CSS rather than with text (the pill's short layer). Separators are reproduced FROM THE SOURCE — a keyword's non-final fragments keep their trailing space inside the box (`white-space: pre`) with a zero-width space between, plain words keep their real space, and `a[[b]]` stays glued. `kwWipe`/`kwSet` drive the box + ink. **Every capture group must be named in `stripKeywords`'s replace callback, in order**: the first `**bold**` version skipped the link-href group, shifted `bold` onto it, fell through to the keyword branch and rendered the literal string `"undefined"` into an aria-label | blurbs, `/process`, `SiteFooter`, `SiteTagline`, `SiteNav` |
| `sanityClient.js`, `queries.js` | `sanityFetch`, all GROQ | pages |
| `siteCopy.js` | The site-wide studio copy from the `siteSettings` singleton (10-08): `getSiteCopy()` + `SITE_COPY_FALLBACK`. **Memoizes the PROMISE, not the result**, so a 23-page build makes one request even though `BaseLayout` and `index.astro` both await it. Catches everything and degrades per FIELD to the baked copy, so a Sanity outage or a half-populated singleton cannot blank the chrome or fail the build | `BaseLayout.astro`, `index.astro`, and as the fallback import in `SiteNav` / `SiteTagline` / `SiteFooter` / `Hero` |
| `lenisTune.js`, `footerTune.js` | Bench publishers; `footerTune` also owns the reveal maths (`footerRise`, `footerSpan`), the resting-footer dials (`?footerlift`, `?footermarksfrom` / `-to` / `-lift`, `?footerintro`, `?footerslide`, `?footerslides`, `?footerslidelead`) and a per-key `ZERO_OK` set so a dialed `0` survives the seeder. `slideK` / `slideS` / `slideLeadS` are read at play time through `getFooterSlideK()` / `getFooterSlideS()` / `getFooterSlideLeadS()` and deliberately stay out of `CSS_KNOBS`, the same shape as `introS`. `bandFadeS` (`?logofademin`, 0.55 s, ZERO_OK) joins them as a paint-time read for the band's minimum fade. `slideS` exists because the slide stopped borrowing `introS` when it grew from a 1.25rem nudge to a full-reveal rise (~9× the travel). The 10-08 desktop-layout knobs go the OTHER way, into `CSS_KNOBS` as inline `<html>` properties: `topPad` → `--footer-rest-top-pad`, `tickerFoot` → `--ticker-foot-clearance`, `blurbFill` → `--footer-blurb-fill`. A token declared on an ELEMENT cannot be dialed this way (the element's own declaration beats the inherited value), which is why these three are read with `var(--knob, fallback)` on `<html>` instead | tune panels, `SiteFooter`, `global.css` |
