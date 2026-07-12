# Process Page — Build Plan

> Grilled & solidified 2026-07-12.
> Phased implementation plan for the `/process` page — the v2 workstream deferred at launch (`docs/v1-launch-plan.md` F2).
> **Vocabulary:** `CONTEXT.md` § "Process Page — concepts". **Spec:** `docs/process-page-spec.md`. **Decisions:** `docs/adr/0004-process-scroll-driver.md` (+ lineage ADR-0002, ADR-0003).

## Summary

The process page walks a prospective client through how SWM builds a visual world, and the brand mark performs the walk: one persistent scene morphs through five **Stages** — a belt of drifting **Fragments** (discovery), **the Thread** connecting the dots until the Fragments pull inward and construct **the Core** (visual language), the electric-blue `rows` cascade light-up (core identity), per-panel emanation into a larger world (build-out), and `?bpm`-anchored rhythmic pattern loops (living world) — driven by discrete, scroll-triggered, time-domain transitions on a normal Lenis document route, closing on `start_project`. Everything is built from the home globe's primitives (`buildGlobeGeometry`, `createPanelMaterial`, `buildCascadeTimeline`) with zero textures and one route-scoped canvas; the belt and the globe are the same 84 panel meshes.

## Architecture notes

- **Route-scoped canvas** (ADR-0002): the page is the site's third WebGL scene; full teardown with `forceContextLoss()` on nav.
- **Primitives, not forks** (ADR-0003 grammar): a new thin `useProcessScene` consumer; `useGlobeScene` stays untouched (it is fused to CMS textures, the live scheduler, and drag).
- **ScrollTrigger is scoped to this island** (ADR-0004): first use in the codebase; the bespoke accumulator remains the idiom for single-commitment viewport-locked gestures elsewhere.
- **This branch is docs-only.** Branch base = `feature/v1-launch`; the build rebases onto wherever the site's mainline sits when work starts (post-launch, that is `main`).
- **Pre-existing token gaps** are fixed at the point of first real use (P0): define `--tracking-tight: -0.02em` and `--lh-body` at `:root`, promote `--color-near-black` out of `.project-detail` scope. Also correct the stale `GAP_COLOR` comment (`globeConfig.js:88` — value is electric blue, comment says black).
- **Deterministic scatter:** the Fragment belt reuses the seeded PRNG utilities (`mulberry32`/`hashSeed`) from `src/components/work/world/seededLayout.js` — same belt every visit, no `Math.random` in the scene.
- **Content prerequisite: none** — no CMS, no media. Copy ships in `src/components/process/processContent.js`.

## Phases

