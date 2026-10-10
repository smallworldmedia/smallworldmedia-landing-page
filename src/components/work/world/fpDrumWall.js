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
 *  crops to the w × h page, then draws it dh tall (the atlas row stretch). */
function drawCover(c, img, x, y, w, h, dh = h) {
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
  c.drawImage(img, sx, sy, sw, sh, x, y, w, dh);
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

/**
 * Build a scrolling wall plate for one block.
 *
 * @param {Object} opts
 *   block        - placed drum block (finalized: lon/lat bounds + coverAspect)
 *   pages        - ordered page records ({ imageUrl, playbackId, ratio })
 *   pageRatio    - uniform page aspect for the wall (deck: pages[0].ratio, album: 1)
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
}) {
  const W = CANVAS_W;
  const H = Math.max(64, Math.round(W / Math.max(0.2, block.coverAspect)));
  const GAP = Math.max(1, Math.round(W / 320)); // ≈2px per 640 — hairline gutters

  // DeckScroller layout math, verbatim in canvas px.
  const ratio = pageRatio && pageRatio > 0 ? pageRatio : 16 / 9;
  const idealPageH = H / VISIBLE_ROWS;
  // r11: a caller-fixed column count (the mobile re-tier: deck 1 / album
  // 2) replaces the VISIBLE_ROWS-derived auto count when given.
  const cols =
    colsOverride > 0 ? Math.round(colsOverride) : Math.max(2, Math.round(W / (idealPageH * ratio)));
  const colW = (W - (cols - 1) * GAP) / cols;
  const pageH = colW / ratio;
  const perCol = Math.max(2, Math.ceil((H + pageH) / (pageH + GAP)));
  const reqW = Math.min(1024, Math.ceil(colW / 64) * 64);
  const srcOf = (p) => pageSrc(p, reqW);
  const pitch = pageH + GAP;
  const cycleH = perCol * pitch;
  // Column i cycles pages (i + n·cols) mod N — reading order runs across the
  // wall then wraps (the DeckScroller idiom, every column stays populated).
  const columnPages = (col) =>
    Array.from({ length: perCol }, (_, n) => pages[(col + n * cols) % pages.length]);

  // The static atlas: one page cycle per column, top to bottom.
  const atlasH = Math.ceil(cycleH / ATLAS_ROW_Q) * ATLAS_ROW_Q;
  const sigma = atlasH / cycleH; // atlas rows per canvas px (≥ 1)
  const atlasW = W + (cols - 1) * ATLAS_COL_PAD;
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
    for (let col = 0; col < cols; col++) {
      const cycle = columnPages(col);
      const x = col * (colW + GAP + ATLAS_COL_PAD);
      for (let n = 0; n < perCol; n++) {
        const p = cycle[n];
        const entry = p && images.get(srcOf(p));
        if (entry?.ready) drawCover(c, entry.img, x, n * pitch * sigma, colW, pageH, pageH * sigma);
      }
    }
  };
  paintAtlas();

  const texture = new THREE.CanvasTexture(canvas);
  // plateCover maps the VIRTUAL W × H canvas (aspect == block coverAspect by
  // construction: the BackSide U-flip, no crop); the shader takes it on into
  // the atlas. The cycle repeats down the strip.
  plateCover(texture, block.coverAspect, W / H);
  texture.wrapT = THREE.RepeatWrapping;
  const uniforms = {
    // Column travel in atlas rows, wrapped on the CPU to [0, atlasH) so
    // float32 stays exact however long the session runs.
    uWallTravel: { value: 0 },
    uWallGeom: { value: new THREE.Vector4(W, H, colW + GAP, cols) },
    uWallAtlas: { value: new THREE.Vector4(atlasW, atlasH, sigma, ATLAS_COL_PAD) },
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
      .replace('#include <map_fragment>', WALL_MAP_FRAGMENT);
  };
  material.customProgramCacheKey = () => 'fpDrumWall-atlas';
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
  let travel = 0; // canvas px, [0, cycleH)

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
      travel = (travel + (WALL_DRIFT * dt + kick) * (W / 640)) % cycleH;
      uniforms.uWallTravel.value = travel * sigma;
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
