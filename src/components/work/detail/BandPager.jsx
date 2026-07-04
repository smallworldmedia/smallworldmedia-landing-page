/**
 * BandPager — the shared band viewer core (BrandDeckViewer + AlbumArtViewer).
 *
 * One presentation for every paged band on the detail page: items ride a
 * slight isometric angle in a perspective stage, the resting fan recedes
 * behind the front item (depth = darkening, never transparency), passed
 * items lift toward the viewer and darken out left. The stack sits
 * right-of-center so the top-right side column (counter + per-item
 * content: deck name / release metadata) reads as part of the composition.
 *
 * Motion is the World Turn curve — the same CustomEase + duration that
 * rolls Featured Project → Featured Project — so every paging gesture on
 * the site carries the same weight. One gesture moves exactly one page:
 * a flick never carries past the neighbor (that cheapened the pages);
 * drags scrub freely but settle within ±1 of the gesture's start.
 *
 * Idle: pages auto-advance after a rest dwell (orbit-cadence), wrapping
 * to the front; interactions hold a double dwell. Timers only run while
 * the band is in-viewport and the document visible. Reduced motion: no
 * idle cycle, instant page swaps, drag still works.
 *
 * Live tuning: ?deckangle ?deckfan ?deckcycle ?deckshift
 *
 * @param {Object} props
 * @param {Array<Object>} props.items    - assets, one per page
 * @param {number}        props.ratio    - page aspect (deck ~16:9, covers 1)
 * @param {Function}      [props.side]   - (current) => node, under the counter
 * @param {ReactNode}     [props.tabs]   - left chrome (multi-deck tab chips)
 * @param {string}        [props.kind]   - 'deck' | 'album' (data attr)
 * @param {string}        [props.ariaLabel]
 * @param {number}        [props.imgWidth=1200] - Sanity/Mux CDN width
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import {
  TURN_DURATION,
  TURN_EASE_PATH,
} from '../world/worldConfig.js';
import { bandPose, BAND_ANGLE, FAN_X } from '../bandLayout.js';
import { IMG_FORMAT } from '../imageConfig.js';

gsap.registerPlugin(CustomEase);

// The House curve: identical shape/weight to the World Turn.
const bandTurnEase = CustomEase.create('bandTurn', TURN_EASE_PATH);

const LAZY_WINDOW = 2; // pages loaded around the current index
const TAP_MAX_PX = 5; // pointer travel below this = click, not drag
const FLICK_V = 0.9; // pages/s — release velocity that counts as a flick
const DRAG_WINDOW_MS = 100; // velocity estimate looks back this far

/* Stack geometry lives in bandLayout.js (shared with the World mount) */
const STACK_SHIFT = 0.05; // × stage width, stack sits right of center

/* Idle cycle — rest dwell before the next auto-advance (?deckcycle) */
const CYCLE_S = 2.6;

const pad2 = (n) => String(n + 1).padStart(2, '0');

