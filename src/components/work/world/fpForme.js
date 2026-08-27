/**
 * fpForme.js — ?fpgrid=2 "FORME": the locked letterpress sheet.
 *
 * One flat editorial page hangs at tile depth: a planar lattice (straight
 * lines the lens pass curves spherical) that media planes lock into like cuts
 * in a letterpress forme — edges exactly on cell lines, each block wearing a
 * rule frame that runs the CTA ink states (white flash on arrival → project
 * accent at rest). The lattice pitch is deliberately COARSER than the shell's
 * (PANE_PITCH × the fine pitch, near-square) so the dimmed spherical shell
 * reads as deep atmosphere instead of a phase-shifted moiré twin.
 *
 * Empty cells do the compositional work — furniture: registration crosses at
 * seeded intersections, mono cell coordinates (R04 C11), whisper-opacity
 * accent floods, and an idle blink on a random empty cell every few seconds.
 *
 * THE TURN IS A RE-DEAL: nothing travels. A deallocation wavefront sweeps the
 * lattice on the house curve (bottom→top going forward, mirroring the roll
 * direction), outgoing blocks retracting cell-row by cell-row to stroke
 * ghosts, the incoming project allocating one beat behind — frames first,
 * media printing in as textures land. The lens spike crests as the front
 * crosses midfield. The wave parts around the WorldCard's reserve.
 *
 * Parallax: the pane (lattice + both slots) micro-translates as ONE body over
 * the shell's smaller drift (depth cue), the lens principal point leans
 * toward the cursor, and each image breathes ~1.5% inside its immobile frame
 * (ink misregistration).
 *
 * Wipes cut with world-space clipping planes (material-agnostic — video
 * overlays keep their built-in sRGB decode); every media material carries ONE
 * always-attached plane, parked at pass-all when idle, so toggling never
 * recompiles shaders.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { hashSeed, mulberry32 } from './seededLayout.js';
import { D_LAT } from './fpGridCells.js';
import {
  CAMERA_FOV,
  FPGRID_WINDOW,
  PANE_PITCH,
  PLATE_DEG,
  MAX_TILES,
  MIN_TILES,
  thumbForCount,
  DEPTH_TIERS,
  TILE_FALLBACK_COLOR,
  TILE_APPEAR_DURATION,
  FANOUT_STAGGER,
  WORLD_MAX_VIDEO_TILES,
  BANDS_ENABLED,
  BAND_TIER,
  BAND_TUNABLES,
  BAND_MAX_PAGES,
  BAND_TEX_WIDTH,
  TURN_DURATION,
  SHELL_LINE_COLOR,
  CENTER_CLEAR_FRAC,
  CLUSTER_RADIUS,
  OVERLAP_JITTER,
  FIELD_OFFSET_Y,
  FIELD_SPREAD_X,
  FIELD_SPREAD_Y,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

export const Z_PANE = -3.8; // the lattice sheet
const Z_MEDIA = -3.78; // media just proud of the lattice (occludes interior lines)
const Z_FLOOD = -3.81; // accent floods tucked behind the lattice
const SLOT_Z_BIAS = 0.005; // per-slot separation while both are up in a Turn

/** Macro-cell pitch: PANE_PITCH × the shell's fine LAT pitch projected at the
 *  pane depth — near-square, registered to the room's fabric without copying
 *  its pitch. */
export const PITCH = 2 * Math.abs(Z_PANE) * Math.tan((D_LAT * PANE_PITCH) / 2);

/* FORME parallax voices (the pane is one body; depth reads against the shell) */
export const PANE_DRIFT = 0.05; // one-body pane translation amplitude (world units)
export const PP_DRIFT = 0.032; // lens principal-point lean toward the cursor
export const BREATHE = 0.015; // intra-frame ink misregistration (UV fraction)

/* renderOrder: shell (30, set in useWorldScene) → floods → lattice → captions
   → media → video overlays → frames/crosses. */
const ORDER_FLOOD = 32;
const ORDER_LATTICE = 34;
const ORDER_CAPTION = 35;
const ORDER_MEDIA = 40;
const ORDER_OVERLAY = 42;
const ORDER_FRAME = 44;

const FRAME_ALPHA = 0.95;
const GHOST_ALPHA = 0.4; // stroke-ghost weight while a block is (de)allocating
const WHITE = new THREE.Color(0xffffff);

const PASS_ALL = 1000; // parked clip-plane constant (keeps everything)

const tileSrc = (t, thumb) =>
  t.playbackId
    ? `https://image.mux.com/${t.playbackId}/thumbnail.webp?width=${thumb}`
    : t.imageUrl
      ? `${t.imageUrl}?w=${thumb}&auto=format&fit=max`
      : null;
