/**
 * directoryTune.js — the Project Directory's tunables (11-03): read from the
 * URL once at mount (DirectoryPage), dialed live on the ?dirtune=1 bench
 * (DirectoryTunePanel). The defaults hold until Nathan names numbers
 * (docs/tunables-guide.md).
 *
 *   ?dirorder      'project' (featured first, in World order) | 'mix' (clients dealt
 *                  round-robin) | 'shuffle' (a new random order every load). The
 *                  default is 'shuffle' when the Studio's directoryShuffle is on
 *                  (siteSettings), else 'project'.
 *   ?dirplayers    videos playing at once (the player gate's cap); 0 = posters only
 *   ?dirdwell      ms a video tile stays half in view before it plays
 *   ?dircols       grid columns above 1024px (Nathan, 11-05: 5)
 *   ?dirtabletcols grid columns from 769 to 1024px (4, so a cell stays 190-260px wide)
 *   ?dirphonecols  grid columns at ≤768px (Nathan, 11-05: 2)
 *   ?dirlogopad    a logo tile's margin, a share of the canvas's height (logoTile.js)
 *   ?dirlogoweight 0 = every mark fills its box … 1 = every mark has the same ink area
 *   ?dirlogoland   the aspect from which a mark takes a landscape canvas, not a square
 *   ?dirlogocenter 0 = centre the mark's box … 1 = centre its centre of mass
 *   ?dirpack       'flush' (three cell classes, chunkFlushGrid) | 'aspect' (each tile its
 *                  own shape, levelled crop-least: aspectGrid.js, SQ-20); 'flush' until
 *                  Nathan bakes 'aspect' after a device pass
 *   ?dirlook       aspect packing's lookahead: the tiles it picks among, and the most
 *                  places one moves from the list order
 *   ?dirtaboverlap px the next filter tab's left side sits under the previous tab's
 *                  diagonal skirt (SQ-21; proposed, Nathan dials it)
 *   ?dirtabfoot    the filter tab's bottom run past its rounded foot, in units of the tab's
 *                  height (SQ-21; proposed, Nathan dials it)
 */
import { DIRECTORY_PLAYERS, DIRECTORY_DWELL_MS } from '../imageConfig.js';
import { LOGO_DIALS } from './logoTile.js';
import { LOOK } from './aspectGrid.js';

/** Bench state ↔ URL params. */
export const PARAM_KEYS = {
  order: 'dirorder',
  players: 'dirplayers',
  dwell: 'dirdwell',
  cols: 'dircols',
  tabletCols: 'dirtabletcols',
  phoneCols: 'dirphonecols',
  logoPad: 'dirlogopad',
  logoWeight: 'dirlogoweight',
  logoLand: 'dirlogoland',
  logoCenter: 'dirlogocenter',
  pack: 'dirpack',
  look: 'dirlook',
  tabOverlap: 'dirtaboverlap',
  tabFoot: 'dirtabfoot',
};

/** The orders ?dirorder takes. */
export const ORDERS = ['project', 'mix', 'shuffle'];

/** The packers ?dirpack takes. */
export const PACKS = ['flush', 'aspect'];

/** The server render and the first client frame (no gate runs yet). */
export const SSR_TUNE = {
  order: 'project',
  players: DIRECTORY_PLAYERS.desktop,
  dwell: DIRECTORY_DWELL_MS,
  cols: 5,
  tabletCols: 4,
  phoneCols: 2,
  logoPad: LOGO_DIALS.pad,
  logoWeight: LOGO_DIALS.weight,
  logoLand: LOGO_DIALS.land,
  logoCenter: LOGO_DIALS.center,
  pack: 'flush',
  look: LOOK,
  tabOverlap: 14,
  tabFoot: 0.5,
};

/** What each numeric knob accepts, from the URL or the bench. */
export const TUNE_OK = {
  players: (n) => Number.isInteger(n) && n >= 0,
  dwell: (n) => n >= 0,
  cols: (n) => Number.isInteger(n) && n >= 1 && n <= 10,
  tabletCols: (n) => Number.isInteger(n) && n >= 1 && n <= 8,
  phoneCols: (n) => n === 1 || n === 2,
  logoPad: (n) => n >= 0 && n <= 0.4,
  logoWeight: (n) => n >= 0 && n <= 1,
  logoLand: (n) => n >= 1,
  logoCenter: (n) => n >= 0 && n <= 1,
  look: (n) => Number.isInteger(n) && n >= 1 && n <= 32,
  tabOverlap: (n) => n >= 0 && n <= 24,
  tabFoot: (n) => n >= 0 && n <= 2,
};

