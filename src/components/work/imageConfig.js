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

/** A Mux master playlist URL that ends the stream at `end` seconds, and with
 *  a `start` above 0 begins it there (asset_start_time). `params` (a min =
 *  max rendition pin, say) go first; the clip goes last, once. */
export function muxStream(playbackId, end, params = '', start = 0) {
  const pre = params ? `${params}&` : '';
  const from = start > 0 ? `asset_start_time=${start}&` : '';
  return `https://stream.mux.com/${playbackId}.m3u8?${pre}${from}asset_end_time=${end}`;
}

/** A video's poster (Mux thumbnail) at `width`: by default frame 0, where
 *  playback starts and every wrap returns. A chunk (chunkRanges) passes the
 *  time its own range starts at. */
export function muxPoster(playbackId, width, time = 0) {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=${width}&fit_mode=preserve&time=${time}`;
}

/* — Chunks (11-05, Nathan): a video flagged `splitIntoThirds` in Sanity shows
   on the detail page as CHUNK_COUNT tiles, each playing its own whole share of
   the asset, no overlap. Each is clipped at the source with both ends of
   muxStream. Nathan: "each chunk plays its third", so a chunk is exempt from
   DETAIL_MAX_SECONDS. — */

/** Tiles a flagged video splits into (the thirds; a later count field would replace it). */
export const CHUNK_COUNT = 3;

/** Mux cuts a clip's start back to the segment boundary at or before it, so a
 *  clipped stream's own timeline begins there, not at asset_start_time.
 *  Measured 11-05 on seven assets from old and new uploads: 5 s segments
 *  (EXT-X-TARGETDURATION 5) on every one. chunkWindow uses it. */
export const MUX_SEGMENT_SECONDS = 5;

/** `count` equal, adjacent ranges that cover [0, duration] with no overlap:
 *  each ends exactly where the next starts (boundaries rounded to ms once and
 *  shared), the last ends at `duration`. null for a duration that is not a
 *  positive number, so the caller leaves the video as one tile. */
export function chunkRanges(duration, count = CHUNK_COUNT) {
  if (!(duration > 0) || !(count >= 2)) return null;
  const edge = (k) => (k === 0 ? 0 : k === count ? duration : Math.round((duration * k * 1000) / count) / 1000);
  return Array.from({ length: count }, (_, k) => ({ start: edge(k), end: edge(k + 1) }));
}

/** Where a chunk plays inside its own clipped stream: `from` and `to`, in
 *  seconds on the stream's timeline, which starts at the segment boundary at
 *  or before `start`. */
export function chunkWindow({ start, end }) {
  const base = Math.floor(start / MUX_SEGMENT_SECONDS) * MUX_SEGMENT_SECONDS;
  return { from: start - base, to: end - base };
}

/** The handlers of a player that loops the window [from, to) of its stream:
 *  playback starts at `from` (a native-HLS player that began earlier seeks on
 *  metadata), and at `to`, or at the stream's end when that comes first, it
 *  goes back to `from`. A chunk never uses `loop`: that returns to the
 *  stream's own start, which can sit up to a segment inside the previous
 *  chunk's range. */
export function windowLoop(from, to) {
  return {
    onLoadedMetadata: (e) => {
      const v = e.currentTarget;
      if (from > 0 && v.currentTime < from - 0.1) v.currentTime = from;
    },
    onTimeUpdate: (e) => {
      const v = e.currentTarget;
      if (v.currentTime >= to) v.currentTime = from;
    },
    onEnded: (e) => {
      const v = e.currentTarget;
      v.currentTime = from;
      v.play().catch(() => {});
    },
  };
}

/* — The Project Directory (11-03): its players and its image widths — */

/** Players at once (playerGate's cap; ?dirplayers). Nathan 11-05 asked for more than
 *  6 and 3 once five columns put about 15 tiles in view (8 on a phone): one past
 *  the globe pool's 7 on desktop, and the globe's proven 4 on a phone. */
export const DIRECTORY_PLAYERS = { desktop: 8, phone: 4 };

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
