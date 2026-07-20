/**
 * projectColor — per-project accent helpers.
 *
 * A project can carry a `projectColor` (and optional `projectColorSecondary`).
 * Surfaces read it via the CSS custom property `--project-color`, always with
 * `var(--project-color, var(--color-electric-blue))` so an uncolored project
 * renders in brand blue exactly as before.
 *
 * `projectInk()` derives a readable TEXT colour for content that sits *on* the
 * project colour: a bright accent (e.g. HHS lime #84F104) needs near-black ink;
 * a dark accent (e.g. COCO red #AC232F) needs white. Threshold uses the classic
 * YIQ perceived-brightness formula — cheap, stable, and good enough for a
 * two-way light/dark ink flip.
 */

export const INK_DARK = '#0a0a0a'; // --color-near-black
export const INK_LIGHT = '#ffffff';
const YIQ_THRESHOLD = 140; // >= → treat accent as "light" → dark ink

function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** Perceived brightness (YIQ), 0–255. null for an unparseable colour. */
export function brightness(hex) {
  const c = parseHex(hex);
  if (!c) return null;
  return (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
}

/**
 * Readable ink for text placed ON `hex`. Returns undefined when `hex` is
 * missing/invalid so callers can leave the CSS var unset (→ inherit / fallback).
 */
export function projectInk(hex) {
  const y = brightness(hex);
  if (y == null) return undefined;
  return y >= YIQ_THRESHOLD ? INK_DARK : INK_LIGHT;
}

/** True when the accent is light enough to need dark ink / a dark globe. */
export function accentIsLight(hex) {
  const y = brightness(hex);
  return y != null && y >= YIQ_THRESHOLD;
}

/**
 * The accent rendered AS text on a light/white surface (enter_world label,
 * service-tag pills): a light accent is unreadable there, so fall back to brand
 * black; a dark-enough accent keeps its hue. undefined when unparseable.
 */
export function accentText(hex) {
  const y = brightness(hex);
  if (y == null) return undefined;
  return y >= YIQ_THRESHOLD ? INK_DARK : hex;
}

/**
 * Build the inline style vars for a project accent. Any missing input is left
 * out (value `undefined`) so the CSS fallback chain stays intact.
 *   --project-color        accent (bg fills, gradient, grid)
 *   --project-color-2      secondary accent (plumbed; unmapped)
 *   --project-color-fg     readable ink for text/marks ON the accent
 *   --project-color-text   the accent used AS text on white (→ black if light)
 *   --project-globe-filter flips the white SWM globe dark on a light accent
 *   --nav-ink-l            ink lightness scalar (1 = white ink, 0 = dark ink)
 *                          for the nav's perceptual (oklab) cross-fade — see
 *                          the --nav-ink definition in global.css
 */
export function projectColorVars(primary, secondary) {
  return {
    '--project-color': primary || undefined,
    '--project-color-2': secondary || undefined,
    '--project-color-fg': projectInk(primary),
    '--project-color-text': accentText(primary),
    '--project-globe-filter': accentIsLight(primary) ? 'brightness(0)' : undefined,
    // Scalar twin of --project-color-fg: 1 → white ink (dark accent), 0 → dark
    // ink (light accent). Interpolated linearly so the nav ink cross-fades
    // through oklab (perceptually even both ways), not gamma sRGB.
    '--nav-ink-l': primary ? (accentIsLight(primary) ? 0 : 1) : undefined,
  };
}
