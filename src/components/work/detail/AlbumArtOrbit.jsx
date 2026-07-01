/**
 * AlbumArtOrbit — CSS-3D album ring (Grid Socket occupant).
 *
 * A tilted elliptical ring of cover buttons (ringMath.js placements →
 * CSS transforms in a perspective stage; the browser z-sorts via
 * preserve-3d). Motion is the momentum engine in `wrap` mode: idle drift
 * ~1 rev / 50s, drag scrubs phase, flicks decay back onto the drift, and
 * Lenis scroll velocity feeds a small additive kick while in view. The
 * front-most cover's title ticks through the catalog in a scrambling
 * blue mono caption.
 *
 * Interaction (spec § AlbumArtOrbit): click a rear cover → shortest-path
 * seek to front (decel into rest, drift breathes back in). Click the
 * front cover → Pull-out: the cover translates left and toward the
 * viewer (squares up to face-on) while the ring idles behind with a
 * traveling gap at its slot; a ReleaseCard slides in beside it over a
 * dim veil. Dismiss: click anywhere / Escape → the cover flies back to
 * wherever its slot has drifted (the pull pose blends against the live
 * ring layout, so the return tracks the moving slot).
 *
 * Housekeeping: ticker only in-viewport + document-visible; reduced
 * motion = static ring (no idle, no kicks), drag/seek/pull-out still
 * work as quick tweens. Tuning: ?orbitrev (s/rev) ?orbitkick.
 *
 * @param {Object} props
 * @param {Array<Object>} props.covers - album-art assets (≥ ORBIT_MIN)
 */
import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { createMomentum } from '../../../lib/momentum.js';
import {
  ringParams,
  ringLayout,
  frontIndex,
  targetPhaseFor,
} from '../../../lib/ringMath.js';
import { scrambleTo } from '../../../lib/scramble.js';
import { getLenis } from '../../../lib/smoothScroll.js';
import { IMG_FORMAT } from '../imageConfig.js';
import ReleaseCard from './ReleaseCard.jsx';

const COVER_IMG_WIDTH = 640; // Sanity CDN ?w= (retina at ~300px display)
const TAP_MAX_PX = 5;
const REV_PERIOD = 50; // s per idle revolution (?orbitrev)
const KICK_FACTOR = 0.02; // Lenis velocity → slots/s² (?orbitkick)
const PULL_SCALE = 1.55;
const PULL_Z = 320; // px toward the viewer when pulled

