#!/usr/bin/env node
/**
 * unitGates.mjs — the media-spans gates of scripts/globe-probe.mjs, as pure
 * functions over the probe's report (no Playwright, so scripts/test imports
 * it). Spec: docs/globe-worlds-plan.md § Media spans.
 *
 * Every gate records { n, floor, vacuous, worst, bound }. A gate whose
 * measurement count n is under its floor FAILS as vacuous (a units run that
 * placed nothing proves nothing), and --expect-fail accepts only a
 * NON-vacuous false: a negative control must prove the gate can see.
 *
 *   node scripts/lib/unitGates.mjs --expect-fail=<gate>[,<gate>…] <report.json>
 *   node scripts/lib/unitGates.mjs --payload <dist/index.html> [--units-absent]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// — P3 — (unitSpan.js lands in P1; globeConfig.js is node-safe: every window read is guarded)
import { latticeOf, UNIT_SHAPE } from '../../src/components/globe/unitSpan.js';
import { LON_SEGMENTS, SCROLL_VISIBLE_ROWS, GAP_DEG, SCROLL_LAT_GAP_DEG } from '../../src/components/globe/globeConfig.js';

/** Probe levels, cumulative: each adds its gates to the ones below it. */
export const LEVELS = ['off', 'tex', 'h', 'vq', 'live', 'tier'];
const at = (ctx, level) => LEVELS.indexOf(ctx.level) >= LEVELS.indexOf(level);
const max = (xs) => xs.reduce((m, x) => (x > m ? x : m), 0);
const sum = (xs) => xs.reduce((a, x) => a + x, 0);

/** One gate: pass = non-vacuous && ok. A report-only gate is recorded in detail, never in pass. */
function gate(out, name, { n, floor = 1, ok, worst = null, bound = null, reportOnly = false, ...extra }) {
  const vacuous = !(n >= floor);
  out.detail[name] = { n, floor, vacuous, worst, bound, ...(reportOnly ? { reportOnly: true } : {}), ...extra };
  if (!reportOnly) out.pass[name] = !vacuous && !!ok;
}

// — P3 — the class texture sizes at T1: unitSpan.texSpec's arithmetic on the default lattice.
const SIZES = new Map();
export function classSizes(t1) {
  if (!SIZES.has(t1)) {
    const L = latticeOf({ lon: LON_SEGMENTS, visibleRows: SCROLL_VISIBLE_ROWS, gapDeg: GAP_DEG, latGapDeg: SCROLL_LAT_GAP_DEG });
    const sz = {};
    for (const [cls, { cols, rows }] of Object.entries(UNIT_SHAPE)) {
      sz[cls] = [Math.round((t1 * (cols * L.Pphi - L.Gphi)) / L.phiLen), Math.round((t1 * (rows * L.Pth - L.Gth)) / L.bandH)];
    }
    SIZES.set(t1, sz);
  }
  return SIZES.get(t1);
}

/** — P3 — (w, h) is the class size (W, H) scaled by ONE k ≤ 1 and rounded: texSpec's source
 *  clamp, on both CDNs. Exact (an interval test on k), so no aspect tolerance. */
const scaledFrom = (w, h, W, H) => {
  const lo = Math.max((w - 0.5) / W, (h - 0.5) / H);
  const hi = Math.min((w + 0.5) / W, (h + 0.5) / H);
  return lo < hi && lo <= 1;
};
const classOfSize = (t1, w, h) => Object.entries(classSizes(t1)).find(([, [W, H]]) => scaledFrom(w, h, W, H))?.[0];

/** A logged request → { kind: 'stream'|'legacy'|'class'|'other', id, query, shape }. id = host + path
 *  (a stream's: its playbackId). shape = the class, or for 'other' an id-free signature: path segments
 *  holding a digit or ≥ 16 characters become '*', query digits become '#' (the baseline's allow-list). */
