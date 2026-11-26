import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickGate } from '../lib/plateauGate.mjs';

// footMiB before and after each committed pick, memory-probe --picks under WebKit at 402x874 @3 (SQ-139,
// verification/SQ-139, base 6feac4f). WALK: Nathan's walk (60 s of worlds, 6 eye rounds, then 3 eye picks).
// FRESH: a fresh page, the world held, 3 api commits: the first scheme change the page ever makes steps once.
const picks = (rows) => rows.map(([target, pre, post, landed = true]) => ({ target, landed, pre: { footMiB: pre }, post: { footMiB: post } }));
const WALK = picks([['black', 460.1, 467.8], ['blue', 467.8, 485.1], ['project', 485.0, 493.6]]);
const FRESH = picks([['black', 274.9, 390.7], ['blue', 390.7, 391.7], ['project', 391.7, 389.6]]);

test('picks after the rounds step no more than the bound', () => {
  const r = pickGate(WALK, { max: 80 });
  assert.equal(r.pass, true, JSON.stringify(r));
  assert.deepEqual(r.steps, [7.7, 17.3, 8.6]);
  assert.equal(r.worst, 17.3);
  assert.equal(r.worstAt, 2);
});

test('negative control: the first commit on a fresh page fails the bound', () => {
  const r = pickGate(FRESH, { max: 80 });
  assert.equal(r.pass, false);
  assert.equal(r.worst, 115.8);
  assert.equal(r.worstAt, 1);
});

test('a pick that missed its target fails, whatever it cost', () => {
  const r = pickGate(picks([['black', 100, 101], ['blue', 101, 102, false]]), { max: 80 });
  assert.equal(r.pass, false);
  assert.equal(r.missed, 1);
});

test('no picks, a missing reading or no bound is vacuous and fails', () => {
  assert.equal(pickGate([], { max: 80 }).vacuous, true);
  assert.equal(pickGate(picks([['black', 100, null]]), { max: 80 }).vacuous, true);
  assert.equal(pickGate(WALK, {}).vacuous, true);
  assert.equal(pickGate(undefined, { max: 80 }).pass, false);
});
