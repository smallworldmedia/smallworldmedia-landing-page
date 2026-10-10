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
   never eat the tuning panel's sliders or the inquiry overlay's scroll.
   10-07 (final review): and the privacy notice's — a target inside it is
   guarded even in the frame before SiteShell sets data-chrome-open. */
const CHROME_SELECTOR =
  '.process-debug, .project-overlay, .privacy-overlay, .site-nav, .mobile-menu, input, select, textarea';

// The keys the quantizer steps on — every other key is the browser's.
const QUANT_KEYS = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', ' ', 'Home', 'End'];

export default function useProcessScrollDriver(rootRef, sceneRef) {
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return undefined;

      // Shared house curve for the top-level glides (P6 back-to-top, and
      // the fallback path). The quantizer builds its own inside attach.
      const homeEase = CustomEase.create('processHome', TURN_EASE_PATH);

      /* 10-07 (mech-1): ONE jump path for multi-section glides (back_to_top,
         Home, End). A glide across the page used to cross every boundary
         line on its way — four or five goTo()s inside ~250ms, each killing
         the last a frame or two in (the S5 gradient left over S1 and the
         hero). While `jumping`, the boundary triggers stand down and the
         scene plays ONE transition to the destination (a cut: it never
         rides the S1→S2 show's rush), alongside the page glide. The glide
         holds the quantizer's lock, so a wheel can't start a rival commit. */
      let lockUntil = 0; // the glide lock — the quantizer's commits and the jumps share it
      let jumping = false;
      let jumpTimer = 0;
      // 10-07 (final review, resize-reseat): the stage a commit / jump glide
      // is carrying the page to — read only while its lock holds.
      let glideTarget = null;
      /* 10-07 (final review): a RESIZE KEEPS THE READER'S SECTION. A window
         resize or a phone rotation moves every rest, and the browser clamps
         scrollY the instant the document shrinks — the clamp's scroll event
         then ran ScrollTrigger.update against the PRE-resize trigger ranges
         (its refresh is debounced 0.2s), so a resize at the CTA rest drove
         cta → stage-05 → cta (the freed shard flew home, first_contact
         lost), one at the S3 rest drove stage-04 and cut the spec chips,
         and a glide in flight landed on its stale absolute target, between
         rests. From the first resize event until ScrollTrigger's refresh
         (or RESIZE_FALLBACK_S, for one it skips — a phone's toolbar) the
         boundary triggers stand down; the refresh then re-seats the page on
         the held section's rest, instantly. Held = the glide's destination
         while one is in flight, else the stage the SCENE holds (scrollY may
         already be clamped). The fallback must never beat a refresh that is
         still coming: ScrollTrigger's is a 0.2s delayedCall, so ours is one
         too (same ticker clock — a stalled frame can't reorder them), AND
         ScrollTrigger HOLDS that refresh while the page scrolls (it runs on
         scrollEnd) — a glide in flight outlasted a bare 0.6s fallback, which
         lifted the gate unseated and parked the page on the glide's stale
         target between rests (900×700 mid-glide: y 4860 under stage-05).
         So the fallback waits out ScrollTrigger.isScrolling() as well. */
      let resizing = false;
      let heldStage = null;
      let resizeFallback = null;
      const RESIZE_FALLBACK_S = 0.6;

      // Reduced motion: no timelines — every boundary is a single-frame
      // still (spec §7). Every state stays reachable in both directions.
      const drive = (stageId, { instant = false, jump = false } = {}) => {
        const api = sceneRef.current;
        if (!api || !stageId) return;
        if ((jumping || resizing) && !jump) return; // a jump glide passing a boundary line / a resize's stale ranges
        if (instant || PREFERS_REDUCED_MOTION) api.setStageInstant(stageId);
        else api.goTo(stageId, jump ? { cut: true } : undefined);
      };

      // 10-07: the HERO is a scene stage too — the shards live in the
      // globe-O there, break into the belt on the way down and re-form in
      // the O on the way back up.
      // 10-07 (w7, cta-finale): and so is the CTA ('cta') — the world
      // resolves and steps back for the ask, so the S5 loop stops paging
      // under YOUR WORLD NEXT; End lands on it, Home glides from it.
      const sections = gsap.utils.toArray('.process-hero, .process-stage, .process-cta', root);
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
      // At the top the scene rests in the hero: the shards ARE the O.
      const stageAtLine = () => {
        const line = window.innerHeight * 0.6;
        const active = sections.filter(
          (s) => s.getBoundingClientRect().top <= line
        ).pop();
        return active?.dataset.stage ?? 'hero';
      };
      const syncToScroll = () => drive(stageAtLine(), { instant: true });
      syncToScroll();

      /* The jump: the scene goes straight to `stageId` (one goTo) while the
         page glides to `y` on the house curve. Landing re-reads the section
         under the line — a no-op when the glide arrived (goTo dedupes), a
         real transition when something stopped it elsewhere. Lenis drops a
         superseded glide's onComplete, so a timer lands it regardless. */
      const jumpTo = (y, stageId) => {
        const lenis = getLenis();
        if (!lenis || PREFERS_REDUCED_MOTION) {
          window.scrollTo(0, y); // RM / no Lenis: the instant jump (stills at the boundaries)
          return;
        }
        const land = () => {
          if (!jumping) return;
          jumping = false;
          clearTimeout(jumpTimer);
          drive(stageAtLine());
        };
        jumping = true;
        clearTimeout(jumpTimer);
        drive(stageId, { jump: true });
        glideTarget = stageId;
        lockUntil = performance.now() + TUNING.swipeSeconds * 1000 + 80;
        jumpTimer = setTimeout(land, TUNING.swipeSeconds * 1000 + 250);
        lenis.scrollTo(y, {
          duration: TUNING.swipeSeconds,
          easing: homeEase,
          force: true,
          lock: true,
          onComplete: land,
        });
      };

      /* Section rest positions, computed fresh per gesture (fonts,
         resizes and the CTA's runway all move them): each section
         centers in the viewport; sections taller than the viewport
         rest past their top so the copy block sits centered. The
         document end is one extra step when the footer adds runway.
         09-08 (Nathan): NOT any more — the footer + logo ticker are
         baked into the LAST slide: when the footer's spacer adds
         runway, the final section's rest IS the document end, so one
         swipe lands the CTA with the panel fully risen beneath it.
         10-07 (final review): hoisted out of the quantizer — the resize
         re-seat measures the same rests. */
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
        if (stops.length && maxScroll > stops[stops.length - 1]) stops[stops.length - 1] = maxScroll;
        return stops;
      };

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
          // 10-07 (w3 fix): leaving the BELT, the chips leave NOW, either way
          // — the S2 line (or the hero's) is crossed mid-glide, and by then a
          // phone's copy has swept every chip off in one frame (and a chip
          // could still bind and type in under a reader already gone).
          // 10-07 (w5): the S3 spec chips the same, off stage-03 either way;
          // the pulses recover to the target stage's power (its id rides
          // along). Handoff 7e: back to the HERO they take the quick retract
          // (the fill's, as the reverse uses) — mid-cut chips 0.3–0.48s on
          // were still up as the PROCESS letters re-entered. 10-07 (w5 fix):
          // off S3 always the quick retract — the Core moves under the spec
          // chips either way (S2's swell, S4's burst) and the slow cut carried
          // bare boxes out to the frame edges.
          // 10-07 (w7): and the CTA's first_contact chip, off the CTA (its
          // house letter cut, as the shard flies home).
          // 10-08 (w8): and S5's page chip, off stage-05 either way (its house
          // letter cut — gone before the CTA's first_contact types in).
          const fromStage = sceneRef.current?.getStage?.();
          const toStage = gsap.utils.toArray('.process-section', root)[target]?.dataset.stage;
          if ((fromStage === 'stage-01' || fromStage === 'stage-03' || fromStage === 'stage-05' || fromStage === 'cta') && toStage !== fromStage) {
            sceneRef.current.leaveLabels?.(toStage === 'hero' || fromStage === 'stage-03', toStage ?? null);
          }
          // 10-07 (w4, thread-words): the same for the Thread's words — off
          // stage-02 mid-Thread, either way (back on the quick retract, so
          // none rides the shards' return to the belt).
          if (fromStage === 'stage-02' && toStage !== 'stage-02') {
            sceneRef.current?.leaveThreadWords?.(dir < 0);
          }
          // 10-07: leaving the hero breaks the O NOW, while it is still in
          // frame — stage-01's own 60% line is crossed with the O already
          // gone (the glide covers ~40% of its run in its first tenth of a
          // second). That trigger then lands as a no-op.
          if (dir > 0 && fromStage === 'hero') drive('stage-01');
          clearRelease();
          accum = 0;
          armed = false; // this gesture's inertia tail must not re-fill
          leanTo(0, 0.3, 'power2.out');
          glideTarget = toStage ?? null; // 10-07 (final review): a resize mid-glide lands HERE
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
           (the Hero accumulator's guard). 10-07 (final review): any of the
           shell's overlays — SiteShell's data-chrome-open latch covers the
           info drawer, the inquiry overlay and the privacy notice (a phone
           swipe inside the notice paged the walk behind it, and the keys
           stepped it). */
        const overlayOpen = () =>
          document.documentElement.hasAttribute('data-chrome-open') ||
          document.querySelector('.project-overlay')?.dataset.open === 'true';
        // What the quantizer must leave alone while it owns input: an open
        // overlay, or a gesture that starts inside chrome. (?swipe off is
        // tested apart — Lenis is running then, and owns the wheel.)
        const chromeOwns = (e) =>
          overlayOpen() || (e.target instanceof Element && Boolean(e.target.closest(CHROME_SELECTOR)));

        /* 10-07 (mob-2): what the quantizer doesn't own passes through —
           and must ALSO be flagged past Lenis: it is stopped while we own
           input, and a stopped Lenis preventDefaults every cancelable wheel
           or touchmove it sees (its listeners run after ours; it skips an
           event carrying lenisStopPropagation). */
        const passThrough = (e) => {
          e.lenisStopPropagation = true;
        };
        // A pinch never finishes a step its first finger began.
        const dropPartial = () => {
          if (!accum) return;
          clearRelease();
          accum = 0;
          leanTo(0, 0.45, 'expo.out');
        };

        const onWheel = (e) => {
          syncLenisLock();
          if (e.ctrlKey) return; // trackpad pinch-zoom stays native
          // A page pinched in pans natively (the touch rule): a zoomed
          // reader's two-finger pan is plain wheels — consumed, it would
          // throw them to the next section. Stepping resumes at 1×.
          if ((window.visualViewport?.scale ?? 1) > 1.01) {
            passThrough(e);
            return;
          }
          // A mostly-horizontal swipe is the browser's back/forward gesture
          // (a consumed wheel cancels it); a diagonal flick still steps.
          if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
            passThrough(e);
            return;
          }
          if (!swipeOn()) return;
          // 10-07 (final review): chrome's own scroll (the privacy notice,
          // the bench) needs the stopped Lenis to leave the wheel alone too.
          if (chromeOwns(e)) {
            passThrough(e);
            return;
          }
          e.preventDefault();
          addDelta(e.deltaY);
        };
        const onTouchStart = (e) => {
          syncLenisLock();
          // Two fingers are a pinch-zoom, never a swipe.
          touchY = e.touches.length > 1 ? null : (e.touches[0]?.clientY ?? null);
        };
        const onTouchMove = (e) => {
          // A second finger, or a page already zoomed in: native pinch and
          // pan (a zoomed reader steps again once back at 1×).
          if (e.touches.length > 1 || (window.visualViewport?.scale ?? 1) > 1.01) {
            touchY = null;
            dropPartial();
            passThrough(e);
            return;
          }
          // 10-07 (final review): a gesture chrome owns passes EVERY move
          // through (the stopped Lenis cancels any it sees), so the privacy
          // notice's own overflow scroll runs for the whole swipe.
          if (swipeOn() && chromeOwns(e)) {
            touchY = null; // the gesture belongs to the chrome now
            passThrough(e);
            return;
          }
          if (touchY === null) return;
          if (!swipeOn()) {
            touchY = null;
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
          // 10-07 (mob-2): only the stepping keys are ours — Tab / Shift+Tab,
          // Enter and every Cmd/Ctrl/Alt combo (Cmd+F, zoom) stay native,
          // lock or no lock. Shift is allowed: Shift+Space steps back.
          if (!QUANT_KEYS.includes(e.key) || e.metaKey || e.ctrlKey || e.altKey) return;
          // Space on a focused button presses it ([previous], back_to_top,
          // start_project, the menu): a prevented keydown cancels the press
          // and stepped the page instead — forward, even from [previous].
          if (e.key === ' ' && t instanceof Element && t.closest('button, [role="button"], summary'))
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
            // Home / End cross the whole page: the jump path (one scene move).
            case 'Home':
              e.preventDefault();
              jumpTo(0, sections[0]?.dataset.stage ?? 'hero');
              break;
            case 'End':
              e.preventDefault();
              jumpTo(stops[stops.length - 1], sections[sections.length - 1]?.dataset.stage);
              break;
            default:
          }
        };

        // Capture phase: runs ahead of Lenis's bubble-phase VirtualScroll
        // (belt and braces — Lenis is stopped anyway while we own input).
        window.addEventListener('wheel', onWheel, { passive: false, capture: true });
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
        window.addEventListener('touchend', onTouchEnd);
        window.addEventListener('touchcancel', onTouchEnd); // an OS-stolen touch ends the gesture too
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
          window.removeEventListener('touchcancel', onTouchEnd);
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

      /* 10-07 (final review): the resize re-seat (see `resizing` above).
         Only the quantizer's rests are re-seated — reduced motion snaps
         natively (process.css) and ?swipe off is free scroll; both still
         get the gate, then the one drive to the section under the line. */
      const settleResize = (reseat = true) => {
        resizeFallback?.kill();
        if (!resizing) return;
        const held = heldStage;
        heldStage = null;
        const i = sections.findIndex((s) => s.dataset.stage === held);
        if (reseat && quantizerCleanup && swipeOn() && i >= 0) {
          const lenis = getLenis();
          // Lenis measures the window on its own 250ms debounce — its limit
          // would clamp a taller page's rest to the old document end.
          lenis?.resize?.();
          const y = rests()[i];
          if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
          // The dead glide's lock and a jump's pending land go with it.
          lockUntil = 0;
          jumping = false;
          clearTimeout(jumpTimer);
          ScrollTrigger.update();
        }
        resizing = false;
        // A no-op when the held stage is the one under the line (goTo
        // dedupes); a glide's destination it never reached, when not.
        drive(stageAtLine());
      };
      const onResize = () => {
        if (!resizing) {
          heldStage =
            performance.now() < lockUntil && glideTarget
              ? glideTarget
              : (sceneRef.current?.getStage?.() ?? null);
          resizing = true;
        }
        resizeFallback?.kill();
        // No refresh (ScrollTrigger skips a phone toolbar's resize): nothing
        // re-measured, nothing to re-seat — the gate just lifts. Not while
        // the page still scrolls: a refresh may be held for its scrollEnd.
        resizeFallback = gsap.delayedCall(RESIZE_FALLBACK_S, fallbackSettle);
      };
      /* 10-09 (w9b, phone-resize): ScrollTrigger's mobile heuristic
         (ignoreMobileResize, on any touch device) compares each resize with
         its BASE screen — taken at load and on an orientation flip, never
         at a refresh. 390×844 → 430×932 refreshed (the width left the
         base), but → 390×844 matched the base again, so no refresh came:
         the fallback lifted the gate unseated and the page sat on 430's
         rests, off the line. The fallback now applies the same test against
         the viewport the triggers were last MEASURED at (every refresh
         records it): the width moved, or the height by more than a quarter
         — then it runs the refresh ScrollTrigger skipped (Lenis re-measured
         first), whose onRefresh re-seats as usual. A toolbar's small height
         change still lifts the gate with no refresh. */
      let measuredVp = { w: window.innerWidth, h: window.innerHeight };
      const fallbackSettle = () => {
        if (ScrollTrigger.isScrolling()) {
          resizeFallback = gsap.delayedCall(0.1, fallbackSettle);
          return;
        }
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w !== measuredVp.w || Math.abs(h - measuredVp.h) > h * 0.25) {
          getLenis()?.resize?.();
          ScrollTrigger.refresh(); // → onRefresh → settleResize() (the re-seat)
          if (resizing) settleResize(); // belt and braces: a refresh that did not dispatch
          return;
        }
        settleResize(false);
      };
      const onRefresh = () => {
        measuredVp = { w: window.innerWidth, h: window.innerHeight }; // 10-09 (w9b)
        if (resizing) settleResize();
      };
      window.addEventListener('resize', onResize);
      ScrollTrigger.addEventListener('refresh', onRefresh);

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

      /* P6 back-to-top (the closing "YOUR WORLD NEXT" control) → the jump
         path: the page glides to the top on the house Turn curve while the
         scene plays ONE move, the world flying home into the O (the reform,
         from wherever the shards are). force:true glides even while the
         quantizer holds Lenis stopped; under reduced motion (no Lenis) it's
         an instant jump. */
      const onHome = () => jumpTo(0, sections[0]?.dataset.stage ?? 'hero');
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
        clearTimeout(jumpTimer);
        jumping = false;
        resizeFallback?.kill();
        resizing = false;
        window.removeEventListener('resize', onResize);
        ScrollTrigger.removeEventListener('refresh', onRefresh);
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
