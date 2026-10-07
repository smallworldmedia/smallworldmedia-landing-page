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
 * Two states (10-06, Nathan — "make it very clear what Small World Media is
 * immediately on page load"): at REST ON HOME (body.route-home, no drawer /
 * overlay / privacy [data-chrome-open], no mobile menu [data-menu-open], no
 * footer [data-footer-revealed]) the pill carries the LONG blurb — "Small
 * World Media is a multidisciplinary design studio …". Any other state, or any
 * other route, ABBREVIATES it to the short tagline: the capsule closes in
 * from its top-right (bottom-left anchored, so the text never travels), the
 * long words drop out, the short words fade up seated. Leaving that state
 * on home expands it back. Re-checked on every latch change + after-swap.
 *
 * Mounted in BaseLayout as its OWN persistent island (NOT inside .site-shell
 * — the footer-reveal rule translates the shell up by the nav height, which
 * would carry this off its footer alignment).
 */
import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import LOCKUP_SVG from '../assets/swm-lockup-inline.svg?raw';
import { FOOTER_REVEAL_EVENT } from './SiteFooter.jsx';
/* The privacy pill swaps to `close ×` while its overlay is up (09-08, the
   info pill convention) — the glyph lives with the overlay now (10-07), which
   needs the same mark for its own ≤768px close. */
import PrivacyOverlay, { PRIVACY_OPEN_EVENT, CloseIcon } from './PrivacyOverlay.jsx';
// The FP→detail letter-exit's pacing knob — one cut clock site-wide.
import { TEXT_TUNABLES } from './work/textExit.js';

gsap.registerPlugin(SplitText);

const REVEAL_KEY = 'swm:tagline-revealed';
// Figma segments: the first two words carry Medium, the rest Regular.
// Exported (08-30): the mobile menu renders its own copy (SiteNav) — one
// source for the words. 08-30 (3), Nathan: structured as LINES — mobile
// drops the capsule and stacks "VISUAL WORLDS / for the music / industry."
// (line spans are display:contents on desktop, so the pill's single-row
// flex read is unchanged there). Line 0 carries the Medium emphasis.
export const TAGLINE_LINES = [
  ['VISUAL', 'WORLDS'],
  ['for', 'the', 'music'],
  ['industry.'],
];
export const EM_LINE = 0;
// 10-06 (Nathan): the long blurb home shows at rest. Desktop sets the two
// lines as written (nowrap); phones let them run as one wrapping paragraph.
// "Small World Media" carries the Medium (VISUAL WORLDS' role).
const TAGLINE_LONG_LINES = [
  ['Small', 'World', 'Media', 'is', 'a', 'multidisciplinary', 'design', 'studio', 'that', 'specializes', 'in'],
  ['building', 'high-impact', 'brand', 'worlds', 'and', 'visuals', 'for', 'the', 'music', 'industry.'],
];
const LONG_EM_WORDS = 3;
/* 10-07 (Nathan): ≤768px the blurb moves OUT of this pill and into the home
   footer variant (SiteFooter's `blurb` prop, passed by Hero). The footer sets
   it as running prose, so it wants the sentence split at the Medium emphasis
   — not the per-word spans the pill's morph needs. One source for the words. */
export const TAGLINE_LONG_SPLIT = Object.freeze([
  TAGLINE_LONG_LINES[0].slice(0, LONG_EM_WORDS).join(' '),
  [TAGLINE_LONG_LINES[0].slice(LONG_EM_WORDS), ...TAGLINE_LONG_LINES.slice(1)].flat().join(' '),
]);
const LABEL_LONG = `${TAGLINE_LONG_LINES.flat().join(' ')} — open the footer`;
const LABEL_SHORT = 'Visual worlds for the music industry — open the footer';
// The letter exit's budget: the short tagline's letter count, so the long
// blurb cuts out in the same total time (each cut comes faster).
const SHORT_CHARS = TAGLINE_LINES.flat().join('').length;
// ?tagmorph — the long ⇄ short morph, ms (the capsule's resize clock).
const TAG_MORPH_MS = 600;
// Word fade-ins share one total budget (s), so the 21-word blurb arrives on
// the short tagline's beat instead of a 1.5 s crawl; the morph's is tighter.
const wordStagger = (n, budget = 0.8) => Math.min(0.07, budget / Math.max(1, n - 1));
const HOME_SAFETY_MS = 12000; // hero-chrome no-show fallback (odd intro paths)
const REVEAL_ON = 0.85; // footer progress that arms the copyright/lockup
const REVEAL_OFF = 0.5; // (unused since 09-08 — exits are masked, not faded) // retreat threshold (hysteresis)
const REVEAL_DELAY_S = 0.25; // Nathan: a *delayed* trigger after the reveal

