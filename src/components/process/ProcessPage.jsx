/**
 * ProcessPage — the /process island (v2 workstream).
 *
 * The page walks a prospective client through the five Stages while the
 * ProcessScene performs them on the fixed canvas behind this copy column.
 * Spec: docs/process-page-spec.md · plan: docs/process-page-plan.md.
 *
 * P0 scaffold: semantic copy in source order (hero → five Stages → CTA),
 * the fixed canvas layer the scene will own, and the fill-release arrival
 * insurance. Scroll driver lands in P1, the scene in P2/P3, entrances +
 * debug chrome in P4.
 */
import { useEffect, useRef } from 'react';
import SiteFooter from '../SiteFooter.jsx';
import { HERO, STAGES, CTA } from './processContent.js';

export default function ProcessPage() {
  const canvasRef = useRef(null);

  // Release the Envelopment fill on arrival (RouteFill insurance — no-op on
  // direct loads; the detail-page convention, FeaturedProjectDetail.jsx).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);

  const openProject = () => {
    window.dispatchEvent(new CustomEvent('swm:open-overlay'));
  };

  return (
    <div className="process-page">
      {/* Full-viewport scene layer — the ProcessScene mounts here (P2) */}
      <div className="process-page__canvas" ref={canvasRef} aria-hidden="true" />

      <div className="process-page__copy">
        <header className="process-section process-hero" data-stage="hero">
          <p className="process-hero__token">{HERO.token}</p>
          <h1 className="process-hero__title">{HERO.h1}</h1>
          <p className="process-hero__sub">{HERO.sub}</p>
          <p className="process-hero__cue">{HERO.cue}</p>
        </header>

        {STAGES.map((stage) => (
          <section
            key={stage.id}
            className="process-section process-stage"
            data-stage={stage.id}
          >
            <p className="process-stage__chip">
              <span className="process-stage__token">{stage.token}</span>
              {' / '}
              {stage.chip}
            </p>
            <h2 className="process-stage__headline">{stage.headline}</h2>
            <p className="process-stage__blurb">{stage.blurb}</p>
          </section>
        ))}

        <section className="process-section process-cta" data-stage="cta">
          <h2 className="process-cta__display">{CTA.display}</h2>
          <p className="process-cta__line">{CTA.line}</p>
          <div className="process-cta__actions">
            <button
              type="button"
              className="process-cta__primary"
              onClick={openProject}
            >
              {CTA.primary}
            </button>
            <a className="process-cta__secondary" href="/work">
              {CTA.secondary}
            </a>
          </div>
        </section>
      </div>

      <SiteFooter />
    </div>
  );
}
