#!/usr/bin/env node
/**
 * globe-perf-probe — frame-time probe for the home globe (SQ-120's perf-probe,
 * landed by SQ-123). Where globe-probe judges the globe's CONTENT (worlds,
 * tiles, textures), this one times its FRAMES: how often the globe renders, how
 * evenly, and what a second of it costs the main thread and the GPU process.
 *
 * Usage (serve an export build first, on an origin Sanity's CORS list allows:
 * localhost:4330/4321/3333/4322 or 127.0.0.1:4399; build from a worktree, never
 * the main checkout, and run under ~/swm-probe-lock.sh):
 *
 *   node scripts/globe-perf-probe.mjs --base=http://127.0.0.1:4399 --out=DIR --gpu=metal
 *        [--mobile] [--secs=20] [--warm=8] [--extra="&popseed=42"] [--dpr=N] [--nodrag] [--notrace]
 *
 *   --gpu=metal         REQUIRED for any timing you quote. The default headless renderer is
 *                       SwiftShader (software GL): the globe draws about 8 fps at 2880x1800
 *                       and its numbers say nothing about a real screen. `--gpu=swiftshader`
 *                       and `--gpu=default` exist only to see that for yourself.
 *   --mobile            390x844 at DPR 3 with touch (default 1440x900 at DPR 2); --dpr overrides
 *   --secs / --warm     measured seconds (default 20: the first half idle, the second half four
 *                       drag strokes) after a warm-up (default 8 s) that is not measured
 *   --extra             appended to the URL, e.g. "&popseed=42" to replay one world sequence,
 *                       "&globefpstol=0" for the strict 60 fps gate
 *   --notrace           skip the Chromium trace (no ms-per-frame split; the rest still prints)
 *
 * Per run it writes DIR/report.json and end.png, and prints the report:
 *   globeRenders.{all,idle,drag}  renders/s, and the interval histogram: how many rendered
 *                                 intervals were 1, 2, 3, 4+ display frames long (8/17/25/33 ms
 *                                 at 120 Hz), measured on the rAF frame clock a render landed in,
 *                                 so it reads the cadence, not the script jitter inside a frame
 *   mainThreadMsPerFrame          CrRendererMain busy per display frame, split script / style /
 *                                 layout / paint+commit / gc (needs the trace)
 *   perSecond                     main-thread and GPU-process busy ms per second (the trace)
 *   longTasks                     the Long Tasks API: count, total, max, and those over 50 ms
 *   stillUploads                  main-thread ms of each texture upload from an IMAGE source (the
 *                                 stills and thumbnails; video uploads are counted apart)
 *   popStats.upload               the director's own count: render calls that grew the GPU texture
 *                                 count, and the slowest (the pump's initTexture counts since SQ-123)
 * A world change shows as long tasks and upload stalls, so compare runs under one ?popseed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);
const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith('--' + k + '='));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes('--' + k) ? true : d;
};
const BASE = arg('base');
const OUT = arg('out');
const MOBILE = !!arg('mobile');
const SECS = +arg('secs', 20);
const WARM = +arg('warm', 8);
const GPU = arg('gpu', 'swiftshader');
const EXTRA = arg('extra', '');
const TRACE = !arg('notrace');
const NODRAG = !!arg('nodrag');
const DSF = +arg('dpr', MOBILE ? 3 : 2);
const VW = MOBILE ? 390 : 1440;
const VH = MOBILE ? 844 : 900;
if (!BASE || !OUT) {
  console.error('need --base=URL and --out=DIR (see the usage header)');
  process.exit(1);
}
if (GPU !== 'metal') console.error(`[globe-perf-probe] --gpu=${GPU}: software or default GL. Timing needs --gpu=metal.`);
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** In the page: what the trace cannot say. rAF frame stamps, canvas clears (one per globe render),
 *  still-upload main-thread time, long tasks. */
