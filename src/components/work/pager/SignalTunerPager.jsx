/**
 * SignalTunerPager — the ?pager=tuner variant (docs/fp-pager-rework-approaches.md,
 * approach C). Nothing spatial ever deploys: ONE chip at the rail seat that
 * seeks like a tuner. Press-hold (touch) / hover (desktop) charges it, the
 * /NN total extends inside the chip, the client name extends right, and the
 * 2px position strip switches from position-in-set to live seek. Between
 * stations the readout SCRAMBLES from the house SCRAMBLE_CHARS at the
 * textExit charCutMs beat (the hunting signal); within ±TUNER_LOCK_WINDOW
 * of a station it LOCKS — real text, one haptic tick. Release commits
 * exactly ONE Turn via the parent's requestGoTo, and the strip glides from
 * the seek position to the landed station over TURN_DURATION on the CTA
 * commit curve (the pager-CTA linked-motion doctrine).
 *
 * Rendering split: React owns structure + low-frequency state (open/charged
 * → data-open / data-charged); the shared gesture engine drives per-frame
 * writes — ONE custom property (--tuner-pos) on the root and textContent
 * through refs. React's own render of the readout is FROZEN at the mount
 * value (seedRef): a deferred Turn landing mid-gesture would otherwise
 * re-diff the digits/name/aria back to the stale station while the user is
 * still seeking. The scramble is a setInterval alive only while engaged.
 * The slider is a <div role="slider">, not a <button>, on purpose: one
 * activation channel (the engine owns Enter/Space/arrows/Home/End/Escape on
 * the root and engages on :focus-visible focusin).
 *
 * Announcement discipline: the readout CUT (digits/name/width pin) and the
 * ANNOUNCEMENT (aria-valuenow/aria-valuetext + the live region) are two
 * different beats. The cut happens at the engine's integer crossing so the
 * scramble wears the right shape; the announcement happens at LOCK only
 * (writeFrame), change-gated on the label — reassigning a live region's
 * text re-announces it even when the string is identical.
 */
import { useEffect, useRef, useState } from 'react';
import { usePagerGesture } from './usePagerGesture.js';
import { PREFERS_REDUCED_MOTION, TURN_DURATION } from '../world/worldConfig.js';
import { SCRAMBLE_CHARS } from '../../../lib/scramble.js';
import {
  PAGER_DETENT_TOUCH_PX,
  TUNER_DETENT_WHEEL_PX,
  TUNER_IDLE_COMMIT_MS,
  TUNER_LOCK_WINDOW,
  TUNER_SCRAMBLE_MS,
  TUNER_HAPTIC_MS,
} from '../../../lib/motion.js';

const pad2 = (n) => String(n + 1).padStart(2, '0');
// ?idlecommit: the spec's on/off gate (0 = never auto-commit, commit on
// pointerleave / keyboard / blur only; 1 = the baked TUNER_IDLE_COMMIT_MS)
// AND a live duration — anything above the toggle range is read as ms, so
// a device pass can dial the dwell without a rebuild.
const idleCommitMs = () => {
  const v = PARAM('idlecommit', 1);
  if (v === 0) return Infinity;
  return v > 1 ? Math.max(50, v) : TUNER_IDLE_COMMIT_MS;
};
// Live tuning (?key=value) — the FeaturedProjects knobs convention.
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};
// Array.from: the house set carries block glyphs — index by code point, not unit.
const CHARS = Array.from(SCRAMBLE_CHARS);
const rnd = () => CHARS[Math.floor(Math.random() * CHARS.length)];
// Haptics only where there is a surface to buzz. Desktop Chrome exposes
// navigator.vibrate as a function and logs an [Intervention] for every call
// made without a tap — the hover/wheel/keyboard paths would spray the
// console the doctrine wants clean.
const canBuzz =
  typeof navigator !== 'undefined' &&
  typeof navigator.vibrate === 'function' &&
  !PREFERS_REDUCED_MOTION &&
  typeof window !== 'undefined' &&
  window.matchMedia('(pointer: coarse)').matches;

