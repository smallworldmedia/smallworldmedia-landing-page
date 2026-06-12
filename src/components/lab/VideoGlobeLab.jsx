/**
 * VideoGlobeLab — /lab/globe prototype island.
 *
 * Hosts the WebGL globe scene and a lab-only debug panel:
 *  - cascade variant switcher + replay
 *  - gap / cap geometry sliders (commit on release — each commit rebuilds
 *    the scene, so live-dragging would churn WebGL contexts)
 *  - FPS / texture-count / prominence readout
 *
 * @param {Object} props
 * @param {Array} props.assets - mediaAsset pool from GLOBE_ASSETS_QUERY
 */
import { useRef, useState } from 'react';
import useGlobeScene from './globe/useGlobeScene.js';
import VideoSlotPool from './VideoSlotPool.jsx';
import { CASCADE_VARIANTS, DEFAULT_CASCADE_VARIANT } from './globe/cascade.js';
import { GAP_DEG, CAP_DEG, PREFERS_REDUCED_MOTION } from './globe/globeConfig.js';

/** Debug panel: always in dev, ?debug in production builds */
const SHOW_DEBUG =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug'));

export default function VideoGlobeLab({ assets }) {
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

  const api = useGlobeScene(containerRef, assets, gapDeg, capDeg, variantRef, setStats, poolRef);

  const selectVariant = (v) => {
    variantRef.current = v;
    setVariant(v);
    api.current.replayCascade(v);
  };

  return (
    <div className="lab-globe-page">
      <div ref={containerRef} className="lab-globe-page__canvas" />
      {!PREFERS_REDUCED_MOTION && <VideoSlotPool ref={poolRef} />}

      {SHOW_DEBUG && (
      <aside className="lab-globe-debug" aria-label="Globe debug controls">
        <div className="lab-globe-debug__row">
          {CASCADE_VARIANTS.map((v) => (
            <button
              key={v}
              type="button"
              className={`lab-globe-debug__btn${v === variant ? ' is-active' : ''}`}
              onClick={() => selectVariant(v)}
            >
              {v}
            </button>
          ))}
          <button
            type="button"
            className="lab-globe-debug__btn"
            onClick={() => api.current.replayCascade(variantRef.current)}
          >
            ↺ replay
          </button>
        </div>

        <label className="lab-globe-debug__slider">
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

        <label className="lab-globe-debug__slider">
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

        <div className="lab-globe-debug__stats">
          <span>fps {stats?.fps ?? '—'}</span>
          <span>tex {stats?.textures ?? '—'}</span>
          <span>live {stats?.live ?? 0}+{stats?.pending ?? 0}</span>
          <span>pool {assets?.length ?? 0}</span>
        </div>
        {stats?.topPanels && (
          <div className="lab-globe-debug__panels">{stats.topPanels.join(' ')}</div>
        )}
      </aside>
      )}
    </div>
  );
}
