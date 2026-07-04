# v1 Launch Plan — `feature/v1-launch`

> Scope locked 2026-07-01. Goal: replace the current landing-page site — merge to `main`, deploy via Netlify.
> Specs: `docs/orbit-deck-viewer-spec.md` (orbit/deck build) · `docs/featured-projects-preview-plan.md` (P3/P5) · ADR-0002 (Envelopment) · ADR-0003 (composite math-first).

## v1 ships

| # | Workstream | Status | Notes |
|---|---|---|---|
| 1 | **Lenis foundation** | ✅ `1efaa37` | Smooth scroll on document routes; `/work` excluded (owns wheel physics). |
| 2 | **Composite bands build** | ✅ `cf1c4b5`→`b769935` | Shipped, then redesigned 2026-07-01 per Nathan: the 3D orbit ring is retired — one shared **BandPager** (World-Turn curve, one page per gesture) serves BrandDeckViewer + **AlbumArtViewer** (ReleaseMeta chips). Plus: sticky breadcrumb w/ gated World restore, pager client tokens. Emulated mobile + RM verified; real-device pass pending (ws 6). |
| 3 | **Content pass** | ◐ | HHS Pre-2026 `releaseInfo` ×15 **published** (all real dates; placeholder `HHS0XX` catalogs ×10 + store-search links per Nathan — accuracy pass owed; catalogs readable on the artwork). Remaining: Andhera ×20; resolve "Del Boy Disco EP" = shipped "Go Deeper EP"; saga → lead deck (Studio drag); year migration ×5. |
| 4 | **Live-video Near tier** on `/work` | ✅ `1bff09a` | Near Tiles promote to live HLS via `WorldLiveScheduler` + parameterized `VideoSlotPool` (≤3 concurrent, pinned 720p/540p rendition, dwell rotation); suspend to stills during a World Turn (the Turn = incoming still-preload window). Startups serialized — parallel first-segment fetches measured slower. Knobs: `?live` `?livedwell` `?livefade` `?liveres`. |
| 5 | **P5 Envelopment** | ✅ `c80827f` | Route swap under the persistent `RouteFill` (ADR-0002): loom entrance (globe 0.62→1 under a thinning black veil), `scroll_to_enter` primary CTA with the /work scroll-fill choreography, fill covers from t=0 of the trigger; `enter_world` → detail via the same bridge. Plus: PRIMARY/SECONDARY button components, shared `CtaArrows` + `SiteFooter`, `body.route-home` globe chrome (transparent nav, black pill, no-fill footer), scrollbar-gutter blue-band fix (`.site-shell` 100vw). Knobs: `?loom* ?env* ?entercover ?fill*`. |
| 6 | **Mobile + reduced-motion audit** | ☐ | Device gate on `/work` + detail (globe baseline 42–44fps iPhone); RM = stills, no idle motion, native scroll. Emulated RM/mobile already green — this is the real-hardware pass. |

## Finalization checklist (added 2026-07-03 — Nathan's tweaks + gap audit)

Full implementation notes in the session plan; this is the tracking list. Order: chrome fixes → interaction → mobile → launch hygiene.

| # | Item | Status | Notes |
|---|---|---|---|
| F1 | Info panel restyle | ☐ | Cream → brand black, white text; remove client-name click affordance (they're spans, not links); delete Unicorn Studio embed placeholder box. |
| F2 | Remove `process` nav link | ☐ | Dead `href="#"` in SiteNav. Process page = v2 workstream, planned separately on its own branch. |
| F3 | Home footer tagline | ☐ | "Visual Worlds for the Music Industry", white, `--font-body`, in place of the footer globe mark — home only. |
| F4 | Disable `/lab/globe` + `/specimen` | ☐ | Same redirect pattern as `/work/directory`. |
| F5 | Static SVG nav globe | ☐ | `SWM-globe_white.svg` replaces the 1.1MB gif in nav + inquiry overlay; delete gif copies. |
| F6 | Globe video cue tuning | ☐ | `PROMOTE_SCORE` 0.12 too late; lower rows (40° pitch) never cross it. Earlier promote + fairness check. |
| F7 | Progressive scroll-to-enter | ☐ | Globe scale + RouteFill blue track the scroll accumulator pre-threshold (mirror /work pager resistance); solid fill exactly at navigate. |
| F8 | Home nav pills + envelopment nav choreography | ☐ | `start_project` pill top-right, `follow_us` pill bottom-right on home; pills exit / navbar items slide in on commit. |
| F9 | Inquiry overlay pass | ☐ | Clip-wipe → opacity fade; strip inert GSAP Flip; persistent top-left globe (no blink on close); Netlify Forms parity + real submission test. |
| F10 | Mobile menu | ☐ | Full-screen takeover off a `menu` pill at ≤768px (links currently just `display:none`). |
| F11 | Type-token breakpoint pass | ☐ | No responsive token overrides exist; `.fp-pager__label` (client names) ~12.8px at mobile. Pairs with F10. |
| F12 | SEO/social baseline | ☐ | **Launch blocker.** OG/Twitter tags, og:image (1200×630), homepage title/description props, canonical, `@astrojs/sitemap`, robots.txt, theme-color. |
| F13 | 404 page | ☐ | `src/pages/404.astro`, brand-styled. |
| F14 | Privacy page | ☐ | Replaces cookie pop-up — site sets zero cookies, no consent banner legally required. Covers form-data usage; footer link. |
| F15 | Pageview analytics | ☐ | Cookieless only (Netlify Analytics or Plausible) — keeps F14 true. Dashboard/one-script; decide at deploy. |
| F16 | Hygiene | ☐ | Skip link, font preload, `.env.example`, focus-visible pass on new chrome. |

Descoped from Nathan's original list: **cookie pop-up** (no cookies set — sessionStorage only; revisit only if cookie-based tracking lands).

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