const init = () => {
  const P = (window.__perf = { on: false, vUp: 0, oUp: 0, oUpPx: 0, vUpPx: 0, oUpMs: [], clears: 0, clearT: [], raf: [], lt: [], vids: new Map() });
  const isVid = (a) => a instanceof HTMLVideoElement;
  const isImg = (a) =>
    a instanceof ImageBitmap || a instanceof HTMLImageElement || a instanceof HTMLCanvasElement || (typeof OffscreenCanvas !== 'undefined' && a instanceof OffscreenCanvas) || a instanceof ImageData;
  const wrap = (proto) => {
    for (const fn of ['texImage2D', 'texSubImage2D']) {
      const orig = proto[fn];
      proto[fn] = function (...a) {
        if (!P.on) return orig.apply(this, a);
        const src = a.find((x) => x && typeof x === 'object' && !ArrayBuffer.isView(x));
        if (src && isVid(src)) {
          P.vUp++;
          P.vUpPx += src.videoWidth * src.videoHeight || 0;
          return orig.apply(this, a);
        }
        const t = performance.now();
        const r = orig.apply(this, a);
        if (src && isImg(src)) {
          P.oUp++;
          P.oUpPx += src.width * src.height || 0;
          P.oUpMs.push(performance.now() - t);
        }
        return r;
      };
    }
    const c = proto.clear;
    proto.clear = function (...a) {
      if (P.on) {
        P.clears++;
        P.clearT.push(performance.now());
      }
      return c.apply(this, a);
    };
  };
  wrap(WebGLRenderingContext.prototype);
  wrap(WebGL2RenderingContext.prototype);
  const loop = (t) => {
    if (P.on) P.raf.push(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const watch = (v) => {
    if (P.vids.has(v)) return;
    const rec = { presented: 0, lastMT: -1 };
    P.vids.set(v, rec);
    const cb = (_n, md) => {
      if (P.on && md.mediaTime !== rec.lastMT) rec.presented++;
      rec.lastMT = md.mediaTime;
      v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
  };
  setInterval(() => document.querySelectorAll('video').forEach(watch), 200);
  try {
    new PerformanceObserver((l) => {
      if (P.on) for (const e of l.getEntries()) P.lt.push([e.startTime, e.duration]);
    }).observe({ type: 'longtask' });
  } catch {}
};

const ARGS =
  GPU === 'swiftshader'
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : GPU === 'metal'
      ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
      : [];
const browser = await chromium.launch({ headless: true, args: ARGS });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DSF, hasTouch: MOBILE, isMobile: MOBILE });
const page = await ctx.newPage();
await page.addInitScript(init);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const url = BASE + '/?' + EXTRA.replace(/^&/, '');
await page.goto(url, { waitUntil: 'load' });
const cdp = await ctx.newCDPSession(page);
const gl = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2');
  const d = c.getExtension('WEBGL_debug_renderer_info');
  return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER);
});
await sleep(WARM * 1000);
const canvas = await page.evaluate(() => {
  const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  return c ? { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight } : null;
});
if (TRACE) {
  await browser.startTracing(page, {
    categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8', 'v8.execute', 'blink', 'cc', 'gpu', 'viz', 'media', 'disabled-by-default-devtools.timeline.frame'],
  });
}
const t0 = Date.now();
await page.evaluate(() => {
  window.__perf.on = true;
  window.__perf.t0 = performance.now();
});
const half = (SECS * 1000) / 2;
await sleep(half);
await page.evaluate(() => {
  window.__perf.tMid = performance.now();
});
const cx = VW / 2;
const cy = VH / 2;
const amp = MOBILE ? 140 : 420;
const strokes = 4;
const strokeMs = half / strokes;
const stepMs = 16;
for (let s = 0; s < strokes && !NODRAG; s++) {
  const dir = s % 2 ? -1 : 1;
  const n = Math.floor(strokeMs / stepMs / 1.6);
  const x = (i) => cx - (dir * amp) / 2 + (dir * amp * i) / n;
  const ts0 = Date.now();
  if (MOBILE) {
    const tp = (i) => [{ x: x(i), y: cy, radiusX: 2, radiusY: 2, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(0) });
    while (Date.now() - ts0 < strokeMs - 60) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp((n * (Date.now() - ts0)) / (strokeMs - 60)) });
      await sleep(stepMs);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(x(0), cy);
    await page.mouse.down();
    while (Date.now() - ts0 < strokeMs - 60) {
      await page.mouse.move(x((n * (Date.now() - ts0)) / (strokeMs - 60)), cy);
      await sleep(stepMs);
    }
    await page.mouse.up();
  }
  await sleep(40);
}
const elapsed = Date.now() - t0;
if (elapsed < SECS * 1000) await sleep(SECS * 1000 - elapsed);
const end = await page.evaluate(() => {
  const P = window.__perf;
  P.on = false;
  const v = [...document.querySelectorAll('video')];
  return {
    dur: performance.now() - P.t0,
    tMid: P.tMid - P.t0,
    vUp: P.vUp,
    oUp: P.oUp,
    oUpPx: P.oUpPx,
    oUpMs: P.oUpMs,
    clearT: P.clearT.map((t) => t - P.t0),
    clears: P.clears,
    raf: P.raf.map((t) => t - P.t0),
    lt: P.lt.map(([s, d]) => [s - P.t0, d]),
    presented: [...P.vids.values()].reduce((s, r) => s + r.presented, 0),
    videos: v.filter((e) => !e.paused && e.readyState >= 2).length,
    stats: window.__swmPopStats ? JSON.parse(JSON.stringify(window.__swmPopStats)) : null,
  };
});
let trace = null;
if (TRACE) trace = JSON.parse((await browser.stopTracing()).toString());
await page.screenshot({ path: path.join(OUT, 'end.png') });
await browser.close();

