/**
 * panelGrain.js — the panel grain rig: one turbulence tile, the SHARED uniform
 * holders every panel points at, and the held-jitter clock.
 *
 * The grain IS the FP pager scrim's dialed recipe (scrimNoise.js SCRIM_GRAIN /
 * SCRIM_GRAIN_MOBILE), not a lookalike — one recipe, two surfaces, so a change
 * to Nathan's 09-04 dial moves both. scrimNoise owns the recipe, the bare data
 * URI and the 8-frame jitter table; this module owns only the GL side.
 *
 * WHY THE GRAIN DOES NOT WARP. The sampling lives in panelMaterial's fragment
 * stage and reads `mUv` — the same pinch-compensated tile UV the media samples
 * — so the cells hold CONSTANT pixel density as a panel narrows toward a pole,
 * and the static belongs to the tile rather than to the screen. That is the
 * media path's own guarantee, reused, not a second mechanism that could drift.
 * See the mUv comment in panelMaterial.js.
 *
 * WHY THE STAGGER IS NOT OPTIONAL. A row is iso-latitude — all its tiles share
 * one θ_center, so vK is a flat varying (panelMaterial.js says so outright).
 * Every tile in a row therefore crosses any latitude threshold on the SAME
 * frame. The reveal is staggered by shifting each tile's THRESHOLD by its place
 * in a panelDelay ordering, so the row crosses as a wavefront with no timeline,
 * no gsap and no new rAF — the tiles simply arrive at their own thresholds as
 * the row travels.
 */
import * as THREE from 'three';
import {
  SCRIM_GRAIN,
  SCRIM_GRAIN_MOBILE,
  GRAIN_JITTER,
  GRAIN_TILE_PX,
  noiseDataUri,
} from '../work/scrimNoise.js';
import { IS_MOBILE, PREFERS_REDUCED_MOTION } from './globeConfig.js';
import { panelDelay } from './cascade.js';

export default function createPanelGrain() {
  // The device-matched recipe — the scrim's own tier bake (finer tile, lighter
  // slope on a phone), so the two surfaces agree per device too.
  const recipe = IS_MOBILE ? SCRIM_GRAIN_MOBILE : SCRIM_GRAIN;
  const uri = noiseDataUri(recipe);

  // A bare loader, deliberately NOT TextureManager's: its
  // setCrossOrigin('anonymous') is meaningless for a data: URI, and crossOrigin
  // on inline data is the hazard class that has produced black WebGL stills in
  // this repo before.
  const texture = uri ? new THREE.TextureLoader().load(uri) : null;
  if (texture) {
    // RepeatWrapping is mandatory: the tile UV runs far outside 0..1 once
    // uGrainRepeat and the jitter are applied, and ClampToEdge would smear one
    // edge row across the panel.
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // NEAREST, not linear. Static wants hard-edged cells: under linear
    // filtering the minified tile is averaged into mush, which both softens
    // the look and makes ?popgraincells read backwards (more repeats measured
    // SMOOTHER, not finer). Nearest keeps a cell a cell at any repeat count.
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.NoColorSpace; // the shader decodes sRGB explicitly
  }

  /* Shared holders — one object identity across every panel, so a frame costs
     one write instead of 96. uGrainMix 0 means the shader's branch never runs,
     which is what keeps every non-grain caller pixel-identical. */
  const uniforms = {
    uGrainTex: { value: texture },
    uGrainMix: { value: 0 },
    uGrainRepeat: { value: 1 },
    uGrainJitter: { value: new THREE.Vector2(0, 0) },
    uGrainStart: { value: 0.45 },
    uGrainRamp: { value: 0.15 },
    uGrainStagger: { value: 0 },
  };

  let elapsed = 0;
  let frame = -1;
  let panels = null;
  let totalRows = 0;
  let order = null;

  /** Stamp each tile's place in the reveal order + its static decorrelation. */
  const assign = (list, variant, rows) => {
    panels = list;
    totalRows = rows;
    order = variant;
    if (!list?.length) return;
    // panelDelay carries its own small jitter ("controlled chaos — breaks
    // mechanical lockstep"), which is exactly the intent here, so the ordering
    // is reused whole rather than reimplemented.
    const delays = list.map((p) => panelDelay(p, variant, rows));
    const max = Math.max(...delays, 1e-6);
    list.forEach((p, i) => {
      const u = p.mesh?.material?.uniforms;
      if (!u?.uGrainPhase) return;
      u.uGrainPhase.value = delays[i] / max; // 0..1 place in the wavefront
      // A stable per-tile offset into the tile, so neighbours don't show
      // identical static and a tile's own grain doesn't crawl as it travels.
      // Coprime strides keep the pattern from banding along either axis.
      u.uGrainSeed.value.set(
        ((p.lonIndex * 7 + p.row * 13) % 97) / 97,
        ((p.lonIndex * 29 + p.row * 11) % 89) / 89
      );
    });
  };

  return {
    uniforms,
    assign,

    /**
     * Read the live knobs and step the held jitter.
     * @param {number} step - seconds since the last frame
     * @param {Object} tune - popConfig TUNING (read live, the house way)
     */
    update(step, tune) {
      uniforms.uGrainMix.value = tune.grainAmt;
      uniforms.uGrainRepeat.value = tune.grainCells;
      uniforms.uGrainStart.value = tune.grainStart;
      uniforms.uGrainRamp.value = tune.grainRamp;
      uniforms.uGrainStagger.value = tune.grainStagger;

      // The ordering is dialable; re-stamp only when it actually changes.
      if (tune.grainOrder !== order && panels) assign(panels, tune.grainOrder, totalRows);

      if (!(tune.grainAmt > 0) || !texture) return;

      // Held frames, not a smooth drift — the scrim's steps(1, end) character.
      // 0 fps (or reduced motion) freezes on frame 0, honouring the globe's
      // stills-only doctrine while keeping the grain itself.
      const fps = PREFERS_REDUCED_MOTION ? 0 : tune.grainFps;
      if (fps <= 0) {
        if (frame !== 0) {
          frame = 0;
          uniforms.uGrainJitter.value.set(0, 0);
        }
        return;
      }
      elapsed += step;
      const next = Math.floor(elapsed * fps) % GRAIN_JITTER.length;
      if (next !== frame) {
        frame = next;
        const [jx, jy] = GRAIN_JITTER[next];
        // Tile pixels → tile-UV repeats, so one jitter table means the same
        // visual displacement on both surfaces.
        uniforms.uGrainJitter.value.set(jx / GRAIN_TILE_PX, jy / GRAIN_TILE_PX);
      }
    },

    dispose() {
      texture?.dispose();
      panels = null;
    },
  };
}
