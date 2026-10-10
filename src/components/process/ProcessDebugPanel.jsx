/**
 * ProcessDebugPanel — the ?debug live-tuning chrome (spec §6: mounts on
 * the gated route itself — no /lab/process to maintain).
 *
 * Sliders mutate the shared TUNING object and call scene.applyTuning():
 * framing / belt spread / drift / glow apply instantly; durations, orders,
 * hops and rhythm apply to the next transition — jump a stage or hit
 * ↻ replay to hear them. copy_url serializes the non-default knobs back
 * into a shareable query string (the bake-in path: paste the values into
 * TUNING_DEFAULTS once dialed).
 */
import { useEffect, useState } from 'react';
import { TUNING, TUNING_DEFAULTS, RHYTHM_PATTERNS } from './processConfig.js';

// 10-07: the hero is a stage — the whole globe-O ('O'); ↻ on it replays
// the reform, ↻ on 01 the break. 10-07 (w7): the CTA is a stage too ('CTA').
const STAGES = ['hero', 'stage-01', 'stage-02', 'stage-03', 'stage-04', 'stage-05', 'cta'];

/* Slider knobs: key into TUNING, URL param name, range. `ms` knobs are
   stored in seconds but travel as milliseconds in the URL (spec §9). */
const SLIDERS = [
  { key: 'scatter', param: 'scatter', min: 0.8, max: 3.2, step: 0.05 },
  { key: 'drift', param: 'drift', min: 0, max: 0.8, step: 0.005 },
  { key: 'idlePower', param: 'idlepower', min: 0, max: 1, step: 0.02 },
  { key: 'strokePx', param: 'stroke', min: 0, max: 4, step: 0.25 },
  { key: 'fillFraction', param: 'fillfrac', min: 0.4, max: 1.2, step: 0.01 },
  { key: 's3Fill', param: 's3fill', min: 0.2, max: 1, step: 0.01 },
  { key: 's45Fill', param: 's45fill', min: 0.5, max: 1.3, step: 0.01 },
  { key: 'stageSeconds', param: 'stagems', min: 0.4, max: 3, step: 0.05, ms: true },
  { key: 'zoomOutSeconds', param: 'zoomout', min: 0.3, max: 2.5, step: 0.05 },
  // 10-07 (w4): S3's copy lead — the headline waits for the ignition (next S3 entrance).
  { key: 's3Copy', param: 's3copy', min: 0, max: 2, step: 0.05 },
  /* 10-07 (w5): the S3/S4 rests. ?s3notes = the spec sheet's chip ceiling
     (next S3 arrival); ?tease = the S2 foreshadow's idle wait (0 = off);
     ?s4push (0 = derived from the emanation) + ?s4pushsecs = the S3→S4
     approach (next S4 entrance); ?heartbeat = S4's unison pulse — 10-08
     (w8): the DEPTH of a dip of the world's light, not a stroke peak
     (live — rebuilds the loop); ?reach = the S4 pointer lean (live). */
  { key: 's3Notes', param: 's3notes', min: 0, max: 4, step: 1 },
  { key: 'tease', param: 'tease', min: 0, max: 10, step: 0.1 },
  /* 10-09 (w9b): S2's refine — the unreached shards' ghost toward the field
     (live), a struck bead's dark level × ?idlepower (live at the S2 rest),
     the hit's white ping (next hit) and the hit dot's px (live). */
  { key: 's2Ghost', param: 's2ghost', min: 0, max: 1, step: 0.05 },
  { key: 's2Dark', param: 's2dark', min: 0, max: 1, step: 0.05 },
  { key: 's2Ping', param: 's2ping', min: 0, max: 1, step: 0.05 },
  { key: 's2Dot', param: 's2dot', min: 0, max: 16, step: 0.5 },
  /* 10-10 (w9c, the black opening): a struck bead's level on the BLACK
     opening (uPower, absolute; 0 = ?s2dark rules on any field — live at the
     S2 rest) and the CTA's ramp (the gradient's black stop, a fraction of
     the viewport from the bottom — live at the CTA rest; S5 keeps 0.4). */
  { key: 's2Lit', param: 's2lit', min: 0, max: 1, step: 0.05 },
  { key: 'ctaRamp', param: 'ctaramp', min: 0.05, max: 1, step: 0.05 },
  // 10-09 (w9b): the S3→S2 reconnect's trace, s (0 = ?threadsecs) — next reconnect
  { key: 'reconnectSecs', param: 'reconnectsecs', min: 0, max: 10, step: 0.1 },
  { key: 's4Push', param: 's4push', min: 0, max: 3, step: 0.05 },
  { key: 's4PushSecs', param: 's4pushsecs', min: 0.3, max: 3, step: 0.05 },
  { key: 'heartbeat', param: 'heartbeat', min: 0, max: 1, step: 0.02 },
  { key: 'reach', param: 'reach', min: 0, max: 1, step: 0.05 },
  { key: 'threadHops', param: 'threadhops', min: 3, max: 84, step: 1 },
  /* 10-07 (w4): the trace is a TOTAL now (?threadms per hop retired) and a
     cadence: q = 1 the even metronome, < 1 the riser (A/B 84 beads at 0.6);
     ?threadwords = S1 words the Thread picks back up (0 = off). */
  { key: 'threadSeconds', param: 'threadsecs', min: 1, max: 10, step: 0.1 },
  { key: 'threadAccel', param: 'threadaccel', min: 0.3, max: 2, step: 0.05 },
  { key: 'threadWords', param: 'threadwords', min: 0, max: 8, step: 1 },
  { key: 'threadTight', param: 'threadtight', min: 0.3, max: 1, step: 0.01 },
  { key: 'threadDrift', param: 'threaddrift', min: 0, max: 1, step: 0.05 },
  { key: 'assembleSeconds', param: 'assemble', min: 0.5, max: 5, step: 0.1 },
  { key: 'showRush', param: 'showrush', min: 1, max: 10, step: 0.5 },
  { key: 'emanateScale', param: 'emanate', min: 1, max: 2.2, step: 0.05 },
  { key: 'bpm', param: 'bpm', min: 60, max: 180, step: 1 },
  { key: 'pulseMin', param: 'pulsemin', min: 0, max: 1, step: 0.01 },
  { key: 'holdBeats', param: 'hold', min: 0, max: 4, step: 0.05 },
  { key: 'decayBeats', param: 'decay', min: 0.1, max: 4, step: 0.05 },
  { key: 's5Zoom', param: 's5zoom', min: 1, max: 1.3, step: 0.01 },
  { key: 's5TiltDeg', param: 's5tilt', min: 0, max: 60, step: 1 },
  { key: 's5Stroke', param: 's5stroke', min: 0, max: 1, step: 0.05 },
  // 10-07 (w6, s5-drop): beats of S5's count-in before the unison drop (next
  // S4→S5 step; 0 = no intro — the groove starts on the landing).
  { key: 'countIn', param: 'countin', min: 0, max: 4, step: 1 },
  // 10-07 (w7, cta-finale): the CTA globe's share of the free rect, the
  // pull-back/turn length, and the freed shard's lift (next S5→CTA step).
  { key: 'ctaFill', param: 'ctafill', min: 0.3, max: 1.2, step: 0.01 },
  { key: 'ctaSeconds', param: 'ctasecs', min: 0.3, max: 3, step: 0.05 },
  { key: 'liftK', param: 'liftk', min: 0, max: 1, step: 0.05 },
  { key: 'mobileDrop', param: 'dropy', min: 0, max: 0.5, step: 0.02 },
  // 10-07 (w4): phone — px the Core keeps clear above the copy card (live reframe).
  { key: 'cardGap', param: 'cardgap', min: 0, max: 80, step: 4 },
  { key: 'swipePx', param: 'swipepx', min: 150, max: 1200, step: 25 },
  { key: 'swipeSeconds', param: 'swipems', min: 0.4, max: 2.5, step: 0.05, ms: true },
  /* — DISCOVERY round (09-09). ?fog / ?fogspan / the spin tiers / the tour
     geometry / ?labelsize apply live (the tour restarts from the wide);
     ?labels needs a reload — the chip slots are built at mount, the
     HeroLabels convention. — */
  { key: 'fog', param: 'fog', min: 0, max: 1, step: 0.02 },
  { key: 'fogSpan', param: 'fogspan', min: 0.3, max: 3, step: 0.05 },
  // 10-07 (w3): the haze window's ride on the push-in (0 = world-still).
  { key: 'fogRide', param: 'fogride', min: 0, max: 1, step: 0.05 },
  { key: 'tourTravel', param: 'tourtravel', min: 0.5, max: 8, step: 0.1 },
  { key: 'tourHold', param: 'tourhold', min: 0, max: 8, step: 0.1 },
  // 10-07 (w3): a glance leg's length × (1 = the old even tour); next leg.
  { key: 'tourGlance', param: 'tourglance', min: 0.3, max: 1, step: 0.05 },
  { key: 'tourNear', param: 'tournear', min: 0.2, max: 1, step: 0.02 },
  { key: 'tourFar', param: 'tourfar', min: 0.2, max: 1, step: 0.02 },
  { key: 'tourShift', param: 'tourshift', min: 0, max: 3, step: 0.1 },
  { key: 'tourReach', param: 'tourreach', min: 0, max: 1.4, step: 0.02 },
  { key: 'spinFast', param: 'spinfast', min: 1, max: 12, step: 0.2 },
  { key: 'spinFastFrac', param: 'spinfastfrac', min: 0, max: 1, step: 0.05 },
  { key: 'labelCharMs', param: 'labelchar', min: 4, max: 120, step: 2 },
  { key: 'labelHold', param: 'labelhold', min: 0.4, max: 8, step: 0.1 },
  { key: 'labelPulse', param: 'labelpulse', min: 0, max: 1, step: 0.02 },
  { key: 'labelLead', param: 'labellead', min: 12, max: 200, step: 2 },
  { key: 'labelCount', param: 'labels', min: 1, max: 16, step: 1 },
  // 10-09 (w9b, more-chips): the phone's chip count (≤768px), ?labels' twin — reload
  { key: 'labelCountMobile', param: 'labelsm', min: 1, max: 12, step: 1 },
  { key: 'labelSize', param: 'labelsize', min: 0, max: 32, step: 0.5 },
  /* — The BREAK (10-07): the globe-O shattering into the belt. Applies to
     the next break — ↻ replay on 01 (or scroll back to the top). w2:
     ?shatterkick is now the BOW at the chord's midpoint (O radii, clamped to
     0.45 × the screen chord; 0 = straight) — reads softer than the old
     throw at the same value; ?reform is the reform's own length (↻ on O). — */
  { key: 'shatterSeconds', param: 'shatter', min: 0.8, max: 5, step: 0.1 },
  { key: 'shatterKick', param: 'shatterkick', min: 0, max: 4, step: 0.05 },
  { key: 'reformSeconds', param: 'reform', min: 0.6, max: 2, step: 0.05 },
  { key: 'shatterSpin', param: 'shatterspin', min: 0, max: 4, step: 0.1 },
  { key: 'shatterCharge', param: 'shattercharge', min: 0, max: 1.2, step: 0.05 },
  { key: 'shatterDepth', param: 'shatterdepth', min: 1, max: 3.5, step: 0.05 },
  { key: 'oWind', param: 'owind', min: 0, max: 450, step: 10 },
];

