/**
 * BannerViewer — wide banners (SoundCloud headers) on the DeckScroller wall
 * (09-10, Nathan — COCO).
 *
 * One full-width column of banners under the same hairline-gutter wall the
 * decks and album catalog ride: idle drift, accelerated by the page's own
 * Lenis scroll, wrapping seamlessly. The frame is sized by its socket to
 * ONE AND A HALF banners tall (FeaturedProjectDetail derives the rows from
 * the measured grid width), so the wall always reads as a peek — a whole
 * banner and the top of the next — on phone and desktop alike.
 *
 * Grouping is the displayGroup convention (buildContentFlow.isBannerGroup):
 * a group whose name ends in `banner`/`banners`. The group name scrambles in
 * top-right, the count chip mirrors the album wall.
 *
 * @param {Object} props
 * @param {{group: string, items: Array<Object>}} props.banners - one banner group
 */
import DeckScroller from './DeckScroller.jsx';
import ScrambleLabel from './ScrambleLabel.jsx';
import { ratioOf } from './buildContentFlow.js';

/** Banners visible in the frame — the socket rows are derived from this. */
export const BANNER_VISIBLE = 1.5;

export default function BannerViewer({ banners }) {
  const items = banners?.items ?? [];
  if (!items.length) return null;
  return (
    <div className="deck-scroller-shell banner-viewer">
      <div className="deck-scroller__side deck-scroller__side--album">
        <ScrambleLabel
          key={banners.group}
          scrambleOnMount
          text={banners.group.replace(/-/g, '_')}
          className="band-pager__name"
        />
        <span className="release-chip">
          {String(items.length).padStart(2, '0')} BANNERS
        </span>
      </div>
      <DeckScroller pages={items} ratio={ratioOf(items[0])} cols={1} ariaLabel={banners.group} />
    </div>
  );
}
