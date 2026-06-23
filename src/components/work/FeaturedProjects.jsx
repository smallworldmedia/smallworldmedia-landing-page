/**
 * FeaturedProjects — orchestrator for the immersive Featured Projects
 * experience at /work (CONTEXT.md § "Featured Projects Preview — concepts").
 *
 * Paging is CTA-driven: wheel/touch fills a fixed control until it triggers a
 * World change. Scrolling down fills the bottom NEXT_PROJECT control (→ next, or
 * → project directory on the last project as MORE_WORK); scrolling up fills the
 * top PREVIOUS_PROJECT control (→ previous; hidden on the first project). The
 * left pager is a cursor-proximity "dock" — each number scales by how close the
 * cursor is, independently of its neighbours.
 *
 * The WebGL WorldScene (P2) renders the active World behind the card. The World
 * Turn animation between Worlds lands in P3.
 *
 * @param {Object} props
 * @param {Array<Object>} props.worlds - one entry per featured project
 */
import { useEffect, useRef, useState } from 'react';
import WorldScene from './world/WorldScene.jsx';

const pad2 = (n) => String(n + 1).padStart(2, '0');
const falloff = (d, spread) => Math.max(0, 1 - d / spread);

const PAGER_BASE_GAIN = 1.6; // active dot scale = 1 + this
const PAGER_HOVER_GAIN = 1.8; // additive, centred on the cursor
const SCROLL_TRIGGER = 600; // wheel/touch px to fill a CTA and advance
const CTA_MAX_EXTRA = 0.3; // CTA scale at full fill / hover = 1 + this

export default function FeaturedProjects({ worlds = [] }) {
  const [active, setActive] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null); // continuous (float) cursor position over the pager
  const [fill, setFill] = useState(0); // signed: + toward next, − toward previous
  const [hoverNext, setHoverNext] = useState(false);
  const [hoverPrev, setHoverPrev] = useState(false);

  const mainRef = useRef(null);
  const accumRef = useRef(0);
  const lockRef = useRef(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  const lastIndex = worlds.length - 1;
  const atEnd = active >= lastIndex;
  const atStart = active <= 0;

  const goTo = (i) => {
    accumRef.current = 0;
    setFill(0);
    setActive(Math.max(0, Math.min(lastIndex, i)));
  };

  // Wheel/touch accumulator → fills a CTA, then advances forward/back.
  useEffect(() => {
    const el = mainRef.current;
    if (!el || !worlds.length) return undefined;

    const reset = () => {
      accumRef.current = 0;
      setFill(0);
      lockRef.current = performance.now() + 700; // avoid momentum skipping Worlds
    };

    const addDelta = (dy) => {
      if (performance.now() < lockRef.current) return;
      let a = accumRef.current + dy;
      if (activeRef.current <= 0) a = Math.max(0, a); // no previous at the first World
      accumRef.current = a;

      if (a >= SCROLL_TRIGGER) {
        if (activeRef.current >= lastIndex) {
          window.location.href = '/work/directory';
        } else {
          reset();
          setActive(activeRef.current + 1);
        }
      } else if (a <= -SCROLL_TRIGGER) {
        if (activeRef.current > 0) {
          reset();
          setActive(activeRef.current - 1);
        } else {
          reset();
        }
      } else {
        setFill(a / SCROLL_TRIGGER);
      }
    };

    const onWheel = (e) => {
      e.preventDefault();
      addDelta(e.deltaY);
    };
    let touchY = null;
    const onTouchStart = (e) => {
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e) => {
      if (touchY === null) return;
      const y = e.touches[0].clientY;
      addDelta((touchY - y) * 2); // upward swipe = forward
      touchY = y;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [worlds.length, lastIndex]);

  const onNext = () => {
    if (atEnd) window.location.href = '/work/directory';
    else goTo(active + 1);
  };
  const onPrev = () => goTo(active - 1);

  // Pager dock: base fisheye on the active number + additive bump that follows
  // the continuous cursor position, so each number scales independently.
  const dotScale = (i) =>
    1 +
    PAGER_BASE_GAIN * falloff(Math.abs(i - active), 3) +
    (hoverIndex === null
      ? 0
      : PAGER_HOVER_GAIN * falloff(Math.abs(i - hoverIndex), 2.5));

  const nextScale = 1 + CTA_MAX_EXTRA * Math.max(Math.max(0, fill), hoverNext ? 1 : 0);
  const prevScale = 1 + CTA_MAX_EXTRA * Math.max(Math.max(0, -fill), hoverPrev ? 1 : 0);

  if (!worlds.length) {
    return (
      <div className="fp-empty">
        <h1>Featured projects coming soon</h1>
      </div>
    );
  }

  const w = worlds[active];

  return (
    <main className="fp" aria-label="Featured projects" ref={mainRef}>
      <WorldScene world={w} />

      <nav
        className="fp-pager"
        aria-label="Featured project pager"
        onPointerLeave={() => setHoverIndex(null)}
      >
        {worlds.map((world, i) => (
          <button
            key={world.slug}
            type="button"
            className={`fp-pager__dot${i === active ? ' is-active' : ''}`}
            aria-current={i === active ? 'true' : undefined}
            aria-label={`Go to ${world.clientName}`}
            onClick={() => goTo(i)}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setHoverIndex(i + (e.clientY - r.top) / r.height - 0.5);
            }}
            onFocus={() => setHoverIndex(i)}
            style={{ fontSize: `calc(var(--text-mono) * ${dotScale(i).toFixed(3)})` }}
          >
            {pad2(i)}
          </button>
        ))}
      </nav>

      {/* Top: previous-project control (hidden on the first project). */}
      {!atStart && (
        <button
          type="button"
          className="fp-prev"
          style={{ '--cta-scale': prevScale.toFixed(3) }}
          onClick={onPrev}
          onPointerEnter={() => setHoverPrev(true)}
          onPointerLeave={() => setHoverPrev(false)}
          aria-label="Previous project"
        >
          <span className="fp-next__chevron">⌃</span>
          <span className="fp-next__label">PREVIOUS_PROJECT</span>
        </button>
      )}

      <div className="fp-stage">
        <div className="fp-card-wrap">
          <span className="fp-card__tab">{`PROJECT_${pad2(active)}`}</span>
          <div className="fp-card">
            <h2 className="fp-card__client">{w.clientName}</h2>
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
      </div>

      {/* Bottom: next-project control (becomes MORE_WORK on the last project). */}
      <button
        type="button"
        className="fp-next"
        style={{ '--cta-scale': nextScale.toFixed(3) }}
        onClick={onNext}
        onPointerEnter={() => setHoverNext(true)}
        onPointerLeave={() => setHoverNext(false)}
        aria-label={atEnd ? 'More work — project directory' : 'Next project'}
      >
        <span className="fp-next__label">
          {atEnd ? 'MORE_WORK' : 'NEXT_PROJECT'}
        </span>
        <span className="fp-next__chevron">⌄</span>
      </button>

      {/* Crawlable fallback — every featured project + link to its detail page. */}
      <ul className="sr-only">
        {worlds.map((world) => (
          <li key={world.slug}>
            <a href={`/work/${world.slug}`}>
              {world.clientName} —{' '}
              {[world.title, world.year].filter(Boolean).join(', ')}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
