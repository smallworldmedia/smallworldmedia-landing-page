# Patterns & Doctrine

*Last Updated: 2026-10-08*

## GSAP + ClientRouter
- Plugins registered at module top (`useGSAP, ScrollTrigger, CustomEase, Flip, ScrambleTextPlugin`).
  Components use `useGSAP({scope, dependencies})`; only `Hero.jsx` and `work/WorldCard.jsx` touch
  `gsap.context` directly.
- Scene loops ride `gsap.ticker` with internal FPS gates. Never call `gsap.ticker.fps()`: the ticker
  is shared with the persistent shell.
- Soft navs wipe every `<html>` attribute. Persistent islands re-assert on `astro:after-swap`
  (`SiteShell` scrollbar width, `RouteFill` nav accent, `SiteNav` current link, `SiteTagline` cuts,
  `PrivacyOverlay` close). Route-scoped setup uses `astro:page-load`.
- Navigate across a swap with `setTimeout` + `navigate()`, never `gsap.delayedCall`; the island's
  gsap context dies with the swap and would take the call with it. Cross-island dispatches into
  persistent islands are rAF-deferred so their tweens are not adopted and reverted at unmount.
- `client:only` islands: element refs captured in mount effects go stale under dev hydration churn;
  query the DOM lazily at animation-fire time.

## The commit-curve idiom
One linear master proxy (`raw.p` 0→1, `ease:'none'`), each channel remapped through its own clamped
window (`seg()` + `powInOut()`). Used by `Hero.beginEnvelopment`, `work/world/enterTune.js` and the
FP→detail passage, so home→/work and /work→detail share one vocabulary (`moveStart/moveEnd/pow`).
Motion taste: no overshoot, steep launch carrying scroll momentum, smooth decel into rest.

## Gesture model
The house accumulator quantizer (px threshold, ×2 touch gain, rubber band, one commitment per
gesture) appears in the Hero commit, the /work World Turn (`FeaturedProjects.jsx`), and
`process/useProcessScrollDriver.js`. Pager input is `work/pager/usePagerGesture.js`; skins render
only, and only `requestGoTo` fires a Turn. Every landing commits unconditionally so stale deferrals
are cancelled.

## One-place motion
`src/lib/dragMomentum.js` (drag + inertia), `src/lib/overlayWipe.js` (overlay wipe, never a fade),
`src/lib/scramble.js` / `charCut.js` (text arrival). New surfaces consume these; forked numbers are
bugs. Footer exits are masked via `--footer-peak`, never faded — anything that fades on the way IN
rides the peak's rest-normalized twin `--footer-rise-peak`, so a retreat slides the mask back over
it instead of fading it out on screen (`communication.md`). `lib/dragMomentum.js` takes
`drag: false` for an ambient-only engine (no pointer listeners at all), which is how the phone
home globe hands the gesture back to the page.

Hard-hold motion is its own family: `steps(1, end)`, where every keyframe segment HOLDS its start
value and jumps at the end, so nothing interpolates. It runs the FP pager scrim grain
(`work/scrimNoise.js`), the globe panel grain's jitter clock (`globe/panelGrain.js`), the odometer,
and the footer band's "full spectrum" pulse (`.logo-ticker__spectrum`). Musical timing is a token,
not a magic duration: `calc(240s / var(--swm-bpm, 127))` is two half notes at 127 BPM (1.88976 s),
the first stepping five `--swm-cycle-*` frames at 10% each, the second holding `--ink-muted`. A
CSS-keyframed ink pulse animates the ELEMENT'S OWN `color`, which is what keeps it clear of the
`@property` paint trap below.

An always-on CSS animation on persistent chrome must be gated, not merely off-screen: ship it
`animation-play-state: paused` and join an existing release group rather than inventing a latch —
the spectrum pulse joins the odometer's `html[data-footer-revealed] { animation-play-state: running }`
rule, so a 5 Hz text repaint cannot run beside the `/work` WebGL world or while the footer panel is
parked. `prefers-reduced-motion` resolves to `animation: none` plus the flat resting ink.

Globe tiles: `globe/tileSwap.js` is the one refcount-safe way to put an asset on a tile (`loadTile`,
`heldThumbId` ownership). A tile's asset changes only where its screen shows no media (the parked
pole, a blink to black, a blue surge, a cut), never through a cross-dissolve. A population-mode
world change defaults to the tide: `MeridianScroll.advance()` surges the scroll one full span, so the
next world arrives row by row from the top pole. Client-name strips are PLACED, not scrolled: `planNames()`
picks their tiles once per world change against the live camera, `placeNames()` only reconciles the cover-fit
uniforms per frame, and the horizontal ticker is gone. `panelMaterial.js` stays untouched, so its pole pinch
(`vK = sin(thetaC)`) is compensated CPU-side in `nameTicker.js` (`namePinch` / `nameWindow` / `nameRendered`).

