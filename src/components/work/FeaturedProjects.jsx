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
 * At the FIRST World, scrolling up mirrors the hero Envelopment in reverse
 * (FP-3): upward deltas accumulate toward the house trigger while the
 * persistent RouteFill pre-covers on the hero's f² curve; stalling
 * rubber-bands the blue back, crossing the threshold commits — `swm:envelop`
 * over the house glide, then a client-nav home, where Hero's mount releases
 * the fill. Reduced motion: modest upward intent → plain navigation.
 *
 * The WebGL WorldScene (P2) renders the active World behind the card. The World
 * Turn animation between Worlds lands in P3.
 *
 * @param {Object} props
 * @param {Array<Object>} props.worlds - one entry per featured project
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { navigate } from 'astro:transitions/client';
import WorldScene from './world/WorldScene.jsx';
import WorldCard from './WorldCard.jsx';
import CtaArrows from './CtaArrows.jsx';
// FP-1 house-pulse tuning bench — dev-only, mounts solely under ?fp1tune=1.
import Fp1TunePanel from './Fp1TunePanel.jsx';
import { FP1_TUNE_ACTIVE } from './fp1Tune.js';
import { TURN_DURATION, PREFERS_REDUCED_MOTION } from './world/worldConfig.js';
import { formatYearRange } from '../../lib/formatYearRange.js';
import {
  SCROLL_TRIGGER_WORK_PX,
  TOUCH_GAIN,
  RELEASE_MS,
  GLIDE_MS,
} from '../../lib/motion.js';

const pad2 = (n) => String(n + 1).padStart(2, '0');
const falloff = (d, spread) => Math.max(0, 1 - d / spread);

// Live tuning (?key=value) — matches the WorldScene knobs convention.
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

const PAGER_BASE_GAIN = 1.6; // active dot scale = 1 + this
const PAGER_HOVER_GAIN = 1.8; // additive, centred on the cursor
// Wheel/touch px to fill a CTA and advance — higher = more scroll resistance
// before a World Turn fires. Tune live with ?scroll=900.
const SCROLL_TRIGGER = PARAM('scroll', SCROLL_TRIGGER_WORK_PX);
const CTA_MAX_EXTRA = 0.3; // CTA scale at full fill / hover = 1 + this

/* — Scroll-up-to-home (FP-3): the reverse Envelopment at the first World — */
const HOME_PRE_COVER = 0.4; // blue opacity at full upward drag (Hero's f² idiom)
const RM_WHEEL_THRESHOLD = 60; // reduced motion: modest upward intent → plain nav

