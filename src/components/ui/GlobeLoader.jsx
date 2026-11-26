/**
 * GlobeLoader — the lockup globe as a loader (SQ-31).
 *
 * The outline ring is there from frame 0. The meridians then draw in
 * left to right, each from the pole end outward (trim-path: pathLength 1 with
 * an animated stroke-dashoffset), the parallels follow top to bottom, and once
 * the last line is in the globe turns about its polar axis at /process's
 * O_SPIN_DPS. Only the meridians move (the parallels are rotation-invariant);
 * their path data per one 40° step is precomputed by globeLoaderGeometry.js and
 * played as SMIL <animate attributeName="d" repeatCount="indefinite">, so the
 * browser interpolates and no JS runs per frame. SVG only, no canvas, no WebGL.
 *
 * Rotation starts when the draw-in ends (running it throughout would blur the
 * left-to-right order, because every meridian drifts left while it draws).
 *
 * Cost gates: the timeline pauses while the loader is off screen
 * (IntersectionObserver) and while the document is hidden; under
 * prefers-reduced-motion it parks on the finished, static globe.
 *
 * RouteFill's cover layer mounts it (SQ-32) for home → /work and FP card → detail,
 * driving the handle below. <GlobeLoaderStage /> is the /lab/loader review harness: tap to replay, the
 * ?loader… dials (docs/tunables-guide.md), the timing readout.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import '../../styles/globe-loader.css';
import {
  VIEWBOX,
  RING,
  LINE_W,
  MERIDIANS,
  PARALLELS_DEG,
  HIDDEN_OFFSET,
  DEFAULT_TIMING,
  buildTimeline,
  restFrame,
  meridianKeyframes,
} from '../../lib/globeLoaderGeometry.js';

// The house draw curve (--ease-draw, an expo-out) as a SMIL spline.
const DRAW_SPLINE = '0.16 1 0.3 1';

/**
 * Props
 *   timing     { meridianStaggerMs, drawMs, parallelStaggerMs, spin } (any subset;
 *              defaults are DEFAULT_TIMING). A short transition shortens the draw-in
 *              by lowering these; globeLoaderGeometry's buildTimeline(timing).drawEnd
 *              is the draw-in length in seconds. readLoaderDials() gives the ?loader… values.
 *   active     true (default) plays on mount; flip false → true to replay, true → false to stop.
 *   ref        { start(), replay(), stop() } for a parent that drives it imperatively.
 *   lowercase  the words as typed ("world" / "loading", Nathan 11-08; the default);
 *              false wears the label's uppercase.
 *   className  extra class on the root.
 * The root is one inline flex column, sized by --globe-loader-size (default 240px):
 * it assumes nothing about owning the page, so it mounts inside any positioned layer
 * (a fixed cover, a card). Position and fade it from the parent.
 */
