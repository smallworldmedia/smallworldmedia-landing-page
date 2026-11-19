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
  eyeDelays,
  eyeGeometry,
  cssMs,
  LIDS,
  LIDS_MIN,
  IRIS_UNITS,
  LID_STROKE,
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
    blurbGap: null,
    down: null,
    near: null,
    far: null,
    inMs: null,
    outMs: null,
    slideMs: null,
    growMs: null,
    stepMs: null,
    lids: null,
    glass: null,
    black: null,
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
  assert.ok(!/--badge-inset|--home-inset/.test(css), 'no inset token: pass 4\'s --nav-inset on home is replaced');
  // SQ-121: the desktop seat reads --nav-inset once, to size the blurb it clears (global.css's own expression); the badge never insets by it.
  assert.equal(css.split('--nav-inset').length - 1, 1, '--nav-inset is read only in --seat-blurb-fill');
  assert.ok(/--seat-blurb-fill:[^;]*--nav-inset/.test(css.replace(/\s+/g, ' ')), 'and that read is the blurb size\'s fill (the size that fills the measure)');
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
  assert.ok(!/footer-rise|--footer-reveal|--footer-panel-h/.test(css), 'one seat at every scroll stop: nothing eases it with the footer (SQ-121: above 768px its height is the blurb\'s, a function of the width alone)');
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
  assert.ok(/--eye-shift: calc\(var\(--scheme-swatch\) \* 48 \/ 26\);/.test(flat), 'default S is pass 10\'s 48 swatch units whatever the lids\' scale (the eye box grew with the lids in pass 11, the shift did not move)');
  assert.ok(/--eye-s: calc\(var\(--eye-shift\) \* var\(--eye-ts\)\);/.test(flat), 'S ramps with the SLIDE: 0 at rest, full when the slide has ended, on --eye-ts (pass 11: the slide is its own progress)');
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
  assert.ok(/translate: calc\(-1 \* var\(--eye-sx\) \* var\(--eye-s\)\) calc\(/.test(flat), 'each station steps left by the stagger taper times the shift');
  assert.ok(/--eye-sx: var\(--sw\);/.test(flat), 'the taper is the circle\'s own --sw the whole way through its slide: straight up and down (Nathan 11-17), never eased in from the centre eye\'s x');
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
  assert.ok(/\.fp-scale__window \{[^}]*left: calc\(\(var\(--eye-w\) - var\(--eye-wide\)\) \/ 2 - var\(--eye-shift\) - var\(--eye-bleed\)\);[^}]*width: calc\(var\(--eye-wide\) \+ var\(--eye-shift\) \+ 2 \* var\(--eye-bleed\)\);/.test(flat), 'the window is as wide as the shift, and bleeds a lifted padding each side for the circles\' badges (SQ-116)');
  assert.ok(/--eye-bleed: calc\(var\(--eye-engaged\) \* var\(--badge-pad\)\);/.test(flat), 'the bleed is the lifted padding');
  assert.ok(/\.fp-scale__stations \{ left: calc\(var\(--eye-shift\) \+ var\(--eye-bleed\)\); width: var\(--eye-wide\); \}/.test(flat), 'and the stations sit where they did');
  // The arrow: /work's pointer, mirrored to point LEFT, on the lids' ink, never display:none.
  const ptr = flat.match(/\.fp-scale__pointer \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/border-right: 0\.571rem solid var\(--color-white\)/.test(ptr) && /border-left: 0 solid transparent/.test(ptr), 'a triangle with its point on the left, /work\'s 0.571rem wide, in the lid ink');
  assert.ok(/transform: none/.test(ptr), 'no flipper-spring deflection: it stays on the lens line');
  assert.ok(!/\.fp-scale__pointer[^{]*\{[^}]*display: none/.test(flat) && !/\.fp-scale__pointer,/.test(flat), 'the arrow is not hidden any more');
  const work = pager.replace(/\s+/g, ' ');
  assert.ok(/border-left: 0\.571rem solid currentColor;/.test(work) && /border-top: 0\.429rem solid transparent;/.test(work), '/work\'s own pointer is untouched');
});

