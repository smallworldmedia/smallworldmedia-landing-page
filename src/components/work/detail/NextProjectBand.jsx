/**
 * NextProjectBand — the detail-page continuation card (/work/[slug] bottom).
 *
 * Populated with the next Featured Project's identity + first-order media
 * asset (chain order == the /work World order, wrapping last → first), and
 * driven by the site's one resistance interaction: the wheel/touch
 * accumulator from /work's [NEXT]/[PREVIOUS] and the home scroll_to_enter
 * (same ?scroll=600 trigger, 160ms stall → rubber-band, ×2 touch gain).
 *
 * The gesture engages only at the document's end. The fill drives three
 * staggered ramps (Figma: "next project card" states 15:385/401/417):
 *
 *   label  — `next project:` + rule translate from media-adjacent to the
 *            left page edge (completes at ?npsplit of the fill)
 *   title  — client name + tag chips follow on the same run, ?nplag later
 *   media  — a fixed WINDOW (component-defined 4:3 landscape at full open,
 *            locked height; the media best-fits it via object-fit regardless
 *            of the asset's own ratio) that the scroll pulls open leftward
 *            off its pinned right edge — a clip reveal, never a scale
 *
 * The rule is the connective tissue: it always spans label-left → media-left,
 * stretching as the label departs and compressing as the window opens.
 *
 * Stalling rubber-bands everything back TOGETHER — one unified return on the
 * release curve (direct-to-rest tweens), not the staggered mapping in reverse.
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
 * Knobs: ?scroll ?npms ?npcover ?nppre ?npsplit ?nplag ?npzoom ?nparm
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
import { SCROLL_TRIGGER_WORK_PX, GLIDE_MS } from '../../../lib/motion.js';
import { IMG_FORMAT } from '../imageConfig.js';
import { TURN_EASE_PATH, PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';

gsap.registerPlugin(useGSAP, CustomEase);

const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

/* — Resistance (the house accumulator constants) — */
const SCROLL_TRIGGER = PARAM('scroll', SCROLL_TRIGGER_WORK_PX); // px of wheel/touch to commit (house constant)
const STALL_MS = 160; // scroll stalled this long → rubber-band back
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

