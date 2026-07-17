/**
 * useProcessCopy — copy entrances + the arrival choreography (spec §5).
 *
 * The WorldCard OS-boot family: scramble chip (house 1.4s cadence) →
 * SplitText masked-line headline (0.6s, stagger 0.1, power3.out) → blurb
 * rise (0.4s, power2.out), overlapped, never fully sequential; leave-back
 * exits run ≈0.7×. The arrival plays once per mount: THE_PROCESS scramble
 * → H1 lines → the Fragment belt materializes → scroll cue fade.
 *
 * Reduced motion: no entrance motion anywhere — copy simply appears
 * (nothing here runs; the DOM's resting state is fully visible).
 */
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { scrambleTo } from '../../lib/scramble.js';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';
import { EXIT_RATIO } from './processConfig.js';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export default function useProcessCopy(rootRef, sceneRef) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || PREFERS_REDUCED_MOTION) return undefined;

      const splits = [];

      /* — Arrival (once per mount; identical on direct load and
         client-side nav — this hook remounts with the island) — */
      const heroToken = root.querySelector('.process-hero__token');
      const heroTitle = root.querySelector('.process-hero__title');

      const titleSplit = SplitText.create(heroTitle, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'process-line',
      });
      splits.push(titleSplit);
      const tokenText = heroToken.textContent;
      heroToken.textContent = '';
      gsap.set(titleSplit.lines, { yPercent: 110 });

      gsap
        .timeline({ delay: 0.15 })
        .add(() => scrambleTo(heroToken, tokenText), 0)
        .to(titleSplit.lines, { yPercent: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.55)
        .add(() => sceneRef.current?.materializeBelt(), 1.05);

      /* — Per-section entrances: same boundary geometry as the stage
         driver, so copy and scene move on the same beat — */
      const sections = gsap.utils.toArray('.process-stage, .process-cta', root);
      sections.forEach((section) => {
        const tokenEl = section.querySelector('.process-stage__token');
        const chipTail = section.querySelector('.process-stage__chipline');
        const headline = section.querySelector('.process-stage__headline, .process-cta__display');
        const rises = section.querySelectorAll(
          '.process-stage__blurb, .process-cta__line, .process-cta__actions'
        );

        const split = SplitText.create(headline, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'process-line',
        });
        splits.push(split);
        const tokenFinal = tokenEl?.textContent ?? '';
        const chipFinal = chipTail?.textContent ?? '';
        if (tokenEl) tokenEl.textContent = '';
        if (chipTail) chipTail.textContent = '';

        gsap.set(split.lines, { yPercent: 110 });
        gsap.set(rises, { autoAlpha: 0, y: 14 });

        const tl = gsap
          .timeline({ paused: true })
          .to(split.lines, { yPercent: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.35)
          .to(rises, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, 0.65);

        let scrambled = false; // chrome scrambles once; re-entries keep text
        ScrollTrigger.create({
          trigger: section,
          start: 'top 60%',
          end: 'bottom 60%',
          onEnter: () => {
            if (!scrambled) {
              scrambled = true;
              if (tokenEl) scrambleTo(tokenEl, tokenFinal);
              if (chipTail) scrambleTo(chipTail, chipFinal);
            }
            tl.timeScale(1).play();
          },
          onEnterBack: () => tl.timeScale(1).play(),
          onLeaveBack: () => tl.timeScale(1 / EXIT_RATIO).reverse(),
        });

        // Mid-page arrivals (scroll restoration): the section already
        // inside its region shows its copy without a boundary cross —
        // the driver's syncToScroll convention.
        const rect = section.getBoundingClientRect();
        const line = window.innerHeight * 0.6;
        if (rect.top <= line && rect.bottom >= line) {
          scrambled = true;
          if (tokenEl) tokenEl.textContent = tokenFinal;
          if (chipTail) chipTail.textContent = chipFinal;
          tl.progress(1);
        }
      });

      return () => splits.forEach((s) => s.revert());
    },
    { scope: rootRef }
  );
}
