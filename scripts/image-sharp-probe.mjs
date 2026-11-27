#!/usr/bin/env node
/**
 * image-sharp-probe (SQ-150) — are the DOM images that were fitted to their drawn size still sharp?
 *
 * Usage:
 *   node scripts/image-sharp-probe.mjs --base=http://localhost:4416 [--paths=/featured-projects/bedouin/,/]
 *        [--viewports=390x844@3,1440x900@2] [--out=FILE.json]
 *
 * Loads each page at each viewport (a width of 480 or less is a touch phone), scrolls it end to end
 * so every lazy image loads, and reads every Mux thumbnail and every raster client logo in the DOM:
 * the file the browser chose (naturalWidth), the width CSS draws it at, the device pixel ratio and
 * the source's own width. Each goes through scripts/lib/imageSharpGate.mjs
 * (naturalWidth >= min(drawn x dpr, source width)). Mux streams are aborted (only images matter).
 * It also sums the bytes the images transferred (CDP encodedDataLength).
 *
 *   gated   = an <img> that carries a srcset: the ones SQ-150 fitted. Exit 2 when one fails.
 *   others  = the rest (the eager hero's fixed width, say): listed with their verdict, never gated.
 *
 * Source width: a logo's own manifest width (the <li data-w>); a Mux thumbnail's is the pipeline's
 * top rung, MUX_SOURCE_SHORT x max(1, ratio) (imageConfig.deckSourceWidth), ratio read off the file.
 * Serve a build first (`npx astro preview --port 4416`, or any static server over dist/).
 * Playwright is not a project dependency: PLAYWRIGHT_PATH, as in layout-probe.mjs.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { isSharp } from './lib/imageSharpGate.mjs';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.slice(k.length + 3) : d;
};
const base = arg('base', process.env.IMAGE_SHARP_BASE);
if (!base) {
  console.error('image-sharp-probe: --base=URL is required\n  node scripts/image-sharp-probe.mjs --base=http://localhost:4416 [--paths=/featured-projects/bedouin/,/] [--viewports=390x844@3,1440x900@2] [--out=FILE]');
  process.exit(1);
}
const paths = arg('paths', '/featured-projects/bedouin/,/').split(',').filter(Boolean);
const viewports = arg('viewports', '390x844@3,1440x900@2')
  .split(',')
  .map((v) => {
    const [, w, h, d] = v.match(/^(\d+)x(\d+)@([\d.]+)$/) || [];
    if (!w) throw new Error(`bad viewport ${v}`);
    return { w: Number(w), h: Number(h), dpr: Number(d) };
  });
const out = arg('out', '');
const MUX_SOURCE_SHORT = 1080; // imageConfig.js; the pipeline's top rung
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page: every Mux thumbnail and raster logo <img>, with the numbers the gate needs.
// img.naturalWidth is the file's pixels divided by the density its srcset gave it (a w descriptor
// against `sizes`, or an x descriptor), so the file's own width is read off a fresh <img> that has
// the chosen URL alone (a cache hit, no srcset, no CORS).
async function readImages() {
  const rows = [...document.images]
    .map((img) => {
      const src = img.currentSrc || img.src;
      const mux = /^https:\/\/image\.mux\.com\//.test(src);
      const logo = img.classList.contains('logo-ticker__img') && !/\.svg(\?|$)/.test(src);
      if (!mux && !logo) return null;
      const r = img.getBoundingClientRect();
      const li = img.closest('li[data-w]');
      return {
        kind: mux ? 'mux' : 'logo',
        src,
        hasSrcset: img.hasAttribute('srcset'),
        eager: img.loading === 'eager',
        renderedWidth: r.width,
        manifestWidth: li ? Number(li.dataset.w) : null,
        complete: img.complete && img.naturalWidth > 0,
      };
    })
    .filter(Boolean);
  await Promise.all(
    rows.map(async (row) => {
      row.naturalWidth = 0;
      row.naturalHeight = 0;
      if (!row.complete) return;
      const probe = new Image();
      probe.src = row.src;
      try {
        await probe.decode();
        row.naturalWidth = probe.naturalWidth;
        row.naturalHeight = probe.naturalHeight;
      } catch {
        /* left at 0: not sharp */
      }
    })
  );
  return rows;
}

const main = async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(
    process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
  );
  const browser = await chromium.launch();
  const report = [];
  let failed = 0;
  try {
    for (const vp of viewports) {
      for (const path of paths) {
        const phone = vp.w <= 480;
        const ctx = await browser.newContext({
          viewport: { width: vp.w, height: vp.h },
          deviceScaleFactor: vp.dpr,
          isMobile: phone,
          hasTouch: phone,
          reducedMotion: 'reduce',
        });
        await ctx.route(/stream\.mux\.com|\.m4s|\.ts(\?|$)/, (route) => route.abort());
        const page = await ctx.newPage();
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Network.enable');
        const types = new Map(); // requestId -> resource type
        const bytes = { image: 0, mux: 0, logo: 0, n: 0 };
        const urls = new Map();
        cdp.on('Network.requestWillBeSent', (e) => {
          types.set(e.requestId, e.type);
          urls.set(e.requestId, e.request.url);
        });
        cdp.on('Network.loadingFinished', (e) => {
          if (types.get(e.requestId) !== 'Image') return;
          const url = urls.get(e.requestId) || '';
          bytes.image += e.encodedDataLength;
          bytes.n += 1;
          if (/image\.mux\.com/.test(url)) bytes.mux += e.encodedDataLength;
        });
        await page.goto(new URL(path, base).href, { waitUntil: 'load' });
        await sleep(1500);
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        for (let y = 0; y < total + vp.h; y += Math.round(vp.h * 0.6)) {
          await page.mouse.wheel(0, Math.round(vp.h * 0.6));
          await sleep(350);
        }
        await sleep(2500);
        const imgs = await page.evaluate(readImages);
        const rows = imgs.map((i) => {
          const ratio = i.naturalWidth / i.naturalHeight;
          const source = i.kind === 'logo' ? i.manifestWidth : Math.round(MUX_SOURCE_SHORT * Math.max(1, ratio));
          const pass = isSharp(i.naturalWidth, i.renderedWidth, vp.dpr, source);
          return { ...i, sourceWidth: source, pass, gated: i.hasSrcset };
        });
        const bad = rows.filter((r) => r.gated && !r.pass);
        failed += bad.length;
        // logos' hidden twin track is aria-hidden but still an <img> of the same file: both are read
        const gated = rows.filter((r) => r.gated);
        const summary = {
          page: path,
          viewport: `${vp.w}x${vp.h}@${vp.dpr}`,
          images: rows.length,
          gated: gated.length,
          gatedFail: bad.length,
          muxGated: gated.filter((r) => r.kind === 'mux').length,
          logoGated: gated.filter((r) => r.kind === 'logo').length,
          ungatedFail: rows.filter((r) => !r.gated && !r.pass).length,
          imageBytes: Math.round(bytes.image),
          muxBytes: Math.round(bytes.mux),
          imageRequests: bytes.n,
        };
        console.log(JSON.stringify(summary));
        for (const r of bad) console.log(`  FAIL ${r.kind} natural ${r.naturalWidth} drawn ${r.renderedWidth.toFixed(1)}@${vp.dpr} source ${r.sourceWidth} ${r.src.slice(0, 110)}`);
        report.push({ summary, rows });
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(failed ? `image-sharp-probe: ${failed} gated image(s) below the gate` : 'image-sharp-probe: every gated image passes');
  process.exit(failed ? 2 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
