#!/usr/bin/env node
/**
 * footer-probe — does the links footer's nav row clear the lockup and ©line at every width
 * above 768px? (SQ-138)
 *
 * Usage:
 *   node scripts/footer-probe.mjs --base=http://127.0.0.1:4399 [--out=run.json] [--shots=dir]
 *     [--widths=769,800,...] [--page=/work/directory/?tag=all] [--sweep=760-1100:20]
 * One browser probe at a time on this machine (~/swm-probe-lock.sh).
 *
 * Chromium, each width: load the directory, wheel-scroll to the footer's end (not a detail page,
 * where the end triggers the next-project turn), then read the row's links, the ©line, the lockup
 * and the band. The verdict is scripts/lib/footerRowGate.mjs (SQ-140: the left stack mirrors the row's
 * lines, and --sweep steps one page down then up a width range and fails on any width whose state
 * depends on the direction; --widths= skips the per-width pass). Exit 0 when every width passes, 1
 * otherwise. --shots writes a footer-end screenshot per width (clip: the bottom 170px).
 *
 * What it cannot show: WebKit's own text metrics (the row is wrap-driven, so a different font
 * rasterisation moves the wrap points by a few px).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { verdict, hysteresis } from './lib/footerRowGate.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);
const BASE = args.base;
if (!BASE) throw new Error('--base is required');
const WIDTHS = (args.widths ?? '769,800,850,900,950,1000,1024,1100,1280,1440').split(',').map(Number).filter((w) => w > 0);
const PAGE = args.page ?? '/work/directory/?tag=all';
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH ?? '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);

// In-page: every box the gate reads.
const measure = () => {
  const box = (e) => {
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), right: Math.round(r.right), bottom: Math.round(r.bottom) };
  };
  const one = (s) => {
    const e = document.querySelector(s);
    return e ? box(e) : null;
  };
  return {
    links: [...document.querySelectorAll('.site-footer__nav .site-footer__link')].map((e) => ({
      label: e.textContent.trim(),
      ...box(e),
    })),
    nav: one('.site-footer__nav'),
    copy: one('.site-tagline__copy'),
    lockup: one('.site-tagline__lockup'),
    band: one('.site-footer--links'),
    wrapAttr: document.documentElement.hasAttribute('data-footer-wrap'),
  };
};

// Footer end: load, wheel to the bottom, settle. Returns the page.
async function scrollToEnd(p, width, wheels = 80, settleMs = 3000) {
  await p.mouse.move(width / 2, 450);
  for (let i = 0; i < wheels; i++) {
    await p.mouse.wheel(0, 800);
    await p.waitForTimeout(50);
  }
  await p.mouse.move(width / 2, 450);
  for (let i = 0; i < 6; i++) {
    await p.mouse.wheel(0, 400);
    await p.waitForTimeout(80);
  }
  await p.waitForTimeout(settleMs);
}

async function atFooterEnd(browser, width) {
  const p = await browser.newPage({ viewport: { width, height: 900 } });
  await p.goto(`${BASE}${PAGE}`, { waitUntil: 'load' });
  await p.waitForTimeout(4000);
  await scrollToEnd(p, width);
  return p;
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const runs = [];
let sweep = null;
try {
  for (const width of WIDTHS) {
    const p = await atFooterEnd(browser, width);
    const m = await p.evaluate(measure);
    const v = verdict({ width, ...m });
    runs.push({ width, ...m, verdict: v });
    if (args.shots) {
      mkdirSync(args.shots, { recursive: true });
      await p.screenshot({ path: `${args.shots}/footer-${width}.png`, clip: { x: 0, y: 900 - 170, width, height: 170 } });
    }
    console.log(
      `${v.pass ? 'PASS' : 'FAIL'} ${width}px  nav=${JSON.stringify(m.nav)} copy=${JSON.stringify(m.copy)} band=${JSON.stringify(m.band)}` +
        (v.fails.length ? '\n    ' + v.fails.join('\n    ') : '')
    );
    await p.close();
  }
  // --sweep=760-1100:20 — one page at the footer's end, the viewport stepped down then back up.
  // Each step is judged by the same gate, and the two passes must agree (hysteresis).
  if (args.sweep) {
    // A range (lo-hi:step) or an explicit list (--sweep=1100,1024,1000,900,769,390).
    let widths = [];
    if (String(args.sweep).includes(',')) {
      widths = String(args.sweep).split(',').map(Number).filter((w) => w > 0).sort((a, b) => b - a);
    } else {
      const [range, stepArg] = String(args.sweep).split(':');
      const [lo, hi] = range.split('-').map(Number);
      const step = Number(stepArg ?? 20);
      for (let w = hi; w >= lo; w -= step) widths.push(w);
    }
    const p = await atFooterEnd(browser, widths[0]);
    const pass = async (list, dir) => {
      const out = [];
      for (const width of list) {
        await p.setViewportSize({ width, height: 900 });
        await p.waitForTimeout(500);
        // A resize leaves the page short of the footer's end (the document's height changed and the
        // reveal re-arms): scroll back to it, as a person would, before measuring.
        await scrollToEnd(p, width, 30, 1500);
        const m = await p.evaluate(measure);
        // ≤768px the row and the ©line are not there: the rule is that the stacked state is off.
        const v = width <= 768 ? { id: `w${width}`, pass: !m.wrapAttr, fails: m.wrapAttr ? ['data-footer-wrap is set on a phone'] : [] } : verdict({ width, ...m });
        out.push({ width, dir, ...m, verdict: v });
        console.log(`${v.pass ? 'PASS' : 'FAIL'} sweep ${dir} ${width}px wrapAttr=${m.wrapAttr}` + (v.fails.length ? '\n    ' + v.fails.join('\n    ') : ''));
      }
      return out;
    };
    const down = await pass(widths, 'down');
    const up = await pass([...widths].reverse(), 'up');
    const bad = hysteresis(down, up);
    console.log(bad.length ? `FAIL sweep hysteresis: ${JSON.stringify(bad)}` : `PASS sweep hysteresis: ${widths.length} widths agree down and up`);
    sweep = { down, up, hysteresis: bad };
    await p.close();
  }
} finally {
  await browser.close();
}
if (args.out) writeFileSync(args.out, JSON.stringify(sweep ? { runs, sweep } : runs, null, 2));
const allPass = runs.every((r) => r.verdict.pass) && (!sweep || (sweep.down.concat(sweep.up).every((r) => r.verdict.pass) && !sweep.hysteresis.length));
process.exit(allPass ? 0 : 1);
