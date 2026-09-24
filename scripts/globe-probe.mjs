#!/usr/bin/env node
/**
 * globe-probe — headless Playwright harness for the home globe's population
 * modes (docs/globe-worlds-plan.md). Sibling of pager-probe (same launch
 * doctrine, same noise filter); reads window.__swmPopStats, which the
 * PopulationDirector publishes at ~2 Hz.
 *
 * Usage:
 *   node scripts/globe-probe.mjs [--mode=tides] [--secs=20] [--warm=6]
 *        [--next=2] [--seed=42] [--mobile] [--rm] [--intro=replay|full]
 *        [--extra="&popgroup=3"] [--base=http://localhost:4322] [--out=DIR]
 *
 * Samples the stats once a second for --secs, clicks the bench's ⏭ next
 * --next times (spread across the run) and times each one until the new
 * grouping has landed (landedMs, ±0.5 s — the stats publish at ~2 Hz),
 * screenshots at the warm mark, after each ⏭ and at the end, and prints a
 * JSON report whose `pass` block holds the plan's gates: integrity ≥ 0.95
 * during holds, 0 black visible tiles after --warm, a bounded texture count,
 * no in-place flips during a hold (assets are persistent at rest), every ⏭
 * landed, and no console/page errors. --mode=off checks the default globe runs
 * clean (no stats expected).
 *
 * Headless notes: SwiftShader is the default GPU (pager-probe's finding — the
 * GPU path starves the main thread); fps under it is NOT a device number.
 * ?intro=replay skips the ~5s logo intro (the full intro holds the globe dark,
 * so black tiles are expected until its cascade).
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const MODE = arg('mode', 'tides');
const SECS = Number(arg('secs', 20));
const WARM = Number(arg('warm', 6));
const NEXT = Number(arg('next', 0));
const SEED = arg('seed', '42');
const MOBILE = !!arg('mobile', false);
const RM = !!arg('rm', false);
const VW = Number(arg('vw', MOBILE ? 390 : 1440));
const VH = Number(arg('vh', MOBILE ? 844 : 900));
const INTRO = arg('intro', 'replay');
const EXTRA = arg('extra', '');
const BASE = arg('base', 'http://localhost:4322');
const GPU = arg('gpu', 'swiftshader');
const TEX_BOUND = Number(arg('texbound', 150)); // today's globe binds ~96
const OUT = arg(
  'out',
  // fileURLToPath, not URL.pathname — the Dropbox path has spaces (%20 would
  // mkdir a stray "Small%20World%20Media" tree beside the real one).
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', `globe-${MODE}-${MOBILE ? 'm' : 'd'}${RM ? '-rm' : ''}`)
);
const URL_ = `${BASE}/?popmode=${MODE}&popseed=${SEED}&poptune=1&intro=${INTRO}${EXTRA}`;

// pager-probe's environmental noise (headless CDN CORS, GPU readback stalls,
// Chrome's reduced-motion view-transitions warning) — never the page's fault.
const NOISE = [/cdn\.sanity\.io/, /net::ERR_FAILED/, /GPU stall due to ReadPixels/, /view.transition/i];

fs.mkdirSync(OUT, { recursive: true });
// Only this probe's own NN-name.png shots — never anything else in --out.
for (const f of fs.readdirSync(OUT)) if (/^\d\d-[\w-]+\.png$/.test(f)) fs.rmSync(path.join(OUT, f));
const report = { url: URL_, viewport: [VW, VH], mobile: MOBILE, rm: RM, samples: [], shots: [], consoleErrors: [], pageErrors: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error('dev server not reachable at ' + BASE);
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(report.shots.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  report.shots.push(file);
}

(async () => {
  await waitServer();
  const browser = await chromium.launch({
    headless: true,
    args: GPU === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: MOBILE ? 2 : 1,
    hasTouch: MOBILE,
    isMobile: MOBILE,
    reducedMotion: RM ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    if (!NOISE.some((re) => re.test(text))) report.consoleErrors.push(`${m.type()}: ${text.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 400)));
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.video-globe__canvas canvas', { timeout: 30000 });

  const nextAt = new Set(Array.from({ length: NEXT }, (_, i) => Math.round(WARM + ((i + 1) * (SECS - WARM)) / (NEXT + 1))));
  for (let t = 1; t <= SECS; t++) {
    await sleep(1000);
    const stats = await page.evaluate(() => window.__swmPopStats ?? null);
    report.samples.push({ t, ...(stats || { none: true }) });
    if (t === WARM) await shot(page, 'warm');
    if (nextAt.has(t)) {
      const chip = page.locator('.hero-tune--chip button'); // phones start collapsed
      if (await chip.count()) await chip.first().click();
      const btn = page.locator('.hero-tune--pop button', { hasText: 'next' });
      if (await btn.count()) {
        const step = await page.evaluate(() => window.__swmPopStats?.step ?? null);
        const t0 = Date.now();
        await btn.first().click();
        const landedMs = await page
          .waitForFunction(
            (from) => {
              const s = window.__swmPopStats;
              return s && s.step !== from && s.phase === 'hold' && s.integrity >= 0.95;
            },
            step,
            { timeout: 15000, polling: 100 }
          )
          .then(
            () => Date.now() - t0,
            () => null
          );
        report.samples.push({ t, action: 'next', landedMs });
        await shot(page, `next-t${t}`);
      } else report.samples.push({ t, action: 'next — bench button missing', landedMs: null });
    }
  }
  await shot(page, 'end');
  await browser.close();

  const stats = report.samples.filter((s) => s.phase);
  const warm = stats.filter((s) => s.t >= WARM);
  const holds = warm.filter((s) => s.phase === 'hold');
  // Flips between two hold samples of the same grouping — should never happen.
  const holdFlips = stats.slice(1).reduce((n, s, i) => {
    const prev = stats[i];
    const same = prev.phase === 'hold' && s.phase === 'hold' && prev.step === s.step && prev.seed === s.seed;
    return same ? n + (s.flips - prev.flips) : n;
  }, 0);
  const nexts = report.samples.filter((s) => s.action?.startsWith('next'));
  report.summary = {
    groupings: [...new Set(stats.map((s) => `${s.grouping.join(' + ')} [${s.pattern}]`))],
    minIntegrityInHolds: holds.length ? Math.min(...holds.map((s) => s.integrity)) : null,
    maxBlackAfterWarm: warm.length ? Math.max(...warm.map((s) => s.black)) : null,
    maxTextures: stats.length ? Math.max(...stats.map((s) => s.gpuTextures ?? s.textures)) : null,
    flips: stats.length ? stats[stats.length - 1].flips : null,
    holdFlips,
    nextLandedMs: nexts.map((s) => s.landedMs),
    fps: warm.map((s) => s.fps),
  };
  const m = report.summary;
  report.pass =
    MODE === 'off'
      ? { noStats: stats.length === 0, clean: !report.consoleErrors.length && !report.pageErrors.length }
      : {
          integrity: m.minIntegrityInHolds != null && m.minIntegrityInHolds >= 0.95,
          noBlackAfterWarm: m.maxBlackAfterWarm === 0,
          texturesBounded: m.maxTextures != null && m.maxTextures <= TEX_BOUND,
          quietHolds: m.holdFlips === 0,
          nextLanded: m.nextLandedMs.every((ms) => ms != null),
          clean: !report.consoleErrors.length && !report.pageErrors.length,
        };
  console.log(JSON.stringify(report, null, 1));
  if (Object.values(report.pass).some((v) => !v)) process.exit(2);
})().catch((e) => {
  report.fatal = String(e && e.stack ? e.stack : e);
  console.log(JSON.stringify(report, null, 1));
  process.exit(1);
});
