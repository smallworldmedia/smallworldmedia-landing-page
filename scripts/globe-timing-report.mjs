#!/usr/bin/env node
/**
 * globe-timing-report — reads globe-timing.mjs runs. Folded from the 10-27 handoff instruments
 * (~/swm-globe-handoff-2026-10/: sum2.mjs is the summary, clips.mjs, rungs.mjs and waste.mjs the three sections).
 *
 * Usage:
 *   node scripts/globe-timing-report.mjs run.json [more.json …] [--clips] [--rungs] [--waste] [--all]
 *
 * The summary, per run: the first load; per world, when its videos play against its exact landing
 * (stats.landedAt), with the median wait after landing; attach → first frame; the players' requests (wire or
 * cache) and the prefetch's (used or not); the scheduler's start counters; bytes; the plan-ahead ledger and the
 * distinct textures each world needed (pool / board / front / on screen); and the live count, time-weighted from
 * the first stream to the run's end. Each run is labelled by the handoff mode it reports (final.handoff.mode),
 * not by its URL, because a URL with no `pophandoff` has meant `fast` since 10-28.
 *   --clips  per start: primed (no player master request), a rung miss, prefetched but not yet, or not
 *            prefetched; and each prefetched clip that never started.
 *   --rungs  the forecast rung against the played rung, per prefetched clip (the run's last world excluded).
 *   --waste  the prefetch's bytes by forecast rung and outcome, each segment linked to its clip by timing
 *            (master response → rendition request → rendition response → init + segment requests).
 */
import fs from 'node:fs';

const FLAGS = new Set(process.argv.slice(2).filter((a) => a.startsWith('--')));
const FILES = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const want = (k) => FLAGS.has(`--${k}`) || FLAGS.has('--all');
if (!FILES.length) {
  console.error('usage: node scripts/globe-timing-report.mjs run.json [more.json …] [--clips] [--rungs] [--waste] [--all]');
  process.exit(2);
}

const sorted = (a) => [...a].sort((x, y) => x - y);
const q = (a, p) => (a.length ? sorted(a)[Math.min(a.length - 1, Math.floor(a.length * p))] : null);
const mb = (n) => (n / 1e6).toFixed(1);
const s = (v) => (v == null ? '—' : String(v));
const idOf = (u) => new URL(u).pathname.slice(1).replace(/\.m3u8$/, '');
const pin = (u) => new URL(u).searchParams.get('max_resolution') || 'none';

/** The changes in a run: each { at, step, world, landed }, from the director's own clock. */
function changesOf(d) {
  const changes = [];
  for (const p of d.log.filter((e) => e.ev === 'pop')) {
    if (p.changedAt == null) continue;
    let c = changes.find((x) => x.at === p.changedAt);
    if (!c) changes.push((c = { at: p.changedAt, step: p.step, world: p.world }));
    if (p.landedAt != null && p.landedAt >= c.at && c.landed == null) c.landed = p.landedAt;
  }
  return changes;
}

/** The live count, time-weighted from the first stream to the run's end: { streams, tiles } as { mean, max }. */
function liveOf(d) {
  const ev = d.log.filter((e) => e.ev === 'live');
  const i0 = ev.findIndex((e) => e.streams > 0);
  if (i0 < 0) return null;
  const end = d.secs * 1000;
  const acc = { streams: 0, tiles: 0, maxS: 0, maxT: 0 };
  for (let i = i0; i < ev.length; i++) {
    const dt = Math.max(0, (ev[i + 1]?.t ?? end) - ev[i].t);
    acc.streams += ev[i].streams * dt;
    acc.tiles += ev[i].liveTiles * dt;
    acc.maxS = Math.max(acc.maxS, ev[i].streams);
    acc.maxT = Math.max(acc.maxT, ev[i].liveTiles);
  }
  const span = end - ev[i0].t;
  return span > 0 ? { streams: { mean: acc.streams / span, max: acc.maxS }, tiles: { mean: acc.tiles / span, max: acc.maxT }, from: ev[i0].t } : null;
}