export function classifyRequest(url, t1) {
  const u = new URL(url);
  const query = u.search.slice(1);
  if (u.host === 'stream.mux.com') return { kind: 'stream', id: u.pathname.slice(1).replace(/\.m3u8$/, ''), query, shape: null };
  const id = u.host + u.pathname;
  const p = Object.fromEntries(u.searchParams);
  const keys = [...u.searchParams.keys()].join('&');
  if (u.host === 'image.mux.com') {
    if (query === `width=${t1}&height=${t1}&fit_mode=smartcrop`) return { kind: 'legacy', id, query, shape: 'mux' };
    // — P3 — a class crop: the class size or its source clamp (M2), a true centre crop of frame 0.
    if (keys === 'width&height&fit_mode&time' && p.fit_mode === 'crop' && p.time === '0') {
      const cls = classOfSize(t1, Number(p.width), Number(p.height));
      if (cls) return { kind: 'class', id, query, shape: cls };
    }
  } else if (u.host === 'cdn.sanity.io') {
    if (query === `w=${t1}&h=${t1}&fit=crop&crop=entropy&auto=format`) return { kind: 'legacy', id, query, shape: 'sanity' };
    // — P3 — a class crop: the class size or its source clamp.
    if (keys === 'w&h&fit&auto' && p.fit === 'crop' && p.auto === 'format') {
      const cls = classOfSize(t1, Number(p.w), Number(p.h));
      if (cls) return { kind: 'class', id, query, shape: cls };
    }
  }
  const segs = u.pathname.split('/').map((s) => (/\d/.test(s) || s.length >= 16 ? '*' : s)).join('/');
  return { kind: 'other', id, query, shape: `${u.host}${segs}?${query.replace(/\d+/g, '#')}` };
}

