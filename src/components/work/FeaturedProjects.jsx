/**
 * FeaturedProjects — orchestrator for the immersive Featured Projects
 * experience at /work (CONTEXT.md § "Featured Projects Preview — concepts").
 *
 * P1 skeleton: vertical-paging shell with a dynamic pager, the identity card,
 * a placeholder media field, and a crawlable semantic structure (real <h2> +
 * <a> per World). The WebGL WorldScene (Shell + floating Tiles + the World
 * Turn) replaces `.fp-world__field` in P2/P3; the AlbumArtOrbit / BrandDeckViewer
 * composite elements fill the socket slots in P4.
 *
 * @param {Object} props
 * @param {Array<Object>} props.worlds - one entry per featured project
 */
import { useEffect, useRef, useState } from 'react';

const muxThumb = (id, w = 640) =>
  `https://image.mux.com/${id}/thumbnail.jpg?width=${w}&fit_mode=smartcrop`;

const tileSrc = (a, w = 640) =>
  a.playbackId
    ? muxThumb(a.playbackId, w)
    : a.imageUrl
      ? `${a.imageUrl}?w=${w}&auto=format&fit=max`
      : null;

const pad2 = (n) => String(n + 1).padStart(2, '0');

export default function FeaturedProjects({ worlds = [] }) {
  const [active, setActive] = useState(0);
  const sectionRefs = useRef([]);

  // Track the in-view World to drive the pager (placeholder for the World Turn).
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number(e.target.dataset.index);
            if (!Number.isNaN(i)) setActive(i);
          }
        }
      },
      { threshold: 0.6 }
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [worlds.length]);

  const goTo = (i) =>
    sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' });

  if (!worlds.length) {
    return (
      <div className="fp-empty">
        <h1>Featured projects coming soon</h1>
      </div>
    );
  }

  return (
    <main className="fp" aria-label="Featured projects">
      <nav className="fp-pager" aria-label="Featured project pager">
        {worlds.map((w, i) => (
          <button
            key={w.slug}
            type="button"
            className={`fp-pager__dot${i === active ? ' is-active' : ''}`}
            aria-current={i === active ? 'true' : undefined}
            aria-label={`Go to ${w.clientName}`}
            onClick={() => goTo(i)}
          >
            {pad2(i)}
          </button>
        ))}
      </nav>

      <div className="fp-scroller">
        {worlds.map((w, i) => (
          <section
            key={w.slug}
            className="fp-world"
            data-index={i}
            ref={(el) => (sectionRefs.current[i] = el)}
            aria-labelledby={`fp-world-${i}-title`}
          >
            {/* Placeholder media field — replaced by the WebGL World in P2. */}
            <div className="fp-world__field" aria-hidden="true">
              {w.showcase.slice(0, 14).map((a) => {
                const src = tileSrc(a);
                return src ? (
                  <img
                    key={a._id}
                    className="fp-tile"
                    src={src}
                    alt=""
                    loading="lazy"
                  />
                ) : null;
              })}
            </div>

            <div className="fp-card">
              <p className="fp-card__index">{`PROJECT_${pad2(i)}`}</p>
              <h2 id={`fp-world-${i}-title`} className="fp-card__client">
                {w.clientName}
              </h2>
              {(w.title || w.year) && (
                <p className="fp-card__meta">
                  {[w.title, w.year].filter(Boolean).join(', ')}
                </p>
              )}
              <a className="fp-card__cta" href={`/work/${w.slug}`}>
                enter_world
              </a>
              {w.services.length > 0 && (
                <ul className="fp-card__tags">
                  {w.services.map((s) => (
                    <li key={s.slug} className="fp-tag">
                      {s.name}
                    </li>
                  ))}
                </ul>
              )}
              {(w.hasAlbumArt || w.hasBrandDeck) && (
                <p className="fp-card__sockets">
                  {w.hasAlbumArt && <span>album_art</span>}
                  {w.hasBrandDeck && <span>brand_deck</span>}
                </p>
              )}
            </div>

            {i < worlds.length - 1 && (
              <div className="fp-more" aria-hidden="true">
                <span>[MORE]</span>
                <span className="fp-more__chevron">⌄</span>
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
