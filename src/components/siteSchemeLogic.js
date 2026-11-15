/**
 * siteSchemeLogic — the pure half of the colour-scheme widget (SQ-92): every
 * decision SiteScheme.jsx makes that a unit test can check without a browser.
 * No DOM, no React; colorScheme.js stays the one module that decides the scheme.
 */
import { SCHEMES, DEFAULT_SCHEME } from '../lib/colorScheme.js';

/**
 * Station index of a scheme in the pager (the ACTIVE schemes only); an unknown or parked
 * name (a `?scheme=spectrum` preview) sits on the default's station.
 */
export const stationOf = (scheme) => {
  const i = SCHEMES.indexOf(scheme);
  return i < 0 ? SCHEMES.indexOf(DEFAULT_SCHEME) : i;
};

/** The scheme at a station index. The pager wraps, so any integer maps; junk falls to the default. */
export const schemeAt = (index) => {
  const n = Math.floor(Number(index));
  if (!Number.isFinite(n)) return DEFAULT_SCHEME;
  return SCHEMES[((n % SCHEMES.length) + SCHEMES.length) % SCHEMES.length];
};

/**
 * The wheel pass-through guard: true while a page scroll that began OUTSIDE the
 * widget is still going, i.e. the last wheel event seen outside it is less than
 * `guardMs` old. A guard of 0 (or less, or junk) is off.
 */
export const shouldPassWheel = (now, lastOutsideAt, guardMs) =>
  Number.isFinite(guardMs) &&
  guardMs > 0 &&
  Number.isFinite(lastOutsideAt) &&
  now - lastOutsideAt < guardMs;

/**
 * The globe mark's STRIPS (public/icons/swm-globe-mark.svg): the mark is one path whose
 * first subpath is the outline and whose 34 others are the cells its lines leave open.
 * A strip is the run of cells between two neighbouring meridians, pole to edge. Listed
 * round the globe from the far-left strip the viewer sees: six across the front (left
 * to right), then the six on the far side that show over the pole (right to left).
 * Each number is a cell's subpath index in the mark.
 */
export const GLOBE_STRIPS = [
  [21, 23, 24],
  [14, 13, 26, 25],
  [15, 12, 28, 27],
  [5, 6, 30, 31],
  [4, 7, 32, 33],
  [2, 1, 34],
  [3, 8],
  [10, 9],
  [29, 11],
  [16, 17],
  [18, 20],
  [19, 22],
];

/** A path's subpaths, in order (the mark uses absolute M only). */
export const splitSubpaths = (d) => String(d ?? '').split(/(?=M)/).filter(Boolean);

/**
 * The project iris: every strip one solid colour. The keys cycle round the globe strip
 * by strip, and the cycle is seated so the FIRST key lands on the second strip: the four
 * wide strips across the front then read keys 1 to 4 left to right (blue, red, green,
 * yellow for SPECTRUM) and the last key takes the two edge strips. Returns one
 * { key, d } per key, in key order, `d` being that key's cells joined into one path.
 */
export function stripFills(d, keys, strips = GLOBE_STRIPS) {
  const subs = splitSubpaths(d);
  const n = keys.length;
  const out = keys.map((key) => ({ key, d: '' }));
  if (!n) return out;
  strips.forEach((cells, i) => {
    out[(i + n - 1) % n].d += cells.map((c) => subs[c] ?? '').join('');
  });
  return out;
}

const finiteNum = (raw) => {
  if (raw == null || raw === '') return NaN;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * The widget's ?params from a URLSearchParams (anything with .get):
 *   ?schemeui=0       hides the widget
 *   ?schemeguard=<ms> wheel pass-through guard, default 200 (0 = off)
 *   ?schemerows=<n>   deployed window rows (the rows SHOWN, centre included), default 3
 *   ?schemesize=<px>  swatch diameter; null = the CSS default
 *   ?schemepitch=<px> row pitch; null = the CSS default
 * Out-of-range values clamp; unparseable ones fall back to the default.
 */
export function schemeParams(params) {
  const guard = finiteNum(params.get('schemeguard'));
  const rows = finiteNum(params.get('schemerows'));
  const size = finiteNum(params.get('schemesize'));
  const pitch = finiteNum(params.get('schemepitch'));
  return {
    ui: params.get('schemeui') !== '0',
    guardMs: Number.isNaN(guard) ? 200 : Math.max(0, guard),
    rows: Number.isNaN(rows) ? 3 : Math.min(9, Math.max(1, rows)),
    size: Number.isNaN(size) || size <= 0 ? null : Math.max(8, size),
    pitch: Number.isNaN(pitch) || pitch <= 0 ? null : Math.max(8, pitch),
  };
}
