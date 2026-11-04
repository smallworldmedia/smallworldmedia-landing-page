/**
 * NextProjectBand — the detail-page continuation card (/work/[slug] bottom).
 *
 * Populated with the next Featured Project's identity + first-order media
 * asset (chain order == the /work World order, wrapping last → first).
 *
 * Entrance (11-03, Nathan): a sticky scroll. The band sits at the foot of a
 * taller runway (?nprun viewport heights more than the band) and pins at its
 * end composition, holding still across that extra height while the scroll
 * scrubs the label home; the run ends at the document end, where the gesture
 * arms. The `Next Project:` label rises into view at ?npbig × its rest size
 * (it grows up from its rule, so the title below never moves), scales down
 * over the first ?npinsplit of the run, then slides to its rest seat above
 * the client name. It starts (?npfrom) centred on the viewport (`center`,
 * default) or at the left gutter (`left`). The rule rides under the label's
 * visible extent the whole way.
 *
 * Past the entrance, the band is driven by the site's one resistance interaction: the wheel/touch
 * accumulator from /work's [NEXT]/[PREVIOUS] and the home scroll_to_enter
 * (same ?scroll trigger, and the house RELEASE_MS stall → rubber-band and
 * TOUCH_GAIN, live as ?releasems / ?touchgain via lib/touchTune.js).
 *
 * The gesture engages only at the document's end. The fill drives the media
 * and the client name together, from the first delta (11-03, Nathan — no
 * stagger; the Figma states 15:385/401/417 ran a staggered text exit):
 *
 *   media  — a fixed WINDOW (component-defined 4:3 landscape at full open,
 *            locked height; the media best-fits it via object-fit regardless
 *            of the asset's own ratio) that the scroll pulls open leftward
 *            off its pinned right edge — a clip reveal, never a scale
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
 * right edge (11-03, Nathan); the window covers its far end. The hint is
 * wider than the label, so it carries the rule's left end out while it shows.
 *
 * Stalling rubber-bands the fill itself back to 0 on the release curve; with
 * no stagger left, every channel comes home together.
 *
 * Commit rides the Envelopment bridge (ADR-0002), staged inside the media
 * window: the drag's blue pre-cover (f², like the globe's lean) is an
 * in-band cover layer CONFINED to the window — the page around it stays
 * clean while the gesture charges. The threshold pins the title blue,
 * promotes the window to a fixed box at its measured rect, and one
 * Turn-curve timeline finishes the choreography: the clip opens fully, the
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
 *        ?npbig ?npfrom ?nprun ?npinsplit ?nplabel
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
import { SCROLL_TRIGGER_WORK_PX, GLIDE_MS, ensureHousePulse } from '../../../lib/motion.js';
import { TOUCH_GAIN, RELEASE_MS } from '../../../lib/touchTune.js';
import { IMG_FORMAT, DETAIL_MAX_SECONDS, muxStream, wrapAtDetailCap } from '../imageConfig.js';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';

gsap.registerPlugin(useGSAP, CustomEase);

const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};
const str = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  return new URLSearchParams(window.location.search).get(key) || fallback;
};

/* — Resistance (the house accumulator constants) — */
const SCROLL_TRIGGER = PARAM('scroll', SCROLL_TRIGGER_WORK_PX); // px of wheel/touch to commit (house constant)
// Unlike / and /work (scroll-locked pages where every delta is deliberate),
// the gesture here arrives mid-flight: a flick lands at the document end
// with an inertial tail still streaming deltas, which would fill — or, in
// one large boundary event, instantly commit — the band unseen. The
// accumulator only arms after the page has sat at the end for this beat.
const NP_ARM_MS = PARAM('nparm', 250);

/* — Passage (Envelopment family defaults) — */
const NP_SECONDS = PARAM('npms', GLIDE_MS) / 1000; // commit choreography length (house glide)
// RouteFill snap window: no longer a visible t=0 ramp — the shell goes
// solid under the near-fullscreen, near-solid box just before the swap.
const NP_COVER_SECONDS = PARAM('npcover', 120) / 1000;
const NP_PRE_COVER = PARAM('nppre', 30) / 100; // in-window blue at full drag (f² curve)
// Media push-in over the commit. The box itself now grows to the viewport,
// so this rides ON TOP of that growth — the old 1.35 default double-zooms.
// Keep it a breath (?npzoom still overrides for dialing).
const NP_ZOOM = PARAM('npzoom', 1.08);

