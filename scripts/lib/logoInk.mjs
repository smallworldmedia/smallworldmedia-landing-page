/**
 * logoInk — the build-time look at one logo file, for the Project Directory's
 * logo tiles (scripts/prep-directory-logos.mjs).
 *
 * A logo tile is a WHITE mark on black, so the one question per file is "what
 * is ink?". That is a strength raster, 0..1 per pixel:
 *   - a file with transparency: its alpha;
 *   - an opaque file on a plain ground (a JPG, a PNG with a solid
 *     background): how far each pixel is from the ground's colour, so a black
 *     mark on white and a white mark on black both come out as ink.
 * The white mark the tile shows is that strength as the alpha of pure #fff,
 * cropped to the ink's bounding box (the ticker's ALPHA_MIN box, 09-08), plus
 * the numbers the page needs for perceptual scaling and optical centring:
 * ink density (ink area ÷ box area) and the ink's centre of mass.
 *
 * A file is held back (`hold`) when flattening it to one colour would lose the
 * drawing: a ground that is not plain (a photo, a board), or a mark whose
 * colours separate shapes from each other (a rainbow wordmark with black
 * outlines, a mascot): `inner`, the share of ink that touches ink of a
 * clearly different colour, is the measure, so a one-colour logo reads ~0
 * however dark or bright it is.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

/** The longest side the file is looked at (and baked) at, px. */
export const MAX_SIDE = 1000;

/** Ink starts above this strength (the ticker's 8/255). */
const INK_MIN = 8 / 255;
/** A file with less transparent area than this has an opaque ground. */
const TRANSPARENT_MIN = 0.02;
/** Ground-key ramp: distance from the ground (0..1) mapped to strength. */
const KEY_LO = 0.2;
const KEY_HI = 0.5;
/** A border pixel is "ground" within this distance of the border's median. */
const GROUND_TOL = 0.12;
/** The border must be at least this share ground for the ground to be plain. */
const GROUND_PLAIN = 0.9;
/** Ink colours differ clearly beyond this RGB distance (0..1), EDGE_REACH px apart. */
const EDGE_DIFF = 0.4;
const EDGE_REACH = 4;
/** Ink this far (0..1) from the ink's median colour counts as another colour. */
const SPREAD_DIFF = 0.25;
/** Above either share, flattening to one colour loses the drawing. */
export const INNER_MAX = 0.06;
export const SPREAD_MAX = 0.05;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[s.length >> 1];
};
const dist = (r, g, b, ground) =>
  Math.hypot(r - ground[0], g - ground[1], b - ground[2]) / (255 * Math.sqrt(3));

/** Keyed ink: a speck smaller than this many px² (a grain, a JPEG ghost) is ground. */
const SPECK_PX = 60;
/** Over this share of speck ink the ground is textured, not plain. */
const SPECK_MAX = 0.1;

/**
 * Zero the specks: 4-connected ink components under SPECK_PX px² (and 2 px
 * around). Returns the specks' share of all the ink: a plain ground leaves
 * a few, a textured one (grain, a vignette) leaves a mark lost in them.
 */
function dropSpecks(strength, W, H) {
  const label = new Int32Array(W * H);
  const stack = [];
  let all = 0;
  let specks = 0;
  for (let s = 0; s < W * H; s++) {
    if (strength[s] < 0.5 || label[s]) continue;
    const members = [];
    label[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop();
      members.push(i);
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= W * H || label[j] || strength[j] < 0.5) continue;
        label[j] = 1;
        stack.push(j);
      }
    }
    all += members.length;
    if (members.length >= SPECK_PX) continue;
    specks += members.length;
    for (const i of members) {
      const x = i % W;
      const y = (i - x) / W;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) strength[yy * W + xx] = 0;
        }
      }
    }
  }
  return all ? specks / all : 0;
}

/** The strength raster, with how it was got: { strength, mode, ground? }. */
function strengthOf(data, W, H) {
  const n = W * H;
  let clear = 0;
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] < 8) clear++;
  const strength = new Float32Array(n);

  if (clear / n >= TRANSPARENT_MIN) {
    for (let i = 0; i < n; i++) strength[i] = data[i * 4 + 3] / 255;
    return { strength, mode: 'alpha' };
  }

  // Opaque: the ground is the border's median colour, and must be plain.
  const border = [];
  const ring = Math.max(2, Math.round(Math.min(W, H) * 0.01));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (x < ring || y < ring || x >= W - ring || y >= H - ring) border.push((y * W + x) * 4);
    }
  }
  const ground = [0, 1, 2].map((c) => median(border.map((i) => data[i + c])));
  const plain = border.filter((i) => dist(data[i], data[i + 1], data[i + 2], ground) <= GROUND_TOL).length / border.length;
  for (let i = 0; i < n; i++) {
    const d = dist(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], ground);
    strength[i] = Math.min(1, Math.max(0, (d - KEY_LO) / (KEY_HI - KEY_LO)));
  }
  const specks = dropSpecks(strength, W, H);
  return { strength, mode: 'keyed', ground, plain, specks };
}

/**
 * How much of the drawing one colour would lose, over the solid ink:
 *   inner  — the share that sits within EDGE_REACH px of solid ink of a
 *            clearly different colour (outlines against fills; an edge's own
 *            anti-aliasing ramp is shorter than the reach, so it is crossed);
 *   spread — the share whose colour is far from the ink's median colour
 *            (shading, tints, a second ink).
 */
