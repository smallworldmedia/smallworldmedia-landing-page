#!/usr/bin/env node
/**
 * scheme-probe — the acceptance matrix of the US-7 colour schemes (project | black | blue | spectrum).
 * For each scheme x route x width it loads `<path>?scheme=<name>`, waits for every client:load island
 * to commit, dumps the painted colours of every visible non-media element (and its ::before/::after),
 * and runs the gates of scripts/lib/scheme-gate.mjs over the dump (pure functions, unit-tested in
 * scripts/test/scheme-gate.test.mjs). It changes nothing in the site.
 *
 * Usage:
 *   ~/swm-probe-lock.sh node scripts/scheme-probe.mjs --base=http://localhost:4330 --scheme=black
 *        [--routes=home,work,detail,directory,privacy,404] [--width=1440|390] [--gates=a,b,c]
 *        [--capture=FILE] [--compare=FILE] [--shots=DIR] [--force-attr] [--ignore=CSS-SELECTOR]
 *   --scheme   project | black | blue | spectrum | all   (default project)
 *   --routes   default all. detail = the first /work card's slug, plus card 3's (the cross-route check).
 *   --details  sample (default: cards 1 and 3) | all (every /work card's detail page). The uniform gate
 *              compares the detail pages it is given (two or more). The shares gate sums them: it SKIPs
 *              unless --details=all (two pages cannot show the proportions of the whole), and then prints
 *              one INFO line per page (that page's own shares) above the verdict.
 *   --width    1440 | 390 (default both)
 *   --gates    latch,identity,monochrome,singleHue,contrast,carriers,deal,hover,overlap,shares,uniform,
 *              density,outline,gl
 *              default per scheme: project latch,overlap,gl | black latch,monochrome,contrast,
 *              carriers,hover,overlap,gl | blue latch,singleHue,contrast,carriers,hover,overlap,gl |
 *              spectrum latch,contrast,hover,overlap,uniform,density,outline,gl. --compare adds identity.
 *              carriers, deal and shares (the first spectrum skin's per-project deal) stay available by name.
 *   --density  the density gate's threshold, replacing the 5 of home, work, detail and directory (privacy
 *              and 404 keep 3). Both numbers are PROPOSALS: Nathan sets them.
 *   --capture  write the dump JSON (every page's style dump, carriers, hover fingerprints, boxes)
 *   --compare  run identity of this run against a capture (same scheme, routes, widths)
 *   --shots    save a full-page screenshot per page under DIR (never commit them). When Chrome refuses
 *              a tall capture the viewport is saved instead, the page WARNs, its gates still run, and
 *              the probe restarts its browser (a refusal blocks WebGL for the pages that follow).
 *   --force-attr  the probe sets html[data-scheme] itself in an init script instead of reading the
 *              site's, to validate the tool before the core lands; every line says "forced".
 *
 * Output: one line per gate per route per width (PASS / FAIL / SKIP, offender count), the first 15
 * offenders of each failure, a final summary line. Exit 1 when any gate fails, 0 otherwise.
 *
 * CAPTURE BEFORE YOU EDIT: identity compares two captures from the SAME worktree, never a committed
 * fixture, because Sanity content is live. Capture `--scheme=project`, change the code, then run
 * `--scheme=project --compare=<that capture>`.
 *
 * ONE PROBE AT A TIME, machine-wide: `~/swm-probe-lock.sh node scripts/scheme-probe.mjs ...`.
 * Serve the worktree only on a Sanity CORS origin: localhost:4330, localhost:4321 or 127.0.0.1:4399
 * (check `lsof -iTCP:<port> -sTCP:LISTEN` first); any other origin renders Sanity images black.
 * Never build in a checkout whose dev server is running. Playwright is not a project dependency:
 * PLAYWRIGHT_PATH or the path below. Headless Chromium runs with swiftshader for the WebGL scenes.
 *
 * Deterministic pages (the media-cache / hydration-gate recipe): reduced motion; every stream.mux.com
 * request aborted (posters only); cdn.sanity.io and image.mux.com bodies replayed from a disk cache
 * (os.tmpdir()/swm-scheme-probe-cache, keyed by URL) and HELD until every client:load island's React
 * root has committed (a stub devtools hook records the roots; the SSR'd `ssr` attribute alone releases
 * too early and an img that loaded before commit never fires onLoad). The dump is re-read until two
 * consecutive reads agree. The directory is read at ?dirorder=project (the default order shuffles) and the
 * home page at ?popseed=1 (the globe's start world, which tints the whole page, is random per visit).
 * Hover is measured on desktop widths only (forced :hover through CDP): the site's hover rules sit
 * behind (hover: hover), so a phone has none to measure. Hover is not a default project gate.
 *
 * What is dumped: color (elements with their own text), background-color, the four border colours,
 * outline-color, fill/stroke (SVG shapes), stop-color, text-decoration-color, the colour stops of any
 * gradient, box-shadow colours; only painted ones. img, video, canvas, picture, iframe, [data-logo]
 * and the logo ticker's svg are media: left out, and text over them is not contrast-measured. The
 * widget (.swm-corner, or --ignore) is left out of the dump so identity compares the page without it.
 * Elements are keyed by a stable path (tag.classes:nth-of-type chain).
 *
 * The spectrum gates (wave 4: no colour per project; every component wears the palette inside itself):
 *   uniform  the same element paints the same colour on every project. The dumps of the detail pages
 *            (project pages: cards 1 and 3, or every card with --details=all) must agree on every element
 *            path they all share, media aside; paths only some pages have are skipped and counted on an
 *            INFO line. /work itself is not compared: it opens on its first card and no URL picks another
 *            (the start card is read from sessionStorage, written by input), so only project pages are.
 *   density  per page, how many palette families are painted: the six swatches, white-ground and the
 *            ramp A gradient (>= 3 of its nine stops, read from src/lib/spectrumRamp.js, else
 *            --swm-ramp-a in src/styles/global.css). Needs 5 on home, work, detail and directory, 3 on
 *            privacy and 404 (PROPOSED). The families found print on every page, PASS or FAIL.
 *   outline  the ring and the canvas agree: globe().ramp.mix is 1 on home, worlds().ramp.mix is 1 on
 *            /work, and globe().ramp.center is within 1.5 px of the centre of .hero__globe-stroke
 *            (measured in the page). A hook with no `ramp` field SKIPs ("skipped (hook has no ramp)").
 *            Under any other scheme, when named, the mix must be 0.
 * The old spectrum expectations (carriers, deal, shares) come from a dynamic import of
 * ../src/lib/colorScheme.js, and only run when named; when it is absent they print
 * "skipped: colorScheme.js not present" and do not fail.
 * gl reads window.__swmSchemeDebug (an object of functions, e.g. { globe(), worlds() }, each returning
 * { accent: '#rrggbb', ... }) and prints it; absent prints "gl: skipped (no debug hook)".
 * A measurement tool with a verdict: exits 1 when a gate fails.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as gate from './lib/scheme-gate.mjs';
import { countFamilies } from './palette-measure.mjs';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (msg) => {
  console.error(`scheme-probe: ${msg}`);
  process.exit(2);
};

const SCHEMES = ['project', 'black', 'blue', 'spectrum'];
// home: ?popseed pins the globe population's start world, whose projectColor tints the whole home page (random per visit).
const ROUTE_PATHS = { home: '/?popseed=1', work: '/work/', directory: '/work/directory/?dirorder=project', privacy: '/privacy/', 404: '/404/' };
const ROUTE_NAMES = ['home', 'work', 'detail', 'directory', 'privacy', '404'];
const GATE_NAMES = ['latch', 'identity', 'monochrome', 'singleHue', 'contrast', 'carriers', 'deal', 'hover', 'overlap', 'shares', 'uniform', 'density', 'outline', 'gl'];
const DEFAULT_GATES = {
  project: ['latch', 'overlap', 'gl'], // hover is not a project gate: today's site has hover states that paint nothing (the nav pill's is hover:hover only)
  black: ['latch', 'monochrome', 'contrast', 'carriers', 'hover', 'overlap', 'gl'],
  blue: ['latch', 'singleHue', 'contrast', 'carriers', 'hover', 'overlap', 'gl'],
  spectrum: ['latch', 'contrast', 'hover', 'overlap', 'uniform', 'density', 'outline', 'gl'], // carriers, deal and shares described the first skin's per-project deal: by name only
};
const RING = '.hero__globe-stroke'; // the DOM ring round the home globe: the outline gate's centre
const OUTLINE_HOOK = { home: 'globe', work: 'worlds' }; // the debug hook whose canvas draws the outline on that route
const HOVER_SELECTORS = ['.site-nav__pill', '.cta-primary', '.deck-tab', '.site-privacy', '.fp-cta', '.prose-link'];
const ANCHOR = '.swm-corner';
const OVERLAP_SELECTORS = [ANCHOR, '.site-privacy', '.fp .fp-scale', '.dir-filter', '.site-footer--links', '.fp-cta', '.np-band__title'];
const MEDIA_SEL = 'img, video, canvas, picture, iframe, object, embed, [data-logo], .logo-ticker svg';
const HOVER_MS = 900;
const MAX_READS = 10;
const READ_MS = 700;
const BAD_CORE = 'colorScheme.js not present';

const BASE = String(arg('base', process.env.GLOBE_PROBE_BASE) || '').replace(/\/$/, '');
if (!BASE || BASE === 'true') die('--base=http://localhost:4330 is required (or GLOBE_PROBE_BASE)');
const schemeArg = String(arg('scheme', 'project'));
const SCHEME_LIST = schemeArg === 'all' ? SCHEMES : schemeArg.split(',');
if (SCHEME_LIST.some((s) => !SCHEMES.includes(s))) die(`--scheme takes ${SCHEMES.join('|')}|all`);
const ROUTES = arg('routes', 'all') === 'all' ? ROUTE_NAMES : String(arg('routes')).split(',');
if (ROUTES.some((r) => !ROUTE_NAMES.includes(r))) die(`--routes takes ${ROUTE_NAMES.join(',')}`);
const SHARE_TILE = 4000; // CSS px of page height per masked capture (the shares gate)
const DETAILS = String(arg('details', 'sample'));
if (!['sample', 'all'].includes(DETAILS)) die('--details takes sample|all');
const WIDTHS = arg('width') ? String(arg('width')).split(',').map(Number) : [1440, 390];
if (WIDTHS.some((w) => !(w > 0))) die('--width takes numbers, e.g. 1440 or 390');
const GATES_ARG = arg('gates') ? String(arg('gates')).split(',') : null;
if (GATES_ARG?.some((g) => !GATE_NAMES.includes(g))) die(`--gates takes ${GATE_NAMES.join(',')}`);
const CAPTURE = typeof arg('capture') === 'string' ? arg('capture') : null;
const COMPARE = typeof arg('compare') === 'string' ? arg('compare') : null;
const DENSITY = arg('density') === undefined ? undefined : Number(arg('density') === true ? NaN : arg('density'));
if (DENSITY !== undefined && !(DENSITY > 0)) die('--density takes a positive number, e.g. --density=4');
const SHOTS = typeof arg('shots') === 'string' ? arg('shots') : null;
const FORCE = !!arg('force-attr', false);
const IGNORE_SEL = typeof arg('ignore') === 'string' ? arg('ignore') : ANCHOR;

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium } = require(PW);

// ── in the page ─────────────────────────────────────────────────────────────────────────────

/** Init script: record every React root's container, and answer "has every client:load island committed?". */
function hydrationHook() {
  const roots = new Set();
  window.__swmRoots = roots;
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject() { return 1; },
      checkDCE() {},
      onScheduleFiberRoot() {},
      onCommitFiberRoot(id, root) { if (root && root.containerInfo) roots.add(root.containerInfo); },
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
    };
  }
  window.__swmCommitted = () =>
    document.readyState !== 'loading' &&
    [...document.querySelectorAll('astro-island[client="load"], astro-island[client="only"]')].every((i) => roots.has(i));
}

