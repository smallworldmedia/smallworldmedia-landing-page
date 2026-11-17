// scheme-gate.test.mjs — the US-7 scheme probe's gates (scripts/lib/scheme-gate.mjs) on small
// hand-built dumps, each with a passing case and a failing case that names the offender, and the
// palette classifier (scripts/palette-measure.mjs) on the swatches of color-ref.png.
// Run: node --test scripts/test/scheme-gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseColour, sameColour, contrastRatio, latch, identity, monochrome, singleHue, contrast,
  carriers, deal, crossRoute, hover, overlap, shares, REFERENCE_SHARES, describeOffender,
  uniform, density, densityMin, rampStopsFromCss, outline,
  badge, seat, rightEdge, noClip, blurbClear, strip, stripClass, eyeLines, persist, menuWipe, bounds, strays, jitter,
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

test('contrast: a backdrop pseudo is the nearest background of its element’s text; an unflagged pseudo is not', () => {
  // The directory's checked filter: a white wipe box (::before, behind the label) on a black page.
  const page = (ink, flag) => ({
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    'html > button > span.label': el({ color: ink }, { text: true }),
    'html > button > span.label::before': el({ 'background-color': 'rgb(255, 255, 255)' }, flag ? { backdrop: true } : {}),
  });
  const white = contrast(page('rgb(255, 255, 255)', true)); // white ink on the white box: the 11-14 defect
  assert.deepEqual(white.offenders.map((o) => [o.path, o.bg]), [['html > button > span.label', '#ffffff']]);
  assert.equal(contrast(page('rgb(0, 0, 0)', true)).pass, true); // the chip's ink on the box
  // A box that is not behind the text (a flattened wipe, a decorative dot) leaves the page as the background.
  assert.equal(contrast(page('rgb(255, 255, 255)', false)).pass, true);
  assert.equal(contrast(page('rgb(0, 0, 0)', false)).pass, false);
  // A child's text sits on its parent's backdrop box too.
  const child = {
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    'html > span.label::before': el({ 'background-color': 'rgb(255, 255, 255)' }, { backdrop: true }),
    'html > span.label > em': el({ color: 'rgb(255, 255, 255)' }, { text: true }),
  };
  assert.deepEqual(contrast(child).offenders.map((o) => o.path), ['html > span.label > em']);
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

// ── wave 4: uniform, density, outline ───────────────────────────────────────────────────────

const RAMP_A = ['#fe3720', '#ff7d01', '#ffb803', '#1858e2', '#5c53ba', '#7852a4', '#9f4f84', '#cd4962', '#f44041'];
const rampGrad = (stops, base = 0) => Object.fromEntries(stops.map((h, i) => [`bg-grad#${base + i}`, h]));

test('uniform: two project pages that agree on every shared path pass; paths one page lacks are counted, not compared', () => {
  const chip = 'html > body > main > ul.tags > li.tag:nth-of-type(1)';
  const page = (extra = {}) => ({
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    [chip]: el({ 'background-color': 'rgb(21, 86, 229)', color: 'rgb(255, 255, 255)' }, { text: true }),
    ...extra,
  });
  const a = page();
  const b = page({ 'html > body > main > ul.tags > li.tag:nth-of-type(2)': el({ 'background-color': 'rgb(253, 54, 26)' }, { text: true }) });
  const r = uniform([{ label: 'a', els: a }, { label: 'b', els: b }]);
  assert.equal(r.pass, true, JSON.stringify(r));
  assert.equal(r.n, 2);
  assert.equal(r.skipped, 1); // the second tag only page b has
  assert.deepEqual(r.offenders, []);
});

test('uniform (negative control): one shared path that paints two colours fails and names the path and both values', () => {
  const chip = 'html > body > main > ul.tags > li.tag:nth-of-type(1)';
  const mk = (bg) => ({ html: el({ 'background-color': 'rgb(0, 0, 0)' }), [chip]: el({ 'background-color': bg }, { text: true }) });
  const r = uniform([{ label: 'one', els: mk('rgb(21, 86, 229)') }, { label: 'two', els: mk('rgb(253, 54, 26)') }]);
  assert.equal(r.pass, false);
  assert.deepEqual(r.offenders, [{ path: chip, prop: 'background-color', a: 'rgb(21, 86, 229)', b: 'rgb(253, 54, 26)', pages: 'one vs two' }]);
  assert.match(describeOffender(r.offenders[0]), /li\.tag.*background-color.*rgb\(21, 86, 229\).*rgb\(253, 54, 26\)/);
  // a property one page paints and the other does not is a difference too
  const none = uniform([{ label: 'one', els: mk('rgb(21, 86, 229)') }, { label: 'two', els: { html: el({ 'background-color': 'rgb(0, 0, 0)' }), [chip]: el({ color: 'rgb(255, 255, 255)' }) } }]);
  assert.deepEqual(none.offenders.map((o) => [o.prop, o.a, o.b]), [['background-color', 'rgb(21, 86, 229)', null], ['color', null, 'rgb(255, 255, 255)']]);
});

test('uniform: three pages compare against the first; one page, or pages sharing no path, is vacuous; plain dump maps are accepted', () => {
  const same = { html: el({ 'background-color': 'rgb(0, 0, 0)' }) };
  const odd = { html: el({ 'background-color': 'rgb(0, 0, 255)' }) };
  const r = uniform([{ label: 'a', els: same }, { label: 'b', els: structuredClone(same) }, { label: 'c', els: odd }]);
  assert.deepEqual(r.offenders.map((o) => o.pages), ['a vs c']);
  assert.equal(uniform([{ label: 'a', els: same }]).pass, false);
  assert.match(uniform([{ label: 'a', els: same }]).note, /vacuous/);
  const apart = uniform([{ label: 'a', els: { x: el({ color: 'rgb(1, 1, 1)' }) } }, { label: 'b', els: { y: el({ color: 'rgb(2, 2, 2)' }) } }]);
  assert.equal(apart.pass, false);
  assert.equal(apart.skipped, 2);
  assert.equal(uniform([same, structuredClone(same)]).pass, true);
});

test('uniform: an element only some of the pages have is still compared between the pages that have it', () => {
  const tag7 = 'html > body > main > ul.tags > li.tag:nth-of-type(7)';
  const base = { html: el({ 'background-color': 'rgb(0, 0, 0)' }) };
  const withTag = (bg) => ({ ...base, [tag7]: el({ 'background-color': bg }, { text: true }) });
  const ok = uniform([{ label: 'a', els: base }, { label: 'b', els: withTag('rgb(21, 86, 229)') }, { label: 'c', els: withTag('rgb(21, 86, 229)') }]);
  assert.equal(ok.pass, true, JSON.stringify(ok));
  assert.equal(ok.n, 2); // html on all three, the seventh tag on b and c
  assert.equal(ok.skipped, 0);
  // negative control: the two pages that have it disagree, and the offender names those two
  const bad = uniform([{ label: 'a', els: base }, { label: 'b', els: withTag('rgb(21, 86, 229)') }, { label: 'c', els: withTag('rgb(253, 54, 26)') }]);
  assert.equal(bad.pass, false);
  assert.deepEqual(bad.offenders, [{ path: tag7, prop: 'background-color', a: 'rgb(21, 86, 229)', b: 'rgb(253, 54, 26)', pages: 'b vs c' }]);
});

test('uniform: elements the probe keys by attribute (`u`) are matched by it, not by sibling position; a colour that differs under one key still fails', () => {
  const P = 'html > body > main > p.blurb:nth-of-type(1)';
  const green = el({ 'background-color': 'rgb(7, 123, 62)', color: 'rgb(255, 255, 255)' }, { text: true });
  const red = el({ 'background-color': 'rgb(253, 54, 26)', color: 'rgb(10, 10, 10)' }, { text: true });
  const u = (rec, key) => ({ ...rec, u: `${P} > ${key}` });
  // Page a's blurb opens with a link, so its first keyword sits in slot 2; page b's first is slot 1.
  const a = {
    [`${P} > mark.kw:nth-of-type(1)`]: u(green, 'mark.kw[data-kw="2"]#1'),
    [`${P} > mark.kw:nth-of-type(2)`]: u(green, 'mark.kw[data-kw="2"]#2'),
    [`${P} > mark.kw:nth-of-type(3)`]: u(red, 'mark.kw[data-kw="1"]#1'),
  };
  const b = {
    [`${P} > mark.kw:nth-of-type(1)`]: u(red, 'mark.kw[data-kw="1"]#1'),
    [`${P} > mark.kw:nth-of-type(2)`]: u(green, 'mark.kw[data-kw="2"]#1'),
  };
  const r = uniform([{ label: 'a', els: a }, { label: 'b', els: b }]);
  assert.equal(r.pass, true, JSON.stringify(r));
  assert.equal(r.n, 2); // slot 1 word 1, slot 2 word 1
  assert.equal(r.skipped, 1); // slot 2's second word only page a has
  // the same two pages keyed by sibling position are the false alarm this key removes
  const strip = (els) => Object.fromEntries(Object.entries(els).map(([k, { u: _u, ...rec }]) => [k, rec]));
  assert.equal(uniform([{ label: 'a', els: strip(a) }, { label: 'b', els: strip(b) }]).pass, false);
  // negative control: one slot painted two colours fails, named by its key
  const odd = { ...b, [`${P} > mark.kw:nth-of-type(2)`]: u(red, 'mark.kw[data-kw="2"]#1') };
  const bad = uniform([{ label: 'a', els: a }, { label: 'c', els: odd }]);
  assert.equal(bad.pass, false);
  assert.deepEqual([...new Set(bad.offenders.map((o) => o.path))], [`${P} > mark.kw[data-kw="2"]#1`]);
  assert.deepEqual(bad.offenders.map((o) => o.prop).sort(), ['background-color', 'color']);
});

test('density: a page painting six families passes with them listed; one painting two fails with them listed and the threshold', () => {
  const six = {
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    'html > a.blue': el({ 'background-color': 'rgb(21, 86, 229)', color: 'rgb(255, 255, 255)' }, { text: true }),
    'html > a.red': el({ 'background-color': 'rgb(253, 54, 26)', color: 'rgb(10, 10, 10)' }, { text: true }),
    'html > a.green': el({ 'background-color': 'rgb(7, 123, 62)' }),
    'html > a.yellow': el({ color: 'rgb(251, 183, 2)' }, { text: true }),
    'html > a.peri': el({ 'border-top-color': 'rgb(166, 188, 218)' }),
    'html > a.white': el({ 'background-color': 'rgb(255, 255, 255)' }),
  };
  const r = density(six);
  assert.equal(r.pass, true, JSON.stringify(r));
  assert.deepEqual(r.families, ['blue', 'red', 'green', 'yellow', 'periwinkle', 'white-ground']);
  assert.match(r.note, /6\/8 families \(blue, red, green, yellow, periwinkle, white-ground\), need 5/);
  const two = density({ html: el({ 'background-color': 'rgb(0, 0, 0)' }), 'html > a': el({ 'background-color': 'rgb(21, 86, 229)', color: 'rgb(253, 54, 26)' }, { text: true }) });
  assert.equal(two.pass, false);
  assert.deepEqual(two.offenders, [{ path: '(page)', families: ['blue', 'red'], count: 2, min: 5 }]);
  assert.match(two.note, /2\/8 families \(blue, red\), need 5/);
  assert.match(describeOffender(two.offenders[0]), /\(page\).*count=2.*min=5/);
  assert.equal(density(six, { min: 6 }).pass, true);
  assert.equal(density(six, { min: 7 }).pass, false);
});

test('density: white counts as a ground only; alpha below 1 and unrelated colours do not count', () => {
  const dump = {
    html: el({ 'background-color': 'rgb(0, 0, 0)' }),
    'html > p.ink': el({ color: 'rgb(255, 255, 255)', 'border-top-color': 'rgb(255, 255, 255)' }, { text: true }), // white text and a hairline
    'html > p.veil': el({ 'background-color': 'rgba(21, 86, 229, 0.5)' }), // blue at 50%
    'html > p.near': el({ 'background-color': 'rgb(21, 86, 200)' }), // not the swatch
  };
  assert.deepEqual(density(dump).families, []);
  const ground = { ...dump, 'html > span.pill': el({ 'background-color': 'rgb(255, 255, 255)' }) };
  assert.deepEqual(density(ground).families, ['white-ground']);
  const spread = { ...dump, 'html > span.kw': el({ 'shadow#0': 'rgb(255, 255, 255)' }, { text: true }) }; // a ground behind boxless text
  assert.deepEqual(density(spread).families, ['white-ground']);
  assert.equal(density({}).pass, false); // an empty dump is vacuous
});

test('density: a gradient carrying three ramp A stops is the ramp; two stops, or ramp B, is not', () => {
  const page = (paint) => ({ html: el({ 'background-color': 'rgb(0, 0, 0)' }), 'html > div.ring': el(paint) });
  const ramp = density(page(rampGrad(RAMP_A)), { rampStops: RAMP_A });
  assert.deepEqual(ramp.families, ['ramp']);
  assert.equal(density(page(rampGrad(RAMP_A.slice(0, 3))), { rampStops: RAMP_A }).families.includes('ramp'), true);
  assert.equal(density(page(rampGrad(RAMP_A.slice(0, 2))), { rampStops: RAMP_A }).families.includes('ramp'), false);
  // three stops spread over two different elements are not one gradient
  const split = { html: el({ 'background-color': 'rgb(0, 0, 0)' }), 'html > i.a': el(rampGrad(RAMP_A.slice(0, 2))), 'html > i.b': el(rampGrad(RAMP_A.slice(2, 4))) };
  assert.equal(density(split, { rampStops: RAMP_A }).families.includes('ramp'), false);
  // ramp B (blue falling into black) is blue and navy, not the ramp
  const b = density(page(rampGrad(['#1556e5', '#0c44cc', '#0c2c8c', '#0a2577', '#071249', '#000000'])), { rampStops: RAMP_A });
  assert.deepEqual(b.families, ['blue', 'navy']);
  assert.match(density(page({}), { rampStops: [] }).note, /ramp A stops unread/);
});

test('densityMin: 5 on home, work, detail and directory, 3 on privacy and 404; --density replaces the 5 only', () => {
  assert.deepEqual(['home', 'work', 'detail', 'detail#3', 'directory', 'privacy', '404'].map((r) => densityMin(r)), [5, 5, 5, 5, 5, 3, 3]);
  assert.deepEqual(['home', 'detail#3', 'privacy', '404'].map((r) => densityMin(r, 4)), [4, 4, 3, 3]);
});

test('rampStopsFromCss reads the nine stops of --swm-ramp-a and resolves a var() stop', () => {
  const css = ':root { --swm-violet: #7852a4; --swm-ramp-a: #fe3720, #ff7d01, var(--swm-violet), #9f4f84; /* var(--swm-ramp-a) */ }';
  assert.deepEqual(rampStopsFromCss(css), ['#fe3720', '#ff7d01', '#7852a4', '#9f4f84']);
  assert.deepEqual(rampStopsFromCss('a { color: red }'), []);
  // the stylesheet the probe reads: nine stops, the contract's (src/lib/spectrumRamp.js SPECTRUM_RAMP_A)
  const real = fs.readFileSync(new URL('../../src/styles/global.css', import.meta.url), 'utf8');
  assert.deepEqual(rampStopsFromCss(real), RAMP_A);
});

test('outline: mix 1 and a centre 0.4 px from the ring passes; 6 px away fails with both centres; no ramp field skips', () => {
  const ring = [720, 450];
  const near = outline({ accent: '#1556e5', ramp: { mix: 1, center: [720.3, 450.27] } }, { name: 'globe', ring });
  assert.equal(near.pass, true, JSON.stringify(near));
  assert.match(near.note, /globe ramp\.mix 1, centre 0\.4 px from the ring/);
  assert.equal(near.n, 2);
  const far = outline({ ramp: { mix: 1, center: [726, 450] } }, { name: 'globe', ring });
  assert.equal(far.pass, false);
  assert.deepEqual(far.offenders, [{ path: 'globe().ramp.center', got: [726, 450], want: [720, 450], dist: 6, tol: 1.5 }]);
  assert.match(describeOffender(far.offenders[0]), /globe\(\)\.ramp\.center.*got=\[726,450\].*want=\[720,450\]/);
  const none = outline({ accent: '#1556e5' }, { name: 'globe', ring });
  assert.equal(none.skip, true);
  assert.equal(none.pass, false);
  assert.equal(none.note, 'skipped (hook has no ramp)');
  // the edge of the tolerance
  assert.equal(outline({ ramp: { mix: 1, center: [721.5, 450] } }, { ring }).pass, true);
  assert.equal(outline({ ramp: { mix: 1, center: [721.6, 450] } }, { ring }).pass, false);
});

test('outline: the mix must be 1 under spectrum (the worlds hook has no centre) and 0 under any other scheme', () => {
  const worlds = outline({ ramp: { mix: 1 } }, { name: 'worlds', mix: 1 });
  assert.equal(worlds.pass, true);
  assert.equal(worlds.n, 1);
  const half = outline({ ramp: { mix: 0.5 } }, { name: 'worlds', mix: 1 });
  assert.deepEqual(half.offenders, [{ path: 'worlds().ramp.mix', got: 0.5, want: 1 }]);
  assert.equal(outline({ ramp: { mix: 0, center: [0, 0] } }, { name: 'globe', mix: 0 }).pass, true);
  assert.deepEqual(outline({ ramp: { mix: 1 } }, { name: 'globe', mix: 0 }).offenders, [{ path: 'globe().ramp.mix', got: 1, want: 0 }]);
  // a ring that was not found, a centre that is not a point, a missing or errored hook
  assert.deepEqual(outline({ ramp: { mix: 1, center: [1, 2] } }, { ring: null }).offenders.map((o) => o.want), ['ring not found']);
  assert.equal(outline({ ramp: { mix: 1 } }, { ring: [1, 2] }).pass, false);
  assert.equal(outline(undefined, { name: 'globe' }).note, 'skipped (no globe hook)');
  assert.equal(outline({ error: 'boom' }, { name: 'worlds' }).skip, true);
});

// ── SQ-107: the eye in its rectangular badge. Each gate has a passing case and a negative control. ──

// The eye is 48 x 28, the badge hugs it by 6 px on every side: 60 x 40.
const eyeIn = (t) => ({ x: t.x + 6, y: t.y + 6, w: 48, h: 28 });

test('badge gate the tile sits on the viewport edge as a horizontal rectangle at the corner row', () => {
  const vp = { w: 390, h: 844 };
  // centred 31 px above the bottom: y + h / 2 = 844 - 31
  const t = { x: 330, y: 793, w: 60, h: 40 };
  const ok = badge(t, vp, { eye: eyeIn(t), rowCy: 31 });
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  // negative controls: an inset tile (the rejected pass 4 home seat, 4 px short), a square tile, no tile, no row
  const inset = { x: 326, y: 793, w: 60, h: 40 };
  const bad = badge(inset, vp, { eye: eyeIn(inset), rowCy: 31 });
  assert.equal(bad.pass, false);
  assert.match(bad.offenders[0].note, /right edge is 4 from the viewport's, want 0/);
  const square = { x: 340, y: 783, w: 50, h: 50 };
  const sq = badge(square, vp, { eye: eyeIn(square), rowCy: 31 });
  assert.equal(sq.pass, false);
  assert.match(sq.offenders[0].note, /not a horizontal rectangle/);
  assert.equal(badge(null, vp).pass, false);
  assert.match(badge(t, vp, { eye: eyeIn(t) }).offenders[0].note, /no corner row measured/, 'no row measured proves nothing');
  // a tile 0.4 px short is inside the 0.5 px tolerance, 0.7 px is not
  assert.equal(badge({ ...t, x: 329.6 }, vp, { eye: eyeIn({ ...t, x: 329.6 }), rowCy: 31 }).pass, true);
  assert.equal(badge({ ...t, x: 329.3 }, vp, { rowCy: 31 }).pass, false);
});

test('badge gate the padding is equal on all four sides and an unequal one names itself', () => {
  const vp = { w: 1440, h: 900 };
  const t = { x: 1380, y: 849, w: 60, h: 40 };
  assert.equal(badge(t, vp, { eye: eyeIn(t), rowCy: 31 }).pass, true);
  const tall = badge({ x: 1380, y: 844, w: 60, h: 50 }, vp, { eye: { x: 1386, y: 855, w: 48, h: 28 }, rowCy: 31 });
  assert.equal(tall.pass, false);
  assert.match(tall.offenders[0].note, /padding is not equal on four sides/);
  const wide = badge({ x: 1362, y: 849, w: 78, h: 40 }, vp, { eye: { x: 1386, y: 855, w: 48, h: 28 }, rowCy: 31 });
  assert.equal(wide.pass, false, 'a badge wider than the eye by more than its height is not hugging it');
});

test('badge gate one seat on every route, the corner row not the viewport corner and not the links footer', () => {
  const vp = { w: 1440, h: 900 };
  const on = { x: 1380, y: 849, w: 60, h: 40 };
  const ok = badge(on, vp, { eye: eyeIn(on), rowCy: 31 });
  assert.equal(ok.pass, true);
  assert.match(ok.note, /seated/);
  // negative controls: the flush corner (what pass 7 retires), riding up a footer
  const corner = { x: 1380, y: 860, w: 60, h: 40 };
  const c = badge(corner, vp, { eye: eyeIn(corner), rowCy: 31 });
  assert.equal(c.pass, false);
  assert.ok(c.offenders.some((o) => /centre 20 above the bottom is not the corner row's 31/.test(o.note)));
  const ride = { x: 1380, y: 757, w: 60, h: 40 };
  assert.equal(badge(ride, vp, { eye: eyeIn(ride), rowCy: 31 }).pass, false, 'riding the footer is not the seat');
});

test('seat gate the same gap above the bottom on every route and stop passes and a route that sits differently names itself', () => {
  const at = (label, gap) => ({ label, gap });
  const ok = seat([at('home rest', 17.31), at('home end', 17.31), at('work rest', 17.31), at('process end', 17.6)]);
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /4 seats/);
  // negative controls: the old flush corner on /work (0), a footer-riding route, a missing gap, one lone sample
  const flush = seat([at('home rest', 17.31), at('work rest', 0)]);
  assert.equal(flush.pass, false);
  assert.ok(flush.offenders.some((o) => o.path === 'home rest' || o.path === 'work rest'));
  assert.equal(seat([at('home rest', 17.31), at('directory end', 61)]).pass, false);
  assert.equal(seat([at('home rest', 17.31), at('work rest', NaN)]).pass, false);
  assert.equal(seat([at('home rest', 17.31)]).pass, false, 'one measurement compares to nothing');
  assert.equal(seat([]).pass, false);
  assert.equal(seat(null).pass, false);
});

test('badge gate and seat gate at 768 and under the bottom edge clears the screen corner and a badge left at the sitewide seat fails', () => {
  const vp = { w: 390, h: 844 };
  const raised = { x: 348.77, y: 760.62, w: 41.23, h: 27.38 }; // bottom 56 above the viewport's bottom
  const eye = { x: 352.77, y: 764.62, w: 33.23, h: 19.38 };
  const ok = badge(raised, vp, { eye, clear: 56 });
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /clearance 56/);
  // the corner-row rule is a desktop rule: on a phone no row is needed and the row's 31 does not fail the raise
  assert.equal(badge(raised, vp, { eye, clear: 56, rowCy: 31 }).pass, true);
  // negative control: the phone rule removed leaves the sitewide seat, 17.31 above the bottom, and the gate FAILS
  const sitewide = { ...raised, y: 844 - 17.31 - 27.38 };
  const low = badge(sitewide, vp, { eye: { ...eye, y: sitewide.y + 4 }, clear: 56, rowCy: 31 });
  assert.equal(low.pass, false);
  assert.match(low.offenders[0].note, /bottom edge is 17\.31 above the viewport's bottom, under the phone clearance 56 /);
  // half a pixel short is inside the tolerance, a pixel is not
  assert.equal(badge({ ...raised, y: raised.y + 0.4 }, vp, { clear: 56 }).pass, true);
  assert.equal(badge({ ...raised, y: raised.y + 1 }, vp, { clear: 56 }).pass, false);
  // 0 (?schemeclear=0) means today's seat: any non-negative gap passes, so the dial is not forced
  assert.equal(badge(sitewide, vp, { eye: { ...eye, y: sitewide.y + 4 }, clear: 0 }).pass, true);
  // the seat gate: one gap everywhere AND every gap at the clearance
  const at = (label, gap, clear = 56) => ({ label, gap, clear });
  const seated = seat([at('home rest', 56), at('work end', 56), at('process rest', 56.2)]);
  assert.equal(seated.pass, true, JSON.stringify(seated.offenders));
  const lost = seat([at('home rest', 17.31), at('work rest', 17.31)]);
  assert.equal(lost.pass, false, 'one seat everywhere but under the clearance is still a fail');
  assert.ok(lost.offenders.every((o) => /under the phone clearance 56$/.test(o.note)));
  assert.equal(seat([at('home rest', 17.31, null), at('work rest', 17.31, null)]).pass, true, 'above 768px no clearance applies: the seat is unchanged');
});

test('rightEdge gate every state on the viewport edge passes and a short or missing or unreadable one fails', () => {
  const at = (right, vw, label = 'home@1440 rest') => ({ label, right, vw });
  const ok = rightEdge([at(390, 390), at(1024, 1024, 'work@1024 engaged'), at(1440.3, 1440), at(1919.6, 1920, 'privacy@1920 rest')]);
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /4 states/);
  // negative controls: the pass 4 home inset (4 px), a half pixel over, an unreadable sample, nothing measured
  const inset = rightEdge([at(1436, 1440)]);
  assert.equal(inset.pass, false);
  assert.match(inset.offenders[0].note, /4 px short/);
  assert.equal(rightEdge([at(1439.4, 1440)]).pass, false);
  assert.equal(rightEdge([at(NaN, 1440)]).pass, false);
  assert.equal(rightEdge([]).pass, false);
  assert.equal(rightEdge(null).pass, false);
});

test('noClip gate circles whole inside a box or wholly outside it pass and a visible circle straddling a clip edge fails', () => {
  const win = { name: 'div.fp-scale__window', x: 1380, y: 700, w: 60, h: 180 };
  const frame = (label, circles) => ({ label, circles, clips: [win] });
  const inside = { name: 'circle k=2', op: 1, x: 1390, y: 760, w: 30, h: 30 };
  const outside = { name: 'circle k=5', op: 1, x: 1390, y: 960, w: 30, h: 30 };
  assert.equal(noClip([frame('f0', [inside, outside])]).pass, true);
  // negative controls: a visible circle cut by the window's bottom edge, then by its side edge
  const cut = { name: 'circle k=3', op: 0.8, x: 1390, y: 860, w: 30, h: 30 };
  const bad = noClip([frame('f7', [inside, cut])]);
  assert.equal(bad.pass, false);
  assert.match(bad.offenders[0].note, /visible circle cut by div.fp-scale__window: 10 px outside it/);
  assert.equal(bad.offenders[0].frame, 'f7');
  assert.equal(noClip([frame('f8', [{ ...inside, x: 1370 }])]).pass, false, 'cut by the side edge');
  // the same cut circle faded out (opacity 0.02) is not shown, so it is not cut
  assert.equal(noClip([frame('f9', [{ ...cut, op: 0.02 }])]).pass, true);
  // no frames, and a frame with no clip box (nothing can cut)
  assert.equal(noClip([]).pass, false);
  assert.equal(noClip([{ label: 'f0', circles: [cut], clips: [] }]).pass, true);
});

test('blurbClear gate a badge above or beside the blurb text passes and one over its last words fails with the overlap', () => {
  const blurb = { x: 4, y: 816, w: 1417, h: 27 }; // 1440 wide: the nowrap line ends 19 px short of the right edge
  assert.equal(blurbClear({ x: 1368, y: 725, w: 72, h: 72 }, blurb).pass, true, 'above the footer text');
  assert.equal(blurbClear({ x: 1368, y: 816, w: 72, h: 72 }, { ...blurb, w: 1300 }).pass, true, 'a shorter line ends before the tile');
  // negative control: the flush tile on the corner (the rejected 5163e2a) covers the end of the line
  const hit = blurbClear({ x: 1368, y: 828, w: 72, h: 72 }, blurb);
  assert.equal(hit.pass, false);
  assert.match(hit.offenders[0].note, /covers 53 x 15 px of the blurb/);
  assert.equal(blurbClear(null, blurb).pass, false);
  assert.equal(blurbClear({ x: 1368, y: 725, w: 72, h: 72 }, null).pass, false, 'no blurb measured proves nothing');
});

test('overlap gate the tile resting on the links footer top is touching and passes and one pixel into it fails', () => {
  const footer = { name: '.site-footer--links', x: 0, y: 797, w: 1440, h: 258, at: 0 };
  const tile = { name: '.swm-corner', x: 1368, y: 725, w: 72, h: 72, at: 0 };
  assert.equal(overlap([tile, footer], { anchor: '.swm-corner' }).pass, true);
  assert.equal(overlap([{ ...tile, y: 726 }, footer], { anchor: '.swm-corner' }).pass, false);
});

const px = (c, n) => Array.from({ length: n }, () => c);
const BLUE = [0, 0, 255];
const BLACK = [0, 0, 0];
const GLASS = [226, 226, 230];
const col = (...runs) => runs.flatMap(([c, n]) => px(c, n));

test('strip gate the panel classes are blue and black and glass is anything else over the page', () => {
  assert.equal(stripClass([0, 0, 255]), 'blue');
  assert.equal(stripClass([0, 0, 0]), 'black');
  assert.equal(stripClass([226, 226, 230]), 'glass');
  assert.equal(stripClass([60, 60, 60]), 'glass', 'a grey over the page is a veil, not black');
  assert.equal(stripClass([0, 0, NaN]), null);
});

test('strip gate at a whole position one panel fills the badge and it is the stations', () => {
  // order: project glass, black, blue, round again
  const whole = (q, c) => ({ q, col: px(c, 52) });
  const ok = strip([whole(0, GLASS), whole(1, BLACK), whole(2, BLUE), whole(3, GLASS), whole(-1, BLUE)]);
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  // negative controls: the wrong colour at a detent (a strip that did not follow q), two panels where one should be
  const wrong = strip([whole(1, GLASS)]);
  assert.equal(wrong.pass, false);
  assert.match(wrong.offenders[0].note, /want one black panel filling the badge, got glass x52/);
  const seamed = strip([{ q: 2, col: col([BLUE, 40], [GLASS, 12]) }]);
  assert.equal(seamed.pass, false, 'a sliver of the neighbour at a detent');
});

test('strip gate between detents the current panel leaves by the top and the next rises from the bottom with the seam at fraction x height', () => {
  const h = 52;
  const between = (q, top, bottom, seam) => ({ q, col: col([top, seam], [bottom, h - seam]) });
  // q 0.25: glass keeps the top 75 percent, black takes the bottom 25. q 1.5: black above blue, half and half.
  const ok = strip([between(0.25, GLASS, BLACK, 39), between(0.5, GLASS, BLACK, 26), between(1.5, BLACK, BLUE, 26), between(2.75, BLUE, GLASS, 13), between(3.5, GLASS, BLACK, 26)]);
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  // negative controls: a seam that did not move with q (half way at q 0.25), the panels in the wrong order, a third colour
  const stuck = strip([between(0.25, GLASS, BLACK, 26)]);
  assert.equal(stuck.pass, false);
  assert.match(stuck.offenders[0].note, /seam at row 26 of 52, want 39/);
  const reversed = strip([between(0.5, BLACK, GLASS, 26)]);
  assert.equal(reversed.pass, false);
  assert.match(reversed.offenders[0].note, /want glass above black/);
  assert.equal(strip([{ q: 0.5, col: col([GLASS, 20], [BLACK, 16], [BLUE, 16]) }]).pass, false, 'three panels at once');
  assert.equal(strip([]).pass, false, 'no frames proves nothing');
  assert.equal(strip([{ q: 1, col: [] }]).pass, false);
});

test('eyeLines gate white strokes pass and a dark stroke names the shape', () => {
  const lids = { path: 'path.scheme-eye__lid', stroke: 'rgb(255, 255, 255)', width: 1.5 };
  const globe = { path: 'use', stroke: 'rgb(255, 255, 255)', width: 1.04 };
  assert.equal(eyeLines([lids, globe, { path: 'g', stroke: 'none', width: 0 }]).pass, true);
  // negative control: the old 50% black edge round the lids
  const old = eyeLines([lids, { path: 'path.scheme-eye__edge', stroke: 'color(srgb 0 0 0 / 0.5)', width: 3.1 }]);
  assert.equal(old.pass, false);
  assert.equal(old.offenders[0].path, 'path.scheme-eye__edge');
  assert.equal(eyeLines([]).pass, false, 'nothing measured proves nothing');
});

test('persist gate one node at opacity 1 visible on every frame passes and a fade or a remount or a gap fails and says which frame', () => {
  const ok = Array.from({ length: 30 }, () => ({ same: true, op: '1', vis: 'visible' }));
  assert.equal(persist(ok).pass, true);
  const fade = ok.map((s, i) => (i >= 10 && i < 14 ? { ...s, op: '0.4' } : s));
  const f = persist(fade);
  assert.equal(f.pass, false);
  assert.equal(f.offenders[0].frame, 10);
  assert.match(f.offenders[0].note, /opacity 0\.4/);
  assert.equal(persist(ok.map((s, i) => (i === 5 ? { ...s, same: false } : s))).pass, false, 'a remount');
  assert.equal(persist(ok.map((s, i) => (i === 5 ? { gone: true } : s))).pass, false, 'a gap');
  assert.equal(persist(ok.map((s, i) => (i === 7 ? { ...s, vis: 'hidden' } : s))).pass, false, 'a hide');
  assert.equal(persist([]).pass, false, 'no frames measured proves nothing');
  // the phone menu's takeover covers the badge by design: its frames are skipped and counted, never forgiven elsewhere
  const menu = persist([{ same: true, op: '1', vis: 'visible' }, { same: true, op: '1', vis: 'hidden', menu: true }]);
  assert.equal(menu.pass, true);
  assert.match(menu.note, /1 under the phone menu/);
  assert.equal(persist([{ same: true, op: '1', vis: 'hidden', menu: false }]).pass, false, 'hidden with no menu up is a fade');
});

test('persist gate the badge paint is never covered by a route fill and a covered frame names its time', () => {
  const ok = Array.from({ length: 30 }, () => ({ same: true, op: '1', vis: 'visible' }));
  const paints = (ns) => ns.map((n, i) => ({ t: i * 120, n }));
  // 300 pixels of iris at rest: every frame keeps at least a quarter of it (the count follows the page behind the glass)
  const kept = persist(ok, { pixels: paints([300, 296, 304, 290, 301]), rest: 300 });
  assert.equal(kept.pass, true, JSON.stringify(kept.offenders));
  assert.match(kept.note, /5 paints \(0 covered\)/);
  // negative controls: the passage's fill over the badge (the old z 43 seat), no paint read, no rest read
  const covered = persist(ok, { pixels: paints([300, 296, 12, 3, 0, 4, 280]), rest: 300 });
  assert.equal(covered.pass, false);
  assert.match(covered.offenders[0].note, /covered: 12 iris pixels of 300 at rest/);
  assert.equal(covered.offenders[0].t, 240);
  assert.equal(persist(ok, { pixels: [], rest: 300 }).pass, false, 'nothing seen');
  assert.equal(persist(ok, { pixels: paints([300]), rest: 0 }).pass, false, 'no rest paint');
});

test('bounds gate a circle inside its window passes and one wider than the window names itself', () => {
  const box = { name: '.fp-scale__window', x: 100, y: 0, w: 89, h: 144 };
  assert.equal(bounds([{ name: 'lens', x: 120.4, y: 40, w: 48.1, h: 48.1 }], box).pass, true);
  // negative control: the old window (the resting eye, 48 wide, centred) under a lens circle lifted to 3 (78 wide)
  const old = bounds([{ name: 'lens', x: 122, y: 40, w: 78, h: 78 }], { ...box, x: 144.5, w: 48 });
  assert.equal(old.pass, false);
  assert.equal(old.offenders[0].path, 'lens');
  assert.equal(bounds([{ name: 'lens', x: 90, y: 40, w: 48, h: 48 }], box).pass, false, 'off the left edge');
  assert.equal(bounds([{ name: 'far', op: 0, x: 90, y: 40, w: 48, h: 48 }], box).pass, true, 'a circle that is not shown cannot be out of bounds');
  assert.equal(bounds([], box).pass, false);
});

test('strays gate anti-alias noise passes and a station painted outside the shown rows fails', () => {
  assert.equal(strays({ pixels: 0, total: 5000, at: 0.35 }).pass, true);
  // measured on the fixed column: 1-3 px of 134400 (layer-promotion rounding on the shown eye, delta <= 19)
  assert.equal(strays({ pixels: 3, total: 134400, at: 0.5, maxDelta: 19, box: '190,363..191,364' }).pass, true);
  // measured on the broken column (--eye-reach forced to 1): 50-105 px per scrub, delta up to 74
  const bad = strays({ pixels: 50, total: 134400, at: 0.15, maxDelta: 33, box: '199,315..203,430' });
  assert.equal(bad.pass, false);
  assert.equal(bad.offenders[0].pixels, 50);
  assert.equal(strays({ pixels: 9, total: 134400, at: 0.5 }).pass, false, 'just past the noise ceiling');
  assert.equal(strays({ pixels: 9, total: 134400, at: 0.5 }, { tol: 9 }).pass, true, 'the ceiling is a parameter');
  assert.equal(strays(undefined).pass, false, 'nothing measured proves nothing');
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

// ── SQ-107 pass 5: the globe's centre in the eye moves on one path in x and y (the jitter gate). ──

// An ease from the rest pose (x 1419.3, y 888) to the engaged pose (x 1408.6, y 871.3), eight to a dozen real-time samples.
const ease = (n, a, b) => Array.from({ length: n }, (_, i) => a + (b - a) * (1 - (1 - i / (n - 1)) ** 3));
const path = (n, from, to) => { const xs = ease(n, from.x, to.x); const ys = ease(n, from.y, to.y); return xs.map((x, i) => ({ x: +x.toFixed(3), y: +ys[i].toFixed(3) })); };
const REST = { x: 1419.3, y: 888 };
const OUT = { x: 1408.6, y: 871.3 };

test('jitter gate a steady ease in both axes with the settle on the last frame passes', () => {
  const up = path(40, REST, OUT);
  const down = path(40, OUT, REST);
  const ok = jitter({ engage: up, release: down, settledUp: { x: 1408.6, y: 871.31 }, settledDown: { x: 1419.3, y: 888 } });
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /40 \+ 40 samples/);
  assert.match(ok.note, /worst settle step [\d.]+ px \(limit 0\.5\), worst reversal [\d.]+ px \(limit 0\.25\)/, 'a pass prints the numbers it passed with');
  // centroid noise (0.1 px, the measured floor) is not a reversal, and a 0.4 px settle is inside the 0.5 px bound
  const noisy = up.map((q, i) => ({ x: q.x + (i % 2 ? 0.05 : -0.05), y: q.y }));
  assert.equal(jitter({ engage: noisy, release: down, settledUp: { x: 1409, y: 871.3 }, settledDown: REST }).pass, true);
});

test('jitter gate a left jolt at settle and a reversal in either axis and a missing run all fail', () => {
  const up = path(40, REST, OUT);
  const down = path(40, OUT, REST);
  // the left jolt: the settled pose 1.6 px left of the last animated frame (the iris hands over to a circle off by a px or two)
  const jolt = jitter({ engage: up, release: down, settledUp: { x: 1407, y: 871.3 }, settledDown: REST });
  assert.equal(jolt.pass, false);
  assert.equal(jolt.offenders[0].axis, 'x');
  assert.match(jolt.offenders[0].note, /snap of 1.6 px at settle/);
  // the same jolt in y
  const down1 = jitter({ engage: up, release: down, settledUp: OUT, settledDown: { x: 1419.3, y: 886.6 } });
  assert.equal(down1.pass, false);
  assert.equal(down1.offenders[0].axis, 'y');
  // a reversal: the iris drifts back right by 1 px mid-flight
  const back = up.map((q, i) => (i >= 20 && i < 30 ? { ...q, x: q.x + 1 } : q));
  const r = jitter({ engage: back, release: down, settledUp: OUT, settledDown: REST });
  assert.equal(r.pass, false);
  assert.match(r.offenders[0].note, /gave back [01]\.\d\d px against its direction of travel/);
  assert.equal(jitter(null).pass, false);
  assert.equal(jitter({ engage: up.slice(0, 4), release: down, settledUp: OUT, settledDown: REST }).pass, false, 'too few samples proves nothing');
  assert.equal(jitter({ engage: up, release: down, settledUp: OUT }).pass, false, 'a missing settled pose proves nothing');
});

// SQ-107 pass 8: the phone menu wipes over the badge (menuWipe), the frames a 390 x 844 run samples
const TILE = { x: 340, y: 760, w: 50, h: 40 }; // the badge's box, bottom 800 of 844
const H = 844;
const mf = (phase, edge, extra = {}) => ({ phase, edge, h: H, up: edge < H, zMenu: 102, zBadge: 101, op: '1', vis: 'visible', inert: edge < H, ...extra });
const ramp = (phase, from, to, n) => Array.from({ length: n }, (_, i) => mf(phase, from + ((to - from) * (i + 1)) / n));
// open: the edge rises through the badge's box (844 to 0), a hold, close: back down, then a page change from the menu
const GOOD = [
  mf('open', H),
  ...ramp('open', H, 0, 120),
  ...Array.from({ length: 10 }, () => mf('hold', 0)),
  ...ramp('close', 0, H, 120),
  mf('close', H, { up: false, inert: false }),
  ...ramp('change-open', H, 0, 120),
  ...Array.from({ length: 20 }, () => mf('change', 0)),
  ...ramp('change', 0, H, 120),
  mf('change', H, { up: false, inert: false }),
];

test('menuWipe gate the edge crosses the badge in, holds, and crosses it out with the badge drawn and under the menu every frame', () => {
  const ok = menuWipe(GOOD, TILE);
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /edge across the badge \d+ in \/ \d+ out/);
});

test('menuWipe gate the old visibility hide fails on the first frame the whole badge goes', () => {
  // negative control: html[data-menu-open] .swm-corner { visibility: hidden } restored, at once as the wipe starts
  const hidden = GOOD.map((f) => (f.up ? { ...f, vis: 'hidden' } : f));
  const r = menuWipe(hidden, TILE);
  assert.equal(r.pass, false);
  assert.match(r.offenders[0].note, /the badge was hidden as a whole \(visibility hidden\)/);
  assert.equal(r.offenders[0].phase, 'open');
  const one = menuWipe(GOOD.map((f, i) => (i === 30 ? { ...f, vis: 'hidden' } : f)), TILE);
  assert.equal(one.pass, false, 'one frame of it is enough');
});

test('menuWipe gate a fade of the badge and a badge that paints over the menu both fail', () => {
  const fade = menuWipe(GOOD.map((f, i) => (i >= 70 && i < 74 ? { ...f, op: '0.4' } : f)), TILE);
  assert.equal(fade.pass, false);
  assert.match(fade.offenders[0].note, /faded as a whole \(opacity 0\.4\)/);
  // the old stacking: the menu inside the shell (z 100) under the badge (z 101)
  const under = menuWipe(GOOD.map((f) => ({ ...f, zMenu: 100 })), TILE);
  assert.equal(under.pass, false);
  assert.match(under.offenders[0].note, /the badge paints over the menu \(stacking level 101 against the menu's 100\)/);
  assert.equal(menuWipe(GOOD.map((f) => (f.up ? { ...f, inert: false } : f)), TILE).pass, false, 'swatches reachable under the menu');
});

test('menuWipe gate an edge that goes back, or a menu not fully up in the hold, fails', () => {
  const back = GOOD.map((f, i) => (i === 20 ? { ...f, edge: f.edge + 40 } : f));
  const r = menuWipe(back, TILE);
  assert.equal(r.pass, false);
  assert.ok(r.offenders.some((o) => /went back down/.test(o.note)));
  const loose = menuWipe(GOOD.map((f) => (f.phase === 'hold' ? { ...f, edge: 30 } : f)), TILE);
  assert.equal(loose.pass, false);
  assert.match(loose.offenders[0].note, /not fully up/);
  const out = GOOD.map((f, i) => (f.phase === 'close' && i === 200 ? { ...f, edge: f.edge - 30 } : f));
  assert.ok(menuWipe(out, TILE).offenders.some((o) => /went back up/.test(o.note)));
});

test('menuWipe gate a run that never saw the edge cross the badge proves nothing', () => {
  // real-time frames: the steep launch clears the 40 px box in one frame
  const jump = [mf('open', H), mf('open', 300), mf('open', 0), mf('hold', 0), mf('close', 300), mf('close', H, { up: false, inert: false })];
  const r = menuWipe(jump, TILE);
  assert.equal(r.pass, false);
  assert.match(r.offenders[0].note, /only 0 frame\(s\) caught the edge inside the badge's box on the way in/);
  assert.equal(menuWipe([], TILE).pass, false);
  assert.equal(menuWipe(GOOD, null).pass, false, 'no badge box');
});

test('menuWipe gate reduced motion snaps the menu, so the edge is only ever up or down', () => {
  const snap = [mf('open', H), mf('open', 0), mf('hold', 0), mf('close', 0), mf('close', H, { up: false, inert: false })];
  assert.equal(menuWipe(snap, TILE, { reduced: true }).pass, true);
  const fade = menuWipe([mf('open', H), mf('open', 500), mf('open', 0), mf('hold', 0)], TILE, { reduced: true });
  assert.equal(fade.pass, false);
  assert.match(fade.offenders[0].note, /reduced motion snaps it/);
});

test('menuWipe gate the pixels below the edge are the menu and above it the badge', () => {
  const rows = (e) => Array.from({ length: 40 }, (_, i) => ({ y: 760 + i, share: 760 + i >= e ? 1 : 0 }));
  const shots = [770, 775, 780, 785].map((e) => ({ e0: e, e1: e + 0.4, rows: rows(e) }));
  const ok = menuWipe(GOOD, TILE, { pixels: shots });
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /4 screenshots \(4 across the badge\)/);
  // negative control: the badge hidden whole while the edge is still below its top: the rows under the edge show the page, not the menu
  const gone = menuWipe(GOOD, TILE, { pixels: shots.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, share: 0 })) })) });
  assert.equal(gone.pass, false);
  assert.match(gone.offenders[0].note, /paints the badge, not the menu/);
  // the badge over the menu: the rows below the edge stay the badge
  const over = menuWipe(GOOD, TILE, { pixels: shots.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, share: r.y >= 790 ? 1 : 0 })) })) });
  assert.equal(over.pass, false);
  // the menu over the badge's top part: rows above the edge painted menu-coloured
  const high = menuWipe(GOOD, TILE, { pixels: shots.map((s) => ({ ...s, rows: s.rows.map((r) => ({ ...r, share: 1 })) })) });
  assert.equal(high.pass, false);
  assert.ok(high.offenders.some((o) => /paints the menu, not the badge/.test(o.note)));
  assert.equal(menuWipe(GOOD, TILE, { pixels: shots.slice(0, 2) }).pass, false, 'two screenshots across the box prove nothing');
});
