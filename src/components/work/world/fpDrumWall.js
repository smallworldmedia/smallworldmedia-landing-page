/**
 * fpDrumWall.js — the orthographic DeckScroller wall as a DRUM plate (08-27).
 *
 * On the detail page, brand decks render as the DeckScroller wall: alternating
 * vertical columns of pages under hairline black gutters, idle-drifting, the
 * page's Lenis scroll accelerating every column in its own direction. This
 * module re-creates that wall INSIDE the drum: one canvas is laid out with the
 * DeckScroller's exact column math (VISIBLE_ROWS-derived columns, alternating
 * directions, (col + n·cols) % N page cycling; the cycle wraps in the shader,
 * 10-09 below) and mapped onto a drum sector, so the wall curves with the
 * world and rolls with the conveyor. The scroll coupling translates too:
 * instead of Lenis velocity, columns take a kick from |Δ drum roll| — a World
 * Turn rushes the wall the way scrolling the detail page does.
 *
 * 10-09 (deck-wall flicker): the pages no longer move INSIDE the texture.
 * Repainting a moving canvas re-sampled every page at a new sub-pixel phase
 * each frame (one phase per column, ~1:1 scale) and rebuilt the mip chain on
 * every upload, so sharpness pumped with the drift — worst at lower DPR,
 * where the GPU reads the rebuilt mips. Now each column's page cycle is
 * painted ONCE into a static atlas (re-painted only as pages land) and the
 * plate's shader scrolls it: one wrapped travel uniform, even columns one
 * way, odd columns the other, the hardware Repeat wrapping the cycle.
 *
 * One implementation serves both strips: brand decks (16:9 pages) and album
 * art (square covers) — the deck-page viewing component, brought over to the
 * grid, per Nathan's 08-27 call. Replaces createRegisterPlate in DRUM only
 * (ATLAS keeps its meridian-wipe register plates).
 *
 * 11-11 (US-4): a second AXIS. A carousel reads like a social feed, so its
 * plate lays the atlas out as ROWS and the shader travels on u: slides run
 * left to right, row 0 drifts leftward, odd rows the other way, the same
 * WALL_DRIFT idle and |Δ roll| kick. One row by default (the detail page's
 * strip: ?carouselvis slides across). The x atlas is the y atlas transposed;
 * the y path is untouched.
 *
 * Record contract (slot.bands): { group, appear, qSpawn, paint(opacity),
 * dispose() } — applyAtlasSlot slerps group by appear and calls paint with the
 * composited fade × slot opacity every frame.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { plateCover, spawnQuaternion } from './fpAtlas.js';
import {
  WALL_DRIFT,
  WALL_GEAR,
  WALL_CANVAS_PX,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

/* DeckScroller's baked layout constants (08-25 Nathan bake), in canvas terms.
   VISIBLE_ROWS sizes the columns; the gutter is proportional to the canvas
   (2px of a ~1400px detail frame ≈ 1px of our 640px canvas, floor 1). */
const VISIBLE_ROWS = 2;
/* 08-27 (2), Nathan: walls read fuzzy at 640 — a strip plate covers ~600+ css
   px at DPR 1.5, so the canvas ships at ~device resolution on desktop. The
   wall is laid out on this virtual W × H canvas; the atlas below holds one
   page cycle per column at the same horizontal resolution. */
const CANVAS_W = WALL_CANVAS_PX; // r11b: ?wallpx (mobile 896, was 704; desktop 1152 up to pixel ratio 1.5, then 768 × ratio)
const BORDER_ALPHA = 0.9;
/* Atlas shape (10-09). The cycle height rounds UP to a multiple of ROW_Q
   texels (the pages stretch by that sliver; the shader divides it back out),
   so mip levels 0–4 tile the cycle exactly and the Repeat wrap is seamless
   at every level the plate reaches. COL_PAD widens the black gutters in the
   ATLAS only, so a mip texel never mixes a neighbouring column's pages. */
const ATLAS_ROW_Q = 16;
const ATLAS_COL_PAD = 16;
/* The x axis holds a whole carousel on one strip (slides side by side), so
   its atlas is the long one: capped at a width every WebGL2 GPU samples. */
const ATLAS_MAX_W = 8192;

