#!/usr/bin/env node
/**
 * layout-probe — a layout fingerprint of the media grids, for an A/B across a merge or a fold.
 *
 * Usage:
 *   node scripts/layout-probe.mjs --base=http://localhost:4330 --out=want.json
 *        [--paths=/work/cheetah-print/,/work/directory/] [--widths=1440,1024,390] [--query=tileshape=1.25]
 *   node scripts/layout-probe.mjs --compare want.json got.json
 *
 * Record: loads each page at each width, under reduced motion and with every Mux stream aborted,
 * and fingerprints its grid. A detail page gives `.project-detail__flow`: every
 * `.masonry-grid--detail` segment and description band, in order. The Project Directory gives
 * `.dir-flow`: every `.dir-grid` chunk. Each child is recorded as its inline placement style and
 * its layout box summed up the offset chain, so an entrance transform never counts, and each page
 * adds its document height. A page is read every 400 ms until two reads agree, at most 15 times.
 * With no --paths the probe takes every /work/… page in <base>'s sitemap past /work/ itself:
 * every detail page and the directory. --base falls back to GLOBE_PROBE_BASE and has no default,
 * because a fingerprint of whatever server holds a port is worse than none.
 *
 * Compare: every page@width must match exactly. Exits 0 when all do, and 2 (globe-probe's failed
 * gate) on a difference, a page error, a page that never settled or showed no grid, or a page only
 * one side has. Bad usage, or a record that found no grid anywhere, exits 1. Styles are compared
 * as written, so a style that differs only in form is a first-paint change: `--chunk-rows:760` is
 * the server's, kept because the client settled on the same value, and `--chunk-rows: 760;` is
 * React rewriting it.
 *
 * An A/B (how the Project Directory's merges were checked, 11-04): build each side from an export
 * (`git archive <rev> | tar -x`, with node_modules cloned in by `cp -cR` and .env.local copied;
 * never a build in a checkout whose dev server is running), serve it (`npx astro preview --port
 * 4330`; the sitemap exists only in a build), record it, then compare. Build the two sides back to
 * back. A build bakes live Sanity content, so an edit between the builds reads as a layout change
 * (a new description paragraph is a new band): a difference in a band's `text` or `paras`, or in a
 * page's `blurbs`, is content, not code.
 *
 * Negative control: a --query=tileshape=1.25 record must fail --compare against a plain one on
 * every page@width.
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const USAGE = `  record:  node scripts/layout-probe.mjs --base=URL --out=FILE [--paths=/a/,/b/] [--widths=1440,1024,390] [--query=k=v]
  compare: node scripts/layout-probe.mjs --compare WANT.json GOT.json`;
function usage(why) {
  console.error(`layout-probe: ${why}\n${USAGE}`);
  process.exit(1);
}
const READ_MS = 400;
const MAX_READS = 15;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Runs in the page, so it must stay self-contained.
function fingerprint() {
  const abs = (el) => {
    let x = 0;
    let y = 0;
    for (let n = el; n; n = n.offsetParent) {
      x += n.offsetLeft;
      y += n.offsetTop;
    }
    return [x, y, el.offsetWidth, el.offsetHeight];
  };
  const kid = (c) => ({
    tag: c.tagName.toLowerCase(),
    cls: typeof c.className === 'string' ? c.className.split(' ')[0] : '',
    tile: c.dataset.tile ?? null,
    style: c.getAttribute('style'),
    box: abs(c),
  });
  const flow = document.querySelector('.project-detail__flow');
  if (flow) {
    const parts = [...flow.querySelectorAll('.masonry-grid--detail, section.project-blurb')].map((el) =>
      el.matches('.masonry-grid--detail')
        ? { kind: 'grid', box: abs(el), kids: [...el.children].map(kid) }
        : {
            kind: 'band',
            box: abs(el),
            paras: el.querySelectorAll('.project-blurb__text').length,
            text: el.textContent.replace(/\s+/g, ' ').trim().slice(0, 48),
          }
    );
    return {
      kind: 'detail',
      flowStyle: flow.getAttribute('style'),
      blurbs: document.querySelectorAll('section.project-blurb').length,
      parts,
      docH: document.documentElement.scrollHeight,
    };
  }
  const dir = document.querySelector('.dir-flow');
  if (dir) {
    return {
      kind: 'directory',
      chunks: [...dir.querySelectorAll('.dir-grid')].map((g) => ({
        style: g.getAttribute('style'),
        box: abs(g),
        kids: [...g.children].map(kid),
      })),
      docH: document.documentElement.scrollHeight,
    };
  }
  return { kind: 'none', url: location.href };
}

async function sitemapPaths(base) {
  const locs = async (url) => {
    const res = await fetch(url).catch((e) => usage(`${url} unreachable (${e.cause?.code ?? e.message}): serve a build, or pass --paths`));
    if (!res.ok) usage(`${url} answered ${res.status}: serve a build, or pass --paths`);
    return [...(await res.text()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  };
  const pages = [];
  // The sitemap names the production origin; only the path is ours to load.
  for (const sub of await locs(`${base}/sitemap-index.xml`)) pages.push(...(await locs(base + new URL(sub).pathname)));
  return pages.map((loc) => new URL(loc).pathname).filter((p) => p.startsWith('/work/') && p !== '/work/');
}

async function record() {
  const base = arg('base', process.env.GLOBE_PROBE_BASE);
  const out = arg('out');
  if (typeof base !== 'string' || !base) usage('--base is required (or GLOBE_PROBE_BASE)');
  if (typeof out !== 'string' || !out) usage('--out is required');
  const root = base.replace(/\/$/, '');
  const widths = String(arg('widths', '1440,1024,390')).split(',').map(Number);
  if (widths.some((w) => !(w > 0))) usage('--widths takes numbers, e.g. 1440,390');
  const query = typeof arg('query') === 'string' ? arg('query') : '';
  const pathsArg = arg('paths');
  const paths = typeof pathsArg === 'string' ? pathsArg.split(',').filter(Boolean) : await sitemapPaths(root);
  if (!paths.length) usage('no pages to read');

  const require = createRequire(import.meta.url);
  // Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
  const { chromium } = require(
    process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
  );
  console.log(
    `layout-probe: ${paths.length} page${paths.length === 1 ? '' : 's'} × ${widths.join('/')} from ${root}${query ? ` with ?${query}` : ''}`
  );
  const pages = {};
  const browser = await chromium.launch();
  try {
    for (const w of widths) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w <= 480 ? 844 : 900 }, reducedMotion: 'reduce' });
      // No stream starts: a video slot's box comes from its data, never its frames.
      await ctx.route(/stream\.mux\.com/, (r) => r.abort());
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
      for (const p of paths) {
        const key = `${p}@${w}`;
        errors.length = 0;
        try {
          await page.goto(root + p + (query ? `${p.includes('?') ? '&' : '?'}${query}` : ''), { waitUntil: 'load', timeout: 90000 });
          // The grid islands are client:load; a client:visible island below the fold would never hydrate here.
          await page.waitForFunction(() => !document.querySelector('astro-island[ssr][client="load"]'), null, { timeout: 30000 });
          await page.evaluate(async () => {
            await document.fonts.ready;
          });
          let prev = null;
          let snap = null;
          let reads = 0;
          let settled = false;
          while (!settled && reads < MAX_READS) {
            await sleep(READ_MS);
            snap = await page.evaluate(fingerprint);
            reads++;
            settled = prev !== null && JSON.stringify(prev) === JSON.stringify(snap);
            prev = snap;
          }
          pages[key] = { ...snap, reads, settled, errors: [...errors] };
          const n = snap.parts?.length ?? snap.chunks?.length;
          console.log(`  ${key} ${snap.kind}${n === undefined ? '' : ` ${n} parts`}${settled ? '' : ' UNSETTLED'}${errors.length ? ` ${errors.length} page errors` : ''}`);
        } catch (e) {
          const error = String(e.message).split('\n')[0].slice(0, 200);
          pages[key] = { kind: 'none', error, reads: 0, settled: false, errors: [...errors] };
          console.log(`  ${key} FAILED ${error}`);
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(out, JSON.stringify({ meta: { base: root, query, widths, at: new Date().toISOString() }, pages }, null, 1));
  const keys = Object.keys(pages);
  const none = keys.filter((k) => pages[k].kind === 'none').length;
  console.log(`layout → ${out} (${keys.length} page@width${none ? `, ${none} with no grid` : ''})`);
  // A record with no grid anywhere measured nothing: a wrong --base or --paths.
  if (none === keys.length) process.exit(1);
}

function compare([wantPath, gotPath]) {
  if (!wantPath || !gotPath) usage('--compare takes two records');
  const read = (p) => {
    let r;
    try {
      r = JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      usage(e.code === 'ENOENT' ? `no record at ${p}` : `${p}: ${e.message}`);
    }
    if (!r?.pages || !r.meta) usage(`${p} is not a layout-probe record`);
    return r;
  };
  const want = read(wantPath);
  const got = read(gotPath);
  // reads and settled are timing, errors are reported apart: only the layout is compared.
  const layout = ({ reads, settled, errors, ...rest }) => rest;
  const firstDiff = (a, b, at = '') => {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        const d = firstDiff(a[k], b[k], `${at}.${k}`);
        if (d) return d;
      }
    }
    const copy = /\.(text|paras|blurbs)$/.test(at) ? ' (band copy or count: a Sanity edit between the builds?)' : '';
    return `${at}: want ${JSON.stringify(a)?.slice(0, 160)} · got ${JSON.stringify(b)?.slice(0, 160)}${copy}`;
  };
  const side = (r) => `${r.meta.base}${r.meta.query ? ` ?${r.meta.query}` : ''}, recorded ${r.meta.at}`;
  console.log(`want ${side(want)}\ngot  ${side(got)}`);
  const keys = [...new Set([...Object.keys(want.pages), ...Object.keys(got.pages)])];
  const issues = [];
  let same = 0;
  for (const k of keys) {
    const a = want.pages[k];
    const b = got.pages[k];
    const found = [];
    if (!a || !b) found.push(`ONLY      ${k}: only in ${a ? 'want' : 'got'}`);
    else if (a.kind === 'none' || b.kind === 'none') {
      const r = a.kind === 'none' ? a : b;
      found.push(`NOGRID    ${k}: no grid in ${r === a ? 'want' : 'got'}${r.error ? ` (${r.error})` : ''}`);
    } else {
      for (const [name, r] of [['want', a], ['got', b]]) {
        if (!r.settled) found.push(`UNSETTLED ${k}: ${name} still moving after ${r.reads} reads`);
        for (const e of r.errors) found.push(`PAGEERROR ${k} (${name}): ${e}`);
      }
      const d = firstDiff(layout(a), layout(b));
      if (d) found.push(`DIFF      ${k} ${d}`);
    }
    if (found.length) issues.push(...found);
    else same++;
  }
  const kids = (r) => (r?.parts ?? r?.chunks ?? []).reduce((n, p) => n + (p.kids?.length ?? 0), 0);
  const tiles = keys.reduce((n, k) => n + kids(got.pages[k]), 0);
  const bands = keys.reduce((n, k) => n + (got.pages[k]?.blurbs ?? 0), 0);
  console.log(`${same}/${keys.length} page@width identical (got: ${tiles} tile boxes, ${bands} bands)`);
  for (const line of issues) console.log(`  ${line}`);
  process.exit(issues.length ? 2 : 0);
}

if (arg('compare')) compare(process.argv.slice(2).filter((a) => !a.startsWith('--')));
else await record();
