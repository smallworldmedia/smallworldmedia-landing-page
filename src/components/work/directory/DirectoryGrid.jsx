/**
 * DirectoryGrid — the Project Directory's tiles as one flush grid, cut into
 * stacked chunks (chunkFlushGrid, flushGrid.js). Each chunk is its own
 * .dir-grid at its exact height (--chunk-rows), one row gap below the last,
 * so the stack reads as a single grid, and a chunk whose media is unmounted
 * still holds its space (the footer reveal stays put).
 *
 * Every chunk renders its tiles' boxes, so the focus order and the list of
 * links are whole; only chunks near the viewport mount the media in them
 * (one IntersectionObserver, two viewports above and below), which bounds
 * the image memory over a long scroll. (11-03: with the boxes in the window
 * too, Tab fell through it into the footer, since a chunk's last tile in
 * DOM order can sit rows above its end, out of the window's reach.) The
 * first window is chunk 0, so the server render — chunk 0 at five columns,
 * exact at 1440 like the detail page's first paint, and bare boxes for the
 * rest — matches the first client render. (A shuffled page, whose order is
 * drawn after hydration, starts with no window and so no media: the server's
 * chunk 0 would be tiles that are about to move.)
 * The column count comes from here, not from CSS (--dir-cols): the
 * detail grid's breakpoints, with the count dialed per band (?dircols above
 * 1024px, ?dirtabletcols to 769px, ?dirphonecols below).
 *
 * Videos play through one playerGate (playerGate.js): every video tile shows
 * its poster, and a player mounts only while the gate grants it. A tile with
 * a featured project links to it (named by the project); the rest are media
 * only. No hover label.
 *
 * ?dirpack=aspect (SQ-20) packs with chunkAspectGrid (aspectGrid.js) instead:
 * each tile at its own shape, the same chunks, a placement naming its tile by
 * `index` (the packer may reorder within ?dirlook), every face covering
 * unless it is really transparent. The server render packs it at 1440px too.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MediaSlot from '../detail/MediaSlot.jsx';
import LogoMark from './LogoMark.jsx';
import { CANVAS_RATIO, canvasOf } from './logoTile.js';
import { chunkFlushGrid } from '../detail/flushGrid.js';
import { chunkAspectGrid, LOOK } from './aspectGrid.js';
import { ratioOf } from '../detail/buildContentFlow.js';
import {
  GRID_LARGE_PX,
  TILE_SHAPE,
  placementStyle,
  rowsFor,
  tileRowsFor,
  useGridMetrics,
  useTileShape,
} from '../detail/tileGrid.js';
import { createPlayerGate } from './playerGate.js';
import { sizesFor } from './buildDirectoryTiles.js';
import { PREVIEW_SECONDS } from '../imageConfig.js';

/* Before the gate mounts (the server render, the first client frame): the
   directory's markup — posters, no players — with nothing watched yet. */
const NO_GATE = { watch: () => () => {} };

/* How far beyond the viewport a chunk mounts its media. */
const MOUNT_MARGIN = '200% 0px';
const MOUNT_REACH = 2; // the same, in viewport heights (seedNear)

const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));

/* A square's rows before the grid is measured (the server render, the first
   client frame): the detail grid's SQ_ROWS_FALLBACK for this column count — a
   1440px laptop, the 2px --space-1 gap — so a laptop's first paint is final. */
const fallbackRows = (cols) => rowsFor((1440 - (cols - 1) * 2) / cols / TILE_SHAPE, 2);

/* A tile's box always renders; its media only while `live` (the window). A
   window change re-renders only the tiles it flips. */
const DirectoryTile = memo(function DirectoryTile({ tile, placement, gate, colSpec, live, logoDials, aspect }) {
  // every face covers its cell unless it is really transparent (fitOf)
  const fit = tile.fit;
  // A cover promoted to 2×2 (flushGrid, SQ-78) asks for two columns' width.
  const actual = aspect
    ? { span: placement.colSpan, cell: placement.cell }
    : placement.type === 'square' && placement.colSpan === 2
      ? { span: 2, cell: 1 }
      : null;
  const slot =
    live &&
    (tile.logo ? (
      <LogoMark tile={tile} dials={logoDials} />
    ) : (
      <MediaSlot
        asset={tile}
        gate={gate}
        clip={PREVIEW_SECONDS}
        sizes={sizesFor(placement.type, ratioOf(tile), fit, colSpec, actual)}
        fit={fit}
      />
    ));
  const props = {
    className: 'dir-tile',
    'data-tile': placement.type,
    'data-logo': tile.logo ? '' : undefined,
    'data-ground': tile.ground,
    style: placementStyle(placement),
  };
  return tile.href ? (
    <a {...props} href={tile.href} aria-label={tile.label}>
      {slot}
    </a>
  ) : (
    <div {...props}>{slot}</div>
  );
});

/**
 * @param {Object} props
 * @param {Array<Object>} props.tiles - the tiles to show, in display order
 * @param {number} [props.cols=5] - columns above 1024px, below the large tier (?dircols)
 * @param {number} [props.largeCols=6] - columns from the large tier up (?dirlargecols)
 * @param {number} [props.tabletCols=4] - columns from 769 to 1024px (?dirtabletcols)
 * @param {number} [props.phoneCols=2] - columns at ≤768px (?dirphonecols)
 * @param {number} props.cap - players at once (the gate's cap; 0 under reduced motion regardless)
 * @param {number} props.dwellMs - the gate's dwell
 * @param {boolean} [props.shuffled=false] - the order is drawn after hydration: mount no media before the first measure
 * @param {Object} [props.logoDials] - the logo tiles' pad / weight / land / center (logoTile.js)
 * @param {'flush'|'aspect'} [props.pack='flush'] - the packer (?dirpack)
 * @param {number} [props.look] - aspect packing's lookahead (?dirlook)
 * @param {() => void} [props.onReady] - once, after the first render at the measured width
 */