const VARIANTS = ['rows', 'poles', 'sweep'];
const SELECTS = [
  { key: 'cascadeVariant', param: 'cascade', options: VARIANTS },
  { key: 'emanateOrder', param: 'emanateorder', options: VARIANTS },
  { key: 'pattern', param: 'pattern', options: RHYTHM_PATTERNS },
  { key: 'decayCurve', param: 'decaycurve', options: ['expo', 'linear'] },
  { key: 'swipe', param: 'swipe', options: ['on', 'off'] },
  { key: 'tour', param: 'tour', options: ['on', 'off'] },
  { key: 'chipCover', param: 'chipcover', options: ['off', 'bind', 'hold'] }, // 10-08 (w8b): the S1 tour chips' cover rule — pre-w8 / the bind-time exact cover (w8) / + the predicted hold
  { key: 'chipKey', param: 'chipkey', options: ['off', 'on', 'auto'] }, // 10-07 (w3): filled-chip keyline A/B; 10-08 (w8): auto = only a fill that sinks into the live field
  { key: 'coreSeam', param: 'coreseam', options: ['black', 'white'] }, // 10-07 (w4): S3–S5 seam colour A/B
  { key: 'ignite', param: 'ignite', options: ['auto', 'dark'] }, // 10-10 (w9c fix): S2→S3's ignition — auto = into the light on the blue solid (the cascade draws the ink in; PROPOSED), dark = the blackout + flicker on every field; applies on the next S2→S3
  { key: 'threadHead', param: 'threadhead', options: ['centre', 'word'] }, // 10-07 (w5): the Thread starts on the last S1 subject's word (default) or at the belt centre (pre-w5)
  { key: 'shatterShock', param: 'oshock', options: ['on', 'off'] },
  { key: 'tapCue', param: 'tapcue', options: ['on', 'off'] }, // 10-07 (w6): S5's click-to-cue (mouse/pen; 10-08 (w8): a finger tap too; off = drag only)
  { key: 's5Chip', param: 's5chip', options: ['on', 'off'] }, // 10-08 (w8): S5's page chips — the chapter's word on the world at each page turn
  { key: 'threadInk', param: 'threadink', options: ['auto', 'stroke', 'white'] }, // 10-08 (w8): the Thread's colour — the edge ink (as built) or the leader white (Nathan's A/B); 10-10 (w9c): auto = the field table's ink for S2's field (white on black)
  { key: 'opening', param: 'opening', options: ['black', 'blue'] }, // 10-10 (w9c): the opening field (hero/S1/S2) — black (Nathan's, baked) or blue (pre-w9c order: blue opening, black S3/S4); live, the field re-lays at the rest
  { key: 'ctaInk', param: 'ctaink', options: ['auto', '0', '0.25', '0.5', '0.75', '1'] }, // 10-10 (w9c): the CTA world's black edge ink — auto = field-aware (fix2: 1 only where it outreads the lit world on the field under the world's lower silhouette — desktop inks, the phone doesn't; 0 at ?ctaramp ≤ 0.4); a number pins it (0 = w9b's ink-less resolve); live at the CTA rest
  { key: 'heroV', param: 'herov', options: ['bottom', 'centre'] }, // 10-08 (w8): PHONE — the hero card bottom-anchored (09-08 rule) or centred (Nathan's A/B)
  { key: 'nextTease', param: 'nexttease', options: ['off', 'on'] }, // 10-08 (w8): PHONE — a `next: <phase>` line under each stage card; reload only (Nathan's A/B)
  { key: 's3Head', param: 's3head', options: ['assembly', 'ignition'] }, // 10-09 (w9b): S3's headline lands as the assembly starts (PROPOSED) or with the ignition (w9)
  { key: 'ctaLoop', param: 'ctaloop', options: ['breathe', 'hold'] }, // 10-07 (w7): the CTA world after the resolve — breathes or holds lit (Nathan's A/B)
  { key: 'finale', param: 'finale', options: ['on', 'off'] }, // 10-07 (w7): THE TURN — the freed shard + first_contact chip at the CTA
];

