#!/usr/bin/env node
/**
 * process-probe — headless Playwright harness for the /process walk and break
 * (born as the discovery slide's tour sampler; 10-07 it films the whole walk).
 *
 * Usage:
 *   node scripts/process-probe.mjs [--mobile] [--vw=1440 --vh=900] [--secs=30]
 *        [--every=700] [--extra="&labelhold=4"] [--out=DIR] [--base=http://localhost:4321]
 *   node scripts/process-probe.mjs --transition [--extra="&threadtight=0.85&threaddrift=0.2"]
 *
 * Loads /process?debug=1 (the bench publishes `window.__swmProcessStats`
 * every 500ms — see ProcessDebugPanel), samples it for --secs, and writes a
 * JSON report: live chip count per sample (min / mean), duplicate-term and
 * overlapping-box checks, and every tour HOLD (blend ≥ 0.98 on a subject)
 * with the subject's actual NDC vs its seat, plus any target seen wearing
 * two different words across the run (a shard keeps its word). A screenshot is taken at each
 * hold so a station can be judged by eye. Same headless doctrine as
 * pager-probe.mjs: SwiftShader by default.
 *
 * --transition (09-11): instead of sampling the tour, wait until the camera
 * is mid-tour (off the wide — 10-07 final review: the page opens on the hero
 * now, so it first waits for the splash's break to land on stage-01), press
 * the bench's `02` button (found by its label — the bench grew an `O` for
 * the hero, and position 2 became `01`, a no-op on S1) and log the
 * CAMERA PATH through the S1→S2 connect + assembly every 0.5s for 14s —
 * the ?threadtight / ?threaddrift shape (tight on the first bead → creep →
 * pull-back with the assembly) is a z-curve, so it is judged as one. Two
 * screenshots: mid-trace and mid-assembly.
 *
 * --walk (10-07): FILMSTRIPS of the whole walk, for judging choreography
 * rather than a single knob. Records the page as video from the splash
 * onward, steps forward through every Stage to the CTA (and, with --back,
 * all the way back up to the hero), then cuts one contact sheet per beat
 * with ffmpeg: frames at --sheetfps, each stamped with its time since the
 * beat's trigger. Writes OUT/walk/<beat>-NN.png, the raw video, and
 * walk.json (beat start times plus a 250ms stats timeline: stage, camera,
 * chip count, scrollY — 10-08 (w8): and draw calls, with walk.json `calls`:
 * the max per beat, per stage and overall). The bench is hidden from the frames; its stats
 * still publish. --angle=metal (default) renders on the real GPU, so the
 * frames are the true motion, not a SwiftShader approximation.
 *   node scripts/process-probe.mjs --walk [--back] [--hold=8] [--sheetfps=6] [--clips]
 * --clips (10-07) also cuts each beat as an H.264 clip (OUT/walk/<beat>.mp4)
 * beside its sheet, for judging the motion at speed.
 *
 * --walk --break (10-07): just the globe-O BREAK pair — the splash's cued
 * break (a 25fps `shatter` sheet anchored on the scene's impact clock), a
 * short S1 hold, the reform back up to the hero (`reform`, 12fps), then a
 * forward step from the hero: the break a reader SCROLLS into, flash-burned
 * (`rebreak`, 25fps). ~20s instead of the whole walk.
 *   node scripts/process-probe.mjs --walk --break [--mobile] [--raw]
 * w2 (10-07): it also pulls the scene's BREAK TRACK after each flight (the
 * bench's window.__swmProcessTrack: every rendered frame of a flight, each
 * shard's screen position with its live chord — burst: pinned seat → the
 * slot riding the yaw; reform: where it hung → the LIVE seat) and writes
 * OUT/break-track.json + a printed summary per flight (shatter, reform,
 * rebreak): per shard the screen chord and its PROGRESS along it (the
 * projection of pos − start on the chord ÷ its length) at +0.11 … +2.0s
 * after the flight began; REVERSALS (progress dips below −2px at any frame)
 * and OVERSHOOTS (passes the chord's end by >2px); the share of shards CLEAR
 * of the O's disc at +0.11s (centre distance > O radius + the shard's
 * half-size); median / p10 / p90 / mean progress per sample time. --raw also
 * writes the frames themselves (break-track-raw.json).
 *
 * w3 (10-07): the KEEP-OUT and FRAME checks, in both modes. Every chip on
 * screen (window.__swmProcessChips — the chips as last painted, read live,
 * not the 500ms publish; leaving chips included) is tested against the
 * page as it is PAINTED — every visible text node's line boxes
 * (Range.getClientRects), plus the chrome that is not text (nav pills,
 * lockup, tagline/privacy pills, the step CTAs, the progress bar) — a list
 * of its own, independent of the scene's keepBoxes selectors. `keepHits`
 * counts chips crossing BARE type/chrome, `keepNear` those inside its 12px
 * air; `edgeMin` is the nearest chip edge to the frame (px, negative =
 * clipped). Sampling mode also checks a shard keeps its FILL as well as its
 * word (`refilled`), and logs the tour's LEGS (glance / linger, run lengths,
 * measured leg lengths, any three of a kind). The walk timeline carries
 * keepHits / keepNear / edgeMin / leg per 250ms sample and walk.json a
 * `keepout` summary: `chipsAtHero` counts only LIVE chips at the hero (a
 * chip already on its cut when the stage flips is in `leavingAtHero`).
 *
 * --buried (10-08, w8): sampling mode only, opt-in (it screenshots). On each
 * sample, every LIVE chip that has stood ≥ 0.45s is measured on the real
 * pixels: the share of its box (inset 3/2px) within RGB distance 60 of its
 * own dealt fill. Under 0.2 is BURIED — a nearer shard covers the chip (the
 * bare-leader read). The bench is hidden from the frames. report.summary.
 * buried: `atBind` (episodes whose FIRST measured sample is buried — the
 * seat was covered when it bound), buried / partial (< 0.4) samples of all,
 * the median visible share, episodes (one term's consecutive samples, split
 * on a stage change or a gap), the buried episodes (≥ 3 buried samples), and
 * the tour subject's namings per 100s (episodes on the framed shard — the
 * cost a stricter cover test would show first). Up to 12 frames of buried
 * chips are kept (buried-NN-TERM.png). `--every=120` matches the scratch
 * instrument it came from (final fix2 buried.mjs); the default 700ms
 * cadence first measures a chip at ~0.7s.
 *   node scripts/process-probe.mjs --buried [--every=120] [--secs=150] [--mobile]
 * 10-08 (w8b): the chips' fill and id and the tour SUBJECT are read from the
 * LIVE window.__swmProcessPeek() at each measured sample (the 500ms
 * __swmProcessStats snapshot named a chip on the last station's subject as
 * this one's, and namings are a gate metric now). Added to report.summary.
 * buried: `driftEpisodes` (buried episodes whose FIRST sample was visible —
 * the station's drift carried a nearer shard over a chip that bound clear),
 * `subjectDriftLong` (those on the subject buried ≥ 1s straight),
 * `subjectReadablePer100s` (subject episodes of n ≥ 3 samples whose MEDIAN
 * visible share is ≥ 0.4 — a buried naming is not one the viewer can read),
 * `pickMs` (the S1 picks' cost, ms — n / sum / p50 / p95 / max, drained by
 * count from peek's ring; ?debug only), `strictOver` (strict seats the pick
 * returned whose exact cover was over CHIP_COVER_MAX), `chipCover` (the
 * ?chipcover arm the page ran) and, under ?chipcover=hold:
 * · `holdCheck` — the predicted hold against what happened, per +1s / +2s:
 *   the chip's centre (px) and cover predicted at the bind vs the live seat
 *   then (exactCover off the live world), for the bound chip and the last
 *   seat the look-ahead refused (`refused`): mean / p95 / max over all, and
 *   `covered` — the subset where either side saw any cover; `gone` (both
 *   sides say the chip has left: stranded, keep box, behind the lens),
 *   `goneMismatch` (only one does);
 * · `holdAudit` — `bad`: picks and checks whose world signature differed
 *   after the restore (n of them); `refMiss`: looks where the prefiltered,
 *   flagged-only raycast disagreed with exactCover on the WHOLE world posed
 *   (refLooks of them; `refMissAt` the last few); `aheads` / `looks` /
 *   `rayLooks`: the look-aheads, the looks they ran, the looks that reached
 *   a raycast; `subj`: what each hold pick did with the station's subject —
 *   `held`, `soft` (the never-buried fallback), `refused` (seats, none
 *   passed), `out` (the look budget ran out), `noSeat`, `closed` (not in
 *   the open pool: turned away, its word held elsewhere).
 * --cpu=4 throttles the page's CPU through CDP
 * (Emulation.setCPUThrottlingRate) — a slow-phone proxy for pickMs.
 * 10-08 (w8b fix): the tour HOLDS (both sampling modes) read the subject
 * from the live peek too, not the snapshot — w8b's pooled holdsLabelled
 * came off a read up to 0.5s stale. summary: `holdsLabelled` = the subject
 * named at the first live sample of its station (AT ITS ARRIVAL);
 * `holdsNamed` = named at any live sample of the station (until the next
 * leg's glide); `holdsNamedLate` (named after the arrival: t, id, after s)
 * and `holdsUnnamed` (t, id). The legs' kinds and timings repeat run to
 * run (tourRand is seeded) and the subjects come from a small pool of slow,
 * front-facing shards, so the arms meet many of the same stations.
 */
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const MOBILE = !!arg('mobile', false);
const VW = Number(arg('vw', MOBILE ? 390 : 1440));
const VH = Number(arg('vh', MOBILE ? 844 : 900));
const SECS = Number(arg('secs', 30));
const EVERY = Number(arg('every', 700));
const EXTRA = arg('extra', '');
const BASE = arg('base', 'http://localhost:4321');
const OUT = arg('out', path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots', `process-${MOBILE ? 'm' : 'd'}`));
const GPU = arg('gpu', 'swiftshader');
const TRANSITION = !!arg('transition', false);
const WALK = !!arg('walk', false);
const BURIED = !WALK && !TRANSITION && !!arg('buried', false); // 10-08 (w8)
const URL_ = `${BASE}/process?debug=1${EXTRA}`;

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* w3 (10-07): page side — chips (stats.vis: box centre + size, canvas px)
   against what the page PAINTS: visible text line boxes + the non-text
   chrome. Returns per-sample hits and the nearest frame edge. */
const keepCheck = () => {
  const st = window.__swmProcessStats;
  if (!st) return null;
  const cv = document.querySelector('.process-page__canvas');
  const base = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const vw = base.width;
  const vh = base.height;
  // the chips as last painted (live), else the 500ms publish
  const chips = window.__swmProcessChips?.() ?? st.vis ?? [];
  // live = chips not on their way out (a leaving chip may outlive a stage
  // flip by its exit; 'chips at the hero' counts only the live ones)
  const out = { n: chips.length, live: chips.filter((c) => !c.fading).length, hits: [], near: 0, edgeMin: null, clipped: [] };
  if (!chips.length) return out;
  const rects = [];
  const seen = (el) => !el.checkVisibility || el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  // What an ancestor's overflow CLIPS is not painted (checkVisibility does
  // not know): the phone's closed info drawer leaves its scrolled client
  // list inside the viewport rect. Each box is cut to every clipping
  // ancestor's border box.
  const clips = new Map();
  const clipOf = (el) => {
    if (clips.has(el)) return clips.get(el);
    let c = null;
    const par = el.parentElement;
    const up = par && par !== document.body ? clipOf(par) : null;
    const cs = getComputedStyle(el);
    if (/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
      const r = el.getBoundingClientRect();
      c = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    }
    if (up) c = c ? { l: Math.max(c.l, up.l), t: Math.max(c.t, up.t), r: Math.min(c.r, up.r), b: Math.min(c.b, up.b) } : up;
    clips.set(el, c);
    return c;
  };
  const push = (r0, what, el) => {
    const c = el ? clipOf(el) : null;
    const r = c
      ? { left: Math.max(r0.left, c.l), top: Math.max(r0.top, c.t), right: Math.min(r0.right, c.r), bottom: Math.min(r0.bottom, c.b) }
      : { left: r0.left, top: r0.top, right: r0.right, bottom: r0.bottom };
    if (r.right - r.left < 1 || r.bottom - r.top < 1) return;
    const x0 = r.left - base.left;
    const y0 = r.top - base.top;
    const x1 = r.right - base.left;
    const y1 = r.bottom - base.top;
    if (x1 < 0 || y1 < 0 || x0 > vw || y0 > vh) return;
    rects.push({ x0, y0, x1, y1, what });
  };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeValue.trim() && !n.parentElement?.closest('.process-debug, script, style, noscript, template')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });
  const range = document.createRange();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || !seen(el)) continue;
    range.selectNodeContents(n);
    const tag = `${String(el.className?.baseVal ?? el.className ?? '').split(' ')[0] || el.tagName}:${n.nodeValue.trim().slice(0, 16)}`;
    for (const r of range.getClientRects()) push(r, tag, el);
  }
  document
    .querySelectorAll('.site-nav__pill, .site-nav__lockup, .site-tagline__pill, .site-privacy, .process-stepnav__cta, .detail-progress')
    .forEach((el) => {
      if (seen(el)) push(el.getBoundingClientRect(), String(el.className).split(' ')[0], el.parentElement);
    });
  const PAD = 12;
  for (const c of chips) {
    const cx0 = c.x - c.w / 2;
    const cy0 = c.y - c.h / 2;
    const cx1 = c.x + c.w / 2;
    const cy1 = c.y + c.h / 2;
    const edge = Math.min(cx0, cy0, vw - cx1, vh - cy1);
    out.edgeMin = out.edgeMin == null ? edge : Math.min(out.edgeMin, edge);
    if (edge < 0) out.clipped.push({ term: c.term, edge: Math.round(edge) });
    let near = false;
    for (const r of rects) {
      if (cx1 > r.x0 && cx0 < r.x1 && cy1 > r.y0 && cy0 < r.y1) {
        out.hits.push({ term: c.term, fading: c.fading, with: r.what, box: [c.x, c.y, c.w, c.h], rect: [r.x0, r.y0, r.x1, r.y1].map(Math.round) });
      } else if (cx1 > r.x0 - PAD && cx0 < r.x1 + PAD && cy1 > r.y0 - PAD && cy0 < r.y1 + PAD) near = true;
    }
    if (near) out.near += 1;
  }
  out.edgeMin = out.edgeMin == null ? null : Math.round(out.edgeMin);
  return out;
};

