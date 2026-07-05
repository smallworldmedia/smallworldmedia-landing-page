/**
 * bandLayout.js — the band-stack geometry brain (ADR-0003: math-first).
 *
 * One pure pose function shared by every band surface: BandPager paints it
 * as CSS 3D transforms on the detail page (px units); worldBands paints it
 * as textured planes inside the World's framebuffer (world units, so the
 * lens-distortion pass warps the stack with the scene). Visual parity
 * between the two surfaces lives here, never in a shared renderer.
 *
 * The dealer's pass (Nathan, 2026-07-05): pages travel hand-to-hand like a
 * card dealer's array. The SOURCE fan sits right of the front page and
 * slightly LOW, its next-up cards spread widest (spacing decays geometrically
 * deeper into the stack — a visible array, not a pile). Passed pages are
 * dealt UP and LEFT on a slight arc, landing in a visible DESTINATION stack
 * toward the upper center — newest on top, older cards converging beneath
 * with a gentle darkening, never darkened out. Depth = darkening, never
 * transparency; dealt cards lift toward the viewer (z = draw order on both
 * surfaces).
 *
 * Distances (fan/exit) are expressed in caller units — the DOM passes the
 * px-tuned defaults below; the World scales them by its page width against
 * REF_PAGE_W so the stack keeps the same proportions at any size.
 * y is screen-positive DOWN (DOM convention); the World flips the sign.
 */

/* Stack geometry — px-tuned on the detail page (the reference surface) */
export const BAND_ANGLE = -8; // isometric rotateY, degrees
export const FAN_X = 48; // horizontal spacing to the FIRST next-up page
export const FAN_Y = 14; // downward step per upcoming page (source sits low)
export const FAN_FALLOFF = 0.72; // per-step spacing ratio (deeper = tighter)
export const FAN_Z = 46; // recession per upcoming page (perspective scales)
export const FAN_DEPTH = 3.5; // pages visible in the resting fan
export const EXIT_X = 0.5; // × pageW leftward travel to the landed stack
export const EXIT_Y = -28; // px upward travel to the landed stack
export const EXIT_Z = 40; // dealt pages lift toward the viewer
export const ARC_LIFT = -14; // px extra lift at mid-deal (the dealt arc)
export const PARK_DX = -6; // px pile spread per landed card (leftward)
export const PARK_DY = -4; // px pile creep per landed card (upward)
export const PARK_DZ = 6; // px each older card sinks beneath the pile top
export const PARK_FALLOFF = 0.8; // pile offsets converge (bounded footprint)
export const DARK_IN = 0.2; // brightness drop per upcoming page (fan)
export const DARK_FLOOR = 0.35; // fan brightness floor
export const PARK_DARK = 0.12; // brightness drop per card into the pile
export const PARK_FLOOR = 0.5; // pile brightness floor (stays visible)

/** The page width the px distances were tuned against (detail-page stage). */
export const REF_PAGE_W = 520;

/** Converging cumulative offset: step, step·r, step·r² … (bounded array). */
const cum = (step, r, n) => (step * (1 - Math.pow(r, n))) / (1 - r);

/**
 * Pose of page `i` when the stack sits at `phase` (fractional page index).
 *
 * @param {number} i - page index
 * @param {number} phase - current stack phase (0 = first page front)
 * @param {number} pageW - page width in caller units (drives exit travel)
 * @param {Object} [dist] - distances in caller units (defaults = the
 *   px-tuned reference values). {fan, fanY, fanZ, exitX, exitY, exitZ,
 *   arc, parkX, parkY, parkZ}
 * @returns {{hidden: boolean, x: number, y: number, z: number, brightness: number}}
 */
export function bandPose(i, phase, pageW, dist = {}) {
  const {
    fan = FAN_X,
    fanY = FAN_Y,
    fanZ = FAN_Z,
    exitX = EXIT_X,
    exitY = EXIT_Y,
    exitZ = EXIT_Z,
    arc = ARC_LIFT,
    parkX = PARK_DX,
    parkY = PARK_DY,
    parkZ = PARK_DZ,
  } = dist;
  const d = i - phase;

  if (d > FAN_DEPTH + 1) {
    return { hidden: true, x: 0, y: 0, z: 0, brightness: 0 };
  }

  let x, y, z, brightness;
  if (d >= 0) {
    // Source fan: next-up cards spread widest, deeper cards tighten.
    const dc = Math.min(d, FAN_DEPTH);
    x = cum(fan, FAN_FALLOFF, dc);
    y = cum(fanY, FAN_FALLOFF, dc);
    z = -dc * fanZ;
    brightness = Math.max(DARK_FLOOR, 1 - Math.max(dc - 0.35, 0) * DARK_IN);
  } else {
    // The deal: up-and-left on a slight arc into the landed stack, then the
    // pile converges — newest on top, older cards sinking gently darker.
    const t = Math.min(-d, 1); // deal progress, 0 → 1
    const park = Math.max(0, -d - 1); // depth into the landed pile
    x = -t * exitX * pageW + cum(parkX, PARK_FALLOFF, park);
    y = t * exitY + arc * Math.sin(Math.PI * t) + cum(parkY, PARK_FALLOFF, park);
    z = t * exitZ - cum(parkZ, PARK_FALLOFF, park);
    brightness = Math.max(PARK_FLOOR, 1 - park * PARK_DARK);
  }

  return { hidden: false, x, y, z, brightness };
}
