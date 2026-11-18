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

/** The iris is 26 units across; the lid line is 1.5 (the globe's own line weight, Nathan 11-15). */
export const IRIS_UNITS = 26;
export const LID_STROKE = 1.5;

/**
 * The eye (SQ-107 pass 11, ?schemelids). At the lid scale k = 1 it is 48 x 28 units: the lids are two circular arcs
 * of radius 27.5 through (2,14) and (46,14), a half chord of 22, so the apex is 11 from the centre (27.5 - sqrt(27.5^2
 * - 22^2) = 11). The iris (radius 13) does not grow, so the rest of the circle's white ring showed past the lids once
 * engaged. The lids grow by k about the eye's CENTRE (the half chord 22k, the radius 27.5k, the apex 11k; the STROKE
 * stays LID_STROKE), and the box keeps today's margins round them (a corner's stroke 1.25 units from the sides, an
 * apex's 2.25 from the top and bottom): w = 2 (22k + 2), h = 2 (11k + 3). The iris stays at the box's centre.
 *
 * The smallest k that covers: the circle (radius 13, the lids' arcs' centres 16.5k from the eye's centre) lies inside
 * the lids' OUTER edge (radius 27.5k + 0.75) when 16.5k + 13 <= 27.5k + 0.75, so k >= 12.25 / 11 = 1.1136. The default
 * is 1.12.
 */
export const LIDS = 1.12;
export const LIDS_MIN = (IRIS_UNITS / 2 - LID_STROKE / 2) / (27.5 - 16.5);
export function eyeGeometry(k = LIDS) {
  const half = 22 * k;
  const r = 27.5 * k;
  const w = 2 * (half + 2);
  const h = 2 * (11 * k + 3);
  const cx = w / 2;
  const cy = h / 2;
  const f = (n) => +n.toFixed(4);
  return {
    k,
    w,
    h,
    cx,
    cy,
    r,
    lid: `M${f(cx - half)} ${f(cy)}A${f(r)} ${f(r)} 0 0 1 ${f(cx + half)} ${f(cy)}A${f(r)} ${f(r)} 0 0 1 ${f(cx - half)} ${f(cy)}Z`,
  };
}

/**
 * A CSS duration as resolved from a custom property, in ms. The build's CSS minifier rewrites `160ms` as `.16s`,
 * so the unit is read, never assumed (the dev server keeps `160ms`). A bare number is taken as ms.
 */
export function cssMs(raw, fallback) {
  const s = String(raw ?? '').trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  return /\ds$/.test(s) && !/ms$/.test(s) ? n * 1000 : n;
}

/** The groups of the engage, in the order they start. s: the slide, g: the grow, n: the near ring, f: the far ring. */
const ENGAGE_ORDER = ['s', 'g', 'n', 'f'];
const RELEASE_ORDER = ['f', 'n', 'g', 's'];
/** A progress this close to its target counts as arrived. */
const ARRIVED = 0.002;

/**
 * The engage and release delays (SQ-107 pass 11), in ms, for the four groups, from where each group IS now.
 *
 * ENGAGE: the slide starts at 0, the grow when the slide has ended (slide), the near ring a beat (step) after the grow
 * starts, the far ring a beat after that. RELEASE, backwards: the far ring leaves first, the near ring a beat later,
 * a beat after that the eye shrinks, then (when the shrink has ended: grow) it slides back. A delay belongs to the
 * group that is moving ahead of it, so a group that is already at its target does not hold the others back and a
 * group that has moved never waits out a delay that belongs to a group that never started: each group's delay is its
 * place in the nominal sequence minus the place of the first group that still has to move.
 *
 * `now` is each group's progress at this instant (0 at rest, 1 engaged), `dir` is 'in' or 'out'. Returns
 * { s, g, n, f } delays and `h`, the rest iris's hand-over (the end of the grow: its delay plus its length; 0 when
 * the lens circle is already in).
 */
export function eyeDelays(dir, now, { slide = 160, grow = 160, step = 70 } = {}) {
  const engage = dir === 'in';
  const order = engage ? ENGAGE_ORDER : RELEASE_ORDER;
  const nominal = engage
    ? { s: 0, g: slide, n: slide + step, f: slide + 2 * step }
    : { f: 0, n: step, g: 2 * step, s: 2 * step + grow };
  const moves = (k) => (engage ? now[k] < 1 - ARRIVED : now[k] > ARRIVED);
  const first = order.find(moves);
  const out = { s: 0, g: 0, n: 0, f: 0, h: 0 };
  if (!first) return out;
  for (const k of order) out[k] = Math.max(0, nominal[k] - nominal[first]);
  out.h = engage && moves('g') ? out.g + grow : 0;
  return out;
}

