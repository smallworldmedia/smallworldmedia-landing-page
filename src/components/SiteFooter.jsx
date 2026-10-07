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
import { Fragment, useEffect, useRef } from 'react';
import gsap from 'gsap';
// 08-27: the lockup left the panel with the left column — the persistent
// SiteTagline island owns the footer lockup + copyright now.
// Reveal-travel multiplier (spacer = K × panel height) + its ?footertune
// pub/sub. Static import is the tiny shared STATE only (the fp1Tune idiom);
// the bench panel itself is a lazy chunk owned by SiteShell.
import {
  getFooterTravelK,
  getFooterIntroS,
  subscribeFooterTune,
  footerRise,
  footerSpan,
} from '../lib/footerTune.js';
// The house resize doctrine (08-28): cheap work per event, the expensive
// re-measure after the gesture SETTLES.
import { settleDebounce } from '../lib/settleResize.js';
import { CustomEase } from 'gsap/CustomEase';
import { getLenis } from '../lib/smoothScroll.js';
import { GLIDE_SECONDS } from '../lib/motion.js';
import { TURN_EASE_PATH } from './work/world/worldConfig.js';

/** Any surface can ask for the footer: window.dispatchEvent(new Event(this)).
    Scroll routes glide to the document end (below); /work's driven host and
    the home hero handle it themselves (09-08, Nathan — the tagline pill). */
export const FOOTER_REVEAL_EVENT = 'swm:footer-reveal';
/** Fired by SiteFooter when an INVOKED footer must close (a click outside
    it) — the driven hosts (home, /work) wipe their progress back to 0. */
export const FOOTER_CLOSE_EVENT = 'swm:footer-close';

/* The pill's WIPE (09-08, Nathan): the reveal rides the house glide — one
   GLIDE_SECONDS on the World Turn curve (steep launch, smooth settle, no
   overshoot). Scroll routes hand the same duration + curve to Lenis; driven
   hosts tween their progress through wipeReveal(). */
const WIPE_EASE = 'footerWipe';
const wipeEase = () => CustomEase.get(WIPE_EASE) || CustomEase.create(WIPE_EASE, TURN_EASE_PATH);
/** Tween a driven host's 0..1 from `from` to 1; returns the tween (kill it
    the moment the user's own delta takes over). */
export function wipeReveal(from, set, to = 1) {
  const proxy = { p: Math.min(Math.max(from, 0), 1) };
  return gsap.to(proxy, {
    p: to,
    duration: GLIDE_SECONDS * Math.abs(to - proxy.p),
    ease: wipeEase(),
    onUpdate: () => set(proxy.p),
  });
}

/* INVOKED footer (09-08, Nathan): the tagline pill raises the footer AS AN
   OVERLAY wherever the page is — no scroll. A pointerdown anywhere outside
   the panel (and off the pill) closes it with the inverse wipe. Shared by
   both modes: scroll mode wipes its own panel and hands control back to the
   scroll math on close; driven mode only tracks the flag and asks its host
   to wipe down (FOOTER_CLOSE_EVENT). */
const isOutside = (e, panel) =>
  !panel.contains(e.target) && !e.target.closest?.('.site-tagline__pill');
// 09-07 (Nathan): the client-logo band rides the TOP of the links panel — it
// inherits the panel's transform (scroll + driven modes), the spacer's
// ResizeObserver already re-measures the taller panel, inert is inherited,
// and every footer route gets it with no per-route wiring.
import ClientLogoTicker from './ClientLogoTicker.jsx';
// One per-word fade budget for the whole house — the helper that caps each
// beat at 0.07 while fitting N words into a total (SiteTagline's pill intro
// is the other caller). Imported rather than re-typed: a forked motion
// number is a bug waiting to drift.
import { wordStagger } from './SiteTagline.jsx';

