/**
 * smoothScroll — the site's Lenis foundation (v1 launch).
 *
 * One Lenis instance smooths the document-scroll routes, driven from GSAP's
 * ticker so scroll and animation share a clock. Its smoothed scroll/velocity
 * is the signal Grid Socket parallax and the orbit's scroll-kick consume
 * (see docs/orbit-deck-viewer-spec.md § Lenis scroll foundation).
 *
 * Route rule: `/work` (exact) is excluded — the FeaturedProjects island owns
 * wheel physics there (World Turn) and Lenis must never contest it. Reduced
 * motion never initializes Lenis: native scroll, but getLenis() consumers
 * must handle null.
 *
 * ClientRouter keeps this module alive across client-side navigations;
 * BaseLayout calls syncRoute() on every `astro:page-load` to start/stop
 * per route.
 */
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { LENIS_TUNING } from './motion.js';

let lenis = null;
let tickerFn = null;

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Routes whose islands own the wheel — Lenis stays off. */
const ownsItsWheel = (pathname) => pathname.replace(/\/+$/, '') === '/work';

function start() {
  if (lenis) return;
  // House scroll feel: LENIS_TUNING (src/lib/motion.js) overlays the library
  // defaults — empty today, filled by the A2 dial-in session.
  //
  // A2b live dial — ?lerp (Lenis lerp), ?wheelmult (wheelMultiplier),
  // ?lenisdur (Lenis duration, SECONDS — switches Lenis to duration mode,
  // which overrides lerp). Only params present in the URL enter the
  // constructor, so with none set the input is byte-identical to
  // { autoRaf: false, ...LENIS_TUNING }. Blessed values from the dial
  // session get baked into LENIS_TUNING (motion.js).
  const overrides = {};
  if (typeof window !== 'undefined') {
    const search = new URLSearchParams(window.location.search);
    for (const [param, option] of [
      ['lerp', 'lerp'],
      ['wheelmult', 'wheelMultiplier'],
      ['lenisdur', 'duration'],
    ]) {
      const n = parseFloat(search.get(param));
      if (Number.isFinite(n)) overrides[option] = n;
    }
  }
  lenis = new Lenis({ autoRaf: false, ...LENIS_TUNING, ...overrides });
  tickerFn = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tickerFn);
  gsap.ticker.lagSmoothing(0);
}

function stop() {
  if (!lenis) return;
  gsap.ticker.remove(tickerFn);
  lenis.destroy();
  lenis = null;
  tickerFn = null;
}

/** Start or stop Lenis for the current (or given) route. */
export function syncRoute(pathname = window.location.pathname) {
  if (prefersReducedMotion() || ownsItsWheel(pathname)) stop();
  else start();
}

/**
 * The live Lenis instance, or null (reduced motion / wheel-owned route).
 * Consumers: `getLenis()?.velocity` for scroll-kick, `scroll` for parallax.
 */
export function getLenis() {
  return lenis;
}
