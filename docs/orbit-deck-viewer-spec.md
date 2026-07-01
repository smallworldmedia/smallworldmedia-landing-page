# AlbumArtOrbit + BrandDeckViewer — Build Spec

> Grilled & solidified 2026-07-01.
> **Vocabulary:** `CONTEXT.md` — AlbumArtOrbit, BrandDeckViewer, ReleaseCard, Grid Socket, Pull-out, dual-feed rules.
> **Decision record:** `docs/adr/0003-composite-math-first.md`.
> **Reference:** `orbit-mockup.jpg` (tilted elliptical ring, overlapping covers, ambient rotation).

## Scope

**This build:** both components on the `/work/[slug]` detail page, plus the Lenis scroll foundation, the Grid Socket layout system, and the supporting Sanity content pass.

**Deferred (unchanged from plan P4):** the World composite-element mounts at `/work`. Every geometry/physics module in this build is renderer-agnostic and becomes the World consumers' brain later — see ADR-0003. The World-side renderer **must** be WebGL (textured planes inside the framebuffer, pre-distortion); CSS 3D is physically incapable of receiving the lens-distortion post-process.

## Shared architecture (five systems)

Build these as standalone modules first — both components are thin assemblies on top.

### 1. Momentum engine (`wrap` / `snap` modes)

One 1D phase scalar with unified velocity state. All inputs write to a single angular/linear velocity value:

- **Inputs:** idle drift rate (orbit only), pointer drag (direct phase scrub with pointer capture), flick (release velocity transfer), external `kick(v)` (scroll coupling).
- **Decay:** flick velocity decays smoothly back to idle rate (orbit) or to rest (pager) — steep launch, **no overshoot**, smooth decel into rest; same curve family as the World Turn.
- **Modes:** `wrap` (continuous, ring angle, orbit) / `snap` (clamped range, settles on integer page indices, pager).
- **Housekeeping:** rAF loop fully pauses when host is offscreen (IntersectionObserver) or the document is hidden. `prefers-reduced-motion`: no idle drift, no kicks; drag and snap still function.
- **Gesture discrimination:** drag-vs-click threshold (~5px pointer travel) so flicks never misfire as clicks.

### 2. Grid Socket system

Extends `computeFlushGrid` with **reserved regions** — rectangular blocks `{colStart, colSpan, rowSpan, anchor}` that dense placement flows around and that participate in the flush-bottom pass (grid stays gapless).

- **Anchors:** `top` (region starts at row 0, below the blurb) and `mid` (two-pass: compute the natural grid without the region, find the row boundary nearest the midpoint, insert the reservation, recompute — deterministic).
- **The socket layer:** positions its occupant absolutely over the region's px rect, on a higher z-index than the grid, with:
  - **Bounded overlap** — the occupant may overhang neighboring tiles by a tunable cap (~15–25% of a cover/page height). Enough to break the plane, never enough to bury showcase work. Overhang into blurb whitespace is free.
  - **Parallax** — the layer tracks scroll at a differential (~0.92×, tunable), driven by Lenis's smoothed scroll. The region carries padding margin so drift never collides with neighbors. Off under reduced motion.
- **Mobile / single-column:** no lateral neighbors → the socket degrades to a plain full-width in-flow band (no overlap, no/minimal parallax). The layered treatment is a ≥2-column enhancement.

### 3. Lenis scroll foundation

`lenis` (darkroomengineering) as the site's smooth-scroll base, introduced now because both sockets' parallax and the orbit's scroll-kick consume its smoothed scroll + velocity signals.

- **Enabled:** `/`, `/work/directory`, `/work/[slug]` (all document-scroll routes). Init in one shared module on Astro page load; destroyed on page swap.
- **Hard-disabled on `/work`** — `FeaturedProjects.jsx` owns wheel physics there (World Turn); Lenis must never contest it.
- **Integration:** driven from GSAP's ticker; `ScrollTrigger.update` on Lenis scroll (standard pattern).
- **Reduced motion:** smoothing disabled (native scroll); velocity signal still readable.

### 4. Chrome kit

Shared section chrome in the established mono/blue design language (`PROJECT_##` family): small label chips, page counters (`04 / 17`), deck tab chips, and the in-place **scramble text** treatment (reuse the existing WorldCard scramble utility). No big editorial headings.

### 5. ReleaseCard

