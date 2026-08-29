/**
 * worldConfig.js — tunables for the Featured Projects WorldScene.
 *
 * First-pass values, dialed in by live testing. The knobs below can be
 * overridden live via URL query params (no rebuild) for tuning, e.g.:
 *   /work?lens=-0.5&tile=1.2&scatter=0.8&zjitter=0.8&sep=0.5&fov=40
 */
import { HOME_X, VIEW_HOLD } from '../bandLayout.js';

export const IS_MOBILE =
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 768px)').matches;

export const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── live tuning overrides (?key=value) ──
const PARAMS =
  typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : null;
const num = (key, fallback) => {
  const raw = PARAMS?.get(key);
  const n = raw == null ? NaN : parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
};

/* — fp-grid mode (refactor/fp-grid-media) — media lives IN the grid.
   ?fpgrid selects the expression: 1 ATLAS (on-sphere plates, fixed graticule),
   2 FORME (locked letterpress pane, re-deal Turn), 3 DRUM (one continuous
   revolving world). 0 = the legacy floating tile field. Default = 3 — DRUM is
   the blessed direction (Nathan, 08-27 feel pass); 1/2 stay live for
   comparison. All grid modes: SHELL_SPIN → 0, media + grid move as one body. */
export const FPGRID = Math.round(num('fpgrid', 3));
export const FPGRID_ACTIVE = FPGRID > 0;

/* — fp-grid shared knobs (house num() convention) — */
export const PLATE_DEG = num('platedeg', 12); // plate longest side, degrees of arc — Nathan's 08-27 DRUM bake (was 11.5)
export const FPGRID_WINDOW = num('fpwin', 1.1); // usable fraction of the frustum — Nathan's 08-27 DRUM bake (was 0.78): > 1 lets edge blocks run off the frame, implying more world beyond it
export const CAM_LOOK = num('camlook', 0.025); // ATLAS parallax: camera look-around amplitude (radians ≈ legacy near-tier travel)

/* — DRUM refinement knobs (08-27 second pass, DRUM blessed) — */
export const FPGRID_BALANCE = num('fpbal', 1) !== 0; // semi-balance pass over the seeded placement (0 = raw ring placement, for A/B)
export const FPGRID_VIS = num('fpvis', 0.85); // fraction of the frustum the lens crop actually SHOWS — the balance pass judges zone occupancy against this visible frame, independent of the ?fpwin placement window
export const FPGLOW = Math.round(num('fpglow', 1)); // grid-panel illumination: 0 off · 1 accent ripple emanating from center (launches on the house-pulse cadence — reinforces enter_world) · 2 pointer-trace (cells light as the cursor passes, lens-distortion-corrected)
export const FPGLOW_ALPHA = num('fpglowa', 0.2); // pointer-trace alpha basis (the trace runs ×3, capped 0.55); the RIPPLE's peak is ?ripalpha below
/* — Ripple bench (?fpglow=1 — Nathan's pick; defaults = his 08-27 (4) bake:
   slow droplets every 2.5 pulses, wide crests, peaking at the grid lines'
   own ink) — */