// r11b (Nathan: walls read soft): the per-page texture request width follows
// the wall's COLUMN width — a fixed 480 drawn into a 704px single column
// was a 1.5× upscale. Rounded up to a 64px step (CDN cache-friendly),
// capped at 1024. Decode cost only; nothing per frame.
const pageSrc = (p, reqW) =>
  p.imageUrl
    ? `${p.imageUrl}?w=${reqW}&auto=format&fit=max`
    : p.playbackId
      ? `https://image.mux.com/${p.playbackId}/thumbnail.webp?width=${reqW}&fit_mode=preserve`
      : null;

/** drawImage cover-fit (the CSS object-fit:cover the DOM wall relies on):
 *  crops to the w × h page, then draws it dh tall (the y atlas's row stretch)
 *  and dw wide (the x atlas's). */
function drawCover(c, img, x, y, w, h, dh = h, dw = w) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const ia = iw / ih;
  const ca = w / h;
  let sx = 0;
  let sy = 0;
  let sw = iw;
  let sh = ih;
  if (ia > ca) {
    sw = ih * ca;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / ca;
    sy = (ih - sh) / 2;
  }
  c.drawImage(img, sx, sy, sw, sh, x, y, dw, dh);
}

/* The plate's map lookup, scrolled. vMapUv (plateCover's U-flip + crop) is
   mapped to the virtual W × H canvas, then into the atlas: each column at its
   own x (+ COL_PAD per column), rows stretched by sigma and offset by the
   column's travel (even columns +, odd −). Gradients come from the UNscrolled
   plate UV — the travel jumps at gutters and wraps at the cycle, the
   footprint never does — so the mip level never spikes at a seam. */
const WALL_MAP_FRAGMENT = /* glsl */ `
#ifdef USE_MAP
	float wallX = vMapUv.x * uWallGeom.x;
	float wallY = ( 1.0 - vMapUv.y ) * uWallGeom.y;
	float wallCol = clamp( floor( wallX / uWallGeom.z ), 0.0, uWallGeom.w - 1.0 );
	float wallDir = 1.0 - 2.0 * mod( wallCol, 2.0 );
	vec2 wallUv = vec2(
		( wallX + wallCol * uWallAtlas.w ) / uWallAtlas.x,
		1.0 - ( uWallAtlas.z * wallY + wallDir * uWallTravel ) / uWallAtlas.y
	);
	vec2 wallGrad = vec2( uWallGeom.x / uWallAtlas.x, uWallAtlas.z * uWallGeom.y / uWallAtlas.y );
	vec4 sampledDiffuseColor = textureGrad( map, wallUv, dFdx( vMapUv ) * wallGrad, dFdy( vMapUv ) * wallGrad );
	diffuseColor *= sampledDiffuseColor;
#endif
`;

/* The x axis's lookup: the same map, transposed. Rows (not columns) own the
   cross axis and the travel runs on u: row 0 +, odd rows −, so row 0's
   content moves LEFT. uWallGeom = (W, H, row pitch, rows); uWallAtlas =
   (atlasW, atlasH, sigma, ROW_PAD), sigma = atlas columns per canvas px
   along the stretched cycle. */
const WALL_MAP_FRAGMENT_X = /* glsl */ `
#ifdef USE_MAP
	float wallX = vMapUv.x * uWallGeom.x;
	float wallY = ( 1.0 - vMapUv.y ) * uWallGeom.y;
	float wallRow = clamp( floor( wallY / uWallGeom.z ), 0.0, uWallGeom.w - 1.0 );
	float wallDir = 1.0 - 2.0 * mod( wallRow, 2.0 );
	vec2 wallUv = vec2(
		( uWallAtlas.z * wallX + wallDir * uWallTravel ) / uWallAtlas.x,
		1.0 - ( wallY + wallRow * uWallAtlas.w ) / uWallAtlas.y
	);
	vec2 wallGrad = vec2( uWallAtlas.z * uWallGeom.x / uWallAtlas.x, uWallGeom.y / uWallAtlas.y );
	vec4 sampledDiffuseColor = textureGrad( map, wallUv, dFdx( vMapUv ) * wallGrad, dFdy( vMapUv ) * wallGrad );
	diffuseColor *= sampledDiffuseColor;
#endif
`;

