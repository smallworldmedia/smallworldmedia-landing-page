/**
 * charCut — THE house random-letter cut (09-09, Nathan: one place).
 *
 * The idiom the site already speaks in three places — the /work enter
 * commit (textExit.js), the home tagline's departure (SiteTagline.jsx) and
 * the pager's [select_project] release (GraticulePager.jsx): a line's
 * LETTERS are split, SHUFFLED, and hard-cut one every `stepMs` on plain
 * visibility writes. No fades, no scramble — the text arrives (or leaves)
 * as a stutter of characters in random order.
 *
 * Those three sites are EXITS wired into their hosts' restore paths. This
 * module is the shared engine and adds the missing direction: `cutIn`, the
 * ENTRANCE — letters start hidden and land in random order. It supersedes
 * the house scramble (lib/scramble.js) wherever chrome text arrives:
 * scramble spends 1.4s cycling symbols, the cut lands in a fraction of
 * that and then HOLDS, which is what a label you are meant to read wants.
 *
 * Mechanics worth keeping straight:
 *   · the split is manual (one span per code point) — the element must own
 *     plain text, and `restore()` puts that exact string back, so nothing
 *     needs SplitText's revert bookkeeping on a per-bind cadence;
 *   · hidden spans still RESERVE layout (visibility, never display), so a
 *     caller may measure the element's final box the moment the cut is
 *     armed — the box never changes as letters land;
 *   · visibility is written on `style` directly, not through gsap — hard
 *     cuts through a tween were observed not to stick (the textExit note);
 *   · reduced motion snaps: the text is simply there.
 *
 * The CLOCK is separable from the paint. `cutSchedule` is the choreography
 * on its own — shuffle N indices, fire one every `stepMs` — and `cutIn` /
 * `cutOut` are its DOM skins. A caller that paints somewhere the DOM cannot
 * reach drives the same clock directly: /process draws its annotation chips
 * into a canvas texture now (they live INSIDE the WebGL scene so panels can
 * occlude them), and calls cutSchedule so the letters land on exactly the
 * cadence the DOM sites use.
 *
 * Every handle is idempotent — `kill()` twice is free — and MUST be killed
 * on teardown or a re-bind, or its pending delayedCalls outlive the DOM.
 */
import gsap from 'gsap';

export const CHAR_CUT = Object.freeze({
  /** exits — the textExit bake every existing site already runs on */
  outStepMs: 35,
  /** entrances land QUICKER than exits: arriving text should not be a wait */
  inStepMs: 22,
});

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const shuffled = (arr) => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Wrap every character of `el`'s text in a span, in place.
 * @returns {{spans: HTMLElement[], text: string, restore: () => void}}
 */
export function splitChars(el) {
  const text = el.textContent ?? '';
  const frag = document.createDocumentFragment();
  const spans = [];
  // Code-point iteration, not index — an em-dash or any non-BMP glyph must
  // stay one cut, never a pair of orphaned halves.
  for (const ch of text) {
    const span = document.createElement('span');
    span.className = 'char-cut';
    span.textContent = ch;
    // A collapsed space would close the gap the moment its neighbours cut in.
    if (ch === ' ') span.style.whiteSpace = 'pre';
    frag.appendChild(span);
    spans.push(span);
  }
  el.textContent = '';
  el.appendChild(frag);
  return {
    spans,
    text,
    restore: () => {
      el.textContent = text;
    },
  };
}

const NOOP_HANDLE = Object.freeze({
  duration: 0,
  kill: () => {},
  finish: () => {},
});

/**
 * The cut's CLOCK, with no opinion about what it paints: `count` indices,
 * shuffled, one handed to `onCut` every `stepMs`. Reduced motion fires them
 * all immediately — the text is simply there.
 *
 * @param {number} count
 * @param {Object} o
 * @param {number} [o.stepMs]        ms between cuts (default CHAR_CUT.inStepMs)
 * @param {(i:number)=>void} o.onCut fired per index, in shuffled order
 * @param {Function} [o.onComplete]
 * @returns {{duration:number, kill:Function, finish:Function}} duration in SECONDS
 */
