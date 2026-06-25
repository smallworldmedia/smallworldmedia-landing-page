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
 *   3. enter_world fades in and then pulses persistently (primary CTA).
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
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { CustomEase } from 'gsap/CustomEase';
import {
  TURN_DURATION,
  TURN_EASE_PATH,
  PREFERS_REDUCED_MOTION,
} from './world/worldConfig.js';
import { formatYearRange } from '../../lib/formatYearRange.js';

gsap.registerPlugin(useGSAP, SplitText, ScrambleTextPlugin, CustomEase);

// Same curve the World Turn rolls on, so the card tracks the field.
const cardRollEase = CustomEase.create('fpCardRoll', TURN_EASE_PATH);

// Dancing-symbol set for the PROJECT_## scramble reveal.
const SCRAMBLE_CHARS = '01<>[]{}/\\|=+*#%░▒▓█—';
const CARD_TRAVEL = 70; // yPercent the card rides in/out (mirrors the media roll)

const pad2 = (n) => String(n + 1).padStart(2, '0');

export default function WorldCard({ world, index, phase = 'enter', dir = 1 }) {
  const ref = useRef(null);

  useGSAP(
    () => {
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

      // Entrance: PROJECT_## scrambles in place at the top-left, then the rest of
      // the card reveals — text lines → CTA (then pulse) → service tags.
      const tl = gsap.timeline({ delay: 0.08 });

      tl.set(tab, { autoAlpha: 1 })
        .to(
          tab,
          {
            duration: 0.7,
            ease: 'none',
            scrambleText: {
              text: `PROJECT_${pad2(index)}`,
              chars: SCRAMBLE_CHARS,
              speed: 0.7,
              revealDelay: 0.1,
            },
          },
          0
        )
        // text lines reveal top → bottom
        .to(split.lines, { yPercent: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }, 0.58)
        // enter_world in, then persistent pulse
        .to(cta, { autoAlpha: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.92)
        .to(cta, { scale: 1.05, duration: 0.85, ease: 'sine.inOut', repeat: -1, yoyo: true }, '>-0.05')
        // service tags lift in, one by one
        .to(tags, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' }, 1.0);

      return () => split.revert();
    },
    { scope: ref, dependencies: [phase] }
  );

  if (!world) return null;

  return (
    <div className="fp-card-wrap" data-phase={phase} ref={ref}>
      <span className="fp-card__tab">{`PROJECT_${pad2(index)}`}</span>
      <div className="fp-card">
        <h2 className="fp-card__client">{world.clientName}</h2>
        {(world.title || world.yearStart) && (
          <p className="fp-card__meta">
            {[world.title, formatYearRange(world.yearStart, world.yearEnd, world.isOngoing)].filter(Boolean).join(', ')}
          </p>
        )}
        <a className="fp-card__cta" href={`/work/${world.slug}`}>
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
        {(world.hasAlbumArt || world.hasBrandDeck) && (
          <p className="fp-card__sockets">
            {world.hasAlbumArt && <span>album_art</span>}
            {world.hasBrandDeck && <span>brand_deck</span>}
          </p>
        )}
      </div>
    </div>
  );
}
