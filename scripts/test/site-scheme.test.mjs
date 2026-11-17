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

test('schemeParams defaults and the ?schemeui ?schemeguard ?schemerows ?schemesize ?schemegap dials', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.deepEqual(q(''), {
    ui: true,
    guardMs: 200,
    rows: 6,
    size: null,
    gap: null,
    lift: null,
    pad: null,
    clear: null,
    shift: null,
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
  assert.equal(q('schemerows=99').rows, 12);
  assert.equal(q('schemerows=x').rows, 6);
  assert.equal(q('schemesize=40').size, 40);
  assert.equal(q('schemesize=0').size, null);
  assert.equal(q('schemesize=3').size, 8);
  // SQ-107 pass 5: ONE spacing dial, the edge-to-edge gap in px, at every width (replaces ?schemepitch)
  assert.equal(q('schemegap=12').gap, 12);
  assert.equal(q('schemegap=0').gap, 0, '0 is a touching gap, not the default');
  assert.equal(q('schemegap=99').gap, 60);
  assert.equal(q('schemegap=-4').gap, 0);
  assert.equal(q('schemegap=wide').gap, null);
  assert.equal(q('schemegap=').gap, null);
  assert.ok(!('pitch' in q('schemepitch=56')) && !('badge' in q('schemebadge=seat')), 'the retired dials are gone, not aliased');
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
  assert.ok(/--badge-cy-floor:\s*calc\(var\(--footer-bottom-inset\) \+ var\(--pill-pad-y\) \+ var\(--lh-pill\) \/ 2\)/.test(css) && /--badge-cy:\s*var\(--badge-cy-floor\)/.test(css), 'the one seat centres the badge on the privacy pill\'s line at its desktop height (the floor), above 768px');
  assert.ok(/z-index:\s*101/.test(css) && !/z-index:\s*43/.test(css), 'z 101: above the shell (100), so the route fill and the loader never cover it');
  const live = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/html\[data-chrome-open\]\s+\.swm-corner\s*\{/.test(live), 'yields to the overlays');
  // The phone menu's takeover is not a yield: it wipes over the badge (the pass 8 test below).
  assert.ok(!/data-menu-open/.test(live), 'no rule hides or delays the badge for the phone menu');
  assert.ok(!/--seat-t|--badge-ride|--eye-foot|--home-cy|--footer-reveal|--footer-panel-h|data-footer-rest/.test(live), 'the flush corner, the footer ride and the seat blend are deleted');
});

const skinCss = () => read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('SQ-107 pass 5 one seat, flush, the right edge is the viewport\'s on every route and the badge has no seat option', () => {
  const css = skinCss();
  const wrapper = css.match(/\.swm-corner\s*\{[^}]*position:\s*fixed[^}]*\}/)?.[0] ?? '';
  assert.ok(/right:\s*var\(--badge-pad\)/.test(wrapper), 'the eye is one padding in, so the badge\'s own padding takes its right edge to the viewport\'s: no inset, home included');
  assert.ok(/bottom:\s*var\(--scheme-bottom\)/.test(wrapper), 'bottom is the badge seat');
  assert.ok(!/--badge-inset|--home-inset|--nav-inset/.test(css), 'no inset token: pass 4\'s --nav-inset on home is replaced');
  assert.ok(!/data-badge|--scheme-seat|--badge-lift|--badge-rise|--badge-reach/.test(css), 'the seat option and the climb tokens are deleted');
  assert.ok(!/border-radius/.test(css.match(/::before\s*\{([^}]*)\}/)?.[1] ?? ''), 'every corner square, the right ones against the edge');
  for (const f of ['src/components/SiteScheme.jsx', 'src/components/siteSchemeLogic.js']) {
    assert.ok(!/schemebadge|BADGE_SEATS|dataset\.badge|data-badge/.test(read(f)), `${f} has no seat option`);
  }
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.ok(!('badge' in q('schemebadge=seat')), '?schemebadge is not read');
  const g = read('src/styles/global.css');
  assert.ok(!/data-badge/.test(g), 'and global.css keys nothing on it');
  const layout = read('src/layouts/BaseLayout.astro');
  assert.ok(!/data-badge|schemebadge/.test(layout), 'nor does the layout');
});

