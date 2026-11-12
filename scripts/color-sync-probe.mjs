#!/usr/bin/env node
/**
 * color-sync-probe — is the colour-change choreography across page transitions in sync?
 * A frame sampler. Every animation frame it reads (rAF timestamp, getComputedStyle):
 *   page  the page background: the route fill's opacity + colour, the home hero's gradient
 *         horizon (its --project-color stop), the body colour
 *   nav   the nav bar's background
 *   tag   colour-tagged elements: the info pill, the first card chip / CTA, the nav link ink
 * and logs the route's events (click, swm:envelop, astro:before-swap, astro:after-swap,
 * swm:fill-release) on the same clock, so "same frame" is a number, not a feeling.
 *
 * Usage:
 *   node scripts/color-sync-probe.mjs --base=http://localhost:4330 --case=globe-work|detail-next|detail-chip|lockup-detail|lockup-work|lockup-directory|rest|history
 *        [--width=1440] [--out=FILE.json] [--slug=a-project] [--rm]
 *   --case=all runs every case once (one browser, a fresh page each).
 *
 * Reading it: each series is turned into a 0..1 progress along its own change (first colour to
 * last colour). `start` is the first frame it moved, `end` the first frame it is within 3% of
 * done. The "offset" lines compare the nav and the tagged elements against the page background,
 * in frames (frame = the median rAF gap) and ms. ≤ 1 frame = in sync.
 *
 * WebGL surfaces (the home globe, /work) need a Sanity CORS origin: serve on localhost:4330 (or
 * 127.0.0.1:4399). The browser launches with swiftshader so headless WebGL works. One browser
 * probe at a time on this machine: wrap it as `~/swm-probe-lock.sh node scripts/color-sync-probe.mjs …`.
 * A measurement, not a gate: it exits 0 whatever it finds.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const BASE = arg('base', process.env.GLOBE_PROBE_BASE);
const CASE = arg('case', 'globe-work');
const WIDTH = parseInt(arg('width', '1440'), 10);
const RM = !!arg('rm', false);
const OUT = arg('out', null);
const SLUG = arg('slug', null);
if (!BASE) {
  console.error('color-sync-probe: --base=http://localhost:4330 is required');
  process.exit(1);
}
const PHONE = WIDTH <= 480;
const HEIGHT = PHONE ? 844 : 900;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const require = createRequire(import.meta.url);
const PW =
  process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);

// ── the in-page sampler (runs in the persistent document: it survives soft navs) ──
function installSampler() {
  if (window.__cs) return;
  const S = (window.__cs = { frames: [], marks: [], on: true });
  const mark = (name, extra) => S.marks.push({ t: performance.now(), name, ...extra });
  [
    'swm:envelop',
    'swm:fill-release',
    'swm:loader-start',
    'swm:tagline-exit',
    'astro:before-preparation',
    'astro:before-swap',
    'astro:after-swap',
    'astro:page-load',
  ].forEach((n) => {
    const target = n.startsWith('swm:') ? window : document;
    target.addEventListener(n, (e) => mark(n, e?.detail?.color ? { color: e.detail.color, dur: e.detail.duration } : undefined), true);
  });
  window.addEventListener('click', () => mark('click'), true);
  const first = (s) => {
    const m = /rgba?\([^)]+\)|color\(srgb[^)]+\)|oklab\([^)]+\)/.exec(s || '');
    return m ? m[0] : null;
  };
  const q = (sel) => document.querySelector(sel);
  const bg = (el) => (el ? getComputedStyle(el).backgroundColor : null);
  const sample = (ts) => {
    if (!S.on) return;
    const root = document.documentElement;
    const rcs = getComputedStyle(root);
    const fill = q('.route-fill');
    const fcs = fill ? getComputedStyle(fill) : null;
    const hero = q('.hero');
    const chip = q('.fp-tag') || q('.project-blurb__tags *');
    const cta = q('.fp-card__cta') || q('.hero__enter');
    const link = q('.site-nav__link');
    const np = q('.np-band__cover');
    // The band's commit promotes its media to a fixed box: that frame is the start of the
    // commit timeline (before it the cover only follows the drag), so mark it once.
    const npm = q('.np-band__media');
    if (!S.npCommit && npm && getComputedStyle(npm).position === 'fixed') {
      S.npCommit = true;
      mark('np-commit');
    }
    S.frames.push({
      t: ts,
      np: np ? parseFloat(getComputedStyle(np).opacity) : null,
      fillA: fcs ? parseFloat(fcs.opacity) * (fcs.visibility === 'hidden' ? 0 : 1) : 0,
      fill: fcs ? fcs.backgroundColor : null,
      body: bg(document.body),
      hero: hero ? first(getComputedStyle(hero).backgroundImage) : null,
      pc: rcs.getPropertyValue('--project-color').trim(),
      nav: bg(q('.site-nav')),
      pill: bg(q('.site-nav__pill')),
      chip: bg(chip),
      cta: bg(cta),
      ink: link ? getComputedStyle(link).color : null,
      lock: (() => {
        const p = q('.site-nav__lockup svg path, .site-nav__lockup svg *');
        return p ? getComputedStyle(p).fill : null;
      })(),
      route: document.body.className,
      cls: root.className,
      path: location.pathname,
    });
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);
}

// ── analysis (node side) ──
function parseRgb(s) {
  if (!s) return null;
  let m = /rgba?\(([^)]+)\)/.exec(s);
  if (m) {
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  m = /color\(srgb ([^)]+)\)/.exec(s);
  if (m) {
    const p = m[1].split(/[ /]+/).filter(Boolean).map(Number);
    return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1];
  }
  m = /^#([0-9a-f]{6})$/i.exec((s || '').trim());
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  return null;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** first time a [{t,p}] series reaches p >= thr, interpolated between its frames. */
function timeAt(xs, thr) {
  for (let i = 0; i < xs.length; i++) {
    if (xs[i].p < thr) continue;
    if (i === 0) return xs[0].t;
    const x = xs[i - 1];
    const y = xs[i];
    return x.t + (y.t - x.t) * ((thr - x.p) / (y.p - x.p || 1));
  }
  return null;
}
const MARKS = [0.1, 0.5, 0.9];