const finiteNum = (raw) => {
  if (raw == null || raw === '') return NaN;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
};

/** A dial that is null (the CSS default) when absent or unparseable, else clamped to [lo, hi]. */
const dial = (raw, lo, hi) => {
  const n = finiteNum(raw);
  return Number.isNaN(n) ? null : Math.min(hi, Math.max(lo, n));
};

/**
 * The widget's ?params from a URLSearchParams (anything with .get):
 *   ?schemeui=0       hides the widget
 *   ?schemeguard=<ms> wheel pass-through guard, default 200 (0 = off)
 *   ?schemerows=<n>   the window's rows (centre included): how far the column reaches before the window
 *                     ends, default 6 = three stations each side. The circles SHOWN are two above the
 *                     lens and the one below it (the viewport's edge cuts that one): the sheet fades
 *                     every other one, so the window's edge is never seen
 *   ?schemesize=<px>  swatch diameter; null = the CSS default
 *   ?schemegap=<px>   the edge-to-edge gap between the lens circle and the circle next to it, at EVERY
 *                     width (the row pitch follows it), 0 to 60; null = the CSS default
 *   ?schemelift=<n>   the engaged eye's scale, 1 to 3; null = the CSS default (--eye-engaged)
 *   ?schemenear=<n>   the medium circle (one station from the lens) as a fraction of the large
 *                     one, 0.2 to 1; the CSS never lets it fall under the small one
 *   ?schemefar=<n>    the small circle (two stations out), the same fraction
 *   ?schemein=<ms>    each ring circle's own slide out from behind the centre eye (SQ-116: it was a fade-in; the near and far
 *                     rings, not the whole engage), 0 = instant; null = the CSS default (200)
 *   ?schemeout=<ms>   each ring circle's slide back in behind the centre eye, 0 = instant; null = the CSS default (200)
 *   ?schemeslide=<ms> the engaged eye's slide off the edge, 0 to 600 (160); the release's slide-back is as long
 *   ?schemegrow=<ms>  the eye's grow once the slide has ended, 0 to 600 (160); the release's shrink is as long
 *   ?schemestep=<ms>  the beat between the eye's grow, the near ring and the far ring, 0 to 300 (70);
 *                     0 = the rings start together. The release uses it between far, near and the shrink
 *   ?schemelids=<n>   the lids' scale about the eye's centre, 1 to 1.3 (1.12; 1 = pass 10's lids, the iris's ring
 *                     peeks past them engaged); the eye box and so the badge follow it
 *   ?schemepad=<px>   the badge's padding, the SAME on all four sides of the eye (the badge is the eye
 *                     plus this each side), 0 to 40; null = the CSS default (--badge-pad)
 *   ?schemeclear=<px> the PHONE badge's bottom edge above the viewport's bottom at rest (<= 768px only: it
 *                     lifts the badge clear of the screen's rounded corner), 0 to 120; 0 = today's seat,
 *                     null = the CSS default (--badge-clear)
 *   ?schemeshift=<px> the engaged eye's step LEFT, away from the viewport's right edge (SQ-107 pass 10), at
 *                     /work's stagger taper (1 at the lens, 0.444 one station out, 0.111 two out), 0 to 120;
 *                     0 = a straight column, null = the CSS default (--eye-shift, one rest eye width)
 * Out-of-range values clamp; unparseable ones fall back to the default (null: the CSS owns it).
 */
export function schemeParams(params) {
  const guard = finiteNum(params.get('schemeguard'));
  const rows = finiteNum(params.get('schemerows'));
  const size = finiteNum(params.get('schemesize'));
  return {
    ui: params.get('schemeui') !== '0',
    guardMs: Number.isNaN(guard) ? 200 : Math.max(0, guard),
    rows: Number.isNaN(rows) ? 6 : Math.min(12, Math.max(1, rows)),
    size: Number.isNaN(size) || size <= 0 ? null : Math.max(8, size),
    gap: dial(params.get('schemegap'), 0, 60),
    lift: dial(params.get('schemelift'), 1, 3),
    pad: dial(params.get('schemepad'), 0, 40),
    clear: dial(params.get('schemeclear'), 0, 120),
    shift: dial(params.get('schemeshift'), 0, 120),
    near: dial(params.get('schemenear'), 0.2, 1),
    far: dial(params.get('schemefar'), 0.2, 1),
    inMs: dial(params.get('schemein'), 0, 5000),
    outMs: dial(params.get('schemeout'), 0, 5000),
    slideMs: dial(params.get('schemeslide'), 0, 600),
    growMs: dial(params.get('schemegrow'), 0, 600),
    stepMs: dial(params.get('schemestep'), 0, 300),
    lids: dial(params.get('schemelids'), 1, 1.3),
  };
}
