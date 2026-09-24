/**
 * buildWorldPools.js — featured-project media pools for the home globe's
 * population modes (docs/globe-worlds-plan.md). Pure.
 *
 * Build time (src/pages/index.astro): buildWorldPools() turns the SAME
 * FEATURED_WORLDS_QUERY rows /work renders into one pool per featured
 * project, partitioned by the Content Population Hierarchy
 * (buildContentFlow) — so a cluster on the globe holds exactly the media of
 * that project's /work World: the hero, the showcase Tiles and the album art.
 * Deck pages, carousels, banners, logos and process/BTS assets stay out (wide
 * or transparent sheets never read in a square tile).
 *
 * Client (PopulationDirector): selectPool() narrows a pool live for the
 * ?popmedia / ?popcap bench knobs. Both sides select round-robin across the
 * media kinds, then restore editorial (orderRank) order — so a cap never
 * starves a project's album art or stills behind a long run of videos.
 *
 * Globe asset shape: { kind: 'video'|'still'|'art', playbackId?, imageUrl?,
 * videoAspectRatio? } — no ids and no nulls: the pools ride the home island's
 * props (~40 KB for 13 worlds), and the texture key (assetKey) is all a tile
 * needs. Stills load as square Sanity crops (TextureManager); kind only
 * filters, playbackId alone decides whether a tile can go live.
 */
import { buildContentFlow } from '../work/detail/buildContentFlow.js';
import { toProjectSlug } from '../../lib/projectSlug.js';

export const WORLD_POOL_CAP = 32; // per project — bounds the island payload
export const WORLD_KINDS = ['video', 'still', 'art'];
// A kind filter that leaves fewer than this falls back to the whole pool
// (Munchietown has 1 video; a video-only cluster of it would be one clip).
export const MIN_KIND_POOL = 3;

const PLAYABLE = ['ready', 'preparing']; // the buildAssetPool rule (stale Mux snapshots)
const NEVER_TILED = new Set(['logo', 'brand-deck', 'carousel-slide']);

function kindOf(asset) {
  if (asset.mediaType === 'album-art') return 'art';
  if (asset.playbackId) return 'video';
  return asset.imageUrl ? 'still' : null;
}

function toGlobeAsset(asset) {
  if (!asset || NEVER_TILED.has(asset.mediaType) || asset.contentRole) return null;
  if (asset.playbackId && asset.videoStatus && !PLAYABLE.includes(asset.videoStatus)) return null;
  const kind = kindOf(asset);
  if (!kind) return null;
  const out = { kind };
  if (asset.playbackId) out.playbackId = asset.playbackId;
  else out.imageUrl = asset.imageUrl;
  if (asset.playbackId && asset.videoAspectRatio) out.videoAspectRatio = asset.videoAspectRatio;
  return out;
}

/**
 * Round-robin across kinds (each kind in pool order) up to `cap`, then back
 * into pool order. `kinds` null = every kind.
 */
export function selectPool(pool, { kinds = null, cap = WORLD_POOL_CAP } = {}) {
  let src = pool;
  if (kinds) {
    const want = new Set(kinds);
    const filtered = pool.filter((a) => want.has(a.kind));
    if (filtered.length >= MIN_KIND_POOL) src = filtered;
  }
  if (src.length <= cap) return src.slice();
  const byKind = new Map();
  src.forEach((a, i) => {
    if (!byKind.has(a.kind)) byKind.set(a.kind, []);
    byKind.get(a.kind).push(i);
  });
  const lanes = [...byKind.values()];
  const picked = [];
  for (let pass = 0; picked.length < cap; pass++) {
    for (const lane of lanes) {
      if (pass < lane.length && picked.length < cap) picked.push(lane[pass]);
    }
  }
  return picked.sort((a, b) => a - b).map((i) => src[i]);
}

/**
 * @param {Array} projects - FEATURED_WORLDS_QUERY rows (orderRank order)
 * @returns {Array<{slug, clientName, title, projectColor, services, assets}>}
 *          one entry per featured project with at least one tile-able asset,
 *          in the /work World order
 */
export default function buildWorldPools(projects = []) {
  return (projects || [])
    .filter((p) => p.clientSlug && p.collection) // the /work World filter
    .map((p) => {
      const assets = p.assets || [];
      const flow = buildContentFlow(assets);
      // Editorial order across the partition: the hero leads, then showcase
      // and album art interleave back at their orderRank positions.
      const rank = new Map(assets.map((a, i) => [a._id, i]));
      const ordered = [assets[0], ...flow.showcase, ...flow.albumArt]
        .filter(Boolean)
        .sort((a, b) => (rank.get(a._id) ?? 0) - (rank.get(b._id) ?? 0));
      const seen = new Set();
      const pool = [];
      for (const a of ordered) {
        const g = toGlobeAsset(a);
        if (!g) continue;
        const key = g.playbackId || g.imageUrl;
        if (seen.has(key)) continue; // one texture per tile-able source
        seen.add(key);
        pool.push(g);
      }
      // Service tags (the chips' bracketed line): the project doc, else the
      // union of its assets' tags — the /work World rule.
      let services = (p.services || []).filter((s) => s?.slug);
      if (!services.length) {
        const tags = new Map();
        for (const a of assets)
          for (const s of a.services || []) if (s?.slug && !tags.has(s.slug)) tags.set(s.slug, s);
        services = [...tags.values()];
      }
      return {
        slug: p.slug || toProjectSlug(p.clientSlug, p.collection),
        clientName: p.clientName,
        title: p.title || null,
        projectColor: p.projectColor || null,
        services: services.map(({ name, slug }) => ({ name, slug })),
        assets: selectPool(pool, { cap: WORLD_POOL_CAP }),
      };
    })
    .filter((w) => w.assets.length);
}
