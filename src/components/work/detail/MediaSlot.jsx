/**
 * MediaSlot — A single media container on the Featured Project page, and a
 * tile's face in the Project Directory.
 *
 * Renders as a masonry grid child — each slot sizes itself via
 * aspect-ratio from the asset's native dimensions. Portrait assets
 * are clamped to a 3:4 minimum container with object-fit: cover.
 *
 * Each video streams a clip of DETAIL_MAX_SECONDS (Nathan, 10-09: the
 * page's hard cut on long assets), cut at the source (muxStream, Mux
 * instant clipping) and ending on the first segment boundary at or after
 * it, or at a shorter asset's own end; wrapAtDetailCap loops at the cap,
 * and `loop` at a shorter clip's end. HLS attaches lazily when the slot
 * enters the viewport; playback pauses off-screen. Images load from the
 * Sanity CDN. Both fade in via the shared load-gate pattern. An image that
 * finished before hydration is flagged as its element attaches, since its
 * onLoad never fires.
 *
 * Accessibility: the figure is named by the title; the media itself by
 * `alt` (title fallback for images); `description` rides along as a
 * screen-reader-only figcaption — never shown on the page.
 * A sequence (asset.frames, src/lib/mediaSequence.js) stacks its frames and
 * hard-cuts between them on the shared clock while the slot is near the
 * viewport: an opaque frame fills the slot (cover), a transparent one shows
 * whole on the slot's near-black (contain).
 *
 * Directory mode (11-03: DirectoryGrid passes `gate`): the slot has no
 * observer of its own — one playerGate (directory/playerGate.js) watches
 * every tile. A video shows a lazy poster <img> always and mounts its
 * <video> (GatedVideo) only while the gate grants it play; a sequence cuts
 * only while the tile is in view. `clip` (PREVIEW_SECONDS there) bounds the
 * stream and the loop, `sizes` adds srcsets, and `fit` is written as
 * data-fit (contain letterboxes on near-black). The detail page passes none
 * of these props and renders as before.
 *
 * @param {Object} props
 * @param {Object}  props.asset - mediaAsset doc from FEATURED_PROJECT_DETAIL_QUERY, or a directory tile
 * @param {boolean} [props.eager=false] - Seed visibility at hydration (hero slot)
 * @param {number}  [props.clip=DETAIL_MAX_SECONDS] - The stream's clip and the loop's wrap, in seconds
 * @param {string}  [props.sizes] - The <img sizes>; with it, images and posters get srcsets
 * @param {Object}  [props.gate] - A playerGate: directory mode
 * @param {'cover'|'contain'} [props.fit] - How the face fills the tile (data-fit)
 */
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import useHls from '../useHls.js';
import {
  IMG_FORMAT,
  DETAIL_MAX_SECONDS,
  muxStream,
  muxPoster,
  muxPosterSrcSet,
  sanitySrcSet,
  wrapAt,
  wrapAtDetailCap,
} from '../imageConfig.js';
import { ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import { sequenceFrame, msToNextFrame } from '../../../lib/mediaSequence.js';

/** Sanity image width for detail page slots */
const SLOT_IMG_WIDTH = 1400;

/** hls.js config for detail slots — prefetch the first fragment alongside
    manifest parsing, and start two rungs up the ladder (~720p on Mux's
    typical ladder) so the first painted frame is sharp; ABR adapts from
    there (capLevelToPlayerSize stays on inside useHls). maxBufferLength
    is a floor, not a cap: hls.js buffers further when the bitrate allows.
    The stream clip (DETAIL_MAX_SECONDS, muxStream) is what bounds each
    slot's download. */
const DETAIL_HLS_CONFIG = {
  startFragPrefetch: true,
  startLevel: 2,
  maxBufferLength: 12,
};

/** IO pre-load band — vertical-only; horizontal margin is inert on a
    vertical page. Wide enough that scrolled-to slots already stream. */
const IO_MARGIN = '400px 0px';

/** The frame a sequence of `n` shows, re-timed to each beat of the shared
    clock while `active` (frame 0 at SSR and while parked off-screen). Each
    slot keeps its own timer, but every timer lands on the same wall-clock
    boundary, so slots never drift apart. */
function useSequenceFrame(n, active) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active || n < 2) return undefined;
    let id;
    const tick = () => {
      setFrame(sequenceFrame(n));
      id = setTimeout(tick, msToNextFrame() + 1);
    };
    tick();
    return () => clearTimeout(id);
  }, [n, active]);
  return frame;
}

/** The directory's player, mounted only while the gate grants play. It sits
    over the poster and fades in once it can play. */
function GatedVideo({ playbackId, clip }) {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const wrap = useMemo(() => wrapAt(clip), [clip]);

  useHls(videoRef, muxStream(playbackId, clip), DETAIL_HLS_CONFIG, { videoOnly: true });

  // useHls's native path sets src and never detaches: empty the element as
  // it unmounts, or the detached <video> keeps fetching.
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      video.removeAttribute('src');
      video.load();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={`media-slot__media media-slot__player${isLoaded ? ' media-slot__media--loaded' : ''}`}
      muted
      autoPlay
      loop
      playsInline
      aria-hidden="true"
      onTimeUpdate={wrap}
      onCanPlay={() => setIsLoaded(true)}
    />
  );
}

