/**
 * heroConfig.js — live tuning state for the HOME HERO camera rig, the
 * scroll_to_enter button, the commit transition (chunk 4), the logo→globe
 * intro (chunk 5) and the blob-tracking labels (chunk 6; OFF by default since
 * the pole-cap bake — the HERO_LABELS flag now defaults false).
 *
 * The comp knobs initialize from the URL (the PARAM convention — always on,
 * like Hero's ?introms family and processConfig's TUNING) into the mutable
 * TUNING object. The no-param state is the RESTING COMPOSITION (Nathan's
 * dialed bench comp), not the old centered identity:
 *
 *   desktop  globe huge, off to the right and overflowing top/bottom
 *            (grandeur), camera well below the axis looking up at the
 *            underside; a slight roll tilts the whole framing
 *   mobile   the ring-era contain-fit (whole disc, biased upper ~60%) —
 *            numbers untouched for now; the scroll_to_enter button sits
 *            beneath the tagline as on desktop (the ring is retired)
 *
 * The ?herotune=1 panel (HeroTunePanel) writes TUNING through setHeroTune,
 * which publishes; Hero's rig effect subscribes and stamps the values onto
 * the live scene rig (rigRef.current.rig → apply()) — the framing moves on
 * the next paint, no reload. heroTuneCopyUrl() serializes only non-default
 * values so a dialed comp can be reloaded or shared (fp1Tune convention).
 */
import {
  IS_MOBILE,
  PANEL_CORNER_RADIUS,
  SCROLL_POLE_TIP_LIFT,
  SCROLL_POLE_CORNER_TIP,
  SCROLL_POLE_CORNER_WIDE,
  SCROLL_POLE_CORNER_START,
  SCROLL_POLE_CAP_DEG,
} from '../globe/globeConfig.js';
import { TURN_EASE_PATH } from '../work/world/worldConfig.js';

const search = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

export const HERO_TUNE_ACTIVE = search().get('herotune') === '1';

/* — Globe outer stroke fraction (?globestroke, % → fraction; default 5%,
   0 = off). ONE source of truth, shared by two consumers so they can never
   drift: Hero sizes the stroke disc 1+FRAC proud of the live silhouette, and
   HeroIntro frames the globe 1/(1+FRAC) SMALLER inside the lockup "o" so the
   ringed globe's OUTER edge lands exactly at the glyph — globe + stroke =
   the lockup glyph diameter, not proud of it (Rev-Notes-02 lockup fidelity;
   the added ring must not overshoot the "o"). — */
export const GLOBE_STROKE_FRAC = (() => {
  const n = parseFloat(search().get('globestroke'));
  return (Number.isFinite(n) ? n : 5) / 100;
})();

/* — Commit ease — the envelopment master curve (chunk 4). Starts life as
   the house Turn curve — steep launch that carries the gesture's momentum,
   flat zero-velocity ends, no overshoot — imported as the literal default
   so the two stay in step until the commit earns its own hand-authored
   shape. ?commitease=<path> overrides live for a feel pass
   (author/visualize at gsap.com/docs/v3/Eases/CustomEase). — */
export const HERO_COMMIT_EASE_PATH = search().get('commitease') || TURN_EASE_PATH;

/* — Intro ease — the logo→globe launch curve (chunk 5). Descends from the
   retired loom curve (M0,0 C0.3,0.12 0.38,1 1,1) reshaped for the zoom out
   of the letterform: flatter ends (near-zero velocity at both — the glyph
   holds, the resting comp arrives without overshoot) and a much steeper
   mid, so the scale change reads as one decisive move rather than a drift.
   ?introease=<path> overrides live for a feel pass (author/visualize at
   gsap.com/docs/v3/Eases/CustomEase). — */
export const HERO_INTRO_EASE_PATH =
  search().get('introease') || 'M0,0 C0.36,0.04 0.4,0.96 1,1';

/* — Commit mode vocabulary (URL seed validates against these; the bench
   selects from them). fillMode: how the blue reaches the viewport — through
   the globe's own panels (the cascade surge + a late disc bloom) or as one
   disc-clipped circle. blueCascade: which panel-delay model the panels-mode
   surge rides — cascade.js's variants, same names. — */
export const FILL_MODES = ['panels', 'circle'];
export const BLUE_CASCADES = ['sweep', 'rows', 'poles'];

