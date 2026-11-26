/**
 * seededLayout.js — deterministic per-World tile placement.
 *
 * Seeded by the project slug so a World's composition is stable across loads.
 *
 * Placement is staged:
 *   1. Even-ish normalized centers in [-1,1]² via min-distance rejection
 *      sampling, avoiding a central clear zone (reserved for the identity
 *      card). This keeps tiles from clipping into one another.
 *   1b. Keep-outs: a center landing inside any `excludeRects` rect (the
 *      composite bands' real footprints, in the normalized frame) ROTATES
 *      around the origin — radius unchanged — to the nearest angle where its
 *      ring exits the rect, so it can never invade the central clear zone or
 *      leave the field. Pure geometry, no PRNG draws, so the seeded sequence
 *      (and every band-less World's layout) is untouched.
 *   2. Map each center to world space at its depth tier, with a seeded Z-jitter
 *      so no two tiles are coplanar — which is what causes z-fighting flicker
 *      when overlapping tiles are viewed through the moving (parallax) camera.
 *
 * Tiles are placed flat (facing the camera); the cohesive spherical warp comes
 * from the lens-distortion post-process, not per-tile rotation.
 */
import {
  DEPTH_TIERS,
  TILE_HEIGHT,
  SCATTER_FRAC,
  CENTER_CLEAR_FRAC,
  CLUSTER_RADIUS,
  OVERLAP_JITTER,
  Z_JITTER,
  TILE_DRIFT,
  CAMERA_FOV,
  FIELD_OFFSET_Y,
  FIELD_SPREAD_X,
  FIELD_SPREAD_Y,
} from './worldConfig.js';

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

// Angular step between centers displaced to the same keep-out exit — a chord
// of ~0.16 normalized at the ring radius, enough to keep tile bodies apart.
const KEEPOUT_STEP = 0.28;
// Minimum chord distance from any earlier displaced center — two fans
// stepping toward each other (short outside arcs on square-ish viewports)
// must not meet on the same spot.
const KEEPOUT_MIN_SEP = 0.12;

// A stepped landing spot must be outside EVERY rect (not just the triggering
// one — a deck exit can sit inside the album rect) and clear of centers
// already displaced onto the ring.
function keepoutClear(x, y, rects, placed) {
  for (const rect of rects) {
    if (Math.abs(x - rect.cx) < rect.halfX && Math.abs(y - rect.cy) < rect.halfY)
      return false;
  }
  for (const p of placed) {
    if (Math.hypot(x - p.x, y - p.y) < KEEPOUT_MIN_SEP) return false;
  }
  return true;
}

/**
 * Ring-preserving keep-out: rotate (nx, ny) about the origin — radius
 * unchanged, so the annulus invariant survives by construction — to the
 * nearest boundary crossing of its radius circle with `rect`, then walk
 * onward in the same direction until the spot clears every rect in `rects`
 * and every center in `placed` (bounded by one revolution). `steps`
 * ({ cw, ccw }, per rect) starts later arrivals one chord further along so
 * the field fans instead of stacking.
 * Returns null when the circle never exits the rect (a rect that swallows
 * the whole ring — extreme portrait aspects): caller keeps the seeded spot.
 */
function rotateOutOfRect(nx, ny, rect, steps, rects, placed) {
  const r = Math.hypot(nx, ny) || 1e-6;
  const exits = [];
  // Circle ∩ vertical edges (x = cx ± halfX)…
  for (const ex of [rect.cx - rect.halfX, rect.cx + rect.halfX]) {
    const c = ex / r;
    if (Math.abs(c) > 1) continue;
    const a = Math.acos(c);
    for (const th of [a, -a]) {
      if (Math.abs(r * Math.sin(th) - rect.cy) <= rect.halfY) exits.push(th);
    }
  }
  // …and horizontal edges (y = cy ± halfY), kept only where the crossing
  // actually lies on the rect's boundary segment.
  for (const ey of [rect.cy - rect.halfY, rect.cy + rect.halfY]) {
    const s = ey / r;
    if (Math.abs(s) > 1) continue;
    const a = Math.asin(s);
    for (const th of [a, Math.PI - a]) {
      if (Math.abs(r * Math.cos(th) - rect.cx) <= rect.halfX) exits.push(th);
    }
  }
  if (!exits.length) return null;
  // NOTE: the inside set on the circle need NOT be one arc — a rect band
  // crossing the ring can cut the circle more than twice — so exits are only
  // starting points; the validated walk below is what guarantees clearance.
  const th0 = Math.atan2(ny, nx);
  let dCCW = Infinity;
  let dCW = Infinity;
  let thCCW = th0;
  let thCW = th0;
  for (const th of exits) {
    const fwd = (((th - th0) % TAU) + TAU) % TAU;
    if (fwd < dCCW) {
      dCCW = fwd;
      thCCW = th;
    }
    const back = (((th0 - th) % TAU) + TAU) % TAU;
    if (back < dCW) {
      dCW = back;
      thCW = th;
    }
  }
  let th;
  let dir;
  if (dCCW <= dCW) {
    dir = 1;
    th = thCCW + steps.ccw++ * KEEPOUT_STEP;
  } else {
    dir = -1;
    th = thCW - steps.cw++ * KEEPOUT_STEP;
  }
  // Walk until clear of every rect and every earlier displaced center — the
  // raw stepped angle can wrap into the other band's rect, a second inside-
  // arc of this one, or a colliding fan. One revolution bounds it; still
  // zero rand() draws.
  const maxSteps = Math.ceil(TAU / KEEPOUT_STEP);
  for (let i = 0; i <= maxSteps; i++) {
    const x = r * Math.cos(th);
    const y = r * Math.sin(th);
    if (keepoutClear(x, y, rects, placed)) return { nx: x, ny: y };
    th += dir * KEEPOUT_STEP;
  }
  return { nx: r * Math.cos(th), ny: r * Math.sin(th) }; // ring saturated — accept
}

