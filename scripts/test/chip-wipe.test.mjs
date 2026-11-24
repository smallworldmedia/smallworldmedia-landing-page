// chip-wipe.test.mjs — the SQ-142 chip-exit gate (scripts/lib/chipWipeGate.mjs) on per-frame
// records shaped like scripts/pager-probe.mjs --scenario=chipwipe output: the letter cut then a
// multi-frame clip wipe passes; the chip going from painted to gone in one frame fails by name.
// Run: node --test scripts/test/chip-wipe.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, clipFraction, painted, MIN_WIPE_FRAMES } from '../lib/chipWipeGate.mjs';

const frame = (t, o = {}) => ({ t, connected: true, show: true, exit: false, opacity: 1, clip: 0, chars: 16, ...o });
const rest = (t) => frame(t, { show: false, opacity: 0 });

// The letter cut (16 → 0, one per ~35ms), then data-exit and the clip 0 → 1 over ~520ms at 60fps.
const letters = Array.from({ length: 17 }, (_, i) => frame(1000 + i * 35, { chars: 16 - i }));
const wipe = Array.from({ length: 32 }, (_, i) =>
  frame(1600 + i * 16.7, { exit: true, chars: 0, clip: Math.min(1, (i + 1) / 31) })
);
const WIPED = { id: 'wiped', samples: [...letters, ...wipe, rest(2140), rest(2157)] };

// The cut Nathan saw (11-24, phone): the chip whole, then gone on the next frame.
const CUT = { id: 'cut', samples: [...letters, frame(1600, { exit: true, chars: 0, clip: 0 }), rest(1617), rest(1634)] };

// A stalled main thread: one partial frame, then the transition is over.
const STALL = {
  id: 'stall',
  samples: [...letters, frame(1600, { exit: true, chars: 0, clip: 0.05 }), frame(2140, { exit: true, chars: 0, clip: 1 }), rest(2157)],
};

test('a multi-frame wipe passes', () => {
  const v = verdict(WIPED);
  assert.equal(v.pass, true, v.fails.join('; '));
  assert.ok(v.wipeFrames >= MIN_WIPE_FRAMES);
  assert.ok(v.wipeMs > 400);
});

test('negative control: painted → gone in one frame fails as a cut', () => {
  const v = verdict(CUT);
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /cut, not a wipe: 0 partial-clip frame/);
  assert.match(v.fails[0], /data-show dropped/);
});

test('a single partial frame (a stall that eats the transition) still fails', () => {
  const v = verdict(STALL);
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /1 partial-clip frame/);
});

test('a run that never paints the chip proves nothing', () => {
  const v = verdict({ samples: [rest(0), rest(16)] });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /never painted/);
});

test('a run that ends with the chip still up saw no exit', () => {
  const v = verdict({ samples: letters });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /no exit seen/);
});

test('clipFraction reads the wiping edge on both tiers', () => {
  assert.equal(clipFraction('inset(37.5% -2px -2px -2px)'), 0.375); // desktop: top edge
  assert.equal(clipFraction('inset(-2px -2px 100% -2px)'), 1); // ≤768: the flipped bottom edge
  assert.equal(clipFraction('none'), null);
  assert.equal(painted(frame(0, { clip: 1 })), false);
});
