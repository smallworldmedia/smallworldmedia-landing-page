#!/usr/bin/env node
/**
 * globe-timing — records the home globe's video timing in headless Chrome, read-only. Folded from the 10-27
 * handoff instruments (~/swm-globe-handoff-2026-10/ttff2.mjs, approved 10-31); globe-timing-report.mjs reads its
 * output.
 *
 * Usage:
 *   node scripts/globe-timing.mjs <out.json> [--mobile] [--secs=45] [--throttle=mbps,rtt]
 *        ['--url=http://localhost:4322/?popseed=4242[&pophandoff=today]']
 *
 * Every comparable run so far pins `?popseed=4242`. `fast` has been the handoff's default since 10-28, so a
 * `today` run passes `&pophandoff=today`. Desktop is 1440×900 at DSF 2; --mobile is 390×844 at DSF 3 (touch).
 * --throttle applies CDP network throttling, to localhost too, so the boot runs slower than production would.
 * Run one browser at a time (GPU), against the worktree dev server on :4322.
 *
 * What it logs, every 50 ms in the page:
 *   - the pool's <video>s: assign, attach (src set), release and present (the first frame actually playing);
 *   - window.__swmPopStats: phase, world, step, the director's exact clock (changedAt, landedAt), the handoff's
 *     counters, and `live` (streams, liveTiles) whenever either changes.
 * Through CDP, per Mux/Sanity request (netReport's buckets): who asked (XHR = a pool player's hls.js, Fetch = the
 * fast handoff's prefetch), cache or wire, the bytes on the wire and in the body, and the timing, all on the page's
 * performance.now() clock.
 *
 * The output also records the commit it ran at (`commit`, and `dirty` when the worktree had changes), which the
 * 10-27 README tracked by hand. The 10-27 and 10-28 runs stay in ~/swm-globe-handoff-2026-10/ (seed 4242: d/p at
 * b22fbf1, d2/p2 at 7d16642, d3/p3 at 2b92f7e).
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { netBucket } from './lib/netReport.mjs';

// Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const out = process.argv[2];
if (!out || out.startsWith('--')) {
  console.error('usage: node scripts/globe-timing.mjs <out.json> [--mobile] [--secs=45] [--throttle=mbps,rtt] [--url=…]');
  process.exit(2);
}
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=') ?? d;
const MOBILE = process.argv.includes('--mobile');
const SECS = Number(arg('secs', 45));
const URL_ = arg('url', 'http://localhost:4322/');
const THR = arg('throttle', ''); // down_mbps,rtt_ms
const bucket = (u) => {
  try {
    return netBucket(u);
  } catch {
    return null;
  }
};
const git = (...a) => {
  try {
    return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
};
const commit = git('rev-parse', '--short', 'HEAD');
const dirty = !!git('status', '--porcelain', '--untracked-files=no', '--', 'src');

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const ctx = await browser.newContext(
    MOBILE
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
  );
  await ctx.addInitScript(() => {
    const log = (window.__ttLog = []);
    const now = () => Math.round(performance.now());
    const seen = new Map();
    let lastKey = '';
    let lastLive = '';
    setInterval(() => {
      document.querySelectorAll('.video-globe-pool video').forEach((v, i) => {
        const id = v.dataset.playbackId || null;
        const src = v.getAttribute('src') || '';
        const s = seen.get(i) || { id: null, src: '', presented: false };
        if (id !== s.id) log.push({ t: now(), ev: 'assign', slot: i, id });
        if (src && src !== s.src) {
          log.push({ t: now(), ev: 'attach', slot: i, id });
          s.presented = false;
        }
        if (!src && s.src) log.push({ t: now(), ev: 'release', slot: i, id });
        if (src && !s.presented && v.readyState >= 2 && !v.paused && v.currentTime > 0) {
          s.presented = true;
          log.push({ t: now(), ev: 'present', slot: i, id, w: v.videoWidth, h: v.videoHeight });
        }
        seen.set(i, { ...s, id, src });
      });
      const st = window.__swmPopStats;
      if (!st) return;
      const live = `${st.streams}|${st.liveTiles}`;
      if (live !== lastLive) {
        lastLive = live;
        log.push({ t: now(), ev: 'live', streams: st.streams, liveTiles: st.liveTiles });
      }
      const key = `${st.phase}|${st.world}|${st.step}|${st.changedAt}|${st.landedAt}`;
      if (key === lastKey) return;
      lastKey = key;
      log.push({
        t: now(), ev: 'pop', phase: st.phase, world: st.world, step: st.step, next: st.next, seed: st.seed,
        changedAt: st.changedAt, landedAt: st.landedAt, held: st.held, visible: st.visible, streams: st.streams,
        liveTiles: st.liveTiles, tex: st.tex?.mib ?? null, handoff: st.handoff ?? null,
      });
    }, 50);
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (THR) {
    const [mbps, rtt] = THR.split(',').map(Number);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: rtt, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (5 * 1e6) / 8 });
  }
  const reqs = new Map();
  let off = null; // epoch s − CDP monotonic s
  cdp.on('Network.requestWillBeSent', (e) => {
    const b = bucket(e.request.url);
    if (!b) return;
    off ??= e.wallTime - e.timestamp;
    reqs.set(e.requestId, { b, url: e.request.url, type: e.type ?? null, prio: e.request.initialPriority ?? null, t0: e.timestamp, body: 0 });
  });
  cdp.on('Network.requestServedFromCache', (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.mem = true;
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.status = e.response.status;
    r.disk = !!e.response.fromDiskCache;
    r.pfc = !!e.response.fromPrefetchCache;
    r.tr = e.timestamp;
  });
  cdp.on('Network.dataReceived', (e) => {
    const r = reqs.get(e.requestId);
    if (r) r.body += e.dataLength;
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.t1 = e.timestamp;
    r.wire = e.encodedDataLength;
  });
  cdp.on('Network.loadingFailed', (e) => {
    const r = reqs.get(e.requestId);
    if (!r) return;
    r.t1 = e.timestamp;
    r.failed = e.canceled ? 'canceled' : e.errorText;
  });
  await page.goto(URL_, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(SECS * 1000);
  const { origin, log, final } = await page.evaluate(() => ({
    origin: performance.timeOrigin,
    log: window.__ttLog,
    final: window.__swmPopStats ? { handoff: window.__swmPopStats.handoff, seed: window.__swmPopStats.seed, step: window.__swmPopStats.step } : null,
  }));
  const ms = (ts) => (ts == null || off == null ? null : Math.round((ts + off) * 1000 - origin));
  const net = [...reqs.values()].map((r) => ({
    b: r.b, url: r.url, type: r.type, prio: r.prio, t: ms(r.t0), resp: ms(r.tr), end: ms(r.t1), status: r.status ?? null,
    cache: r.mem ? 'memory' : r.pfc ? 'prefetch' : r.disk ? 'disk' : null, wire: r.wire ?? null, body: r.body, failed: r.failed ?? null,
  }));
  fs.writeFileSync(out, JSON.stringify({ url: URL_, mobile: MOBILE, secs: SECS, throttle: THR || null, commit, dirty, log, net, final }, null, 1));
  console.log(`wrote ${out}: ${log.length} events, ${net.length} requests, seed ${final?.seed}, step ${final?.step}, at ${commit}${dirty ? ' (dirty)' : ''}`);
} finally {
  await browser.close();
}
