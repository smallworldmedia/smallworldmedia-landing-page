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
 *   --run=rounds   Nathan's walk (SQ-136, row 300): home with the globe running, --rounds=6 times: hold the
 *                  eye --hold=3 s scrubbing every station, release, rest --rest=5 s; a sample at the end of
 *                  each hold and after each rest, per-round series in report.rounds, roundGate on the rests
 *                  (--roundabs=24 MiB). --noeye: the same clock with no gesture (the globe's share alone);
 *                  --pophold=60: one world holds (the eye's share alone; popConfig clamps it at 60 s).
 *                  Exits on the round gate. Measured 11-20 on f8a5cf1 (12 rounds, ~8.5 s each, rest MiB
 *                  r2 -> r12): eye + globe 366 -> 522 (+15.6 a round), globe only 333 -> 439 (+10.6; 24
 *                  rounds 334 -> 478, no plateau in 3.5 min), world held r2 -> r8 355 -> 375 (+3.3, about
 *                  0.3 a preview, until the 60 s clamp changes the world); all of it WebKit malloc, and
 *                  --pressure returns both 12-round arms to ~220-270. The eye's one-time opening step
 *                  (+90..+104) is r1's. So the per-round climb is mostly the globe's own world churn.
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
 *   Is the growth reclaimable (SQ-134)? After the run, untouched, reported in report.after and never gated:
 *   --idle=S       a sample every 15 s for S seconds
 *   --churn        ~320 MB of short-lived JS arrays, then a sample: what falls was waiting on the collector
 *   SQ-137 arms (the globe's per-world climb): --nocache (a pass-through route: Playwright turns WebKit's
 *                  resource caching off, so the memory cache's share drops out), --init="js" (a script before any
 *                  page script, after the counters: wrap an API, stub Worker), --softpressure (org.WebKit.lowMemory.begin,
 *                  WebKit's NON-critical pressure: caches and free allocator pages, no forced collection; run before
 *                  --pressure it splits allocator retention from garbage), --midsoft=K (the same soft pressure
 *                  after round K's rest, sampled as `rK soft` and in report.midsoft, then the rounds go on)
 *   SQ-139 arms (committed scheme picks, row 360): --picks=K (after the run's rounds; --run=picks is a fresh page with
 *                  the picks alone, K=3): K commits, each to the station after the committed one, a sample before each
 *                  gesture and --pickrest=5 s after it; report.picks has each step, and `landed`. --pickdrive=eye
 *                  (Nathan's gesture: press, hold, slide up to the target's preview, stand still, release) or api
 *                  (setScheme's commit writes, no gesture: a control). --lead=S: S s of worlds before the first round
 *                  (Nathan's walk: --run=rounds --lead=60 --rounds=6 --picks=3). --mute=globe,lens: a commit reaches
 *                  that swm:scheme listener as a preview (globe: recolorNames; lens: SiteScheme's setActive).
 *                  --pickmax=M gates every pick's step <= M MiB (pickGate). Rounds now record `committed` too:
 *                  a round's release lands where the scrub stood, so rounds COMMIT new schemes (11-21, 6-round
 *                  walks on 6feac4f: 2 to 6 of the 6 did). Measured 11-21 (verification/SQ-139): home's default
 *                  places no name strips (popConfig names: 0), so recolorNames repaints nothing; after the rounds a
 *                  pick steps +7..+18 MiB, the globe's own churn over its 6.5 s, and soft pressure returns it all;
 *                  a fresh page's FIRST change steps once (+110..+123 api commit, +49..+62 api preview, +61..+97
 *                  eye), the commit's extra over a preview being the lens re-render (--mute=lens: +36..+64).
 *   --pressure     WebKit only: `notifyutil -p org.WebKit.lowMemory` twice (WebKit's simulated critical
 *                  memory pressure: a full GC plus cache and allocator release, no sudo), a sample after each
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
import { pickGate, plateauGate, roundGate, stepGate } from './lib/plateauGate.mjs';

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
const IDLE = +arg('idle', 0);
const PRESSURE = arg('pressure', false);
const CHURN = arg('churn', false);
const SOFT = arg('softpressure', false);
const MIDSOFT = +arg('midsoft', 0);
const ROUNDS = +arg('rounds', 6);
const HOLD = +arg('hold', 3);
const REST = +arg('rest', 5);
const NOEYE = arg('noeye', false);
const NOCACHE = arg('nocache', false);
const INIT = arg('init', '');
const POPHOLD = +arg('pophold', 0);
const ROUND_ABS = +arg('roundabs', 24);
const LEAD = +arg('lead', 0);
const PICKS = +arg('picks', RUN === 'picks' ? 3 : 0);
const PICK_DRIVE = arg('pickdrive', 'eye');
const PICK_REST = +arg('pickrest', 5);
const PICK_MAX = +arg('pickmax', 0);
const MUTE = String(arg('mute', '') || '')
  .split(',')
  .filter(Boolean);
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
      committed: window.__swmScheme?.committed ?? null,
      // the cycling sequence tiles (SQ-139 seq arm): tiles bound, on screen, frame refs, cuts since load
      seqTiles: pop?.seq?.tiles ?? null,
      seqFront: pop?.seq?.front ?? null,
      seqRefs: pop?.seq?.refs ?? null,
      seqCuts: pop?.seq?.cuts ?? null,
      strips: window.__swmSchemeDebug?.globe?.().strips ?? null,
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
// --init="js" (SQ-137): a bisect arm's script, run before any page script (after the counters, so it can wrap them).
if (INIT) await ctx.addInitScript({ content: INIT });
// --mute=globe,lens (SQ-139): a COMMIT reaches the named swm:scheme listeners as a preview, so the commit-only
// work behind them is skipped and nothing else changes. Each listener is told apart by the chunk that added it
// (its stack at addEventListener): globe = useGlobeScene's onScheme (the name strips' recolorNames), lens =
// SiteScheme's (setActive: the lens art re-renders). A bisect control, never a fix.
if (MUTE.length)
  await ctx.addInitScript((mute) => {
    // JSC elides the tail call `() => onScheme(fn)` in SiteScheme's effect, so its listener's stack reads
    // onScheme <- React's commit with no SiteScheme frame; on home it is the only such listener (measured).
    const GLOBE = /VideoGlobe\.|useGlobeScene/;
    const RX = { globe: GLOBE, lens: { test: (s) => /SiteScheme\./.test(s) || (!GLOBE.test(s) && /client\.[\w-]+\.js|react-dom/.test(s)) } };
    const wraps = new WeakMap();
    const add = window.addEventListener;
    const remove = window.removeEventListener;
    window.__memMuted = Object.fromEntries(mute.map((m) => [m, 0]));
    window.addEventListener = function (type, fn, ...rest) {
      const stack = type === 'swm:scheme' ? new Error().stack || '' : '';
      if (stack) (window.__memMuted.stacks = window.__memMuted.stacks || []).push(stack.split('\n').slice(1, 4).join(' | ').slice(0, 300));
      const which = stack && typeof fn === 'function' ? mute.find((m) => RX[m]?.test(stack)) : null;
      if (!which) return add.call(this, type, fn, ...rest);
      const w = function (e) {
        if (e.detail && !e.detail.preview) {
          window.__memMuted[which] += 1;
          return fn.call(this, new CustomEvent(e.type, { detail: { ...e.detail, preview: true } }));
        }
        return fn.call(this, e);
      };
      wraps.set(fn, w);
      return add.call(this, type, w, ...rest);
    };
    window.removeEventListener = function (type, fn, ...rest) {
      return remove.call(this, type, wraps.get(fn) || fn, ...rest);
    };
  }, MUTE);
const page = await ctx.newPage();
// --nocache (SQ-137): a pass-through route. Under WebKit, Playwright turns resource caching off for an
// intercepted page (Network.setResourceCachingDisabled), so this arm reads the memory cache's share.
if (NOCACHE) await page.route('**/*', (r) => r.continue());
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

/* ── the eye gesture: its geometry, synthetic touch pointers, and the scrub across its stations ── */
const eyeKit = async () => {
  await page.waitForSelector('.swm-corner[data-ready] .fp-scale', { timeout: 30000 });
  const geo = await page.evaluate(() => {
    const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect();
    const cs = getComputedStyle(document.querySelector('.swm-corner'));
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, step: parseFloat(cs.getPropertyValue('--eye-step')) || 40 };
  });
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
  return { geo, fire, flips, scrub };
};

const report = { argv: process.argv.slice(2), engine: ENGINE, run: RUN, viewport: [VW, VH, DPR], base: BASE };
try {
  const hold = RUN === 'eye' || (RUN === 'rounds' && POPHOLD) ? `&pophold=${RUN === 'eye' ? 60 : POPHOLD}` : '';
  const url = `${BASE}/?popseed=42${hold}${EXTRA}`;
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
  } else if (RUN === 'rounds') {
    // Nathan's walk (row 300): hold the eye ~HOLD s scrubbing through every station, let go, rest; ROUNDS
    // times. A sample at the end of each hold (the round's peak, still held) and after each rest. --noeye
    // is the control arm: the same clock with no gesture, so the globe's share is read on its own.
    const eye = NOEYE ? null : await eyeKit();
    if (LEAD) {
      // --lead=S (SQ-139): Nathan's walk opens with S seconds of worlds before the first round
      await sleep(LEAD * 1000);
      await sample('lead');
    }
    report.rounds = [];
    for (let k = 1; k <= ROUNDS; k += 1) {
      const f0 = eye ? await eye.flips() : 0;
      if (eye) {
        await eye.fire('pointerdown', eye.geo.y);
        await sleep(450);
        const stopAt = Date.now() + HOLD * 1000;
        await eye.scrub(async () => Date.now() > stopAt, async () => {});
      } else await sleep(450 + HOLD * 1000);
      const held = await sample(`r${k} held`);
      if (eye) await eye.fire('pointerup', eye.geo.y);
      await sleep(REST * 1000);
      const rest = await sample(`r${k} rest`);
      const pick = (r) => ({ footMiB: r.footMiB, glTexMiB: r.glTexMiB, glTextures: r.glTextures, canvasMiB: r.canvasMiB, nodes: r.nodes, videos: r.videos, mse: r.mse, footCats: r.footCats, world: r.world, committed: r.committed, strips: r.strips, seqTiles: r.seqTiles, seqFront: r.seqFront, seqRefs: r.seqRefs, seqCuts: r.seqCuts });
      // `committed` (SQ-139): the release lands wherever the scrub stood, so a round can COMMIT a new scheme
      report.rounds.push({ round: k, flips: eye ? (await eye.flips()) - f0 : 0, held: pick(held), rest: pick(rest), committedNew: rest.committed !== held.committed });
      if (k === MIDSOFT && ENGINE === 'webkit') {
        // --midsoft=K (SQ-137): soft pressure after round K, then the rounds go on. A climb that restarts from
        // the low floor is allocator retention refilling; one that resumes from the old height would be live.
        execSync('notifyutil -p org.WebKit.lowMemory.begin');
        await sleep(8000);
        report.midsoft = pick(await sample(`r${k} soft`));
        execSync('notifyutil -p org.WebKit.lowMemory.end');
      }
    }
  } else if (RUN === 'picks') {
    // a fresh page: the baseline, then only the picks below (a commit's own step)
  } else {
    const { geo, fire, flips, scrub } = await eyeKit();
    report.eye = geo;
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
  if (PICKS > 0) {
    // --picks=K (SQ-139, row 360): K committed scheme changes, each to the station after the committed one
    // (project -> black -> blue -> project ...). --pickdrive=eye (default) is Nathan's gesture: press, hold,
    // slide up until the page previews the target, stand still (no flick carry), release there.
    // --pickdrive=api is the bisect control: setScheme's commit writes with no widget gesture. A sample just
    // before each pick and one --pickrest s after it; the pick's step is the difference (report.picks).
    const SCHEMES = ['project', 'black', 'blue'];
    const read = () => page.evaluate(() => ({ applied: document.documentElement.dataset.scheme, committed: window.__swmScheme?.committed }));
    const eye = PICK_DRIVE === 'eye' ? await eyeKit() : null;
    report.picks = [];
    for (let k = 1; k <= PICKS; k += 1) {
      const from = (await read()).committed || 'project';
      const target = SCHEMES[(SCHEMES.indexOf(from) + 1) % SCHEMES.length];
      const pre = await sample(`pick ${k} pre`);
      if (eye) {
        let y = eye.geo.y;
        await eye.fire('pointerdown', y);
        await sleep(450);
        for (let n = 0; n < 200 && (await read()).applied !== target; n += 1) {
          y -= 4;
          await eye.fire('pointermove', y);
          await sleep(16);
        }
        for (let n = 0; n < 3; n += 1) {
          y -= 4; // a little past the crossing, so the landing rounds onto the target
          await eye.fire('pointermove', y);
          await sleep(16);
        }
        await sleep(150);
        await eye.fire('pointerup', y);
      } else {
        // api: the commit's writes. preview: a preview's writes only (applied + attribute + event), held, the
        // control that splits what a COMMIT adds from what any scheme change costs (`committed` is also moved,
        // probe-side only, so the next pick advances).
        await page.evaluate(
          ({ name, preview }) => {
            const s = window.__swmScheme;
            const prev = document.documentElement.dataset.scheme;
            if (s) s.applied = s.committed = name;
            document.documentElement.dataset.scheme = name;
            if (!preview) {
              try {
                localStorage.setItem('swm:scheme', name);
              } catch {
                /* blocked */
              }
            }
            window.dispatchEvent(new CustomEvent('swm:scheme', { detail: { scheme: name, prev, preview } }));
          },
          { name: target, preview: PICK_DRIVE === 'preview' }
        );
      }
      await sleep(PICK_REST * 1000);
      const post = await sample(`pick ${k}`);
      const keep = (r) => ({ footMiB: r.footMiB, glTexMiB: r.glTexMiB, glTextures: r.glTextures, canvasMiB: r.canvasMiB, canvases: r.canvases, nodes: r.nodes, strips: r.strips, seqFront: r.seqFront, seqCuts: r.seqCuts, footCats: r.footCats, world: r.world });
      const d = (key) => (typeof post[key] === 'number' && typeof pre[key] === 'number' ? Math.round((post[key] - pre[key]) * 10) / 10 : null);
      report.picks.push({ pick: k, from, target, committed: post.committed, landed: post.committed === target, step: d('footMiB'), stripsRepainted: d('strips'), glTexStep: d('glTexMiB'), canvasStep: d('canvasMiB'), pre: keep(pre), post: keep(post) });
    }
    report.muted = MUTE.length ? await page.evaluate(() => window.__memMuted) : null;
  }
  // After the run, untouched (SQ-134): is what it grew reclaimable? Idle samples, then WebKit's own
  // simulated critical memory pressure (WTF's MemoryPressureHandler listens for org.WebKit.lowMemory:
  // a full GC plus cache and allocator release, no sudo). Reported in report.after, never gated.
  const ran = samples.length;
  for (let s = 15; s <= IDLE; s += 15) {
    await sleep(15000);
    await sample(`idle ${s}s`);
  }
  if (CHURN) {
    // short-lived JS garbage, enough to drive the collector's full cycles: what falls here was JS garbage
    await page.evaluate(async () => {
      for (let i = 0; i < 40; i += 1) {
        let a = new Array(1 << 20).fill(i);
        a = null;
        await new Promise((r) => setTimeout(r, 50));
      }
    });
    await sleep(8000);
    await sample('churn');
  }
  if (SOFT && ENGINE === 'webkit') {
    // --softpressure (SQ-137): WebKit's simulated NON-critical pressure (org.WebKit.lowMemory.begin: caches
    // released, no forced collection), held 8 s, then ended. Run before --pressure, it splits caches from GC.
    execSync('notifyutil -p org.WebKit.lowMemory.begin');
    await sleep(8000);
    await sample('soft pressure');
    execSync('notifyutil -p org.WebKit.lowMemory.end');
  }
  if (PRESSURE && ENGINE === 'webkit') {
    for (let k = 1; k <= 2; k += 1) {
      execSync('notifyutil -p org.WebKit.lowMemory');
      await sleep(8000);
      await sample(`pressure ${k}`);
    }
  }
  report.after = samples.splice(ran);
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
// SQ-134: that climb is reclaimable, not a leak. It is all "WebKit malloc"; idle does not return it and JS churn
// (--churn) does not either, but WebKit's simulated pressure (--pressure) takes the footprint back to `released`
// or below (3 min: peak 666, after pressure 316, released 336; 1 min: 430 -> 212, under the 244 baseline). So
// footMiB's plateau FAILS a 3-minute eye run on garbage; how the gate should read it is Nathan's call (SQ-134 report).
// A run past ?pophold's 60 s clamp also changes worlds, so glTexMiB then fails on the globe's own churn.
// Only the eye gesture is gated (--drive=api arms are bisect controls) and only under WebKit, where it was measured.
const gateStep = RUN === 'eye' && DRIVE === 'eye' && ENGINE === 'webkit';
if (gateStep) report.stepGate = stepGate(samples, { key: 'footMiB', max: STEP_MAX, until: 'released' });
// --run=rounds (SQ-136): the resting footprint after each round must plateau. Tighter than the run gate's 64:
// a climb of k MiB a round shows as about k x rounds/2, so --roundabs (default 24) catches ~8 MiB a round over 6.
const gateRounds = RUN === 'rounds' && report.rounds?.length;
if (gateRounds) report.roundGate = roundGate(report.rounds, { footAbs: ROUND_ABS });
// --picks with --pickmax=M (SQ-139): every pick lands on its target and steps <= M MiB over its pre-pick sample.
const gatePicks = PICK_MAX > 0 && PICKS > 0;
if (gatePicks) report.pickGate = pickGate(report.picks, { max: PICK_MAX });
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nplateau gate: ${report.gate.pass ? 'PASS' : 'FAIL'}${report.gate.failed.length ? ` (${report.gate.failed.join(', ')})` : ''}`);
for (const k of report.gate.failed) console.log(`  ${k}: ${JSON.stringify(report.gate.results[k])}`);
if (gateStep) console.log(`step gate: ${report.stepGate.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(report.stepGate)}`);
if (gateRounds) {
  for (const r of report.rounds) console.log(`round ${r.round}: flips ${r.flips} · held ${r.held.footMiB} · rest ${r.rest.footMiB} MiB · tex ${r.rest.glTexMiB} · seq ${r.rest.seqFront}/${r.rest.seqCuts} · ${r.rest.world ?? ''}`);
  console.log(`round gate: ${report.roundGate.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(report.roundGate.results.footMiB)}`);
}
for (const p of report.picks || [])
  console.log(`pick ${p.pick}: ${p.from} -> ${p.target} (${p.landed ? 'landed' : `MISSED: ${p.committed}`}) · step ${p.step} MiB · strips +${p.stripsRepainted} · tex ${p.glTexStep} · canvas ${p.canvasStep} · ${p.post.world ?? ''}`);
if (gatePicks) console.log(`pick gate: ${report.pickGate.pass ? 'PASS' : 'FAIL'} ${JSON.stringify(report.pickGate)}`);
if (errors.length) console.log(`errors: ${errors.join(' | ')}`);
await browser.close();
// --run=rounds exits on its round gate: its run-wide plateau also reads the globe's world churn (glTexMiB).
// --run=picks exits on its pick gate (with --pickmax; else on the plateau gate, like every other run).
const runPass = gateRounds ? report.roundGate.pass : RUN === 'picks' && gatePicks ? true : report.gate.pass;
process.exit(runPass && (!gateStep || report.stepGate.pass) && (!gatePicks || report.pickGate.pass) ? 0 : 1);
