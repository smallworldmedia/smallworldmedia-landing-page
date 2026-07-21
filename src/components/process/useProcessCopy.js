/**
 * useProcessCopy — copy entrances + the arrival splash (spec §5, v2 deck).
 *
 * Arrival (B9): the SWM globe alone on the brand-blue field → "PROCESS"
 * chars in at RANDOM order → THE_PROCESS scramble → ~1.5s hold → chars
 * out (random again) → the belt materializes and the page auto-glides
 * into stage-01 (guarded: only if the user hasn't scrolled). The globe
 * stands in for the O — glyph hidden, animated overlay tracks its box.
 *
 * Per-section entrances stay the WorldCard OS-boot family: scramble chip
 * → SplitText masked-line headline (0.6s, stagger 0.1, power3.out) →
 * blurb rise, overlapped; leave-back exits run ≈0.7×.
 *
 * Reduced motion: no entrance motion anywhere — copy simply appears
 * (nothing here runs; the DOM's resting state is fully visible, the real
 * O glyph included).
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { scrambleTo } from '../../lib/scramble.js';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';
import { EXIT_RATIO } from './processConfig.js';
import VideoGlobe from '../globe/VideoGlobe.jsx';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

export default function useProcessCopy(rootRef, sceneRef, globeAssets) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || PREFERS_REDUCED_MOTION) return undefined;

      const splits = [];

      /* — Arrival (once per mount; identical on direct load and
         client-side nav — this hook remounts with the island) — */
      /* — The splash (v2 deck, B9): the animated globe alone on the
         brand-blue field → "PROCESS" chars in, RANDOM order → hold 1.5s →
         chars out (random again) → the belt materializes and the page
         glides itself into stage-01. The globe is the O: the real glyph
         stays hidden and an animated stand-in tracks its box (SVG
         placeholder spinning slowly — the looping longitudinal-translation
         Lottie is a separate asset task). — */
      const heroSection = root.querySelector('.process-hero');
      const heroToken = root.querySelector('.process-hero__token');
      const heroTitle = root.querySelector('.process-hero__title');

      const titleSplit = SplitText.create(heroTitle, {
        type: 'chars',
        charsClass: 'process-char',
      });
      splits.push(titleSplit);
      const oChar = titleSplit.chars[2]; // P R [O] C E S S
      const chars = titleSplit.chars.filter((c) => c !== oChar);

      const globeWrap = document.createElement('span');
      globeWrap.className = 'process-hero__globe-o';
      globeWrap.setAttribute('aria-hidden', 'true');
      heroTitle.appendChild(globeWrap);

      // B9 (approved): the finalized homepage globe stands in for the O, in its
      // OPENING state — holdEntrance keeps the entrance cascade + live-video
      // scheduler deferred forever (never released here), so it renders as the
      // dark line-art / gap-lattice mark that matches the SWM lockup glyph, not
      // the populated video-panel globe. Same Sanity asset pool as the home
      // hero. Mounted ONLY while the hero splash is on screen (the process page
      // already runs its own WebGL scene). Falls back to the flat spinning mark
      // if the pool is empty.
      let globeRoot = null;
      const mountGlobe = () => {
        if (globeRoot) return;
        if (globeAssets && globeAssets.length) {
          globeRoot = createRoot(globeWrap);
          globeRoot.render(createElement(VideoGlobe, { assets: globeAssets, holdEntrance: true }));
        } else {
          globeWrap.innerHTML = '<img src="/icons/SWM-globe_white.svg" alt="" />';
        }
      };
      const unmountGlobe = () => {
        if (globeRoot) {
          globeRoot.unmount();
          globeRoot = null;
        } else {
          globeWrap.innerHTML = '';
        }
      };
      mountGlobe();

      const placeGlobe = () => {
        const hb = heroTitle.getBoundingClientRect();
        const ob = oChar.getBoundingClientRect();
        // Square slot sized to the glyph HEIGHT and centered on the O, so the
        // round globe reads at the letters' cap height (matches the retired
        // placeholder's height-fit footprint). It bleeds slightly past the
        // narrow squeezed-caps O into PR/CESS, as the placeholder did.
        const size = ob.height;
        const cx = ob.left + ob.width / 2 - hb.left;
        const cy = ob.top + ob.height / 2 - hb.top;
        globeWrap.style.left = `${cx - size / 2}px`;
        globeWrap.style.top = `${cy - size / 2}px`;
        globeWrap.style.width = `${size}px`;
        globeWrap.style.height = `${size}px`;
      };
      placeGlobe();
      document.fonts?.ready.then(placeGlobe);
      window.addEventListener('resize', placeGlobe);

      const tokenText = heroToken.textContent;
      heroToken.textContent = '';
      gsap.set(oChar, { autoAlpha: 0 }); // the globe IS the O, always
      gsap.set(chars, { autoAlpha: 0 });
      gsap.set(globeWrap, { autoAlpha: 0, scale: 0.92, transformOrigin: '50% 50%' });

      const splash = gsap
        .timeline({ delay: 0.2 })
        // the globe first, alone on the blue field
        .to(globeWrap, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 0)
        // PROCESS in, random character order
        .to(chars, { autoAlpha: 1, duration: 0.05, stagger: { each: 0.055, from: 'random' } }, 0.75)
        .add(() => scrambleTo(heroToken, tokenText), 1.3)
        // hold ~1.5s on the full lockup, then out — straight into stage-01
        .add('out', 2.8)
        .to(chars, { autoAlpha: 0, duration: 0.04, stagger: { each: 0.04, from: 'random' } }, 'out')
        .to(heroToken, { autoAlpha: 0, duration: 0.25 }, 'out')
        .to(globeWrap, { autoAlpha: 0, duration: 0.3 }, 'out+=0.25')
        .add(() => sceneRef.current?.materializeBelt(), 'out+=0.35')
        .add(() => {
          // Auto-advance only if the user hasn't already taken the wheel.
          if (window.scrollY < 40) {
            window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir: 1 } }));
          }
        }, 'out+=0.9')
        // the header globe has faded — tear the live VideoGlobe down so it isn't
        // left rendering behind the belt (remounts on a scroll-back to the hero).
        .add(unmountGlobe, 'out+=1.2');

      // Scrolling back up to the hero later must not find a blank header —
      // restore the lockup (no scramble; chrome scrambles once).
      ScrollTrigger.create({
        trigger: heroSection,
        start: 'top 60%',
        end: 'bottom top',
        onEnterBack: () => {
          mountGlobe();
          splash.kill();
          heroToken.textContent = tokenText;
          gsap.to([...chars, heroToken], { autoAlpha: 1, duration: 0.3, overwrite: 'auto' });
          gsap.to(globeWrap, { autoAlpha: 1, scale: 1, duration: 0.3, overwrite: 'auto' });
        },
        onLeave: () => unmountGlobe(), // scrolled past the hero — free the globe again
      });

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

      return () => {
        window.removeEventListener('resize', placeGlobe);
        unmountGlobe();
        globeWrap.remove();
        splits.forEach((s) => s.revert());
      };
    },
    { scope: rootRef }
  );
}
