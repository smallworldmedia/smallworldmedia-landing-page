#!/usr/bin/env node
/**
 * media-load-probe — how long does a media tile sit in view, unpainted, while a page is scrolled?
 * A measurement, not a gate: it exits 0 whatever it finds. Use it for a before/after across a
 * change to the media grids (a detail page, or the Project Directory).
 *
 * Usage:
 *   node scripts/media-load-probe.mjs --base=http://localhost:4330 --path=/work/cheetah-print/ --out=before.json
 *        [--width=1440] [--speed=2000] [--net=wifi|4g] [--back] [--maxpx=N] [--query=k=v]
 *        [--browser=chromium|webkit|firefox] [--channel=chrome]
 *   node scripts/media-load-probe.mjs --summary before.json after.json
 *
 * Run: loads the page, waits 2.5 s (hydration, the entrance, the hero), then scrolls down at
 * --speed px per second to the end of the media (or --maxpx), and with --back scrolls up again.
 * Every 50 ms, in the page, each tile (.media-slot, and a wall's img.deck-scroller__page) is read:
 *   inView   it shows at least min(80px, 25%) of itself inside the viewport (and its wall's frame)
 *   painted  a .media-slot has a .media-slot__media--loaded child; a wall <img> is complete
 * blankMs sums the time a tile was inView and not painted: what a viewer saw as an empty box.
 * frozenMs sums the time a painted <video> was inView and not advancing. The landing screen is
 * the set of tiles in view the moment the scroll stops: how long they waited, how many image
 * bytes were still arriving for them, and how many image requests were cancelled. The end state
 * counts what is still blank, or has an <img> with no src, when the run finishes. The report
 * prints to stdout and a short summary to stderr; --out also saves every tile and request.
 * --summary prints that short summary for saved runs, side by side.
 *
 * Reading it honestly (what the 11-12 round learned):
 * - Measure a production build (the export recipe in layout-probe's header), never a dev server:
 *   under the 4g throttle a dev build takes about 19 s to hydrate, and that swamps everything.
 * - Run each case twice and keep the second. The image CDNs transform on first hit, so a cold run
 *   overstates the blanks.
 * - --net is Chrome's throttle (chromium only): wifi = 30 Mbps / 20 ms, 4g = 9 Mbps / 80 ms. It
 *   does not model how a server orders its streams, so a 4g wait is indicative, not a promise.
 * - A width of 480 or less is a phone: 3× density, touch, and in chromium the scroll is a touch
 *   drag, because a wheel fights the phone's touch mechanics. On a detail page add
 *   --query=blurbhold=0, or the blurb hold stops the run early. Walls scroll sideways and are
 *   never driven, so most wall pages stay unseen.
 * - The Project Directory opens on a filter; --path=/work/directory/ --query=tag= is every work.
 * - The HTTP cache stays on (no page.route), as a viewer's is. --base falls back to
 *   GLOBE_PROBE_BASE and has no default. One browser probe at a time on this machine.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const USAGE = `  run:     node scripts/media-load-probe.mjs --base=URL --path=/work/slug/ [--out=FILE] [--width=1440] [--speed=2000]
           [--net=wifi|4g] [--back] [--maxpx=N] [--query=k=v] [--browser=chromium|webkit|firefox] [--channel=chrome]
  summary: node scripts/media-load-probe.mjs --summary RUN.json [RUN.json …]`;
function usage(why) {
  console.error(`media-load-probe: ${why}\n${USAGE}`);
  process.exit(1);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IMAGE = /sanity|image\.mux/;

const NETS = {
  // download / upload in bytes per second, latency in ms
  wifi: { downloadThroughput: 30e6 / 8, uploadThroughput: 10e6 / 8, latency: 20 },
  '4g': { downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8, latency: 80 },
};

// The short summary of one saved run ({ report, tiles, net }).
function summaryLines(name, { report: r, tiles, net }) {
  const s = r.summary;
  const n = r.netSum;
  const kind = (k) =>
    s[k]
      ? `  ${k.padEnd(10)} n=${String(s[k].tiles).padStart(3)} never=${s[k].neverPainted} >300ms=${String(s[k].blankOver300).padStart(2)} >1s=${String(s[k].blankOver1000).padStart(2)} med=${s[k].blankMedian} p90=${s[k].blankP90} max=${s[k].blankMax}`
      : null;
  const first = tiles[0];
  const firstNet = net.find((x) => first?.src && x.url.startsWith(first.src.slice(0, 150)));
  const L = r.landing;
  const E = r.endState;
  return [
    `== ${name}  ${r.browser} w${r.width} net=${r.net} speed=${r.speed}${r.back ? ' +back' : ''} scroll ${(r.scrollMs / 1000).toFixed(1)}s seen ${r.tilesSeen}/${r.tilesOnPage}`,
    ...['video', 'image', 'sequence', 'wall-img', 'wall-video'].map(kind).filter(Boolean),
    `  first tile (${first?.kind}): seen@${first?.firstSeen} painted@${first?.painted} blank=${first?.blankMs}  net done@${firstNet?.at ?? '?'}`,
    `  landing screen: ${L.tiles} tiles, ${L.paintedAtLanding} painted at the stop, never ${L.never}; wait med ${L.waitMedian} p90 ${L.waitP90} full after ${L.fullAfter} ms · images still arriving ${L.bytesAfterMb} MB · image requests cancelled ${L.abortedImages}`,
    `  at the end (y ${E.y}): ${E.inView} tiles on screen, ${E.blank} blank, ${E.noSrc} images without a src`,
    `  segments ${n['mux segment']?.mb ?? 0} MB (${n['mux segment']?.requests ?? 0} req, ${n['mux segment']?.failed ?? 0} aborted) · posters ${n['mux poster']?.mb ?? 0} MB · sanity ${n['sanity image']?.mb ?? 0} MB · failures ${r.failures.filter((x) => !/ERR_ABORTED/.test(x.failed || '')).length} · console errors ${r.consoleErrors.length}`,
  ];
}

if (arg('summary')) {
  const files = process.argv.slice(process.argv.indexOf('--summary') + 1).filter((a) => !a.startsWith('--'));
  if (!files.length) usage('--summary needs at least one saved run');
  for (const f of files) {
    if (!fs.existsSync(f)) usage(`no such run: ${f}`);
    console.log(`${summaryLines(f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(f, 'utf8'))).join('\n')}\n`);
  }
  process.exit(0);
}

const BASE = arg('base', process.env.GLOBE_PROBE_BASE);
const PATH = arg('path');
if (typeof BASE !== 'string' || !BASE) usage('--base is required (or GLOBE_PROBE_BASE)');
if (typeof PATH !== 'string' || !PATH) usage('--path is required');
const WIDTH = Number(arg('width', 1440));
const SPEED = Number(arg('speed', 2000)); // px per second
const NET = arg('net', 'none');
const BACK = !!arg('back', false);
const OUT = arg('out', '');
const QUERY = arg('query', '');
const MAXPX = Number(arg('maxpx', 0)); // stop the scroll after this many px (0 = to the media's end)
const CHANNEL = arg('channel', '');
const BROWSER = arg('browser', 'chromium');
if (!['chromium', 'webkit', 'firefox'].includes(BROWSER)) usage(`unknown --browser=${BROWSER}`);
if (NET !== 'none' && !NETS[NET]) usage(`unknown --net=${NET}`);
if (NET !== 'none' && BROWSER !== 'chromium') usage('--net throttles through CDP: chromium only');
const PHONE = WIDTH <= 480;

// Runs in the page before its scripts, so it must stay self-contained.
function instrument() {
  const recs = new Map(); // element → record
  const list = [];
  const t0 = performance.now();
  let last = t0;
  let ticks = 0;
  const kindOf = (el) => {
    if (el.tagName === 'IMG') return 'wall-img';
    if (el.querySelector('.media-slot__sequence')) return 'sequence';
    if (el.querySelector('video') || el.closest('.deck-scroller')) return 'video';
    const img = el.querySelector('img');
    if (img && /image\.mux\.com/.test(img.currentSrc || img.src)) return 'video';
    return 'image';
  };
  const tick = () => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    ticks += 1;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    for (const el of document.querySelectorAll('.media-slot, img.deck-scroller__page')) {
      let r = recs.get(el);
      if (!r) {
        r = { i: list.length, kind: kindOf(el), wall: !!el.closest('.deck-scroller'), firstSeen: null, painted: null, blankMs: 0, frozenMs: 0, lastTime: -1, src: '' };
        recs.set(el, r);
        list.push(r);
      }
      const b = el.getBoundingClientRect();
      let top = Math.max(b.top, 0);
      let bottom = Math.min(b.bottom, vh);
      let left = Math.max(b.left, 0);
      let right = Math.min(b.right, vw);
      const frame = el.closest('.deck-scroller');
      if (frame) {
        const f = frame.getBoundingClientRect();
        top = Math.max(top, f.top);
        bottom = Math.min(bottom, f.bottom);
        left = Math.max(left, f.left);
        right = Math.min(right, f.right);
      }
      const need = Math.min(80, b.height * 0.25);
      const inView = b.height > 0 && bottom - top >= need && right - left > 8;
      const painted =
        el.tagName === 'IMG' ? el.complete && el.naturalWidth > 0 : !!el.querySelector('.media-slot__media--loaded');
      if (!r.src) {
        if (r.kind === 'image' || r.kind === 'wall-img') {
          const img = el.tagName === 'IMG' ? el : el.querySelector('img');
          r.src = (img?.currentSrc || img?.src || '').slice(0, 160);
        } else {
          r.src = (el.querySelector('video')?.poster || el.querySelector('img')?.src || '').slice(0, 160);
        }
      }
      r.in = inView;
      r.tick = ticks;
      if (inView && r.firstSeen == null) r.firstSeen = Math.round(now - t0);
      if (painted && r.painted == null) r.painted = Math.round(now - t0);
      if (inView && !painted) r.blankMs += dt;
      const v = el.tagName === 'IMG' ? null : el.querySelector('video');
      if (v && painted && inView) {
        if (v.currentTime === r.lastTime) r.frozenMs += dt;
        r.lastTime = v.currentTime;
      }
    }
  };
  setInterval(tick, 50);
  // The scroll has stopped: the tiles in view now are the landing screen.
  window.__mediaLand = () => {
    tick();
    for (const r of list) if (r.in && r.tick === ticks) r.landed = true;
    return Math.round(performance.now() - t0);
  };
  window.__mediaLoad = () => list.map((r) => ({ ...r, blankMs: Math.round(r.blankMs), frozenMs: Math.round(r.frozenMs) }));
}

// Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
const require = createRequire(import.meta.url);
const pw = require(
  process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const browser = await pw[BROWSER].launch({ headless: true, ...(CHANNEL ? { channel: CHANNEL } : {}) });
const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: PHONE ? 844 : 900 },
  deviceScaleFactor: PHONE ? 3 : 2,
  ...(PHONE && BROWSER !== 'firefox' ? { isMobile: true, hasTouch: true } : {}),
});
const page = await ctx.newPage();
await page.addInitScript(instrument);

const MEDIA = /cdn\.sanity\.io|mux\.com/;
const net = [];
const consoleErrors = [];
const started = Date.now();
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240));
});
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 240)}`));
page.on('requestfailed', (req) => {
  if (!MEDIA.test(req.url())) return;
  net.push({ url: req.url(), failed: req.failure()?.errorText || 'failed', at: Date.now() - started });
});
page.on('requestfinished', async (req) => {
  const url = req.url();
  if (!MEDIA.test(url)) return;
  try {
    const res = await req.response();
    const t = req.timing();
    const sizes = await req.sizes().catch(() => null);
    const h = res ? res.headers() : {};
    net.push({
      url,
      status: res?.status(),
      at: Date.now() - started,
      ttfb: t.responseStart >= 0 ? Math.round(t.responseStart - Math.max(t.requestStart, 0)) : null,
      total: t.responseEnd >= 0 ? Math.round(t.responseEnd) : null,
      bytes: sizes ? sizes.responseBodySize : null,
      age: h.age ?? null,
      xcache: h['x-cache'] ?? h['cf-cache-status'] ?? null,
      type: h['content-type'] ?? null,
    });
  } catch {
    /* the page went away */
  }
});

