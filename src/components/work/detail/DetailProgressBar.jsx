/**
 * DetailProgressBar — the detail page's scroll status bar (08-30 (2),
 * Nathan — replaces the ProcessMeter promotion).
 *
 * A simple rounded capsule: project-accent fill over a darker tint of the
 * same accent for the unfilled track. No label, no asset count. Hidden
 * until the user starts to scroll; fills with progress through the media
 * flow; the moment the media's bottom meets the viewport bottom it WIPES
 * OUT left → right (clip-path on the house draw curve, quick cut).
 * Scrolling back above the end re-arms it (the wipe reverses).
 *
 * Colors ride the html-level --project-color broadcast (applied pre-paint
 * by the RouteFill nav-accent controller) — zero plumbing here; the darker
 * track is a color-mix tint in CSS. Reduced motion: shows/hides instantly,
 * no wipe (CSS gates the transitions).
 */
import { useEffect, useRef, useState } from 'react';

const SHOW_AFTER_PX = 24; // scroll intent before the bar appears

export default function DetailProgressBar({ flowSelector = '.project-detail__flow' }) {
  const fillRef = useRef(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const flow = document.querySelector(flowSelector);
    if (!flow) return undefined;
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      // Progress completes when the media flow's bottom edge reaches the
      // viewport bottom — the "seen all the media" moment, before the
      // NextProjectBand / footer travel below it.
      const flowBottomDoc = flow.getBoundingClientRect().bottom + y;
      const total = Math.max(1, flowBottomDoc - window.innerHeight);
      const p = Math.min(1, Math.max(0, y / total));
      if (fillRef.current) fillRef.current.style.width = `${(p * 100).toFixed(2)}%`;
      setShown(y > SHOW_AFTER_PX);
      setDone(p >= 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [flowSelector]);

  return (
    <div
      className="detail-progress"
      data-shown={shown || undefined}
      data-done={done || undefined}
      aria-hidden="true"
    >
      <div className="detail-progress__fill" ref={fillRef} />
    </div>
  );
}
