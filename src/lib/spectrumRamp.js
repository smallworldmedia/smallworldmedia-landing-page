// The spectrum scheme's outline ramp for the WebGL scenes: ramp A, drawn the way CSS draws it.
//
// The stops are `--swm-ramp-a` in src/styles/global.css, in order, at k/8. CSS blends gradient
// stops in gamma sRGB, so the stops stay gamma-encoded in the uniform and the chunk decodes to
// linear after the blend. No three.js import: a scene builds its own uniform from RAMP_A_RGB.

export const SPECTRUM_RAMP_A = [
  '#fe3720',
  '#ff7d01',
  '#ffb803',
  '#1858e2',
  '#5c53ba',
  '#7852a4',
  '#9f4f84',
  '#cd4962',
  '#f44041',
];

// 27 floats: r, g, b per stop, 0 to 1, gamma sRGB. Feed it to `uniform vec3 uRamp[9]`.
export const RAMP_A_RGB = SPECTRUM_RAMP_A.flatMap((hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
});

// The ramp at t (wraps), as gamma sRGB [r, g, b] 0 to 255: what CSS paints at that point of a
// gradient over the nine stops. Tests and the debug hooks read it; the shaders use RAMP_GLSL.
export function rampAt(t) {
  const x = (t - Math.floor(t)) * 8;
  const i = Math.min(Math.floor(x), 7);
  const f = x - i;
  return [0, 1, 2].map((c) =>
    Math.round((RAMP_A_RGB[i * 3 + c] * (1 - f) + RAMP_A_RGB[(i + 1) * 3 + c] * f) * 255),
  );
}

// GLSL: `spectrumRamp(t)` returns LINEAR rgb for t in 0 to 1 (wraps). Declares its own uniform.
export const RAMP_GLSL = /* glsl */ `
uniform vec3 uRamp[9];
vec3 spectrumRamp(float t) {
  float x = fract(t) * 8.0;
  vec3 c = uRamp[0];
  for (int k = 0; k < 8; k++) {
    c = mix(c, uRamp[k + 1], clamp(x - float(k), 0.0, 1.0));
  }
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
`;
