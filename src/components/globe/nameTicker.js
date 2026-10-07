/**
 * nameTicker.js — the client-name strip on the home globe (10-06, Nathan:
 * "one to several of the panels populate with the client name … the project
 * color, the FP card's typeface"; 10-07, the placement rework: "the text is
 * too big and the longer client names are clipped … let's remove the
 * horizontal ticker effect").
 *
 * This module DRAWS and MEASURES; PopulationDirector.planNames() places.
 * (Placement is camera-relative — mid-latitude, front-facing, a quadrant
 * opposite the last world's — and none of that can be expressed over the
 * scroll tape: a row's latitude changes all the way down its pole-to-pole
 * pass. The old tape-pure nameCell() is gone with the ticker.)
 *
 * A world's name is drawn ONCE into a strip texture: the clientName in the FP
 * card's face (OT Neue Montreal Squeezed SemiBold, uppercase, tight tracking)
 * in the world's projectColor — `ink` = the colour on black, `fill` = black
 * on the colour (?popnamestyle), at ?popnamesize font px per strip height.
 * Two layouts (?popnamemode):
 *   region  the strip IS the run of tiles: the canvas is padded to exactly
 *           `span` tiles wide (span from the MEASURED name, nameSpan below),
 *           the name centred in it, no repeat — so the tiles read the whole
 *           name once, edge to edge, and nothing is cut. A span the clamp cut
 *           short shrinks the type rather than cutting the name.
 *   band    the natural strip (name + gap) repeating around a whole latitude
 *           row, still.
 * The strips do not move: tile k RENDERS the k-th slice of the strip
 * (nameWindow below, applied in PopulationDirector.placeNames), and the
 * strip's real aspect rides texture.userData.aspect into tileSwap's cover-fit,
 * which is what makes that slice exactly 1/span of the strip in region mode.
 * "Renders", not "rests on": panelMaterial centre-crops a scroll tile's
 * sampling by the pole pinch, so the window has to undo it — see nameWindow.
 *
 * nameKey carries every input that changes the DRAWING (style, size, layout)
 * because TextureManager caches one texture per key — a variation left out of
 * the key would let the first-drawn variant stick for the session.
 */
import * as THREE from 'three';

export const NAME_STYLES = ['ink', 'fill'];
/** region = a run of tiles sized to the name; band = a whole latitude row. */
export const NAME_MODES = ['region', 'band'];
/** The quadrant walk across worlds — Nathan: lower-left, then upper-right. */
export const NAME_QUADS = ['LL', 'UR', 'UL', 'LR'];

const FACE = '"OT Neue Montreal Squeezed"'; // .fp-card__client (--font-display)
const WEIGHT = 600;
const STRIP_H = 256; // px — the strip's height (a tile's texture scale)
const TRACKING = -0.02; // em — the card's --tracking-tight
const GAP = 0.42; // strip heights of clear space around the name
const BLACK = '#000000';
const BRAND_BLUE = '#0000ff'; // a world without a projectColor
const EM = 0.5; // em per glyph — the estimate when the face can't be measured

const fontAt = (px) => `${WEIGHT} ${px}px ${FACE}`;
const pxFor = (size) => Math.max(8, Math.round(STRIP_H * size));
const label = (text) => String(text ?? '').toUpperCase();
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

/** The latitude gate: the |centerDir.y| a name tile may sit at for a band of
 *  `f` of pole-to-pole (0.65 = the middle 65%, |y| ≤ 0.85). centerDir is
 *  unrotated, so its y IS the latitude and |y| is pole proximity. */
export const nameBandLimit = (f) => Math.sin((clamp(f, 0, 1) * Math.PI) / 2);
/** The facing gate: the camera-rotated .z every tile of a strip must clear
 *  for a front-facing width of `f` of the circumference (0.5 = the visible
 *  half → 0). */
export const nameFaceLimit = (f) => Math.cos(clamp(f, 0, 1) * Math.PI);

