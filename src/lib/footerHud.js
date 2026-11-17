/**
 * footerHud — ?footerhud=1, a read-only diagnostic for the home footer's finger
 * (SQ-115 pass 2). It answers one question a headless run cannot: when the
 * panel steps visibly on a phone, is it (a) the touchmoves arriving unevenly
 * against the display frames, or (b) the frames themselves being slow?
 *
 * During each drag it counts, and after the finger lifts it FREEZES the numbers
 * until the next drag begins (so a screenshot taken after the swipe still reads):
 *
 *   touchmove/s   events delivered per second of drag. Far from the display
 *                 rate, or bunched (see `stuck`), is (a).
 *   fps           rAF frames per second while the finger was down.
 *   stuck         frames where the panel did NOT move although the finger was
 *                 moving (a touchmove inside the last 100 ms) and the panel was
 *                 off both clamps. Many of these with a healthy fps is (a): the
 *                 frame came and no touchmove had landed. Panel progress is read
 *                 each frame through `getP`, so a frame the follow
 *                 (?footertouchlerp) paints counts as moved.
 *   longest       the longest frame, ms.
 *   >20ms         the share of frames over 20 ms. High means (b): the frames
 *                 are slow, whatever the input cadence.
 *
 * Nothing is written anywhere (no storage, no network, no CSS variable): a
 * fixed <div> the page owns, pointer-events none, removed on teardown. Phone
 * width only: Hero mounts it where IS_MOBILE is true.
 */
export const FOOTER_HUD_ACTIVE =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('footerhud') === '1';

const MOVING_MS = 100; // a touchmove this recent means the finger is moving
const SLOW_MS = 20;
const LIVE_MS = 400; // how often the readout repaints during a drag

/** `getP` reads the panel's painted progress; `rest` is its floor. Returns the
    three drag hooks Hero calls from its touch listeners, and a `destroy`. */
export function createFooterHud(getP, rest) {
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;left:6px;top:6px;z-index:2147483000;pointer-events:none;' +
    'font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre;color:#0f0;' +
    'background:rgba(0,0,0,.72);padding:4px 6px;border-radius:4px;';
  el.textContent = 'footerhud\nswipe the footer';
  document.body.appendChild(el);

  let raf = 0;
  let down = false;
  let t0 = 0; // drag start
  let lastMove = 0; // last touchmove
  let lastFrame = 0;
  let lastP = 0;
  let lastPaint = 0;
  let moves = 0;
  let frames = 0;
  let stuck = 0;
  let longest = 0;
  let slow = 0;

  const paint = (now) => {
    const secs = Math.max((now - t0) / 1000, 1e-3);
    const f = Math.max(frames, 1);
    el.textContent =
      `footerhud ${down ? '● drag' : '○ frozen'}\n` +
      `touchmove/s  ${(moves / secs).toFixed(1)}\n` +
      `fps          ${(frames / secs).toFixed(1)}\n` +
      `stuck frames ${stuck} / ${frames}\n` +
      `longest      ${longest.toFixed(1)} ms\n` +
      `>${SLOW_MS}ms        ${((slow / f) * 100).toFixed(0)}%`;
    lastPaint = now;
  };
  const frame = (now) => {
    if (!down) return;
    raf = requestAnimationFrame(frame);
    const dt = now - lastFrame;
    lastFrame = now;
    const p = getP();
    frames++;
    if (dt > longest) longest = dt;
    if (dt > SLOW_MS) slow++;
    if (now - lastMove < MOVING_MS && p === lastP && p > rest + 1e-6 && p < 1 - 1e-6) stuck++;
    lastP = p;
    if (now - lastPaint > LIVE_MS) paint(now);
  };

  return {
    start() {
      const now = performance.now();
      down = true;
      t0 = lastFrame = lastMove = lastPaint = now;
      lastP = getP();
      moves = frames = stuck = slow = 0;
      longest = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame((t) => {
        lastFrame = t; // the first frame measures from here, not from touchstart
        raf = requestAnimationFrame(frame);
      });
    },
    move() {
      moves++;
      lastMove = performance.now();
    },
    end() {
      if (!down) return;
      down = false;
      cancelAnimationFrame(raf);
      paint(performance.now());
    },
    destroy() {
      down = false;
      cancelAnimationFrame(raf);
      el.remove();
    },
  };
}
