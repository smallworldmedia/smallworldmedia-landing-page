/**
 * panelMaterial.js — Unlit ShaderMaterial for globe panels.
 *
 * One material instance per panel. The shader owns three jobs:
 *  - cover-fit crop via per-texture uvScale/uvOffset
 *  - texA ↔ texB crossfade via uMix (Stage 2: thumbnail ↔ live video)
 *  - power-on cascade via uPower (0 = dark panel, 1 = full brightness;
 *    values >1 over-brighten for the CRT flicker)
 *
 * Panels stay opaque — crossfading inside the shader avoids the draw-order
 * artifacts that transparent overlapping meshes cause on a convex sphere.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
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
  varying vec2 vUv;

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
    },
  });
}
