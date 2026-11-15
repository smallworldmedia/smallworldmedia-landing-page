// SQ-92: the colour-scheme widget's pure logic (src/components/siteSchemeLogic.js), plus the
// two structural facts a unit test CAN pin about its skin: no literal colour but the swatches',
// and the mount order in BaseLayout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SCHEMES, SPECTRUM_SHARES } from '../../src/lib/colorScheme.js';
import {
  stationOf,
  schemeAt,
  shouldPassWheel,
  pieWedges,
  arcPoint,
  schemeParams,
} from '../../src/components/siteSchemeLogic.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('stationOf and schemeAt map all four schemes both ways', () => {
  assert.deepEqual(SCHEMES, ['project', 'black', 'blue', 'spectrum']);
  SCHEMES.forEach((name, i) => {
    assert.equal(stationOf(name), i, `stationOf(${name})`);
    assert.equal(schemeAt(i), name, `schemeAt(${i})`);
    assert.equal(schemeAt(stationOf(name)), name);
  });
});

test('stationOf: an unknown name sits on the default (project) station', () => {
  assert.equal(stationOf('purple'), 0);
  assert.equal(stationOf(undefined), 0);
  assert.equal(stationOf(null), 0);
  assert.equal(stationOf(''), 0);
});

test('schemeAt wraps like the pager does, and junk falls to the default', () => {
  assert.equal(schemeAt(4), 'project');
  assert.equal(schemeAt(-1), 'spectrum');
  assert.equal(schemeAt(-5), 'spectrum');
  assert.equal(schemeAt(5), 'black');
  assert.equal(schemeAt(2.9), 'blue');
  assert.equal(schemeAt(NaN), 'project');
  assert.equal(schemeAt(undefined), 'project');
});

test('shouldPassWheel: passes while the last outside wheel is under guardMs old', () => {
  const last = 1000;
  assert.equal(shouldPassWheel(1000, last, 200), true, 'at 0 ms');
  assert.equal(shouldPassWheel(1199, last, 200), true, 'just under the guard');
  assert.equal(shouldPassWheel(1200, last, 200), false, 'at the guard');
  assert.equal(shouldPassWheel(1201, last, 200), false, 'just over the guard');
  assert.equal(shouldPassWheel(5000, last, 200), false, 'long after');
});

test('shouldPassWheel: a guard of 0 (or less, or junk) is off; no outside wheel yet never passes', () => {
  assert.equal(shouldPassWheel(1000, 1000, 0), false, '0 ms guard at 0 ms elapsed');
  assert.equal(shouldPassWheel(1001, 1000, 0), false);
  assert.equal(shouldPassWheel(1000, 1000, -50), false);
  assert.equal(shouldPassWheel(1000, 1000, NaN), false);
  assert.equal(shouldPassWheel(1000, -Infinity, 200), false, 'no outside wheel seen yet');
  assert.equal(shouldPassWheel(1000, undefined, 200), false);
});

test('pieWedges(SPECTRUM_SHARES): five wedges in the pinned order, contiguous, proportional, 0 to 360', () => {
  const w = pieWedges(SPECTRUM_SHARES);
  assert.deepEqual(
    w.map((x) => x.key),
    ['blue', 'red', 'green', 'yellow', 'periwinkle']
  );
  assert.equal(w[0].start, 0);
  assert.equal(w.at(-1).end, 360, 'the last wedge ends at exactly 360');
  for (let i = 1; i < w.length; i++) assert.equal(w[i].start, w[i - 1].end, `wedge ${i} starts where ${i - 1} ends`);
  const total = Object.values(SPECTRUM_SHARES).reduce((a, b) => a + b, 0);
  for (const x of w) {
    assert.ok(Math.abs(x.end - x.start - (SPECTRUM_SHARES[x.key] / total) * 360) < 1e-9, `${x.key} is proportional to its share`);
  }
  // The measured shares, restated: blue is the biggest wedge, periwinkle the smallest.
  const span = Object.fromEntries(w.map((x) => [x.key, x.end - x.start]));
  assert.ok(span.blue > span.red && span.red > span.green && span.green > span.yellow && span.yellow > span.periwinkle);
});

