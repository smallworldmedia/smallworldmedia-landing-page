/**
 * Shared image-display settings for the /work grid.
 *
 * Single source of truth so MediaCard, AlbumArtTicker, and any
 * future grid components stay in sync.
 */

/** Width param for standard grid tiles (≤ 1.6 aspect ratio) */
export const IMG_WIDTH_STANDARD = 800;

/** Width param for wide/landscape grid tiles (> 1.6 aspect ratio) */
export const IMG_WIDTH_WIDE = 1200;

/** Sanity image transform suffix — auto WebP/AVIF negotiation */
export const IMG_FORMAT = 'auto=format';
