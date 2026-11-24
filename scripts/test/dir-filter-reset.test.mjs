// dir-filter-reset.test.mjs — the SQ-146 gate (scripts/lib/dirFilterResetGate.mjs) on hand-built
// records shaped like scripts/directory-filter-probe.mjs's: a reset that leaves the filter's nodes
// and tags alone passes; a reset that replaces a node, replays the tags' entrance, re-enters the
// scroll thumb, folds the region or moves the list's place fails by name. thumbVerdict judges the
// scroll thumb's colour under each scheme: white passes, the old project-accent blue fails.
// Run: node --test scripts/test/dir-filter-reset.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, thumbVerdict, firstLoadVerdict } from '../lib/dirFilterResetGate.mjs';

const stamps = { root: 'root0', region: 'region0', tags: 'tags0' };
const frame = (t, over = {}) => ({
  t,
  root: 'root0',
  region: 'region0',
  tags: 'tags0',
  entering: 0,
  enteringSample: '',
  thumbMin: 1,
  open: true,
  ...over,
});
const still = Array.from({ length: 30 }, (_, i) => frame(i * 16));
const rec = (over = {}) => ({ id: 'clear-all', path: 'clear all', stamps, frames: still, list: null, ...over });

test('a reset that leaves the filter untouched passes', () => {
  const v = verdict(rec());
  assert.equal(v.pass, true, v.fails.join('; '));
});

test('a replaced filter node fails (the island remounted)', () => {
  const frames = still.map((f, i) => (i >= 3 ? { ...f, root: 'none', region: null } : f));
  const v = verdict(rec({ frames }));
  assert.equal(v.pass, false);
  assert.match(v.fails.join('\n'), /root node was replaced at 48ms/);
  assert.match(v.fails.join('\n'), /region node was replaced/);
});

test('a replayed tag entrance fails, naming the tag and the first frame', () => {
  const frames = still.map((f, i) =>
    i >= 2 && i < 20 ? { ...f, entering: 11, enteringSample: 'branding 0.3 translateX(-9px)' } : f
  );
  const v = verdict(rec({ frames }));
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /18 frames show a tag mid-entrance, from 32ms \(branding 0\.3/);
});

test('a scroll thumb that retracts and re-enters fails', () => {
  const frames = still.map((f, i) => (i === 5 ? { ...f, thumbMin: 0 } : f));
  const v = verdict(rec({ frames }));
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /scroll thumb re-entered at 80ms/);
});

test('a folded region fails', () => {
  const frames = still.map((f, i) => (i === 7 ? { ...f, open: false } : f));
  assert.equal(verdict(rec({ frames })).pass, false);
});

test('the list keeps its scroll place, clamped to what is left to scroll', () => {
  assert.equal(verdict(rec({ list: { before: 40, after: 40, max: 120 } })).pass, true);
  assert.equal(verdict(rec({ list: { before: 40, after: 25, max: 25 } })).pass, true);
  const v = verdict(rec({ list: { before: 40, after: 0, max: 120 } }));
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /scroll place moved: 40 -> 0/);
});

test('a run with too few frames or an unstamped node proves nothing', () => {
  assert.equal(verdict(rec({ frames: still.slice(0, 3) })).pass, false);
  assert.match(verdict(rec({ stamps: { ...stamps, tags: null } })).fails[0], /proves nothing/);
});

test('the first load keeps its entrance, the thumb scales in and rests', () => {
  const run = Array.from({ length: 40 }, (_, i) => frame(i * 16, { thumbMin: i < 10 ? 0 : Math.min(1, (i - 10) / 10) }));
  assert.equal(firstLoadVerdict(run).pass, true);
  // negative control: a thumb that is already at rest from the first frame shows no entrance
  const flat = Array.from({ length: 40 }, (_, i) => frame(i * 16));
  assert.match(firstLoadVerdict(flat).fails[0], /no entrance/);
  assert.equal(firstLoadVerdict([]).pass, false);
});

test('the selection must land where the reset says: ticked tags and the client chip', () => {
  const ok = { state: { ticked: ['album-art'], chip: false }, expect: { ticked: ['album-art'], chip: false } };
  assert.equal(verdict(rec(ok)).pass, true);
  const stale = verdict(rec({ ...ok, state: { ticked: ['branding', 'illustration'], chip: false } }));
  assert.equal(stale.pass, false);
  assert.match(stale.fails[0], /selection after the reset is \[branding,illustration\], not \[album-art\]/);
  const chip = verdict(rec({ ...ok, state: { ticked: ['album-art'], chip: true } }));
  assert.match(chip.fails[0], /client chip is still shown/);
});

test('a reset made from the menu fails while the menu stays open', () => {
  assert.equal(verdict(rec({ menu: { closedAfter: true } })).pass, true);
  const v = verdict(rec({ menu: { closedAfter: false } }));
  assert.equal(v.pass, false);
  assert.match(v.fails[0], /menu stayed open/);
});

test('the thumb is white under every scheme, over a darker track', () => {
  const white = 'rgb(255, 255, 255)';
  for (const scheme of ['black', 'blue', 'project', 'spectrum']) {
    const v = thumbVerdict({ scheme, thumb: white, track: 'rgba(0, 0, 0, 0)' });
    assert.equal(v.pass, true, `${scheme}: ${v.fails.join('; ')}`);
  }
  assert.equal(thumbVerdict({ scheme: 'blue', thumb: white, track: 'rgb(40, 40, 40)' }).pass, true);
});

test('negative control: the old accent-blue thumb and a track as light as the thumb fail', () => {
  const blue = thumbVerdict({ scheme: 'blue', thumb: 'rgb(0, 0, 255)', track: null });
  assert.equal(blue.pass, false);
  assert.match(blue.fails[0], /not white/);
  const track = thumbVerdict({ scheme: 'black', thumb: 'rgb(255, 255, 255)', track: 'rgb(230, 230, 230)' });
  assert.equal(track.pass, false);
  assert.match(track.fails[0], /not visibly darker/);
  assert.equal(thumbVerdict({ scheme: 'x', thumb: 'transparent', track: null }).pass, false);
});
