# v1 Launch Plan — `feature/v1-launch`

> Scope locked 2026-07-01. Goal: replace the current landing-page site — merge to `main`, deploy via Netlify.
> Specs: `docs/orbit-deck-viewer-spec.md` (orbit/deck build) · `docs/featured-projects-preview-plan.md` (P3/P5) · ADR-0002 (Envelopment) · ADR-0003 (composite math-first).

## v1 ships

| # | Workstream | Status | Notes |
|---|---|---|---|
| 1 | **Lenis foundation** | ✅ `1efaa37` | Smooth scroll on document routes; `/work` excluded (owns wheel physics). |
| 2 | **Composite bands build** | ✅ `cf1c4b5`→`b769935` | Shipped, then redesigned 2026-07-01 per Nathan: the 3D orbit ring is retired — one shared **BandPager** (World-Turn curve, one page per gesture) serves BrandDeckViewer + **AlbumArtViewer** (ReleaseMeta chips). Plus: sticky breadcrumb w/ gated World restore, pager client tokens. Emulated mobile + RM verified; real-device pass pending (ws 6). |
| 3 | **Content pass** | ◐ | HHS Pre-2026 `releaseInfo` ×15 **published** (all real dates; placeholder `HHS0XX` catalogs ×10 + store-search links per Nathan — accuracy pass owed; catalogs readable on the artwork). Remaining: Andhera ×20; resolve "Del Boy Disco EP" = shipped "Go Deeper EP"; saga → lead deck (Studio drag); year migration ×5. **10-09→10-27 Sanity media audit** (b60h4u7o/production, every write through `npm run cms` on Nathan's per-plan yes): labels + alt text + HHS059 + deck Branding + 5 delete plans live and verified (2161→1990 docs, Mux 346→248, 0 unused, 0 drafts); manifests reconciled one row per asset (`8fe4d71`). **10-27 detail-grid round:** true-square tiles (`TILE_SHAPE` 1, `?tileshape`, `32ec513`), album wall from 4 covers + Hurry Up Slowly covers relabelled album-art (run a01ae5d8, `d429ad1`), name/count labels off every media wall (`034a2b8`). **10-28→29:** read-only `npm run cms audit` (`ea97c2e`, `a27b34f`); legacy video references made canonical (run 761eeec7); Andhera "Afterrr EP" SoundCloud banner → `static_other` (run 68323849), so the banner wall shows its real 4.77:1 shape; audit now 0 errors. All pushed; not deployed. |
| 4 | **Live-video Near tier** on `/work` | ✅ `1bff09a` | Near Tiles promote to live HLS via `WorldLiveScheduler` + parameterized `VideoSlotPool` (≤3 concurrent, pinned 720p/540p rendition — 720p/480p since P0 `cb7b8e8`, 10-09 — dwell rotation); suspend to stills during a World Turn (the Turn = incoming still-preload window). Startups serialized — parallel first-segment fetches measured slower. Knobs: `?live` `?livedwell` `?livefade` `?liveres`. |
| 5 | **P5 Envelopment** | ✅ `c80827f` | Route swap under the persistent `RouteFill` (ADR-0002): loom entrance (globe 0.62→1 under a thinning black veil), `scroll_to_enter` primary CTA with the /work scroll-fill choreography, fill covers from t=0 of the trigger; `enter_world` → detail via the same bridge. Plus: PRIMARY/SECONDARY button components, shared `CtaArrows` + `SiteFooter`, `body.route-home` globe chrome (transparent nav, black pill, no-fill footer), scrollbar-gutter blue-band fix (`.site-shell` 100vw). Knobs: `?loom* ?env* ?entercover ?fill*`. |
| 6 | **Mobile + reduced-motion audit** | ◐ `8d39f41`→`c5915b8` | The 08-30→31 MOBILE PASS shipped (Nathan remote-reviewing the branch preview): tap-only enter_world + centered globe every breakpoint, nav-carried lockup, uncapsuled 3-line mobile tagline (menu-resident off-home), one chip family (steppers = primary prev/next, ticker next-chip, minimal status bar site-wide, white loader capsule + pct), home→/work rides the enter-tune passage + letter exits, pill open/close states + touch-hover fix, mobile tokens throughout. REMAINING = the real-hardware half: fps gate, scroll-trigger sensitivity field pass, Chrome fp-card centering repro — see memory notes. **FP pager rework: the SCALE arm is THE pager (09-07, `adb6d14` pushed)** — rounds 1–10 (`2d59980`) + Nathan's device-pass rounds 11 a–h (`860dc7a`…`8703218`: dialable falloff + ink + stagger curves, sliced axis, viewport-evaluated name caps, detent-keyed sizes, pointer on the flipper spring, mobile wall re-tier + texture-res fix, wall-clock-locked tickers HOUSE-WIDE); tape + tuner DELETED (`d6a04fd`); scale is the DEFAULT and SSR'd (`8bdb013`, `a6553b9` — no rail flash; `?pager=rail` = the legacy rail, kept only as the parked rail-arm proposal's front end); mobile chip-wipe fixed (own 520ms ease); desktop name cap 20rem. **09-07 desktop round (`b57c853`…`11be6d4` pushed):** Sanity title sub-token after the client name; fixed-width desktop box + always-rolling FILL ticker (Nathan's bake fillpxs 30 / boxgap 12 / namemax 2400 / unfill 0); every `?` dial had been DEAD since the SSR (hydration kept the server's fallbacks — now re-applied at mount); two ticker phase bugs fixed (re-phase on re-fill; the wrap re-base swapping in an unfilled clone — the COCO scroll-up case); services readout tried and DROPPED; desktop chip wipe 300ms. Spec § 09-07 in `docs/fp-pager-rework-approaches.md`; 275 tunables, `--check` PASS. Next = Nathan's next read of the preview; then retire the legacy rail code once the rail arm is dropped. **09-07 (late): client-logo ticker** — the band riding the TOP of the links footer on all three footer routes (Nathan): copy + vertical odometer word ticker (artists/promoters/labels/agencies/venues) + ONE row of 40 white-on-transparent client logos rolling one direction at a constant px/s; fades on a window over `--footer-reveal` (no second listener), animations gated on `data-footer-revealed`; `/work` retracts the footer on pager engage so the scrim never dims the row; assets static via `scripts/prep-client-logos.mjs` (intake `Client Logos/` → `src/assets/client-logos/`, Sanity later); 9 `?logo*` dials (09-08: `?logobal ?logoref` optical balance — squares up, wordmarks down). **09-08 chrome round (`b7b51fa`…`5eea54a` pushed):** ticker on THE drag + momentum engine (`src/lib/dragMomentum.js`, the globe's); home reveals the footer on scroll; footer exits MASKED (`--footer-peak`, per-frame clip of the tagline stack); tagline pill raises the footer IN PLACE (house-glide wipe, click-outside closes); one overlay wipe (`overlayWipe.js`: inquiry FLIPPED bottom-up, mobile menu, privacy); privacy = an overlay whose pill is the close; mobile footer = lockup + © group + privacy pill twins; inquiry lockup at the nav seat. Process round 1: keyword highlight wipe (`keywords.jsx`, `[[markers]]`), footer baked into the last slide, scrim full-bleed + OFF (`?scrim`), phone cards bottom-anchored, no text shadows. 286 tunables, `--check` PASS. **09-09/10 process rounds 2 + 3 (committed 10-06 on `refine/process`):** stage-01 stops being a still life — a camera TOUR that tracks a labelled shard seated on a compositional third (right of centre on desktop, high on a phone) with the establishing wide every nth leg; an ATMOSPHERIC DEPTH haze in the shared panel shader pulling each shard's fill AND black stroke toward the field colour by view depth (a colour mix, never opacity — panels stay fully opaque — and tweened to 0 across the S1→S2 connect); seeded rotation tiers (`?spinfast ?spinfastfrac`); the annotation chips promoted INSIDE the WebGL scene as canvas-textured planes at their panel's own z, so they layer by depth and shards in front cover them (the Thread's B3 move applied to type), with leaders re-aimed at the chip's centre and lengthened (`?labellead`), the house random-letter entrance replacing the scramble (`src/lib/charCut.js`, NEW), the body face, and legibility rules (seat clearance, anti-overlap, coverage yield, no repeated term); drag + flick on the field AND the globe-O (`dragMomentum.js`, touch stands down so the swipe quantizer keeps the finger); chrome cleared (`PHASE_0#` alone, bottom-right tagline retired, steppers on the centred /work seat). The house SCRAMBLE was verified identical to the FP card's PROJECT_## chip bar one `revealDelay`, unified into a token, and sped up 1.4s → 0.85s site-wide. 300 tunables, `--check` PASS, build PASS. **09-10/11 rounds 4–7 (same `refine/process` commit):** chips live for exactly one camera station (cut in on arrival, random-letter cut out on departure, no yields while held), a shard keeps its word, leader on the face, haze anchored in world depth, stations picked for novelty (`?tourshift`), labelled shards pulse dark on the house envelope (`?labelpulse`); baked `?fog` 0.56 `?fogspan` 0.7 `?labellead` 136 `?hold` 2 `?decay` 3; desktop chips capped at 4, `?labelsize` added, the establishing wide REMOVED from the tour (`?tourstops` retired) and the S1→S2 hand-off re-choreographed — tight on the Thread's first bead (`?threadtight`), a creep during the trace (`?threaddrift`), the full pull-back riding the assembly as the reveal; headless harness `scripts/process-probe.mjs` (tour + `--transition`). 304 tunables, `--check` PASS, build PASS. **10-07→10 the globe-O break round (`ebb6523`, map `9a540ca`):** the hero's globe-O breaks into the S1 belt and re-forms on the way back up, S2 rests on the connected Thread, the CTA is the last scene stage, and the field opens on black (w9c, `?opening` black is Nathan's bake). Spec `docs/process-page-spec.md`. **Folded 11-01** (merge `44fdf3e`, beside the media sequence). NEXT = Nathan's picks on the round's decisions page (every open /process call, 90 in walk order), then bake only those. |

## Next, after the globe-worlds fold (10-31)

`refine/globe-worlds` folded at `b153d8a`: the home globe's worlds (population modes, media spans,
the video diet, the fast handoff), the footer reveal and its wheel weight, and the probe and its
records (`docs/globe-worlds-plan.md`).

1. **The mobile scroll-trigger pass: top priority** (Nathan, 10-31). In his words: "tune and
   finalize the scroll interaction on mobile. Right now, it is currently requiring either way too
   much of a scroll from position 1 to position 2 or the velocity of the scroll to trigger the next
   world (or anywhere where there is that rubber band interaction being employed site-wide on
   mobile)." The rubber bands and their house constants (`src/lib/motion.js`):
   - `/work`'s World Turn (`FeaturedProjects.jsx`) and the detail page's next-project band
     (`NextProjectBand.jsx`): `SCROLL_TRIGGER_WORK_PX` 500, live as `?scroll`;
   - `/process`'s stages (`useProcessScrollDriver.js`): `SCROLL_TRIGGER_PROCESS_PX` 500, live as
     `?swipepx`;
   - the shared touch knobs, which have no dial yet: `TOUCH_GAIN` 2 (finger travel is doubled) and
     `RELEASE_MS` 160 (a pause this long rubber-bands an uncommitted swipe back).

   At a gain of 2, a 500 px trigger is 250 px of finger travel, about a third of a phone's height.
   Two traps come first. `NextProjectBand.jsx` copies the gain (`* 2`) and the pause (`STALL_MS`
   160) as literals, so it ignores a retune until it imports the house knobs (its header also still
   says `?scroll=600`). And home's footer reveal (`Hero.jsx`) reads `TOUCH_GAIN` and `RELEASE_MS`
   too, so a retune changes its drag and its release carry. The reveal itself is out of scope: it
   is a direct drag, not a commit, and Enter World is tap-only. The `/work` pager is a 1:1 scrub,
   not a rubber band: 48 px of finger per station (`SCALE_PITCH_MOBILE_PX`, live as `?detent`).
   `PAGER_DETENT_TOUCH_PX` 56 is left over from the retired tape arm and reads nowhere. Add the two
   missing dials, tune live on a real phone (the dev server's `--host` LAN address), measure both
   the distance and the velocity it takes to commit, then bake his numbers. This is ws 6's
   "scroll-trigger sensitivity field pass".
   **11-03, the dials (`4c13e4f`):** `src/lib/touchTune.js` resolves `?touchgain` and
   `?releasems` once, and all four consumers (`FeaturedProjects`, `NextProjectBand`, the `/process`
   driver, `Hero`) import it. The band's literals are gone, and the guide has a "touch gesture"
   section (tunables PASS, 415 keys). A headless touch probe on `/work` at 390 confirmed both dials,
   each against a control. It also found that the release is a wall-clock timer from the last
   *handled* move, so a main-thread stall over `RELEASE_MS` empties the fill while the finger is
   still moving (headless: every gap was over 160 ms). Measure that on the phone too. Next: Nathan
   dials on the phone.
   **11-03, the bake (Nathan: "much better"):** `TOUCH_GAIN` 5 and `RELEASE_MS` 240 in
   `motion.js` (the dials stay live "for now"), so home's footer drag, `/process` and the desktop
   wheel stall move with them. `?swipepx` 400 reads only on `/process`
   (`SCROLL_TRIGGER_PROCESS_PX`); `/work` keeps 500. `globe-probe` pins `&touchgain=2` so its
   footer calibration holds. The same round also shipped four changes:
   [PREVIOUS] wipes up (bottom edge first, on `overlayWipe`'s
   `CLIP_CLOSED_UP`) instead of unmounting at World 0. The pager chip rides the 1.7 s
   `--project-color` fade with no transition of its own while `.fp[data-turning]` (gap 0 against
   the bar, 39/255 and about 180 ms late in the negative control). A lean (`swm:fp-drag`,
   `?dragfollow`): the card and the drum preview the Turn and spring home on release, and a commit
   carries on from the leaned pose. Touch no longer drives the camera look (mouse/pen only). On
   home, zoom_in from a raised footer glides the reveal back to rest instead of snapping it.
   **Round 2, same evening (Nathan):** the wheel leans too (desktop). A finger releases on lift
   (on `touchend`, plus `touchcancel`), and a held finger keeps its fill, with no stall; the wheel's
   let-go is still the `RELEASE_MS` stall, since a wheel has no lift. `?dragfollow` 0.1 → 0.06 ("a
   little too strong"). The pulse he meant was the PAGER's: a Turn killed it and rebuilt it 500 ms
   later, because the number's white flip tweened from the accent ink. The flip is now a white
   twin of the number (`.fp-scale__peak`) faded on opacity, so the beat survives every Turn, and a
   re-arm after intent joins the clock (`joinHousePulse`). The zoom_in pulse is back as it was.
   **Round 3:** [NEXT] and [PREVIOUS] had the pager's lag, so they get the pager's fix. Their white
   charge is now a registered `--cta-charge` that transitions on the CTA lanes, and the background
   takes no transition, so it rides the accent fade. Through a Turn the label ink swaps to the
   snapping `--nav-ink`. The committing chip keeps its pin and its 1.7 s glide (`--cta-ink-fade`).
   Gap 0 against the bar at 1440 and 390, by computed style and by pixels; with the old chase lanes
   re-injected (negative control) the gap is 70–74/255 and the chip lands 0.2–1.6 s late.
   Verified headless at 390 and 1440. Touch and wheel probes must pin a long `?releasems`, because
   headless input gaps run 250–450 ms.
   **Closed 11-05:** Nathan approved it on his phone at the baked numbers (gain 5, release 240,
   `/work` 500, `/process` 400).
2. **Done.** `refine/media-sequence` (the image-cycling component, Nathan's session) did not need
   the rebase: on 11-01 it merged onto this fold's tip with `refine/process` (`e801bed`, `44fdf3e`),
   on `refine/globe-worlds`, and this branch took both as one fast-forward (`c1517e5`, pushed). On
   11-02 the side worktrees and `refine/globe-worlds` were retired. `origin/refine/globe-worlds` was
   deleted the same day, once its Sidequest tickets closed. One workstream from here: this branch,
   in the main checkout, with the dev server (`:4322 --host`) running there.
3. **Done 11-10: the type property** (Nathan, story US-3, SQ-46 and SQ-48…SQ-53, pushed at
   `6dd4b3b`). Grouped media get a type (album art, deck, banner, admat, carousel), and each type
   opens its viewer only on the surfaces listed in `GROUP_SURFACES` (`buildContentFlow.js`;
   CONTEXT.md § Group Type).
   - Carousels open as walls, and admats left /work.
   - An admat set is one wall on the project page (4 columns, 2 on a phone, animated flyers playing
     in place), one cycling tile in the directory and one panel on the globe.
   - In Sanity: the groupType backfill (5 plans) and the tour-flyer regroup `ef1d6831`. HHS 2024–25,
     HHS 2026 and Short Circuit are now admat sets.
   - The hosted Studio was redeployed. The branch preview was rebuilt 11-11 with the new data.
   - Left: Nathan's iPhone check of the HHS pages and the directory.
4. **Done 11-11: Nathan's 11-11 round** (US-4 and US-5, every piece pushed, the stream at
   `2a6576f`; `cms audit` 0 errors):
   - **US-4** (schema `b73fd3b`, sets plan `941ec0be`, code SQ-54/55/56 + `0aecd71`):
     - the carousel viewer scrolls horizontally;
     - album art is 2 columns on a phone and 4 on desktop, +50% height (/work included);
     - the admat wall is +50% height;
     - three new types: `merch` (the album-art cycler on all four surfaces), `visuals` and
       `live-footage`;
     - the COCO 2026 cleanup, with its deletes applied as `ecde6bb9`.
   - **US-5** (schema `893361b`, fixed by `54fac5d`; SQ-58, SQ-59 and `03b70f2`; fold `f25f7ae`):
     - two more types: `mockups` (a masonry wall at each piece's own aspect) and
       `flyer-progression` (a strip on the project page, a cycler on the globe and /work; the
       directory flips through both);
     - content Rounds A, B (`29e1b2d3`) and C (`71d7ccd4`, alt text, the Rossi labels,
       Short Circuit 2023) applied and verified.
   - **The manifest's `groupType` column** (`b54bf9f`) types new rows at intake.
   - **Left:**
     - redeploy the hosted Studio for the five new options;
     - ~~retire `../swm-gate-us5`~~ done;
     - ~~CONTEXT.md for `mockups` and `flyer-progression`~~ done 11-12 (`9b69f97`);
     - Nathan's iPhone check;
     - the /work album plate overflow call.
5. **Done 11-12: Nathan's 11-12 round** (US-6 and a content round, pushed with the fold
   `8a8b89d`; `cms audit` 0 errors):
   - **US-6** (SQ-63…SQ-68, gate `6e53067`, fold `8a8b89d`):
     - `/process` is off for v1: it redirects to `/` and is out of the sitemap;
     - the nav and CTA colour change rides the passage's clock on every transition;
     - the next-project band keeps its media centred while it expands;
     - `static_other` and `motion_other` cover their tile at the least-crop shape, so the six
       SoundCloud banners in the directory crop about 58%;
     - the directory's Motion/Video parent filter (the label as written, Nathan 11-12), with
       Character Design dropped;
     - the blurb's tension only on the way in.
   - **Content** (plans `bb344a63`, `b15965b6`, `70f878f1`, `ba374e6e`, `82598cb6`): House Hats
     leaves the site; the service-tag retag (Web Design, Merch Design, Illustration, Promo Video,
     Logo Design); Character Design retired; Bedouin's Instagram mockups split into three 9:16
     phones.
   - **Left:**
     - Nathan's Studio deletes of `client-house-hats` and `serviceTag-character-design` (approved
       11-12; the runner can't delete those types);
     - `?npzoom` at 1 (SQ-65) and `?homefade` at 400 ms (SQ-64);
     - Nathan's iPhone check of SQ-68.

## Finalization checklist (added 2026-07-03 — Nathan's tweaks + gap audit)

Full implementation notes in the session plan; this is the tracking list. Order: chrome fixes → interaction → mobile → launch hygiene.

| # | Item | Status | Notes |
|---|---|---|---|
| F1 | Info panel restyle | ✅ `8fe42e8` | Brand black, white text, client-name affordance removed, embed placeholder deleted. |
| F2 | Remove `process` nav link | ✅ `8fe42e8` | Removed. Process page = v2 workstream, planned separately on its own branch. **Superseded 08-29:** page shipped, nav link live, `/process` UN-GATED (`d863919` — redirect + netlify 302 + sitemap exclude all removed). |
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
| F14 | Privacy page | ✅ `9277e27` + legal fold `08cb617` | `/privacy` plain-language notice; linked from the footer copy line. **11-02:** the overlay scrolls on Lenis routes (`8f3f8cf`). **11-03 (Nathan approved):** `main`'s 10-13 legal pages (PR #42) are ported as `/privacy` and the new `/terms` (`08cb617`). The studio is off QuickBooks, so both lose the QuickBooks integration copy; privacy gains a short Clients section naming only the client-facing services (Postmark invoices, Stripe and Wise payments); the contact is `hello@smallworld.media`; both are dated November 3, 2026. `origin/main` is merged in (`919f4af`: ours on both pages, LegalLayout removed), so the launch PR into `main` can't conflict. Pushed (`4504078`). |
| F15 | Pageview analytics | ☐ | Cookieless only (Netlify Analytics or Plausible) — keeps F14 true. Dashboard toggle / one script; **decide at deploy** (no code in repo yet). |
| F16 | Hygiene | ✅ `9277e27` | Skip link + `#main`, brand-font preloads (hashed via `?url` imports), `.env.example`. Focus-visible sweep rides ws6. |
| F17 | World-side deck/album mounts | ✅ `c9f15f3` | Pulled into v1 (was a cut): shared `bandLayout` geometry brain (ADR-0003) + `worldBands` WebGL consumer — display-only stacks among the Tiles, idle-cycling on the Turn curve; placeholder card badges removed. Knobs `?bands ?bandh ?bandcycle ?bandpages`. |
| F18 | Next-project band (detail continuation) | ✅ | `NextProjectBand` at the detail-page bottom (Figma "next project card" 15:385/401/417): next project's identity + first-order media (live HLS, poster-first), the house resistance accumulator gated to the document end (arming beat `?nparm` guards a wheel's flick tail — unlike / and /work the gesture arrives mid-flight; a finger skips it since `964cf42`), the page-turn entrance (`a625165`: scrubbed from the label reaching `?npinstart`, the label slides in from the right, the window pushes out `?nplag` behind, then the client name and `?npstep` later the tags; the window hangs one grid gutter below the last row; the 11-04 sticky runway is gone), a `[Keep Scrolling]` rest hint on the house tempo (`89b75f5`), the gesture on /work's drag and release lanes, commit = Envelopment passage (`swm:envelop` → navigate → arriving mount releases) + `swm:worldIndex` sync so the breadcrumb returns to the World you rode into. Chain = /work World order, wraps last→first. Knobs `?scroll ?npms ?npcover ?nppre ?npzoom ?nparm`, the entrance's `?npinstart ?nplag ?npstep ?npbig ?nplabel` and the hint's `?nphint ?nphintin ?nphold ?npblink ?npbeat` (`?npsplit ?npfrom ?nprun ?npinsplit` retired). 21-check Playwright suite (desktop drag/release/commit, wraparound, RM, mobile stacked). |

Descoped from Nathan's original list: **cookie pop-up** (no cookies set — sessionStorage only; revisit only if cookie-based tracking lands).

## v1 cuts (deliberate)

- ~~**`/work/directory` disabled** (committed `adc06ab`): route redirects to `/work` (Astro meta-refresh + forced Netlify 302), nav link removed, World paging clamps at the last World. Re-enable notes live in `directory.astro`.~~ — **un-cut 2026-11-03** on `feature/project-directory` (folded 11-04 as `0032532`, pushed 11-05 at `4168495`; the worktree and both branches are retired): rebuilt from the detail page's grid with none of the old code; the route and the nav's `project_directory` are back on (`251e7b3`), and the drawer's client names filter it (`5c66f49`). World paging still clamps at the last World (Nathan, 11-03). Plan, status and open calls: `docs/project-directory-plan.md`.
- ~~World-side composite mounts (orbit/deck in the World)~~ — **un-cut 2026-07-03**, shipped as F17 (`c9f15f3`).
- Carousel component, BTS section, NextProjectCard — unchanged/deferred. The directory dual-feeds landed with the directory on 11-03 (one square tile per album cover, one tile per deck).
- Full year-field retirement (`mediaAsset.year` behind `coalesce`, 716 docs) — only the 5 featured projects are launch-relevant.

## Launch gate

- Orbit/deck acceptance checklist (spec) passes.
- `/work` live tier + Turn suspend verified on device.
- Envelopment + direct-load + reduced-motion entry paths all work.
- Lighthouse/perf sanity on `/`, `/work`, one heavy detail page (Bedouin).
- One dedicated media update session before launch (Nathan, 11-05): every project's missing media
  uploaded and added in one focused pass through `npm run cms` (plan, his yes to the plan id, apply,
  verify). The first known items are Munchietown's Signorvino photos and the pending client logos.
  Added 11-05, the code for each already on the stream:
  - Retag media one by one (Mode 2 `serviceType`). A project's tags are now the union of its media's
    tags (SQ-14), so Andhera, Kamino and Nusonido show fewer tags until this is done. The worksheet is from SQ-14.
  - `splitIntoThirds = true` on `mediaAsset-bedouin-brooklyn-knockdown-center-promo` (SQ-15). The
    Studio needs the new schema first: the embedded `/studio`, or `npx sanity deploy` for the hosted one.
  - DONE 11-05: the Project Directory's shuffle (`siteSettings.directoryShuffle`) is on in Sanity, on
    Nathan's yes; it reaches the site on the next deploy (SQ-12).
  - Missing artwork, from audits SQ-18 and SQ-19 and Nathan's calls of 11-05. The files are in
    `~/swm-media-audit-2026-11/` (outside the repo); `media-session/decisions.md` lists every call.
    Re-plan each item at the session, since a plan binds the revisions it read:
    - DONE 11-05, on Nathan's yes: the 20 Andhera covers are `album-art` only (re-planned as run
      09090281, applied and verified).
    - DONE 11-05, on Nathan's yes: `media-session/retag-changes.json`, 23 retags (re-planned as run
      b1b6f229, applied and verified).
    - DONE 11-05, on Nathan's yes: the other 50 Andhera media lost `2d-animation` and keep `branding` +
      `web-design` (run 0101ed38, applied and verified, 50 updated). Andhera Hero, retagged to
      `event-tour-creative` in the Studio, was not part of it.
    - `media-session/album-art-untag-changes.json`: 14 non-square pieces lose `album-art`. Nathan's rule
      (11-05) is that `album-art` goes only on 1:1 media. The same file sets his replacement tags: the
      COCO SoundCloud banners → `branding`, Sunday Brunch → `illustration`, Jeff's animated cover →
      `promo-video`, the Hurry Up Slowly IAA posts → `event-tour-creative`, and the Short Circuit press
      photos → none (checked as plan ef412f50).
    - COCO's artwork mockups and Template 2026 stay `branding` and stay off album art; they aren't
      finished covers. Finished album art in the new COCO branding comes to this session as uploads.
    - Upload the 16 release covers whose manifest rows have no Sanity document (Front Left, Heavy
      House Society, Short Circuit, WIKKA, MOONLGHT, Kamino) as `album-art`. All are 1:1. Jamback's
      "Landslide" needs a manifest first.
    - Kamino's 9 CDs (ID·1–ID·8, Stuck In The Middle) exist only as the one sheet `kamino_ids.png`
      (the "Kamino IDs" document, which stays). Export each disc square and upload it as `album-art`.
    - Kamino's photos are on hold (Nathan, 11-05): he picks the selects for Kamino's branding project
      first. That covers the LA set (19) and the fisheye set, and they go up as `branding`. A
      photo-treatment service tag is possible later, and Nathan picks the wording.
    - Munchietown's 9 photos are on hold too. They join more event clips and images in Munchietown's
      branding project, to break up the flyers.
  - The logo cleanup from SQ-13 (its `redundant-variants.json`): delete 3 twins and 3 colour
    duplicates, re-export 5 logos as clean transparents, and fix the `logo-design` tags. Then re-run
    `node scripts/prep-directory-logos.mjs` and commit `src/data`. SQ-13 itself has to fold first.
  - Upload the white PNG logos SWM made, each tagged `logo-design` (Nathan, 11-12): MOONLGHT, Kamino
    (current, pill and graffiti), Andhera, Hurry Up Slowly, Munchietown, Fletch, Imperfect Records,
    Momentum Records, One Of Us, Louder Than Silence. Since 11-12, `logo-design` on Heavy House
    Society and TOBEHONEST is only their white logo, and Hurry Up Slowly and MOONLGHT have none until
    theirs land.
  - Every name in the info drawer's Client Roster links to its work in the Project Directory (Nathan,
    11-13: "link and connect all client names / affiliations to the correct media so that all client
    names in the info panel link to media in the project directory"). A name is live when its
    coverage holds a directory tile (`src/lib/clientCoverage.js`). On 11-13 ten names covered none:
    Annabel Englund, Audiojack, Circus Music, D'Witches, Easier Said, HOME//GRXWN, Helix Records,
    Malóne, Panorama360 and Ultra Records, plus Cristoph once his client lands (11-13 plan). DJ Tennis
    is live through Munchietown. Each dead name takes one of three routes:
    - **A label, manager or parent:** an affiliation on each child client
      (`docs/project-directory-plan.md` §6). Nathan names the children, for example "HOMEGRWXN ←
      Rossi.".
    - **A collaborator on another client's piece** (Cristoph on Kamino's Falling visualizer, Anabel
      Englund on Kamino's Belong To Me album art and 4x5): an affiliation would pull the whole
      client's work under the name, so this needs a per-piece field, `mediaAsset.collaborators[]` as
      client refs, which coverage counts. Nathan's go 11-13 ("let's go ahead and proceed with the
      affiliations"). It is a hashed-schema edit, so it goes schema, then data, then code, and the
      schema lands alone.
    - **Its own work uploaded:** Malóne's client folder is gone (Nathan, 11-13: "I've deleted the
      client folder for Malone so I'm going to have to pull our work from instagram"). He pulls the
      work from Instagram, then it goes up under `client-mal-ne`. Malóne is not linked to One Of Us's
      ThereAfter pieces (Nathan, 11-13: "Malone does not go with thereafter").
  - Last, and on its own: retire `project.services`. It is a hashed-schema edit, so it lands alone.
- `npm run cms audit` on b60h4u7o/production before every deploy: 0 errors, and every
  label-ratio finding either fixed or recorded in `media/_audit-accepted.json`, with
  no stale entries. This is the mislabel guard (`docs/cms-workflow.md` § Dataset
  audit); the 10-09 runtime ratio-trust guard was closed in its favour on 10-29.
- PR `feature/v1-launch` → `main` (supersedes the old PR-into-`develop` convention for this branch — launch goes to `main`).
