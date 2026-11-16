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
  assert.ok(/--home-cy:[\s\S]*?--pill-pad-y[\s\S]*?--lh-pill/.test(css), 'home centres the badge on the privacy pill\'s line at its desktop height, at every width');
  assert.ok(/z-index:\s*43/.test(css), 'z 43');
  assert.ok(/translate:\s*0 calc\(-1 \* var\(--badge-ride\)\)/.test(css) && /--badge-ride:[\s\S]*?--footer-reveal[\s\S]*?--footer-panel-h/.test(css), 'rides above the rising links footer');
  const live = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/html\[data-chrome-open\]\s+\.swm-corner\s*\{/.test(live), 'yields to the overlays');
  // SQ-107: the phone menu is how every page is reached; it covers the badge (z 100 over 43), so
  // yielding to it faded the badge out and back in on every navigation.
  assert.ok(!/data-menu-open/.test(live), 'does NOT yield to the menu: the badge persists across a menu navigation');
});

const skinCss = () => read('src/styles/site-scheme.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('SQ-107 pass 5 one seat, flush: the right edge is the viewport\'s on every route and the badge has no seat option', () => {
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

test('SQ-107 the badge rides the links footer, its bottom edge on the footer\'s top edge, less what home\'s seat takes off', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--badge-ride: calc\(max\(0px, var\(--footer-reveal, 0\) \* var\(--footer-panel-h, 0px\)\) \* \(1 - var\(--seat-t\)\)\);/.test(flat), 'the footer\'s visible height, no gap');
  assert.ok(/translate:\s*0 calc\(-1 \* var\(--badge-ride\)\)/.test(css.match(/\.swm-corner\s*\{[^}]*position:\s*fixed[^}]*\}/)?.[0] ?? ''), 'the wrapper translates by --badge-ride');
  assert.ok(!/--badge-ride:\s*0;/.test(css) && !/--badge-ride:\s*1;/.test(css), 'nothing opts out of the ride');
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

