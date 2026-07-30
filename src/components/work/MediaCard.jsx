/**
 * MediaCard — Individual grid cell for a media asset.
 *
 * - Each card sets its own aspect-ratio via the shared ratioOf cascade.
 * - Images: rendered as <img> with lazy loading.
 * - Videos: real <video> element with HLS streaming (via useHls).
 *   IntersectionObserver triggers play/pause and loads HLS only when visible.
 *   Capped to a 4-second preview loop, muted, auto-playing.
 * - Duotone hover overlay fades in (opacity) with dynamic metadata.
 *
 * @param {Object} props
 * @param {Object}   props.asset       - Single mediaAsset document from GROQ
 * @param {Set}      props.activeSlugs - Currently active filter slugs (for dynamic metadata)
 * @param {(asset: Object) => void} props.onSelect - Opens the Lightbox
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import useHls from './useHls.js';
import { ratioOf } from './detail/buildContentFlow.js';
import { IMG_WIDTH_STANDARD, IMG_WIDTH_WIDE, IMG_FORMAT } from './imageConfig.js';

/** Preview loop cap in seconds */
const PREVIEW_SECONDS = 4;

/** hls.js config for grid previews — start at 720p for sharp tiles */
const GRID_HLS_CONFIG = {
  maxBufferLength: 8,
  startLevel: 2,  // 720p rendition — sharp for grid tiles, bandwidth-friendly
};

export default function MediaCard({ asset, onSelect, activeSlugs }) {
  const cardRef = useRef(null);
  const videoRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = !!asset.playbackId;

  // Only create the HLS source URL when the card is visible (lazy load)
  const hlsSrc = isVideo && isVisible
    ? `https://stream.mux.com/${asset.playbackId}.m3u8`
    : null;

  // Attach HLS stream — only when hlsSrc is set (i.e. card is visible)
  useHls(videoRef, hlsSrc, GRID_HLS_CONFIG);

  /**
   * Aspect ratio via the shared detail-page cascade (ratioOf):
   *   mediaType map → Mux data → Sanity image dims → title hint → 16:9
   */
  const ratio = useMemo(
    () => ratioOf(asset),
    [asset.mediaType, asset.videoAspectRatio, asset.imageDimensions, asset.title]
  );

  /**
   * Grid span classes based on aspect ratio.
   */
  const getCellClass = () => {
    if (ratio >= 1.6) return 'media-grid__cell--wide';
    if (ratio <= 0.7) return 'media-grid__cell--tall';
    return '';
  };

  const imageWidth = ratio >= 1.6 ? IMG_WIDTH_WIDE : IMG_WIDTH_STANDARD;

  /** Mux thumbnail for poster / fallback */
  const posterUrl = isVideo
    ? `https://image.mux.com/${asset.playbackId}/thumbnail.webp?width=${imageWidth}&fit_mode=preserve`
    : null;

  /**
   * IntersectionObserver: toggle visibility state.
   * When card enters viewport → enable HLS + play.
   * When card leaves → pause + tear down HLS (via hlsSrc going null).
   */
  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);

        // Pause video when off-screen to save resources
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  /**
   * 4-second loop cap: when the video reaches PREVIEW_SECONDS,
   * seek back to 0 for a seamless short loop.
   */
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video && video.currentTime >= PREVIEW_SECONDS) {
      video.currentTime = 0;
    }
  }, []);

  const cardStyle = {
    aspectRatio: `${ratio}`,
  };

  /**
   * Dynamic metadata: hide redundant info based on active filters.
   */
  const hasActiveFilter = activeSlugs && activeSlugs.size > 0;
  const visibleServices = useMemo(() => {
    if (!asset.services?.length) return [];
    if (!hasActiveFilter) return asset.services;
    return asset.services.filter((s) => !activeSlugs.has(s.slug));
  }, [asset.services, activeSlugs, hasActiveFilter]);

  return (
    <div
      ref={cardRef}
      className={`media-card ${getCellClass()}`}
      style={cardStyle}
      onClick={() => onSelect(asset)}
      role="button"
      tabIndex={0}
      aria-label={`${asset.clientName} — ${asset.title}`}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          className={`media-card__media${isLoaded ? ' media-card__media--loaded' : ''}`}
          poster={posterUrl}
          muted
          autoPlay
          loop
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onCanPlay={() => setIsLoaded(true)}
        />
      ) : asset.imageUrl ? (
        <img
          className={`media-card__media${isLoaded ? ' media-card__media--loaded' : ''}`}
          src={`${asset.imageUrl}?w=${imageWidth}&${IMG_FORMAT}`}
          alt={asset.title || ''}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <div className="media-card__media" aria-hidden="true" />
      )}

      {/* Duotone overlay — fades in on hover via CSS opacity */}
      <div className="media-card__overlay">
        <span className="media-card__client">{asset.clientName}</span>
        {asset.title && (
          <span className="media-card__title">{asset.title}</span>
        )}
        {visibleServices.length > 0 && (
          <div className="media-card__services">
            {visibleServices.map((s) => (
              <span key={s.slug} className="stag media-card__service-pill">
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
