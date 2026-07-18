/**
 * InteractionController.js — Ambient drift + pointer drag with inertia.
 *
 * The controller owns angular *velocity*; useGlobeScene owns the angles.
 * While dragging, pointer deltas pass through 1:1. On release, the flick
 * velocity GSAP-tweens back to ambient drift (power2.out — smooth family),
 * so the globe never stops dead.
 *
 * Ambient mode (home hero, note 6): when a `cascadeSpeed` (rad/s) is given,
 * the ambient drift is a constant PITCH roll instead of yaw — the sphere
 * rotates about its horizontal axis so surface content flows top-to-bottom
 * toward the near pole (a slow content cascade). Callers that pass nothing
 * (lab, other) keep the legacy yaw auto-rotate. Reduced motion → still.
 */
import gsap from 'gsap';
import {
  AUTO_ROTATE_SPEED,
  DRAG_SENSITIVITY,
  MAX_FLICK_SPEED,
  INERTIA_SECONDS,
  PREFERS_REDUCED_MOTION,
} from './globeConfig.js';

export default class InteractionController {
  constructor(el, { cascadeSpeed = null } = {}) {
    this.el = el;
    // Ambient rest velocity. Cascade mode = pitch drift (content flows down —
    // positive dPitch moves the camera-facing surface screen-down under the
    // elevated underside view); legacy = yaw drift. RM stills both.
    const cascade = cascadeSpeed != null;
    this.ambient = PREFERS_REDUCED_MOTION
      ? { yaw: 0, pitch: 0 }
      : cascade
        ? { yaw: 0, pitch: cascadeSpeed }
        : { yaw: AUTO_ROTATE_SPEED, pitch: 0 };
    this.dragging = false;
    this.vel = { yaw: this.ambient.yaw, pitch: this.ambient.pitch };
    this.pendingYaw = 0;
    this.pendingPitch = 0;
    this.instYaw = 0;
    this.instPitch = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastT = 0;

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);

    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
  }

  onDown(e) {
    this.el.setPointerCapture(e.pointerId);
    gsap.killTweensOf(this.vel);
    this.dragging = true;
    this.instYaw = 0;
    this.instPitch = 0;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = performance.now();
    this.el.style.cursor = 'grabbing';
  }

  onMove(e) {
    if (!this.dragging) return;
    const now = performance.now();
    const dt = Math.max((now - this.lastT) / 1000, 1e-4);
    const dYaw = (e.clientX - this.lastX) * DRAG_SENSITIVITY;
    const dPitch = (e.clientY - this.lastY) * DRAG_SENSITIVITY;

    this.pendingYaw += dYaw;
    this.pendingPitch += dPitch;

    // Exponentially smoothed instantaneous velocity → release flick speed
    this.instYaw = this.instYaw * 0.7 + (dYaw / dt) * 0.3;
    this.instPitch = this.instPitch * 0.7 + (dPitch / dt) * 0.3;

    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = now;
  }

  onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    this.el.style.cursor = 'grab';

    if (PREFERS_REDUCED_MOTION) {
      this.vel.yaw = 0;
      this.vel.pitch = 0;
      return;
    }

    const clamp = (v) => Math.max(-MAX_FLICK_SPEED, Math.min(MAX_FLICK_SPEED, v));
    this.vel.yaw = clamp(this.instYaw);
    this.vel.pitch = clamp(this.instPitch);

    // Settle back to the ambient drift (the cascade pitch, or legacy yaw).
    gsap.to(this.vel, {
      yaw: this.ambient.yaw,
      pitch: this.ambient.pitch,
      duration: INERTIA_SECONDS,
      ease: 'power2.out',
      overwrite: true,
    });
  }

  /**
   * @param {number} dt - seconds since last update
   * @returns {{ dYaw: number, dPitch: number }} rotation deltas to apply
   */
  update(dt) {
    if (this.dragging) {
      const d = { dYaw: this.pendingYaw, dPitch: this.pendingPitch };
      this.pendingYaw = 0;
      this.pendingPitch = 0;
      return d;
    }
    return { dYaw: this.vel.yaw * dt, dPitch: this.vel.pitch * dt };
  }

  dispose() {
    gsap.killTweensOf(this.vel);
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.style.cursor = '';
  }
}
