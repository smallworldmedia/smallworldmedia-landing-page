/**
 * liveLockupGlobe — the /process globe-O, LIVE (08-28, Nathan — supersedes
 * the 08-25 static snapshot; lockupGlobeSnapshot stays for reference).
 *
 * Round 2 (Nathan): this is the HOME globe's own dialed-in parts in the
 * mark colorway, not a re-approximation — panels render through
 * createPanelMaterial (so the lockup corner radius, PANEL_CORNER_RADIUS,
 * and every shader refinement carry over; the corner cut paints the
 * lattice WHITE here via uBlueColor), and the cascade is the home cascade
 * family itself (buildCascadeTimeline — the CRT power-on flicker,
 * ?ocasvar rows|poles|sweep), looping with a ?ocas-second rest between
 * sweeps. A slow spin turns the globe around its OWN polar axis (the tilt
 * group wraps the spin group, so the pole stays tipped toward the camera
 * while the meridian wedges travel), ?ospin deg/s.
 *
 * The backing canvas is a fixed square supersample (768px, the snapshot's
 * resolution) CSS-scaled into the glyph slot — window resizes never touch
 * GL. Create on hero mount, dispose on leave (the existing globe-O
 * lifecycle); dispose() tears the whole context down.
 */
import * as THREE from 'three';
import gsap from 'gsap';
import buildGlobeGeometry from '../globe/buildGlobeGeometry.js';
import { createPanelMaterial } from '../globe/panelMaterial.js';
import buildCascadeTimeline from '../globe/cascade.js';
import {
  LON_SEGMENTS,
  LAT_BANDS,
  GAP_DEG,
  CAP_DEG,
  INNER_SPHERE_SCALE,
  INITIAL_PITCH_DEG,
  GAP_COLOR,
  PANEL_CORNER_RADIUS,
} from '../globe/globeConfig.js';
import { O_SPIN_DPS, O_CASCADE_S, O_CASCADE_VARIANT } from './processConfig.js';

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

  const { panels, innerSphereGeometry } = buildGlobeGeometry({
    lonSegments: LON_SEGMENTS,
    latBands: LAT_BANDS,
    gapDeg: GAP_DEG,
    capDeg: CAP_DEG,
    radius: 1,
  });
  for (const panel of panels) {
    // The home panel shader in the mark colorway: flat electric-blue fill,
    // the baked lockup corner radius, and the corner cut painted WHITE so
    // the rounding melts into this globe's white gap lattice.
    const material = createPanelMaterial({
      fallbackColor: GAP_COLOR,
      cornerRadius: PANEL_CORNER_RADIUS,
    });
    material.uniforms.uBlueColor.value.set(WHITE);
    panel.mesh = new THREE.Mesh(panel.geometry, material);
    spin.add(panel.mesh);
  }
  const innerMaterial = new THREE.MeshBasicMaterial({ color: WHITE });
  const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
  innerSphere.scale.setScalar(INNER_SPHERE_SCALE);
  spin.add(innerSphere);

  // Cascade: the home power-on flicker, looping with a rest between sweeps.
  // ?ocas=0 = off — panels hold full power (createPanelMaterial starts dark).
  const totalRows = LAT_BANDS + 2;
  let cascadeTl = null;
  if (O_CASCADE_S > 0) {
    cascadeTl = buildCascadeTimeline(panels, O_CASCADE_VARIANT, totalRows);
    cascadeTl.repeat(-1).repeatDelay(O_CASCADE_S);
  } else {
    for (const panel of panels) panel.mesh.material.uniforms.uPower.value = 1;
  }

  const spinRad = THREE.MathUtils.degToRad(O_SPIN_DPS);
  let t0 = null;
  const tick = (time) => {
    if (t0 == null) t0 = time;
    spin.rotation.y = spinRad * (time - t0);
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);

  return {
    canvas: renderer.domElement,
    dispose() {
      gsap.ticker.remove(tick);
      cascadeTl?.kill();
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
