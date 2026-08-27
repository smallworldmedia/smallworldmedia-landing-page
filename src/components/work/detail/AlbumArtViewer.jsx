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
 * with the pager; the side column keeps the catalog identity instead — an
 * album_catalog scramble over a release-count chip.
 *
 * @param {Object} props
 * @param {Array<Object>} props.covers - album-art assets (≥ ORBIT_MIN)
 */
import DeckScroller from './DeckScroller.jsx';
import ScrambleLabel from './ScrambleLabel.jsx';

export default function AlbumArtViewer({ covers }) {
  if (!covers.length) return null;
  return (
    <div className="deck-scroller-shell">
      <div className="deck-scroller__side deck-scroller__side--album">
        <ScrambleLabel
          scrambleOnMount
          text="album_catalog"
          className="band-pager__name"
        />
        <span className="release-chip">
          {String(covers.length).padStart(2, '0')} RELEASES
        </span>
      </div>
      <DeckScroller pages={covers} ratio={1} ariaLabel="album artwork" />
    </div>
  );
}