/** Init script (--force-attr): put html[data-scheme] on the document as soon as it exists, and keep it. */
function forceAttr(name) {
  const set = () => {
    const h = document.documentElement;
    if (h && h.getAttribute('data-scheme') !== name) h.setAttribute('data-scheme', name);
    return !!h;
  };
  if (!set()) {
    const mo = new MutationObserver(() => {
      if (set()) {
        mo.disconnect();
        new MutationObserver(set).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
      }
    });
    mo.observe(document, { childList: true });
  } else {
    new MutationObserver(set).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  }
}

/**
 * Walk the page (or, with `scope`, the first visible match of a selector) and return its painted
 * colours: { els: { path: { paint, text?, media? } }, carriers, vars } — carriers and vars only for a
 * whole-page walk. Self-contained: it is serialised into the page.
 */
function pageDump({ ignoreSel, mediaSel, scope, mark }) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'BASE']);
  const GRAPHIC = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'use']);
  const COLOUR_RE = /(?:rgba?|color|oklab|oklch|lab|lch|hsla?|hwb)\([^)]*\)/g;
  const clear = (c) => !c || c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  const els = {};
  const pathOf = new WeakMap();
  const mediaRects = [...document.querySelectorAll(mediaSel)]
    .map((m) => m.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  const hasText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  };
  const clsOf = (el) => (el.getAttribute('class') || '').split(/\s+/).filter((c) => c && !/^astro-/.test(c)).join('.');
  const onMedia = (r) => {
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return mediaRects.some((m) => x >= m.left && x <= m.right && y >= m.top && y <= m.bottom);
  };
  function paintOf(cs, o) {
    const p = {};
    const put = (k, v) => { if (!clear(v)) p[k] = v; };
    if (o.svg) {
      if (o.graphic) {
        if (cs.fill !== 'none') put('fill', cs.fill);
        if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) put('stroke', cs.stroke);
      }
    } else if (o.text) {
      put('color', cs.color);
      const tf = cs.getPropertyValue('-webkit-text-fill-color');
      if (tf && tf !== cs.color) put('text-fill', tf);
    }
    if (o.text && cs.textDecorationLine && cs.textDecorationLine !== 'none') put('text-decoration-color', cs.textDecorationColor);
    put('background-color', cs.backgroundColor);
    for (const s of ['top', 'right', 'bottom', 'left']) {
      const st = cs.getPropertyValue(`border-${s}-style`);
      if (st !== 'none' && st !== 'hidden' && parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0) put(`border-${s}-color`, cs.getPropertyValue(`border-${s}-color`));
    }
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) put('outline-color', cs.outlineColor);
    let urlBg = false;
    const bi = cs.backgroundImage;
    if (bi && bi !== 'none') {
      if (bi.includes('gradient(')) (bi.match(COLOUR_RE) || []).forEach((c, i) => put(`bg-grad#${i}`, c));
      if (/url\(/.test(bi)) urlBg = true;
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') (cs.boxShadow.match(COLOUR_RE) || []).forEach((c, i) => put(`shadow#${i}`, c));
    return { p, urlBg };
  }
  function record(key, paint, text, media, backdrop) {
    if (!Object.keys(paint).length) return;
    els[key] = { paint, ...(text ? { text: true } : {}), ...(media ? { media: true } : {}), ...(backdrop ? { backdrop: true } : {}) };
  }
  // A transform that flattens its box to nothing (the directory filter's wipe box rests at scaleX(0)).
  const collapsed = (t) => {
    const m = /^matrix\(([^)]+)\)$/.exec(t || '');
    if (!m) return false;
    const [a, b, c, d] = m[1].split(',').map(Number);
    return a * d - b * c === 0;
  };
  function visit(el, path, underUrl) {
    pathOf.set(el, path);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.opacity === '0') return;
    const tag = el.localName;
    const isSvg = el instanceof SVGElement;
    const rect = el.getBoundingClientRect();
    const text = hasText(el);
    const shown = cs.visibility === 'visible';
    const boxed = shown && cs.display !== 'contents' && rect.width > 0 && rect.height > 0;
    let urlBg = false;
    if (boxed) {
      const r = paintOf(cs, { svg: isSvg, graphic: isSvg && GRAPHIC.has(tag), text });
      urlBg = r.urlBg;
      record(path, r.p, text, underUrl || urlBg || (text && onMedia(rect)));
    } else if (tag === 'stop' && cs.stopOpacity !== '0') {
      record(path, { 'stop-color': cs.stopColor }, false, false);
    }
    if (!isSvg && shown) {
      for (const ps of ['::before', '::after']) {
        const pcs = getComputedStyle(el, ps);
        const content = pcs.content;
        if (!content || content === 'none' || content === 'normal' || pcs.display === 'none' || pcs.visibility !== 'visible' || pcs.opacity === '0') continue;
        const w = parseFloat(pcs.width);
        const h = parseFloat(pcs.height);
        const bordered = ['top', 'right', 'bottom', 'left'].some((s) => parseFloat(pcs.getPropertyValue(`border-${s}-width`)) > 0);
        if ((w === 0 || h === 0) && !bordered) continue;
        const textual = !/^(?:""|'')$/.test(content) && !/^url\(/.test(content);
        const r = paintOf(pcs, { svg: false, graphic: false, text: textual });
        // A box painted BEHIND its element's own text (absolute, negative z-index, not flattened): the
        // contrast gate reads it as that text's nearest background, ahead of the element's own fill.
        const backdrop = !textual && pcs.position === 'absolute' && parseInt(pcs.zIndex, 10) < 0 && !collapsed(pcs.transform);
        record(path + ps, r.p, textual, underUrl || urlBg || r.urlBg || (textual && onMedia(rect)), backdrop);
      }
    }
    children(el, path, underUrl || urlBg);
  }
  function children(parent, parentPath, underUrl) {
    const counts = {};
    for (const el of parent.children) {
      const tag = el.localName;
      if (SKIP.has(tag.toUpperCase())) continue;
      if (ignoreSel && el.matches(ignoreSel)) continue;
      counts[tag] = (counts[tag] || 0) + 1;
      if (el.matches(mediaSel)) continue;
      const cls = clsOf(el);
      visit(el, `${parentPath} > ${tag}${cls ? `.${cls}` : ''}:nth-of-type(${counts[tag]})`, underUrl);
    }
  }
  if (scope) {
    const root = [...document.querySelectorAll(scope)].find((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility === 'visible';
    });
    if (!root) return null;
    if (mark) root.setAttribute('data-swm-probe-hover', '');
    const cls = clsOf(root);
    visit(root, `${root.localName}${cls ? `.${cls}` : ''}`, false);
    return { els };
  }
  visit(document.documentElement, 'html', false);

  const carriers = [];
  const seen = new Set();
  for (const el of [document.documentElement, ...document.querySelectorAll('[style*="--project-color"]')]) {
    if (seen.has(el)) continue;
    seen.add(el);
    const cls = clsOf(el);
    carriers.push({
      path: pathOf.get(el) || `(unwalked) ${el.localName}${cls ? `.${cls}` : ''}`,
      projectColor: getComputedStyle(el).getPropertyValue('--project-color').trim(),
      spectrum: el.getAttribute('data-spectrum'),
    });
  }
  const names = new Set();
  const addStyle = (st) => {
    for (let i = 0; i < st.length; i++) if (/^--(?:project-color|scheme-)/.test(st[i])) names.add(st[i]);
  };
  const walkRules = (rules) => {
    for (const r of rules) {
      try {
        if (r.style) addStyle(r.style);
        if (r.name && /^--(?:project-color|scheme-)/.test(r.name)) names.add(r.name);
        if (r.cssRules) walkRules(r.cssRules);
      } catch { /* a rule we cannot read */ }
    }
  };
  for (const sh of document.styleSheets) {
    try { walkRules(sh.cssRules); } catch { /* cross-origin sheet */ }
  }
  addStyle(document.documentElement.style);
  const rcs = getComputedStyle(document.documentElement);
  const vars = {};
  for (const n of [...names].sort()) vars[n] = rcs.getPropertyValue(n).trim();
  return { els, carriers, vars, attr: document.documentElement.getAttribute('data-scheme') };
}

