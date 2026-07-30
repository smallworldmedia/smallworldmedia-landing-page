/**
 * FooterTunePanel — DEV-ONLY live tuning bench for the sticky-reveal footer.
 * Rendered by SiteShell only when `?footertune=1` (FOOTER_TUNE_ACTIVE);
 * absent otherwise. Sits top-LEFT — the free corner (lenistune + globe debug
 * own bottom-left, fp1tune bottom-right, herotune top-right).
 *
 * Two sliders in the LenisTunePanel shape:
 *   lockup h — SWM lockup art height (rem) → `--footer-lockup-h` on <html>.
 *              Panel height follows, and SiteFooter's ResizeObserver
 *              re-sizes the spacer/travel automatically.
 *   travel k — reveal-travel multiplier (spacer = K × panel height), the
 *              halfway-scoot fix's second half. SiteFooter re-measures on
 *              the shared pub/sub.
 *
 * copy_url emits only non-default knobs (?footerlockup / ?footertravel).
 * Dial on /process or a /work/[slug] page (document-scroll routes); on /work
 * the driven footer shows lockup size live at the last World.
 *
 * SiteShell import()s this module (own chunk); footer-tune.css deliberately
 * stays imported from BaseLayout — see the note there.
 */
import { useState } from 'react';
import {
  getFooterTuneState,
  setFooterTune,
  resetFooterTune,
  footerTuneUrl,
  FOOTER_TUNE_DEFAULTS,
} from '../lib/footerTune.js';

function Row({ label, param, value, min, max, step, fmt, onChange }) {
  return (
    <label className="footer-tune__row">
      <span className="footer-tune__key">
        {label}
        <span className="footer-tune__val">{fmt ? fmt(value) : value}</span>
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

const num2 = (n) => (Math.round(n * 100) / 100).toString();

export default function FooterTunePanel() {
  // Local mirror of the shared tuning state (seeded from it, incl. URL seed).
  const [s, setS] = useState(() => ({ ...getFooterTuneState() }));
  const [copied, setCopied] = useState(false);

  const set = (key, value) => {
    setFooterTune(key, value); // → cascade + SiteFooter spacer re-measure
    setS((prev) => ({ ...prev, [key]: value }));
  };
  const reset = () => {
    resetFooterTune();
    setS({ ...getFooterTuneState() });
  };

  const copyUrl = async () => {
    const text = footerTuneUrl();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('copy:', text); // clipboard blocked — fall back to a prompt
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside className="footer-tune" aria-label="Footer reveal tuning">
      <header className="footer-tune__head">
        <span>footer · reveal</span>
        <button type="button" className="footer-tune__btn" onClick={reset}>
          ↺ reset
        </button>
      </header>

      <div className="footer-tune__group">lockup</div>
      <Row
        label={`lockup h (rem · def ${FOOTER_TUNE_DEFAULTS.lockupRem})`}
        param="lockupRem"
        value={s.lockupRem}
        min={2}
        max={6}
        step={0.1}
        fmt={num2}
        onChange={set}
      />
      <p className="footer-tune__note">
        panel height follows the lockup — spacer/travel re-measure live.
      </p>

      <div className="footer-tune__group">reveal travel</div>
      <Row
        label={`travel k (×panel · def ${FOOTER_TUNE_DEFAULTS.travelK})`}
        param="travelK"
        value={s.travelK}
        min={1}
        max={3}
        step={0.05}
        fmt={num2}
        onChange={set}
      />
      <p className="footer-tune__note">
        scroll distance for a full reveal = k × panel height. dial on /process
        or a project page.
      </p>

      <div className="footer-tune__actions">
        <button type="button" className="footer-tune__btn" onClick={copyUrl}>
          {copied ? '✓ copied' : 'copy_url'}
        </button>
      </div>
    </aside>
  );
}
