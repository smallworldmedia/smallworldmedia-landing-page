/**
 * plateauGate — does a sampled resource count PLATEAU, or climb? (SQ-129, scripts/memory-probe.mjs)
 *
 * A probe samples counts (WebGL contexts, live GL textures, canvases, <video>s, MediaSources, …)
 * once per world change or every few scheme flips. A count that churns with the content but
 * stays bounded is healthy; one that steps up per world or per flip is the leak iOS kills the
 * tab for. The judgement, per key, over the samples after `warm`:
 *
 *   climb = max(second half) − max(first half) > abs + rel × max(first half)
 *
 * A bounded series reaches its ceiling in the first half and the second half only revisits it;
 * a series that adds k per sample sets a new maximum every sample, so the second half's
 * maximum sits about n/2 × k above the first half's. Fewer than `min` usable samples is
 * VACUOUS, which fails: a run that measured nothing passes nothing.
 *
 * Pure: no I/O. Unit-tested in scripts/test/plateau-gate.test.mjs, negative control included.
 */

/** @param {Array<Record<string, number|null|undefined>>} samples - one counts object per sample, in order
 *  @param {{ keys?: string[], warm?: number, min?: number, rel?: number, abs?: Record<string, number>, absDefault?: number }} [opts] */
export function plateauGate(samples, opts = {}) {
  const { warm = 1, min = 4, rel = 0.1, abs = {}, absDefault = 1 } = opts;
  const rows = samples.slice(warm);
  const keys = opts.keys ?? [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const results = {};
  for (const key of keys) {
    const series = rows.map((r) => r[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
    if (series.length < min) {
      results[key] = { pass: false, vacuous: true, n: series.length };
      continue;
    }
    const half = Math.floor(series.length / 2);
    const firstMax = Math.max(...series.slice(0, half));
    const secondMax = Math.max(...series.slice(half));
    const allow = (abs[key] ?? absDefault) + rel * Math.abs(firstMax);
    const rise = secondMax - firstMax;
    results[key] = {
      pass: rise <= allow,
      n: series.length,
      first: series[0],
      last: series[series.length - 1],
      firstMax,
      secondMax,
      rise: Math.round(rise * 100) / 100,
      allow: Math.round(allow * 100) / 100,
    };
  }
  const failed = Object.keys(results).filter((k) => !results[k].pass);
  return { pass: failed.length === 0 && keys.length > 0, failed, results };
}

/**
 * stepGate — how far one reading STEPS above its first sample in the opening stretch of a run
 * (SQ-133). The plateau gate cannot see a one-time step: a count that jumps on the first eye
 * previews and then holds or drifts back is flat after the jump. iOS kills a tab on its peak, so
 * the peak over the opening matters on its own:
 *
 *   step = max(samples[1..until]) − samples[0]     pass when step <= max
 *
 * `until` is the label of the last sample counted (inclusive; the whole run when absent or not
 * found). A missing first reading or no reading after it is VACUOUS, which fails.
 *
 * @param {Array<Record<string, any>>} samples - in order, the first is the baseline
 * @param {{ key?: string, max: number, until?: string }} opts */
export function stepGate(samples, { key = 'footMiB', max, until } = {}) {
  const at = until ? samples.findIndex((s) => s.label === until) : -1;
  const window = samples.slice(1, at > 0 ? at + 1 : samples.length);
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const base = samples[0]?.[key];
  const after = window.map((s) => s[key]).filter(num);
  if (!num(base) || after.length === 0 || !num(max)) return { pass: false, vacuous: true, key, n: after.length };
  const peak = Math.max(...after);
  const step = Math.round((peak - base) * 10) / 10;
  const peakAt = window.find((s) => s[key] === peak)?.label ?? null;
  return { pass: step <= max, key, base, peak, peakAt, step, max, n: after.length };
}

/**
 * pickGate — what one COMMITTED scheme change costs (SQ-139, memory-probe --picks). Each pick carries the
 * sample taken just before its gesture (`pre`) and the one after its settle (`post`); its step is
 * post − pre. Every pick must land on its target (a pick that missed measured a different gesture) and
 * no step may exceed `max` MiB. No picks, or a pick without both readings, is VACUOUS, which fails.
 *
 * @param {Array<{ target?: string, landed?: boolean, pre: Record<string, any>, post: Record<string, any> }>} picks
 * @param {{ key?: string, max: number }} opts */
export function pickGate(picks, { key = 'footMiB', max } = {}) {
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const steps = (picks || []).map((p) => (num(p?.pre?.[key]) && num(p?.post?.[key]) ? Math.round((p.post[key] - p.pre[key]) * 10) / 10 : null));
  if (!steps.length || steps.some((s) => s === null) || !num(max)) return { pass: false, vacuous: true, key, n: steps.length };
  const missed = picks.filter((p) => p.landed === false).length;
  const worst = Math.max(...steps);
  return { pass: missed === 0 && worst <= max, key, steps, worst, worstAt: steps.indexOf(worst) + 1, missed, max, n: steps.length };
}

/**
 * roundGate — does the RESTING footprint plateau over hold-and-cycle rounds (SQ-136, memory-probe
 * --run=rounds)? plateauGate over each round's rest sample, the first round as warm-up (it carries the
 * eye's one-time opening step, which stepGate bounds), with an absolute tolerance only: a climb of k MiB
 * a round shows as about k x rounds/2 between the halves' maxima, so `footAbs` 24 fails more than 8 MiB a
 * round over 6 rounds and more than 4 over 12. GL bytes churn with the globe's worlds; the run-wide
 * plateauGate reads them. Nodes are held to 20.
 *
 * @param {Array<{ rest: Record<string, number|null> }>} rounds
 * @param {{ footAbs?: number }} [opts] */
export function roundGate(rounds, { footAbs = 24 } = {}) {
  return plateauGate(
    rounds.map((r) => r.rest),
    { keys: ['footMiB', 'nodes'], warm: 1, rel: 0, abs: { footMiB: footAbs, nodes: 20 } }
  );
}
