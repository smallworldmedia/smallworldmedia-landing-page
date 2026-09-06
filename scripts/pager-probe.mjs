#!/usr/bin/env node
/**
 * pager-probe — headless Playwright harness for the /work ?pager= arms.
 *
 * Usage:
 *   node pager-probe.mjs --variant=scale --root=.fp-scale [--vw=1440 --vh=900]
 *        [--mobile] [--rm] [--out=DIR] [--scenario=rest,hover,wheel,touch,peek,keys,all]
 *        [--extra="&detent=56"] [--hold=260] [--detents=2] [--base=http://127.0.0.1:4321]
 *
 * Prints a JSON report to stdout (console errors, page errors, readouts per
 * step) and writes PNG screenshots to --out. Touch gestures go through CDP
 * Input.dispatchTouchEvent (Playwright's mouse never becomes a touch pointer).
 *
 * Headless doctrine, learned the hard way (09-01):
 *   - /work starves the main thread on the GPU path (~250ms timer lag, 150ms
 *     frames), so the engine's 200ms hold timer beats a 60ms tap and peeks
 *     never register. SwiftShader is therefore the DEFAULT (~30ms lag).
 *   - React-state-driven attributes (data-open/data-charged) land a render
 *     late, hence --settle before every readout. `.fp.is-pager-engaged` is
 *     the imperative ground truth for engagement.
 *   - Environmental console noise to ignore: cdn.sanity.io CORS image errors,
 *     net::ERR_FAILED, "GPU stall due to ReadPixels", and Chrome's own
 *     reduced-motion view-transitions warning.
 *   - The two awaited desktop wheel ticks land ~1.4s apart under SwiftShader,
 *     so the wheel scenario reads as two bursts and can commit twice. Real
 *     hardware sends them as one burst / one commit.
 */
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright is NOT a project dependency (the repo ships no test runner). Point
// PLAYWRIGHT_PATH at any install whose browsers are downloaded; the default is
// the npx-cached 1.62.1 that carries chromium-1234 on Nathan's machine. The
// copy bundled with @playwright/mcp has no browser and will not launch.
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const VARIANT = arg('variant', 'scale'); // tape/tuner arms deleted 09-05
const ROOT = arg('root', '.fp-scale');
const MOBILE = !!arg('mobile', false);
const VW = Number(arg('vw', MOBILE ? 390 : 1440));
const VH = Number(arg('vh', MOBILE ? 844 : 900));
const RM = !!arg('rm', false);
const OUT = arg('out', path.join(path.dirname(new URL(import.meta.url).pathname), 'shots', `${VARIANT}-${MOBILE ? 'm' : 'd'}${RM ? '-rm' : ''}`));
const SCEN = String(arg('scenario', 'all')).split(',');
const EXTRA = arg('extra', '');
const HOLD = Number(arg('hold', 260));
const DETENTS = Number(arg('detents', 2));
const BASE = arg('base', 'http://127.0.0.1:4321');
const PEEKWAIT = Number(arg('peekwait', 250));
const GPU = arg('gpu', 'swiftshader'); // swiftshader (default: ~30ms timer lag) | default (GPU path: ~250ms main-thread starvation)
const SETTLE = Number(arg('settle', 250)); // extra ms before every readout (headless render lag)
const URL_ = `${BASE}/work?pager=${VARIANT}${EXTRA}`;
const want = (s) => SCEN.includes('all') || SCEN.includes(s);

