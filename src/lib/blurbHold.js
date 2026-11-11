/**
 * blurbHold — the phone reading hold for the detail page's blurbs (SQ-26,
 * 11-07, Nathan: "make the project detail blurb descriptions 80% scroll
 * sections that rubber band choreography into view and out as you scroll so
 * that the user gets more of a dedicated moment to read through the
 * description on mobile"; reworked in SQ-27 after he tried it: the stop on a
 * section was abrupt, the way out was a timed glide, and media showed above).
 *
 * The sections are CSS (project-detail.css, ≤768px: each `.project-blurb` is
 * 1 − BLURB_PEEK of the viewport once GROWN, its copy centred; SQ-30: with
 * the hold running a section is its content until it comes into view and
 * grows at its bottom to that height as the page brings it to its seat, see
 * growFrame below). A SEAT is the page
 * position that puts a section's top on the viewport's top, so no media shows
 * above it and BLURB_PEEK of the next media shows below. This is the
 * choreography on top, for a FINGER on a phone (HOLD_MQ):
 *
 *   ARRIVE  native scroll (or this module's own momentum) carries the page
 *           toward the next seat in its direction of travel. When the page is
 *           v/ω from the seat (ω = Lenis's λ at the house lerp, the driven
 *           footer's own damp) the page is taken and slowed into the seat:
 *           a critically damped spring that starts at the page's own speed, so
 *           there is no velocity step, and never passes the seat. A page that
 *           comes to rest short of a seat, with a section covering half the
 *           viewport, is eased onto it from rest.
 *   HOLD    a seated page does not scroll. The gesture is the house rubber
 *           band (lib/rubberBand.js, the next-project band's own step): the
 *           section's copy tracks the finger on DRAG_TRACK_S, the finger's
 *           px gain TOUCH_GAIN, and the lift springs it home.
 *   PASS    past the trigger (BLURB_TRIGGER_PX 300 of gained delta, 60px of
 *           finger, Nathan 11-11; ?blurbscroll) the section commits. From there to the lift the page
 *           follows the finger 1:1 (the browser will not pan inside a touch
 *           that began on a held page, so each move scrolls it here), and the
 *           lift hands it the finger's release velocity as momentum that
 *           decays at iOS's own rate (MOMENTUM_DECAY, 0.998 per ms): no
 *           target, no duration. The copy, which sits offset by the band at
 *           the commit, eases home while the page carries; neither it nor the
 *           media jumps.
 *   BOTH    the same in both directions: the seat ahead is the next one in the
 *           direction of travel, so the section just left is not caught again
 *           until the direction reverses.
 *
 * It rides the page's native scroll (no second engine): Lenis leaves touch
 * alone, so the seat only claims the gesture, `touch-action: pinch-zoom` while
 * seated, plus a non-passive touchmove that exists only while seated or
 * carrying a committed gesture, so ordinary scrolling never waits on the main
 * thread. A finger down is never taken mid-drag, and a new touch takes the
 * page back from a slowdown or from momentum; the lift decides.
 *
 * A section taller than its seat window (holdable()) is seated at its top and
 * read with native scroll, not held.
 *
 * The document's end is the last ARRIVE target, downward only (SQ-28, Nathan:
 * "apply this slow down to the bottom of the detail page"): momentum heading
 * for it is taken v/ω before it by the same velocity-continuous spring and
 * lands exactly on it. It is a stop, not a hold: no seat, no touch-action,
 * no ARM_EVENT; the NextProjectBand owns the gesture there as before. The rest
 * ease never targets it, and a section seat the end clamps to is the end, not
 * a seat. ?blurbend=0 turns it off.
 *
 * Every scroll sample is clamped to [0, docMax] before it is read as movement,
 * so an iOS overscroll bounce (scrollY < 0 settling back up) never flips the
 * direction, and the page's very top is a rest of its own: the rest ease never
 * pulls a page that rests at the top onto the first section (a 16:9 hero leaves
 * the intro more than half the viewport, which is what the bounce used to trip).
 *
 * attachBlurbFit (below) is the text size: CSS sections on every phone, so it
 * is not gated on a finger or on the hold.
 *
 * The blurb's entrance (BlurbCopy's keyword wipe) waits for ARM_EVENT, fired
 * on a section when it seats, when the page rests with it on screen, when the
 * hold attaches with it on screen, and on every section if the hold detaches.
 * The NextProjectBand at the page's end is unaffected: it engages only at the
 * document's end, where no section holds.
 */
