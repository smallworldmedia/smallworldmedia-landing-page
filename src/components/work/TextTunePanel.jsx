/**
 * TextTunePanel — the ?texttune=1 text-exit choreography bench (the DOM
 * text-out that rides the enter_world commit; textExit.js). CommitTunePanel's
 * typed model: NUMBER INPUTS — type a value, Enter/blur commits it to
 * TEXT_TUNABLES (read at fire time by runTextExit), ▶ dry-run rehearses the
 * FULL gesture — scene ramp + text-out (+ the RouteFill cover unless the
 * enter store's `cover` is 0) — without navigating, copy_url serializes only
 * off-default values.
 *
 * The scale channel's TIMING lives on the enter bench (?entertune —
 * enterMs / moveStart / moveEnd / pow are shared with the scene by design);
 * this panel owns the text-side VALUES: cut rates, clip/wipe timing+speed,
 * and the two scale destinations.
 *
 * Top-LEFT on /work (entertune owns top-right; fp1tune + deckdebug
 * bottom-right). Styles: commit-tune.css + the --tl corner modifier.
 */
import { useEffect, useState } from 'react';
import { ENTER_TUNABLES } from './world/enterTune.js';
import {
  TEXT_TUNABLES,
  TEXT_TUNE_DEFAULTS,
  setTextTune,
  resetTextTune,
  subscribeTextTune,
  textTuneCopyUrl,
} from './textExit.js';

const FIELDS = [
  { key: 'tagCutMs', label: 'tag cut ms', hint: 'interval between service-tag hard cuts (random order)' },
  { key: 'charCutMs', label: 'char cut ms', hint: 'interval between client-name letter cuts (random order)' },
  { key: 'tabDelayMs', label: 'tab delay', hint: 'ms before the PROJECT_## clip starts' },
  { key: 'tabMs', label: 'tab ms', hint: 'PROJECT_## clip duration — top edge eats downward' },
  { key: 'navDelayMs', label: 'nav delay', hint: 'ms before the prev/next wipes start' },
  { key: 'navMs', label: 'nav ms', hint: 'wipe duration — prev exits up, next exits down' },
  { key: 'cardScale', label: 'card scale', hint: 'card block scale destination (rides the enter move channel)' },
  { key: 'navScale', label: 'nav scale', hint: 'prev/next chip scale destination (same channel)' },
];

function Field({ field }) {
  const [text, setText] = useState(String(TEXT_TUNABLES[field.key]));
  const [flash, setFlash] = useState(false);

  // Reflect external writes (reset, a URL reseed).
  useEffect(
    () =>
      subscribeTextTune(() => {
        setText((cur) => {
          const live = TEXT_TUNABLES[field.key];
          return parseFloat(cur) === live ? cur : String(live);
        });
      }),
    [field.key]
  );

  const commit = () => {
    const n = parseFloat(text);
    if (!Number.isFinite(n)) {
      setText(String(TEXT_TUNABLES[field.key])); // reject garbage, restore live value
      return;
    }
    setTextTune(field.key, n);
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

  const isDefault = TEXT_TUNABLES[field.key] === TEXT_TUNE_DEFAULTS[field.key];
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

export default function TextTunePanel({ getAccent }) {
  const [copied, setCopied] = useState(false);

  // Same rehearsal the enter bench fires: the 'swm:enter-world' dispatch
  // reaches BOTH the scene ramp and the armed text-exit listener, so the
  // whole gesture plays as one. Cover honors the enter store's `cover`
  // (set it 0 over on ?entertune to watch the text uncovered).
  const dryRun = () => {
    const duration = ENTER_TUNABLES.enterMs / 1000;
    if (ENTER_TUNABLES.cover) {
      window.dispatchEvent(
        new CustomEvent('swm:envelop', { detail: { duration, color: getAccent?.() } })
      );
      setTimeout(
        () => window.dispatchEvent(new CustomEvent('swm:fill-release')),
        ENTER_TUNABLES.enterMs + ENTER_TUNABLES.holdMs
      );
    }
    window.dispatchEvent(new CustomEvent('swm:enter-world', { detail: { duration, dryRun: true } }));
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(textTuneCopyUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — the URL is still in the address bar shape */
    }
  };

  return (
    <div className="commit-tune commit-tune--tl" data-lenis-prevent>
      <p className="commit-tune__title">text_tune</p>
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
        <button type="button" className="commit-tune__btn" onClick={resetTextTune}>
          reset
        </button>
      </div>
    </div>
  );
}
