/**
 * blurbHold — the phone reading hold for the detail page's blurbs (SQ-26,
 * 11-07, Nathan: "make the project detail blurb descriptions 80% scroll
 * sections that rubber band choreography into view and out as you scroll so
 * that the user gets more of a dedicated moment to read through the
 * description on mobile").
 *
 * The sections are CSS (project-detail.css, ≤768px: each `.project-blurb` is
 * BLURB_SEC of the small viewport, its copy centred). This is the choreography
 * on top, for a FINGER on a phone (HOLD_MQ):
 *
 *   SEAT   native scroll carries a section in; the moment its centre crosses
 *          the viewport's the page settles onto the seat (RELEASE lane) and
 *          the section holds the page there.
 *   HOLD   a seated page does not scroll. The gesture is the house rubber
 *          band (lib/rubberBand.js, the next-project band's own step): the
 *          section's copy tracks the finger on DRAG_TRACK_S, the finger's
 *          px gain TOUCH_GAIN, and the lift springs it home on
 *          RELEASE_GLIDE_S / RELEASE_EASE.
 *   PASS   past the trigger (SCROLL_TRIGGER_WORK_PX of gained delta, 100px of
 *          finger) the section commits: the page glides on to the next
 *          content on the house commit curve (GLIDE_MS, TURN_EASE_PATH).
 *          One gesture that clears the trigger passes straight through.
 *   BOTH   a finger the other way re-seats and holds the same, and commits
 *          back to the previous content.
 *
 * It rides the page's native scroll (no second engine): Lenis leaves touch
 * alone, so the seat only claims the gesture — `touch-action: pinch-zoom`
 * while seated, plus a non-passive touchmove that exists only while seated or
 * finishing a committed gesture, so ordinary scrolling never waits on the
 * main thread. A finger down across a centre does not stop the page (it
 * cannot be taken mid-drag); the lift seats the section it crossed if that
 * section is still on screen.
 *
 * The blurb's entrance (BlurbCopy's keyword wipe) waits for ARM_EVENT, fired
 * on the section when it seats, and on every section if the hold detaches.
 * The NextProjectBand at the page's end is unaffected: it engages only at the
 * document's end, where no section holds.
 */
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import {
  SCROLL_TRIGGER_WORK_PX,
  GLIDE_SECONDS,
  RELEASE_GLIDE_S,
  RELEASE_EASE,
} from './motion.js';
import { TOUCH_GAIN } from './touchTune.js';
import { createRubberBand } from './rubberBand.js';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from '../components/work/world/worldConfig.js';
import {
  HOLD_MQ,
  SEAT_TOL_PX,
  centreOffset,
  seatY,
  commitY,
  crossedCentre,
  readBlurbTune,
} from './blurbHoldMath.js';

gsap.registerPlugin(CustomEase);

/** Fired on a section when it may play its entrance (seated, or the hold is gone). */
export const ARM_EVENT = 'swm:blurb-arm';

/* Gestures inside interactive chrome stay native (the process quantizer's list). */
const CHROME_SELECTOR =
  '.site-nav, .mobile-menu, .project-overlay, .privacy-overlay, input, select, textarea';

/** Will the hold run here? (client only; the server render never asks) */
export function holdWanted() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia(HOLD_MQ).matches &&
    readBlurbTune(window.location.search).hold &&
    !PREFERS_REDUCED_MOTION
  );
}

/**
 * @param {Element} root      the page (`.project-detail`); sections are looked up live
 * @param {Object}  [o]
 * @param {string}  [o.selector]
 * @returns {() => void} detach
 */
