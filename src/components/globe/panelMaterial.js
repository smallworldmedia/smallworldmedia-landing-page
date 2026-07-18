/**
 * panelMaterial.js — Unlit ShaderMaterial for globe panels.
 *
 * One material instance per panel. The shader owns five jobs:
 *  - cover-fit crop via per-texture uvScale/uvOffset
 *  - texA ↔ texB crossfade via uMix (Stage 2: thumbnail ↔ live video)
 *  - power-on cascade via uPower (0 = dark panel, 1 = full brightness;
 *    values >1 over-brighten for the CRT flicker)
 *  - the commit blue-fill via uBlueMix (home-hero chunk 4: 0 = untouched —
 *    the resting state AND every fresh mount; 1 = the panel is flat field
 *    blue). uBlueColor is set from GAP_COLOR — never a hand-picked hex —
 *    the same value the inner sphere's material carries, so at mix 1 the
 *    whole globe reads as one blue disc and colorspace_fragment lands it
 *    exactly on the DOM --color-electric-blue (the process contraction
 *    handoff proved that equivalence).
 *  - an optional edge stroke via uStrokeMix (0 = off — the home globe's
 *    resting state; /process draws its Fragments blue-on-blue and lets a
 *    black stroke separate them from the field). The stroke reads the
 *    aEdgeUv attribute — the panel's NATURAL spherical param normalized
 *    0..1 — because pole wedges replace `uv` with a planar projection
 *    whose border does not hug the wedge silhouette. Consumers that
 *    enable the stroke must provide aEdgeUv; without the attribute it
 *    reads (0,0) and the stroke resolves to nothing even at mix 1.
 *    Width is screen-constant via fwidth (WebGL2 — three r163+ floor).
 *
 * Panels stay opaque — crossfading inside the shader avoids the draw-order
 * artifacts that transparent overlapping meshes cause on a convex sphere.
 */
import * as THREE from 'three';
import { GAP_COLOR } from './globeConfig.js';

// USE_INSTANCING: three defines it (and declares instanceMatrix) when the
// material renders on an InstancedMesh — the /process decoy pool. Regular
// panel meshes compile the plain path; behavior there is unchanged.
const vertexShader = /* glsl */ `
  attribute vec2 aEdgeUv;
  varying vec2 vUv;
  varying vec2 vEdgeUv;
  void main() {
    vUv = uv;
    vEdgeUv = aEdgeUv;
    vec4 localPos = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      localPos = instanceMatrix * localPos;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * localPos;
  }
`;

