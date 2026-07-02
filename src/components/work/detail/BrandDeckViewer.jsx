/**
 * BrandDeckViewer — brand decks on the shared BandPager.
 *
 * Thin assembly: BandPager owns the presentation and motion (World Turn
 * curve, one page per gesture, idle cycle, darkening fan). This wrapper
 * adds deck semantics — mono tab chips for multi-deck projects (order =
 * orderRank via buildContentFlow group order, first tab default: position
 * is prominence) and the active deck's name in the top-right side column
 * below the counter, scrambling in on every switch. The anonymous
 * fallback group ('deck') never shows a name.
 *
 * @param {Object} props
 * @param {Array<{group: string, pages: Array<Object>}>} props.decks
 */
import { useState } from 'react';
import BandPager from './BandPager.jsx';
import ScrambleLabel from './ScrambleLabel.jsx';
import { ratioOf } from './buildContentFlow.js';

export default function BrandDeckViewer({ decks }) {
  const [deckIdx, setDeckIdx] = useState(0);
  const deck = decks[deckIdx];
  const pages = deck.pages;
  const pageRatio = pages.length > 0 ? ratioOf(pages[0]) : 16 / 9;
  const showName = deck.group !== 'deck';

  const tabs =
    decks.length > 1 ? (
      <div className="band-pager__tabs" role="tablist" aria-label="brand decks">
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
    ) : null;

  return (
    <BandPager
      key={deck.group} /* deck switch = fresh pager (phase + counter reset) */
      items={pages}
      ratio={pageRatio}
      kind="deck"
      ariaLabel={`${deck.group} deck`}
      tabs={tabs}
      side={() =>
        showName ? (
          <ScrambleLabel
            scrambleOnMount
            text={deck.group}
            className="band-pager__name"
          />
        ) : null
      }
    />
  );
}