function summary(f, d) {
  const u = new URL(d.url);
  const mode = d.final?.handoff?.mode ?? u.searchParams.get('pophandoff') ?? '?';
  const end = d.secs * 1000;
  const pops = d.log.filter((e) => e.ev === 'pop');
  const changes = changesOf(d);
  const attaches = d.log.filter((e) => e.ev === 'attach');
  const presents = d.log.filter((e) => e.ev === 'present');
  console.log(`\n=== ${f} · ${d.mobile ? 'PHONE' : 'DESKTOP'}${d.throttle ? ` @ ${d.throttle}` : ''} · handoff ${mode} · seed ${d.final?.seed} · ${d.secs}s${d.commit ? ` · at ${d.commit}${d.dirty ? ' (dirty)' : ''}` : ''}`);
  const a0 = attaches[0]?.t;
  const p0 = presents[0]?.t;
  console.log(`first load: stats ${s(pops[0]?.t)} · first attach ${s(a0)} · first frame ${s(p0)} (attach → frame ${a0 != null && p0 != null ? p0 - a0 : '—'}) · playing by first change ${presents.filter((e) => e.t < (changes[0]?.at ?? end)).length}`);
  console.log('step world                     landed  hold  starts(mid)  playing  @land  +0.5s  +1s   first  median-wait (ms after landing)');
  const waits = [];
  changes.forEach((c, i) => {
    const to = changes[i + 1]?.at ?? end;
    const landed = c.landed ?? to;
    const st = attaches.filter((e) => e.t >= c.at && e.t < to);
    const pr = presents.filter((e) => e.t >= c.at && e.t < to);
    const by = (dt) => pr.filter((e) => e.t <= landed + dt).length;
    const w = pr.map((e) => Math.max(0, e.t - landed));
    // A world cut short by the run's end only counts its first frame.
    if (to < end) waits.push(...w);
    const first = pr.length ? pr[0].t - landed : null;
    console.log(
      `${String(c.step).padStart(4)} ${String(c.world).slice(0, 24).padEnd(25)} ${String(landed).padStart(6)} ${((to - landed) / 1000).toFixed(1).padStart(5)}s ${String(st.length).padStart(5)}(${String(st.filter((e) => e.t < landed).length).padStart(2)}) ${String(pr.length).padStart(8)} ${String(by(0)).padStart(6)} ${String(by(500)).padStart(6)} ${String(by(1000)).padStart(5)} ${s(first).padStart(7)} ${s(q(w, 0.5)).padStart(8)}${to >= end ? '  (cut by run end)' : ''}`
    );
  });
  console.log(`after landing, wait for each stream's frame (complete worlds): n ${waits.length} · median ${s(q(waits, 0.5))} · p90 ${s(q(waits, 0.9))} · max ${waits.length ? Math.max(...waits) : '—'} ms`);
  const lat = [];
  const open = new Map();
  for (const e of d.log) {
    if (e.ev === 'attach') open.set(e.slot, e);
    if (e.ev === 'present' && open.has(e.slot)) lat.push(e.t - open.get(e.slot).t);
  }
  console.log(`attach → first frame: n ${lat.length} · median ${s(q(lat, 0.5))} · p90 ${s(q(lat, 0.9))} · max ${lat.length ? Math.max(...lat) : '—'} ms · attached, never a frame ${attaches.length - lat.length}`);
  const live = liveOf(d);
  if (live) console.log(`live (time-weighted from the first stream, ${live.from} ms, to the run's end): streams mean ${live.streams.mean.toFixed(2)} (max ${live.streams.max}) · tiles mean ${live.tiles.mean.toFixed(2)} (max ${live.tiles.max})`);

  const mux = (r) => r.b.startsWith('mux-') && r.b !== 'mux-thumb';
  const player = d.net.filter((r) => mux(r) && r.type === 'XHR');
  const pre = d.net.filter((r) => mux(r) && r.type === 'Fetch');
  const line = (rs) => ['mux-master', 'mux-playlist', 'mux-segment'].map((b) => {
    const x = rs.filter((r) => r.b === b);
    const c = x.filter((r) => r.cache);
    return `${b.slice(4)} ${x.length}${c.length ? ` (${c.length} cache)` : ''}`;
  }).join(' · ');
  console.log(`players' requests: ${line(player)} · wire ${mb(player.reduce((n, r) => n + (r.cache ? 0 : r.body), 0))} MB, from cache ${mb(player.reduce((n, r) => n + (r.cache ? r.body : 0), 0))} MB`);
  if (pre.length) {
    const lastChange = changes.at(-1)?.at ?? end;
    const segs = pre.filter((r) => r.b === 'mux-segment');
    const asked = new Set(player.filter((r) => r.b === 'mux-segment').map((r) => r.url));
    const used = segs.filter((r) => asked.has(r.url));
    const unusedOld = segs.filter((r) => !asked.has(r.url) && r.t < lastChange);
    const unusedNew = segs.filter((r) => !asked.has(r.url) && r.t >= lastChange);
    const sum = (rs) => rs.reduce((n, r) => n + r.body, 0);
    console.log(`prefetch: ${line(pre)} · ${mb(sum(pre))} MB · segment files used by a player ${used.length} (${mb(sum(used))} MB) · never used ${unusedOld.length} (${mb(sum(unusedOld))} MB) · fetched in the last world, not due yet ${unusedNew.length} (${mb(sum(unusedNew))} MB) · failed ${pre.filter((r) => r.failed).length}`);
  }
  const h = d.final?.handoff;
  if (h?.starts) console.log(`scheduler: starts ${h.starts.starts} · mid-change ${h.starts.ahead} · onto primed playlists ${h.starts.primed} · playlists served from memory ${h.primed.served}`);
  const by = {};
  for (const r of d.net) {
    const k = r.b === 'sanity-image' || r.b === 'mux-thumb' ? 'stills' : 'video';
    by[k] = (by[k] || 0) + (r.cache ? 0 : r.body);
  }
  const tot = (by.stills || 0) + (by.video || 0);
  console.log(`wire: video ${mb(by.video || 0)} MB · stills ${mb(by.stills || 0)} MB · total ${mb(tot)} MB = ${((tot * 8) / 1e6 / d.secs).toFixed(1)} Mbps average`);
  // The plan ahead (10-27): the ledger at the run's end, and per change the texture keys its world needed — the stats
  // a change starts with carry the keys of the board planned for it during the hold before.
  const a = h?.ahead;
  if (a) {
    const why = Object.entries(a.why).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`plan ahead: planned ${a.planned} · landed as planned ${a.adopted} · planned late ${a.missed}${why ? ` (${why})` : ''}`);
    const rows = [];
    let planned = 0; // a change's keys are its own only if a plan ahead ran since the change before
    for (const c of changes) {
      const p = pops.find((e) => e.changedAt === c.at && e.handoff?.ahead);
      const ah = p?.handoff.ahead;
      if (ah?.keys && ah.planned > planned) rows.push({ step: c.step, world: c.world, k: ah.keys });
      if (ah) planned = ah.planned;
    }
    if (rows.length) {
      console.log('textures (distinct keys) per world: step world                     pool  board  front  on screen');
      for (const { step, world, k } of rows) console.log(`${String(step).padStart(41)} ${String(world).slice(0, 24).padEnd(25)} ${String(k.pool).padStart(4)} ${String(k.board).padStart(6)} ${String(k.front).padStart(6)} ${String(k.onScreen ?? '—').padStart(10)}`);
      const med = (f) => q(rows.map((r) => r.k[f]).filter((v) => v != null), 0.5);
      console.log(`${'median'.padStart(41)} ${''.padEnd(25)} ${String(med('pool')).padStart(4)} ${String(med('board')).padStart(6)} ${String(med('front')).padStart(6)} ${String(med('onScreen')).padStart(10)}`);
    }
  }
}

