/**
 * RouteFill — the persistent solid-fill bridge for cross-route transitions
 * (ADR-0002 Envelopment). A fixed electric-blue layer that lives in the
 * persistent SiteShell, so it survives the ClientRouter page swap: the
 * departing route covers the screen with it, the canvas swap happens behind
 * it, and the arriving route releases it once its scene is mounted.
 *
 * Cross-island protocol (CustomEvents, house convention):
 *   - `swm:envelop`      → cover. detail.duration overrides the fade-in.
 *   - `swm:fill-release` → uncover. Dispatched by the destination on mount.
 *
 * Safety valve: if a page loads while covered and nothing asks for a release
 * (a failed navigation, a route without the handshake), the fill lets go on
 * its own — the user is never stranded on a blue screen.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

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

  useEffect(() => {
    const fill = fillRef.current;
    if (!fill) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let covered = false;
    let safetyTimer = null;

    const release = () => {
      clearTimeout(safetyTimer);
      if (!covered) return;
      covered = false;
      fill.style.pointerEvents = 'none';
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

    // A navigation landed while covered: give the destination a moment to
    // claim the release itself, then let go regardless.
    const onPageLoad = () => {
      if (!covered) return;
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(release, SAFETY_MS);
    };

    window.addEventListener('swm:envelop', cover);
    window.addEventListener('swm:fill-release', release);
    document.addEventListener('astro:page-load', onPageLoad);
    return () => {
      clearTimeout(safetyTimer);
      window.removeEventListener('swm:envelop', cover);
      window.removeEventListener('swm:fill-release', release);
      document.removeEventListener('astro:page-load', onPageLoad);
    };
  }, []);

  return <div ref={fillRef} className="route-fill" aria-hidden="true" />;
}
