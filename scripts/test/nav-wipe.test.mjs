// The nav menu's wipe holds until the destination has drawn (SQ-108): the hold's dials, its
// timing against a fake clock, the ready signal, the probe's pure gate (negative control
// included), and the wiring of every route island, read from source.
//   node --test scripts/test/nav-wipe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  holdForRoute,
  parseNavHold,
  routeSignalsReady,
  signalRouteReady,
  ROUTE_READY_EVENT,
  NAV_HOLD_MAX_MS,
  NAV_HOLD_MIN_MS,
} from '../../src/lib/overlayWipe.js';
import { verdict, summary, uncoverAt, earliestUncover, EXPECT, SAMPLE_TOL_MS, SLACK_MS } from '../lib/navWipeGate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const src = (p) => fs.readFileSync(root + p, 'utf8');

// ── the dials ─────────────────────────────────────────────────────────────────────────────────

test('?navwipehold: MAX[,MIN] in ms, the proposed 600 / 100 by default', () => {
  assert.deepEqual(parseNavHold(''), { maxMs: NAV_HOLD_MAX_MS, minMs: NAV_HOLD_MIN_MS });
  assert.deepEqual(parseNavHold('?navwipehold=900'), { maxMs: 900, minMs: 100 });
  assert.deepEqual(parseNavHold('?navwipehold=900,40'), { maxMs: 900, minMs: 40 });
  assert.deepEqual(parseNavHold('?navwipehold=900,0'), { maxMs: 900, minMs: 0 });
  // The beat never outlasts the cap; 0 turns the hold off (cap and beat both 0).
  assert.deepEqual(parseNavHold('?navwipehold=50'), { maxMs: 50, minMs: 50 });
  assert.deepEqual(parseNavHold('?navwipehold=0'), { maxMs: 0, minMs: 0 });
  // Junk falls back to the default rather than to 0 (a silent "hold off").
  assert.deepEqual(parseNavHold('?navwipehold=abc'), { maxMs: 600, minMs: 100 });
  assert.deepEqual(parseNavHold('?navwipehold=-5'), { maxMs: 600, minMs: 100 });
  assert.deepEqual(parseNavHold('?other=1'), { maxMs: 600, minMs: 100 });
});

test('routeSignalsReady: home, /work, the directory and a project signal themselves; the rest fall back', () => {
  for (const p of ['/', '/work', '/work/', '/work/directory', '/work/directory/', '/work/bedouin', '/work/bedouin/']) {
    assert.equal(routeSignalsReady(p), true, p);
  }
  for (const p of ['/process', '/privacy', '/terms', '/specimen', '/lab/globe', '/work/a/b', '/nope']) {
    assert.equal(routeSignalsReady(p), false, p);
  }
});

// ── the hold, on a fake clock ──────────────────────────────────────────────────────────────────

function world(pathname = '/work') {
  const win = new EventTarget();
  win.location = { pathname };
  const doc = new EventTarget();
  let t = 0;
  const pending = [];
  let nextId = 1;
  const timers = {
    set: (fn, ms) => {
      const id = nextId++;
      pending.push({ id, at: t + ms, fn });
      return id;
    },
    clear: (id) => {
      const i = pending.findIndex((p) => p.id === id);
      if (i >= 0) pending.splice(i, 1);
    },
  };
  const advance = (ms) => {
    const end = t + ms;
    for (;;) {
      pending.sort((a, b) => a.at - b.at);
      const next = pending[0];
      if (!next || next.at > end) break;
      pending.shift();
      t = next.at;
      next.fn();
    }
    t = end;
  };
  const rafQueue = [];
  const raf = (fn) => rafQueue.push(fn);
  const flushFrames = (n) => {
    for (let i = 0; i < n; i++) rafQueue.splice(0).forEach((fn) => fn());
  };
  const ready = () => win.dispatchEvent(new Event(ROUTE_READY_EVENT));
  const hold = (dials = { maxMs: 600, minMs: 100 }) => {
    const out = { released: [], listeners: 0 };
    out.cancel = holdForRoute((why) => out.released.push([why, t]), { win, doc, pathname, dials, now: () => t, timers, raf });
    return out;
  };
  return { win, doc, advance, ready, hold, flushFrames, raf, now: () => t, pending };
}

