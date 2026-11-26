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
import { latticeOf, classSizeAt, UNIT_SHAPE, PAD_BG } from '../../src/components/globe/unitSpan.js';
import { LON_SEGMENTS, SCROLL_VISIBLE_ROWS, GAP_DEG, SCROLL_LAT_GAP_DEG } from '../../src/components/globe/globeConfig.js';

/** Probe levels, cumulative: each adds its gates to the ones below it. */
export const LEVELS = ['off', 'tex', 'h', 'vq', 'live', 'tier'];
const at = (ctx, level) => LEVELS.indexOf(ctx.level) >= LEVELS.indexOf(level);
const max = (xs) => xs.reduce((m, x) => (x > m ? x : m), 0);
const sum = (xs) => xs.reduce((a, x) => a + x, 0);
// — P7 — max() skips null and NaN, and a NaN reaches report.json as null. The P4b gates take their worst through
// this instead: one non-finite value (or a missing counter) makes the worst null, and the gate's finite check fails it.
const finiteMax = (xs) => (xs.every((x) => Number.isFinite(x)) ? max(xs) : null);

/** One gate: pass = non-vacuous && ok. A report-only gate is recorded in detail, never in pass. */
function gate(out, name, { n, floor = 1, ok, worst = null, bound = null, reportOnly = false, ...extra }) {
  const vacuous = !(n >= floor);
  out.detail[name] = { n, floor, vacuous, worst, bound, ...(reportOnly ? { reportOnly: true } : {}), ...extra };
  if (!reportOnly) out.pass[name] = !vacuous && !!ok;
}

// — P3 — the class texture sizes at T1: unitSpan.classSizeAt on the default lattice, each class at its slot's size
// (classic). — 10-24 — ?popshapes=wide sizes a texture by its picture's aspect, so there a class's sizes are a curve:
// classWideSizes lists every integer size on it, swept ≤ 0.25 px a step a little past the clamp's two ends (the
// rounded ends' aspects fall inside the true span; classSizeAt clamps the overshoot back onto them).
const SIZES = new Map();
const gateL = () => latticeOf({ lon: LON_SEGMENTS, visibleRows: SCROLL_VISIBLE_ROWS, gapDeg: GAP_DEG, latGapDeg: SCROLL_LAT_GAP_DEG });
export function classSizes(t1) {
  if (!SIZES.has(t1)) {
    const L = gateL();
    SIZES.set(t1, Object.fromEntries(Object.keys(UNIT_SHAPE).map((cls) => [cls, classSizeAt(cls, null, t1, L, { wide: false })])));
  }
  return SIZES.get(t1);
}
const WIDE_SIZES = new Map();
export function classWideSizes(t1) {
  if (!WIDE_SIZES.has(t1)) {
    const L = gateL();
    const sz = {};
    for (const cls of Object.keys(UNIT_SHAPE)) {
      const at = (r) => classSizeAt(cls, r, t1, L, { wide: true });
      const [[w0, h0], [w1, h1]] = [at(0), at(Infinity)];
      const [t0, t1x] = [(w0 - 1) / (h0 + 1), (w1 + 1) / (h1 - 1)];
      const steps = Math.ceil((t1x - t0) * 4 * (Math.max(w0, w1) + Math.max(h0, h1)));
      const seen = new Map();
      for (let i = 0; i <= steps; i++) {
        const s = at(t0 + ((t1x - t0) * i) / steps);
        seen.set(s.join('x'), s);
      }
      sz[cls] = [...seen.values()];
    }
    WIDE_SIZES.set(t1, sz);
  }
  return WIDE_SIZES.get(t1);
}

/** — P3 — (w, h) is the class size (W, H) scaled by ONE k in [kMin, 1] and rounded: texSpec's source
 *  clamp, on both CDNs. Exact (an interval test on k), so no aspect tolerance. */
const scaledFrom = (w, h, W, H, kMin = 0) => {
  const lo = Math.max((w - 0.5) / W, (h - 0.5) / H, kMin);
  const hi = Math.min((w + 0.5) / W, (h + 0.5) / H);
  return lo < hi && lo <= 1;
};
/** The class of a (w, h) request. Wide: the first curve holding it, squares first (a 1×2 and a 2×1 at aspect 1
 *  both meet the quad's size); a 3×2 or a 2×3 only at k ≥ 0.9, as only a sharp asset forms one (unitSpan.spanSharp),
 *  which keeps it apart from a scaled 2×1 or 1×2 (1100×540 would be a 3×2 at k 0.52). */
const WIDE_ORDER = ['q', 'h', 'v', 'w', 't'];
const SHARP_ONLY = new Set(['w', 't']);
const classOfSize = (t1, w, h, shapes) =>
  shapes === 'classic'
    ? Object.entries(classSizes(t1)).find(([, [W, H]]) => scaledFrom(w, h, W, H))?.[0]
    : WIDE_ORDER.find((cls) => classWideSizes(t1)[cls].some(([W, H]) => scaledFrom(w, h, W, H, SHARP_ONLY.has(cls) ? 0.9 : 0)));

