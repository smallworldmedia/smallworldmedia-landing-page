/**
 * WorldCard — the centred identity card for one Featured Project World, with
 * its "OS window boot" entrance choreography (P3 chrome).
 *
 * The card body follows the media behind it: it translates in from the bottom
 * (forward) / top (back) and out the opposite edge, on the same CustomEase +
 * duration as the WebGL World Turn, so card and field move as one gesture.
 *
 * On enter, the boot sequence plays:
 *   1. PROJECT_## reveals with a unicode scramble (dancing symbols), in place
 *      at the card's top-left.
 *   2. Client + meta text reveals line-by-line, top→bottom (SplitText).
 *   3. enter_world fades in, rests a beat, then dims persistently on the
 *      house pulse (FP-1) — hover/focus holds it at full strength.
 *   4. Service tags populate one-by-one, lifting up into place.
 *
 * Rendered twice during a Turn: the incoming card (phase="enter") and the
 * outgoing card (phase="exit", which just rides out + fades).
 *
 * @param {Object} props
 * @param {Object} props.world  - the World ({ slug, clientName, title, yearStart, yearEnd, isOngoing, services, ... })
 * @param {number} props.index  - its index (drives the PROJECT_## tab)
 * @param {'enter'|'exit'} props.phase
 * @param {number} props.dir    - Turn direction (+1 forward, −1 back)
 */
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { projectColorVars } from '../../lib/projectColor.js';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { navigate } from 'astro:transitions/client';
import {
  TURN_DURATION,
  TURN_EASE_PATH,
  PREFERS_REDUCED_MOTION,
} from './world/worldConfig.js';
import { housePulseLoop, HOUSE_PULSE_PERIOD_S } from '../../lib/motion.js';
// FP-1 house-pulse tuning bench (dev-only, ?fp1tune=1). Absent without the
// param: FP1_TUNE_ACTIVE is false and the shipped pulse stays motion.js default.
import {
  FP1_TUNE_ACTIVE,
  liveHousePulseLoop,
  getLivePulse,
  subscribeFp1,
} from './fp1Tune.js';
import { formatYearRange } from '../../lib/formatYearRange.js';
// House scramble tokens for the PROJECT_## reveal (chrome kit).
import { SCRAMBLE_CHARS, SCRAMBLE_DURATION, SCRAMBLE_SPEED } from '../../lib/scramble.js';

gsap.registerPlugin(useGSAP, SplitText, ScrambleTextPlugin, CustomEase);

// Same curve the World Turn rolls on, so the card tracks the field.
const cardRollEase = CustomEase.create('fpCardRoll', TURN_EASE_PATH);

const CARD_TRAVEL = 70; // yPercent the card rides in/out (mirrors the media roll)

// enter_world rides the Envelopment bridge (ADR-0002): cover with the
// persistent RouteFill, then client-navigate; the detail page releases it.
// ?entercover=<ms> tunes the cover live.
const ENTER_COVER_SECONDS = (() => {
  if (typeof window === 'undefined') return 0.5;
  const n = parseFloat(new URLSearchParams(window.location.search).get('entercover'));
  return Number.isFinite(n) ? n / 1000 : 0.5; // deliberate colour sweep into the world (dial via ?entercover=<ms>)
})();
let departing = false;
function enterWorld(e, slug, color) {
  if (PREFERS_REDUCED_MOTION) return; // plain ClientRouter navigation
  e.preventDefault();
  if (departing) return;
  departing = true;
  window.dispatchEvent(
    // S2: the enter fill ingests the project's accent (blank → blue in RouteFill).
    new CustomEvent('swm:envelop', { detail: { duration: ENTER_COVER_SECONDS, color } })
  );
  setTimeout(() => {
    departing = false;
    navigate(`/work/${slug}`);
  }, ENTER_COVER_SECONDS * 1000 + 60);
}

const pad2 = (n) => String(n + 1).padStart(2, '0');

// Live tuning (?key=value) — matches the WorldScene knobs convention.
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

// FP-1: once the boot entrance rests, enter_world dims on the house pulse
// (housePulseLoop's boomerang: bright → dip → return, equal rest between hits).
// enter_world reading of the house pulse — Nathan's 2026-07-17 dial.
const PULSE_PEAK_OPACITY = PARAM('fp1dim', 0.3); // opacity at the dip's deepest point
const PULSE_PERIOD_S = PARAM('fp1period', HOUSE_PULSE_PERIOD_S); // full cycle: hit + rest
const PULSE_REST_BEAT_S = PARAM('fp1rest', 1.05); // beat between boot-end and first dip

