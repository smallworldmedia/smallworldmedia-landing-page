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
export const DEPTH_TIERS = [-2.5, -3.4, -4.0];
export const Z_JITTER = num('zjitter', 0.6); // per-tile depth spread within a tier (prevents z-fighting)

/* — Tiles — */
export const TILE_HEIGHT = num('tile', .8); // longest side (max tile dimension), world units — aspect preserved
export const SCATTER_FRAC = num('scatter', 1.0); // spread vs. the visible half-extent at a tile's depth
export const CENTER_CLEAR_FRAC = num('clear', 0.55); // inner clear radius (normalized) — reserves the center for the card
export const CLUSTER_RADIUS = num('cluster', 0.55); // outer bound (normalized) — tiles stay within this radius of center, clustering around the card
export const OVERLAP_JITTER = num('jitter', 0.12); // seeded XY offset over the even (phyllotaxis) layout — higher = more organic clumping/overlap
export const CURVE_STRENGTH = 0.42; // (superseded by LENS_DISTORTION post-process — no longer applied per-tile)
export const TILE_FALLBACK_COLOR = 0xe6e6ea;

/* — Lens distortion (post-process) — applied to the whole composited scene so
   Tiles + Shell warp cohesively. NEGATIVE = pincushion / inward "inside-a-sphere". */
export const LENS_DISTORTION = num('lens', -0.15); // uniform default for both axes
export const LENS_DISTORTION_X = num('lensx', LENS_DISTORTION); // horizontal warp
export const LENS_DISTORTION_Y = num('lensy', LENS_DISTORTION * 1.1); // vertical warp

/* — Pointer parallax — */
export const PARALLAX = num('parallax', -0.03); // camera tilt amplitude (radians)
export const PARALLAX_LERP = 0.05;
export const TILE_DRIFT = num('drift', 0.12); // per-tile micro-translation amplitude (world units) — subtle, per-tile axis/direction

/* — World Shell — faint inverse sphere, denser lat/long than the home globe (12×5) — */
export const SHELL_RADIUS = 16;
export const SHELL_MERIDIANS = 250; // longitude lines
export const SHELL_PARALLELS = 230; // latitude lines
export const SHELL_LINE_COLOR = 0x020098;
export const SHELL_OPACITY = 1.0;

/* — Environment — */
export const BG_COLOR = 0x0000ff;
