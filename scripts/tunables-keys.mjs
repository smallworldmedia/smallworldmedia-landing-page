#!/usr/bin/env node
/**
 * tunables-keys — code-truth inventory of every URL query param the site reads.
 *
 *   node scripts/tunables-keys.mjs            list every key with up to 4 read sites
 *   node scripts/tunables-keys.mjs --keys     comma-separated key list (for scripting)
 *   node scripts/tunables-keys.mjs --check    exit 1 if a code key is missing from docs/tunables-guide.md
 *
 * Idioms covered (add a regex when a new reading style appears):
 *   params.get/has/getAll('k')                 direct reads
 *   num/PARAM/qNum/str/int/flag/bool('k', …)   the per-file helpers
 *   PARAM_KEYS = { stateKey: 'k', … }          bench state ↔ param maps
 *   FOO_PARAM = 'k'                            name constants (heroConfig)
 *   ['k', 'option']                            [param, option] pairs (smoothScroll)
 *   location.search.includes('k')             substring gates (fpDrum / fpAtlas)
 * Known false positives (variant arrays, a form field) are listed in IGNORE.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUIDE = join(ROOT, 'docs', 'tunables-guide.md');
const IGNORE = new Set(['a', 'panels', 'email']);

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (/\.(jsx?|astro)$/.test(e)) files.push(p);
  }
})(join(ROOT, 'src'));

const hits = new Map();
const add = (k, f, ln) => {
  if (!/^[a-z][a-z0-9_-]*$/i.test(k) || IGNORE.has(k)) return;
  if (!hits.has(k)) hits.set(k, new Set());
  hits.get(k).add(`${relative(ROOT, f)}:${ln}`);
};
const LINE_RES = [
  /\b(?:num|PARAM|qNum|str|int|flag|bool)\(\s*['"]([a-z0-9_-]+)['"]/g,
  /\.(?:get|has|getAll)\(\s*['"]([a-z0-9_-]+)['"]\s*\)/g,
  /location\.search\.includes\(\s*['"]([a-z0-9_-]+)['"]/g,
  /\bp\.set\(\s*['"]([a-z0-9_-]+)['"]/g,
  /\b[A-Z][A-Z0-9_]*_PARAM\s*=\s*['"]([a-z0-9_-]+)['"]/g,
];
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!/URLSearchParams|location\.search|searchParams/.test(src)) continue;
  src.split('\n').forEach((line, i) => {
    for (const re of LINE_RES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) add(m[1], f, i + 1);
    }
  });
  const lineOf = (idx) => src.slice(0, idx).split('\n').length;
  let m;
  const pk = /PARAM_KEYS\s*=\s*(?:Object\.freeze\()?\{([\s\S]*?)\}/g;
  while ((m = pk.exec(src))) {
    for (const v of m[1].match(/:\s*['"]([a-z0-9_-]+)['"]/g) || []) add(v.replace(/[:'"\s]/g, ''), f, lineOf(m.index));
  }
  const pairs = /\[\s*['"]([a-z0-9_-]+)['"]\s*,\s*['"][A-Za-z0-9_-]+['"]\s*\]/g;
  while ((m = pairs.exec(src))) add(m[1], f, lineOf(m.index));
}

const keys = [...hits.keys()].sort();
const mode = process.argv[2];
if (mode === '--keys') {
  console.log(keys.join(','));
} else if (mode === '--check') {
  const doc = readFileSync(GUIDE, 'utf8');
  const present = new Set();
  for (const x of doc.matchAll(/`\??([a-z][a-z0-9_-]*)(?:=[^`\s]*)?`/g)) present.add(x[1]);
  for (const x of doc.matchAll(/\?([a-z][a-z0-9_-]*)\b/g)) present.add(x[1]);
  const missing = keys.filter((k) => !present.has(k));
  console.log(`code keys: ${keys.length}  missing from ${relative(ROOT, GUIDE)}: ${missing.length}`);
  if (missing.length) {
    console.log('MISSING: ' + missing.join(', '));
    process.exit(1);
  }
  console.log('PASS');
} else {
  for (const k of keys) console.log(k.padEnd(16), [...hits.get(k)].slice(0, 4).join('  '));
  console.error(`\n${keys.length} keys`);
}
