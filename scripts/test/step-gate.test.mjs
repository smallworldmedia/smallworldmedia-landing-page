import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepGate } from '../lib/plateauGate.mjs';

// footMiB per sample of memory-probe --run=eye --engine=webkit at 402x874 @3 (SQ-133, verification/SQ-133):
// the base build (01bacc2) and the candidate (the widget's var() chains registered in site-scheme.css).
const run = (rows) => rows.map(([label, footMiB]) => ({ label, footMiB }));
const BASE = run([['baseline', 350.4], ['engaged', 493.2], ['held 2', 601.7], ['held 4', 586.1], ['held 6', 556.3], ['held 8', 540.6], ['released', 534.3], ['minute 8s', 503.8], ['end', 497.8]]);
const FIXED = run([['baseline', 237], ['engaged', 286.2], ['held 2', 334.3], ['held 4', 340.4], ['held 6', 338.9], ['held 8', 333.3], ['held 10', 331.7], ['held 12', 328.6], ['released', 338.3], ['minute 8s', 341.8], ['end', 482.7]]);

test('the registered chains keep the eye\'s opening step under the bound', () => {
  const r = stepGate(FIXED, { max: 160, until: 'released' });
  assert.equal(r.pass, true, JSON.stringify(r));
  assert.equal(r.step, 103.4);
  assert.equal(r.peakAt, 'held 4');
});

test('negative control: the base build\'s step fails the bound', () => {
  const r = stepGate(BASE, { max: 160, until: 'released' });
  assert.equal(r.pass, false);
  assert.equal(r.step, 251.3);
  assert.equal(r.peakAt, 'held 2');
  assert.equal(r.base, 350.4);
});

test('`until` ends the window: a later peak is not the opening step', () => {
  const rows = run([['baseline', 100], ['held 2', 150], ['released', 140], ['minute 8s', 400]]);
  assert.equal(stepGate(rows, { max: 60, until: 'released' }).pass, true);
  assert.equal(stepGate(rows, { max: 60 }).pass, false, 'no until: the whole run counts');
});

test('null readings are skipped; no baseline or no later reading is vacuous and fails', () => {
  assert.equal(stepGate(run([['baseline', 100], ['held 2', null], ['released', 120]]), { max: 30 }).pass, true);
  const noBase = stepGate(run([['baseline', null], ['held 2', 120]]), { max: 30 });
  assert.equal(noBase.pass, false);
  assert.equal(noBase.vacuous, true);
  assert.equal(stepGate(run([['baseline', 100]]), { max: 30 }).vacuous, true);
  assert.equal(stepGate(run([['baseline', 100], ['held 2', 110]]), {}).vacuous, true, 'no bound is vacuous too');
});
