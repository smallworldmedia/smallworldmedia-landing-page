// The fonts the page ships on its own origin (SQ-148, US-13 piece A): the Iosevka Term subset holds
// every codepoint the site can render in it (negative control included), and Inter is self-hosted
// with its license, with no Google Fonts reference left in the layout.
//   node --test scripts/test/font-coverage.test.mjs
// Opt in to the dist scan after a build:
//   FONT_GATE_DIST=dist node --test scripts/test/font-coverage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hex,
  missingCodepoints,
  nonAsciiCodepoints,
  rangesToCodepoints,
  requiredCodepoints,
  woff2Cmap,
  REQUIRED_RANGES,
} from '../lib/fontCoverageGate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => fs.readFileSync(root + p);
const text = (p) => read(p).toString('utf8');
const IOSEVKA = 'src/assets/fonts/IosevkaTermMedium.woff2';

// ── the pure gate ─────────────────────────────────────────────────────────────────────────────

test('missingCodepoints: what the font lacks, ascending, once', () => {
  assert.deepEqual(missingCodepoints(new Set([1, 2, 3]), [3, 2, 1]), []);
  assert.deepEqual(missingCodepoints(new Set([1, 3]), [3, 2, 1, 2, 5]), [2, 5]);
  assert.deepEqual(missingCodepoints([65, 66], [66, 67]), [67]);
});

test('nonAsciiCodepoints and rangesToCodepoints', () => {
  assert.deepEqual(nonAsciiCodepoints('Malóne — ™ ó'), [0xf3, 0x2014, 0x2122]);
  assert.deepEqual(nonAsciiCodepoints('plain ascii'), []);
  assert.deepEqual(rangesToCodepoints([[1, 3], [7, 7]]), [1, 2, 3, 7]);
});

// ── the shipped Iosevka subset ────────────────────────────────────────────────────────────────

test('the Iosevka subset keeps every required codepoint', () => {
  const cmap = woff2Cmap(read(IOSEVKA));
  const missing = missingCodepoints(cmap, requiredCodepoints());
  assert.deepEqual(missing.map(hex), [], `the subset lost ${missing.length} required codepoints`);
});

test('the required set names the blocks the contract keeps', () => {
  const req = new Set(requiredCodepoints());
  // Basic Latin, Latin-1 Supplement, Latin Extended-A.
  for (const cp of [0x41, 0x7a, 0xe9, 0xf3, 0xfc, 0x100, 0x17f]) assert.ok(req.has(cp), hex(cp));
  // ™ © ® · • ×, an arrow, general punctuation the site sets.
  for (const cp of [0x2122, 0xa9, 0xae, 0xb7, 0x2022, 0xd7, 0x2192, 0x2190, 0x2014, 0x2019, 0x2026]) {
    assert.ok(req.has(cp), hex(cp));
  }
  assert.ok(REQUIRED_RANGES.length >= 3);
});

test('negative control: a subset with one codepoint dropped fails the gate', () => {
  const cmap = woff2Cmap(read(IOSEVKA));
  const e = 0xe9; // é, the accent in "Malóne"-style Sanity names
  assert.ok(cmap.has(e));
  cmap.delete(e);
  assert.deepEqual(missingCodepoints(cmap, requiredCodepoints()), [e]);
  // And a whole block going missing is reported in full, not just its first codepoint.
  for (let cp = 0x100; cp <= 0x17f; cp++) cmap.delete(cp);
  assert.equal(missingCodepoints(cmap, requiredCodepoints()).length, 1 + 0x80);
});

test('the Iosevka file stays a subset (the full family was 1.5 MB)', () => {
  assert.ok(read(IOSEVKA).length < 300 * 1024, `${read(IOSEVKA).length} bytes`);
});

test('the optional dist scan: no non-ASCII glyph in built HTML falls outside the subset', (t) => {
  const dist = process.env.FONT_GATE_DIST;
  if (!dist) return t.skip('set FONT_GATE_DIST=<dir> to scan built HTML');
  const cmap = woff2Cmap(read(IOSEVKA));
  const found = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) for (const cp of nonAsciiCodepoints(fs.readFileSync(p, 'utf8'))) found.add(cp);
    }
  };
  walk(path.resolve(dist));
  assert.deepEqual(missingCodepoints(cmap, [...found]).map(hex), []);
});

// ── Inter, self-hosted ────────────────────────────────────────────────────────────────────────

test('Inter is declared from the origin: family, weights, swap, files, license', () => {
  const css = text('src/styles/global.css');
  const faces = [...css.matchAll(/@font-face\s*{[^}]*font-family:\s*'Inter'[^}]*}/g)].map((m) => m[0]);
  assert.equal(faces.length, 2, 'a latin and a latin-ext face');
  for (const face of faces) {
    assert.match(face, /font-weight:\s*400 500\s*;/);
    assert.match(face, /font-display:\s*swap/);
    const file = face.match(/url\('\.\.\/(assets\/fonts\/[^']+\.woff2)'\)/)?.[1];
    assert.ok(file && fs.existsSync(root + 'src/' + file), `${file} ships`);
  }
  assert.match(text('src/assets/fonts/Inter-OFL.txt'), /SIL OPEN FONT LICENSE Version 1\.1/);
  // The latin file carries the Basic Latin the UI stack would fall back on.
  const latin = woff2Cmap(read('src/assets/fonts/Inter-Variable-latin.woff2'));
  assert.deepEqual(missingCodepoints(latin, rangesToCodepoints([[0x20, 0x7e]])), []);
});

test('the layout no longer reaches for Google Fonts', () => {
  const layout = text('src/layouts/BaseLayout.astro');
  assert.doesNotMatch(layout, /fonts\.googleapis|fonts\.gstatic/);
  assert.match(layout, /image\.mux\.com/, 'the Mux preconnect stays');
  assert.doesNotMatch(text('src/styles/global.css'), /fonts\.googleapis|fonts\.gstatic/);
});
