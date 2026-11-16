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
 * The eye sits in a square badge (site-scheme.css, the wrapper's ::before): blue on `blue`,
 * black on `black`, a glass overlay on `project`.
 *
 * Authority: colorScheme.js alone decides the scheme. This component calls
 * setScheme / onScheme and writes nothing of its own to the DOM except the
 * `is-pager-engaged` class on its wrapper, the dials below and the wrapper's
 * data-badge / data-ready. A scheme change
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
 *   ?schemerows ?schemesize ?schemepitch dial the deployed window (site-scheme.css);
 *   ?schemelift ?schemenear ?schemefar the engaged sizes; ?schemein ?schemeout the
 *   column's entrance and exit; ?schemebadge=flush|seat the square badge's seat.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import GraticulePager from './work/pager/GraticulePager.jsx';
import { SchemeSwatch, EyeArt, EyeDefs, EYE_LID_MASK } from './schemeSwatches.jsx';
import {
  SCHEMES,
  getScheme,
  getCommittedScheme,
  onScheme,
  setScheme,
} from '../lib/colorScheme.js';
import { schemeAt, stationOf, shouldPassWheel, schemeParams } from './siteSchemeLogic.js';

// The pager keys rows by `slug` and names them by `clientName`; `scheme` is ours.
const WORLDS = SCHEMES.map((name) => ({ slug: name, clientName: name, scheme: name }));
const LABELS = {
  nav: 'Color scheme',
  station: (i, n, name) => `Color scheme: ${name}`,
  live: (i, n, name) => `Color scheme ${i + 1} of ${n}: ${name}`,
};
// The column's circles are whole irises; the lens art is the eye (lids + the committed iris).
const renderSwatch = (item) => <SchemeSwatch scheme={item.scheme} />;
const renderEye = (item) => <EyeArt scheme={item.scheme} />;

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

  // Mount: params, dials, the scheme in force.
  useBeforePaint(() => {
    const p = schemeParams(new URLSearchParams(window.location.search));
    paramsRef.current = p;
    const el = cornerRef.current;
    if (el) {
      // The engine reads --scale-rows as a bare number: rows SHOWN = 2 x pitches each side + centre.
      el.style.setProperty('--scale-rows', String(p.rows / 2));
      // The lid opening, as the window's mask (the one source of the lid shape: schemeSwatches.jsx).
      el.style.setProperty('--eye-lid-mask', EYE_LID_MASK);
      if (p.size != null) el.style.setProperty('--scheme-swatch', `${p.size}px`);
      if (p.pitch != null) el.style.setProperty('--scheme-pitch', `${p.pitch}px`);
      // The engaged look (site-scheme.css owns the defaults; a dial writes only what it was given).
      if (p.lift != null) el.style.setProperty('--eye-engaged', String(p.lift));
      if (p.near != null) el.style.setProperty('--eye-near', String(p.near));
      if (p.far != null) el.style.setProperty('--eye-far', String(p.far));
      if (p.inMs != null) el.style.setProperty('--eye-in', `${p.inMs}ms`);
      if (p.outMs != null) el.style.setProperty('--eye-out', `${p.outMs}ms`);
      // The badge's seat (site-scheme.css reads [data-badge]); [data-ready] lets the badge
      // appear with the eye, never before it.
      el.dataset.badge = p.badge;
      el.dataset.ready = '';
    }
    setUi(p.ui);
    setActive(stationOf(getScheme()));
    setReady(true);
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
      {ready && <EyeDefs />}
      {ready && (
        <GraticulePager
          worlds={WORLDS}
          active={active}
          commit={(i) => setScheme(schemeAt(i))}
          onEngaged={(v) => {
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
          labels={LABELS}
          renderStation={renderSwatch}
          renderLens={renderEye}
        />
      )}
    </div>
  );
}
