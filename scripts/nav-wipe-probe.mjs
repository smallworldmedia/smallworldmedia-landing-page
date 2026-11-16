#!/usr/bin/env node
/**
 * nav-wipe-probe — does the mobile nav menu's wipe hold until the destination has drawn? (SQ-108)
 *
 * Usage:
 *   node scripts/nav-wipe-probe.mjs --base=http://127.0.0.1:4399 [--only=A,B,C,D,E] [--out=run.json]
 *        [--with-control | --control] [--engine=chromium|webkit] [--query=k=v] [--gpu=swiftshader|default]
 * One browser probe at a time on this machine (~/swm-probe-lock.sh). Serve a production build
 * (`astro build`, then `astro preview --port 4399`): a dev server hydrates far too slowly to mean
 * anything, and 4399 is on Sanity's CORS list.
 *
 * Phone viewport (390×844, touch, taps through Playwright's touchscreen). Scenarios:
 *   A  /work/directory → /work, by the nav menu
 *   B  /work → a project, by its card (the CONTROL: no menu is open, so no hold may arm)
 *   C  / (home) → /work, by the nav menu
 *   D  a project → /work/directory, by the nav menu
 *   E  /work/directory → home, by the menu’s start_project item (a route that is not /work)
 * (The menu has no project entry, so /work → a project is the card passage Nathan calls perfect;
 * the probe shows it never meets the hold.)
 *
 * An in-page recorder (0 = the tap) reads, every frame: the menu's coverage (clip-path inset ×
 * opacity, 1 = the takeover is up), astro:after-swap, the first swm:route-ready after it, and an
 * independent witness of the destination's first frame (its canvas mounted; the directory's
 * `data-pending` cleared). Gate: scripts/lib/navWipeGate.mjs. The wipe may begin no earlier than
 * the ready signal plus the beat, nor later than the cap past the swap (the dials the gate EXPECTS
 * are the proposed 600 ms / 100 ms, whatever the page was told).
 *
 * --with-control adds a second pass with every page loaded on ?navwipehold=0, the hold switched off
 * (the pre-SQ-108 wipe, which uncovers on astro:after-swap): the gate must FAIL it, so a probe that
 * cannot fail proves nothing. --control runs that pass alone.
 * Exit: 0 the shipped pass passes and the control pass fails as it must; 2 a failed gate (or a
 * control that passed); 1 bad usage.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { EXPECT, summary } from './lib/navWipeGate.mjs';
import { routeSignalsReady } from '../src/lib/overlayWipe.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pathOf = (u) => new URL(u).pathname.replace(/\/+$/, '') || '/';

// Runs in the page, so it must stay self-contained (page.addInitScript).
function installRecorder() {
  if (window.__navRec) return;
  const rec = (window.__navRec = { armed: false, samples: [], t0: 0, last: -1 });
  const insetTop = (clip) => {
    const m = /inset\(\s*(-?[\d.]+)(%|px)?/.exec(clip || '');
    if (!m) return 0;
    const n = parseFloat(m[1]);
    return m[2] === 'px' ? (n / innerHeight) * 100 : n;
  };
  const cover = () => {
    const menu = document.querySelector('.mobile-menu');
    if (!menu) return 0;
    const cs = getComputedStyle(menu);
    if (cs.visibility === 'hidden') return 0;
    const open = 1 - Math.min(100, Math.max(0, insetTop(cs.clipPath))) / 100;
    return Math.round(open * parseFloat(cs.opacity) * 100) / 100;
  };
  const painted = (witness) => {
    if (witness === 'canvas') {
      return [...document.querySelectorAll('canvas')].some((c) => !c.closest('.site-shell') && c.width > 0 && c.height > 0);
    }
    return !!document.querySelector(witness);
  };
  rec.arm = (witness) => {
    Object.assign(rec, {
      armed: true,
      witness,
      t0: performance.now(),
      samples: [],
      last: -1,
      swapAt: null,
      readyAt: null,
      paintedAt: null,
      uncoveredAt: null,
      endAt: 0,
      stallMs: 0,
      menuOpen: cover() >= 0.98,
    });
    delete window.__swmNavHold;
  };
  document.addEventListener('astro:after-swap', () => {
    if (rec.armed && rec.swapAt == null) rec.swapAt = performance.now() - rec.t0;
  });
  window.addEventListener('swm:route-ready', () => {
    if (rec.armed && rec.swapAt != null && rec.readyAt == null) rec.readyAt = performance.now() - rec.t0;
  });
  const frame = () => {
    if (rec.armed) {
      const t = performance.now() - rec.t0;
      const c = cover();
      if (c !== rec.last) {
        rec.samples.push([Math.round(t * 10) / 10, c]);
        rec.last = c;
      }
      if (rec.swapAt != null && rec.paintedAt == null && rec.witness && painted(rec.witness)) rec.paintedAt = t;
      if (rec.swapAt != null && rec.uncoveredAt == null && c < 0.98 && rec.samples.some(([, v]) => v >= 0.98)) {
        rec.uncoveredAt = t;
      }
      // The longest gap between frames after the swap: a timer cannot fire inside a long task.
      if (rec.swapAt != null && rec.endAt > rec.swapAt) rec.stallMs = Math.max(rec.stallMs, t - rec.endAt);
      rec.endAt = t;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=');
      return [k, v.length ? v.join('=') : true];
    })
  );
  const usage = (why) => {
    console.error(`nav-wipe-probe: ${why}\n  node scripts/nav-wipe-probe.mjs --base=URL [--only=A,B,C,D] [--out=FILE] [--control] [--engine=chromium|webkit]`);
    process.exit(1);
  };
  const BASE = args.base || process.env.GLOBE_PROBE_BASE;
  if (!BASE) usage('--base is required');
  const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
  const ENGINE = args.engine || 'chromium';
  const GPU = args.gpu || 'swiftshader';
  let extra = ''; // the query of the pass running: --control adds navwipehold=0
  const url = (p) => BASE.replace(/\/$/, '') + p + (extra ? (p.includes('?') ? '&' : '?') + extra : '');
  const require = createRequire(import.meta.url);
  const PW = process.env.PLAYWRIGHT_PATH ?? '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
  const pw = require(PW);
  if (!pw[ENGINE]) usage(`unknown --engine=${ENGINE}`);
  const browser = await pw[ENGINE].launch({
    headless: true,
    args: ENGINE === 'chromium' && GPU === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });

  const newPage = async () => {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.addInitScript(installRecorder);
    return { ctx, page };
  };
  const waitFor = async (page, fn, arg, ms) => {
    try {
      await page.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
      return true;
    } catch {
      return false;
    }
  };
  const ITEM = (href) => `.mobile-menu a[href="${href}"]`;
  const WITNESS = { canvas: 'canvas', directory: '.dir-page:not([data-pending])', project: 'h1' };
  // Wait until the page under test has drawn, so the tap meets a settled page.
  const settle = async (page, witness) => {
    const ok = await waitFor(
      page,
      (w) =>
        w === 'canvas'
          ? [...document.querySelectorAll('canvas')].some((c) => !c.closest('.site-shell') && c.width > 0)
          : !!document.querySelector(w),
      witness,
      30000
    );
    await sleep(2500);
    return ok;
  };
  const harvest = async (page, id, via, to) => {
    const r = await page.evaluate(() => {
      const { samples, swapAt, readyAt, paintedAt, endAt, stallMs, menuOpen } = window.__navRec;
      return { samples, swapAt, readyAt, paintedAt, endAt, stallMs, menuOpen, hold: window.__swmNavHold ?? null };
    });
    return { id, via, signals: routeSignalsReady(to), ...r };
  };
  // A nav-menu navigation: open the menu, wait until it is fully up, arm, tap the item.
  const viaMenu = async (id, from, fromWitness, itemSel, to, toWitness) => {
    const { ctx, page } = await newPage();
    const rec = { id, via: 'menu', notes: [] };
    try {
      await page.goto(url(from), { waitUntil: 'load' });
      if (from === '/') await waitFor(page, () => document.querySelector('.hero')?.dataset.chromed === '1', null, 30000);
      if (!(await settle(page, fromWitness))) rec.notes.push('start page never drew');
      await page.tap('.site-nav__menu-pill');
      if (!(await waitFor(page, () => document.querySelector('.mobile-menu')?.dataset.open === 'true', null, 5000))) {
        rec.notes.push('menu never opened');
      }
      await sleep(1400); // the wipe-in and the item stagger land
      await page.evaluate((w) => window.__navRec.arm(w), toWitness);
      await page.tap(itemSel);
      const landed = await waitFor(page, () => window.__navRec.uncoveredAt != null, null, 12000);
      if (!landed) rec.notes.push('the menu never uncovered within 12 s');
      await sleep(700); // the wipe runs out
      Object.assign(rec, await harvest(page, id, 'menu', to), { id, via: 'menu', notes: rec.notes });
      rec.landed = pathOf(page.url());
      if (rec.landed !== to) rec.notes.push(`landed on ${rec.landed}, expected ${to}`);
    } catch (e) {
      rec.notes.push('ERR ' + e.message.split('\n')[0]);
    }
    await ctx.close();
    return rec;
  };
  // /work → a project by its card: the menu is closed, so the hold must never arm.
  const viaCard = async (id) => {
    const { ctx, page } = await newPage();
    const rec = { id, via: 'card', notes: [] };
    try {
      await page.goto(url('/work'), { waitUntil: 'load' });
      if (!(await settle(page, WITNESS.canvas))) rec.notes.push('start page never drew');
      await page.evaluate(() => window.__navRec.arm(null));
      await page.tap('.fp-card__cta');
      const landed = await waitFor(page, () => /^\/work\/.+/.test(location.pathname), null, 15000);
      if (!landed) rec.notes.push('the card tap never reached a project');
      await sleep(3000);
      Object.assign(rec, await harvest(page, id, 'card', '/work/x'), { id, via: 'card', notes: rec.notes });
      rec.landed = pathOf(page.url());
    } catch (e) {
      rec.notes.push('ERR ' + e.message.split('\n')[0]);
    }
    await ctx.close();
    return rec;
  };
  const want = (id) => !ONLY || ONLY.has(id);
  const runPass = async (control) => {
    extra = [control ? 'navwipehold=0' : null, args.query || null].filter(Boolean).join('&');
    const records = [];
    if (want('A')) records.push(await viaMenu('A directory>work', '/work/directory/', WITNESS.directory, ITEM('/work'), '/work', WITNESS.canvas));
    if (want('B')) records.push(await viaCard('B work>project (card)'));
    if (want('C')) records.push(await viaMenu('C home>work', '/', WITNESS.canvas, ITEM('/work'), '/work', WITNESS.canvas));
    if (want('D')) records.push(await viaMenu('D project>directory', '/work/bedouin/', WITNESS.project, ITEM('/work/directory'), '/work/directory', WITNESS.directory));
    if (want('E')) records.push(await viaMenu('E directory>home (start_project)', '/work/directory/', WITNESS.directory, ITEM('/') + '.mobile-menu__item', '/', WITNESS.canvas));
    const out = summary(records, EXPECT);
    console.log(control ? '── control: ?navwipehold=0, the hold off ──' : '── the hold, as shipped ──');
    out.results.forEach((r, i) => {
      const rec = records[i];
      const t = (n) => (n == null ? '-' : Math.round(n));
      console.log(
        `${r.pass ? 'PASS' : 'FAIL'} ${r.id}: swap ${t(rec.swapAt)} ready ${t(rec.readyAt)} painted ${t(rec.paintedAt)} ` +
          `uncover ${t(r.uncoverAt)} (earliest ${t(r.earliest)}) hold ${rec.hold ? rec.hold.why : 'none'}` +
          (rec.notes?.length ? ` [${rec.notes.join('; ')}]` : '')
      );
    });
    for (const f of out.fails) console.log('  - ' + f);
    return { control, records, results: out.results, pass: out.pass };
  };
  const passes = [];
  if (!args.control) passes.push(await runPass(false));
  if (args.control || args['with-control']) passes.push(await runPass(true));
  await browser.close();
  if (args.out) fs.writeFileSync(args.out, JSON.stringify({ expect: EXPECT, passes }, null, 2));
  // The shipped hold must pass; the control (the hold off, a forced early uncover) must FAIL the gate.
  const bad = passes.filter((p) => (p.control ? p.pass : !p.pass));
  for (const p of passes.filter((p) => p.control)) {
    console.log(p.pass ? 'control: the gate PASSED a forced early uncover, so the probe proves nothing' : 'control: the gate FAILED the forced early uncover, as it must');
  }
  process.exit(bad.length ? 2 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