Posing a tile means writing BOTH halves. `buildGlobeGeometry` seeds every panel's `centerDir` at the
canonical equator and leaves the driver to rewrite it per frame, so a tile's latitude is only true once
something has posed it — and the shader uniform and `centerDir` are two separate writes. Stamping only
`uPolarTop` yields a tile that LOOKS right and reads `|y| = 0` to the scheduler's score, the name band
and the prominence sort. That shipped: `useGlobeScene`'s initial layout stamped the uniform alone, so
the first world's name strip was placed against an all-equator globe and landed on the pole row at
`|y|` 0.968 — four-times-condensed type for the whole opening hold, with `?popnameband` inert because
the filter saw every row as admissible. Hence `poseTile()`: one export, both writes, plus the `parked`
flag. Any new consumer of row latitude goes through it. The matching probe lesson: a placement-time
assertion is only as honest as the pose it measured, which is why `globe-probe`'s `namesInBand` passed
throughout. The band is now also gated on what is INKED — `namesLiveInBand` over frames with
`nameTiles > 0`, against the same limit with no allowance for the row's poleward travel, since an
allowance wide enough to cover one world relaxes the limit to `|y|` 0.969 and swallows the defect.

Grain is the same one-place rule across surfaces: the globe's panel static is not a lookalike of the FP
pager scrim's, it IS that recipe, imported from `work/scrimNoise.js`. A second turbulence recipe for the
same look would be a bug. Where the grain must NOT inherit a surface's distortion, it samples the
surface's own compensated UV rather than inventing a second correction — `panelGrain.js` reads
`panelMaterial`'s `mUv`, so the no-warp guarantee is the media path's, reused.

Accent: `lib/navAccent.js` is the one writer of `--project-color*` and the tint class. Home's globe
world colour (`pop-tint`) reuses /work's path (`fp-tint`) rather than a second set of chrome rules.

## One grammar, two renderers (marked copy)
Rich text in this repo is a MARKED PLAIN STRING, never Portable Text — `**bold**`, `[[keyword]]`,
`[[keyword]](/href)`, `[label](/href)`, parsed by `src/lib/keywords.jsx`. One vocabulary covers
`project.description`, `/process` copy and (since 10-08) the `siteSettings` fields, so moving copy
into the CMS needed no schema machinery and no new dependency.

Two renderers sit over that one parser, and which one a surface uses is a real decision:
- `renderKeywords(text)` → PROSE nodes. For anything set as a paragraph.
- `keywordLines(text)` → PER-WORD TOKENS, one array per line (a newline IS a line break), drawn by
  `renderWordTokens(tokens, {wordClass, emClass, separators})`. For surfaces that animate word by
  word — the footer blurb, the tagline pill, the mobile menu — which need the words BEFORE the
  markup, not nested inside it. `separators: false` suits a surface that spaces words in CSS rather
  than with text.

Both share the grammar, the punctuation rule and the `data-kw` reading order, so copy behaves the
same wherever it is rendered. Separators are reproduced FROM THE SOURCE: a keyword's non-final
fragments carry their trailing space inside the box (`white-space: pre`) with a zero-width space
between them as the break opportunity, plain words keep their real space, and `a[[b]]` stays glued.

**Emphasis must be a marker, not a position.** The Medium cut used to be a line index (`EM_LINE`)
and a word count (`LONG_EM_WORDS`) in `SiteTagline`. That works exactly until someone rewords the
line, which is the whole point of putting copy in a CMS — so `**bold**` was added and all three
baked word-arrays were deleted.

Three traps this grammar has already sprung:
- **Name every capture group, in order.** `stripKeywords`'s replace callback skipped the link-href
  group when `**bold**` was added, which shifted `bold` onto it; the match fell through to the
  keyword branch and rendered the literal string `"undefined"` into an aria-label.
- **`.kw__ink` is an `aria-hidden` DUPLICATE of the word** — the wipe is a MASK, not a colour tween
  — so raw `textContent` doubles every keyword. Anything asserting on prose must strip the ink
  layers first.
- **A marker is only half a feature — the class it emits has to be styled.** `renderKeywords` emits
  `<b class="kw-em">` for `**bold**`, but `.kw-em` had no rule anywhere, so prose `**bold**` would
  have set at the browser's default 700 instead of the house `--weight-medium` (found 10-08 while
  matching the drawer blurb to the footer, before any copy used the marker through this renderer).
  The footer escaped it only because `renderWordTokens` lets a caller pass its own `emClass`. Fixed
  in ONE place — `.kw-em` in `global.css` — so the marker means the same weight on every surface.

