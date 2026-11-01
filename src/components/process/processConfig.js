/**
 * processConfig.js — every tunable for the /process ProcessScene (spec §9).
 *
 * Knobs initialize from the URL (the PARAM convention) into the mutable
 * TUNING object. The scene reads TUNING at use-time — framing, the drift
 * tick, transition build — so the ?debug panel can live-tune without a
 * reload: instant for framing/drift/glow/stroke, next-beat for
 * durations/orders (jump or ↻ replay a stage to hear the change). The
 * panel's copy_url serializes non-default values back into the query
 * string so a dialed-in feel can be reloaded or shared.
 *
 * Defaults below are Nathan's 2026-07-16 dialed set — the first pass
 * against the round-3 build (v2 deck: suspended flood, in-scene Thread,
 * S5 tilt/inner-stroke, splash), baked from his copy_url. Checkpoint
 * bake; further refinement to follow. Knobs he didn't touch keep the
 * 07-15 values.
 *
 * 10-08 (w8): every key added 10-07 or later carries a PROPOSED default
 * (the agent's pick) pending Nathan's dial — NOT a bake until his copy_url
 * lands; a later session must not freeze them as his.
 */

import { SCROLL_TRIGGER_PROCESS_PX } from '../../lib/motion.js';
import { relLum } from '../../lib/projectColor.js';

export const IS_MOBILE =
  typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

const PARAMS =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

const num = (key, fallback) => {
  const raw = PARAMS?.get(key);
  const n = raw == null ? NaN : parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
};
const str = (key, fallback) => PARAMS?.get(key) || fallback;

export const DEBUG = PARAMS?.has('debug') ?? false;

/* — Globe-O, LIVE (08-28, Nathan — the 08-25 snapshot gains motion + the
   fill-circle-as-stroke ring). Consumed by liveLockupGlobe/useProcessCopy. — */
export const O_SPIN_DPS = num('ospin', -20); // ?ospin — spin around the polar axis, deg/s (negative = westward); 0 = still. 08-28 bake −20 (Nathan's dial; the cascade is retired — rotation carries the motion)
export const O_STROKE_PCT = Math.max(0, num('ostroke', 3)); // ?ostroke — outer-stroke ring, % proud, clamped ≥0 (≤ −100 would make the slot-height math divide toward Infinity); the home ?globestroke convention: the globe shrinks inside so globe + ring land AT the glyph height. 08-28 bake 3 (Nathan's dial)
export const O_PAD_EM = num('opad', 0.175); // ?opad — clear air each side of the O glyph slot, em of the title size (was the 0.26em CSS literal). 08-29 bake 0.175 (Nathan's dial)

/* — Resize doctrine (08-28, shared dial with /work): the camera re-eval
   TRAILS the window on a retargeted ease. — */
export const CAM_LAG_S = num('camlag', 0.7); // ?camlag — seconds; ~0 = instant

/* — Baked defaults (spec §9 + feel extras). The panel's URL builder
   serializes only values that differ from these. — */
