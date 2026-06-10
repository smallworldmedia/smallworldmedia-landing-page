/**
 * AlbumArtTicker — Per-client album art cards.
 *
 * Groups album art by client and renders one 1×1 grid card per client.
 * Each card hard-cuts through that client's album art collection.
 * Cards are standard grid items — not full-width ticker rows.
 *
 * Image resolution is pulled from the shared imageConfig so it
 * stays in sync with MediaCard without manual duplication.
 *
 * @param {Object} props
 * @param {Array<Object>} props.albumArt - Album art assets with clientName
 */
import { useState, useEffect } from 'react';
import { IMG_WIDTH_STANDARD, IMG_FORMAT } from './imageConfig.js';

/** Interval between hard-cut transitions (ms) — slow and editorial */
const CYCLE_INTERVAL = 750;

/** Single client album art card — hard-cuts through covers */
function AlbumArtCard({ covers, clientName }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (covers.length <= 1) return;

    const id = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % covers.length);
    }, CYCLE_INTERVAL);

    return () => clearInterval(id);
  }, [covers.length]);

  return (
    <div className="album-card">
      <div className="album-card__stack">
        {covers.map((art, i) => (
          <img
            key={art._id}
            className={`album-card__img${i === activeIndex ? ' album-card__img--active' : ''}`}
            src={`${art.imageUrl}?w=${IMG_WIDTH_STANDARD}&${IMG_FORMAT}`}
            alt={art.title || `${clientName} album art`}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}

export default function AlbumArtTicker({ albumArt }) {
  if (!albumArt?.length) return null;

  // Group by client
  const grouped = {};
  for (const art of albumArt) {
    const key = art.clientName || 'Unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(art);
  }

  return Object.entries(grouped).map(([clientName, covers]) => (
    <AlbumArtCard key={clientName} clientName={clientName} covers={covers} />
  ));
}
