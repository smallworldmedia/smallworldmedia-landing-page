// SQ-92: the colour-scheme widget's pure logic (src/components/siteSchemeLogic.js), plus the
// two structural facts a unit test CAN pin about its skin: no literal colour but the swatches',
// and the mount order in BaseLayout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SCHEMES, SPECTRUM } from '../../src/lib/colorScheme.js';
import {
  stationOf,
  schemeAt,
  shouldPassWheel,
  GLOBE_STRIPS,
  splitSubpaths,
  stripFills,
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

const globeD = () => read('public/icons/swm-globe-mark.svg').match(/ d="([^"]+)"/)[1];

test('GLOBE_STRIPS names every cell of the globe mark once: twelve strips over its 34 cells', () => {
  const subs = splitSubpaths(globeD());
  assert.equal(subs.length, 35, 'the mark is its outline plus 34 cells; a redrawn mark needs a new strip table');
  assert.ok(subs.every((s) => s.startsWith('M')), 'every subpath starts at its own M');
  assert.equal(subs.join(''), globeD(), 'splitting loses nothing');
  assert.equal(GLOBE_STRIPS.length, 12);
  const cells = GLOBE_STRIPS.flat();
  assert.deepEqual(
    [...cells].sort((a, b) => a - b),
    Array.from({ length: 34 }, (_, i) => i + 1),
    'cells 1 to 34, each in exactly one strip, never the outline (0)'
  );
});

test('stripFills: one solid colour per strip; blue, red, green, yellow across the front, periwinkle on both edges', () => {
  const keys = Object.keys(SPECTRUM);
  assert.deepEqual(keys, ['blue', 'red', 'green', 'yellow', 'periwinkle']);
  const d = globeD();
  const subs = splitSubpaths(d);
  const fills = stripFills(d, keys);
  assert.deepEqual(
    fills.map((f) => f.key),
    keys,
    'one path per key, in key order'
  );
  const keyOf = (strip) => fills.find((f) => f.d.includes(subs[GLOBE_STRIPS[strip][0]])).key;
  // The six front strips, left to right.
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(keyOf), ['periwinkle', 'blue', 'red', 'green', 'yellow', 'periwinkle']);
  // A strip is one colour: all its cells sit in the same key's path, and in no other.
  GLOBE_STRIPS.forEach((cells, i) => {
    const key = keyOf(i);
    for (const c of cells) {
      for (const f of fills) assert.equal(f.d.includes(subs[c]), f.key === key, `cell ${c} is ${key} only`);
    }
  });
  // Round the globe, wrap included, no two neighbouring strips share a colour.
  GLOBE_STRIPS.forEach((_, i) => {
    assert.notEqual(keyOf(i), keyOf((i + 1) % GLOBE_STRIPS.length), `strips ${i} and ${i + 1} differ`);
  });
  assert.ok(!fills.some((f) => f.d.includes(subs[0])), 'the outline is never a fill');
  assert.equal(fills.reduce((n, f) => n + f.d.length, 0), d.length - subs[0].length, 'every cell is filled once');
});

test('stripFills follows the keys and the strips it is given; no keys gives no fills', () => {
  const d = 'M0 0ZM1 1ZM2 2ZM3 3Z';
  assert.deepEqual(stripFills(d, ['a', 'b'], [[1], [2], [3]]), [
    { key: 'a', d: 'M2 2Z' },
    { key: 'b', d: 'M1 1ZM3 3Z' },
  ]);
  assert.deepEqual(stripFills(d, ['only'], [[1, 2], [3]]), [{ key: 'only', d: 'M1 1ZM2 2ZM3 3Z' }]);
  assert.deepEqual(stripFills(d, [], [[1]]), []);
  assert.deepEqual(splitSubpaths(''), []);
  assert.deepEqual(splitSubpaths(undefined), []);
});

test('schemeParams: defaults, and ?schemeui ?schemeguard ?schemerows ?schemesize ?schemepitch', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.deepEqual(q(''), {
    ui: true,
    guardMs: 200,
    rows: 3,
    size: null,
    pitch: null,
    lift: null,
    near: null,
    far: null,
    inMs: null,
    outMs: null,
  });
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

test('schemeParams: the engaged look, ?schemelift ?schemenear ?schemefar ?schemein ?schemeout (null = the CSS default)', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.equal(q('schemelift=1.5').lift, 1.5);
  assert.equal(q('schemelift=0.5').lift, 1, 'under 1 would shrink the eye: clamps to no lift');
  assert.equal(q('schemelift=9').lift, 3);
  assert.equal(q('schemelift=x').lift, null);
  assert.equal(q('schemelift=').lift, null);
  assert.equal(q('schemenear=0.7').near, 0.7);
  assert.equal(q('schemenear=0').near, 0.2, 'a circle never vanishes');
  assert.equal(q('schemenear=5').near, 1, 'and never outgrows the large one');
  assert.equal(q('schemefar=0.5').far, 0.5);
  assert.equal(q('schemefar=-1').far, 0.2);
  assert.equal(q('schemefar=y').far, null);
  assert.equal(q('schemein=400').inMs, 400);
  assert.equal(q('schemein=0').inMs, 0, '0 is an instant entrance, not the default');
  assert.equal(q('schemein=-5').inMs, 0);
  assert.equal(q('schemein=99999').inMs, 5000);
  assert.equal(q('schemeout=120').outMs, 120);
  assert.equal(q('schemeout=z').outMs, null);
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
  assert.ok(/--scheme-seat:[\s\S]*?--pill-pad-y[\s\S]*?--lh-pill[\s\S]*?--space-6/.test(css), 'the seat clears the privacy pill at its desktop height, at every width');
  assert.ok(/z-index:\s*43/.test(css), 'z 43');
  assert.ok(/translate:[\s\S]*?--footer-reveal[\s\S]*?--footer-panel-h[\s\S]*?--scheme-seat/.test(css), 'rides above the rising links footer');
  assert.ok(/data-chrome-open/.test(css) && /data-menu-open/.test(css), 'yields to the overlays and the menu');
});