export const TUNING_DEFAULTS = {
  stageSeconds: 0.65, // ?stagems — base stage-transition duration
  scatter: 2.05, // ?scatter — Fragment-belt spread (annulus radius, world units)
  drift: 0.09, // ?drift — suspended-cloud self-rotation rate (very slow — the v2 read)
  threadHops: 42, // ?threadhops — Fragments the Thread chains. 10-07 (w4): 42, not 84 — buildChain's loop bound re-read the shrinking pool, so "84" always chained 42; with the bound fixed, 42 keeps the 4.2s connect Nathan approved (84 = every bead, the ?threadaccel A/B)
  threadSeconds: 4.2, // ?threadsecs — 10-07 (w4): the whole Thread trace, first hop → last claim, s (was ?threadms × hops: 0.1 × 42). Fixed whatever ?threadhops is, so 84 beads hop twice as fast
  threadAccel: 1, // ?threadaccel — 10-07 (w4): the trace's cadence, hop i at T·(i/N)^q. 1 = the even metronome (today); <1 = a RISER, hops crowding toward the pull (Nathan's A/B: ?threadhops=84&threadaccel=0.6); >1 decelerates
  threadInk: 'auto', // ?threadink — 10-08 (w8, experience-2): the S2 Thread's colour. stroke = STROKE_COLOR, the shard edges' own ink (as built — mid-trace it reads as one more edge); white = WHITE_COLOR, the leader ink (same LineMaterial, width, dash and alpha draw). Nathan's A/B. 10-10 (w9c): auto = the FIELD TABLE's thread ink for the opening field S2 sits on (FIELDS — white on black, the stroke ink on blue: a black string on the black opening is invisible). PROPOSED default auto (was stroke); stroke and white stay as arms
  /* — 10-10 (w9c, the black opening — Nathan 10-09: "start on black instead
     of blue … when it goes to phase 3, it switches to the blue background.
     Blue holds until phase 5, when we start to bring in the blue gradient,
     and then let's have the gradient cover more of the background on phase
     6"). The field ORDER: one knob, resolved through the field table
     (fieldOf, below) — every field-dependent colour reads it. — */
  opening: 'black', // ?opening — 10-10 (w9c): the OPENING field (hero, S1, S2): black = Nathan's reversed order (black opening; the solid field that grows out of the Core at S3's ignition and holds S4 is BLUE); blue = the pre-w9c order (blue opening, black S3/S4), kept for A/B. Baked black (Nathan's stated value). Live from the bench (the field re-lays at the rest)
  ctaRamp: 0.8, // ?ctaramp — 10-10 (w9c, "have the gradient cover more of the background on phase 6"): the CTA's ramp — the home hero's `to top` gradient's BLACK stop, as a fraction of the viewport height from the bottom (S5 keeps S5_RAMP 0.4, the home hero's). The S5→CTA step slides the stop up (one var, monotonic per pixel). 0.4 = the pre-w9c CTA. PROPOSED 0.8
  ctaInk: 'auto', // ?ctaink — 10-10 (w9c, the CTA world over more blue): the CTA world's black EDGE INK (uStrokeMix — the S3/S4 house rule for blue fields: the stroke carries the read). The resolve tweens it in with the light. auto = field-aware (10-10, w9c fix2 — it was ramp-aware and inked the phone's world over the ramp's near-black top): FIELDS.blue.ink only where the black edge OUTREADS the lit world (WCAG, at its dimmest resting light — the breathe's floor) on the field under the world's lower silhouette (the scene's ctaEdgeInk) — desktop's world stands in the blue and keeps it, the phone's goes ink-free; never at the pre-w9c ramp ≤ 0.4 (the blue arm stays w9b's ink-less resolve); a number 0..1 pins it (0 = w9b's). PROPOSED auto
  heroV: 'bottom', // ?herov — 10-08 (w8, phone-a11y-hero-vertical): PHONE ONLY (≤768px) — where the hero card sits. bottom = the 09-08 card rule (every section bottom-anchored; the globe-O breaks at ~85–88% of the frame); centre = the hero card on the frame's vertical centre, so the break lands mid-screen (the stage cards keep their bottom anchor). Nathan's A/B
  nextTease: 'off', // ?nexttease — 10-08 (w8, experience-6): PHONE ONLY (≤768px), RELOAD ONLY — on = a `next: <phase>` line on its own row under each stage card S1–S5 (the desktop stepper's own words, ProcessStepCtas nextLabel; the stepnav is hidden ≤768px), cut in with the card's keyword wipe and out on the leave-back (charCut), a keep-out box for the chips; the bottom-anchored card grows up one row. Not on the hero or the CTA. Nathan's A/B
  threadHead: 'word', // ?threadhead — 10-07 (w5): where the Thread's chain STARTS. word = from the last S1 station's subject when the tour named it (the shard the reader was just looking at), so the Thread begins ON the word they just read and the camera's first move shrinks; centre = the pre-w5 start (greedy nearest-neighbour outward from the belt centre). Default 'word' since the integration pass: centre binds a thread word in only ~31–61% of shows (the payoff mostly never shows), word in ~94% — Nathan's A/B, ?threadhead=centre to compare
  threadWords: 4, // ?threadwords — 10-07 (w4): S1 words the Thread picks back up — a bead the S1 tour named re-wears its word in its remembered fill as the trace strikes it (first-come along the chain, ≤ ?labels at once); 0 = off. 10-09 (w9b): kept at 4 by measurement — 8 S1 chips lift the words bound per show from a median 1 to 4 (the cap binding); 8 adds nothing at the median (3.5)
  threadTight: 0.85, // ?threadtight — S1→S2: the camera opens dead on the Thread's FIRST bead at this fraction of the Core's rest distance (so the assembly's pull-back is real); floored at the cloud's near face
  threadDrift: 0.2, // ?threaddrift — S1→S2: how far back toward the wide the camera eases DURING the trace (0 = holds tight until the assembly, 1 = fully wide before it)
  assembleSeconds: 2.5, // ?assemble — assembly, scatter → home
  showRush: 5, // ?showrush — a forward step DURING the S1→S2 show fast-forwards its remainder at this timeScale (the Thread snaps taut, the Core comes together fast), then the requested stage plays whole — S3's light-up uncompressed. 1 = the show plays out at real time before the step lands (10-07)
  zoomOutSeconds: 0.6, // ?zoomout — S2→S3 dolly-back (the black field grows out of the Core on it; 10-10 (w9c): the SOLID field — blue on the black opening). 10-07 (w4): A/B 1.1 for Nathan (a slower flood before the ignition)
  ignite: 'auto', // ?ignite — 10-10 (w9c fix, scr-1): S2→S3's IGNITION on the solid field. auto = field-aware: on a solid that IS the lit colour (the blue field on the black opening) the Core goes INTO the light as the flood lands (every panel to full power, its edge ink out — one with the field it floods) and the cascade DRAWS it back (the ink in on the cascade's order and delays, the seams just after): the line drawing assembles in the light; on a black solid (?opening=blue) the blackout and flicker, w9b exactly. dark = the blackout on every field (on blue a black Core silhouette that the cascade dissolves into the field — the review's 'reads inverted'). Same window and clocks either way. PROPOSED auto
  coreSeam: 'black', // ?coreseam — 10-07 (w4): the Core's SEAMS (the inner sphere showing between the panels) from S3 on: black | white. Lit panels and a blue inner sphere were the same #0000FF, so the lattice vanished at S3; S1/S2 keep the blue gap
  s3Notes: 4, // ?s3notes — 10-07 (w5): S3's SPEC SHEET — a ceiling on the annotation chips naming the solid Core (logo_suite, type_pairings, color_palette, layout_sensibility), one per beat at ?bpm in copy order once the ignition has played; a phone that seats two shows two. 0 = off
  /* — 10-09 (w9b): S2's REFINE (Nathan: "have the panels decrease their fill
     opacity to start as well as their stroke opacity. As the line connects
     each panel, they ping and become dark, with each hit on a panel creating
     a dot at the hit point that persists as the line draws … if they go back
     to that phase, it reconnects the dots"). Never opacity: the ghost is the
     fog channel's mix toward the field. PROPOSED defaults, Nathan's A/B. — */
  s2Ghost: 0.5, // ?s2ghost — 10-09 (w9b): S2's GHOST — how far every panel the Thread has not reached is mixed toward the field, fill AND stroke (the fog channel, never opacity); a hit lifts it off its bead. 0 = none (w9). PROPOSED 0.5 (measured, rendered at both widths — 10-09 w9b fix R5: unreached fill 1.16:1 / stroke 1.42:1 on the blue field; w9's idle shard 1.37:1, black stroke 2.44:1)
  s2Dark: 0.45, // ?s2dark — 10-09 (w9b): a struck bead's settled DARK level, × ?idlepower, full stroke (w9's claim was 0.85). PROPOSED 0.45 (dark bead vs a ghosted neighbour ≥ 1.5:1). 10-10 (w9c): the BLUE-field rule — on the black opening ?s2lit owns the bead (below)
  s2Lit: 1, // ?s2lit — 10-10 (w9c, s2-refine-on-black): a struck bead's settled level when S2 sits on the BLACK opening — uPower, absolute (1 = the solid #0000FF: the bead "becomes defined" while the ghost dims the rest toward the field). On black, w9b's dark bead (?s2dark × ?idlepower ≈ 0.24) and the ghost (≈ 0.27) collapse into the field. 0 = off: ?s2dark on any field (w9b's literal dark — arm b). On the blue opening ?s2dark rules as built. PROPOSED 1
  s2Ping: 0.6, // ?s2ping — 10-09 (w9b): the hit's PING — one white heat flash on the bead (attack 0.04s on power2.out, sine.out fall 0.35s — 10-09 w9b fix R5: the code's ease, not expo), peak mix; 0 = none (w9's dip-and-settle to ?s2dark instead). PROPOSED 0.6
  // ?reconnectsecs — 10-09 (w9b, s2-reconnect): the S3→S2 RECONNECT's trace, s
  // (first hop to last claim); 0 = ?threadsecs, the show's own (the brief's
  // "full show"). The un-peel + 4.2 s trace measures ≈6.6 s — past the 6.5 s
  // stop rule — so a shorter arm is offered (≈2 s: ≈4.4 s whole). PROPOSED 0
  reconnectSecs: 0,
  s2Dot: 6, // ?s2dot — 10-09 (w9b): the hit DOT — screen px diameter of the white dot each hit leaves where the line meets its bead (constant on screen, rides the bead); 0 = none. PROPOSED 6
  tease: 3.9, // ?tease — 10-07 (w5): S2 foreshadow — seconds with no input at the S2 Core's rest before ONE row of S3's cascade flickers and settles back (once per visit). 0 = off
  s3Head: 'assembly', // ?s3head — 10-09 (w9b, s3-headline): when S3's headline (CORE_ASSEMBLY) lands on the authored S2→S3. assembly = as the assembly STARTS (the headline names what you are watching; the blurb still rises on the ignition + ?s3copy); ignition = w9 exactly (the whole card waits for the light). PROPOSED assembly
  s3Copy: 0.9, // ?s3copy — 10-07 (w4): S3's copy lead, s — the headline waits for the ignition (lines at 0.35 + this, the keyword wipe at 1.05 + this); the PHASE token still scrambles on arrival
  emanateScale: 1.7, // ?emanate — S4 per-panel scale target
  emanateOrder: 'poles', // ?emanateorder — S4 stagger (contrasts S3's rows)
  s4Push: 0, // ?s4push — 10-07 (w5): S3→S4's push-in starts this many s into the transition; 0 = derived from the emanation (the last panel's burst 35% done, ≈1.15s at the bake) — burst, settle, THEN the approach
  s4PushSecs: 1.2, // ?s4pushsecs — 10-07 (w5): the S3→S4 push-in's length, s, on the Turn curve (the reverse is the run backwards at the exit ratio)
  heartbeat: 0.4, // ?heartbeat — 10-07 (w5): S4's resting heartbeat, a unison pulse every 2 beats at ?bpm; introduces S5's tempo before the drop. 0 = off (S4 static, as before). 10-08 (w8): now the DEPTH of a dip of the world's light (uPower → rest × (1 − this), the S5 hit's attack, the ?decaycurve recovery), no longer a stroke peak — the stroke route measured under 1/255 even at 1. (w8 baked 0.22 ≈ 8/255 mean-RGB swing over the sphere, just visible.) 10-09 (w9, Nathan): 'have the world dim to, say, 60%' — 0.4, so the dip's floor is 0.6 of S4's power
  reach: 0.25, // ?reach — 10-07 (w5): S4 desktop pointer reach — a panel within 0.22 × min(vw, vh) of the mouse leans out by up to this × its home offset (critically damped, no overshoot; drops back after 2s still or on leave). 0 = off
  bpm: 123, // ?bpm — S5 pattern-loop tempo
  cascadeVariant: 'rows', // ?cascade — S3 light-up (home hero keeps sweep)
  fillFraction: 0.98, // ?fillfrac — contain fit; the belt fits whole (both breakpoints — Nathan's pick)
  s3Fill: 0.31, // ?s3fill — post-zoom-out: the Core small, in the distance
  s45Fill: 1.1, // ?s45fill — build-out: outgrows the frame, stays contained
  idlePower: 0.54, // ?idlepower — belt idle: under field brightness (strokes carry the read)
  pulseMin: 0.06, // ?pulsemin — S5 floor: how dark the falloff lands (0 = full black)
  holdBeats: 2, // ?hold — S5 envelope + the S1 label pulse: beats held ON blue (S5 caps it at 45% of the cycle) before the falloff (Nathan 09-10: 2)
  decayBeats: 3, // ?decay — S5 envelope + the S1 label pulse: beats of steep (expo) falloff to the floor (Nathan 09-10: 3)
  pattern: 'cycle', // ?pattern — S5 sequencing (rows/equator/ripple/checker/random/cycle)
  decayCurve: 'expo', // ?decaycurve — S5 falloff shape: expo (baked feel) | linear (house-pulse read) — A/B toggle, v2 deck
  s5Zoom: 1.06, // ?s5zoom — S5 push-in over the S4 framing (world emphasized)
  s5TiltDeg: 33, // ?s5tilt — S5 axis lean toward ~2:00, eased in on the house curve
  s5Stroke: 1, // ?s5stroke — inner-stroke mix where the falloff lands (0 disables)
  countIn: 2, // ?countin — 10-07 (w6, s5-drop): beats of COUNT-IN before S5's drop — the world goes dark on the first (lights-down), holds the second, and all 84 panels hit together on the [[goes live]] wipe (s5DropAt). 0 = no intro (the pre-w6 S5: the groove starts on the landing)
  tapCue: 'on', // ?tapcue — 10-07 (w6, s5-tap-cue): at the S5 rest a mouse/pen CLICK on a front-facing shard cues the next pass, on the next beat, as a ripple out of that shard (the cursor turns pointer over one); off = the field only drags. 10-08 (w8): a finger TAP cues too (≤6px travel, ≤250ms — a swipe still steps the page)
  s5Chip: 'on', // ?s5chip — 10-08 (w8, s5-pages-on-the-world): each S5 page turn seats its chapter's word (logo_suite … brand_components) as an in-scene chip on a front-facing shard near where that pass's light starts, in the word's S3 colour; it holds its page and leaves before the next. off = the readout pages alone (pre-w8)
  /* — The CTA FINALE (10-07, w7): 'cta' is a stage. A forward step off S5
     RESOLVES the world on the next downbeat (all 84 panels to full, ink out),
     the camera pulls back into the FREE rect (the viewport minus the risen
     footer minus the CTA copy), and one shard — the visitor's world — lifts
     free, turns, and wears a first_contact chip that answers the CTA hover. — */
  finale: 'on', // ?finale — 10-07 (w7): on = THE TURN at the CTA (one shard lifts free, tumbles to a seeded rest, wears the first_contact chip, pulses on the CTA's hover/focus); off = the world only resolves and steps back
  ctaLoop: 'breathe', // ?ctaloop — 10-07 (w7): the world AFTER the resolve: breathe = every panel (bar the freed shard) breathes in unison — 0.14s up to 0.9, a 6-beat fall to 0.35, one breath every 8 beats at ?bpm; hold = held fully lit, still. Nathan's A/B
  ctaFill: 0.8, // ?ctafill — 10-07 (w7): the CTA globe's size, a fraction of the FREE rect's contain fit (1 = touches its short side)
  ctaSeconds: 1.2, // ?ctasecs — 10-07 (w7): S5→CTA pull-back AND the shard's lift/turn, s, on the Turn curve (the return runs at the exit ratio)
  liftK: 0.35, // ?liftk — 10-07 (w7): how far the freed shard lifts off the Core, added to its ?emanate radius multiple (0 = it only turns in place)
  strokePx: 1.75, // ?stroke — Fragment edge stroke width (screen px; 0 disables)

  /* — DISCOVERY round (09-09, Nathan): the S1 belt is a place the camera
     TRAVELS THROUGH, not a still life. Everything below is stage-01 only
     and unwinds as the Fragments assemble. — */
  fog: 0.56, // ?fog — atmospheric depth: how far the FURTHEST shard's fill AND stroke are pulled toward the field color (0 = off, 1 = it IS the field). Never opacity — the panels stay fully opaque
  fogSpan: 0.7, // ?fogspan — depth to full haze BEHIND the belt's establishing distance, × ?scatter (the window opens a quarter of this in front). Anchored in WORLD depth, not to the dolly: push the camera toward a far shard and it clears
  fogRide: 0, // ?fogride — 10-07 (w3): share of the push-in the haze window TRAVELS WITH THE LENS (0 = world-still, the bake: once the lens is inside the cloud every shard clears; 0.7 = near/far slide 70% of the camera's way in, so a close-up keeps its depth layering — near shards crisp, far ones in haze). A/B for Nathan against the 09-10 untied window
  tour: 'on', // ?tour — the S1 camera tour (off = the static establishing frame the belt held before 09-09)
  tourTravel: 3.4, // ?tourtravel — seconds of glide per station, on the house Turn curve
  tourHold: 2.6, // ?tourhold — seconds the camera RESTS on a close-up (the label's reading beat)
  tourGlance: 0.7, // ?tourglance — 10-07 (w3): a GLANCE leg's travel AND hold as a multiple of ?tourtravel/?tourhold (it names half the chips); the other legs LINGER (travel × 1.12, hold × 1.23, every chip, slowest subjects), ≈50/50, never three of a kind. 1 = the old even metronome
  tourNear: 0.42, // ?tournear — closest station's dolly distance as a fraction of the establishing frame; the floor keeps the cloud's near face in front of the camera
  tourFar: 0.66, // ?tourfar — farthest close-up station, same units (stations land between near and far)
  labelPulse: 0.6, // ?labelpulse — how DARK a labelled shard's fill pulses, as a fraction of the belt's resting ?idlepower (1 = no pulse): the house envelope (?bpm ?hold ?decay) inverted — snap down, hold, expo recover — for as long as the chip names it
  labelLead: 136, // ?labellead — screen px between a chip and the shard it names (the leader's length); round 1 sat them 20px out and the pairing was hard to read
  tourShift: 1, // ?tourshift — how far a station must MOVE the camera from the last one, in multiples of the new station's half-frame width (1 = the frame slides by half its width, so most of what is in view is new); the picker takes the farthest candidates if none clears it
  tourReach: 0.34, // ?tourreach — how far off-centre a station SEATS its subject, as a multiplier on the baked compositional thirds (1× = the bake; 0 centres every shot, which is what the photography rule says not to do)
  spinFast: 4.4, // ?spinfast — the fast rotation tier's multiplier over the base ?drift rate
  spinFastFrac: 0.3, // ?spinfastfrac — fraction of shards seeded onto that fast tier (0 = one uniform rate, the pre-09-09 read)
  // ?labels — annotation chips alive at once on desktop (≤768px reads ?labelsm); needs a reload — slots are built at mount.
  // History: 8 → 4 (Nathan 09-10: capped at 4; each chip then drew 3 calls). 10-09 (w9b): the batch (calls 85 + N + 2)
  // and Nathan's "a lot more chips" → PROPOSED 8, by measurement (3 × 150 s pooled, after the S1 leader rule):
  // achieved per station med/p90 4/8 (today's 4: 2/4), overlap/keep 0, crossings 0.078 ± 0.027 per chip (today
  // 0.067 ± 0.044; time crossed 0.019 vs 0.035 of chip-time), fps 49.3 ± 3.9 (today 50.5 ± 2.6), calls 95. 10 stopped
  // growing (median 5 vs 8's 5.5, screening). Nathan bakes — `?labels=4` is today's read. docs/process-page-spec.md § S1 chips.
  labelCount: 8,
  // ?labelsm — 10-09 (w9b, more-chips): the PHONE's chip count (≤768px), ?labels' twin (was min(?labels, 3)); needs a
  // reload. PROPOSED 5 by the same measurement: med/p90 3/5 (today's 3: 2/3), crossings 0.054 ± 0.013 per chip (today
  // 0.131 ± 0.041), fps 53.3 ± 2.1 (today 54.2 ± 0.6), calls 92; 6 stopped growing (median 3). `?labelsm=3` = today.
  labelCountMobile: 5,
  labelSize: 0, // ?labelsize — chip type size in px; 0 = the .process-label token (--text-mono). Live.
  labelCharMs: 22, // ?labelchar — ms between letter cuts in a chip's random-letter entrance (charCut.js)
  chipKey: 'off', // ?chipkey — 10-07 (w3): on = a 1px stroke-colour keyline round a FILLED chip, for the pool colours that sit close to the blue field (#3D32FF). A/B for Nathan; off = no keyline. 10-08 (w8): auto = the keyline ONLY on a fill that sinks into the live field behind it (contrast ≤ CHIP_KEY_AUTO_MAX 1.5:1 against that stage's field colour)
  chipCover: 'bind', // ?chipcover — 10-08 (w8b): the S1 tour chips' cover rule (Thread words, spec, page and CTA chips unaffected). off = pre-w8 seating (the strict seat's screen circle only; the loose fallback and the subject's last resort untested); bind = w8 (the exact raycast cover on the loose seat at the bind); hold = bind + the exact cover as an extra refusal on the strict seat + the PREDICTED hold (the seat must stay uncovered over the station's remaining hold — the drift stepped ahead and restored); the subject falls back to a seat never buried. Stays bind (10-08, w8b fix — the gate re-read LIVE): hold ties off on naming the subject at its arrival (desktop 24.4/27 vs 23.8 with the widest spread, one run in five 19; phone 25.3 vs 26.0) — not the gate's clean pass, so hold is Nathan's A/B; ≈ never buried, not never crossed (CHIP_COVER_MAX unchanged; 10-08 (w8b fix2): the one covered look a 7–8-look walk tolerates can be the FIRST, the chip's opening — a bind-time burial is rare, not impossible); docs/process-page-spec.md § S1 chip cover
  labelHold: 3.2, // ?labelhold — seconds a chip HOLDS at full strength after its letters land — ONLY when the tour is off; with the tour running a chip lives exactly as long as the camera holds its station
  /* — The BREAK (10-07, Nathan): the PROCESS globe-O is a stage now — it
     shatters into the stage-01 belt (a sudden fragmentation, then a long
     falloff that leaves the shards hanging in suspended animation), and
     the shards fly home into it on the way back up. Next-beat knobs: ↻
     replay stage 01 (or scroll back to the top) to hear a change. — */
  shatterSeconds: 2.6, // ?shatter — impact → suspended: each shard's flight on the processShatter curve (≈37% of the way in 0.11s, 85% by 0.8s, then the hang). 10-07 (w2): it no longer sets the reform (?reform)
  shatterKick: 1.8, // ?shatterkick — 10-07 (w2) CHANGED MEANING: the flight's BOW at its chord midpoint, in O radii, radial out of the O in the image plane, clamped to 0.45 × the shard's SCREEN chord — so no shard reverses at launch or overshoots its landing (0 = straight lines). Reads softer than the old straight throw at the same value
  reformSeconds: 1.2, // ?reform — 10-07 (w2): the reform, scroll-back cue → the O's landing frame, s (×0.65 when compressed), on processTurn, far shards first, the word back first. Was ?shatter × the exit ratio (1.82s), whose Turn tail held an already-whole white O ≈0.6s
  shatterSpin: 0.75, // ?shatterspin — turns a shard tumbles off the break (seeded 0.5–1.5×); decays with the flight straight into the belt drift (above ~1 the first frames strobe)
  shatterCharge: 0.45, // ?shattercharge — the splash's wind-up: seconds the O revs and burns white before it breaks (0 = no wind-up, still a white impact); a break the reader scrolls into skips the wind and flashes white on the swipe's commit
  shatterDepth: 1.25, // ?shatterdepth — how deep the O's shards start, × the belt's camera distance, at the lockup's exact screen size: they come forward out of the haze. Deeper softens the first-frame bite into a zoom (2.2 halves it)
  oWind: 400, // ?owind — the wind-up's peak rev, deg/s ADDED to the O's ?ospin ambient (≤450 keeps a 30fps frame under half a meridian)
  shatterShock: 'on', // ?oshock — the white shock ring that runs out along the O's tilted equator at the break (off = none)
  mobileDrop: 0.02, // ?dropy — phone: Core drop, the fine adjustment subtracted AFTER the ?cardgap lift (near-zero per the 07-16 dial; 10-07 (w4): kept at 0.02 — the lift absorbs it)
  cardGap: 16, // ?cardgap — 10-07 (w4) phone: px of clear air the Core keeps above the bottom-anchored copy card; the Core lifts only as far as it must (never past the nav)
  swipe: 'on', // ?swipe — one-section-per-swipe scroll (off = free document scroll)
  swipePx: SCROLL_TRIGGER_PROCESS_PX, // ?swipepx — wheel/touch px to commit a swipe (house constant, motion.js)
  swipeSeconds: 0.8, // ?swipems — the committed section glide (house Turn curve)
};