const cdp = BROWSER === 'chromium' ? await ctx.newCDPSession(page) : null;
if (NETS[NET]) {
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETS[NET] });
}

const url = BASE.replace(/\/$/, '') + PATH + (QUERY ? `${PATH.includes('?') ? '&' : '?'}${QUERY}` : '');
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await sleep(2500); // hydration, the entrance, the hero

const flowBottom = () =>
  page.evaluate(() => {
    const f = document.querySelector('.project-detail__flow, .dir-flow');
    return f ? f.getBoundingClientRect().bottom - window.innerHeight : -1;
  });

// Scroll down at SPEED: real wheel events (Lenis smooths them, as for a viewer), or on a phone in
// chromium one finger drag with no fling.
const STEP_MS = 50;
const dy = (SPEED * STEP_MS) / 1000;
await page.mouse.move(WIDTH / 2, 450);
const maxSteps = Math.ceil(200000 / dy);
let steps = 0;
const scrollStart = Date.now();
while (steps < maxSteps) {
  const left = await flowBottom();
  if (left < 40) break; // the media's end: never lean on the next-project band
  if (MAXPX && (await page.evaluate(() => window.scrollY)) >= MAXPX) break;
  if (PHONE && cdp) {
    await cdp.send('Input.synthesizeScrollGesture', {
      x: WIDTH / 2,
      y: 640,
      yDistance: -Math.min(480, Math.max(left, 24)),
      speed: SPEED,
      gestureSourceType: 'touch',
      preventFling: true,
    });
  } else {
    await page.mouse.wheel(0, Math.min(dy, Math.max(left, 20)));
    await sleep(STEP_MS);
  }
  steps += 1;
}
const scrollMs = Date.now() - scrollStart;
const landAt = await page.evaluate(() => window.__mediaLand());
await sleep(1500);
if (BACK) {
  // Back up to the top at the same speed: tiles re-enter (a video's stream re-attaches).
  let y = await page.evaluate(() => window.scrollY);
  while (y > 4 && steps < 2 * maxSteps) {
    await page.mouse.wheel(0, -dy);
    await sleep(STEP_MS);
    y = await page.evaluate(() => window.scrollY);
    steps += 1;
  }
}
await sleep(NET === '4g' ? 14000 : 6000); // stragglers

