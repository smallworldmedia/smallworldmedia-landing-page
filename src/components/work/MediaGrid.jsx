/**
 * MediaGrid — Responsive CSS grid container for MediaCards.
 *
 * Uses grid-auto-flow: dense for aspect-ratio-aware packing.
 * Injects the AlbumArtTicker inline after the first N cards.
 * Passes active filter context to MediaCards for dynamic metadata.
 *
 * @param {Object} props
 * @param {Array<Object>} props.assets - Filtered media asset list
 * @param {Array<Object>} props.albumArt - Album art assets for the ticker
 * @param {Set}           props.activeSlugs - Active filter slugs
 * @param {(asset: Object) => void} props.onSelect - Lightbox open callback
 */
import { Fragment } from 'react';
import MediaCard from './MediaCard.jsx';
import AlbumArtTicker from './AlbumArtTicker.jsx';

/** Insert the ticker after this many cards */
const TICKER_INSERT_INDEX = 8;

export default function MediaGrid({ assets, albumArt, activeSlugs, onSelect }) {
  if (!assets?.length) {
    return (
      <div className="work-empty">
        <h2 className="work-empty__heading">No assets found</h2>
        <p className="work-empty__body">
          Try clearing your filters or check back soon.
        </p>
      </div>
    );
  }

  // Album art cards (per-client, 1×1 grid items)
  const albumCards = albumArt?.length > 0
    ? <AlbumArtTicker albumArt={albumArt} />
    : null;

  return (
    <div className="masonry-grid media-grid">
      {assets.map((asset, i) => (
        <Fragment key={asset._id}>
          {/* Inject album art cards at the configured index */}
          {i === TICKER_INSERT_INDEX && albumCards}
          <MediaCard
            asset={asset}
            activeSlugs={activeSlugs}
            onSelect={onSelect}
          />
        </Fragment>
      ))}

      {/* If fewer cards than insert index, place at end */}
      {assets.length <= TICKER_INSERT_INDEX && albumCards}
    </div>
  );
}
