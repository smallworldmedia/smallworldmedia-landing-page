/**
 * TapeWheelPager — the ?pager=tape variant (docs/fp-pager-rework-approaches.md,
 * approach A). One chip at the rail seat; press-hold (touch) or hover
 * (desktop) opens a feathered tape window and the number tape rolls under a
 * fixed accent reading line — content moves, the window doesn't. Release
 * commits exactly ONE Turn via the parent's requestGoTo.
 *
 * Rendering split: React owns structure + low-frequency state (open/charged);
 * the shared gesture engine writes per-frame tape transforms through
 * quickSetters and hard-cuts the name/aria readouts at detent crossings.
 * Two tape copies ride ONE transform value — copy A dimmed in the housing,
 * copy B clipped inside the reading-line band (the window-with-inverted-copy
 * technique), so the on-line number wears the band's ink with zero per-frame
 * styling.
 */
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { usePagerGesture } from './usePagerGesture.js';
import { PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';
import { PAGER_DETENT_TOUCH_PX, PAGER_DETENT_WHEEL_PX } from '../../../lib/motion.js';

const pad2 = (n) => String(n + 1).padStart(2, '0');
// Live tuning (?key=value) — the FeaturedProjects knobs convention.
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};

export default function TapeWheelPager({ worlds, active, commit, onEngaged }) {
  const rootRef = useRef(null);
  const windowRef = useRef(null);
  const tapeARef = useRef(null);
  const tapeBRef = useRef(null);
  const nameRef = useRef(null);
  const nameTrackRef = useRef(null);
  const liveRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [charged, setCharged] = useState(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  // Row height + transform setters resolve lazily at first frame-write (the
  // client:only stale-DOM doctrine: never cache DOM in mount closures that
  // outlive a re-render; refs here are owned by THIS mount).
  const gearRef = useRef(null);
  const gear = () => {
    if (!gearRef.current && tapeARef.current && tapeBRef.current) {
      gearRef.current = {
        rowH: tapeARef.current.firstElementChild?.offsetHeight || 0,
        a: gsap.quickSetter(tapeARef.current, 'y', 'px'),
        b: gsap.quickSetter(tapeBRef.current, 'y', 'px'),
      };
    }
    return gearRef.current;
  };

  const lastQRef = useRef(active);
  const writeFrame = (q) => {
    lastQRef.current = q;
    const g = gear();
    if (!g || !g.rowH) return;
    const y = -(q + 0.5) * g.rowH;
    g.a(y);
    g.b(y);
  };

  // --tape-row re-tiers at 768px (desktop resize / rotation): drop the
  // cached geometry and re-register the tape at the new row height NOW,
  // not on the next gesture.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onTier = () => {
      gearRef.current = null;
      writeFrame(lastQRef.current);
    };
    mq.addEventListener('change', onTier);
    return () => mq.removeEventListener('change', onTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detent hard-cut: name plate text + marquee re-measure + aria-live.
  // The number needs no cut — the tape position IS the number (split-flap).
  const setStation = (i) => {
    const w = worlds[i];
    const track = nameTrackRef.current;
    if (!w || !track) return;
    track.children[0].textContent = w.clientName;
    track.children[1].textContent = w.clientName;
    const nameEl = nameRef.current;
    if (nameEl) {
      // Cap mirrors --tape-name-max (13.08rem @ 14px root; 52vw floor on
      // phones) — the animated max-width can't be read mid-transition.
      const capPx = window.matchMedia('(max-width: 768px)').matches
        ? Math.min(window.innerWidth * 0.52, 13.08 * 14)
        : 13.08 * 14;
      // No marquee under reduced motion — a frozen marquee state would
      // leave the feathered name permanently faded; the hard clip reads.
      const over = track.children[0].offsetWidth > capPx && !PREFERS_REDUCED_MOTION;
      if (over) nameEl.setAttribute('data-marquee', '');
      else nameEl.removeAttribute('data-marquee');
    }
    // Announce only on a real change: the engine re-inits the readout at
    // every engage, stall-commit and retract, and a screen reader replays
    // an aria-live node whose text is REASSIGNED, identical or not.
    const label = `Project ${i + 1} of ${worlds.length} — ${w.clientName}`;
    if (liveRef.current && liveRef.current.textContent !== label) {
      liveRef.current.textContent = label;
    }
  };

  const engine = usePagerGesture({
    rootRef,
    count: worlds.length,
    activeRef,
    commit,
    onEngaged: (v) => {
      setOpen(v);
      onEngaged(v);
      // Focus can nudge the overflow-hidden window's scroll offset and break
      // the transform illusion — pin it whenever the state flips.
      if (windowRef.current) windowRef.current.scrollTop = 0;
    },
    onCharged: setCharged,
    onFrame: writeFrame,
    onDetent: setStation,
    hitTest: (clientY, q) => {
      const rect = windowRef.current?.getBoundingClientRect();
      const g = gear();
      if (!rect || !g || !g.rowH) return null;
      const i = Math.floor((clientY - rect.top - rect.height / 2) / g.rowH + q + 0.5);
      return i >= 0 && i < worlds.length ? i : null;
    },
    tuning: {
      // Floors, not raw reads: ?detent=0 divides the finger delta by zero
      // (±Infinity raw → NaN one step later → commit(NaN)).
      detentPx: Math.max(8, PARAM('detent', PAGER_DETENT_TOUCH_PX)),
      wheelDetentPx: Math.max(8, PARAM('wheeldetent', PAGER_DETENT_WHEEL_PX)),
    },
  });

  // A Turn from any other path (CTA scroll, envelopment restore) glides the
  // tape to the new index — the marker-follow idiom, engine-owned τ. The
  // roving tabstop follows too: focus stranded on a stale cell would make
  // a trailing Enter revert the Turn just committed.
  useEffect(() => {
    engine.follow(active);
    const focused = document.activeElement;
    const rootEl = rootRef.current;
    // focusSilently, never a bare focus(): a keyboard commit retracts
    // synchronously (keyRelease), so a plain focus() here fires a fresh
    // :focus-visible focusin that RE-ENGAGES the pager — deployed, stage
    // dimmed, its own paging muted until Tab-away. The tabstop still has
    // to move: focus stranded on the old cell carries tabindex=-1 while
    // aria-current has moved on, and a trailing Enter would revert the
    // Turn just committed.
    if (rootEl && focused && rootEl.contains(focused) && focused.classList.contains('fp-tape__cell')) {
      const cellEl = tapeARef.current?.children[active];
      if (cellEl && cellEl !== focused) engine.focusSilently(cellEl);
      if (windowRef.current) windowRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const cells = (interactive) =>
    worlds.map((w, i) => {
      if (!interactive) {
        return (
          <span key={w.slug} className="fp-tape__cell">
            {pad2(i)}
          </span>
        );
      }
      return (
        <button
          key={w.slug}
          type="button"
          className="fp-tape__cell"
          aria-label={`Go to ${w.clientName} (project ${i + 1} of ${worlds.length})`}
          aria-current={i === active ? 'true' : undefined}
          tabIndex={i === active ? 0 : -1}
          onClick={() => {
            // Desktop cell click (touch taps resolve via the engine's
            // hitTest — capture retargets touch clicks to the root).
            // Unconditional commit: even the active cell cancels a stale
            // deferral. close(i): activeRef is stale until React commits.
            commit(i);
            engine.close(i);
          }}
        >
          {pad2(i)}
        </button>
      );
    });

  return (
    <nav
      className="fp-tape"
      ref={rootRef}
      aria-label="Featured project pager"
      data-open={open || undefined}
      data-charged={charged || undefined}
      // SSR-correct seed: the CSS base transform reads --tape-i until the
      // engine's first quickSetter write takes over (inline transform wins).
      style={{ '--tape-i': active }}
    >
      <div className="fp-tape__window" ref={windowRef}>
        <div className="fp-tape__tape" ref={tapeARef}>
          {cells(true)}
        </div>
        <div className="fp-tape__line" aria-hidden="true">
          <div className="fp-tape__tape" ref={tapeBRef}>
            {cells(false)}
          </div>
        </div>
      </div>
      <div className="fp-tape__name" ref={nameRef} aria-hidden="true">
        <span className="fp-tape__name-track" ref={nameTrackRef}>
          <span>{worlds[active]?.clientName}</span>
          <span>{worlds[active]?.clientName}</span>
        </span>
      </div>
      <span className="sr-only" aria-live="polite" ref={liveRef} />
    </nav>
  );
}
