/**
 * HeroLabels — blob-tracking labels on the home globe (home-hero rework,
 * chunk 6; the /process S1 label idiom ported to the hero). Flag-gated OFF:
 * Hero mounts this ONLY when TUNING.labels is on (?herolabels=1 or the
 * bench toggle) and never under reduced motion — and the effect refuses to
 * run under RM here too, the dual guard.
 *
 * A mono chip latches onto a LIVE panel — line 1 the client name, line 2
 * up to two service tags in the process-vocabulary voice — scrambles in
 * (the house scramble), holds ?labelhold, fades, and re-slots to another
 * live panel (round-robin, never the same panel back-to-back when an
 * alternative exists). A 1px leader stroke connects the chip's nearest
 * corner to the panel's center, with a 3px anchor dot on the panel; both
 * live in ONE full-viewport SVG layer and ride the chip's own opacity
 * (one gsap target list per slot — chip + stroke group fade together).
 *
 * Live-panel truth arrives by EVENT, never by polling: the scene api's
 * onLiveChange subscription (LivePanelScheduler announces 'live' when a
 * promotion's crossfade completes, 'off' at demote start and on any slot
 * release/teardown). A labeled panel demoted — or carried behind the
 * globe's silhouette (prominence < MIN_PROMINENCE, or projected past the
 * far plane) — fades early and the slot re-slots.
 *
 * Per frame (the overlay bridge cadence — no second rAF): each bound
 * slot projects panel.centerDir·RADIUS through globeGroup.localToWorld →
 * project(camera) → px, then writes ONE chip transform (the process
 * +14/−6 offsets) and the leader's four endpoints + dot center. Module
 * scratch vectors, zero allocations beyond the write strings; the chip
 * box is measured ONCE per content change (the text is pre-set at its
 * final length — mono face, so the scramble never changes the box) and
 * NEVER per frame.
 *
 * Chrome discipline: slots arm only at the chrome beat (data-chromed /
 * swm:hero-chrome — the shared chrome-latch idiom); live events before the
 * beat only accumulate the candidate set. At commit the layer's root is
 * part of Hero's chrome NodeList, so the chrome-out fades it and a
 * dry-run release restores it. Pointer-inert throughout.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Vector3 } from 'three';
import { scrambleTo } from '../../lib/scramble.js';
import { TUNING } from './heroConfig.js';
import { RADIUS, PREFERS_REDUCED_MOTION } from '../globe/globeConfig.js';

/* Chip offsets from the anchor px — the process-label placement. */
const CHIP_OFFSET_X = 14;
const CHIP_OFFSET_Y = -6;
const HOLD_ALPHA = 0.85; // the process-label resting opacity
const FADE_IN_SECONDS = 0.2; // power2.out, process cadence
const FADE_OUT_SECONDS = 0.3; // power2.in, process cadence
/* Prominence = panel surface normal · globe→camera view axis (1 = dead
   center, 0 = the rim). Below MIN a labeled panel is slipping behind the
   silhouette — fade early. BIND is the pick-time hysteresis: a candidate
   must clear the higher bar so a rim-hugger (the scheduler keeps panels
   live down to DEMOTE_SCORE 0.06 under its dwell rules) can't enter a
   bind → instant-fade loop. */
const MIN_PROMINENCE = 0.15;
const BIND_PROMINENCE = 0.25;
const DOT_RADIUS = 1.5; // the 3px anchor dot

/* Scratch space — the frame callback is synchronous and single-threaded
   (heroOverlay's module-scratch convention). Never handed out. */
const vAnchor = new Vector3();
const vNormal = new Vector3();
const vAxis = new Vector3();

const SVG_NS = 'http://www.w3.org/2000/svg';

/* Service names in the process-vocabulary voice: lowercase snake_case
   ("Art Direction" → art_direction), two max, ' / ' between. */
