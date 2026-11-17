// SQ-113 scheme-flip memory probe: what grows WebKit's page process on each scheme change.
//
// One ARM per invocation, each in a fresh browser, so its process memory starts clean:
//   ~/swm-probe-lock.sh node scripts/lib/scheme-leak-probe.mjs <arm> [engine=webkit] [n=200]
// Needs a dev server on BASE (default http://localhost:4330, `astro dev --port 4330`).
// Writes <OUT>/arm-<arm>-<engine>-<n>.json (OUT defaults to the cwd).
//
// Every arm is injected by the probe; no source is edited:
//   variant  full  = colorScheme.setScheme (attribute + event, what the widget does)
//            attr  = html[data-scheme] only, no event
//            event = the swm:scheme event only, no attribute change
//   stub     a regex over the subscriber's registration stack: matching swm:scheme
//            listeners are registered as no-ops (e.g. useGlobeScene, SiteScheme)
//   css      a stylesheet appended after load
//   page     '/', '/privacy', or 'min-css' / 'min-dom' (a routed page holding the site's
//            CSS text and nothing else / plus /privacy's static DOM, no scripts or islands)
//
// Reads, after a forced collection (CDP on Chromium; allocation pressure on WebKit, which
// exposes no GC hook): phys_footprint of each new browser process (macOS `footprint`, the
// figure iOS jetsam acts on) with the WebContent process's top categories, RSS, the JS heap
// (Chromium), three.js renderer.info through __swmSchemeDebug, canvas and DOM counts.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright');
const BASE = process.env.BASE || 'http://localhost:4330';
const OUT = process.env.OUT || process.cwd();
const HOME = '/?popmode=off&popseed=42&intro=replay';
const TRANS_NONE = '*,*::before,*::after{transition:none!important}';
// global.css's element-local ink transitions (color / fill / border-color on the nav, lockup and
// the ink consumers further down): every selector whose transition is the --ink-fade chain.
const INK_OFF = 'ELEMENT_LOCAL_INK';
const HTML_PROP_OFF = 'html{transition:none!important}';

const ARMS = {
  'idle': { page: HOME, idle: true },
  'full': { page: HOME, variant: 'full' },
  'attr': { page: HOME, variant: 'attr' },
  'event': { page: HOME, variant: 'event' },
  'event-noglobe': { page: HOME, variant: 'event', stub: 'useGlobeScene' },
  // JSC elides tail-call frames (modules are strict), so SiteScheme's `useEffect(() => onScheme(...))`
  // registers with no /src/ frame but colorScheme.js and tags as '(unknown)'.
  'event-nowidget': { page: HOME, variant: 'event', stub: 'SiteScheme|\\(unknown\\)' },
  'event-nolisteners': { page: HOME, variant: 'event', stub: '.' },
  // The widget's own layers, with the widget's listener live: its window mask
  // (site-scheme.css, a multi-layer mask-image with the lid as an SVG data URL), the iris clip-paths.
  'event-widget-nomask': { page: HOME, variant: 'event', css: '.swm-corner,.swm-corner *{-webkit-mask-image:none!important;mask-image:none!important}' },
  'event-widget-noclip': { page: HOME, variant: 'event', css: '.swm-corner *{clip-path:none!important}' },
  'event-widget-notransitions': { page: HOME, variant: 'event', css: '.swm-corner,.swm-corner *,.swm-corner *::before,.swm-corner *::after{transition:none!important;animation:none!important}' },
  // prefers-reduced-motion: the pager engine's follow() snaps (stepRM) instead of gliding on gsap.ticker.
  'event-reduced': { page: HOME, variant: 'event', reduced: true },
  'event-widget-hidden': { page: HOME, variant: 'event', css: '.swm-corner{display:none!important}' },
  'full-schemeui0': { page: `${HOME}&schemeui=0`, variant: 'full' },
  'full-schemeui0-notransitions': { page: `${HOME}&schemeui=0`, variant: 'full', css: TRANS_NONE },
  'full-schemeui0-noink': { page: `${HOME}&schemeui=0`, variant: 'full', css: INK_OFF },
  'full-schemeui0-nohtmlprops': { page: `${HOME}&schemeui=0`, variant: 'full', css: HTML_PROP_OFF },
  'full-notransitions':{ page: HOME, variant: 'full', css: TRANS_NONE },
  'full-noink': { page: HOME, variant: 'full', css: INK_OFF },
  'full-nohtmlprops': { page: HOME, variant: 'full', css: HTML_PROP_OFF },
  'privacy-attr': { page: '/privacy', variant: 'attr' },
  'privacy-idle': { page: '/privacy', idle: true },
  'min-css-attr': { page: 'min-css', variant: 'attr' },
  'min-dom-attr': { page: 'min-dom', variant: 'attr' },
  'min-dom-idle': { page: 'min-dom', idle: true },
  'min-dom-attr-notransitions': { page: 'min-dom', variant: 'attr', css: TRANS_NONE },
};