const ANGLE = arg('angle', WALK ? 'metal' : GPU === 'swiftshader' ? 'swiftshader' : '');
const browser = await chromium.launch({
  headless: true,
  args:
    ANGLE === 'swiftshader'
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
      : ANGLE
        ? [`--use-angle=${ANGLE}`, '--ignore-gpu-blocklist']
        : [],
});
const WALK_DIR = path.join(OUT, 'walk');
if (WALK) fs.mkdirSync(WALK_DIR, { recursive: true });
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: MOBILE ? 2 : 1,
  hasTouch: MOBILE,
  isMobile: MOBILE,
  ...(WALK ? { recordVideo: { dir: WALK_DIR, size: { width: VW, height: VH } } } : {}),
});
if (WALK || BURIED) {
  // The bench publishes the stats but must not sit in the frames.
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const s = document.createElement('style');
      s.textContent = '.process-debug{display:none!important}';
      document.head.appendChild(s);
    });
  });
}
const page = await ctx.newPage();
// 10-08 (w8b): --cpu=N — CDP CPU throttle (a slow-phone proxy for --buried's pickMs)
const CPU = Number(arg('cpu', 0));
if (CPU > 1) await (await ctx.newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate: CPU });
const tPage = Date.now(); // the video's clock starts with the page
const report = { url: URL_, viewport: [VW, VH], samples: [], holds: [], consoleErrors: [], pageErrors: [] };
page.on('console', (m) => {
  if (m.type() === 'error') report.consoleErrors.push(m.text().slice(0, 300));
});
page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 300)));

