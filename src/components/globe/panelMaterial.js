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
import {
  GAP_COLOR,
  SCROLL_POLE_CORNER_TIP,
  SCROLL_POLE_CORNER_WIDE,
  SCROLL_POLE_CORNER_START,
  SCROLL_POLE_TIP_LIFT,
} from './globeConfig.js';

// USE_INSTANCING: three defines it (and declares instanceMatrix) when the
// material renders on an InstancedMesh — the /process decoy pool. Regular
// panel meshes compile the plain path; behavior there is unchanged.
//
// Polar meridian scroll (brand globe choreography, note 6): the SWM globe's
// signature motion is rows of tiles TRAVELLING pole-to-pole — a tile is born at
// the top pole, grows outward down the meridians, and is consumed at the bottom
// pole. That is a per-row shift along the polar (theta) angle, and a latitude
// ring changing theta reshapes (it is not a rigid transform), so it can only
// happen in the vertex shader. Each panel reads uPolarTop (its row's current top
// theta) and repositions its vertices from the canonical band it was built at
// (uCanonTop) onto the sphere at the new theta, preserving longitude (phi,
// recovered from the vertex position — no extra attributes). uUsePolarScroll
// gates it: 0 (the default — /process, /lab, every non-scrolling caller) leaves
// position untouched and byte-identical; the MeridianScroll driver sets it to 1
// and animates uPolarTop. phi stays well-defined because tiles are built at a
// mid-sphere canonical band (never at a pole, where atan would collapse). At the
// poles the repositioned band pinches to a point (sinθ→0) — the born/consumed
// singularity, and where a parked row's assets recycle unseen.
const vertexShader = /* glsl */ `
  attribute vec2 aEdgeUv;
  uniform float uUsePolarScroll;
  uniform float uPolarTop;
  uniform float uCanonTop;
  varying vec2 vUv;
  varying vec2 vEdgeUv;
  varying float vK; // media horizontal crop factor (1 = full; <1 = centre-crop)
  varying float vFlipPole; // 1 = tile nearer the TOP pole (pole-facing edge is vUv.y=1)
  void main() {
    vUv = uv;
    vEdgeUv = aEdgeUv;
    vK = 1.0;
    vFlipPole = 0.0;
    vec3 pos = position;
    if (uUsePolarScroll > 0.5) {
      float PI = 3.141592653589793;
      // A row's tiles narrow as sin(θ) toward the poles while their texture UV
      // still spans 0..1 — that is what squeezes the media into the pinch. vK =
      // sin(θ_center) is the width ratio vs the canonical (equator) band; the
      // fragment compresses the media SAMPLING by vK around the tile centre so
      // pixel density stays constant (undistorted) and the panel silhouette
      // simply crops toward the centre. θ_center is uniform per row (all its
      // tiles share a latitude), so vK is a flat varying — no keystoning.
      float thetaC = uPolarTop + (0.5 * PI - uCanonTop);
      vK = sin(clamp(thetaC, 0.0, PI));
      // Which pole is this row nearest? thetaC < π/2 → top hemisphere, where the
      // pole-facing edge is vUv.y=1 (not 0). Flat per row. The flip switches at
      // the equator, where poleness=0, so the height-eat is off there → seamless.
      vFlipPole = thetaC < 0.5 * PI ? 1.0 : 0.0;
      float r = length(position);
      float theta = acos(clamp(position.y / r, -1.0, 1.0)); // polar angle from +Y
      float phi = atan(position.z, -position.x);            // longitude (build convention)
      // Shift the band's top to uPolarTop, then CLAMP to [0,π]: vertices pushed
      // past a pole collapse onto it, so a row emerging above the top pole (or
      // consuming below the bottom) pinches cleanly to the pole point and a fully
      // parked buffer row degenerates to zero area (auto-hidden) — no flipped
      // slivers, and content grows outward from / shrinks into the poles.
      float t = clamp((theta - uCanonTop) + uPolarTop, 0.0, PI);
      float st = sin(t);
      pos = vec3(-cos(phi) * st, cos(t), sin(phi) * st) * r;
    }
    vec4 localPos = vec4(pos, 1.0);
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
  uniform float uUsePolarScroll;  // 1 = scroll globe (gates pole softening)
  uniform float uPoleCornerTip;   // scroll globe: bottom-cap HORIZONTAL radius at the pole (round nose)
  uniform float uPoleCornerWide;  // scroll globe: wide-end + straight-wall corner radius at the pole
  uniform float uPoleCornerStart; // scroll globe: sin(θ) below which the pole cap ramps in
  uniform float uPoleTipLift;     // scroll globe: pole-facing cap lift — bottom fraction dissolved to blue at the pole (terminate-short amount, UV units)
  varying vec2 vUv;
  varying vec2 vEdgeUv;
  varying float vK; // media horizontal crop factor / pole-proximity from the vertex stage
  varying float vFlipPole; // 1 = top-pole row → mirror the cap's pole-facing edge to vUv.y=1

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
    //
    // Pole height-eat (scroll globe): as a tile nears a pole (vK = sin(θ_center)
    // → 0) its pole-facing bottom must NOT drive its full height into the
    // convergence point — instead the bottom LIFTS into a rounded cap that
    // terminates SHORT of the pole, leaving a clean blue pole region (the brand
    // globe icon's rounded panels). Rather than a per-half radius ternary — which
    // seams at the midline and caps the bottom rounding at a semicircle (its arc
    // stops at the vertical midline, so the panel still reaches the pole) — the
    // whole tile is ONE field: a wide rounded box INTERSECTED with a lifted
    // elliptical bottom cap, cornerD = max(boxD, capD). One field over the tile
    // ⇒ the midline is C0 by construction (no seam), and the cap's VERTICAL radius
    // can exceed 0.5 natively because the normalized ellipse never forms a
    // (0.5 − rV) box inset. uPoleTipLift is the terminate-short amount. Gated by
    // uUsePolarScroll AND uCornerR>0; at poleness 0 every radius collapses to
    // uCornerR so the field IS the base box (no pop as a tile enters the scroll
    // band), and the non-scroll path is byte-identical (parity).
    float cornerD = -1.0; // <0 = inside (kept); recomputed only when enabled
    if (uUsePolarScroll > 0.5 && uCornerR > 0.0) {
      // clamp guards both ends: edge0==edge1 (a bench-set 0 → smoothstep(0,0,·)
      // NaN at the pole) AND the upper bound — uPoleCornerStart is a sin(θ)
      // threshold, so values >1 are meaningless and would leave poleness>0 at the
      // equator, where vFlipPole hard-switches, popping the mirrored cap edge.
      // Clamping to ≤1 keeps poleness=0 at the equator → the flip stays seamless.
      // A no-op for every in-range value (default 0.4).
      float poleness = 1.0 - smoothstep(0.0, clamp(uPoleCornerStart, 1e-4, 1.0), vK); // →1 near pole
      float rWide = mix(uCornerR, uPoleCornerWide, poleness);               // top/away corners + straight walls
      float rTip  = mix(uCornerR, uPoleCornerTip,  poleness);               // bottom HORIZONTAL radius (≤ 0.5)
      float rLift = mix(uCornerR, uPoleCornerTip + uPoleTipLift, poleness); // bottom VERTICAL radius = rTip + lift
      // (1) Wide rounded box over the whole tile (true-distance SDF, unit
      //     gradient) — governs the top corners and every straight wall.
      vec2  cornerC = abs(vUv - 0.5);
      vec2  cornerQ = max(cornerC - (0.5 - rWide), 0.0);
      float boxD = length(cornerQ) - rWide;
      // (2) Lifted elliptical bottom cap. Equator height wC = 2·rLift − rTip, so
      //     the cap's nose (lowest point, vUv.x centre) sits at vUv.y = rLift −
      //     rTip = poleness·uPoleTipLift, and its widest point meets the side
      //     walls at wC. No term evaluates (0.5 − rLift), so rLift > 0.5 is safe;
      //     the divisor guards keep a tuner's uPoleCornerTip=0 from NaN-ing the
      //     pinch row (rTip ≥ uCornerR = 0.12 on the default path — no-op).
      float rTs = max(rTip,  1e-4);
      float rLs = max(rLift, 1e-4);
      float gx  = max(abs(vUv.x - 0.5) - (0.5 - rTip), 0.0);  // horizontal reach into the cap
      // Pole-facing edge is vUv.y=0 near the BOTTOM pole, vUv.y=1 near the TOP —
      // vFlipPole (per row, from the vertex stage) mirrors the cap so both poles
      // eat their pole-facing edge with the same dialed values.
      float w   = mix(vUv.y, 1.0 - vUv.y, vFlipPole);
      float gy  = max((2.0 * rLift - rTip) - w, 0.0);         // drop below the equator (toward the near pole)
      float capD = length(vec2(gx / rTs, gy / rLs)) - 1.0;
      // Intersect: survive iff inside the box AND above the cap. Both are
      // inside-tests, so max() is a sign-exact intersection — no midline seam, no
      // side-notch, for any radii.
      cornerD = max(boxD, capD);
      if (cornerD > 0.0) discard;                             // outside → inner sphere shows through blue
    } else if (uCornerR > 0.0) {
      // Parity path — the literal original rounded-box SDF, byte-identical to today.
      vec2 cornerC = abs(vUv - 0.5);                          // 0..0.5 from tile centre
      vec2 cornerQ = max(cornerC - (0.5 - uCornerR), 0.0);
      cornerD = length(cornerQ) - uCornerR;                   // rounded-box SDF, <0 inside
      if (cornerD > 0.0) discard;                             // outside → inner sphere shows through blue
    }

    // Media projection is DECOUPLED from the panel silhouette: the mask + stroke
    // read the panel-shape UV (vUv), but the media samples a horizontally
    // compressed tile-UV (mUv) — as a scroll tile narrows toward a pole (vK<1)
    // the sampled window shrinks toward the tile centre at constant pixel
    // density, so the panel CROPS undistorted media instead of squeezing it into
    // the pinch. vK = 1 off the scroll path → mUv = vUv → byte-identical.
    vec2 mUv = uUsePolarScroll > 0.5 ? vec2(0.5 + (vUv.x - 0.5) * vK, vUv.y) : vUv;
    vec3 colorA = texture2D(texA, mUv * uvScaleA + uvOffsetA).rgb;
    vec3 colorB = texture2D(texB, mUv * uvScaleB + uvOffsetB).rgb;
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
      // Polar meridian scroll (brand choreography) — identity/off by default so
      // /process, /lab and every non-scrolling caller stay byte-identical; the
      // MeridianScroll driver flips uUsePolarScroll on and animates uPolarTop.
      uUsePolarScroll: { value: 0 }, // 1 = reposition vertices by uPolarTop
      uPolarTop: { value: 0 }, // this row's current top polar angle (radians)
      uCanonTop: { value: 0 }, // the polar angle the tile's band was built at (radians)
      uFallbackColor: { value: new THREE.Color(fallbackColor) },
      uStrokeMix: { value: 0 }, // 0 = no stroke (home globe); /process drives it
      uStrokeWidthPx: { value: 1.5 },
      uStrokeColor: { value: new THREE.Color(0x000000) },
      uBlueMix: { value: 0 }, // 0 = untouched — the commit blue-fill (useGlobeScene setBlueFill) drives it
      uBlueColor: { value: new THREE.Color(GAP_COLOR) }, // the inner sphere's blue, never a hand-picked hex
      uCornerR: { value: cornerRadius }, // rounded-tile radius; 0 = hard edges (/process); branch skipped when 0
      // Pole softening — active only on the scroll globe (uUsePolarScroll=1) and
      // only where uCornerR>0; non-scroll tiles (vK=1) are unaffected.
      uPoleCornerTip: { value: SCROLL_POLE_CORNER_TIP },
      uPoleCornerWide: { value: SCROLL_POLE_CORNER_WIDE },
      uPoleCornerStart: { value: SCROLL_POLE_CORNER_START },
      uPoleTipLift: { value: SCROLL_POLE_TIP_LIFT },
    },
  });
}
