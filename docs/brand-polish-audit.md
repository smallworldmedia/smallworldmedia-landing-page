# Brand Polish Audit — Site-Wide Design-Language & Video Pipeline

> 2026-07-05 · audited at `24f21a1` on `feature/v1-launch`.
> Brief: take the polish ethos of the refactored info panel and identify how to
> apply it site-wide — design-system gaps, animation/interaction token
> unification, missing front-end design language, and video playback quality
> vs. compute. Every claim below traces to a file:line read during the audit.

---

## 1. The ethos, codified

What actually makes the info panel (and the button/scramble/Turn systems around
it) feel finished. Naming these makes them applicable everywhere else:

1. **Three-color discipline.** Brand black surface, white text, electric blue
   as the single accent (`InfoPanel` + `global.css:601–695`). Nothing else.
2. **Choreographed arrival with memory.** Staggered entrance (description →
   header → 0.02s-stagger client items, `InfoPanel.jsx:41–72`), played once per
   mount (`hasAnimatedRef`), same pattern as the loom's once-per-session
   `swm:loomed`. Repeat visits don't re-perform.
3. **Asymmetric in/out.** Open 0.6s `power3.out`, close 0.48s `power2.inOut`
   (`SiteShell.jsx:101–116`); scrollbar in 0.3s, out 0.2s ("~65% of entrance,
   snappy" — `InfoPanel.jsx:141–162`). Exits are always quicker than entrances.
4. **Refuse browser defaults.** The custom GSAP scrollbar
   (`InfoPanel.jsx:75–139`) replaces native chrome rather than accepting it.
   That instinct is the polish.
5. **One house curve.** `TURN_EASE_PATH` (`worldConfig.js:78–80`) instanced as
   a named CustomEase in six systems (Turn roll, card roll, envelopment, band
   pager, world bands, next-project band). Steep launch, long settle, never
   overshoot — Nathan's standing motion rule.
6. **Terminal cadence.** One scramble token pair (`scramble.js:20–21`) at
   working-indicator pace, mono face with fixed advance width so cycling never
   reflows (`project-detail.css:624–632`).
7. **Live-tunable knobs.** Every motion system exposes `?param` overrides —
   design decisions are dialed on the real thing, then baked as defaults.
8. **Affordance honesty.** Client names lost their click affordance when the
   database was disabled (`global.css:686–695`). Nothing pretends to be
   interactive.
9. **Reduced motion is a first-class state** — where it's done (all of /work:
   stills, no idle motion, native scroll). See §4.2 for where it isn't.

The rest of this document measures the site against these nine principles.

---

## 2. Token unification

### 2.1 Broken / dangling tokens (bugs — fix first)

| Token | Problem | Evidence |
|---|---|---|
| `--tracking-tight` | **Never defined anywhere**; consumed ~10× (`.cta-primary`, `.fp-cta`, `.fp-card__tab/index/client`, `.fp-tag`, `.service-tag`, `.np-band__label`, `.fp-more`). Every one silently renders default letter-spacing — the intended tight tracking has never shipped. | `global.css:750,786`; `featured-projects.css:130,159,167,201,350`; `project-detail.css:327,631` |
| `--lh-body` | Never defined; `.fp-card__meta` line-height falls back to inherited. | `featured-projects.css:177` |
| `--color-near-black` | Defined only inside `.project-detail` (`project-detail.css:24`) but consumed by `global.css:931` (`.site-footer__bar` — loads on every route) and `masonry.css`. Outside detail pages the footer bar's fill is invalid → transparent. `featured-projects.css:280` carries a hand-written fallback, which proves the smell. | `git grep -- --color-near-black` |
| Font stack used as `font-size` | `font-size: var(--font-mono)` / `var(--font-ui)` — a font-*family* token in a size slot; invalid at computed-value time, so the size silently inherits. | `global.css:785` (`.fp-cta`), `featured-projects.css:230` (`.fp-pager__dot`), `featured-projects.css:340` (`.fp-more`, dead) |

These four are the cheapest possible polish wins: the design intent already
exists in the code and simply doesn't apply.

### 2.2 Motion tokens: two unconnected systems

