/**
 * LenisTunePanel — DEV-ONLY live tuning bench for the house SCROLL FEEL (Lenis),
 * the A2b dial. Rendered by SiteShell only when `?lenistune=1`
 * (LENIS_TUNE_ACTIVE); absent otherwise, so it never touches shipped scroll.
 *
 * Sliders write the shared lenisTune state, which pushes straight onto the live
 * Lenis instance (getLenis().options.*) — so a drag changes the feel on the
 * very next scroll, no reload. copy_values emits the LENIS_TUNING block to bake
 * in motion.js. Lenis is off on /work (the island owns the wheel) and under
 * reduced motion; the panel says so and keeps copy/url working.
 *
 * Voice/chrome mirror the fp1Tune bench (mono, near-black, lowercase).
 *
 * SiteShell import()s this module, so its JS is its own chunk. lenis-tune.css
 * deliberately stays imported from BaseLayout — see the note there for why
 * moving it here does not take it off the critical path.
 */
import { useState, useEffect } from 'react';
import {
  getLenisTuneState,
  setLenisTune,
  resetLenisTune,
  subscribeLenisTune,
  isLenisLive,
  lenisMode,
  lenisCopyBlock,
  lenisTuneUrl,
} from '../lib/lenisTune.js';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// One labeled slider row. Writes the shared state (which drives the live Lenis)
// and mirrors into local React state so the input stays controlled.
function Row({ label, param, value, min, max, step, fmt, onChange }) {
  return (
    <label className="lenis-tune__row">
      <span className="lenis-tune__key">
        {label}
        <span className="lenis-tune__val">{fmt ? fmt(value) : value}</span>
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

export default function LenisTunePanel() {
  // Local mirror of the shared tuning state (seeded from it, incl. URL seed).
  const [s, setS] = useState(() => ({ ...getLenisTuneState() }));
  const [, tick] = useState(0); // bump to refresh the live/off + mode readout
  const [copied, setCopied] = useState(null); // 'block' | 'url' | null

  // Subscribe: route swaps re-apply the tune + publish, so the readout tracks
  // whether Lenis drives the current route.
  useEffect(() => subscribeLenisTune(() => tick((n) => n + 1)), []);

  const set = (key, value) => {
    setLenisTune(key, value); // → live Lenis
    setS((prev) => ({ ...prev, [key]: value }));
  };
  const reset = () => {
    resetLenisTune();
    setS({ ...getLenisTuneState() });
  };

  const copy = async (kind) => {
    const text = kind === 'url' ? lenisTuneUrl() : lenisCopyBlock();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('copy:', text); // clipboard blocked — fall back to a prompt
    }
    setCopied(kind);
    setTimeout(() => setCopied(null), 1200);
  };

  const live = isLenisLive();
  const durationOn = s.duration > 0;

  return (
    <aside className="lenis-tune" aria-label="A2b Lenis scroll tuning">
      <header className="lenis-tune__head">
        <span>a2b · lenis scroll</span>
        <button type="button" className="lenis-tune__btn" onClick={reset}>
          ↺ reset
        </button>
      </header>

      <p className="lenis-tune__note">
        {live ? (
          <>live · {lenisMode()}</>
        ) : (
          <>lenis off here — open a project page to dial (it owns no wheel on /work).</>
        )}
      </p>
      {prefersReducedMotion && (
        <p className="lenis-tune__note">
          reduced-motion: lenis never inits — copy/url still work.
        </p>
      )}

      <div className="lenis-tune__group">inertia</div>
      <Row
        label="lerp"
        param="lerp"
        value={s.lerp}
        min={0.02}
        max={0.3}
        step={0.005}
        fmt={num3}
        onChange={set}
      />
      {durationOn && (
        <p className="lenis-tune__note">
          duration &gt; 0 overrides lerp — set it to 0 to dial lerp.
        </p>
      )}

      <div className="lenis-tune__group">wheel</div>
      <Row
        label="wheel mult"
        param="wheelMultiplier"
        value={s.wheelMultiplier}
        min={0.5}
        max={2}
        step={0.05}
        fmt={num3}
        onChange={set}
      />

      <div className="lenis-tune__group">duration mode</div>
      <Row
        label="duration s"
        param="duration"
        value={s.duration}
        min={0}
        max={2}
        step={0.05}
        fmt={num3}
        onChange={set}
      />
      <p className="lenis-tune__note">
        0 = off (lerp inertia). &gt; 0 = fixed-length settle, overrides lerp.
      </p>

      <label className="lenis-tune__path">
        LENIS_TUNING
        <textarea
          readOnly
          rows={durationOn ? 3 : 3}
          value={lenisCopyBlock()}
          onFocus={(e) => e.target.select()}
        />
      </label>

      <div className="lenis-tune__actions">
        <button type="button" className="lenis-tune__btn" onClick={() => copy('block')}>
          {copied === 'block' ? '✓ copied' : 'copy values'}
        </button>
        <button type="button" className="lenis-tune__btn" onClick={() => copy('url')}>
          {copied === 'url' ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