test('SQ-107 the badge: a rectangle hugging the eye with equal padding, one component with it, blue/black from the role token, glass on project, never opacity', () => {
  const css = skinCss();
  assert.ok(/--badge-pad:\s*4px/.test(css), 'Nathan\'s padding, 4 px');
  assert.ok(/--badge-w:\s*calc\(var\(--eye-w\) \+ 2 \* var\(--badge-pad\)\)/.test(css) && /--badge-h:\s*calc\(var\(--eye-h\) \+ 2 \* var\(--badge-pad\)\)/.test(css), 'the eye plus the padding each side, no size knob of its own');
  const tile = css.match(/\.swm-corner\[data-ready\] \.fp-scale\.swm-corner__pager::before\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/width:\s*var\(--badge-w\)/.test(tile) && /height:\s*var\(--badge-h\)/.test(tile), 'width and height from the eye');
  assert.ok(/left:\s*calc\(-1 \* var\(--badge-pad\)\)/.test(tile) && /top:\s*calc\(-1 \* var\(--badge-pad\)\)/.test(tile), 'the same padding on every side of the eye\'s box');
  assert.ok(/scale:\s*var\(--eye-lift\)/.test(tile) && /transform-origin:\s*50% 50%/.test(tile), 'it grows with the eye, on the one --eye-t, about its own centre');
  assert.ok(!/border-radius/.test(tile), 'square corners');
  assert.ok(/(^|[\s;{])translate:\s*calc\(\(1 - var\(--eye-lift\)\) \* \(var\(--eye-w\) \/ 2 \+ var\(--badge-pad\)\)\) 0;/.test(css), 'ONE anchor: the pager moves in x only, so the badge\'s right edge at its vertical centre holds and nothing climbs');
  assert.ok(/html\[data-footer-rest\] \.swm-corner\s*\{\s*--seat-t:\s*1;\s*\}/.test(css), 'home latches the blend to its end');
  assert.ok(/background-color:\s*color-mix\(\s*in srgb,\s*var\(--scheme-page\) calc\(var\(--badge-solid\) \* 100%\),\s*var\(--badge-glass\)\s*\)/.test(tile), 'the scheme\'s role token over the glass, by --badge-solid');
  assert.ok(/backdrop-filter:\s*blur\(var\(--badge-blur\)\)/.test(tile), 'the glass blurs what is behind it');
  assert.ok(!/(^|[\s;])opacity:/.test(tile), 'the tile never fades with opacity (below 1 the blur shows the sharp original): the alpha is the background\'s');
  assert.ok(/html\[data-scheme='black'\] \.swm-corner,\s*html\[data-scheme='blue'\] \.swm-corner\s*\{\s*--badge-solid:\s*1;/.test(css), 'black and blue are solid; project (and the parked spectrum) stay glass');
  assert.ok(/@property --badge-solid\s*\{[^}]*<number>[^}]*inherits:\s*true/.test(css), '--badge-solid is registered, so the change eases');
  assert.ok(/--badge-solid var\(--scheme-fade, var\(--project-color-fade\)\) var\(--ease-panel\)/.test(css), 'and eases with the page');
});

test('SQ-107 pass 5 nothing is cut by a straight edge, the window carries no mask and each circle fades by its own distance', () => {
  const css = skinCss();
  const flat = css.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  const win = css.match(/\.fp-scale__window\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/--eye-wide:\s*calc\(var\(--eye-w\) \* max\(1, var\(--eye-engaged\)\)\)/.test(win), 'sized for --eye-engaged, so no lift up to the 3 cap is clipped');
  assert.ok(/mask-image:\s*none/.test(win) && /-webkit-mask-image:\s*none/.test(win), 'the pager\'s feather mask and the iris-band masks are gone: a circle in transit was cut flat where it crossed them (the cut top circle)');
  assert.ok(!/linear-gradient|eye-edge|eye-feather|eye-reach|eye-lid-mask/.test(css), 'no band, feather, reach or lid mask left anywhere in the skin');
  const station = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__station\s*\{([^}]*)\}/)?.[1] ?? '';
  const st = station.replace(/\s+/g, ' ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
  assert.ok(/--eye-delay: calc\(var\(--eye-stagger\) \* clamp\(0, calc\(var\(--ndr\) - 1\), 1\)\);/.test(st), 'the far circle (two stations out) starts later; the lens and the near circle (one out) start together');
  assert.ok(/--eye-p: clamp\(0, calc\(\(var\(--eye-t\) - var\(--eye-delay\)\) \/ \(1 - var\(--eye-delay\)\)\), 1\);/.test(st), 'its own progress on the one --eye-t: it ends WITH the entrance, so the exit runs it back');
  assert.ok(/opacity: calc\(var\(--eye-p\) \* var\(--eye-up\) \* var\(--eye-down\) \* \(1 - clamp\(0, var\(--eye-below\), 1\) \* \(1 - var\(--eye-foot\)\)\)\);/.test(st), 'opacity: entrance progress x the fade above x the fade below x the fade where the footer rides');
  assert.ok(/--eye-foot: clamp\(0, calc\(1 - tan\(atan2\(var\(--badge-ride, 0px\), var\(--scale-pitch\)\)\)\), 1\);/.test(st), 'the circle below fades as the badge rides the footer, instead of being cut by its top edge');
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

test('SQ-107 pass 4 the home seat is one blend and SiteScheme eases it across a soft nav on the house curve', () => {
  const css = skinCss();
  assert.ok(/@property --seat-t\s*\{[^}]*<number>[^}]*inherits:\s*true/.test(css), '--seat-t is registered, so Web Animations can interpolate it');
  assert.ok(/--home-cy:\s*calc\(var\(--footer-bottom-inset\) \+ var\(--pill-pad-y\) \+ var\(--lh-pill\) \/ 2\)/.test(css), 'the corner row\'s centre at rest');
  assert.ok(/--badge-cy:\s*calc\(var\(--badge-h\) \/ 2 \+ \(var\(--home-cy\) - var\(--badge-h\) \/ 2\) \* var\(--seat-t\)\)/.test(css), 'inset, centre and ride all follow --seat-t');
  const comp = read('src/components/SiteScheme.jsx');
  assert.ok(/corner\.animate\(\[\{ '--seat-t': from \}, \{ '--seat-t': next \}\]/.test(comp), 'the swap moves the persisted node, which drops a CSS transition\'s before-change style: animate from the last shown value');
  assert.ok(/cubic-bezier\(0\.16, 1, 0\.3, 1\)/.test(comp) && /--seat-ease/.test(comp), 'the --ease-draw curve, a short duration from the sheet');
  assert.ok(/prefers-reduced-motion: reduce/.test(comp) && /data-footer-rest/.test(comp), 'instant under reduced motion, keyed to home\'s latch');
});

test('SQ-107 pass 4 the jitter root cause, the circle is drawn at the large size and its row only scales it down', () => {
  const css = skinCss();
  const swatch = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.scheme-swatch\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/width:\s*calc\(var\(--scheme-swatch\) \* var\(--eye-lift\)\)/.test(swatch) && /height:\s*calc\(var\(--scheme-swatch\) \* var\(--eye-lift\)\)/.test(swatch), 'drawn at the lifted iris size, so an svg root\'s pixel snap is not multiplied by a scale-up');
  const station = css.match(/\.swm-corner \.fp-scale\.swm-corner__pager \.fp-scale__station\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(/transform:\s*scale\(calc\(var\(--sel\) \* var\(--eye-far\)\)\)/.test(station), 'the row scale is --sel x --eye-far (at most 1 for the lens)');
});
