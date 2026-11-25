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
     - two more types: `mockups` (a masonry wall at each piece's own aspect; since SQ-154, 11-24, one full-width horizontal strip) and
       `flyer-progression` (a strip on the project page, a cycler on the globe and /work; the
       directory flips through both);
     - content Rounds A, B (`29e1b2d3`) and C (`71d7ccd4`, alt text, the Rossi labels,
       Short Circuit 2023) applied and verified.
   - **The manifest's `groupType` column** (`b54bf9f`) types new rows at intake.
   - **Left:**
     - ~~redeploy the hosted Studio for the five new options~~ done 11-13, with SQ-83;
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
     - ~~Nathan's Studio deletes of `client-house-hats` and `serviceTag-character-design`~~ done
       by Nathan in Studio, 11-12 evening;
     - `?npzoom` at 1 (SQ-65) and `?homefade` at 400 ms (SQ-64);
     - Nathan's iPhone check of SQ-68.
6. **Done 11-13: Nathan's 11-12 evening and 11-13 rounds** (SQ-70…SQ-83 folded, pushed at
   `59a3119`; `cms audit` 0 errors, 4 warnings):
   - **11-12 evening** (pushed at `b8dad33`):
     - SQ-70: the open info drawer pushes home down in lockstep, and `zoom_in` closes it first;
       the drawer's blurb is `siteSettings.infoBlurb`;
     - SQ-72: a split hero plays its first third;
     - logo tiles fit their mark;
     - the socket walls sit still;
     - Studio's Featured Project Assets lists album art.
   - **11-13 code:**
     - SQ-73: a split video is three directory tiles;
     - 2D/3D Animation renamed to 2D/3D Motion (slugs kept);
     - SQ-76: per-piece `collaborators[]` count toward the Client Roster;
     - the runner deletes a client (Panorama360);
     - SQ-74: a large-screen tier at 1920 px and up;
     - SQ-77: only a user scroll kicks the walls;
     - SQ-78 and SQ-82: rigid square album art and flush-grid demotion;
     - SQ-79: deck pages load from a width ladder;
     - SQ-80: PREVIOUS / NEXT read the neighbour's client name;
     - SQ-81: absolute logo ink;
     - the SoundCloud icon centred on the social row;
     - SQ-75: the /work pager simplified (skin only);
     - SQ-83: "Hide from site" (schema `295f4c5`, hash `4df34a46`; hosted Studio redeployed).
   - **Content:**
     - COCO pre-2026 track previews; Kamino × Cristoph Falling;
     - HHS 2026 release previews and rows;
     - two Kamino covers;
     - the manifests follow Nathan's 11-13 Studio deletes;
     - the HHS 2026 visuals loop is the new hero, a 3-minute cut (`a06c8823`, `5ec51db3`);
     - the HHS047 leftover is deleted (`cfa01e49`);
     - the four Pacha NYC composites are hidden from the site (`d162e316`, found by SQ-84).
     - Harvested: swm 1.109.10.
   - **Left:**
     - ~~the three files Nathan's 11-13 Studio deletes left behind (two Kamino images, one Sidney
       Charles Mux video), deleted by plan on his word~~ deleted 11-14 with plan `0bb1b1ae`;
     - when the Pacha NYC pieces come back;
     - the iPhone check of SQ-75 and SQ-80.
