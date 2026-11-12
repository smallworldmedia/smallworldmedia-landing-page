#!/usr/bin/env node
/**
 * globe-probe — headless Playwright harness for the home globe's population
 * modes (docs/globe-worlds-plan.md). Sibling of pager-probe (same launch
 * doctrine, same noise filter); reads window.__swmPopStats, which the
 * PopulationDirector publishes at ~2 Hz.
 *
 * Usage:
 *   node scripts/globe-probe.mjs [--mode=tides] [--secs=20] [--warm=6]
 *        [--next=2] [--seed=42] [--mobile] [--rm] [--intro=replay|full]
 *        [--paint] [--enter] [--footer] [--detail=SLUG] [--hold=PREFIX] [--directory[=QUERY]]
 *        [--noclip] [--keyctl=escape|ring] [--channel=chrome]
 *        [--extra="&popgroup=3"] [--base=http://localhost:4322] [--out=DIR]
 *        [--units[=0|1]] [--level=off|tex|h|vq|live|tier] [--texmb=MiB]
 *        [--texpeak=MiB] [--record-baseline] [--baseline=KEY] [--negctl[=bind|pin]]
 *        [--decodemax=MP] [--densitymax=X] [--dsf=N]
 *
 * --dsf=N: the context's device scale factor (default desktop 1, --mobile 2); the globe renders at min(N, GLOBE_DPR_MAX). u-hidpi runs at 2, the phonehd keys at 3
 *
 * P7, all report-only (no gate reads them): report.argv (this run's arguments), report.negctl (--negctl as
 * resolved: false, true, 'bind' or 'pin') and report.darkThumbs, Nathan's Q12 list: every class texture home
 * received that is near-black or flat (unitGates.darkThumb: luma mean < 16 or sd < 6 on 0–255), as
 * { id, cls, w, h, mean, sd }, measured from the bytes already received (no new request) on sharp's raw
 * greyscale pixels. report.darkThumbsScan { measured, failed } counts the class textures read.
 *
 * --base and --out also read GLOBE_PROBE_BASE / GLOBE_PROBE_OUT, for a pinned
 * verifier command that carries no flags (GLOBE_PROBE_OUT is the PARENT of the
 * per-run folder, so one setting serves every variant of a run).
 *
 * The video diet (P0, P0v). Every run but --footer logs its Mux and Sanity
 * requests into report.net (scripts/lib/netReport.mjs reads it): per-bucket
 * {n, bytes} for mux-master, mux-playlist, mux-segment, mux-thumb and
 * sanity-image, the same per route, each rendition's highest segment index
 * against what its clip keeps, what each <video> played, and the chunks
 * fetched more than once (refetch: listed, not gated). Every master owes its
 * surface's clip, imported from src/components/work/imageConfig.js: the pool
 * (a min = max pin in the asked URL) PREVIEW_SECONDS, a detail page's bare
 * players DETAIL_MAX_SECONDS, the directory's players PREVIEW_SECONDS.
 * Four gates (report.net.detail[gate] = { n, floor, vacuous, worst, bound,
 * … }): streamClip (every master carries the
 * clip it owes), segmentsPerRendition (no segment fetched past it, none that
 * two playlists list), loops (no <video> plays past its loop point, the
 * window or its clip's end, by more than LOOP_END_S, fires `ended` or freezes
 * on its last frame, and one wraps there) and audio (P0v: no muted surface
 * fetches an audio rendition's playlist or chunk, while the masters on the
 * wire still list one).
 * --noclip strips the clip from every master in flight (page.route): the
 * negative control, under which the clip gates (streamClip,
 * segmentsPerRendition) must fail non-vacuously. Every player still wraps at
 * its window, so loops is no control there, and the client still strips the
 * audio, so audio is no control there either. The route is registered in both
 * arms, and any page.route turns Playwright's HTTP cache off for the whole
 * page, images included: every byte in report.net is a cold-cache byte, a
 * probe's figure, not a viewer's.
 * --detail=SLUG loads /work/SLUG instead of home and scrolls it top to
 * bottom, holding two capped loops at each end; it judges the four gates,
 * detailCovered (every <video> on the page asked for a stream), noErrors
 * (no console error or page error; warnings are listed, not gated) and, with
 * --hold=PREFIX, heldWrap (the first <video> whose Mux id starts with PREFIX,
 * centred and held two capped loops more, wraps at least once and never
 * plays past its window), and skips the globe's sampling. --detail refuses
 * --rm, which would drop every vacuity floor to zero, and --footer and
 * --enter, which start on home.
 * --directory[=QUERY] loads /work/directory/?QUERY (the Project Directory;
 * --directory=client=dj-tennis, say). It holds two preview windows at the
 * top, takes 12 slow steps of most of a viewport (each held STEP_MS),
 * flings 20 steps FLING_MS apart, then holds two windows more; a step turns
 * back at either end of the page, so one client's short list takes every
 * step too. It judges the four gates (its players owe the preview window),
 * noErrors, directoryCovered (every video tile half in view at a hold's end
 * plays and asked for its stream, unless the players were at their cap),
 * playersCapped (never more live <video>s than the cap the page reads:
 * ?dirplayers, else DIRECTORY_PLAYERS by the 768px split) and flingDwell
 * (no master asked during the fling once a dwell into it; judged only while
 * the dwell, ?dirdwell, outlasts three fling steps). With no players (--rm,
 * or ?dirplayers=0), posterOnly (no master, no <video>, and every video
 * tile in view at the long holds' ends shows its poster) replaces those
 * three, and the diet gates' floors drop to zero. --directory refuses
 * --detail, --hold, --footer and --enter. --noclip is its negative control:
 * the run must fail streamClip.
 * On desktop, --directory then reloads for the keyboard, after the diet's
 * log closes, so none of it is judged there. tabReach: Tab from the top
 * reaches the first tile without focusing inside [inert], and one Tab per
 * link after it, flat out, lands on each next link in document order
 * through the last (judged only when the page has links). ringShows: the
 * focus ring is on the screen, read as pixels within 24 a channel of its
 * colour: the first undimmed filter tag's outline band (a tag a client
 * would empty is dimmed to 0.35, its ring with it), and the inset ring of
 * the first tile and of the last one focused. Their negative controls:
 * --keyctl=escape makes every chunk past the first inert, so Tab leaves
 * the grid (run it on the whole directory; one chunk has nothing ahead to
 * break), and must fail tabReach; --keyctl=ring puts back the tiles' old
 * inset outline, which the slot paints over, and must fail ringShows.
 * --keyctl needs --directory and refuses --mobile.
 *
 * Media spans (scripts/lib/unitGates.mjs; docs/globe-worlds-plan.md § Media
 * spans): --units adds &popunits=1 (--units=0 adds &popunits=0). Absent, the
 * page's default holds, on since Nathan's 10-23 bake (Q1), and the gates read it
 * so: a bare run is a units run (not under --mode=off, which has no director, nor
 * with an &popunits=0 in --extra). --extra comes before &popunits in the URL, and
 * the page reads a param's first value, so an &popunits there wins (nc-sneak
 * runs --units=0 --extra="&popunits=1"). --level picks
 * the span gates, cumulatively: tex (class textures), h (horizontal units), vq
 * (vertical pairs, quads), live (one stream and one chip per unit), tier
 * (measured decode, rungs, density). A tide run caps at h; --rm and
 * &poplive=tile cap at vq. A units run (--units, or no --units since 10-23) with
 * no --level fails unitsVacuous by design.
 * The gates read scripts/baselines/globe-units.json under KEY (--baseline,
 * default the --out folder's name); --record-baseline writes KEY, and only from
 * an all-pass run. --negctl turns the unit windows off (=bind: loadTile's hook
 * only) and =pin decodes every stream off its plan; they, and --texmb /
 * --texpeak / --decodemax / --densitymax set below the measured value, are the
 * negative controls: node scripts/lib/unitGates.mjs --expect-fail=<gates>
 * <report.json> exits 0 only when each named gate failed non-vacuously.
 * Seed 42 by default; for vacuity only, retry 7, 9, 11, 13 (first passing seed
 * per run type: 42 for every key in scripts/baselines/globe-units.json, all 17
 * of them, as re-recorded at the folded defaults on 11-01; a record stores it as
 * the string "42"). --record-baseline=0 is off, as --noclip=0 is. --negctl=pin
 * refuses --noclip. --detail and --footer refuse --units, --level, --negctl and
 * --record-baseline; both exit before the span gates, so --texmb, --texpeak,
 * --baseline, --decodemax and --densitymax do nothing there.
 * A home run with no record under its KEY fails legacyParity (units off) and,
 * except under --mode=off or with --texpeak, texPeak as vacuous, and exits 2:
 * with no --baseline, KEY is the --out folder's name, so pass the recorded key
 * the run matches. A bare value flag is taken silently: a bare --baseline
 * reads key "true", and a bare --texmb or --texpeak reads 1 (a bound under any
 * real value, so the run fails as a control would).
 *
 * The units-on run matrix (keys in scripts/baselines/globe-units.json; every
 * run adds --units --level=<L> --base=… --out=…/<key> and must exit 0; since
 * 10-23 the default &popequiv (32 since 10-24) makes neighbourRule report-only in every run,
 * and only --extra="&popequiv=0" judges it):
 *   u-desktop        (none)                1440×900 @1, lodpi
 *   u-mobile         --mobile              390×844 @2, phone bucket
 *   u-rm             --rm --next=1         stills only, capped at vq; --next=1
 *                    because RM's clock is static and its first plan is H only,
 *                    so ⏭ poses the first V/Q (A11, as landed in P5 56b6031;
 *                    the contract's §8.5 row says --rm alone)
 *   u-tide           --extra="&poptransset=tide&popunitmax=6" --secs=40   capped at h
 *   u-tile           --extra="&poplive=tile"                              capped at vq
 *   u-arrive         --intro=full --warm=10 --secs=30   held reveal, initVQ 0
 *   u-hidpi          --dsf=2               hidpi bucket
 *   u-phonehd        --mobile --dsf=3      phonehd bucket at the 480 pin (its quads
 *                    planned at 720, and its pairs too since 10-31's HD)
 *   u-phonehd720     --mobile --dsf=3 --extra="&globeres=720p"   the 720 pin
 *   u-equiv          --extra="&popequiv=13"   neighbourRule report-only
 *   u-thumb-phonehd  --mobile --dsf=3 --extra="&globethumb=512" --texmb=131
 *                    (desktop's stills, so desktop's texBudget)
 * Levels by phase: P3 tex; P4a, P4b h; P5 vq; P6a live; P6b, P7 tier. Units-off
 * keys: off-desktop, off-mobile, off-rm, off-tide, off-flat, off-phonehd
 * (--mobile --dsf=3); since 10-23 each passes --units=0. Under &poptier=today
 * no stream carries a tier plan, so
 * streamTier has no sample and a --level=tier run exits 2 on it alone: judge a
 * today run at --level=live. The negative controls (--expect-fail): nc-texmb,
 * nc-texpeak, nc-sneak, nc-units0, nc-windows, nc-bind, nc-windows-vq (the
 * flat look's unitSeam, unitRegister and unitRows), nc-windows-vq-rows (under
 * &popunitlook=rows, those plus unitColumns and unitWarp), nc-decode,
 * nc-density, nc-density-hidpi, nc-density-phonehd, nc-pin and nc-thumb;
 * docs/globe-worlds-plan.md § Media spans has their flags.
 *
 * P6b, report-only: report.dsf (the context's device scale factor) and
 * report.canvas { width, height, cssWidth, cssHeight, ratio, dpr }.
 *
 * Samples the stats (and the <html> accent: the pop-tint class, the computed
 * --project-color) once a second for --secs, clicks the bench's ⏭ next
 * --next times (spread across the run) and times each one until the new
 * world has landed (landedMs, ±0.5 s — the stats publish at ~2 Hz),
 * screenshots at the warm mark, after each ⏭ and at the end, and prints a
 * JSON report whose `pass` block holds the plan's gates: integrity ≥ 0.95
 * during holds, 0 black visible tiles after --warm, a bounded texture count,
 * no in-place flips during a hold (assets are persistent at rest), every ⏭
 * landed, the world changing on its own clock (under --rm only ⏭ moves it), the
 * chrome wearing the world's projectColor once a change has landed, the
 * client-name strips placed inside the latitude band and (in region mode)
 * wholly front-facing, each tile rendering its own whole slice of the strip
 * past the pole pinch, and never moving (10-07: the ticker is gone), and no
 * console/page errors. The report is also saved as report.json beside the
 * shots in --out (a failed or crashed run included); its path goes to stderr. --mode=off checks the default globe runs clean (no
 * stats, no tint).
 *
 * --paint reads the hero gradient's bottom pixel every frame it can through
 * one ⏭ change: the accent must ARRIVE through intermediate colours, not cut
 * at the end — Chromium's paint-invalidation trap on animating custom
 * properties (the 08-29 nav fix) — so the gate is ≥ 3 in-between colours.
 *
 * --enter (P3) then clicks Enter World on a world that isn't /work's first
 * (⏭ until the globe shows one) and follows the passage: /work must open
 * INSIDE that world as a snap — never an outgoing card (no Turn staged), the
 * scale pager never between stations (no glide from the first World), the
 * accent the world's colour from the moment it lands, the swm:enterWorld key
 * consumed. It then takes that card's enter_world to the detail page and the
 * breadcrumb back, which must reopen the same world (the swm:returnToWork
 * restore) as a snap too since 10-06 — no outgoing card on the way back.
 * 10-06 cover gates: the Enter World chrome must be fully out before the
 * loading bar shows (under RM the bar never shows), and on the way in AND
 * back the cover must be fully up from the moment /work's first card exists
 * until the wanted card is — reduced motion included (its instant cover), so
 * World 0's server-rendered card is never seen.
 * With --extra="&popenter=0" /work must open on its first world.
 *
 * --footer (10-07) is the only scenario here that GESTURES: it forces the
 * mobile viewport, drives a real touch scrub with CDP Input.dispatchTouchEvent
 * and MEASURES the MOBILE HOME resting footer's reveal. It short-circuits the
 * population sampling loop. Gates: the panel parks at ?footerrest with the
 * normalized rise at 0 (restFloor), the hero's lift is EXACTLY 0 in the
 * resting pose (liftZeroAtRest — a parallax driven off the raw --footer-reveal
 * instead of --footer-rise lifts the globe a third of the way on the first
 * paint), measured lift ÷ measured panel climb ≈ ?footerlift (liftRatio), the
 * button and the blue ring travel exactly with the globe (ctaRidesGlobe /
 * strokeRidesGlobe), driven mode publishes --footer-panel-h at all
 * (panelHPublished), the client marks' fade COMPLETES above the fold
 * (marksArriveOnScreen), they do NOT fade out on a downward gesture
 * (marksHoldOnRetreat — the --footer-peak rule), and the on-load entrance
 * genuinely runs rather than the blurb being final on its first drawn frame
 * (blurbNotFinalOnFirstFrame / blurbSettles). report.measured carries the
 * observed px — nothing in the design round could measure any of it.
 *
 * Failed image requests land in report.imageFailures (the noise filter hides
 * them from the console list) with a hint on stderr: a still the Sanity CDN
 * refuses by CORS — the page origin is off the project's allowlist, e.g. a
 * preview on a fresh port; localhost:4321, :4322 and :3333 are on it —
 * otherwise reads only as black tiles and a low integrity.
 *
 * Headless notes: SwiftShader is the default GPU (pager-probe's finding — the
 * GPU path starves the main thread); fps under it is NOT a device number.
 * The bundled Chromium plays the Mux streams (09-26: 7 decodes lit 31 tiles),
 * so streams/liveTiles are real; --channel=chrome runs the installed Google
 * Chrome instead.
 * ?intro=replay skips the ~5s logo intro (the full intro holds the globe dark,
 * so black tiles are expected until its cascade).
 */
