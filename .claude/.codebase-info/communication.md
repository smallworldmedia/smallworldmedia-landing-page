# Communication

*Last Updated: 2026-10-07*

No runtime API of its own: the site is static and reads Sanity at build time. Runtime communication
is between islands, via `window` CustomEvents and `<html>` attributes.

## `swm:*` window events

| Event | Dispatched by | Listened by | Payload |
|---|---|---|---|
| `swm:envelop` | `Hero.jsx` (its reduced-motion paths too, `duration: 0`), `work/WorldCard.jsx`, `work/detail/FeaturedProjectDetail.jsx` (the breadcrumb back, in the project colour), benches | `RouteFill.jsx` | `{duration, color?, loader?}` (Hero sends the globe world's colour under the population modes; `loader` is now only a fallback trigger) |
| `swm:fill-release` | `Hero`, `FeaturedProjects` (after an Enter World snap, only once the snapped card commits), `FeaturedProjectDetail`, `ProcessPage`, benches | `RouteFill` | — (2.5 s safety release if unclaimed) |
| `swm:fill-progress` | gesture surfaces | `RouteFill` | `{value 0..1, duration?}` |
| `swm:loader-start` | `Hero`, `?loaderlead` ms after the 0.2 s Enter World chrome exit | `RouteFill` (fades the bar up over 0.3 s; ignored under RM) | — |
| `swm:enter-world` | `WorldCard`; `EnterTunePanel`/`TextTunePanel` (dry run) | `work/world/useWorldScene.js` (enter ramp), `FeaturedProjects` (arms `textExit`) | — |
| `swm:fp-freeze` | `pager/GraticulePager.jsx` | `useWorldScene` (halts render + decode while engaged) | `{on}` |
| `swm:footer-reveal` / `swm:footer-close` | tagline pill via `SiteFooter` consts | `Hero`, `FeaturedProjects` footer accumulator | progress |
| `swm:open-overlay` | Hero CTA, ProcessPage CTA | `SiteShell` | — |
| `swm:open-privacy` / `swm:privacy-state` | privacy pill, mobile menu / `PrivacyOverlay` | `PrivacyOverlay` / `SiteShell` | `{open}` |
| `swm:hero-chrome`, `swm:hero-lockup-done`, `swm:tagline-exit` | `Hero` | `SiteNav`, `HeroLabels`, `SiteTagline` | — |
| `swm:process-step` / `-home` / `-index` | `ProcessStepCtas`, driver, `DetailProgressBar` | `useProcessScrollDriver`, `useProcessCopy` | step deltas / index |

Rule: dispatches that cross into a persistent island are `requestAnimationFrame`-deferred so the
resulting tweens are not adopted by a dying gsap context (see `patterns.md`).

## `<html>` / `<body>` latches

| Attribute or var | Owner | Meaning |
|---|---|---|
| `data-chrome-open` | `SiteShell` | drawer, inquiry, or privacy open |
| `data-menu-open` | `SiteNav` | the mobile menu is open; with `data-chrome-open` and `data-footer-revealed` it tells `SiteTagline` home is not at rest |
| `data-footer-revealed`, `data-footer-invoked`, `data-footer-in`, `--footer-reveal`, `--footer-peak`, `--footer-rise`, `--footer-rise-peak`, `--footer-span`, `--footer-panel-h`, `--footer-lockup-h` | `SiteFooter` (one writer: `broadcastReveal` / `clearReveal`) | footer progress; driven mode on /work. `--footer-reveal` / `--footer-peak` are absolute 0..1 (the peak ratchets and holds through a retreat); `--footer-rise` / `--footer-rise-peak` are the same travel **normalized against the resting floor** — 0 in the mobile home's resting pose, 1 at a full reveal — over `--footer-span` = 1 − rest, so `rise × span × --footer-panel-h` is the panel's own climb in px and a consumer never needs to know `?footerrest` (`lib/footerTune.js` `footerRise` / `footerSpan`). `--footer-panel-h` is the measured panel height, now published from driven mode too. `data-footer-in` is the on-load entrance's ground, removed on every bail path, so **absence means visible** |
| `data-footer-rest`, `--hero-lift` | latch: `Hero.jsx`; var: derived in `styles/global.css` | the mobile home's resting-footer variant — the footer is already part-revealed, so `SiteTagline` reads this to know home is not at rest, and the hero rides the reveal. `--hero-lift` = `--footer-rise × --footer-lift-k × --footer-span × --footer-panel-h`, defined only under this latch (0 under reduced motion) and applied as `translate: 0 calc(var(--hero-lift) * -1)` to the globe, its stroke, the labels, the lead column and the fill |
| `--footer-lift-k`, `--footer-marks-from`, `--footer-marks-to`, `--footer-marks-lift` | `lib/footerTune.js` (fallbacks in `global.css`) | the resting footer's dials, seeded from `?footerlift` / `?footermarksfrom` / `?footermarksto` / `?footermarkslift` and written live by `?footertune=1`; each bake lives in both places (`FOOTER_TUNE_DEFAULTS` mirrors every `var(…, fallback)`) |
| `data-privacy-landed` | `SiteTagline` | footer link stagger waits on it |
| `--scrollbar-w` | `SiteShell` | re-measured on `astro:after-swap` |
| `data-nav-accent*` | detail pages | project accent for `RouteFill` / `lib/navAccent.js` |
| `html.fp-tint` / `html.pop-tint`, `--project-color*` | `lib/navAccent.js` (`applyNavAccent(…, { tint })`: /work → `fp-tint`, home under the population modes → `pop-tint`; `clearNavAccent` drops both, RouteFill on route-home / route-process) | chrome wears the accent; the classes carry the 1.7 s colour fade |
| `body.route-home` / `body.route-process` | `BaseLayout.astro` (server) | route-scoped chrome CSS, no hydration flash |
| `sessionStorage swm:hero-intro`, `swm:returnToWork`, `swm:enterWorld` | `Hero`, layout script | intro mode; back-nav to /work; the Enter World handoff (below) |

ClientRouter wipes every `<html>` attribute on swap; persistent islands re-assert theirs on
`astro:after-swap`.

## Scene → island subscriptions

`globe/useGlobeScene.js`'s api `onWorldChange(cb)` (branch `refine/globe-worlds`) reports each world
the PopulationDirector puts on the globe as `{slug, color, animate}` and replays the latest world to
a late subscriber. `Hero.jsx` subscribes: it applies `pop-tint` and keeps the colour for its
`swm:envelop` dispatches. On unmount it clears the tint only if `pop-tint` is still on `<html>`, so
it never clobbers /work's `fp-tint` after a swap.

## Enter World handoff (home → /work)

Branch `refine/globe-worlds`, `?popenter=1` (the default). At the Enter World click `Hero.jsx` calls
the scene api's `popHold()`, which is `PopulationDirector.hold()`: no new change starts, and a change
already in flight lands. It then writes `sessionStorage['swm:enterWorld']` = the slug of the world on
the globe (the `onWorldChange` world, else `getFocusProject()`) before `navigate('/work')`, on the
passage and on the RM path. `FeaturedProjects.jsx` consumes the key once on mount, ahead of the
`swm:returnToWork` restore, and snaps to that World through `snapRef` (see `modules.md`). It
dispatches `swm:fill-release` only once the snapped card commits. The RM paths cover too (an instant
`swm:envelop` in the world's colour), so World 0's server-rendered card never shows.

The detail breadcrumb back (`FeaturedProjectDetail.jsx` `goBackToWork`) arms `swm:returnToWork`,
covers in the project's colour for 0.6 s, then navigates; the restore arms `snapRef` too, so the
return is the same snap (no Turn, the fill held until the card). Under RM it is an instant cover and
a plain link.

## Stats globals

Scene → bench / probe reads, polled (no events). `window.__swmPopStats` is published ~2 Hz by
`globe/PopulationDirector.js` whenever `?popmode` ≠ off (not `?debug`-gated; branch
`refine/globe-worlds`): the world and its `slug` (what Enter World hands /work), the change clock
(`phase`, `holdLeft`, `next`, `transition`; `held` once Enter World stops it), its colour, and video
decodes vs the tiles they light (`streams`, `liveTiles`), and the name strips: how many are visible
(`nameTiles`), where this world placed them (`namePlaced`, measured off the live scene at the
change) and where each one actually renders (`nameSlices`, per strip `{lo, hi, w, vk}` in tape-u
after the pole-pinch compensation — the probe's slice and stillness gates read this). It is read by
`hero/PopTunePanel.jsx`'s readout and `scripts/globe-probe.mjs`. The `?debug`-gated `/work` globals
are listed in `docs/tunables-guide.md`.

## External services

| Service | Direction | Where |
|---|---|---|
| Sanity (b60h4u7o/production) | build-time read; CLI write | `src/lib/sanityClient.js`, `scripts/lib/cms/adapters.mjs` |
| Sanity CDN images | runtime read | `globe/TextureManager.js`, media slots |
| Mux | runtime HLS + thumbnails; CLI uploads | `useHls.js`, `VideoSlotPool.jsx`, adapters |
| Netlify Forms | inquiry POST | `ProjectOverlay.jsx` + hidden mirror form in `BaseLayout.astro` |
| Google Fonts | Inter stylesheet | `BaseLayout.astro` |

Sanity's image CDN enforces the project's CORS allowlist on images, and every WebGL texture load is
`crossOrigin` (`globe/TextureManager.js`, `work/world/useWorldScene.js`,
`work/world/fpDrumWall.js`). On the list (eight entries, verified 2026-10-07 via the Sanity MCP
`cors_origins_list`): localhost:4321, :4322, :3333 and :4330, 127.0.0.1:4399, the LAN host
192.168.1.19:4322 (phone testing over `astro dev --host`), smallworld.media, and Netlify deploy
previews (`*--smallworldmedia-landingpage.netlify.app`). Any other origin gets a 403, so its stills
render as black tiles — a fresh port, a different LAN address and the bare `.netlify.app` all fail
that way. Add an origin (`add_cors_origin`, project b60h4u7o) rather than moving the preview to a
dead port.
