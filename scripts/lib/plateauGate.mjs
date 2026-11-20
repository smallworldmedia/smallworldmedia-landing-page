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
