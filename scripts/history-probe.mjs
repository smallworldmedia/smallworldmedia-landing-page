#!/usr/bin/env node
/**
 * history-probe — does browser Back stay on the site after a gesture page turn? (SQ-100)
 *
 * Usage:
 *   node scripts/history-probe.mjs --base=http://127.0.0.1:4341 [--only=A,F,R] [--out=run.json]
 *        [--engine=chromium|webkit|all]   (default all)
 * One browser probe at a time on this machine (~/swm-probe-lock.sh).
 *
 * Chromium's history-manipulation intervention marks every same-document entry
 * skippable when a page adds an entry without an honoured user activation;
 * Back then skips the whole visit. Read through CDP: Audits issue
 * `NavigationEntryMarkedSkippable`, and Page.getNavigationHistory. Page state is
 * read with Runtime.evaluate userGesture:false (page.evaluate hands the page an
 * activation and would hide the bug). Scenarios (chromium):
 *   A  desktop, cold landing on a detail page, wheel to the next-project band → turn
 *   E  phone, the same by touch swipes
 *   F  desktop, cold landing on /featured-projects, wheel up at the first World → home
 *   D  phone, the same by a downward swipe
 *   G  desktop, /featured-projects → a project card (click) → browser Back → wheel up → home
 *   H  desktop, cold detail page, a real click on the title, then the wheel turn
 *      (activated: the turn must PUSH)
 *   R  desktop, /featured-projects World 1 → its detail (click) → band (click) → next detail;
 *      Back twice must land on World 1 (the World /featured-projects was left from)
 * WebKit (iPhone Chrome and Safari run it): K = the click paths (home Enter →
 * /featured-projects, card → detail, band → next detail) then Back each step; W = scenario A's
 * wheel turn then Back. WebKit skips back items a script added without a user
 * gesture, so a Back that lands further back than one step is a skipped item.
 * WebKit iPhone (SQ-105, an iPhone 17 Pro descriptor, touch taps, from an
 * outside page): P1 = /featured-projects → card → Back → Back → Forward → Forward;
 * P2 = /featured-projects World 2 → its card → band → Back → Back → Forward → Forward.
 * Each step is judged on the URL, on the page the DOM shows (canonical), and
 * on staying put for 5 s. --latency=ms delays ClientRouter's page fetches (a
 * phone on a branch preview). SQ-141 round 2: T* = each click-started path's
 * input → pushState ms and userActivation at the push (scripts/lib/pushTimingGate.mjs),
 * TX = Back mid-dive; suffix c = Chromium, w = WebKit; --shots=dir saves TX's
 * screenshot. Playwright's goBack is not iOS's edge swipe: no
 * swipe snapshot, no touches during the gesture, no bfcache, no memory kills.
 *
 * Exit code: 0 when every judged scenario passes verdict(), 1 otherwise.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { astroProps, mediaTokens, restoreFlashVerdict } from './lib/restoreFlashGate.mjs';
import { pushTimingVerdict } from './lib/pushTimingGate.mjs';

export const SKIPPABLE = 'NavigationEntryMarkedSkippable';

// The gate, kept pure so scripts/test can run it offline. A scenario record:
// { id, skippable: n, before: [paths], after: [paths], activated?: bool,
//   left?: client, restored?: client, back?: [{ expect, got }] }
export function verdict(rec) {
  const fails = [];
  if (rec.skippable > 0) fails.push(`${rec.skippable} ${SKIPPABLE}`);
  if (rec.before && rec.after) {
    const grew = rec.after.length - rec.before.length;
    if (rec.activated && grew !== 1) fails.push(`activated turn should push (entries ${rec.before.length}→${rec.after.length})`);
    if (!rec.activated && grew !== 0) fails.push(`unactivated turn should replace (entries ${rec.before.length}→${rec.after.length})`);
  }
  if ('left' in rec && rec.left !== rec.restored) fails.push(`restored ${rec.restored}, left from ${rec.left}`);
  if (rec.flash) fails.push(...restoreFlashVerdict(rec.flash).fails);
  if (rec.pushes) fails.push(...pushTimingVerdict(rec).fails);
  for (const b of rec.back ?? []) {
    const verb = b.dir === 'forward' ? 'Forward' : 'Back';
    if (b.expect !== b.got) fails.push(`${verb} landed ${b.got}, expected ${b.expect}`);
    else if (b.trail && b.trail.length > 1) fails.push(`${verb} moved on after landing: ${b.trail.join(' → ')}`);
    // The page on screen (its canonical path) must be the entry's own; about:
    // pages have no canonical. A mismatch = a popstate the router never acted on.
    if (b.dom !== undefined && !b.expect.startsWith('about:') && b.dom !== b.expect)
      fails.push(`${verb} to ${b.expect} still shows ${b.dom}`);
  }
  return { id: rec.id, pass: fails.length === 0, fails };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The ways from home to /featured-projects (SQ-141), as real input: [id, phone?, reach].
// reach(page, read) returns a short label for the notes. The home
// wheel/touch scroll-to-enter is retired (Hero.jsx header), so XW only checks
// that a wheel never turns the page.
const tabTo = async (page, read, selector) => {
  // Safari's Tab skips buttons unless Option is held (its default setting).
  for (const key of ['Tab', 'Alt+Tab'])
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(key);
      if (await read(`!!document.activeElement?.matches(${JSON.stringify(selector)})`)) return key;
    }
  return false;
};
export const HOME_PATHS = [
  ['XN', false, async (page) => (await page.locator('.site-nav__links a[href="/featured-projects"]').click(), 'nav featured_projects click')],
  ['XE', false, async (page) => (await page.locator('.hero__enter').click(), 'Enter click')],
  ['XK', false, async (page, read) => `Tab to Enter=${await tabTo(page, read, '.hero__enter')} + Enter key${await page.keyboard.press('Enter') ?? ''}`],
  ['XW', false, async (page) => {
    await page.mouse.move(720, 450);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 400);
      await sleep(120);
    }
    return 'wheel down x30';
  }],
  ['XT', true, async (page) => (await page.tap('.hero__enter'), 'Enter tap')],
  ['XM', true, async (page) => {
    await page.tap('.site-nav__menu-pill');
    await sleep(1200);
    await page.tap('.mobile-menu__item[href="/featured-projects"]');
    return 'menu featured_projects tap';
  }],
];
const pathOf = (u) => (u.startsWith('about:') ? u : new URL(u).pathname.replace(/\/+$/, '') || '/');

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...v] = a.replace(/^--/, '').split('=');
      return [k, v.length ? v.join('=') : true];
    })
  );
  const BASE = args.base;
  if (!BASE) throw new Error('--base is required');
  const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
  const ENGINE = args.engine ?? 'all';
  const require = createRequire(import.meta.url);
  const PW = process.env.PLAYWRIGHT_PATH ?? '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
  const { chromium, webkit, devices } = require(PW);
  const results = [];
  const want = (id) => !ONLY || ONLY.has(id);

  const waitPath = async (page, re, ms = 15000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      if (re.test(pathOf(page.url()))) return true;
      await sleep(150);
    }
    return false;
  };
  const wheelUntil = async (page, dy, re, n) => {
    await page.mouse.move(720, 450);
    for (let i = 0; i < n; i++) {
      await page.mouse.wheel(0, dy);
      await sleep(120);
      if (re.test(pathOf(page.url()))) return true;
    }
    return waitPath(page, re, 4000);
  };

  // ── Chromium: CDP issues + navigation history ──
  if (ENGINE !== 'webkit') {
    const browser = await chromium.launch({ headless: true });
    const run = async (id, mobile, fn) => {
      if (!want(id)) return;
      const ctx = await browser.newContext(
        mobile
          ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
          : { viewport: { width: 1440, height: 900 } }
      );
      const page = await ctx.newPage();
      const cdp = await ctx.newCDPSession(page);
      const rec = { id, skippable: 0, notes: [] };
      cdp.on('Audits.issueAdded', ({ issue }) => {
        if (issue.details?.genericIssueDetails?.errorType === SKIPPABLE) rec.skippable++;
      });
      await cdp.send('Audits.enable');
      // Entries up to the current one: after a Back, a push prunes the forward
      // entries, so only the back stack says push (+1) from replace (±0).
      const hist = async () => {
        const h = await cdp.send('Page.getNavigationHistory');
        return h.entries.slice(0, h.currentIndex + 1).map((e) => pathOf(e.url));
      };
      const read = async (expression) =>
        (await cdp.send('Runtime.evaluate', { expression, returnByValue: true, userGesture: false })).result.value;
      const swipe = async (dy, steps = 12) => {
        const x = 195;
        const y0 = dy > 0 ? 250 : 600;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
        for (let i = 1; i <= steps; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (dy * i) / steps }] });
          await sleep(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      try {
        await fn({ page, rec, hist, read, swipe });
      } catch (e) {
        rec.notes.push('ERR ' + e.message);
        rec.skippable += 1000; // an aborted scenario never passes
      }
      rec.final = await hist();
      results.push(rec);
      await ctx.close();
    };
    const NOT = (slug) => new RegExp(`^/featured-projects/(?!${slug}$).+`);

    await run('A', false, async ({ page, rec, hist }) => {
      await page.goto(BASE + '/featured-projects/bedouin', { waitUntil: 'load' });
      await sleep(3000);
      rec.before = await hist();
      rec.notes.push(`turned=${await wheelUntil(page, 400, NOT('bedouin'), 120)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('E', true, async ({ page, rec, hist, swipe }) => {
      await page.goto(BASE + '/featured-projects/bedouin', { waitUntil: 'load' });
      await sleep(3000);
      rec.before = await hist();
      for (let i = 0; i < 60 && /bedouin/.test(page.url()); i++) {
        await swipe(-450, 8);
        await sleep(250);
      }
      await sleep(2500);
      rec.notes.push(`at=${pathOf(page.url())}`);
      rec.after = await hist();
    });
    await run('F', false, async ({ page, rec, hist }) => {
      await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
      await sleep(4000);
      rec.before = await hist();
      rec.notes.push(`home=${await wheelUntil(page, -400, /^\/$/, 40)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('D', true, async ({ page, rec, hist, swipe }) => {
      await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
      await sleep(4000);
      rec.before = await hist();
      for (let i = 0; i < 4 && pathOf(page.url()) !== '/'; i++) {
        await swipe(320);
        await sleep(1500);
      }
      await sleep(2500);
      rec.notes.push(`at=${pathOf(page.url())}`);
      rec.after = await hist();
    });
    await run('G', false, async ({ page, rec, hist }) => {
      await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
      await sleep(4000);
      await page.locator('.fp-card__cta').first().click();
      await waitPath(page, /^\/featured-projects\/.+/);
      await sleep(3500);
      await page.goBack();
      await waitPath(page, /^\/featured-projects$/);
      await sleep(3500);
      rec.before = await hist();
      rec.notes.push(`home=${await wheelUntil(page, -400, /^\/$/, 40)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('H', false, async ({ page, rec, hist }) => {
      await page.goto(BASE + '/featured-projects/bedouin', { waitUntil: 'load' });
      await sleep(3000);
      await page.locator('h1').first().click({ force: true });
      rec.activated = true;
      rec.before = await hist();
      rec.notes.push(`turned=${await wheelUntil(page, 400, NOT('bedouin'), 120)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('R', false, async ({ page, rec, read }) => {
      await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
      await sleep(4000);
      rec.left = await read("document.querySelector('.fp-card__client')?.textContent");
      await page.locator('.fp-card__cta').first().click();
      await waitPath(page, /^\/featured-projects\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await page.locator('.np-band').click();
      await waitPath(page, new RegExp(`^/featured-projects/(?!${a.slice(6)}$).+`));
      await sleep(3500);
      await page.goBack();
      await waitPath(page, new RegExp(`^${a}$`));
      await sleep(3000);
      await page.goBack();
      await waitPath(page, /^\/featured-projects$/);
      await sleep(4000);
      rec.restored = await read("document.querySelector('.fp-card__client')?.textContent");
      rec.notes.push(`state=${JSON.stringify(await read('history.state'))}`);
    });
    // ── Home → /featured-projects by each entry path, from an outside page (SQ-141, Nathan
    // 11-24: Back from /featured-projects left the site). Real input only. Judged on the
    // skippable count (Chrome's Back button skips those entries; Playwright's
    // goBack walks CDP history and would not) and on two Backs: home, then
    // the outside page. ──
    const fromHome = (id, mobile, reach, onWork) =>
      run(id, mobile, async ({ page, rec, read, swipe }) => {
        rec.back = [];
        await page.goto('about:blank');
        await page.goto(BASE + '/', { waitUntil: 'load' });
        await sleep(3500);
        rec.notes.push(`via=${await reach(page, read)}`);
        const atWork = await waitPath(page, /^\/featured-projects$/, id === 'XW' ? 5000 : 15000);
        rec.notes.push(`atWork=${atWork}`);
        if (!atWork && id === 'XW') return; // retired gesture: staying home is the pass
        if (!atWork) throw new Error('never reached /featured-projects');
        await sleep(3500);
        // A wander on /featured-projects first (World Turns, a wheel home and back in):
        // onWork returns the Backs it expects before home.
        const extra = onWork ? await onWork({ page, swipe, rec }) : [];
        for (const expect of [...extra, '/', 'about:blank']) {
          await page.goBack({ timeout: 8000 }).catch(() => {});
          await sleep(2500);
          rec.back.push({ expect, got: pathOf(page.url()) });
        }
      });
    for (const [id, mobile, reach] of HOME_PATHS) await fromHome(id, mobile, reach);
    const reachOf = (want) => HOME_PATHS.find(([id]) => id === want)[2];
    // XEt / XTt: Enter, then three World Turns on /featured-projects (wheel / swipe), Back.
    await fromHome('XEt', false, reachOf('XE'), async ({ page }) => {
      await page.mouse.move(720, 450);
      for (let i = 0; i < 3; i++) {
        await page.mouse.wheel(0, 400);
        await sleep(2500);
      }
      return [];
    });
    await fromHome('XTt', true, reachOf('XT'), async ({ swipe }) => {
      for (let i = 0; i < 3; i++) {
        await swipe(-320);
        await sleep(2500);
      }
      return [];
    });
    // XEr: Enter, wheel up home at World 1, Enter again; Back walks it all. Enter lands on the
    // globe's World, often a late one, so the wheel needs room to Turn back to World 1 first: 40
    // wheels (~9 s) ran out on Imperfect Records before and after SQ-141; 300 reach home.
    await fromHome('XEr', false, reachOf('XE'), async ({ page, rec }) => {
      rec.notes.push(`home=${await wheelUntil(page, -400, /^\/$/, 300)}`);
      await sleep(3500);
      await page.locator('.hero__enter').click();
      rec.notes.push(`again=${await waitPath(page, /^\/featured-projects$/)}`);
      await sleep(3500);
      return ['/', '/featured-projects'];
    });
    await browser.close();
  }

  // ── WebKit: where does Back land? (no CDP; a skipped item shows as a Back
  // that overshoots). Measurement first; judged like any other scenario. ──
  if (ENGINE !== 'chromium') {
    const browser = await webkit.launch({ headless: true });
    const wk = async (id, fn) => {
      if (!want(id)) return;
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const rec = { id, skippable: 0, back: [], notes: [] };
      const back = async (expect) => {
        await page.goBack({ timeout: 8000 }).catch(() => {});
        await sleep(2500);
        rec.back.push({ expect, got: pathOf(page.url()) });
      };
      try {
        await fn({ page, rec, back });
      } catch (e) {
        rec.notes.push('ERR ' + e.message);
        rec.skippable += 1000;
      }
      results.push(rec);
      await ctx.close();
    };
    await wk('K', async ({ page, back }) => {
      await page.goto(BASE + '/', { waitUntil: 'load' });
      await sleep(3000);
      await page.locator('.hero__enter').click();
      await waitPath(page, /^\/featured-projects$/);
      await sleep(4000);
      await page.locator('.fp-card__cta').first().click();
      await waitPath(page, /^\/featured-projects\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await page.locator('.np-band').click();
      await waitPath(page, new RegExp(`^/featured-projects/(?!${a.slice(6)}$).+`));
      await sleep(3500);
      await back(a);
      await back('/featured-projects');
      await back('/');
    });
    // W and V are measurements, not judged (headless WebKit's wheel never
    // reaches the band, so the gesture turn is stood in for by a bare script
    // push 4 s after load): W = no interaction at all; V = a real click on the
    // title, then the push 1.5 s later (past WebKit's 1 s gesture carry). Back
    // landing on about:blank means WebKit skipped bedouin — the positive
    // control that Playwright's Back honours WebKit's skipping at all.
    // (Playwright's evaluate may carry a gesture, so W's push is an init
    // script timer and V's waits 1.5 s, past any carry.)
    const scripted = async (id, click) =>
      wk(id, async ({ page, rec }) => {
        if (!click) {
          await page.addInitScript(() => {
            if (location.pathname.startsWith('/featured-projects/bedouin'))
              setTimeout(() => history.pushState({ ...history.state, index: 99 }, '', '/featured-projects/rossi'), 4000);
          });
        }
        await page.goto(BASE + '/featured-projects/bedouin', { waitUntil: 'load' });
        await sleep(3000);
        if (click) {
          await page.locator('h1').first().click({ force: true });
          await page.evaluate(
            () => new Promise((r) => setTimeout(() => r(history.pushState({ ...history.state, index: 99 }, '', '/featured-projects/rossi')), 1500))
          );
        }
        await sleep(2000);
        rec.notes.push(`pushed=${pathOf(page.url())}`);
        await page.goBack({ timeout: 8000 }).catch(() => {});
        await sleep(2500);
        rec.notes.push(`backLanded=${pathOf(page.url())}`);
      });
    await scripted('W', false);
    await scripted('V', true);

    // ── iPhone (SQ-105): an iPhone 17 Pro descriptor (isMobile, hasTouch),
    // touch taps, Nathan's two sequences from an outside page, then Forward.
    // Each step is judged on the URL AND on the page the DOM shows (its
    // canonical link — a popstate ClientRouter never acts on leaves the old
    // page up under the new URL), watched for 5 s so a snap forward shows. ──
    const phone = async (id, fn) => {
      if (!want(id)) return;
      const ctx = await browser.newContext({ ...devices['iPhone 17 Pro'] });
      const page = await ctx.newPage();
      const rec = { id, skippable: 0, back: [], notes: [] };
      const LATENCY = Number(args.latency ?? 0);
      if (LATENCY > 0)
        await page.route(/\/featured-projects(\/[^.?]*)?\/?(\?.*)?$/, async (route) => {
          if (route.request().resourceType() !== 'document') await sleep(LATENCY);
          await route.continue();
        });
      const shown = () =>
        page.evaluate(() => {
          const c = document.querySelector('link[rel=canonical]')?.getAttribute('href');
          return c ? new URL(c).pathname.replace(/\/+$/, '') || '/' : null;
        });
      const step = async (dir, expect) => {
        await (dir === 'back' ? page.goBack({ timeout: 8000 }) : page.goForward({ timeout: 8000 })).catch(() => {});
        const trail = [];
        for (let t = 0; t < 50; t++) {
          const p = pathOf(page.url());
          if (trail[trail.length - 1] !== p) trail.push(p);
          await sleep(100);
        }
        rec.back.push({ dir, expect, got: pathOf(page.url()), dom: await shown(), trail });
      };
      try {
        await page.goto('about:blank'); // the outside page he came from
        await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
        await sleep(4500);
        await fn({ page, rec, step });
      } catch (e) {
        rec.notes.push('ERR ' + e.message);
        rec.skippable += 1000;
      }
      results.push(rec);
      await ctx.close();
    };
    const client = (page) => page.evaluate(() => document.querySelector('.fp-card__client')?.textContent);
    // P1: /featured-projects → tap a card → Back (lands on /featured-projects, stays) → Forward.
    await phone('P1', async ({ page, rec, step }) => {
      rec.left = await client(page);
      await page.tap('.fp-card__cta');
      await waitPath(page, /^\/featured-projects\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await step('back', '/featured-projects');
      rec.restored = await client(page);
      await step('back', 'about:blank');
      await step('forward', '/featured-projects');
      await step('forward', a);
    });
    // P2: /featured-projects World 2 → tap its card → tap the band → Back, Back (/featured-projects at
    // World 2, never off the site) → Forward, Forward. (The World change is a
    // tap on [NEXT]: WebKit here has no touch-drag input.)
    await phone('P2', async ({ page, rec, step }) => {
      await page.tap('.fp-next');
      await sleep(3500);
      rec.left = await client(page);
      await page.tap('.fp-card__cta');
      await waitPath(page, /^\/featured-projects\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await page.tap('.np-band');
      await waitPath(page, new RegExp(`^/featured-projects/(?!${a.slice(6)}$).+`));
      await sleep(3500);
      const b = pathOf(page.url());
      await step('back', a);
      await step('back', '/featured-projects');
      rec.restored = await client(page);
      await step('forward', a);
      await step('forward', b);
    });
    // SQ-141 in WebKit: desktop Safari for the desktop paths, the iPhone 17
    // Pro descriptor (touch) for the phone ones. WebKit's goBack skips what
    // WebKit marks skippable, so the two landings judge it directly.
    for (const [base, mobile, reach] of HOME_PATHS) {
      const id = base + 'w';
      if (!want(id)) continue;
      const ctx = await browser.newContext(mobile ? { ...devices['iPhone 17 Pro'] } : { viewport: { width: 1440, height: 900 } });
      const page = await ctx.newPage();
      const rec = { id, skippable: 0, back: [], notes: [] };
      const LATENCY = Number(args.latency ?? 0); // the router's /featured-projects fetch, as on a phone network
      if (LATENCY > 0)
        await page.route(/\/featured-projects\/?(\?.*)?$/, async (route) => {
          if (route.request().resourceType() !== 'document') await sleep(LATENCY);
          await route.continue();
        });
      try {
        await page.goto('about:blank');
        await page.goto(BASE + '/', { waitUntil: 'load' });
        await sleep(3500);
        rec.notes.push(`via=${await reach(page, (e) => page.evaluate(e))}`);
        const atWork = await waitPath(page, /^\/featured-projects$/, base === 'XW' ? 5000 : 15000);
        rec.notes.push(`atWork=${atWork}`);
        if (atWork) {
          await sleep(3500);
          for (const expect of ['/', 'about:blank']) {
            await page.goBack({ timeout: 8000 }).catch(() => {});
            await sleep(2500);
            rec.back.push({ expect, got: pathOf(page.url()) });
          }
        } else if (base !== 'XW') throw new Error('never reached /featured-projects');
      } catch (e) {
        rec.notes.push('ERR ' + e.message);
        rec.skippable += 1000;
      }
      results.push(rec);
      await ctx.close();
    }
    await browser.close();
  }

  // ── Push timing (SQ-141 round 2): every click-started path, the ms from its
  // input to the pushState that creates the destination entry, and
  // userActivation.isActive at that push. Judged by scripts/lib/pushTimingGate.mjs
  // (≤ 1000 ms, active). Chromium: desktop (click, key) or phone (tap) per path;
  // WebKit: the iPhone 17 Pro descriptor, taps (TK runs desktop WebKit, keys).
  // TX = Back pressed 400 ms into home's Enter dive: lands on home, the page
  // shows home, and the next Back leaves the site (no stray /featured-projects entry). ──
  const PUSH_PATHS = [
    // [id, start, dest, phone?, act(page, read, tap)]
    ['TE', '/', '^/featured-projects$', false, (p) => p.locator('.hero__enter').click()],
    ['TT', '/', '^/featured-projects$', true, (p) => p.tap('.hero__enter')],
    ['TK', '/', '^/featured-projects$', false, async (p, read) => (await tabTo(p, read, '.hero__enter'), p.keyboard.press('Enter'))],
    ['TN', '/', '^/featured-projects$', false, (p) => p.locator('.site-nav__links a[href="/featured-projects"]').click()],
    ['TM', '/', '^/featured-projects$', true, async (p) => (await p.tap('.site-nav__menu-pill'), await sleep(1200), p.tap('.mobile-menu__item[href="/featured-projects"]'))],
    ['TL', '/featured-projects', '^/$', null, (p, _r, tap) => (tap ? p.tap('.site-nav__logo:visible') : p.locator('.site-nav__logo:visible').first().click())],
    ['TZ', '/featured-projects', '^/featured-projects/.+', null, (p, _r, tap) => (tap ? p.tap('.fp-card__cta') : p.locator('.fp-card__cta').first().click())],
    ['TB', '/featured-projects/bedouin', '^/featured-projects/(?!bedouin$).+', null, (p, _r, tap) => (tap ? p.tap('.np-band') : p.locator('.np-band').click())],
    ['TC', '/featured-projects/bedouin', '^/featured-projects/(?!bedouin$).+', null, (p, _r, tap) => (tap ? p.tap('.detail-next') : p.locator('.detail-next').click())],
    ['TR', '/featured-projects/bedouin', '^/featured-projects$', null, (p, _r, tap) => (tap ? p.tap('.detail-breadcrumb') : p.locator('.detail-breadcrumb').click())],
  ];
  const TIMING = [...PUSH_PATHS.flatMap(([id]) => [id + 'c', id + 'w']), 'TXc', 'TXw'];
  if (TIMING.some(want)) {
    const recorder = () => {
      const r = (window.__pt = { inputs: [], pushes: [] });
      for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'])
        addEventListener(type, (e) => e.isTrusted && r.inputs.push({ t: performance.now(), type }), { capture: true });
      const push = history.pushState;
      history.pushState = function (s, t, url) {
        r.pushes.push({ t: performance.now(), path: new URL(url ?? location.href, location.href).pathname, active: navigator.userActivation?.isActive ?? null });
        return push.apply(this, arguments);
      };
    };
    for (const [engine, type] of [['c', chromium], ['w', webkit]]) {
      if (ENGINE !== 'all' && ENGINE !== (engine === 'c' ? 'chromium' : 'webkit')) continue;
      if (!TIMING.some((id) => id.endsWith(engine) && want(id))) continue;
      const browser = await type.launch({ headless: true });
      const { defaultBrowserType, ...iphone } = devices['iPhone 17 Pro'];
      const ctxFor = (phone) =>
        browser.newContext(
          !phone
            ? { viewport: { width: 1440, height: 900 } }
            : engine === 'w'
              ? iphone
              : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true }
        );
      for (const [base, start, dest, phoneOnly, act] of PUSH_PATHS) {
        const id = base + engine;
        if (!want(id)) continue;
        // WebKit runs every path as an iPhone tap except the desktop-only UI
        // (the keyboard, the desktop nav links), which runs desktop WebKit.
        const phone = engine === 'w' ? !['TK', 'TN'].includes(base) : phoneOnly === true;
        const ctx = await ctxFor(phone);
        await ctx.addInitScript(recorder);
        const page = await ctx.newPage();
        const rec = { id, dest, skippable: 0, notes: [] };
        try {
          await page.goto(BASE + start, { waitUntil: 'load' });
          await sleep(start === '/' ? 3500 : 4500);
          await page.evaluate(() => (window.__pt.inputs.length = 0));
          await act(page, (e) => page.evaluate(e), phone);
          await waitPath(page, new RegExp(dest), 15000);
          await sleep(1500);
          Object.assign(rec, await page.evaluate(() => ({ inputs: window.__pt.inputs, pushes: window.__pt.pushes })));
          rec.timing = pushTimingVerdict(rec);
          rec.notes.push(`at=${pathOf(page.url())} ms=${rec.timing.ms} active=${rec.timing.active} pushes=${rec.pushes.map((p) => p.path).join(',')}`);
        } catch (e) {
          rec.notes.push('ERR ' + e.message);
          rec.skippable += 1000;
        }
        results.push(rec);
        await ctx.close();
      }
      if (want('TX' + engine)) {
        const ctx = await ctxFor(engine === 'w');
        const page = await ctx.newPage();
        const rec = { id: 'TX' + engine, skippable: 0, back: [], notes: [] };
        const shown = () =>
          page.evaluate(() => {
            const c = document.querySelector('link[rel=canonical]')?.getAttribute('href');
            return c ? new URL(c).pathname.replace(/\/+$/, '') || '/' : null;
          });
        try {
          await page.goto('about:blank');
          await page.goto(BASE + '/', { waitUntil: 'load' });
          await sleep(3500);
          await (engine === 'w' ? page.tap('.hero__enter') : page.locator('.hero__enter').click());
          await sleep(400);
          rec.notes.push(`midDive=${pathOf(page.url())}`);
          await page.goBack({ timeout: 8000 }).catch(() => {});
          const trail = [];
          for (let t = 0; t < 50; t++) {
            const p = pathOf(page.url());
            if (trail[trail.length - 1] !== p) trail.push(p);
            await sleep(100);
          }
          rec.back.push({ dir: 'back', expect: '/', got: pathOf(page.url()), dom: await shown(), trail });
          if (args.shots) await page.screenshot({ path: `${args.shots}/TX${engine}-after-back.png` });
          await page.goBack({ timeout: 8000 }).catch(() => {});
          await sleep(2500);
          rec.back.push({ dir: 'back', expect: 'about:blank', got: pathOf(page.url()) });
        } catch (e) {
          rec.notes.push('ERR ' + e.message);
          rec.skippable += 1000;
        }
        results.push(rec);
        await ctx.close();
      }
      await browser.close();
    }
  }

  // ── Return-restore first frame (SQ-131, Nathan 11-20 row 130: Back to /featured-projects
  // "briefly shows the first project begin to populate (coco)"). iPhone 17 Pro
  // geometry (402x874 @3, touch) in BOTH engines. From the swap, every frame's
  // visible cards (client names; nothing counts under the full passage cover)
  // and every request are kept, then judged by scripts/lib/restoreFlashGate.mjs:
  // the first card shown is the World left, World 1's card never shows and its
  // media is never requested. RF* = Back, RB* = the detail breadcrumb, RC* = a
  // cold /featured-projects load (World 1), RE* = Enter World from the home globe (the
  // globe's World). Suffix c = Chromium, w = WebKit. ──
  const FLASH = ['RFc', 'RBc', 'RCc', 'REc', 'RFw', 'RBw', 'RCw', 'REw'];
  if (FLASH.some(want)) {
    const sampler = () => {
      const s = (window.__rf = { on: false, frames: [], t0: 0 });
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
        return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true }) : true;
      };
      const tick = () => {
        if (s.on) {
          const fill = document.querySelector('.route-fill');
          const cs = fill && getComputedStyle(fill);
          s.frames.push({
            t: Math.round(performance.now() - s.t0),
            path: location.pathname,
            covered: !!cs && cs.visibility !== 'hidden' && parseFloat(cs.opacity) >= 0.99,
            cards: [...document.querySelectorAll('.fp-card__client')].filter(vis).map((el) => el.textContent),
          });
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      s.start = () => {
        s.t0 = performance.now();
        s.on = true;
      };
      // The globe's handover (Hero writes it; /featured-projects reads and drops it).
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === 'swm:enterWorld') window.__enterWorld = v;
        return set.call(this, k, v);
      };
    };
    const worldsOf = async (page) =>
      astroProps(
        JSON.parse(
          await page.evaluate(() => document.querySelector('astro-island[component-url*="FeaturedProjects"]')?.getAttribute('props') ?? '{}')
        )
      ).worlds ?? [];
    for (const [engine, type] of [['c', chromium], ['w', webkit]]) {
      if (ENGINE !== 'all' && ENGINE !== (engine === 'c' ? 'chromium' : 'webkit')) continue;
      if (!FLASH.some((id) => id.endsWith(engine) && want(id))) continue;
      const browser = await type.launch({ headless: true });
      const flash = async (id, fn) => {
        if (!want(id + engine)) return;
        const { defaultBrowserType, ...phone } = devices['iPhone 17 Pro'];
        const ctx = await browser.newContext(phone);
        await ctx.addInitScript(sampler);
        const page = await ctx.newPage();
        const rec = { id: id + engine, skippable: 0, notes: [] };
        let requests = null;
        page.on('request', (r) => requests?.push(r.url()));
        const reset = () => {
          requests = [];
        };
        const begin = async () => {
          reset();
          await page.evaluate(() => window.__rf.start());
        };
        try {
          const { expectIndex } = await fn({ page, begin, reset, rec });
          await sleep(5000);
          const frames = await page.evaluate(() => window.__rf.frames.filter((f) => f.path.replace(/\/+$/, '') === '/featured-projects'));
          const worlds = await worldsOf(page);
          const expect = worlds[expectIndex]?.clientName;
          const forbid = worlds[0]?.clientName;
          const keep = new Set(mediaTokens(worlds[expectIndex]));
          rec.flash = { expect, forbid, frames, requests, forbidTokens: mediaTokens(worlds[0]).filter((t) => !keep.has(t)) };
          const first = frames.find((f) => !f.covered && f.cards.length);
          rec.notes.push(`expect=${expect} frames=${frames.length} firstCard=${first?.cards.join('+')}@${first?.t}ms requests=${requests.length}`);
        } catch (e) {
          rec.notes.push('ERR ' + e.message);
          rec.skippable += 1000;
        }
        results.push(rec);
        await ctx.close();
      };
      // /featured-projects World 3 → its card → back to /featured-projects by `back` (browser Back or the breadcrumb).
      const leaveWorld3 = (back) => async ({ page, begin, rec }) => {
        await page.goto('about:blank');
        await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
        await sleep(4500);
        for (let i = 0; i < 2; i++) {
          await page.tap('.fp-next');
          await sleep(3000);
        }
        rec.notes.push('left=' + (await page.evaluate(() => document.querySelector('.fp-card__client')?.textContent)));
        await page.tap('.fp-card__cta');
        await waitPath(page, /^\/featured-projects\/.+/);
        await sleep(3500);
        await begin();
        await back(page);
        await waitPath(page, /^\/featured-projects$/);
        return { expectIndex: 2 };
      };
      await flash('RF', leaveWorld3((page) => page.goBack({ timeout: 8000 }).catch(() => {})));
      await flash('RB', leaveWorld3((page) => page.tap('.detail-breadcrumb')));
      await flash('RC', async ({ page, reset }) => {
        await page.goto('about:blank');
        await page.addInitScript(() => window.__rf?.start()); // after the sampler's: frames from the first one
        reset();
        await page.goto(BASE + '/featured-projects', { waitUntil: 'load' });
        return { expectIndex: 0 };
      });
      await flash('RE', async ({ page, begin }) => {
        await page.goto(BASE + '/', { waitUntil: 'load' });
        await sleep(3000);
        await begin();
        await page.tap('.hero__enter');
        // The URL is /featured-projects from the tap on (SQ-141 holdEntry): wait for the swap itself.
        await page.waitForFunction(() => !!document.querySelector('astro-island[component-url*="FeaturedProjects"]'), null, { timeout: 15000 });
        await sleep(500);
        const slug = await page.evaluate(() => window.__enterWorld ?? null);
        const worlds = await worldsOf(page);
        return { expectIndex: Math.max(0, worlds.findIndex((w) => w.slug === slug)) };
      });
      await browser.close();
    }
  }

  const verdicts = results.map(verdict);
  for (const r of results) {
    const v = verdicts.find((x) => x.id === r.id);
    console.log(`${r.id} ${v.pass ? 'PASS' : 'FAIL'} skippable=${r.skippable} ${r.before ? `entries ${r.before.length}→${r.after?.length}` : ''} final=${(r.final ?? []).join(' > ')} ${r.notes.join(' ')} ${v.fails.join('; ')}${r.back ? ' back=' + JSON.stringify(r.back) : ''}${'left' in r ? ` left=${r.left} restored=${r.restored}` : ''}`);
  }
  if (args.out) writeFileSync(args.out, JSON.stringify({ base: BASE, results, verdicts }, null, 2));
  process.exitCode = verdicts.every((v) => v.pass) ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