## A highlight needs a colour AND a driver
Two separate things, and they fail differently. The COLOUR fails soft: `--kw-bg` / `--kw-ink` are
per-surface tokens with no inherited value, but `kw`'s own `var()` fallbacks hold the house pair
(electric blue box, white ink), so an unbound surface still looks right. Binding them is for the
surfaces that want something else — `project-detail.css` points them at `--project-color` /
`--project-color-fg`, `process.css` flips the pair per `data-bg` field — or, on the footer blurb, to
put the house pair in one declared, dialable place rather than leaving it to a fallback.

The DRIVER fails hard. `.kw__box` rests at `scaleX(0)` and `.kw__ink` at a fully-clipped inset, so a
keyword is INVISIBLE until something wipes it: markers on a surface with no `kwWipe`/`kwSet` render
as legible text with no highlight, and nothing in the markup looks wrong.

Where the driver is guaranteed (a scroll-triggered entrance that always runs) the resting state is
fine. The footer blurb is the case where it is NOT: its entrance plays once per session
(`entranceShown`), skips under reduced motion, and never runs without JS. So `global.css` binds the
two tokens on `.site-footer__blurb` and rests the box OPEN and the ink unclipped there, making the
degraded state "the highlight is simply present", and `playFooterEntrance` winds them back with
`kwSet(blurb, false)` — inline styles outrank the resting rule — before appending `kwWipe` to the
SAME timeline as the words, so a reverse retracts it in kind. Reduced motion takes
`kwSet(blurb, true)`.

## Tunables and tune panels
- Idiom: module-level `PARAMS = new URLSearchParams(location.search)` (null on server) with
  `num(key, fallback)` / `str()` helpers seeding a **mutable `TUNING` object read at use time**, so
  sliders move the live scene. Panels emit `copy_url` with only non-default values; dialed values are
  then baked into `*_DEFAULTS`.
- Benches are URL-gated and lazily `import()`ed in an effect so SSR and first client render stay
  byte-identical: `?lenistune`, `?footertune`, `?herotune`, `?committune`, `?entertune`, `?texttune`,
  `?scrimtune`, `?fp1tune`, `?poptune`, `?debug` (process), `?fpgrid=1|2|3`, `?pager=rail`. Phone-sized
  benches start collapsed to a one-line chip (`?debug` process, `?deckdebug`, `?poptune`).
- A knob is only half-landed until it has a bench row. The 8 `?popgrain*` knobs currently have URL
  params and `tunables-guide.md` rows but NO rows in `hero/PopTunePanel.jsx`, so they dial by URL only.
- A tier-split default reads as ONE knob: `GLOBE_STROKE_FRAC` resolves `IS_MOBILE ? 5 : 6`, and a single
  `?globestroke` overrides BOTH tiers (the `?grainsize` convention) rather than exposing two params.
- Inventory: `docs/tunables-guide.md` (333 keys). After adding/renaming/baking a param run
  `node scripts/tunables-keys.mjs --check` and update the doc. The extractor reads a fixed set of
  idioms, popConfig's `stateKey: ['param', reader]` tuple maps among them. A new reading style needs a
  regex there, or `--check` passes blind: P2's move from a `PARAM_KEYS` map to tuple maps hid 15 of
  the 16 pop keys until the tuple regex landed.
  Same-key collisions across routes and `?lenistune=1` silently reverting the Lenis bake are known traps.
  A seeder's `n > 0` guard also swallows a legal dialed `0`: `footerTune.js` carries a per-key `ZERO_OK` set rather
  than relaxing the guard for every key, because `?footerlift=0` is the one way to ask whether a parallax is
  carrying anything.
- `footerTune.js` also splits its knobs by who reads them: `CSS_KNOBS` are mirrored to `<html>` custom
  properties, while a knob the JS reads at play time (`introS`, `slideRem`, `slideLeadS`) stays out of
  that map and is exposed through a getter instead. Adding a play-time knob to `CSS_KNOBS` publishes a
  var nothing consumes.

## Rendering traps (learned)
- Element `opacity < 1` composites a `backdrop-filter` over the sharp original: fade the background
  alpha, hold opacity 1.
- Animating an inherited `@property` custom property does not repaint text/SVG consumers: snap the
  var and transition color/fill element-locally.
