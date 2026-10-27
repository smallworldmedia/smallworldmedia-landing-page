/**
 * BrandDeckViewer — brand decks on the DeckScroller wall (08-25).
 *
 * The BandPager presentation (World Turn curve, one page per gesture,
 * darkening fan) is TABLED for decks per Nathan — the pager itself stays
 * (AlbumArtViewer owns it); decks now render as the orthographic
 * DeckScroller wall: alternating vertical columns of pages under the
 * masonry-grid frame, driven by the page's own Lenis scroll.
 *
 * This wrapper keeps the deck semantics — mono tab chips for multi-deck
 * projects (order = orderRank via buildContentFlow group order, first tab
 * default: position is prominence). No deck-name label (10-27, Nathan —
 * none on any wall); the tabs are the only chrome, and only when there is
 * a choice to make.
 *
 * @param {Object} props
 * @param {Array<{group: string, pages: Array<Object>}>} props.decks
 * @param {number} [props.cols] - fixed wall column count (omit = geometry-derived)
 */
import { useState } from 'react';
import DeckScroller from './DeckScroller.jsx';
import { ratioOf } from './buildContentFlow.js';

export default function BrandDeckViewer({ decks, cols }) {
  const [deckIdx, setDeckIdx] = useState(0);
  const deck = decks[deckIdx];
  const pages = deck.pages;
  // ratioOf prefers real page dims for brand-deck (08-25) — a compiled
  // poster deck keeps its native aspect on the wall.
  const pageRatio = pages.length > 0 ? ratioOf(pages[0]) : 16 / 9;

  return (
    <div className="deck-scroller-shell">
      {decks.length > 1 && (
        <div className="deck-scroller__chrome" role="tablist" aria-label="brand decks">
          {decks.map((d, i) => (
            <button
              key={d.group}
              role="tab"
              aria-selected={i === deckIdx}
              className={`deck-tab${i === deckIdx ? ' deck-tab--active' : ''}`}
              onClick={() => setDeckIdx(i)}
            >
              {d.group}
            </button>
          ))}
        </div>
      )}
      <DeckScroller
        key={deck.group} /* deck switch = fresh wall (offsets reset) */
        pages={pages}
        ratio={pageRatio}
        cols={cols}
        ariaLabel={`${deck.group} deck`}
      />
    </div>
  );
}
