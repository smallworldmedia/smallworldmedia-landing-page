/**
 * buildDirectoryTiles — the Project Directory's tiles, built once per build
 * from DIRECTORY_QUERY (pure; directoryData.js memoizes the result).
 *
 * Grouping follows the detail pages (assetLane at the 'directory' surface,
 * buildContentFlow.js: every group type opens here), so a deck is one tile
 * here as it is one viewer there (CONTEXT.md, the Brand Deck Dual-Feed Rule):
 *   - decks, carousels, banner groups, admat sets, visuals and live-footage
 *     sets, and sequences (merch stills too, 11-11; mockups sets and flyer
 *     progressions ride this lane here, SURFACE_LANE) collapse into one tile
 *     per lane:client:project:displayGroup (a displayGroup name repeats across
 *     clients);
 *   - the face is a deck's lowest brandDeckOrder page, a carousel's, banner
 *     group's, visuals or live-footage set's first member (orderRank); a
 *     sequence flips through its members in orderRank, mixed aspects on the
 *     least-cropping tile (makeSequence), and so does an admat set, in brandDeckOrder then
 *     orderRank (11-10, Nathan), its animated flyers among the frames (each
 *     plays through on the shared beat, MediaSlot); a group of one is a plain
 *     tile;
 *   - process / supporting media (the 'role' lane) stays out; album covers
 *     and heroes are single tiles;
 *   - a single showcase video flagged `splitIntoThirds` (with a known
 *     duration) is three tiles, one per third (expandChunks, the detail
 *     page's splitter): ids `<_id>~1of3`…, each carrying its `chunk` and the
 *     whole video's client, services and link. They sit side by side in the
 *     build order and stay together, in order, under every display order
 *     (orderTiles deals them as one unit; Nathan 11-13).
 *
 * A tile is the slim face MediaSlot reads, plus `client` (slug), `collaborators`
 * (the other credited clients' slugs, a group's union; [] when none, and the
 * client filter counts them: clientCoverage.js tileInCoverage), `services`
 * (tag slugs, a group's union), `href` + `label` when its project has a
 * detail page, and `fit`. A logo's tile carries `logo` instead of showing
 * its file: the baked white mark and its numbers (logoTile.js,
 * prep-directory-logos.mjs); a twin of a mark, and a logo that can't
 * flatten to white cleanly, stay out (logoVerdict).
 *
 * Order ('project', the build order): the featured projects first, in World
 * order, each by orderRank; then everything else by client name, project
 * rank (no project last), orderRank, _id. A group sits at its first member's
 * place. orderTiles(tiles, 'mix') re-deals it across clients.
 *
 * The page's helpers live here too, pure like the rest: matchesFilter and
 * tagPresence (what the filter shows; serviceGroups.js adds the motion/video
 * parent), readFilter, sanitizeFilter,
 * defaultFilter and filterSearch (its URL state, ?tag=a,b&client=slug), and
 * sizesFor (a tile's <img sizes>).
 */
import { assetLane, expandChunks, ratioOf } from '../detail/buildContentFlow.js';
import { TILE_RATIO, tileClassOf } from '../detail/flushGrid.js';
import { DETAIL_LARGE_COLS, GRID_COLS, GRID_LARGE_PX } from '../detail/tileGrid.js';
import { makeSequence } from '../../../lib/mediaSequence.js';
import { featuredRoutes } from '../../../lib/projectSlug.js';
import { coverageOf, ownersOf, tileInCoverage } from '../../../lib/clientCoverage.js';
import { addGroupPresence, effectiveTags, withGroups, withParents } from './serviceGroups.js';

const GROUPED = new Set(['sequence', 'admat', 'deck', 'carousel', 'banner', 'visuals', 'live-footage']);

/* The fields of an asset a tile keeps — what MediaSlot and ratioOf read. */
const FACE_FIELDS = [
  '_id',
  'title',
  'alt',
  'mediaType',
  'imageUrl',
  'imageDimensions',
  'imageHasAlpha',
  'playbackId',
  'videoAspectRatio',
];
const slim = (a) => {
  const face = {};
  for (const k of FACE_FIELDS) if (a[k] != null) face[k] = a[k];
  return face;
};
/* A sequence's frame: the face, and for a motion member its length, which sets
   how many beats it holds the tile (frameBeats, mediaSequence.js). */
const frameOf = (a) => {
  const f = slim(a);
  if (a.playbackId && a.videoDuration != null) f.videoDuration = a.videoDuration;
  return f;
};

