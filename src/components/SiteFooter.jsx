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
 * INTEGRATION FLAG (F1): the page + nav are meant to slide up by --nav-height
 * as the footer reveals so the redundant nav bar leaves the viewport. The nav
 * lives in the shared .site-shell (this lane may not edit it), so this
 * component only broadcasts the reveal as `data-footer-revealed` on <html>
 * (set once progress crosses ~halfway). Wiring the actual slide is a one-rule
 * add owned by the shell lane — see the commented rule in global.css beside
 * the .site-footer--links block.
 */
import { useEffect, useRef } from 'react';
// Full SWM lockup (wordmark + globe glyph). Inlined ?raw so CSS can recolour it
// mono-white for the near-black footer (source art is brand blue).
import LOCKUP_SVG from '../assets/swm-lockup-inline.svg?raw';

export default function SiteFooter({
  noFill = false,
  tagline = 'Visual Worlds for the Music Industry',
}) {
  const reveal = !noFill;
  const panelRef = useRef(null);
  const spacerRef = useRef(null);

  // ── Scroll-linked sticky reveal (links variant only) ──
  // The panel is fixed to the viewport bottom and translated fully below the
  // fold; the spacer (last in flow) adds exactly panelH of scroll height, so
  // the panel rises from hidden → fully shown across the final panelH px. All
  // measurement reads the spacer's live rect — no magic numbers, resize-safe.
  useEffect(() => {
    if (!reveal) return undefined;
    const panel = panelRef.current;
    const spacer = spacerRef.current;
    if (!panel || !spacer) return undefined;

    let panelH = 0;
    let raf = 0;
    let revealedFlag = false;
    let inertFlag = true;
    let disposed = false;

    const sizeSpacer = () => {
      panelH = panel.offsetHeight;
      spacer.style.height = `${panelH}px`;
    };

    const apply = () => {
      raf = 0;
      if (disposed || !panelH) return;
      const vh = window.innerHeight;
      const top = spacer.getBoundingClientRect().top;
      // 0 when the spacer sits at/below the fold; 1 once it has risen its full
      // height into the bottom band (== document end, by construction).
      const progress = Math.min(Math.max((vh - top) / panelH, 0), 1);
      panel.style.transform = `translateY(${(1 - progress) * 100}%)`;
      // a11y: while it sits below the fold the footer's links must not be
      // tab-reachable (focusing a transform-hidden control strands the caret
      // off-screen). Keep the panel inert until it begins rising into view.
      const wantInert = progress <= 0.001;
      if (wantInert !== inertFlag) {
        inertFlag = wantInert;
        panel.inert = wantInert;
      }
      // Broadcast for the (flagged) shared-chrome nav slide — inert until the
      // shell lane adds the consuming rule. Threshold hysteresis-free: a plain
      // half-open gate is fine here.
      const nowRevealed = progress > 0.5;
      if (nowRevealed !== revealedFlag) {
        revealedFlag = nowRevealed;
        document.documentElement.toggleAttribute('data-footer-revealed', nowRevealed);
      }
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

    // Re-measure when the panel's own box changes (font swap, wrap at breakpoints)
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => { sizeSpacer(); onScroll(); })
      : null;
    ro?.observe(panel);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    // Lenis scrolls the window on these routes, so 'scroll' fires; re-seat once
    // the webfont settles (metrics shift the panel height).
    document.fonts?.ready?.then(() => { if (!disposed) { sizeSpacer(); apply(); } });

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.documentElement.removeAttribute('data-footer-revealed');
    };
  }, [reveal]);

  const year = new Date().getFullYear();

  // ── Simple / overlay variant (hero) — unchanged ──
  if (!reveal) {
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

  // ── Links / sticky-reveal variant (detail + process) ──
  return (
    <>
      {/* In-flow spacer — reserves the scroll room the fixed panel rises through */}
      <div className="site-footer__spacer" aria-hidden="true" ref={spacerRef} />

      <footer className="site-footer site-footer--links" ref={panelRef} inert>
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
