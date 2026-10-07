/**
 * PopTunePanel — DEV-ONLY bench for the home globe's POPULATION MODES
 * (docs/globe-worlds-plan.md). Rendered by Hero only when `?poptune=1`
 * (POP_TUNE_ACTIVE), lazily after hydration; absent otherwise.
 *
 * Controls write popConfig's TUNING (setPopTune → publish(key)); the scene
 * subscribes — a mode change builds/drops the PopulationDirector, a layout
 * knob re-lays the current world as a staggered blink, the change knobs
 * (hold, transition, the set, chaos) take effect from the next change. One
 * world holds the globe by default (Nathan, 09-26); with 2–3 the pattern
 * buttons toggle the SET groupings draw from, and switching one ON also
 * shows it now (sceneApi.popShow). enter world (?popenter) is read by Hero
 * at the Enter World click. names (10-06, reworked 10-07) = the client-name
 * strips: how many a world places, the layout (a run of tiles sized to the
 * name, or a whole latitude row), the type size, the latitude band and
 * front-facing width the placement must sit in, the span clamp, the style.
 * Every one of them re-lays the world; the readout shows where the strips
 * actually landed, and whether a gate had to relax.
 * ⏭ next = the next world now, through
 * its transition; ↻ reroll = a new seed (a new start world and change
 * clock). The readout polls window.__swmPopStats, which the director
 * publishes at ~2 Hz (also what scripts/globe-probe.mjs reads) — it sits
 * right under mode so it never scrolls away while dialing. copy_url =
 * poptune=1 + the seed + only off-default values.
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
  POP_LAYOUTS,
  POP_TRANSITIONS,
  POP_LIVE,
  POP_NAME_MODES,
  POP_NAME_STYLES,
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
          {`⌁ worlds · ${on && stats ? `${stats.world} · ${stats.holdLeft != null ? `${stats.holdLeft}s` : stats.phase}` : s.mode}`}
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
  // Set knobs toggle members; a set never empties.
  const toggle = (key, name) => {
    const was = s[key].includes(name);
    if (was && s[key].length === 1) return;
    set(key, was ? s[key].filter((n) => n !== name) : [...s[key], name]);
    return !was;
  };
  const togglePattern = (name) => {
    if (toggle('patterns', name)) sceneApiRef?.current?.popShow(name);
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
            {stats.next ? ` → ${stats.next}` : ''}
            <br />
            {stats.phase}
            {stats.holdLeft != null ? ` ${stats.holdLeft}s` : ''} · {stats.transition ?? '—'} · {stats.pattern} ·
            seed {stats.seed}/{stats.step}
            <br />
            colour {stats.color ?? 'blue'} · focus {stats.focus ?? '—'}
            <br />
            integrity {pct(stats.integrity)} · vis {stats.visible} · black {stats.black} · flips {stats.flips}
            <br />
            tex {stats.textures} (gpu {stats.gpuTextures ?? '—'}, warm {stats.warm}) · fps {stats.fps ?? '—'}
            <br />
            video {stats.streams} decode{stats.streams === 1 ? '' : 's'} → {stats.liveTiles} tiles ·{' '}
            {stats.live.length ? stats.live.join(', ') : '—'}
            <br />
            names {stats.nameTiles} tile{stats.nameTiles === 1 ? '' : 's'} ·{' '}
            {stats.namePlaced
              ? `${stats.namePlaced.mode} span ${stats.namePlaced.span} · ${stats.namePlaced.quad ?? '—'}${
                  stats.namePlaced.relaxed ? ` (relaxed: ${stats.namePlaced.relaxed})` : ''
                }`
              : '—'}
          </>
        ) : on ? (
          'waiting for the globe…'
        ) : (
          'mode off — the default globe.'
        )}
      </p>
      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={() => sceneApiRef?.current?.popNext()}>
          ⏭ next world
        </button>
        <button type="button" className="hero-tune__btn" onClick={reroll}>
          ↻ reroll
        </button>
      </div>

      <div className="hero-tune__group">change</div>
      <Row label="hold (s)" param="hold" value={s.hold} min={2} max={60} step={0.5} onChange={set} />
      <Row label="hold jitter ±" param="holdJit" value={s.holdJit} min={0} max={0.9} step={0.05} onChange={set} />
      <Row label="transition (s)" param="trans" value={s.trans} min={0.3} max={8} step={0.1} onChange={set} />
      <Segmented
        label="transitions"
        options={POP_TRANSITIONS}
        isActive={(n) => s.transitions.includes(n)}
        onPick={(n) => toggle('transitions', n)}
      />
      <Row label="chaos" param="chaos" value={s.chaos} min={0} max={1} step={0.05} onChange={set} />
      <p className="hero-tune__note">
        ?pophold · ?popholdjit · ?poptrans · ?poptransset · ?popchaos. tide = the scroll surges
        one full span, the next world pours in from the top pole; blink / surge swap in place;
        cut = at once. chaos 0 walks the /work order and the set in turn, 1 draws both at random.
        a change knob applies from the next change.
      </p>

      <div className="hero-tune__group">world</div>
      <Row label="worlds at once" param="group" value={s.group} min={1} max={3} step={1} onChange={set} />
      {s.group === 1 ? (
        <Segmented label="layout" value={s.layout} options={POP_LAYOUTS} onPick={(m) => set('layout', m)} />
      ) : (
        <Segmented
          label="pattern set"
          options={POP_PATTERNS}
          isActive={(n) => s.patterns.includes(n)}
          onPick={togglePattern}
        />
      )}
      <p className="hero-tune__note">
        ?popgroup · ?poplayout · ?poppattern. one world: mix interleaves its media, facets
        splits it into regions by media kind. 2–3: a pattern switched on shows now.
      </p>

      <div className="hero-tune__group">media</div>
      <Segmented label="media" value={s.media} options={POP_MEDIA} onPick={(m) => set('media', m)} />
      <Row label="cap / world" param="cap" value={s.cap} min={1} max={WORLD_POOL_CAP} step={1} onChange={set} />
      <Segmented label="share" value={s.share} options={POP_SHARES} onPick={(m) => set('share', m)} />
      <p className="hero-tune__note">
        ?popmedia · ?popcap · ?popshare. showcase = the /work tiles, all adds album art;
        weighted = area ∝ media count. a lower cap repeats clips more (more tiles per decode).
      </p>

      <div className="hero-tune__group">video · colour</div>
      <Segmented label="live video" value={s.live} options={POP_LIVE} onPick={(m) => set('live', m)} />
      <Segmented
        label="colour"
        value={s.color ? 'world' : 'blue'}
        options={['world', 'blue']}
        onPick={(m) => set('color', m === 'world' ? 1 : 0)}
      />
      <p className="hero-tune__note">
        ?poplive · ?popcolor. shared = one decode per clip, bound on every tile showing it (the
        repeats play in sync); tile = one decode per live tile. world = the projectColor takes
        the lattice, ring, gradient, enter_world and the nav accents.
      </p>

      <div className="hero-tune__group">names</div>
      <Row label="strips / world" param="names" value={s.names} min={0} max={4} step={1} onChange={set} />
      <Segmented label="layout" value={s.nameMode} options={POP_NAME_MODES} onPick={(m) => set('nameMode', m)} />
      <Row label="type size" param="nameSize" value={s.nameSize} min={0.3} max={1.2} step={0.01} onChange={set} />
      <Row label="band of pole→pole" param="nameBand" value={s.nameBand} min={0.1} max={1} step={0.01} onChange={set} />
      <Row label="front-facing" param="nameFace" value={s.nameFace} min={0.05} max={1} step={0.01} onChange={set} />
      <Row label="span min" param="nameSpanMin" value={s.nameSpanMin} min={1} max={12} step={1} onChange={set} />
      <Row label="span max" param="nameSpanMax" value={s.nameSpanMax} min={1} max={12} step={1} onChange={set} />
      <Segmented label="style" value={s.nameStyle} options={POP_NAME_STYLES} onPick={(m) => set('nameStyle', m)} />
      <p className="hero-tune__note">
        ?popnames · ?popnamemode · ?popnamesize · ?popnameband · ?popnameface · ?popnamespanmin ·
        ?popnamespanmax · ?popnamestyle. the world's client name in the fp card face, STILL (no
        ticker). region = a run of adjacent tiles of one row, as many as the measured name needs
        (span min…max) so it reads once, edge to edge; band = a whole latitude row, the name
        repeating round the globe. each change places the strip mid-latitude, facing you, in the
        quadrant opposite the last world's — a span near half the globe can only sit centred, so
        the quadrant relaxes (the readout says so); lower span max to keep it alternating. ink =
        the colour on black, fill = black on the colour.
      </p>

      <div className="hero-tune__group">enter world</div>
      <Segmented
        label="lands in"
        value={s.enter ? 'world' : 'first'}
        options={['world', 'first']}
        onPick={(m) => set('enter', m === 'world' ? 1 : 0)}
      />
      <p className="hero-tune__note">
        ?popenter. world = enter_world opens /work inside the world on the globe (it lands
        there, no turn from the first world); first = the first /work world, as before.
      </p>

      <div className="hero-tune__actions">
        <button type="button" className="hero-tune__btn" onClick={copyUrl}>
          {copied ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