- A surface whose `transform` string is rewritten imperatively every frame cannot also be tweened on
  `transform`: use the individual `translate` / `rotate` / `scale` properties, which pre-multiply, so
  the two compose. `SiteFooter.jsx`'s `paint()` owns the panel's whole transform in both modes, so the
  resting panel's first-load slide rides `translate: 0 var(--footer-slide)` (the same reason
  `--hero-lift` uses it). Layout-box reads (`offsetHeight`, `ResizeObserver`) ignore `translate`, so
  `--footer-panel-h` is unaffected.
- When a surface sits under a derived `opacity`, the veil outranks the ink. `.logo-ticker` is
  `opacity: var(--lt-p)`, clamped from `--footer-peak` against `--logo-reveal-from/-to`, which is
  0.633 at the resting footer: relighting the copy's ink alone moved composited contrast only
  1.43:1 → 2.80:1, while lifting the veil got the shipped 4.61:1. Measure the
  composite, not the token — and a 2D-canvas pixel sample, because `getComputedStyle().color` on a
  `color-mix()` reports `oklab(...)` and a naive RGB parse of it reads as black. Under
  `[data-footer-rest]` that veil is now a RAMP, not a constant: `--logo-rest-op` (0.4) is its floor
  and `--footer-rise-peak` carries it to 1, so the band is dim until the visitor first scrolls it up
  (10-08). Contrast is therefore a function of pose — at the 0.4 floor the lead-in reads 1.61:1 and
  pure white tops out at 3.66:1, which is the cost of the dim rest.
- **A CSS keyframe animation is only immune to main-thread jank if Chrome COMPOSITES it**, and an
  ancestor whose `opacity` changes every frame prevents that. `.logo-ticker` is `opacity: var(--lt-p)`,
  recomputed from `--footer-band-p`'s rAF, so the odometer column repaints on the main thread despite
  its own `will-change: transform` — and the on-load entrance is the busiest window the page has
  (globe boot, the entrance timeline, and `--footer-slide` written to `<html>` every frame). Measured
  at 1440×900: one 1555 ms frame in which `animation.currentTime` advanced 583 ms and the painted
  transform did not move, then a frame that took 1272 ms of clock at once and stepped `translateY`
  0 → -31.78px — a whole word, in one frame. That is a reported "gets caught and then snaps into
  place". It was also INVISIBLE for most of that window, because `[data-footer-in]` hides
  `.logo-ticker__copy`, so it was spending main-thread budget unseen and arriving mid-step when the
  copy faded in. **For a word-indexed roll the house answer is to HOLD it through the busy window,
  not to phase-lock it.** The repo's three other CSS tickers DO phase-lock against wall clock with a
  negative `animation-delay` (`project-detail.css:256`, `ProjectOverlay.jsx:152`,
  `GraticulePager.jsx:690`) because they are continuous marquees where phase is noise; a five-word
  odometer is meant to start on word 0, so `SiteFooter` pauses it on `[data-footer-settling]`
  instead (`communication.md`). Pausing also restates no value, so nothing can drift from the
  keyframes — and the sibling `.logo-ticker__spectrum` is left running on purpose, since a hard-hold
  `steps(1, end)` flip degrades to one long hold rather than a jump.
- A second animation can GATE a first one without restating its values. `.logo-ticker__spectrum`
  runs `swm-spectrum-walk` (the 5-hue sweep) and `swm-spectrum-gate` (the half-note hold on
  `--ink-muted`) on the same `color`. The gate is declared LAST and **has no `0%` keyframe on
  purpose**: an implicit 0% resolves to the *underlying value* — the walk — so under `steps(1, end)`
  the walk shows through for the first half note and the gate takes over at 50%. Adding a `0%` to
  the gate would silently kill the walk for the whole cycle. Verified in Blink 151 and WebKit 26.5.
  The rejected alternative, gating with `-webkit-text-fill-color: currentColor`, works in Blink and
  collapses to a flat muted phrase in WebKit — i.e. invisible on every iPhone.
- **The brand sans is NOT preloaded; its fallback IS.** `BaseLayout.astro:107-108` preloads
  `PPNeueMontreal-Book/Medium`, but `ABC Areal` — first in both `--font-headline` and `--font-body`
  (`global.css:178,184`), 181 KB, `font-display: swap` — is discovered only from the stylesheet, so a
  cold first paint can land on the preloaded fallback and then reflow. This is why `SiteFooter`'s
  `--footer-blurb-em` gates on the blurb's own computed first family via `document.fonts.check`/`load`
  rather than on `document.fonts.ready` alone. NOT acted on (10-08) — flagged to Nathan, since
  swapping the preloads is a bandwidth call, not a correctness one. It was ruled OUT as the cause of
  the odometer stall above: the face was ready at 174–660 ms, the stall at ~3490 ms.