import path from 'node:path';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PREVIEW_SECONDS, DETAIL_MAX_SECONDS, DIRECTORY_PLAYERS } from '../src/components/work/imageConfig.js';
import { readTune, SSR_TUNE } from '../src/components/work/directory/directoryTune.js';
import { netBucket, netReport, masterId, LOOP_SAMPLE_MS, LOOP_END_S } from './lib/netReport.mjs';
import { LEVELS, unitGates, baselineOf, readBaselines, writeBaseline, classifyRequest, darkThumb } from './lib/unitGates.mjs';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
// Playwright is not a project dependency — pager-probe's PLAYWRIGHT_PATH rule.
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright'
);

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const MODE = arg('mode', 'tides');
const SECS = Number(arg('secs', 20));
const WARM = Number(arg('warm', 6));
const NEXT = Number(arg('next', 0));
const SEED = arg('seed', '42');
// --footer (10-07) — the MOBILE HOME resting footer's reveal: the one
// scenario in this probe that GESTURES. It is a mobile scenario by
// definition (the floor only exists where Hero's frozen IS_MOBILE is true),
// so it forces the viewport itself and the pinned verifier stays flagless.
const FOOTER = !!arg('footer', false);
const MOBILE = FOOTER || !!arg('mobile', false);
const RM = !!arg('rm', false);
const VW = Number(arg('vw', MOBILE ? 390 : 1440));
const VH = Number(arg('vh', MOBILE ? 844 : 900));
const INTRO = arg('intro', 'replay');
const EXTRA = arg('extra', '');
// GLOBE_PROBE_BASE / GLOBE_PROBE_OUT are the same two knobs by environment,
// for a pinned verifier command that can't carry flags (several worktrees of
// this repo are often up at once, each dev server on its own port — and the
// Sanity CDN only allows a handful of them, see the CORS note above).
const BASE = arg('base', process.env.GLOBE_PROBE_BASE || 'http://localhost:4322');
const GPU = arg('gpu', 'swiftshader');
const CHANNEL = arg('channel', ''); // 'chrome' → the installed Google Chrome
const PAINT = !!arg('paint', false);
const ENTER = !!arg('enter', false);
const ENTER_OFF = /[?&]popenter=0\b/.test(EXTRA); // /work must open on its first world
const TEX_BOUND = Number(arg('texbound', 150)); // today's globe binds ~96
// The video diet (P0): --noclip strips asset_end_time from every master in
// flight (the negative control; --noclip=0, =false, =off, =no or = leave it
// off); --detail=SLUG probes /work/SLUG instead, and --hold=PREFIX holds one
// of its videos through a wrap.
const NOCLIP_ARG = arg('noclip', false);
const NOCLIP = NOCLIP_ARG === true || (typeof NOCLIP_ARG === 'string' && !/^(0|false|off|no)?$/i.test(NOCLIP_ARG));
const DETAIL = arg('detail', '');
if (DETAIL === true || process.argv.includes('--detail=')) throw new Error('globe-probe: --detail takes a slug (--detail=SLUG)');
if (DETAIL && RM) throw new Error('globe-probe: --detail with --rm drops every vacuity floor to 0; run --detail without --rm');
if (DETAIL && (FOOTER || ENTER)) throw new Error('globe-probe: --detail probes /work/SLUG alone; run --footer and --enter without it');
const HOLD = arg('hold', '');
if (HOLD === true || process.argv.includes('--hold=') || (HOLD && !DETAIL)) throw new Error('globe-probe: --hold takes a Mux id prefix and goes with --detail (--detail=SLUG --hold=PREFIX)');
const STEP_MS = 2000; // --detail, --directory: each scroll step's hold, so the slots it reveals start their streams
// --directory[=QUERY]: /work/directory/?QUERY alone (bare: no query).
const DIRECTORY_ARG = arg('directory', false);
const DIRECTORY = DIRECTORY_ARG !== false;
const DIR_QUERY = typeof DIRECTORY_ARG === 'string' ? DIRECTORY_ARG.replace(/^\?/, '') : '';
if (DIRECTORY && (DETAIL || HOLD || FOOTER || ENTER)) throw new Error('globe-probe: --directory probes /work/directory alone; run --detail, --hold, --footer and --enter without it');
// --keyctl=escape|ring: the keyboard gates' negative controls (directoryKeys).
const KEYCTL = arg('keyctl', '');
if (KEYCTL && (!['escape', 'ring'].includes(KEYCTL) || !DIRECTORY || MOBILE)) throw new Error('globe-probe: --keyctl takes escape or ring, with --directory and without --mobile');
// What the directory's player gate will read (DirectoryPage → DirectoryGrid): the page's own parser over this
// device's defaults (tuneDefaults: the phone's players at ≤768px), and no players under reduced motion.
const DIR_TUNE = readTune(DIR_QUERY, { ...SSR_TUNE, players: VW <= 768 ? DIRECTORY_PLAYERS.phone : DIRECTORY_PLAYERS.desktop });
const DIR_CAP = RM ? 0 : DIR_TUNE.players;
const DIR_DWELL_MS = DIR_TUNE.dwell;
const POSTERS_ONLY = DIRECTORY && DIR_CAP === 0;
const DIR_SLOW = 12; // --directory: slow steps, each held STEP_MS,
const DIR_FLING = 20; // then fling steps,
const FLING_MS = 60; // this far apart: a tile is half in view for three steps at most, under the dwell
// — Media spans (scripts/lib/unitGates.mjs; docs/globe-worlds-plan.md § Media spans) —
const UNITS_ARG = arg('units', null); // --units → &popunits=1; --units=0 → &popunits=0; absent → nothing added, and the page's default holds (on since Nathan's 10-23 bake, Q1)
const UNITS = UNITS_ARG === null ? null : UNITS_ARG === true ? 1 : Number(UNITS_ARG) > 0 ? 1 : 0;
const TIDE = /[?&]poptransset=tide\b/.test(EXTRA);
const TILE = /[?&]poplive=tile\b/.test(EXTRA);
const LEVEL_ASKED = String(arg('level', 'off'));
if (!LEVELS.includes(LEVEL_ASKED)) {
  console.error(`globe-probe: --level must be one of ${LEVELS.join(' | ')}`);
  process.exit(1);
}
// A tide re-births every row (V/Q leave with them): cap h. RM has no video, and tile mode never lights a member: cap vq.
const LEVEL = LEVELS[Math.min(LEVELS.indexOf(LEVEL_ASKED), TIDE ? 2 : 5, RM || TILE ? 3 : 5)];
// texBudget: resident MiB at rest, as the director counts it: the world on screen and, through its hold, the next
// one's images as they decode. At the defaults since Nathan's 10-24 tile budget (?popequiv 32) the heaviest adjacent
// pair reads 113.8 desktop, 63.2 phone (Rossi and Jeff Sorkowitz, seed 4242, the 10-31 texture ledger), plus
// texPeak's 15%. 96 / 56 were popcap 13's forecast (64.4, 36.3) plus headroom; texPeak, not this, bounds the
// change window's three groupings.
const TEXMB = Number(arg('texmb', MOBILE ? 73 : 131));
const TEXPEAK = arg('texpeak', null); // texPeak's bound; default = the baseline's peak × 1.15
// A bare flag is on; =0, =false, =off, =no or = (empty) is off: P0's --noclip parse (P0-AMEND §3.1.4, minor 9).
const flagOn = (v) => v === true || (typeof v === 'string' && !/^(0|false|off|no)?$/i.test(v));
const RECORD = flagOn(arg('record-baseline', false));
const NEGCTL = arg('negctl', false); // true | 'bind' | 'pin'
if (![false, true, 'bind', 'pin'].includes(NEGCTL)) {
  console.error('globe-probe: --negctl takes no value, or bind | pin');
  process.exit(1);
}
if (NOCLIP && NEGCTL === 'pin') {
  // Each rewrites the master URL with its own page.route, and a route.continue() never reaches the other handler.
  console.error('globe-probe: --noclip and --negctl=pin are separate negative controls; run them apart');
  process.exit(1);
}
if ((DETAIL || FOOTER || DIRECTORY) && (UNITS !== null || LEVEL_ASKED !== 'off' || NEGCTL || RECORD)) {
  // These branches exit before the span gates: a span flag there would pass on nothing.
  console.error('globe-probe: --detail, --footer and --directory have no span gates; run --units, --level, --negctl and --record-baseline without them');
  process.exit(1);
}
const DECODEMAX = arg('decodemax', null);
const DENSITYMAX = arg('densitymax', null);
// --dsf=N: the browser context's deviceScaleFactor (patch 4's C9). Absent, it is the context every key
// and baseline before P6b ran in: desktop 1, --mobile 2. The globe renders at min(N, GLOBE_DPR_MAX).
const DSF_ARG = arg('dsf', null);
const DSF = DSF_ARG === null ? (MOBILE ? 2 : 1) : Number(DSF_ARG);
if (DSF_ARG === true || !(DSF >= 1 && DSF <= 4)) {
  console.error('globe-probe: --dsf takes a device scale factor, --dsf=N with N from 1 to 4');
  process.exit(1);
}
// --footer expectations. These mirror the BAKES the scenario is gating, the
// way texbound mirrors the texture budget: Hero's FOOTER_REST_MOBILE and
// footerTune's liftK. Pass the matching --footerrest / --footerlift when you
// dial the page with ?footerrest / ?footerlift through --extra.
const FOOTER_REST_EXPECT = Number(arg('footerrest', 0.59));
const LIFT_K_EXPECT = Number(arg('footerlift', 0.5));
const MARKS_FROM_EXPECT = Number(arg('footermarksfrom', 0.6));
const RUN = `globe-${MODE}-${MOBILE ? 'm' : 'd'}${RM ? '-rm' : ''}${ENTER ? '-enter' : ''}${FOOTER ? '-footer' : ''}${DETAIL ? `-detail-${DETAIL}` : ''}${HOLD ? `-hold-${HOLD}` : ''}${DIRECTORY ? `-directory${DIR_QUERY ? `-${DIR_QUERY.replace(/\W+/g, '-')}` : ''}` : ''}${NOCLIP ? '-noclip' : ''}${KEYCTL ? `-keyctl-${KEYCTL}` : ''}`;
const OUT = arg(
  'out',
  // fileURLToPath, not URL.pathname — the Dropbox path has spaces (%20 would
  // mkdir a stray "Small%20World%20Media" tree beside the real one).
  path.join(
    process.env.GLOBE_PROBE_OUT || path.join(path.dirname(fileURLToPath(import.meta.url)), 'shots'),
    RUN
  )
);
// --footer loads home with NO bench: the pop panel's chip parks over the hero
// and would swallow the touch scrub. --detail loads the detail page itself,
// --directory the directory.
// --extra before &popunits: the page reads a param's first value, so an &popunits in --extra wins (nc-sneak).
// --footer pins &touchgain=2 AFTER --extra (so --extra can still override it): footerScenario's finger
// distances and step counts were calibrated at gain 2, and motion.js bakes 5 since 11-03 — unpinned,
// the up-scrub would hit the clamp in ~13 of its 32 steps and coarsen every number read off the grid.
const URL_ = DIRECTORY
  ? `${BASE}/work/directory/${DIR_QUERY ? `?${DIR_QUERY}` : ''}`
  : DETAIL
    ? `${BASE}/work/${DETAIL}`
    : FOOTER
      ? `${BASE}/?intro=${INTRO}${EXTRA}&touchgain=2`
      : `${BASE}/?popmode=${MODE}&popseed=${SEED}&poptune=1&intro=${INTRO}${EXTRA}${UNITS === null ? '' : `&popunits=${UNITS}`}`;
