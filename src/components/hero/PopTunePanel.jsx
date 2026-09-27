/**
 * PopTunePanel — DEV-ONLY bench for the home globe's POPULATION MODES
 * (docs/globe-worlds-plan.md). Rendered by Hero only when `?poptune=1`
 * (POP_TUNE_ACTIVE), lazily after hydration; absent otherwise.
 *
 * Controls write popConfig's TUNING (setPopTune → publish(key)); the scene
 * subscribes — a mode change builds/drops the PopulationDirector, a layout
 * knob re-lays the current grouping as a staggered blink. Pattern buttons
 * toggle the SET future groupings draw from; switching one ON also shows it
 * now (sceneApi.popShow). ⏭ next = the next grouping (relay: A+B → B+C),
 * ↻ reroll = a new seed (new start world + patterns). The readout polls
 * window.__swmPopStats, which the director publishes at ~2 Hz (also what
 * scripts/globe-probe.mjs reads) — it sits right under mode so it never
 * scrolls away while dialing. copy_url = poptune=1 + the seed + only
 * off-default values.
 *
 * Voice/chrome: the hero bench's .hero-tune tree (mono, near-black,
 * lowercase), BOTTOM-RIGHT via .hero-tune--pop — ?herotune owns top-right,
 * ?debug bottom-left; on phones it moves under the nav. Phones start
 * collapsed to a one-line chip (ProcessDebugPanel's rule); – collapses.
 */
import { useEffect, useState } from 'react';
import {
  TUNING,
  POP_MODES,
  POP_MEDIA,
  POP_SHARES,
  POP_PATTERNS,
  setPopTune,
  resetPopTune,
  rerollSeed,
  popTuneCopyUrl,
} from '../globe/popConfig.js';
import { WORLD_POOL_CAP } from '../globe/buildWorldPools.js';

function Row({ label, param, value, min, max, step, onChange }) {
  return (
    <label className="hero-tune__row">
      <span className="hero-tune__key">
        {label}
        <span className="hero-tune__val">{value}</span>
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

function Segmented({ label, value, options, isActive, onPick }) {
  return (
    <div className="hero-tune__row">
      <span className="hero-tune__key">{label}</span>
      <div className="hero-tune__seg">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`hero-tune__btn${(isActive ? isActive(opt) : opt === value) ? ' is-active' : ''}`}
            onClick={() => onPick(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

const pct = (n) => `${Math.round(n * 100)}%`;

export default function PopTunePanel({ sceneApiRef }) {
  const [s, setS] = useState(() => ({ ...TUNING }));
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);
  // Phones start collapsed — the full bench devours a small viewport.
  const [open, setOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
  );

  // Readout — the director's ~2 Hz publication (null while the mode is off).
  useEffect(() => {
    const id = setInterval(() => setStats(window.__swmPopStats ?? null), 500);
    return () => clearInterval(id);
  }, []);

  const on = s.mode !== 'off';

  if (!open) {
    return (
      <aside className="hero-tune hero-tune--pop hero-tune--chip" aria-label="Globe population tuning">
        <button type="button" className="hero-tune__btn" onClick={() => setOpen(true)}>
          {`⌁ worlds · ${on && stats ? `${stats.pattern} · ${pct(stats.integrity)}` : s.mode}`}
        </button>
      </aside>
    );
  }

  const set = (key, value) => {
    setPopTune(key, value);
    setS({ ...TUNING }); // setPopTune clamps — mirror what it stored
  };
  const reset = () => {
    resetPopTune();
    setS({ ...TUNING });
  };
  const reroll = () => {
    rerollSeed();
    setS({ ...TUNING });
  };
  const togglePattern = (name) => {
    const was = s.patterns.includes(name);
    if (was && s.patterns.length === 1) return; // the set never empties
    set('patterns', was ? s.patterns.filter((n) => n !== name) : [...s.patterns, name]);
    if (!was) sceneApiRef?.current?.popShow(name);
  };
  const copyUrl = async () => {
    const text = popTuneCopyUrl();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('copy:', text); // clipboard blocked — fall back to a prompt
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside className="hero-tune hero-tune--pop" aria-label="Globe population tuning">
      <header className="hero-tune__head">
        <span>globe · worlds</span>
        <span className="hero-tune__head-actions">
          <button type="button" className="hero-tune__btn" onClick={reset}>
            ↺ reset
          </button>
          <button type="button" className="hero-tune__btn" onClick={() => setOpen(false)} aria-label="Collapse">
            –
          </button>
        </span>
      </header>

      <Segmented label="mode" value={s.mode} options={POP_MODES} onPick={(m) => set('mode', m)} />
      <p className="hero-tune__note hero-tune__readout">
        {on && stats ? (
          <>
            {stats.grouping.join(' + ')}
            <br />
            {stats.pattern} · {stats.phase} · seed {stats.seed}/{stats.step}
            <br />
            focus {stats.focus ?? '—'}
            <br />
            integrity {pct(stats.integrity)} · vis {stats.visible} · black {stats.black} · flips {stats.flips}
            <br />
            tex {stats.textures} (gpu {stats.gpuTextures ?? '—'}, warm {stats.warm}) · fps {stats.fps ?? '—'}
            <br />
            live {stats.live.length ? stats.live.join(', ') : '—'}
          </>
        ) : on ? (
          'waiting for the globe…'
        ) : (
          'mode off — the default globe.'
        )}
      </p>

      <div className="hero-tune__group">grouping</div>
      <Row label="worlds" param="group" value={s.group} min={1} max={3} step={1} onChange={set} />
      <Segmented
        label="pattern set"
        options={POP_PATTERNS}
        isActive={(n) => s.patterns.includes(n)}
        onPick={togglePattern}
      />
      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={() => sceneApiRef?.current?.popNext()}>
          ⏭ next
        </button>
        <button type="button" className="hero-tune__btn" onClick={reroll}>
          ↻ reroll
        </button>
      </div>
      <p className="hero-tune__note">
        ?popgroup · ?poppattern. a pattern switched on shows now; facets splits one world by
        media kind. holds only (p1): ⏭ / ↻ / a knob re-lays.
      </p>

      <div className="hero-tune__group">media</div>
      <Segmented label="media" value={s.media} options={POP_MEDIA} onPick={(m) => set('media', m)} />
      <Row label="cap / world" param="cap" value={s.cap} min={1} max={WORLD_POOL_CAP} step={1} onChange={set} />
      <Segmented label="share" value={s.share} options={POP_SHARES} onPick={(m) => set('share', m)} />
      <p className="hero-tune__note">
        ?popmedia · ?popcap · ?popshare. showcase = the /work tiles, all adds album art;
        weighted = area ∝ media count.
      </p>

      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={copyUrl}>
          {copied ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
