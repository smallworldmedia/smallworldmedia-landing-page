/**
 * globeConfig.js — Every tunable constant for the CMS Video Globe.
 *
 * Geometry density is logo-derived: the SWM globe mark reads as ~6 longitude
 * and 4 latitude bands per visible hemisphere, so the full sphere is 12 × 4.
 * Gaps between panels expose the inner sphere — the lat/long "lines" of the
 * mark rendered as negative space.
 */

/** Mobile detection at module load — breakpoint frozen for the session */
export const IS_MOBILE =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

/** URL knob — numeric query-param override for feel passes (?promote=0.05) */
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const raw = new URLSearchParams(window.location.search).get(key);
  const num = raw === null ? NaN : Number(raw);
  return Number.isFinite(num) ? num : fallback;
};

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
// Desktop: contain-fit — whole globe visible at FILL_FRACTION of the
// limiting axis. Mobile: cover-overscan — the globe overflows the viewport
// (top/bottom/sides crop, background peeks only in the corners) so fewer,
// much larger panels are on screen. Offscreen panels are frustum-culled
// by three.js automatically.
export const FIT_COVER = IS_MOBILE;
export const FILL_FRACTION = IS_MOBILE ? 1.22 : .85;
export const INITIAL_PITCH_DEG = 40; // top pole tips toward viewer, matching the brand mark

/* — Render budget — */
export const FPS_CAP = 60;           // render-loop cap (gated locally, never via gsap.ticker.fps)
export const DPR_MAX = IS_MOBILE ? 1.5 : 2;

/* — Textures — */
export const THUMB_WIDTH = IS_MOBILE ? 384 : 512; // Mux thumbnail request size (square, smartcrop)

/* — Stream quality —
   Mobile overscan shows few, large panels → pin a single 540p rendition
   (min+max together collapse the manifest to one choice, which also
   overrides iOS native-HLS ABR that would otherwise pick low for a
   hidden video element). Desktop runs 6 small panels → cheapest 270p. */
export const STREAM_PARAMS = IS_MOBILE
  ? 'min_resolution=540p&max_resolution=540p'
  : 'max_resolution=270p';

/* — Live video tier (Stage 2) —
   Camera sits at ~3.9R (desktop), so the visible horizon is at score ≈ 0.26;
   panel half-height ≈ 13° puts a panel's leading edge on the rim at score
   ≈ 0.03. Promote there so video is already playing as the panel rotates in.
   Pole-adjacent panels never drop below any low demote threshold (yaw-only
   ambient spin keeps their score high), so slot fairness comes from
   MAX_LIVE_DWELL rotation + a re-live cooldown, not from demote alone.
   Knobs: ?promote ?demote ?dwellmax ?cooldown */
export const MAX_LIVE = IS_MOBILE ? 4 : 7;     // concurrent video decode budget
export const GLOBE_PREVIEW_SECONDS = 4;        // abbreviated loop, MediaCard convention
export const CROSSFADE_SECONDS = 0.6;          // thumbnail ↔ video uMix tween
export const PROMOTE_SCORE = PARAM('promote', 0.03);  // leading edge crests the rim
export const DEMOTE_SCORE = PARAM('demote', 0.06);    // hysteresis — below this, fade back to still
export const SWAP_SCORE = -0.25;               // hidden-hemisphere texture cycling threshold
export const MIN_LIVE_DWELL_SECONDS = 4;       // no promote/demote thrash during drag
export const MAX_LIVE_DWELL_SECONDS = PARAM('dwellmax', 12); // rotate slots off prominent panels
export const RELIVE_COOLDOWN_SECONDS = PARAM('cooldown', 6); // keep rotated-off panels from re-winning at once

/* — Interaction — */
export const AUTO_ROTATE_SPEED = 0.12;   // rad/s ambient drift
export const PITCH_LIMIT_DEG = 40;
export const DRAG_SENSITIVITY = 0.001;   // rad per px of pointer travel
export const MAX_FLICK_SPEED = 1;        // rad/s cap on release velocity
export const INERTIA_SECONDS = .35;      // decay back to ambient drift

/* — Colors (match global.css custom properties) — */
export const GAP_COLOR = 0x0000ff;            // black — the lat/long lines + occluding inner sphere
export const PANEL_FALLBACK_COLOR = 0x121212; // --color-dark-gray — pre-texture state
