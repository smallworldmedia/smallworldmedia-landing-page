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
 *   F  desktop, cold landing on /work, wheel up at the first World → home
 *   D  phone, the same by a downward swipe
 *   G  desktop, /work → a project card (click) → browser Back → wheel up → home
 *   H  desktop, cold detail page, a real click on the title, then the wheel turn
 *      (activated: the turn must PUSH)
 *   R  desktop, /work World 1 → its detail (click) → band (click) → next detail;
 *      Back twice must land on World 1 (the World /work was left from)
 * WebKit (iPhone Chrome and Safari run it): K = the click paths (home Enter →
 * /work, card → detail, band → next detail) then Back each step; W = scenario A's
 * wheel turn then Back. WebKit skips back items a script added without a user
 * gesture, so a Back that lands further back than one step is a skipped item.
 * WebKit iPhone (SQ-105, an iPhone 17 Pro descriptor, touch taps, from an
 * outside page): P1 = /work → card → Back → Back → Forward → Forward;
 * P2 = /work World 2 → its card → band → Back → Back → Forward → Forward.
 * Each step is judged on the URL, on the page the DOM shows (canonical), and
 * on staying put for 5 s. --latency=ms delays ClientRouter's page fetches (a
 * phone on a branch preview). Playwright's goBack is not iOS's edge swipe: no
 * swipe snapshot, no touches during the gesture, no bfcache, no memory kills.
 *
 * Exit code: 0 when every judged scenario passes verdict(), 1 otherwise.
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

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
    const NOT = (slug) => new RegExp(`^/work/(?!${slug}$).+`);

    await run('A', false, async ({ page, rec, hist }) => {
      await page.goto(BASE + '/work/bedouin', { waitUntil: 'load' });
      await sleep(3000);
      rec.before = await hist();
      rec.notes.push(`turned=${await wheelUntil(page, 400, NOT('bedouin'), 120)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('E', true, async ({ page, rec, hist, swipe }) => {
      await page.goto(BASE + '/work/bedouin', { waitUntil: 'load' });
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
      await page.goto(BASE + '/work', { waitUntil: 'load' });
      await sleep(4000);
      rec.before = await hist();
      rec.notes.push(`home=${await wheelUntil(page, -400, /^\/$/, 40)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('D', true, async ({ page, rec, hist, swipe }) => {
      await page.goto(BASE + '/work', { waitUntil: 'load' });
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
      await page.goto(BASE + '/work', { waitUntil: 'load' });
      await sleep(4000);
      await page.locator('.fp-card__cta').first().click();
      await waitPath(page, /^\/work\/.+/);
      await sleep(3500);
      await page.goBack();
      await waitPath(page, /^\/work$/);
      await sleep(3500);
      rec.before = await hist();
      rec.notes.push(`home=${await wheelUntil(page, -400, /^\/$/, 40)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('H', false, async ({ page, rec, hist }) => {
      await page.goto(BASE + '/work/bedouin', { waitUntil: 'load' });
      await sleep(3000);
      await page.locator('h1').first().click({ force: true });
      rec.activated = true;
      rec.before = await hist();
      rec.notes.push(`turned=${await wheelUntil(page, 400, NOT('bedouin'), 120)}`);
      await sleep(2500);
      rec.after = await hist();
    });
    await run('R', false, async ({ page, rec, read }) => {
      await page.goto(BASE + '/work', { waitUntil: 'load' });
      await sleep(4000);
      rec.left = await read("document.querySelector('.fp-card__client')?.textContent");
      await page.locator('.fp-card__cta').first().click();
      await waitPath(page, /^\/work\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await page.locator('.np-band').click();
      await waitPath(page, new RegExp(`^/work/(?!${a.slice(6)}$).+`));
      await sleep(3500);
      await page.goBack();
      await waitPath(page, new RegExp(`^${a}$`));
      await sleep(3000);
      await page.goBack();
      await waitPath(page, /^\/work$/);
      await sleep(4000);
      rec.restored = await read("document.querySelector('.fp-card__client')?.textContent");
      rec.notes.push(`state=${JSON.stringify(await read('history.state'))}`);
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
      await waitPath(page, /^\/work$/);
      await sleep(4000);
      await page.locator('.fp-card__cta').first().click();
      await waitPath(page, /^\/work\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await page.locator('.np-band').click();
      await waitPath(page, new RegExp(`^/work/(?!${a.slice(6)}$).+`));
      await sleep(3500);
      await back(a);
      await back('/work');
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
            if (location.pathname.startsWith('/work/bedouin'))
              setTimeout(() => history.pushState({ ...history.state, index: 99 }, '', '/work/rossi'), 4000);
          });
        }
        await page.goto(BASE + '/work/bedouin', { waitUntil: 'load' });
        await sleep(3000);
        if (click) {
          await page.locator('h1').first().click({ force: true });
          await page.evaluate(
            () => new Promise((r) => setTimeout(() => r(history.pushState({ ...history.state, index: 99 }, '', '/work/rossi')), 1500))
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
        await page.route(/\/work(\/[^.?]*)?\/?(\?.*)?$/, async (route) => {
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
        await page.goto(BASE + '/work', { waitUntil: 'load' });
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
    // P1: /work → tap a card → Back (lands on /work, stays) → Forward.
    await phone('P1', async ({ page, rec, step }) => {
      rec.left = await client(page);
      await page.tap('.fp-card__cta');
      await waitPath(page, /^\/work\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await step('back', '/work');
      rec.restored = await client(page);
      await step('back', 'about:blank');
      await step('forward', '/work');
      await step('forward', a);
    });
    // P2: /work World 2 → tap its card → tap the band → Back, Back (/work at
    // World 2, never off the site) → Forward, Forward. (The World change is a
    // tap on [NEXT]: WebKit here has no touch-drag input.)
    await phone('P2', async ({ page, rec, step }) => {
      await page.tap('.fp-next');
      await sleep(3500);
      rec.left = await client(page);
      await page.tap('.fp-card__cta');
      await waitPath(page, /^\/work\/.+/);
      await sleep(3500);
      const a = pathOf(page.url());
      await page.tap('.np-band');
      await waitPath(page, new RegExp(`^/work/(?!${a.slice(6)}$).+`));
      await sleep(3500);
      const b = pathOf(page.url());
      await step('back', a);
      await step('back', '/work');
      rec.restored = await client(page);
      await step('forward', a);
      await step('forward', b);
    });
    await browser.close();
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
