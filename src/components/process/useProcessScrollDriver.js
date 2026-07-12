/**
 * useProcessScrollDriver — ScrollTrigger boundaries → the stage machine.
 *
 * ADR-0004: the process narrative is ScrollTrigger-driven and time-based —
 * discrete goTo() transitions fired at section boundaries. No scrub (the
 * authored time-domain curves own the clock), no pin (the canvas is
 * CSS-fixed — zero pin-spacer/Lenis interactions), no snap (affordance
 * honesty: it's a document; the scrollbar behaves).
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
import { getLenis } from '../../lib/smoothScroll.js';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function useProcessScrollDriver(rootRef, sceneRef) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return undefined;

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

      // Lenis bridge — smoothed scroll drives trigger updates on the same
      // clock (the pattern blessed in docs/orbit-deck-viewer-spec.md).
      // Attach lazily: on a hard load this island can hydrate before
      // BaseLayout's astro:page-load handler has started Lenis.
      let disposed = false;
      let bridged = null;
      const attachLenis = () => {
        const lenis = getLenis();
        if (!lenis || lenis === bridged) return;
        if (bridged) bridged.off('scroll', ScrollTrigger.update);
        lenis.on('scroll', ScrollTrigger.update);
        bridged = lenis;
      };
      attachLenis();

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
        if (bridged) bridged.off('scroll', ScrollTrigger.update);
        // Triggers themselves revert with the useGSAP context.
      };
    },
    { scope: rootRef }
  );
}