/* — Entrance (a sticky scroll: scrubbed across the band's pinned stretch) — */
// The label's start size as a multiple of its rest size (11-03, Nathan's
// "about this size": 0.645 of the HEAVY HOUSE SOCIETY title's width, which
// is 2.5× anywhere both type clamps scale with the viewport). Capped so it
// never clips at the band's top (it grows upward from its rule), never runs
// under the media window, and never outgrows the content.
const NP_BIG = PARAM('npbig', 2.5);
// Where it starts (11-03, Nathan's alternate): 'center' (on the viewport) or
// 'left' (at the left gutter). Either way it scales down, then slides home.
const NP_FROM = str('npfrom', 'center');
// The run, in viewport heights: the runway's extra height over the band,
// the stretch the band holds pinned while the label comes home (11-03,
// Nathan: the old run, band entry → document end, was about half a screen,
// and a quick scroll rushed it). Unset = the CSS default (--np-run).
const NP_RUN = PARAM('nprun', null);
const NP_IN_SPLIT = PARAM('npinsplit', 0.5); // share of the run spent scaling; the slide takes the rest
const NP_LABEL_PX = PARAM('nplabel', null); // rest label size override, px (CSS clamp otherwise)
const SLIDE_EASE = gsap.parseEase('power2.out'); // steep launch off the scale, settles at the end

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
   without over-cropping portrait assets — and the drag pulls it open from
   this rest fraction of its width. — */
