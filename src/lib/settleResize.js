/**
 * settleResize.js — trailing-edge debounce for resize-style event storms.
 *
 * The site's resize doctrine (08-28, Nathan): per-event work stays cheap
 * (renderer size, camera aspect); everything expensive — placement solves,
 * layout re-measures, framing snaps — waits for the gesture to SETTLE.
 * `settleMs` runs fn that long after the LAST call (each new event resets
 * the clock — a burst of resizes keeps deferring), and `maxWaitMs` caps how
 * long a continuous storm can starve it, so an endless drag still lands one
 * update per window.
 */
export function settleDebounce(fn, { settleMs = 250, maxWaitMs = 1200 } = {}) {
  let t = null;
  let deadline = null;
  const fire = () => {
    t = null;
    deadline = null;
    fn();
  };
  const handler = () => {
    const now = performance.now();
    if (deadline == null) deadline = now + maxWaitMs;
    if (t) clearTimeout(t);
    t = setTimeout(fire, Math.max(0, Math.min(settleMs, deadline - now)));
  };
  handler.cancel = () => {
    if (t) clearTimeout(t);
    t = null;
    deadline = null;
  };
  return handler;
}
