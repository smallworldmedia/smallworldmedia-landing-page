#!/usr/bin/env node
/**
 * globe-matrix — the globe probe's run matrix and negative controls in one go
 * (docs/globe-worlds-plan.md § The probe). Born as the 10-31 round's runner,
 * which re-recorded the 17 records at the defaults; folded into scripts/ 11-01.
 *
 * Usage:
 *   node scripts/globe-matrix.mjs <record|check|controls> [key …] [--base=URL] [--out=DIR]
 *
 *   record    re-record each key in scripts/baselines/globe-units.json at today's
 *             defaults (each run adds --baseline=<key> --record-baseline);
 *   check     the same runs, judged against their records (nothing written);
 *   controls  the MUSTFAIL runs: each must exit 2, then
 *             `scripts/lib/unitGates.mjs --expect-fail=<its gates>` must pass
 *             (a control may fail more than its list; the line names the extras).
 *   key …     only these keys, in the order given (default: the whole phase,
 *             in table order).
 *
 * ONE browser at a time: the runs are sequential, and nothing else should drive
 * a GPU meanwhile. --base (else GLOBE_PROBE_BASE, else the probe's own
 * http://localhost:4322) is the server every run loads; its origin must be on
 * the Sanity CDN's CORS list or the stills come back black. --out (else
 * GLOBE_PROBE_OUT, else scripts/shots/matrix, gitignored) is the root: a run
 * writes <root>/<phase>/<key>/ (report.json, the probe's shots, stderr.log) and
 * appends one line to <root>/<phase>/summary.txt. Exits 1 when any run misses
 * (record/check: exit 0; a control: exit 2 with its list met), else 0.
 *
 * The tables are the plan's run matrix and MUSTFAIL table as of 10-31: change
 * them together.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: the Dropbox path has spaces.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : d;
};
const [PHASE, ...ONLY] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = arg('base', process.env.GLOBE_PROBE_BASE);
const OUT = path.resolve(arg('out', process.env.GLOBE_PROBE_OUT || path.join(ROOT, 'scripts', 'shots', 'matrix')));

// The units-off keys first: the units keys' neighbourRule reference reads their adjMax (unitGates.mjs).
const RUNS = {
  'off-desktop': ['--units=0'],
  'off-mobile': ['--units=0', '--mobile'],
  'off-rm': ['--units=0', '--rm'],
  'off-tide': ['--units=0', '--extra=&poptransset=tide'],
  'off-flat': ['--units=0', '--mode=off'],
  'off-phonehd': ['--units=0', '--mobile', '--dsf=3'],
  'u-desktop': ['--units', '--level=tier'],
  'u-mobile': ['--units', '--level=tier', '--mobile'],
  'u-rm': ['--units', '--level=vq', '--rm', '--next=1'],
  'u-tide': ['--units', '--level=h', '--extra=&poptransset=tide&popunitmax=6', '--secs=40'],
  'u-tile': ['--units', '--level=vq', '--extra=&poplive=tile'],
  'u-arrive': ['--units', '--level=tier', '--intro=full', '--warm=10', '--secs=30'],
  'u-hidpi': ['--units', '--level=tier', '--dsf=2'],
  'u-phonehd': ['--units', '--level=tier', '--mobile', '--dsf=3'],
  'u-phonehd720': ['--units', '--level=tier', '--mobile', '--dsf=3', '--extra=&globeres=720p'],
  'u-equiv': ['--units', '--level=tier', '--extra=&popequiv=13'],
  'u-thumb-phonehd': ['--units', '--level=tier', '--mobile', '--dsf=3', '--extra=&globethumb=512', '--texmb=131'],
};
// [flags, must-fail gates]. nc-windows-vq: the flat look's list (As built 12); nc-windows-vq-rows: the
// original list under &popunitlook=rows.
const CONTROLS = {
  'nc-texmb': [['--units=0', '--texmb=1', '--baseline=off-desktop'], 'texBudget'],
  'nc-texpeak': [['--units=0', '--texpeak=1', '--baseline=off-desktop'], 'texPeak'],
  'nc-sneak': [['--units=0', '--extra=&popunits=1', '--baseline=off-desktop'], 'legacyParity,texReqShape,unitsVacuous'],
  'nc-units0': [['--units=0', '--level=h', '--baseline=u-desktop'], 'unitsVacuous'],
  'nc-windows': [['--units', '--level=h', '--negctl', '--baseline=u-desktop'], 'unitSeam,unitRegister'],
  'nc-bind': [['--units', '--level=h', '--negctl=bind', '--baseline=u-desktop'], 'skew'],
  'nc-windows-vq': [['--units', '--level=vq', '--negctl', '--baseline=u-desktop'], 'unitSeam,unitRegister,unitRows'],
  'nc-windows-vq-rows': [['--units', '--level=vq', '--negctl', '--baseline=u-desktop', '--extra=&popunitlook=rows'], 'unitSeam,unitRegister,unitColumns,unitRows,unitWarp'],
  'nc-decode': [['--units', '--level=tier', '--decodemax=0.3', '--baseline=u-desktop'], 'decodeReal'],
  'nc-density': [['--units', '--level=tier', '--densitymax=1', '--baseline=u-desktop'], 'videoDensityMax'],
  'nc-density-hidpi': [['--units', '--level=tier', '--dsf=2', '--densitymax=0.4', '--baseline=u-hidpi'], 'videoDensityMax'],
  'nc-density-phonehd': [['--units', '--level=tier', '--mobile', '--dsf=3', '--densitymax=0.4', '--baseline=u-phonehd'], 'videoDensityMax'],
  'nc-pin': [['--units', '--level=tier', '--negctl=pin', '--baseline=u-desktop'], 'streamTier'],
  'nc-thumb': [['--units=0', '--extra=&globethumb=384', '--baseline=off-desktop'], 'legacyParity'],
};

if (!['record', 'check', 'controls'].includes(PHASE)) {
  console.error('usage: node scripts/globe-matrix.mjs <record|check|controls> [key …] [--base=URL] [--out=DIR]');
  process.exit(1);
}
const table = PHASE === 'controls' ? CONTROLS : RUNS;
const keys = ONLY.length ? ONLY : Object.keys(table);
for (const k of keys) if (!table[k]) throw new Error(`unknown key ${k} for ${PHASE}`);

const phaseDir = path.join(OUT, PHASE);
fs.mkdirSync(phaseDir, { recursive: true });
const stamp = () => new Date().toISOString().slice(11, 19);
const line = (s) => {
  console.log(s);
  fs.appendFileSync(path.join(phaseDir, 'summary.txt'), s + '\n');
};
const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
line(`# ${PHASE} at ${head}, ${new Date().toISOString()}, base ${BASE || 'the probe default'}, keys: ${keys.join(' ')}`);

let missed = 0;
for (const key of keys) {
  const out = path.join(phaseDir, key);
  const flags = PHASE === 'controls' ? table[key][0] : [...table[key], `--baseline=${key}`, ...(PHASE === 'record' ? ['--record-baseline'] : [])];
  const argv = ['scripts/globe-probe.mjs', ...flags, ...(BASE ? [`--base=${BASE}`] : []), `--out=${out}`];
  const load = os.loadavg().map((x) => x.toFixed(1)).join(' ');
  const t0 = Date.now();
  const r = spawnSync('node', argv, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 15 * 60 * 1000 });
  const secs = Math.round((Date.now() - t0) / 1000);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'stderr.log'), r.stderr ?? '');
  let rep = null;
  try {
    rep = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  } catch {}
  const pass = rep?.pass ?? {};
  const all = Object.keys(pass);
  const failed = all.filter((g) => !pass[g]);
  const detail = { ...(rep?.net?.detail ?? {}), ...(rep?.spans?.detail ?? {}) };
  const why = failed.map((g) => (detail[g]?.vacuous ? `${g}(vacuous)` : g)).join(',');
  let verdict = '';
  let ok = r.status === 0;
  if (PHASE === 'controls') {
    const ef = spawnSync('node', ['scripts/lib/unitGates.mjs', `--expect-fail=${table[key][1]}`, path.join(out, 'report.json')], { cwd: ROOT, encoding: 'utf8' });
    const want = new Set(table[key][1].split(','));
    const extra = failed.filter((g) => !want.has(g));
    ok = r.status === 2 && ef.status === 0;
    verdict = ` | expect-fail ${ef.status === 0 ? 'MET' : 'NOT MET'} (${table[key][1]})${extra.length ? ` | also failed: ${extra.join(',')}` : ' | nothing else failed'}`;
  }
  if (!ok) missed += 1;
  const fatal = rep?.fatal ? ` | FATAL ${String(rep.fatal).split('\n')[0].slice(0, 160)}` : '';
  line(`${stamp()} ${key.padEnd(19)} exit ${r.status ?? r.signal} | ${all.length - failed.length}/${all.length} pass${failed.length ? ` | failed: ${why}` : ''}${verdict}${fatal} | ${secs}s | load ${load} | ${flags.join(' ')}`);
}
line(`# done ${new Date().toISOString()}: ${keys.length - missed}/${keys.length} as expected`);
process.exit(missed ? 1 : 0);
