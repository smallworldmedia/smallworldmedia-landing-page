/**
 * ProjectDirectory — Top-level orchestrator for the /work route.
 *
 * Manages:
 *  - Filter state (active service tag slugs)
 *  - Progressive loading (infinite scroll, BATCH_SIZE at a time)
 *  - Lightbox selection
 *  - Data pass-through to MediaGrid, FilterBar, Lightbox
 *
 * The work-header + FilterBar are wrapped in a single fixed-position
 * container. A ResizeObserver dynamically sets the grid's top padding
 * so content is never hidden behind the fixed chrome — this adapts
 * automatically as more elements (e.g. site nav) are added later.
 *
 * All data is hydrated at build time via Astro and passed as props.
 *
 * @param {Object} props
 * @param {Array<Object>} props.assets - All non-album-art media assets
 * @param {Array<Object>} props.albumArt - Album art assets for the ticker
 * @param {Array<{name: string, slug: string}>} props.serviceTags - All service tags
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import FilterBar from './FilterBar.jsx';
import MediaGrid from './MediaGrid.jsx';
import Lightbox from './Lightbox.jsx';

/** Number of assets to load per batch */
const BATCH_SIZE = 16;

export default function ProjectDirectory({ assets, albumArt, serviceTags }) {
  const [activeSlugs, setActiveSlugs] = useState(new Set());
  const [lightboxAsset, setLightboxAsset] = useState(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);
  const fixedRef = useRef(null);
  const contentRef = useRef(null);

  /**
   * ResizeObserver: dynamically compute the fixed chrome height and
   * apply it as padding-top on the scrollable content area.
   * This means the grid always starts just below the fixed elements,
   * regardless of how many items (nav, header, filters) are in the
   * fixed container.
   */
  useEffect(() => {
    const fixedEl = fixedRef.current;
    const contentEl = contentRef.current;
    if (!fixedEl || !contentEl) return;

    const syncPadding = () => {
      const h = fixedEl.getBoundingClientRect().height;
      contentEl.style.paddingTop = `${h}px`;
    };

    // Initial measurement
    syncPadding();

    const ro = new ResizeObserver(syncPadding);
    ro.observe(fixedEl);
    return () => ro.disconnect();
  }, []);

  /**
   * Toggle a filter tag. Passing null clears all filters.
   * Reset visible count on filter change so the user starts fresh.
   */
  const handleToggle = useCallback((slug) => {
    if (slug === null) {
      setActiveSlugs(new Set());
    } else {
      setActiveSlugs((prev) => {
        const next = new Set(prev);
        if (next.has(slug)) {
          next.delete(slug);
        } else {
          next.add(slug);
        }
        return next;
      });
    }
    setVisibleCount(BATCH_SIZE);
  }, []);

  /**
   * Filter assets by active service slugs.
   * If no filters active, show everything.
   */
  const filteredAssets = useMemo(() => {
    if (activeSlugs.size === 0) return assets;
    return assets.filter((a) =>
      a.services?.some((s) => activeSlugs.has(s.slug))
    );
  }, [assets, activeSlugs]);

  /** Slice to only the currently visible batch */
  const visibleAssets = useMemo(() => {
    return filteredAssets.slice(0, visibleCount);
  }, [filteredAssets, visibleCount]);

  const hasMore = visibleCount < filteredAssets.length;

  /**
   * IntersectionObserver on the sentinel div at the bottom.
   * When it enters viewport, load the next batch.
   */
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + BATCH_SIZE, filteredAssets.length)
          );
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, filteredAssets.length]);

  return (
    <div className="work-page">
      {/* Fixed chrome: header + filter bar */}
      <div ref={fixedRef} className="work-chrome">
        <header className="work-header">
          <h1 className="work-header__title">Work</h1>
          <a href="/work/featured" className="work-header__featured-link">
            Featured Projects ↗
          </a>
        </header>

        <FilterBar
          tags={serviceTags}
          activeSlugs={activeSlugs}
          onToggle={handleToggle}
        />
      </div>

      {/* Scrollable content — padding-top set dynamically via ResizeObserver */}
      <div ref={contentRef} className="work-page__inner">
        <MediaGrid
          assets={visibleAssets}
          albumArt={albumArt}
          activeSlugs={activeSlugs}
          onSelect={setLightboxAsset}
        />

        {/* Sentinel: triggers next batch load when scrolled into view */}
        {hasMore && (
          <div
            ref={sentinelRef}
            className="work-sentinel"
            aria-hidden="true"
          />
        )}

        {/* End-of-grid component: appears when all assets have loaded */}
        {!hasMore && filteredAssets.length > 0 && (
          <footer className="work-end">
            <div className="work-end__mark">SWM</div>
            <p className="work-end__text">
              {filteredAssets.length} projects
            </p>
          </footer>
        )}
      </div>

      <Lightbox
        asset={lightboxAsset}
        onClose={() => setLightboxAsset(null)}
      />
    </div>
  );
}