test('the hold releases a beat after the route is ready, never before', () => {
  const w = world();
  const h = w.hold();
  w.advance(250);
  assert.deepEqual(h.released, [], 'still loading at 250 ms: the menu stays up');
  w.ready();
  w.advance(99);
  assert.deepEqual(h.released, [], 'the beat after the ready signal');
  w.advance(1);
  assert.deepEqual(h.released, [['ready', 350]]);
  assert.equal(w.win.__swmNavHold.why, 'ready');
  assert.equal(w.win.__swmNavHold.readyAt, 250);
});

test('the hold releases at the cap when the route never signals', () => {
  const w = world();
  const h = w.hold();
  w.advance(599);
  assert.deepEqual(h.released, []);
  w.advance(1);
  assert.deepEqual(h.released, [['cap', 600]]);
  assert.equal(w.win.__swmNavHold.readyAt, null);
});

test('a ready signal late in the window is cut to the cap, the beat never pushes past it', () => {
  const w = world();
  const h = w.hold();
  w.advance(560);
  w.ready(); // 560 + 100 would be 660 > 600
  w.advance(39);
  assert.deepEqual(h.released, []);
  w.advance(1);
  assert.equal(h.released.length, 1);
  assert.equal(h.released[0][1], 600, 'at the cap, not at 660');
  w.advance(500);
  assert.equal(h.released.length, 1);
});

test('a second ready signal, and a cap after release, do nothing: it releases once', () => {
  const w = world();
  const h = w.hold();
  w.advance(100);
  w.ready();
  w.ready();
  w.advance(1000);
  assert.equal(h.released.length, 1);
  assert.equal(w.pending.length, 0, 'every timer cleared');
});

test('cancel (the menu closed another way) releases nothing and leaves nothing armed', () => {
  const w = world('/process');
  const h = w.hold();
  h.cancel();
  w.ready();
  w.doc.dispatchEvent(new Event('astro:page-load'));
  w.flushFrames(3);
  w.advance(5000);
  assert.deepEqual(h.released, []);
  assert.equal(w.pending.length, 0);
});

test('hold off (?navwipehold=0) releases at once: the old wipe, the negative control', () => {
  const w = world();
  const h = w.hold({ maxMs: 0, minMs: 0 });
  w.advance(0);
  assert.deepEqual(h.released, [['cap', 0]]);
});

test('a route with no canvas is ready at its first paint after astro:page-load', () => {
  const w = world('/process');
  const h = w.hold();
  w.advance(100);
  w.doc.dispatchEvent(new Event('astro:page-load'));
  w.flushFrames(1);
  w.advance(100);
  assert.deepEqual(h.released, [], 'one frame is not yet a painted one');
  w.flushFrames(1);
  w.advance(99);
  assert.deepEqual(h.released, []);
  w.advance(1);
  assert.deepEqual(h.released, [['ready', 300]]);
});

test('a route that signals itself ignores astro:page-load, which fires before its scene draws', () => {
  const w = world('/work');
  const h = w.hold();
  w.advance(100);
  w.doc.dispatchEvent(new Event('astro:page-load'));
  w.flushFrames(4);
  w.advance(400);
  assert.deepEqual(h.released, []);
  w.advance(100);
  assert.deepEqual(h.released, [['cap', 600]]);
});

test('signalRouteReady dispatches two frames later, outside the caller', () => {
  const w = world();
  const seen = [];
  w.win.addEventListener(ROUTE_READY_EVENT, () => seen.push('ready'));
  signalRouteReady(w.win, w.raf);
  assert.deepEqual(seen, [], 'never synchronously: the caller may sit inside a gsap context');
  w.flushFrames(1);
  assert.deepEqual(seen, []);
  w.flushFrames(1);
  assert.deepEqual(seen, ['ready']);
});