// The gates' context. Every value mirrors what the page will read, so a gate never guesses.
const BASELINE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'baselines', 'globe-units.json');
const extraNum = (k) => {
  const m = new RegExp(`[?&]${k}=(-?[\\d.]+)`).exec(EXTRA);
  return m ? Number(m[1]) : null;
};
const GATE_CTX = {
  key: String(arg('baseline', path.basename(OUT))),
  // units: --units, else what the page shows: none under --mode=off (no director), else --extra's &popunits, else
  // popConfig's default (on: Nathan 10-23, Q1)
  seed: SEED, units: UNITS ?? (MODE === 'off' ? 0 : (extraNum('popunits') ?? 1) > 0 ? 1 : 0), level: LEVEL, mode: MODE, rm: RM, mobile: MOBILE, tide: TIDE, tile: TILE, intro: INTRO,
  unitMax: Math.min(Math.max(Math.round(extraNum('popunitmax') ?? 4), 1), 6), // popConfig's default (Nathan 10-23, Q7) and clamp
  // GLOBE_T1: ?globethumb clamped and rounded, else THUMB_WIDTH (IS_MOBILE = max-width 768px, i.e. the CSS viewport)
  t1: extraNum('globethumb') != null ? Math.round(Math.min(Math.max(extraNum('globethumb'), 256), 1024)) : VW <= 768 ? 384 : 512,
  equiv: Math.max(0, extraNum('popequiv') ?? 32), // popConfig's default (Nathan 10-24)
  look: /[?&]popunitlook=rows\b/.test(EXTRA) ? 'rows' : 'flat', // popConfig's default (P9: Nathan 10-31)
  shapes: /[?&]popshapes=classic\b/.test(EXTRA) ? 'classic' : 'wide', // popConfig's default (Nathan 10-24)
  texmb: TEXMB,
  texpeak: TEXPEAK === null ? null : Number(TEXPEAK),
  decodemax: DECODEMAX === null ? null : Number(DECODEMAX),
  densitymax: DENSITYMAX === null ? null : Number(DENSITYMAX),
  record: RECORD,
  baselines: readBaselines(BASELINE_FILE),
};

// pager-probe's environmental noise (headless CDN CORS, GPU readback stalls,
// Chrome's reduced-motion view-transitions warning) — never the page's fault.
// --enter adds Chrome's font-preload timing warning on /work and the detail
// page (the layout's preloads, not the globe's).
const NOISE = [
  /cdn\.sanity\.io/,
  /net::ERR_FAILED/,
  /GPU stall due to ReadPixels/,
  /view.transition/i,
  /preloaded using link preload but not used/,
];

