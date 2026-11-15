/**
 * worldRamp.js — the /work canvas's one screen-space ramp (US-7, spectrum scheme, wave 4).
 *
 * Under `spectrum` every line the scene draws (shell grid, FORME lattice, plate and wall borders,
 * the glow) takes ramp A left to right across the drawing buffer: spectrumRamp(gl_FragCoord.x / uRampW).
 * The ramp is fixed on screen, so it does not move with a plate and does not change per project.
 *
 * ONE uniform set is shared by reference by every material (`rampUniforms`): the ramp stops, the mix
 * (0 = the flat colour the material already carries, exactly today's output; 1 = the ramp) and the
 * drawing-buffer width. A scheme change writes uniforms only: no program, no slot, no texture rebuild.
 * Three's `LineBasicMaterial` is the `basic` program, and one `customProgramCacheKey` shares it.
 * The ramp enters where `diffuse` enters, in the colour space `diffuse` has there (three's material
 * colours are linear; spectrumRamp returns linear), under the material's own opacity and dim.
 *
 * No three import: a material comes in, a patched `onBeforeCompile` goes on it.
 */
import { RAMP_A_RGB, RAMP_GLSL } from '../../../lib/spectrumRamp.js';

/** The shared uniforms. `uRampW` is the scene target's width in device pixels (set at resize). */
export const rampUniforms = {
  uRamp: { value: RAMP_A_RGB },
  uRampMix: { value: 0 },
  uRampW: { value: 1 },
};

/** The glow's declarations: the ramp lookup plus the mix and the width. */
export const RAMP_FRAG_DECL = `${RAMP_GLSL}
uniform float uRampMix;
uniform float uRampW;
`;

/** The colour the ramp puts where a flat one would be: GLSL, linear rgb, from the fragment's x. */
export const RAMP_AT_FRAG = 'spectrumRamp( gl_FragCoord.x / uRampW )';

const MAIN = 'void main() {';
const DIFFUSE = 'vec4 diffuseColor = vec4( diffuse, opacity );';

/** `basic`'s fragment shader with the ramp in `diffuse`'s place, scaled by `uRampLevel` (a material's own dim). */
export function patchBasicFragment(src) {
  return src
    .replace(MAIN, `${RAMP_FRAG_DECL}uniform float uRampLevel;\n${MAIN}`)
    .replace(
      DIFFUSE,
      `vec4 diffuseColor = vec4( mix( diffuse, ${RAMP_AT_FRAG} * uRampLevel, uRampMix ), opacity );`
    );
}

// One uniform object per distinct level, so materials with the same dim share it.
const levels = new Map();
const levelUniform = (level) => {
  if (!levels.has(level)) levels.set(level, { value: level });
  return levels.get(level);
};

/**
 * Wire a `LineBasicMaterial` to the shared ramp. `level` is the factor the material's flat colour
 * is already dimmed by (the grid tint), applied to the ramp too: the ramp replaces the hue, not the level.
 * Call it where the material is created, so a slot built under spectrum starts on the ramp.
 */
export function applyRamp(material, level = 1) {
  const uniforms = { ...rampUniforms, uRampLevel: levelUniform(level) };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = patchBasicFragment(shader.fragmentShader);
  };
  material.customProgramCacheKey = () => 'worldRamp-basic';
  return material;
}
