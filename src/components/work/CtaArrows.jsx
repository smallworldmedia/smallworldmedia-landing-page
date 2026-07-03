/**
 * CtaArrows — the looping feathered caret strip of the CTA chip family
 * ([NEXT]/[PREVIOUS] on /work, [SCROLL_TO_ENTER] on the home hero).
 *
 * A tall track of identical thin chevrons (1.5px SVG strokes — the text
 * glyph read too heavy) translating at a constant rate, clipped to the
 * container window and feathered to 0% opacity only on the side nearest
 * the label; carets stay fully visible all the way to the far edge.
 * `direction`: 'down' (NEXT / enter) or 'up' (PREVIOUS).
 *
 * ?caret=<seconds> tunes the drift (seconds per slot); reduced motion
 * renders the strip static.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PREFERS_REDUCED_MOTION } from './world/worldConfig.js';

// Seconds for one caret to travel one slot — higher = slower drift.
const ARROW_LOOP_SECONDS = (() => {
  if (typeof window === 'undefined') return 6;
  const n = parseFloat(new URLSearchParams(window.location.search).get('caret'));
  return Number.isFinite(n) ? n : 6;
})();

function Chevron({ direction }) {
  const points = direction === 'down' ? '2,3.5 12,8.5 22,3.5' : '2,8.5 12,3.5 22,8.5';
  return (
    <svg viewBox="0 0 24 12" width="22" height="12">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

export default function CtaArrows({ direction }) {
  const trackRef = useRef(null);
  useEffect(() => {
    const track = trackRef.current;
    if (!track || PREFERS_REDUCED_MOTION) return undefined;
    // 16 identical carets; translating by half the track (8 carets) loops seamlessly.
    const tween =
      direction === 'down'
        ? gsap.fromTo(track, { yPercent: -50 }, { yPercent: 0, duration: ARROW_LOOP_SECONDS, ease: 'none', repeat: -1 })
        : gsap.fromTo(track, { yPercent: 0 }, { yPercent: -50, duration: ARROW_LOOP_SECONDS, ease: 'none', repeat: -1 });
    return () => tween.kill();
  }, [direction]);

  return (
    <span className={`fp-cta__arrows fp-cta__arrows--${direction}`} aria-hidden="true">
      <span className="fp-cta__arrows-track" ref={trackRef}>
        {Array.from({ length: 16 }, (_, i) => (
          <Chevron key={i} direction={direction} />
        ))}
      </span>
    </span>
  );
}