// ── Link-row stagger (08-29, Nathan) ──
// The footer nav links animate in on the same reveal beat the left corner's
// copyright/lockup use (SiteTagline's REVEAL_ON/OFF hysteresis + delay),
// following the HOUSE stagger from the main nav bar (0.45s / 0.07 stagger /
// power2.out) — rising from below at the bottom edge. Gated additionally on
// <html data-privacy-landed> (set by SiteTagline once the privacy pill's
// intro lands): the row never staggers in beside an unlanded pill. This
// completes the footer elements' animations — both corners + the link row.
const STAGGER_ON = 0.85; // footer progress that arms the link stagger
const STAGGER_DELAY_S = 0.25; // the house delayed-trigger beat

/* Shared broadcast: reveal progress → <html>, consumed by the global.css
   shell-slide rule. Attribute gates the rule on (any progress), the var
   drives the proportional translate. */
// 09-08 (Nathan): footer elements enter on the reveal but never FADE OUT —
// the retreat is masked by the panel's top edge leaving the viewport. So
// alongside the live progress we broadcast its PEAK since the last park:
// `--footer-peak` rises with the reveal and holds through the retreat,
// resetting only once the panel is fully parked (progress ≈ 0). Anything
// that fades on the reveal consumes the peak, not the progress.
// 10-07 (Nathan): the mobile home variant PARKS at a resting floor, never at
// 0, so "parked" is `rest`, not zero — otherwise the peak would latch at the
// session's high-water mark and the logo band's at-rest hint read (its fade
// window over this var) could never come back. rest = 0 is the old behaviour
// byte for byte.
// 10-07 (Nathan, the resting footer's reveal): alongside the ABSOLUTE
// progress we publish it NORMALIZED against the resting floor — `--footer-rise`
// is 0 in the resting pose and 1 at a full reveal, `--footer-span` is the
// travel the floor left (so rise × span × --footer-panel-h is the panel's own
// climb in px), and `--footer-rise-peak` is the rise's PEAK twin.
//
// Every consumer that must be ABSENT at rest reads the rise, never
// --footer-reveal: the raw var rests at 0.62 on mobile home, so a parallax
// reading it lifts the globe a third of the way on the FIRST PAINT, and a
// threshold reading it (STAGGER_ON) can never fire from that floor.
//
// Which of the two rises a consumer wants is doctrine, not taste:
//   • GEOMETRY rides the LIVE rise — the hero parallax must retreat with the
//     panel it is following.
//   • Anything that FADES rides --footer-rise-peak. "Footer exits are masked
//     via --footer-peak, never faded" (patterns.md): windowed over the live
//     rise, the client marks would dim away in full view on every retreat,
//     because the roll's top edge does not leave the fold until most of the
//     window is already spent.
// rest = 0 ⇒ rise === reveal, span === 1 — desktop and /work are unchanged.
let revealPeak = 0;
const broadcastReveal = (progress, rest = 0) => {
  const root = document.documentElement;
  revealPeak = progress <= rest + 0.001 ? rest : Math.max(revealPeak, progress);
  root.style.setProperty('--footer-reveal', progress.toFixed(4));
  root.style.setProperty('--footer-peak', revealPeak.toFixed(4));
  root.style.setProperty('--footer-rise', footerRise(progress, rest).toFixed(4));
  root.style.setProperty('--footer-rise-peak', footerRise(revealPeak, rest).toFixed(4));
  root.style.setProperty('--footer-span', footerSpan(rest).toFixed(4));
  root.toggleAttribute('data-footer-revealed', progress > 0.001);
};
const clearReveal = () => {
  const root = document.documentElement;
  revealPeak = 0;
  root.style.removeProperty('--footer-reveal');
  root.style.removeProperty('--footer-peak');
  root.style.removeProperty('--footer-rise');
  root.style.removeProperty('--footer-rise-peak');
  root.style.removeProperty('--footer-span');
  root.style.removeProperty('--footer-panel-h');
  root.removeAttribute('data-footer-revealed');
  root.removeAttribute('data-footer-in');
};

