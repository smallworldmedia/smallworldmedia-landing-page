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
 *        [--paint] [--enter] [--footer] [--channel=chrome]
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
 * wholly front-facing, each tile rendering its own whole slice of the strip
 * past the pole pinch, and never moving (10-07: the ticker is gone), and no
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
 * --footer (10-07) is the only scenario here that GESTURES: it forces the
 * mobile viewport, drives a real touch scrub with CDP Input.dispatchTouchEvent
 * and MEASURES the MOBILE HOME resting footer's reveal. It short-circuits the
 * population sampling loop. Gates: the panel parks at ?footerrest with the
 * normalized rise at 0 (restFloor), the hero's lift is EXACTLY 0 in the
 * resting pose (liftZeroAtRest — a parallax driven off the raw --footer-reveal
 * instead of --footer-rise lifts the globe a third of the way on the first
 * paint), measured lift ÷ measured panel climb ≈ ?footerlift (liftRatio), the
 * button and the blue ring travel exactly with the globe (ctaRidesGlobe /
 * strokeRidesGlobe), driven mode publishes --footer-panel-h at all
 * (panelHPublished), the client marks' fade COMPLETES above the fold
 * (marksArriveOnScreen), they do NOT fade out on a downward gesture
 * (marksHoldOnRetreat — the --footer-peak rule), and the on-load entrance
 * genuinely runs rather than the blurb being final on its first drawn frame
 * (blurbNotFinalOnFirstFrame / blurbSettles). report.measured carries the
 * observed px — nothing in the design round could measure any of it.
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
// --footer (10-07) — the MOBILE HOME resting footer's reveal: the one
// scenario in this probe that GESTURES. It is a mobile scenario by
// definition (the floor only exists where Hero's frozen IS_MOBILE is true),
// so it forces the viewport itself and the pinned verifier stays flagless.
const FOOTER = !!arg('footer', false);
const MOBILE = FOOTER || !!arg('mobile', false);
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
// --footer expectations. These mirror the BAKES the scenario is gating, the
// way texbound mirrors the texture budget: Hero's FOOTER_REST_DEFAULT and
// footerTune's liftK. Pass the matching --footerrest / --footerlift when you
// dial the page with ?footerrest / ?footerlift through --extra.
const FOOTER_REST_EXPECT = Number(arg('footerrest', 0.62));
const LIFT_K_EXPECT = Number(arg('footerlift', 0.5));
const MARKS_FROM_EXPECT = Number(arg('footermarksfrom', 0.6));
const RUN = `globe-${MODE}-${MOBILE ? 'm' : 'd'}${RM ? '-rm' : ''}${ENTER ? '-enter' : ''}${FOOTER ? '-footer' : ''}`;
const OUT = arg(
  'out',
  // fileURLToPath, not URL.pathname — the Dropbox path has spaces (%20 would
  // mkdir a stray "Small%20World%20Media" tree beside the real one).
  path.join(
    process.env.GLOBE_PROBE_OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots'),
    RUN
  )
);
// --footer loads home with NO bench: the pop panel's chip parks over the hero
// and would swallow the touch scrub.
const URL_ = FOOTER
  ? `${BASE}/?intro=${INTRO}${EXTRA}`
  : `${BASE}/?popmode=${MODE}&popseed=${SEED}&poptune=1&intro=${INTRO}${EXTRA}`;

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

/* ── --footer: the MOBILE HOME resting footer's reveal ─────────────────────
   The first scenario in this probe that GESTURES. Everything the footer round
   claims is geometry under a finger, and nothing in the repo could move a
   finger — so every number in the design round was arithmetic off static CSS.
   This drives a real touch scrub through CDP Input.dispatchTouchEvent and
   MEASURES, so the gates assert observed pixels, not derivations.

   Installed BEFORE any page script (addInitScript): a rAF watcher that records
   the blurb's state on every frame it CHANGES, from the very first frame the
   document has. That is the only way to see whether the on-load entrance ran
   at all — the bug it exists to catch is a threshold the resting pose never
   crosses, which looks identical to "no animation" once it has settled. */