test('SQ-107 pass 5 baked dials, Nathan\'s 18 / 4 / 1.5 / 0.8 / 0.5, the circles\' own 200 / 200 and pass 11\'s 160 / 160 / 70 are the CSS defaults', () => {
  const css = skinCss();
  for (const [prop, value] of [['--scheme-swatch', '18px'], ['--badge-pad', '4px'], ['--eye-engaged', '1.5'], ['--eye-near', '0.8'], ['--eye-far', '0.5'], ['--eye-in', '200ms'], ['--eye-out', '200ms'], ['--eye-slide', '160ms'], ['--eye-grow', '160ms'], ['--eye-step', '70ms']]) {
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

test('SQ-107 the badge is a rectangle hugging the eye with equal padding, one component with it, a window onto the strip of three panels, never opacity', () => {
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
  assert.ok(/background-image:\s*linear-gradient\(\s*to bottom,\s*var\(--badge-glass\) 0 33\.3333%,\s*var\(--badge-black\) 33\.3333% 66\.6667%,\s*var\(--color-electric-blue\) 66\.6667% 100%\s*\)/.test(tile), 'the strip: project glass, black, blue, in SCHEMES order, hard stops');
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
  assert.ok(/--eye-p: calc\(var\(--eye-tg\) \+ \(var\(--eye-tn\) - var\(--eye-tg\)\) \* clamp\(0, var\(--ndr\), 1\) \+ \(var\(--eye-tf\) - var\(--eye-tn\)\) \* clamp\(0, calc\(var\(--ndr\) - 1\), 1\)\);/.test(st), 'its own progress: the lens rides the grow (--eye-tg), the near circles (one out) --eye-tn, the far (two out) --eye-tf, interpolated by the continuous distance --ndr');
  assert.ok(!/--eye-delay|--eye-stagger/.test(css), 'the stagger and its delay are retired (pass 11: three groups on their own delays)');
  assert.ok(/opacity: calc\(var\(--eye-up\) \* var\(--eye-down\) \* min\(1, var\(--eye-p\) \* 1000\)\);/.test(st), 'opacity: the fade above x the fade below x a hard on/off at --eye-p 0 (SQ-116: the entrance is a slide, never an opacity ramp)');
  assert.ok(!/(^|[\s;])scale:/.test(st) && !/--eye-travel|--eye-pop/.test(css), 'no pop and no half-way travel: the circle slides from the lens row at full size');
  assert.ok(/z-index: calc\(20 - min\(var\(--ndd\), 19\)\);/.test(st), 'the lens circle paints over the ring circles (by the detented distance)');
  assert.ok(!/--eye-foot|--badge-ride/.test(css), 'no footer ride, so no fade for it');
  assert.ok(/--eye-hit-up:\s*2\.5;/.test(css) && /--eye-hit-down:\s*1\.5;/.test(css), 'the press target reaches the shown column');
  assert.ok(/--eye-tn var\(--eye-in\) var\(--ease-draw\)/.test(flat) && /--eye-tf var\(--eye-out\) var\(--ease-draw\)/.test(flat), 'the rings on the existing timing: --eye-in, --eye-out, no overshoot');
  const pager = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(!/--badge-lift|--badge-rise/.test(pager), 'no climb');
});

test('SQ-116 every station carries a badge of its own scheme, the lens badge\'s build at the station\'s scale, flush with the edge, clipped off the lens badge', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const rule = flat.match(/\.swm-corner__pager \.scheme-badge \{([^}]*)\}/)?.[1] ?? '';
  // the lens badge's own width and height (the lifted eye and its padding, the width and the shift to the left of it)
  assert.ok(/--badge-bw: calc\(var\(--eye-lift\) \* var\(--badge-w\) \+ var\(--eye-s\)\);/.test(rule), 'as wide as the lens badge');
  assert.ok(/--badge-bh: calc\(var\(--eye-lift\) \* var\(--badge-h\)\);/.test(rule), 'as tall as the lens badge');
  // the station scales it: at --eye-near its box is 0.8 of the lens badge\'s, at --eye-far 0.5
  assert.ok(/--eye-r: calc\(var\(--sel\) \* var\(--eye-far\)\);/.test(rule), 'the station\'s own scale, the one its transform applies');
  // right edge on the viewport\'s: the lens-to-edge distance (lifted padding, the shift) in the station\'s own px
  assert.ok(/--badge-edge: calc\(\(var\(--eye-lift\) \* \(var\(--eye-w\) \/ 2 \+ var\(--badge-pad\)\) \+ var\(--eye-sx\) \* var\(--eye-s\)\) \/ var\(--eye-r\)\);/.test(rule), 'flush with the viewport\'s edge');
  assert.ok(/left: calc\(50% \+ var\(--badge-edge\) - var\(--badge-bw\)\);/.test(rule) && /top: calc\(50% - var\(--badge-o\)\);/.test(rule), 'seated on the station\'s centre (less any growth toward the lens, below), right edge on the viewport\'s');
  assert.ok(/z-index: -1;/.test(rule) && /pointer-events: none;/.test(rule), 'behind its own circle, never a press target');
  // clipped off the lens badge\'s window: that window\'s edges in this badge\'s coordinates, off the station\'s distance
  assert.ok(/--badge-yc: calc\(\(var\(--k, 0\) - var\(--scale-qf, var\(--scale-cur\)\)\) \* var\(--scale-pitch\) \* var\(--eye-p\)\);/.test(rule), 'the station\'s distance from the lens row, at this instant of its slide');
  assert.ok(/--badge-o: calc\(var\(--badge-bh\) \/ 2 \+ var\(--badge-xt\) \/ var\(--eye-r\)\);/.test(rule), 'screen px from the lens centre map into the box as --badge-o + (y - yc) / r');
  assert.ok(/--badge-yt: calc\(var\(--badge-o\) \+ \(var\(--badge-bt\) - var\(--badge-yc\)\) \/ var\(--eye-r\)\);/.test(rule) && /--badge-yb: calc\(var\(--badge-o\) \+ \(var\(--badge-bb\) - var\(--badge-yc\)\) \/ var\(--eye-r\)\);/.test(rule), 'the band\'s top and bottom: the lens window\'s, reaching out to the inner neighbour two or more stations out');
  assert.ok(/clip-path: polygon\(-999px -999px, 999px -999px, 999px var\(--badge-yt\), -999px var\(--badge-yt\), -999px var\(--badge-yb\), 999px var\(--badge-yb\), 999px 999px, -999px 999px\);/.test(rule), 'what lies inside the lens window is not painted a second time');
  // the three panels: the glass rule (alpha on the background, never opacity), black, brand blue
  assert.ok(/background: var\(--badge-glass\);/.test(rule) && /backdrop-filter: blur\(var\(--badge-blur\)\);/.test(rule), 'project is the lens badge\'s glass');
  assert.ok(!/(^|[\s;])opacity:/.test(rule), 'a badge never fades with opacity (the blur would show the sharp original)');
  assert.ok(/\.scheme-badge\[data-scheme='black'\] \{ background: var\(--badge-black\);/.test(flat), 'black is the light black (?schemeblack), one token with the strip');
  assert.ok(/\.scheme-badge\[data-scheme='blue'\] \{ background: linear-gradient\(to bottom, var\(--color-electric-blue\) 0 100%\);/.test(flat), 'blue is the brand blue');
  // the markup: StationArt renders the badge with the station's scheme beside the circle, SiteScheme uses it
  const sw = read('src/components/schemeSwatches.jsx');
  assert.ok(/export function StationArt\(\{ scheme \}\)/.test(sw) && /<span className="scheme-badge" data-scheme=\{scheme\} aria-hidden="true" \/>/.test(sw) && /<SchemeSwatch scheme=\{scheme\} \/>/.test(sw), 'StationArt: the badge, then the circle');
  assert.ok(/const renderSwatch = \(item\) => <StationArt scheme=\{item\.scheme\} \/>;/.test(read('src/components/SiteScheme.jsx')), 'every station renders it');
  // /work\'s pager is not touched: nothing here edits it
  assert.ok(!/scheme-badge/.test(read('src/styles/pager-scale.css')), '/work\'s pager skin knows nothing of it');
});

test('11-17 the far ring\'s badge meets its inner neighbour\'s with no gap, and the ring circles slide straight up and down, cut by the central badge while they pass it', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const rule = flat.match(/\.swm-corner__pager \.scheme-badge \{([^}]*)\}/)?.[1] ?? '';
  // Nathan 11-17: "the eye badge farthest away from the currently selected also does not have a gap between it
  // and the one next closest". Two or more stations out (--badge-g), the badge reaches toward the lens until it
  // meets its inner neighbour's box: up for a station above the lens, down for one below.
  assert.ok(/--badge-s: calc\(\(var\(--k, 0\) - var\(--scale-cur\)\) \/ max\(var\(--ndd\), 1\)\);/.test(rule), 'the side of the lens, -1 above and +1 below');
  assert.ok(/--badge-g: clamp\(0, calc\(var\(--ndd\) - 1\), 1\);/.test(rule), 'only a station two or more out grows (one out already sits on the lens badge)');
  assert.ok(/--badge-up: calc\(var\(--badge-g\) \* max\(0, -1 \* var\(--badge-s\)\)\);/.test(rule) && /--badge-dn: calc\(var\(--badge-g\) \* max\(0, var\(--badge-s\)\)\);/.test(rule), 'one side at a time');
  // The neighbour's box is computed the way the engine places it: its own entrance progress and its own falloff scale.
  assert.ok(/--badge-pn: calc\(var\(--eye-tg\) \+ \(var\(--eye-tn\) - var\(--eye-tg\)\) \* clamp\(0, calc\(var\(--ndr\) - 1\), 1\) \+ \(var\(--eye-tf\) - var\(--eye-tn\)\) \* clamp\(0, calc\(var\(--ndr\) - 2\), 1\)\);/.test(rule), 'the neighbour\'s --eye-p, one station nearer');
  assert.ok(/--badge-wn: clamp\(0, calc\(1 - max\(calc\(var\(--ndd\) - 1 - var\(--scale-falloff-hold\)\), 0\) \/ max\(calc\(var\(--scale-falloff\) - var\(--scale-falloff-hold\)\), 0\.001\)\), 1\);/.test(rule) && /--badge-w1n: clamp\(0, calc\(2 - var\(--ndd\)\), 1\);/.test(rule), 'the engine\'s falloff weights at --ndd - 1');
  assert.ok(/--badge-rn: calc\(\(1 \+ \(var\(--scale-sel\) - 1\) \* pow\(var\(--badge-wn\), var\(--scale-falloff-exp\)\) \+ \(var\(--scale-sel\) \* var\(--scale-sel-bump\) - var\(--scale-sel\)\) \* var\(--badge-w1n\) \* var\(--badge-w1n\)\) \* var\(--eye-far\)\);/.test(rule), 'the neighbour\'s scale: --sel\'s formula times --eye-far');
  const pager = read('src/styles/pager-scale.css').replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--sel: calc\(1 \+ \(var\(--scale-sel\) - 1\) \* var\(--wd\) \+ \(var\(--scale-sel\) \* var\(--scale-sel-bump\) - var\(--scale-sel\)\) \* var\(--w1\) \* var\(--w1\)\);/.test(pager), 'the engine --sel the mirror follows (change one, change both)');
  assert.ok(/--badge-yn: calc\(\(var\(--k, 0\) - var\(--badge-s\) - var\(--scale-qf, var\(--scale-cur\)\)\) \* var\(--scale-pitch\) \* var\(--badge-pn\)\);/.test(rule), 'the neighbour\'s centre, from the lens');
  assert.ok(/--badge-nt: calc\(var\(--badge-yn\) - var\(--badge-rn\) \* var\(--badge-bh\) \/ 2\);/.test(rule) && /--badge-nb: calc\(var\(--badge-yn\) \+ var\(--badge-rn\) \* var\(--badge-bh\) \/ 2\);/.test(rule), 'the neighbour\'s top and bottom edges');
  // The growth: the gap between this box and the neighbour's, never negative, in this station's own px.
  assert.ok(/--badge-xb: calc\(var\(--badge-up\) \* max\(0px, calc\(var\(--badge-nt\) - var\(--badge-yc\) - var\(--eye-r\) \* var\(--badge-bh\) \/ 2\)\)\);/.test(rule), 'above the lens: the bottom edge grows down to the neighbour\'s top');
  assert.ok(/--badge-xt: calc\(var\(--badge-dn\) \* max\(0px, calc\(var\(--badge-yc\) - var\(--eye-r\) \* var\(--badge-bh\) \/ 2 - var\(--badge-nb\)\)\)\);/.test(rule), 'below the lens: the top edge grows up to the neighbour\'s bottom');
  assert.ok(/height: calc\(var\(--badge-bh\) \+ \(var\(--badge-xt\) \+ var\(--badge-xb\)\) \/ var\(--eye-r\)\);/.test(rule), 'the box is taller by the growth');
  // The clipped band reaches out to the neighbour too, so the grown part never paints inside it.
  assert.ok(/--badge-bt: calc\(-1 \* var\(--badge-bh\) \/ 2 - var\(--badge-up\) \* max\(0px, calc\(-1 \* var\(--badge-bh\) \/ 2 - var\(--badge-nt\)\)\)\);/.test(rule) && /--badge-bb: calc\(var\(--badge-bh\) \/ 2 \+ var\(--badge-dn\) \* max\(0px, calc\(var\(--badge-nb\) - var\(--badge-bh\) \/ 2\)\)\);/.test(rule), 'the lens window, widened to the inner neighbour\'s far edge');
  // Nathan 11-17: the ring eyes move "directly vertically upward and downward ... anchored to the center of the
  // expanded central badge". Each circle keeps its own x through the slide, and while it slides the part of it
  // inside the central badge's window is not painted: it appears from behind the badge's edge.
  const station = flat.match(/\.fp-scale__station \{([^}]*--eye-cyt[^}]*)\}/)?.[1] ?? '';
  assert.ok(/--eye-cr: calc\(var\(--sel\) \* var\(--eye-far\)\);/.test(station), 'the station\'s scale');
  assert.ok(/--eye-con: calc\(clamp\(0, var\(--ndd\), 1\) \* min\(1, \(1 - var\(--eye-p\)\) \* 1000\)\);/.test(station), 'a band only for a ring circle still on its way: never the lens circle, never a settled or scrubbed one');
  assert.ok(/--eye-cyc: calc\(\(var\(--k, 0\) - var\(--scale-qf, var\(--scale-cur\)\)\) \* var\(--scale-pitch\) \* var\(--eye-p\)\);/.test(station), 'the circle\'s distance from the lens at this instant');
  assert.ok(/--eye-cband: calc\(var\(--eye-con\) \* var\(--eye-lift\) \* var\(--badge-h\) \/ 2\);/.test(station), 'half the central badge\'s height');
  assert.ok(/--eye-cyt: calc\(var\(--scheme-swatch\) \* var\(--eye-lift\) \/ 2 \+ \(-1 \* var\(--eye-cband\) - var\(--eye-cyc\)\) \/ var\(--eye-cr\)\);/.test(station) && /--eye-cyb: calc\(var\(--scheme-swatch\) \* var\(--eye-lift\) \/ 2 \+ \(var\(--eye-cband\) - var\(--eye-cyc\)\) \/ var\(--eye-cr\)\);/.test(station), 'the central badge\'s top and bottom in the circle\'s own px');
  const swatch = flat.match(/\.scheme-swatch \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/clip-path: polygon\(-999px -999px, 999px -999px, 999px var\(--eye-cyt\), -999px var\(--eye-cyt\), -999px var\(--eye-cyb\), 999px var\(--eye-cyb\), 999px 999px, -999px 999px\);/.test(swatch), 'the circle is cut by the band, the badge\'s shape');
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

