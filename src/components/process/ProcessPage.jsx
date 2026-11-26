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
import { useEffect, useRef, useState } from 'react';
import SiteFooter from '../SiteFooter.jsx';
// 08-31, Nathan: the walkthrough meter is the shared minimal status bar now
// (the ░▒▓█ boot-log cells retired with ProcessMeter) — document-measured,
// re-firing the swm:process-index contract for the steppers.
import DetailProgressBar from '../work/detail/DetailProgressBar.jsx';
import { HERO, STAGES, CTA } from './processContent.js';
import { renderKeywords } from '../../lib/keywords.jsx';
import { DEBUG, TUNING, beatKeyed, fieldOf } from './processConfig.js';
import useProcessScene from './useProcessScene.js';
import useProcessScrollDriver from './useProcessScrollDriver.js';
import useProcessCopy from './useProcessCopy.js';
import ProcessStepCtas, { nextLabel } from './ProcessStepCtas.jsx';
import CtaArrows from '../work/CtaArrows.jsx';

export default function ProcessPage({ globeAssets, projectColors = [] }) {
  // ?scrim — the phone copy scrim (full-bleed since 09-08). OFF by default
  // (Nathan, 09-08); the dial brings it back for tuning. client:only route,
  // so a plain read is safe.
  const scrimOn =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('scrim');
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  // 10-10 (w9c): the field the root first paints — read ONCE (the field
  // table, ?opening): the scene owns data-bg / data-opening from its mount
  // on, so a re-render must never write them back over a live field.
  const [field0] = useState(() => ({ bg: fieldOf('open'), opening: fieldOf('open') }));
  // the SOLID field layer (blue by default since w9c — the ref keeps its
  // historical name; processConfig FIELDS)
  const blueRef = useRef(null);
  const gradientRef = useRef(null);
  const labelsRef = useRef(null);
  // 10-07 (w6): no caption ref — the scene finds each stage's caption at fire
  // time (fireCaption(stageId, …)); one shared ref re-pointed at whichever
  // stage rendered a caption last (S5's readout would have taken S2's pings).
  const sceneRef = useProcessScene(canvasRef, {
    rootRef,
    blueRef,
    gradientRef,
    labelsRef,
    chipColors: projectColors,
  });
  useProcessScrollDriver(rootRef, sceneRef);
  useProcessCopy(rootRef, sceneRef, globeAssets);

  // Release the Envelopment fill on arrival (RouteFill insurance — no-op on
  // direct loads; the detail-page convention, FeaturedProjectDetail.jsx).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('swm:fill-release'));
  }, []);

  // ?debug chrome — code-split so the bench never rides the shipped island.
  // The DEBUG gate keeps its shape: processConfig computes it off a null-guarded
  // PARAMS, and this island is client:only (no SSR pass), so there's no first-
  // render parity to protect the way SiteShell/FeaturedProjects have — DEBUG is
  // already a safe module const. All that changes is WHEN the panel's code
  // arrives. State holds a component, so the setter takes the UPDATER form —
  // setDebugPanel(Component) would run it as a reducer instead of storing it.
  const [DebugPanel, setDebugPanel] = useState(null);
  useEffect(() => {
    if (!DEBUG) return;
    // `alive` covers a late resolve after a ClientRouter swap unmounts the page.
    // StrictMode's dev double-invoke re-imports from the module cache and
    // re-sets, so the panel still lands on the second pass.
    let alive = true;
    import('./ProcessDebugPanel.jsx')
      .then((m) => {
        if (alive) setDebugPanel(() => m.default);
      })
      .catch(() => {
        /* dev bench only — a blocked/offline chunk just means no panel */
      });
    return () => {
      alive = false;
    };
  }, []);

  const openProject = () => {
    window.dispatchEvent(new CustomEvent('swm:open-overlay'));
  };

  /* 10-07 (w7, cta-finale): the CTA's actions TALK TO THE FREED SHARD —
     hover or keyboard focus on start_project / featured_projects pulses the
     shard the scene lifted off the world (its first_contact chip names it).
     One combined state (pointer over OR focus inside), sent only on change,
     as swm:process-cta-hover { on } — in a rAF, the house rule for events
     that start tweens in another hook's GSAP context. */
  const ctaHover = useRef({ pointer: false, focus: false, on: false });
  // 10-07 (w7 fix): KEYBOARD focus only — the focus a mouse click leaves on
  // a button (Chrome; the inquiry overlay hands nothing back) kept the shard
  // pulsing after the pointer had gone. A browser without :focus-visible
  // counts every focus, as before.
  const keyFocus = (el) => {
    try {
      return el.matches(':focus-visible');
    } catch {
      return true;
    }
  };
  const ctaHoverSet = (key, value) => {
    const st = ctaHover.current;
    st[key] = value;
    const on = st.pointer || st.focus;
    if (on === st.on) return;
    st.on = on;
    requestAnimationFrame(() => {
      window.dispatchEvent(new CustomEvent('swm:process-cta-hover', { detail: { on } }));
    });
  };

  // P6: back-to-top glide — the scroll driver owns the motion (house Turn
  // curve via Lenis, or an instant jump under reduced motion).
  const backToTop = () => {
    window.dispatchEvent(new CustomEvent('swm:process-home'));
  };

  /* 10-07 (w6, s5-drop / s5-chapters): S5's caption is the LIVE readout —
     the beat ● (its colour the pool's first, or a chapter's remembered S3
     fill; it blinks on the loop's beat by a colour swap), the brand-book page
     counter (plain text) and the scrambled readout. Spaces collapse across
     the empty counter.
     10-09 (w9, s2-hold): ONE caption, two seats — S2's (`captionLead`) sits
     ABOVE the blurb at the blurb's size: the Thread's count is what the card
     shows while the dots connect, the blurb rising under it once they are
     (the scene finds it by class, fireCaption). S5's stays the mono line
     below. */
  const stageCaption = (stage) =>
    stage.captions && (
      <p
        className={`process-stage__caption${stage.captionLead ? ' process-stage__caption--lead' : ''}`}
        aria-hidden="true"
      >
        {stage.chapters && (
          <>
            <span
              className="process-stage__beat"
              style={projectColors[0] ? { '--beat-color': projectColors[0] } : undefined}
              data-key={beatKeyed(projectColors[0]) ? '' : undefined}
            >
              ●
            </span>{' '}
            <span className="process-stage__counter" />{' '}
            <span className="process-stage__readout" />
          </>
        )}
      </p>
    );

  return (
    // 10-08 (w8): ?herov centre — the PHONE hero card on the frame's centre
    // (process.css; the scene's applyTuning keeps it live from the bench)
    <div
      className="process-page"
      ref={rootRef}
      data-bg={field0.bg}
      data-opening={field0.opening}
      data-scrim={scrimOn ? '' : undefined}
      data-herov={TUNING.heroV === 'centre' ? 'centre' : undefined}
    >
      {/* Staged background under the canvas (10-10, w9c — the order
          reversed): the page's own OPENING field (hero/S1/S2 — black; blue on
          ?opening=blue), the S3/S4 SOLID field the scene grows out of the
          Core at the ignition (clip-path circle, scene-driven — blue; the
          __blue handle is historical), the S5 / CTA home-hero gradient */}
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

        {STAGES.map((stage, i) => (
          <section
            key={stage.id}
            className="process-section process-stage"
            data-stage={stage.id}
          >
            {/* 09-09 (Nathan): the chip is the PHASE token alone — the
                "/ chip_name" tail is gone. */}
            <p className="process-stage__chip">
              <span className="process-stage__token">{stage.token}</span>
            </p>
            <h2 className="process-stage__headline">{stage.headline}</h2>
            {stage.captionLead && stageCaption(stage)}
            <p className="process-stage__blurb">{renderKeywords(stage.blurb)}</p>
            {!stage.captionLead && stageCaption(stage)}
            {/* 10-08 (w8, ?nexttease — Nathan's A/B, off by default; reload
                only): the PHONE's `next: <phase>` — the stepnav is hidden
                ≤768px, so this caption line says the desktop [next]'s own
                words (nextLabel, section i + 1). Its own row under the
                caption (S2's caption writer owns that line's whole text), so
                the bottom-anchored card grows UP and keeps its inset; CSS
                shows it ≤768px only; the copy hook cuts it in with the
                card (charCut) and out on the leave-back; a keep-out box
                (KEEP_COPY) so no chip seats over it. Not on the hero (its
                card holds the globe-O, the break's source) or the CTA (the
                end). */}
            {TUNING.nextTease === 'on' && (
              <p className="process-stage__next" aria-hidden="true">
                {nextLabel(i + 1)}
              </p>
            )}
          </section>
        ))}

        <section className="process-section process-cta" data-stage="cta">
          <h2 className="process-cta__display">{CTA.display}</h2>
          <p className="process-cta__line">{renderKeywords(CTA.line)}</p>
          <div
            className="process-cta__actions"
            onPointerOver={(e) => ctaHoverSet('pointer', Boolean(e.target.closest?.('button, a')))}
            onPointerLeave={() => ctaHoverSet('pointer', false)}
            onFocus={(e) => ctaHoverSet('focus', keyFocus(e.target))}
            onBlur={(e) => ctaHoverSet('focus', e.currentTarget.contains(e.relatedTarget))}
          >
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
          {/* P6 back-to-top — PHONE-ONLY since 07-30 (CSS hides it ≥769px):
              desktop's back_to_top lives in the fixed [next] stepper slot
              (ProcessStepCtas swaps it in at the final section); this
              in-flow chip remains the phone's way home (the stepnav is
              display:none on phones — swipe owns the walk). */}
          <button
            type="button"
            className="process-cta__top"
            aria-label="Back to top"
            onClick={backToTop}
          >
            <CtaArrows direction="up" />
            <span className="fp-cta__label">back_to_top</span>
          </button>
        </section>
      </div>

      {/* Fixed walkthrough chrome. 09-09 (Nathan): the steppers take the
          /work seat — CENTERED, [previous] below the nav, [next] at the
          foot — and the persistent bottom-right tagline is retired.
          10-09 (w9): the status bar rides ABOVE [next] now (process.css). */}
      <ProcessStepCtas />
      <DetailProgressBar measure="document" broadcast sectionSelector=".process-section" />

      {DEBUG && DebugPanel && <DebugPanel sceneRef={sceneRef} />}

      {/* 09-08 (Nathan): the footer + logo ticker are BAKED INTO the last
          slide's swipe — the driver's final rest is the document end and
          the spacer is exactly one panel tall (travelK 1), so the CTA copy
          lands with the panel fully risen beneath it: one gesture. */}
      <SiteFooter travelK={1} />
    </div>
  );
}
