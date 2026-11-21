#!/usr/bin/env node
/**
 * footer-probe — does the links footer's nav row clear the lockup and ©line at every width
 * above 768px? (SQ-138)
 *
 * Usage:
 *   node scripts/footer-probe.mjs --base=http://127.0.0.1:4399 [--out=run.json] [--shots=dir]
 *     [--widths=769,800,...] [--page=/work/directory/?tag=all]
 * One browser probe at a time on this machine (~/swm-probe-lock.sh).
 *
 * Chromium, each width: load the directory, wheel-scroll to the footer's end (not a detail page,
 * where the end triggers the next-project turn), then read the row's links, the ©line, the lockup
 * and the band. The verdict is scripts/lib/footerRowGate.mjs. Exit 0 when every width passes, 1
 * otherwise. --shots writes a footer-end screenshot per width (clip: the bottom 170px).
 *
 * What it cannot show: WebKit's own text metrics (the row is wrap-driven, so a different font
 * rasterisation moves the wrap points by a few px).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { verdict } from './lib/footerRowGate.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);
const BASE = args.base;
if (!BASE) throw new Error('--base is required');
const WIDTHS = (args.widths ?? '769,800,850,900,950,1000,1024,1100,1280,1440').split(',').map(Number);
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
  };
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const runs = [];
try {
  for (const width of WIDTHS) {
    const p = await browser.newPage({ viewport: { width, height: 900 } });
    await p.goto(`${BASE}${PAGE}`, { waitUntil: 'load' });
    await p.waitForTimeout(4000);
    await p.mouse.move(width / 2, 450);
    for (let i = 0; i < 80; i++) {
      await p.mouse.wheel(0, 800);
      await p.waitForTimeout(50);
    }
    await p.mouse.move(width / 2, 450);
    for (let i = 0; i < 6; i++) {
      await p.mouse.wheel(0, 400);
      await p.waitForTimeout(80);
    }
    await p.waitForTimeout(3000);
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
} finally {
  await browser.close();
}
if (args.out) writeFileSync(args.out, JSON.stringify(runs, null, 2));
process.exit(runs.every((r) => r.verdict.pass) ? 0 : 1);