export default function WorldCard({ world, index, phase = 'enter', dir = 1 }) {
  const ref = useRef(null);
  const pulseRef = useRef(null); // FP-1: this card's live housePulseLoop
  const listenersRef = useRef(null); // FP-1: hover/focus listener teardown
  const tuneUnsubRef = useRef(null); // FP-1 bench: fp1Tune subscription teardown
  const phaseRef = useRef(phase);
  phaseRef.current = phase; // a still-flying enter tl must see phase flips

  useGSAP(
    (context, contextSafe) => {
      // FP-1 per-run housekeeping: a pulse or hover listeners left over from a
      // previous phase run must not survive into this one (the deferred-cleanup
      // context only reverts on unmount, not on enter→exit flips).
      pulseRef.current?.kill();
      pulseRef.current = null;
      listenersRef.current?.();
      listenersRef.current = null;
      tuneUnsubRef.current?.();
      tuneUnsubRef.current = null;

      const wrap = ref.current;
      if (!wrap || !world) return;
      const q = gsap.utils.selector(wrap);

      // forward (dir>0): media enters from below, exits up top. back: mirror.
      const enterFrom = dir > 0 ? CARD_TRAVEL : -CARD_TRAVEL;
      const exitTo = dir > 0 ? -CARD_TRAVEL : CARD_TRAVEL;

      if (phase === 'exit') {
        // FP-1: the pulse was killed above, which can strand the CTA's opacity
        // mid-dip (the boomerang ease never rested at 1) — restore full
        // strength so the card rides out uniform.
        const exitCta = q('.fp-card__cta')[0];
        if (exitCta) gsap.set(exitCta, { opacity: 1 });
        if (PREFERS_REDUCED_MOTION) {
          gsap.set(wrap, { autoAlpha: 0 });
          return;
        }
        gsap.to(wrap, {
          yPercent: exitTo,
          autoAlpha: 0,
          duration: TURN_DURATION,
          ease: cardRollEase,
        });
        return;
      }

      // ── ENTER ──
      if (PREFERS_REDUCED_MOTION) {
        gsap.set(wrap, { yPercent: 0, autoAlpha: 1 });
        return;
      }

      const tab = q('.fp-card__tab')[0];
      const cta = q('.fp-card__cta')[0];
      const tags = q('.fp-tag');
      const lineTargets = q('.fp-card__client, .fp-card__meta');

      // Split the headline + meta into masked lines (slide up from a clip).
      const split = SplitText.create(lineTargets, {
        type: 'lines',
        mask: 'lines',
        linesClass: 'fp-line',
      });

      // Initial hidden states (set synchronously, pre-paint → no flash).
      gsap.set(wrap, { autoAlpha: 1 });
      gsap.set(tab, { autoAlpha: 0 });
      gsap.set(cta, { autoAlpha: 0, scale: 0.9 });
      gsap.set(tags, { autoAlpha: 0, y: 14 });
      gsap.set(split.lines, { yPercent: 110 });

      // Card body rides in on the Turn curve.
      gsap.fromTo(
        wrap,
        { yPercent: enterFrom },
        { yPercent: 0, duration: TURN_DURATION, ease: cardRollEase }
      );

      // FP-1: the persistent enter_world dim. Created synchronously (so the
      // gsap context captures it and kills it on unmount) but paused — the
      // boot tl's end starts it after a rest beat, never before the entrance
      // has settled. Reduced motion never reaches here (early return above).
      // With the ?fp1tune bench live, the pulse reads the panel's curve/dim/
      // period instead of the motion.js default; the closures below go through
      // pulseRef.current so a bench rebuild is picked up transparently.
      const pulse = FP1_TUNE_ACTIVE
        ? liveHousePulseLoop(gsap, cta)
        : housePulseLoop(gsap, cta, { opacity: PULSE_PEAK_OPACITY }, PULSE_PERIOD_S);
      pulse.pause();
      pulseRef.current = pulse;
      const restBeat = FP1_TUNE_ACTIVE ? getLivePulse().rest : PULSE_REST_BEAT_S;

      // Hover/focus reads as "ready": hold the CTA at full strength while the
      // visitor is on it, then resume from a clean cycle start on leave. The
      // pulse may only run once the boot tl has handed off (armed) AND the
      // visitor is off the CTA — a leave during the entrance must not start
      // it early, and an arm during a held hover must stay calm.
      let armed = false;
      let hovered = false;
      let calmTween = null;
      const calm = contextSafe(() => {
        hovered = true;
        pulseRef.current?.pause();
        calmTween = gsap.to(cta, { opacity: 1, duration: 0.15 });
      });
      const stir = contextSafe(() => {
        hovered = false;
        calmTween?.kill();
        calmTween = null;
        if (armed && phaseRef.current === 'enter') pulseRef.current?.restart(true);
      });
      cta.addEventListener('mouseenter', calm);
      cta.addEventListener('mouseleave', stir);
      cta.addEventListener('focusin', calm);
      cta.addEventListener('focusout', stir);
      listenersRef.current = () => {
        cta.removeEventListener('mouseenter', calm);
        cta.removeEventListener('mouseleave', stir);
        cta.removeEventListener('focusin', calm);
        cta.removeEventListener('focusout', stir);
      };

      // FP-1 bench (?fp1tune): a slider move re-creates the live pulse on this
      // CTA so the curve/dim/period change shows immediately. Kill the prior
      // timeline (no leak), rebuild from the new state, and resume only if the
      // CTA is armed and not held. Rest previews on the entrance/Turn, not here.
      if (FP1_TUNE_ACTIVE) {
        const rebuild = contextSafe(() => {
          pulseRef.current?.kill();
          gsap.set(cta, { opacity: 1 }); // clear any mid-dip strand
          const next = liveHousePulseLoop(gsap, cta);
          next.pause();
          pulseRef.current = next;
          if (armed && !hovered && phaseRef.current === 'enter') next.play();
        });
        tuneUnsubRef.current = subscribeFp1(rebuild);
      }

      // Entrance: PROJECT_## scrambles in place at the top-left, then the rest of
      // the card reveals — text lines → CTA (then pulse) → service tags.
      const tl = gsap.timeline({ delay: 0.08 });

      tl.set(tab, { autoAlpha: 1 })
        .to(
          tab,
          {
            duration: SCRAMBLE_DURATION,
            ease: 'none',
            scrambleText: {
              text: `PROJECT_${pad2(index)}`,
              chars: SCRAMBLE_CHARS,
              speed: SCRAMBLE_SPEED,
              revealDelay: 0.1,
            },
          },
          0
        )
        // text lines reveal top → bottom
        .to(split.lines, { yPercent: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.58)
        // enter_world in — its FP-1 house-pulse dim starts at the tl's end below
        .to(cta, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.92)
        // service tags lift in, one by one
        .to(tags, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, 1.0)
        // FP-1: entrance rests a beat, then the pulse takes over. A callback
        // (not the repeat:-1 loop itself — an infinite tween inside the boot
        // tl would make its duration infinite) started only if this card is
        // still the entering one and the visitor isn't holding the CTA.
        .add(() => {
          armed = true;
          if (!hovered && phaseRef.current === 'enter') pulseRef.current?.play();
        }, `+=${restBeat}`);

      return () => {
        listenersRef.current?.();
        listenersRef.current = null;
        tuneUnsubRef.current?.();
        tuneUnsubRef.current = null;
        split.revert();
      };
    },
    { scope: ref, dependencies: [phase] }
  );

  if (!world) return null;

  return (
    <div
      className="fp-card-wrap"
      data-phase={phase}
      ref={ref}
      // S2: this card's accent palette. Scoped to the card subtree so the
      // outgoing (exit) and incoming (enter) cards keep their own colors
      // through a Turn; blank → the surfaces fall back to brand blue.
      style={projectColorVars(world.projectColor, world.projectColorSecondary)}
    >
      <span className="fp-card__tab">{`PROJECT_${pad2(index)}`}</span>
      <div className="fp-card">
        <h2 className="fp-card__client">{world.clientName}</h2>
        {(world.title || world.yearStart) && (
          <p className="fp-card__meta">
            {[world.title, formatYearRange(world.yearStart, world.yearEnd, world.isOngoing)].filter(Boolean).join(', ')}
          </p>
        )}
        <a
          className="fp-card__cta cta-primary"
          href={`/work/${world.slug}`}
          onClick={(e) => enterWorld(e, world.slug, world.projectColor)}
        >
          enter_world
        </a>
        {world.services?.length > 0 && (
          <ul className="fp-card__tags">
            {world.services.map((s) => (
              <li key={s.slug} className="fp-tag">
                {s.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
