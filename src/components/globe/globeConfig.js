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

/* — Meridian scroll (brand globe choreography, note 6) —
   The globe holds its brand tilt; rows of TILES travel pole-to-pole (born at the
   top pole, growing outward down the meridians, consumed at the bottom pole),
   each tile carrying one persistent asset the whole way. The blue latitude lines
   are the gaps between rows, so they travel in sync for free. Implemented as a
   per-row polar-angle scroll in the vertex shader (panelMaterial uUsePolarScroll)
   driven by MeridianScroll.

   SCROLL_VISIBLE_ROWS sets the density (rows of tiles spanning pole-to-pole at
   once); the grid builds visible+2 buffer rows (one emerging above the top pole,
   one consuming below the bottom) so there is always a row at each pole and the
   recycle happens unseen. pitch = π / visibleRows. Pace: the polar scroll rate
   (rad/s) = pitch · cascadeSpeed / SCROLL_PACE_SCALE — so heroConfig's
   cascadeSpeed is the flow speed AND the video/thumbnail-load knob. At scale 30,
   visibleRows 6 (pitch 30°), cascadeSpeed 6 → ~0.105 rad/s → ~30s pole-to-pole. */
export const SCROLL_VISIBLE_ROWS = 6;    // tile rows spanning the sphere at once (density)
export const SCROLL_LAT_GAP_DEG = GAP_DEG; // travelling latitude-line thickness (matches meridian lines)
export const SCROLL_PACE_SCALE = 30;     // scroll rate rad/s = pitch · cascadeSpeed / SCALE
// Pole treatment (references the brand globe icon): rather than tiles converging
// to a sharp singular point, as a tile nears a pole its pole-facing bottom LIFTS
// into a rounded cap that terminates SHORT of the pole, leaving a clean blue pole
// region. Driven by sin(θ_center) (the same pole-proximity as the media crop):
// the cap ramps in once sin(θ) < START. In the panel shader the pole tile is a
// wide rounded box INTERSECTED with a lifted elliptical bottom cap (panelMaterial
// height-eat), so three DECOUPLED radii shape it:
//   TIP  — the bottom cap's HORIZONTAL radius (round-vs-pointed nose; ≤ 0.5)
//   WIDE — the away-end + straight-wall radius (keep ≈ base so the top stays square)
//   LIFT — how far the cap's nose lifts UP off the pole (eats height; terminate-short)
// Only affects the scroll globe (uUsePolarScroll=1).
export const SCROLL_POLE_CORNER_TIP = 0.5;   // bottom-cap HORIZONTAL radius at the pole (round nose; ≤ 0.5)
export const SCROLL_POLE_CORNER_WIDE = 0.3;  // away-end + wall radius at the pole (Nathan's bake)
export const SCROLL_POLE_CORNER_START = 0.4; // sin(θ) below which the pole cap ramps in (Nathan's bake)
// LIFT = the bottom fraction of a tile that dissolves to inner-sphere blue AT the
// pole, so the cap terminates that far SHORT of the singularity. 0 = the cap
// reaches the pole (today's un-lifted bottom). Keep ≤ 0.25 so the cap equator
// (0.5 + 2·lift at the pole) stays on-tile; 0.15–0.25 reads as a clean blue cap
// without eating the whole panel. Requires TIP ≤ 0.5. This is the BAKED default;
// the ?herotune bench (heroConfig) dials it live via ?polelift= and copy_url.
// 0.7 = Nathan's bake (aggressive eat; the pole cap masks the residual point).
export const SCROLL_POLE_TIP_LIFT = 0.7;

/* Pole cap — a small persistent spherical cap in the inner-sphere blue, sitting
   just OUTSIDE the panel surface at each pole, to occlude the residual sliver
   convergence the height-eat leaves behind (a clean blue dome over the exact
   pole point). Angular radius in degrees (0 = off). Home scroll globe only; the
   ?herotune bench dials it live via ?polecap= and copy_url. */
export const SCROLL_POLE_CAP_DEG = 6;

/* Base rounded-tile radius for the HOME globe's panels (UV units) — the SWM
   lockup's panels carry a corner radius; /process + /lab pass 0 (hard edges).
   Home-only; the ?herotune bench dials it live (?corner=). Must stay < 0.5.
   0.07 = Nathan's bake. */
export const PANEL_CORNER_RADIUS = 0.07;

/* — Interaction — */
export const AUTO_ROTATE_SPEED = 0.12;   // rad/s ambient drift
export const PITCH_LIMIT_DEG = 40;
export const DRAG_SENSITIVITY = 0.001;   // rad per px of pointer travel
export const MAX_FLICK_SPEED = 1;        // rad/s cap on release velocity
export const INERTIA_SECONDS = .35;      // decay back to ambient drift

/* — Colors (match global.css custom properties) — */
export const GAP_COLOR = 0x0000ff;            // electric blue — the lat/long lines + occluding inner sphere
export const PANEL_FALLBACK_COLOR = 0x121212; // --color-dark-gray — pre-texture state
