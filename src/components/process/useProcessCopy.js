/**
 * useProcessCopy — copy entrances + the arrival splash (spec §5, v2 deck).
 *
 * Arrival (B9): the SWM globe alone on the brand-blue field (10-10, w9c:
 * the OPENING field — black by default, ?opening=blue the pre-w9c blue) → "PROCESS"
 * chars in at RANDOM order → THE_PROCESS scramble → ~1.5s hold → the O
 * BREAKS (10-07, Nathan): the scene takes the hero → stage-01 beat. Through
 * the wind-up the token burns down like a fuse and the O pinches as the
 * word draws in toward it; on the impact frame the lockup hands the mark
 * to the scene's shards and the blast shoves the letters off and cuts
 * them; the page then auto-glides into stage-01, landing the copy in the
 * hang (guarded: only if the user hasn't scrolled). The globe stands in
 * for the O — glyph hidden, animated overlay tracks its box. The scene
 * owns the beat; this hook is the DOM side of the O, registered as the
 * scene's heroMark (where the mark sits, its live lockup, the cues).
 * Scrolling back to the top re-forms it, word first: the letters cut back
 * in around an empty O slot and close as the shards fly home, and the
 * lockup takes the mark back on their landing frame.
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
import { CHAR_CUT, cutIn, cutOut, cutSchedule } from '../../lib/charCut.js';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';
import { EXIT_RATIO, O_STROKE_PCT, O_PAD_EM, TUNING, s5DropAt } from './processConfig.js';
import { createLockupGlobe, LOCKUP_EXTENT } from './liveLockupGlobe.js';
import { settleDebounce } from '../../lib/settleResize.js';
import { kwWipe, kwSet } from '../../lib/keywords.jsx';
import { wipeIn } from '../../lib/overlayWipe.js';

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/* 10-07 (w4): COPY_BEAT — THE one place a section's copy LEAD lives: how
   long, s, its entrance (headline lines, blurb rise, keyword wipe) waits
   after the section's line is crossed, so the type lands ON the scene's beat
   instead of over a frame that has not happened yet. Keyed by the section's
   data-stage; read live (getters), so a ?debug dial applies on the next
   entrance. The PHASE token still scrambles on arrival — it names the stage
   the scene is already moving into. stage-03 (?s3copy): the headline waits
   for the ignition (lands ≈1.25s, as the middle rows light), the keyword
   wipe runs while the last rows land. w5 added stage-04, w6 stage-05.
   10-07 (w4 fix): the lead counts from the SCENE's beat, not the line. The
   scene cues every transition it builds (setCopyBeat → onBeat below):
   'full' = this stage's own arrival plays whole and forward (S3: breath +
   ignition), so the lead runs from now — on a plain step that is the same
   frame as the line, exactly as before; 'plain' = compressed, reversed or
   from the belt (a forward step mid-reverse: no breath, no cascade, S3's
   Core already lit), so the lead is skipped; 'queued' = the step landed
   during the S1→S2 show, which rushes and builds this stage when it lands
   (≈1.5s later at ?showrush 5), so the entrance waits for that build. No
   cue within BEAT_WAIT (an instant pose, a jump gliding past) = plain.
   The break builds no cue: a stage-01 lead would only ever get the plain
   fallback (the S1→S2 show cues 'full' since 10-09, w9 — below).
   10-07 (w5, s4-out-then-in): stage-04 waits for the PUSH — S3→S4 bursts at
   S3's distance and only then pushes in (the scene's s4PushAt, ≈1.15s), so
   BUILD_WORLD's lines rise with the approach (lead = push − 0.35). The same
   cue model: the scene sends 'full' only when the arrival pushes. A getter
   gets the scene's api — the one number lives there.
   10-07 (w6, s5-drop): stage-05 waits for the DROP — s5DropAt (processConfig,
   the one S5 clock: ?stagems + ?countin beats, ≈1.63s) is when all 84 panels
   hit together, so WORLD_IN_MOTION rises through the count-in and the
   [[goes live]] wipe (1.05 + lead) starts 0.05s before the drop. A pure
   function of TUNING, read here at onEnter (which can beat the scene's
   build). The scene sends 'full' only when the intro plays (forward from S4,
   uncompressed, not a jump, ?countin > 0); ?countin 0 = no lead.
   10-09 (w9, s2-hold): each entry names WHAT waits — `lead` holds the whole
   entrance (headline, blurb, wipe), `rises` holds only the blurb and what
   follows it (the keyword wipe, ?nexttease's line). stage-02 RISES on the
   dots: its headline lands on the line, its blurb waits for the connect
   show's pull back to the constellation (the scene's s2RevealAt — the rise
   at 0.65 + this lands there; 'full' = the S1→S2 show is building). stage-03
   leads from the IGNITION now — S2→S3 assembles first, then ignites at the
   scene's s3Ignition().at — so ?s3copy keeps its pre-w9 relation to the
   cascade (the lines at at + 0.35 + ?s3copy).
   10-09 (w9b, s3-headline): w9's whole-card wait left S3's card reading
   only PHASE_03 for ≈0.8–3.8 s while the Core assembled. ?s3head=assembly
   (PROPOSED) makes stage-03 a RISES entry like stage-02: CORE_ASSEMBLY
   lands as the assembly starts (it names what the reader is watching) and
   the blurb + keyword wipe rise on the ignition — the rise = w9's lead, so
   the blurb's place (0.65 + ignition + ?s3copy) is unchanged. ?s3head=
   ignition is w9 exactly (the lead). Read at each crossing (syncLead), so
   the bench's select applies on the next S3 entrance; a plain or reversed
   arrival plays the whole card either way (begin(false) drops the rise
   as it skips a lead). */