const pageSrc = (p) =>
  p.imageUrl
    ? `${p.imageUrl}?w=${BAND_TEX_WIDTH}&auto=format&fit=max`
    : p.playbackId
      ? `https://image.mux.com/${p.playbackId}/thumbnail.webp?width=${BAND_TEX_WIDTH}&fit_mode=preserve`
      : null;

function coverFit(texture, planeAspect, texAspect) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.center.set(0.5, 0.5);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const ta = texAspect || 1;
  if (ta > planeAspect) texture.repeat.set(planeAspect / ta, 1);
  else texture.repeat.set(1, ta / planeAspect);
}

/** Visible half-extents of the pane at Z_PANE (lens margin included). */
export function paneWindow(aspect) {
  const halfH = Math.abs(Z_PANE) * Math.tan((CAMERA_FOV * DEG2RAD) / 2) * FPGRID_WINDOW;
  return { halfH, halfW: halfH * (aspect || 1) };
}

/* ── Mono ink textures (cell coordinates, folio) — canvas-rendered in the
      house UI-mono voice. One quad per caption. ── */
function inkTexture(text, color, px = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 256, 128);
  c.font = `500 ${px * 0.38}px "SFMono-Regular", Menlo, Consolas, monospace`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(text, 128, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── The pane lattice — scene-level, built once; it NEVER re-deals. ── */
export function createFormeLattice(scene, aspect) {
  const { halfW, halfH } = paneWindow(aspect);
  const W = halfW * 1.25; // margin for parallax travel
  const H = halfH * 1.25;
  const cols = Math.ceil(W / PITCH);
  const rows = Math.ceil(H / PITCH);
  const positions = [];
  for (let k = -cols; k <= cols; k++)
    positions.push(k * PITCH, -H, Z_PANE, k * PITCH, H, Z_PANE);
  for (let j = -rows; j <= rows; j++)
    positions.push(-W, j * PITCH, Z_PANE, W, j * PITCH, Z_PANE);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: SHELL_LINE_COLOR,
    transparent: true,
    opacity: 0.5,
  });
  const lattice = new THREE.LineSegments(geometry, material);
  lattice.renderOrder = ORDER_LATTICE;
  scene.add(lattice);
  return {
    lattice,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
      scene.remove(lattice);
    },
  };
}

/* ── Seeded planar block placement — the seededLayout annulus idiom in pane
      cell space, with the card keep-out and ring-walk resolution. ── */
const GUTTER = 1;
const CARD_HALF = CENTER_CLEAR_FRAC * 0.6;

