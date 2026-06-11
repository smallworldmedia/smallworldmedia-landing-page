/**
 * MediaSlot — A single media container on the Featured Project page.
 *
 * Two variants, both 16:9 with cover-cropped media per the Figma:
 *  - "full"  — full viewport width (hero, solo showcase assets)
 *  - "split" — half width, paired inside a .media-row--split
 *
 * Videos stream the full Mux HLS loop (no preview cap — these are
 * sizzle reels and showcase loops). HLS attaches lazily when the slot
 * enters the viewport; playback pauses off-screen. Images load from
 * the Sanity CDN. Both fade in via the shared load-gate pattern.
 *
 * @param {Object} props
 * @param {Object}  props.asset    - mediaAsset doc from FEATURED_PROJECT_DETAIL_QUERY
 * @param {'full'|'split'} [props.variant='full']
 */
import { useRef, useEffect, useState } from 'react';
import useHls from '../useHls.js';
import { IMG_FORMAT } from '../imageConfig.js';

/** Sanity image width params per slot variant */
const SLOT_IMG_WIDTH = { full: 2000, split: 1200 };

export default function MediaSlot({ asset, variant = 'full' }) {
  const slotRef = useRef(null);
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = !!asset.playbackId;

  const hlsSrc = isVideo && isVisible
    ? `https://stream.mux.com/${asset.playbackId}.m3u8`
    : null;

  useHls(videoRef, hlsSrc);

  const imageWidth = SLOT_IMG_WIDTH[variant] ?? SLOT_IMG_WIDTH.full;

  const posterUrl = isVideo
    ? `https://image.mux.com/${asset.playbackId}/thumbnail.jpg?width=${imageWidth}&fit_mode=preserve`
    : null;

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
      className={`media-slot media-slot--${variant}`}
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
          src={`${asset.imageUrl}?w=${imageWidth}&${IMG_FORMAT}`}
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
