/**
 * scheme-css — the CSS half of the US-7 colour schemes (SQ-88), read as text:
 *   1. every selector in src/styles/scheme.css starts with html[data-scheme='black'|'blue'|'spectrum']
 *      (nothing in it may match under `project`);
 *   2. black and blue each carry the whole project-colour key set projectColorVars(C) returns, with its
 *      value, !important, on html AND on [style*='--project-color'] carriers (never a universal selector);
 *   3. the four role tokens are registered <color> properties in global.css;
 *   4. no `var(--color-electric-blue)` remains as a direct paint outside the :root definitions, the role-token
 *      assignments, fallback arguments (dead: the project-colour properties are registered), and the dev
 *      benches and routes the scheme does not cover (listed below).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectColorVars } from '../../src/lib/projectColor.js';
import { SPECTRUM } from '../../src/lib/colorScheme.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Split a selector list on the commas outside parentheses and brackets. */
const splitList = (sel) => {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

/** Flatten a stylesheet into [{ selector, decls: [[prop, value]] }], at-rule wrappers unwrapped. */
function rulesOf(css) {
  const out = [];
  const stack = [];
  let buf = '';
  for (const ch of stripComments(css)) {
    if (ch === '{') {
      stack.push({ head: buf.trim(), decls: [] });
      buf = '';
    } else if (ch === '}') {
      const top = stack.pop();
      const tail = buf.trim();
      if (tail) top.decls.push(tail);
      buf = '';
      if (!top.head.startsWith('@') || top.head.startsWith('@property') || top.head.startsWith('@font-face')) {
        out.push({
          selector: top.head,
          decls: top.decls.map((d) => {
            const i = d.indexOf(':');
            return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
          }),
        });
      }
    } else if (ch === ';' && stack.length) {
      stack[stack.length - 1].decls.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out;
}

const hex6 = (v) => {
  const s = String(v).trim().toLowerCase();
  const m = /^#([0-9a-f]{3})$/.exec(s);
  return m ? `#${[...m[1]].map((c) => c + c).join('')}` : s;
};

const schemeRules = rulesOf(read('src/styles/scheme.css'));

test('scheme.css: every selector starts with html[data-scheme=black|blue|spectrum]', () => {
  assert.ok(schemeRules.length > 0, 'scheme.css has rules');
  const bad = [];
  for (const r of schemeRules) {
    for (const sel of splitList(r.selector)) {
      if (!/^html\[data-scheme='(black|blue|spectrum)'\]/.test(sel)) bad.push(sel);
    }
  }
  assert.deepEqual(bad, []);
});

for (const [scheme, C] of [['black', '#000000'], ['blue', '#0000ff']]) {
  test(`scheme.css: ${scheme} declares the whole projectColorVars('${C}') key set, !important, on html and its carriers`, () => {
    const vars = projectColorVars(C);
    const own = `html[data-scheme='${scheme}']`;
    const carrier = `${own} [style*='--project-color']`;
    const rule = schemeRules.find((r) => {
      const sels = splitList(r.selector);
      return sels.includes(own) && sels.includes(carrier);
    });
    assert.ok(rule, `a rule on both ${own} and ${carrier}`);
    const declared = new Map(rule.decls);
    for (const [key, want] of Object.entries(vars)) {
      assert.ok(declared.has(key), `${key} is declared`);
      const got = declared.get(key);
      assert.match(got, /\s!important$/, `${key} is !important`);
      const value = hex6(got.replace(/\s*!important$/, ''));
      // projectColorVars leaves a key undefined when the input has no such part (no secondary accent, no
      // light-accent globe flip): the scheme still declares it, fixed, so an inline write cannot reach it.
      if (want !== undefined) assert.equal(value, hex6(want), `${key} value`);
    }
    // no universal selector: descendants keep inheriting from the carrier
    assert.ok(!rule.selector.replace(/\[[^\]]*\]/g, '').includes('*'), 'the carrier rule has no universal selector');
  });
}

test('global.css: the four scheme role tokens are registered <color> properties', () => {
  const rules = rulesOf(read('src/styles/global.css')).filter((r) => r.selector.startsWith('@property'));
  for (const name of ['--scheme-page', '--scheme-chip', '--scheme-chip-ink', '--scheme-accent-ink']) {
    const rule = rules.find((r) => r.selector === `@property ${name}`);
    assert.ok(rule, `${name} registered`);
    const d = new Map(rule.decls);
    assert.equal(d.get('syntax'), "'<color>'");
    assert.equal(d.get('inherits'), 'true');
    assert.ok(d.has('initial-value'), `${name} has an initial value`);
  }
});

// Dev benches and routes the scheme does not cover (process is redirected for v1; the tune panels are
// ?param benches; specimen and the lab globe are their own pages).
const SKIP_FILES = /(^|\/)(process|lab-globe|specimen|[\w-]+-tune)\.css$/;
const SKIP_SELECTOR = /^\.(fp-deckdbg|video-globe-debug)/; // the ?deckdebug and globe debug benches
const ROLE_TOKENS = new Set(['--color-electric-blue', '--scheme-page', '--scheme-chip', '--scheme-accent-ink']);

test('no direct brand-blue paint remains outside the role-token assignments', () => {
  const files = fs
    .readdirSync(path.join(root, 'src/styles'))
    .filter((f) => f.endsWith('.css'))
    .map((f) => `src/styles/${f}`)
    .filter((f) => !SKIP_FILES.test(f));
  const found = [];
  for (const file of files) {
    for (const r of rulesOf(read(file))) {
      if (SKIP_SELECTOR.test(r.selector)) continue;
      for (const [prop, value] of r.decls) {
        if (ROLE_TOKENS.has(prop)) continue;
        // an occurrence that is a var() fallback argument (preceded by a comma) is dead code: the
        // project-colour properties are registered, so their fallback never resolves
        if (/(?<!,\s*)var\(--color-electric-blue\)/.test(value)) found.push(`${file}: ${r.selector} { ${prop}: ${value} }`);
      }
    }
  }
  const notFound = read('src/pages/404.astro').match(/var\(--color-electric-blue\)/g);
  assert.equal(notFound, null, '404.astro paints with a role token');
  assert.deepEqual(found, []);
});

// Found in the wave 2 contact sheet (11-14): the checked filter's wipe box is the chip, which turns
// white under black, and the label kept its white ink. The contrast gate cannot see a ::before box.
test("scheme.css: black inks the directory's checked filter with the chip ink, since its wipe box is the chip", () => {
  const sel = "html[data-scheme='black'] .filter-tag[aria-checked='true'] .filter-tag__label";
  const rule = schemeRules.find((r) => splitList(r.selector).includes(sel));
  assert.ok(rule, `${sel} exists`);
  assert.equal(new Map(rule.decls).get('color'), 'var(--scheme-chip-ink)');
  const box = rulesOf(read('src/styles/directory.css')).find((r) => r.selector === '.filter-tag__label::before');
  assert.ok(box, 'directory.css still paints the label through ::before');
  assert.match(new Map(box.decls).get('background'), /var\(--scheme-chip\)/);
});

// ── spectrum (SQ-93) ──────────────────────────────────────────────────────────────────────────────
// Each palette key is a carrier block on <html> and on any descendant that carries the key: the values
// projectColorVars(fill) returns, except the ink (SPECTRUM[key].fg) and --nav-ink-l, which must agree with
// that ink (1 = white ink, 0 = dark). A carrier with no key takes the blue pair.

const whiteInk = (fg) => hex6(fg) === '#ffffff';

for (const [key, { fill, fg }] of Object.entries(SPECTRUM)) {
  test(`scheme.css: spectrum '${key}' carries projectColorVars('${fill}') with the pinned ink, !important, on html and its carriers`, () => {
    const own = `html[data-scheme='spectrum'][data-spectrum='${key}']`;
    const carrier = `html[data-scheme='spectrum'] [data-spectrum='${key}']`;
    const rule = schemeRules.find((r) => {
      const sels = splitList(r.selector);
      return sels.includes(own) && sels.includes(carrier);
    });
    assert.ok(rule, `a rule on both ${own} and ${carrier}`);
    const declared = new Map(rule.decls);
    const want = { ...projectColorVars(fill), '--project-color-fg': fg, '--nav-ink-l': whiteInk(fg) ? 1 : 0 };
    // projectColorVars leaves the secondary accent and a dark accent's globe filter undefined: the scheme
    // declares them anyway, fixed, so an inline write cannot reach them.
    want['--project-color-2'] ??= fill;
    want['--project-globe-filter'] ??= 'none';
    assert.deepEqual(
      Object.keys(want).sort(),
      Object.keys(projectColorVars(fill)).concat([]).sort(),
      'the test covers every key projectColorVars writes',
    );
    for (const [prop, value] of Object.entries(want)) {
      assert.ok(declared.has(prop), `${prop} is declared`);
      const got = declared.get(prop);
      assert.match(got, /\s!important$/, `${prop} is !important`);
      assert.equal(hex6(got.replace(/\s*!important$/, '')), hex6(String(value)), `${prop} value`);
    }
    assert.ok(!rule.selector.replace(/\[[^\]]*\]/g, '').includes('*'), 'no universal selector');
  });
}

test('scheme.css: a spectrum carrier with no key (and <html> before a project sets one) takes the blue pair', () => {
  const own = "html[data-scheme='spectrum']:not([data-spectrum])";
  const carrier = "html[data-scheme='spectrum'] [style*='--project-color']:not([data-spectrum])";
  const rule = schemeRules.find((r) => {
    const sels = splitList(r.selector);
    return sels.includes(own) && sels.includes(carrier);
  });
  assert.ok(rule, 'a fallback rule on both selectors');
  const declared = new Map(rule.decls);
  const keyed = schemeRules.find((r) => splitList(r.selector).includes("html[data-scheme='spectrum'][data-spectrum='blue']"));
  for (const [prop, value] of keyed.decls) assert.equal(declared.get(prop), value, `${prop} matches the blue block`);
  assert.equal(declared.size, keyed.decls.length);
});

test('scheme.css: every spectrum key is matched by name, never a bare [data-spectrum]', () => {
  // ClientLogoTicker's band carries data-spectrum='white' with another meaning.
  const bare = [];
  for (const r of schemeRules) {
    for (const sel of splitList(r.selector)) {
      if (/\[data-spectrum\](?!\))/.test(sel) && !/\[data-spectrum\]\)$/.test(sel)) bare.push(sel);
    }
  }
  assert.deepEqual(bare, []);
});

