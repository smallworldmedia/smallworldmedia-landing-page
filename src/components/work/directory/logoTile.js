/**
 * logoTile — the logo tiles' layout, on the Project Directory and on a
 * project's detail grid: a mark in a square or a landscape canvas, padded,
 * scaled for equal visual weight and centred by eye (Nathan, 11-05; one size
 * for both surfaces, 11-13). Pure, so the pages, the node tests and the probe
 * share one layout.
 *
 * The marks are baked white-on-transparent and trimmed to their ink by
 * scripts/prep-directory-logos.mjs, which also measures each one:
 *   aspect  — the trimmed width ÷ height;
 *   density — ink area ÷ box area (a thin wordmark is low, a badge high);
 *   cx, cy  — the ink's centre of mass in its box (0..1);
 *   trim    — the trimmed box inside the original file, [x, y, w, h] as
 *             fractions of it (the detail page places the ORIGINAL by it).
 *
 * The size is absolute, in cell units (a square canvas is 1 tall, 1 wide; a
 * landscape 1 tall, 2 wide), so a mark's size never depends on which canvas it
 * lands in (11-13: a wide mark in a landscape canvas used to get ~1.5× the
 * linear size of a square mark of the same density, because the target was a
 * share of the canvas's area):
 *   fit    — the largest size that fits the padded canvas;
 *   equal  — the size at which the mark has ink area INK, the same for every
 *            mark (a dense badge comes out smaller than a thin script);
 *   size   = fit^(1 − weight) × equal^weight, never past `fit`
 * so weight 0 fills every box (a bounding-box fit) and weight 1 evens the ink
 * out (the ticker's balance(), src/components/ClientLogoTicker.jsx, is the
 * same law on the box alone).
 *
 * The canvas follows that balanced size, not the mark's raw aspect: a mark
 * takes a square when its balanced box in one is at most `shrink` smaller than
 * the one a landscape would give it, a landscape otherwise. Finally the mark is
 * shifted so a blend of its box centre and its centre of mass (`center`: 0 =
 * the box, 1 = the mass) lands on the canvas's centre, kept inside the padding.
 */

/** The dials' defaults: the ?dirlogo* params (directoryTune.js; they steer the detail grid too). */
export const LOGO_DIALS = {
  pad: 0.13,
  weight: 1,
  shrink: 0.12,
  center: 0.5,
};

/**
 * The ink area every mark is brought to at weight 1, in square cells. Calibrated on
 * Nathan's references (11-13), HHS and Cheetah Print (ink 0.138 and 0.118 in a
 * square before): 0.13 keeps their boxes within a few percent of what they were.
 */
export const INK = 0.13;

/** A landscape canvas is this many times as wide as it is tall; a square, 1. */
export const CANVAS_RATIO = { square: 1, landscape: 2 };

/** The padded canvas, in units of its height: a canvas is 1 tall, `ratio` wide. */
const inner = (ratio, pad) => ({ h: Math.max(0.1, 1 - 2 * pad), w: Math.max(0.1, ratio - 2 * pad) });

/** The balanced height on a canvas of `ratio`: `want` is what the law asks for, `h` what fits. */
function sizeOn(logo, ratio, { pad, weight }) {
  const { h: innerH, w: innerW } = inner(ratio, pad);
  const fit = Math.min(innerH, innerW / logo.aspect);
  const equal = Math.sqrt(INK / (logo.density * logo.aspect));
  const want = fit ** (1 - weight) * equal ** weight;
  return { innerH, innerW, want, h: Math.min(fit, want) };
}

/**
 * The canvas a mark takes: a square when its balanced box comes out within
 * `shrink` of the size a landscape would give it (so it fits a square, shrunk by
 * at most that share), a landscape when the square would cramp it.
 */
export function canvasOf(logo, dials = LOGO_DIALS) {
  const d = { ...LOGO_DIALS, ...dials };
  const square = sizeOn(logo, CANVAS_RATIO.square, d).h;
  const landscape = sizeOn(logo, CANVAS_RATIO.landscape, d).h;
  return square >= landscape * (1 - d.shrink) ? 'square' : 'landscape';
}

