# Site-Wide Refinements — Master Plan (status board)

> Source: Nathan's Notion **"SWM Website Revision Notes"** (2026-07-16), triaged and
> recon'd 2026-07-16 (5-agent repo recon + 3-lens adversarial critique). This board
> tracks execution; the full spec detail per item lives in the GitHub issues.
>
> **Classes** — `AGENT`: spec-complete/mechanical, filed as `ready-for-agent` issues
> (see `docs/agents/issue-tracker.md`). `CREATIVE`: feel/design work in Fable 5
> ultracode sessions with Nathan reviewing in-browser.
>
> **Interpretation calls confirmed by Nathan 2026-07-16:** process hero h1 → "PROCESS"
> (globe-O); only **[previous]** moves top-left; meter → **20 cells**; the caps words
> (DISCOVERY … WORLD_IN_MOTION) become the poster-scale stage headlines.

## Sequencing

1. **Phase A** (this PR, off `feature/v1-launch`) — foundations everything else consumes.
2. **Phase B** — process round 3 on the process branch (rebased onto A) → P5 device pass → HP-1 → P6 un-gate. `/process` launches at the END of Wave 1.
3. **Waves 2–4** — branch from the Phase A commit, run **parallel** to Phase B.
   ⚠️ `global.css` is the shared hotspot: Phase A tokens land first → NAV-1 lands the
   `--nav-inset` retune next → other chrome branches rebase onto it. Chrome edits route
   through one integration branch, not four independent PRs.

