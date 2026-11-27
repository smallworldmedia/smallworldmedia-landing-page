// footer-row.test.mjs — the footer-row gate (scripts/lib/footerRowGate.mjs) on records in the shape
// scripts/footer-probe.mjs measures (real numbers, /services/?tag=all at a 900px-high viewport).
//   SQ-138: the row clear of the left stack passes; the pre-fix 900px record (the row's first link
//           inside the ©line's run) fails by name.
//   SQ-140: where the row wraps the ©line stacks under the lockup, bottom-aligned with the row's last
//           line; where the row is one line they run on. The SQ-138 build at 900px (row 2 lines,
//           stack 1 line) is the negative control.
// Run: node --test scripts/test/footer-row.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, rowLines, hysteresis, MIN_CLEARANCE_PX, ALIGN_TOL_PX } from '../lib/footerRowGate.mjs';

const box = (x, y, right, bottom) => ({ x, y, right, bottom });
// The run-on stack (1024+, and the SQ-138 build at every width): the ©line and the lockup box
// [850–888] share a centre line (869) at the bottom of the viewport.
const copy = box(276, 858, 463, 880);
const lockup = box(0, 850, 255, 888);
const band = box(0, 654, 900, 900);
const link = (label, x, right, y = 858, bottom = 880) => ({ label, ...box(x, y, right, bottom) });

// 1440: the row hugs right, one line, privacy last.
const WIDE = {
  width: 1440,
  copy,
  lockup,
  band: box(0, 676, 1440, 900),
  links: [link('↳start_project', 920, 1029), link('⁕featured_projects', 1041, 1181), link('privacy', 1380, 1428)],
};

// 900, before SQ-138: the row starts at x=380, inside the ©line [276–463].
const OVERLAP = {
  width: 900,
  copy,
  lockup,
  band,
  links: [link('↳start_project', 380, 489), link('⁕featured_projects', 501, 641), link('privacy', 840, 888)],
};

// 900 as SQ-138 left it (measured 11-24): the row wraps onto two right-aligned lines, line 1
// [828–850], line 2 [858–880], while the left stack stays one run-on line.
const ROW_900 = [
  link('↳start_project', 540, 649, 828, 850),
  link('⁕featured_projects', 661, 801, 828, 850),
  link('services', 813, 888, 828, 850),
  link('♡follow_us', 700, 790, 858, 880),
  link('privacy', 840, 888, 858, 880),
];
const SQ138_900 = { width: 900, copy, lockup, band, links: ROW_900 };

// A wrapped row as SQ-138 hand-built it (kept for the band test, which is about the row's rise only).
const WRAPPED = {
  width: 900,
  copy,
  lockup,
  band,
  links: [
    link('↳start_project', 540, 649, 836, 858),
    link('⁕featured_projects', 661, 801, 836, 858),
    link('♡follow_us', 700, 790, 858, 880),
    link('privacy', 840, 888, 858, 880),
  ],
};

// 900, with SQ-140: the ©line stays on the row's last line [858–880], seated on the lockup's optical
// left; the lockup box rises one line pitch to [820–858], its centre (839) on the row's first line.
const STACKED_900 = {
  width: 900,
  copy: box(12, 858, 199, 880),
  lockup: box(0, 820, 255, 858),
  band,
  links: ROW_900,
};

test('a one-line row clear of the stack passes', () => {
  const v = verdict(WIDE);
  assert.equal(v.pass, true, v.fails.join('; '));
});

test('negative control: the pre-fix 900px row over the ©line fails by name', () => {
  const v = verdict(OVERLAP);
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /start_project.*©line/);
});

test('negative control (SQ-140): the SQ-138 build at 900px, row on 2 lines, stack on 1, fails by name', () => {
  const v = verdict(SQ138_900);
  assert.equal(v.pass, false);
  const text = v.fails.join('\n');
  assert.match(text, /wraps onto 2 lines but the ©line .* is not under the lockup/);
  assert.match(text, /lockup's centre .* is not on the row's first line/);
});