function placeFormeBlocks(items, { seed, aspect, reserved = [] }) {
  const rand = mulberry32(hashSeed(seed || 'world'));
  const { halfW, halfH } = paneWindow(aspect);
  const placed = [];
  const baseWorld = 2 * Math.abs(Z_PANE) * Math.tan((PLATE_DEG * DEG2RAD) / 2);
  const cellsBase = Math.max(2, Math.round(baseWorld / PITCH));

  const spanFor = (ratio, mul = 1) => {
    const r = ratio && ratio > 0 ? ratio : 1;
    const base = Math.max(2, Math.round(cellsBase * mul));
    return {
      cols: r >= 1 ? base : Math.max(2, Math.round(base * r)),
      rows: r >= 1 ? Math.max(2, Math.round(base / r)) : base,
    };
  };
  const norm = (x, y) => ({
    nx: x / (FIELD_SPREAD_X * halfW),
    ny: (y / halfH - FIELD_OFFSET_Y) / FIELD_SPREAD_Y,
  });
  const overlaps = (a, b) =>
    a.k1 - GUTTER < b.k1 + b.cols &&
    a.k1 + a.cols + GUTTER > b.k1 &&
    a.j1 - GUTTER < b.j1 + b.rows &&
    a.j1 + a.rows + GUTTER > b.j1;
  const intersectsCard = (b) => {
    const c1 = norm(b.k1 * PITCH, b.j1 * PITCH);
    const c2 = norm((b.k1 + b.cols) * PITCH, (b.j1 + b.rows) * PITCH);
    return (
      Math.min(c1.nx, c2.nx) < CARD_HALF &&
      Math.max(c1.nx, c2.nx) > -CARD_HALF &&
      Math.min(c1.ny, c2.ny) < CARD_HALF &&
      Math.max(c1.ny, c2.ny) > -CARD_HALF
    );
  };
  const inWindow = (b) =>
    b.k1 * PITCH >= -halfW &&
    (b.k1 + b.cols) * PITCH <= halfW &&
    b.j1 * PITCH >= -halfH &&
    (b.j1 + b.rows) * PITCH <= halfH;
  const isClear = (b) =>
    inWindow(b) && !intersectsCard(b) && placed.every((p) => !overlaps(b, p));
  const quantize = (xC, yC, span) => ({
    k1: Math.round(xC / PITCH - span.cols / 2),
    j1: Math.round(yC / PITCH - span.rows / 2),
    cols: span.cols,
    rows: span.rows,
  });
  const finalize = (b, nr) => ({
    ...b,
    x: (b.k1 + b.cols / 2) * PITCH,
    y: (b.j1 + b.rows / 2) * PITCH,
    w: b.cols * PITCH,
    h: b.rows * PITCH,
    nr,
  });

  const RING_STEP = 0.16;
  const RING_GROW = 0.17;
  const ringSteps = { n: 0 };
  const resolveOnRing = (nx0, ny0, span) => {
    const r0 = Math.hypot(nx0, ny0) || 1e-6;
    const th0 = Math.atan2(ny0, nx0);
    const max = Math.ceil(TAU / RING_STEP);
    for (let layer = 0; layer < 3; layer++) {
      const rl = Math.min(1, r0 + layer * RING_GROW);
      for (let s = 0; s <= max; s++) {
        const th = th0 + (s === 0 ? 0 : (s + ringSteps.n) * RING_STEP);
        const x = Math.cos(th) * rl * FIELD_SPREAD_X * halfW;
        const y = (Math.sin(th) * rl * FIELD_SPREAD_Y + FIELD_OFFSET_Y) * halfH;
        const b = quantize(x, y, span);
        if (isClear(b)) {
          if (s > 0) ringSteps.n++;
          return { b, nr: rl };
        }
      }
    }
    return null;
  };

  // Reserved (signature) blocks first — house anchor, outward step-out.
  const reservedOut = reserved.map((r) => {
    const x = r.nx * FIELD_SPREAD_X * halfW;
    const y = (r.ny * FIELD_SPREAD_Y + FIELD_OFFSET_Y) * halfH;
    const b = quantize(x, y, spanFor(r.ratio, r.mul));
    for (let s = 0; s < 60; s++) {
      if (!intersectsCard(b) && placed.every((p) => !overlaps(b, p))) break;
      b.k1 += Math.sign(r.nx || 1);
      b.j1 += Math.sign(r.ny || 1);
    }
    b.k1 = Math.min(Math.max(b.k1, Math.round(-halfW / PITCH)), Math.round(halfW / PITCH - b.cols));
    b.j1 = Math.min(Math.max(b.j1, Math.round(-halfH / PITCH)), Math.round(halfH / PITCH - b.rows));
    placed.push(b);
    return finalize(b, Math.hypot(r.nx, r.ny));
  });

  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const innerR = CENTER_CLEAR_FRAC;
  const outerR = Math.max(CLUSTER_RADIUS, innerR + 1e-3);
  const angleOffset = rand() * TAU;
  const n = items.length;
  const blocks = items.map((item, i) => {
    const t = n > 1 ? (i + 0.5) / n : 0;
    const baseR = Math.sqrt(innerR * innerR + t * (outerR * outerR - innerR * innerR));
    const ang = i * GOLDEN_ANGLE + angleOffset;
    let nx = Math.cos(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    let ny = Math.sin(ang) * baseR + (rand() * 2 - 1) * OVERLAP_JITTER;
    const r = Math.hypot(nx, ny) || 1e-6;
    const clamped = Math.min(Math.max(r, innerR), outerR);
    nx = (nx / r) * clamped;
    ny = (ny / r) * clamped;
    const res = resolveOnRing(nx, ny, spanFor(item.ratio));
    if (!res) return null;
    placed.push(res.b);
    return finalize(res.b, res.nr);
  });

  return { blocks, reserved: reservedOut, placed, halfW, halfH, spanFor };
}

/* ── Block chrome: the rule frame (+ corner quoin ticks) in one LineSegments. ── */
function frameGeometry(w, h) {
  const x = w / 2;
  const y = h / 2;
  const t = Math.min(w, h) * 0.14; // quoin tick length
  const p = [
    // rule rect
    -x, -y, 0, x, -y, 0, x, -y, 0, x, y, 0,
    x, y, 0, -x, y, 0, -x, y, 0, -x, -y, 0,
    // corner ticks, set just outside (the wedged-in read)
    -x - t, -y, 0, -x, -y, 0, -x, -y - t, 0, -x, -y, 0,
    x + t, -y, 0, x, -y, 0, x, -y - t, 0, x, -y, 0,
    -x - t, y, 0, -x, y, 0, -x, y + t, 0, -x, y, 0,
    x + t, y, 0, x, y, 0, x, y + t, 0, x, y, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  return g;
}

/** The (de)allocation gate: reveal `alloc` of the block, quantized to whole
 *  cell rows (the printhead), top-down. Updates the block's clip plane. */
function applyAllocClip(rec, paneOffsetY) {
  const a = rec.alloc;
  if (a <= 0) {
    rec.clipPlane.constant = -PASS_ALL; // keep nothing (y ≥ PASS_ALL)
    return;
  }
  if (a >= 1) {
    rec.clipPlane.constant = PASS_ALL; // parked — keep everything
    return;
  }
  const rows = rec.block.rows;
  const revealed = (Math.ceil(a * rows) / rows) * rec.block.h;
  const yTop = rec.block.y + rec.block.h / 2 + paneOffsetY + rec.zGroupY;
  // plane keeps y ≥ yTop − revealed  (normal +Y, constant −(yTop − revealed))
  rec.clipPlane.constant = -(yTop - revealed);
}

/**
 * Build one World's FORME composition into a slot.
 * ctx: { camera, loader, firstView, ease, isStale }
 */
export function buildFormeSlot(slot, w, ctx) {
  const { camera, loader, firstView, ease, isStale } = ctx;
  const pool = w?.showcase || [];
  if (!pool.length && !w?.brandDecks?.length && !w?.albumArt?.length) return;
  const viaTurn = slot.formeViaTurn === true;
  slot.formeViaTurn = false;

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
  const accent = new THREE.Color(w?.projectColor || 0x020098);
  const zBias = (slot.atlasBias || 0) > 0 ? SLOT_Z_BIAS : 0;

  const sigDefs = BANDS_ENABLED
    ? [
        w?.brandDecks?.length && { pages: w.brandDecks, ratio: w.brandDecks[0].ratio || 16 / 9 },
        w?.albumArt?.length && { pages: w.albumArt, ratio: 1 },
      ].filter(Boolean)
    : [];
  const anchorNx = BAND_TUNABLES.posX / FIELD_SPREAD_X;
  const anchorNy = (BAND_TUNABLES.posY - FIELD_OFFSET_Y) / FIELD_SPREAD_Y;
  const reserved = sigDefs.map((def, j) => ({
    nx: j === 0 ? anchorNx : -anchorNx,
    ny: j === 0 ? anchorNy : -anchorNy,
    ratio: def.ratio,
    mul: 1.45, // the signature block reads bigger than a cut (BAND_HEIGHT idiom)
  }));

  const layout = placeFormeBlocks(chosen, { seed: w.slug, aspect: camera.aspect || 1, reserved });
  const { blocks, reserved: sigBlocks } = layout;

  let maxR = 0;
  for (const b of blocks) if (b) maxR = Math.max(maxR, b.nr);

  // Arrival driver: initial/firstView builds run their own allocation wave on
  // house timings; Turn builds are driven by the re-deal master in goToWorld.
  if (slot.formeWave) gsap.killTweensOf(slot.formeWave);
  slot.formeWave = { p: viaTurn ? 0 : firstView && !PREFERS_REDUCED_MOTION ? 0 : 1 };
  if (!viaTurn && firstView && !PREFERS_REDUCED_MOTION) {
    gsap.to(slot.formeWave, {
      p: 1,
      duration: TILE_APPEAR_DURATION + FANOUT_STAGGER,
      ease,
      overwrite: true,
    });
  }
  // Wave rank: bottom→top (the forward re-deal direction); ranks normalized
  // over the pane height so tiles and signature blocks share one front.
  const rankOf = (y) => {
    const H = layout.halfH || 1;
    return Math.min(1, Math.max(0, (y + H) / (2 * H)));
  };

  const makeRecord = (block, tierIndex, tile) => {
    const material = new THREE.MeshBasicMaterial({
      color: TILE_FALLBACK_COLOR,
      toneMapped: false,
      transparent: true,
      opacity: 0,
    });
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), PASS_ALL);
    material.clippingPlanes = [clipPlane];
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(block.w, block.h), material);
    mesh.position.set(block.x, block.y, Z_MEDIA + zBias);
    mesh.renderOrder = ORDER_MEDIA;
    slot.tierGroups[tierIndex].add(mesh);

    const frameMaterial = new THREE.LineBasicMaterial({
      color: accent.clone(),
      transparent: true,
      opacity: 0,
    });
    const frame = new THREE.LineSegments(frameGeometry(block.w, block.h), frameMaterial);
    frame.position.z = 0.002;
    frame.renderOrder = ORDER_FRAME;
    mesh.add(frame);

    const rec = {
      mesh,
      texture: null,
      tierIndex,
      block,
      clipPlane,
      zGroupY: 0,
      frameMaterial,
      accent,
      alloc: 1,
      waveRank: rankOf(block.y),
      loadedAt: 0,
      playbackId: tile?.playbackId || null,
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
            : block.w / block.h;
        coverFit(texture, block.w / block.h, texAspect);
        const overlayMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          toneMapped: false,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        overlayMaterial.clippingPlanes = [clipPlane]; // rides the same gate
        const overlay = new THREE.Mesh(new THREE.PlaneGeometry(block.w, block.h), overlayMaterial);
        overlay.position.z = 0.012;
        overlay.renderOrder = ORDER_OVERLAY;
        return { mesh: overlay, texture };
      },
      extraDispose: () => {
        frame.geometry.dispose();
        frameMaterial.dispose();
      },
    };
    slot.tiles.push(rec);
    return rec;
  };

  const createBlock = (tile, i) => {
    const block = blocks[i];
    if (!block) return;
    const rec = makeRecord(block, tierOf(i), tile);
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
        coverFit(texture, block.w / block.h, tile.ratio || 1);
        rec.mesh.material.map = texture;
        rec.mesh.material.color.set(0xffffff);
        rec.mesh.material.needsUpdate = true;
      },
      undefined,
      () => {}
    );
  };

  /* Signature block — the deck/album as one locked frame: full-bleed page
     turns (printhead wipe down) on the band cadence, mono folio in the
     mortise (bottom-right, outside the frame). */
  const createSignature = (def, j) => {
    const block = sigBlocks[j];
    const pages = def.pages.slice(0, BAND_MAX_PAGES);
    const group = new THREE.Group();
    slot.tierGroups[BAND_TIER].add(group);
    const textures = pages.map(() => null);
    const allocPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), PASS_ALL);
    const wipePlaneFront = new THREE.Plane(new THREE.Vector3(0, -1, 0), PASS_ALL);

    const makePage = (order) => {
      const m = new THREE.MeshBasicMaterial({
        color: TILE_FALLBACK_COLOR,
        toneMapped: false,
        transparent: true,
        opacity: 0,
      });
      m.clippingPlanes = [allocPlane];
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(block.w, block.h), m);
      mesh.position.set(block.x, block.y, Z_MEDIA + zBias + (order === ORDER_MEDIA ? 0 : -0.004));
      mesh.renderOrder = order;
      group.add(mesh);
      return mesh;
    };
    const back = makePage(ORDER_MEDIA - 1);
    const front = makePage(ORDER_MEDIA);
    // The page-turn clips the FRONT with a second plane (alloc plane stays on both).
    front.material.clippingPlanes = [allocPlane, wipePlaneFront];

    const frameMaterial = new THREE.LineBasicMaterial({
      color: accent.clone(),
      transparent: true,
      opacity: 0,
    });
    const frame = new THREE.LineSegments(frameGeometry(block.w, block.h), frameMaterial);
    frame.position.set(block.x, block.y, Z_MEDIA + zBias + 0.002);
    frame.renderOrder = ORDER_FRAME;
    group.add(frame);

    // Folio — 01/05 under the frame's bottom-right corner.
    const folioTextures = pages.map((_, i) =>
      inkTexture(
        `${String(i + 1).padStart(2, '0')}/${String(pages.length).padStart(2, '0')}`,
        '#' + accent.getHexString(),
        128
      )
    );
    const folioMaterial = new THREE.MeshBasicMaterial({
      map: folioTextures[0],
      toneMapped: false,
      transparent: true,
      opacity: 0,
    });
    const folio = new THREE.Mesh(new THREE.PlaneGeometry(PITCH * 2, PITCH), folioMaterial);
    folio.position.set(
      block.x + block.w / 2 - PITCH,
      block.y - block.h / 2 - PITCH * 0.6,
      Z_MEDIA + zBias
    );
    folio.renderOrder = ORDER_CAPTION;
    group.add(folio);

    const sig = {
      group,
      block,
      alloc: 1,
      waveRank: rankOf(block.y),
      clipPlane: allocPlane,
      zGroupY: 0,
      frameMaterial,
      accent,
      cur: 0,
      wipe: 0,
      loaded: false,
      cycleCall: null,
      tween: null,
      disposed: false,
    };

    const show = (mesh, i) => {
      const tex = textures[i];
      if (!tex) return false;
      mesh.material.map = tex;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
      return true;
    };
    pages.forEach((p, i) => {
      const src = pageSrc(p);
      if (!src) return;
      loader.load(
        src,
        (texture) => {
          if (sig.disposed) {
            texture.dispose();
            return;
          }
          coverFit(texture, block.w / block.h, p.ratio || block.w / block.h);
          textures[i] = texture;
          if (i === sig.cur && !sig.loaded) sig.loaded = show(front, i);
        },
        undefined,
        () => {}
      );
    });

    const applyWipe = (paneOffsetY) => {
      if (sig.wipe <= 0 || sig.wipe >= 1) {
        wipePlaneFront.constant = PASS_ALL;
        return;
      }
      const yTop = block.y + block.h / 2 + paneOffsetY;
      // front keeps y ≤ cut (normal −Y): the new page prints DOWN over it
      wipePlaneFront.constant = yTop - sig.wipe * block.h;
    };
    sig.applyWipe = applyWipe;

    if (!PREFERS_REDUCED_MOTION && pages.length > 1) {
      const scheduleCycle = () => {
        sig.cycleCall = gsap.delayedCall(BAND_TUNABLES.cycleS, () => {
          const next = (sig.cur + 1) % pages.length;
          if (!show(back, next)) {
            scheduleCycle();
            return;
          }
          sig.wipe = 0;
          sig.tween = gsap.to(sig, {
            wipe: 1,
            duration: TURN_DURATION,
            ease,
            onComplete: () => {
              sig.cur = next;
              show(front, next);
              folioMaterial.map = folioTextures[next];
              folioMaterial.needsUpdate = true;
              sig.wipe = 0;
              scheduleCycle();
            },
          });
        });
      };
      scheduleCycle();
    }

    sig.paint = (opacity, paneOffsetY) => {
      applyAllocClip(sig, paneOffsetY);
      applyWipe(paneOffsetY);
      const up = sig.alloc > 0;
      front.visible = up && sig.loaded && opacity > 0.01;
      front.material.opacity = opacity;
      back.visible = up && sig.wipe > 0 && !!back.material.map && opacity > 0.01;
      back.material.opacity = opacity;
      const frameA = Math.min(1, sig.alloc * 3);
      const settle = sig.alloc >= 1 ? 1 : Math.min(1, Math.max(0, (sig.alloc - 0.6) / 0.4));
      frameMaterial.color.copy(WHITE).lerp(sig.accent, settle);
      frameMaterial.opacity =
        (sig.alloc < 1 ? GHOST_ALPHA + (FRAME_ALPHA - GHOST_ALPHA) * settle : FRAME_ALPHA) *
        frameA *
        opacity;
      folioMaterial.opacity = 0.85 * (sig.alloc >= 1 ? 1 : settle) * opacity;
    };

    sig.dispose = () => {
      sig.disposed = true;
      sig.cycleCall?.kill();
      sig.tween?.kill();
      gsap.killTweensOf(sig);
      for (const mesh of [front, back, folio]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      for (const t of textures) t?.dispose();
      for (const t of folioTextures) t.dispose();
      frame.geometry.dispose();
      frameMaterial.dispose();
      slot.tierGroups[BAND_TIER].remove(group);
    };

    slot.bands.push(sig);
  };

  /* ── Furniture — the set: registration crosses, cell coordinates, accent
        floods. Seeded per world, placed on cells no block claims, gated by
        the same wave (furniture re-deals with the edition). ── */
  const createFurniture = () => {
    const frand = mulberry32(hashSeed(`${w.slug}::furniture`));
    // Furniture ink: the world's accent, dimmed toward the field (S2 — one
    // recoloured page, not a second static ink).
    const inkColor = accent.clone().multiplyScalar(0.75);
    const ink = '#' + inkColor.getHexString();
    const { halfW, halfH } = layout;
    const cols = Math.floor(halfW / PITCH);
    const rows = Math.floor(halfH / PITCH);
    const cellFree = (k, j) =>
      !layout.placed.some(
        (b) => k >= b.k1 - 1 && k < b.k1 + b.cols + 1 && j >= b.j1 - 1 && j < b.j1 + b.rows + 1
      );
    const cardFree = (k, j) => {
      const nx = ((k + 0.5) * PITCH) / (FIELD_SPREAD_X * halfW);
      const ny = (((j + 0.5) * PITCH) / halfH - FIELD_OFFSET_Y) / FIELD_SPREAD_Y;
      return Math.abs(nx) > CARD_HALF || Math.abs(ny) > CARD_HALF;
    };
    const pickCells = (n) => {
      const out = [];
      for (let tries = 0; tries < n * 14 && out.length < n; tries++) {
        const k = Math.floor(frand() * cols * 2) - cols;
        const j = Math.floor(frand() * rows * 2) - rows;
        if (cellFree(k, j) && cardFree(k, j) && !out.some((c) => c.k === k && c.j === j))
          out.push({ k, j });
      }
      return out;
    };

    const group = new THREE.Group();
    slot.tierGroups[BAND_TIER].add(group);
    const disposables = [];

    // Registration crosses at intersections
    const crossCells = pickCells(9);
    const cp = [];
    const arm = PITCH * 0.14;
    for (const { k, j } of crossCells) {
      const x = k * PITCH;
      const y = j * PITCH;
      cp.push(x - arm, y, Z_PANE + 0.001, x + arm, y, Z_PANE + 0.001);
      cp.push(x, y - arm, Z_PANE + 0.001, x, y + arm, Z_PANE + 0.001);
    }
    const crossGeo = new THREE.BufferGeometry();
    crossGeo.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    const crossMat = new THREE.LineBasicMaterial({
      color: inkColor,
      transparent: true,
      opacity: 0,
    });
    const crosses = new THREE.LineSegments(crossGeo, crossMat);
    crosses.renderOrder = ORDER_FRAME;
    group.add(crosses);
    disposables.push(crossGeo, crossMat);

    // Accent floods
    const floodCells = pickCells(3);
    const floodMat = new THREE.MeshBasicMaterial({
      color: accent.clone(),
      toneMapped: false,
      transparent: true,
      opacity: 0,
    });
    disposables.push(floodMat);
    for (const { k, j } of floodCells) {
      const g = new THREE.PlaneGeometry(PITCH, PITCH);
      const m = new THREE.Mesh(g, floodMat);
      m.position.set((k + 0.5) * PITCH, (j + 0.5) * PITCH, Z_FLOOD);
      m.renderOrder = ORDER_FLOOD;
      group.add(m);
      disposables.push(g);
    }

    // Cell coordinates — R##C## in the mono ink
    const capCells = pickCells(5);
    const capMats = [];
    for (const { k, j } of capCells) {
      const tex = inkTexture(
        `R${String(j + rows).padStart(2, '0')} C${String(k + cols).padStart(2, '0')}`,
        ink
      );
      const m = new THREE.MeshBasicMaterial({
        map: tex,
        toneMapped: false,
        transparent: true,
        opacity: 0,
      });
      const q = new THREE.Mesh(new THREE.PlaneGeometry(PITCH * 1.6, PITCH * 0.8), m);
      q.position.set((k + 0.5) * PITCH, (j + 0.5) * PITCH, Z_PANE + 0.001);
      q.renderOrder = ORDER_CAPTION;
      group.add(q);
      capMats.push(m);
      disposables.push(q.geometry, m, tex);
    }

    // Idle blink — one empty cell winks its stroke every few seconds.
    const blinkGeo = frameGeometry(PITCH, PITCH);
    const blinkMat = new THREE.LineBasicMaterial({
      color: accent.clone(),
      transparent: true,
      opacity: 0,
    });
    const blink = new THREE.LineSegments(blinkGeo, blinkMat);
    blink.renderOrder = ORDER_FRAME;
    blink.visible = false;
    group.add(blink);
    disposables.push(blinkGeo, blinkMat);
    let blinkCall = null;
    const blinkCells = pickCells(8);
    if (!PREFERS_REDUCED_MOTION && blinkCells.length) {
      let bi = 0;
      const scheduleBlink = () => {
        blinkCall = gsap.delayedCall(2.6 + frand() * 2.4, () => {
          const { k, j } = blinkCells[bi++ % blinkCells.length];
          blink.position.set((k + 0.5) * PITCH, (j + 0.5) * PITCH, Z_PANE + 0.001);
          blink.visible = true;
          gsap.fromTo(
            blinkMat,
            { opacity: 0 },
            {
              opacity: 0.8,
              duration: 0.12,
              yoyo: true,
              repeat: 1,
              onComplete: () => {
                blink.visible = false;
                scheduleBlink();
              },
            }
          );
        });
      };
      scheduleBlink();
    }

    const furn = {
      group,
      waveRank: 0.5,
      alloc: 1,
      paint(opacity) {
        const a = Math.min(1, furn.alloc * 1.6) * opacity;
        crossMat.opacity = 0.55 * a;
        floodMat.opacity = 0.13 * a;
        for (const m of capMats) m.opacity = 0.6 * a;
      },
      dispose() {
        blinkCall?.kill();
        gsap.killTweensOf(blinkMat);
        for (const d of disposables) d.dispose();
        slot.tierGroups[BAND_TIER].remove(group);
      },
    };
    slot.bands.push(furn);
  };

  const gen = slot.buildGen;
  const stale = () => isStale() || slot.buildGen !== gen;
  const BATCH = Math.max(5, WORLD_MAX_VIDEO_TILES);
  const scheduleSig = (j) => {
    if (j >= sigDefs.length) {
      requestAnimationFrame(() => {
        if (!stale()) createFurniture();
      });
      return;
    }
    requestAnimationFrame(() => {
      if (stale()) return;
      createSignature(sigDefs[j], j);
      scheduleSig(j + 1);
    });
  };
  const runBatch = (start) => {
    if (stale()) return;
    const end = Math.min(start + BATCH, chosen.length);
    for (let i = start; i < end; i++) createBlock(chosen[i], i);
    if (end < chosen.length) requestAnimationFrame(() => runBatch(end));
    else scheduleSig(0);
  };
  runBatch(0);
}

