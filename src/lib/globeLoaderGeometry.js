/**
 * globeLoaderGeometry — the lockup globe as SVG path data, pure functions only
 * (SQ-31). No DOM, no three.js: GlobeLoader.jsx plays what this returns with
 * SMIL, so the rotation costs zero JS per frame.
 *
 * The art is SWM-globe_white.svg (the lockup's O): an opaque sphere tipped
 * toward the viewer, an outline ring, half-meridians that radiate from the
 * pole, parallels that are ellipse arcs. Orthographic projection of the sphere:
 *   point (θ polar from the north pole, φ longitude from the viewer) →
 *   x = sinθ·sinφ, y = cosθ, z = sinθ·cosφ, then pitched by INITIAL_PITCH_DEG
 *   about the x axis (the pole tips toward the camera, as on /process).
 *
 * Hidden-line removal on the opaque sphere needs no clipping tests. Every
 * meridian is ONE visible run from the pole to its limb, where z' = 0:
 *     θ_limb(φ) = atan2(sin p, −cosφ·cos p)
 * Front meridians run long (θ_limb > 90°, down to the rim); back meridians are
 * the short stubs above the pole (θ_limb < 90°). Because a single formula
 * covers both, a meridian that turns from back to front morphs continuously.
 * A parallel is an ellipse (centre Y = cy − R·cosθ·cos p, rx = R·sinθ,
 * ry = R·sinθ·sin p), visible where cosφ ≥ −cotθ·tan p: a closed ellipse for
 * θ ≤ p, otherwise an open arc over the front.
 *
 * FIT (measured against the art, 450-unit viewBox, same as the art's own):
 *   - the art has 9 meridians (40° apart), NOT globeConfig's LON_SEGMENTS 12;
 *     the loader follows the art as asked.
 *   - parallels sit at 29° / 54.5° / 90° / 128° from the pole (the 3D rest
 *     layout's 30/60/90/120 differs on the 2nd and 4th lines);
 *   - sphere r 170.25 about (225.1, 226.65): the meridians and parallels;
 *     the ring is its own circle (the art's ring is not concentric).
 * Pitch and spin come from the shared configs, never copied.
 */
import { INITIAL_PITCH_DEG } from '../components/globe/globeConfig.js';
import { O_SPIN_DPS } from '../components/process/processConfig.js';

export const VIEWBOX = 450;
export const PITCH_DEG = INITIAL_PITCH_DEG;
export const MERIDIANS = 9;
export const STEP_DEG = 360 / MERIDIANS; // one rotation step; the loop repeats this
export const PARALLELS_DEG = Object.freeze([29, 54.5, 90, 128]);
export const SPHERE = Object.freeze({ cx: 225.1, cy: 226.65, r: 170.25 });
export const RING = Object.freeze({ cx: 225.12, cy: 224.6, r: 172.5, w: 11.5 });
export const LINE_W = 6.5;
/** Samples per meridian (pole → limb): fixed so every keyframe shares one command structure. */
export const MERIDIAN_POINTS = 20;
/** Keyframes per rotation step. Linear morph between them stays under ~0.4 units (0.2 px at 240) of the true arc. */
export const STEP_FRAMES = 8;
/** Normalised dash offset that parks a trimmed line fully hidden, round-cap bulge included. */
export const HIDDEN_OFFSET = 1.2;

export const DEFAULT_TIMING = Object.freeze({
  meridianStaggerMs: 90,
  drawMs: 600,
  parallelStaggerMs: 150,
  spin: 1,
});

const rad = (d) => (d * Math.PI) / 180;
const PITCH = rad(PITCH_DEG);
const fix = (n) => {
  const s = n.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
};

/** Orthographic projection of the pitched sphere. z > 0 faces the viewer. */
function project(theta, phi) {
  const x = Math.sin(theta) * Math.sin(phi);
  const y = Math.cos(theta);
  const z = Math.sin(theta) * Math.cos(phi);
  return {
    x: SPHERE.cx + SPHERE.r * x,
    y: SPHERE.cy - SPHERE.r * (y * Math.cos(PITCH) - z * Math.sin(PITCH)),
    z: y * Math.sin(PITCH) + z * Math.cos(PITCH),
  };
}

/** Polar angle (rad) where the meridian at longitude phi crosses the limb. */
export function limbTheta(phiDeg) {
  return Math.atan2(Math.sin(PITCH), -Math.cos(rad(phiDeg)) * Math.cos(PITCH));
}

/** The visible run of the meridian at phiDeg: MERIDIAN_POINTS + 1 points, pole first. */
export function meridianPoints(phiDeg) {
  const phi = rad(phiDeg);
  const lim = limbTheta(phiDeg);
  const pts = [];
  for (let i = 0; i <= MERIDIAN_POINTS; i++) pts.push(project((lim * i) / MERIDIAN_POINTS, phi));
  return pts;
}

