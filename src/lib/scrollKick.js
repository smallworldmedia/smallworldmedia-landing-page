/**
 * scrollKick — only a scroll the user made kicks a scroll-coupled set (SQ-77).
 *
 * Lenis' `velocity` is the px its scroll moved this frame. A native scroll
 * event it did not animate (the browser's scroll restoration, the
 * ClientRouter's scroll after a swap, an anchor jump, a `window.scrollTo`,
 * scroll anchoring as media loads) lands as ONE sample equal to the whole
 * jump, and Lenis holds that sample for 400 ms before zeroing it. A wall that
 * adds |velocity| · gear to its drift every frame then races — the lines
 * alternate direction, so it reads as a rewind.
 *
 * The gate: a scroll-intent input (wheel, a touch drag, a scroll key, a press
 * on the scrollbar) latches "user" until the scroll settles; a navigation
 * clears it, and so does Lenis finishing a scroll. Velocity counts only
 * while latched, so a user's wheel or touch scroll moves the walls exactly
 * as before, and a jump nobody made moves them by idle drift alone. A velocity left over from a non-user jump stays
 * out even after the latch (Lenis holds it until its next sample).
 *
 * `reduceScrollIntent` is pure (scripts/test/scroll-kick.test.mjs); the DOM
 * wiring below feeds it.
 */

/** ms after the last intent input during which a 0-velocity frame keeps the latch
 *  (the first frame after a wheel/touch can still read 0). */
export const INTENT_GRACE_MS = 250;

export const initialScrollIntent = () => ({ user: false, at: -Infinity, staleV: 0 });

/**
 * One step of the gate. Events:
 *   { type: 'intent', now }            a scroll-intent input
 *   { type: 'nav' }                     a navigation (swap, popstate, pageshow)
 *   { type: 'settle', now }             Lenis finished a scroll (its own scrollend);
 *                                      ignored within the grace of an input (a new scroll)
 *   { type: 'frame', velocity, now }   a frame's Lenis velocity
 * Returns { state, velocity } — velocity is the part that may kick (0 or the input).
 */
export function reduceScrollIntent(state, ev) {
  if (ev.type === 'intent') return { state: { ...state, user: true, at: ev.now }, velocity: 0 };
  if (ev.type === 'settle' && ev.now - state.at <= INTENT_GRACE_MS) return { state, velocity: 0 };
  if (ev.type === 'nav' || ev.type === 'settle') return { state: { ...state, user: false }, velocity: 0 };
  const v = ev.velocity || 0;
  if (!state.user) return { state: { ...state, staleV: v }, velocity: 0 };
  // Latched: a sample identical to the one held over from before the latch is
  // that jump's leftover, not the user's scroll.
  if (v !== 0 && v === state.staleV) return { state, velocity: 0 };
  const settled = v === 0 && ev.now - state.at > INTENT_GRACE_MS;
  return {
    state: { user: !settled, at: state.at, staleV: 0 },
    velocity: v,
  };
}

const SCROLL_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar',
]);

/** A keydown that scrolls the page (a modifier combo is a shortcut, e.g. Alt+← = back). */
export const isScrollKey = (e) =>
  SCROLL_KEYS.has(e.key) && !e.altKey && !e.metaKey && !e.ctrlKey;

let gate = initialScrollIntent();
// Wired at import, not on the first kick read: a wall starts ticking only as it
// nears the viewport, and the wheel that brought it there must already count.
function wire() {
  if (typeof window === 'undefined') return;
  const now = () => performance.now();
  const intent = () => { gate = reduceScrollIntent(gate, { type: 'intent', now: now() }).state; };
  const nav = () => { gate = reduceScrollIntent(gate, { type: 'nav' }).state; };
  const opts = { capture: true, passive: true };
  window.addEventListener('wheel', intent, opts);
  window.addEventListener('touchmove', intent, opts);
  window.addEventListener('keydown', (e) => { if (isScrollKey(e)) intent(); }, opts);
  // A press in the scrollbar gutter (outside the layout viewport).
  window.addEventListener('pointerdown', (e) => {
    if (e.clientX >= document.documentElement.clientWidth) intent();
  }, opts);
  for (const t of ['astro:before-swap', 'astro:after-swap']) document.addEventListener(t, nav);
  window.addEventListener('popstate', nav);
  window.addEventListener('pageshow', nav);
  // Lenis' own scrollend (not the native one, which fires on its every frame):
  // settles the latch even while no wall is ticking to see velocity reach 0.
  window.addEventListener('scrollend', (e) => {
    if (e.detail?.lenisScrollEnd) gate = reduceScrollIntent(gate, { type: 'settle', now: performance.now() }).state;
  });
}
wire();

/**
 * The part of `lenis.velocity` a user scroll made — the kick source for every
 * scroll-coupled set. Pass `getLenis()`; null (no Lenis) → 0. Several walls may call it
 * in one frame: a repeated step with the same velocity returns the same answer.
 */
export function userScrollVelocity(lenis) {
  if (!lenis) return 0;
  const r = reduceScrollIntent(gate, { type: 'frame', velocity: lenis.velocity, now: performance.now() });
  gate = r.state;
  return r.velocity;
}
