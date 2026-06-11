/**
 * buildContentFlow — Content Population Hierarchy for Featured Project pages.
 *
 * Turns a featured project's asset collection (already in manifest row
 * order via sortOrder) into an editorial layout sequence. The directory's
 * contents drive the layout — projects with more videos get more
 * full-bleed slots, still-heavy projects pair up into split rows.
 *
 * Hierarchy rules (see CONTEXT.md → Content Population Hierarchy):
 *  1. The hero (isHero — the sizzle reel) is excluded here; it always
 *     occupies the full-bleed slot above the project blurb.
 *  2. Showcase assets (no contentRole) flow in an alternating rhythm:
 *     full-bleed → split pair → full-bleed → …
 *  3. Portrait/square assets (ratio < 1.2) never render full-bleed —
 *     they are always held for a split pairing.
 *  4. `album-art` assets are held out of the flow — reserved for the
 *     future orbiting AlbumArtOrbit component, which populates only
 *     when the project directory contains an Artwork folder.
 *  5. process/supporting assets are excluded — reserved for the
 *     future BTS section at the bottom of the page.
 *
 * @param {Array<Object>} assets - mediaAsset docs ordered by sortOrder
 * @returns {{rows: Array<{type: 'full'|'split', assets: Array<Object>}>, albumArt: Array<Object>, bts: Array<Object>}}
 */

/** Ratio below which an asset is considered portrait/square. */
const PORTRAIT_THRESHOLD = 1.2;

/** Fallback ratios inferred from the mediaType format suffix. */
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
  'featured-project-reel': 16 / 9,
};

/** Best-known aspect ratio for an asset (Mux data → image metadata → mediaType). */
export function ratioOf(asset) {
  if (asset.videoAspectRatio) {
    const [w, h] = asset.videoAspectRatio.split(':').map(Number);
    if (w && h) return w / h;
  }
  if (asset.imageDimensions?.width && asset.imageDimensions?.height) {
    return asset.imageDimensions.width / asset.imageDimensions.height;
  }
  return MEDIA_TYPE_RATIOS[asset.mediaType] ?? 16 / 9;
}

export function buildContentFlow(assets) {
  const albumArt = [];
  const bts = [];
  const flow = [];

  for (const asset of assets) {
    if (asset.isHero) continue;
    if (asset.mediaType === 'album-art') albumArt.push(asset);
    else if (asset.contentRole) bts.push(asset);
    else flow.push(asset);
  }

  const rows = [];
  let wantSplit = false; // first row after the blurb is full-bleed

  while (flow.length > 0) {
    const next = flow[0];
    const isPortrait = ratioOf(next) < PORTRAIT_THRESHOLD;

    if ((wantSplit || isPortrait) && flow.length >= 2) {
      rows.push({ type: 'split', assets: flow.splice(0, 2) });
    } else if (isPortrait) {
      // Trailing portrait: half-width slot rather than a full-bleed crop
      rows.push({ type: 'split', assets: flow.splice(0, 1) });
    } else {
      rows.push({ type: 'full', assets: flow.splice(0, 1) });
    }

    wantSplit = rows[rows.length - 1].type === 'full';
  }

  return { rows, albumArt, bts };
}
