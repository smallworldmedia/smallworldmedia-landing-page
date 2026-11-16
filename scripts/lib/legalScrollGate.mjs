/**
 * legalScrollGate.mjs — the verdict of scripts/legal-scroll-probe.mjs (SQ-109: /terms would not
 * scroll by finger on iPhone), as pure functions over plain records, so
 * scripts/test/legal-scroll.test.mjs runs them offline.
 *
 * A run record: { id, start, end, maxScroll, locks? }
 *   start / end  scrollY before the first gesture and after the last one settled
 *   maxScroll    scrollHeight − innerHeight when the run began
 *   locks        what the page stated that blocks a user scroll (scrollLocks() below)
 * A run whose page fits the viewport proves nothing and fails as vacuous; a run that never
 * moved, or stopped short of the bottom, fails with where it stopped.
 */

export const BOTTOM_SLOP_PX = 2;

const SCROLL_BLOCKING = new Set(['hidden', 'clip']);
const PANS_Y = (ta) => ta === 'auto' || ta === 'manipulation' || /\bpan-y\b/.test(ta);

/**
 * The user-scroll locks in a style snapshot:
 *   { html: { overflowY }, body: { overflowY }, chain: [{ el, touchAction }], stopped }
 * The viewport takes html's overflow, or body's when html's is `visible` (CSS overflow
 * propagation), so a `hidden` there blocks finger and keyboard scroll while script scrolling
 * (Lenis on the wheel) still works — the SQ-109 shape. `chain` is the element under the finger
 * up to <html>; a touch-action without vertical panning on any of them takes the finger.
 */
export function scrollLocks(snap) {
  const locks = [];
  const htmlOv = snap.html?.overflowY ?? 'visible';
  const viewport = htmlOv === 'visible' ? { who: 'body', ov: snap.body?.overflowY ?? 'visible' } : { who: 'html', ov: htmlOv };
  if (SCROLL_BLOCKING.has(viewport.ov)) locks.push(`viewport overflow-y:${viewport.ov} (from ${viewport.who})`);
  for (const { el, touchAction } of snap.chain ?? []) {
    if (!PANS_Y(touchAction)) locks.push(`${el} touch-action:${touchAction}`);
  }
  if (snap.stopped) locks.push('Lenis stopped (html.lenis-stopped)');
  return locks;
}

export function verdict(rec) {
  const fails = [];
  if (!(rec.maxScroll > 0)) fails.push(`nothing to scroll (maxScroll ${rec.maxScroll}): the run proves nothing`);
  else if ('end' in rec) {
    if (!(rec.end > rec.start)) fails.push(`never moved (scrollY ${rec.start} → ${rec.end})`);
    else if (rec.end < rec.maxScroll - BOTTOM_SLOP_PX) fails.push(`stopped at ${Math.round(rec.end)} of ${Math.round(rec.maxScroll)}`);
  }
  for (const l of rec.locks ?? []) fails.push(`lock: ${l}`);
  return { id: rec.id, pass: fails.length === 0, fails };
}
