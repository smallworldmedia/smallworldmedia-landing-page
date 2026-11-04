/**
 * Shared media-display settings for the detail page, the Project Directory,
 * the /work Worlds and the globe's video pool.
 *
 * Single source of truth so MediaSlot (detail and directory), NextProjectBand,
 * VideoSlotPool and any future grid components stay in sync.
 */

/** Sanity image transform suffix — auto WebP/AVIF negotiation */
export const IMG_FORMAT = 'auto=format';

/* — Video: how much of each Mux stream the muted autoplay surfaces fetch —
   Mux instant clipping: asset_end_time on the master playlist ends the
   stream there. Mux keeps every segment that starts before the clip, so a
   stream ends on the first segment boundary at or after it, never before it
   (or at the asset's own end when that comes first). hls.js treats
   maxBufferLength as a floor, not a cap, so without the clip a muted loop
   downloads its whole asset. Every autoplay surface asks through muxStream. */

/** The preview window, in seconds (Nathan, 10-09): the globe's video pool
 *  (home, /lab, the /work World's Near tier) loops here. */
export const PREVIEW_SECONDS = 5;

/** The detail page's cap, in seconds (Nathan, 10-09: strict): MediaSlot and
 *  NextProjectBand stream at most this much of an asset (plus the rest of the
 *  segment the cap falls in) and wrap at it: `loop` at the clip's end, and
 *  a wrapAt seek where Mux ends the clip on a later segment boundary. */
export const DETAIL_MAX_SECONDS = 15;

/** onTimeUpdate for a player that loops at `seconds`: back to frame 0
 *  there, where Mux ends the clip on a later segment boundary. */
export function wrapAt(seconds) {
  return (e) => {
    const v = e.currentTarget;
    if (v.currentTime >= seconds) v.currentTime = 0;
  };
}

/** onTimeUpdate for a detail player: back to frame 0 at the cap. */
export const wrapAtDetailCap = wrapAt(DETAIL_MAX_SECONDS);

/** A Mux master playlist URL that ends the stream at `end` seconds. `params`
 *  (a min = max rendition pin, say) go first; the clip goes last, once. */
export function muxStream(playbackId, end, params = '') {
  const pre = params ? `${params}&` : '';
  return `https://stream.mux.com/${playbackId}.m3u8?${pre}asset_end_time=${end}`;
}

/** A video's poster (Mux thumbnail) at `width`: frame 0, where playback
 *  starts and every wrap returns. */
export function muxPoster(playbackId, width) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&fit_mode=preserve&time=0`;
}

/* — The Project Directory (11-03): its players and its image widths — */

/** Players at once (playerGate's cap; ?dirplayers): under the globe pool's
 *  7 and 4, since a directory tile is larger on screen than a globe panel. */
export const DIRECTORY_PLAYERS = { desktop: 6, phone: 3 };

/** ms a video tile stays half in view before it plays (?dirdwell), so a
 *  fling past never asks Mux for a master. */
export const DIRECTORY_DWELL_MS = 300;

/** srcset widths (px) for the directory's images and posters. */
export const SRCSET_WIDTHS = [480, 720, 1080, 1440, 2000];

/** A Sanity image's srcset: SRCSET_WIDTHS up to the original's width, which
 *  ends the set (the CDN never scales up). */
export function sanitySrcSet(url, nativeWidth) {
  const top = Math.min(nativeWidth || Infinity, SRCSET_WIDTHS.at(-1));
  return [...SRCSET_WIDTHS.filter((w) => w < top), top]
    .map((w) => `${url}?w=${w}&${IMG_FORMAT} ${w}w`)
    .join(', ');
}

/** A video poster's srcset over SRCSET_WIDTHS (muxPoster). */
export function muxPosterSrcSet(playbackId) {
  return SRCSET_WIDTHS.map((w) => `${muxPoster(playbackId, w)} ${w}w`).join(', ');
}