export const RIPPLE_VAR = Math.round(num('ripvar', 3)); // radial animation: 1 pulse ring (one crest, fades as it travels) · 2 wavetrain (identical crests, no travel fade) · 3 droplet (crisp front + damped trailing crests — the water read). Launches are INDEPENDENT: each fires on the cadence and keeps traveling until its trail leaves the frame (cap 8 alive)
export const RIPPLE_SHADE = Math.round(num('ripshade', 0)); // cell shading: 0 FLAT fill — illumination fills each cell to the grid lines · 1 hairline inset (the soft bevel/emboss read)
export const RIPPLE_EVERY = Math.max(0.25, num('ripevery', 4)); // house periods between launches — 08-27 (5) bake 4 (was 2.5); fractions allowed
export const RIPPLE_SPEED = num('ripspeed', 0.15); // ripple travel, fraction of the capped radius per second — 08-27 bake (was 0.45)
export const RIPPLE_FALLOFF = num('ripfall', 0.13); // distance decay length, × the capped radius — 08-27 (5) bake 0.13 (was 0.8): a tight bright heart that dies fast with distance
export const RIPPLE_RADIUS = num('riprad', 1); // ripple extent, × the visible window's half-diagonal
export const RIPPLE_WIDTH = num('ripw', 5); // crest half-width, in lat cells (var 3's crest spacing rides it ×4) — 08-27 (5) bake 5 (was 6)
export const RIPPLE_ALPHA = num('ripalpha', 1); // ripple peak alpha — 08-27 (5) bake: FULL ink (was coupled to ?shellalpha); with the tight ?ripfall the falloff does the dimming
export const FPTAB = num('fptab', 1) !== 0; // plate spine tabs: small accent tab, −90° mono cell-coordinates, bottom-left of each plate
export const FPFURN = num('fpfurn', 0) !== 0; // drum furniture: seeded registration crosses / coordinate captions / cell floods in empty cells (FORME's furniture language riding the drum)
export const WALL_DRIFT = num('walldrift', 9); // deck/album wall plates: idle column drift, canvas px/s (DeckScroller's ?deckdrift idiom)
export const WALL_GEAR = num('wallgear', 12); // wall px of column travel per DEGREE of drum roll — the Turn accelerates the wall the way Lenis scroll does on the detail page. 08-28 bake 12 (was 5): Nathan's call from the taste pass
export const WALL_MAX_PAGES = Math.max(4, Math.round(num('wallpages', 12))); // pages a wall plate cycles — pairs with BAND_PAGE_CAP in work/index.astro (the register plates still slice BAND_MAX_PAGES)
export const DRUM_CREEP = num('creep', 0); // DRUM idle: whole-body creep, deg/sec (0 = still — Nathan's toggle)
export const ARC_DEG = num('arcdeg', 60); // DRUM: arc per project (6-fold). 60° keeps the conveyor CONTINUOUS — the incoming arc enters the frame before the outgoing exits; 120° left a long bare-grid beat mid-roll.
export const DRUM_TURN_MUL = num('drumturn', 1.15); // DRUM: Turn duration × (60° needs less stretch than the 120° sweep did)
export const PANE_PITCH = num('panepitch', 3); // FORME: macro-cell pitch as a multiple of the shell's fine pitch

/* — Camera / render budget — */
export const CAMERA_FOV = num('fov', 42); // vertical degrees
export const DPR_MAX = num('dpr', 1.5); // 1.5 caps render-target memory (scales with DPR²; was desktop 2). ?dpr to A/B
export const MSAA_SAMPLES = num('msaa', 4); // composer target multisamples (08-25 grid AA); 0 = off, ?msaa to A/B
export const FPS_CAP = 60;
export const MAX_TILES = num('max', IS_MOBILE ? 9 : 8); // desktop 8 — Nathan's 08-27 DRUM density bake (was 7)
// 08-28 (Nathan): DRUM density follows the SETTLED viewport width — his call:
// the 08-27 bake (8) at laptop widths ramping to 12 on a wide window. Linear
// between the anchors, rounded (the rounding is the rebuild quantum — the
// settle pass rebuilds only when this value or the aspect actually moves).
// An explicit ?max pins density at any width; mobile keeps its own bake.
export const maxTilesFor = (width) => {
  if (IS_MOBILE || PARAMS?.has('max')) return MAX_TILES;
  const t = Math.min(1, Math.max(0, (width - 1280) / (1920 - 1280)));
  return Math.round(8 + 4 * t);
};
export const MIN_TILES = num('min', 5); // cycle showcase to fill sparse Worlds
/* — Tile thumbnail size — linear in the World's tile count: FEWER tiles get a
   BIGGER thumbnail (a sparse World shows each tile larger, and fewer total
   requests leave more byte-budget per tile), shrinking as the field fills.
   Endpoints tie to the MIN_TILES / MAX_TILES range; both live-tunable. */