/* w2 (10-07): the break track's numbers, per flight. A shard's progress at
   a frame is measured on its LIVE chord (start → end as they stand on that
   frame), so the belt's yaw and the gliding seat are not read as motion. */
const TRACK_AT = [0.11, 0.2, 0.36, 0.5, 0.82, 1.2, 1.54, 2.0];
const quant = (xs, q) => {
  const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (i - lo);
};
const pct = (x) => (x == null ? null : +(x * 100).toFixed(1));
const trackFlight = (rec, name) => {
  const { frames: n, shards, per, stride, data } = rec;
  const T = Array.from({ length: n }, (_, f) => data[f * stride] / 1000);
  const sh = (f, i, k) => data[f * stride + 4 + i * per + k];
  const near = (t) => T.reduce((best, x, f) => (Math.abs(x - t) < Math.abs(T[best] - t) ? f : best), 0);
  const f011 = near(0.11);
  const rows = [];
  for (let i = 0; i < shards; i++) {
    const prog = new Array(n).fill(NaN);
    let chord = NaN;
    let minPx = Infinity;
    let overPx = -Infinity;
    for (let f = 0; f < n; f++) {
      const [x, y, sx, sy, ex, ey] = [0, 1, 2, 3, 4, 5].map((k) => sh(f, i, k));
      const cx = ex - sx;
      const cy = ey - sy;
      const L = Math.hypot(cx, cy);
      if (!(L > 0.5) || !Number.isFinite(x)) continue;
      if (!Number.isFinite(chord)) chord = L;
      const along = ((x - sx) * cx + (y - sy) * cy) / L;
      prog[f] = along / L;
      minPx = Math.min(minPx, along);
      overPx = Math.max(overPx, along - L);
    }
    // progress at the sample times, linear between the frames around each
    // (a time past the last frame reads the last: the flight is over)
    const at = TRACK_AT.map((t) => {
      let f = T.findIndex((x) => x >= t);
      if (f < 0) f = n - 1;
      if (f === 0 || T[f] <= t) return prog[f];
      const w = (t - T[f - 1]) / Math.max(T[f] - T[f - 1], 1e-6);
      return prog[f - 1] + (prog[f] - prog[f - 1]) * w;
    });
    const dO = Math.hypot(sh(f011, i, 0) - data[f011 * stride + 1], sh(f011, i, 1) - data[f011 * stride + 2]);
    const clear = dO > data[f011 * stride + 3] + sh(f011, i, 6);
    rows.push({
      i, chord: +chord.toFixed(1), at: at.map((v) => +v.toFixed(3)),
      minPx: +minPx.toFixed(1), overPx: +overPx.toFixed(1), clear011: clear,
    });
  }
  const valid = rows.filter((r) => Number.isFinite(r.chord));
  const rev = valid.filter((r) => r.minPx < -2);
  const over = valid.filter((r) => r.overPx > 2);
  const chords = valid.map((r) => r.chord);
  return {
    name, mode: rec.mode, frames: n, seconds: +(T[n - 1] ?? 0).toFixed(2), firstFrame: +(T[0] ?? 0).toFixed(3),
    o: { cx: +data[1].toFixed(1), cy: +data[2].toFixed(1), r: +data[3].toFixed(1) },
    chordPx: { min: +Math.min(...chords).toFixed(1), median: +quant(chords, 0.5).toFixed(1), max: +Math.max(...chords).toFixed(1) },
    reversals: rev.length, worstReversalPx: rev.length ? Math.min(...rev.map((r) => r.minPx)) : 0,
    overshoots: over.length, worstOvershootPx: over.length ? Math.max(...over.map((r) => r.overPx)) : 0,
    clearAt011: pct(valid.filter((r) => r.clear011).length / Math.max(valid.length, 1)),
    clearFrameT: +T[f011].toFixed(3),
    progress: TRACK_AT.map((t, k) => {
      const xs = valid.map((r) => r.at[k]);
      const ok = xs.filter(Number.isFinite);
      return { t, mean: pct(ok.reduce((a, b) => a + b, 0) / Math.max(ok.length, 1)), p10: pct(quant(xs, 0.1)), median: pct(quant(xs, 0.5)), p90: pct(quant(xs, 0.9)) };
    }),
    shards: rows,
  };
};
const writeBreakTrack = (recs) => {
  let bursts = 0;
  const named = recs.map((r) => [r, r.mode === 'burst' ? (bursts++ ? 'rebreak' : 'shatter') : r.mode]);
  const out = named.filter(([r]) => r.frames > 1).map(([r, name]) => trackFlight(r, name));
  fs.writeFileSync(path.join(OUT, 'break-track.json'), JSON.stringify({ url: URL_, viewport: [VW, VH], sampleSeconds: TRACK_AT, flights: out }, null, 2));
  if (arg('raw', false)) fs.writeFileSync(path.join(OUT, 'break-track-raw.json'), JSON.stringify(recs));
  for (const f of out) {
    console.log(`break-track ${f.name} (${f.mode}): ${f.frames} frames over ${f.seconds}s · O r ${f.o.r}px · chord ${f.chordPx.min}/${f.chordPx.median}/${f.chordPx.max}px`);
    console.log(`  reversals ${f.reversals} (worst ${f.worstReversalPx}px) · overshoots ${f.overshoots} (worst ${f.worstOvershootPx}px) · clear of the O at +${f.clearFrameT}s ${f.clearAt011}%`);
    console.log(`  progress %  t: ${f.progress.map((p) => p.t).join(' / ')}`);
    for (const k of ['mean', 'p10', 'median', 'p90']) console.log(`  ${k.padStart(10)}: ${f.progress.map((p) => p[k]).join(' / ')}`);
  }
};