/* Transparency (SQ-20): `alpha` is the baked measure of every face with an
   alpha channel that Sanity doesn't call opaque (src/data/directory-alpha.json,
   prep-directory-logos.mjs --alpha), by image asset id: `clear`, the share of
   pixels under alpha 250, and `lum`, the opaque pixels' mean luminance. */
const CLEAR_MIN = 0.02;
const DARK_INK = 0.3;

/**
 * Whether a face really shows its ground: an alpha channel that Sanity doesn't
 * call opaque and that measures at least CLEAR_MIN clear. One not measured yet
 * (a new upload before a re-bake) counts as transparent, the safe default.
 */
export function isTransparent(face, alpha) {
  if (!face.imageHasAlpha || face.imageIsOpaque === true) return false;
  const m = alpha?.[face.imageAssetId];
  return m ? m.clear >= CLEAR_MIN : true;
}

/** 'light' for dark ink on a clear ground (on near-black it would read as an empty tile). */
export function groundOf(face, alpha) {
  const m = alpha?.[face.imageAssetId];
  return isTransparent(face, alpha) && m && m.lum < DARK_INK ? 'light' : undefined;
}

/**
 * 'contain' when the picture is really transparent (a logo keeps its edges),
 * otherwise 'cover': the media fills its tile (Nathan 11-12, "static and
 * motion media tagged as other should fill its container"). A crop that loses
 * more than half no longer letterboxes: a 4.77:1 banner in a 2:1 cell was
 * the one case, and the class an `_other` asset gets is the one that crops it
 * least (flushGrid.tileClassOf).
 */
export function fitOf(face, alpha) {
  return isTransparent(face, alpha) ? 'contain' : 'cover';
}

const NAME_ORDER = { sensitivity: 'base', ignorePunctuation: true };
const byRank = (a = '', b = '') => (a < b ? -1 : a > b ? 1 : 0);

/**
 * What the logo marks (scripts/prep-directory-logos.mjs) decide about an
 * asset: 'mark' (a logo tile: white on black, logoTile.js), 'drop' (left out
 * of the directory: a twin of a mark already shown, or a `logo` (or a still
 * tagged logo-design) whose colours can't flatten to white cleanly) or null
 * (not in the set, so a tile as ever).
 */
function logoVerdict(asset, logos) {
  const m = logos?.[asset.imageAssetId];
  if (!m) return null;
  if (m.twinOf) return 'drop';
  if (m.hold) return asset.mediaType === 'logo' || asset.services?.some((s) => s.slug === 'logo-design') ? 'drop' : null;
  return 'mark';
}

/** The service tag a logo piece carries (the Studio's slug). */
export const LOGO_TAG = 'logo-design';

/**
 * A logo piece: a baked mark (`logo`) or any tile tagged logo-design, its motion
 * and still files too. The flush grid never stretches one past the cell its
 * class gives it (`keepShape`, flushGrid.js placeOne): a mark floats between
 * rows in a taller cell and a 16:9 loop crops in one.
 */
export const isLogoPiece = (tile) => !!tile.logo || tile.services.includes(LOGO_TAG);

/**
 * @param {{assets: Array<Object>, worlds: Array<Object>, clients?: Array<{name: string, slug: string}>, logos?: Object}} data
 *        DIRECTORY_QUERY's result; `logos` is the prep manifest by image asset
 *        id, each mark with its `src` (directoryData.js)
 * @returns {Array<Object>} tiles in 'project' order
 */