const r1 = (n) => Math.round(n * 10) / 10;
const r2 = (n) => Math.round(n * 100) / 100;
const secs = end.dur / 1000;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;

// A display frame = the median rAF interval (8.33 ms at 120 Hz, 16.67 at 60 Hz).
const rafIv = end.raf.slice(1).map((t, i) => t - end.raf[i]);
const frameMs = median(rafIv) || 16.7;
/** The rAF frame each canvas clear landed in: one render per frame, however many clears it made. */
const renderFrames = (clears) => {
  const frames = new Set();
  let j = 0;
  for (const t of clears) {
    while (j + 1 < end.raf.length && end.raf[j + 1] <= t) j++;
    frames.add(end.raf[j]);
  }
  return [...frames].sort((a, b) => a - b);
};
/** Renders per second and the interval histogram, in display frames: 1 = 8 ms at 120 Hz, 2 = 17, 3 = 25, 4+ = 33. */
const renders = (stamps) => {
  const iv = stamps.slice(1).map((t, i) => t - stamps[i]);
  const k = iv.map((d) => Math.max(1, Math.round(d / frameMs)));
  const bucket = (n) => k.filter((x) => (n === 4 ? x >= 4 : x === n)).length;
  const per = stamps.length > 1 ? stamps.length / ((stamps.at(-1) - stamps[0]) / 1000) : 0;
  const tgt = Math.round(1000 / 60 / frameMs); // frames per 60 fps render: 2 at 120 Hz, 1 at 60 Hz
  return {
    renders: stamps.length,
    perSec: r1(per),
    intervals: { f1: bucket(1), f2: bucket(2), f3: bucket(3), f4plus: bucket(4) },
    pctAt60: k.length ? r1((100 * k.filter((x) => x === tgt).length) / k.length) : 0, // intervals of exactly one 60 fps period
    maxMs: r1(Math.max(0, ...iv)),
  };
};
const all = renderFrames(end.clearT);
const sumLt = end.lt.reduce((s, x) => s + x[1], 0);
const up = [...end.oUpMs].sort((a, b) => a - b);
const report = {
  url,
  gl,
  dsf: DSF,
  viewport: [VW, VH],
  canvas,
  secs: r2(secs),
  displayFrameMs: r2(frameMs),
  displayFramesPerSec: r1(end.raf.length / secs),
  // The page's own rAF gaps in display frames: a render interval longer than its gate is the display's miss, not the gate's, when these show it
  displayGaps: (() => {
    const k = rafIv.map((d) => Math.max(1, Math.round(d / frameMs)));
    return { f1: k.filter((x) => x === 1).length, f2: k.filter((x) => x === 2).length, f3plus: k.filter((x) => x >= 3).length };
  })(),
  errors,
  globeRenders: {
    all: renders(all),
    idle: renders(all.filter((t) => t < end.tMid)),
    drag: renders(all.filter((t) => t >= end.tMid)),
  },
  longTasks: {
    n: end.lt.length,
    totalMs: Math.round(sumLt),
    max: Math.round(Math.max(0, ...end.lt.map((x) => x[1]))),
    over50: end.lt.filter((x) => x[1] > 50).length,
    over50Ms: end.lt.filter((x) => x[1] > 50).map((x) => Math.round(x[1])),
  },
  stillUploads: {
    n: up.length,
    perSec: r1(up.length / secs),
    totalMs: r1(up.reduce((s, x) => s + x, 0)),
    maxMs: r1(up.at(-1) ?? 0),
    over16: up.filter((x) => x > 16).length,
    mpxPerSec: r2(end.oUpPx / secs / 1e6),
  },
  videoUploadsPerSec: r1(end.vUp / secs),
  videoPresentedPerSec: r1(end.presented / secs),
  playingVideos: end.videos,
  popStats: end.stats && {
    slug: end.stats.slug,
    fps: end.stats.fps,
    upload: end.stats.upload,
    tex: end.stats.tex,
    textures: end.stats.textures,
    gpuTextures: end.stats.gpuTextures,
  },
};

