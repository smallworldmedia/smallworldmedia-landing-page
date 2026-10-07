#!/usr/bin/env node
/**
 * process-probe — headless Playwright harness for the /process discovery slide.
 *
 * Usage:
 *   node scripts/process-probe.mjs [--mobile] [--vw=1440 --vh=900] [--secs=30]
 *        [--every=700] [--extra="&labelhold=4"] [--out=DIR] [--base=http://localhost:4321]
 *   node scripts/process-probe.mjs --transition [--extra="&threadtight=0.85&threaddrift=0.2"]
 *
 * Loads /process?debug=1 (the bench publishes `window.__swmProcessStats`
 * every 500ms — see ProcessDebugPanel), samples it for --secs, and writes a
 * JSON report: live chip count per sample (min / mean), duplicate-term and
 * overlapping-box checks, and every tour HOLD (blend ≥ 0.98 on a subject)
 * with the subject's actual NDC vs its seat, plus any target seen wearing
 * two different words across the run (a shard keeps its word). A screenshot is taken at each
 * hold so a station can be judged by eye. Same headless doctrine as
 * pager-probe.mjs: SwiftShader by default.
 *
 * --transition (09-11): instead of sampling the tour, wait until the camera
 * is mid-tour (off the wide), press the bench's stage-02 button and log the
 * CAMERA PATH through the S1→S2 connect + assembly every 0.5s for 14s —
 * the ?threadtight / ?threaddrift shape (tight on the first bead → creep →
 * pull-back with the assembly) is a z-curve, so it is judged as one. Two
 * screenshots: mid-trace and mid-assembly.
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const MOBILE = !!arg('mobile', false);
const VW = Number(arg('vw', MOBILE ? 390 : 1440));
const VH = Number(arg('vh', MOBILE ? 844 : 900));
const SECS = Number(arg('secs', 30));
const EVERY = Number(arg('every', 700));
const EXTRA = arg('extra', '');
const BASE = arg('base', 'http://localhost:4321');
const OUT = arg('out', path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', `process-${MOBILE ? 'm' : 'd'}`));
const GPU = arg('gpu', 'swiftshader');
const TRANSITION = !!arg('transition', false);
const URL_ = `${BASE}/process?debug=1${EXTRA}`;

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: GPU === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
});
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: MOBILE ? 2 : 1,
  hasTouch: MOBILE,
  isMobile: MOBILE,
});
const page = await ctx.newPage();
const report = { url: URL_, viewport: [VW, VH], samples: [], holds: [], consoleErrors: [], pageErrors: [] };
page.on('console', (m) => {
  if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 300)));

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__swmProcessStats?.chips, null, { timeout: 30000 });
// Let the arrival materialize land before judging anything.
await sleep(3000);

if (TRANSITION) {
  await sleep(6000); // mid-tour: the first leg has pushed in off the wide
  const rows = [];
  const t0 = Date.now();
  await page.click('.process-debug__stages button:nth-child(2)');
  while (Date.now() - t0 < 14000) {
    const s = await page.evaluate(() => window.__swmProcessStats);
    if (rows.length === 5 || rows.length === 11) {
      await page.screenshot({ path: path.join(OUT, `transition-${rows.length === 5 ? 'trace' : 'assembly'}.png`) });
    }
    rows.push({ t: +((Date.now() - t0) / 1000).toFixed(1), stage: s.stage, cam: s.cam });
    await sleep(500);
  }
  const zs = rows.map((r) => r.cam?.[2]).filter((z) => Number.isFinite(z));
  const summary = {
    tightZ: zs[1], // first sample after the glide-in
    // the trace's creep is slow; the assembly's pull-back is the first step > 0.1
    traceEndZ: (() => { for (let i = 2; i < zs.length; i++) if (zs[i] - zs[i - 1] > 0.1) return zs[i - 1]; return zs[zs.length - 1]; })(),
    restZ: zs[zs.length - 1],
    restXY: rows[rows.length - 1].cam?.slice(0, 2),
  };
  fs.writeFileSync(path.join(OUT, 'transition.json'), JSON.stringify({ url: URL_, rows, summary, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }, null, 2));
  console.log(rows.map((r) => `${r.t}\t${r.stage}\t${r.cam?.join('\t')}`).join('\n'));
  console.log(JSON.stringify({ summary, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }));
  await browser.close();
  process.exit(0);
}

const boxesHit = (a, b, h = 18) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < h;

// A target keeps its word for the life of the belt (Nathan 09-10): every
// (target id → term) pairing seen, and any target seen wearing two words.
const wordOf = new Map();
const relabelled = [];
let lastHoldKey = '';
const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  const s = await page.evaluate(() => window.__swmProcessStats);
  for (const c of s.chips) {
    const prev = wordOf.get(c.id);
    if (prev && prev !== c.term) relabelled.push({ id: c.id, was: prev, now: c.term, t: +((Date.now() - t0) / 1000).toFixed(1) });
    wordOf.set(c.id, c.term);
  }
  const terms = s.chips.map((c) => c.term);
  const dupes = terms.filter((t, i) => terms.indexOf(t) !== i);
  const overlaps = [];
  for (let i = 0; i < s.chips.length; i++)
    for (let j = i + 1; j < s.chips.length; j++)
      if (boxesHit(s.chips[i], s.chips[j])) overlaps.push([s.chips[i].term, s.chips[j].term]);
  const sample = { t: +((Date.now() - t0) / 1000).toFixed(1), fps: s.fps, stage: s.stage, chips: s.chips.length, dupes, overlaps, tour: s.tour };
  report.samples.push(sample);
  const holding = s.tour && typeof s.tour === 'object' && s.tour.blend >= 0.98;
  const key = holding ? `${s.tour.seatU},${s.tour.seatV}` : '';
  if (holding && key !== lastHoldKey) {
    const file = path.join(OUT, `hold-${String(report.holds.length + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    const errU = +(s.tour.u - s.tour.seatU).toFixed(2);
    const errV = +(s.tour.v - s.tour.seatV).toFixed(2);
    // Which shards are labelled at this hold — consecutive holds should
    // share few (each stop puts new shards in frame).
    const ids = s.chips.map((c) => c.id);
    const prev = report.holds[report.holds.length - 1];
    const repeat = prev ? ids.filter((id) => prev.ids.includes(id)).length : 0;
    report.holds.push({ t: sample.t, ...s.tour, errU, errV, chips: s.chips.length, ids, repeat, shot: file });
  }
  lastHoldKey = key;
  await sleep(EVERY);
}

const counts = report.samples.filter((x) => x.stage === 'stage-01').map((x) => x.chips);
report.summary = {
  samples: counts.length,
  chipsMin: Math.min(...counts),
  chipsMean: +(counts.reduce((a, b) => a + b, 0) / Math.max(counts.length, 1)).toFixed(2),
  chipsMax: Math.max(...counts),
  dupeSamples: report.samples.filter((x) => x.dupes.length).length,
  overlapSamples: report.samples.filter((x) => x.overlaps.length).length,
  targetsSeen: wordOf.size,
  relabelled,
  holds: report.holds.length,
  holdsLabelled: report.holds.filter((h) => h.labelled).length,
  holdRepeats: report.holds.map((h) => h.repeat),
  worstSeatErr: report.holds.length ? Math.max(...report.holds.map((h) => Math.max(Math.abs(h.errU), Math.abs(h.errV)))) : null,
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ summary: report.summary, holds: report.holds, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }, null, 2));
await browser.close();