const skinCss = () => read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('SQ-101 anchor: one seat, bottom and right, at every width', () => {
  const css = skinCss();
  assert.equal(css.split('--scheme-seat:').length - 1, 1, 'the seat is declared once: no per-breakpoint seat');
  assert.ok(!/@media\s*\(max-width[^)]*\)\s*\{\s*\.swm-corner\s*\{[^}]*--scheme-seat/.test(css), 'no phone override of the seat');
  const wrapper = css.match(/\.swm-corner\s*\{[^}]*position:\s*fixed[^}]*\}/)?.[0] ?? '';
  assert.ok(/right:\s*var\(--chrome-right-inset\)/.test(wrapper), 'right inset is the shared chrome inset');
  assert.ok(/bottom:\s*var\(--scheme-seat\)/.test(wrapper), 'bottom is the one seat');
});

test('SQ-101 long press: no callout, selection, drag or image dialog on the widget or anything in it', () => {
  const css = skinCss();
  const rule = css.match(/\.swm-corner,\s*\.swm-corner \*\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/-webkit-touch-callout:\s*none/.test(rule), 'no touch callout');
  assert.ok(/(^|[\s;])user-select:\s*none/.test(rule) && /-webkit-user-select:\s*none/.test(rule), 'no selection');
  assert.ok(/-webkit-user-drag:\s*none/.test(rule), 'no drag');
  assert.ok(/\.swm-corner svg\s*\{\s*pointer-events:\s*none/.test(css), 'no svg is a hit target');
  const comp = read('src/components/SiteScheme.jsx');
  assert.ok(/onContextMenu=\{\(e\) => e\.preventDefault\(\)\}/.test(comp), 'contextmenu is cancelled on the widget');
  assert.ok(/onDragStart=\{\(e\) => e\.preventDefault\(\)\}/.test(comp), 'dragstart is cancelled on the widget');
  const sw = read('src/components/schemeSwatches.jsx');
  assert.equal(sw.split('draggable="false"').length - 1, 2, 'both svgs (the circle, the eye) are not draggable');
});

test('SQ-101 engaged look: the engine falloff ranks the circles, one --eye-t drives the entrance and exit', () => {
  const css = skinCss();
  assert.ok(!/--scale-sel:\s*1\s*;/.test(css) && !/--scale-sel-bump:\s*1\s*;/.test(css), 'the falloff is no longer forced off');
  assert.ok(/--scale-falloff:\s*2;/.test(css) && /--scale-falloff-hold:\s*0;/.test(css) && /--scale-falloff-exp:\s*1;/.test(css), 'a straight line over two stations');
  assert.ok(/--scale-sel:\s*calc\(2 \* max\(var\(--eye-near\), var\(--eye-far\)\) \/ var\(--eye-far\) - 1\)/.test(css), 'one out = near / far of the small');
  assert.ok(/--scale-sel-bump:\s*calc\(1 \/ \(var\(--eye-far\) \* var\(--scale-sel\)\)\)/.test(css), 'the lens = 1 / far of the small');
  assert.ok(/@property --eye-t\s*\{[^}]*<number>[^}]*inherits:\s*true/.test(css), '--eye-t is a registered, inherited number');
  assert.ok(/--eye-t var\(--eye-out\) var\(--ease-draw\)/.test(css) && /--eye-t var\(--eye-in\) var\(--ease-draw\)/.test(css), 'eased in and out on the house curve');
  assert.ok(/prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?transition:\s*z-index 0s;/.test(css), 'reduced motion is instant');
  assert.ok(/\.scheme-swatch\s*\{[^}]*--eye-lift[^}]*--eye-far/.test(css), 'the circle is drawn at the small size and lifts with the eye');
});

test('the eye: the globe path is read from the public file once, the lid shape has one source, the project face is the strips of the globe', () => {
  const sw = read('src/components/schemeSwatches.jsx');
  const globe = globeD();
  assert.ok(!sw.includes(globe.slice(0, 24)), 'the globe path data is not retyped');
  assert.ok(/swm-globe-mark\.svg\?raw/.test(sw), 'the path comes from the public file');
  assert.equal(sw.split('id="swm-eye-globe"').length - 1, 1, 'one <path> in one <defs>');
  assert.ok(/href="#swm-eye-globe"/.test(sw), 'every circle <use>s it');
  assert.ok(!/fe7701|orange|arcPoint|pieWedges|barSpans/i.test(sw), 'no wedge, pie, bar or orange face');
  assert.ok(/stripFills\(GLOBE_D, Object\.keys\(SPECTRUM\)\)/.test(sw), 'the project face colours the globe strip by strip');
  assert.ok(/className="scheme-eye__edge"[\s\S]*?clipPath="url\(#swm-eye-out\)"/.test(sw), 'the dark edge is clipped to the outside of the lids');
  const css = read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/mask-image:[\s\S]*?var\(--eye-lid-mask\)/.test(css), 'the window mask carries the lid opening');
  assert.ok(!/scheme-ring|scheme-halo/.test(css), 'the circular lens ring is gone');
});