- **JS (the real house system):** `TURN_EASE_PATH` + `TURN_DURATION` 1700ms,
  loom curve + 4800ms (`Hero.jsx:51–52`), scramble pace (`scramble.js`),
  envelopment 650ms, ~40 inline GSAP calls settling on a de-facto vocabulary:
  `power3.out` entrances, `power2.inOut`/`power2.in` exits, `expo.out` for
  snap-response (`NextProjectBand.jsx:205`), `back.out` only for tiny UI pops.
- **CSS:** only `--ease-panel`/`--duration-panel` and
  `--ease-micro`/`--duration-micro` (`global.css:131–135`), while actual CSS
  transitions use ad-hoc values: `0.12s`, `0.16s`, `0.18s`, `0.2s`, `0.3s`,
  `0.4s`, `0.5s`, `80ms`, `160ms`, `320ms`, eases `ease`, `ease-out`,
  `ease-in-out`, `cubic-bezier(0.2,0.5,0.35,1)` (`featured-projects.css:240`).

**Recommendation — one motion module, two projections.**
`src/lib/motion.js` exporting the named curves + a duration scale, and a
matching block of CSS custom props (hand-mirrored or build-generated):

```
--motion-instant: 120ms   (rubber-band snaps, hover wipes)
--motion-state:   200ms   (color/bg state changes — replaces 0.18/0.2/0.22s drift)
--motion-reveal:  400ms   (element entrances/exits)
--motion-panel:   600ms   (drawers, overlays)
--motion-turn:    1700ms  (the Turn and everything riding it)
--ease-house:     linear(…) or cubic-bezier approximation of TURN_EASE_PATH
--ease-enter:     power3.out equivalent  (cubic-bezier(0.215,0.61,0.355,1))
--ease-exit:      power2.inOut equivalent (cubic-bezier(0.455,0.03,0.515,0.955))
```

Modern `linear()` CSS easing can carry the actual house curve into CSS
transitions (with a cubic-bezier fallback), which would put the Turn's
signature settle on hover/chip transitions too — the single highest-leverage
"make it all feel like one hand" move available.

Also fold in the **exit = ~0.7× entrance** rule from the info panel as an
explicit convention rather than folklore.

### 2.3 Duplication that should be primitives

| Pattern | Occurrences | Proposed primitive |
|---|---|---|
| Near-black mono chip (`padding 0.143/0.571rem`, mono 1rem/1.571, `-0.024em`, white on `--color-near-black`) | `.client-chip`, `.deck-tab`, `.band-pager__counter`, `.band-pager__name`, `.release-chip`, `.detail-breadcrumb` (`project-detail.css:83–98,373–433,516–569`), plus `.fp-pager__label`, `.fp-card__tab` variants | `.chip` base class in global.css (the `.stag` pattern already proves the approach — `global.css:148` — but none of these use it). One place to define the hover rule too. |
| `?param` URL-knob helper | Re-implemented in **13 files** (`worldConfig.js`, `globeConfig.js`, `Hero.jsx`, `RouteFill.jsx`, `BandPager.jsx`, `NextProjectBand.jsx`, `GridSocket.jsx`, `CtaArrows.jsx`, `WorldCard.jsx`, `FeaturedProjects.jsx`, `useWorldScene.js`, `VideoGlobe.jsx`, `ProjectOverlay.jsx`) | `src/lib/params.js` — `qNum(key, fallback)`, `qStr(key, fallback)`. The knob system is house language; it deserves a module. |
| Black→blue hero gradient | `.hero` (`global.css:711`), `.fp-canvas` (`featured-projects.css:45`), `.notfound` (`404.astro:31`) | `--gradient-horizon` token (or a `.horizon` utility). |
| `.sr-only` | `global.css:1000` and `featured-projects.css:25` (older `clip:` syntax) | Keep the global one; delete the copy. |
| Reduced-motion / mobile matchMedia reads | `PREFERS_REDUCED_MOTION`/`IS_MOBILE` in `worldConfig.js:8–14`, `globeConfig.js`, plus inline `matchMedia` in ~8 components | Fold into `src/lib/env.js` beside `params.js`. |

### 2.4 Scale gaps

- **Spacing** stops at `--space-6` (12px, `global.css:111–124`). Everything
  larger is hardcoded (`3.5rem` footer/client-panel top pad, `1.143rem` nav
  padding, `2.571rem` blurb bottom…). Extend the scale (`--space-7/8/9/10` ≈
  16/24/36/49px) so section rhythm is tokenized, not remembered.