const s3Lead = (scene) => (scene?.s3Ignition?.().at ?? 0) + Math.max(TUNING.s3Copy, 0);
const s3HeadFirst = () => TUNING.s3Head !== 'ignition';
export const COPY_BEAT = {
  'stage-02': { rises: (scene) => Math.max((scene?.s2RevealAt?.() ?? 0) - 0.65, 0) },
  'stage-03': {
    lead: (scene) => (s3HeadFirst() ? 0 : s3Lead(scene)),
    rises: (scene) => (s3HeadFirst() ? s3Lead(scene) : 0),
  },
  'stage-04': { lead: (scene) => Math.max((scene?.s4PushAt?.() ?? 0) - 0.35, 0) },
  'stage-05': { lead: () => (TUNING.countIn > 0 ? Math.max(s5DropAt() - 0.05 - 1.05, 0) : 0) },
};
const copyLead = (id, scene) => COPY_BEAT[id]?.lead?.(scene) ?? 0;
const riseLead = (id, scene) => COPY_BEAT[id]?.rises?.(scene) ?? 0;
const BEAT_WAIT = 0.2; // s — no cue by then: nothing authored is coming
const BEAT_QUEUED_WAIT = 8; // s — safety for a queued stage the reader stepped past (the cue never comes)
const BEAT_FRESH_MS = 250; // a cue this recent was for THIS crossing (it can beat the copy's own onEnter)

