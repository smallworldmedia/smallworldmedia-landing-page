/**
 * ReleaseCard — the Pull-out's metadata chip panel (ClientPanel family:
 * blue band, squeezed title, mono chips). Named first-class because
 * Phase 14's Record Crate reuses it verbatim.
 *
 * Degradation contract (spec § Pull-out): every chip is conditional —
 * with no releaseInfo at all the card shows the asset title alone and
 * still looks intentional. Never placeholders.
 *
 * @param {Object} props
 * @param {Object} props.asset - mediaAsset with optional releaseInfo{}
 */
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** '2024-03-15' → 'MAR 2024' (locale-free: SSR and client must agree). */
function formatReleaseDate(iso) {
  const [y, m] = (iso || '').split('-');
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return null;
  return `${MONTHS[mi]} ${y}`;
}

export default function ReleaseCard({ asset }) {
  const info = asset.releaseInfo ?? {};
  const title = info.releaseTitle || asset.title || 'UNTITLED';
  const date = formatReleaseDate(info.releaseDate);
  const links = (info.streamLinks ?? []).filter((l) => l?.url);

  return (
    <aside className="release-card">
      <div className="release-card__band">
        {info.releaseArtist && (
          <span className="release-card__artist">{info.releaseArtist}</span>
        )}
        <h3 className="release-card__title">{title}</h3>
      </div>

      {(info.catalogNumber || date) && (
        <div className="release-card__row">
          {info.catalogNumber && (
            <span className="release-chip">{info.catalogNumber}</span>
          )}
          {date && <span className="release-chip">{date}</span>}
        </div>
      )}

      {links.length > 0 && (
        <div className="release-card__row">
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
      )}
    </aside>
  );
}
