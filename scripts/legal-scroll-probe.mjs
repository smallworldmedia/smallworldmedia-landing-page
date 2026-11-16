#!/usr/bin/env node
/**
 * legal-scroll-probe — do /terms and /privacy scroll top to bottom by finger on a phone, and by
 * wheel on desktop? (SQ-109)
 *
 * Usage:
 *   node scripts/legal-scroll-probe.mjs --base=http://127.0.0.1:4341 [--out=run.json]
 * One browser probe at a time on this machine (~/swm-probe-lock.sh).
 *
 * Each legal page runs on a cold load and on a soft nav (ClientRouter) from /work:
 *   touch   Chromium, iPhone 17 Pro (isMobile, hasTouch), real compositor touch swipes through
 *           CDP Input.dispatchTouchEvent until the page reaches its bottom or stops moving
 *   webkit  WebKit, iPhone 17 Pro: the user-scroll locks the page states (scrollLocks: viewport
 *           overflow, touch-action under the finger, a stopped Lenis). Playwright WebKit has no
 *           touch-drag input, so WebKit's leg reads the conditions a finger scroll needs rather
 *           than performing one.
 *   wheel   desktop Chromium and WebKit, mouse wheel to the bottom
 * The verdict is scripts/lib/legalScrollGate.mjs. Exit 0 when every run passes, 1 otherwise.
 *
 * What it cannot show about real iOS: Safari's own rubber-band and momentum, the collapsing
 * toolbar's viewport resize, and anything iOS does differently from WebKit-on-macOS in touch
 * dispatch. Nathan's iPhone stays the last word.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { verdict, scrollLocks } from './lib/legalScrollGate.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);
const BASE = args.base;
if (!BASE) throw new Error('--base is required');
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH ?? '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const PHONE = devices['iPhone 17 Pro'] ?? devices['iPhone 15 Pro'];
const PAGES = ['/terms', '/privacy'];

// In-page: the style snapshot scrollLocks() reads, plus the scroll extents.
const snapshot = () => {
  const h = document.documentElement;
  const chain = [];
  for (let e = document.elementFromPoint(innerWidth / 2, innerHeight * 0.6); e; e = e.parentElement) {
    chain.push({ el: `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}`, touchAction: getComputedStyle(e).touchAction });
  }
  return {
    html: { overflowY: getComputedStyle(h).overflowY },
    body: { overflowY: getComputedStyle(document.body).overflowY },
    chain,
    stopped: h.classList.contains('lenis-stopped'),
    scrollY: scrollY,
    maxScroll: h.scrollHeight - innerHeight,
  };
};

// Land on `path` cold, or soft from /work through a ClientRouter link click.
async function land(page, path, soft) {
  if (!soft) {
    await page.goto(BASE + path, { waitUntil: 'load' });
  } else {
    await page.goto(BASE + '/work', { waitUntil: 'load' });
    await sleep(2500);
    await page.evaluate(() => { window.__sq109soft = 1; });
    await page.evaluate((p) => {
      const a = Object.assign(document.createElement('a'), { href: p, textContent: 'probe' });
      a.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647';
      document.body.append(a);
      a.click();
    }, path);
    await page.waitForURL((u) => u.pathname.replace(/\/+$/, '') === path, { timeout: 15000 });
  }
  await sleep(2500);
  const softKept = await page.evaluate(() => window.__sq109soft === 1);
  if (soft && !softKept) throw new Error(`soft nav to ${path} was a full load`);
}

async function touchRun(browser, path, soft) {
  const ctx = await browser.newContext({ ...PHONE });
  const page = await ctx.newPage();
  await land(page, path, soft);
  const cdp = await ctx.newCDPSession(page);
  const before = await page.evaluate(snapshot);
  const x = Math.round(PHONE.viewport.width / 2);
  const y0 = Math.round(PHONE.viewport.height * 0.8);
  let last = before.scrollY;
  for (let i = 0; i < 16; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
    for (let s = 1; s <= 10; s++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - s * 42 }] });
      await sleep(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(700);
    const now = await page.evaluate(() => scrollY);
    if (now >= before.maxScroll - 1 || (i >= 2 && now === last)) { last = now; break; }
    last = now;
  }
  await ctx.close();
  return { start: before.scrollY, end: last, maxScroll: before.maxScroll };
}

async function webkitRun(browser, path, soft) {
  const ctx = await browser.newContext({ ...PHONE });
  const page = await ctx.newPage();
  await land(page, path, soft);
  const snap = await page.evaluate(snapshot);
  await ctx.close();
  return { maxScroll: snap.maxScroll, locks: scrollLocks(snap) };
}

async function wheelRun(browser, path, soft) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await land(page, path, soft);
  const before = await page.evaluate(snapshot);
  await page.mouse.move(720, 450);
  let last = before.scrollY;
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel(0, 300);
    await sleep(150);
  }
  await sleep(1500);
  last = await page.evaluate(() => scrollY);
  await ctx.close();
  return { start: before.scrollY, end: last, maxScroll: before.maxScroll };
}

const results = [];
const cr = await chromium.launch();
const wk = await webkit.launch();
try {
  for (const path of PAGES) {
    for (const soft of [false, true]) {
      const tag = `${path.slice(1)}-${soft ? 'soft' : 'cold'}`;
      for (const [leg, fn, browser] of [
        ['touch', touchRun, cr],
        ['webkit', webkitRun, wk],
        ['wheel-chromium', wheelRun, cr],
        ['wheel-webkit', wheelRun, wk],
      ]) {
        const id = `${tag}:${leg}`;
        try {
          const rec = { id, ...(await fn(browser, path, soft)) };
          results.push({ rec, v: verdict(rec) });
        } catch (e) {
          results.push({ rec: { id }, v: { id, pass: false, fails: [`probe error: ${e.message.split('\n')[0]}`] } });
        }
      }
    }
  }
} finally {
  await cr.close();
  await wk.close();
}

for (const { rec, v } of results) {
  const where = 'end' in rec ? ` scrollY ${rec.start}→${Math.round(rec.end)} of ${Math.round(rec.maxScroll)}` : rec.maxScroll != null ? ` maxScroll ${Math.round(rec.maxScroll)}` : '';
  console.log(`${v.pass ? 'PASS' : 'FAIL'} ${v.id}${where}${v.fails.length ? ' — ' + v.fails.join('; ') : ''}`);
}
if (args.out) writeFileSync(args.out, JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.v.pass).length;
console.log(`${results.length - failed}/${results.length} pass`);
process.exit(failed ? 1 : 0);
