// SQ-131: the /work return-restore's first-frame gate (scripts/lib/restoreFlashGate.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { astroProps, mediaTokens, restoreFlashVerdict } from '../lib/restoreFlashGate.mjs';

const HASH = 'a'.repeat(40);
const coco = {
  clientName: 'COCO',
  hero: { playbackId: 'Coco0123456789playback', imageUrl: null },
  showcase: [{ imageUrl: `https://cdn.sanity.io/images/b60h4u7o/production/${HASH}-1920x1080.jpg` }],
};

test('mediaTokens: Mux playback ids and Sanity asset hashes', () => {
  assert.deepEqual(mediaTokens(coco).sort(), ['Coco0123456789playback', HASH].sort());
});

test('astroProps: decodes the island serialization', () => {
  const raw = { worlds: [1, [[0, { clientName: [0, 'COCO'], tags: [1, [[0, 'a']]], hero: [0, null] }]]] };
  assert.deepEqual(astroProps(raw), { worlds: [{ clientName: 'COCO', tags: ['a'], hero: null }] });
});

const restored = {
  expect: 'ROSSI',
  forbid: 'COCO',
  forbidTokens: mediaTokens(coco),
  frames: [{ cards: [] }, { cards: [] }, { cards: ['ROSSI'] }, { cards: ['ROSSI'] }],
  requests: ['https://image.mux.com/Rossi9876543210playback/thumbnail.webp'],
};

test('a return whose first card is the World left passes', () => {
  assert.deepEqual(restoreFlashVerdict(restored), { pass: true, fails: [] });
});

test('negative control: a COCO frame before the restored card fails', () => {
  const v = restoreFlashVerdict({ ...restored, frames: [{ cards: ['COCO'] }, ...restored.frames] });
  assert.equal(v.pass, false);
  assert.match(v.fails.join(), /first card shown COCO/);
  assert.match(v.fails.join(), /1 frame\(s\) showed COCO/);
});

test('negative control: a COCO media request fails even with no COCO frame', () => {
  const v = restoreFlashVerdict({ ...restored, requests: [`https://stream.mux.com/Coco0123456789playback.m3u8`] });
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /1 COCO media request/);
});

test('a COCO card under the full passage cover never showed', () => {
  const v = restoreFlashVerdict({ ...restored, frames: [{ cards: ['COCO'], covered: true }, ...restored.frames] });
  assert.equal(v.pass, true);
});

test('no card ever shown fails', () => {
  assert.equal(restoreFlashVerdict({ ...restored, frames: [{ cards: [] }] }).pass, false);
});

test('boundary: a cold load expects the first World and forbids nothing', () => {
  const v = restoreFlashVerdict({ expect: 'COCO', forbid: 'COCO', frames: [{ cards: ['COCO'] }], requests: coco.showcase.map((s) => s.imageUrl), forbidTokens: mediaTokens(coco) });
  assert.equal(v.pass, true);
});