export function attachBlurbHold(root, { selector = '.project-blurb' } = {}) {
  const html = document.documentElement;
  const trigger = readBlurbTune(window.location.search).trigger ?? SCROLL_TRIGGER_WORK_PX;
  const travel = trigger / TOUCH_GAIN; // the copy follows the finger 1:1; a full pull is the trigger's worth of finger
  const commitEase = CustomEase.create('swmBlurbCommit', TURN_EASE_PATH);

  let seated = null; // { el, y } — the section holding the page
  let animEl = null; // the section whose copy the fill is moving
  let glide = null; // { tw, owned } — a scroll glide in flight (owned = a touch may not cancel it)
  let touching = false;
  let swallow = false; // a committed gesture's remaining moves stay unscrolled
  let finger = null; // last touch y while the hold owns the gesture
  let pending = null; // a section a finger dragged across
  let lastY = window.scrollY;
  let moveOn = false;

  const sections = () => [...root.querySelectorAll(selector)];
  const docMax = () => Math.max(0, html.scrollHeight - window.innerHeight);
  const scrollNow = (y) => window.scrollTo({ top: y, behavior: 'instant' });
  const clearCopy = () => {
    if (animEl) gsap.set(animEl.children, { clearProps: 'transform' });
  };

  const draw = () => {
    if (animEl) gsap.set(animEl.children, { y: -band.proxy.f * travel, force3D: true });
  };
  const band = createRubberBand({
    trigger,
    signed: true,
    apply: draw,
    onCommit: (dir) => commit(dir),
    onRest: clearCopy,
  });

  const killGlide = () => {
    glide?.tw.kill();
    glide = null;
  };
  const glideTo = (y, seconds, ease, owned, done) => {
    killGlide();
    const p = { v: window.scrollY };
    const g = { owned, tw: null };
    g.tw = gsap.to(p, {
      v: y,
      duration: seconds,
      ease,
      onUpdate: () => scrollNow(p.v),
      onComplete: () => {
        glide = null;
        scrollNow(y);
        lastY = window.scrollY;
        done?.();
      },
    });
    glide = g;
  };

  // The non-passive touchmove lives only while it has work: a seat to hold,
  // or the tail of a gesture that just committed.
  const syncMove = () => {
    const want = Boolean(seated) || swallow;
    if (want && !moveOn) window.addEventListener('touchmove', onTouchMove, { passive: false });
    else if (!want && moveOn) window.removeEventListener('touchmove', onTouchMove);
    moveOn = want;
  };

  const chromeOwns = (e) =>
    html.hasAttribute('data-chrome-open') ||
    document.querySelector('.project-overlay')?.dataset.open === 'true' ||
    (e.target instanceof Element && Boolean(e.target.closest(CHROME_SELECTOR)));

  function enter(el, y) {
    seated = { el, y };
    animEl = el;
    html.style.touchAction = 'pinch-zoom'; // the page itself does not pan while it holds
    el.dataset.blurbSeated = '';
    syncMove();
    el.dispatchEvent(new CustomEvent(ARM_EVENT));
  }

  function leave() {
    if (!seated) return;
    delete seated.el.dataset.blurbSeated;
    seated = null;
    finger = null;
    html.style.touchAction = '';
    band.release(); // the copy comes home (a commit's own tween takes over from this)
    syncMove();
  }

  // Settle onto a section's seat. The settle is the release lane's, and a
  // touch that lands during it joins the hold (the seat is already claimed).
  function seatAt(el) {
    const r = el.getBoundingClientRect();
    const y = seatY(r.top, r.height, window.innerHeight, window.scrollY, docMax());
    enter(el, y);
    glideTo(y, RELEASE_GLIDE_S, RELEASE_EASE, true);
  }

  function commit(dir) {
    const s = seated;
    if (!s) return;
    const r = s.el.getBoundingClientRect();
    const target = commitY(dir, r.top, r.height, window.innerHeight, window.scrollY, docMax());
    swallow = touching; // the rest of this gesture neither scrolls nor counts
    band.reset();
    leave();
    gsap.to(band.proxy, {
      f: 0,
      duration: GLIDE_SECONDS,
      ease: commitEase,
      overwrite: 'auto',
      onUpdate: draw,
      onComplete: clearCopy,
    });
    glideTo(target, GLIDE_SECONDS, commitEase, false);
  }

  function onScroll() {
    const y = window.scrollY;
    const dy = y - lastY;
    lastY = y;
    if (glide) return; // our own glide's scroll
    if (seated) {
      if (seated.el.isConnected && Math.abs(y - seated.y) <= SEAT_TOL_PX) return;
      leave(); // something else moved the page off the seat
    }
    if (!dy) return;
    const vh = window.innerHeight;
    const list = sections();
    if (dy < 0) list.reverse();
    for (const el of list) {
      const r = el.getBoundingClientRect();
      const dCur = centreOffset(r.top, r.height, vh);
      if (crossedCentre(dCur + dy, dCur)) {
        if (touching) pending = el;
        else seatAt(el);
        return;
      }
    }
  }

  function onTouchStart(e) {
    touching = true;
    pending = null;
    finger = null;
    if (e.touches.length > 1) return; // a pinch stays the browser's
    if (glide && !glide.owned) {
      // The finger takes the page back from a commit glide.
      killGlide();
      lastY = window.scrollY;
      band.release();
    }
    if (seated && !chromeOwns(e)) finger = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (e.touches.length > 1) return;
    if (e.cancelable) e.preventDefault();
    if (!seated || finger === null) return;
    const y = e.touches[0].clientY;
    band.push((finger - y) * TOUCH_GAIN); // finger up = onward, as the next-project band reads it
    finger = y;
  }

  function onTouchEnd(e) {
    if (e.touches && e.touches.length) return;
    touching = false;
    swallow = false;
    finger = null;
    if (seated) band.lift();
    if (pending) {
      const el = pending;
      pending = null;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // Only a section still on screen: a drag that carried it away has passed it.
      if (el.isConnected && Math.abs(centreOffset(r.top, r.height, vh)) <= vh / 2) seatAt(el);
    }
    syncMove();
  }

  function onResize() {
    if (!seated || glide) return;
    const r = seated.el.getBoundingClientRect();
    const y = seatY(r.top, r.height, window.innerHeight, window.scrollY, docMax());
    seated.y = y;
    scrollNow(y);
    lastY = window.scrollY;
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);
  window.addEventListener('resize', onResize);

  return function detach() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('resize', onResize);
    swallow = false;
    syncMove();
    killGlide();
    leave();
    band.dispose();
    clearCopy();
    // No hold, no seat to wait for: every blurb may play.
    for (const el of sections()) el.dispatchEvent(new CustomEvent(ARM_EVENT));
  };
}
