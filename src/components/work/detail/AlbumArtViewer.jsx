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
 * @param {Object} props
 * @param {Array<Object>} props.covers - album-art assets (≥ ORBIT_MIN)
 */
import DeckScroller from './DeckScroller.jsx';

export default function AlbumArtViewer({ covers }) {
  if (!covers.length) return null;
  return (
    <div className="deck-scroller-shell">
      <DeckScroller pages={covers} ratio={1} ariaLabel="album artwork" />
    </div>
  );
}