/* The filter tab's shape (SQ-21, Nathan 11-05: "a rounded off folder tab ... the
   right side having more of an obtuse diagonal line that travels to the bottom of
   the tab container, rounding off and following along the bottom edge briefly").
   Measured off his reference icon's stroke centreline, as ratios of the tab's
   height H (top edge to bottom edge, 68px in the reference): a rounded top-left
   corner of 0.375 H, a flat top, a rounded shoulder and a rounded foot of 0.375 H
   each side of a straight diagonal at slope 1.05 (about 46deg, so 134deg to the
   top edge), the run from the shoulder to the foot's end about 1.26 H. All baked
   from the reference; only the bottom run past the foot is a proposal (?dirtabfoot,
   in H). Here H is the stroke centreline's height (the tab's box less its 1px).
   Three SVGs draw the outline, all as tall as the centreline and at the same top, so
   they snap to the same pixel row at any zoom: the left cap (the vertical and the
   rounded corner, TAB_CAP), a stretched straight line (the flat top; a stretch moves
   nothing but its length), and the right-hand skirt (tabSkirt). Each cap and skirt
   is drawn in a box 1000 units high, so a uniform scale keeps every radius round at
   any text size. */
export const TAB_RADIUS = 0.375;
export const TAB_SLOPE = 1.05;

/** How far the skirt's black fill runs past the bottom stroke's centreline (units
    of the 1000-high skirt box, about 1.2px at the 1440 tab): the next tab's
    square-capped line ends at the tab's bottom edge, half a pixel below the
    centreline, and a fill that stops short leaves that end half-covered, so it
    peeks out under the foot. Black on the black panel top, so nothing shows. */
export const TAB_FILL_BELOW = 60;

/** The left cap's viewBox width (its height is 1000) and open stroke: up the left
    side, round the corner and to where the flat top begins. */
export const TAB_CAP_W = TAB_RADIUS * 1000;
export const TAB_CAP = `M0 1000V${TAB_CAP_W}A${TAB_CAP_W} ${TAB_CAP_W} 0 0 1 ${TAB_CAP_W} 0`;

/** The flat top: a straight line in a stretched 100-unit-wide box, 2 units past
    each end so it overlaps the cap and the skirt. */
export const TAB_TOP = 'M-2 0H102';

/** The tab's right-hand skirt for a bottom run of `foot` H: the viewBox width
    (its height is 1000), the open stroke (shoulder, diagonal, foot, bottom run),
    the fill that closes it along the bottom, and the run in H up to the foot's
    end. The stroke starts 20 units left of the label's edge, so the two never
    part at a fractional pixel. */
export function tabSkirt(foot) {
  const k = 1000;
  const r = TAB_RADIUS * k;
  const th = Math.atan(TAB_SLOPE);
  const [sin, cos] = [Math.sin(th), Math.cos(th)];
  const [ax, ay] = [r * sin, r * (1 - cos)];
  const len = (k - 2 * ay) / sin;
  const bx = ax + len * cos;
  const by = ay + len * sin;
  const num = (n) => Number(n.toFixed(2));
  const footX = bx + ax;
  const width = num(footX + foot * k);
  const stroke =
    `M-20 0H0A${r} ${r} 0 0 1 ${num(ax)} ${num(ay)}L${num(bx)} ${num(by)}` +
    `A${r} ${r} 0 0 0 ${num(footX)} ${k}H${width}`;
  return { width, stroke, fill: `${stroke}V${k + TAB_FILL_BELOW}H-20Z`, run: footX / k };
}

/** The defaults on this device: the phone's players cap at ≤768px, the
    globe pool's split (globeConfig.js IS_MOBILE), and the order the Studio's
    directoryShuffle switch picks (`shuffle`, from getDirectoryData). */
export function tuneDefaults(shuffle = false) {
  const phone = window.matchMedia('(max-width: 768px)').matches;
  return {
    ...SSR_TUNE,
    order: shuffle ? 'shuffle' : 'project',
    players: phone ? DIRECTORY_PLAYERS.phone : DIRECTORY_PLAYERS.desktop,
  };
}

/** The URL's values over `defaults`; anything else falls back. */
export function readTune(search, defaults) {
  const params = new URLSearchParams(search);
  const numberAt = (key) => {
    const raw = params.get(PARAM_KEYS[key]);
    const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
    return Number.isFinite(n) && TUNE_OK[key](n) ? n : defaults[key];
  };
  return {
    order: ORDERS.includes(params.get(PARAM_KEYS.order)) ? params.get(PARAM_KEYS.order) : defaults.order,
    players: numberAt('players'),
    dwell: numberAt('dwell'),
    cols: numberAt('cols'),
    tabletCols: numberAt('tabletCols'),
    phoneCols: numberAt('phoneCols'),
    logoPad: numberAt('logoPad'),
    logoWeight: numberAt('logoWeight'),
    logoLand: numberAt('logoLand'),
    logoCenter: numberAt('logoCenter'),
    pack: PACKS.includes(params.get(PARAM_KEYS.pack)) ? params.get(PARAM_KEYS.pack) : defaults.pack,
    look: numberAt('look'),
    tabOverlap: numberAt('tabOverlap'),
    tabFoot: numberAt('tabFoot'),
  };
}

/** The current URL with the bench gate and only the off-default values. */
export function tuneCopyUrl(tune, defaults) {
  const url = new URL(window.location.href);
  url.searchParams.set('dirtune', '1');
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    if (tune[key] === defaults[key]) url.searchParams.delete(param);
    else url.searchParams.set(param, String(tune[key]));
  }
  return url.toString();
}