/** a colour key's 0..1 progress along its first → last colour inside [t0, t1]. */
function colourSeries(frames, key, t0, t1) {
  const xs = frames.filter((f) => f.t >= t0 && f.t <= t1).map((f) => ({ t: f.t, c: parseRgb(f[key]) })).filter((x) => x.c);
  if (xs.length < 2) return null;
  const from = xs[0].c;
  const to = xs[xs.length - 1].c;
  const span = dist(from, to);
  if (span < 6) return { flat: true, from: from.slice(0, 3).map(Math.round) };
  const ps = xs.map((x) => ({ t: x.t, p: Math.min(1, dist(x.c, from) / span) }));
  return { from: from.slice(0, 3).map(Math.round), to: to.slice(0, 3).map(Math.round), at: MARKS.map((m) => timeAt(ps, m)), ps };
}

/** the page-background reference: the route fill (or the band's window blue) rising / lifting, 0..1. */
function coverSeries(frames, kind, commitT) {
  if (kind === 'np') {
    // The commit tween's own change: from the cover's value at the commit frame (the drag
    // had already pulled it part-way) up to solid, 0..1.
    const after = frames.filter((f) => f.t >= (commitT ?? -Infinity) && f.np != null);
    const p0 = after[0]?.np ?? 0;
    const xs = after.map((f) => ({ t: f.t, p: Math.min(1, Math.max(0, (f.np - p0) / (1 - p0 || 1))) }));
    return { ps: xs, at: MARKS.map((m) => timeAt(xs, m)) };
  }
  let i = frames.findIndex((f) => f.fillA >= 0.97);
  if (kind === 'rise') {
    const xs = frames.slice(0, i < 0 ? frames.length : i + 1).map((f) => ({ t: f.t, p: f.fillA }));
    return { ps: xs, at: MARKS.map((m) => timeAt(xs, m)) };
  }
  // lift: after the cover is solid, 1 - alpha
  if (i < 0) return null;
  const xs = frames.slice(i).map((f) => ({ t: f.t, p: 1 - f.fillA }));
  return { ps: xs, at: MARKS.map((m) => timeAt(xs, m)) };
}

const KEYS = ['nav', 'pill', 'chip', 'cta', 'ink', 'lock', 'pc', 'hero'];

/**
 * One case: the page-background reference (`ref`) and each colour series, as the times (ms from
 * the anchor) they pass 10 / 50 / 90 % of their change, and their offset from the reference in
 * ms and in frames at each mark. ≤ 1 frame at the 10 and 90 % marks = same start, same end.
 */
