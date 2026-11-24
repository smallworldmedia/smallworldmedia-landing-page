// eye-ride.test.mjs — the SQ-144 ride gate (scripts/lib/eyeRideGate.mjs) on hand-built frame records
// shaped like scripts/scheme-probe.mjs --gates=ride writes them: an eye that rides the black panel's
// top at one gap passes; the base build's record (the eye holds one seat while the panel moves) fails
// by name; a run that never moved the panel proves nothing.
// Run: node --test scripts/test/eye-ride.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, RIDE_TOL_PX } from '../lib/eyeRideGate.mjs';

const VH = 900;
const H = 378; // the panel's height at 1440 x 900
const REST = 0.47;
const G = 38; // the eye badge's bottom to the panel's top, at rest

// a panel top for a reveal p, with the on-load slide (px, down) the entrance adds
const panelTopAt = (p, slide = 0) => VH - p * H + slide;
const frame = (phase, p, eyeBottom, slide = 0) => ({
  phase,
  reveal: p,
  vh: VH,
  panelTop: panelTopAt(p, slide),
  eyeBottom,
});

// the eye keeping G above min(panel top, viewport bottom)
const riding = (phase, p, slide = 0) => frame(phase, p, Math.min(panelTopAt(p, slide), VH) - G, slide);
// the base build: the eye holds the resting seat whatever the panel does
const SEAT_BOTTOM = panelTopAt(REST) - G;
const parked = (phase, p, slide = 0) => frame(phase, p, SEAT_BOTTOM, slide);

const steps = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
const run = (make) => [
  ...steps(0, 0.8, 5).map((k) => make('load', REST, (1 - k / 0.8) * REST * H)), // the slide: panel from the fold to rest
  ...Array.from({ length: 8 }, () => make('rest', REST)),
  ...steps(REST, 1, 12).map((p) => make('up', p)),
  ...steps(1, REST, 12).map((p) => make('down', p)),
  ...Array.from({ length: 4 }, () => make('rest', REST)),
];

test('an eye that keeps one gap above the panel top, parked below the fold, rising and back, passes', () => {
  const v = verdict({ frames: run(riding) });
  assert.equal(v.pass, true, JSON.stringify(v.offenders.slice(0, 3)) + v.note);
  assert.ok(Math.abs(v.G - G) <= RIDE_TOL_PX, `G is the rest gap, ${v.G}`);
  assert.ok(v.worst <= RIDE_TOL_PX, `worst drift ${v.worst}`);
});

test('the base build (the eye holds its seat while the panel moves) fails on the rise and the return', () => {
  const v = verdict({ frames: run(parked) });
  assert.equal(v.pass, false);
  assert.ok(v.offenders.some((o) => o.phase === 'up'), 'the rise drifts');
  assert.ok(v.offenders.some((o) => o.phase === 'down'), 'the return drifts');
  assert.ok(v.offenders.some((o) => o.phase === 'load'), 'the on-load slide drifts');
  assert.ok(v.worst > 100, `the full reveal drifts by the panel's climb, ${v.worst}`);
});

test('a drift of 2 px in one frame fails, 0.5 px does not (the whole-pixel seat)', () => {
  const ok = run(riding);
  ok[ok.length - 10] = { ...ok[ok.length - 10], eyeBottom: ok[ok.length - 10].eyeBottom + 0.5 };
  assert.equal(verdict({ frames: ok }).pass, true);
  const bad = run(riding);
  bad[bad.length - 10] = { ...bad[bad.length - 10], eyeBottom: bad[bad.length - 10].eyeBottom + 2 };
  const v = verdict({ frames: bad });
  assert.equal(v.pass, false);
  assert.equal(v.offenders.length, 1);
});

test('a lagging eye (one frame behind the panel) fails on a fast climb', () => {
  const lag = run(riding).map((f, i, all) => {
    if (f.phase !== 'up' && f.phase !== 'down') return f;
    const prev = all[i - 1] ?? f;
    return { ...f, eyeBottom: Math.min(prev.panelTop, VH) - G }; // the eye reads the previous frame's panel top
  });
  const v = verdict({ frames: lag });
  assert.equal(v.pass, false, 'the 33 px step per frame shows');
});

test('a frame before the footer published anything is counted, not judged; one after it that drifts still fails', () => {
  const pre = { phase: 'load', reveal: null, vh: VH, panelTop: VH, eyeBottom: SEAT_BOTTOM };
  const v = verdict({ frames: [pre, ...run(riding)] });
  assert.equal(v.pass, true, v.note);
  assert.match(v.note, /\+1 before the footer's first write/);
  const bad = verdict({ frames: [pre, ...run(parked)] });
  assert.equal(bad.pass, false, 'the base build still fails with a pre-write frame in front');
});

test('a run that never moved the footer proves nothing', () => {
  const still = [...Array.from({ length: 20 }, () => riding('rest', REST)), ...Array.from({ length: 8 }, () => riding('up', REST)), ...Array.from({ length: 8 }, () => riding('down', REST))];
  const v = verdict({ frames: still });
  assert.equal(v.pass, false);
  assert.match(v.note, /never moved/);
});

test('a run with no frames, or no up leg, proves nothing', () => {
  assert.equal(verdict({ frames: [] }).pass, false);
  const noUp = run(riding).filter((f) => f.phase !== 'up');
  const v = verdict({ frames: noUp });
  assert.equal(v.pass, false);
  assert.match(v.note, /up: 0 frames/);
});

test('a pinned G fails a ride held at the wrong gap, where its own median would pass it', () => {
  const frames = run((phase, p, slide = 0) => frame(phase, p, Math.min(panelTopAt(p, slide), VH) - (G + 6), slide));
  assert.equal(verdict({ frames }).pass, true, 'its own median is happy');
  assert.equal(verdict({ frames, gap: G }).pass, false, 'the pinned G is not');
});
