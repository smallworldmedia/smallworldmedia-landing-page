/**
 * DirectoryTunePanel — the ?dirtune=1 bench on /work/directory (11-03).
 * CommitTunePanel's typed model: number fields commit on Enter or blur
 * (garbage restores the live value), the two choices are selects, and a
 * label turns blue while its value is off the default. The values live in
 * DirectoryPage, the one island that reads them; copy_url serializes only
 * the off-default ones (directoryTune.js).
 *
 * TOP-right (footertune holds top-left, lenistune bottom-left).
 * Styles: commit-tune.css + the --tr corner modifier.
 */
import { useEffect, useState } from 'react';
import { ORDERS, TUNE_OK, tuneCopyUrl } from './directoryTune.js';

const FIELDS = [
  {
    key: 'order',
    label: 'order',
    hint: 'project = featured first, in World order; mix = clients dealt round-robin; shuffle = a new random order each load',
    options: ORDERS,
  },
  { key: 'players', label: 'players', hint: 'videos playing at once (the gate cap); 0 = posters only' },
  { key: 'dwell', label: 'dwell ms', hint: 'how long a video tile stays half in view before it plays' },
  { key: 'cols', label: 'cols', hint: 'columns above 1024px, below the large tier' },
  { key: 'largeCols', label: 'large cols', hint: 'columns from the large tier up (1920px; ?gridlarge moves it)' },
  { key: 'tabletCols', label: 'tablet cols', hint: 'columns from 769 to 1024px' },
  { key: 'phoneCols', label: 'phone cols', hint: 'columns at ≤768px', options: [1, 2] },
  { key: 'logoPad', label: 'logo pad', hint: "a logo tile's margin, a share of its height (0 to 0.4)" },
  {
    key: 'logoWeight',
    label: 'logo weight',
    hint: '0 = every mark fills its box; 1 = every mark gets the same ink area (0 to 1)',
  },
  { key: 'logoShrink', label: 'logo shrink', hint: 'how much smaller than it wants a mark may go to take a square, not a landscape (0 to 1)' },
  { key: 'logoCenter', label: 'logo centre', hint: "0 = centre the mark's box; 1 = centre its centre of mass (0 to 1)" },
  { key: 'tabClear', label: 'tab clear px', hint: "room under a filter tab's word, so its underline clears the bottom stroke (0 to 16)" },
];

function NumberField({ field, value, isDefault, onCommit }) {
  const [text, setText] = useState(String(value));
  const [flash, setFlash] = useState(false);

  // Reflect outside writes (reset).
  useEffect(() => {
    setText((cur) => (Number(cur) === value ? cur : String(value)));
  }, [value]);

  const commit = () => {
    const n = text.trim() === '' ? NaN : Number(text);
    if (!Number.isFinite(n) || !TUNE_OK[field.key](n)) {
      setText(String(value)); // reject garbage, restore the live value
      return;
    }
    onCommit(field.key, n);
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

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

function ChoiceField({ field, value, isDefault, onCommit }) {
  return (
    <label className="commit-tune__row" title={field.hint}>
      <span className={`commit-tune__label${isDefault ? '' : ' is-dirty'}`}>{field.label}</span>
      <select
        className="commit-tune__input"
        value={String(value)}
        onChange={(e) => onCommit(field.key, field.options.find((o) => String(o) === e.target.value))}
      >
        {field.options.map((o) => (
          <option key={o} value={String(o)}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DirectoryTunePanel({ tune, defaults, onChange, onReset }) {
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(tuneCopyUrl(tune, defaults));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="commit-tune commit-tune--tr" data-lenis-prevent>
      <p className="commit-tune__title">dir_tune</p>
      {FIELDS.map((f) => {
        const Field = f.options ? ChoiceField : NumberField;
        return (
          <Field
            key={f.key}
            field={f}
            value={tune[f.key]}
            isDefault={tune[f.key] === defaults[f.key]}
            onCommit={onChange}
          />
        );
      })}
      <div className="commit-tune__actions">
        <button type="button" className="commit-tune__btn" onClick={copyUrl}>
          {copied ? 'copied ✓' : 'copy_url'}
        </button>
        <button type="button" className="commit-tune__btn" onClick={onReset}>
          reset
        </button>
      </div>
    </div>
  );
}
