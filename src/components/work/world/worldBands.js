/**
 * worldBands.js — World-side renderer for the composite bands (ADR-0003).
 *
 * The thin WebGL consumer of the bandLayout geometry brain: each band
 * (brand deck / album art) is a group of textured planes inside the World's
 * framebuffer — pre-distortion, so the lens pass warps the stack with the
 * scene — posed per frame from a phase scalar, exactly the math BandPager
 * paints as CSS 3D on the detail page. px-tuned distances scale by the
 * band's page width against REF_PAGE_W so proportions match at any size.
 *
 * Display-only: pages idle-cycle on the Turn curve (rest dwell, wrap to
 * front); pointer input stays with the World (parallax) and the wheel with
 * World paging. The interactive pager is the detail page's job.
 *
 * Lifecycle mirrors a Tile: built into a slot's tier group (rides the Turn
 * pivot), appear/push-out composited by the scene loop, disposed with the
 * slot. Reduced motion: static fan at phase 0, no cycle.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import {
  bandPose,
  BAND_ANGLE,
  HOME_X,
  FAN_X,
  FAN_Y,
  FAN_Z,
  PILE_X,
  PILE_Y,
  PILE_Z,
  SHOW_LIFT,
  VIEW_HOLD,
  REF_PAGE_W,
  pageFitScale,
} from '../bandLayout.js';
import {
  BAND_HEIGHT,
  BAND_CYCLE_S,
  BAND_MAX_PAGES,
  BAND_TEX_WIDTH,
  TILE_FALLBACK_COLOR,
  TURN_DURATION,
  PREFERS_REDUCED_MOTION,
} from './worldConfig.js';

const DEG2RAD = Math.PI / 180;

// Default live-tunables — reproduces the shipped pose/rate exactly. The scene
// passes the shared BAND_TUNABLES store; this is the fallback when a caller
// omits it (nothing changes vs. the pre-panel behaviour).
const BAND_TUNE_DEFAULT = {
  cycleS: BAND_CYCLE_S,
  spacingMul: 1,
  homeX: HOME_X,
  fanMul: 1,
  pileMul: 1,
  viewHold: VIEW_HOLD,
  albumScale: 1,
};

const pageSrc = (p) =>
  p.imageUrl
    ? `${p.imageUrl}?w=${BAND_TEX_WIDTH}&auto=format&fit=max`
    : p.playbackId
      ? `https://image.mux.com/${p.playbackId}/thumbnail.webp?width=${BAND_TEX_WIDTH}&fit_mode=preserve`
      : null;

/**
 * Build one band body into a tier group.
 *
 * @param {Object} opts
 * @param {Array<Object>} opts.items - pages ({ _id, imageUrl, playbackId })
 * @param {number} opts.ratio - uniform page aspect (deck ~16:9, covers 1)
 * @param {{x: number, y: number, z: number}} opts.placement - seeded rest position
 * @param {THREE.Group} opts.parent - the slot tier group to mount into
 * @param {THREE.TextureLoader} opts.loader
 * @param {gsap.parseEase|Function} opts.ease - the Turn curve
 * @param {Object} [opts.tune] - live tunables (FP1 panel): { cycleS, spacingMul,
 *   homeX, fanMul, pileMul }. Read every paint/cycle so the deck rescales live;
 *   defaults reproduce the shipped pose. See BAND_TUNABLES in worldConfig.
 * @returns band record for the slot ({ group, paint, appear, baseX, baseY, dispose })
 */
