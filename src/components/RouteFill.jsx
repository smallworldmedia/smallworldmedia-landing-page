/**
 * RouteFill — the persistent solid-fill bridge for cross-route transitions
 * (ADR-0002 Envelopment). A fixed electric-blue layer that lives in the
 * persistent SiteShell, so it survives the ClientRouter page swap: the
 * departing route covers the screen with it, the canvas swap happens behind
 * it, and the arriving route releases it once its scene is mounted.
 *
 * Cross-island protocol (CustomEvents, house convention):
 *   - `swm:envelop`       → cover. detail.duration overrides the fade-in;
 *     detail.color (S2) tints the fill to the destination project's accent
 *     for this passage (absent → the default brand blue).
 *   - `swm:fill-release`  → uncover. Dispatched by the destination on mount.
 *   - `swm:fill-progress` → partial opacity tracking a live gesture
 *     (detail.value 0..1, detail.duration optional). Input stays live —
 *     this is the scroll-anchored pre-cover, not the passage itself.
 *
 * The globe loader (SQ-32) rides this same layer for the two passages with a
 * wait in them: home → /work (opens over the hero's blue, `swm:loader-start`)
 * and FP card → detail (`swm:envelop` with `loaderAfterCover`: opens
 * ?loaderlead ms after the cover is fully up, and never opens if the page is
 * ready first). One path, GlobeLoader's start/stop handle.
 *
 * Safety valve: if a page loads while covered and nothing asks for a release
 * (a failed navigation, a route without the handshake), the fill lets go on
 * its own — the user is never stranded on a blue screen.
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { applyNavAccent, reapplyNavAccent, clearNavAccent } from '../lib/navAccent.js';
import { buildTimeline } from '../lib/globeLoaderGeometry.js';
import GlobeLoader, { readLoaderDials } from './ui/GlobeLoader.jsx';
// Loader pacing knobs (?loaderlead / ?loaderend, ?committune bench) — read at
// fire time so the bench moves them live.
import { TUNING as HERO_TUNING } from './hero/heroConfig.js';

// Live tuning (?key=value, ms) — read once when the persistent shell first
// mounts, so put the knob on the URL you LOAD (it survives client navs).
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

const COVER_SECONDS = PARAM('fillcover', 100) / 1000; // fallback only — dispatchers pass their own
const RELEASE_SECONDS = PARAM('fillrelease', 400) / 1000; // fade off over the arriving scene
const RELEASE_DELAY = 0.1; // one settle beat so the arriving scene has a frame up
const LOADER_IN_SECONDS = 0.3; // the loader's fade up (10-06)
// FP card → detail waits far less than home → /work, so its draw-in is
// compressed: ?loaderquick scales the loader's stagger/draw times (1 = the
// full draw). home → /work always draws full. Dial read once, like the above.
const LOADER_QUICK = PARAM('loaderquick', 0.4);
const SAFETY_MS = 2500;

const scaleTiming = (t, k) => ({
  ...t,
  meridianStaggerMs: t.meridianStaggerMs * k,
  drawMs: t.drawMs * k,
  parallelStaggerMs: t.parallelStaggerMs * k,
});

export default function RouteFill() {
  const fillRef = useRef(null);
  const loaderRef = useRef(null); // the loader layer (08-25; the globe since SQ-32)
  const globeRef = useRef(null); // GlobeLoader's { start, stop } handle
  // The ?loader… draw dials (docs/tunables-guide.md), read once after mount
  // (null until then, and the globe mounts with them); `quick` swaps in the
  // compressed FP → detail draw.
  const [dials, setDials] = useState(null);
  const [quick, setQuick] = useState(false);
  const timing = dials && (quick ? scaleTiming(dials.timing, LOADER_QUICK) : dials.timing);
  const timingRef = useRef(timing);
  timingRef.current = timing;
  useEffect(() => setDials(readLoaderDials()), []);

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return undefined;
    const loader = loaderRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let covered = false;
    let safetyTimer = null;
    let loaderUp = false;
    let loaderAt = 0; // performance.now() when the draw-in started
    let loaderTimer = null; // the pending FP → detail "after the cover" start

    // ── The loader (overviews_loading 08-25, Nathan; 08-27 (4) repaced; the
    // lockup globe since SQ-32 — it replaced the percentage bar). It bridges
    // the two passages with a wait in them. A SIBLING of the fill, so the
    // departing hero can open it EARLY — `swm:loader-start`, ?loaderlead ms
    // after the button is out, over the hero's own spreading blue (detail.loader
    // stays as the fallback trigger) — and the FP card → detail passage opens it
    // ?loaderlead ms after its cover is fully up (detail.loaderAfterCover).
    // Dummy by design: the globe paces the WAIT, it does not measure progress.
    const loaderStart = () => {
      if (!loader || reducedMotion || loaderUp) return;
      loaderUp = true;
      loaderAt = performance.now();
      gsap.killTweensOf(loader);
      globeRef.current?.start();
      // 10-06 (Nathan: it "comes in too quickly"): a short fade up, not a pop.
      gsap.fromTo(loader, { autoAlpha: 0 }, { autoAlpha: 1, duration: LOADER_IN_SECONDS, ease: 'power2.out' });
    };
    // ?loaderend, read live: the most the reveal may WAIT after the page is
    // ready for the draw-in to finish (0 = cut with the reveal).
    const loaderEndSeconds = () => Math.max(0, (HERO_TUNING.loaderEndMs ?? 300) / 1000);
    // How long the reveal waits: whatever is left of the draw-in, capped at
    // ?loaderend. A page that was slow enough to outlast the draw adds nothing.
    const loaderHoldSeconds = () => {
      if (!loaderUp) return 0;
      const left = buildTimeline(timingRef.current).drawEnd - (performance.now() - loaderAt) / 1000;
      return Math.min(loaderEndSeconds(), Math.max(0, left));
    };
    const loaderFinish = (holdS) => {
      if (!loaderUp || !loader) return;
      loaderUp = false;
      // A sibling no longer rides the fill's fade — mirror it exactly
      // (same delay + duration + curve), then park the globe for the next passage.
      gsap.to(loader, {
        autoAlpha: 0,
        duration: RELEASE_SECONDS,
        delay: holdS + RELEASE_DELAY,
        ease: 'power2.inOut',
        onComplete: () => {
          globeRef.current?.stop();
          setQuick(false);
        },
      });
    };

    const release = () => {
      clearTimeout(safetyTimer);
      loaderTimer?.kill();
      if (!covered) return;
      covered = false;
      fill.style.pointerEvents = 'none';
      // Read BEFORE loaderFinish flips loaderUp: the reveal waits out the rest
      // of the draw-in (capped); the loader-less passages don't wait at all.
      const holdS = loaderHoldSeconds();
      loaderFinish(holdS);
      if (reducedMotion) {
        gsap.set(fill, { autoAlpha: 0 });
        return;
      }
      gsap.to(fill, {
        autoAlpha: 0,
        duration: RELEASE_SECONDS,
        delay: RELEASE_DELAY + holdS,
        ease: 'power2.inOut',
        overwrite: true,
      });
    };

    const cover = (e) => {
      covered = true;
      fill.style.pointerEvents = 'auto'; // swallow input during the passage
      // S2: tint the fill to the destination project's accent for this
      // passage. Set the same --project-color token the CSS resolves through;
      // clearing it when absent restores the brand-blue fallback, so every
      // transition explicitly establishes its color (no stale tint carries over).
      const color = e?.detail?.color;
      if (color) fill.style.setProperty('--project-color', color);
      else fill.style.removeProperty('--project-color');
      const coverS = e?.detail?.duration ?? COVER_SECONDS;
      loaderTimer?.kill();
      if (e?.detail?.loader) {
        if (e.detail.loaderAfterCover) {
          // FP card → detail: the loader opens once the cover is fully up
          // (+ ?loaderlead), on the compressed draw — unless the page is
          // ready first, in which case release() cancels it and it never shows.
          setQuick(true);
          loaderTimer = gsap.delayedCall(coverS + Math.max(0, HERO_TUNING.loaderLeadMs) / 1000, loaderStart);
        } else {
          setQuick(false);
          loaderStart();
        }
      }
      if (reducedMotion) {
        gsap.set(fill, { autoAlpha: 1 });
        return;
      }
      gsap.to(fill, {
        autoAlpha: 1,
        duration: coverS,
        ease: 'power2.in',
        overwrite: true,
      });
    };

    // Scroll-anchored pre-cover: opacity follows the gesture while the scene
    // underneath stays fully interactive. A commit (`swm:envelop`) takes over
    // from whatever opacity the drag reached — never the other way around.
    const progress = (e) => {
      if (covered || reducedMotion) return;
      const value = Math.min(1, Math.max(0, e?.detail?.value ?? 0));
      gsap.to(fill, {
        autoAlpha: value,
        duration: e?.detail?.duration ?? 0.12,
        ease: 'power2.out',
        overwrite: true,
      });
    };

    // A navigation landed while covered: give the destination a moment to
    // claim the release itself, then let go regardless.
    const onPageLoad = () => {
      if (!covered) return;
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(release, SAFETY_MS);
    };

    // ── Single nav-accent control point across route swaps ──
    // The nav (z-100 shell) stays visible above this fill through every passage,
    // so its colour must be right on the FIRST painted frame of the arriving
    // route. astro:after-swap runs before that paint — and after astro has wiped
    // <html>'s inline style — so re-establishing the accent here removes the
    // brand-blue flash. Detail pages declare their accent statically
    // (data-nav-accent-page); /work owns its own live, so we just re-assert the
    // colour it carried into the swap (keeps it through the breadcrumb back);
    // home/process clear back to blue.
    const syncNavAccent = () => {
      const page = document.querySelector('[data-nav-accent-page]');
      if (page) {
        applyNavAccent(page.dataset.navAccent || undefined, page.dataset.navAccent2 || undefined, false);
        return;
      }
      const route = document.body.className;
      if (route.includes('route-home') || route.includes('route-process')) {
        clearNavAccent();
        return;
      }
      reapplyNavAccent(); // /work — keep the pre-swap colour (breadcrumb back)
    };

    const loaderEarly = () => loaderStart();
    window.addEventListener('swm:envelop', cover);
    window.addEventListener('swm:fill-release', release);
    window.addEventListener('swm:fill-progress', progress);
    window.addEventListener('swm:loader-start', loaderEarly);
    document.addEventListener('astro:page-load', onPageLoad);
    document.addEventListener('astro:after-swap', syncNavAccent);
    syncNavAccent();
    return () => {
      clearTimeout(safetyTimer);
      loaderTimer?.kill();
      window.removeEventListener('swm:envelop', cover);
      window.removeEventListener('swm:fill-release', release);
      window.removeEventListener('swm:fill-progress', progress);
      window.removeEventListener('swm:loader-start', loaderEarly);
      document.removeEventListener('astro:page-load', onPageLoad);
      document.removeEventListener('astro:after-swap', syncNavAccent);
    };
  }, []);

  return (
    <>
      <div ref={fillRef} className="route-fill" aria-hidden="true" />
      {/* The loader (08-27 (4): a SIBLING of the fill, so the hero's early
          `swm:loader-start` can raise it over its own spreading blue before
          the envelop; painted after the fill in the shell, faded in mirror
          with it on release). SQ-32: the lockup globe, parked until started. */}
      <div className="route-fill__loader" ref={loaderRef} aria-hidden="true">
        {/* Mounted after hydration (once `dials` is read), not server-rendered:
            its SVG is ~30 KB of path data that every page's HTML would carry. */}
        {dials && (
          <GlobeLoader ref={globeRef} active={false} timing={timing} lowercase={dials.lowercase} />
        )}
      </div>
    </>
  );
}
