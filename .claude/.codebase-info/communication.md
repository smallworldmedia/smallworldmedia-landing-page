# Communication

*Last Updated: 2026-09-09*

No runtime API of its own: the site is static and reads Sanity at build time. Runtime communication
is between islands, via `window` CustomEvents and `<html>` attributes.

## `swm:*` window events

| Event | Dispatched by | Listened by | Payload |
|---|---|---|---|
| `swm:envelop` | `Hero.jsx`, `work/WorldCard.jsx`, benches | `RouteFill.jsx` | `{duration, color?, loader?}` |
| `swm:fill-release` | `Hero`, `FeaturedProjects`, `FeaturedProjectDetail`, `ProcessPage`, benches | `RouteFill` | — (2.5 s safety release if unclaimed) |
| `swm:fill-progress` | gesture surfaces | `RouteFill` | `{value 0..1, duration?}` |
| `swm:loader-start` | `Hero` (`?loaderlead`) | `RouteFill` | — |
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
| `data-footer-revealed`, `data-footer-invoked`, `--footer-reveal`, `--footer-lockup-h` | `SiteFooter` | footer progress; driven mode on /work |
| `data-privacy-landed` | `SiteTagline` | footer link stagger waits on it |
| `--scrollbar-w` | `SiteShell` | re-measured on `astro:after-swap` |
| `data-nav-accent*` | detail pages | project accent for `RouteFill` / `lib/navAccent.js` |
| `body.route-home` / `body.route-process` | `BaseLayout.astro` (server) | route-scoped chrome CSS, no hydration flash |
| `sessionStorage swm:hero-intro`, `swm:returnToWork` | `Hero`, layout script | intro mode; back-nav to /work |

ClientRouter wipes every `<html>` attribute on swap; persistent islands re-assert theirs on
`astro:after-swap`.

## External services

| Service | Direction | Where |
|---|---|---|
| Sanity (b60h4u7o/production) | build-time read; CLI write | `src/lib/sanityClient.js`, `scripts/lib/cms/adapters.mjs` |
| Sanity CDN images | runtime read | `globe/TextureManager.js`, media slots |
| Mux | runtime HLS + thumbnails; CLI uploads | `useHls.js`, `VideoSlotPool.jsx`, adapters |
| Netlify Forms | inquiry POST | `ProjectOverlay.jsx` + hidden mirror form in `BaseLayout.astro` |
| Google Fonts | Inter stylesheet | `BaseLayout.astro` |
