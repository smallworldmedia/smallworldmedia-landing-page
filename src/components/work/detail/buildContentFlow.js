/**
 * buildContentFlow — Content Population Hierarchy for Featured Project pages.
 *
 * Turns a featured project's asset collection (already sorted by orderRank,
 * set via drag-to-order in Studio) into categorised asset buckets. The masonry grid handles
 * visual layout — this module just separates asset categories:
 *
 *  1. The hero is always assets[0] (first in drag-to-order ranking).
 *     It is excluded from the flow and rendered in the hero band above
 *     the project blurb.
 *  2. `album-art` assets are held out for the AlbumArtOrbit (and the
 *     AlbumArtTicker) — but only when the collection clears ORBIT_MIN.
 *     Below the gate the covers fold back into the showcase flow at
 *     their original orderRank positions (they tessellate as squares).
 *  3. `brand-deck` assets are held out for the BrandDeckViewer, grouped
 *     by displayGroup: group order = first appearance (lowest-orderRank
 *     member, per the controlled-adjacency convention), pages sequenced
 *     by brandDeckOrder within each group.
 *  4. `carousel-slide` assets are held out — reserved for the
 *     Carousel component, grouped by displayGroup (orderRank within group).
 *  5. process/supporting assets (contentRole) are excluded —
 *     reserved for the future BTS section.
 *  6. Everything else is `showcase` — rendered in the masonry grid
 *     in orderRank order.
 *
 * @param {Array<Object>} assets - mediaAsset docs ordered by orderRank
 * @param {{orbitMin?: number}} [opts] - ORBIT_MIN override (live tuning)
 * @returns {{showcase: Array<Object>, albumArt: Array<Object>, brandDecks: Array<{group: string, pages: Array<Object>}>, carousels: Array<Object>, bts: Array<Object>}}
 */

/** Ratio below which an asset is considered portrait/square. */
const PORTRAIT_THRESHOLD = 1.2;

/**
 * Minimum covers for an AlbumArtOrbit — a ring of 1–2 covers is nonsense,
 * and duplicating covers would read as fake in a portfolio. Below the gate,
 * covers fold back into the showcase flow instead of vanishing.
 */
export const ORBIT_MIN = 6;

/**
 * Ratios encoded directly in the mediaType suffix.
 * These are explicitly set during ingestion and represent the
 * editorial classification — they take priority over Mux metadata,
 * which can be stale or incorrect for assets still "preparing".
 *
 * ASPECT RATIO RESOLUTION ORDER (used by ratioOf):
 *   1. mediaType-encoded ratio (e.g. motion_9x16 → 9/16) — editorial truth
 *   2. Mux `data.aspect_ratio` (e.g. "25:32") — authoritative for _other types
 *   3. Sanity image `metadata.dimensions` — authoritative for images
 *   4. Title-hint parsing (e.g. "…3x4…" or "…9x16…") — naming convention
 *   5. Ultimate fallback: 16 / 9
 *
 * INGESTION RULE: Every mediaAsset MUST have either:
 *   - A ratio-encoding mediaType (e.g. static_3x4, motion_9x16), OR
 *   - A Mux video with `data.aspect_ratio` back-synced, OR
 *   - A Sanity image with metadata dimensions, OR
 *   - A ratio hint in the title (e.g. "Promo 3x4", "Reel 9x16")
 */
const MEDIA_TYPE_RATIOS = {
  static_1x1: 1,
  static_3x4: 3 / 4,
  static_4x5: 4 / 5,
  static_9x16: 9 / 16,
  static_16x9: 16 / 9,
  motion_1x1: 1,
  motion_3x4: 3 / 4,
  motion_4x3: 4 / 3,
  motion_4x5: 4 / 5,
  motion_9x16: 9 / 16,
  motion_16x9: 16 / 9,
  'album-art': 1,
  'brand-deck': 16 / 9,
  'featured-project-reel': 16 / 9,
  // no `logo` entry: logos don't encode a ratio (live set is 1.14–2.0),
  // so they fall through to real image dimensions.
};

/**
 * Parse ratio hints embedded in asset titles.
 * Matches patterns like "3x4", "9x16", "4x5", "16x9", "1x1".
 * Returns w/h or null if no match.
 */
const TITLE_RATIO_RE = /\b(\d{1,2})\s*[xX×]\s*(\d{1,2})\b/;
function ratioFromTitle(title) {
  if (!title) return null;
  const m = title.match(TITLE_RATIO_RE);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w && h) return w / h;
  }
  return null;
}

