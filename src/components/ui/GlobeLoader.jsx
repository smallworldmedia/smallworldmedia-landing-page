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
 * Not wired into any real loading flow (Nathan's call, after review).
 * <GlobeLoaderStage /> is the /lab/loader review harness: tap to replay, the
 * ?loader… dials (docs/tunables-guide.md), the timing readout.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function GlobeLoader({ timing, lowercase = false, className = '' }) {
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

  useEffect(() => {
    const svg = svgRef.current;
    const root = rootRef.current;
    if (!svg || !root || !svg.pauseAnimations) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      svg.setCurrentTime(t.drawEnd); // the finished globe, held
      svg.pauseAnimations();
      return undefined;
    }
    let onScreen = false;
    let tabShown = !document.hidden;
    const sync = () => (onScreen && tabShown ? svg.unpauseAnimations() : svg.pauseAnimations());
    svg.pauseAnimations();
    svg.setCurrentTime(0);
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
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [t]);

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
function readDials() {
  const raw = params().get('loaderreplay');
  return {
    timing: {
      meridianStaggerMs: num('loadermstag', DEFAULT_TIMING.meridianStaggerMs),
      drawMs: num('loaderdraw', DEFAULT_TIMING.drawMs),
      parallelStaggerMs: num('loaderpstag', DEFAULT_TIMING.parallelStaggerMs),
      spin: num('loaderspin', DEFAULT_TIMING.spin),
    },
    lowercase: str('loadercase', 'upper') === 'lower',
    // ?loaderreplay alone loops the draw-in every 6 s; ?loaderreplay=9 every 9 s
    autoReplayS: raw === null ? 0 : parseFloat(raw) > 0 ? parseFloat(raw) : 6,
  };
}

export function GlobeLoaderStage() {
  const [dials] = useState(readDials);
  const [run, setRun] = useState(0);
  const replay = () => setRun((n) => n + 1);
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
      <GlobeLoader key={run} timing={dials.timing} lowercase={dials.lowercase} />
      <p className="globe-loader-stage__readout">
        tap to replay
        <br />
        meridians {meridianStaggerMs}ms · draw {drawMs}ms · parallels {parallelStaggerMs}ms · spin ×{spin}
      </p>
    </div>
  );
}