const [armName, engine = 'webkit', nArg = '200'] = process.argv.slice(2);
const arm = ARMS[armName];
if (!arm) {
  console.error(`unknown arm ${armName}; arms: ${Object.keys(ARMS).join(' ')}`);
  process.exit(2);
}
const N = Number(nArg);
const CHECK = [10, 50, 100, 200, 300, 400, 500, 600].filter((c) => c <= N);
const VW = Number(process.env.VW || 390);
const VH = Number(process.env.VH || 844);
const DSF = Number(process.env.DSF || 3);
const mobile = VW < 768;
const procMatch = `ms-playwright/${engine}`;

const ps = () => {
  const out = execSync('ps -axo pid=,rss=,command=', { encoding: 'utf8', maxBuffer: 1 << 24 });
  const rows = [];
  for (const l of out.split('\n')) {
    const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\S+)/);
    if (m && m[3].includes(procMatch)) rows.push({ pid: +m[1], rssKb: +m[2], name: m[3].split('/').pop() });
  }
  return rows;
};

const footprint = (pid) => {
  try {
    const out = execSync(`footprint -p ${pid} -f bytes`, { encoding: 'utf8', maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'ignore'] });
    const total = out.match(/Footprint:\s+(\d+)\s+B/);
    const cats = [];
    for (const l of out.split('\n')) {
      const m = l.trim().match(/^(\d+)\s+B\s+(\d+)\s+B\s+(\d+)\s+B\s+(\d+)\s+(.+)$/);
      if (m) cats.push({ cat: m[5].trim(), dirtyMiB: +(+m[1] / 1048576).toFixed(1) });
    }
    return { totalMiB: total ? +(+total[1] / 1048576).toFixed(1) : null, cats: cats.slice(0, 12) };
  } catch {
    return null;
  }
};

const mkCtx = async (browser) =>
  browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: DSF,
    isMobile: mobile && engine !== 'firefox',
    hasTouch: mobile,
    reducedMotion: arm.reduced ? 'reduce' : 'no-preference',
  });

// The routed minimal page: /privacy's CSS text (and optionally its static DOM), no scripts.
async function minHtml(withDom) {
  const b = await pw[engine].launch({ headless: true });
  const c = await mkCtx(b);
  const p = await c.newPage();
  await p.goto(`${BASE}/privacy`, { waitUntil: 'load' });
  await p.waitForTimeout(3000);
  const got = await p.evaluate(() => {
    let css = '';
    for (const s of document.styleSheets) {
      try {
        for (const r of s.cssRules) css += `${r.cssText}\n`;
      } catch {
        /* cross-origin sheet */
      }
    }
    const body = document.body.cloneNode(true);
    body.querySelectorAll('script,astro-island,canvas,iframe,video,noscript').forEach((n) => n.remove());
    return { css, body: body.innerHTML, bodyClass: document.body.className, htmlClass: document.documentElement.className };
  });
  await b.close();
  const body = withDom ? got.body : '<main><h1>Minimal</h1><p>The site CSS, no islands.</p></main>';
  return `<!doctype html><html lang="en" class="${got.htmlClass}" data-scheme="project"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${got.css}</style></head><body class="${got.bodyClass}">${body}</body></html>`;
}