/* ── Driven mode's per-frame channel (10-07, Nathan — the home reveal felt
   laggy on an iPhone 17 Pro) ───────────────────────────────────────────────
   The driven panel used to take its progress as a PROP, so every touchmove
   frame reconciled Hero → SiteFooter → ClientLogoTicker just to recompute one
   inline transform and one `inert` — sixty full subtree renders a second,
   beside the WebGL draw, on the page Nathan calls laggy. Scroll mode has
   never done that: it paints from a ref (paint(), below). This is that paint
   handed to the driven host, so a gesture frame costs one style write and no
   React work at all.

   The `progress` prop still seeds the resting pose and still carries /work's
   own React-driven flow, so the declarative path is intact for a host that
   does not reach for this. One driven footer exists at a time (home OR
   /work), so one slot is enough; a value pushed before the panel's effect
   installs is held and painted on install. */
let drivenPaint = null;
let drivenPending = null;
export function paintDrivenFooter(p) {
  if (drivenPaint) drivenPaint(p);
  else drivenPending = p;
}

/* ── The resting footer's ON-LOAD entrance (10-07, Nathan: "be sure that we
   integrate GSAP text animation so that the footer text and footer elements
   don't just instantly load abruptly") ─────────────────────────────────────
   The panel is already OPEN at ?footerrest, so there is no reveal event to
   ride: STAGGER_ON (0.85) sits ABOVE the floor, which is exactly why the
   choreography below it never ran on load. And a progress-gated entrance
   would make the blurb ABSENT on load, the opposite of what the floor is
   for. So this is a one-time PAGE-LOAD beat, armed by Hero from inside
   chromeBeat — the same beat the CTA, the nav and the tagline pill arrive
   on — which fires in the resting pose by construction because it never
   reads progress. What rides the reveal instead is the client marks, in CSS,
   over --footer-rise-peak.

   Nathan settled the per-word arrival for THIS COPY as a seated FADE:
   "NO y transform on the per-word arrival — the sequential rise read as
   stutter; the words fade in seated" (SiteTagline.jsx:258-262 — the blurb IS
   that pill's long layer, TAGLINE_LONG_SPLIT). autoAlpha only, no y.

   The words are React-rendered spans, not a SplitText run: the pill does the
   same, the browser re-wraps them for free at 320/430px, and SplitText would
   be rewriting DOM React owns. The hidden ground is CSS under
   [data-footer-in], removed on every bail path, so ABSENCE MEANS VISIBLE —
   a dead chrome beat leaves the studio blurb up rather than blank.

   Idempotent: Hero's safety net and the beat can both call it. */
let entranceShown = false;
/** Ground the entrance's targets — called in the SAME frame as
    [data-footer-rest], so the resting blurb is never seen at full strength
    first. Never grounds under reduced motion, and never after the entrance
    has already played (Hero's RM path fires the chrome beat from a LAYOUT
    effect, which runs before this passive one). */