export const meridianPath = (phiDeg) =>
  meridianPoints(phiDeg)
    .map((p, i) => `${i ? 'L' : 'M'}${fix(p.x)} ${fix(p.y)}`)
    .join('');

/** Resting longitudes: one meridian faces the viewer, the rest every STEP_DEG. */
export const restLongitudes = () => Array.from({ length: MERIDIANS }, (_, k) => k * STEP_DEG);

/**
 * The d-attribute keyframes for meridian k across ONE rotation step.
 * direction −1 (the /process spin, westward) turns longitude down by STEP_DEG,
 * so the last keyframe is meridian k−1's rest shape: the loop is seamless as a
 * SET of lines, which is all the eye can see (they are identical strokes).
 */
export function meridianKeyframes(k, { frames = STEP_FRAMES, direction = -1 } = {}) {
  const out = [];
  for (let j = 0; j <= frames; j++) out.push(meridianPath(k * STEP_DEG + direction * STEP_DEG * (j / frames)));
  return out;
}

/** Meridian indices in draw order: left to right by the screen centre of each rest run. */
export function meridianDrawOrder() {
  const centre = (k) => {
    const xs = meridianPoints(k * STEP_DEG).map((p) => p.x);
    return (Math.min(...xs) + Math.max(...xs)) / 2;
  };
  return restLongitudes()
    .map((_, k) => k)
    .sort((a, b) => centre(a) - centre(b) || a - b);
}

/** Parallel ellipse numbers for polar angle thetaDeg. */
export function parallelEllipse(thetaDeg) {
  const th = rad(thetaDeg);
  const c = (-Math.tan(PITCH) * Math.cos(th)) / Math.sin(th); // cosφ ≥ c is visible
  return {
    cx: SPHERE.cx,
    cy: SPHERE.cy - SPHERE.r * Math.cos(th) * Math.cos(PITCH),
    rx: SPHERE.r * Math.sin(th),
    ry: SPHERE.r * Math.sin(th) * Math.sin(PITCH),
    closed: c <= -1,
    halfSpan: c <= -1 ? Math.PI : Math.acos(Math.min(1, c)), // visible half-width in φ
  };
}

/** Path for the visible part of a parallel, drawn left → over the front → right. */
export function parallelPath(thetaDeg) {
  const e = parallelEllipse(thetaDeg);
  const rx = fix(e.rx);
  const ry = fix(e.ry);
  if (e.closed) {
    const l = `${fix(e.cx - e.rx)} ${fix(e.cy)}`;
    const r = `${fix(e.cx + e.rx)} ${fix(e.cy)}`;
    return `M${l}A${rx} ${ry} 0 0 0 ${r}A${rx} ${ry} 0 0 0 ${l}`;
  }
  const dx = e.rx * Math.sin(e.halfSpan);
  const y = e.cy + e.ry * Math.cos(e.halfSpan);
  return `M${fix(e.cx - dx)} ${fix(y)}A${rx} ${ry} 0 ${e.halfSpan > Math.PI / 2 ? 1 : 0} 0 ${fix(e.cx + dx)} ${fix(y)}`;
}

/** Parallel indices top to bottom: by the screen Y of each line's front centre. */
export const parallelDrawOrder = () =>
  PARALLELS_DEG.map((_, j) => j).sort(
    (a, b) => frontY(PARALLELS_DEG[a]) - frontY(PARALLELS_DEG[b]) || a - b,
  );
const frontY = (thetaDeg) => project(rad(thetaDeg), 0).y;

/**
 * Timing for one run, in seconds. Meridians draw first (staggered, in draw
 * order), parallels begin once the last meridian has finished and run top to
 * bottom; rotation begins when the last line is in.
 */
export function buildTimeline(timing = {}) {
  const t = { ...DEFAULT_TIMING, ...timing };
  const mStag = Math.max(0, t.meridianStaggerMs) / 1000;
  const pStag = Math.max(0, t.parallelStaggerMs) / 1000;
  const draw = Math.max(0.05, t.drawMs / 1000);
  const mOrder = meridianDrawOrder();
  const pOrder = parallelDrawOrder();
  const meridians = mOrder.map((k, i) => ({ k, begin: i * mStag }));
  const pStart = (mOrder.length - 1) * mStag + draw;
  const parallels = pOrder.map((j, i) => ({ j, begin: pStart + i * pStag }));
  const drawEnd = pStart + (pOrder.length - 1) * pStag + draw;
  const dps = O_SPIN_DPS * Math.max(0, t.spin);
  return {
    draw,
    meridians,
    parallels,
    drawEnd,
    direction: dps > 0 ? 1 : -1,
    stepSeconds: dps === 0 ? 0 : STEP_DEG / Math.abs(dps),
    spinning: dps !== 0,
  };
}

/** The whole static frame as markup-free data: what GlobeLoader renders and the tests read. */
export function restFrame() {
  return {
    ring: RING,
    meridians: restLongitudes().map((phi) => meridianPath(phi)),
    parallels: PARALLELS_DEG.map((th) => parallelPath(th)),
  };
}