if (WALK) {
  const HOLD = Number(arg('hold', 8));
  const SHEET_FPS = Number(arg('sheetfps', 6));
  const BACK = !!arg('back', false);
  const BREAK = !!arg('break', false);
  const CLIPS = !!arg('clips', false);
  const now = () => +((Date.now() - tPage) / 1000).toFixed(2);
  const beats = [];
  const timeline = [];
  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const s = await page
        .evaluate((fn) => {
          const st = window.__swmProcessStats;
          const base = { scrollY: Math.round(window.scrollY) };
          if (!st) return base;
          // w3: keep-out + frame edge against the painted page, every sample
          const k = (0, eval)(`(${fn})`)();
          return {
            ...base, stage: st.stage, cam: st.cam, chips: st.chips?.length ?? 0, fps: st.fps,
            // 10-08 (w8): draw calls of the LAST render, read live (the peek)
            calls: window.__swmProcessPeek?.()?.calls ?? st.calls ?? null,
            vis: k?.n ?? 0, visLive: k?.live ?? 0, keepHits: k?.hits ?? [], keepNear: k?.near ?? 0, edgeMin: k?.edgeMin ?? null, clipped: k?.clipped ?? [],
            leg: st.leg ?? null,
          };
        }, keepCheck.toString())
        .catch(() => null);
      if (s) timeline.push({ t: now(), ...s });
      await sleep(250);
    }
  })();
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  // The copy hook appends the globe-O slot on mount; the splash starts 0.2s later.
  await page.waitForSelector('.process-hero__globe-o', { state: 'attached', timeout: 30000 });
  beats.push({ name: 'splash', t: Math.max(now() - 0.3, 0), secs: 7.5 });
  await page.waitForFunction(() => window.__swmProcessStats?.chips, null, { timeout: 30000 });
  await sleep(7500);
  // 10-07: the BREAK frame by frame — 25fps from just before the wind-up,
  // anchored on the scene's impact clock (performance.now → the video's).
  const impactBeat = async (name, lead, secs) => {
    const impact = await page
      .evaluate(() => {
        const at = window.__swmProcessStats?.impactAt;
        return at == null ? null : performance.timeOrigin + at;
      })
      .catch(() => null);
    if (impact) beats.push({ name, t: +Math.max((impact - tPage) / 1000 - lead, 0).toFixed(2), secs, fps: 25 });
  };
  await impactBeat('shatter', 0.6, 2.4);
  // w2: the break track — pulled after each flight, merged on its start clock
  // (the scene keeps only the last few).
  const flights = new Map();
  const pullTrack = async () => {
    const got = await page.evaluate(() => window.__swmProcessTrack?.() ?? null).catch(() => null);
    for (const r of got ?? []) flights.set(r.t0, r);
  };
  if (BREAK) await pullTrack();
  const step = async (dir, name, secs, fps) => {
    beats.push({ name, t: now(), secs, fps });
    await page.evaluate((d) => window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir: d } })), dir);
    await sleep(secs * 1000);
  };
  if (BREAK) {
    await sleep(1500);
    await step(-1, 'reform', 4, 12);
    await pullTrack();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('swm:process-step', { detail: { dir: 1 } })));
    await sleep(4000);
    await impactBeat('rebreak', 0.3, 2);
    await pullTrack();
    writeBreakTrack([...flights.values()].sort((a, b) => a.t0 - b.t0));
  } else {
  beats.push({ name: 's1-tour', t: now(), secs: HOLD, fps: 2 });
  await sleep(HOLD * 1000);
  await step(1, 'to-s2', 9);
  await step(1, 'to-s3', 6);
  await step(1, 'to-s4', 6);
  await step(1, 'to-s5', 7);
  await step(1, 'to-cta', 5);
  }
  if (BACK && !BREAK) {
    await step(-1, 'back-s5', 5);
    await step(-1, 'back-s4', 5);
    await step(-1, 'back-s3', 5);
    // 10-09 (w9b fix): S3→S2 RECONNECTS now (≈6.6 s to rest) — at 5 s the
    // walk's back-s1 cut it mid-strike, so the sheet never showed the rest
    await step(-1, 'back-s2', 8);
    await step(-1, 'back-s1', 6);
    await step(-1, 'back-hero', 6, 12); // the reform, at twice the sheet rate
  }
  sampling = false;
  await sampler;
  const video = page.video();
  await ctx.close(); // finalizes the recording
  const src = await video.path();
  // The recording can start late under load (a phone context launched
  // alongside another browser lost ~1.7s): the frames it missed are at the
  // START, so the gap between the wall clock at close and the video's
  // length is the offset every cut has to take off.
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]).toString().trim());
  const lag = Number.isFinite(dur) ? Math.max(+(now() - dur).toFixed(2), 0) : 0;
  if (lag > 0.15) console.log(`video started ${lag}s late — cuts shifted back`);
  // One contact sheet per beat (desktop 5×4 of 384px frames, phone 8×2 of
  // 422px-tall frames), each frame stamped with its time since the trigger.
  const [cols, rows, scale] = MOBILE ? [8, 2, '-2:422'] : [5, 4, '384:-2'];
  const font = '/System/Library/Fonts/Supplemental/Arial.ttf';
  for (const b of beats) {
    const vf = [
      `fps=${b.fps ?? SHEET_FPS}`,
      `scale=${scale}`,
      `drawtext=fontfile=${font}:text='%{pts\\:flt}':x=6:y=6:fontsize=15:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=3`,
      `tile=${cols}x${rows}:padding=4:color=white`,
    ].join(',');
    const ss = String(Math.max(b.t - lag, 0));
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', ss, '-t', String(b.secs), '-i', src, '-vf', vf, '-fps_mode', 'vfr', path.join(WALK_DIR, `${b.name}-%02d.png`)]);
    if (CLIPS)
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', ss, '-t', String(b.secs), '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '22', path.join(WALK_DIR, `${b.name}.mp4`)]);
  }
  fs.renameSync(src, path.join(WALK_DIR, 'walk.webm'));
  // w3: the keep-out summary — samples with a chip on bare type/chrome (and
  // which), chips inside the 12px air, the nearest frame edge, clipped chips;
  // and chips seen at the HERO (there should be none).
  const withVis = timeline.filter((r) => r.vis > 0);
  const edges = withVis.map((r) => r.edgeMin).filter(Number.isFinite);
  const keepout = {
    samplesWithChips: withVis.length,
    hitSamples: timeline.filter((r) => r.keepHits?.length).length,
    hits: timeline.filter((r) => r.keepHits?.length).map((r) => ({ t: r.t, stage: r.stage, hits: r.keepHits })),
    nearSamples: timeline.filter((r) => r.keepNear > 0).length,
    edgeMin: edges.length ? Math.min(...edges) : null,
    clippedSamples: timeline.filter((r) => r.clipped?.length).length,
    clipped: timeline.filter((r) => r.clipped?.length).map((r) => ({ t: r.t, clipped: r.clipped })),
    chipsAtHero: timeline.filter((r) => r.stage === 'hero' && r.visLive > 0).map((r) => ({ t: r.t, live: r.visLive })),
    // chips still cutting out when the stage flips to the hero (their exit outlives the flip)
    leavingAtHero: timeline.filter((r) => r.stage === 'hero' && r.vis > (r.visLive ?? 0)).map((r) => ({ t: r.t, leaving: r.vis - (r.visLive ?? 0) })),
  };
  // 10-08 (w8, code-calls-unmeasured): draw calls — the per-beat max of
  // the 250ms samples (a peak shorter than a sample can slip between) and
  // the per-stage max, for docs/process-page-spec.md's budget.
  const callsIn = (rows) => {
    const xs = rows.map((r) => r.calls).filter(Number.isFinite);
    return xs.length ? Math.max(...xs) : null;
  };
  const calls = {
    max: callsIn(timeline),
    byBeat: beats.map((b) => ({ name: b.name, max: callsIn(timeline.filter((r) => r.t >= b.t && r.t <= b.t + (b.secs ?? 0))) })),
    byStage: Object.fromEntries([...new Set(timeline.map((r) => r.stage).filter(Boolean))].map((st) => [st, callsIn(timeline.filter((r) => r.stage === st))])),
  };
  fs.writeFileSync(path.join(WALK_DIR, 'walk.json'), JSON.stringify({ url: URL_, viewport: [VW, VH], videoLag: lag, beats, keepout, calls, timeline, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }, null, 2));
  console.log(JSON.stringify({ out: WALK_DIR, beats, calls, keepout: { ...keepout, hits: keepout.hits.slice(0, 6), clipped: keepout.clipped.slice(0, 6) }, sheets: fs.readdirSync(WALK_DIR).filter((f) => f.endsWith('.png')).length, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }, null, 2));
  await browser.close();
  process.exit(0);
}

