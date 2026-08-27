/**
 * fpAtlas.js — ?fpgrid=1 "ATLAS": media as plates printed ON the globe.
 *
 * Each asset is a true sphere-sector plate snapped to whole shell cells, a
 * quarter-unit BEYOND the shell radius so the graticule's lines draw over the
 * media ("pressed under glass"); each plate's bounding cell lines are re-inked
 * one weight heavier in the project accent, just inside the shell, so the edge
 * cleanly wins its shared lattice line. Occupancy is a sparse, slug-seeded
 * constellation (the seededLayout annulus idiom remapped to angular space);
 * the center stays clear for the WorldCard.
 *
 * The World Turn is untouched: rotation about the origin keeps plates
 * on-sphere, so the existing slot-pivot roll reads as the constellation
 * rolling across the FIXED graticule and snap-registering as the house ease
 * settles. Parallax is a camera head-turn (useWorldScene); nothing in the
 * frame moves relative to anything else at rest.
 *
 * House tokens throughout: turnRollEase + TILE_APPEAR_DURATION/FANOUT_STAGGER
 * shape the appear (an on-sphere slerp out of the center — the planar
 * spawn-lerp would slide plates off the sphere), BAND_CYCLE_S + TURN_DURATION
 * pace the deck/album register plates, S2 accent = border ink.
 *
 * Records are shaped exactly like legacy tile records so clearSlot and
 * WorldLiveScheduler work unchanged; the one scheduler seam is makeOverlay
 * (worldLive's flat-plane overlay assumes PlaneGeometry.parameters).
 */
import * as THREE from 'three';
import gsap from 'gsap';
import {
  placeBlocks,
  blockSectorGeometry,
  blockBorderGeometry,
  blockCenterDir,
} from './fpGridCells.js';
import {
  SHELL_RADIUS,
  MAX_TILES,
  MIN_TILES,
  thumbForCount,
  PLATE_DEG,
  TILE_FALLBACK_COLOR,
  TILE_SPAWN_FRAC,
  TILE_APPEAR_DURATION,
  TILE_APPEAR_FADE,
  FANOUT_STAGGER,
  WORLD_MAX_VIDEO_TILES,
  BANDS_ENABLED,
  BAND_TIER,
  BAND_TUNABLES,
  BAND_MAX_PAGES,
  BAND_TEX_WIDTH,
  TURN_DURATION,
  FIELD_OFFSET_Y,
  FIELD_SPREAD_X,
  FIELD_SPREAD_Y,
  DEPTH_TIERS,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

/* Radius scheme (camera inside: larger radius = farther = behind).
   plates BEHIND the shell lines → lattice runs over the media; borders just
   INSIDE the shell → the accent edge wins its shared line. Per-slot bias keeps
   two Worlds' plates from being coplanar while both are up during a Turn. */
export const PLATE_R = SHELL_RADIUS + 0.25;
const OVERLAY_R_IN = 0.06; // video overlay sits proud of its plate
const BORDER_R = SHELL_RADIUS - 0.1;
const BACK_R_OUT = 0.02; // strip back page tucks behind the front page

/* renderOrder contract (everything transparent, everything sphere-centered →
   the painter sort is distance-~0 for all of it; order must be explicit):
   plates → video overlays → strip front → SHELL (30, set in useWorldScene) →
   accent borders. */
const ORDER_PLATE = 10;
const ORDER_STRIP_BACK = 12;
const ORDER_STRIP_FRONT = 14;
const ORDER_OVERLAY = 20;
export const ORDER_SHELL = 30;
const ORDER_BORDER = 40;

const IDENTITY_Q = new THREE.Quaternion();
const VIEW_DIR = new THREE.Vector3(0, 0, -1);

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

/** Cover-fit into a plate's projected aspect. BackSide (viewed from inside)
 *  mirrors U, so repeat.x is negated — with center (0.5,0.5) that mirrors
 *  about the middle and stays inside the clamped [0,1] range. */
export function plateCover(texture, coverAspect, texAspect) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.center.set(0.5, 0.5);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  const ta = texAspect || 1;
  if (ta > coverAspect) texture.repeat.set(coverAspect / ta, 1);
  else texture.repeat.set(1, ta / coverAspect);
  texture.repeat.x *= -1;
}

