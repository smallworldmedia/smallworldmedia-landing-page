/**
 * fpGridCells.js — shared cell math for the fp-grid modes (media IN the grid).
 *
 * The shell's fine lattice (SHELL_MERIDIANS × SHELL_PARALLELS → ~1.44° × 0.78°
 * cells) is the registration fabric every mode snaps to; composition happens
 * on blocks of whole cells. This module owns:
 *   · the aspect-aware visible angular window (lens crop included),
 *   · asset ratio → whole-cell span rounding (latitude-aware — horizontal arc
 *     shrinks by sin(lat)),
 *   · slug-seeded block placement, reusing seededLayout's normalized
 *     phyllotaxis-annulus idiom (mulberry32 + CENTER_CLEAR / CLUSTER_RADIUS /
 *     FIELD_SPREAD) then quantizing to cell indices with deterministic
 *     collision step-out (no extra PRNG draws),
 *   · sphere-sector geometry + border polylines whose edges land exactly on
 *     cell lines (1 geometry segment per cell spanned).
 *
 * Angular frame: the camera looks down −Z from the sphere's center; in
 * buildShell's sph() convention that is lon 3π/2, lat π/2. Offsets (a, b) are
 * screen-aligned: +a = right (lon 3π/2 + a), +b = up (lat π/2 − b).
 */
import * as THREE from 'three';
import { hashSeed, mulberry32 } from './seededLayout.js';
import {
  SHELL_MERIDIANS,
  SHELL_PARALLELS,
  CAMERA_FOV,
  FPGRID_WINDOW,
  CENTER_CLEAR_FRAC,
  CLUSTER_RADIUS,
  OVERLAP_JITTER,
  FIELD_OFFSET_Y,
  FIELD_SPREAD_X,
  FIELD_SPREAD_Y,
} from './worldConfig.js';

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

export const D_LON = TAU / SHELL_MERIDIANS; // fine cell pitch, longitude
export const D_LAT = Math.PI / SHELL_PARALLELS; // fine cell pitch, latitude
export const VIEW_LON = Math.PI * 1.5; // −Z in sph() coords
export const VIEW_LAT = Math.PI / 2;

/** sph() twin (buildShell.js) — kept identical so borders land on shell lines. */
export function sph(r, lon, lat) {
  return [
    r * Math.sin(lat) * Math.cos(lon),
    r * Math.cos(lat),
    r * Math.sin(lat) * Math.sin(lon),
  ];
}

/**
 * Usable angular half-extents of the frame. The lens pass (negative K0)
 * magnifies edges, cropping the outer ~15% of the rendered frustum —
 * FPGRID_WINDOW scales in tan space where frustum edges live.
 */
export function angularWindow(aspect) {
  const tanV = Math.tan((CAMERA_FOV * DEG2RAD) / 2) * FPGRID_WINDOW;
  return {
    halfLat: Math.atan(tanV),
    halfLon: Math.atan(tanV * (aspect || 1)),
  };
}

/**
 * Asset ratio → whole-cell span at a latitude. `baseDeg` is the longest
 * projected side in degrees (the PLATE_DEG idiom); horizontal spans stretch in
 * longitude by 1/sin(lat) so the PROJECTED aspect matches the asset.
 */
export function spanForRatio(ratio, latCenter, baseDeg) {
  const r = ratio && ratio > 0 ? ratio : 1;
  const base = baseDeg * DEG2RAD;
  const wAng = r >= 1 ? base : base * r; // projected width (arc at the sphere)
  const hAng = r >= 1 ? base / r : base; // projected height
  const lonSpan = wAng / Math.max(0.2, Math.sin(latCenter));
  return {
    lonCells: Math.max(1, Math.round(lonSpan / D_LON)),
    latCells: Math.max(1, Math.round(hAng / D_LAT)),
  };
}

