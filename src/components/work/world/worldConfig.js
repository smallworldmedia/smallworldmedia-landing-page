/**
 * worldConfig.js — tunables for the Featured Projects WorldScene.
 *
 * First-pass values, dialed in by live testing. The knobs below can be
 * overridden live via URL query params (no rebuild) for tuning, e.g.:
 *   /work?lens=-0.5&tile=1.2&scatter=0.8&zjitter=0.8&sep=0.5&fov=40
 */
import { HOME_X } from '../bandLayout.js';

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

/* — Camera / render budget — */
export const CAMERA_FOV = num('fov', 42); // vertical degrees
export const DPR_MAX = num('dpr', 1.5); // 1.5 caps render-target memory (scales with DPR²; was desktop 2). ?dpr to A/B
export const FPS_CAP = 60;
export const MAX_TILES = num('max', IS_MOBILE ? 9 : 7);
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

/* — Live-video Near tier (P3 remainder) — only Near (tier 0) Tiles with a
   playbackId promote to live HLS, crossfading up over their stills; everything
   else stays a thumbnail. The pool size is the hard decode budget. Live video
   suspends back to stills during a World Turn — the Turn is the incoming
   World's preload window. Reduced motion = stills only (no pool mounted). */
export const WORLD_MAX_LIVE = Math.max(0, Math.round(num('live', IS_MOBILE ? 2 : 4)));
// Video tiles to LOAD — defaults to the play budget so every video tile actually
// plays (no posters frozen on a non-live tile). Raise ?vtiles above ?live to
// reintroduce rotation (extra Near videos cycle the slots, showing a poster between turns).
export const WORLD_MAX_VIDEO_TILES = Math.max(0, Math.round(num('vtiles', WORLD_MAX_LIVE)));
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
export const SHELL_OPACITY = 1.0;
export const SHELL_SPIN = num('spin', 0.012); // rad/sec — slow Y-spin so the grid drifts left→right (negate ?spin to flip)

/* — Environment — the canvas renders transparent; the vertical gradient backdrop
   (black top → electric blue bottom, matching the home hero) lives on the DOM
   (.fp-canvas in featured-projects.css) so the lens pass can't warp it. No
   solid bg-color const lives here — the canvas is transparent by design. */
