/**
 * footerRowGate — the links footer's nav row against the left stack (SQ-138).
 *
 * Above 768px the row (`.site-footer__nav`: its links) is right-aligned and full width, while
 * the lockup and the ©line on the left belong to another island (SiteTagline, fixed). At 900px
 * the row's first links printed straight over "All rights reserved". scripts/footer-probe.mjs
 * scrolls /work/directory/?tag=all to the footer's end at each width and records the boxes;
 * this gate judges them, pure, so scripts/test runs it offline.
 *
 * Record (viewport px, one per width): {
 *   width,
 *   links: [{ label, x, y, right, bottom }]   the row's links in DOM order
 *   copy, lockup: { x, y, right, bottom }      the left stack (the ©line, the lockup link)
 *   band:  { x, y, right, bottom }             the revealed footer panel
 * }
 */

// The row must clear the left stack by at least this much. The row's own column gap is
// --space-6 (12px): anything tighter reads as the same run.
export const MIN_CLEARANCE_PX = 12;

const rectsOverlap = (a, b, pad = 0) =>
  a.x < b.right + pad && b.x < a.right + pad && a.y < b.bottom + pad && b.y < a.bottom + pad;

const hasBox = (r) =>
  !!r && [r.x, r.y, r.right, r.bottom].every(Number.isFinite) && r.right > r.x && r.bottom > r.y;

export function verdict(rec) {
  const fails = [];
  const { links = [], copy, lockup, band } = rec;
  if (!links.length) fails.push('no footer links measured: the run proves nothing');
  if (!hasBox(copy)) fails.push('the ©line has no box: the run proves nothing');
  if (!hasBox(lockup)) fails.push('the lockup has no box: the run proves nothing');
  if (!hasBox(band)) fails.push('the footer band has no box: the run proves nothing');
  if (fails.length) return { id: `w${rec.width}`, pass: false, fails };

  for (const l of links) {
    if (!hasBox(l)) {
      fails.push(`link "${l.label}" has no box`);
      continue;
    }
    if (rectsOverlap(l, copy, MIN_CLEARANCE_PX)) {
      fails.push(`link "${l.label}" [${l.x}–${l.right}] is within ${MIN_CLEARANCE_PX}px of the ©line [${copy.x}–${copy.right}]`);
    }
    if (rectsOverlap(l, lockup, MIN_CLEARANCE_PX)) {
      fails.push(`link "${l.label}" [${l.x}–${l.right}] is within ${MIN_CLEARANCE_PX}px of the lockup [${lockup.x}–${lockup.right}]`);
    }
    if (l.y < band.y || l.bottom > band.bottom) {
      fails.push(`link "${l.label}" [${l.y}–${l.bottom}] leaves the band [${band.y}–${band.bottom}]`);
    }
  }
  // Privacy closes the row: last in the DOM, so the last link of the last line.
  const last = links[links.length - 1];
  if (last && !/privacy/i.test(last.label)) fails.push(`privacy is not the row's last link (last: "${last.label}")`);
  return { id: `w${rec.width}`, pass: fails.length === 0, fails };
}