export const THUMB_MAX = Math.round(num('thumbmax', 896)); // biggest thumb — at MIN_TILES (sparsest World)
export const THUMB_MIN = Math.round(num('thumbmin', 704)); // smallest thumb — at MAX_TILES (densest World)
export function thumbForCount(count) {
  const span = MAX_TILES - MIN_TILES;
  if (span <= 0) return THUMB_MAX;
  const t = Math.min(1, Math.max(0, (count - MIN_TILES) / span)); // 0 at MIN_TILES → 1 at MAX_TILES
  return Math.round(THUMB_MAX + t * (THUMB_MIN - THUMB_MAX));
}

/* — Depth tiers — Z position (camera sits at 0 looking down -Z), Near → Far.
   Perspective shrinks farther tiles; tier also gates live-video eligibility (P3). */
export const DEPTH_TIERS = [-3.6, -3.8, -4.0];
export const Z_JITTER = num('zjitter', 0.6); // per-tile depth spread within a tier (prevents z-fighting)

/* — Tiles — */
export const TILE_HEIGHT = num('tile', .7); // longest side (max tile dimension), world units — aspect preserved
export const SCATTER_FRAC = num('scatter', 1.0); // spread vs. the visible half-extent at a tile's depth
export const CENTER_CLEAR_FRAC = num('clear', 0.59); // inner clear radius (normalized) — reserves the center for the card
export const CLUSTER_RADIUS = num('cluster', 0.55); // outer bound (normalized) — tiles stay within this radius of center, clustering around the card
export const OVERLAP_JITTER = num('jitter', 0.04); // seeded XY offset over the even (phyllotaxis) layout — higher = more organic clumping/overlap
/* — Field safe-region — hold the tile field clear of the fixed nav bar (top)
   and the viewport edges so nothing clips. Fractions of the visible half-extent
   at each tile's depth; all live-tunable to frame against the real projects. */
export const FIELD_OFFSET_Y = num('fieldy', -0.012); // shift the whole field DOWN to clear the nav (− = down) — Nathan's bake
export const FIELD_SPREAD_X = num('spreadx', 0.88);  // horizontal spread ×; < 1 pulls tiles off the left/right edges — Nathan's bake
export const FIELD_SPREAD_Y = num('spready', 0.79);  // vertical spread ×; < 1 flattens the ring so top/bottom clear — Nathan's bake
export const TILE_FALLBACK_COLOR = 0xe6e6ea;

/* — Tile appear (load-gated push-out) — a Tile stays hidden until its texture
   has loaded, then fades in near the center and pushes out to its resting
   sunflower position, riding an instance of the same World-Turn F-curve. */
export const TILE_SPAWN_FRAC = num('spawn', 0.12); // start position as a fraction of the resting radius (0 = dead center)
export const TILE_SPAWN_SCALE = num('spawnscale', 0.72); // start scale (grows to 1 as it pushes out)
export const TILE_APPEAR_DURATION = num('appearms', 1100) / 1000; // seconds of the appear/push-out
export const TILE_APPEAR_FADE = num('appearfade', 0.35); // fraction of progress over which opacity ramps to full (rest is the settle)
export const FANOUT_STAGGER = num('fanout', 0.55); // max extra delay at the outermost tile, seconds — first-view appears launch inner→outer (~50% of TILE_APPEAR_DURATION) so the field blooms outward instead of popping at random load order

/* — Lens distortion (post-process) — applied to the whole composited scene so
   Tiles + Shell warp cohesively. NEGATIVE = pincushion / inward "inside-a-sphere". */
export const LENS_DISTORTION = num('lens', -0.15); // uniform default for both axes
export const LENS_DISTORTION_X = num('lensx', LENS_DISTORTION); // horizontal warp
export const LENS_DISTORTION_Y = num('lensy', LENS_DISTORTION * 1.1); // vertical warp

/* — World Turn (P3) — the World-to-World transition. The outgoing World rolls
   on the X axis (forward: up/out the top), the incoming rolls in from the
   opposite edge, both crossfading while the lens distortion spikes. Two Worlds
   are briefly co-present (one per render slot). */