test('SQ-101 engaged look, the engine falloff ranks the circles, four registered progress numbers drive the entrance and exit', () => {
  const css = skinCss();
  assert.ok(!/--scale-sel:\s*1\s*;/.test(css) && !/--scale-sel-bump:\s*1\s*;/.test(css), 'the falloff is no longer forced off');
  assert.ok(/--scale-falloff:\s*2;/.test(css) && /--scale-falloff-hold:\s*0;/.test(css) && /--scale-falloff-exp:\s*1;/.test(css), 'a straight line over two stations');
  assert.ok(/--scale-sel:\s*calc\(2 \* max\(var\(--eye-near\), var\(--eye-far\)\) \/ var\(--eye-far\) - 1\)/.test(css), 'one out = near / far of the small');
  assert.ok(/--scale-sel-bump:\s*calc\(1 \/ \(var\(--eye-far\) \* var\(--scale-sel\)\)\)/.test(css), 'the lens = 1 / far of the small');
  for (const g of ['ts', 'tg', 'tn', 'tf']) assert.ok(new RegExp(`@property --eye-${g}\\s*\\{[^}]*<number>[^}]*inherits:\\s*true`).test(css), `--eye-${g} is a registered, inherited number`);
  assert.ok(!/@property --eye-t\s*\{/.test(css), 'the single --eye-t is split');
  assert.ok(/--eye-ts var\(--eye-slide\) var\(--ease-draw\)/.test(css) && /--eye-tg var\(--eye-grow\) var\(--ease-draw\)/.test(css) && /--eye-tn var\(--eye-in\) var\(--ease-draw\)/.test(css) && /--eye-tf var\(--eye-out\) var\(--ease-draw\)/.test(css), 'each group eased on the house curve, on its own duration');
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
  assert.ok(swatch && reserve[1].startsWith(`${swatch} * 53.28 / 26`), 'the reserve is built from the skin default swatch and the default lids\' eye width (one number, two files)');
  const pad = /--badge-pad:\s*([\d.]+px)/.exec(skin)?.[1];
  assert.ok(pad && reserve[1].endsWith(`2 * ${pad}`), 'and its padding');
  assert.ok(/--eye-u-w:\s*53\.28;/.test(skin) && /--eye-w:\s*calc\(var\(--scheme-swatch\)\s*\*\s*var\(--eye-u-w\)\s*\/\s*26\)/.test(skin), 'and the eye width the skin derives from it (units of 26 per swatch, the lid scale\'s box)');
  const seat = 'html:has\\(\\.swm-corner\\)';
  const m = new RegExp(`@media \\(min-width: 769px\\)\\s*\\{\\s*${seat}\\s*\\{\\s*--privacy-clearance:[^}]*--badge-reserve[^}]*\\}\\s*${seat}\\s+\\.site-privacy\\s*\\{\\s*right:[^}]*--chrome-right-inset[^}]*--badge-reserve[^}]*\\}`).exec(g);
  assert.ok(m, 'desktop only, keyed on the widget\'s presence so it holds before hydration');
});

test('SQ-107 pass 11 the home phone blurb\'s right inset is the badge\'s own width, and a dial that moves the width rewrites it', () => {
  const g = read('src/styles/global.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const m = /@media \(max-width: 768px\)\s*\{\s*html\[data-footer-rest\]:has\(\.swm-corner\) \.site-footer__inner\s*\{\s*padding-right:\s*calc\(var\(--badge-reserve\) \+ var\(--nav-inset\)\);\s*\}\s*\}/.exec(g);
  assert.ok(m, 'at 768px and below the blurb\'s panel keeps the badge\'s width plus the page inset clear on its right, the token that follows the dials and no fixed number');
  const sc = read('src/components/SiteScheme.jsx');
  assert.ok(/--eye-u-w/.test(sc) && /--badge-pad/.test(sc) && /--scheme-swatch/.test(sc) && /setProperty\('--badge-reserve'/.test(sc), 'SiteScheme sums the badge width from its own resolved size, lid box and padding (site-scheme.css\'s --badge-w) onto <html>');
  assert.ok(/p\.size != null \|\| p\.pad != null \|\| p\.lids != null/.test(sc) && /astro:after-swap/.test(sc), 'only when a dial moved it, and again after a swap (ClientRouter replaces the html style)');
});

test('SQ-107 pass 11 above 768px only one circle shows above the lens, baked per tier with no param, the phone keeps two', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ');
  const base = css.match(/\.swm-corner\s*\{[^}]*--eye-up-shown:\s*2;[^}]*\}/)?.[0] ?? '';
  assert.ok(/--eye-up-shown:\s*2;/.test(base) && /--eye-up-span:\s*max\(0\.1, calc\(var\(--scale-rows\) - 2\.3\)\);/.test(base), 'the phone tier\'s two circles above fade over rows - 2.3 stations, as before');
  const desk = /@media \(min-width: 769px\)\s*\{\s*\.swm-corner\s*\{([^}]*)\}\s*\}/.exec(css)?.[1] ?? '';
  assert.ok(/--eye-up-shown:\s*1;/.test(desk) && /--eye-up-span:\s*1;/.test(desk), 'above 768px one whole circle above, the next gone one station after it (the far circle, two out, is at nothing)');
  assert.ok(/--eye-hit-up:\s*1\.5;/.test(desk), 'the press target above the lens: 1.5 stations on desktop');
  assert.ok(/--eye-up: clamp\(0, calc\(1 - \(var\(--eye-above\) - var\(--eye-up-shown\)\) \/ var\(--eye-up-span\)\), 1\);/.test(flat), 'a continuous function of the circle\'s station distance above the lens (--eye-above)');
  assert.ok(!/schemeup|eyeup/i.test(read('src/components/siteSchemeLogic.js')), 'no ?param for it');
  const sc = read('src/components/SiteScheme.jsx');
  assert.ok(/--eye-up-shown/.test(sc) && /now\.f = dir === 'in' \? 1 : 0/.test(sc), 'the far ring, never seen above 768px, takes no beat in the sequence plan');
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

// ── SQ-107 pass 11: the sequence, the arrow's slide, the lids' scale ────────────────────────────────────────

test('the badge colours ?schemeglass ?schemeblack: parse and clamp, one token each for the strip and the stations (Nathan 11-17)', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.equal(q('').glass, null, 'absent = the CSS default');
  assert.equal(q('schemeglass=40').glass, 40);
  assert.equal(q('schemeglass=0').glass, 0, '0 = bare blur, not the default');
  assert.equal(q('schemeglass=200').glass, 100);
  assert.equal(q('schemeglass=light').glass, null);
  assert.equal(q('').black, null);
  assert.equal(q('schemeblack=12').black, 12);
  assert.equal(q('schemeblack=0').black, 0, '0 = the page black');
  assert.equal(q('schemeblack=90').black, 40);
  const css = read('src/styles/site-scheme.css');
  assert.ok(/--badge-veil: 35%;/.test(css) && /--badge-black-mix: 10%;/.test(css), 'the PROPOSED defaults');
  assert.ok(/--badge-glass: color-mix\(in srgb, var\(--color-white\) var\(--badge-veil\), transparent\);/.test(css), 'the glass is white at --badge-veil (alpha, never opacity)');
  assert.ok(/--badge-black: color-mix\(in srgb, var\(--color-white\) var\(--badge-black-mix\), var\(--color-black\)\);/.test(css), 'the light black is opaque');
  assert.ok(!/var\(--color-black\) 33\.3333%/.test(css), 'the strip no longer paints the page black');
  const sc = read('src/components/SiteScheme.jsx');
  assert.ok(/setProperty\('--badge-veil', `\$\{p\.glass\}%`\)/.test(sc) && /setProperty\('--badge-black-mix', `\$\{p\.black\}%`\)/.test(sc), 'SiteScheme writes both onto the corner');
});

