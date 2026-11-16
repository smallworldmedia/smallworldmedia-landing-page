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
  badge, blurbClear, badgeColour, eyeLines, persist, bounds, strays, jitter,
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

test('badge gate flush sits on the right and bottom edges and seat one padding short of the chrome inset and clear of the bottom and both are horizontal rectangles', () => {
  const vp = { w: 390, h: 844 };
  const ref = { navInset: 4, chromeInset: 12, rowCy: 31 };
  const t = { x: 330, y: 804, w: 60, h: 40 };
  assert.equal(badge(t, vp, 'flush', { eye: eyeIn(t), ref }).pass, true);
  const s = { x: 324, y: 640, w: 60, h: 40 };
  assert.equal(badge(s, vp, 'seat', { eye: eyeIn(s), ref }).pass, true);
  // negative controls: the seat's tile read as flush, the flush tile read as seat, an inset tile, a square tile
  const asFlush = badge(s, vp, 'flush', { eye: eyeIn(s), ref });
  assert.equal(asFlush.pass, false);
  assert.match(asFlush.offenders[0].note, /right edge is 6 from the viewport's, want 0/);
  assert.equal(badge(t, vp, 'seat', { eye: eyeIn(t), ref }).pass, false);
  const inset = { x: 318, y: 804, w: 60, h: 40 };
  const bad = badge(inset, vp, 'flush', { eye: eyeIn(inset), ref });
  assert.equal(bad.pass, false);
  assert.match(bad.offenders[0].note, /right edge is 12 /);
  const square = { x: 330, y: 794, w: 50, h: 50 };
  const sq = badge(square, vp, 'flush', { eye: eyeIn(square), ref });
  assert.equal(sq.pass, false);
  assert.match(sq.offenders[0].note, /not a horizontal rectangle/);
  assert.equal(badge(null, vp, 'flush').pass, false);
  assert.equal(badge(t, vp, 'elsewhere').pass, false);
});

test('badge gate the padding is equal on all four sides and an unequal one names itself', () => {
  const vp = { w: 1440, h: 900 };
  const t = { x: 1380, y: 860, w: 60, h: 40 };
  assert.equal(badge(t, vp, 'flush', { eye: eyeIn(t) }).pass, true);
  const tall = badge({ x: 1380, y: 850, w: 60, h: 50 }, vp, 'flush', { eye: { x: 1386, y: 866, w: 48, h: 28 } });
  assert.equal(tall.pass, false);
  assert.match(tall.offenders[0].note, /padding is not equal on four sides/);
  const wide = badge({ x: 1362, y: 860, w: 78, h: 40 }, vp, 'flush', { eye: { x: 1386, y: 866, w: 48, h: 28 } });
  assert.equal(wide.pass, false, 'a badge wider than the eye by more than its height is not hugging it');
});

test('badge gate home seats the flush badge on the corner row and its right inset', () => {
  const vp = { w: 1440, h: 900 };
  const ref = { navInset: 4, chromeInset: 12, rowCy: 31 };
  // centred 31 px above the bottom: y + h / 2 = 900 - 31
  const on = { x: 1376, y: 849, w: 60, h: 40 };
  const ok = badge(on, vp, 'flush', { eye: eyeIn(on), ref, home: true, footerTop: 797 });
  assert.equal(ok.pass, true);
  assert.match(ok.note, /\(home\)/);
  // negative controls: the corner-flush tile on home (the corner, not the row), the right edge on the viewport's, riding the footer
  const corner = { x: 1380, y: 860, w: 60, h: 40 };
  const c = badge(corner, vp, 'flush', { eye: eyeIn(corner), ref, home: true, footerTop: 797 });
  assert.equal(c.pass, false);
  assert.ok(c.offenders.some((o) => /centre 20 above the bottom is not the corner row's 31/.test(o.note)));
  assert.ok(c.offenders.some((o) => /right edge is 0 from the viewport's, want 4/.test(o.note)));
  const ride = { x: 1376, y: 757, w: 60, h: 40 };
  assert.equal(badge(ride, vp, 'flush', { eye: eyeIn(ride), ref, home: true, footerTop: 797 }).pass, false, 'riding the footer is the old home seat');
});

test('badge gate flush rides the links footer so its bottom edge is on the footer top and the viewport bottom is not the floor there', () => {
  const vp = { w: 1440, h: 900 };
  const at = (y) => ({ x: 1380, y, w: 60, h: 40 });
  const on = badge(at(757), vp, 'flush', { footerTop: 797, eye: eyeIn(at(757)) });
  assert.equal(on.pass, true);
  assert.match(on.note, /footer top 797/);
  // no footer in view (a footer top at or below the viewport's bottom edge): the corner is the floor
  assert.equal(badge(at(860), vp, 'flush', { footerTop: 1055 }).pass, true);
  assert.equal(badge(at(860), vp, 'flush').pass, true);
  // negative controls: the corner-flush tile over a visible footer (the rejected 5163e2a), a tile floating above the footer
  const over = badge(at(860), vp, 'flush', { footerTop: 797 });
  assert.equal(over.pass, false);
  assert.match(over.offenders[0].note, /bottom edge 900 is not the links footer's top 797/);
  assert.equal(badge(at(700), vp, 'flush', { footerTop: 797 }).pass, false);
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

test('badgeColour gate blue is opaque brand blue and black opaque black and project or any other a translucent veil over a blur', () => {
  const glass = { bg: 'color(srgb 1 1 1 / 0.22)', blur: 'blur(12px)' };
  assert.equal(badgeColour('blue', { bg: 'rgb(0, 0, 255)', blur: 'blur(12px)' }).pass, true);
  assert.equal(badgeColour('black', { bg: 'rgb(0, 0, 0)', blur: 'blur(12px)' }).pass, true);
  assert.equal(badgeColour('project', glass).pass, true);
  assert.equal(badgeColour('spectrum', glass).pass, true, 'the parked preview wears the glass');
  // negative controls: the wrong colour for the scheme, glass where a solid is due, a solid where glass is due, glass without a blur
  assert.equal(badgeColour('blue', { bg: 'rgb(0, 0, 0)', blur: 'blur(12px)' }).pass, false);
  assert.equal(badgeColour('black', glass).pass, false);
  assert.equal(badgeColour('blue', { bg: 'rgba(0, 0, 255, 0.5)', blur: 'blur(12px)' }).pass, false);
  assert.equal(badgeColour('project', { bg: 'rgb(0, 0, 255)', blur: 'blur(12px)' }).pass, false);
  assert.equal(badgeColour('project', { bg: glass.bg, blur: 'none' }).pass, false);
  assert.equal(badgeColour('project', { bg: 'rgba(0, 0, 0, 0)', blur: 'blur(12px)' }).pass, false, 'a clear tile is no glass');
  assert.equal(badgeColour('blue', {}).pass, false);
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
});

test('bounds gate a circle inside its window passes and one wider than the window names itself', () => {
  const box = { name: '.fp-scale__window', x: 100, y: 0, w: 89, h: 144 };
  assert.equal(bounds([{ name: 'lens', x: 120.4, y: 40, w: 48.1, h: 48.1 }], box).pass, true);
  // negative control: the old window (the resting eye, 48 wide, centred) under a lens circle lifted to 3 (78 wide)
  const old = bounds([{ name: 'lens', x: 122, y: 40, w: 78, h: 78 }], { ...box, x: 144.5, w: 48 });
  assert.equal(old.pass, false);
  assert.equal(old.offenders[0].path, 'lens');
  assert.equal(bounds([{ name: 'lens', x: 90, y: 40, w: 48, h: 48 }], box).pass, false, 'off the left edge');
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

// ── SQ-107 pass 3: the globe's centre in the eye moves on one path (the jitter gate). ──

test('jitter gate a steady ease up and back down with the settle on the last sample passes', () => {
  const up = [864, 848.5, 838.8, 833.2, 830, 828.2, 827, 826.4, 826, 825.7, 825.6];
  const down = [825.6, 828, 835, 845, 853, 859, 862.2, 863.4, 863.8, 863.95];
  const ok = jitter({ engage: up, release: down, settledUp: 825.58, settledDown: 864, handOver: { iris: 825.6, lens: 825.62 } });
  assert.equal(ok.pass, true, JSON.stringify(ok.offenders));
  assert.match(ok.note, /11 \+ 10 samples/);
  // the settled-state hand-over: the old build's lens circle sat 0.38 px lower than the rest iris
  const step = jitter({ engage: up, release: down, settledUp: 825.58, settledDown: 864, handOver: { iris: 825.6, lens: 825.98 } });
  assert.equal(step.pass, false);
  assert.match(step.offenders[0].note, /lens circle takes over from the rest iris 0.38 px lower/);
  assert.equal(jitter({ engage: up, release: down, settledUp: 825.58, settledDown: 864 }).pass, false, 'no hand-over measured proves nothing');
});

test('jitter gate a step down at settle and a reversal and an accelerating tail and a missing run all fail', () => {
  const up = [864, 848.5, 838.8, 833.2, 830, 828.2, 827, 826.4, 826, 825.7, 825.6];
  // the old build: the lens circle took over 0.38 px low of the rest iris
  const snap = jitter({ engage: up, release: [825.6, 835, 850, 860, 863.9], settledUp: 825.96, settledDown: 864, handOver: { iris: 825.6, lens: 825.6 } });
  assert.equal(snap.pass, false);
  assert.match(snap.offenders[0].note, /snap of 0.36 px at settle/);
  // the centre drifts back down mid-flight
  const back = jitter({ engage: [864, 848, 838, 840, 830, 826, 825.6, 825.6], release: [825.6, 835, 850, 860, 864], settledUp: 825.6, settledDown: 864 });
  assert.equal(back.pass, false);
  assert.match(back.offenders[0].note, /against its direction of travel/);
  // a late jump in the tail
  const late = jitter({ engage: [864, 850, 840, 834, 831, 829, 828.5, 826, 825.6], release: [825.6, 835, 850, 860, 864], settledUp: 825.6, settledDown: 864 });
  assert.equal(late.pass, false);
  assert.match(late.offenders[0].note, /stopped decelerating/);
  assert.equal(jitter(null).pass, false);
  assert.equal(jitter({ engage: up, release: [1, 2], settledUp: 825.6, settledDown: 864 }).pass, false, 'too few samples proves nothing');
});
