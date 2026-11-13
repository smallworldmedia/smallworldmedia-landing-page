/**
 * GridSocket — the reserved-region layer of the Grid Socket system.
 *
 * Renders as a real grid child pinned to a resolved flushGrid region, so the
 * browser's grid engine tracks the px rect for free across resizes. The
 * inner layer floats the occupant (AlbumArtOrbit / BrandDeckViewer / the
 * walls) above the tiles (z-index 2, overflow visible for bounded overhang).
 *
 * The layer sits still (Nathan 11-12). It used to drift at a scroll
 * differential (`?sockpar`, 0.92, clamped at ±40 px), which opened a black
 * gap of up to 40 px between a wall and the tiles above or below it as the
 * page scrolled (Bedouin's deck viewer).
 *
 * ≤1024px, explicit grid placement collapses: CSS turns the socket into a
 * plain full-width in-flow band (see masonry.css).
 *
 * @param {Object} props
 * @param {Object} props.region  - resolved region from computeFlushGrid
 */
export default function GridSocket({ region, children }) {
  return (
    <div
      className="grid-socket"
      data-socket={region.id}
      style={{
        gridColumn: `${region.colStart + 1} / span ${region.colSpan}`,
        gridRow: `${region.rowStart + 1} / ${region.rowEnd + 1}`,
        // ≤1024 collapses placement to a fixed span; banner sockets read
        // their measured height back through this var (masonry.css).
        '--socket-rows': region.rowSpan,
      }}
    >
      <div className="grid-socket__layer">{children}</div>
    </div>
  );
}
