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
 * `hold` parks it: the stream loads and buffers, but the video stays paused
 * on its first frame until `hold` turns false (a directory sequence mounts the
 * next animated flyer a beat early, so it is already buffered at its cut).
 *
 * @param {Object} props
 * @param {string} props.playbackId
 * @param {number} props.clip - the stream's clip and the loop's wrap, in seconds
 * @param {boolean} [props.hold=false] - stay paused while true
 * @param {Object} [props.chunk] - one third of a split video (expandChunks): the
 *   player streams the `clip` seconds from the chunk's own start (cut short at
 *   its end, chunkPreview), starts there and loops inside that window
 *   (windowLoop). Without it the player is the whole-asset loop from 0.
 */
import { useRef, useEffect, useState, useMemo } from 'react';
import useHls from '../useHls.js';
import { muxStream, wrapAt, chunkPreview, windowLoop } from '../imageConfig.js';

/** hls.js config for detail slots — prefetch the first fragment alongside
    manifest parsing, and start two rungs up the ladder (~720p on Mux's
    typical ladder) so the first painted frame is sharp; ABR adapts from
    there (capLevelToPlayerSize stays on inside useHls). maxBufferLength
    is a floor, not a cap: hls.js buffers to 8 × maxBufferSize ÷ bitrate
    when that is longer, which at these bitrates is the whole clip, fetched
    the moment the slot attaches. maxMaxBufferLength is the cap: just under
    one segment (MUX_SEGMENT_SECONDS), so a slot fetches one segment to
    start and the next ones as it plays into them, and a slot scrolled past
    costs one segment, not the clip. The stream clip (DETAIL_MAX_SECONDS,
    muxStream) still bounds each slot's total. */
export const DETAIL_HLS_CONFIG = {
  startFragPrefetch: true,
  startLevel: 2,
  maxBufferLength: 4,
  maxMaxBufferLength: 4,
};

export default function GatedVideo({ playbackId, clip, hold = false, chunk }) {
  const videoRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const wrap = useMemo(() => wrapAt(clip), [clip]);
  // A chunk loops its own window, on the clipped stream's timeline; `from` is
  // where playback starts on it (0 for a whole-asset loop).
  const win = useMemo(() => (chunk ? chunkPreview(chunk, clip) : null), [chunk, clip]);
  const chunkLoop = useMemo(() => (win ? windowLoop(chunk.from, win.to) : null), [win, chunk]);
  const from = chunk ? chunk.from : 0;
  const held = useRef(hold);
  const wasHeld = useRef(hold);
  held.current = hold;

  useHls(
    videoRef,
    win ? muxStream(playbackId, win.end, '', chunk.start) : muxStream(playbackId, clip),
    from > 0 ? { ...DETAIL_HLS_CONFIG, startPosition: from } : DETAIL_HLS_CONFIG,
    { videoOnly: true }
  );

  // useHls starts playback itself once the manifest parses, so a held video is
  // stopped as it starts (onPlay below) and set going when the hold lifts. A
  // video that is put back on hold (its tile cut away from it, the next cut
  // being its own again) goes back to its first frame.
  useEffect(() => {
    const video = videoRef.current;
    if (hold) {
      wasHeld.current = true;
      video.pause();
      video.currentTime = from;
    } else if (wasHeld.current) {
      video.play().catch(() => {});
    }
  }, [hold]);

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
      autoPlay={!hold}
      loop={!chunkLoop}
      playsInline
      aria-hidden="true"
      onPlay={() => held.current && videoRef.current.pause()}
      onTimeUpdate={chunkLoop ? chunkLoop.onTimeUpdate : wrap}
      onLoadedMetadata={chunkLoop?.onLoadedMetadata}
      onEnded={chunkLoop?.onEnded}
      onCanPlay={() => setIsLoaded(true)}
    />
  );
}
