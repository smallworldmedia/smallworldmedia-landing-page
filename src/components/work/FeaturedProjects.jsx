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
import WorldScene from './world/WorldScene.jsx';

const pad2 = (n) => String(n + 1).padStart(2, '0');

export default function FeaturedProjects({ worlds = [] }) {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(null);
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

  // Pager scale: a base fisheye centred on the active number, plus a stronger
  // additive bump centred on the hovered number.
  const falloff = (d, spread) => Math.max(0, 1 - d / spread);
  const PAGER_BASE_GAIN = 1.6; // active dot scale = 1 + this
  const PAGER_HOVER_GAIN = 1.8; // extra, additive, on the hovered dot
  const dotScale = (i) =>
    1 +
    PAGER_BASE_GAIN * falloff(Math.abs(i - active), 3) +
    (hovered === null
      ? 0
      : PAGER_HOVER_GAIN * falloff(Math.abs(i - hovered), 2.5));

  if (!worlds.length) {
    return (
      <div className="fp-empty">
        <h1>Featured projects coming soon</h1>
      </div>
    );
  }

  return (
    <main className="fp" aria-label="Featured projects">
      <WorldScene world={worlds[active]} />

      <nav className="fp-pager" aria-label="Featured project pager">
        {worlds.map((w, i) => (
          <button
            key={w.slug}
            type="button"
            className={`fp-pager__dot${i === active ? ' is-active' : ''}`}
            aria-current={i === active ? 'true' : undefined}
            aria-label={`Go to ${w.clientName}`}
            onClick={() => goTo(i)}
            onPointerEnter={() => setHovered(i)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            style={{ fontSize: `calc(var(--text-mono) * ${dotScale(i).toFixed(3)})` }}
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
            <div className="fp-card-wrap">
              <span className="fp-card__tab">{`PROJECT_${pad2(i)}`}</span>
              <div className="fp-card">
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
