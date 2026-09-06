# FP pager rework — three approaches (2026-08-31; all three arms built + reviewed 09-01)

Product of the 08-31 design panel (6 lensed designs → 3-judge scoring → adversarial
feasibility audits against the real code). Nathan's locked calls: **number-only rest**
(no client name — the card carries it), **press-hold-slide-release wheel on touch,
hover + scroll on desktop**, chip-family membership, tokens not rogue values, A/B
behind `?pager=<slug>` with the current rail as the default arm until blessed.

All six designers independently converged on the same paging architecture, and all
three judges endorsed it — treat it as settled:

> **Scrub-then-commit-one-goTo.** Wheeling is a pure-DOM preview: the scene never
> turns, nothing writes `accumRef`/`lockRef`. Release fires exactly ONE
> `goTo(landed)` — `goTo` already renders any jump distance as a single Turn and
> re-arms the lock. Serial 1.7s Turns per wheeled step would be hostile to the
> gesture.

---

## The shared engine (build once, all three variants ride it)

Gesture contract:

- **Touch**: `pointerdown` on the chip → charge + hold timer (`PAGER_HOLD_MS`
  ~180–250) → ENGAGE on timer OR on >slop vertical travel (impatient slide engages
  instantly). Slide wheels a continuous float `scrub` (px-per-detent token, live
  `?detent=`). Release → `landed = round(scrub + flickCarry)` → commit + retract.
- **Tap** (< hold, < slop): **PEEK** — full deploy, ~700–900ms hold, auto-retract.
  The peek is the press-hold teacher; visible targets during peek are tappable
  (`goTo(i)` — dot-jump preserved behind intent).
- **Desktop**: hover engages (~120ms intent delay), wheel steps the scrub; commit on
  wheel-stall (~400–450ms — NOT 260, thinking pauses must not commit) or
  `pointerleave`. All hover styling behind `@media (hover: hover)`; engaged/charged
  states are class/attribute-driven, never `:hover`.
- **Commit-under-lock**: single trailing deferred timer, armed ONLY when
  `Number.isFinite(lockRef.current)`; refused when `departingRef` is set; cleared on
  re-engage, unmount, `swm:enter-world`, and inside `beginReturnHome`.
- **Reduced motion**: deploys/retracts 0s, no dampers/scramble/flick, per-detent
  snap, plain `goTo`. `aria-live=polite` announces stations at detent lock only.

Audit-verified integration fixes (every one confirmed against the real files by the
feasibility pass — these apply to whichever variant ships):

