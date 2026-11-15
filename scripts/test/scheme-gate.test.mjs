// scheme-gate.test.mjs — the US-7 scheme probe's gates (scripts/lib/scheme-gate.mjs) on small
// hand-built dumps, each with a passing case and a failing case that names the offender, and the
// palette classifier (scripts/palette-measure.mjs) on the swatches of color-ref.png.
// Run: node --test scripts/test/scheme-gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseColour, sameColour, contrastRatio, latch, identity, monochrome, singleHue, contrast,
  carriers, deal, crossRoute, hover, overlap, shares, REFERENCE_SHARES, describeOffender,
} from '../lib/scheme-gate.mjs';
import { classify, countFamilies, chromaticShares } from '../palette-measure.mjs';

const el = (paint, extra = {}) => ({ paint, ...extra });
const PAGE = 'html > body.work > main.fp:nth-of-type(1)';

test('parseColour reads rgb, rgba, srgb, oklch and hex', () => {
  assert.deepEqual(parseColour('rgb(0, 0, 255)'), { r: 0, g: 0, b: 255, a: 1 });
  assert.equal(parseColour('rgba(10, 20, 30, 0.5)').a, 0.5);
  assert.deepEqual(parseColour('color(srgb 1 0 0 / 0.25)'), { r: 255, g: 0, b: 0, a: 0.25 });
  assert.equal(parseColour('#00f').b, 255);
  const o = parseColour('oklch(0.452 0.313 264.05)');
  assert.ok(o.b > 240 && o.r < 20, JSON.stringify(o));
  assert.equal(parseColour('url("#g")'), null);
  assert.ok(sameColour('rgb(0, 0, 255)', 'color(srgb 0 0 1)'));
  assert.ok(!sameColour('rgb(0, 0, 255)', 'rgb(0, 0, 0)'));
  assert.ok(Math.abs(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }) - 21) < 0.01);
});

test('latch: the attribute is the requested scheme', () => {
  assert.equal(latch('black', 'black').pass, true);
  const bad = latch(null, 'black');
  assert.equal(bad.pass, false);
  assert.deepEqual(bad.offenders[0], { path: 'html', prop: 'data-scheme', got: null, want: 'black' });
});

test('identity: equal dumps pass; a changed painted property names the path, property and both values', () => {
  const a = { [PAGE]: el({ 'background-color': 'rgb(0, 0, 255)', color: 'rgb(255, 255, 255)' }, { text: true }) };
  assert.equal(identity(a, structuredClone(a)).pass, true);
  const b = structuredClone(a);
  b[PAGE].paint['background-color'] = 'rgb(0, 0, 0)';
  const r = identity(a, b);
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders, [{ path: PAGE, prop: 'background-color', before: 'rgb(0, 0, 255)', after: 'rgb(0, 0, 0)' }]);
});

test('identity: an element on one side only is an offender unless ignored', () => {
  const a = { html: el({ 'background-color': 'rgb(0, 0, 0)' }) };
  const b = { ...a, 'html > body > div.swm-corner': el({ 'background-color': 'rgb(255, 255, 255)' }) };
  const r = identity(a, b);
  assert.equal(r.pass, false);
  assert.equal(r.offenders[0].path, 'html > body > div.swm-corner');
  assert.equal(r.offenders[0].after, 'present');
  assert.equal(identity(a, b, { ignore: ['.swm-corner'] }).pass, true);
});

test('monochrome: greys pass; one translucent blue border in a grey page fails and names it', () => {
  const grey = {
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    [PAGE]: el({ color: 'rgb(255, 255, 255)', 'border-top-color': 'rgb(128, 128, 128)' }, { text: true }),
  };
  assert.equal(monochrome(grey).pass, true);
  const tainted = {
    ...grey,
    'html > body > a.cta:nth-of-type(1)': el({ 'border-left-color': 'rgba(0, 0, 255, 0.3)' }),
  };
  const r = monochrome(tainted);
  assert.equal(r.pass, false);
  assert.equal(r.offenders.length, 1);
  assert.equal(r.offenders[0].path, 'html > body > a.cta:nth-of-type(1)');
  assert.equal(r.offenders[0].prop, 'border-left-color');
  assert.match(describeOffender(r.offenders[0]), /a\.cta.*border-left-color/);
});

