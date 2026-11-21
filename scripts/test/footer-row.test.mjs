// footer-row.test.mjs — the SQ-138 footer-row gate (scripts/lib/footerRowGate.mjs) on hand-built
// records measured by scripts/footer-probe.mjs: the row clear of the left stack passes; the
// pre-fix 900px record (the row's first link inside the ©line's run) fails by name.
// Run: node --test scripts/test/footer-row.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, MIN_CLEARANCE_PX } from '../lib/footerRowGate.mjs';

const box = (x, y, right, bottom) => ({ x, y, right, bottom });
const copy = box(276, 858, 463, 880);
const lockup = box(0, 806, 255, 880);
const band = box(0, 676, 900, 900);
const link = (label, x, right, y = 858, bottom = 880) => ({ label, ...box(x, y, right, bottom) });

// 1440: the row hugs right, one line, privacy last.
const WIDE = {
  width: 1440,
  copy,
  lockup,
  band: box(0, 676, 1440, 900),
  links: [link('↳start_project', 920, 1029), link('⁕featured_projects', 1041, 1181), link('privacy', 1380, 1428)],
};

// 900, before the fix: the row starts at x=380, inside the ©line [276–463].
const OVERLAP = {
  width: 900,
  copy,
  lockup,
  band,
  links: [link('↳start_project', 380, 489), link('⁕featured_projects', 501, 641), link('privacy', 840, 888)],
};

// 900, after: the row's room is what is right of the stack, so it wraps right-aligned onto two lines.
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

test('a one-line row clear of the stack passes', () => {
  const v = verdict(WIDE);
  assert.equal(v.pass, true, v.fails.join('; '));
});

test('negative control: the pre-fix 900px row over the ©line fails by name', () => {
  const v = verdict(OVERLAP);
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /start_project.*©line/);
});

test('a wrapped row that keeps clear of the stack and inside the band passes', () => {
  const v = verdict(WRAPPED);
  assert.equal(v.pass, true, v.fails.join('; '));
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
