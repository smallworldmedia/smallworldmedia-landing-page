/**
 * footerRowGate — the links footer's nav row against the left stack (SQ-138).
 *
 * Above 768px the row (`.site-footer__nav`: its links) is right-aligned and full width, while
 * the lockup and the ©line on the left belong to another island (SiteTagline, fixed). At 900px
 * the row's first links printed straight over "All rights reserved". scripts/footer-probe.mjs
 * scrolls /services/?tag=all to the footer's end at each width and records the boxes;
 * this gate judges them, pure, so scripts/test runs it offline.
 *
 * SQ-140: where the row wraps (769–~1000px) the left stack must be two lines too — the ©line under
 * the lockup, bottom-aligned with the row's last line — and where the row is one line the stack
 * runs on (lockup and ©line on one centre line). See stackFails.
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

// SQ-140: the left stack mirrors the row's line count. Two or more row lines: the ©line sits under
// the lockup, its bottom on the row's last line, the lockup's centre on the row's first line. One
// row line: lockup and ©line run on, sharing a centre line. Measured at 1440 (run-on) and 900
// (stacked) the offsets are 0; these absorb sub-pixel rounding of the boxes, not a design slack.
export const ALIGN_TOL_PX = 3;
// Row links on the same line share a bottom (the row is flex-end aligned) within this much.
const SAME_LINE_PX = 3;

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
  fails.push(...stackFails(links, copy, lockup));
  return { id: `w${rec.width}`, pass: fails.length === 0, fails };
}

// The row's lines, top to bottom: { top, bottom } per distinct bottom (links share a bottom on a line).
export function rowLines(links) {
  const lines = [];
  for (const l of links.filter(hasBox)) {
    const line = lines.find((x) => Math.abs(x.bottom - l.bottom) <= SAME_LINE_PX);
    if (line) line.top = Math.min(line.top, l.y);
    else lines.push({ top: l.y, bottom: l.bottom });
  }
  return lines.sort((a, b) => a.bottom - b.bottom);
}

/**
 * A slow resize sweep must not oscillate (SQ-140: the stack's width feeds the row's margin, and the
 * stack's mode follows the row). `down` and `up` are records of the same widths measured while the
 * viewport shrinks and while it grows back; both must agree on the row's line count and on whether
 * the ©line is stacked at every width, so the state is a function of the width, never of the path.
 * Returns the widths that disagree (empty = stable). A width missing from either pass disagrees.
 */
export function hysteresis(down, up) {
  const state = (r) => {
    const n = rowLines(r.links ?? []).length;
    if (!n || !hasBox(r.copy) || !hasBox(r.lockup)) return 'hidden'; // phones: no row, no ©line
    return `${n}:${r.copy.y >= r.lockup.bottom - ALIGN_TOL_PX ? 'stacked' : 'run-on'}`;
  };
  const upBy = new Map(up.map((r) => [r.width, r]));
  const bad = [];
  for (const d of down) {
    const u = upBy.get(d.width);
    if (!u || state(d) !== state(u)) bad.push({ width: d.width, down: state(d), up: u ? state(u) : 'missing' });
  }
  return bad;
}

const mid = (r) => (r.y + r.bottom) / 2;

function stackFails(links, copy, lockup) {
  const lines = rowLines(links);
  if (!lines.length) return [];
  const fails = [];
  if (lines.length === 1) {
    if (Math.abs(mid(copy) - mid(lockup)) > ALIGN_TOL_PX) {
      fails.push(
        `the row is one line but the ©line [${copy.y}–${copy.bottom}] and the lockup [${lockup.y}–${lockup.bottom}] do not share a centre line (run-on)`
      );
    }
    return fails;
  }
  const first = lines[0];
  const lastLine = lines[lines.length - 1];
  if (copy.y < lockup.bottom - ALIGN_TOL_PX) {
    fails.push(
      `the row wraps onto ${lines.length} lines but the ©line [top ${copy.y}] is not under the lockup [bottom ${lockup.bottom}]: the left stack is one line`
    );
  }
  if (Math.abs(copy.bottom - lastLine.bottom) > ALIGN_TOL_PX) {
    fails.push(`the ©line's bottom ${copy.bottom} is not on the row's last line bottom ${lastLine.bottom}`);
  }
  const firstMid = (first.top + first.bottom) / 2;
  if (Math.abs(mid(lockup) - firstMid) > ALIGN_TOL_PX) {
    fails.push(`the lockup's centre ${mid(lockup)} is not on the row's first line centre ${firstMid}`);
  }
  return fails;
}