export default function BandPager({
  items,
  ratio,
  side,
  tabs,
  kind = 'deck',
  ariaLabel,
  imgWidth = 1200,
}) {
  const [current, setCurrent] = useState(0);
  const [metrics, setMetrics] = useState({ pageW: 0, pageH: 0 });
  const [loadable, setLoadable] = useState(() => new Set([0, 1, 2]));

  const stageRef = useRef(null);
  const pageEls = useRef([]);
  const metricsRef = useRef(metrics);
  const tuning = useRef({ angle: BAND_ANGLE, fan: FAN_X, shift: STACK_SHIFT });
  const reducedMotion = useRef(false);

  const phaseRef = useRef(0);
  const tweenRef = useRef(null);

  /* ── Imperative paint: one transform per page from the phase scalar ── */
  const paint = useCallback(() => {
    const phase = phaseRef.current;
    const { pageW } = metricsRef.current;
    const { angle, fan, shift } = tuning.current;
    const stage = stageRef.current;
    const shiftPx = stage ? stage.clientWidth * shift : 0;
    const els = pageEls.current;

    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (!el) continue;

      const pose = bandPose(i, phase, pageW, { fan });
      if (pose.hidden) {
        el.style.visibility = 'hidden';
        continue;
      }

      el.style.visibility = 'visible';
      el.style.filter = `brightness(${pose.brightness.toFixed(3)})`;
      el.style.opacity = '1';
      el.style.transform = `translate3d(${(pose.x + shiftPx).toFixed(2)}px, 0, ${pose.z.toFixed(2)}px) rotateY(${angle}deg)`;
    }
  }, []);

  /* ── Pager engine: Turn-curve tweens + idle cycle + inputs ── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || items.length === 0) return undefined;

    reducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const params = new URLSearchParams(window.location.search);
    const qNum = (key, fallback) => {
      const v = parseFloat(params.get(key));
      return Number.isFinite(v) ? v : fallback;
    };
    tuning.current = {
      angle: qNum('deckangle', BAND_ANGLE),
      fan: qNum('deckfan', FAN_X),
      shift: qNum('deckshift', STACK_SHIFT),
    };
    const cycleS = qNum('deckcycle', CYCLE_S);
    const cycling =
      !reducedMotion.current && cycleS > 0 && items.length > 1;
    const max = items.length - 1;

    let lastPage = 0;
    const syncPage = () => {
      const page = Math.max(0, Math.min(max, Math.round(phaseRef.current)));
      if (page === lastPage) return;
      lastPage = page;
      setCurrent(page);
      setLoadable((prev) => {
        let grew = false;
        const next = new Set(prev);
        for (let i = page - LAZY_WINDOW; i <= page + LAZY_WINDOW; i++) {
          if (i >= 0 && i <= max && !next.has(i)) {
            next.add(i);
            grew = true;
          }
        }
        return grew ? next : prev;
      });
    };

    /* Idle cycle — timer-scheduled from each settle; no rAF at rest */
    let inView = false;
    let cycleTimer = null;
    const clearCycle = () => {
      if (cycleTimer) {
        clearTimeout(cycleTimer);
        cycleTimer = null;
      }
    };
    const scheduleCycle = (delayS = cycleS) => {
      clearCycle();
      if (!cycling || !inView || document.hidden) return;
      cycleTimer = setTimeout(() => {
        const cur = Math.round(phaseRef.current);
        goToPage(cur >= max ? 0 : cur + 1, true);
      }, delayS * 1000);
    };

    /** Page transitions ride the World Turn curve — one page at a time. */
    const goToPage = (target, viaCycle = false) => {
      const t = Math.max(0, Math.min(max, target));
      tweenRef.current?.kill();
      clearCycle();

      if (reducedMotion.current) {
        phaseRef.current = t;
        paint();
        syncPage();
        return;
      }
      tweenRef.current = gsap.to(phaseRef, {
        current: t,
        duration: TURN_DURATION,
        ease: bandTurnEase,
        onUpdate: () => {
          paint();
          syncPage();
        },
        onComplete: () => {
          tweenRef.current = null;
          // User-initiated pages hold a double dwell before the idle
          // cycle resumes; the cycle itself keeps its own cadence.
          scheduleCycle(viaCycle ? cycleS : cycleS * 2);
        },
      });
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) scheduleCycle();
        else clearCycle();
      },
      { rootMargin: '120px' }
    );
    io.observe(stage);

    const onVisibility = () => {
      if (document.hidden) clearCycle();
      else scheduleCycle();
    };
    document.addEventListener('visibilitychange', onVisibility);

    /* Measure the stage → uniform page rects (fit-contained) */
    const measure = () => {
      const r = stage.getBoundingClientRect();
      const pageH = r.height;
      const pageW = Math.min(pageH * ratio, r.width * 0.72);
      metricsRef.current = { pageW, pageH };
      setMetrics({ pageW, pageH });
      paint();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    measure();

    /* Pointer: scrub freely, settle within ±1 of the gesture's start */
    let dragging = false;
    let startX = 0;
    let lastX = 0;
    let maxTravel = 0;
    let startPage = 0;
    let samples = [];

    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      tweenRef.current?.kill();
      tweenRef.current = null;
      clearCycle();
      dragging = true;
      startX = lastX = e.clientX;
      maxTravel = 0;
      startPage = Math.round(phaseRef.current);
      samples = [{ t: performance.now(), p: phaseRef.current }];
      stage.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      maxTravel = Math.max(maxTravel, Math.abs(e.clientX - startX));
      const { pageW } = metricsRef.current;
      if (pageW > 0) {
        phaseRef.current = Math.max(
          0,
          Math.min(max, phaseRef.current - dx / pageW)
        );
        const now = performance.now();
        samples.push({ t: now, p: phaseRef.current });
        while (samples.length > 2 && samples[0].t < now - DRAG_WINDOW_MS) {
          samples.shift();
        }
        paint();
        syncPage();
      }
    };
    const onPointerUp = (e) => {
      if (!dragging) return;
      dragging = false;

      // Trailing-window velocity (pages/s); a held-still release ≈ 0.
      const now = performance.now();
      const recent = samples.filter((s) => s.t >= now - DRAG_WINDOW_MS);
      const first = recent[0];
      const dtS = first ? (now - first.t) / 1000 : 0;
      const vel = dtS > 0.016 ? (phaseRef.current - first.p) / dtS : 0;

      let target = Math.round(phaseRef.current);
      if (target === startPage && Math.abs(vel) > FLICK_V) {
        target = startPage + Math.sign(vel);
      }
      // One page per gesture — momentum never carries past the neighbor.
      target = Math.max(startPage - 1, Math.min(startPage + 1, target));

      if (maxTravel < TAP_MAX_PX) {
        const r = stage.getBoundingClientRect();
        const frac = (e.clientX - r.left) / r.width;
        if (frac < 1 / 3) target = startPage - 1;
        else if (frac > 2 / 3) target = startPage + 1;
        else target = startPage;
      }
      goToPage(target);
    };
    const onPointerCancel = () => {
      if (!dragging) return;
      dragging = false;
      goToPage(Math.round(phaseRef.current));
    };
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToPage(Math.round(phaseRef.current) + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPage(Math.round(phaseRef.current) - 1);
      }
    };

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerCancel);
    stage.addEventListener('keydown', onKeyDown);

    paint();

    return () => {
      tweenRef.current?.kill();
      clearCycle();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      stage.removeEventListener('pointerdown', onPointerDown);
      stage.removeEventListener('pointermove', onPointerMove);
      stage.removeEventListener('pointerup', onPointerUp);
      stage.removeEventListener('pointercancel', onPointerCancel);
      stage.removeEventListener('keydown', onKeyDown);
    };
  }, [items, ratio, paint]);

  const { pageW, pageH } = metrics;

  return (
    <div className="band-pager" data-kind={kind}>
      {tabs && <header className="band-pager__chrome">{tabs}</header>}

      <div className="band-pager__side">
        <span className="band-pager__counter" aria-live="polite">
          {pad2(current)} / {pad2(items.length - 1)}
        </span>
        {side ? side(current) : null}
      </div>

      <div
        ref={stageRef}
        className="band-pager__stage"
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel || 'pages'}, page ${current + 1} of ${items.length}`}
      >
        {items.map((p, i) => (
          <div
            key={p._id}
            ref={(el) => {
              pageEls.current[i] = el;
            }}
            className="band-page"
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
                    ? `${p.imageUrl}?w=${imgWidth}&${IMG_FORMAT}`
                    : `https://image.mux.com/${p.playbackId}/thumbnail.jpg?width=${imgWidth}&fit_mode=preserve`
                }
                alt={p.title || `page ${i + 1}`}
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