fs.mkdirSync(OUT, { recursive: true });
// Only this probe's own NN-name.png shots — never anything else in --out.
for (const f of fs.readdirSync(OUT)) if (/^\d\d-[\w-]+\.png$/.test(f)) fs.rmSync(path.join(OUT, f));
// The full report on disk, beside the shots — stdout stays the bare JSON.
const save = () => {
  const file = path.join(OUT, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 1) + '\n');
  console.error(`globe-probe: report → ${file}`);
};
const report = { url: URL_, argv: process.argv.slice(2), negctl: NEGCTL, viewport: [VW, VH], dsf: DSF, mobile: MOBILE, rm: RM, samples: [], shots: [], consoleErrors: [], pageErrors: [], imageFailures: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitServer() {
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    try {
      const r = await fetch(`${BASE}/`);
      if (r.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error('dev server not reachable at ' + BASE);
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(report.shots.length + 1).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  report.shots.push(file);
}

/** One CSS pixel's [r, g, b]: a 1×1 PNG, its IDAT inflated past the row's
 *  filter byte — with no neighbours, every PNG filter reconstructs to the
 *  raw bytes. */
async function pixel(page, x, y) {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 }, scale: 'css' });
  const idat = [];
  for (let at = 8; at < png.length; ) {
    const len = png.readUInt32BE(at);
    if (png.toString('ascii', at + 4, at + 8) === 'IDAT') idat.push(png.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  return [raw[1], raw[2], raw[3]];
}

// The <html> accent as the chrome reads it.
const readTint = (page) =>
  page.evaluate(() => {
    const html = document.documentElement;
    return {
      popTint: html.classList.contains('pop-tint'),
      accent: getComputedStyle(html).getPropertyValue('--project-color').trim(),
    };
  });
// Report-only (P6b; no gate reads it): the globe canvas's backing size, its CSS box, and the
// renderer's pixel ratio as the backing over the box (three's setSize writes floor(box × ratio)).
const readCanvas = (page) =>
  page
    .evaluate(() => {
      const c = document.querySelector('.video-globe__canvas canvas');
      if (!c) return null;
      const ratio = c.clientWidth ? Math.round((c.width / c.clientWidth) * 1000) / 1000 : null;
      return { width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight, ratio, dpr: window.devicePixelRatio };
    })
    .catch(() => null);
const rgbOf = (hex) => {
  const h = hex.replace('#', '');
  return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
};

// Open the bench (phones start collapsed) and press ⏭.
async function pressNext(page) {
  const chip = page.locator('.hero-tune--chip button');
  if (await chip.count()) await chip.first().click();
  const btn = page.locator('.hero-tune--pop button', { hasText: 'next' });
  if (!(await btn.count())) return false;
  await btn.first().click();
  return true;
}

// A hold with room left on its clock, so no change starts under the next step.
const holdRoom = (page) =>
  page
    .waitForFunction(
      () => {
        const s = window.__swmPopStats;
        return s?.phase === 'hold' && (s.holdLeft == null || s.holdLeft >= 3);
      },
      null,
      { timeout: 30000, polling: 100 }
    )
    .then(
      () => true,
      () => false
    );

// /work's first World — slug + accent — from its SSR'd card.
async function firstWork() {
  const html = await (await fetch(`${BASE}/work`)).text();
  const wrap = html.match(/<div[^>]*fp-card-wrap[^>]*>/)?.[0] ?? '';
  const tag = html.match(/<a[^>]*fp-card__cta[^>]*>/)?.[0] ?? '';
  return {
    slug: tag.match(/href="\/work\/([^"]+)"/)?.[1] ?? null,
    color: wrap.match(/--project-color:\s*(#[0-9a-fA-F]{6})/)?.[1] ?? null,
  };
}

// In-page recorder, armed before the click: every change to the staged
// cards, the scale pager's strip position, the <html> accent and the passage
// fill's opacity (to 0.01), as it happens (a MutationObserver — the main
// thread is too busy building /work for a polling probe to see the arrival).
// window survives the soft nav.
const armRecorder = () => {
  const log = (window.__enterLog = []);
  const t0 = performance.now();
  const last = {};
  const note = (k, v) => {
    if (last[k] === v) return;
    last[k] = v;
    log.push({ ms: Math.round(performance.now() - t0), [k]: v });
  };
  const op = (sel) => {
    const el = document.querySelector(sel);
    return el ? Math.round(parseFloat(getComputedStyle(el).opacity) * 100) / 100 : null;
  };
  const check = () => {
    note('cta', op('.hero__lead-col')); // the Enter World chrome (null once home unmounts)
    note('loader', op('.route-fill__loader'));
    note(
      'cards',
      [...document.querySelectorAll('.fp-card-wrap')]
        .map((c) => `${c.dataset.phase}:${(c.querySelector('.fp-card__cta')?.getAttribute('href') ?? '').slice(6)}`)
        .join(' ')
    );
    note('qf', document.querySelector('.fp-scale')?.style.getPropertyValue('--scale-qf') || null);
    note('accent', getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim());
    const fill = document.querySelector('.route-fill');
    note('fill', fill ? Math.round(parseFloat(getComputedStyle(fill).opacity) * 100) / 100 : null);
  };
  new MutationObserver(check).observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'data-phase'],
  });
  const frame = () => {
    check();
    if (performance.now() - t0 < 12000) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

// /work as the page holds it: the staged cards (an 'exit' one = a Turn), the
// entered card's slug, the scale pager's strip position, the <html> accent,
// the active index FeaturedProjects persists, the handoff key.
const readWork = () => {
  const cards = [...document.querySelectorAll('.fp-card-wrap')];
  const enter = cards.find((c) => c.dataset.phase === 'enter');
  const href = enter?.querySelector('.fp-card__cta')?.getAttribute('href') ?? '';
  const qf = parseFloat(document.querySelector('.fp-scale')?.style.getPropertyValue('--scale-qf'));
  let key = null;
  let index = NaN;
  try {
    key = sessionStorage.getItem('swm:enterWorld');
    index = parseInt(sessionStorage.getItem('swm:worldIndex') ?? '', 10);
  } catch {}
  return {
    path: location.pathname,
    cards: cards.length,
    exits: cards.filter((c) => c.dataset.phase === 'exit').length,
    slug: href.startsWith('/work/') ? href.slice(6) : null,
    qf: Number.isFinite(qf) ? qf : null,
    index: Number.isFinite(index) ? index : null,
    accent: getComputedStyle(document.documentElement).getPropertyValue('--project-color').trim(),
    key,
  };
};

/** --enter: Enter World on a world other than /work's first, the /work
 *  arrival recorded as it happens, then its enter_world and the breadcrumb. */
async function enterScenario(page) {
  const out = { first: await firstWork() };
  // …and a colour of its own, so the accent gate can tell them apart.
  const own = (s) =>
    s?.slug && s.slug !== out.first.slug && (s.color || '').toLowerCase() !== (out.first.color || '').toLowerCase();
  for (let i = 0; i < 6; i += 1) {
    await holdRoom(page);
    const s = await page.evaluate(() => window.__swmPopStats);
    if (own(s)) break;
    await pressNext(page);
    await page
      .waitForFunction((from) => window.__swmPopStats?.step !== from, s?.step, { timeout: 15000, polling: 100 })
      .catch(() => {});
  }
  await holdRoom(page);
  out.want = await page.evaluate(() => {
    const s = window.__swmPopStats;
    return { slug: s?.slug ?? null, world: s?.world ?? null, color: s?.color ?? null };
  });
  await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove());
  // ⏭ opened the bench; on phones it sits over the Enter World CTA.
  const collapse = page.locator('.hero-tune--pop button[aria-label="Collapse"]');
  if (MOBILE && (await collapse.count())) await collapse.first().click();
  await page.evaluate(armRecorder);
  const t0 = Date.now();
  await page.locator('.hero__enter').first().click();
  out.held = await page
    .waitForFunction(() => window.__swmPopStats?.held, null, { timeout: 3000, polling: 50 })
    .then(() => true, () => false);
  await page.waitForFunction(() => location.pathname === '/work', null, { timeout: 20000, polling: 50 });
  out.navMs = Date.now() - t0;
  await sleep(4000); // the build, the fill's release, the card's boot
  out.log = await page.evaluate(() => window.__enterLog);
  out.landed = await page.evaluate(readWork);
  await shot(page, 'enter-work');
  try {
    await page.locator('.fp-card-wrap[data-phase="enter"] .fp-card__cta').first().click();
    await page.waitForFunction((slug) => location.pathname === `/work/${slug}`, out.landed.slug, { timeout: 20000, polling: 100 });
    await page.waitForSelector('.detail-breadcrumb', { state: 'visible', timeout: 20000 });
    await sleep(1500);
    await page.evaluate(armRecorder);
    await page.locator('.detail-breadcrumb').first().click();
    await page.waitForFunction(() => location.pathname === '/work', null, { timeout: 20000, polling: 50 });
    await sleep(2500); // the restore's snap (10-06) lands
    out.backLog = await page.evaluate(() => window.__enterLog);
    out.back = await page.evaluate(readWork);
    await shot(page, 'enter-back');
  } catch (e) {
    out.backError = String(e).slice(0, 300);
  }
  return out;
}

/* ── The video diet's loop watch (P0) ──────────────────────────────────────
   Installed before any page script (addInitScript) and kept across soft
   navigations, so it sees every <video> from its first timeupdate. One
   session per element per source: the highest currentTime it reached, where
   each backward jump of more than a second started (netReport counts one
   from the loop point as a wrap), whether it fired `ended`, and the longest
   it sat playing but frozen within endS of its end (hls.js's stalled end of
   stream), sampled every sampleMs. Its id is the pool slot's
   data-playback-id, else the Mux id in its poster, else the one in its
   slot's poster <img> (the directory's player carries no poster of its
   own). The listeners capture on the document: media events do not bubble,
   and the capture phase runs before the element's own handlers (the pool's
   seek-back). */
const LOOP_WATCH = ({ sampleMs, endS }) => {
  const sessions = (window.__swmLoops = []);
  const live = new WeakMap(); // element → its current session
  const muxIn = (url) => /image\.mux\.com\/([^/?]+)/.exec(url || '')?.[1];
  const idOf = (v) =>
    v.dataset.playbackId || muxIn(v.poster) || muxIn(v.closest('.media-slot')?.querySelector(':scope > img')?.getAttribute('src')) || null;
  const sessionOf = (v) => {
    let s = live.get(v);
    if (!s || s.src !== v.currentSrc) {
      s = {
        id: idOf(v),
        pooled: !!v.dataset.playbackId,
        route: location.pathname,
        src: v.currentSrc,
        n: 0,
        maxT: 0,
        jumps: [],
        ended: 0,
        lastT: 0,
        lastSampleT: -1,
        stillMs: 0,
        maxStillMs: 0,
        dur: null,
      };
      live.set(v, s);
      sessions.push(s);
    }
    return s;
  };
  document.addEventListener(
    'timeupdate',
    (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      const s = sessionOf(v);
      const t = v.currentTime;
      if (t < s.lastT - 1) s.jumps.push(Math.round(s.lastT * 1000) / 1000);
      s.lastT = t;
      s.n += 1;
      s.maxT = Math.max(s.maxT, t);
      if (Number.isFinite(v.duration)) s.dur = Math.round(v.duration * 1000) / 1000;
    },
    true
  );
  document.addEventListener(
    'ended',
    (e) => {
      if (e.target instanceof HTMLVideoElement) sessionOf(e.target).ended += 1;
    },
    true
  );
  setInterval(() => {
    for (const v of document.querySelectorAll('video')) {
      const s = live.get(v);
      if (!s || s.src !== v.currentSrc) continue;
      const t = v.currentTime;
      const atEnd = !v.paused && !v.seeking && Number.isFinite(v.duration) && t >= v.duration - endS;
      s.stillMs = atEnd && t === s.lastSampleT ? s.stillMs + sampleMs : 0;
      s.maxStillMs = Math.max(s.maxStillMs, s.stillMs);
      s.lastSampleT = t;
    }
  }, sampleMs);
};

/** --detail: the page top to bottom. Hold at the top for two capped loops (the
 *  hero and the first rows wrap at least once), step down most of a viewport
 *  at a time, each step held STEP_MS so the slots it reveals start their
 *  streams, then hold at the bottom (the last rows and NextProjectBand) as
 *  long. Scrolling only: the band commits on a wheel or touch gesture or a
 *  click, never on window.scrollTo. With --hold=PREFIX it then centres the
 *  first <video> whose Mux id starts with PREFIX and holds it two capped
 *  loops more, so that video wraps at its window at least once (heldWrap). */
async function detailScenario(page) {
  await page.waitForSelector('.media-slot', { timeout: 30000 });
  const hold = 2 * DETAIL_MAX_SECONDS * 1000;
  await sleep(hold);
  let steps = 0;
  while (steps < 200) {
    const done = await page.evaluate(() => {
      const end = document.documentElement.scrollHeight - innerHeight;
      if (scrollY >= end - 2) return true;
      window.scrollTo(0, Math.min(end, scrollY + 0.8 * innerHeight));
      return false;
    });
    if (done) break;
    steps += 1;
    await sleep(STEP_MS);
  }
  await sleep(hold);
  const seen = await page.evaluate((n) => {
    // LOOP_WATCH's id: a detail slot's <video> carries no poster of its own since
    // the poster-first face (its slot's poster <img> names it).
    const muxIn = (url) => /image\.mux\.com\/([^/?]+)/.exec(url || '')?.[1];
    const idOf = (v) =>
      v.dataset.playbackId || muxIn(v.poster) || muxIn(v.closest('.media-slot')?.querySelector(':scope > img')?.getAttribute('src')) || null;
    return {
      route: location.pathname,
      steps: n,
      ids: [...new Set([...document.querySelectorAll('video')].map(idOf).filter(Boolean))],
    };
  }, steps);
  if (!HOLD) return seen;
  // LOOP_WATCH's id (a pool slot's data-playback-id, else the Mux id in the
  // poster, else the one in its slot's poster <img>), so heldWrap reads the
  // same sessions.
  const held = await page.evaluate((prefix) => {
    const muxIn = (url) => /image\.mux\.com\/([^/?]+)/.exec(url || '')?.[1];
    const idOf = (v) =>
      v.dataset.playbackId || muxIn(v.poster) || muxIn(v.closest('.media-slot')?.querySelector(':scope > img')?.getAttribute('src')) || null;
    const v = [...document.querySelectorAll('video')].find((x) => (idOf(x) || '').startsWith(prefix));
    if (!v) return { prefix, id: null };
    v.scrollIntoView({ block: 'center' });
    return { prefix, id: idOf(v) };
  }, HOLD);
  if (held.id) await sleep(hold + STEP_MS);
  return { ...seen, held };
}

/** --directory: the Project Directory. Hold two preview windows at the top
 *  (the first rows' players wrap at least once), take DIR_SLOW steps of most
 *  of a viewport, each held STEP_MS (past the gate's dwell and a stream's
 *  start), fling DIR_FLING steps FLING_MS apart, then hold two windows more.
 *  A step turns back at either end of the page. In the page, a sampler
 *  counts the live players every LOOP_SAMPLE_MS; each hold's end snapshots
 *  the video tiles in view: half in view by the gate's rule, playing, and
 *  their posters shown. Masters are timed off the page's requests, for
 *  flingDwell. */
async function directoryScenario(page) {
  await page.waitForSelector('.dir-page:not([data-pending])', { timeout: 30000 });
  const masters = []; // { t, id }: every master the page asked for, and when
  const onRequest = (r) => {
    if (netBucket(r.url()) === 'mux-master') masters.push({ t: Date.now(), id: masterId(r.url()) });
  };
  page.on('request', onRequest);
  await page.evaluate((sampleMs) => {
    const s = (window.__swmDirPlayers = { samples: 0, live: 0, max: 0 });
    setInterval(() => {
      const n = document.querySelectorAll('.dir-flow video').length;
      s.samples += 1;
      if (n) s.live += 1;
      s.max = Math.max(s.max, n);
    }, sampleMs);
  }, LOOP_SAMPLE_MS);
  const holds = [];
  const snap = async (label) =>
    holds.push(
      await page.evaluate((label) => {
        const vh = innerHeight;
        const out = { label, y: Math.round(scrollY), players: document.querySelectorAll('.dir-flow video').length, tiles: [] };
        for (const slot of document.querySelectorAll('.dir-tile .media-slot')) {
          // a video tile's poster is the slot's own <img> (GatedVideo carries none)
          const img = slot.querySelector(':scope > img');
          const id = /image\.mux\.com\/([^/?]+)/.exec(img?.getAttribute('src') || '')?.[1];
          if (!id) continue;
          const r = slot.getBoundingClientRect();
          const vis = Math.min(r.bottom, vh) - Math.max(r.top, 0);
          if (vis <= 0) continue;
          out.tiles.push({
            id,
            // the gate's half (half the tile or half the viewport, whichever comes first), clear of its 5% steps
            half: vis >= Math.min(r.height, vh) / 2 + Math.max(4, 0.05 * r.height),
            playing: !!slot.querySelector('video'),
            poster: img.complete && img.naturalWidth > 0,
          });
        }
        return out;
      }, label)
    );
  let heading = 1;
  const step = async () => {
    const r = await page.evaluate((d) => {
      const end = document.documentElement.scrollHeight - innerHeight;
      if (end < 2) return { moved: false, d };
      if ((d > 0 && scrollY >= end - 2) || (d < 0 && scrollY <= 2)) d = -d;
      window.scrollTo(0, Math.max(0, Math.min(end, scrollY + d * 0.8 * innerHeight)));
      return { moved: true, d };
    }, heading);
    heading = r.d;
    return r.moved;
  };
  const hold = 2 * PREVIEW_SECONDS * 1000;
  await sleep(hold);
  await snap('top');
  let slow = 0;
  for (let i = 1; i <= DIR_SLOW; i++) {
    if (await step()) slow += 1;
    await sleep(STEP_MS);
    await snap(`step ${i}`);
  }
  const fling = { steps: 0, t0: Date.now() };
  for (let i = 0; i < DIR_FLING; i++) {
    if (await step()) fling.steps += 1;
    await sleep(FLING_MS);
  }
  fling.t1 = Date.now();
  await sleep(hold);
  await snap('end');
  page.off('request', onRequest);
  return {
    route: await page.evaluate(() => location.pathname),
    slow,
    fling: {
      steps: fling.steps,
      ms: fling.t1 - fling.t0,
      masters: masters.filter((m) => m.t >= fling.t0 + DIR_DWELL_MS && m.t <= fling.t1).map((m) => m.id),
    },
    players: await page.evaluate(() => window.__swmDirPlayers),
    holds,
  };
}

/** --directory on desktop: the keyboard, on a reload from the top. Tab from
 *  the page's start to the first tile, noting any focus inside [inert], then
 *  one Tab per link after it, flat out, under an in-page focusin recorder:
 *  each focus should be the next a.dir-tile in document order, through the
 *  last (11-03: Tab fell out of the mount window into the footer at link 131
 *  of 376, so every chunk renders its tiles' boxes). The rings are read as
 *  pixels, not computed style (11-03: the slot painted over the tiles' old
 *  inset outline): the first undimmed filter tag's outline band, and the
 *  inset ring (::after) of the first tile and of the one focus ends on,
 *  half-way down its part below the filter. --keyctl=escape|ring breaks
 *  each on purpose. */
async function directoryKeys(page) {
  await page.goto(URL_, { waitUntil: 'load' });
  await page.waitForSelector('.dir-page:not([data-pending])', { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await sleep(800);
  const escaped =
    KEYCTL === 'escape'
      ? await page.evaluate(() => {
          const ahead = [...document.querySelectorAll('.dir-grid')].slice(1);
          for (const g of ahead) g.inert = true;
          return ahead.length;
        })
      : null;
  if (KEYCTL === 'ring') {
    await page.addStyleTag({
      content:
        '.dir-tile:focus-visible::after { content: none !important; } ' +
        '.dir-tile:focus-visible { outline: 2px solid var(--color-cream) !important; outline-offset: -2px !important; }',
    });
  }
  await page.evaluate(() => document.activeElement?.blur());
  const focused = () =>
    page.evaluate(() => {
      const a = document.activeElement;
      const tiles = document.querySelectorAll('a.dir-tile');
      const index = Array.prototype.indexOf.call(tiles, a);
      const r = a.getBoundingClientRect();
      // a tile's ring is its ::after border, inset; everything else wears the house outline
      const cs = getComputedStyle(a, index >= 0 ? '::after' : null);
      const width = parseFloat(index >= 0 ? cs.borderLeftWidth : cs.outlineWidth) || 0;
      return {
        el: `${a.tagName.toLowerCase()}.${typeof a.className === 'string' ? a.className.split(' ')[0] : ''}`,
        index,
        links: tiles.length,
        tag: a.classList.contains('filter-tag'),
        dim: a.hasAttribute('data-dim'),
        inert: !!a.closest('[inert]'),
        rect: { left: r.left, top: r.top, bottom: r.bottom },
        filterBottom: document.querySelector('.dir-filter').getBoundingClientRect().bottom,
        ring: {
          color: index >= 0 ? cs.borderLeftColor : cs.outlineColor,
          width,
          offset: index >= 0 ? -width : parseFloat(cs.outlineOffset) || 0,
        },
      };
    });
  // The focused element's ring band, half-way down its part on screen (a tile's: below the filter).
  const ring = async () => {
    await sleep(300);
    const d = await focused();
    const x = Math.floor(d.rect.left - d.ring.offset - d.ring.width / 2);
    const top = Math.max(d.rect.top, d.index >= 0 ? d.filterBottom : 0, 0);
    const y = Math.floor((top + Math.min(d.rect.bottom, VH)) / 2);
    const want = d.ring.color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const got = await pixel(page, x, y);
    return { el: d.el, index: d.index, x, y, want, got, ok: d.ring.width > 0 && got.every((v, i) => Math.abs(v - want[i]) <= 24) };
  };
  const fromTop = [];
  const rings = [];
  let inertFocused = 0;
  let first = null;
  for (let i = 0; i < 60 && !first; i++) {
    await page.keyboard.press('Tab');
    const d = await focused();
    fromTop.push(d.el);
    if (d.inert) inertFocused += 1;
    if (d.tag && !d.dim && !rings.length) rings.push(await ring());
    if (d.index >= 0) {
      first = d;
      rings.push(await ring());
    }
  }
  const links = first?.links ?? (await page.evaluate(() => document.querySelectorAll('a.dir-tile').length));
  let walk = null;
  if (first) {
    // each focus: its link's index, or what took it instead
    await page.evaluate(() => {
      const log = (window.__swmKeyWalk = []);
      document.addEventListener('focusin', (e) => {
        const i = Array.prototype.indexOf.call(document.querySelectorAll('a.dir-tile'), e.target);
        log.push(i >= 0 ? i : `${e.target.tagName.toLowerCase()}.${String(e.target.className).split(' ')[0]}`);
      });
    });
    const presses = links - 1 - first.index;
    for (let i = 0; i < presses; i++) await page.keyboard.press('Tab');
    const log = await page.evaluate(() => window.__swmKeyWalk);
    const miss = log.findIndex((f, k) => f !== first.index + 1 + k);
    walk = { presses, focuses: log.length, miss: miss < 0 ? null : { at: miss, took: log[miss] }, last: log.length ? log.at(-1) : first.index };
    rings.push(await ring());
  }
  return {
    links,
    escaped,
    fromTop,
    inertFocused,
    firstIndex: first ? first.index : null,
    walk,
    rings,
    reach: !!first && first.index === 0 && inertFocused === 0 && walk.focuses === walk.presses && !walk.miss && walk.last === links - 1,
    // the tag's ring when an undimmed tag took focus; both tiles' whenever there are links
    ringsOk: rings.length > 0 && rings.every((r) => r.ok) && (!first || rings.filter((r) => r.index >= 0).length === 2),
  };
}

/* ── --footer: the MOBILE HOME resting footer's reveal ─────────────────────
   The first scenario in this probe that GESTURES. Everything the footer round
   claims is geometry under a finger, and nothing in the repo could move a
   finger — so every number in the design round was arithmetic off static CSS.
   This drives a real touch scrub through CDP Input.dispatchTouchEvent and
   MEASURES, so the gates assert observed pixels, not derivations.

   Installed BEFORE any page script (addInitScript): a rAF watcher that records
   the blurb's state on every frame it CHANGES, from the very first frame the
   document has. That is the only way to see whether the on-load entrance ran
   at all — the bug it exists to catch is a threshold the resting pose never
   crosses, which looks identical to "no animation" once it has settled. */
const FOOTER_WATCH = () => {
  const log = [];
  let frames = 0;
  const read = () => {
    const blurb = document.querySelector('.site-footer__blurb');
    if (blurb) {
      const cs = getComputedStyle(blurb);
      const words = blurb.querySelectorAll('.site-footer__blurb-word');
      let wordMax = null;
      if (words.length) {
        wordMax = 0;
        for (const w of words) {
          wordMax = Math.max(wordMax, parseFloat(getComputedStyle(w).opacity) || 0);
        }
      }
      const drawn = cs.display !== 'none' && cs.visibility !== 'hidden';
      // What the eye gets: the paragraph's own alpha times its brightest word.
      const ink = drawn
        ? (parseFloat(cs.opacity) || 0) * (wordMax == null ? 1 : wordMax)
        : 0;
      const row = {
        t: Math.round(performance.now()),
        drawn,
        opacity: Math.round((parseFloat(cs.opacity) || 0) * 1e4) / 1e4,
        words: words.length,
        wordMax: wordMax == null ? null : Math.round(wordMax * 1e4) / 1e4,
        ink: Math.round(ink * 1e4) / 1e4,
        ground: document.documentElement.hasAttribute('data-footer-in'),
        rest: document.documentElement.hasAttribute('data-footer-rest'),
      };
      const prev = log[log.length - 1];
      if (
        !prev ||
        prev.ink !== row.ink ||
        prev.drawn !== row.drawn ||
        prev.ground !== row.ground ||
        prev.rest !== row.rest
      ) {
        log.push(row);
      }
    }
    if (++frames < 420) requestAnimationFrame(read);
  };
  window.__swmFooterWatch = log;
  requestAnimationFrame(read);
};

/** One measurement of everything the reveal moves. `translate` is a real CSS
 *  property, so its COMPUTED value is already resolved to px — that is how the
 *  lift is read as a number instead of re-deriving it from a calc. */
const footerRead = (page) =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const v = (k) => {
      const n = parseFloat(cs.getPropertyValue(k));
      return Number.isFinite(n) ? n : null;
    };
    const el = (sel) => document.querySelector(sel);
    const top = (sel) => {
      const e = el(sel);
      return e ? Math.round(e.getBoundingClientRect().top * 100) / 100 : null;
    };
    const opacity = (sel) => {
      const e = el(sel);
      return e ? Math.round((parseFloat(getComputedStyle(e).opacity) || 0) * 1e4) / 1e4 : null;
    };
    /* The resting variant's TYPE, measured rather than asserted. Nothing else
       in the harness gated the thing this round is actually about — that the
       blurb fills its measure on exactly one line above the floor's crossover
       and wraps below it — so every claim about it needed a throwaway probe.
       lines is height/line-height, which is exact here because the blurb is
       one paragraph of inline word spans with no mixed leading. */
    const typeOf = (sel) => {
      const e = el(sel);
      if (!e) return null;
      const c = getComputedStyle(e);
      const size = parseFloat(c.fontSize) || 0;
      const lh = parseFloat(c.lineHeight) || 0;
      const r = e.getBoundingClientRect();
      return {
        size: Math.round(size * 100) / 100,
        lines: lh ? Math.round(r.height / lh) : null,
        width: Math.round(r.width * 100) / 100,
        overflow: Math.max(0, Math.round(e.scrollWidth - e.clientWidth)),
      };
    };
    // translate: "none" | "<x>" | "<x> <y>" — the y is the lift (negative up).
    const liftOf = (sel) => {
      const e = el(sel);
      if (!e) return null;
      const t = getComputedStyle(e).translate;
      if (!t || t === 'none') return 0;
      const parts = t.trim().split(/\s+/);
      const y = parts.length > 1 ? parseFloat(parts[1]) : 0;
      return Number.isFinite(y) ? -Math.round(y * 100) / 100 : 0; // up = positive
    };
    return {
      reveal: v('--footer-reveal'),
      peak: v('--footer-peak'),
      rise: v('--footer-rise'),
      risePeak: v('--footer-rise-peak'),
      // The band's rise after the minimum-fade clock, and the session latch it
      // feeds. bandP BELOW risePeak means the fade is still running.
      bandP: v('--footer-band-p'),
      seen: document.documentElement.hasAttribute('data-footer-seen'),
      // The measured divisor of the one-line fill, and what it produced.
      blurbEm: v('--footer-blurb-em'),
      blurbType: typeOf('.site-footer__blurb'),
      leadType: typeOf('.logo-ticker__copy'),
      span: v('--footer-span'),
      panelH: v('--footer-panel-h'),
      panelTop: top('.site-footer--links'),
      // The on-load slide. `slide` is the live armed distance (null once the
      // tween lands and removes the property); panelLift is the panel's OWN
      // translate, negative while it is still parked below its rest pose. Both
      // are null/0 under the default --intro=replay — see footerScenario.
      slide: v('--footer-slide'),
      panelLift: liftOf('.site-footer--links'),
      globeLift: liftOf('.hero__globe'),
      strokeLift: liftOf('.hero__globe-stroke'),
      leadLift: liftOf('.hero__lead-col'),
      globeTop: top('.hero__globe'),
      strokeTop: top('.hero__globe-stroke'),
      ctaTop: top('.hero__enter'),
      rollTop: top('.logo-ticker__roll'),
      rollOpacity: opacity('.logo-ticker__roll'),
      bandOpacity: opacity('.logo-ticker'),
      strokeTransform: el('.hero__globe-stroke')
        ? getComputedStyle(el('.hero__globe-stroke')).transform
        : null,
      leadTransform: el('.hero__lead-col')
        ? getComputedStyle(el('.hero__lead-col')).transform
        : null,
    };
  });

/** A real finger. CDP touch events, because Playwright's touchscreen can tap
 *  but not drag, and Hero's reveal reads the delta BETWEEN touchmoves. */
async function touchScrub(cdp, page, { x, from, to, steps }) {
  const pt = (y) => [{ x, y, radiusX: 2, radiusY: 2, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(from) });
  const trail = [];
  for (let i = 1; i <= steps; i++) {
    const y = from + ((to - from) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y) });
    trail.push(await footerRead(page));
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  return trail;
}