/* ── Per-frame composite ──
   The slot's wave master (slot.formeWave.p, or the Turn's re-deal channels)
   sets each record's alloc through its bottom→top window; media/frames/
   furniture composite alloc × load-gate × slot opacity. paneOffsetY is the
   pane parallax translation (clip planes live in world space). */
const WAVE_WIDTH = 0.38;

export function applyFormeSlot(slot, paneOffsetY = 0, breatheX = 0, breatheY = 0) {
  const wave = slot.formeWave;
  for (const t of slot.tiles) {
    if (wave) t.alloc = Math.min(1, Math.max(0, (wave.p - t.waveRank * (1 - WAVE_WIDTH)) / WAVE_WIDTH));
    applyAllocClip(t, paneOffsetY);
    const up = t.alloc > 0;
    const loaded = !!t.texture;
    t.mesh.material.opacity = up && loaded ? slot.opacity : 0;
    if (loaded) t.texture.offset.set(breatheX, breatheY); // ink breathing
    const settle = t.alloc >= 1 ? 1 : Math.min(1, Math.max(0, (t.alloc - 0.6) / 0.4));
    t.frameMaterial.color.copy(WHITE).lerp(t.accent, settle);
    t.frameMaterial.opacity =
      (t.alloc < 1 ? GHOST_ALPHA + (FRAME_ALPHA - GHOST_ALPHA) * settle : FRAME_ALPHA) *
      Math.min(1, t.alloc * 3) *
      slot.opacity;
    if (t.videoMesh) t.videoMesh.material.opacity = t.liveMix * (up ? 1 : 0) * slot.opacity;
  }
  for (const b of slot.bands) {
    if (wave && b.waveRank != null)
      b.alloc = Math.min(1, Math.max(0, (wave.p - b.waveRank * (1 - WAVE_WIDTH)) / WAVE_WIDTH));
    b.paint(slot.opacity, paneOffsetY);
  }
}

