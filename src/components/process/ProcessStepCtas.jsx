/**
 * ProcessStepCtas — [previous]/[next] section steppers: the /work CTA
 * chip family (mono label + looping feathered carets, CtaArrows.jsx)
 * re-cut small, subtle and left-aligned for the walkthrough. A click
 * dispatches swm:process-step; useProcessScrollDriver owns the motion
 * (quantizer commit on the Turn curve, or an instant centered jump
 * under reduced motion — where CtaArrows already renders static).
 */
import CtaArrows from '../work/CtaArrows.jsx';

const step = (dir) =>
  window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir } }));

export default function ProcessStepCtas() {
  return (
    <div className="process-stepnav">
      <button
        type="button"
        className="process-stepnav__cta"
        onClick={() => step(-1)}
        aria-label="Previous section"
      >
        <CtaArrows direction="up" />
        <span className="fp-cta__label">previous</span>
      </button>
      <button
        type="button"
        className="process-stepnav__cta"
        onClick={() => step(1)}
        aria-label="Next section"
      >
        <CtaArrows direction="down" />
        <span className="fp-cta__label">next</span>
      </button>
    </div>
  );
}