export default function AlbumArtOrbit({ covers }) {
  const count = covers.length;

  const stageRef = useRef(null);
  const captionRef = useRef(null);
  const coverEls = useRef([]);
  const engineRef = useRef(null);
  const geoRef = useRef(null);
  const pull = useRef({ index: -1, progress: 0 });
  const lastFront = useRef(-1);
  const captionTween = useRef(null);
  const suppressClick = useRef(false);
  const reducedMotion = useRef(false);
  const wakeRef = useRef(() => {});

  const [geo, setGeo] = useState(null); // triggers cover re-render on resize
  const [pulledIndex, setPulledIndex] = useState(-1);
  const pulledIndexRef = useRef(-1);

  const caption = useCallback(
    (i) => covers[i]?.releaseInfo?.releaseTitle || covers[i]?.title || '',
    [covers]
  );

  /* ── Imperative paint: ring layout + pull-pose blend + caption tick ── */
  const paint = useCallback(() => {
    const g = geoRef.current;
    const engine = engineRef.current;
    if (!g || !engine) return;

    const layout = ringLayout(count, engine.phase, g);
    const pl = pull.current;

    for (let i = 0; i < count; i++) {
      const el = coverEls.current[i];
      if (!el) continue;
      let { x, y, z, scale, opacity } = layout[i];
      // Center the ring band vertically: layout y runs [−yRange, 0]
      // (front low, rear high), so shift down by half its travel.
      y += g.yRange / 2;

      if (i === pl.index && pl.progress > 0) {
        const k = pl.progress;
        x += (g.pullX - x) * k;
        y += (-g.coverSize * 0.08 - y) * k;
        z += (PULL_Z - z) * k;
        scale += (PULL_SCALE - scale) * k;
        opacity = 1;
      }

      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      el.style.opacity = opacity.toFixed(3);
    }

    // Caption follows the front meridian (quiet while a cover is pulled).
    if (pl.index === -1) {
      const fi = frontIndex(engine.phase, count);
      if (fi !== lastFront.current && captionRef.current) {
        lastFront.current = fi;
        captionTween.current?.kill();
        captionTween.current = scrambleTo(captionRef.current, caption(fi), {
          duration: 0.45,
        });
      }
    }
  }, [count, caption]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || count === 0) return undefined;

    reducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    const params = new URLSearchParams(window.location.search);
    const qRev = parseFloat(params.get('orbitrev'));
    const qKick = parseFloat(params.get('orbitkick'));
    const revPeriod = Number.isFinite(qRev) && qRev > 0 ? qRev : REV_PERIOD;
    const kickFactor = Number.isFinite(qKick) ? qKick : KICK_FACTOR;

    const engine = createMomentum({
      mode: 'wrap',
      idleRate: reducedMotion.current ? 0 : count / revPeriod,
      flickTau: 0.9,
      seekTau: 0.55,
    });
    engineRef.current = engine;

    /* Ticker — in-viewport + document-visible; wrap idles forever unless RM */
    let inView = false;
    let ticking = false;
    const tick = (_t, dtMs) => {
      const dt = Math.min(dtMs, 100) / 1000;

      // Scroll-kick: Lenis's smoothed velocity bleeds into the spin.
      if (!reducedMotion.current && pull.current.index === -1) {
        const lv = getLenis()?.velocity ?? 0;
        if (Math.abs(lv) > 0.5) engine.kick(lv * kickFactor * dt);
      }

      engine.step(dt);
      paint();
      if (engine.isResting() && pull.current.progress === 0) stopTick();
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
        if (inView) startTick();
        else stopTick();
      },
      { rootMargin: '160px' }
    );
    io.observe(stage);

    const onVisibility = () => {
      if (document.hidden) stopTick();
      else startTick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    /* Geometry from the socket layer's rect */
    const measure = () => {
      const r = stage.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const g = ringParams(count, r.width, r.height);
      g.pullX = -Math.min(r.width * 0.2, 260); // pulled cover parks left
      geoRef.current = g;
      setGeo(g);
      paint();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    measure();

    /* Pointer drag with click discrimination. No pointer capture — it
       would retarget click events off the cover buttons; window-level
       move/up listeners track the gesture outside the stage instead. */
    let dragging = false;
    let startX = 0;
    let lastX = 0;
    let maxTravel = 0;

    const pxPerSlot = () =>
      geoRef.current ? (2 * Math.PI * geoRef.current.radius) / count : 60;

    const onWinMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      maxTravel = Math.max(maxTravel, Math.abs(e.clientX - startX));
      engine.dragBy(-dx / pxPerSlot(), performance.now());
      paint();
    };
    const onWinUp = () => {
      if (!dragging) return;
      dragging = false;
      engine.endDrag(performance.now());
      // Set before the browser dispatches the trailing click event.
      suppressClick.current = maxTravel >= TAP_MAX_PX;
      startTick();
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointercancel', onWinUp);
    };
    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      if (pull.current.index !== -1) return; // pulled state: clicks only
      dragging = true;
      startX = lastX = e.clientX;
      maxTravel = 0;
      suppressClick.current = false;
      engine.beginDrag(performance.now());
      startTick();
      window.addEventListener('pointermove', onWinMove);
      window.addEventListener('pointerup', onWinUp, { once: true });
      window.addEventListener('pointercancel', onWinUp);
    };

    stage.addEventListener('pointerdown', onPointerDown);
    wakeRef.current = startTick;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && pulledIndexRef.current !== -1) dismissRef.current();
    };
    window.addEventListener('keydown', onKeyDown);

    // Prime caption + first paint
    lastFront.current = -1;
    paint();
    startTick();

    return () => {
      stopTick();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointermove', onWinMove);
      window.removeEventListener('pointerup', onWinUp);
      window.removeEventListener('pointercancel', onWinUp);
      stage.removeEventListener('pointerdown', onPointerDown);
      wakeRef.current = () => {};
      captionTween.current?.kill();
    };
  }, [count, paint]);

  /* ── Pull-out / dismiss (progress blends against the live ring) ── */
  const dismissRef = useRef(() => {});

  const animatePull = useCallback(
    (to, onDone) => {
      gsap.killTweensOf(pull.current);
      gsap.to(pull.current, {
        progress: to,
        duration: reducedMotion.current ? 0.15 : 0.6,
        ease: 'power3.out',
        onUpdate: paint,
        onComplete: onDone,
      });
    },
    [paint]
  );

  const pullOut = useCallback(
    (i) => {
      pull.current.index = i;
      pulledIndexRef.current = i;
      setPulledIndex(i);
      animatePull(1);
    },
    [animatePull]
  );

  const dismiss = useCallback(() => {
    pulledIndexRef.current = -1;
    setPulledIndex(-1); // card + dim leave immediately
    animatePull(0, () => {
      pull.current.index = -1;
      paint();
    });
  }, [animatePull, paint]);
  dismissRef.current = dismiss;

  const onCoverClick = (i) => {
    if (suppressClick.current) return;
    const engine = engineRef.current;
    if (!engine) return;

    if (pulledIndexRef.current !== -1) {
      dismiss();
      return;
    }
    if (i === frontIndex(engine.phase, count)) {
      pullOut(i);
    } else {
      engine.goTo(
        targetPhaseFor(i, engine.phase, count),
        reducedMotion.current ? 0.12 : 0.55
      );
      wakeRef.current(); // seek needs the ticker even when RM was resting
    }
  };

  const coverSize = geo?.coverSize ?? 0;

  return (
    <div className="album-orbit">
      <div
        ref={stageRef}
        className="album-orbit__stage"
        role="group"
        aria-label="album artwork orbit"
      >
        <div
          className={`album-orbit__dim${pulledIndex !== -1 ? ' album-orbit__dim--on' : ''}`}
          onClick={dismiss}
          aria-hidden="true"
        />
        {covers.map((c, i) => (
          <button
            key={c._id}
            ref={(el) => {
              coverEls.current[i] = el;
            }}
            type="button"
            className="orbit-cover"
            style={coverSize > 0 ? { width: coverSize, height: coverSize, marginLeft: -coverSize / 2, marginTop: -coverSize / 2 } : undefined}
            onClick={() => onCoverClick(i)}
            aria-label={caption(i) || `album cover ${i + 1}`}
          >
            <img
              src={`${c.imageUrl}?w=${COVER_IMG_WIDTH}&${IMG_FORMAT}`}
              alt=""
              draggable={false}
              loading="lazy"
            />
          </button>
        ))}
        {pulledIndex !== -1 && (
          <div className="album-orbit__card">
            <ReleaseCard asset={covers[pulledIndex]} />
          </div>
        )}
      </div>
      <span ref={captionRef} className="album-orbit__caption" aria-live="polite" />
    </div>
  );
}