export default function MediaSlot({
  asset,
  style,
  eager = false,
  clip = DETAIL_MAX_SECONDS,
  sizes,
  gate,
  fit,
  ...rest
}) {
  const slotRef = useRef(null);
  const videoRef = useRef(null);
  // Eager slots (the hero) seed visibility at hydration — rootMargin alone
  // still waits on the observer's first async callback; seeding starts the
  // manifest fetch immediately. The observer still governs afterwards.
  const [isVisible, setIsVisible] = useState(eager);
  const [canPlay, setCanPlay] = useState(false); // directory mode: the gate's grant
  const [isLoaded, setIsLoaded] = useState(false);
  const isVideo = !!asset.playbackId;
  const frames = asset.frames?.length > 1 ? asset.frames : null;
  const frame = useSequenceFrame(frames?.length ?? 0, isVisible);

  // Directory mode streams through GatedVideo instead.
  const hlsSrc = isVideo && isVisible && !gate
    ? muxStream(asset.playbackId, clip)
    : null;

  useHls(videoRef, hlsSrc, DETAIL_HLS_CONFIG, { videoOnly: true });

  // time=0: playback starts at frame 0 and every wrap returns there (the
  // native loop, or the cap's seek), so the frame-0 poster is the aligned
  // one — no poster→playback jump.
  const posterUrl = isVideo ? muxPoster(asset.playbackId, SLOT_IMG_WIDTH) : null;

  const ratio = ratioOf(asset);
  const isPortrait = ratio < PORTRAIT_THRESHOLD;

  // An SSR'd image that loaded before hydration never fires onLoad: Astro
  // hydrates in a transition, and React attaches the handler only at its
  // commit. Flag it as its element attaches.
  const flagIfLoaded = useCallback((img) => {
    if (img?.complete && img.naturalWidth > 0) setIsLoaded(true);
  }, []);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return undefined;

    // Directory mode: the one shared observer. A still has nothing to gate —
    // its lazy <img> loads itself.
    if (gate) {
      if (!isVideo && !frames) return undefined;
      return gate.watch(el, { video: isVideo }, ({ near, play }) => {
        setIsVisible(near);
        setCanPlay(play);
      });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        }
      },
      { rootMargin: IO_MARGIN, threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [gate]);

  return (
    <figure
      ref={slotRef}
      className="media-slot"
      data-portrait={isPortrait || undefined}
      data-fit={fit}
      style={{ '--slot-ratio': ratio, ...style }}
      aria-label={asset.title || undefined}
      {...rest}
    >
      {frames ? (
        <div
          className={`media-slot__media media-slot__sequence${isLoaded ? ' media-slot__media--loaded' : ''}`}
        >
          {frames.map((f, k) => (
            <img
              key={f._id}
              ref={k === 0 ? flagIfLoaded : undefined}
              className="media-slot__frame"
              data-fit={f.imageHasAlpha ? 'contain' : undefined}
              data-on={k === frame || undefined}
              src={`${f.imageUrl}?w=${SLOT_IMG_WIDTH}&${IMG_FORMAT}`}
              srcSet={sizes ? sanitySrcSet(f.imageUrl, f.imageDimensions?.width) : undefined}
              sizes={sizes}
              alt={f.alt || f.title || ''}
              loading="lazy"
              decoding={gate ? 'async' : undefined}
              onLoad={k === 0 ? () => setIsLoaded(true) : undefined}
            />
          ))}
        </div>
      ) : isVideo && gate ? (
        <>
          <img
            ref={flagIfLoaded}
            className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
            src={posterUrl}
            srcSet={sizes ? muxPosterSrcSet(asset.playbackId) : undefined}
            sizes={sizes}
            alt={asset.alt || asset.title || ''}
            loading="lazy"
            decoding="async"
            onLoad={() => setIsLoaded(true)}
          />
          {canPlay && <GatedVideo playbackId={asset.playbackId} clip={clip} />}
        </>
      ) : isVideo ? (
        <video
          ref={videoRef}
          className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
          poster={posterUrl}
          muted
          autoPlay
          loop
          playsInline
          aria-label={asset.alt || undefined}
          onTimeUpdate={wrapAtDetailCap}
          onCanPlay={() => setIsLoaded(true)}
        />
      ) : asset.imageUrl ? (
        <img
          ref={flagIfLoaded}
          className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
          src={`${asset.imageUrl}?w=${SLOT_IMG_WIDTH}&${IMG_FORMAT}`}
          srcSet={sizes ? sanitySrcSet(asset.imageUrl, asset.imageDimensions?.width) : undefined}
          sizes={sizes}
          alt={asset.alt || asset.title || ''}
          loading="lazy"
          decoding={gate ? 'async' : undefined}
          onLoad={() => setIsLoaded(true)}
        />
      ) : (
        <div className="media-slot__media" aria-hidden="true" />
      )}
      {asset.description && <figcaption className="sr-only">{asset.description}</figcaption>}
    </figure>
  );
}
