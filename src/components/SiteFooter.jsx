/**
 * SiteFooter — site footer (Figma "Footer").
 *
 * Two variants, gated by `noFill`:
 *
 *  • SIMPLE / overlay (`noFill`, hero) — the transparent bookend the home
 *    hero renders under its nav: studio tagline + copyright line. Byte-for-byte
 *    the old footer; the hero owns its own GSAP reveal timeline (position:
 *    absolute; bottom:0 via .hero__footer) so this variant NEVER installs the
 *    sticky-reveal below. Unchanged, backward-compatible.
 *
 *  • LINKS / sticky-reveal (default, non-hero — detail + process) — the
 *    expanded "links footer" (Figma hidden layer). LEFT: SWM globe lockup +
 *    copyright / year / All Rights Reserved. RIGHT: the four nav links + the
 *    privacy link, restyled for a footer with the design-system tokens. It is
 *    a `position: fixed` panel pinned to the viewport bottom, hidden below the
 *    fold (translateY 100%) and driven UP into view scroll-linked over the
 *    last `footerH` px of the page — an in-flow spacer reserves exactly that
 *    scroll room. Fully self-contained (owns only its own DOM + the document
 *    scroll it reads).
 *
 * INTEGRATION FLAG (F1): the page + nav slide up by --nav-height as the footer
 * reveals so the redundant nav bar leaves the viewport. The nav lives in the
 * shared .site-shell (this lane may not edit it), so this component only
 * broadcasts the reveal: `--footer-reveal` (continuous 0..1) plus
 * `data-footer-revealed` (any progress > 0) on <html>. The consuming rule in
 * global.css translates the shell PROPORTIONALLY from the var, so nav slide
 * and footer rise are one scroll-linked motion (the old halfway attribute
 * flip + discrete 600ms transition was the mid-reveal "scoot").
 *
 *  • DRIVEN (`driven` + `progress`, /work) — a third mode for routes with NO
 *    document scroll: the links panel with the reveal transform fed an
 *    explicit 0..1 prop instead of scroll math. No spacer, no listeners; the
 *    host (FeaturedProjects' wheel/touch accumulator) owns the number. Same
 *    inert gating and the same <html> reveal broadcast as the scroll mode.
 */
import { useEffect, useRef } from 'react';
// Full SWM lockup (wordmark + globe glyph). Inlined ?raw so CSS can recolour it
// mono-white for the near-black footer (source art is brand blue).
import LOCKUP_SVG from '../assets/swm-lockup-inline.svg?raw';
// Reveal-travel multiplier (spacer = K × panel height) + its ?footertune
// pub/sub. Static import is the tiny shared STATE only (the fp1Tune idiom);
// the bench panel itself is a lazy chunk owned by SiteShell.
import { getFooterTravelK, subscribeFooterTune } from '../lib/footerTune.js';

/* Shared broadcast: reveal progress → <html>, consumed by the global.css
   shell-slide rule. Attribute gates the rule on (any progress), the var
   drives the proportional translate. */
const broadcastReveal = (progress) => {
  const root = document.documentElement;
  root.style.setProperty('--footer-reveal', progress.toFixed(4));
  root.toggleAttribute('data-footer-revealed', progress > 0.001);
};
const clearReveal = () => {
  const root = document.documentElement;
  root.style.removeProperty('--footer-reveal');
  root.removeAttribute('data-footer-revealed');
};

