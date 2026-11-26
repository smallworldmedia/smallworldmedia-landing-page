#!/usr/bin/env node
/**
 * info-push-probe — headless Playwright harness for the home info drawer's
 * push-down (SQ-70, 11-12; src/lib/infoPush.js).
 *
 * Usage:
 *   node scripts/info-push-probe.mjs [--mobile] [--rm] [--base=http://localhost:4330]
 *        [--out=DIR] [--scenario=push,resize,zoom,route,copy,all]
 *
 * Prints one JSON report (every number the SQ-70 acceptance reads) and writes
 * PNGs to --out. Run it through ~/swm-probe-lock.sh, one browser at a time.
 *
 *   push    open the drawer on `/`: the footer bar's top edge vs innerHeight at
 *           the end of the open, every pushed surface's delta, a per-frame
 *           lockstep trace (drawer progress vs push progress), then close and
 *           compare every surface with its resting rect.
 *   resize  open, shrink the viewport, read the bar again.
 *   zoom    open, tap zoom_in (desktop: Enter on it — its drawer covers the
 *           button): the drawer's close, the push reversing, and the first
 *           frame the zoom's chrome-out starts, per frame.
 *   route   /work: the drawer opens with no push var and nothing displaced.
 *   copy    the drawer's blurb text and its bold cut.
 *
 * Headless doctrine (pager-probe): swiftshader, a long first settle, and
 * readouts a frame or two late — the trace is per rAF, the end reads wait.
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright is not a project dependency; see pager-probe.mjs for the path rule.
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
const RM = !!arg('rm', false);
const BASE = arg('base', 'http://localhost:4330');
const SCEN = String(arg('scenario', 'all')).split(',');
const want = (s) => SCEN.includes('all') || SCEN.includes(s);
const VW = MOBILE ? 390 : 1440;
const VH = MOBILE ? 844 : 900;
// fileURLToPath, not URL.pathname — the Dropbox path has spaces.
const OUT = arg(
  'out',
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', `info-push-${MOBILE ? 'm' : 'd'}${RM ? '-rm' : ''}`)
);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every surface the push moves (global.css INFO PUSH block).
const SURFACES = {
  footer: '.site-footer--links',
  globe: '.hero__globe',
  lead: '.hero__lead-col',
  stroke: '.hero__globe-stroke',
  tagline: '.site-tagline',
};

const browser = await chromium.launch({ headless: true, args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  hasTouch: MOBILE,
  isMobile: MOBILE,
  deviceScaleFactor: 1,
  reducedMotion: RM ? 'reduce' : 'no-preference',
});
const page = await ctx.newPage();
const report = { viewport: [VW, VH], mobile: MOBILE, reducedMotion: RM, consoleErrors: [] };
page.on('pageerror', (e) => report.consoleErrors.push(String(e)));

/** Rect tops of every pushed surface + the page's own numbers. */
const readRest = () =>
  page.evaluate((sel) => {
    const out = { innerHeight: innerHeight };
    for (const [k, s] of Object.entries(sel)) {
      const el = document.querySelector(s);
      out[k] = el ? el.getBoundingClientRect().top : null;
    }
    const hero = document.querySelector('.hero');
    out.heroBgPos = hero ? getComputedStyle(hero).backgroundPositionY : null;
    out.push = parseFloat(document.documentElement.style.getPropertyValue('--info-push')) || 0;
    out.wrapperTop = document.querySelector('.info-wrapper')?.getBoundingClientRect().top;
    return out;
  }, SURFACES);

/** Record a rAF trace for `ms`, starting now; resolves with the frames. */
const startTrace = (ms) =>
  page.evaluate(
    (ms) =>
      new Promise((res) => {
        const out = [];
        const t0 = performance.now();
        const wrap = document.querySelector('.info-wrapper');
        const bar = document.querySelector('.site-footer--links');
        const lead = document.querySelector('.hero__lead-col');
        const step = () => {
          const t = performance.now() - t0;
          out.push({
            t: Math.round(t),
            wy: wrap.getBoundingClientRect().top,
            push: parseFloat(document.documentElement.style.getPropertyValue('--info-push')) || 0,
            ft: bar ? bar.getBoundingClientRect().top : null,
            lead: lead ? +getComputedStyle(lead).opacity : null,
            path: location.pathname,
          });
          if (t < ms) requestAnimationFrame(step);
          else res(out);
        };
        requestAnimationFrame(step);
      }),
    ms
  );

const openBtn = 'button[aria-label="Open info panel"]';
const closeBtn = 'button[aria-label="Close info panel"]';

async function loadHome() {
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  // The first-visit intro, the footer's on-load slide and the globe's textures.
  await page.waitForTimeout(9000);
}

if (want('push')) {
  await loadHome();
  const rest = await readRest();
  await page.screenshot({ path: path.join(OUT, 'rest.png') });
  const tracing = startTrace(1500);
  await page.click(openBtn);
  const trace = await tracing;
  await page.waitForTimeout(400);
  const open = await readRest();
  await page.screenshot({ path: path.join(OUT, 'open.png') });
  const D = open.push;
  // Lockstep: at every frame the drawer's progress (0 closed -> 1 open) and the
  // push's progress must agree. Drawer travel = open.wrapperTop - first wy.
  const wy0 = trace[0].wy;
  const wyEnd = trace.at(-1).wy;
  const dev = trace
    .filter((f) => wyEnd !== wy0 && D > 0)
    .map((f) => Math.abs((f.wy - wy0) / (wyEnd - wy0) - f.push / D));
  report.push = {
    rest,
    open,
    barTopMinusInnerHeight: open.footer - open.innerHeight,
    pushPx: D,
    surfaceDeltas: Object.fromEntries(Object.keys(SURFACES).map((k) => [k, open[k] - rest[k]])),
    lockstepMaxProgressDeviation: dev.length ? Math.max(...dev) : null,
    frames: trace.length,
    openEndsMs: trace.find((f) => f.wy >= wyEnd - 0.5)?.t,
    pushEndsMs: trace.find((f) => D > 0 && f.push >= D - 0.5)?.t,
  };
  const closing = startTrace(1500);
  await page.click(closeBtn);
  await closing;
  await page.waitForTimeout(400);
  const back = await readRest();
  report.push.afterClose = back;
  report.push.closeRestoredExactly = Object.keys(SURFACES).every((k) => Math.abs(back[k] - rest[k]) < 0.01) && back.push === 0;
  await page.screenshot({ path: path.join(OUT, 'closed.png') });
}

