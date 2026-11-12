/**
 * NextProjectBand — the detail-page continuation card (/work/[slug] bottom).
 *
 * Populated with the next Featured Project's identity + first-order media
 * asset (chain order == the /work World order, wrapping last → first).
 *
 * The band continues the media grid: its window hangs one grid gutter below
 * the grid's last row, flush with its right edge (11-04, Nathan: no black
 * between them; phones stack the window above the text for the same seam).
 *
 * Entrance (11-04, Nathan: every motion leans toward turning the page),
 * scrubbed by the page scroll from the label reaching ?npinstart of the
 * viewport to the document end, where the gesture arms. A cascade, right to
 * left and then up: the `Next Project:` label slides in from the far right
 * to its rest seat; the media window pushes out from its right edge (0 →
 * its rest width), ?nplag behind the label; then the client name rises,
 * and ?npstep after it the service tags (masked slide-ups). ?npbig starts
 * the label larger, shrinking toward its right edge as it slides (default
 * 1). The rule rides under the label the whole way.
 *
 * Past the entrance, the band is driven by the site's one resistance
 * interaction: the wheel/touch accumulator from /work's [NEXT]/[PREVIOUS]
 * (same ?scroll trigger), with /work's rubber band (11-04, Nathan): the
 * fill tracks on DRAG_TRACK_S and springs home on RELEASE_GLIDE_S /
 * RELEASE_EASE (lib/motion.js; the step itself is lib/rubberBand.js, shared
 * with the phone blurb hold), a finger holds it until the lift, and the
 * wheel lets go on the RELEASE_MS stall (?releasems / ?touchgain via
 * lib/touchTune.js).
 *
 * The gesture engages only at the document's end. The fill drives the media
 * and the client name together, from the first delta (11-03, Nathan — no
 * stagger; the Figma states 15:385/401/417 ran a staggered text exit):
 *
 *   media  — a WINDOW (component-defined 4:3 landscape at full open,
 *            locked height) whose real width the scroll pulls open leftward
 *            off its pinned right edge (11-12, Nathan). The media fills it,
 *            cover-fit and centred on every frame, so it stays centred and
 *            scales up with the window; at the page turn the window is the
 *            viewport and the media exactly as wide, no extra zoom
 *   title  — the client name rides the window's left edge, its gutter away
 *   label, rule, tags — stationary: the opening window wipes over them
 *
 * The rest hint (11-03, Nathan): settled at the document end, the label
 * suggests the gesture now and then and reads `Next Project:` the rest of
 * the time. Every ?nphint s (the first after ?nphintin) the whole line
 * pulses (it dips to black and changes there to `[Keep Scrolling]`), double
 * pulses, hangs (?nphold), and pulses back. The gesture itself never changes
 * the text; it suspends the hint until the band settles again.
 *
 * The rule always runs from the label's visible left edge to the container's
 * right edge (11-03, Nathan); the window covers its far end. Both phrases
 * share one box, as wide as the longer `[Keep Scrolling]`, so the rule
 * never moves between them; the box starts at the client name's left edge
 * (11-04, Nathan), held clear of the window when the name is narrower.
 *
 * The release rubber-bands the fill itself back to 0; with no stagger left,
 * every channel comes home together.
 *
 * Commit rides the Envelopment bridge (ADR-0002), staged inside the media
 * window: the drag's blue pre-cover (f², like the globe's lean) is an
 * in-band cover layer CONFINED to the window — the page around it stays
 * clean while the gesture charges. The threshold pins the title blue,
 * promotes the window to a fixed box at its measured rect, and one
 * Turn-curve timeline finishes the choreography: the window opens fully, the
 * box grows to the full viewport, and the confined blue rises to solid —
 * the window itself becomes the envelopment. `swm:envelop` fires only for
 * the final snap window (?npcover), so the persistent RouteFill goes solid
 * UNDER the by-then fullscreen, near-solid box for the swap frame — the
 * covered guard, input swallow, 2.5s safety valve, and the arriving detail
 * page's `swm:fill-release` all ride the unchanged shell contract.
 * `swm:worldIndex` is written at commit so the breadcrumb returns /work to
 * the World you rode into.
 *
 * Reduced motion: no engine at all — the band is a plain link in its
 * resting composition (CSS default; the shifts are JS-applied).
 *
 * Knobs: ?scroll ?touchgain ?releasems ?npms ?npcover ?nppre ?npzoom ?nparm
 *        ?npinstart ?nplag ?npstep ?npbig ?nplabel
 *        ?nphint ?nphintin ?nphold ?npblink ?npbeat
 *
 * @param {Object} props
 * @param {Object} props.next - { slug, clientName, title, services, hero, index }
 */
import { useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { navigate } from 'astro:transitions/client';
import useHls from '../useHls.js';
import ServiceTag from '../ServiceTag.jsx';
import {
  SCROLL_TRIGGER_WORK_PX,
  GLIDE_MS,
  RELEASE_GLIDE_S,
  ensureHousePulse,
} from '../../../lib/motion.js';
import { TOUCH_GAIN } from '../../../lib/touchTune.js';
import { createRubberBand } from '../../../lib/rubberBand.js';
import { IMG_FORMAT, DETAIL_MAX_SECONDS, muxStream, wrapAtDetailCap } from '../imageConfig.js';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';

gsap.registerPlugin(useGSAP, CustomEase);

const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

/* — Resistance (the house accumulator constants) — */
const SCROLL_TRIGGER = PARAM('scroll', SCROLL_TRIGGER_WORK_PX); // px of wheel/touch to commit (house constant)
// Unlike / and /work (scroll-locked pages where every delta is deliberate),
// the gesture here arrives mid-flight: a wheel flick lands at the document
// end with an inertial tail still streaming deltas, which would fill — or,
// in one large boundary event, instantly commit — the band unseen. The
// wheel only arms after the page has sat at the end for this beat. A finger
// skips it (11-05, Nathan): its moves stop at the lift, so it has no tail,
// and the beat only swallowed the first quarter second of a swipe.
const NP_ARM_MS = PARAM('nparm', 250);

/* — Passage (Envelopment family defaults) — */
const NP_SECONDS = PARAM('npms', GLIDE_MS) / 1000; // commit choreography length (house glide)
// RouteFill snap window: no longer a visible t=0 ramp — the shell goes
// solid under the near-fullscreen, near-solid box just before the swap.
const NP_COVER_SECONDS = PARAM('npcover', 120) / 1000;
const NP_PRE_COVER = PARAM('nppre', 30) / 100; // in-window blue at full drag (f² curve)
// Extra media push-in over the commit, ON TOP of the window's growth to the
// viewport. 1 = none (11-12, Nathan): the media's largest size is the
// container's largest width, so at the page turn it is exactly the viewport
// wide, matching the next page's cover. ?npzoom > 1 dials a push back in.
const NP_ZOOM = PARAM('npzoom', 1);

/* — Entrance (scroll-scrubbed, band entry → document end). A cascade timed
   in units of the label's slide (1) and normalised to land at the document
   end: the label [0, 1]; the media window ?nplag behind it; the client name
   rising from just before the window lands (RISE_AT, inside its ease tail);
   the tags ?npstep after the client name. — */
// The run starts when the label's top reaches this fraction of the viewport
// height (1 = the bottom edge), so it is just in view as it sets off, clear
// of the fixed privacy pill in the bottom-right corner.
const NP_IN_START = PARAM('npinstart', 0.9);
const NP_LAG = PARAM('nplag', 0.25); // the media window behind the label
const NP_STEP = PARAM('npstep', 0.25); // the tags behind the client name
const RISE = 0.5; // each slide-up
const RISE_AT = 0.25; // the client name sets off this long before the window lands
// The label's start size × its rest size, shrinking toward its right edge
// as it slides (11-03, Nathan's "about this size" was 2.5; the 11-04 page
// turn starts it at rest size). Capped by the content width and the room
// above the label (it grows up off its rule).
const NP_BIG = PARAM('npbig', 1);
const NP_LABEL_PX = PARAM('nplabel', null); // rest label size override, px (CSS clamp otherwise)
const SLIDE_EASE = gsap.parseEase('power2.out'); // steep launch, settles into rest

// Each lane's eased 0..1 at entrance progress e. Without tags the cascade
// ends with the client name.
const cascade = (e, hasTags) => {
  const mediaEnd = NP_LAG + 1;
  const titleAt = mediaEnd - RISE_AT;
  const tagsAt = titleAt + NP_STEP;
  const t = e * Math.max(mediaEnd, (hasTags ? tagsAt : titleAt) + RISE);
  const lane = (at, dur) => SLIDE_EASE(clamp01((t - at) / dur));
  return { label: lane(0, 1), media: lane(NP_LAG, 1), title: lane(titleAt, RISE), tags: lane(tagsAt, RISE) };
};

// A masked slide-up: the element rises its own height (plus RISE_GAP) into
// its rest box, clipped at the box's foot (open above and to the sides, where
// the display face overflows its 0.78 line box). The gap keeps the waiting
// line's top edge off the mask's foot: sharing that edge, its antialiased
// row leaked a sliver of the chips' top borders (11-04, Nathan; lit 192/255
// at 1728 @2x, where the foot lands on a fractional device pixel).
const RISE_GAP = 2; // px
const rise = (p) => {
  const q = 1 - p;
  return {
    yPercent: q * 100,
    y: q * RISE_GAP,
    clipPath:
      p >= 1
        ? 'none'
        : `inset(-50% -10% calc(${(q * 100).toFixed(2)}% + ${(q * RISE_GAP).toFixed(2)}px) -10%)`,
  };
};

/* — The rest hint: a pulse (two beats) swaps the line to [Keep Scrolling],
   a double pulse (one beat each), a hang, a pulse back. A beat is an eighth
   of the house tempo (--swm-bpm, ?pulsebpm) unless ?npbeat sets one in ms. — */
const NP_HINT_IN = PARAM('nphintin', 1.5); // s settled at the end before the first hint
const NP_HINT_GAP = PARAM('nphint', 5); // s of Next Project: between hints
const NP_HINT_HOLD_MS = PARAM('nphold', null); // the hang after the double pulse, ms (unset = two beats)
const NP_BLINK = PARAM('npblink', 0.3); // double-pulse floor (the house dim floor)
const NP_BEAT_MS = PARAM('npbeat', null);
const cueBeat = () => {
  if (NP_BEAT_MS) return NP_BEAT_MS / 1000;
  const bpm = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--swm-bpm')
  );
  return 30 / (bpm > 0 ? bpm : 127);
};

