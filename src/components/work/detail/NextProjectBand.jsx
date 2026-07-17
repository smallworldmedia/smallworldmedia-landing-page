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
 * Commit rides the Envelopment bridge (ADR-0002): fill pre-covers with the
 * drag (f², like the globe's lean), the threshold pins the title blue and
 * finishes the choreography on the house Turn curve while `swm:envelop`
 * ramps the RouteFill — solid exactly at navigate(); the arriving detail
 * page's mount dispatches `swm:fill-release`. `swm:worldIndex` is written at
 * commit so the breadcrumb returns /work to the World you rode into.
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
import { scrambleTo } from '../../../lib/scramble.js';
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
const NP_COVER_SECONDS = PARAM('npcover', GLIDE_MS) / 1000; // blue ramp from t=0
const NP_PRE_COVER = PARAM('nppre', 30) / 100; // blue at full drag (f² curve)
const NP_ZOOM = PARAM('npzoom', 1.35); // media push-in over the commit

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

const clamp01 = (v) => Math.max(0, Math.min(1, v));

export default function NextProjectBand({ next }) {
  const bandRef = useRef(null);
  const labelWrapRef = useRef(null);
  const labelRef = useRef(null);
  const scrambledRef = useRef(false);
  const ruleRef = useRef(null);
  const titleRef = useRef(null);
  const tagsRef = useRef(null);
  const mediaRef = useRef(null);
  const innerRef = useRef(null);
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
  useHls(videoRef, hlsSrc);

  // ── Measure the rest-state shifts (and re-measure on resize) ──
  // CSS lays everything at its END position (text at the left edge, media
  // box at full width); the engine translates text right / clips the media
  // back to compose the rest state. Mobile (stacked) zeroes the text shifts —
  // the media reveal + pre-cover carry the same physics there.
  const measure = () => {
    const band = bandRef.current;
    const media = mediaRef.current;
    if (!band || !media) return;
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
  };

  const unified = () =>
    [
      labelWrapRef.current,
      titleRef.current,
      tagsRef.current,
      mediaRef.current,
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
    gsap.to(ruleRef.current, { x: t.ruleX, scaleX: t.ruleScale, ...cfg });
    window.dispatchEvent(
      new CustomEvent('swm:fill-progress', { detail: { value: 0, duration: 0.4 } })
    );
  };

  // ── Commit: finish the choreography on the Turn curve under the rising
  // blue, then navigate. Continues from wherever the drag left off. ──
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
    const ease = CustomEase.create('swmNextBand', TURN_EASE_PATH);
    const tl = gsap.timeline({ onComplete: () => navigate(`/work/${next.slug}`) });
    tl.to(proxyRef.current, {
      f: 1,
      duration: NP_SECONDS,
      ease,
      overwrite: 'auto',
      onUpdate: apply,
    }, 0);
    // Push INTO the next world's media as the blue swallows the screen —
    // the globe envelopment's scale-through, on the band's own subject.
    tl.to(innerRef.current, { scale: NP_ZOOM, duration: NP_SECONDS, ease }, 0);
    // Cover from the first frame of the passage (power2.in inside RouteFill
    // keeps it subtle early); solid exactly as navigation fires.
    tl.add(() => {
      window.dispatchEvent(
        new CustomEvent('swm:envelop', { detail: { duration: NP_COVER_SECONDS } })
      );
    }, 0);
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
      gsap.to(proxyRef.current, {
        f,
        duration: 0.25,
        ease: 'power3.out',
        overwrite: 'auto',
        onUpdate: apply,
      });
      window.dispatchEvent(
        new CustomEvent('swm:fill-progress', {
          detail: { value: NP_PRE_COVER * f * f },
        })
      );
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
        // First arrival in view: the label announces itself via the house
        // scramble (snaps under reduced motion inside scrambleTo).
        if (entry.isIntersecting && !scrambledRef.current && labelRef.current) {
          scrambledRef.current = true;
          scrambleTo(labelRef.current, 'next project:');
        }
      },
      { rootMargin: '200px', threshold: 0.05 }
    );
    io.observe(band);
    return () => io.disconnect();
  }, []);

  if (!next) return null;

  const posterUrl = isVideo
    ? `https://image.mux.com/${next.hero.playbackId}/thumbnail.jpg?width=${MEDIA_IMG_WIDTH}&fit_mode=preserve`
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
      onClick={onClick}
      aria-label={`Next project: ${next.clientName} — ${next.title}`}
    >
      <div className="np-band__text">
        <div className="np-band__label-wrap" ref={labelWrapRef}>
          <span className="np-band__label" ref={labelRef}>
            next project:
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
      </div>
    </a>
  );
}