/* Layout per axis. Both return the same shape: the atlas size, `cycle` (the
   canvas px length the travel wraps at) with its atlas stretch `sigma`, the
   shader's two vec4s, the page request width, and one cell per painted page. */

// y — DeckScroller's column math, verbatim in canvas px. Column i cycles
// pages (i + n·cols) mod N: reading order runs across the wall then wraps
// (every column stays populated).
export function layoutCols({ W, H, GAP, ratio, pages, colsOverride }) {
  const idealPageH = H / VISIBLE_ROWS;
  // r11: a caller-fixed column count (the mobile re-tier: deck 1 / album
  // 2) replaces the VISIBLE_ROWS-derived auto count when given.
  const cols =
    colsOverride > 0 ? Math.round(colsOverride) : Math.max(2, Math.round(W / (idealPageH * ratio)));
  const colW = (W - (cols - 1) * GAP) / cols;
  const pageH = colW / ratio;
  const perCol = Math.max(2, Math.ceil((H + pageH) / (pageH + GAP)));
  const pitch = pageH + GAP;
  const cycle = perCol * pitch;
  const atlasH = Math.ceil(cycle / ATLAS_ROW_Q) * ATLAS_ROW_Q;
  const sigma = atlasH / cycle; // atlas rows per canvas px (≥ 1)
  const atlasW = W + (cols - 1) * ATLAS_COL_PAD;
  const cells = [];
  for (let col = 0; col < cols; col++) {
    const x = col * (colW + GAP + ATLAS_COL_PAD);
    for (let n = 0; n < perCol; n++) {
      cells.push({
        page: pages[(col + n * cols) % pages.length],
        x,
        y: n * pitch * sigma,
        w: colW,
        h: pageH,
        dh: pageH * sigma,
        dw: colW,
      });
    }
  }
  return {
    cols,
    rows: 0,
    pageW: colW,
    atlasW,
    atlasH,
    sigma,
    cycle,
    geom: [W, H, colW + GAP, cols],
    pad: ATLAS_COL_PAD,
    cells,
  };
}

// x — the transpose. `across` slides fit the plate's width; rows follow the
// plate's height (one, when the footprint was sized for it). Row r cycles
// pages (r + n·rows) mod N, so a single row reads 1..N left to right, and
// the cycle holds the WHOLE set (not just a window's worth) up to the atlas
// cap, repeated whole when the set is shorter than the window.
export function layoutRows({ W, H, GAP, ratio, pages, across }) {
  const vis = Math.max(1, across);
  const slideW = (W - (vis - 1) * GAP) / vis;
  const pitch = slideW + GAP;
  const rows = Math.max(1, Math.round((H + GAP) / (slideW / ratio + GAP)));
  const slideH = (H - (rows - 1) * GAP) / rows; // slides fill the plate (cover-cropped)
  const n = pages.length;
  const minPer = Math.ceil(W / pitch) + 1;
  const wholeSets = n >= minPer ? n : n * Math.ceil(minPer / n);
  const perRow = Math.min(wholeSets, Math.max(minPer, Math.floor(ATLAS_MAX_W / pitch)));
  const cycle = perRow * pitch;
  const atlasW = Math.ceil(cycle / ATLAS_ROW_Q) * ATLAS_ROW_Q;
  const sigma = atlasW / cycle; // atlas columns per canvas px (≥ 1)
  const atlasH = H + (rows - 1) * ATLAS_COL_PAD;
  const cells = [];
  for (let row = 0; row < rows; row++) {
    const y = row * (slideH + GAP + ATLAS_COL_PAD);
    for (let k = 0; k < perRow; k++) {
      cells.push({
        page: pages[(row + k * rows) % n],
        x: k * pitch * sigma,
        y,
        w: slideW,
        h: slideH,
        dh: slideH,
        dw: slideW * sigma,
      });
    }
  }
  return {
    cols: 0,
    rows,
    pageW: slideW,
    atlasW,
    atlasH,
    sigma,
    cycle,
    geom: [W, H, slideH + GAP, rows],
    pad: ATLAS_COL_PAD,
    cells,
  };
}