export default function DirectoryGrid({
  tiles: shown,
  cols: deskCols = 5,
  largeCols = 6,
  tabletCols = 4,
  phoneCols = 2,
  cap,
  dwellMs,
  shuffled = false,
  logoDials,
  pack = 'flush',
  look = LOOK,
  onReady,
}) {
  const aspect = pack === 'aspect';
  // A logo tile's canvas (a square, or a landscape for a wide mark) is its
  // shape in the flush grid: tileRatio is what ratioOf reads (logoTile.js).
  const tiles = useMemo(
    () =>
      shown.map((t) => (t.logo ? { ...t, tileRatio: CANVAS_RATIO[canvasOf(t.logo.aspect, logoDials?.land)] } : t)),
    [shown, logoDials?.land]
  );
  const flowRef = useRef(null);
  const tileShape = useTileShape();
  const metrics = useGridMetrics(flowRef, '.dir-grid');

  // useGridMetrics names the grid's tier (phone / tablet / desktop / large): each maps to its dial.
  const largeFrom = metrics?.largePx ?? GRID_LARGE_PX;
  const colSpec = useMemo(
    () => ({ phone: phoneCols, tablet: tabletCols, desktop: deskCols, large: largeCols, largeFrom }),
    [phoneCols, tabletCols, deskCols, largeCols, largeFrom]
  );
  const cols = metrics ? colSpec[metrics.tier] : deskCols;
  const rows = metrics ? tileRowsFor({ ...metrics, cols }, tileShape) : null;
  const sqRows = rows?.sq ?? fallbackRows(deskCols);
  const lsRows = rows?.ls ?? sqRows;
  // aspect packs by the measured width (the server render: 1440, the 2px gap)
  const width = metrics?.width ?? 1440;
  const gap = metrics ? metrics.rowGap : 2;
  const chunks = useMemo(
    () =>
      aspect
        ? chunkAspectGrid(tiles, { cols, width, gap, look })
        : chunkFlushGrid(tiles, { cols, sqRows, lsRows }),
    [aspect, tiles, cols, width, gap, look, sqRows, lsRows]
  );

  const [gate, setGate] = useState(NO_GATE);
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const g = createPlayerGate({ cap: reduced ? 0 : cap, dwellMs });
    setGate(g);
    return () => g.destroy();
  }, [cap, dwellMs]);

  // The mount window: which chunks are within MOUNT_MARGIN of the viewport.
  // The observer keeps it while the page scrolls. seedNear sets it from the
  // chunks' boxes before paint whenever the list or the place jumps (a
  // filter, a column count, a restored place): the observer's first report
  // lands a frame later, and the old window's chunks left the view empty for
  // that frame (measured 11-03, jumping from chunk 5 into a filter).
  const [near, setNear] = useState(() => new Set(shuffled ? [] : [0]));
  const seedNear = useCallback(() => {
    const flow = flowRef.current;
    if (!flow) return;
    const reach = MOUNT_REACH * window.innerHeight;
    const next = new Set();
    for (const el of flow.querySelectorAll('.dir-grid')) {
      const r = el.getBoundingClientRect();
      if (r.bottom >= -reach && r.top <= window.innerHeight + reach) next.add(Number(el.dataset.chunk));
    }
    setNear((prev) => (sameSet(prev, next) ? prev : next));
  }, []);
  useEffect(() => {
    const flow = flowRef.current;
    if (!flow) return undefined;
    const io = new IntersectionObserver(
      (entries) =>
        setNear((prev) => {
          const next = new Set(prev);
          for (const e of entries) {
            const k = Number(e.target.dataset.chunk);
            if (e.isIntersecting) next.add(k);
            else next.delete(k);
          }
          return sameSet(prev, next) ? prev : next;
        }),
      { rootMargin: MOUNT_MARGIN }
    );
    for (const el of flow.querySelectorAll('.dir-grid')) io.observe(el);
    return () => io.disconnect();
  }, [chunks]);

  // The first render at the real width has committed: the page may restore
  // its scroll and show the grid, and the window follows the restored place.
  const readyRef = useRef(false);
  useLayoutEffect(() => {
    if (!metrics || readyRef.current) return;
    readyRef.current = true;
    onReady?.();
    seedNear();
  }, [metrics, onReady, seedNear]);

  useLayoutEffect(() => seedNear(), [chunks, seedNear]);

  return (
    <div className="dir-flow" ref={flowRef} style={{ '--dir-cols': cols }}>
      {chunks.map((c, k) => (
        <div key={k} className="dir-grid" data-chunk={k} style={{ '--chunk-rows': c.totalRows }}>
          {c.placements.map((p, i) => {
            const tile = tiles[p.index ?? c.start + i];
            return (
              <DirectoryTile
                key={tile._id}
                tile={tile}
                placement={p}
                gate={gate}
                colSpec={colSpec}
                logoDials={logoDials}
                aspect={aspect}
                live={near.has(k)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