test('schemeParams the sequence dials ?schemeslide ?schemegrow ?schemestep ?schemelids parse and clamp (null = the CSS default)', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  for (const [key, field, hi] of [['schemeslide', 'slideMs', 600], ['schemegrow', 'growMs', 600], ['schemestep', 'stepMs', 300]]) {
    assert.equal(q('')[field], null, `${key} absent`);
    assert.equal(q(`${key}=120`)[field], 120);
    assert.equal(q(`${key}=0`)[field], 0, `${key}=0 is instant, not the default`);
    assert.equal(q(`${key}=-5`)[field], 0);
    assert.equal(q(`${key}=${hi * 10}`)[field], hi);
    assert.equal(q(`${key}=fast`)[field], null);
    assert.equal(q(`${key}=`)[field], null);
  }
  assert.equal(q('schemelids=1.2').lids, 1.2);
  assert.equal(q('schemelids=1').lids, 1, '1 = pass 10\'s lids');
  assert.equal(q('schemelids=0.5').lids, 1, 'a smaller lid would cut the iris: clamps to 1');
  assert.equal(q('schemelids=9').lids, 1.3);
  assert.equal(q('schemelids=big').lids, null);
  assert.equal(q('schemein=350').inMs, 350, 'the circles\' own entrance');
  assert.equal(q('schemeout=0').outMs, 0);
  const sc = read('src/components/SiteScheme.jsx');
  for (const [field, prop] of [['slideMs', '--eye-slide'], ['growMs', '--eye-grow'], ['stepMs', '--eye-step']]) {
    assert.ok(new RegExp(`p\\.${field} != null\\) el\\.style\\.setProperty\\('${prop}', \`\\$\\{p\\.${field}\\}ms\`\\)`).test(sc), `SiteScheme writes ${field} as ${prop}`);
  }
});