7. **Done 11-15: Nathan's 11-14 round** (US-7, SQ-85…SQ-93, and his 11-14 notes; pushed at
   `d2815a9`; `cms audit` 0 errors, 2 warnings):
   - **US-7, the colour schemes** (waves 1 and 2 pushed on 11-14, wave 3 with this push):
     - SQ-85: `colorScheme.js` decides the scheme (project, black, blue, spectrum), latched on
       `html[data-scheme]` before paint;
     - SQ-86: the scheme probe (`scripts/scheme-probe.mjs`);
     - SQ-87 and SQ-92: the corner pager that switches the scheme (circular swatches, no text);
     - SQ-88: the black and blue schemes in `scheme.css`;
     - SQ-89: the spectrum deal, a build-time colour key per featured project (`data-spectrum`);
     - SQ-90 and SQ-91: the home globe and the /work Worlds recolour live; the /work grid under
       black starts at `?schemegrid` 0.12 (lightened to 0.16 on 11-17);
     - SQ-93: the spectrum skin, the color-ref.png palette as ribbons on black.
   - **His 11-14 notes:**
     - static logo stills stay off /work;
     - the detail grid takes the Project Directory's columns above 1024 px (5, and 6 at the large
       tier); tablet and phone keep the 3-column placement;
     - `[select_project]` sits at the right edge of the viewport on desktop;
     - a page shorter than the fold keeps its nav bar;
     - the dev server reads the client list and site copy from Sanity on every reload;
     - a set sits where its first member ranks in Studio (`8c97833`).
   - **Content:**
     - the manifests follow Nathan's 11-14 Studio pass (`0e4597a`, `ee7d3e0`, `ef978fe`);
     - the nine files his Studio deletes left behind are deleted (`0bb1b1ae`).
     - Harvested: swm 1.109.12.
   - **Left:**
     - Nathan's look calls on the schemes: spectrum's yellow keyword boxes (about 24% of the
       coloured area on desktop and 30% on phone, against 10% in color-ref.png), the ribbon band
       on the 404, the first-pass swatch art and the widget dials still PROPOSED, the white globe
       ring on home under black, the swatch over body copy on phone project pages, the privacy
       pill's hover under blue;
     - the tablet and phone detail-grid counts (2 / 1 as now, or 4 / 2 like the directory);
     - the logo stills typed by ratio that still show on /work (retype them Logo in Studio, or
       broaden the rule);
     - the old `blurb` field on Hurry Up Slowly, and the draft on client Sosa (his to publish);
     - a Netlify build hook at launch.
8. **Done 11-15: Nathan's 11-15 round**, folded on their go and pushed at `130b2db`
   (`integration/us7-wave2` merged with the stream; units 659/659, `test:cms` 121/121, tunables PASS,
   the build OK at 27 pages, `cms audit` 0 errors; SQ-94…SQ-98 integrated):
   - **Spectrum reworked (wave 4, SQ-94…SQ-97), then switched off** on Nathan's word ("for now"):
     - the palette sits inside every component, with no colour key per project;
     - the home globe and the /work canvas each draw one colour ramp;
     - the probe gained the uniform, density and outline gates;
     - spectrum is no longer a widget station and is never stored; `?scheme=spectrum` previews it.
   - **Three active schemes:** project, black and blue.
   - **The widget is an eye** (SQ-98, and a second pass on 11-15): lids round the lockup globe as
     the iris, each circle slides into the eye, the globe and lids share one line weight, and the
     project iris colours the globe's strips with the palette.
   - **Left:**
     - `/privacy/` and `/terms/` don't scroll by touch at 390 px when opened directly (found
       11-15, older than US-7, not patched);
     - this round replaces item 7's left calls on spectrum's look and the first-pass swatch art.
