# Communication

*Last Updated: 2026-10-08*

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
| `data-footer-revealed`, `data-footer-invoked`, `data-footer-in`, `--footer-reveal`, `--footer-peak`, `--footer-rise`, `--footer-rise-peak`, `--footer-span`, `--footer-panel-h`, `--footer-lockup-h` | `SiteFooter` (one writer: `broadcastReveal` / `clearReveal`) | footer progress; driven mode on /work. `--footer-reveal` / `--footer-peak` are absolute 0..1 (the peak ratchets and holds through a retreat); `--footer-rise` / `--footer-rise-peak` are the same travel **normalized against the resting floor** — 0 in the mobile home's resting pose, 1 at a full reveal — over `--footer-span` = 1 − rest, so `rise × span × --footer-panel-h` is the panel's own climb in px and a consumer never needs to know `?footerrest` (`lib/footerTune.js` `footerRise` / `footerSpan`). `--footer-panel-h` is the measured panel height, now published from driven mode too. `data-footer-in` is the on-load entrance's ground, removed on every bail path, so **absence means visible**. `--footer-slide` is a transient companion: px, present only while the resting panel's first-load rise plays, tweened to 0 and then removed, so a consumer must treat absence as 0 (its `var()` fallback). Its armed value is the panel's whole resting reveal by default, i.e. the panel starts flush at the fold |
| `--footer-band-p` | `SiteFooter` (`paintBand`, its own rAF) | the band's rise gated by a minimum-fade clock, `min(--footer-rise-peak, elapsed / ?logofademin)`. Consumers read `var(--footer-band-p, var(--footer-rise-peak, 1))` so absence degrades to the ungated rise |
| `data-footer-settling` | `SiteFooter` (set in `armFooterEntrance` beside `--footer-slide`; cleared by `settleOdometer()` from BOTH the entrance timeline's `onComplete` and `dropSlide()`) | the on-load entrance is still playing, so the band's word odometer HOLDS on its first word (10-08). It deliberately rides `--footer-slide`'s exact lifecycle, which already owns every bail path, and **absence means running** — a throw, a dead chrome beat or no JS leaves the roll cycling rather than frozen. Exactly one consumer: `html[data-footer-settling] .logo-ticker__odo-col { animation-play-state: paused }` in `global.css`, which sits BELOW the `html[data-footer-revealed] … { running }` rule and beats it on SOURCE ORDER at equal specificity — a real edit hazard, keep it below. `.logo-ticker__spectrum` is deliberately NOT gated: its roll is a hard-hold `steps(1, end)` colour flip, where a stalled frame reads as one slightly long hold rather than a jump (see `patterns.md` for why the roll stalls at all) |
| `data-footer-seen` | `SiteFooter` (`markFooterSeen`, mirrored to `sessionStorage 'swm:footer-seen'` and re-asserted on `astro:after-swap`) | the visitor has revealed the footer in full at least once this tab. A SESSION latch, deliberately distinct from `--footer-rise-peak`, which resets 1 → 0 the frame the panel parks on its floor because the marks' at-rest hint has to be able to return. The band's resting veil ramps on the channel and is then held up by the latch |
| `--footer-blurb-em` | `SiteFooter` (nowrap clone, re-measured on `document.fonts.ready`) | the blurb's width in em, the divisor of the one-line fill. CSS falls back to the hand-measured em (55.722 for the current copy), so SSR and a no-JS load are correct |
| `--swm-pulse-reps`, `--footer-rest-top-pad`, `--ticker-foot-clearance`, `--footer-blurb-fill` | `ClientLogoTicker` `rootDial()` / `footerTune` `CSS_KNOBS` | inline dials on `<html>`: the spectrum's sweeps per half note, and the three desktop resting-footer layout knobs. All are read as `var(--knob, fallback)` so absence is the shipped bake |
| `data-footer-rest`, `--hero-lift` | latch: `Hero.jsx`; var: derived in `styles/global.css` | the mobile home's resting-footer variant — the footer is already part-revealed, so `SiteTagline` reads this to know home is not at rest, and the hero rides the reveal. `--hero-lift` = `--footer-rise × --footer-lift-k × --footer-span × --footer-panel-h`, defined only under this latch (0 under reduced motion) and applied as `translate: 0 calc(var(--hero-lift) * -1)` to the globe, its stroke, the labels, the lead column and the fill |
| `--footer-lift-k`, `--footer-marks-from`, `--footer-marks-to`, `--footer-marks-lift` | `lib/footerTune.js` (fallbacks in `global.css`) | the resting footer's dials, seeded from `?footerlift` / `?footermarksfrom` / `?footermarksto` / `?footermarkslift` and written live by `?footertune=1`; each bake lives in both places (`FOOTER_TUNE_DEFAULTS` mirrors every `var(…, fallback)`) |
| `data-privacy-landed` | `SiteTagline` | footer link stagger waits on it |
| `--scrollbar-w` | `SiteShell` | re-measured on `astro:after-swap` |
| `data-nav-accent*` | detail pages | project accent for `RouteFill` / `lib/navAccent.js` |
| `html.fp-tint` / `html.pop-tint`, `--project-color`, `-2`, `-fg`, `-text`, `-on-black`, `--project-globe-filter` | `lib/navAccent.js` (`applyNavAccent(…, { tint })`: /work → `fp-tint`, home under the population modes → `pop-tint`; `clearNavAccent` drops both, RouteFill on route-home / route-process) | chrome wears the accent; the classes carry the 1.7 s colour fade. The published list IS the contract — `--project-color-on-black` (the YIQ≥140 binary flip to white, so a dark accent inks pure white rather than gliding hue) was computed but unpublished until 10-08, and it must stay an UNREGISTERED custom property: registering it would resolve it to an initial-value and make it interpolable, reopening the paint trap. The privacy pill reads it through `--pill-ink-on-black` |
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

## Server frontmatter → island props

Astro frontmatter runs at build time only, so a module-level value it sets is visible on the SERVER
alone: an island's client bundle re-imports the module fresh and hydrates with the build-time
default. For `transition:persist` islands that is not a one-frame flash but the pose the chrome keeps
for the visit. **So build-time content reaches an island as SERIALIZED PROPS, never a module lookup.**

The site-wide copy (10-08) is the case to copy from. `BaseLayout.astro` is the fetch site because all
nine pages route through it, `/privacy` and `/404` included, and it threads `siteCopy` down two
chains — to `SiteTagline` (persistent) and through `SiteShell` → `InfoPanel` → `SiteNav`. The footer
blurb takes a third, `index.astro` → `LandingPage` → `Hero` → `SiteFooter` (as `blurb`), because the
footer hangs off Hero rather than the layout. Both entry points `await getSiteCopy()`, which memoizes
its PROMISE, so the whole build still makes one request. Every consumer keeps
`siteCopy?.field || SITE_COPY_FALLBACK.field` so a missing field degrades to the baked copy at the
point of use rather than anywhere upstream. See `architecture.md` (Data Flow) for the fetch itself.

## External services

| Service | Direction | Where |
|---|---|---|
| Sanity (b60h4u7o/production) | build-time read; CLI write | `src/lib/sanityClient.js`, `src/lib/siteCopy.js` (every route), `scripts/lib/cms/adapters.mjs` |
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