export default function GlobeLoader({ timing, lowercase = true, className = '', active = true, ref }) {
  const rootRef = useRef(null);
  const svgRef = useRef(null);
  const { meridianStaggerMs, drawMs, parallelStaggerMs, spin } = { ...DEFAULT_TIMING, ...timing };
  const t = useMemo(
    () => buildTimeline({ meridianStaggerMs, drawMs, parallelStaggerMs, spin }),
    [meridianStaggerMs, drawMs, parallelStaggerMs, spin],
  );
  const frame = useMemo(restFrame, []);
  const keyframes = useMemo(
    () =>
      t.spinning
        ? Array.from({ length: MERIDIANS }, (_, k) => meridianKeyframes(k, { direction: t.direction }).join(';'))
        : null,
    [t.spinning, t.direction],
  );
  const meridianBegin = useMemo(() => Object.fromEntries(t.meridians.map((m) => [m.k, m.begin])), [t]);
  const parallelBegin = useMemo(() => Object.fromEntries(t.parallels.map((p) => [p.j, p.begin])), [t]);

  // The timeline controller: start / replay / stop, behind the visibility gates.
  const ctl = useRef({ start() {}, stop() {} });
  useImperativeHandle(
    ref,
    () => ({
      /** Draw in from the top (also the replay). */
      start: () => ctl.current.start(),
      replay: () => ctl.current.start(),
      /** Halt and reset: lines hidden again, ring and words stay. Free to start() again. */
      stop: () => ctl.current.stop(),
    }),
    [],
  );

  useEffect(() => {
    const svg = svgRef.current;
    const root = rootRef.current;
    if (!svg || !root || !svg.pauseAnimations) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.setCurrentTime(t.drawEnd); // the finished globe, held; start/stop are no-ops
      svg.pauseAnimations();
      ctl.current = { start() {}, stop() {} };
      return undefined;
    }
    let running = false;
    let onScreen = false;
    let tabShown = !document.hidden;
    const sync = () => (running && onScreen && tabShown ? svg.unpauseAnimations() : svg.pauseAnimations());
    ctl.current = {
      start() {
        svg.setCurrentTime(0);
        running = true;
        sync();
      },
      stop() {
        running = false;
        svg.setCurrentTime(0);
        sync();
      },
    };
    ctl.current.stop(); // parked at frame 0 until started
    const io = new IntersectionObserver((entries) => {
      onScreen = entries[entries.length - 1].isIntersecting;
      sync();
    });
    io.observe(root);
    const onVisibility = () => {
      tabShown = !document.hidden;
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (activeRef.current) ctl.current.start();
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [t]);

  // `active` drives it declaratively: flip false → true to (re)play, true → false to stop.
  const activeRef = useRef(active);
  activeRef.current = active;
  const firstActive = useRef(true);
  useEffect(() => {
    if (firstActive.current) {
      firstActive.current = false; // the mount effect above already honoured the initial value
      return;
    }
    if (active) ctl.current.start();
    else ctl.current.stop();
  }, [active]);

  const trim = (begin) => (
    <animate
      attributeName="stroke-dashoffset"
      from={HIDDEN_OFFSET}
      to="0"
      begin={`${begin.toFixed(3)}s`}
      dur={`${t.draw}s`}
      fill="freeze"
      calcMode="spline"
      keyTimes="0;1"
      keySplines={DRAW_SPLINE}
    />
  );
  // pathLength 1 normalises every line; dasharray "1 3" keeps the pattern's next dash far off the path.
  const trimmed = { pathLength: 1, strokeDasharray: '1 3', strokeDashoffset: HIDDEN_OFFSET };

  return (
    <div
      ref={rootRef}
      className={`globe-loader${lowercase ? ' globe-loader--lower' : ''}${className ? ` ${className}` : ''}`}
      role="status"
      aria-label="world loading"
    >
      <p className="route-fill__loader-label globe-loader__label" aria-hidden="true">
        world
      </p>
      <svg
        ref={svgRef}
        className="globe-loader__svg"
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        aria-hidden="true"
        focusable="false"
      >
        <g strokeWidth={LINE_W}>
          {frame.meridians.map((d, k) => (
            <path key={`m${k}`} d={d} {...trimmed}>
              {trim(meridianBegin[k])}
              {keyframes && (
                <animate
                  attributeName="d"
                  values={keyframes[k]}
                  begin={`${t.drawEnd.toFixed(3)}s`}
                  dur={`${t.stepSeconds}s`}
                  repeatCount="indefinite"
                />
              )}
            </path>
          ))}
          {frame.parallels.map((d, j) => (
            <path key={`p${PARALLELS_DEG[j]}`} d={d} {...trimmed}>
              {trim(parallelBegin[j])}
            </path>
          ))}
        </g>
        <circle cx={RING.cx} cy={RING.cy} r={RING.r} strokeWidth={RING.w} />
      </svg>
      <p className="route-fill__loader-label globe-loader__label" aria-hidden="true">
        loading
      </p>
    </div>
  );
}

/* ——— /lab/loader review harness ——— */

const params = () => new URLSearchParams(window.location.search);
const num = (key, fallback) => {
  const n = parseFloat(params().get(key));
  return Number.isFinite(n) ? n : fallback;
};
const str = (key, fallback) => params().get(key) || fallback;

/** The ?loader… dials, read once when the lab page mounts. */
export function readLoaderDials() {
  const raw = params().get('loaderreplay');
  return {
    timing: {
      meridianStaggerMs: num('loadermstag', DEFAULT_TIMING.meridianStaggerMs),
      drawMs: num('loaderdraw', DEFAULT_TIMING.drawMs),
      parallelStaggerMs: num('loaderpstag', DEFAULT_TIMING.parallelStaggerMs),
      spin: num('loaderspin', DEFAULT_TIMING.spin),
    },
    lowercase: str('loadercase', 'lower') !== 'upper',
    // ?loaderreplay alone loops the draw-in every 6 s; ?loaderreplay=9 every 9 s
    autoReplayS: raw === null ? 0 : parseFloat(raw) > 0 ? parseFloat(raw) : 6,
  };
}

export function GlobeLoaderStage() {
  const [dials] = useState(readLoaderDials);
  const loader = useRef(null);
  const replay = () => loader.current?.replay(); // the same entry point SQ-32 will use
  useEffect(() => {
    if (!dials.autoReplayS) return undefined;
    const id = setInterval(replay, dials.autoReplayS * 1000);
    return () => clearInterval(id);
  }, [dials.autoReplayS]);
  const { meridianStaggerMs, drawMs, parallelStaggerMs, spin } = dials.timing;
  return (
    <div
      className="globe-loader-stage"
      role="button"
      tabIndex={0}
      aria-label="Replay the loader"
      onClick={replay}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && replay()}
    >
      <GlobeLoader ref={loader} timing={dials.timing} lowercase={dials.lowercase} />
      <p className="globe-loader-stage__readout">
        tap to replay
        <br />
        meridians {meridianStaggerMs}ms · draw {drawMs}ms · parallels {parallelStaggerMs}ms · spin ×{spin}
      </p>
    </div>
  );
}
