/**
 * ProcessMeter — the fixed walkthrough status bar. The carousel osboot
 * template's boot-log block meter (the scramble charset ░▒▓█) promoted
 * to live site chrome: ten cells fill with progress through the
 * walkthrough, the fractional cell stepping ░→▒→▓ before it lands █ —
 * the swipe literally loads the process. Mono register; field-aware
 * through the page's data-bg skin (white ink on the blue field,
 * electric blue on black). Candidate for wider site use once refined.
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

export default function ProcessMeter() {
  const [frac, setFrac] = useState(0);
  const [total, setTotal] = useState(1);

  useEffect(() => {
    setTotal(document.querySelectorAll('.process-section').length || 1);
    let raf = 0;
    const measure = () => {
      raf = 0;
      const doc = document.scrollingElement || document.documentElement;
      const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
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
  }, []);

  const cur = Math.round(frac * (total - 1)) + 1;
  return (
    <div className="process-meter" aria-hidden="true">
      <span className="process-meter__label">the_process</span>
      <span className="process-meter__cells">{bar(frac)}</span>
      <span className="process-meter__step">{`${pad2(cur)} / ${pad2(total)}`}</span>
    </div>
  );
}