/** --clips: each start primed or not, and why not; each prefetch started by a player or not. */
function clips(f, d) {
  const masters = d.net.filter((r) => r.b === 'mux-master');
  const pre = masters.filter((r) => r.type === 'Fetch');
  const ply = masters.filter((r) => r.type === 'XHR');
  const changes = [...new Set(d.log.filter((e) => e.ev === 'pop').map((p) => p.changedAt).filter((x) => x != null))];
  const worldAt = (t) => changes.filter((c) => c <= t).length; // step
  const lastChange = changes.at(-1) ?? Infinity;
  const starts = d.log.filter((e) => e.ev === 'attach').map((a) => {
    const m = ply.find((r) => idOf(r.url) === a.id && r.t >= a.t - 300 && r.t <= a.t + 3000);
    const fetched = pre.filter((r) => idOf(r.url) === a.id && r.t <= a.t);
    const why = !m ? 'primed' : fetched.some((r) => pin(r.url) !== pin(m.url)) ? `rung miss (prefetched ${fetched.map((r) => pin(r.url)).join('/')}, played ${pin(m.url)})` : fetched.length ? 'prefetched, but not yet' : 'not prefetched';
    return { t: a.t, step: worldAt(a.t), id: a.id.slice(0, 8), why, pinPlayed: m ? pin(m.url) : null };
  });
  const tally = {};
  for (const x of starts) {
    const k = x.why.startsWith('rung miss') ? 'rung miss' : x.why;
    tally[k] = (tally[k] || 0) + 1;
  }
  console.log(`clips · ${f} starts ${starts.length}:`, tally);
  for (const x of starts.filter((y) => y.why !== 'primed')) console.log(`  step ${x.step} t ${x.t} ${x.id} ${x.why}`);
  const startedIds = new Set(starts.map((x) => x.id));
  const unused = pre.filter((r) => !startedIds.has(idOf(r.url).slice(0, 8)));
  console.log(`prefetched clips ${pre.length}: started ${pre.length - unused.length} · never started ${unused.filter((r) => r.t < lastChange).length} · in the last world ${unused.filter((r) => r.t >= lastChange).length}`);
  for (const r of unused) console.log(`  t ${r.t} step ${worldAt(r.t)} ${idOf(r.url).slice(0, 8)} @${pin(r.url)}${r.t >= lastChange ? ' (last world)' : ''}`);
}