test('lid scale derivation the smallest k that covers the iris is 1.1136 and the default 1.12 clears it', () => {
  const k = LIDS_MIN;
  assert.ok(Math.abs(k - 12.25 / 11) < 1e-12, 'k >= (13 - 0.75) / (27.5 - 16.5)');
  assert.ok(Math.abs(k - 1.1136) < 1e-4);
  assert.equal(LIDS, 1.12);
  assert.ok(LIDS >= LIDS_MIN, 'the default covers');
  // geometry: the lid arcs have radius 27.5k through +-22k, the apex 11k from the centre
  for (const kk of [1, 1.12, 1.3]) {
    const g = eyeGeometry(kk);
    const apex = g.r - Math.sqrt(g.r * g.r - (22 * kk) ** 2);
    assert.ok(Math.abs(apex - 11 * kk) < 1e-9, `the apex is 11k at k = ${kk}`);
    // the circle (radius 13) at the centre against the lids' OUTER edge (arc centres 16.5k away, outer radius 27.5k + 0.75)
    const covered = 16.5 * kk + IRIS_UNITS / 2 <= 27.5 * kk + LID_STROKE / 2 + 1e-9;
    assert.equal(covered, kk >= LIDS_MIN - 1e-12, `the iris is inside the lids' outer outline exactly when k >= ${LIDS_MIN.toFixed(4)} (k = ${kk})`);
  }
  const one = eyeGeometry(1);
  assert.deepEqual([one.w, one.h], [48, 28], 'k = 1 is pass 10\'s eye box');
  const d = eyeGeometry(LIDS);
  assert.deepEqual([+d.w.toFixed(2), +d.h.toFixed(2)], [53.28, 30.64], 'the default box keeps today\'s margins: 2 units at the sides, 3 above and below');
  assert.ok(Math.abs((d.w - 2 * 22 * LIDS) / 2 - 2) < 1e-9 && Math.abs((d.h - 2 * 11 * LIDS) / 2 - 3) < 1e-9);
  // the art: the stroke stays LID_STROKE and the iris stays 26 whatever k is
  const sw = read('src/components/schemeSwatches.jsx');
  assert.ok(/const LID_W = LID_STROKE;/.test(sw) && /const IRIS = IRIS_UNITS;/.test(sw), 'the stroke and the iris are constants, not scaled with the lids');
  assert.ok(/<clipPath id="swm-eye-lid">\s*<path d=\{eye\.lid\} \/>/.test(sw), 'the lid-opening clip scales with the lids');
  const css = skinCss();
  assert.ok(/--eye-u-w:\s*53\.28;/.test(css) && /--eye-u-h:\s*30\.64;/.test(css), 'the CSS eye box is eyeGeometry(1.12), the dial writes both');
  assert.ok(/--eye-h: calc\(var\(--scheme-swatch\) \* var\(--eye-u-h\) \/ 26\)/.test(css.replace(/\s+/g, ' ')));
});

