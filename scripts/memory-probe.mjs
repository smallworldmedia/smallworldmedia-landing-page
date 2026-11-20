#!/usr/bin/env node
/**
 * memory-probe — what GROWS on an iPhone tab until iOS kills it (SQ-129). Nathan, 11-20, iPhone 17
 * Pro, Safari and Chrome (both WebKit): the page reloads (Safari) or "can't open this page"
 * (Chrome) after about four globe worlds, or after the scheme eye is held about 3 s while it
 * flips schemes. That is the WebContent process killed for memory, so this probe counts, per
 * sample, everything a page can pile up, and gates each count's plateau (scripts/lib/plateauGate.mjs).
 *
 * Usage (serve a build of THIS worktree on a Sanity CORS origin, e.g. localhost:4321, and run
 * under ~/swm-probe-lock.sh):
 *
 *   node scripts/memory-probe.mjs --base=http://localhost:4321 --out=DIR --run=worlds|eye
 *        [--engine=webkit|chromium] [--worlds=8] [--flips=12] [--minute=60] [--extra="&popseed=42"]
 *        [--gpu=metal|swiftshader] [--vw=402 --vh=874 --dpr=3]
 *
 *   --run=worlds   home, ?popseed=42: one sample per world change (N >= --worlds), after a baseline
 *   --run=eye      home, ?pophold=60 (one world holds, so the globe's churn is out of the count):
 *                  the eye held and scrubbed across the stations for --flips previews, released,
 *                  then press-scrub-release cycles for --minute seconds; a sample every 2 flips
 *   --engine       webkit (default: iOS is WebKit for every browser) or chromium (CDP: forced GC
 *                  before each sample, so "alive" counts are exact, plus Performance.getMetrics)
 *   --run=eye also samples `engaged` (held, before any preview) and, under WebKit, gates the opening STEP
 *                  (stepGate: the footprint's peak through `released` over the baseline, <= --stepmax MiB,
 *                  default 160; SQ-133 measured +251..+278 on the base build, +85..+103 with the chains registered)
 *   Bisect arms (SQ-133), each in a fresh browser:
 *   --css="..."    a stylesheet in force from the first paint (hide a part, drop a property, register one)
 *   --drive=api    flip the scheme with no widget gesture (the writes setScheme makes for a preview);
 *                  --api=attr only html[data-scheme], --api=event only the swm:scheme event. Pair with
 *                  --extra="&schemeui=0" or --css to take the widget out. Not step-gated.
 *
 * Per sample (window.__mem, installed before any page script):
 *   glContexts     WebGL contexts ever created, and glLive (canvases holding one, not lost)
 *   glTextures / glBuffers / glPrograms / glFramebuffers   GL objects created minus deleted (the
 *                  renderer-agnostic form of three's renderer.info.memory and info.programs)
 *   glTexMiB       level-0+mips bytes of every live GL texture, from the sizes uploaded
 *   canvases       canvases alive (2D or GL), canvasConn (in the DOM), canvasMiB (backing stores)
 *   videos         <video>s alive, videoSrc (holding a source), videoConn (in the DOM)
 *   mse / mseOpen / sourceBuffers / bufferedS   MediaSources (hls.js makes one per attach) and the
 *                  seconds they hold
 *   objectUrls     createObjectURL minus revokeObjectURL; bitmaps: ImageBitmaps alive, not closed
 *   layers         elements whose computed backdrop-filter or will-change is set (the glass scheme)
 *   nodes          document.getElementsByTagName('*').length; schemeEvents: swm:scheme events seen
 *   footMiB        macOS footprint(1) of the page's process (WebContent / renderer): what jetsam reads;
 *                  footCats its top dirty categories (report.json only)
 *   heapMiB        Chromium only: the JS heap after a forced collection
 * Under WebKit nothing forces a collection, so "alive" counts include garbage not yet swept; a
 * leak shows on both engines, garbage only on WebKit. Writes DIR/report.json and prints the gate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { plateauGate, stepGate } from './lib/plateauGate.mjs';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith('--' + k + '='));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes('--' + k) ? true : d;
};
const BASE = arg('base', 'http://localhost:4321');
const OUT = arg('out');
const RUN = arg('run', 'worlds');
const ENGINE = arg('engine', 'webkit');
const WORLDS = +arg('worlds', 8);
const FLIPS = +arg('flips', 12);
const MINUTE = +arg('minute', 60);
const EXTRA = arg('extra', '');
const CSS = arg('css', '');
const DRIVE = arg('drive', 'eye');
const API = arg('api', 'full');
const STEP_MAX = +arg('stepmax', 160);
const GPU = arg('gpu', 'metal');
const VW = +arg('vw', 402);
const VH = +arg('vh', 874);
const DPR = +arg('dpr', 3);
if (!OUT) {
  console.error('need --out=DIR (see the usage header)');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── processes: footprint(1) of the page's own process ── */