export function armFooterEntrance(reduced = false) {
  if (typeof document === 'undefined' || reduced || entranceShown) return false;
  document.documentElement.setAttribute('data-footer-in', '');
  return true;
}
export function playFooterEntrance(reduced = false) {
  if (typeof document === 'undefined' || entranceShown) return false;
  const panel = document.querySelector('.site-footer--links');
  // Queried at fire time, never cached at mount — the client:only stale-DOM
  // rule, the same one links() honours.
  const blurb = panel?.querySelector('.site-footer__blurb');
  if (!panel || !blurb) return false;
  entranceShown = true;
  const words = [...blurb.querySelectorAll('.site-footer__blurb-word')];
  const lead = panel.querySelector('.logo-ticker__copy');
  const ground = () => document.documentElement.removeAttribute('data-footer-in');
  if (reduced || !words.length) {
    ground();
    return true;
  }
  // Ground FIRST, then un-hide the container: one task, so there is no frame
  // in between and nothing flashes.
  const budget = getFooterIntroS();
  gsap.set(words, { autoAlpha: 0 });
  if (lead) gsap.set(lead, { autoAlpha: 0, y: 14 });
  ground();
  const tl = gsap.timeline();
  tl.to(
    words,
    {
      autoAlpha: 1,
      duration: budget,
      ease: 'power2.out',
      stagger: wordStagger(words.length, budget),
    },
    STAGGER_DELAY_S
  );
  // The band's copy line is the one element that may rise: it is a single
  // line arriving under the blurb, not a sequence of words, so there is no
  // stutter to read. The `rises` channel from useProcessCopy, verbatim.
  if (lead) {
    tl.to(
      lead,
      { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out', clearProps: 'all' },
      STAGGER_DELAY_S + 0.18
    );
  }
  return true;
}
/** Hero's footer effect calls this on teardown: a fresh mount must be able to
    run the entrance again (a soft nav back to home). */
export function resetFooterEntrance() {
  entranceShown = false;
}

/** The [emphasised opening, rest] blurb pair → one flat word list, each word
    carrying whether it is in the Medium opening. */
const blurbWords = ([em, rest]) => [
  ...String(em || '').split(/\s+/).filter(Boolean).map((word) => ({ word, em: true })),
  ...String(rest || '').split(/\s+/).filter(Boolean).map((word) => ({ word, em: false })),
];

export default function SiteFooter({
  noFill = false,
  tagline = 'Visual Worlds for the Music Industry',
  /** Driven mode (/work): reveal fed an explicit 0..1 — no document scroll. */
  driven = false,
  progress = 0,
  /** The client-logo band above the links (09-07). Off = the bare panel. */
  ticker = true,
  /** MOBILE HOME VARIANT (10-07, Nathan) — the long studio blurb, as the
      [emphasised opening, rest] pair SiteTagline exports (TAGLINE_LONG_SPLIT).
      Present = this panel carries the blurb; global.css draws it only while
      the footer rests ([data-footer-rest]), since desktop home keeps the
      blurb in the tagline pill. */
  blurb = null,
  /** Driven mode: the progress this panel PARKS at (0 everywhere but mobile
      home, where Hero floors it at ?footerrest). The peak broadcast resets
      here instead of at 0. */
  rest = 0,
  /** Scroll mode: spacer = K × panel height. Absent = the ?footertravel
      bake (1.8). /process passes 1 so the reveal is exactly one panel of
      runway, baked into the last slide's swipe (09-08). */
  travelK,
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
      const h = panel.offsetHeight;
      travel = h * (travelK ?? getFooterTravelK());
      spacer.style.height = `${travel}px`;
      // Broadcast the panel's own height — /process sizes its last slide
      // to the room ABOVE the risen panel (process.css .process-cta).
      document.documentElement.style.setProperty('--footer-panel-h', `${h}px`);
    };

    const apply = () => {
      raf = 0;
      if (disposed || !travel) return;
      // Invoked (the pill) or mid-wipe: the tween owns the paint.
      if (invoked || (wipe && wipe.isActive())) return;
      // 0 when the spacer sits at/below the fold; 1 once it has fully risen
      // into the bottom band (== document end, by construction — the K in the
      // spacer height is divided back out here). paint() also keeps the
      // panel inert below the fold (a11y: no tab stops off-screen) and
      // broadcasts CONTINUOUSLY for the shared-chrome nav slide.
      paint(scrollProgress());
    };

    // 09-08 (Nathan): the tagline pill raises the footer AS AN OVERLAY right
    // where the page is — no scroll. While invoked, the scroll math stands
    // down (apply() returns early); the panel is wiped by a tween of the
    // same 0..1. A pointerdown outside closes it: the inverse wipe back to
    // whatever progress the scroll position implies, then apply() resumes.
    let invoked = false;
    let wipe = null;
    let shown = 0; // the progress the panel is painted at
    const paint = (p) => {
      shown = p;
      panel.style.transform = `translateY(${(1 - p) * 100}%)`;
      const wantInert = p <= 0.001;
      if (wantInert !== inertFlag) {
        inertFlag = wantInert;
        panel.inert = wantInert;
      }
      broadcastReveal(p);
    };
    const scrollProgress = () => {
      if (!travel) return 0;
      const top = spacer.getBoundingClientRect().top;
      return Math.min(Math.max((window.innerHeight - top) / travel, 0), 1);
    };
    const onRevealRequest = () => {
      if (invoked) return;
      invoked = true;
      document.documentElement.setAttribute('data-footer-invoked', '');
      wipe?.kill();
      wipe = wipeReveal(shown, paint, 1);
    };
    const closeInvoked = () => {
      if (!invoked) return;
      invoked = false;
      document.documentElement.removeAttribute('data-footer-invoked');
      wipe?.kill();
      wipe = wipeReveal(shown, paint, scrollProgress());
    };
    const onOutside = (e) => {
      if (invoked && isOutside(e, panel)) closeInvoked();
    };
    window.addEventListener(FOOTER_REVEAL_EVENT, onRevealRequest);
    document.addEventListener('pointerdown', onOutside, true);

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
      window.removeEventListener(FOOTER_REVEAL_EVENT, onRevealRequest);
      document.removeEventListener('pointerdown', onOutside, true);
      document.documentElement.removeAttribute('data-footer-invoked');
      wipe?.kill();
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
    // 10-07: RETIRE this loop on the resting footer. [data-footer-revealed]
    // never clears there (the panel rests at ?footerrest for the whole
    // session), so a getComputedStyle forced style read span 60 fps beside
    // the WebGL globe — to animate five links that are display:none at
    // ≤768px and a threshold the floor can never cross. f1dd984 made exactly
    // this fix in SiteTagline's maskLive() and missed this file. The resting
    // footer's own entrance is beat-armed (playFooterEntrance) and needs no
    // loop at all. Hero sets [data-footer-rest] AFTER this child effect runs,
    // so the loop arms for one frame and then self-retires — the links' CSS
    // ground is cleared above 768px (the rotation case), so nothing is left
    // stranded invisible.
    const watchLive = () =>
      document.documentElement.hasAttribute('data-footer-revealed') &&
      !document.documentElement.hasAttribute('data-footer-rest');
    const watch = () => {
      raf = 0;
      const p = readReveal();
      if (!shown && p >= STAGGER_ON && landed()) {
        shown = true;
        if (reduced) gsap.set(links(), { autoAlpha: 1, y: 0 });
        else ensureTl().play();
      }
      // 09-08 (Nathan): NO retreat branch — the links stay landed while the
      // panel slides down; the exit is masked by its top edge leaving the
      // viewport. They snap back to the hidden ground only once the panel
      // parks (the attribute clears → the observer below).
      if (watchLive()) {
        raf = requestAnimationFrame(watch);
      }
    };
    const mo = new MutationObserver(() => {
      const on = document.documentElement.hasAttribute('data-footer-revealed');
      if (watchLive() && !raf) raf = requestAnimationFrame(watch);
      if (!on) {
        // Panel parked (or route swap): snap to the hidden ground — the
        // panel is off-screen, so nothing is seen fading (09-08).
        if (shown) {
          shown = false;
          tl?.pause(0);
          gsap.set(links(), { autoAlpha: 0, y: 10 });
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
    if (watchLive()) {
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
  // Driven mode's invoked overlay (09-08): the host wipes progress on the
  // pill's request; this side only remembers that it was INVOKED and asks
  // the host to wipe down on a pointerdown outside the panel.
  useEffect(() => {
    if (!driven) return undefined;
    let invoked = false;
    const onReq = () => {
      invoked = true;
      document.documentElement.setAttribute('data-footer-invoked', '');
    };
    const clear = () => {
      invoked = false;
      document.documentElement.removeAttribute('data-footer-invoked');
    };
    const onOutside = (e) => {
      const panel = panelRef.current;
      if (!invoked || !panel || !isOutside(e, panel)) return;
      clear();
      window.dispatchEvent(new Event(FOOTER_CLOSE_EVENT));
    };
    window.addEventListener(FOOTER_REVEAL_EVENT, onReq);
    document.addEventListener('pointerdown', onOutside, true);
    return () => {
      window.removeEventListener(FOOTER_REVEAL_EVENT, onReq);
      document.removeEventListener('pointerdown', onOutside, true);
      clear();
    };
  }, [driven]);
  // The driven panel's paint — transform, inert and the <html> broadcast, all
  // imperative, exactly as scroll mode's paint() does them. The prop seeds it
  // and keeps /work's React flow working; the per-frame channel above lets a
  // gesture host move the panel without a render (see paintDrivenFooter).
  useEffect(() => {
    if (!driven) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    let inertFlag = null;
    const paint = (p) => {
      panel.style.transform = `translateY(${((1 - p) * 100).toFixed(3)}%)`;
      const wantInert = p <= 0.001;
      if (wantInert !== inertFlag) {
        inertFlag = wantInert;
        panel.inert = wantInert;
      }
      if (p <= rest + 0.001) document.documentElement.removeAttribute('data-footer-invoked');
      broadcastReveal(p, rest);
    };
    drivenPaint = paint;
    paint(drivenPending ?? drivenP);
    drivenPending = null;
    return () => {
      if (drivenPaint === paint) drivenPaint = null;
    };
  }, [driven, drivenP, rest]);
  useEffect(() => {
    if (!driven) return undefined;
    return () => {
      drivenPending = null;
      clearReveal(); // route swap away from /work drops the broadcast
    };
  }, [driven]);

  // ── The panel's own height, in DRIVEN mode too (10-07) ──
  // sizeSpacer() is the only other writer of --footer-panel-h and it lives
  // inside `if (!reveal) return`, so the driven routes never published it:
  // home had no panel height in CSS at all, and the hero parallax had no
  // denominator for "half the rate of the actual scroll". Same property name
  // as scroll mode — a forked name is a bug — so /process's existing reader
  // is unaffected. Layout-change cost only; nothing per frame. The expensive
  // re-measure goes through the house settle debounce, so a rotation does not
  // thrash it, and document.fonts.ready re-seats it once the webfont's
  // metrics have moved the blurb's wrap.
  useEffect(() => {
    if (!driven) return undefined;
    const panel = panelRef.current;
    if (!panel) return undefined;
    let disposed = false;
    const publish = () => {
      if (disposed) return;
      document.documentElement.style.setProperty('--footer-panel-h', `${panel.offsetHeight}px`);
    };
    publish();
    const settle = settleDebounce(publish);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(settle) : null;
    ro?.observe(panel);
    document.fonts?.ready?.then(publish);
    return () => {
      disposed = true;
      settle.cancel();
      ro?.disconnect();
    };
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
        // BOTH modes mount inert and flip imperatively per frame now (10-07):
        // driven mode's transform and inert moved into its paint() so a
        // gesture frame costs no React render. A declarative transform here
        // would fight that paint on the next unrelated re-render.
        inert={driven ? drivenP <= 0.001 : true}
      >
        {ticker && <ClientLogoTicker />}
        <div className="site-footer__inner">
          {/* LEFT retired (08-27, Nathan): the persistent SiteTagline pill —
              fixed at this panel's exact inner inset — IS the left column
              now; its copyright + white lockup fade in on this panel's own
              --footer-reveal broadcast, settling into place here. The inner
              keeps a min-height (global.css) so the band still backdrops
              that stack. */}
          {/* 10-07 (Nathan): the mobile home variant's own copy — the studio
              blurb, at the TOP of the panel with the logo band's
              "utilized by…" line fading in below it (the band is ordered
              last there), so the footer answers "what is Small World Media"
              on load. Drawn only while the footer rests (global.css). */}
          {/* 10-07: set as PER-WORD spans (the tagline pill's own shape —
              .site-tagline__word), because the on-load entrance fades the
              words in one at a time. React renders them rather than SplitText
              splitting them at fire time: the pill does the same, the browser
              re-wraps real inline spans for free when the blurb re-flows at
              320/430px, and a SplitText run here would be rewriting DOM React
              owns. No display change on the span, so the text lays out
              identically to the two-span version. */}
          {blurb && (
            <p className="site-footer__blurb">
              {blurbWords(blurb).map(({ word, em }, i) => (
                <Fragment key={`${i}-${word}`}>
                  {i > 0 && ' '}
                  <span
                    className={`site-footer__blurb-word${em ? ' site-footer__blurb-em' : ''}`}
                  >
                    {word}
                  </span>
                </Fragment>
              ))}
            </p>
          )}

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
