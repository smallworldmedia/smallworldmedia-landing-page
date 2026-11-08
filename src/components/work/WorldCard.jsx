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
 *   3. enter_world fades in and rests static (no pulse, SQ-24).
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
  DRAG_FOLLOW,
} from './world/worldConfig.js';
import { ENTER_TUNABLES } from './world/enterTune.js';
import {
  DRAG_TRACK_S,
  RELEASE_GLIDE_S,
  RELEASE_EASE,
} from '../../lib/motion.js';
import { formatYearRange } from '../../lib/formatYearRange.js';
// House scramble tokens for the PROJECT_## reveal (chrome kit).
import {
  SCRAMBLE_CHARS,
  SCRAMBLE_DURATION,
  SCRAMBLE_SPEED,
  SCRAMBLE_REVEAL_DELAY,
} from '../../lib/scramble.js';

gsap.registerPlugin(useGSAP, SplitText, ScrambleTextPlugin, CustomEase);

// Same curve the World Turn rolls on, so the card tracks the field.
const cardRollEase = CustomEase.create('fpCardRoll', TURN_EASE_PATH);

const CARD_TRAVEL = 70; // yPercent the card rides in/out (mirrors the media roll)

// enter_world rides the Envelopment bridge (ADR-0002): cover with the
// persistent RouteFill, then client-navigate; the detail page releases it.
// Duration comes LIVE from the enter-tune store at click time (?enterms /
// the ?entertune=1 bench; legacy ?entercover still seeds it), so a dialed
// choreography drives the real commit, not just the bench's dry-run.
let departing = false;
function enterWorld(e, slug, color) {
  if (PREFERS_REDUCED_MOTION) return; // plain ClientRouter navigation
  e.preventDefault();
  if (departing) return;
  departing = true;
  const coverS = ENTER_TUNABLES.enterMs / 1000;
  window.dispatchEvent(
    // S2: the enter fill ingests the project's accent (blank → blue in RouteFill).
    // SQ-32: loader + loaderAfterCover — the globe loader opens over the cover
    // once it is fully up (+ ?loaderlead), and not at all if the page is ready first.
    new CustomEvent('swm:envelop', { detail: { duration: coverS, color, loader: true, loaderAfterCover: true } })
  );
  window.dispatchEvent(
    // Scene choreography: useWorldScene answers with the synced lens-deepen +
    // scale-up enter-ramp under the rising cover (same duration, one gesture).
    new CustomEvent('swm:enter-world', { detail: { duration: coverS, color } })
  );
  setTimeout(() => {
    departing = false;
    navigate(`/work/${slug}`);
  }, coverS * 1000 + 60);
}

const pad2 = (n) => String(n + 1).padStart(2, '0');

export default function WorldCard({ world, index, phase = 'enter', dir = 1 }) {
  const ref = useRef(null);
  const listenersRef = useRef(null); // drag-follow listener teardown

  useGSAP(
    (context, contextSafe) => {
      // Per-run housekeeping: listeners left over from a previous phase run
      // must not survive into this one (the deferred-cleanup context only
      // reverts on unmount, not on enter→exit flips).
      listenersRef.current?.();
      listenersRef.current = null;

      const wrap = ref.current;
      if (!wrap || !world) return;
      const q = gsap.utils.selector(wrap);

      // forward (dir>0): media enters from below, exits up top. back: mirror.
      const enterFrom = dir > 0 ? CARD_TRAVEL : -CARD_TRAVEL;
      const exitTo = dir > 0 ? -CARD_TRAVEL : CARD_TRAVEL;

      if (phase === 'exit') {
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

      // Drag-follow (FeaturedProjects' swm:fp-drag, 11-03; wheel + touch): the resting
      // card leans DRAG_FOLLOW of its Turn travel at full fill, on `y` — the
      // Turn tweens yPercent, so the exit carries on from the leaned pose and
      // only a release springs it home. Enter phase only (this run).
      const lean = contextSafe((e) => {
        const { value = 0, release = false } = e.detail || {};
        gsap.to(wrap, {
          y: -value * DRAG_FOLLOW * (CARD_TRAVEL / 100) * wrap.offsetHeight,
          duration: release ? RELEASE_GLIDE_S : DRAG_TRACK_S,
          ease: release ? RELEASE_EASE : 'power1.out',
          overwrite: 'auto',
        });
      });
      window.addEventListener('swm:fp-drag', lean);
      listenersRef.current = () => {
        window.removeEventListener('swm:fp-drag', lean);
      };

      // Entrance: PROJECT_## scrambles in place at the top-left, then the rest of
      // the card reveals — text lines → CTA → service tags.
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
              // 09-09: the reveal beat is a house token now, so this tab and
              // every scrambleTo elsewhere run byte-identical choreography.
              speed: SCRAMBLE_SPEED,
              revealDelay: SCRAMBLE_REVEAL_DELAY,
            },
          },
          0
        )
        // text lines reveal top → bottom
        .to(split.lines, { yPercent: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.58)
        // enter_world in — then it rests static
        .to(cta, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.92)
        // service tags lift in, one by one
        .to(tags, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, 1.0);

      return () => {
        listenersRef.current?.();
        listenersRef.current = null;
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
          zoom_in
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