await page.goto(URL_, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__swmProcessStats?.chips, null, { timeout: 30000 });
// Let the arrival materialize land before judging anything.
await sleep(3000);

if (TRANSITION) {
  // 10-07 (final review): the splash breaks into S1 on its own — wait for it
  await page.waitForFunction(() => window.__swmProcessStats?.stage === 'stage-01', null, { timeout: 30000 });
  await sleep(6000); // mid-tour: the first leg has pushed in off the wide
  const rows = [];
  const t0 = Date.now();
  await page.locator('.process-debug__stages button', { hasText: /^02$/ }).click();
  while (Date.now() - t0 < 14000) {
    const s = await page.evaluate(() => window.__swmProcessStats);
    if (rows.length === 5 || rows.length === 11) {
      await page.screenshot({ path: path.join(OUT, `transition-${rows.length === 5 ? 'trace' : 'assembly'}.png`) });
    }
    rows.push({ t: +((Date.now() - t0) / 1000).toFixed(1), stage: s.stage, cam: s.cam });
    await sleep(500);
  }
  const zs = rows.map((r) => r.cam?.[2]).filter((z) => Number.isFinite(z));
  const summary = {
    tightZ: zs[1], // first sample after the glide-in
    // the trace's creep is slow; the assembly's pull-back is the first step > 0.1
    traceEndZ: (() => { for (let i = 2; i < zs.length; i++) if (zs[i] - zs[i - 1] > 0.1) return zs[i - 1]; return zs[zs.length - 1]; })(),
    restZ: zs[zs.length - 1],
    restXY: rows[rows.length - 1].cam?.slice(0, 2),
  };
  fs.writeFileSync(path.join(OUT, 'transition.json'), JSON.stringify({ url: URL_, rows, summary, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }, null, 2));
  console.log(rows.map((r) => `${r.t}\t${r.stage}\t${r.cam?.join('\t')}`).join('\n'));
  console.log(JSON.stringify({ summary, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }));
  await browser.close();
  process.exit(0);
}

