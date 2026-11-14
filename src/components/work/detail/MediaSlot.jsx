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
 * it, or at a shorter asset's own end; wrapAt(clip) loops at the cap,
 * and `loop` at a shorter clip's end. A video's face is its poster <img>
 * (11-12): the <video> sits over it and fades in once it can play, so a
 * tile is never empty while its stream starts. HLS attaches once the slot
 * has stayed near the viewport for the directory's dwell (a fling past asks
 * Mux for nothing) and is torn down off-screen, where the poster is the face
 * again. Images load from the Sanity CDN. Both fade in via the shared
 * load-gate pattern. An image that finished before hydration is flagged as
 * its element attaches, since its onLoad never fires. The hero (`eager`)
 * loads its image or poster eagerly, at high priority.
 *
 * A chunk (11-05: asset.chunk, from expandChunks when the video is flagged
 * `splitIntoThirds`) is one third of such a video: the stream is clipped at
 * both ends (muxStream start + end), plays its WHOLE range (no DETAIL_MAX_SECONDS
 * cap), starts and wraps at windowLoop's from/to on the stream's own timeline
 * (Mux begins a clip on the segment boundary before its start), and its
 * poster is the frame at its own start.
 *
 * Accessibility: the figure is named by the title; the media itself by
 * `alt` (title fallback for images); `description` rides along as a
 * screen-reader-only figcaption — never shown on the page.
 * A sequence (asset.frames, src/lib/mediaSequence.js) stacks its frames and
 * hard-cuts between them on the shared clock while the slot is near the
 * viewport: an opaque frame fills the slot (cover), a transparent one shows
 * whole on the slot's near-black (contain). A directory sequence may hold
 * animated flyers (a frame with a playbackId): each holds the tile for its
 * clip (frameBeats), shows its frame-0 poster until it plays, and plays
 * through in a GatedVideo under the one grant the gate gives the tile. The
 * NEXT animated frame mounts a beat early, parked (GatedVideo `hold`), so it
 * is buffered at its cut: at most two players per tile, one of them playing.
 * With no grant the tile steps every frame a beat at a time, posters for the
 * animated ones.
 *
 * Directory mode (11-03: DirectoryGrid passes `gate`): the slot has no
 * observer of its own — one playerGate (directory/playerGate.js) watches
 * every tile. A video shows a lazy poster <img> always and mounts its
 * <video> (GatedVideo) only while the gate grants it play; a sequence cuts
 * only while the tile is in view. A chunk tile (a splitIntoThirds video's
 * third) posts its own first frame and plays `clip` seconds from there
 * (GatedVideo `chunk`). `clip` (PREVIEW_SECONDS there) bounds the
 * stream and the loop, `sizes` adds srcsets, and `fit` is written as
 * data-fit (contain letterboxes on near-black). A tile whose media unmounts
 * (its chunk left DirectoryGrid's mount window) drops the images it is still
 * fetching (11-12), so a fast scroll leaves no queue of downloads ahead of
 * the tiles it stops on. The detail page passes none of these props.
 *
 * @param {Object} props
 * @param {Object}  props.asset - mediaAsset doc from FEATURED_PROJECT_DETAIL_QUERY, or a directory tile
 * @param {boolean} [props.eager=false] - Seed visibility at hydration (hero slot)
 * @param {number}  [props.clip=DETAIL_MAX_SECONDS] - The stream's clip and the loop's wrap, in seconds
 * @param {string}  [props.sizes] - The <img sizes>; with it, images and posters get srcsets
 * @param {Object}  [props.gate] - A playerGate: directory mode
 * @param {'cover'|'contain'} [props.fit] - How the face fills the tile (data-fit)
 * @param {{ratio: number, box: Object, img?: Object}} [props.logo] - a logo's layout on the detail
 *        grid (detailLogo, directory/logoTile.js): the canvas it was given and where its picture sits
 *        in it, in percent of the canvas. `img` places the original by its ink; without it the
 *        picture is `contain`ed in `box`. The slot then draws a logo canvas, not a filled face.
 */
import { useRef, useEffect, useState, useMemo, useCallback, Fragment } from 'react';
import useHls from '../useHls.js';
import {
  IMG_FORMAT,
  DETAIL_MAX_SECONDS,
  DIRECTORY_DWELL_MS,
  muxStream,
  muxPoster,
  muxPosterSrcSet,
  sanitySrcSet,
  windowLoop,
  wrapAt,
} from '../imageConfig.js';
import { ratioOf, PORTRAIT_THRESHOLD } from './buildContentFlow.js';
import GatedVideo, { DETAIL_HLS_CONFIG } from './GatedVideo.jsx';
import { frameBeats, weightedFrame, msToNextFrame, sequenceIntervalMs } from '../../../lib/mediaSequence.js';

/** Sanity image width for detail page slots */
const SLOT_IMG_WIDTH = 1400;

/** A logo placed by its ink is drawn larger than its ink (the file's margins
    hang off the canvas), so it asks for more pixels. */
const LOGO_IMG_WIDTH = 2000;

/** IO pre-load band — vertical-only; horizontal margin is inert on a
    vertical page. Wide enough that scrolled-to slots already stream. */
const IO_MARGIN = '400px 0px';

/** The frame a sequence shows, re-timed to each beat of the shared clock
    while `active` (frame 0 at SSR and while parked off-screen), and `ahead`:
    the animated frame that takes over at the next cut (-1 if none), which is
    mounted a beat early. An animated frame holds the tile for its clip while
    `play` (the gate's grant); without it every frame is one beat. Each slot
    keeps its own timer, but every timer lands on the same wall-clock boundary,
    so slots never drift apart. */
function useSequenceFrame(frames, active, play, clip) {
  const n = frames?.length ?? 0;
  const [at, setAt] = useState({ frame: 0, ahead: -1 });
  useEffect(() => {
    if (!active || n < 2) return undefined;
    let id;
    const tick = () => {
      const beats = frames.map((f) => (play ? frameBeats(f, clip) : 1));
      const now = performance.now();
      const frame = weightedFrame(beats, now);
      const next = weightedFrame(beats, now + sequenceIntervalMs());
      const ahead = next !== frame && frames[next].playbackId ? next : -1;
      setAt((was) => (was.frame === frame && was.ahead === ahead ? was : { frame, ahead }));
      id = setTimeout(tick, msToNextFrame() + 1);
    };
    tick();
    return () => clearTimeout(id);
  }, [frames, n, active, play, clip]);
  return at;
}

export default function MediaSlot({
  asset,
  style,
  eager = false,
  clip = DETAIL_MAX_SECONDS,
  sizes,
  gate,
  fit,
  logo,
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
  const [isPlayable, setIsPlayable] = useState(false); // the detail <video> has reached canplay
  const frames = asset.frames?.length > 1 ? asset.frames : null;
  // A sequence led by an animated flyer carries its playbackId; the frames own the players.
  const isVideo = !!asset.playbackId && !frames;
  const hasMotion = !!frames?.some((f) => f.playbackId);
  const { frame, ahead } = useSequenceFrame(frames, isVisible, canPlay && hasMotion, clip);

  // A chunk (expandChunks) plays its own range of the asset: the stream is
  // clipped at both ends, it starts at `from` on the stream's own timeline
  // and wraps at `to`, whole, whatever `clip` says. In directory mode (a third
  // is its own tile, buildDirectoryTiles) GatedVideo plays only `clip` seconds
  // of it, from its start, and the poster is still its own first frame.
  const chunk = asset.chunk;
  const chunkLoop = useMemo(() => (chunk ? windowLoop(chunk.from, chunk.to) : null), [chunk]);

  // Directory mode streams through GatedVideo instead.
  const hlsSrc = isVideo && isVisible && !gate
    ? muxStream(asset.playbackId, chunk ? chunk.end : clip, '', chunk ? chunk.start : 0)
    : null;

  useHls(
    videoRef,
    hlsSrc,
    chunk && chunk.from > 0 ? { ...DETAIL_HLS_CONFIG, startPosition: chunk.from } : DETAIL_HLS_CONFIG,
    { videoOnly: true }
  );
  const wrap = useMemo(() => wrapAt(clip), [clip]);

  // time=0: playback starts at frame 0 and every wrap returns there (the
  // native loop, or the cap's seek), so the frame-0 poster is the aligned
  // one — no poster→playback jump. A chunk's poster is its own first frame.
  const posterUrl = isVideo ? muxPoster(asset.playbackId, SLOT_IMG_WIDTH, chunk ? chunk.start : 0) : null;

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
      return gate.watch(el, { video: isVideo || hasMotion }, ({ near, play }) => {
        setIsVisible(near);
        setCanPlay(play);
      });
    }

    // The slot counts as visible only once it has stayed in the band for the
    // dwell, so a fling past never asks Mux for a master (the directory's
    // rule, playerGate.js). Its poster is its face meanwhile.
    let dwell = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        clearTimeout(dwell);
        if (entry.isIntersecting) {
          dwell = setTimeout(() => setIsVisible(true), DIRECTORY_DWELL_MS);
        } else {
          // The stream is torn down out of the band: the poster is the face
          // again until the next attach can play.
          setIsVisible(false);
          setIsPlayable(false);
          videoRef.current?.pause();
        }
      },
      { rootMargin: IO_MARGIN, threshold: 0.05 }
    );

    observer.observe(el);
    return () => {
      clearTimeout(dwell);
      observer.disconnect();
    };
  }, [gate]);

  // Directory mode: a tile whose media unmounts (its chunk left the mount
  // window) drops the images it is still fetching. The browser would finish
  // them otherwise, ahead of the tiles now in view.
  const gated = useRef(false);
  gated.current = !!gate;
  useEffect(() => {
    const el = slotRef.current;
    return () => {
      if (!gated.current) return;
      for (const img of el.querySelectorAll('img')) {
        if (img.complete) continue;
        img.removeAttribute('srcset');
        img.removeAttribute('src');
      }
    };
  }, []);

  return (
    <figure
      ref={slotRef}
      className="media-slot"
      data-portrait={isPortrait || undefined}
      data-fit={fit}
      style={{ '--slot-ratio': ratio, ...style }}
      aria-label={asset.title ? `${asset.title}${asset.chunk ? ` (part ${asset.chunk.index + 1} of ${asset.chunk.count})` : ''}` : undefined}
      {...rest}
    >
      {frames ? (
        <div
          className={`media-slot__media media-slot__sequence${isLoaded ? ' media-slot__media--loaded' : ''}`}
        >
          {frames.map((f, k) => (
            <Fragment key={f._id}>
              <img
                ref={k === 0 ? flagIfLoaded : undefined}
                className="media-slot__frame"
                data-fit={f.imageHasAlpha ? 'contain' : undefined}
                data-on={k === frame || undefined}
                src={f.playbackId ? muxPoster(f.playbackId, SLOT_IMG_WIDTH, 0) : `${f.imageUrl}?w=${SLOT_IMG_WIDTH}&${IMG_FORMAT}`}
                srcSet={
                  !sizes ? undefined : f.playbackId ? muxPosterSrcSet(f.playbackId) : sanitySrcSet(f.imageUrl, f.imageDimensions?.width)
                }
                sizes={sizes}
                alt={f.alt || f.title || ''}
                loading="lazy"
                decoding={gate ? 'async' : undefined}
                onLoad={k === 0 ? () => setIsLoaded(true) : undefined}
              />
              {/* An animated frame's player: the current one, and the next one parked a beat early. */}
              {canPlay && f.playbackId && (k === frame || k === ahead) && (
                <div style={{ position: 'absolute', inset: 0, visibility: k === frame ? 'visible' : 'hidden' }}>
                  <GatedVideo playbackId={f.playbackId} clip={clip} hold={k !== frame} />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      ) : isVideo ? (
        <>
          {/* The poster is the tile's face from the moment it loads; the player
              sits over it and fades in once it can play. On the detail page the
              <video> names the media, so its poster is decorative there. */}
          <img
            ref={flagIfLoaded}
            className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
            src={posterUrl}
            srcSet={sizes ? muxPosterSrcSet(asset.playbackId) : undefined}
            sizes={sizes}
            alt={gate ? asset.alt || asset.title || '' : ''}
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager ? 'high' : undefined}
            decoding="async"
            onLoad={() => setIsLoaded(true)}
          />
          {gate ? (
            canPlay && <GatedVideo playbackId={asset.playbackId} clip={clip} chunk={chunk} />
          ) : (
            <video
              ref={videoRef}
              className={`media-slot__media media-slot__player${isPlayable ? ' media-slot__media--loaded' : ''}`}
              muted
              autoPlay
              loop={!chunk}
              playsInline
              aria-label={asset.alt || undefined}
              onTimeUpdate={chunkLoop ? chunkLoop.onTimeUpdate : wrap}
              onLoadedMetadata={chunkLoop?.onLoadedMetadata}
              onEnded={chunkLoop?.onEnded}
              onCanPlay={() => setIsPlayable(true)}
            />
          )}
        </>
      ) : asset.imageUrl && logo ? (
        <span className="logo-canvas" style={{ aspectRatio: logo.ratio }}>
          <img
            ref={flagIfLoaded}
            className={`logo-mark${isLoaded ? ' logo-mark--loaded' : ''}`}
            src={`${asset.imageUrl}?w=${LOGO_IMG_WIDTH}&${IMG_FORMAT}`}
            alt={asset.alt || asset.title || ''}
            loading="lazy"
            onLoad={() => setIsLoaded(true)}
            style={{
              left: `${(logo.img ?? logo.box).left}%`,
              top: `${(logo.img ?? logo.box).top}%`,
              width: `${(logo.img ?? logo.box).width}%`,
              height: `${(logo.img ?? logo.box).height}%`,
            }}
          />
        </span>
      ) : asset.imageUrl ? (
        <img
          ref={flagIfLoaded}
          className={`media-slot__media${isLoaded ? ' media-slot__media--loaded' : ''}`}
          src={`${asset.imageUrl}?w=${SLOT_IMG_WIDTH}&${IMG_FORMAT}`}
          srcSet={sizes ? sanitySrcSet(asset.imageUrl, asset.imageDimensions?.width) : undefined}
          sizes={sizes}
          alt={asset.alt || asset.title || ''}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
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