const routed = arm.page.startsWith('min-') ? await minHtml(arm.page === 'min-dom') : null;
const before = new Set(ps().map((r) => r.pid));
const browser = await pw[engine].launch({ headless: true });
const ctx = await mkCtx(browser);
await ctx.addInitScript(
  ([stub]) => {
    const c = (window.__leak = { canvases: 0, listeners: [], observers: [], stubbed: 0 });
    const ce = Document.prototype.createElement;
    Document.prototype.createElement = function (t, o) {
      if (String(t).toLowerCase() === 'canvas') c.canvases += 1;
      return ce.call(this, t, o);
    };
    const tagOf = (stack) => {
      const files = (stack.match(/\/src\/[^\s:)?]+/g) || []).filter((f) => !f.endsWith('colorScheme.js'));
      return files[0] || '(unknown)';
    };
    const ael = window.addEventListener;
    window.addEventListener = function (type, fn, opts) {
      if (type === 'swm:scheme') {
        const tag = tagOf(String(new Error().stack));
        const stubbed = !!(stub && new RegExp(stub).test(tag));
        c.listeners.push({ tag, stubbed });
        if (stubbed) {
          c.stubbed += 1;
          return ael.call(this, type, () => {}, opts);
        }
      }
      return ael.call(this, type, fn, opts);
    };
    const obs = MutationObserver.prototype.observe;
    MutationObserver.prototype.observe = function (target, o) {
      if (target === document.documentElement && o?.attributes) {
        c.observers.push({ tag: tagOf(String(new Error().stack)), filter: o.attributeFilter || null });
      }
      return obs.call(this, target, o);
    };
  },
  [arm.stub || null]
);
if (routed) await ctx.route(`${BASE}/__sq113-min`, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: routed }));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const cdp = engine === 'chromium' ? await ctx.newCDPSession(page) : null;
await page.goto(`${BASE}${routed ? '/__sq113-min' : arm.page}`, { waitUntil: 'load' });
if (arm.page.startsWith('/?')) {
  await page.waitForFunction(() => window.__swmSchemeDebug?.globe, null, { timeout: 90000 });
}
await page.waitForTimeout(12000); // intro + settle
if (arm.css) {
  let css = arm.css;
  if (css === INK_OFF) {
    css = await page.evaluate(() => {
      const sels = [];
      const walk = (rules) => {
        for (const r of rules) {
          if (r.cssRules && !r.selectorText) walk(r.cssRules);
          else if (r.style && /--ink-fade/.test(r.style.transition || '')) sels.push(r.selectorText);
        }
      };
      for (const s of document.styleSheets) {
        try {
          walk(s.cssRules);
        } catch {
          /* cross-origin */
        }
      }
      return `${sels.join(',\n')}{transition:none!important}`;
    });
  }
  await page.addStyleTag({ content: css });
}
if (arm.variant === 'full') await page.evaluate(async () => { window.__cs = await import('/src/lib/colorScheme.js'); });