import gsap from 'gsap';
import { GLIDE_SECONDS, LENIS_TUNING } from './motion.js';
import { TOUCH_GAIN, RELEASE_MS } from './touchTune.js';
import { createRubberBand } from './rubberBand.js';
import { PREFERS_REDUCED_MOTION } from '../components/work/world/worldConfig.js';
import {
  HOLD_MQ,
  BLURB_PEEK,
  SEAT_TOL_PX,
  SNAP_PX,
  MOMENTUM_DECAY,
  MIN_V,
  REST_COVER,
  BLURB_TEXT,
  seatY,
  grownHeight,
  growHeight,
  entryProgress,
  latchProgress,
  resetSide,
  holdable,
  seatWindow,
  fitTextScale,
  seatAtEnd,
  clampScroll,
  shownPx,
  shownEnough,
  nextSeat,
  catchOmega,
  shouldCatch,
  catchStartV,
  springAt,
  momentumStep,
  emaVelocity,
  readBlurbTune,
  BLURB_TRIGGER_PX,
} from './blurbHoldMath.js';

/** Fired on a section when it may play its entrance (seated, at rest on screen, or the hold is gone). */
export const ARM_EVENT = 'swm:blurb-arm';
/** Fired on a section when a grown one goes back to compact: detail { side: +1 below | -1 above, lost: px the page was moved by, busy: a finger, drive, coast or carry was live }. The probe's seam. */
export const RESET_EVENT = 'swm:blurb-reset';

/* Gestures inside interactive chrome stay native (the process quantizer's list). */
const CHROME_SELECTOR =
  '.site-nav, .mobile-menu, .project-overlay, .privacy-overlay, input, select, textarea';