/** Boxes of every visible match of each selector that meets the viewport (viewport coordinates). */
function pageBoxes(sels) {
  const out = [];
  for (const sel of sels) {
    for (const e of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility !== 'visible' || cs.opacity === '0' || r.width <= 0 || r.height <= 0) continue;
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      out.push({ name: sel, x: r.left, y: r.top, w: r.width, h: r.height });
    }
  }
  return out;
}

/** The centre [x, y] (viewport CSS px, y down) of the first visible match of a selector, or null. */
function pageCentre(sel) {
  for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility === 'visible') return [r.left + r.width / 2, r.top + r.height / 2];
  }
  return null;
}

/** window.__swmSchemeDebug: call each function, return their results (null when there is no hook). */
async function pageGl() {
  const d = window.__swmSchemeDebug;
  if (!d || typeof d !== 'object') return null;
  const out = {};
  for (const [k, f] of Object.entries(d)) {
    if (typeof f !== 'function') continue;
    try { out[k] = await f(); } catch (e) { out[k] = { error: String((e && e.message) || e) }; }
  }
  return out;
}

// ── node side ───────────────────────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(os.tmpdir(), 'swm-scheme-probe-cache');
const IMAGE_HOSTS = /^https:\/\/(?:cdn\.sanity\.io|image\.mux\.com)\//;

