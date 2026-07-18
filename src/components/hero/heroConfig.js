/**
 * heroConfig.js — live tuning state for the HOME HERO camera rig and the
 * scroll_to_enter ring (later chunks add the intro/commit/label choreography).
 *
 * The comp knobs initialize from the URL (the PARAM convention — always on,
 * like Hero's ?loomms family and processConfig's TUNING) into the mutable
 * TUNING object. Since chunk 3 the no-param state is the RESTING COMPOSITION
 * (Nathan's approved comp), not the old centered identity:
 *
 *   desktop            globe center ~72–78% vw, overflowing top/bottom
 *                      (grandeur), camera below the axis looking up
 *   mobile ?ringmobile=1  (DEFAULT) ring-friendly contain-fit — the whole
 *                      disc visible, biased to the upper ~60%, ring around it
 *   mobile ?ringmobile=0  the approved overscan (device fill/fit, centered)
 *                      with the micro CTA instead of the ring
 *
 * The ?herotune=1 panel (HeroTunePanel) writes TUNING through setHeroTune,
 * which publishes; Hero's rig effect subscribes and stamps the values onto
 * the live scene rig (rigRef.current.rig → apply()) — the framing moves on
 * the next paint, no reload. The ring knobs are read live by ScrollRing's
 * frame callback, so they move the same way. heroTuneCopyUrl() serializes
 * only non-default values so a dialed comp can be reloaded or shared
 * (fp1Tune convention).
 */
import { IS_MOBILE } from '../globe/globeConfig.js';

const search = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const HERO_TUNE_ACTIVE = search().get('herotune') === '1';

/* — Mobile ring variant flag — ?ringmobile=1 (default) keeps the circular
   ring CTA on phones over a contain-fit globe; =0 restores the approved
   overscan comp with the bottom micro CTA. Desktop always rings. — */
export const RING_MOBILE = search().get('ringmobile') !== '0';

/* — Ring copy — the repeating CTA text; ?ringtext swaps the label for a
   feel pass. The separator glyph sits between repeats. — */
export const RING_TEXT = search().get('ringtext') || 'scroll_to_enter';
export const RING_SEPARATOR = '✳';

/* — Defaults, by section. The comp block is device/variant-resolved ONCE at
   module load (globeConfig's frozen-breakpoint convention). `fill: null` /
   `fitCover: null` mean "use the device FILL_FRACTION / FIT_COVER from
   globeConfig" — the rig falls back at use-time, so a reset stays honest on
   both breakpoints. SSR sees the desktop shape; nothing reads TUNING until
   the client rig effect runs. Later chunks append sections here (intro /
   commit / label) — keep the section comments so the table stays legible as
   it grows. — */
/* Offset signs follow the rig's screen convention (applyRig negates into
   setViewOffset): +offsetX moves the globe RIGHT, +offsetY moves it DOWN.
   So the mobile up-bias — disc in the upper ~60%, ring clear of the footer
   chrome — is a NEGATIVE offsetY. */
const COMP_DEFAULTS = IS_MOBILE
  ? RING_MOBILE
    ? // ring-friendly: whole disc visible on a cover-fit device, biased to
      // the upper ~60% of the viewport so the ring clears the chrome below
      { fill: 0.95, fitCover: false, offsetX: 0, offsetY: -0.18, elevDeg: 8 }
    : // approved overscan — the device framing, untouched
      { fill: null, fitCover: null, offsetX: 0, offsetY: 0, elevDeg: 0 }
  : // resting comp: center ~72–78% vw, overflow top/bottom, low camera
    { fill: 1.25, fitCover: null, offsetX: 0.55, offsetY: -0.06, elevDeg: 12 };

export const TUNING_DEFAULTS = Object.freeze({
  /* comp — camera rig */
  fill: COMP_DEFAULTS.fill, // ?herofill — globe fill fraction of the fit axis; null = device FILL_FRACTION
  fitCover: COMP_DEFAULTS.fitCover, // ?herofit=contain|cover — fit axis; null = device FIT_COVER
  offsetX: COMP_DEFAULTS.offsetX, // ?herox — view offset, fraction of the half-viewport (−1..1, + = right)
  offsetY: COMP_DEFAULTS.offsetY, // ?heroy — view offset, fraction of the half-viewport (−1..1, + = down)
  elevDeg: COMP_DEFAULTS.elevDeg, // ?heroelev — camera elevation off the equator plane, degrees (orbits, keeps facing center)
  zoom: 1, // no param — dolly divisor on the fitted distance; gesture-owned (Hero's drag/release/envelop)

  /* ring — the scroll_to_enter ring (ScrollRing reads these live per frame) */
  ringR: 1.12, // ?ringr — ring radius as a multiple of the globe disc radius
  ringSpeed: 4, // ?ringspeed — ambient rotation, deg/s (drag fill scales it up to ~3×)
  ringLean: 0.08, // ?ringlean — extra ring radius at full drag fill
});

/* URL param names for seed-on-load / copy_url, by section — NUMERIC knobs
   only; fitCover rides ?herofit=contain|cover (handled specially below).
   zoom is absent on purpose: it belongs to the scroll gesture, never to a
   URL. */
const PARAM_KEYS = {
  /* comp */
  fill: 'herofill',
  offsetX: 'herox',
  offsetY: 'heroy',
  elevDeg: 'heroelev',
  /* ring */
  ringR: 'ringr',
  ringSpeed: 'ringspeed',
  ringLean: 'ringlean',
};
const FIT_PARAM = 'herofit'; // contain | cover; anything else = device

// Live, mutable tuning state (panel writes, Hero's rig effect reads).
export const TUNING = { ...TUNING_DEFAULTS };

// Seed from the URL — always, not just under ?herotune (the hero's knob
// convention: ?herofill=0.9 works standalone like ?loomms). A copied tuning
// link reopens the panel in the same shape AND frames the very first paint.
if (typeof window !== 'undefined') {
  const p = search();
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const raw = p.get(param);
    if (raw == null) continue;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    // fill must be positive — sin(atan(0)) puts the camera at infinity.
    if (key === 'fill' && n <= 0) continue;
    TUNING[key] = n;
  }
  const fit = p.get(FIT_PARAM);
  if (fit === 'contain') TUNING.fitCover = false;
  else if (fit === 'cover') TUNING.fitCover = true;
}

/* pub/sub — Hero's rig effect subscribes to re-apply on any panel change. */
const subs = new Set();
export function subscribeHeroTune(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function publish() {
  subs.forEach((fn) => fn());
}

export function setHeroTune(key, value) {
  if (TUNING[key] === value) return;
  TUNING[key] = value;
  publish();
}
export function resetHeroTune() {
  Object.assign(TUNING, TUNING_DEFAULTS);
  publish();
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

/** Shareable tuning URL — herotune=1 plus only the params that differ from default. */
export function heroTuneCopyUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('herotune', '1');
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const val = TUNING[key];
    const def = TUNING_DEFAULTS[key];
    // null-aware diff: fill's default can be null (device FILL_FRACTION).
    const differs = val == null || def == null ? val !== def : Math.abs(val - def) > 1e-9;
    if (differs && val != null) {
      p.set(param, String(round4(val)));
    } else {
      p.delete(param);
    }
  }
  // fitCover is tri-state (null = device) and non-numeric — herofit only
  // when it differs from this device/variant's default.
  if (TUNING.fitCover !== TUNING_DEFAULTS.fitCover && TUNING.fitCover != null) {
    p.set(FIT_PARAM, TUNING.fitCover ? 'cover' : 'contain');
  } else {
    p.delete(FIT_PARAM);
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
