/**
 * fpDrum.js — ?fpgrid=3 "DRUM": one continuous world that revolves.
 *
 * The shell reorients so its pole axis lies along X (poles at the screen's
 * left/right, ~90° off-axis — never visible) and media plates fuse WITH the
 * lattice into one rigid drum. Each project dresses a fixed ARC_DEG arc; the
 * World Turn physically rotates the whole drum on the house curve — the
 * outgoing territory rolls up and out the top while the incoming wheels up
 * from below (today's Turn direction grammar, now carrying the grid itself),
 * lens spike as the atmosphere compresses. Absolute-angle bookkeeping: every
 * Turn tweens to index × ARC_DEG, so the optional idle creep (?creep deg/s,
 * default 0 — Nathan's toggle) auto-corrects on the next Turn.
 *
 * Hierarchy: scene → parallax (pointer micro-rotation of the WHOLE drum) →
 * roll (rotation.x = the conveyor) → body (rotation.z = π/2, poles → ±X)
 * → [shell lines, both slot pivots]. Slots keep their contracts (clearSlot,
 * scheduler, buildGen) — their pivots just live inside the drum body, pinned
 * at zero; the Turn moves the roll group instead.
 *
 * In body-local coordinates the fpGridCells frame survives: local VIEW_LON/
 * VIEW_LAT still face the camera at rest — but the axes SWAP roles on screen
 * (local lon = screen-vertical = the conveyor direction; local lat =
 * screen-horizontal), so placement and cover-fit use drum-specific span math
 * and a UV-remapped sector geometry. Plates sit INSIDE the shell lines
 * (media replaces its cells — edges flush, accent border just proud), the
 * third edge treatment.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { hashSeed, mulberry32 } from './seededLayout.js';
import {
  D_LON,
  D_LAT,
  VIEW_LON,
  VIEW_LAT,
  angularWindow,
  blockSectorGeometry,
  blockBorderGeometry,
  blockCenterDir,
} from './fpGridCells.js';
import { plateCover, spawnQuaternion } from './fpAtlas.js';
import { createWallPlate } from './fpDrumWall.js';
import {
  makeTabTexture,
  createDrumGlow,
  createDrumFurniture,
} from './fpDrumTrim.js';
import {
  SHELL_RADIUS,
  MAX_TILES,
  MIN_TILES,
  thumbForCount,
  PLATE_DEG,
  CAMERA_FOV,
  TILE_FALLBACK_COLOR,
  TILE_APPEAR_DURATION,
  FANOUT_STAGGER,
  WORLD_MAX_VIDEO_TILES,
  BANDS_ENABLED,
  BAND_TIER,
  BAND_TUNABLES,
  DEPTH_TIERS,
  CENTER_CLEAR_FRAC,
  CLUSTER_RADIUS,
  OVERLAP_JITTER,
  FIELD_OFFSET_Y,
  FIELD_SPREAD_X,
  FIELD_SPREAD_Y,
  FPGRID_BALANCE,
  FPGRID_VIS,
  FPGLOW,
  FPTAB,
  FPFURN,
  WALL_MAX_PAGES,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

/* Radius scheme — the third stroke treatment: media REPLACES its cells.
   Plates sit inside the lines (nearer to the interior camera → cover them);
   accent borders just proud of the plates. */
const PLATE_R_IN = 0.12; // plates at SHELL_RADIUS − this
const BORDER_R_IN = 0.18;
const OVERLAY_R_IN = 0.06;

/* renderOrder: shell (30) first, then plates COVER their cells' lines.
   (Trim: glow panels + furniture floods sit at 28, under the lattice —
   fpDrumTrim.js; furniture marks at 31.) */
const ORDER_PLATE = 32;
const ORDER_STRIP_BACK = 33;
const ORDER_STRIP_FRONT = 34;
const ORDER_OVERLAY = 36;
const ORDER_TAB = 38; // spine tabs stamp OVER the media (and its overlay)
const ORDER_BORDER = 40;

const BORDER_ALPHA = 0.9;

const tileSrc = (t, thumb) =>
  t.playbackId
    ? `https://image.mux.com/${t.playbackId}/thumbnail.webp?width=${thumb}`
    : t.imageUrl
      ? `${t.imageUrl}?w=${thumb}&auto=format&fit=max`
      : null;