test('SQ-107 pass 3 ?schemepad is the one padding dial, clamped 0 to 40, null is the CSS default', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.equal(q('').pad, null);
  assert.equal(q('schemepad=8').pad, 8);
  assert.equal(q('schemepad=0').pad, 0);
  assert.equal(q('schemepad=99').pad, 40);
  assert.equal(q('schemepad=-3').pad, 0);
  assert.equal(q('schemepad=wide').pad, null);
});

test('SQ-107 pass 7 one seat sitewide, the footer rises behind the badge and does not carry it', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--scheme-bottom: calc\(var\(--badge-cy\) - var\(--scale-rows\) \* var\(--scheme-pitch\)\);/.test(flat), 'the wrapper\'s bottom follows the one seat');
  const wrapper = css.match(/\.swm-corner\s*\{[^}]*position:\s*fixed[^}]*\}/)?.[0] ?? '';
  assert.ok(!/translate:/.test(wrapper), 'the wrapper does not ride anything');
  assert.ok(!/@media \(min-width: 769px\)\s*\{\s*\.swm-corner\s*\{\s*--badge-cy/.test(css) && !/footer-rise/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), 'one number at every width and scroll stop: no easing onto the copyright line');
  const comp = read('src/components/SiteScheme.jsx');
  assert.ok(!/--seat-t|--seat-ease|data-footer-rest|corner\.animate/.test(comp), 'SiteScheme has no seat blend');
});

test('SQ-107 pass 9 on phones the badge is lifted clear of the screen corner (?schemeclear), never below the sitewide seat', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--badge-clear: 56px;/.test(flat), 'default 56: the 55 px display radius plus 1 (PROPOSED)');
  const phone = /@media \(max-width: 768px\) \{ \.swm-corner \{ --badge-cy: max\(var\(--badge-cy-floor\), calc\(var\(--badge-clear\) \+ var\(--badge-h\) \/ 2\)\); \} \}/;
  assert.ok(phone.test(flat), 'at <= 768px the lens centre is clear + half the badge height, floored at the sitewide seat');
  assert.equal(flat.split('--badge-clear)').length - 1, 1, 'the dial is read in the phone rule alone: above 768px the seat is the floor, byte for byte');
  assert.ok(!/viewport-fit|safe-area-inset/.test(flat), 'no safe-area reach: viewport-fit is not set');
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.equal(q('').clear, null, 'absent: the CSS default');
  assert.equal(q('schemeclear=48').clear, 48);
  assert.equal(q('schemeclear=0').clear, 0, '0 is today\'s seat (the max floor)');
  assert.equal(q('schemeclear=500').clear, 120);
  assert.equal(q('schemeclear=-9').clear, 0);
  assert.equal(q('schemeclear=high').clear, null);
  assert.ok(/--badge-clear',\s*`\$\{p\.clear\}px`/.test(read('src/components/SiteScheme.jsx')), 'SiteScheme writes the dial as a custom property on .swm-corner');
});