/** Route the context: no streams, cached images held until the page's islands have committed. */
async function installRoutes(ctx) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  await ctx.route(IMAGE_HOSTS, async (route) => {
    const req = route.request();
    const key = crypto.createHash('sha1').update(req.url()).digest('hex');
    const bodyFile = path.join(CACHE_DIR, key);
    const metaFile = `${bodyFile}.json`;
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      let ready = false;
      try {
        ready = await req.frame().evaluate(() => (window.__swmCommitted ? window.__swmCommitted() : false));
      } catch {
        break; // the frame went away: release the request
      }
      if (ready) break;
      await sleep(150);
    }
    try {
      if (fs.existsSync(metaFile)) {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        return await route.fulfill({ status: 200, headers: { 'content-type': meta.type, 'access-control-allow-origin': '*' }, body: fs.readFileSync(bodyFile) });
      }
      const resp = await route.fetch();
      const body = await resp.body();
      if (resp.status() === 200) {
        fs.writeFileSync(bodyFile, body);
        fs.writeFileSync(metaFile, JSON.stringify({ type: resp.headers()['content-type'] || 'application/octet-stream' }));
      }
      await route.fulfill({ response: resp, body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
}

/** The /work worlds in order, read from the SSR'd island props (Astro's tagged serialisation). */
async function fetchWorlds() {
  const revive = (v) => {
    if (!Array.isArray(v)) return v;
    const [t, x] = v;
    if (t === 1 && Array.isArray(x)) return x.map(revive);
    if (t === 0 && x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, revive(y)]));
    return x;
  };
  try {
    const html = await (await fetch(`${BASE}/work/`)).text();
    for (const tag of html.matchAll(/<astro-island\b[^>]*>/g)) {
      const m = /\sprops="([^"]*)"/.exec(tag[0]);
      if (!m) continue;
      const json = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const props = Object.fromEntries(Object.entries(JSON.parse(json)).map(([k, v]) => [k, revive(v)]));
      if (Array.isArray(props.worlds) && props.worlds.length && props.worlds[0]?.slug) {
        return props.worlds.map((w) => ({ slug: w.slug, spectrum: w.spectrum ?? null }));
      }
    }
  } catch (e) {
    console.error(`scheme-probe: could not read the /work worlds (${e.message})`);
  }
  return [];
}