test('cssMs reads a duration token in either unit (the build minifies 160ms to .16s)', () => {
  // The built CSS (astro build) rewrites `--eye-slide: 160ms` as `.16s`; the dev server keeps `160ms`. A bare
  // parseFloat read 0.16 and planned the whole sequence in fractions of a ms (the sequence gate failed on a build).
  assert.equal(cssMs('.16s', 0), 160);
  assert.equal(cssMs(' 160ms', 0), 160);
  assert.equal(cssMs('0.2s', 0), 200);
  assert.equal(cssMs('70ms', 0), 70);
  assert.equal(cssMs('0s', 9), 0);
  assert.equal(cssMs('1', 2), 1, 'a bare number (--eye-up-shown) is taken as is');
  assert.equal(cssMs('', 160), 160, 'an unset token falls back');
  assert.equal(cssMs(undefined, 70), 70);
  const sc = read('src/components/SiteScheme.jsx');
  assert.ok(/const ms = \(name, d\) => cssMs\(cc\.getPropertyValue\(name\), d\);/.test(sc), 'planSequence reads every duration through cssMs');
});

test('eyeDelays engage the slide, then the grow, then the near ring, then the far ring', () => {
  const rest = { s: 0, g: 0, n: 0, f: 0 };
  assert.deepEqual(eyeDelays('in', rest), { s: 0, g: 160, n: 230, f: 300, h: 320 }, 'nominal: the grow when the slide has ended, a beat per ring, the rest iris at the end of the grow');
  assert.deepEqual(eyeDelays('in', rest, { slide: 100, grow: 200, step: 40 }), { s: 0, g: 100, n: 140, f: 180, h: 300 }, 'every number is a dial');
  assert.deepEqual(eyeDelays('in', rest, { slide: 0, grow: 0, step: 0 }), { s: 0, g: 0, n: 0, f: 0, h: 0 }, 'all zero = all together');
});