const procs = () => {
  const out = execSync('ps -axo pid=,command=', { encoding: 'utf8', maxBuffer: 1 << 24 });
  return out
    .split('\n')
    .map((l) => l.trim().match(/^(\d+)\s+(.+)$/))
    .filter((m) => m && m[2].includes(`ms-playwright/${ENGINE === 'webkit' ? 'webkit' : 'chromium'}`))
    .map((m) => ({ pid: +m[1], cmd: m[2] }));
};
const isPageProc = (p) => (ENGINE === 'webkit' ? /WebContent/.test(p.cmd) : /--type=renderer/.test(p.cmd) && !/--extension-process/.test(p.cmd));
/** footprint(1): the total, and the top dirty categories (MiB) — what a step is made of. */
const footOf = (pid) => {
  try {
    const out = execSync(`footprint -p ${pid} -f bytes`, { encoding: 'utf8', maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'ignore'] });
    const m = out.match(/Footprint:\s+(\d+)\s+B/);
    const cats = {};
    for (const l of out.split('\n')) {
      const c = l.trim().match(/^(\d+)\s+B\s+\d+\s+B\s+\d+\s+B\s+\d+\s+(.+)$/);
      if (c && Object.keys(cats).length < 6) cats[c[2].trim()] = +(+c[1] / 1048576).toFixed(1);
    }
    return m ? { total: +(+m[1] / 1048576).toFixed(1), cats } : null;
  } catch {
    return null;
  }
};