The Pull-out's metadata chip panel — see component spec below. Named first-class because Phase 14's Record Crate reuses it verbatim.

## `buildContentFlow` changes

1. **Fix the deck-sort bug** (`buildContentFlow.js:146`): current code sorts all deck pages by `brandDeckOrder` globally, interleaving Bedouin's three decks (1,1,1,2,2,2…). Correct behavior: group by `displayGroup` → order groups by their lowest-`orderRank` member (controlled-adjacency convention) → `brandDeckOrder` within each group.
2. **Emit decks grouped:** `brandDecks` becomes `[{ group, pages: [...] }]` so the viewer's tabs consume structure, not a flat array. (Update the `/work/index.astro` `hasBrandDeck` consumer.)
3. **`ORBIT_MIN` gate (default 6, tunable):** when `albumArt.length < ORBIT_MIN`, fold the covers into `showcase` (1:1 squares tessellate as `square` tiles) and return `albumArt: []`. Gate lives here so the detail page and future World socket inherit identical behavior.

## AlbumArtOrbit

**Mounts for:** Andhera Branding (20 covers), HHS Pre-2026 (15). Coco/Imperfect/HHS-2026 (1–2 covers) fold into masonry via the gate.

### Rendering

- **CSS 3D:** `perspective` container, ring tilted via `rotateX`, each cover a real DOM element (`<img>`/`<button>` — lazy-loading, alt text, focusability, Sanity CDN `?w=` sizing) transformed around the ring. Browser z-sorts via `transform-style: preserve-3d`.
- **Ring math module (pure, renderer-agnostic):** `(coverCount, phase, params) → [{x, y, z, rotY, scale, opacity}]` with **adaptive radius by count** (6–8 covers form a tight credible ring; 20 a full one). CSS consumes records as transforms today; the World's three.js consumer maps them to plane meshes later.

### Motion (momentum engine, `wrap` mode)

- Idle: one revolution ~45–60s (tunable).
- Drag scrubs phase; flick decays back to idle speed.
- Scroll-kick: Lenis velocity injects a small additive kick while in view.
- Offscreen rAF pause; reduced motion = static ring, drag still browses.

### Interaction

- **Click a rear cover** → ring spins it to front-center (shortest path through the velocity system, decel into rest). Reduced motion: quick tween instead.
- **Click the front cover** → **Pull-out** (the Lightbox is *not* used for orbit covers).
- **Front caption:** the front-most cover's title in a small blue mono label, updating with an in-place scramble each time a new cover crosses the front meridian — the idle drift quietly ticks through the catalog.

### Pull-out + ReleaseCard

- Cover translates **left and toward the viewer** (scales up, squares to face-on) — pulled from the crate. The ring keeps idling behind with a **traveling gap** at its slot.
- **ReleaseCard** animates in beside it: chips for `releaseArtist`, `releaseTitle`, `catalogNumber`, `releaseDate`, and one chip per `streamLinks[]` entry (Beatport/Spotify/etc.). ClientPanel visual family (blue band language, squeezed title, metadata chips).
- **Degradation — never placeholders:** each chip renders only if its field exists; with no `releaseInfo`, the card shows the asset `title` alone and still looks intentional.
- Subtle dim on the layer beneath while focused, for legibility. Composes within the socket's footprint; may overlap neighbors more aggressively while focused.
- **Dismiss:** close affordance / click-outside / click the cover → cover flies back to wherever its slot has drifted; card animates out.

### Placement

Grid Socket, **2 of 3 columns × ~2 portrait-row units, `top` anchor** (directly below the blurb — for label projects the catalog is the centerpiece, not an appendix). Side (left/right) chosen per page balance, tunable. Real tiles fill the remaining column beside it; near-edge covers overhang the gutter into them (bounded).

**Optional later polish (not this build):** split-layer rendering so the ring's rear arc passes *behind* adjacent tiles (true z=0-crossing pseudo-3D).

## BrandDeckViewer

**Mounts for:** Bedouin (3 decks / 42 pages), Imperfect (27), Coco (17), Hurry Up Slowly (14), DEVELOPED (12).

### Reading model — horizontal pager (never a vertical unroll)