// What is on screen when the run ends: nothing may be left blank or stripped.
const endState = await page.evaluate(() => {
  const out = { inView: 0, blank: 0, noSrc: 0, y: Math.round(scrollY) };
  for (const el of document.querySelectorAll('.media-slot')) {
    const b = el.getBoundingClientRect();
    if (b.bottom <= 0 || b.top >= innerHeight || el.closest('.deck-scroller')) continue;
    out.inView += 1;
    if (!el.querySelector('.media-slot__media--loaded')) out.blank += 1;
    for (const img of el.querySelectorAll('img')) if (!img.getAttribute('src')) out.noSrc += 1;
  }
  return out;
});
const tiles = await page.evaluate(() => window.__mediaLoad());
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
await browser.close();

const seen = tiles.filter((t) => t.firstSeen != null);
const q = (xs, p) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const byKind = {};
for (const t of seen) {
  const k = t.wall ? `wall-${t.kind === 'wall-img' ? 'img' : t.kind}` : t.kind;
  (byKind[k] ||= []).push(t);
}
const summary = {};
for (const [k, ts] of Object.entries(byKind)) {
  const blank = ts.map((t) => t.blankMs);
  summary[k] = {
    tiles: ts.length,
    neverPainted: ts.filter((t) => t.painted == null).length,
    blankOver300: ts.filter((t) => t.blankMs > 300).length,
    blankOver1000: ts.filter((t) => t.blankMs > 1000).length,
    blankMedian: q(blank, 0.5),
    blankP90: q(blank, 0.9),
    blankMax: Math.max(...blank),
    frozenMedian: q(ts.map((t) => t.frozenMs), 0.5),
  };
}
const host = (u) => {
  try {
    const h = new URL(u).host;
    return h.includes('stream.mux.com') ? 'mux playlist' : h.includes('image.mux.com') ? 'mux poster' : h.includes('mux.com') ? 'mux segment' : h.includes('sanity') ? 'sanity image' : h;
  } catch {
    return '?';
  }
};
const netSum = {};
for (const n of net) {
  const s = (netSum[host(n.url)] ||= { requests: 0, failed: 0, bytes: 0, ttfb: [], notOk: 0 });
  s.requests += 1;
  if (n.failed) s.failed += 1;
  else {
    s.bytes += n.bytes || 0;
    if (n.ttfb != null) s.ttfb.push(n.ttfb);
    if (n.status >= 400) s.notOk += 1;
  }
}
for (const s of Object.values(netSum)) {
  s.mb = +(s.bytes / 1e6).toFixed(2);
  s.ttfbMedian = q(s.ttfb, 0.5);
  s.ttfbP90 = q(s.ttfb, 0.9);
  s.ttfbMax = s.ttfb.length ? Math.max(...s.ttfb) : 0;
  delete s.ttfb;
  delete s.bytes;
}
const images = net.filter((n) => !n.failed && IMAGE.test(n.url));
const landed = tiles.filter((t) => t.landed);
const waits = landed
  .filter((t) => t.painted != null)
  .map((t) => Math.max(0, t.painted - landAt))
  .sort((a, b) => a - b);