export function cutSchedule(count, { stepMs = CHAR_CUT.inStepMs, onCut, onComplete } = {}) {
  const order = shuffled(Array.from({ length: Math.max(count, 0) }, (_, i) => i));
  if (!order.length || reducedMotion()) {
    order.forEach((i) => onCut?.(i));
    onComplete?.();
    return NOOP_HANDLE;
  }
  const step = Math.max(stepMs, 0) / 1000;
  const pending = new Set(order);
  const calls = order.map((i, k) =>
    gsap.delayedCall(k * step, () => {
      pending.delete(i);
      onCut?.(i);
    })
  );
  let done = false;
  const duration = order.length * step;
  const settle = () => {
    if (done) return;
    done = true;
    onComplete?.();
  };
  if (onComplete) calls.push(gsap.delayedCall(duration, settle));
  const stop = () => {
    calls.forEach((c) => c.kill());
    calls.length = 0;
  };
  return {
    duration,
    /** Fire every index that hasn't landed yet, now. */
    finish() {
      stop();
      pending.forEach((i) => onCut?.(i));
      pending.clear();
      settle();
    },
    /** Drop the remaining cuts without firing them. */
    kill() {
      stop();
      pending.clear();
    },
  };
}

const run = (el, { stepMs, hidden, onComplete }) => {
  if (!el) return NOOP_HANDLE;
  const { spans, restore } = splitChars(el);
  // `hidden` is the state a letter is cut TO. An entrance parks every span
  // there first; an exit starts from the resting text.
  if (hidden) spans.forEach((s) => { s.style.visibility = 'hidden'; });
  if (reducedMotion() || !spans.length) {
    if (hidden) restore(); // entrance under RM: the text is simply there
    onComplete?.();
    return { ...NOOP_HANDLE, kill: hidden ? () => {} : restore };
  }
  const step = Math.max(stepMs, 0) / 1000;
  const calls = shuffled(spans).map((span, i) =>
    gsap.delayedCall(i * step, () => {
      span.style.visibility = hidden ? '' : 'hidden';
    })
  );
  let done = false;
  const duration = spans.length * step;
  const settle = () => {
    done = true;
    onComplete?.();
  };
  if (onComplete) calls.push(gsap.delayedCall(duration, settle));

  const handle = {
    duration,
    /** Land every remaining letter now (the cut's end state), keep the spans. */
    finish() {
      calls.forEach((c) => c.kill());
      calls.length = 0;
      spans.forEach((s) => { s.style.visibility = hidden ? '' : 'hidden'; });
      if (!done && onComplete) settle();
    },
    /** Stop the cut and hand the element its plain text back. */
    kill() {
      calls.forEach((c) => c.kill());
      calls.length = 0;
      restore();
    },
  };
  return handle;
};

/**
 * Letters land in random order (the house ENTRANCE).
 * @param {HTMLElement} el       element owning plain text
 * @param {Object} [o]
 * @param {number} [o.stepMs]    ms between letter cuts (default CHAR_CUT.inStepMs)
 * @param {Function} [o.onComplete]
 * @returns {{duration:number, kill:Function, finish:Function}} duration in SECONDS
 */
export function cutIn(el, { stepMs = CHAR_CUT.inStepMs, onComplete } = {}) {
  return run(el, { stepMs, hidden: true, onComplete });
}

/**
 * Letters leave in random order (the house EXIT — textExit's charCut clock).
 * @param {HTMLElement} el
 * @param {Object} [o]
 * @param {number} [o.stepMs]    ms between letter cuts (default CHAR_CUT.outStepMs)
 * @param {Function} [o.onComplete]
 */
export function cutOut(el, { stepMs = CHAR_CUT.outStepMs, onComplete } = {}) {
  return run(el, { stepMs, hidden: false, onComplete });
}
