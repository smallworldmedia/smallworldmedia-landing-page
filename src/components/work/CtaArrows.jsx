/**
 * CtaArrows — the looping feathered caret strip of the CTA chip family
 * ([NEXT]/[PREVIOUS] on /work, [SCROLL_TO_ENTER] on the home hero).
 *
 * A tall track of identical thin chevrons (1.5px SVG strokes — the text
 * glyph read too heavy) translating at a constant rate, clipped to the
 * container window and feathered to 0% opacity only on the side nearest
 * the label; carets stay fully visible all the way to the far edge.
 * `direction`: 'down' (NEXT / enter), 'up' (PREVIOUS), or 'right'
 * (detail-page next_project chip — horizontal track, xPercent loop).
 *
 * ?caret=<seconds> tunes the drift (seconds per slot); reduced motion
 * renders the strip static.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { PREFERS_REDUCED_MOTION } from './world/worldConfig.js';
import { NAME_GAP_EM, rollGeometry } from '../../lib/ctaNames.js';

// Seconds for one caret to travel one slot — higher = slower drift.
const ARROW_LOOP_SECONDS = (() => {
  if (typeof window === 'undefined') return 6;
  const n = parseFloat(new URLSearchParams(window.location.search).get('caret'));
  return Number.isFinite(n) ? n : 6;
})();

function Chevron({ direction }) {
  if (direction === 'right') {
    // Horizontal cut: the same thin 1.5px stroke rotated to point right,
    // sized for the chip-scale window (project-detail.css re-cuts the frame).
    return (
      <svg viewBox="0 0 12 24" width="10" height="20">
        <polyline
          points="3.5,2 8.5,12 3.5,22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
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

// Same loop, same geometry: a roll whose shift/duration did not move keeps its
// object, so a resize tick that measures the same never re-phases the ticker.
const sameRoll = (a, b) =>
  a === b || (a && b && Math.abs(a.shiftPx - b.shiftPx) < 0.05 && Math.abs(a.durS - b.durS) < 0.005);

/**
 * CtaName — the /work chip's label as a CLIENT NAME (SQ-80). A fixed-width
 * box between the carets: a name that fits sits centred and still; a wider
 * one rolls as the house two-copy marquee, hard-clipped at the box. Each copy
 * carries its own trailing gap (padding), so the track's -50% travel is
 * exactly one copy + one gap — no half-gap wrap jump — and the phase is the
 * wall clock's (negative animation-delay), so a remount joins mid-roll.
 * Reduced motion: no roll, the name clipped static. Face and weight live in
 * featured-projects.css (the pager's name tokens).
 */
export function CtaName({ name }) {
  const winRef = useRef(null);
  const textRef = useRef(null);
  const [roll, setRoll] = useState(null);
  useLayoutEffect(() => {
    const win = winRef.current;
    if (!win || PREFERS_REDUCED_MOTION) return undefined;
    let live = true;
    const measure = () => {
      const text = textRef.current; // re-read: a re-timed roll remounts the track
      if (!live || !text) return;
      const pxs = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scale-fill-pxs'));
      const g = rollGeometry({
        textW: text.offsetWidth,
        windowW: win.clientWidth,
        gapPx: NAME_GAP_EM * (parseFloat(getComputedStyle(win).fontSize) || 0),
        pxs: pxs || 30, // the pager's ticker speed (--scale-fill-pxs)
        nowMs: performance.now(),
      });
      setRoll((prev) => {
        const next = g.rolls ? g : null;
        return sameRoll(prev, next) ? prev : next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(win);
    document.fonts?.ready.then(measure); // the face may land after first paint
    return () => {
      live = false;
      ro.disconnect();
    };
  }, [name]);

  return (
    <span
      className="fp-cta__label fp-cta__name"
      ref={winRef}
      aria-hidden="true"
      data-roll={roll ? '' : undefined}
      style={
        roll
          ? {
              '--cta-name-gap': `${NAME_GAP_EM}em`,
              '--cta-name-s': `${roll.durS.toFixed(3)}s`,
              '--cta-name-delay': `${roll.delayS.toFixed(3)}s`,
            }
          : undefined
      }
    >
      {/* keyed by the loop's geometry: changing an animation's duration or
          delay mid-run keeps its start time and so jumps its phase off the
          wall clock — a re-timed roll is a fresh element, a fresh phase */}
      <span className="fp-cta__name-track" key={roll ? `${roll.shiftPx.toFixed(1)}|${roll.durS.toFixed(2)}` : 'still'}>
        <span className="fp-cta__name-copy">
          <span ref={textRef}>{name}</span>
        </span>
        <span className="fp-cta__name-copy">{name}</span>
      </span>
    </span>
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
        : direction === 'right'
          ? gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: ARROW_LOOP_SECONDS, ease: 'none', repeat: -1 })
          : gsap.fromTo(track, { yPercent: 0 }, { yPercent: -50, duration: ARROW_LOOP_SECONDS, ease: 'none', repeat: -1 });
    // 09-05 (the pager-ticker finding, applied house-wide): every looping
    // strip is PHASE-LOCKED to the wall clock — the housePulseLoop seek —
    // so strips that mount at different moments (the /work prev/next
    // pair, /process's three, a remount after a Turn) run in step instead
    // of each starting from zero whenever it happened to arm.
    tween.totalTime((performance.now() / 1000) % ARROW_LOOP_SECONDS);
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
