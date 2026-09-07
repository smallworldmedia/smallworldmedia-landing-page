/**
 * GraticulePager — the ?pager=scale variant (docs/fp-pager-rework-approaches.md,
 * approach B). The quiet counterpoint to the tape: a chart instrument, not a
 * machine. A flush margin-tab chip — a stacked fraction, pad2(active) over a
 * 1px rule over pad2(N) — is the fixed LENS; press-hold (touch) / hover
 * (desktop) charges it and the SCALE (one strip of major ticks and pad2
 * numbers — the minor half-station ticks were deleted in round 6) slides
 * 1:1 under the pinned lens — the inverse of the old fisheye rail. Release
 * commits exactly ONE Turn via the parent's requestGoTo.
 *
 * Rendering split: React owns structure + low-frequency state (open/charged)
 * and NOTHING else — the lens number, the preview label and the aria-live
 * text are seeded once at mount and owned by the engine from then on (a
 * lock-deferred Turn re-rendering `active` mid-gesture would otherwise write
 * the stale station back over the engine's readout). The engine writes the
 * strip transform per frame through one quickSetter and hard-cuts the
 * readouts (+ flashes the crossed tick) at detent crossings.
 *
 * Geometry is derived in CSS off one imperative root var, so a commit
 * deferred behind the Turn lock can never leave the cascade keyed to a
 * station the lens has already left:
 *   --scale-c  the station under the lens RIGHT NOW (every detent) — drives
 *              each station's cascade distance and the engaged hit pad
 * (--scale-q — the hairline's old strip-space close origin — retired in
 * round 7: the axis line is a screen-space SVG in the window now, so its
 * close wipe always converges on the fixed lens line, no origin var.)
 * The deployed scale is bounded by --scale-rows: a feathered, overflow-clipped
 * window centred on the lens, so 13 stations can never run under the fixed
 * nav lockup or off the bottom of a phone (stations outside it are clipped,
 * inert and un-tappable — the strip still slides 1:1, so they scrub into
 * view).
 *
 * The visual pitch IS the finger's px-per-detent: --scale-pitch is written
 * inline from the engine's detentPx (single source of truth; the global.css
 * token is the pre-hydration fallback), so a ?detent override re-pitches the
 * scale too and the two can never drift apart.
 *
 * 09-02 refinements (Nathan's post-pick notes):
 * - Every station carries its CLIENT NAME right of the axis while deployed
 *   (the current row's inline name yields — opacity keys off --i — because
 *   the preview label / zoomed label already carries it).
 * - ?wrap (default ON) makes the list a WHEEL: CLONE_ROWS ghost rows are
 *   rendered beyond each end, the engine runs unbounded (tuning.wrap) and
 *   hands this skin the UNWRAPPED strip position (second arg on
 *   onDetent/commit) for --scale-c, plus onRenorm(off) when it
 *   silently re-bases a full loop back onto clone content.
 * The engaged stage-dim is replaced by a full-viewport scrim for this arm
 * (.fp[data-pager='scale']::before — featured-projects.css).
 *
 * 09-03 round 4 (Nathan's screenshot: the preview label doubled the roster's
 * own row — two NUSONIDOs on screen): the PREVIEW LABEL IS GONE and the
 * station row under the lens IS the selected display. Every row rides its
 * continuous f² proximity to the lens (--scale-qf) from roster scale/ink up
 * to --scale-sel (the [select_project] size) — number and name pass
 * seamlessly as ONE element. The engine's detent MAGNET is ON for this arm
 * now (the strip hangs on a station, then rubber-bands to the next — the
 * weight Nathan asked for); the chip yields while deployed (bg transparent,
 * digits out) so the scaled row owns the seat, and a selected name that
 * clips gets the next-chip TICKER (the tape's marquee idiom — data-marquee
 * armed per detent on the row under the lens only). All per-frame channels
 * are transition-free; no dimming anywhere in the changeover.
 *
 * 09-04 round 7 (Nathan's notes): bigger lens pointer; the wheel SEAM — a
 * rule between the last and first stations at every loop boundary (own
 * strip-level elements, NOT a station pseudo: the r6 minor-tick lesson —
 * they must not ride the selected row's transform); the ticker hard-clips
 * flush at the box edge (fade mask + trailing pad gone while marqueeing);
 * the axis HAIRLINE is a screen-space SVG PATH in the window, curved to
 * the warp's implied cylinder (in screen space the barrel is a STATIC
 * ellipse — x = X0·√(1 − (u/R·pitch)²) — because screen offset
 * u = R·sin(δ/R)·pitch and row scale cos(δ/R) are the same circle; it no
 * longer rides the strip, so the whole --scale-q close-origin machinery is
 * deleted and the close wipe just converges on the fixed lens line);
 * desktop rest chip + hint at the corner pills' --text-link; ?scrimtune
 * bench (FeaturedProjects) dials scrim opacity/blur/grain live.
 *
 * 09-03 round 6 (Nathan's screenshot: stacked names behind the scrim, the
 * minor tick scaling with the selected row, the axis line slicing the
 * scaled number): the desktop wheel STALL-COMMIT IS GONE — a settle is a
 * preview and the Turn evaluates only at disengage (stallMs: Infinity =
 * the engine's pointerleave-only contract), so sequential settles can no
 * longer stack frozen Turns under the paused globalTimeline. The minor
 * (half-station) ticks are deleted, and the flipper box moved INSIDE the
 * strip (hair → box → stations paint order) and runs seat-edge → name end,
 * so number AND name sit on solid near-black in front of the axis line.
 * ?magnet baked 2.2, ?fliptau baked 0.005 (Nathan's device dial).
 *
 * 09-02 round 2 (?chipzoom scrapped — the flown name doubled the card's own
 * headline): body face at the next/previous chips' size, scaled-up geometry
 * (44/48px pitch), the FP-1 house pulse on the resting number cell (a
 * dim-gray veil + white number on the canonical envelope; killed for the
 * whole gesture, re-armed at rest after the accent transition), ?selectlabel
 * (default ON) — the rotated select_project hint above the chip that wipes
 * downward on engage, ?feather=<px> — the window feather radius, ?pause
 * (default OFF) — the pause screen (scene loop + GSAP tweens + CSS chrome
 * animations hold, scrim goes input-solid, [select_project] at centre with
 * the house random letter exit on release), and ?scalewarp (default OFF) —
 * rows wear a cylindrical lens projection of their continuous distance from
 * the lens (--scale-qf per frame; hitTest inverts the same math).
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import gsap from 'gsap';
import { usePagerGesture } from './usePagerGesture.js';
import { PREFERS_REDUCED_MOTION } from '../world/worldConfig.js';
import { SCRIM_GRAIN, SCRIM_GRAIN_MOBILE, noiseUri } from '../scrimNoise.js';
import {
  SCALE_PITCH_PX,
  SCALE_PITCH_MOBILE_PX,
  SCALE_WHEEL_DETENT_PX,
  SCALE_END_RESIST,
  SCALE_MAGNET_EXP,
  SCALE_FLIP_TAU_S,
  ensureHousePulse,
  HOUSE_PULSE_PERIOD_S,
  HOUSE_PULSE_ON_RATIO,
} from '../../../lib/motion.js';

const pad2 = (n) => String(n + 1).padStart(2, '0');
// 09-07: the secondary token — the project's Sanity title when it adds
// something (the detail page's own rule: a title equal to the client name
// is the client name). Null → no sub span, no trailing gap.
const subOf = (w) =>
  w.title && w.title.trim().toLowerCase() !== (w.clientName || '').trim().toLowerCase()
    ? w.title.trim()
    : null;
const nameOf = (w) => (subOf(w) ? `${w.clientName} ${subOf(w)}` : w.clientName);
// 09-07 (Nathan, "option 3"): the services READOUT string — the project's
// service tags (the card's own `services` shape), ' · '-separated (a
// slash collides with "Event / Tour Creative"); CSS uppercases it in the
// mono face. Null when the project carries none.
const tagsOf = (w) => {
  const names = (w.services || []).map((t) => t?.name).filter(Boolean);
  return names.length ? names.join(' · ') : null;
};
// Live tuning (?key=value) — the FeaturedProjects knobs convention.
const PARAM = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  const n = parseFloat(new URLSearchParams(window.location.search).get(key));
  return Number.isFinite(n) ? n : fallback;
};
// Floor, not a raw read: ?detent=0 divides the finger delta by zero
// (±Infinity raw → NaN one step later → commit(NaN)) and collapses the
// station pitch to 0px.
const MIN_DETENT_PX = 8;
// Ghost rows rendered beyond each end under ?wrap — must cover --scale-rows
// on every tier (7 desktop / 6 mobile; the CSS reads it back as
// --scale-clones, written inline, so the two can never drift).
const CLONE_ROWS = 8;
const MOBILE_TIER = '(max-width: 768px)';
const mobileTier = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_TIER).matches;

export default function GraticulePager({ worlds, active, commit, onEngaged }) {
  const rootRef = useRef(null);
  const stripRef = useRef(null);
  const stationsRef = useRef(null);
  const lensRef = useRef(null);
  const numRef = useRef(null);
  const boxRef = useRef(null); // the flipper box (round 5)
  const liveRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [charged, setCharged] = useState(false);
  // Synchronous twin of `open`: the engine fires its engage-init detent
  // BEFORE onEngaged(true) and its glide crossings AFTER onEngaged(false),
  // and neither is a crossing the user made.
  const openRef = useRef(false);
  const mountedRef = useRef(false); // the [active] effect's first run is the mount, not a landing
  const prevDetentRef = useRef(active);
  // Tier bump: the 768px re-tier must re-resolve detentPx (per-render read)
  // so the finger unit follows the token's mobile value, not just the CSS.
  const [tierN, retier] = useReducer((n) => n + 1, 0);
  const activeRef = useRef(active);
  activeRef.current = active;
  const count = worlds.length;
  const pmod = (i) => ((i % count) + count) % count;
  // ?wrap — the wheel (default ON, Nathan 09-02): the scale loops past both
  // ends, so project 01 shows the last project above it. ?chipzoom — the A/B
  // pair on the engaged label flight (default OFF = the plain variation).
  const wrap = count > 1 && PARAM('wrap', 1) > 0;
  const cloneOff = wrap ? CLONE_ROWS : 0;
  // Round-2 knobs (09-02): ?selectlabel — the rotated hint above the chip
  // (default ON); ?feather — window feather radius in px (0/absent = the
  // token's two-pitch default); ?pause — the pause-screen variant; ?scalewarp
  // — the cylindrical lens-warp variant (--scale-qf written per frame).
  const hintOn = PARAM('selectlabel', 1) > 0;
  // ?magnet — the tension curve's exponent (round 5): higher = longer hang
  // on the current station + steeper snap across the threshold. Clamped:
  // below 1 the curve ANTI-magnetizes, past 8 the crossing aliases a frame.
  const magnetExp = Math.min(8, Math.max(1, PARAM('magnet', SCALE_MAGNET_EXP)));
  // ?fliptau — the flipper box's spring τ in SECONDS: fast enough to read
  // attached during the hang, slow enough that the threshold flick is a
  // motion, not a teleport. Floored at 0.001 (0 divides dt away → teleport;
  // negative blows the damper up; the floor sits below the 0.005 bake so
  // the default is never silently clamped); capped at 1 (past that it just
  // drags).
  const flipTau = Math.min(1, Math.max(0.001, PARAM('fliptau', SCALE_FLIP_TAU_S)));
  const featherPx = Math.max(0, PARAM('feather', 0));
  // Round 11 (Nathan): the proximity curve's dials — radius in stations
  // (?falloff), the full-size plateau either side of the lens
  // (?falloffhold) and the roll-off exponent (?falloffexp). Absent = the
  // global.css tokens (--scale-falloff 3.5 / -hold 1 / -exp 1.5). Written
  // inline on the root so the station CSS reads them per frame.
  const falloff = PARAM('falloff', 0);
  const falloffHold = PARAM('falloffhold', -1);
  const falloffExp = PARAM('falloffexp', 0);
  // ?hairslice (default ON, r11): each station draws its own slice of the
  // axis stroke so it scales with the row; 0 = the r7 screen-space SVG.
  const sliceOn = PARAM('hairslice', 1) > 0;
  // r11c: the centre stagger — reach (stations to straight), taper
  // exponent, amplitude (0..1 of the selected row's protrusion); absent =
  // the tokens (4 / 2 / 1).
  const sliceReach = PARAM('slicereach', 0);
  const sliceExp = PARAM('sliceexp', 0);
  const sliceAmp = PARAM('sliceamp', -1);
  // r11e: the scale AMOUNT dials — the neighbour/landing size and the
  // centre row's extra lift (tokens --scale-sel 1.688 / --scale-sel-bump
  // 1.15); the box, the caps and the stagger all read the same tokens.
  const selScale = PARAM('selscale', 0);
  const selBump = PARAM('selbump', 0);
  // r11g: roster base-size multiplier + the ink's own curve (reach /
  // exponent / floor) — tokens --scale-roster 1, --scale-ink-* 4 / 1 / .55.
  const roster = PARAM('roster', 0);
  const inkReach = PARAM('inkreach', 0);
  const inkExp = PARAM('inkexp', 0);
  const inkFloor = PARAM('inkfloor', -1);
  // 09-06: the [select_project] chip's exit-wipe beat in ms (?chipwipe).
  const chipWipe = PARAM('chipwipe', 0);
  // 09-07: the name cap in px (?namemax) — desktop token 20rem; ≤768 the
  // cap is evaluated from the viewport and this overrides it too.
  const nameMax = PARAM('namemax', 0);
  // 09-07 (Nathan): the project TITLE (Sanity `title`, e.g. "(Pre-2026)")
  // rides after the client name as a smaller secondary token — body
  // family, sentence case, dimmed. ?sub = its size as an em ratio of the
  // row (token --scale-sub .62); ?subink = its ink as a fraction of the
  // row's colour (token --scale-sub-ink .7). Rendered inside the name's
  // copy so the cap, the ticker measure and the box width all include it.
  const subScale = PARAM('sub', 0);
  const subInk = PARAM('subink', -1);
  // 09-07 (Nathan, "option 3", desktop only): the SERVICES READOUT under
  // the selected name inside the taller box (?tags=0 drops it AND the row
  // shift — token --scale-tags-h zeroed), ?tagsh = the line's unscaled
  // height in px, ?fillpxs = the fill ticker's speed (unscaled px/s),
  // ?boxgap = the min gap between the fixed box and the [select_project]
  // chip in px.
  const tagsOn = PARAM('tags', 1) > 0;
  const tagsH = PARAM('tagsh', 0);
  const tagSize = PARAM('tagsize', 0); // the readout's size, em ratio of the row
  const fillPxs = PARAM('fillpxs', 0);
  const boxGap = PARAM('boxgap', 0);
  // Baked 09-03 (Nathan): pause screen + lens warp are the defaults; the
  // knobs stay live (?pause=0 / ?scalewarp=0) per the guide doctrine.
  const pauseOn = PARAM('pause', 1) > 0;
  const warpOn = PARAM('scalewarp', 1) > 0;

  // Per-render tuning: the pitch defaults per tier (SCALE_PITCH_*) and is
  // written back to the CSS as --scale-pitch, so the scale and the finger
  // share ONE number whatever ?detent says.
  const detentPx = Math.max(
    MIN_DETENT_PX,
    PARAM('detent', mobileTier() ? SCALE_PITCH_MOBILE_PX : SCALE_PITCH_PX)
  );

  // React writes the readout ONCE, at mount. After that only setStation
  // touches these nodes — React re-rendering `active` mid-gesture (a Turn
  // deferred behind the previous Turn's lock) would otherwise setTextContent
  // the stale station over the engine's live readout for up to ~1.7s.
  const [seedNum] = useState(() => pad2(active));

  // Pitch + transform setter resolve lazily at first frame-write (the
  // client:only stale-DOM doctrine: never cache DOM in mount closures that
  // outlive a re-render; refs here are owned by THIS mount). The window
  // reach (--scale-rows) is read from the computed tokens.
  const hairPathRef = useRef(null);
  // Round 7: the axis hairline is a screen-space SVG path in the window.
  // Under warp the rows' cylinder is a STATIC shape in screen space — a row
  // at screen offset u from the lens wears scale cos(δ/R) where
  // u = R·sin(δ/R)·pitch, so cos = √(1 − (u/(R·pitch))²): the barrel is an
  // ellipse arc, independent of the strip position. The line hugs each
  // row's own axis crossing (rows scale about x = 0) instead of slicing
  // straight through the shrunken edge names. Rebuilt with the gear (pitch
  // / tier / warp radius); straight without warp.
  const buildHair = (g) => {
    const el = hairPathRef.current;
    if (!el) return;
    const half = g.rows * g.pitch;
    const x0 = (lensRef.current?.getBoundingClientRect().width || 42) - 0.5;
    if (!warpOn) {
      el.setAttribute('d', `M${x0} 0 L${x0} ${half * 2}`);
      return;
    }
    const r = g.warpR * g.pitch;
    const steps = 48;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const u = -half + (2 * half * i) / steps;
      const c = Math.sqrt(Math.max(0, 1 - (u / r) ** 2));
      pts.push(`${(x0 * c).toFixed(2)} ${(half + u).toFixed(2)}`);
    }
    el.setAttribute('d', `M${pts.join(' L')}`);
  };
  const gearRef = useRef(null);
  const gear = () => {
    if (!gearRef.current && stripRef.current && rootRef.current) {
      const cs = getComputedStyle(rootRef.current);
      const rows = parseFloat(cs.getPropertyValue('--scale-rows')) || 0;
      gearRef.current = {
        pitch: detentPx,
        rows,
        warpR: parseFloat(cs.getPropertyValue('--scale-warp-r')) || 8,
        // 09-07: the readout's painted height in STATIONS — the rows
        // below the detent sit that much lower; hitTest compensates.
        tagsSt:
          ((parseFloat(cs.getPropertyValue('--scale-tags-h')) || 0) *
            (parseFloat(cs.getPropertyValue('--scale-sel')) || 1) *
            (parseFloat(cs.getPropertyValue('--scale-sel-bump')) || 1)) /
          (detentPx || 1),
        y: gsap.quickSetter(stripRef.current, 'y', 'px'),
      };
      buildHair(gearRef.current);
    }
    return gearRef.current;
  };

  const lastQRef = useRef(active);
  const writeFrame = (q) => {
    lastQRef.current = q;
    const g = gear();
    if (!g || !g.pitch) return;
    g.y(-q * g.pitch); // station q sits under the lens; the finger moves the scale 1:1
    // --scale-qf, the CONTINUOUS strip position, per frame (--scale-c only
    // hard-cuts per detent): the warp projection AND every row's f²
    // proximity lift/ink read it. q arrives MAGNET-SHAPED from the engine
    // (round 4) — the hang-then-rubber-band weight rides straight through
    // to the rows. Style recalc of ~29 absolute rows: well under 1ms.
    rootRef.current?.style.setProperty('--scale-qf', q);
    // Round 5 — the FLIPPER: the box's deflection target is the current
    // name's exact screen offset ((round(q) − q) · pitch — it "goes along"
    // with the selection under tension), chased by a fast damper so the
    // ±half-pitch jump when round(q) flips renders as the game-show
    // arrow's flick onto the incoming name instead of a teleport. Skin-side
    // spring on purpose: the engine's damper shapes the STRIP; this one
    // shapes only the indicator. Pinned to 0 under RM.
    const f = flipRef.current;
    const now = performance.now();
    const dt = Math.min((now - (f.t || now)) / 1000, 0.1);
    f.t = now;
    if (PREFERS_REDUCED_MOTION) {
      f.y = 0;
    } else {
      const target = (Math.round(q) - q) * g.pitch;
      f.y += (target - f.y) * (1 - Math.exp(-dt / flipTau));
    }
    // r11f (Nathan): written on the ROOT — the box (inside the strip) and
    // the lens POINTER (fixed) both inherit it, one driver for both.
    rootRef.current?.style.setProperty('--box-dy', `${f.y.toFixed(2)}px`);
  };
  const flipRef = useRef({ y: 0, t: 0 });

  // Re-register the strip whenever the resolved pitch (or the tier behind
  // --scale-rows) moves. Keyed on the RESOLVED value and run as an effect,
  // so React has already written the new inline --scale-pitch to the DOM
  // before the geometry is re-read.
  // SSR-correct seed: the CSS base transform reads --scale-i until the
  // engine's first quickSetter write takes over (inline transform wins),
  // and --scale-c falls back to it before the first detent. --scale-n
  // feeds the hairline extent; --scale-pitch is the engine's own detent
  // unit, so the scale and the finger can never drift. Every `?` dial
  // lands here as an inline token.
  const rootStyle = {
    '--scale-i': active,
    '--scale-n': count,
    '--scale-pitch': `${detentPx}px`,
    '--scale-clones': cloneOff,
    ...(featherPx > 0 ? { '--scale-feather': `${featherPx}px` } : {}),
    ...(falloff > 0 ? { '--scale-falloff': falloff } : {}),
    ...(falloffHold >= 0 ? { '--scale-falloff-hold': falloffHold } : {}),
    ...(falloffExp > 0 ? { '--scale-falloff-exp': falloffExp } : {}),
    ...(sliceReach > 0 ? { '--scale-slice-reach': sliceReach } : {}),
    ...(sliceExp > 0 ? { '--scale-slice-exp': sliceExp } : {}),
    ...(sliceAmp >= 0 ? { '--scale-slice-amp': sliceAmp } : {}),
    ...(selScale > 0 ? { '--scale-sel': selScale } : {}),
    ...(selBump > 0 ? { '--scale-sel-bump': selBump } : {}),
    ...(roster > 0 ? { '--scale-roster': roster } : {}),
    ...(inkReach > 0 ? { '--scale-ink-reach': inkReach } : {}),
    ...(inkExp > 0 ? { '--scale-ink-exp': inkExp } : {}),
    ...(inkFloor >= 0 ? { '--scale-ink-floor': inkFloor } : {}),
    ...(chipWipe > 0 ? { '--scale-chip-wipe-ms': `${chipWipe}ms` } : {}),
    ...(nameMax > 0 ? { '--scale-name-max': `${nameMax}px`, '--scale-name-sel-max': `${nameMax}px` } : {}),
    ...(subScale > 0 ? { '--scale-sub': subScale } : {}),
    ...(subInk >= 0 ? { '--scale-sub-ink': subInk } : {}),
    ...(!tagsOn ? { '--scale-tags-h': '0px' } : tagsH > 0 ? { '--scale-tags-h': `${tagsH}px` } : {}),
    ...(tagSize > 0 ? { '--scale-tags-size': tagSize } : {}),
    ...(fillPxs > 0 ? { '--scale-fill-pxs': fillPxs } : {}),
    ...(boxGap > 0 ? { '--scale-box-gap': `${boxGap}px` } : {}),
  };
  const rootClass = `fp-scale${wrap ? ' fp-scale--wrap' : ''}${warpOn ? ' fp-scale--warp' : ''}${sliceOn ? ' fp-scale--slice' : ''}${tagsOn ? ' fp-scale--tags' : ''}`;
  // 09-07 (Nathan: "my tunables aren't working on localhost"): since the
  // arm is SSR'd (09-06) the server renders every dial at its FALLBACK
  // (PARAM has no window there) and React hydration KEEPS the server's
  // style/class attributes — a client-side difference in a prop is never
  // written, and no later render re-diffs it. So the dials are re-applied
  // IMPERATIVELY once at mount. Declared before every other effect: gear()
  // reads tokens (--scale-tags-h, --scale-warp-r) off computed style.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.className = rootClass;
    Object.entries(rootStyle).forEach(([k, v]) => el.style.setProperty(k, String(v)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    gearRef.current = null;
    writeFrame(lastQRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detentPx, tierN]);

  // --scale-pitch / --scale-w / --scale-rows re-tier at 768px (desktop
  // resize / rotation): re-render so detentPx re-reads for the tier — the
  // effect above then drops the cached geometry.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_TIER);
    const onTier = () => retier();
    mq.addEventListener('change', onTier);
    return () => mq.removeEventListener('change', onTier);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?grainsize ?grainamt ?grainfreq ?grainfps ?scrimblur — the MOBILE
  // scrim dial set (09-04 r8): URL-side overrides of the baked recipe for
  // on-device dialing (the bench panel is fiddly on a phone; a URL is
  // not). Each writes the same inline .fp custom props the bench uses —
  // absent params leave the bake untouched; blessed values get baked as a
  // ≤768 tier block in featured-projects.css. ?grainfps re-times the
  // shipped steps() driver (0 = static); ?scrimblur=0 kills the
  // backdrop-filter entirely (the mobile GPU question).
  useEffect(() => {
    const fp = rootRef.current?.closest('.fp');
    if (!fp) return undefined;
    const size = PARAM('grainsize', 0);
    const amt = PARAM('grainamt', -1);
    const freq = PARAM('grainfreq', 0);
    const fps = PARAM('grainfps', -1);
    const blur = PARAM('scrimblur', -1);
    const set = [];
    const put = (k, v) => {
      fp.style.setProperty(k, v);
      set.push(k);
    };
    if (freq > 0 || amt >= 0) {
      put(
        '--scrim-noise',
        noiseUri({
          ...(mobileTier() ? SCRIM_GRAIN_MOBILE : SCRIM_GRAIN),
          ...(freq > 0 ? { freq } : {}),
          ...(amt >= 0 ? { amount: amt } : {}),
        })
      );
    }
    if (size > 0) put('--scrim-noise-size', `${size}px`);
    if (fps >= 0)
      put(
        '--scrim-grain-anim',
        fps === 0 ? 'none' : `fp-scrim-grain ${(8 / fps).toFixed(4)}s steps(1, end) infinite`
      );
    if (blur >= 0) put('--scrim-bf', blur === 0 ? 'none' : `blur(${blur}px)`);
    return () => set.forEach((k) => fp.style.removeProperty(k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FP-1 house pulse at REST (09-02 round 2): the canonical envelope on a
  // dim-gray veil inside the lens + the number flipping white at the peak —
  // the enter_world pulse, re-seated on the number cell as the interaction
  // hint. GSAP owns ONLY the veil opacity and the two inline colors
  // (none carries a CSS transition, so no lane fight with the accent /
  // charged flips); killed the moment intent lands (charge, engage) and
  // re-armed 500ms after rest — past the 0.4s accent transition, so a Turn
  // recolour never bakes a mid-fade colour into the loop. Never under RM.
  // 09-04 (Nathan): the rotated select_project HINT rides the same
  // timeline with the INVERSE ink — white while the cell shows the
  // project colour, dipping to its 55% rest ink exactly when the veil
  // greys the cell (enter_world's dim polarity, so all three beat
  // together) — and the timeline seeks the house METRONOME (shared wall
  // clock, see housePulseLoop) so it phase-locks with enter_world.
  const chargedRef = useRef(false);
  const pulseTlRef = useRef(null);
  const pulseElRef = useRef(null);
  const hintRef = useRef(null);
  const pulseTimerRef = useRef(0);
  const killPulse = () => {
    clearTimeout(pulseTimerRef.current);
    pulseTlRef.current?.kill();
    pulseTlRef.current = null;
    const targets = [pulseElRef.current, numRef.current, hintRef.current].filter(Boolean);
    if (targets.length) gsap.set(targets, { clearProps: 'opacity,color' });
  };
  const armPulse = () => {
    killPulse();
    if (PREFERS_REDUCED_MOTION) return;
    pulseTimerRef.current = setTimeout(() => {
      if (openRef.current || chargedRef.current) return; // intent landed meanwhile
      const veil = pulseElRef.current;
      const num = numRef.current;
      if (!veil || !num) return;
      const on = HOUSE_PULSE_PERIOD_S * HOUSE_PULSE_ON_RATIO;
      pulseTlRef.current = gsap
        .timeline({ repeat: -1, repeatDelay: HOUSE_PULSE_PERIOD_S - on })
        .to(veil, { opacity: 1, duration: on, ease: ensureHousePulse() }, 0)
        .to(num, { color: '#ffffff', duration: on, ease: ensureHousePulse() }, 0);
      if (hintRef.current) {
        gsap.set(hintRef.current, { color: '#ffffff' }); // armed base = white (accent phase)
        pulseTlRef.current.to(
          hintRef.current,
          { color: 'rgba(255, 255, 255, 0.55)', duration: on, ease: ensureHousePulse() },
          0
        );
      }
      pulseTlRef.current.totalTime((performance.now() / 1000) % HOUSE_PULSE_PERIOD_S);
    }, 500);
  };
  const syncPulse = () => {
    if (openRef.current || chargedRef.current) killPulse();
    else armPulse();
  };
  useEffect(() => {
    armPulse();
    return killPulse;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Crossed major tick: flash white, decay (CSS animation on [data-flash]).
  // The attribute is cleared on the next crossing — a re-flash of the same
  // station always has a different station's crossing between, so the
  // animation restarts without a forced reflow. No flash under RM.
  const flashRef = useRef(null);
  const flashTick = (i) => {
    if (flashRef.current) flashRef.current.removeAttribute('data-flash');
    flashRef.current = null;
    if (PREFERS_REDUCED_MOTION) return;
    const el = stationsRef.current?.children[i + cloneOff];
    if (!el) return;
    el.setAttribute('data-flash', '');
    flashRef.current = el;
  };

  // ONE announcement per landed station. Re-assigning an aria-live node's
  // text replays it on VoiceOver/NVDA whether or not the string changed, so
  // the write is change-gated — and it only ever fires for a station the
  // USER landed on (a gesture crossing, or the Turn's own [active] effect),
  // never for the engine's engage-init or the intermediate stations of a
  // programmatic glide.
  const announce = (i) => {
    const w = worlds[i];
    const el = liveRef.current;
    if (!w || !el) return;
    const label = `Project ${i + 1} of ${count} — ${nameOf(w)}`;
    if (el.textContent !== label) el.textContent = label;
  };

  // Detent hard-cut: lens number + label + the live lens station (--scale-c,
  // which CSS turns into every station's cascade distance and the engaged
  // hit pad's reach) + aria-live + tick flash. Never per frame. Under wrap
  // the engine hands the UNWRAPPED strip position second — --scale-c, the
  // flash target and the crossing compare all live in strip space (a clone
  // row under the lens must cascade/flash as itself), while the readouts
  // and the announcement stay principal.
  const cRef = useRef(active); // last written --scale-c (strip space — onRenorm shifts it)
  // Round 5: the SELECTED row wears data-sel (the tighter cap — clipping
  // must stop short of the right-seated [select_project] on phones), its
  // clipping name gets the next-chip ticker, and the flipper box is sized
  // to hug the (clipped) name + pads. Measured at each detent (the tape
  // idiom — offsetWidth vs the sel cap; transform scale does not affect
  // the measure); armed on the row under the lens only, cleared from the
  // row it leaves. Marquee never under RM: a frozen marquee would strand
  // the feathered edge. JS mirrors of --scale-name-sel-max: 28vw/112px
  // mobile (r10 — widened once the [select_project] chip left the lens
  // band; the viewport is the only bound now), 168px desktop; the
  // trailing pad mirrors --space-3 (6px).
  // Round 6: the fill runs from the SEAT EDGE (x=0) so the project number
  // sits on solid black in front of the axis line — the name's start
  // offset is measured (offsetLeft tracks the --scale-w/--space-* tokens;
  // no px mirror), the width spans seat → name end + pad. Round 7: while
  // MARQUEEING the pad is dropped — the rolling text runs flush to the box
  // edge and hard-clips there (the name's own overflow at the sel cap =
  // the box's right edge; no fade, no gap).
  const selRef = useRef(null);
  // Round 8: the ±1 NEIGHBOUR rows paint at the full [select_project] size
  // now (the two-station proximity curve) — they wear data-near per detent
  // so the tighter sel cap bounds them too. Round 9 (Nathan): the TICKER
  // carries over to them — a clipping neighbour marquees exactly like the
  // selected row (consistency), measured with the same cap. Stamped here
  // beside data-sel, cleared from the rows they leave.
  const nearRef = useRef([]);
  const tagsRef = useRef(null); // 09-07: the detented row's readout (desktop)
  // r11d (Nathan): the caps are READ, not mirrored — the ≤768 sel cap is
  // now evaluated from the viewport in CSS (the selected slot spans it),
  // and the roster cap IS the sel cap, so a name that clips in the lens
  // clips identically in every row (the long-name flash at the detent:
  // full in the roster, cut the instant data-sel landed). Every clipping
  // row tickers, selected or not.
  const capOf = (el) => parseFloat(getComputedStyle(el).maxWidth) || Infinity;
  const setMarquee = (un) => {
    const nameEl = stationsRef.current?.children[un + cloneOff]?.querySelector('.fp-scale__name');
    // r11h (Nathan: tickers reset as you scroll): data-marquee is NEVER
    // stripped here — the pass below sets the truth per row, and a
    // remove + re-add in one tick restarted the CSS animation on every
    // row that changed role. Only the role attributes clear.
    if (selRef.current && selRef.current !== nameEl) {
      selRef.current.removeAttribute('data-sel');
      unfillLater(selRef.current);
      selRef.current = null;
    }
    if (tagsRef.current) {
      unfillLater(tagsRef.current);
      tagsRef.current = null;
    }
    nearRef.current.forEach((el) => {
      el.removeAttribute('data-near');
    });
    nearRef.current = [];
    // r11b: the ±1 rows only need the tighter cap (and the ticker) when
    // they actually LIFT — i.e. the curve's hold reaches them. Under the
    // baked step (hold 0.75) they sit at roster size and must keep the
    // wide roster cap, or they clip for nothing. Reads the live token so
    // ?falloffhold and the bake agree.
    const holdNow =
      falloffHold >= 0
        ? falloffHold
        : parseFloat(getComputedStyle(rootRef.current).getPropertyValue('--scale-falloff-hold')) || 0;
    (holdNow >= 1 ? [un - 1, un + 1] : []).forEach((k) => {
      const el = stationsRef.current?.children[k + cloneOff]?.querySelector('.fp-scale__name');
      if (el && el !== nameEl) {
        el.setAttribute('data-near', '');
        nearRef.current.push(el);
      }
    });
    if (nameEl) nameEl.setAttribute('data-sel', '');
    // Attributes first, then ONE read pass (caps + copy widths), then the
    // writes — no layout thrash across the ~30 rendered rows.
    const rows = Array.from(stationsRef.current?.querySelectorAll('.fp-scale__name') ?? []).map(
      (el) => {
        const copy = el.firstChild?.children?.[0];
        return { el, cap: capOf(el), w: copy ? copy.offsetWidth : 0 };
      }
    );
    let selW = 0;
    let selCap = Infinity;
    let selRolls = false;
    // 09-07 (Nathan): on DESKTOP the selected row never wears the two-copy
    // marquee — it gets the fill ticker below, whatever its width.
    const desk = !mobileTier();
    rows.forEach(({ el, cap, w }) => {
      const rolls = !PREFERS_REDUCED_MOTION && w > cap && !(desk && el === nameEl);
      if (rolls && !el.hasAttribute('data-marquee')) {
        // r11h: PHASE-LOCK to the wall clock (the housePulseLoop idiom) —
        // the wheel renders the same client name in several nodes (the
        // clone rows), each animation starting whenever ITS node armed;
        // crossing a loop boundary swapped nodes and jumped the ticker.
        // A negative delay of (now mod duration) puts every node of the
        // same name at the same scroll position, always.
        const track = el.firstChild;
        const durS = parseFloat(getComputedStyle(el).getPropertyValue('--marquee-s')) || 6;
        if (track) track.style.animationDelay = `${-((performance.now() / 1000) % durS).toFixed(3)}s`;
      }
      el.toggleAttribute('data-marquee', rolls);
      if (el === nameEl) {
        selW = w;
        selCap = cap;
        selRolls = rolls;
      }
    });
    if (!nameEl) return;
    selRef.current = nameEl;
    if (desk) {
      // 09-07 (Nathan): the desktop box is a FIXED width, client to
      // client — the widest client name (+ sub token), capped so at least
      // --scale-box-gap stays between the painted box and the
      // [select_project] chip. Inside it the name ALWAYS rolls, repeated
      // to fill; the services readout rolls under it at the same speed.
      // 09-07 (Nathan): NO trailing pad — the rolling text hard-clips at
      // the box edge (the r7 flush rule), so the box ends where the clip
      // ends.
      const pad = 0;
      const cs = getComputedStyle(rootRef.current);
      const selPaint =
        (parseFloat(cs.getPropertyValue('--scale-sel')) || 1) *
        (parseFloat(cs.getPropertyValue('--scale-sel-bump')) || 1);
      const gapPx = boxGap > 0 ? boxGap : parseFloat(cs.getPropertyValue('--scale-box-gap')) || 0;
      const widest = rows.reduce((m, r) => Math.max(m, r.w), 0);
      let boxW = nameEl.offsetLeft + widest + pad;
      const chip = freezeRef.current?.getBoundingClientRect();
      const boxRect = boxRef.current?.getBoundingClientRect();
      if (chip && boxRect && chip.width > 0) {
        boxW = Math.min(boxW, (chip.left - gapPx - boxRect.left) / selPaint);
      }
      boxW = Math.max(boxW, nameEl.offsetLeft + 48);
      const cap = boxW - nameEl.offsetLeft - pad;
      const pxs = fillPxs > 0 ? fillPxs : parseFloat(cs.getPropertyValue('--scale-fill-pxs')) || 44;
      fill(nameEl, selW, cap, pxs);
      const tagsEl = nameEl.parentElement?.querySelector('.fp-scale__tags');
      if (tagsEl && tagsOn) {
        const copy = tagsEl.firstChild?.children?.[0];
        fill(tagsEl, copy ? copy.offsetWidth : 0, cap, pxs);
        tagsRef.current = tagsEl;
      }
      boxRef.current?.style.setProperty('width', `${Math.round(boxW)}px`);
      return;
    }
    boxRef.current?.style.setProperty(
      'width',
      `${nameEl.offsetLeft + Math.round(Math.min(selW, selCap)) + (selRolls ? 0 : 6)}px`
    );
  };
  // 09-07: the FILL TICKER — enough copies of the text to span `cap`
  // (cloned once, kept; CSS hides the extras off data-fill), rolling by
  // exactly one copy + the track gap at `pxs` unscaled px/s, phase-locked
  // to the wall clock (r11h). Never under RM (a static clipped line).
  const fill = (el, w, cap, pxs) => {
    const track = el.firstChild;
    if (!track || !track.children.length) return;
    cancelUnfill(el);
    el.style.maxWidth = `${Math.max(0, Math.round(cap))}px`;
    if (PREFERS_REDUCED_MOTION || !(w > 0)) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const shift = w + gap;
    const need = Math.max(2, Math.ceil(cap / shift) + 1);
    while (track.children.length < need) track.appendChild(track.children[0].cloneNode(true));
    const dur = shift / Math.max(pxs, 1);
    track.style.setProperty('--fill-shift', `${shift}px`);
    track.style.setProperty('--fill-s', `${dur.toFixed(3)}s`);
    track.style.animationDelay = `${-((performance.now() / 1000) % dur).toFixed(3)}s`;
    el.setAttribute('data-fill', '');
  };
  const unfill = (el) => {
    el.removeAttribute('data-fill');
    el.style.maxWidth = '';
  };
  // 09-07 (Nathan: COCO snapped from the roll to a single name while still
  // inside the box): the detent fires at the threshold, while the flipper
  // is still deflected onto the OUTGOING row and springing across — so the
  // outgoing row keeps rolling for the spring's settle (~3τ) and drops to
  // its single copy only once the box has left it. Re-selection inside
  // that window cancels the drop (fill() re-arms on the same clock).
  const unfillTimers = useRef(new Map());
  const cancelUnfill = (el) => {
    const t = unfillTimers.current.get(el);
    if (t) {
      clearTimeout(t);
      unfillTimers.current.delete(el);
    }
  };
  const unfillLater = (el) => {
    cancelUnfill(el);
    const ms = Math.max(150, Math.round(flipTau * 3 * 1000));
    unfillTimers.current.set(
      el,
      setTimeout(() => {
        unfillTimers.current.delete(el);
        unfill(el);
      }, ms)
    );
  };
  useEffect(
    () => () => {
      unfillTimers.current.forEach((t) => clearTimeout(t));
      unfillTimers.current.clear();
    },
    []
  );
  const setStation = (i, un = i) => {
    const w = worlds[i];
    if (!w) return;
    if (numRef.current) numRef.current.textContent = pad2(i);
    cRef.current = un;
    rootRef.current?.style.setProperty('--scale-c', un);
    setMarquee(un);
    if (openRef.current) {
      if (un !== prevDetentRef.current) flashTick(un);
      announce(i);
    }
    prevDetentRef.current = un;
  };

  // Every landing goes through here. (Round 7: no close-origin write any
  // more — the screen-space hairline's wipe always converges on the fixed
  // lens line.)
  const land = (i) => {
    // Round 8: the selection is made — the choreography owns the page
    // from here, so the pause lifts BEFORE the commit creates the Turn's
    // tweens (see setFrozen). The [select_project] letter exit and the
    // scrim fade still run at the retract, over the moving page.
    if (pauseOn) setFrozen(false);
    // A landing on the station already active only CANCELS a stale
    // deferral (Escape, a re-land): `active` never changes, so the effect
    // below never runs — announce the settled station here or the live
    // region keeps reading the station the user just backed out of.
    if (i === activeRef.current) announce(i);
    commit(i);
  };

  const engine = usePagerGesture({
    rootRef,
    count,
    activeRef,
    commit: land,
    onEngaged: (v) => {
      openRef.current = v;
      setOpen(v);
      onEngaged(v);
      syncPulse();
    },
    onCharged: (v) => {
      chargedRef.current = v;
      setCharged(v);
      syncPulse();
    },
    onFrame: writeFrame,
    onDetent: setStation,
    hitTest: (clientY, q) => {
      // Row math around the lens centre — station q sits under the lens.
      const rect = lensRef.current?.getBoundingClientRect();
      const g = gear();
      if (!rect || !g || !g.pitch) return null;
      let d = (clientY - (rect.top + rect.height / 2)) / g.pitch;
      // 09-07: the readout gap — rows below the DETENTED row (cRef, not
      // q) are shifted down by g.tagsSt; a tap in the gap is the detented
      // row's own box, a tap below it lands its true row.
      if (g.tagsSt) {
        const dc = cRef.current - q;
        if (d > dc + 0.5 + g.tagsSt) d -= g.tagsSt;
        else if (d > dc + 0.5) d = dc;
      }
      // Warp inverse: the screen offset is R·sin(δ/R) of the logical δ —
      // recover δ before the row math or far taps land short of their row.
      if (warpOn) d = g.warpR * Math.asin(Math.min(1, Math.max(-1, d / g.warpR)));
      // Outside the deployed window the station is clipped and inert — a tap
      // out there must never jump to a row nobody can see.
      if (g.rows && Math.abs(d) > g.rows) return null;
      const i = Math.floor(d + q + 0.5);
      if (wrap) return pmod(i); // clone rows resolve to their principal station
      return i >= 0 && i < count ? i : null;
    },
    // Wrap re-base: the engine shifted every position register by `off`
    // stations onto identical clone content — shift the strip-space var
    // this skin owns (and the crossing compare) the same way, or the
    // cascade/hit pad go a whole loop stale.
    onRenorm: (off) => {
      cRef.current -= off;
      prevDetentRef.current -= off;
      rootRef.current?.style.setProperty('--scale-c', cRef.current);
    },
    tuning: {
      detentPx, // 1:1 with the pitch — the finger moves the scale exactly
      wheelDetentPx: Math.max(MIN_DETENT_PX, PARAM('wheeldetent', SCALE_WHEEL_DETENT_PX)),
      endResist: SCALE_END_RESIST,
      // Round 6 (Nathan): NO stall-commit — a wheel settle is a preview
      // only, and the Turn evaluates at DISENGAGE (pointerleave / touch
      // release / keyboard). With ?pause baked on, a mid-hover commit
      // started a Turn under the paused globalTimeline; settling on
      // stations in sequence stacked those frozen Turns' card names
      // behind the scrim. Non-finite = the engine's pointerleave-only
      // contract.
      stallMs: Infinity,
      // Round 4 (Nathan): magnet ON — the rendered strip HANGS on the
      // current station and rubber-bands across to the next (the engine's
      // house shape), and every downstream channel (warp, row lift, ink)
      // rides the shaped position. The finger stays the authority; only
      // the rendering lingers.
      magnet: true,
      magnetExp, // ?magnet — the scale runs far steeper than the tape's 1.6
      wrap, // ?wrap: the wheel — no ends, indices mod count (engine doc)
    },
  });

  // A Turn from any other path (CTA scroll, envelopment restore, a commit
  // deferred behind the previous Turn's lock) glides the scale to the new
  // index — the marker-follow idiom, engine-owned τ.
  useEffect(() => {
    engine.follow(active);
    // The gesture announces its own crossings; a Turn that lands at rest
    // (CTA scroll, station click, peek tap) announces exactly once here.
    // Never on the mount run: seeding a live region that is already in the
    // document reads as an announcement, so the pager would speak the
    // resting project unprompted on every page load.
    if (mountedRef.current && !openRef.current) announce(active);
    mountedRef.current = true;
    syncPulse(); // rest pulse rebuilds on the DESTINATION accent (500ms arm delay)
    const focused = document.activeElement;
    const rootEl = rootRef.current;
    // Roving tabstop: focus stranded on a stale station carries tabindex=-1
    // while aria-current has moved, and a trailing Enter there reverts the
    // Turn just committed. focusSilently, never a bare focus(): a keyboard
    // commit retracts synchronously (keyRelease), so a plain focus() would
    // fire a fresh :focus-visible focusin and RE-ENGAGE the pager — left
    // deployed, stage dimmed, its own paging muted until Tab-away.
    if (
      rootEl &&
      focused &&
      rootEl.contains(focused) &&
      focused.classList.contains('fp-scale__station')
    ) {
      const stationEl = stationsRef.current?.children[active + cloneOff];
      if (stationEl && stationEl !== focused) engine.focusSilently(stationEl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ?pause — the pause screen (09-02 round 2): while engaged, the page holds
  // still. Three lanes: the WebGL scene loop stops via the swm:fp-freeze
  // gate in useWorldScene's syncTicker (a real stop — render AND decode
  // pause, so this SAVES compute), every GSAP tween pauses via
  // globalTimeline (the pager's own damper rides gsap.ticker directly and
  // keeps running), and CSS chrome animations hold via .is-fp-frozen. The
  // scrim goes pointer-events:auto so the stage/CTAs are inert. On release
  // the [select_project] centre label leaves on the house random letter cut
  // (the textExit charCut idiom, 35ms shuffled). The cleanup unfreezes on
  // unmount mid-engage (a soft nav must never strand a paused page).
  const freezeRef = useRef(null);
  const freezeCallsRef = useRef([]);
  // Round 8 (Nathan's screenshot: the incoming card's text populated
  // above/below the current one, STATIC, before any choreography): the
  // freeze lifts at the COMMIT, not the retract. The commit fires while
  // the pager is still open (readBeat 240ms + scrim fade follow), and a
  // Turn created under the paused globalTimeline mounted the incoming
  // WorldCard frozen mid-initial-state. setFrozen is idempotent and
  // callable from land(): thaw there means the Turn's tweens are born
  // against a RUNNING timeline — the entrance choreography starts
  // instantly under the fading scrim.
  const frozenRef = useRef(false);
  const setFrozen = (on) => {
    if (frozenRef.current === on) return;
    frozenRef.current = on;
    const fpEl = rootRef.current?.closest('.fp');
    if (on) {
      fpEl?.classList.add('is-fp-frozen');
      window.dispatchEvent(new CustomEvent('swm:fp-freeze', { detail: { on: true } }));
      gsap.globalTimeline.pause();
    } else {
      gsap.globalTimeline.play();
      window.dispatchEvent(new CustomEvent('swm:fp-freeze', { detail: { on: false } }));
      fpEl?.classList.remove('is-fp-frozen');
    }
  };
  useEffect(() => {
    if (!pauseOn) return undefined;
    const el = freezeRef.current;
    const clearCalls = () => {
      freezeCallsRef.current.forEach((c) => c.kill());
      freezeCallsRef.current = [];
    };
    if (open) {
      clearCalls();
      if (el) {
        el.querySelectorAll('span').forEach((s) => {
          s.style.visibility = '';
        });
        el.removeAttribute('data-exit'); // a re-engage mid-wipe snaps the chip open
        el.setAttribute('data-show', '');
      }
      setFrozen(true);
      // Unmount (or open flip) mid-freeze: thaw first, always — a no-op
      // when land() already thawed at the commit.
      return () => setFrozen(false);
    }
    if (el && el.hasAttribute('data-show')) {
      const chars = Array.from(el.querySelectorAll('span'));
      if (PREFERS_REDUCED_MOTION || !chars.length) {
        el.removeAttribute('data-show');
      } else {
        for (let i = chars.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        chars.forEach((s, i) => {
          freezeCallsRef.current.push(
            gsap.delayedCall(i * 0.035, () => {
              s.style.visibility = 'hidden';
            })
          );
        });
        // Round 11 (Nathan): the chip itself leaves AFTER the letters —
        // data-exit runs the CSS top→bottom wipe (--scale-close-ms), then
        // data-show drops (the opacity fade is invisible behind a fully
        // closed clip) and the letters are restored for the next engage.
        const wipeS =
          (parseFloat(getComputedStyle(el).getPropertyValue('--scale-chip-wipe-ms')) || 520) /
          1000;
        freezeCallsRef.current.push(
          gsap.delayedCall(chars.length * 0.035 + 0.05, () => el.setAttribute('data-exit', ''))
        );
        freezeCallsRef.current.push(
          gsap.delayedCall(chars.length * 0.035 + 0.05 + wipeS + 0.02, () => {
            el.removeAttribute('data-show');
            el.removeAttribute('data-exit');
            chars.forEach((s) => {
              s.style.visibility = '';
            });
          })
        );
      }
    }
    return clearCalls;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pauseOn]);

  return (
    <nav
      className={rootClass}
      ref={rootRef}
      aria-label="Featured project pager"
      data-open={open || undefined}
      data-charged={charged || undefined}
      style={rootStyle}
    >
      {/* The chip = the lens (numerator row) + the fraction rule + the
          denominator. Decorative overlay: the station buttons beneath carry
          the semantics + clicks; the root's own box carries hover/press. */}
      {hintOn && (
        <span className="fp-scale__hint" aria-hidden="true" ref={hintRef}>
          select_project
        </span>
      )}
      <div className="fp-scale__chip" aria-hidden="true">
        <span className="fp-scale__lens" ref={lensRef}>
          <span className="fp-scale__pulse" ref={pulseElRef} />
          <span className="fp-scale__pointer" />
          <span className="fp-scale__num" ref={numRef}>
            {seedNum}
          </span>
        </span>
        <span className="fp-scale__den">{String(count).padStart(2, '0')}</span>
      </div>
      {/* The deployed window: --scale-rows pitches each side of the lens,
          feathered at both edges and overflow-clipped so the stations beyond
          it are neither drawn nor hit-tested (they scrub into view). */}
      <div className="fp-scale__window">
        {/* The axis hairline (round 7): a SCREEN-SPACE SVG path — under
            warp it curves along the rows' implied cylinder (a static
            ellipse in screen space), straight without. First in the window
            so everything on the strip paints above it. Its open/close wipe
            converges on the fixed lens line (the window centre). */}
        <svg className="fp-scale__hair" aria-hidden="true">
          <path ref={hairPathRef} />
        </svg>
        <div className="fp-scale__scale" ref={stripRef}>
          {/* Wheel SEAMS (round 7): a rule between the last and first
              stations at every loop boundary in the rendered strip — where
              the list repeats. Own strip-level elements, NOT a station
              pseudo (the r6 minor-tick lesson: nothing may ride the
              selected row's transform), under the box so the fill covers
              them at the lens like it covers the hairline. */}
          {wrap &&
            Array.from(
              { length: Math.floor((count + cloneOff - 1) / count) - Math.ceil((1 - cloneOff) / count) + 1 },
              (_, n) => {
                const m = Math.ceil((1 - cloneOff) / count) + n;
                return (
                  <span
                    key={`seam@${m}`}
                    className="fp-scale__seam"
                    aria-hidden="true"
                    style={{ '--k': m * count - 0.5 }}
                  />
                );
              }
            )}
          {/* The flipper box (round 5; round 6 seat) — INSIDE the strip,
              between the hairline/seams and the stations, so the near-black
              fill paints OVER the axis line and UNDER the row text (equal-z
              siblings paint in DOM order; no z-index juggling survives a
              stacking-context split). Its own transform counter-rides the
              strip off --scale-qf, so it stays seated at the lens in screen
              space. */}
          <span className="fp-scale__box" aria-hidden="true" ref={boxRef} />
          <div className="fp-scale__stations" ref={stationsRef}>
            {/* Slots run [-CLONE_ROWS, count + CLONE_ROWS) under wrap — the
                ghost rows beyond each end that make the wheel read as a
                wheel. Clones are decorative duplicates: aria-hidden, out of
                the tab order, but still clickable (they land the principal
                station; engine.close glides the short way around). The
                client NAME rides every row (09-02) — aria-hidden, the
                button's aria-label already carries it. */}
            {Array.from({ length: count + cloneOff * 2 }, (_, slot) => {
              const k = slot - cloneOff; // strip position
              const i = pmod(k); // principal station
              const w = worlds[i];
              const clone = k !== i;
              return (
                <button
                  key={clone ? `${w.slug}@${k}` : w.slug}
                  type="button"
                  className="fp-scale__station"
                  aria-label={
                    clone ? undefined : `Go to ${nameOf(w)} (project ${i + 1} of ${count})`
                  }
                  aria-hidden={clone || undefined}
                  aria-current={!clone && i === active ? 'true' : undefined}
                  tabIndex={!clone && i === active ? 0 : -1}
                  // --k = station slot on the strip; the cascade distance is
                  // derived in CSS off --scale-c (the row under the lens RIGHT
                  // NOW), never off React's `active`.
                  style={{ '--k': k }}
                  onClick={() => {
                    // Desktop station click (touch taps resolve via the engine's
                    // hitTest — capture retargets touch clicks to the root).
                    // Unconditional commit: even the active station cancels a
                    // stale deferral. close(i): activeRef is stale until React
                    // commits (the engine seats the nearest representative).
                    land(i);
                    engine.close(i);
                  }}
                >
                  {pad2(i)}
                  {/* Two copies, the tape idiom: the second participates
                      only while the selected row marquees. */}
                  <span className="fp-scale__name" aria-hidden="true">
                    <span className="fp-scale__name-track">
                      <span>
                        {w.clientName}
                        {subOf(w) && <span className="fp-scale__sub">{subOf(w)}</span>}
                      </span>
                      <span>
                        {w.clientName}
                        {subOf(w) && <span className="fp-scale__sub">{subOf(w)}</span>}
                      </span>
                    </span>
                  </span>
                  {/* 09-07: the services READOUT — desktop, detented row only
                      (CSS: opacity --w1, display none ≤768 / ?tags=0). */}
                  {tagsOf(w) && (
                    <span className="fp-scale__tags" aria-hidden="true">
                      <span className="fp-scale__tags-track">
                        <span>{tagsOf(w)}</span>
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {pauseOn && (
        <span className="fp-scale__freeze" aria-hidden="true" ref={freezeRef}>
          {'[select_project]'.split('').map((ch, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <span key={i}>{ch}</span>
          ))}
        </span>
      )}
      <span className="sr-only" aria-live="polite" ref={liveRef} />
    </nav>
  );
}