/** A page that has not scrolled for this long has come to rest (native momentum scrolls every frame). */
const REST_MS = 120;
/** A velocity sample older than this is a different gesture. */
const STALE_MS = 100;

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

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
  const tune = readBlurbTune(window.location.search);
  const trigger = tune.trigger ?? BLURB_TRIGGER_PX;
  const peek = tune.peek ?? BLURB_PEEK;
  const growOn = tune.grow;
  const omega = catchOmega(tune.catchLerp ?? LENIS_TUNING.lerp);
  const decay = tune.decel ?? MOMENTUM_DECAY;
  const endOn = tune.end; // the document's end is an arrival target
  const travel = trigger / TOUCH_GAIN; // the copy follows the finger 1:1; a full pull is the trigger's worth of finger

  let seated = null; // { el, y } — the section holding the page
  let animEl = null; // the section whose copy the fill is moving
  let drive = null; // { seat, e0, v0, t } — the page is being slowed onto a seat
  let coast = null; // { v, y } — this module's own momentum, px/ms and the page position
  let carry = null; // { prev, vel, at, y } — a committed gesture the finger still holds
  let ticking = false;
  let touching = false;
  let finger = null; // last touch y while the hold owns the gesture
  let dir = 1; // the page's direction of travel, +1 = down the document
  let vel = 0; // the page's own scroll velocity, px/ms (EMA over scroll events)
  let frameMs = 16.7;
  let restTimer = 0;
  let moveOn = false;
  let growing = false; // the sections grow as they come into view
  let lastW = window.innerWidth;
  const grow = new Map(); // el -> { p: entry progress latch, px: the min-height written, hc: compact height, side: edge entered from }

  const sections = () => [...root.querySelectorAll(selector)];
  const docMax = () => Math.max(0, html.scrollHeight - window.innerHeight);
  // Where the page is, for movement: an overscroll bounce at either end is not.
  const scrollPos = () => clampScroll(window.scrollY, docMax());
  let lastY = scrollPos();
  let lastT = performance.now();
  const scrollNow = (y) => {
    window.scrollTo({ top: y, behavior: 'instant' });
    lastY = scrollPos(); // our own scroll is never the page's velocity
  };
  const arm = (el) => el.dispatchEvent(new CustomEvent(ARM_EVENT));
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
    onCommit: (d) => commit(d),
    onRest: clearCopy,
  });

  // The seats, as the page positions that put each section's top on the viewport's.
  // A seat the document's end clamps to is flagged `end`: it is the end, not a seat.
  const seats = () => {
    const y = window.scrollY;
    const max = docMax();
    return sections().map((el) => {
      const r = el.getBoundingClientRect();
      const sy = seatY(r.top, y, max);
      return { el, y: sy, top: r.top, h: r.height, end: endOn && seatAtEnd(sy, max) };
    });
  };

  // What an arrival may be taken for: the seats and, going down, the document's end.
  const targets = () => {
    const list = seats();
    if (endOn && dir > 0 && !list.some((s) => s.end)) list.push({ el: null, y: docMax(), top: 0, h: 0, end: true });
    return list;
  };

  // GROW (SQ-30). A section is its content until it comes into view; from its
  // position, every frame, it grows at its bottom to (1 - peek) of the visible
  // viewport, so it follows whatever moves the page (finger, native momentum,
  // the catch spring, this module's coast). Its top, the seat, never moves
  // because of it. Progress only increases within an entry: a section keeps its
  // height leaving either way, and is compact again once it is off screen
  // (resetSide): below at once, above only at rest, with the page moved by what
  // was lost (a programmatic scroll ends iOS's native momentum).
  const busy = () => touching || Boolean(drive || coast || carry);
  const stateOf = (el) => {
    let st = grow.get(el);
    if (!st) grow.set(el, (st = { p: 0, px: 0, hc: 0, side: 1 }));
    return st;
  };
  const setMin = (el, st, px) => {
    st.px = px;
    el.style.minHeight = px ? `${px.toFixed(2)}px` : '';
  };
  const reportReset = (el, side, lost) =>
    el.dispatchEvent(new CustomEvent(RESET_EVENT, { detail: { side, lost, busy: busy() } }));

  // One frame: reads every section's rect, then writes only the sections that
  // are entering (one style write each, and none once nothing is). Called after
  // whatever moved the page, never before it, so no read follows the write.
  // A section entering at the page's very end pushes the end away as it grows:
  // a scroll that arrives there (a swipe) ends exactly on it, a jump (scrollTo)
  // lands a few px short of the grown end, and the next drag finishes the gap.
  function growFrame() {
    if (!growing) return;
    const vh = window.innerHeight;
    const list = sections();
    const rects = list.map((el) => el.getBoundingClientRect());
    list.forEach((el, i) => {
      const st = stateOf(el);
      const { top, height: h } = rects[i];
      if (st.p === 0) {
        st.hc = h; // compact: its height is its content
        if (top >= vh) st.side = 1;
        else if (top + h <= 0) st.side = -1;
      } else if (resetSide(top, h, vh, false) > 0) {
        st.p = 0;
        setMin(el, st, 0); // fully below: nothing visible moves
        st.side = 1;
        reportReset(el, 1, 0);
        return;
      }
      if (st.p >= 1) return;
      const p = latchProgress(st.p, entryProgress(top, st.hc, vh, st.side));
      if (p === 0) return;
      st.p = p;
      const px = Math.max(st.px, growHeight(st.hc, grownHeight(st.hc, vh, peek), p));
      if (px - st.px >= 0.05) setMin(el, st, px);
    });
  }

  // The start: each section by where it is. At or above the viewport top it is
  // grown as it stands (nothing moves; the rest reset takes it from there), below
  // it by its progress; a top section at scrollY 0 is grown, with no animation.
  function initGrow() {
    for (const el of sections()) el.style.minHeight = '';
    grow.clear();
    root.removeAttribute('data-blurb-grow');
    const vh = window.innerHeight;
    const list = sections();
    const before = list.map((el) => el.getBoundingClientRect());
    list.forEach((el, i) => {
      if (before[i].top > SEAT_TOL_PX) return;
      const st = stateOf(el);
      st.p = 1;
      st.side = -1;
      setMin(el, st, before[i].height);
    });
    root.setAttribute('data-blurb-grow', '');
    list.forEach((el) => {
      const st = stateOf(el);
      if (st.p >= 1) return;
      const { top, height } = el.getBoundingClientRect(); // read in order: an entering section pushes the next one down
      st.hc = height;
      const p = entryProgress(top, height, vh, 1);
      if (p === 0) return;
      st.p = p;
      setMin(el, st, growHeight(height, grownHeight(height, vh, peek), p));
    });
    growing = true;
  }

  // Fully above the viewport and the page at rest: back to compact, the page
  // moved by exactly the height lost, in this task (it never paints between).
  function resetAbove() {
    if (!growing) return;
    const vh = window.innerHeight;
    const hit = [];
    for (const el of sections()) {
      const st = stateOf(el);
      if (st.px === 0) continue;
      const { top, height } = el.getBoundingClientRect();
      if (resetSide(top, height, vh, true) < 0) hit.push([el, st, height]);
    }
    if (!hit.length) return;
    for (const [el, st] of hit) {
      st.p = 0;
      setMin(el, st, 0);
      st.side = -1;
    }
    let lost = 0;
    for (const [el, , h0] of hit) lost += h0 - el.getBoundingClientRect().height;
    if (lost) {
      scrollNow(window.scrollY - lost);
      if (seated) {
        const r = seated.el.getBoundingClientRect();
        seated.y = seatY(r.top, window.scrollY, docMax());
      }
    }
    for (const [el] of hit) reportReset(el, -1, lost);
  }

  // The non-passive touchmove lives only while it has work: a seat to hold,
  // or a committed gesture the finger still carries.
  const syncMove = () => {
    const want = Boolean(seated) || Boolean(carry);
    if (want && !moveOn) window.addEventListener('touchmove', onTouchMove, { passive: false });
    else if (!want && moveOn) window.removeEventListener('touchmove', onTouchMove);
    moveOn = want;
  };

  const syncTick = () => {
    const want = Boolean(drive || coast);
    if (want && !ticking) gsap.ticker.add(tick);
    else if (!want && ticking) gsap.ticker.remove(tick);
    ticking = want;
  };
  const stopMotion = () => {
    drive = null;
    coast = null;
    syncTick();
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
    arm(el);
  }

  function leave({ springHome = true } = {}) {
    if (!seated) return;
    delete seated.el.dataset.blurbSeated;
    seated = null;
    finger = null;
    html.style.touchAction = '';
    if (springHome) band.release(); // the copy comes home
    syncMove();
  }

  // ARRIVE. Slow the page onto a seat from `y` at `v` px/ms toward it (0 = at rest).
  function startDrive(seat, y, v) {
    const d = seat.y - y;
    coast = null;
    drive = {
      seat,
      e0: -d,
      v0: Math.sign(d) * catchStartV(Math.abs(d), v, omega),
      t: 0,
    };
    syncTick();
  }

  function finishDrive() {
    const { seat } = drive;
    drive = null;
    syncTick();
    scrollNow(seat.end ? Math.min(seat.y, docMax()) : seat.y);
    vel = 0;
    if (seat.end) {
      armShown(); // a stop, not a hold: the next-project band owns the gesture from here
      return;
    }
    if (holdable(seat.h, window.innerHeight, peek)) enter(seat.el, seat.y);
    else arm(seat.el); // too tall to hold: seated at its top, read with native scroll
  }

  // Is there a seat (or, going down, the end) ahead that the page, moving `speed`
  // px/ms in `dir` (negative when it has just turned back), should be taken for now?
  function tryCatch(y, speed, frame) {
    const list = targets();
    const i = nextSeat(
      list.map((s) => s.y),
      y,
      dir
    );
    if (i < 0) return;
    if (shouldCatch(Math.abs(list[i].y - y), speed, omega, frame)) startDrive(list[i], y, speed);
  }

  // One frame of whatever this module is moving, then the growth that follows it.
  function tick(_time, deltaMs) {
    stepMotion(deltaMs);
    growFrame();
  }

  function stepMotion(deltaMs) {
    const dt = Math.min(deltaMs, 50);
    if (drive) {
      drive.t += dt;
      const s = springAt(drive.e0, drive.v0, omega, drive.t);
      if (Math.abs(s.e) <= SNAP_PX) finishDrive();
      else scrollNow(drive.seat.y + s.e);
      return;
    }
    if (!coast) return;
    const step = momentumStep(coast.v, dt, decay);
    const want = coast.y + step.dy; // kept in float: a browser rounds scrollY to its pixels
    coast.y = clamp(want, 0, docMax());
    coast.v = step.v;
    scrollNow(coast.y);
    if (Math.abs(coast.v) < MIN_V || coast.y !== want) {
      coast = null;
      syncTick();
      armRest();
      return;
    }
    tryCatch(coast.y, Math.abs(coast.v), dt);
  }

  // REST. The page has stopped moving: every section on screen may play, and
  // one that covers half the viewport with its seat still ahead is eased onto it.
  function armShown() {
    const vh = window.innerHeight;
    for (const s of seats()) if (shownEnough(s.top, s.h, vh)) arm(s.el);
  }
  const armRest = () => {
    clearTimeout(restTimer);
    restTimer = setTimeout(restCheck, REST_MS);
  };
  function restCheck() {
    restTimer = 0;
    if (touching || drive || coast || carry) return;
    resetAbove();
    armShown();
    if (seated) return;
    const y = scrollPos();
    if (y <= SEAT_TOL_PX) return; // the page's very top is a rest of its own, never eased off (a top bounce settles here)
    const vh = window.innerHeight;
    const list = seats().filter((s) => !s.end); // the rest ease never targets the end
    const i = nextSeat(
      list.map((s) => s.y),
      y,
      dir
    );
    if (i < 0) return;
    const s = list[i];
    // Bounded by the cover, so resting inside a tall section never pulls the page back to its top.
    if (Math.abs(s.y - y) <= (1 - REST_COVER) * vh && shownPx(s.top, s.h, vh) >= REST_COVER * vh) {
      startDrive(s, y, 0);
    }
  }

  // PASS. The band reached the trigger mid-gesture.
  function commit(d) {
    if (!seated) return;
    dir = d;
    carry = { prev: null, vel: 0, at: 0, y: scrollPos() }; // onTouchMove fills the rest from this very move
    band.reset();
    leave({ springHome: false }); // the release lane would pull the copy home at once: a jump
    // The copy eases home while the page carries on from where the finger is.
    gsap.to(band.proxy, {
      f: 0,
      duration: GLIDE_SECONDS,
      ease: 'power2.out',
      overwrite: true, // the drag lane's last tween ends here, so the ease starts from where the copy is
      onUpdate: draw,
      onComplete: clearCopy,
    });
  }

  function onScroll() {
    handleScroll();
    // What this module moves it grows in the same frame (tick, the carry): a second write here would be a second layout.
    if (!drive && !coast && !carry) growFrame();
  }

  function handleScroll() {
    const now = performance.now();
    const y = scrollPos();
    if (drive || coast || carry) {
      lastY = y; // ours
      lastT = now;
      return;
    }
    const dy = y - lastY;
    const dt = now - lastT;
    lastY = y;
    lastT = now;
    if (seated) {
      if (seated.el.isConnected && Math.abs(y - seated.y) <= SEAT_TOL_PX) return;
      leave(); // something else moved the page off the seat
    }
    if (!dy) return;
    dir = Math.sign(dy);
    if (dt > STALE_MS) {
      vel = 0;
    } else {
      frameMs = clamp(dt, 8, 34);
      vel = emaVelocity(vel, dy / Math.max(dt, 4));
    }
    armRest();
    if (touching) return; // a finger down cannot be taken mid-drag: the lift decides
    tryCatch(y, vel * dir, frameMs);
  }

  function onTouchStart(e) {
    touching = true;
    finger = null;
    if (e.touches.length > 1) return; // a pinch stays the browser's
    if (drive || coast) {
      // The finger takes the page back from a slowdown or from momentum.
      stopMotion();
      lastY = scrollPos();
      vel = 0;
    }
    if (seated && !chromeOwns(e)) finger = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (e.touches.length > 1) return;
    if (e.cancelable) e.preventDefault();
    const y = e.touches[0].clientY;
    if (carry) {
      // The committed gesture: the page follows the finger 1:1.
      const now = performance.now();
      if (carry.prev !== null) {
        const dy = carry.prev - y; // finger up = onward
        carry.y = clamp(carry.y + dy, 0, docMax()); // float: a browser rounds scrollY to its pixels
        scrollNow(carry.y);
        carry.vel = emaVelocity(carry.vel, dy / Math.max(now - carry.at, 8));
        growFrame();
      }
      carry.prev = y;
      carry.at = now;
      return;
    }
    if (!seated || finger === null) return;
    const committed = band.push((finger - y) * TOUCH_GAIN); // finger up = onward, as the next-project band reads it
    finger = y;
    if (committed && carry) {
      carry.prev = y;
      carry.at = performance.now();
    }
  }

  function onTouchEnd(e) {
    if (e.touches && e.touches.length) return;
    touching = false;
    finger = null;
    if (carry) {
      // The finger's release velocity, zeroed if it had stalled, becomes momentum.
      const v = performance.now() - carry.at > RELEASE_MS ? 0 : carry.vel;
      const y = carry.y;
      carry = null;
      syncMove();
      if (Math.abs(v) >= MIN_V) {
        dir = Math.sign(v);
        coast = { v, y };
        syncTick();
      } else {
        armRest();
      }
      return;
    }
    if (seated) band.lift();
    armRest(); // native momentum keeps pushing this back until it stops
    syncMove();
  }

  function onResize() {
    if (window.innerWidth !== lastW) {
      lastW = window.innerWidth; // a new width reflows every section: start over from where each is
      if (growOn && !busy()) initGrow();
    }
    if (!seated || drive || coast) return;
    const r = seated.el.getBoundingClientRect();
    const y = seatY(r.top, window.scrollY, docMax());
    seated.y = y;
    scrollNow(y);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd);
  window.addEventListener('touchcancel', onTouchEnd);
  window.addEventListener('resize', onResize);
  if (growOn) {
    html.style.overflowAnchor = 'none'; // the growth is ours: the browser must not counter-scroll it
    initGrow();
    resetAbove(); // a page that opens scrolled: the sections above it start compact like the rest, the page moved by what that costs
  }
  armShown(); // a restored scroll or a deep link opens with a section already on screen

  return function detach() {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);
    window.removeEventListener('resize', onResize);
    clearTimeout(restTimer);
    if (growing) {
      growing = false;
      root.removeAttribute('data-blurb-grow');
      html.style.overflowAnchor = '';
      for (const el of sections()) el.style.minHeight = '';
      grow.clear();
    }
    carry = null;
    syncMove();
    stopMotion();
    leave();
    band.dispose();
    clearCopy();
    // No hold, no seat to wait for: every blurb may play.
    for (const el of sections()) arm(el);
  };
}

