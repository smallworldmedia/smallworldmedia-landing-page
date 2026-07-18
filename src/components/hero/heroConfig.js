/**
 * heroConfig.js — live tuning state for the HOME HERO camera rig (and, in
 * later chunks, the intro/ring/commit/label choreography).
 *
 * The comp knobs initialize from the URL (the PARAM convention — always on,
 * like Hero's ?loomms family and processConfig's TUNING) into the mutable
 * TUNING object. With no params every value is its identity default, so the
 * shipped hero renders pixel-identical whether or not this module loads.
 *
 * The ?herotune=1 panel (HeroTunePanel) writes TUNING through setHeroTune,
 * which publishes; Hero's rig effect subscribes and stamps the values onto
 * the live scene rig (rigRef.current.rig → apply()) — the framing moves on
 * the next paint, no reload. heroTuneCopyUrl() serializes only non-default
 * values so a dialed comp can be reloaded or shared (fp1Tune convention).
 */

export const HERO_TUNE_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('herotune') === '1';

/* — Defaults, by section. All identity: the rig reproduces today's framing
   exactly until a knob moves. `fill: null` means "use the device
   FILL_FRACTION from globeConfig" (desktop .85 / mobile 1.22) — the rig
   falls back at use-time, so one tuning URL stays honest on both
   breakpoints. Later chunks append sections here (intro / ring / commit /
   label) — keep the section comments so the table stays legible as it
   grows. — */
export const TUNING_DEFAULTS = Object.freeze({
  /* comp — camera rig */
  fill: null, // ?herofill — globe fill fraction of the fit axis; null = device FILL_FRACTION
  offsetX: 0, // ?herox — view offset, fraction of the half-viewport (−1..1)
  offsetY: 0, // ?heroy — view offset, fraction of the half-viewport (−1..1)
  elevDeg: 0, // ?heroelev — camera elevation off the equator plane, degrees (orbits, keeps facing center)
  zoom: 1, // no param — dolly divisor on the fitted distance; gesture-driven in a later chunk
});

/* URL param names for seed-on-load / copy_url, by section. zoom is absent
   on purpose: it belongs to the scroll gesture (later chunk), never to a
   URL. */
const PARAM_KEYS = {
  /* comp */
  fill: 'herofill',
  offsetX: 'herox',
  offsetY: 'heroy',
  elevDeg: 'heroelev',
};

// Live, mutable tuning state (panel writes, Hero's rig effect reads).
export const TUNING = { ...TUNING_DEFAULTS };

// Seed from the URL — always, not just under ?herotune (the hero's knob
// convention: ?herofill=0.9 works standalone like ?loomms). A copied tuning
// link reopens the panel in the same shape AND frames the very first paint.
if (typeof window !== 'undefined') {
  const p = new URLSearchParams(window.location.search);
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const raw = p.get(param);
    if (raw == null) continue;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    // fill must be positive — sin(atan(0)) puts the camera at infinity.
    if (key === 'fill' && n <= 0) continue;
    TUNING[key] = n;
  }
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
    // null-aware diff: fill's default is null (device FILL_FRACTION).
    const differs = val == null || def == null ? val !== def : Math.abs(val - def) > 1e-9;
    if (differs && val != null) {
      p.set(param, String(round4(val)));
    } else {
      p.delete(param);
    }
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
