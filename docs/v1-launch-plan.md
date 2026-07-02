# v1 Launch Plan — `feature/v1-launch`

> Scope locked 2026-07-01. Goal: replace the current landing-page site — merge to `main`, deploy via Netlify.
> Specs: `docs/orbit-deck-viewer-spec.md` (orbit/deck build) · `docs/featured-projects-preview-plan.md` (P3/P5) · ADR-0002 (Envelopment) · ADR-0003 (composite math-first).

## v1 ships

| # | Workstream | Status | Notes |
|---|---|---|---|
| 1 | **Lenis foundation** | ✅ `1efaa37` | Smooth scroll on document routes; `/work` excluded (owns wheel physics). |
| 2 | **Composite bands build** | ✅ `cf1c4b5`→`b769935` | Shipped, then redesigned 2026-07-01 per Nathan: the 3D orbit ring is retired — one shared **BandPager** (World-Turn curve, one page per gesture) serves BrandDeckViewer + **AlbumArtViewer** (ReleaseMeta chips). Plus: sticky breadcrumb w/ gated World restore, pager client tokens. Emulated mobile + RM verified; real-device pass pending (ws 6). |
| 3 | **Content pass** | ◐ | HHS Pre-2026 `releaseInfo` ×15 **published** (all real dates; placeholder `HHS0XX` catalogs ×10 + store-search links per Nathan — accuracy pass owed; catalogs readable on the artwork). Remaining: Andhera ×20; resolve "Del Boy Disco EP" = shipped "Go Deeper EP"; saga → lead deck (Studio drag); year migration ×5. |
| 4 | **Live-video Near tier** on `/work` | ☐ | P3 remainder — Near Tiles promote to live HLS (globe `LivePanelScheduler` reuse, ≤3 concurrent), suspend to stills during a World Turn. |
| 5 | **P5 Envelopment** | ☐ | Home globe → `/work` route swap under the persistent fill (ADR-0002); `enter_world` → detail via the same bridge. ClientRouter already active in BaseLayout. |
| 6 | **Mobile + reduced-motion audit** | ☐ | Device gate on `/work` + detail (globe baseline 42–44fps iPhone); RM = stills, no idle motion, native scroll. Emulated RM/mobile already green — this is the real-hardware pass. |

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
