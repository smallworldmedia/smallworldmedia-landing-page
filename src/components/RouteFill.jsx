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
 * Safety valve: if a page loads while covered and nothing asks for a release
 * (a failed navigation, a route without the handshake), the fill lets go on
 * its own — the user is never stranded on a blue screen.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { applyNavAccent, reapplyNavAccent, clearNavAccent } from '../lib/navAccent.js';

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
const SAFETY_MS = 2500;

export default function RouteFill() {
  const fillRef = useRef(null);
  const loaderRef = useRef(null); // the overviews_loading chrome (08-25)
  const barRef = useRef(null); // the bar fill — scaleX 0..1

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return undefined;
    const loader = loaderRef.current;
    const bar = barRef.current;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let covered = false;
    let safetyTimer = null;
    let loaderUp = false;

    // ── overviews_loading (08-25, Nathan) — a dummy loading bar bridging
    // the home→/work gap: the departing hero tags its envelop with
    // detail.loader, the bar charges to ~90% while the World builds behind
    // the fill, and the release snaps it full before the fade carries the
    // whole layer (loader included — it's a child) away. Dummy by design:
    // it paces the WAIT, it does not measure progress. ──
    const loaderStart = () => {
      if (!loader || !bar || reducedMotion) return;
      loaderUp = true;
      gsap.killTweensOf([loader, bar]);
      gsap.set(bar, { scaleX: 0 });
      gsap.set(loader, { autoAlpha: 1 });
      // Fast optimistic charge, then a slow creep — never lands on its own.
      const tl = gsap.timeline();
      tl.to(bar, { scaleX: 0.82, duration: 1.1, ease: 'power2.out' });
      tl.to(bar, { scaleX: 0.96, duration: 3.5, ease: 'none' });
    };
    const loaderFinish = () => {
      if (!loaderUp || !loader || !bar) return;
      loaderUp = false;
      gsap.killTweensOf(bar);
      // Complete under the release fade, then reset for the next passage
      // (the fade above hides the snap-to-zero).
      gsap.to(bar, { scaleX: 1, duration: 0.15, ease: 'power2.out' });
      gsap.to(loader, {
        autoAlpha: 0,
        duration: 0.1,
        delay: RELEASE_DELAY + RELEASE_SECONDS,
        onComplete: () => gsap.set(bar, { scaleX: 0 }),
      });
    };

    const release = () => {
      clearTimeout(safetyTimer);
      if (!covered) return;
      covered = false;
      fill.style.pointerEvents = 'none';
      loaderFinish();
      if (reducedMotion) {
        gsap.set(fill, { autoAlpha: 0 });
        return;
      }
      gsap.to(fill, {
        autoAlpha: 0,
        duration: RELEASE_SECONDS,
        delay: RELEASE_DELAY,
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
      if (e?.detail?.loader) loaderStart();
      if (reducedMotion) {
        gsap.set(fill, { autoAlpha: 1 });
        return;
      }
      gsap.to(fill, {
        autoAlpha: 1,
        duration: e?.detail?.duration ?? COVER_SECONDS,
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

    window.addEventListener('swm:envelop', cover);
    window.addEventListener('swm:fill-release', release);
    window.addEventListener('swm:fill-progress', progress);
    document.addEventListener('astro:page-load', onPageLoad);
    document.addEventListener('astro:after-swap', syncNavAccent);
    syncNavAccent();
    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener('swm:envelop', cover);
      window.removeEventListener('swm:fill-release', release);
      window.removeEventListener('swm:fill-progress', progress);
      document.removeEventListener('astro:page-load', onPageLoad);
      document.removeEventListener('astro:after-swap', syncNavAccent);
    };
  }, []);

  return (
    <div ref={fillRef} className="route-fill" aria-hidden="true">
      {/* overviews_loading (08-25) — hidden until a loader-tagged envelop;
          fades with the parent fill on release, reset after. */}
      <div className="route-fill__loader" ref={loaderRef}>
        <p className="route-fill__loader-label">overviews_loading</p>
        <div className="route-fill__loader-track">
          <div className="route-fill__loader-bar" ref={barRef} />
        </div>
      </div>
    </div>
  );
}
