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
| A1 | House slow-pulse f-curve | CREATIVE (curve) + AGENT (scaffold) | ✅ this PR | `src/lib/motion.js`: `HOUSE_PULSE_PATH` (softened attack 0–15% → hold →25% → linear fall →100%), `ensureHousePulse()`, `housePulseLoop()` (equal on/off via repeatDelay). CSS: `--ease-pulse`, `--duration-pulse: 3000ms`, `@keyframes house-pulse` + `.house-pulse` (RM-guarded) in `global.css`. Polarity per consumer: enter_world **dims**, inquiry field **brightens**. Curve shape = first authored draft — Nathan feel-pass pending. |
| A2 | House scroll tension wiring | AGENT | ✅ PR #15 + #29 | Per-surface constants in `motion.js` + shared `TOUCH_GAIN`(2)/`RELEASE_MS`(160) consumed by `Hero.jsx`, `FeaturedProjects.jsx`, `NextProjectBand.jsx`, and the /process driver. **2026-07-16 (PR #29): triggers unified at 500** (was 600/600/700) and the new `GLIDE_MS = 800` house commit glide (hero envelopment + next-project band + /process swipe; the /work World-Turn 1700ms is a scene transition and keeps its own dial). `smoothScroll.js` spreads `LENIS_TUNING` (still empty). |
| A2b | Scroll tension **dial-in** | CREATIVE | ◐ | Trigger (500) + glide (800) dialed by Nathan 2026-07-16 and promoted site-wide (PR #29). **PR #37 (merged 2026-07-17): agent side done** — `?lerp`/`?wheelmult`/`?lenisdur` live dial in `smoothScroll.js` (unset = provable no-op; positive-finite gated), starting points in the `motion.js` comment, regression matrix green on the integration preview (socket drift clamped 40.00px/0 flips on all 5 presets; np-band `NP_ARM_MS` swallow held incl. lerp .075's 1.9s tail; /process quantizer byte-identical under `?lerp=.075`; orbit scroll-kick confirmed dormant — `momentum.js` has zero importers). Remaining: **Nathan dials on a preview URL, blessed values bake into `LENIS_TUNING`**. |
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
| NAV-2 | Nav micro-interactions ×4 | CREATIVE | ☐ | Own branch `refine/nav-microinteractions`, `?navfx=1..4` demo, desktop + mobile. Active/current state is fully net-new. Envelop choreography indexes nav children — careful. |
| HP-1 | Homepage process button | AGENT + Nathan placement | ✅ PR #35 (2026-07-16) | Nathan's call executed as a hero recomposition: ⊙ process top-right slot, start_project → right edge vertical-center (shell-portaled), "Visual worlds for the music industry." → left-center statement lead in the /process prose register (replaces the drifting taglines + hero footer tagline). All ride the envelop choreography. Link 302s in prod until P6 (unchanged). |

## Wave 3 — Featured projects + detail (`refine/work-detail`)

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| FP-2 | Perceived-instant video | AGENT | ✅ PR #36 (merged 2026-07-17) | Shipped: `{startFragPrefetch, startLevel:2, maxBufferLength:12}` on MediaSlot + NextProjectBand, `eager` hero (seeds `useState`, fetch at hydration), IO band `'400px 0px'` (band's own 200px kept), posters `&time=0`. **Measured:** rossi hero rVFC 1688→1142ms (−32%), stream max 9→8 ✅, 0 errors; initial 8s weight +5.2MB (the pre-load, reported) — mobile dial candidate for P5. ⚠️ Two near-black `time=0` posters flagged for Nathan (`y02EgA7x…` .073, `S029xcxq…` .080) — per-asset time or epsilon, his call. |
| FP-4a | Detail routing refactor | AGENT (own PR, FIRST) | ✅ PR #30 | Detail grouping `sourceFolder` → `project._ref` (queries + `[slug].astro` paths/next-chain/slug). Verify against the FULL directory. |
| FP-4b | rossi+homegrxwn merge, bellaire off | Nathan + AGENT | ✅ 2026-07-16 (CMS published, snapshot on #26; PR #34 = authored-slug routing + redirects; Studio reorder pass pending) | AFTER FP-4a. CMS: re-point homegrxwn asset refs → rossi, unfeature; bellaire `isFeatured:false`. Old-slug redirect, ref snapshot for rollback, preview-deploy gate. Asset order sets hero+slug — Nathan confirms. Redeploy required. |
| FP-3 | Scroll-up at /work top → home | AGENT | ✅ PR #31 (+ home fill-release gap fix) | Hook the `addDelta` upward clamp at first World; reverse envelopment → `navigate('/')`; RM fallback; keep RouteFill handshake. |
| FP-1 | enter_world pulse (dims) | CREATIVE | ☐ | Consumes A1, dim polarity, starts after the entrance rests. Supersedes "primaries rest still". |
| DP-1 | Next-project transition rework | CREATIVE | ☐ | Blue fade confined to `.np-band__media`; media box animates to full viewport; reuse the `proxyRef.f` engine + `?np*` knobs; KEEP `swm:fill-release` handshake. |

## Wave 4 — Inquiry overlay (`refine/inquiry`)

| ID | Item | Class | Status | Notes |
|----|------|-------|--------|-------|
| INQ-2 | Wipe in from top / out bottom-to-top | AGENT | ✅ PR #32 | `clip-path` insets (both bottom-driven): in `inset(0 0 100% 0)→inset(0 0 0% 0)`; out `inset(0 0 0% 0)→inset(0 0 100% 0)`. Three sites (open / close / post-submit) + visibility gate + re-sequenced children, house curve. |
| INQ-1 | Next-field pulse (brightens) | AGENT | ✅ PR #32 | Consumes A1, brighten polarity. First-incomplete over name → email → tags(`length>0`) → message; pulse class on the field row; reset with open-reset; RM-gated. |

## Verification recipes

- Local: `npm run dev` (:4321); `/process?debug` knobs; headless = scratch `playwright-core` (`/tmp/pw-verify`) + cached `chromium_headless_shell-1228`, `waitUntil:'load'` (never `networkidle` on `/`).
- Process probes after B-work: stage pixel-walk, swipe stepping, RM paths, translateY-jitter probe, draw calls ≤90 with decoys live.
- A2b gate: parallax + orbit scroll-kick regression on document-scroll routes — ✅ run 2026-07-16 (PR #37 matrix; scroll-kick dormant, re-gate when `momentum.js` gains importers).
- Every new loop/wipe/pulse: reduced-motion path in both CSS and JS layers.
- FP-2: first-frame timing measured; FP-4: preview deploy + old-slug redirect check; P5/P6 acceptance unchanged (spec §11).
