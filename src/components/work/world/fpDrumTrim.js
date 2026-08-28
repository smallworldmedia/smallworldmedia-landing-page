/**
 * fpDrumTrim.js — the DRUM's print-shop trim (08-27): three toggleable
 * creative elements that dress the lattice between media plates.
 *
 *   ?fpglow=1  CENTER RIPPLE — grid panels illuminate in the project color as
 *              a ripple emanating from the view center, each launch synced to
 *              the house-pulse cadence (reinforcing the enter_world CTA).
 *              Ripple bench (08-27 (2), Nathan's pick): ?ripvar animation
 *              variation (1 pulse ring / 2 wavetrain / 3 droplet), ?ripshade
 *              flat-fill vs bevel-inset cell shading, ?ripspeed ?ripfall
 *              ?riprad ?ripw. All shader-side: one window-sized sector whose
 *              fragment quantizes to the fine cell lattice, so whole panels
 *              light flat, filling to the grid lines.
 *   ?fpglow=2  POINTER TRACE — the panels the cursor passes over illuminate
 *              and decay. The mouse ray is corrected through the lens pass
 *              (forward-applying the pincushion's backward map) and dropped
 *              into drum-body space, so the lit cell is the cell UNDER the
 *              warped cursor, and the trace stays on its cells as the drum
 *              rolls (trail points live in body-local angles).
 *   ?fptab=1   SPINE TABS — a small accent tab stamped on each plate's
 *              bottom-left corner, mono cell-coordinates rotated −90°
 *              (the letterpress plate-label; built by fpDrum via makeTabTexture).
 *   ?fpfurn=1  FURNITURE — FORME's empty-cell furniture riding the drum:
 *              seeded registration crosses, coordinate captions, and
 *              whisper-alpha cell floods on cells no block claims.
 *
 * Glow + furniture register as slot.bands records ({ group, appear, qSpawn,
 * paint(opacity), dispose() }) so the Turn's clearSlot tears them down.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { hashSeed, mulberry32 } from './seededLayout.js';
import {
  D_LON,
  D_LAT,
  VIEW_LAT,
  angularWindow,
  blockSectorGeometry,
  sph,
} from './fpGridCells.js';
import { plateCover } from './fpAtlas.js';
import {
  SHELL_RADIUS,
  CAMERA_FOV,
  FPGLOW_ALPHA,
  RIPPLE_VAR,
  RIPPLE_SHADE,
  RIPPLE_EVERY,
  RIPPLE_SPEED,
  RIPPLE_FALLOFF,
  RIPPLE_RADIUS,
  RIPPLE_WIDTH,
  RIPPLE_ALPHA,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';
import { HOUSE_PULSE_PERIOD_S } from '../../../lib/motion.js';

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const IDENTITY_Q = new THREE.Quaternion();

/* Glow panels sit just BEYOND the shell (camera inside: farther), under the
   lattice lines — cells light up beneath the grid. renderOrder < shell(30). */
const GLOW_R_OUT = 0.35;
const ORDER_GLOW = 28;

