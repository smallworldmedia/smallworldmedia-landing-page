#!/usr/bin/env node
/**
 * scroll-kick-probe — does a scroll-coupled wall race when the page moves without the user? (SQ-77)
 * A measurement, not a gate: it exits 0 whatever it finds. Run it on a base and a build.
 *
 * Usage:
 *   node scripts/scroll-kick-probe.mjs --base=http://localhost:4321 --path=/work/coco-branding-2026/
 *        [--from=/work/] [--out=run.json] [--width=1440] [--frames]  (--frames keeps e-wheel's per-frame rows)
 *
 * Every animation frame, in the page, each DeckScroller strip (.deck-scroller__strip) is read and
 * its step since the last frame taken (wrap-aware). `excess` is the step beyond idle drift
 * (DRIFT_PX_S = 8 px/s · dt): what a viewer sees as the wall racing. Scenarios, each its own window:
 *   a-load       hard load at the top, through media load (5 s)
 *   b-reload     scrolled to the wall, then reload (browser scroll restoration) (5 s)
 *   c-softnav    --from → the detail page by a link click (ClientRouter), then scroll to the wall,
 *                then back to --from and forward again (restored position) (each 4 s)
 *   d-scrollto   at the top, window.scrollTo(the wall, instant) (3 s)
 *   e-wheel      at the top, 40 wheel notches of 100 px, 50 ms apart, then 2 s (user scroll:
 *                its summed excess is the coupling a build must keep)
 * Also counts the Project Directory's and /work's walls: any .deck-scroller__strip or element
 * whose transform moves while the page jumps (--path=/work/directory/ runs the same scenarios).
 * One browser probe at a time on this machine (~/swm-probe-lock.sh).
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);
const BASE = args.base ?? process.env.GLOBE_PROBE_BASE;
if (!BASE) throw new Error('--base is required');
const PATH = args.path ?? '/work/coco-branding-2026/';
const FROM = args.from ?? '/work/';
const WIDTH = Number(args.width ?? 1440);
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH ?? '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);

const DRIFT_PX_S = 8;

// Installed before every document: a per-frame recorder of every wall strip.
const recorder = (drift) => {
  const rec = { frames: [], mark: 'init' };
  window.__kick = rec;
  const last = new WeakMap();
  let lastT = performance.now();
  const off = (el) => {
    const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el.style.transform || '');
    if (!m) return null;
    const x = el.closest('.deck-scroller--x');
    return x ? parseFloat(m[1]) : parseFloat(m[2]);
  };
  const loop = (t) => {
    const dt = Math.min(t - lastT, 100) / 1000;
    lastT = t;
    let max = 0;
    let n = 0;
    for (const el of document.querySelectorAll('.deck-scroller__strip')) {
      const o = off(el);
      if (o == null) continue;
      const x = !!el.closest('.deck-scroller--x');
      const L = (x ? el.scrollWidth : el.scrollHeight) / 2 || 1; // one cycle ≈ half the strip
      const prev = last.get(el);
      last.set(el, o);
      if (prev == null) continue;
      let d = o - prev;
      d = ((((d + L / 2) % L) + L) % L) - L / 2; // a wrap is not a step
      n++;
      max = Math.max(max, Math.abs(d));
    }
    const excess = Math.max(0, max - drift * dt);
    rec.frames.push({ t: Math.round(t), mark: rec.mark, y: Math.round(window.scrollY), n, step: +max.toFixed(2), excess: +excess.toFixed(2) });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function frames(page) {
  return page.evaluate(() => window.__kick?.frames ?? []);
}
const summarize = (fs) => {
  const live = fs.filter((f) => f.n > 0);
  const top = [...live].sort((a, b) => b.excess - a.excess)[0];
  return {
    frames: fs.length,
    wallFrames: live.length,
    maxExcess: top ? top.excess : 0,
    sumExcess: +live.reduce((s, f) => s + f.excess, 0).toFixed(1),
    worst: top ?? null,
  };
};

async function wallY(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.deck-scroller');
    if (!el) return null;
    return Math.max(0, el.getBoundingClientRect().top + window.scrollY - innerHeight * 0.2);
  });
}

async function main() {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
  await ctx.addInitScript(recorder, DRIFT_PX_S);
  const page = await ctx.newPage();
  const out = {};
  const url = (p) => new URL(p, BASE).href;

  // a — hard load at the top
  await page.goto(url(PATH), { waitUntil: 'load' });
  await sleep(5000);
  out['a-load'] = summarize(await frames(page));

  // b — reload scrolled to the wall
  const y = await wallY(page);
  out.wallY = y;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await sleep(2500); // let any kick from getting there die down; the reload is the measure
  await page.reload({ waitUntil: 'load' });
  await sleep(5000);
  const fb = await frames(page);
  out['b-reload'] = { ...summarize(fb), restoredY: fb.at(-1)?.y };

  // d — programmatic scrollTo from the top
  await page.goto("about:blank"); // a fresh navigation: no scroll restoration
  await page.goto(url(PATH), { waitUntil: 'load' });
  await sleep(3000);
  await page.evaluate(() => { window.__kick.frames.length = 0; window.__kick.mark = 'd'; });
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y);
  await sleep(3000);
  out['d-scrollto'] = { ...summarize(await frames(page)), startY: 0 };

  // e — user wheel scroll from the top
  await page.goto("about:blank"); // a fresh navigation: no scroll restoration
  await page.goto(url(PATH), { waitUntil: 'load' });
  await sleep(3000);
  await page.mouse.move(WIDTH / 2, 450);
  await page.evaluate(() => { window.__kick.frames.length = 0; window.__kick.mark = 'e'; });
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 100);
    await sleep(50);
  }
  await sleep(2000);
  const fe = await frames(page);
  out['e-wheel'] = { ...summarize(fe), endY: fe.at(-1)?.y, ...(args.frames ? { frames: fe } : {}) };

  // c — soft nav: FROM → detail by a link, to the wall, back, forward
  await page.goto("about:blank"); // a fresh navigation: no scroll restoration
  await page.goto(url(FROM), { waitUntil: 'load' });
  await sleep(3000);
  const slug = PATH.replace(/\/+$/, '');
  const clicked = await page.evaluate((slug) => {
    const a = [...document.querySelectorAll('a[href]')].find((x) => x.getAttribute('href').replace(/\/+$/, '') === slug);
    if (!a) return false;
    a.click();
    return true;
  }, slug);
  if (!clicked) {
    out['c-softnav'] = { skipped: `no link to ${slug} on ${FROM}` };
  } else {
    await page.evaluate(() => { window.__kick.frames.length = 0; window.__kick.mark = 'c-in'; });
    await sleep(4000);
    const fin = await frames(page);
    const yc = await wallY(page);
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), yc);
    await sleep(2500);
    await page.goBack();
    await sleep(2500);
    await page.evaluate(() => { window.__kick.frames.length = 0; window.__kick.mark = 'c-fwd'; });
    await page.goForward();
    await sleep(4000);
    const ffw = await frames(page);
    out['c-softnav'] = { in: summarize(fin), forward: { ...summarize(ffw), restoredY: ffw.at(-1)?.y, path: new URL(page.url()).pathname } };
  }

  await browser.close();
  if (args.out) writeFileSync(args.out, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