/** Drum sector geometry: the shared sector with UVs remapped for the rotated
 *  body — screen-horizontal = theta (lat), screen-vertical = phi (lon) — so
 *  plateCover (and its BackSide U-flip) works in image space unchanged. */
export function drumSectorGeometry(block, radius) {
  const geo = blockSectorGeometry(block, radius);
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const su = uv.getX(i);
    const sv = uv.getY(i);
    uv.setXY(i, sv, 1 - su);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * The drum hierarchy. `state.adv` is the absolute advance in degrees
 * (index × ARC_DEG + idle creep); the tick applies it as roll rotation.
 */
export function createDrum(scene, shell) {
  const parallax = new THREE.Group();
  const roll = new THREE.Group();
  const body = new THREE.Group();
  body.rotation.z = Math.PI / 2; // poles → ±X (off-screen at ~90°)
  parallax.add(roll);
  roll.add(body);
  body.add(shell);
  scene.add(parallax);
  const drum = {
    parallax,
    roll,
    body,
    state: { adv: 0 }, // degrees of advance; +adv = content up (forward)
    applyRoll() {
      // +adv rolls content UP through the frame (forward grammar): a point at
      // local lon (VIEW_LON − adv) lands exactly at view center under
      // Rx(+adv) — verified against the Rz(π/2) body mapping.
      roll.rotation.x = drum.state.adv * DEG2RAD;
    },
    dispose() {
      scene.remove(parallax);
    },
  };
  return drum;
}

/* ── Drum-frame span math (axis roles swapped vs fpGridCells) ── */
function drumSpan(ratio, latC, baseDeg) {
  const r = ratio && ratio > 0 ? ratio : 1;
  const base = baseDeg * DEG2RAD;
  const wAng = r >= 1 ? base : base * r; // screen-horizontal = LAT arc
  const hAng = r >= 1 ? base / r : base; // screen-vertical = LON arc (shrinks by sin(lat))
  const lonSpan = hAng / Math.max(0.2, Math.sin(latC));
  return {
    latCells: Math.max(1, Math.round(wAng / D_LAT)),
    lonCells: Math.max(1, Math.round(lonSpan / D_LON)),
  };
}

const GUTTER = 1;
const CARD_HALF = CENTER_CLEAR_FRAC * 0.6;

/**
 * Seeded placement in the drum frame around an arc center: nx (screen-x) maps
 * to LATITUDE offset, ny (screen-y) to LONGITUDE offset from the arc center.
 * Same annulus + card keep-out + ring-walk/drop doctrine as the other modes.
 */
function placeDrumBlocks(items, { seed, aspect, arcLon, reserved = [] }) {
  const rand = mulberry32(hashSeed(seed || 'world'));
  const win = angularWindow(aspect); // halfLon = screen-x half-extent, halfLat = screen-y
  const placed = [];

  const quantize = (latC, lonC, span) => ({
    i1: Math.round(lonC / D_LON - span.lonCells / 2), // lon index (vertical)
    j1: Math.round(latC / D_LAT - span.latCells / 2), // lat index (horizontal)
    lonCells: span.lonCells,
    latCells: span.latCells,
  });
  const norm = (lat, lon) => ({
    nx: (lat - VIEW_LAT) / (FIELD_SPREAD_X * win.halfLon),
    ny: ((lon - arcLon) / win.halfLat - FIELD_OFFSET_Y) / FIELD_SPREAD_Y,
  });
  const overlaps = (a, b) =>
    a.i1 - GUTTER < b.i1 + b.lonCells &&
    a.i1 + a.lonCells + GUTTER > b.i1 &&
    a.j1 - GUTTER < b.j1 + b.latCells &&
    a.j1 + a.latCells + GUTTER > b.j1;
  const intersectsCard = (b) => {
    const c1 = norm(b.j1 * D_LAT, b.i1 * D_LON);
    const c2 = norm((b.j1 + b.latCells) * D_LAT, (b.i1 + b.lonCells) * D_LON);
    return (
      Math.min(c1.nx, c2.nx) < CARD_HALF &&
      Math.max(c1.nx, c2.nx) > -CARD_HALF &&
      Math.min(c1.ny, c2.ny) < CARD_HALF &&
      Math.max(c1.ny, c2.ny) > -CARD_HALF
    );
  };
  const inWindow = (b) =>
    b.j1 * D_LAT >= VIEW_LAT - win.halfLon &&
    (b.j1 + b.latCells) * D_LAT <= VIEW_LAT + win.halfLon &&
    b.i1 * D_LON >= arcLon - win.halfLat &&
    (b.i1 + b.lonCells) * D_LON <= arcLon + win.halfLat;
  const isClear = (b) =>
    inWindow(b) && !intersectsCard(b) && placed.every((p) => !overlaps(b, p));
  const finalize = (b, nr) => {
    const lon1 = b.i1 * D_LON;
    const lat1 = b.j1 * D_LAT;
    const lon2 = lon1 + b.lonCells * D_LON;
    const lat2 = lat1 + b.latCells * D_LAT;
    const latC = (lat1 + lat2) / 2;
    return {
      ...b,
      lon1,
      lon2,
      lat1,
      lat2,
      lonC: (lon1 + lon2) / 2,
      latC,
      // projected width/height = lat arc / (lon arc × sin(lat))
      coverAspect: (lat2 - lat1) / Math.max(1e-6, (lon2 - lon1) * Math.sin(latC)),
      nr,
    };
  };
  const toAngles = (nx, ny) => ({
    latC: VIEW_LAT + nx * FIELD_SPREAD_X * win.halfLon,
    lonC: arcLon + (ny * FIELD_SPREAD_Y + FIELD_OFFSET_Y) * win.halfLat,
  });

  const RING_STEP = 0.16;
  const RING_GROW = 0.17;
  const ringSteps = { n: 0 };
  const resolveOnRing = (nx0, ny0, ratio) => {
    const r0 = Math.hypot(nx0, ny0) || 1e-6;
    const th0 = Math.atan2(ny0, nx0);
    const max = Math.ceil(TAU / RING_STEP);
    for (let layer = 0; layer < 3; layer++) {
      const rl = Math.min(1, r0 + layer * RING_GROW);
      for (let s = 0; s <= max; s++) {
        const th = th0 + (s === 0 ? 0 : (s + ringSteps.n) * RING_STEP);
        const { latC, lonC } = toAngles(Math.cos(th) * rl, Math.sin(th) * rl);
        const b = quantize(latC, lonC, drumSpan(ratio, latC, PLATE_DEG));
        if (isClear(b)) {
          if (s > 0) ringSteps.n++;
          return { b, nr: rl };
        }
      }
    }
    return null;
  };

  const reservedOut = reserved.map((r) => {
    const { latC, lonC } = toAngles(r.nx, r.ny);
    const b = quantize(latC, lonC, drumSpan(r.ratio, latC, r.baseDeg ?? PLATE_DEG));
    for (let s = 0; s < 60; s++) {
      if (!intersectsCard(b) && placed.every((p) => !overlaps(b, p))) break;
      b.j1 += Math.sign(r.nx || 1); // + lat = right
      b.i1 += Math.sign(r.ny || 1); // + lon = up
    }
    placed.push(b);
    return finalize(b, Math.hypot(r.nx, r.ny));
  });

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const innerR = CENTER_CLEAR_FRAC;
  const outerR = Math.max(CLUSTER_RADIUS, innerR + 1e-3);
  const angleOffset = rand() * TAU;
  const n = items.length;
  const raw = items.map((item, i) => {
    const t = n > 1 ? (i + 0.5) / n : 0;
    const baseR = Math.sqrt(innerR * innerR + t * (outerR * outerR - innerR * innerR));
    const ang = i * GOLDEN_ANGLE + angleOffset;
    let nx = Math.cos(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    let ny = Math.sin(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    const r = Math.hypot(nx, ny) || 1e-6;
    const clamped = Math.min(Math.max(r, innerR), outerR);
    nx = (nx / r) * clamped;
    ny = (ny / r) * clamped;
    const res = resolveOnRing(nx, ny, item.ratio);
    if (!res) return null;
    placed.push(res.b);
    return { b: res.b, nr: res.nr, ratio: item.ratio };
  });

  const balanceStats = FPGRID_BALANCE
    ? balanceDrumComposition(raw, items, {
        placed,
        aspect,
        arcLon,
        norm,
        quantize,
        isClear,
        inWindow,
        intersectsCard,
        overlaps,
      })
    : null;

  const blocks = raw.map((r) => {
    if (!r) return null;
    // Re-derive the bloom radius from the FINAL position — a nudged/rescued
    // block staggers by where it actually landed.
    const c = norm((r.b.j1 + r.b.latCells / 2) * D_LAT, (r.b.i1 + r.b.lonCells / 2) * D_LON);
    return finalize(r.b, Math.hypot(c.nx, c.ny));
  });

  return { blocks, reserved: reservedOut, balanceStats };
}

/**
 * Semi-balance pass (Nathan, 08-27): the seeded ring placement composes well
 * but can leave overtly empty corners (and an oversized block can weigh one
 * down). Measure occupancy of the VISIBLE frame in 3×3 zones — the center
 * zone belongs to the WorldCard and is excluded — then, deterministically
 * (pure arithmetic, zero PRNG draws — same slug, same composition):
 *   a) NUDGE blocks a few whole cells at a time toward whatever move most
 *      reduces zone-occupancy variance (run-off past the frame stays allowed:
 *      the placement window, not the visible frame, bounds the move);
 *   b) RESCUE dropped blocks into the emptiest zone (empty cells are
 *      composition, but a rescued block beats a bare corner);
 *   c) DEMOTE the block crowding a dominant zone one size step (~15%) —
 *      the Munchietown bottom-left correction.
 * ?fpbal=0 compares against the raw ring placement.
 */
const BAL_OFFSETS = [-4, -2, -1, 0, 1, 2, 4]; // candidate nudges, whole cells per axis
const BAL_SWEEPS = 3;
const BAL_DEMOTE_STEP = 0.85; // size step for a demoted block (× PLATE_DEG)
const BAL_DOMINANCE = 1.6; // zone occupancy vs mean that triggers a demotion
const BAL_MAX_DEMOTE = 2;
const CENTER_ZONE = 4;

function balanceDrumComposition(raw, items, ctx) {
  const { placed, aspect, arcLon, norm, quantize, isClear, inWindow, intersectsCard, overlaps } = ctx;
  // The visible frame's angular half-extents (the lens crop shows ~FPGRID_VIS
  // of the frustum) — balance is judged on what the viewer actually sees,
  // independent of the placement window (?fpwin).
  const tanH = Math.tan((CAMERA_FOV * DEG2RAD) / 2) * FPGRID_VIS;
  const hx = Math.atan(tanH * (aspect || 1)); // screen-x = latitude arc
  const hy = Math.atan(tanH); // screen-y = longitude arc
  const zw = (2 * hx) / 3;
  const zh = (2 * hy) / 3;

  const rectOf = (b) => ({
    x1: b.j1 * D_LAT - VIEW_LAT,
    x2: (b.j1 + b.latCells) * D_LAT - VIEW_LAT,
    y1: b.i1 * D_LON - arcLon,
    y2: (b.i1 + b.lonCells) * D_LON - arcLon,
  });
  const zoneShare = (r, z) => {
    const zx1 = -hx + (z % 3) * zw;
    const zy1 = -hy + Math.floor(z / 3) * zh;
    const ox = Math.max(0, Math.min(r.x2, zx1 + zw) - Math.max(r.x1, zx1));
    const oy = Math.max(0, Math.min(r.y2, zy1 + zh) - Math.max(r.y1, zy1));
    return (ox * oy) / (zw * zh);
  };
  const occupancy = () => {
    const occ = new Array(9).fill(0);
    for (const p of placed) {
      const r = rectOf(p);
      for (let z = 0; z < 9; z++) occ[z] += zoneShare(r, z);
    }
    return occ;
  };
  const metric = () => {
    const occ = occupancy();
    let sum = 0;
    for (let z = 0; z < 9; z++) if (z !== CENTER_ZONE) sum += occ[z];
    const mean = sum / 8;
    let v = 0;
    for (let z = 0; z < 9; z++) if (z !== CENTER_ZONE) v += (occ[z] - mean) ** 2;
    return v;
  };
  const clearFor = (b, self) =>
    inWindow(b) &&
    !intersectsCard(b) &&
    placed.every((p) => p === self || !overlaps(b, p));

  const stats = { nudged: 0, rescued: 0, demoted: 0, before: metric() };

  // a) nudge sweeps — each block takes its best variance-reducing legal move.
  const sweep = () => {
    let improved = false;
    let score = metric();
    for (const r of raw) {
      if (!r) continue;
      const b = r.b;
      let best = null;
      for (const di of BAL_OFFSETS) {
        for (const dj of BAL_OFFSETS) {
          if (!di && !dj) continue;
          const cand = { ...b, i1: b.i1 + di, j1: b.j1 + dj };
          if (!clearFor(cand, b)) continue;
          const oi = b.i1;
          const oj = b.j1;
          b.i1 = cand.i1;
          b.j1 = cand.j1;
          const s = metric();
          b.i1 = oi;
          b.j1 = oj;
          if (s < score - 1e-6 && (!best || s < best.s)) best = { di, dj, s };
        }
      }
      if (best) {
        b.i1 += best.di;
        b.j1 += best.dj;
        score = best.s;
        improved = true;
        stats.nudged++;
      }
    }
    return improved;
  };
  for (let pass = 0; pass < BAL_SWEEPS; pass++) if (!sweep()) break;

  // b) rescue drops into the emptiest zone (deterministic outward search).
  raw.forEach((r, idx) => {
    if (r) return;
    const occ = occupancy();
    let zBest = -1;
    let zMin = Infinity;
    for (let z = 0; z < 9; z++)
      if (z !== CENTER_ZONE && occ[z] < zMin) {
        zMin = occ[z];
        zBest = z;
      }
    const latC = VIEW_LAT + (-hx + (zBest % 3) * zw + zw / 2);
    const lonC = arcLon + (-hy + Math.floor(zBest / 3) * zh + zh / 2);
    const span = drumSpan(items[idx].ratio, latC, PLATE_DEG);
    const STEPS = [0, -2, 2, -4, 4, -6, 6];
    outer: for (const dj of STEPS) {
      for (const di of STEPS) {
        const b = quantize(latC + dj * D_LAT, lonC + di * D_LON, span);
        if (isClear(b)) {
          placed.push(b);
          raw[idx] = { b, nr: 1, ratio: items[idx].ratio };
          stats.rescued++;
          break outer;
        }
      }
    }
  });

  // c) demote the top contributor to a dominant zone one size step.
  for (let d = 0; d < BAL_MAX_DEMOTE; d++) {
    const occ = occupancy();
    let sum = 0;
    let zMax = -1;
    let vMax = -1;
    for (let z = 0; z < 9; z++)
      if (z !== CENTER_ZONE) {
        sum += occ[z];
        if (occ[z] > vMax) {
          vMax = occ[z];
          zMax = z;
        }
      }
    if (vMax < (sum / 8) * BAL_DOMINANCE) break;
    let top = null;
    for (const r of raw) {
      if (!r || r.demoted) continue;
      const share = zoneShare(rectOf(r.b), zMax);
      if (share > 0 && (!top || share > top.share)) top = { r, share };
    }
    if (!top) break;
    const b = top.r.b;
    const latC = (b.j1 + b.latCells / 2) * D_LAT;
    const lonC = (b.i1 + b.lonCells / 2) * D_LON;
    const span = drumSpan(top.r.ratio, latC, PLATE_DEG * BAL_DEMOTE_STEP);
    if (span.latCells >= b.latCells && span.lonCells >= b.lonCells) break;
    const nb = quantize(latC, lonC, span);
    if (!clearFor(nb, b)) break;
    Object.assign(b, nb); // in place — `placed` holds the same ref
    top.r.demoted = true;
    stats.demoted++;
    sweep(); // the smaller block may now settle somewhere better
  }

  stats.after = metric();
  return stats;
}

/**
 * Build one World's arc dressing into a slot (pivot lives inside the drum
 * body, pinned at zero). ctx: { camera, loader, firstView, ease, isStale,
 * arcOffsetDeg, drum }.
 */
export function buildDrumSlot(slot, w, ctx) {
  const { camera, loader, firstView, ease, isStale, drum } = ctx;
  const arcLon = VIEW_LON + (ctx.arcOffsetDeg || 0) * DEG2RAD;
  const pool = w?.showcase || [];
  if (!pool.length && !w?.brandDecks?.length && !w?.albumArt?.length) return;

  const count = Math.min(MAX_TILES, Math.max(MIN_TILES, pool.length));
  const videoPool = pool.filter((a) => a.playbackId);
  const stillPool = pool.filter((a) => !a.playbackId && a.imageUrl);
  const videoCount = Math.min(videoPool.length, WORLD_MAX_VIDEO_TILES, count);
  const stillNeed = count - videoCount;
  const stillTiles = stillPool.length
    ? Array.from({ length: stillNeed }, (_, j) => stillPool[j % stillPool.length])
    : [];
  const chosen = [...videoPool.slice(0, videoCount), ...stillTiles];
  const tierOf = (i) =>
    videoCount > 0
      ? i < videoCount
        ? 0
        : 1 + ((i - videoCount) % 2)
      : i % DEPTH_TIERS.length;
  const thumb = thumbForCount(chosen.length);
  const radius = SHELL_RADIUS - PLATE_R_IN - (slot.atlasBias || 0);
  const accent = w?.projectColor || 0x020098;

  // 08-27 (Nathan): decks and album art render as WALL plates — the detail
  // page's orthographic DeckScroller brought over to the grid (fpDrumWall).
  // `ratio` is the wall plate's FOOTPRINT aspect (drives cell span); the
  // wall's internal column math derives its column count from it: deck 16:9
  // pages → 2 big spreads, album squares → a 3×2 record bin.
  const stripDefs = BANDS_ENABLED
    ? [
        w?.brandDecks?.length && {
          pages: w.brandDecks.slice(0, WALL_MAX_PAGES),
          pageRatio: w.brandDecks[0].ratio || 16 / 9,
          ratio: 16 / 9,
          baseDeg: PLATE_DEG * 1.8,
        },
        w?.albumArt?.length && {
          pages: w.albumArt.slice(0, WALL_MAX_PAGES),
          pageRatio: 1,
          ratio: 1.5,
          baseDeg: PLATE_DEG * 1.6,
        },
      ].filter(Boolean)
    : [];
  const anchorNx = BAND_TUNABLES.posX / FIELD_SPREAD_X;
  const anchorNy = (BAND_TUNABLES.posY - FIELD_OFFSET_Y) / FIELD_SPREAD_Y;
  const reserved = stripDefs.map((def, j) => ({
    nx: j === 0 ? anchorNx : -anchorNx,
    ny: j === 0 ? anchorNy : -anchorNy,
    ratio: def.ratio,
    baseDeg: def.baseDeg,
  }));

  const { blocks, reserved: stripBlocks, balanceStats } = placeDrumBlocks(chosen, {
    seed: w.slug,
    aspect: camera.aspect || 1,
    arcLon,
    reserved,
  });
  if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
    (window.__fpDrum ||= {})[w.slug] = {
      arcOffsetDeg: ctx.arcOffsetDeg || 0,
      arcLonDeg: arcLon / DEG2RAD,
      drumAdv: drum?.state?.adv,
      placedTiles: blocks.filter(Boolean).length,
      dropped: blocks.filter((b) => !b).length,
      strips: stripBlocks.length,
      balance: balanceStats,
      blocks: blocks.filter(Boolean).map((b) => ({
        lon: [(b.lon1 / DEG2RAD).toFixed(1), (b.lon2 / DEG2RAD).toFixed(1)],
        lat: [(b.lat1 / DEG2RAD).toFixed(1), (b.lat2 / DEG2RAD).toFixed(1)],
      })),
    };
  }

  // Screen-angle rects every trim element must clear (x = lat − VIEW_LAT,
  // y = lon − arcLon): the media blocks, the wall strips, and the WorldCard.
  const avoidRects = [...blocks.filter(Boolean), ...stripBlocks].map((b) => ({
    x1: b.lat1 - VIEW_LAT,
    x2: b.lat2 - VIEW_LAT,
    y1: b.lon1 - arcLon,
    y2: b.lon2 - arcLon,
  }));
  {
    const win = angularWindow(camera.aspect || 1);
    const cx = CARD_HALF * FIELD_SPREAD_X * win.halfLon;
    const cy = CARD_HALF * FIELD_SPREAD_Y * win.halfLat;
    const oy = FIELD_OFFSET_Y * win.halfLat;
    avoidRects.push({ x1: -cx, x2: cx, y1: -cy + oy, y2: cy + oy });
  }

  // Spawn slerps pull toward the ARC's own center, not the live view center.
  const arcCenterDir = blockCenterDir({ lonC: arcLon, latC: VIEW_LAT });

  const makeBorder = (block) => {
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0,
    });
    const border = new THREE.LineSegments(
      blockBorderGeometry(block, SHELL_RADIUS - BORDER_R_IN),
      material
    );
    border.renderOrder = ORDER_BORDER;
    return border;
  };

  let maxR = 0;
  for (const b of blocks) if (b) maxR = Math.max(maxR, b.nr);
  const bloomT0 = performance.now();

  const createPlate = (tile, i) => {
    const block = blocks[i];
    if (!block) return;
    const tierIndex = tierOf(i);
    const material = new THREE.MeshBasicMaterial({
      color: TILE_FALLBACK_COLOR,
      toneMapped: false,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(drumSectorGeometry(block, radius), material);
    mesh.renderOrder = ORDER_PLATE;
    slot.tierGroups[tierIndex].add(mesh);
    const border = makeBorder(block);
    mesh.add(border);

    // ?fptab — spine tab: accent stamp on the plate's bottom-left corner,
    // mono cell-coordinates rotated −90° (the letterpress plate label).
    let tab = null;
    if (FPTAB && block.latCells >= 4 && block.lonCells >= 5) {
      const tabBlock = {
        i1: block.i1,
        j1: block.j1,
        lonCells: 3,
        latCells: 2,
        lon1: block.i1 * D_LON,
        lon2: (block.i1 + 3) * D_LON,
        lat1: block.j1 * D_LAT,
        lat2: (block.j1 + 2) * D_LAT,
      };
      const latC = (tabBlock.lat1 + tabBlock.lat2) / 2;
      const tabCover =
        (tabBlock.lat2 - tabBlock.lat1) /
        Math.max(1e-6, (tabBlock.lon2 - tabBlock.lon1) * Math.sin(latC));
      const tex = makeTabTexture(
        `${String(block.j1).padStart(3, '0')}·${String(block.i1).padStart(3, '0')}`,
        accent
      );
      plateCover(tex, tabCover, 96 / 256);
      const tabMaterial = new THREE.MeshBasicMaterial({
        map: tex,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.BackSide,
      });
      tab = new THREE.Mesh(drumSectorGeometry(tabBlock, radius - 0.03), tabMaterial);
      tab.renderOrder = ORDER_TAB;
      mesh.add(tab);
    }

    const rec = {
      mesh,
      texture: null,
      tierIndex,
      appear: 0,
      qSpawn: spawnQuaternion(block, arcCenterDir),
      block,
      coverAspect: block.coverAspect,
      borderMaterial: border.material,
      playbackId: tile.playbackId || null,
      tabMaterial: tab ? tab.material : null,
      liveState: null,
      liveMix: 0,
      liveSlot: null,
      liveSince: 0,
      lastLiveAt: 0,
      videoMesh: null,
      videoTexture: null,
      makeOverlay: (video) => {
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        const texAspect =
          video.videoWidth > 0 && video.videoHeight > 0
            ? video.videoWidth / video.videoHeight
            : block.coverAspect;
        plateCover(texture, block.coverAspect, texAspect);
        const overlay = new THREE.Mesh(
          drumSectorGeometry(block, radius - OVERLAY_R_IN),
          new THREE.MeshBasicMaterial({
            map: texture,
            toneMapped: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.BackSide,
          })
        );
        overlay.renderOrder = ORDER_OVERLAY;
        return { mesh: overlay, texture };
      },
      extraDispose: () => {
        border.geometry.dispose();
        border.material.dispose();
        if (tab) {
          tab.geometry.dispose();
          tab.material.map?.dispose();
          tab.material.dispose();
        }
      },
    };
    slot.tiles.push(rec);

    const src = tileSrc(tile, thumb);
    if (!src) return;
    loader.load(
      src,
      (texture) => {
        if (isStale() || !slot.tiles.includes(rec)) {
          texture.dispose();
          return;
        }
        rec.texture = texture;
        plateCover(texture, block.coverAspect, tile.ratio || 1);
        material.map = texture;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        if (firstView && !PREFERS_REDUCED_MOTION) {
          rec.appear = 0;
          gsap.to(rec, {
            appear: 1,
            duration: TILE_APPEAR_DURATION,
            delay: Math.max(
              0,
              FANOUT_STAGGER * (maxR > 0 ? block.nr / maxR : 0) -
                (performance.now() - bloomT0) / 1000
            ),
            ease,
            overwrite: 'auto',
          });
        } else {
          rec.appear = 1;
        }
      },
      undefined,
      () => {}
    );
  };

  // 08-27: strips are WALL plates (fpDrumWall) — the detail page's
  // orthographic DeckScroller riding the drum. The meridian-wipe register
  // plate stays ATLAS-only.
  const createWall = (def, j) => {
    const wall = createWallPlate({
      block: stripBlocks[j],
      pages: def.pages,
      pageRatio: def.pageRatio,
      accent,
      parent: slot.tierGroups[BAND_TIER],
      drum,
      geometryFor: (b, rOut) => drumSectorGeometry(b, radius + rOut),
      borderGeometryFor: (b) => blockBorderGeometry(b, SHELL_RADIUS - BORDER_R_IN),
      spawnTarget: arcCenterDir,
      orders: { front: ORDER_STRIP_FRONT, border: ORDER_BORDER },
    });
    slot.bands.push(wall);
    if (firstView && !PREFERS_REDUCED_MOTION) {
      gsap.to(wall, {
        appear: 1,
        duration: TILE_APPEAR_DURATION,
        ease,
        overwrite: true,
      });
    } else {
      wall.appear = 1;
    }
  };

  // Trim (?fpglow / ?fpfurn) — the between-media dressing, one build each
  // per arc. Glow is pure shader (skip under reduced motion: the wave would
  // never run and the trace has no pointer).
  const createTrim = () => {
    const aspect = camera.aspect || 1;
    if ((FPGLOW === 1 || FPGLOW === 2) && !PREFERS_REDUCED_MOTION) {
      slot.bands.push(
        createDrumGlow(FPGLOW, {
          arcLon,
          aspect,
          accent,
          drum,
          lensPass: ctx.lensPass,
          pointer: ctx.pointer,
          parent: slot.tierGroups[BAND_TIER],
          ease,
        })
      );
    }
    if (FPFURN) {
      slot.bands.push(
        createDrumFurniture({
          seed: w.slug,
          arcLon,
          aspect,
          accent,
          avoid: avoidRects,
          parent: slot.tierGroups[BAND_TIER],
          ease,
        })
      );
    }
  };

  const gen = slot.buildGen;
  const stale = () => isStale() || slot.buildGen !== gen;
  const BATCH = Math.max(5, WORLD_MAX_VIDEO_TILES);
  const scheduleStrip = (j) => {
    if (j >= stripDefs.length) {
      requestAnimationFrame(() => {
        if (!stale()) createTrim();
      });
      return;
    }
    requestAnimationFrame(() => {
      if (stale()) return;
      createWall(stripDefs[j], j);
      scheduleStrip(j + 1);
    });
  };
  const runBatch = (start) => {
    if (stale()) return;
    const end = Math.min(start + BATCH, chosen.length);
    for (let i = start; i < end; i++) createPlate(chosen[i], i);
    if (end < chosen.length) requestAnimationFrame(() => runBatch(end));
    else scheduleStrip(0);
  };
  runBatch(0);
}