/**
 * The re-deal Turn: one eased master `e` (turnRollEase, from goToWorld's
 * tween) drives a deallocation front over the outgoing slot and, one beat
 * behind, the allocation front over the incoming — both bottom→top going
 * forward (mirroring the roll), inverted going back. Returns the lens-spike
 * pulse so the caller keys distortion off the same master.
 */
export function formeTurnApply(e, outgoing, incoming, direction) {
  const outPhase = Math.min(1, e / 0.62);
  const inPhase = Math.min(1, Math.max(0, (e - 0.38) / 0.62));
  outgoing.formeWave = null;
  incoming.formeWave = null;
  const rankFor = (r) => (direction > 0 ? r : 1 - r);
  for (const t of outgoing.tiles)
    t.alloc = 1 - Math.min(1, Math.max(0, (outPhase - rankFor(t.waveRank) * (1 - WAVE_WIDTH)) / WAVE_WIDTH));
  for (const b of outgoing.bands)
    if (b.waveRank != null)
      b.alloc = 1 - Math.min(1, Math.max(0, (outPhase - rankFor(b.waveRank) * (1 - WAVE_WIDTH)) / WAVE_WIDTH));
  for (const t of incoming.tiles)
    t.alloc = Math.min(1, Math.max(0, (inPhase - rankFor(t.waveRank) * (1 - WAVE_WIDTH)) / WAVE_WIDTH));
  for (const b of incoming.bands)
    if (b.waveRank != null)
      b.alloc = Math.min(1, Math.max(0, (inPhase - rankFor(b.waveRank) * (1 - WAVE_WIDTH)) / WAVE_WIDTH));
  return Math.sin(Math.PI * e); // the lens-spike pulse
}
