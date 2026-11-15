/**
 * siteSchemeLogic — the pure half of the colour-scheme widget (SQ-92): every
 * decision SiteScheme.jsx makes that a unit test can check without a browser.
 * No DOM, no React; colorScheme.js stays the one module that decides the scheme.
 */
import { SCHEMES, DEFAULT_SCHEME } from '../lib/colorScheme.js';

/** Station index of a scheme in the pager; an unknown name sits on the default's station. */
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
 * Pie wedges for the spectrum swatch, in DEGREES clockwise from 12 o'clock, in
 * the order of `shares`' keys (blue, red, green, yellow, periwinkle for the
 * measured SPECTRUM_SHARES). Contiguous from 0; proportional to the shares; the
 * last wedge ends at exactly 360 so float drift never leaves a sliver.
 */
export function pieWedges(shares) {
  const keys = Object.keys(shares);
  const total = keys.reduce((a, k) => a + shares[k], 0);
  let at = 0;
  return keys.map((key, i) => {
    const start = at;
    at = i === keys.length - 1 ? 360 : at + (shares[key] / total) * 360;
    return { key, start, end: at };
  });
}

/** A point on a circle, `deg` clockwise from 12 o'clock (SVG y runs down). */
export const arcPoint = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
};

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
