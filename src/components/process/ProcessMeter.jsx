/**
 * ProcessMeter — the fixed walkthrough status bar. The carousel osboot
 * template's boot-log block meter (the scramble charset ░▒▓█) promoted
 * to live site chrome: ten cells fill with progress through the
 * walkthrough, the fractional cell stepping ░→▒→▓ before it lands █ —
 * the swipe literally loads the process. Mono register; field-aware
 * through the page's data-bg skin (white ink on the blue field,
 * electric blue on black). Candidate for wider site use once refined.
 *
 * Parameterized for reuse (the project detail page mounts it as the page
 * scroll meter) — every prop defaults to the original /process behavior:
 *
 * @param {Object}  props
 * @param {string}  [props.label='the_process']  - mono token left of the cells
 * @param {string}  [props.sectionSelector='.process-section'] - counted for the step total
 * @param {number}  [props.total]                - explicit step total (overrides the selector count)
 * @param {boolean|string} [props.broadcast=true] - fire the section-index event
 *   (true → 'swm:process-index', a string → that event name, false → silent)
 * @param {string}  [props.className]            - extra class on the root (e.g. 'detail-meter')
 */
import { useEffect, useState } from 'react';
import { getLenis } from '../../lib/smoothScroll.js';

const CELLS = 20; // doubled 2026-07-16 (Nathan: wider bar + finer steps)

function bar(frac) {
  const exact = Math.min(Math.max(frac, 0), 1) * CELLS;
  const full = Math.floor(exact);
  if (full >= CELLS) return '█'.repeat(CELLS);
  const rem = exact - full;
  const partial = rem < 1 / 3 ? '░' : rem < 2 / 3 ? '▒' : '▓';
  return '█'.repeat(full) + partial + '░'.repeat(CELLS - full - 1);
}

const pad2 = (n) => String(n).padStart(2, '0');

export default function ProcessMeter({
  label = 'the_process',
  sectionSelector = '.process-section',
  total: totalProp,
  broadcast = true,
  className = '',
}) {
  const [frac, setFrac] = useState(0);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    setTotal(totalProp ?? (document.querySelectorAll(sectionSelector).length || 1));
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doc = document.scrollingElement || document.documentElement;
      // The sticky footer's spacer is reveal runway, not content — without
      // subtracting it the meter (and the atEnd it drives) only completes
      // INSIDE the footer reveal, where the risen panel occludes the chrome.
      const spacer = document.querySelector('.site-footer__spacer')?.offsetHeight ?? 0;
      const max = Math.max(doc.scrollHeight - spacer - window.innerHeight, 1);
      setFrac(Math.min(window.scrollY / max, 1));
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    // Lenis emits while gliding; the native listener covers everything
    // else (RM native scroll, scrollbar drags, restored positions).
    const lenis = getLenis();
    lenis?.on('scroll', queue);
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      lenis?.off('scroll', queue);
      window.removeEventListener('scroll', queue);
      window.removeEventListener('resize', queue);
    };
  }, [sectionSelector, totalProp]);

  const cur = Math.round(frac * (total - 1)) + 1;

  // P5: broadcast the active section index so ProcessStepCtas can hide
  // [previous] before the 2nd section and disable [next] at the last.
  // 0-based to match the stepper's clamp math; re-fires only when it moves.
  // broadcast=false mounts (detail-page meter) stay silent.
  useEffect(() => {
    if (!broadcast) return;
    window.dispatchEvent(
      new CustomEvent(typeof broadcast === 'string' ? broadcast : 'swm:process-index', {
        detail: { index: cur - 1, total },
      })
    );
  }, [cur, total, broadcast]);

  return (
    <div className={`process-meter${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="process-meter__label">{label}</span>
      <span className="process-meter__cells">{bar(frac)}</span>
      <span className="process-meter__step">{`${pad2(cur)} / ${pad2(total)}`}</span>
    </div>
  );
}
