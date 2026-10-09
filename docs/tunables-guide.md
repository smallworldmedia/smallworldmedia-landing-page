# Tunables & Debug Guide

Every live tuning knob and debug affordance on the site, read from the code on
2026-09-02 (`feature/v1-launch` @ `f625090` plus the uncommitted three-arm
pager build + the 09-02/09-03 scale refinement rounds; 09-07 logo ticker; 10-08 palette + footer variant + desktop rest layout): 338 URL params
across 27 reader files, 10 bench/debug panels, 4 debug globals. Regenerate it with the recipe at the bottom; `node scripts/tunables-keys.mjs --check`
fails if a param in the code is missing from this doc.

## How tunables work

**Everything is a URL query param, read on the client.** `?key=value` on the
page URL. Values parse with `parseFloat` / `Number`; anything non-finite falls
back to the default, so a typo is a silent no-op. Enum params compare exactly
(`?fillmode=Panels` ≠ `panels`). The server never reads them (`PARAMS` is null
during SSR), so SSR output is always the baked default.

**Three read-timing classes decide whether your param "took":**

| class | when it is read | consequence |
|---|---|---|
| module-load | once, when the JS module first evaluates (worldConfig, heroConfig, processConfig, enterTune, textExit, fp1Tune, footerTune, RouteFill, CtaArrows, WorldCard, NextProjectBand, DeckScroller, `?scroll` in FeaturedProjects) | Put the param on the URL you **hard-load**. The Astro ClientRouter keeps modules alive across soft navs and drops the query string, so a param added after load, or on a link you clicked to, does nothing until a full reload. Conversely, a param on the first-loaded page persists through soft navs for the session. |
| mount-effect | each time the island mounts (panel gates `?deckdebug` `?entertune` `?texttune` `?pager` `?debug`, BandPager/GridSocket effects, `?lerp` `?wheelmult` `?lenisdur` per route) | Reflects the URL at mount time. SiteShell panels persist through soft navs because the shell is `transition:persist`. |
| per-render | `?detent`, `?wheeldetent` (TapeWheelPager reads them every render) | Live. |

**Gate styles differ.** Presence gates (`?deckdebug`, `?entertune`, `?texttune`,
`?debug`) accept any value, even `=0`. Strict gates need exactly `=1`:
`?herotune=1`, `?committune=1`, `?fp1tune=1`, `?lenistune=1`, `?footertune=1`.
`?pager` is an enum gate (`=tape`).

**Bench seeds are mostly always-on.** Hero, text-exit, footer, enter, World and
process knobs seed from the URL whether or not their panel is open, so a copied
`copy_url` previews the dialed values on a plain load. The exceptions: the fp1
shape knobs need `?fp1tune=1`, and raw Lenis knobs last one route (the bench
re-applies them).

**Two `copy_url` flavors.** hero/commit, enter, text, fp1, lenis and footer
start from the *current* search string (other params ride along), force their
gate, write only non-default values and delete defaulted keys. The deck-debug
and process panels rebuild from the pathname and **drop every other param**.

**Same key, different meaning on different routes.** `?scroll` (/work fill
threshold + footer reveal + home-return; detail next-project threshold;
/process legacy alias of `?swipepx`), `?scatter` and `?drift` (/work tile field
vs /process fragment belt), `?camlag` (/work and /process camera lag, same
default), `?debug` (VideoGlobe aside on `/`; ProcessDebugPanel on `/process`;
window globals on `/work`), `?deckhome` `?deckhold` `?deckalbum` (/work deck
panel vs the tabled detail BandPager). The route decides.

**Reduced motion** (`prefers-reduced-motion: reduce`) short-circuits most
motion knobs: no Lenis, instant Turns, no appear tweens, no enter ramp, no
pulse, no caret loop, no live-video pool, static deck walls, plain-link
next-project band. Panels still mount and `copy_url` still works.

**Bake law.** When a value is blessed, write it into the constant or token in
the `bake` column, then drop the param from your URL. Never leave a blessed
value living only in a `copy_url` link.

## Bench panels at a glance

| gate | route | corner | dials | copy_url |
|---|---|---|---|---|
| `?herotune=1` | `/` | top-right | hero camera rig (fill/offset/elev/roll), commit rehearsal, globe flow + orientation, pole cap, intro variant, labels; `▶ commit dry-run`, `↻ replay intro`, `↺ reset` | current search + `herotune=1`, non-defaults only |
| `?committune=1` | `/` | bottom-right | typed number fields for the commit choreography, incl. the knobs the slider bench lacks (`recenterstart` `zoomend` `campow` `envscale` `bluesurge` `bluedipend` `bluedipdepth` `loaderlead` `loaderend`); `▶ dry-run`; Enter commits a field | same serializer, swaps `herotune` for `committune=1` |
| `?poptune=1` | `/` (branch `refine/globe-worlds`) | bottom-right (collides with committune); under the nav, collapsed to a `⌁ worlds · <world> · <hold left>s` chip ≤768px | globe population: mode; change (hold, jitter, change time, transition set, chaos); world (worlds on the globe, one-world layout or the pattern set); media (kind, cap / world, share); video · colour (shared streams, world colour); `⏭ next world`, `↻ reroll`, `↺ reset`; live readout of `window.__swmPopStats` | current search + `poptune=1` + `popseed` (always), non-defaults only |
| `?debug` | `/`, `/lab/globe` | bottom-left | VideoGlobe aside: cascade-variant buttons, `↺ replay`, gap/cap sliders (commit on release, they rebuild the scene), fps/tex/live/vis/pool stats | none |
| `?lenistune=1` | every route (Lenis is live only on document-scroll routes, so dial on a `/work/[slug]` page) | bottom-left | lerp, wheel mult, duration (duration > 0 overrides lerp); `↺ reset`; `copy values` emits the `LENIS_TUNING` block | current search + `lenistune=1`; diff baseline is the *library* default 0.1 / 1, not the bake |
| `?footertune=1` | every route (dial on `/process` or a detail page) | top-left | lockup height (rem), reveal travel K; `↺ reset` | current search + `footertune=1`, non-defaults only |
| `?entertune` | `/work` | top-right | enter-world ramp: ms, lens deepen + window, zoom scale, dolly, move window, pow, dry-run hold/cover; `▶ dry-run`, `reset`; typed fields | current search + `entertune=1`, non-defaults only, deletes legacy `entercover` |
| `?texttune` | `/work` | top-left | text-exit choreography: tag/char cut ms, tab + nav delays/durations, card + nav scale; `▶ dry-run`, `reset`; typed fields | current search + `texttune=1`, non-defaults only |
| `?fp1tune=1` | `/work` | bottom-right | house-pulse shape (peak x, softness, hold end, fall ease) + envelope (period, dim [dead], rest, on-ratio) with an SVG plot; `↺ reset`; `copy values` emits the `HOUSE_PULSE_*` block | current search + `fp1tune=1`, non-defaults only |
| `?deckdebug` | `/work` | bottom-right (collides with fp1tune); collapses to a `⌁ deck` chip ≤768px | deck viewer: cycle, spacing, home x, fan, pile, hold, album scale, deck x/y; `↺ reset` | **rebuilt from pathname**, other params dropped |
| `?debug` | `/process` | bottom-left; chip on phones | stage buttons 01–05, `↻ replay`, fps/draws/stage, 23 sliders + 5 selects for the whole process scene | **rebuilt from pathname** + `?debug`, ms knobs as ms |

Corner map: top-left = texttune / footertune · top-right = herotune / entertune · bottom-left = lenistune / globe debug / process debug · bottom-right = committune / poptune / fp1tune / deckdebug.

## `/` home — hero rig, commit rehearsal, globe, intro, labels

Readers: `src/components/hero/heroConfig.js` (module-load seed of `TUNING`, always on) and `src/components/Hero.jsx` (`?intro`, per mount). Panels: `?herotune=1` (sliders), `?committune=1` (typed). Bake home for the family: `heroConfig.js TUNING_DEFAULTS` / `COMP_DEFAULTS`, or the `globeConfig.js` constant named.

**Live vs rehearsal.** Since 08-30 the real `enter_world` click runs `onEnterClick` (Hero.jsx:669-710) on the `?enterms` family, then `swm:envelop {loader:true}` and `navigate('/work')`. The commit-choreography knobs marked *dry-run only* shape `beginEnvelopment`, which only the benches' `▶ dry-run` still calls. Of that family only `?loaderend` (and site-wide `?fillrelease`) still paces the real passage.

### Gates and curve strings

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?herotune` | mounts HeroTunePanel | off | exactly `1` | — |
| `?committune` | mounts CommitTunePanel | off | exactly `1` | — |
| `?globestroke` | outer blue stroke ring proud of the globe disc, percent; glyph framing shrinks to fit (thinning the ring GROWS the globe inside the lockup "o" — globe + ring = glyph diameter); `0` removes the div; full reload only. **10-07: split by tier** (`IS_MOBILE`) — one `?globestroke` overrides both | `6` % desktop · `5` % mobile (10-07 bake; was `8.2`) | any finite | `heroConfig.js:52-60` |
| `?introease` | CustomEase SVG path for the entrance settle (arrive + replay) | `M0,0 C0.36,0.04 0.4,0.96 1,1` | any path string; URL-only, never serialized | `heroConfig.js:74` |
| `?commitease` | **dead**: read into `HERO_COMMIT_EASE_PATH`, imported by nothing; the master timeline is linear since 08-25 | `TURN_EASE_PATH` | any string | nothing |

### Camera rig (live, re-stamped on every bench publish)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?herofill` | globe fill fraction of the fit axis | desktop `null` → device `FILL_FRACTION` 0.85; mobile `0.95` | finite > 0; slider 0.5–1.6 / 0.01 | `heroConfig.js:114,121`; `globeConfig.js:43` |
| `?herofit` | fit axis | device (`contain` on both) | `contain` \| `cover`; else device; no bench control | `heroConfig.js:114,121`; `globeConfig.js:42` |
| `?herox` / `?heroy` | view offset, fraction of the half-viewport (+x right, +y down) | `0` / `0` | slider −1..1 / 0.01 | `heroConfig.js:114,121` |
| `?heroelev` | camera elevation off the equator | `8` deg | slider 0–90 / 0.5 | `heroConfig.js:114,121` |
| `?heroroll` | camera roll about the view axis | `0` deg | slider −20..20 / 0.5 | `heroConfig.js:114,121` |

### Commit choreography (dry-run only)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?commitms` | master commit timeline length | `1200` ms | slider 400–3000 / 50; typed | `heroConfig.js:137` |
| `?fillmode` | how the blue reaches the viewport | `panels` | `panels` \| `circle` | `heroConfig.js:138` |
| `?bluecascade` | panel-delay model for the panels-mode surge | `sweep` | `sweep` \| `rows` \| `poles` \| `random` | `heroConfig.js:139` |
| `?bluestart` / `?blueend` | timeline fractions where the blue window opens / the last panel lands (the disc spread starts at end) | `0` / `0.3` | slider 0–0.9 and 0.1–1, step 0.05 | `heroConfig.js:144-145` |
| `?recenterstart` / `?recenterend` | recenter channel window, timeline fractions | `0` / `3` (lands ~31% in at handoff) | typed; the slider caps at 1 so it cannot show the default | `heroConfig.js:160-161` |
| `?zoomstart` / `?zoomend` | dolly window, timeline fractions | `0` / `1` | slider 0–0.9 / 0.05; typed | `heroConfig.js:162-163` |
| `?campow` | power-inOut exponent for both camera channels | `1.2` | typed only | `heroConfig.js:164` |
| `?envscale` | dolly destination `rig.zoom` | `3.0` | typed only | `heroConfig.js:165` |
| `?bluesurge` | per-panel blue-surge transition length | `0.1` cascade delay-units | typed only | `heroConfig.js:172` |
| `?bluedipend` / `?bluedipdepth` | dip beat's share of the surge / brightness floor = 1 − depth | `0.4` / `0.2` | typed only | `heroConfig.js:173-174` |
| `?loaderlead` | **live again (10-06)**: ms after the Enter World button is out (the 0.2 s `CHROME_OUT_SECONDS` exit) before `swm:loader-start` fades the overviews_loading bar up, so the bar never shows under the button. Capped at `?enterms` | `350` ms (bar at 550 ms) | typed only | `heroConfig.js:150` |
| `?loaderend` | **live**: overviews_loading bar's paced close to 100% and the fill-reveal wait (RouteFill) | `500` ms | typed only; floor 0.05 s | `heroConfig.js:151` |

### Globe flow, orientation, pole cap (live)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?cascadespeed` | meridian-scroll pace, rows pole-to-pole (also the video-load knob); `0` parks | `2` | slider 0–40 / 0.5 | `heroConfig.js:185` |
| `?herotilt` | brand tilt, camera-facing pole lean (bench note says "40 default", stale) | `45.5` deg | slider 0–90 / 0.5 | `heroConfig.js:201` |
| `?heroyaw` | static spin about the axis | `0` deg | slider −180..180 / 1 | `heroConfig.js:202` |
| `?yawspeed` | steady auto-rotation; `0` fixed | `-2` deg/s | slider −30..30 / 0.5 | `heroConfig.js:203` |
| `?polelift` | bottom fraction of a pole tile dissolved to blue | `0.7` | slider 0–1 / 0.01 | `globeConfig.js:120 SCROLL_POLE_TIP_LIFT` |
| `?poletip` | bottom-cap horizontal radius at the pole | `0.5` | slider 0–0.5 / 0.01 | `globeConfig.js:110` |
| `?polewide` | away-end + wall radius at the pole | `0.3` | slider 0–0.3 / 0.01 | `globeConfig.js:111` |
| `?polestart` | sin(θ) below which the pole cap ramps in | `0.4` | slider 0.02–1 / 0.02 | `globeConfig.js:112` |
| `?corner` | base rounded-tile radius, UV units (the initial material uses the baked value; the URL applies on the next stamp) | `0.07` | slider 0–0.3 / 0.01; keep < 0.5 | `globeConfig.js:133 PANEL_CORNER_RADIUS` |
| `?polecap` | persistent blue dome over each pole, angular radius; `0` off | `6` deg | slider 0–20 / 0.5 | `globeConfig.js:127 SCROLL_POLE_CAP_DEG` |