/**
 * Seeded-PRNG utilities — exported for the process page's Fragment-belt
 * scatter (same belt every visit, no Math.random in the scene).
 */
export function hashSeed(str) {
  const s = String(str);
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

export function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array} tiles - showcase tiles ({ ratio, ... })
 * @param {Object} opts  - { seed, aspect, tiers, excludeRects }
 *   excludeRects: [{ cx, cy, halfX, halfY }] in the NORMALIZED centers frame
 *   (the nx/ny space, before the world mapping) — tile centers are kept out.
 * @returns {Array} placements [{ x, y, z, width, height }]
 */
export function placeTiles(tiles, { seed, aspect, tiers, excludeRects }) {
  const rand = mulberry32(hashSeed(seed || 'world'));
  const tanV = Math.tan((CAMERA_FOV * DEG2RAD) / 2);
  const n = tiles.length;

  // 1) Even fill of the annulus around the card via phyllotaxis (sunflower):
  //    spreads any N tiles evenly by construction, so denser fields pack tighter
  //    and sparser fields spread out automatically. A seeded XY jitter
  //    (OVERLAP_JITTER) adds organic variation + natural overlap; positions are
  //    clamped back into the [CENTER_CLEAR_FRAC, CLUSTER_RADIUS] annulus.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const innerR = CENTER_CLEAR_FRAC;
  const outerR = Math.max(CLUSTER_RADIUS, innerR + 1e-3);
  const innerSq = innerR * innerR;
  const outerSq = outerR * outerR;
  const angleOffset = rand() * Math.PI * 2; // rotate the whole field per World
  // Keep-out exit counters (per rect) + displaced-center log (shared):
  // deterministic — both advance in phyllotaxis order, which is fixed per seed.
  const rectSteps = excludeRects ? excludeRects.map(() => ({ cw: 0, ccw: 0 })) : null;
  const displaced = [];
  const centers = [];
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? (i + 0.5) / n : 0; // 0..1 across the annulus (even by area)
    const baseR = Math.sqrt(innerSq + t * (outerSq - innerSq));
    const ang = i * GOLDEN_ANGLE + angleOffset;
    let nx = Math.cos(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    let ny = Math.sin(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    const r = Math.hypot(nx, ny) || 1e-6;
    const clamped = Math.min(Math.max(r, innerR), outerR);
    nx = (nx / r) * clamped;
    ny = (ny / r) * clamped;
    // 1b) Keep-outs: rotate a center that lands inside a rect around the
    // origin to its ring's nearest rect exit — radius untouched, so the
    // annulus/clear-zone invariants hold by construction (an edge-push here
    // was measured stranding tiles inside the identity-card zone on 37-73%
    // of deck Worlds). Pure arithmetic: consumes NO rand() draws and
    // reorders none, so a World with no bands is byte-identical.
    if (excludeRects) {
      for (let k = 0; k < excludeRects.length; k++) {
        const rect = excludeRects[k];
        if (
          Math.abs(nx - rect.cx) >= rect.halfX ||
          Math.abs(ny - rect.cy) >= rect.halfY
        )
          continue;
        const out = rotateOutOfRect(
          nx,
          ny,
          rect,
          rectSteps[k],
          excludeRects,
          displaced
        );
        if (out) {
          ({ nx, ny } = out);
          displaced.push({ x: nx, y: ny });
        }
      }
    }
    centers.push({ nx, ny });
  }

  // 2) Map to world space at each tile's depth tier (+ seeded Z-jitter).
  return tiles.map((t, i) => {
    const tierIdx = tiers?.[i] ?? i % DEPTH_TIERS.length;
    const z = DEPTH_TIERS[tierIdx] + (rand() - 0.5) * Z_JITTER;
    const halfH = Math.abs(z) * tanV;
    const halfW = halfH * aspect;
    const { nx, ny } = centers[i];
    const ratio = t.ratio && t.ratio > 0 ? t.ratio : 1;
    // Uniform intrinsic size: fit each tile inside a TILE_HEIGHT square,
    // preserving its own aspect — so depth (z) is the only driver of perceived
    // scale and wide/tall assets can't blow up.
    const width = ratio >= 1 ? TILE_HEIGHT : TILE_HEIGHT * ratio;
    const height = ratio >= 1 ? TILE_HEIGHT / ratio : TILE_HEIGHT;
    // Per-tile micro-drift: one seeded axis, direction, and varied subtlety.
    const driftAxis = rand() < 0.5 ? 'x' : 'y';
    const driftSign = rand() < 0.5 ? -1 : 1;
    const driftAmp = TILE_DRIFT * (0.4 + 0.6 * rand());
    return {
      x: nx * halfW * SCATTER_FRAC * FIELD_SPREAD_X,
      y: ny * halfH * SCATTER_FRAC * FIELD_SPREAD_Y + FIELD_OFFSET_Y * halfH,
      z,
      width,
      height,
      driftAxis,
      driftSign,
      driftAmp,
    };
  });
}
