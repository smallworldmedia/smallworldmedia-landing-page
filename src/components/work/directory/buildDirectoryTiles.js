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
 * detail page, and `fit`.
 *
 * Order ('project', the build order): the featured projects first, in World
 * order, each by orderRank; then everything else by client name, project
 * rank (no project last), orderRank, _id. A group sits at its first member's
 * place. orderTiles(tiles, 'mix') re-deals it across clients.
 */
import { assetLane, ratioOf } from '../detail/buildContentFlow.js';
import { classifyTile } from '../detail/flushGrid.js';
import { makeSequence } from '../../../lib/mediaSequence.js';
import { featuredRoutes } from '../../../lib/projectSlug.js';

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
 * @param {{assets: Array<Object>, worlds: Array<Object>, clients?: Array<{name: string, slug: string}>}} data
 *        DIRECTORY_QUERY's result
 * @returns {Array<Object>} tiles in 'project' order
 */
export function buildDirectoryTiles({ assets, worlds, clients = [] }) {
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
    .map((asset) => ({ asset, lane: assetLane(asset) }))
    .filter(({ lane }) => lane && lane !== 'role')
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
    const route = routes.get(members[0].projectId);
    if (route) {
      tile.href = route.href;
      tile.label = route.label;
    }
    return tile;
  });
}

/**
 * The tiles in a display order. 'project' is the build order; 'mix' deals
 * the clients round-robin (each client's tiles keep their own order), so no
 * two neighbours share a client while two clients remain.
 */
export function orderTiles(tiles, mode = 'project') {
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
