/**
 * AlbumArtViewer — album catalogs on the shared BandPager.
 *
 * Covers page exactly like deck pages (same structure, weight, idle
 * cycle — cohesion by construction), and the focused cover's release
 * metadata rises in the top-right side column below the counter: black
 * mono chips mirroring the ClientPanel's base_in / client_type family.
 * The headline (artist — title) scrambles in per cover; catalog, date,
 * and stream-link buttons render only when the field exists — with no
 * releaseInfo the asset title stands alone and still looks intentional.
 *
 * @param {Object} props
 * @param {Array<Object>} props.covers - album-art assets (≥ ORBIT_MIN)
 */
import BandPager from './BandPager.jsx';
import ScrambleLabel from './ScrambleLabel.jsx';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** '2024-03-15' → 'MAR 2024' (locale-free: SSR and client must agree). */
function formatReleaseDate(iso) {
  const [y, m] = (iso || '').split('-');
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return null;
  return `${MONTHS[mi]} ${y}`;
}

function ReleaseMeta({ asset }) {
  const info = asset.releaseInfo ?? {};
  const headline =
    [info.releaseArtist, info.releaseTitle].filter(Boolean).join(' — ') ||
    asset.title ||
    'UNTITLED';
  const date = formatReleaseDate(info.releaseDate);
  const links = (info.streamLinks ?? []).filter((l) => l?.url);

  return (
    <div className="release-meta">
      <ScrambleLabel
        scrambleOnMount
        text={headline}
        className="release-chip release-chip--headline"
      />
      {info.catalogNumber && (
        <span className="release-chip">{info.catalogNumber}</span>
      )}
      {date && <span className="release-chip">{date}</span>}
      {links.map((l) => (
        <a
          key={l.url}
          className="release-chip release-chip--link"
          href={l.url}
          target="_blank"
          rel="noreferrer"
        >
          {(l.platform || 'LISTEN').toUpperCase()} ↗
        </a>
      ))}
    </div>
  );
}

export default function AlbumArtViewer({ covers }) {
  return (
    <BandPager
      items={covers}
      ratio={1}
      kind="album"
      imgWidth={800}
      ariaLabel="album artwork"
      side={(current) => (
        /* keyed remount per cover: chips slide in, headline scrambles */
        <ReleaseMeta key={covers[current]._id} asset={covers[current]} />
      )}
    />
  );
}