test('eyeDelays release the far ring, then the near, then the shrink, then the slide back', () => {
  const full = { s: 1, g: 1, n: 1, f: 1 };
  assert.deepEqual(eyeDelays('out', full), { f: 0, n: 70, g: 140, s: 300, h: 0 }, 'the exact reverse: far first, the slide back when the shrink has ended');
  const o = eyeDelays('out', full);
  assert.ok(o.f < o.n && o.n < o.g && o.g < o.s, 'the release order is the engage order reversed');
  const e = eyeDelays('in', { s: 0, g: 0, n: 0, f: 0 });
  assert.ok(e.s < e.g && e.g < e.n && e.n < e.f);
});

test('eyeDelays a quick tap never waits out a delay that belongs to a group that never started', () => {
  // released 100 ms in: the slide is under way, nothing else started: it turns back at once
  const at100 = eyeDelays('out', { s: 0.6, g: 0, n: 0, f: 0 });
  assert.equal(at100.s, 0, 'the slide, the only group that moved, does not wait for a shrink that never began');
  // released 250 ms in: the slide done, the grow half way, the near ring just begun, the far ring not started
  const at250 = eyeDelays('out', { s: 1, g: 0.5, n: 0.1, f: 0 });
  assert.equal(at250.n, 0, 'the near ring turns back at once: the far ring it would wait for never started');
  assert.equal(at250.f, 0);
  assert.equal(at250.g, 70, 'the grow a beat after the near ring');
  assert.equal(at250.s, 70 + 160, 'and the slide when the grow has shrunk');
  // engaged again mid-release: a group already home does not hold the others
  const back = eyeDelays('in', { s: 1, g: 0.4, n: 0, f: 0 });
  assert.equal(back.s, 0);
  assert.equal(back.g, 0, 'the slide never left (home on the left) and does not hold the grow');
  assert.equal(back.n, 70);
  assert.equal(eyeDelays('in', { s: 1, g: 1, n: 1, f: 1 }).h, 0, 'nothing to hand over when the lens circle is in');
});

test('the CSS runs the four groups on their own delays and hands the rest iris over at the end of the grow', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  for (const k of ['s', 'g', 'n', 'f']) assert.ok(new RegExp(`--eye-t${k} var\\(--eye-(slide|grow|in|out)\\) var\\(--ease-draw\\) var\\(--eye-dl-${k},`).test(flat), `--eye-t${k} takes its delay from --eye-dl-${k}`);
  assert.ok(/--eye-lift: calc\(1 \+ \(var\(--eye-engaged\) - 1\) \* var\(--eye-tg\)\);/.test(flat), 'the lift rides the GROW');
  assert.ok(/\[data-open\] \.scheme-eye__iris \{ opacity: 0; transition: opacity 0s linear var\(--eye-dl-h,/.test(flat), 'the rest iris hands over at the end of the grow');
  const sc = read('src/components/SiteScheme.jsx');
  assert.ok(/planSequence\(cornerRef\.current, v \? 'in' : 'out'\);\s*engagedRef\.current = v;/.test(sc), 'the delays are written before the engine\'s state change lands');
  assert.ok(/prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?transition:\s*z-index 0s;/.test(css), 'reduced motion is instant');
});

test('the arrow waits entirely beyond the right edge at opacity 1 and slides in on the slide, /work\'s own pointer untouched', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const ptr = flat.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__pointer \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/--eye-arrow-off: calc\(\(1 - var\(--eye-ts\)\) \* \(var\(--badge-pad\) \/ 2 \+ 0\.2855rem \+ 1px\)\);/.test(ptr), 'the offset is the slide\'s remaining progress times the arrow\'s distance to the edge (+ 1 px)');
  assert.ok(/var\(--eye-arrow-off\)/.test(ptr), 'and the left edge adds it');
  assert.ok(/opacity: 1;/.test(ptr) && /transition: none;/.test(ptr), 'opacity 1 and no opacity transition at rest');
  assert.ok(/\[data-open\] \.fp-scale__pointer \{ opacity: 1; transition: none;/.test(flat), 'engaged too: it slides, never fades');
  const pager = read('src/styles/pager-scale.css').replace(/\s+/g, ' ');
  assert.ok(/opacity 0\.2s/.test(pager), '/work\'s pointer still fades');
});