if (want('copy')) {
  if (!want('push')) await loadHome();
  await page.click(openBtn);
  await page.waitForTimeout(1400);
  report.copy = await page.evaluate(() => {
    const p = document.querySelector('.description__text');
    const b = p?.querySelector('.kw-em, strong');
    const cs = (el) => (el ? { color: getComputedStyle(el).color, fontWeight: getComputedStyle(el).fontWeight } : null);
    return { text: p?.textContent, boldText: b?.textContent, boldTag: b?.tagName, bold: cs(b), rect: p ? p.getBoundingClientRect().toJSON() : null };
  });
  await page.screenshot({ path: path.join(OUT, 'copy.png'), clip: { x: 0, y: 0, width: Math.min(VW, 400), height: 420 } });
  if (!want('push')) await page.click(closeBtn);
  else await page.click(closeBtn);
  await page.waitForTimeout(900);
}

if (want('resize')) {
  await loadHome();
  await page.click(openBtn);
  await page.waitForTimeout(1500);
  const before = await readRest();
  const [w2, h2] = MOBILE ? [VH, VW] : [1100, 760]; // rotation on a phone
  await page.setViewportSize({ width: w2, height: h2 });
  await page.waitForTimeout(1500);
  const after = await readRest();
  await page.screenshot({ path: path.join(OUT, 'resized.png') });
  report.resize = {
    before: { ...before, barTopMinusInnerHeight: before.footer - before.innerHeight },
    afterViewport: [w2, h2],
    after: { ...after, barTopMinusInnerHeight: after.footer - after.innerHeight },
  };
  await page.setViewportSize({ width: VW, height: VH });
  await page.waitForTimeout(800);
  const restored = await readRest();
  report.resize.restoredViewport = { ...restored, barTopMinusInnerHeight: restored.footer - restored.innerHeight };
}

if (want('zoom')) {
  await loadHome();
  await page.click(openBtn);
  await page.waitForTimeout(1500);
  const box = await page.locator('.hero__enter').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  // Desktop's drawer covers the button (a click lands on its client list), so
  // the same handler is reached from the keyboard there.
  if (!MOBILE) await page.focus('.hero__enter');
  const tracing = startTrace(2600);
  await sleep(60);
  if (MOBILE) await page.touchscreen.tap(x, y);
  else await page.keyboard.press('Enter');
  const trace = await tracing;
  const closedY = Math.min(...trace.map((f) => f.wy));
  const closeDoneAt = trace.find((f) => f.wy <= closedY + 0.5 && f.t > 100)?.t;
  const zoomStartAt = trace.find((f) => f.lead !== null && f.lead < 0.999)?.t;
  const wyStart = trace[0].wy;
  const maxWyJump = Math.max(...trace.slice(1).map((f, i) => Math.abs(f.wy - trace[i].wy)));
  report.zoom = {
    drawerWasOpenAtTap: wyStart === 0,
    closeDoneMs: closeDoneAt,
    zoomChromeOutStartMs: zoomStartAt,
    zoomStartsAfterCloseDone: zoomStartAt !== undefined && closeDoneAt !== undefined ? zoomStartAt >= closeDoneAt - 40 : null,
    maxDrawerFrameStepPx: maxWyJump,
    drawerPx: Math.abs(closedY - wyStart),
    pushPeak: Math.max(...trace.map((f) => f.push)),
    pushEnd: trace.at(-1).push,
    pathAtEnd: trace.at(-1).path,
    sample: trace.filter((_, i) => i % 6 === 0).map((f) => [f.t, Math.round(f.wy), Math.round(f.push), f.lead, f.path]),
  };
}

if (want('route')) {
  await page.goto(`${BASE}/work`, { waitUntil: 'load' });
  await page.waitForTimeout(5000);
  const before = await page.evaluate(() => ({
    footer: document.querySelector('.site-footer--links')?.getBoundingClientRect().top ?? null,
    tagline: document.querySelector('.site-tagline')?.getBoundingClientRect().top ?? null,
    latch: document.documentElement.hasAttribute('data-footer-rest'),
  }));
  await page.click(openBtn);
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({
    footer: document.querySelector('.site-footer--links')?.getBoundingClientRect().top ?? null,
    tagline: document.querySelector('.site-tagline')?.getBoundingClientRect().top ?? null,
    pushVar: document.documentElement.style.getPropertyValue('--info-push'),
    wrapperTop: document.querySelector('.info-wrapper')?.getBoundingClientRect().top,
    open: document.querySelector('.info-wrapper')?.dataset.open,
  }));
  report.route = { path: '/work', before, after, nothingDisplaced: before.footer === after.footer && before.tagline === after.tagline && after.pushVar === '' };
}

await browser.close();
console.log(JSON.stringify(report, null, 1));