/**
 * The detail blurbs' text size (SQ-28, Nathan: "increase the size of the
 * description text on mobile … extra real estate with the extra vh"). One
 * scale per page, written to `--blurb-text` on the page (project-detail.css
 * reads it on `.project-blurb__text`, ≤768px): the target (BLURB_TEXT,
 * ?blurbtext) or the largest scale under it at which EVERY blurb still fits
 * its seat window, measured against the SMALL viewport (a 100svh probe, so
 * the hold works in either iOS toolbar state) with the section's min-height
 * disregarded (`data-blurb-fit` lifts it for the measurement, which lands in
 * the same task as the write, so it never paints). Floor 1: a blurb too long
 * even then is read natively, as before. Re-fit when the width or the small
 * viewport changes and when the fonts land; not gated on a finger or on the
 * hold, since the sections are CSS on every phone.
 *
 * @param {Element} root  the page (`.project-detail`)
 * @returns {() => void} detach
 */
export function attachBlurbFit(root, { selector = '.project-blurb' } = {}) {
  const tune = readBlurbTune(window.location.search);
  const peek = tune.peek ?? BLURB_PEEK;
  const target = tune.text ?? BLURB_TEXT;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
  document.body.appendChild(probe);
  let key = '';
  let live = true;

  const tallest = (s) => {
    root.style.setProperty('--blurb-text', String(s));
    let h = 0;
    for (const el of root.querySelectorAll(selector)) h = Math.max(h, el.getBoundingClientRect().height);
    return h;
  };
  const fit = () => {
    const svh = probe.offsetHeight || window.innerHeight;
    const k = `${window.innerWidth}x${svh}`;
    if (k === key) return; // an iOS toolbar moving changes innerHeight, not this
    key = k;
    root.setAttribute('data-blurb-fit', '');
    const s = fitTextScale(tallest, seatWindow(svh, peek), target);
    root.removeAttribute('data-blurb-fit');
    root.style.setProperty('--blurb-text', String(+s.toFixed(3)));
  };
  const refit = () => {
    if (!live) return; // fonts.ready may land after detach
    key = '';
    fit();
  };

  fit();
  document.fonts?.ready.then(refit);
  document.fonts?.addEventListener?.('loadingdone', refit);
  window.addEventListener('resize', fit);

  return function detach() {
    window.removeEventListener('resize', fit);
    document.fonts?.removeEventListener?.('loadingdone', refit);
    live = false;
    probe.remove();
    root.removeAttribute('data-blurb-fit');
    root.style.removeProperty('--blurb-text');
  };
}
