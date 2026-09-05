/**
 * ScrimTunePanel — DEV-ONLY live tuning bench for the ?pager=scale engaged
 * SCRIM (09-04 round 7, Nathan: "dial in an iteration of the overlay scrim
 * that implements blur as well as grain / noise"). Rendered by
 * FeaturedProjects only when `?scrimtune=1`; absent otherwise, so nothing
 * bench-shaped ships to visitors.
 *
 * The scrim is the fixed ::before on .fp[data-pager='scale'] — a
 * pseudo-element, so the bench drives it through inline custom properties
 * on the .fp node (featured-projects.css consumes them with no-op
 * fallbacks; the shipped scrim is byte-identical until a dial moves):
 *   --pager-scrim        scrim depth 0–1 (the existing token — since the
 *                        09-04 blur fix it is the background-color ALPHA,
 *                        not element opacity: an element at opacity < 1
 *                        composites its backdrop-filter result over the
 *                        sharp original, which read as "blur off")
 *   --scrim-tint         0–1 mix of the live --project-color into the flood
 *   --scrim-bf           backdrop-filter (blur(Npx) | none)
 *   --scrim-noise        grain tile — an SVG feTurbulence data-URI,
 *                        regenerated per dial (type/frequency/octaves/
 *                        amount/mono are baked INTO the tile)
 *   --scrim-noise-size   background-size of the tile (grain scale)
 *   --scrim-noise-pos    background-position jitter (the anim fps driver)
 *
 * `hold scrim` paints the scrim WITHOUT engaging the pager (the
 * .is-scrimtune-hold class) — you cannot dial a hover-engaged scrim while
 * your mouse is on this panel — and deliberately skips the pause freeze,
 * so the scene keeps moving under the blur (the honest test). Engage the
 * pager normally to judge the frozen composite.
 *
 * texture: none | fractalNoise | turbulence — the "do I want a texture?"
 * option. An IMAGE texture is deliberately not wired yet; the copy block
 * records every value for baking into featured-projects.css / global.css.
 *
 * The .fp node is queried at write time, never cached (client:only
 * stale-DOM doctrine). scrim-tune.css is imported by work/index.astro
 * (the fp1-tune convention).
 */
import { useEffect, useState } from 'react';
import { SCRIM_GRAIN, noiseUri } from './scrimNoise.js';

// The BAKED recipe (Nathan's 09-04 dial — featured-projects.css scrim rule
// + --pager-scrim in global.css; grain settings shared via scrimNoise.js):
// defaults mirror the shipped scrim, so opening the bench (and ↺ reset)
// starts from what visitors see.
const DEFAULTS = {
  scrim: 0.4, // --pager-scrim token (global.css)
  tint: 0.75, // 0–1 mix of the live --project-color into the flood (0 = black)
  blur: 7.5, // px; 0 = no backdrop-filter at all
  ...SCRIM_GRAIN, // type / freq / oct / amount / size / fps / mono
  hold: true, // paint the scrim without engaging
};

const copyBlock = (s) =>
  [
    '/* scrimtune — bake into featured-projects.css (+ --pager-scrim in global.css) */',
    `--pager-scrim: ${s.scrim};`,
    `--scrim-tint: ${s.tint};`,
    `--scrim-bf: ${s.blur > 0 ? `blur(${s.blur}px)` : 'none'};`,
    `--scrim-noise-size: ${s.size}px;`,
    `/* grain: type=${s.type} freq=${s.freq} octaves=${s.oct} amount=${s.amount} mono=${s.mono ? 1 : 0}`,
    `   anim: ${s.fps}fps — shipped driver = the fp-scrim-grain steps() keyframes (8 frames / 0.2667s = 30fps; re-time if fps changes) */`,
    `--scrim-noise: ${noiseUri(s)};`,
  ].join('\n');

