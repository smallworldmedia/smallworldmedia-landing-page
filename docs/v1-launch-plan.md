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
| F1 | Info panel restyle | ✅ `8fe42e8` | Brand black, white text, client-name affordance removed, embed placeholder deleted. |
| F2 | Remove `process` nav link | ✅ `8fe42e8` | Removed. Process page = v2 workstream, planned separately on its own branch. |
| F3 | Home footer tagline | ✅ `8fe42e8` | `SiteFooter tagline` prop; white `--font-body`, home only. |
| F4 | Disable `/lab/globe` + `/specimen` | ✅ `8fe42e8` | Astro.redirect + forced Netlify 302, `/work/directory` pattern. |
| F5 | Static SVG nav globe | ✅ `8fe42e8` | `SWM-globe_white.svg` in nav + overlay; both gif copies deleted (−1.1MB). |
| F6 | Globe video cue tuning | ✅ `8fe42e8` | Promote at the rim (0.03) not near-center (0.12); jittered max-dwell rotation + re-live cooldown ends pole-panel slot monopoly. Knobs `?promote ?demote ?dwellmax ?cooldown`. |
| F7 | Progressive scroll-to-enter | ✅ `f99be98` | Globe lean (`?envlean`) + RouteFill pre-cover (`?envpre`, f² curve) ride the accumulator; rubber-band release; commit continues from the drag. New `swm:fill-progress` channel. |
| F8 | Home nav pills + envelopment nav choreography | ✅ `f99be98` | Pills per spec (follow_us portaled to the shell); exit + link-stagger on envelop; reverse on back-nav; steady states via `body.route-home` CSS. |
| F9 | Inquiry overlay pass | ✅ `f99be98` | Fade both ways; Flip stripped; globe mark persistent; Escape closes; wheel-under-overlay guard; hidden-form field parity (subject/replyto). **Real submission test on a deploy preview still owed.** |
| F10 | Mobile menu | ✅ `68d9a35` | Full-screen brand-black takeover off a `menu` pill at ≤768px; start_project routes through the overlay. |
| F11 | Type-token breakpoint pass | ✅ `68d9a35` | `--text-mono` 12.8→14px at ≤768px; `.fp-pager__label` lifted to 16px. |
| F12 | SEO/social baseline | ✅ `9277e27` | OG/Twitter + canonical + theme-color sitewide; brand og-image; homepage title/description; `@astrojs/sitemap` (redirect stubs + /studio filtered); robots.txt. |
| F13 | 404 page | ✅ `9277e27` | Brand gradient, return_home primary CTA. |
| F14 | Privacy page | ✅ `9277e27` | `/privacy` plain-language notice; linked from the footer copy line. |
| F15 | Pageview analytics | ☐ | Cookieless only (Netlify Analytics or Plausible) — keeps F14 true. Dashboard toggle / one script; **decide at deploy** (no code in repo yet). |
| F16 | Hygiene | ✅ `9277e27` | Skip link + `#main`, brand-font preloads (hashed via `?url` imports), `.env.example`. Focus-visible sweep rides ws6. |
| F17 | World-side deck/album mounts | ✅ `c9f15f3` | Pulled into v1 (was a cut): shared `bandLayout` geometry brain (ADR-0003) + `worldBands` WebGL consumer — display-only stacks among the Tiles, idle-cycling on the Turn curve; placeholder card badges removed. Knobs `?bands ?bandh ?bandcycle ?bandpages`. |

Descoped from Nathan's original list: **cookie pop-up** (no cookies set — sessionStorage only; revisit only if cookie-based tracking lands).

## v1 cuts (deliberate)

- **`/work/directory` disabled** (committed `adc06ab`): route redirects to `/work` (Astro meta-refresh + forced Netlify 302), nav link removed, World paging clamps at the last World. Re-enable notes live in `directory.astro`.
- ~~World-side composite mounts (orbit/deck in the World)~~ — **un-cut 2026-07-03**, shipped as F17 (`c9f15f3`).
- Carousel component, BTS section, NextProjectCard, directory dual-feeds — unchanged/deferred.
- Full year-field retirement (`mediaAsset.year` behind `coalesce`, 716 docs) — only the 5 featured projects are launch-relevant.

## Launch gate

- Orbit/deck acceptance checklist (spec) passes.
- `/work` live tier + Turn suspend verified on device.
- Envelopment + direct-load + reduced-motion entry paths all work.
- Lighthouse/perf sanity on `/`, `/work`, one heavy detail page (Bedouin).
- PR `feature/v1-launch` → `main` (supersedes the old PR-into-`develop` convention for this branch — launch goes to `main`).
