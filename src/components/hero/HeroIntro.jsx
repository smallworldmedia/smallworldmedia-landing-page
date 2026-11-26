/**
 * HeroIntro — the logo→globe intro (home-hero rework, chunk 5; replaced the
 * loom). Mounted by Hero ONLY in full-intro mode (first visit or an ?intro
 * force; never under reduced motion — and the machine bails here too, the
 * dual guard).
 *
 * The lockup: the studio's inline "small world media" wordmark (the real
 * brand asset, src/assets/swm-lockup-inline.svg, inlined via ?raw) — blue
 * (#0000FF, exactly GAP_COLOR) letterforms with the "o" of "world" drawn as
 * a globe glyph. That glyph path (id="swm-lockup-glyph") is the HIDDEN SLOT:
 * the live WebGL globe shows through where it was. Nothing is composited:
 * the hero's veil paints BELOW the canvas, so a black field with the globe
 * visible is free; the SVG letterforms simply overlay on top. Everything
 * asset-shaped stays isolated behind buildLockup() + placeGlyphRect()
 * (inject the artwork, hide the glyph, measure its slot) — swap the asset
 * and the machines below don't change. (The letterforms are the "chars" the
 * variants animate; the SVG scales via its viewBox so the glyph slot lands
 * at the target diameter — the lockup bleeds past the hero, which clips it.)
 *
 * Glyph framing: from the measured o-rect we compute rig values that frame
 * the globe exactly in the slot — fitCover FORCED contain for the glyph
 * phase, fill = slotDiameterPx / fitAxisPx (the contain axis in px, from
 * the same tan-space fit applyRig uses; the sin≈tan error at slot scale is
 * ~0.1%, invisible), offsets as fractions of the half-viewport. Sign
 * convention verified against applyRig's setViewOffset (it negates):
 * +offsetX = globe RIGHT, +offsetY = DOWN — so offset = (rectCenter −
 * viewportCenter) / halfViewport, no flips. ORDERING: the measure + rig
 * write happens in useLayoutEffect, BEFORE the scene's own (passive)
 * effect builds — when the scene isn't up yet we PRE-SEED rigRef.current
 * with the glyph pose and useGlobeScene's rig-carry spreads it into the
 * build, so the very first rendered frame is glyph-framed. No
 * resting-comp flash. Re-measured on document.fonts.ready + resize until
 * the launch locks the rig.
 *
 * Variant A — "Typeset, then Ignition" (~introms, default 5.0s): chars
 * materialize in random order (o-globe already there, ambient yaw in the
 * slot) → hold (?introhold) → replayCascade('sweep') AT GLYPH SCALE
 * (?introcascadeat — CRT sparks inside the letterform) → THE ZOOM: one
 * master rig tween on HERO_INTRO_EASE_PATH driving proxy e 0→1;
 * fill/offsets/elev lerp glyph → resting, the veil thins across e, the
 * remaining chars slide out slowly (power-lagged scrub, gone by e≈0.82 —
 * the growing globe overlaps and covers letters mid-exit; a paused
 * GSAP timeline scrubbed by e — GSAP-owned, no per-frame char JS), the
 * lattice inks white→blue (setInk, e remapped 0.2→0.7, TUNING.heroInk),
 * and at e≈0.8 the chrome beat fires + releaseScheduler().
 *
 * Variant C — "Flicker Lockup, Launch" (~3.2s, authored script): chars
 * power on with a DOM port of the cascade's CRT flicker (opacity
 * keyframes, randomized per char; o-globe dark) → cascade in the o,
 * half-beat hold → THE LAUNCH: the same master rig tween idiom, one
 * diagonal move glyph → resting; chars power DOWN (reverse flicker,
 * timeline-owned) while the chrome beat fires EARLY (launch + 0.4s) so
 * the statement powers up left as the globe travels; releaseScheduler at
 * the beat; setInk across the launch.
 *
 * The end pose is the resting comp expressed in CONTAIN space
 * (fill × the cover/contain tan ratio) so Hero's onDone TUNING stamp —
 * which restores the device fitCover — lands on the identical
 * fill·tanFit product: a bit-exact axis swap, no seam. Zoom is never
 * touched (gesture-owned, sits at 1 through the intro).
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { TUNING, HERO_INTRO_EASE_PATH, GLOBE_STROKE_FRAC } from './heroConfig.js';
import {
  CAMERA_FOV,
  FILL_FRACTION,
  FIT_COVER,
  IS_MOBILE,
  PREFERS_REDUCED_MOTION,
} from '../globe/globeConfig.js';
// The real brand lockup, inlined at build (?raw → markup string). The XML
// prolog + fixed width/height were stripped in prep so it parses as an HTML
// fragment and scales via CSS width; the globe glyph carries id
// "swm-lockup-glyph".
import LOCKUP_SVG from '../../assets/swm-lockup-inline.svg?raw';

gsap.registerPlugin(CustomEase);

const GLYPH_ID = 'swm-lockup-glyph';

/* — Slot size targets (globe-glyph diameter, px). The slot is the POINT of
   the intro — live tiles readable inside the letterform — so its floor
   holds even when that pushes the lockup past the viewport edges (the hero
   overflow-clips; the glyph sits near the line's middle, so the crop stays
   centered on the moment). vw scales it on wider viewports; the range caps
   it. — */
