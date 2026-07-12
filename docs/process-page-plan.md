# Process Page — Build Plan

> DRAFT — grill pending.
> Phased implementation plan for the `/process` Worldbuilding experience — the v2 workstream deferred at launch (`docs/v1-launch-plan.md` F2).
> **Vocabulary:** `CONTEXT.md` § "Process Page — concepts". **Spec:** `docs/process-page-spec.md`. **Decisions:** `docs/adr/0004-process-scroll-driver.md` (+ lineage ADR-0002, ADR-0003).

## Summary

The process page walks a prospective client through how SWM builds a visual world, and the brand mark performs the walk: one persistent globe scene morphs through five **Stages** — a dark **Seed World** (discovery), a revolving trio joined by **the Thread** with one **Chosen World** (visual language), the electric-blue cascade light-up (core identity), per-panel emanation into a larger world (build-out), and looping rhythmic patterns (living world) — driven by discrete, scroll-triggered, time-domain transitions on a normal Lenis document route, closing on `start_project`. Everything is built from the home globe's primitives (`buildGlobeGeometry`, `createPanelMaterial`, `buildCascadeTimeline`) with zero textures and one route-scoped canvas.

## Architecture notes

- **Route-scoped canvas** (ADR-0002): the page is the site's third WebGL scene; full teardown with `forceContextLoss()` on nav.
- **Primitives, not forks** (ADR-0003 grammar): a new thin `useProcessScene` consumer; `useGlobeScene` stays untouched (it is fused to CMS textures, the live scheduler, and drag).
- **ScrollTrigger is scoped to this island** (ADR-0004): first use in the codebase; the bespoke accumulator remains the idiom for single-commitment viewport-locked gestures elsewhere.
- **This branch is docs-only.** Branch base = `feature/v1-launch`; the build rebases onto wherever the site's mainline sits when work starts (post-launch, that is `main`).
- **Pre-existing token gaps** are fixed at the point of first real use (P0): define `--tracking-tight: -0.02em` and `--lh-body` at `:root`, promote `--color-near-black` out of `.project-detail` scope. Also correct the stale `GAP_COLOR` comment (`globeConfig.js:88` — value is electric blue, comment says black).
- **Content prerequisite: none** — no CMS, no media. Copy ships in `src/components/process/processContent.js`.

## Phases

| # | Workstream | Status | Notes |
|---|---|---|---|
| P0 | **Route scaffold + gate** | ☐ | `process.astro` (redirect stub, `v2:` re-enable comment) + netlify forced 302 + `SITEMAP_EXCLUDE` entry + `ProcessPage.jsx` island + `route-process` body class + `processContent.js` stub + token-gap fixes. Page exists, is dark in production. |
| P1 | **Scroll-driver skeleton** | ☐ | ScrollTrigger registration (island-only) + Lenis bridge (`getLenis()?.on('scroll', ScrollTrigger.update)`, refresh on `astro:page-load`/fonts) + 5 stub sections + stage machine stub logging `goTo` states. De-risks the one novel integration before any WebGL exists. |
| P2 | **Scene core (S3–S5)** | ☐ | `useProcessScene` on the full 84-mesh globe: blue light-up (`uFallbackColor` + `uPower` cascade, `?cascade`), emanation (`mesh.scale` staggered `rows`, `?emanate`), rhythm loops (`?bpm`, equator-out delay model). The page's loudest beats land first. |
| P3 | **Trio + Thread (S1–S2)** | ☐ | Merged Seed Worlds, counterclockwise revolution, SVG Thread draw + `s2.captions` pings, winner scale-up + merged→per-panel swap, S2→S3 headline-in-silhouette + zoom-out. |
| P4 | **Copy & chrome** | ☐ | Full copy deck render, per-section OS-boot entrances, arrival choreography (`swm:fill-release` + hero sequence), CTA section (`swm:open-overlay` primary, `/work` secondary), `?debug` panel. |
| P5 | **RM / mobile / a11y / perf gate** | ☐ | `setStageInstant` stills path, native-scroll verification, device pass (≥ home-globe 42–44fps iPhone baseline), draw-call/idle budgets, focus-visible + heading audit. |
| P6 | **Launch (un-gate)** | ☐ | Nav re-add (desktop `.site-nav__links` slot at `SiteNav.jsx:253` + mobile menu item), un-gate as **one 3-file commit** (redirect line, netlify block, sitemap entry), SEO verify, acceptance checklist run. |

## Cuts (deliberate)

- **Per-stage deep links** (`#stage-03`) — cheap, decide during build; not a gate.
- **Panel media texturing** (Seed Worlds sampling client artwork) — the abstract read is the point; revisit only if the page feels too austere in P5.
- **Envelopment bridge into `/process`** — arrivals are plain nav + `swm:fill-release` insurance; a `RouteFill`-lite fade for non-passage swaps is a site-wide polish item (brand-polish audit §4.3), not this page's scope.
- **Sanity-driven copy** — no churn owner; `processContent.js` is the single source.

## Launch gate

- Acceptance checklist (spec §11) passes in full.
- Device pass green: live scene on iPhone ≥ home-globe baseline; RM path verified on-device.
- Un-gate commit reviewed against the 3-file rule; production `/process` resolves (no 302), sitemap includes it, nav links live in both menus.
- Docs updated: spec + this plan flipped to shipped status; `CONTEXT.md` terms confirmed against the built component names.