export default function FeaturedProjects({ worlds = [] }) {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState(1); // last Turn direction: +1 forward, −1 back (drives the card slide)
  const [hoverIndex, setHoverIndex] = useState(null); // continuous (float) cursor position over the pager
  const [fill, setFill] = useState(0); // signed: + toward next, − toward previous
  const [ctaMode, setCtaMode] = useState('drag'); // 'drag' tracks scroll | 'release' rubber-bands back | 'commit' eases back over a Turn
  const [hoverNext, setHoverNext] = useState(false);
  const [hoverPrev, setHoverPrev] = useState(false);
  // Co-present cards during a Turn: the incoming (phase 'enter') + the outgoing
  // (phase 'exit'), so the card rides in/out with the media. Each is keyed by index.
  const [cards, setCards] = useState([{ index: 0, dir: 1, phase: 'enter' }]);

  const mainRef = useRef(null);
  const pagerRef = useRef(null);
  const markerRef = useRef(null);
  const accumRef = useRef(0);
  const lockRef = useRef(0);
  const idleRef = useRef(null); // pending rubber-band-back timer
  const cardTimerRef = useRef(null); // removes the exited card after a Turn
  const departingRef = useRef(false); // reverse Envelopment committed — no Turns, no double-fire
  const homeFillRef = useRef(0); // last dispatched pre-cover value (upward drag at the first World)
  const activeRef = useRef(0);
  activeRef.current = active;

  const lastIndex = worlds.length - 1;
  const atEnd = active >= lastIndex;
  const atStart = active <= 0;

  // ── Return-position restore ──
  // Only an explicit return from a detail page reopens the World you left:
  // the breadcrumb arms `swm:returnToWork` on click, and BaseLayout's
  // popstate tracker arms it for browser back/forward. Any other entry —
  // the nav's featured_projects link, a direct load — starts at the first
  // World. Restore sets `active` only: the card-staging effect rolls the
  // restored card in through the normal exit/enter choreography (setting
  // cards directly here raced that effect and left the entrance reverted —
  // the "card never loads" bug).
  useEffect(() => {
    let armed = false;
    let saved = NaN;
    try {
      armed = sessionStorage.getItem('swm:returnToWork') === '1';
      sessionStorage.removeItem('swm:returnToWork');
      saved = parseInt(sessionStorage.getItem('swm:worldIndex') ?? '', 10);
    } catch {
      /* storage unavailable → first World */
    }
    if (!armed || !Number.isFinite(saved)) return;
    const idx = Math.max(0, Math.min(lastIndex, saved));
    if (idx !== activeRef.current) setActive(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene is mounting — release the Envelopment fill if this arrival came
  // through it (home → /work under the persistent RouteFill, ADR-0002).
  // No-op on direct loads: the fill is only ever up mid-passage.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem('swm:worldIndex', String(active));
    } catch {
      /* storage unavailable — nothing to persist */
    }
  }, [active]);

  const TURN_MS = TURN_DURATION * 1000;
  const clearIdle = () => {
    if (idleRef.current) {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    }
  };

  // RouteFill pre-cover tracking the upward drag at the first World — the
  // reverse of Hero's ENV_PRE_COVER: blue rises with the gesture, the scene
  // underneath stays live (RouteFill's `swm:fill-progress` contract).
  const setHomeFill = (value, duration) => {
    homeFillRef.current = value;
    window.dispatchEvent(
      new CustomEvent('swm:fill-progress', {
        detail: duration ? { value, duration } : { value },
      })
    );
  };

  // Scroll stalled below the threshold → rubber-band the partly-filled CTA back
  // to rest (you didn't commit, so it relaxes). Any upward-drag pre-cover
  // relaxes with it on the same release curve.
  const scheduleRelease = () => {
    clearIdle();
    idleRef.current = setTimeout(() => {
      accumRef.current = 0;
      setCtaMode('release');
      setFill(0);
      if (homeFillRef.current > 0) setHomeFill(0, 0.4);
    }, RELEASE_MS);
  };

  // Threshold crossed upward at the first World → commit the reverse
  // Envelopment: cover with the persistent RouteFill over the house glide
  // (continuing from wherever the drag's pre-cover left it), then client-nav
  // home once the blue is solid. Hero's mount releases the fill (ADR-0002).
  const beginReturnHome = () => {
    if (departingRef.current) return;
    departingRef.current = true;
    clearIdle();
    accumRef.current = 0;
    lockRef.current = Number.POSITIVE_INFINITY; // no Turns mid-departure
    if (PREFERS_REDUCED_MOTION) {
      navigate('/'); // no theatrics — plain navigation home
      return;
    }
    window.dispatchEvent(
      new CustomEvent('swm:envelop', { detail: { duration: GLIDE_MS / 1000 } })
    );
    setTimeout(() => navigate('/'), GLIDE_MS + 60); // cover ms + a settle beat
  };

  // Threshold crossed → fire the Turn and hold the triggering CTA at full, then
  // ease it back to rest timed to the World Turn settling. `from` is the CTA's
  // current signed fill so it eases down from wherever the scroll left it.
  const commitTurn = (nextActive, direction) => {
    if (departingRef.current) return; // mid reverse Envelopment — no Turns
    const clamped = Math.max(0, Math.min(lastIndex, nextActive));
    if (clamped === activeRef.current) return;
    clearIdle();
    accumRef.current = 0;
    lockRef.current = performance.now() + TURN_MS + 60; // one Turn at a time
    setDir(direction);
    setActive(clamped);
    setCtaMode('commit-pin'); // pin full *instantly* (0s), even from a fast flick
    setFill(direction); // …toward the trigger edge
    // Double rAF: let the pinned frame paint before starting the glide, so the
    // CSS transition animates *from* full (a single rAF gets batched away).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setCtaMode('commit'); // long eased return that matches the roll
        setFill(0); // …glide the CTA back as the World Turn settles
      })
    );
    setTimeout(() => setCtaMode('drag'), TURN_MS + 80);
  };

  // Pager-dot / button jumps: turn without the scroll-fill choreography.
  const goTo = (i) => {
    if (departingRef.current) return; // mid reverse Envelopment — no Turns
    const clamped = Math.max(0, Math.min(lastIndex, i));
    if (clamped === activeRef.current) return;
    clearIdle();
    lockRef.current = performance.now() + TURN_MS + 60;
    setDir(Math.sign(clamped - activeRef.current));
    accumRef.current = 0;
    setCtaMode('drag');
    setFill(0);
    if (homeFillRef.current > 0) setHomeFill(0, 0.4); // pager jump drops a live upward drag
    setActive(clamped);
  };

  // Wheel/touch accumulator → fills a CTA, then advances forward/back.
  useEffect(() => {
    const el = mainRef.current;
    if (!el || !worlds.length) return undefined;

    const addDelta = (dy) => {
      if (departingRef.current) return; // reverse Envelopment committed — input is done here
      if (performance.now() < lockRef.current) return;
      let a = accumRef.current + dy;
      if (activeRef.current >= lastIndex) a = Math.min(0, a); // no next at the last World (v1: directory disabled)

      // No previous at the first World — upward intent accumulates toward
      // HOME instead (FP-3): the reverse of the hero Envelopment.
      if (activeRef.current <= 0 && a < 0) {
        accumRef.current = a;
        if (PREFERS_REDUCED_MOTION) {
          // Modest intent → plain navigation (Hero's RM_WHEEL_THRESHOLD idiom).
          if (a <= -RM_WHEEL_THRESHOLD) beginReturnHome();
          return;
        }
        if (a <= -SCROLL_TRIGGER) {
          beginReturnHome();
        } else {
          // Building toward home — the blue pre-covers on the hero's gentle
          // f² curve (no CTA renders at the first World; the fill IS the tell).
          // Any [NEXT] fill from a flipped downward drag relaxes to rest.
          const f = -a / SCROLL_TRIGGER;
          setCtaMode('drag');
          setFill(0);
          setHomeFill(HOME_PRE_COVER * f * f);
          scheduleRelease();
        }
        return;
      }
      // Direction flipped back downward — relax any upward-drag pre-cover.
      if (homeFillRef.current > 0) setHomeFill(0, 0.4);
      accumRef.current = a;

      if (a >= SCROLL_TRIGGER) {
        commitTurn(activeRef.current + 1, 1);
      } else if (a <= -SCROLL_TRIGGER) {
        commitTurn(activeRef.current - 1, -1);
      } else {
        // Building the fill — track the scroll, and arm a rubber-band-back in
        // case the user stops short of committing.
        setCtaMode('drag');
        setFill(a / SCROLL_TRIGGER);
        scheduleRelease();
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
      addDelta((touchY - y) * TOUCH_GAIN); // upward swipe = forward
      touchY = y;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      touchY = null;
      if (!departingRef.current) scheduleRelease(); // finger up below threshold → relax the CTA
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      clearIdle();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [worlds.length, lastIndex]);

  // On World change, stage the outgoing card (exit) under the incoming (enter);
  // drop the exited card once the Turn finishes.
  useEffect(() => {
    setCards((prev) => {
      const top = prev.find((c) => c.phase === 'enter') || prev[prev.length - 1];
      if (!top || top.index === active) return prev;
      const d = Math.sign(active - top.index) || 1;
      return [
        { index: top.index, dir: d, phase: 'exit' },
        { index: active, dir: d, phase: 'enter' },
      ];
    });
    clearTimeout(cardTimerRef.current);
    cardTimerRef.current = setTimeout(() => {
      setCards((prev) => prev.filter((c) => c.phase !== 'exit'));
    }, TURN_MS + 120);
    return () => clearTimeout(cardTimerRef.current);
  }, [active]);

  // Pager marker: one triangle that eases to the active number instead of
  // teleporting. Two damping modes, because the target moves for two
  // different reasons: when `active` CHANGES the marker glides dot-to-dot
  // (the designed hand-off, k≈0.06); once it has arrived it switches to a
  // tight follow (k≈0.45) so layout shifts — the hover fisheye collapsing,
  // the viewport-centred rail recentring — carry the marker WITH its number
  // instead of letting it detach and jut toward a neighbour. Damping runs
  // in screen space (the rail's own top moves during those shifts); the
  // nav offset is applied at write time.
  useEffect(() => {
    const nav = pagerRef.current;
    const marker = markerRef.current;
    if (!nav || !marker || worlds.length < 1) return undefined;
    // Time constants (s) — dt-based so the feel is refresh-rate-invariant
    // (the old per-frame k glided twice as slow at 30fps, twice as fast
    // at 120Hz). 0.27s ≈ the original 60fps glide.
    const TAU_GLIDE = 0.27;
    const TAU_TRACK = 0.03;
    let y = null; // marker centre, screen space
    let lastIdx = null;
    let gliding = false;
    const follow = (_t, dtMs) => {
      const idx = activeRef.current;
      const dot = nav.querySelectorAll('.fp-pager__dot')[idx];
      if (!dot) return;
      if (idx !== lastIdx) {
        lastIdx = idx;
        gliding = true;
      }
      const r = dot.getBoundingClientRect();
      const target = r.top + r.height / 2;
      if (y === null || PREFERS_REDUCED_MOTION) {
        y = target;
      } else {
        const dt = Math.min(dtMs, 100) / 1000;
        const tau = gliding ? TAU_GLIDE : TAU_TRACK;
        y += (target - y) * (1 - Math.exp(-dt / tau));
        if (gliding && Math.abs(target - y) < 1.5) gliding = false;
      }
      marker.style.transform = `translateY(${y - nav.getBoundingClientRect().top}px)`;
    };
    gsap.ticker.add(follow);
    return () => gsap.ticker.remove(follow);
  }, [worlds.length]);

  const onNext = () => {
    if (!atEnd) goTo(active + 1);
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

  // CTA return choreography: snappy while dragging (tracks the scroll), a quick
  // spring-back on release, and a long eased glide on commit (lands as the
  // World Turn settles, sharing its curve).
  const ctaReturn =
    ctaMode === 'commit-pin'
      ? '0s'
      : ctaMode === 'commit'
        ? `${TURN_DURATION}s`
        : ctaMode === 'release'
          ? '0.4s'
          : '0.12s';
  const ctaEase =
    ctaMode === 'commit'
      ? 'cubic-bezier(0.65, 0, 0.35, 1)' // hold high, then settle to default as the Turn finishes
      : ctaMode === 'release'
        ? 'cubic-bezier(0.16, 1, 0.3, 1)' // quick spring back
        : 'ease-out'; // drag / pin
  const ctaVars = { '--cta-return': ctaReturn, '--cta-ease': ctaEase };

  // Pager ↔ CTA link: when a Turn commits, the left rail glides its active
  // number into place over the same window (and curve) as the triggering CTA
  // scaling back to rest, so the two read as one linked motion. Drag/click snap.
  const committing = ctaMode === 'commit' || ctaMode === 'commit-pin';
  const pagerVars = {
    '--pager-dur': committing ? `${TURN_DURATION}s` : '0.16s',
    '--pager-ease': committing ? 'cubic-bezier(0.65, 0, 0.35, 1)' : 'ease-out',
  };

  // CTA colour states: default black/white → lerps to white/black as the fill
  // grows (scrolling toward the threshold) → flashes blue/white the instant the
  // threshold is crossed (commit-pin) → eases back to black/white over the Turn.
  // `committing` is true only for the CTA in the direction that was triggered.
  const ctaColor = (f, committing) => {
    if (committing && ctaMode === 'commit-pin') {
      return { '--cta-bg': 'var(--color-electric-blue)', '--cta-fg': 'var(--color-white)' };
    }
    const pct = Math.round(Math.min(1, Math.max(0, f)) * 100);
    return {
      '--cta-bg': `color-mix(in srgb, var(--color-black), var(--color-white) ${pct}%)`,
      '--cta-fg': `color-mix(in srgb, var(--color-white), var(--color-black) ${pct}%)`,
    };
  };
  const nextColor = ctaColor(Math.max(0, fill), dir > 0);
  const prevColor = ctaColor(Math.max(0, -fill), dir < 0);

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
      {FP1_TUNE_ACTIVE && <Fp1TunePanel />}
      <WorldScene world={w} index={active} />

      <nav
        className={`fp-pager${hoverIndex !== null ? ' is-hovered' : ''}`}
        aria-label="Featured project pager"
        ref={pagerRef}
        style={pagerVars}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <span className="fp-pager__marker" ref={markerRef} aria-hidden="true" />
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
            onPointerDown={() => setHoverIndex(i)} /* touch tap reveals the tokens */
            onFocus={() => setHoverIndex(i)}
            style={{ fontSize: `calc(var(--text-mono) * ${dotScale(i).toFixed(3)})` }}
          >
            {pad2(i)}
            {/* Fixed-size mono token — sits right of the scaling number */}
            <span className="fp-pager__label" aria-hidden="true">
              {world.clientName}
            </span>
          </button>
        ))}
      </nav>

      {/* Top: previous-project control (hidden on the first project). */}
      {!atStart && (
        <button
          type="button"
          className="fp-prev fp-cta"
          style={{ '--cta-scale': prevScale.toFixed(3), ...ctaVars, ...prevColor }}
          onClick={onPrev}
          onPointerEnter={() => setHoverPrev(true)}
          onPointerLeave={() => setHoverPrev(false)}
          aria-label="Previous project"
        >
          <CtaArrows direction="up" />
          <span className="fp-cta__label">[PREVIOUS]</span>
        </button>
      )}

      <div className="fp-stage">
        {cards.map((c) =>
          worlds[c.index] ? (
            <WorldCard
              key={c.index}
              world={worlds[c.index]}
              index={c.index}
              phase={c.phase}
              dir={c.dir}
            />
          ) : null
        )}
      </div>

      {/* Bottom: next-project control — hidden on the last World (v1: directory disabled). */}
      {!atEnd && (
        <button
          type="button"
          className="fp-next fp-cta"
          style={{ '--cta-scale': nextScale.toFixed(3), ...ctaVars, ...nextColor }}
          onClick={onNext}
          onPointerEnter={() => setHoverNext(true)}
          onPointerLeave={() => setHoverNext(false)}
          aria-label="Next project"
        >
          <span className="fp-cta__label">[NEXT]</span>
          <CtaArrows direction="down" />
        </button>
      )}

      {/* Crawlable fallback — every featured project + link to its detail page. */}
      <ul className="sr-only">
        {worlds.map((world) => (
          <li key={world.slug}>
            <a href={`/work/${world.slug}`}>
              {world.clientName} —{' '}
              {[world.title, formatYearRange(world.yearStart, world.yearEnd, world.isOngoing)].filter(Boolean).join(', ')}
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