const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function SiteTagline() {
  // 09-08 (Nathan): the privacy notice opens IN PLACE as an overlay; the
  // pill is its close control. Any surface can open it (the mobile menu's
  // twin) via PRIVACY_OPEN_EVENT.
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const closePrivacy = useCallback(() => setPrivacyOpen(false), []);
  useEffect(() => {
    const on = () => setPrivacyOpen(true);
    window.addEventListener(PRIVACY_OPEN_EVENT, on);
    return () => window.removeEventListener(PRIVACY_OPEN_EVENT, on);
  }, []);
  const rootRef = useRef(null);
  const privacyRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const pill = root.querySelector('.site-tagline__pill');
    const longEl = root.querySelector('.site-tagline__text--long');
    const shortEl = root.querySelector('.site-tagline__text--short');
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

    // ── Long ⇄ short (10-06) ── `long` is what the DOM shows. The resting
    // layer sits in flow and sizes the capsule; the other waits out of flow,
    // unseen (global.css, keyed on data-tagline).
    let long = false;
    let introPlayed = false;
    let introTl = null;
    let morphTl = null;
    const morphS = (() => {
      const v = Number(new URLSearchParams(location.search).get('tagmorph'));
      return (Number.isFinite(v) && v > 0 ? v : TAG_MORPH_MS) / 1000;
    })();
    const activeLayer = () => (long ? longEl : shortEl);
    const layerWords = (el) => el.querySelectorAll('.site-tagline__word');
    const atRest = () => {
      const html = document.documentElement;
      return (
        document.body.classList.contains('route-home') &&
        !html.hasAttribute('data-chrome-open') &&
        !html.hasAttribute('data-menu-open') &&
        !html.hasAttribute('data-footer-revealed')
      );
    };
    const settleMorph = () => {
      morphTl?.kill();
      morphTl = null;
      gsap.set(pill, { clearProps: 'width,height' });
      gsap.set([longEl, shortEl], { clearProps: 'width' });
      longEl.classList.remove('is-leaving');
      shortEl.classList.remove('is-leaving');
    };
    const setLong = (next, animate) => {
      if (next === long) return;
      const outgoing = activeLayer();
      // Measured before the settle: mid-morph, the capsule's live size IS
      // where the reverse starts (no snap).
      const from = pill.getBoundingClientRect();
      const outW = outgoing.getBoundingClientRect().width;
      settleMorph();
      long = next;
      pill.dataset.tagline = next ? 'long' : 'short';
      pill.setAttribute('aria-label', next ? LABEL_LONG : LABEL_SHORT);
      const incoming = activeLayer();
      const inWords = layerWords(incoming);
      // Instant: RM, pre-intro (the intro reveals whichever is resting), or a
      // pill that isn't drawn (phones hide it off home).
      if (!animate || reduced || !introPlayed || !from.width) {
        gsap.set(inWords, { autoAlpha: 1 });
        return;
      }
      introTl?.progress(1); // a state change mid-intro lands the intro first
      const to = pill.getBoundingClientRect();
      // Both layers keep their own measure while the capsule resizes under
      // them, so neither re-wraps mid-morph.
      gsap.set(outgoing, { width: outW });
      gsap.set(incoming, { width: incoming.getBoundingClientRect().width });
      outgoing.classList.add('is-leaving');
      morphTl = gsap
        .timeline({ onComplete: settleMorph })
        .fromTo(
          pill,
          { width: from.width, height: from.height },
          { width: to.width, height: to.height, duration: morphS, ease: 'power3.out' },
          0
        )
        .to(
          layerWords(outgoing),
          { autoAlpha: 0, duration: 0.18, ease: 'power1.in', stagger: { amount: 0.12, from: 'random' } },
          0
        )
        .fromTo(
          inWords,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.4, ease: 'power2.out', stagger: wordStagger(inWords.length, 0.45) },
          morphS * 0.35
        );
    };
    setLong(atRest(), false);

    // ── Intro ──
    let safetyId = 0;
    const showInstant = () => {
      introPlayed = true;
      gsap.set(pill, { clipPath: 'inset(0% 0% 0% 0%)', autoAlpha: 1 });
      gsap.set(layerWords(activeLayer()), { autoAlpha: 1, yPercent: 0 });
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
      const words = layerWords(activeLayer());
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
            stagger: wordStagger(words.length),
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
    let panelEl = null;
    const panelEdge = () => {
      if (!panelEl || !panelEl.isConnected) panelEl = document.querySelector('.site-footer--links');
      return panelEl ? panelEl.getBoundingClientRect().top : Infinity;
    };
    const maskToPanel = () => {
      const edge = panelEdge();
      if (!Number.isFinite(edge)) return;
      for (const el of [copy, lockup]) {
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        const cut = Math.max(0, edge - top);
        el.style.clipPath = cut > 0 ? `inset(${cut.toFixed(1)}px 0 0 0)` : '';
      }
    };
    // 09-08 (Nathan): on phones the rising footer is an INVERSE mask for the
    // tagline pill — everything of it below the panel's top edge is hidden,
    // so the footer wipes the blurb out as its lockup + copyright land.
    const pillEl = root.querySelector('.site-tagline__pill');
    const maskPill = () => {
      if (!pillEl || !window.matchMedia('(max-width: 768px)').matches) return;
      const edge = panelEdge();
      const r = pillEl.getBoundingClientRect();
      const cut = Number.isFinite(edge) ? Math.max(0, r.bottom - edge) : 0;
      pillEl.style.clipPath = cut > 0 ? `inset(0 0 ${cut.toFixed(1)}px 0)` : '';
    };
    const unmask = () => {
      for (const el of [copy, lockup, pillEl]) if (el) el.style.clipPath = '';
    };
    // 10-07 (Nathan, mobile chrome pass): on phones the HOME footer rests
    // OPEN, so [data-footer-revealed] is set for the whole session there —
    // and every element this loop masks (the copyright, the lockup, the pill)
    // is display:none at ≤768px now. [data-footer-rest] (Hero, while that
    // floor is live) is the one fact that tells them apart: without it this
    // rAF would run at 60fps beside the WebGL globe and paint nothing.
    const maskLive = () => {
      const html = document.documentElement;
      return (
        html.hasAttribute('data-footer-revealed') && !html.hasAttribute('data-footer-rest')
      );
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
      }
      // 09-08 (Nathan): no retreat fade — the stack is MASKED by the panel's
      // top edge. This island is fixed to the viewport (it never rides the
      // panel's transform), so the mask is explicit: every frame, clip each
      // element above the panel's live top edge. Cleared on park (below).
      if (footShown) maskToPanel();
      maskPill();
      if (maskLive()) {
        raf = requestAnimationFrame(watch);
      }
    };
    const mo = new MutationObserver(() => {
      const on = maskLive();
      if (on && !raf) raf = requestAnimationFrame(watch);
      if (!on) {
        // Panel parked / route swap: snap to the ground, unseen (09-08).
        if (footShown) {
          footShown = false;
          footTl?.pause(0);
          gsap.set([copy, lockup], { autoAlpha: 0 });
        }
        unmask();
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }
    });
    mo.observe(document.documentElement, {
      attributes: true,
      // Only the reveal latch is observed. [data-footer-rest] lands once per
      // mount (Hero's effect, after its SiteFooter child has already
      // broadcast) and never flips again, so watch()'s own maskLive() check
      // retires the loop on its next frame — one extra frame, no second
      // filter entry. (A two-string attributeFilter also reads as a
      // [param, option] pair to scripts/tunables-keys.mjs.)
      attributeFilter: ['data-footer-revealed'],
    });
    if (maskLive()) {
      raf = requestAnimationFrame(watch);
    }

    // ── Letter exit (08-31, Nathan): the home→/work commit carries the
    // FP→detail text choreography — Hero broadcasts swm:tagline-exit and
    // the tagline's LETTERS hard-cut in RANDOM order on the same
    // charCutMs clock (the textExit convention: SplitText at fire time,
    // plain visibility writes). This island PERSISTS through the swap, so
    // astro:after-swap restores everything — /work must arrive with the
    // tagline whole. RM never plays (Hero's RM commit is a plain nav). ──
    let exitSplit = null;
    let exitCalls = [];
    const exitCut = [];
    const restoreExit = () => {
      exitCalls.forEach((c) => c.kill());
      exitCalls = [];
      exitCut.forEach((el) => {
        el.style.visibility = '';
      });
      exitCut.length = 0;
      exitSplit?.revert();
      exitSplit = null;
    };
    const onTaglineExit = () => {
      restoreExit();
      if (!pill) return;
      settleMorph();
      try {
        exitSplit = SplitText.create(activeLayer(), { type: 'chars' });
      } catch {
        return; // unsplittable (hidden pre-intro edge) — the cover carries it
      }
      const chars = [...(exitSplit.chars ?? [])];
      for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      // 10-06: the long blurb cuts in the short tagline's total time.
      const stepMs = TEXT_TUNABLES.charCutMs * Math.min(1, SHORT_CHARS / Math.max(1, chars.length));
      chars.forEach((el, i) => {
        exitCalls.push(
          gsap.delayedCall((i * stepMs) / 1000, () => {
            el.style.visibility = 'hidden';
            exitCut.push(el);
          })
        );
      });
    };
    window.addEventListener('swm:tagline-exit', onTaglineExit);
    document.addEventListener('astro:after-swap', restoreExit);

    // Long ⇄ short follows the latches + the route (after restoreExit, so a
    // cut blurb is whole again before it morphs).
    const evaluate = () => setLong(atRest(), true);
    const stateMo = new MutationObserver(evaluate);
    stateMo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chrome-open', 'data-menu-open', 'data-footer-revealed'],
    });
    document.addEventListener('astro:after-swap', evaluate);

    return () => {
      window.removeEventListener('swm:hero-lockup-done', onChrome);
      document.removeEventListener('astro:after-swap', onSwapLatch);
      window.removeEventListener('swm:tagline-exit', onTaglineExit);
      document.removeEventListener('astro:after-swap', restoreExit);
      document.removeEventListener('astro:after-swap', evaluate);
      stateMo.disconnect();
      settleMorph();
      restoreExit();
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
          {/* 09-08 (Nathan): the pill INVOKES the footer — one event, each
              route answers in its own idiom (SiteFooter FOOTER_REVEAL_EVENT). */}
          <button
            type="button"
            className="site-tagline__pill"
            aria-label={LABEL_SHORT}
            onClick={() => window.dispatchEvent(new Event(FOOTER_REVEAL_EVENT))}
          >
            {/* 10-06: two layers, one resting (data-tagline, set by the
                effect). Long words are spaced by real spaces so phones can
                wrap them as a paragraph. */}
            <span className="site-tagline__text site-tagline__text--long" aria-hidden="true">
              {TAGLINE_LONG_LINES.map((line, li) => (
                <span className="site-tagline__line" key={line.join('-')}>
                  {line.map((w, wi) => (
                    <Fragment key={w}>
                      {wi > 0 && ' '}
                      <span
                        className={`site-tagline__word${li === 0 && wi < LONG_EM_WORDS ? ' site-tagline__word--em' : ''}`}
                      >
                        {w}
                      </span>
                    </Fragment>
                  ))}
                  {li < TAGLINE_LONG_LINES.length - 1 && ' '}
                </span>
              ))}
            </span>
            <span className="site-tagline__text site-tagline__text--short" aria-hidden="true">
              {TAGLINE_LINES.map((line, li) => (
                <span className="site-tagline__line" key={line.join('-')}>
                  {line.map((w) => (
                    <span
                      key={w}
                      className={`site-tagline__word${li === EM_LINE ? ' site-tagline__word--em' : ''}`}
                    >
                      {w}
                    </span>
                  ))}
                </span>
              ))}
            </span>
          </button>
          <p className="site-tagline__copy">©{year}. All rights reserved.</p>
        </div>
      </div>

      {/* Lower-right mirror (08-29): the persistent privacy pill — fixed as
          a SIBLING of the tagline root (both position to the viewport; the
          island wrapper has no transform). Desktop-only: ≤768px the mobile
          menu's lower-corner privacy link carries the duty (global.css
          gates; 08-30 — the full-width tagline pill owns the bottom edge
          on phones). */}
      <PrivacyOverlay open={privacyOpen} onClose={closePrivacy} />
      <a
        href="/privacy"
        className="site-privacy"
        ref={privacyRef}
        aria-expanded={privacyOpen}
        aria-label={privacyOpen ? 'Close privacy' : 'Privacy'}
        onClick={(e) => {
          e.preventDefault();
          setPrivacyOpen((v) => !v);
        }}
      >
        <span className="site-privacy__word">{privacyOpen ? 'close' : 'privacy'}</span>
        {privacyOpen && <CloseIcon />}
      </a>
    </>
  );
}
