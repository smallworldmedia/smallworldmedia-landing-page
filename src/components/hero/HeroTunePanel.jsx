/**
 * HeroTunePanel — DEV-ONLY live tuning bench for the HOME HERO camera rig.
 * Rendered by Hero only when `?herotune=1` (HERO_TUNE_ACTIVE); absent
 * otherwise, so it never touches the shipped hero.
 *
 * Sliders write the shared heroConfig TUNING, which publishes → Hero's rig
 * effect stamps the values onto the live scene rig (rigRef.current.rig) and
 * re-applies — the framing moves on the next paint, no reload. The ring
 * sliders skip the rig entirely: ScrollRing reads TUNING live per frame, so
 * they move just as immediately. The commit knobs are read by Hero AT
 * commit time — they shape the next dry-run/commit, not a live one.
 * copy_url serializes only non-default values (fp1Tune convention).
 * Carries the comp section (fill / fit / offset / elevation), the ring
 * section (radius / speed / lean, plus the URL-only ringmobile / ringtext
 * readouts), the commit section (length / fill mode / blue cascade /
 * recenter / zoom windows + the dry-run trigger — Hero passes onDryRun)
 * and the intro section (chunk 5: variant / A-script timing / lattice ink
 * + ↻ replay intro — Hero passes onReplayIntro, which re-mounts the
 * machine; the live-video scheduler can't re-hold mid-session, so replays
 * run over live video — accepted), plus the labels section (chunk 6: the
 * flag-gated blob-tracking chips — the toggle mounts/unmounts the layer
 * live, max rebuilds the slots, hold applies from the next cycle).
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
  RING_MOBILE,
  RING_TEXT,
  FILL_MODES,
  BLUE_CASCADES,
  INTRO_VARIANTS,
} from './heroConfig.js';
import { FILL_FRACTION, FIT_COVER, IS_MOBILE } from '../globe/globeConfig.js';

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

// One labeled segmented row — the commit modes (the bench's only
// non-slider inputs). Same write path as Row.
function Segmented({ label, param, value, options, onChange }) {
  return (
    <div className="hero-tune__row">
      <span className="hero-tune__key">{label}</span>
      <div className="hero-tune__seg">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`hero-tune__btn${opt === value ? ' is-active' : ''}`}
            onClick={() => onChange(param, opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

const num3 = (n) => (Math.round(n * 1000) / 1000).toString();

export default function HeroTunePanel({ rigRef, onDryRun, onReplayIntro }) {
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
        fit:{' '}
        {s.fitCover == null
          ? `device (${FIT_COVER ? 'cover' : 'contain'})`
          : s.fitCover
            ? 'cover'
            : 'contain'}{' '}
        — ?herofit=contain|cover. reset returns the resting-comp defaults for
        this device/variant (device fill is {num3(FILL_FRACTION)}, fit{' '}
        {FIT_COVER ? 'cover' : 'contain'} here).
      </p>

      <div className="hero-tune__group">ring</div>
      <Row
        label="radius ×disc"
        param="ringR"
        value={s.ringR}
        min={0.9}
        max={1.6}
        step={0.01}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="speed °/s"
        param="ringSpeed"
        value={s.ringSpeed}
        min={0}
        max={15}
        step={0.5}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="lean"
        param="ringLean"
        value={s.ringLean}
        min={0}
        max={0.3}
        step={0.005}
        fmt={num3}
        onChange={set}
      />
      <p className="hero-tune__note">
        ringmobile: {RING_MOBILE ? '1 (ring)' : '0 (micro cta)'}
        {IS_MOBILE ? '' : ' — desktop always rings'} · text: {RING_TEXT} — both
        URL-only (?ringmobile ?ringtext), reload to change.
      </p>

      <div className="hero-tune__group">commit</div>
      <Row
        label="commit ms"
        param="commitMs"
        value={s.commitMs}
        min={400}
        max={3000}
        step={50}
        onChange={set}
      />
      <Segmented
        label="fill mode"
        param="fillMode"
        value={s.fillMode}
        options={FILL_MODES}
        onChange={set}
      />
      <Segmented
        label="blue cascade"
        param="blueCascade"
        value={s.blueCascade}
        options={BLUE_CASCADES}
        onChange={set}
      />
      <Row
        label="recenter end"
        param="recenterEnd"
        value={s.recenterEnd}
        min={0.05}
        max={1}
        step={0.05}
        fmt={num3}
        onChange={set}
      />
      <Row
        label="zoom start"
        param="zoomStart"
        value={s.zoomStart}
        min={0}
        max={0.9}
        step={0.05}
        fmt={num3}
        onChange={set}
      />
      <p className="hero-tune__note">
        blue cascade drives fill mode panels only. ease: house turn curve —
        ?commitease=&lt;path&gt; URL-only, reload to change. dry-run plays the
        full commit then releases everything — no navigation.
      </p>
      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={onDryRun}>
          ▶ commit dry-run
        </button>
      </div>

      <div className="hero-tune__group">intro</div>
      <Segmented
        label="variant"
        param="intro"
        value={s.intro}
        options={INTRO_VARIANTS}
        onChange={set}
      />
      <Row
        label="intro ms"
        param="introMs"
        value={s.introMs}
        min={2500}
        max={8000}
        step={100}
        onChange={set}
      />
      <Row
        label="hold ms"
        param="introHoldMs"
        value={s.introHoldMs}
        min={0}
        max={2000}
        step={50}
        onChange={set}
      />
      <Row
        label="cascade at ms"
        param="introCascadeMs"
        value={s.introCascadeMs}
        min={600}
        max={3000}
        step={50}
        onChange={set}
      />
      <Segmented
        label="lattice ink"
        param="heroInk"
        value={s.heroInk ? 'on' : 'off'}
        options={['on', 'off']}
        onChange={(param, opt) => set(param, opt === 'on')}
      />
      <p className="hero-tune__note">
        timing rows shape variant a (chars-in is fixed; the zoom fills the
        rest of intro ms); c keeps its authored ~3.2s script. ease:
        ?introease=&lt;path&gt; URL-only. replay re-mounts the machine — the
        live-video scheduler is already running by then, so replays play
        over live tiles (the once-per-session hold can&apos;t rewind).
      </p>
      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={onReplayIntro}>
          ↻ replay intro
        </button>
      </div>

      <div className="hero-tune__group">labels</div>
      <Segmented
        label="labels"
        param="labels"
        value={s.labels ? 'on' : 'off'}
        options={['on', 'off']}
        onChange={(param, opt) => set(param, opt === 'on')}
      />
      <Row
        label="max chips"
        param="labelMax"
        value={s.labelMax}
        min={1}
        max={4}
        step={1}
        onChange={set}
      />
      <Row
        label="hold s"
        param="labelHold"
        value={s.labelHold}
        min={0.5}
        max={6}
        step={0.1}
        fmt={num3}
        onChange={set}
      />
      <p className="hero-tune__note">
        shipped OFF — chips latch onto live panels between the chrome beat
        and a commit (?herolabels=1 forces on). max rebuilds the layer;
        hold applies from each chip&apos;s next cycle.
      </p>

      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={copyUrl}>
          {copied ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
