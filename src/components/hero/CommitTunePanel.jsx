/**
 * CommitTunePanel — the ?committune=1 typed commit-choreography bench
 * (Nathan, 08-25): NUMBER INPUTS, not sliders — type a value, Enter/blur
 * commits it to the shared hero TUNING store (same store the ?herotune
 * bench and the commit snapshot read), ▶ dry-run rehearses the commit
 * without navigating, copy_url serializes only off-default values.
 *
 * Model it drives (Hero.beginEnvelopment, 08-25 concurrent-windows):
 *   ONE linear timeline; blue paints over [blueStart, blueEnd] WHILE
 *   recenter runs over [recenterStart, recenterEnd] and zoom over
 *   [zoomStart, zoomEnd] — camera channels on a power-inOut curve of
 *   exponent camPow (smooth both ends, no overshoot). envScale is the
 *   dolly's destination. Overlap windows freely — that IS the choreography.
 *
 * Fixed bottom-right (herotune owns top-right, lenistune bottom-left).
 * Styles: commit-tune.css, imported from BaseLayout (code-split rule).
 */
import { useEffect, useState } from 'react';
import {
  TUNING,
  TUNING_DEFAULTS,
  setHeroTune,
  subscribeHeroTune,
  heroTuneCopyUrl,
} from './heroConfig.js';

const FIELDS = [
  { key: 'commitMs', label: 'commit ms', hint: 'timeline length' },
  { key: 'blueStart', label: 'blue start', hint: '0..1 of timeline' },
  { key: 'blueEnd', label: 'blue end', hint: '0..1 of timeline' },
  { key: 'recenterStart', label: 'recenter start', hint: '0..1 of timeline' },
  { key: 'recenterEnd', label: 'recenter end', hint: '0..1 of timeline' },
  { key: 'zoomStart', label: 'zoom start', hint: '0..1 of timeline' },
  { key: 'zoomEnd', label: 'zoom end', hint: '0..1 of timeline' },
  { key: 'camPow', label: 'cam pow', hint: 'in-out exponent' },
  { key: 'envScale', label: 'env scale', hint: 'dolly destination' },
  /* blue fill (panels) */
  {
    key: 'blueCascade',
    label: 'blue cascade',
    hint: 'sweep | rows | poles',
    oneOf: ['sweep', 'rows', 'poles'],
  },
  { key: 'blueSurge', label: 'blue surge', hint: 'per-panel length (delay units)' },
  { key: 'blueDipEnd', label: 'blue dip end', hint: 'dip share of surge 0..0.9' },
  { key: 'blueDipDepth', label: 'blue dip depth', hint: 'brightness drop 0..1' },
  /* overviews_loading (home→/work passage) */
  { key: 'loaderLeadMs', label: 'loader lead', hint: 'ms after commit start → bar appears' },
  { key: 'loaderEndMs', label: 'loader end', hint: 'ms the bar takes to close; reveal waits' },
  /* lockup h / lockup beat rows retired 08-30 with the hero lockup itself
     (the nav carries the brand on home now). */
];

function Field({ field }) {
  const [text, setText] = useState(String(TUNING[field.key]));
  const [flash, setFlash] = useState(false);

  // Reflect external writes (reset, the slider bench, a URL reseed).
  useEffect(
    () =>
      subscribeHeroTune(() => {
        setText((cur) => {
          const live = TUNING[field.key];
          const parsed = field.oneOf ? cur.trim().toLowerCase() : parseFloat(cur);
          return parsed === live ? cur : String(live);
        });
      }),
    [field.key, field.oneOf]
  );

  const commit = () => {
    if (field.oneOf) {
      const v = text.trim().toLowerCase();
      if (!field.oneOf.includes(v)) {
        setText(String(TUNING[field.key])); // not in the vocabulary — restore
        return;
      }
      setHeroTune(field.key, v);
    } else {
      const n = parseFloat(text);
      if (!Number.isFinite(n)) {
        setText(String(TUNING[field.key])); // reject garbage, restore live value
        return;
      }
      setHeroTune(field.key, n);
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
  };

  const isDefault = TUNING[field.key] === TUNING_DEFAULTS[field.key];
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

export default function CommitTunePanel({ onDryRun }) {
  const [copied, setCopied] = useState(false);
  const copyUrl = async () => {
    // The shared serializer tags herotune=1 — retag for this bench.
    const url = new URL(heroTuneCopyUrl());
    url.searchParams.delete('herotune');
    url.searchParams.set('committune', '1');
    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — the URL is still in the address bar shape */
    }
  };

  return (
    <div className="commit-tune" data-lenis-prevent>
      <p className="commit-tune__title">commit_tune</p>
      {FIELDS.map((f) => (
        <Field key={f.key} field={f} />
      ))}
      <div className="commit-tune__actions">
        <button type="button" className="commit-tune__btn" onClick={onDryRun}>
          ▶ dry-run
        </button>
        <button type="button" className="commit-tune__btn" onClick={copyUrl}>
          {copied ? 'copied ✓' : 'copy_url'}
        </button>
      </div>
    </div>
  );
}
