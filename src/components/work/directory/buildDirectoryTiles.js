/**
 * buildDirectoryTiles — the Project Directory's tiles, built once per build
 * from DIRECTORY_QUERY (pure; directoryData.js memoizes the result).
 *
 * Grouping follows the detail pages (assetLane, buildContentFlow.js), so a
 * deck is one tile here as it is one viewer there (CONTEXT.md, the Brand Deck
 * Dual-Feed Rule):
 *   - decks, carousels, banner groups and sequences collapse into one tile
 *     per lane:client:project:displayGroup (a displayGroup name repeats
 *     across clients);
 *   - the face is a deck's lowest brandDeckOrder page, a carousel's or a
 *     banner group's first member (orderRank); a sequence cycles its stills
 *     (makeSequence); a group of one is a plain tile;
 *   - process / supporting media (the 'role' lane) stays out; album covers
 *     and heroes are single tiles.
 *
 * A tile is the slim face MediaSlot reads, plus `client` (slug), `services`
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
 * tagPresence (what the filter shows), readFilter, sanitizeFilter,
 * defaultFilter and filterSearch (its URL state, ?tag=a,b&client=slug), and
 * sizesFor (a tile's <img sizes>).
 */
import { assetLane, ratioOf } from '../detail/buildContentFlow.js';
import { classifyTile } from '../detail/flushGrid.js';
import { makeSequence } from '../../../lib/mediaSequence.js';
import { featuredRoutes } from '../../../lib/projectSlug.js';
import { coverageOf } from '../../../lib/clientCoverage.js';

const GROUPED = new Set(['sequence', 'deck', 'carousel', 'banner']);

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

/* The cell each tile class fills, width ÷ height at the baked tile shape: a
   portrait is two squares tall, a landscape two columns wide. */
const CELL_RATIO = { portrait: 0.5, square: 1, landscape: 2 };

/**
 * 'contain' when the picture has transparency (a logo keeps its edges) or a
 * cover crop would lose more than half of it (a 4.77:1 banner in a 2:1
 * cell); otherwise 'cover'.
 */