/* — The live knob set — mutate through the ?debug panel — */
export const TUNING = {
  stageSeconds: num('stagems', TUNING_DEFAULTS.stageSeconds * 1000) / 1000,
  scatter: num('scatter', TUNING_DEFAULTS.scatter),
  drift: num('drift', TUNING_DEFAULTS.drift),
  threadHops: num('threadhops', TUNING_DEFAULTS.threadHops),
  threadSeconds: num('threadsecs', TUNING_DEFAULTS.threadSeconds),
  threadAccel: num('threadaccel', TUNING_DEFAULTS.threadAccel),
  threadWords: num('threadwords', TUNING_DEFAULTS.threadWords),
  threadInk: str('threadink', TUNING_DEFAULTS.threadInk),
  opening: str('opening', TUNING_DEFAULTS.opening),
  ctaRamp: num('ctaramp', TUNING_DEFAULTS.ctaRamp),
  ctaInk: str('ctaink', TUNING_DEFAULTS.ctaInk),
  heroV: str('herov', TUNING_DEFAULTS.heroV),
  nextTease: str('nexttease', TUNING_DEFAULTS.nextTease),
  threadHead: str('threadhead', TUNING_DEFAULTS.threadHead),
  threadTight: num('threadtight', TUNING_DEFAULTS.threadTight),
  threadDrift: num('threaddrift', TUNING_DEFAULTS.threadDrift),
  assembleSeconds: num('assemble', TUNING_DEFAULTS.assembleSeconds),
  showRush: num('showrush', TUNING_DEFAULTS.showRush),
  zoomOutSeconds: num('zoomout', TUNING_DEFAULTS.zoomOutSeconds),
  coreSeam: str('coreseam', TUNING_DEFAULTS.coreSeam),
  s3Head: str('s3head', TUNING_DEFAULTS.s3Head),
  s3Copy: num('s3copy', TUNING_DEFAULTS.s3Copy),
  s3Notes: num('s3notes', TUNING_DEFAULTS.s3Notes),
  s2Ghost: num('s2ghost', TUNING_DEFAULTS.s2Ghost),
  s2Dark: num('s2dark', TUNING_DEFAULTS.s2Dark),
  s2Lit: num('s2lit', TUNING_DEFAULTS.s2Lit),
  s2Ping: num('s2ping', TUNING_DEFAULTS.s2Ping),
  s2Dot: num('s2dot', TUNING_DEFAULTS.s2Dot),
  reconnectSecs: num('reconnectsecs', TUNING_DEFAULTS.reconnectSecs),
  tease: num('tease', TUNING_DEFAULTS.tease),
  emanateScale: num('emanate', TUNING_DEFAULTS.emanateScale),
  emanateOrder: str('emanateorder', TUNING_DEFAULTS.emanateOrder),
  s4Push: num('s4push', TUNING_DEFAULTS.s4Push),
  s4PushSecs: num('s4pushsecs', TUNING_DEFAULTS.s4PushSecs),
  heartbeat: num('heartbeat', TUNING_DEFAULTS.heartbeat),
  reach: num('reach', TUNING_DEFAULTS.reach),
  bpm: num('bpm', TUNING_DEFAULTS.bpm),
  cascadeVariant: str('cascade', TUNING_DEFAULTS.cascadeVariant),
  ignite: str('ignite', TUNING_DEFAULTS.ignite),
  fillFraction: num('fillfrac', TUNING_DEFAULTS.fillFraction),
  s3Fill: num('s3fill', TUNING_DEFAULTS.s3Fill),
  s45Fill: num('s45fill', TUNING_DEFAULTS.s45Fill),
  idlePower: num('idlepower', TUNING_DEFAULTS.idlePower),
  pulseMin: num('pulsemin', TUNING_DEFAULTS.pulseMin),
  holdBeats: num('hold', TUNING_DEFAULTS.holdBeats),
  decayBeats: num('decay', TUNING_DEFAULTS.decayBeats),
  pattern: str('pattern', TUNING_DEFAULTS.pattern),
  decayCurve: str('decaycurve', TUNING_DEFAULTS.decayCurve),
  s5Zoom: num('s5zoom', TUNING_DEFAULTS.s5Zoom),
  s5TiltDeg: num('s5tilt', TUNING_DEFAULTS.s5TiltDeg),
  s5Stroke: num('s5stroke', TUNING_DEFAULTS.s5Stroke),
  countIn: num('countin', TUNING_DEFAULTS.countIn),
  tapCue: str('tapcue', TUNING_DEFAULTS.tapCue),
  s5Chip: str('s5chip', TUNING_DEFAULTS.s5Chip),
  finale: str('finale', TUNING_DEFAULTS.finale),
  ctaLoop: str('ctaloop', TUNING_DEFAULTS.ctaLoop),
  ctaFill: num('ctafill', TUNING_DEFAULTS.ctaFill),
  ctaSeconds: num('ctasecs', TUNING_DEFAULTS.ctaSeconds),
  liftK: num('liftk', TUNING_DEFAULTS.liftK),
  strokePx: num('stroke', TUNING_DEFAULTS.strokePx),
  fog: num('fog', TUNING_DEFAULTS.fog),
  fogSpan: num('fogspan', TUNING_DEFAULTS.fogSpan),
  fogRide: num('fogride', TUNING_DEFAULTS.fogRide),
  tour: str('tour', TUNING_DEFAULTS.tour),
  tourTravel: num('tourtravel', TUNING_DEFAULTS.tourTravel),
  tourHold: num('tourhold', TUNING_DEFAULTS.tourHold),
  tourGlance: num('tourglance', TUNING_DEFAULTS.tourGlance),
  tourNear: num('tournear', TUNING_DEFAULTS.tourNear),
  tourFar: num('tourfar', TUNING_DEFAULTS.tourFar),
  tourShift: num('tourshift', TUNING_DEFAULTS.tourShift),
  tourReach: num('tourreach', TUNING_DEFAULTS.tourReach),
  labelPulse: num('labelpulse', TUNING_DEFAULTS.labelPulse),
  labelLead: num('labellead', TUNING_DEFAULTS.labelLead),
  spinFast: num('spinfast', TUNING_DEFAULTS.spinFast),
  spinFastFrac: num('spinfastfrac', TUNING_DEFAULTS.spinFastFrac),
  labelCount: num('labels', TUNING_DEFAULTS.labelCount),
  labelCountMobile: num('labelsm', TUNING_DEFAULTS.labelCountMobile),
  labelSize: num('labelsize', TUNING_DEFAULTS.labelSize),
  labelCharMs: num('labelchar', TUNING_DEFAULTS.labelCharMs),
  chipKey: str('chipkey', TUNING_DEFAULTS.chipKey),
  chipCover: str('chipcover', TUNING_DEFAULTS.chipCover),
  labelHold: num('labelhold', TUNING_DEFAULTS.labelHold),
  shatterSeconds: num('shatter', TUNING_DEFAULTS.shatterSeconds),
  shatterKick: num('shatterkick', TUNING_DEFAULTS.shatterKick),
  reformSeconds: num('reform', TUNING_DEFAULTS.reformSeconds),
  shatterSpin: num('shatterspin', TUNING_DEFAULTS.shatterSpin),
  shatterCharge: num('shattercharge', TUNING_DEFAULTS.shatterCharge),
  shatterDepth: num('shatterdepth', TUNING_DEFAULTS.shatterDepth),
  oWind: num('owind', TUNING_DEFAULTS.oWind),
  shatterShock: str('oshock', TUNING_DEFAULTS.shatterShock),
  mobileDrop: num('dropy', TUNING_DEFAULTS.mobileDrop),
  cardGap: num('cardgap', TUNING_DEFAULTS.cardGap),
  swipe: str('swipe', TUNING_DEFAULTS.swipe),
  // Own param (?swipepx) so /process dials independently of the ?scroll
  // shared by the hero + /work; ?scroll still honored for old copy_urls.
  swipePx: num('swipepx', num('scroll', TUNING_DEFAULTS.swipePx)),
  swipeSeconds: num('swipems', TUNING_DEFAULTS.swipeSeconds * 1000) / 1000,
};

