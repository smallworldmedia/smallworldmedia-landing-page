#!/usr/bin/env node
/**
 * globe-probe — headless Playwright harness for the home globe's population
 * modes (docs/globe-worlds-plan.md). Sibling of pager-probe (same launch
 * doctrine, same noise filter); reads window.__swmPopStats, which the
 * PopulationDirector publishes at ~2 Hz.
 *
 * Usage:
 *   node scripts/globe-probe.mjs [--mode=tides] [--secs=20] [--warm=6]
 *        [--next=2] [--seed=42] [--mobile] [--rm] [--intro=replay|full]
 *        [--paint] [--enter] [--channel=chrome]
 *        [--extra="&popgroup=3"] [--base=http://localhost:4322] [--out=DIR]
 *
 * --base and --out also read GLOBE_PROBE_BASE / GLOBE_PROBE_OUT, for a pinned
 * verifier command that carries no flags (GLOBE_PROBE_OUT is the PARENT of the
 * per-run folder, so one setting serves every variant of a run).
 *
 * Samples the stats (and the <html> accent: the pop-tint class, the computed
 * --project-color) once a second for --secs, clicks the bench's ⏭ next
 * --next times (spread across the run) and times each one until the new
 * world has landed (landedMs, ±0.5 s — the stats publish at ~2 Hz),
 * screenshots at the warm mark, after each ⏭ and at the end, and prints a
 * JSON report whose `pass` block holds the plan's gates: integrity ≥ 0.95
 * during holds, 0 black visible tiles after --warm, a bounded texture count,
 * no in-place flips during a hold (assets are persistent at rest), every ⏭
 * landed, the world changing on its own clock (under --rm only ⏭ moves it), the
 * chrome wearing the world's projectColor once a change has landed, the
 * client-name strips placed inside the latitude band and (in region mode)
 * wholly front-facing and never moving (10-07: the ticker is gone), and no
 * console/page errors. The report is also saved as report.json beside the
 * shots in --out (a failed or crashed run included); its path goes to stderr. --mode=off checks the default globe runs clean (no
 * stats, no tint).
 *
 * --paint reads the hero gradient's bottom pixel every frame it can through
 * one ⏭ change: the accent must ARRIVE through intermediate colours, not cut
 * at the end — Chromium's paint-invalidation trap on animating custom
 * properties (the 08-29 nav fix) — so the gate is ≥ 3 in-between colours.
 *
 * --enter (P3) then clicks Enter World on a world that isn't /work's first
 * (⏭ until the globe shows one) and follows the passage: /work must open
 * INSIDE that world as a snap — never an outgoing card (no Turn staged), the
 * scale pager never between stations (no glide from the first World), the
 * accent the world's colour from the moment it lands, the swm:enterWorld key
 * consumed. It then takes that card's enter_world to the detail page and the
 * breadcrumb back, which must reopen the same world (the swm:returnToWork
 * restore) as a snap too since 10-06 — no outgoing card on the way back.
 * 10-06 cover gates: the Enter World chrome must be fully out before the
 * loading bar shows (under RM the bar never shows), and on the way in AND
 * back the cover must be fully up from the moment /work's first card exists
 * until the wanted card is — reduced motion included (its instant cover), so
 * World 0's server-rendered card is never seen.
 * With --extra="&popenter=0" /work must open on its first world.
 *
 * Failed image requests land in report.imageFailures (the noise filter hides
 * them from the console list) with a hint on stderr: a still the Sanity CDN
 * refuses by CORS — the page origin is off the project's allowlist, e.g. a
 * preview on a fresh port; localhost:4321, :4322 and :3333 are on it —
 * otherwise reads only as black tiles and a low integrity.
 *
 * Headless notes: SwiftShader is the default GPU (pager-probe's finding — the
 * GPU path starves the main thread); fps under it is NOT a device number.
 * The bundled Chromium plays the Mux streams (09-26: 7 decodes lit 31 tiles),
 * so streams/liveTiles are real; --channel=chrome runs the installed Google
 * Chrome instead.
 * ?intro=replay skips the ~5s logo intro (the full intro holds the globe dark,
 * so black tiles are expected until its cascade).
 */
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const MODE = arg('mode', 'tides');
const SECS = Number(arg('secs', 20));
const WARM = Number(arg('warm', 6));
const NEXT = Number(arg('next', 0));
const SEED = arg('seed', '42');
const MOBILE = !!arg('mobile', false);
const RM = !!arg('rm', false);
const VW = Number(arg('vw', MOBILE ? 390 : 1440));
const VH = Number(arg('vh', MOBILE ? 844 : 900));
const INTRO = arg('intro', 'replay');
const EXTRA = arg('extra', '');
// GLOBE_PROBE_BASE / GLOBE_PROBE_OUT are the same two knobs by environment,
// for a pinned verifier command that can't carry flags (several worktrees of
// this repo are often up at once, each dev server on its own port — and the
// Sanity CDN only allows a handful of them, see the CORS note above).
const BASE = arg('base', process.env.GLOBE_PROBE_BASE || 'http://localhost:4322');
const GPU = arg('gpu', 'swiftshader');
const CHANNEL = arg('channel', ''); // 'chrome' → the installed Google Chrome
const PAINT = !!arg('paint', false);
const ENTER = !!arg('enter', false);
const ENTER_OFF = /[?&]popenter=0\b/.test(EXTRA); // /work must open on its first world
const TEX_BOUND = Number(arg('texbound', 150)); // today's globe binds ~96
const RUN = `globe-${MODE}-${MOBILE ? 'm' : 'd'}${RM ? '-rm' : ''}${ENTER ? '-enter' : ''}`;
const OUT = arg(
  'out',
  // fileURLToPath, not URL.pathname — the Dropbox path has spaces (%20 would
  // mkdir a stray "Small%20World%20Media" tree beside the real one).
  path.join(
    process.env.GLOBE_PROBE_OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots'),
    RUN
  )
);
const URL_ = `${BASE}/?popmode=${MODE}&popseed=${SEED}&poptune=1&intro=${INTRO}${EXTRA}`;

