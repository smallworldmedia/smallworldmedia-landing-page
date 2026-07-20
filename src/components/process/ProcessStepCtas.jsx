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
 *
 * Visibility (P5, Nathan): [previous] is hidden/faded until the walk
 * reaches the 2nd section (index >= 1) — there's nowhere back from the
 * hero; [next] disables at the final section. The active index arrives
 * on the shared swm:process-index signal (ProcessMeter broadcasts it).
 * Disabled/hidden controls are native-`disabled` (out of the tab order,
 * clicks no-op) with aria-hidden/aria-disabled for assistive tech.
 */
import { useEffect, useState } from 'react';
import CtaArrows from '../work/CtaArrows.jsx';

const step = (dir) =>
  window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir } }));

export default function ProcessStepCtas() {
  const [{ index, total }, setNav] = useState({ index: 0, total: 1 });

  useEffect(() => {
    const onIndex = (e) => {
      const next = e.detail || {};
      setNav({
        index: Number.isFinite(next.index) ? next.index : 0,
        total: Number.isFinite(next.total) ? next.total : 1,
      });
    };
    window.addEventListener('swm:process-index', onIndex);
    return () => window.removeEventListener('swm:process-index', onIndex);
  }, []);

  const atStart = index <= 0; // on the hero — nothing above
  // Guard on total > 1 so [next] stays enabled until the real section count
  // has arrived (the default total of 1 must not read as "at the end").
  const atEnd = total > 1 && index >= total - 1; // on the closing CTA — nothing below

  return (
    <>
      <div className="process-stepnav process-stepnav--prev">
        <button
          type="button"
          className={`process-stepnav__cta${atStart ? ' is-hidden' : ''}`}
          onClick={() => step(-1)}
          disabled={atStart}
          aria-hidden={atStart}
          tabIndex={atStart ? -1 : undefined}
          aria-label="Previous section"
        >
          <CtaArrows direction="up" />
          <span className="fp-cta__label">previous</span>
        </button>
      </div>
      <div className="process-stepnav process-stepnav--next">
        <button
          type="button"
          className={`process-stepnav__cta${atEnd ? ' is-disabled' : ''}`}
          onClick={() => step(1)}
          disabled={atEnd}
          aria-disabled={atEnd}
          aria-label="Next section"
        >
          <CtaArrows direction="down" />
          <span className="fp-cta__label">next</span>
        </button>
      </div>
    </>
  );
}
