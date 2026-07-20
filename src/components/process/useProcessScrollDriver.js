/**
 * useProcessScrollDriver — ScrollTrigger boundaries → the stage machine,
 * plus the one-section-per-swipe gesture quantizer (2026-07-13 round).
 *
 * ADR-0004 (amended): the process narrative is ScrollTrigger-driven and
 * time-based — discrete goTo() transitions fired at section boundaries.
 * No scrub (the authored time-domain curves own the clock), no pin (the
 * canvas is CSS-fixed — zero pin-spacer/Lenis interactions). The original
 * no-snap call is superseded by Nathan's direction: interaction parity
 * with the /work Featured Projects pager and the home hero's
 * scroll-to-enter — the SAME accumulator idiom (fill px threshold, ×2
 * touch gain, 160ms rubber-band, one commitment per gesture) now
 * quantizes the document into one-section swipes. The document itself is
 * unchanged — a commit is a Lenis scrollTo glide on the house Turn curve,
 * so the boundary triggers, the copy entrances, and the scene machine all
 * fire exactly as they would from a free scroll. ?swipe=off restores free
 * scroll; reduced motion never engages the quantizer (native scroll,
 * stills at boundaries).
 *
 * ScrollTrigger registers HERE, island-scope only — the first use in the
 * codebase. The bespoke accumulator stays the idiom for single-commitment
 * viewport-locked gestures elsewhere (ADR-0004).
 *
 * Boundary geometry: each Stage section claims [top 60%, bottom 60%], so
 * for adjacent sections the down-scroll flip (incoming top crosses the 60%
 * line) and the up-scroll flip (outgoing bottom re-crosses it) happen at
 * the same document position — symmetric in both directions.
 */
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CustomEase } from 'gsap/CustomEase';
import { getLenis } from '../../lib/smoothScroll.js';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';
import { TURN_EASE_PATH } from '../work/world/worldConfig.js';
import { TOUCH_GAIN, RELEASE_MS } from '../../lib/motion.js';
import { TUNING } from './processConfig.js';

gsap.registerPlugin(useGSAP, ScrollTrigger, CustomEase);

/* TOUCH_GAIN / RELEASE_MS = the house gesture constants (motion.js) —
   shared with the hero Envelopment + /work World Turn accumulators. */
const PEEK_PX = 24; // elastic copy-column tension at full fill

/* Gestures inside interactive chrome stay native — the quantizer must
   never eat the tuning panel's sliders or the inquiry overlay's scroll. */
const CHROME_SELECTOR =
  '.process-debug, .project-overlay, .site-nav, .mobile-menu, input, select, textarea';

