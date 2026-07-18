/**
 * heroOverlay.js — per-frame bridge between the three.js globe scene and the
 * DOM overlay layer (orbit ring, labels — consumers arrive in later chunks).
 *
 * The scene tick calls update() once per RENDERED frame, immediately after
 * renderer.render — so camera.matrixWorld / matrixWorldInverse / projection
 * and globeGroup.matrixWorld are exactly the matrices just drawn. update()
 * projects the globe's screen-space disc ONCE — center px + radius px — and
 * hands the same mutated frame object to every subscriber. Subscribers are
 * DOM writers on the shared cadence (the scene's FPS gate), so there is no
 * second rAF loop and no drift between canvas and overlay.
 *
 * Zero allocations per frame: module-scope scratch vectors, one persistent
 * frame object mutated in place, a hoisted emit closure. With no subscribers
 * update() returns immediately, so the bridge costs one call per frame until
 * a consumer arrives.
 */
import { Vector3 } from 'three';
import { RADIUS } from '../globe/globeConfig.js';

/* Scratch space — update() is synchronous and single-threaded, so these are
   safe at module scope across overlay instances. Never handed to subscribers. */
const vCenter = new Vector3();
const vRight = new Vector3();
const vEdge = new Vector3();

export function createHeroOverlay() {
  const subs = new Set();

  // The one frame context subscribers see — mutated in place each frame.
  const frame = {
    disc: { cx: 0, cy: 0, r: 0 }, // globe disc in CSS px within the canvas
    camera: null,
    globeGroup: null,
    w: 0,
    h: 0,
  };
  const emit = (cb) => cb(frame);

  return {
    /**
     * Called by useGlobeScene once per rendered frame, after renderer.render.
     * @param {{ camera: Object, globeGroup: Object, w: number, h: number }} ctx
     */
    update({ camera, globeGroup, w, h }) {
      if (subs.size === 0) return; // no consumers — skip the projection

      // Disc center: the globe group's world origin, projected to px.
      // (Post-render read — matrixWorld is fresh, no updateWorldMatrix walk.)
      vCenter.setFromMatrixPosition(globeGroup.matrixWorld);
      // Disc radius: one RADIUS along the camera's world-space right axis
      // (matrixWorld column 0) lands on the silhouette's horizontal extreme;
      // its px distance from the projected center is the on-screen radius.
      vRight.setFromMatrixColumn(camera.matrixWorld, 0);
      vEdge.copy(vCenter).addScaledVector(vRight, RADIUS);
      vCenter.project(camera); // → NDC, in place (scratch)
      vEdge.project(camera);

      const d = frame.disc;
      d.cx = (vCenter.x * 0.5 + 0.5) * w;
      d.cy = (vCenter.y * -0.5 + 0.5) * h; // NDC y-up → CSS y-down
      d.r = Math.hypot(
        (vEdge.x * 0.5 + 0.5) * w - d.cx,
        (vEdge.y * -0.5 + 0.5) * h - d.cy
      );
      frame.camera = camera;
      frame.globeGroup = globeGroup;
      frame.w = w;
      frame.h = h;

      subs.forEach(emit);
    },

    /**
     * Subscribe a per-frame consumer (ring/labels). Returns unsubscribe.
     * @param {(frame: Object) => void} cb
     * @returns {() => void}
     */
    onFrame(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}