const knobLabel = (def) => `?${def.param}`;
const knobValue = (def) => {
  const v = TUNING[def.key];
  return def.ms ? `${Math.round(v * 1000)}` : `${Math.round(v * 1000) / 1000}`;
};

/* Only non-default knobs serialize — the dialed-in feel as a URL. */
const buildTunedUrl = () => {
  const q = [];
  [...SLIDERS, ...SELECTS].forEach((def) => {
    const v = TUNING[def.key];
    const d = TUNING_DEFAULTS[def.key];
    const differs = typeof v === 'number' ? Math.abs(v - d) > 1e-9 : v !== d;
    if (differs) q.push(`${def.param}=${def.ms ? Math.round(v * 1000) : v}`);
  });
  return `${window.location.pathname}?debug${q.length ? `&${q.join('&')}` : ''}`;
};

export default function ProcessDebugPanel({ sceneRef }) {
  const [stats, setStats] = useState({ fps: 0, calls: 0, stage: null });
  const [, bump] = useState(0); // TUNING is the source of truth
  const [copied, setCopied] = useState(false);
  // Phones start collapsed — the full panel devours a small viewport
  const [open, setOpen] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches)
  );

  useEffect(() => {
    const id = setInterval(() => {
      const next = sceneRef.current.getStats();
      window.__swmProcessStats = next; // headless probe readout (scripts/process-probe.mjs)
      setStats(next);
    }, 500);
    // 10-07 (w2): the break track — every frame of the last few flights, too
    // big for the 500ms publish, so a getter (process-probe --walk --break).
    window.__swmProcessTrack = () => sceneRef.current.getFlightTrack?.() ?? null;
    // 10-07 (w3): the chips as last painted — the probe's keep-out check
    // reads them fresh rather than from the 500ms publish.
    window.__swmProcessChips = () => sceneRef.current.getChipBoxes?.() ?? null;
    // 10-07 (w5): the stats NOW, between publishes (a 40ms heartbeat or reach
    // sample) — a peek, so the publish's fps window is left alone.
    window.__swmProcessPeek = () => sceneRef.current.getStats?.({ peek: true }) ?? null;
    // 10-09 (w9b): the scene's api itself — the S2 harness drives setStageInstant / replay mid-show
    window.__swmProcessApi = () => sceneRef.current;
    return () => {
      clearInterval(id);
      delete window.__swmProcessTrack;
      delete window.__swmProcessChips;
      delete window.__swmProcessPeek;
      delete window.__swmProcessApi;
    };
  }, [sceneRef]);

  if (!open) {
    return (
      <aside className="process-debug process-debug--chip">
        <button type="button" onClick={() => setOpen(true)}>
          {`⌁ tune · ${stats.stage ?? '∅'} · ${stats.fps}fps`}
        </button>
      </aside>
    );
  }

  const tune = (key, value) => {
    TUNING[key] = value;
    sceneRef.current.applyTuning();
    bump((n) => n + 1);
  };

  const copyUrl = () => {
    const url = `${window.location.origin}${buildTunedUrl()}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <aside className="process-debug">
      <div className="process-debug__head">
        <p className="process-debug__stats">
          {`fps ${stats.fps} · draws ${stats.calls} · ${stats.stage ?? '∅'} · chips ${stats.chips?.length ?? 0}${
            stats.tour && typeof stats.tour === 'object'
              ? ` · subject ${stats.tour.u},${stats.tour.v} → seat ${stats.tour.seatU},${stats.tour.seatV}${stats.tour.labelled ? ' ✓' : ''}`
              : stats.tour ? ` · tour ${stats.tour}` : ''
          }`}
        </p>
        <button
          type="button"
          className="process-debug__close"
          aria-label="collapse tuning panel"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="process-debug__stages">
        {STAGES.map((id, i) => (
          <button
            key={id}
            type="button"
            data-active={stats.stage === id || undefined}
            // 10-07: a bench jump CUTS — it never rides the S1→S2 show's
            // fast-forward (?showrush), it kills it like any jump.
            onClick={() => sceneRef.current.goTo(id, { cut: true })}
          >
            {id === 'hero' ? 'O' : id === 'cta' ? 'CTA' : `0${i}`}
          </button>
        ))}
        <button
          type="button"
          className="process-debug__replay"
          title="replay the current stage's transition with the live knobs"
          onClick={() => sceneRef.current.replay()}
        >
          ↻ replay
        </button>
      </div>

      <div className="process-debug__knobs">
        {SLIDERS.map((def) => (
          <label key={def.key} className="process-debug__knob">
            <span className="process-debug__knob-name">{knobLabel(def)}</span>
            <input
              type="range"
              min={def.min}
              max={def.max}
              step={def.step}
              value={TUNING[def.key]}
              onChange={(e) => tune(def.key, parseFloat(e.target.value))}
            />
            <span className="process-debug__knob-value">{knobValue(def)}</span>
          </label>
        ))}
        {SELECTS.map((def) => (
          <label key={def.key} className="process-debug__knob">
            <span className="process-debug__knob-name">{knobLabel(def)}</span>
            <select
              value={TUNING[def.key]}
              onChange={(e) => tune(def.key, e.target.value)}
            >
              {def.options.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="process-debug__url">
        <button type="button" onClick={copyUrl}>
          {copied ? 'copied ✓' : 'copy_url'}
        </button>
        <code>{buildTunedUrl()}</code>
      </div>
    </aside>
  );
}
