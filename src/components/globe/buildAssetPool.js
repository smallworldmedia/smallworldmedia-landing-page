/**
 * buildAssetPool.js — Orders the globe's asset pool from the Featured
 * Project hierarchy. Pure; runs at build time in the .astro routes.
 *
 * Pool position is doubly meaningful: the head lands on the most
 * prominent panels at load, and hidden-hemisphere cycling walks the
 * same order — so this IS the first-impression curation.
 *
 * Tiers:
 *  1. globeOrder picks       — manual override, hand-ranked in Studio
 *  2. Featured sizzle reels  — isHero assets, ordered by their project
 *                              doc's editorial sortOrder (unranked last)
 *  3. Featured-collection showcase — remaining motion assets from
 *                              hero-marked collections, round-robin per
 *                              collection (collections in rank order)
 *  4. General showcase       — everything else, round-robin per client
 *                              so no client's work clusters
 *
 * Assets join project docs via toProjectSlug(clientSlug, sourceManifest)
 * — the same derivation the /work/[slug] routes use.
 *
 * @param {Object} data - GLOBE_ASSETS_QUERY result
 * @returns {Array} ordered asset pool
 */
import { toProjectSlug } from '../../lib/projectSlug.js';

const UNRANKED = Number.MAX_SAFE_INTEGER;

/**
 * Round-robin interleave: one asset per group per pass, groups visited
 * in comparator order (falling back to first-seen order). Preserves
 * each group's internal ordering.
 */
function interleave(assets, keyOf, compareGroups = null) {
  const groups = new Map();
  for (const asset of assets) {
    const key = keyOf(asset) ?? asset._id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(asset);
  }

  const ordered = [...groups.values()];
  if (compareGroups) ordered.sort(compareGroups);

  const out = [];
  for (let pass = 0; out.length < assets.length; pass++) {
    for (const group of ordered) {
      if (pass < group.length) out.push(group[pass]);
    }
  }
  return out;
}

export default function buildAssetPool({
  curated = [],
  featuredProjects = [],
  heroes = [],
  autoFill = [],
} = {}) {
  // Editorial rank layer: project slug → sortOrder
  const projectRank = new Map(
    featuredProjects.map((p) => [p.slug, p.sortOrder ?? UNRANKED])
  );
  const rankOf = (asset) => {
    if (!asset.clientSlug || !asset.collection) return UNRANKED;
    return projectRank.get(toProjectSlug(asset.clientSlug, asset.collection)) ?? UNRANKED;
  };

  // Every hero marks its collection as featured — including static/deck
  // heroes whose collections contribute motion assets to tier 3
  const featuredFolders = new Set(
    heroes.filter((a) => a.sourceFolder).map((a) => a.sourceFolder)
  );

  // Tier 2 — playable sizzle reels in editorial project order ("preparing"
  // accepted: Mux statuses in Sanity are stale snapshots, streams verified)
  const heroPanels = heroes
    .filter((a) => a.playbackId && (!a.videoStatus || ['ready', 'preparing'].includes(a.videoStatus)))
    .sort((a, b) => rankOf(a) - rankOf(b));

  // Tier 3 — the featured collections' showcase motion, one per
  // collection per pass, collections in rank order
  const folderRank = new Map();
  for (const asset of autoFill) {
    if (!asset.sourceFolder || !featuredFolders.has(asset.sourceFolder)) continue;
    const rank = rankOf(asset);
    const prev = folderRank.get(asset.sourceFolder);
    if (prev === undefined || rank < prev) folderRank.set(asset.sourceFolder, rank);
  }
  const featuredRest = interleave(
    autoFill.filter((a) => a.sourceFolder && featuredFolders.has(a.sourceFolder)),
    (a) => a.sourceFolder,
    (g1, g2) =>
      (folderRank.get(g1[0].sourceFolder) ?? UNRANKED) -
      (folderRank.get(g2[0].sourceFolder) ?? UNRANKED)
  );
  const featuredIds = new Set(featuredRest.map((a) => a._id));

  // Tier 4 — general showcase backstop, round-robin per client with a
  // light clientType pass so adjacent panels diversify
  const rest = interleave(
    autoFill.filter((a) => !featuredIds.has(a._id)),
    (a) => a.clientSlug,
    (g1, g2) => {
      const typeA = g1[0].clientType || '';
      const typeB = g2[0].clientType || '';
      return typeA === typeB ? 0 : typeA < typeB ? -1 : 1;
    }
  );

  return [...curated, ...heroPanels, ...featuredRest, ...rest];
}