/* — Media window: sizing is the COMPONENT's, not the asset's. The box is
   4:3 landscape at full open (CSS aspect-ratio, locked height) — landscape
   without over-cropping portrait assets. The entrance pushes it out to this
   rest fraction of its width; the drag pulls it open from there. — */
const REST_REVEAL = 0.57; // window reveal at rest (fraction of full width)
const GUTTER = 8; // text edge + element gap (--space-4)
const MEDIA_IMG_WIDTH = 1400;

/* — hls.js config for the band's media window — prefetch the first fragment
   alongside manifest parsing and start two rungs up the ladder (~720p on
   Mux's typical ladder); ABR adapts from there (capLevelToPlayerSize stays
   on inside useHls). maxBufferLength is a floor, not a cap; the stream
   clip (DETAIL_MAX_SECONDS, muxStream) is what bounds the download. — */
const BAND_HLS_CONFIG = {
  startFragPrefetch: true,
  startLevel: 2,
  maxBufferLength: 12,
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default function NextProjectBand({ next }) {
  const bandRef = useRef(null);
  const labelWrapRef = useRef(null);
  const labelRef = useRef(null);
  const nextTextRef = useRef(null);
  const keepRef = useRef(null);
  const ruleRef = useRef(null);
  const titleRef = useRef(null);
  const tagsRef = useRef(null);
  const mediaRef = useRef(null); // the slot: the window's full-open box (geometry reference)
  const winRef = useRef(null); // the window: the container that opens; the media fills it, centred
  const innerRef = useRef(null);
  const coverRef = useRef(null);
  const videoRef = useRef(null);

  const armAtRef = useRef(0); // deltas count only past this timestamp
  const departingRef = useRef(false);
  const proxyRef = useRef({ f: 0 }); // single fill scalar; all motion derives
  const gestureRef = useRef(null); // the house rubber band (lib/rubberBand.js), made once
  const entranceRef = useRef(1); // scroll-in progress (0 = off to the right, 1 = rest)
  const hintRef = useRef({ timer: null, tl: null }); // the rest hint's pending call + live run
  const measureRef = useRef(null); // per-layout px shifts (null until measured)

  // The accumulator + rubber band is lib/rubberBand.js's (shared with the
  // phone blurb hold). The band supplies only what it DRAWS and what a
  // commit DOES; the callbacks are looked up when they fire.
  if (!gestureRef.current) {
    gestureRef.current = createRubberBand({
      proxy: proxyRef.current,
      trigger: SCROLL_TRIGGER,
      apply: () => apply(),
      onCommit: () => commit(),
      // The drag no longer feeds the RouteFill (the pre-cover is in-band now)
      // — this zero is residual-safety only, so no stray shell opacity can
      // outlive a gesture. Other fill-progress consumers are unaffected.
      onRelease: () =>
        window.dispatchEvent(
          new CustomEvent('swm:fill-progress', { detail: { value: 0, duration: RELEASE_GLIDE_S } })
        ),
      onRest: () => syncHint(), // home again: the hint resumes
    });
  }

  const [pinned, setPinned] = useState(false);
  const [inView, setInView] = useState(false);

  const isVideo = !!next?.hero?.playbackId;
  const hlsSrc =
    isVideo && inView ? muxStream(next.hero.playbackId, DETAIL_MAX_SECONDS) : null;
  useHls(videoRef, hlsSrc, BAND_HLS_CONFIG, { videoOnly: true });

  // ── Measure the rest-state shifts (and re-measure on resize) ──
  // CSS lays everything at its END position (text at the left edge, media
  // box at full width); the engine translates text right / narrows the media window
  // back to compose the rest state. Mobile (stacked) zeroes the text shifts —
  // the media reveal + pre-cover carry the same physics there.
  const measure = () => {
    const band = bandRef.current;
    const media = mediaRef.current;
    if (!band || !media) return;
    // Never measure mid-departure: commit promotes the media box to a
    // fixed, viewport-bound rect, and a resize firing during the passage
    // would read that promoted layout as if it were the resting one.
    if (departingRef.current) return;
    const bandW = band.clientWidth;
    const stacked = window.matchMedia('(max-width: 768px)').matches;
    // The window's visible left edge at rest, off its pinned right edge.
    const restMediaLeft = media.offsetLeft + (1 - REST_REVEAL) * media.offsetWidth;
    const shiftFor = (el) =>
      stacked || !el
        ? 0
        : Math.max(0, restMediaLeft - GUTTER - el.offsetWidth - GUTTER);
    // Entrance geometry, in the text block's coordinates (gutter-relative).
    // The wrap carries only the gesture's x, so its box is the label's
    // unscaled layout box (as wide as `[Keep Scrolling]`).
    const wrap = labelWrapRef.current;
    const contentW = bandW - 2 * GUTTER;
    const labelW = wrap?.offsetWidth || 1;
    const labelH = wrap?.offsetHeight || 1;
    const bandTop = band.getBoundingClientRect().top;
    const labelBottom = wrap ? wrap.getBoundingClientRect().bottom - bandTop : labelH;
    // Stacked, the window sits above the text, so the label grows up to it.
    const ceiling = stacked ? media.getBoundingClientRect().bottom - bandTop : 0;
    const bigScale = Math.max(
      1,
      Math.min(NP_BIG, contentW / labelW, (labelBottom - ceiling - 2 * GUTTER) / labelH)
    );
    // The label (and so its rule) starts at the client name's left edge
    // (11-04, Nathan), held clear of the window when the name is narrower
    // than the label.
    const title = titleRef.current;
    const titleShift = shiftFor(title);
    const labelShift =
      wrap && title
        ? Math.max(0, Math.min(shiftFor(wrap), title.offsetLeft + titleShift - wrap.offsetLeft))
        : 0;
    measureRef.current = {
      bandW,
      stacked,
      mediaW: media.offsetWidth,
      labelShift,
      titleShift,
      tagsShift: shiftFor(tagsRef.current),
      ruleBase: ruleRef.current?.offsetWidth || 1,
      contentW,
      labelW,
      bigScale,
      hasTags: !!tagsRef.current,
    };
  };

  // ── Entrance progress from the live scroll: 0 with the label's top at
  // ?npinstart of the viewport, 1 at the document end (where the gesture
  // arms). Keyed to the label, not the band, because phones stack the
  // window above it. ──
  const readEntrance = () => {
    const wrap = labelWrapRef.current;
    if (!wrap) return 1;
    const vh = window.innerHeight;
    const y = window.scrollY;
    const start = wrap.getBoundingClientRect().top + y - vh * NP_IN_START;
    const end = document.documentElement.scrollHeight - vh;
    if (end - y <= 2 || end <= start) return 1; // atEnd()'s tolerance
    return clamp01((y - start) / (end - start));
  };

  // ── Every animated element's target values at a given fill ──
  const targetsAt = (f) => {
    const m = measureRef.current;
    if (!m) return null;
    const c = cascade(entranceRef.current, m.hasTags);
    // The window: pushed out to its rest reveal by the entrance, then
    // opened the rest of the way by the fill; the client name rides its
    // left edge (stacked: the window sits above the text, so the name holds).
    const labelX = m.labelShift;
    const opened = m.stacked ? 0 : m.mediaW * f * (1 - REST_REVEAL);
    const reveal = REST_REVEAL * c.media + (1 - REST_REVEAL) * f;
    const t = {
      labelX,
      titleX: m.titleShift - opened,
      tagsX: m.tagsShift,
      win: `${(reveal * 100).toFixed(3)}%`,
      // In-window pre-cover: same f² curve + ?nppre knob the RouteFill
      // pre-cover rode, now confined to the media window.
      cover: NP_PRE_COVER * f * f,
      // The label comes in from the content's right edge to its rest seat,
      // shrinking toward its right edge (geometric, so the shrink reads at
      // one rate) when ?npbig starts it larger.
      inX: (m.contentW - labelX - m.labelW) * (1 - c.label),
      inScale: Math.pow(m.bigScale, 1 - c.label),
      titleRise: c.title,
      tagsRise: c.tags,
    };
    // Rule: the label's visible left edge → the container's right edge.
    t.ruleX = labelX + t.inX + m.labelW * (1 - t.inScale);
    t.ruleScale = Math.max(0, m.contentW - t.ruleX) / m.ruleBase;
    return t;
  };

  // ── Compose everything from the fill scalar and the entrance (drag,
  // release, commit and scroll all write through here) ──
  const apply = () => {
    const t = targetsAt(proxyRef.current.f);
    if (!t) return;
    gsap.set(labelWrapRef.current, { x: t.labelX });
    gsap.set(labelRef.current, { x: t.inX, scale: t.inScale });
    gsap.set(titleRef.current, { x: t.titleX, ...rise(t.titleRise) });
    if (tagsRef.current) gsap.set(tagsRef.current, { x: t.tagsX, ...rise(t.tagsRise) });
    // The window's real width (a % of the slot), right edge pinned: the media
    // fills it, cover-fit and centred, so it stays centred as the window
    // opens. During departure the commit timeline owns the window's box.
    if (!departingRef.current) gsap.set(winRef.current, { width: t.win });
    gsap.set(ruleRef.current, { x: t.ruleX, scaleX: t.ruleScale });
    // During departure the commit timeline owns the cover (raising it to
    // solid on the Turn curve); apply() only tracks the drag's f² curve.
    if (!departingRef.current) gsap.set(coverRef.current, { opacity: t.cover });
  };

  // ── The rest hint: settled at the document end, `Next Project:` now and
  // then pulses over to `[Keep Scrolling]` and back — the whole line at
  // once, swapped at the bottom of a pulse. Both texts live in the label,
  // so its opacity carries every pulse. Anything that unsettles the band (a
  // gesture, scrolling away, the commit) drops the pending hint; one already
  // playing plays out. ──
  const settled = () =>
    !departingRef.current &&
    gestureRef.current.accum === 0 &&
    proxyRef.current.f < 1e-3 &&
    entranceRef.current >= 1;

  const armHint = (delay) => {
    const h = hintRef.current;
    h.timer?.kill();
    h.timer = gsap.delayedCall(delay, playHint);
  };

  const syncHint = () => {
    const h = hintRef.current;
    if (!settled()) {
      h.timer?.kill();
      h.timer = null;
    } else if (!h.timer && !h.tl) {
      armHint(NP_HINT_IN);
    }
  };

  const killHint = () => {
    const h = hintRef.current;
    h.timer?.kill();
    h.timer = null;
    h.tl?.kill();
    h.tl = null;
  };

  const playHint = () => {
    const h = hintRef.current;
    h.timer = null;
    if (!settled()) return; // syncHint re-arms once the band settles again
    if (document.querySelector('.project-overlay')?.dataset.open === 'true') {
      armHint(NP_HINT_GAP); // nobody's looking — skip this one
      return;
    }
    const label = labelRef.current;
    const nextEl = nextTextRef.current;
    const keepEl = keepRef.current;
    if (!label || !nextEl || !keepEl) return;
    const beat = cueBeat();
    const envelope = ensureHousePulse();
    // Both phrases share the label's box, so the swap is visibility alone.
    const show = (keep) => () => {
      nextEl.style.visibility = keep ? 'hidden' : 'visible';
      keepEl.style.visibility = keep ? 'visible' : 'hidden';
    };
    // A swap pulse: two beats, split like the house envelope (down 45%, the
    // change at black, up 55%).
    const swapPulse = (tl, keep, at) =>
      tl
        .to(label, { opacity: 0, duration: 0.9 * beat, ease: 'power2.in' }, at)
        .call(show(keep))
        .to(label, { opacity: 1, duration: 1.1 * beat, ease: 'power2.out' });
    const hold = NP_HINT_HOLD_MS != null ? NP_HINT_HOLD_MS / 1000 : 2 * beat;
    const tl = gsap.timeline({
      onComplete: () => {
        h.tl = null;
        gsap.set(label, { clearProps: 'opacity' });
        if (settled()) armHint(NP_HINT_GAP);
      },
    });
    swapPulse(tl, true);
    tl.to(label, { opacity: NP_BLINK, duration: beat, ease: envelope }).to(label, {
      opacity: NP_BLINK,
      duration: beat,
      ease: envelope,
    });
    swapPulse(tl, false, `+=${hold}`); // hang on the second pulse, then back
    h.tl = tl;
  };

  // ── Snap-back: the fill springs home on /work's release lane, and every
  // channel follows it through apply(). (11-03: the old per-element return
  // tweened the media's clip-path STRING, which GSAP held at its start and
  // swapped at the end — the window jumped shut while the text glided.) A
  // resumed drag or a commit takes over the proxy mid-return. ──
  const releaseToRest = () => gestureRef.current.release();

  // ── Commit: the media window becomes the envelopment — promoted to a
  // fixed box at its measured rect, it grows to the full viewport while its
  // confined blue rises to solid, all on the Turn curve. Continues from
  // wherever the drag left off; navigate() fires at arrival. ──
  const commit = () => {
    if (departingRef.current) return;
    departingRef.current = true;
    gestureRef.current.clearIdle();
    try {
      sessionStorage.setItem('swm:worldIndex', String(next.index));
    } catch {
      /* storage unavailable */
    }

    if (PREFERS_REDUCED_MOTION) {
      navigate(`/work/${next.slug}`);
      return;
    }

    setPinned(true); // title/rule flash blue, held through the passage
    gsap.killTweensOf(proxyRef.current); // take over from a mid-flight return

    // Promote the ORIGINAL window node (a clone would restart HLS) to a
    // fixed box at its exact on-screen rect — the container as it is now,
    // media centred in it. z-index 90 (on the slot, whose stacking context
    // holds it) keeps it under the z-100 site shell — the nav rides above
    // the passage, as it always has. The slot stays in the flow, so the
    // band keeps its height and the end-of-document scroll position holds.
    const media = winRef.current;
    const rect = media.getBoundingClientRect();
    gsap.set(mediaRef.current, { zIndex: 90 });
    gsap.set(media, {
      position: 'fixed',
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: 'auto',
      bottom: 'auto',
    });

    const ease = CustomEase.create('swmNextBand', TURN_EASE_PATH);
    const tl = gsap.timeline({ onComplete: () => navigate(`/work/${next.slug}`) });
    // Finish the drag choreography — text completes its run to the left
    // edge, the media window opens fully off its pinned edge.
    tl.to(proxyRef.current, {
      f: 1,
      duration: NP_SECONDS,
      ease,
      overwrite: 'auto',
      onUpdate: apply,
    }, 0);
    // The box grows from its band rect to the full viewport …
    tl.to(
      media,
      { top: 0, left: 0, width: '100vw', height: '100vh', duration: NP_SECONDS, ease },
      0
    );
    // … its confined blue rises to solid (the window IS the envelopment) …
    tl.to(coverRef.current, { opacity: 1, duration: NP_SECONDS, ease }, 0);
    // … while the subject pushes in. The growing box supplies the travel
    // now, so this is a breath on top — not the old full-frame zoom.
    tl.to(innerRef.current, { scale: NP_ZOOM, duration: NP_SECONDS, ease }, 0);
    // Snap the persistent RouteFill solid UNDER the by-then fullscreen,
    // near-solid box for the swap frame — keeps the covered guard, input
    // swallow, 2.5s safety valve, and the arriving page's fill-release
    // handshake with zero changes to the shell.
    tl.add(() => {
      window.dispatchEvent(
        // S2: the enter fill ingests the next project's accent (blank → blue).
        new CustomEvent('swm:envelop', {
          detail: { duration: NP_COVER_SECONDS, color: next.color },
        })
      );
    }, Math.max(0, NP_SECONDS - NP_COVER_SECONDS));
  };

  // ── Rest-state composition + resize handling (pre-paint, no flash) ──
  useGSAP(
    () => {
      if (PREFERS_REDUCED_MOTION) return undefined; // CSS resting layout, plain link
      // Set here, not in render: the param is client-only, and a style the
      // SSR markup lacks would be a hydration mismatch.
      if (NP_LABEL_PX) bandRef.current?.style.setProperty('--np-label-size', `${NP_LABEL_PX}px`);
      const onResize = () => {
        measure();
        entranceRef.current = readEntrance();
        apply();
        syncHint();
      };
      onResize();
      const onScroll = () => {
        if (departingRef.current) return;
        const e = readEntrance();
        if (Math.abs(e - entranceRef.current) < 1e-4) return;
        entranceRef.current = e;
        apply();
        syncHint(); // settling at the end arms the hint; leaving drops it
      };
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onScroll, { passive: true });
      // The display face changes the title's width when it lands — the
      // rest-state shifts are only right once fonts are in.
      document.fonts?.ready.then(onResize).catch(() => {});
      return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onScroll);
      };
    },
    { scope: bandRef }
  );

  // ── The accumulator (Hero's engine, gated to the document end) ──
  useEffect(() => {
    if (PREFERS_REDUCED_MOTION) return undefined;

    const atEnd = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2;

    const addDelta = (dy, wheel = false) => {
      if (departingRef.current) return;
      // The inquiry overlay owns the screen — never arm under it.
      if (document.querySelector('.project-overlay')?.dataset.open === 'true') return;
      const g = gestureRef.current;
      // Engage only at the document's end; retreating drains the fill while
      // the page scrolls away, so the rubber-band plays as you leave.
      if (g.accum === 0) {
        if (!atEnd() || dy <= 0) {
          armAtRef.current = 0;
          return;
        }
        // A wheel's first delta at the end opens the arming window; deltas
        // inside it (the flick's inertial tail) are dropped, deliberate ones
        // count. A finger counts from its first move.
        if (wheel) {
          const now = performance.now();
          if (!armAtRef.current) {
            armAtRef.current = now + NP_ARM_MS;
            return;
          }
          if (now < armAtRef.current) return;
        }
      }
      // A wheel has no lift, so its let-go is a stall below the threshold;
      // a finger holds it until the lift.
      g.push(dy, { stall: wheel });
      syncHint(); // a live gesture suspends the rest hint (the text never changes for it)
    };

    const onWheel = (e) => addDelta(e.deltaY, true);
    let touchY = null;
    const onTouchStart = (e) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e) => {
      if (touchY === null) return;
      const y = e.touches[0]?.clientY ?? touchY;
      addDelta((touchY - y) * TOUCH_GAIN); // upward swipe = onward (the house gain)
      touchY = y;
    };
    // The lift is a finger's let-go (/work's, 11-03): below the threshold
    // the fill springs home now.
    const onTouchEnd = () => {
      touchY = null;
      if (departingRef.current || gestureRef.current.accum === 0) return;
      releaseToRest();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
    return () => {
      gestureRef.current.clearIdle();
      // The hint re-arms itself — it must not outlive the band.
      killHint();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lazy media: HLS attaches near the viewport, pauses off-screen ──
  useEffect(() => {
    const band = bandRef.current;
    if (!band) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (!entry.isIntersecting) videoRef.current?.pause();
        // 08-30 (2), Nathan: the label's scramble announcement retired —
        // the chip-typography label just displays in full.
      },
      { rootMargin: '200px', threshold: 0.05 }
    );
    io.observe(band);
    return () => io.disconnect();
  }, []);

  if (!next) return null;

  // time=0: the band video starts at frame 0, so the frame-0 poster is the
  // aligned one — no poster→playback jump.
  const posterUrl = isVideo
    ? `https://image.mux.com/${next.hero.playbackId}/thumbnail.webp?width=${MEDIA_IMG_WIDTH}&fit_mode=preserve&time=0`
    : null;

  const onClick = (e) => {
    if (PREFERS_REDUCED_MOTION) return; // plain ClientRouter navigation
    e.preventDefault();
    commit();
  };

  return (
    <a
      href={`/work/${next.slug}`}
      className={`np-band${pinned ? ' is-pinned' : ''}`}
      ref={bandRef}
      // S2: the next project's accent palette drives the pinned title/rule and
      // the in-window cover (blank → brand blue). gsap.set(height/…) at commit
      // writes other inline props and leaves these custom properties intact.
      style={{
        '--project-color': next.color || undefined,
        '--project-color-2': next.colorSecondary || undefined,
      }}
      onClick={onClick}
      aria-label={`Next project: ${next.clientName} — ${next.title}`}
    >
      <div className="np-band__text">
        <div className="np-band__label-wrap" ref={labelWrapRef}>
          {/* 11-03, Nathan: title case in the bold sans (was the chip voice). */}
          <span className="np-band__label" ref={labelRef}>
            <span ref={nextTextRef}>Next Project:</span>
            {/* 11-03, Nathan: the rest hint, shown now and then at the end. */}
            <span className="np-band__keep" ref={keepRef} aria-hidden="true">
              [Keep Scrolling]
            </span>
          </span>
        </div>
        <span className="np-band__rule" ref={ruleRef} aria-hidden="true" />
        <h2 className="np-band__title" ref={titleRef}>
          {next.clientName}
        </h2>
        {next.services?.length > 0 && (
          <div className="np-band__tags" ref={tagsRef}>
            {next.services.map((s) => (
              <ServiceTag key={s.slug} name={s.name} />
            ))}
          </div>
        )}
      </div>

      <div className="np-band__media" ref={mediaRef}>
        <div className="np-band__window" ref={winRef}>
          <div className="np-band__media-inner" ref={innerRef}>
            {isVideo ? (
              <video
                ref={videoRef}
                className="np-band__media-el"
                poster={posterUrl}
                muted
                autoPlay
                loop
                playsInline
                onTimeUpdate={wrapAtDetailCap}
              />
            ) : next.hero?.imageUrl ? (
              <img
                className="np-band__media-el"
                src={`${next.hero.imageUrl}?w=${MEDIA_IMG_WIDTH}&${IMG_FORMAT}`}
                alt=""
                loading="lazy"
              />
            ) : (
              <div className="np-band__media-el" aria-hidden="true" />
            )}
          </div>
          <div className="np-band__cover" ref={coverRef} aria-hidden="true" />
        </div>
      </div>
    </a>
  );
}
