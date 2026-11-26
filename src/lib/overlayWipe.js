/**
 * overlayWipe — THE overlay wipe (09-08, Nathan: one choreography for every
 * wipe-in overlay — the project inquiry, the mobile menu, the privacy page).
 *
 * In: the surface wipes UP from the bottom edge on the house Turn curve
 * (TURN_EASE_PATH). Out: the INVERSE wipe — erased back down to the bottom
 * edge, never a fade. autoAlpha brackets the wipe so `visibility` keeps
 * gating pointer events while closed (clip-path alone does not).
 *
 * CustomEase names are global — register the curve once, here.
 */
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from '../components/work/world/worldConfig.js';

export const OVERLAY_WIPE_EASE = 'overlayWipe';
export const ensureOverlayWipe = () => {
  if (!CustomEase.get(OVERLAY_WIPE_EASE)) CustomEase.create(OVERLAY_WIPE_EASE, TURN_EASE_PATH);
  return OVERLAY_WIPE_EASE;
};

export const CLIP_OPEN = 'inset(0% 0 0 0)';
export const CLIP_CLOSED = 'inset(100% 0 0 0)'; // hidden at the bottom edge — opens upward
// The flipped edge (11-03, /work's [PREVIOUS]): the BOTTOM edge travels up to
// the top — for chrome that leaves toward the top of the screen.
export const CLIP_OPEN_UP = 'inset(0 0 0% 0)';
export const CLIP_CLOSED_UP = 'inset(0 0 100% 0)';

export const WIPE_IN_S = 0.45;
export const WIPE_OUT_S = 0.35;

/** Append the wipe-in to `tl` (creates one if absent). Returns the timeline.
 *  `closed`/`open` pick the edge (CLIP_CLOSED_UP → CLIP_OPEN_UP: the inverse
 *  of wipeOut's up-edge exit); `closed: null` runs from the current clip — a
 *  re-entry caught mid-wipe-out reverses from where it is. */
export function wipeIn(el, tl = gsap.timeline(), duration = WIPE_IN_S, closed = CLIP_CLOSED, open = CLIP_OPEN) {
  if (PREFERS_REDUCED_MOTION) {
    const to = { autoAlpha: 1, duration: 0.35, ease: 'power2.out', overwrite: true };
    if (closed) tl.fromTo(el, { autoAlpha: 0 }, to);
    else tl.to(el, to);
    return tl;
  }
  tl.set(el, closed ? { autoAlpha: 1, clipPath: closed, overwrite: true } : { autoAlpha: 1, overwrite: true });
  tl.to(el, { clipPath: open, duration, ease: ensureOverlayWipe() });
  return tl;
}

/** The inverse wipe out; autoAlpha drops once it lands. Returns the timeline.
 *  `closed` picks the edge (CLIP_CLOSED_UP from a CLIP_OPEN_UP start). */
export function wipeOut(el, duration = WIPE_OUT_S, closed = CLIP_CLOSED) {
  if (PREFERS_REDUCED_MOTION) {
    return gsap.timeline().to(el, { autoAlpha: 0, duration: 0.3, ease: 'power2.inOut', overwrite: true });
  }
  return gsap
    .timeline()
    .to(el, { clipPath: closed, duration, ease: ensureOverlayWipe(), overwrite: true })
    .set(el, { autoAlpha: 0 });
}

// ── The nav-menu hold (SQ-108, Nathan 11-16): the menu's wipe never uncovers a
// page that is still loading. A menu tap swaps the route behind the open
// takeover; the wipe-out used to start on `astro:after-swap`, uncovering an
// island that had not hydrated, let alone drawn. Now the swap only STARTS a
// hold, and the wipe plays — unchanged — once the destination has drawn its
// first frame (`swm:route-ready`, one dispatch per route island) or the cap
// runs out. One rule for every menu destination; a navigation made with the
// menu closed never reaches it.

export const ROUTE_READY_EVENT = 'swm:route-ready';
/** The hold's dials, PROPOSED (Nathan dials them): the cap on the wait, and
 *  the beat held after the ready signal so its frame is on screen first. */
export const NAV_HOLD_MAX_MS = 600;
export const NAV_HOLD_MIN_MS = 100;

