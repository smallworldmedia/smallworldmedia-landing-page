/**
 * seededLayout.js — deterministic per-World tile placement.
 *
 * Seeded by the project slug so a World's composition is stable across loads.
 *
 * Placement is two-stage:
 *   1. Even-ish normalized centers in [-1,1]² via min-distance rejection
 *      sampling, avoiding a central clear zone (reserved for the identity
 *      card). This keeps tiles from clipping into one another.
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
 * @param {Object} opts  - { seed, aspect }
 * @returns {Array} placements [{ x, y, z, width, height }]
 */
export function placeTiles(tiles, { seed, aspect, tiers }) {
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
