/**
 * usePagerGesture — the SHARED gesture engine for the /work pager rework
 * (docs/fp-pager-rework-approaches.md, 08-31). Every ?pager= variant is a
 * skin over this hook; the engine owns input, the skin owns rendering.
 *
 * Contract (locked): touch = press-and-hold (or an impatient slide) to
 * ENGAGE, slide wheels a continuous scrub position, release commits exactly
 * ONE goTo of the landed index. Desktop = hover to engage + wheel to step,
 * committing on a wheel stall or pointerleave. Tap below the hold threshold
 * = PEEK (deploy, auto-retract — the press-hold teacher). Wheeling is a
 * pure-DOM preview: the engine never touches the scene, the accumulator,
 * or lockRef — the parent's `commit` (requestGoTo) owns the Turn contract.
 *
 * Event ownership: the root owns pointer events via capture (touch/pen
 * only — mouse stays uncaptured so cell clicks work), and native
 * stopPropagation listeners for touchstart/move/END/CANCEL + wheel so
 * main's accumulator (and its touchend → scheduleRelease) never sees a
 * pager gesture. touch-action:none on the root is the CSS half.
 *
 * Callbacks fire imperatively (never per-frame through React state):
 *   onFrame(q)     rendered scrub position, detent magnetism applied
 *   onDetent(i)    integer crossing — hard-cut readouts + aria-live
 *   onEngaged(v)   deploy/retract visuals + parent engaged ref/class
 *   onCharged(v)   pressed/hover charge tell (white/black)
 * Reduced motion: no damper, no flick — positions snap per input event.
 */
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';
import {
  PAGER_HOLD_MS,
  PAGER_SLOP_PX,
  PAGER_STALL_COMMIT_MS,
  PAGER_PEEK_MS,
  PAGER_FLICK_CARRY_S,
  PAGER_TAU_SCRUB,
  PAGER_TAU_GLIDE,
  PAGER_END_RESIST,
  PAGER_KEY_COMMIT_MS,
} from '../../../lib/motion.js';

const TAU_SETTLE = 0.08; // release settle — steep launch off the live damper, smooth decel, no overshoot
const READ_BEAT_MS = 240; // post-settle beat before the retract (the landed number gets read)
const HOVER_INTENT_MS = 120; // desktop hover delay before deploy (first wheel tick bypasses it)
const END_OVERTRAVEL_CAP = 0.35; // resisted travel beyond the end detents, in detents
const CLICK_SUPPRESS_MS = 350; // swallow the synthetic click that trails a scrub release