test('SQ-107 pass 10 the engaged eye steps left off the edge on /work\'s stagger taper, with a mirrored arrow (?schemeshift)', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  // The dial: one rest eye width by default, 0 = a straight column, ramped by the engage.
  assert.ok(/--eye-shift: var\(--eye-w\);/.test(flat), 'default S is one rest eye width (PROPOSED)');
  assert.ok(/--eye-s: calc\(var\(--eye-shift\) \* var\(--eye-t\)\);/.test(flat), 'S ramps with the engage: 0 at rest, full when deployed, on the one --eye-t');
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.equal(q('').shift, null, 'absent: the CSS default');
  assert.equal(q('schemeshift=20').shift, 20);
  assert.equal(q('schemeshift=0').shift, 0, '0 = the straight column of today');
  assert.equal(q('schemeshift=500').shift, 120);
  assert.equal(q('schemeshift=-4').shift, 0);
  assert.equal(q('schemeshift=far').shift, null);
  assert.ok(/--eye-shift',\s*`\$\{p\.shift\}px`/.test(read('src/components/SiteScheme.jsx')), 'SiteScheme writes the dial as a custom property on .swm-corner');
  // The taper is /work's own, never a copy: each circle moves left by --sw (pager-scale.css) x S, and the
  // tokens behind --sw (reach 3, exponent 2) are the ones global.css gives /work.
  assert.ok(/translate: calc\(-1 \* var\(--sw\) \* var\(--eye-s\)\) calc\(/.test(flat), 'each station steps left by the stagger taper --sw times the shift');
  const pager = read('src/styles/pager-scale.css');
  assert.ok(/--sw: pow\(clamp\(0, 1 - var\(--ndr\) \/ var\(--scale-slice-reach\), 1\), var\(--scale-slice-exp\)\);/.test(pager.replace(/\s+/g, ' ')), '--sw is /work\'s taper');
  const g = read('src/styles/global.css');
  assert.ok(/--scale-slice-reach: 3;/.test(g) && /--scale-slice-exp: 2;/.test(g), 'reach 3 and exponent 2: 1 at the lens, 0.444 one out, 0.111 two out');
  assert.ok(!/--scale-slice-(reach|exp)/.test(css), 'the skin defines no taper of its own');
  assert.ok(/\.fp-scale__chip \{ height: var\(--scale-num-h\); translate: calc\(-1 \* var\(--eye-s\)\) 0; \}/.test(flat), 'the lids, the iris, the focus ring and the arrow ride the selected eye left');
  // The badge widens LEFT: its right edge holds, its left edge follows the shifted eye.
  assert.ok(/left: calc\(-1 \* var\(--badge-pad\) - var\(--eye-s\) \* \(1 \+ 1 \/ var\(--eye-lift\)\) \/ 2\);/.test(flat), 'the badge box is drawn left of the eye by half the shift again');
  assert.ok(/width: calc\(var\(--badge-w\) \+ var\(--eye-s\) \/ var\(--eye-lift\)\);/.test(flat), 'and wider by the shift, before the lift');
  // The press surface reaches left by S, and the window is wide enough for the shifted circles.
  assert.ok(/\[data-open\]::after \{[^}]*left: calc\(min\(.*\) - var\(--eye-s\)\);/.test(flat), 'a finger over the shifted eyes keeps the scrub');
  assert.ok(/\.fp-scale__window \{[^}]*left: calc\(\(var\(--eye-w\) - var\(--eye-wide\)\) \/ 2 - var\(--eye-shift\)\);[^}]*width: calc\(var\(--eye-wide\) \+ var\(--eye-shift\)\);/.test(flat), 'the window is as wide as the shift');
  assert.ok(/\.fp-scale__stations \{ left: var\(--eye-shift\); width: var\(--eye-wide\); \}/.test(flat), 'and the stations sit where they did');
  // The arrow: /work's pointer, mirrored to point LEFT, on the lids' ink, never display:none.
  const ptr = flat.match(/\.fp-scale__pointer \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/border-right: 0\.571rem solid var\(--color-white\)/.test(ptr) && /border-left: 0 solid transparent/.test(ptr), 'a triangle with its point on the left, /work\'s 0.571rem wide, in the lid ink');
  assert.ok(/transform: none/.test(ptr), 'no flipper-spring deflection: it stays on the lens line');
  assert.ok(!/\.fp-scale__pointer[^{]*\{[^}]*display: none/.test(flat) && !/\.fp-scale__pointer,/.test(flat), 'the arrow is not hidden any more');
  const work = pager.replace(/\s+/g, ' ');
  assert.ok(/border-left: 0\.571rem solid currentColor;/.test(work) && /border-top: 0\.429rem solid transparent;/.test(work), '/work\'s own pointer is untouched');
});

test('SQ-107 pass 5 baked dials, Nathan\'s 18 / 4 / 1.5 / 0.8 / 0.5 and 260 / 200 are the CSS defaults', () => {
  const css = skinCss();
  for (const [prop, value] of [['--scheme-swatch', '18px'], ['--badge-pad', '4px'], ['--eye-engaged', '1.5'], ['--eye-near', '0.8'], ['--eye-far', '0.5'], ['--eye-in', '260ms'], ['--eye-out', '200ms']]) {
    assert.ok(new RegExp(`${prop}:\\s*${value.replace('.', '\\.')};`).test(css), `${prop} ${value}`);
  }
  // the five dials stay readable
  const q = (s) => schemeParams(new URLSearchParams(s));
  const p = q('schemesize=20&schemepad=6&schemelift=1.6&schemenear=0.7&schemefar=0.4');
  assert.deepEqual([p.size, p.pad, p.lift, p.near, p.far], [20, 6, 1.6, 0.7, 0.4]);
  // the spacing is ONE dial: the pitch is both radii plus the edge-to-edge gap, nothing else
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--scheme-gap: 10px;/.test(flat), 'the PROPOSED gap, 10 px');
  assert.ok(/--scheme-pitch: calc\(var\(--scheme-swatch\) \* var\(--eye-engaged\) \* \(1 \+ max\(var\(--eye-near\), var\(--eye-far\)\)\) \/ 2 \+ var\(--scheme-gap\)\);/.test(flat), 'pitch = the lens radius + the near radius + the gap');
  assert.ok(/--scale-pitch: var\(--scheme-pitch\);/.test(flat), 'the engine reads it');
});