// `globeAssets` is intentionally unused since the 07-30 revision (no videos
// in the O — and the 08-25 snapshot globe needs no assets either) — the
// prop plumbing stays so ProcessPage/the island contract doesn't churn if
// the animated asset returns.
// eslint-disable-next-line no-unused-vars
export default function useProcessCopy(rootRef, sceneRef, globeAssets) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return undefined;
      // 10-07 (final review): reduced motion is a still, not an empty one —
      // every keyword highlight is SET on (the box at full width, the ink
      // unclipped), the way /work's useKeywordWipe lands them. The wipe
      // that would have drawn them never runs here, and they read nowhere.
      if (PREFERS_REDUCED_MOTION) {
        kwSet(root, true);
        return undefined;
      }

      const splits = [];

      /* — Arrival (once per mount; identical on direct load and
         client-side nav — this hook remounts with the island) — */
      /* — The splash (v2 deck, B9): the animated globe alone on the
         brand-blue field → "PROCESS" chars in, RANDOM order → hold 1.5s →
         the O breaks into the belt (10-07: the scene's beat — see heroMark
         below) → the page glides itself into stage-01. The globe is the O:
         the real glyph stays hidden and the live lockup globe tracks its
         box. — */
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
      // Clear air each side of the O slot — ?opad em (08-28: snugged from
      // the 0.26em CSS literal; the knob overrides the stylesheet).
      oChar.style.padding = `0 ${O_PAD_EM}em`;

      const globeWrap = document.createElement('span');
      globeWrap.className = 'process-hero__globe-o';
      globeWrap.setAttribute('aria-hidden', 'true');
      heroTitle.appendChild(globeWrap);

      // 08-28 revision (supersedes the 08-25 static snapshot): the O is the
      // LIVE globe recreation — spinning, cascading (liveLockupGlobe,
      // ?ospin/?ocas/?ocasdip) — behind it the fill-circle-as-stroke disc
      // (the home ?globestroke convention): the ring fills the old 96%
      // slot, the globe canvas sits 1/(1+frac) inside, so globe + ring
      // land exactly at the glyph height (?ostroke). The inner span is the
      // RESIZE fade owner (the splash/ScrollTrigger choreography owns
      // globeWrap itself).
      // 10-07 (perf-2): ONE lockup for the island's life. Broken or scrolled
      // away it PAUSES (off the ticker, hidden in its slot with globeWrap) —
      // it used to be disposed and rebuilt, a fresh WebGL context + shader
      // compile landing mid-glide on every return (mid-reform on a
      // back_to_top). heroMark.lockup() is now always the same instance, so
      // the scene's charge tweens and orientation() reads hold across a
      // break and reform. Disposed only at unmount.
      const oInner = document.createElement('span');
      oInner.className = 'process-o__inner';
      const oStroke = document.createElement('span');
      oStroke.className = 'process-o__stroke';
      const oGlobe = createLockupGlobe();
      oGlobe.canvas.className = 'process-o__canvas';
      oGlobe.canvas.style.height = `${96 / (1 + O_STROKE_PCT / 100)}%`;
      oInner.appendChild(oStroke);
      oInner.appendChild(oGlobe.canvas);
      globeWrap.appendChild(oInner);

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
      // The O comes back to life (on the ticker, re-seated on the glyph);
      // the choreography that called it decides when it is SEEN.
      let pauseCall = null;
      const wakeGlobe = () => {
        pauseCall?.kill();
        pauseCall = null;
        oGlobe.resume();
        placeGlobe();
      };

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

      // The O is BROKEN while the scene's shards hold it (the belt and every
      // stage after): the lockup and the letters stay down until the scene
      // re-forms it. A mid-page arrival lands broken — the driver's sync has
      // already put the scene past the hero — and skips the splash.
      const sceneStage = sceneRef.current?.getStage?.() ?? null;
      let broken = sceneStage !== null && sceneStage !== 'hero';

      // Each letter's distance from the O, in letters (P R [O] C E S S): the
      // wind-up's gather and the blast's shove both fall off with it.
      const reach = chars.map((c) => {
        const i = titleSplit.chars.indexOf(c);
        return { d: Math.min(Math.max(Math.abs(i - 2), 1), 4), side: i < 2 ? -1 : 1 };
      });
      const SHOVE_EM = [0.24, 0.16, 0.11, 0.08]; // the blast, away from the O
      const GATHER_EM = [0.04, 0.03, 0.02, 0.015]; // the wind-up, toward it
      const titleEm = () => parseFloat(getComputedStyle(heroTitle).fontSize) || 16;

      // The letters go and come back by the house cut (charCut's clock on
      // plain visibility writes — never a fade).
      let letterCut = null;
      let letterDelay = null;
      const lettersIn = () => {
        letterDelay?.kill();
        letterCut?.kill();
        const down = chars.filter((c) => c.style.visibility === 'hidden');
        gsap.set(chars, { opacity: 1 });
        letterCut = cutSchedule(down.length, {
          stepMs: CHAR_CUT.inStepMs,
          onCut: (i) => {
            down[i].style.visibility = 'inherit';
          },
        });
      };

      // THE_PROCESS is the FUSE: it burns down through the wind-up and only
      // comes back with the O. The chrome scrambles once — its return is
      // the house cut.
      let tokenTween = null;
      let tokenCut = null;
      let tokenOut = false;
      const fuseToken = () => {
        if (tokenOut) return;
        tokenOut = true;
        tokenTween?.kill();
        tokenCut?.kill();
        if (!heroToken.textContent) return; // never scrambled in — nothing to burn
        heroToken.textContent = tokenText;
        tokenCut = cutOut(heroToken);
      };
      const returnToken = () => {
        tokenTween?.kill();
        tokenCut?.kill();
        tokenOut = false;
        heroToken.textContent = tokenText;
        tokenCut = cutIn(heroToken);
      };

      const heroOnScreen = () => {
        const b = globeWrap.getBoundingClientRect();
        return b.height > 0 && b.bottom > 0 && b.top < window.innerHeight;
      };
      // The break lands ?shattercharge after the cue; the glide follows it
      // into the hang, so the stage copy lands on the falloff — never on
      // the explosion.
      const breakAt = Math.max(TUNING.shatterCharge, 0);
      let splash = gsap
        .timeline({
          delay: 0.2,
          paused: document.hidden, // a background-tab load waits to be seen
          onComplete: () => {
            splash = null;
          },
        })
        // the globe first, alone on the blue field (10-10, w9c: the opening field — black by default)
        .to(globeWrap, { autoAlpha: 1, scale: 1, duration: 0.5, ease: 'power2.out' }, 0)
        // PROCESS in, random character order
        .to(chars, { autoAlpha: 1, duration: 0.05, stagger: { each: 0.055, from: 'random' } }, 0.75)
        .add(() => {
          tokenTween = scrambleTo(heroToken, tokenText);
        }, 1.3)
        // hold ~1.5s on the full lockup, then the break — the scene's beat
        // (wind → hitch → break); the heroMark cues below play the DOM side.
        // Only from a resting hero the reader can see: a restored scroll has
        // the scene elsewhere, and a hero scrolled away breaks unseen.
        .add('out', 2.8)
        .add(() => {
          const api = sceneRef.current;
          if (api?.getStage() === 'hero' && heroOnScreen()) api.goTo('stage-01', { cue: true });
        }, 'out')
        .add(() => {
          // Auto-advance only if the user hasn't already taken the wheel —
          // the glide carries the reader down into the hanging cloud.
          if (window.scrollY < 40) {
            window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir: 1 } }));
          }
        }, `out+=${breakAt + 0.9}`);
      const endSplash = () => {
        splash?.kill();
        splash = null;
      };
      // lagSmoothing(0) would land a hidden tab's whole interval in one frame.
      const onVisibility = () => splash?.paused(document.hidden);
      document.addEventListener('visibilitychange', onVisibility);
      if (broken) {
        endSplash();
        oGlobe.pause(); // the hero is off screen — the lockup wakes on the way back
      }

      /* — The scene's heroMark: the O's live geometry, its lockup, and the
         cues. The scene times every one; this side only answers. — */
      const heroMark = {
        // The disc the scene's replica must cover: the ring (96% of the
        // slot) and the globe inside it (the canvas is the ring ÷ the stroke
        // ratio, the sphere the canvas ÷ the ortho extent). Read live, so it
        // includes the wind-up's pinch.
        mark: () => {
          const b = globeWrap.getBoundingClientRect();
          if (!b.height) return null;
          const ringR = b.height * 0.48;
          return {
            cx: b.left + b.width / 2,
            cy: b.top + b.height / 2,
            ringR,
            globeR: ringR / (1 + O_STROKE_PCT / 100) / LOCKUP_EXTENT,
            scrollY: window.scrollY,
            ...oGlobe.orientation(),
          };
        },
        lockup: () => oGlobe,
        // The wind-up (the scene revs and burns the lockup): the token burns
        // down, and given the time, the O pinches and the word draws in
        // toward it — the counter-move before the outward release.
        onWind: (dur) => {
          fuseToken();
          if (dur < 0.2) return; // a short ?shattercharge has no time to gather
          const em = titleEm();
          gsap.to(globeWrap, { scale: 0.96, duration: dur, ease: 'power2.in', overwrite: 'auto' });
          chars.forEach((c, i) => {
            const { d, side } = reach[i];
            gsap.to(c, { x: -side * em * GATHER_EM[d - 1], duration: dur, ease: 'power2.in', overwrite: 'auto' });
          });
        },
        // The impact frame: the lockup hides on the frame the shards take
        // over, and the blast front runs out through the word — each letter
        // shoved away from the O, nearest hardest and first, and cut while
        // it flies. Idempotent: a reform the reader scrolls out of breaks
        // the half-returned word again.
        onBreak: () => {
          broken = true;
          // A break the reader scrolled into ends the splash (its glide would
          // chase a page already moving); the splash's own cue keeps it.
          if (splash && splash.time() < splash.labels.out) endSplash();
          gsap.killTweensOf(globeWrap);
          gsap.set(globeWrap, { autoAlpha: 0, scale: 1 });
          fuseToken();
          const em = titleEm();
          chars.forEach((c, i) => {
            const { d, side } = reach[i];
            gsap.to(c, {
              x: side * em * SHOVE_EM[d - 1],
              duration: 0.5,
              ease: 'expo.out',
              delay: (d - 1) * 0.02,
              overwrite: 'auto',
            });
          });
          letterDelay?.kill();
          letterCut?.kill();
          letterDelay = gsap.delayedCall(0.05, () => {
            letterCut = cutSchedule(chars.length, {
              stepMs: CHAR_CUT.outStepMs,
              onCut: (i) => {
                chars[i].style.visibility = 'hidden';
              },
            });
          });
          // The shards have the mark — the lockup stops drawing shortly
          // (hidden already; paused, never disposed — perf-2).
          pauseCall?.kill();
          pauseCall = gsap.delayedCall(0.25, oGlobe.pause);
        },
        // The reform begins — the WORD first: back in at the offsets the
        // blast threw it to, around an EMPTY O slot (the missing letter is
        // the world), closing on the house curve while the shards fly home.
        // The lockup wakes out of sight for the hand-back.
        onReformStart: (dur) => {
          endSplash();
          wakeGlobe();
          gsap.killTweensOf(globeWrap);
          gsap.set(globeWrap, { autoAlpha: 0, scale: 1 });
          const em = titleEm();
          chars.forEach((c, i) => {
            const { d, side } = reach[i];
            gsap.killTweensOf(c);
            gsap.set(c, { x: side * em * SHOVE_EM[d - 1] });
            c.style.visibility = 'hidden';
          });
          lettersIn();
          gsap.to(chars, { x: 0, duration: dur, ease: 'processTurn', overwrite: 'auto' });
        },
        // The landing frame: the lockup takes the mark back (the scene sets
        // its heat and spin right after this returns) and the token cuts
        // back in. Also the wind-up the reader scrolled out of: the O
        // un-pinches and the word un-gathers.
        onReform: () => {
          endSplash(); // a cancelled wind: the reader has the wheel — no auto-glide after it
          wakeGlobe();
          gsap.killTweensOf(globeWrap);
          if (broken) gsap.set(globeWrap, { autoAlpha: 1, scale: 1 });
          else gsap.to(globeWrap, { autoAlpha: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
          broken = false;
          lettersIn();
          gsap.to(chars, { x: 0, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
          returnToken();
        },
      };
      sceneRef.current?.setHeroMark?.(heroMark);
      // 10-07 (w4 fix): the scene's COPY_BEAT cues — the last one per stage
      // (it can land a hair before the section's own onEnter), and the
      // section waiting on it, if any.
      const beats = new Map(); // stage → { kind, at }
      const beatWaiters = new Map(); // stage → (kind) => void
      const beatKills = [];
      const nextKills = []; // 10-08 (w8): ?nexttease's running cuts
      sceneRef.current?.setCopyBeat?.((stageId, kind) => {
        beats.set(stageId, { kind, at: performance.now() });
        beatWaiters.get(stageId)?.(kind);
      });

      // Back up toward the hero: the lockup gets ready OUT OF SIGHT — the
      // scene's reform puts the word back first and hands the mark back on
      // its landing frame. (An O that never broke is simply still there.)
      ScrollTrigger.create({
        trigger: heroSection,
        start: 'top 60%',
        end: 'bottom top',
        onEnterBack: () => {
          endSplash();
          wakeGlobe();
        },
        onLeave: () => oGlobe.pause(), // scrolled past the hero — the O stops drawing
      });

      /* — Per-section entrances: same boundary geometry as the stage
         driver, so copy and scene move on the same beat — */
      const sections = gsap.utils.toArray('.process-stage, .process-cta', root);
      sections.forEach((section) => {
        const tokenEl = section.querySelector('.process-stage__token');
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
        if (tokenEl) tokenEl.textContent = '';

        gsap.set(split.lines, { yPercent: 110 });
        gsap.set(rises, { autoAlpha: 0, y: 14 });

        // 10-07 (w4): the section's COPY_BEAT lead (0 for most).
        let lead = copyLead(section.dataset.stage, sceneRef.current);
        /* 10-09 (w9): …and its RISE lead — the blurb and everything after it
           wait this much more (stage-02's dots). Built in; begin() takes it
           back out (shiftChildren from the rise on) when the arrival is not
           the authored show, so a plain S2 entrance plays as before. */
        let rise = riseLead(section.dataset.stage, sceneRef.current);
        let riseShift = rise; // what the built timeline holds right now
        const RISE_AT = 0.65; // the blurb's place in the entrance (the shift's pivot)
        const tl = gsap
          .timeline({ paused: true })
          .to(split.lines, { yPercent: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.35 + lead)
          .to(rises, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.12, ease: 'power2.out' }, RISE_AT + lead + rise);
        // 09-08 (Nathan): keyword highlights wipe in just after the blurb
        // lands — same timeline, so leave-back retracts them in kind.
        kwWipe(tl, section, 1.05 + lead + rise);
        /* A live re-dial of the lead (?debug) shifts the built entrance
           before it plays — only from rest at its start, never mid-run. */
        const syncLead = () => {
          if (tl.time() > 0 || tl.isActive()) return;
          const next = copyLead(section.dataset.stage, sceneRef.current);
          if (next !== lead) {
            tl.shiftChildren(next - lead, false, 0);
            lead = next;
          }
          rise = riseLead(section.dataset.stage, sceneRef.current); // 10-09 (w9): read at the crossing
        };
        /* 10-09 (w9): hold the rise (`full` — the dots are still being
           connected) or let it go (anything else), from rest only. The pivot
           sits a hair before the blurb, so the headline never moves. */
        const setRise = (target) => {
          if (target === riseShift || tl.time() > 0 || tl.isActive()) return;
          tl.shiftChildren(target - riseShift, false, RISE_AT + lead + Math.min(riseShift, target) - 1e-4);
          riseShift = target;
        };
        /* 10-09 (w9 fix): …and an arrival that did not watch the dots finds
           the entrance already RUNNING with the rise still held (a rushed
           show the reader stepped past keeps its 'full' clock off screen; back
           on S2 within ≈5s the blurb waited out the rest of it over a whole
           constellation reading 42/42). The rise and everything after it move
           up to the playhead — never earlier than the blurb's plain place, and
           never anything before the rise, so the headline is not touched. */
        const riseNow = () => {
          const at = RISE_AT + lead + riseShift; // where the blurb rises in the built entrance
          const t = tl.time();
          if (!riseShift || t >= at) return;
          const target = Math.max(t - RISE_AT - lead, 0);
          tl.shiftChildren(target - riseShift, false, at - 1e-4);
          riseShift = target;
        };
        /* 10-08 (w8, ?nexttease — Nathan's A/B, phone only): the card's
           `next: <phase>` line lands with the keyword wipe by the house
           cut (charCut — the chips' own entrance) and leaves by it on the
           leave-back. Parked visibility:hidden, never emptied: the line
           RESERVES its row from mount, so the card (and the Core's
           ?cardgap framing, phoneCardTop) never jumps when it lands. The
           call is direction-guarded: the reverse runs nextOut instead. */
        const nextEl = section.querySelector('.process-stage__next');
        let nextCut = null;
        // 10-08 (w8 fix): the line's state is a flag, not the crossing — a
        // re-entry while the leave-back's reverse had not yet passed the
        // call resumed FORWARD past it, so nextIn never ran and the line
        // stayed cut out for the visit (nextSync). Both ends are idempotent.
        let nextShown = false;
        const nextIn = () => {
          if (!nextEl || nextShown) return;
          nextShown = true;
          nextCut?.kill(); // a cut-out still running hands its text back first
          nextEl.style.visibility = '';
          nextCut = cutIn(nextEl);
        };
        const nextOut = () => {
          if (!nextEl || !nextShown) return;
          nextShown = false;
          nextCut?.kill();
          nextCut = cutOut(nextEl, {
            onComplete: () => {
              nextEl.style.visibility = 'hidden';
            },
          });
        };
        // a resumed entrance already past the call: the line comes back now
        const nextSync = () => {
          if (tl.time() >= 1.05 + lead + riseShift) nextIn();
        };
        if (nextEl) {
          nextEl.style.visibility = 'hidden';
          tl.call(() => {
            if (!tl.reversed()) nextIn();
          }, null, 1.05 + lead + rise);
          nextKills.push(() => nextCut?.kill());
        }
        // 10-07 (meaning-9 review): the phone's in-flow back_to_top is the
        // exit, so it comes in LAST, once the ask's highlight has settled
        // (it sat drawn before the headline rose). The house wipe, appended
        // to the same timeline: leave-back erases it in kind.
        const topChip = section.querySelector('.process-cta__top');
        if (topChip) {
          gsap.set(topChip, { autoAlpha: 0 });
          wipeIn(topChip, tl);
          // 10-07 (final review): the landed wipe's inset(0%) clip also
          // clips hit-testing — the chip's 44px ::before target (process.css)
          // read as its 21px box. Cleared once open; leave-back restores it
          // before the wipe reverses.
          tl.set(topChip, { clipPath: 'none' });
        }

        /* 10-07 (w4 fix): a led entrance starts on the scene's beat (see
           COPY_BEAT): `full` plays the lead from now, otherwise it is
           skipped (the tl starts AT the lead — nothing sits before it). */
        const stageId = section.dataset.stage;
        let wait = null; // a led entrance waiting on its cue
        const begin = (full) => {
          wait?.kill();
          wait = null;
          // 10-09 (w9): the rise waits only on the authored show
          if (rise || riseShift) setRise(full ? rise : 0);
          tl.timeScale(1).play(full ? 0 : lead);
        };
        const awaitBeat = (secs) => {
          wait?.kill();
          wait = gsap.delayedCall(secs, () => begin(false));
        };
        if (COPY_BEAT[stageId]) {
          beatWaiters.set(stageId, (kind) => {
            if (!wait) {
              if (kind === 'plain') riseNow(); // 10-09 (w9 fix): a plain cue reaching a running entrance
              return;
            }
            if (kind === 'queued') awaitBeat(BEAT_QUEUED_WAIT);
            else begin(kind === 'full');
          });
          beatKills.push(() => wait?.kill());
        }

        let scrambled = false; // chrome scrambles once; re-entries keep text
        ScrollTrigger.create({
          trigger: section,
          start: 'top 60%',
          end: 'bottom 60%',
          onEnter: () => {
            if (!scrambled) {
              scrambled = true;
              if (tokenEl) scrambleTo(tokenEl, tokenFinal);
            }
            syncLead();
            // No lead, or a leave-back being undone mid-reverse: as before.
            // 10-09 (w9): a rise lead waits on the cue like a lead does.
            if ((!lead && !rise) || tl.time() > 0) {
              tl.timeScale(1).play();
              nextSync(); // 10-08 (w8 fix)
              return;
            }
            const cue = beats.get(stageId);
            const fresh = cue && performance.now() - cue.at < BEAT_FRESH_MS ? cue.kind : null;
            if (fresh === 'full' || fresh === 'plain') begin(fresh === 'full');
            else awaitBeat(fresh === 'queued' ? BEAT_QUEUED_WAIT : BEAT_WAIT);
          },
          onEnterBack: () => {
            if (wait) begin(false); // back from a stage it was still waiting under
            else {
              // 10-09 (w9): never played (a reload below it) — no dots to wait
              // for; w9 fix: or still holding the rise from a show the reader
              // stepped past (riseNow — from rest it is setRise(0)'s shift)
              riseNow();
              tl.timeScale(1).play();
              nextSync(); // 10-08 (w8 fix)
            }
          },
          onLeaveBack: () => {
            wait?.kill();
            wait = null;
            nextOut(); // 10-08 (w8): ?nexttease's line, by the house cut
            tl.timeScale(1 / EXIT_RATIO).reverse();
          },
        });

        // Mid-page arrivals (scroll restoration): the section already
        // inside its region shows its copy without a boundary cross —
        // the driver's syncToScroll convention.
        const rect = section.getBoundingClientRect();
        const line = window.innerHeight * 0.6;
        if (rect.top <= line && rect.bottom >= line) {
          scrambled = true;
          if (tokenEl) tokenEl.textContent = tokenFinal;
          tl.progress(1);
        }
      });

      return () => {
        sceneRef.current?.setHeroMark?.(null);
        sceneRef.current?.setCopyBeat?.(null);
        beatKills.forEach((kill) => kill());
        nextKills.forEach((kill) => kill());
        document.removeEventListener('visibilitychange', onVisibility);
        endSplash();
        pauseCall?.kill();
        letterDelay?.kill();
        letterCut?.kill();
        tokenTween?.kill();
        tokenCut?.kill();
        window.removeEventListener('resize', onGlobeResize);
        oFadeBack.cancel();
        if (placeRaf) cancelAnimationFrame(placeRaf);
        oGlobe.dispose(); // the one place the lockup's context is released
        globeWrap.remove();
        splits.forEach((s) => s.revert());
      };
    },
    { scope: rootRef }
  );
}