/* — S5 pattern vocabulary (?pattern). `cycle` rotates through the rest,
   one pattern per 8-beat pass. — */
export const RHYTHM_PATTERNS = ['cycle', 'rows', 'equator', 'ripple', 'checker', 'random'];

/* — Fixed constants — */
export const LIT_COLOR = 0x0000ff; // electric blue — panel fill AND the blue field; strokes/power do the separating
export const STROKE_COLOR = 0x000000; // Fragment edge stroke — black ink; the black field is the same token
// 10-07 (final review): --color-white's mirror — the break's heat (the shards'
// and the decoys' uBlueColor), the globe-O's white disc and the shock ring.
export const WHITE_COLOR = 0xffffff;

/* — 10-10 (w9c, the black opening): THE FIELD TABLE — every field-dependent
   colour reads it, nothing names a field per stage. Poses name a ROLE:
   · `open`     — hero, S1, S2: the page's own base (html, body, .process-page —
                  process.css keys it on the root's data-opening);
   · `solid`    — S3, S4: the layer the ignition grows out of the Core's disc
                  (.process-bg__blue, bgMorph) — the OTHER field;
   · `gradient` — S5 and the CTA: the home hero's `to top` ramp (the CTA's
                  stop reaches higher, ?ctaramp).
   fieldOf(role) resolves role × ?opening to the COLOUR the field shows — the
   name the root's data-bg carries (black | blue | gradient), so the DOM
   chrome rules keep meaning a colour. Per field: `hex` (the field, as the
   panels speak it — the lit panel IS the blue field, the edge ink IS the
   black one), `thread` (the S2 Thread's ?threadink auto: a black string
   vanishes on black), `dot` (w9b's S2 hit dot — white on both), `ink` (the
   lit world's black edge stroke on that field: on blue the stroke carries
   the read — a full-power #0000FF world at stroke 0 IS the field, invisible
   — on black the light does). The S2 bead rule (?s2dark on blue, ?s2lit on
   black) and the fog colour (the scene's live field, every frame) derive
   from the same rows. */
