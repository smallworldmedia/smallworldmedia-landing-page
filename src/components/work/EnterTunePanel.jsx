/**
 * EnterTunePanel — the ?entertune=1 enter-the-world choreography bench
 * (/work → project-detail transition). CommitTunePanel's typed model:
 * NUMBER INPUTS, not sliders — type a value, Enter/blur commits it to the
 * ENTER_TUNABLES store (read live by useWorldScene's enter ramp and
 * WorldCard's real commit), ▶ dry-run rehearses the full choreography in
 * place — optional RouteFill cover + lens deepen + scale-up, then unwind —
 * without navigating, copy_url serializes only off-default values.
 *
 * Model it drives (useWorldScene enter ramp, 08-25 rework): ONE linear
 * timeline of `enter ms`; LENS deepens the base distortion by `lens deepen`
 * (NEGATIVE = further inside the sphere) over [lensStart, lensEnd] WHILE
 * MOVE (camera dolly + projection zoom → `zoom scale`) runs over
 * [moveStart, moveEnd] — both channels power-inOut of exponent `pow`.
 * Overlap the windows freely — that IS the choreography.
 *
 * TOP-right on /work (fp1tune + deckdebug own bottom-right; footertune TL).
 * Styles: commit-tune.css (shared bench chrome) + the --tr corner modifier.
 */
import { useEffect, useState } from 'react';
import {
  ENTER_TUNABLES,
  ENTER_TUNE_DEFAULTS,
  setEnterTune,
  resetEnterTune,
  subscribeEnterTune,
  enterTuneCopyUrl,
} from './world/enterTune.js';

const FIELDS = [
  { key: 'enterMs', label: 'enter ms', hint: 'timeline + cover length' },
  { key: 'lens', label: 'lens deepen', hint: 'added distortion at full ramp — NEGATIVE = deeper into the sphere' },
  { key: 'lensStart', label: 'lens start', hint: '0..1 of timeline' },
  { key: 'lensEnd', label: 'lens end', hint: '0..1 of timeline' },
  { key: 'scale', label: 'zoom scale', hint: 'projection-zoom destination (1 = off) — scales grid + tiles up' },
  { key: 'dolly', label: 'dolly', hint: 'camera travel toward the tiles, world units' },
  { key: 'moveStart', label: 'move start', hint: '0..1 of timeline' },
  { key: 'moveEnd', label: 'move end', hint: '0..1 of timeline' },
  { key: 'pow', label: 'pow', hint: 'power-inOut exponent, both channels' },
  { key: 'holdMs', label: 'hold ms', hint: 'dry-run: hold at full ramp before unwinding' },
  { key: 'cover', label: 'cover', hint: 'dry-run: 1 = raise the RouteFill too, 0 = bare scene' },
];

function Field({ field }) {
  const [text, setText] = useState(String(ENTER_TUNABLES[field.key]));
  const [flash, setFlash] = useState(false);

  // Reflect external writes (reset, a URL reseed).
  useEffect(
    () =>
      subscribeEnterTune(() => {
        setText((cur) => {
          const live = ENTER_TUNABLES[field.key];
          return parseFloat(cur) === live ? cur : String(live);
        });
      }),
    [field.key]
  );

  const commit = () => {
    const n = parseFloat(text);
    if (!Number.isFinite(n)) {
      setText(String(ENTER_TUNABLES[field.key])); // reject garbage, restore live value
      return;
    }
    setEnterTune(field.key, n);
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

  const isDefault = ENTER_TUNABLES[field.key] === ENTER_TUNE_DEFAULTS[field.key];
  return (
    <label className={`commit-tune__row${flash ? ' is-flash' : ''}`} title={field.hint}>
      <span className={`commit-tune__label${isDefault ? '' : ' is-dirty'}`}>{field.label}</span>
      <input
        className="commit-tune__input"
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export default function EnterTunePanel({ getAccent }) {
  const [copied, setCopied] = useState(false);

  // Rehearse the full enter_world choreography WITHOUT navigating: raise the
  // cover (unless cover=0) + fire the scene ramp with dryRun (the scene holds
  // at full, then unwinds). The fill releases after ramp + hold so the unwind
  // plays under the fading blue — the reverse of the real gesture's handoff.
  const dryRun = () => {
    const t = ENTER_TUNABLES;
    const duration = t.enterMs / 1000;
    if (t.cover) {
      window.dispatchEvent(
        new CustomEvent('swm:envelop', { detail: { duration, color: getAccent?.() } })
      );
      setTimeout(
        () => window.dispatchEvent(new CustomEvent('swm:fill-release')),
        t.enterMs + t.holdMs
      );
    }
    window.dispatchEvent(new CustomEvent('swm:enter-world', { detail: { duration, dryRun: true } }));
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(enterTuneCopyUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — the URL is still in the address bar shape */
    }
  };

  return (
    <div className="commit-tune commit-tune--tr" data-lenis-prevent>
      <p className="commit-tune__title">enter_tune</p>
      {FIELDS.map((f) => (
        <Field key={f.key} field={f} />
      ))}
      <div className="commit-tune__actions">
        <button type="button" className="commit-tune__btn" onClick={dryRun}>
          ▶ dry-run
        </button>
        <button type="button" className="commit-tune__btn" onClick={copyUrl}>
          {copied ? 'copied ✓' : 'copy_url'}
        </button>
        <button type="button" className="commit-tune__btn" onClick={resetEnterTune}>
          reset
        </button>
      </div>
    </div>
  );
}