test('the retired stagger and single --eye-t are gone from every consumer', () => {
  for (const p of ['src/styles/site-scheme.css', 'src/styles/global.css', 'src/components/SiteScheme.jsx', 'src/components/schemeSwatches.jsx']) {
    assert.ok(!/--eye-stagger|--eye-delay|--eye-t(?![a-z$-])/.test(read(p)), `${p} has no --eye-t / --eye-stagger left`);
  }
});

// SQ-121: above 768px the seat sits on the footer blurb, one height on every route; phones keep theirs.
test('SQ-125 the desktop seat is the black panel top plus the gap plus what the column reaches below the lens, above 768px only', () => {
  const flat = skinCss().replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const desk = /@media \(min-width: 769px\) \{ \.swm-corner \{([^}]*)\} \}/.exec(flat)?.[1] ?? '';
  assert.ok(/--badge-cy: calc\(var\(--seat-panel-top\) \+ var\(--badge-blurb-gap\) \+ var\(--seat-below\)\);/.test(desk), 'the lens centre: the panel top, the gap, the column below the lens');
  assert.ok(/--badge-blurb-gap: 2px;/.test(desk), "the gap, Nathan's 2 (?schemeblurbgap, 11-18)");
  assert.ok(/--seat-blurb-size: var\(--footer-blurb-size, max\(var\(--text-blurb, 1\.4rem\), var\(--seat-blurb-fill\)\)\);/.test(desk), "the blurb's size: global.css's token where home publishes it, its own expression elsewhere");
  assert.ok(/--seat-panel-top: calc\(var\(--seat-rest\) \* var\(--seat-panel-h\)\);/.test(desk), "the panel's top edge is the resting share of its height above the viewport's bottom");
  assert.ok(/--seat-panel-h: calc\(196\.91px \+ 2\.4 \* var\(--seat-blurb-size\) \+ min\(1\.15 \* var\(--seat-blurb-size\), max\(0px, 1000 \* /.test(desk), "the panel's height: a straight line of the blurb's size, plus one blurb line when the copy wraps (a steep min/max step, no breakpoint)");
  const hero = read('src/components/Hero.jsx');
  const rest = /const FOOTER_REST_DESKTOP = ([\d.]+);/.exec(hero)?.[1];
  assert.ok(rest, "Hero's FOOTER_REST_DESKTOP is found");
  assert.ok(new RegExp(`--seat-rest: ${rest.replace('.', '\\.')};`).test(desk), "--seat-rest is Hero's FOOTER_REST_DESKTOP: the seat follows the footer's resting share");
  assert.ok(/--eye-down-shown: var\(--eye-down-desk, 0\);/.test(desk) && /--eye-hit-down: calc\(0\.75 \+ 0\.75 \* var\(--eye-down-desk, 0\)\);/.test(desk), 'no ring under the lens by default, the press target follows it');
  assert.ok(/@supports \(width: round\(1px, 1px\)\) \{ @media \(min-width: 769px\) \{ \.swm-corner \{ --badge-cy: round\(calc\(var\(--seat-panel-top\) \+ var\(--badge-blurb-gap\) \+ var\(--seat-below\)\), 0\.5px\); \} \} \}/.test(flat), 'the seat rounds to half pixels where round() exists (a fractional lens centre shimmers in the jitter gate; a whole pixel would spend the 2px gap\'s half-pixel tolerance)');
  // Phones: the seat is declared in the desktop block alone, and the base block keeps the old fade numbers.
  assert.equal(flat.split('--seat-panel-top:').length - 1, 1, 'the panel seat is declared once, in the desktop block');
  assert.ok(/--eye-down-shown: 1;/.test(flat) && /--eye-down-span: 0\.5;/.test(flat), 'the base (the phone) shows one circle below the lens and fades the next within half a station, as before');
  assert.ok(/--eye-down: clamp\(0, calc\(1 - \(var\(--eye-below\) - var\(--eye-down-shown\)\) \/ var\(--eye-down-span\)\), 1\);/.test(flat), 'the fade below reads the base tokens');
});

test('SQ-121 ?schemeblurbgap is a 0 to 60 px dial and ?schemedown is 0 or 1, both null (the CSS default) when absent or unreadable', () => {
  const q = (s) => schemeParams(new URLSearchParams(s));
  assert.equal(q('').blurbGap, null);
  assert.equal(q('schemeblurbgap=12').blurbGap, 12);
  assert.equal(q('schemeblurbgap=0').blurbGap, 0);
  assert.equal(q('schemeblurbgap=99').blurbGap, 60);
  assert.equal(q('schemeblurbgap=wide').blurbGap, null);
  assert.equal(q('').down, null);
  assert.equal(q('schemedown=1').down, 1);
  assert.equal(q('schemedown=0').down, 0);
  assert.equal(q('schemedown=2').down, null);
  const sc = read('src/components/SiteScheme.jsx');
  assert.ok(/--badge-blurb-gap', `\$\{p\.blurbGap\}px`/.test(sc) && /--eye-down-desk', String\(p\.down\)/.test(sc), 'SiteScheme writes both as custom properties on .swm-corner');
});