export const TURN_DURATION = num('turnms', 1700) / 1000; // seconds for the full roll
export const TURN_EXIT_ANGLE = num('exit', 0.88); // radians the outgoing World rolls past center
export const TURN_ENTER_ANGLE = num('enter', 0.88); // radians the incoming World starts off-center
export const TURN_LENS_SPIKE = num('spike', 0.08); // extra (negative) distortion added at the turn's midpoint
export const TURN_RECEDE = num('recede', 0.5); // optional Z push-back of both Worlds during the cross (world units)

/* Turn easing — a GSAP CustomEase SVG path that drives the roll/translation.
   The curve shapes the whole gesture (launch → settle); because it's flat
   (zero velocity) at both ends, the recede + lens spike keyed off it settle
   smoothly too — no separate window needed. Edit the path here, or override
   live with ?ease=<path>. Author/visualize at https://gsap.com/docs/v3/Eases/CustomEase */
export const TURN_EASE_PATH =
  PARAMS?.get('ease') ||
  'M0,0 C0,0 -0.011,-0.003 0.018,0 0.129,0.011 0.128,0.098 0.216,0.494 0.324,0.982 0.304,1 0.987,1 1.015,1 1,1 1,1';

/* — Enter-the-World ramp (detail-page transition) — MOVED to enterTune.js
   (08-25 rework): the ramp's knobs are now the live ENTER_TUNABLES store the
   ?entertune=1 bench writes. The old ENTER_LENS_SWELL (+0.32) was a sign bug:
   added to the negative base it flipped the warp into an outward barrel bow +
   shrink; the store's `lens` deepens the pull (negative) instead, alongside a
   projection zoom that scales the grid UP in sync. */

/* — Live-video Near tier (P3 remainder) — only Near (tier 0) Tiles with a
   playbackId promote to live HLS, crossfading up over their stills; everything
   else stays a thumbnail. The pool size is the hard decode budget. Live video
   suspends back to stills during a World Turn — the Turn is the incoming
   World's preload window. Reduced motion = stills only (no pool mounted). */
export const WORLD_MAX_LIVE = Math.max(0, Math.round(num('live', IS_MOBILE ? 2 : 4)));
// Video tiles to LOAD. Above ?live, extra Near videos rotate through the pool
// slots (poster between turns). 08-28 bake (Nathan): desktop 6 (was = live
// budget 4) — all-video showcases (bedouin) fill in past the decode cap via
// rotation instead of running the drum half-empty. Mobile keeps the play
// budget (every loaded video tile actually plays).
export const WORLD_MAX_VIDEO_TILES = Math.max(
  0,
  Math.round(num('vtiles', IS_MOBILE ? WORLD_MAX_LIVE : 6))
);
export const LIVE_DWELL_SECONDS = num('livedwell', 9); // min time live before rotating to a waiting Near tile
export const LIVE_CROSSFADE_SECONDS = num('livefade', 0.6); // still ↔ video crossfade (globe convention)
export const LIVE_SUSPEND_SECONDS = 0.3; // fast fade back to stills when a Turn starts
// Near Tiles are large on screen (unlike globe panels), so pin a single hi-res
// rendition: min+max together collapse the Mux manifest to one choice — no ABR
// decision, no quality jump, and the 4s loop replays from buffer so delivery
// cost stays a few MB per promotion. ?liveres=1080p etc. to experiment.
const LIVE_RES = PARAMS?.get('liveres') || (IS_MOBILE ? '540p' : '720p');
export const WORLD_STREAM_PARAMS = `min_resolution=${LIVE_RES}&max_resolution=${LIVE_RES}`;

/* — Composite bands (World-side deck/album mounts, ADR-0003) —
   Display-only bodies: the shared bandLayout brain poses textured planes
   inside the framebuffer (pre-distortion, so the lens warps them with the
   scene) and the stack idle-cycles on the Turn curve. The interactive
   pager lives on the detail page. ?bands=0 kills them; ?bandh ?bandcycle
   ?bandpages tune live. */
export const BANDS_ENABLED = num('bands', 1) !== 0;
export const BAND_TIER = 1; // Mid tier — behind the live Near tier, ahead of Far
export const BAND_HEIGHT = num('bandh', TILE_HEIGHT * 1.7); // body reads bigger than a tile (world units, longest side)
export const BAND_CYCLE_S = num('bandcycle', 3.2); // rest dwell between auto-advances
export const BAND_MAX_PAGES = Math.max(2, Math.round(num('bandpages', 5))); // planes per band (memory cap) — keep matched with BAND_PAGE_CAP in work/index.astro
export const BAND_TEX_WIDTH = 800; // band texture request (px)