/* Block ↔ normalized frame (the seeded annulus space). */
const toNorm = (lon, lat, win) => ({
  nx: (lon - VIEW_LON) / (FIELD_SPREAD_X * win.halfLon),
  ny: ((VIEW_LAT - lat) / win.halfLat - FIELD_OFFSET_Y) / FIELD_SPREAD_Y,
});

/* The WorldCard's protected footprint: CENTER_CLEAR_FRAC is the legacy
   CENTERS-in-annulus radius — tiles with extent always reached ~60% of it, so
   the rect a block's BODY must clear is scaled accordingly (title/cta/tags
   column, normalized frame). */
const CARD_HALF = CENTER_CLEAR_FRAC * 0.6;

/** Does the block's body overlap the WorldCard's central rect? */
function intersectsCard(block, win) {
  const c1 = toNorm(block.i1 * D_LON, block.j1 * D_LAT, win);
  const c2 = toNorm(
    (block.i1 + block.lonCells) * D_LON,
    (block.j1 + block.latCells) * D_LAT,
    win
  );
  const nxMin = Math.min(c1.nx, c2.nx);
  const nxMax = Math.max(c1.nx, c2.nx);
  const nyMin = Math.min(c1.ny, c2.ny);
  const nyMax = Math.max(c1.ny, c2.ny);
  return (
    nxMin < CARD_HALF && nxMax > -CARD_HALF && nyMin < CARD_HALF && nyMax > -CARD_HALF
  );
}

const GUTTER = 1; // fine cells kept clear between blocks so strokes stay distinct
const overlaps = (a, b) =>
  a.i1 - GUTTER < b.i1 + b.lonCells &&
  a.i1 + a.lonCells + GUTTER > b.i1 &&
  a.j1 - GUTTER < b.j1 + b.latCells &&
  a.j1 + a.latCells + GUTTER > b.j1;

/**
 * Slug-seeded cell-block placement.
 *
 * @param {Array<{ratio:number}>} items - media to place, in composition order
 * @param {Object} opts
 *   seed       - project slug (layout stable across loads)
 *   aspect     - camera aspect
 *   baseDeg    - longest projected side per block, degrees
 *   reserved   - pre-claimed blocks ([{nx, ny, ratio, baseDeg}] — e.g. the deck
 *                plate at the house top-right anchor); placed first, returned
 *                alongside under `reserved`.
 * @returns {{ blocks: Array, reserved: Array }} block: { i1, j1, lonCells,
 *   latCells, lon1, lon2, lat1, lat2, lonC, latC, coverAspect, nr }
 */
