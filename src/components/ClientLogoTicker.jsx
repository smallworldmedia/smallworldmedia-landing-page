/**
 * ClientLogoTicker — the client-logo band that rides the top of the links
 * footer (09-07, Nathan). Copy line + a vertical odometer word ticker, then a
 * single full-width row of client logos rolling ONE direction in a seamless
 * loop (no two-row counter-marquee).
 *
 * REVEAL: no scroll listener of its own. SiteFooter renders this as the first
 * child of its fixed panel, so the band rides the panel's translateY in both
 * the scroll and the driven (/work) modes; its fade is a window over the
 * footer's own `--footer-reveal` broadcast (global.css `.logo-ticker`), and
 * both animations are gated on `html[data-footer-revealed]` so nothing runs
 * while the footer is parked. One motion, one listener.
 *
 * ASSETS: static for now (Nathan 09-07 — Sanity later once the set is final).
 * `scripts/prep-client-logos.mjs` normalises the intake `Client Logos/` dump
 * into `src/assets/client-logos/` (white-on-transparent, ≤240px tall) plus a
 * manifest with intrinsic w/h. The glob below reads that folder — nothing is
 * hard-coded, a new logo lands by re-running the script. The manifest dims go
 * on each <img> as width/height so the row's width is deterministic BEFORE
 * the images load (the UA maps the attrs to aspect-ratio): the marquee's
 * duration is measured once at mount, never re-based mid-roll.
 *
 * MARQUEE: track rendered twice, keyframe translateX(0 → -50%); duration =
 * track width ÷ `--logo-pxs` (constant px/s, the fill-ticker doctrine).
 * ODOMETER: CSS keyframes only — five words + a clone of the first, one
 * `--logo-word-cycle` per word, hold/move baked into the percentages.
 *
 * Dials (?logoh ?logogap ?logomaxw ?logopxs ?logofrom ?logoto ?logowordcycle)
 * are applied IMPERATIVELY in the first effect — the panel is SSR'd on two
 * of its three routes and hydration keeps the server's inline style (the
 * GraticulePager trap, 09-07).
 */
import { useEffect, useRef } from 'react';
import manifest from '../assets/client-logos/manifest.json';

const URLS = import.meta.glob('../assets/client-logos/*.{svg,png}', {
  eager: true,
  query: { url: true, 'no-inline': true },
  import: 'default',
});

/** {id, name, src, w, h} — the shape a later Sanity loader must return. */
export const LOGOS = manifest
  .map((m) => ({
    id: m.file.replace(/\.(svg|png)$/, ''),
    name: m.name,
    src: URLS[`../assets/client-logos/${m.file}`],
    w: m.w,
    h: m.h,
  }))
  .filter((l) => l.src);

export const COPY = 'Utilized by a full spectrum of industry';
export const WORDS = ['artists', 'promoters', 'labels', 'agencies', 'venues'];

// Optical balance (09-08, Nathan): height-fitting every mark makes a square
// badge read half the size of an 8:1 wordmark. Each mark's height is scaled
// by (REF ÷ aspect)^k — k = 0.5 equalises AREA, 0 = pure height-fit, 1 =
// equal width — so squares come UP and wide wordmarks come DOWN toward one
// perceived size. Clamped so nothing balloons or vanishes. Mirrors the
// global.css bake (--logo-bal / --logo-ref-ar); ?logobal ?logoref re-run it
// at mount.
const BAL_K = 0.5;
const BAL_REF_AR = 3;
const BAL_MIN = 0.55;
const BAL_MAX = 2;
export const balance = (w, h, k = BAL_K, ref = BAL_REF_AR) =>
  Math.min(BAL_MAX, Math.max(BAL_MIN, Math.pow(ref / (w / h), k)));

// Live tuning (?key=value) — the FeaturedProjects knobs convention.
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

export default function ClientLogoTicker() {
  const rootRef = useRef(null);
  const trackRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    if (!root || !track) return undefined;

    // Dials first (they change the widths the measure below reads). Literal
    // PARAM('key') calls so scripts/tunables-keys.mjs inventories them.
    const dial = (token, unit, v) => {
      if (Number.isFinite(v)) root.style.setProperty(token, `${v}${unit}`);
    };
    dial('--logo-h', 'px', PARAM('logoh', NaN));
    dial('--logo-gap', 'px', PARAM('logogap', NaN));
    dial('--logo-max-w', '', PARAM('logomaxw', NaN));
    dial('--logo-pxs', '', PARAM('logopxs', NaN));
    dial('--logo-reveal-from', '', PARAM('logofrom', NaN));
    dial('--logo-reveal-to', '', PARAM('logoto', NaN));
    dial('--logo-word-cycle', 'ms', PARAM('logowordcycle', NaN));
    const k = PARAM('logobal', NaN);
    const ref = PARAM('logoref', NaN);
    if (Number.isFinite(k) || Number.isFinite(ref)) {
      root.querySelectorAll('.logo-ticker__item').forEach((li) => {
        const { w, h } = li.dataset;
        li.style.setProperty(
          '--lf',
          balance(+w, +h, Number.isFinite(k) ? k : BAL_K, Number.isFinite(ref) ? ref : BAL_REF_AR).toFixed(3),
        );
      });
    }

    // Duration = one track width ÷ px/s. Widths are deterministic from the
    // width/height attrs, so this settles at mount; the observer only
    // re-bases on a real relayout (the 768 re-tier), where a phase jump is
    // invisible under the tier's own reflow.
    let lastW = 0;
    const measure = () => {
      const w = track.getBoundingClientRect().width;
      if (!w || Math.abs(w - lastW) < 1) return;
      lastW = w;
      const pxs = Math.max(1, parseFloat(getComputedStyle(root).getPropertyValue('--logo-pxs')) || 40);
      root.style.setProperty('--logo-roll-s', `${(w / pxs).toFixed(2)}s`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, []);

  const renderTrack = (hidden) => (
    <ul
      className="logo-ticker__track"
      ref={hidden ? undefined : trackRef}
      aria-hidden={hidden || undefined}
    >
      {LOGOS.map((l) => (
        <li
          className="logo-ticker__item"
          key={l.id}
          data-w={l.w}
          data-h={l.h}
          style={{ '--lf': balance(l.w, l.h).toFixed(3) }}
        >
          <img
            className="logo-ticker__img"
            src={l.src}
            alt={hidden ? '' : l.name}
            width={Math.round(l.w)}
            height={Math.round(l.h)}
            loading="eager"
            decoding="async"
            draggable="false"
          />
        </li>
      ))}
    </ul>
  );

  return (
    <div className="logo-ticker" ref={rootRef}>
      <p className="logo-ticker__copy">
        <span className="logo-ticker__lead">{COPY}</span>{' '}
        <span className="logo-ticker__odo" aria-hidden="true">
          {/* sizer: every word in one grid cell → the box is as wide as the
              longest word, so the line never reflows as words swap */}
          <span className="logo-ticker__odo-sizer">
            {WORDS.map((w) => (
              <span key={w}>{w}</span>
            ))}
          </span>
          <span className="logo-ticker__odo-col">
            {[...WORDS, WORDS[0]].map((w, i) => (
              <span className="logo-ticker__odo-word" key={`${w}-${i}`}>
                {w}
              </span>
            ))}
          </span>
        </span>
        <span className="sr-only">{WORDS.join(', ')}.</span>
      </p>

      <div className="logo-ticker__roll">
        {renderTrack(false)}
        {renderTrack(true)}
      </div>
    </div>
  );
}
