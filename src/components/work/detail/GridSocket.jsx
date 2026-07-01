/**
 * GridSocket — the reserved-region layer of the Grid Socket system.
 *
 * Renders as a real grid child pinned to a resolved flushGrid region, so the
 * browser's grid engine tracks the px rect for free across resizes. The
 * inner layer floats the occupant (AlbumArtOrbit / BrandDeckViewer) above
 * the tiles (z-index 2, overflow visible for bounded overhang) and drifts
 * at a scroll differential — the parallax that makes the socket read as a
 * body floating over the grid, not another tile.
 *
 * Parallax is clocked by gsap.ticker — the same clock that drives Lenis
 * (smoothScroll.js), so the layer reads the already-smoothed document
 * position each tick. Drift is proportional to the socket's distance from
 * viewport center (zero when centered) and clamped so it never outruns the
 * overlap budget. Ticks only run while the socket is near the viewport.
 *
 * Off states: `prefers-reduced-motion` (no ticker at all) and ≤1024px,
 * where explicit grid placement collapses — CSS turns the socket into a
 * plain full-width in-flow band (see masonry.css).
 *
 * Live tuning: `?sockpar=0.9` overrides the parallax factor.
 *
 * @param {Object} props
 * @param {Object} props.region  - resolved region from computeFlushGrid
 * @param {number} [props.parallax=0.92] - scroll differential (1 = pinned to grid)
 * @param {number} [props.maxDrift=40]   - drift clamp, px
 */
import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';

export default function GridSocket({ region, parallax = 0.92, maxDrift = 40, children }) {
  const anchorRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    const anchor = anchorRef.current;
    const layer = layerRef.current;
    if (!anchor || !layer) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const tuned = parseFloat(
      new URLSearchParams(window.location.search).get('sockpar')
    );
    const factor = Number.isFinite(tuned) ? tuned : parallax;

    const collapsed = window.matchMedia('(max-width: 1024px)');

    const tick = () => {
      if (collapsed.matches) return; // CSS owns the in-flow fallback
      const rect = anchor.getBoundingClientRect();
      const centerOffset = rect.top + rect.height / 2 - window.innerHeight / 2;
      const drift = Math.max(
        -maxDrift,
        Math.min(maxDrift, centerOffset * (1 - factor))
      );
      layer.style.transform = `translate3d(0, ${drift.toFixed(2)}px, 0)`;
    };

    let ticking = false;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !ticking) {
          gsap.ticker.add(tick);
          ticking = true;
        } else if (!entry.isIntersecting && ticking) {
          gsap.ticker.remove(tick);
          ticking = false;
        }
      },
      { rootMargin: '160px' }
    );
    io.observe(anchor);

    return () => {
      io.disconnect();
      if (ticking) gsap.ticker.remove(tick);
    };
  }, [parallax, maxDrift]);

  return (
    <div
      ref={anchorRef}
      className="grid-socket"
      data-socket={region.id}
      style={{
        gridColumn: `${region.colStart + 1} / span ${region.colSpan}`,
        gridRow: `${region.rowStart + 1} / ${region.rowEnd + 1}`,
      }}
    >
      <div ref={layerRef} className="grid-socket__layer">
        {children}
      </div>
    </div>
  );
}