async function footerScenario(page, ctx) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.setIgnoreInputEvents', { ignore: false }).catch(() => {});
  // Past the chrome beat (0.78 × the arrive/replay settle) and the entrance.
  // 10-08: raised 3200 → 4000. The arithmetic, so the next change can check
  // it: beat 2.2 × 0.78 = 1.716s, then the entrance's last word lands at
  // STAGGER_DELAY_S 0.25 + slideLead 0.12 + budget 0.45 + stagger span 0.45 =
  // 1.27s, i.e. 2.99s, and the panel's own rise lands at beat + ?footerslides
  // 0.7 = 2.42s. At 3200 the margin was 214ms, and this scenario reads
  // panelTop to derive panelClimb and gate liftRatio to ±0.03 — so an
  // entrance that ran a frame long would be measured MID-SLIDE and fail
  // liftRatio with no hint why. 4000 leaves a full second.
  //
  // READ THIS BEFORE TRUSTING A SLIDE NUMBER FROM HERE. This scenario loads
  // with ?intro=replay (the INTRO default), and the slide is armed only on
  // Hero's introMode === 'full'. So in a default run `slide` is null and
  // `panelLift` is 0 — the rise is NOT under test and the margin above is
  // slack, not proof. To measure the entrance proper, pass --intro=full; then
  // the first read must come after 2.42s or it lands mid-rise.
  await sleep(4000);
  const x = Math.round(VW / 2);
  const rest = await footerRead(page);
  await shot(page, 'footer-rest');

  // UP — the reveal. 120px of finger × the pinned ?touchgain=2 (URL_) ÷ SCROLL_TRIGGER_HOME_PX
  // 500 = 0.48 of progress, which clears the 1.0 clamp from the 0.59 floor
  // (1.07, so the clamp absorbs the last 0.07) and the scrub ENDS at a full
  // reveal rather than at a number that depends on the gain. The re-bake
  // 0.62 -> 0.59 on 10-08 spent 0.03 of that margin; a floor below ~0.52
  // would need a longer finger. The step SIZE is the other half of the point:
  // 32 steps advance ~0.04 of rise each, and these samples are the resolution
  // of every number below. At 16 steps the fold crossing read 0.12 of rise too
  // high — a derived default is only as good as the grid it was read off.
  const up = await touchScrub(cdp, page, { x, from: 320, to: 200, steps: 32 });
  await sleep(1000); // the release carry settles
  const full = await footerRead(page);
  await shot(page, 'footer-full');

  // DOWN — the retreat. The marks must HOLD (they ride the PEAK rise), which
  // is the one thing a live-progress window gets wrong, in full view.
  // The roll is on screen for only the top ~0.6 of the retreat: 220px over
  // 16 steps sampled that window 3 times, which is not enough to call a hold.
  const down = await touchScrub(cdp, page, { x, from: 180, to: 300, steps: 24 });
  const afterRetreat = await footerRead(page);
  await shot(page, 'footer-parked');
  await sleep(1200);
  const parked = await footerRead(page);

  const watch = await page.evaluate(() => window.__swmFooterWatch || []);
  return { rest, up, full, down, afterRetreat, parked, watch };
}