const landing = {
  at: landAt,
  tiles: landed.length,
  paintedAtLanding: waits.filter((w) => w === 0).length,
  never: landed.filter((t) => t.painted == null).length,
  waitMedian: q(waits, 0.5),
  waitP90: q(waits, 0.9),
  fullAfter: waits.length ? waits[waits.length - 1] : null,
  // images still arriving after the stop
  bytesAfterMb: +(images.filter((n) => n.at > landAt).reduce((a, n) => a + (n.bytes || 0), 0) / 1e6).toFixed(2),
  abortedImages: net.filter((n) => n.failed && IMAGE.test(n.url)).length,
};
const short = (u) => u.replace(/^https:\/\//, '').slice(0, 130);
const report = {
  url,
  landing,
  endState,
  browser: BROWSER,
  width: WIDTH,
  speed: SPEED,
  net: NET,
  back: BACK,
  docH,
  scrollMs,
  tilesOnPage: tiles.length,
  tilesSeen: seen.length,
  summary,
  netSum,
  slowestImages: images
    .filter((n) => n.ttfb != null)
    .sort((a, b) => b.ttfb - a.ttfb)
    .slice(0, 8)
    .map((n) => ({ ttfb: n.ttfb, kb: Math.round((n.bytes || 0) / 1024), age: n.age, xcache: n.xcache, url: short(n.url) })),
  biggestImages: [...images]
    .sort((a, b) => (b.bytes || 0) - (a.bytes || 0))
    .slice(0, 8)
    .map((n) => ({ kb: Math.round((n.bytes || 0) / 1024), type: n.type, url: short(n.url) })),
  failures: net.filter((n) => n.failed || n.status >= 400).slice(0, 20),
  worstTiles: seen
    .filter((t) => t.blankMs > 300 || t.painted == null)
    .sort((a, b) => b.blankMs - a.blankMs)
    .slice(0, 15),
  consoleErrors: consoleErrors.slice(0, 12),
};
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ report, tiles, net }, null, 1));
console.log(JSON.stringify(report, null, 1));
console.error(summaryLines(OUT ? OUT.replace(/\.json$/, '') : PATH, { report, tiles, net }).join('\n'));