- **Z-index** is unmanaged: raw 1,2,3,4,5,6,20,50,60,100,200,201 across files.
  Adopt bands: content 0–9, page chrome 10–40 (breadcrumb 20), overlays 50–90,
  persistent shell 100, a11y 200. One comment block in global.css is enough.
- **Radii**: `--radius-pill` (50px) exists but `.site-nav__pill` uses 1.714rem
  and `.cta-primary`/`.fp-tag`/`.service-tag` use `999px` (`global.css:754`).
  Pick one full-round token.
- **Type**: the three big display recipes are the same design (96px @ 1800w,
  uppercase, 0.78 line-height) written thrice — `.client-panel__title`
  (`project-detail.css:52–63`), `.np-band__title` (`project-detail.css:644–655`),
  `.fp-card__client` (`featured-projects.css:164–172`, slightly different).
  Tokenize as `--text-display: clamp(2.4rem, 5.33vw, 6.857rem)` + friends.
- **Cream vs white.** `--color-cream` rgb(250,250,250) and `--color-white`
  #FFF coexist with no rule; the info panel and detail pages use white, body
  text and the overlay use cream. Either give cream a semantic job (long-form
  text on black?) or collapse it. Two near-identical whites is exactly the kind
  of drift a brand this tight shouldn't carry.

---

## 3. Component-system gaps (the matrix)

Surfaces measured against §1. ✅ = has it, ◐ = partial, ✗ = missing, — = n/a.

