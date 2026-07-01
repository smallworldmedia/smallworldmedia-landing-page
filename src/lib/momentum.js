/**
 * momentum — 1D phase/velocity engine for composite elements (ADR-0003).
 *
 * One phase scalar, one velocity. Every input — idle drift, pointer drag,
 * flick release, external kick (scroll coupling) — writes to the same
 * velocity, so motions blend instead of fighting
 * (docs/orbit-deck-viewer-spec.md § Momentum engine).
 *
 * Pure math: no DOM, no clocks. The host owns the rAF loop (and pauses it
 * offscreen / when the document is hidden), feeds `step(dt)`, and passes
 * timestamps into the drag methods. Renderer-agnostic by design — the same
 * engine drives the CSS-3D detail components today and the World's WebGL
 * consumers later.
 *
 * Curve family — exponential decay throughout (the house curve: steep
 * launch, smooth decel, never an overshoot):
 *
 *   wrap  (ring angle, orbit): unbounded phase. Flick velocity decays
 *         exponentially back to `idleRate`; `seek()` suspends idle and
 *         exponentially arrives at a target (spin-cover-to-front), then
 *         idle resumes.
 *
 *   snap  (pager): phase clamped to [min, max], settles on integers.
 *         On release/kick the landing point is projected (∫v·e^(-t/τ) =
 *         v·τ), rounded to the nearest in-range page, and the velocity is
 *         retargeted so the same exponential glide lands exactly there —
 *         the classic scroll-view trick. Phase approaches the target
 *         monotonically: no overshoot by construction.
 *
 * Reduced motion is the consumer's policy: pass idleRate 0, skip kicks,
 * use a small seekTau for the "quick tween" feel. Drag and snap keep
 * working — the engine doesn't know about media queries.
 */

const DRAG_WINDOW_MS = 100; // velocity estimate looks back this far

/**
 * @param {Object} opts
 * @param {'wrap'|'snap'} opts.mode
 * @param {number} [opts.min=0]        - snap: lowest page index
 * @param {number} [opts.max=0]        - snap: highest page index
 * @param {number} [opts.idleRate=0]   - wrap: baseline drift, phase units/s
 * @param {number} [opts.flickTau=0.6] - s, decay of flick surplus
 * @param {number} [opts.seekTau=0.35] - s, arrival curve for seek/snap
 * @param {number} [opts.phase=0]      - starting phase
 * @param {number} [opts.restEpsilon=0.001]
 */
export function createMomentum({
  mode,
  min = 0,
  max = 0,
  idleRate = 0,
  flickTau = 0.6,
  seekTau = 0.35,
  phase = 0,
  restEpsilon = 0.001,
} = {}) {
  let v = mode === 'wrap' ? idleRate : 0;
  let target = null; // non-null → seeking (exp arrival)
  let activeTau = seekTau; // arrival curve of the current seek
  let dragging = false;
  let samples = []; // [{t, phase}] while dragging

  const clamp = (x) => (mode === 'snap' ? Math.max(min, Math.min(max, x)) : x);

  /**
   * Enter a seek: exponential arrival at `t` with time constant `tau`.
   * Initial velocity ≈ (target − phase)/tau, so a flick landing seeked
   * with `flickTau` launches at ≈ the sampled finger velocity — release
   * feels continuous while the landing stays exact.
   */
  function seekTo(t, tau) {
    target = clamp(t);
    activeTau = tau;
    v = (target - phase) / tau;
  }

  /** Project the landing point of a free glide, pick the page, retarget. */
  function settleSnap() {
    const landing = phase + v * flickTau;
    seekTo(Math.round(landing), flickTau);
  }

  return {
    get phase() {
      return phase;
    },
    get velocity() {
      return v;
    },
    get mode() {
      return mode;
    },
    get target() {
      return target;
    },

    setPhase(p) {
      phase = clamp(p);
      target = null;
      v = mode === 'wrap' ? idleRate : 0;
    },

    /** Advance the simulation. Returns the new phase. */
    step(dt) {
      if (dragging || dt <= 0) return phase;

      if (target != null) {
        // Exponential arrival — monotone, asymptotic, no overshoot.
        const remaining = target - phase;
        const move = remaining * (1 - Math.exp(-dt / activeTau));
        phase += move;
        v = move / dt;
        if (Math.abs(target - phase) < restEpsilon) {
          // Decel into rest. In wrap mode the free branch then re-blends
          // v → idleRate over ~flickTau, so the drift breathes back in
          // instead of yanking the arrived cover straight off front.
          phase = target;
          target = null;
          v = 0;
        }
        return phase;
      }

      if (mode === 'wrap') {
        // Flick surplus decays back onto the idle drift.
        v = idleRate + (v - idleRate) * Math.exp(-dt / flickTau);
        phase += v * dt;
      } else if (Math.abs(v) >= restEpsilon) {
        // snap never free-glides: stray velocity settles onto a page.
        settleSnap();
      } else {
        v = 0;
      }
      return phase;
    },

    /** Additive velocity impulse (scroll-kick). Snap retargets from it. */
    kick(impulse) {
      if (dragging) return;
      if (target != null) return; // never derail an active seek/landing
      v += impulse;
      if (mode === 'snap') settleSnap();
    },

    /** Seek a phase through the velocity system (spin-to-front, tabs). */
    goTo(t, tau = seekTau) {
      if (dragging) return;
      seekTo(t, tau);
    },

    /** Pointer down: freeze physics, start velocity sampling. */
    beginDrag(nowMs) {
      dragging = true;
      target = null;
      v = 0;
      samples = [{ t: nowMs, phase }];
    },

    /** Pointer move: direct phase scrub. `delta` in phase units. */
    dragBy(delta, nowMs) {
      if (!dragging) return;
      phase = clamp(phase + delta);
      samples.push({ t: nowMs, phase });
      const cutoff = nowMs - DRAG_WINDOW_MS;
      while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
    },

    /** Pointer up: transfer sampled velocity (flick). */
    endDrag(nowMs) {
      if (!dragging) return;
      dragging = false;
      // Only the trailing window counts — a finger held still before
      // release must read as v≈0, not as the whole gesture's average.
      const cutoff = nowMs - DRAG_WINDOW_MS;
      const recent = samples.filter((s) => s.t >= cutoff);
      const first = recent[0];
      const dtS = first ? (nowMs - first.t) / 1000 : 0;
      v = dtS > 0.016 ? (phase - first.phase) / dtS : 0;
      samples = [];
      if (mode === 'snap') settleSnap();
      // wrap: v decays back to idleRate via step()
    },

    /** True when the host may pause its rAF loop. */
    isResting() {
      if (dragging || target != null) return false;
      if (mode === 'wrap') return idleRate === 0 && Math.abs(v) < restEpsilon;
      return Math.abs(v) < restEpsilon;
    },
  };
}
