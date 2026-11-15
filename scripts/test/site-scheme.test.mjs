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
  barSpans,
  schemeParams,
} from '../../src/components/siteSchemeLogic.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('stationOf and schemeAt map the three active schemes both ways', () => {
  assert.deepEqual(SCHEMES, ['project', 'black', 'blue']);
  SCHEMES.forEach((name, i) => {
    assert.equal(stationOf(name), i, `stationOf(${name})`);
    assert.equal(schemeAt(i), name, `schemeAt(${i})`);
    assert.equal(schemeAt(stationOf(name)), name);
  });
});

test('stationOf: an unknown or parked name sits on the default (project) station', () => {
  assert.equal(stationOf('spectrum'), 0, 'a ?scheme=spectrum preview leaves the widget on project');
  assert.equal(stationOf('purple'), 0);
  assert.equal(stationOf(undefined), 0);
  assert.equal(stationOf(null), 0);
  assert.equal(stationOf(''), 0);
});

test('schemeAt wraps like the pager does, and junk falls to the default', () => {
  assert.equal(schemeAt(3), 'project');
  assert.equal(schemeAt(-1), 'blue');
  assert.equal(schemeAt(-4), 'blue');
  assert.equal(schemeAt(4), 'black');
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

test('barSpans(SPECTRUM_SHARES, 0, 26): five bars in key order, contiguous, proportional, ending at exactly 26', () => {
  const b = barSpans(SPECTRUM_SHARES, 0, 26);
  assert.deepEqual(
    b.map((x) => x.key),
    ['blue', 'red', 'green', 'yellow', 'periwinkle']
  );
  assert.equal(b[0].x, 0);
  const end = (x) => x.x + x.w;
  assert.equal(end(b.at(-1)), 26, 'the last bar ends at exactly x0 + width');
  for (let i = 1; i < b.length; i++) assert.equal(b[i].x, end(b[i - 1]), `bar ${i} starts where ${i - 1} ends`);
  const total = Object.values(SPECTRUM_SHARES).reduce((a, v) => a + v, 0);
  for (const x of b) {
    assert.ok(Math.abs(x.w - (SPECTRUM_SHARES[x.key] / total) * 26) < 1e-9, `${x.key} is as wide as its share`);
  }
  // The measured shares, restated: blue is the widest bar, periwinkle the narrowest.
  const w = Object.fromEntries(b.map((x) => [x.key, x.w]));
  assert.ok(w.blue > w.red && w.red > w.green && w.green > w.yellow && w.yellow > w.periwinkle);
});

test('barSpans follows the key order and the origin it is given; a one-key input fills the width', () => {
  assert.deepEqual(barSpans({ a: 1, b: 1, c: 2 }, 10, 40), [
    { key: 'a', x: 10, w: 10 },
    { key: 'b', x: 20, w: 10 },
    { key: 'c', x: 30, w: 20 },
  ]);
  assert.deepEqual(barSpans({ only: 3 }, 5, 26), [{ key: 'only', x: 5, w: 26 }]);
  assert.deepEqual(barSpans({}, 0, 26), []);
  // Float drift never leaves a sliver: thirds of 26 still end at exactly 26.
  const t = barSpans({ a: 1, b: 1, c: 1 }, 0, 26);
  assert.equal(t.at(-1).x + t.at(-1).w, 26);
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

test('the eye: the globe path is read from the public file once, the lid shape has one source, the faces carry no orange or pie', () => {
  const sw = read('src/components/schemeSwatches.jsx');
  const globe = read('public/icons/swm-globe-mark.svg').match(/ d="([^"]+)"/)[1];
  assert.ok(!sw.includes(globe.slice(0, 24)), 'the globe path data is not retyped');
  assert.ok(/swm-globe-mark\.svg\?raw/.test(sw), 'the path comes from the public file');
  assert.equal(sw.split('id="swm-eye-globe"').length - 1, 1, 'one <path> in one <defs>');
  assert.ok(/href="#swm-eye-globe"/.test(sw), 'every circle <use>s it');
  assert.ok(!/fe7701|orange|arcPoint|pieWedges/i.test(sw), 'no wedge, pie or orange face');
  assert.ok(/barSpans\(SPECTRUM_SHARES/.test(sw), 'the project face is vertical bars in the share order');
  const css = read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/mask-image:[\s\S]*?var\(--eye-lid-mask\)/.test(css), 'the window mask carries the lid opening');
  assert.ok(!/scheme-ring|scheme-halo/.test(css), 'the circular lens ring is gone');
});