fs.mkdirSync(OUT, { recursive: true });
const report = { url: URL_, viewport: [VW, VH], mobile: MOBILE, rm: RM, steps: [], consoleErrors: [], pageErrors: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    try {
      const r = await fetch(`${BASE}/work`);
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error('dev server not reachable at ' + BASE);
}

const readout = (page) =>
  page.evaluate((root) => {
    const r = document.querySelector(root);
    const q = (s) => r?.querySelector(s);
    const rect = r?.getBoundingClientRect();
    return {
      rootPresent: !!r,
      legacyRailPresent: !!document.querySelector('.fp-pager'),
      open: r?.hasAttribute('data-open') ?? null,
      charged: r?.hasAttribute('data-charged') ?? null,
      engagedClass: document.querySelector('.fp')?.classList.contains('is-pager-engaged') ?? null,
      stageOpacity: document.querySelector('.fp-stage') ? getComputedStyle(document.querySelector('.fp-stage')).opacity : null,
      live: q('[aria-live]')?.textContent ?? null,
      current: q('[aria-current="true"]')?.textContent?.trim() ?? null,
      slider: q('[role="slider"]') ? { now: q('[role="slider"]').getAttribute('aria-valuenow'), text: q('[role="slider"]').getAttribute('aria-valuetext') } : null,
      rootRect: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      projectColor: document.querySelector('.fp')?.style.getPropertyValue('--project-color') || null,
      html: r ? r.outerHTML.replace(/\s+/g, ' ').slice(0, 900) : null,
    };
  }, ROOT);

async function step(page, name, fn) {
  if (fn) await fn();
  if (SETTLE) await sleep(SETTLE);
  const r = await readout(page);
  const file = path.join(OUT, `${String(report.steps.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  report.steps.push({ name, ...r, shot: file });
}

async function rootCenter(page) {
  const b = await page.locator(ROOT).first().boundingBox();
  if (!b) throw new Error('root not found: ' + ROOT);
  return { x: b.x + Math.min(b.width, 30) / 2, y: b.y + b.height / 2, box: b };
}

// CDP touch: press, hold, slide dy (negative = up = next), release.
async function touchScrub(page, cdp, x, y, dy, holdMs, { steps = 12, flick = false } = {}) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(holdMs);
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + (dy * i) / steps, id: 1 }] });
    await sleep(flick ? 8 : 40);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
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
    if (m.type() === 'error' || m.type() === 'warning') report.consoleErrors.push(`${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 400)));
  await page.goto(URL_, { waitUntil: 'networkidle' });
  await page.waitForSelector('.fp', { timeout: 30000 });
  try {
    await page.waitForSelector(ROOT, { timeout: 15000 });
  } catch {
    report.fatal = `variant root ${ROOT} never mounted`;
  }
  await sleep(1200); // card boot + globe warm-up

  if (!report.fatal) {
    const cdp = MOBILE ? await ctx.newCDPSession(page) : null;
    await step(page, 'rest');

    if (!MOBILE && want('hover')) {
      const c = await rootCenter(page);
      await page.mouse.move(c.x, c.y);
      await sleep(400);
      await step(page, 'hover-engaged');
      await page.mouse.move(VW / 2, VH / 2);
      await sleep(700);
      await step(page, 'hover-left');
    }
    if (!MOBILE && want('wheel')) {
      const c = await rootCenter(page);
      await page.mouse.move(c.x, c.y);
      await sleep(50);
      for (let i = 0; i < DETENTS; i++) {
        await page.mouse.wheel(0, 90);
        await sleep(60);
      }
      await sleep(120);
      await step(page, 'wheel-mid');
      await sleep(900); // > stall commit
      await step(page, 'wheel-committed');
      await page.mouse.move(VW / 2, VH / 2);
      await sleep(2200); // Turn + retract
      await step(page, 'wheel-after-turn');
    }
    if (MOBILE && want('peek')) {
      const c = await rootCenter(page);
      // Atomic tap: start+end queued back-to-back so a 186ms SwiftShader frame can't
      // separate them past the engine's 200ms hold threshold.
      await Promise.all([
        cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] }),
        cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }),
      ]);
      await sleep(PEEKWAIT);
      await step(page, 'peek-open');
      await sleep(1100);
      await step(page, 'peek-closed');
    }
    if (MOBILE && want('touch')) {
      const c = await rootCenter(page);
      // press-hold, then slide up DETENTS stations (56px each) — sample mid-scrub
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 1 }] });
      await sleep(HOLD);
      await step(page, 'touch-held');
      const dy = -56 * DETENTS;
      for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x, y: c.y + (dy * i) / 10, id: 1 }] });
        await sleep(40);
      }
      await sleep(150);
      await step(page, 'touch-scrub');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(350);
      await step(page, 'touch-released');
      await sleep(2200);
      await step(page, 'touch-after-turn');
      // overtravel: from the landed station slide DOWN past index 0 hard
      const c2 = await rootCenter(page);
      await touchScrub(page, cdp, c2.x, c2.y, 56 * 6, HOLD);
      await sleep(300);
      await step(page, 'touch-overtravel-released');
      await sleep(2200);
      await step(page, 'touch-overtravel-after');
    }
    if (want('keys')) {
      const el = page.locator(`${ROOT} button, ${ROOT} [tabindex="0"]`).first();
      if ((await el.count()) > 0) {
        await el.focus();
        await page.keyboard.press('ArrowDown');
        await sleep(120);
        await step(page, 'key-arrow');
        await sleep(700);
        await step(page, 'key-committed');
        await page.keyboard.press('Escape');
        await page.evaluate(() => document.activeElement && document.activeElement.blur()); // never click: [PREVIOUS] sits top-center
        await sleep(2000);
        await step(page, 'key-after');
      }
    }
  }
  await browser.close();
  console.log(JSON.stringify(report, null, 1));
})().catch((e) => {
  report.fatal = String(e && e.stack ? e.stack : e);
  console.log(JSON.stringify(report, null, 1));
  process.exit(1);
});
