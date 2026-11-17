/**
 * SiteScheme — the corner pager that switches the site's colour scheme (US-7,
 * SQ-92, SQ-98). The /work graticule pager (GraticulePager) mounted a second time
 * in the lower-right corner, its three stations (project, black, blue; `spectrum` is
 * parked) drawn as globe-iris circles (schemeSwatches.jsx): NO visible text. The
 * scheme names exist for screen readers only (the stations' aria-labels and the
 * pager's sr-only live region).
 *
 * At rest: an EYE, two lids round an iris that is the committed scheme. Engaged
 * (hover, drag, wheel, touch, keyboard focus): a column of three circles (previous,
 * current, next) deploys on the lens axis, exactly the /work choreography (that engine
 * is LOCKED; this file and site-scheme.css are skin and wiring only); each circle
 * slides into the eye and becomes its iris. Each detent previews the
 * scheme under the lens across the site; release commits it; Escape, or any
 * disengage that commits nothing, restores the committed one.
 *
 * The eye sits in a rectangular badge whose right edge is the viewport's (site-scheme.css, the
 * pager's ::before), at ONE seat on every route (the corner row, a little off the bottom edge).
 * The badge is a clipping window onto a strip of three background panels (a glass overlay for
 * `project`, black, blue) that rides the column's own position: one detent, one badge height.
 * Engaged, the badge, the eye and the iris scale about one point, the badge's right edge at its
 * vertical centre. It is z 101, above the shell and so above the route fill, and stays put through
 * every page change. The info drawer, the privacy notice and the inquiry overlay hide it; the phone
 * menu's takeover does not: it is one level above (.site-menu-host, z 102), so its own wipe paints
 * over the badge, and SiteNav makes the badge inert while the menu is up.
 *
 * Authority: colorScheme.js alone decides the scheme. This component calls
 * setScheme / onScheme and writes nothing of its own to the DOM except the
 * `is-pager-engaged` class on its wrapper, the dials below and the wrapper's
 * data-ready. A scheme change
 * re-renders only this widget's lens art, never the page.
 *
 * It is a PERSISTED island (BaseLayout: transition:persist="site-scheme"), so its
 * mount effects never re-run after a soft navigation: every DOM lookup is lazy,
 * at fire time, off the wrapper ref.
 *
 * The pager is rendered after mount (not server-side): the first client render
 * already knows the scheme in force, so the lens never flashes the wrong swatch
 * and the pager's live region never announces the scheme unprompted on load.
 *
 * ?params (read once at mount; docs/tunables-guide.md "colour scheme"):
 *   ?schemeui=0 hides the widget; ?schemeguard=<ms> the wheel pass-through guard;
 *   ?schemerows ?schemesize ?schemegap dial the deployed window and its spacing (site-scheme.css);
 *   ?schemelift ?schemenear ?schemefar the engaged sizes; ?schemein ?schemeout each circle's own
 *   entrance and exit; ?schemepad the badge's padding round the eye; ?schemeshift the engaged eye's
 *   step left off the viewport's edge; ?schemeslide ?schemegrow ?schemestep the engage's sequence (the
 *   slide, then the grow, a beat between the eye and the near and the far rings; the release backwards);
 *   ?schemelids the lids' scale.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import GraticulePager from './work/pager/GraticulePager.jsx';
import { SchemeSwatch, EyeArt, EyeDefs } from './schemeSwatches.jsx';
import {
  SCHEMES,
  getScheme,
  getCommittedScheme,
  onScheme,
  setScheme,
} from '../lib/colorScheme.js';
import {
  schemeAt,
  stationOf,
  shouldPassWheel,
  schemeParams,
  eyeDelays,
  eyeGeometry,
  LIDS,
} from './siteSchemeLogic.js';

// The pager keys rows by `slug` and names them by `clientName`; `scheme` is ours.
const WORLDS = SCHEMES.map((name) => ({ slug: name, clientName: name, scheme: name }));
const LABELS = {
  nav: 'Color scheme',
  station: (i, n, name) => `Color scheme: ${name}`,
  live: (i, n, name) => `Color scheme ${i + 1} of ${n}: ${name}`,
};
// The column's circles are whole irises; the lens art is the eye (lids + the committed iris).
const renderSwatch = (item) => <SchemeSwatch scheme={item.scheme} />;

// The sequence (SQ-107 pass 11): at each engage and release, write the delays between the four groups of the
// engage (the slide, the grow, the near ring, the far ring; site-scheme.css) from where each one is NOW, so a
// group that has moved never waits out a delay that belongs to a group that never started (a quick tap, a hover
// that leaves mid-entrance). Written before the engine's own state change lands (the engine calls onEngaged first,
// React commits data-open after), so the transitions it starts read them.
const GROUPS = ['s', 'g', 'n', 'f'];
function planSequence(corner, dir) {
  const pager = corner?.querySelector('.fp-scale');
  if (!pager) return;
  const cs = getComputedStyle(pager);
  const now = {};
  for (const k of GROUPS) now[k] = parseFloat(cs.getPropertyValue(`--eye-t${k}`)) || 0;
  const cc = getComputedStyle(corner);
  const ms = (name, d) => {
    const v = parseFloat(cc.getPropertyValue(name));
    return Number.isFinite(v) ? v : d;
  };
  // Above 768px the far ring (two stations out) is never seen (--eye-up-shown 1: one circle above the lens, one
  // below), so it is counted as already arrived and no beat is spent on it: the release starts with the near ring.
  if (ms('--eye-up-shown', 2) < 2) now.f = dir === 'in' ? 1 : 0;
  const d = eyeDelays(dir, now, {
    slide: ms('--eye-slide', 160),
    grow: ms('--eye-grow', 160),
    step: ms('--eye-step', 70),
  });
  for (const k of GROUPS) corner.style.setProperty(`--eye-dl-${k}`, `${d[k]}ms`);
  corner.style.setProperty('--eye-dl-h', `${d.h}ms`);
}

// The badge's width, onto <html> as --badge-reserve (global.css), for what keeps clear of the badge (the privacy pill,
// the footer link row, a phone's home blurb). global.css holds the defaults; a dial that changes the width (size, pad,
// lids) rewrites it from the corner's own resolved tokens, the same sum site-scheme.css makes (--badge-w). ClientRouter
// replaces every <html> attribute on a swap, the inline style included, so the caller re-asserts it after one.
function writeBadgeReserve(corner) {
  if (!corner) return;
  const cs = getComputedStyle(corner);
  const n = (name) => parseFloat(cs.getPropertyValue(name));
  const w = (n('--scheme-swatch') * n('--eye-u-w')) / 26 + 2 * n('--badge-pad');
  if (Number.isFinite(w)) document.documentElement.style.setProperty('--badge-reserve', `${+w.toFixed(3)}px`);
}

// Layout effect on the client (the dials must land before the pager's own passive
// effects read --scale-rows), a plain effect where there is no layout.
const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function SiteScheme() {
  const cornerRef = useRef(null);
  const engagedRef = useRef(false);
  const paramsRef = useRef(null);
  // Hydration-safe seed: nothing renders until the mount effect has read the scheme in force.
  const [ready, setReady] = useState(false);
  const [ui, setUi] = useState(true);
  const [active, setActive] = useState(0);
  // The lids' scale (?schemelids): the eye's art and its clip are drawn at it, the CSS box follows (--eye-u-w / -h).
  const [lids, setLids] = useState(LIDS);

  // Mount: params, dials, the scheme in force.
  useBeforePaint(() => {
    const p = schemeParams(new URLSearchParams(window.location.search));
    paramsRef.current = p;
    let stopReserve = () => {};
    const el = cornerRef.current;
    if (el) {
      // The engine reads --scale-rows as a bare number: rows SHOWN = 2 x pitches each side + centre.
      el.style.setProperty('--scale-rows', String(p.rows / 2));
      if (p.size != null) el.style.setProperty('--scheme-swatch', `${p.size}px`);
      if (p.gap != null) el.style.setProperty('--scheme-gap', `${p.gap}px`);
      // The engaged look (site-scheme.css owns the defaults; a dial writes only what it was given).
      if (p.lift != null) el.style.setProperty('--eye-engaged', String(p.lift));
      if (p.near != null) el.style.setProperty('--eye-near', String(p.near));
      if (p.far != null) el.style.setProperty('--eye-far', String(p.far));
      if (p.pad != null) el.style.setProperty('--badge-pad', `${p.pad}px`);
      if (p.clear != null) el.style.setProperty('--badge-clear', `${p.clear}px`);
      if (p.shift != null) el.style.setProperty('--eye-shift', `${p.shift}px`);
      if (p.inMs != null) el.style.setProperty('--eye-in', `${p.inMs}ms`);
      if (p.outMs != null) el.style.setProperty('--eye-out', `${p.outMs}ms`);
      if (p.slideMs != null) el.style.setProperty('--eye-slide', `${p.slideMs}ms`);
      if (p.growMs != null) el.style.setProperty('--eye-grow', `${p.growMs}ms`);
      if (p.stepMs != null) el.style.setProperty('--eye-step', `${p.stepMs}ms`);
      if (p.lids != null) {
        const g = eyeGeometry(p.lids);
        el.style.setProperty('--eye-u-w', String(+g.w.toFixed(4)));
        el.style.setProperty('--eye-u-h', String(+g.h.toFixed(4)));
        setLids(p.lids);
      }
      // [data-ready] lets the badge appear with the eye, never before it.
      el.dataset.ready = '';
      // The badge's width for the things that keep clear of it, only when a dial moved it.
      if (p.size != null || p.pad != null || p.lids != null) {
        const reserve = () => writeBadgeReserve(cornerRef.current);
        reserve();
        document.addEventListener('astro:after-swap', reserve);
        stopReserve = () => document.removeEventListener('astro:after-swap', reserve);
      }
    }
    setUi(p.ui);
    setActive(stationOf(getScheme()));
    setReady(true);
    return () => stopReserve();
  }, []);

  // The lens follows SETTLED changes only (a preview moves the page, never the lens art).
  useEffect(
    () =>
      onScheme(({ scheme, preview }) => {
        if (!preview) setActive(stationOf(scheme));
      }),
    []
  );

  // Wheel guard. The pager captures the wheel while the pointer is over it, which
  // would stall a page scroll that happens to pass under the corner. A wheel event
  // seen OUTSIDE the widget arms a guard of ?schemeguard ms (renewed by each further
  // one, so a scroll that began outside stays a page scroll): while it is up the
  // wrapper is pointer-events:none (site-scheme.css), so the very next wheel event
  // is hit-tested to the page underneath and takes its normal path (Lenis, the home
  // footer reveal, the /work accumulator) with nothing stopped or prevented. After
  // a pause the wheel over the widget pages it. 0 turns the guard off.
  useEffect(() => {
    let lastOutsideAt = -Infinity;
    let timer = 0;
    const gate = (on) => cornerRef.current?.toggleAttribute('data-wheel-guard', on);
    const guardMs = () => paramsRef.current?.guardMs ?? 200;
    const settle = () => {
      const now = performance.now();
      if (shouldPassWheel(now, lastOutsideAt, guardMs())) {
        timer = window.setTimeout(settle, lastOutsideAt + guardMs() - now);
      } else {
        timer = 0;
        gate(false);
      }
    };
    const onWheel = (e) => {
      const corner = cornerRef.current;
      if (!corner || corner.contains(e.target)) return;
      lastOutsideAt = performance.now();
      if (!shouldPassWheel(lastOutsideAt, lastOutsideAt, guardMs())) return;
      gate(true);
      if (!timer) timer = window.setTimeout(settle, guardMs());
    };
    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => {
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.clearTimeout(timer);
      gate(false);
    };
  }, []);

  if (!ui) return null;

  return (
    <div
      className="swm-corner"
      ref={cornerRef}
      // A press-and-hold must never raise the OS image / save / copy dialog or start a drag
      // (the widget's art is svg): the engine cancels contextmenu on its pager root; this
      // covers the whole widget, the drag-start included (site-scheme.css does the rest).
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {ready && <EyeDefs lids={lids} />}
      {ready && (
        <GraticulePager
          worlds={WORLDS}
          active={active}
          commit={(i) => setScheme(schemeAt(i))}
          onEngaged={(v) => {
            planSequence(cornerRef.current, v ? 'in' : 'out');
            engagedRef.current = v;
            cornerRef.current?.classList.toggle('is-pager-engaged', v);
            // A disengage that committed nothing (a cancelled gesture) puts the
            // committed scheme back; after a commit the two already agree.
            if (!v && getScheme() !== getCommittedScheme()) setScheme(getCommittedScheme());
          }}
          // The engine also fires detents while it glides home after release or
          // Escape (and one at engage); only a crossing made while engaged is a preview.
          onPreview={(i) => {
            if (engagedRef.current) setScheme(schemeAt(i), { preview: true });
          }}
          pauseOn={false}
          hintOn={false}
          wrap
          className="swm-corner__pager"
          cssPitch
          labels={LABELS}
          renderStation={renderSwatch}
          renderLens={(item) => <EyeArt scheme={item.scheme} lids={lids} />}
        />
      )}
    </div>
  );
}
