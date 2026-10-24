import { DRAG_CHOREO } from '../../lib/dragMomentum.js';
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
   Both tiers pin a SINGLE rendition (min+max collapse the Mux manifest to one
   choice), which also overrides native-HLS ABR that would otherwise pick low
   for a hidden/small video element. Phone and desktop both pin 480p here (the
   home globe's desktop pin is 720p since 10-23: GLOBE_STREAM_PARAMS). Mux's
   ladder here (270p/480p/720p/1080p) has no 540p rung, so the phone's old
   540p pin was always served 480p; 480p names what plays (Nathan, 10-09:
   the lowest rung that stays sharp). min==max, so the preferMinQuality
   level-0 lock lands ON 480p, not a lower rung. */
export const STREAM_PARAMS = 'min_resolution=480p&max_resolution=480p';

/* — Live video tier (Stage 2) —
   Camera sits at ~3.9R (desktop), so the visible horizon is at score ≈ 0.26;
   panel half-height ≈ 13° puts a panel's leading edge on the rim at score
   ≈ 0.03. Promote there so video is already playing as the panel rotates in.
   Pole-adjacent panels never drop below any low demote threshold (yaw-only
   ambient spin keeps their score high), so slot fairness comes from
   MAX_LIVE_DWELL rotation + a re-live cooldown, not from demote alone.
   Knobs: ?promote ?demote ?dwellmax ?cooldown */
export const MAX_LIVE = IS_MOBILE ? 4 : 7;     // concurrent video decode budget
export { PREVIEW_SECONDS as GLOBE_PREVIEW_SECONDS } from '../work/imageConfig.js'; // the shared preview window: VideoSlotPool's clip + loop
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
export const DRAG_SENSITIVITY = DRAG_CHOREO.sensitivity;   // rad per px of pointer travel // ← src/lib/dragMomentum.js (09-08: ONE choreography)
export const MAX_FLICK_SPEED = DRAG_CHOREO.maxSpeed;        // rad/s cap on release velocity // ← src/lib/dragMomentum.js (09-08: ONE choreography)
export const INERTIA_SECONDS = DRAG_CHOREO.inertiaSeconds;      // decay back to ambient drift // ← src/lib/dragMomentum.js (09-08: ONE choreography)

/* — Colors (match global.css custom properties) — */
export const GAP_COLOR = 0x0000ff;            // electric blue — the lat/long lines + occluding inner sphere
export const PANEL_FALLBACK_COLOR = 0x121212; // --color-dark-gray — pre-texture state

/* — VideoGlobe-only device knobs (10-09, the media spans round): the home
   globe and /lab, which share useGlobeScene, nameTicker, TextureManager and VideoSlotPool's
   default pin. Load-time and checked: PARAM doesn't clamp, and
   setPixelRatio(0) would blank the canvas. /work has its own ?dpr and
   ?liveres (work/world/worldConfig.js). A bake of the globe's ratio belongs
   in GLOBE_DPR_MAX's default, never DPR_MAX: /process shares DPR_MAX.

   BAKED 10-09 (Nathan's Q10): phones render the globe at full resolution,
   3 — "yes to phone globe at full res , it looks so much better and does not
   stutter". Desktop stays DPR_MAX (2). /process keeps DPR_MAX, unchanged at
   1.5 on phones and 2 on desktop. ?globedpr=1.5 is the old phone look.
   ?globeres kept its 480p pin (STREAM_PARAMS) on the phone: "i think we can
   stay at 480p i see no discernable difference".
   BAKED 10-23 (Nathan's Q22, the media spans round): the desktop globe pins
   720p, from his dial (?globeres=720p). Phones keep 480p. — */
const clampTo = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
/** ?globedpr — the VideoGlobe's renderer pixel-ratio cap (useGlobeScene). */
export const GLOBE_DPR_MAX = clampTo(PARAM('globedpr', IS_MOBILE ? 3 : DPR_MAX), 1, 3);
/** The name strips' height in px (nameTicker's STRIP_H): 256 at the old
 *  default, scaled by the ratio the canvas ACTUALLY renders at over the one
 *  DPR_MAX would give it — never by the caps' ratio, which over-draws
 *  wherever the screen is under the cap (a DSF-2 phone renders 2/1.5, not
 *  3/1.5; a 2× desktop at ?globedpr=3 still renders 2/2). The server has no
 *  screen, so it reads the default cap and draws 256. */
const DEVICE_DPR = typeof window === 'undefined' ? DPR_MAX : window.devicePixelRatio || 1;
export const NAME_STRIP_H = Math.round(
  (256 * Math.min(DEVICE_DPR, GLOBE_DPR_MAX)) / Math.min(DEVICE_DPR, DPR_MAX)
);
const GLOBE_RES = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('globeres');
/** ?globeres — the VideoGlobe's stream pin on any device: one Mux rung
 *  (270p | 480p | 720p | 1080p), else the device's: 720p on desktop (Nathan
 *  10-23, Q22), STREAM_PARAMS (480p) on phones. The World's ?liveres,
 *  but checked: Mux's ladder has no 540 rung. VideoSlotPool's default, so
 *  anything that sizes the globe's streams reads this, not STREAM_PARAMS. */
export const GLOBE_STREAM_PARAMS = /^(270|480|720|1080)p$/.test(GLOBE_RES ?? '')
  ? `min_resolution=${GLOBE_RES}&max_resolution=${GLOBE_RES}`
  : IS_MOBILE
    ? STREAM_PARAMS
    : 'min_resolution=720p&max_resolution=720p';
/** ?globethumb — T1: the legacy square texture side, and the base every class texture size derives from (unitSpan.texSpec). */
export const GLOBE_T1 = Math.round(clampTo(PARAM('globethumb', THUMB_WIDTH), 256, 1024));
/** The VideoGlobe renderer's pixel ratio (useGlobeScene): the screen's own, capped by GLOBE_DPR_MAX. */
export const globePixelRatio = (dpr) => Math.min(dpr, GLOBE_DPR_MAX);