test('SQ-107 the badge: a rectangle hugging the eye with equal padding, one component with it, a window onto the strip of three panels, never opacity', () => {
  const css = skinCss();
  assert.ok(/--badge-pad:\s*4px/.test(css), 'Nathan\'s padding, 4 px');
  assert.ok(/--badge-w:\s*calc\(var\(--eye-w\) \+ 2 \* var\(--badge-pad\)\)/.test(css) && /--badge-h:\s*calc\(var\(--eye-h\) \+ 2 \* var\(--badge-pad\)\)/.test(css), 'the eye plus the padding each side, no size knob of its own');
  const tile = css.match(/\.swm-corner\[data-ready\] \.fp-scale\.swm-corner__pager::before\s*\{([^}]*)\}/)?.[1] ?? '';
  // Pass 10 widens it LEFT by the shift (--eye-s is 0 at rest, so the rest box is the eye plus the padding each side).
  assert.ok(/width:\s*calc\(var\(--badge-w\) \+ var\(--eye-s\) \/ var\(--eye-lift\)\)/.test(tile) && /height:\s*var\(--badge-h\)/.test(tile), 'width and height from the eye');
  assert.ok(/left:\s*calc\(-1 \* var\(--badge-pad\) - var\(--eye-s\) \*/.test(tile) && /top:\s*calc\(-1 \* var\(--badge-pad\)\)/.test(tile), 'the same padding on every side of the eye\'s box');
  assert.ok(/scale:\s*var\(--eye-lift\)/.test(tile) && /transform-origin:\s*50% 50%/.test(tile), 'it grows with the eye, on the one --eye-t, about its own centre');
  assert.ok(!/border-radius/.test(tile), 'square corners');
  assert.ok(/(^|[\s;{])translate:\s*calc\(\(1 - var\(--eye-lift\)\) \* \(var\(--eye-w\) \/ 2 \+ var\(--badge-pad\)\)\) 0;/.test(css), 'ONE anchor: the pager moves in x only, so the badge\'s right edge at its vertical centre holds and nothing climbs');
  assert.ok(/background-image:\s*linear-gradient\(\s*to bottom,\s*var\(--badge-glass\) 0 33\.3333%,\s*var\(--color-black\) 33\.3333% 66\.6667%,\s*var\(--color-electric-blue\) 66\.6667% 100%\s*\)/.test(tile), 'the strip: project glass, black, blue, in SCHEMES order, hard stops');
  assert.ok(/background-size:\s*100% calc\(3 \* var\(--badge-h\)\)/.test(tile) && /background-repeat:\s*repeat-y/.test(tile), 'three badge heights tall, repeating, so the wrap is the strip\'s own');
  assert.ok(/background-position:\s*0 calc\(-1 \* var\(--scale-qf, var\(--scale-cur\)\) \* var\(--badge-h\)\)/.test(tile), 'locked to the engine\'s continuous column position, one detent = one badge height');
  assert.ok(!/--scheme-page|--badge-solid|color-mix/.test(tile), 'no crossfade and never the current scheme\'s page colour');
  assert.ok(!/--badge-solid/.test(css), 'the --badge-solid crossfade is removed');
  assert.ok(/backdrop-filter:\s*blur\(var\(--badge-blur\)\)/.test(tile), 'the glass panel blurs what is behind it');
  assert.ok(!/(^|[\s;])opacity:/.test(tile), 'the tile never fades with opacity (below 1 the blur shows the sharp original): the alpha is the glass colour\'s');
  assert.ok(/round\(var\(--scale-qf, var\(--scale-cur\)\), 1\)/.test(css), 'reduced motion snaps the strip to the whole detent');
});

test('SQ-107 pass 5 nothing is cut by a straight edge, the window carries no mask and each circle fades by its own distance', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const win = css.match(/\.fp-scale__window\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/--eye-wide:\s*calc\(var\(--eye-w\) \* max\(1, var\(--eye-engaged\)\)\)/.test(win), 'sized for --eye-engaged, so no lift up to the 3 cap is clipped');
  assert.ok(/mask-image:\s*none/.test(win) && /-webkit-mask-image:\s*none/.test(win), 'the pager\'s feather mask and the iris-band masks are gone: a circle in transit was cut flat where it crossed them (the cut top circle)');
  assert.ok(!/eye-edge|eye-feather|eye-reach|eye-lid-mask/.test(css), 'no band, feather, reach or lid mask left anywhere in the skin (the one gradient is the badge\'s background strip, not a mask)');
  const station = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__station\s*\{([^}]*)\}/)?.[1] ?? '';
  const st = station.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--eye-delay: calc\(var\(--eye-stagger\) \* clamp\(0, calc\(var\(--ndr\) - 1\), 1\)\);/.test(st), 'the far circle (two stations out) starts later; the lens and the near circle (one out) start together');
  assert.ok(/--eye-p: clamp\(0, calc\(\(var\(--eye-t\) - var\(--eye-delay\)\) \/ \(1 - var\(--eye-delay\)\)\), 1\);/.test(st), 'its own progress on the one --eye-t: it ends WITH the entrance, so the exit runs it back');
  assert.ok(/opacity: calc\(var\(--eye-p\) \* var\(--eye-up\) \* var\(--eye-down\)\);/.test(st), 'opacity: entrance progress x the fade above x the fade below');
  assert.ok(!/--eye-foot|--badge-ride/.test(css), 'no footer ride, so no fade for it');
  assert.ok(/--eye-stagger:\s*0\.4;/.test(css), 'the stagger, a share of the entrance');
  assert.ok(/--eye-hit-up:\s*2\.5;/.test(css) && /--eye-hit-down:\s*1\.5;/.test(css), 'the press target reaches the shown column');
  assert.ok(/--eye-t var\(--eye-in\) var\(--ease-draw\)/.test(flat), 'on the existing timing: --eye-in, --eye-out, no overshoot');
  const pager = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(!/--badge-lift|--badge-rise/.test(pager), 'no climb');
});

