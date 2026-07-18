/**
 * HeroTunePanel — DEV-ONLY live tuning bench for the HOME HERO camera rig.
 * Rendered by Hero only when `?herotune=1` (HERO_TUNE_ACTIVE); absent
 * otherwise, so it never touches the shipped hero.
 *
 * Sliders write the shared heroConfig TUNING, which publishes → Hero's rig
 * effect stamps the values onto the live scene rig (rigRef.current.rig) and
 * re-applies — the framing moves on the next paint, no reload. copy_url
 * serializes only non-default values (fp1Tune convention). This chunk
 * carries the comp section (fill / offset / elevation); intro/ring/commit/
 * label sections arrive with their chunks.
 *
 * Voice/chrome mirror the lenisTune bench (mono, near-black, lowercase).
 * Sits TOP-RIGHT — lenistune and the globe ?debug panel own bottom-left,
 * fp1tune bottom-right — so every bench can coexist.
 */
import { useState } from 'react';
import {
  TUNING,
  setHeroTune,
  resetHeroTune,
  heroTuneCopyUrl,
} from './heroConfig.js';
import { FILL_FRACTION } from '../globe/globeConfig.js';

// One labeled slider row. Writes the shared state (which drives the live rig
// via Hero's effect) and mirrors into local React state so the input stays
// controlled.
function Row({ label, param, value, min, max, step, fmt, onChange }) {
  return (
    <label className="hero-tune__row">
      <span className="hero-tune__key">
        {label}
        <span className="hero-tune__val">{fmt ? fmt(value) : value}</span>
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

const num3 = (n) => (Math.round(n * 1000) / 1000).toString();

export default function HeroTunePanel({ rigRef }) {
  // Local mirror of the shared tuning state (seeded from it, incl. URL seed).
  const [s, setS] = useState(() => ({ ...TUNING }));
  const [copied, setCopied] = useState(false);

  const set = (key, value) => {
    setHeroTune(key, value); // → publish → Hero's rig effect re-applies
    setS((prev) => ({ ...prev, [key]: value }));
  };
  const reset = () => {
    resetHeroTune();
    setS({ ...TUNING });
  };

  const copyUrl = async () => {
    const text = heroTuneCopyUrl();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('copy:', text); // clipboard blocked — fall back to a prompt
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  // The panel mounts after hydration (Hero's gate), by which point the scene
  // effect has published the rig handle — but say so if it hasn't.
  const rigLive = rigRef?.current != null;
  const deviceFill = s.fill == null;

  return (
    <aside className="hero-tune" aria-label="Home hero camera rig tuning">
      <header className="hero-tune__head">
        <span>hero · camera rig</span>
        <button type="button" className="hero-tune__btn" onClick={reset}>
          ↺ reset
        </button>
      </header>

      <p className="hero-tune__note">
        {rigLive
          ? 'live — sliders re-frame on the next paint.'
          : 'rig not up yet — values apply once the globe mounts.'}
      </p>

      <div className="hero-tune__group">comp</div>
      <Row
        label={deviceFill ? 'fill (device)' : 'fill'}
        param="fill"
        value={s.fill ?? FILL_FRACTION}
        min={0.5}
        max={1.6}
        step={0.01}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="offset x"
        param="offsetX"
        value={s.offsetX}
        min={-1}
        max={1}
        step={0.01}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="offset y"
        param="offsetY"
        value={s.offsetY}
        min={-1}
        max={1}
        step={0.01}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="elev deg"
        param="elevDeg"
        value={s.elevDeg}
        min={0}
        max={30}
        step={0.5}
        fmt={num3}
        onChange={set}
      />
      <p className="hero-tune__note">
        reset returns fill to the device FILL_FRACTION ({num3(FILL_FRACTION)} here).
      </p>

      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={copyUrl}>
          {copied ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
