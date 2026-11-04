/**
 * playerGate.js — which Project Directory tiles may play (11-03).
 *
 * The directory holds ~700 tiles, ~250 of them video. A player and an
 * IntersectionObserver per tile, as the detail page has, would start dozens
 * of streams in one scroll. One gate holds ONE observer for every watched
 * tile and at most `cap` play grants:
 *   - a video earns its grant after `dwellMs` at least half in view, so a
 *     fling past it never asks Mux for a master. "Half" is half the tile or
 *     half the viewport, whichever comes first: a tile taller than twice the
 *     viewport is never half in view. The thresholds run every 5% up to half,
 *     so a tile up to ten viewports tall (a portrait in one column on a
 *     phone held sideways) crosses one while it covers half the view;
 *   - grants go first come, first served up to the cap; a tile dropping
 *     under half gives its grant back, and the longest-waiting tile still
 *     half in view takes it;
 *   - `near` (any part in view) is the signal for what isn't a player: a
 *     sequence's clock.
 * The caller passes cap 0 under reduced motion: posters only.
 *
 *   const gate = createPlayerGate({ cap: 6, dwellMs: 300 });
 *   const unwatch = gate.watch(el, { video: true }, ({ near, play }) => …);
 *   gate.destroy();
 *
 * The observer and the timers are injectable for the tests.
 */
/* 0, 0.05 … 0.5: the shares of a tile at which the observer reports. */
const THRESHOLDS = Array.from({ length: 11 }, (_, i) => i / 20);

export function createPlayerGate({
  cap,
  dwellMs,
  Observer = globalThis.IntersectionObserver,
  timers = globalThis,
}) {
  const tiles = new Map();
  const waiting = []; // dwelled and half in view, no grant yet — oldest first
  let held = 0;

  const emit = (t) => {
    if (t.near === t.sent.near && t.play === t.sent.play) return;
    t.sent = { near: t.near, play: t.play };
    t.onChange(t.sent);
  };

  const grant = (t) => {
    t.play = true;
    held += 1;
    emit(t);
  };

  // Out of the running (under half, or unwatched): hand any grant on.
  const release = (t) => {
    if (t.timer) timers.clearTimeout(t.timer);
    t.timer = null;
    const i = waiting.indexOf(t);
    if (i >= 0) waiting.splice(i, 1);
    if (t.play) {
      t.play = false;
      held -= 1;
      emit(t);
    }
    while (held < cap && waiting.length) grant(waiting.shift());
  };

  const dwelled = (t) => {
    t.timer = null;
    if (held < cap) grant(t);
    else waiting.push(t);
  };

  const update = (t, near, half) => {
    t.near = near;
    if (t.video && half !== t.half) {
      t.half = half;
      if (half) t.timer = timers.setTimeout(() => dwelled(t), dwellMs);
      else release(t);
    }
    emit(t);
  };

  const io = new Observer((entries) => {
    for (const e of entries) {
      const t = tiles.get(e.target);
      if (!t) continue;
      const tall = e.rootBounds && e.intersectionRect.height >= e.rootBounds.height / 2;
      update(t, e.isIntersecting, e.isIntersecting && (e.intersectionRatio >= 0.5 || !!tall));
    }
  }, { threshold: THRESHOLDS });

  return {
    /** Watch `el`; `onChange({ near, play })` on every change. Returns the unwatch. */
    watch(el, { video = false } = {}, onChange) {
      const t = { video, onChange, near: false, half: false, play: false, timer: null, sent: { near: false, play: false } };
      tiles.set(el, t);
      io.observe(el);
      return () => {
        if (tiles.get(el) !== t) return;
        tiles.delete(el);
        io.unobserve(el);
        t.onChange = () => {};
        release(t);
      };
    },
    /** Grants out now (the probe's playersCapped reads the DOM instead). */
    get held() {
      return held;
    },
    destroy() {
      io.disconnect();
      for (const t of tiles.values()) if (t.timer) timers.clearTimeout(t.timer);
      tiles.clear();
      waiting.length = 0;
      held = 0;
    },
  };
}
