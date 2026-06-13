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
 */
import { useRef, useEffect, useState } from 'react';
import useHls from '../useHls.js';
import { IMG_FORMAT } from '../imageConfig.js';
import { ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';

/** Sanity image width for detail page slots */
const SLOT_IMG_WIDTH = 1400;

export default function MediaSlot({ asset }) {
  const slotRef = useRef(null);
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = !!asset.playbackId;

  const hlsSrc = isVideo && isVisible
    ? `https://stream.mux.com/${asset.playbackId}.m3u8`
    : null;

  useHls(videoRef, hlsSrc);

  const posterUrl = isVideo
    ? `https://image.mux.com/${asset.playbackId}/thumbnail.jpg?width=${SLOT_IMG_WIDTH}&fit_mode=preserve`
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
      { rootMargin: '200px', threshold: 0.05 }
    );

    observer.observe(slotRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <figure
      ref={slotRef}
      className="media-slot"
      data-portrait={isPortrait || undefined}
      style={{ '--slot-ratio': ratio }}
      aria-label={asset.title || undefined}
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
