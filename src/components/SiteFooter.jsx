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
import gsap from 'gsap';
// 08-27: the lockup left the panel with the left column — the persistent
// SiteTagline island owns the footer lockup + copyright now.
// Reveal-travel multiplier (spacer = K × panel height) + its ?footertune
// pub/sub. Static import is the tiny shared STATE only (the fp1Tune idiom);
// the bench panel itself is a lazy chunk owned by SiteShell.
import { getFooterTravelK, subscribeFooterTune } from '../lib/footerTune.js';

// ── Link-row stagger (08-29, Nathan) ──
// The footer nav links animate in on the same reveal beat the left corner's
// copyright/lockup use (SiteTagline's REVEAL_ON/OFF hysteresis + delay),
// following the HOUSE stagger from the main nav bar (0.45s / 0.07 stagger /
// power2.out) — rising from below at the bottom edge. Gated additionally on
// <html data-privacy-landed> (set by SiteTagline once the privacy pill's
// intro lands): the row never staggers in beside an unlanded pill. This
// completes the footer elements' animations — both corners + the link row.
const STAGGER_ON = 0.85; // footer progress that arms the link stagger
const STAGGER_OFF = 0.5; // retreat threshold (hysteresis)
const STAGGER_DELAY_S = 0.25; // the house delayed-trigger beat

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

  // ── Link-row stagger — rides the shared --footer-reveal broadcast ──
  // MODE-AGNOSTIC by design: both the scroll and driven paths broadcast the
  // same var + attribute on <html>, so one watcher (the SiteTagline watcher
  // shape — attribute-gated rAF loop + MutationObserver) covers every route.
  // Links are queried lazily at fire time (the client:only stale-DOM rule)
  // and filtered to visible — the desktop-hidden in-row privacy link never
  // occupies a stagger slot.
  useEffect(() => {
    if (noFill) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let tl = null;
    let tlTargets = [];
    let shown = false;
    let raf = 0;
    const links = () =>
      [...panel.querySelectorAll('.site-footer__link')].filter(
        (el) => el.offsetParent !== null
      );
    // Rebuild whenever the VISIBLE set changed (a 768px crossing swaps the
    // in-row privacy link in/out of the row) — a timeline frozen on the old
    // set would leave a newly-visible link stuck at the CSS hidden ground
    // forever. Dropped targets get clearProps back to that ground.
    const ensureTl = () => {
      const cur = links();
      const stale =
        !tl ||
        cur.length !== tlTargets.length ||
        cur.some((el, i) => el !== tlTargets[i]);
      if (stale) {
        if (tl) {
          tl.kill();
          gsap.set(tlTargets, { clearProps: 'y,opacity,visibility' });
        }
        tlTargets = cur;
        tl = gsap.timeline({ paused: true }).fromTo(
          cur,
          { y: 10, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.45,
            stagger: 0.07,
            ease: 'power2.out',
          },
          STAGGER_DELAY_S
        );
      }
      return tl;
    };
    const readReveal = () => {
      const v = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--footer-reveal')
      );
      return Number.isFinite(v) ? v : 0;
    };
    const landed = () =>
      document.documentElement.hasAttribute('data-privacy-landed');
    const watch = () => {
      raf = 0;
      const p = readReveal();
      if (!shown && p >= STAGGER_ON && landed()) {
        shown = true;
        if (reduced) gsap.set(links(), { autoAlpha: 1, y: 0 });
        else ensureTl().play();
      } else if (shown && p < STAGGER_OFF) {
        shown = false;
        if (reduced) gsap.set(links(), { autoAlpha: 0 });
        else tl?.reverse();
      }
      if (document.documentElement.hasAttribute('data-footer-revealed')) {
        raf = requestAnimationFrame(watch);
      }
    };
    const mo = new MutationObserver(() => {
      const on = document.documentElement.hasAttribute('data-footer-revealed');
      if (on && !raf) raf = requestAnimationFrame(watch);
      if (!on) {
        // Broadcast cleared mid-reveal (route swap): retreat cleanly.
        if (shown) {
          shown = false;
          if (reduced || !tl) gsap.set(links(), { autoAlpha: 0 });
          else tl.reverse();
        }
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-footer-revealed'],
    });
    if (document.documentElement.hasAttribute('data-footer-revealed')) {
      raf = requestAnimationFrame(watch);
    }

    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      tl?.kill();
    };
  }, [noFill]);

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
          {/* LEFT retired (08-27, Nathan): the persistent SiteTagline pill —
              fixed at this panel's exact inner inset — IS the left column
              now; its copyright + white lockup fade in on this panel's own
              --footer-reveal broadcast, settling into place here. The inner
              keeps a min-height (global.css) so the band still backdrops
              that stack. */}

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
            {/* ≤768px ONLY (global.css gates): desktop privacy moved to the
                persistent lower-right .site-privacy pill (SiteTagline island,
                08-29) — this in-row link is the mobile fallback until the
                deferred mobile pass. */}
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