export function fitOf(face) {
  if (face.imageHasAlpha) return 'contain';
  const r = ratioOf(face);
  const cell = CELL_RATIO[classifyTile(r)];
  return Math.min(r, cell) / Math.max(r, cell) < 0.5 ? 'contain' : 'cover';
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

/**
 * @param {{assets: Array<Object>, worlds: Array<Object>, clients?: Array<{name: string, slug: string}>, logos?: Object}} data
 *        DIRECTORY_QUERY's result; `logos` is the prep manifest by image asset
 *        id, each mark with its `src` (directoryData.js)
 * @returns {Array<Object>} tiles in 'project' order
 */
export function buildDirectoryTiles({ assets, worlds, clients = [], logos = null }) {
  const routes = new Map(
    featuredRoutes(worlds).map((w, i) => [
      w.projectId,
      { i, href: `/work/${w.slug}`, label: w.title ?? w.collection },
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
    .map((asset) => ({ asset, lane: assetLane(asset), logo: logoVerdict(asset, logos) }))
    .filter(({ lane, logo }) => lane && lane !== 'role' && logo !== 'drop')
    .sort((x, y) => order(x.asset, y.asset));

  const groups = [];
  const byKey = new Map();
  for (const { asset, lane } of kept) {
    if (!GROUPED.has(lane)) {
      groups.push({ lane, key: asset._id, members: [asset] });
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
    if (members.length > 1 && lane === 'sequence') {
      const frames = members.map(slim);
      face = makeSequence(key, frames, frames.map(ratioOf));
    } else if (members.length > 1 && lane === 'deck') {
      // stable: equal brandDeckOrder keeps orderRank order
      face = slim([...members].sort((a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0))[0]);
    } else {
      face = slim(members[0]);
    }
    const tile = {
      ...face,
      client: members[0].clientSlug,
      services: [...new Set(members.flatMap((m) => (m.services ?? []).map((s) => s.slug)))],
      fit: fitOf(face),
    };
    if (lane === 'showcase' && logoVerdict(members[0], logos) === 'mark') {
      const { w, h, aspect, density, cx, cy, src } = logos[members[0].imageAssetId];
      tile.logo = { src, w, h, aspect, density, cx, cy };
      tile.fit = 'contain';
    }
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

/**
 * The tiles in a display order. 'project' is the build order; 'mix' deals
 * the clients round-robin (each client's tiles keep their own order), so no
 * two neighbours share a client while two clients remain; 'shuffle' is a
 * Fisher–Yates shuffle for `seed` (the page draws one seed per load, so every
 * load is a new order and a filter change never re-deals it).
 */
export function orderTiles(tiles, mode = 'project', seed = 0) {
  if (mode === 'shuffle') {
    const out = [...tiles];
    const rand = seeded(seed);
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  if (mode !== 'mix') return tiles;
  const queues = new Map();
  for (const t of tiles) {
    if (!queues.has(t.client)) queues.set(t.client, []);
    queues.get(t.client).push(t);
  }
  const out = [];
  for (let k = 0; out.length < tiles.length; k++) {
    for (const q of queues.values()) if (k < q.length) out.push(q[k]);
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
  if (!tags || tags.size !== 1 || !tags.has('logo-design')) return tiles;
  return [...tiles.filter((t) => t.logo), ...tiles.filter((t) => !t.logo)];
}

/**
 * Whether a tile shows: inside the client's coverage (null = every client)
 * and carrying any of the tags (an empty set = every tag).
 */
export function matchesFilter(tile, { tags, coverage }) {
  if (coverage && !coverage.has(tile.client)) return false;
  return !tags?.size || tile.services.some((s) => tags.has(s));
}

/**
 * The tags with tiles at all (`any`: a tag outside it is hidden) and with
 * tiles inside the coverage (`inClient`: a tag outside it is dimmed — the
 * client would empty it).
 */
export function tagPresence(tiles, coverage) {
  const any = new Set();
  const inClient = new Set();
  for (const t of tiles) {
    const inside = !coverage || coverage.has(t.client);
    for (const s of t.services) {
      any.add(s);
      if (inside) inClient.add(s);
    }
  }
  return { any, inClient };
}

/**
 * The <img sizes> for a tile at the detail grid's breakpoints, given the
 * columns each band holds (`cols`: desktop above 1024px, tablet to 769px,
 * phone below; DirectoryGrid passes the dialed counts, and the defaults are
 * the detail grid's). A landscape spans two (one in a single column). A cover
 * crop fills the cell's height as well, so a picture wider than its cell
 * renders wider than the cell, by ratio ÷ cell, and asks for that much more
 * (a 9:16 portrait in a 1:2 cell: 1.125×).
 */
export function sizesFor(type, ratio, fit, { phone = 1, tablet = 2, desktop = 3 } = {}) {
  const span = type === 'landscape' ? 2 : 1;
  const cell = CELL_RATIO[type] ?? 1;
  const over = fit === 'cover' && ratio > cell ? ratio / cell : 1;
  const vw = (cols) => `${Math.round((100 * Math.min(span, cols) * over) / cols)}vw`;
  return `(max-width: 768px) ${vw(phone)}, (max-width: 1024px) ${vw(tablet)}, ${vw(desktop)}`;
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
 * that coverage, in Studio order.
 */
export function sanitizeFilter({ tags, clients, tiles }, wantTags, wantClient) {
  let coverage = coverageOf(wantClient, clients);
  if (coverage && !tiles.some((t) => coverage.has(t.client))) coverage = null;
  const { inClient } = tagPresence(tiles, coverage);
  const want = new Set(wantTags);
  return {
    tags: tags.filter((t) => want.has(t.slug) && inClient.has(t.slug)).map((t) => t.slug),
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