function analyse(frames, marks, anchor, { ref, win }) {
  const rel = (t) => (t == null ? null : +(t - anchor).toFixed(1));
  const gaps = frames.slice(1).map((f, i) => f.t - frames[i].t).sort((x, y) => x - y);
  const frameMs = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 16.7;
  const mark = (n) => marks.find((m) => m.name === n)?.t;
  const t0 = win[0] === 'start' ? -Infinity : mark(win[0]) ?? -Infinity;
  const t1 = win[1] === 'end' ? Infinity : (mark(win[1]) ?? Infinity) + (win[2] || 0);
  const out = { frameMs: +frameMs.toFixed(1), marks: marks.map((m) => ({ ...m, t: rel(m.t) })), ref: ref.kind, series: {} };
  const cover = coverSeries(frames, ref.kind, mark('np-commit'));
  out.cover = cover ? { at: cover.at.map(rel) } : null;
  out.fill = (() => {
    const risen = frames.find((f) => f.fillA >= 0.97);
    const lifted = risen && frames.find((f) => f.t > risen.t && f.fillA <= 0.03);
    return { solidAt: rel(risen?.t), goneAt: rel(lifted?.t), peak: +frames.reduce((m, f) => Math.max(m, f.fillA), 0).toFixed(2) };
  })();
  for (const k of KEYS) {
    const sr = colourSeries(frames, k, t0, t1);
    if (!sr) continue;
    if (sr.flat) {
      out.series[k] = { flat: true, colour: sr.from };
      continue;
    }
    const row = { from: sr.from, to: sr.to, at: sr.at.map(rel) };
    if (cover) {
      row.offsetMs = sr.at.map((t, i) => (t == null || cover.at[i] == null ? null : +(t - cover.at[i]).toFixed(1)));
      row.offsetFrames = row.offsetMs.map((d) => (d == null ? null : +(d / frameMs).toFixed(2)));
    }
    out.series[k] = row;
  }
  return out;
}

async function main() {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const results = {};
  const cases = CASE === 'all' ? ['rest', 'globe-work', 'detail-next', 'detail-chip', 'lockup-detail', 'lockup-work', 'lockup-directory'] : [CASE];
  for (const c of cases) {
    const ctx = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: PHONE ? 2 : 1,
      hasTouch: PHONE,
      isMobile: PHONE,
      reducedMotion: RM ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.error('pageerror', String(e).slice(0, 200)));
    try {
      results[c] = await runCase(page, c);
    } catch (e) {
      results[c] = { error: String(e).slice(0, 300) };
    }
    await ctx.close();
  }
  await browser.close();
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(results, null, 1));
  report(results);
}

async function arm(page) {
  await page.evaluate(installSampler);
}
async function capture(page, ms) {
  await sleep(ms);
  return page.evaluate(() => {
    window.__cs.on = false;
    return { frames: window.__cs.frames, marks: window.__cs.marks };
  });
}
async function firstSlug(page) {
  if (SLUG) return SLUG;
  await page.goto(`${BASE}/work/`, { waitUntil: 'load' });
  await sleep(1500);
  return page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href^="/work/"]')].find((x) => /^\/work\/[^/]+\/?$/.test(x.getAttribute('href')) && !/directory/.test(x.getAttribute('href')));
    return a ? a.getAttribute('href').replace(/^\/work\/|\/$/g, '') : null;
  });
}

