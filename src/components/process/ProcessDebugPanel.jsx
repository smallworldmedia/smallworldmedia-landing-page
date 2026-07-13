/**
 * ProcessDebugPanel — the ?debug live-tuning chrome (spec §6: mounts on
 * the gated route itself — no /lab/process to maintain).
 *
 * Sliders mutate the shared TUNING object and call scene.applyTuning():
 * framing / belt spread / drift / glow apply instantly; durations, orders,
 * hops and rhythm apply to the next transition — jump a stage or hit
 * ↻ replay to hear them. copy_url serializes the non-default knobs back
 * into a shareable query string (the bake-in path: paste the values into
 * TUNING_DEFAULTS once dialed).
 */
import { useEffect, useState } from 'react';
import { TUNING, TUNING_DEFAULTS, RHYTHM_PATTERNS } from './processConfig.js';

const STAGES = ['stage-01', 'stage-02', 'stage-03', 'stage-04', 'stage-05'];

/* Slider knobs: key into TUNING, URL param name, range. `ms` knobs are
   stored in seconds but travel as milliseconds in the URL (spec §9). */
const SLIDERS = [
  { key: 'scatter', param: 'scatter', min: 0.8, max: 3.2, step: 0.05 },
  { key: 'drift', param: 'drift', min: 0, max: 0.4, step: 0.005 },
  { key: 'idlePower', param: 'idlepower', min: 0, max: 1, step: 0.02 },
  { key: 'strokePx', param: 'stroke', min: 0, max: 4, step: 0.25 },
  { key: 'fillFraction', param: 'fillfrac', min: 0.4, max: 1.2, step: 0.01 },
  { key: 's3Fill', param: 's3fill', min: 0.2, max: 1, step: 0.01 },
  { key: 's45Fill', param: 's45fill', min: 0.5, max: 1.3, step: 0.01 },
  { key: 'stageSeconds', param: 'stagems', min: 0.4, max: 3, step: 0.05, ms: true },
  { key: 'zoomOutSeconds', param: 'zoomout', min: 0.3, max: 2.5, step: 0.05 },
  { key: 'threadHops', param: 'threadhops', min: 3, max: 84, step: 1 },
  { key: 'threadHopSeconds', param: 'threadms', min: 0.05, max: 2, step: 0.05, ms: true },
  { key: 'assembleSeconds', param: 'assemble', min: 0.5, max: 5, step: 0.1 },
  { key: 'emanateScale', param: 'emanate', min: 1, max: 2.2, step: 0.05 },
  { key: 'bpm', param: 'bpm', min: 60, max: 180, step: 1 },
  { key: 'pulseMin', param: 'pulsemin', min: 0, max: 1, step: 0.01 },
  { key: 'holdBeats', param: 'hold', min: 0, max: 2, step: 0.05 },
  { key: 'decayBeats', param: 'decay', min: 0.1, max: 4, step: 0.05 },
  { key: 'mobileDrop', param: 'dropy', min: 0, max: 0.5, step: 0.02 },
  { key: 'swipePx', param: 'scroll', min: 150, max: 1200, step: 25 },
  { key: 'swipeSeconds', param: 'swipems', min: 0.4, max: 2.5, step: 0.05, ms: true },
];

const VARIANTS = ['rows', 'poles', 'sweep'];
const SELECTS = [
  { key: 'cascadeVariant', param: 'cascade', options: VARIANTS },
  { key: 'emanateOrder', param: 'emanateorder', options: VARIANTS },
  { key: 'pattern', param: 'pattern', options: RHYTHM_PATTERNS },
  { key: 'swipe', param: 'swipe', options: ['on', 'off'] },
];

const knobLabel = (def) => `?${def.param}`;
const knobValue = (def) => {
  const v = TUNING[def.key];
  return def.ms ? `${Math.round(v * 1000)}` : `${Math.round(v * 1000) / 1000}`;
};

/* Only non-default knobs serialize — the dialed-in feel as a URL. */
const buildTunedUrl = () => {
  const q = [];
  [...SLIDERS, ...SELECTS].forEach((def) => {
    const v = TUNING[def.key];
    const d = TUNING_DEFAULTS[def.key];
    const differs = typeof v === 'number' ? Math.abs(v - d) > 1e-9 : v !== d;
    if (differs) q.push(`${def.param}=${def.ms ? Math.round(v * 1000) : v}`);
  });
  return `${window.location.pathname}?debug${q.length ? `&${q.join('&')}` : ''}`;
};

export default function ProcessDebugPanel({ sceneRef }) {
  const [stats, setStats] = useState({ fps: 0, calls: 0, stage: null });
  const [, bump] = useState(0); // TUNING is the source of truth
  const [copied, setCopied] = useState(false);
  // Phones start collapsed — the full panel devours a small viewport
  const [open, setOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
  );

  useEffect(() => {
    const id = setInterval(() => setStats(sceneRef.current.getStats()), 500);
    return () => clearInterval(id);
  }, [sceneRef]);

  if (!open) {
    return (
      <aside className="process-debug process-debug--chip">
        <button type="button" onClick={() => setOpen(true)}>
          {`⌁ tune · ${stats.stage ?? '∅'} · ${stats.fps}fps`}
        </button>
      </aside>
    );
  }

  const tune = (key, value) => {
    TUNING[key] = value;
    sceneRef.current.applyTuning();
    bump((n) => n + 1);
  };

  const copyUrl = () => {
    const url = `${window.location.origin}${buildTunedUrl()}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside className="process-debug">
      <div className="process-debug__head">
        <p className="process-debug__stats">
          {`fps ${stats.fps} · draws ${stats.calls} · ${stats.stage ?? '∅'}`}
        </p>
        <button
          type="button"
          className="process-debug__close"
          aria-label="collapse tuning panel"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="process-debug__stages">
        {STAGES.map((id, i) => (
          <button
            key={id}
            type="button"
            data-active={stats.stage === id || undefined}
            onClick={() => sceneRef.current.goTo(id)}
          >
            {`0${i + 1}`}
          </button>
        ))}
        <button
          type="button"
          className="process-debug__replay"
          title="replay the current stage's transition with the live knobs"
          onClick={() => sceneRef.current.replay()}
        >
          ↻ replay
        </button>
      </div>

      <div className="process-debug__knobs">
        {SLIDERS.map((def) => (
          <label key={def.key} className="process-debug__knob">
            <span className="process-debug__knob-name">{knobLabel(def)}</span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={TUNING[def.key]}
              onChange={(e) => tune(def.key, parseFloat(e.target.value))}
            />
            <span className="process-debug__knob-value">{knobValue(def)}</span>
          </label>
        ))}
        {SELECTS.map((def) => (
          <label key={def.key} className="process-debug__knob">
            <span className="process-debug__knob-name">{knobLabel(def)}</span>
            <select
              value={TUNING[def.key]}
              onChange={(e) => tune(def.key, e.target.value)}
            >
              {def.options.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="process-debug__url">
        <button type="button" onClick={copyUrl}>
          {copied ? 'copied ✓' : 'copy_url'}
        </button>
        <code>{buildTunedUrl()}</code>
      </div>
    </aside>
  );
}