- **Fixed-height full-width band, ~60–70vh (tunable).** Height never changes → reserved region and flush grid stay static; the band remains a rigid floating body.
- **Pages carry a slight isometric angle** (tunable) — travel reads as dimensional, not a flat translation.
- **Resting state:** the deck's **cover page** fit-contained, with a subtle fanned/stacked peek of following pages behind it; deck title + mono counter (`01 / 17`).
- **Navigation:** drag/flick (momentum engine, `snap` mode — settles on page indices with the house curve), click left/right zones, arrow keys when focused. Mobile: swipe.
- **Loading:** lazy ±2 pages from current, CDN `?w=` sized to the band.
- **Reduced motion:** instant page swaps.
- No zoom / no overlay reader in v1 (a full-screen "expand to reader" is a possible later addition).

### Multi-deck: tabs

- One band, mono chip tabs (e.g. `saga / human_by_default / bedouin_brand`); switching swaps to that deck's cover page, counter resets per deck. Single-deck projects render no tabs — same component, chrome collapses.
- **Tab order & default = orderRank.** The default tab is simply the first tab: the deck whose pages carry the lowest `orderRank`. No "featured deck" flag — position is prominence (the isHero lesson).

### Placement

- **Deck-only project** (the majority case): full-width Grid Socket, **`top` anchor** — the deck is the centerpiece (Bedouin's guidelines *are* the deliverable). Vertical-only overlap: overhangs the blurb whitespace above and the tile rows below.
- **Both present** (Andhera, HHS Pre-2026 — currently zero pages have both, but the rule is fixed): orbit outranks; deck band inserts at the **`mid` anchor**.

## Content & data tasks (Sanity, part of this build)

1. **Populate `releaseInfo`** for the two orbit catalogs — Andhera (20) + HHS Pre-2026 (15) = 35 assets — so the full-metadata ReleaseCard is viewable with real data. Source real artist/title/catalog/stream-links from Beatport/label pages (script-assisted); **Nathan reviews before publish — no invented metadata.** This is the operational start of Phase 14 (Record Crate) data.
2. **Studio reorder (Bedouin):** hero stays first, then **saga's** deck pages (saga = lead deck), then the remaining decks/assets.
3. **Detail GROQ:** add the `releaseInfo{...}` projection (currently unfetched).

## Tunables

Expose via the `/work?key=value` live-tuning convention: `?orbitmin`, `?orbitrev` (rev period), `?orbitkick`, `?orbittilt`, `?orbitoverlap`, `?sockpar` (parallax factor), `?deckh` (band height), `?deckangle` (isometric), `?deckfan`. Finalize names during build.

## Build order

1. **Lenis foundation** — isolated, immediately verifiable site-wide.
2. **`buildContentFlow` changes** — gate + grouped decks + sort fix; verify against real slugs (Bedouin for grouping, Coco for the gate).
3. **Grid Socket system** — reservations + layer + overlap + parallax.
4. **Momentum engine** — both modes.
5. **BrandDeckViewer** — structurally simpler occupant; exercises full-width socket + snap mode + tabs. Verify on Bedouin (tabs/default) and Hurry Up Slowly (no tabs).
6. **AlbumArtOrbit + ReleaseCard** — wrap mode, ring math, pull-out. Verify on Andhera (20) and HHS Pre-2026 (15); confirm Coco folds to masonry.
7. **Content pass** in parallel with 5–6: releaseInfo population + saga reorder.
8. **Polish gate:** scramble captions, reduced-motion audit, mobile in-flow fallbacks, overlap/parallax tuning on device.

## Acceptance checklist

- [ ] Lenis live on `/`, `/work/directory`, `/work/[slug]`; `/work` wheel physics untouched; reduced-motion = native scroll.
- [ ] Bedouin: three tabs in orderRank order, saga default, pages sequenced per deck (sort bug dead), band floats at the **top** anchor (deck-only project), vertical overlap + parallax visible.
- [ ] Andhera / HHS Pre-2026: orbit below blurb, grid flows around it flush-bottomed, covers overhang neighbors within cap, idle/drag/flick/scroll-kick all feed one velocity.
- [ ] Pull-out shows a fully-populated ReleaseCard (real metadata) on both catalogs; degraded title-only state verified on an unpopulated asset.
- [ ] Coco / Imperfect / HHS-2026: covers appear in masonry (gate fold-back), no orbit.
- [ ] Mobile: both components render as in-flow bands; no overlap artifacts.
- [ ] `prefers-reduced-motion`: no idle spin, no parallax, no scroll-kick; drag, tabs, paging, pull-out all still functional.
