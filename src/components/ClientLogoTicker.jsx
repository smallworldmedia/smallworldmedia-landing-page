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
 * MARQUEE (09-08, Nathan): JS-driven on THE shared drag + momentum engine
 * (src/lib/dragMomentum.js — the home globe's choreography, one place).
 * The strip (two track copies) rolls at the AMBIENT velocity −`--logo-pxs`
 * px/s (constant, the fill-ticker doctrine); a pointer drag passes through
 * 1:1, a flick carries on the globe's inertia curve and settles back to the
 * roll. Position wraps modulo one track width, so the loop is seamless in
 * either direction. Runs only while the footer is revealing (or a drag /
 * flick is live).
 * ODOMETER: CSS keyframes only — five words + a clone of the first, one
 * `--logo-word-cycle` per word, hold/move baked into the percentages.
 *
 * Dials (?logoh ?logogap ?logomaxw ?logopxs ?logofrom ?logoto ?logowordcycle)
 * are applied IMPERATIVELY in the first effect — the panel is SSR'd on two
 * of its three routes and hydration keeps the server's inline style (the
 * GraticulePager trap, 09-07).
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import manifest from '../assets/client-logos/manifest.json';
import DragMomentum, { PX_MAX_SPEED } from '../lib/dragMomentum.js';
import { PREFERS_REDUCED_MOTION } from './globe/globeConfig.js';

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
  const rollRef = useRef(null);
  const stripRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const track = trackRef.current;
    const roll = rollRef.current;
    const strip = stripRef.current;
    if (!root || !track || !roll || !strip) return undefined;

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

    // The roll: ambient velocity = −px/s (leftward); a drag passes through
    // 1:1 (sensitivity 1 px/px); the flick cap is the globe's, in px.
    const pxs = () =>
      Math.max(0, parseFloat(getComputedStyle(root).getPropertyValue('--logo-pxs')) || 40);
    const engine = new DragMomentum(roll, {
      ambient: { x: PREFERS_REDUCED_MOTION ? 0 : -pxs(), y: 0 },
      sensitivity: 1,
      maxSpeed: PX_MAX_SPEED,
      reducedMotion: PREFERS_REDUCED_MOTION,
    });

    // One track width = the wrap period. Widths are deterministic from the
    // width/height attrs, so this settles at mount; the observer re-bases
    // on a real relayout (the 768 re-tier).
    let period = 0;
    const measure = () => {
      period = track.getBoundingClientRect().width;
      engine.setAmbient(PREFERS_REDUCED_MOTION ? 0 : -pxs(), 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);

    // Frame: integrate, wrap into (−period, 0], paint. Idle (parked footer,
    // no drag/flick) frames cost one attribute read.
    let x = 0;
    const html = document.documentElement;
    const tick = (_t, dtMs) => {
      const live = engine.dragging || gsap.isTweening(engine.vel) || html.hasAttribute('data-footer-revealed');
      if (!live || !period) return;
      const { dx } = engine.update(Math.min(dtMs / 1000, 0.1)); // tab-resume clamp
      if (!dx) return;
      x = (((x + dx) % period) + period) % period - period;
      strip.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    };
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      ro.disconnect();
      engine.dispose();
    };
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

      <div className="logo-ticker__roll" ref={rollRef}>
        <div className="logo-ticker__strip" ref={stripRef}>
          {renderTrack(false)}
          {renderTrack(true)}
        </div>
      </div>
    </div>
  );
}
