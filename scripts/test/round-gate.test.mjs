import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roundGate } from '../lib/plateauGate.mjs';

// Resting footprints (MiB) measured by memory-probe --run=rounds, WebKit 402x874 @3, f8a5cf1 (SQ-136).
const rounds = (feet) => feet.map((footMiB, i) => ({ round: i + 1, rest: { footMiB, nodes: 918 } }));

test('a world held still (?pophold): the eye rounds plateau and pass', () => {
  const r = roundGate(rounds([349.5, 355.1, 353.2, 357.5, 360.7, 362.7]));
  assert.equal(r.pass, true, JSON.stringify(r.results));
  assert.equal(r.results.footMiB.firstMax, 355.1);
  assert.equal(r.results.footMiB.rise, 7.6);
});

test('the first round is warm-up: the eye opening step does not count', () => {
  const r = roundGate(rounds([460, 355, 356, 354, 357, 356]));
  assert.equal(r.pass, true);
  assert.equal(r.results.footMiB.n, 5);
});

test('negative control: the globe running under the eye rounds climbs and fails', () => {
  const r = roundGate(rounds([362.5, 365.7, 374.1, 385.2, 424.1, 419.1, 439.4, 448.5, 460.4, 491.2, 496.2, 521.8]));
  assert.equal(r.pass, false);
  assert.deepEqual(r.failed, ['footMiB']);
  assert.ok(r.results.footMiB.rise > r.results.footMiB.allow);
});

test('the tolerance edge over 6 rounds: 8 MiB a round passes (rise 24), 9 fails (rise 27)', () => {
  const at8 = roundGate(rounds([300, 308, 316, 324, 332, 340]));
  assert.equal(at8.pass, true);
  assert.equal(at8.results.footMiB.rise, 24);
  const at9 = roundGate(rounds([300, 309, 318, 327, 336, 345]));
  assert.equal(at9.pass, false);
  assert.equal(at9.results.footMiB.rise, 27);
});

test('too few rounds is vacuous and fails', () => {
  const r = roundGate(rounds([300, 301, 302]));
  assert.equal(r.pass, false);
  assert.equal(r.results.footMiB.vacuous, true);
});