export default function useProcessScrollDriver(rootRef, sceneRef) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return undefined;

      // Shared house curve for the top-level glides (P6 back-to-top, and
      // the fallback path). The quantizer builds its own inside attach.
      const homeEase = CustomEase.create('processHome', TURN_EASE_PATH);

      // Reduced motion: no timelines — every boundary is a single-frame
      // still (spec §7). Every state stays reachable in both directions.
      const drive = (stageId, { instant = false } = {}) => {
        const api = sceneRef.current;
        if (!api || !stageId) return;
        if (instant || PREFERS_REDUCED_MOTION) api.setStageInstant(stageId);
        else api.goTo(stageId);
      };

      const sections = gsap.utils.toArray('.process-stage', root);
      sections.forEach((section) => {
        ScrollTrigger.create({
          trigger: section,
          start: 'top 60%',
          end: 'bottom 60%',
          onEnter: () => drive(section.dataset.stage),
          onEnterBack: () => drive(section.dataset.stage),
        });
      });

      // Mid-page arrivals (scroll restoration, future deep links): sync to
      // the section under the 60% line without waiting for a boundary
      // cross. Instant — an arrival is a rest pose, not a transition.
      // Above the first boundary the scene rests in the Stage-1 belt.
      const syncToScroll = () => {
        const line = window.innerHeight * 0.6;
        const active = sections.filter(
          (s) => s.getBoundingClientRect().top <= line
        ).pop();
        drive(active?.dataset.stage ?? 'stage-01', { instant: true });
      };
      syncToScroll();

      /* — The gesture quantizer (skipped whole under reduced motion:
         Lenis never exists there and the document scrolls natively) — */
      let disposed = false;
      let bridged = null;
      let lockedLenis = false;
      let quantizerCleanup = null;
      let stepFn = null; // set by attachQuantizer — ProcessStepCtas' entry point

      const swipeOn = () => TUNING.swipe !== 'off' && TUNING.swipe !== '0';

      /* Lenis free-wheel is stopped while the quantizer owns input (the
         overlay-freeze idiom); scrollTo(force) still glides. Re-started
         live when ?swipe flips off through the panel. */
      const syncLenisLock = () => {
        const lenis = getLenis();
        if (!lenis) return;
        const wantLock = swipeOn();
        if (wantLock && !lockedLenis) {
          lenis.stop();
          lockedLenis = true;
        } else if (!wantLock && lockedLenis) {
          lenis.start();
          lockedLenis = false;
        }
      };

      const attachQuantizer = () => {
        if (PREFERS_REDUCED_MOTION || quantizerCleanup) return;
        const copyEl = root.querySelector('.process-page__copy');
        const turnEase = CustomEase.create('processSwipe', TURN_EASE_PATH);

        /* ONE owner for copy-column y. The peek (quickTo), the rubber-band
           and the commit settle used to be three separate tweens that could
           overlap on the same property — alternating writes for a beat, the
           visible Y jitter. Every move now kills the incumbent first.
           force3D keeps the column composited through the whole interaction
           so glyphs don't re-rasterize (pop) each time a tween ends. */
        let leanTween = null;
        const leanTo = (y, duration, ease) => {
          if (!copyEl) return;
          leanTween?.kill();
          leanTween = gsap.to(copyEl, { y, duration, ease, force3D: true });
        };

        let accum = 0;
        let lockUntil = 0;
        let releaseTimer = null;
        let touchY = null;

        /* Momentum-tail arming (the np-band ?nparm idiom): after a commit,
           trackpad inertia keeps streaming same-direction deltas past the
           glide lock — feeding them to the accumulator re-leans the column
           for a blink before it rubber-bands (the jitter at rest). Disarm
           at commit; re-arm on a quiet gap or a deliberate direction flip. */
        const ARM_GAP_MS = 100;
        let armed = true;
        let lastDeltaTs = 0;
        let lastDir = 0;

        /* Section rest positions, computed fresh per gesture (fonts,
           resizes and the CTA's runway all move them): each section
           centers in the viewport; sections taller than the viewport
           rest past their top so the copy block sits centered. The
           document end is one extra step when the footer adds runway. */
        const rests = () => {
          const doc = document.scrollingElement || document.documentElement;
          const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);
          const stops = gsap.utils
            .toArray('.process-section', root)
            .map((el) => {
              const top = el.getBoundingClientRect().top + window.scrollY;
              return Math.round(
                Math.min(Math.max(top + (el.offsetHeight - window.innerHeight) / 2, 0), maxScroll)
              );
            });
          if (maxScroll > (stops[stops.length - 1] ?? 0) + 40) stops.push(maxScroll);
          return stops;
        };
        const nearestIndex = (stops) => {
          const y = window.scrollY;
          let best = 0;
          stops.forEach((s, i) => {
            if (Math.abs(s - y) < Math.abs(stops[best] - y)) best = i;
          });
          return best;
        };

        const clearRelease = () => {
          if (releaseTimer) {
            clearTimeout(releaseTimer);
            releaseTimer = null;
          }
        };
        const scheduleRelease = () => {
          clearRelease();
          releaseTimer = setTimeout(() => {
            accum = 0;
            leanTo(0, 0.45, 'expo.out');
          }, RELEASE_MS);
        };

        const commit = (dir) => {
          const stops = rests();
          const target = Math.min(Math.max(nearestIndex(stops) + dir, 0), stops.length - 1);
          clearRelease();
          accum = 0;
          armed = false; // this gesture's inertia tail must not re-fill
          leanTo(0, 0.3, 'power2.out');
          lockUntil = performance.now() + TUNING.swipeSeconds * 1000 + 80;
          const lenis = getLenis();
          if (lenis) {
            lenis.scrollTo(stops[target], {
              duration: TUNING.swipeSeconds,
              easing: turnEase,
              force: true,
              lock: true,
            });
          } else {
            // Belt-and-braces: no Lenis (it should exist here) → tween
            // the scroll ourselves on the same curve.
            const proxy = { y: window.scrollY };
            gsap.to(proxy, {
              y: stops[target],
              duration: TUNING.swipeSeconds,
              ease: turnEase,
              onUpdate: () => window.scrollTo(0, proxy.y),
            });
          }
        };

        const addDelta = (dy) => {
          const now = performance.now();
          const dir = Math.sign(dy);
          if (now < lockUntil) {
            lastDeltaTs = now;
            if (dir) lastDir = dir;
            return;
          }
          if (!armed) {
            if (now - lastDeltaTs < ARM_GAP_MS && (dir === 0 || dir === lastDir)) {
              lastDeltaTs = now; // still the old tail — swallow it
              return;
            }
            armed = true;
          }
          lastDeltaTs = now;
          if (dir) lastDir = dir;
          const stops = rests();
          const idx = nearestIndex(stops);
          let a = accum + dy;
          if (idx <= 0) a = Math.max(0, a); // nothing above the hero
          if (idx >= stops.length - 1) a = Math.min(0, a); // nothing past the end
          accum = a;
          if (a >= TUNING.swipePx) commit(1);
          else if (a <= -TUNING.swipePx) commit(-1);
          else {
            // Building the fill — the copy column leans with the pull
            // (the CTA-fill tension, spelled as weight), and rubber-bands
            // back if the gesture stalls short of committing.
            leanTo(-(a / TUNING.swipePx) * PEEK_PX, 0.25, 'power2.out');
            scheduleRelease();
          }
        };

        /* The overlay owns the screen when open — never quantize under it
           (the Hero accumulator's guard). */
        const overlayOpen = () =>
          document.querySelector('.project-overlay')?.dataset.open === 'true';
        const guarded = (e) =>
          !swipeOn() || overlayOpen() || (e.target instanceof Element && e.target.closest(CHROME_SELECTOR));

        const onWheel = (e) => {
          syncLenisLock();
          if (e.ctrlKey) return; // trackpad pinch-zoom stays native
          if (guarded(e)) return;
          e.preventDefault();
          addDelta(e.deltaY);
        };
        const onTouchStart = (e) => {
          syncLenisLock();
          touchY = e.touches[0]?.clientY ?? null;
        };
        const onTouchMove = (e) => {
          if (touchY === null) return;
          if (guarded(e)) {
            touchY = null; // the gesture belongs to the chrome now
            return;
          }
          const y = e.touches[0]?.clientY ?? touchY;
          e.preventDefault(); // the quantizer owns the pan
          addDelta((touchY - y) * TOUCH_GAIN); // upward swipe = forward
          touchY = y;
        };
        const onTouchEnd = () => {
          touchY = null;
          scheduleRelease();
        };

        /* Keyboard steps the same grid (Lenis is stopped, so native
           key-scroll is frozen — stepping is the accessible equivalent). */
        const onKeyDown = (e) => {
          if (!swipeOn() || overlayOpen()) return;
          const t = e.target;
          if (
            t instanceof Element &&
            (t.closest('input, select, textarea, [contenteditable="true"]') ||
              t.closest('.process-debug'))
          )
            return;
          if (performance.now() < lockUntil) {
            e.preventDefault();
            return;
          }
          const stops = rests();
          const step = (dir) => {
            e.preventDefault();
            const target = Math.min(Math.max(nearestIndex(stops) + dir, 0), stops.length - 1);
            if (target !== nearestIndex(stops)) commit(dir);
          };
          switch (e.key) {
            case 'ArrowDown':
            case 'PageDown':
              step(1);
              break;
            case ' ':
              step(e.shiftKey ? -1 : 1);
              break;
            case 'ArrowUp':
            case 'PageUp':
              step(-1);
              break;
            case 'Home':
              e.preventDefault();
              getLenis()?.scrollTo(0, { duration: TUNING.swipeSeconds, easing: turnEase, force: true, lock: true });
              break;
            case 'End': {
              e.preventDefault();
              const s = rests();
              getLenis()?.scrollTo(s[s.length - 1], { duration: TUNING.swipeSeconds, easing: turnEase, force: true, lock: true });
              break;
            }
            default:
          }
        };

        // Capture phase: runs ahead of Lenis's bubble-phase VirtualScroll
        // (belt and braces — Lenis is stopped anyway while we own input).
        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('keydown', onKeyDown);

        /* The [previous]/[next] steppers ride the same commit — a click is
           explicit intent, so it skips the accumulator (but not the glide
           lock). */
        stepFn = (dir) => {
          if (performance.now() < lockUntil) return;
          commit(dir);
        };

        quantizerCleanup = () => {
          stepFn = null;
          clearRelease();
          window.removeEventListener('wheel', onWheel, { capture: true });
          window.removeEventListener('touchstart', onTouchStart);
          window.removeEventListener('touchmove', onTouchMove, { capture: true });
          window.removeEventListener('touchend', onTouchEnd);
          window.removeEventListener('keydown', onKeyDown);
          if (copyEl) {
            gsap.killTweensOf(copyEl);
            gsap.set(copyEl, { clearProps: 'transform' });
          }
        };
      };

      // Lenis bridge — smoothed scroll drives trigger updates on the same
      // clock (the pattern blessed in docs/orbit-deck-viewer-spec.md).
      // Attach lazily: on a hard load this island can hydrate before
      // BaseLayout's astro:page-load handler has started Lenis.
      const attachLenis = () => {
        const lenis = getLenis();
        if (!lenis || lenis === bridged) {
          syncLenisLock();
          return;
        }
        if (bridged) bridged.off('scroll', ScrollTrigger.update);
        lenis.on('scroll', ScrollTrigger.update);
        bridged = lenis;
        lockedLenis = false; // fresh instance — re-evaluate the lock
        syncLenisLock();
      };
      attachLenis();
      if (!PREFERS_REDUCED_MOTION) attachQuantizer();

      /* ProcessStepCtas → one section step. With the quantizer live the
         commit glides on the Turn curve; under reduced motion (no Lenis,
         no quantizer) the step is an instant centered jump — the same
         still-per-boundary contract as native RM scrolling. */
      const onStep = (e) => {
        const dir = e.detail?.dir === -1 ? -1 : 1;
        if (stepFn) {
          stepFn(dir);
          return;
        }
        const all = gsap.utils.toArray('.process-section', root);
        if (!all.length) return;
        const mid = window.innerHeight / 2;
        const dist = all.map((el) => {
          const r = el.getBoundingClientRect();
          return Math.abs(r.top + r.height / 2 - mid);
        });
        const cur = dist.indexOf(Math.min(...dist));
        const next = Math.min(Math.max(cur + dir, 0), all.length - 1);
        all[next].scrollIntoView({ behavior: 'auto', block: 'center' });
      };
      window.addEventListener('swm:process-step', onStep);

      /* P6 back-to-top (the closing "YOUR WORLD NEXT" control) → a smooth
         glide to the top on the house Turn curve, modeled on the Home-key
         handler. force:true glides even while the quantizer holds Lenis
         stopped; under reduced motion (no Lenis) it's an instant jump. */
      const onHome = () => {
        const lenis = getLenis();
        if (lenis && !PREFERS_REDUCED_MOTION) {
          lenis.scrollTo(0, {
            duration: TUNING.swipeSeconds,
            easing: homeEase,
            force: true,
            lock: true,
          });
        } else {
          window.scrollTo(0, 0);
        }
      };
      window.addEventListener('swm:process-home', onHome);

      const onPageLoad = () => {
        attachLenis();
        ScrollTrigger.refresh();
      };
      document.addEventListener('astro:page-load', onPageLoad);

      // Brand faces landing shift the section geometry — re-measure.
      document.fonts?.ready.then(() => {
        if (!disposed) ScrollTrigger.refresh();
      });

      return () => {
        disposed = true;
        document.removeEventListener('astro:page-load', onPageLoad);
        window.removeEventListener('swm:process-step', onStep);
        window.removeEventListener('swm:process-home', onHome);
        quantizerCleanup?.();
        if (lockedLenis) getLenis()?.start(); // hand free scroll back to the site
        if (bridged) bridged.off('scroll', ScrollTrigger.update);
        // Triggers themselves revert with the useGSAP context.
      };
    },
    { scope: rootRef }
  );
}
