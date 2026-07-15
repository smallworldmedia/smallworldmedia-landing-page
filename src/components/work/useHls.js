/**
 * useHls — Shared hook for HLS video playback via hls.js.
 *
 * Attaches an HLS stream to a <video> ref. Safari uses native HLS support;
 * all other browsers use hls.js. Cleans up the HLS instance on unmount
 * or when the source changes.
 *
 * When preferMaxQuality is true (Lightbox mode):
 *  - Locks to the highest rendition, disables ABR.
 *  - Does NOT autoplay immediately. Instead, waits until the first
 *    high-res fragment is buffered, then plays. The poster thumbnail
 *    covers the element during this brief buffer period, so the user
 *    sees: sharp poster → sharp video (no quality jump).
 *
 * When preferMinQuality is true (globe panel mode):
 *  - Locks to the lowest rendition, disables ABR. Panels are small on
 *    screen, so the lowest level is visually lossless there and keeps
 *    decode + delivery cost minimal regardless of URL playback modifiers.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef
 * @param {string|null} src - Full HLS URL (e.g. https://stream.mux.com/{id}.m3u8)
 * @param {Object} [hlsConfig] - Optional hls.js constructor config overrides
 * @param {Object} [options]
 * @param {boolean} [options.preferMaxQuality=false] - Lock to highest rendition
 * @param {boolean} [options.preferMinQuality=false] - Lock to lowest rendition
 */
import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

export default function useHls(
  videoRef,
  src,
  hlsConfig = {},
  { preferMaxQuality = false, preferMinQuality = false } = {}
) {
  const hlsRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Tear down any previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Always prefer hls.js (gives us quality control on all browsers
    // including Safari). Native HLS is only a fallback for old devices
    // where MSE isn't supported.
    if (Hls.isSupported()) {
      // handled below
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback: native HLS (very old iOS, etc.)
      video.src = src;
      video.play().catch(() => {});
      return;
    } else {
      return; // no HLS support at all
    }
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // When max quality is requested, tell hls.js to start at
        // the highest level from the very first segment request.
        // startLevel: -1 = auto, any positive = that level index.
        // We use 99 (higher than any real level count) — hls.js
        // clamps to the actual highest level.
        ...(preferMaxQuality ? { startLevel: 99 } : {}),
        ...(preferMinQuality ? { startLevel: 0 } : {}),
        // Plain-ABR consumers (detail masonry/hero band, next-project band):
        // never auto-select renditions above the rendered size × DPR. The
        // quality-locked modes pin an explicit level, so the cap only
        // applies where ABR is actually choosing.
        ...(!preferMaxQuality && !preferMinQuality
          ? { capLevelToPlayerSize: true }
          : {}),
        ...hlsConfig,
      });
      hlsRef.current = hls;

      hls.loadSource(src);
      hls.attachMedia(video);

      if (preferMaxQuality) {
        // After manifest is parsed, triple-lock to highest rendition
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          const maxLevel = hls.levels.length - 1;
          if (maxLevel >= 0) {
            // Setting an explicit currentLevel disables ABR auto-selection
            // (hls.autoLevelEnabled is a read-only getter — assigning it throws)
            hls.loadLevel = maxLevel;    // force current load to this level
            hls.nextLevel = maxLevel;    // force next segment to this level
            hls.currentLevel = maxLevel; // set the active level
          }
        });

        // Wait for the first high-res fragment to buffer, then play.
        // Poster thumbnail shows during this brief wait — no quality jump.
        hls.on(Hls.Events.FRAG_BUFFERED, () => {
          video.play().catch(() => {});
          hls.off(Hls.Events.FRAG_BUFFERED);
        });
      } else if (preferMinQuality) {
        // After manifest is parsed, triple-lock to lowest rendition
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (hls.levels.length > 0) {
            // Explicit currentLevel disables ABR (autoLevelEnabled is read-only)
            hls.loadLevel = 0;    // force current load to this level
            hls.nextLevel = 0;    // force next segment to this level
            hls.currentLevel = 0; // set the active level
          }
          video.play().catch(() => {});
        });
      } else {
        // Grid preview: play as soon as manifest is parsed (ABR auto-selects)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      }

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          }
        }
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  return hlsRef;
}
