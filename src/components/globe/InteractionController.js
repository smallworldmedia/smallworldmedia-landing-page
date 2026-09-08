/**
 * InteractionController.js — Ambient drift + pointer drag with inertia.
 *
 * Since 09-08 a thin yaw/pitch skin over the shared engine in
 * src/lib/dragMomentum.js (Nathan: ONE drag + momentum choreography — the
 * logo ticker rides the same numbers). The controller owns angular
 * *velocity*; useGlobeScene owns the angles. While dragging, pointer deltas
 * pass through 1:1. On release, the flick velocity GSAP-tweens back to the
 * ambient drift (power2.out — smooth family), so the globe never stops dead.
 *
 * Ambient mode: `still` (home hero, note 6) holds the globe FIXED at its
 * brand tilt — no drift; a drag flicks then settles back to rest, and the
 * pitch clamp keeps it from being stranded. Callers that pass nothing (lab,
 * other) keep the legacy yaw auto-rotate. Reduced motion → still regardless.
 */
import DragMomentum from '../../lib/dragMomentum.js';
import {
  AUTO_ROTATE_SPEED,
  DRAG_SENSITIVITY,
  MAX_FLICK_SPEED,
  PREFERS_REDUCED_MOTION,
} from './globeConfig.js';

export default class InteractionController {
  constructor(el, { still = false } = {}) {
    const ambient =
      PREFERS_REDUCED_MOTION || still ? { x: 0, y: 0 } : { x: AUTO_ROTATE_SPEED, y: 0 };
    this.engine = new DragMomentum(el, {
      ambient,
      sensitivity: DRAG_SENSITIVITY,
      maxSpeed: MAX_FLICK_SPEED,
      reducedMotion: PREFERS_REDUCED_MOTION,
    });
  }

  /** The live scheduler defers video promotions while a drag is down. */
  get dragging() {
    return this.engine.dragging;
  }

  /**
   * @param {number} dt - seconds since last update
   * @returns {{ dYaw: number, dPitch: number }} rotation deltas to apply
   */
  update(dt) {
    const { dx, dy } = this.engine.update(dt);
    return { dYaw: dx, dPitch: dy };
  }

  dispose() {
    this.engine.dispose();
  }
}