const ours = () => ps().filter((r) => !before.has(r.pid));
const read = async (n) => {
  let heap = null;
  // Before the collection too: the pressure's own garbage sits in WebKit malloc until the
  // scavenger returns it, so a reading taken too soon after it carries a random offset.
  const pre = {};
  for (const r of ours()) if (/WebContent/.test(r.name)) pre.contentFootMiB = footprint(r.pid)?.totalMiB ?? null;
  if (cdp) {
    await cdp.send('HeapProfiler.collectGarbage');
    await cdp.send('HeapProfiler.collectGarbage');
    heap = +((await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576).toFixed(2);
  } else {
    await page.evaluate(async () => {
      for (let k = 0; k < 3; k++) {
        let a = [];
        for (let i = 0; i < 2e6; i++) a.push({ i, s: `x${i}` });
        a = null;
        await new Promise((r) => setTimeout(r, 400));
      }
    });
    await page.waitForTimeout(Number(process.env.SETTLE_MS || 3000));
  }
  await page.waitForTimeout(600);
  const dom = await page.evaluate(() => {
    const g = window.__swmSchemeDebug?.globe ? window.__swmSchemeDebug.globe() : {};
    return { gl: g.gl || null, liveCanvases: document.querySelectorAll('canvas').length, dom: document.getElementsByTagName('*').length, canvasesCreated: window.__leak.canvases, scheme: document.documentElement.dataset.scheme };
  });
  const procs = {};
  let content = null;
  for (const r of ours()) {
    const f = footprint(r.pid);
    const k = r.name.replace(/^com\.apple\.WebKit\./, '').replace(/\.Development$/, '');
    procs[k] = { rssMiB: Math.round(r.rssKb / 1024) + (procs[k]?.rssMiB || 0), footMiB: (f?.totalMiB || 0) + (procs[k]?.footMiB || 0) };
    if (/WebContent|renderer/i.test(k) || (engine === 'chromium' && r.name === 'Chromium Helper (Renderer)')) content = f;
  }
  return { n, heapMiB: heap, pre, procs, contentCats: content?.cats || null, ...dom, t: Date.now() };
};

const SCH = ['project', 'black', 'blue'];
const rows = [];
let changes = 0;
const step = async (name, preview) => {
  if (arm.idle) {
    await page.waitForTimeout(preview ? 70 : 260);
    changes += 1;
    return;
  }
  const changed = await page.evaluate(
    ([s, p, v]) => {
      const root = document.documentElement;
      const was = root.dataset.scheme;
      const st = window.__swmScheme;
      if (v === 'attr') {
        root.dataset.scheme = s;
        if (st) st.applied = s;
        return was !== s;
      }
      if (v === 'event') {
        if (st) st.applied = s;
        window.dispatchEvent(new CustomEvent('swm:scheme', { detail: { scheme: s, prev: was, preview: p } }));
        return true;
      }
      window.__cs.setScheme(s, { preview: p });
      return was !== window.__cs.getScheme() || !p;
    },
    [name, preview, arm.variant]
  );
  if (changed) changes += 1;
  await page.waitForTimeout(preview ? 70 : 260);
};
let i = 0;
while (changes < N) {
  const nxt = SCH[(i + 1) % 3];
  const other = SCH[(i + 2) % 3];
  // a scrub (preview the two others, back), then commit
  await step(nxt, true);
  await step(other, true);
  await step(nxt, true);
  await step(nxt, false);
  i += 1;
  for (const c of CHECK) if (changes >= c && !rows.find((r) => r.c === c)) rows.push({ c, ...(await read(changes)) });
}
const meta = await page.evaluate(() => ({ listeners: window.__leak.listeners, observers: window.__leak.observers, stubbed: window.__leak.stubbed }));
const res = { arm: armName, def: arm, engine, vw: VW, vh: VH, dsf: DSF, n: N, meta, rows, errors: errors.slice(0, 5) };
fs.writeFileSync(`${OUT}/arm-${armName}-${engine}-${VW}-${N}.json`, JSON.stringify(res, null, 2));
const key = engine === 'webkit' ? 'WebContent' : null;
console.log(
  JSON.stringify({
    arm: armName,
    engine,
    listeners: meta.listeners,
    rows: rows.map((r) => ({ n: r.n, pre: r.pre.contentFootMiB, content: key ? r.procs[key] : r.procs, heap: r.heapMiB, tex: r.gl?.textures, geo: r.gl?.geometries, canv: r.canvasesCreated, dom: r.dom })),
  })
);
await browser.close();