/* — Composite band placement (FP2) — the featured-page deck is FORCED into the
   TOP-RIGHT quadrant of the World rather than the seed's phyllotaxis slot, so
   it lands consistently clear of the header/nav regardless of project slug.
   Values are fractions of the visible half-extent at the band's depth:
   +x = right, +y = up (scene convention; camera at origin looking down −Z).
   ?bandx / ?bandy to nudge live. */
export const BAND_POS_X = num('bandx', 0.34); // + = toward the right edge
export const BAND_POS_Y = num('bandy', 0.36); // + = toward the top edge

/* — Composite band live tunables (FP1 debug panel, ?deckdebug) — one mutable
   store the running band reads every frame (worldBands paint/cycle) and the
   panel writes, so the deck's rate/spacing/pose scale live with no rebuild.
   Defaults (including any ?param seeds) reproduce the shipped pose exactly, so
   with the panel absent nothing changes. */
export const BAND_TUNABLES = {
  cycleS: BAND_CYCLE_S, // rate the deck auto-advances pages (rest dwell, s)
  spacingMul: num('deckspace', 1), // DECK_SPACING scale (card-to-card in-plane density)
  homeX: num('deckhome', HOME_X), // front-page x-anchor (fraction of page width)
  fanMul: num('deckfan', 1), // waiting-fan extent (how far the upcoming/back pages sit)
  pileMul: num('deckpile', 1), // shown-pile extent (how far the shown pages sit)
  viewHold: num('deckhold', VIEW_HOLD), // viewing-slot plateau width (fraction of a page step)
  albumScale: num('deckalbum', 1), // album-art size multiplier (on the sub-16:9 area shrink)
  posX: BAND_POS_X, // deck placement, +x toward right (fraction of half-width)
  posY: BAND_POS_Y, // deck placement, +y toward top (fraction of half-height)
};

/* — Pointer parallax — */
export const PARALLAX = num('parallax', -0.02); // camera tilt amplitude (radians)
export const PARALLAX_LERP = 0.075;
export const TILE_DRIFT = num('drift', 0.05); // per-tile micro-translation amplitude (world units) — subtle, per-tile axis/direction

/* — World Shell — faint inverse sphere, denser lat/long than the home globe (12×5) — */
export const SHELL_RADIUS = 16;
export const SHELL_MERIDIANS = 250; // longitude lines
export const SHELL_PARALLELS = 230; // latitude lines
export const SHELL_LINE_COLOR = 0x020098;
export const SHELL_OPACITY = num('shellalpha', 0.55); // ?shellalpha — grid line opacity; 0.55 = 08-25 "more subtle" default (was 1.0)
// Grid modes stop the spin: cell-locked media may not crawl off — the field
// moves only as one body (each mode's own parallax/Turn). ?spin still overrides.
export const SHELL_SPIN = num('spin', FPGRID_ACTIVE ? 0 : 0.012); // rad/sec — slow Y-spin so the grid drifts left→right (negate ?spin to flip)

/* — Environment — the canvas renders transparent; the vertical gradient backdrop
   (black top → electric blue bottom, matching the home hero) lives on the DOM
   (.fp-canvas in featured-projects.css) so the lens pass can't warp it. No
   solid bg-color const lives here — the canvas is transparent by design.
   08-25 (Nathan): the bottom fade is dialable — WorldScene stamps these onto
   .fp-canvas as --fp-fade / --fp-fade-h; the CSS mixes the accent toward
   black by the fade %, keeping the S2 @property accent cross-fade intact. */
export const FP_FADE = num('fpfade', 65); // ?fpfade — bottom-fade intensity, % of the accent mixed over black (100 = the old solid stop)
export const FP_FADE_H = num('fpfadeh', 40); // ?fpfadeh — gradient height, % of viewport the fade climbs before pure black
