/**
 * lockupGlobeSnapshot — the /process hero's globe-O, rendered from the 3D
 * globe primitives (08-25, Nathan — supersedes the flat spinning
 * SWM-globe_white.svg: rotation was never the intent).
 *
 * Cross-utilizes the HOME globe's recreation without the video panels: the
 * fixed brand geometry (buildGlobeGeometry — 12 meridians, 5 lat bands,
 * the pole wedges converging like the mark), every panel flat ELECTRIC
 * BLUE, and BRAND WHITE showing through the gaps between panels (the inner
 * sphere), oriented at the brand tilt (INITIAL_PITCH_DEG — the top pole
 * tipped toward the camera, matching the globe in the lockup). Static by
 * design: no spin, no scheduler.
 *
 * Because the pose never changes, the globe renders EXACTLY ONCE to an
 * offscreen WebGL canvas and ships as a cached data-URL <img> — the
 * process hero's mount/unmount cycling (splash out, scroll-back restore)
 * costs nothing, and no live GL context outlives this module call.
 */
import * as THREE from 'three';
import buildGlobeGeometry from '../globe/buildGlobeGeometry.js';
import {
  LON_SEGMENTS,
  LAT_BANDS,
  GAP_DEG,
  CAP_DEG,
  INNER_SPHERE_SCALE,
  INITIAL_PITCH_DEG,
  GAP_COLOR,
} from '../globe/globeConfig.js';

const SNAPSHOT_PX = 768; // supersamples the ~glyph-height slot on any display
const WHITE = 0xffffff; // --color-white — the gap lattice

let cached = null;

/** Render (once) and return the globe-O snapshot as a PNG data URL. */
export function getLockupGlobeSnapshot() {
  if (cached) return cached;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(1); // SNAPSHOT_PX carries the resolution
  renderer.setSize(SNAPSHOT_PX, SNAPSHOT_PX);
  renderer.setClearColor(0x000000, 0); // transparent field around the disc

  const scene = new THREE.Scene();
  // Orthographic — the mark is a flat projection; the tiny margin keeps the
  // silhouette's antialiased edge off the canvas bounds.
  const EXTENT = 1.005;
  const camera = new THREE.OrthographicCamera(-EXTENT, EXTENT, EXTENT, -EXTENT, 0.1, 10);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const globe = new THREE.Group();
  scene.add(globe);
  globe.rotation.x = THREE.MathUtils.degToRad(INITIAL_PITCH_DEG); // brand tilt

  const { panels, innerSphereGeometry } = buildGlobeGeometry({
    lonSegments: LON_SEGMENTS,
    latBands: LAT_BANDS,
    gapDeg: GAP_DEG,
    capDeg: CAP_DEG,
    radius: 1,
  });
  const panelMaterial = new THREE.MeshBasicMaterial({ color: GAP_COLOR }); // electric blue
  for (const panel of panels) globe.add(new THREE.Mesh(panel.geometry, panelMaterial));

  const innerMaterial = new THREE.MeshBasicMaterial({ color: WHITE });
  const innerSphere = new THREE.Mesh(innerSphereGeometry, innerMaterial);
  innerSphere.scale.setScalar(INNER_SPHERE_SCALE);
  globe.add(innerSphere);

  renderer.render(scene, camera);
  cached = renderer.domElement.toDataURL('image/png');

  // The frame is captured — tear the whole context down.
  for (const panel of panels) panel.geometry.dispose();
  innerSphereGeometry.dispose();
  panelMaterial.dispose();
  innerMaterial.dispose();
  renderer.dispose();
  renderer.forceContextLoss();

  return cached;
}