if (trace) {
  const ev = trace.traceEvents;
  const names = new Map();
  for (const e of ev) if (e.ph === 'M' && e.name === 'thread_name') names.set(e.pid + ':' + e.tid, e.args.name);
  const CAT = (n) =>
    /^(FunctionCall|EvaluateScript|v8\.callFunction|v8\.run|V8\.Execute|TimerFire|FireAnimationFrame|EventDispatch|v8\.compile|V8\.Compile|RunMicrotasks|v8\.evaluateModule|HandlePostMessage|ProfileCall)/.test(n)
      ? 'script'
      : /(GC|Scavenge|MinorMS|MajorMS)/.test(n)
        ? 'gc'
        : /^(UpdateLayoutTree|RecalculateStyles)/.test(n)
          ? 'style'
          : /^(Layout|UpdateLayout)$/.test(n)
            ? 'layout'
            : /^(PrePaint|Paint|Layerize|UpdateLayer|UpdateLayerTree|Commit|CompositeLayers)$/.test(n)
              ? 'paintCommit'
              : /Decode(Image|LazyPixelRef)|ImageDecode/.test(n)
                ? 'imageDecode'
                : null;
  const by = new Map();
  for (const e of ev) {
    if (e.ph !== 'X' || !e.dur) continue;
    const k = e.pid + ':' + e.tid;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(e);
  }
  const nf = end.raf.length || 1; // per display frame
  const threads = {};
  let main = null;
  for (const [k, list] of by) {
    const name = names.get(k) || k;
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    let top = 0;
    const cats = {};
    const stack = [];
    for (const e of list) {
      while (stack.length && stack.at(-1).end <= e.ts) stack.pop();
      if (!stack.length) top += e.dur;
      const c = CAT(e.name);
      if (c) {
        cats[c] = (cats[c] || 0) + e.dur;
        const anc = [...stack].reverse().find((s) => s.c);
        if (anc) cats[anc.c] -= e.dur;
      }
      stack.push({ end: e.ts + e.dur, c });
    }
    threads[name] = (threads[name] || 0) + top / 1000;
    if (name === 'CrRendererMain' && top > (main?._top || 0)) main = { _top: top, ...cats };
  }
  if (main) {
    const busy = main._top;
    delete main._top;
    const known = Object.values(main).reduce((s, v) => s + v, 0);
    report.mainThreadMsPerFrame = { busy: r2(busy / 1000 / nf), ...Object.fromEntries(Object.entries(main).map(([c, v]) => [c, r2(v / 1000 / nf)])), uncategorised: r2((busy - known) / 1000 / nf) };
  }
  // Busy ms per second of wall clock: the renderer's main thread, and the GPU process.
  const perSec = (name) => r1((threads[name] || 0) / secs);
  report.perSecond = { mainThreadMs: perSec('CrRendererMain'), gpuProcessMs: perSec('CrGpuMain'), compositorMs: perSec('Compositor'), vizMs: perSec('VizCompositorThread') };
  report.threadBusyMsPerSec = Object.fromEntries(
    Object.entries(threads)
      .map(([k, v]) => [k, r1(v / secs)])
      .filter((x) => x[1] >= 1)
      .sort((a, b) => b[1] - a[1])
  );
}
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
// The raw stamps (ms since the run began), for re-binning: every rAF frame, the frames a globe render landed in, the long tasks
fs.writeFileSync(path.join(OUT, 'raw.json'), JSON.stringify({ raf: end.raf.map(r1), renders: all.map(r1), longTasks: end.lt.map(([s, d]) => [r1(s), r1(d)]) }));
console.log(JSON.stringify(report, null, 1));