1. **Hydration gate**: the island is `client:load`
   ([work/index.astro:131](../src/pages/work/index.astro#L131)) — SSR + first client
   paint MUST render the legacy rail; resolve `?pager=` into state in a mount effect
   (the Fp1TunePanel pattern, FeaturedProjects.jsx L100-117). Gating JSX on a
   direct `location.search` read = React #418.
2. **Marker-follower zombie**: the marker effect (FeaturedProjects.jsx L487-521,
   deps `[worlds.length]`) keeps its `gsap.ticker` running against the DETACHED
   legacy nav after the variant swap (`querySelectorAll` still finds children of a
   detached node — the `!dot` bail never fires). Add the resolved variant to the
   effect's deps + early-return so cleanup removes the ticker.
3. **touchend leak**: stopPropagation on `touchstart/touchmove` alone is not enough —
   main's `touchend` listener (L433-441) fires `scheduleRelease()` after every pager
   gesture (spurious re-render; can cut a mid-flight commit glide to the 0.4s
   release curve). Stop `touchend` + `touchcancel` at the pager root too.
4. **Multi-touch hole**: a second finger on the stage during an engaged scrub feeds
   main's accumulator from `e.touches[0]` (= the scrub finger) and can fire Turns
   mid-gesture. One-line guard at the top of `addDelta` (L351):
   `if (pagerEngagedRef.current) return`.
5. **Infinity lock**: `beginReturnHome` sets `lockRef = Infinity` (L295);
   `setTimeout(lock - now)` coerces non-finite delays to 0 → a queued commit fires
   immediately mid-departure. Guard on `Number.isFinite` (see commit-under-lock).
6. **Dim the `.fp-stage`, never `.fp-card-wrap`**: WorldCard writes INLINE
   `autoAlpha` to the wrap (WorldCard.jsx L159-196) — inline beats any class rule,
   and a CSS opacity transition on the same element low-passes the 1.7s exit tween
   (the `.fp-card__cta` trap, featured-projects.css L196-204). `.fp-stage` carries
   no inline styles.
7. **`--ease-draw` is SHARED, not unconsumed**: `.detail-progress` rides it
   (global.css L1154-1164); the L260-263 "currently unconsumed" comment is stale —
   fix the comment when adopting the token; never retune it per-component.
8. **Pointer capture vs taps**: capture only when `pointerType !== 'mouse'`; resolve
   engaged-state taps at `pointerup` by row math from `clientY` (capture retargets
   events to the root, so child `<button>` clicks never fire during touch engage);
   leave desktop clicks uncaptured.
9. **Marquee/label reuse is pattern-reuse, not class-reuse**: `--detail-next-max`
   and the `[data-marquee]` CSS are detail-route-scoped (project-detail.css isn't
   loaded on /work), and `.fp-pager__label`'s reveal is ancestor-coupled to the
   legacy rail. Mint variant-local classes/tokens copying the skins.
10. **Element-local color transitions at ALL states**: the chip's ink/bg consume the
    inherited `--project-color` @property (the .fp root inline broadcast, 1700ms
    cross-fade) — keep standing element-local `background/color` 0.16-0.2s
    transitions (the `.fp-pager__dot` precedent) so the Chromium paint trap never
    freezes the readout; never animate the @property itself.
11. **Doctrine**: page CSS beats the family base by SPECIFICITY (class-doubled),
    never order; mobile token values live in global.css's `<=768px :root` tier;
    JS constants in `src/lib/motion.js` (plain exports — the `?param` reads happen
    in the component via the PARAM helper, motion.js runs during SSR);
    `touch-action: none` + `user-select/touch-callout: none` + `contextmenu`
    preventDefault on the pager root (iOS long-press callout).

---

## A — `?pager=tape` · THE TAPE WHEEL (panel ranks #1 + #2, merged)

The two top-scoring designs (`ticker-chip-departure`, `instrument-wheel-readhead`)
are mechanical siblings — both are Nathan's seed executed as *content moves, the
window doesn't*. Merged spec takes the ticker's seat + shutter and the wheel's
physics.

- **Rest**: ONE square chip at the rail seat (`left: clamp(0.75rem, 2vw, 2rem)`,
  v-center) — NOT edge-flush (two judges: `left:0` lives in the iOS back-swipe
  gutter). 2ch mono `pad2(active)`, family rest colors (accent bg / `-fg` ink),
  ~33×24px @390. 44px hit pad via `::after`.
- **Engage**: chip charges white/black (snap); the window's height grows
  SYMMETRICALLY (chip is `top:50%/translateY(-50%)`, so the reading line never
  moves) to 3 rows mobile / 5 desktop over 240ms `--ease-draw`; vertical feathered
  mask (the .detail-next feather rotated); center band keeps the accent = the
  split-flap reading line. Name plate slides out right of the reading line
  (near-black label skin, marquee only on overflow — HEAVY HOUSE SOCIETY);
  `.fp-stage` dims 0.35.
- **Wheel**: the number tape rolls under the fixed reading line. Detent magnetism
  (`q = round(p) + sign(f)·pow(|2f|,1.6)/2` — lingers on stations, brisk between)
  through a dt-invariant damper τ≈0.05s (the marker-follower idiom, one transform
  write/frame via quickSetter). Hard-cut number + name per crossing; reading-line
  tick flash 90ms. End-stops: resisted overtravel (×0.3, cap 0.35 detent), springs
  back — physical resistance, not curve overshoot.
- **Release**: flick cast (80ms velocity window, carry ≤2 detents) → snap to detent
  340ms `--ease-draw` → ONE `goTo` at t=0 → plate wipes closed, shutter closes
  380ms; the retraction nests inside the 1.7s Turn and the chip lands wearing the
  destination accent off the broadcast.
- **Desktop**: hover deploys (5 rows), wheel = quantized detent steps (softer τ0.09),
  commit on 450ms stall or pointerleave; rows clickable; wheel
  preventDefault/stopPropagation armed from `pointerenter` (not just while open) so
  no tick leaks to the accumulator during the intent delay.
- **Knobs to eyeball**: the instrument-wheel dressing — 4px knurled-rim strip that
  spins with the tape, and the edge-flush seat — kept as flags (`?tapetrim=1`);
  judge-taste flagged the rim as possible ornament.

## B — `?pager=scale` · THE GRATICULE (cartographic minimal)

The quiet counterpoint: a chart instrument, not a machine. Fixed LENS, moving SCALE
— the inverse of the old fisheye.

- **Rest**: flush-left "margin tab" chip: `pad2(active)` over a 1px rule over
  `pad2(N)` — a stacked fraction (~30×43px @390). Accent bg / `-fg` ink. (Flush
  seat = device-gate item; hit pad doesn't extend left.)
- **Engage**: chip charges white/black and HOLDS charged for the whole gesture (no
  accent mid-scrub — accent returns only on commit); denominator fades; lens number
  magnifies ×1.5; a 1px hairline draws outward from the lens both directions
  (clip-path, 240ms `--ease-draw`); major/minor ticks + pad2 numbers cascade
  outward 30ms/detent (TILE_APPEAR fanout); preview label right of the lens
  (ellipsis, 38vw cap); `.fp-stage` dims 0.35. The white marker triangle survives
  as the lens pointer (continuity knob — judge-taste split on carrying it).
- **Wheel**: the SCALE slides under the pinned lens, 1:1 (pitch 36px mobile / 32px
  desktop, `?detent`), damper τ0.05. Per crossing: lens pad2 hard-cuts, crossed
  major tick flashes white and decays 160ms, label hard-cuts. End resistance ×0.2.
- **Release**: flick carry ≤2 → settle 160-200ms → ONE `goTo` → retract inward
  (ticks fade toward the lens, rule wipes closed, ~300ms total); chip un-charges to
  the (now cross-fading) accent on a SHORT 0.4s local transition.
- **Desktop**: hover-engage; wheel 100px/detent; 400ms stall commit or
  pointerleave; detents hoverable/clickable; the ENGAGED root's pointer surface
  inflated ~4rem rightward (audit: a 30px-wide hover surface + pointerleave-commit
  kills scrubs on tiny x-drift).

## C — `?pager=tuner` · THE SIGNAL TUNER (terminal voice, most radical)

Nothing spatial ever deploys — no list, no scale. ONE chip that seeks like a tuner.

- **Rest**: the chip = `pad2(active)` + a 2px position STRIP running full-bleed
  through the chip padding (caret-window idiom): width-driven fill at
  `active/(N-1)` — position-in-set with zero text. ~33×~28px.
- **Engage**: chip charges; `/06` total extends inside the chip (max-width 0→3ch,
  300ms `--ease-draw`); name window extends right (feather mask, no marquee);
  strip switches to live seek mode.
- **Wheel**: `seekPos` 1:1 (56px/detent), hard clamp both ends (structurally can't
  leak into envelopment-home or footer). Within ±0.33 of a station = LOCKED (digits
  + name hard-cut, `vibrate(8)` where supported); between = SEEKING — the readout
  SCRAMBLES at the 35ms charCutMs cadence from the house SCRAMBLE_CHARS (tuner
  hunting signal). Strip tracks the thumb 1:1. Per-frame writes via
  refs/textContent, never React state.
- **Release**: resolve to landed's real text → ONE `goTo`; the strip glides from
  seek position to `landed/(N-1)` over TURN_DURATION on the CTA commit curve
  (`cubic-bezier(0.65,0,0.35,1)`) — the pager-CTA linked-motion doctrine, inherited.
- **Desktop**: hover-engage; wheel 80px/detent; 650ms idle-at-detent auto-commit
  (`?idlecommit=0` defeats); first wheel tick over the chip = instant engage (no
  dead zone during the intent delay). Keyboard: `role=slider` semantics, arrow-run
  debounced into one commit; Enter/Space commit (suppress the button's synthetic
  click — one activation channel only).
- **Judge concerns, kept visible**: dot-jump is fully retired (jump-to-5 = hold +
  slide — slower for power users); double scramble (digits AND name) may cross the
  restraint line — `?scramblename=0` knob scrambles digits only; needs the 44px
  hit pad the other two spec.

---

## Scores & verdicts

Panel ranking (3 judges × 6 dims, /180): ticker-chip 156 · instrument-wheel 155 ·
os-terminal-tuner 152 · graticule 151 · wildcard-tapedeck 145 · elastic-rail 142.
Feasibility: all four finalists **needs-adjustment** (no unworkables); every
adjustment is folded into the shared-engine list above. The wildcard's one big idea
— moving the pager off the left wall into the bottom thumb-zone cluster — died on
the iOS home-indicator zone + the last-World footer runway, but survives as a seat
question to revisit if none of the three feel right in the hand.

## Build order & status

1. **BUILT 08-31 — shared engine**: `src/components/work/pager/usePagerGesture.js`
   (gesture FSM, damper ticker + detent magnetism, flick cast, hover/wheel/stall,
   keyboard slider, peek, the full suppression listener set incl. touchend/cancel,
   blur/tab-switch hardening, unconditional-commit-per-landing so every landing
   cancels a stale deferral) + FeaturedProjects wiring (lazy hydration-safe
   `?pager=` gate, `pagerEngagedRef` guard in addDelta, `requestGoTo` deferred
   commit that re-enters itself at lock expiry, cleared on re-engage /
   enter-world / departure / unmount, marker-follower teardown on the variant
   swap) + stage-dim rule + `--ease-draw` comment fix.
2. **BUILT 08-31 — `?pager=tape`**: `TapeWheelPager.jsx` + the `.fp-tape` CSS
   block (two tape copies on one transform, animated feather stops via
   element-local `@property`, name-plate marquee-on-overflow, container-level
   `:has(:focus-visible)` ring, roving tabstop that follows commits, 768px-tier
   geometry re-measure). Probe-verified at 1440/390 + reduced-motion smoke;
   adversarially reviewed (26-agent workflow, 21 confirmed findings all fixed).
   Live knobs: `?detent` (56) / `?wheeldetent` (90).
3. **BUILT 09-01 — `?pager=scale`**: `GraticulePager.jsx` + the `.fp-scale` CSS
   block + the `--scale-*` token tier. Departures from section B worth knowing:
   the deployed scale runs inside a BOUNDED aperture (`--scale-rows`, 7 desktop /
   6 mobile, feathered one pitch) — 13 stations at a 32/36px pitch otherwise ran
   under the fixed nav lockup and off the bottom of a phone, and rows outside the
   aperture are clipped AND inert; the cascade stagger is FITTED to the
   open/close budget (`min(--scale-stagger-ms, (open|close − fade) / rows)`)
   instead of a flat 30ms, which used to leave orphan ticks 180ms after the axis
   had wiped; the cascade origin and the engaged hit pad key off `--scale-c` (the
   row under the lens right now, written at every detent) rather than React's
   `active`, and the hairline's close origin `--scale-q` is written only at a
   landing; the lens pointer wears the lens INK, not white (a white triangle
   vanishes on the charged chip at the flush seat). Live knobs: `?detent`
   (32/36 — it re-pitches the scale too, so touch stays 1:1) / `?wheeldetent`
   (100), both floored at 8px.
4. **BUILT 09-01 — `?pager=tuner`**: `SignalTunerPager.jsx` + the `.fp-tuner` CSS
   block + the `--tuner-*` token tier. Section C as spec'd, with: the readout
   left-anchored so the digits no longer jog when `/NN` unrolls; the seeking
   scramble and the haptic tick gated to touch-owned gestures (they were firing
   from desktop hover, wheel and keyboard); announcement at LOCK, never at the
   engine's 0.5 crossing while the readout is still scrambling; and the
   post-commit hold released at the end of the glide so an external Turn at rest
   is still announced. Live knobs: `?detent` (56) / `?wheeldetent` (80) /
   `?idlecommit` (1 = the 650ms stall, 0 = never auto-commit, or a value in ms) /
   `?scramblename` (1; 0 = digits only).
5. **Shared-engine changes 09-01** (all additive; the tape re-verified after each):
   `tuning` gained optional `endResist` (0 = hard clamp), `stallMs` (non-finite =
   never auto-commit) and `magnet` (false = 1:1, no detent shaping); `clampRaw()`
   now bounds raw wheel/finger overtravel to `END_OVERTRAVEL_CAP / endResist`, so
   pushing into an end no longer banks travel that leaves the reversal dead; and
   `focusSilently(el)` moves a skin's roving tabstop WITHOUT arming the
   `:focus-visible` engage. That last one is load-bearing: a keyboard commit
   retracts synchronously, so a plain `el.focus()` in the follow effect re-engaged
   the pager and left the stage dimmed with its own paging muted until Tab-away —
   while simply skipping the move stranded focus on a cell carrying `tabindex=-1`,
   where a trailing Enter reverted the Turn just committed.
6. **Review status 09-01**: six independent lenses per new arm (spec fidelity,
   engine/island integration, CSS doctrine + paint traps, a11y/keyboard/RM,
   runtime correctness, empirical probe) → 46 findings → fixed → re-probed by
   independent verifiers. Both new arms pass; the tape passes its regression.
   All three arms: zero page errors and no non-environmental console errors at
   1440×900, 390×844 and reduced motion, plus a `?detent=0&wheeldetent=0`
   division guard. `npm run build` green (22 pages).
7. Device pass: hold/slop/detent px + iOS pointer-capture behavior ride the standing
   real-device field-pass (memory: mobile-scroll-trigger-field-pass).

## 09-02 — Nathan picked the SCALE. First revision round (built + probe-verified)

Nathan's verdict: **the graticule is the direction** ("closest to what I had in
mind"). Four revisions landed the same day, all on the scale arm only; tape and
tuner still exist untouched behind their params until the round settles.

1. **The scrim replaces the stage dim.** Engaged, a full-viewport black cover
   (`--pager-scrim` 0.65, `--pager-scrim-ms` 240ms) sits over EVERYTHING except
   the pager — nav lockup included — so the selection owns the eye.
   Mechanism: `.fp[data-pager='scale']::before`, fixed, z-110 (over the site
   shell's z-100, under the skip link's z-200); the island stamps `data-pager`
   with the resolved variant. The engaged pager rides up to z-120 and HOLDS
   through the scrim's fade-out (a 0s z-index transition delayed by
   `--pager-scrim-ms`), then drops back to z-5 under the inquiry overlay.
   `.fp.is-pager-engaged .fp-stage` opacity is forced back to 1 for this arm.
2. **Every station carries its client name** (`.fp-scale__name`, cap
   `--scale-name-max` 12rem / min(45vw, 12rem)) right of the axis ticks — the
   whole roster reads without scrubbing. The window widened to fit (mask still
   vertical-only, so names feather with their rows); station buttons pinned to
   `--scale-w` so the digits stay on the lens line. The row under the lens
   YIELDS (`opacity: min(var(--i), 1)`) — its name lives in the preview label
   alone, and the handoff animates at each crossing.
3. **`?wrap` (default ON) — the wheel.** The scale loops past both ends:
   project 01 shows the last project above it, exactly like a wheel. Skin side:
   `CLONE_ROWS` (8) ghost rows rendered beyond each end (aria-hidden, tab
   order excluded, still clickable → principal station), `--scale-clones`
   written inline for the CSS (hair extends across the clone range; hit-pad
   halves go symmetric). Engine side (`tuning.wrap`, additive — tape/tuner
   untouched): no end clamps/resist, indices report mod count while
   onDetent/commit carry the UNWRAPPED strip position second (--scale-c /
   --scale-q live in strip space), keyboard steps unclamped, follow/close/
   Escape/tap seat the NEAREST representative, and `renorm()` silently
   re-bases whole loops back onto clone content mid-scrub and at every ticker
   stop — `onRenorm(off)` tells the skin to shift its strip-space vars.
   `?wrap=0` restores the bounded scale with end resist.
4. **`?chipzoom` (default OFF) — the A/B pair Nathan asked for.** Engaged, the
   preview label FLIES to viewport centre and scales up (`--scale-zoom-scale`
   ×3 desktop / ×2 ≤768, `--scale-zoom-ms` 360ms on the draw curve; pure
   transform — translateX mixes 50vw against the element's own −50%);
   release / mouse-out carries it home on the same curve. Compare
   `/work?pager=scale` (without) vs `/work?pager=scale&chipzoom=1` (with).

Probe-verified 09-02 (SwiftShader doctrine): desktop all-scenarios, mobile
(peek/scrub/overtravel — overtravel now wheels past the old end by design),
reduced motion, `?detent=0&wheeldetent=0` guard (floors hold under wrap), a
26-tick two-full-loop spin (mid-gesture renorm lands 01 exactly, transform
converges to 0), wrap-up-from-01 → 13 → 12 with the rest re-base
(`--scale-q` −2 → 11), `?wrap=0` end-pin, chipzoom centre-landing (cx 720,
×3) + revert. Tape and tuner regression probes match their 09-01 sequences.
Scrim-over-nav pixel-verified (elementFromPoint lies — the scrim is
pointer-events:none). Build green (22 pages); tunables check PASSES at 233
(`?wrap`, `?chipzoom` added).

### Open calls from round 1 (survivors)

- **Scrim depth.** 0.65 is an agent's number. `--pager-scrim` dials it; the
  fade and the pager's z-drop share `--pager-scrim-ms`.
- **Wheel default.** `?wrap` ships ON; if the wheel is the keeper, delete the
  `?wrap=0` branch with the losing skins rather than keeping the fork.
- **Clone names double-exposure.** With 13 stations and a ±7 window, near the
  seam the same project can be visible twice (e.g. 01 at both feathered
  edges). It is honest wheel behaviour; dial `--scale-rows` down if it reads
  as a bug.
- ~~The zoomed label vs the card headline~~ — resolved 09-02 round 2: Nathan
  saw the double-name and SCRAPPED `?chipzoom` (param, tokens, CSS all
  removed).

## 09-02 round 2 (Nathan's notes after viewing round 1) — built + verified

1. **`?chipzoom` scrapped** — the flown name doubled the card's own headline.
2. **The instrument scaled up + body face.** All pager type (lens, den,
   stations, names, hint) moved `--font-mono` → `--font-body` at the
   next/previous chips' size (`--text-mono` — their own override tier).
   Geometry re-proportioned: pitch 32/36 → **44/48** (`SCALE_PITCH_*`),
   chip 35→42 / 37→44 wide, rows 19→24 / 21→26 tall. The 6-row mobile
   aperture still clears the 41px bar on a 667px phone by 4px — drop
   `--scale-rows` to 5 there if it reads tight.
3. **The FP-1 house pulse on the resting number cell** — the enter_world
   hint, re-seated: a `--color-dim-gray` veil span inside the lens swells on
   the canonical envelope (`housePulseLoop` curve via `ensureHousePulse`,
   2.3s period, 0.75 on-ratio) while the number tweens white at the peak.
   GSAP owns ONLY the veil's opacity and the number's inline color — neither
   carries a CSS transition, so the accent/charged lanes never fight inline
   writes. Killed at any intent (charge/engage), re-armed 500ms after rest
   (past the 0.4s accent transition, so a Turn recolour never bakes a
   mid-fade colour in). Never under RM.
4. **`?selectlabel` (default ON)** — `select_project`, body face, rotated 90°
   CCW (vertical-rl + 180° flip — reads bottom-to-top, Safari-safe), seated
   above the chip. On engage it wipes DOWNWARD IN GLOBAL SPACE: clip-path is
   pre-transform, so the flip maps the global-top erasure onto the local
   bottom inset. Returns on the close curve.
5. **Engaged pop + wider feather.** Deployed rows scale to `--scale-pop`
   (1.06, origin on the axis) and the window feather doubled to two pitches;
   **`?feather=<px>`** dials the radius live (inline `--scale-feather`).
6. **`?pause` (default OFF) — the pause screen.** Engaged: the scene loop
   STOPS via a `swm:fp-freeze` gate added to useWorldScene's syncTicker (the
   same gate as visibility/in-view — render AND decode hold, so the variant
   SAVES compute; Nathan asked about cost — pausing is cheaper than running),
   every GSAP tween pauses via `globalTimeline` (the pager's damper rides
   `gsap.ticker` directly and keeps running), CSS chrome animations hold via
   `.fp.is-fp-frozen`, and the scrim goes `pointer-events: auto` (input-solid
   pause screen). `[select_project]` sits at viewport centre and leaves on
   the house random letter cut (35ms shuffled — the textExit idiom) at
   release. Known edge, accepted for the experiment: engaging mid-Turn
   pauses that Turn until release.
7. **`?scalewarp` (default OFF) — the lens-warp variant.** Rows wear a
   cylindrical projection of their CONTINUOUS distance from the lens: screen
   offset `R·sin(δ/R)`, scale `cos(δ/R)`, `--scale-warp-r` = 8 stations
   (CSS-dialable). The skin writes `--scale-qf` per frame (`--scale-c` only
   hard-cuts per detent) and INVERTS the same math in hitTest so taps land
   the row they visually touch. The shader itself can't reach DOM — this is
   the same visual language, not the same pixels; probe-verified against the
   closed form (cos(3/8) = 0.9305 exact). Replaces the pop under warp (its
   own [data-open] rule carries the transform, transition-free — a per-frame
   channel must never be low-passed).

Probe-verified 09-02 (SwiftShader doctrine): full desktop + mobile scenario
sweeps clean on the new geometry; pulse arms at rest / dies at charge;
hint wipes and returns; `?feather=160` lands inline; pause: freeze event
received, five screen zones static across 1.2s while engaged, letters cut
shuffled on release, thaw verified (the effect cleanup also thaws on
unmount mid-engage); warp transforms match the closed form and `?wrap` +
warp compose. Build green; tunables check PASSES at 236 (−`?chipzoom`,
+`?selectlabel` `?feather` `?pause` `?scalewarp`).

## 09-03 round 3 — Nathan's bake + the fluid lock

**Baked (Nathan's pick): `?pause` and `?scalewarp` now default ON** — plain
`/work?pager=scale` is the pause-screen + lens-warp experience; `?pause=0` /
`?scalewarp=0` remain live for comparison per the guide doctrine.

1. **The fluid changeover (`--scale-lock`).** The round-2 build still snapped
   three readouts at every detent crossing: the lens number's textContent
   cut, the preview label's name cut, and the inline row-name opacity step
   (keyed off `--i`, which moves per detent). Round 3 replaces the stepped
   emphasis with ONE per-frame scalar: `--scale-lock` = the lens's proximity
   to the nearest station pushed through the house f² rubber-band curve (the
   hero-envelopment / CTA-fill idiom Nathan pointed at) — 1 parked on a
   detent, ~0 at the midpoint, soft on the leave and surging into the lock.
   Consumers, all transition-free (the engine's damper is the only
   smoothing):
   - `.fp-scale__numlock` — a wrapper around the lens number: scale
     `--scale-lock-shrink` (0.82) → 1, opacity `--scale-lock-dim` (0.45) → 1.
     The engage/close zoom keeps its transition on the INNER `__num`
     (nested transforms compose — the two channels never share a property).
   - `.fp-scale__label-ink` — an inner span in the preview label: opacity
     `--scale-lock-ink` (0.25) → 1. The outer keeps the chip skin and the
     open/close fade; the engine now writes the inner node.
   - Row names — continuous distance fade off `--scale-qf` (squared, the f²
     feel), replacing the per-detent `--i` step + its 0.16s transition.
   Both hard textContent cuts still happen at the crossing — but the
   crossing is exactly the bottom of the dip (lock ≈ 0), so the swap lands
   inside the trough and the re-ink IS the landing. `--scale-qf` is now
   written every frame regardless of variant (the names need it; warp reads
   it too). Reduced motion: positions snap per event, so lock stays 1 and
   the readout steps exactly as before — no extra RM carve-out needed.
2. **Mobile `[select_project]` seat.** Centred, it sat over the roster names;
   ≤768 it is now right-justified against the viewport edge (the root is
   fixed at x=0, so `100vw − --space-4` + translate −100% is the true edge).

Probe-verified 09-03: lock reads 1 parked / 0.00003 at qf 0.497 (f² floor),
numlock lands the exact token floors (0.82 / 0.45), ink 0.25, neighbour
names hand off symmetrically (~0.25/~0.25 at the midpoint), and the stall
re-locks to 1.0. Full desktop + mobile + RM scenario sweeps clean with the
baked defaults; build green; tunables check PASSES at 236 (no new keys —
the lock floors are tokens: `--scale-lock-shrink/-dim/-ink`).

## 09-03 round 4 — one instrument, one instance (Nathan's screenshot note)

Nathan's device screenshot caught the round-3 flaw cold: the preview label
and the roster row showed the SAME client name twice mid-scrub, and the
lock-dip dimming read cheap. Round 4 removes the entire handoff concept:

1. **The preview label is GONE** (element, refs, CSS, `--scale-label-max`).
   The station row under the lens IS the selected display — number + name
   pass from roster to selected as ONE element. Each row rides its
   continuous f² proximity to the lens (`--scale-qf`): scale 1 →
   **`--scale-sel` 1.688** (= `--text-secondary` / `--text-mono`, so the
   selected row sits at exactly the `[select_project]` size — Nathan's
   spec), ink 55% → 100% white on the same curve (`color-mix` with a calc
   percentage). No dimming anywhere. `--scale-pop` retired with it (the
   proximity lift supersedes the flat pop, and multiplying them overshot
   the sel size).
2. **The magnet is ON for this arm now** (`tuning.magnet: true` — the
   engine's house shape, previously tape-only). The rendered strip HANGS on
   the current station and rubber-bands across to the next: raw 0.30 of a
   step renders as 0.220 (probe-verified against the shape's closed form).
   Every downstream channel (warp, row lift, ink) reads the shaped
   `--scale-qf`, so the whole instrument carries the weight. The finger
   stays the authority; only the rendering lingers.
3. **The chip YIELDS while deployed** — bg to transparent, digits fade out
   (rules placed after the charged block; source order carries the equal
   specificity) — so the scaled row owns the seat. One crossfade at
   open/close in one position, instead of a per-crossing exchange. The
   `--scale-lens-zoom` number zoom retired with it. Pointer keeps its own
   white. Rest state (accent chip + pulse) unchanged.
4. **Ticker on the clipping selected name** — the tape's marquee verbatim
   (two-copy track, translateX −50% loop, `--marquee-s` 6s, feathered right
   edge, RM-gated): `setStation` measures the row under the lens at each
   detent against the `--scale-name-max` cap and arms `data-marquee` on
   that row alone, clearing the row it leaves. No CURRENT dataset name
   exceeds the 168px cap (max 136px) — verified armed/animating/clearing
   with a synthetic long name.
5. **The window widened by ×`--scale-sel`** — the selected row's painted box
   scales past the layout extent, and the overflow window was double-
   clipping it (caught on screenshot: "HEAVY HOUS…" cut mid-glyph).

Round-3's `--scale-lock` scalar, the numlock wrapper, the label-ink span
and the three lock-floor tokens are all deleted — the magnet + per-row
proximity replaced them wholesale.

Probe-verified 09-03: label absent from the DOM; selected transform exactly
1.688 at lock; hang matches the shape closed-form; chip yields and returns
wearing the destination accent; marquee arms/animates/clears (synthetic);
full desktop + mobile + RM sweeps clean; build green; tunables 236 PASS (no
key changes — sel/marquee are tokens/engine).

## 09-03 round 5 — the game-show flipper (Nathan's screenshot round 2)

Nathan's second device screenshot: the selected name read in FULL and ran
under the right-seated `[select_project]` on phones, the container bound
(the black chip) was missed, and the round-4 magnet (the tape's 1.6
exponent — ~4px max deviation at this pitch) read as no tension at all.

1. **`?magnet` — the tension exponent** (`SCALE_MAGNET_EXP` 4, clamped 1–8).
   The engine's magnet shape takes a per-skin exponent now
   (`tuning.magnetExp`, default 1.6 — the tape is untouched). At 4 the
   strip HANGS on the current station (raw 0.40 of a step renders 0.205)
   and snaps across the threshold on a slope of ~4× — resist, quick
   reactive crossing, settle. Probe-verified against the closed form.
2. **The FLIPPER BOX** (`.fp-scale__box`) — the round-1 near-black label
   chip reborn as the game-show arrow: a container chip at the lens line,
   JS-sized per detent to hug the (clipped) selected name, scaled onto the
   row's own origin (a negative transform-origin re-bases the ×--scale-sel
   scale; translateY leftmost applies post-scale, so the deflection is
   screen px). Its `--box-dy` is a skin-side spring (`FLIP_TAU` 0.06):
   the target is the current name's EXACT screen offset — it goes along
   with the selection under tension — and when round(q) flips at the
   threshold the ±half-pitch target jump renders as the arrow's flick onto
   the incoming name, re-centring as it locks (probe: dy −8.79 tracking,
   +8.05 mid-flick, 0.00 at lock). Pinned to 0 under RM. The row text
   paints above its own container (same z, box earlier in the DOM).
3. **The selected cap** (`--scale-name-sel-max` + `data-sel`, set per detent
   beside the marquee measure): 12rem desktop, `min(20vw, 6rem)` on phones
   — painted ×1.688 the name now stops ~245px, short of `[select_project]`
   (probe: box right 192 < freeze left 248). Past the cap the marquee
   rolls inside the box. ROSTER rows keep the wide `--scale-name-max` —
   the whole roster still reads (the round-1 goal survives). JS mirrors:
   20vw/84px · 168px · box pad 12px — keep in sync with the tokens.

All three tiers probe-clean; build green; tunables **237** PASS (+`?magnet`).

## 09-03 round 6 — the deferred Turn + the solid seat (Nathan's screenshot round 3)

Nathan's device pass baked the two round-5 dials and surfaced three defects:
settling on stations in sequence STACKED client names behind the scrim, the
minor tick scaled up in lockstep with the selected row and hung below the
name, and the axis hairline sliced through the scaled project number.

1. **Dials baked**: `?magnet` → **2.2** (`SCALE_MAGNET_EXP`, was 4) and
   `?fliptau` → **0.005** (`SCALE_FLIP_TAU_S`, was 0.06 — the clamp floor
   dropped 0.01 → 0.001 so the bake isn't silently clamped; Nathan's tested
   `.005` had been riding the old floor as 0.01, and the true value is one
   frame snappier). Both knobs stay live.
2. **The Turn evaluates at DISENGAGE only** (the stack-up fix). The desktop
   wheel STALL-COMMIT is gone — the skin passes `stallMs: Infinity` (the
   engine's existing pointerleave-only contract; `SCALE_STALL_COMMIT_MS`
   deleted). Root cause: with `?pause` baked on, a stall-commit started a
   Turn under the PAUSED globalTimeline while the hover kept the pager open
   — each subsequent settle piled another frozen Turn's card name behind
   the scrim. Now a settle is a pure preview; the one commit fires at
   pointerleave / touch release / keyboard, after which the thaw runs the
   single Turn. Targeted probe: two consecutive settles while hovering =
   `aria-current` unchanged + ONE visible card headline throughout; mouse-
   out = exactly one Turn. (This also retires the worst half of the
   pause-mid-Turn worry — a gesture can no longer START a Turn while
   frozen; engaging DURING an external Turn is still the open guard call.)
   Side-effect to feel on-device: between wheel notches the strip now PARKS
   in its magnet-shaped tension pose until the mouse leaves (no 400ms
   re-seat) — the flipper holds a few px of deflection, reading as held
   tension.
3. **Minor ticks deleted** (the half-station `::after` marks). The selected
   row's minor tick rode the ×`--scale-sel` transform and hung below the
   name; rather than exempting it, the intermediate marks are gone entirely
   — the instrument reads majors + numbers only, and nothing paints outside
   the selected row's own text box (probe: 0 `::after` ticks rendered).
4. **The box covers the number** (the hairline fix). The flipper box moved
   INSIDE the strip, between the hairline and the stations — equal-z
   siblings paint in DOM order, so the near-black fill sits OVER the axis
   line and UNDER the row text with no z-index juggling — and it now runs
   from the SEAT EDGE (x=0) to the name end + pad, so number AND name read
   on solid black in front of the line. Inside the strip its transform
   counter-rides `--scale-qf · --scale-pitch` (the same number the engine
   writes as the strip translate — zero new per-frame JS writes), then
   `--box-dy` deflects it; width is measured per detent as
   `nameEl.offsetLeft + capped name + 6` (offsetLeft tracks the
   `--scale-w`/`--space-*` tokens — one px-mirror retired). Probe: box
   left 0, right 190.7 > name right 171.8, hair at x 41 hidden inside the
   band, box centre on the lens line.

All three tiers probe-clean (desktop + mobile + RM); build green; tunables
**238** PASS (defaults + clamp updated, no key change).

## 09-04 round 7 — the curved axis + the seam (Nathan's notes)

Six asks, all landed:

1. **Bigger selection arrow.** The lens pointer triangle is 12×8px (was
   7×5) — `.fp-scale__pointer` border widths.
2. **The wheel SEAM.** A 55%-ink rule between the last and first stations
   at every loop boundary in the rendered strip (`.fp-scale__seam`,
   `?wrap` only) — where the list repeats. Own strip-level elements with
   the seam position inline as `--k` (−0.5, count−0.5 for the current
   clone reach, computed generally), NOT a station pseudo: the r6
   minor-tick lesson — nothing may ride the selected row's transform. They
   join the stations' open/close cascade off the same `--i` math, wear the
   warp's translate + foreshorten (no selection lift) — probe: width
   176.9 = 180·cos(δ/R) exact — and sit UNDER the flipper box, which
   covers them at the lens like it covers the hairline.
3. **The ticker hard-clips flush.** The `[data-marquee]` fade mask is
   GONE; while marqueeing the skin drops the box's 6px trailing pad, so
   the name's own overflow clip (the sel cap) IS the box's right edge —
   text runs to the edge and cuts clean, no fade, no gap. (Probe note: at
   a seated detent flush is exact by construction; parked between wheel
   notches the constant-scale box runs ~4px past the tension-posed name —
   the r6 park pose, reads as the box leading the name.)
4. **The axis line curves with the warp.** `.fp-scale__hair` is now a
   SCREEN-SPACE SVG path in the window (first child — everything on the
   strip paints above it), no longer riding the strip. In screen space the
   rows' cylinder is a STATIC ellipse — a row at screen offset u wears
   scale cos(δ/R) where u = R·sin(δ/R)·pitch, so x = X0·√(1−(u/(R·pitch))²)
   — and the skin samples 48 segments at gear-build (rebuilt per
   tier/pitch; straight without `?scalewarp`). The line now hugs each
   row's own axis crossing as the edge names scale in and out instead of
   slicing straight through them (probe: x 41.5 at the lens → 20.1 at the
   window edges). Fallout: the whole `--scale-q` close-origin machinery is
   DELETED (qRef, the land/effect/renorm writes, the wrap hair rules) —
   a screen-space line's close wipe always converges on the fixed lens
   line (`inset(50% 0 50%)` ↔ `inset(0)`, same tokens).
5. **Rest type matches the corner pills.** The resting chip (number over
   the 13 total) and the rotated `select_project` hint wear `--text-link`
   (16px — the "for the music industry" line) on desktop; the ≤768 tier
   keeps `--text-mono`. The engaged roster is untouched (the chip's digits
   hide while deployed).
6. **`?scrimtune` — the scrim bench** (`ScrimTunePanel.jsx`, top-right,
   the fp1/lenis chrome): dials the engaged scrim's opacity
   (`--pager-scrim`), backdrop BLUR (`--scrim-bf`), and GRAIN — an SVG
   feTurbulence data-URI written as `--scrim-noise` (texture
   none/fractalNoise/turbulence, amount, frequency, octaves, tile size
   `--scrim-noise-size`, mono toggle) — through inline props on `.fp` with
   no-op fallbacks, so the shipped scrim is byte-identical until a dial
   moves. `hold scrim` paints the scrim WITHOUT engaging (you cannot dial
   a hover-engaged scrim while mousing the panel) and skips the freeze so
   the scene moves under the blur. Image texture deliberately not wired
   yet; the copy block emits the bake.

All three tiers probe-clean; build green; tunables **239** PASS
(+`?scrimtune`).

## 09-04 round 7b — the blur fix, the metronome, the pulsing hint

Nathan's same-day follow-ups:

1. **"Blur px does nothing" — FIXED, and the diagnosis matters.** The scrim
   faded via element `opacity: 0.65`, and an element at opacity < 1
   composites its backdrop-filter RESULT over the SHARP original at that
   opacity — 35% crisp stage bled through every blur radius. Restructured:
   the fade lives on opacity 0↔1 while the DARKNESS lives in the
   background-color's alpha (`--pager-scrim`, same 0–1 token, now inside a
   `color-mix`). At steady opacity 1 the filter owns the backdrop — pixel
   probe: the blurred capture drops ~26% in PNG bytes and reads fully
   frosted (was: visibly sharp through the scrim).
2. **`--scrim-tint`** — the project-colour option: a 0–1 dial mixing the
   live `--project-color` into the scrim flood before the alpha (0 = pure
   black, shipped default). Probe at tint 1: flood = the focused project's
   accent at 0.65 alpha, and it follows the Turn.
3. **Grain ANIM FPS** (default 30) — the film-grain idiom: one decoded
   tile, `background-position` jittered at the dial's rate
   (`--scrim-noise-pos`, bench-driven interval; 0 = static). The copy
   block notes a bake needs its own driver (rAF in the skin or a steps()
   keyframe set).
4. **The HOUSE METRONOME.** `housePulseLoop` now seeks every new pulse
   timeline to `(wall clock) % period`, so loops armed at different
   moments phase-lock — enter_world, the pager cell, the inquiry
   next-field all beat together. GraticulePager's manual timeline seeks
   the same way.
5. **The hint PULSES.** `select_project` joins the pager's pulse timeline
   with the INVERSE ink: white while the number cell shows the project
   colour, dipping to its 55% rest ink exactly when the veil greys the
   cell — enter_world's dim polarity, so all three change together at the
   hit and the hint's white aligns with the accent phase (Nathan's ask).
   Probe: hint alpha oscillates 0.55↔1.00 and its dip lands on the exact
   samples where the CTA's dim-fill peaks (phase lock verified). Killed /
   re-armed with the rest of the pulse; clearProps returns the CSS 55%;
   never under RM.

All three tiers probe-clean; build green; tunables 239 PASS (no key
change — the new dials are panel-internal).

## 09-04 round 7c — the scrim recipe BAKED (Nathan's dial)

The shipped scrim is now: **depth 0.4** (`--pager-scrim`, global.css) over
a **75% project-colour tint** · **7.5px backdrop blur** · **RGB turbulence
grain** (freq 0.84, 1 octave, amount 0.82) on a **184px tile**, dancing at
**30fps**. The recipe lives as custom properties on `.fp[data-pager='scale']`
(featured-projects.css) — on the element, not the ::before, so the
`?scrimtune` bench's inline writes still override every dial (its defaults
+ ↺ reset now mirror the bake). The 30fps jitter got its shipped driver:
the `fp-scrim-grain` steps() keyframe set (8 held frames / 0.2667s),
gated on engaged/hold, overridable via `--scrim-grain-anim` (the bench
stills it while its interval owns the jitter), `animation: none` under RM,
and deliberately NOT stilled by the pause freeze — the grain belongs to
the scrim, not the page (the projector idiom), matching what the bench
previewed. Probe: engaged flood = the project colour at exactly 0.75 mix /
0.4 alpha, blur 7.5px, tile 184px, positions dancing through the frame
set; bench override verified; all tiers + build + 239 PASS.

Open: the r7 mobile-GPU question (backdrop blur cost on phones) now
applies to a SHIPPED blur — worth a feel check on the real-device pass.

## 09-04 round 8 — the thaw, the globe, the trio, the mobile dial sets

Nathan's screenshot + notes; seven items:

1. **The incoming-card flash (screenshot: the next project's text stacked
   above/below the current, static, pre-choreography) — FIXED.** The
   pause lifted at the RETRACT, but the commit fires 240ms earlier
   (readBeat): the Turn's tweens were created under the paused
   globalTimeline, so the incoming WorldCard mounted frozen in its
   initial state, offset by travel direction. Now `setFrozen` (idempotent
   ref-gated helper) thaws at `land()` — the selection is made, the
   choreography owns the page, and the entrance runs instantly under the
   fading scrim. Probe: 80ms after mouse-out the pager is still open but
   `is-fp-frozen` is already gone.
2. **The pause-screen GLOBE** — the SWM globe mark (`public/swm-globe.svg`,
   the static asset; the live /process globe-O is a Three scene and too
   heavy for a scrim layer) centred behind `[select_project]`, painted
   through a mask so only the white areas carry ink — the new
   `--color-mid-gray` (#808080) token — with `mix-blend-mode: exclusion`:
   50% grey excludes to FLAT mid-grey on any backdrop, which erases the
   tint AND the grain inside the mark for free (the ask), one cheap blend
   layer (brand-black fill stands as the fallback if a device pass
   disagrees). A `::after` of `.fp` (no stacking context — it genuinely
   blends with the scrim), z 112 between scrim (110) and pager (120),
   shown on `.is-fp-frozen`. ≤768 it centres on the RIGHT viewport edge —
   half on-page, clipped, behind the right-seated label. Size token
   `--scale-globe-size` (65vmin/34rem · 85vmin mobile).
3. **The near trio** — the proximity curve spans TWO stations now: ±1
   neighbours land at the FULL `--scale-sel` (the [select_project] size)
   and the selected row rides to ×`--scale-sel-bump` (1.15, new token —
   "slightly larger"). Probe: selected 1.941, neighbours 1.675
   (= 1.688·cos(1/8), warp-exact). The flipper box scales by sel×bump to
   stay flush; neighbours wear `data-near` (stamped per detent) = the
   tighter sel cap, hard-clipped, no ticker; the mobile cap tightened to
   `min(17vw, 4.5rem)` (JS mirror 17vw/63) so the bumped paint stays
   short of [select_project]. Ink: the trio reads full white, roster 55%.
4. **Vertical space** — desktop pitch 44 → **48** (`SCALE_PITCH_PX` +
   the `--scale-pitch` fallback); ≤768 HOLDS at 48 (the 667px-phone
   window check bounds it — rows 6 × 52 would run under the top bar).
5. **The MOBILE scrim dial set** (URL-side — the bench is fiddly on a
   phone): `?grainsize ?grainamt ?grainfreq ?grainfps ?scrimblur` write
   the same inline `.fp` props over the bake (shared recipe module
   `scrimNoise.js`); `?scrimblur=0` kills the backdrop-filter — THE
   mobile-GPU dial. Blessed values bake as a ≤768 tier block.
6. **The fp-card MOBILE dial set**: `?cardname ?tagtext ?tagpad ?tagpadx
   ?taggap` (headline px, pill text px, pill pads, pill gap — inline
   `--fp-*` props with shipped-token fallbacks). Media density/spacing
   ride the EXISTING world knobs: `?max` (tile count), `?platedeg`
   (plate size), `?fpwin` (placement window), `?fpvis`.
7. **Service-tag ink** — `.fp-tag` had HARD WHITE ink on the accent fill
   (the comment described the retired black-fill design); now
   `var(--project-color-fg)` like every accent-bg element, so light
   accents flip the text black (visible on the HHS pills).

All three tiers probe-clean; build green; tunables **249** PASS (+10
keys). Open: neighbours at full size cross the curved hairline with no
black fill behind them (only the selected row has the box) — flag for the
next screenshot round if it reads wrong.

## 09-04 round 9 — the chip label, the corner preset, the mobile bakes

Nathan's notes (mobile screenshot round):

1. **Globe REMOVED** (the r8 exclusion mark — one round old, retired
   clean: ::after rules, `--scale-globe-size`, `--color-mid-gray`,
   `public/swm-globe.svg` all gone).
2. **[select_project] is a CHIP** — the accent fill with its paired ink
   (`--project-color` / `--project-color-fg`, the fp-card__tab family
   skin), both tiers.
3. **Mobile seat ROTATED** (the name-creep fix — long names scaling
   toward the lens grazed the right-seated label for a beat): the chip
   leaves the lens band entirely — the hint's `vertical-rl` + 180° idiom
   (box-preserving, honest translate percentages), anchored to the RIGHT
   viewport edge, centred ~25vh (top half). Probe: right edge 382/390,
   span 126–270 of 844.
4. **Tickers everywhere** — the ±1 neighbour rows measure against the
   same sel cap per detent and marquee when clipping, exactly like the
   selected row (probe: 2/2 near marquees on a synthetic long name;
   roster rows keep the wide cap and rarely clip). Never under RM.
5. **Mobile grain BAKED** (`?grainamt=.56&grainsize=90&grainfreq=.85`):
   a ≤768 tier block re-declares `--scrim-noise` (regenerated URI — same
   turbulence/1-oct/rgb character, lighter slope) + `--scrim-noise-size`
   90px; `SCRIM_GRAIN_MOBILE` in scrimNoise.js mirrors it and the URL
   dial effect starts from the tier-matched base.
6. **Mobile fp-card BAKED as tokens** (`?cardname=84&tagtext=12&tagpad=4
   &taggap=6`): headline 6rem (replaces the old clamp), tag text
   0.857rem, tag gap `--space-3`; tagpad 4px = the shipped `--space-2`
   already (no-op). The `--fp-*` dial vars still override live.
7. **THE MOBILE CORNER PRESET** (`?corners`, default ON ≤768 via
   `IS_MOBILE`; `=1` previews on desktop, `=0` compares the dynamic
   layout): every project shares one four-corner composition — tier 1 =
   two DECK-SCALE plates (×1.8 `PLATE_DEG`, the wall footprint) on one
   diagonal, tier 2 = two `PLATE_DEG` plates on the other; wall strips
   (decks/album art) own tier-1 seats first, showcase media fills the
   rest, so exactly FOUR media surfaces load per project. The diagonal
   flips per slug (hashSeed parity — deterministic). Mechanically it
   rides the wall-anchor idiom: `placeDrumBlocks` gained an `anchors`
   path (quantize at the seat + collision walk outward, never dropped)
   and the seeded ring, jitter and balance pass are SKIPPED. Probe:
   COCO world = 3 plates + 1 wall = 4, 0 dropped; desktop control
   unchanged (6 + 1 dynamic). Tier mapping: big seats ride depth group 0,
   small seats alternate 1/2 (parallax unchanged).

All three tiers probe-clean; build green; tunables **250** PASS
(+`?corners`).

## 09-04 round 10 — tighter corners, wider names, the z-fight epsilon

Nathan's follow-ups:

1. **Corner plates smaller + tighter** ("cut off by the viewport — going
   out of frame a bit is fine"): three preset dials, baked defaults —
   `?t1deg` **1.35** (was 1.8; under the preset the WALLS ride it too,
   tier-1 footprint parity), `?t2deg` **0.8** (was 1), `?cornerin`
   **0.8** (seat pull-in on the wall-anchor corners; 1 = the r9 seats).
   Probe across seven worlds (Munchietown included): every project 4/4
   surfaces, 0 dropped, 0 at-rest overlaps, max plate extent 16.4°
   (was 21.6°).
2. **Mobile selected-name cap WIDENED** — `--scale-name-sel-max` ≤768:
   `min(17vw, 4.5rem)` → **`min(28vw, 8rem)`** (JS mirror 28vw/112). The
   r8 tightening existed to clear the right-seated [select_project]; the
   chip left the lens band in r9, so the viewport is the only bound
   (painted right edge ~316px of 390 at the full ×1.94).
3. **Z-FIGHTING (Nathan: Munchietown, before settle/playback)** — every
   media plate sat at exactly `SHELL_RADIUS − 0.12`, so sectors crossing
   during the spawn slerp were COPLANAR and the poster/fallback fills
   shimmered until the composition settled (video start just marks the
   settle). Fix: `PLATE_Z_EPS` — plate i sits at −i × 0.003, its own
   shell (max spread 0.024: inside the spine tab's −0.03 step, nowhere
   near the border shell at −0.18). The debug dump also carries
   `stripRects` now, so the probe audits wall/plate overlap at rest.

All three tiers probe-clean; build green; tunables **253** PASS
(+`?t1deg ?t2deg ?cornerin`).

## 09-04 round 11 — the gradual roll-off, the sliced axis, the chip wipe, the mobile walls

Nathan's device pass on rounds 6–10 (`?t1deg=.8&t2deg=.75&cornerin=.5`
was his dial of the moment — not baked; he's still dialing):

1. **The proximity curve was too jarring** — r8's fixed two-station
   curve held ±1 at full size then dropped to roster scale AND 55% ink
   inside the next station. Now DIALABLE: `--scale-falloff` **3.5**
   (radius in stations), `--scale-falloff-hold` **1** (the ±1 plateau),
   `--scale-falloff-exp` **1.5** (`pow` descent past the hold); ink
   rides the same weight (`--wd`) so the dim is as gradual as the
   shrink. URL dials `?falloff ?falloffhold ?falloffexp` write the
   tokens inline. The centre row's `--scale-sel-bump` is untouched — the
   selected still reads a bump over its neighbours.
2. **The axis stroke is SLICED** (`?hairslice`, default on): each
   station's `::after` draws its own 1px segment at the tick origin,
   so the stroke scales with the row and its position between number
   and name holds constant (the r7 screen-space SVG cut through the
   scaled-up names). The slices ride the cascade fade, ink weight and
   the warp translate+cos, so together they trace the barrel curve; the
   SVG hairline hides. The x-step between neighbouring slices IS the
   effect (Nathan proposed exactly this).
3. **The seam** now starts at the VIEWPORT edge (left 0 — the root is
   the flush seat) across the number column; ≤768 it runs the full
   `100vw` (the window's horizontal clip opens to match).
4. **Weight 500** — the enter_world button's `.cta-primary` weight — on
   stations (number + name), the lens/den digits, the hint and the
   `[select_project]` chip.
5. **The chip EXITS** — after the letter cut completes, `data-exit`
   runs a CSS top→bottom wipe in GLOBAL space over `--scale-close-ms`
   (unrotated: the top inset grows; the ≤768 180° vertical-rl flip maps
   global top onto the LOCAL BOTTOM inset — the hint's pre-transform
   clip idiom), then `data-show` drops and the letters restore. A
   re-engage mid-wipe clears `data-exit` (snap open). RM skips it with
   the letter cut.
6. **Mobile walls** (fpDrum/fpDrumWall): deck and album walls run ONE
   CELL TALLER (`?wallrows` extra lon cells on the reserved footprint,
   default 1 ≤768) and re-column — decks ONE column of pages
   (`?deckcols` 1), album art TWO (`?albumcols` 2, was the auto 3-column
   bin). `createWallPlate` gained a `cols` override; 0 = the
   DeckScroller auto count (desktop unchanged).

Dropped from the list: "only 3 media assets on mobile" — Nathan
confirmed localhost shows 4/4 with the same dials; the LAN phone had a
stale bundle.

### 09-04 round 11b — Nathan's first pass on r11

1. **Baked**: falloff `0.75 / 0.75 / 1` (radius = hold → a STEP: only the
   lens row lifts, the roster sits at size — his dial) and the corner
   triple `?t1deg` **0.8** / `?t2deg` **0.75** / `?cornerin` **0.5**.
2. **Seam spans full width at every row** — the warp rule is translate-
   only now (`scale(cos)` shortened it toward the edges).
3. **Hairline strokes never thicken** — the tick and the axis slice divide
   by the row's total screen scale (`--fs` = sel, × cos under warp), so
   they paint 1px at the lens as at the roster.
4. **Wall resolution** — the page texture request width now follows the
   column width (a 1-column mobile wall drew 480px pages into a 704px
   column — a 1.5× upscale; decode-only fix), and the mobile canvas is
   896px (`?wallpx`, was 704; 1.6× the upload area — the one real compute
   cost, dial to compare).
5. Nathan's note "by the outer two projects the slicing effect is
   nonexistent" — **open, needs his read**: with the step curve every row
   but the lens sits at roster scale, so neighbouring slices differ only by
   the warp's cos and read as one line; if the stagger is wanted as a
   design element throughout, it needs its own offset term.

### 09-05 round 11c — the stagger, the right way round

Nathan, twice: stepped AT THE CENTRE, continuous at the OUTER rows —
and in r11b the steps faded toward the centre while the selected row
"protruded considerably". (An outward-growing stagger was built and
scrapped in between — the inverse.) Now each row's axis TARGET is
`--scale-w × (1 + (sel×bump − 1) × amp × taper)` with `taper =
pow(clamp(1 − ndr/reach), exp)` — 1 at the lens, 0 at the reach — and
the slice + tick shift by target minus the row's own scaled position
(÷ `--fs`, local px). The axis, tick AND NAME shift as one group (the number stays) — a
funnel toward the selected row; the offset is clamped at 0 (nothing
moves inward; the warp's barrel at the edges is untouched). Tokens
**reach 4 / exp 2 / amp 1**: steps ≈ 18 / 13 / 7.5 / 2.6px from the
selected out to ±3, straight beyond. Per-frame
(`--ndr` continuous). `?slicereach ?sliceexp ?sliceamp`. r11b note 5
closed.

### 09-05 round 11d — no dash, the viewport slot, one cap everywhere

Nathan's next read:

1. **The dash is gone** — under the sliced axis the major tick
   (`::before`) is `display: none`; the slice is the rung. The name seats
   `--space-2` off the number's vertical (was `--space-4 + --space-2`).
2. **The long-name flash** (Heavy House Society: full in the roster, then
   cut the instant `data-sel` landed): the roster cap (`min(45vw, 12rem)`)
   was wider than the sel cap (`min(28vw, 8rem)`). ≤768 now: the SELECTED
   slot spans the viewport — `--scale-name-sel-max` is EVALUATED as
   `(100vw − --space-4) / (sel × bump) − --scale-w − --space-2` — and
   `--scale-name-max` IS that value, so every row clips identically.
3. **Every clipping row tickers**, selected or not: `setMarquee` reads
   each row's COMPUTED max-width (no JS px mirror any more), measures all
   ~30 rendered rows in one read pass, and toggles `data-marquee` per row.
   The flipper box width uses the selected row's computed cap.

Desktop caps untouched (12rem both, already equal).

### 09-05 round 11e — sizes land WITH the bar

Nathan: number + name jumped to selected size before the black fill
reached them. The size curve keyed off `--scale-qf` (continuous, per
frame) while the box flicks at the detent (±0.5). Now `--ndd` = integer
distance from `--scale-cur` (written at each detent — the same instant
the box flicks) drives `--w1` and the falloff; `--ndr` (continuous)
survives only for the stagger (positional). Sizes step per detent, in
the frame the fill lands. New dials `?selscale` (`--scale-sel`) and
`?selbump` (`--scale-sel-bump`) — the scale amount had no URL knob.

### 09-05 round 11f — Nathan's bake + the pointer rides the flipper

**Baked** (his dial): `selscale` **1.8** / `selbump` **1.05** / `falloff`
**0.5** / `falloffhold` **0.5** / `falloffexp` **2** / `slicereach`
**3** (global.css tokens); `magnet` **4** / `fliptau` **0.1** (motion.js);
`feather` **250px** ≤768 (desktop keeps 2 × pitch — undialed).

**Pointer**: the lens arrow now rides the flipper's spring — `--box-dy`
is written on the ROOT per frame (the box inside the strip inherits it;
its screen deflection IS that value since the strip's motion cancels
inside), and the pointer wears `translateY(var(--box-dy))`. One driver:
arrow and fill follow the current name under tension and flick to the
incoming one together at the threshold.

## 09-05 — tape + tuner DELETED; the rail arm proposal

Nathan: the scale arm won. `TapeWheelPager.jsx` and `SignalTunerPager.jsx`
are gone with their CSS blocks (featured-projects.css −~450 lines), their
`--tape-*` / `--tuner-*` token sets (global.css, both tiers), the `TUNER_*`
motion constants, the `?idlecommit` / `?scramblename` knobs, and the
`PAGER_ARMS` entries (`?pager=tape|tuner` now fall through to the legacy
rail like any unknown value). The engine's `PAGER_*` defaults stay — they
are the engine's, not the tape's. The probe's default variant is `scale`.
The LEGACY RAIL stays as the no-param default (Nathan's call — see below).

**The rail arm (proposed, feasible):** a fourth skin, `?pager=rail`, that
keeps the legacy rail's front end — the same `.fp-pager` markup and CSS
(accent chip, fisheye numbers, name tokens, the marker triangle) — driven
by the scale arm's interaction: hover / press-hold to ENGAGE (the pause
screen: freeze + scrim + `[select_project]` chip), wheel / slide to scrub
with the magnet, release to commit ONE Turn. The engine already
abstracts every piece a skin needs (onFrame q, onDetent, onEngaged,
onCharged, hitTest); the rail's fisheye becomes a function of the
engine's `q` instead of the cursor, the marker rides the flipper spring
(`--box-dy`), and the pause-screen machinery (setFrozen, scrim class,
chip exit) lifts out of GraticulePager into a shared `usePauseScreen`
hook so both skins call it. Nothing in the rail slides — all 13 chips
stay put; the cursor walks them. Est. ~300 lines + the hook extraction.

### 09-05 round 11g — roster size, the full-height box, the ink curve, straight edges

Nathan's desktop screenshot (the rail arm is PARKED — spec'd above, not
built):

1. **Roster too small on desktop** — no dial existed. `?roster`
   (`--scale-roster`, 1) multiplies the base size; the selected paint is
   roster × sel × bump, so `?selscale` rebalances.
2. **The box is one row tall** — `--scale-box-h` = pitch ÷ (sel × bump),
   so after the box's own ×sel×bump it paints exactly the row pitch and
   matches the sliced axis's share (was a fixed 18px × sel).
3. **Ink decoupled from size** — the ink rode `--wd` (the detented size
   step → white/grey with nothing between). Now its own continuous
   `--wi = pow(clamp(1 − ndr/reach), exp)` off `--ndr` (per frame):
   `?inkreach` 4 / `?inkexp` 1 / `?inkfloor` 0.55.
4. **Slicing at the outer rows** — the warp shrinks far rows by cos, and
   the axis (at `--scale-w` in row space, origin x = 0) shrank with them:
   ~4px steps per row at δ ≥ 5. The warp transform now also translates
   the row RIGHT by `--scale-w × (1 − cos)`, so the axis is a straight
   line at the edges; number, slice and name move together and the gap
   opens at the seat edge.
   This exposed a LATENT ghost: wheel clones past the drum's horizon
   (δ > R·π/2 → cos < 0) were being drawn at a NEGATIVE scale — mirrored
   — and sin folding back put them inside the window; they hid only by
   being mirrored off the viewport's left edge. cos is now clamped at
   0.001 at the horizon (`--cw`), so those rows collapse to nothing.

### 09-05 round 11h — bake + persistent tickers

**Baked**: `roster` **1.9** / `selscale` **1.5** / `inkreach` **5** /
`inkexp` **1.9** / `inkfloor` **0.8**.

**Tickers reset as you scroll** (Nathan) — two causes, both fixed:
(1) `setMarquee` stripped `data-marquee` off the rows leaving the
sel/near roles and the same pass re-added it — a remove + add in one
tick restarts a CSS animation; the role attributes clear alone now.
(2) The wheel renders one client name in several DOM nodes (the clone
rows), each animation starting whenever its node armed, so crossing a
loop boundary swapped nodes and jumped the phase. Every ticker is now
PHASE-LOCKED to the wall clock — `animation-delay = −(now mod duration)`
set when a node arms (the housePulseLoop idiom) — so any node of the
same name is at the same scroll position, always.

### 09-05 — the phase-lock finding, applied house-wide

Nathan: "is it worth checking we apply this globally for all tickers?"
Audit of every looping animation: the pager marquee (fixed r11h), the
`CtaArrows` caret strips (a GSAP `repeat: -1` per instance — /work's
prev/next pair and /process's three mounted at different moments and
drifted apart), the detail page's `detail-next-loop` ticker (restarted
from zero on every re-arm / soft nav), and the inquiry overlay's CSS
`house-pulse-brighten` next-field (restarted whenever the class moved to
the next field — a phase jump against the metronome). All three now
seek the wall clock: the caret tween `totalTime(now mod loop)` (the
`housePulseLoop` seek), the ticker and the pulse a negative
`animation-delay` of `−(now mod duration)` written when they arm. Left
alone: the scrim-grain jitter (phase is noise), the FilterBar bounce
(not a ticker), the unused `.house-pulse` class.

### 09-06 — the scale arm is the DEFAULT

Nathan wants the Netlify preview's `/work` to show the arm without a
query. No `?pager` now resolves to `scale`; `?pager=rail` (or any
unknown value) keeps the legacy rail. The lazy-gate shape is unchanged:
SSR + first client paint still render the rail, the scale chunk swaps
in after mount — so every visitor now pays the chunk and sees the rail
for one paint before the swap. Retiring that first-paint rail (SSR the
scale arm's rest chip) is the next structural step, not done here.

### Open calls from round 11

- The falloff triple (3.5 / 1 / 1.5) are agent numbers — dial on device.
- **Neighbours at full size still have no black box** (the r8 flag) —
  with the wider curve more rows now cross the sliced axis at scale;
  per-row boxes or a wider flipper are the two answers.
- The wipe reuses `--scale-close-ms` (300) — its own token if the beat
  wants to differ from the strip's retract.
- `?wallrows` adds a cell on BOTH wall kinds; the album's 2-column bin at
  +1 cell may want its own row count.

### Open calls from round 9

- ~~Tier-2 scale + seat coords are agent numbers~~ — r10 made all three
  dials (`?t1deg ?t2deg ?cornerin`) with Nathan-adjacent defaults; dial
  on device.
- **Worlds with < 2 showcase assets + no walls** fill fewer than 4 seats
  (stills repeat when any exist; nothing is invented).
- The chip label's 25vh seat and `--space-4` edge gap are agent numbers.

### Open calls from round 7

- **Pointer 12×8** is an agent number — two border widths.
- **Seam ink** (55% white) and reach (tick gap + `--scale-name-max`) are
  agent numbers.
- **The parked-ticker gap** (item 3): if the ~4px box lead mid-park reads
  wrong on device, the box's scale can ride the same f² proximity as the
  row (`round()` is available in CSS now) instead of the constant
  `--scale-sel`.
- **Scrim bake**: when a scrimtune recipe is blessed, bake the values into
  the tokens and decide whether grain/blur ship at all tiers (backdrop
  blur on mobile GPUs is the perf question).

### Open calls from round 5

- **`?magnet` 4** and **`FLIP_TAU` 0.06** are the two feel dials — the
  exponent is live in the URL, the spring is a skin constant.
- **The box height** (`--scale-box-h` 18px unscaled ≈ 30px painted) hugs
  the name line; if it should wrap the number too, that is a width/left
  change, not a rework.
- The JS px mirrors (sel cap, box pad) hand-track their tokens.

### Open calls from round 4

- **`--scale-sel` 1.688** tracks the token ratio by hand — if either text
  token retunes, re-derive it (a calc division of two rems would track
  automatically but typed calc division is still patchy in Safari).
- **The magnet strength** is the engine's house shape (exponent 1.6, shared
  with the tape) — retuning it retunes both arms.
- **Scaled-row overlap.** At 1.688 the selected row visually overlaps its
  neighbours (±0.3 pitch); the warp's foreshortening absorbs it. If it
  crowds, raise `--scale-warp-r`'s foreshortening or the pitch.
- Round-3 leftovers resolved; the pause mid-Turn guard (round 2) still
  stands as the sharpest pre-bake decision.

### Open calls from round 3

- **The dip floors** (0.82 / 0.45 / 0.25) are agent numbers — three tokens.
- **Lock curve depth.** f² is the house curve; if the trough reads too dead
  on slow scrubs, a floor above 0 in the skin's `n * n` write is one line.
- **Pause + mid-Turn guard** (carried from round 2) is now DEFAULT behaviour
  — worth deciding before the bake commit.

### Open calls from round 2

- **Pulse peak depth.** The veil swells to FULL dim-gray (WorldCard's
  fp1mix=1 reading). If it shouts, cap the tween's `opacity` below 1 —
  one number in GraticulePager's `armPulse`.
- **Pop depth** (`--scale-pop` 1.06) and **feather** (2 pitches) are agent
  numbers — `?feather` dials the latter live.
- **Warp radius** `--scale-warp-r` 8 is subtle; 5–6 reads more drum, at the
  cost of faster edge foreshortening.
- **Pause + mid-Turn** (above): fine for the experiment, needs a guard
  (refuse engage during a Turn, or scope the pause to the scene only) if
  the variant ships.

## Open calls for Nathan (09-01 — the A/B tuning list)

Behaviour is correct on all three arms; these are taste, and every one is a token
or a knob away from changing.

- **scale — the aperture.** `--scale-rows` 7/6 is an agent's call, not yours. Raise
  it past the project count for the honest unbounded scale; drop it to 4–5 for a
  tighter instrument.
- **scale — the flush seat.** It cuts the left edge of the lens focus ring (reads as
  a three-sided bracket), and it is the same seat the iOS back-swipe gutter question
  already hangs on. Moving to the tape's `clamp(0.75rem, 2vw, 2rem)` answers both.
- **scale — half-glyphs at the reading line.** `--scale-num-h` (19/21px) is shorter
  than the pitch (32/36px), so a neighbouring number is half-exposed beside the lens
  for most of the travel between detents. Intended as "numbers sliding under the
  instrument"; eyeball it at 60fps.
- **tuner — wheel pitch 80 vs 100.** At 80 with no magnetism, one 100px Chrome notch
  is 1.25 stations, so a discrete-notch mouse parks mid-station and the readout keeps
  hunting until the 650ms stall. Keep 80 (the hunting scramble is the arm's voice),
  move to 100 (one notch = one station), or snap only `deltaMode !== 0`.
- **tuner — the scramble glyph set.** The house `SCRAMBLE_CHARS` block glyphs
  (░▒▓█) fall back to a non-body face in the name plate and read heavy. Keep the
  house set, or scramble the name from an ASCII-only subset.
- **tuner — a dark accent at rest.** Accent-on-black with no border means a dark
  project colour (Bedouin's #8F1C1B) nearly vanishes; the strip fill is the only
  anchor. Hairline, or a luminance floor for this seat?
- **tuner — the strip at station 1.** Fill is zero-width at 01/13, so position-in-set
  is carried entirely by the digits. A minimum ~2–3px fill would keep the tick.
- **both new arms — the name/label plate over the tag row** on 390px. Inert to taps
  and the stage is dimmed under it, so it reads as an overlay, but it does sit across
  the first service pill.
- **shared engine follow-up.** `close(target)` retracts synchronously while the strip
  may still have a dozen pitches to glide. A `settling` beat before the retract would
  make station clicks and peek-taps land before they close, on every arm.

Full panel output (6 complete specs + 3 judge cards + 4 audits): session scratchpad
`tasks/wil411eyg.output` (2026-08-31 session; ephemeral — this doc is the survivor).