const FOOTER_WATCH = () => {
  const log = [];
  let frames = 0;
  const read = () => {
    const blurb = document.querySelector('.site-footer__blurb');
    if (blurb) {
      const cs = getComputedStyle(blurb);
      const words = blurb.querySelectorAll('.site-footer__blurb-word');
      let wordMax = null;
      if (words.length) {
        wordMax = 0;
        for (const w of words) {
          wordMax = Math.max(wordMax, parseFloat(getComputedStyle(w).opacity) || 0);
        }
      }
      const drawn = cs.display !== 'none' && cs.visibility !== 'hidden';
      // What the eye gets: the paragraph's own alpha times its brightest word.
      const ink = drawn
        ? (parseFloat(cs.opacity) || 0) * (wordMax == null ? 1 : wordMax)
        : 0;
      const row = {
        t: Math.round(performance.now()),
        drawn,
        opacity: Math.round((parseFloat(cs.opacity) || 0) * 1e4) / 1e4,
        words: words.length,
        wordMax: wordMax == null ? null : Math.round(wordMax * 1e4) / 1e4,
        ink: Math.round(ink * 1e4) / 1e4,
        ground: document.documentElement.hasAttribute('data-footer-in'),
        rest: document.documentElement.hasAttribute('data-footer-rest'),
      };
      const prev = log[log.length - 1];
      if (
        !prev ||
        prev.ink !== row.ink ||
        prev.drawn !== row.drawn ||
        prev.ground !== row.ground ||
        prev.rest !== row.rest
      ) {
        log.push(row);
      }
    }
    if (++frames < 420) requestAnimationFrame(read);
  };
  window.__swmFooterWatch = log;
  requestAnimationFrame(read);
};

/** One measurement of everything the reveal moves. `translate` is a real CSS
 *  property, so its COMPUTED value is already resolved to px — that is how the
 *  lift is read as a number instead of re-deriving it from a calc. */
const footerRead = (page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (k) => {
      const n = parseFloat(cs.getPropertyValue(k));
      return Number.isFinite(n) ? n : null;
    };
    const el = (sel) => document.querySelector(sel);
    const top = (sel) => {
      const e = el(sel);
      return e ? Math.round(e.getBoundingClientRect().top * 100) / 100 : null;
    };
    const opacity = (sel) => {
      const e = el(sel);
      return e ? Math.round((parseFloat(getComputedStyle(e).opacity) || 0) * 1e4) / 1e4 : null;
    };
    // translate: "none" | "<x>" | "<x> <y>" — the y is the lift (negative up).
    const liftOf = (sel) => {
      const e = el(sel);
      if (!e) return null;
      const t = getComputedStyle(e).translate;
      if (!t || t === 'none') return 0;
      const parts = t.trim().split(/\s+/);
      const y = parts.length > 1 ? parseFloat(parts[1]) : 0;
      return Number.isFinite(y) ? -Math.round(y * 100) / 100 : 0; // up = positive
    };
    return {
      reveal: v('--footer-reveal'),
      peak: v('--footer-peak'),
      rise: v('--footer-rise'),
      risePeak: v('--footer-rise-peak'),
      span: v('--footer-span'),
      panelH: v('--footer-panel-h'),
      panelTop: top('.site-footer--links'),
      globeLift: liftOf('.hero__globe'),
      strokeLift: liftOf('.hero__globe-stroke'),
      leadLift: liftOf('.hero__lead-col'),
      globeTop: top('.hero__globe'),
      strokeTop: top('.hero__globe-stroke'),
      ctaTop: top('.hero__enter'),
      rollTop: top('.logo-ticker__roll'),
      rollOpacity: opacity('.logo-ticker__roll'),
      bandOpacity: opacity('.logo-ticker'),
      strokeTransform: el('.hero__globe-stroke')
        ? getComputedStyle(el('.hero__globe-stroke')).transform
        : null,
      leadTransform: el('.hero__lead-col')
        ? getComputedStyle(el('.hero__lead-col')).transform
        : null,
    };
  });

