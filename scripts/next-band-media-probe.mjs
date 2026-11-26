#!/usr/bin/env node
/**
 * next-band-media-probe — where does the next-project band's media sit in its container, frame by
 * frame, from the entrance of the pull to the page turn? A measurement, not a gate: it prints the
 * numbers and exits 0 (a failing check line reads "FAIL").
 *
 * Usage:
 *   ~/swm-probe-lock.sh node scripts/next-band-media-probe.mjs --base=http://127.0.0.1:4351
 *        [--path=/work/cheetah-print/] [--phone] [--out=run.json] [--query=k=v]
 *
 * Desktop (default 1440x900) drives a scripted wheel pull; --phone (390x844, touch, 3x) drives a
 * finger drag over CDP (first move clears the touch slop; the finger holds until the commit).
 * Every animation frame, in the page, it reads (the page is left alone):
 *   container  the VISIBLE window: .np-band__window (the older clip-path build: .np-band__media minus its clip-path inset; both
 *              read the same way)
 *   media      the media element's rect (img / video / placeholder; the zoom transform included)
 *   fit        the object-fit:cover box of an img / video (natural size known), centred
 *   phase      "pull" until the media is promoted to position:fixed, then "commit"
 * Checks, over the pull + commit frames that have a visible container (> 8px wide):
 *   centre   |media centre - container centre| <= 1 px on both axes
 *   cover    the media rect covers the container (no gap, 1 px slack)
 *   monotone the media width never shrinks (1 px slack)
 *   turn     on the last frame before the page swaps, media width = container width (+-1 px), and
 *            the container is the viewport
 * One browser probe at a time on this machine (wrap it in ~/swm-probe-lock.sh).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const base = arg('base', process.env.GLOBE_PROBE_BASE);
if (!base) {
  console.error('next-band-media-probe: --base=URL is required');
  process.exit(1);
}
const phone = !!arg('phone', false);
const route = arg('path', '/work/cheetah-print/');
const out = arg('out', null);
const query = [phone ? 'blurbhold=0' : null, arg('query', null)].filter(Boolean).join('&');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');

const viewport = phone ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
  viewport,
  deviceScaleFactor: phone ? 3 : 1,
  hasTouch: phone,
  isMobile: phone,
});
const page = await ctx.newPage();
const samples = [];
await page.exposeFunction('__npSample', (s) => samples.push(s));
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.goto(`${base}${route}${query ? `?${query}` : ''}`, { waitUntil: 'load' });
await sleep(3000);
if (!(await page.$('.np-band__media'))) {
  console.error('next-band-media-probe: no .np-band__media on this page');
  await browser.close();
  process.exit(1);
}

// In-page sampler: one record per animation frame until the band is gone.
await page.evaluate(() => {
  const box = document.querySelector('.np-band__window') || document.querySelector('.np-band__media');
  const el = box.querySelector('.np-band__media-el');
  const t0 = performance.now();
  const loop = () => {
    if (!box.isConnected) return;
    const b = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const m = /inset\(\s*([\d.]+)(%|px)\s+([\d.]+)(%|px)\s+([\d.]+)(%|px)\s+([\d.]+)(%|px)/.exec(cs.clipPath || '');
    const px = (v, u, full) => (u === '%' ? (parseFloat(v) / 100) * full : parseFloat(v));
    const ins = m
      ? {
          t: px(m[1], m[2], b.height),
          r: px(m[3], m[4], b.width),
          b: px(m[5], m[6], b.height),
          l: px(m[7], m[8], b.width),
        }
      : { t: 0, r: 0, b: 0, l: 0 };
    const c = { l: b.left + ins.l, r: b.right - ins.r, t: b.top + ins.t, b: b.bottom - ins.b };
    const r = el.getBoundingClientRect();
    const nw = el.videoWidth || el.naturalWidth || 0;
    const nh = el.videoHeight || el.naturalHeight || 0;
    // The object-fit box rides the element's untransformed content box; the zoom transform scales
    // it about the inner's centre, so read the scale off the rendered rect against its layout size.
    let fit = null;
    if (nw && nh) {
      const k = Math.max(el.offsetWidth / nw, el.offsetHeight / nh);
      const sx = el.offsetWidth ? r.width / el.offsetWidth : 1;
      fit = { w: nw * k * sx, h: nh * k * sx, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    window.__npSample({
      ms: Math.round(performance.now() - t0),
      phase: cs.position === 'fixed' ? 'commit' : 'pull',
      c: { l: c.l, r: c.r, t: c.t, b: c.b },
      m: { l: r.left, r: r.right, t: r.top, b: r.bottom },
      fit,
      vw: innerWidth,
      vh: innerHeight,
    });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
});

// Scroll to the document end, step by step so the entrance scrubs, then settle past the wheel's
// arming beat (?nparm 250 ms).
const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (let y = 0; y <= end; y += 120) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await sleep(16);
}
await page.evaluate((v) => window.scrollTo(0, v), end);
await sleep(1200);
const restSamples = samples.length;

if (phone) {
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y, id: 1 }],
    });
  let y = 700;
  await touch('touchStart', y);
  await sleep(40);
  y -= 24; // clear the CDP touch slop (>= 16 px) before the pull counts
  await touch('touchMove', y);
  await sleep(40);
  for (let i = 0; i < 90 && (await page.$('.np-band__media')); i += 1) {
    y -= 8;
    await touch('touchMove', y);
    await sleep(16);
  }
  await sleep(2500);
  await touch('touchEnd', y).catch(() => {});
} else {
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 40); // opens the arming window
  await sleep(320);
  for (let i = 0; i < 90 && (await page.$('.np-band__media')); i += 1) {
    await page.mouse.wheel(0, 14);
    await sleep(16);
  }
  await sleep(2500);
}
const finalUrl = page.url();
await browser.close();

// ── Analysis ──
const w = (r) => r.r - r.l;
const cx = (r) => (r.l + r.r) / 2;
const cy = (r) => (r.t + r.b) / 2;
const rows = samples.slice(restSamples).filter((s) => w(s.c) > 8);
const pull = rows.filter((s) => s.phase === 'pull');
const commit = rows.filter((s) => s.phase === 'commit');
const worst = (fn) => rows.reduce((a, s) => Math.max(a, fn(s)), 0);
const dx = worst((s) => Math.abs(cx(s.m) - cx(s.c)));
const dy = worst((s) => Math.abs(cy(s.m) - cy(s.c)));
let shrink = 0;
for (let i = 1; i < rows.length; i += 1) shrink = Math.max(shrink, w(rows[i - 1].m) - w(rows[i].m));
// Gap = how far the container pokes OUT of the media rect (negative = covered).
const uncovered = rows.reduce(
  (a, s) => Math.max(a, s.m.l - s.c.l, s.c.r - s.m.r, s.m.t - s.c.t, s.c.b - s.m.b),
  -Infinity
);
const fitRows = rows.filter((s) => s.fit);
const fitDx = fitRows.reduce((a, s) => Math.max(a, Math.abs(s.fit.cx - cx(s.c))), 0);
const fitDy = fitRows.reduce((a, s) => Math.max(a, Math.abs(s.fit.cy - cy(s.c))), 0);
let fitShrink = 0;
for (let i = 1; i < fitRows.length; i += 1) fitShrink = Math.max(fitShrink, fitRows[i - 1].fit.w - fitRows[i].fit.w);
const last = rows[rows.length - 1];
const f1 = (n) => Math.round(n * 100) / 100;
const report = {
  surface: phone ? 'phone 390x844 touch' : 'desktop 1440x900 wheel',
  path: route,
  frames: { pull: pull.length, commit: commit.length },
  centreMaxDx: f1(dx),
  centreMaxDy: f1(dy),
  fitCentreMaxDx: fitRows.length ? f1(fitDx) : null,
  fitCentreMaxDy: fitRows.length ? f1(fitDy) : null,
  uncoveredMaxPx: f1(uncovered),
  mediaWidthMaxShrinkPx: f1(shrink),
  fitWidthMaxShrinkPx: fitRows.length ? f1(fitShrink) : null,
  first: rows[0] && { container: f1(w(rows[0].c)), media: f1(w(rows[0].m)) },
  firstCommit: commit[0] && { container: f1(w(commit[0].c)), media: f1(w(commit[0].m)) },
  last: last && {
    container: f1(w(last.c)),
    containerH: f1(last.c.b - last.c.t),
    media: f1(w(last.m)),
    fit: last.fit ? f1(last.fit.w) : null,
    viewport: [last.vw, last.vh],
  },
  navigated: finalUrl,
};
const checks = {
  centre: dx <= 1 && dy <= 1,
  cover: uncovered <= 1,
  monotone: shrink <= 1,
  turn:
    !!last &&
    Math.abs(w(last.m) - w(last.c)) <= 1 &&
    Math.abs(w(last.c) - last.vw) <= 1 &&
    Math.abs(last.c.b - last.c.t - last.vh) <= 1,
};
report.checks = checks;
console.log(JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(checks)) console.error(`${v ? 'ok  ' : 'FAIL'} ${k}`);
if (out) fs.writeFileSync(out, JSON.stringify({ report, samples: rows }, null, 1));