/** The gates, from the measurements above. */
function footerPass(f) {
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  const { rest, full, up, down } = f;
  // The panel's own climb and the hero's lift, both MEASURED.
  const climb = rest.panelTop != null && full.panelTop != null ? rest.panelTop - full.panelTop : null;
  const lift = full.globeLift;
  const ratio = climb ? lift / climb : null;
  f.measured = {
    panelH: full.panelH,
    panelClimb: climb == null ? null : Math.round(climb * 100) / 100,
    heroLift: lift,
    liftRatio: ratio == null ? null : Math.round(ratio * 1e4) / 1e4,
    liftKExpected: LIFT_K_EXPECT,
    ctaRide: rest.ctaTop != null && full.ctaTop != null ? Math.round((rest.ctaTop - full.ctaTop) * 100) / 100 : null,
    strokeRide:
      rest.strokeTop != null && full.strokeTop != null
        ? Math.round((rest.strokeTop - full.strokeTop) * 100) / 100
        : null,
    fold: VH,
  };
  // The marks' arrival: the first scrub step at which the roll is fully in,
  // and the roll's top edge there. The fade must COMPLETE on screen — a
  // window that finishes below the fold spends the whole arrival unseen.
  const arrival = up.find((s) => (s.rollOpacity ?? 0) >= 0.99);
  f.measured.marksFullAtRise = arrival ? arrival.rise : null;
  f.measured.marksFullAtRollTop = arrival ? arrival.rollTop : null;
  // Where the roll's top edge crosses the fold, in rise — the number the
  // ?footermarksfrom default IS, so it has to be better than "the first
  // sample that happened to be above the fold". INTERPOLATED across the
  // straddling pair; the trail is linear in rise, so both brackets agree.
  const ci = up.findIndex((s) => s.rollTop != null && s.rollTop < VH);
  const above = ci >= 0 ? up[ci] : null;
  const below = ci > 0 ? up[ci - 1] : null;
  const crossRise =
    below && above && below.rollTop > above.rollTop
      ? below.rise +
        ((below.rollTop - VH) / (below.rollTop - above.rollTop)) * (above.rise - below.rise)
      : above
        ? above.rise
        : null;
  f.measured.marksFoldCrossRise = crossRise == null ? null : Math.round(crossRise * 1e4) / 1e4;
  f.measured.marksFoldCrossBracket = below && above ? [below.rise, above.rise] : null;
  f.measured.marksFromExpected = MARKS_FROM_EXPECT;
  // The retreat, on screen only: off-screen the exit is masked by the panel's
  // top edge, which is the whole point of the peak.
  const onScreen = down.filter((s) => s.rollTop != null && s.rollTop < VH - 1);
  const minHeld = onScreen.length ? Math.min(...onScreen.map((s) => s.rollOpacity ?? 0)) : null;
  f.measured.retreatOnScreenSteps = onScreen.length;
  f.measured.retreatMinRollOpacity = minHeld;
  // The entrance: the first frame the blurb was DRAWN under the variant must
  // not already be final, and it must reach full ink afterwards.
  const firstDrawn = f.watch.find((r) => r.rest && r.drawn);
  const maxInk = f.watch.length ? Math.max(...f.watch.map((r) => r.ink)) : null;
  f.measured.blurbFirstDrawn = firstDrawn || null;
  f.measured.blurbMaxInk = maxInk;
  return {
    // the panel parks at ?footerrest, and the normalized rise is 0 there
    restFloor: near(rest.reveal, FOOTER_REST_EXPECT, 0.01) && near(rest.span, 1 - FOOTER_REST_EXPECT, 0.01),
    // THE --footer-reveal-vs-rise bug: a parallax off the raw var lifts the
    // globe a third of the way on the first paint
    liftZeroAtRest:
      near(rest.globeLift, 0, 0.5) && near(rest.strokeLift, 0, 0.5) && near(rest.leadLift, 0, 0.5),
    // "half the rate of the actual scroll", against the panel's own climb
    liftRatio: climb > 1 && near(ratio, LIFT_K_EXPECT, 0.03),
    // the button and the ring cannot drift from the globe
    ctaRidesGlobe: lift > 1 && near(f.measured.ctaRide, lift, 0.6),
    strokeRidesGlobe: lift > 1 && near(f.measured.strokeRide, lift, 0.6),
    // the driven mode publishes the panel height the lift denominates against
    panelHPublished: full.panelH != null && full.panelH > 1,
    // the arrival completes ABOVE the fold (this is what killed a clock-scrub
    // design: its tween finished at 846px against an 844px fold)
    marksArriveOnScreen: !!arrival && arrival.rollTop < VH,
    // the marks' fade BEGINS as their top edge touches the fold: none of it
    // is spent off-screen, and none of it is already spent when they appear.
    // ?footermarksfrom is the fixed point of this measurement, so the gate
    // holds the baked default and the CSS fallback to what the probe reads.
    marksFadeStartsAtFold: crossRise != null && near(crossRise, MARKS_FROM_EXPECT, 0.05),
    // the peak rule: no fade-out in full view on a downward gesture
    marksHoldOnRetreat: onScreen.length > 5 && minHeld >= 0.99,
    // the entrance genuinely RUNS — the gate that would have caught ask 3
    blurbNotFinalOnFirstFrame: !!firstDrawn && firstDrawn.ink < 0.5,
    blurbSettles: maxInk != null && maxInk >= 0.99,
  };
}