/* ── in the page, before any script: the counters ── */
const init = () => {
  const M = (window.__mem = { ctx: [], canv: [], vids: [], mse: [], bmps: [], urls: 0, schemeEvents: 0, gl: { tex: 0, buf: 0, prog: 0, fb: 0 }, texBytes: new Map() });
  const ref = (o) => (typeof WeakRef === 'function' ? new WeakRef(o) : { deref: () => o });
  const seen = new WeakSet();
  const trackCanvas = (c) => {
    if (seen.has(c)) return;
    seen.add(c);
    M.canv.push(ref(c));
  };
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const had = this.__memCtx;
    const ctx = getContext.call(this, type, ...rest);
    if (ctx) {
      trackCanvas(this);
      if (!had && /webgl/.test(type)) M.ctx.push({ canvas: ref(this), gl: ref(ctx) });
      this.__memCtx = this.__memCtx || type;
    }
    return ctx;
  };
  // GL objects: created minus deleted, and the bytes uploaded to each texture (level 0 and mips).
  const bound = new WeakMap(); // gl -> { unit, units: Map(unit -> Map(target -> texture)) }
  const st = (gl) => bound.get(gl) || (bound.set(gl, { unit: 0, units: new Map() }), bound.get(gl));
  const wrapGL = (P) => {
    if (!P) return;
    const pair = (mk, del, key) => {
      const c = P[mk];
      const d = P[del];
      P[mk] = function (...a) {
        const o = c.apply(this, a);
        if (o) M.gl[key] += 1;
        return o;
      };
      P[del] = function (o) {
        if (o && !o.__memDead) {
          o.__memDead = true;
          M.gl[key] -= 1;
          if (key === 'tex') M.texBytes.delete(o);
        }
        return d.call(this, o);
      };
    };
    pair('createTexture', 'deleteTexture', 'tex');
    pair('createBuffer', 'deleteBuffer', 'buf');
    pair('createProgram', 'deleteProgram', 'prog');
    pair('createFramebuffer', 'deleteFramebuffer', 'fb');
    const at = P.activeTexture;
    P.activeTexture = function (u) {
      st(this).unit = u;
      return at.call(this, u);
    };
    const bt = P.bindTexture;
    P.bindTexture = function (target, t) {
      const s = st(this);
      if (!s.units.has(s.unit)) s.units.set(s.unit, new Map());
      s.units.get(s.unit).set(target, t);
      return bt.call(this, target, t);
    };
    const CUBE = 0x8513;
    const texOf = (gl, target) => {
      const s = st(gl);
      const m = s.units.get(s.unit);
      if (!m) return null;
      return target >= 0x8515 && target <= 0x851a ? m.get(CUBE) : m.get(target);
    };
    const record = (gl, target, level, w, h, depth = 1) => {
      const t = texOf(gl, target);
      if (!t || !(w > 0) || !(h > 0)) return;
      const per = M.texBytes.get(t) || new Map();
      per.set(`${target}:${level}`, w * h * depth * 4);
      M.texBytes.set(t, per);
    };
    const ti = P.texImage2D;
    P.texImage2D = function (...a) {
      const [target, level] = a;
      if (a.length >= 8) record(this, target, level, a[3], a[4]);
      else {
        const src = a[a.length - 1];
        record(this, target, level, src?.videoWidth || src?.naturalWidth || src?.width, src?.videoHeight || src?.naturalHeight || src?.height);
      }
      return ti.apply(this, a);
    };
    if (P.texStorage2D) {
      const ts = P.texStorage2D;
      P.texStorage2D = function (target, levels, fmt, w, h) {
        for (let l = 0, ww = w, hh = h; l < levels; l++, ww = Math.max(1, ww >> 1), hh = Math.max(1, hh >> 1)) record(this, target, l, ww, hh);
        return ts.call(this, target, levels, fmt, w, h);
      };
    }
    if (P.texImage3D) {
      const t3 = P.texImage3D;
      P.texImage3D = function (...a) {
        if (a.length >= 10) record(this, a[0], a[1], a[3], a[4], a[5]);
        return t3.apply(this, a);
      };
    }
    const gm = P.generateMipmap;
    P.generateMipmap = function (target) {
      const t = texOf(this, target);
      const per = t && M.texBytes.get(t);
      const base = per && per.get(`${target}:0`);
      if (base) per.set(`${target}:mips`, base / 3);
      return gm.call(this, target);
    };
  };
  wrapGL(window.WebGLRenderingContext?.prototype);
  wrapGL(window.WebGL2RenderingContext?.prototype);
  // <video>: every one created by script or parsed into the DOM.
  const ce = Document.prototype.createElement;
  Document.prototype.createElement = function (tag, ...rest) {
    const el = ce.call(this, tag, ...rest);
    const t = String(tag).toLowerCase();
    if (t === 'video') M.vids.push(ref(el));
    else if (t === 'canvas') trackCanvas(el);
    return el;
  };
  new MutationObserver((recs) => {
    for (const r of recs)
      for (const n of r.addedNodes) {
        if (n.nodeType !== 1) continue;
        const vs = n.tagName === 'VIDEO' ? [n] : n.querySelectorAll?.('video') || [];
        for (const v of vs) if (!v.__memSeen) ((v.__memSeen = true), M.vids.push(ref(v)));
      }
  }).observe(document, { childList: true, subtree: true });
  // MediaSource (hls.js makes one per attach; iOS 17+ prefers ManagedMediaSource).
  for (const name of ['MediaSource', 'ManagedMediaSource']) {
    const Orig = window[name];
    if (typeof Orig !== 'function') continue;
    const Wrapped = class extends Orig {
      constructor(...a) {
        super(...a);
        M.mse.push(ref(this));
      }
    };
    Object.defineProperty(Wrapped, 'name', { value: name });
    window[name] = Wrapped;
  }
  const cou = URL.createObjectURL;
  URL.createObjectURL = function (o) {
    M.urls += 1;
    return cou.call(this, o);
  };
  const rou = URL.revokeObjectURL;
  URL.revokeObjectURL = function (u) {
    M.urls -= 1;
    return rou.call(this, u);
  };
  if (typeof createImageBitmap === 'function') {
    const cib = window.createImageBitmap;
    window.createImageBitmap = function (...a) {
      return cib.apply(this, a).then((b) => (M.bmps.push(ref(b)), b));
    };
  }
  window.addEventListener('swm:scheme', () => (M.schemeEvents += 1));
  window.__memSnap = () => {
    const live = (arr) => arr.map((r) => r.deref()).filter(Boolean);
    const canv = live(M.canv);
    let canvasBytes = 0;
    for (const c of canv) if (c.__memCtx) canvasBytes += c.width * c.height * 4 * (/webgl/.test(c.__memCtx) ? 3 : 1);
    const vids = live(M.vids);
    const mse = live(M.mse);
    let sb = 0;
    let buffered = 0;
    for (const m of mse) {
      for (const b of m.sourceBuffers || []) {
        sb += 1;
        try {
          for (let i = 0; i < b.buffered.length; i++) buffered += b.buffered.end(i) - b.buffered.start(i);
        } catch {
          /* removed */
        }
      }
    }
    let texBytes = 0;
    for (const per of M.texBytes.values()) for (const v of per.values()) texBytes += v;
    let layers = 0;
    const all = document.getElementsByTagName('*');
    for (const el of all) {
      const cs = getComputedStyle(el);
      const bf = cs.backdropFilter || cs.webkitBackdropFilter;
      if ((bf && bf !== 'none') || (cs.willChange && cs.willChange !== 'auto')) layers += 1;
    }
    const pop = window.__swmPopStats;
    const mib = (b) => Math.round((b / 1048576) * 10) / 10;
    return {
      glContexts: M.ctx.length,
      glLive: M.ctx.filter((c) => {
        const gl = c.gl.deref();
        return gl && !gl.isContextLost();
      }).length,
      glTextures: M.gl.tex,
      glBuffers: M.gl.buf,
      glPrograms: M.gl.prog,
      glFramebuffers: M.gl.fb,
      glTexMiB: mib(texBytes),
      canvases: canv.length,
      canvasConn: canv.filter((c) => c.isConnected).length,
      canvasMiB: mib(canvasBytes),
      videos: vids.length,
      videoSrc: vids.filter((v) => v.currentSrc || v.srcObject || v.getAttribute('src')).length,
      videoConn: vids.filter((v) => v.isConnected).length,
      mse: mse.length,
      mseOpen: mse.filter((m) => m.readyState === 'open').length,
      sourceBuffers: sb,
      bufferedS: Math.round(buffered * 10) / 10,
      objectUrls: M.urls,
      bitmaps: live(M.bmps).filter((b) => b.width > 0).length,
      layers,
      nodes: all.length,
      schemeEvents: M.schemeEvents,
      popTextures: pop?.textures ?? null,
      popGpuTextures: pop?.gpuTextures ?? null,
      popTexMiB: pop?.tex?.mib ?? null,
      step: pop?.step ?? null,
      world: pop?.world ?? null,
      scheme: document.documentElement.dataset.scheme,
    };
  };
};