const O_DESKTOP = { vw: 0.09, min: 120, max: 160 };
const O_MOBILE = { vw: 0.24, min: 80, max: 110 };

/* — Variant A script (seconds; the knobs move the rest) — */
const A_CHARS_IN_SEC = 0.9; // materialize window
const A_IGNITION_GAP_SEC = 0.6; // sparks land, THEN the zoom
const A_TAIL_SEC = 0.4; // introms envelope past the zoom's end
const A_LAUNCH_MIN_SEC = 0.8; // floor when the knobs squeeze the zoom
const A_CHARS_GONE_E = 0.82; // chars have left frame / been covered by the globe by here (late — the growing globe overlaps/covers letters mid-exit before they clear)
const A_CHARS_EXIT_POW = 1.7; // power remap on the exit scrub — early char travel LAGS the globe growth (slow start, catch-up finish), so the globe visibly overruns letters before they leave frame
const A_CHROME_E = 0.8; // chrome beat + releaseScheduler
const A_CHARS_EXIT_PAD = 48; // px past the viewport edge each char travels to leave frame
const A_CHARS_SCALE = 1.12; // UNIFORM group zoom (about the globe center) as the lockup exits
const A_INK_E = [0.2, 0.7]; // setInk window on e

/* — Variant C script (seconds; authored, ~3.2s total — the A timing knobs
   deliberately don't reach in) — */
const C_FLICKER_SPREAD_SEC = 0.45; // per-char power-on delay window
const C_CASCADE_SEC = 1.0;
const C_LAUNCH_SEC = 1.6;
const C_LAUNCH_DUR_SEC = 1.4;
const C_CHROME_LAG_SEC = 0.4; // beat fires early — launch start + this
const C_OFF_SPREAD_SEC = 0.35; // per-char power-down delay window
const C_DONE_SEC = 3.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const seg = (e, a, b) => clamp((e - a) / (b - a), 0, 1);

/* ————— The asset swap seam ————— */

/**
 * Inject the real lockup artwork and split it into its parts: the globe
 * glyph (the "o" of "world", tagged in the asset) becomes the hidden slot;
 * every other letterform element is a "char" the variants animate. The
 * return shape matches the machines' contract exactly — chars are valid
 * GSAP / getBoundingClientRect targets (SVG elements), oChar is the slot,
 * split.revert() clears the injected markup on teardown.
 * @returns {{ split: {revert: () => void}, chars: Element[], oChar: Element|null }}
 */
function buildLockup(markEl) {
  markEl.innerHTML = LOCKUP_SVG;
  const svg = markEl.querySelector('svg');
  if (!svg) return { split: { revert: () => {} }, chars: [], oChar: null };
  svg.classList.add('hero-intro__art');
  const all = [...svg.querySelectorAll('path, polygon, rect')];
  // The globe glyph carries the tag; fall back to the widest element (the
  // globe's advance is ~2× a letter's) so a re-exported asset can't strand
  // the slot.
  let oChar =
    svg.querySelector(`#${GLYPH_ID}`) ??
    all.reduce((a, b) => (b.getBBox().width > a.getBBox().width ? b : a), all[0]) ??
    null;
  const chars = all.filter((el) => el !== oChar);
  return { split: { revert: () => { markEl.innerHTML = ''; } }, chars, oChar };
}