// ── the probe's gate ───────────────────────────────────────────────────────────────────────────

const rampDown = (at) => [
  [0, 1],
  [at, 0.97],
  [at + 60, 0.5],
  [at + 200, 0],
];
const good = (extra = {}) => ({
  id: 'directory>work',
  via: 'menu',
  menuOpen: true,
  signals: true,
  swapAt: 120,
  readyAt: 400,
  paintedAt: 380,
  samples: rampDown(500),
  endAt: 1200,
  hold: { why: 'ready' },
  ...extra,
});

test('gate: a wipe that begins a beat after the ready signal passes', () => {
  const v = verdict(good());
  assert.equal(v.pass, true, v.fails.join(' | '));
  assert.equal(v.uncoverAt, 500);
  assert.equal(v.earliest, 500);
});

test('gate: a wipe held to the cap passes when the route never became ready, and fails the missing signal', () => {
  const rec = good({ readyAt: null, paintedAt: null, samples: rampDown(720), endAt: 1500 });
  const v = verdict(rec);
  assert.deepEqual(v.fails, ['the destination never dispatched swm:route-ready: the hold ran to the cap']);
  assert.equal(verdict({ ...rec, signals: false }).pass, true, 'a fallback route is allowed the cap');
});

test('gate NEGATIVE CONTROL: a forced early uncover fails, naming how early', () => {
  // The pre-fix wipe: out on astro:after-swap, long before the page has drawn.
  const early = good({ samples: rampDown(125), hold: null });
  const v = verdict(early);
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /uncovered at 125 ms, 375 ms before the ready signal \(400 ms \+ 100 ms beat\)/);
  assert.ok(v.fails.some((f) => /before the destination first painted \(380 ms\)/.test(f)));
  // Uncovering before the cap with no ready signal at all is the same fault.
  const blind = verdict(good({ readyAt: null, paintedAt: null, samples: rampDown(300) }));
  assert.ok(blind.fails.some((f) => /before the cap \(600 ms after the swap\) with no ready signal/.test(f)));
});

test('gate: the dials the page reports do not excuse an early uncover (a hold switched off reports cap 0)', () => {
  const off = good({ samples: rampDown(125), hold: { why: 'cap', maxMs: 0, minMs: 0 } });
  assert.equal(verdict(off).pass, false);
});

test('gate: a wipe a frame or two ahead of the beat is sampling noise, not a fault', () => {
  const v = verdict(good({ samples: rampDown(500 - SAMPLE_TOL_MS) }));
  assert.equal(v.pass, true, v.fails.join(' | '));
  assert.equal(verdict(good({ samples: rampDown(500 - SAMPLE_TOL_MS - 5) })).pass, false);
});

test('gate: held past the cap, stranded, or never watched all fail', () => {
  assert.ok(verdict(good({ readyAt: null, signals: false, paintedAt: null, samples: rampDown(600 + 120 + SLACK_MS + 50) })).fails.some((f) => /past the cap/.test(f)));
  const stranded = verdict(good({ samples: [[0, 1]], endAt: 2000 }));
  assert.match(stranded.fails[0], /never uncovered/);
  const short = verdict(good({ samples: [[0, 1]], endAt: 300 }));
  assert.match(short.fails[0], /nothing measured/);
  assert.match(verdict({ ...good(), swapAt: null }).fails[0], /never landed/);
});

test('gate: a menu that was not open covered nothing', () => {
  assert.ok(verdict(good({ menuOpen: false })).fails.some((f) => /not open at the tap/.test(f)));
});

