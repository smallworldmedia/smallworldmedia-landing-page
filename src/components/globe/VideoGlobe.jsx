/**
 * VideoGlobe — the CMS video globe (production component).
 *
 * Graduated from /lab/globe: a panelized three.js sphere of the SWM globe
 * mark where every panel is a Sanity media asset; camera-facing panels
 * stream live Mux video, the rest show thumbnails. Fills its nearest
 * positioned ancestor (position: absolute inset 0) — the parent decides
 * the framing context (home hero layer, lab page shell, etc.).
 *
 * Debug tuning panel: pass `debug` (lab page does in dev) or append
 * ?debug to any URL — cascade variants, gap/cap sliders, fps/live stats.
 *
 * @param {Object} props
 * @param {Array}   props.assets - ordered pool from GLOBE_ASSETS_QUERY → buildAssetPool
 * @param {boolean} [props.debug=false] - force the debug panel on
 * @param {React.RefObject} [props.rigRef] - home-hero camera-rig handle (useGlobeScene)
 * @param {React.RefObject} [props.overlayRef] - home-hero overlay bridge (useGlobeScene)
 * @param {React.RefObject} [props.sceneApiRef] - home-hero mirror of the scene api
 *        ({ replayCascade, setBlueFill } — the chunk-4 commit drives setBlueFill)
 */
import { useRef, useState } from 'react';
import useGlobeScene from './useGlobeScene.js';
import VideoSlotPool from './VideoSlotPool.jsx';
import { CASCADE_VARIANTS, DEFAULT_CASCADE_VARIANT } from './cascade.js';
import { GAP_DEG, CAP_DEG, PREFERS_REDUCED_MOTION } from './globeConfig.js';

const hasDebugParam = () =>
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).has('debug');

export default function VideoGlobe({
  assets,
  debug = false,
  rigRef = null,
  overlayRef = null,
  sceneApiRef = null,
}) {
  const containerRef = useRef(null);
  const poolRef = useRef(null);
  const variantRef = useRef(DEFAULT_CASCADE_VARIANT);

  const [variant, setVariant] = useState(DEFAULT_CASCADE_VARIANT);
  const [gapDeg, setGapDeg] = useState(GAP_DEG);
  const [capDeg, setCapDeg] = useState(CAP_DEG);
  // Slider display values — committed to gapDeg/capDeg on pointer release
  const [pendingGap, setPendingGap] = useState(GAP_DEG);
  const [pendingCap, setPendingCap] = useState(CAP_DEG);
  const [stats, setStats] = useState(null);
  const [showDebug] = useState(() => debug || hasDebugParam());

  const api = useGlobeScene(containerRef, assets, gapDeg, capDeg, variantRef, setStats, poolRef, {
    rigRef,
    overlayRef,
  });
  // Home-hero commit bridge: mirror the scene api out to the owner (Hero
  // drives setBlueFill from its master timeline). The hook mutates
  // api.current's PROPERTIES in place — the object identity is stable — so
  // this one-time alias stays live across scene rebuilds. Null-safe: lab
  // and other callers pass nothing and are untouched (rigRef convention).
  if (sceneApiRef && sceneApiRef.current !== api.current) sceneApiRef.current = api.current;

  const selectVariant = (v) => {
    variantRef.current = v;
    setVariant(v);
    api.current.replayCascade(v);
  };

  return (
    <div className="video-globe">
      <div ref={containerRef} className="video-globe__canvas" />
      {!PREFERS_REDUCED_MOTION && <VideoSlotPool ref={poolRef} />}

      {showDebug && (
        <aside className="video-globe-debug" aria-label="Globe debug controls">
          <div className="video-globe-debug__row">
            {CASCADE_VARIANTS.map((v) => (
              <button
                key={v}
                type="button"
                className={`video-globe-debug__btn${v === variant ? ' is-active' : ''}`}
                onClick={() => selectVariant(v)}
              >
                {v}
              </button>
            ))}
            <button
              type="button"
              className="video-globe-debug__btn"
              onClick={() => api.current.replayCascade(variantRef.current)}
            >
              ↺ replay
            </button>
          </div>

          <label className="video-globe-debug__slider">
            gap {pendingGap.toFixed(1)}°
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={pendingGap}
              onChange={(e) => setPendingGap(Number(e.target.value))}
              onPointerUp={() => setGapDeg(pendingGap)}
              onKeyUp={() => setGapDeg(pendingGap)}
            />
          </label>

          <label className="video-globe-debug__slider">
            cap {pendingCap.toFixed(0)}°
            <input
              type="range"
              min="15"
              max="45"
              step="1"
              value={pendingCap}
              onChange={(e) => setPendingCap(Number(e.target.value))}
              onPointerUp={() => setCapDeg(pendingCap)}
              onKeyUp={() => setCapDeg(pendingCap)}
            />
          </label>

          <div className="video-globe-debug__stats">
            <span>fps {stats?.fps ?? '—'}</span>
            <span>tex {stats?.textures ?? '—'}</span>
            <span>live {stats?.live ?? 0}+{stats?.pending ?? 0}</span>
            <span>vis {stats?.visible ?? '—'}</span>
            <span>pool {assets?.length ?? 0}</span>
          </div>
          {stats?.topPanels && (
            <div className="video-globe-debug__panels">{stats.topPanels.join(' ')}</div>
          )}
        </aside>
      )}
    </div>
  );
}
