/**
 * navAccent — the SINGLE control point for the persistent nav bar's project
 * accent.
 *
 * The nav lives in the `transition:persist` SiteShell (z-100), so it stays
 * mounted and VISIBLE above the RouteFill through every route swap. Its colour
 * is driven by CSS vars on <html> (`--project-color`, `--nav-ink-l`, …). This
 * module is the only place that writes them, shared by every surface that owns
 * the nav's colour:
 *   • /work index — live, per active World (FeaturedProjects, on scroll)
 *   • detail page — per project, applied before paint by the RouteFill route
 *     controller (astro:after-swap), so the nav never resets to brand blue
 *     between pages and the colour survives the breadcrumb back to /work.
 *   • home — the population world on the globe (Hero, ?popmode), under
 *     html.pop-tint instead of fp-tint: home keeps its own chrome and only
 *     its brand-blue accents take the colour.
 *
 * Colour-change choreography across passages (11-12, Nathan): the nav and every
 * colour-tagged element read ONE var on <html> (--project-color), so a change
 * is synchronised by starting that var's cross-fade on the SAME frame, with the
 * SAME duration and curve, as the page-background change it belongs to (the
 * RouteFill cover rising or lifting, the next-project band's window).
 *   • `fade` ({ seconds, ease }) on applyNavAccent / retargetNavAccent rides the
 *     CSS cross-fade at that duration and curve (the curve is sampled into a CSS
 *     `linear()` so ANY GSAP ease, a CustomEase included, matches exactly).
 *   • hold / release: home → /work keeps the nav BLACK through the swap (the
 *     globe's black bar) and releases the project colour only when the cover
 *     lifts, so the nav and every tagged element arrive on one frame.
 */
import { projectColorVars } from './projectColor.js';

/** The globe page's black: the passage cover, and the nav a held passage wears. */
export const NAV_BLACK = '#000000';

/**
 * Sample an easing function (t 0..1 → progress) into a CSS `linear()` timing
 * function, so a CSS transition can follow a GSAP curve exactly. Endpoints are
 * pinned to 0 and 1.
 */
export function easeToCss(ease, samples = 48) {
  if (typeof ease !== 'function') return null;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const v = i === 0 ? 0 : i === samples ? 1 : ease(i / samples);
    pts.push(Number.isFinite(v) ? +v.toFixed(4) : i / samples);
  }
  return `linear(${pts.join(', ')})`;
}

// linear() is Chrome 113 / Safari 17.2 / Firefox 112. Where it is missing the
// fade keeps the house panel curve at the passage's duration (close, not exact).
const supportsLinear = () =>
  typeof CSS !== 'undefined' && CSS.supports?.('transition-timing-function', 'linear(0, 1)');

const KEYS = [
  '--project-color',
  '--project-color-2',
  '--project-color-fg',
  '--project-color-text',
  // 10-08: projectColorVars has always emitted this (accentOnBlack), but it
  // never reached <html> — so it had zero consumers and a CSS-only binding to
  // it would silently resolve to the blue fallback on every route. The privacy
  // pills are fixed siblings outside the /work card subtrees that carry it
  // inline, so <html> is the only place they can see it.
  '--project-color-on-black',
  '--project-globe-filter',
  '--nav-ink-l',
];

// Remembered across client navigations (module state survives the ClientRouter
// swap) so a route that can't declare its accent statically — /work, whose
// active project is client-only — can re-assert the colour it had before the
// swap (astro wipes <html>'s inline style during the swap).
let last = { primary: undefined, secondary: undefined };

// Suppress the accent cross-fades for a single instant application (page
// arrivals must NOT animate up from the brand-blue initial value — that is
// the flash we are removing). In-page changes keep the smooth cross-fade.
// Two channels to silence: the <html> @property transitions (transition:
// none) AND the ELEMENT-LOCAL ink transitions on the nav links/pill/lockup
// (08-29 paint-invalidation fix) — those read the inherited --ink-fade
// duration, so zeroing it for the flush snaps them in the same commit.
function commitInstant(root, mutate) {
  const prev = root.style.transition;
  root.style.transition = 'none';
  root.style.setProperty('--ink-fade', '0s');
  mutate();
  void root.offsetWidth; // flush the change with the transitions disabled
  root.style.transition = prev;
  root.style.removeProperty('--ink-fade');
}