function colourLoss(data, strength, W, H) {
  const solid = [];
  for (let i = 0; i < W * H; i++) if (strength[i] >= 0.95) solid.push(i);
  if (!solid.length) return { inner: 0, spread: 0 };
  const med = [0, 1, 2].map((c) => median(solid.map((i) => data[i * 4 + c])));
  const thr = EDGE_DIFF * 255 * Math.sqrt(3);
  const far = (i, j) =>
    Math.hypot(data[i * 4] - data[j * 4], data[i * 4 + 1] - data[j * 4 + 1], data[i * 4 + 2] - data[j * 4 + 2]) > thr;
  let inner = 0;
  let spread = 0;
  for (const i of solid) {
    const x = i % W;
    const y = (i - x) / W;
    if (dist(data[i * 4], data[i * 4 + 1], data[i * 4 + 2], med) > SPREAD_DIFF) spread++;
    const right = x + EDGE_REACH < W ? i + EDGE_REACH : -1;
    const below = y + EDGE_REACH < H ? i + EDGE_REACH * W : -1;
    if ((right >= 0 && strength[right] >= 0.95 && far(i, right)) || (below >= 0 && strength[below] >= 0.95 && far(i, below)))
      inner++;
  }
  return { inner: inner / solid.length, spread: spread / solid.length };
}

/**
 * @param {Buffer} buf - the file's bytes (png, jpg, svg)
 * @param {{svg?: boolean}} [opts]
 * @returns {Promise<Object>} { hold?, mode, w, h, aspect, density, cx, cy, trim, inner,
 *   ground?, png? } — `png` is the white mark (Buffer) unless held for
 *   `no-ink`; cx / cy are the centre of mass in the box (0..1); `trim` is the
 *   box inside the file as fractions [x, y, w, h], so the original can be placed by its ink.
 */
export async function analyseLogo(buf, { svg = false } = {}) {
  let input = sharp(buf, svg ? { density: 72 } : {});
  if (svg) {
    const m = await input.metadata();
    const density = Math.min(2400, (72 * MAX_SIDE) / Math.max(m.width, m.height));
    input = sharp(buf, { density });
  }
  const { data, info } = await input
    .ensureAlpha()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: !svg })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  const { strength, mode, ground, plain, specks } = strengthOf(data, W, H);

  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = strength[y * W + x];
      if (s <= INK_MIN) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      sum += s;
      sx += s * x;
      sy += s * y;
    }
  }
  if (x1 < 0) return { hold: 'no-ink', mode };
  x1++;
  y1++;
  const w = x1 - x0;
  const h = y1 - y0;

  const loss = colourLoss(data, strength, W, H);
  const out = {
    mode,
    w,
    h,
    aspect: +(w / h).toFixed(4),
    density: +(sum / (w * h)).toFixed(4),
    cx: +((sx / sum + 0.5 - x0) / w).toFixed(4),
    cy: +((sy / sum + 0.5 - y0) / h).toFixed(4),
    trim: [x0 / W, y0 / H, w / W, h / H].map((v) => +v.toFixed(4)),
    inner: +loss.inner.toFixed(4),
    spread: +loss.spread.toFixed(4),
    ...(mode === 'keyed' ? { specks: +specks.toFixed(4) } : {}),
  };

  // A sparse "mark" reaching every edge of a keyed file is the ground's
  // texture (a grunge backdrop), not a mark.
  const textured = w >= W * 0.95 && h >= H * 0.95 && out.density < 0.1;
  if (mode === 'keyed' && (plain < GROUND_PLAIN || specks > SPECK_MAX || textured)) out.hold = 'busy-ground';
  else if (out.inner > INNER_MAX || out.spread > SPREAD_MAX) out.hold = 'multi-colour';

  // The white mark: pure #fff, the strength as alpha, cropped to the ink.
  const raw = Buffer.alloc(w * h * 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 2;
      raw[o] = 255;
      raw[o + 1] = Math.round(255 * strength[(y0 + y) * W + x0 + x]);
    }
  }
  out.png = await sharp(raw, { raw: { width: w, height: h, channels: 2 } })
    .png({ compressionLevel: 9, palette: true, quality: 100 })
    .toBuffer();
  return out;
}

/**
 * A 64×64 silhouette of the mark (strength, fitted whole and centred, then
 * softened so a pixel's shift does not read as a different mark), for telling
 * two files of one mark apart from two marks: `twinScore` is the overlap of
 * two of them (1 = the same silhouette).
 */
export async function silhouette(png) {
  const { data } = await sharp(png)
    .resize({ width: 64, height: 64, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(2)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const a = new Float32Array(64 * 64);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3] / 255;
  return a;
}

export function twinScore(a, b) {
  let inter = 0;
  let union = 0;
  for (let i = 0; i < a.length; i++) {
    inter += Math.min(a[i], b[i]);
    union += Math.max(a[i], b[i]);
  }
  return union ? inter / union : 0;
}

/** The side the transparency census looks at, px (SQ-20's 11-05 measure). */
export const ALPHA_SIDE = 300;

/**
 * How transparent a face really is, for the directory's fit (SQ-20): `clear`,
 * the share of pixels under alpha 250, and `lum`, the mean luminance (0..1)
 * of the pixels at least half opaque — the ink a near-black ground would show
 * (0.5 when there are none). Rounded to 3 places, so a re-bake diffs cleanly.
 */
export async function alphaStats(buf) {
  const { data, info } = await sharp(buf)
    .resize({ width: ALPHA_SIDE, height: ALPHA_SIDE, fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;
  let clear = 0;
  let ink = 0;
  let lum = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const a = data[i + 3];
    if (a < 250) clear++;
    if (a >= 128) {
      ink++;
      lum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    }
  }
  const round = (x) => Math.round(x * 1000) / 1000;
  return { clear: round(clear / n), lum: round(ink ? lum / ink : 0.5) };
}