/** ../src/lib/colorScheme.js, or a reason it cannot be used. */
async function loadCore() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/colorScheme.js');
  if (!fs.existsSync(file)) return { ok: false, reason: BAD_CORE };
  try {
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.spectrumKeyAt !== 'function' || !mod.SPECTRUM) return { ok: false, reason: 'colorScheme.js has no spectrumKeyAt/SPECTRUM' };
    return { ok: true, mod };
  } catch (e) {
    return { ok: false, reason: `colorScheme.js failed to import: ${String(e.message).split('\n')[0]}` };
  }
}

/** Ramp A's nine stops (hex): src/lib/spectrumRamp.js when it exists, else --swm-ramp-a in global.css; [] when neither reads. */
async function loadRampStops() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const js = path.join(root, 'src/lib/spectrumRamp.js');
  if (fs.existsSync(js)) {
    try {
      const mod = await import(pathToFileURL(js).href);
      if (Array.isArray(mod.SPECTRUM_RAMP_A) && mod.SPECTRUM_RAMP_A.length) return mod.SPECTRUM_RAMP_A;
    } catch { /* fall through to the stylesheet */ }
  }
  try {
    return gate.rampStopsFromCss(fs.readFileSync(path.join(root, 'src/styles/global.css'), 'utf8'));
  } catch {
    return [];
  }
}

const DUMP_OPTS = { ignoreSel: IGNORE_SEL, mediaSel: MEDIA_SEL };

async function measureHover(ctx, page) {
  const pairs = [];
  const cdp = await ctx.newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    for (const selector of HOVER_SELECTORS) {
      const rest = await page.evaluate(pageDump, { ...DUMP_OPTS, scope: selector, mark: true });
      if (!rest) continue; // absent (or not visible) on this route
      try {
        const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-swm-probe-hover]' });
        if (!nodeId) continue;
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
        await sleep(HOVER_MS);
        const hov = await page.evaluate(pageDump, { ...DUMP_OPTS, scope: '[data-swm-probe-hover]', mark: false });
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        pairs.push({ selector, rest: rest.els, hover: hov?.els ?? {} });
      } finally {
        await page.evaluate(() => document.querySelectorAll('[data-swm-probe-hover]').forEach((e) => e.removeAttribute('data-swm-probe-hover')));
      }
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
  return pairs;
}