/* — Labels flag (chunk 6) — the SHIPPED default for the blob-tracking
   label layer. Now FALSE (Nathan's bake): the pole-cap globe ships without
   the chips, so the layer stays unmounted by default (still ?herolabels=1
   turns it on, and the bench toggle flips it live; Hero mounts/unmounts the
   layer off the published value). — */
export const HERO_LABELS = false;

/* — Intro variant vocabulary (chunk 5). ?intro doubles as the MODE force
   (full/replay — Hero reads those) and the variant select: only a|c land
   in TUNING. a = "Typeset, then Ignition" (chars materialize, cascade
   sparks in the letterform, one master zoom out). c = "Flicker Lockup,
   Launch" (CRT flicker on, cascade beat, one diagonal launch). — */
export const INTRO_VARIANTS = ['a', 'c'];

/* — Defaults, by section. The comp block is device/variant-resolved ONCE at
   module load (globeConfig's frozen-breakpoint convention). `fill: null` /
   `fitCover: null` mean "use the device FILL_FRACTION / FIT_COVER from
   globeConfig" — the rig falls back at use-time, so a reset stays honest on
   both breakpoints. SSR sees the desktop shape; nothing reads TUNING until
   the client rig effect runs. Sections landed with their chunks (commit —
   chunk 4, intro — chunk 5, labels — chunk 6) — keep the section comments
   so the table stays legible as it grows. — */
/* Offset signs follow the rig's screen convention (applyRig negates into
   setViewOffset): +offsetX moves the globe RIGHT, +offsetY moves it DOWN.
   So the mobile up-bias — disc in the upper ~60%, clear of the footer
   chrome — is a NEGATIVE offsetY. roll is degrees about the view axis
   (+ tilts the whole comp to the right; 0 = today's untilted framing). */
const COMP_DEFAULTS = IS_MOBILE
  ? // mobile: the ring-era contain-fit numbers, untouched for now — only the
    // CTA changed (ring → the scroll_to_enter button beneath the tagline)
    { fill: 0.95, fitCover: false, offsetX: 0, offsetY: -0.18, elevDeg: 8, roll: 0 }
  : // resting comp — Nathan's dialed desktop bake: globe huge and off-right,
    // near equator-on (low elevation), biased low-right, with the pole-cap globe
    { fill: 1.42, fitCover: null, offsetX: 0.59, offsetY: 0.5, elevDeg: 2.5, roll: 0 };

