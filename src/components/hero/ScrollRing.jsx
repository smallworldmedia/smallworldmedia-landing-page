/**
 * ScrollRing — the circular scroll_to_enter CTA orbiting the resting planet
 * (home-hero rework, chunk 3; replaces the centered PRIMARY button).
 *
 * One fixed-viewBox SVG (1000×1000, circle r=460 at center) carrying the CTA
 * text on a textPath — "scroll_to_enter ✳ …" repeated to fill the
 * circumference. The text layout is measured ONCE at mount and frozen
 * (letter-spacing computed to close the loop + textLength as the lock); the
 * SVG never re-lays-out again. Per frame the overlay bridge (heroOverlay)
 * hands us the globe's screen disc and we write ONE wrapper transform —
 * translate to the disc center, scale to ringR×disc (plus the drag lean),
 * rotate by the accumulated ambient spin. No layout reads, no allocations
 * beyond the transform string.
 *
 * States arrive imperatively from Hero via ringRef.current.setFill(f, mode)
 * (the rigRef prop convention — no re-renders on the gesture path):
 *   drag        fill mixes the text white → electric blue (CSS color-mix on
 *               --ring-fill; CSS owns the easing) and spins up to ~3×
 *   release     rubber-bands color back on the house release curve
 *   commit-pin  solid blue; the spin eases to a stop (expo.out — no
 *               overshoot) while the ring rides the growing disc out
 *
 * The ring is pointer-inert (pointer-events: none) — the a11y commit path is
 * Hero's .hero__enter-hit button. It reveals itself on the loom chrome beat
 * (swm:hero-chrome, with the hero's data-chromed latch covering a late
 * mount). Reduced motion: static white ring, no rotation, no fill
 * choreography — guarded here AND in CSS.
 *
 * Knobs (heroConfig, live under ?herotune): ?ringr ?ringspeed ?ringlean;
 * ?ringtext swaps the label.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';
import { TUNING, RING_TEXT, RING_SEPARATOR } from './heroConfig.js';

const PATH_R = 460; // circle radius in viewBox units — k = target px / PATH_R
const CIRCUMFERENCE = 2 * Math.PI * PATH_R;
const PIN_SPIN_SECONDS = 0.6; // commit: spin velocity → 0, expo.out
const MAX_FRAME_DT = 0.1; // clamp across tab-hidden gaps so θ never jumps

export default function ScrollRing({ ringRef, overlay }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const text = textRef.current;
    if (!wrap || !text || !overlay) return undefined;
    const textPath = text.firstChild; // the <textPath> carrying the copy
    let disposed = false;

    /* — Lock the ring text: measure one unit, repeat to fill the loop, then
       freeze. letter-spacing closes the residual gap exactly (applied after
       every glyph, so the seam is seamless); textLength doubles as the lock
       where the engine honors it on textPath. If the mono webfont lands
       after mount, one re-freeze on fonts.ready keeps the metrics honest —
       still never per frame. — */
    const freezeText = () => {
      const unit = `${RING_TEXT} ${RING_SEPARATOR} `;
      textPath.textContent = unit;
      const unitLen = text.getComputedTextLength();
      if (!(unitLen > 0)) {
        // not measurable (display gated?) — leave one unit; a later
        // fonts.ready pass will retry
        return;
      }
      const n = Math.max(1, Math.round(CIRCUMFERENCE / unitLen));
      textPath.textContent = unit.repeat(n);
      const chars = unit.length * n;
      text.style.letterSpacing = `${(CIRCUMFERENCE - unitLen * n) / chars}px`;
      text.setAttribute('textLength', CIRCUMFERENCE.toFixed(2));
      text.setAttribute('lengthAdjust', 'spacing');
    };
    freezeText();
    if (typeof document !== 'undefined' && document.fonts?.status !== 'loaded') {
      document.fonts?.ready.then(() => {
        if (!disposed) freezeText();
      });
    }

    /* — Gesture state (imperative — no React on this path) — */
    const st = { fill: 0 };
    const vel = { v: 1 }; // spin velocity scale; commit tweens it to rest
    let pinTween = null;
    let theta = 0;
    let lastT = 0;

    const setFill = (f, mode) => {
      // Dual RM guard (CSS pins the fill white + kills transitions too).
      if (PREFERS_REDUCED_MOTION) return;
      st.fill = f;
      // CSS computes the white→blue mix and owns the per-mode easing.
      wrap.dataset.mode = mode;
      wrap.style.setProperty('--ring-fill', `${Math.round(f * 100)}%`);
      if (mode === 'commit-pin') {
        if (!pinTween) {
          // Ease the spin to a stop — velocity, not angle, so there is no
          // target heading and therefore no overshoot (house rule).
          pinTween = gsap.to(vel, { v: 0, duration: PIN_SPIN_SECONDS, ease: 'expo.out' });
        }
      } else if (pinTween) {
        pinTween.kill();
        pinTween = null;
        vel.v = 1;
      }
    };
    ringRef.current = { setFill };

    /* — Per-frame: one transform write on the wrapper, nothing else — */
    const onFrame = (frame) => {
      const now = performance.now();
      const dt = lastT === 0 ? 0 : Math.min((now - lastT) / 1000, MAX_FRAME_DT);
      lastT = now;
      if (!PREFERS_REDUCED_MOTION) {
        // Ambient drift, spun up to ~3× at full drag fill, damped by the
        // commit tween — accumulated on the scene's own frame cadence.
        theta = (theta + TUNING.ringSpeed * (1 + 2 * st.fill) * vel.v * dt) % 360;
      }
      const k = (frame.disc.r * TUNING.ringR * (1 + TUNING.ringLean * st.fill)) / PATH_R;
      wrap.style.transform = `translate3d(${frame.disc.cx}px, ${frame.disc.cy}px, 0) scale(${k}) rotate(${theta}deg)`;
    };
    const unsubscribe = overlay.onFrame(onFrame);

    /* — Reveal on the loom chrome beat (data-chromed covers a mount that
       races the event; RM shows instantly) — */
    const reveal = () => {
      if (PREFERS_REDUCED_MOTION) gsap.set(wrap, { autoAlpha: 1 });
      else gsap.to(wrap, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' });
    };
    let onChrome = null;
    if (wrap.closest('.hero')?.dataset.chromed === '1') {
      reveal();
    } else {
      onChrome = () => reveal();
      window.addEventListener('swm:hero-chrome', onChrome, { once: true });
    }

    return () => {
      disposed = true;
      unsubscribe();
      if (onChrome) window.removeEventListener('swm:hero-chrome', onChrome);
      if (pinTween) pinTween.kill();
      gsap.killTweensOf(wrap);
      ringRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hero-ring" ref={wrapRef} aria-hidden="true">
      <svg viewBox="0 0 1000 1000" focusable="false">
        <path
          id="swm-hero-ring-path"
          d={`M 500 ${500 - PATH_R} A ${PATH_R} ${PATH_R} 0 1 1 500 ${500 + PATH_R} A ${PATH_R} ${PATH_R} 0 1 1 500 ${500 - PATH_R}`}
          fill="none"
        />
        <text ref={textRef}>
          <textPath href="#swm-hero-ring-path">{`${RING_TEXT} ${RING_SEPARATOR} `}</textPath>
        </text>
      </svg>
    </div>
  );
}