/**
 * Best-known aspect ratio for an asset.
 *
 * Resolution cascade:
 *   mediaType map → Mux data → Sanity image dims → title hint → 16:9
 *
 * The mediaType is checked first because it represents the editorial
 * classification set during ingestion. Mux `data.aspect_ratio` can be
 * stale or incorrect — especially when status is "preparing" — leading
 * to orientation mismatches (e.g. 9:16 assets reported as 16:9).
 * For generic types (motion_other, static_other), Mux data is the
 * primary source.
 */
export function ratioOf(asset) {
  // 0. brand-deck pages with real image dims (08-25): the native page
  //    aspect outranks the historical 16:9 default — a COMPILED poster
  //    deck (SA tour, 4:5 stills regrouped as a deck) keeps its aspect
  //    everywhere (DeckScroller wall, directory grid); true 16:9 deck
  //    exports resolve identically to the old constant.
  if (
    asset.mediaType === 'brand-deck' &&
    asset.imageDimensions?.width &&
    asset.imageDimensions?.height
  ) {
    return asset.imageDimensions.width / asset.imageDimensions.height;
  }

  // 1. mediaType-encoded ratio — editorial truth
  const typeRatio = MEDIA_TYPE_RATIOS[asset.mediaType];
  if (typeRatio != null) return typeRatio;

  // 2. Mux data — authoritative for _other types with processed video
  if (asset.videoAspectRatio) {
    const [w, h] = asset.videoAspectRatio.split(':').map(Number);
    if (w && h) return w / h;
  }

  // 3. Sanity image dimensions — authoritative for static images
  if (asset.imageDimensions?.width && asset.imageDimensions?.height) {
    return asset.imageDimensions.width / asset.imageDimensions.height;
  }

  // 4. Title hint — naming convention fallback
  const titleRatio = ratioFromTitle(asset.title);
  if (titleRatio) return titleRatio;

  // 5. Ultimate fallback
  return 16 / 9;
}

export { PORTRAIT_THRESHOLD };

export function buildContentFlow(assets, { orbitMin = ORBIT_MIN } = {}) {
  const albumArt = [];
  const carousels = [];
  const bts = [];
  const showcase = [];
  // Map preserves insertion order → group order = first appearance =
  // lowest-orderRank member (controlled-adjacency convention).
  const deckGroups = new Map();

  // assets[0] is the hero (first in drag-to-order ranking) — skip it.
  // showcase/albumArt entries carry their loop index so a gate fold-back
  // can restore the original orderRank interleaving.
  for (let i = 1; i < assets.length; i++) {
    const asset = assets[i];

    // Skip empty shells — assets with no uploaded media can't render
    const hasMedia = !!asset.playbackId || !!asset.imageUrl;
    if (!hasMedia) continue;

    if (asset.mediaType === 'album-art') albumArt.push({ i, asset });
    else if (asset.mediaType === 'brand-deck') {
      const key = asset.displayGroup ?? 'deck';
      if (!deckGroups.has(key)) deckGroups.set(key, []);
      deckGroups.get(key).push(asset);
    } else if (asset.mediaType === 'carousel-slide') carousels.push(asset);
    else if (asset.contentRole) bts.push(asset);
    else showcase.push({ i, asset });
  }

  // ORBIT_MIN gate — below it, covers fold back into the showcase flow.
  const orbits = albumArt.length >= orbitMin;
  const showcaseOut = (orbits ? showcase : [...showcase, ...albumArt])
    .sort((a, b) => a.i - b.i)
    .map((e) => e.asset);
  const albumArtOut = orbits ? albumArt.map((e) => e.asset) : [];

  // Decks: pages sequence by brandDeckOrder within each group (stable sort
  // keeps orderRank order for ties).
  const brandDecks = [...deckGroups.entries()].map(([group, pages]) => ({
    group,
    pages: [...pages].sort(
      (a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0)
    ),
  }));

  // Group carousels by displayGroup; the sort is stable so within each group
  // assets keep their incoming order (orderRank, set via drag-to-order).
  carousels.sort((a, b) =>
    (a.displayGroup ?? '').localeCompare(b.displayGroup ?? '')
  );

  return { showcase: showcaseOut, albumArt: albumArtOut, brandDecks, carousels, bts };
}