test('gate: the card control passes only when no hold armed and no menu covered', () => {
  const card = { id: 'work>project (card)', via: 'card', menuOpen: false, samples: [[0, 0]], hold: null };
  assert.equal(verdict(card).pass, true);
  assert.equal(verdict({ ...card, hold: { why: 'cap' } }).pass, false);
  assert.equal(verdict({ ...card, samples: [[0, 0], [90, 1]] }).pass, false);
});

test('gate: uncoverAt reads the first frame under full cover after a full cover; a never-covered menu has none', () => {
  assert.equal(uncoverAt([[0, 0], [10, 0.5], [20, 0]]), null);
  assert.equal(uncoverAt([[0, 1], [40, 0.99], [80, 0.9]]), 80);
  assert.equal(earliestUncover({ swapAt: 100, readyAt: 300 }, EXPECT), 400);
  assert.equal(earliestUncover({ swapAt: 100, readyAt: 650 }, EXPECT), 700);
  assert.equal(earliestUncover({ swapAt: 100, readyAt: null }, EXPECT), 700);
});

test('gate: an empty run proves nothing; one measured menu navigation is needed', () => {
  assert.equal(summary([]).pass, false);
  assert.match(summary([]).fails[0], /no nav-menu navigation was measured/);
  assert.equal(summary([{ id: 'c', via: 'card', menuOpen: false, samples: [], hold: null }]).pass, false);
  assert.equal(summary([good()]).pass, true);
  const mixed = summary([good(), good({ id: 'home>work', samples: rampDown(130) })]);
  assert.equal(mixed.pass, false);
  assert.match(mixed.fails[0], /^home>work: uncovered at 130 ms/);
});

// ── the wiring, from source ────────────────────────────────────────────────────────────────────

test('SiteNav holds the swap-close for the route, and only the swap-close', () => {
  const nav = src('src/components/SiteNav.jsx');
  assert.match(nav, /holdForRoute\(\(\) => setMenuOpen\(false\)\)/);
  assert.doesNotMatch(nav, /const onSwap = \(\) => setMenuOpen\(false\)/, 'the swap no longer closes the menu at once');
  // The pill, Escape, the logo and the privacy link still close immediately.
  assert.match(nav, /e\.key === 'Escape'\) setMenuOpen\(false\)/);
  assert.match(nav, /onClick=\{\(\) => setMenuOpen\(false\)\}/);
  // The lockup: the black-cover passage, a tap on "/" and a new-tab click close now; a plain
  // swap home is held like every other menu destination.
  assert.match(nav, /handleHome\(e\);[\s\S]{0,420}if \(e\.defaultPrevented \|\| window\.location\.pathname === '\/'/);
  assert.doesNotMatch(nav, /setMenuOpen\(false\);\s*handleHome\(e\)/, 'the lockup no longer closes the menu before it knows the swap');
});

test('every route island dispatches the ready signal once its first frame is up', () => {
  const sites = {
    'src/components/Hero.jsx': /swm:fill-release'\)\);\s*signalRouteReady\(\)/,
    'src/components/work/FeaturedProjects.jsx': /swm:fill-release'\)\);\s*signalRouteReady\(\);[^\n]*\n\s*\}\n\s*\}, \[\]\)/,
    'src/components/work/detail/FeaturedProjectDetail.jsx': /swm:fill-release'\)\);\s*signalRouteReady\(\)/,
    'src/components/work/directory/DirectoryPage.jsx': /setPending\(false\);\s*signalRouteReady\(\)/,
  };
  for (const [file, re] of Object.entries(sites)) {
    const s = src(file);
    assert.match(s, /signalRouteReady/, `${file} imports it`);
    assert.match(s, re, `${file} calls it at its first frame`);
  }
  // /work's snapped arrival (a World restored by Back) is ready when that World's card is up.
  assert.match(src('src/components/work/FeaturedProjects.jsx'), /fillOnCardRef\.current = null;\s*window\.dispatchEvent\(new CustomEvent\('swm:fill-release'\)\);\s*signalRouteReady\(\)/);
});