/** A logged request → { kind: 'stream'|'legacy'|'class'|'other', id, query, shape }. id = host + path
 *  (a stream's: its playbackId). shape = the class, or for 'other' an id-free signature: path segments
 *  holding a digit or ≥ 16 characters become '*', query digits become '#' (the baseline's allow-list).
 *  A sequence frame with transparency is asked padded, `fit=fill&bg=PAD_BG` in place of the crop (unitSpan's
 *  stillSrc, 11-01), and classes as its cropped twin would: the legacy square, or a class size. */
export function classifyRequest(url, t1, shapes = 'wide') {
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
      const cls = classOfSize(t1, Number(p.width), Number(p.height), shapes);
      if (cls) return { kind: 'class', id, query, shape: cls };
    }
  } else if (u.host === 'cdn.sanity.io') {
    if (query === `w=${t1}&h=${t1}&fit=crop&crop=entropy&auto=format`) return { kind: 'legacy', id, query, shape: 'sanity' };
    if (query === `w=${t1}&h=${t1}&fit=fill&bg=${PAD_BG}&auto=format`) return { kind: 'legacy', id, query, shape: 'sanity-pad' };
    // — P3 — a class crop: the class size or its source clamp (a padded frame's clamp fits the source inside).
    const pad = keys === 'w&h&fit&bg&auto' && p.fit === 'fill' && p.bg === PAD_BG;
    if (((keys === 'w&h&fit&auto' && p.fit === 'crop') || pad) && p.auto === 'format') {
      const cls = classOfSize(t1, Number(p.w), Number(p.h), shapes);
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
  const reqs = (report.requests || []).map((url) => classifyRequest(url, ctx.t1, ctx.shapes));
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
    const REF = { 'u-desktop': 'off-desktop', 'u-mobile': 'off-mobile', 'u-rm': 'off-rm', 'u-tide': 'off-tide', 'u-phonehd': 'off-phonehd', 'u-phonehd720': 'off-phonehd', 'u-thumb-phonehd': 'off-phonehd' };
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

  // — P4b — h: what the units render. (P7: each worst must be finite, so a null or NaN fails its gate.)
  const seam = U.map((s) => s.units.seam).filter(Boolean);
  const seamW = finiteMax(seam.map((x) => x.worst));
  gate(out, 'unitSeam', { n: sum(seam.map((x) => x.n)), floor: 20, ok: Number.isFinite(seamW) && seamW <= 1e-4, worst: seamW, bound: 1e-4 });
  const reg = U.map((s) => s.units.register).filter(Boolean);
  const regW = finiteMax(reg.map((x) => x.worst));
  gate(out, 'unitRegister', { n: sum(reg.map((x) => x.n)), floor: 20, ok: Number.isFinite(regW) && regW <= 5e-6, worst: regW, bound: 5e-6 });
  const snaps = finiteMax(U.map((s) => s.units.snaps));
  gate(out, 'snaps', { n: U.length, ok: Number.isFinite(snaps) && snaps === 0, worst: snaps, bound: 0 });
  const skewBad = finiteMax(U.map((s) => s.units.skewBad));
  gate(out, 'skew', { n: max(U.map((s) => s.units.skewChecks ?? 0)), floor: 20, ok: Number.isFinite(skewBad) && skewBad === 0, worst: skewBad, bound: 0 });

  // — P5 — vq: columns across the row seam, the row mullion, warp inside ε, no V/Q at the first reveal.
  if (!at(ctx, 'vq')) return out;
  const cols = U.map((s) => s.units.cols).filter(Boolean);
  const colsW = max(cols.map((x) => x.worst));
  gate(out, 'unitColumns', { n: sum(cols.map((x) => x.n)), floor: 3, ok: colsW <= 1e-4, worst: colsW, bound: 1e-4 });
  const rows = U.map((s) => s.units.rows).filter(Boolean);
  const rowsW = max(rows.map((x) => x.worst));
  gate(out, 'unitRows', { n: sum(rows.map((x) => x.n)), floor: 3, ok: rowsW <= 1e-4, worst: rowsW, bound: 1e-4 });
  const warp = runHolds.map((s) => s.units.warp).filter(Boolean);
  const WARP_MAX = Math.log(1.15) + 0.002; // UNIT_EPS = 0.15; float slack (holds sit inside the planned life by construction)
  const warpW = max(warp.map((x) => x.worst));
  // P9's flat look pinches each fragment by its own latitude, so there is no row warp to bound (n counts rows-look units only).
  gate(out, 'unitWarp', { n: sum(warp.map((x) => x.n)), floor: 3, ok: warpW <= WARP_MAX, worst: warpW, bound: WARP_MAX, reportOnly: ctx.look === 'flat' });
  const initVQ = max(U.map((s) => s.units.initVQ ?? 0));
  const initPosed = U.filter((s) => s.units.initThetaH != null).length; // the initial plan saw a horizon: useGlobeScene's posed latch failed
  // 0 in every run: the initial layout is planned before the first pose, so its horizon is null and it places H only (M4).
  gate(out, 'initVQ', { n: U.length, ok: initVQ === 0 && initPosed === 0, worst: initVQ, bound: 0, initPosed });
  const placed = U.at(-1)?.units.placed ?? { h: 0, v: 0, q: 0, w: 0, t: 0 };
  gate(out, 'unitShapes', { n: Math.min(placed.h, placed.v + placed.q + (placed.w ?? 0) + (placed.t ?? 0)), ok: true, placed });

  // — P6a — live: one stream and one chip per unit; texB registers on whole live units.
  if (!at(ctx, 'live')) return out;
  const split = U.map((s) => s.units.liveSplit).filter(Boolean);
  const litN = sum(split.map((x) => x.n));
  const splitN = sum(split.map((x) => x.split));
  gate(out, 'unitLiveSplit', { n: litN, ok: splitN <= 0.02 * litN, worst: litN ? splitN / litN : 0, bound: 0.02 });
  const chips = max(U.map((s) => s.units.chipsPerUnit ?? 0));
  gate(out, 'chipsPerUnit', { n: litN, ok: chips <= 1, worst: chips, bound: 1 });
  const regB = U.map((s) => s.units.registerB).filter(Boolean);
  const regBW = max(regB.map((x) => x.worst));
  gate(out, 'unitRegisterB', { n: sum(regB.map((x) => x.n)), ok: regBW <= 1e-3, worst: regBW, bound: 1e-3 });

  // — P6b — tier: measured decode inside the pin's budget (today's at the default pin), rungs as planned, member density.
  if (!at(ctx, 'tier')) return out;
  const dec = S.map((s) => s.decode).filter((d) => d && d.budget != null);
  const decodeMax = ctx.decodemax ?? (dec.length ? dec[0].budget : null); // the published budget: Mux's real frames (frameOf), no tolerance (B1)
  const mp = max(dec.map((d) => d.mp));
  gate(out, 'decodeReal', { n: decodeMax == null ? 0 : dec.filter((d) => d.streams.length >= 2).length, ok: mp <= decodeMax, worst: mp, bound: decodeMax });
  const shown = dec.flatMap((d) => d.streams);
  const planned = shown.filter((x) => x.planShort != null && x.short > 0);
  // A box-limited plan (wider than 16:9) sits below its rung by design: counted, never judged.
  const boxLimited = shown.filter((x) => x.plan != null && x.planShort == null).length;
  const off = max(planned.map((x) => Math.abs(x.short - x.planShort)));
  gate(out, 'streamTier', { n: planned.length, ok: off <= 2, worst: off, bound: 2, boxLimited });
  // Density over 2 is judged against the rung the sample must show: the pin, or a rung its tier PLANS above the pin
  // (phonehd's pairs at 720 over the phone's 480 pin, Nathan's 10-31 "yes to HD"), never a rung a stream merely plays.
  const rungOf = (s) => Math.max(s.decode?.pinShort ?? 480, ...(s.decode?.streams ?? []).map((x) => x.planShort ?? 0));
  const dens = U.filter((s) => s.units.density?.n > 0 && s.r1 > 0);
  const over = max(dens.map((s) => s.units.density.worst - (ctx.densitymax ?? Math.max(2, rungOf(s) / s.r1))));
  gate(out, 'videoDensityMax', {
    n: sum(dens.map((s) => s.units.density.n)),
    ok: over <= 1e-3,
    worst: max(dens.map((s) => s.units.density.worst)),
    bound: ctx.densitymax ?? 'max(2, rung / r1)',
  });
  return out;
}

/** — P7 — darkThumbs (report-only, Nathan's Q12): is a class texture near-black (luma mean < 16) or flat
 *  (sd < 6), on the 0–255 scale? `px` holds raw greyscale pixels, as the probe's sharp
 *  .greyscale().raw() gives them; with `channels` > 1, the other bytes of each pixel (alpha) are skipped.
 *  Returns { mean, sd } to one decimal when the texture is listed, else null. No gate reads it. */
export function darkThumb(px, channels = 1) {
  let n = 0;
  let s = 0;
  let s2 = 0;
  for (let i = 0; i < px.length; i += channels) {
    s += px[i];
    s2 += px[i] * px[i];
    n += 1;
  }
  const mean = s / n; // no pixel: NaN, which is never listed
  const sd = Math.sqrt(s2 / n - mean * mean);
  return mean < 16 || sd < 6 ? { mean: Math.round(mean * 10) / 10, sd: Math.round(sd * 10) / 10 } : null;
}

/** A run's baseline record: what --record-baseline stores under its key. */
export function baselineOf(report, ctx) {
  const reqs = (report.requests || []).map((url) => classifyRequest(url, ctx.t1, ctx.shapes));
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

/** The island payload (dist/index.html): globeWorlds' assets stay lean, and `u`, `uw` and `s` are exactly where they should be. */
export function checkPayload(html, { unitsAbsent = false } = {}) {
  const reasons = [];
  const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Astro's island props: every value is [type, value]; 0 = a plain value (objects recurse), 1 = an array.
  const revive = ([t, v]) =>
    t === 1 ? v.map(revive) : t === 0 && v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)])) : v;
  const props = [...html.matchAll(/<astro-island\b[^>]*?\sprops="([^"]*)"/g)].map((m) => m[1]).find((p) => p.includes('&quot;globeWorlds&quot;'));
  if (!props) return { ok: false, reasons: ['no astro-island carries globeWorlds'], assets: 0, withU: 0, uBytes: 0, withUw: 0, uwBytes: 0, withS: 0, sBytes: 0 };
  const worlds = revive(JSON.parse(unescape(props)).globeWorlds);
  const assets = worlds.flatMap((w) => w.assets || []);
  const LEAN = new Set(['kind', 'playbackId', 'imageUrl', 'videoAspectRatio', 'u', 'uw', 's']);
  const CLASSES = new Set(['h', 'v', 'q']);
  const WIDE = new Set(['w', 'v', 'q']); // uw: ?popshapes=wide (10-24)
  for (const a of assets) {
    const extra = Object.keys(a).filter((k) => !LEAN.has(k));
    if (extra.length) reasons.push(`${a.playbackId || a.imageUrl}: extra keys ${extra.join(', ')}`);
    if ('u' in a && !CLASSES.has(a.u)) reasons.push(`${a.playbackId || a.imageUrl}: u = ${a.u}`);
    if ('uw' in a && !WIDE.has(a.uw)) reasons.push(`${a.playbackId || a.imageUrl}: uw = ${a.uw}`);
    // s (P2, M2): a video's source short side below TOP_RUNG, or 0 = unknown; never on a still
    if ('s' in a && !(a.playbackId && Number.isInteger(a.s) && a.s >= 0)) reasons.push(`${a.playbackId || a.imageUrl}: s = ${a.s}`);
  }
  const withU = assets.filter((a) => 'u' in a).length;
  const withUw = assets.filter((a) => 'uw' in a).length;
  const withS = assets.filter((a) => 's' in a).length;
  const esc = props.match(/,&quot;u&quot;:\[0,&quot;[a-z]+&quot;\]/g) || [];
  const escW = props.match(/,&quot;uw&quot;:\[0,&quot;[a-z]+&quot;\]/g) || [];
  const escS = props.match(/,&quot;s&quot;:\[0,\d+\]/g) || [];
  const uBytes = sum(esc.map((s) => s.length));
  const uwBytes = sum(escW.map((s) => s.length));
  const sBytes = sum(escS.map((s) => s.length));
  if (!assets.length) reasons.push('globeWorlds carries no assets');
  if ([...esc, ...escW].some((s) => s.length > 40)) reasons.push('a u or uw entry is over 40 B');
  if (esc.length !== withU) reasons.push(`${esc.length} escaped u entries against ${withU} assets with u`);
  if (escW.length !== withUw) reasons.push(`${escW.length} escaped uw entries against ${withUw} assets with uw`);
  if (escS.length !== withS) reasons.push(`${escS.length} escaped s entries against ${withS} assets with s`);
  if (unitsAbsent && withU + withUw + withS > 0) reasons.push(`${withU} assets carry u, ${withUw} uw and ${withS} s before P2`);
  if (!unitsAbsent && withU === 0) reasons.push('no asset carries u');
  if (!unitsAbsent && withUw === 0) reasons.push('no asset carries uw');
  return { ok: reasons.length === 0, reasons, assets: assets.length, withU, uBytes, withUw, uwBytes, withS, sBytes };
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
    console.log(`payload: ${r.assets} assets, ${r.withU} with u, ${r.uBytes} B of u, ${r.withUw} with uw, ${r.uwBytes} B of uw, ${r.withS} with s, ${r.sBytes} B of s`);
    ok = r.ok;
  } else {
    console.error('usage: node scripts/lib/unitGates.mjs --expect-fail=<gate>[,<gate>…] <report.json>');
    console.error('       node scripts/lib/unitGates.mjs --payload <dist/index.html> [--units-absent]');
  }
  process.exit(ok ? 0 : 1);
}