// The tokens at the start of SQ-93 (global.css :root): none may move. The new ones sit beside them.
const SWM_AT_START = {
  '--swm-red': '#fd361a',
  '--swm-orange': '#fe7701',
  '--swm-yellow': '#fbb702',
  '--swm-green': '#03a238',
  '--swm-blue': '#1556e5',
  '--swm-navy': '#0a2577',
  '--swm-periwinkle': '#a6bcda',
  '--swm-cycle-1': 'var(--swm-red)',
  '--swm-cycle-2': 'var(--swm-orange)',
  '--swm-cycle-3': 'var(--swm-yellow)',
  '--swm-cycle-4': 'var(--swm-green)',
  '--swm-cycle-5': 'var(--swm-blue)',
  '--swm-bpm': '127',
  '--swm-pulse-reps': '3',
};

test('global.css: no existing --swm-* token changed, and the spectrum palette tokens exist', () => {
  const root = rulesOf(read('src/styles/global.css')).find((r) => r.selector === ':root');
  assert.ok(root, ':root rule');
  const d = new Map(root.decls);
  for (const [prop, value] of Object.entries(SWM_AT_START)) assert.equal(d.get(prop), value, `${prop} unchanged`);
  assert.equal(hex6(d.get('--swm-green-deep')), '#077b3e');
  assert.equal(hex6(d.get('--swm-violet')), '#7852a4');
  const stops = (name) => (d.get(name) ?? '').split(',').map((s) => s.trim());
  assert.equal(hex6(stops('--swm-ramp-a')[0]), '#fe3720');
  assert.equal(stops('--swm-ramp-a').length, 9, 'ramp A: the centre ribbon, nine stops');
  assert.deepEqual(stops('--swm-ramp-b').map(hex6), ['#1556e5', '#0c44cc', '#0c2c8c', '#0a2577', '#071249', '#000000']);
  assert.deepEqual(stops('--swm-ramp-c').map(hex6), ['#9dc0e3', '#ffffff']);
  for (const name of ['--swm-ramp-a', '--swm-ramp-b', '--swm-ramp-c']) {
    assert.ok(!/gradient|deg|to (top|right|bottom|left)/.test(d.get(name)), `${name} is a bare colour-stop list, no direction baked in`);
  }
});

test('scheme.css: spectrum pages are black and the ramps ride on the consuming property, never on --project-color', () => {
  const roleRule = schemeRules.find((r) => splitList(r.selector).includes("html[data-scheme='spectrum']") && new Map(r.decls).has('--scheme-page'));
  assert.ok(roleRule, 'a spectrum role-token rule');
  assert.equal(new Map(roleRule.decls).get('--scheme-page'), '#000000');
  const gradients = schemeRules.filter((r) => r.selector.includes("'spectrum'") && r.decls.some(([, v]) => /gradient\(/.test(v)));
  assert.ok(gradients.length >= 4, 'linear surfaces carry the ramps');
  for (const r of gradients) {
    for (const [prop] of r.decls) assert.ok(!prop.startsWith('--project-color'), `${r.selector}: ${prop} holds no gradient`);
  }
});
