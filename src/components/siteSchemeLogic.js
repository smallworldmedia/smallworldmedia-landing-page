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
 * Vertical bars for the project iris: one per key of `shares`, left to right in the
 * key order (blue, red, green, yellow, periwinkle for the measured SPECTRUM_SHARES),
 * each `w` proportional to its share of `width`. Contiguous from `x0`; the last bar
 * ends at exactly x0 + width so float drift never leaves a sliver. Returns
 * [{ key, x, w }].
 */
export function barSpans(shares, x0, width) {
  const keys = Object.keys(shares);
  const total = keys.reduce((a, k) => a + shares[k], 0);
  let at = x0;
  return keys.map((key, i) => {
    const x = at;
    at = i === keys.length - 1 ? x0 + width : at + (shares[key] / total) * width;
    return { key, x, w: at - x };
  });
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
