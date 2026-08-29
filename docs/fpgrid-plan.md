# fp-grid — media lives IN the grid: three directions

> Proposal for the `refactor/fp-grid-media` worktree. One concept — media occupies
> blocks of grid cells instead of floating in front of the shell — expressed three
> ways, live-switchable via `?fpgrid=1|2|3` (house `num()` convention;
> `?fpgrid=0` = legacy floating field).
>
> **STATUS 2026-08-29 (3): FOLD-READY.** The 08-28 wave shipped bedouin's
> second deck wall (hero-led wall-deck order, `?vtiles` 6), the site resize
> doctrine (settle-debounce + `?camlag` camera chase + video pause; NO
> repopulation on resize — Nathan's revert call), the black /work field
> (`?fpfade` 0 + `:has` root paint), and the /process live globe-O (the home
> scroll-globe at rest; `?ospin` −20 · `?ostroke` 3 · `?opad` 0.175). Branch
> history rewritten (tree-verified) so the DO-NOT-MERGE base is a proper
> landing commit — fold-in runbook in `docs/.session-context.md`.
>
> **STATUS 2026-08-27: APPROVED + ALL THREE IMPLEMENTED** (commits f11b6a8
> ATLAS, d7d0cf6 FORME, 6fde3fb DRUM). Nathan's calls honored: default mode 1;
> DRUM idle creep is a live toggle (`?creep` deg/s, default 0 = still); house
> tokens/curves/timings reused throughout (turnRollEase, TURN_DURATION,
> TILE_APPEAR/FANOUT, BAND_CYCLE_S, S2 accent ingestion, CTA ink states).
> All modes verified on coco (video-heavy) + bedouin (deck-heavy): Turn,
> enter-dive, deck cycling, live video within the existing pool budget
> (4/4/3/4 streams live on modes 0/1/2/3), console clean, build green,
> `?fpgrid=0` legacy regression-free.
>
> Implementation deltas vs the plan below: DRUM arcs landed at **60°** (6-fold)
> — 120° left a bare-grid beat mid-roll; 60° keeps the conveyor continuous
> (`?arcdeg` to compare). Ring-walk placement DROPS a block when a full
> revolution (3 outward layers) finds no clear cells — empty cells over corner
> pileups. Sanity CORS gained `http://localhost:4322` (this worktree's dev port).
>
> **Live-tuning quick reference** (all house `num()` params on `/work`):
> `?fpgrid=0|1|2|3` mode · `?platedeg` block size (deg, all modes) ·
> `?fpwin` field margin inside the lens crop · `?camlook` ATLAS/DRUM pointer
> amplitude · `?panepitch` FORME macro-cell pitch (× shell fine pitch) ·
> `?arcdeg` DRUM arc · `?drumturn` DRUM Turn duration × · `?creep` DRUM idle
> creep deg/s · plus the standing knobs (`?bandx/?bandy` strip anchor,
> `?max/?min` density, `?shellalpha`, `?spin`).
>
> **STATUS 2026-08-27 (2): DRUM BLESSED — refinement pass shipped.** Nathan
> picked DRUM from the feel pass; his tunables are baked as defaults
> (`fpgrid=3`, `platedeg=12`, `fpwin=1.1`, desktop `max=8`). The pass added:
>
> - **Composition balance** (`?fpbal=1` default, `0` = raw A/B): a
>   deterministic post-pass measures 3×3-zone occupancy of the VISIBLE frame
>   (`?fpvis` 0.85 lens-crop model; center zone = the card's, excluded), then
>   nudges blocks a few cells toward the variance-minimizing legal move (up to
>   3 sweeps), re-seats DROPPED blocks into the emptiest zone, and demotes the
>   block crowding a dominant zone one size step (~15%). Zero PRNG draws —
>   seeded layouts stay reproducible. Verified: rossi zone variance 0.385 →
>   0.010, munchietown 0.321 → 0.005.
> - **Wall plates** (`fpDrumWall.js`): brand decks + album art render as the
>   detail page's orthographic DeckScroller wall pressed into the drum — one
>   canvas per strip with the exact column math (alternating directions,
>   `(col + n·cols) % N` cycling, positive-mod wrap), idle drift `?walldrift`
>   + Turn-roll coupling `?wallgear` (|Δadv| stands in for Lenis velocity).
>   `BAND_PAGE_CAP` 5 → 12 server-side (`?wallpages` client cap); the
>   legacy/ATLAS register plates still slice `BAND_MAX_PAGES`.
> - **Trim toggles** (`fpDrumTrim.js`): `?fpglow=1` (default) — cell panels
>   illuminate in the accent in a ring emanating from center on the
>   house-pulse cadence (reinforces enter_world); `?fpglow=2` — pointer-trace
>   illumination, cursor corrected through the LIVE lens coefficients
>   (forward-applying the pass's backward map) then dropped into drum-body
>   space so lit cells stay on their cells as the drum rolls; `?fpglowa`
>   alpha. `?fptab=1` (default) — accent spine tab, −90° mono
>   cell-coordinates, stamped on each plate's bottom-left. `?fpfurn=1`
>   (default 0) — FORME's furniture riding the drum: seeded registration
>   crosses, coordinate captions, whisper floods in empty cells.
> - **Card chrome**: service tags now persistent brand-black fill — a LIGHT
>   accent is used AS ink on the black (`--project-color-on-black`), dark
>   accents fall back white; enter_world pulses its FILL toward the new
>   `--color-dim-gray` token (`?fp1mix` depth) instead of dipping opacity.
> - **Detail page**: AlbumArtViewer rides the DeckScroller wall (BandPager +
>   per-release chips tabled with it); the same wall carries to the grid.
>
> **Round 2 (08-27 (3), Nathan's notes):** the ripple is the chosen element —
> `?fpglow=1` is now a clock-driven RIPPLE BENCH: `?ripvar` 1 pulse ring /
> 2 wavetrain (drop `?ripspeed` ≈ 0.2 to see several rings alive) / 3 droplet
> (crisp front + damped trailing crests, DEFAULT — the water read); every
> launch stays on the house-pulse cadence with enter_world. `?ripshade` 0
> (default) = FLAT cell fill to the grid lines · 1 = hairline-inset
> bevel/emboss. `?ripspeed` (fraction of capped radius per second, 0.45) ·
> `?ripfall` (decay length × radius, 0.9) · `?riprad` (extent × window
> half-diagonal, 1) · `?ripw` (crest half-width in cells, 4). Spine tabs sit
> OUTSIDE the media frame (hanging off the bottom-left corner; nav YIQ ink
> rule). Wall canvas 640 → 1152 desktop (page requests 800). The home hero
> enter_world inherits the fill pulse (brighten polarity: black →
> --color-dim-gray via --cta-pulse under the blue pour).
>
> Open for Nathan: ripple variation + shade + speed/falloff/radius taste,
> `?fpglowa`, furniture on/off, wall drift/gear, `?fp1mix` depth,
> per-release metadata's new home if wanted, chrome keep-outs for
> [PREVIOUS]/[NEXT] (still deferred), mobile pass (deferred, as with HR-6).
>
> **Ripple BAKED (08-27 (5), Nathan's final dial):** `ripvar=3 ·
> ripspeed=0.15 · ripevery=4 · ripfall=0.13 · ripw=5 · ripalpha=1` are the
> shipped defaults — sparse launches (every 4th pulse), FULL-ink crests with
> a tight falloff doing the dimming (the heart burns bright and dies fast
> with distance). The tagline pill + copyright ride the footer-link 16/22
> tier (VISUAL WORLDS keeps Medium); privacy closes the footer row at
> `--weight-medium`, brand blue at rest, white on hover.
>
> **POST-MERGE FOLLOW-UP (Nathan, 08-27):** after this branch folds in, run a
> SITE-WIDE token sweep — replace hardcoded CSS literals (sizes, line-heights,
> tracking, weights, colors, spacing) with design-system variables, MINTING
> new tokens where no existing one matches or sits close to the value. The
> pill-line pass (c6d9c5c: `--text-pill`/`--lh-pill`/`--weight-medium`/
> `--tracking-body`, then the 12-site `-0.005em` sweep across global/process/
> project-detail) is the model: swap is mechanical, resolved values must stay
> byte-identical, and a token only earns its name with real consumers.
>
> Grounding: candidate mechanisms were adversarially verified against the real
> scene code (useWorldScene / buildShell / seededLayout / worldLive / worldBands)
> — all three came back *feasible-with-changes*; the corrections are folded in
> below.

## Shared foundation (built once, before any iteration)

- **Macro-cells.** The shell's fine lattice (250×230 → 1.44°×0.78° cells, ~47×54
  visible) is texture, not a compositional unit. All modes compose on
  **macro-cells** — blocks of k×k fine cells (k tunable) — with asset ratio →
  whole-cell span rounding. A small `fpGridCells.js` owns: aspect-aware visible
  angular window (lens crop included), ratio→span, seeded occupancy placement,
  border-polyline sampling via `buildShell`'s `sph()`.
- **Seeding.** `seededLayout`'s normalized phyllotaxis + mulberry32 output is
  **remapped, not replaced**: (nx,ny) → angular/cell coordinates, then quantized
  to cells. CENTER_CLEAR survives as a reserved central block for the WorldCard;
  the band keep-out machinery collapses into "these cells are occupied."
- **One body.** `SHELL_SPIN` → 0 in all grid modes. Per-tier differential
  parallax dies; each mode has its own one-body parallax answer (below) so the
  three don't converge on the same stillness.
- **Live video.** `WorldLiveScheduler` budget/rotation/suspend survive verbatim.
  One seam: `promote()`/`coverFit` read `geometry.parameters.width/height`
  (PlaneGeometry-only) — the overlay builder becomes a mode-supplied factory
  (flat plane for mode 2, curved sector clone for 1/3; tile records carry their
  own aspect). Eligibility: tierIndex 0 = the designated live blocks
  (largest/most central video blocks), parented in `tierGroups[0]` so the
  clearSlot contract holds.
- **Enter dive + benches.** `applyEnter` is camera/post-side and survives
  untouched; on-sphere modes make the dolly channel ~4× weaker (radius 16 vs
  z≈−3.8), so the dive goes zoom-dominant — a `?entertune` re-bake, not code.
- **S2 accent.** The shell-tint tween extends to borders/lattice/frame materials
  so the whole field recolors per project as today.
- **Idle beat.** With spin dead each mode carries a deliberate idle life
  (requirement, not decoration — a frozen field reads broken).

---

## `?fpgrid=1` — ATLAS (plates printed on the globe)

Media is ON the curved wall. Each asset is a true spherical plate — a
`SphereGeometry` sector snapped to whole cells, a hair inside the shell radius —
like engraved plates of a 19th-century atlas bound to its graticule. The
lattice is the ruled sheet the work is registered to: its lines run into each
plate's edge, which carries the same rule inked one weight heavier in the
project accent. Occupancy is a sparse cartographic constellation — charted
territory with wide empty graticule between plates reading as ocean; the center
is an unmarked clearing where the WorldCard sits like a title cartouche. On a
World Turn the **graticule stays fixed while the constellation of plates rolls
across it** (the existing pivot roll — rotation about the origin keeps plates
on-sphere, so the Turn survives verbatim), and as the house ease settles the
incoming plates land into perfect cell registration — an editorial snap.
Pointer = head-turn: a small camera look-around, zero relative slip, the lens
warp swimming subtly like a planetarium platform.

Mechanism (rough):
- Sector geometry with 1 segment per fine cell spanned; borders land exactly on
  cell lines. Plates at R−ε; explicit `renderOrder` (plates < video overlays <
  shell < accent borders) — the transparent-pass painter sort is distance-0 for
  everything sphere-centered, so ordering must be deterministic, not depth-hoped.
- Longitude convention: `sph()` vs `SphereGeometry` phi mirror-mismatch mapped
  once (φ = π−lon); view center sits at lon 3π/2. BackSide + interior view
  mirrors textures → U-flip in the cover-fit (or deck pages read backwards).
- Appear = angular slerp toward rest cells + opacity (the planar spawn/scale
  lerp in `applyParallax` would slide plates off the sphere — plate records get
  their own motion branch). Optional: per-cell-column stepped alpha wipe
  (OS-boot language landing in the grid).
- Turn: slots/pivots/crossfade/lens spike unchanged; single scene-level shell
  keeps the S2 tint contract (no second shell needed).
- Deck (bedouin): a **register strip** — 2–3 consecutive plates showing pages
  i..i+K, advancing on `cycleS` with a hard-edged wipe along the shared cell
  border. `bandPose`/keep-outs retire in this mode. Album covers = square
  plates in the strip's grammar.
- Idle beat: the register strip's advance + a faint stroke flicker on cells
  adjacent to plates (survey activity).

## `?fpgrid=2` — FORME (the locked letterpress sheet)

The flattest, most typographic reading: one Swiss page hanging in the sphere,
its column grid a **foreground lattice at tile depth** that the lens pass
curves — straight lines bent spherical by the same warp that bends everything.
Media are cuts locked into the forme: flat planes seated just proud of the
lattice, edges exactly on cell lines, each wearing a heavier rule that runs the
CTA ink states (dim → white flash → accent rest). **Empty cells do the
compositional work** — registration crosses at intersections, tiny mono cell
coordinates (`R04 C11`), an occasional whisper-opacity accent flood, corner
quoin ticks where a block is wedged in. The dimmed true shell stays behind as
deep atmosphere. The Turn is a re-plate as computation: no roll — a
deallocation wavefront sweeps the lattice on the house curve (bottom-to-top,
mirroring today's roll direction), outgoing blocks collapsing to stroke ghosts,
the incoming project allocating one beat behind the front, the wave visibly
parting around the WorldCard's reserve; lens spike crests as the front crosses
midfield. Parallax is post-process only: the pointer steers the lens pass's
principal point, so the whole frozen field's curvature leans toward the cursor
— the world bends toward you rather than sliding past.

Mechanism (rough):
- New coarse planar lattice (LineSegments, one draw call) at z≈−3.8,
  **deliberately coarser than the shell pitch** (2–4×, near-square,
  `?panepitch`) — a pitch-copied lattice moirés statically against the shell
  behind it, and fine cells are landscape 1.84:1 anyway.
- Media slightly in FRONT of the lattice (occludes interior lines at full
  opacity; lines ghost through during fades = boot language). Accent frames =
  thin quads (linewidth is clamped to 1px everywhere), slot-parented.
- One depth for media, per-slot ±0.005 z bias so contested cells can't z-fight
  during the Turn window; drift/spawn-lerp branches bypassed.
- Wipes = `localClippingEnabled` clip planes, constants snapped to cell rows
  (material-agnostic — works on tiles, video overlays, deck pages; the wipe
  must NOT replace materials or video sRGB decode breaks). All block windows
  ride ONE eased master progress inside `goToWorld`'s existing `apply(e)`
  (enterTune's `seg()`/`powInOut` windowed-channel model) so
  `finishTurnInstant`'s `progress(1)` contract survives.
- Live video: mechanically today's scheduler — overlay plane at OVERLAY_Z,
  crossfade optionally rendered as a scanline wipe via the same clip planes.
- Deck (bedouin): a **signature block** — one multi-cell frame, full-bleed page
  swaps on the Turn curve, mono folio cell reading `01/05`.
- Idle beat: ink breathing (per-tile `texture.offset` micro-pan inside immobile
  frames) + a random empty cell blinking its stroke every few seconds.

## `?fpgrid=3` — DRUM (one continuous world that revolves)

The maximal-motion pole: the shell reorients so its pole axis lies along X
(poles at the screen's left/right, outside the FOV — never visible), and media
plates are parented WITH the lattice into one **drum** — a single rigid body.
Each project dresses a fixed arc of the drum in rows laid along the drum axis;
the Turn is the room physically revolving: the whole drum pitches on the house
curve, the outgoing project's territory rolling up and out the top while the
incoming one wheels up from below — today's Turn direction grammar, now
carrying the grid itself, lens spike as the atmosphere compresses. The visitor
feels they are turning a heavy instrument. Cells behind the camera are
re-dressed for the next project. Pointer input micro-rotates the entire drum a
few degrees — the strongest one-body statement of the three.

Mechanism (rough):
- `buildShell()`'s LineSegments re-parented into a `drum` Group, geometry
  pre-rotated once so poles sit on ±X (shellRef keeps pointing at the
  LineSegments — S2 tint + dispose paths untouched). Media rows run ALONG the
  drum axis (constant drum angle) so whole rows convey out the top as rigid
  units.
- Arcs at exactly 120° (3-fold) so arc slots land on fixed drum angles; every
  Turn tweens to an ABSOLUTE target angle (absorbs any creep drift; 13 projects
  wrap and re-dress the hidden arc). Incoming arc dresses at Turn start (the
  existing buildSlot/buildGen contract — rest-time dressing breaks under spam
  paging); rest is only for speculative N+2 pre-dressing. Off-window arc zones
  dress sparsely (60–70% of a full arc is only ever seen at blur speed).
- Turn speed: 120° on the house ease peaks ~2× today's apparent sweep —
  mode-specific `?turnms` lengthening and/or a `SHELL_OPACITY` dip riding the
  lens-spike pulse to soften line strobing; MSAA stays 4.
- Plates at ~R−0.1 inside the lines (transparent back-to-front sort composites
  cleanly); parallax applied to the drum group itself, never to children (the
  screen-aligned tier translations would rotate with the drum mid-Turn).
- `goToWorld`'s external contract (direction sign, `finishTurnInstant` snapping
  the drum tween) preserved so pager/chrome/S2 need zero changes; scheduler
  `attach`/`suspend` called at the same points, per-arc tile records shaped
  exactly like `slot.tiles`.
- Deck (bedouin): **in-place block cycling** (verified: a filmstrip of
  BAND_HEIGHT pages eats ~93° — nearly the whole arc; killed). Two stacked
  sectors crossfading pages on the house curve inside one block.
- Idle beat: optional near-imperceptible drum creep (media conveys with it as
  one designed-for body) — **Nathan's call**, default 0.

---

## Distinctness at a glance

|                | ATLAS (1) | FORME (2) | DRUM (3) |
|----------------|-----------|-----------|----------|
| Geometry       | curved plates on the sphere | flat planes in one lens-curved page | curved plates fused to the sphere |
| The grid       | the real graticule, fixed | new coarse foreground lattice | the graticule itself, rotating |
| Turn           | plates roll across a still grid, snap-register on landing | nothing travels — dealloc/alloc wavefront | the whole world revolves |
| Parallax       | camera head-turn | lens principal-point drift | whole-drum micro-rotation |
| Occupancy      | sparse constellation | typeset spread + furniture | rows along the drum, arc-dressed |
| Deck           | register strip | signature block + folio | in-place cycling block |

## Open calls for Nathan

1. **Default mode** when `?fpgrid` is absent — proposal: `1` (worktree demos the
   refactor); legacy floating field stays at `?fpgrid=0`.
2. **DRUM idle creep** — on (very slow, one-body) or off.
3. Macro-cell scale (k) is live-tunable per mode; first bake mine, then yours.

## Verify protocol (per iteration, after approval)

Playwright (`chromium.launch({channel:'chrome'})` via the MCP-bundled package)
against `:4322`: screenshot each mode on **coco** (video-heavy) and **bedouin**
(deck-heavy), console clean, `npm run build` green. One commit per meaningful
step.
