/**
 * buildAssetPool.js — Orders the globe's asset pool for breadth.
 *
 * GROQ can't sample for diversity, so this pure helper does it at build
 * time (called from the .astro route): curated picks lead the pool (they
 * land on the panels nearest the initial camera axis), then auto-fill
 * assets interleave round-robin by client so adjacent panels — and the
 * hidden-hemisphere cycle order — never cluster one client's work.
 *
 * @param {Object} data - GLOBE_ASSETS_QUERY result { curated, autoFill }
 * @returns {Array} ordered asset pool
 */
export default function buildAssetPool({ curated = [], autoFill = [] } = {}) {
  // Group auto-fill by client, preserving recency order within each group
  const byClient = new Map();
  for (const asset of autoFill) {
    const key = asset.clientSlug || asset._id;
    if (!byClient.has(key)) byClient.set(key, []);
    byClient.get(key).push(asset);
  }

  // Order client groups so consecutive picks alternate client types where
  // possible — a light diversity pass on top of the round-robin
  const groups = [...byClient.values()].sort((a, b) => {
    const typeA = a[0].clientType || '';
    const typeB = b[0].clientType || '';
    return typeA === typeB ? 0 : typeA < typeB ? -1 : 1;
  });

  // Round-robin: one asset per client per pass until all groups drain
  const interleaved = [];
  for (let pass = 0; interleaved.length < autoFill.length; pass++) {
    for (const group of groups) {
      if (pass < group.length) interleaved.push(group[pass]);
    }
  }

  return [...curated, ...interleaved];
}
