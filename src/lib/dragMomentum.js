/**
 * dragMomentum — THE drag + momentum choreography (09-08, Nathan: one place).
 *
 * Born as the home globe's InteractionController; the logo ticker rides the
 * same engine now. Change a number in DRAG_CHOREO and every surface follows.
 *
 * The model (byte-for-byte the globe's, 08-xx):
 *   · while dragging, pointer deltas pass through 1:1 (× sensitivity) —
 *     accumulated between frames and DRAINED by update(), so the drag is
 *     exact at any frame rate;
 *   · an EMA of the instantaneous velocity (retain 0.7 per move event,
 *     dt floored) is the release flick speed, clamped per axis;
 *   · on release the velocity GSAP-tweens back to the AMBIENT rest velocity
 *     over inertiaSeconds on power2.out (smooth family, no overshoot) —
 *     nothing ever stops dead;
 *   · reduced motion: no flick — release snaps the velocity to the ambient.
 *
 * Hosts own the integrated position (angles, px) and any clamp/wrap.
 */
import gsap from 'gsap';

export const DRAG_CHOREO = Object.freeze({
  /** globe: rad per px of pointer travel. A px surface passes 1. */
  sensitivity: 0.001,
  /** release-speed cap, in units/s (globe: 1 rad/s ≡ 1000 px/s at 0.001) */
  maxSpeed: 1,
  /** the settle from flick to ambient */
  inertiaSeconds: 0.35,
  ease: 'power2.out',
  /** EMA retain per pointermove (0.7 old + 0.3 new) */
  emaRetain: 0.7,
  /** dt floor for the velocity sample */
  dtFloorS: 1e-4,
});

/** The globe's flick cap expressed for a px surface (units cancel). */
export const PX_MAX_SPEED = DRAG_CHOREO.maxSpeed / DRAG_CHOREO.sensitivity;

export default class DragMomentum {
  /**
   * @param {HTMLElement} el          pointer surface (gets grab/grabbing cursor)
   * @param {object}  o
   * @param {{x:number,y:number}} o.ambient  rest velocity (units/s)
   * @param {number}  o.sensitivity  units per px (default DRAG_CHOREO)
   * @param {number}  o.maxSpeed     per-axis release cap (units/s)
   * @param {boolean} o.reducedMotion
   * @param {boolean} o.cursor       manage grab/grabbing (default true)
   */
  constructor(el, o = {}) {
    this.el = el;
    this.sens = o.sensitivity ?? DRAG_CHOREO.sensitivity;
    this.max = o.maxSpeed ?? DRAG_CHOREO.maxSpeed;
    this.rm = !!o.reducedMotion;
    this.cursor = o.cursor ?? true;
    this.ambient = { x: o.ambient?.x ?? 0, y: o.ambient?.y ?? 0 };
    this.dragging = false;
    this.vel = { x: this.ambient.x, y: this.ambient.y };
    this.pendX = 0;
    this.pendY = 0;
    this.instX = 0;
    this.instY = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.lastT = 0;

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);

    if (this.cursor) el.style.cursor = 'grab';
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    // A swallowed pointerup (context menu, capture loss, app switch) must
    // not strand dragging=true. onUp is idempotent, so the extras are free.
    el.addEventListener('lostpointercapture', this.onUp);
    window.addEventListener('blur', this.onUp);
  }

  /** Retarget the rest velocity (a dial, a tier change); tweens follow. */
  setAmbient(x, y = 0) {
    this.ambient.x = x;
    this.ambient.y = y;
    if (!this.dragging && !gsap.isTweening(this.vel)) {
      this.vel.x = x;
      this.vel.y = y;
    }
  }

  onDown(e) {
    if (e.button !== 0) return; // right/middle click — the context menu eats the up
    this.el.setPointerCapture(e.pointerId);
    gsap.killTweensOf(this.vel);
    this.dragging = true;
    this.instX = 0;
    this.instY = 0;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = performance.now();
    if (this.cursor) this.el.style.cursor = 'grabbing';
  }

  onMove(e) {
    if (!this.dragging) return;
    const now = performance.now();
    const dt = Math.max((now - this.lastT) / 1000, DRAG_CHOREO.dtFloorS);
    const dx = (e.clientX - this.lastX) * this.sens;
    const dy = (e.clientY - this.lastY) * this.sens;
    this.pendX += dx;
    this.pendY += dy;
    // Exponentially smoothed instantaneous velocity → release flick speed
    const r = DRAG_CHOREO.emaRetain;
    this.instX = this.instX * r + (dx / dt) * (1 - r);
    this.instY = this.instY * r + (dy / dt) * (1 - r);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastT = now;
  }

  onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.cursor) this.el.style.cursor = 'grab';
    if (this.rm) {
      this.vel.x = this.ambient.x;
      this.vel.y = this.ambient.y;
      return;
    }
    const clamp = (v) => Math.max(-this.max, Math.min(this.max, v));
    this.vel.x = clamp(this.instX);
    this.vel.y = clamp(this.instY);
    // Settle back to the ambient rest velocity.
    gsap.to(this.vel, {
      x: this.ambient.x,
      y: this.ambient.y,
      duration: DRAG_CHOREO.inertiaSeconds,
      ease: DRAG_CHOREO.ease,
      overwrite: true,
    });
  }

  /**
   * @param {number} dt seconds since last update
   * @returns {{dx:number, dy:number}} position deltas to apply this frame
   */
  update(dt) {
    if (this.dragging) {
      const d = { dx: this.pendX, dy: this.pendY };
      this.pendX = 0;
      this.pendY = 0;
      return d;
    }
    return { dx: this.vel.x * dt, dy: this.vel.y * dt };
  }

  dispose() {
    gsap.killTweensOf(this.vel);
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    this.el.removeEventListener('lostpointercapture', this.onUp);
    window.removeEventListener('blur', this.onUp);
    if (this.cursor) this.el.style.cursor = '';
  }
}