9. **Done 11-15: Nathan's second 11-15 round** (US-8, SQ-99…SQ-104), folded on their go and pushed
   at `6fbf790` (`integration/us8` fast-forwarded onto the stream). Gates on `6fbf790`:
   - units 656/656, `test:cms` 121/121, tunables PASS (484 keys);
   - the build OK at 27 pages, `cms audit` 0 errors;
   - `scripts/history-probe.mjs` 10/10;
   - `scripts/scheme-probe.mjs` 260 pass, 7 fail (the blue hover failures, also on base);
   - `scripts/globe-matrix.mjs check` 7/17 as expected (base 2/17; the other ten are the
     texBudget ceiling and stale texPeak records, both failing on base too).

   Their calls, made 11-15:
   - **Phone blurbs:** one text size on every page (HHS 2026's, 1.25 × `--text-blurb`); each
     section is as tall as its text, and the 88% grow is retired.
   - **Back navigation:** browser Back stays on the site, and returns to /work on the project you
     left it from. Cause, measured: Chrome skips every page of a visit once the site adds a history
     entry before the visitor's first click, tap or key, and a swipe or wheel page turn does exactly
     that.
   - **The scheme widget:** anchored bottom-right in the same place on every screen; no image
     dialog on a long press; an in-and-out animation on hover or press; scaled large, medium,
     small by distance while held, like the /work pager names.
   - **The home globe's lines:** the outline and the lines between panels are one colour on every
     scheme (black was the only split: black lines, a white ring; both go white).
   - **/work client names on phones:** 64 px (from 84), so Munchietown and TOBEHONEST clear the
     pager's hint.
   - **The globe follows Sanity rank:** ranks in order with none skipped, rank 1 front and centre,
     and repeats spaced so no two assets alternate along a row; the asset count stays the same.
   - **Decided at the fold (11-15):**
     - the eye keeps its rise above the links footer on home and /process;
     - the globe's texture ceiling waits for Nathan's iPhone check.
   - **Left:**
     - the texBudget ceiling, 131 MiB desktop and 73 MiB phone. The merged build measures 149.6
       and 84.9; base was already at 143.6 on desktop. Raise it, or lower `?popequiv`, after
       the iPhone check.
     - iPhone and Android checks:
       - a swipe back after a cold landing and a swipe turn;
       - /work → A → band → B, then Back twice, landing on A;
       - Android Back after a drag turn;
       - the eye's long press (no save-image dialog);
       - the blurbs: sections under half the viewport (`REST_COVER` 0.5) are no longer eased onto
         their seat.
     - the eye's five dials are still PROPOSED: `?schemelift` 1.35, `?schemenear` 0.78,
       `?schemefar` 0.6, `?schemein` 260 ms, `?schemeout` 200 ms.
10. **Four of five done 11-16: Nathan's iPhone round** (US-9, SQ-105…SQ-109), from his results on
    the Phone Checks page. SQ-105, SQ-106, SQ-108 and SQ-109 were folded on their go and pushed at
    `3801059` (the `integration/us9` merge). Gates on the merged tree:
    - units 696/696, `test:cms` 121/121, tunables PASS, the build OK, `cms audit` 0 errors;
    - `scripts/history-probe.mjs` 12/12 (the WebKit iPhone walks P1 and P2 added);
    - `scripts/nav-wipe-probe.mjs` A–E pass, and its negative control fails as it must;
    - `scripts/legal-scroll-probe.mjs` 16/16;
    - globe-probe `u-mobile` and `u-phonehd` texPeak 60.7 MiB under the 73 MiB phone ceiling.

    Settled by his results: the phone ceiling stays at 73 MiB and the phone fits under it; the
    eye's dials are his numbers (`?schemelift` 1.85, `?schemenear` 0.6, `?schemefar` 0.3,
    `?schemein` 260 ms, `?schemeout` 200 ms); `REST_COVER` 0.5 stays.
    - **SQ-105, iPhone Back:** a Back the browser already animated skips the router's view
      transition; `?histlog=1` shows an on-device history log for the next check.
    - **SQ-106, phone globe memory:** phones hold seven distinct assets a world with paired
      portraits (`CAP_MOBILE` 7, `PORTRAIT_MOBILE` 'pair'; `?popcap`, `?popportrait`). The old
      texBudget ticket SQ-10 is archived as superseded.
    - **SQ-108, the nav menu wipe:** it holds until the destination signals it has drawn
      (`swm:route-ready`), at most 600 ms and at least 100 ms (`?navwipehold`, PROPOSED).
    - **SQ-109, /terms and /privacy:** they scroll by touch at 390 px when opened directly.
    - **Left:**
      - DONE 11-17: SQ-107, the eye badge, folded on its own (item 11).
      - Nathan's iPhone checks for the four (Phone Checks rows 130–170), which also settle
        `?navwipehold` and the phone cap of seven.
      - the links-footer logo ticker's slight stutter on the phone is not yet reproduced.

