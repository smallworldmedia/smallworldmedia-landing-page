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
 */
import { DIRECTORY_PLAYERS, DIRECTORY_DWELL_MS } from '../imageConfig.js';
import { LOGO_DIALS } from './logoTile.js';

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
};

/** The orders ?dirorder takes. */
export const ORDERS = ['project', 'mix', 'shuffle'];

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
};

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