/** Spawn pose: the plate pulled (1 − TILE_SPAWN_FRAC) of the way to `target`
 *  (default: view center) along the great circle — the house push-out,
 *  reinterpreted on-sphere. DRUM passes each arc's own center. */
export function spawnQuaternion(block, target = VIEW_DIR) {
  const qFull = new THREE.Quaternion().setFromUnitVectors(
    blockCenterDir(block),
    target
  );
  return new THREE.Quaternion().slerpQuaternions(
    IDENTITY_Q,
    qFull,
    1 - TILE_SPAWN_FRAC
  );
}

/** Accent border for one block — own material so its opacity can composite
 *  with the plate's appear fade (S2 ink: full project accent, undimmed). */
function makeBorder(block, accent, radius = BORDER_R) {
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color(accent || 0x020098),
    transparent: true,
    opacity: 0,
  });
  const border = new THREE.LineSegments(blockBorderGeometry(block, radius), material);
  border.renderOrder = ORDER_BORDER;
  return border;
}
const BORDER_ALPHA = 0.9;

/**
 * Register plate — the deck/album composite reinterpreted for the grid: ONE
 * cell block whose pages wipe through it along a meridian (hard cell edge, the
 * house OS-wipe language) on the band cadence + Turn curve. Two co-located
 * sectors: back = next page, front = current, front clipped by a sweeping
 * meridian plane. Replaces bandPose/worldBands in this mode.
 */
export function createRegisterPlate({
  block,
  pages,
  loader,
  parent,
  accent,
  ease,
  radius,
  geometryFor, // (block, rOut) => BufferGeometry — DRUM remaps sector UVs
  orientPlane, // (plane) => void — DRUM maps the local wipe cut to world space
  spawnTarget, // spawn slerp target dir — DRUM pulls toward its arc's center
  orders = { back: ORDER_STRIP_BACK, front: ORDER_STRIP_FRONT }, // DRUM draws above the shell
  borderRadius = BORDER_R, // DRUM's border sits inside its plate radius
}) {
  const group = new THREE.Group();
  parent.add(group);
  const makeGeometry =
    geometryFor || ((b, rOut) => blockSectorGeometry(b, radius + rOut));

  const textures = pages.map(() => null);
  const makeMesh = (order, rOut) => {
    const mesh = new THREE.Mesh(
      makeGeometry(block, rOut),
      new THREE.MeshBasicMaterial({
        color: TILE_FALLBACK_COLOR,
        toneMapped: false,
        transparent: true,
        opacity: 0,
        side: THREE.BackSide,
      })
    );
    mesh.renderOrder = order;
    group.add(mesh);
    return mesh;
  };
  const back = makeMesh(orders.back, BACK_R_OUT);
  const front = makeMesh(orders.front, 0);
  const border = makeBorder(block, accent, borderRadius);
  group.add(border);

  const strip = {
    group,
    appear: 0,
    qSpawn: spawnQuaternion(block, spawnTarget),
    disposed: false,
    cur: 0,
    wipe: 0, // 0 = front page whole → 1 = fully re-dealt to the next page
    cycleCall: null,
    tween: null,
    loaded: false,
  };

  const show = (mesh, pageIdx) => {
    const tex = textures[pageIdx];
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
        if (strip.disposed) {
          texture.dispose();
          return;
        }
        plateCover(texture, block.coverAspect, p.ratio || block.coverAspect);
        textures[i] = texture;
        if (i === strip.cur && !strip.loaded) {
          strip.loaded = show(front, i);
        }
      },
      undefined,
      () => {}
    );
  });

  // The sweeping cut: a meridian plane through the origin. Fragments are kept
  // where sin(lon − λ) ≥ 0 → the front page peels left→right along cell lines.
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const applyWipe = () => {
    if (strip.wipe <= 0 || strip.wipe >= 1) {
      front.material.clippingPlanes = null;
    } else {
      const cut = block.lon1 + (block.lon2 - block.lon1) * strip.wipe;
      clipPlane.normal.set(-Math.sin(cut), 0, Math.cos(cut));
      clipPlane.constant = 0;
      orientPlane?.(clipPlane); // DRUM: local cut → world space (planes clip in world)
      front.material.clippingPlanes = [clipPlane];
    }
  };

  if (!PREFERS_REDUCED_MOTION && pages.length > 1) {
    const scheduleCycle = () => {
      strip.cycleCall = gsap.delayedCall(BAND_TUNABLES.cycleS, () => {
        const next = (strip.cur + 1) % pages.length;
        if (!show(back, next)) {
          scheduleCycle(); // next page not loaded yet — hold the dwell
          return;
        }
        strip.wipe = 0;
        strip.tween = gsap.to(strip, {
          wipe: 1,
          duration: TURN_DURATION,
          ease,
          onUpdate: applyWipe,
          onComplete: () => {
            strip.cur = next;
            show(front, next);
            strip.wipe = 0;
            applyWipe();
            scheduleCycle();
          },
        });
      });
    };
    scheduleCycle();
  }

  /** Per-frame composite (mirrors a band's paint contract). */
  strip.paint = (opacity) => {
    const frontUp = strip.loaded;
    front.visible = frontUp && opacity > 0.01;
    front.material.opacity = opacity;
    const backUp = strip.wipe > 0 && back.material.map;
    back.visible = !!backUp && opacity > 0.01;
    back.material.opacity = opacity;
    border.material.opacity = BORDER_ALPHA * opacity;
  };

  strip.dispose = () => {
    strip.disposed = true;
    strip.cycleCall?.kill();
    strip.tween?.kill();
    gsap.killTweensOf(strip);
    for (const mesh of [front, back]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const tex of textures) tex?.dispose();
    border.geometry.dispose();
    border.material.dispose();
    parent.remove(group);
  };

  return strip;
}