const boxesHit = (a, b, h = 18) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < h;

// A target keeps its word for the life of the belt (Nathan 09-10): every
// (target id → term) pairing seen, and any target seen wearing two words.
const wordOf = new Map();
const relabelled = [];
// w3 (10-07): …and its FILL (the shard's colour, dealt on its first naming)
const fillOf = new Map();
const refilled = [];
// w3: the tour's legs as they change — kind + when it began
const legs = [];
let lastHoldKey = '';
// 10-07 (final review): a hold's screenshot stalls this very page (the
// SwiftShader capture) — the NEXT sample's fps measures the probe, not the
// scene (sample-m's 30fps at t=7.0). That one sample's fps is dropped.
let shotStall = false;
/* 10-08 (w8): --buried — the landed chips' visible share of their own fill
   (see the header). One screenshot per sample that has a chip due. */
const buried = BURIED ? { rows: [], firstSeen: new Map(), fillOf: new Map(), shots: 0, pickN: 0, pickMs: [], peek: null, checks: new Map() } : null;
const sharp = BURIED ? require('sharp') : null;
const rgbOf = (h) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const measureBuried = async (s, t) => {
  // 10-08 (w8b): one live read — the chips as painted, and peek (fills, ids,
  // the subject, the pick-cost ring) — not the 500ms snapshot `s`
  const { boxes, peek } = await page.evaluate(() => ({ boxes: window.__swmProcessChips?.() ?? null, peek: window.__swmProcessPeek?.() ?? null }));
  buried.livePeek = peek; // 10-08 (w8b fix, rc1): this sample's live read — the holds below read the tour from it
  if (peek) {
    buried.peek = peek;
    peek.chips.forEach((c) => c.fill && buried.fillOf.set(c.term, { fill: c.fill, id: c.id }));
    const ring = peek.pick;
    if (ring && ring.n > buried.pickN) {
      for (let i = Math.max(buried.pickN, ring.n - ring.ms.length); i < ring.n; i++) buried.pickMs.push(ring.ms[i % ring.ms.length]);
      buried.pickN = ring.n;
    }
    (peek.holdCheck ?? []).forEach((e) => buried.checks.set(e.seq, e)); // ?chipcover hold's predictor log, newest copy wins
  }
  const tourId = typeof peek?.tour === 'object' ? peek.tour?.id : null;
  const live = (boxes ?? []).filter((c) => !c.fading && !c.retracting);
  const terms = new Set(live.map((c) => c.term));
  for (const k of [...buried.firstSeen.keys()]) if (!terms.has(k)) buried.firstSeen.delete(k);
  live.forEach((c) => !buried.firstSeen.has(c.term) && buried.firstSeen.set(c.term, t));
  const due = live.filter((c) => t - buried.firstSeen.get(c.term) >= 0.45 && rgbOf(buried.fillOf.get(c.term)?.fill));
  if (!due.length) return false;
  const png = await page.screenshot();
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const dpr = info.width / VW;
  for (const c of due) {
    const { fill, id } = buried.fillOf.get(c.term);
    const rgb = rgbOf(fill);
    const x0 = Math.max(Math.round((c.x - c.w / 2 + 3) * dpr), 0);
    const x1 = Math.min(Math.round((c.x + c.w / 2 - 3) * dpr), info.width);
    const y0 = Math.max(Math.round((c.y - c.h / 2 + 2) * dpr), 0);
    const y1 = Math.min(Math.round((c.y + c.h / 2 - 2) * dpr), info.height);
    let n = 0;
    let hit = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * info.width + x) * info.channels;
        n += 1;
        if (Math.hypot(data[i] - rgb[0], data[i + 1] - rgb[1], data[i + 2] - rgb[2]) < 60) hit += 1;
      }
    }
    const frac = n ? hit / n : 0;
    const row = { t, stage: peek?.stage ?? s.stage, term: c.term, frac: +frac.toFixed(3), subject: tourId != null && tourId === id };
    if (frac < 0.2 && buried.shots < 12) {
      buried.shots += 1;
      row.shot = `buried-${String(buried.shots).padStart(2, '0')}-${c.term}.png`;
      fs.writeFileSync(path.join(OUT, row.shot), png);
    }
    buried.rows.push(row);
  }
  return true;
};
const buriedSummary = () => {
  const gap = Math.max(1.0, (2 * EVERY) / 1000);
  const episodes = [];
  const open = new Map();
  for (const r of buried.rows) {
    const e = open.get(r.term);
    if (e && r.t - e.last <= gap && e.stage === r.stage) {
      e.last = r.t;
      e.n += 1;
      e.buried += r.frac < 0.2 ? 1 : 0;
      e.fracs.push(r.frac);
    } else {
      const ne = { term: r.term, stage: r.stage, from: r.t, last: r.t, n: 1, buried: r.frac < 0.2 ? 1 : 0, first: r.frac, subject: r.subject, fracs: [r.frac], runs: [] };
      episodes.push(ne);
      open.set(r.term, ne);
    }
    // 10-08 (w8b): the episode's straight buried runs (from its first buried sample to its last + one cadence)
    const ep = open.get(r.term);
    const run = ep.runs[ep.runs.length - 1];
    if (r.frac < 0.2) {
      if (run && run.open) run.to = r.t;
      else ep.runs.push({ from: r.t, to: r.t, open: true });
    } else if (run) run.open = false;
  }
  const median = (a) => {
    const v = [...a].sort((x, y) => x - y);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  };
  const pct = (a, q) => {
    const v = [...a].sort((x, y) => x - y);
    return v.length ? +v[Math.min(Math.floor(q * v.length), v.length - 1)].toFixed(3) : null;
  };
  // ?chipcover hold: the predictor's error at +1s / +2s (centre px, cover) — every checked seat (the
  // bound chip and the last refused one per pick), and the subset where either side saw cover (> 0);
  // `goneMismatch`: one side says the chip has left (stranded/keep/behind) and the other not
  const holdErr = [1, 2].map((tau) => {
    const dc = [];
    const dv = [];
    const dvc = [];
    let gone = 0;
    let goneMismatch = 0;
    let refused = 0;
    for (const e of buried.checks.values()) {
      const p = e.pred.find((x) => x.tau === tau);
      const a = e.act.find((x) => x.tau === tau);
      if (!p || !a) continue;
      if (p.gone || a.gone) {
        if (p.gone && a.gone) gone += 1;
        else goneMismatch += 1;
        continue;
      }
      if (e.refused) refused += 1;
      dc.push(Math.hypot(p.x - a.x, p.y - a.y));
      dv.push(Math.abs(p.cover - a.cover));
      if (p.cover > 0 || a.cover > 0) dvc.push(Math.abs(p.cover - a.cover));
    }
    const mean = (v) => (v.length ? +(v.reduce((x, y) => x + y, 0) / v.length).toFixed(3) : null);
    return {
      tau, n: dc.length, refused, gone, goneMismatch,
      centreMean: mean(dc), centreP95: pct(dc, 0.95), centreMax: dc.length ? +Math.max(...dc).toFixed(1) : null,
      coverMean: mean(dv), coverP95: pct(dv, 0.95), coverMax: dv.length ? Math.max(...dv) : null,
      covered: { n: dvc.length, mean: mean(dvc), p95: pct(dvc, 0.95) },
    };
  });
  const runSecs = (e) => Math.max(0, ...e.runs.map((u) => u.to - u.from + EVERY / 1000));
  const drift = episodes.filter((e) => e.buried >= 3 && e.first >= 0.2);
  const vis = buried.rows.filter((r) => r.frac >= 0.2).map((r) => r.frac).sort((a, b) => a - b);
  return {
    every: EVERY,
    atBind: episodes.filter((e) => e.first < 0.2).length,
    atBindEp: episodes.filter((e) => e.first < 0.2).map((e) => ({ term: e.term, t: e.from, subject: e.subject })),
    samples: buried.rows.length,
    buriedSamples: buried.rows.filter((r) => r.frac < 0.2).length,
    partialSamples: buried.rows.filter((r) => r.frac >= 0.2 && r.frac < 0.4).length,
    medianVisible: vis.length ? vis[Math.floor(vis.length / 2)] : null,
    episodes: episodes.length,
    buriedEpisodes: episodes.filter((e) => e.buried >= 3).map((e) => ({ term: e.term, from: e.from, to: e.last, buried: e.buried, n: e.n, subject: e.subject })),
    subjectNamingsPer100s: +((episodes.filter((e) => e.subject).length * 100) / SECS).toFixed(1),
    // 10-08 (w8b) — see the header
    chipCover: buried.peek?.chipCover ?? null,
    driftEpisodes: drift.length,
    driftEp: drift.map((e) => ({ term: e.term, from: e.from, to: e.last, buried: e.buried, n: e.n, first: e.first, secs: +runSecs(e).toFixed(2), subject: e.subject })),
    subjectDriftLong: drift.filter((e) => e.subject && runSecs(e) >= 1).length,
    subjectReadablePer100s: +((episodes.filter((e) => e.subject && e.n >= 3 && median(e.fracs) >= 0.4).length * 100) / SECS).toFixed(1),
    buriedShare: buried.rows.length ? +(buried.rows.filter((r) => r.frac < 0.2).length / buried.rows.length).toFixed(4) : null,
    pickMs: { n: buried.pickMs.length, sum: +buried.pickMs.reduce((x, y) => x + y, 0).toFixed(1), p50: pct(buried.pickMs, 0.5), p95: pct(buried.pickMs, 0.95), max: buried.pickMs.length ? +Math.max(...buried.pickMs).toFixed(3) : null },
    strictOver: buried.peek?.strictOver ?? null,
    holdCheck: buried.checks.size ? holdErr : null,
    holdAudit: buried.peek?.holdAudit ?? null,
    shots: buried.rows.filter((r) => r.shot).map((r) => r.shot),
  };
};
const t0 = Date.now();
while (Date.now() - t0 < SECS * 1000) {
  const s = await page.evaluate(() => window.__swmProcessStats);
  const k = await page.evaluate((fn) => (0, eval)(`(${fn})`)(), keepCheck.toString()).catch(() => null);
  const tNow = +((Date.now() - t0) / 1000).toFixed(1);
  if (s.leg && s.legN !== legs[legs.length - 1]?.n) legs.push({ kind: s.leg, n: s.legN, t: tNow });
  for (const c of s.chips) {
    const prev = wordOf.get(c.id);
    if (prev && prev !== c.term) relabelled.push({ id: c.id, was: prev, now: c.term, t: tNow });
    wordOf.set(c.id, c.term);
    if (fillOf.has(c.id) && fillOf.get(c.id) !== (c.fill ?? null)) refilled.push({ id: c.id, was: fillOf.get(c.id), now: c.fill ?? null, t: tNow });
    fillOf.set(c.id, c.fill ?? null);
  }
  const terms = s.chips.map((c) => c.term);
  const dupes = terms.filter((t, i) => terms.indexOf(t) !== i);
  const overlaps = [];
  for (let i = 0; i < s.chips.length; i++)
    for (let j = i + 1; j < s.chips.length; j++)
      if (boxesHit(s.chips[i], s.chips[j])) overlaps.push([s.chips[i].term, s.chips[j].term]);
  const sample = {
    t: tNow, fps: shotStall ? null : s.fps, fpsAfterShot: shotStall ? s.fps : undefined, stage: s.stage, chips: s.chips.length, dupes, overlaps, tour: s.tour, leg: s.leg, cap: s.cap, calls: s.calls, legN: s.legN, // 10-09 (w9b): + calls, legN
    keepHits: k?.hits ?? [], keepNear: k?.near ?? 0, edgeMin: k?.edgeMin ?? null, clipped: k?.clipped ?? [],
  };
  report.samples.push(sample);
  shotStall = false;
  if (buried && (await measureBuried(s, tNow))) shotStall = true; // 10-08 (w8): its screenshot stalls the next sample's fps too
  /* 10-08 (w8b fix, rc1): the HOLDS read the tour LIVE — measureBuried's
     own peek when --buried ran this sample (taken before its screenshot),
     else one read of their own — not the 500ms snapshot `s`, which saw a
     station's arrival up to 0.5s late and took its `labelled` from
     whatever had bound by then (holdsLabelled is a gate metric). A hold is
     still one station (its seat), from the first live sample at blend ≥
     0.98 until the blend drops for the next leg: `labelled` is the subject
     named at that first sample (AT ITS ARRIVAL), `named` whether it was
     named at any live sample of the station, `namedAfter` the seconds from
     the arrival sample to the first that saw it (0 = at the arrival). */
  const pk = buried ? buried.livePeek : await page.evaluate(() => window.__swmProcessPeek?.() ?? null);
  const tourNow = (pk ?? s).tour;
  const tour = tourNow && typeof tourNow === 'object' ? tourNow : null;
  const holding = Boolean(tour) && tour.blend >= 0.98;
  const key = holding ? `${tour.seatU},${tour.seatV}` : '';
  if (holding && key !== lastHoldKey) {
    const file = path.join(OUT, `hold-${String(report.holds.length + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    shotStall = true;
    const errU = +(tour.u - tour.seatU).toFixed(2);
    const errV = +(tour.v - tour.seatV).toFixed(2);
    // Which shards are labelled at this hold — consecutive holds should
    // share few (each stop puts new shards in frame).
    const chipsNow = (pk ?? s).chips;
    const ids = chipsNow.map((c) => c.id);
    const prev = report.holds[report.holds.length - 1];
    const repeat = prev ? ids.filter((id) => prev.ids.includes(id)).length : 0;
    report.holds.push({ t: sample.t, ...tour, named: tour.labelled, namedAfter: tour.labelled ? 0 : null, errU, errV, chips: chipsNow.length, ids, repeat, shot: file });
  } else if (holding && tour.labelled) {
    const h = report.holds[report.holds.length - 1];
    if (h && !h.named) {
      h.named = true;
      h.namedAfter = +(sample.t - h.t).toFixed(1);
    }
  }
  lastHoldKey = key;
  await sleep(EVERY);
}

const counts = report.samples.filter((x) => x.stage === 'stage-01').map((x) => x.chips);
report.summary = {
  samples: counts.length,
  chipsMin: Math.min(...counts),
  chipsMean: +(counts.reduce((a, b) => a + b, 0) / Math.max(counts.length, 1)).toFixed(2),
  chipsMax: Math.max(...counts),
  // 10-07 (final review): the scene's floor, the post-screenshot samples left out
  fpsMin: (() => {
    const f = report.samples.map((x) => x.fps).filter(Number.isFinite);
    return f.length ? Math.min(...f) : null;
  })(),
  dupeSamples: report.samples.filter((x) => x.dupes.length).length,
  overlapSamples: report.samples.filter((x) => x.overlaps.length).length,
  targetsSeen: wordOf.size,
  relabelled,
  holds: report.holds.length,
  holdsLabelled: report.holds.filter((h) => h.labelled).length, // 10-08 (w8b fix): live, the subject named AT its arrival
  holdsNamed: report.holds.filter((h) => h.named).length, // …named at any live sample of its station
  holdsNamedLate: report.holds.filter((h) => h.named && h.namedAfter > 0).map((h) => ({ t: h.t, id: h.id, after: h.namedAfter })),
  holdsUnnamed: report.holds.filter((h) => !h.named).map((h) => ({ t: h.t, id: h.id })),
  holdRepeats: report.holds.map((h) => h.repeat),
  worstSeatErr: report.holds.length ? Math.max(...report.holds.map((h) => Math.max(Math.abs(h.errU), Math.abs(h.errV)))) : null,
  // w3 (10-07)
  refilled,
  fillsSeen: [...fillOf.values()].filter(Boolean).length,
  keepHitSamples: report.samples.filter((x) => x.keepHits.length).length,
  keepNearSamples: report.samples.filter((x) => x.keepNear > 0).length,
  edgeMin: (() => {
    const e = report.samples.map((x) => x.edgeMin).filter(Number.isFinite);
    return e.length ? Math.min(...e) : null;
  })(),
  clippedSamples: report.samples.filter((x) => x.clipped.length).length,
  // each leg's kind, its start (sample clock, ±--every) and length to the next
  legs: legs.map((l, i) => ({ n: l.n, kind: l.kind, t: l.t, secs: legs[i + 1] ? +(legs[i + 1].t - l.t).toFixed(1) : null })),
  threeOfAKind: legs.some((l, i) => i >= 2 && l.kind !== 'wide' && l.kind !== 'even' && legs[i - 1].kind === l.kind && legs[i - 2].kind === l.kind),
  // 10-08 (w8): --buried (null without it)
  buried: buried ? buriedSummary() : null,
};
if (buried) report.buriedRows = buried.rows;
// 10-09 (w9b): the scene's chip bench (?debug) — per-station fill, binds, calls, leader×chip crossings
report.chipStats = await page.evaluate(() => window.__swmProcessPeek?.()?.chipStats ?? null).catch(() => null);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ summary: report.summary, holds: report.holds, consoleErrors: report.consoleErrors, pageErrors: report.pageErrors }, null, 2));
await browser.close();