/**
 * Size the lockup so the glyph slot hits the target diameter, then measure
 * the slot (the process placeGlobe idiom driven the other way — the glyph
 * box drives the camera). The glyph's share of the viewBox is fixed, so one
 * SVG width solves the slot px; the floor wins and the lockup bleeds past
 * the hero (which clips it). Returns hero-relative px.
 */
function placeGlyphRect(root, markEl, oChar) {
  const svg = markEl.querySelector('svg');
  const rb = root.getBoundingClientRect();
  const t = IS_MOBILE ? O_MOBILE : O_DESKTOP;
  const desired = clamp(rb.width * t.vw, t.min, t.max); // glyph diameter, px
  const vbW = svg?.viewBox?.baseVal?.width || 1;
  const glyphVbW = oChar.getBBox().width || 1; // glyph extent in viewBox units
  // svgWidth · (glyphVbW / vbW) = desired  →  solve the width.
  const svgW = (desired * vbW) / glyphVbW;
  svg.style.width = `${svgW.toFixed(2)}px`;
  svg.style.height = 'auto';
  const ob = oChar.getBoundingClientRect();
  return {
    cx: ob.left + ob.width / 2 - rb.left,
    cy: ob.top + ob.height / 2 - rb.top, // the glyph box IS the globe — true center
    d: ob.width,
    w: rb.width || 1,
    h: rb.height || 1,
  };
}

/* ————— Rig math (mirrors applyRig's tan-space fit) ————— */

/** Rig pose that frames the globe exactly in the o-rect (contain-forced). */
function glyphPoseFor({ cx, cy, d, w, h }) {
  const tanV = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const tanH = tanV * (w / h);
  // Contain picks the smaller tan axis; its px dimension is the fit axis.
  const fitAxisPx = tanH < tanV ? w : h;
  return {
    // Frame the globe 1/(1+FRAC) SMALLER than the o-glyph box so Hero's outer
    // stroke disc (sized 1+FRAC proud of the live silhouette) lands its ring
    // exactly at the glyph edge — the ringed globe reads AS the lockup "o",
    // not proud of it (Rev-Notes-02 lockup fidelity). FRAC=0 → the raw globe
    // fills the slot as before.
    fill: Math.max(d, 1) / (1 + GLOBE_STROKE_FRAC) / fitAxisPx,
    fitCover: false, // forced for the glyph phase; released at onDone
    // applyRig negates into setViewOffset: + is RIGHT/DOWN (chunk 3's
    // desktop +0.55 sits right of center) — same sense as screen deltas.
    offsetX: (cx - w / 2) / (w / 2),
    offsetY: (cy - h / 2) / (h / 2),
    elevDeg: 0, // face-on — the line-art mark, no camera tilt
  };
}

/** The resting TUNING pose with fill re-expressed against the contain axis. */
function restingContainPose(w, h) {
  const restFill = TUNING.fill ?? FILL_FRACTION;
  const restCover = TUNING.fitCover ?? FIT_COVER;
  const aspect = w / h;
  // cover/contain tan ratio: max(tanV,tanH)/min(tanV,tanH). Same product
  // fill·tanFit either way, so the axis swap at onDone is seamless.
  const tanRatio = restCover ? Math.max(aspect, 1 / aspect) : 1;
  return {
    fill: restFill * tanRatio,
    offsetX: TUNING.offsetX,
    offsetY: TUNING.offsetY,
    elevDeg: TUNING.elevDeg,
  };
}

/* — DOM port of cascade.js's CRT flicker (variant C): dim pulse → dip →
   rise → waver → settle, as opacity keyframes (DOM can't over-brighten, so
   the >1 overshoot beat becomes a post-rise waver). Randomized per char. — */
