import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plateauGate } from '../lib/plateauGate.mjs';

const series = (key, values) => values.map((v) => ({ [key]: v }));

test('a flat series passes', () => {
  const r = plateauGate(series('contexts', [1, 1, 1, 1, 1, 1, 1, 1, 1]));
  assert.equal(r.pass, true);
  assert.equal(r.results.contexts.rise, 0);
});

test('a series that churns under one ceiling passes (textures per world)', () => {
  const r = plateauGate(series('glTextures', [80, 120, 95, 131, 88, 126, 101, 129, 92, 130]), { rel: 0.1 });
  assert.equal(r.pass, true, JSON.stringify(r.results));
  assert.equal(r.results.glTextures.firstMax, 131);
});

test('negative control: a series that grows per sample fails', () => {
  const r = plateauGate(series('canvases', [4, 6, 8, 10, 12, 14, 16, 18, 20]));
  assert.equal(r.pass, false);
  assert.deepEqual(r.failed, ['canvases']);
  assert.ok(r.results.canvases.rise > r.results.canvases.allow);
});

test('negative control: a slow climb of one per world fails at the default tolerance', () => {
  const r = plateauGate(series('videos', [6, 7, 7, 8, 9, 9, 10, 11, 12, 12]), { rel: 0 });
  assert.equal(r.pass, false);
});

test('warm samples are skipped, so a one-time step before the plateau passes', () => {
  const r = plateauGate(series('mib', [100, 300, 310, 305, 312, 308, 311, 309]), { warm: 2, abs: { mib: 16 } });
  assert.equal(r.pass, true, JSON.stringify(r.results));
  assert.equal(r.results.mib.n, 6);
  assert.equal(r.results.mib.first, 310);
});

test('per-key absolute tolerance', () => {
  const s = series('mib', [100, 104, 102, 108, 106, 110, 109, 112]);
  assert.equal(plateauGate(s, { rel: 0, abs: { mib: 16 } }).pass, true);
  assert.equal(plateauGate(s, { rel: 0, abs: { mib: 2 } }).pass, false);
});

test('a run with too few samples is vacuous and fails', () => {
  const r = plateauGate(series('contexts', [1, 1, 1]), { warm: 0 });
  assert.equal(r.pass, false);
  assert.equal(r.results.contexts.vacuous, true);
});

test('null readings are skipped, not counted as zero', () => {
  const rows = [{ a: 1 }, { a: null }, { a: 1 }, { a: 1 }, { a: undefined }, { a: 1 }, { a: 1 }];
  const r = plateauGate(rows, { warm: 0 });
  assert.equal(r.pass, true);
  assert.equal(r.results.a.n, 5);
});

test('an empty key set fails', () => {
  assert.equal(plateauGate([], { keys: [] }).pass, false);
});