/**
 * Build a scrolling wall plate for one block.
 *
 * @param {Object} opts
 *   block        - placed drum block (finalized: lon/lat bounds + coverAspect)
 *   pages        - ordered page records ({ imageUrl, playbackId, ratio })
 *   pageRatio    - uniform page aspect for the wall (deck: pages[0].ratio, album: 1)
 *   cols         - y axis: caller-fixed column count (0 = the auto count)
 *   axis         - 'y' (columns of pages, travel on v — decks, album art) or
 *                  'x' (rows of pages, travel on u — carousels)
 *   across       - x axis: slides across the plate's width (?carouselvis)
 *   accent       - project color (hex number)
 *   parent       - THREE.Group to mount into (slot tier group)
 *   drum         - the drum record (roll-velocity coupling reads state.adv)
 *   geometryFor  - (block, rOut) => BufferGeometry (drumSectorGeometry hook)
 *   borderGeometryFor - (block) => BufferGeometry for the accent border
 *   spawnTarget  - great-circle slerp target (the arc's own center)
 *   orders       - { front, border } renderOrders
 */
export function createWallPlate({
  block,
  pages,
  pageRatio,
  accent,
  parent,
  drum,
  geometryFor,
  borderGeometryFor,
  spawnTarget,
  orders,
  cols: colsOverride = 0,
  axis = 'y',
  across = 0,
}) {
  const W = CANVAS_W;
  const H = Math.max(64, Math.round(W / Math.max(0.2, block.coverAspect)));
  const GAP = Math.max(1, Math.round(W / 320)); // ≈2px per 640 — hairline gutters

  const isX = axis === 'x';
  const ratio = pageRatio && pageRatio > 0 ? pageRatio : 16 / 9;
  const layout = isX
    ? layoutRows({ W, H, GAP, ratio, pages, across })
    : layoutCols({ W, H, GAP, ratio, pages, colsOverride });
  const { cols, rows, atlasW, atlasH, sigma, cycle } = layout;
  const reqW = Math.min(1024, Math.ceil(layout.pageW / 64) * 64);
  const srcOf = (p) => pageSrc(p, reqW);

  // The static atlas: one page cycle per column (y) or row (x).
  const canvas = document.createElement('canvas');
  canvas.width = atlasW;
  canvas.height = atlasH;
  const c = canvas.getContext('2d');
  // The atlas is painted once, not every frame: if the browser drops the 2D
  // backing store (contextlost, then contextrestored, e.g. after a GPU reset)
  // it comes back cleared, so a restore marks it for the next paint().
  // Chromium and Firefox fire these; WebKit has no 2D context-loss event, so
  // on Safari (iOS too) a dropped atlas waits for the next page landing.
  const onRestored = () => {
    dirty = true;
  };
  canvas.addEventListener('contextrestored', onRestored);

  // Lazy page images — the atlas repaints as each lands (black ground first,
  // the DOM wall's --color-near-black pre-load convention).
  const images = new Map(); // src → { img, ready }
  let anyReady = false;
  for (const p of pages) {
    const src = srcOf(p);
    if (!src || images.has(src)) continue;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const entry = { img, ready: false };
    img.onload = () => {
      if (record.disposed) return;
      entry.ready = true;
      anyReady = true;
      dirty = true;
    };
    img.src = src;
    images.set(src, entry);
  }

  const paintAtlas = () => {
    c.fillStyle = '#000000';
    c.fillRect(0, 0, atlasW, atlasH);
    for (const cell of layout.cells) {
      const entry = cell.page && images.get(srcOf(cell.page));
      if (entry?.ready) drawCover(c, entry.img, cell.x, cell.y, cell.w, cell.h, cell.dh, cell.dw);
    }
  };
  paintAtlas();

  const texture = new THREE.CanvasTexture(canvas);
  // plateCover maps the VIRTUAL W × H canvas (aspect == block coverAspect by
  // construction: the BackSide U-flip, no crop); the shader takes it on into
  // the atlas. The cycle repeats down the strip (y) or along it (x).
  plateCover(texture, block.coverAspect, W / H);
  if (isX) texture.wrapS = THREE.RepeatWrapping;
  else texture.wrapT = THREE.RepeatWrapping;
  const uniforms = {
    // Travel in atlas texels along the cycle, wrapped on the CPU to
    // [0, atlas length) so float32 stays exact however long the session runs.
    uWallTravel: { value: 0 },
    uWallGeom: { value: new THREE.Vector4(...layout.geom) },
    uWallAtlas: { value: new THREE.Vector4(atlasW, atlasH, sigma, layout.pad) },
  };
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        'uniform float uWallTravel;\nuniform vec4 uWallGeom;\nuniform vec4 uWallAtlas;\nvoid main() {'
      )
      .replace('#include <map_fragment>', isX ? WALL_MAP_FRAGMENT_X : WALL_MAP_FRAGMENT);
  };
  material.customProgramCacheKey = () => (isX ? 'fpDrumWall-atlas-x' : 'fpDrumWall-atlas');
  const mesh = new THREE.Mesh(geometryFor(block, 0), material);
  mesh.renderOrder = orders.front;

  const borderMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(accent),
    transparent: true,
    opacity: 0,
  });
  const border = new THREE.LineSegments(borderGeometryFor(block), borderMaterial);
  border.renderOrder = orders.border;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(border);
  parent.add(group);

  let lastNow = performance.now();
  let lastAdv = drum?.state?.adv ?? 0;
  let dirty = true;
  let travel = 0; // canvas px, [0, cycle)

  const record = {
    group,
    appear: 0,
    qSpawn: spawnQuaternion(block, spawnTarget),
    disposed: false,
    paint(opacity) {
      material.opacity = opacity;
      borderMaterial.opacity = BORDER_ALPHA * opacity;
      // Pages land late: each landing repaints the atlas once (one upload, one
      // mip build). Nothing uploads while the wall moves.
      if (dirty && anyReady) {
        paintAtlas();
        texture.needsUpdate = true;
        dirty = false;
      }
      // Static wall under reduced motion (the DOM wall's contract).
      if (PREFERS_REDUCED_MOTION) return;
      const now = performance.now();
      const dt = Math.min(now - lastNow, 100) / 1000; // tab-return clamp
      lastNow = now;
      // Idle drift + roll coupling: |Δ adv| stands in for the Lenis velocity
      // kick — a Turn (or ?creep) rushes every column in its own direction.
      const adv = drum?.state?.adv ?? lastAdv;
      const kick = Math.abs(adv - lastAdv) * WALL_GEAR;
      lastAdv = adv;
      // Knobs are calibrated at the original 640px canvas — scale with the
      // shipped resolution so the on-screen rate is resolution-independent.
      travel = (travel + (WALL_DRIFT * dt + kick) * (W / 640)) % cycle;
      uniforms.uWallTravel.value = travel * sigma;
    },
    // Debug handle only (?debug → window.__fpDrum[slug].seekWalls): park the
    // travel at a fraction of the cycle — how a probe checks the Repeat wrap.
    seek(frac) {
      travel = (((frac % 1) + 1) % 1) * cycle;
      uniforms.uWallTravel.value = travel * sigma;
    },
    // Read-only snapshot for the debug handle (window.__fpDrum[slug].walls).
    probe(camera) {
      const g = mesh.geometry; // a drum sector, built in place: project its vertices for the on-screen rect
      const pos = g.attributes.position;
      const v = new THREE.Vector3();
      const ndc = [Infinity, Infinity, -Infinity, -Infinity];
      mesh.updateWorldMatrix(true, false);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(camera);
        ndc[0] = Math.min(ndc[0], v.x);
        ndc[1] = Math.min(ndc[1], v.y);
        ndc[2] = Math.max(ndc[2], v.x);
        ndc[3] = Math.max(ndc[3], v.y);
      }
      const r = (n) => Math.round(n * 100) / 100;
      return {
        axis,
        travelAxis: isX ? 'u' : 'v', // which texture axis uWallTravel scrolls
        cols,
        rows,
        pageRatio: ratio,
        coverAspect: r(block.coverAspect), // the plate's projected w/h
        canvas: [W, H],
        atlas: [atlasW, atlasH],
        uWallTravel: uniforms.uWallTravel.value,
        sigma,
        travelLen: isX ? atlasW : atlasH, // the uniform wraps here (atlas texels along the travel axis)
        ndc: ndc.map(r),
      };
    },
    dispose() {
      record.disposed = true;
      gsap.killTweensOf(record);
      for (const { img } of images.values()) img.onload = null;
      canvas.removeEventListener('contextrestored', onRestored);
      images.clear();
      parent.remove(group);
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
      border.geometry.dispose();
      borderMaterial.dispose();
    },
  };
  return record;
}
