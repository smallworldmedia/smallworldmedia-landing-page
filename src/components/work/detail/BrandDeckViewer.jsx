/**
 * BrandDeckViewer — horizontal deck pager (Grid Socket occupant).
 *
 * Reading model (docs/orbit-deck-viewer-spec.md § BrandDeckViewer): a
 * fixed-height full-width band. Pages ride a slight isometric angle and
 * travel horizontally on the momentum engine's `snap` mode — drag/flick
 * settles on integer page indices with the house curve. Resting state is
 * the deck's cover with a fanned peek of the next pages receding behind
 * it (translateZ, so perspective does the shrinking); passed pages lift
 * toward the viewer and slide off left.
 *
 * Chrome: mono tab chips for multi-deck projects (order = orderRank via
 * buildContentFlow group order; default tab = first — position is
 * prominence), deck title scrambles on switch, `NN / NN` counter.
 *
 * Idle: the deck mirrors the orbit's quiet catalog tick — pages
 * auto-advance at the orbit's per-cover cadence (~2.6s) with the same
 * leisurely arrival curve, wrapping back to the cover; any interaction
 * resets the clock with a double dwell. Depth reads as darkening, never
 * transparency: fan pages darken toward the orbit's rear floor, passed
 * pages darken out entirely as they exit.
 *
 * Inputs: pointer drag with capture (≈5px travel discriminates click from
 * flick), tap zones (left/right thirds page ±1), arrow keys when focused.
 * Housekeeping: the engine ticks on gsap.ticker only while the band is
 * near the viewport and the tab visible; page images lazy-load in a ±2
 * window. Reduced motion: no auto-advance, instant page swaps, drag and
 * tabs still work.
 *
 * Live tuning: ?deckangle=<deg> ?deckfan=<px> ?deckcycle=<s>
 *
 * @param {Object} props
 * @param {Array<{group: string, pages: Array<Object>}>} props.decks
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { createMomentum } from '../../../lib/momentum.js';
import { scrambleTo } from '../../../lib/scramble.js';
import { ratioOf } from './buildContentFlow.js';
import { IMG_FORMAT } from '../imageConfig.js';

const PAGE_IMG_WIDTH = 1200; // Sanity CDN ?w= for band-sized pages
const LAZY_WINDOW = 2; // pages loaded around the current index
const TAP_MAX_PX = 5; // pointer travel below this = click, not drag

/* Stack geometry (px / deg) — tune with ?deckangle / ?deckfan */
const DECK_ANGLE = -8; // isometric rotateY
const FAN_X = 30; // horizontal peek per upcoming page
const FAN_Z = 46; // recession per upcoming page (perspective scales)
const FAN_DEPTH = 3.5; // pages visible in the resting fan
const EXIT_Z = 40; // passed pages lift toward the viewer
const EXIT_X = 0.92; // × pageW travel for passed pages
const DARK_IN = 0.2; // brightness drop per upcoming page (fan)
const DARK_FLOOR = 0.35; // fan brightness floor — mirrors the orbit's rear
const DARK_OUT = 0.9; // brightness loss per passed page (darkens out)

/* Idle cycle — mirrors the orbit's per-cover cadence (?deckcycle) */
const CYCLE_S = 2.6; // ≈ orbit REV_PERIOD / cover count
const CYCLE_TAU = 0.55; // arrival curve of the auto-advance (orbit seek)

const pad2 = (n) => String(n + 1).padStart(2, '0');

