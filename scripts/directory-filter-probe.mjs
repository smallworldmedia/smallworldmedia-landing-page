#!/usr/bin/env node
/**
 * directory-filter-probe — does the Project Directory's filter stay put when the selection resets,
 * and is its scroll thumb white under every scheme? (SQ-146)
 *
 * Usage (one browser probe at a time on this machine, ~/swm-probe-lock.sh):
 *   node scripts/directory-filter-probe.mjs --base=http://127.0.0.1:3333 [--out=run.json] [--shots=dir]
 *     [--only=resets|thumbs] [--width=1440]
 *
 * Resets: for each path ("× clear all", the client chip, the last ticked tag clicked off, the drawer's
 * `swm:directory-client` clear, "clear all" with the page scrolled so the filter is stuck, and "clear all"
 * with the services list scrolled inside a short window) it loads the page on a filter, stamps the filter's
 * nodes with data-probe, samples every animation frame for 1.8 s after the click, and hands the record to
 * scripts/lib/dirFilterResetGate.mjs. A frame counts a tag as entering when it carries an inline opacity or
 * transform, or a computed transform: the tags' x -16 / opacity 0 stagger and its clearProps are inline.
 * It also logs every main-frame navigation (a reset must not navigate).
 *
 * Thumbs: the thumb's and the track's computed colours under ?scheme= project, black, blue and spectrum,
 * judged by the same gate's thumbVerdict, plus a screenshot of the services list at rest per scheme.
 * The thumb sits at scaleY 1 once the open entrance has run (0.6 s in), so each load waits it out; a
 * short window (the list overflows) is used so the thumb is drawn at all.
 *
 * Exit 0 when every record passes, 1 otherwise. What it cannot show: iOS WebKit's compositing (this is
 * Chromium); a reset that only replays a CSS transition on a phone.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { firstLoadVerdict, thumbVerdict, verdict } from './lib/dirFilterResetGate.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.length ? v.join('=') : true];
  })
);
const BASE = args.base;
if (!BASE) throw new Error('--base is required');
const WIDTH = Number(args.width ?? 1440);
const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH ?? '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);

const DIR = '/work/directory/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// In-page: stamp the filter's nodes, then sample every frame until window.__run is false.
const install = () => {
  const stamp = (sel, v) => document.querySelectorAll(sel).forEach((e, i) => (e.dataset.probe = `${v}${i}`));
  stamp('.dir-filter', 'root');
  stamp('.dir-filter__region', 'region');
  stamp('.dir-filter__tags', 'tags');
  stamp('.filter-tag', 'tag');
  window.__log = [];
  const t0 = performance.now();
  const scaleY = (el) => {
    const m = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform);
    return m ? Number(m[1].split(',')[3]) : 1;
  };
  const tick = () => {
    const tags = [...document.querySelectorAll('.filter-tag')];
    const entering = tags.filter(
      (e) => e.style.opacity !== '' || e.style.transform !== '' || getComputedStyle(e).transform !== 'none'
    );
    const first = entering[0];
    const thumbs = [...document.querySelectorAll('.dir-filter__scrollbar-thumb')]
      .filter((e) => e.offsetHeight > 0)
      .map(scaleY);
    window.__log.push({
      t: Math.round(performance.now() - t0),
      root: document.querySelector('.dir-filter')?.dataset.probe ?? null,
      region: document.querySelector('.dir-filter__region')?.dataset.probe ?? null,
      tags: document.querySelector('.dir-filter__tags')?.dataset.probe ?? null,
      entering: entering.length,
      enteringSample: first ? `${first.dataset.slug} opacity=${first.style.opacity || 'css'} transform=${first.style.transform || 'css'}` : '',
      thumbMin: thumbs.length ? Math.min(...thumbs) : null,
      open: (document.querySelector('.dir-filter__region')?.offsetHeight ?? 0) > 0,
    });
    if (window.__run) requestAnimationFrame(tick);
  };
  window.__run = true;
  requestAnimationFrame(tick);
};

// What a link to the page leaves ticked: the bare URL's default filter (album-art), no client.
const DEFAULT = { ticked: ['album-art'], chip: false };
const RESETS = [
  { id: 'clear-all', path: '"× clear all" (two tags ticked)', url: `${DIR}?tag=branding,illustration`, act: (p) => p.click('.dir-filter__clear') },
  { id: 'clear-all-parent', path: '"× clear all" (motion/video, its children shown)', url: `${DIR}?tag=motion-video`, act: (p) => p.click('.dir-filter__clear') },
  { id: 'clear-all-default', path: '"× clear all" (the bare URL: album-art ticked)', url: DIR, act: (p) => p.click('.dir-filter__clear') },
  { id: 'client-chip', path: "the client chip's ×", url: `${DIR}?client=coco`, act: (p) => p.click('.dir-filter__chip') },
  { id: 'client-chip-tags', path: "the client chip's × with a tag ticked", url: `${DIR}?client=coco&tag=branding`, expect: { ticked: ['branding'], chip: false }, act: (p) => p.click('.dir-filter__chip') },
  { id: 'untick-last', path: 'the last ticked tag clicked off', url: `${DIR}?tag=branding`, act: (p) => p.click('.filter-tag[data-slug="branding"]') },
  {
    id: 'client-pick-off',
    path: 'the picked client clicked off in the clients tab',
    url: `${DIR}?client=coco`,
    act: async (p) => {
      await p.click('#dir-filter-tab-clients');
      await sleep(300);
      await p.click('#dir-filter-panel-clients .filter-tag[data-slug="coco"]');
    },
  },
  {
    id: 'drawer-clear',
    path: "the drawer's names clearing the client",
    url: `${DIR}?client=coco`,
    act: (p) => p.evaluate(() => window.dispatchEvent(new CustomEvent('swm:directory-client', { detail: { slug: null } }))),
  },
  // The "services" links (SQ-146): to the directory from the directory, each a route swap before the fix.
  { id: 'nav-services', path: 'the nav bar\'s "services" link (a filter ticked)', url: `${DIR}?tag=branding,illustration`, expect: DEFAULT, act: (p) => p.click('.site-nav__link--directory') },
  { id: 'nav-services-bare', path: 'the nav bar\'s "services" link (the bare URL)', url: DIR, expect: DEFAULT, act: (p) => p.click('.site-nav__link--directory') },
  {
    id: 'footer-services',
    path: 'the footer\'s "services" link (a client picked)',
    url: `${DIR}?client=coco`,
    expect: DEFAULT,
    act: (p) => p.evaluate(() => document.querySelector('.site-footer__link[href="/work/directory"]').click()),
  },
  {
    id: 'menu-services',
    path: 'the phone menu\'s "services" item (a filter ticked)',
    url: `${DIR}?tag=branding,illustration`,
    phone: true,
    menu: true,
    expect: DEFAULT,
    act: (p) => p.click('.mobile-menu__item[href="/work/directory"]'),
  },
  { id: 'clear-all-stuck', path: '"× clear all" with the page scrolled (the filter stuck)', url: `${DIR}?tag=branding,illustration`, scroll: 6, act: (p) => p.click('.dir-filter__clear') },
  // The clients list is the one tall enough to scroll in a short window: its place must survive a reset.
  {
    id: 'clear-all-list-scrolled',
    path: '"× clear all" with the clients list scrolled inside a short window',
    url: `${DIR}?client=coco&tag=branding`,
    height: 520,
    tab: 'clients',
    list: '#dir-filter-panel-clients',
    listScroll: 120,
    act: (p) => p.click('.dir-filter__clear'),
  },
  {
    id: 'nav-services-list-scrolled',
    path: 'the nav bar\'s "services" link with the clients list scrolled',
    expect: DEFAULT,
    url: `${DIR}?client=coco&tag=branding`,
    height: 520,
    tab: 'clients',
    list: '#dir-filter-panel-clients',
    listScroll: 120,
    act: (p) => p.click('.site-nav__link--directory'),
  },
];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const records = [];

async function runReset(r) {
  const page = await browser.newPage({
    viewport: r.phone ? { width: 402, height: 874 } : { width: WIDTH, height: r.height ?? 900 },
    ...(r.phone ? { hasTouch: true, isMobile: true } : {}),
  });
  try {
    await page.goto(`${BASE}${r.url}`, { waitUntil: 'load' });
    await sleep(4200); // hydration, the grid shown, the open entrance and the thumb's scale-in done
    if (r.menu) {
      await page.click('.site-nav__menu-pill');
      await sleep(1500); // the takeover's wipe and item stagger
    }
    if (r.scroll) {
      await page.mouse.move(WIDTH / 2, 450);
      for (let i = 0; i < r.scroll; i++) {
        await page.mouse.wheel(0, 400);
        await sleep(50);
      }
      await sleep(800);
    }
    const LIST = r.list ?? '#dir-filter-panel-services';
    if (r.tab) {
      await page.click(`#dir-filter-tab-${r.tab}`);
      await sleep(500);
    }
    if (r.listScroll) {
      await page.evaluate(([sel, y]) => {
        document.querySelector(sel).scrollTop = y;
      }, [LIST, r.listScroll]);
      await sleep(300);
    }
    await page.evaluate(install);
    await sleep(120);
    const before = await page.evaluate((sel) => {
      const l = document.querySelector(sel);
      return { st: l.scrollTop, max: l.scrollHeight - l.clientHeight };
    }, LIST);
    await r.act(page);
    await sleep(1800);
    const { frames, stamps, list, state } = await page.evaluate((sel) => {
      window.__run = false;
      const l = document.querySelector(sel);
      return {
        frames: window.__log,
        stamps: { root: 'root0', region: 'region0', tags: 'tags0' },
        list: { after: l.scrollTop, max: l.scrollHeight - l.clientHeight },
        state: {
          ticked: [...document.querySelectorAll('#dir-filter-panel-services .filter-tag[aria-checked="true"]')].map((e) => e.dataset.slug),
          chip: !!document.querySelector('.dir-filter__chip'),
          count: document.querySelector('.dir-filter__count')?.textContent.trim() ?? null,
        },
      };
    }, LIST);
    const rec = {
      id: r.id,
      path: r.path,
      stamps: {
        root: frames[0]?.root ? stamps.root : null,
        region: frames[0]?.region ? stamps.region : null,
        tags: frames[0]?.tags ? stamps.tags : null,
      },
      frames,
      state,
      expect: r.expect ?? { ticked: [], chip: false },
      list: before.max > 0 ? { before: before.st, after: list.after, max: list.max } : null,
      url: await page.evaluate(() => location.pathname + location.search),
    };
    if (r.menu) {
      await sleep(600);
      rec.menu = { closedAfter: await page.evaluate(() => document.querySelector('.mobile-menu')?.dataset.open === 'false') };
    }
    rec.verdict = verdict(rec);
    records.push(rec);
    const bad = frames.filter((f) => f.entering || f.root !== 'root0' || f.region !== 'region0' || f.tags !== 'tags0').length;
    console.log(
      `${rec.verdict.pass ? 'PASS' : 'FAIL'} reset ${r.id}  ${frames.length} frames, ${bad} off  ${r.path}  -> ${rec.url}` +
        (rec.verdict.fails.length ? '\n    ' + rec.verdict.fails.join('\n    ') : '')
    );
  } finally {
    await page.close();
  }
}

async function runFirstLoad() {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 520 } });
  try {
    await page.goto(`${BASE}${DIR}?tag=branding`, { waitUntil: 'commit' });
    await page.waitForSelector('.dir-filter__scrollbar-thumb', { state: 'attached' });
    await page.evaluate(install);
    await sleep(4000);
    const frames = await page.evaluate(() => {
      window.__run = false;
      return window.__log;
    });
    const rec = { id: 'first-load', frames, verdict: firstLoadVerdict(frames) };
    records.push(rec);
    const min = Math.min(...frames.map((f) => f.thumbMin ?? 1));
    console.log(
      `${rec.verdict.pass ? 'PASS' : 'FAIL'} first-load  ${frames.length} frames, thumb scaleY min ${min}, end ${frames.at(-1)?.thumbMin}` +
        (rec.verdict.fails.length ? '\n    ' + rec.verdict.fails.join('\n    ') : '')
    );
  } finally {
    await page.close();
  }
}

async function runThumb(scheme) {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: 520 } });
  try {
    await page.goto(`${BASE}${DIR}?tag=branding&scheme=${scheme}`, { waitUntil: 'load' });
    await sleep(4500);
    // The clients list is the one tall enough to overflow a short window: its thumb is the one drawn.
    await page.click('#dir-filter-tab-clients');
    await sleep(1200);
    const m = await page.evaluate(() => {
      const css = (sel, prop) => {
        const e = document.querySelector(sel);
        return e ? getComputedStyle(e)[prop] : null;
      };
      const thumb = document.querySelector('#dir-filter-panel-clients + .dir-filter__scrollbar-track .dir-filter__scrollbar-thumb');
      return {
        applied: document.documentElement.dataset.scheme ?? 'project',
        thumbServices: css('#dir-filter-panel-services + .dir-filter__scrollbar-track .dir-filter__scrollbar-thumb', 'backgroundColor'),
        thumb: thumb ? getComputedStyle(thumb).backgroundColor : null,
        thumbImage: thumb ? getComputedStyle(thumb).backgroundImage : null,
        thumbH: thumb ? thumb.offsetHeight : 0,
        track: css('.dir-filter__scrollbar-track', 'backgroundColor'),
      };
    });
    const rec = { scheme, ...m };
    rec.verdict = thumbVerdict(rec);
    if (m.thumbImage && m.thumbImage !== 'none') {
      rec.verdict = { ...rec.verdict, pass: false, fails: [...rec.verdict.fails, `the thumb paints an image: ${m.thumbImage}`] };
    }
    if (m.thumbServices !== m.thumb) {
      rec.verdict = { ...rec.verdict, pass: false, fails: [...rec.verdict.fails, `the services list's thumb is ${m.thumbServices}, the clients list's ${m.thumb}`] };
    }
    if (!(m.thumbH > 0)) {
      rec.verdict = { ...rec.verdict, pass: false, fails: [...rec.verdict.fails, 'the thumb has no height: the list did not overflow, the run proves nothing'] };
    }
    records.push(rec);
    if (args.shots) {
      mkdirSync(args.shots, { recursive: true });
      const box = await page.evaluate(() => {
        const r = document.querySelector('.dir-filter').getBoundingClientRect();
        return { x: 0, y: Math.max(0, Math.round(r.top) - 4), width: innerWidth, height: Math.round(r.height) + 8 };
      });
      await page.screenshot({ path: `${args.shots}/filter-${scheme}.png`, clip: box });
    }
    console.log(
      `${rec.verdict.pass ? 'PASS' : 'FAIL'} thumb ${scheme} (applied ${m.applied})  thumb=${m.thumb} h=${m.thumbH} track=${m.track}` +
        (rec.verdict.fails.length ? '\n    ' + rec.verdict.fails.join('\n    ') : '')
    );
  } finally {
    await page.close();
  }
}

try {
  if (args.only !== 'thumbs') for (const r of RESETS) await runReset(r);
  if (args.only !== 'thumbs') await runFirstLoad();
  if (args.only !== 'resets') for (const s of ['project', 'black', 'blue', 'spectrum']) await runThumb(s);
} finally {
  await browser.close();
}
if (args.out) writeFileSync(args.out, JSON.stringify(records, null, 2));
process.exit(records.every((r) => r.verdict.pass) ? 0 : 1);