11. **Done 11-16…11-19: the eye badge rounds, sets as documents, the logo law, and the CMS API
    cut.** Every piece was folded on Nathan's go and pushed; origin is at `8147701`. Each fold
    passed units, `test:cms`, `tunables-keys --check`, an export build, its probes and `cms audit` at
    0 errors. Checks for a real iPhone are on the Phone Checks page (rows 180–240, open).
    - **The scheme eye and the home footer:**
      - SQ-107 (the badge on two seats, his dials), SQ-115 (the footer follows the finger) and
        SQ-113 (the flip probe), folded at `413b515`, map `8fc492b`.
      - SQ-116 (the far badge seam, the straight ring slide, the /work arrow), pushed at `a92c245`.
        `?schemeglass` 35 and `?schemeblack` 10 baked (`b931ff4`).
      - SQ-121 (the eye's seat on the footer blurb, `3b103a0`) and SQ-124 (the house pulse as web
        animations, `9ecb294`, folded as is).
      - SQ-125 (the lowest ring 4 px over the black blurb panel, and no strip of the next band,
        `c23c8ce`), SQ-126 (whole-pixel desktop seams, badge 28 px, `94a3310`) and SQ-127 (the
        same roundings on phones, seat 70 = `?schemeclear` 56 + 14, `22f1535`).
    - **The grid and the logos:**
      - SQ-117 (`2c6770d`) and the wide-piece guard SQ-119 (`?landscapecrop` 0.2, PROPOSED,
        `52ae83e`).
      - The logo law by width-to-height ratio (`2ecf4f6`, its dials PROPOSED) and the logo bake
        (`d60b6a0`). Re-run `prep-directory-logos` with `--alpha` after every logo intake.
      - SQ-122, motion logo pieces keep their shape (`0898472`).
      - The ticker gained Insomniac and WIKKA (`8eba146`). The nav reads "services", with a hand
        icon (`ea548bd`; the URL is unchanged).
    - **The globe:** SQ-123, `?globefpstol` 2 (PROPOSED), with stills decoded off the main thread
      (`ffded76`).
    - **Sets as documents (US-10):**
      - The `mediaSet` schema landed alone (hash `205ffc6c`, `6695510`); the code (SQ-110…SQ-112)
        followed in `cb68dd7`.
      - `hideFromDirectory` also landed alone (hash `8e2eb765`, `ea07e99`).
      - The hosted Studio was redeployed on 11-17.
      - Migration files 1–7 are applied and verified. File 8 (2 operations) is next, then the
        Display Group / Group Type retirement.
    - **Content:**
      - five logo plans applied on 11-18;
      - the HUS Logo Sheet row dropped (it was deleted on purpose, `0081a3c`);
      - Fletch's two Hold Me pieces hidden from the site (plan `40ba214b`, 11-19).
    - **SQ-128, the CMS runner:** after the Sanity usage email (80% of November's API requests),
      `cms apply` re-checks only the collections each change touches (`de78003`, map `8147701`). A
      100-change plan now costs about 1k requests instead of 12–18k.
    - **Left, Nathan's calls:**
      - SQ-114, the globe set cycler's hitch: accept `a8fefa0`, or sub-1x textures;
      - the globe probe's texBudget bound (the default run is at 149.1 MiB against 131, on the
        base too);
      - an optional pop-tint ticket;
      - the Sanity plan when the Growth trial ends (about 11-26).