/** `?navwipehold=MAX[,MIN]` in ms. MAX caps the wait after the swap (0 turns the
 *  hold off); MIN is the extra beat after the ready signal, held to the cap. */
export function parseNavHold(search = '') {
  const raw = new URLSearchParams(search).get('navwipehold');
  const [max, min] = raw == null ? [] : raw.split(',').map(parseFloat);
  const dial = (n, fallback) => (Number.isFinite(n) && n >= 0 ? n : fallback);
  const maxMs = dial(max, NAV_HOLD_MAX_MS);
  return { maxMs, minMs: Math.min(dial(min, NAV_HOLD_MIN_MS), maxMs) };
}
// Module-load class (docs/tunables-guide.md): put it on the URL you hard-load.
const NAV_HOLD = parseNavHold(typeof window === 'undefined' ? '' : window.location.search);

/** `?navwipeout=<ms>`: the MENU's wipe back down (Nathan 11-20, Phone Checks row 160: "a touch
 *  slower"), in seconds for wipeOut. The menu only; every other overlay keeps WIPE_OUT_S. Junk,
 *  negative or over 2000 falls back to WIPE_OUT_S. PROPOSED until Nathan dials it. */
export function parseNavWipeOut(search = '') {
  const ms = parseFloat(new URLSearchParams(search).get('navwipeout'));
  return Number.isFinite(ms) && ms >= 0 && ms <= 2000 ? ms / 1000 : WIPE_OUT_S;
}
export const NAV_WIPE_OUT_S = parseNavWipeOut(typeof window === 'undefined' ? '' : window.location.search);

/** Routes whose island dispatches `swm:route-ready` itself (home, /work, the
 *  directory, a project page). Any other route is ready at `astro:page-load`. */
export const routeSignalsReady = (pathname) => /^\/(work(\/[^/]+)?)?\/?$/.test(pathname);

/** The island's first meaningful frame is up. Two animation frames after the
 *  call, so the frame the island just committed has been presented — and out
 *  of the island's own gsap context (context inheritance would adopt, then
 *  revert at unmount, the tweens the listener makes). */
export function signalRouteReady(win = window, raf = requestAnimationFrame) {
  raf(() => raf(() => win.dispatchEvent(new CustomEvent(ROUTE_READY_EVENT))));
}

/** Hold `release` until the route behind the swap has drawn: the first
 *  `swm:route-ready` (+ MIN), at the latest MAX after this call. Returns the
 *  cancel. `window.__swmNavHold` keeps the last hold's timings for the bench. */
export function holdForRoute(release, env = {}) {
  const {
    win = window,
    doc = document,
    pathname = win.location.pathname,
    dials = NAV_HOLD,
    now = () => performance.now(),
    // Wrapped: the browser's setTimeout throws "Illegal invocation" as a method of another object.
    timers = { set: (fn, ms) => setTimeout(fn, ms), clear: (id) => clearTimeout(id) },
    raf = requestAnimationFrame,
  } = env;
  const armedAt = now();
  let readyAt = null;
  let done = false;
  let cap = null;
  let afterReady = null;
  const stop = () => {
    done = true;
    win.removeEventListener(ROUTE_READY_EVENT, onReady);
    doc.removeEventListener('astro:page-load', onLoad);
    timers.clear(cap);
    timers.clear(afterReady);
  };
  const fire = (why) => {
    if (done) return;
    stop();
    win.__swmNavHold = { pathname, ...dials, armedAt, readyAt, releasedAt: now(), why };
    release(why);
  };
  const onReady = () => {
    if (done || afterReady != null) return;
    readyAt = now();
    const room = dials.maxMs - (readyAt - armedAt);
    afterReady = timers.set(() => fire('ready'), Math.max(0, Math.min(dials.minMs, room)));
  };
  const onLoad = () => raf(() => raf(onReady)); // a route with no canvas: its first paint
  cap = timers.set(() => fire('cap'), dials.maxMs);
  win.addEventListener(ROUTE_READY_EVENT, onReady);
  if (!routeSignalsReady(pathname)) doc.addEventListener('astro:page-load', onLoad);
  return stop;
}
