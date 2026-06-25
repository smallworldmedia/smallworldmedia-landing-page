/**
 * worldConfig.js — tunables for the Featured Projects WorldScene.
 *
 * First-pass values, dialed in by live testing. The knobs below can be
 * overridden live via URL query params (no rebuild) for tuning, e.g.:
 *   /work?lens=-0.5&tile=1.2&scatter=0.8&zjitter=0.8&sep=0.5&fov=40
 */
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
export const DPR_MAX = IS_MOBILE ? 1.5 : 2;
export const FPS_CAP = 60;
export const MAX_TILES = num('max', IS_MOBILE ? 9 : 16);
export const MIN_TILES = num('min', IS_MOBILE ? 5 : 8); // cycle showcase to fill sparse Worlds
export const THUMB_SIZE = 1024; // tile texture request (px) — crisper near tiles

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
export const CURVE_STRENGTH = 0.42; // (superseded by LENS_DISTORTION post-process — no longer applied per-tile)
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
   (.fp-canvas in featured-projects.css) so the lens pass can't warp it. */
export const BG_COLOR = 0x0000ff; // legacy solid fallback (unused by the transparent canvas)
