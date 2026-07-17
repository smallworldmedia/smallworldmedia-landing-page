/**
 * ProcessPage — the /process island (v2 workstream).
 *
 * The page walks a prospective client through the five Stages while the
 * ProcessScene performs them on the fixed canvas behind this copy column.
 * Spec: docs/process-page-spec.md · plan: docs/process-page-plan.md.
 *
 * Semantic copy in source order (hero → five Stages → CTA), the fixed
 * canvas layer the scene owns, the scroll driver firing the stage machine
 * at section boundaries, and the fill-release arrival insurance. The
 * scene lands in P2/P3, entrances + debug chrome in P4.
 */
import { useEffect, useRef } from 'react';
import SiteFooter from '../SiteFooter.jsx';
import { HERO, STAGES, CTA } from './processContent.js';
import { DEBUG } from './processConfig.js';
import useProcessScene from './useProcessScene.js';
import useProcessScrollDriver from './useProcessScrollDriver.js';
import useProcessCopy from './useProcessCopy.js';
import ProcessDebugPanel from './ProcessDebugPanel.jsx';
import ProcessStepCtas from './ProcessStepCtas.jsx';
import ProcessMeter from './ProcessMeter.jsx';

export default function ProcessPage() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const captionRef = useRef(null);
  const blueRef = useRef(null);
  const gradientRef = useRef(null);
  const labelsRef = useRef(null);
  const sceneRef = useProcessScene(canvasRef, captionRef, {
    rootRef,
    blueRef,
    gradientRef,
    labelsRef,
  });
  useProcessScrollDriver(rootRef, sceneRef);
  useProcessCopy(rootRef, sceneRef);

  // Release the Envelopment fill on arrival (RouteFill insurance — no-op on
  // direct loads; the detail-page convention, FeaturedProjectDetail.jsx).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);

  const openProject = () => {
    window.dispatchEvent(new CustomEvent('swm:open-overlay'));
  };

  return (
    <div className="process-page" ref={rootRef} data-bg="blue">
      {/* Staged background under the canvas: base black (the page), the
          S5 home-hero gradient, the S1/S2 electric-blue field the scene
          contracts into the Core at S3 (clip-path circle, scene-driven) */}
      <div className="process-bg" aria-hidden="true">
        <div className="process-bg__gradient" ref={gradientRef} />
        <div className="process-bg__blue" ref={blueRef} />
      </div>

      {/* Full-viewport scene layer — the ProcessScene mounts here. The
          Thread lives INSIDE the scene now (a depth-tested Line2, B3) —
          the old screen-space SVG overlay is gone. */}
      <div className="process-page__canvas" ref={canvasRef} aria-hidden="true" />

      {/* S1 blob-tracking labels — the scene fills and drives this layer */}
      <div className="process-labels" ref={labelsRef} aria-hidden="true" />

      <div className="process-page__copy">
        <header className="process-section process-hero" data-stage="hero">
          <p className="process-hero__token">{HERO.token}</p>
          <h1 className="process-hero__title">{HERO.h1}</h1>
        </header>

        {STAGES.map((stage) => (
          <section
            key={stage.id}
            className="process-section process-stage"
            data-stage={stage.id}
          >
            <p className="process-stage__chip">
              <span className="process-stage__token">{stage.token}</span>
              <span className="process-stage__chipline">{`/ ${stage.chip}`}</span>
            </p>
            <h2 className="process-stage__headline">{stage.headline}</h2>
            <p className="process-stage__blurb">{stage.blurb}</p>
            {stage.captions && (
              <p className="process-stage__caption" ref={captionRef} aria-hidden="true" />
            )}
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

      {/* Fixed walkthrough chrome: [previous] top-left below the nav,
          [next] bottom-left, status meter bottom-center, tagline
          bottom-right (Nathan's Notion deck, confirmed 2026-07-16) */}
      <ProcessStepCtas />
      <ProcessMeter />
      <p className="process-tagline">{HERO.tagline}</p>

      {DEBUG && <ProcessDebugPanel sceneRef={sceneRef} />}

      <SiteFooter />
    </div>
  );
}