const flickerOn = () => [
  { autoAlpha: 0.4 + Math.random() * 0.25, duration: 0.08, ease: 'power1.in' },
  { autoAlpha: 0.1 + Math.random() * 0.15, duration: 0.07, ease: 'none' },
  { autoAlpha: 1, duration: 0.22, ease: 'power2.out' },
  { autoAlpha: 0.82 + Math.random() * 0.1, duration: 0.08, ease: 'none' },
  { autoAlpha: 1, duration: 0.1, ease: 'sine.out' },
];
const flickerOff = () => [
  { autoAlpha: 0.3 + Math.random() * 0.2, duration: 0.06, ease: 'none' },
  { autoAlpha: 0.65 + Math.random() * 0.2, duration: 0.07, ease: 'none' },
  { autoAlpha: 0, duration: 0.18, ease: 'power1.in' },
];

export default function HeroIntro({ rigRef, sceneApiRef, veilRef, onChromeBeat, onDone }) {
  const rootRef = useRef(null);
  const markRef = useRef(null);
  const lockupRef = useRef(null); // { split, chars, oChar }
  const rectRef = useRef(null); // latest o-rect (hero-relative px)
  const lockedRef = useRef(false); // launch started — the master tween owns the rig

  /* — Lockup + glyph rig BEFORE the first painted frame — */
  useLayoutEffect(() => {
    const root = rootRef.current;
    const mark = markRef.current;
    const veil = veilRef?.current;
    if (!root || !mark) return undefined;
    let disposed = false;

    const lockup = buildLockup(mark);
    lockupRef.current = lockup;
    // The o is the slot — invisible, always; siblings start dark for both
    // variants (A materializes them, C flickers them on).
    if (lockup.oChar) gsap.set(lockup.oChar, { autoAlpha: 0 });
    gsap.set(lockup.chars, { autoAlpha: 0 });
    // First mount finds the veil already up (CSS); a bench replay-intro
    // re-raises it here, pre-paint.
    if (veil) gsap.set(veil, { autoAlpha: 1 });

    const place = () => {
      if (disposed || lockedRef.current || !lockup.oChar) return;
      const rect = placeGlyphRect(root, mark, lockup.oChar);
      rectRef.current = rect;
      const pose = glyphPoseFor(rect);
      const handle = rigRef?.current;
      if (handle) {
        Object.assign(handle.rig, pose);
        handle.apply();
      } else if (rigRef) {
        // Scene not built yet (fresh island): pre-seed through the
        // rig-carry — useGlobeScene spreads rigRef.current.rig into its RIG
        // at build, so frame one is already glyph-framed. The stub apply is
        // inert; the scene replaces the handle with the live one.
        rigRef.current = { rig: { ...pose, zoom: 1 }, apply: () => {} };
      }
    };
    place();
    document.fonts?.ready.then(() => place()); // webfont metrics land late
    window.addEventListener('resize', place);

    return () => {
      disposed = true;
      window.removeEventListener('resize', place);
      lockup.split.revert();
      lockupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* — The machine (passive — the scene's effect has run, the api is live) — */
  useEffect(() => {
    const root = rootRef.current;
    const veil = veilRef?.current;
    const lockup = lockupRef.current;
    if (!root || !lockup) return undefined;
    // RM dual guard — Hero never mounts this under reduced motion, and it
    // still refuses to run here: hand straight back.
    if (PREFERS_REDUCED_MOTION) {
      onDone?.();
      return undefined;
    }

    const api = () => sceneApiRef?.current;
    const { chars } = lockup;
    const variant = TUNING.intro === 'c' ? 'c' : 'a';
    const ink = TUNING.heroInk;
    // White lattice from the very first rendered frame (the line-art mark);
    // the launch inks it back to the resting blue.
    if (ink) api()?.setInk(0);

    const introEase = CustomEase.create('swmHeroIntro', HERO_INTRO_EASE_PATH);
    const proxy = { e: 0 };
    let scrub = null; // A: paused char-track timeline, scrubbed by e
    let beatFired = false;
    const fireBeat = () => {
      if (beatFired) return;
      beatFired = true;
      onChromeBeat?.(); // arm the gesture, stamp data-chromed, broadcast
      api()?.releaseScheduler(); // glyph phase over — HLS decodes may begin
    };

    // A's char exit, GSAP-owned: one paused timeline, every char tracking
    // outward from the slot and fading, scrubbed by the master e (progress
    // is the only per-frame call — no per-char JS in the loop).
    const buildCharScrub = () => {
      const tl = gsap.timeline({ paused: true });
      const rb = root.getBoundingClientRect();
      const ocx = rb.left + (rectRef.current ? rectRef.current.cx : rb.width / 2);
      // The globe (now z-above the wordmark) OBSCURES the letters as it grows.
      // Split the wordmark AT the globe: letters before it are the left group,
      // after it the right group. Each group translates as ONE RIGID unit — a
      // single shared x per side — so the letters keep their spacing relative to
      // one another and slide off-frame in LOCKSTEP, never spreading apart or
      // clipping individually. The per-side delta carries that group's INNER
      // edge (the letter nearest the globe) just past the viewport edge, so the
      // whole rigid group clears frame, and the whole lockup ZOOMS as one unit
      // (uniform group scale about the globe center) as the globe grows. Scale is
      // realized as own-center scale + a computed x/y so the net motion equals
      // "scale A_CHARS_SCALE about the globe center, then the group exit" — a
      // coherent zoom (spacing scales uniformly, arrangement locked), NOT the
      // per-letter own-box scale that drifted them apart. The growing globe
      // (z-above) obscures them; they don't fade.
      const ocy = rb.top + (rectRef.current ? rectRef.current.cy : rb.height / 2);
      let leftMaxRight = -Infinity; // rightmost right-edge among left-group chars
      let rightMinLeft = Infinity; // leftmost left-edge among right-group chars
      const info = chars.map((c) => {
        const b = c.getBoundingClientRect(); // one-time read, launch start
        const cx = b.left + b.width / 2;
        const dir = cx < ocx ? -1 : 1;
        if (dir < 0) leftMaxRight = Math.max(leftMaxRight, b.right);
        else rightMinLeft = Math.min(rightMinLeft, b.left);
        return { dir, cx, cy: b.top + b.height / 2 };
      });
      const leftDelta = leftMaxRight > -Infinity ? -(leftMaxRight - rb.left + A_CHARS_EXIT_PAD) : 0;
      const rightDelta = rightMinLeft < Infinity ? rb.right - rightMinLeft + A_CHARS_EXIT_PAD : 0;
      const gs = A_CHARS_SCALE - 1; // group-zoom outward term (per glyph, about the globe center)
      chars.forEach((c, i) => {
        const { dir, cx, cy } = info[i];
        tl.to(
          c,
          {
            x: (dir < 0 ? leftDelta : rightDelta) + (cx - ocx) * gs,
            y: (cy - ocy) * gs,
            scale: A_CHARS_SCALE,
            transformOrigin: 'center',
            duration: 1,
            ease: 'none',
          },
          0
        );
      });
      return tl;
    };

    /* — THE LAUNCH — one master rig tween, both variants: proxy e 0→1 on
       the intro curve; every beat is a read of e. Endpoints snapshot at
       onStart (not build time) so pre-launch re-measures/resizes are
       honored; from there the tween owns the rig (lockedRef). — */
    const addLaunch = (tl, at, duration, { scrubChars, inkMap, chromeAtE }) => {
      const s = { handle: null, g: null, r: null };
      tl.to(
        proxy,
        {
          e: 1,
          duration,
          ease: introEase,
          onStart: () => {
            lockedRef.current = true;
            const w = root.clientWidth || 1;
            const h = root.clientHeight || 1;
            s.handle = rigRef?.current ?? null;
            s.g = s.handle
              ? {
                  fill: s.handle.rig.fill,
                  ox: s.handle.rig.offsetX,
                  oy: s.handle.rig.offsetY,
                  elev: s.handle.rig.elevDeg,
                }
              : null;
            s.r = restingContainPose(w, h);
            if (scrubChars) scrub = buildCharScrub();
          },
          onUpdate: () => {
            const e = proxy.e;
            if (s.handle && s.g) {
              s.handle.rig.fill = s.g.fill + (s.r.fill - s.g.fill) * e;
              s.handle.rig.offsetX = s.g.ox + (s.r.offsetX - s.g.ox) * e;
              s.handle.rig.offsetY = s.g.oy + (s.r.offsetY - s.g.oy) * e;
              s.handle.rig.elevDeg = s.g.elev + (s.r.elevDeg - s.g.elev) * e;
              s.handle.apply(); // ONE apply for every rig write this frame
            }
            if (veil) veil.style.opacity = (1 - e).toFixed(4);
            if (scrub) scrub.progress(Math.pow(seg(e, 0, A_CHARS_GONE_E), A_CHARS_EXIT_POW));
            if (ink) api()?.setInk(inkMap(e));
            if (chromeAtE != null && e >= chromeAtE) fireBeat();
          },
        },
        at
      );
    };

    const tl = gsap.timeline({ onComplete: () => onDone?.() });

    if (variant === 'a') {
      /* — A: Typeset, then Ignition. The knobs shape the script: chars-in
         is fixed, the hold and the cascade beat are dialable, the zoom
         fills the remainder of ?introms (0.4s envelope, 0.8s floor). — */
      const T = Math.max(TUNING.introMs, 1500) / 1000;
      const holdSec = Math.max(TUNING.introHoldMs, 0) / 1000;
      const cascadeAt = Math.max(TUNING.introCascadeMs, 0) / 1000;
      const launchAt = Math.max(A_CHARS_IN_SEC + holdSec, cascadeAt) + A_IGNITION_GAP_SEC;
      const launchDur = Math.max(A_LAUNCH_MIN_SEC, T - launchAt - A_TAIL_SEC);
      // A1 — materialize, random order (house random-stagger, autoAlpha
      // snaps); the o-globe is already there, slow ambient yaw in the slot.
      tl.to(chars, { autoAlpha: 1, duration: 0.05, stagger: { each: 0.05, from: 'random' } }, 0);
      // A2 is the hold — nothing moves but the o's rotation.
      // A3 — CRT sparks INSIDE the letterform, at glyph scale.
      tl.add(() => api()?.replayCascade('sweep'), cascadeAt);
      // A4 — THE ZOOM (chrome beat + scheduler release at e≈0.8 inside).
      addLaunch(tl, launchAt, launchDur, {
        scrubChars: true,
        inkMap: (e) => seg(e, A_INK_E[0], A_INK_E[1]),
        chromeAtE: A_CHROME_E,
      });
      // The introms envelope — onComplete (and the unmount) at T, not at
      // the zoom's last frame (the launchDur floor can push past it).
      tl.add(() => {}, Math.max(T, launchAt + launchDur));
    } else {
      /* — C: Flicker Lockup, Launch — the authored ~3.2s script. — */
      // C1 — chars power on, the cascade's flicker ported to DOM opacity.
      chars.forEach((c) => {
        tl.to(c, { keyframes: flickerOn() }, Math.random() * C_FLICKER_SPREAD_SEC);
      });
      // C2 — the cascade in the o; half-beat hold.
      tl.add(() => api()?.replayCascade('sweep'), C_CASCADE_SEC);
      // C3 — THE LAUNCH: one diagonal move, steep launch, long decel.
      addLaunch(tl, C_LAUNCH_SEC, C_LAUNCH_DUR_SEC, {
        scrubChars: false,
        inkMap: (e) => e,
        chromeAtE: null,
      });
      // Chars power DOWN (reverse flicker, timeline-owned) as it travels…
      chars.forEach((c) => {
        tl.to(c, { keyframes: flickerOff() }, C_LAUNCH_SEC + Math.random() * C_OFF_SPREAD_SEC);
      });
      // …and the chrome beat fires EARLY — the statement powers up left
      // while the globe is still moving. Scheduler releases with it.
      tl.add(fireBeat, C_LAUNCH_SEC + C_CHROME_LAG_SEC);
      // Settle envelope — onComplete (and the unmount) at the scripted end.
      tl.add(() => {}, C_DONE_SEC);
    }

    return () => {
      tl.kill();
      if (scrub) scrub.kill();
      gsap.killTweensOf(chars);
      gsap.killTweensOf(proxy);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hero-intro" ref={rootRef} aria-hidden="true">
      {/* buildLockup injects the real lockup SVG here (useLayoutEffect,
          pre-paint); the h1 in HeroText carries the accessible name. */}
      <div className="hero-intro__mark" ref={markRef} />
    </div>
  );
}