| Surface | House curve | Arrival choreography | Scramble/mono language | Hover states on-language | Focus-visible | Reduced motion |
|---|---|---|---|---|---|---|
| Info panel / drawer | — | ✅ once-per-mount | ◐ (mono header) | ✅ | ✗ pill | **✗ none** |
| Site nav + mobile menu | — | ✅ envelop choreography | ✅ glyph+snake_case | ✅ | ✗ pills/links | ✅ |
| Hero (loom, scroll_to_enter) | ✅ | ✅ loom | ✅ | ✅ | ✗ | ✅ |
| /work World + card | ✅ | ✅ OS-window boot | ✅ | ✅ | ✗ pager dots | ✅ |
| Inquiry overlay | — | ✅ staggered fields | ✅ mono labels | ✅ (incl. disabled + error states) | ◐ `:focus` underline only | **✗ none** |
| Detail: client panel + blurb | — | **✗ static** | ✅ chips | ◐ socials = opacity fade (off-language) | ✗ | — |
| Detail: band pager (deck/album) | ✅ | ✅ | ✅ ScrambleLabel | ✅ blue-accent | ✅ **(the only styled one)** | ✅ |
| Detail: masonry media | — | ◐ load-fade only | — | — (no interaction) | — | ✅ via GridSocket |
| Next-project band | ✅ | ✅ scroll-driven | ✅ | ✅ pinned-blue | ✗ (it's a link) | ✅ |
| 404 / privacy | — | ✗ static | ◐ | ✅ | ✗ | — |
| Footer | — | — | ✗ (body face — deliberate) | ✅ underline | ✗ | — |

### 3.1 The biggest ethos gap: the detail page has no arrival

The envelopment passage (fill → navigate → release) delivers the visitor into
`/work/[slug]`… which renders statically — `FeaturedProjectDetail.jsx` contains
**zero entrance motion** (no GSAP at the page level; media slots just
opacity-fade on load). Every other destination in the funnel has an arrival
moment (loom, OS-window boot, band pager first-paint reveal). The single
highest-impact polish move site-wide:

- Client-panel title + chips ride a short staggered reveal on first paint
  (the info-panel recipe: title clip-reveal, chips 0.02 stagger), timed to the
  RouteFill release so it reads as the passage *completing*, not a second event.
- The breadcrumb's label could `scrambleTo` on mount — it's already mono.
- Once-per-navigation, RM = instant, per house rules.

### 3.2 Hover-state language — codify the two families

The site has converged on two legitimate hover families plus strays:

- **Chip family:** background → electric blue (`.detail-breadcrumb:hover`,
  `a.release-chip--link:hover`, active states). Deck tabs use blue *border*
  (`project-detail.css:387`) — close, but pick fill or border and standardize.
- **Text-link family:** underline (`.site-nav__link`, `.notfound__link`,
  `.site-footer__privacy`).
- **Strays to bring on-language:** `.social-btn:hover` = opacity 0.65
  (`project-detail.css:161–163`) — the only opacity-fade hover on the site;
  `.fp-pager__dot:hover` inverts to black (deliberate "strongest state" — fine,
  but document it). `.project-overlay__close:hover` uses an rgba wash
  (`global.css:1108`) unlike its sibling pills.

Write the rule down in global.css where `.stag` is documented: *chips fill
blue, text links underline, nothing fades opacity.*

### 3.3 Focus-visible — one recipe, not per-component styles

Only `.skip-link` and `.band-pager__stage` have focus treatment. The F16 note
already defers a sweep to ws6; the audit's contribution is the recipe so the
sweep is mechanical:

```css
:where(a, button, [tabindex]):focus-visible {
  outline: 1px dashed var(--color-electric-blue);
  outline-offset: 4px;
}
```

— which is literally the band-pager treatment (`project-detail.css:452`)
promoted to a site rule, with per-surface opt-outs where the dashed blue can't
read (on blue fills: white dash). Keyboard reach itself is decent (real
buttons/links everywhere; the World is pager-navigable).

### 3.4 Reduced-motion holes in the oldest chrome

`InfoPanel.jsx`, `SiteShell.jsx` (drawer slide), `ProjectOverlay.jsx` — zero RM
checks (grep-verified), while every /work-era surface handles it. Ironic given
the info panel is the polish benchmark. The scramble module's early-return
pattern (`scramble.js:32–38`) is the template: snap to end-state. The drawer
should still *move* (it's functional, not decorative) but can drop to a short
fade; the panel's staggered entrance and the overlay's field stagger should
collapse to instant.

### 3.5 Dead weight shipping

- **Dead components:** `InfoPill.jsx` (+ its full CSS block,
  `global.css:221–288`), `CtaButton.jsx` (+ `.cta` styles ~`global.css:1040–1061`),
  `HeroText.jsx` (unmounted; taglines CSS `global.css:1012–1038` + responsive
  blocks ride along) — import-graph-verified unused.
- **Dead CSS:** `.fp-more` family (`featured-projects.css:337–373`) — no JSX
  references it.
- **Disabled-route chain:** `ProjectDirectory` → `MediaGrid`/`MediaCard`/
  `FilterBar`/`Lightbox`/`AlbumArtTicker` + `work.css` only reachable via the
  redirecting `/work/directory`. Fine to keep for v2 — but note §5: the best
  video pattern in the repo is stranded in `Lightbox`.
- **Comment drift:** `.service-tag` says "blue fill, black text"; actual is
  black fill, white text (`project-detail.css:322–334`). Update comments when
  Nathan retunes — they're the design record.

---

## 4. Missing design language (buttoning up)

Ranked by visibility-per-effort:

1. **`::selection`** — unstyled. Electric blue behind white is a free,
   everywhere-visible brand moment. One rule.
2. **Document scrollbar on detail pages** — the one surface where native
   chrome survives (black editorial page, default Chrome scrollbar). The info
   panel already proves the custom-scrollbar instinct. Lightest-touch version:
   `scrollbar-color: var(--color-electric-blue) var(--color-black)` +
   `::-webkit-scrollbar` styling, scoped to `html:has(.project-detail)`. (Does
   not reintroduce the banned `scrollbar-gutter` — geometry is already handled
   by the 100vw shell.)
3. **Non-choreographed route swaps.** Envelopment covers `/`→`/work`→detail,
   but plain navigations (nav links, footer→privacy, 404→home) hard-cut. A
   RouteFill-lite 150–200ms fade for any swap without a passage would make
   every transition feel authored. The infrastructure (persistent RouteFill,
   astro:before-swap) already exists.
4. **Case discipline.** The house voice is lowercase snake_case mono
   (`start_project`, `enter_world`, `return_home`) — but `Try Again →`,
   `Sending…`, `Skip to content`, form placeholders are Title/Sentence case.
   Decide: chrome = snake_case mono, prose = sentence case, and sweep the
   stragglers (`ProjectOverlay.jsx:302–303`).
5. **Glyph vocabulary.** `↳ ⁕ ♡ ⏏ →` carry the wayfinding voice. Inventory
   them in a comment block (or a `glyphs.js`) so new surfaces pull from the
   set instead of inventing.
6. **Loading language beyond fade.** `--color-dark-gray` boxes + 0.5s fade is
   fine, but Sanity assets ship LQIP/palette metadata for free — tinting each
   slot's placeholder with the asset's dominant color would make media arrival
   feel considered at zero bandwidth cost. (Mux thumbnails can seed the same
   for video posters.)
7. **Font delivery.** Brand faces load as uncompressed `.otf`
   (`global.css:6–70`; two are preloaded, `BaseLayout.astro:71–72`) — woff2
   conversion is typically 40–60% smaller with zero visual change. And the "UI
   face" (`--font-ui`, used by `.cta-primary` — the primary button!) is
   **Inter from Google Fonts** (`BaseLayout.astro:75–80`): a render-blocking
   third-party request for the most brand-forward component on the site.
   Self-host Inter woff2, or fold UI usage into PP Neue Montreal and drop the
   dependency entirely.

---

## 5. Video-first: quality vs. compute, per surface

The pooled surfaces are in excellent shape; the discipline stops at the detail
page. Current state:

| Surface | Mechanism | Rendition | Budget | Verdict |
|---|---|---|---|---|
| Home globe | `VideoSlotPool` + scheduler | 270p cap desktop / single 540p mobile, `preferMinQuality` | `MAX_LIVE` slots, 10s buffer, loops replay from buffer | ✅ tuned |
| /work Near tier | Same pool, `WorldLiveScheduler` | pinned 720p/540p single rendition (no ABR) | ≤3 desktop / 2 mobile, serialized startups, Turn suspend | ✅ tuned |
| Detail masonry + **hero band** (`MediaSlot.jsx`) | Per-slot hls.js, plain ABR, autoplay on manifest | **unpinned** — starts at hls.js default estimate, upshifts visibly | **none** — every in-view slot (+200px margin) decodes simultaneously | ⚠ the main showcase canvas is the least-controlled surface |
| Next-project band (`NextProjectBand.jsx:116–117`) | Per-slot hls.js, plain ABR | unpinned | in-view gate | ⚠ same |
| Lightbox (disabled route) | `preferMaxQuality`: locks top rendition, **holds poster until first hi-res frag buffered** | ✅ | single | ✅ — the best pattern in the repo, currently unreachable |

### 5.1 Quality: kill the rendition pop on the showcase pages

The detail hero band is the largest video frame on the site and the only one
that can visibly change quality mid-view (ABR starts low/estimates, then
upshifts). The fix already exists in-repo — `useHls`'s `preferMaxQuality`
poster-hold (`useHls.js:78–96`, proven in Lightbox): sharp poster → sharp
video, no pop. Apply it to the hero-band slot (and NextProjectBand, which is
also poster-first already). For a bandwidth guard, "max" can be expressed as a
pinned Mux rendition instead: reuse the World's URL-param trick
(`min_resolution=max_resolution=1080p` for hero, 720p for `np-band`) so the
manifest itself has one choice — same no-pop guarantee, bounded cost, and it
makes rendition policy *declarative* the way `WORLD_STREAM_PARAMS`
(`worldConfig.js:95–96`) already is.

### 5.2 Compute: the detail page needs a decode budget

Everything else on the site respects a hard decode budget (pool size). Detail
masonry does not: N in-view slots (+200px `rootMargin`, `MediaSlot.jsx:54`) = N
concurrent hls.js instances and decoders. On a media-heavy page (Bedouin gate
in the launch plan) that's the compute risk on weaker hardware. Options, in
increasing effort:

1. **Size-aware caps, free:** pass `capLevelToPlayerSize: true` in the slots'
   hls config — hls.js then never fetches renditions above the rendered size ×
   DPR. One line, pure savings, no visual change.
2. **Rendition params by slot width** (grid slots get `max_resolution=720p`,
   hero uncapped/pinned) — mirrors the globe/World declarative approach.
3. **A real budget:** promote the `WorldLiveScheduler` idea (it's
   display-agnostic already): masonry slots register as candidates; ≤4 decode
   at once prioritized by viewport proximity; the rest hold posters. Biggest
   win, and it *is* the house pattern — the detail page is currently the only
   video surface not running on a scheduler.

Also: on viewport exit, `MediaSlot` nulls the src → full hls teardown; return
visits re-fetch manifest + segments (poster flash + re-buffer). Keeping the
instance and calling `hls.stopLoad()`/`video.pause()` on exit,
`startLoad()`/`play()` on re-entry trades a little memory for smoother
re-entry and less network churn on scrolly editorial pages. Worth testing
against the ws6 device pass.

### 5.3 Images ride the same wave

No `srcset`/`sizes` anywhere (grep-verified): detail slots hardcode `w=1400`
(`MediaSlot.jsx:22`), grid 800/1200 (`imageConfig.js`). Sanity's CDN makes
responsive sets free (`?w=` variants + `auto=format` already in use). A shared
`sanitySrcset(url, widths)` helper + `sizes` per layout slot cuts phone bytes
roughly in half and sharpens 2× desktops. Mux posters can request
`thumbnail.webp` instead of `.jpg` for the same reason.

### 5.4 Already-right things to protect (do not regress)

- Serialized HLS startups (one pending stream — parallel first-segments
  measured slower, session note 2026-07-02).
- Offscreen-but-not-display:none pool (Safari decode throttling,
  `featured-projects.css:56–68`).
- Turn suspend = preload window; loop-from-buffer previews; `DPR_MAX` caps;
  `enableWorker`; muted/playsInline/autoplay attribute set.
- RM = stills, no pool mounted (`worldConfig.js:86`).

---

## 6. Prioritized roadmap

**P0 — broken-token fixes (minutes, pure wins)**
1. Define `--tracking-tight` (suggest `-0.02em`), `--lh-body`; move
   `--color-near-black` to `:root`; fix the three font-stack-as-size slots.
2. `::selection` rule.
3. Delete dead: `InfoPill`, `CtaButton`, `.fp-more` CSS, duplicate `.sr-only`
   (decide `HeroText`'s fate separately — it's a design maybe, not cruft).

**P1 — token consolidation (an afternoon)**
4. `src/lib/params.js` + `env.js`; collapse the 13 knob-helper copies.
5. Motion scale in `:root` + `src/lib/motion.js`; sweep CSS transitions onto
   it; express the house curve as CSS `linear()` for chip/CTA transitions.
6. `.chip` primitive; collapse the six near-black chip declarations.
7. Spacing scale extension + z-index bands + radius unification +
   `--gradient-horizon` + display-type clamp tokens.
8. woff2 conversion; self-host or eliminate Inter.

**P2 — ethos application (the visible wins)**
9. Detail-page arrival choreography timed to the RouteFill release (§3.1).
10. RM handling for InfoPanel/SiteShell/ProjectOverlay (§3.4).
11. Hover-language sweep (§3.2) + focus-visible recipe rollout (§3.3, rides
    ws6 as planned).
12. RouteFill-lite fade for non-choreographed swaps; detail-page
    `scrollbar-color`; case-discipline sweep.

**P3 — video pipeline (bounded, testable on the ws6 device pass)**
13. `capLevelToPlayerSize: true` on detail slots (one line).
14. Hero band + np-band: pinned-rendition poster-hold (no-pop arrival).
15. `srcset`/`sizes` helper for Sanity images; webp Mux posters.
16. Detail-page decode scheduler (WorldLiveScheduler generalization) — the
    real fix; spec against Bedouin on real hardware.

---

## 7. Self-critique / limits

- **Static audit.** No runtime measurement was taken; the detail-page ABR
  "quality pop" is inferred from the code path (autoplay on `MANIFEST_PARSED`
  with default `startLevel`, `useHls.js:108–113`) — on fast connections
  hls.js's estimator may start high and mask it. Measure on the ws6 device
  pass before investing in §5.2 option 3.
- The uncommitted `BandPager.jsx` working-tree change (dealer-deck width cap)
  was not audited; recommendations don't account for it.
- `linear()` easing support is baseline-2023; the cubic-bezier fallback keeps
  older Safari correct but won't carry the exact house settle there.
- Recommendations deliberately respect standing decisions: no idle animation
  on primary CTAs, no overshoot, no `scrollbar-gutter`, serialized startups,
  `/work` owns its wheel physics (Lenis stays off there).
