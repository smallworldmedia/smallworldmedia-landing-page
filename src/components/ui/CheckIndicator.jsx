/**
 * CheckIndicator — the animated mark beside a choice, drawn with a
 * stroke-dashoffset tween (DrawSVG-style, without the plugin). Decorative:
 * the control around it carries the state.
 *
 *   'circle-check' — the inquiry form's (ProjectOverlay): an open circle that
 *                    brightens while a check draws in.
 *   'square-eye'   — the directory filter's tags (11-03, Nathan: a checkbox
 *                    with an eye inside when on): a square that brightens
 *                    while an almond eye draws in, its pupil fading in 0.15 s
 *                    behind — the form's split of fade and draw. Sized in em
 *                    beside its label (1em until the label's CSS sizes it),
 *                    in currentColor, the stroke on --check-stroke (viewBox
 *                    units, 1.25 like the form's). Instant under reduced
 *                    motion; a toggle mid-draw reverses from where it is.
 *
 * Usage:
 *   <CheckIndicator checked={on} className="project-overlay__check" />
 *   <CheckIndicator checked={on} variant="square-eye" className="…" />
 */
import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

/** The eye path's length in viewBox units (21.2), rounded up: its dash. */
const EYE_DASH = 22;

function CircleCheck({ checked, className }) {
  const checkRef = useRef(null);
  const circleRef = useRef(null);

  useGSAP(() => {
    const check = checkRef.current;
    const circle = circleRef.current;
    if (!check || !circle) return;

    if (checked) {
      // Circle shrinks opacity slightly, check draws in
      gsap.to(circle, {
        stroke: 'rgba(250,250,250,1)',
        duration: 0.2,
        ease: 'power3.out',
      });
      gsap.fromTo(check,
        { strokeDashoffset: 14 },
        {
          strokeDashoffset: 0,
          duration: 0.35,
          ease: 'power3.out',
        }
      );
    } else {
      gsap.to(circle, {
        stroke: 'rgba(250,250,250,0.35)',
        duration: 0.2,
        ease: 'power2.inOut',
      });
      gsap.to(check, {
        strokeDashoffset: 14,
        duration: 0.2,
        ease: 'power2.inOut',
      });
    }
  }, { dependencies: [checked] });

  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle
        ref={circleRef}
        cx="8"
        cy="8"
        r="7"
        stroke="rgba(250,250,250,0.35)"
        strokeWidth="1.25"
        fill="none"
      />
      <path
        ref={checkRef}
        d="M4.5 8.2L7 10.5L11.5 5.5"
        stroke="var(--color-cream)"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="14"
        strokeDashoffset="14"
      />
    </svg>
  );
}

function SquareEye({ checked, className }) {
  const boxRef = useRef(null);
  const eyeRef = useRef(null);
  const pupilRef = useRef(null);

  useGSAP(() => {
    const box = boxRef.current;
    const eye = eyeRef.current;
    const pupil = pupilRef.current;
    if (!box || !eye || !pupil) return;
    const k = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
    // overwrite: true — a quick off after on must also kill the pupil's
    // delayed fade-in, or it lands after the fade-out and stays lit.
    const on = { duration: 0.2 * k, ease: 'power3.out', overwrite: true };
    const off = { duration: 0.2 * k, ease: 'power2.inOut', overwrite: true };

    if (checked) {
      gsap.to(box, { ...on, strokeOpacity: 1 });
      gsap.to(eye, { ...on, strokeDashoffset: 0, duration: 0.35 * k });
      gsap.to(pupil, { ...on, opacity: 1, delay: 0.15 * k });
    } else {
      gsap.to(box, { ...off, strokeOpacity: 0.35 });
      gsap.to(eye, { ...off, strokeDashoffset: EYE_DASH });
      gsap.to(pupil, { ...off, opacity: 0 });
    }
  }, { dependencies: [checked] });

  return (
    <svg
      className={className}
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      style={{ strokeWidth: 'var(--check-stroke, 1.25)' }}
      aria-hidden="true"
    >
      <rect ref={boxRef} x="1" y="1" width="14" height="14" strokeOpacity="0.35" />
      <path
        ref={eyeRef}
        d="M3.5 8Q8 3 12.5 8Q8 13 3.5 8Z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={EYE_DASH}
        strokeDashoffset={EYE_DASH}
      />
      <circle ref={pupilRef} cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" opacity="0" />
    </svg>
  );
}

export default function CheckIndicator({ checked, variant = 'circle-check', className }) {
  return variant === 'square-eye'
    ? <SquareEye checked={checked} className={className} />
    : <CircleCheck checked={checked} className={className} />;
}