/** The span gates for one probe report. Mode off (no director): the request gates only. */
export function unitGates(report, ctx) {
  const out = { pass: {}, detail: {} };
  const base = ctx.baselines?.[ctx.key] ?? null;
  const unitsOn = ctx.units === 1;

  // Requests (the probe's request log): shapes, one variant per id, units-off parity.
  const reqs = (report.requests || []).map((url) => classifyRequest(url, ctx.t1));
  const imgs = reqs.filter((r) => r.kind !== 'stream');
  const streams = reqs.filter((r) => r.kind === 'stream');
  const allowed = new Set(base?.otherShapes ?? []);
  const badShape = imgs.filter((r) => (r.kind === 'class' && !unitsOn) || (r.kind === 'other' && !ctx.record && !allowed.has(r.shape)));
  const classN = imgs.filter((r) => r.kind === 'class').length;
  gate(out, 'texReqShape', {
    n: imgs.length,
    ok: badShape.length === 0 && (!at(ctx, 'tex') || classN >= 1),
    worst: badShape.length,
    bound: 0,
    classN,
    bad: badShape.slice(0, 5).map((r) => `${r.kind} ${r.id}?${r.query}`),
  });
  const variants = new Map();
  for (const r of imgs) {
    if (r.kind === 'other') continue;
    if (!variants.has(r.id)) variants.set(r.id, new Set());
    variants.get(r.id).add(r.query);
  }
  const multi = [...variants].filter(([, q]) => q.size > 1);
  gate(out, 'thumbVariants', {
    n: variants.size,
    ok: multi.length === 0,
    worst: max([...variants.values()].map((q) => q.size)),
    bound: 1,
    bad: multi.slice(0, 5).map(([id, q]) => `${id}: ${[...q].join(' | ')}`),
  });
  if (!unitsOn && !ctx.record) {
    const want = base?.idQuery ?? {};
    const shared = imgs.filter((r) => r.kind !== 'other' && r.id in want);
    const okStreams = new Set(base?.streamQueries ?? []);
    const bad = [
      ...shared.filter((r) => r.query !== want[r.id]).map((r) => `${r.id}?${r.query} (baseline ?${want[r.id]})`),
      ...imgs.filter((r) => r.kind === 'class').map((r) => `class ${r.id}?${r.query}`),
      ...streams.filter((r) => !okStreams.has(r.query)).map((r) => `stream ${r.id}?${r.query}`),
    ];
    gate(out, 'legacyParity', { n: new Set(shared.map((r) => r.id)).size, floor: 10, ok: bad.length === 0, worst: bad.length, bound: 0, bad: bad.slice(0, 5) });
  }
  if (ctx.mode === 'off') return out;

  // The director's telemetry (window.__swmPopStats samples).
  const S = (report.samples || []).filter((s) => s.phase);
  const U = S.filter((s) => s.units);
  const uHolds = U.filter((s) => s.phase === 'hold');
  const runHolds = uHolds.filter((s) => s.units.clock !== 'stopped');
  gate(out, 'unitsVacuous', { n: S.length, ok: ctx.level === 'off' ? U.length === 0 : unitsOn && U.length > 0, worst: U.length });
  const stale = max(S.map((s) => s.staleLanded ?? 0));
  gate(out, 'staleLanded', { n: S.length, ok: stale === 0, worst: stale, bound: 0, bornCancelled: max(S.map((s) => s.bornCancelled ?? 0)) });
  const quiet = S.filter((s) => s.tex && s.tex.refDrift != null);
  const mib = max(quiet.map((s) => s.tex.mib));
  const drift = max(quiet.map((s) => Math.abs(s.tex.refDrift)));
  gate(out, 'texBudget', { n: quiet.length, floor: 3, ok: mib <= ctx.texmb && drift === 0, worst: mib, bound: ctx.texmb, drift });
  if (!ctx.record) {
    const peak = max(S.map((s) => s.tex?.peak ?? 0));
    const steps = S.map((s) => s.step);
    const changes = steps.length ? Math.max(...steps) - Math.min(...steps) : 0;
    const bound = ctx.texpeak ?? (base?.peakMax != null ? base.peakMax * 1.15 : null);
    // A change window holds three groupings (the old one stays referenced until settle → releaseCold); under RM nothing changes on its own clock, so the initial layout is the peak.
    gate(out, 'texPeak', { n: bound == null ? 0 : ctx.rm ? 1 : changes, ok: peak <= bound, worst: peak, bound });
  }

  // — P3 — tex: texB registers on live class textures.
  if (!at(ctx, 'tex')) return out;
  if (!ctx.rm) {
    const lr = U.map((s) => s.units.liveReg).filter(Boolean);
    const w = max(lr.map((x) => x.worst));
    gate(out, 'liveReg', { n: sum(lr.map((x) => x.n)), ok: w <= 1e-3, worst: w, bound: 1e-3 });
  }

  // — P4a — h: whole units, repeats, stills in tile mode, the neighbour rule.
  if (!at(ctx, 'h')) return out;
  const torn = max(runHolds.map((s) => s.units.whole.torn));
  gate(out, 'unitWhole', { n: sum(runHolds.map((s) => s.units.whole.n)), ok: torn === 0, worst: torn, bound: 0 });
  if (ctx.tide) gate(out, 'bornWhole', { n: max(U.map((s) => s.units.bornH)), ok: torn === 0, worst: torn, bound: 0 });
  const rep = max(uHolds.map((s) => s.units.repeats));
  gate(out, 'unitRepeats', { n: uHolds.length, ok: rep <= ctx.unitMax, worst: rep, bound: ctx.unitMax });
  if (ctx.tile) {
    const lm = max(U.map((s) => s.units.liveMembers));
    gate(out, 'memberStills', { n: max(U.map((s) => s.units.members)), ok: lm === 0, worst: lm, bound: 0 });
  }
  if (unitsOn && !ctx.record) {
    // Units must not add same-texture neighbours beyond what the units-off globe shows on the same view.
    const REF = { 'u-desktop': 'off-desktop', 'u-mobile': 'off-mobile', 'u-rm': 'off-rm', 'u-tide': 'off-tide' };
    const bound = ctx.baselines?.[REF[ctx.key] ?? (ctx.mobile ? 'off-mobile' : 'off-desktop')]?.adjMax ?? null;
    const pooled = uHolds.filter((s) => (s.layout?.minPool ?? 0) >= 6);
    const adj = max(pooled.map((s) => s.layout.adj));
    // Judged only with a units-off reference AND a hold big enough to judge (minPool ≥ 6). Without either
    // there is nothing to compare (small worlds hold no such sample): report-only, floor 0 (m2).
    const judged = bound != null && pooled.length > 0;
    gate(out, 'neighbourRule', {
      n: judged ? pooled.length : 0,
      floor: judged ? 1 : 0,
      ok: adj <= (bound ?? Infinity),
      worst: adj,
      bound,
      unitAdj: max(pooled.map((s) => s.layout.unitAdj)),
      reportOnly: !judged || ctx.equiv > 0, // and a tile budget repeats assets by design (Nathan's Q8)
    });
  }
  return out;
}