/**
 * Where a mark sits in its canvas.
 * @param {{aspect: number, density: number, cx?: number, cy?: number}} logo
 * @param {Partial<typeof LOGO_DIALS>} [dials]
 * @returns {{canvas: 'square'|'landscape', ratio: number, left: number, top: number, width: number, height: number}}
 *   the ink's box in percent of the canvas
 */
export function logoLayout(logo, dials = LOGO_DIALS) {
  const d = { ...LOGO_DIALS, ...dials };
  const { aspect, cx = 0.5, cy = 0.5 } = logo;
  const canvas = canvasOf(logo, d);
  const ratio = CANVAS_RATIO[canvas];

  // Units of the canvas's height: it is 1 tall, `ratio` wide.
  const { innerH, innerW, h } = sizeOn(logo, ratio, d);
  const w = h * aspect;

  // The shift that puts the blended centre on the canvas's centre, kept in the padding.
  const room = (span, size) => Math.max(0, (span - size) / 2);
  const dx = Math.max(-room(innerW, w), Math.min(room(innerW, w), -d.center * (cx - 0.5) * w));
  const dy = Math.max(-room(innerH, h), Math.min(room(innerH, h), -d.center * (cy - 0.5) * h));

  return {
    canvas,
    ratio,
    left: ((ratio - w) / 2 + dx) * (100 / ratio),
    top: ((1 - h) / 2 + dy) * 100,
    width: (w / ratio) * 100,
    height: h * 100,
  };
}

/**
 * The ORIGINAL file placed so its ink lands on `box` (logoLayout's): the
 * file's rect in percent of the canvas, given `trim`, the ink's rect in the
 * file as fractions [x, y, w, h]. The canvas clips whatever overhangs.
 */
export function placeOriginal(box, trim) {
  const [tx, ty, tw, th] = trim;
  const width = box.width / tw;
  const height = box.height / th;
  return { left: box.left - tx * width, top: box.top - ty * height, width, height };
}

/**
 * The Sanity image asset id a CDN url names (`…/<40 hex>-<w>x<h>.<ext>` is
 * `image-<hex>-<w>x<h>-<ext>`): the key of the prep manifest, for a detail
 * asset whose query carries the url but not the id.
 * @param {string} [url]
 * @returns {string|null}
 */
export function assetIdOfUrl(url) {
  const m = /\/([0-9a-f]{40})-(\d+x\d+)\.([a-z0-9]+)(?:\?|$)/i.exec(url ?? '');
  return m ? `image-${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * A logo on the detail grid: `mark` is its manifest entry (the baked numbers).
 * A mark whose original has a clear ground gets the balanced layout, the file
 * placed by its ink; any other logo (held, or an opaque file whose ground is
 * part of the picture) keeps its tile class's shape with a padded `contain`,
 * not balanced. `ratio` is the canvas's shape, what the flush grid gives the tile.
 * @param {Object} mark - the manifest entry (`aspect`, `density`, `cx`, `cy`, `trim`) or a hold / absent
 * @param {{ratio: number, hasAlpha: boolean, own: number}} asset - `own` is the tile shape the
 *        logo took before this rule (TILE_RATIO of its class), `hasAlpha` its file's transparency
 * @returns {{ratio: number, box: Object, img?: Object}} `box` the ink's (or the whole file's) rect in
 *          percent of the canvas, `img` the original's rect when it is placed by its ink
 */
export function detailLogo(mark, { hasAlpha, own }, dials = LOGO_DIALS) {
  const pad = { ...LOGO_DIALS, ...dials }.pad;
  if (mark?.file && mark.trim && hasAlpha) {
    const box = logoLayout(mark, dials);
    return { ratio: box.ratio, box, img: placeOriginal(box, mark.trim) };
  }
  // Padded contain: the whole file in the padded canvas (object-fit does the rest).
  const { h, w } = inner(own, pad);
  return {
    ratio: own,
    box: { left: (pad / own) * 100, top: pad * 100, width: (w / own) * 100, height: h * 100 },
  };
}