test('pieWedges follows the key order it is given, and arcPoint runs clockwise from 12 o\'clock', () => {
  const w = pieWedges({ a: 1, b: 1, c: 2 });
  assert.deepEqual(w, [
    { key: 'a', start: 0, end: 90 },
    { key: 'b', start: 90, end: 180 },
    { key: 'c', start: 180, end: 360 },
  ]);
  const near = (p, q) => Math.abs(p[0] - q[0]) < 1e-9 && Math.abs(p[1] - q[1]) < 1e-9;
  assert.ok(near(arcPoint(12, 12, 10, 0), [12, 2]), '0 deg is 12 o\'clock');
  assert.ok(near(arcPoint(12, 12, 10, 90), [22, 12]), '90 deg is 3 o\'clock');
  assert.ok(near(arcPoint(12, 12, 10, 180), [12, 22]), '180 deg is 6 o\'clock');
});

test('schemeParams: defaults, and ?schemeui ?schemeguard ?schemerows ?schemesize ?schemepitch', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.deepEqual(q(''), { ui: true, guardMs: 200, rows: 3, size: null, pitch: null });
  assert.equal(q('schemeui=0').ui, false);
  assert.equal(q('schemeui=1').ui, true);
  assert.equal(q('schemeguard=0').guardMs, 0);
  assert.equal(q('schemeguard=350').guardMs, 350);
  assert.equal(q('schemeguard=-5').guardMs, 0);
  assert.equal(q('schemeguard=abc').guardMs, 200);
  assert.equal(q('schemerows=5').rows, 5);
  assert.equal(q('schemerows=0').rows, 1);
  assert.equal(q('schemerows=99').rows, 9);
  assert.equal(q('schemerows=x').rows, 3);
  assert.equal(q('schemesize=40').size, 40);
  assert.equal(q('schemesize=0').size, null);
  assert.equal(q('schemesize=3').size, 8);
  assert.equal(q('schemepitch=56').pitch, 56);
  assert.equal(q('schemepitch=').pitch, null);
});

test('the swatch artwork is the only file in the widget that holds literal colours', () => {
  const hex = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;
  assert.ok(hex.test(read('src/components/schemeSwatches.jsx')), 'the swatch file carries the fills');
  for (const f of ['src/components/SiteScheme.jsx', 'src/components/siteSchemeLogic.js', 'src/styles/site-scheme.css']) {
    const src = read(f)
      .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
      .replace(/^\s*\/\/.*$/gm, ''); // line comments
    assert.ok(!hex.test(src), `${f} holds no literal colour`);
  }
  // spectrum's fills come from SPECTRUM, never retyped
  const sw = read('src/components/schemeSwatches.jsx');
  for (const fill of ['#1556e5', '#fd361a', '#077b3e', '#fbb702', '#a6bcda']) {
    assert.ok(!sw.toLowerCase().includes(fill), `${fill} is not retyped in the swatch file`);
  }
});

test('BaseLayout mounts the widget as a persisted island after the tagline and before #main, skin after the pager skin', () => {
  const b = read('src/layouts/BaseLayout.astro');
  const tagline = b.indexOf('transition:persist="site-tagline"');
  const widget = b.indexOf('<SiteScheme client:idle transition:persist="site-scheme"');
  const main = b.indexOf('<div id="main">');
  assert.ok(tagline > 0 && widget > tagline && main > widget, 'tagline < widget < #main');
  const pager = b.indexOf("import '../styles/pager-scale.css'");
  const skin = b.indexOf("import '../styles/site-scheme.css'");
  assert.ok(pager > 0 && skin > pager, 'site-scheme.css is imported after pager-scale.css');
});

test('the skin is scoped under .swm-corner, hides the text, and seats the lens above the privacy pill', () => {
  const css = read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = css
    .split('}')
    .map((b) => b.split('{')[0].trim())
    .filter((s) => s && !s.startsWith('@') && !/^\d+%$/.test(s));
  for (const group of selectors) {
    for (const sel of group.split(',').map((s) => s.trim())) {
      assert.ok(/(^|\s)(html\[[^\]]+\]\s+)?\.swm-corner/.test(sel), `scoped: ${sel}`);
    }
  }
  for (const part of ['num', 'peak', 'den', 'pointer', 'seam', 'hair']) {
    assert.ok(css.includes(`.fp-scale__${part}`), `${part} is handled`);
  }
  assert.ok(/--scheme-seat:[\s\S]*?--pill-pad-y[\s\S]*?--lh-link[\s\S]*?--space-6/.test(css), 'desktop seat clears the privacy pill');
  assert.ok(/z-index:\s*43/.test(css), 'z 43');
  assert.ok(/translate:[\s\S]*?--footer-reveal[\s\S]*?--footer-panel-h[\s\S]*?--scheme-seat/.test(css), 'rides above the rising links footer');
  assert.ok(/data-chrome-open/.test(css) && /data-menu-open/.test(css), 'yields to the overlays and the menu');
});