const serviceLine = (services) =>
  (services || [])
    .slice(0, 2)
    .map((s) =>
      String(s?.name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
    )
    .filter(Boolean)
    .join(' / ');

export default function HeroLabels({ overlay, sceneApiRef }) {
  const rootRef = useRef(null);
  const svgRef = useRef(null);

  useEffect(() => {
    // RM dual guard — Hero never mounts this under reduced motion, and it
    // still refuses to run here.
    if (PREFERS_REDUCED_MOTION) return undefined;
    const root = rootRef.current;
    const svg = svgRef.current;
    const api = sceneApiRef?.current;
    if (!root || !svg || !overlay || !api?.onLiveChange) return undefined;
    let disposed = false;

    /* — Candidate set: live panels in announcement order. Filled by the
       scheduler's events from mount (so a pre-beat promotion is ready the
       moment the chrome arms), consumed round-robin by the slots. — */
    const live = [];
    let cursor = 0;
    let armed = false;

    /* — Latest overlay frame — held so event-time picks can read the same
       matrices the frame loop does (the frame object is mutated in place,
       heroOverlay; single-threaded, so the scratch vectors are safe from
       both cadences). — */
    let lastFrame = null;
    const prominenceOf = (panel) => {
      if (!lastFrame) return 1; // no frame yet — accept; the guard corrects on tick one
      vAnchor.setFromMatrixPosition(lastFrame.globeGroup.matrixWorld);
      vAxis.setFromMatrixPosition(lastFrame.camera.matrixWorld).sub(vAnchor).normalize();
      vNormal.copy(panel.centerDir).transformDirection(lastFrame.globeGroup.matrixWorld);
      return vNormal.dot(vAxis);
    };

    /* — Slots: chip span (two lines) + stroke group (line + dot) in the
       shared SVG. One gsap target pair per slot so chip and leader always
       share an opacity. Count fixed at mount — Hero re-keys the layer on a
       bench labelMax change. — */
    const max = Math.max(1, Math.round(TUNING.labelMax) || 1);
    const slots = [];
    for (let i = 0; i < max; i += 1) {
      const el = document.createElement('span');
      el.className = 'hero-label';
      const l1 = document.createElement('span');
      l1.className = 'hero-label__line';
      const l2 = document.createElement('span');
      l2.className = 'hero-label__line';
      el.append(l1, l2);
      root.appendChild(el);

      const g = document.createElementNS(SVG_NS, 'g');
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('class', 'hero-labels__leader');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'hero-labels__dot');
      dot.setAttribute('r', String(DOT_RADIUS));
      g.append(line, dot);
      svg.appendChild(g);
      gsap.set([el, g], { autoAlpha: 0 });

      slots.push({
        el,
        l1,
        l2,
        g,
        line,
        dot,
        panel: null, // the live panel this chip tracks
        last: null, // back-to-back repeat guard
        tl: null, // the cycle timeline (scramble in → hold → fade)
        dc: null, // the re-slot breath (delayedCall)
        fading: false, // early fade in flight — the behind-guard's one-shot
        w: 0, // chip box, cached at content change ONLY
        h: 0,
      });
    }

    /* — Round-robin pick: the next front-enough live panel with a
       clientName that no slot holds, preferring not to repeat this slot's
       previous panel — the repeat is the fallback, taken only when it's
       the sole option. — */
    const candidate = (slot) => {
      const n = live.length;
      let fallback = null;
      for (let k = 0; k < n; k += 1) {
        const idx = (cursor + k) % n;
        const panel = live[idx];
        if (!panel.asset?.clientName) continue;
        if (slots.some((s) => s.panel === panel)) continue;
        if (prominenceOf(panel) < BIND_PROMINENCE) continue; // rim-hugger
        if (panel === slot.last) {
          fallback = fallback ?? panel;
          continue;
        }
        cursor = (idx + 1) % n;
        return panel;
      }
      return fallback;
    };

    /* — Bind: pre-set BOTH lines to their final text (mono face — the box
       is already final-size, and the chip is at alpha 0 so nothing shows),
       cache the box (the ONLY layout read, content-change cadence), then
       run the process cycle: scramble in → hold ?labelhold → fade out →
       release + re-slot. — */
    const bind = (slot, panel) => {
      slot.panel = panel;
      slot.fading = false;
      const name = panel.asset.clientName;
      const tags = serviceLine(panel.asset.services);
      // An early-fade re-bind can arrive inside the previous scramble's
      // 1.4s window — kill the line tweens before they fight the new text.
      gsap.killTweensOf([slot.l1, slot.l2]);
      slot.l1.textContent = name;
      slot.l2.textContent = tags;
      const box = slot.el.getBoundingClientRect();
      slot.w = box.width;
      slot.h = box.height;
      const hold = Math.max(0.3, TUNING.labelHold);
      slot.tl?.kill();
      // Imperative reset, never tl.set (the bgMorph killTweensOf trap) —
      // redundant on every path today (the chip only binds faded-out), but
      // the start state must not depend on that staying true.
      gsap.set([slot.el, slot.g], { autoAlpha: 0 });
      slot.tl = gsap
        .timeline({ onComplete: () => release(slot) })
        .call(
          () => {
            scrambleTo(slot.l1, name);
            if (tags) scrambleTo(slot.l2, tags);
          },
          null,
          0.01
        )
        .to(
          [slot.el, slot.g],
          { autoAlpha: HOLD_ALPHA, duration: FADE_IN_SECONDS, ease: 'power2.out' },
          0.01
        )
        .to(
          [slot.el, slot.g],
          { autoAlpha: 0, duration: FADE_OUT_SECONDS, ease: 'power2.in' },
          0.01 + FADE_IN_SECONDS + hold
        );
    };

    /* — Release: unbind, then re-slot after a small breath (the process
       0.2–0.8s cadence) if the chrome is still up and candidates exist. — */
    const release = (slot) => {
      slot.last = slot.panel;
      slot.panel = null;
      slot.fading = false;
      if (disposed || !armed) return;
      slot.dc?.kill();
      slot.dc = gsap.delayedCall(0.2 + Math.random() * 0.6, () => {
        slot.dc = null;
        if (disposed || !armed || slot.panel) return;
        const next = candidate(slot);
        if (next) bind(slot, next);
        // no candidate — the slot idles; the next 'live' event fills it
      });
    };

    /* — Early fade: demoted or carried behind mid-hold — kill the cycle,
       fade out on the same curve, then re-slot. The chip keeps tracking
       its anchor through the fade (fading latch stops re-triggers). — */
    const earlyFade = (slot) => {
      if (slot.fading) return;
      slot.fading = true;
      slot.tl?.kill();
      slot.tl = null;
      gsap.to([slot.el, slot.g], {
        autoAlpha: 0,
        duration: FADE_OUT_SECONDS,
        ease: 'power2.in',
        overwrite: 'auto',
        onComplete: () => {
          if (!disposed) release(slot);
        },
      });
    };

    // Fill every idle slot from the candidate set (chrome beat, and each
    // 'live' arrival). Slots mid-breath (dc pending) keep their own timing.
    const fillIdleSlots = () => {
      if (!armed) return;
      for (const slot of slots) {
        if (slot.panel || slot.dc) continue;
        const next = candidate(slot);
        if (next) bind(slot, next);
      }
    };

    /* — Live-panel events (the scheduler's announcements, via the scene
       api's subscription — panels arrive as objects; we read asset text at
       bind time and centerDir per frame, nothing else). — */
    const unsubLive = api.onLiveChange((panel, state) => {
      if (disposed) return;
      if (state === 'live') {
        if (!live.includes(panel)) live.push(panel);
        fillIdleSlots();
      } else {
        const i = live.indexOf(panel);
        if (i !== -1) {
          live.splice(i, 1);
          if (i < cursor) cursor -= 1;
          if (live.length) cursor %= live.length;
          else cursor = 0;
        }
        const slot = slots.find((s) => s.panel === panel);
        if (slot) earlyFade(slot); // demoted mid-hold → fade early, re-slot
      }
    });

    /* — Arm at the chrome beat (data-chromed covers a mount racing the
       event — the shared chrome-latch idiom). Before the beat, events only
       build the candidate set. — */
    let onChrome = null;
    const arm = () => {
      if (armed || disposed) return;
      armed = true;
      fillIdleSlots();
    };
    if (root.closest('.hero')?.dataset.chromed === '1') {
      arm();
    } else {
      onChrome = () => arm();
      window.addEventListener('swm:hero-chrome', onChrome, { once: true });
    }

    /* — Per frame (overlay cadence): project each bound anchor, write the
       chip transform + leader endpoints. Zero allocations beyond the
       write strings (the overlay-consumer budget); zero layout reads — the
       chip box comes from the bind-time cache. — */
    const onFrame = (frame) => {
      lastFrame = frame; // event-time picks read the same matrices
      for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const panel = slot.panel;
        if (!panel) continue;
        // Prominence — the scheduler's score idiom, camera-space (the
        // camera lookAts the globe center, so the view axis IS its z —
        // elevation-safe where the scheduler's raw .z read assumes an
        // equatorial camera). The MIN floor sits just above DEMOTE_SCORE
        // (0.06): the label lets go a beat before the scheduler would
        // demote the panel on score.
        const prominence = prominenceOf(panel);
        // Anchor: the panel center at the surface, globe-local → world →
        // NDC (post-render matrices, heroOverlay's guarantee).
        vAnchor.copy(panel.centerDir).multiplyScalar(RADIUS);
        frame.globeGroup.localToWorld(vAnchor);
        vAnchor.project(frame.camera);
        if ((vAnchor.z > 1 || prominence < MIN_PROMINENCE) && !slot.fading) {
          earlyFade(slot); // slipping behind the silhouette — let go early
        }
        const ax = (vAnchor.x * 0.5 + 0.5) * frame.w;
        const ay = (vAnchor.y * -0.5 + 0.5) * frame.h; // NDC y-up → CSS y-down
        const cx = ax + CHIP_OFFSET_X;
        const cy = ay + CHIP_OFFSET_Y;
        slot.el.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
        // Leader: the chip corner nearest the anchor → the anchor.
        const x1 = ax < cx + slot.w / 2 ? cx : cx + slot.w;
        const y1 = ay < cy + slot.h / 2 ? cy : cy + slot.h;
        slot.line.setAttribute('x1', x1.toFixed(1));
        slot.line.setAttribute('y1', y1.toFixed(1));
        slot.line.setAttribute('x2', ax.toFixed(1));
        slot.line.setAttribute('y2', ay.toFixed(1));
        slot.dot.setAttribute('cx', ax.toFixed(1));
        slot.dot.setAttribute('cy', ay.toFixed(1));
      }
    };
    const unsubFrame = overlay.onFrame(onFrame);

    return () => {
      disposed = true;
      unsubFrame();
      unsubLive();
      if (onChrome) window.removeEventListener('swm:hero-chrome', onChrome);
      slots.forEach((slot) => {
        slot.tl?.kill();
        slot.dc?.kill();
        gsap.killTweensOf([slot.el, slot.g]);
        gsap.killTweensOf([slot.l1, slot.l2]); // live scrambles
        slot.el.remove();
        slot.g.remove();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="hero-labels" ref={rootRef} aria-hidden="true">
      <svg className="hero-labels__svg" ref={svgRef} focusable="false" />
    </div>
  );
}