test('a wrapped row with the ©line stacked under the lockup, bottom on the last line, passes', () => {
  const v = verdict(STACKED_900);
  assert.equal(v.pass, true, v.fails.join('; '));
});

test('a wrapped row whose ©line floats above the last line fails', () => {
  const v = verdict({ ...STACKED_900, copy: box(12, 836, 199, 858), lockup: box(0, 798, 255, 836) });
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /©line's bottom 858 is not on the row's last line bottom 880/);
});

test('a one-line row with the ©line stacked under the lockup fails, so 1024+ stays run-on', () => {
  const v = verdict({ ...WIDE, copy: STACKED_900.copy, lockup: STACKED_900.lockup });
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /one line but the ©line .* do not share a centre line/);
});

test('the alignment tolerance is a rounding allowance: just inside passes, just outside fails', () => {
  const near = { ...STACKED_900, copy: box(12, 858 + ALIGN_TOL_PX, 199, 880 + ALIGN_TOL_PX) };
  assert.equal(verdict(near).pass, true);
  const far = { ...STACKED_900, copy: box(12, 858 + ALIGN_TOL_PX + 1, 199, 880 + ALIGN_TOL_PX + 1) };
  assert.equal(verdict(far).pass, false);
});

test('rowLines groups links by shared bottom, top to bottom', () => {
  assert.deepEqual(rowLines(ROW_900), [
    { top: 828, bottom: 850 },
    { top: 858, bottom: 880 },
  ]);
  assert.equal(rowLines(WIDE.links).length, 1);
});

test('hysteresis: a sweep whose state follows the width agrees down and up; one that follows the path does not', () => {
  const at = (rec, width) => ({ ...rec, width });
  const down = [at(STACKED_900, 900), at(WIDE, 1100)];
  assert.deepEqual(hysteresis(down, [at(WIDE, 1100), at(STACKED_900, 900)]), []);
  // Going back up, 900 stays one-line run-on (the row un-wrapped when the stack narrowed).
  const stuck = hysteresis(down, [at(WIDE, 1100), at(WIDE, 900)]);
  assert.equal(stuck.length, 1);
  assert.equal(stuck[0].width, 900);
  // A width the up pass never measured disagrees: a thin sweep proves nothing.
  assert.equal(hysteresis(down, [at(WIDE, 1100)])[0].up, 'missing');
});

test('a link closer than the clearance fails, one at exactly the clearance passes', () => {
  const near = { ...WIDE, links: [link('start', copy.right + MIN_CLEARANCE_PX - 1, 700), link('privacy', 1380, 1428)] };
  assert.equal(verdict(near).pass, false);
  const edge = { ...WIDE, links: [link('start', copy.right + MIN_CLEARANCE_PX, 700), link('privacy', 1380, 1428)] };
  assert.equal(verdict(edge).pass, true);
});

test('a row taller than the band fails: a wrap must not poke out of the top', () => {
  const v = verdict({ ...WRAPPED, band: box(0, 850, 900, 900) });
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /leaves the band/);
});

test('privacy must close the row', () => {
  const v = verdict({ ...WIDE, links: [link('privacy', 920, 968), link('↳start_project', 1041, 1150)] });
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /privacy is not the row's last link/);
});

test('a record with nothing measured fails as vacuous, never passes', () => {
  assert.match(verdict({ width: 900, links: [], copy, lockup, band }).fails[0], /no footer links/);
  assert.match(verdict({ width: 900, links: WIDE.links, lockup, band }).fails[0], /©line has no box/);
  assert.match(verdict({ width: 900, links: WIDE.links, copy, band }).fails[0], /lockup has no box/);
  assert.match(verdict({ width: 900, links: WIDE.links, copy, lockup }).fails[0], /band has no box/);
});
