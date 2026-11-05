/**
 * logoTile — the Project Directory's logo tiles: a white mark on black in a
 * square or a landscape canvas, padded, scaled for equal visual weight and
 * centred by eye (Nathan, 11-05). Pure, so the page, the node tests and the
 * probe share one layout.
 *
 * The marks are baked white-on-transparent and trimmed to their ink by
 * scripts/prep-directory-logos.mjs, which also measures each one:
 *   aspect  — the trimmed width ÷ height;
 *   density — ink area ÷ box area (a thin wordmark is low, a badge high);
 *   cx, cy  — the ink's centre of mass in its box (0..1).
 *
 * The canvas is the tile's shape in the flush grid: a mark wider than `land`
 * takes a landscape (two columns wide, so 2:1), the rest a square. Every mark
 * then sits inside the canvas minus `pad` on each side (a share of the
 * canvas's height, so the margin is the same on both shapes), at:
 *   fit    — the largest size that fits the padded box;
 *   equal  — the size at which every mark has the same ink area (a dense
 *            badge comes out smaller than a thin script, as it weighs more);
 *   size   = fit^(1 − weight) × equal^weight, never past `fit`
 * so weight 0 fills every box (a bounding-box fit) and weight 1 evens the ink
 * out (the ticker's balance(), src/components/ClientLogoTicker.jsx, is the
 * same law on the box alone). Finally the mark is shifted so a blend of its
 * box centre and its centre of mass (`center`: 0 = the box, 1 = the mass)
 * lands on the canvas's centre, kept inside the padding.
 */

/** The dials' defaults: the ?dirlogo* params (directoryTune.js), until Nathan names numbers. */
export const LOGO_DIALS = {
  pad: 0.13,
  weight: 0.4,
  land: 1.6,
  center: 0.5,
};

/** The ink area every mark is brought to at weight 1, as a share of the padded box's area. */
const EQUAL_INK = 0.38;

/** A landscape canvas is this many times as wide as it is tall; a square, 1. */
export const CANVAS_RATIO = { square: 1, landscape: 2 };

export const canvasOf = (aspect, land = LOGO_DIALS.land) => (aspect >= land ? 'landscape' : 'square');

/**
 * Where a mark sits in its canvas.
 * @param {{aspect: number, density: number, cx?: number, cy?: number}} logo
 * @param {Partial<typeof LOGO_DIALS>} [dials]
 * @returns {{canvas: 'square'|'landscape', ratio: number, left: number, top: number, width: number, height: number}}
 *   the box in percent of the canvas
 */
export function logoLayout(logo, dials = LOGO_DIALS) {
  const { pad, weight, land, center } = { ...LOGO_DIALS, ...dials };
  const { aspect, density, cx = 0.5, cy = 0.5 } = logo;
  const canvas = canvasOf(aspect, land);
  const ratio = CANVAS_RATIO[canvas];

  // Units of the canvas's height: it is 1 tall, `ratio` wide.
  const innerH = Math.max(0.1, 1 - 2 * pad);
  const innerW = Math.max(0.1, ratio - 2 * pad);
  const fit = Math.min(innerH, innerW / aspect);
  const equal = Math.sqrt((EQUAL_INK * innerH * innerW) / (density * aspect));
  const h = Math.min(fit, fit ** (1 - weight) * equal ** weight);
  const w = h * aspect;

  // The shift that puts the blended centre on the canvas's centre, kept in the padding.
  const room = (inner, size) => Math.max(0, (inner - size) / 2);
  const dx = Math.max(-room(innerW, w), Math.min(room(innerW, w), -center * (cx - 0.5) * w));
  const dy = Math.max(-room(innerH, h), Math.min(room(innerH, h), -center * (cy - 0.5) * h));

  return {
    canvas,
    ratio,
    left: ((ratio - w) / 2 + dx) * (100 / ratio),
    top: ((1 - h) / 2 + dy) * 100,
    width: (w / ratio) * 100,
    height: h * 100,
  };
}