export function createWorldBand({
  items,
  ratio,
  placement,
  parent,
  loader,
  ease,
  tune = BAND_TUNE_DEFAULT,
}) {
  const pages = items.slice(0, BAND_MAX_PAGES);
  // Fit the page inside a BAND_HEIGHT square, preserving aspect (tile rule);
  // pageFitScale then normalizes squarer pages (album covers) toward the
  // reference deck page's AREA so covers don't read oversized. The scale is
  // applied per paint (mesh.scale) so the albumScale knob works live.
  const fitW = ratio >= 1 ? BAND_HEIGHT : BAND_HEIGHT * ratio;
  const fitH = ratio >= 1 ? BAND_HEIGHT / ratio : BAND_HEIGHT;
  // px-tuned stack distances → world units, proportional to page width.
  // Built live from `tune` each paint (the debug panel scales the deck without
  // a rebuild); defaults (spacing/fan/pile × 1, homeX = HOME_X) are identity.
  //   spacingMul → in-plane card-to-card steps (the DECK_SPACING knob, both stacks)
  //   fanMul     → whole waiting-fan extent (in-plane + recession)
  //   pileMul    → whole shown-pile extent (in-plane + recession)
  //   homeX      → front-page x-anchor (fraction of pageW, unitless — passed through)
  //   viewHold   → viewing-slot plateau width (fraction of a step — passed through)
  //   albumScale → live multiplier on the sub-16:9 area shrink (page size)
  const distFor = (unit) => ({
    home: tune.homeX,
    fan: FAN_X * unit * tune.spacingMul * tune.fanMul,
    fanY: FAN_Y * unit * tune.spacingMul * tune.fanMul,
    fanZ: FAN_Z * unit * tune.fanMul,
    pileX: PILE_X * unit * tune.spacingMul * tune.pileMul,
    pileY: PILE_Y * unit * tune.spacingMul * tune.pileMul,
    pileZ: PILE_Z * unit * tune.pileMul,
    lift: SHOW_LIFT * unit,
    hold: tune.viewHold ?? VIEW_HOLD,
  });

  const group = new THREE.Group();
  group.position.set(placement.x, placement.y, placement.z);
  parent.add(group);

  const brightness = []; // per-plane pose brightness, composited in paint()
  const planes = pages.map((p, i) => {
    const material = new THREE.MeshBasicMaterial({
      color: TILE_FALLBACK_COLOR,
      toneMapped: false,
      transparent: true,
      opacity: 0, // load-gated, like a Tile
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(fitW, fitH), material);
    mesh.rotation.y = BAND_ANGLE * DEG2RAD;
    // renderOrder is set per frame from pose depth (paint) — the conveyor
    // model reorders cards live: the front card is frontmost; both the
    // waiting fan (right) and the shown pile (left) recede behind it.
    mesh.renderOrder = pages.length - i;
    group.add(mesh);
    brightness[i] = 1;

    const src = pageSrc(p);
    if (src) {
      loader.load(
        src,
        (texture) => {
          if (band.disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 4;
          material.map = texture;
          material.needsUpdate = true;
          mesh.userData.loaded = true;
        },
        undefined,
        () => {} // failed load → plane stays hidden (opacity 0)
      );
    }
    return mesh;
  });

  const band = {
    group,
    baseX: placement.x,
    baseY: placement.y,
    appear: 0,
    phase: 0,
    disposed: false,
    cycleCall: null,
    tween: null,
  };

  /** Pose every plane from the current phase; `opacity` = fade × slot fade. */
  band.paint = (opacity) => {
    // Live tunables (panel scales the deck without a rebuild). Page size is
    // ratio-normalized (albumScale live via mesh.scale); the pose distances
    // scale with the PRESENTED page width so spacing tracks page size.
    const scale = pageFitScale(ratio, tune.albumScale ?? 1);
    const pageW = fitW * scale;
    const unit = pageW / REF_PAGE_W;
    const dist = distFor(unit);
    for (let i = 0; i < planes.length; i++) {
      const mesh = planes[i];
      const pose = bandPose(i, band.phase, pageW, dist);
      const loaded = mesh.userData.loaded === true;
      const visible = !pose.hidden && loaded && opacity > 0.01;
      mesh.visible = visible;
      if (!visible) continue;
      mesh.scale.set(scale, scale, 1);
      // bandPose y is screen-positive-down (DOM convention) — flip for world.
      mesh.position.set(pose.x, -pose.y, pose.z);
      // Transparent planes draw in z order (matches CSS preserve-3d): the
      // front card (z = 0) draws last, both stacks recede behind it.
      // UNQUANTIZED — the old ×10 rounding tied render order for a wide
      // window around the crossover, which is exactly where the swap must
      // resolve cleanly. Floats keep the tie to the single coplanar instant.
      mesh.renderOrder = 100 + pose.z / unit;
      // Depth = darkening (never transparency): brightness scales the map.
      if (brightness[i] !== pose.brightness) {
        brightness[i] = pose.brightness;
        mesh.material.color.setScalar(pose.brightness);
      }
      mesh.material.opacity = opacity;
    }
  };

  /* Idle cycle — rest dwell, then advance on the Turn curve; wrap to front. */
  if (!PREFERS_REDUCED_MOTION && pages.length > 1) {
    const scheduleCycle = () => {
      // Read the dwell live so the panel's cycle-rate slider takes effect on the
      // next advance (the running deck re-arms this after every cycle).
      band.cycleCall = gsap.delayedCall(tune.cycleS, () => {
        const max = pages.length - 1;
        const cur = Math.round(band.phase);
        band.tween = gsap.to(band, {
          phase: cur >= max ? 0 : cur + 1,
          duration: TURN_DURATION,
          ease,
          onComplete: scheduleCycle,
        });
      });
    };
    scheduleCycle();
  }

  band.dispose = () => {
    band.disposed = true;
    band.cycleCall?.kill();
    band.tween?.kill();
    gsap.killTweensOf(band);
    for (const mesh of planes) {
      mesh.geometry.dispose();
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    parent.remove(group);
  };

  return band;
}
