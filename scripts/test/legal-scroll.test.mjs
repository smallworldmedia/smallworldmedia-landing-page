// legal-scroll.test.mjs — the SQ-109 legal-page scroll gate (scripts/lib/legalScrollGate.mjs) on
// hand-built run records: a run to the bottom passes; a page that never moves, one that stops
// short, one that fits the viewport, and one with a stated scroll lock all fail by name.
// Run: node --test scripts/test/legal-scroll.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, scrollLocks, BOTTOM_SLOP_PX } from '../lib/legalScrollGate.mjs';

const OPEN = {
  html: { overflowY: 'auto' },
  body: { overflowY: 'visible' },
  chain: [{ el: 'div.privacy', touchAction: 'auto' }, { el: 'html', touchAction: 'auto' }],
  stopped: false,
};

test('a swipe run that reaches the bottom passes', () => {
  const v = verdict({ id: 'terms-cold', start: 0, end: 840, maxScroll: 840, locks: [] });
  assert.equal(v.pass, true, v.fails.join('; '));
  assert.equal(verdict({ id: 'slop', start: 0, end: 840 - BOTTOM_SLOP_PX, maxScroll: 840 }).pass, true);
});

test('negative control: a page that never moves fails', () => {
  const v = verdict({ id: 'stuck', start: 0, end: 0, maxScroll: 840, locks: [] });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /never moved/);
});

test('a run that stops short of the bottom fails with where it stopped', () => {
  const v = verdict({ id: 'short', start: 0, end: 400, maxScroll: 840 });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /stopped at 400 of 840/);
});

test('a page that fits the viewport fails as vacuous', () => {
  const v = verdict({ id: 'fits', start: 0, end: 0, maxScroll: 0 });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /nothing to scroll/);
});

test('scrollLocks: an open document states no lock', () => {
  assert.deepEqual(scrollLocks(OPEN), []);
  assert.equal(verdict({ id: 'structure', maxScroll: 840, locks: scrollLocks(OPEN) }).pass, true);
});

test('scrollLocks: the global html,body overflow:hidden lock (the SQ-109 shape) is named', () => {
  const locked = { ...OPEN, html: { overflowY: 'hidden' }, body: { overflowY: 'hidden' } };
  assert.deepEqual(scrollLocks(locked), ['viewport overflow-y:hidden (from html)']);
  const v = verdict({ id: 'structure', maxScroll: 840, locks: scrollLocks(locked) });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /lock: viewport overflow-y:hidden/);
});

test('scrollLocks: body overflow propagates to the viewport when html is visible', () => {
  const locked = { ...OPEN, html: { overflowY: 'visible' }, body: { overflowY: 'clip' } };
  assert.deepEqual(scrollLocks(locked), ['viewport overflow-y:clip (from body)']);
});

test('scrollLocks: touch-action without pan-y under the finger, and a stopped Lenis, are named', () => {
  const locked = { ...OPEN, chain: [{ el: 'main.privacy-page', touchAction: 'none' }, { el: 'div.x', touchAction: 'pan-x' }, { el: 'html', touchAction: 'pan-y pinch-zoom' }], stopped: true };
  assert.deepEqual(scrollLocks(locked), ['main.privacy-page touch-action:none', 'div.x touch-action:pan-x', 'Lenis stopped (html.lenis-stopped)']);
});
