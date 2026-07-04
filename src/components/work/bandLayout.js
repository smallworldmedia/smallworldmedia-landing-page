/**
 * bandLayout.js — the band-stack geometry brain (ADR-0003: math-first).
 *
 * One pure pose function shared by every band surface: BandPager paints it
 * as CSS 3D transforms on the detail page (px units); worldBands paints it
 * as textured planes inside the World's framebuffer (world units, so the
 * lens-distortion pass warps the stack with the scene). Visual parity
 * between the two surfaces lives here, never in a shared renderer.
 *
 * The stack: items ride a slight isometric angle, the resting fan recedes
 * behind the front item (depth = darkening, never transparency), passed
 * items lift toward the viewer and darken out left.
 *
 * Distances (fan/exit) are expressed in caller units — the DOM passes the
 * px-tuned defaults below; the World scales them by its page width against
 * REF_PAGE_W so the stack keeps the same proportions at any size.
 */

/* Stack geometry — px-tuned on the detail page (the reference surface) */
export const BAND_ANGLE = -8; // isometric rotateY, degrees
export const FAN_X = 30; // horizontal peek per upcoming page
export const FAN_Z = 46; // recession per upcoming page (perspective scales)
export const FAN_DEPTH = 3.5; // pages visible in the resting fan
export const EXIT_Z = 40; // passed pages lift toward the viewer
export const EXIT_X = 0.92; // × pageW travel for passed pages
export const DARK_IN = 0.2; // brightness drop per upcoming page (fan)
export const DARK_FLOOR = 0.35; // fan brightness floor
export const DARK_OUT = 0.9; // brightness loss per passed page (darkens out)

/** The page width the px distances were tuned against (detail-page stage). */
export const REF_PAGE_W = 520;

/**
 * Pose of page `i` when the stack sits at `phase` (fractional page index).
 *
 * @param {number} i - page index
 * @param {number} phase - current stack phase (0 = first page front)
 * @param {number} pageW - page width in caller units (drives exit travel)
 * @param {{fan?: number, fanZ?: number, exitZ?: number}} [dist] - fan/exit
 *   distances in caller units (defaults = the px-tuned reference values)
 * @returns {{hidden: boolean, x: number, z: number, brightness: number}}
 */
export function bandPose(i, phase, pageW, dist = {}) {
  const { fan = FAN_X, fanZ = FAN_Z, exitZ = EXIT_Z } = dist;
  const d = i - phase;

  if (d > FAN_DEPTH + 1) return { hidden: true, x: 0, z: 0, brightness: 0 };

  let x, z, brightness;
  if (d >= 0) {
    const dc = Math.min(d, FAN_DEPTH);
    x = dc * fan;
    z = -dc * fanZ;
    brightness = Math.max(DARK_FLOOR, 1 - Math.max(dc - 0.35, 0) * DARK_IN);
  } else {
    x = d * pageW * EXIT_X;
    z = -d * exitZ;
    brightness = Math.max(0, 1 + d * DARK_OUT);
  }

  // Depth = darkness, never transparency; exits darken fully out.
  return { hidden: d < 0 && brightness <= 0.04, x, z, brightness };
}