// colorspace_fragment converts the linear working color to the renderer's
// output color space — without it the panels wash out vs. the site palette.
//
// uVideoB: three.js refuses the sRGB hardware-decode internal format for
// video textures (getInternalFormat forceLinearTransfer) and instead decodes
// in-shader via its DECODE_VIDEO_TEXTURE define — but only in built-in
// materials. Custom shaders must decode manually or video reads
// double-gamma-encoded (lifted blacks). srgbToLinear below is three's own
// sRGBTransferEOTF, applied to texB only while it holds a video.
const fragmentShader = /* glsl */ `
  uniform sampler2D texA;
  uniform sampler2D texB;
  uniform vec2 uvScaleA;
  uniform vec2 uvOffsetA;
  uniform vec2 uvScaleB;
  uniform vec2 uvOffsetB;
  uniform float uMix;
  uniform float uPower;
  uniform float uHasTexA;
  uniform float uVideoB;
  uniform vec3 uFallbackColor;
  uniform float uStrokeMix;
  uniform float uStrokeWidthPx;
  uniform vec3 uStrokeColor;
  uniform float uBlueMix;
  uniform vec3 uBlueColor;
  uniform float uCornerR;
  varying vec2 vUv;
  varying vec2 vEdgeUv;

  vec3 srgbToLinear(vec3 c) {
    return mix(
      pow(c * 0.9478672986 + vec3(0.0521327014), vec3(2.4)),
      c * 0.0773993808,
      vec3(lessThanEqual(c, vec3(0.04045)))
    );
  }

  void main() {
    // — Rounded-corner tile mask (per-material, off unless uCornerR > 0) —
    // Each panel renders as a rounded-rectangle tile (faithful to the corner
    // radius on the panels in the SWM logo lockup) rather than a hard quad.
    // A cut corner discards, revealing the blue inner sphere / gap lattice
    // behind it — the lockup's blue-grid look. Standard rounded-box SDF over
    // the interpolated panel UV (vUv, 0..1). uCornerR is the corner radius in
    // UV units (the home globe sets ~0.12 = 12% of the shorter side; it must
    // stay < 0.5 so the panel centre always survives). uCornerR defaults to 0
    // — /process reuses this material and gets the branch skipped entirely, so
    // its tiles stay hard-edged (byte-identical to before this change).
    // Aspect: isotropic in UV — no per-panel aspect is available here, so on
    // panels whose UV aspect != 1 the rounded corner reads as a slight ellipse
    // rather than a true circle (mild: the lat-band aspects run ~0.69..1.14).
    // Pole wedges carry planar-projected UVs whose silhouette reaches only the
    // OUTER (equator-arc) UV corners while the converging apex normalizes to a
    // narrow strip near u~0.5 at the far edge — so this mask rounds a wedge's
    // outer corners only and leaves the apex untouched (no wedge-body clip).
    float cornerD = -1.0; // <0 = inside (kept); recomputed only when enabled
    if (uCornerR > 0.0) {
      vec2 cornerC = abs(vUv - 0.5);                          // 0..0.5 from tile centre
      vec2 cornerQ = max(cornerC - (0.5 - uCornerR), 0.0);
      cornerD = length(cornerQ) - uCornerR;                   // rounded-box SDF, <0 inside
      if (cornerD > 0.0) discard;                             // outside → inner sphere shows through blue
    }

    vec3 colorA = texture2D(texA, vUv * uvScaleA + uvOffsetA).rgb;
    vec3 colorB = texture2D(texB, vUv * uvScaleB + uvOffsetB).rgb;
    colorB = mix(colorB, srgbToLinear(colorB), uVideoB);
    vec3 base = mix(uFallbackColor, colorA, uHasTexA);
    vec3 color = mix(base, colorB, uMix) * uPower;
    // Edge stroke: distance to the nearest panel edge in aEdgeUv space,
    // converted to pixels via fwidth so the width holds under any camera
    // distance or panel scale. Applied after uPower — the stroke is ink,
    // not light, and must not dim with the cascade.
    float edge = min(min(vEdgeUv.x, 1.0 - vEdgeUv.x), min(vEdgeUv.y, 1.0 - vEdgeUv.y));
    float edgePx = edge / max(fwidth(edge), 1e-6);
    float stroke = (1.0 - smoothstep(uStrokeWidthPx - 0.6, uStrokeWidthPx + 0.6, edgePx))
      * uStrokeMix * step(0.01, uStrokeWidthPx); // width 0 = fully off, no edge hairline
    color = mix(color, uStrokeColor, stroke);
    // Commit blue-fill (chunk 4): last mix before the colorspace output so
    // at uBlueMix 1 the panel is exactly the inner sphere's blue — stroke,
    // texture and power all submerged under the field.
    color = mix(color, uBlueColor, uBlueMix);
    // Anti-alias the rounded corner (only when rounding is enabled): the pass
    // is opaque (no alpha blend), so fade the innermost ~1px of the cut toward
    // the gap/inner-sphere blue the discard reveals, so the arc reads smooth
    // instead of jagged. uBlueColor IS that blue, so the fringe is seamless
    // with what shows through; at commit (uBlueMix→1) the panel is already blue
    // and this resolves to a no-op.
    if (uCornerR > 0.0) {
      float cornerAA = max(fwidth(cornerD), 1e-6);
      color = mix(color, uBlueColor, smoothstep(-cornerAA, 0.0, cornerD));
    }
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

/** Shared 1×1 placeholder so sampler uniforms are never unbound */
let placeholderTexture = null;
export function getPlaceholderTexture() {
  if (!placeholderTexture) {
    placeholderTexture = new THREE.DataTexture(
      new Uint8Array([18, 18, 18, 255]), 1, 1, THREE.RGBAFormat
    );
    placeholderTexture.needsUpdate = true;
  }
  return placeholderTexture;
}

/**
 * @param {Object} opts
 * @param {number} opts.fallbackColor - hex color shown until the thumbnail lands
 * @param {number} [opts.cornerRadius=0] - rounded-tile radius in UV units
 *        (0 = hard edges, the /process default; the home globe passes ~0.12
 *        for lockup fidelity). Must stay < 0.5.
 * @returns {THREE.ShaderMaterial}
 */
export function createPanelMaterial({ fallbackColor, cornerRadius = 0 }) {
  const placeholder = getPlaceholderTexture();
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      texA: { value: placeholder },
      texB: { value: placeholder },
      uvScaleA: { value: new THREE.Vector2(1, 1) },
      uvOffsetA: { value: new THREE.Vector2(0, 0) },
      uvScaleB: { value: new THREE.Vector2(1, 1) },
      uvOffsetB: { value: new THREE.Vector2(0, 0) },
      uMix: { value: 0 },
      uPower: { value: 0 }, // cascade starts dark
      uHasTexA: { value: 0 },
      uVideoB: { value: 0 }, // 1 while texB holds a video (manual sRGB decode)
      uFallbackColor: { value: new THREE.Color(fallbackColor) },
      uStrokeMix: { value: 0 }, // 0 = no stroke (home globe); /process drives it
      uStrokeWidthPx: { value: 1.5 },
      uStrokeColor: { value: new THREE.Color(0x000000) },
      uBlueMix: { value: 0 }, // 0 = untouched — the commit blue-fill (useGlobeScene setBlueFill) drives it
      uBlueColor: { value: new THREE.Color(GAP_COLOR) }, // the inner sphere's blue, never a hand-picked hex
      uCornerR: { value: cornerRadius }, // rounded-tile radius; 0 = hard edges (/process); branch skipped when 0
    },
  });
}