/** panelMaterial's pole-pinch factor for a scroll tile at latitude `y`
 *  (centerDir.y = cos θ_center): vK = sin(θ_center) — the tile's width as a
 *  fraction of the equator band. centerDir is a unit vector, so sin θ is its
 *  own xz length. The floor keeps a parked row (|y| = 1, collapsed on a pole
 *  and invisible) out of a divide by zero. */
export const namePinch = (y) => Math.max(Math.sqrt(Math.max(1 - y * y, 0)), 1e-3);

/**
 * Slice k's resting window on a tile pinched by `vK`, for a strip whose
 * natural slice (cover-fit's own x scale — one tile's share) is `slice` wide.
 *
 * The pinch is why this is not simply `offsetX = k · slice`. panelMaterial
 * centre-crops a scroll tile's media SAMPLING by vK (`vK` in its vertex
 * shader, `mUv` in its fragment shader) so a tile narrowed toward a pole
 * crops a photo instead of squashing it. Text has no slack for that: at the
 * band edge vK ≈ 0.53, so a tile showed only the middle HALF of its slice —
 * which rendered TOBEHONEST as "TOHOST" while the texture, the span and the
 * offsets were all provably right, because the crop happens after them.
 *
 * So undo it here. vUv.x 0..1 reaches the shader as mUv.x = 0.5 ± vK/2, and
 * u = mUv.x · scaleX + offsetX, so scaleX = slice/vK makes the rendered width
 * exactly `slice` at every latitude and the offset recentres it on
 * (k + ½)·slice. The glyphs then foreshorten with the latitude — the sphere's
 * own longitude convergence, correct for type wrapped around a globe, and not
 * the squash the pinch exists to prevent.
 *
 * `band` wraps the offset into the strip's repeat (RepeatWrapping). Region
 * must NOT wrap: its offset is slightly negative at k = 0 by design and the
 * sampled range still never leaves [0, 1], while a wrap would push it past
 * the clamped edge.
 */
export function nameWindow(k, slice, vK, { band = false } = {}) {
  const scaleX = slice / vK;
  const offsetX = k * slice - ((1 - vK) * slice) / (2 * vK);
  return { scaleX, offsetX: band ? offsetX - Math.floor(offsetX) : offsetX };
}

/** The strip range a tile with this window ACTUALLY renders, under the pinch
 *  — the measurement, not the intent, and the one the "TOHOST" defect needed:
 *  every CPU-side value was right while the render was wrong. Tile k is in
 *  register iff this is [k·slice, (k+1)·slice] (mod 1 in band mode). */
export function nameRendered(scaleX, offsetX, vK) {
  return [offsetX + (0.5 - 0.5 * vK) * scaleX, offsetX + (0.5 + 0.5 * vK) * scaleX];
}

let ctx2d = null;
function measureCtx() {
  if (ctx2d !== null) return ctx2d;
  ctx2d = typeof document === 'undefined' ? false : document.createElement('canvas').getContext('2d');
  return ctx2d;
}

/** A webfont used ONLY on a canvas is never fetched: nothing in the DOM wears
 *  it, so the browser leaves it alone until something asks. loadNameTexture
 *  asks (document.fonts.load) — but the director PLANS before it draws, and
 *  document.fonts.check() answers true for a face the document has never
 *  activated, so that first measurement silently runs in the DEFAULT face and
 *  sizes the span to its much wider metrics (TOBEHONEST asked for 5 tiles of
 *  a 3-tile name, spreading it over 150° of longitude where the globe's own
 *  foreshortening eats it). So ask at import, and until the real face is in
 *  hand measure nothing — the glyph-count estimate is the honest answer. */
let faceLoaded = false;
if (typeof document !== 'undefined' && document.fonts?.load) {
  document.fonts
    .load(fontAt(STRIP_H), 'ABC')
    .then(() => {
      faceLoaded = true;
    })
    .catch(() => {
      /* the estimate carries it */
    });
}

/** The drawn width of the label in px — measured once the face is really in
 *  hand (faceLoaded above, NOT document.fonts.check), else estimated from the
 *  glyph count (a wrong estimate only mis-sizes one layout; the next world
 *  change measures for real). */