const REST_REVEAL = 0.57; // window reveal at rest (fraction of full width)
const CLIP_MAX = (1 - REST_REVEAL) * 100; // clip-path inset % at rest
const GUTTER = 8; // page edge + element gap (--space-4)
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
  const runwayRef = useRef(null);
  const bandRef = useRef(null);
  const labelWrapRef = useRef(null);
  const labelRef = useRef(null);
  const nextTextRef = useRef(null);
  const keepRef = useRef(null);
  const ruleRef = useRef(null);
  const titleRef = useRef(null);
  const tagsRef = useRef(null);
  const mediaRef = useRef(null);
  const innerRef = useRef(null);
  const coverRef = useRef(null);
  const videoRef = useRef(null);

  const accumRef = useRef(0);
  const armAtRef = useRef(0); // deltas count only past this timestamp
  const idleRef = useRef(null);
  const departingRef = useRef(false);
  const proxyRef = useRef({ f: 0 }); // single fill scalar; all motion derives
  const entranceRef = useRef(1); // scroll-in progress (0 = big + centred, 1 = rest)
  const swapRef = useRef({ k: 0 }); // hint handover (0 = Next Project:, 1 = [Keep Scrolling])
  const hintRef = useRef({ timer: null, tl: null }); // the rest hint's pending call + live run
  const measureRef = useRef(null); // per-layout px shifts (null until measured)
  const pinRef = useRef(-1); // the band's sticky `bottom` as last written, px

  const [pinned, setPinned] = useState(false);
  const [inView, setInView] = useState(false);

  const isVideo = !!next?.hero?.playbackId;
  const hlsSrc =
    isVideo && inView ? muxStream(next.hero.playbackId, DETAIL_MAX_SECONDS) : null;
  useHls(videoRef, hlsSrc, BAND_HLS_CONFIG, { videoOnly: true });

  // ── Measure the rest-state shifts (and re-measure on resize) ──
  // CSS lays everything at its END position (text at the left edge, media
  // box at full width); the engine translates text right / clips the media
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
    const restMediaLeft = bandW - GUTTER - REST_REVEAL * media.offsetWidth;
    const shiftFor = (el) =>
      stacked || !el
        ? 0
        : Math.max(0, restMediaLeft - GUTTER - el.offsetWidth - GUTTER);
    // Entrance geometry, in the text block's coordinates (gutter-relative).
    // The wrap carries only the gesture's x, so its box is the label's
    // unscaled layout box.
    const wrap = labelWrapRef.current;
    const contentW = bandW - 2 * GUTTER;
    const labelW = wrap?.offsetWidth || 1;
    const labelH = wrap?.offsetHeight || 1;
    const labelBottom = wrap
      ? wrap.getBoundingClientRect().bottom - band.getBoundingClientRect().top
      : labelH;
    const bigScale = Math.max(
      1,
      Math.min(
        NP_BIG,
        contentW / labelW,
        (labelBottom - 2 * GUTTER) / labelH, // headroom under the band's top
        // Clear of the media window, from where the label starts.
        stacked
          ? Infinity
          : NP_FROM === 'left'
            ? (restMediaLeft - 2 * GUTTER) / labelW
            : (2 * (restMediaLeft - 2 * GUTTER - contentW / 2)) / labelW
      )
    );
    measureRef.current = {
      bandW,
      stacked,
      mediaW: media.offsetWidth,
      labelShift: shiftFor(wrap),
      titleShift: shiftFor(titleRef.current),
      tagsShift: shiftFor(tagsRef.current),
      ruleBase: ruleRef.current?.offsetWidth || 1,
      contentW,
      labelW,
      centerLeft: (contentW - labelW) / 2,
      bigScale,
      // How far the cue's left edge sits past the label's (desktop: they
      // share the right edge; stacked: the left).
      keepEdge: stacked ? 0 : Math.max(0, (keepRef.current?.offsetWidth || 0) - labelW),
    };
  };

  // ── The sticky pin: the band's bottom on the document's tail (whatever
  // follows the runway — the footer's reveal room), which is exactly where
  // it sits at the document end, so it holds its end composition across the
  // runway's extra height. Re-read on every scroll: the footer sizes that
  // room after this mounts, and again on its own resize. ──
  const pin = () => {
    const runway = runwayRef.current;
    const band = bandRef.current;
    if (!runway || !band) return;
    const doc = document.documentElement.scrollHeight;
    const tail = Math.max(0, doc - (runway.getBoundingClientRect().bottom + window.scrollY));
    if (Math.abs(tail - pinRef.current) < 0.5) return;
    pinRef.current = tail;
    band.style.bottom = `${tail}px`;
  };

  // ── Entrance progress from the live scroll: 0 as the band pins, 1 at the
  // document end (where the gesture arms). The pinned stretch is the
  // runway's extra height, the last `run` px of the page. ──
  const readEntrance = () => {
    const runway = runwayRef.current;
    const band = bandRef.current;
    if (!runway || !band) return 1;
    const toEnd =
      document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    const run = runway.offsetHeight - band.offsetHeight;
    if (toEnd <= 2 || run <= 0) return 1; // atEnd()'s tolerance
    return clamp01(1 - toEnd / run);
  };

  // ── Every animated element's target values at a given fill ──
  const targetsAt = (f) => {
    const m = measureRef.current;
    if (!m) return null;
    // The window opens over the whole fill; the client name rides its left
    // edge (stacked: the window sits below the text, so the name holds).
    const labelX = m.labelShift;
    const opened = m.stacked ? 0 : m.mediaW * f * (1 - REST_REVEAL);
    const t = {
      labelX,
      titleX: m.titleShift - opened,
      tagsX: m.tagsShift,
      clip: `inset(0% 0% 0% ${(CLIP_MAX * (1 - f)).toFixed(2)}%)`,
      // In-window pre-cover: same f² curve + ?nppre knob the RouteFill
      // pre-cover rode, now confined to the media window.
      cover: NP_PRE_COVER * f * f,
    };

    // Entrance: the label shrinks about its bottom-centre (geometric, so the
    // shrink reads at one rate), then slides to its rest seat. Centre holds
    // its centre on the viewport's through the shrink; left holds its
    // visible left edge on the gutter.
    const e = entranceRef.current;
    const slideP = SLIDE_EASE(clamp01((e - NP_IN_SPLIT) / (1 - NP_IN_SPLIT)));
    t.inScale = Math.pow(m.bigScale, 1 - clamp01(e / NP_IN_SPLIT));
    t.inX =
      NP_FROM === 'left'
        ? -m.labelShift * (1 - slideP) - (m.labelW * (1 - t.inScale)) / 2
        : (m.centerLeft - m.labelShift) * (1 - slideP);

    // Rule: the label's visible left edge → the container's right edge. The
    // label scales about its bottom-centre; the cue handover (k) carries the
    // edge out by keepEdge.
    const half = m.labelW / 2;
    t.ruleX = labelX + t.inX + half - (half + m.keepEdge * swapRef.current.k) * t.inScale;
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
    gsap.set(titleRef.current, { x: t.titleX });
    gsap.set(tagsRef.current, { x: t.tagsX });
    gsap.set(mediaRef.current, { clipPath: t.clip });
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
    accumRef.current === 0 &&
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
    const show = (keep) => () => {
      nextEl.style.visibility = keep ? 'hidden' : 'visible';
      keepEl.style.visibility = keep ? 'visible' : 'hidden';
      // The rule's left end follows the text that's rising.
      gsap.to(swapRef.current, {
        k: keep ? 1 : 0,
        duration: 1.1 * beat,
        ease: 'expo.out',
        overwrite: 'auto',
        onUpdate: apply,
      });
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

  // ── Snap-back: the fill returns to 0 on the release curve, and every
  // channel follows it through apply(). (11-03: the old per-element return
  // tweened the media's clip-path STRING, which GSAP held at its start and
  // swapped at the end — the window jumped shut while the text glided.) A
  // resumed drag or a commit takes over the proxy mid-return. ──
  const releaseToRest = () => {
    accumRef.current = 0;
    gsap.to(proxyRef.current, {
      f: 0,
      duration: 0.4,
      ease: 'expo.out',
      overwrite: 'auto',
      onUpdate: apply,
      onComplete: syncHint, // home again: the hint resumes
    });
    // The drag no longer feeds the RouteFill (the pre-cover is in-band now)
    // — this zero is residual-safety only, so no stray shell opacity can
    // outlive a gesture. Other fill-progress consumers are unaffected.
    window.dispatchEvent(
      new CustomEvent('swm:fill-progress', { detail: { value: 0, duration: 0.4 } })
    );
  };

  // ── Commit: the media window becomes the envelopment — promoted to a
  // fixed box at its measured rect, it grows to the full viewport while its
  // confined blue rises to solid, all on the Turn curve. Continues from
  // wherever the drag left off; navigate() fires at arrival. ──
  const commit = () => {
    if (departingRef.current) return;
    departingRef.current = true;
    clearTimeout(idleRef.current);
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

    // Promote the ORIGINAL media node (a clone would restart HLS) to a
    // fixed box at its exact on-screen rect. z-index 90 keeps it under the
    // z-100 site shell — the nav rides above the passage, as it always
    // has. The band's height is frozen first so the box leaving the flow
    // (mobile's static stacking) can't collapse the band and jolt the
    // end-of-document scroll position. Margins are zeroed for the same
    // reason: fixed + top must place the border box AT the rect (mobile's
    // margin-top would otherwise push it below its measurement). The band
    // takes the box's layer too: sticky makes it a stacking context, so the
    // box's z 90 counts only inside it (the z-40 footer would paint over the
    // grown window).
    const media = mediaRef.current;
    const rect = media.getBoundingClientRect();
    gsap.set(bandRef.current, { height: bandRef.current.offsetHeight, zIndex: 90 });
    gsap.set(media, {
      position: 'fixed',
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: 'auto',
      margin: 0,
      aspectRatio: 'auto',
      zIndex: 90,
    });

    const ease = CustomEase.create('swmNextBand', TURN_EASE_PATH);
    const tl = gsap.timeline({ onComplete: () => navigate(`/work/${next.slug}`) });
    // Finish the drag choreography — text completes its run to the left
    // edge, the clip window opens fully off its pinned edge.
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
      if (NP_RUN != null) runwayRef.current?.style.setProperty('--np-run', String(NP_RUN));
      const onResize = () => {
        measure();
        pin();
        entranceRef.current = readEntrance();
        apply();
        syncHint();
        requestAnimationFrame(pin); // after the footer has re-sized its room
      };
      onResize();
      const onScroll = () => {
        if (departingRef.current) return;
        pin();
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

    const clearIdle = () => {
      clearTimeout(idleRef.current);
      idleRef.current = null;
    };

    const atEnd = () =>
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 2;

    const dragTo = (f) => {
      // overwrite: 'auto' takes the proxy over from a mid-flight return.
      // The blue pre-cover rides apply() now — confined to the media
      // window's cover layer, not dispatched to the full-viewport shell.
      gsap.to(proxyRef.current, {
        f,
        duration: 0.25,
        ease: 'power3.out',
        overwrite: 'auto',
        onUpdate: apply,
      });
    };

    // Stalled below the threshold → the unified snap-back.
    const scheduleRelease = () => {
      clearIdle();
      idleRef.current = setTimeout(releaseToRest, RELEASE_MS);
    };

    const addDelta = (dy) => {
      if (departingRef.current) return;
      // The inquiry overlay owns the screen — never arm under it.
      if (document.querySelector('.project-overlay')?.dataset.open === 'true') return;
      // Engage only at the document's end; retreating drains the fill while
      // the page scrolls away, so the rubber-band plays as you leave.
      if (accumRef.current === 0) {
        if (!atEnd() || dy <= 0) {
          armAtRef.current = 0;
          return;
        }
        // First delta at the end opens the arming window; deltas inside it
        // (the flick's inertial tail) are dropped, deliberate ones count.
        const now = performance.now();
        if (!armAtRef.current) {
          armAtRef.current = now + NP_ARM_MS;
          return;
        }
        if (now < armAtRef.current) return;
      }
      const a = Math.max(0, accumRef.current + dy);
      accumRef.current = a;
      syncHint(); // a live gesture suspends the rest hint (the text never changes for it)

      if (a >= SCROLL_TRIGGER) {
        clearIdle();
        commit();
      } else {
        dragTo(a / SCROLL_TRIGGER);
        scheduleRelease();
      }
    };

    const onWheel = (e) => addDelta(e.deltaY);
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
    const onTouchEnd = () => {
      touchY = null;
      if (!departingRef.current && accumRef.current > 0) scheduleRelease();
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      clearIdle();
      // The hint re-arms itself — it must not outlive the band.
      killHint();
      gsap.killTweensOf(swapRef.current);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
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

  // The runway (11-03, Nathan): the extra scroll height the band holds
  // pinned across while the entrance plays.
  return (
    <div className="np-runway" ref={runwayRef}>
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
      </a>
    </div>
  );
}