// pager-probe's environmental noise (headless CDN CORS, GPU readback stalls,
// Chrome's reduced-motion view-transitions warning) — never the page's fault.
// --enter adds Chrome's font-preload timing warning on /work and the detail
// page (the layout's preloads, not the globe's).
const NOISE = [
  /cdn\.sanity\.io/,
  /net::ERR_FAILED/,
  /GPU stall due to ReadPixels/,
  /view.transition/i,
  /preloaded using link preload but not used/,
];

fs.mkdirSync(OUT, { recursive: true });
// Only this probe's own NN-name.png shots — never anything else in --out.
for (const f of fs.readdirSync(OUT)) if (/^\d\d-[\w-]+\.png$/.test(f)) fs.rmSync(path.join(OUT, f));
// The full report on disk, beside the shots — stdout stays the bare JSON.
const save = () => {
  const file = path.join(OUT, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 1) + '\n');
  console.error(`globe-probe: report → ${file}`);
};
const report = { url: URL_, viewport: [VW, VH], mobile: MOBILE, rm: RM, samples: [], shots: [], consoleErrors: [], pageErrors: [], imageFailures: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error('dev server not reachable at ' + BASE);
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(report.shots.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  report.shots.push(file);
}

/** One CSS pixel's [r, g, b]: a 1×1 PNG, its IDAT inflated past the row's
 *  filter byte — with no neighbours, every PNG filter reconstructs to the
 *  raw bytes. */
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 }, scale: 'css' });
  const idat = [];
  for (let at = 8; at < png.length; ) {
    const len = png.readUInt32BE(at);
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  return [raw[1], raw[2], raw[3]];
}

// The <html> accent as the chrome reads it.
const readTint = (page) =>
  page.evaluate(() => {
    const html = document.documentElement;
    return {
      popTint: html.classList.contains('pop-tint'),
      accent: getComputedStyle(html).getPropertyValue('--project-color').trim(),
    };
  });
const rgbOf = (hex) => {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};

// Open the bench (phones start collapsed) and press ⏭.
async function pressNext(page) {
  const chip = page.locator('.hero-tune--chip button');
  if (await chip.count()) await chip.first().click();
  const btn = page.locator('.hero-tune--pop button', { hasText: 'next' });
  if (!(await btn.count())) return false;
  await btn.first().click();
  return true;
}