export function usePagerGesture({
  rootRef,
  count,
  activeRef,
  commit,
  onEngaged,
  onCharged,
  onFrame,
  onDetent,
  onRenorm, // wrap only: the strip was silently re-based by `off` stations onto identical clones
  hitTest, // (clientY, q) => index | null — tap-during-open target resolve (capture retargets clicks)
  // Skin-resolved tuning (per-render, so ?param reads stay live):
  //   detentPx        finger px per station (?detent)
  //   wheelDetentPx   desktop wheel deltaY per station (?wheeldetent)
  //   endResist       beyond-range compression; 0 = HARD clamp (tuner) — default PAGER_END_RESIST
  //   stallMs         desktop wheel silence before the landing commits; non-finite = never
  //                   auto-commit (commit on pointerleave only) — default PAGER_STALL_COMMIT_MS
  //   magnet          detent magnetism on the rendered scrub (tape); false = 1:1 (tuner)
  //   magnetExp       magnet curve exponent (default 1.6 — the tape); higher = longer
  //                   hang on the station + steeper threshold snap (scale ?magnet)
  //   wrap            the list is a WHEEL (scale ?wrap): no ends, no resist; indices
  //                   report mod count, onDetent/commit carry the unwrapped position
  //                   second, and onRenorm(off) fires on silent loop re-bases
  tuning,
}) {
  // Latest-callback refs so the single mount effect never goes stale.
  const cb = useRef({});
  cb.current = { commit, onEngaged, onCharged, onFrame, onDetent, onRenorm, hitTest, tuning };

  const apiRef = useRef(null);
  if (!apiRef.current)
    apiRef.current = {
      close: () => {},
      follow: () => {},
      isEngaged: () => false,
      focusSilently: () => {},
    };

  useEffect(() => {
    const root = rootRef.current;
    if (!root || count < 1) return undefined;

    const max = count - 1;
    const s = {
      mode: 'rest', // rest | pressed | peek | peek-pressed | engaged | settling
      raw: activeRef.current, // unresisted scrub target (index space)
      p: activeRef.current, // resisted target the damper chases
      d: activeRef.current, // damped render position
      rawBase: 0,
      baseY: 0,
      lastDetent: activeRef.current,
      pointer: null, // { id, y0, t0, moved }
      samples: [],
      hovering: false,
      tickerOn: false,
      suppressClickUntil: 0,
      keyLanded: null, // pending keyboard candidate awaiting the debounce commit
    };
    const timers = { hold: 0, peek: 0, hover: 0, stall: 0, key: 0, readBeat: 0 };
    const clearTimers = (...names) => {
      for (const n of names) {
        clearTimeout(timers[n]);
        timers[n] = 0;
      }
    };
    const desktopHover =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    const tune = () => cb.current.tuning || {};
    // Wrap mode (tuning.wrap — the graticule's ?wrap wheel): position space
    // is UNBOUNDED and indices report mod count. Skins that opt in receive
    // the unwrapped strip position as a second arg on onDetent/commit (their
    // strip-space CSS vars need it), and onRenorm(off) when the engine
    // silently re-bases the whole position state by `off` stations onto
    // identical clone content — the skin must shift any strip-space vars it
    // owns by the same amount. Non-wrap skins are untouched: out()/rep()/
    // bound() are identity, the clamps keep their ends.
    const wrapOn = () => !!tune().wrap && count > 1;
    const pmod = (i) => ((i % count) + count) % count;
    const out = (i) => (wrapOn() ? pmod(i) : i);
    // Nearest unwrapped representative of principal index i to the RENDERED
    // position — an external Turn / cell click / Escape must glide the short
    // way around the wheel, never unwind whole loops.
    const rep = (i) => (wrapOn() ? i + count * Math.round((s.d - i) / count) : i);
    const bound = (v) => (wrapOn() ? v : Math.min(max, Math.max(0, v)));
    const clampResist = (raw) => {
      if (wrapOn()) return raw; // a wheel has no ends
      const r = tune().endResist ?? PAGER_END_RESIST;
      if (raw < 0) return Math.max(-END_OVERTRAVEL_CAP, raw * r);
      if (raw > max) return max + Math.min(END_OVERTRAVEL_CAP, (raw - max) * r);
      return raw;
    };
    // Raw travel is bounded to the input that still MOVES the resisted
    // position (nothing at all under a hard clamp, endResist 0). Past that
    // the accumulator would only bank distance the reversal has to spend
    // before the readout budges — pushing into an end for a second would
    // leave the scrub dead for the whole way back.
    const clampRaw = (raw) => {
      if (wrapOn()) return raw; // a wheel has no ends
      const r = tune().endResist ?? PAGER_END_RESIST;
      const room = r > 0 ? END_OVERTRAVEL_CAP / r : 0;
      return Math.max(-room, Math.min(max + room, raw));
    };
    // Detent magnetism: linger on stations, cross between them briskly.
    // Continuous at f=±0.5, never exceeds the neighbouring detent. The
    // exponent is per-skin (tuning.magnetExp, default the tape's 1.6): at
    // the graticule's pitch the house curve deviates ~4px at most, so the
    // scale runs a much steeper one (?magnet) — long hang, fast threshold.
    const shape = (v) => {
      const r = Math.round(v);
      const f = v - r;
      const p = tune().magnetExp ?? 1.6;
      return r + (Math.sign(f) * Math.pow(Math.abs(2 * f), p)) / 2;
    };
    const landedIndex = () => Math.round(bound(s.raw)); // unwrapped under wrap — out() at the commit

    const fireDetent = (i) => {
      if (i !== s.lastDetent) {
        s.lastDetent = i;
        cb.current.onDetent(out(i), i);
      }
    };

    // Wrap re-base: once the rendered position has drifted a full loop out
    // of the principal range, shift EVERY position register back by whole
    // loops. The strip content repeats every `count` stations (the skin
    // renders clone rows), so the jump is invisible — but the skin's own
    // strip-space CSS vars go stale, hence onRenorm(off). Runs mid-scrub
    // (a long drag can spin multiple loops) and at every ticker stop; never
    // mid-settle, where the close wipe is reading those vars.
    const renorm = () => {
      if (!wrapOn()) return;
      const k = Math.floor(s.d / count);
      if (k === 0) return;
      const off = k * count;
      s.raw -= off;
      s.p -= off;
      s.d -= off;
      s.rawBase -= off;
      s.lastDetent -= off;
      if (s.keyLanded != null) s.keyLanded -= off;
      cb.current.onFrame(s.mode === 'engaged' && (tune().magnet ?? true) ? shape(s.d) : s.d);
      cb.current.onRenorm?.(off);
    };

    const tick = (_t, dtMs) => {
      const dt = Math.min(dtMs, 100) / 1000;
      const tau =
        s.mode === 'engaged' ? PAGER_TAU_SCRUB : s.mode === 'settling' ? TAU_SETTLE : PAGER_TAU_GLIDE;
      s.d += (s.p - s.d) * (1 - Math.exp(-dt / tau));
      fireDetent(Math.round(bound(s.d)));
      cb.current.onFrame(s.mode === 'engaged' && (tune().magnet ?? true) ? shape(s.d) : s.d);
      if (s.mode === 'engaged') renorm();
      if (s.mode !== 'engaged' && Math.abs(s.p - s.d) < 0.002) {
        s.d = s.p;
        cb.current.onFrame(s.d);
        renorm();
        stopTicker();
      }
    };
    const startTicker = () => {
      if (!s.tickerOn) {
        s.tickerOn = true;
        gsap.ticker.add(tick);
      }
    };
    const stopTicker = () => {
      if (s.tickerOn) {
        s.tickerOn = false;
        gsap.ticker.remove(tick);
      }
    };
    // Reduced motion: positions snap per input event, no damper.
    const stepRM = () => {
      s.d = s.p = Math.round(bound(s.raw));
      fireDetent(s.d);
      cb.current.onFrame(s.d);
      renorm();
    };

    const engage = (source, atY) => {
      if (s.mode === 'engaged') return;
      // readBeat/stall included: a stale settle-retract or stall-commit
      // must never fire into the gesture that superseded it.
      clearTimers('hold', 'peek', 'hover', 'readBeat', 'stall');
      s.mode = 'engaged';
      s.raw = s.rawBase = s.d; // seed from the rendered position — no jump on re-engage mid-settle
      s.p = clampResist(s.raw);
      s.baseY = atY ?? 0;
      s.engageSource = source;
      const init = Math.round(bound(s.d));
      s.lastDetent = init;
      cb.current.onDetent(out(init), init); // init readouts
      cb.current.onEngaged(true);
      if (!PREFERS_REDUCED_MOTION && source !== 'key') startTicker();
    };

    const retract = () => {
      clearTimers('readBeat', 'peek', 'stall', 'key');
      s.mode = 'rest';
      cb.current.onEngaged(false);
      cb.current.onCharged(false);
    };

    // Release a touch scrub: flick cast, settle, ONE commit, read beat, retract.
    const releaseGesture = ({ flick }) => {
      clearTimers('hold');
      if (flick && !PREFERS_REDUCED_MOTION) {
        const now = performance.now();
        const win = s.samples.filter((sm) => now - sm.t <= 80);
        if (win.length >= 2) {
          const a = win[0];
          const b = win[win.length - 1];
          const dtS = (b.t - a.t) / 1000;
          if (dtS > 0) {
            const v = (a.y - b.y) / dtS / cb.current.tuning.detentPx; // detents/s, up = forward
            s.raw = clampRaw(s.raw + Math.max(-2, Math.min(2, v * PAGER_FLICK_CARRY_S)));
          }
        }
      }
      const landed = landedIndex();
      s.mode = 'settling';
      s.raw = s.p = landed;
      s.suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
      if (PREFERS_REDUCED_MOTION) stepRM();
      else startTicker();
      // Unconditional: a landing on the active index still cancels any
      // stale deferred commit (the parent clears, then no-ops on active).
      cb.current.commit(out(landed), landed);
      timers.readBeat = setTimeout(retract, READ_BEAT_MS);
    };

    // Desktop stall: commit the landing but STAY open — consecutive wheel
    // bursts read as continued browsing.
    const stallCommit = () => {
      const landed = landedIndex();
      s.raw = s.p = landed;
      if (!PREFERS_REDUCED_MOTION) startTicker();
      else stepRM();
      cb.current.commit(out(landed), landed); // unconditional — see releaseGesture
    };

    const startPeek = () => {
      s.mode = 'peek';
      cb.current.onCharged(false); // peek keeps the rest accent — charge is a held-intent tell
      cb.current.onEngaged(true);
      clearTimers('peek');
      timers.peek = setTimeout(retract, PAGER_PEEK_MS);
    };

    /* ── Pointer (touch/pen scrub; mouse rides hover+wheel) ── */
    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse') return;
      if (s.pointer) return; // first finger keeps ownership — a graze must not steal the gesture
      clearTimers('readBeat'); // a new press supersedes a pending settle-retract
      s.pointer = { id: e.pointerId, y0: e.clientY, t0: performance.now(), moved: 0 };
      s.samples = [{ y: e.clientY, t: performance.now() }];
      try {
        root.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable — gesture still works uncaptured */
      }
      cb.current.onCharged(true);
      if (s.mode === 'engaged') {
        // Already deployed (keyboard/hover engage) — the finger resumes the
        // scrub directly; no hold timer, no mode clobber. The key path runs
        // tickerless, so arm the damper for the finger.
        s.rawBase = s.raw = s.d;
        s.p = clampResist(s.raw);
        s.baseY = e.clientY;
        s.engageSource = 'touch';
        clearTimers('stall'); // a wheel-engage's pending stall-commit must not fire mid finger-scrub
        if (!PREFERS_REDUCED_MOTION) startTicker();
        return;
      }
      if (s.mode === 'peek') {
        clearTimers('peek'); // finger down parks the peek open while we disambiguate
        s.mode = 'peek-pressed';
      } else {
        s.mode = 'pressed';
      }
      clearTimers('hold');
      timers.hold = setTimeout(() => engage('touch', s.pointer?.y0 ?? e.clientY), PAGER_HOLD_MS);
    };

    const onPointerMove = (e) => {
      if (!s.pointer || e.pointerId !== s.pointer.id) return;
      const now = performance.now();
      s.samples.push({ y: e.clientY, t: now });
      while (s.samples.length > 2 && now - s.samples[0].t > 80) s.samples.shift();
      const dy = s.pointer.y0 - e.clientY;
      s.pointer.moved = Math.max(s.pointer.moved, Math.abs(dy));
      if ((s.mode === 'pressed' || s.mode === 'peek-pressed') && Math.abs(dy) > PAGER_SLOP_PX) {
        engage('touch', e.clientY); // impatient slide — practiced users never wait out the timer
      }
      if (s.mode === 'engaged') {
        s.raw = clampRaw(s.rawBase + (s.baseY - e.clientY) / cb.current.tuning.detentPx); // slide up = next
        s.p = clampResist(s.raw);
        if (PREFERS_REDUCED_MOTION) stepRM();
      }
    };

    const onPointerUp = (e) => {
      if (!s.pointer || e.pointerId !== s.pointer.id) return;
      const { t0, moved } = s.pointer;
      s.pointer = null;
      clearTimers('hold');
      // Touch gestures are fully handled here — the browser's trailing
      // synthetic click would land on whatever cell button sits under the
      // finger (the peek's own tap killed the peek it opened). Mouse never
      // enters this handler, so desktop cell clicks stay live.
      s.suppressClickUntil = performance.now() + CLICK_SUPPRESS_MS;
      const wasTap = performance.now() - t0 < PAGER_HOLD_MS && moved < PAGER_SLOP_PX;
      if (s.mode === 'engaged') {
        releaseGesture({ flick: true });
      } else if (s.mode === 'pressed') {
        if (wasTap) startPeek();
        else retract();
      } else if (s.mode === 'peek-pressed') {
        if (wasTap) {
          // Tap on an open tape row = the dot-jump, now behind intent.
          const idx = cb.current.hitTest ? cb.current.hitTest(e.clientY, s.d) : null;
          if (idx != null && idx >= 0 && idx <= max) {
            cb.current.commit(idx); // unconditional — see releaseGesture
            s.raw = s.p = rep(idx);
            if (!PREFERS_REDUCED_MOTION) startTicker();
            else stepRM();
          }
          retract();
        } else {
          startPeek(); // moved but never engaged — settle back into the peek
        }
      }
    };

    const onPointerCancel = (e) => {
      if (!s.pointer || e.pointerId !== s.pointer.id) return;
      s.pointer = null;
      clearTimers('hold');
      if (s.mode === 'engaged') releaseGesture({ flick: false }); // stuck-drag doctrine: land where they were
      else retract();
    };
    const onWindowBlur = () => {
      if (s.pointer) {
        s.pointer = null;
        clearTimers('hold');
        if (s.mode === 'engaged') releaseGesture({ flick: false });
        else retract();
      } else if (s.mode !== 'rest') {
        // Hover/keyboard-engaged and the window lost focus (tab switch) —
        // pointerleave may never fire, and a stuck engage would gate the
        // accumulator forever. Land where they were and retract.
        clearTimers('hover', 'stall');
        flushKey();
        if (s.mode === 'engaged') {
          const landed = landedIndex();
          s.raw = s.p = landed;
          cb.current.commit(out(landed), landed); // unconditional — see releaseGesture
        }
        retract();
      }
    };

    /* ── Desktop hover + wheel ── */
    const onPointerEnter = (e) => {
      if (!desktopHover || e.pointerType !== 'mouse') return;
      s.hovering = true;
      cb.current.onCharged(true); // instant intent tell
      clearTimers('hover');
      timers.hover = setTimeout(() => engage('hover'), HOVER_INTENT_MS);
    };
    const onPointerLeave = (e) => {
      if (e.pointerType !== 'mouse') return;
      s.hovering = false;
      clearTimers('hover', 'stall');
      if (s.mode === 'engaged') {
        // Any un-stalled landing commits on the way out, then retract.
        const landed = landedIndex();
        s.raw = s.p = landed;
        s.mode = 'settling';
        if (!PREFERS_REDUCED_MOTION) startTicker();
        else stepRM();
        cb.current.commit(out(landed), landed); // unconditional — see releaseGesture
        timers.readBeat = setTimeout(retract, READ_BEAT_MS);
      } else if (s.mode === 'peek') {
        retract();
      } else {
        cb.current.onCharged(false);
      }
    };
    const onWheel = (e) => {
      if (!desktopHover) return; // touch wheels by finger; let anything exotic bubble
      e.preventDefault();
      e.stopPropagation(); // main's accumulator never sees pager-aimed wheel — incl. the hover-intent window
      if (s.mode !== 'engaged') engage('wheel'); // first tick = instant engage, and it feeds
      s.raw = clampRaw(s.raw + e.deltaY / cb.current.tuning.wheelDetentPx); // scroll down = next (page parity)
      s.p = clampResist(s.raw);
      if (PREFERS_REDUCED_MOTION) stepRM();
      else startTicker(); // idempotent — covers wheel after a tickerless keyboard engage
      clearTimers('stall');
      const stallMs = tune().stallMs ?? PAGER_STALL_COMMIT_MS;
      if (Number.isFinite(stallMs)) timers.stall = setTimeout(stallCommit, stallMs);
    };

    /* ── Keyboard (no scrub state — plain candidate stepping) ── */
    // Keyboard release: commit the candidate (unconditionally — even a
    // landing on the active index cancels a stale deferred commit), then
    // retract when the KEYBOARD owns the engage — otherwise the engaged
    // latch holds the stage's own wheel/touch paging dead for as long as a
    // cell keeps focus. Hover- and finger-owned engages keep their own
    // exits (pointerleave / release).
    const keyRelease = () => {
      clearTimers('key');
      if (s.keyLanded != null) {
        cb.current.commit(out(s.keyLanded), s.keyLanded);
        s.keyLanded = null;
      }
      if (s.engageSource === 'key' && !s.pointer && !s.hovering && s.mode === 'engaged') {
        // No re-sync to activeRef here: raw/p already sit on the committed
        // candidate, and a deferred Turn would otherwise yo-yo the tape
        // (glide back to the old index, then forward when the lock expires).
        retract();
      }
    };
    const flushKey = keyRelease;
    const keyMove = (to) => {
      if (s.mode !== 'engaged') engage('key');
      const target = wrapOn() ? to : Math.min(max, Math.max(0, to));
      s.raw = s.p = s.d = target;
      fireDetent(target);
      cb.current.onFrame(target);
      s.keyLanded = target;
      renorm();
      clearTimers('key');
      timers.key = setTimeout(keyRelease, PAGER_KEY_COMMIT_MS);
    };
    const onKeyDown = (e) => {
      const cur = s.keyLanded ?? Math.round(bound(s.raw));
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          keyMove(cur + 1);
          break;
        case 'ArrowUp':
        case 'ArrowLeft':
          keyMove(cur - 1);
          break;
        case 'Home':
          keyMove(0);
          break;
        case 'End':
          keyMove(max);
          break;
        case 'Enter':
        case ' ':
          if (s.keyLanded == null) return; // plain activation (cell click) stays native
          flushKey();
          break;
        case 'Escape':
          clearTimers('key');
          s.keyLanded = null;
          cb.current.commit(activeRef.current); // cancels any deferred commit (parent clears, then no-ops)
          s.raw = s.p = rep(activeRef.current);
          if (!PREFERS_REDUCED_MOTION) startTicker();
          else stepRM();
          retract();
          break;
        default:
          return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    const onFocusIn = (e) => {
      // A skin moving its own roving tabstop is not user intent: after a
      // keyboard commit the engine has already retracted, and re-reading
      // that synthetic focusin as an engage left the pager deployed with
      // the stage dimmed and its own paging muted (see focusSilently).
      if (s.silentFocus) return;
      // Keyboard focus only — a tap's focus synthesis also lands here, and
      // deploying on it left the pager stuck open on mobile (no peek timer).
      const keyboardFocus =
        e.target && typeof e.target.matches === 'function' && e.target.matches(':focus-visible');
      if (keyboardFocus && s.mode === 'rest') {
        cb.current.onCharged(true);
        engage('key');
      }
    };
    const onFocusOut = (e) => {
      if (root.contains(e.relatedTarget)) return;
      flushKey(); // an arrow-chosen candidate the user tabbed away from still lands
      retract();
    };

    /* ── Suppression: main's accumulator must never see a pager gesture ── */
    const stopTouch = (e) => e.stopPropagation();
    const stopTouchMove = (e) => {
      e.stopPropagation();
      e.preventDefault(); // belt over touch-action:none
    };
    const onClickCapture = (e) => {
      if (performance.now() < s.suppressClickUntil) {
        e.stopPropagation();
        e.preventDefault();
      }
    };
    const onContextMenu = (e) => e.preventDefault(); // iOS long-press callout

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerCancel);
    root.addEventListener('lostpointercapture', onPointerCancel);
    root.addEventListener('pointerenter', onPointerEnter);
    root.addEventListener('pointerleave', onPointerLeave);
    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('touchstart', stopTouch, { passive: false });
    root.addEventListener('touchmove', stopTouchMove, { passive: false });
    root.addEventListener('touchend', stopTouch, { passive: false });
    root.addEventListener('touchcancel', stopTouch, { passive: false });
    root.addEventListener('click', onClickCapture, true);
    root.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onWindowBlur);

    // Initial paint + public api.
    cb.current.onFrame(s.d);
    apiRef.current.close = (target) => {
      // A cell click passes its index — activeRef stays stale until React
      // commits (and through a deferred-lock window), and seeding from it
      // would glide the tape backward before reversing.
      s.raw = s.p = rep(Math.min(max, Math.max(0, target ?? activeRef.current)));
      if (!PREFERS_REDUCED_MOTION) startTicker();
      else stepRM();
      retract();
    };
    apiRef.current.isEngaged = () => s.mode === 'engaged';
    // Move the roving tabstop WITHOUT arming the focus engage. The skins
    // must keep focus on the cell the Turn landed on — focus stranded on a
    // stale cell carries tabindex=-1 while aria-current has moved, and a
    // trailing Enter there reverts the Turn just committed.
    apiRef.current.focusSilently = (el) => {
      if (!el || typeof el.focus !== 'function') return;
      s.silentFocus = true;
      try {
        el.focus({ preventScroll: true });
      } finally {
        // focus() dispatches focusin synchronously; the task hop is the
        // belt for engines that defer it.
        setTimeout(() => {
          s.silentFocus = false;
        }, 0);
      }
    };
    // External Turn (CTA scroll paging) — glide to the new index on the
    // marker's own τ so the tape follows the page. Refuse only while a
    // gesture owns the position; peeks follow along (an external Turn
    // mid-peek must not strand the resting number).
    apiRef.current.follow = (i) => {
      if (s.mode === 'pressed' || s.mode === 'peek-pressed' || s.mode === 'engaged') return;
      s.raw = s.p = rep(Math.min(max, Math.max(0, i)));
      if (PREFERS_REDUCED_MOTION) stepRM();
      else startTicker();
    };

    return () => {
      clearTimers('hold', 'peek', 'hover', 'stall', 'key', 'readBeat');
      stopTicker();
      root.removeEventListener('pointerdown', onPointerDown);
      root.removeEventListener('pointermove', onPointerMove);
      root.removeEventListener('pointerup', onPointerUp);
      root.removeEventListener('pointercancel', onPointerCancel);
      root.removeEventListener('lostpointercapture', onPointerCancel);
      root.removeEventListener('pointerenter', onPointerEnter);
      root.removeEventListener('pointerleave', onPointerLeave);
      root.removeEventListener('wheel', onWheel);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('touchstart', stopTouch);
      root.removeEventListener('touchmove', stopTouchMove);
      root.removeEventListener('touchend', stopTouch);
      root.removeEventListener('touchcancel', stopTouch);
      root.removeEventListener('click', onClickCapture, true);
      root.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onWindowBlur);
      if (s.mode !== 'rest') {
        cb.current.onEngaged(false); // parent engaged-ref/class must not stick across unmount
        cb.current.onCharged(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return apiRef.current;
}