test('SQ-107 pass 5 one spacing dial at every width, GraticulePager takes cssPitch and /work keeps its pitch', () => {
  const pager = read('src/components/work/pager/GraticulePager.jsx');
  assert.ok(/cssPitch = false/.test(pager), 'an opt-in prop, off by default');
  assert.ok(/const mobileTier = \(\) => !cssPitch && inMobileTier\(\);/.test(pager), 'the <=768 tier reads as off under cssPitch, and only that');
  assert.ok(/detentDial \?\? \(mobileTier\(\) \? SCALE_PITCH_MOBILE_PX : deskPitch\)/.test(pager) && /mobileTier\(\) \|\| detentDial !== null/.test(pager), 'the engine\'s detent and the inline --scale-pitch follow it (the expressions /work\'s tests pin are unchanged)');
  const comp = read('src/components/SiteScheme.jsx');
  assert.ok(/<GraticulePager[\s\S]*?cssPitch[\s\S]*?\/>/.test(comp), 'the corner widget opts in');
  assert.ok(/--scheme-gap/.test(comp) && /p\.gap/.test(comp), '?schemegap lands on the one gap token');
  const work = read('src/components/work/FeaturedProjects.jsx');
  assert.ok(!/cssPitch/.test(work), '/work passes no such prop');
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

test('SQ-101 engaged look, the engine falloff ranks the circles, one --eye-t drives the entrance and exit', () => {
  const css = skinCss();
  assert.ok(!/--scale-sel:\s*1\s*;/.test(css) && !/--scale-sel-bump:\s*1\s*;/.test(css), 'the falloff is no longer forced off');
  assert.ok(/--scale-falloff:\s*2;/.test(css) && /--scale-falloff-hold:\s*0;/.test(css) && /--scale-falloff-exp:\s*1;/.test(css), 'a straight line over two stations');
  assert.ok(/--scale-sel:\s*calc\(2 \* max\(var\(--eye-near\), var\(--eye-far\)\) \/ var\(--eye-far\) - 1\)/.test(css), 'one out = near / far of the small');
  assert.ok(/--scale-sel-bump:\s*calc\(1 \/ \(var\(--eye-far\) \* var\(--scale-sel\)\)\)/.test(css), 'the lens = 1 / far of the small');
  assert.ok(/@property --eye-t\s*\{[^}]*<number>[^}]*inherits:\s*true/.test(css), '--eye-t is a registered, inherited number');
  assert.ok(/--eye-t var\(--eye-out\) var\(--ease-draw\)/.test(css) && /--eye-t var\(--eye-in\) var\(--ease-draw\)/.test(css), 'eased in and out on the house curve');
  assert.ok(/prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?transition:\s*z-index 0s;/.test(css), 'reduced motion is instant');
  assert.ok(/\.scheme-swatch\s*\{[^}]*calc\(var\(--scheme-swatch\) \* var\(--eye-lift\)\)/.test(css) && !/\.scheme-swatch\s*\{[^}]*--eye-far/.test(css), 'the circle is drawn at the LARGE size and lifts with the eye (SQ-107 jitter: never scaled up from a small, pixel-snapped svg)');
  assert.ok(/\.fp-scale__station\s*\{[^}]*transform:\s*scale\(calc\(var\(--sel\) \* var\(--eye-far\)\)\)/.test(css), 'the row only ever scales the large circle down');
});

test('the eye, the globe path is read from the public file once, the project face is the strips of the globe', () => {
  const sw = read('src/components/schemeSwatches.jsx');
  const globe = globeD();
  assert.ok(!sw.includes(globe.slice(0, 24)), 'the globe path data is not retyped');
  assert.ok(/swm-globe-mark\.svg\?raw/.test(sw), 'the path comes from the public file');
  assert.equal(sw.split('id="swm-eye-globe"').length - 1, 1, 'one <path> in one <defs>');
  assert.ok(/href="#swm-eye-globe"/.test(sw), 'every circle <use>s it');
  assert.ok(!/fe7701|orange|arcPoint|pieWedges|barSpans/i.test(sw), 'no wedge, pie, bar or orange face');
  assert.ok(/stripFills\(GLOBE_D, Object\.keys\(SPECTRUM\)\)/.test(sw), 'the project face colours the globe strip by strip');
  assert.ok(!/scheme-eye__edge|swm-eye-out/.test(sw), 'no dark edge, no outline stroke round the eye (Nathan 11-16)');
  assert.ok(!/scheme-eye__edge/.test(read('src/styles/site-scheme.css')), 'and no rule for one');
  assert.ok(!/EYE_LID_MASK/.test(sw) && !/EYE_LID_MASK|eye-lid-mask/.test(read('src/components/SiteScheme.jsx')), 'the lid mask has no source any more: nothing is masked');
  const css = read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/scheme-ring|scheme-halo/.test(css), 'the circular lens ring is gone');
});