test('monochrome: a fully transparent blue paints nothing; an empty dump is vacuous', () => {
  assert.equal(monochrome({ html: el({ 'background-color': 'rgba(0, 0, 255, 0)', color: 'rgb(9, 9, 9)' }) }).pass, true);
  const empty = monochrome({});
  assert.equal(empty.pass, false);
  assert.match(empty.note, /vacuous/);
});

test('singleHue: blue tints pass; red or green fail naming the element; lightness and alpha may differ', () => {
  const ok = {
    a: el({ 'background-color': 'rgb(0, 0, 255)' }),
    b: el({ 'background-color': 'rgba(0, 0, 255, 0.4)' }),
    c: el({ color: 'oklch(0.7 0.15 264.05)' }), // lighter at the same OKLCH hue (a mix with white would drift the hue)
    d: el({ color: 'rgb(255, 255, 255)' }),
  };
  assert.equal(singleHue(ok, '#0000ff').pass, true, JSON.stringify(singleHue(ok, '#0000ff')));
  const bad = { ...ok, 'html > body > p.tag': el({ color: 'rgb(7, 123, 62)' }) };
  const r = singleHue(bad, '#0000ff');
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders.map((o) => o.path), ['html > body > p.tag']);
});

test('contrast: white on black passes; blue on blue fails; a translucent layer composites onto its parent', () => {
  const ok = {
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    'html > body': el({}),
    'html > body > p': el({ color: 'rgb(255, 255, 255)' }, { text: true }),
  };
  assert.equal(contrast(ok).pass, true);
  const bad = {
    html: el({ 'background-color': 'rgb(0, 0, 255)' }),
    'html > body > p': el({ color: 'rgb(10, 10, 255)' }, { text: true }),
  };
  const r = contrast(bad);
  assert.equal(r.pass, false);
  assert.equal(r.offenders[0].path, 'html > body > p');
  assert.ok(r.offenders[0].ratio < 3);
  // a 50% black layer over white page makes mid-grey (#777) text too faint, white text fine
  const layered = {
    html: el({ 'background-color': 'rgb(255, 255, 255)' }),
    'html > div.veil': el({ 'background-color': 'rgba(0, 0, 0, 0.5)' }),
    'html > div.veil > p.a': el({ color: 'rgb(255, 255, 255)' }, { text: true }),
    'html > div.veil > p.b': el({ color: 'rgb(119, 119, 119)' }, { text: true }),
  };
  const l = contrast(layered);
  assert.deepEqual(l.offenders.map((o) => o.path), ['html > div.veil > p.b']);
  assert.equal(l.offenders[0].bg, '#808080');
});

test('contrast: text over media is not measured; a gradient is judged at its worst stop', () => {
  const media = {
    html: el({ 'background-color': 'rgb(255, 255, 255)' }),
    'html > h1': el({ color: 'rgb(255, 255, 255)' }, { text: true, media: true }),
  };
  const m = contrast(media);
  assert.equal(m.pass, false); // nothing measured is vacuous
  assert.match(m.note, /over media/);
  const grad = {
    'html > div': el({ 'bg-grad#0': 'rgb(0, 0, 0)', 'bg-grad#1': 'rgb(240, 240, 240)' }),
    'html > div > p': el({ color: 'rgb(255, 255, 255)' }, { text: true }),
  };
  assert.deepEqual(contrast(grad).offenders.map((o) => o.path), ['html > div > p']);
});

test('carriers: a carrier on the expected colour passes; a project-colour carrier left over fails', () => {
  const list = [
    { path: 'html', projectColor: 'rgb(0, 0, 0)', spectrum: null },
    { path: 'html > body > main.fp', projectColor: 'rgb(0, 0, 0)', spectrum: null },
  ];
  assert.equal(carriers(list, () => '#000000').pass, true);
  list[1].projectColor = '#c0ffee';
  const r = carriers(list, () => '#000000');
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders.map((o) => o.path), ['html > body > main.fp']);
  assert.equal(carriers(list, () => undefined).pass, false); // nothing checked is vacuous
});

