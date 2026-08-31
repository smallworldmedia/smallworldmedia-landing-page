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
 *
 * 08-31 (/process adoption — the ProcessMeter's ░▒▓█ cells retired):
 *   · measure="document" — progress runs the whole document less the
 *     sticky footer's spacer (the ProcessMeter math), instead of a flow
 *     element's bottom edge.
 *   · broadcast + sectionSelector — re-fires ProcessMeter's
 *     swm:process-index {index,total} contract so ProcessStepCtas keeps
 *     its hide/back_to_top states with the meter gone.
 */
import { useEffect, useRef, useState } from 'react';

const SHOW_AFTER_PX = 24; // scroll intent before the bar appears

export default function DetailProgressBar({
  flowSelector = '.project-detail__flow',
  measure = 'flow',
  broadcast = false,
  sectionSelector = '.process-section',
}) {
  const fillRef = useRef(null);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);
  const [frac, setFrac] = useState(0);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    const flow = measure === 'flow' ? document.querySelector(flowSelector) : null;
    if (measure === 'flow' && !flow) return undefined;
    if (broadcast) {
      setTotal(document.querySelectorAll(sectionSelector).length || 1);
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      let totalPx;
      if (measure === 'document') {
        // The ProcessMeter math: the footer spacer is reveal runway, not
        // content — without subtracting it the bar only completes inside
        // the risen footer panel.
        const doc = document.scrollingElement || document.documentElement;
        const spacer = document.querySelector('.site-footer__spacer')?.offsetHeight ?? 0;
        totalPx = Math.max(1, doc.scrollHeight - spacer - window.innerHeight);
      } else {
        // Progress completes when the media flow's bottom edge reaches the
        // viewport bottom — the "seen all the media" moment, before the
        // NextProjectBand / footer travel below it.
        totalPx = Math.max(1, flow.getBoundingClientRect().bottom + y - window.innerHeight);
      }
      const p = Math.min(1, Math.max(0, y / totalPx));
      if (fillRef.current) fillRef.current.style.width = `${(p * 100).toFixed(2)}%`;
      setShown(y > SHOW_AFTER_PX);
      setDone(p >= 1);
      setFrac(p);
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
  }, [flowSelector, measure, broadcast, sectionSelector]);

  // The ProcessMeter broadcast contract, verbatim: 0-based active index,
  // re-fired only when it moves (ProcessStepCtas consumes).
  const cur = Math.round(frac * (total - 1));
  useEffect(() => {
    if (!broadcast) return;
    window.dispatchEvent(
      new CustomEvent('swm:process-index', { detail: { index: cur, total } })
    );
  }, [broadcast, cur, total]);

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
