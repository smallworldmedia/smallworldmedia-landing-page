/**
 * Lightbox — Full-screen overlay for detailed asset viewing.
 *
 * Video mode: HLS stream at full quality with sound (browser default).
 * Shows poster thumbnail immediately while the video buffers.
 * Image mode: full-resolution Sanity image.
 * Closes on Escape key, close button, or backdrop click.
 *
 * @param {Object} props
 * @param {Object|null} props.asset - The selected asset, or null to hide
 * @param {() => void} props.onClose - Close handler
 */
import { useEffect, useCallback, useRef } from 'react';
import useHls from './useHls.js';

export default function Lightbox({ asset, onClose }) {
  const videoRef = useRef(null);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!asset) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [asset, handleKeyDown]);

  // HLS source — only set when lightbox has a video asset
  const hlsSrc = asset?.playbackId
    ? `https://stream.mux.com/${asset.playbackId}.m3u8`
    : null;

  // Full quality — force highest available rendition
  useHls(videoRef, hlsSrc, {}, { preferMaxQuality: true });

  if (!asset) return null;

  const isVideo = !!asset.playbackId;

  // Poster for immediate visual feedback while video buffers
  const posterUrl = isVideo
    ? `https://image.mux.com/${asset.playbackId}/thumbnail.webp?width=1920&fit_mode=preserve`
    : null;

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button
        className="lightbox__close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close lightbox"
      >
        ✕
      </button>

      <div onClick={(e) => e.stopPropagation()}>
        {isVideo ? (
          <video
            ref={videoRef}
            className="lightbox__video"
            poster={posterUrl}
            controls
            playsInline
          />
        ) : asset.imageUrl ? (
          <img
            className="lightbox__media"
            src={`${asset.imageUrl}?w=1920&auto=format`}
            alt={asset.title || ''}
          />
        ) : null}
      </div>

      <div className="lightbox__meta">
        <div className="lightbox__client">{asset.clientName}</div>
        {asset.title && <div className="lightbox__title">{asset.title}</div>}
      </div>
    </div>
  );
}
