# Patterns & Doctrine

*Last Updated: 2026-09-09*

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
bugs. Footer exits are masked via `--footer-peak`, never faded.

## Tunables and tune panels
- Idiom: module-level `PARAMS = new URLSearchParams(location.search)` (null on server) with
  `num(key, fallback)` / `str()` helpers seeding a **mutable `TUNING` object read at use time**, so
  sliders move the live scene. Panels emit `copy_url` with only non-default values; dialed values are
  then baked into `*_DEFAULTS`.
- Benches are URL-gated and lazily `import()`ed in an effect so SSR and first client render stay
  byte-identical: `?lenistune`, `?footertune`, `?herotune`, `?committune`, `?entertune`, `?texttune`,
  `?scrimtune`, `?fp1tune`, `?debug` (process), `?fpgrid=1|2|3`, `?pager=rail`.
- Inventory: `docs/tunables-guide.md` (285 params). After adding/renaming/baking a param run
  `node scripts/tunables-keys.mjs --check` and update the doc. Same-key collisions across routes
  and `?lenistune=1` silently reverting the Lenis bake are known traps.

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
  truth. Never click top-center to blur ([PREVIOUS] sits there). `scripts/pager-probe.mjs` embodies this.
- Real-device feel (touch gain, scroll triggers) is tuned live via `astro dev --host`, never blind.
- CMS: `npm run test:cms` before touching `scripts/lib/cms/`.

## Error handling & config
- Site build has no secrets; CMS CLI reads process env lazily and fails closed on schema drift.
- Reduced motion: every canvas has an `rm` path (static globe, no video pool, snapped text).
