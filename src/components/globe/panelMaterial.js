/**
 * panelMaterial.js — Unlit ShaderMaterial for globe panels.
 *
 * One material instance per panel. The shader owns four jobs:
 *  - cover-fit crop via per-texture uvScale/uvOffset
 *  - texA ↔ texB crossfade via uMix (Stage 2: thumbnail ↔ live video)
 *  - power-on cascade via uPower (0 = dark panel, 1 = full brightness;
 *    values >1 over-brighten for the CRT flicker)
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
 * @returns {THREE.ShaderMaterial}
 */
export function createPanelMaterial({ fallbackColor }) {
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
    },
  });
}
