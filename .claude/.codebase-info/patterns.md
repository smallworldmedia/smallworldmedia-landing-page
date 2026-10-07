# Patterns & Doctrine

*Last Updated: 2026-10-07*

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

Globe tiles: `globe/tileSwap.js` is the one refcount-safe way to put an asset on a tile (`loadTile`,
`heldThumbId` ownership). A tile's asset changes only where its screen shows no media (the parked
pole, a blink to black, a blue surge, a cut), never through a cross-dissolve. A population-mode
world change defaults to the tide: `MeridianScroll.advance()` surges the scroll one full span, so the
next world arrives row by row from the top pole. Client-name strips are PLACED, not scrolled: `planNames()`
picks their tiles once per world change against the live camera, `placeNames()` only reconciles the cover-fit
uniforms per frame, and the horizontal ticker is gone. `panelMaterial.js` stays untouched, so its pole pinch
(`vK = sin(thetaC)`) is compensated CPU-side in `nameTicker.js` (`namePinch` / `nameWindow` / `nameRendered`).

Accent: `lib/navAccent.js` is the one writer of `--project-color*` and the tint class. Home's globe
world colour (`pop-tint`) reuses /work's path (`fp-tint`) rather than a second set of chrome rules.

## Tunables and tune panels
- Idiom: module-level `PARAMS = new URLSearchParams(location.search)` (null on server) with
  `num(key, fallback)` / `str()` helpers seeding a **mutable `TUNING` object read at use time**, so
  sliders move the live scene. Panels emit `copy_url` with only non-default values; dialed values are
  then baked into `*_DEFAULTS`.
- Benches are URL-gated and lazily `import()`ed in an effect so SSR and first client render stay
  byte-identical: `?lenistune`, `?footertune`, `?herotune`, `?committune`, `?entertune`, `?texttune`,
  `?scrimtune`, `?fp1tune`, `?poptune`, `?debug` (process), `?fpgrid=1|2|3`, `?pager=rail`. Phone-sized
  benches start collapsed to a one-line chip (`?debug` process, `?deckdebug`, `?poptune`).
- Inventory: `docs/tunables-guide.md` (319 keys). After adding/renaming/baking a param run
  `node scripts/tunables-keys.mjs --check` and update the doc. The extractor reads a fixed set of
  idioms, popConfig's `stateKey: ['param', reader]` tuple maps among them. A new reading style needs a
  regex there, or `--check` passes blind: P2's move from a `PARAM_KEYS` map to tuple maps hid 15 of
  the 16 pop keys until the tuple regex landed.
  Same-key collisions across routes and `?lenistune=1` silently reverting the Lenis bake are known traps.
  A seeder's `n > 0` guard also swallows a legal dialed `0`: `footerTune.js` carries a per-key `ZERO_OK` set rather
  than relaxing the guard for every key, because `?footerlift=0` is the one way to ask whether a parallax is
  carrying anything.

## Rendering traps (learned)
- Element `opacity < 1` composites a `backdrop-filter` over the sharp original: fade the background
  alpha, hold opacity 1.
- Animating an inherited `@property` custom property does not repaint text/SVG consumers: snap the
  var and transition color/fill element-locally.
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
- Never probe a dev server straight after `npm run build`: the two share `node_modules/.vite`, the
  build rewrites the optimized-deps cache, and the running `astro dev` then answers modules with 504
  "Outdated Optimize Dep" — the probe times out on the canvas while the tests and the build itself
  report green. Probe the built output instead: `npx astro preview --port 3333` with
  `GLOBE_PROBE_BASE=http://localhost:3333`.
- `globe-probe --footer` is the only scenario in the repo that GESTURES (a real touch scrub, forced
  mobile at 390×844). Footer-reveal geometry — the panel's climb against the hero's lift, the marks'
  crossing of the fold, the hold through a retreat — is measured there rather than argued from
  arithmetic.
- Real-device feel (touch gain, scroll triggers) is tuned live via `astro dev --host`, never blind.
- CMS: `npm run test:cms` before touching `scripts/lib/cms/`.

## Error handling & config
- Site build has no secrets; CMS CLI reads process env lazily and fails closed on schema drift.
- Reduced motion: every canvas has an `rm` path (static globe, no video pool, snapped text).
