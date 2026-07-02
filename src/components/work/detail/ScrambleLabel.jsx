/**
 * ScrambleLabel — a text span that arrives via the house scramble.
 *
 * SSR renders the plain text (no empty-span flash); on the client the
 * scramble runs on text changes, and on first mount only when
 * `scrambleOnMount` is set (per-item chrome that remounts per page).
 * Reduced motion snaps (scrambleTo handles it).
 */
import { useRef, useEffect } from 'react';
import { scrambleTo } from '../../../lib/scramble.js';

export default function ScrambleLabel({ text, className, scrambleOnMount = false }) {
  const ref = useRef(null);
  const first = useRef(true);

  useEffect(() => {
    if (!ref.current) return;
    if (first.current) {
      first.current = false;
      if (!scrambleOnMount) return;
    }
    scrambleTo(ref.current, text);
  }, [text, scrambleOnMount]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