export const FIELDS = {
  black: { hex: STROKE_COLOR, thread: WHITE_COLOR, dot: WHITE_COLOR, ink: 0 },
  blue: { hex: LIT_COLOR, thread: STROKE_COLOR, dot: WHITE_COLOR, ink: 1 },
};
// The home hero's ramp (global.css .hero): electric blue at the foot, black
// at 40% of the viewport up — S5's, as built; the CTA reads ?ctaramp.
export const S5_RAMP = 0.4;
export const fieldOf = (role) => {
  const open = TUNING.opening === 'blue' ? 'blue' : 'black';
  if (role === 'open') return open;
  if (role === 'solid') return open === 'blue' ? 'black' : 'blue';
  return 'gradient';
};
export const ctaRamp = () => Math.min(Math.max(TUNING.ctaRamp, 0.05), 1);
// 10-10 (w9c): the CTA world's edge ink (?ctaink) — a number pins it (0 =
// w9b's ink-less resolve). auto = the blue field's ink where it OUTREADS the
// lit world: `edge` is the scene's verdict on the field under the world's
// lower silhouette (useProcessScene's ctaEdgeInk: 1 | 0); the pre-w9c ramp
// (≤ S5's) never inks, so the blue arm stays w9b's.
// 10-10 (w9c fix2, cta-ink-phone): auto scaled by the ramp's share past S5's
// (1 at 0.8) and so inked the PHONE's world too, which sits over the ramp's
// near-black top (blue ≈35 under its edge): 4–19% of its silhouette columns
// under 1.2:1 vs 0–2% ink-free. Never a partial mix either — it takes the
// edge THROUGH the field's colour on its way to black.
export const ctaInk = (edge = 1) => {
  const v = Number(TUNING.ctaInk);
  if (TUNING.ctaInk !== 'auto' && Number.isFinite(v)) return Math.min(Math.max(v, 0), 1);
  return ctaRamp() > S5_RAMP ? FIELDS.blue.ink * edge : 0;
};
/* 10-07 (w4): the Core's seam colour from S3 on (?coreseam). The inner
   sphere shows through the panel gaps as the lat/long lattice; on S1/S2 it is
   GAP_COLOR blue (the blueprint read, strokes carry the shards), but once S3
   lights the panels to full #0000FF the same blue erased every seam — the
   loudest beat resolved into a featureless disc. The panels' colour still
   never tweens; only the seams do. Unknown values fall back to black. */
