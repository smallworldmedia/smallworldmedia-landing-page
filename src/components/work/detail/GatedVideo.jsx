/**
 * GatedVideo — a player that exists only while a playerGate
 * (directory/playerGate.js) grants it play. It sits over its poster and fades
 * in once it can play. Mount a FRESH element per video (key it by playbackId):
 * a reused <video> keeps playing its old stream until React commits the new
 * src.
 *
 * Used by MediaSlot's directory mode and by the project page's admat wall
 * (DeckScroller `gate`).
 *
 * @param {Object} props
 * @param {string} props.playbackId
 * @param {number} props.clip - the stream's clip and the loop's wrap, in seconds
 */
import { useRef, useEffect, useState, useMemo } from 'react';
import useHls from '../useHls.js';
import { muxStream, wrapAt } from '../imageConfig.js';

/** hls.js config for detail slots — prefetch the first fragment alongside
    manifest parsing, and start two rungs up the ladder (~720p on Mux's
    typical ladder) so the first painted frame is sharp; ABR adapts from
    there (capLevelToPlayerSize stays on inside useHls). maxBufferLength
    is a floor, not a cap: hls.js buffers further when the bitrate allows.
    The stream clip (DETAIL_MAX_SECONDS, muxStream) is what bounds each
    slot's download. */
export const DETAIL_HLS_CONFIG = {
  startFragPrefetch: true,
  startLevel: 2,
  maxBufferLength: 12,
};

export default function GatedVideo({ playbackId, clip }) {
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
