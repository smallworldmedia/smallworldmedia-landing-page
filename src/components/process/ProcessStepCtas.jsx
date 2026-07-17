/**
 * ProcessStepCtas — [previous]/[next] section steppers: the /work CTA
 * chip family (mono label + looping feathered carets, CtaArrows.jsx)
 * re-cut small and subtle for the walkthrough. A click dispatches
 * swm:process-step; useProcessScrollDriver owns the motion (quantizer
 * commit on the Turn curve, or an instant centered jump under reduced
 * motion — where CtaArrows already renders static).
 *
 * Placement (Nathan's Notion deck, confirmed 2026-07-16): [previous]
 * fixed top-left below the nav bar — back is up; [next] stays
 * bottom-left — forward is down. Two fixed containers so each corner
 * positions independently (the ?debug shove only concerns [next]).
 */
import CtaArrows from '../work/CtaArrows.jsx';

const step = (dir) =>
  window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir } }));

export default function ProcessStepCtas() {
  return (
    <>
      <div className="process-stepnav process-stepnav--prev">
        <button
          type="button"
          className="process-stepnav__cta"
          onClick={() => step(-1)}
          aria-label="Previous section"
        >
          <CtaArrows direction="up" />
          <span className="fp-cta__label">previous</span>
        </button>
      </div>
      <div className="process-stepnav process-stepnav--next">
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
    </>
  );
}