/** A real finger. CDP touch events, because Playwright's touchscreen can tap
 *  but not drag, and Hero's reveal reads the delta BETWEEN touchmoves. */
async function touchScrub(cdp, page, { x, from, to, steps }) {
  const pt = (y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
  const trail = [];
  for (let i = 1; i <= steps; i++) {
    const y = from + ((to - from) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y) });
    trail.push(await footerRead(page));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return trail;
}

async function footerScenario(page, ctx) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.setIgnoreInputEvents', { ignore: false }).catch(() => {});
  // Past the chrome beat (0.78 × the arrive/replay settle) and the entrance.
  await sleep(3200);
  const x = Math.round(VW / 2);
  const rest = await footerRead(page);
  await shot(page, 'footer-rest');

  // UP — the reveal. 120px of finger × TOUCH_GAIN 2 ÷ SCROLL_TRIGGER_HOME_PX
  // 500 = 0.48 of progress, which clears the 1.0 clamp from the 0.62 floor
  // with room to spare, so the scrub ENDS at a full reveal and not at a number
  // that depends on the gain. The step SIZE is the other half of the point:
  // 32 steps advance ~0.04 of rise each, and these samples are the resolution
  // of every number below. At 16 steps the fold crossing read 0.12 of rise too
  // high — a derived default is only as good as the grid it was read off.
  const up = await touchScrub(cdp, page, { x, from: 320, to: 200, steps: 32 });
  await sleep(1000); // the release carry settles
  const full = await footerRead(page);
  await shot(page, 'footer-full');

  // DOWN — the retreat. The marks must HOLD (they ride the PEAK rise), which
  // is the one thing a live-progress window gets wrong, in full view.
  // The roll is on screen for only the top ~0.6 of the retreat: 220px over
  // 16 steps sampled that window 3 times, which is not enough to call a hold.
  const down = await touchScrub(cdp, page, { x, from: 180, to: 300, steps: 24 });
  const afterRetreat = await footerRead(page);
  await shot(page, 'footer-parked');
  await sleep(1200);
  const parked = await footerRead(page);

  const watch = await page.evaluate(() => window.__swmFooterWatch || []);
  return { rest, up, full, down, afterRetreat, parked, watch };
}

