/**
 * globeConfig.js — Every tunable constant for the CMS Video Globe.
 *
 * Geometry density is logo-derived: the SWM globe mark reads as ~6 longitude
 * and 4 latitude bands per visible hemisphere, so the full sphere is 12 × 4.
 * Gaps between panels expose the inner sphere — the lat/long "lines" of the
 * mark rendered as negative space.
 */

/** Mobile detection at module load — same convention as UnicornBg INITIAL_DPI */
export const IS_MOBILE =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

/** Reduced motion: no auto-rotate/inertia, instant power-on, stills only */
export const PREFERS_REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* — Geometry — */
export const LON_SEGMENTS = 12;
export const LAT_BANDS = 5;
export const GAP_DEG = 1.1;          // angular gap between panels (the "lines") — Nathan-approved
export const CAP_DEG = 24;           // pole wedge ring span — Nathan-approved
export const RADIUS = 1;
export const INNER_SPHERE_SCALE = 0.99; // gap-color sphere; also occludes rear hemisphere

/* — Camera — */
export const CAMERA_FOV = 35;        // degrees, vertical
export const FILL_FRACTION = 0.8;    // globe diameter as fraction of the limiting viewport axis
export const INITIAL_PITCH_DEG = 40; // top pole tips toward viewer, matching the brand mark

/* — Render budget — */
export const FPS_CAP = 60;           // matches the UnicornBg scene budget
export const DPR_MAX = IS_MOBILE ? 1 : 2;

/* — Textures — */
export const THUMB_WIDTH = IS_MOBILE ? 320 : 512; // Mux thumbnail request size (square, smartcrop)

/* — Live video tier (Stage 2) — */
export const MAX_LIVE = IS_MOBILE ? 2 : 6;     // concurrent video decode budget
export const GLOBE_PREVIEW_SECONDS = 3;        // abbreviated loop, MediaCard convention
export const CROSSFADE_SECONDS = 0.6;          // thumbnail ↔ video uMix tween
export const PROMOTE_SCORE = 0.6;              // facing-camera threshold to go live
export const DEMOTE_SCORE = 0.4;               // hysteresis — below this, fade back to still
export const SWAP_SCORE = -0.25;               // hidden-hemisphere texture cycling threshold
export const MIN_LIVE_DWELL_SECONDS = 4;       // no promote/demote thrash during drag

/* — Interaction — */
export const AUTO_ROTATE_SPEED = 0.12;   // rad/s ambient drift
export const PITCH_LIMIT_DEG = 40;
export const DRAG_SENSITIVITY = 0.005;   // rad per px of pointer travel
export const MAX_FLICK_SPEED = 3;        // rad/s cap on release velocity
export const INERTIA_SECONDS = 1.8;      // decay back to ambient drift

/* — Colors (match global.css custom properties) — */
export const GAP_COLOR = 0x000000;            // black — the lat/long lines + occluding inner sphere
export const PANEL_FALLBACK_COLOR = 0x121212; // --color-dark-gray — pre-texture state