export default function BrandDeckViewer({ decks }) {
  const [deckIdx, setDeckIdx] = useState(0);
  const [current, setCurrent] = useState(0);
  const [metrics, setMetrics] = useState({ pageW: 0, pageH: 0 });
  // Indices whose <img> may fetch; grows as paging approaches them.
  const [loadable, setLoadable] = useState(() => new Set([0, 1, 2]));

  const stageRef = useRef(null);
  const titleRef = useRef(null);
  const pageEls = useRef([]);
  const engineRef = useRef(null);
  const metricsRef = useRef(metrics);
  const tuning = useRef({ angle: DECK_ANGLE, fan: FAN_X });
  const reducedMotion = useRef(false);

  const deck = decks[deckIdx];
  const pages = deck.pages;
  const pageRatio = pages.length > 0 ? ratioOf(pages[0]) : 16 / 9;

  /* ── Imperative paint: one transform per page from the phase scalar ── */
  const paint = useCallback((phase) => {
    const { pageW } = metricsRef.current;
    const { angle, fan } = tuning.current;
    const els = pageEls.current;
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;
      const d = i - phase;

      if (d > FAN_DEPTH + 1) {
        el.style.visibility = 'hidden';
        continue;
      }

      let x, z, brightness;
      if (d >= 0) {
        const dc = Math.min(d, FAN_DEPTH);
        x = dc * fan;
        z = -dc * FAN_Z;
        brightness = Math.max(DARK_FLOOR, 1 - Math.max(dc - 0.35, 0) * DARK_IN);
      } else {
        x = d * pageW * EXIT_X;
        z = -d * EXIT_Z;
        brightness = Math.max(0, 1 + d * DARK_OUT);
      }

      // Depth = darkness, never transparency; exits darken fully out.
      el.style.visibility = d < 0 && brightness <= 0.04 ? 'hidden' : 'visible';
      el.style.filter = `brightness(${brightness.toFixed(3)})`;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) rotateY(${angle}deg)`;
    }
  }, []);

  /* ── Engine + ticker + inputs, rebuilt per deck ── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || pages.length === 0) return undefined;

    reducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const params = new URLSearchParams(window.location.search);
    const qa = parseFloat(params.get('deckangle'));
    const qf = parseFloat(params.get('deckfan'));
    const qc = parseFloat(params.get('deckcycle'));
    tuning.current = {
      angle: Number.isFinite(qa) ? qa : DECK_ANGLE,
      fan: Number.isFinite(qf) ? qf : FAN_X,
    };
    const cycleS = Number.isFinite(qc) ? qc : CYCLE_S;
    const cycling = !reducedMotion.current && cycleS > 0 && pages.length > 1;

    const engine = createMomentum({
      mode: 'snap',
      min: 0,
      max: pages.length - 1,
      flickTau: 0.45,
      seekTau: CYCLE_TAU,
    });
    engineRef.current = engine;
    setCurrent(0);
    setLoadable(new Set([0, 1, 2]));

    let lastPage = 0;
    const syncPage = (phase) => {
      const page = Math.max(0, Math.min(pages.length - 1, Math.round(phase)));
      if (page === lastPage) return;
      lastPage = page;
      setCurrent(page);
      setLoadable((prev) => {
        let grew = false;
        const next = new Set(prev);
        for (let i = page - LAZY_WINDOW; i <= page + LAZY_WINDOW; i++) {
          if (i >= 0 && i < pages.length && !next.has(i)) {
            next.add(i);
            grew = true;
          }
        }
        return grew ? next : prev;
      });
    };

    /* Ticker — runs while visible; with the idle cycle armed it stays
       alive at rest (like the orbit's drift) to clock the auto-advance */
    let inView = false;
    let ticking = false;
    let cycleClock = 0; // seconds settled on the current page
    const tick = (_t, dtMs) => {
      const dt = Math.min(dtMs, 100) / 1000;
      engine.step(dt);
      paint(engine.phase);
      syncPage(engine.phase);
      if (engine.isResting()) {
        if (!cycling) {
          stopTick();
          return;
        }
        cycleClock += dt;
        if (cycleClock >= cycleS) {
          cycleClock = 0;
          const cur = Math.round(engine.phase);
          // Mirror the orbit's endless tick: wrap back to the cover.
          engine.goTo(cur >= pages.length - 1 ? 0 : cur + 1, CYCLE_TAU);
        }
      } else {
        // Zero the dwell during motion but keep a user-set double-dwell
        // hold (negative clock) intact.
        cycleClock = Math.min(cycleClock, 0);
      }
    };
    // Interactions push the next auto-advance out a double dwell.
    const holdCycle = () => {
      cycleClock = -cycleS;
    };
    const startTick = () => {
      if (ticking || !inView || document.hidden) return;
      gsap.ticker.add(tick);
      ticking = true;
    };
    const stopTick = () => {
      if (!ticking) return;
      gsap.ticker.remove(tick);
      ticking = false;
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView && (cycling || !engine.isResting())) startTick();
        if (!inView) stopTick();
      },
      { rootMargin: '120px' }
    );
    io.observe(stage);

    const onVisibility = () => {
      if (document.hidden) stopTick();
      else if (cycling || !engine.isResting()) startTick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    /* Measure the stage → uniform page rects (fit-contained cover) */
    const measure = () => {
      const r = stage.getBoundingClientRect();
      const pageH = r.height;
      const pageW = Math.min(pageH * pageRatio, r.width * 0.72);
      metricsRef.current = { pageW, pageH };
      setMetrics({ pageW, pageH });
      paint(engine.phase);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    measure();

    const goToPage = (page) => {
      const target = Math.max(0, Math.min(pages.length - 1, page));
      if (reducedMotion.current) {
        engine.setPhase(target); // instant swap
        paint(target);
        syncPage(target);
      } else {
        engine.goTo(target);
        startTick();
      }
    };

    /* Pointer: capture-drag with click discrimination */
    let dragging = false;
    let startX = 0;
    let lastX = 0;
    let maxTravel = 0;

    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      startX = lastX = e.clientX;
      maxTravel = 0;
      holdCycle();
      stage.setPointerCapture(e.pointerId);
      engine.beginDrag(performance.now());
      startTick();
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      maxTravel = Math.max(maxTravel, Math.abs(e.clientX - startX));
      const { pageW } = metricsRef.current;
      if (pageW > 0) engine.dragBy(-dx / pageW, performance.now());
      paint(engine.phase);
    };
    const onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;
      engine.endDrag(performance.now());
      startTick();
      if (maxTravel < TAP_MAX_PX) {
        const r = stage.getBoundingClientRect();
        const frac = (e.clientX - r.left) / r.width;
        if (frac < 1 / 3) goToPage(Math.round(engine.phase) - 1);
        else if (frac > 2 / 3) goToPage(Math.round(engine.phase) + 1);
      }
    };
    const onPointerCancel = () => {
      if (!dragging) return;
      dragging = false;
      engine.endDrag(performance.now());
      startTick();
    };
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        holdCycle();
        goToPage(Math.round(engine.phase) + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        holdCycle();
        goToPage(Math.round(engine.phase) - 1);
      }
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('keydown', onKeyDown);

    paint(0);

    return () => {
      stopTick();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerCancel);
      stage.removeEventListener('keydown', onKeyDown);
    };
  }, [deckIdx, pages, pageRatio, paint]);

  /* Deck title scrambles on switch (chrome kit) */
  useEffect(() => {
    if (titleRef.current) scrambleTo(titleRef.current, deck.group);
  }, [deckIdx, deck.group]);

  const { pageW, pageH } = metrics;
  // Tabs already name the decks; a title only earns its place on a
  // single-deck band, and never for the anonymous fallback group.
  const showTitle = decks.length === 1 && deck.group !== 'deck';

  return (
    <div className="deck-viewer">
      <header className="deck-viewer__chrome">
        {decks.length > 1 && (
          <div className="deck-viewer__tabs" role="tablist" aria-label="brand decks">
            {decks.map((d, i) => (
              <button
                key={d.group}
                role="tab"
                aria-selected={i === deckIdx}
                className={`deck-tab${i === deckIdx ? ' deck-tab--active' : ''}`}
                onClick={() => setDeckIdx(i)}
              >
                {d.group}
              </button>
            ))}
          </div>
        )}
        {showTitle && (
          <span ref={titleRef} className="deck-viewer__title">
            {deck.group}
          </span>
        )}
        <span className="deck-viewer__counter" aria-live="polite">
          {pad2(current)} / {pad2(pages.length - 1)}
        </span>
      </header>

      <div
        ref={stageRef}
        className="deck-viewer__stage"
        tabIndex={0}
        role="group"
        aria-label={`${deck.group} deck, page ${current + 1} of ${pages.length}`}
      >
        {pages.map((p, i) => (
          <div
            key={p._id}
            ref={(el) => {
              pageEls.current[i] = el;
            }}
            className="deck-page"
            style={
              pageW > 0
                ? {
                    width: pageW,
                    height: pageH,
                    marginLeft: -pageW / 2,
                    marginTop: -pageH / 2,
                  }
                : undefined
            }
          >
            {loadable.has(i) && (
              <img
                src={
                  p.imageUrl
                    ? `${p.imageUrl}?w=${PAGE_IMG_WIDTH}&${IMG_FORMAT}`
                    : `https://image.mux.com/${p.playbackId}/thumbnail.jpg?width=${PAGE_IMG_WIDTH}&fit_mode=preserve`
                }
                alt={p.title || `${deck.group} page ${i + 1}`}
                draggable={false}
                loading={i > 2 ? 'lazy' : 'eager'}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
