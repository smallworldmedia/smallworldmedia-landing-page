/**
 * VideoSlotPool — Fixed pool of hidden HLS <video> elements feeding
 * THREE.VideoTexture panels on the globe.
 *
 * The pool size is the hard decode budget (MAX_LIVE). Slots are reassigned
 * as the scheduler migrates "live" status between panels; reassigning a
 * slot's src triggers useHls's built-in teardown/reattach.
 *
 * Two MediaCard preview strategies carry over:
 *  - Abbreviated loop: every slot streams the shared preview window,
 *    GLOBE_PREVIEW_SECONDS, clipped at the source (muxStream, Mux instant
 *    clipping), and loops it from buffer (near-zero ongoing delivery per
 *    panel). `loop` wraps at the clip's end; timeupdate seeks back to 0 at
 *    the window for a clip Mux ends on a later segment boundary.
 *  - No-abrupt-start gate: assign() resolves only after the `playing` event
 *    AND the first presented frame (requestVideoFrameCallback, falling back
 *    to the first timeupdate) — the crossfade never reveals a stalled frame.
 *
 * Videos are hidden via offscreen near-invisible positioning, NOT
 * display:none (Safari throttles decoding of display:none videos).
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  createRef,
} from 'react';
import useHls from '../work/useHls.js';
import { muxStream } from '../work/imageConfig.js';
import { MAX_LIVE, GLOBE_PREVIEW_SECONDS, STREAM_PARAMS } from './globeConfig.js';

/** hls.js config for pool slots — locked rendition. maxBufferLength is a
 *  FLOOR, not a cap: hls.js aims its forward buffer at 8 × maxBufferSize ÷
 *  bitrate seconds (up to maxMaxBufferLength), which at these bitrates runs
 *  past the end of most assets. The stream clip (streamUrl) is what bounds
 *  the download. */
const POOL_HLS_CONFIG = {
  maxBufferLength: 10, // the floor: ≥ GLOBE_PREVIEW_SECONDS, so the whole loop stays buffered
  startFragPrefetch: true, // fetch the first fragment alongside manifest parsing
};

function streamUrl(playbackId, params) {
  // `params` pins ONE rendition server-side (min = max): the globe's
  // STREAM_PARAMS, or the World Near tier's hi-res pin. preferMinQuality locks
  // the lowest remaining level, so the two always agree. The clip goes last,
  // once, after whatever params the caller passed (muxStream): Mux ends the
  // stream on the first segment boundary at or after the preview window, so
  // a slot fetches nothing past the segment its loop point falls in.
  return muxStream(playbackId, GLOBE_PREVIEW_SECONDS, params);
}

function PoolSlot({ videoRef, src, slotIndex, onFirstFrame }) {
  useHls(videoRef, src, POOL_HLS_CONFIG, { preferMinQuality: true });

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime >= GLOBE_PREVIEW_SECONDS) {
      video.currentTime = 0; // loop at the window: Mux may end the clip on a later segment boundary
    }
    onFirstFrame(slotIndex, 'timeupdate');
  }, [videoRef, slotIndex, onFirstFrame]);

  const handlePlaying = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(() => onFirstFrame(slotIndex, 'rvfc'));
    }
    // No rVFC → the timeupdate handler above acts as the fallback gate
  }, [videoRef, slotIndex, onFirstFrame]);

  return (
    <video
      ref={videoRef}
      muted
      autoPlay
      playsInline
      loop
      crossOrigin="anonymous"
      onPlaying={handlePlaying}
      onTimeUpdate={handleTimeUpdate}
    />
  );
}

// `size` fixes the slot count at mount (the decode budget) and `streamParams`
// shapes the Mux manifests; both default to the globe's values. The World
// mounts a smaller, higher-resolution pool for its Near tier.
const VideoSlotPool = forwardRef(function VideoSlotPool(
  { size = MAX_LIVE, streamParams = STREAM_PARAMS },
  ref
) {
  const videoRefs = useRef(
    Array.from({ length: size }, () => createRef())
  );
  const [srcs, setSrcs] = useState(() => Array(size).fill(null));
  // Ref mirrors so the imperative handle stays identity-stable
  const srcsRef = useRef(Array(size).fill(null));
  const streamParamsRef = useRef(streamParams);
  streamParamsRef.current = streamParams;
  // Per-slot waiter: { resolve, reject } for the in-flight assign()
  const waitersRef = useRef(Array(size).fill(null));

  const onFirstFrame = useCallback((slot, _via) => {
    const waiter = waitersRef.current[slot];
    if (!waiter) return;
    const video = videoRefs.current[slot].current;
    if (!video || video.readyState < 2 || video.paused) return;
    waitersRef.current[slot] = null;
    waiter.resolve(video);
  }, []);

  useImperativeHandle(ref, () => ({
    /**
     * Point a slot at a playback ID. Resolves with the <video> element once
     * frames are actually presenting (the no-abrupt-start gate).
     */
    assign(slot, playbackId) {
      return new Promise((resolve, reject) => {
        const prev = waitersRef.current[slot];
        if (prev) prev.reject(new Error('slot reassigned'));
        waitersRef.current[slot] = { resolve, reject };
        srcsRef.current[slot] = streamUrl(playbackId, streamParamsRef.current);
        const el = videoRefs.current[slot].current;
        if (el) el.dataset.playbackId = playbackId; // debug traceability
        setSrcs([...srcsRef.current]);
      });
    },

    releaseSlot(slot) {
      const prev = waitersRef.current[slot];
      if (prev) prev.reject(new Error('slot released'));
      waitersRef.current[slot] = null;
      srcsRef.current[slot] = null;
      setSrcs([...srcsRef.current]);
    },

    pauseAll() {
      videoRefs.current.forEach((r) => r.current?.pause());
    },

    resumeAll() {
      videoRefs.current.forEach((r, i) => {
        if (srcsRef.current[i]) r.current?.play().catch(() => {});
      });
    },
  }), []);

  return (
    <div className="video-globe-pool" aria-hidden="true">
      {videoRefs.current.map((videoRef, i) => (
        <PoolSlot
          key={i}
          slotIndex={i}
          videoRef={videoRef}
          src={srcs[i]}
          onFirstFrame={onFirstFrame}
        />
      ))}
    </div>
  );
});

export default VideoSlotPool;