export function buildDirectoryTiles({ assets, worlds, clients = [], logos = null, alpha = null }) {
  const routes = new Map(
    featuredRoutes(worlds).map((w, i) => [
      w.projectId,
      { i, href: `/featured-projects/${w.slug}`, label: w.title ?? w.collection },
    ])
  );
  const nameOf = new Map(clients.map((c) => [c.slug, c.name ?? c.slug]));
  const worldOf = (a) => routes.get(a.projectId)?.i ?? Infinity;

  const order = (a, b) => {
    const wa = worldOf(a);
    const wb = worldOf(b);
    if (wa !== wb) return wa - wb;
    if (wa === Infinity) {
      const byName = (nameOf.get(a.clientSlug) ?? '').localeCompare(nameOf.get(b.clientSlug) ?? '', 'en', NAME_ORDER);
      if (byName) return byName;
      if (a.clientSlug !== b.clientSlug) return byRank(a.clientSlug, b.clientSlug);
      if (!a.projectId !== !b.projectId) return a.projectId ? -1 : 1; // no project last
      const byProject = byRank(a.projectRank, b.projectRank) || byRank(a.projectId, b.projectId);
      if (byProject) return byProject;
    }
    return byRank(a.orderRank, b.orderRank) || byRank(a._id, b._id);
  };

  const kept = assets
    .map((asset) => ({ asset, lane: assetLane(asset, 'directory'), logo: logoVerdict(asset, logos) }))
    .filter(({ lane, logo }) => lane && lane !== 'role' && logo !== 'drop')
    .sort((x, y) => order(x.asset, y.asset));

  const groups = [];
  const byKey = new Map();
  for (const { asset, lane } of kept) {
    if (!GROUPED.has(lane)) {
      // a showcase video flagged splitIntoThirds is its thirds (expandChunks,
      // as on the detail page), each a tile of its own, adjacent here
      for (const piece of lane === 'showcase' ? expandChunks([asset]) : [asset]) {
        groups.push({ lane, key: piece._id, members: [piece] });
      }
      continue;
    }
    const key = `${lane}:${asset.clientSlug}:${asset.projectId ?? ''}:${asset.displayGroup ?? ''}`;
    let g = byKey.get(key);
    if (!g) {
      g = { lane, key, members: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.members.push(asset);
  }

  return groups.map(({ lane, key, members }) => {
    let face;
    let source = members[0]; // the asset the face shows (a sequence: its first frame)
    if (members.length > 1 && (lane === 'sequence' || lane === 'admat')) {
      // an admat set cuts in brandDeckOrder (stable: equal keeps orderRank order)
      const cut = lane === 'admat' ? [...members].sort((a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0)) : members;
      source = cut[0];
      const frames = cut.map(frameOf);
      face = makeSequence(key, frames, frames.map(ratioOf));
    } else if (members.length > 1 && lane === 'deck') {
      // stable: equal brandDeckOrder keeps orderRank order
      source = [...members].sort((a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0))[0];
      face = slim(source);
    } else {
      face = slim(source);
    }
    const seen = { ...face, imageAssetId: source.imageAssetId, imageIsOpaque: source.imageIsOpaque };
    const tile = {
      ...face,
      client: members[0].clientSlug,
      collaborators: [...new Set(members.flatMap((m) => (m.collaboratorSlugs ?? []).filter(Boolean)))],
      services: [...new Set(members.flatMap((m) => (m.services ?? []).map((s) => s.slug)))],
      fit: fitOf(seen, alpha),
    };
    if (source.chunk) tile.chunk = source.chunk;
    if (isTransparent(seen, alpha)) tile.clear = true;
    const ground = groundOf(seen, alpha);
    if (ground) tile.ground = ground;
    if (lane === 'showcase' && logoVerdict(members[0], logos) === 'mark') {
      const { w, h, aspect, density, cx, cy, src } = logos[members[0].imageAssetId];
      tile.logo = { src, w, h, aspect, density, cx, cy };
      tile.fit = 'contain';
      delete tile.ground;
    }
    if (isLogoPiece(tile)) tile.keepShape = true;
    const route = routes.get(members[0].projectId);
    if (route) {
      tile.href = route.href;
      tile.label = route.label;
    }
    return tile;
  });
}

/* mulberry32: a small seeded generator, so a shuffle repeats for one seed. */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* The tiles as units to deal: a run of consecutive tiles carrying a `chunk`
   of one source video (the id before `~`) is one unit, so a split video's
   thirds stay adjacent and in order; every other tile is a unit of one. */
function unitsOf(tiles) {
  const units = [];
  let source = null;
  for (const t of tiles) {
    const from = t.chunk ? String(t._id).split('~')[0] : null;
    if (from && from === source) units[units.length - 1].push(t);
    else units.push([t]);
    source = from;
  }
  return units;
}

/**
 * The tiles in a display order. 'project' is the build order; 'mix' deals
 * the clients round-robin (each client's tiles keep their own order), so no
 * two neighbours share a client while two clients remain; 'shuffle' is a
 * Fisher–Yates shuffle for `seed` (the page draws one seed per load, so every
 * load is a new order and a filter change never re-deals it). Both deal units
 * (unitsOf), so a split video's thirds stay together, in order.
 */
export function orderTiles(tiles, mode = 'project', seed = 0) {
  if (mode === 'shuffle') {
    const out = unitsOf(tiles);
    const rand = seeded(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out.flat();
  }
  if (mode !== 'mix') return tiles;
  const queues = new Map();
  for (const u of unitsOf(tiles)) {
    const client = u[0].client;
    if (!queues.has(client)) queues.set(client, []);
    queues.get(client).push(u);
  }
  const out = [];
  for (let k = 0; out.length < tiles.length; k++) {
    for (const q of queues.values()) if (k < q.length) out.push(...q[k]);
  }
  return out;
}

/**
 * Under exactly the logo-design filter, the logo tiles (the baked white marks)
 * sit together ahead of the rest, so they read as one clean grid. The order
 * (project / mix / shuffle) holds inside each block; any other filter, and the
 * bare default, are returned as they are.
 */
export function logoFirst(tiles, tags) {
  const [only] = tags ?? [];
  if (tags?.size !== 1 || only !== LOGO_TAG) return tiles;
  return [...tiles.filter((t) => t.logo), ...tiles.filter((t) => !t.logo)];
}

/**
 * The logo pieces' order at an ODD column count (SQ-122, Nathan 11-18: "yes to
 * change the order the logos come in"). A logo piece never stretches past its
 * own cell, so a run of them can only end flat if the widths pair up: a
 * landscape takes two columns and a square one, so at 5 columns two landscapes
 * and a square make a row (L L S), at 3 one of each, at 7 three and a square.
 * Project order has the squares first and a block of landscapes last, which
 * left 8 squares open down the right edge at 1440; dealt, 3 (the least 22
 * landscapes and 8 squares can leave in 5 columns).
 *
 * Each RUN of consecutive logo pieces is dealt among its own slots, wide ones
 * first within their pattern, each class keeping its own order; every tile
 * that is not a logo piece keeps its place, and a run holding a split video's
 * chunks is left alone (orderTiles keeps those thirds together). Even column
 * counts (4, 6) are returned as they are: landscape pairs fill their rows, and
 * the project order already ends flat at 4 and 2 columns and with 2 open at 6
 * (3 landscapes to a square there left 9).
 *
 * A pure function of the list and the column count, so a shuffled page deals
 * the same for a seed: it runs after the shuffle, in the grid, which is the
 * one place the column count is known.
 *
 * @param {Array<Object>} tiles - display order, logo tiles carrying their canvas as `tileRatio`
 * @param {number} cols
 */
export function dealLogoPieces(tiles, cols) {
  if (cols < 3 || cols % 2 === 0) return tiles;
  const per = (cols - 1) / 2; // landscapes before each square
  const out = tiles.slice();
  for (let from = 0; from < tiles.length; ) {
    let to = from;
    while (to < tiles.length && isLogoPiece(tiles[to])) to++;
    const run = tiles.slice(from, to);
    if (run.length > 1 && !run.some((t) => t.chunk)) {
      const wide = run.filter((t) => tileClassOf(t) === 'landscape');
      const narrow = run.filter((t) => tileClassOf(t) !== 'landscape');
      let w = 0;
      let n = 0;
      for (let k = 0; k < run.length; k++) {
        const wantWide = k % (per + 1) < per;
        out[from + k] = n >= narrow.length || (wantWide && w < wide.length) ? wide[w++] : narrow[n++];
      }
    }
    from = Math.max(to, from + 1);
  }
  return out;
}

/**
 * Whether a tile shows: inside the client's coverage (null = every client)
 * and carrying any of the tags (an empty set = every tag).
 */
export function matchesFilter(tile, { tags, coverage }) {
  if (coverage && !tileInCoverage(tile, coverage)) return false;
  return !tags?.size || tile.services.some((s) => tags.has(s));
}

/**
 * The tags with tiles at all (`any`: a tag outside it is hidden) and with
 * tiles inside the coverage (`inClient`: a tag outside it is dimmed — the
 * client would empty it). A group's parent is present while any child is.
 */
export function tagPresence(tiles, coverage) {
  const any = new Set();
  const inClient = new Set();
  for (const t of tiles) {
    const inside = !coverage || tileInCoverage(t, coverage);
    for (const s of t.services) {
      any.add(s);
      if (inside) inClient.add(s);
    }
  }
  return { any: addGroupPresence(any), inClient: addGroupPresence(inClient) };
}

/**
 * The clients the clients tab keeps lit: those whose coverage holds a tile that
 * `matchesFilter` shows under `tags` (an empty set = every tile), so a client
 * the picked tags would empty is dimmed. `clients` is DIRECTORY_QUERY's list;
 * returns a Set of slugs.
 */
export function clientPresence(tiles, tags, clients) {
  const owners = new Set();
  const on = effectiveTags(tags ?? []);
  for (const t of tiles) if (matchesFilter(t, { tags: on, coverage: null })) for (const s of ownersOf(t)) owners.add(s);
  const lit = new Set();
  for (const c of clients) {
    const coverage = coverageOf(c.slug, clients);
    if (coverage && [...coverage].some((slug) => owners.has(slug))) lit.add(c.slug);
  }
  return lit;
}

/**
 * The <img sizes> for a tile at the detail grid's breakpoints, given the
 * columns each band holds (`cols`: large from `largeFrom` px up (SQ-74,
 * tileGrid.js GRID_LARGE_PX, the first clause so it wins), desktop above
 * 1024px, tablet to 769px, phone below; DirectoryGrid passes the dialed
 * counts, and the defaults are the detail grid's). A landscape spans two (one in a single column). A cover
 * crop fills the cell's height as well, so a picture wider than its cell
 * renders wider than the cell, by ratio ÷ cell, and asks for that much more
 * (a 9:16 portrait in a 1:2 cell: 1.125×). `actual` ({ span, cell }: the
 * placement's colSpan and width ÷ height, ?dirpack=aspect) replaces the class's.
 */
export function sizesFor(
  type,
  ratio,
  fit,
  {
    phone = GRID_COLS.phone,
    tablet = GRID_COLS.tablet,
    desktop = GRID_COLS.desktop,
    large = DETAIL_LARGE_COLS,
    largeFrom = GRID_LARGE_PX,
  } = {},
  actual = null
) {
  const span = actual?.span ?? (type === 'landscape' ? 2 : 1);
  const cell = actual?.cell ?? TILE_RATIO[type] ?? 1;
  const over = fit === 'cover' && ratio > cell ? ratio / cell : 1;
  const vw = (cols) => `${Math.round((100 * Math.min(span, cols) * over) / cols)}vw`;
  return `(min-width: ${largeFrom}px) ${vw(large)}, (max-width: 768px) ${vw(phone)}, (max-width: 1024px) ${vw(tablet)}, ${vw(desktop)}`;
}

/** The tag a load with no filter in its URL starts on (Nathan, 11-05). */
export const DEFAULT_TAG = 'album-art';

/** The filter a bare load starts from: DEFAULT_TAG where it has tiles, else every work. */
export function defaultFilter(data) {
  return sanitizeFilter(data, [DEFAULT_TAG], null);
}

/** Whether the URL names a filter at all (a `tag` or `client` key, even empty). */
export function hasFilterParams(search) {
  const params = new URLSearchParams(search);
  return params.has('tag') || params.has('client');
}

/** The same tags, in order, and client. */
export const sameFilter = (a, b) =>
  a.client === b.client && a.tags.length === b.tags.length && a.tags.every((t, i) => t === b.tags[i]);

/** The filter the URL asks for, ?tag=a,b&client=slug, unchecked (sanitizeFilter). */
export function readFilter(search) {
  const params = new URLSearchParams(search);
  const tags = (params.get('tag') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { tags: [...new Set(tags)], client: params.get('client')?.trim() || null };
}

/**
 * The filter as it can apply: the client only when its coverage holds a tile
 * (a plain or unknown name filters nothing), and the tags with tiles inside
 * that coverage, in Studio order (a group's parent first, then its children).
 * A child without its parent brings the parent (a deep link to the child).
 */
export function sanitizeFilter({ tags, clients, tiles }, wantTags, wantClient) {
  let coverage = coverageOf(wantClient, clients);
  if (coverage && !tiles.some((t) => tileInCoverage(t, coverage))) coverage = null;
  const { inClient } = tagPresence(tiles, coverage);
  const want = withParents(wantTags);
  return {
    tags: withGroups(tags).filter((t) => want.has(t.slug) && inClient.has(t.slug)).map((t) => t.slug),
    client: coverage ? wantClient : null,
  };
}

/** `search` with the filter written in and every other param kept; '' when
    nothing is left. Commas stay readable (?tag=a,b). A URL with no filter
    means the default (hasFilterParams), so the default itself (`isDefault`)
    writes none, and a filter of nothing writes `?tag=` to stay "every work". */
export function filterSearch(search, tags, client, isDefault = false) {
  const params = new URLSearchParams(search);
  if (tags.length && !isDefault) params.set('tag', tags.join(','));
  else if (!client && !isDefault) params.set('tag', '');
  else params.delete('tag');
  if (client) params.set('client', client);
  else params.delete('client');
  const s = params.toString().replace(/%2C/gi, ',');
  return s ? `?${s}` : '';
}