function Row({ label, param, value, min, max, step, onChange }) {
  return (
    <label className="scrim-tune__row">
      <span className="scrim-tune__key">
        {label}
        <span className="scrim-tune__val">{value}</span>
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

export default function ScrimTunePanel() {
  const [s, setS] = useState(DEFAULTS);
  const [copied, setCopied] = useState(false);
  const set = (key, value) => setS((prev) => ({ ...prev, [key]: value }));

  // One effect owns the .fp writes — every state change re-applies the full
  // set, and the cleanup returns the scrim to the shipped tokens.
  useEffect(() => {
    const fp = document.querySelector('.fp');
    if (!fp) return undefined;
    fp.style.setProperty('--pager-scrim', s.scrim);
    fp.style.setProperty('--scrim-tint', s.tint);
    fp.style.setProperty('--scrim-bf', s.blur > 0 ? `blur(${s.blur}px)` : 'none');
    fp.style.setProperty('--scrim-noise', noiseUri(s));
    fp.style.setProperty('--scrim-noise-size', `${s.size}px`);
    // Still the SHIPPED 30fps steps() driver while the bench owns the
    // jitter (its interval below dials the fps live).
    fp.style.setProperty('--scrim-grain-anim', 'none');
    fp.classList.toggle('is-scrimtune-hold', s.hold);
    return () => {
      fp.style.removeProperty('--pager-scrim');
      fp.style.removeProperty('--scrim-tint');
      fp.style.removeProperty('--scrim-bf');
      fp.style.removeProperty('--scrim-noise');
      fp.style.removeProperty('--scrim-noise-size');
      fp.style.removeProperty('--scrim-noise-pos');
      fp.style.removeProperty('--scrim-grain-anim');
      fp.classList.remove('is-scrimtune-hold');
    };
  }, [s]);

  // Grain ANIMATION: jitter the tile's background-position at the dial's
  // fps (film-grain idiom — one decoded tile, random offsets; repeat makes
  // every offset seamless). Bench-side driver only; the copy block notes
  // that a bake needs its own (rAF in the skin or a steps() keyframe set).
  useEffect(() => {
    if (s.type === 'none' || s.amount <= 0 || s.fps <= 0) return undefined;
    const id = setInterval(() => {
      document
        .querySelector('.fp')
        ?.style.setProperty(
          '--scrim-noise-pos',
          `${Math.floor(Math.random() * 256)}px ${Math.floor(Math.random() * 256)}px`
        );
    }, 1000 / s.fps);
    return () => clearInterval(id);
  }, [s.type, s.amount, s.fps]);

  const copy = async () => {
    const text = copyBlock(s);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('copy:', text); // clipboard blocked — fall back to a prompt
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside className="scrim-tune" aria-label="Pager scrim tuning">
      <header className="scrim-tune__head">
        <span>r7 · pager scrim</span>
        <button type="button" className="scrim-tune__btn" onClick={() => setS(DEFAULTS)}>
          ↺ reset
        </button>
      </header>

      <label className="scrim-tune__check">
        <input
          type="checkbox"
          checked={s.hold}
          onChange={(e) => set('hold', e.target.checked)}
        />
        hold scrim (paint without engaging — scene keeps moving)
      </label>

      <div className="scrim-tune__group">scrim</div>
      <Row label="opacity" param="scrim" value={s.scrim} min={0} max={1} step={0.01} onChange={set} />
      <Row label="project tint" param="tint" value={s.tint} min={0} max={1} step={0.01} onChange={set} />
      <Row label="blur px" param="blur" value={s.blur} min={0} max={32} step={0.5} onChange={set} />

      <div className="scrim-tune__group">grain / noise</div>
      <label className="scrim-tune__key">
        texture
        <select value={s.type} onChange={(e) => set('type', e.target.value)}>
          <option value="none">none</option>
          <option value="fractalNoise">fractal noise (film grain)</option>
          <option value="turbulence">turbulence (harder)</option>
        </select>
      </label>
      {s.type !== 'none' && (
        <>
          <Row label="amount" param="amount" value={s.amount} min={0} max={1.5} step={0.01} onChange={set} />
          <Row label="frequency" param="freq" value={s.freq} min={0.02} max={1.5} step={0.01} onChange={set} />
          <Row label="octaves" param="oct" value={s.oct} min={1} max={5} step={1} onChange={set} />
          <Row label="grain size px" param="size" value={s.size} min={32} max={512} step={8} onChange={set} />
          <Row label="anim fps" param="fps" value={s.fps} min={0} max={60} step={1} onChange={set} />
          <label className="scrim-tune__check">
            <input
              type="checkbox"
              checked={s.mono}
              onChange={(e) => set('mono', e.target.checked)}
            />
            mono (white speckle; off = rgb noise)
          </label>
        </>
      )}
      <p className="scrim-tune__note">
        grain rides the scrim's opacity fade. image texture not wired yet — say the word.
      </p>

      <label className="scrim-tune__path">
        bake block
        <textarea readOnly rows={4} value={copyBlock(s)} onFocus={(e) => e.target.select()} />
      </label>

      <div className="scrim-tune__actions">
        <button type="button" className="scrim-tune__btn" onClick={copy}>
          {copied ? '✓ copied' : 'copy values'}
        </button>
      </div>
    </aside>
  );
}