async function measureBoxes(page) {
  const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  const stops = max < 50 ? [0] : [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)))];
  const boxes = [];
  for (const y of stops) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(250);
    for (const b of await page.evaluate(pageBoxes, OVERLAP_SELECTORS)) boxes.push({ ...b, at: y });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  return boxes;
}

async function measurePage(ctx, scheme, urlPath, width, needShares) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  try {
    const url = `${BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}scheme=${scheme}`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    let committed = true;
    await page.waitForFunction(() => window.__swmCommitted && window.__swmCommitted(), null, { timeout: 40000 }).catch(() => { committed = false; });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1200);
    let prev = null;
    let dump = null;
    let reads = 0;
    let settled = false;
    while (!settled && reads < MAX_READS) {
      dump = await page.evaluate(pageDump, DUMP_OPTS);
      reads++;
      const key = JSON.stringify(dump.els);
      settled = key === prev;
      prev = key;
      if (!settled) await sleep(READ_MS);
    }
    const out = { url, attr: dump.attr, committed, settled, reads, errors, vars: dump.vars, els: dump.els, carriers: dump.carriers };
    out.hover = width > 480 ? await measureHover(ctx, page) : []; // a phone has no hover: the site's hover rules sit behind (hover: hover)
    out.boxes = await measureBoxes(page);
    out.ring = await page.evaluate(pageCentre, RING); // read beside the hooks: the outline gate compares the ramp's centre with it
    out.gl = await page.evaluate(pageGl);
    const name = `${scheme}-${urlPath.replace(/[/?=&]+/g, '_')}-${width}`;
    // Headless Chrome refuses some tall captures ("Unable to capture screenshot": the detail pages at
    // 1440, the directory at 390). A shot is evidence, not a gate, so a refusal keeps the page's gates:
    // the viewport is saved instead, and `refused` tells the run loop to start a fresh browser.
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const file = path.join(SHOTS, `${name}.png`);
      try {
        await page.screenshot({ path: file, fullPage: true });
      } catch {
        out.refused = 'full-page screenshot refused, viewport saved';
        await page.screenshot({ path: file, fullPage: false }).catch(() => {
          out.refused = 'screenshot refused, none saved';
        });
      }
    }
    if (needShares) {
      // Read in tiles: Chrome refuses one capture of a tall page (most detail pages at 390), and a
      // refused page would drop out of the shares.
      try {
        const { default: sharp } = await import('sharp');
        const size = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }));
        const families = {};
        for (let y = 0; y < size.h; y += SHARE_TILE) {
          const clip = { x: 0, y, width: size.w, height: Math.min(SHARE_TILE, size.h - y) };
          const buf = await page.screenshot({ fullPage: true, clip, mask: [page.locator(MEDIA_SEL)], maskColor: '#000000' });
          const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          for (const [f, n] of Object.entries(countFamilies(data, info.channels))) families[f] = (families[f] || 0) + n;
        }
        out.families = families;
      } catch {
        out.refused = [out.refused, 'masked full-page screenshot refused, page left out of shares'].filter(Boolean).join('; ');
      }
    }
    return out;
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240), errors };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── reporting ───────────────────────────────────────────────────────────────────────────────

let failures = 0;
let passes = 0;
let skips = 0;
const emit = (status, scheme, route, width, name, text, offenders = []) => {
  if (status === 'FAIL') failures++;
  else if (status === 'PASS') passes++;
  else skips++;
  console.log(`${status.padEnd(4)}  ${scheme.padEnd(8)} ${String(route).padEnd(10)} ${String(width).padStart(4)}  ${name.padEnd(10)} ${text}`);
  for (const o of offenders.slice(0, 15)) console.log(`        ${gate.describeOffender(o)}`);
  if (offenders.length > 15) console.log(`        … ${offenders.length - 15} more`);
};
const emitResult = (scheme, route, width, name, res, tag = '') =>
  emit(res.pass ? 'PASS' : 'FAIL', scheme, route, width, name, `${res.offenders.length} offenders${tag} — ${res.note}`, res.pass ? [] : res.offenders);