export const SEAM_COLORS = { black: 0x000000, white: 0xffffff };
export const seamColor = () => SEAM_COLORS[TUNING.coreSeam] ?? SEAM_COLORS.black;
/* S5 inner stroke: the "brown-blue" visible when panels go dark (v2 deck).
   First swatches — Nathan confirms at the feel pass. A = the resting ink,
   B = the warmer end of the per-panel offset color drift. */
export const S5_STROKE_A = 0x3e3a52;
export const S5_STROKE_B = 0x53402f;
export const DESKTOP_OFFSET_X = 0.28; // globe right-of-center (fraction of visible half-width)
export const EXIT_RATIO = 0.7; // exits/reversals ≈0.7× their entrance durations
/* 10-07 (perf-1): the 60fps gate's tolerance, seconds. gsap.ticker stamps
   with Date.now, so its deltas are whole ms (17, 17, 16 at 60Hz) — a strict
   `acc < 1/FPS_CAP` dropped every 16 and drew 2 frames in 3 (≈40fps, with a
   doubled frame the slow camera moves show as judder; 40 at 120Hz too). 2ms
   under the cap draws every vsync at 60Hz and every 2nd at 120Hz. Shared by
   the scene and the globe-O's own canvas; the home and /work globes still
   carry the strict check (globe/** is another session's — a follow-up). */