/** --rungs: forecast rung vs played rung, per prefetched clip (the run's last world excluded). */
function rungs(f, d) {
  const pops = d.log.filter((e) => e.ev === 'pop');
  const last = Math.max(...pops.map((p) => p.changedAt ?? 0));
  const pre = d.net.filter((r) => r.b === 'mux-master' && r.type === 'Fetch' && r.t < last);
  const ply = d.net.filter((r) => r.b === 'mux-master' && r.type === 'XHR');
  const att = d.log.filter((e) => e.ev === 'attach');
  const m = {};
  for (const r of pre) {
    const id = idOf(r.url);
    const a = att.find((e) => e.id === id && e.t >= r.t);
    const x = a && ply.find((p) => idOf(p.url) === id && p.t >= a.t - 300 && p.t <= a.t + 3000);
    const played = !a ? 'never' : x ? pin(x.url) : pin(r.url);
    const k = `${pin(r.url)} → ${played}`;
    m[k] = (m[k] || 0) + 1;
  }
  console.log(`rungs · ${f}`, m);
}

/** --waste: the prefetch's bytes by forecast rung and outcome. */
function waste(f, d) {
  const pre = d.net.filter((r) => r.type === 'Fetch' && r.b.startsWith('mux-'));
  const masters = pre.filter((r) => r.b === 'mux-master');
  const rends = pre.filter((r) => r.b === 'mux-playlist');
  const segs = pre.filter((r) => r.b === 'mux-segment');
  const near = (a, b) => b != null && a >= b - 5 && a <= b + 40;
  const pick = (list, t, used) => list.find((x) => !used.has(x) && near(x.t, t));
  const usedR = new Set();
  const usedS = new Set();
  const asked = new Set(d.net.filter((r) => r.type === 'XHR' && r.b === 'mux-segment').map((r) => r.url));
  const pops = d.log.filter((e) => e.ev === 'pop');
  const last = Math.max(...pops.map((p) => p.changedAt ?? 0));
  const out = {};
  let unlinked = 0;
  for (const m of masters) {
    const r = pick(rends, m.end, usedR);
    if (!r) {
      unlinked += 1;
      continue;
    }
    usedR.add(r);
    const ss = [];
    for (let k = 0; k < 2; k++) {
      const x = pick(segs, r.end, usedS);
      if (x) {
        usedS.add(x);
        ss.push(x);
      }
    }
    const bytes = ss.reduce((n, x) => n + x.body, 0);
    const state = ss.length && ss.every((x) => asked.has(x.url)) ? 'used' : m.t >= last ? 'pending' : 'wasted';
    const k = `${pin(m.url)} ${state}`;
    out[k] ??= { clips: 0, mb: 0 };
    out[k].clips += 1;
    out[k].mb = Math.round((out[k].mb + bytes / 1e6) * 10) / 10;
  }
  console.log(`waste · ${f}`, `unlinked masters ${unlinked}, segments linked ${usedS.size}/${segs.length}`, out);
}

for (const f of FILES) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  summary(f, d);
  if (want('clips')) clips(f, d);
  if (want('rungs')) rungs(f, d);
  if (want('waste')) waste(f, d);
}
