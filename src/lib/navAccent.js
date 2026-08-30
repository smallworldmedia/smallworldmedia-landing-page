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
 */
import { projectColorVars } from './projectColor.js';

const KEYS = [
  '--project-color',
  '--project-color-2',
  '--project-color-fg',
  '--project-color-text',
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

/**
 * Write the accent vars to <html>. `animate` false = instant (page arrivals);
 * true = ride the CSS cross-fade (in-page /work project changes).
 */
export function applyNavAccent(primary, secondary, animate = true) {
  if (typeof document === 'undefined') return;
  last = { primary, secondary };
  const root = document.documentElement;
  const vars = projectColorVars(primary, secondary);
  const write = () => {
    for (const k of KEYS) {
      const v = vars[k];
      // NB: --nav-ink-l is 0 for a light accent (→ dark ink). 0 is falsy, so
      // guard on null/undefined — a truthiness check silently drops it and the
      // nav ink stays at its white @property initial (never darkens on HHS).
      if (v != null) root.style.setProperty(k, v);
      else root.style.removeProperty(k);
    }
    root.classList.add('fp-tint');
  };
  if (animate) write();
  else commitInstant(root, write);
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
  const root = document.documentElement;
  commitInstant(root, () => {
    for (const k of KEYS) root.style.removeProperty(k);
    root.classList.remove('fp-tint');
  });
}
