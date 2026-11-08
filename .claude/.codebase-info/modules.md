# Modules

*Last Updated: 2026-11-08*

## Site chrome (`src/components/*.jsx`)

| File | Purpose |
|---|---|
| `SiteShell.jsx` | Persistent island: `InfoPanel` + `ProjectOverlay` + `RouteFill`; owns `data-chrome-open`, `--scrollbar-w`; lazy-loads Lenis/Footer tune panels. Passes `siteCopy` straight through to `InfoPanel` → `SiteNav` (10-08), and since 11-03 the Client Roster (`roster`, from `BaseLayout`) and `onClose`, which a client name's click calls |
| `SiteNav.jsx` | Fixed top bar (lockup, info pill, links); home/process variants are CSS off `body.route-*` — four fills repo-wide: base `--color-electric-blue` (`global.css:784`), `body.route-home` **brand black** (`--color-black`, new 10-08: it was the only transparent nav besides /process, so the turning sphere tracked through behind the links), `html:has(.fp)` / `html.fp-tint` the project accent, and `body.route-process` transparent (`process.css:28`). No JS ever writes a nav background — `lib/navAccent.js` only publishes custom properties on `<html>` — and the fill must live in `background`, never `opacity`, because the bar's own `autoAlpha` is animated on the home chrome gate; sets `html[data-menu-open]` while the mobile menu is up. The mobile menu's foot renders the SAME tagline the pill does, parsed from the `siteCopy` prop rather than a shared word-array (10-08). Since 11-03 the links include `project_directory` after featured_projects, its mark the `FolderIcon` (drawn like the heart, Nathan's call); `refreshCurrent` marks it current on `/work/directory` and keeps featured_projects for `/work` and the detail pages. Below 992px the desktop row hides it (`.site-nav__link--directory`: five links overrun the bar) while the phone menu lists all five |
| `SiteFooter.jsx` | Hero bookend (`noFill`) or sticky-reveal links footer, and THE writer of the reveal channel: absolute `--footer-reveal` / `--footer-peak`, their rest-normalized twins `--footer-rise` / `--footer-rise-peak` over `--footer-span`, and the measured `--footer-panel-h` (driven mode too, so home can use it as a parallax denominator). Home rests part-revealed wherever `?footerrest` is nonzero — by default on both tiers since bake A (`ba7cf2c`, 10-09: 0.59 on phones; 0.62 on desktop then, a 0.40 sliver since Nathan's 10-31 bake, `f2916d1`), at any width when the dial is passed explicitly, and `?footerrest=0` restores the old retract-to-nothing footer — so the on-load word entrance is armed off a fail-open `[data-footer-in]` ground instead of a progress threshold (the old `STAGGER_ON` watch loop is retired, and it never fired from the then-0.62 phone floor), and a touch scrub paints imperatively instead of through a React render. `armFooterEntrance(reduced, slide)` takes a second argument: with it the resting panel also rises into place on the wipe ease at timeline position 0 over `?footerslides` (0.7 s), written as `translate: 0 var(--footer-slide)` in px because `paint()` owns the panel's whole `transform` string (see `patterns.md`), with the words and the band line held back `?footerslidelead` (0.12 s) so the slide leads; the property is removed on completion and by `resetFooterEntrance()`. **The panel is parked LOW for as long as `--footer-slide` is set**, so one `dropSlide()` owns every non-animating exit — the reduced/no-words branch, `resetFooterEntrance()`, and the missing-blurb bail, which returns before `entranceShown` and so is re-entered by Hero's `FOOTER_IN_SAFETY_MS` timer: without the clear, a missing blurb parked the whole panel off the fold for the visit instead of being cosmetic (fixed 10-08). It also kills the held `slideTween`, so a soft nav mid-rise cannot keep rewriting the property after cleanup removed it. It also publishes `--footer-band-p` = `min(rise, elapsed / ?logofademin)`, the band's rise held back by a clock so a flick cannot skip the fade: the rise spans only ~95px at 1440×900, less than one wheel notch, so position alone made the dim band pop to full. A FLOOR, not a duration — a slow scrub beats the clock and `min()` leaves it alone, which is why it is a JS clock and not `transition: opacity` (a transition would impose its time on the slow case as lag, and the file says as much where it refuses one on the band). It owns a small rAF that runs only while the gate is closed, re-arms whenever the rise returns to its floor, and is torn down by `clearReveal()`. A separate effect publishes `--footer-blurb-em`, the blurb's width in em measured from a nowrap clone (weights, marks and all) and re-measured on `document.fonts.ready` — gated on the blurb's own computed first font-family via `document.fonts.check`/`load`, because every face is `font-display: swap` and a cold load would otherwise measure the fallback and publish a divisor ~7% too narrow. That measurement is what lets the one-line fill follow edited copy instead of one baked string, and it is what made the blurb safe to move into Sanity (10-08): `blurb` is now ONE MARKED STRING (`siteSettings.footerBlurb`, threaded `index.astro` → `LandingPage` → `Hero`), not the old `[emphasised opening, rest]` pair, parsed by `keywordLines()` and drawn by `renderWordTokens()`. Its highlights need BOTH a colour and a driver: `global.css` binds `--kw-bg`/`--kw-ink` on `.site-footer__blurb` and rests the box OPEN there, and `playFooterEntrance` winds them back with `kwSet(blurb, false)` before appending `kwWipe` to the same timeline as the words (reduced motion takes `kwSet(blurb, true)`). `broadcastReveal` additionally sets the one-way `[data-footer-seen]` latch (+ `sessionStorage 'swm:footer-seen'`, re-asserted on `astro:after-swap`) the first time the GATED `--footer-band-p` passes 0.999 — not the rise, because the latch is a hard `opacity: 1` at a specificity the ramp cannot beat, so latching on the rise would paint over the minimum fade on exactly the quick scroll it exists for — the threshold is that high because the CSS ramp has already reached 0.9994 there, so the handoff is invisible where latching at 0.6 would be a visible 0.24 jump. It is deliberately NOT cleared by `clearReveal()`, and an unreadable store fails toward the DIM pose. Note it also fires on `/work`, where `rest = 0`, so a full reveal there pre-brightens home's band. The distance is `?footerslide` × the panel's OWN resting reveal, resolved at arm time by `restingRevealPx()` (`innerHeight − panelTop`, forcing the one style flush that makes the rect the post-latch pose; channel fallback `(1 − --footer-span) × --footer-panel-h`). The default 1 starts it flush at the fold so **the whole hero globe is in view at load** (10-08): the ring's diameter is `fill × (1 + GLOBE_STROKE_FRAC) × cos α × min(vw, vh)` (0.87 × min desktop, 0.988 × min phone) centred at `vh/2`, so in landscape its bottom is `0.935 vh` and the panel-over-ring overlap is `rest × panel-h − 0.065 × vh` (the px figures first written here predate the Sanity blurb and are dropped; the guide's `?footerslides` row carries bake A's measured rise); in portrait the fit axis is WIDTH, so r stops shrinking while the centre falls. Either way it grows as the window shortens, so only a fraction of the reveal holds across viewports and a fixed rem cannot. The footer stays ignorant of the globe: nothing here reads hero geometry. Above 768px the variant also re-lays the panel (10-08): the August `min-height` reserve on `.site-footer__inner` paid for the fixed tagline stack when that stack sat over the panel's bottom, but under this variant the band is `order: 1` and the nav is hidden, so the reserve only pushed the blurb 64.9px down (`--footer-rest-top-pad`, 18px, replaces it) while the lockup it paid for is now `display: none` and the bottom-fixed © / privacy pill landed ON the marks row. What the reserve was really buying moved from above the blurb to below the band as `--ticker-foot-clearance` (fallback derived from the same tokens, so the two cannot drift): +12.02px and +27.99px of clearance at a full reveal. The blurb and the band's lead-in line share one `--footer-blurb-size` so the em-derived odometer scales coherently. It also HOLDS the band's word odometer through the entrance (10-08): `armFooterEntrance` sets `[data-footer-settling]` beside `--footer-slide` and `settleOdometer()` clears it from both the timeline's `onComplete` and `dropSlide()`, so the latch inherits the slide's already-hardened bail coverage and absence means running. The roll is a main-thread animation that froze and then jumped a whole word under the entrance's load — holding it beats phase-locking it for a word-indexed odometer (`patterns.md`). Since 10-31 (`cd03b9f`, Nathan's "pumps the brakes") it also exports `createFooterDrive(set, rest)`, the wheel's weight on a DRIVEN reveal (home and `/work`'s last World, where Lenis is off): a wheel delta moves a TARGET through `footerBrakeStep` (the tail brake), and the panel glides to it on `gsap.ticker` with `footerDamp`, Lenis's own damp (frame delta clamped at 100 ms); `add(dp, from)` / `stop()` / `goal(from)`, where `goal` is where a glide is headed, so the hosts' gates and a retract mid-glide read the target. Touch and reduced motion bypass it, and each host stops it wherever something else takes the panel. Exports `FOOTER_REVEAL_EVENT` names. Since 11-03 its ResizeObserver watches `#main` as well as the panel (re-measuring on the next frame), so a page that grows or shrinks in place with no scroll, as the directory's filter does, re-measures the reveal |
| `SiteTagline.jsx` | Persistent island: tagline pill + privacy pill, hosts `PrivacyOverlay`, letter-cut exit via `lib/charCut.js`. Two states: the extended blurb while home is at rest (`body.route-home`, no `data-chrome-open` / `data-menu-open` / `data-footer-revealed`), else "VISUAL WORLDS for the music industry."; a GSAP morph between them (`?tagmorph`), re-evaluated by a MutationObserver on `<html>` and on `astro:after-swap`. Its `maskLive` rAF is the ONLY thing that un-hides `.site-tagline__copy` and `.site-tagline__lockup` (ungated `visibility:hidden` ground, `display:none` only at ≤768px), so its `[data-footer-rest]` stand-down tests the TIER (`matchMedia`), not the latch — keyed on the latch alone it blanks the white lockup and the © for the session at desktop width, and `global.css:3016` (`html[data-footer-rest] .site-tagline__pill`) has already taken the pill. The same rAF keeps the corner chrome BEHIND the logo band (11-05, e9415e9): the lockup and © are clipped above the band's gray line (its `border-bottom`) while the band rides the panel's top (`bandBox()`), else above the panel's top edge, as on home's resting variant where the band is ordered last; above 768px the tagline pill is cut wherever the band's box covers it (`maskUnderBand`, writing only on a change so the intro wipe survives), never while `data-chrome-open` is set. The privacy pill is NOT masked: it stays in front of the band (Nathan, 1ed38e6). **The revealed footer is ONE row since 11-06 (SQ-22, merge `aac6e08`; Nathan 11-05: the lockup takes the VISUAL WORLDS pill's seat).** The white lockup sits inline before the © at the row's gap. Its optical edge stays on the pill's TEXT inset (`--pill-pad-x`, "retain the same 11px positioning"), not on the capsule's edge. Above 768px the pill is seated out of flow (`position: absolute` on the tagline's bottom-left corner). Once the band's top edge passes the pill's top, `maskUnderBand` keeps it fully cut (`inset(<height>px 0 0 0)`) and `inert` for the rest of the reveal, so it never re-emerges below the gray line; scrolling back out undoes both. `--tagline-row-h` (the taller of the lockup art and the pill's box) sizes the row, and the footer band's `min-height` counts it once. **Its copy is Sanity data since 10-08** — a `siteCopy` prop from `BaseLayout`, parsed with `keywordLines()`. The three baked structures are GONE (`TAGLINE_LINES`, `TAGLINE_LONG_LINES`, `TAGLINE_LONG_SPLIT`) along with the `TAGLINE_LINES` / `EM_LINE` / `TAGLINE_LONG_SPLIT` exports: the Medium cut used to be POSITIONAL — a line index (`EM_LINE = 0`) and a word count (`LONG_EM_WORDS = 3`) — which cannot survive copy an editor can reword, so it is now the `**bold**` marker, travelling with the word. `labelLong` / `labelShort` / `shortChars` (the letter exit's budget) are derived from the live copy instead of a frozen string |
| `RouteFill.jsx` | ADR-0002 blue bridge + the globe loader (SQ-32, 11-08: mounts `GlobeLoader` after hydration in its `.route-fill__loader` layer, replacing the `overviews_loading` bar; home → /work opens it on `swm:loader-start`, FP card → detail `?loaderlead` ms after the cover is up on a `?loaderquick`-compressed draw, cancelled if the page is ready first; the reveal waits at most `?loaderend` for an unfinished draw). OFF by default since 11-08 (`LOADER_ON`, `?globeloader=1` previews it): the passages are the bare fill and the globe never mounts; the single nav-accent control point |
| `ProjectOverlay.jsx` / `PrivacyOverlay.jsx` / `PrivacyContent.jsx` | Inquiry form (Netlify Forms) and privacy overlay, both on `lib/overlayWipe.js`; privacy copy shared with `/privacy` (main's 10-13 policy, less its QuickBooks section since 11-03; `/terms` reuses the `.privacy*` styles); the overlay opts out of Lenis (`data-lenis-prevent`); the form's check mark is `ui/CheckIndicator.jsx`'s `circle-check` (lifted out 11-03) |
| `InfoPanel.jsx` | Slide-down client drawer with SiteNav seated at its bottom; relays `siteCopy` to it. Its studio blurb is the ONE still baked in source — Nathan's deliberate call on 10-08, where the other two moved to `siteSettings` — and it is plain JSX with a `<strong>`, not marked copy, so it never reaches `keywords.jsx`. `.description__text strong` carries `--weight-medium` to match the footer's cut (both surfaces resolve to ABC Areal first, a variable face at 400..700, so 500 is a real instance) and KEEPS its 08-30 project-accent colour, so the drawer's subject wears weight AND hue where the footer's wears only weight. **Its client list is the Client Roster since 11-03** (`roster`: every published `client` in Sanity, by name; `constants.js` `CLIENTS` retired), in three columns keyed by slug. A live name (its Client Coverage holds a directory tile) links to `/work/directory?client=slug`; the rest are plain labels. On the directory it marks the active client (the accent, `aria-current`, `CheckIndicator`'s eye after the name), whose link clears the filter, and a click re-filters in place through `swm:directory-client`; elsewhere ClientRouter takes the link, and a modifier or middle click stays the browser's. The drawer closes either way (`onClose`). The closed drawer is `inert`, and the mobile scroll thumb is `ui/useScrollThumb.js` |
| `ClientLogoTicker.jsx` | Logo band above the links footer; rides `DragMomentum`; assets via `import.meta.glob` + `src/assets/client-logos/manifest.json`. Owns the band copy: `COPY`, `SPECTRUM_PHRASE` (`'full spectrum'`) and `leadParts(copy, phrase)` → `[before, phrase, after]`, so the phrase is wrapped in `.logo-ticker__spectrum` for the 127 BPM ink pulse without a hard-coded split. `SPECTRUM_WHITE` (`true` since 11-07: white, the pulse kept but off) bakes `data-spectrum="white"` on the band, which sets the phrase in the odometer word's `--color-white` with both spectrum animations off; `?spectrumwhite=1` / `=0` overrides it for the page view. Its dials cover the band and the house pulse: `?logorestop` (resting band opacity) plus a `rootDial()` helper that writes bare numeric tokens on `<html>` for `?inkmuted` (`--ink-muted-l`), `?pulsebpm` (`--swm-bpm`) and `?pulsereps` (`--swm-pulse-reps`, clamped 1..5 — how many times the 5-hue walk sweeps per half note, so the cycling rate moves while the BPM boundary does not). The word odometer's CSS roll is gated by two `<html>` latches this island does NOT own: `[data-footer-revealed]` runs it, and `[data-footer-settling]` (`SiteFooter`) holds it through the on-load entrance |
| `Hero.jsx` (~1000 lines) | Home hero: intro modes (full/replay/rm via sessionStorage), globe rig, `enter_world` commit (the CTA chrome fades out in 0.2 s, then `swm:loader-start`; under the population modes it holds the clock and hands /work the world on the globe, `swm:enterWorld`; RM covers instantly; since SQ-34 the dive's master `raw.p` also drives the FP→detail lens deepen through the scene api's `setEnterLens(x, y)` — `enterLens()` from `work/world/enterTune.js`, y × `ENTER_LENS_Y` 1.1, full amount `heroConfig.HOME_LENS` −0.22, Nathan's 11-08 bake, `?homelens` retired), footer reveal. A zoom_in from a raised footer glides the reveal back to the floor on `SiteFooter`'s `wipeReveal` (11-03; it snapped before). It owns the resting-footer latch `[data-footer-rest]` and the scroll accumulator that advances the reveal off its `?footerrest` floor — `FOOTER_REST_MOBILE` 0.59 is the phone DEFAULT, not the gate (re-baked from 0.62 on 10-08 when the Sanity blurb re-wrapped the panel 306px → 281.2px and the old floor over-revealed it; `scripts/globe-probe.mjs` `FOOTER_REST_EXPECT` is its gate twin), and `FOOTER_REST_DESKTOP` 0.40 is desktop's own default (Nathan's 10-31 "sliver", `f2916d1`; 0.62 from bake A `ba7cf2c`, 10-09; no probe twin, since `--footer` is phone-only, so `scripts/test/footer-reveal.test.mjs` holds it to its own clipping floor and its routing): an explicitly passed `?footerrest` reaches any width, and the whole `[data-footer-rest]` CSS variant is viewport-ungated, so the desktop variant is dialable with no layout fork. `addDelta` has two callers, `onWheel` and `onTouchMove`, both registered unconditionally — the wheel drives the home footer on desktop through `SiteFooter`'s `createFooterDrive` (10-31: a delta moves the drive's target, and the gate reads `drive.goal`), while touch stops the drive and sets the panel directly; the `--hero-lift` parallax rides that channel (CSS-derived, half rate by default) and the footer's entrance is armed inside `chromeBeat`. Its centred CTA's visible label is **`zoom_in`** (10-08); `enter_world` survives as the name of the commit, its event and its CSS, so the two no longer match on screen — with `armFooterEntrance(PREFERS_REDUCED_MOTION, introMode === 'full')`, so the resting panel's slide plays only on the first view in a tab, reusing the existing `sessionStorage 'swm:hero-intro'` decision (`full` / `replay` / `rm`) rather than a second "recently" mechanism; `introMode` is declared below the effect but read inside its callback, which React runs after the render body. Under the `[data-footer-rest]` variant the footer links yield too (`.site-footer__nav { display: none }`, 10-08) |
| `LandingPage.jsx`, `HeroText.jsx` | Island wrapper (relays `siteCopy` from `index.astro` to `Hero`); hidden `<h1>` |
| `ui/CheckIndicator.jsx`, `ui/useScrollThumb.js` | Shared UI, lifted out on 11-03. `CheckIndicator` `{checked, variant}` is the animated mark beside a choice, drawn with a stroke-dashoffset tween: `circle-check` for the inquiry form, `square-eye` for FilterTag and the drawer's marked client (a square that brightens while an almond eye draws in, the pupil 0.15 s behind; instant under reduced motion). `useScrollThumb(scrollerRef, active)` → `{trackRef, thumbRef}` is the drawer's GSAP scroll thumb, shared with DirectoryFilter |
| `ui/GlobeLoader.jsx` | The globe loader (11-08, SQ-31): the lockup globe on black, "world" above and "loading" below (lowercase by default, `?loadercase=upper` for the label's caps; the label wears `.route-fill__loader-label`). The ring is there from frame 0; 9 meridians trim-path in left to right from the pole end, then 4 parallels top down (`stroke-dashoffset` on `pathLength="1"`), then it turns at `processConfig.O_SPIN_DPS`. The turn is one 40° meridian step of precomputed path keyframes played by SMIL `<animate attributeName="d">` on a loop, so no JS runs per frame and no three.js is imported; parallels never move (a turn about the pole leaves them). Pauses off screen and when the document is hidden; reduced motion holds the drawn globe. `<GlobeLoader ref active timing lowercase className />`: `ref` → `{start(), replay(), stop()}`, `active` false→true replays, `timing` overrides the dials; `readLoaderDials()` (`?loadermstag`, `?loaderdraw`, `?loaderpstag`, `?loaderspin`, `?loaderreplay`, `?loadercase`). Sized by `--globe-loader-size` (240px); the parent positions it. Geometry is pure in `lib/globeLoaderGeometry.js` (follows the lockup art's 9 meridians and 29/54.5/90/128° parallels, not globeConfig's 12 × 30°; `buildTimeline(timing).drawEnd` = the draw-in in seconds), pinned by `scripts/test/globe-loader.test.mjs`. Review page `/lab/loader`; mounted by `RouteFill` since SQ-32 (imports `globe-loader.css` itself) | `pages/lab/loader.astro`, `RouteFill.jsx` |

## Globe (`src/components/globe/`)
`VideoGlobe.jsx` (component) · `useGlobeScene.js` (the only three.js↔React boundary; `gsap.ticker`
loop, `forceContextLoss` teardown; under the population modes the world-colour ink tween and the api's
`onWorldChange` and `popHold`; renders at `globePixelRatio(devicePixelRatio)`, and under media spans
calls `director.place()` every frame right after `scroller.update` and hands the scheduler the DPR
bucket read off `renderer.getPixelRatio()`; SQ-34's Enter World lens: at idle after mount it builds, from lazy
chunks, the /work World's composer recipe (MSAA-4 sRGB target, `RenderPass`, the vendor `LensDistortionPass`
last, `needsSwap` false) at 1×1 and pre-compiles its programs; the api's `setEnterLens(x, y)` sizes it to
the drawing buffer and routes the tick through `composer.render` for the dive only — at rest the tick
is the direct `renderer.render(scene, camera)` (its own line: `globe-worlds.test.mjs` guards it); reduced
motion never builds it; `?debug` exposes `window.__globeLens` {ready, programs, routed, lens, diff}) · `buildGlobeGeometry.js` (panelized sphere + pole wedges) ·
`panelMaterial.js` (unlit shader: cover-fit, `uMix` A↔B, `uPower` cascade, `uBlueMix`; under media
spans the flat look's unit crop, P9 `310ad84`: `uSpanA` / `uSpanB` = (1, `spanC`) sample about the
unit's centre, pinched by `sin(vT)`, written with each window by `tileSwap.setWindowA` /
`setWindowB`; the panel grain term and `panelGrain.js` were removed on 10-31, `f2916d1`) ·
`cascade.js` (`DELAY_ORDERS` is the authority on the orderings `panelDelay` actually implements; the
older `CASCADE_VARIANTS` omits `random`; `delayOwner(panel)` gives a unit's members their lead's
delay, so a unit powers on and fills blue as one picture, and a panel outside a unit owns itself)
· `LivePanelScheduler.js` (~2 Hz promote/demote; `dropLive` under a swap; `setShared` = one decode
per clip on every tile showing it; `canJoin` is the one place the join loop, the clip score and the
resolve-time attach sweep ask what may join; under media spans a unit joins and leaves its stream as one, and each stream gets a planned
rung inside `decodeBudget` = `MAX_LIVE × mp(pinShort, 16/9)` through `tierFor` / `bucket` /
`pinParams`, `planOf` / `rungPlan` / `plannedMp` and the `tierCall` timer; `decodeStats` feeds the
telemetry; under the fast handoff (`?pophandoff`, the default since 10-28) it beats every `HANDOFF_BEAT_S` 0.1 s, and a change in flight hands
it the `incoming` worlds, whose clips it starts mid-swap off `swapAsset` (`aheadScores` / `aheadGroup`;
`planOf` waits rather than drop a rung; a stream that resolves before its tiles land is kept for them);
`predictStarts` and the static `forecast` replay its admission for the fetch-ahead; `landingClips(rotation)`
(and a static twin for before the scheduler exists, with no camera) scores a planned board at a given
rotation through `scoreAll` and the last update's `camera`, for the director's plan ahead; and `handoffQuiet`
says this world's streams are in) · `VideoSlotPool.jsx`
(fixed HLS pool; every slot streams the preview window clipped at the source through
`streamPrefetch.js`'s `poolStreamUrl` (`work/imageConfig.js`'s `muxStream`), video-only via `useHls`'s
`videoOnly`, at `GLOBE_STREAM_PARAMS` unless `assign(slot, id, params)` passes a tier's pin, and
`primed`, so a playlist fetched ahead plays from memory; `assign` resolves on the first frame of the src
it asked for, never on a reassigned slot's previous stream, which plays on until React commits the swap,
`e2227e9`) · `streamPrefetch.js` (the fast handoff's
fetch-ahead, 10-27: `planUrl` is the pool's URL for a scheduler plan; `prefetchClip` fetches the master
and rendition into `work/hlsPrimed.js`, since Mux serves both no-store, and the init and segment into
the HTTP cache (max-age 7 days), at `priority: 'low'`; the module queue `prefetchClips` runs 3 at a
time, 2 on phones, and a newer list replaces what an older one left unstarted) · `TextureManager.js` (refcounted Mux
thumbnails + square Sanity stills + name strips, keyed by `assetKey` = playbackId | imageUrl |
nameKey; under media spans also the class textures at their `texSpec` size with a measured
`userData.aspect`, and the residency ledger `stats()`) · `buildAssetPool.js` (pure build-time ordering) · `MeridianScroll.js` (row conveyor;
stamps tape coordinates `(lonIndex, tapeS)`, optional `assignRow` hook, `advance()` extra travel
for the tide; `predict(dt)` gives every row's angle and birth `dt` seconds on at the current pace, as
`update()` will leave them (null past a span − pitch of travel); a re-born row cancels its in-flight swap (`cancelSwap`, counted as `bornCancelled`)
so a swap planned before the wrap cannot land the old row's asset over the born one; exports
`poseTile(panel, theta)` — the ONE place the row angle becomes both the
`uPolarTop` uniform and the live `centerDir` every CPU-side latitude reader uses — its CPU half
`posePanel` (centerDir and parked, no uniform: the plan ahead poses tiles where they will be and puts
them back), and `scrollZeroTheta(row, rows)`, the scroll-0 angle `useGlobeScene` needs to pose tiles for the
initial layout, which runs before the scroller exists) · `InteractionController.js`
(yaw/pitch skin over `lib/dragMomentum`; the home globe passes `drag: false` on every screen since
10-27, phones since 10-07, so the pose it lands a world at is known ahead; /lab/globe keeps its drag) · `globeConfig.js` (tunables; re-exports drag constants from
`dragMomentum`; the VideoGlobe's device knobs: `GLOBE_DPR_MAX` (`?globedpr`, 3 on phones since bake B
`8732aa8`, `DPR_MAX` 2 on desktop; /process keeps `DPR_MAX`), `GLOBE_STREAM_PARAMS` (`?globeres`, one
Mux rung, else 720p on desktop since Nathan's 10-23 bake (Q22) and the 480p `STREAM_PARAMS` on phones), `GLOBE_T1` (`?globethumb`, the legacy square side every
class texture derives from), `globePixelRatio`, and `NAME_STRIP_H`).

**Population modes** (`docs/globe-worlds-plan.md`; `tides` is home's
default since Nathan's 10-06 bake, and `?popmode=off` restores the pre-worlds globe):
`buildWorldPools.js` (pure: `FEATURED_WORLDS_QUERY` → one pool per featured project, /work showcase
parity; a project's still album art, two covers or more, collapses into one sequence asset, `frames`
plus `ar`, so one panel cycles the covers; a cover that is the project's hero, `assets[0]`, leads it as
frame 0, and a lone cover hero stays a single, 11-05 SQ-16) · `worldPatterns.js` (pure, seeded cluster patterns over the tape) · `PopulationDirector.js`
(one world at a time by default; tile → world assignment; the change clock, a hold then a tide /
blink / surge / cut; current + next world held warm; freeze under the commit's blue; `hold()` at the
Enter World click stops the clock but lets a change in flight land; `onWorld` feeds the scene's
colour; name strips (`?popnames`, 0 = none by default since 10-24) placed camera-relative once per world change by `planNames` (`warmSet` holds
their textures), then reconciled per frame by `placeNames`; under the fast handoff (the default since 10-28) the next world's warm waits (`nextWarm`)
until the scheduler is quiet, at least 0.3 s and at most 2 s, and then its board is planned ahead for the
pose the globe will hold as it lands (`planAhead`, a what-if that puts back every pose, birth, cursor and
counter it borrows: the rows from `MeridianScroll.predict(holdLeft)`, the yaw from the scene's `getSpin`,
the plan from `planBoard`; a tide re-births every row, so it plans nothing ahead) and the clips that board
starts (the scene's `landing` hook = `LivePanelScheduler.landingClips`) are fetched (`prefetchFor`, through
the scene's `forecast` hook; the first world's from the laid tiles, `prefetchLaid`); the change adopts that
board when it lands within `AHEAD_TOL_RAD` 0.5° of the prediction on the same dials and births
(`adoptAhead`; else `aheadMiss` names why: dials / pose / births / tiles / admission, and it plans late);
`keysOf` counts the distinct textures a world needs (pool / board / front / on screen), all in
`stats.handoff.ahead`; and `incomingWorlds()` names the worlds a change is landing; `stepSequences()`,
which the scene runs right after `place()`, cuts each sequence tile's `texA` to the shared clock's frame
(`lib/mediaSequence.js`) and holds one frame ahead (`seqRefs`, given back by `dropFrames` when the tile
moves on; `stats.seq`, with `units` by class and `split`, units whose members show different frames,
which should be 0); under `?popseqquad` (`popConfig` `seqQuad`, default 1, 11-05 SQ-16) a sequence
stands first in `electQuads` and `planUnits` tries it before the cursor walk, so the covers take the
world's 2×2 and cut there, `0` restores the editorial order; publishes `window.__swmPopStats`) ·
`nameTicker.js` (client-name strips: the world's `clientName` in the FP card face baked once per
world + style into a CanvasTexture `STRIP_H` = `globeConfig.NAME_STRIP_H` tall — 256 × the ratio the
canvas actually renders at over the one `DPR_MAX` would give it, so a DSF-3 phone under
`GLOBE_DPR_MAX` 3 draws 512 — with `nameSpan` sizing the strip from the MEASURED text; pure
`namePinch` / `nameWindow` / `nameRendered` compensate `panelMaterial`'s pole pinch so a strip
renders its exact tape slice at any latitude) · `tileSwap.js` (THE refcount-safe `loadTile` + blink
/ surge / cut swaps, `applyPlan`; cover-fit reads a texture's `userData.aspect`) · `popConfig.js`
(`?pop*` TUNING + pub/sub; Nathan's baked defaults).

**Media spans** (`docs/globe-worlds-plan.md` § Media spans, which is the repo's record of the round's
contract; built P0a–P7 on `refine/globe-worlds`, shipped OFF behind `?popunits` until Nathan's 10-23
bake turned them on (Q1, with `unitMax` 4 and `equiv` 12: Q7, Q8; `equiv` re-dialed to 32 on 10-24); `?popunits=0` is today's globe): one classed asset spans 2×1 (`h`), 1×2 (`v`), 2×2 (`q`), 3×2 (`w`) or 2×3 (`t`, a grown portrait,
10-31) tiles as one picture, each member cropping its own slice, the lattice gaps hiding their strip (the mullion).
`unitSpan.js` is the import-free arithmetic (lattice, `memberWindow`, `coverWindow`, `compose`,
`unitA`, `kappaOwn`, the ε window `thetaBound`, eligibility, `classSizeAt` / `texSpec`, `spanSharp`,
`wideClass`, `electQuads`, `UNIT_FALLBACK` / `canForm`, `liveB`, P9's `flatWindow` and
`unitLookFor` (a three-row unit always takes the flat crop), the 2×3s' `eligibleT` / `TALL_THETA`
and `growTall` (a world's portraits grow with the room its selection left in the tile budget), the
source and picture readers, `stillSpec` (a sequence frame's square still; a frame with transparency
comes padded whole onto `PAD_BG` near-black by the CDN), and the stream tiers `STREAM_RUNGS` /
`STREAM_TIERS` / `tierBucket` / `rungAtMost` / `pinShortOf`). `mediaClass.js` (`CLASS_SOURCE`,
`nativeRatio`, `classOf`) classes each asset once at build time: the label proposes, the native ratio
vetoes (a sequence's is its `sequenceRatio`). **Two shape sets**
(`?popshapes`, `POP_SHAPES`): `wide` (the default, Nathan 10-24) spans 16:9 and 4:3 3×2 (falling back to
its 2×1, then a single), tall 1×2 and every sharp square 2×2 with no quad election, and sizes a wide
texture at its picture's aspect clamped to the slots it serves (own, fallback, single), so every slot
crops as the source would; `classic` (the 10-23 set) spans 2×1 / 1×2 and elects `?popquads` 2×2s,
with slot-shaped textures. The span plumbing:
`buildWorldPools.toGlobeAsset` stamps `u` (the classic class) and `uw` (the wide class; either absent = single only) on a classed asset, and
`s` (the source short side; 0 = unknown, absent = at least `TOP_RUNG`) on a video below `TOP_RUNG`;
`PopulationDirector` pools by class, elects quads (classic) or decorates by `wideClass` (wide), plans
units (`planUnits`, shared delays; under wide in three passes over the board's leads: the 2×3s alone,
from leads inside `eligibleT`, one per grown portrait a plan; then the two-row units, since only about
one row band admits them; then the rest), and
`place()` re-derives every member's A window and, when its stream was lit for this unit, its B
window each frame; `tileSwap.windowA` is THE texA window rule, `tileSwap.placeKey` (asset key plus
unit slot) is what `applyPlan` compares to skip a tile, and `loadTile`'s bind hook writes a planned
member's window on its first bound frame; `HeroLabels` draws one chip per unit at
its centre. Eight `?pop*` knobs (`units`, `shapes`, `unitMax`, `quads`, `tier`, `equiv`, and since 10-31
`unitLook` = `?popunitlook` flat | rows and `portrait` = `?popportrait` fill | pair) sit in `popConfig.js`
with a spans group on the bench.

**Panel grain is gone** (10-31, `f2916d1`, Nathan's item 16): `panelGrain.js`, the shader's grain term,
the 8 `?popgrain*` knobs and the scheduler's grain-band gate were removed. The FP pager scrim's grain
(`work/scrimNoise.js`) is untouched.

## Hero (`src/components/hero/`)
`heroConfig.js` (TUNING store + pub/sub + ease paths; `GLOBE_STROKE_FRAC` — `?globestroke`, baked 6 %
desktop / 5 % mobile — is ONE source of truth consumed by both `Hero` (ring `1+FRAC` proud) and
`HeroIntro` (globe `1/(1+FRAC)` smaller inside the lockup "o"), so thinning the ring GROWS the globe in
the "o") · `heroOverlay.js` (scene→DOM disc projection)
· `HeroIntro.jsx` · `HeroLabels.jsx` (the chips; under media spans one chip per unit, anchored at the
unit's centre, and a fading chip's slot keeps its unit's members, `heldMembers`, re-deriving the anchor
from live poses each frame so it never jumps) · `HeroTunePanel.jsx` / `CommitTunePanel.jsx` /
`PopTunePanel.jsx` (benches; the last is `?poptune=1`, with a spans group: on/off, shapes, crop
(`?popunitlook`), portraits (`?popportrait`), units / asset, quads / world, tile budget, video tier, and an orientation group whose `tilt` toggle flips `?herotilt` between
heroConfig `TILT_PRESETS` new −10 (Nathan's pick, 10-28) / old 45.5 through `setHeroTune`; a `handoff` row under live video picks
`?pophandoff`; the readout line above it shows spans (`w · h · t · v · q`), tex MiB (decoded images: through a hold it also counts the next world, and never video frames; 10-31 measured it against the GPU, `docs/globe-worlds-plan.md` Status log) and decode
mp / budget, and a handoff line: starts (mid-change, primed), clips fetched and MiB, the next world waiting;
a `sequence frame (ms)` row dials `?seqms`, the site-wide sequence rate, live over the URL until a reload).

## /work (`src/components/work/`)
| File | Purpose |
|---|---|
| `FeaturedProjects.jsx` (~900) | Orchestrator: wheel/touch accumulator → CTA fill → World Turn; scroll-up-to-home at World 0; driven footer at last World; lazy benches; legacy `?pager=rail`. Wheel and touch building dispatch `swm:fp-drag` (the lean); a finger holds its fill until the lift (no stall while held) and releases on `touchend` / `touchcancel`, the wheel on the `RELEASE_MS` stall; `data-turning` on `<main class="fp">` marks the Turn window (the pager chip and the CTA chips swap to `--nav-ink` under it); the CTA chips' white charge is the registered `--cta-charge`, and their background takes no transition; [PREVIOUS] stays mounted through its wipe-up at World 0, and leaving World 0 wipes it back in (the exit's inverse; a layout effect sets it closed before paint), while a wipe caught midway reverses from its current clip. Enter World arrival: consumes `swm:enterWorld` once and snaps (`snapRef` = target index: one entering card and no Turn, direction 0 in `useWorldScene`, instant pager step; the fill is released on the snapped card). The `swm:returnToWork` restore (the detail breadcrumb back) snaps the same way |
| `WorldCard.jsx` | Identity card, OS-window boot entrance; fires the real enter commit. Its wrap leans on `swm:fp-drag` (`y`, which composes with the Turn's `yPercent`; `?dragfollow`). Its card CTA's visible label is **`zoom_in`** (10-08, was `enter_world`) — one literal, rendered once per card, and `enter_world` survives as the name of the commit, its event and its CSS, so the two no longer match on screen (the same split as Hero's centred CTA) |
| `CtaArrows.jsx`, `textExit.js` | Caret strips; text-out choreography (`TEXT_TUNABLES`) |
| `pager/usePagerGesture.js` | Shared gesture engine: press-hold engage, scrub + detent magnet, wrap, end resistance, stall commit; only `requestGoTo` fires a Turn; `follow(i, instant)` steps without the glide |
| `pager/GraticulePager.jsx` | The `scale` skin (SSR'd default). Tape/tuner arms removed; survive as tuning presets. On a `snapRef` arrival it jumps to the station and skips the announcement. Its rest pulse is ONE beat that rides every Turn (11-03): the number's white flip is a twin span `.fp-scale__peak` faded on opacity, so the loop never records the accent ink; only intent (charge, engage) kills it, and rest re-arms it 500 ms later through `joinHousePulse` |
| `bandLayout.js`, `scrimNoise.js`, `useHls.js`, `imageConfig.js`, `hlsVideoOnly.js`, `hlsPrimed.js`, `ServiceTag.jsx` | Shared math/recipes/hooks. `scrimNoise.js` owns the house grain recipe, the FP pager scrim's (the globe's panel grain read it too until its removal on 10-31); `noiseDataUri()` (bare `data:` URI) is split out of `noiseUri()` (CSS `url()` wrapper). **`imageConfig.js` owns the video windows** (the video diet, P0 `cb7b8e8`, Nathan 10-09): `PREVIEW_SECONDS` 5 (the globe pool, /lab, the World's Near tier, the Project Directory's tiles), `DETAIL_MAX_SECONDS` 15 (MediaSlot's default `clip`, its players wrapping at `wrapAt(clip)`; NextProjectBand, with `wrapAtDetailCap`; `wrapAt(s)` builds either wrap), and `muxStream(playbackId, end, params, start = 0)`, the one builder of a clipped Mux master URL (`asset_start_time` when `start` > 0, `asset_end_time` last, once; a start-less URL is byte-identical to before); every autoplay surface asks through it, and `muxPoster(playbackId, width, time = 0)` builds the posters. The video chunks (11-05, SQ-15): `CHUNK_COUNT` 3, `chunkRanges(duration)` (equal ms-rounded thirds that touch and cover the video), `MUX_SEGMENT_SECONDS` 5 with `chunkWindow` (a clipped stream starts on the segment at or before its start, so the window's `from`/`to` are offset by start mod 5, `patterns.md`) and `windowLoop(from, to)` (wrap to `from`, never native `loop`). The directory's defaults live here too (11-03): `DIRECTORY_PLAYERS` `{desktop: 8, phone: 4}` (6 and 3 until Nathan's 11-05 "up the number": one past the globe pool's 7, and its 4), `DIRECTORY_DWELL_MS` 300, and `SRCSET_WIDTHS` with `sanitySrcSet` / `muxPosterSrcSet`. **`hlsVideoOnly.js`** (P0v `f951497`) is the pure master-playlist rewrite that strips the audio group from a muted surface's master; `useHls`'s `videoOnly` option installs it as the `pLoader` (`videoOnlyLoader`, cached per Hls base class), and every muted surface sets it (the Lightbox, the one surface that played with sound, retired with the old directory on 11-03). **`hlsPrimed.js`** (10-27, the home globe's fast handoff) keeps playlist text fetched ahead, by URL (10 min TTL, 256 entries); `useHls`'s `primed` option layers `primedLoader` over `videoOnlyLoader` to answer hls.js from it, and `preloadHls()` loads the hls.js chunk early |
| `*TunePanel.jsx`, `fp1Tune.js`, `FeaturedDeckDebugPanel.jsx` | `?entertune`, `?texttune`, `?scrimtune`, `?fp1tune` benches (`?fp1tune` drives nothing live since SQ-24 made enter_world static; it only plots the house pulse curve) |

### `work/world/`
`useWorldScene.js` (~1200; renderer, slotA/slotB Turn, EffectComposer → lens distortion (writes sRGB
to the canvas; OutputPass folded in PW, `1058b67`, with 8-bit sRGB render targets and a bare canvas),
enter ramp, resize, `swm:fp-freeze` gate, the `swm:fp-drag` drum lean (`fpDrum` `state.drag`, added to `state.adv` in the roll; idle during a Turn), the camera look on mouse/pen only (touch belongs to the gesture since 11-03), the `FPS_CAP` render gate with `?fpstol` slack; a `snapRef`
arrival drives direction 0, no Turn) ·
`WorldScene.jsx` (shell + `VideoSlotPool`) ·
`worldConfig.js` (all tunables, `FPGRID` default 3 = DRUM; `?dragfollow` `DRAG_FOLLOW` 0.06 (0.1 read too strong), the lean at full fill as a share of a Turn; `?dpr` 3 on phones / 2 on desktop since
P0c `113b085`; `?wallpx` with its desktop floor `Math.round(768 * Math.max(1.5, WALL_DPR))` and
`?fpstol` 2 since Nathan's 10-31 bake, `f2916d1`; 0 from PF `d2967ca`) · `buildShell.js` (inverse-sphere
graticule) · `seededLayout.js` · `fpGridCells.js` · `fpAtlas.js` / `fpForme.js` / `fpDrum.js` (+
`fpDrumTrim.js`, `fpDrumWall.js` — the deck wall: since PF each column's page cycle is painted ONCE
into a static atlas, re-painted only as pages land, and the plate's shader scrolls it with one wrapped
travel uniform, so the wall canvas area sets texture memory and the upload per landed page, not a
per-frame repaint; a sequence plate gets one texture per frame from `fpDrum`, a transparent frame
padded by the CDN to the plate's shape on near-black, and `fpAtlas` cuts its map on the shared clock
once frame 0 has bound; `/work?debug` reads `__fpDrum[slug].sequences`, `chosenIds`, `droppedIds`) ·
`worldBands.js` · `worldLive.js` · `enterTune.js` (`ENTER_TUNABLES`; since SQ-34 also `enterLens(p, t, full)` +
`ENTER_LENS_Y`, the lens channel the home dive shares, pinned by `scripts/test/enter-lens.test.mjs`) ·
`vendor/lensDistortion.js`.

### `work/detail/`
`FeaturedProjectDetail.jsx` (orchestrator; the breadcrumb back covers in the project colour, then navigates; measures the grid and derives tile row spans from the
column width through the 10px row pitch so every tile holds one shape at every width — `TILE_SHAPE`
= 1, square 1:1, Nathan's 10-27 bake, `?tileshape` re-dials; `SQ_ROWS_FALLBACK` covers the server
render; ≤1024/≤768 spans reach masonry.css as `--tile-sq/pt/ls-rows`, set on `<main
class="project-detail__flow">` so every grid segment inherits them; since 11-03 these grid units — `GRID_ROW_PX`, `TILE_SHAPE` / `readTileShape`, `rowsFor`, `SQ_ROWS_FALLBACK`, `useTileShape`, `useGridMetrics`, `tileRowsFor`, `tileRowVars`, `placementStyle` — live in `tileGrid.js`, shared with the directory. Description bands (11-03): the
description's paragraphs split on blank lines — the first is the intro blurb, each later one is its
own `.project-blurb` band between stacked `.masonry-grid--detail` segments (`splitAtBreaks`), one
every `BLURB_ROWS` 2 squares (Nathan's 11-03 approval; 3+ paragraphs keep that pitch, closed up only
on a short grid), `?blurbrows` re-dials; with no tiles every paragraph
stays in the intro. `BlurbCopy` renders a blurb's paragraphs and owns its own `useKeywordWipe`.
Phone reading sections (11-07, SQ-26, reworked SQ-27): at ≤768px every `.project-blurb`, the intro
included, is `min-height: calc((1 - var(--blurb-peek, 0.12)) * 100svh)` (0.1 until SQ-30) with its copy centred
(`?blurbpeek`), and with a finger (`HOLD_MQ`, `(max-width: 768px) and (pointer: coarse)`, no reduced
motion, `?blurbhold` not 0) `useBlurbHold` attaches `lib/blurbHold.js`. A SEAT puts a section's TOP on
the viewport's top (no media above it, the peek of the next media below). ARRIVE: the page's scroll
velocity is tracked and, v/ω from the next seat in its direction of travel (ω = Lenis's λ at
`LENIS_TUNING.lerp`, the driven footer's damp; `?blurbcatch`), a critically damped spring takes it in
at its own speed, never past the seat; a page resting short of a seat that covers half the viewport
is eased on from rest. HOLD: a drag rides `lib/rubberBand.js` (copy tracks the finger, the lift
springs it home). EXIT: `SCROLL_TRIGGER_WORK_PX` of gained delta commits; the page then follows the
finger 1:1 and the lift hands its release velocity to a momentum decaying 0.998/ms (iOS's own,
`?blurbdecel`), no target and no duration. A section taller than its seat window is read natively.
SQ-28: the document's end is a downward ARRIVE target too (a stop, not a hold, so NextProjectBand
owns the end as before; `?blurbend=0` off); scroll samples are clamped to [0, docMax] so an iOS
overscroll bounce never sets the direction, and the page's top is a rest of its own (the rest-ease
never pulls a top-resting 16:9-hero page onto its intro); each section's top padding is
`--blurb-clear` (nav + the pinned breadcrumb chip + a gap) so copy never starts under the chrome; and
`attachBlurbFit` (every phone, held or not) writes one `--blurb-text` scale per page onto
`.project-blurb__text` (`calc(var(--text-blurb) * …)`): the target 1.25 (`?blurbtext`) or the
largest scale under it at which every blurb fits 0.9 of the SMALL viewport (a 100svh probe), floor 1.
SQ-30 (11-08): `BLURB_PEEK` 0.12 (Nathan's 88%), so the fit window is 0.88 svh with the air in. With
`?blurbgrow` not 0 the hold sets `data-blurb-grow` on `.project-detail` (sections drop to content
height) and `growFrame` writes each entering section's `min-height` inline every frame from its
position, growing at its BOTTOM to (1 − peek) of `window.innerHeight`; progress latches (never shrinks
leaving), a section fully below goes compact at once, one fully above only at rest with the page
moved by the height lost (`swm:blurb-reset`, `RESET_EVENT`, the probe seam); `overflow-anchor: none`.
Top padding is `--blurb-clear` + `--blurb-air` (`?blurbair`, 1.5rem proposed).
`BlurbCopy` mounts its keyword wipe only on the section's `ARM_EVENT` (`swm:blurb-arm`). Pure
geometry, the spring/momentum math and the dials: `lib/blurbHoldMath.js`;
`?chunks` (split an unflagged video by id or slug tail) and `?chunkgap` (tiles between its thirds)
are read after mount, like `?blurbrows`, and handed to `buildContentFlow`) ·
`buildContentFlow.js`
(assets → hero/showcase/decks/albumArt/banners buckets; `ORBIT_MIN` 4 = album covers needed for the
album wall, fewer fold back into the grid; `isBannerGroup` routes any displayGroup ending
`-banner(s)` to `banners`; a displayGroup ending `-sequence` collapses its stills into ONE showcase
item at the first member's place, carrying `frames` (`makeSequence`; checked first, a group of one
stays plain, a video member keeps its own tile); `assetLane(asset)` names the lane its loop switches on, first match wins: sequence, album-art, deck, carousel, banner, role, showcase, and the directory groups by it; `expandChunks(list, {only, gap})` (11-05) turns a showcase video with `splitIntoThirds` (or named by `?chunks`) into three tiles in place, ids `<id>~1of3`…, each carrying `chunk` `{index, count, start, end, from, to}`; no flag or no Mux `videoDuration` leaves it whole, and the hero and the other lanes never split) · `flushGrid.js` (pure placement with socket regions; `sqRows` sets the
square span — portrait 1 col × 2 squares, landscape 2 cols × 1 square, underlay bound half a
square; column-aware since 11-03, a landscape spanning `min(2, cols)`, so one and two columns place.
Anchors `top`/`mid`/`bottom`, plus `break`: `opts.breaks` zero-height full-width cuts that
no tile may straddle, pinned one at a time by `pinBreaks` on a tile-end row. The row that leaves the
fewest hole rows after both stretch passes wins (`holeRows`), then the one nearest the target, because
the nearest row can re-pack a hole into the tail. `splitAtBreaks` turns the result into rendered
segments `{tiles (rows rebased, .index = showcase index), sockets (domIndex segment-local),
breaks}`. `computeFlushGrid` no longer sets `domIndex`. `chunkFlushGrid(items, opts)` cuts a long list at flat states, where every column is free from the same row, so stacked chunks read as one grid and each stays under Firefox's 10,000-line grid clamp) · `GridSocket.jsx` (parallax on `gsap.ticker`;
hands `--socket-rows` to CSS) · `DeckScroller.jsx` (+ `BrandDeckViewer`, `AlbumArtViewer`,
`BannerViewer` — one-column full-width wall sized to 1.5 banners, rows derived from the measured
flow width through the grid row pitch; ≤1024 spans `--socket-rows`, masonry.css; the walls carry
no name or count labels since 10-27, only BrandDeckViewer's deck tabs on multi-deck projects) ·
`MediaSlot.jsx` (img `alt` → title fallback, video `aria-label` from `alt`, `description` as an
sr-only figcaption; a sequence,
`asset.frames`, stacks its frames and hard-cuts on the shared clock while near the viewport,
`useSequenceFrame`, one timer per slot landing on the same wall-clock beat; each frame is named by its
own `alt`, an opaque one cover-fit, a transparent one contained on near-black; an image that loaded
before hydration is flagged as its element attaches, since its onLoad never fires (every mode since
`4499fc3`); every `<video>` wraps at `wrapAt(clip)`, except a chunk (11-05: `asset.chunk`), which
streams its own range clipped at both ends, plays it whole (no `DETAIL_MAX_SECONDS`) through
`windowLoop` with `loop` off and hls.js `startPosition` at `from`, takes its poster at its own start,
and is labelled "(part n of 3)" with the `description` on part 1 only; directory mode (11-03, never chunked),
through props the detail page never passes: `clip` (`PREVIEW_SECONDS`), `sizes` (a srcset on images,
frames and posters), `gate` (a poster always, the `<video>` only while the player gate grants play,
emptied before it unmounts) and `fit` (`data-fit="contain"` letterboxes banners and alpha logos);
styles in `src/styles/media-slot.css`, lifted out of project-detail.css) · `ClientPanel.jsx` · `DetailProgressBar.jsx` (shared with
/process; on phones it sits 20px up, `--detail-progress-bottom` / `?barbottom`, 11-07) · `NextProjectBand.jsx` · `useKeywordWipe.js` · `BandPager.jsx` (tabled, unmounted).

### `work/directory/` (the Project Directory, 11-03)
`DirectoryPage.jsx` (the route's one `client:load` island: DirectoryFilter over DirectoryGrid, then
`SiteFooter` in reveal mode; props `{tags, clients, tiles, shuffle}` from `getDirectoryData()`. It owns the
filter's URL state and the hidden first frame (`communication.md`). A URL with neither `tag` nor
`client` starts on `defaultFilter` (`DEFAULT_TAG` `album-art`, filter open), rendered so on the server
and kept bare while it holds; `clear all` writes `?tag=` (every work). With `shuffle` (the Studio's
`siteSettings.directoryShuffle`) it draws one seed at mount, before the grid shows, for
`orderTiles(…, 'shuffle', seed)`; the server renders the build order and a shuffled page mounts no
media until then (11-05, SQ-12). It keeps its own scroll place per
history entry, jumps a filter change made while the filter is stuck to the sticking point first (a
glide would load every tile on the way), and reads the `?dir*` knobs once at mount) ·
`DirectoryGrid.jsx` (stacked `.dir-grid` chunks from `chunkFlushGrid`, each at its exact height,
`--chunk-rows`, one row gap apart, so the stack reads as one grid and an unmounted chunk keeps its
space; every chunk renders its tiles' boxes, so the focus order and the links are whole, but only
chunks within two viewports mount media, through one IntersectionObserver; columns 5 above 1024px
(`?dircols`), 4 at 769–1024 (`?dirtabletcols`) and 2 at ≤768 (`?dirphonecols`), Nathan's 11-05
numbers; a featured project's tile is a link named by the
project, the rest are media only. Under `?dirpack=aspect` it packs with `chunkAspectGrid` instead, at
the measured width (1440px on the server render), each placement naming its tile by `index`, and a
face covers unless `tile.clear`; `tile.ground` becomes `data-ground`) · `aspectGrid.js` (SQ-20,
11-05: the aspect-aware packer, `chunkAspectGrid(items, {cols, width, gap, look})`, `spanOf`,
`lossOf`, `LOOK` 8. Each tile takes its OWN shape at its cell width, spanning one column below a 1.2
ratio, two up to 3, and every column from 3. A skyline places the cheapest of the next `look`
tiles, so no tile moves more than `look` places from list order. Columns are levelled by resizing the
tiles on top, to the line whose worst crop is least (Nathan's "whichever edge will be cropped
less"). Chunks close as `chunkFlushGrid`'s do. A list of ≤64 tiles (a small filter) is also laid as
justified bands in list order, kept when it crops less, which makes short lists tall. The default
stays `flush` until Nathan's device pass; probe `scripts/directory-grid-probe.mjs`) · `DirectoryFilter.jsx` (sticky under the nav. Since SQ-21 (merge `61960f3`, 11-06) it opens and
shuts ONE way at every width: it loads open, the server's render too, and shut it is the bar alone,
the region folded to 0 and both panels `inert`.
- **The bar.** The live count (mono, the numbers alone) and "× clear all" (the house `CloseIcon`)
  sit at the left. `.dir-filter__end` at the right holds the client chip (its name as Sanity spells
  it, then `CloseIcon`), `n active` while anything is ticked and the filter is shut, and the toggle
  (`filters` / `close filters` and a stemmed arrow). All but the count are in the sans link tier.
- **The tabs.** A pair of folder tabs sits above the panels: `services` (every service tag with
  media, as FilterTags) and `clients` (the live clients, one pick at a time, which the chip shows).
  - Each tab is a 1px non-scaling SVG stroke over an opaque fill, built from `directoryTune.js`.
    `tabCap` draws the left side and the top-left corner, `TAB_TOP` the flat top over the word, and
    `tabSkirt` the shoulder, diagonal, foot and bottom run.
  - The clients tab is tucked left, so its left stroke meets the services diagonal at
    `TAB_SHAPE.meet` (`--dir-skirt-tuck`). Services reads as in front.
  - The active tab lies on top, and its left edge clips the other tab's skirt.
  - The shown tab's word (`.dir-filter__tab-word`) wears a steady underline; the other underlines
    on hover and focus. The word's box is padded down past the line and pulled back by the same
    margin, so the line repaints with the box on iOS (SQ-23).
  - A skirt's fill runs `TAB_FILL_BELOW` past its bottom stroke, so the next tab's line never peeks
    out under the foot.
- **The panels.**
  - The services panel stays in flow and sets the open height. The clients panel is laid over the
    same box and scrolls inside it, so a tab switch never moves the grid.
  - Left / Right / Home / End move between the tabs, and the hidden panel is `inert`.
- **Open and settled height.** It opens on the drawer's recipe, pushing the grid down. Past
  `100dvh − nav − tabs − bar`, a panel scrolls inside with the drawer's thumb. Its settled height,
  `--dir-filter-h` on `.dir-page`, sets the tiles' `scroll-margin-top`, so a tile Tab reaches lands
  below the stuck filter.)
- **No layer churn mid-open (SQ-23).** The open's tag stagger is a 2D translate (`force3D: false`),
  and the scroll thumb (and, on phones, the caret) hold `will-change: transform`, so no compositing
  layer is made and dropped inside the sticky filter while it opens: the suspected cause of the
  tabs dipping on an iPhone, which only a device confirms.
· `FilterTag.jsx` (a `role="checkbox"` button, which is also the clients tab's row; `{name, slug}` is
all it reads there:
`CheckIndicator`'s `square-eye`, the name as stored, the drawer's name type; ticked, the label's box
fills brand blue (directory.css `::before`, wiping in with the eye); dim and
`aria-disabled` when the client would empty it, and for a client row, when the picked tags would.
There has been no `inert` prop since SQ-21; the panel carries it.) · `playerGate.js` (`createPlayerGate({cap,
dwellMs})`: one IntersectionObserver for every watched tile and at most `cap` play grants;
`patterns.md`) · `LogoMark.jsx` + `logoTile.js` (11-05, SQ-13: a logo tile is a baked white mark on
black in a fixed-aspect canvas, a square or 2:1 by `canvasOf(aspect, land)`, centred in the tile, so a
tile the flush grid stretches keeps the mark in proportion; `logoLayout(logo, dials)` pads, scales to
equal ink and centres optically; `LOGO_DIALS`, `CANVAS_RATIO`; `DirectoryGrid` hands the canvas
ratio to the flush grid as `tileRatio`, the one seam `ratioOf` honours, directory only; styles
`src/styles/directory-logos.css`) · `buildDirectoryTiles.js` (pure, build time: lanes from `assetLane`; decks,
carousels, banner groups and sequences collapse to one tile per `lane:client:project:displayGroup`,
the `role` lane stays out; a tile is the slim face MediaSlot reads plus `client`, `services`,
`href` / `label` and `fit`, and a logo-typed image its `logo` mark through `logoVerdict` (mark,
drop for a twin or a held logo, or none). Since SQ-20 `fitOf(face, alpha)` letterboxes only a face
that is really transparent (`isTransparent`: an alpha channel Sanity doesn't call opaque that
measures ≥2% clear in the baked `src/data/directory-alpha.json`; an unmeasured one counts as
transparent) or that a cover crop would cut by more than half (the extreme-ratio banners, kept
letterboxed under flush). A really transparent tile gets `clear`, and dark ink on it gets
`ground: 'light'` (`groundOf`; directory-grid.css paints that cell the house cream); `orderTiles(tiles, mode, seed)`: `project`, featured first in World
order, `mix`, or `shuffle` (seeded, uniform); `logoFirst(tiles, tags)` (11-05, SQ-17: under exactly
`logo-design` the logo tiles lead as one block, the order holding inside each; any other filter is
returned as is; DirectoryPage applies it to `shown`); and the page's pure helpers: `matchesFilter`,
`tagPresence`, `clientPresence(tiles, tags, clients)` (SQ-21: the clients the clients tab keeps lit
under the picked tags), `DEFAULT_TAG` / `defaultFilter` / `hasFilterParams` / `sameFilter`, `readFilter` /
`sanitizeFilter` / `filterSearch`, `sizesFor` with per-band column counts) · `directoryTune.js` +
`DirectoryTunePanel.jsx` (`ORDERS`, `PACKS`, `tuneDefaults(shuffle)`; the filter tabs' pure geometry,
`tabCap(tl)`, `tabSkirt(shape)`, `TAB_TOP` and `TAB_FILL_BELOW`; and `TAB_SHAPE`, the tab's shape as
Nathan baked it on 11-06: a 55° diagonal, corner reaches of 0.161 H top-left and top-right and
0.11 H at the foot, a 0.5 H bottom run, and the meet at 0.5. Each corner is set by its reach,
r·tan(turn/2), so it keeps its look if the angle changes. The six `?dirtab*` dials were removed when
these values were baked; `?dirpack` (`flush` | `aspect`),
`?dirlook` (aspect's lookahead, 1..32), `?dirorder`, `?dirplayers`,
`?dirdwell`, `?dircols`, `?dirtabletcols`, `?dirphonecols`, `?dirlogopad`, `?dirlogoweight`,
`?dirlogoland`, `?dirlogocenter`; bench `?dirtune=1`, top right). Styles:
`src/styles/directory.css` (the scroll unlock with `overflow-anchor: none`, and the sticky filter,
which follows the nav's footer-reveal slide on `top`) and `directory-grid.css` (`@import`s
`media-slot.css`). Plan and open calls: `docs/project-directory-plan.md`.

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
| `dragMomentum.js` | THE drag + inertia engine (`DragMomentum`, `DRAG_CHOREO`); `drag: false` installs no pointer listeners at all — ambient-only, the surface leaves the gesture to the page (the home globe: phones since 10-07, every screen since 10-27); `touch: false` leaves fingers to a page gesture (/process) | `globe/InteractionController`, `ClientLogoTicker`, `process/useProcessScene`, `process/liveLockupGlobe` |
| `overlayWipe.js` | THE overlay wipe (`wipeIn`/`wipeOut`, clip-path up from bottom, inverse out). `wipeOut(el, duration, closed)` takes the closing edge: `CLIP_CLOSED_UP` (with `CLIP_OPEN_UP`) retracts the bottom edge upward instead (11-03). `wipeIn(el, tl, duration, closed, open)` takes both edges (default `CLIP_CLOSED` → `CLIP_OPEN`); `closed: null` runs from the current clip, for a re-entry mid-wipe-out (11-05). Its `tl.set` waits for the next GSAP tick, so a mount-time start state needs a bare `gsap.set` first | Privacy, Project overlays, mobile menu, the /work [PREVIOUS] chip (wipes up at World 0, then unmounts; leaving World 0 wipes it in, `CLIP_CLOSED_UP` → `CLIP_OPEN_UP` at `WIPE_IN_S`) |
| `scramble.js`, `charCut.js` | House scramble; random-letter hard cut (successor for arriving chrome text) | cards, chrome, tagline, pager |
| `smoothScroll.js` | Single Lenis on `gsap.ticker`; off on `/` and `/work`; `getLenis()` may be null; a scroller inside a Lenis route opts out with `data-lenis-prevent` (tune panels, `PrivacyOverlay`) or Lenis takes its wheel | layout script, process driver, GridSocket |
| `settleResize.js` | `settleDebounce` resize doctrine | scene hooks |
| `projectColor.js` | `--project-color*` vars, ink pickers (`projectInk`, `chipInk`), `colorPool` (distinct colours in /work order) | /work cards + detail, `/process` chips |
| `mediaSequence.js` | THE media sequence (10-31): one tile cutting through a set of stills on one wall clock, frame = ⌊now / `?seqms`⌋ mod n (`sequenceFrame`, `msToNextFrame`; 1000 ms default, 100 ms–10 s, the bench writes `setSequenceIntervalMs`); a hard cut, and reduced motion holds frame 0. `isSequenceGroup` (a displayGroup ending `-sequence`), `makeSequence` (the lead's fields plus `frames` and `sequenceRatio`, capped at `SEQUENCE_MAX_FRAMES` 12), `sequenceRatio` (the member ratio that crops the set least), `SEQUENCE_PAD_BG` | `work/detail/buildContentFlow` + `MediaSlot`, `work/world/fpDrum` + `fpAtlas`, `globe/buildWorldPools` + `PopulationDirector`, `hero/PopTunePanel` |
| `motion.js`, `momentum.js`, `navAccent.js`, `projectSlug.js`, `keywords.jsx`, `formatYearRange.js`, `constants.js` | Ease paths, accumulators (`motion.js` also owns the gesture lanes `DRAG_TRACK_S` / `RELEASE_GLIDE_S` / `RELEASE_EASE(_CSS)` and `joinHousePulse(tl)`, see `patterns.md`), nav accent + `--project-color` writers, slug fallback (and `featuredRoutes(rows)`, the detail pages' routes, which the directory's tile links share, 11-03), the house marker grammar, formatting; `constants.js` holds only `SERVICE_TAGS` since `CLIENTS` retired (11-03). `navAccent`'s published-token list is the contract: a derivation it computes but does not write to `<html>` reaches nobody, and because the `--project-color*` fallbacks are dead code (`coding-style.md`) the consumer silently gets the registration's brand blue instead — `--project-color-on-black` was computed-but-unpublished until 10-08, which is why the privacy pill never inked from the accent |
| `rubberBand.js`, `blurbHold.js`, `blurbHoldMath.js` | The house rubber band as one step (`createRubberBand`, pure `stepAccum`; 11-07, SQ-26) and the phone blurb hold built on it (`attachBlurbHold(root)` returns a detach, `holdWanted()`, `ARM_EVENT`, `RESET_EVENT`); `blurbHoldMath.js` holds the pure geometry and motion (`seatY`, `holdable`, `nextSeat`, `catchOmega`, `shouldCatch`, `catchStartV`, `springAt`, `momentumStep`, `emaVelocity`; SQ-27; `seatWindow`, `fitTextScale`, `seatAtEnd`, `clampScroll`; SQ-28; `grownHeight`, `growHeight`, `entryProgress`, `latchProgress`, `resetSide`; SQ-30), `HOLD_MQ`, `PHONE_MQ`, `BLURB_PEEK`, `BLURB_TEXT`, `MOMENTUM_DECAY` and `readBlurbTune` (`?blurbhold`, `?blurbpeek`, `?blurbair`, `?blurbgrow`, `?blurbtext`, `?blurbend`, `?blurbcatch`, `?blurbdecel`, `?scroll`); `blurbHold.js` also exports `attachBlurbFit(root)` (the per-page text fit), pinned by `scripts/test/blurb-hold.test.mjs` | `NextProjectBand`, `FeaturedProjectDetail` (`useBlurbHold`) |
| `keywords.jsx` | THE house rich-text grammar and ITS TWO RENDERERS (10-08). Four markers: `**bold**`, `[[keyword]]`, `[[keyword]](/href)`, `[label](/href)` — one `KW_RE` 3-way alternation, bold is capture group **6**. `renderKeywords` emits PROSE; `keywordLines(text)` emits PER-WORD TOKENS (one array per line, newline = line break) for surfaces that animate word by word, and `renderWordTokens(tokens, {wordClass, emClass, separators})` builds the shared `<mark class="kw">` markup from them. Grammar, punctuation rule and `data-kw` reading order are shared, so copy behaves the same whichever surface renders it; `separators: false` suits a surface that spaces words in CSS rather than with text (the pill's short layer). Separators are reproduced FROM THE SOURCE — a keyword's non-final fragments keep their trailing space inside the box (`white-space: pre`) with a zero-width space between, plain words keep their real space, and `a[[b]]` stays glued. `kwWipe`/`kwSet` drive the box + ink. **Switched off sitewide since 11-07 (SQ-25):** `KW_HIGHLIGHT = false`, read through `kwHighlightOn()` (`?kwhighlight=1` turns it on for one page view; SSR stays off, so that dial re-renders islands on hydration). Off, a `[[keyword]]` renders as its plain word (a linked one as a `prose-link`), no `.kw` is emitted, `kwWipe` returns 0 and `kwSet` no-ops; the markers stay in the copy and the CSS stays whole, so flipping the switch is the only step back. **Per surface (11-07 evening):** `kwHighlightOn(surface)`, `renderKeywords(text, surface)`, `kwWipe(…, { surface })` and `kwSet(root, on, surface)` take a surface's own switch in place of the sitewide one; the detail blurbs pass `KW_HIGHLIGHT_DETAIL` (on), from `BlurbCopy` and `useKeywordWipe`. `?kwhighlight` overrides every surface both ways (`0` = off everywhere). **Every capture group must be named in `stripKeywords`'s replace callback, in order**: the first `**bold**` version skipped the link-href group, shifted `bold` onto it, fell through to the keyword branch and rendered the literal string `"undefined"` into an aria-label | blurbs, `/process`, `SiteFooter`, `SiteTagline`, `SiteNav` |
| `sanityClient.js`, `queries.js` | `sanityFetch`, all GROQ; `MEDIA_FIELDS` (11-03) is the asset projection the detail query and `DIRECTORY_QUERY` share | pages, `directoryData.js` |
| `siteCopy.js` | The site-wide studio copy from the `siteSettings` singleton (10-08): `getSiteCopy()` + `SITE_COPY_FALLBACK`. **Memoizes the PROMISE, not the result**, so a 23-page build makes one request even though `BaseLayout` and `index.astro` both await it. Catches everything and degrades per FIELD to the baked copy, so a Sanity outage or a half-populated singleton cannot blank the chrome or fail the build | `BaseLayout.astro`, `index.astro`, and as the fallback import in `SiteNav` / `SiteTagline` / `SiteFooter` / `Hero` |
| `directoryData.js` | `getDirectoryData()` (11-03): the Project Directory's one fetch (`DIRECTORY_QUERY`) and its tiles (`buildDirectoryTiles`), memoized as a PROMISE for the whole build, like `getSiteCopy()`. It joins the baked logo marks
(`src/data/directory-logos.json`, keyed by `imageAssetId`, and the PNGs beside it via
`import.meta.glob`) into the tiles (11-05, SQ-13). No fallback: a rejection is dropped from the memo, so the next caller retries, and the directory page fails the build | `src/pages/work/directory.astro`, `BaseLayout.astro` (the Client Roster) |
| `clientCoverage.js` | Client Coverage and the Client Roster (pure, 11-03): `coverageOf(slug, clients)` → the slug plus every client whose affiliations name it, one hop (a label pulls in its artists, never the reverse), or `null` for an unknown slug; `toDrawerRoster(clients, tiles)` → `[{name, slug, live}]` by name, `live` when the coverage holds a tile | `BaseLayout.astro`, `DirectoryPage`, `buildDirectoryTiles` |
| `lenisTune.js`, `footerTune.js` | Bench publishers; `footerTune` also owns the reveal maths (`footerRise`, `footerSpan`), the resting-footer dials (`?footerlift`, `?footermarksfrom` / `-to` / `-lift`, `?footerintro`, `?footerslide`, `?footerslides`, `?footerslidelead`), the wheel's weight since 10-31 (`footerDamp`, Lenis's damp; `footerBrakeStep` + `FOOTER_BRAKE_TAIL`, the tail brake in closed form, so a notch and a trackpad's stream land alike; `?footerlerp` 0.165, which must equal `motion.js` `LENIS_TUNING.lerp`, a test holds it, and `?footerbrake` 0.5, both read per wheel event through `getFooterLerp()` / `getFooterBrake()`) and a per-key `ZERO_OK` set so a dialed `0` survives the seeder. `slideK` / `slideS` / `slideLeadS` are read at play time through `getFooterSlideK()` / `getFooterSlideS()` / `getFooterSlideLeadS()` and deliberately stay out of `CSS_KNOBS`, the same shape as `introS`. `bandFadeS` (`?logofademin`, 0.55 s, ZERO_OK) joins them as a paint-time read for the band's minimum fade. `slideS` exists because the slide stopped borrowing `introS` when it grew from a 1.25rem nudge to a full-reveal rise (~9× the travel). The 10-08 desktop-layout knobs go the OTHER way, into `CSS_KNOBS` as inline `<html>` properties: `topPad` → `--footer-rest-top-pad`, `tickerFoot` → `--ticker-foot-clearance`, `blurbFill` → `--footer-blurb-fill`. A token declared on an ELEMENT cannot be dialed this way (the element's own declaration beats the inherited value), which is why these three are read with `var(--knob, fallback)` on `<html>` instead | tune panels, `SiteFooter`, `global.css` |
| `touchTune.js` | The live dials for the house touch gesture (11-03): resolves `?touchgain` / `?releasems` ONCE at module load (SSR → `motion.js`'s `TOUCH_GAIN` 5 / `RELEASE_MS` 240, Nathan's 11-03 phone bake; was 2 / 160), so every rubber band reads one pair. The dials stay live "for now". The bake targets stay in `motion.js`, which must remain plain exports because it runs during SSR | `FeaturedProjects` (World Turn), `NextProjectBand`, `useProcessScrollDriver`, `Hero` (footer drag + release carry) |