/** The gates, from the measurements above. */
function footerPass(f) {
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  const { rest, full, up, down } = f;
  // The panel's own climb and the hero's lift, both MEASURED.
  const climb = rest.panelTop != null && full.panelTop != null ? rest.panelTop - full.panelTop : null;
  const lift = full.globeLift;
  const ratio = climb ? lift / climb : null;
  f.measured = {
    panelH: full.panelH,
    panelClimb: climb == null ? null : Math.round(climb * 100) / 100,
    heroLift: lift,
    liftRatio: ratio == null ? null : Math.round(ratio * 1e4) / 1e4,
    liftKExpected: LIFT_K_EXPECT,
    ctaRide: rest.ctaTop != null && full.ctaTop != null ? Math.round((rest.ctaTop - full.ctaTop) * 100) / 100 : null,
    strokeRide:
      rest.strokeTop != null && full.strokeTop != null
        ? Math.round((rest.strokeTop - full.strokeTop) * 100) / 100
        : null,
    fold: VH,
  };
  // The marks' arrival: the first scrub step at which the roll is fully in,
  // and the roll's top edge there. The fade must COMPLETE on screen — a
  // window that finishes below the fold spends the whole arrival unseen.
  const arrival = up.find((s) => (s.rollOpacity ?? 0) >= 0.99);
  f.measured.marksFullAtRise = arrival ? arrival.rise : null;
  f.measured.marksFullAtRollTop = arrival ? arrival.rollTop : null;
  // Where the roll's top edge crosses the fold, in rise — the number the
  // ?footermarksfrom default IS, so it has to be better than "the first
  // sample that happened to be above the fold". INTERPOLATED across the
  // straddling pair; the trail is linear in rise, so both brackets agree.
  const ci = up.findIndex((s) => s.rollTop != null && s.rollTop < VH);
  const above = ci >= 0 ? up[ci] : null;
  const below = ci > 0 ? up[ci - 1] : null;
  const crossRise =
    below && above && below.rollTop > above.rollTop
      ? below.rise +
        ((below.rollTop - VH) / (below.rollTop - above.rollTop)) * (above.rise - below.rise)
      : above
        ? above.rise
        : null;
  f.measured.marksFoldCrossRise = crossRise == null ? null : Math.round(crossRise * 1e4) / 1e4;
  f.measured.marksFoldCrossBracket = below && above ? [below.rise, above.rise] : null;
  f.measured.marksFromExpected = MARKS_FROM_EXPECT;
  // The retreat, on screen only: off-screen the exit is masked by the panel's
  // top edge, which is the whole point of the peak.
  const onScreen = down.filter((s) => s.rollTop != null && s.rollTop < VH - 1);
  const minHeld = onScreen.length ? Math.min(...onScreen.map((s) => s.rollOpacity ?? 0)) : null;
  f.measured.retreatOnScreenSteps = onScreen.length;
  f.measured.retreatMinRollOpacity = minHeld;
  // The entrance: the first frame the blurb was DRAWN under the variant must
  // not already be final, and it must reach full ink afterwards.
  const firstDrawn = f.watch.find((r) => r.rest && r.drawn);
  const maxInk = f.watch.length ? Math.max(...f.watch.map((r) => r.ink)) : null;
  f.measured.blurbFirstDrawn = firstDrawn || null;
  f.measured.blurbMaxInk = maxInk;
  return {
    // the panel parks at ?footerrest, and the normalized rise is 0 there
    restFloor: near(rest.reveal, FOOTER_REST_EXPECT, 0.01) && near(rest.span, 1 - FOOTER_REST_EXPECT, 0.01),
    // THE --footer-reveal-vs-rise bug: a parallax off the raw var lifts the
    // globe a third of the way on the first paint
    liftZeroAtRest:
      near(rest.globeLift, 0, 0.5) && near(rest.strokeLift, 0, 0.5) && near(rest.leadLift, 0, 0.5),
    // "half the rate of the actual scroll", against the panel's own climb
    liftRatio: climb > 1 && near(ratio, LIFT_K_EXPECT, 0.03),
    // the button and the ring cannot drift from the globe
    ctaRidesGlobe: lift > 1 && near(f.measured.ctaRide, lift, 0.6),
    strokeRidesGlobe: lift > 1 && near(f.measured.strokeRide, lift, 0.6),
    // the driven mode publishes the panel height the lift denominates against
    panelHPublished: full.panelH != null && full.panelH > 1,
    // the arrival completes ABOVE the fold (this is what killed a clock-scrub
    // design: its tween finished at 846px against an 844px fold)
    marksArriveOnScreen: !!arrival && arrival.rollTop < VH,
    // the marks' fade BEGINS as their top edge touches the fold: none of it
    // is spent off-screen, and none of it is already spent when they appear.
    // ?footermarksfrom is the fixed point of this measurement, so the gate
    // holds the baked default and the CSS fallback to what the probe reads.
    marksFadeStartsAtFold: crossRise != null && near(crossRise, MARKS_FROM_EXPECT, 0.05),
    // the peak rule: no fade-out in full view on a downward gesture
    marksHoldOnRetreat: onScreen.length > 5 && minHeld >= 0.99,
    // the entrance genuinely RUNS — the gate that would have caught ask 3
    blurbNotFinalOnFirstFrame: !!firstDrawn && firstDrawn.ink < 0.5,
    blurbSettles: maxInk != null && maxInk >= 0.99,
  };
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
  // The entrance watcher must see the FIRST frame, so it is installed before
  // any page script runs.
  if (FOOTER) await page.addInitScript(FOOTER_WATCH);
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.video-globe__canvas canvas', { timeout: 30000 });

  // --footer short-circuits the population sampling loop entirely: it gates a
  // gesture, not the globe's clock, and the whole run is a few seconds.
  if (FOOTER) {
    report.footer = await footerScenario(page, ctx);
    report.pass = {
      ...footerPass(report.footer),
      clean: !report.consoleErrors.length && !report.pageErrors.length,
    };
    report.measured = report.footer.measured;
    if (report.imageFailures.length) {
      console.error(
        `globe-probe: ${report.imageFailures.length} image request(s) failed, first: ${report.imageFailures[0]}\n` +
          "  a CORS block on cdn.sanity.io = this origin is off the Sanity project's allowlist (localhost:4321, :4322, :3333 are on it)"
      );
    }
    console.log(JSON.stringify(report, null, 1));
    save();
    await browser.close().catch(() => {});
    process.exit(Object.values(report.pass).some((v) => !v) ? 2 : 0);
  }

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
  // quadrant contract); nameSlices is what each strip tile actually renders,
  // so two samples of the same world disagreeing means something moves them.
  const namesOn = stats.some((s) => s.nameStrips > 0);
  const placed = [...new Map(stats.filter((s) => s.namePlaced).map((s) => [s.namePlaced.step, s.namePlaced])).values()];
  // REGISTER: what each strip tile actually RENDERS (stats.nameSlices =
  // { lo, hi } of the strip after panelMaterial's pole-pinch centre-crop,
  // plus `w`, the slice it should be). This is the gate the "TOHOST" defect
  // needed: the texture, the span and the uv offsets were each dumped and
  // each correct, and the render still showed only the middle vK of every
  // slice, because the crop lands downstream of all of them. Tile k is in
  // register iff it renders [k·w, (k+1)·w] — full width (hi−lo = w, the
  // vK-independence the compensation buys) and in place (lo ≡ k·w, mod 1 for
  // band mode's repeat). Both errors are read AS A FRACTION OF THE SLICE,
  // because that is what legibility scales with and because the defect is
  // multiplicative: an uncompensated tile renders vK of its slice, so it is
  // off by (1−vK) — 30% at the |y| 0.72 placement that read "TOHOST", 48% at
  // the 0.85 band edge. The tolerance is 5%: the director writes the window
  // one frame before the scroll applies it, and one frame of pinch travel
  // measured up to 1.3% of a slice on a 12 fps warm-up frame. The honest
  // limit of the gate: where vK is already ≈ 1 (a row near the equator) an
  // uncompensated tile is off by less than that and will not fire — correct,
  // since there it also renders ≥ 95% of its slice and the name reads.
  // Graded only while the tile is still a tile: below PINCH_FLOOR it is under
  // 40% of a band's width — far outside the latitude band it was placed in
  // (the default admits vK ≥ 0.52), a sliver nothing reads, and a place where
  // the pinch changes fast enough per frame to swamp the measurement. Band
  // mode makes this routine: a whole row carries the strip, so the outgoing
  // row is still carrying it while it dies at the pole.
  const SLICE_TOL = 0.05;
  const PINCH_FLOOR = 0.4;
  const sliceBad = [];
  let sliceSeen = 0;
  let sliceSkipped = 0;
  let sliceWidthErr = 0;
  let sliceRegErr = 0;
  const modErr = (d) => d - Math.round(d); // registration error, mod the strip
  for (const s of stats) {
    for (const [k, r] of Object.entries(s.nameSlices || {})) {
      if (!(r.vk >= PINCH_FLOOR)) {
        sliceSkipped += 1;
        continue;
      }
      sliceSeen += 1;
      const dW = (r.hi - r.lo) / r.w - 1;
      const dR = modErr(r.lo - Number(k) * r.w) / r.w;
      sliceWidthErr = Math.max(sliceWidthErr, Math.abs(dW));
      sliceRegErr = Math.max(sliceRegErr, Math.abs(dR));
      if (Math.abs(dW) > SLICE_TOL)
        sliceBad.push(`t${s.t} step${s.step} slice ${k}: renders ${((r.hi - r.lo) / r.w).toFixed(3)} of its slice`);
      else if (Math.abs(dR) > SLICE_TOL)
        sliceBad.push(`t${s.t} step${s.step} slice ${k}: lo ${r.lo} is ${dR.toFixed(3)} of a slice off ${(Number(k) * r.w).toFixed(4)}`);
    }
  }
  // Stillness is a gate about REST, so compare only two HOLD samples of the
  // same world (the quietHolds idiom). `step` alone isn't enough: it advances
  // when a change STARTS, and the tiles swap across the lay-in's spread, so a
  // transition sample can still hold the previous world's strip — and the
  // slices are keyed by index, so slice 1 of a span-4 strip (0.25) would be
  // compared with slice 1 of the next world's span-2 strip (0.5). In a hold
  // every strip is at rest: a row re-born inside one can never carry a strip
  // (pick() consumes the plan), so nothing binds between two hold samples.
  // Compared on the RENDERED range, not the uniforms — the uniforms now track
  // the row's pinch as it scrolls, and holding that range still as they do is
  // exactly the thing the ticker's removal was meant to buy.
  const uvMoved = [];
  let uvHeld = 0; // slice comparisons actually made — 0 would pass vacuously
  for (let i = 1; i < stats.length; i++) {
    const [a, b] = [stats[i - 1], stats[i]];
    if (!a.nameSlices || !b.nameSlices || a.step !== b.step || a.seed !== b.seed) continue;
    if (a.phase !== 'hold' || b.phase !== 'hold') continue;
    for (const k of Object.keys(b.nameSlices)) {
      if (!(k in a.nameSlices)) continue;
      if (!(a.nameSlices[k].vk >= PINCH_FLOOR) || !(b.nameSlices[k].vk >= PINCH_FLOOR)) continue;
      uvHeld += 1;
      // In slice units and MOD THE REPEAT (band mode's window wraps, so a
      // still strip can read 1.0103 then 0.0104), same tolerance as the
      // register gate: each sample carries its own frame of pinch travel,
      // while a ticker moved the window by whole slices between samples.
      const d = modErr(a.nameSlices[k].lo - b.nameSlices[k].lo) / b.nameSlices[k].w;
      if (Math.abs(d) <= SLICE_TOL) continue;
      uvMoved.push(`t${b.t} step${b.step} slice ${k}: ${a.nameSlices[k].lo} → ${b.nameSlices[k].lo}`);
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
    sliceSeen,
    sliceSkipped, // tiles below PINCH_FLOOR — a strip dying at the pole
    // worst of each, as a fraction of one slice, so a regression reads as a
    // number and not only a flipped boolean: ≤ 0.013 of a slice when the
    // pinch is compensated, 1−vK (0.30 at the "TOHOST" placement, 0.48 at the
    // band edge) when it is not
    worstSliceWidthErr: sliceSeen ? Math.round(sliceWidthErr * 1e4) / 1e4 : null,
    worstSliceRegErr: sliceSeen ? Math.round(sliceRegErr * 1e4) / 1e4 : null,
    sliceBad,
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
          // band, a region strip wholly front-facing, every tile RENDERING its
          // own whole slice (namesSlice — the one that sees past the pole
          // pinch, which the other four cannot), and that render never moving
          // (the ticker is gone — tile k shows the k-th slice, for good)
          ...(namesOn
            ? {
                namesPlaced: !!names.placements.length && names.maxNameTiles > 0 && placed.every((p) => p.tiles > 0),
                namesInBand: !!placed.length && placed.every((p) => (p.yMax ?? 0) <= p.yLimit + 1e-4),
                namesFrontFacing: placed.every((p) => p.mode !== 'region' || (p.zMin ?? -1) >= p.zLimit - 1e-4),
                namesSlice: names.sliceSeen > 0 && names.sliceBad.length === 0,
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