/** A run's baseline record: what --record-baseline stores under its key. */
export function baselineOf(report, ctx) {
  const reqs = (report.requests || []).map((url) => classifyRequest(url, ctx.t1));
  const S = (report.samples || []).filter((s) => s.phase);
  const uniq = (xs) => [...new Set(xs)].sort();
  const idQuery = {};
  for (const r of reqs) if (r.kind === 'legacy' || r.kind === 'class') idQuery[r.id] = r.query;
  const kinds = {};
  for (const r of reqs) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  const quiet = S.filter((s) => s.tex && s.tex.refDrift != null);
  const pooled = S.filter((s) => s.phase === 'hold' && (s.layout?.minPool ?? 0) >= 6);
  const r1s = S.map((s) => s.r1).filter((x) => x > 0);
  return {
    seed: ctx.seed,
    t1: ctx.t1,
    kinds,
    otherShapes: uniq(reqs.filter((r) => r.kind === 'other').map((r) => r.shape)),
    idQuery,
    streamQueries: uniq(reqs.filter((r) => r.kind === 'stream').map((r) => r.query)),
    mibMax: quiet.length ? max(quiet.map((s) => s.tex.mib)) : null,
    peakMax: S.some((s) => s.tex) ? max(S.map((s) => s.tex?.peak ?? 0)) : null,
    adjMax: pooled.length ? max(pooled.map((s) => s.layout.adj)) : null,
    requests: reqs.length,
    r1: r1s.length ? max(r1s) : null,
    recorded: new Date().toISOString().slice(0, 10),
  };
}

/** The baselines file: { key → record }, or {} before the first recording. */
export function readBaselines(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return {};
    throw e;
  }
}

/** Write one key, keys sorted, so the file diffs cleanly. */
export function writeBaseline(file, key, record) {
  const all = { ...readBaselines(file), [key]: record };
  const sorted = Object.fromEntries(Object.keys(all).sort().map((k) => [k, all[k]]));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
}