// A hold with room left on its clock, so no change starts under the next step.
const holdRoom = (page) =>
  page
    .waitForFunction(
      () => {
        const s = window.__swmPopStats;
        return s?.phase === 'hold' && (s.holdLeft == null || s.holdLeft >= 3);
      },
      null,
      { timeout: 30000, polling: 100 }
    )
    .then(
      () => true,
      () => false
    );

// /work's first World — slug + accent — from its SSR'd card.
async function firstWork() {
  const html = await (await fetch(`${BASE}/work`)).text();
  const wrap = html.match(/<div[^>]*fp-card-wrap[^>]*>/)?.[0] ?? '';
  const tag = html.match(/<a[^>]*fp-card__cta[^>]*>/)?.[0] ?? '';
  return {
    slug: tag.match(/href="\/work\/([^"]+)"/)?.[1] ?? null,
    color: wrap.match(/--project-color:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? null,
  };
}

// In-page recorder, armed before the click: every change to the staged
// cards, the scale pager's strip position, the <html> accent and the passage
// fill's opacity (to 0.01), as it happens (a MutationObserver — the main
// thread is too busy building /work for a polling probe to see the arrival).
// window survives the soft nav.
const armRecorder = () => {
  const log = (window.__enterLog = []);
  const t0 = performance.now();
  const last = {};
  const note = (k, v) => {
    if (last[k] === v) return;
    last[k] = v;
    log.push({ ms: Math.round(performance.now() - t0), [k]: v });
  };
  const op = (sel) => {
    const el = document.querySelector(sel);
    return el ? Math.round(parseFloat(getComputedStyle(el).opacity) * 100) / 100 : null;
  };
  const check = () => {
    note('cta', op('.hero__lead-col')); // the Enter World chrome (null once home unmounts)
    note('loader', op('.route-fill__loader'));
    note(
      'cards',
      [...document.querySelectorAll('.fp-card-wrap')]
        .map((c) => `${c.dataset.phase}:${(c.querySelector('.fp-card__cta')?.getAttribute('href') ?? '').slice(6)}`)
        .join(' ')
    );
    note('qf', document.querySelector('.fp-scale')?.style.getPropertyValue('--scale-qf') || null);
    note('accent', getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim());
    const fill = document.querySelector('.route-fill');
    note('fill', fill ? Math.round(parseFloat(getComputedStyle(fill).opacity) * 100) / 100 : null);
  };
  new MutationObserver(check).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'data-phase'],
  });
  const frame = () => {
    check();
    if (performance.now() - t0 < 12000) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

// /work as the page holds it: the staged cards (an 'exit' one = a Turn), the
// entered card's slug, the scale pager's strip position, the <html> accent,
// the active index FeaturedProjects persists, the handoff key.
const readWork = () => {
  const cards = [...document.querySelectorAll('.fp-card-wrap')];
  const enter = cards.find((c) => c.dataset.phase === 'enter');
  const href = enter?.querySelector('.fp-card__cta')?.getAttribute('href') ?? '';
  const qf = parseFloat(document.querySelector('.fp-scale')?.style.getPropertyValue('--scale-qf'));
  let key = null;
  let index = NaN;
  try {
    key = sessionStorage.getItem('swm:enterWorld');
    index = parseInt(sessionStorage.getItem('swm:worldIndex') ?? '', 10);
  } catch {}
  return {
    path: location.pathname,
    cards: cards.length,
    exits: cards.filter((c) => c.dataset.phase === 'exit').length,
    slug: href.startsWith('/work/') ? href.slice(6) : null,
    qf: Number.isFinite(qf) ? qf : null,
    index: Number.isFinite(index) ? index : null,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim(),
    key,
  };
};

/** --enter: Enter World on a world other than /work's first, the /work
 *  arrival recorded as it happens, then its enter_world and the breadcrumb. */
async function enterScenario(page) {
  const out = { first: await firstWork() };
  // …and a colour of its own, so the accent gate can tell them apart.
  const own = (s) =>
    s?.slug && s.slug !== out.first.slug && (s.color || '').toLowerCase() !== (out.first.color || '').toLowerCase();
  for (let i = 0; i < 6; i += 1) {
    await holdRoom(page);
    const s = await page.evaluate(() => window.__swmPopStats);
    if (own(s)) break;
    await pressNext(page);
    await page
      .waitForFunction((from) => window.__swmPopStats?.step !== from, s?.step, { timeout: 15000, polling: 100 })
      .catch(() => {});
  }
  await holdRoom(page);
  out.want = await page.evaluate(() => {
    const s = window.__swmPopStats;
    return { slug: s?.slug ?? null, world: s?.world ?? null, color: s?.color ?? null };
  });
  await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
  // ⏭ opened the bench; on phones it sits over the Enter World CTA.
  const collapse = page.locator('.hero-tune--pop button[aria-label="Collapse"]');
  if (MOBILE && (await collapse.count())) await collapse.first().click();
  await page.evaluate(armRecorder);
  const t0 = Date.now();
  await page.locator('.hero__enter').first().click();
  out.held = await page
    .waitForFunction(() => window.__swmPopStats?.held, null, { timeout: 3000, polling: 50 })
    .then(() => true, () => false);
  await page.waitForFunction(() => location.pathname === '/work', null, { timeout: 20000, polling: 50 });
  out.navMs = Date.now() - t0;
  await sleep(4000); // the build, the fill's release, the card's boot
  out.log = await page.evaluate(() => window.__enterLog);
  out.landed = await page.evaluate(readWork);
  await shot(page, 'enter-work');
  try {
    await page.locator('.fp-card-wrap[data-phase="enter"] .fp-card__cta').first().click();
    await page.waitForFunction((slug) => location.pathname === `/work/${slug}`, out.landed.slug, { timeout: 20000, polling: 100 });
    await page.waitForSelector('.detail-breadcrumb', { state: 'visible', timeout: 20000 });
    await sleep(1500);
    await page.evaluate(armRecorder);
    await page.locator('.detail-breadcrumb').first().click();
    await page.waitForFunction(() => location.pathname === '/work', null, { timeout: 20000, polling: 50 });
    await sleep(2500); // the restore's snap (10-06) lands
    out.backLog = await page.evaluate(() => window.__enterLog);
    out.back = await page.evaluate(readWork);
    await shot(page, 'enter-back');
  } catch (e) {
    out.backError = String(e).slice(0, 300);
  }
  return out;
}

(async () => {
  await waitServer();
  const browser = await chromium.launch({
    headless: true,
    ...(CHANNEL ? { channel: CHANNEL } : {}),
    args: GPU === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: MOBILE ? 2 : 1,
    hasTouch: MOBILE,
    isMobile: MOBILE,
    reducedMotion: RM ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    // the route it fired on (--enter visits /work and a detail page too)
    const at = new URL(page.url()).pathname;
    if (!NOISE.some((re) => re.test(text))) report.consoleErrors.push(`${m.type()} @${at}: ${text.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', (r) => {
    if (r.resourceType() !== 'image') return;
    report.imageFailures.push(`${r.failure()?.errorText} @${new URL(page.url()).pathname}: ${r.url().slice(0, 160)}`);
  });
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.video-globe__canvas canvas', { timeout: 30000 });

  const nextAt = new Set(Array.from({ length: NEXT }, (_, i) => Math.round(WARM + ((i + 1) * (SECS - WARM)) / (NEXT + 1))));
  for (let t = 1; t <= SECS; t++) {
    await sleep(1000);
    const stats = await page.evaluate(() => window.__swmPopStats ?? null);
    report.samples.push({ t, ...(stats || { none: true }), tint: await readTint(page) });
    if (t === WARM) await shot(page, 'warm');
    if (nextAt.has(t)) {
      const step = await page.evaluate(() => window.__swmPopStats?.step ?? null);
      const t0 = Date.now();
      if (await pressNext(page)) {
        const landedMs = await page
          .waitForFunction(
            (from) => {
              const s = window.__swmPopStats;
              return s && s.step !== from && s.phase === 'hold' && s.integrity >= 0.95;
            },
            step,
            { timeout: 15000, polling: 100 }
          )
          .then(
            () => Date.now() - t0,
            () => null
          );
        report.samples.push({ t, action: 'next', landedMs });
        await shot(page, `next-t${t}`);
      } else report.samples.push({ t, action: 'next — bench button missing', landedMs: null });
    }
  }

  // --paint: the gradient's horizon pixel (bottom centre) through one change.
  if (PAINT && MODE !== 'off' && !RM) {
    const room = () => {
      const s = window.__swmPopStats;
      return s?.phase === 'hold' && s.holdLeft >= 3;
    };
    const ready = await page.waitForFunction(room, null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
    await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove()); // it sits on that pixel in dev
    const [x, y] = [Math.round(VW / 2), VH - 2];
    const before = await pixel(page, x, y);
    const series = [];
    if (ready && (await pressNext(page))) {
      const t0 = Date.now();
      while (Date.now() - t0 < 2600) series.push({ ms: Date.now() - t0, rgb: await pixel(page, x, y) });
    }
    const after = series.length ? series[series.length - 1].rgb : before;
    const far = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i]))) > 6;
    const between = new Set(series.filter((p) => far(p.rgb, before) && far(p.rgb, after)).map((p) => p.rgb.join(',')));
    report.paint = { at: [x, y], before, after, between: between.size, frames: series.length, series };
  }

  // The chrome wears the world once a change has fully landed (the accent's
  // 1.7 s fade included).
  if (MODE !== 'off') {
    const room = () => {
      const s = window.__swmPopStats;
      return s?.phase === 'hold' && s.holdLeft >= 3;
    };
    const ready = await page.waitForFunction(room, null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
    if (ready) await sleep(2000);
    const want = await page.evaluate(() => window.__swmPopStats?.color ?? null);
    report.colour = { ready, want, ...(await readTint(page)) };
  } else report.colour = await readTint(page);
  await shot(page, 'end');
  if (ENTER && MODE !== 'off') report.enter = await enterScenario(page);
  await browser.close();

  const stats = report.samples.filter((s) => s.phase);
  const warm = stats.filter((s) => s.t >= WARM);
  const holds = warm.filter((s) => s.phase === 'hold');
  // Flips between two hold samples of the same grouping — should never happen.
  const holdFlips = stats.slice(1).reduce((n, s, i) => {
    const prev = stats[i];
    const same = prev.phase === 'hold' && s.phase === 'hold' && prev.step === s.step && prev.seed === s.seed;
    return same ? n + (s.flips - prev.flips) : n;
  }, 0);
  const nexts = report.samples.filter((s) => s.action?.startsWith('next'));
  const steps = stats.map((s) => s.step);
  // Client-name strips (10-07). namePlaced is what the director MEASURED off
  // the live scene as it placed this world's strips (the band / facing /
  // quadrant contract); nameUv is each strip slice's resting window, so two
  // samples of the same world disagreeing means something still moves them.
  const namesOn = stats.some((s) => s.nameStrips > 0);
  const placed = [...new Map(stats.filter((s) => s.namePlaced).map((s) => [s.namePlaced.step, s.namePlaced])).values()];
  // Stillness is a gate about REST, so compare only two HOLD samples of the
  // same world (the quietHolds idiom). `step` alone isn't enough: it advances
  // when a change STARTS, and the tiles swap across the lay-in's spread, so a
  // transition sample can still hold the previous world's strip — and nameUv
  // is keyed by slice index, so slice 1 of a span-4 strip (0.25) would be
  // compared with slice 1 of the next world's span-2 strip (0.5). In a hold
  // every strip is at rest: a row re-born inside one can never carry a strip
  // (pick() consumes the plan), so nothing binds between two hold samples.
  const uvMoved = [];
  let uvHeld = 0; // slice comparisons actually made — 0 would pass vacuously
  for (let i = 1; i < stats.length; i++) {
    const [a, b] = [stats[i - 1], stats[i]];
    if (!a.nameUv || !b.nameUv || a.step !== b.step || a.seed !== b.seed) continue;
    if (a.phase !== 'hold' || b.phase !== 'hold') continue;
    for (const k of Object.keys(b.nameUv)) {
      if (!(k in a.nameUv)) continue;
      uvHeld += 1;
      if (Math.abs(a.nameUv[k] - b.nameUv[k]) <= 1e-4) continue;
      uvMoved.push(`t${b.t} step${b.step} slice ${k}: ${a.nameUv[k]} → ${b.nameUv[k]}`);
    }
  }
  const names = {
    placements: placed.map(
      (p) => `${p.mode} span ${p.span} × ${p.tiles}t · ${p.quad ?? '—'}${p.relaxed ? ` (relaxed:${p.relaxed})` : ''}`
    ),
    // the band is the hard gate; |y| ≤ yLimit is "inside the middle ?popnameband"
    worstPlacedY: placed.length ? Math.max(...placed.map((p) => p.yMax ?? 0)) : null,
    yLimit: placed.length ? placed[0].yLimit : null,
    worstPlacedZ: placed.filter((p) => p.mode === 'region').length
      ? Math.min(...placed.filter((p) => p.mode === 'region').map((p) => p.zMin ?? -1))
      : null,
    zLimit: placed.length ? placed[0].zLimit : null,
    relaxed: placed.filter((p) => p.relaxed).length,
    maxNameTiles: stats.length ? Math.max(...stats.map((s) => s.nameTiles ?? 0)) : null,
    // live, as the strips travel with their rows out of the band — diagnostic
    maxLiveNameY: stats.length ? Math.max(...stats.map((s) => s.nameMaxY ?? 0)) : null,
    uvHeld,
    uvMoved,
  };
  report.summary = {
    worlds: stats.reduce((seq, s) => (seq[seq.length - 1] === s.world ? seq : [...seq, s.world]), []),
    changes: steps.length ? Math.max(...steps) - Math.min(...steps) : 0,
    transitions: [...new Set(stats.filter((s) => s.phase === 'transition').map((s) => s.transition))],
    groupings: [...new Set(stats.map((s) => `${s.grouping.join(' + ')} [${s.pattern}]`))],
    minIntegrityInHolds: holds.length ? Math.min(...holds.map((s) => s.integrity)) : null,
    maxBlackAfterWarm: warm.length ? Math.max(...warm.map((s) => s.black)) : null,
    maxTextures: stats.length ? Math.max(...stats.map((s) => s.gpuTextures ?? s.textures)) : null,
    flips: stats.length ? stats[stats.length - 1].flips : null,
    holdFlips,
    nextLandedMs: nexts.map((s) => s.landedMs),
    // video: decodes vs the tiles they light (shared streams: tiles ≥ decodes)
    maxStreams: stats.length ? Math.max(...stats.map((s) => s.streams ?? 0)) : null,
    maxLiveTiles: stats.length ? Math.max(...stats.map((s) => s.liveTiles ?? 0)) : null,
    names,
    fps: warm.map((s) => s.fps),
  };
  const m = report.summary;
  const c = report.colour;
  // --enter, read off the recorder: never an outgoing card (no Turn staged),
  // once the wanted card is up no other, the pager never between stations
  // (no glide), the first World's accent never shown on the way in, the
  // passage fill fully up from the swap until the wanted card is, on the way
  // in and back (it lifts onto the entered World — under reduced motion too,
  // its instant cover since 10-06), and the loading bar only once the Enter
  // World chrome is out (never under RM).
  const e = report.enter;
  const enterPass = (() => {
    if (!e) return {};
    const want = ENTER_OFF ? e.first.slug : e.want?.slug;
    const log = e.log || [];
    const cards = log.filter((x) => 'cards' in x).map((x) => x.cards);
    const qfs = log.filter((x) => x.qf != null).map((x) => parseFloat(x.qf));
    const accents = log.filter((x) => 'accent' in x).map((x) => x.accent);
    // The cover is fully up when /work's first card appears and stays up
    // until the wanted card is the one on screen.
    const coverHeld = (rows, slug) => {
      const swapAt = rows.findIndex((x) => x.cards);
      const wantAt = rows.findIndex((x) => x.cards === `enter:${slug}`);
      let fillThen = null;
      let held = swapAt >= 0 && wantAt >= swapAt;
      rows.forEach((x, i) => {
        if (x.fill == null) return;
        if (i <= swapAt) fillThen = x.fill;
        else if (i < wantAt && x.fill < 0.99) held = false;
      });
      return held && fillThen != null && fillThen >= 0.99;
    };
    // The CTA chrome out (opacity 0) vs the loading bar's first visible frame.
    const ctaOut = log.find((x) => x.cta === 0);
    const loaderIn = log.find((x) => x.loader > 0);
    e.timing = { ctaOutMs: ctaOut?.ms ?? null, loaderInMs: loaderIn?.ms ?? null };
    const at = cards.indexOf(`enter:${want}`);
    const wantAccent = e.want?.color ? rgbOf(e.want.color) : null;
    const firstAccent = e.first.color ? rgbOf(e.first.color) : null;
    return {
      enterNonTrivial: ENTER_OFF || (!!want && want !== e.first.slug),
      enterLanded: e.landed?.slug === want,
      enterNoTurn: !cards.some((c) => c.includes('exit:')),
      enterSteady: at >= 0 && cards.slice(at).every((c) => c === `enter:${want}`),
      enterPagerJumps: qfs.every((q) => Math.abs(q - Math.round(q)) < 1e-3),
      enterPagerAt: e.landed?.qf != null && Math.round(e.landed.qf) === e.landed.index,
      enterAccent:
        ENTER_OFF ||
        !wantAccent ||
        (e.landed?.accent === wantAccent && (firstAccent === wantAccent || !accents.includes(firstAccent))),
      enterFillHeld: ENTER_OFF || coverHeld(log, want),
      enterLoaderAfterCta: RM ? !loaderIn : !!ctaOut && !!loaderIn && loaderIn.ms >= ctaOut.ms,
      enterKeyConsumed: e.landed?.key == null,
      returnRestored: e.back?.slug === e.landed?.slug,
      returnNoTurn: !(e.backLog || []).some((x) => 'cards' in x && x.cards.includes('exit:')),
      returnFillHeld: !!e.backLog && coverHeld(e.backLog, e.landed?.slug),
    };
  })();
  report.pass =
    MODE === 'off'
      ? { noStats: stats.length === 0, noTint: !c.popTint, clean: !report.consoleErrors.length && !report.pageErrors.length }
      : {
          integrity: m.minIntegrityInHolds != null && m.minIntegrityInHolds >= 0.95,
          noBlackAfterWarm: m.maxBlackAfterWarm === 0,
          texturesBounded: m.maxTextures != null && m.maxTextures <= TEX_BOUND,
          quietHolds: m.holdFlips === 0,
          nextLanded: m.nextLandedMs.every((ms) => ms != null),
          // the clock turns worlds by itself — beyond the ⏭ presses; under RM
          // only the presses move it (each one a cut)
          cycled: RM ? m.changes === nexts.length : m.changes > nexts.length,
          colour: c.ready && (c.want ? c.popTint && c.accent === rgbOf(c.want) : true),
          // the client-name strips: placed at all, never outside the latitude
          // band, a region strip wholly front-facing, and never moving (the
          // ticker is gone — tile k rests on the k-th slice, for good)
          ...(namesOn
            ? {
                namesPlaced: !!names.placements.length && names.maxNameTiles > 0 && placed.every((p) => p.tiles > 0),
                namesInBand: !!placed.length && placed.every((p) => (p.yMax ?? 0) <= p.yLimit + 1e-4),
                namesFrontFacing: placed.every((p) => p.mode !== 'region' || (p.zMin ?? -1) >= p.zLimit - 1e-4),
                namesStill: names.uvHeld > 0 && names.uvMoved.length === 0,
              }
            : {}),
          ...(report.paint ? { gradientAnimates: report.paint.between >= 3 } : {}),
          ...enterPass,
          clean: !report.consoleErrors.length && !report.pageErrors.length,
        };
  if (report.imageFailures.length) {
    console.error(
      `globe-probe: ${report.imageFailures.length} image request(s) failed, first: ${report.imageFailures[0]}\n` +
        `  a CORS block on cdn.sanity.io = this origin is off the Sanity project's allowlist (localhost:4321, :4322, :3333 are on it)`
    );
  }
  console.log(JSON.stringify(report, null, 1));
  save();
  if (Object.values(report.pass).some((v) => !v)) process.exit(2);
})().catch((e) => {
  report.fatal = String(e && e.stack ? e.stack : e);
  console.log(JSON.stringify(report, null, 1));
  save();
  process.exit(1);
});
