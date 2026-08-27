/**
 * fpDrumWall.js — the orthographic DeckScroller wall as a DRUM plate (08-27).
 *
 * On the detail page, brand decks render as the DeckScroller wall: alternating
 * vertical columns of pages under hairline black gutters, idle-drifting, the
 * page's Lenis scroll accelerating every column in its own direction. This
 * module re-creates that wall INSIDE the drum: one canvas is laid out with the
 * DeckScroller's exact column math (VISIBLE_ROWS-derived columns, alternating
 * directions, (col + n·cols) % N page cycling, positive-mod wrap) and mapped
 * onto a drum sector, so the wall curves with the world and rolls with the
 * conveyor. The scroll coupling translates too: instead of Lenis velocity,
 * columns take a kick from |Δ drum roll| — a World Turn rushes the wall the
 * way scrolling the detail page does.
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
  IS_MOBILE,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

/* DeckScroller's baked layout constants (08-25 Nathan bake), in canvas terms.
   VISIBLE_ROWS sizes the columns; the gutter is proportional to the canvas
   (2px of a ~1400px detail frame ≈ 1px of our 640px canvas, floor 1). */
const VISIBLE_ROWS = 2;
/* 08-27 (2), Nathan: walls read fuzzy at 640 — a strip plate covers ~600+ css
   px at DPR 1.5, so the canvas ships at ~device resolution on desktop. The
   per-frame upload cost scales with the canvas area (repaints are
   movement-gated), so mobile keeps the lighter target. */
const CANVAS_W = IS_MOBILE ? 704 : 1152;
const PAGE_REQ_W = IS_MOBILE ? 480 : 800; // per-page texture request width
const BORDER_ALPHA = 0.9;

const pageSrc = (p) =>
  p.imageUrl
    ? `${p.imageUrl}?w=${PAGE_REQ_W}&auto=format&fit=max`
    : p.playbackId
      ? `https://image.mux.com/${p.playbackId}/thumbnail.webp?width=${PAGE_REQ_W}&fit_mode=preserve`
      : null;

/** drawImage cover-fit (the CSS object-fit:cover the DOM wall relies on). */
function drawCover(c, img, x, y, w, h) {
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
  c.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

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
}) {
  const W = CANVAS_W;
  const H = Math.max(64, Math.round(W / Math.max(0.2, block.coverAspect)));
  const GAP = Math.max(1, Math.round(W / 320)); // ≈2px per 640 — hairline gutters

  // DeckScroller layout math, verbatim in canvas px.
  const ratio = pageRatio && pageRatio > 0 ? pageRatio : 16 / 9;
  const idealPageH = H / VISIBLE_ROWS;
  const cols = Math.max(2, Math.round(W / (idealPageH * ratio)));
  const colW = (W - (cols - 1) * GAP) / cols;
  const pageH = colW / ratio;
  const perCol = Math.max(2, Math.ceil((H + pageH) / (pageH + GAP)));
  const cycleH = perCol * (pageH + GAP);
  const dirs = Array.from({ length: cols }, (_, i) => (i % 2 === 0 ? 1 : -1));
  const offsets = new Array(cols).fill(0);
  const mod = (x, n) => ((x % n) + n) % n;
  // Column i cycles pages (i + n·cols) mod N — reading order runs across the
  // wall then wraps (the DeckScroller idiom, every column stays populated).
  const columnPages = (col) =>
    Array.from({ length: perCol }, (_, n) => pages[(col + n * cols) % pages.length]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d');

  // Lazy page images — the canvas repaints as each lands (black ground first,
  // the DOM wall's --color-near-black pre-load convention).
  const images = new Map(); // src → { img, ready }
  let anyReady = false;
  for (const p of pages) {
    const src = pageSrc(p);
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

  const paintCanvas = () => {
    c.fillStyle = '#000000';
    c.fillRect(0, 0, W, H);
    for (let col = 0; col < cols; col++) {
      const cycle = columnPages(col);
      const x = col * (colW + GAP);
      let y = -mod(offsets[col], cycleH);
      // Enough copies to cover the frame at any wrap offset (the DOM strip's
      // two-copy render, expressed as a resumed walk).
      let n = 0;
      while (y < H) {
        const p = cycle[n % perCol];
        const entry = p && images.get(pageSrc(p));
        if (entry?.ready) drawCover(c, entry.img, x, y, colW, pageH);
        y += pageH + GAP;
        n++;
      }
    }
  };
  paintCanvas();

  const texture = new THREE.CanvasTexture(canvas);
  // Canvas aspect == block coverAspect by construction: plateCover reduces to
  // the BackSide U-flip (no crop).
  plateCover(texture, block.coverAspect, W / H);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    transparent: true,
    opacity: 0,
    side: THREE.BackSide,
  });
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
  let travelled = 0;

  const record = {
    group,
    appear: 0,
    qSpawn: spawnQuaternion(block, spawnTarget),
    disposed: false,
    paint(opacity) {
      material.opacity = opacity;
      borderMaterial.opacity = BORDER_ALPHA * opacity;
      if (PREFERS_REDUCED_MOTION) {
        // Static wall (the DOM wall's reduced-motion contract) — first
        // texture uploads still need a flush as images land.
        if (dirty && anyReady) {
          paintCanvas();
          texture.needsUpdate = true;
          dirty = false;
        }
        return;
      }
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
      const step = (WALL_DRIFT * dt + kick) * (W / 640);
      for (let i = 0; i < cols; i++) offsets[i] += dirs[i] * step;
      travelled += step;
      // Repaint on real movement (≥ ~1/4 canvas px) or a newly landed image;
      // skip entirely while the slot is faded out.
      if (opacity <= 0.001) return;
      if (travelled >= 0.25 || dirty) {
        paintCanvas();
        texture.needsUpdate = true;
        travelled = 0;
        dirty = false;
      }
    },
    dispose() {
      record.disposed = true;
      gsap.killTweensOf(record);
      for (const { img } of images.values()) img.onload = null;
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
