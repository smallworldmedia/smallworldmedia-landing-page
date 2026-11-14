#!/usr/bin/env node
/**
 * directory-grid-probe — how much of each Project Directory tile is cropped
 * (cover) or left as ground (contain), and how much of the grid is holes, on
 * the real packing of the live data (SQ-20; landed from the 11-05 measure).
 *
 *   node --env-file=.env.local scripts/directory-grid-probe.mjs [--pack flush|aspect] [--look 8] [--json out.json]
 *
 * Read-only: one Sanity read (published), no writes. It runs the page's own
 * code: DIRECTORY_QUERY, buildDirectoryTiles with the baked logo and alpha
 * manifests, then chunkFlushGrid (`flush`, today's default) or chunkAspectGrid
 * (`aspect`), at phone 393px / 2 columns, tablet 900 / 4 and 1024 / 4, desktop 1440 / 5,
 * unfiltered and under every single tag (logo-design's logo-first order
 * included), plus three shuffle seeds.
 *
 * Per view: n, contain (how many are really transparent), black>10% (contain
 * tiles showing over 10% ground) and how many of those have NO measured
 * transparency (`opaque-black`: should be 0), crop>25% / >50%, mean loss
 * (crop or ground, logos left out), holes (uncovered cells), the largest
 * move from the list order (`moved`, aspect only) and the worst tile.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const { createClient } = await imp('node_modules/@sanity/client/dist/index.js');
const { DIRECTORY_QUERY } = await imp('src/lib/queries.js');
const { buildDirectoryTiles, orderTiles, logoFirst, DEFAULT_TAG } = await imp('src/components/work/directory/buildDirectoryTiles.js');
const { chunkFlushGrid } = await imp('src/components/work/detail/flushGrid.js');
const { chunkAspectGrid, LOOK } = await imp('src/components/work/directory/aspectGrid.js');
const { ratioOf } = await imp('src/components/work/detail/buildContentFlow.js');
const { tileRowsFor } = await imp('src/components/work/detail/tileGrid.js');
const { CANVAS_RATIO, canvasOf } = await imp('src/components/work/directory/logoTile.js');

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const PACK = arg('pack', 'flush');
const LOOK_N = Number(arg('look', LOOK));
if (!['flush', 'aspect'].includes(PACK)) throw new Error(`--pack flush|aspect, not ${PACK}`);

const json = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const logos = json('src/data/directory-logos.json');
const alpha = json('src/data/directory-alpha.json');

const client = createClient({
  projectId: 'b60h4u7o',
  dataset: 'production',
  apiVersion: '2025-01-01',
  useCdn: false,
  token: process.env.SANITY_READ_TOKEN || process.env.SANITY_WRITE_TOKEN,
  perspective: 'published',
});
const data = await client.fetch(DIRECTORY_QUERY);
const tiles = buildDirectoryTiles({ ...data, logos, alpha }).map((t) =>
  t.logo ? { ...t, tileRatio: CANVAS_RATIO[canvasOf(t.logo)] } : t
);

const GAP = 2;
const VIEWS = {
  phone: { width: 393, cols: 2 },
  tablet: { width: 900, cols: 4 },
  tablet1024: { width: 1024, cols: 4 },
  desktop: { width: 1440, cols: 5 },
};
const lossOf = (a, b) => 1 - Math.min(a, b) / Math.max(a, b);

function pack(list, { width, cols }) {
  if (PACK === 'aspect') return chunkAspectGrid(list, { cols, width, gap: GAP, look: LOOK_N });
  const rows = tileRowsFor({ width, rowGap: GAP, cols }, 1);
  return chunkFlushGrid(list, { cols, sqRows: rows.sq, lsRows: rows.ls });
}

function measure(list, view) {
  const { width, cols } = VIEWS[view];
  const colW = (width - (cols - 1) * GAP) / cols;
  const chunks = pack(list, VIEWS[view]);
  const out = [];
  let holes = 0;
  let cells = 0;
  let moved = 0;
  let pos = 0;
  for (const ch of chunks) {
    const cover = Array.from({ length: cols }, () => new Array(ch.totalRows).fill(0));
    ch.placements.forEach((p, k) => {
      const index = p.index ?? ch.start + k;
      moved = Math.max(moved, Math.abs(pos++ - index));
      const t = list[index];
      const w = p.colSpan * colW + (p.colSpan - 1) * GAP;
      const n = p.rowEnd - p.rowStart;
      const h = n * 10 + (n - 1) * GAP;
      const fit = t.logo ? 'logo' : PACK === 'aspect' ? (t.clear ? 'contain' : 'cover') : t.fit;
      const loss = lossOf(ratioOf(t), w / h);
      out.push({
        title: t.title,
        client: t.client,
        ratio: +ratioOf(t).toFixed(3),
        fit,
        clear: !!t.clear,
        span: p.colSpan,
        loss: +loss.toFixed(3),
        black: fit === 'contain' ? loss : 0,
        crop: fit === 'cover' ? loss : 0,
        wpx: Math.round(w),
        hpx: Math.round(h),
      });
      for (let c = p.col; c < p.col + p.colSpan; c++) for (let r = p.rowStart; r < p.rowEnd; r++) cover[c][r] = 1;
    });
    for (const col of cover) for (const v of col) {
      cells++;
      if (!v) holes++;
    }
  }
  return { tiles: out, chunks: chunks.length, holeFrac: cells ? holes / cells : 0, moved };
}

const pct = (x) => `${(100 * x).toFixed(1)}%`;
function summary(label, m) {
  const t = m.tiles.filter((x) => x.fit !== 'logo');
  const contain = t.filter((x) => x.fit === 'contain');
  const black = contain.filter((x) => x.black > 0.1);
  const opaqueBlack = contain.filter((x) => !x.clear && x.black > 0);
  const crop25 = t.filter((x) => x.crop > 0.25);
  const crop50 = t.filter((x) => x.crop > 0.5);
  const mean = t.reduce((s, x) => s + x.loss, 0) / (t.length || 1);
  const worst = t.reduce((a, x) => (!a || x.loss > a.loss ? x : a), null);
  const w = worst ? `${worst.title.slice(0, 28)} ${worst.ratio} ${worst.fit} ${pct(worst.loss)}` : '-';
  return (
    `${label.padEnd(24)} n=${String(m.tiles.length).padStart(3)} contain=${String(contain.length).padStart(2)} (clear ${contain.filter((x) => x.clear).length})` +
    ` black>10%=${String(black.length).padStart(2)} opaque-black=${opaqueBlack.length} | crop>25%=${String(crop25.length).padStart(3)} >50%=${crop50.length}` +
    ` | mean ${pct(mean).padStart(5)} | holes ${pct(m.holeFrac)} | moved ${m.moved} | worst ${w}`
  );
}

const report = {};
const lines = [`pack ${PACK}${PACK === 'aspect' ? ` look ${LOOK_N}` : ''}; tiles ${tiles.length} (logos ${tiles.filter((t) => t.logo).length}, clear ${tiles.filter((t) => t.clear).length}, light ground ${tiles.filter((t) => t.ground).length})`];
const filters = [['ALL (no filter)', null], ...data.tags.map((t) => [t.slug, t.slug])];
for (const view of Object.keys(VIEWS)) {
  lines.push(`\n== ${view} (${VIEWS[view].cols} cols @ ${VIEWS[view].width}) — project order ==`);
  for (const [label, tag] of filters) {
    const list = tag ? logoFirst(tiles.filter((t) => t.services.includes(tag)), new Set([tag])) : tiles;
    if (!list.length) continue;
    const m = measure(list, view);
    report[`${view}:${label}`] = m;
    lines.push(summary(label + (tag === DEFAULT_TAG ? ' *default' : ''), m));
  }
  lines.push('-- shuffle seeds, no filter --');
  for (const seed of [1, 2, 3]) lines.push(summary(`shuffle ${seed}`, measure(orderTiles(tiles, 'shuffle', seed), view)));
}
console.log(lines.join('\n'));
const out = arg('json');
if (out) writeFileSync(out, JSON.stringify(report, null, 1));