/** A negative control's verdict: no fatal, and every named gate present in pass, false, and non-vacuous. */
export function expectFail(report, gates) {
  const reasons = [];
  if (report.fatal) reasons.push(`fatal: ${String(report.fatal).split('\n')[0]}`);
  if (!gates.length) reasons.push('no gate named');
  for (const g of gates) {
    const d = report.spans?.detail?.[g] ?? report.net?.detail?.[g]; // P0's stream-diet gates live in report.net
    if (!(g in (report.pass || {}))) reasons.push(`${g}: not in report.pass (not evaluated at this level, or report-only)`);
    else if (report.pass[g] !== false) reasons.push(`${g}: passed, so the control did not bite`);
    else if (!d || d.vacuous !== false) reasons.push(`${g}: failed only as vacuous (n ${d?.n} < floor ${d?.floor})`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** The island payload (dist/index.html): globeWorlds' assets stay lean, and `u` and `s` are exactly where they should be. */
export function checkPayload(html, { unitsAbsent = false } = {}) {
  const reasons = [];
  const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Astro's island props: every value is [type, value]; 0 = a plain value (objects recurse), 1 = an array.
  const revive = ([t, v]) =>
    t === 1 ? v.map(revive) : t === 0 && v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) : v;
  const props = [...html.matchAll(/<astro-island\b[^>]*?\sprops="([^"]*)"/g)].map((m) => m[1]).find((p) => p.includes('&quot;globeWorlds&quot;'));
  if (!props) return { ok: false, reasons: ['no astro-island carries globeWorlds'], assets: 0, withU: 0, uBytes: 0, withS: 0, sBytes: 0 };
  const worlds = revive(JSON.parse(unescape(props)).globeWorlds);
  const assets = worlds.flatMap((w) => w.assets || []);
  const LEAN = new Set(['kind', 'playbackId', 'imageUrl', 'videoAspectRatio', 'u', 's']);
  const CLASSES = new Set(['h', 'v', 'q']);
  for (const a of assets) {
    const extra = Object.keys(a).filter((k) => !LEAN.has(k));
    if (extra.length) reasons.push(`${a.playbackId || a.imageUrl}: extra keys ${extra.join(', ')}`);
    if ('u' in a && !CLASSES.has(a.u)) reasons.push(`${a.playbackId || a.imageUrl}: u = ${a.u}`);
    // s (P2, M2): a video's source short side below TOP_RUNG, or 0 = unknown; never on a still
    if ('s' in a && !(a.playbackId && Number.isInteger(a.s) && a.s >= 0)) reasons.push(`${a.playbackId || a.imageUrl}: s = ${a.s}`);
  }
  const withU = assets.filter((a) => 'u' in a).length;
  const withS = assets.filter((a) => 's' in a).length;
  const esc = props.match(/,&quot;u&quot;:\[0,&quot;[a-z]+&quot;\]/g) || [];
  const escS = props.match(/,&quot;s&quot;:\[0,\d+\]/g) || [];
  const uBytes = sum(esc.map((s) => s.length));
  const sBytes = sum(escS.map((s) => s.length));
  if (!assets.length) reasons.push('globeWorlds carries no assets');
  if (esc.some((s) => s.length > 40)) reasons.push('a u entry is over 40 B');
  if (esc.length !== withU) reasons.push(`${esc.length} escaped u entries against ${withU} assets with u`);
  if (escS.length !== withS) reasons.push(`${escS.length} escaped s entries against ${withS} assets with s`);
  if (unitsAbsent && withU + withS > 0) reasons.push(`${withU} assets carry u and ${withS} carry s before P2`);
  if (!unitsAbsent && withU === 0) reasons.push('no asset carries u');
  return { ok: reasons.length === 0, reasons, assets: assets.length, withU, uBytes, withS, sBytes };
}

// CLI (the probe and the tests import this module; only a direct run gets here).
const isMain = (() => {
  try {
    return fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]);
  } catch {
    return false;
  }
})();
if (isMain) {
  const args = process.argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  const ef = args.find((a) => a.startsWith('--expect-fail='));
  let ok = false;
  if (ef && files.length === 1) {
    const r = expectFail(JSON.parse(fs.readFileSync(files[0], 'utf8')), ef.slice('--expect-fail='.length).split(',').filter(Boolean));
    for (const line of r.reasons) console.error(`unitGates: ${line}`);
    console.log(r.ok ? 'expect-fail: every named gate failed non-vacuously' : 'expect-fail: NOT MET');
    ok = r.ok;
  } else if (args.includes('--payload') && files.length === 1) {
    const r = checkPayload(fs.readFileSync(files[0], 'utf8'), { unitsAbsent: args.includes('--units-absent') });
    for (const line of r.reasons) console.error(`unitGates: ${line}`);
    console.log(`payload: ${r.assets} assets, ${r.withU} with u, ${r.uBytes} B of u, ${r.withS} with s, ${r.sBytes} B of s`);
    ok = r.ok;
  } else {
    console.error('usage: node scripts/lib/unitGates.mjs --expect-fail=<gate>[,<gate>…] <report.json>');
    console.error('       node scripts/lib/unitGates.mjs --payload <dist/index.html> [--units-absent]');
  }
  process.exit(ok ? 0 : 1);
}