### Intro and labels

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?intro` | three reads in one: mode force (`full`, `replay`), forced-variant machine (`a`, `c` mount the retired HeroIntro wordmark), and `TUNING.intro`. Without it `sessionStorage['swm:hero-intro']` decides: first visit → full arrive settle, later → replay; RM → `rm` | session | `full` \| `replay` \| `a` \| `c` | `heroConfig.js:210` (variant only) |
| `?introms` | variant-A total intro length | `4700` ms (≥1500) | slider 2500–8000 / 100 | `heroConfig.js:211` |
| `?introhold` | hold after the chars land | `400` ms | slider 0–2000 / 50 | `heroConfig.js:212` |
| `?introcascadeat` | when the glyph-scale cascade fires | `900` ms | slider 600–3000 / 50 | `heroConfig.js:213` |
| `?heroink` | gap-lattice ink white→blue across the launch | `0` | `1` \| `0` | `heroConfig.js:214` |
| `?herolabels` | mount the blob-tracking label layer (comments still say "shipped ON"; the bake is OFF; never under RM) | `0` | `1` \| `0` | `heroConfig.js:89 HERO_LABELS` |
| `?labelmax` | concurrent label chips | desktop `6`, mobile `1` | slider 1–8 / 1 | `heroConfig.js:220` |
| `?labelhold` | seconds a chip holds before re-slotting | `4.8` s | slider 0.5–6 / 0.1 (floor 0.3) | `heroConfig.js:221` |
| `?labelstroke` | leader-line length / chip offset | `48` px | slider 0–160 / 2 | `heroConfig.js:222` |

The `introms` / `introhold` / `introcascadeat` / `heroink` rows, the bench's `variant` control and `↻ replay intro` only do anything when the page was **loaded** with `?intro=a|c`. Without it, replay re-runs the arrive settle.

### Globe population modes (live; branch `refine/globe-worlds`, plan `docs/globe-worlds-plan.md`)

Reader: `src/components/globe/popConfig.js` (module-load seed of `TUNING`, always on — the knobs work without the panel), consumed by `PopulationDirector.js` through `useGlobeScene`. Panel: `?poptune=1` (PopTunePanel). A mode change builds or drops the director without rebuilding the scene; `poplive` swaps the video mode in place; the change-clock knobs (`pophold`, `popholdjit`, `poptrans`, `poptransset`, `popchaos`, `popcolor`) apply from the next change; every other knob re-lays the current world as a staggered blink (a cut before the entrance settles, under the commit's blue, and under RM). Baked from Nathan's own calls only: `popgroup` one world (his P1 read, 09-26), then his 10-06 dial — `tides`, `all`, cap `13`, `weighted`, `6` s ± `0.2`, `0.9` s `surge`, chaos `1`; the seed stays random per visit (his call). `?popmode=off` restores the pre-worlds globe (no director, the flat asset pool, per-tile video, brand blue).

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?poptune` | mounts PopTunePanel | off | exactly `1` | — |
| `?popmode` | `off` = today's globe; `tides` = featured-project worlds over the scroll tape, one at a time by default (`popgroup`), each holding `pophold` s and then giving way to the next through a transition from `poptransset`; the world's `projectColor` tints the globe and the home chrome (`popcolor`) | `tides` (Nathan 10-06) | `off` \| `tides` (`blend` arrives in P4) | `popConfig.js POP_DEFAULTS.mode` |
| `?popseed` | run seed: the start world, each grouping's pattern, and the change clock's draws (hold jitter, chaos picks) | random per visit | integer ≥ 0 | never (per visit by design) |
| `?popgroup` | worlds on the globe at once. 1 = one world (`poplayout`); 2–3 = a grouping laid out by a pattern from `poppattern`, each change relaying A+B → B+C | `1` (Nathan 09-26: one world reads strongest) | 1–3 (clamped) | `POP_DEFAULTS.group` |
| `?poplayout` | one world's layout (`popgroup=1`): `mix` = its media interleaved over the whole globe, never the same asset on a lon or row neighbour; `facets` = its media kinds (videos / stills / art) become regions, the world read as a system (a pool with one kind stays `mix`) | `mix` | `mix` \| `facets` | `POP_DEFAULTS.layout` |
| `?poppattern` | 2–3 worlds only: the pattern set each grouping draws from, comma list; unknown names dropped, empty → default. Here `facets` is just a Voronoi shape (3 cells a world); the media-kind reading is `poplayout=facets` | `continents,archipelago,spiral` | `continents` `archipelago` `gores` `bands` `spiral` `facets` | `POP_DEFAULTS.patterns` |
| `?pophold` | seconds a world holds before the next change, counted from the moment the last change landed. The clock runs only while the globe is free to animate: after the entrance, not under the commit's blue, never under RM (the first world holds; only `⏭` moves it, as a cut) | `6` s (Nathan 10-06) | 2–60 (clamped) | `POP_DEFAULTS.hold` |
| `?popholdjit` | ± fraction of `pophold`, drawn per change from the seed (6 s ± 0.2 → 4.8–7.2 s) | `0.2` (Nathan 10-06) | 0–0.9 (clamped) | `POP_DEFAULTS.holdJit` |
| `?poptrans` | seconds a change takes. A `tide` rolls the scroll one full pole-to-pole span over it on power3.out (steep launch, settles into the rest pace, no overshoot), so it's the time the new world takes to fill the globe; `blink` / `surge` stagger their tiles across it (each tile's dip 0.3 × `poptrans`, held to 0.3–0.9 s). The plan's 1.6 predates the full-span tide | `0.9` s (Nathan 10-06) | 0.3–8 (clamped) | `POP_DEFAULTS.trans` |
| `?poptransset` | the transitions changes draw from, comma list; unknown names dropped, empty → default. `tide` = the scroll surges a full span, the new world pours in from the top pole as the old drains out the bottom (nothing changes in place, the persistence doctrine); `blink` = each tile swaps under a CRT dip; `surge` = each tile swaps under a flood of the accent; `cut` = every tile at once. Before the entrance lands, under the commit and under RM a change is always a cut; a tide with no scroll to surge lands as a blink | `surge` (Nathan 10-06) | `tide` `blink` `surge` `cut` | `POP_DEFAULTS.transitions` |
| `?popchaos` | unpredictability, per change: 0 = the /work World order and the transition set in turn; 1 = a random next world (never the current one or the last 4) and a random transition; between = the chance of each | `1` (Nathan 10-06) | 0–1 (clamped) | `POP_DEFAULTS.chaos` |
| `?poplive` | video on the world's tiles: `shared` = one decoded stream per clip feeds every tile showing it (repeats play in sync; the same decode budget lights more tiles — the probe saw 7 decodes on 31 tiles; a lower `popcap` means more repeats); `tile` = one decode per live tile (today's scheduler) | `shared` | `shared` \| `tile` | `POP_DEFAULTS.live` |
| `?popcolor` | `1` = the world's `projectColor` drives the globe (lattice, inner sphere, pole caps, the surge flood — a 1.7 s tween) and the home chrome through `html.pop-tint`, the accent path /work already uses (hero gradient, globe stroke / fill, nav pill hover, open menu + drawer, Enter World CTA, the passage to /work); `0` = brand blue | `1` | `1` \| `0` (any > 0 → 1) | `POP_DEFAULTS.color` |
| `?popenter` | `1` = Enter World (the CTA, the scroll commit, their RM paths) opens /work inside the world on the globe: the click holds the change clock, Hero hands the world's slug over as `sessionStorage['swm:enterWorld']`, and /work lands there as a snap (the scene builds it at once, one card boots in, the pager jumps, the accent never passes through the first World, the passage fill lifts once that card is up); `0` = /work's first World, as before. Read at the click, so the bench toggle applies to the next Enter | `1` | `1` \| `0` (any > 0 → 1) | `POP_DEFAULTS.enter` |
| `?popnames` | client-name strips (`nameTicker.js` draws + measures, `PopulationDirector.planNames` places) — how many strips a world puts on the globe. Each is a run of adjacent tiles of ONE scroll row showing the world's `clientName` in the FP card face (`.fp-card__client`: OT Neue Montreal Squeezed 600, uppercase, -0.02em) on one shared texture, STILL (10-07: the ticker is gone). The strips are chosen once per world change against the live scene — mid-latitude (`popnameband`), front-facing (`popnameface`), in the quadrant opposite the last world's — and then travel pole to pole with their row like any tile. A row re-born at the pole is outside the band by construction, so names refresh at a change, not at a birth: under `?poptransset=tide` (which re-births every row) the globe carries no strips at all. `0` = none. Re-lays the world | `1` (10-07, not yet dialed) | `0`–`4` (integer) | `POP_DEFAULTS.names` |
| `?popnamemode` | the strip's layout. `region` = a run of tiles sized to the name (below), reading it once edge to edge; `band` = `popnames` whole latitude rows, the name repeating around the globe (the row walks with the change, so the band moves between worlds — still inside `popnameband`, but a band necessarily wraps behind the globe, so the facing gate doesn't apply). Re-lays the world | `region` | `region` \| `band` | `POP_DEFAULTS.nameMode` |
| `?popnamesize` | the type's size: font px per strip height (caps land at ≈ 0.7 × this of the tile). Was a baked `0.86`; Nathan 10-07: "reduced slightly". It also shortens the strip (the name's width scales with the px, its clear space does not), so it is half the clipping fix. Re-lays the world | `0.62` (10-07, not yet dialed) | 0.3–1.2 (clamped, 2 dp) | `POP_DEFAULTS.nameSize` |
| `?popnameband` | the middle fraction of pole-to-pole a strip may sit in — Nathan: "only … the panels that are currently in the middle area away from the poles". `0.65` = the middle 65% of the polar angle, i.e. \|`centerDir.y`\| ≤ 0.85 (`centerDir` is unrotated, so its y IS the latitude). Measured on the row, so a strip is never half in. Re-lays the world | `0.65` (10-07, not yet dialed) | 0.1–1 (clamped, 2 dp) | `POP_DEFAULTS.nameBand` |
| `?popnameface` | how much of the circumference counts as front-facing, as a fraction: `0.5` = the visible half (every tile of the strip must clear a camera-rotated `.z` of `cos(π × this)` = 0). EVERY tile is gated, not just the start, so a name is never half round the back. Tighter values pull the strip toward the centre but shrink the admissible set — with a span near half the globe they force the relaxation below. Re-lays the world | `0.5` (10-07, not yet dialed) | 0.05–1 (clamped, 2 dp) | `POP_DEFAULTS.nameFace` |
| `?popnamespanmin` | the FEWEST tiles a strip may use. The width itself comes from the MEASURED name — Nathan: "the number of panels that are occupied by the client name based on the client name" — as `ceil(stripAspect / panelAspect)`, which is exactly the count at which the whole name reads at rest (a tile shows `panelAspect / stripAspect` of the strip, so a short span is what used to cut the long names; the ticker only hid it by scrolling the rest past). Re-lays the world | `2` (10-07, not yet dialed) | 1–12 (clamped integer) | `POP_DEFAULTS.nameSpanMin` |
| `?popnamespanmax` | the MOST tiles a strip may use. A name that needs more has its type shrunk to fit the span instead, so it is never cut either way. It is also the knob that trades width against placement: a span near half the globe can only sit centred in the front-facing half, so the quadrant gate relaxes (the bench readout and the probe's `namePlaced.relaxed` say when) — lower it to keep the alternation. Re-lays the world | `6` (10-07, not yet dialed) | 1–12 (clamped integer) | `POP_DEFAULTS.nameSpanMax` |
| `?popnamestyle` | `ink` = the world's `projectColor` letters on black; `fill` = black letters on the colour (a world without a colour uses brand blue). Re-lays the world | `ink` | `ink` \| `fill` | `POP_DEFAULTS.nameStyle` |
| `?popgrainamt` | **panel grain** (10-07 round): the FP pager scrim's dialed turbulence tile (`scrimNoise.js SCRIM_GRAIN`) painted over a panel's media wherever the row is pinched near a pole, so the eye never sees the warped, cropped media the pinch produces. Master mix ceiling, and the **off switch** — the shader branch is gated on `> 0`, which is what keeps /process, /lab, `liveLockupGlobe` and the home globe at rest pixel-identical. Sampled in `mUv`, the same pinch-compensated tile UV the media uses, so the cells hold constant pixel density as the panel narrows (the no-warp requirement) and the static belongs to the TILE, not the screen | `0` = off (ships off, Nathan to dial) | 0–1 (clamped, 2 dp) | `POP_DEFAULTS.grainAmt` |
| `?popgraincells` | grain tile repeats across ONE panel — the cell-size dial. Tile-local, so the pole pinch never scales the cells; raise it for finer static. (The scrim's screen-space equivalents are `?grainsize` 184 desktop / 90 mobile — a different unit, deliberately not shared) | `3.5` | 0.25–32 (clamped, 1 dp) | `POP_DEFAULTS.grainCells` |
| `?popgrainfps` | re-times the shipped 8-frame held jitter (`scrimNoise.js GRAIN_JITTER`, the one source for the `fp-scrim-grain` keyframes), so one number means the same thing on both surfaces. `0` = frozen static; forced `0` under `prefers-reduced-motion`, honouring the globe's stills-only doctrine | `30` (the scrim's bake: 8 frames / 0.2667 s) | 0–60 (clamped, int) | `POP_DEFAULTS.grainFps` |
| `?popgrainstart` | the `vK` (= sin θ_center, the panel's width ratio vs the equator) **below** which grain is at full strength. Same units as `?polestart` (`0.4`), deliberately — the grain hands off to the existing pole cap with no untreated gap between them. `vK` is symmetric about the equator, so ONE threshold returns a row to static at the far pole for free | `0.45` | 0.02–0.95 (clamped, 2 dp) | `POP_DEFAULTS.grainStart` |
| `?popgrainramp` | width of the grain→media handoff smoothstep, in the same `vK` units, so the reveal is a crossfade rather than a hard line. Keep `start + ramp` under 1.0 | `0.15` | 0.02–0.6 (clamped, 2 dp) | `POP_DEFAULTS.grainRamp` |
| `?popgrainstagger` | per-tile spread of the reveal threshold, in `vK` units. **Required, not polish:** a row is iso-latitude (all its tiles share one θ_center — `panelMaterial.js` says so outright, "vK is a flat varying"), so without a spread every tile in a row crosses the threshold on the SAME frame and the row blinks on in lockstep. Implemented as a threshold shift per tile, not 12 tweens — no timeline, no gsap, no new rAF. `0` = the blink | `0.07` | 0–0.4 (clamped, 2 dp) | `POP_DEFAULTS.grainStagger` |
| `?popgrainorder` | which `panelDelay` ordering the stagger follows, so this third staggered reveal answers to the same names as the entrance cascade and the commit blue fill. Validated against `DELAY_ORDERS` (`cascade.js`), which is now the single authority on the orderings `panelDelay`'s switch actually implements | `sweep` (Nathan's pick elsewhere) | `sweep` \| `rows` \| `poles` \| `random` | `POP_DEFAULTS.grainOrder` |
| `?popgrainlive` | `1` = the grain band ALSO withholds live video from the tiles inside it, redirecting the decode budget to mid-latitudes. **Only a real saving in `?poplive=tile`** (where each live panel burns one of `MAX_LIVE` 7 desktop / 4 mobile); in the shipped `shared` tier the budget is per CLIP, so it changes which clips win, not how many decode. Costs more promote/demote churn where the eye actually is | `0` = presentation only | `0` \| `1` | `POP_DEFAULTS.grainLive` |
| `?popmedia` | a world's tile media: `showcase` = its /work World's showcase Tiles (videos + stills), `all` adds album art; a filter that leaves < 3 falls back to the world's whole pool | `all` (Nathan 10-06) | `showcase` \| `all` \| `video` \| `still` \| `art` | `POP_DEFAULTS.media` |
| `?popcap` | per-world pool cap (texture residency: the director holds the current + next grouping warm) | `13` (Nathan 10-06; was desktop 24 / mobile 16) | 1–32 (clamped) | `POP_DEFAULTS.cap` |
| `?popshare` | tape area per world: `equal`, or `weighted` ∝ its pool size | `weighted` (Nathan 10-06) | `equal` \| `weighted` | `POP_DEFAULTS.share` |

Probe: `node scripts/globe-probe.mjs [--mobile] [--rm] [--next=2] [--mode=off] [--paint] [--enter]` (dev server on `:4322`) reads `window.__swmPopStats` and gates integrity, black tiles, texture count, quiet holds, `⏭` landing, the world changing on its own clock, the chrome wearing the world's colour, the name strips (`namesPlaced`, `namesInBand`, `namesFrontFacing`, `namesSlice`, `namesStill` — read off `namePlaced`, the placement’s own measurements of the band / facing gates it had to clear, and `nameSlices`, the strip range each tile actually RENDERS once panelMaterial’s pole pinch has centre-cropped it), (`--paint`) the hero gradient arriving through in-between colours, and (`--enter`) Enter World landing /work inside the world on the globe — no Turn, no pager glide, no first-World accent, the fill held until the entered card is up — plus the breadcrumb back reopening it.

## `/` and `/lab/globe` — VideoGlobe live-video tier

Reader: `src/components/globe/globeConfig.js` (`PARAM()`, module-load). Consumer: `LivePanelScheduler.js`. Every other globeConfig export (geometry, `FPS_CAP`, `DPR_MAX`, `THUMB_WIDTH`, `STREAM_PARAMS`, `MAX_LIVE`, `SCROLL_*`, colors) is a plain constant with no URL knob; `IS_MOBILE` (≤768px, frozen at load) picks the device defaults.

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?promote` | facing score above which a panel fades in HLS video (slot free, cooldown elapsed) | `0.03` | any finite | `globeConfig.js:74 PROMOTE_SCORE` |
| `?demote` | hysteresis score below which a live panel fades back to its still after the 4 s min dwell | `0.06` | any finite | `globeConfig.js:75 DEMOTE_SCORE` |
| `?dwellmax` | max live dwell before a slot rotates off (randomized ×0.75–1.25 per panel) | `12` s | any finite | `globeConfig.js:78 MAX_LIVE_DWELL_SECONDS` |
| `?cooldown` | re-live cooldown after rotation | `6` s | any finite | `globeConfig.js:79 RELIVE_COOLDOWN_SECONDS` |
| `?debug` | mounts the VideoGlobe debug aside (on `/lab/globe` it is on in dev regardless) | off | presence | — (its gap/cap sliders bake to `globeConfig.js:30-31 GAP_DEG` 1.1 / `CAP_DEG` 24) |

## Site-wide — RouteFill passage

Reader: `src/components/RouteFill.jsx` (`PARAM()`, read once when the persistent shell first mounts).

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?fillcover` | fallback cover fade-in when a `swm:envelop` omits `detail.duration`; **unreachable**, every dispatcher passes one | `100` ms | any finite | `RouteFill.jsx:36` |
| `?fillrelease` | **live** fill fade-off over the arriving scene + the mirrored loader fade; instant under RM | `400` ms | any finite | `RouteFill.jsx:37` |

Non-param constants: `RELEASE_DELAY` 0.1 s, `SAFETY_MS` 2500 (auto-release if a page loads covered), loader charge 0→82 over 1.1 s then →96 over 3.5 s (RouteFill.jsx:38-39, 83-84). `?loaderend` (hero family) paces the bar's close.

## Site-wide — Lenis scroll feel and footer reveal

Readers: `src/lib/smoothScroll.js` (raw params, per route), `src/lib/lenisTune.js` + `LenisTunePanel.jsx`, `src/lib/footerTune.js` + `FooterTunePanel.jsx`. Lenis is OFF on `/work` and under RM (`getLenis()` is null there).

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?lerp` | Lenis per-frame smoothing (inertia mode) | `0.165` (bake; library 0.1) | finite > 0; slider 0.02–0.3 / 0.005; **ignored when duration > 0** | `motion.js:143 LENIS_TUNING.lerp` |
| `?wheelmult` | Lenis wheelMultiplier | `1.25` (bake; library 1) | finite > 0; slider 0.5–2 / 0.05 | `motion.js:144 LENIS_TUNING.wheelMultiplier` |
| `?lenisdur` | Lenis duration in seconds: switches to duration mode, which overrides lerp | off | finite > 0; slider 0–2 / 0.05, 0 = off | `motion.js LENIS_TUNING.duration` (+ an easing) |
| `?lenistune` | mounts LenisTunePanel; enables URL seeding + per-route re-apply | off | exactly `1` | — |
| `?footertune` | mounts FooterTunePanel | off | exactly `1` | — |
| `?footerlockup` | SWM lockup art height → `--footer-lockup-h` on `<html>` (applies without the gate) | `3.2` rem | finite > 0; slider 2–6 / 0.1 | `footerTune.js:29` **and** the `global.css:1826` fallback (keep equal) |
| `?footertravel` | reveal travel = K × footer panel height (applies without the gate) | `1.8` | finite > 0; slider 1–3 / 0.05 | `footerTune.js:30` |
| `?footerrest` | HOME: the driven footer's RESTING progress — the panel parks here instead of 0, so the studio blurb is up on load with the logo band's "utilized by…" line fading in below it, and the gesture reveals the rest. Also latches `[data-footer-rest]` on `<html>` (the variant's whole CSS gate) and moves the `--footer-peak` reset to this floor. `0` restores the old retract-to-nothing feel. DEFAULTS per tier (the `?globestroke` idiom): 0.62 on phones, 0 on desktop — but an explicitly passed value reaches ANY width, so the desktop variant is dialable before anything is baked. The 0.62 measurement below is a 390×844 reading and does NOT transfer: at 1440×900 the panel is 258px (not 281px), so a desktop bake needs its own probe read. (The "and the blurb re-wraps" that stood here was overtaken the same day: above the crossover `?footerblurbfill` holds the blurb to one line, which is part of why the desktop panel is so much shorter than the phone's.) **RE-MEASURED 10-08 after the blurb moved into Sanity** — the new copy is shorter, so at 390×844 it sets as 4 lines rather than 5 and the panel is 281px (was 306px): the blurb box now ends at 0.415 of the panel (was 0.457), so the clipping floor dropped to ≈0.42 and 0.62 clears the blurb with ~58px in hand (was ~50px), showing the top of the "utilized by…" line rather than seating it. ~0.59 would reproduce the pre-Sanity framing exactly. 0.62 is Nathan's bake and is left alone; 320px still wraps to 5 lines (panel 291px, share 0.449) and 430px to 4 (297px, 0.427). **This is now a copy-dependent number** — a longer blurb re-wraps and moves it again. | `0.62` | 0–1 (clamped); non-numeric ignored | `Hero.jsx FOOTER_REST_MOBILE` |
| `?footerlift` | MOBILE HOME only (`[data-footer-rest]`): the hero parallax's share of the panel's climb — globe, ring, `enter_world` and the commit fill rise at k × the panel's own travel as the footer reveals. Drives off the NORMALIZED rise (`--footer-rise`, 0 in the resting pose), so the lift is exactly 0 on the first paint; `0` turns the parallax off. Measured at 390×844: the panel climbs 106.86px, the hero lifts 53.39px, ratio 0.4996 (`globe-probe --footer`). | `0.5` | 0–1.5; slider 0–1.5 / 0.05; `0` is legal (ZERO_OK) | `footerTune.js FOOTER_TUNE_DEFAULTS.liftK` **and** the `global.css --footer-lift-k` fallback (keep equal — held by `scripts/test/footer-reveal.test.mjs`) |
| `?footermarksfrom` | rise at which the client marks (`.logo-ticker__roll`) begin fading + settling in. Windowed over `--footer-rise-PEAK`, never the live rise, so they HOLD through a downward gesture instead of dimming away in full view. Measured FIXED POINT: at rise 0.6 the roll's top edge sits exactly on the fold at 390×844, so the fade begins on its first visible pixel — `globe-probe --footer` interpolates `marksFoldCrossRise` and gates it to this number ±0.05. | `0.6` | 0–1, < `?footermarksto`; slider 0–0.9 / 0.05; `0` is legal | `footerTune.js …marksFrom` **and** the `global.css --footer-marks-from` fallback (keep equal) |
| `?footermarksto` | rise at which the marks are fully in. Measured: arrival completes with the roll's top at 790px against an 844px fold — 54px of headroom, so none of the fade is spent off-screen. | `0.9` | 0–1, > from; slider 0.1–1 / 0.05 | `footerTune.js …marksTo` **and** the `global.css --footer-marks-to` fallback (keep equal) |
| `?footermarkslift` | how far below their resting place the marks start, in rem; settles to 0 across the window. | `1.25` rem | ≥ 0; slider 0–4 / 0.25; `0` is legal | `footerTune.js …marksLift` **and** the `global.css --footer-marks-lift` fallback (keep equal) |
| `?footerintro` | the resting footer's ON-LOAD entrance: the blurb's per-word fade, both the duration AND the stagger budget, so more words arrive faster rather than crawling. Fires on the chrome beat (not at load) and is `autoAlpha` only, no y — the sequential rise read as stutter. Never reaches the cascade: the entrance is a GSAP timeline that reads `getFooterIntroS()` at fire time. | `0.45` s | finite > 0; slider 0.15–1.5 / 0.05 | `footerTune.js …introS` |
| `?footerslide` | how far the resting footer STARTS BELOW its rest pose on a first load, as a **fraction of its own resting reveal** — `1` parks the panel's top flush at the fold, so nothing of it shows at load and it rises the whole way in. A fraction, not a rem (10-08, Nathan: "we want the full globe to be in view on the page load"): the overlap it must clear is `rest x panel-h - 0.065 x vh`, since the hero globe's ring diameter is `fill x (1 + GLOBE_STROKE_FRAC) x cos(alpha) x min(vw, vh)` (0.87 x min on desktop, 0.988 x min on a phone) centred at `vh/2`. In LANDSCAPE min = vh so its bottom lands at `0.935 vh`; in PORTRAIT the fit axis is WIDTH, so the radius stops shrinking with height while the centre keeps falling and the overlap grows ~1px per 2px of lost height. Measured panel-over-ring overlap 98.5px at 1440x900, 104.9 at 1280x800, 78.9 at 1440x1200 = 0.63 / 0.66 / 0.50 of the reveal, rising to 0.71 at 1440x700 — it grows as the window shortens, so no fixed rem holds and only `1` clears at every viewport. At a full 390x844 the phone does not overlap at all, so there the slide is pure entrance -- but browser chrome eats height, and past some height the resting panel does reach the ring, which is a `?footerrest` question and not a slide one. **The phone figures that stood here (panel top 77.5 vh, ~32px of overlap by ~700px visible, `?footerrest <= 0.51`) were read off the PRE-SANITY 306px panel** and were superseded the same day: the shorter blurb re-wrapped it to 281px (see `?footerrest` above), which moves all three — and the ring's bottom in vh moves with the height too, since in portrait the fit axis is width. The desktop fractions above are unaffected, and they are what sets the bake. FIRST VIEW ONLY — gated on Hero's `introMode === 'full'` (the existing `swm:hero-intro` sessionStorage flag, so a revisit in the same tab gets the fade with no slide; `?intro=full` forces it back). Resolved to px at arm time from the live resting pose (`innerHeight - panelTop`, channel fallback `(1 - --footer-span) x --footer-panel-h`), written to `--footer-slide` and consumed by the panel's INDIVIDUAL `translate` (never `transform` — SiteFooter owns that string imperatively per frame). `0` = no slide. Never reaches the cascade at rest: the var is set while armed and removed when it lands | `1` | 0 or finite > 0 (>1 starts it below the fold) | `footerTune.js …slideK` |
| `?footerslides` | that rise's own duration, s. It borrowed `?footerintro` (0.45) while the slide was a 1.25rem nudge; a full-reveal rise is ~157px at 1440x900, ~9x the travel, and 0.45s over it reads as a snap rather than a glide — so the slide carries its own number and `?footerintro` is the word fade's alone again. Rides the footer's own wipe curve (steep launch, smooth decel, no overshoot). `0` = the start pose with no travel time (it lands on the first frame) | `0.7` s | 0 or finite > 0 | `footerTune.js …slideS` |
| `?footerslidelead` | how long the blurb's word fade waits for that slide, s (Nathan: "offset text animation just slightly to allow for slide up"). A LOCAL offset on the entrance timeline, deliberately not a bump to `STAGGER_DELAY_S` — that constant is shared with the link-row stagger on `/process` and every detail page, which have no slide to wait for. Also shifts the band's copy line, which keeps its own +0.18 lead. `0` = text and slide start together | `0.12` s | 0 or finite > 0 | `footerTune.js …slideLeadS` |

**Client-logo ticker (09-07)** — reader `src/components/ClientLogoTicker.jsx` (the band riding the top of the links footer on every footer route; mount-effect class, applied imperatively because the panel is SSR'd). Assets come from `src/assets/client-logos/` via `scripts/prep-client-logos.mjs` (intake `Client Logos/` → white-on-transparent, ≤240px tall, `manifest.json` with intrinsic w/h).

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?logoh` | logo row height in px (every mark is height-fit) | `28` (`22` ≤768) | finite px | `global.css --logo-h` (both tiers) |
| `?logogap` | gap between marks in px | `49` (`32` ≤768) | finite px | `global.css --logo-gap` |
| `?logomaxw` | cap on a mark's width as a multiple of `--logo-h` | `8` | finite > 0 | `global.css --logo-max-w` |
| `?logobal` | optical-balance exponent: each mark's height × (`ref` ÷ aspect)^k — 0 = height-fit, 0.5 = equal area, 1 = equal width (per-item `--lf`, clamped 0.55–2) | `0.5` | 0–1 | `ClientLogoTicker.jsx BAL_K` **and** `global.css --logo-bal` (keep equal) |
| `?logoref` | the reference aspect (w/h) that sits at exactly `--logo-h` | `3` | finite > 0 | `ClientLogoTicker.jsx BAL_REF_AR` **and** `global.css --logo-ref-ar` |
| `?logopxs` | marquee speed in px/s — the roll's AMBIENT velocity on the shared drag + momentum engine (`src/lib/dragMomentum.js`, the globe's choreography); drag/flick ride the same numbers | `40` | finite > 0 | `global.css --logo-pxs` |
| `?logofrom` | footer progress at which the band starts fading in (window over `--footer-reveal`) | `0.6` | 0–1, < `?logoto` | `global.css --logo-reveal-from` |
| `?logoto` | footer progress at which the band is fully in | `0.98` | 0–1 | `global.css --logo-reveal-to` |
| `?logowordcycle` | one odometer word per cycle, ms (hold ≈ 75%, move ≈ 25% on `--ease-panel`) | `1800` | finite > 0 | `global.css --logo-word-cycle` |
| `?inkmuted` | muted TEXT ink lightness, 0–1, mixed black→white in oklab. Site-wide (`--ink-muted` is root-scoped), currently consumed by the ticker lead line. Measured on the footer band: `0.5` = 3.3:1 (AA large only), `0.58` = 4.61:1 (AA body), `0.7` = 7.39:1 (AAA). The grey it replaced was 2.03:1 on this band. **Not** `--color-dim-gray`, which stays put as the enter_world CTA's pulse floor | `0.58` | 0–1 | `global.css --ink-muted-l` |
| `?pulsebpm` | tempo of the "full spectrum" ink pulse. A half note is 120/bpm s; the cycle is two of them (one cycling, one flat) and the 5 palette frames divide the cycling half exactly — one full sweep per pulse | `127` | finite > 0 | `global.css --swm-bpm` |
| `?logorestop` | the client-logo band's opacity FLOOR in the resting footer pose — the bottom of a ramp now, not a flat veil. 10-08 (Nathan): "start at 0.4 until the user scrolls up to reveal it for the first time". The band's own `--lt-p` cannot express this (it is a rise window keyed on `--footer-peak`, and at rest there is no rise, so it resolved to a flat `footerrest/0.98` = 0.633), so the variant reads `calc(floor + (1 - floor) * var(--footer-rise-peak, 1))` and a separate one-way `[data-footer-seen]` rule pins it to 1 once the rise has cleared 0.999 — `--footer-rise-peak` is a WITHIN-EXCURSION peak that resets to 0 when the panel parks, so the ramp alone would re-dim on every park. **WHAT 0.4 COSTS:** the lead-in ink composites to **1.61:1** and the odometer word to **3.66:1** over the panel's black — both under AA body (4.5:1). The copy line is 19.6px/500 on the phone and below the desktop crossover, so the large-text exemption does not apply there; on the desktop variant it rides `--footer-blurb-size` (22.59px @1440, 40.36px @2560) and only clears WCAG's 24px large-text bar above ~1530px, where the bar drops to 3:1. Not fixable by brightening ink: at 0.4 pure white itself tops out at 3.66:1. `0.5` is the honest compromise (lead-in 1.93:1, white odometer word 5.32:1); `1` restores the undimmed 10-08 pose; `0.633` shows the original veil (with today's `#7a7a7a` ink that measures 2.48:1, not the 1.43:1 this row used to quote against the retired `--color-dim-gray`). Once the latch fires the literal `1` wins, so the dial only shows the floor until the first full reveal — reload to see it again | `0.4` | 0–1 | `global.css --logo-rest-op` |
| `?pulsereps` | complete palette sweeps inside the CYCLING half note of the "full spectrum" pulse — the colour RATE, independent of `?pulsebpm` (10-08, Nathan: "dial in the rate of the switching between colors while retaining the same BPM… much more rapid, but still have the same pausing intervals"). The half-note boundary stays at 944.88ms for every value (measured). Frame = 188.976/reps ms: `1` = 188.98ms / 5.3Hz (the original one-sweep-per-pulse), `2` = 94.49 / 10.6Hz, `3` = 62.99 / 15.9Hz, `4` = 47.24 / 21.2Hz, `5` = 37.80 / 26.5Hz. Mechanism: TWO animations on `color` — a `swm-spectrum-walk` whose duration carries the rate, and a `swm-spectrum-gate` declared LAST with no `0%` keyframe, so its implicit 0% is the underlying value (the walk) and it only takes over at 50%. Rounded to an integer and clamped: a fraction lets the gate truncate a sweep mid-palette, and `0` does not error — it clamps the walk's duration to ~1.8e308s and freezes it on red. At 6+ a colour gets a single 60Hz refresh. Note the cadence jitter inherent to deriving the rate from the tempo: at 3 the 60Hz run length alternates 3 and 4 refreshes (±14%), at 5 it is 2 and 3 (±33%) | `3` | 1–5 (int) | `global.css --swm-pulse-reps` |
| `?footerblurbfill` | the share of its own measure the resting blurb's SINGLE LINE occupies, above 769px (10-08, Nathan: "scale up to maintain the full width of the viewport, beyond any viewport width… value that makes the blurb run on only one line"). `font-size: fill × (100vw − --nav-inset − --chrome-right-inset) / --footer-blurb-em`, where the divisor is **measured at runtime** (10-08): `SiteFooter` sizes a nowrap clone of the real blurb — per-word spans, their Medium weight class and any `[[highlight]]` marks included — at 100px and publishes width/100, re-running on `document.fonts.ready`. Measuring rather than baking is what made the copy safe to move into Sanity, and it is the reason the rest of this row is phrased as *properties of the current copy* rather than constants. Tracking is in em so the scaling is exactly linear and one divisor holds at every width. **For the copy as shipped 10-08** (`siteSettings.footerBlurb`) the measurement is **55.722em**, also the CSS `var()` fallback so SSR and a no-JS load are correct: verified exactly one line, zero overflow, at 1180, 1200, 1280, 1366, 1440, 1536, 1600, 1728, 1920, 2048, 2560, 2880, 3440 and 4480 (25.43px @1440, 45.43px @2560, 61.14px @3440). 1024 and 1100 sit below the crossover, where the sentence is two lines at 19.6px by design. (The pre-Sanity copy measured 62.716em — 11.2% wider — which is how much these numbers move on a copy edit.) If the fallback is ever hand-edited, keep it at or ABOVE the true measurement: too large under-fills by a hair, too small over-fills and wraps. A bare `vw` coefficient CANNOT do this — the 16px inset is fixed, so exact fill is 1.5746vw at 1280 and 1.5845vw at 2560 (asymptote 1.5945); dividing the measure is what makes the trailing slack a constant 0.5%. Do NOT ship `1`: flush tipped to two lines at 1024w on the original copy, and the 0.5% headroom is also what absorbs Retina glyph rounding — keep it whatever the copy is. **Floored, not uncapped** (10-08, Nathan: "the footer text now scales lower than the baseline unit value, the text should run onto a second line at that point. scaling up looks good"): the token is `max(var(--text-blurb, 1.4rem), calc(…))`, so it only ever scales UP from the 19.6px baseline every other desktop site falls back to — without it the line kept shrinking to 11.9px at 769w to stay on one line. **The crossover is not a chosen width** — it is `19.6 × em ÷ fill` in measure terms, so it moves with the copy: for the shipped string that is a ~1098px measure, i.e. a viewport of **~1110–1130px** (measured: one line from 1130px up, two lines at 1100px and below, the wrapped band all at exactly 19.6px). It sat at ~1245px for the pre-Sanity copy. Below it the blurb is two lines at exactly the baseline, so the size goes continuous-then-flat and only the line count steps. **The floor clamps this dial too** — below ≈0.767 at 1440w (was ≈0.863 on the longer copy) the value is inert. A webfont failure is still the safe direction — the fallback stack measures ~7% narrower than ABC Areal, so a swap period under-fills rather than wraps, which is also why the measurement re-runs on `fonts.ready` rather than trusting first paint. Also drives `.logo-ticker__copy`, keeping Nathan's "one token, both lines" pair matched | `0.995` | 0.80–1.00 | `global.css --footer-blurb-fill` var() fallback **+** `footerTune.js FOOTER_TUNE_DEFAULTS.blurbFill` (0.995) — two places, must agree |
| `?footertoppad` | the resting panel's top padding above the blurb, rem, above 769px (10-08, Nathan: "way too much space above the 'Small World Media is a…' blurb"). The space was NOT this pad — it was `.site-footer__inner`'s `min-height`, which reserves the fixed tagline stack (lockup art + gap + the © line's box) from when that stack sat over the panel's bottom, with `align-items: flex-end` parking the blurb at the bottom of it: measured 64.90px panel-top-to-first-line where the pad alone is 18.00px. The variant now sets `min-height: 0` and this dial is what is left. `0` puts the blurb hard against the panel's top edge. Reads `--footer-rest-top-pad`, not `--footer-top-pad`: the latter is declared ON `.site-footer__inner`, where the element's own declaration beats anything inherited from `<html>`, so a dial could never reach it | `1.286` | 0–6 | `global.css --footer-rest-top-pad` var() fallback **+** `footerTune.js FOOTER_TUNE_DEFAULTS.topPad` (1.286) — two places, must agree |
| `?tickerfoot` | clearance below the logo band in the resting variant, rem, above 769px (10-08, Nathan: "add some more space below the logo ticker so that the copyright and privacy button are not overlapping with the ticker as well"). The band is `order: 1` under this variant, so it lands exactly where the fixed lower corners sit: measured, the privacy pill overlapped the marks row by 25.97px and the copyright by 10.00px, identically at every width from 800 to 3440 (`html{font-size:14px}` pins the rem chain and all three boxes are bottom-fixed). The default is derived, not typed — `--footer-bottom-inset + --lh-link + 2 × --pill-pad-y + --space-6`, the same construction as the `min-height` tail it replaces, so the reserve has effectively moved from above the blurb to below the band. Clears them by 12.02px and 27.99px. `0` shows the overlap again | `4.427` | 0–10 | `global.css --ticker-foot-clearance` var() fallback **+** `footerTune.js FOOTER_TUNE_DEFAULTS.tickerFoot` (4.427) — two places, must agree |
| `?logofademin` | the resting band's MINIMUM fade-in, s (10-08, Nathan: "add a minimum fade in time for the logo ticker so that it still has a perceivable fade in even if you scroll down quickly"). The band's veil ramps on `--footer-rise-peak`, which is POSITION: the rise spans only `(1 − rest) × --footer-panel-h` ≈ 95px at 1440×900, so one flick carries the whole thing inside a frame and the dim pose pops to full. `SiteFooter` publishes `--footer-band-p` = `min(rise, elapsed / this)` and the band reads that instead. A **floor, not a duration** — a leisurely scrub already beats the clock and `min()` leaves it alone, which is why this is a JS clock and not `transition: opacity`, since a transition would impose its time on the slow case as lag. `[data-footer-seen]` latches off the GATED value for the same reason: it is a hard `opacity: 1` at a specificity the ramp cannot beat, so latching on the rise would erase the fade on exactly the quick scroll this exists for. Costs one rAF while the gate is closed, none after. `0` removes the floor | `0.55` s | 0 or finite > 0 | `footerTune.js …bandFadeS` |

**Lenis traps.** Raw `?lerp` / `?wheelmult` / `?lenisdur` last for one route: `start()` re-reads the URL per route and soft navs drop the query. Opening `?lenistune=1` **alone reverts the live feel to library defaults** (the bench state initializes to 0.1 / 1 / 0, not the bake, and the page-load handler pushes it). Open it as `?lenistune=1&lerp=0.165&wheelmult=1.25` to start from the bake; `↺ reset` also goes to library defaults. Things that scale with the Lenis bake and need a regression pass after a retune: detail `?deckgear`, GridSocket parallax, the /process quantizer glides, next-project `?nparm`. A dialed `?footer*` knob used to be lost on the first soft nav (inline `<html>` property, no re-assert) until a slider was touched — closed 10-07: `footerTune.js` re-applies the whole family on `astro:after-swap`.

## `/work` — World scene (WebGL globe of Tiles)

Reader: `src/components/work/world/worldConfig.js`, one module-load `PARAMS` + `num(key, fallback)`. Consumers: `useWorldScene.js`, `fpDrum.js`, `fpAtlas.js`, `fpForme.js`, `fpDrumTrim.js`, `fpDrumWall.js`, `fpGridCells.js`, `seededLayout.js`, `worldBands.js`, `worldLive.js`, `buildShell.js`, `WorldScene.jsx`. Bake = the `worldConfig.js` line given unless noted.

Mode tags: **[all]** every field mode · **[DRUM]** `fpgrid=3` (the shipped default) · **[ATLAS]** 1 · **[FORME]** 2 · **[legacy]** `fpgrid=0` only, **inert at the shipped default**.

### Field mode and DRUM

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?fpgrid` | field expression: `0` legacy floating tile field, `1` ATLAS on-sphere plates, `2` FORME letterpress pane, `3` DRUM revolving world [all] | `3` | `0` \| `1` \| `2` \| `3` (≥4 is unguarded and breaks) | `:35` |
| `?platedeg` | plate longest side, degrees of arc [grid] | `12` deg | any finite | `:39` |
| `?fpwin` | usable fraction of the frustum for placement; >1 lets edge blocks run off-frame [grid] | `1.1` | any finite | `:40` |
| `?camlook` | pointer head-turn amplitude (DRUM ×0.8) [ATLAS][DRUM] | `0.025` rad | any finite | `:41` |
| `?fpbal` | 3×3-zone semi-balance pass over the seeded placement; `0` = raw ring for A/B [DRUM] | `1` | `0` off, else on | `:44` |
| `?fpvis` | fraction of the frustum the lens crop shows; balance judges occupancy against it [DRUM] | `0.85` | any finite | `:45` |
| `?fptab` | plate spine tabs (accent tab, −90° mono title/coordinates) [DRUM] | `1` | `0` off, else on | `:59` |
| `?fpfurn` | drum furniture: registration crosses / captions / cell floods in empty cells [DRUM] | `0` | `0` off, else on | `:60` |
| `?creep` | idle whole-drum creep outside a Turn (not under RM) [DRUM] | `0` deg/s | any finite | `:64` |
| `?arcdeg` | arc per project on the drum; Turn target = index × arc [DRUM] | `60` deg | any finite | `:65` |
| `?drumturn` | Turn duration multiplier, DRUM only (× `?turnms`) [DRUM] | `1.15` | any finite | `:66` |
| `?panepitch` | FORME macro-cell pitch as a multiple of the shell's fine pitch [FORME] | `3` | any finite | `:67` |

### Grid glow and ripple (DRUM; the `rip*` family needs `fpglow=1`, `fpglowa` needs `fpglow=2`)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?fpglow` | grid-panel illumination: `0` off, `1` accent ripple from center on the house-pulse cadence, `2` pointer trace; skipped under RM | `1` | `0` \| `1` \| `2` | `:46` |
| `?fpglowa` | pointer-trace alpha basis (effective min(0.55, ×3)) | `0.2` | any finite | `:47` |
| `?ripvar` | ripple radial animation: `1` pulse ring, `2` wavetrain, `3` droplet | `3` | `1` \| `2` \| `3` | `:51` |
| `?ripshade` | cell shading: `0` flat, `1` hairline inset/bevel | `0` | `0` \| `1` | `:52` |
| `?ripevery` | house periods between launches (× 2.3 s) | `4` | finite ≥ 0.25 | `:53` |
| `?ripspeed` | travel per second as a fraction of the capped radius | `0.15` | any finite | `:54` |
| `?ripfall` | distance decay length × capped radius | `0.13` | any finite | `:55` |
| `?riprad` | extent × the visible window's half-diagonal | `1` | any finite | `:56` |
| `?ripw` | crest half-width in lat cells (mode 2 ignores it) | `5` | any finite | `:57` |
| `?ripalpha` | peak alpha (mode 1) | `1` | any finite | `:58` |

### Deck / album walls on the drum

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?walldrift` | wall plates' idle column drift, canvas px/s (scaled W/640) [DRUM] | `9` | any finite | `:61` |
| `?wallgear` | wall column px per degree of drum roll (the Turn kicks the wall) [DRUM] | `12` | any finite | `:62` |
| `?wallpages` | pages a wall plate cycles; must pair with `BAND_PAGE_CAP` in `src/pages/work/index.astro:38` [DRUM] | `12` | integer ≥ 4 | `:63` + `work/index.astro:38` |
| `?wallrows` | 09-04 r11 (Nathan): extra lon CELLS on the deck/album wall footprint — the mobile walls run one cell taller (the reserved block's `drumSpan` + this before quantize; the canvas follows `coverAspect`) [DRUM] | `1` ≤768 / `0` desktop (`IS_MOBILE`) | integer ≥ 0 | `worldConfig.js WALL_EXTRA_ROWS` |
| `?deckcols` | r11: fixed page-column count for DECK walls (the mobile re-tier shows ONE column of pages); `0` = DeckScroller's `VISIBLE_ROWS`-derived auto count [DRUM] | `1` ≤768 / `0` desktop | integer ≥ 0 | `worldConfig.js WALL_DECK_COLS` → `fpDrumWall.js cols` |
| `?albumcols` | r11: fixed column count for ALBUM-ART walls (TWO on phones — was the auto 3-column record bin); `0` = auto [DRUM] | `2` ≤768 / `0` desktop | integer ≥ 0 | `worldConfig.js WALL_ALBUM_COLS` → `fpDrumWall.js cols` |
| `?wallpx` | r11b (Nathan: walls read soft): the wall CANVAS width in px — the per-frame upload cost scales with canvas AREA (repaints are movement-gated), so this is the compute dial. The page TEXTURE request width is no longer a constant: it follows the column width (`ceil(colW/64)×64`, cap 1024 — a 1-column mobile wall was drawing 480px pages into a 704px column), decode-only [DRUM] | `896` ≤768 (was 704) / `1152` desktop | px > 0 | `worldConfig.js WALL_CANVAS_PX` → `fpDrumWall.js CANVAS_W` |

### Camera and render

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?fov` | camera vertical FOV [all] | `42` deg | any finite | `:70` |
| `?camlag` | resize: camera aspect re-eval trails the window on a retargeted ease [all] | `0.7` s | any finite (floor 0.01) | `:71` |
| `?dpr` | devicePixelRatio cap for renderer + composer [all] | `1.5` | any finite | `:72` |
| `?msaa` | composer multisamples; `0` off [all] | `4` | any finite | `:73` |
| `?lens` | base lens distortion both axes; negative = pincushion "inside a sphere" [all] | `-0.15` | any finite | `:130` |
| `?lensx` / `?lensy` | per-axis warp; beat `?lens` | `?lens` / `?lens` × 1.1 | any finite | `:131-132` |
| `?spike` | extra distortion at the Turn midpoint (×1.1 on Y) [all] | `0.08` | any finite | `:141` |

### Tile density, thumbnails, layout

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?max` | tile density cap. DRUM ramps 8→12 over 1280→1920 px unless `?max` is **present** (any value, even junk, pins density) [all] | desktop `8`, mobile `9` | any finite; presence disables the ramp | `:75` (+ ramp anchors `:83-84`) |
| `?min` | cycle the showcase to at least this many tiles [all] | `5` | any finite | `:86` |
| `?thumbmax` / `?thumbmin` | thumbnail request px at MIN_TILES / at MAX_TILES (linear between) [all] | `896` / `704` px | any finite (rounded) | `:91-92` |
| `?clear` | inner clear radius reserving the center for the card [all] | `0.59` | any finite | `:108` |
| `?cluster` | outer annulus bound [all] | `0.55` | any finite | `:109` |
| `?jitter` | seeded XY offset over the phyllotaxis layout [all] | `0.04` | any finite | `:110` |
| `?fieldy` | whole-field vertical shift (− = down) to clear the nav [all] | `-0.012` | any finite | `:114` |
| `?spreadx` / `?spready` | horizontal / vertical spread × [all] | `0.88` / `0.79` | any finite | `:115-116` |
| `?zjitter` | per-tile depth spread within a tier [legacy] | `0.6` | any finite | `:103` |
| `?tile` | tile longest side, world units [legacy] (also seeds `?bandh`) | `0.7` | any finite | `:106` |
| `?scatter` | spread vs the visible half-extent [legacy] | `1.0` | any finite | `:107` |
| `?drift` | per-tile micro-drift amplitude [legacy] | `0.05` | any finite | `:227` |
| `?parallax` | tier-group / shell pointer translate (commented "radians", applied as world units) [legacy][FORME] | `-0.02` | any finite | `:225` |

### Tile appear (load-gated push-out)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?spawn` | start position as a fraction of the rest radius [all] | `0.12` | any finite | `:122` |
| `?spawnscale` | start scale [legacy] | `0.72` | any finite | `:123` |
| `?appearms` | appear / push-out duration [all] | `1100` ms | any finite | `:124` |
| `?appearfade` | fraction of progress over which opacity ramps; ≤0 disables [all] | `0.35` | any finite | `:125` |
| `?fanout` | max extra delay at the outermost tile (inner→outer bloom) [all] | `0.55` s | any finite | `:126` |

### World Turn

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?turnms` | World Turn duration (DRUM × `?drumturn`); also the register-plate wipe, bands, WorldCard roll, and the detail BandPager [all] | `1700` ms | any finite | `:138` |
| `?ease` | CustomEase SVG path shaping the Turn, appear, grid recolour, card roll; by import also the next-project commit curve and the /process swipe glide [all] | path at `:151` | any valid CustomEase path (unvalidated) | `:151` |
| `?exit` / `?enter` | outgoing roll past center / incoming start angle [legacy] | `0.88` / `0.88` rad | any finite | `:139-140` |
| `?recede` | Z push-back of both Worlds during the cross [legacy] | `0.5` | any finite | `:142` |

### Live video tier

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?live` | live pool size / decode budget; `0` turns the tier off [all] | desktop `4`, mobile `2` | integer ≥ 0 | `:165` |
| `?vtiles` | video tiles to load (extras rotate through the pool); also sizes the sync build batch [all] | desktop `6`, mobile = `?live` | integer ≥ 0 | `:173` |
| `?livedwell` | min seconds live before rotating to a waiting Near tile [all] | `9` s | any finite | `:175` |
| `?livefade` | still ↔ video crossfade [all] | `0.6` s | any finite | `:176` |
| `?liveres` | pinned Mux rendition (`min_resolution=X&max_resolution=X`) [all] | desktop `720p`, mobile `540p` | any string, passed verbatim | `:182` |

### Bands and the deck viewer (the `?deckdebug` panel writes these live)

Under DRUM only `?bandx` / `?bandy` are live-effective (build-time anchors, applied on the next `buildSlot`). `?bandcycle` and the six `deck*` sliders feed legacy / ATLAS / FORME consumers only. The panel's `KNOBS[].def` duplicate these defaults as literals: bake both or `copy_url` mis-serializes.

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?bands` | composite deck/album bodies on/off [all] | `1` | `0` off, else on | `:191` |
| `?bandh` | band body longest side [legacy] | `1.19` (0.7 × 1.7) | any finite | `:193` |
| `?bandcycle` | rest dwell between page auto-advances [legacy][ATLAS][FORME] | `3.2` s | slider 0.4–8 / 0.1 | `:194` + `FeaturedDeckDebugPanel.jsx:27` |
| `?bandpages` | planes per band / register plate (DRUM uses `?wallpages`) [legacy][ATLAS][FORME] | `5` | integer ≥ 2 | `:195` |
| `?bandx` / `?bandy` | deck anchor toward the right edge / the top, fraction of half-extent [all] | `0.34` / `0.36` | slider 0–0.6 / 0.01 | `:204-205` + panel defs |
| `?deckspace` | `DECK_SPACING` scale, card-to-card density [legacy] | `1` | slider 0.3–2.5 / 0.05 | `:214` |
| `?deckhome` | front-page x-anchor [legacy] | `-0.12` | slider −0.8–0.4 / 0.01 | `bandLayout.js:51 HOME_X` (shared with the detail pager) |
| `?deckfan` / `?deckpile` | waiting-fan / shown-pile extent multipliers [legacy] | `1` / `1` | slider 0.3–2.5 / 0.05 | `:216-217` |
| `?deckhold` | viewing-slot plateau width [legacy] | `0.3` | slider 0–0.6 / 0.01 | `bandLayout.js:77 VIEW_HOLD` |
| `?deckalbum` | album-art size multiplier [legacy] | `1` | slider 0.6–1.4 / 0.01 | `:219` |

### Shell and backdrop

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?shellalpha` | shell grid line opacity (FORME dims ×0.45) [all] | `0.55` | any finite | `:234` |
| `?spin` | shell Y-spin rad/s; grid modes default it to 0, an explicit value still applies; off under RM [all] | legacy `0.012`, grid `0` | any finite | `:237` |
| `?fpfade` | bottom fade: % of the accent mixed over black → `--fp-fade` on `.fp-canvas` [all] | `0` | any finite | `:246` (the CSS fallback at `featured-projects.css:56` still says 65, never reached) |
| `?fpfadeh` | gradient height, % viewport → `--fp-fade-h` [all] | `40` | any finite | `:247` |

## `/work` — enter-world passage (`?entertune`)

Reader: `src/components/work/world/enterTune.js` (`ENTER_TUNABLES`, module-load seed, always on; read per frame by the scene ramp and at click by WorldCard and the home hero's `onEnterClick`). Bake: `enterTune.js:37-49 ENTER_TUNE_DEFAULTS`. The panel's fields are typed inputs (no ranges).

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?entertune` | mounts EnterTunePanel | off | presence | — |
| `?enterms` | master timeline length AND RouteFill cover duration; on `/` also the dive tween and the `navigate('/work')` delay (`enterMs + 60`) | `1100` ms | any finite | `.enterMs` |
| `?entercover` | **legacy alias** of `?enterms` (loses when both present; `copy_url` deletes it) | — | any finite | retire |
| `?enterlens` | additive distortion at full ramp; negative deepens the pull | `-0.07` | any finite | `.lens` |
| `?enterlensa` / `?enterlensb` | timeline fractions where the lens deepen begins / lands | `0` / `1` | any finite | `.lensStart` / `.lensEnd` |
| `?enterscale` | projection-zoom destination, `1` = off | `3.2` | any finite (floor 0.05) | `.scale` |
| `?enterzoom` | camera dolly toward the tiles (historical name: "zoom" = dolly) | `1` world units | any finite | `.dolly` |
| `?entermovea` / `?entermoveb` | dolly + zoom window, timeline fractions (`2` overruns the handoff) | `0` / `2` | any finite | `.moveStart` / `.moveEnd` |
| `?enterpow` | power-inOut exponent, both channels | `7` | any finite | `.pow` |
| `?enterhold` | dry-run only: hold at full ramp before unwinding | `10` ms | any finite | `.holdMs` |
| `?enterfill` | dry-run only: `1` also raises the RouteFill cover, `0` bare scene | `1` | `0` \| non-zero | `.cover` |

## `/work` — Featured card, pager, text-exit, CTA arrows

Readers: `FeaturedProjects.jsx` (`PARAM()`, gates), `WorldCard.jsx`, `fp1Tune.js` + `Fp1TunePanel.jsx`, `textExit.js` + `TextTunePanel.jsx`, `pager/TapeWheelPager.jsx` + `usePagerGesture.js`, `CtaArrows.jsx`. Bake home for timing constants: `src/lib/motion.js` (reads no params itself).

### Gates, the pager A/B, scroll and carets

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?deckdebug` | mounts FeaturedDeckDebugPanel (knobs in the World § bands). Side effect: the substring match in fpDrum/fpAtlas also arms `window.__fpDrum` / `__fpAtlas` | off | presence | — |
| `?texttune` | mounts TextTunePanel (the `tx*` seeds apply regardless) | off | presence | — |
| `?fp1tune` | mounts Fp1TunePanel AND switches WorldCard's enter_world pulse to the live bench-built ease; enables the fp1 shape seeds | off | exactly `1` | — |
| `?pager` | pager arm: lazy-swaps a skin in for the legacy `.fp-pager` rail after mount **Since 09-06 the SCALE arm is the DEFAULT and is SSR'd** — no param = `scale` (the graticule, built 09-01 over the shared engine `pager/usePagerGesture.js`; spec in `docs/fp-pager-rework-approaches.md`), rendered server-side and on first paint (static import, `data-pager='scale'` in the markup — no rail flash, no chunk swap). `rail` swaps the legacy rail in after mount (the lazy gate, inverted); other values are ignored. The `tape` and `tuner` arms were DELETED 09-05 | `scale` | `scale` \| `rail` | default flipped 09-06; the rail stays as the parked rail-arm proposal's front end |
| `?detent` | finger-travel px per station while engaged, and the flick-velocity divisor. On `scale` it ALSO re-pitches the visual scale (the skin writes it back as the inline `--scale-pitch`), so touch stays exactly 1:1 with the ticks | scale `48` both tiers (09-04 r8 vertical-space bump — was 44 desktop) px | any finite; **floored at 8px** in all three arms (09-01 — `0` used to divide by zero → NaN landing) | `motion.js SCALE_PITCH_PX` + `SCALE_PITCH_MOBILE_PX` (`PAGER_DETENT_TOUCH_PX` is the engine default) |
| `?wheeldetent` | desktop wheel deltaY px per station (`hover:hover` + `pointer:fine` only). Per-render | scale `100` px | any finite; floored at 8px | `motion.js SCALE_WHEEL_DETENT_PX` (`PAGER_DETENT_WHEEL_PX` is the engine default) |
| `?wrap` | `?pager=scale` only (09-02, Nathan's post-pick call): the scale is a WHEEL — it loops past both ends (project 01 shows the last project above it), with `CLONE_ROWS` (8) ghost rows rendered beyond each end and the engine running unbounded (`tuning.wrap`: no end resist, indices mod count, silent loop re-bases via `onRenorm`). `0` restores the bounded scale with end resist | `1` (on) | `0` \| anything > 0 = on | taste call — Nathan asked for the toggle |
| `?selectlabel` | `?pager=scale` only (09-02 round 2): the rotated `select_project` hint above the chip (90° CCW, reads bottom-to-top); on engage it wipes downward in GLOBAL space (clip-path pre-transform → the local-bottom inset) and returns on retract | `1` (on) | `0` \| anything > 0 = on | taste call, open for Nathan |
| `?feather` | `?pager=scale` only (09-02 round 2): the deployed window's feather radius in px at each end (the mask fade). Absent/`0` = the token default `--scale-feather` (TWO pitches since round 2 — was one) | token (desktop 2 × pitch = 96px; ≤768 **250px** — baked r11f, Nathan's dial) | px > 0 | `--scale-feather` (featured-projects.css root-local) |
| `?pause` | `?pager=scale` only (09-02 round 2): the PAUSE-SCREEN variant — while engaged the whole page holds still (scene loop stops via the `swm:fp-freeze` gate in useWorldScene — render + decode, so it SAVES compute; GSAP tweens pause via globalTimeline; CSS chrome animations hold via `.is-fp-frozen`; the scrim goes input-solid) and `[select_project]` sits at viewport centre, leaving on the house random letter cut (35ms shuffled) at release. Engaging mid-Turn pauses that Turn until release | `1` (on — **baked 09-03**, Nathan's pick) | `0` \| anything > 0 = on | baked; `?pause=0` compares |
| `?magnet` | `?pager=scale` only (09-03 round 5): the tension curve's exponent — the rendered strip HANGS on the current station and snaps across the threshold on `sign(f)·\|2f\|^exp/2` (the engine's magnet shape, per-skin since round 5; the tape keeps 1.6). Higher = longer hang + steeper snap; the flipper box rides the same shaped position | `4` (`SCALE_MAGNET_EXP` — **baked 09-05 r11f**, Nathan's dial; r6 2.2, original 4) | clamped 1–8 (below 1 anti-magnetizes, past 8 the crossing aliases a frame) | `motion.js SCALE_MAGNET_EXP` |
| `?fliptau` | `?pager=scale` only (09-03 round 5): the flipper box's spring τ in seconds — how fast the near-black selected-name chip chases its target (the current name's screen offset; the ±half-pitch jump at the threshold renders through this spring as the game-show-arrow flick). Lower = snappier flick, higher = floatier | `0.1` (`SCALE_FLIP_TAU_S` — **baked 09-05 r11f**; r6 0.005, original 0.06). Since r11f the lens POINTER rides the same spring (`--box-dy` on the root) | clamped 0.001–1 s (floor lowered r6 so the bake isn't silently clamped) | `motion.js SCALE_FLIP_TAU_S` |
| `?scalewarp` | `?pager=scale` only (09-02 round 2): rows wear a cylindrical camera-lens projection of their CONTINUOUS distance from the lens (screen offset R·sin(δ/R), scale cos(δ/R); `--scale-qf` written per frame; hitTest inverts the same math) — the DOM approximation of the media grid's shader warp. Radius: `--scale-warp-r` (8 stations, CSS-dialable, not a URL knob). Since round 7 the axis hairline is a screen-space SVG that curves along the same implied cylinder (static ellipse; straight when this is off) | `1` (on — **baked 09-03**, Nathan's pick) | `0` \| anything > 0 = on | baked; `?scalewarp=0` compares |
| `?scrimtune` | `?pager=scale` only (09-04 round 7): mounts the SCRIM tuning bench (top-right) — sliders for the engaged scrim's depth (`--pager-scrim` — since the blur fix it is the background-color ALPHA, element opacity holds 1 engaged: opacity < 1 composites the backdrop-filter result over the sharp original, which read as "blur off"), PROJECT TINT (`--scrim-tint` mixes the live `--project-color` into the flood), backdrop BLUR px (`--scrim-bf`), and GRAIN (an SVG feTurbulence data-URI written as `--scrim-noise`: texture none/fractalNoise/turbulence, amount, frequency, octaves, tile size `--scrim-noise-size`, mono toggle, plus ANIM FPS — default 30 — a background-position jitter on `--scrim-noise-pos`, bench-driven; a bake needs its own driver). `hold scrim` paints the scrim without engaging (scene keeps moving — the blur test); dials write inline props on `.fp` (they override the baked recipe), copy block emits the bake. Image texture deliberately not wired yet. **BAKED 09-04** (Nathan's dial, panel defaults mirror it): depth 0.4 · tint 0.75 · blur 7.5px · turbulence grain freq 0.84/oct 1/amount 0.82/rgb on a 184px tile, jittering at 30fps via the shipped `fp-scrim-grain` steps() keyframes (8 frames/0.2667s; still under RM; the bench stills it via `--scrim-grain-anim` while its interval owns the jitter) | baked recipe | `1` = mount (dials are panel-internal, not URL keys) | `ScrimTunePanel.jsx` via `FeaturedProjects.jsx`; recipe in `featured-projects.css` + `--pager-scrim` global.css |
| `?grainsize` | `?pager=scale` only (09-04 r8, the MOBILE scrim dial set): grain tile display size in px — overrides the baked `--scrim-noise-size` (184). URL-side so it dials on a phone without the bench | baked (184) | px > 0 | `GraticulePager.jsx` grain-dial effect |
| `?grainamt` | mobile scrim dial set: grain alpha slope — regenerates the noise tile URI over the baked recipe (`scrimNoise.js SCRIM_GRAIN`); `0` = grain off | baked (0.82) | ≥ 0 | `GraticulePager.jsx` grain-dial effect |
| `?grainfreq` | mobile scrim dial set: feTurbulence baseFrequency — regenerates the tile over the baked recipe | baked (0.84) | > 0 | `GraticulePager.jsx` grain-dial effect |
| `?grainfps` | mobile scrim dial set: re-times the shipped `fp-scrim-grain` steps() jitter driver (8 frames / fps); `0` = static grain | baked (30) | ≥ 0 | `GraticulePager.jsx` grain-dial effect |
| `?scrimblur` | mobile scrim dial set: backdrop blur px (`--scrim-bf`); `0` kills the backdrop-filter entirely — THE mobile-GPU cost dial | baked (7.5) | ≥ 0 | `GraticulePager.jsx` grain-dial effect |
| `?corners` | 09-04 r9 (Nathan): the MOBILE four-corner media preset — every project shares one fixed composition (the Bedouin read): tier-1 = two DECK-SCALE plates (×1.8 `PLATE_DEG`) on one diagonal, tier-2 = two `PLATE_DEG` plates on the other; walls (decks/album art) own tier-1 seats first; exactly 4 media surfaces load; the diagonal flips per slug (hashSeed parity — deterministic). Skips the seeded ring + balance pass. Seats reuse the wall-anchor corners (`BAND_TUNABLES.posX/posY`) pulled in by `?cornerin`; tier scales ride `?t1deg`/`?t2deg`; `?platedeg` still scales everything | on ≤768 / off desktop (`IS_MOBILE`) | `0` = dynamic layout on a phone · `1` = preview the preset on desktop | `worldConfig.js CORNER_PRESET` → `fpDrum.js` |
| `?t1deg` | corner preset (09-04 r10): tier-1 plate scale × `PLATE_DEG` — under the preset the WALLS ride it too (tier-1 footprint parity) | `0.8` (**baked 09-04 r11b**, Nathan's dial; r10 1.35, r9 1.8) | > 0 | `worldConfig.js CORNER_T1_MUL` |
| `?t2deg` | corner preset (09-04 r10): tier-2 plate scale × `PLATE_DEG` | `0.75` (**baked r11b**; r10 0.8, r9 1) | > 0 | `worldConfig.js CORNER_T2_MUL` |
| `?cornerin` | corner preset (09-04 r10): seat pull-in factor on the wall-anchor corner coords — smaller = tighter to centre ("going out of frame a bit" is fine, heavy viewport cropping is not) | `0.5` (**baked r11b**; r10 0.8, 1 = the r9 corners) | > 0, ≤ ~1.2 useful | `worldConfig.js CORNER_INSET` |
| `?selscale` | `?pager=scale` r11e: the SIZE the curve lands rows at — the ±hold rows' scale and the base of the selected row (`--scale-sel`); the box, the evaluated ≤768 caps and the stagger read the same token | `1.5` (**baked r11h** — with roster 1.9 the painted selected = 1.9 × 1.5 × 1.05; r11f 1.8, original 1.688) | > 1 | `global.css --scale-sel` |
| `?selbump` | r11e: the selected row's EXTRA lift over `?selscale` (`--scale-sel-bump`; painted = sel × bump) | `1.05` (**baked r11f**; was 1.15) | ≥ 1 | `global.css --scale-sel-bump` |
| `?namemax` | scale 09-07 (Nathan: desktop names cut off too suddenly): the client-name cap in px — writes both `--scale-name-max` and `--scale-name-sel-max` (one cap, no jump at the detent). Desktop token 12rem → 20rem → 25rem → **2400px** (Nathan's dial 09-07: effectively uncapped — no roster row clips; the selected row's clip is the fixed box); ≤768 the cap is evaluated from the viewport and this overrides it | desktop `2400` · ≤768 evaluated | px > 0 | `global.css --scale-name-max` |
| `?sub` | scale 09-07 (Nathan): the project TITLE (Sanity `title`, present on COCO #08 and Heavy House Society #09 as "(Pre-2026)") rides after the client name as a secondary token — body family, sentence case, weight 400 — and this is its size as an em ratio of the row, so it scales with the row's roster→selected curve. Rendered inside the name copy: the cap, ticker measure and flipper box include it. A title equal to the client name is suppressed | `0.62` | > 0 | `global.css --scale-sub` |
| `?subink` | the title token's ink as a fraction of the row's colour (an opacity over the proximity ink) | `0.7` | 0–1 | `global.css --scale-sub-ink` |
| `?fillpxs` | scale 09-07 (Nathan): the desktop selected row's FILL TICKER — the name always rolls, the copy repeated to fill the fixed box, at this speed in unscaled px/s, phase-locked to the wall clock (the services readout that rolled under it was dropped 09-07). Distinct from the roster/≤768 two-copy marquee (`--marquee-s`) | `30` (**Nathan's dial 09-07**; agent 44) | > 0 | `global.css --scale-fill-pxs` |
| `?boxgap` | scale 09-07 (Nathan): the desktop flipper box is a FIXED width client to client — the widest client name (+ sub token) + seat + pad — capped so at least this gap (px, painted) stays between the box and the `[select_project]` chip | `12` (**Nathan's dial 09-07**; agent 2rem) | px ≥ 0 | `global.css --scale-box-gap` |
| `?unfill` | scale 09-07: how long the OUTGOING row keeps its fill roll after the detent, in ms — the flipper is still deflected onto it at the threshold, so a hold was tried for the COCO snap — the snap was actually the fill re-phasing on every setStation, now arm-only | `0` (**Nathan's dial 09-07** — 1τ and 3τ both read as the roll hanging in the roster; the real COCO cause was a re-phase on re-fill, fixed) | ≥ 0 (`0` = drop at once) | `GraticulePager.jsx unfillLater` |
| `?chipwipe` | scale 09-06 (Nathan: the mobile chip exit "hard cuts"): the `[select_project]` chip's exit-wipe duration in ms (`--scale-chip-wipe-ms`; it ran on the strip's 300ms `--ease-draw` expo-out — ~80ms of visible motion, read as a cut). On `--ease-micro` now | desktop `300` (09-07, Nathan: quicker on desktop) · ≤768 `520` | ms > 0 | agent number — dial on device |
| `?roster` | scale r11g (Nathan: desktop roster too small): multiplier on the roster rows' base size (`--text-mono`). The selected paint = roster × `?selscale` × `?selbump`, so rebalance `?selscale` after raising this | desktop `1.9` (**baked 09-05 r11h**, Nathan's desktop dial) · ≤768 `1` (at 1.9 the digits overrun the cell into the axis on a phone — dial on device) | > 0 | agent number — dial |
| `?inkreach` | scale r11g (Nathan: "much more gradual"): the INK curve is its own — CONTINUOUS per frame (`--ndr`), not the detented size step — white at the lens → `?inkfloor` at this many stations out | `5` (**baked r11h**) | > 0 | agent number |
| `?inkexp` | scale r11g: the ink curve's exponent (1 linear, 2 = f²) | `1.9` (**baked r11h**) | > 0 | agent number |
| `?inkfloor` | scale r11g: the roster ink as a fraction of white (was the fixed 55%) | `0.8` (**baked r11h**; was the r4 0.55) | 0–1 | agent number |
| `?falloff` | `?pager=scale` only (09-04 r11, Nathan: "too jarring"): the proximity curve's RADIUS in stations — where the row lift AND the ink weight reach roster size (the r8 curve was a fixed two stations: ±1 full, then an abrupt drop). Since r11e the curve keys off the DETENTED row (integer distance — sizes step at the detent, in the frame the flipper box lands; no pre-lift as a row approaches). Written inline as `--scale-falloff` | `0.5` (**baked 09-05 r11f**; r11b 0.75 — radius = hold → a step: only the lens row lifts) | > `?falloffhold`; ≤ `--scale-rows` useful | `global.css --scale-falloff` |
| `?falloffhold` | scale r11: stations either side of the lens that HOLD at the full `--scale-sel` before the roll-off starts (the ±1 neighbours). `0` = the descent begins right off the selected row | `0.5` (**baked r11f**; r11b 0.75, r11 1) | ≥ 0 | `global.css --scale-falloff-hold` |
| `?falloffexp` | scale r11: the roll-off's curve exponent past the hold (`pow(wr, exp)`) — 1 = linear, 2 = f²; (since r11g the ink has its OWN curve — `?ink*`) | `2` (**baked r11f**; r11b 1, r11 1.5) | > 0 | `global.css --scale-falloff-exp` |
| `?hairslice` | scale r11 (Nathan): the axis stroke is SLICED per station — each row's `::after` draws its own 1px segment at the tick origin, so the stroke scales with the row and its position between number and name holds constant (the r7 screen-space SVG hairline cut through the scaled-up names). The slices ride the cascade fade, ink and warp projection; the SVG hides. `0` = the single SVG hairline back | `1` (on) | `0` \| anything > 0 = on | taste call — the neighbour x-steps are the effect |
| `?slicereach` | scale r11c (Nathan: stepped AT THE CENTRE, continuous at the outer rows; the selected row protruded too far): each row's axis slice + tick pull OUT toward the selected row's own axis by a taper that is 1 at the lens and 0 at this many stations, so the steps are big at ±1/±2 and gone by the reach; flows per frame with the scrub | `3` (`--scale-slice-reach` — **baked r11f**; was 4) | > 0 | agent number — dial on device |
| `?sliceexp` | scale r11c: the taper's curve exponent (`pow(1 − ndr/reach, exp)`) — >1 = steep near the centre, flat at the edges | `2` (`--scale-slice-exp`) | > 0 | agent number |
| `?sliceamp` | scale r11c: amplitude of the funnel — the lens-adjacent target climbs this fraction of the selected row's lift (taper-weighted); axis + tick + NAME shift as a group, the number stays; offsets clamp at 0 (nothing moves inward, the barrel at the edges is untouched). `0` = straight axis (the r11b read) | `1` (`--scale-slice-amp`) | ≥ 0 | agent number |
| `?cardname` | fp-card MOBILE dial set (09-04 r8): client-name headline font-size in px (`--fp-card-name-size` inline on `.fp`; the shipped clamp holds when absent — both tiers read it) | shipped clamp | px > 0 | `FeaturedProjects.jsx` card-dial effect |
| `?tagtext` | fp-card mobile dial set: service-tag pill font-size px (`--fp-tag-size`; shipped `--text-mono`) | token | px > 0 | `FeaturedProjects.jsx` card-dial effect |
| `?tagpad` | fp-card mobile dial set: pill vertical padding px (`--fp-tag-pad-y`; shipped `--space-2`) | token | px > 0 | `FeaturedProjects.jsx` card-dial effect |
| `?tagpadx` | fp-card mobile dial set: pill horizontal padding px (`--fp-tag-pad-x`; shipped `--space-5`) | token | px > 0 | `FeaturedProjects.jsx` card-dial effect |
| `?taggap` | fp-card mobile dial set: gap between pills px (`--fp-tag-gap`; shipped `--space-4`). Media density/spacing dials are the EXISTING world knobs: `?max` (tile count), `?platedeg` (plate size), `?fpwin` (placement window), `?fpvis` (visible-frame judge) | token | px > 0 | `FeaturedProjects.jsx` card-dial effect |
| `?scroll` | px of wheel/touch (touch × `TOUCH_GAIN` 2) that fills a CTA and fires a World Turn; the same value is the footer-reveal distance at the last World and the return-home threshold + f² pre-cover at the first | `500` px | any finite; no clamp (0 divides by zero) | `motion.js:74 SCROLL_TRIGGER_WORK_PX` |
| `?caret` | seconds for one caret to travel one slot in the `[NEXT]` / `[PREVIOUS]` chevron strips (module-global: every CtaArrows on every route); static under RM | `6` s | any finite | `CtaArrows.jsx:21,23` |

Pager constants with **no** URL knob, the engine's defaults (`motion.js`; the tape/tuner arms that also read them were deleted 09-05): `PAGER_HOLD_MS` 200, `PAGER_SLOP_PX` 8, `PAGER_STALL_COMMIT_MS` 450, `PAGER_PEEK_MS` 900, `PAGER_FLICK_CARRY_S` 0.12, `PAGER_TAU_SCRUB` 0.05, `PAGER_TAU_GLIDE` 0.27, `PAGER_END_RESIST` 0.3, `PAGER_KEY_COMMIT_MS` 400. Per-arm, no knob: `SCALE_END_RESIST` 0.2 (`SCALE_STALL_COMMIT_MS` deleted 09-03 r6 — the scale passes `stallMs: Infinity`, so a desktop wheel settle is a preview and the Turn evaluates only at disengage: pointerleave / touch release / keyboard). (`TUNER_*` deleted 09-05.) Engine-local: `TAU_SETTLE` 0.08, `READ_BEAT_MS` 240, `HOVER_INTENT_MS` 120, `END_OVERTRAVEL_CAP` 0.35, `CLICK_SUPPRESS_MS` 350 (`usePagerGesture.js`).

Engine `tuning` options a skin may pass (09-01, all optional; the defaults are the original tape-wheel feel): `detentPx`, `wheelDetentPx`, `endResist` (0 = hard clamp), `stallMs` (non-finite = never auto-commit), `magnet` (false = 1:1, no detent shaping), `magnetExp`. `clampRaw()` bounds raw overtravel to `END_OVERTRAVEL_CAP / endResist`, and `focusSilently(el)` moves a roving tabstop without arming the `:focus-visible` engage.

Chrome tokens — scale: `--scale-w` `--scale-num-h` `--scale-pitch` (pre-hydration fallback — the skin writes it inline) `--scale-rows` (deployed aperture, stations each side of the lens: 7 desktop / 6 ≤768) `--scale-open-ms` `--scale-close-ms` `--scale-stagger-ms` (a CAP — the effective delay is fitted to the open/close budget) `--scale-fade-ms` `--scale-flash-ms` `--scale-lens-zoom` `--scale-label-max` `--scale-falloff` `--scale-falloff-hold` `--scale-falloff-exp` (r11 proximity curve — URL-dialable via `?falloff*`) `--scale-slice-reach` `--scale-slice-exp` `--scale-slice-amp` (r11c centre stagger — `?slice*`) `--scale-name-max` (desktop 20rem since 09-07; `--scale-name-sel-max` aliases it — one cap; ≤768 both EVALUATED from the viewport since r11d; JS reads the computed value); shared: `--pager-stage-dim`. (The `--tape-*` / `--tuner-*` sets were deleted 09-05.) All in `global.css` `:root` with a ≤768px tier. Runtime-written root properties (not authored tokens): `--scale-c` (the row under the lens now), `--scale-q` (where the lens landed — the hairline's close origin). Other /work constants: `TOUCH_GAIN` 2, `RELEASE_MS` 160, `GLIDE_MS` 800 (`motion.js:80-89`), FeaturedProjects `PAGER_BASE_GAIN` 1.6 / `PAGER_HOVER_GAIN` 1.8 / `CTA_MAX_EXTRA` 0.3 / `HOME_PRE_COVER` 0.4 / `RM_WHEEL_THRESHOLD` 60 (`FeaturedProjects.jsx:62-71`).

### House pulse (`?fp1tune=1`)

The four shape knobs regenerate a live `HOUSE_PULSE_PATH`; at defaults the path is byte-identical to `motion.js:36`. `?fp1period` / `?fp1rest` / `?fp1mix` are also read directly in WorldCard, so they work without the bench; the shape knobs and `?fp1on` need `?fp1tune=1`.

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?fp1peakx` | attack: x where the pulse hits its peak | `0.45` | slider 0.02–0.6 / 0.005 | `motion.js:36 HOUSE_PULSE_PATH` |
| `?fp1soft` | attack softness, 0 hard → 1 very soft (0.5 = house control points) | `1` | slider 0–1 / 0.01 | `HOUSE_PULSE_PATH` |
| `?fp1holdx` | hold end x, clamped ≥ peakX (the default < peakX gives a zero-length crest) | `0.235` | slider peakX–0.95 / 0.005 | `HOUSE_PULSE_PATH` |
| `?fp1fall` | fall ease: 0 linear, >0 bows into a held-high S | `0.65` | slider 0–1 / 0.01 | `HOUSE_PULSE_PATH` |
| `?fp1period` | full pulse cycle (hit + rest) of the enter_world dip | `2.3` s | slider 1–8 / 0.1 | `motion.js:40 HOUSE_PULSE_PERIOD_S` |
| `?fp1on` | fraction of the period the hit occupies (bench only) | `0.75` | slider 0.2–0.8 / 0.05 | `motion.js:41 HOUSE_PULSE_ON_RATIO` |
| `?fp1rest` | rest beat between the boot entrance's end and the first dip | `1.05` s | slider 0–2 / 0.05 | `WorldCard.jsx:104` |
| `?fp1mix` | how far the enter_world fill travels toward `--color-dim-gray` at the dip (label → white by the same amount); not on the panel, never in `copy_url` | `1` | 0–1 (clamped) | `WorldCard.jsx:102` |
| `?fp1dim` | **dead**: old opacity-dip depth; read, serialized and on a slider, never applied since the fill-pulse redial | `0.3` | slider 0–1 | nothing (superseded by `?fp1mix`) |

### Text exit (`?texttune`; seeds apply on every load)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?txtag` | interval between service-tag hard cuts (random order) | `60` ms | any finite | `textExit.js:41` |
| `?txchar` | interval between client-name letter cuts (random order) | `35` ms | any finite | `:42` |
| `?txtabdelay` / `?txtab` | wait before / duration of the `PROJECT_##` tab clip (top edge eats downward on the enter curve) | `0` / `240` ms | any finite | `:43-44` |
| `?txnavdelay` / `?txnav` | wait before / duration of the prev/next wipes (prev exits up, next down) | `0` / `300` ms | any finite | `:45-46` |
| `?txcard` | card-block scale destination on the scene's enter move channel (timing lives on `?entertune`) | `1.8` × | any finite | `:47` |
| `?txnavscale` | prev/next chip scale destination (`--tx-scale`) | `1.35` × | any finite | `:48` |

### Site tagline (no bench; `SiteTagline.jsx` reads it once at mount, any route)

The pill shows the long blurb while home is at rest and the short tagline everywhere else (10-06). `?txchar` also paces its Enter World letter exit; the long blurb cuts in the short tagline's total time.

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?tagmorph` | the long ⇄ short morph: the capsule's resize clock (power3.out); the incoming words start at 35% of it | `600` ms | > 0 | `SiteTagline.jsx TAG_MORPH_MS` |

## `/work/[slug]` — detail pages

Readers: `detail/DeckScroller.jsx` (`num()`, module-load), `detail/BandPager.jsx` (`qNum()` in an effect), `detail/NextProjectBand.jsx` (`PARAM()`, module-load), `detail/GridSocket.jsx` (effect). No bench panel here; this is the intended dial route for `?lenistune=1` / `?footertune=1`.

### Deck / album walls (DeckScroller)

`?deckvrows` only applies to the album-art wall (BrandDeckViewer passes `cols={2}`); the other three apply to both walls. Drift and gear are inert under RM.

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?deckvrows` | page rows visible in the wall frame → derives the column count | `2` | any finite | `DeckScroller.jsx VISIBLE_ROWS` |
| `?deckwgap` | gutter px between pages (also `--deck-wgap`) | `2` px | any finite | `GAP_PX` |
| `?deckdrift` | idle column drift, alternating direction per column | `8` px/s | any finite | `DRIFT_PX_S` |
| `?deckgear` | scroll coupling: `abs(lenis.velocity) × gear` px per frame (0 without Lenis) | `0.08` | any finite | `SCROLL_GEAR` |

### BandPager (**tabled**: no importer renders it, so these 14 knobs are read but inert)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?deckspacing` | scales both stacks: fan step directly, pile steps via `spacing / FAN_X` | `46` px | any finite | `bandLayout.js:54 DECK_SPACING` |
| `?deckangle` | isometric `rotateY` of every page | `-8` deg | any finite | `bandLayout.js:44 BAND_ANGLE` |
| `?deckhome` | viewing-slot resting x, fraction of page width | `-0.12` | any finite | `bandLayout.js:51 HOME_X` |
| `?deckfany` | downward step per waiting page | `12.88` px | any finite | `bandLayout.js:55 FAN_Y` |
| `?deckpilex` / `?deckpiley` | horizontal (left) / upward step per shown-pile card; pin the step | `39.1` / `8.28` px | any finite | `bandLayout.js:63-64 PILE_X` / `PILE_Y` |
| `?deckexitx` / `?deckexity` | soft aliases of `deckpilex` / `deckpiley`, lower precedence | — | any finite | retire |
| `?deckshift` / `?deckshifty` | whole-composition x nudge / y lift, × stage size | `0` / `-0.12` | any finite | `BandPager.jsx:75-76` |
| `?deckhold` | viewing-slot plateau width | `0.3` | clamped 0–0.9 | `bandLayout.js:77 VIEW_HOLD` |
| `?deckalbum` | album-cover size multiplier when ratio < 16/9 | `1` | any finite | `BandPager.jsx:303` |
| `?deckcycle` | idle auto-advance dwell (user pages hold 2×); ≤0 disables | `2.6` s | any finite | `BandPager.jsx:85 CYCLE_S` |
| `?deckw` | page width cap × stage width | `0.5` | any finite | `BandPager.jsx:82 WIDTH_CAP` |

### Next-project band (document end; inert under RM, which renders a plain link)

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?scroll` | px of accumulated wheel/touch (touch ×2) that commits the passage | `500` px | any finite | `motion.js:74 SCROLL_TRIGGER_WORK_PX` |
| `?nparm` | arming beat: deltas inside this window after the first at document end are dropped (flick tail); tuned against lerp 0.1, the bake is now 0.165, re-check | `250` ms | any finite | `NextProjectBand.jsx NP_ARM_MS` |
| `?npms` | commit choreography length (proxy fill, box → viewport, cover, zoom) | `800` ms | any finite | `motion.js:89 GLIDE_MS` |
| `?npcover` | RouteFill snap window at the end of the commit | `120` ms | any finite | `NP_COVER_SECONDS` |
| `?nppre` | in-window blue pre-cover opacity at full drag (f² curve) | `30` % | any finite | `NP_PRE_COVER` |
| `?npzoom` | media push-in scale over the commit | `1.08` | any finite | `NP_ZOOM` |
| `?npsplit` | label run length as a fraction of the fill (the title reuses it) | `0.55` | finite ≠ 0 | `NP_SPLIT` |
| `?nplag` | title ramp start fraction; media ramps at 2 × lag over 1 − 2 × lag | `0.15` | finite < 0.5 | `NP_LAG` |
| `?sockpar` | GridSocket parallax factor (`1` = pinned to grid); inert ≤1024px and under RM | `0.92` (prop) | any finite | `GridSocket.jsx:31` default prop |

## `/process`

**09-08 additions.** `?scrim` (presence gate, `ProcessPage.jsx`) turns the ≤768 copy scrim back ON — it is OFF by default since 09-08 and now spans the full viewport width (a `.process-section::before` bleed). The last slide bakes in the footer + logo ticker (the driver's final rest = document end; `SiteFooter travelK={1}`), and phone cards anchor to the viewport bottom (`--ps-mobile-bottom`). Keyword highlights: `[[word]]` in `processContent.js` blurbs (and the Sanity `description`) — `src/lib/keywords.jsx`.

Reader: `src/components/process/processConfig.js` (`num()` / `str()`, module-load). Two tiers. **Module consts** (reload-only, not on the panel, not in `copy_url`): `?ospin` `?ostroke` `?opad` `?camlag` `?debug`. **`TUNING`** (live via the `?debug` panel's `applyTuning()`: framing/drift/glow/stroke instant, durations/orders/hops/rhythm on the next transition). `ms` knobs travel as ms in the URL and store as seconds. Bake: `processConfig.js:48-77 TUNING_DEFAULTS` unless noted.

| param | what it does | default | values | bake |
|---|---|---|---|---|
| `?debug` | mounts ProcessDebugPanel + `[ProcessScene]` goTo/setStageInstant console logs | off | presence | — |
| `?ospin` | live globe-O spin about the polar axis (negative westward, 0 still) | `-20` deg/s | any finite | `:38 O_SPIN_DPS` |
| `?ostroke` | globe-O outer-stroke ring, % proud (the globe shrinks inside) | `3` % | finite ≥ 0 | `:39 O_STROKE_PCT` |
| `?opad` | clear air each side of the O glyph slot | `0.175` em | any finite | `:40 O_PAD_EM` |
| `?camlag` | resize: camera re-eval trails the window | `0.7` s | any finite (floor 0.01) | `:44 CAM_LAG_S` |
| `?stagems` | base stage-transition duration | `650` ms | slider 0.4–3 s / 0.05 | `.stageSeconds` |
| `?scatter` | fragment-belt spread (annulus radius) | `2.05` | slider 0.8–3.2 / 0.05 | `.scatter` |
| `?drift` | suspended-cloud self-rotation rate | `0.09` | slider 0–0.8 / 0.005 | `.drift` |
| `?threadhops` | fragments the Thread chains | `84` (every bead) | slider 3–84 / 1 | `.threadHops` |
| `?threadms` | Thread draw per hop | `100` ms | slider 0.05–2 s / 0.05 | `.threadHopSeconds` |
| `?assemble` | assembly scatter → home | `2.5` s | slider 0.5–5 / 0.1 | `.assembleSeconds` |
| `?zoomout` | S2→S3 dolly-back | `0.6` s | slider 0.3–2.5 / 0.05 | `.zoomOutSeconds` |
| `?emanate` | S4 per-panel scale target | `1.7` | slider 1–2.2 / 0.05 | `.emanateScale` |
| `?emanateorder` | S4 stagger order | `poles` | `rows` \| `poles` \| `sweep` | `.emanateOrder` |
| `?bpm` | S5 pattern-loop tempo | `123` | slider 60–180 / 1 | `.bpm` |
| `?cascade` | S3 light-up variant | `rows` | `rows` \| `poles` \| `sweep` | `.cascadeVariant` |
| `?fillfrac` | contain-fit fraction (the belt fits whole) | `0.98` | slider 0.4–1.2 / 0.01 | `.fillFraction` |
| `?s3fill` | post-zoom-out Core fill | `0.31` | slider 0.2–1 / 0.01 | `.s3Fill` |
| `?s45fill` | S4/S5 build-out fill (outgrows the frame) | `1.1` | slider 0.5–1.3 / 0.01 | `.s45Fill` |
| `?idlepower` | belt idle brightness | `0.54` | slider 0–1 / 0.02 | `.idlePower` |
| `?pulsemin` | S5 falloff floor (0 = full black) | `0.06` | slider 0–1 / 0.01 | `.pulseMin` |
| `?hold` | S5 beats held ON blue before falloff (capped at 45% of the cycle) | `0.1` beats | slider 0–2 / 0.05 | `.holdBeats` |
| `?decay` | S5 beats of falloff to the floor | `2` beats | slider 0.1–4 / 0.05 | `.decayBeats` |
| `?pattern` | S5 sequencing (`cycle` rotates the rest one per pass) | `cycle` | `cycle` \| `rows` \| `equator` \| `ripple` \| `checker` \| `random` | `.pattern` |
| `?decaycurve` | S5 falloff ease | `expo` | `expo` \| `linear` (anything ≠ linear = expo) | `.decayCurve` |
| `?s5zoom` | S5 push-in over S4 framing | `1.06` | slider 1–1.3 / 0.01 | `.s5Zoom` |
| `?s5tilt` | S5 axis lean | `33` deg | slider 0–60 / 1 | `.s5TiltDeg` |
| `?s5stroke` | S5 inner-stroke mix where the falloff lands (0 disables) | `1` | slider 0–1 / 0.05 | `.s5Stroke` |
| `?stroke` | fragment edge stroke width (0 disables) | `1.75` px | slider 0–4 / 0.25 | `.strokePx` |
| `?dropy` | phone Core drop (mobile, core form only) | `0.02` | slider 0–0.5 / 0.02 | `.mobileDrop` |
| `?swipe` | one-section-per-swipe quantizer; flipping off live restarts Lenis | `on` | `on` \| `off` (code also treats `0` as off) | `.swipe` |
| `?swipepx` | wheel/touch px (touch ×2) to commit a section swipe; `?scroll` is the legacy alias, lower precedence | `500` px | slider 150–1200 / 25 | `motion.js:75 SCROLL_TRIGGER_PROCESS_PX` |
| `?swipems` | committed section glide length (house Turn curve) | `800` ms | slider 0.4–2.5 s / 0.05 | `.swipeSeconds` (mirrors `motion.js GLIDE_MS` 800: two literals to keep in sync) |

Page keyboard (always on, not just with `?debug`): ArrowDown / PageDown / Space next, ArrowUp / PageUp / Shift+Space previous, Home / End glide to top / last rest. The quantizer ignores wheel/touch inside `.process-debug`. RM: no quantizer, no Lenis, stills at boundaries.

## Debug globals and console

All gated on `?debug` (exact key in useWorldScene; **substring** in fpDrum/fpAtlas, so `?deckdebug` arms those two as well). None log on their own.

| global | route | returns |
|---|---|---|
| `window.__worldLiveStats()` | `/work` (only when a live scheduler exists: pool, `?live` > 0, not RM) | `{ live, pending, nearCandidates }` |
| `window.__worldBandStats()` | `/work` | per slot, `{ phase, appear, planes, visible }` per band; **throws under any grid mode** (reads `.phase`, which only legacy band records carry) |
| `window.__fpDrum[slug]` | `/work` DRUM | `{ arcOffsetDeg, arcLonDeg, drumAdv, placedTiles, dropped, strips, balance, blocks }` per World build |
| `window.__fpAtlas[slug]` | `/work` ATLAS | `{ blocks, stripBlocks, aspect }` |
| `[ProcessScene] goTo/setStageInstant` | `/process` `?debug` | `console.info` on every stage move |
| `window.__swmPopStats` | `/` — **not** `?debug`-gated: published ~2 Hz whenever `?popmode` ≠ off (branch `refine/globe-worlds`) | `{ mode, phase, grouping, world, next, transition, holdLeft, color, pattern, seed, step, focus, integrity, visible, black, flips, flipsPerSec, warm, textures, gpuTextures, streams, liveTiles, live, fps }` — `phase` hold / transition / relayout / frozen; `streams` = video decodes, `liveTiles` = the tiles they light; PopTunePanel's readout and `scripts/globe-probe.mjs` read it |

Ungated traces: every live `<video>` carries `data-playback-id` (VideoSlotPool). Persisted state that changes behaviour without a param: `sessionStorage['swm:hero-intro']` (first-visit flag → full vs replay entrance), `swm:worldIndex` + `swm:returnToWork` (breadcrumb return World; since 10-06 a snap, like Enter World's `swm:enterWorld`).

## Inert, legacy, and dead knobs

Don't dial these expecting a change.

- **Dead (read, applied nowhere):** `?commitease` (no importer), `?fillcover` (every dispatcher passes a duration), `?fp1dim` (superseded by `?fp1mix`; its slider + copy-block line still exist).
- **Dry-run only** (hero commit rehearsal, not the live click): `?commitms ?fillmode ?bluecascade ?bluestart ?blueend ?recenterstart ?recenterend ?zoomstart ?zoomend ?campow ?envscale ?bluesurge ?bluedipend ?bluedipdepth`. Enter-world: `?enterhold ?enterfill`.
- **Inert at the shipped `fpgrid=3` DRUM:** `?zjitter ?tile ?scatter ?spawnscale ?exit ?enter ?recede ?bandh ?bandcycle ?bandpages ?deckspace ?deckhome ?deckfan ?deckpile ?deckhold ?deckalbum ?parallax ?drift` (legacy / ATLAS / FORME consumers only); `?panepitch` FORME only; `?fpglowa` needs `fpglow=2`; the `rip*` family needs `fpglow=1`.
- **Tabled component:** all 14 detail BandPager knobs (`?deckspacing` … `?deckw`).
- **Latent unless loaded with `?intro=a|c`:** `?introms ?introhold ?introcascadeat ?heroink`.
- **Legacy aliases (lower precedence, retire):** `?entercover` → `?enterms`; `?deckexitx` / `?deckexity` → `?deckpilex` / `?deckpiley`; `?scroll` on `/process` → `?swipepx`.
- **Not a tunable:** `ProjectOverlay.jsx` uses `URLSearchParams` to encode the inquiry form body.

## Drift and latent bugs found while building this guide

Worth tickets; none were fixed here.

1. `window.__worldBandStats()` throws `TypeError` under any grid mode once a band exists.
2. `?deckdebug` arms `__fpDrum` / `__fpAtlas` through the `includes('debug')` substring match.
3. A bare or junk `?max` silently disables the DRUM 8→12 width ramp (presence check).
4. `?lenistune=1` alone reverts the live Lenis feel to library defaults (see the Lenis section).
5. ~~`?footerlockup` lost on the first soft nav~~ FIXED 10-07 — `footerTune.js` re-asserts every knob in the family on `astro:after-swap` (the 08-25 `<html>`-attribute-wipe rule).
6. ~~`?detent` / `?wheeldetent`~~ FIXED 09-01 (floored at 8px in all three pager arms). `?scroll` / `?caret` still have no clamps; `0` yields NaN / Infinity.
7. Duplicated literals: `FeaturedDeckDebugPanel.KNOBS[].def` vs worldConfig defaults; `?swipems` 0.8 vs `GLIDE_MS`; `wallpages` vs `BAND_PAGE_CAP`; `footerlockup` in `footerTune.js` and the CSS fallback — still duplicated by design (the fallback IS the shipped default), but the whole `?footer*` family is now held together by `scripts/test/footer-reveal.test.mjs`.
8. Stale comments: `herolabels` "shipped ON" (Hero.jsx:33, 418, 895; heroConfig.js:219), `herotilt` "40 default" (HeroTunePanel.jsx:314), HeroTunePanel's `?commitease` note (:261), `bandpages` "keep matched with BAND_PAGE_CAP" (worldConfig.js:195), `--fp-fade` CSS fallback 65 vs bake 0, smoothScroll.js:35 "LENIS_TUNING empty today", `PARALLAX` "radians".
9. HeroTunePanel's `recenter end` slider caps at 1; the bake is 3.
10. `?nparm` was tuned against Lenis lerp 0.1; the bake is 0.165.

## Bake targets index

| file | what lives there |
|---|---|
| `src/lib/motion.js` | `HOUSE_PULSE_*`, `SCROLL_TRIGGER_WORK_PX` / `_PROCESS_PX`, `TOUCH_GAIN`, `RELEASE_MS`, `GLIDE_MS`, `PAGER_*`, `LENIS_TUNING` |
| `src/components/hero/heroConfig.js` | `TUNING_DEFAULTS`, `COMP_DEFAULTS`, `HERO_LABELS`, the `globestroke` / `introease` literals |
| `src/components/globe/globeConfig.js` | live-tier scores/dwells, pole-cap + corner geometry, `FILL_FRACTION`, `FIT_COVER`, `GAP_DEG`, `CAP_DEG` |
| `src/components/globe/popConfig.js` | `POP_DEFAULTS` (branch `refine/globe-worlds`; nothing baked yet) |
| `src/components/work/world/worldConfig.js` | every World scene knob; `BAND_TUNABLES` seeds |
| `src/components/work/world/enterTune.js` | `ENTER_TUNE_DEFAULTS` |
| `src/components/work/textExit.js` | `TEXT_TUNE_DEFAULTS` |
| `src/components/work/fp1Tune.js` | `FP1_DEFAULTS` (mirror of motion.js) |
| `src/components/work/WorldCard.jsx` | the `fp1mix` / `fp1rest` literals |
| `src/components/work/bandLayout.js` | `DECK_SPACING`, `BAND_ANGLE`, `HOME_X`, `FAN_Y`, `PILE_X` / `PILE_Y`, `VIEW_HOLD` |
| `src/components/work/detail/{DeckScroller,BandPager,NextProjectBand,GridSocket}.jsx` | their module consts |
| `src/components/process/processConfig.js` | `TUNING_DEFAULTS`, globe-O consts, `CAM_LAG_S` |
| `src/components/RouteFill.jsx`, `src/components/work/CtaArrows.jsx`, `src/lib/footerTune.js` | `fillcover` / `fillrelease`, `caret`, footer defaults |
| `src/styles/global.css` | `--tape-*`, `--pager-stage-dim`, `--stepnav-*`, `--footer-lockup-h`, `--text-mono` tiers |
| `src/pages/work/index.astro:38` | `BAND_PAGE_CAP` (pairs with `wallpages`) |

## Regenerating this guide

The key inventory is machine-extracted; the prose is not. When a param is added, renamed or removed:

```sh
node scripts/tunables-keys.mjs                                   # every param key with its read sites
node scripts/tunables-keys.mjs --check                           # fails if a code key is missing from this doc
grep -rlE "URLSearchParams|searchParams|location\.search" src    # the reader files (26 on 2026-09-01)
node scripts/tunables-guide-html.mjs docs/tunables-guide.md out.html   # rebuild the navigable HTML (artifact) version
```

The extractor follows every idiom in use: `params.get/has('k')`, the `num()` / `PARAM()` / `qNum()` / `str()` helpers, `PARAM_KEYS` maps, `FOO_PARAM = 'k'` name constants, `[param, option]` pairs, `stateKey: ['k', reader]` tuple maps (popConfig) and `location.search.includes('k')`. A new reading style needs a new regex there. Known false positives it ignores: `a`, `panels` (variant arrays), `equal`, `video`, `mix`, `shared` (popConfig vocab pairs), `email` (form field). For a new key, read its reader file and add a row: what it does, default with units, accepted values, bake target; if it is inert or dry-run only, say so in the lists above.
