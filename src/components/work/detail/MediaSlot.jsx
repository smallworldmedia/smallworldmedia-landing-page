/**
 * MediaSlot — A single media container on the Featured Project page.
 *
 * Renders as a masonry grid child — each slot sizes itself via
 * aspect-ratio from the asset's native dimensions. Portrait assets
 * are clamped to a 3:4 minimum container with object-fit: cover.
 *
 * Videos stream the full Mux HLS loop (no preview cap — these are
 * sizzle reels and showcase loops). HLS attaches lazily when the slot
 * enters the viewport; playback pauses off-screen. Images load from
 * the Sanity CDN. Both fade in via the shared load-gate pattern.
 *
 * @param {Object} props
 * @param {Object}  props.asset - mediaAsset doc from FEATURED_PROJECT_DETAIL_QUERY
 * @param {boolean} [props.eager=false] - Seed visibility at hydration (hero slot)
 */
import { useRef, useEffect, useState } from 'react';
import useHls from '../useHls.js';
import { IMG_FORMAT } from '../imageConfig.js';
import { ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';

/** Sanity image width for detail page slots */
const SLOT_IMG_WIDTH = 1400;

/** hls.js config for detail slots — prefetch the first fragment alongside
    manifest parsing, and start at the 720p rendition so the first painted
    frame is sharp; ABR adapts from there (capLevelToPlayerSize stays on
    inside useHls). */
const DETAIL_HLS_CONFIG = {
  startFragPrefetch: true,
  startLevel: 2,
};

/** IO pre-load band — vertical-only; horizontal margin is inert on a
    vertical page. Wide enough that scrolled-to slots already stream. */
const IO_MARGIN = '400px 0px';

export default function MediaSlot({ asset, style, eager = false, ...rest }) {
  const slotRef = useRef(null);
  const videoRef = useRef(null);
  // Eager slots (the hero) seed visibility at hydration — rootMargin alone
  // still waits on the observer's first async callback; seeding starts the
  // manifest fetch immediately. The observer still governs afterwards.
  const [isVisible, setIsVisible] = useState(eager);
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = !!asset.playbackId;

  const hlsSrc = isVideo && isVisible
    ? `https://stream.mux.com/${asset.playbackId}.m3u8`
    : null;

  useHls(videoRef, hlsSrc, DETAIL_HLS_CONFIG);

  // time=0: playback starts at frame 0 (native loop, no seek), so the
  // frame-0 poster is the aligned one — no poster→playback jump.
  const posterUrl = isVideo
    ? `https://image.mux.com/${asset.playbackId}/thumbnail.jpg?width=${SLOT_IMG_WIDTH}&fit_mode=preserve&time=0`
    : null;

  const ratio = ratioOf(asset);
  const isPortrait = ratio < PORTRAIT_THRESHOLD;

  useEffect(() => {
    if (!slotRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        }
      },
      { rootMargin: IO_MARGIN, threshold: 0.05 }
    );

    observer.observe(slotRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <figure
      ref={slotRef}
      className="media-slot"
      data-portrait={isPortrait || undefined}
      style={{ '--slot-ratio': ratio, ...style }}
      aria-label={asset.title || undefined}
      {...rest}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
          poster={posterUrl}
          muted
          autoPlay
          loop
          playsInline
          onCanPlay={() => setIsLoaded(true)}
        />
      ) : asset.imageUrl ? (
        <img
          className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
          src={`${asset.imageUrl}?w=${SLOT_IMG_WIDTH}&${IMG_FORMAT}`}
          alt={asset.title || ''}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <div className="media-slot__media" aria-hidden="true" />
      )}
    </figure>
  );
}