export const TUNING_DEFAULTS = Object.freeze({
  /* comp — camera rig */
  fill: COMP_DEFAULTS.fill, // ?herofill — globe fill fraction of the fit axis; null = device FILL_FRACTION
  fitCover: COMP_DEFAULTS.fitCover, // ?herofit=contain|cover — fit axis; null = device FIT_COVER
  offsetX: COMP_DEFAULTS.offsetX, // ?herox — view offset, fraction of the half-viewport (−1..1, + = right)
  offsetY: COMP_DEFAULTS.offsetY, // ?heroy — view offset, fraction of the half-viewport (−1..1, + = down)
  elevDeg: COMP_DEFAULTS.elevDeg, // ?heroelev — camera elevation off the equator plane, degrees (orbits, keeps facing center)
  roll: COMP_DEFAULTS.roll, // ?heroroll — camera roll about the view axis, degrees (+ tilts the comp right); 0 = parity
  zoom: 1, // no param — dolly divisor on the fitted distance; gesture-owned (Hero's drag/release/envelop)
  textGap: 40, // ?textgap — px gap between the globe disc's left edge and the tagline/CTA column (clearance); 40 = Nathan's bake

  /* commit — the envelopment master timeline (chunk 4; Hero reads these at
     commit time, so the bench moves the NEXT commit/dry-run, not a live one) */
  commitMs: 2000, // ?commitms — master timeline length, ms (ONE clock; every beat keys off its eased e)
  fillMode: 'panels', // ?fillmode — panels | circle (FILL_MODES above)
  blueCascade: 'poles', // ?bluecascade — panels-mode delay model (BLUE_CASCADES above)
  blueLead: 0.4, // ?bluelead — raw progress by which the panel-blue has painted the globe; the camera recenter/zoom lead OUT of it (note 4: blue first, then dive in)
  /* recenterEnd/zoomStart shape ONE motion (rev-notes-03): the zoom launches
     just after the recenter is underway and the two overlap for most of the
     dive — center+zoom read as a single gesture, the dolly lagging slightly
     behind the centering (was recenterEnd 1 / zoomStart 0.9: center fully,
     THEN zoom in the last 10% — the reported disjoint/delay). */
  recenterEnd: 0.65, // ?recenterend — e where the recenter (offsets/elev → 0) completes
  zoomStart: 0.2, // ?zoomstart — e where the dolly to ?envscale begins

  /* globe — the meridian-scroll pace (MeridianScroll reads at build; the bench
     moves the NEXT mount unless wired live). The globe holds its brand tilt;
     cascadeSpeed sets how fast the ROWS OF TILES travel pole-to-pole (scroll
     rate ∝ speed / SCROLL_PACE_SCALE) — also the video-load knob (faster = more
     thumbnail/video churn). 0 parks the scroll. */
  cascadeSpeed: 2.5, // ?cascadespeed — meridian-scroll pace (note 6). LIVE via the bench (setCascadeSpeed). 2.5 = Nathan's bake.

  /* globe · pole cap + corner rounding — the near-pole "height-eat" treatment
     (panelMaterial). The bench pushes these to the scene api (setPoleTuning),
     which writes every panel's uniforms live. Defaults are the baked globeConfig
     values, so an untouched bench serializes nothing. Home globe only. */
  poleLift: SCROLL_POLE_TIP_LIFT, // ?polelift — bottom fraction dissolved to blue AT the pole (terminate-short amount; ≤0.25 stays on-tile)
  poleTip: SCROLL_POLE_CORNER_TIP, // ?poletip — bottom-cap HORIZONTAL radius at the pole (round nose; ≤0.5)
  poleWide: SCROLL_POLE_CORNER_WIDE, // ?polewide — away-end + wall radius at the pole (≈ base)
  poleStart: SCROLL_POLE_CORNER_START, // ?polestart — sin(θ) below which the pole cap ramps in
  cornerR: PANEL_CORNER_RADIUS, // ?corner — base rounded-tile radius (all tiles; <0.5)
  poleCapDeg: SCROLL_POLE_CAP_DEG, // ?polecap — persistent blue cap over each pole, angular radius° (0 = off)

  /* globe · orientation — the brand tilt + spin, applied live in the render
     tick (setGlobeOrientation). tilt defaults to the brand INITIAL_PITCH; yaw
     is an absolute spin offset. Both 0-offset at default → parity. */
  tiltDeg: 45.5, // ?herotilt — brand tilt (camera-facing pole lean), degrees; 45.5 = Nathan's bake (tick applies tiltDeg − INITIAL_PITCH as the offset, so /lab stays at INITIAL_PITCH)
  yawDeg: 0, // ?heroyaw — static globe spin about its axis, degrees
  yawSpeed: -1.5, // ?yawspeed — steady auto-rotation about the axis, degrees/second (0 = fixed); −1.5 = Nathan's bake (slow reverse drift)

  /* intro — the logo→globe intro (chunk 5; HeroIntro reads these at mount,
     so the bench shapes the NEXT intro — use ↻ replay intro to see it).
     The timing knobs drive variant A's script (chars-in is a fixed 0.9s;
     the zoom fills the remainder of introMs); variant C keeps its own
     authored ~3.2s script. */
  intro: 'a', // ?intro — a | c (INTRO_VARIANTS; full/replay force the mode instead)
  introMs: 4700, // ?introms — variant A total length, ms
  introHoldMs: 400, // ?introhold — A2 hold after the chars land, ms
  introCascadeMs: 900, // ?introcascadeat — when the glyph-scale cascade fires, ms
  heroInk: false, // ?heroink — 1|0: gap-lattice ink white → blue across the launch

  /* labels — blob-tracking chips on the LIVE panels (chunk 6; HeroLabels
     reads max at mount — Hero re-keys the layer on a change — and hold at
     each cycle) */
  labels: HERO_LABELS, // ?herolabels — 1|0: mount the label layer (shipped ON)
  labelMax: IS_MOBILE ? 1 : 6, // ?labelmax — concurrent chips
  labelHold: 4.8, // ?labelhold — seconds a chip holds before re-slotting
  labelStroke: 48, // ?labelstroke — chip offset / leader-line length from its panel anchor, px (note 3)
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
  roll: 'heroroll',
  textGap: 'textgap',
  /* commit */
  commitMs: 'commitms',
  blueLead: 'bluelead',
  recenterEnd: 'recenterend',
  zoomStart: 'zoomstart',
  /* globe */
  cascadeSpeed: 'cascadespeed',
  poleLift: 'polelift',
  poleTip: 'poletip',
  poleWide: 'polewide',
  poleStart: 'polestart',
  cornerR: 'corner',
  poleCapDeg: 'polecap',
  tiltDeg: 'herotilt',
  yawDeg: 'heroyaw',
  yawSpeed: 'yawspeed',
  /* intro */
  introMs: 'introms',
  introHoldMs: 'introhold',
  introCascadeMs: 'introcascadeat',
  /* labels */
  labelMax: 'labelmax',
  labelHold: 'labelhold',
  labelStroke: 'labelstroke',
};
const FIT_PARAM = 'herofit'; // contain | cover; anything else = device
/* Commit string knobs — validated against the vocabulary lists (a typo
   falls back to the default, the FIT_PARAM convention). The ease paths
   (?commitease ?introease) stay URL-only: CustomEase is created once per
   commit/intro run. */
const FILL_MODE_PARAM = 'fillmode';
const BLUE_CASCADE_PARAM = 'bluecascade';
/* Intro non-numeric knobs — ?intro carries the variant (a|c only; the
   full/replay mode forces pass through to Hero untouched) and ?heroink is
   a boolean (1|0). */
const INTRO_PARAM = 'intro';
const HERO_INK_PARAM = 'heroink';
/* Labels flag — boolean like ?heroink (1|0); the numeric knobs ride
   PARAM_KEYS. */
const LABELS_PARAM = 'herolabels';

// Live, mutable tuning state (panel writes, Hero's rig effect reads).
export const TUNING = { ...TUNING_DEFAULTS };

// Seed from the URL — always, not just under ?herotune (the hero's knob
// convention: ?herofill=0.9 works standalone like ?introms). A copied tuning
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
  const fm = p.get(FILL_MODE_PARAM);
  if (FILL_MODES.includes(fm)) TUNING.fillMode = fm;
  const bc = p.get(BLUE_CASCADE_PARAM);
  if (BLUE_CASCADES.includes(bc)) TUNING.blueCascade = bc;
  const iv = p.get(INTRO_PARAM);
  if (INTRO_VARIANTS.includes(iv)) TUNING.intro = iv;
  const ink = p.get(HERO_INK_PARAM);
  if (ink === '0') TUNING.heroInk = false;
  else if (ink === '1') TUNING.heroInk = true;
  const lb = p.get(LABELS_PARAM);
  if (lb === '1') TUNING.labels = true;
  else if (lb === '0') TUNING.labels = false;
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
  // Commit string knobs — serialized only off-default, same convention.
  if (TUNING.fillMode !== TUNING_DEFAULTS.fillMode) p.set(FILL_MODE_PARAM, TUNING.fillMode);
  else p.delete(FILL_MODE_PARAM);
  if (TUNING.blueCascade !== TUNING_DEFAULTS.blueCascade) {
    p.set(BLUE_CASCADE_PARAM, TUNING.blueCascade);
  } else {
    p.delete(BLUE_CASCADE_PARAM);
  }
  // Intro variant — off-default only. Note the side effect is intentional:
  // intro=c on a copied URL also forces the full intro to PLAY (Hero's mode
  // read), which is exactly what sharing a dialed intro comp wants. A typed
  // full/replay mode force is dropped when the variant is default — copy_url
  // serializes the tuned comp, not the session's mode.
  if (TUNING.intro !== TUNING_DEFAULTS.intro) p.set(INTRO_PARAM, TUNING.intro);
  else p.delete(INTRO_PARAM);
  if (TUNING.heroInk !== TUNING_DEFAULTS.heroInk) {
    p.set(HERO_INK_PARAM, TUNING.heroInk ? '1' : '0');
  } else {
    p.delete(HERO_INK_PARAM);
  }
  // Labels flag — same boolean convention (off is the shipped default, so
  // a dialed labels comp serializes herolabels=1).
  if (TUNING.labels !== TUNING_DEFAULTS.labels) {
    p.set(LABELS_PARAM, TUNING.labels ? '1' : '0');
  } else {
    p.delete(LABELS_PARAM);
  }
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
