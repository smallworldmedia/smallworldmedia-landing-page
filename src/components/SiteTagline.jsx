/**
 * SiteTagline — the persistent footer-corner chrome (Figma Frame 19,
 * 08-27 Nathan; privacy pill added 08-29).
 *
 * LOWER-LEFT: a fixed black pill — "VISUAL WORLDS for the music
 * industry." — pinned on every route. It REPLACES the footer's left
 * column (SiteFooter's lockup + copyright) and the old hero footer bar: its
 * resting position IS the links footer's inner left/bottom padding, so when
 * the sticky footer rises at page end the pill is already seated — the
 * footer "settles into place" around it.
 *
 * LOWER-RIGHT (08-29, Nathan): the MIRRORED privacy pill — a fixed black
 * capsule linking /privacy, seated at the footer's inner right/bottom
 * padding the same way (this is also the homepage's privacy link — homeless
 * since the hero footer bar retired). It shares the intro below, wiping in
 * right→left (right edge anchored — the tagline's mirror). Once it lands,
 * `data-privacy-landed` is set on <html>: SiteFooter's nav-link stagger
 * waits for it, so the footer's link row never animates in beside an
 * unlanded pill.
 *
 * Intro (one-time per session, sessionStorage-gated):
 *   · Homepage — armed by `swm:hero-lockup-done` (Hero broadcasts it as the
 *     lockup word-beats finish) with a safety timeout. Other routes: a
 *     short beat after mount.
 *   · The tagline pill wipes in left→right (clip-path, left edge anchored),
 *     the words fade up into position one by one starting just after the
 *     wipe; the privacy pill wipes right→left on the same beat.
 *
 * Footer-reveal choreography (SiteFooter broadcasts `--footer-reveal` 0..1 +
 * `data-footer-revealed` on <html>): once the reveal crosses REVEAL_ON, a
 * short delay then "©<year>. All rights reserved." fades up inline after the
 * pill while the WHITE SWM lockup (nav scale) slides in from the left just
 * above it. Scrolling back out reverses; both live only inside the revealed
 * footer band. (SiteFooter's own link-row stagger rides the same broadcast —
 * the two corners + the link row read as one settling moment.)
 *
 * Mounted in BaseLayout as its OWN persistent island (NOT inside .site-shell
 * — the footer-reveal rule translates the shell up by the nav height, which
 * would carry this off its footer alignment).
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import LOCKUP_SVG from '../assets/swm-lockup-inline.svg?raw';

const REVEAL_KEY = 'swm:tagline-revealed';
// Figma segments: the first two words carry Medium, the rest Regular.
const WORDS = ['VISUAL', 'WORLDS', 'for', 'the', 'music', 'industry.'];
const EM_WORDS = 2;
const HOME_SAFETY_MS = 12000; // hero-chrome no-show fallback (odd intro paths)
const REVEAL_ON = 0.85; // footer progress that arms the copyright/lockup
const REVEAL_OFF = 0.5; // retreat threshold (hysteresis)
const REVEAL_DELAY_S = 0.25; // Nathan: a *delayed* trigger after the reveal

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SiteTagline() {
  const rootRef = useRef(null);
  const privacyRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const pill = root.querySelector('.site-tagline__pill');
    const words = root.querySelectorAll('.site-tagline__word');
    const copy = root.querySelector('.site-tagline__copy');
    const lockup = root.querySelector('.site-tagline__lockup');
    const privacy = privacyRef.current;
    const privacyWord = privacy?.querySelector('.site-privacy__word');
    const reduced = prefersReduced();

    // The privacy pill is "landed" once the intro finishes — SiteFooter's
    // nav-link stagger gates on this (the durable-attribute latch idiom).
    // LATCH SURVIVAL: the ClientRouter swap replaces <html>'s attribute set
    // with the incoming page's server-rendered attributes on every soft nav,
    // wiping the latch (--footer-reveal survives only because SiteFooter
    // re-writes it per frame) — so this persisted island re-asserts it on
    // every astro:after-swap from the closure flag.
    let landed = false;
    const markLanded = () => {
      landed = true;
      document.documentElement.setAttribute('data-privacy-landed', '');
    };
    const onSwapLatch = () => {
      if (landed) document.documentElement.setAttribute('data-privacy-landed', '');
    };
    document.addEventListener('astro:after-swap', onSwapLatch);

    // ── Intro ──
    let introPlayed = false;
    let introTl = null;
    let safetyId = 0;
    const showInstant = () => {
      introPlayed = true;
      gsap.set(pill, { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1 });
      gsap.set(words, { autoAlpha: 1, yPercent: 0 });
      if (privacy) {
        gsap.set(privacy, { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1 });
        gsap.set(privacyWord, { autoAlpha: 1 });
      }
      markLanded();
    };
    const playIntro = () => {
      if (introPlayed) return;
      introPlayed = true;
      try {
        sessionStorage.setItem(REVEAL_KEY, '1');
      } catch {
        /* private mode — the intro just replays next route */
      }
      if (reduced) {
        showInstant();
        return;
      }
      // Pill wipes in left→right (left anchored); words fade into place
      // starting just behind the wipe. 08-27 (4), Nathan: NO y transform on
      // the per-word arrival — the sequential rise read as stutter; the
      // words fade in seated. The privacy pill mirrors on the same beat:
      // right→left (right anchored), its one word fading in behind the wipe.
      introTl = gsap
        .timeline({ onComplete: markLanded })
        .set(pill, { autoAlpha: 1 })
        .fromTo(
          pill,
          { clipPath: 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power3.out' },
          0
        )
        .fromTo(
          words,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: 0.45,
            stagger: 0.07,
            ease: 'power2.out',
          },
          0.12
        );
      if (privacy) {
        introTl
          .set(privacy, { autoAlpha: 1 }, 0)
          .fromTo(
            privacy,
            { clipPath: 'inset(0% 0% 0% 100%)' },
            { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.7, ease: 'power3.out' },
            0
          )
          .fromTo(
            privacyWord,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: 0.45, ease: 'power2.out' },
            0.12
          );
      }
    };

    let revealed = false;
    try {
      revealed = sessionStorage.getItem(REVEAL_KEY) === '1';
    } catch {
      /* ignore */
    }

    const onChrome = () => {
      window.clearTimeout(safetyId);
      playIntro();
    };
    if (revealed) {
      showInstant();
    } else if (document.body.classList.contains('route-home')) {
      // Hero broadcasts this the moment the SWM lockup's word-beats finish
      // (runLockupBeats); the timeout covers any intro path that never fires.
      window.addEventListener('swm:hero-lockup-done', onChrome, { once: true });
      safetyId = window.setTimeout(playIntro, HOME_SAFETY_MS);
    } else {
      safetyId = window.setTimeout(playIntro, 600);
    }

    // ── Footer-reveal choreography ──
    // SiteFooter writes --footer-reveal (0..1) + [data-footer-revealed] on
    // <html>; the attribute gates a lightweight rAF watcher so nothing runs
    // outside the reveal band.
    let footTl = null;
    let footShown = false;
    let raf = 0;
    const buildFootTl = () => {
      footTl = gsap
        .timeline({ paused: true, delay: 0 })
        // copyright fades up to follow inline after the tagline…
        .fromTo(
          copy,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' },
          REVEAL_DELAY_S
        )
        // …while the white lockup subtly slides in from the left above it.
        .fromTo(
          lockup,
          { autoAlpha: 0, x: -18 },
          { autoAlpha: 1, x: 0, duration: 0.6, ease: 'power3.out' },
          REVEAL_DELAY_S
        );
      return footTl;
    };
    const readReveal = () => {
      const v = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--footer-reveal')
      );
      return Number.isFinite(v) ? v : 0;
    };
    const watch = () => {
      raf = 0;
      const p = readReveal();
      if (!footShown && p >= REVEAL_ON && introPlayed) {
        footShown = true;
        if (reduced) {
          gsap.set([copy, lockup], { autoAlpha: 1, x: 0, y: 0 });
        } else {
          (footTl || buildFootTl()).play();
        }
      } else if (footShown && p < REVEAL_OFF) {
        footShown = false;
        if (reduced) {
          gsap.set([copy, lockup], { autoAlpha: 0 });
        } else {
          footTl?.reverse();
        }
      }
      if (document.documentElement.hasAttribute('data-footer-revealed')) {
        raf = requestAnimationFrame(watch);
      }
    };
    const mo = new MutationObserver(() => {
      const on = document.documentElement.hasAttribute('data-footer-revealed');
      if (on && !raf) raf = requestAnimationFrame(watch);
      if (!on) {
        // Route swap / broadcast cleared mid-reveal: retreat cleanly.
        if (footShown) {
          footShown = false;
          if (reduced || !footTl) gsap.set([copy, lockup], { autoAlpha: 0 });
          else footTl.reverse();
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
      window.removeEventListener('swm:hero-lockup-done', onChrome);
      document.removeEventListener('astro:after-swap', onSwapLatch);
      window.clearTimeout(safetyId);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
      introTl?.kill();
      footTl?.kill();
    };
  }, []);

  const year = new Date().getFullYear();

  return (
    <>
      <div className="site-tagline" ref={rootRef}>
        {/* White lockup, nav scale — appears only inside the revealed footer. */}
        <a
          href="/"
          className="site-tagline__lockup"
          aria-label="Small World Media home"
        >
          <span
            className="site-tagline__lockup-art"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: LOCKUP_SVG }}
          />
        </a>
        <div className="site-tagline__row">
          <p className="site-tagline__pill" aria-label="Visual worlds for the music industry">
            {WORDS.map((w, i) => (
              <span
                key={w}
                className={`site-tagline__word${i < EM_WORDS ? ' site-tagline__word--em' : ''}`}
                aria-hidden="true"
              >
                {w}
              </span>
            ))}
          </p>
          <p className="site-tagline__copy">©{year}. All rights reserved.</p>
        </div>
      </div>

      {/* Lower-right mirror (08-29): the persistent privacy pill — fixed as
          a SIBLING of the tagline root (both position to the viewport; the
          island wrapper has no transform). Desktop-only: ≤768px the footer
          nav's in-row privacy link carries the duty (global.css gates). */}
      <a href="/privacy" className="site-privacy" ref={privacyRef}>
        <span className="site-privacy__word">privacy</span>
      </a>
    </>
  );
}
