/**
 * Shared media-display settings for the /work grids, the detail page and the
 * globe's video pool.
 *
 * Single source of truth so MediaCard, AlbumArtTicker, MediaSlot,
 * NextProjectBand, VideoSlotPool and any future grid components stay in sync.
 */

/** Width param for standard grid tiles (≤ 1.6 aspect ratio) */
export const IMG_WIDTH_STANDARD = 800;

/** Width param for wide/landscape grid tiles (> 1.6 aspect ratio) */
export const IMG_WIDTH_WIDE = 1200;

/** Sanity image transform suffix — auto WebP/AVIF negotiation */
export const IMG_FORMAT = 'auto=format';

/* — Video: how much of each Mux stream the muted autoplay surfaces fetch —
   Mux instant clipping: asset_end_time on the master playlist ends the
   stream there. Mux keeps every segment that starts before the clip, so a
   stream ends on the first segment boundary at or after it, never before it
   (or at the asset's own end when that comes first). hls.js treats
   maxBufferLength as a floor, not a cap, so without the clip a muted loop
   downloads its whole asset. Every autoplay surface asks through muxStream;
   the Lightbox does not, since a viewer opened it to watch the whole piece. */

/** The preview window, in seconds (Nathan, 10-09): the globe's video pool
 *  (home, /lab, the /work World's Near tier) and MediaCard loop here. */
export const PREVIEW_SECONDS = 5;

/** The detail page's cap, in seconds (Nathan, 10-09: strict): MediaSlot and
 *  NextProjectBand stream at most this much of an asset (plus the rest of the
 *  segment the cap falls in) and wrap at it: `loop` at the clip's end, and
 *  wrapAtDetailCap where Mux ends the clip on a later segment boundary. */
export const DETAIL_MAX_SECONDS = 15;

/** onTimeUpdate for a detail player: back to frame 0 at the cap. */
export function wrapAtDetailCap(e) {
  const v = e.currentTarget;
  if (v.currentTime >= DETAIL_MAX_SECONDS) v.currentTime = 0;
}

/** A Mux master playlist URL that ends the stream at `end` seconds. `params`
 *  (a min = max rendition pin, say) go first; the clip goes last, once. */
export function muxStream(playbackId, end, params = '') {
  const pre = params ? `${params}&` : '';
  return `https://stream.mux.com/${playbackId}.m3u8?${pre}asset_end_time=${end}`;
}