/**
 * Build one World's ATLAS composition into a slot.
 * ctx: { camera, loader, firstView, ease, isStale: () => bool }
 * Pushes scheduler-compatible records into slot.tiles and strip records into
 * slot.bands (both by push — the live scheduler holds the array reference).
 */
export function buildAtlasSlot(slot, w, ctx) {
  const { camera, loader, firstView, ease, isStale } = ctx;
  const pool = w?.showcase || [];
  if (!pool.length && !w?.brandDecks?.length && !w?.albumArt?.length) return;

  // Composition: the legacy video-first tiering, verbatim — videos to tier 0
  // (live-eligible, budget-matched), stills cycled up to the house density.
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
  const radius = PLATE_R + (slot.atlasBias || 0);

  // Register plates claim their cells first (the band keep-out doctrine),
  // anchored at the live house top-right position (?bandx/?bandy still nudge).
  const stripDefs = BANDS_ENABLED
    ? [
        w?.brandDecks?.length && {
          pages: w.brandDecks,
          ratio: w.brandDecks[0].ratio || 16 / 9,
          baseDeg: PLATE_DEG * 1.5,
        },
        w?.albumArt?.length && {
          pages: w.albumArt,
          ratio: 1,
          baseDeg: PLATE_DEG * 1.2,
        },
      ].filter(Boolean)
    : [];
  const anchorNx = BAND_TUNABLES.posX / FIELD_SPREAD_X;
  const anchorNy = (BAND_TUNABLES.posY - FIELD_OFFSET_Y) / FIELD_SPREAD_Y;
  const reserved = stripDefs.map((def, j) => ({
    // Second strip (deck + album both present — rare) mirrors to lower-left.
    nx: j === 0 ? anchorNx : -anchorNx,
    ny: j === 0 ? anchorNy : -anchorNy,
    ratio: def.ratio,
    baseDeg: def.baseDeg,
  }));

  const { blocks, reserved: stripBlocks } = placeBlocks(chosen, {
    seed: w.slug,
    aspect: camera.aspect || 1,
    baseDeg: PLATE_DEG,
    reserved,
  });
  if (typeof window !== 'undefined' && window.location.search.includes('debug')) {
    (window.__fpAtlas ||= {})[w.slug] = { blocks, stripBlocks, aspect: camera.aspect };
  }

  // Border ink: full project accent, undimmed (S2). Set at build — it fades
  // in with each plate, so no tween is needed on a Turn.
  const accent = w?.projectColor || 0x020098;

  let maxR = 0;
  for (const b of blocks) if (b) maxR = Math.max(maxR, b.nr);
  const bloomT0 = performance.now();

  const createPlate = (tile, i) => {
    const block = blocks[i];
    if (!block) return; // dropped on a saturated ring — its cells stay empty
    const tierIndex = tierOf(i);
    const material = new THREE.MeshBasicMaterial({
      color: TILE_FALLBACK_COLOR,
      toneMapped: false,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(blockSectorGeometry(block, radius), material);
    mesh.renderOrder = ORDER_PLATE;
    slot.tierGroups[tierIndex].add(mesh);

    const border = makeBorder(block, accent);
    mesh.add(border);

    const rec = {
      mesh,
      texture: null,
      tierIndex,
      appear: 0,
      qSpawn: spawnQuaternion(block),
      block,
      coverAspect: block.coverAspect,
      // Live tier (WorldLiveScheduler contract)
      playbackId: tile.playbackId || null,
      liveState: null,
      liveMix: 0,
      liveSlot: null,
      liveSince: 0,
      lastLiveAt: 0,
      videoMesh: null,
      videoTexture: null,
      // Curved-overlay seam: worldLive's default overlay assumes PlaneGeometry.
      makeOverlay: (video) => {
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        const texAspect =
          video.videoWidth > 0 && video.videoHeight > 0
            ? video.videoWidth / video.videoHeight
            : block.coverAspect;
        plateCover(texture, block.coverAspect, texAspect);
        const overlay = new THREE.Mesh(
          blockSectorGeometry(block, radius - OVERLAY_R_IN),
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
      borderMaterial: border.material,
      extraDispose: () => {
        border.geometry.dispose();
        border.material.dispose();
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

  const createStrip = (def, j) => {
    const strip = createRegisterPlate({
      block: stripBlocks[j],
      pages: def.pages.slice(0, BAND_MAX_PAGES),
      loader,
      parent: slot.tierGroups[BAND_TIER],
      accent,
      ease,
      radius,
    });
    slot.bands.push(strip);
    if (firstView && !PREFERS_REDUCED_MOTION) {
      gsap.to(strip, {
        appear: 1,
        duration: TILE_APPEAR_DURATION,
        ease,
        overwrite: true,
      });
    } else {
      strip.appear = 1;
    }
  };

  // Build-stagger (legacy cadence): first batch synchronous, rest on rAF,
  // strips (heaviest) one frame each after the plates.
  const gen = slot.buildGen;
  const stale = () => isStale() || slot.buildGen !== gen;
  const BATCH = Math.max(5, WORLD_MAX_VIDEO_TILES);
  const scheduleStrip = (j) => {
    if (j >= stripDefs.length) return;
    requestAnimationFrame(() => {
      if (stale()) return;
      createStrip(stripDefs[j], j);
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

const qFrame = new THREE.Quaternion();

/**
 * Per-frame composite for an ATLAS slot — replaces applyParallax's tile/band
 * branches. No translation, no drift, no tier gains: plates slerp out of the
 * center by `appear` (the on-sphere push-out) and fade on the house ramp,
 * multiplied by the slot's Turn crossfade.
 */
export function applyAtlasSlot(slot) {
  for (const t of slot.tiles) {
    const k = t.appear;
    qFrame.slerpQuaternions(t.qSpawn, IDENTITY_Q, k);
    t.mesh.quaternion.copy(qFrame);
    const fade = TILE_APPEAR_FADE > 0 ? Math.min(1, k / TILE_APPEAR_FADE) : 1;
    t.mesh.material.opacity = fade * slot.opacity;
    if (t.borderMaterial) t.borderMaterial.opacity = BORDER_ALPHA * fade * slot.opacity;
    if (t.tabMaterial) t.tabMaterial.opacity = fade * slot.opacity; // DRUM spine tab
    if (t.videoMesh) t.videoMesh.material.opacity = t.liveMix * fade * slot.opacity;
  }
  for (const b of slot.bands) {
    const k = b.appear;
    qFrame.slerpQuaternions(b.qSpawn, IDENTITY_Q, k);
    b.group.quaternion.copy(qFrame);
    const fade = TILE_APPEAR_FADE > 0 ? Math.min(1, k / TILE_APPEAR_FADE) : 1;
    b.paint(fade * slot.opacity);
  }
}
