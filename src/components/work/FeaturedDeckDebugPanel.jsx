/**
 * FeaturedDeckDebugPanel — DEV-ONLY live tuning bench for the featured-page
 * Deck Viewer (the composite band in the World scene). Mounts on /work solely
 * under `?deckdebug`; absent otherwise, so it never touches shipped chrome.
 *
 * Sliders mutate the shared BAND_TUNABLES store (worldConfig). The World render
 * loop reads that store every frame — worldBands.paint rebuilds the pose
 * distances from it, applyParallax re-anchors the deck's placement — so every
 * knob scales the running deck live with no rebuild. The cycle-rate slider
 * takes effect on the deck's next auto-advance.
 *
 * Knobs (Nathan's FP1 ask): rate the deck cycles pages · page spacing ·
 * position of the front page (home x) and back pages (fan / pile extent) ·
 * plus the deck's TOP-RIGHT placement (deck x/y). copy_url serialises the
 * dialed-in values back into a shareable query string (the bake-in path).
 *
 * Voice/chrome mirrors ProcessDebugPanel (mono, near-black, lowercase).
 */
import { useState } from 'react';
import { HOME_X, VIEW_HOLD } from './bandLayout.js';
import { BAND_TUNABLES } from './world/worldConfig.js';

/* Knob specs: key into BAND_TUNABLES, URL param (matches worldConfig's num()
   seeds so copy_url round-trips), range, and the shipped default (for the
   non-default serialise). */
const KNOBS = [
  { key: 'cycleS', param: 'bandcycle', label: 'cycle rate', min: 0.4, max: 8, step: 0.1, def: 3.2 },
  { key: 'spacingMul', param: 'deckspace', label: 'page spacing', min: 0.3, max: 2.5, step: 0.05, def: 1 },
  { key: 'homeX', param: 'deckhome', label: 'front page x', min: -0.8, max: 0.4, step: 0.01, def: HOME_X },
  { key: 'fanMul', param: 'deckfan', label: 'back fan extent', min: 0.3, max: 2.5, step: 0.05, def: 1 },
  { key: 'pileMul', param: 'deckpile', label: 'shown pile extent', min: 0.3, max: 2.5, step: 0.05, def: 1 },
  { key: 'viewHold', param: 'deckhold', label: 'view plateau', min: 0, max: 0.6, step: 0.01, def: VIEW_HOLD },
  { key: 'albumScale', param: 'deckalbum', label: 'album art scale', min: 0.6, max: 1.4, step: 0.01, def: 1 },
  { key: 'posX', param: 'bandx', label: 'deck x (right)', min: 0, max: 0.6, step: 0.01, def: 0.34 },
  { key: 'posY', param: 'bandy', label: 'deck y (up)', min: 0, max: 0.6, step: 0.01, def: 0.36 },
];

const round3 = (n) => Math.round(n * 1000) / 1000;

/* Only non-default knobs serialise — the dialed feel as a URL (bake path). */
const buildTunedUrl = () => {
  const q = ['deckdebug'];
  KNOBS.forEach((k) => {
    if (Math.abs(BAND_TUNABLES[k.key] - k.def) > 1e-9) q.push(`${k.param}=${round3(BAND_TUNABLES[k.key])}`);
  });
  return `${window.location.pathname}?${q.join('&')}`;
};

export default function FeaturedDeckDebugPanel() {
  const [, bump] = useState(0); // BAND_TUNABLES is the source of truth
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
  );

  const tune = (key, value) => {
    BAND_TUNABLES[key] = value; // read live by the render loop — no rebuild
    bump((n) => n + 1);
  };

  const reset = () => {
    KNOBS.forEach((k) => {
      BAND_TUNABLES[k.key] = k.def;
    });
    bump((n) => n + 1);
  };

  const copyUrl = () => {
    const url = `${window.location.origin}${buildTunedUrl()}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  if (!open) {
    return (
      <aside className="fp-deckdbg fp-deckdbg--chip">
        <button type="button" onClick={() => setOpen(true)}>
          ⌁ deck
        </button>
      </aside>
    );
  }

  return (
    <aside className="fp-deckdbg" aria-label="Deck Viewer tuning">
      <div className="fp-deckdbg__head">
        <p className="fp-deckdbg__title">deck viewer · tune</p>
        <button
          type="button"
          className="fp-deckdbg__close"
          aria-label="collapse deck tuning panel"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="fp-deckdbg__knobs">
        {KNOBS.map((k) => (
          <label key={k.key} className="fp-deckdbg__knob">
            <span className="fp-deckdbg__knob-name">{k.label}</span>
            <input
              type="range"
              min={k.min}
              max={k.max}
              step={k.step}
              value={BAND_TUNABLES[k.key]}
              onChange={(e) => tune(k.key, parseFloat(e.target.value))}
            />
            <span className="fp-deckdbg__knob-value">{round3(BAND_TUNABLES[k.key])}</span>
          </label>
        ))}
      </div>

      <div className="fp-deckdbg__url">
        <button type="button" onClick={reset}>
          ↺ reset
        </button>
        <button type="button" onClick={copyUrl}>
          {copied ? 'copied ✓' : 'copy_url'}
        </button>
        <code>{buildTunedUrl()}</code>
      </div>
    </aside>
  );
}