async function runCase(page, c) {
  if (c === 'history') {
    // browser back / forward after a lockup passage: every stop must rest on its own colours.
    const snap = () =>
      page.evaluate(() => ({
        path: location.pathname,
        route: document.body.className,
        cls: document.documentElement.className,
        nav: getComputedStyle(document.querySelector('.site-nav')).backgroundColor,
        pc: getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim(),
        fill: getComputedStyle(document.querySelector('.route-fill')).opacity,
      }));
    const rows = [];
    const slug = await firstSlug(page);
    await page.goto(`${BASE}/work/${slug}/`, { waitUntil: 'load' });
    await sleep(4000);
    rows.push({ at: 'detail (load)', ...(await snap()) });
    await page.click('.site-nav__logo');
    await sleep(6000);
    rows.push({ at: 'home (lockup)', ...(await snap()) });
    await page.goBack();
    await sleep(5000);
    rows.push({ at: 'back', ...(await snap()) });
    await page.goForward();
    await sleep(5000);
    rows.push({ at: 'forward', ...(await snap()) });
    return { rest: rows };
  }
  if (c === 'rest') {
    const rows = [];
    for (const p of ['/', '/work/', '/work/directory/']) {
      await page.goto(`${BASE}${p}`, { waitUntil: 'load' });
      await sleep(5000);
      rows.push(await page.evaluate(() => ({
        path: location.pathname,
        route: document.body.className,
        cls: document.documentElement.className,
        nav: getComputedStyle(document.querySelector('.site-nav')).backgroundColor,
        pc: getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim(),
        fill: getComputedStyle(document.querySelector('.route-fill')).opacity,
      })));
    }
    const slug = await firstSlug(page);
    await page.goto(`${BASE}/work/${slug}/`, { waitUntil: 'load' });
    await sleep(4000);
    rows.push(await page.evaluate(() => ({
      path: location.pathname,
      route: document.body.className,
      cls: document.documentElement.className,
      nav: getComputedStyle(document.querySelector('.site-nav')).backgroundColor,
      pc: getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim(),
      fill: getComputedStyle(document.querySelector('.route-fill')).opacity,
    })));
    return { rest: rows };
  }
  if (c === 'globe-work') {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await sleep(9000);
    await arm(page);
    await sleep(300);
    const t0 = await page.evaluate(() => performance.now());
    await page.click('.hero__enter');
    const raw = await capture(page, 9000);
    return finish(raw, t0, 'click', { ref: { kind: 'lift' }, win: ['astro:after-swap', 'end'] });
  }
  if (c === 'detail-chip' || c === 'detail-next') {
    const slug = await firstSlug(page);
    await page.goto(`${BASE}/work/${slug}/`, { waitUntil: 'load' });
    await sleep(4500);
    await arm(page);
    await sleep(300);
    const t0 = await page.evaluate(() => performance.now());
    if (c === 'detail-chip') {
      await page.click('a.detail-next');
    } else {
      // the band's accumulator wants wheel at the document end
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(1500);
      const box = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      await page.mouse.move(box.w / 2, box.h / 2);
      await page.evaluate(() => window.__cs.marks.push({ t: performance.now(), name: 'drive-start' }));
      for (let i = 0; i < 60; i++) {
        await page.mouse.wheel(0, 120);
        await sleep(30);
      }
    }
    const raw = await capture(page, 7000);
    return finish(raw, t0, c === 'detail-chip' ? 'click' : 'drive-start', {
      ref: { kind: c === 'detail-chip' ? 'rise' : 'np' },
      win: ['start', 'astro:after-swap'],
    });
  }
  if (c.startsWith('lockup-')) {
    const where = c.slice('lockup-'.length);
    let path;
    if (where === 'detail') path = `/work/${await firstSlug(page)}/`;
    else if (where === 'work') path = '/work/';
    else path = '/work/directory/';
    await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
    await sleep(5000);
    await arm(page);
    await sleep(300);
    const t0 = await page.evaluate(() => performance.now());
    await page.click('.site-nav__logo');
    const raw = await capture(page, 6000);
    return finish(raw, t0, 'click', { ref: { kind: 'rise' }, win: ['start', 'astro:after-swap'] });
  }
  throw new Error(`unknown case ${c}`);
}

function finish(raw, t0, anchorName, cfg) {
  const anchor = raw.marks.find((m) => m.name === anchorName)?.t ?? t0;
  const a = analyse(raw.frames, raw.marks, anchor, cfg);
  a.frames = raw.frames.length;
  a.rows = raw.frames.map((f) => ({ ...f, t: +(f.t - anchor).toFixed(1) }));
  return a;
}

function report(results) {
  for (const [name, r] of Object.entries(results)) {
    console.log(`\n== ${name} (w${WIDTH}${RM ? ' RM' : ''})`);
    if (r.error) {
      console.log('  ERROR', r.error);
      continue;
    }
    if (r.rest) {
      for (const x of r.rest) console.log('  ', JSON.stringify(x));
      continue;
    }
    console.log(`  frames ${r.frames}  frame≈${r.frameMs}ms  reference = page background ${r.ref}`);
    console.log('  marks:', r.marks.map((m) => `${m.name}@${m.t}${m.color ? `(${m.color},${m.dur})` : ''}`).join('  '));
    console.log(`  route fill: peak ${r.fill.peak}  solid@${r.fill.solidAt}  gone@${r.fill.goneAt}`);
    console.log(`  page bg  ${MARKS.map((m, i) => `${m * 100}%@${r.cover?.at[i]}`).join('  ')}`);
    for (const [k, s] of Object.entries(r.series)) {
      if (s.flat) console.log(`  ${k.padEnd(5)} flat ${JSON.stringify(s.colour)}`);
      else console.log(`  ${k.padEnd(5)} ${MARKS.map((m, i) => `${m * 100}%@${s.at[i]}`).join('  ')}  vs page: ${s.offsetMs ? s.offsetMs.map((d, i) => `${d}ms (${s.offsetFrames[i]}f)`).join(' · ') : 'n/a'}  ${JSON.stringify(s.from)}→${JSON.stringify(s.to)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
