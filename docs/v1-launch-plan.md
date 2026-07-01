# v1 Launch Plan — `feature/v1-launch`

> Scope locked 2026-07-01. Goal: replace the current landing-page site — merge to `main`, deploy via Netlify.
> Specs: `docs/orbit-deck-viewer-spec.md` (orbit/deck build) · `docs/featured-projects-preview-plan.md` (P3/P5) · ADR-0002 (Envelopment) · ADR-0003 (composite math-first).

## v1 ships

| # | Workstream | Notes |
|---|---|---|
| 1 | **Lenis foundation** | Smooth scroll on document routes; `/work` excluded (owns wheel physics). |
| 2 | **Orbit/deck build** | Full `docs/orbit-deck-viewer-spec.md` build order: buildContentFlow → Grid Socket → momentum engine → BrandDeckViewer → AlbumArtOrbit + ReleaseCard. |
| 3 | **Content pass** | `releaseInfo` for Andhera + HHS Pre-2026 (35 assets, real metadata, Nathan reviews); saga → lead deck (Studio drag); finish year migration for the 5 featured projects still on legacy `year`. |
| 4 | **Live-video Near tier** on `/work` | P3 remainder — Near Tiles promote to live HLS (globe `LivePanelScheduler` reuse, ≤3 concurrent), suspend to stills during a World Turn. |
| 5 | **P5 Envelopment** | Home globe → `/work` route swap under the persistent fill (ADR-0002); `enter_world` → detail via the same bridge. ClientRouter already active in BaseLayout. |
| 6 | **Mobile + reduced-motion audit** | Device gate on `/work` + detail (globe baseline 42–44fps iPhone); RM = stills, no idle motion, native scroll. |

## v1 cuts (deliberate)

- **`/work/directory` disabled** (committed `adc06ab`): route redirects to `/work` (Astro meta-refresh + forced Netlify 302), nav link removed, World paging clamps at the last World. Re-enable notes live in `directory.astro`.
- World-side composite mounts (orbit/deck in the World) — deferred, ADR-0003 keeps them cheap.
- Carousel component, BTS section, NextProjectCard, directory dual-feeds — unchanged/deferred.
- Full year-field retirement (`mediaAsset.year` behind `coalesce`, 716 docs) — only the 5 featured projects are launch-relevant.

## Launch gate

- Orbit/deck acceptance checklist (spec) passes.
- `/work` live tier + Turn suspend verified on device.
- Envelopment + direct-load + reduced-motion entry paths all work.
- Lighthouse/perf sanity on `/`, `/work`, one heavy detail page (Bedouin).
- PR `feature/v1-launch` → `main` (supersedes the old PR-into-`develop` convention for this branch — launch goes to `main`).
