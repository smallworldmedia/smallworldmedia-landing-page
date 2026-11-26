// The spectrum scheme's outline ramp (wave 4): src/lib/spectrumRamp.js is the one description of ramp A for the
// WebGL scenes, and --swm-ramp-a in global.css is the one the DOM paints. These tests pin the first at its stops,
// at a midpoint and across the wrap, and pin the two together so neither can drift. The GLSL half of the globe
// (panelMaterial, useGlobeScene's gap shader) is read as source: it must use the ramp the way the chunk expects.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SPECTRUM_RAMP_A, RAMP_A_RGB, RAMP_GLSL, rampAt } from '../../src/lib/spectrumRamp.js';

const rgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

test('rampAt hits the stops at k/8, the last one as t reaches 1 (where the turn wraps back to the first)', () => {
  SPECTRUM_RAMP_A.slice(0, 8).forEach((hex, k) => {
    assert.deepEqual(rampAt(k / 8), rgb(hex), `stop ${k}`);
  });
  const near = rampAt(1 - 1e-9); // just before the wrap: the ninth stop
  assert.deepEqual(near, rgb(SPECTRUM_RAMP_A[8]));
  assert.deepEqual(rampAt(1), rgb(SPECTRUM_RAMP_A[0]), 't = 1 is the turn complete: the first stop again');
});

test('rampAt blends in gamma sRGB, the way CSS does, so the midpoint of two stops is their channel mean', () => {
  const close = (got, want) => got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= 1, `${got} vs ${want}`));
  const mean = (a, b) => a.map((v, i) => (v + b[i]) / 2);
  close(rampAt(2.5 / 8), mean(rgb(SPECTRUM_RAMP_A[2]), rgb(SPECTRUM_RAMP_A[3]))); // yellow to blue
  close(rampAt(7.5 / 8), mean(rgb(SPECTRUM_RAMP_A[7]), rgb(SPECTRUM_RAMP_A[8])));});

test('rampAt wraps so t and t + n are the same colour, negative t included', () => {
  for (const t of [0, 0.1, 0.37, 0.5, 0.83, 0.999]) {
    assert.deepEqual(rampAt(t + 1), rampAt(t), `t ${t} + 1`);
    assert.deepEqual(rampAt(t + 3), rampAt(t), `t ${t} + 3`);
    assert.deepEqual(rampAt(t - 1), rampAt(t), `t ${t} - 1`);
  }
  assert.deepEqual(rampAt(-0.25), rampAt(0.75));
});

test('RAMP_A_RGB is 27 floats in 0 to 1, nine stops of r g b each, in gamma sRGB', () => {
  assert.equal(SPECTRUM_RAMP_A.length, 9);
  assert.equal(RAMP_A_RGB.length, 27);
  assert.ok(RAMP_A_RGB.every((v) => Number.isFinite(v) && v >= 0 && v <= 1));
  SPECTRUM_RAMP_A.forEach((hex, k) => {
    assert.deepEqual(
      RAMP_A_RGB.slice(k * 3, k * 3 + 3).map((v) => Math.round(v * 255)),
      rgb(hex),
      `stop ${k}`,
    );
  });
});

test('RAMP_GLSL declares the nine-stop uniform and the linear-returning function a shader calls', () => {
  assert.ok(RAMP_GLSL.includes('uniform vec3 uRamp[9]'));
  assert.ok(RAMP_GLSL.includes('vec3 spectrumRamp(float t)'));
  assert.ok(RAMP_GLSL.includes('pow((c + 0.055) / 1.055, vec3(2.4))'), 'it decodes the gamma blend to linear');
});

test('PARITY SPECTRUM_RAMP_A is --swm-ramp-a in global.css, stop for stop', () => {
  const css = read('src/styles/global.css');
  const vars = new Map([...css.matchAll(/(--swm-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const decl = vars.get('--swm-ramp-a');
  assert.ok(decl, '--swm-ramp-a is declared');
  const stops = decl.split(',').map((s) => {
    const v = s.trim().match(/^var\((--swm-[a-z-]+)\)$/);
    return (v ? vars.get(v[1]) : s.trim()).toLowerCase();
  });
  assert.deepEqual(stops, SPECTRUM_RAMP_A);
});

// The globe's two shaders read the ramp the same way: t = the clockwise-from-top turn about the ring's centre,
// from gl_FragCoord in a y-up frame (atan(dx, dyUp) / 2 pi), gated by a mix that is 0 for every other scheme.
const TURN = 'atan(rampD.x, rampD.y) * 0.15915494309189535';

test('the panel shader draws the surge and the corner fringe from one blue field that is the flat blue at mix 0', () => {
  const src = read('src/components/globe/panelMaterial.js');
  assert.ok(src.includes('${RAMP_GLSL}'), 'the panel shader embeds the pinned chunk');
  assert.ok(src.includes('uniform float uRampMix;') && src.includes('uniform vec2 uRampCenter;'));
  assert.ok(src.includes('vec3 blueField = uBlueColor;'), 'the field starts as today\'s colour');
  assert.ok(src.includes('if (uRampMix > 0.0) {'), 'and stays exactly it at mix 0');
  assert.ok(src.includes(TURN));
  assert.ok(src.includes('color = mix(color, blueField, uBlueMix);'), 'the surge reads the field');
  assert.ok(src.includes('color = mix(color, blueField, smoothstep(-cornerAA, 0.0, cornerD));'), 'so does the corner fringe');
  assert.ok(!/mix\(color, uBlueColor,/.test(src), 'neither reads the flat blue directly any more');
});

test('the gap shader adds the ramp to the accent in the intro\'s white-to-accent lerp, weighted by mix x inkT', () => {
  const src = read('src/components/globe/useGlobeScene.js');
  assert.ok(src.includes('diffuseColor.rgb += uRampWeight * (spectrumRamp(atan(rampD.x, rampD.y) * 0.15915494309189535) - uRampAccent);'));
  assert.ok(src.includes('rampWeight.value = rampMix.value * inkT;'), 'the weight is the mix times the intro ink');
  assert.ok(src.includes('ramp: rampUniforms,'), 'every panel shares the scene\'s one ramp uniform set');
});
