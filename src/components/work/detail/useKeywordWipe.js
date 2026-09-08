/**
 * useKeywordWipe — plays the keyword-highlight wipe (src/lib/keywords.jsx)
 * once, the first time the blurb scrolls into view, a beat after arrival.
 * The detail blurb has no entrance timeline of its own, so this is its one
 * choreographed moment. Reduced motion: final state at mount.
 */
import { useEffect } from 'react';
import gsap from 'gsap';
import { PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';
import { kwWipe, kwSet } from '../../../lib/keywords.jsx';

const DELAY_S = 0.35; // the house delayed-trigger beat

export default function useKeywordWipe(ref) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !el.querySelector('.kw')) return undefined;
    if (PREFERS_REDUCED_MOTION) {
      kwSet(el, true);
      return undefined;
    }
    let tl = null;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        tl = gsap.timeline();
        kwWipe(tl, el, DELAY_S);
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      tl?.kill();
    };
  }, [ref]);
}
