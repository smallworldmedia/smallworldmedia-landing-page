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
 * large 2000 / 6, unfiltered, under every single tag (logo-design's logo-first
 * order included) and under every client, plus three shuffle seeds. Each view's
 * line ends with `demoted`, the pieces a flush grid gave one square cell their
 * class does not (SQ-82); a `-- <view>` line counts the views with any
 * uncovered cell and the pieces demoted over them. FLUSHGRID=<path> swaps in
 * another copy of flushGrid.js (from the repo root) to compare against.
 *
 * A logo piece (a baked mark or any tile tagged logo-design, keepShape) keeps the cell its
 * class gives it (SQ-122): flush views end with `logo off-cell`, the logo pieces drawn
 * taller or wider, and any makes the run exit 1 (FLUSHGRID=<a copy from before> shows it).
 * `open/col [...]` lists the uncovered cells by column in squares: the tail a view ends on.
 * The logo pieces are dealt by width at odd column counts (dealLogoPieces, as the page does
 * after its shuffle); `--deal 0` keeps list order to compare against.
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
const { buildDirectoryTiles, orderTiles, logoFirst, matchesFilter, isLogoPiece, dealLogoPieces, DEFAULT_TAG } = await imp('src/components/work/directory/buildDirectoryTiles.js');
const { chunkFlushGrid, tileClassOf } = await imp(process.env.FLUSHGRID ?? 'src/components/work/detail/flushGrid.js');
const { coverageOf } = await imp('src/lib/clientCoverage.js');
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
const DEAL = arg('deal', '1') !== '0'; // --deal 0: the logo pieces in plain list order (before SQ-122's deal)
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
  large: { width: 2000, cols: 6 },
};
const lossOf = (a, b) => 1 - Math.min(a, b) / Math.max(a, b);
const offCell = []; // every view's logo pieces drawn past their cell (the run fails on any, flush only)

function pack(list, { width, cols }) {
  if (PACK === 'aspect') return chunkAspectGrid(list, { cols, width, gap: GAP, look: LOOK_N });
  const rows = tileRowsFor({ width, rowGap: GAP, cols }, 1);
  return chunkFlushGrid(list, { cols, sqRows: rows.sq, lsRows: rows.ls });
}

function measure(listIn, view) {
  const { width, cols } = VIEWS[view];
  // the page deals the logo pieces by the column count, after any shuffle (DirectoryGrid)
  const list = PACK === 'flush' && DEAL ? dealLogoPieces(listIn, cols) : listIn;
  const colW = (width - (cols - 1) * GAP) / cols;
  const chunks = pack(list, VIEWS[view]);
  const out = [];
  let holes = 0;
  let cells = 0;
  let moved = 0;
  let pos = 0;
  let demoted = 0; // flush pieces placed in a square cell their class is not (SQ-82)
  const logoOff = []; // flush logo pieces drawn past the cell their class gives them (SQ-122: always none)
  const rowsOf = tileRowsFor({ width, rowGap: GAP, cols }, 1);
  const holesByCol = new Array(cols).fill(0);
  for (const ch of chunks) {
    const cover = Array.from({ length: cols }, () => new Array(ch.totalRows).fill(0));
    ch.placements.forEach((p, k) => {
      const index = p.index ?? ch.start + k;
      moved = Math.max(moved, Math.abs(pos++ - index));
      const t = list[index];
      if (PACK === 'flush' && p.type !== tileClassOf(t)) demoted++;
      if (PACK === 'flush' && isLogoPiece(t)) {
        const cls = tileClassOf(t);
        const cellCols = cls === 'landscape' ? Math.min(2, cols) : 1;
        const cellRows = cls === 'portrait' ? 2 * rowsOf.sq : cls === 'landscape' && cols === 1 ? rowsOf.ls : rowsOf.sq;
        if (p.colSpan > cellCols || p.rowEnd - p.rowStart > cellRows || p.underlay) {
          logoOff.push(`${t.title} ${p.colSpan}x${((p.rowEnd - p.rowStart) / rowsOf.sq).toFixed(1)}sq`);
        }
      }
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
    cover.forEach((col, c) => {
      for (const v of col) {
        cells++;
        if (!v) {
          holes++;
          holesByCol[c]++;
        }
      }
    });
  }
  // the open cells by column, in squares (a column that ends short of the others is the tail)
  const tail = holesByCol.map((n) => +(n / rowsOf.sq).toFixed(1));
  if (logoOff.length) offCell.push(`${view}: ${logoOff.join('; ')}`);
  return { tiles: out, chunks: chunks.length, holeFrac: cells ? holes / cells : 0, holes, moved, demoted, logoOff, tail };
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
    ` | mean ${pct(mean).padStart(5)} | holes ${pct(m.holeFrac)}${m.holes ? ` open/col [${m.tail}] sq` : ''} | moved ${m.moved} | demoted ${m.demoted}` +
    `${PACK === 'flush' ? ` | logo off-cell ${m.logoOff.length}` : ''} | worst ${w}`
  );
}

const report = {};
const lines = [`pack ${PACK}${PACK === 'aspect' ? ` look ${LOOK_N}` : ''}; tiles ${tiles.length} (logos ${tiles.filter((t) => t.logo).length}, clear ${tiles.filter((t) => t.clear).length}, light ground ${tiles.filter((t) => t.ground).length})`];
const filters = [['ALL (no filter)', null], ...data.tags.map((t) => [t.slug, t.slug])];
// the clients tab's views (a client's coverage, no tag), after the tags
const clientViews = (data.clients ?? []).map((c) => [
  `client:${c.slug}`,
  tiles.filter((t) => matchesFilter(t, { tags: new Set(), coverage: coverageOf(c.slug, data.clients) })),
]);
for (const view of Object.keys(VIEWS)) {
  lines.push(`\n== ${view} (${VIEWS[view].cols} cols @ ${VIEWS[view].width}) — project order ==`);
  let views = 0;
  let ragged = 0; // views with any uncovered cell (SQ-82: "not flush")
  let demoted = 0;
  const views_ = [
    ...filters.map(([label, tag]) => [label, tag, tag ? logoFirst(tiles.filter((t) => t.services.includes(tag)), new Set([tag])) : tiles]),
    ...clientViews.map(([label, list]) => [label, null, list]),
  ];
  for (const [label, tag, list] of views_) {
    if (!list.length) continue;
    const m = measure(list, view);
    report[`${view}:${label}`] = m;
    views++;
    if (m.holes > 0) ragged++;
    demoted += m.demoted;
    lines.push(summary(label + (tag === DEFAULT_TAG ? ' *default' : ''), m));
  }
  lines.push(`-- ${view}: ${ragged} of ${views} views not flush, ${demoted} pieces demoted to a square cell`);
  lines.push('-- shuffle seeds, no filter --');
  for (const seed of [1, 2, 3]) lines.push(summary(`shuffle ${seed}`, measure(orderTiles(tiles, 'shuffle', seed), view)));
}
console.log(lines.join('\n'));
if (offCell.length) {
  console.error(`\nFAIL: ${offCell.length} views draw a logo piece past its own cell (SQ-122):\n${offCell.join('\n')}`);
  process.exitCode = 1;
}
const out = arg('json');
if (out) writeFileSync(out, JSON.stringify(report, null, 1));
