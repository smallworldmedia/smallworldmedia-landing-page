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
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { scrambleTo } from '../../lib/scramble.js';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';
import { EXIT_RATIO, O_STROKE_PCT } from './processConfig.js';
import { createLockupGlobe } from './liveLockupGlobe.js';
import { settleDebounce } from '../../lib/settleResize.js';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

// `globeAssets` is intentionally unused since the 07-30 revision (no videos
// in the O — and the 08-25 snapshot globe needs no assets either) — the
// prop plumbing stays so ProcessPage/the island contract doesn't churn if
// the animated asset returns.
// eslint-disable-next-line no-unused-vars
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

      // 08-28 revision (supersedes the 08-25 static snapshot): the O is the
      // LIVE globe recreation — spinning, cascading (liveLockupGlobe,
      // ?ospin/?ocas/?ocasdip) — behind it the fill-circle-as-stroke disc
      // (the home ?globestroke convention): the ring fills the old 96%
      // slot, the globe canvas sits 1/(1+frac) inside, so globe + ring
      // land exactly at the glyph height (?ostroke). The mount/unmount
      // call sites are unchanged; the inner span is the RESIZE fade owner
      // (the splash/ScrollTrigger choreography owns globeWrap itself).
      let oGlobe = null;
      const mountGlobe = () => {
        if (globeWrap.firstChild) return;
        const inner = document.createElement('span');
        inner.className = 'process-o__inner';
        const stroke = document.createElement('span');
        stroke.className = 'process-o__stroke';
        oGlobe = createLockupGlobe();
        oGlobe.canvas.className = 'process-o__canvas';
        oGlobe.canvas.style.height = `${96 / (1 + O_STROKE_PCT / 100)}%`;
        inner.appendChild(stroke);
        inner.appendChild(oGlobe.canvas);
        globeWrap.appendChild(inner);
      };
      const unmountGlobe = () => {
        oGlobe?.dispose();
        oGlobe = null;
        globeWrap.innerHTML = '';
      };
      mountGlobe();

      const placeGlobe = () => {
        const hb = heroTitle.getBoundingClientRect();
        const ob = oChar.getBoundingClientRect();
        // Square slot sized to the glyph HEIGHT and centered on the O, so the
        // round globe reads at the letters' cap height. The O char carries
        // extra horizontal padding (process.css .process-char:nth-child(3),
        // Nathan 07-30) so this square slot sits in CLEAR space instead of
        // bleeding into PR/CESS — the padded char box keeps the slot centered.
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

      // 08-28 resize doctrine: the fit chases the reflowing glyph at most
      // once per frame (rAF-coalesced reads), while the globe itself fades
      // out on the first event of a gesture and back in after settle —
      // the same drop-then-return the home globe runs.
      let placeRaf = 0;
      const queuePlace = () => {
        if (placeRaf) return;
        placeRaf = requestAnimationFrame(() => {
          placeRaf = 0;
          placeGlobe();
        });
      };
      let oResizeFaded = false;
      const oFadeBack = settleDebounce(
        () => {
          if (!oResizeFaded) return;
          oResizeFaded = false;
          placeGlobe();
          const inner = globeWrap.firstChild;
          if (inner)
            gsap.to(inner, { autoAlpha: 1, duration: 0.45, ease: 'power2.out', overwrite: true });
        },
        { settleMs: 300, maxWaitMs: 2000 }
      );
      const onGlobeResize = () => {
        queuePlace();
        const inner = globeWrap.firstChild;
        if (inner && !oResizeFaded) {
          oResizeFaded = true;
          gsap.to(inner, { autoAlpha: 0, duration: 0.12, ease: 'none', overwrite: true });
        }
        oFadeBack();
      };
      window.addEventListener('resize', onGlobeResize);

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
        window.removeEventListener('resize', onGlobeResize);
        oFadeBack.cancel();
        if (placeRaf) cancelAnimationFrame(placeRaf);
        unmountGlobe();
        globeWrap.remove();
        splits.forEach((s) => s.revert());
      };
    },
    { scope: rootRef }
  );
}
