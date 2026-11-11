/**
 * AlbumArtViewer — album catalogs on the orthographic DeckScroller wall
 * (08-27, Nathan).
 *
 * The BandPager presentation (World-Turn-curve pager, one cover per gesture,
 * per-cover release metadata rising in the side column) is TABLED — nothing
 * else rides the pager now, but BandPager.jsx stays on disk. Covers render
 * exactly like deck pages: alternating drifting columns of square art under
 * hairline black gutters, accelerated by the page's own Lenis scroll —
 * cohesion with the brand-deck walls by construction, and the same wall
 * carries over to the /work grid (fpDrumWall). A wall has no focused cover,
 * so the per-release chips (catalog number, date, stream links) are tabled
 * with the pager. 10-27 (Nathan): no labels on any wall — the album_catalog
 * name and release-count chip are gone; a wall of covers says what it is.
 *
 * 11-10 (Nathan): the same wall carries an admat set, one wall per set —
 * flyers at the set's ratio, a fixed column count, every flyer on it
 * (FeaturedProjectDetail sizes the socket so a whole flyer fits).
 *
 * @param {Object} props
 * @param {Array<Object>} props.covers - album-art assets (≥ ORBIT_MIN), or an admat set's flyers
 * @param {number} [props.ratio=1] - page aspect (w/h)
 * @param {number} [props.cols] - fixed column count (omit = geometry-derived)
 * @param {boolean} [props.showAll] - every page reaches the wall (DeckScroller)
 * @param {boolean} [props.play] - an animated flyer plays in the wall (DeckScroller `play`)
 * @param {'y'|'x'} [props.axis] - 'x' = a horizontal strip (the carousel; DeckScroller `axis`)
 * @param {number} [props.rows] - horizontal strips (axis 'x')
 * @param {string} [props.ariaLabel]
 */
import DeckScroller from './DeckScroller.jsx';

export default function AlbumArtViewer({
  covers,
  ratio = 1,
  cols,
  showAll,
  play,
  axis,
  rows,
  ariaLabel = 'album artwork',
}) {
  if (!covers.length) return null;
  return (
    <div className="deck-scroller-shell">
      <DeckScroller
        pages={covers}
        ratio={ratio}
        cols={cols}
        showAll={showAll}
        play={play}
        axis={axis}
        rows={rows}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