## Phase A — Foundations

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| A1 | House slow-pulse f-curve | CREATIVE (curve) + AGENT (scaffold) | ✅ this PR | `src/lib/motion.js`: `HOUSE_PULSE_PATH` (softened attack 0–15% → hold →25% → linear fall →100%), `ensureHousePulse()`, `housePulseLoop()` (equal on/off via repeatDelay). CSS: `--ease-pulse`, `--duration-pulse: 3000ms`, `@keyframes house-pulse` + `.house-pulse` (RM-guarded) in `global.css`. Polarity per consumer: enter_world **dims**, inquiry field **brightens**. **Curve dialed by Nathan 2026-07-17 (via the ?fp1tune bench) and baked (PR #39): `HOUSE_PULSE_PATH` = soft-swell/eased-S-fall, period 2.3s, on-ratio 0.75; CSS `--duration-pulse` 2300ms + both keyframes re-sampled.** |
| A2 | House scroll tension wiring | AGENT | ✅ PR #15 + #29 | Per-surface constants in `motion.js` + shared `TOUCH_GAIN`(2)/`RELEASE_MS`(160) consumed by `Hero.jsx`, `FeaturedProjects.jsx`, `NextProjectBand.jsx`, and the /process driver. **2026-07-16 (PR #29): triggers unified at 500** (was 600/600/700) and the new `GLIDE_MS = 800` house commit glide (hero envelopment + next-project band + /process swipe; the /work World-Turn 1700ms is a scene transition and keeps its own dial). `smoothScroll.js` spreads `LENIS_TUNING` (still empty). |
| A2b | Scroll tension **dial-in** | CREATIVE | ✅ 2026-07-17 | Trigger (500) + glide (800) dialed by Nathan 2026-07-16 and promoted site-wide (PR #29). PR #37: `?lerp`/`?wheelmult`/`?lenisdur` live dial in `smoothScroll.js`. **2026-07-17: `?lenistune=1` live slider bench added** (LenisTunePanel via persistent SiteShell, bottom-left; mutates `getLenis().options.*` live — Lenis reads them per-scroll, runtime duration-mode seeds Lenis' default easing; survives project→project nav; copy_values/copy_url). **Nathan dialed + BAKED into `LENIS_TUNING` (motion.js): `lerp: 0.165`, `wheelMultiplier: 1.25`** — verified in the prod bundle + behavioral smooth-scroll. ⚠️ The bake MOVED lerp 0.1→0.165 + wheelMult 1→1.25, so the two calibration caveats are now live follow-ups: re-check np-band `NP_ARM_MS` flick-tail + touch parity (`TOUCH_GAIN`) on a detail page. |
| A3 | Motion-token adoption | AGENT (audit) + CREATIVE (sign-off) | ◐ started | `--nav-inset` token created + all 4 chrome literals re-pointed (this PR). Remaining: inventory hardcoded eases/durations across `src/` → migration list → rolling adoption inside each wave's touched files. |

## Phase B — Process page round 3 (process branch)

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| B1 | Copy deck v2 | AGENT | ✅ 2026-07-16 | `processContent.js`: h1 → "PROCESS", sub/cue retired, new bottom-right mono tagline ("An inside look at our approach…"), caps-word headlines + snake_case chips, all 5 Notion blurbs verbatim (S2 exceeds the ≤45-word budget — keep, amend comment), CTA line swap. Supersedes the dirty stage-04 working-tree edit. |
| B2 | Chrome moves | AGENT | ✅ 2026-07-16 | **[previous] only** → top-left below nav (consume bar-height + `--nav-inset` tokens, no new literals); [next] stays bottom-left; retire/retune the debug-shove rule. Meter → bottom-center, `CELLS` 10→20; base rule drops `right`, adds `left:50%/translateX(-50%)`; ≤768 override must add `transform:none`. Tagline bottom-right, data-bg-aware, hidden ≤768. Gate: collision pass 768/1024/1280 + `?debug` open. |
| B3 | Thread → 3D | CREATIVE ⭐ | ✅ 2026-07-16 | Promote the DOM-SVG thread to an in-scene `THREE.Line`/tube, `depthTest:true` — occluded by panels + `innerSphere`. Inside-normal hops, no intermediate vertices. Retires the screen-space string (amend spec §3). Unlocks B5+B6. |
| B4 | S1 point cloud + decoys + labels | CREATIVE ⭐ | ✅ 2026-07-16 | Flicker-in/scale-up entrance (snappy, randomized); slow varied-speed point-cloud rotation (replaces free tumble); min-distance seeding (zero collisions); decoys as **one InstancedMesh** (separate pool — draw-call budget ≤90); DOM blob-tracking mono labels via a shared 3D→screen helper + rolling Notion term list. |
| B5 | S2 zoom + drop-out + trim path | CREATIVE | ✅ 2026-07-16 | Rides B3+B4: scroll-in zoom, decoys flicker out to the final 84, occluded trim-path draw. |
| B6 | S3 assembly + zoom-out + occlusion | CREATIVE | ✅ 2026-07-16 (via B3) | Assembly on quantizer commit; zoom-out on the house falloff; thread interior (B3) — remove the fade-out workaround. |
| B7 | S4 weight/lag | CREATIVE | ✅ 2026-07-16 | More dynamic scale-up offsets; slight lag behind scroll for weight. End-scale unchanged. |
| B8 | S5 zoom-in + tilt + inner stroke + pulse migration | CREATIVE | ✅ 2026-07-16 (?decaycurve A/B, expo default; swatches pending Nathan) | Zoom into the S5 pose (resize-safe); ~2:00 tilt via rhythm-driven scalar in the tick; brown-blue `uStrokeMix` inverse to `uPower` (new color — swatches in-session); envelope onto the house pulse behind `?decaycurve` A/B (expo stays default until the feel checkpoint passes). |
| B9 | Hero splash + globe-O | CREATIVE | ✅ 2026-07-16 (SVG placeholder; Lottie asset task open) | Blue field + globe, "PROCESS" via SplitText chars `stagger:{from:'random'}`, ~1.5 s hold, out into stage-01; RM still-path. Globe-O = absolute overlay tracked to the glyph (SVG placeholder + slow rotation); final Lottie (looping longitudinal a→b) = separate asset task. |
| B10 | P5 device pass → HP-1 → P6 un-gate | mixed | ☐ | P5 per `docs/process-page-plan.md`. HP-1 = own commit immediately before the 3-file un-gate, same deploy (button never 302s; un-gate stays 3 files). |

## Wave 2 — Site chrome (`refine/site-chrome`)

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| NAV-1 | Nav hugs viewport left | AGENT | ✅ PR #33 (4px, Nathan's pick) | Retune `--nav-inset` (single token now, this PR); preserve right-edge `+var(--space-4)` scrollbar clearance + follow_us pill lockstep. Don't touch bar height (41px echoed in work.css / ProjectDirectory / info-panel calc). |
| FT-1 | Footer matches nav inset | AGENT | ✅ PR #33 (bar full-bleed, content on the nav edges) | Footer inner bar already reads `--nav-inset` (this PR); retune the 8px outer pad against the new value so combined inset matches nav. |
| INQ-3 | Inquiry SWM icon parity | AGENT | ✅ PR #32 (Δ 0.02px) | Overlay globe ~1.5–2.5px low; fix `.project-overlay__globe`: explicit height + `object-fit:cover` + corrected top; drop ≤768 width override. Verify visually. |
| NAV-2 | Nav micro-interactions | CREATIVE | ✅ PR #38 (Nathan picked v4) | Nathan chose **variant 4 (kinetic rule)** — promoted to the DEFAULT nav (no ?navfx) with the net-new current-page state (data-current+aria-current, unconditional; --ease-draw promoted to a token). **fx3 kept as an alt behind ?navfx=3, brackets-only** (caret element + CSS deleted). Variants 1 & 2 removed. Fixed: after-swap re-seat measured pre-layout (rule drifted ~10px) → double-rAF, drift now 0. Verified 7/7. |
| HP-1 | Homepage process button | AGENT + Nathan placement | ✅ PR #35 (2026-07-16) | Nathan's call executed as a hero recomposition: ⊙ process top-right slot, start_project → right edge vertical-center (shell-portaled), "Visual worlds for the music industry." → left-center statement lead in the /process prose register (replaces the drifting taglines + hero footer tagline). All ride the envelop choreography. Link 302s in prod until P6 (unchanged). |

## Wave 3 — Featured projects + detail (`refine/work-detail`)

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| FP-2 | Perceived-instant video | AGENT | ✅ PR #36 (merged 2026-07-17) | Shipped: `{startFragPrefetch, startLevel:2, maxBufferLength:12}` on MediaSlot + NextProjectBand, `eager` hero (seeds `useState`, fetch at hydration), IO band `'400px 0px'` (band's own 200px kept), posters `&time=0`. **Measured:** rossi hero rVFC 1688→1142ms (−32%), stream max 9→8 ✅, 0 errors; initial 8s weight +5.2MB (the pre-load, reported) — mobile dial candidate for P5. ✅ Two near-black `time=0` posters reviewed 2026-07-17 — **false positive, no change (leave at `time=0`)**: both are intentional glowing-logo-on-black hero frames, not broken boxes (low luminance is the black bg). `y02EgA7x` (.073) only darkens after frame 0 (peaks ~.10 @3s — no brighter frame to move to); `S029xcxq` (.080) brightens by ~t=0.2 (.192) but to a busier mid-animation frame. Nathan's call: leave both. |
| FP-4a | Detail routing refactor | AGENT (own PR, FIRST) | ✅ PR #30 | Detail grouping `sourceFolder` → `project._ref` (queries + `[slug].astro` paths/next-chain/slug). Verify against the FULL directory. |
| FP-4b | rossi+homegrxwn merge, bellaire off | Nathan + AGENT | ✅ 2026-07-16 (CMS published, snapshot on #26; PR #34 = authored-slug routing + redirects; Studio reorder pass pending) | AFTER FP-4a. CMS: re-point homegrxwn asset refs → rossi, unfeature; bellaire `isFeatured:false`. Old-slug redirect, ref snapshot for rollback, preview-deploy gate. Asset order sets hero+slug — Nathan confirms. Redeploy required. |
| FP-3 | Scroll-up at /work top → home | AGENT | ✅ PR #31 (+ home fill-release gap fix) | Hook the `addDelta` upward clamp at first World; reverse envelopment → `navigate('/')`; RM fallback; keep RouteFill handshake. |
| FP-1 | enter_world pulse (dims) | CREATIVE | ✅ PR #39 (curve dialed + baked) | Pulse shipped; **?fp1tune=1 bench** built (live sliders, SVG plot, copy_values/copy_url; dev-only/gated). Nathan dialed the curve on it and it's **baked as the house token** (see A1): enter_world dim now 0.3, rest beat 1.05, period 2.3 (from the token). Verified: trough 0.300, cycle ~2.3s, and the shared bake reaches the **inquiry next-field brighten** too (house-pulse-brighten @2.3s, 0.5→0.99). Bench defaults track the baked curve. |
| DH-1 | Detail header flush (black-bar) | AGENT (bugfix) | ✅ PR #41 | 2026-07-17: the ~29px black strip between the blue `.client-panel` and the media was the sticky breadcrumb (`display:inline-flex` inside block-flow → line box reserved height, negative `margin-bottom` couldn't pull the media flush). Fix: `inline-flex → flex`. Gap now 0px desktop+mobile, sticky chip preserved. Pre-existing since 2026-07-01, surfaced during the DP-1 review. |
| DP-1 | Next-project transition rework | CREATIVE | ◐ PR #40 (preview) | Built 2026-07-17: `.np-band__cover` confines the blue to the media window during drag (RouteFill held 0); commit promotes the ORIGINAL media node to fixed and grows it to `0,0,100vw,100vh` on the Turn ease, cover→solid, short `swm:envelop` at `npms−0.12` snaps RouteFill for the swap frame (handshake/safety/input-swallow kept, RouteFill+FeaturedProjectDetail untouched). Reuses `proxyRef.f` + all `?np*`; `?npzoom` re-defaulted ~1.08. Verified: confined blue, grow-to-viewport, nav+release fire, FP-2 poster `time=0` intact, mobile + RM, 0 errors. ⚠️ Two follow-ups noted in PR (input-swallow now only last 0.12s → optional transparent shield; navigate-failure safety edge). Nathan sign-off on preview. |

## Wave 4 — Inquiry overlay (`refine/inquiry`)

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| INQ-2 | Wipe in from top / out bottom-to-top | AGENT | ✅ PR #32 | `clip-path` insets (both bottom-driven): in `inset(0 0 100% 0)→inset(0 0 0% 0)`; out `inset(0 0 0% 0)→inset(0 0 100% 0)`. Three sites (open / close / post-submit) + visibility gate + re-sequenced children, house curve. |
| INQ-1 | Next-field pulse (brightens) | AGENT | ✅ PR #32 | Consumes A1, brighten polarity. First-incomplete over name → email → tags(`length>0`) → message; pulse class on the field row; reset with open-reset; RM-gated. |

## Wave 5 — Home hero rework (`refine/home-hero-rework`)

Full visual-storytelling rework of the home hero: logo→globe intro, off-right grandeur composition, circular scroll-to-enter, panel-by-panel blue envelopment. Built in 7 reviewable commits (`3a5d4a3`…`ac0948c`) off `01f4af1`; each chunk agent-built, conductor-reviewed, probed green on the unified prod-preview build. **◐ awaiting Nathan's `?herotune` bake pass + mobile device gate + sign-off**; then PR toward `feature/v1-launch`.

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| HR-0 | Camera rig + overlay bridge | AGENT | ✅ `a5e8c42` | `useGlobeScene` `frameCamera`→`applyRig()` reading mutable `RIG {fill, fitCover, offsetX, offsetY, elevDeg, zoom}`: offsets via `camera.setViewOffset` (true-circle silhouette), elevation = y/z orbit + lookAt, zoom = dolly divisor. **Identity RIG is bit-identical to the old framing** (verified vs three r184: position, quaternion, all 16 projection elements). `heroOverlay.js` projects the globe's screen disc once/rendered-frame (zero-alloc) for ring/label consumers. `heroConfig.js` + `HeroTunePanel.jsx` (`?herotune=1`, top-right). |
| HR-1 | Nav normalization | AGENT | ✅ `3a5d4a3` | Home pill variant (⊙ process slot + portaled start/follow pills + `swm:envelop` choreography) deleted — home now renders the standard links row like every route. `body.route-home` kept as a CSS-only skin (transparent bar, black info-pill accent). |
| HR-2 | Resting composition + ring CTA | CREATIVE ⭐ | ✅ `11f89f1` | Default comp: desktop `fill 1.25 / offsetX 0.55 / offsetY -0.06 / elevDeg 12` (off-right grandeur, camera looking up); mobile ring-friendly contain (`?ringmobile=1`) or approved overscan + micro CTA (`=0`). `ScrollRing.jsx` = SVG textPath ring riding the disc (one transform/frame), ambient spin accelerating with fill, white→blue color-mix, commit-pin eases spin to rest (no overshoot). Gesture retarget: drag leans `rig.zoom` (camera approaches, DOM scale retired), release `expo.out`, a11y `.hero__enter-hit` over the disc. Dials: `?herofill ?herox ?heroy ?heroelev ?ringr ?ringspeed ?ringlean ?ringtext`. |
| HR-3 | Commit transition (panel-blue) | CREATIVE ⭐ | ✅ `cd85cf7` | `beginEnvelopment` = one master timeline on `HERO_COMMIT_EASE_PATH`: camera motion (recenter→0, dolly `rig.zoom→?envscale`) keys off eased `e`; the blue's event timing keys off a **linear sibling proxy** in the same timeline (the Turn curve hits e≈0.65 by 25% raw-time, so e-space windows blinked the cascade). Two `?fillmode`s: **panels** (default) — `uBlueMix`/`uBlueColor`=`GAP_COLOR` uniforms + `setBlueFill(p,variant)` sweeping the cascade's own stagger (inverted-CRT surge) then `.hero__fill` disc→corners; **circle** — process bgMorph mirror. `tl.set`-free latches. Handoff: `swm:envelop {50ms}` + navigate at e=1. Bench dry-run. Dials: `?commitms ?fillmode ?bluecascade ?recenterend ?zoomstart ?commitease`. |
| HR-4 | Logo→globe intro (A + C) | CREATIVE ⭐ | ✅ `5719868` + `ac0948c` (real lockup) | Replaces the Loom. `sessionStorage 'swm:hero-intro'` gates FULL (first visit → variant A/C) / REPLAY (revisit + FP-3 → 1.2s settle, no wordmark) / RM (static). **The real inline lockup** (`src/assets/swm-lockup-inline.svg`, blue `#0000FF`=`GAP_COLOR`, globe glyph = the "o" of world, id-tagged) inlined via `?raw`; the live WebGL globe frames in the hidden glyph slot (reads as the line-art mark at glyph scale), letterforms are the animated "chars". A "Typeset, then Ignition" (~5s): materialize → hold → cascade in the letterform → rig tween to rest, chars track apart, ink white→blue. C "Flicker Lockup, Launch" (~3.2s): CRT flicker-on → cascade → diagonal launch + reverse-flicker exit. Scene `holdEntrance` defers cascade + HLS scheduler until glyph phase ends. Dials: `?intro ?introms ?introhold ?introcascadeat ?heroink ?introease`. |
| HR-5 | Blob labels + leader strokes | CREATIVE (opt-in) | ✅ `45cb988` (shipped OFF) | Process-page label idiom ported: mono chips (clientName + up to two service names, scramble in, 2.5s hold) bound to LIVE panels via a new `LivePanelScheduler onLiveChange` callback; per-frame anchor projection + net-new 1px SVG leader `<line>` + anchor dot (chip box cached, zero per-frame layout). `BIND_PROMINENCE` hysteresis kills rim flicker. GROQ: `services` now `{name, slug}` on all pool tiers. **`HERO_LABELS=false`** — `?herolabels=1` / bench toggle mounts live; Nathan judges. Dials: `?herolabels ?labelmax ?labelhold`. |
| HR-6 | Bake + device gate + PR | Nathan + AGENT | ☐ | Nathan dials on `?herotune=1` (intro variant, comp offsets, ring, fill mode, mobile treatment, labels in/out) → copy_url → bake into `TUNING_DEFAULTS`; losing intro variant / fill mode / labels **deleted, not flag-rotted**. Mandatory iPhone re-gate (the mobile contain reframe changed the approved 1.22 overscan; 42–44fps standard). Then PR `refine/home-hero-rework` → `feature/v1-launch`. ⚠️ Live follow-ups still open from the Lenis bake (A2b): NP_ARM flick-tail + touch parity — unrelated to this wave but re-check on the same device pass. |

## Verification recipes

- Local: `npm run dev` (:4321); `/process?debug` knobs; headless = scratch `playwright-core` (`/tmp/pw-verify`) + cached `chromium_headless_shell-1228`, `waitUntil:'load'` (never `networkidle` on `/`).
- Process probes after B-work: stage pixel-walk, swipe stepping, RM paths, translateY-jitter probe, draw calls ≤90 with decoys live.
- A2b gate: parallax + orbit scroll-kick regression on document-scroll routes — ✅ run 2026-07-16 (PR #37 matrix; scroll-kick dormant, re-gate when `momentum.js` gains importers).
- Every new loop/wipe/pulse: reduced-motion path in both CSS and JS layers.
- FP-2: first-frame timing measured; FP-4: preview deploy + old-slug redirect check; P5/P6 acceptance unchanged (spec §11).