// A cross-fade at a passage's own duration and curve (see the header). The
// overrides only have to be in force for the style flush that STARTS the
// transitions (a running transition keeps the duration/curve it started with),
// so they are dropped straight after it.
function commitFaded(root, mutate, { seconds, ease, delay = 0 }) {
  root.style.setProperty('--project-color-fade', `${Math.round(seconds * 1000)}ms`);
  if (delay) root.style.setProperty('--accent-delay', `${Math.round(delay * 1000)}ms`);
  const css = supportsLinear() ? easeToCss(ease) : null;
  if (css) root.style.setProperty('--accent-ease', css);
  mutate();
  void root.offsetWidth; // start every accent transition on this duration + curve
  root.style.removeProperty('--project-color-fade');
  root.style.removeProperty('--accent-ease');
  root.style.removeProperty('--accent-delay');
}

// While held, every accent write paints the globe's black instead and only
// REMEMBERS the colour it was given (`last`), for releaseNavAccent to ride in.
let held = false;

/** Keep the nav (and every tagged element) black until releaseNavAccent. */
export function holdNavAccent() {
  held = true;
}

export function isNavAccentHeld() {
  return held;
}

/**
 * Let go of a hold: paint the colour remembered while held. `fade` rides the
 * CSS cross-fade at the lifting cover's duration and curve; no `fade` = instant.
 * `fade.delay` (seconds, negative = already that far in) phase-locks the fade to
 * a lift whose own clock was late to start.
 */
export function releaseNavAccent(fade) {
  if (!held) return;
  held = false;
  applyNavAccent(last.primary, last.secondary, !!fade, { fade });
}

/**
 * Begin a passage's colour change NOW, on the passage's own clock: the nav and
 * every tagged element cross-fade to `primary` over `fade` ({ seconds, ease }).
 * Does nothing when the accent already is (or is held to) that colour. `fade`
 * null = cut. Returns true when it started a change.
 */
export function retargetNavAccent(primary, secondary, fade) {
  if (held) return false;
  if ((primary ?? null) === (last.primary ?? null) && (secondary ?? null) === (last.secondary ?? null)) return false;
  applyNavAccent(primary ?? undefined, secondary ?? undefined, !!fade, { fade });
  return true;
}

/**
 * Write the accent vars to <html>. `animate` false = instant (page arrivals);
 * true = ride the CSS cross-fade (in-page /work project changes), at `fade`'s
 * duration and curve when given. `tint` is the <html> class that scopes which
 * chrome takes it (pop-tint on home).
 */
export function applyNavAccent(primary, secondary, animate = true, { tint = 'fp-tint', fade } = {}) {
  if (typeof document === 'undefined') return;
  last = { primary, secondary };
  const root = document.documentElement;
  const vars = held ? projectColorVars(NAV_BLACK) : projectColorVars(primary, secondary);
  const write = () => {
    for (const k of KEYS) {
      const v = vars[k];
      // NB: --nav-ink-l is 0 for a light accent (→ dark ink). 0 is falsy, so
      // guard on null/undefined — a truthiness check silently drops it and the
      // nav ink stays at its white @property initial (never darkens on HHS).
      if (v != null) root.style.setProperty(k, v);
      else root.style.removeProperty(k);
    }
    root.classList.add(tint);
  };
  if (!animate) commitInstant(root, write);
  else if (fade) commitFaded(root, write, fade);
  else write();
}

/** Re-assert the last accent instantly (post-swap, for routes without a static
 *  declaration — i.e. /work after the breadcrumb back). */
export function reapplyNavAccent() {
  applyNavAccent(last.primary, last.secondary, false);
}

/** Drop the accent (routes that never tint — home / process). Instant. */
export function clearNavAccent() {
  if (typeof document === 'undefined') return;
  last = { primary: undefined, secondary: undefined };
  held = false;
  const root = document.documentElement;
  commitInstant(root, () => {
    for (const k of KEYS) root.style.removeProperty(k);
    root.classList.remove('fp-tint', 'pop-tint');
  });
}