/* ── launch ── */
const before = new Set(procs().map((p) => p.pid));
const launchArgs =
  ENGINE === 'chromium'
    ? { headless: true, args: GPU === 'metal' ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }
    : { headless: true };
const browser = await pw[ENGINE].launch(launchArgs);
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR, hasTouch: true, isMobile: true });
await ctx.addInitScript(init);
// --css: a bisect arm's stylesheet, in force from the first paint (appended once <head> exists).
if (CSS)
  await ctx.addInitScript((css) => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = css;
      document.head.append(s);
    });
  }, CSS);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('crash', () => errors.push('PAGE CRASHED'));
const cdp = ENGINE === 'chromium' ? await ctx.newCDPSession(page) : null;
if (cdp) await cdp.send('Performance.enable');

const t0 = Date.now();
const samples = [];
const sample = async (label) => {
  let heapMiB = null;
  let cdpMetrics = null;
  if (cdp) {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    heapMiB = +((await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576).toFixed(2);
    const { metrics } = await cdp.send('Performance.getMetrics');
    const g = (n) => metrics.find((m) => m.name === n)?.value ?? null;
    cdpMetrics = { cdpNodes: g('Nodes'), layoutObjects: g('LayoutObjects'), listeners: g('JSEventListeners') };
  }
  const snap = await page.evaluate(() => window.__memSnap());
  const pageProcs = procs().filter((p) => !before.has(p.pid) && isPageProc(p));
  const feet = pageProcs.map((p) => footOf(p.pid)).filter(Boolean).sort((a, b) => b.total - a.total);
  const row = { label, t: Math.round((Date.now() - t0) / 100) / 10, ...snap, heapMiB, ...cdpMetrics, footMiB: feet[0]?.total ?? null, footCats: feet[0]?.cats ?? null };
  samples.push(row);
  console.log(
    `[${row.t}s] ${label.padEnd(10)} foot ${row.footMiB} MiB · ctx ${row.glContexts}/${row.glLive} · tex ${row.glTextures} (${row.glTexMiB} MiB) · buf ${row.glBuffers} · prog ${row.glPrograms} · canv ${row.canvases}/${row.canvasConn} (${row.canvasMiB} MiB) · vid ${row.videos}/${row.videoSrc}/${row.videoConn} · mse ${row.mse}/${row.mseOpen} sb ${row.sourceBuffers} ${row.bufferedS}s · urls ${row.objectUrls} · bmp ${row.bitmaps} · layers ${row.layers} · nodes ${row.nodes}${heapMiB != null ? ` · heap ${heapMiB}` : ''} · ${row.scheme} · ${row.world ?? ''}`
  );
  return row;
};

const report = { argv: process.argv.slice(2), engine: ENGINE, run: RUN, viewport: [VW, VH, DPR], base: BASE };
try {
  const url = RUN === 'eye' ? `${BASE}/?popseed=42&pophold=60${EXTRA}` : `${BASE}/?popseed=42${EXTRA}`;
  await page.goto(url, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => window.__swmPopStats && window.__swmPopStats.step != null, null, { timeout: 90000 });
  await sleep(4000);
  await sample('baseline');
  if (RUN === 'eye' && DRIVE === 'api') {
    // The scheme flipped with no widget gesture (a bisect arm: pair with ?schemeui=0 or --css): the
    // same writes colorScheme.setScheme makes for a preview, or only one half of them (--api=attr|event).
    const order = ['blue', 'black', 'blue', 'project'];
    let n = 0;
    const flip = () =>
      page.evaluate(
        ({ name, api }) => {
          const prev = document.documentElement.dataset.scheme;
          if (window.__swmScheme) window.__swmScheme.applied = name;
          if (api !== 'event') document.documentElement.dataset.scheme = name;
          if (api !== 'attr') window.dispatchEvent(new CustomEvent('swm:scheme', { detail: { scheme: name, prev, preview: true } }));
        },
        { name: order[n++ % order.length], api: API }
      );
    while (n < FLIPS) {
      await flip();
      await sleep(350);
      if (n % 2 === 0) await sample(`held ${n}`);
    }
    await sleep(1500);
    await sample('released');
    const end = Date.now() + MINUTE * 1000;
    while (Date.now() < end) {
      await flip();
      await sleep(700);
      if (n % 6 === 0) await sample(`minute ${n}`);
    }
    await sleep(2000);
    await sample('end');
    report.flips = n;
  } else if (RUN === 'worlds') {
    let last = await page.evaluate(() => window.__swmPopStats.step);
    let changes = 0;
    const deadline = Date.now() + (WORLDS + 3) * 15000;
    while (changes < WORLDS && Date.now() < deadline) {
      await sleep(500);
      const step = await page.evaluate(() => window.__swmPopStats?.step);
      if (step !== last) {
        last = step;
        changes += 1;
        await sleep(3000); // the change lands and its clips start
        await sample(`world ${changes}`);
      }
    }
    report.worldChanges = changes;
  } else {
    await page.waitForSelector('.swm-corner[data-ready] .fp-scale', { timeout: 30000 });
    const geo = await page.evaluate(() => {
      const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect();
      const cs = getComputedStyle(document.querySelector('.swm-corner'));
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, step: parseFloat(cs.getPropertyValue('--eye-step')) || 40 };
    });
    report.eye = geo;
    // Synthetic touch pointers on the pager root (usePagerGesture listens for pointer events; the
    // capture call throws for a synthetic id and the engine carries on uncaptured, by design).
    const fire = (type, y) =>
      page.evaluate(
        ({ type, x, y }) => {
          const root = document.querySelector('.swm-corner .fp-scale');
          root.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y }));
        },
        { type, x: geo.x, y }
      );
    const flips = () => page.evaluate(() => window.__mem.schemeEvents);
    const scrub = async (until, onEvery) => {
      // up two detents then down two, in 4 px steps a frame apart, until `until()` says stop
      let y = geo.y;
      let dir = -1;
      const span = geo.step * 2.2;
      let lastSample = await flips();
      while (!(await until())) {
        y += dir * 4;
        if (y < geo.y - span) dir = 1;
        if (y > geo.y) dir = -1;
        await fire('pointermove', y);
        await sleep(16);
        const f = await flips();
        if (f - lastSample >= 2) {
          lastSample = f;
          await onEvery(f);
        }
      }
    };
    // 1) held: press, wait out the hold, scrub for FLIPS previews
    const base = await flips();
    await fire('pointerdown', geo.y);
    await sleep(700);
    await sample('engaged'); // held, no preview yet: what the engage alone costs
    await scrub(async () => (await flips()) - base >= FLIPS, (f) => sample(`held ${f - base}`));
    await fire('pointerup', geo.y);
    await sleep(1500);
    await sample('released');
    // 2) a minute of flipping: press, scrub ~1.5 s, release, again
    const end = Date.now() + MINUTE * 1000;
    let cycle = 0;
    while (Date.now() < end) {
      cycle += 1;
      await fire('pointerdown', geo.y);
      await sleep(450);
      const stopAt = Date.now() + 1500;
      await scrub(async () => Date.now() > stopAt, async () => {});
      await fire('pointerup', geo.y);
      await sleep(600);
      if (cycle % 3 === 0) await sample(`minute ${Math.round((MINUTE * 1000 - (end - Date.now())) / 1000)}s`);
    }
    await sleep(2000);
    await sample('end');
    report.flips = (await flips()) - base;
  }
} catch (e) {
  errors.push(`probe: ${String(e).slice(0, 300)}`);
}
report.errors = errors;
report.samples = samples;
// Gate: everything counted, after the baseline. Bytes get a byte tolerance; footprint a generous one
// (WebKit returns malloc lazily), heap a few MiB.
// Not gated, reported only: videoSrc (how many of the FIXED pool's <video>s hold a source: it fills to
// the pool size, and `videos` gates the pool itself) and, under WebKit, mse (MediaSources not yet
// collected: nothing forces a collection there; sourceBuffers and bufferedS gate what they hold).
const KEYS = ['glContexts', 'glLive', 'glTextures', 'glBuffers', 'glPrograms', 'glFramebuffers', 'glTexMiB', 'canvases', 'canvasConn', 'canvasMiB', 'videos', 'videoConn', 'mseOpen', 'sourceBuffers', 'bufferedS', 'objectUrls', 'bitmaps', 'layers', 'nodes', 'footMiB', ...(cdp ? ['heapMiB', 'mse'] : [])];
report.gate = plateauGate(samples, {
  keys: KEYS,
  warm: 1,
  rel: 0.1,
  abs: { glTexMiB: 8, canvasMiB: 8, bufferedS: 10, footMiB: 64, heapMiB: 4, nodes: 20, glBuffers: 4, glTextures: 4 },
});
// The eye's opening step (SQ-133): the footprint's peak over the engage and the held previews, above the
// baseline. The base build stepped +251 to +278 MiB here (WebKit, 402x874 @3: the widget's unregistered var()
// chains re-substituted at every restyle); with them registered (site-scheme.css) +85 to +103. Bound between the two.
// The minute of press-scrub-release cycles still climbs about 1.5 MiB/s on BOTH builds (3-minute A/B, SQ-133): on the
// base the step's own peak hid it from footMiB's plateau; with the step gone the plateau gate reports it.
// Only the eye gesture is gated (--drive=api arms are bisect controls) and only under WebKit, where it was measured.
const gateStep = RUN === 'eye' && DRIVE === 'eye' && ENGINE === 'webkit';
if (gateStep) report.stepGate = stepGate(samples, { key: 'footMiB', max: STEP_MAX, until: 'released' });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nplateau gate: ${report.gate.pass ? 'PASS' : 'FAIL'}${report.gate.failed.length ? ` (${report.gate.failed.join(', ')})` : ''}`);
for (const k of report.gate.failed) console.log(`  ${k}: ${JSON.stringify(report.gate.results[k])}`);
if (gateStep) console.log(`step gate: ${report.stepGate.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(report.stepGate)}`);
if (errors.length) console.log(`errors: ${errors.join(' | ')}`);
await browser.close();
process.exit(report.gate.pass && (!gateStep || report.stepGate.pass) ? 0 : 1);
