/**
 * liveLockupGlobe — the /process globe-O, LIVE (08-28, Nathan — supersedes
 * the 08-25 static snapshot; lockupGlobeSnapshot stays for reference).
 *
 * Round 3 (Nathan): the O is the HOME hero globe AT REST, in the mark
 * colorway — buildScrollingGlobeGeometry + the panel shader's polar-scroll
 * path (uUsePolarScroll=1, uPolarTop pinned at the scroll-0 layout), so
 * the POLE treatment carries over exactly: panels pinch toward the poles
 * but never reach the convergence point, the corner radius ramps to the
 * rounded nose (SCROLL_POLE_CORNER_* + tip lift), and the white lattice
 * keeps its stroke width at the poles — the lockup SVG's construction.
 * The cascade is retired (round-3 call: the rotation carries the motion);
 * panels hold full power. ?ospin deg/s (negative = westward) spins the
 * globe around its OWN polar axis — the tilt group wraps the spin group,
 * so the pole stays tipped toward the camera while the meridians travel.
 *
 * 09-09 (Nathan): the O takes the same DRAG + FLICK the home globe and the
 * footer logo ticker ride (src/lib/dragMomentum.js) — the glyph is a globe
 * instance like any other, so grabbing it spins it and letting go settles
 * back to the ?ospin ambient over the house 0.35s. Only the spin axis is
 * driven (the brand tilt is the OUTER group and stays put — the mark must
 * never tip). Touch stands down, as it does on the scene behind it: a finger
 * on this page pages the walk.
 *
 * The backing canvas is a fixed square supersample (768px, the snapshot's
 * resolution) CSS-scaled into the glyph slot — window resizes never touch
 * GL. Create on hero mount, dispose on leave (the existing globe-O
 * lifecycle); dispose() tears the whole context down.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import { buildScrollingGlobeGeometry } from '../globe/buildGlobeGeometry.js';
import { createPanelMaterial } from '../globe/panelMaterial.js';
import DragMomentum from '../../lib/dragMomentum.js';
import {
  LON_SEGMENTS,
  GAP_DEG,
  SCROLL_VISIBLE_ROWS,
  SCROLL_LAT_GAP_DEG,
  INNER_SPHERE_SCALE,
  INITIAL_PITCH_DEG,
  GAP_COLOR,
  PANEL_CORNER_RADIUS,
  DRAG_SENSITIVITY,
  MAX_FLICK_SPEED,
  PREFERS_REDUCED_MOTION,
} from '../globe/globeConfig.js';
import { O_SPIN_DPS } from './processConfig.js';

const BACKING_PX = 768; // supersamples the ~glyph-height slot on any display
const WHITE = 0xffffff; // --color-white — the gap lattice

export function createLockupGlobe() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(1); // BACKING_PX carries the resolution
  renderer.setSize(BACKING_PX, BACKING_PX, false);
  renderer.setClearColor(0x000000, 0); // transparent field around the disc

  const scene = new THREE.Scene();
  // Orthographic — the mark is a flat projection; the tiny margin keeps the
  // silhouette's antialiased edge off the canvas bounds.
  const EXTENT = 1.005;
  const camera = new THREE.OrthographicCamera(-EXTENT, EXTENT, EXTENT, -EXTENT, 0.1, 10);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const tilt = new THREE.Group(); // brand pitch — OUTER, so the spin axis stays tipped
  scene.add(tilt);
  tilt.rotation.x = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG);
  const spin = new THREE.Group();
  tilt.add(spin);

  // The home hero's scroll grid, pinned at scroll-0 (rows spread into the
  // sphere, one buffer row beyond each pole — useGlobeScene's rest layout).
  const scrollPitch = Math.PI / SCROLL_VISIBLE_ROWS;
  const { panels, innerSphereGeometry } = buildScrollingGlobeGeometry({
    lonSegments: LON_SEGMENTS,
    rows: SCROLL_VISIBLE_ROWS + 2,
    gapDeg: GAP_DEG,
    latGapDeg: SCROLL_LAT_GAP_DEG,
    pitchRad: scrollPitch,
    radius: 1,
  });
  for (const panel of panels) {
    // The home panel shader in the mark colorway: flat electric-blue fill,
    // the baked lockup corner radius, the corner cut painted WHITE so the
    // rounding melts into this globe's white gap lattice — and the polar
    // scroll path ON so the pole pinch/nose treatment applies.
    const material = createPanelMaterial({
      fallbackColor: GAP_COLOR,
      cornerRadius: PANEL_CORNER_RADIUS,
    });
    const u = material.uniforms;
    u.uBlueColor.value.set(WHITE);
    u.uUsePolarScroll.value = 1;
    u.uCanonTop.value = panel.canonTop;
    u.uPolarTop.value = panel.row * scrollPitch; // scroll-0: the rest sphere
    u.uPower.value = 1; // no cascade (round-3 call) — panels hold full power
    panel.mesh = new THREE.Mesh(panel.geometry, material);
    panel.mesh.frustumCulled = false; // shader repositions vertices off the built band
    spin.add(panel.mesh);
  }
  const innerMaterial = new THREE.MeshBasicMaterial({ color: WHITE });
  const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
  innerSphere.scale.setScalar(INNER_SPHERE_SCALE);
  spin.add(innerSphere);

  const spinRad = THREE.MathUtils.degToRad(O_SPIN_DPS);
  // ?ospin is the AMBIENT now, not a clock: the angle accumulates so a drag
  // can add to it and the release can settle back without a seam. Reduced
  // motion keeps the plain ambient (no engine, no pointer surface).
  const drag = PREFERS_REDUCED_MOTION
    ? null
    : new DragMomentum(renderer.domElement, {
        ambient: { x: spinRad, y: 0 },
        sensitivity: DRAG_SENSITIVITY,
        maxSpeed: MAX_FLICK_SPEED,
        reducedMotion: PREFERS_REDUCED_MOTION,
        touch: false, // the /process swipe quantizer owns the finger
      });
  const tick = (_time, deltaMs) => {
    // Clamp the step: a backgrounded tab hands back one huge delta, which
    // would snap the mark through a random number of turns on return.
    const step = Math.min(deltaMs, 100) / 1000;
    const { dx } = drag ? drag.update(step) : { dx: spinRad * step };
    spin.rotation.y += dx;
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);

  return {
    canvas: renderer.domElement,
    dispose() {
      gsap.ticker.remove(tick);
      drag?.dispose();
      for (const panel of panels) {
        panel.geometry.dispose();
        panel.mesh.material.dispose();
      }
      innerSphereGeometry.dispose();
      innerMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