/* — Stagger ramps (fractions of the fill) — */
const NP_SPLIT = PARAM('npsplit', 0.55); // label run length; title reuses it
const NP_LAG = PARAM('nplag', 0.15); // title starts here; media at 2× this

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
   on inside useHls). maxBufferLength caps the forward buffer. — */
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
  const measureRef = useRef(null); // per-layout px shifts (null until measured)

  const [pinned, setPinned] = useState(false);
  const [inView, setInView] = useState(false);

  const isVideo = !!next?.hero?.playbackId;
  const hlsSrc =
    isVideo && inView ? `https://stream.mux.com/${next.hero.playbackId}.m3u8` : null;
  useHls(videoRef, hlsSrc, BAND_HLS_CONFIG);

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
    measureRef.current = {
      bandW,
      stacked,
      mediaW: media.offsetWidth,
      labelShift: shiftFor(labelWrapRef.current),
      titleShift: shiftFor(titleRef.current),
      tagsShift: shiftFor(tagsRef.current),
      ruleBase: ruleRef.current?.offsetWidth || 1,
    };
  };

  // ── Every animated element's target values at a given fill ──
  const targetsAt = (f) => {
    const m = measureRef.current;
    if (!m) return null;
    const labelP = clamp01(f / NP_SPLIT);
    const titleP = clamp01((f - NP_LAG) / NP_SPLIT);
    const mediaP = clamp01((f - 2 * NP_LAG) / (1 - 2 * NP_LAG));

    const labelX = m.labelShift * (1 - labelP);
    const reveal = REST_REVEAL + mediaP * (1 - REST_REVEAL);
    const t = {
      labelX,
      titleX: m.titleShift * (1 - titleP),
      tagsX: m.tagsShift * (1 - titleP),
      clip: `inset(0% 0% 0% ${(CLIP_MAX * (1 - mediaP)).toFixed(2)}%)`,
      // In-window pre-cover: same f² curve + ?nppre knob the RouteFill
      // pre-cover rode, now confined to the media window.
      cover: NP_PRE_COVER * f * f,
      ruleX: 0,
      ruleScale: 1,
    };
    // Rule spans label-left → window-left (band coords, gutter-relative).
    if (!m.stacked) {
      const mediaLeft = m.bandW - GUTTER - m.mediaW * reveal;
      t.ruleX = labelX;
      t.ruleScale = Math.max(0, mediaLeft - GUTTER - GUTTER - labelX) / m.ruleBase;
    }
    return t;
  };

  // ── Compose everything from the single fill scalar (drag/commit path) ──
  const apply = () => {
    const t = targetsAt(proxyRef.current.f);
    if (!t) return;
    gsap.set(labelWrapRef.current, { x: t.labelX });
    gsap.set(titleRef.current, { x: t.titleX });
    gsap.set(tagsRef.current, { x: t.tagsX });
    gsap.set(mediaRef.current, { clipPath: t.clip });
    gsap.set(ruleRef.current, { x: t.ruleX, scaleX: t.ruleScale });
    // During departure the commit timeline owns the cover (raising it to
    // solid on the Turn curve); apply() only tracks the drag's f² curve.
    if (!departingRef.current) gsap.set(coverRef.current, { opacity: t.cover });
  };

  const unified = () =>
    [
      labelWrapRef.current,
      titleRef.current,
      tagsRef.current,
      mediaRef.current,
      coverRef.current,
      ruleRef.current,
    ].filter(Boolean);

  // A resumed gesture takes over from a mid-flight unified return.
  const killUnified = () => gsap.killTweensOf(unified());

  // ── Unified snap-back: everything returns TOGETHER on the release curve —
  // direct-to-rest tweens, one duration, not the staggered mapping in
  // reverse. ──
  const releaseToRest = () => {
    accumRef.current = 0;
    gsap.killTweensOf(proxyRef.current);
    proxyRef.current.f = 0;
    const t = targetsAt(0);
    if (!t) return;
    const cfg = { duration: 0.4, ease: 'expo.out', overwrite: 'auto' };
    gsap.to(labelWrapRef.current, { x: t.labelX, ...cfg });
    gsap.to(titleRef.current, { x: t.titleX, ...cfg });
    gsap.to(tagsRef.current, { x: t.tagsX, ...cfg });
    gsap.to(mediaRef.current, { clipPath: t.clip, ...cfg });
    gsap.to(coverRef.current, { opacity: t.cover, ...cfg });
    gsap.to(ruleRef.current, { x: t.ruleX, scaleX: t.ruleScale, ...cfg });
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
    killUnified(); // take over from a mid-flight unified return

    // Promote the ORIGINAL media node (a clone would restart HLS) to a
    // fixed box at its exact on-screen rect. z-index 90 keeps it under the
    // z-100 site shell — the nav rides above the passage, as it always
    // has. The band's height is frozen first so the box leaving the flow
    // (mobile's static stacking) can't collapse the band and jolt the
    // end-of-document scroll position. Margins are zeroed for the same
    // reason: fixed + top must place the border box AT the rect (mobile's
    // margin-top would otherwise push it below its measurement).
    const media = mediaRef.current;
    const rect = media.getBoundingClientRect();
    gsap.set(bandRef.current, { height: bandRef.current.offsetHeight });
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
      measure();
      apply();
      const onResize = () => {
        measure();
        apply();
      };
      window.addEventListener('resize', onResize);
      // The display face changes the title's width when it lands — the
      // rest-state shifts are only right once fonts are in.
      document.fonts?.ready.then(onResize).catch(() => {});
      return () => window.removeEventListener('resize', onResize);
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
      killUnified(); // a resumed drag takes over from a mid-flight return
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
      idleRef.current = setTimeout(releaseToRest, STALL_MS);
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
      addDelta((touchY - y) * 2); // upward swipe = onward (the /work gain)
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
          {/* Chip voice (08-30 (2)) — matches .detail-next's label exactly. */}
          <span className="np-band__label" ref={labelRef}>
            next_project:
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
  );
}