export function placeBlocks(items, { seed, aspect, baseDeg, reserved = [] }) {
  const rand = mulberry32(hashSeed(seed || 'world'));
  const win = angularWindow(aspect);
  const placed = [];

  const quantize = (lonC, latC, lonCells, latCells) => {
    const i1 = Math.round(lonC / D_LON - lonCells / 2);
    const j1 = Math.round(latC / D_LAT - latCells / 2);
    return { i1, j1, lonCells, latCells };
  };

  const finalize = (block, nr) => {
    const lon1 = block.i1 * D_LON;
    const lat1 = block.j1 * D_LAT;
    const lon2 = lon1 + block.lonCells * D_LON;
    const lat2 = lat1 + block.latCells * D_LAT;
    const latC = (lat1 + lat2) / 2;
    return {
      ...block,
      lon1,
      lon2,
      lat1,
      lat2,
      lonC: (lon1 + lon2) / 2,
      latC,
      // Projected aspect the texture must cover-fit (width shrinks by sin(lat)).
      coverAspect:
        ((lon2 - lon1) * Math.sin(latC)) / Math.max(1e-6, lat2 - lat1),
      nr, // normalized rest radius — drives the house inner→outer bloom stagger
    };
  };

  const inWindow = (block) =>
    block.i1 >= Math.ceil((VIEW_LON - win.halfLon) / D_LON) &&
    block.i1 + block.lonCells <= Math.floor((VIEW_LON + win.halfLon) / D_LON) &&
    block.j1 >= Math.ceil((VIEW_LAT - win.halfLat) / D_LAT) &&
    block.j1 + block.latCells <= Math.floor((VIEW_LAT + win.halfLat) / D_LAT);

  const isClear = (block) =>
    inWindow(block) &&
    !intersectsCard(block, win) &&
    placed.every((p) => !overlaps(block, p));

  // Deterministic outward step-out (reserved/strip blocks: the anchor's
  // quadrant intent is the point, so a conflicted strip walks away from the
  // card along its own direction). No PRNG draws.
  const resolveOutward = (block, ux, uy) => {
    for (let s = 0; s < 80; s++) {
      if (!intersectsCard(block, win) && placed.every((p) => !overlaps(block, p)))
        return clampToWindow(block);
      block.i1 += Math.sign(ux || 1);
      block.j1 -= Math.sign(uy); // +uy = up = smaller lat index
      clampToWindow(block);
    }
    return block; // saturated — accept
  };
  const clampToWindow = (block) => {
    const lonMax = (VIEW_LON + win.halfLon) / D_LON;
    const lonMin = (VIEW_LON - win.halfLon) / D_LON;
    const latMax = (VIEW_LAT + win.halfLat) / D_LAT;
    const latMin = (VIEW_LAT - win.halfLat) / D_LAT;
    block.i1 = Math.min(Math.max(block.i1, Math.ceil(lonMin)), Math.floor(lonMax - block.lonCells));
    block.j1 = Math.min(Math.max(block.j1, Math.ceil(latMin)), Math.floor(latMax - block.latCells));
    return block;
  };

  // Ring-preserving resolution for seeded plates (the seededLayout
  // rotateOutOfRect doctrine): a conflicted block rotates AROUND the card at
  // its own ring radius — it can never invade the center or pile at a window
  // corner. A block that finds no clear angle in a full revolution is DROPPED
  // (returns null): empty cells are part of the composition, a corner pileup
  // is not. Pure arithmetic, zero rand() draws.
  const RING_STEP = 0.16; // rad — walk resolution around a ring
  const RING_GROW = 0.17; // outward layer spacing when a ring is saturated
  const ringSteps = { n: 0 }; // later arrivals start further along (fan idiom)
  const resolveOnRing = (nx0, ny0, span) => {
    const r0 = Math.hypot(nx0, ny0) || 1e-6;
    const th0 = Math.atan2(ny0, nx0);
    const max = Math.ceil(TAU / RING_STEP);
    // The seeded annulus collapses to one ring (CLUSTER_RADIUS < CENTER_CLEAR),
    // and one ring can't hold plate-sized blocks — saturated rings retry on
    // outward layers, so the constellation fills toward the frame edges.
    for (let layer = 0; layer < 3; layer++) {
      const rl = Math.min(1, r0 + layer * RING_GROW);
      for (let s = 0; s <= max; s++) {
        const th = th0 + (s === 0 ? 0 : (s + ringSteps.n) * RING_STEP);
        const nx = Math.cos(th) * rl;
        const ny = Math.sin(th) * rl;
        const a = nx * FIELD_SPREAD_X * win.halfLon;
        const b = (ny * FIELD_SPREAD_Y + FIELD_OFFSET_Y) * win.halfLat;
        const block = quantize(VIEW_LON + a, VIEW_LAT - b, span.lonCells, span.latCells);
        if (isClear(block)) {
          if (s > 0) ringSteps.n++;
          return { block, nr: rl };
        }
      }
    }
    return null;
  };

  // Reserved blocks first (they claim their cells like the legacy band keep-outs).
  const reservedOut = reserved.map((r) => {
    const a = r.nx * FIELD_SPREAD_X * win.halfLon;
    const b = (r.ny * FIELD_SPREAD_Y + FIELD_OFFSET_Y) * win.halfLat;
    const latC = VIEW_LAT - b;
    const lonC = VIEW_LON + a;
    const span = spanForRatio(r.ratio, latC, r.baseDeg ?? baseDeg);
    const block = resolveOutward(
      quantize(lonC, latC, span.lonCells, span.latCells),
      r.nx || 1,
      r.ny || 0
    );
    placed.push(block);
    return finalize(block, Math.hypot(r.nx, r.ny));
  });

  // Seeded phyllotaxis annulus — seededLayout stage 1, verbatim idiom.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const innerR = CENTER_CLEAR_FRAC;
  const outerR = Math.max(CLUSTER_RADIUS, innerR + 1e-3);
  const innerSq = innerR * innerR;
  const outerSq = outerR * outerR;
  const angleOffset = rand() * TAU;
  const n = items.length;

  const blocks = items.map((item, i) => {
    const t = n > 1 ? (i + 0.5) / n : 0;
    const baseR = Math.sqrt(innerSq + t * (outerSq - innerSq));
    const ang = i * GOLDEN_ANGLE + angleOffset;
    let nx = Math.cos(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    let ny = Math.sin(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    const r = Math.hypot(nx, ny) || 1e-6;
    const clamped = Math.min(Math.max(r, innerR), outerR);
    nx = (nx / r) * clamped;
    ny = (ny / r) * clamped;
    const b0 = (ny * FIELD_SPREAD_Y + FIELD_OFFSET_Y) * win.halfLat;
    const span = spanForRatio(item.ratio, VIEW_LAT - b0, baseDeg);
    const res = resolveOnRing(nx, ny, span);
    if (!res) return null; // no clear angle on the ring — cells stay empty
    placed.push(res.block);
    return finalize(res.block, res.nr);
  });

  return { blocks, reserved: reservedOut };
}

/**
 * Sphere-sector geometry for a cell block — 1 segment per cell spanned, so
 * edges (and interior vertices) land exactly on lattice lines. buildShell's
 * sph() and SphereGeometry disagree on longitude handedness (x = +cos(lon) vs
 * −cos(φ)): φ = π − lon maps between them.
 */
export function blockSectorGeometry(block, radius) {
  const geo = new THREE.SphereGeometry(
    radius,
    Math.min(block.lonCells, 48),
    Math.min(block.latCells, 48),
    Math.PI - block.lon2,
    block.lon2 - block.lon1,
    block.lat1,
    block.lat2 - block.lat1
  );
  return geo;
}

/**
 * Border polyline for a block — the 4 bounding lattice arcs, sampled with the
 * shared sph() so they are congruent with the shell's own lines.
 */
export function blockBorderGeometry(block, radius) {
  const positions = [];
  const seg = (lonA, latA, lonB, latB, steps) => {
    for (let s = 0; s < steps; s++) {
      positions.push(
        ...sph(radius, lonA + ((lonB - lonA) * s) / steps, latA + ((latB - latA) * s) / steps),
        ...sph(
          radius,
          lonA + ((lonB - lonA) * (s + 1)) / steps,
          latA + ((latB - latA) * (s + 1)) / steps
        )
      );
    }
  };
  const lonSteps = Math.max(2, block.lonCells);
  const latSteps = Math.max(2, block.latCells);
  seg(block.lon1, block.lat1, block.lon2, block.lat1, lonSteps); // top parallel
  seg(block.lon1, block.lat2, block.lon2, block.lat2, lonSteps); // bottom parallel
  seg(block.lon1, block.lat1, block.lon1, block.lat2, latSteps); // left meridian
  seg(block.lon2, block.lat1, block.lon2, block.lat2, latSteps); // right meridian
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

/** Unit direction to a block's center (for spawn slerps + live eligibility). */
export function blockCenterDir(block) {
  const [x, y, z] = sph(1, block.lonC, block.latC);
  return new THREE.Vector3(x, y, z);
}