| # | Workstream | Status | Notes |
|---|---|---|---|
| P0 | **Route scaffold + gate** | ✅ `4fd1e4f` | `process.astro` (redirect stub, `v2:` re-enable comment; dev stays viewable for tuning) + netlify forced 302 + `SITEMAP_EXCLUDE` entry + `ProcessPage.jsx` island + `route-process` body class + full `processContent.js` deck + token-gap fixes (values mirror PR #13 — either merge order resolves identical). Page exists, is dark in production. |
| P1 | **Scroll-driver skeleton** | ✅ `83be9e3` | ScrollTrigger registration (island-only) + Lenis bridge (`getLenis()?.on('scroll', ScrollTrigger.update)`, refresh on `astro:page-load`/fonts) + symmetric `[top 60%, bottom 60%]` section boundaries + mid-page arrival sync + stage machine stub logging `goTo` states. |
| P2 | **Scene core (S3–S5)** | ✅ `80d6553` | `useProcessScene` on the full 84-mesh globe: blue light-up (`uFallbackColor` + `uPower` cascade, `?cascade`), emanation (`?emanate` on `?emanateorder`), rhythm loops (`?bpm`, equator-out delay model). `panelDelay` exported from `cascade.js` per spec §3. See Build notes: `PULSE_MIN` deviation. |
| P3 | **Fragments + Thread + assembly (S1–S2)** | ✅ `f88e958` | Seeded belt scatter + drift (`seededLayout.js` PRNG exports), Thread chain draw + `s2.captions` pings, drift damping on connect, pull-in assembly (scatter→home transforms, inner-sphere reveal), zoom-out. Shard geometry re-baked to local origin (position/quaternion = placement/tumble; home = `centerDir·R·k`). RM stage-02 still = connected belt, Thread pre-drawn. |
| P4 | **Copy & chrome** | ✅ `8d321b3` | Full copy deck render, per-section OS-boot entrances (0.7× leave-back exits), arrival choreography (`swm:fill-release` + hero sequence + `materializeBelt`), CTA section (`swm:open-overlay` primary, `/work` secondary), `?debug` panel — upgraded to **live tuning** in the follow-up commit: sliders/selects mutate the shared `TUNING` object (scene reads it at use-time), `↻ replay` re-runs the current stage's transition, `copy_url` serializes the dialed feel. Feel extras beyond §9: `?idlepower` `?pulsemin` `?s3fill` `?s45fill`. |
| P5 | **RM / mobile / a11y / perf gate** | ☐ | `setStageInstant` stills path, native-scroll verification, device pass (≥ home-globe 42–44fps iPhone baseline), draw-call/idle budgets, focus-visible + heading audit. RM paths + ≤90 draw calls (84–85 measured) already verified headless; **the real-device pass needs local hardware**. |
| P6 | **Launch (un-gate)** | ☐ | Nav re-add (desktop `.site-nav__links` slot at `SiteNav.jsx:253` + mobile menu item), un-gate as **one 3-file commit** (redirect line, netlify block, sitemap entry), SEO verify, acceptance checklist run. |

## Build notes (2026-07-12, P0–P4)

- Built on `claude/load-session-rkxhn0` — based on the PR #14 docs branch tip (`feature/v1-launch` + these docs; v1 had not merged to `main` at build time). Each phase verified with headless-WebGL Playwright suites (pixel-sampled stage states, boundary walks both directions, RM stills, teardown context release).
- **Deviation — S5 pulse dips (`PULSE_MIN` 0.7):** spec §3's `uPower 1.0 ↔ 1.12` over-brighten pulse is invisible on lit panels — pure `0x0000ff` saturates blue at power 1 (textures gave the home flicker its headroom). The pulse dips first (the visible traveling wave), keeping 1.12 as the peak.
- **Review flag — S3 rest reads as a solid orb:** lit panel color == gap/inner-sphere color, so the settled Core is a featureless blue disc — arguably the literal "goes solid" beat. If grading wants structure separated, the spec's documented `uTintColor/uTintMix` fallback stands.

## Cuts (deliberate)

- **Per-stage deep links** (`#stage-03`) — cheap, decide during build; not a gate.
- **Three-globe trio ("Seed Worlds")** — cut in the grill (2026-07-12): presenting three candidate worlds implies SWM always pitches three concepts. Replaced by the Fragment belt → Thread → Core assembly: one unified concept built from what the client gives us.
- **Panel media texturing** (Fragments sampling client artwork) — the abstract read is the point; revisit only if the page feels too austere in P5.
- **Envelopment bridge into `/process`** — arrivals are plain nav + `swm:fill-release` insurance; a `RouteFill`-lite fade for non-passage swaps is a site-wide polish item (brand-polish audit §4.3), not this page's scope.
- **Sanity-driven copy** — no churn owner; `processContent.js` is the single source.

## Launch gate

- Acceptance checklist (spec §11) passes in full.
- Device pass green: live scene on iPhone ≥ home-globe baseline; RM path verified on-device.
- Un-gate commit reviewed against the 3-file rule; production `/process` resolves (no 302), sitemap includes it, nav links live in both menus.
- Docs updated: spec + this plan flipped to shipped status; `CONTEXT.md` terms confirmed against the built component names.