export default function SignalTunerPager({ worlds, active, commit, onEngaged }) {
  const rootRef = useRef(null);
  const chipRef = useRef(null);
  const digitsRef = useRef(null);
  const nameTextRef = useRef(null);
  const liveRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [charged, setCharged] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;
  const count = worlds.length;
  const max = Math.max(0, count - 1);
  const clampIdx = (q) => Math.min(max, Math.max(0, q));
  // Strip fill 0..1; a single-project set fills the strip (position-in-set
  // of one is "here").
  const posOf = (q) => (max > 0 ? clampIdx(q) / max : 1);
  const labelOf = (i) => `Project ${i + 1} of ${count} — ${worlds[i]?.clientName ?? ''}`;

  // Live gesture state — plain refs, never React state (per-frame callbacks).
  //   q         latest rendered scrub position (engine onFrame)
  //   station   the station the readout currently names (real text)
  //   seeking   between stations → the interval scrambles the readout
  //   locked    last station that locked (vibrate once per newly-locked)
  //   landed    the commit landed during this engage (glides at retract)
  //   announced last label handed to assistive tech — the live region
  //             re-announces an IDENTICAL reassignment, so every write is
  //             gated on this
  //   hold      post-commit readout freeze: { target, dist, glide } — the
  //             damper's convergence to the landing must never re-scramble
  //             (or, while gliding, re-write) the strip; a frame that moves
  //             AWAY from the target means the user resumed, and releases it
  const st = useRef({
    q: active,
    station: active,
    engaged: false,
    seeking: false,
    locked: active,
    landed: null,
    announced: labelOf(active),
    hold: null,
  }).current;
  const timers = useRef({ scramble: 0, glide: 0 }).current;
  // ?scramblename=0 scrambles the digits only (the judge-flagged double
  // scramble) — per-render read, latest value into the interval.
  const optsRef = useRef({});
  optsRef.current = { scrambleName: PARAM('scramblename', 1) !== 0 };
  // SSR-correct seed: --tuner-pos and every readout React renders are
  // FROZEN at the mount value — React must never re-write them on `active`
  // changes (the engine's follow damper glides the strip and cuts the text
  // per frame; a React diff would flash a stale station mid-gesture when a
  // deferred Turn lands).
  const seedRef = useRef({
    pos: posOf(active),
    digits: pad2(active),
    name: worlds[active]?.clientName ?? '',
    now: active + 1,
    label: labelOf(active),
  }).current;

  const writePos = (q) => {
    rootRef.current?.style.setProperty('--tuner-pos', String(posOf(q)));
  };

  const scrambleTick = () => {
    if (!st.seeking) return;
    if (digitsRef.current) digitsRef.current.textContent = rnd() + rnd();
    const text = nameTextRef.current;
    if (text && optsRef.current.scrambleName) {
      // Same length, spaces kept — the hunting signal wears the name's shape.
      const real = worlds[st.station]?.clientName ?? '';
      text.textContent = real.replace(/\S/g, rnd);
    }
  };

  // Station hard-cut (VISUAL only): digits + name real text + the pinned
  // name width. Mid-seek crossings re-scramble in the SAME task (the real
  // text is written only to be measured — it never paints). No a11y writes
  // here: a crossing is the engine's 0.5 boundary, and the readout is still
  // hunting until the seek re-enters the lock window.
  const resolveStation = (i) => {
    const w = worlds[i];
    if (!w) return;
    st.station = i;
    if (digitsRef.current) digitsRef.current.textContent = pad2(i);
    const text = nameTextRef.current;
    if (text) {
      text.textContent = w.clientName;
      text.style.width = '';
      text.style.width = `${text.offsetWidth}px`;
    }
    if (st.seeking) scrambleTick();
  };

  // Announce a LANDED station: slider value + the polite live region, once.
  // Gated on the label because a screen reader replays an aria-live node
  // whose text is REASSIGNED, identical or not — and this is reached from
  // the lock frame, every commit, the retract re-assert and rest-follow.
  const announce = (i) => {
    const w = worlds[i];
    if (!w) return;
    const label = labelOf(i);
    if (label === st.announced) return;
    st.announced = label;
    if (chipRef.current) {
      chipRef.current.setAttribute('aria-valuenow', String(i + 1));
      chipRef.current.setAttribute('aria-valuetext', label);
    }
    if (liveRef.current) liveRef.current.textContent = label;
  };

  // Post-commit strip glide (see the [data-glide] CSS): arm the transition
  // and write the target in one task, mute per-frame writes for the Turn,
  // then drop the attribute. RM: a plain snap, no window.
  // The glide window IS the hold's life — endGlide nulls it. A hold that
  // outlived its window would sit at rest and swallow the next external
  // Turn's crossing (under RM the engine fires onDetent BEFORE onFrame, so
  // writeFrame's move-away release never gets the chance to fire first).
  const endGlide = () => {
    clearTimeout(timers.glide);
    timers.glide = 0;
    rootRef.current?.removeAttribute('data-glide');
    st.hold = null;
    writePos(st.q);
  };
  const releaseHold = endGlide;
  // Resolve the readout to the landing: real text, scramble off, announced,
  // and the damper's convergence held so it never re-scrambles on the way in.
  const holdReadout = (i) => {
    st.hold = { target: i, dist: Math.abs(st.q - i), glide: false };
    st.seeking = false;
    resolveStation(i);
    announce(i);
  };
  const armGlide = (i) => {
    // Release arms at commit AND at the retract 240ms later — the second
    // call must not restart the Turn-length window on a glide underway.
    const underway = !!(st.hold && st.hold.glide && st.hold.target === i && timers.glide);
    holdReadout(i);
    const root = rootRef.current;
    if (!root) return;
    if (underway) {
      st.hold.glide = true;
      return;
    }
    clearTimeout(timers.glide);
    if (PREFERS_REDUCED_MOTION) {
      writePos(i);
      st.hold = null; // nothing converges under RM — there is no window to guard
      return;
    }
    st.hold.glide = true;
    root.setAttribute('data-glide', '');
    writePos(i); // transition armed → the fill glides from the seek position
    timers.glide = setTimeout(endGlide, TURN_DURATION * 1000);
  };

  const writeFrame = (q) => {
    st.q = q;
    const hold = st.hold;
    if (hold) {
      const dist = Math.abs(q - hold.target);
      if (dist > hold.dist + 1e-3) {
        releaseHold(); // moving away from the landing = the user resumed
      } else {
        hold.dist = dist;
        if (hold.glide) return; // CSS owns the strip for the Turn
      }
    }
    writePos(q);
    if (st.hold || !st.engaged) return; // held readout / rest-follow: position only
    const r = Math.round(clampIdx(q));
    if (Math.abs(q - r) <= TUNER_LOCK_WINDOW) {
      // LOCKED — snap to the real text the frame the seek re-enters the
      // window; announce on the SAME frame the real text paints (never at
      // the engine's 0.5 crossing, where the chip is still scrambling);
      // one haptic tick per newly-locked station.
      if (st.seeking || r !== st.station) {
        st.seeking = false;
        resolveStation(r);
      }
      announce(r); // change-gated — free to call every locked frame
      if (st.locked !== r) {
        st.locked = r;
        if (canBuzz) navigator.vibrate(TUNER_HAPTIC_MS);
      }
    } else {
      st.seeking = true; // the interval takes it from here
      st.locked = null;
    }
  };

  const engine = usePagerGesture({
    rootRef,
    count,
    activeRef,
    // Every landing passes through here (release, stall, leave, key,
    // escape, blur) before the parent's requestGoTo. Release/leave have
    // already put the engine in `settling` — the glide arms now, from the
    // live seek position. A still-engaged commit (stall stays open; key/
    // escape/blur retract synchronously) only resolves the readout; the
    // retract handler arms its glide.
    commit: (i) => {
      st.landed = i;
      if (engine.isEngaged()) holdReadout(i);
      else armGlide(i);
      commit(i);
    },
    onEngaged: (v) => {
      // The engine retracts unconditionally on focusout/blur, even from
      // rest — that must be a no-op here, not a fresh glide + re-announce
      // (every click on the page fires focusout while the chip holds focus).
      if (!v && !st.engaged) {
        setOpen(false);
        onEngaged(false); // parent's class toggle: already false, harmless
        return;
      }
      setOpen(v);
      onEngaged(v);
      st.engaged = v;
      clearInterval(timers.scramble);
      timers.scramble = 0;
      if (v) {
        st.landed = null;
        st.seeking = false;
        st.locked = Math.round(clampIdx(st.q)); // no tick for the station already under the finger
        // The post-commit glide is NOT cut short by a re-engage: writeFrame
        // releases the hold on the first frame that moves away (a real
        // scrub), and endGlide releases it when the Turn's window closes.
        // Cutting it here snapped the fill to the landing mid-flight.
        if (!PREFERS_REDUCED_MOTION) timers.scramble = setInterval(scrambleTick, TUNER_SCRAMBLE_MS);
      } else {
        st.seeking = false;
        // Retract always leaves the REAL text of the landing (a peek lands
        // nowhere — it just re-asserts the station under the chip). The
        // landing is consumed: only the retract of the gesture that
        // produced it may re-assert it.
        const landed = st.landed;
        st.landed = null;
        if (landed != null) armGlide(landed);
        else resolveStation(Math.round(clampIdx(st.q)));
      }
    },
    onCharged: setCharged,
    onFrame: writeFrame,
    // Held = resolved to the landing: crossings on the damper's way IN
    // (flick carry, Escape's glide home) must not hard-cut the readout. A
    // crossing that moves AWAY from the target is the user resuming — or,
    // under reduced motion, an external Turn arriving before writeFrame
    // gets a look (stepRM fires onDetent first) — and releases the hold.
    onDetent: (i) => {
      const hold = st.hold;
      if (hold) {
        if (Math.abs(i - hold.target) > hold.dist + 1e-3) releaseHold();
        else return;
      }
      resolveStation(i);
      // Rest-follow of an external Turn never reaches writeFrame's lock
      // branch, so the landing is announced here instead.
      if (!st.engaged) announce(i);
    },
    hitTest: null, // nothing spatial deploys — a peek just shows the engaged chip
    tuning: {
      // Floors, not raw reads: ?detent=0 divides the finger delta by zero
      // (±Infinity raw → NaN one step later → a commit on the last index).
      detentPx: Math.max(8, PARAM('detent', PAGER_DETENT_TOUCH_PX)),
      wheelDetentPx: Math.max(8, PARAM('wheeldetent', TUNER_DETENT_WHEEL_PX)),
      endResist: 0, // hard clamp both ends — structurally can't leak into envelopment-home or the footer
      stallMs: idleCommitMs(),
      magnet: false, // seekPos is 1:1 with the finger/wheel
    },
  });

  // A Turn from any other path (CTA scroll, envelopment restore) glides the
  // strip to the new index — the marker-follow idiom, engine-owned τ. One
  // chip, so no roving tabstop to carry (and so no post-commit refocus that
  // could re-fire :focus-visible focusin and re-latch the deploy).
  useEffect(() => {
    engine.follow(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // The pinned name width is type-tier geometry: re-measure when the mono/
  // body tokens re-tier at 768px (desktop resize / rotation), not on the
  // next gesture. A re-measure is not a landing — nothing is announced.
  // Timers die with the mount.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onTier = () => resolveStation(st.station);
    mq.addEventListener('change', onTier);
    return () => {
      mq.removeEventListener('change', onTier);
      clearInterval(timers.scramble);
      clearTimeout(timers.glide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <nav
      className="fp-tuner"
      ref={rootRef}
      aria-label="Featured project pager"
      data-open={open || undefined}
      data-charged={charged || undefined}
      // --tuner-pos: the strip's SSR seed (frozen — see seedRef). --tuner-
      // glide-ms: the post-commit glide rides TURN_DURATION, ?turnms included.
      style={{ '--tuner-pos': seedRef.pos, '--tuner-glide-ms': `${TURN_DURATION * 1000}ms` }}
    >
      <div
        className="fp-tuner__chip"
        ref={chipRef}
        role="slider"
        tabIndex={0}
        aria-label="Featured project"
        aria-valuemin={1}
        aria-valuemax={count}
        // Mount seeds only — announce() owns these from the first frame on
        // (setAttribute). Rendering `active` here would let a deferred Turn
        // re-diff the slider back to a station the chip is not showing.
        aria-valuenow={seedRef.now}
        aria-valuetext={seedRef.label}
      >
        <span className="fp-tuner__readout" aria-hidden="true">
          <span className="fp-tuner__digits" ref={digitsRef}>
            {seedRef.digits}
          </span>
          <span className="fp-tuner__total">/{pad2(max)}</span>
        </span>
        <span className="fp-tuner__strip" aria-hidden="true">
          <span className="fp-tuner__fill" />
        </span>
      </div>
      <div className="fp-tuner__name" aria-hidden="true">
        <span className="fp-tuner__name-text" ref={nameTextRef}>
          {seedRef.name}
        </span>
      </div>
      <span className="sr-only" aria-live="polite" ref={liveRef} />
    </nav>
  );
}