test('SQ-107 the flush badge owns the lower-right corner, above 768px the privacy pill and the footer link keep-out move left of it', () => {
  const g = read('src/styles/global.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const reserve = /--badge-reserve:\s*calc\(([^;]+)\);/.exec(g);
  assert.ok(reserve, 'the badge reserve is a root token');
  const skin = skinCss();
  const swatch = /--scheme-swatch:\s*([\d.]+(?:rem|px))/.exec(skin)?.[1];
  assert.ok(swatch && reserve[1].startsWith(`${swatch} * 48 / 26`), 'the reserve is built from the skin default swatch (one number, two files)');
  const pad = /--badge-pad:\s*([\d.]+px)/.exec(skin)?.[1];
  assert.ok(pad && reserve[1].endsWith(`2 * ${pad}`), 'and its padding');
  assert.ok(/--eye-w:\s*calc\(var\(--scheme-swatch\)\s*\*\s*48\s*\/\s*26\)/.test(skin), 'and the eye width the skin derives from it');
  const seat = 'html:has\\(\\.swm-corner\\)';
  const m = new RegExp(`@media \\(min-width: 769px\\)\\s*\\{\\s*${seat}\\s*\\{\\s*--privacy-clearance:[^}]*--badge-reserve[^}]*\\}\\s*${seat}\\s+\\.site-privacy\\s*\\{\\s*right:[^}]*--chrome-right-inset[^}]*--badge-reserve[^}]*\\}`).exec(g);
  assert.ok(m, 'desktop only, keyed on the widget\'s presence so it holds before hydration');
});

test('SQ-107 pass 7 the badge persists across a page change, above the passage fill and the loader', () => {
  const css = skinCss();
  const wrapper = css.match(/\.swm-corner\s*\{[^}]*position:\s*fixed[^}]*\}/)?.[0] ?? '';
  assert.ok(/z-index:\s*101/.test(wrapper), 'one level above the shell\'s z 100, which holds RouteFill as its first child');
  const g = read('src/styles/global.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.site-shell\s*\{[^}]*z-index:\s*100/.test(g), 'the shell is the z 100 stacking context the claim rests on');
  const live = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/html\[data-chrome-open\]\s+\.swm-corner\s*\{[^}]*visibility:\s*hidden/.test(live), 'the drawer, the privacy notice and the inquiry overlay still take it');
  assert.ok(!/visibility 0s linear 0\.35s/.test(live), 'the 0.35 s visibility delay on a phone is gone with the hide it served');
});