// ── main ────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const baseline = COMPARE ? JSON.parse(fs.readFileSync(COMPARE, 'utf8')) : null;
  const core = await loadCore();
  const worlds = ROUTES.includes('detail') || SCHEME_LIST.includes('spectrum') ? await fetchWorlds() : [];
  const routeList = [];
  for (const r of ROUTES) {
    if (r !== 'detail') routeList.push({ key: r, path: ROUTE_PATHS[r] });
    else {
      const picks = DETAILS === 'all' ? worlds.map((_, i) => i) : [0, 2];
      for (const i of picks) {
        if (worlds[i]) routeList.push({ key: i === 0 ? 'detail' : `detail#${i + 1}`, path: `/work/${worlds[i].slug}/`, slug: worlds[i].slug });
      }
      if (!worlds[0]) emit('SKIP', schemeArg, 'detail', '*', 'detail', 'skipped: no /work card slug could be read');
    }
  }
  const forced = FORCE ? ' (forced: the probe set html[data-scheme], not the site)' : '';
  console.log(`scheme-probe: ${BASE}  schemes ${SCHEME_LIST.join(',')}  routes ${routeList.map((r) => r.key).join(',')}  widths ${WIDTHS.join(',')}${FORCE ? '  --force-attr' : ''}${COMPARE ? `  --compare ${COMPARE}` : ''}`);

  const wanted = (scheme) => {
    const set = new Set(GATES_ARG ?? DEFAULT_GATES[scheme]);
    if (COMPARE && !GATES_ARG) set.add('identity');
    return set;
  };
  // The shares gate needs every project's page: each page carries only its own dealt colour.
  const sharesReady = DETAILS === 'all' && ROUTES.includes('detail');
  const needShares = sharesReady && SCHEME_LIST.some((s) => wanted(s).has('shares')) && core.ok;
  const rampStops = SCHEME_LIST.some((s) => wanted(s).has('density')) ? await loadRampStops() : [];
  const captured = { meta: { base: BASE, at: new Date().toISOString(), ignore: IGNORE_SEL, forced: FORCE, schemes: SCHEME_LIST, widths: WIDTHS }, pages: {} };
  const launch = () => chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let browser = await launch();
  try {
    for (const scheme of SCHEME_LIST) {
      const want = wanted(scheme);
      for (const width of WIDTHS) {
        const phone = width <= 480;
        const makeCtx = async () => {
          const c = await browser.newContext({
            viewport: { width, height: phone ? 844 : 900 },
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
            ...(phone ? { isMobile: true, hasTouch: true } : {}),
          });
          await installRoutes(c);
          await c.addInitScript(hydrationHook);
          if (FORCE) await c.addInitScript(forceAttr, scheme);
          return c;
        };
        let ctx = await makeCtx();
        const detailKeys = {};
        const detailDumps = []; // the uniform gate's pages: every detail page of this scheme and width
        const familyTotals = {};
        for (const route of routeList) {
          const key = `${scheme}:${route.key}@${width}`;
          const m = await measurePage(ctx, scheme, route.path, width, needShares && want.has('shares'));
          captured.pages[key] = m;
          if (m.refused) {
            // After a refused capture Chrome blocks WebGL for the origin ("Web page caused context loss
            // and was blocked"): every canvas page loaded later in this browser throws at renderer
            // creation and loses its debug hook (measured 11-14). Nothing is stored between pages, so
            // a fresh browser and context cost nothing but the launch.
            await ctx.close().catch(() => {});
            await browser.close().catch(() => {});
            browser = await launch();
            ctx = await makeCtx();
          }
          if (m.error) {
            emit('FAIL', scheme, route.key, width, 'load', m.error);
            continue;
          }
          const warn = [!m.committed && 'islands never reported committed', !m.settled && `dump UNSETTLED after ${m.reads} reads`, m.errors.length && `${m.errors.length} page errors (first: ${m.errors[0]})`, m.refused].filter(Boolean);
          if (warn.length) console.log(`WARN  ${scheme.padEnd(8)} ${route.key.padEnd(10)} ${String(width).padStart(4)}  ${warn.join('; ')}`);
          const run = (name, fn) => {
            if (want.has(name)) fn();
          };
          const tag = FORCE ? ' forced' : '';
          run('latch', () => emitResult(scheme, route.key, width, 'latch', gate.latch(m.attr, scheme), tag));
          run('identity', () => {
            const base = baseline?.pages?.[key];
            if (!baseline) return emit('SKIP', scheme, route.key, width, 'identity', 'skipped: no --compare capture');
            if (!base || base.error) return emit('FAIL', scheme, route.key, width, 'identity', `not in the capture (${key})`);
            emitResult(scheme, route.key, width, 'identity', gate.identity(base.els, m.els));
          });
          run('monochrome', () => emitResult(scheme, route.key, width, 'monochrome', gate.monochrome(m.els)));
          run('singleHue', () => emitResult(scheme, route.key, width, 'singleHue', gate.singleHue(m.els, '#0000ff')));
          run('contrast', () => emitResult(scheme, route.key, width, 'contrast', gate.contrast(m.els, 3)));
          run('carriers', () => {
            if (scheme === 'project') return emit('SKIP', scheme, route.key, width, 'carriers', 'skipped: project has no fixed expectation');
            if (scheme === 'spectrum' && !core.ok) return emit('SKIP', scheme, route.key, width, 'carriers', `skipped: ${core.reason}`);
            const expect = scheme === 'black' ? () => '#000000' : scheme === 'blue' ? () => '#0000ff' : (c) => (core.mod.SPECTRUM[c.spectrum] ?? core.mod.SPECTRUM.blue).fill;
            emitResult(scheme, route.key, width, 'carriers', gate.carriers(m.carriers, expect));
          });
          run('hover', () => {
            if (phone) return emit('SKIP', scheme, route.key, width, 'hover', 'skipped: touch width (hover rules sit behind hover: hover)');
            const res = gate.hover(m.hover);
            res.pass || m.hover.length ? emitResult(scheme, route.key, width, 'hover', res) : emit('SKIP', scheme, route.key, width, 'hover', `skipped: none of ${HOVER_SELECTORS.join(' ')} on this route`);
          });
          run('overlap', () => {
            if (!m.boxes.some((b) => b.name === ANCHOR)) return emit('SKIP', scheme, route.key, width, 'overlap', `skipped: no ${ANCHOR} on this route`);
            emitResult(scheme, route.key, width, 'overlap', gate.overlap(m.boxes, { anchor: ANCHOR }));
          });
          run('density', () => emitResult(scheme, route.key, width, 'density', gate.density(m.els, { min: gate.densityMin(route.key, DENSITY), rampStops })));
          run('outline', () => {
            const name = OUTLINE_HOOK[route.key];
            if (!name) return emit('SKIP', scheme, route.key, width, 'outline', 'skipped (no canvas outline on this route)');
            if (!m.gl) return emit('SKIP', scheme, route.key, width, 'outline', 'skipped (no debug hook)');
            const spectrum = scheme === 'spectrum';
            const res = gate.outline(m.gl[name], { name, mix: spectrum ? 1 : 0, ...(spectrum && name === 'globe' ? { ring: m.ring ?? null } : {}) });
            if (res.skip) return emit('SKIP', scheme, route.key, width, 'outline', res.note);
            emitResult(scheme, route.key, width, 'outline', res);
          });
          run('gl', () => {
            if (!m.gl) return emit('SKIP', scheme, route.key, width, 'gl', 'skipped (no debug hook)');
            const bad = Object.entries(m.gl).filter(([, v]) => v && v.error).map(([k, v]) => ({ path: k, error: v.error }));
            emit(bad.length ? 'FAIL' : 'PASS', scheme, route.key, width, 'gl', `${bad.length} offenders — ${JSON.stringify(m.gl)}`, bad);
          });
          if (route.slug) {
            detailKeys[route.slug] = m.carriers.find((c) => c.spectrum)?.spectrum ?? null;
            detailDumps.push({ label: route.slug, els: m.els });
          }
          for (const [f, n] of Object.entries(m.families ?? {})) familyTotals[f] = (familyTotals[f] || 0) + n;
          if (m.families && want.has('shares')) {
            // One line per page (not a gate, not counted): which page a family's share comes from.
            const page = gate.shares(m.families);
            console.log(`INFO  ${scheme.padEnd(8)} ${String(route.key).padEnd(10)} ${String(width).padStart(4)}  ${'shares'.padEnd(10)} ${page.n} chromatic px — ${page.note}`);
          }
        }
        if (want.has('uniform')) {
          if (detailDumps.length < 2) emit('SKIP', scheme, 'detail*', width, 'uniform', `skipped: ${detailDumps.length} project page measured, it compares two or more (--routes with detail)`);
          else {
            const res = gate.uniform(detailDumps);
            console.log(`INFO  ${scheme.padEnd(8)} ${'detail*'.padEnd(10)} ${String(width).padStart(4)}  ${'uniform'.padEnd(10)} ${res.skipped} element paths not on every page (skipped), ${detailDumps.length} pages: ${detailDumps.map((d) => d.label).join(', ')}`);
            emitResult(scheme, 'detail*', width, 'uniform', res);
          }
          if (ROUTES.includes('work')) console.log(`INFO  ${scheme.padEnd(8)} ${'work'.padEnd(10)} ${String(width).padStart(4)}  ${'uniform'.padEnd(10)} /work is not compared: it opens on its first card and no URL picks another (the start card comes from sessionStorage), so project pages only`);
        }
        if (want.has('shares')) {
          if (!core.ok) emit('SKIP', scheme, '*', width, 'shares', `skipped: ${core.reason}`);
          else if (!sharesReady) emit('SKIP', scheme, '*', width, 'shares', 'skipped: run with --details=all (the sample of two project pages cannot show the proportions)');
          else emitResult(scheme, '*', width, 'shares', gate.shares(familyTotals));
        }
        if (want.has('deal')) {
          if (!core.ok) emit('SKIP', scheme, '*', width, 'crossRoute', `skipped: ${core.reason}`);
          else if (!Object.keys(detailKeys).length) emit('SKIP', scheme, '*', width, 'crossRoute', 'skipped: no detail route measured');
          else emitResult(scheme, '*', width, 'crossRoute', gate.crossRoute(worlds, detailKeys));
        }
        await ctx.close();
      }
      if (want.has('deal')) {
        if (!core.ok) emit('SKIP', scheme, '/work', '*', 'deal', `skipped: ${core.reason}`);
        else if (!worlds.length) emit('SKIP', scheme, '/work', '*', 'deal', 'skipped: no /work worlds read');
        else emitResult(scheme, '/work', '*', 'deal', gate.deal(worlds, core.mod.spectrumKeyAt));
      }
    }
  } finally {
    await browser.close();
  }
  if (CAPTURE) {
    fs.writeFileSync(CAPTURE, JSON.stringify(captured));
    console.log(`capture → ${CAPTURE} (${Object.keys(captured.pages).length} pages)`);
  }
  console.log(`scheme-probe: ${passes} PASS, ${failures} FAIL, ${skips} SKIP${forced ? forced : ''}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
