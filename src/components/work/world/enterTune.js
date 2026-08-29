/**
 * enterTune.js — live tuning state for the ENTER-THE-WORLD choreography
 * (the /work → project-detail transition) + the ?entertune=1 bench gate.
 *
 * The model mirrors Hero.beginEnvelopment's commit choreography (08-25
 * concurrent windows): ONE linear master timeline of `enterMs`; each channel
 * rides its own [start, end] window on it with a power-inOut curve (`pow`):
 *
 *   · LENS over [lensStart, lensEnd] — adds `lens` to the base distortion at
 *     full ramp. `lens` is NEGATIVE by design: the base warp is already
 *     negative (inside-a-sphere pull, see worldConfig LENS_DISTORTION), so
 *     deepening it reads as diving further INTO the sphere. (The retired
 *     ENTER_LENS_SWELL was +0.32 — added to −0.15 it crossed zero into an
 *     outward barrel bow + edge shrink, the exact "bowing outward and scaling
 *     down" bug this store replaces.)
 *   · MOVE over [moveStart, moveEnd] — camera dolly toward the tiles (`dolly`
 *     world units) + projection zoom 1 → `scale`. The zoom scales the WHOLE
 *     frame (shell grid included — the dolly alone barely moves the
 *     radius-16 shell), so grid + tiles swell upward in sync with the
 *     deepening curvature.
 *
 * Consumers read ENTER_TUNABLES live at run time (useWorldScene's enter ramp
 * per frame, WorldCard's commit at click), so the ?entertune=1 bench
 * (EnterTunePanel) moves the NEXT run with no rebuild. Defaults reproduce a
 * corrected version of the shipped gesture; URL params seed on load (the
 * worldConfig ?key=value convention) and copy_url serializes only
 * off-default values (heroConfig convention).
 */

const search = () =>
  new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);

/* Defaults = Nathan's 08-26 bake (dialed on the ?entertune bench): a gentle
   lens deepen under a BIG open-ended zoom — the move window is 2× the
   timeline with a punchy pow, so at handoff the push-in is still steeply
   mid-rise (an open-ended read, the recenterEnd-3 idiom), never parked. */
export const ENTER_TUNE_DEFAULTS = Object.freeze({
  enterMs: 1100, // master timeline length, ms — also the RouteFill cover duration (they are one gesture)
  lens: -0.07, // additive distortion at full ramp — NEGATIVE deepens the inside-a-sphere pull
  lensStart: 0, // timeline fraction where the lens deepen begins
  lensEnd: 1, // timeline fraction where the lens deepen lands
  scale: 3.2, // projection-zoom destination (1 = off) — scales grid + tiles together
  dolly: 1, // camera dolly toward the tiles, world units
  moveStart: 0, // timeline fraction where dolly + zoom begin
  moveEnd: 2, // timeline fraction where dolly + zoom land (2 = window overruns the handoff)
  pow: 7, // power-inOut exponent for BOTH channels (2 = gentle, 3+ = punchier middle)
  holdMs: 10, // dry-run only: hold at full ramp before unwinding
  cover: 1, // dry-run only: 1 = raise the RouteFill cover too (the real gesture reads UNDER it)
});

/* Shared channel math (Hero.beginEnvelopment's commit model) — exported so
   the scene ramp AND the text-exit choreography (textExit.js) shape their
   windows with the SAME functions and can never drift. */
export const powInOut = (t, pow) =>
  t < 0.5 ? 0.5 * Math.pow(2 * t, pow) : 1 - 0.5 * Math.pow(2 * (1 - t), pow);
export const seg = (e, a, b) => Math.min(1, Math.max(0, (e - a) / ((b - a) || 1e-6)));

/* URL param names — ?enterzoom keeps its historical meaning (the dolly,
   world units); the new projection zoom is ?enterscale. ?enterlens keeps its
   name but its default FLIPS SIGN with the bug fix (was +0.32). */
const PARAM_KEYS = {
  enterMs: 'enterms',
  lens: 'enterlens',
  lensStart: 'enterlensa',
  lensEnd: 'enterlensb',
  scale: 'enterscale',
  dolly: 'enterzoom',
  moveStart: 'entermovea',
  moveEnd: 'entermoveb',
  pow: 'enterpow',
  holdMs: 'enterhold',
  cover: 'enterfill',
};

// Live, mutable tuning state (the panel writes; the scene + card read).
export const ENTER_TUNABLES = { ...ENTER_TUNE_DEFAULTS };

// Seed from the URL — always, not just under ?entertune (a copied tuning link
// reproduces the choreography standalone). ?entercover=<ms> is the legacy
// duration knob (pre-bench WorldCard) — honored as an enterMs seed, with the
// canonical ?enterms winning when both are present.
if (typeof window !== 'undefined') {
  const p = search();
  const legacy = parseFloat(p.get('entercover'));
  if (Number.isFinite(legacy)) ENTER_TUNABLES.enterMs = legacy;
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    const n = parseFloat(p.get(param));
    if (Number.isFinite(n)) ENTER_TUNABLES[key] = n;
  }
}

/* pub/sub — the bench's fields subscribe to reflect external writes (reset,
   a URL reseed). The scene doesn't subscribe: it reads live at run time. */
const subs = new Set();
export function subscribeEnterTune(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
function publish() {
  subs.forEach((fn) => fn());
}

export function setEnterTune(key, value) {
  if (ENTER_TUNABLES[key] === value) return;
  ENTER_TUNABLES[key] = value;
  publish();
}
export function resetEnterTune() {
  Object.assign(ENTER_TUNABLES, ENTER_TUNE_DEFAULTS);
  publish();
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

/** Shareable tuning URL — entertune=1 plus only the off-default params. */
export function enterTuneCopyUrl() {
  const p = new URLSearchParams(window.location.search);
  p.set('entertune', '1');
  for (const [key, param] of Object.entries(PARAM_KEYS)) {
    if (Math.abs(ENTER_TUNABLES[key] - ENTER_TUNE_DEFAULTS[key]) > 1e-9) {
      p.set(param, String(round4(ENTER_TUNABLES[key])));
    } else {
      p.delete(param);
    }
  }
  p.delete('entercover'); // the legacy alias must not fight the canonical ?enterms
  return `${window.location.origin}${window.location.pathname}?${p.toString()}`;
}