test('SQ-107 pass 8 the phone menu wipes over the badge and never hides it, the takeover seated one level above', () => {
  const css = skinCss();
  const g = read('src/styles/global.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const badgeZ = Number(/\.swm-corner\s*\{[^}]*z-index:\s*(\d+)/.exec(css)?.[1]);
  const hostZ = Number(/\.site-menu-host\s*\{[^}]*z-index:\s*(\d+)/.exec(g)?.[1]);
  const shellZ = Number(/\.site-shell\s*\{[^}]*z-index:\s*(\d+)/.exec(g)?.[1]);
  assert.ok(shellZ < badgeZ && badgeZ < hostZ, `shell ${shellZ} < badge ${badgeZ} < menu host ${hostZ}: RouteFill under the badge, the takeover over it`);
  assert.ok(/\.site-menu-host\s*\{[^}]*position:\s*fixed[^}]*pointer-events:\s*none/.test(g), 'the host is a fixed click-through box');
  assert.ok(!/data-menu-open/.test(css) && !/visibility 0s linear 0\.35s/.test(css), 'no menu rule in the badge skin: no visibility hide, no delay');
  // SiteShell renders the host OUTSIDE the shell div (a sibling in the persisted island); SiteNav portals there.
  const shell = read('src/components/SiteShell.jsx');
  const shellDiv = shell.indexOf('<div className="site-shell"');
  const hostDiv = shell.indexOf('<div className="site-menu-host"');
  assert.ok(shellDiv > 0 && hostDiv > shellDiv, 'the host follows the shell');
  assert.ok(/<\/div>\s*\{\/\*[\s\S]*?\*\/\}\s*<div className="site-menu-host" \/>/.test(shell), 'and sits outside it, not among its children');
  const nav = read('src/components/SiteNav.jsx');
  assert.ok(/setShellEl\(document\.querySelector\('\.site-menu-host'\)\)/.test(nav), 'the takeover is portaled into the host');
  assert.ok(!/querySelector\('\.site-shell'\)/.test(nav), 'no longer into the shell');
  // The swatches are unreachable under the takeover: inert from the open to the landed wipe out.
  assert.ok(/setAttribute\('inert', ''\)/.test(nav) && /removeAttribute\('inert'\)/.test(nav), 'the badge is inert while the menu is up');
  assert.ok(/wipeOut\(menu\)\.call\(/.test(nav) && /if \(!cancelled\)/.test(nav), 'released when the wipe out has landed, unless the menu reopened');
});

test('SQ-107 pass 4 the jitter root cause, the circle is drawn at the large size and its row only scales it down', () => {
  const css = skinCss();
  const swatch = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.scheme-swatch\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/width:\s*calc\(var\(--scheme-swatch\) \* var\(--eye-lift\)\)/.test(swatch) && /height:\s*calc\(var\(--scheme-swatch\) \* var\(--eye-lift\)\)/.test(swatch), 'drawn at the lifted iris size, so an svg root\'s pixel snap is not multiplied by a scale-up');
  const station = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__station\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/transform:\s*scale\(calc\(var\(--sel\) \* var\(--eye-far\)\)\)/.test(station), 'the row scale is --sel x --eye-far (at most 1 for the lens)');
});

test('SQ-107 pass 5 the left jolt root cause, the strip carries no compositing hint so the eye and its column share one raster path', () => {
  const pagerScale = read('src/styles/pager-scale.css');
  assert.ok(/\.fp-scale__scale\s*\{[^}]*will-change:\s*transform/.test(pagerScale), '/work\'s pager still hints the strip, which is what put the column on its own compositor layer');
  const skin = skinCss().match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__scale\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/will-change:\s*auto/.test(skin), 'the widget turns the hint off: a layer is rastered about a pixel off the rest iris under it, the step at the hand-over');
  assert.ok(!/will-change:\s*transform/.test(skinCss()), 'and nothing else in the skin puts the iris or the column on a layer of its own');
});
