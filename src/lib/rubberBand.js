/**
 * rubberBand — the house accumulator + rubber band as ONE step (SQ-26, 11-07).
 *
 * The gesture the detail page runs twice: wheel/touch deltas fill toward a
 * commit threshold, the fill TRACKS the input on DRAG_TRACK_S, an uncommitted
 * gesture SPRINGS HOME on RELEASE_GLIDE_S / RELEASE_EASE, and reaching the
 * threshold hands off to the caller's commit. Its two consumers are the
 * next-project band at the document's end (NextProjectBand, one-sided) and
 * the phone blurb hold (blurbHold.js, both directions); they differ only in
 * what the fill DRAWS (`apply`) and what a commit DOES (`onCommit`).
 *
 * Input stays the caller's: it gates when a delta counts (the band's
 * document-end arming, the hold's seat), scales it (TOUCH_GAIN) and wires the
 * lift. A finger holds the fill until the lift (`lift()`); a wheel has no
 * lift, so its let-go is a stall of RELEASE_MS (`push(dy, { stall: true })`).
 *
 * This module is the home of the physics: a third surface needing a rubber
 * band uses this, it does not copy it.
 */
import gsap from 'gsap';
import { DRAG_TRACK_S, RELEASE_GLIDE_S, RELEASE_EASE } from './motion.js';
import { RELEASE_MS } from './touchTune.js';

/**
 * The accumulator's arithmetic, pure. `signed` keeps both directions (the
 * fill runs −1…1 and a commit carries its sign); unsigned clamps at 0 (the
 * band only ever fills onward). A commit is |accum| reaching the trigger.
 */
export function stepAccum(accum, dy, trigger, signed = false) {
  const a = signed ? accum + dy : Math.max(0, accum + dy);
  const hit = Math.abs(a) >= trigger;
  return {
    accum: a,
    fill: Math.max(-1, Math.min(1, a / trigger)),
    commit: hit ? Math.sign(a) : 0,
  };
}

/**
 * @param {Object}   o
 * @param {Object}   [o.proxy]     the fill scalar `{ f }` the lanes tween (shared when the caller reads it elsewhere)
 * @param {number}   o.trigger     gesture px that commit (SCROLL_TRIGGER_WORK_PX, or the surface's own dial)
 * @param {boolean}  [o.signed]    both directions; the commit carries -1 / +1
 * @param {Function} o.apply       draws the fill (reads proxy.f); runs on every lane frame
 * @param {Function} o.onCommit    (dir) the threshold was reached; the caller owns the passage
 * @param {Function} [o.onRelease] the fill is being sprung home (extra residual work)
 * @param {Function} [o.onRest]    the spring came home
 */
export function createRubberBand({
  proxy = { f: 0 },
  trigger,
  signed = false,
  apply,
  onCommit,
  onRelease,
  onRest,
}) {
  let accum = 0;
  let idle = null;

  const clearIdle = () => {
    clearTimeout(idle);
    idle = null;
  };

  // Springs home; a resumed drag or a commit takes the proxy over mid-return.
  const release = () => {
    clearIdle();
    accum = 0;
    onRelease?.();
    gsap.to(proxy, {
      f: 0,
      duration: RELEASE_GLIDE_S,
      ease: RELEASE_EASE,
      overwrite: 'auto',
      onUpdate: apply,
      onComplete: onRest,
    });
  };

  // Returns the commit direction (±1) when this delta reached the threshold, else 0.
  const push = (dy, { stall = false } = {}) => {
    const s = stepAccum(accum, dy, trigger, signed);
    accum = s.accum;
    if (s.commit) {
      clearIdle();
      onCommit(s.commit);
      return s.commit;
    }
    gsap.to(proxy, {
      f: s.fill,
      duration: DRAG_TRACK_S,
      ease: 'power1.out',
      overwrite: 'auto',
      onUpdate: apply,
    });
    if (stall) {
      clearIdle();
      idle = setTimeout(release, RELEASE_MS);
    }
    return 0;
  };

  return {
    proxy,
    push,
    release,
    clearIdle,
    get accum() {
      return accum;
    },
    // A finger's let-go: nothing to release when nothing was gained.
    lift() {
      if (accum !== 0) release();
    },
    // Forget the gained delta without drawing (a commit, a cancelled gesture).
    reset() {
      clearIdle();
      accum = 0;
    },
    dispose() {
      clearIdle();
      gsap.killTweensOf(proxy);
    },
  };
}