const num2hex = (n) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`;

/** YIQ ink flip for a THREE-land hex NUMBER (projectColor.js twin). */
export function inkForAccent(accent) {
  const r = (accent >> 16) & 255;
  const g = (accent >> 8) & 255;
  const b = accent & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? '#0a0a0a' : '#ffffff';
}

/* ────────────────────────────── SPINE TABS ────────────────────────────── */

/**
 * Canvas texture for a plate's spine tab: accent (project color token)
 * flood, the asset's Sanity title in mono rotated −90° (reads bottom-up, the
 * book-spine direction). Thin spine aspect (1:5) — the tab block is sized to
 * match. Ink follows the nav YIQ rule (inkForAccent).
 */
export const TAB_TEX_W = 64;
export const TAB_TEX_H = 320;
export function makeTabTexture(text, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = TAB_TEX_W;
  canvas.height = TAB_TEX_H;
  const c = canvas.getContext('2d');
  c.fillStyle = num2hex(accent);
  c.fillRect(0, 0, TAB_TEX_W, TAB_TEX_H);
  c.save();
  c.translate(TAB_TEX_W / 2, TAB_TEX_H / 2);
  c.rotate(-Math.PI / 2);
  const label = String(text ?? '').toUpperCase();
  const shown = label.length > 18 ? `${label.slice(0, 17)}…` : label;
  c.font = '500 26px "SFMono-Regular", Menlo, Consolas, monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = inkForAccent(accent);
  c.fillText(shown, 0, 0);
  c.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ──────────────────────────── GRID GLOW ──────────────────────────── */

const GLOW_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/* Fragment quantizes body-local lon/lat to the fine cell lattice, so a whole
   panel carries one intensity (flat, per-cell — never a soft wash). Shading
   toggle (?ripshade): 0 = FLAT fill to the grid lines (the lines draw over
   the glow at order 30 > 28, so the fill meets them exactly); 1 = hairline
   inset (the soft bevel read). Mode 1 = the ripple bench (?ripvar 1|2|3),
   mode 2 = gaussian splats at the pointer-trail points. */
const GLOW_FRAG = /* glsl */ `
  #define TAU 6.28318530718
  #define PI 3.14159265359
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uAlpha;
  uniform float uAge[8];
  uniform int uLaunchN;
  uniform float uSpeed;
  uniform float uFall;
  uniform float uRadMax;
  uniform float uRipW;
  uniform float uVar;
  uniform float uShade;
  uniform float uDLon;
  uniform float uDLat;
  uniform float uViewLat;
  uniform float uArcLon;
  uniform float uMode;
  uniform int uTrailN;
  uniform vec3 uTrail[12];
  varying vec3 vPos;
  float wrapPi(float a) { return mod(a + PI, TAU) - PI; }
  void main() {
    vec3 p = normalize(vPos);
    float lat = acos(clamp(p.y, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    float cLat = (floor(lat / uDLat) + 0.5) * uDLat;
    float cLon = (floor(lon / uDLon) + 0.5) * uDLon;
    float I = 0.0;
    if (uMode < 1.5) {
      float sx = cLat - uViewLat;
      float sy = wrapPi(cLon - uArcLon) * sin(cLat);
      float r = length(vec2(sx, sy));
      if (r <= uRadMax) {
        // Every live launch is INDEPENDENT — a new ripple firing never resets
        // the ones still traveling (uAge = seconds since each launch; the CPU
        // prunes a launch only once its whole trail has left the frame).
        for (int i = 0; i < 8; i++) {
          if (i >= uLaunchN) break;
          float front = uAge[i] * uSpeed;
          if (uVar < 1.5) {
            // 1 — pulse ring: one crest, fading as it travels.
            float d = (r - front) / uRipW;
            I += exp(-d * d) * (1.0 - 0.55 * clamp(front / uRadMax, 0.0, 1.0));
          } else if (uVar < 2.5) {
            // 2 — wavetrain: identical crests, no travel fade.
            float d = (r - front) / uRipW;
            I += exp(-d * d);
          } else {
            // 3 — droplet: crisp front, damped trailing crests behind it.
            float back = front - r;
            if (back >= 0.0) {
              float lambda = uRipW * 4.0;
              I += max(0.0, sin(TAU * back / lambda)) * exp(-back / (lambda * 1.6));
            }
          }
        }
        I *= exp(-r / uFall);
        I = min(I, 1.0);
      }
    } else {
      for (int i = 0; i < 12; i++) {
        if (i >= uTrailN) break;
        vec3 t = uTrail[i];
        float dx = cLat - t.x;
        float dy = wrapPi(cLon - t.y) * sin(cLat);
        float d2 = dx * dx + dy * dy;
        I += exp(-d2 / (2.0 * uRipW * uRipW)) * (1.0 - t.z);
      }
      I = min(I, 1.0);
    }
    float inset = 1.0;
    if (uShade > 0.5) {
      vec2 f = vec2(fract(lon / uDLon), fract(lat / uDLat));
      vec2 e = min(f, 1.0 - f);
      inset = smoothstep(0.0, 0.12, min(e.x, e.y));
    }
    gl_FragColor = vec4(uColor, I * inset * uAlpha * uOpacity);
  }
`;

const TRAIL_MAX = 12;
const TRAIL_FADE_S = 1.6; // trace decay
const _m4 = new THREE.Matrix4();
const _dir = new THREE.Vector3();

/**
 * The glow layer for one arc. mode 1 = center pulse, 2 = pointer trace.
 * ctx: { arcLon, aspect, accent, drum, lensPass, pointer, parent, ease }
 */
export function createDrumGlow(mode, { arcLon, aspect, accent, drum, lensPass, pointer, parent, ease }) {
  const win = angularWindow(aspect);
  // Whole-cell window block (screen-x = lat via halfLon, screen-y = lon via halfLat).
  const j1 = Math.ceil((VIEW_LAT - win.halfLon) / D_LAT);
  const j2 = Math.floor((VIEW_LAT + win.halfLon) / D_LAT);
  const i1 = Math.ceil((arcLon - win.halfLat) / D_LON);
  const i2 = Math.floor((arcLon + win.halfLat) / D_LON);
  const block = {
    lon1: i1 * D_LON,
    lon2: i2 * D_LON,
    lat1: j1 * D_LAT,
    lat2: j2 * D_LAT,
    lonCells: i2 - i1,
    latCells: j2 - j1,
  };
  const geometry = blockSectorGeometry(block, SHELL_RADIUS + GLOW_R_OUT);

  // Ripple frame: the capped radius (?riprad × the window half-diagonal)
  // anchors speed/falloff, so those knobs read in composition terms, not
  // radians.
  const radMax = Math.hypot(win.halfLon, win.halfLat) * RIPPLE_RADIUS;
  const uniforms = {
    uColor: { value: new THREE.Color(accent) },
    uOpacity: { value: 0 },
    // Ripple peaks at ?ripalpha (default = the grid lines' own opacity);
    // the trace keeps its harder ?fpglowa×3 basis — few cells lit at once.
    uAlpha: { value: mode === 2 ? Math.min(0.55, FPGLOW_ALPHA * 3) : RIPPLE_ALPHA },
    uAge: { value: new Array(8).fill(0) },
    uLaunchN: { value: 0 },
    uSpeed: { value: RIPPLE_SPEED * radMax },
    uFall: { value: RIPPLE_FALLOFF * radMax },
    uRadMax: { value: radMax },
    uRipW: { value: mode === 2 ? D_LAT * 3.2 : RIPPLE_WIDTH * D_LAT },
    uVar: { value: RIPPLE_VAR },
    uShade: { value: RIPPLE_SHADE },
    uDLon: { value: D_LON },
    uDLat: { value: D_LAT },
    uViewLat: { value: VIEW_LAT },
    uArcLon: { value: arcLon },
    uMode: { value: mode },
    uTrailN: { value: 0 },
    uTrail: { value: Array.from({ length: TRAIL_MAX }, () => new THREE.Vector3()) },
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = ORDER_GLOW;
  const group = new THREE.Group();
  group.add(mesh);
  parent.add(group);

  // Mode 1: launch bookkeeping lives in paint(). A new ripple fires every
  // HOUSE_PULSE_PERIOD_S (the enter_world cadence) as an INDEPENDENT launch;
  // each keeps traveling until its whole trail leaves the frame — at slow
  // ?ripspeed several are alive at once (capped at the shader's 8).
  let lastNow = performance.now();
  const launches = [0]; // seconds since each live launch; first fires on build
  let launchTimer = 0;
  // How far behind the front a variation's trail stays visible: droplet
  // crests decay over ~5λ (λ = uRipW·4); the ring variants over ~3 widths.
  const trailReach = uniforms.uRipW.value * (RIPPLE_VAR >= 3 ? 20 : 3);

  // Mode 2: trail of body-local cell hits (lat, lon, age01).
  const trail = []; // { lat, lon, t }
  const tanF = Math.tan((CAMERA_FOV * DEG2RAD) / 2);
  let lastHit = null;
  const sampleCursor = () => {
    if (!pointer || !lensPass || !drum) return;
    // Display NDC (pointer.target.y is +down — flip to y-up).
    const nx = pointer.target.x;
    const ny = -pointer.target.y;
    const r2 = nx * nx + ny * ny;
    // Forward-apply the lens's backward map: the scene NDC the display pixel
    // samples from (q = (1 + K0·r²)·ndc, component-wise, live coefficients).
    const qx = (1 + lensPass.distortion.x * r2) * nx;
    const qy = (1 + lensPass.distortion.y * r2) * ny;
    // Camera at origin looking down −Z (DRUM never rotates the camera).
    _dir.set(qx * tanF * (aspect || 1), qy * tanF, -1).normalize();
    drum.body.updateWorldMatrix(true, false);
    _m4.copy(drum.body.matrixWorld).invert();
    _dir.transformDirection(_m4);
    const lat = Math.acos(Math.min(1, Math.max(-1, _dir.y)));
    let lon = Math.atan2(_dir.z, _dir.x);
    if (lon < 0) lon += TAU;
    // Quantize to the cell center — the panel is the unit of illumination.
    const cLat = (Math.floor(lat / D_LAT) + 0.5) * D_LAT;
    const cLon = (Math.floor(lon / D_LON) + 0.5) * D_LON;
    if (lastHit && Math.abs(cLat - lastHit.lat) < 1e-6 && Math.abs(cLon - lastHit.lon) < 1e-6)
      return;
    lastHit = { lat: cLat, lon: cLon };
    trail.push({ lat: cLat, lon: cLon, t: performance.now() });
    if (trail.length > TRAIL_MAX) trail.shift();
  };

  const record = {
    group,
    appear: 0,
    qSpawn: IDENTITY_Q.clone(),
    paint(opacity) {
      uniforms.uOpacity.value = opacity;
      const now = performance.now();
      const dt = Math.min(now - lastNow, 100) / 1000; // tab-return clamp
      lastNow = now;
      if (mode === 1 && !PREFERS_REDUCED_MOTION) {
        // ?ripevery: launches fire every N house periods (2 = every other
        // enter_world pulse) — still on the pulse grid, just sparser.
        const cadence = HOUSE_PULSE_PERIOD_S * RIPPLE_EVERY;
        launchTimer += dt;
        if (launchTimer >= cadence) {
          launchTimer -= cadence;
          launches.push(0);
        }
        for (let i = launches.length - 1; i >= 0; i--) {
          launches[i] += dt;
          if (launches[i] * uniforms.uSpeed.value > radMax + trailReach)
            launches.splice(i, 1);
        }
        while (launches.length > 8) launches.shift(); // cap — the oldest goes
        for (let i = 0; i < launches.length; i++) uniforms.uAge.value[i] = launches[i];
        uniforms.uLaunchN.value = launches.length;
      }
      if (mode === 2 && !PREFERS_REDUCED_MOTION) {
        sampleCursor();
        let n = 0;
        for (let i = trail.length - 1; i >= 0 && n < TRAIL_MAX; i--) {
          const age = (now - trail[i].t) / (TRAIL_FADE_S * 1000);
          if (age >= 1) {
            trail.splice(0, i + 1);
            break;
          }
          uniforms.uTrail.value[n].set(trail[i].lat, trail[i].lon, age);
          n++;
        }
        uniforms.uTrailN.value = n;
      }
    },
    dispose() {
      gsap.killTweensOf(record);
      parent.remove(group);
      geometry.dispose();
      material.dispose();
    },
  };
  if (!PREFERS_REDUCED_MOTION) {
    gsap.to(record, { appear: 1, duration: 0.9, ease, overwrite: true });
  } else {
    record.appear = 1;
  }
  return record;
}

/* ──────────────────────────── FURNITURE ──────────────────────────── */

const FURN_CROSSES = 9;
const FURN_CAPTIONS = 4;
const FURN_FLOODS = 3;
const CROSS_ARM = 0.55; // arm length, cells
const ORDER_FURN_FLOOD = 28; // with the glow, under the lattice
const ORDER_FURN_MARK = 31; // crosses/captions over the lines, under media

function inkTexture(text, cssColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 96);
  c.font = '500 40px "SFMono-Regular", Menlo, Consolas, monospace';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = cssColor;
  c.fillText(text, 128, 48);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Seeded empty-cell furniture for one arc: registration crosses at lattice
 * intersections, mono cell-coordinate captions, whisper-alpha cell floods.
 * `avoid` = screen-angle rects [{x1,x2,y1,y2}] (blocks + the card) —
 * x = lat − VIEW_LAT, y = wrap(lon − arcLon).
 */
export function createDrumFurniture({ seed, arcLon, aspect, accent, avoid, parent, ease }) {
  const rand = mulberry32(hashSeed(`${seed}:furn`));
  const win = angularWindow(aspect);
  const group = new THREE.Group();
  parent.add(group);
  const disposables = [];
  const blinkers = []; // { material, base, phase, rate }

  const clear = (x, y, mx, my) =>
    avoid.every((r) => x + mx < r.x1 || x - mx > r.x2 || y + my < r.y1 || y - my > r.y2);

  const pick = (mx, my) => {
    for (let tries = 0; tries < 30; tries++) {
      const x = (rand() * 2 - 1) * win.halfLon * 0.94;
      const y = (rand() * 2 - 1) * win.halfLat * 0.94;
      if (!clear(x, y, mx, my)) continue;
      // Snap to the lattice: x → lat line, y → lon line.
      const lat = Math.round((VIEW_LAT + x) / D_LAT) * D_LAT;
      const lon = Math.round((arcLon + y) / D_LON) * D_LON;
      return { lat, lon };
    }
    return null;
  };

  // Registration crosses — one merged LineSegments draw.
  const crossPositions = [];
  const R_MARK = SHELL_RADIUS - 0.05;
  for (let k = 0; k < FURN_CROSSES; k++) {
    const p = pick(D_LAT * 2, D_LON * 2);
    if (!p) continue;
    const la = CROSS_ARM * D_LAT;
    const lo = CROSS_ARM * D_LON;
    crossPositions.push(
      ...sph(R_MARK, p.lon, p.lat - la),
      ...sph(R_MARK, p.lon, p.lat + la),
      ...sph(R_MARK, p.lon - lo, p.lat),
      ...sph(R_MARK, p.lon + lo, p.lat)
    );
  }
  if (crossPositions.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(crossPositions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0,
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.renderOrder = ORDER_FURN_MARK;
    group.add(lines);
    disposables.push(geo, mat);
    blinkers.push({ material: mat, base: 0.5, phase: 0, rate: 0 });
  }

  // Cell-coordinate captions — the drum frame prints (lat·lon) indices,
  // rotated with the drum axis grammar (screen-upright via drum UVs is not
  // needed for a caption quad: author it as a small sector + remapped UVs).
  for (let k = 0; k < FURN_CAPTIONS; k++) {
    const p = pick(D_LAT * 3, D_LON * 3);
    if (!p) continue;
    const j = Math.round(p.lat / D_LAT);
    const i = Math.round(p.lon / D_LON);
    const capBlock = {
      lon1: p.lon,
      lon2: p.lon + 2 * D_LON,
      lat1: p.lat,
      lat2: p.lat + 5 * D_LAT,
      lonCells: 2,
      latCells: 5,
    };
    const tex = inkTexture(`${String(j).padStart(3, '0')}·${String(i).padStart(3, '0')}`, num2hex(accent));
    // Drum UV remap (the fpDrum idiom) so the caption reads screen-upright.
    const geo = blockSectorGeometry(capBlock, SHELL_RADIUS - 0.08);
    const uv = geo.getAttribute('uv');
    for (let v = 0; v < uv.count; v++) {
      const su = uv.getX(v);
      const sv = uv.getY(v);
      uv.setXY(v, sv, 1 - su);
    }
    uv.needsUpdate = true;
    const capAspect = (5 * D_LAT) / (2 * D_LON * Math.sin(p.lat));
    plateCover(tex, capAspect, 256 / 96);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      toneMapped: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const quad = new THREE.Mesh(geo, mat);
    quad.renderOrder = ORDER_FURN_MARK;
    group.add(quad);
    disposables.push(geo, mat, tex);
    blinkers.push({ material: mat, base: 0.8, phase: rand() * TAU, rate: 0.5 + rand() * 0.4 });
  }

  // Accent floods — single cells washed at whisper alpha, behind the lines.
  for (let k = 0; k < FURN_FLOODS; k++) {
    const p = pick(D_LAT * 2, D_LON * 2);
    if (!p) continue;
    const floodBlock = {
      lon1: p.lon,
      lon2: p.lon + D_LON,
      lat1: p.lat,
      lat2: p.lat + D_LAT,
      lonCells: 1,
      latCells: 1,
    };
    const geo = blockSectorGeometry(floodBlock, SHELL_RADIUS + GLOW_R_OUT + 0.02);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      toneMapped: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const flood = new THREE.Mesh(geo, mat);
    flood.renderOrder = ORDER_FURN_FLOOD;
    group.add(flood);
    disposables.push(geo, mat);
    blinkers.push({ material: mat, base: 0.14, phase: rand() * TAU, rate: 0.3 + rand() * 0.3 });
  }

  const record = {
    group,
    appear: 0,
    qSpawn: IDENTITY_Q.clone(),
    paint(opacity) {
      const t = performance.now() / 1000;
      for (const b of blinkers) {
        // Idle blink: an occasional dip (never a strobe) on seeded phases.
        const blink =
          b.rate > 0 && !PREFERS_REDUCED_MOTION
            ? Math.sin(t * b.rate + b.phase) > 0.965
              ? 0.25
              : 1
            : 1;
        b.material.opacity = b.base * blink * opacity;
      }
    },
    dispose() {
      gsap.killTweensOf(record);
      parent.remove(group);
      for (const d of disposables) d.dispose();
    },
  };
  if (!PREFERS_REDUCED_MOTION) {
    gsap.to(record, { appear: 1, duration: 0.9, ease, overwrite: true });
  } else {
    record.appear = 1;
  }
  return record;
}
