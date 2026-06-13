/**
 * buildContentFlow — Content Population Hierarchy for Featured Project pages.
 *
 * Turns a featured project's asset collection (already in manifest row
 * order via sortOrder) into categorised asset buckets. The masonry grid
 * handles visual layout — this module just separates asset categories:
 *
 *  1. The hero (isHero — the sizzle reel) is excluded; it always
 *     occupies the hero band above the project blurb.
 *  2. `album-art` assets are held out — reserved for the
 *     AlbumArtOrbit component and the AlbumArtTicker.
 *  3. `brand-deck` assets are held out — reserved for the
 *     BrandDeckViewer component, sorted by brandDeckOrder.
 *  4. `carousel-slide` assets are held out — reserved for the
 *     Carousel component, grouped by displayGroup in sortOrder.
 *  5. process/supporting assets (contentRole) are excluded —
 *     reserved for the future BTS section.
 *  6. Everything else is `showcase` — rendered in the masonry grid
 *     in sortOrder.
 *
 * @param {Array<Object>} assets - mediaAsset docs ordered by sortOrder
 * @returns {{showcase: Array<Object>, albumArt: Array<Object>, brandDecks: Array<Object>, carousels: Array<Object>, bts: Array<Object>}}
 */

/** Ratio below which an asset is considered portrait/square. */
const PORTRAIT_THRESHOLD = 1.2;

/**
 * Fallback ratios inferred from the mediaType format suffix.
 *
 * ASPECT RATIO RESOLUTION ORDER (used by ratioOf):
 *   1. Mux `data.aspect_ratio` (e.g. "16:9") — authoritative for video
 *   2. Sanity image `metadata.dimensions` — authoritative for images
 *   3. Title-hint parsing (e.g. "…3x4…" or "…9x16…") — naming convention
 *   4. mediaType lookup from this map
 *   5. Ultimate fallback: 16 / 9
 *
 * INGESTION RULE: Every mediaAsset MUST have either:
 *   - A Mux video with `data.aspect_ratio` back-synced, OR
 *   - A Sanity image with metadata dimensions, OR
 *   - A ratio-encoding mediaType (e.g. static_3x4, motion_9x16), OR
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
  motion_4x5: 4 / 5,
  motion_9x16: 9 / 16,
  motion_16x9: 16 / 9,
  'album-art': 1,
  'brand-deck': 16 / 9,
  'brand-deck-page': 16 / 9,
  'featured-project-reel': 16 / 9,
  logo: 1,
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
 *   Mux data → Sanity image dims → title hint → mediaType map → 16:9
 */
export function ratioOf(asset) {
  if (asset.videoAspectRatio) {
    const [w, h] = asset.videoAspectRatio.split(':').map(Number);
    if (w && h) return w / h;
  }
  if (asset.imageDimensions?.width && asset.imageDimensions?.height) {
    return asset.imageDimensions.width / asset.imageDimensions.height;
  }
  const titleRatio = ratioFromTitle(asset.title);
  if (titleRatio) return titleRatio;
  return MEDIA_TYPE_RATIOS[asset.mediaType] ?? 16 / 9;
}

export { PORTRAIT_THRESHOLD };

export function buildContentFlow(assets) {
  const albumArt = [];
  const brandDecks = [];
  const carousels = [];
  const bts = [];
  const showcase = [];

  for (const asset of assets) {
    if (asset.isHero) continue;

    // Skip empty shells — assets with no uploaded media can't render
    const hasMedia = !!asset.playbackId || !!asset.imageUrl;
    if (!hasMedia) continue;

    if (asset.mediaType === 'album-art') albumArt.push(asset);
    else if (asset.mediaType === 'brand-deck' || asset.mediaType === 'brand-deck-page')
      brandDecks.push(asset);
    else if (asset.mediaType === 'carousel-slide') carousels.push(asset);
    else if (asset.contentRole) bts.push(asset);
    else showcase.push(asset);
  }

  // Sort brand decks by brandDeckOrder within each displayGroup
  brandDecks.sort((a, b) => (a.brandDeckOrder ?? 0) - (b.brandDeckOrder ?? 0));

  // Carousels keep manifest order (sortOrder) within each displayGroup
  carousels.sort((a, b) =>
    (a.displayGroup ?? '').localeCompare(b.displayGroup ?? '') ||
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );

  return { showcase, albumArt, brandDecks, carousels, bts };
}
