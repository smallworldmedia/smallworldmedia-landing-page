/**
 * LiveFootageGrid — a live-footage set on the project page (US-4, Nathan
 * 11-11): a grid of clips and photos in a socket.
 *
 * Phone: vertical media 2 across, horizontal media full width. Desktop:
 * vertical 3 across, horizontal 2 across. Each orientation crops (cover) to
 * ONE shape — the widest ratio among its members — and a partial row is
 * left-aligned at the full row's cell size (liveFootageLayout.js owns the
 * geometry and the socket's height; FeaturedProjectDetail hands the plan in).
 *
 * Every member is a MediaSlot (the page's own player: a clip loops muted
 * while it is near the viewport, a photo is an image), sized by its cell
 * rather than by its own ratio. The grid fills the socket: the rows share the
 * socket's height by their pixel heights, so the few px the row pitch rounds
 * up by spread across the rows instead of showing as an empty strip.
 *
 * @param {Object} props
 * @param {{rows: Array<{cols: number, items: Array<Object>}>, heights: number[], gap: number}} props.plan - liveFootagePlan
 * @param {string} [props.ariaLabel]
 */
import MediaSlot from './MediaSlot.jsx';

const FILL_CELL = { aspectRatio: 'auto', width: '100%', height: '100%', margin: 0 };

export default function LiveFootageGrid({ plan, ariaLabel = 'live footage' }) {
  const { rows, heights, gap } = plan;
  return (
    <div
      className="live-footage"
      role="group"
      aria-label={ariaLabel}
      style={{ gap: `${gap}px`, gridTemplateRows: heights.map((h) => `${h.toFixed(2)}fr`).join(' ') }}
    >
      {rows.map((row, r) => (
        <div
          key={r}
          className="live-footage__row"
          style={{ gap: `${gap}px`, gridTemplateColumns: `repeat(${row.cols}, minmax(0, 1fr))` }}
        >
          {row.items.map((asset) => (
            <div key={asset._id} className="live-footage__cell">
              <MediaSlot asset={asset} style={FILL_CELL} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