test('deal: card i carries keyAt(i); a wrong key names the slug', () => {
  const keys = ['blue', 'red', 'green'];
  const keyAt = (i) => keys[i];
  const cards = [{ slug: 'a', spectrum: 'blue' }, { slug: 'b', spectrum: 'red' }, { slug: 'c', spectrum: 'green' }];
  assert.equal(deal(cards, keyAt).pass, true);
  cards[2].spectrum = 'yellow';
  const r = deal(cards, keyAt);
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders, [{ slug: 'c', index: 2, got: 'yellow', want: 'green' }]);
});

test('crossRoute: a slug keeps its key on two routes', () => {
  const work = [{ slug: 'a', spectrum: 'blue' }, { slug: 'b', spectrum: 'red' }];
  assert.equal(crossRoute(work, { a: 'blue' }).pass, true);
  const r = crossRoute(work, { a: 'blue', b: 'green' });
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders, [{ slug: 'b', a: 'red', b: 'green' }]);
  assert.equal(crossRoute(work, { z: 'blue' }).pass, false); // no shared slug is vacuous
});

test('hover: a state that paints differently passes; an identical pair fails and names the selector', () => {
  const same = { 'html > a': el({ color: 'rgb(0, 0, 0)' }) };
  const moved = { 'html > a': el({ color: 'rgb(255, 255, 255)' }) };
  assert.equal(hover([{ selector: '.cta-primary', rest: same, hover: moved }]).pass, true);
  const r = hover([{ selector: '.cta-primary', rest: same, hover: moved }, { selector: '.site-privacy', rest: same, hover: structuredClone(same) }]);
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders.map((o) => o.selector), ['.site-privacy']);
});

test('overlap: apart passes; an intersection names both boxes; only boxes read at the same scroll stop meet', () => {
  const corner = { name: '.swm-corner', x: 1300, y: 760, w: 100, h: 100, at: 0 };
  const far = { name: '.site-privacy', x: 20, y: 860, w: 120, h: 30, at: 0 };
  assert.equal(overlap([corner, far], { anchor: '.swm-corner' }).pass, true);
  const hit = { name: '.fp-scale', x: 1350, y: 800, w: 80, h: 80, at: 0 };
  const r = overlap([corner, far, hit], { anchor: '.swm-corner' });
  assert.equal(r.pass, false);
  assert.deepEqual([r.offenders[0].a, r.offenders[0].b], ['.swm-corner', '.fp-scale']);
  assert.equal(overlap([corner, { ...hit, at: 900 }], { anchor: '.swm-corner' }).pass, true);
  // without an anchor every named pair is tested
  assert.equal(overlap([far, { ...far, name: '.dir-filter', y: 870 }]).pass, false);
});

test('shares: the reference itself passes; a blue-only page fails on the missing families and the order', () => {
  const px = Object.fromEntries(Object.entries(REFERENCE_SHARES).map(([k, v]) => [k, v * 1000]));
  px.black = 5e6; // neutrals are ignored
  assert.equal(shares(px).pass, true);
  const r = shares({ blue: 1000, black: 9000 });
  assert.equal(r.pass, false);
  assert.ok(r.offenders.some((o) => o.family === 'red'));
  const flipped = shares({ ...px, green: px.red * 1.1 + 9000 }, REFERENCE_SHARES, 100);
  assert.deepEqual(flipped.offenders.map((o) => o.family), ['order']);
  assert.equal(shares({ black: 100 }).pass, false); // no chromatic pixels is vacuous
});

test('palette classifier names the swatches of color-ref.png', () => {
  const swatches = {
    '#0000ff': 'blue', '#fd361a': 'red', '#077b3e': 'green', '#a6bcda': 'periwinkle',
    '#0a2577': 'navy', '#000000': 'black', '#ffffff': 'white',
  };
  for (const [hex, want] of Object.entries(swatches)) {
    const c = parseColour(hex);
    assert.equal(classify(c.r, c.g, c.b), want, hex);
  }
  // raw buffer: 2 blue + 1 red + 1 black pixel (RGB), black ignored in the chromatic shares
  const counts = countFamilies(Uint8Array.from([0, 0, 255, 0, 0, 255, 253, 54, 26, 0, 0, 0]), 3);
  assert.deepEqual(counts, { blue: 2, red: 1, black: 1 });
  const sh = chromaticShares(counts);
  assert.ok(Math.abs(sh.blue - 66.67) < 0.01 && Math.abs(sh.red - 33.33) < 0.01);
});
