/**
 * HeroSet — a set that leads its project page in its own viewer (US-10, Nathan 11-16).
 *
 * buildContentFlow hands the page `heroSet: { group, type, items }` when the project's first
 * piece belongs to a set that may lead (src/lib/setHero.js). This renders it in the hero box
 * (`.hero-set`, project-detail.css): the type's own wall at hero height, the same DeckScroller
 * family the grid sockets use, each at fixed columns and one fixed ratio, because a wall sizes
 * from its box and a hero box has no socket metrics to read:
 *
 *   deck               BrandDeckViewer, its own tabless wall (cols from the box)
 *   album-art          the cover wall at the page's wall columns
 *   admat              the flyer wall, every flyer on it, motion flyers playing
 *   carousel,          one row of slides at the box's height, travelling left
 *   flyer-progression
 *   visuals            the loop wall, 2 columns (1 on a phone)
 *   mockups            the masonry columns, every piece at its own aspect
 *
 * A merch set leads as one cycling sequence in the ordinary hero slot, so it is not drawn here
 * (the page makes the sequence and the existing hero layouts hold it).
 *
 * @param {Object} props
 * @param {{group: string, type: string, items: Array<Object>}} props.set - buildContentFlow's heroSet
 * @param {number} props.cols - the page's wall columns (cover and flyer walls)
 * @param {{phone: boolean, width?: number, gap?: number}} props.geo - the measured grid
 */
import BrandDeckViewer from './BrandDeckViewer.jsx';
import AlbumArtViewer from './AlbumArtViewer.jsx';
import { ratioOf } from './buildContentFlow.js';
import { visualsWall, mockupsWall } from './liveFootageLayout.js';
import { sequenceRatio } from '../../../lib/mediaSequence.js';

export default function HeroSet({ set, cols, geo }) {
  const { group, type, items } = set;
  // The shape that crops the set's members least, as the grid sockets pick it.
  const ratio = () => sequenceRatio(items.map(ratioOf));
  switch (type) {
    case 'deck':
      return <BrandDeckViewer decks={[{ group, pages: items }]} />;
    case 'album-art':
      return <AlbumArtViewer covers={items} cols={cols} />;
    case 'admat':
      return <AlbumArtViewer covers={items} ratio={ratio()} cols={cols} showAll play ariaLabel="tour flyers" />;
    case 'carousel':
    case 'flyer-progression':
      return <AlbumArtViewer covers={items} ratio={ratio()} axis="x" rows={1} play ariaLabel={`${group} carousel`} />;
    case 'visuals': {
      const wall = visualsWall(items, geo);
      return <AlbumArtViewer covers={items} ratio={wall.ratio} cols={wall.cols} showAll play ariaLabel="visuals" />;
    }
    case 'mockups': {
      const wall = mockupsWall(items, geo);
      return <AlbumArtViewer covers={items} ratio={wall.ratio} columns={wall.columns} showAll play ariaLabel="mockups" />;
    }
    default:
      return null;
  }
}