function textWidth(text, px) {
  const s = label(text);
  const font = fontAt(px);
  try {
    const ctx = measureCtx();
    if (ctx && faceLoaded) {
      ctx.font = font;
      ctx.letterSpacing = `${(TRACKING * px).toFixed(1)}px`;
      return ctx.measureText(s).width;
    }
  } catch {
    /* fall through to the estimate */
  }
  return s.length * px * (EM + TRACKING);
}

/** The natural strip's aspect (the name plus its clear space, over the strip
 *  height) — what the director needs BEFORE the texture exists, because
 *  initialLayout plans the globe before anything warms. */
export function measureNameAspect(text, size) {
  if (!label(text)) return 1;
  return Math.max(1, (textWidth(text, pxFor(size)) + STRIP_H * GAP) / STRIP_H);
}

/**
 * Tiles a strip needs so the whole name READS AT REST. A tile shows
 * panelAspect / stripAspect of the strip, so the name fits iff
 * span ≥ stripAspect / panelAspect — the clipping the ticker used to hide by
 * scrolling the rest past. Clamped to [min, max]; at max the drawing shrinks
 * the type instead (loadNameTexture), so a name is never cut either way.
 */
export function nameSpan(text, size, panelAspect, { min = 1, max = 1 } = {}) {
  const need = Math.ceil(measureNameAspect(text, size) / (panelAspect || 1));
  const lo = Math.max(1, Math.round(min));
  return clamp(need, lo, Math.max(lo, Math.round(max)));
}

/** The tile asset for a world's name strip (assetKey reads nameKey). */
export function nameAsset(world, wi, { style, size, mode, span, panelAspect = 1 }) {
  const band = mode === 'band';
  return {
    kind: 'name',
    nameKey: `name:${world.slug}:${style}:${size}:${band ? 'band' : `region${span}`}`,
    text: world.clientName || '',
    color: world.projectColor || BRAND_BLUE,
    style,
    size,
    mode: band ? 'band' : 'region',
    span,
    panelAspect,
    world: wi,
    clientName: world.clientName,
    services: world.services,
  };
}

/** Draw the strip → a CanvasTexture (resolves once the face has loaded). */
export async function loadNameTexture({ text, color, style, size, mode, span, panelAspect = 1 }) {
  const s = label(text);
  const band = mode === 'band';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let px = pxFor(size);
  try {
    await document.fonts.load(fontAt(px), s);
  } catch {
    /* the fallback face draws */
  }
  const setFont = () => {
    ctx.font = fontAt(px);
    ctx.letterSpacing = `${(TRACKING * px).toFixed(1)}px`;
  };
  setFont();
  let m = ctx.measureText(s);
  const gap = STRIP_H * GAP;
  let w;
  if (band) {
    w = Math.max(STRIP_H, Math.ceil(m.width + gap));
  } else {
    // The canvas IS the span: span tiles of clear width, so cover-fit hands
    // each tile exactly 1/span of it and the name reads once, edge to edge.
    w = Math.max(STRIP_H, Math.round(span * panelAspect * STRIP_H));
    const room = w - gap;
    if (m.width > room && room > 0) {
      // ?popnamespanmax cut the span short — shrink the type, never the name.
      px = Math.max(8, Math.floor(px * (room / m.width)));
      setFont();
      m = ctx.measureText(s);
    }
  }
  canvas.width = w;
  canvas.height = STRIP_H;
  setFont(); // a resize resets the context
  const ground = style === 'fill' ? color : BLACK;
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, w, STRIP_H);
  ctx.fillStyle = style === 'fill' ? BLACK : color;
  ctx.textBaseline = 'alphabetic';
  // The caps' own box, centred on the strip (optical, not em-box, centring).
  const y = (STRIP_H + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.fillText(s, band ? gap / 2 : Math.max(0, (w - m.width) / 2), y);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (band) tex.wrapS = THREE.RepeatWrapping; // the name repeats round the row
  tex.anisotropy = 4;
  tex.userData.aspect = w / STRIP_H;
  return tex;
}