12. **Done 11-24: the US-12 wave, folded and pushed (origin `0ed21f8`).** The nine tickets were
    merged as one assembled wave on Nathan's go. Gates passed: units 991/0, `test:cms` 143,
    `tunables-keys --check`, `prep-client-logo-sizes --check` and one build. Each ticket's probe
    ran on the merged build:
    - **The fold:**
      - SQ-140, the ©line wraps with the footer links (footer probe, 10 widths);
      - SQ-144, the eye rides with the footer panel (ride gate, drift ≤ 0.5 px);
      - SQ-146, the services link resets the directory filter in place;
      - SQ-150, sized logo and thumbnail rungs (0 blurry at 390@3x and 1440@2x);
      - SQ-152, screen-reader names contain the visible text (0 of 56 mismatches, 8 before). The
        ticker loops freeze identical to the old build, and the still names show once;
      - SQ-149, Bedouin's first screen loads eager with high priority;
      - SQ-148, Inter self-hosted (Google Fonts gone, privacy copy `b7bec11`);
      - SQ-145, `/studio` is dev-only (404 in production);
      - SQ-143, a set member opens with the Media Asset form.
    - **Content and Studio:**
      - the stings plan `88f9012c` was applied and verified, and `cms audit` is at 0 errors;
      - the hosted Studio was redeployed from `0ed21f8`;
      - the Netlify branch build is ready.
    - **Checks:** Phone Checks rows 400–430 are open.
    - **Left:**
      - SQ-153 (filed, not dispatched): the widget sweep's seat and shift gates predate SQ-144's
        ride and fail at 1440 on a correct site;
      - SQ-141 (the `?histlog=1` Back walk) and SQ-142 (Reduce Motion).
      - Since done: Plausible (`98ab6c9`, privacy copy `6df4e05`, pushed 11-24) and the SOSA draft
        (Nathan published it 11-24).