(async () => {
  await waitServer();
  const browser = await chromium.launch({
    headless: true,
    ...(CHANNEL ? { channel: CHANNEL } : {}),
    args: GPU === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [],
  });
  const ctx = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: DSF,
    hasTouch: MOBILE,
    isMobile: MOBILE,
    reducedMotion: RM ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const text = m.text();
    // the route it fired on (--enter visits /work and a detail page too)
    const at = new URL(page.url()).pathname;
    if (!NOISE.some((re) => re.test(text))) report.consoleErrors.push(`${m.type()} @${at}: ${text.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => report.pageErrors.push(String(e).slice(0, 400)));
  page.on('requestfailed', (r) => {
    if (r.resourceType() !== 'image') return;
    report.imageFailures.push(`${r.failure()?.errorText} @${new URL(page.url()).pathname}: ${r.url().slice(0, 160)}`);
  });
  // The video diet (P0): every Mux and Sanity request that ENDS, bucketed and
  // sized (sizes() = bytes on the wire), with the URL the page asked for
  // (before --noclip's route), the route that asked, and the URL it sent;
  // master and rendition playlist bodies are kept for netReport.
  const asked = new WeakMap();
  const net = { log: [], bodies: [], pending: [] };
  const dark = { seen: new Set(), list: [], measured: 0, failed: 0 }; // — P7 — report.darkThumbs
  page.on('request', (r) => asked.set(r, { url: r.url(), route: new URL(page.url()).pathname }));
  const onNetEnd = (failed) => (r) => {
    const bucket = netBucket(r.url());
    if (!bucket) return;
    const at = asked.get(r);
    const route = at?.route ?? new URL(page.url()).pathname;
    net.pending.push(
      (async () => {
        const sizes = failed ? null : await r.sizes().catch(() => null);
        const e = { route, bucket, asked: at?.url ?? r.url(), sent: r.url(), bytes: sizes?.responseBodySize ?? 0, ...(failed ? { failed: true } : {}) };
        net.log.push(e);
        if (!failed && (bucket === 'mux-master' || bucket === 'mux-playlist')) {
          const res = await r.response();
          net.bodies.push({ ...e, body: res ? await res.text().catch(() => '') : '' });
        }
        // — P7 — darkThumbs (report-only; Q12): each class texture home received, measured from the bytes the
        // page already has (no new request), on sharp's raw greyscale pixels (never .stats() after another op).
        const c = !failed && route === '/' && (bucket === 'mux-thumb' || bucket === 'sanity-image') ? classifyRequest(e.asked, GATE_CTX.t1, GATE_CTX.shapes) : null;
        if (c?.kind === 'class' && !dark.seen.has(e.asked)) {
          dark.seen.add(e.asked);
          try {
            const { data, info } = await sharp(await (await r.response()).body()).greyscale().raw().toBuffer({ resolveWithObject: true });
            dark.measured += 1;
            const d = darkThumb(data, info.channels);
            if (d) dark.list.push({ id: c.id, cls: c.shape, w: info.width, h: info.height, ...d });
          } catch {
            dark.failed += 1;
          }
        }
      })().catch(() => {}) // a request still in flight at close is dropped, never fatal
    );
  };
  const onNetFinished = onNetEnd(false);
  const onNetFailed = onNetEnd(true);
  page.on('requestfinished', onNetFinished);
  page.on('requestfailed', onNetFailed);
  // Stop logging (the loop watch's sessions first, while the page is up), wait
  // for every logged request's size and body, and judge.
  const finishNet = async () => {
    const sessions = await page
      .evaluate(() => (window.__swmLoops || []).map(({ src, lastT, lastSampleT, stillMs, ...s }) => s))
      .catch(() => []);
    page.off('requestfinished', onNetFinished);
    page.off('requestfailed', onNetFailed);
    await Promise.all(net.pending);
    return netReport(net.log, net.bodies, sessions, {
      preview: PREVIEW_SECONDS,
      detail: DETAIL_MAX_SECONDS,
      rm: RM || POSTERS_ONLY, // the floors' reason: nothing plays
      noclip: NOCLIP,
    });
  };
  // The entrance watcher must see the FIRST frame, so it is installed before
  // any page script runs.
  if (FOOTER) await page.addInitScript(FOOTER_WATCH);
  else {
    await page.addInitScript(LOOP_WATCH, { sampleMs: LOOP_SAMPLE_MS, endS: LOOP_END_S });
    // The video diet's negative control, registered in every run that judges
    // the diet (all but --footer) as a pass-through unless --noclip: any
    // page.route turns Playwright's HTTP cache off, so both arms of a
    // before/after measure the same cold cache. The page still ASKS for the
    // clip (report.net.log's `asked`); under --noclip Mux never sees it
    // (`sent`).
    await page.route(/stream\.mux\.com\/[^/?]+\.m3u8/, (route) => {
      if (!NOCLIP) return route.continue();
      const u = new URL(route.request().url());
      u.searchParams.delete('asset_end_time');
      return route.continue({ url: u.toString() });
    });
  }
  // Negative controls (docs/globe-worlds-plan.md § Media spans): unit windows off —
  // true = both writers (loadTile's bind hook and director.place), 'bind' = the bind hook only.
  if (NEGCTL === true || NEGCTL === 'bind') await page.addInitScript((v) => { globalThis.__swmNoUnitWindows = v; }, NEGCTL === 'bind' ? 'bind' : true);
  // 'pin': every master playlist decodes off its plan (270p; a 270p plan → 480p). The clip stays; report.net.log keeps the asked URL.
  if (NEGCTL === 'pin') {
    await page.route(/stream\.mux\.com\/[^/?]+\.m3u8/, (route) => {
      const u = new URL(route.request().url());
      const to = u.searchParams.get('max_resolution') === '270p' ? '480p' : '270p';
      u.searchParams.set('min_resolution', to);
      u.searchParams.set('max_resolution', to);
      return route.continue({ url: u.toString() });
    });
  }
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });

  // --detail: the detail page alone, judged by the video diet; no globe here.
  if (DETAIL) {
    report.detailPage = await detailScenario(page);
    const diet = await finishNet();
    await browser.close().catch(() => {});
    report.net = diet.net;
    const streamed = new Set(
      diet.net.log
        .filter((e) => e.bucket === 'mux-master' && !e.failed && e.route === report.detailPage.route)
        .map((e) => masterId(e.sent))
    );
    const held = report.detailPage.held?.id;
    const last = held ? diet.net.sessions.filter((s) => s.id === held).at(-1) : null;
    report.pass = {
      ...diet.pass,
      // the scroll reached every <video> on the page: each asked for a stream
      detailCovered: report.detailPage.ids.length > 0 && report.detailPage.ids.every((id) => streamed.has(id)),
      // console errors (a refused stream logs one) and page errors; a warning
      // stays listed in report.consoleErrors but is not gated here
      noErrors: !report.consoleErrors.some((m) => m.startsWith('error ')) && !report.pageErrors.length,
      // --hold: the held video wrapped at least once and never played past its window
      ...(HOLD ? { heldWrap: !!last && last.wraps >= 1 && !last.why } : {}),
    };
    console.log(JSON.stringify(report, null, 1));
    save();
    process.exit(Object.values(report.pass).some((v) => !v) ? 2 : 0);
  }

  // --directory: the directory alone, judged by the video diet and its player gate.
  if (DIRECTORY) {
    report.directory = await directoryScenario(page);
    const diet = await finishNet();
    // the keyboard on desktop, after the diet's log closes: a reload from the top
    if (!MOBILE) report.directory.keys = await directoryKeys(page);
    await browser.close().catch(() => {});
    report.net = diet.net;
    const d = report.directory;
    // the masters off the net log, which is armed before the page loads
    const masters = diet.net.log.filter((e) => e.bucket === 'mux-master' && e.route === d.route);
    const streamed = new Set(masters.filter((e) => !e.failed).map((e) => masterId(e.sent)));
    // every video tile half in view at a hold's end plays and asked for its stream, unless the players were at their cap
    const judged = d.holds.flatMap((h) => h.tiles.filter((t) => t.half).map((t) => ({ ...t, at: h.label, capFull: h.players >= DIR_CAP })));
    const uncovered = judged.filter((t) => !t.capFull && !(t.playing && streamed.has(t.id)));
    // the long holds' ends: every video tile in view shows its poster
    const posters = d.holds.filter((h) => h.label === 'top' || h.label === 'end').flatMap((h) => h.tiles);
    d.gates = {
      cap: DIR_CAP, dwellMs: DIR_DWELL_MS, judged: judged.length, uncovered: uncovered.slice(0, 5),
      postersInView: posters.length, postersShown: posters.filter((t) => t.poster).length,
    };
    report.pass = {
      ...diet.pass,
      ...(POSTERS_ONLY
        ? { posterOnly: masters.length === 0 && d.players.max === 0 && posters.length > 0 && posters.every((t) => t.poster) }
        : {
            directoryCovered: judged.length > 0 && uncovered.length === 0,
            playersCapped: d.players.live > 0 && d.players.max <= DIR_CAP,
            // a dwell under three fling steps lets a flung tile earn its grant: nothing to judge
            ...(DIR_DWELL_MS > 3 * FLING_MS ? { flingDwell: d.fling.steps > 0 && d.fling.masters.length === 0 } : {}),
          }),
      // the keyboard (desktop): Tab walks every link in order, and the rings show on screen
      ...(d.keys ? { ...(d.keys.links > 0 ? { tabReach: d.keys.reach } : {}), ringShows: d.keys.ringsOk } : {}),
      noErrors: !report.consoleErrors.some((m) => m.startsWith('error ')) && !report.pageErrors.length,
    };
    console.log(JSON.stringify(report, null, 1));
    save();
    process.exit(Object.values(report.pass).some((v) => !v) ? 2 : 0);
  }
  await page.waitForSelector('.video-globe__canvas canvas', { timeout: 30000 });

  // --footer short-circuits the population sampling loop entirely: it gates a
  // gesture, not the globe's clock, and the whole run is a few seconds.
  if (FOOTER) {
    report.footer = await footerScenario(page, ctx);
    report.canvas = await readCanvas(page);
    report.pass = {
      ...footerPass(report.footer),
      clean: !report.consoleErrors.length && !report.pageErrors.length,
    };
    report.measured = report.footer.measured;
    if (report.imageFailures.length) {
      console.error(
        `globe-probe: ${report.imageFailures.length} image request(s) failed, first: ${report.imageFailures[0]}\n` +
          "  a CORS block on cdn.sanity.io = this origin is off the Sanity project's allowlist (localhost:4321, :4322, :3333 are on it)"
      );
    }
    console.log(JSON.stringify(report, null, 1));
    save();
    await browser.close().catch(() => {});
    process.exit(Object.values(report.pass).some((v) => !v) ? 2 : 0);
  }

  const nextAt = new Set(Array.from({ length: NEXT }, (_, i) => Math.round(WARM + ((i + 1) * (SECS - WARM)) / (NEXT + 1))));
  for (let t = 1; t <= SECS; t++) {
    await sleep(1000);
    const stats = await page.evaluate(() => window.__swmPopStats ?? null);
    report.samples.push({ t, ...(stats || { none: true }), tint: await readTint(page) });
    if (t === WARM) await shot(page, 'warm');
    if (nextAt.has(t)) {
      const step = await page.evaluate(() => window.__swmPopStats?.step ?? null);
      const t0 = Date.now();
      if (await pressNext(page)) {
        const landedMs = await page
          .waitForFunction(
            (from) => {
              const s = window.__swmPopStats;
              return s && s.step !== from && s.phase === 'hold' && s.integrity >= 0.95;
            },
            step,
            { timeout: 15000, polling: 100 }
          )
          .then(
            () => Date.now() - t0,
            () => null
          );
        report.samples.push({ t, action: 'next', landedMs });
        await shot(page, `next-t${t}`);
      } else report.samples.push({ t, action: 'next — bench button missing', landedMs: null });
    }
  }

  // --paint: the gradient's horizon pixel (bottom centre) through one change.
  if (PAINT && MODE !== 'off' && !RM) {
    const room = () => {
      const s = window.__swmPopStats;
      return s?.phase === 'hold' && s.holdLeft >= 3;
    };
    const ready = await page.waitForFunction(room, null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
    await page.evaluate(() => document.querySelector('astro-dev-toolbar')?.remove()); // it sits on that pixel in dev
    const [x, y] = [Math.round(VW / 2), VH - 2];
    const before = await pixel(page, x, y);
    const series = [];
    if (ready && (await pressNext(page))) {
      const t0 = Date.now();
      while (Date.now() - t0 < 2600) series.push({ ms: Date.now() - t0, rgb: await pixel(page, x, y) });
    }
    const after = series.length ? series[series.length - 1].rgb : before;
    const far = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i]))) > 6;
    const between = new Set(series.filter((p) => far(p.rgb, before) && far(p.rgb, after)).map((p) => p.rgb.join(',')));
    report.paint = { at: [x, y], before, after, between: between.size, frames: series.length, series };
  }

  // The chrome wears the world once a change has fully landed (the accent's
  // 1.7 s fade included).
  if (MODE !== 'off') {
    const room = () => {
      const s = window.__swmPopStats;
      return s?.phase === 'hold' && s.holdLeft >= 3;
    };
    const ready = await page.waitForFunction(room, null, { timeout: 30000, polling: 100 }).then(() => true, () => false);
    if (ready) await sleep(2000);
    const want = await page.evaluate(() => window.__swmPopStats?.color ?? null);
    report.colour = { ready, want, ...(await readTint(page)) };
  } else report.colour = await readTint(page);
  report.canvas = await readCanvas(page);
  await shot(page, 'end');
  if (ENTER && MODE !== 'off') report.enter = await enterScenario(page);
  const diet = await finishNet();
  await browser.close();

  const stats = report.samples.filter((s) => s.phase);
  const warm = stats.filter((s) => s.t >= WARM);
  const holds = warm.filter((s) => s.phase === 'hold');
  // Flips between two hold samples of the same grouping — should never happen.
  const holdFlips = stats.slice(1).reduce((n, s, i) => {
    const prev = stats[i];
    const same = prev.phase === 'hold' && s.phase === 'hold' && prev.step === s.step && prev.seed === s.seed;
    return same ? n + (s.flips - prev.flips) : n;
  }, 0);
  const nexts = report.samples.filter((s) => s.action?.startsWith('next'));
  const steps = stats.map((s) => s.step);
  // Client-name strips (10-07). namePlaced is what the director MEASURED off
  // the live scene as it placed this world's strips (the band / facing /
  // quadrant contract); nameSlices is what each strip tile actually renders,
  // so two samples of the same world disagreeing means something moves them.
  const namesOn = stats.some((s) => s.nameStrips > 0);
  const placed = [...new Map(stats.filter((s) => s.namePlaced).map((s) => [s.namePlaced.step, s.namePlaced])).values()];
  // REGISTER: what each strip tile actually RENDERS (stats.nameSlices =
  // { lo, hi } of the strip after panelMaterial's pole-pinch centre-crop,
  // plus `w`, the slice it should be). This is the gate the "TOHOST" defect
  // needed: the texture, the span and the uv offsets were each dumped and
  // each correct, and the render still showed only the middle vK of every
  // slice, because the crop lands downstream of all of them. Tile k is in
  // register iff it renders [k·w, (k+1)·w] — full width (hi−lo = w, the
  // vK-independence the compensation buys) and in place (lo ≡ k·w, mod 1 for
  // band mode's repeat). Both errors are read AS A FRACTION OF THE SLICE,
  // because that is what legibility scales with and because the defect is
  // multiplicative: an uncompensated tile renders vK of its slice, so it is
  // off by (1−vK) — 30% at the |y| 0.72 placement that read "TOHOST", 37% at
  // the default band's edge (|y| 0.78 since 10-23; 48% at 0.65's 0.85). The tolerance is 5%: the director writes the window
  // one frame before the scroll applies it, and one frame of pinch travel
  // measured up to 1.3% of a slice on a 12 fps warm-up frame. The honest
  // limit of the gate: where vK is already ≈ 1 (a row near the equator) an
  // uncompensated tile is off by less than that and will not fire — correct,
  // since there it also renders ≥ 95% of its slice and the name reads.
  // Graded only while the tile is still a tile: below PINCH_FLOOR it is under
  // 40% of a band's width — far outside the latitude band it was placed in
  // (the default admits vK ≥ 0.63), a sliver nothing reads, and a place where
  // the pinch changes fast enough per frame to swamp the measurement. Band
  // mode makes this routine: a whole row carries the strip, so the outgoing
  // row is still carrying it while it dies at the pole.
  const SLICE_TOL = 0.05;
  const PINCH_FLOOR = 0.4;
  const sliceBad = [];
  let sliceSeen = 0;
  let sliceSkipped = 0;
  let sliceWidthErr = 0;
  let sliceRegErr = 0;
  const modErr = (d) => d - Math.round(d); // registration error, mod the strip
  for (const s of stats) {
    for (const [k, r] of Object.entries(s.nameSlices || {})) {
      if (!(r.vk >= PINCH_FLOOR)) {
        sliceSkipped += 1;
        continue;
      }
      sliceSeen += 1;
      const dW = (r.hi - r.lo) / r.w - 1;
      const dR = modErr(r.lo - Number(k) * r.w) / r.w;
      sliceWidthErr = Math.max(sliceWidthErr, Math.abs(dW));
      sliceRegErr = Math.max(sliceRegErr, Math.abs(dR));
      if (Math.abs(dW) > SLICE_TOL)
        sliceBad.push(`t${s.t} step${s.step} slice ${k}: renders ${((r.hi - r.lo) / r.w).toFixed(3)} of its slice`);
      else if (Math.abs(dR) > SLICE_TOL)
        sliceBad.push(`t${s.t} step${s.step} slice ${k}: lo ${r.lo} is ${dR.toFixed(3)} of a slice off ${(Number(k) * r.w).toFixed(4)}`);
    }
  }
  // Stillness is a gate about REST, so compare only two HOLD samples of the
  // same world (the quietHolds idiom). `step` alone isn't enough: it advances
  // when a change STARTS, and the tiles swap across the lay-in's spread, so a
  // transition sample can still hold the previous world's strip — and the
  // slices are keyed by index, so slice 1 of a span-4 strip (0.25) would be
  // compared with slice 1 of the next world's span-2 strip (0.5). In a hold
  // every strip is at rest: a row re-born inside one can never carry a strip
  // (pick() consumes the plan), so nothing binds between two hold samples.
  // Compared on the RENDERED range, not the uniforms — the uniforms now track
  // the row's pinch as it scrolls, and holding that range still as they do is
  // exactly the thing the ticker's removal was meant to buy.
  const uvMoved = [];
  let uvHeld = 0; // slice comparisons actually made — 0 would pass vacuously
  for (let i = 1; i < stats.length; i++) {
    const [a, b] = [stats[i - 1], stats[i]];
    if (!a.nameSlices || !b.nameSlices || a.step !== b.step || a.seed !== b.seed) continue;
    if (a.phase !== 'hold' || b.phase !== 'hold') continue;
    for (const k of Object.keys(b.nameSlices)) {
      if (!(k in a.nameSlices)) continue;
      if (!(a.nameSlices[k].vk >= PINCH_FLOOR) || !(b.nameSlices[k].vk >= PINCH_FLOOR)) continue;
      uvHeld += 1;
      // In slice units and MOD THE REPEAT (band mode's window wraps, so a
      // still strip can read 1.0103 then 0.0104), same tolerance as the
      // register gate: each sample carries its own frame of pinch travel,
      // while a ticker moved the window by whole slices between samples.
      const d = modErr(a.nameSlices[k].lo - b.nameSlices[k].lo) / b.nameSlices[k].w;
      if (Math.abs(d) <= SLICE_TOL) continue;
      uvMoved.push(`t${b.t} step${b.step} slice ${k}: ${a.nameSlices[k].lo} → ${b.nameSlices[k].lo}`);
    }
  }
  // Frames with name tiles actually drawn — see maxInkedNameY.
  const inked = stats.filter((s) => (s.nameTiles ?? 0) > 0);
  const names = {
    placements: placed.map(
      (p) => `${p.mode} span ${p.span} × ${p.tiles}t · ${p.quad ?? '—'}${p.relaxed ? ` (relaxed:${p.relaxed})` : ''}`
    ),
    // the band is the hard gate; |y| ≤ yLimit is "inside the middle ?popnameband"
    worstPlacedY: placed.length ? Math.max(...placed.map((p) => p.yMax ?? 0)) : null,
    yLimit: placed.length ? placed[0].yLimit : null,
    worstPlacedZ: placed.filter((p) => p.mode === 'region').length
      ? Math.min(...placed.filter((p) => p.mode === 'region').map((p) => p.zMin ?? -1))
      : null,
    zLimit: placed.length ? placed[0].zLimit : null,
    relaxed: placed.filter((p) => p.relaxed).length,
    maxNameTiles: stats.length ? Math.max(...stats.map((s) => s.nameTiles ?? 0)) : null,
    // live, as the strips travel with their rows out of the band — diagnostic
    maxLiveNameY: stats.length ? Math.max(...stats.map((s) => s.nameMaxY ?? 0)) : null,
    // THE LIVE BAND, read only off frames that actually have name tiles INKED.
    // worstPlacedY above reads the latitude at PLACEMENT time, which is how a
    // strip born against a latitude nobody had written passed every gate: the
    // placement log was honest about a number the globe had not yet posed. This
    // pair reads what is on screen, so it catches both that and a strip that
    // was legal at birth and drifted. nameTiles > 0 is the vacuity guard — an
    // all-media frame has no name latitude to be wrong about.
    inkedSamples: inked.length,
    maxInkedNameY: inked.length ? Math.max(...inked.map((s) => s.nameMaxY ?? 0)) : null,
    // the same number as the type sees it: 1 / pinch is the condensation factor
    worstInkedPinch: inked.length
      ? Math.round(Math.min(...inked.map((s) => Math.sqrt(Math.max(0, 1 - (s.nameMaxY ?? 0) ** 2)))) * 1e4) / 1e4
      : null,
    sliceSeen,
    sliceSkipped, // tiles below PINCH_FLOOR — a strip dying at the pole
    // worst of each, as a fraction of one slice, so a regression reads as a
    // number and not only a flipped boolean: ≤ 0.013 of a slice when the
    // pinch is compensated, 1−vK (0.30 at the "TOHOST" placement, 0.48 at the
    // band edge) when it is not
    worstSliceWidthErr: sliceSeen ? Math.round(sliceWidthErr * 1e4) / 1e4 : null,
    worstSliceRegErr: sliceSeen ? Math.round(sliceRegErr * 1e4) / 1e4 : null,
    sliceBad,
    uvHeld,
    uvMoved,
  };
  report.summary = {
    worlds: stats.reduce((seq, s) => (seq[seq.length - 1] === s.world ? seq : [...seq, s.world]), []),
    changes: steps.length ? Math.max(...steps) - Math.min(...steps) : 0,
    transitions: [...new Set(stats.filter((s) => s.phase === 'transition').map((s) => s.transition))],
    groupings: [...new Set(stats.map((s) => `${s.grouping.join(' + ')} [${s.pattern}]`))],
    minIntegrityInHolds: holds.length ? Math.min(...holds.map((s) => s.integrity)) : null,
    maxBlackAfterWarm: warm.length ? Math.max(...warm.map((s) => s.black)) : null,
    maxTextures: stats.length ? Math.max(...stats.map((s) => s.gpuTextures ?? s.textures)) : null,
    flips: stats.length ? stats[stats.length - 1].flips : null,
    holdFlips,
    nextLandedMs: nexts.map((s) => s.landedMs),
    // video: decodes vs the tiles they light (shared streams: tiles ≥ decodes)
    maxStreams: stats.length ? Math.max(...stats.map((s) => s.streams ?? 0)) : null,
    maxLiveTiles: stats.length ? Math.max(...stats.map((s) => s.liveTiles ?? 0)) : null,
    names,
    fps: warm.map((s) => s.fps),
  };
  const m = report.summary;
  const c = report.colour;
  // --enter, read off the recorder: never an outgoing card (no Turn staged),
  // once the wanted card is up no other, the pager never between stations
  // (no glide), the first World's accent never shown on the way in, the
  // passage fill fully up from the swap until the wanted card is, on the way
  // in and back (it lifts onto the entered World — under reduced motion too,
  // its instant cover since 10-06), and the loading bar only once the Enter
  // World chrome is out (never under RM).
  const e = report.enter;
  const enterPass = (() => {
    if (!e) return {};
    const want = ENTER_OFF ? e.first.slug : e.want?.slug;
    const log = e.log || [];
    const cards = log.filter((x) => 'cards' in x).map((x) => x.cards);
    const qfs = log.filter((x) => x.qf != null).map((x) => parseFloat(x.qf));
    const accents = log.filter((x) => 'accent' in x).map((x) => x.accent);
    // The cover is fully up when /work's first card appears and stays up
    // until the wanted card is the one on screen.
    const coverHeld = (rows, slug) => {
      const swapAt = rows.findIndex((x) => x.cards);
      const wantAt = rows.findIndex((x) => x.cards === `enter:${slug}`);
      let fillThen = null;
      let held = swapAt >= 0 && wantAt >= swapAt;
      rows.forEach((x, i) => {
        if (x.fill == null) return;
        if (i <= swapAt) fillThen = x.fill;
        else if (i < wantAt && x.fill < 0.99) held = false;
      });
      return held && fillThen != null && fillThen >= 0.99;
    };
    // The CTA chrome out (opacity 0) vs the loading bar's first visible frame.
    const ctaOut = log.find((x) => x.cta === 0);
    const loaderIn = log.find((x) => x.loader > 0);
    e.timing = { ctaOutMs: ctaOut?.ms ?? null, loaderInMs: loaderIn?.ms ?? null };
    const at = cards.indexOf(`enter:${want}`);
    const wantAccent = e.want?.color ? rgbOf(e.want.color) : null;
    const firstAccent = e.first.color ? rgbOf(e.first.color) : null;
    return {
      enterNonTrivial: ENTER_OFF || (!!want && want !== e.first.slug),
      enterLanded: e.landed?.slug === want,
      enterNoTurn: !cards.some((c) => c.includes('exit:')),
      enterSteady: at >= 0 && cards.slice(at).every((c) => c === `enter:${want}`),
      enterPagerJumps: qfs.every((q) => Math.abs(q - Math.round(q)) < 1e-3),
      enterPagerAt: e.landed?.qf != null && Math.round(e.landed.qf) === e.landed.index,
      enterAccent:
        ENTER_OFF ||
        !wantAccent ||
        (e.landed?.accent === wantAccent && (firstAccent === wantAccent || !accents.includes(firstAccent))),
      enterFillHeld: ENTER_OFF || coverHeld(log, want),
      enterLoaderAfterCta: RM ? !loaderIn : !!ctaOut && !!loaderIn && loaderIn.ms >= ctaOut.ms,
      enterKeyConsumed: e.landed?.key == null,
      returnRestored: e.back?.slug === e.landed?.slug,
      returnNoTurn: !(e.backLog || []).some((x) => 'cards' in x && x.cards.includes('exit:')),
      returnFillHeld: !!e.backLog && coverHeld(e.backLog, e.landed?.slug),
    };
  })();
  report.pass =
    MODE === 'off'
      ? { noStats: stats.length === 0, noTint: !c.popTint, clean: !report.consoleErrors.length && !report.pageErrors.length }
      : {
          integrity: m.minIntegrityInHolds != null && m.minIntegrityInHolds >= 0.95,
          noBlackAfterWarm: m.maxBlackAfterWarm === 0,
          texturesBounded: m.maxTextures != null && m.maxTextures <= TEX_BOUND,
          quietHolds: m.holdFlips === 0,
          nextLanded: m.nextLandedMs.every((ms) => ms != null),
          // the clock turns worlds by itself — beyond the ⏭ presses; under RM
          // only the presses move it (each one a cut)
          cycled: RM ? m.changes === nexts.length : m.changes > nexts.length,
          colour: c.ready && (c.want ? c.popTint && c.accent === rgbOf(c.want) : true),
          // the client-name strips: placed at all, never outside the latitude
          // band, a region strip wholly front-facing, every tile RENDERING its
          // own whole slice (namesSlice — the one that sees past the pole
          // pinch, which the other four cannot), and that render never moving
          // (the ticker is gone — tile k shows the k-th slice, for good)
          ...(namesOn
            ? {
                namesPlaced: !!names.placements.length && names.maxNameTiles > 0 && placed.every((p) => p.tiles > 0),
                namesInBand: !!placed.length && placed.every((p) => (p.yMax ?? 0) <= p.yLimit + 1e-4),
                // ...and the same, on screen rather than in the placement
                // log. Deliberately the SAME limit, with no allowance for the
                // row's poleward travel: a row's theta_c only ever increases,
                // so a southern strip drifts out of the band over its life and
                // an allowance generous enough to cover that (0.3 rad, one
                // world at the pitch) relaxes the limit to |y| 0.969 — which
                // is the original defect's own 0.9638, i.e. vacuous. Measured
                // travel is 8-10 deg per world and the rows are quantised to a
                // 30 deg pitch, so the southernmost admitted row (|y| 0.700)
                // ends its life at 0.814, inside the default 0.853 with room.
                // If this ever fires, a strip really is warping at a pole.
                namesLiveInBand: names.inkedSamples > 0 && names.maxInkedNameY <= (names.yLimit ?? 1) + 1e-4,
                namesFrontFacing: placed.every((p) => p.mode !== 'region' || (p.zMin ?? -1) >= p.zLimit - 1e-4),
                namesSlice: names.sliceSeen > 0 && names.sliceBad.length === 0,
                namesStill: names.uvHeld > 0 && names.uvMoved.length === 0,
              }
            : {}),
          ...(report.paint ? { gradientAnimates: report.paint.between >= 3 } : {}),
          ...enterPass,
          clean: !report.consoleErrors.length && !report.pageErrors.length,
        };
  // The video diet's gates (report.net.detail[gate] = { n, floor, vacuous, worst, bound, … }).
  report.net = diet.net;
  Object.assign(report.pass, diet.pass);
  // Media spans (scripts/lib/unitGates.mjs): mode off → the request gates only.
  // detail[gate] = { n, floor, vacuous, worst, bound }: --expect-fail accepts only a non-vacuous false.
  report.requests = report.net.log.filter((e) => e.route === '/' && ['mux-thumb', 'sanity-image', 'mux-master'].includes(e.bucket)).map((e) => e.asked); // §8.2
  report.darkThumbs = dark.list; // — P7 — report-only: no gate reads it
  report.darkThumbsScan = { measured: dark.measured, failed: dark.failed };
  const spans = unitGates(report, GATE_CTX);
  Object.assign(report.pass, spans.pass);
  report.spans = { key: GATE_CTX.key, level: LEVEL, asked: LEVEL_ASKED, units: GATE_CTX.units, detail: spans.detail };
  // A baseline is written only from a run whose every gate passed (§8.6).
  if (RECORD && Object.values(report.pass).every(Boolean)) writeBaseline(BASELINE_FILE, GATE_CTX.key, baselineOf(report, GATE_CTX));
  if (report.imageFailures.length) {
    console.error(
      `globe-probe: ${report.imageFailures.length} image request(s) failed, first: ${report.imageFailures[0]}\n` +
        `  a CORS block on cdn.sanity.io = this origin is off the Sanity project's allowlist (localhost:4321, :4322, :3333 are on it)`
    );
  }
  console.log(JSON.stringify(report, null, 1));
  save();
  if (Object.values(report.pass).some((v) => !v)) process.exit(2);
})().catch((e) => {
  report.fatal = String(e && e.stack ? e.stack : e);
  console.log(JSON.stringify(report, null, 1));
  save();
  process.exit(1);
});