- A `button.class` reset with `font: inherit` outranks `.class` size rules: keep resets at class
  specificity.
- Resize: `lib/settleResize.js` `settleDebounce` — cheap per-event work, expensive re-solves after settle.

## Verification
- Motion/layout changes are verified on screen (Playwright at 1440 and 390), not by build success.
- Headless Chromium starves `/work`'s main thread: launch with `--use-angle=swiftshader
  --enable-unsafe-swiftshader`, wait ~250 ms before reading state, treat `.fp.is-pager-engaged` as
  truth. Never click top-center to blur ([PREVIOUS] sits there). `scripts/pager-probe.mjs` embodies this;
  `scripts/globe-probe.mjs` shares its launch doctrine for the home globe.
- Probe output paths: derive them with `fileURLToPath(import.meta.url)`. `new URL(import.meta.url).pathname`
  percent-encodes the Dropbox path's spaces and mkdirs a stray `Small%20World%20Media` tree beside the
  real one. Both probes are fixed on `refine/globe-worlds` (d4f471c); until that merges,
  `feature/v1-launch`'s `pager-probe.mjs` still needs `--out`.
- Pixel reads on the dev server: remove `astro-dev-toolbar` first. It sits bottom-centre over the
  page (globe-probe's `--paint` does this).
- Timing a route arrival: polling from Node starves under SwiftShader (3 samples in 3.2 s missed
  the /work arrival). Record in the page instead, with a MutationObserver + rAF logger on `window`,
  which survives a ClientRouter soft nav (globe-probe's `--enter` does this).
- Previews of the production build: serve them on an allowlisted port (localhost:4321, :4322, :3333
  or :4330). Sanity's image CDN 403s any other origin, so WebGL stills go black (`communication.md`).
- Never probe a dev server straight after `npm run build` IN THE SAME WORKTREE: the two share that
  worktree's `node_modules/.vite`, the build rewrites the optimized-deps cache, and the running
  `astro dev` then answers modules with 504 "Outdated Optimize Dep" — the probe times out on the canvas
  while the tests and the build itself report green. Probe the built output instead:
  `npx astro preview --port 3333` with `GLOBE_PROBE_BASE=http://localhost:3333`.
  The blast radius is one worktree: each has its OWN real `node_modules` (not a symlink), so a build in
  a second worktree cannot disturb a dev server running in the first. That is the way to gate a revision
  while a live `--host` session keeps serving a phone.
- `scripts/globe-probe.mjs` defaults `BASE` to `http://localhost:4322`. Pin `GLOBE_PROBE_BASE`, or it
  silently measures whatever dev server happens to hold that port instead of the tree under test — and
  pin `GLOBE_PROBE_OUT` to keep shots out of the tree being gated.
- `globe-probe --footer` is the only scenario in the repo that GESTURES (a real touch scrub, forced
  mobile at 390×844). Footer-reveal geometry — the panel's climb against the hero's lift, the marks'
  crossing of the fold, the hold through a retreat — is measured there rather than argued from
  arithmetic.
- Driving the reveal from a desktop probe: park the pointer mid-viewport BEFORE
  `page.mouse.wheel` — Playwright's pointer starts at (0, 0), where the wheel event never reaches
  Hero's `addDelta` — and wheel DOWN (`+120`); up leaves the band on its 0.4 floor with
  `--footer-band-p` at 0, which reads exactly like a broken fade. The desktop resting variant is also
  NOT the desktop default (`FOOTER_REST_MOBILE` applies ≤768px), so a desktop run must pass
  `?footerrest=0.62`.
- Screenshot the VIEWPORT, not an element taller than the fold. Playwright stitches unpainted
  compositor content for the off-screen part, which reads as a solid block of the page's accent — a
  convincing-looking render bug that is not there. Confirm with `elementFromPoint` before believing a
  shot.
- **Assert the invariant, not a number the content decides.** Two fill gates hard-coded the width
  where the blurb stops wrapping; shortening the copy moved it ~115px and correct behaviour started
  failing. Derive it from the live measurement (`--footer-blurb-em`, the fill dial) instead. Same
  rule for prose: compare against a clone with the `aria-hidden` `.kw__ink` layers stripped, since
  raw `textContent` doubles every keyword.
- Real-device feel (touch gain, scroll triggers) is tuned live via `astro dev --host`, never blind.
- CMS: `npm run test:cms` before touching `scripts/lib/cms/`.

## Error handling & config
- Site build has no secrets; CMS CLI reads process env lazily and fails closed on schema drift.
- Reduced motion: every canvas has an `rm` path (static globe, no video pool, snapped text).
