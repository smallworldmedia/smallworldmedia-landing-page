/**
 * WorldScene — the WebGL canvas for the active Featured Project World.
 *
 * A single fixed, full-viewport canvas behind the scrolling identity cards;
 * its Tiles swap as the active project changes. See useWorldScene for the
 * three.js lifecycle.
 *
 * Owns the live tier's VideoSlotPool (hidden HLS <video> elements, globe
 * reuse): WORLD_MAX_LIVE slots is the hard decode budget for the Near tier.
 * Reduced motion mounts no pool — stills only, matching the globe.
 *
 * @param {Object} props
 * @param {Object|null} props.world - the active World
 * @param {number} props.index - the active World's index (drives Turn direction)
 */
import { useEffect, useRef, useState } from 'react';
import useWorldScene from './useWorldScene.js';
import VideoSlotPool from '../../globe/VideoSlotPool.jsx';
import {
  WORLD_MAX_LIVE,
  WORLD_STREAM_PARAMS,
  PREFERS_REDUCED_MOTION,
  FP_FADE,
  FP_FADE_H,
} from './worldConfig.js';

export default function WorldScene({ world, index = 0 }) {
  const ref = useRef(null);
  const poolRef = useRef(null);
  useWorldScene(ref, world, index, poolRef);
  // The pool mounts on a post-hydration pass: its presence and size depend on
  // reduced-motion / viewport, which the SSR HTML can't know — rendering it
  // during hydration mismatches. The scheduler reads poolRef lazily, so the
  // one-render delay just means the first promote waits a scheduler beat.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return (
    <>
      <div
        ref={ref}
        className="fp-canvas"
        aria-hidden="true"
        /* 08-25: bottom-fade dials (?fpfade ?fpfadeh) — consumed by the
           .fp-canvas gradient in featured-projects.css */
        style={{ '--fp-fade': FP_FADE, '--fp-fade-h': `${FP_FADE_H}%` }}
      />
      {hydrated && WORLD_MAX_LIVE > 0 && !PREFERS_REDUCED_MOTION && (
        <VideoSlotPool
          ref={poolRef}
          size={WORLD_MAX_LIVE}
          streamParams={WORLD_STREAM_PARAMS}
        />
      )}
    </>
  );
}