export default function SiteFooter({
  noFill = false,
  tagline = 'Visual Worlds for the Music Industry',
  /** Driven mode (/work): reveal fed an explicit 0..1 — no document scroll. */
  driven = false,
  progress = 0,
}) {
  const reveal = !noFill && !driven;
  const panelRef = useRef(null);
  const spacerRef = useRef(null);

  // ── Scroll-linked sticky reveal (links variant only) ──
  // The panel is fixed to the viewport bottom and translated fully below the
  // fold; the spacer (last in flow) adds K × panelH of scroll height (K =
  // footerTune travel multiplier), so the panel rises from hidden → fully
  // shown across the document's final stretch. K > 1 stretches the reveal to
  // one natural scroll motion — at exactly one panel height the travel was so
  // short a single Lenis flick could park it partway. All measurement reads
  // the spacer's live rect — no magic numbers, resize-safe.
  useEffect(() => {
    if (!reveal) return undefined;
    const panel = panelRef.current;
    const spacer = spacerRef.current;
    if (!panel || !spacer) return undefined;

    let travel = 0;
    let raf = 0;
    let inertFlag = true;
    let disposed = false;

    const sizeSpacer = () => {
      travel = panel.offsetHeight * getFooterTravelK();
      spacer.style.height = `${travel}px`;
    };

    const apply = () => {
      raf = 0;
      if (disposed || !travel) return;
      const vh = window.innerHeight;
      const top = spacer.getBoundingClientRect().top;
      // 0 when the spacer sits at/below the fold; 1 once it has fully risen
      // into the bottom band (== document end, by construction — the K in the
      // spacer height is divided back out here).
      const progress = Math.min(Math.max((vh - top) / travel, 0), 1);
      panel.style.transform = `translateY(${(1 - progress) * 100}%)`;
      // a11y: while it sits below the fold the footer's links must not be
      // tab-reachable (focusing a transform-hidden control strands the caret
      // off-screen). Keep the panel inert until it begins rising into view.
      const wantInert = progress <= 0.001;
      if (wantInert !== inertFlag) {
        inertFlag = wantInert;
        panel.inert = wantInert;
      }
      // Broadcast for the shared-chrome nav slide — CONTINUOUS (--footer-reveal
      // var + any-progress attribute gate), so the shell translates in lockstep
      // with the panel instead of scooting on a halfway threshold.
      broadcastReveal(progress);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(apply);
    };
    const onResize = () => {
      sizeSpacer();
      onScroll();
    };

    sizeSpacer();
    apply();

    // Re-measure when the panel's own box changes (font swap, wrap at
    // breakpoints, a ?footertune lockup-height dial)
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { sizeSpacer(); onScroll(); })
      : null;
    ro?.observe(panel);
    // …and when the bench dials travel K (no box change → no RO fire).
    const unsubTune = subscribeFooterTune(() => { sizeSpacer(); onScroll(); });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Lenis scrolls the window on these routes, so 'scroll' fires; re-seat once
    // the webfont settles (metrics shift the panel height).
    document.fonts?.ready?.then(() => { if (!disposed) { sizeSpacer(); apply(); } });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      unsubTune();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      clearReveal();
    };
  }, [reveal]);

  // ── Driven reveal (/work) — explicit 0..1 from the host, no document scroll.
  // The transform itself is declarative (inline style below); this effect owns
  // the <html> broadcast so the shared-chrome nav slide tracks the same number.
  const drivenP = driven ? Math.min(Math.max(progress, 0), 1) : 0;
  useEffect(() => {
    if (!driven) return undefined;
    broadcastReveal(drivenP);
    return undefined;
  }, [driven, drivenP]);
  useEffect(() => {
    if (!driven) return undefined;
    return clearReveal; // route swap away from /work drops the broadcast
  }, [driven]);

  const year = new Date().getFullYear();

  // ── Simple / overlay variant (hero) — unchanged ──
  // Keyed on noFill, NOT !reveal: driven mode also has reveal=false but must
  // fall through to the links panel below.
  if (noFill) {
    return (
      <footer className="site-footer site-footer--nofill">
        <div className="site-footer__bar">
          {tagline && <p className="site-footer__tagline">{tagline}</p>}
          <p className="site-footer__copy">
            ©{year} Small World Media LLC. All Rights Reserved.
            {' · '}
            <a className="site-footer__privacy" href="/privacy">privacy</a>
          </p>
        </div>
      </footer>
    );
  }

  // ── Links variant — sticky-reveal (detail + process) or driven (/work) ──
  return (
    <>
      {/* In-flow spacer — reserves the scroll room the fixed panel rises
          through. Suppressed in driven mode: no document scroll exists there,
          so there is no scroll room to reserve. */}
      {!driven && (
        <div className="site-footer__spacer" aria-hidden="true" ref={spacerRef} />
      )}

      <footer
        className="site-footer site-footer--links"
        ref={panelRef}
        // Scroll mode mounts inert and flips imperatively per frame; driven
        // mode re-renders per progress step, so both stay declarative here.
        inert={driven ? drivenP <= 0.001 : true}
        // Driven mode: the reveal transform IS the prop — overrides the CSS
        // resting translateY(100%), stays off-screen at 0.
        style={
          driven
            ? { transform: `translateY(${((1 - drivenP) * 100).toFixed(3)}%)` }
            : undefined
        }
      >
        <div className="site-footer__inner">
          <div className="site-footer__left">
            <a
              href="/"
              className="site-footer__lockup"
              aria-label="Small World Media home"
            >
              <span
                className="site-footer__lockup-art"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: LOCKUP_SVG }}
              />
            </a>
            <p className="site-footer__copy">
              ©{year} Small World Media LLC. All Rights Reserved.
            </p>
          </div>

          <nav className="site-footer__nav" aria-label="Footer">
            <a href="/" className="site-footer__link">
              <span className="site-footer__glyph">↳</span>
              <span className="site-footer__label">start_project</span>
            </a>
            <a href="/work" className="site-footer__link">
              <span className="site-footer__glyph">⁕</span>
              <span className="site-footer__label">featured_projects</span>
            </a>
            <a href="/process" className="site-footer__link">
              <span className="site-footer__glyph">⊙</span>
              <span className="site-footer__label">process</span>
            </a>
            <a
              href="https://instagram.com/smallworldmedia"
              className="site-footer__link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="site-footer__glyph">♡</span>
              <span className="site-footer__label">follow_us</span>
            </a>
            <a
              href="/privacy"
              className="site-footer__link site-footer__link--privacy"
            >
              <span className="site-footer__label">privacy</span>
            </a>
          </nav>
        </div>
      </footer>
    </>
  );
}
