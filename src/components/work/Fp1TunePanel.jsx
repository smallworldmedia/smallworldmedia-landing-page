/**
 * Fp1TunePanel — DEV-ONLY live tuning bench for the HOUSE PULSE CURVE, demoed
 * on the FP-1 enter_world dim. Rendered by FeaturedProjects only when
 * `?fp1tune=1` (FP1_TUNE_ACTIVE); absent otherwise, so it never touches the
 * shipped pulse.
 *
 * Sliders write the shared fp1Tune state, which publishes → WorldCard
 * re-creates the live CustomEase pulse on the visible CTA. The panel also
 * plots the current curve (one hit, 0..1), shows the generated path string,
 * and copies the values to hand back for baking as the house token.
 *
 * Voice/chrome mirrors the globe debug panel (mono, near-black, lowercase).
 */
import { useState } from 'react';
import {
  getFp1State,
  setFp1,
  resetFp1,
  buildHousePulsePath,
  fp1CopyBlock,
  fp1TuneUrl,
} from './fp1Tune.js';
import { PREFERS_REDUCED_MOTION } from './world/worldConfig.js';

// One labeled slider row. Writes the shared state (which drives WorldCard's
// live pulse) and mirrors into local React state so the input stays controlled.
function Row({ label, param, value, min, max, step, fmt, onChange }) {
  return (
    <label className="fp1-tune__row">
      <span className="fp1-tune__key">
        {label}
        <span className="fp1-tune__val">{fmt ? fmt(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(param, Number(e.target.value))}
      />
    </label>
  );
}

export default function Fp1TunePanel() {
  // Local mirror of the shared tuning state (seeded from it, incl. URL seed).
  const [s, setS] = useState(() => ({ ...getFp1State() }));
  const [copied, setCopied] = useState(null); // 'block' | 'url' | null

  const set = (key, value) => {
    setFp1(key, value); // → publish → WorldCard rebuilds the live pulse
    setS((prev) => ({ ...prev, [key]: value }));
  };
  const reset = () => {
    resetFp1();
    setS({ ...getFp1State() });
  };

  const copy = async (kind) => {
    const text = kind === 'url' ? fp1TuneUrl() : fp1CopyBlock();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('copy:', text); // clipboard blocked — fall back to a prompt
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 1200);
  };

  const path = buildHousePulsePath(s);

  // Plot geometry: a unit-space <g> maps (x,y)∈[0,1] into the padded box, y up.
  const W = 240;
  const H = 132;
  const pad = 10;
  const iw = W - 2 * pad;
  const ih = H - 2 * pad;
  const ux = (x) => pad + x * iw; // unit x → svg x
  const uy = (y) => pad + ih - y * ih; // unit y → svg y (flipped)

  const num3 = (n) => (Math.round(n * 1000) / 1000).toString();

  return (
    <aside className="fp1-tune" aria-label="FP-1 house pulse tuning">
      <header className="fp1-tune__head">
        <span>fp-1 · house pulse</span>
        <button type="button" className="fp1-tune__btn" onClick={reset}>
          ↺ reset
        </button>
      </header>

      {PREFERS_REDUCED_MOTION && (
        <p className="fp1-tune__note">
          reduced-motion: the pulse is disabled — curve/plot/copy still work.
        </p>
      )}

      <svg
        className="fp1-tune__plot"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Pulse curve, one hit"
      >
        <rect
          className="fp1-tune__plot-frame"
          x={pad}
          y={pad}
          width={iw}
          height={ih}
        />
        {/* peak (y=1) guide */}
        <line
          className="fp1-tune__plot-guide"
          x1={pad}
          y1={uy(1)}
          x2={pad + iw}
          y2={uy(1)}
        />
        {/* peakX + holdEnd verticals */}
        <line
          className="fp1-tune__plot-guide"
          x1={ux(s.peakX)}
          y1={pad}
          x2={ux(s.peakX)}
          y2={pad + ih}
        />
        <line
          className="fp1-tune__plot-guide"
          x1={ux(s.holdEndX)}
          y1={pad}
          x2={ux(s.holdEndX)}
          y2={pad + ih}
        />
        {/* the curve itself, drawn in unit space */}
        <g transform={`translate(${pad}, ${pad + ih}) scale(${iw}, ${-ih})`}>
          <path
            className="fp1-tune__plot-curve"
            d={path}
            fill="none"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>

      <div className="fp1-tune__group">attack</div>
      <Row
        label="peak x"
        param="peakX"
        value={s.peakX}
        min={0.02}
        max={0.6}
        step={0.005}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="softness"
        param="attackSoft"
        value={s.attackSoft}
        min={0}
        max={1}
        step={0.01}
        fmt={num3}
        onChange={set}
      />

      <div className="fp1-tune__group">hold</div>
      <Row
        label="hold end x"
        param="holdEndX"
        value={s.holdEndX}
        min={s.peakX}
        max={0.95}
        step={0.005}
        fmt={num3}
        onChange={set}
      />

      <div className="fp1-tune__group">fall</div>
      <Row
        label="fall ease"
        param="fallEase"
        value={s.fallEase}
        min={0}
        max={1}
        step={0.01}
        fmt={num3}
        onChange={set}
      />

      <div className="fp1-tune__group">envelope</div>
      <Row
        label="period s"
        param="period"
        value={s.period}
        min={1}
        max={8}
        step={0.1}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="dim opacity"
        param="dim"
        value={s.dim}
        min={0}
        max={1}
        step={0.01}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="rest beat s"
        param="rest"
        value={s.rest}
        min={0}
        max={2}
        step={0.05}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="on-ratio"
        param="onRatio"
        value={s.onRatio}
        min={0.2}
        max={0.8}
        step={0.05}
        fmt={num3}
        onChange={set}
      />
      <p className="fp1-tune__note">rest beat previews on entrance / a Turn.</p>

      <label className="fp1-tune__path">
        HOUSE_PULSE_PATH
        <textarea readOnly rows={2} value={path} onFocus={(e) => e.target.select()} />
      </label>

      <div className="fp1-tune__actions">
        <button type="button" className="fp1-tune__btn" onClick={() => copy('block')}>
          {copied === 'block' ? '✓ copied' : 'copy values'}
        </button>
        <button type="button" className="fp1-tune__btn" onClick={() => copy('url')}>
          {copied === 'url' ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