13. **Done 11-24/25: the integrator's CMS round and SQ-154 (origin `6fd0fe1`).**
    - **Code:** the Studio structure-tool crash from SQ-143 fixed (`f59c0c2`); album art leads as
      its whole set, toggle or not (`a35ff1b`, Nathan 11-24); SQ-154, a mockups set on a detail page
      is a full-width horizontal strip (folded `737fc33`, docs `5abec78`). The hosted Studio was
      redeployed from `5abec78`.
    - **Content, each on Nathan's yes to the plan id:** Framework client + 7 Sosa Framework LA
      collaborators (`4dfa1f2d`); the Kamino RHRN promo replaced by the 1:1 crop (`5cceb71d`) and the
      old 9:16 Mux asset deleted (`c7ec310f`); the COCO sticker + billboard into coco-mockups
      (`420939e6`, manifest `8a3f2db`) and their alt (`c5795291`); the billboard's `static_other`
      accepted (`6fd0fe1`). `cms audit` 0 errors / 30 warnings on 11-25.
    - **Sets:** file 8 DROPPED (Nathan 11-25); Instagram Mockup 1 stays loose. A set may exist
      without a project (Nathan 11-24, schema change pending in the retirement below).
    - **Nathan's answers to the 11-24 pre-launch list (settled):**
      - F9 form: working; Gmail shows steady submissions (one real one from the new site after launch).
      - `/studio`: not on the live site (SQ-145). Analytics: Plausible. Lighthouse: run (SQ-147), and
        its fixes folded (SQ-148/149/150/152; SQ-151 needed none). Entry paths: waived.
      - Media session: logo cleanup, the album-art untags, Bedouin's `splitIntoThirds`, the client
        roster names and Malóne's work are done. Release covers: 15 of 16 up; WIKKA "WIK002 Dwitches —
        Tic Tac" goes with the Kamino discs. `project.services` can retire (right after launch).
      - Sanity plan: Free is fine; the trial drops to Free on its own (~11-26). Watch bandwidth
        monthly (Free hard cap 100 GB; 22.7 GB on 11-24). The old project td5i23h5 is deleted.
      - Phone Checks 330/340/350/370/390 settled; 400, 410, 430 open (420 passed).
    - **Done 11-25 (pushed through `10a12e4`):** the Kamino 9 discs + their album-art Set
      (`53ee44f3`), WIKKA's D'Witches — Tic Tac (`a690796c`), their alt (`9e46d41b`); SQ-142 (`8fb30b2`)
      and SQ-141 (`36670b3`, probe `cea9749`) folded; Phone Checks 400, 410, 420, 430 passed; the
      retirement's steps 1–2 (schema `a78be23`, runner `5cea820`, plan `b9f95559`: 4 project-less
      Sets); the Cheetah Print rank tie (`c536f5a5`) and its cause, the Studio list's drag
      (`67aee92`, runner `e9b3fda`; Nathan: order is the Studio list's alone).
    - **Left before `main`:**
      - the hosted Studio redeploy (the 11-25 run was blocked by Claude Code's permission check;
        Nathan runs it or allows it), which also carries the optional Set project;
      - the retirement's steps 3–7 (intake writes `set`, the site drops its `displayGroup` fallback,
        clearing plans, the schema commit alone, a Studio redeploy);
      - Phone Checks 440 (SQ-142) and 450 (SQ-141) on his iPhone; SQ-153;
      - the launch itself: freeze, retire worktrees, gates + `cms audit` 0, then `main` on his go.

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
| F9 | Inquiry overlay pass | ✅ `f99be98` | Fade both ways; Flip stripped; globe mark persistent; Escape closes; wheel-under-overlay guard; hidden-form field parity (subject/replyto). **11-24 (Nathan):** submissions arrive steadily (Gmail); one real submission from the new site after launch. |
| F10 | Mobile menu | ✅ `68d9a35` | Full-screen brand-black takeover off a `menu` pill at ≤768px; start_project routes through the overlay. |
| F11 | Type-token breakpoint pass | ✅ `68d9a35` | `--text-mono` 12.8→14px at ≤768px; `.fp-pager__label` lifted to 16px. |
| F12 | SEO/social baseline | ✅ `9277e27` | OG/Twitter + canonical + theme-color sitewide; brand og-image; homepage title/description; `@astrojs/sitemap` (redirect stubs + /studio filtered); robots.txt. |
| F13 | 404 page | ✅ `9277e27` | Brand gradient, return_home primary CTA. |
| F14 | Privacy page | ✅ `9277e27` + legal fold `08cb617` | `/privacy` plain-language notice; linked from the footer copy line. **11-02:** the overlay scrolls on Lenis routes (`8f3f8cf`). **11-03 (Nathan approved):** `main`'s 10-13 legal pages (PR #42) are ported as `/privacy` and the new `/terms` (`08cb617`). The studio is off QuickBooks, so both lose the QuickBooks integration copy; privacy gains a short Clients section naming only the client-facing services (Postmark invoices, Stripe and Wise payments); the contact is `hello@smallworld.media`; both are dated November 3, 2026. `origin/main` is merged in (`919f4af`: ours on both pages, LegalLayout removed), so the launch PR into `main` can't conflict. Pushed (`4504078`). |
| F15 | Pageview analytics | ✅ `98ab6c9` + `6df4e05` | Plausible (Nathan 11-24): cookieless, loaded in BaseLayout's head on production builds only (`CONTEXT === 'production'`); the privacy page names it. |
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

**Status 11-25 (Nathan's answers of 11-24, item 13):** Lighthouse DONE (SQ-147, fixes folded);
entry paths WAIVED; the media session's items below are DONE (the Kamino discs and the Tic Tac cover
on 11-25) except `project.services` (right after launch). What's left is in item 13's "Left before
`main`".

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
      schema lands alone. DONE 11-13: the field and the coverage code landed as SQ-76 (`0c5fac7`).
      Panorama360 was deleted the same day (the runner's client delete, `2c73a76`). Re-count the
      dead names with `clientCoverage` at the media session.
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