export const FRAME_GATE_SLACK = 0.002;
// S5: one pattern pass per 6 beats (07-30 rhythm rework — was 8; tighter
// changeovers, with the full-pass hit spread killing the dead tail).
export const PASS_BEATS = 6;

/* 10-07 (w6, s5-drop): THE S5 clock — when the unison DROP lands, s after the
   S4→S5 commit (the 'top 60%' line both the scene and the copy fire on). The
   S4→S5 morph runs ?stagems, then the ?countin count-in (≈1.63s at the bake:
   0.65 + 2 × 60/123). ONE number, two readers: the scene's intro places its
   drop here (startLoops), the copy's COPY_BEAT['stage-05'] leads the
   entrance so the [[goes live]] wipe starts 0.05s before it. A pure function
   of TUNING — the copy reads it at its onEnter, which can come BEFORE the
   scene has built the transition. Clamped so the count-in always keeps one
   whole beat of lights-down after the morph lands: the build is ?stagems,
   floored at the 0.3s background crossfade (buildTransition's bgCrossfade). */
export const beatSeconds = () => 60 / Math.max(TUNING.bpm, 1);
export const s5DropAt = () => {
  const beat = beatSeconds();
  const land = Math.max(TUNING.stageSeconds, 0.3);
  return Math.max(TUNING.stageSeconds + Math.max(TUNING.countIn, 0) * beat, land + beat);
};

/* 10-07 (w6): the S5 readout's ● wears a project colour (pool[0], or a
   chapter's remembered S3 spec fill). The field behind it runs from black to
   the electric-blue foot of the gradient (the phone's card sits on that
   foot), and the lit world is the same blue — a fill under 3:1 (WCAG non-text)
   against either keeps its colour and takes a white KEYLINE instead
   (process.css .process-stage__beat[data-key]). Most of the pool sits under
   3:1 on #0000FF (#B63947 1.5, HHS #3D32FF 1.3); the yellows, the orange, the
   magenta and the teal clear it. */
// 10-07 (final review): derived from the scene's own token mirrors (the
// black field = STROKE_COLOR, the lit world and the foot = LIT_COLOR), so a
// palette change lands in one place. 10-10 (w9c): the field table's rows.
const hexCss = (n) => `#${n.toString(16).padStart(6, '0')}`;
const BEAT_FIELDS = [relLum(hexCss(FIELDS.black.hex)), relLum(hexCss(FIELDS.blue.hex))];
export const beatKeyed = (hex) => {
  const L = relLum(hex);
  if (L == null) return false;
  return BEAT_FIELDS.some((F) => (Math.max(L, F) + 0.05) / (Math.min(L, F) + 0.05) < 3);
};
