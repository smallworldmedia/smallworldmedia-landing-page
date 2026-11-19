#!/usr/bin/env node
/**
 * scheme-probe — the acceptance matrix of the US-7 colour schemes (project | black | blue | spectrum).
 * spectrum is PARKED (SQ-98): not a widget station and never stored, but this probe loads
 * `?scheme=spectrum` as a preview, which the latch still applies, so `--scheme=spectrum` runs unchanged.
 * For each scheme x route x width it loads `<path>?scheme=<name>`, waits for every client:load island
 * to commit, dumps the painted colours of every visible non-media element (and its ::before/::after),
 * and runs the gates of scripts/lib/scheme-gate.mjs over the dump (pure functions, unit-tested in
 * scripts/test/scheme-gate.test.mjs). It changes nothing in the site.
 *
 * Usage:
 *   ~/swm-probe-lock.sh node scripts/scheme-probe.mjs --base=http://localhost:4330 --scheme=black
 *        [--routes=home,work,detail,directory,process,privacy,404] [--width=1440|390] [--gates=a,b,c]
 *        [--capture=FILE] [--compare=FILE] [--shots=DIR] [--force-attr] [--ignore=CSS-SELECTOR]
 *        [--inject=CSS] [--query=schemelids=1]
 *   --scheme   project | black | blue | spectrum | all   (default project)
 *   --routes   default all, except process, which is named only (none = only the widget pass). detail = the first /work card's slug, plus card 3's (the cross-route check).
 *   (the corner widget has one seat, flush: ?schemebadge is gone, SQ-107 pass 5.) The overlap gate loads
 *              each route and tests the badge TILE (the wrapper's ::before) against the page's boxes: the
 *              tile's bottom edge must not pass the links footer's top edge on /work/directory/ or
 *              /process/. The blurb gate (widget pass, home) fails when the tile meets the footer blurb's
 *              text: run it with --width=1024,1280,1440,1920 for the desktop range.
 *   --base     default http://localhost:4330 (the worktree's build; a Sanity CORS origin), so the bare command is the
 *              SQ-121 verifier. GLOBE_PROBE_BASE overrides it.
 *   The `clear` widget gate (SQ-121, default for the widget gates; the scheme x 5 viewport matrix runs apart from
 *              the width loop at 1440 x 900, 1024 x 768, 1280 x 800, 1920 x 1080 and 2560 x 1440): home at rest the badge
 *              sits wholly above the footer blurb's text and off the privacy pill, and with the eye held (the column fully
 *              engaged) no part of the grown badge, the ring or the shifted circle meets the blurb text or the pill.
 *              SQ-125: the bottom edge of the engaged column's LOWEST VISIBLE PART (on desktop the near ring under the
 *              lens, with its own badge; Nathan 11-18) sits --gap (default 4, Nathan's number) above the top edge of
 *              the black panel (.site-footer--links), within 0.5 px, too high or too low, and a column with no ring
 *              shown under the lens fails by name. At rest the eye and the smaller badge clear the panel by --gap too.
 *              A ?schemeblurbgap re-dial fails it unless --gap follows.
 *              Negative controls: --inject='.swm-corner{--badge-cy:20px !important}' must FAIL, and so must
 *              --inject='.swm-corner{translate:0 4px}' (the seat 4 px lower), --query=schemeblurbgap=2 (2 px low, the first round's gap), --query=schemeblurbgap=8 and
 *              --query=schemedown=0 (no ring under the lens, the seat 30 px too low for the column).
 *   The `bands` gate (SQ-125, Nathan 11-18: "whats the thin color strip at the bottom of the rest and engaged chips"): the badge's
 *              first and last two pixel rows at a SETTLED station are its own band (glass, black or blue), never the next band's
 *              colour. Only the badge is painted over a flat grey page, a screenshot of its width is read row by row, and each edge row
 *              must be a blend of its own band with the page (an edge row may be partly covered), never nearer another band. It runs
 *              with the `clear` gate (same pages: five desktop viewports, rest and engaged, every scheme) and with the `phone` gate
 *              at 390 x 844 (rest and held), or by name (--gates=bands). --dpr=2|3 reads the retina rows (a hand run).
 *              Negative control: --inject='.swm-corner[data-ready] .fp-scale.swm-corner__pager::before{background-size:100% calc(3 * var(--badge-h)) !important;background-position:0 calc(-1 * round(var(--scale-qf, var(--scale-cur)), 1) * var(--badge-h)) !important}'
 *              (the pre-SQ-125 strip, bands exactly one badge height) must FAIL.
 *   The `phone` gate (SQ-121, by name only, --width=390): the badge, eye and every ring part's rects on every
 *              route at rest and held, compared to a capture of the BASE build. Phones are unchanged byte for
 *              byte: serve the base build on :3333, run
 *              `--base=http://localhost:3333 --gates=phone --width=390 --capture=FILE`, then the candidate on :4330
 *              with `--gates=phone --width=390 --compare=FILE`.
 *   --inject   CSS added to each overlap and widget page after load: a negative control for those gates
 *              (negative controls: noClip --inject='.swm-corner .fp-scale__window{height:40px !important}' must FAIL,
 *              rightEdge --inject='.swm-corner{right:6px !important}' must FAIL, jitter
 *              --inject='.swm-corner .fp-scale[data-open] .scheme-eye__iris{translate:1.6px 0}' must FAIL)
 *   --details  sample (default: cards 1 and 3) | all (every /work card's detail page). The uniform gate
 *              compares the detail pages it is given (two or more). The shares gate sums them: it SKIPs
 *              unless --details=all (two pages cannot show the proportions of the whole), and then prints
 *              one INFO line per page (that page's own shares) above the verdict.
 *   --width    1440 | 390 (default both)
 *   --gates    latch,identity,monochrome,singleHue,contrast,carriers,deal,hover,overlap,shares,uniform,
 *              density,outline,gl
 *              default per scheme: project latch,overlap,gl | black latch,monochrome,contrast,
 *              carriers,hover,overlap,gl | blue latch,singleHue,contrast,carriers,hover,overlap,gl |
 *              spectrum latch,contrast,hover,overlap,uniform,density,outline,gl. --compare adds identity.
 *              carriers, deal and shares (the first spectrum skin's per-project deal) stay available by name.
 *   --density  the density gate's threshold, replacing the 5 of home, work, detail and directory (privacy
 *              and 404 keep 3). Both numbers are PROPOSALS: Nathan sets them.
 *   --capture  write the dump JSON (every page's style dump, carriers, hover fingerprints, boxes)
 *   --compare  run identity of this run against a capture (same scheme, routes, widths)
 *   --shots    save a full-page screenshot per page under DIR (never commit them). When Chrome refuses
 *              a tall capture the viewport is saved instead, the page WARNs, its gates still run, and
 *              the probe restarts its browser (a refusal blocks WebGL for the pages that follow).
 *   --force-attr  the probe sets html[data-scheme] itself in an init script instead of reading the
 *              site's, to validate the tool before the core lands; every line says "forced".
 *
 * Output: one line per gate per route per width (PASS / FAIL / SKIP, offender count), the first 15
 * offenders of each failure, a final summary line. Exit 1 when any gate fails, 0 otherwise.
 *
 * CAPTURE BEFORE YOU EDIT: identity compares two captures from the SAME worktree, never a committed
 * fixture, because Sanity content is live. Capture `--scheme=project`, change the code, then run
 * `--scheme=project --compare=<that capture>`.
 *
 * ONE PROBE AT A TIME, machine-wide: `~/swm-probe-lock.sh node scripts/scheme-probe.mjs ...`.
 * Serve the worktree only on a Sanity CORS origin: localhost:4330, localhost:4321 or 127.0.0.1:4399
 * (check `lsof -iTCP:<port> -sTCP:LISTEN` first); any other origin renders Sanity images black.
 * Never build in a checkout whose dev server is running. Playwright is not a project dependency:
 * PLAYWRIGHT_PATH or the path below. Headless Chromium runs with swiftshader for the WebGL scenes.
 *
 * Deterministic pages (the media-cache / hydration-gate recipe): reduced motion; every stream.mux.com
 * request aborted (posters only); cdn.sanity.io and image.mux.com bodies replayed from a disk cache
 * (os.tmpdir()/swm-scheme-probe-cache, keyed by URL) and HELD until every client:load island's React
 * root has committed (a stub devtools hook records the roots; the SSR'd `ssr` attribute alone releases
 * too early and an img that loaded before commit never fires onLoad). The dump is re-read until two
 * consecutive reads agree. The directory is read at ?dirorder=project (the default order shuffles) and the
 * home page at ?popseed=1 (the globe's start world, which tints the whole page, is random per visit).
 * Hover is measured on desktop widths only (forced :hover through CDP): the site's hover rules sit
 * behind (hover: hover), so a phone has none to measure. Hover is not a default project gate.
 *
 * What is dumped: color (elements with their own text), background-color, the four border colours,
 * outline-color, fill/stroke (SVG shapes), stop-color, text-decoration-color, the colour stops of any
 * gradient, box-shadow colours; only painted ones. img, video, canvas, picture, iframe, [data-logo]
 * and the logo ticker's svg are media: left out, and text over them is not contrast-measured. The
 * widget (.swm-corner, or --ignore) is left out of the dump so identity compares the page without it.
 * Elements are keyed by a stable path (tag.classes:nth-of-type chain).
 *
 * The spectrum gates (wave 4: no colour per project; every component wears the palette inside itself):
 *   uniform  the same element paints the same colour on every project. The dumps of the detail pages
 *            (project pages: cards 1 and 3, or every card with --details=all) must agree on every element
 *            two or more of them have, media aside; an element only one page has is skipped and counted
 *            on an INFO line. A keyword word and a social button are matched by data-kw / data-platform and
 *            their count among the siblings sharing it, not by nth-of-type (their colour follows that
 *            attribute, and two projects' n-th sibling can be different things). /work itself is not compared: it opens on its first card and no URL picks another
 *            (the start card is read from sessionStorage, written by input), so only project pages are.
 *   density  per page, how many palette families are painted: the six swatches, white-ground and the
 *            ramp A gradient (>= 3 of its nine stops, read from src/lib/spectrumRamp.js, else
 *            --swm-ramp-a in src/styles/global.css). Needs 5 on home, work, detail and directory, 3 on
 *            privacy and 404 (PROPOSED). The families found print on every page, PASS or FAIL.
 *   outline  the ring and the canvas agree: globe().ramp.mix is 1 on home, worlds().ramp.mix is 1 on
 *            /work, and globe().ramp.center is within 1.5 px of the centre of .hero__globe-stroke
 *            (measured in the page). A hook with no `ramp` field SKIPs ("skipped (hook has no ramp)").
 *            Under any other scheme, when named, the mix must be 0.
 * The corner widget gates (SQ-107; every scheme, run per width on the home page, a fresh page each; the
 * strays and bounds gates engage the pager by a mouse hover, or a held CDP touch on a phone). Measured in
 * viewport CSS px, with motion reduced except in noClip, jitter and persist:
 *   badge       the badge (the pager's ::before) is a horizontal rectangle hugging the eye with equal
 *               padding on all four sides, its right edge on the viewport's (no inset) and, above 768px, its
 *               centre the height of the privacy pill's line (ONE seat on every route, SQ-107 pass 7). At
 *               <= 768px (pass 9) that row rule gives way to the phone clearance: its bottom edge at least
 *               --badge-clear (?schemeclear, 56) above the viewport's bottom, clear of the screen's corner.
 *               Negative control: --inject='.swm-corner{--badge-cy:var(--badge-cy-floor) !important}' (the phone
 *               rule removed) must FAIL at 390.
 *   seat        the badge's gap above the viewport's bottom edge is the same on every route (home, /work,
 *               a detail page, the directory, /process, /privacy), at rest and at the footer's end state
 *               (scrolled to the end, a wheel on home to reveal it), at this width; on a phone every gap is
 *               also at least the clearance.
 *   rightEdge   the tile's right edge equals the viewport's within 0.5 px on home, /work and /privacy at
 *               390, 1024, 1440 and 1920, at rest and engaged (once per scheme, whatever --width).
 *   noClip      frames of the entrance, the exit and a page through the stations (ArrowDown x2, ArrowUp x2):
 *               no visible circle (effective opacity above 0.03) straddles the edge of a box that clips it.
 *   jitter      the iris globe on one path through a REAL-TIME entrance and exit (slowed to 5 s, project
 *               only, /privacy/): Chromium by pixel centroid at DPR 1 and 2, WebKit by box centres at DPR 1
 *               and 2 (a WebKit screenshot settles a transition). Monotonic in x and y, and the settled pose
 *               within 0.5 px of the last animated frame.
 *   strip       the badge is a clipping window onto the strip of the three background panels (glass,
 *               black, blue), riding the column position, one detent = one badge height: with only the
 *               badge painted over a flat page, --scale-qf is set to whole and fractional values and the
 *               middle column's colours read: one panel at a whole q (the station's), the seam at
 *               (1 - fraction) x the height between (project only). Then the real engine: ArrowDown x3,
 *               each settled detent one colour, the station's.
 *   eyeLines    no dark stroke on any shape in the widget's svgs (the black outline is gone).
 *   bounds      engaged, every visible circle lies inside the window's and the viewport's x range (the
 *               viewport's bottom edge is the one hard edge, so y is not held).
 *   shift       the engaged eye steps LEFT off the viewport's edge on /work's stagger taper (SQ-107 pass 10), at
 *               390 and 1440, motion on and reduced: with the pager held settled, each circle's centre is the
 *               rest eye's centre plus the lift's own anchor drift (the pager's translate) minus S x the taper
 *               (1 at the lens, 0.444 one station out, 0.111 two out; S = 48 swatch units, the default, never
 *               read off the page), the badge's right edge is the viewport's and its left edge a padding left of the
 *               shifted eye, and /work's lens arrow, mirrored, is shown in the gap, pointing left, on the lens
 *               line; at rest the arrow waits ENTIRELY beyond the viewport's right edge (pass 11) and the badge is the
 *               eye plus a padding each side. --shots=DIR
 *               saves shift-<scheme>-<width>-<motion|reduced>-{rest,engaged,mid,next}.png.
 *               Negative controls: --inject='.swm-corner{--eye-shift:0px !important}' (a straight column) and
 *               --inject='.swm-corner .fp-scale.swm-corner__pager .fp-scale__pointer{display:none !important}'
 *               (the arrow hidden again) must FAIL.
 *   sequence    SQ-107 pass 11: the engage and release as a choreography, a deterministic SEEK (document.getAnimations(),
 *               never real time) sampled every 10 ms at 390 and 1440: the slide, then the grow (the lift stays at rest
 *               until the slide has ended, 0.5 px), then the +-1 circles a beat after, then the +-2 (each start at
 *               least step - 10 ms apart); the release exactly reversed; the arrow entirely off-screen at rest, opacity 1
 *               wherever any of it shows, one way per phase, ending on its seat (0.5 px); a quick tap (released at 100
 *               and 250 ms) returns to rest, starts moving at once and never stands still more than a step. Needs a
 *               build or dev server (runs on either). Negative controls: --inject='.swm-corner .fp-scale,.swm-corner
 *               .fp-scale[data-open]{transition-delay:0s !important}' (all delays 0) and --inject='.swm-corner
 *               .fp-scale__pointer{--eye-arrow-off:0px !important;opacity:var(--eye-ts) !important}' (the arrow fades
 *               in place) must FAIL. --shots=DIR saves filmstrip-<scheme>-<width>.png (a frame every 40 ms: engage,
 *               release, the two quick taps); SWM_SEQ_DUMP=<file.json> writes each run's samples.
 *   fan         SQ-116: the ring circles' own badges and the fan-out, off the sequence run's seeked frames (every 10 ms,
 *               390 and 1440): (a) settled, each shown ring circle sits in a badge window of its own, whose width and
 *               height over the lens window's are within 2 % of the circle's over the lens circle's; (b) one pixel
 *               read inside each window (a flat page, the art hidden) is that circle's own scheme's panel; (c) through
 *               the engage, the release and the quick taps each circle is at its settled opacity (1) from its first
 *               moving frame, its centre between the lens circle's and its station, its distance one way per phase
 *               (taps: not the direction); (d) before the grow starts no visible ring circle lies outside the lens
 *               window; (e) 11-17, the far circle's window (two out, the phone's u2) meets its inner neighbour's with
 *               no gap, settled and on every engage and release frame (a holds its outer half); (f) 11-17, wherever any
 *               of a ring circle shows past the lens window's edge it is at its settled x: straight up and down.
 *               Negative controls: --inject='.swm-corner .fp-scale__station .scheme-badge{display:none
 *               !important}' (a), --inject='.swm-corner .fp-scale__station .scheme-badge{background:#f0f !important;
 *               backdrop-filter:none !important}' (b), --inject='.swm-corner .fp-scale__station{opacity:var(--eye-p)
 *               !important}' (c: the old fade), --inject='.swm-corner .fp-scale__station{--eye-p:1 !important}' (d:
 *               circles out before the grow), --inject='.swm-corner .fp-scale__station .scheme-badge{--badge-g:0
 *               !important}' (e: the old 5.8 px gap at 390) and --inject='.swm-corner .fp-scale__station{--eye-sx:calc(
 *               var(--sw) + (1 - var(--sw)) * (1 - var(--eye-p))) !important}' (f: the old slant) must FAIL.
 *   lids        SQ-107 pass 11 (?schemelids): at rest and engaged, no pixel of the iris or the lens circle lies outside
 *               the lids' outer outline (device pixel ratio 2, lids recoloured, a flood fill from the border of a capture
 *               without the circle, shrunk a device pixel, compared with a capture with it). --query=schemelids=1 (pass
 *               10's lids) must FAIL. --shots=DIR saves lids-<scheme>-<width>[-k1]-{rest,engaged}.png at DPR 3.
 *   strays      the column scrubbed through eye-t 0.15 to 0.85 (only the widget painted): a capture with
 *               every station is pixel-identical to one with the stations beyond the shown rows hidden.
 *   persist     soft navigations (home to /work to a project and back; by the menu on a phone) with
 *               motion ON: the widget stays one node at opacity 1 and visible on every frame, AND its paint
 *               is never covered: a screenshot of the badge every frame must keep its iris (the route
 *               fill laid over it is a layer above, so no computed style shows it). On a phone the menu
 *               takeover is allowed to cover it. Negative control: --inject='.swm-corner{z-index:43 !important}'
 *               (the old seat under the shell) must FAIL.
 *   menu        390 x 844 only, Chromium and WebKit, motion on and reduced (SQ-107 pass 8): the phone menu's
 *               takeover WIPES OVER the badge. Four phases (open, hold, close, a page change made from the
 *               menu), sampled every animation frame (the takeover's rendered top against the badge's box;
 *               the badge's opacity, visibility, inert flag and stacking level) and, with gsap slowed near
 *               the badge, by screenshots of its box: the rows under the edge are the menu's colour, the rows
 *               above it the badge's. The badge is never hidden or faded as a whole, never over the menu.
 *               Negative controls: --inject='html[data-menu-open] .swm-corner{visibility:hidden !important}'
 *               (the old hide) and --inject='.site-menu-host{z-index:101 !important}' (the old stacking) must FAIL.
 * The old spectrum expectations (carriers, deal, shares) come from a dynamic import of
 * ../src/lib/colorScheme.js, and only run when named; when it is absent they print
 * "skipped: colorScheme.js not present" and do not fail.
 * gl reads window.__swmSchemeDebug (an object of functions, e.g. { globe(), worlds() }, each returning
 * { accent: '#rrggbb', ... }) and prints it; absent prints "gl: skipped (no debug hook)".
 * A measurement tool with a verdict: exits 1 when a gate fails.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as gate from './lib/scheme-gate.mjs';
import { countFamilies } from './palette-measure.mjs';

const arg = (k, d) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  if (m) return m.slice(k.length + 3);
  return process.argv.includes(`--${k}`) ? true : d;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const die = (msg) => {
  console.error(`scheme-probe: ${msg}`);
  process.exit(2);
};

const SCHEMES = ['project', 'black', 'blue', 'spectrum'];
// home: ?popseed pins the globe population's start world, whose projectColor tints the whole home page (random per visit).
const ROUTE_PATHS = { home: '/?popseed=1', work: '/work/', directory: '/work/directory/?dirorder=project', process: '/process/', privacy: '/privacy/', 404: '/404/' };
const ROUTE_NAMES = ['home', 'work', 'detail', 'directory', 'process', 'privacy', '404'];
const OPT_IN_ROUTES = ['process']; // named routes only: `--routes=all` leaves them out (the colour gates were never run on /process)
const WIDGET_GATES = ['badge', 'seat', 'rightEdge', 'blurb', 'above', 'clear', 'bands', 'strip', 'eyeLines', 'bounds', 'strays', 'shift', 'sequence', 'fan', 'lids', 'noClip', 'jitter', 'persist', 'menu']; // the corner widget's own pass (SQ-107)
const GATE_NAMES = ['latch', 'identity', 'monochrome', 'singleHue', 'contrast', 'carriers', 'deal', 'hover', 'overlap', 'shares', 'uniform', 'density', 'outline', 'gl', 'phone', ...WIDGET_GATES];
const DEFAULT_GATES = {
  project: ['latch', 'overlap', 'gl', ...WIDGET_GATES], // hover is not a project gate: today's site has hover states that paint nothing (the nav pill's is hover:hover only)
  black: ['latch', 'monochrome', 'contrast', 'carriers', 'hover', 'overlap', 'gl', ...WIDGET_GATES],
  blue: ['latch', 'singleHue', 'contrast', 'carriers', 'hover', 'overlap', 'gl', ...WIDGET_GATES],
  spectrum: ['latch', 'contrast', 'hover', 'overlap', 'uniform', 'density', 'outline', 'gl', ...WIDGET_GATES], // carriers, deal and shares described the first skin's per-project deal: by name only
};
const EDGE_WIDTHS = [390, 1024, 1440, 1920]; // the rightEdge gate's widths
const EDGE_ROUTES = [['home', '/?popseed=1'], ['work', '/work/'], ['privacy', '/privacy/']];
const STRAY_T = [0.15, 0.3, 0.4, 0.5, 0.6, 0.7, 0.85]; // eye-t values the strays gate scrubs the column to (mid-scale)
const CLIP_W = 240; // the widget's screenshot clip (strays gate and --shots), CSS px up from the bottom-right corner
const CLIP_H = 560;
const RING = '.hero__globe-stroke'; // the DOM ring round the home globe: the outline gate's centre
const OUTLINE_HOOK = { home: 'globe', work: 'worlds' }; // the debug hook whose canvas draws the outline on that route
const HOVER_SELECTORS = ['.site-nav__pill', '.cta-primary', '.deck-tab', '.site-privacy', '.fp-cta', '.prose-link'];
const ANCHOR = '.swm-corner';
const FOOTER_CONTENT = ['.site-footer__blurb', '.logo-ticker__copy', '.logo-ticker__roll', '.site-footer--links a']; // what the home badge must not cover (SQ-107 pass 3)
const OVERLAP_SELECTORS = [ANCHOR, '.site-privacy', '.fp .fp-scale', '.dir-filter', '.site-footer--links', ...FOOTER_CONTENT, '.fp-cta', '.np-band__title'];
const MEDIA_SEL = 'img, video, canvas, picture, iframe, object, embed, [data-logo], .logo-ticker svg';
const HOVER_MS = 900;
const MAX_READS = 10;
const READ_MS = 700;
const BAD_CORE = 'colorScheme.js not present';

// The default is the worktree's build on localhost:4330 (a Sanity CORS origin): the bare command is the SQ-121 verifier.
const BASE = String(arg('base', process.env.GLOBE_PROBE_BASE) || 'http://localhost:4330').replace(/\/$/, '');
if (BASE === 'true') die('--base=http://localhost:4330 takes a URL');
const schemeArg = String(arg('scheme', 'project'));
const SCHEME_LIST = schemeArg === 'all' ? SCHEMES : schemeArg.split(',');
if (SCHEME_LIST.some((s) => !SCHEMES.includes(s))) die(`--scheme takes ${SCHEMES.join('|')}|all`);
const ROUTES = arg('routes', 'all') === 'all' ? ROUTE_NAMES.filter((r) => !OPT_IN_ROUTES.includes(r)) :arg('routes') === 'none' ? [] : String(arg('routes')).split(',');
if (ROUTES.some((r) => !ROUTE_NAMES.includes(r))) die(`--routes takes ${ROUTE_NAMES.join(',')}`);
const SHARE_TILE = 4000; // CSS px of page height per masked capture (the shares gate)
const DETAILS = String(arg('details', 'sample'));
if (!['sample', 'all'].includes(DETAILS)) die('--details takes sample|all');
const WIDTHS = arg('width') ? String(arg('width')).split(',').map(Number) : [1440, 390];
if (WIDTHS.some((w) => !(w > 0))) die('--width takes numbers, e.g. 1440 or 390');
const GATES_ARG = arg('gates') ? String(arg('gates')).split(',') : null;
if (GATES_ARG?.some((g) => !GATE_NAMES.includes(g))) die(`--gates takes ${GATE_NAMES.join(',')}`);
const CAPTURE = typeof arg('capture') === 'string' ? arg('capture') : null;
const COMPARE = typeof arg('compare') === 'string' ? arg('compare') : null;
const DENSITY = arg('density') === undefined ? undefined : Number(arg('density') === true ? NaN : arg('density'));
if (DENSITY !== undefined && !(DENSITY > 0)) die('--density takes a positive number, e.g. --density=4');
const SHOTS = typeof arg('shots') === 'string' ? arg('shots') : null;
const FORCE = !!arg('force-attr', false);
const IGNORE_SEL = typeof arg('ignore') === 'string' ? arg('ignore') : ANCHOR;
const QUERY = typeof arg('query') === 'string' ? `&${arg('query')}` : ''; // extra ?params for the sequence and lids runs (a negative control: --query=schemelids=1)
const INJECT = typeof arg('inject') === 'string' ? arg('inject') : null; // CSS added to the widget pass's pages: a negative control for the widget gates

const require = createRequire(import.meta.url);
const PW = process.env.PLAYWRIGHT_PATH || '/Users/nathangorey/.npm/_npx/e41f203b7505f1fb/node_modules/playwright';
const { chromium, webkit } = require(PW);

// ── in the page ─────────────────────────────────────────────────────────────────────────────

/** Init script: record every React root's container, and answer "has every client:load island committed?". */
function hydrationHook() {
  const roots = new Set();
  window.__swmRoots = roots;
  if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject() { return 1; },
      checkDCE() {},
      onScheduleFiberRoot() {},
      onCommitFiberRoot(id, root) { if (root && root.containerInfo) roots.add(root.containerInfo); },
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
    };
  }
  window.__swmCommitted = () =>
    document.readyState !== 'loading' &&
    [...document.querySelectorAll('astro-island[client="load"], astro-island[client="only"]')].every((i) => roots.has(i));
}

/** Init script (--force-attr): put html[data-scheme] on the document as soon as it exists, and keep it. */
function forceAttr(name) {
  const set = () => {
    const h = document.documentElement;
    if (h && h.getAttribute('data-scheme') !== name) h.setAttribute('data-scheme', name);
    return !!h;
  };
  if (!set()) {
    const mo = new MutationObserver(() => {
      if (set()) {
        mo.disconnect();
        new MutationObserver(set).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
      }
    });
    mo.observe(document, { childList: true });
  } else {
    new MutationObserver(set).observe(document.documentElement, { attributes: true, attributeFilter: ['data-scheme'] });
  }
}

/**
 * Walk the page (or, with `scope`, the first visible match of a selector) and return its painted
 * colours: { els: { path: { paint, text?, media? } }, carriers, vars } — carriers and vars only for a
 * whole-page walk. Self-contained: it is serialised into the page.
 */
function pageDump({ ignoreSel, mediaSel, scope, mark }) {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'TITLE', 'BASE']);
  const GRAPHIC = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'use']);
  const COLOUR_RE = /(?:rgba?|color|oklab|oklch|lab|lch|hsla?|hwb)\([^)]*\)/g;
  const clear = (c) => !c || c === 'transparent' || /^rgba\(.*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  const els = {};
  const pathOf = new WeakMap();
  const mediaRects = [...document.querySelectorAll(mediaSel)]
    .map((m) => m.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  const hasText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  };
  const clsOf = (el) => (el.getAttribute('class') || '').split(/\s+/).filter((c) => c && !/^astro-/.test(c)).join('.');
  const onMedia = (r) => {
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    return mediaRects.some((m) => x >= m.left && x <= m.right && y >= m.top && y <= m.bottom);
  };
  function paintOf(cs, o) {
    const p = {};
    const put = (k, v) => { if (!clear(v)) p[k] = v; };
    if (o.svg) {
      if (o.graphic) {
        if (cs.fill !== 'none') put('fill', cs.fill);
        if (cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) put('stroke', cs.stroke);
      }
    } else if (o.text) {
      put('color', cs.color);
      const tf = cs.getPropertyValue('-webkit-text-fill-color');
      if (tf && tf !== cs.color) put('text-fill', tf);
    }
    if (o.text && cs.textDecorationLine && cs.textDecorationLine !== 'none') put('text-decoration-color', cs.textDecorationColor);
    put('background-color', cs.backgroundColor);
    for (const s of ['top', 'right', 'bottom', 'left']) {
      const st = cs.getPropertyValue(`border-${s}-style`);
      if (st !== 'none' && st !== 'hidden' && parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0) put(`border-${s}-color`, cs.getPropertyValue(`border-${s}-color`));
    }
    if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) put('outline-color', cs.outlineColor);
    let urlBg = false;
    const bi = cs.backgroundImage;
    if (bi && bi !== 'none') {
      if (bi.includes('gradient(')) (bi.match(COLOUR_RE) || []).forEach((c, i) => put(`bg-grad#${i}`, c));
      if (/url\(/.test(bi)) urlBg = true;
    }
    if (cs.boxShadow && cs.boxShadow !== 'none') (cs.boxShadow.match(COLOUR_RE) || []).forEach((c, i) => put(`shadow#${i}`, c));
    return { p, urlBg };
  }
  // `ukey` is the uniform gate's key, stored as `u` only where it differs from the path (see UNIFORM_ATTRS).
  function record(key, paint, text, media, backdrop, ukey) {
    if (!Object.keys(paint).length) return;
    els[key] = { paint, ...(text ? { text: true } : {}), ...(media ? { media: true } : {}), ...(backdrop ? { backdrop: true } : {}), ...(ukey && ukey !== key ? { u: ukey } : {}) };
  }
  // Elements whose colour follows an attribute and not their sibling position: a keyword word's data-kw
  // slot (src/lib/keywords.jsx: the marked item's place in its paragraph, links and bold counted, shared
  // by the words of one keyword) and a social button's data-platform. Two projects' n-th such sibling
  // can be different things (one blurb opens with a link, one client has no website), so the uniform gate
  // compares them by the attribute and their count among the siblings sharing it, not by nth-of-type.
  const UNIFORM_ATTRS = ['data-kw', 'data-platform'];
  // A transform that flattens its box to nothing (the directory filter's wipe box rests at scaleX(0)).
  const collapsed = (t) => {
    const m = /^matrix\(([^)]+)\)$/.exec(t || '');
    if (!m) return false;
    const [a, b, c, d] = m[1].split(',').map(Number);
    return a * d - b * c === 0;
  };
  function visit(el, path, underUrl, upath = path) {
    pathOf.set(el, path);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.opacity === '0') return;
    const tag = el.localName;
    const isSvg = el instanceof SVGElement;
    const rect = el.getBoundingClientRect();
    const text = hasText(el);
    const shown = cs.visibility === 'visible';
    const boxed = shown && cs.display !== 'contents' && rect.width > 0 && rect.height > 0;
    let urlBg = false;
    if (boxed) {
      const r = paintOf(cs, { svg: isSvg, graphic: isSvg && GRAPHIC.has(tag), text });
      urlBg = r.urlBg;
      record(path, r.p, text, underUrl || urlBg || (text && onMedia(rect)), false, upath);
    } else if (tag === 'stop' && cs.stopOpacity !== '0') {
      record(path, { 'stop-color': cs.stopColor }, false, false, false, upath);
    }
    if (!isSvg && shown) {
      for (const ps of ['::before', '::after']) {
        const pcs = getComputedStyle(el, ps);
        const content = pcs.content;
        if (!content || content === 'none' || content === 'normal' || pcs.display === 'none' || pcs.visibility !== 'visible' || pcs.opacity === '0') continue;
        const w = parseFloat(pcs.width);
        const h = parseFloat(pcs.height);
        const bordered = ['top', 'right', 'bottom', 'left'].some((s) => parseFloat(pcs.getPropertyValue(`border-${s}-width`)) > 0);
        if ((w === 0 || h === 0) && !bordered) continue;
        const textual = !/^(?:""|'')$/.test(content) && !/^url\(/.test(content);
        const r = paintOf(pcs, { svg: false, graphic: false, text: textual });
        // A box painted BEHIND its element's own text (absolute, negative z-index, not flattened): the
        // contrast gate reads it as that text's nearest background, ahead of the element's own fill.
        const backdrop = !textual && pcs.position === 'absolute' && parseInt(pcs.zIndex, 10) < 0 && !collapsed(pcs.transform);
        record(path + ps, r.p, textual, underUrl || urlBg || r.urlBg || (textual && onMedia(rect)), backdrop, upath + ps);
      }
    }
    children(el, path, underUrl || urlBg, upath);
  }
  function children(parent, parentPath, underUrl, parentU = parentPath) {
    const counts = {};
    const keyed = {};
    for (const el of parent.children) {
      const tag = el.localName;
      if (SKIP.has(tag.toUpperCase())) continue;
      if (ignoreSel && el.matches(ignoreSel)) continue;
      counts[tag] = (counts[tag] || 0) + 1;
      if (el.matches(mediaSel)) continue;
      const cls = clsOf(el);
      const seg = `${tag}${cls ? `.${cls}` : ''}`;
      const nth = `${seg}:nth-of-type(${counts[tag]})`;
      let useg = nth;
      const attr = UNIFORM_ATTRS.find((a) => el.hasAttribute(a));
      if (attr) {
        const k = `${seg}[${attr}="${el.getAttribute(attr)}"]`;
        keyed[k] = (keyed[k] || 0) + 1;
        useg = `${k}#${keyed[k]}`;
      }
      visit(el, `${parentPath} > ${nth}`, underUrl, `${parentU} > ${useg}`);
    }
  }
  if (scope) {
    const root = [...document.querySelectorAll(scope)].find((e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility === 'visible';
    });
    if (!root) return null;
    if (mark) root.setAttribute('data-swm-probe-hover', '');
    const cls = clsOf(root);
    visit(root, `${root.localName}${cls ? `.${cls}` : ''}`, false);
    return { els };
  }
  visit(document.documentElement, 'html', false);

  const carriers = [];
  const seen = new Set();
  for (const el of [document.documentElement, ...document.querySelectorAll('[style*="--project-color"]')]) {
    if (seen.has(el)) continue;
    seen.add(el);
    const cls = clsOf(el);
    carriers.push({
      path: pathOf.get(el) || `(unwalked) ${el.localName}${cls ? `.${cls}` : ''}`,
      projectColor: getComputedStyle(el).getPropertyValue('--project-color').trim(),
      spectrum: el.getAttribute('data-spectrum'),
    });
  }
  const names = new Set();
  const addStyle = (st) => {
    for (let i = 0; i < st.length; i++) if (/^--(?:project-color|scheme-)/.test(st[i])) names.add(st[i]);
  };
  const walkRules = (rules) => {
    for (const r of rules) {
      try {
        if (r.style) addStyle(r.style);
        if (r.name && /^--(?:project-color|scheme-)/.test(r.name)) names.add(r.name);
        if (r.cssRules) walkRules(r.cssRules);
      } catch { /* a rule we cannot read */ }
    }
  };
  for (const sh of document.styleSheets) {
    try { walkRules(sh.cssRules); } catch { /* cross-origin sheet */ }
  }
  addStyle(document.documentElement.style);
  const rcs = getComputedStyle(document.documentElement);
  const vars = {};
  for (const n of [...names].sort()) vars[n] = rcs.getPropertyValue(n).trim();
  return { els, carriers, vars, attr: document.documentElement.getAttribute('data-scheme') };
}

/**
 * Boxes of every visible match of each selector that meets the viewport (viewport coordinates).
 * The corner widget's box is its badge tile (the pager's ::before, scaled by its own --eye-lift
 * about its centre), the thing that is seen: the wrapper itself is a taller, empty footprint (the
 * pager's rows) that hangs below the tile and past the viewport's bottom edge on the flush seat.
 * The wrapper's box stands in until the tile is drawn (data-ready).
 */
function pageBoxes(sels) {
  const out = [];
  // On home the flush badge sits in the true bottom-right corner, in front of the resting links footer's
  // empty corner (SQ-107 pass 3): the panel's box is no obstacle there, what is ON it is (the blurb, the
  // lead-in, the logo band and the links are tested by name, the text ones by their text, never their
  // full-width boxes).
  const homeFlush = document.documentElement.hasAttribute('data-footer-rest');
  const byText = new Set(['.site-footer__blurb', '.logo-ticker__copy']);
  for (const sel of sels) {
    if (sel === '.site-footer--links' && homeFlush) continue;
    for (const e of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(e);
      let r = e.getBoundingClientRect();
      if (cs.display === 'none' || cs.visibility !== 'visible' || cs.opacity === '0' || r.width <= 0 || r.height <= 0) continue;
      if (byText.has(sel)) {
        // One box per laid-out line: the range's union box spans the whole block, empty margins included.
        const range = document.createRange();
        range.selectNodeContents(e);
        for (const q of range.getClientRects()) {
          if (q.width <= 0 || q.height <= 0 || q.bottom <= 0 || q.top >= innerHeight || q.right <= 0 || q.left >= innerWidth) continue;
          out.push({ name: sel, x: q.left, y: q.top, w: q.width, h: q.height });
        }
        continue;
      }
      if (e.matches('.swm-corner')) {
        const pager = e.querySelector('.fp-scale');
        const b = pager ? getComputedStyle(pager, '::before') : null;
        const px = (v) => parseFloat(v) || 0;
        if (b && b.content !== 'none') {
          const pr = pager.getBoundingClientRect();
          const k = px(b.scale) || 1;
          const w = px(b.width) * k;
          const h = px(b.height) * k;
          const cx = pr.left + px(b.left) + px(b.width) / 2;
          const cy = pr.top + px(b.top) + px(b.height) / 2;
          r = { left: cx - w / 2, top: cy - h / 2, width: w, height: h, right: cx + w / 2, bottom: cy + h / 2 };
        }
      }
      if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      out.push({ name: sel, x: r.left, y: r.top, w: r.width, h: r.height });
    }
  }
  return out;
}

/** The centre [x, y] (viewport CSS px, y down) of the first visible match of a selector, or null. */
function pageCentre(sel) {
  for (const e of document.querySelectorAll(sel)) {
    const r = e.getBoundingClientRect();
    const cs = getComputedStyle(e);
    if (r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility === 'visible') return [r.left + r.width / 2, r.top + r.height / 2];
  }
  return null;
}

/** window.__swmSchemeDebug: call each function, return their results (null when there is no hook). */
async function pageGl() {
  const d = window.__swmSchemeDebug;
  if (!d || typeof d !== 'object') return null;
  const out = {};
  for (const [k, f] of Object.entries(d)) {
    if (typeof f !== 'function') continue;
    try { out[k] = await f(); } catch (e) { out[k] = { error: String((e && e.message) || e) }; }
  }
  return out;
}

/**
 * The corner widget at rest (SQ-107): its badge tile (the pager's ::before: size and offset are
 * computed px in the pager's box, which carries the translate; grown by its own scale about its
 * centre), the badge's paint, every stroked shape in its svgs, the eye's box, and the tokens the
 * seats read (measured on reference elements, never off the badge's own variables). null when the
 * route has no widget.
 */
function pageWidgetRest() {
  const corner = document.querySelector('.swm-corner');
  if (!corner) return null;
  const pager = corner.querySelector('.fp-scale');
  const b = getComputedStyle(pager, '::before');
  const px = (v) => parseFloat(v) || 0;
  const strokes = [];
  corner.querySelectorAll('svg *').forEach((e) => {
    const cs = getComputedStyle(e);
    strokes.push({ path: `${e.localName}${e.getAttribute('class') ? `.${e.getAttribute('class')}` : ''}`, stroke: cs.stroke, width: parseFloat(cs.strokeWidth) || 0 });
  });
  const eye = corner.querySelector('.scheme-eye')?.getBoundingClientRect();
  // The links footer's top edge (the badge rides it) and the home blurb's text (the union of its
  // text boxes, never the element's own full-width box): null when the route has none.
  const footerTop = document.querySelector('.site-footer--links')?.getBoundingClientRect().top ?? null;
  const blurbEl = document.querySelector('.site-footer__blurb');
  let blurb = null;
  if (blurbEl && getComputedStyle(blurbEl).display !== 'none') {
    const range = document.createRange();
    range.selectNodeContents(blurbEl);
    const q = range.getBoundingClientRect();
    if (q.width > 0 && q.height > 0) blurb = { x: q.left, y: q.top, w: q.width, h: q.height };
  }
  let tile = null;
  if (b.content !== 'none') {
    const pr = pager.getBoundingClientRect();
    const k = px(b.scale) || 1;
    const w = px(b.width);
    const h = px(b.height);
    const cx = pr.left + px(b.left) + w / 2;
    const cy = pr.top + px(b.top) + h / 2;
    tile = { x: cx - (w * k) / 2, y: cy - (h * k) / 2, w: w * k, h: h * k };
  }
  const probeEl = (css) => {
    const e = document.createElement('div');
    e.style.cssText = `position:fixed;left:0;visibility:hidden;pointer-events:none;${css}`;
    document.body.append(e);
    const r = e.getBoundingClientRect();
    e.remove();
    return r;
  };
  const row = probeEl('bottom:var(--footer-bottom-inset);padding:var(--pill-pad-y) 0;box-sizing:content-box;width:1px;height:var(--lh-pill)');
  // The phone tier (pass 9): <= 768px the badge is raised to --badge-clear above the viewport's bottom.
  const phone = matchMedia('(max-width: 768px)').matches;
  const seatEl = document.createElement('div');
  seatEl.style.cssText = 'position:fixed;right:0;width:1px;height:0;visibility:hidden;pointer-events:none;bottom:var(--badge-cy)';
  corner.append(seatEl);
  const seatCy = innerHeight - seatEl.getBoundingClientRect().top;
  seatEl.remove();
  const ref = { rowCy: innerHeight - (row.top + row.height / 2), seatCy, phone, clear: phone ? parseFloat(getComputedStyle(corner).getPropertyValue('--badge-clear')) : null };
  return {
    footerTop,
    blurb,
    ref,
    home: document.documentElement.hasAttribute('data-footer-rest'),
    ready: corner.hasAttribute('data-ready'),
    vp: { w: innerWidth, h: innerHeight },
    tile,
    paint: { bg: b.backgroundColor, blur: b.backdropFilter || b.webkitBackdropFilter || 'none' },
    strokes,
    eye: eye ? { cx: eye.left + eye.width / 2, cy: eye.top + eye.height / 2, x: eye.left, y: eye.top, w: eye.width, h: eye.height } : null,
  };
}

/**
 * The widget engaged (the pager has data-open): every circle on the rows the column shows (the
 * stations within --scale-rows of the current one), the window that clips them, and the stations
 * beyond the shown rows (kept on window.__swmStray for pageScrub to hide).
 */
function pageWidgetEngaged() {
  const pager = document.querySelector('.swm-corner .fp-scale');
  if (!pager || !pager.hasAttribute('data-open')) return null;
  const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  // effective opacity: the circle's own times every ancestor's up to the widget
  const eff = (el) => { let o = 1; for (let e = el; e && !e.matches('.swm-corner'); e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const cur = parseFloat(getComputedStyle(pager).getPropertyValue('--scale-cur')) || 0;
  const rows = parseFloat(getComputedStyle(pager.closest('.swm-corner')).getPropertyValue('--scale-rows')) || 1.5;
  const stations = [...pager.querySelectorAll('.fp-scale__station')].map((s) => ({ k: parseFloat(s.style.getPropertyValue('--k')), s }));
  const shown = stations.filter((x) => Math.abs(x.k - cur) < rows);
  const win = pager.querySelector('.fp-scale__window');
  window.__swmStray = stations.filter((x) => Math.abs(x.k - cur) >= rows).map((x) => x.s);
  return {
    cur,
    rows,
    window: { name: '.fp-scale__window', ...rect(win) },
    circles: shown.map((x) => ({ name: `circle k=${x.k}`, op: parseFloat(getComputedStyle(x.s).opacity), eop: eff(x.s), ...rect(x.s.querySelector('svg') ?? x.s) })),
    outer: window.__swmStray.length,
  };
}

/**
 * Every painted rect of the widget in the state it is in now, for the clear and phone gates (SQ-121): the lens badge
 * (the pager's ::before at its lifted size), the eye, each station's circle and its own badge (effective opacity: the
 * station's times every ancestor's up to the widget; a hidden station reads 0), the footer blurb's text rect (the
 * union of its text boxes) and the privacy pill. All viewport CSS px, as painted: shifted and lifted.
 */
function pageClear() {
  const corner = document.querySelector('.swm-corner');
  const pager = corner?.querySelector('.fp-scale');
  if (!pager) return null;
  const px = (v) => parseFloat(v) || 0;
  const rect = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
  const eff = (el) => { let o = 1; for (let e = el; e && !e.matches('.swm-corner'); e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity); return o; };
  const b = getComputedStyle(pager, '::before');
  let tile = null;
  if (b.content !== 'none') {
    const pr = pager.getBoundingClientRect();
    const k = px(b.scale) || 1;
    const w = px(b.width);
    const h = px(b.height);
    const cx = pr.left + px(b.left) + w / 2;
    const cy = pr.top + px(b.top) + h / 2;
    tile = { x: cx - (w * k) / 2, y: cy - (h * k) / 2, w: w * k, h: h * k };
  }
  let blurb = null;
  const blurbEl = document.querySelector('.site-footer__blurb');
  if (blurbEl && getComputedStyle(blurbEl).display !== 'none') {
    const range = document.createRange();
    range.selectNodeContents(blurbEl);
    const q = range.getBoundingClientRect();
    if (q.width > 0 && q.height > 0) blurb = rect(q);
  }
  const pillEl = document.querySelector('.site-privacy');
  const pill = pillEl && getComputedStyle(pillEl).display !== 'none' ? rect(pillEl.getBoundingClientRect()) : null;
  // The black panel the seat clears (SQ-125): the links footer as painted.
  const panelEl = document.querySelector('.site-footer--links');
  const panel = panelEl ? rect(panelEl.getBoundingClientRect()) : null;
  const eye = corner.querySelector('.scheme-eye');
  const parts = [];
  for (const s of pager.querySelectorAll('.fp-scale__station')) {
    const op = eff(s);
    const k = s.style.getPropertyValue('--k');
    const svg = s.querySelector('svg');
    const bd = s.querySelector('.scheme-badge');
    if (svg) parts.push({ name: `circle k=${k}`, op, ...rect(svg.getBoundingClientRect()) });
    if (bd) parts.push({ name: `badge k=${k}`, op, ...rect(bd.getBoundingClientRect()) });
  }
  if (eye) parts.push({ name: 'eye', op: 1, ...rect(eye.getBoundingClientRect()) });
  // The seat the stylesheet declares (--badge-cy above the viewport's bottom), for the badge gate's desktop rule.
  const seat = document.createElement('div');
  seat.style.cssText = 'position:fixed;right:0;width:1px;height:0;visibility:hidden;pointer-events:none;bottom:var(--badge-cy)';
  corner.append(seat);
  const seatCy = innerHeight - seat.getBoundingClientRect().top;
  seat.remove();
  return { vp: { w: innerWidth, h: innerHeight }, open: pager.hasAttribute('data-open'), tile, blurb, pill, panel, parts, seatCy, eye: eye ? rect(eye.getBoundingClientRect()) : null };
}

/**
 * Scrub the engaged column to eye-t `t` with no transition and show only the widget (every other
 * element hidden: the badge's backdrop must not sample a moving page), optionally with the
 * stations beyond the shown rows hidden (opacity 0) so two captures differ only by strays.
 */
function pageScrub({ t, hideOuter }) {
  if (!document.getElementById('swm-probe-isolate')) {
    const st = document.createElement('style');
    st.id = 'swm-probe-isolate';
    st.textContent = 'html{background:#808080 !important} body *{visibility:hidden !important} .swm-corner,.swm-corner *{visibility:visible !important}';
    document.head.append(st);
  }
  const pager = document.querySelector('.swm-corner .fp-scale');
  pager.style.transition = 'none';
  for (const k of ['s', 'g', 'n', 'f']) pager.style.setProperty(`--eye-t${k}`, String(t));
  for (const s of window.__swmStray || []) s.style.opacity = hideOuter ? '0' : '';
}

// ── node side ───────────────────────────────────────────────────────────────────────────────

const CACHE_DIR = path.join(os.tmpdir(), 'swm-scheme-probe-cache');
const IMAGE_HOSTS = /^https:\/\/(?:cdn\.sanity\.io|image\.mux\.com)\//;

/** Route the context: no streams, cached images held until the page's islands have committed. */
async function installRoutes(ctx) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  await ctx.route(IMAGE_HOSTS, async (route) => {
    const req = route.request();
    const key = crypto.createHash('sha1').update(req.url()).digest('hex');
    const bodyFile = path.join(CACHE_DIR, key);
    const metaFile = `${bodyFile}.json`;
    const t0 = Date.now();
    while (Date.now() - t0 < 40000) {
      let ready = false;
      try {
        ready = await req.frame().evaluate(() => (window.__swmCommitted ? window.__swmCommitted() : false));
      } catch {
        break; // the frame went away: release the request
      }
      if (ready) break;
      await sleep(150);
    }
    try {
      if (fs.existsSync(metaFile)) {
        const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
        return await route.fulfill({ status: 200, headers: { 'content-type': meta.type, 'access-control-allow-origin': '*' }, body: fs.readFileSync(bodyFile) });
      }
      const resp = await route.fetch();
      const body = await resp.body();
      if (resp.status() === 200) {
        fs.writeFileSync(bodyFile, body);
        fs.writeFileSync(metaFile, JSON.stringify({ type: resp.headers()['content-type'] || 'application/octet-stream' }));
      }
      await route.fulfill({ response: resp, body });
    } catch {
      await route.abort().catch(() => {});
    }
  });
}

/** The /work worlds in order, read from the SSR'd island props (Astro's tagged serialisation). */
async function fetchWorlds() {
  const revive = (v) => {
    if (!Array.isArray(v)) return v;
    const [t, x] = v;
    if (t === 1 && Array.isArray(x)) return x.map(revive);
    if (t === 0 && x && typeof x === 'object' && !Array.isArray(x)) return Object.fromEntries(Object.entries(x).map(([k, y]) => [k, revive(y)]));
    return x;
  };
  try {
    const html = await (await fetch(`${BASE}/work/`)).text();
    for (const tag of html.matchAll(/<astro-island\b[^>]*>/g)) {
      const m = /\sprops="([^"]*)"/.exec(tag[0]);
      if (!m) continue;
      const json = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const props = Object.fromEntries(Object.entries(JSON.parse(json)).map(([k, v]) => [k, revive(v)]));
      if (Array.isArray(props.worlds) && props.worlds.length && props.worlds[0]?.slug) {
        return props.worlds.map((w) => ({ slug: w.slug, spectrum: w.spectrum ?? null }));
      }
    }
  } catch (e) {
    console.error(`scheme-probe: could not read the /work worlds (${e.message})`);
  }
  return [];
}

/** ../src/lib/colorScheme.js, or a reason it cannot be used. */
async function loadCore() {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/lib/colorScheme.js');
  if (!fs.existsSync(file)) return { ok: false, reason: BAD_CORE };
  try {
    const mod = await import(pathToFileURL(file).href);
    if (typeof mod.spectrumKeyAt !== 'function' || !mod.SPECTRUM) return { ok: false, reason: 'colorScheme.js has no spectrumKeyAt/SPECTRUM' };
    return { ok: true, mod };
  } catch (e) {
    return { ok: false, reason: `colorScheme.js failed to import: ${String(e.message).split('\n')[0]}` };
  }
}

/** Ramp A's nine stops (hex): src/lib/spectrumRamp.js when it exists, else --swm-ramp-a in global.css; [] when neither reads. */
async function loadRampStops() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const js = path.join(root, 'src/lib/spectrumRamp.js');
  if (fs.existsSync(js)) {
    try {
      const mod = await import(pathToFileURL(js).href);
      if (Array.isArray(mod.SPECTRUM_RAMP_A) && mod.SPECTRUM_RAMP_A.length) return mod.SPECTRUM_RAMP_A;
    } catch { /* fall through to the stylesheet */ }
  }
  try {
    return gate.rampStopsFromCss(fs.readFileSync(path.join(root, 'src/styles/global.css'), 'utf8'));
  } catch {
    return [];
  }
}

const DUMP_OPTS = { ignoreSel: IGNORE_SEL, mediaSel: MEDIA_SEL };

async function measureHover(ctx, page) {
  const pairs = [];
  const cdp = await ctx.newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    for (const selector of HOVER_SELECTORS) {
      const rest = await page.evaluate(pageDump, { ...DUMP_OPTS, scope: selector, mark: true });
      if (!rest) continue; // absent (or not visible) on this route
      try {
        const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[data-swm-probe-hover]' });
        if (!nodeId) continue;
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
        await sleep(HOVER_MS);
        const hov = await page.evaluate(pageDump, { ...DUMP_OPTS, scope: '[data-swm-probe-hover]', mark: false });
        await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
        pairs.push({ selector, rest: rest.els, hover: hov?.els ?? {} });
      } finally {
        await page.evaluate(() => document.querySelectorAll('[data-swm-probe-hover]').forEach((e) => e.removeAttribute('data-swm-probe-hover')));
      }
    }
  } finally {
    await cdp.detach().catch(() => {});
  }
  return pairs;
}

async function measureBoxes(page) {
  const max = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  const stops = max < 50 ? [0] : [...new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f)))];
  const boxes = [];
  for (const y of stops) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await sleep(250);
    for (const b of await page.evaluate(pageBoxes, OVERLAP_SELECTORS)) boxes.push({ ...b, at: y });
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  return boxes;
}

/**
 * The overlap gate's boxes for the corner widget: a fresh load of the
 * route, then every OVERLAP_SELECTORS box at five scroll stops. The widget rides the links footer.
 */
async function measureOverlap(ctx, scheme, urlPath) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__swmCommitted && window.__swmCommitted(), null, { timeout: 40000 }).catch(() => {});
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 30000 }).catch(() => {});
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1200);
    return { boxes: await measureBoxes(page) };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await page.close().catch(() => {});
  }
}

async function measurePage(ctx, scheme, urlPath, width, needShares) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  try {
    const url = `${BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}scheme=${scheme}`;
    await page.goto(url, { waitUntil: 'load', timeout: 90000 });
    let committed = true;
    await page.waitForFunction(() => window.__swmCommitted && window.__swmCommitted(), null, { timeout: 40000 }).catch(() => { committed = false; });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1200);
    let prev = null;
    let dump = null;
    let reads = 0;
    let settled = false;
    while (!settled && reads < MAX_READS) {
      dump = await page.evaluate(pageDump, DUMP_OPTS);
      reads++;
      const key = JSON.stringify(dump.els);
      settled = key === prev;
      prev = key;
      if (!settled) await sleep(READ_MS);
    }
    const out = { url, attr: dump.attr, committed, settled, reads, errors, vars: dump.vars, els: dump.els, carriers: dump.carriers };
    out.hover = width > 480 ? await measureHover(ctx, page) : []; // a phone has no hover: the site's hover rules sit behind (hover: hover)
    out.ring = await page.evaluate(pageCentre, RING); // read beside the hooks: the outline gate compares the ramp's centre with it
    out.gl = await page.evaluate(pageGl);
    const name = `${scheme}-${urlPath.replace(/[/?=&]+/g, '_')}-${width}`;
    // Headless Chrome refuses some tall captures ("Unable to capture screenshot": the detail pages at
    // 1440, the directory at 390). A shot is evidence, not a gate, so a refusal keeps the page's gates:
    // the viewport is saved instead, and `refused` tells the run loop to start a fresh browser.
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const file = path.join(SHOTS, `${name}.png`);
      try {
        await page.screenshot({ path: file, fullPage: true });
      } catch {
        out.refused = 'full-page screenshot refused, viewport saved';
        await page.screenshot({ path: file, fullPage: false }).catch(() => {
          out.refused = 'screenshot refused, none saved';
        });
      }
    }
    if (needShares) {
      // Read in tiles: Chrome refuses one capture of a tall page (most detail pages at 390), and a
      // refused page would drop out of the shares.
      try {
        const { default: sharp } = await import('sharp');
        const size = await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) }));
        const families = {};
        for (let y = 0; y < size.h; y += SHARE_TILE) {
          const clip = { x: 0, y, width: size.w, height: Math.min(SHARE_TILE, size.h - y) };
          const buf = await page.screenshot({ fullPage: true, clip, mask: [page.locator(MEDIA_SEL)], maskColor: '#000000' });
          const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
          for (const [f, n] of Object.entries(countFamilies(data, info.channels))) families[f] = (families[f] || 0) + n;
        }
        out.families = families;
      } catch {
        out.refused = [out.refused, 'masked full-page screenshot refused, page left out of shares'].filter(Boolean).join('; ');
      }
    }
    return out;
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240), errors };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── the corner widget (SQ-107) ──────────────────────────────────────────────────────────────

const widgetClip = (vp) => ({ x: Math.max(0, vp.w - CLIP_W), y: Math.max(0, vp.h - CLIP_H), width: Math.min(CLIP_W, vp.w), height: Math.min(CLIP_H, vp.h) });

/** Differing pixels (any channel by more than 2) between two same-size PNG buffers. */
async function diffPixels(a, b) {
  const { default: sharp } = await import('sharp');
  const [ra, rb] = await Promise.all([a, b].map((buf) => sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  const ch = ra.info.channels;
  let pixels = 0;
  let maxDelta = 0;
  const box = { x0: Infinity, y0: Infinity, x1: -1, y1: -1 };
  for (let i = 0; i < ra.data.length; i += ch) {
    const d = Math.max(Math.abs(ra.data[i] - rb.data[i]), Math.abs(ra.data[i + 1] - rb.data[i + 1]), Math.abs(ra.data[i + 2] - rb.data[i + 2]));
    if (d <= 2) continue;
    pixels++;
    maxDelta = Math.max(maxDelta, d);
    const p = i / ch;
    const x = p % ra.info.width;
    const y = Math.floor(p / ra.info.width);
    box.x0 = Math.min(box.x0, x);
    box.y0 = Math.min(box.y0, y);
    box.x1 = Math.max(box.x1, x);
    box.y1 = Math.max(box.y1, y);
  }
  return { pixels, total: ra.info.width * ra.info.height, maxDelta, ...(pixels ? { box: `${box.x0},${box.y0}..${box.x1},${box.y1}` } : {}) };
}

/**
 * One scheme at one width, on a fresh home page: the badge at rest (rect, paint, strokes),
 * then the pager engaged (a mouse hover on desktop, a held CDP touch on a phone): the circles against
 * the window and the viewport, then the column scrubbed to mid-scale for the strays gate.
 */
async function measureWidget(ctx, scheme, width) {
  const page = await ctx.newPage();
  const phone = width <= 480;
  const tag = `${scheme}-${width}`;
  const out = {};
  const shot = async (name, opts = {}) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, `corner-${tag}-${name}.png`), ...opts }).catch(() => {});
  };
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__swmCommitted && window.__swmCommitted(), null, { timeout: 40000 }).catch(() => {});
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 30000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1200);
    out.rest = await page.evaluate(pageWidgetRest);
    await shot('rest');
    const eye = out.rest?.eye;
    if (!eye) return { ...out, error: 'no .scheme-eye to engage' };
    if (phone) {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.cx, y: eye.cy }] });
    } else await page.mouse.move(eye.cx, eye.cy);
    await page.waitForFunction(() => document.querySelector('.swm-corner .fp-scale')?.hasAttribute('data-open'), null, { timeout: 8000 }).catch(() => {});
    await sleep(900);
    out.engaged = await page.evaluate(pageWidgetEngaged);
    await shot('engaged');
    // the corner, wide enough to hold the home blurb with the engaged column (the one-circle-above call)
    await shot('engaged-closeup', { clip: { x: Math.max(0, out.rest.vp.w - 760), y: Math.max(0, out.rest.vp.h - 420), width: Math.min(760, out.rest.vp.w), height: Math.min(420, out.rest.vp.h) } });
    if (out.engaged) {
      out.strays = [];
      const clip = widgetClip(out.rest.vp);
      for (const t of STRAY_T) {
        await page.evaluate(pageScrub, { t, hideOuter: false });
        await sleep(150);
        const all = await page.screenshot({ clip });
        await page.evaluate(pageScrub, { t, hideOuter: true });
        await sleep(150);
        const shown = await page.screenshot({ clip });
        out.strays.push({ at: t, ...(await diffPixels(all, shown)) });
        if (SHOTS && t === 0.5) fs.writeFileSync(path.join(SHOTS, `corner-${tag}-mid.png`), all);
      }
    }
    return out;
  } catch (e) {
    return { ...out, error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * The jitter run (SQ-107 pass 5): the iris globe's centre in EVERY frame of a real-time engage and
 * release, never a scrub of getAnimations(). The entrance and the exit are slowed by their own
 * durations (--eye-in and --eye-out raised to JOLT_MS), so the browser runs the whole transition at
 * its own pace while the probe samples it. A fresh page on /privacy/ (the widget is the same node on
 * every route, and the page behind it holds still), everything but the widget hidden over a flat
 * ground and the badge's own fill hidden. Two ways to read the globe's centre:
 *   Chromium: the pixel centroid (saturation-weighted, both axes, CSS px) of a screenshot of just the
 *     lens circle and the rest iris: what the eye sees, device-pixel snapping included.
 *   WebKit: the box centre of the iris and the lens circle in a requestAnimationFrame loop. Playwright's
 *     WebKit settles a running transition when it takes a screenshot (a registered-property transition
 *     jumps to its end value on the first capture, measured), so pixels cannot be sampled there.
 * \`engage\` and \`release\` are the in-flight samples ({x, y} each, the rest iris still painted),
 * \`settledUp\` and \`settledDown\` the centre once each leg had settled (the iris gone at the end of the
 * entrance, so the hand-over is in the last jump).
 */
const JOLT_MS = 4000;
const JOLT_STEP_MS = 1500; // the beat between the groups, slowed by the same ~25x as the groups themselves
async function measureJitter(name, dpr, width) {
  const phone = width <= 480;
  const browser = await (name === 'webkit' ? webkit : chromium).launch({ headless: true, ...(name === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}) });
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: dpr, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const { default: sharp } = await import('sharp');
  try {
    await page.goto(`${BASE}/privacy/?scheme=project`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    await page.addStyleTag({ content: `.swm-corner{--eye-in:${JOLT_MS}ms !important;--eye-out:${JOLT_MS}ms !important;--eye-slide:${JOLT_MS}ms !important;--eye-grow:${JOLT_MS}ms !important;--eye-step:${JOLT_STEP_MS}ms !important}${INJECT ?? ''}` });
    await sleep(2500);
    await page.evaluate(() => {
      const root = document.querySelector('.swm-corner .fp-scale');
      const cur = getComputedStyle(root).getPropertyValue('--scale-cur').trim();
      document.querySelectorAll('.swm-corner .fp-scale__station').forEach((s) => { if (s.style.getPropertyValue('--k').trim() === cur) s.setAttribute('data-lens', ''); });
    });
    await page.addStyleTag({ content: 'html{background:#808080 !important} body *{visibility:hidden !important} .swm-corner,.swm-corner *{visibility:visible !important} .swm-corner .fp-scale::before,.swm-corner .scheme-badge{display:none !important} .swm-corner .fp-scale__station:not([data-lens]),.swm-corner .fp-scale__station:not([data-lens]) *{visibility:hidden !important} .swm-corner .scheme-eye__lid{stroke:transparent !important}' });
    const vp = { w: width, h: phone ? 844 : 900 };
    const clip = { x: vp.w - 160, y: vp.h - 160, width: 160, height: 160 };
    const pixels = async () => {
      const buf = await page.screenshot({ clip });
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let n = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < data.length; i += 3) {
        const w = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
        if (w < 8) continue;
        const p = i / 3;
        sx += w * ((p % info.width) + 0.5);
        sy += w * (Math.floor(p / info.width) + 0.5);
        n += w;
      }
      return n ? { x: clip.x + sx / n / dpr, y: clip.y + sy / n / dpr } : { x: NaN, y: NaN };
    };
    const rects = () =>
      page.evaluate(() => {
        const root = document.querySelector('.swm-corner .fp-scale');
        const iris = root.querySelector('.scheme-eye__iris');
        const lens = root.querySelector('[data-lens] svg');
        const pick = Number(getComputedStyle(iris).opacity) > 0.5 ? iris : lens;
        const r = pick.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
    const frame = () => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => { const pg = document.querySelector('.swm-corner .fp-scale'); const cs = getComputedStyle(pg); res({ open: pg.hasAttribute('data-open'), t: ['s', 'g', 'n', 'f'].reduce((a, k) => a + (+cs.getPropertyValue(`--eye-t${k}`) || 0), 0) / 4 }); })));
    const eye = await page.evaluate(() => { const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const cdp = phone ? await ctx.newCDPSession(page) : null;
    const read = name === 'webkit' ? rects : pixels;
    const leg = async (engage) => {
      if (engage) {
        if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.x, y: eye.y }] });
        else await page.mouse.move(eye.x, eye.y);
      } else if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.move(40, 40);
      const pts = [];
      const t0 = Date.now();
      let still = 0;
      while (Date.now() - t0 < 5 * JOLT_MS + 15000) {
        const f = await frame();
        const p = await read();
        pts.push({ ...p, t: f.t, open: f.open });
        if (Math.abs(f.t - (engage ? 1 : 0)) < 2e-3 && f.open === engage) { if (++still >= 3) break; } else still = 0;
      }
      const inflight = pts.filter((p) => p.t > 0.002 && p.t < 0.998);
      await sleep(500);
      const settled = await read();
      return { pts: inflight.map((p) => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) })), settled: { x: +settled.x.toFixed(3), y: +settled.y.toFixed(3) } };
    };
    const up = await leg(true);
    const down = await leg(false);
    return { engage: up.pts, settledUp: up.settled, release: down.pts, settledDown: down.settled, how: name === 'webkit' ? 'box centres per frame (WebKit: a screenshot settles a transition)' : 'pixel centroid per frame' };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * The tile's right edge on one route at one width, at rest and engaged (every route, home included):
 * the badge tile is the pager's ::before grown by its own scale about its centre.
 */
function pageTile() {
  const pager = document.querySelector('.swm-corner .fp-scale');
  if (!pager) return null;
  const b = getComputedStyle(pager, '::before');
  const px = (v) => parseFloat(v) || 0;
  const pr = pager.getBoundingClientRect();
  const k = px(b.scale) || 1;
  const cx = pr.left + px(b.left) + px(b.width) / 2;
  return { right: cx + (px(b.width) * k) / 2, vw: document.documentElement.clientWidth, open: pager.hasAttribute('data-open') };
}

async function measureEdge(ctx, scheme, urlPath, width) {
  const page = await ctx.newPage();
  const phone = width <= 480;
  try {
    await page.goto(`${BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(1200);
    const rest = await page.evaluate(pageTile);
    const eye = await page.evaluate(() => { const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (phone) await (await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.x, y: eye.y }] });
    else await page.mouse.move(eye.x, eye.y);
    await page.waitForFunction(() => document.querySelector('.swm-corner .fp-scale')?.hasAttribute('data-open'), null, { timeout: 8000 }).catch(() => {});
    await sleep(900);
    const engaged = await page.evaluate(pageTile);
    return { rest, engaged };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * The shift run's page-side reader (SQ-107 pass 10): the widget's geometry as it is now, at rest or engaged
 * (the pager has data-open). The badge tile is the pager's ::before grown by its own scale about its
 * centre (as pageTile); the circles are each station's svg, with their distance from the lens; the arrow is
 * /work's pointer (its box is its borders'), its direction read off which border is drawn.
 */
function pageShift() {
  const corner = document.querySelector('.swm-corner');
  const pager = corner?.querySelector('.fp-scale');
  if (!pager) return null;
  const px = (v) => parseFloat(v) || 0;
  const b = getComputedStyle(pager, '::before');
  const pr = pager.getBoundingClientRect();
  const k = px(b.scale) || 1;
  const w = px(b.width);
  const cx = pr.left + px(b.left) + w / 2;
  const tile = { x: cx - (w * k) / 2, w: w * k };
  const er = corner.querySelector('.scheme-eye').getBoundingClientRect();
  const pcs = getComputedStyle(pager);
  const cur = px(pcs.getPropertyValue('--scale-cur'));
  const circles = [...pager.querySelectorAll('.fp-scale__station')].map((s) => {
    const r = (s.querySelector('svg') ?? s).getBoundingClientRect();
    const kk = parseFloat(s.style.getPropertyValue('--k'));
    return { name: `k=${kk}`, d: Math.abs(kk - cur), cx: r.left + r.width / 2 };
  });
  const ptr = corner.querySelector('.fp-scale__pointer');
  const ps = getComputedStyle(ptr);
  const pb = ptr.getBoundingClientRect();
  const arrow = { x: pb.left, y: pb.top, w: ps.display === 'none' ? 0 : pb.width, h: ps.display === 'none' ? 0 : pb.height, opacity: px(ps.opacity), dir: px(ps.borderRightWidth) > 0 && px(ps.borderLeftWidth) === 0 ? 'left' : px(ps.borderLeftWidth) > 0 && px(ps.borderRightWidth) === 0 ? 'right' : 'none' };
  const lens = corner.querySelector('.fp-scale__lens').getBoundingClientRect();
  return {
    open: pager.hasAttribute('data-open'),
    vpw: document.documentElement.clientWidth,
    // The swatch (the iris's width, 26 units): the default shift is 48 of those 26ths, whatever the lids' scale.
    swatch: (() => {
      const m = document.createElement('div');
      m.style.cssText = 'position:absolute;visibility:hidden;height:0;width:var(--scheme-swatch)';
      corner.append(m);
      const w = m.getBoundingClientRect().width;
      m.remove();
      return w;
    })(),
    tx0: px(getComputedStyle(pager).translate),
    pad: px(getComputedStyle(corner).getPropertyValue('--badge-pad')),
    reach: px(pcs.getPropertyValue('--scale-slice-reach')),
    exp: px(pcs.getPropertyValue('--scale-slice-exp')),
    eye: { x: er.left, w: er.width, cx: er.left + er.width / 2, cy: er.top + er.height / 2 },
    tile,
    lensCy: lens.top + lens.height / 2,
    circles,
    arrow,
  };
}

/**
 * The shift run: one home page, motion on or reduced, the badge at rest, then engaged (a mouse hover, or a held
 * CDP touch on a phone) and settled: the geometry for gate.shift, with screenshots (engaged, then mid-scrub, a
 * ArrowDown pressed a moment ago) under --shots. S is the DEFAULT shift, one rest eye width, never read back
 * off the page.
 */
async function measureShift(browser, scheme, width, { reduced }) {
  const phone = width <= 480;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const tag = `${scheme}-${width}-${reduced ? 'reduced' : 'motion'}`;
  const shot = async (name) => {
    if (!SHOTS) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
    await page.screenshot({ path: path.join(SHOTS, `shift-${tag}-${name}.png`), clip: widgetClip(vp) }).catch(() => {});
  };
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1500);
    const rest = await page.evaluate(pageShift);
    await shot('rest');
    const cdp = phone ? await ctx.newCDPSession(page) : null;
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rest.eye.cx, y: rest.eye.cy }] });
    else await page.mouse.move(rest.eye.cx, rest.eye.cy);
    await page.waitForFunction(() => document.querySelector('.swm-corner .fp-scale')?.hasAttribute('data-open'), null, { timeout: 8000 }).catch(() => {});
    await sleep(1100);
    const engaged = await page.evaluate(pageShift);
    await shot('engaged');
    if (SHOTS) {
      await page.focus('.swm-corner .fp-scale__station').catch(() => {});
      await page.keyboard.press('ArrowDown');
      await sleep(reduced ? 60 : 90);
      await shot('mid');
      await sleep(900);
      await shot('next');
    }
    return { rest, engaged, S: (rest.swatch * 48) / 26 };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * The sequence run's page-side harness (SQ-107 pass 11): a deterministic SEEK, never real time. A MutationObserver on
 * the pager's data-open takes every CSS transition of the four progress numbers (--eye-ts|tg|tn|tf, registered
 * numbers) and of the rest iris's hand-over the moment they are created, pauses them and rewinds to 0; `seek(t)`
 * then sets every one's currentTime to `t` ms (the delays are part of the timeline) and reads the widget. Headless
 * frames starve, so a real-time sampler would measure the machine, not the choreography.
 */
function pageSeqInstall() {
  const corner = document.querySelector('.swm-corner');
  const pager = corner.querySelector('.fp-scale');
  const st = (window.__seq = { anims: [] });
  const mine = (a) => a instanceof CSSTransition && (/^--eye-t[sgnf]$/.test(a.transitionProperty) || (a.transitionProperty === 'opacity' && a.effect?.target?.matches?.('.scheme-eye__iris')));
  new MutationObserver(() => {
    st.anims = document.getAnimations().filter(mine);
    for (const a of st.anims) {
      a.pause();
      a.currentTime = 0;
    }
  }).observe(pager, { attributes: true, attributeFilter: ['data-open'] });
  const eff = (el) => {
    let o = 1;
    for (let e = el; e && !e.matches('.swm-corner'); e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  };
  st.sample = (t) => {
    const cs = getComputedStyle(pager);
    const num = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    const cur = num('--scale-cur');
    const stations = [...pager.querySelectorAll('.fp-scale__station')].map((s) => {
      const dk = parseFloat(s.style.getPropertyValue('--k')) - cur;
      return { s, dk, d: Math.abs(dk), r: (s.querySelector('svg') ?? s).getBoundingClientRect() };
    });
    // SQ-116: every circle's centre, width and badge window (its own .scheme-badge, a box, so it can be measured),
    // keyed by its station relative to the lens: u1 / u2 the first and second above, d1 / d2 below.
    const rc = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
    const info = (x) => {
      const bd = x.s.querySelector('.scheme-badge');
      return { o: eff(x.s), w: x.r.width, cx: x.r.left + x.r.width / 2, cy: x.r.top + x.r.height / 2, scheme: bd?.dataset.scheme ?? null, b: bd ? rc(bd.getBoundingClientRect()) : null };
    };
    const ring = {};
    let lensInfo = null;
    for (const x of stations) {
      if (x.d < 0.01) lensInfo = info(x);
      else if (x.d < 2.01) ring[(x.dk < 0 ? 'u' : 'd') + Math.round(x.d)] = info(x);
    }
    const pick = (d) => {
      const c = stations.filter((x) => Math.abs(x.d - d) < 0.01).sort((a, b) => a.r.top - b.r.top)[0];
      // dist: how far the circle's centre has travelled from the lens circle's (the slide, which opacity no longer shows)
      return c ? { o: eff(c.s), w: c.r.width, dist: lensInfo ? Math.abs(c.r.top + c.r.height / 2 - lensInfo.cy) : NaN } : { o: NaN, w: NaN, dist: NaN };
    };
    const eye = corner.querySelector('.scheme-eye').getBoundingClientRect();
    const pt = corner.querySelector('.fp-scale__pointer');
    const pb = pt.getBoundingClientRect();
    const lens = corner.querySelector('.fp-scale__lens').getBoundingClientRect();
    return {
      t,
      ts: num('--eye-ts'),
      tg: num('--eye-tg'),
      tn: num('--eye-tn'),
      tf: num('--eye-tf'),
      h: eye.height,
      l: eye.left,
      er: eye.right,
      n: pick(1),
      f: pick(2),
      ring,
      lens: lensInfo,
      a: { x: pb.left, w: pb.width, o: parseFloat(getComputedStyle(pt).opacity) },
      ay: pb.top + pb.height / 2,
      ly: lens.top + lens.height / 2,
      open: pager.hasAttribute('data-open'),
    };
  };
  st.seek = (times) => times.map((t) => {
    for (const a of st.anims) a.currentTime = t;
    return st.sample(t);
  });
  st.finish = () => {
    for (const a of st.anims) a.finish();
    st.anims = [];
    return st.sample(-1);
  };
  st.seekTo = (t) => {
    for (const a of st.anims) a.currentTime = t;
  };
}

/**
 * The sequence run: home, one load per width, motion on. Engage (a hover, or a held CDP touch on a phone), seek it
 * every 10 ms for 700 ms; finish it and read the settled state; release, seek it the same way; then a quick tap at
 * 100 ms and at 250 ms (engage, seek to that time, release, seek the release). With --shots (project scheme) a
 * filmstrip, a frame every 40 ms of each phase, is composed into one contact sheet. The beat, the slide and the
 * grow are read off the page's own CSS (--eye-step, --eye-slide, --eye-grow), never a literal.
 */
const SEQ_MS = 700;
async function measureSequence(browser, scheme, width) {
  const phone = width <= 480;
  const vph = phone ? 844 : 900;
  const ctx = await browser.newContext({ viewport: { width, height: vph }, deviceScaleFactor: SHOTS ? 2 : 1, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const times = Array.from({ length: SEQ_MS / 10 + 1 }, (_, i) => i * 10);
  const frameTimes = Array.from({ length: 11 }, (_, i) => i * 40);
  const strips = [];
  const clip = { x: Math.max(0, width - 230), y: Math.max(0, vph - 400), width: Math.min(230, width), height: 400 };
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=${scheme}${QUERY}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await page.evaluate(() => document.fonts.ready);
    await sleep(2500);
    const eye = await page.evaluate(() => { const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const dials = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.swm-corner'));
      const ms = (n) => parseFloat(cs.getPropertyValue(n));
      const m = document.createElement('div');
      m.style.cssText = 'position:absolute;visibility:hidden;height:0;width:var(--scheme-swatch)';
      document.querySelector('.swm-corner').append(m);
      const swatch = m.getBoundingClientRect().width;
      m.remove();
      return { step: ms('--eye-step'), slide: ms('--eye-slide'), grow: ms('--eye-grow'), swatch, farShown: ms('--eye-up-shown') >= 2 };
    });
    await page.evaluate(pageSeqInstall);
    const cdp = phone ? await ctx.newCDPSession(page) : null;
    const trigger = async (engage) => {
      await page.evaluate(() => { window.__seq.anims = []; });
      if (engage) {
        if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.x, y: eye.y }] });
        else await page.mouse.move(eye.x, eye.y);
      } else if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      else await page.mouse.move(40, 40);
      await page.waitForFunction((on) => window.__seq.anims.length > 0 && document.querySelector('.swm-corner .fp-scale').hasAttribute('data-open') === on, engage, { timeout: 8000 });
    };
    const seek = (ts) => page.evaluate((v) => window.__seq.seek(v), ts);
    const film = async () => {
      const bufs = [];
      for (const t of frameTimes) {
        await page.evaluate((v) => window.__seq.seekTo(v), t);
        bufs.push(await page.screenshot({ clip }));
      }
      strips.push(bufs);
    };
    const settle = async () => {
      const s = await page.evaluate(() => window.__seq.finish());
      await sleep(700);
      return s;
    };
    const run = { vp: { w: width }, step: dials.step, slide: dials.slide, grow: dials.grow, farShown: dials.farShown, S: (dials.swatch * 48) / 26, taps: [] };
    await trigger(true);
    run.engage = await seek(times);
    if (SHOTS) await film();
    run.settled = await settle();
    run.settled = await page.evaluate(() => window.__seq.sample(-1));
    await trigger(false);
    run.release = await seek(times);
    if (SHOTS) await film();
    await settle();
    for (const at of [100, 250]) {
      await trigger(true);
      await seek([at]);
      await trigger(false);
      const samples = await seek(times);
      run.taps.push({ at, samples });
      if (SHOTS) await film();
      await settle();
    }
    if (process.env.SWM_SEQ_DUMP) fs.writeFileSync(process.env.SWM_SEQ_DUMP.replace(/\.json$/, `-${scheme}-${width}.json`), JSON.stringify(run));
    if (SHOTS && strips.length) {
      const { default: sharp } = await import('sharp');
      fs.mkdirSync(SHOTS, { recursive: true });
      const img = await sharp(strips[0][0]).metadata();
      const fw = img.width;
      const fh = img.height;
      const comps = [];
      strips.forEach((row, r) => row.forEach((buf, c) => comps.push({ input: buf, left: c * fw, top: r * fh })));
      await sharp({ create: { width: fw * frameTimes.length, height: fh * strips.length, channels: 3, background: '#808080' } }).composite(comps).png().toFile(path.join(SHOTS, `filmstrip-${scheme}-${width}.png`));
    }
    return run;
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * The lids run (SQ-107 pass 11): is any pixel of the iris (at rest) or of the lens circle (engaged) outside the lids'
 * outer outline? One page at device pixel ratio 2, everything but the widget hidden over a flat grey, the badge's
 * own fill and every station but the lens hidden, the lids recoloured. Per state: capture A (the circle painted)
 * and B (the iris and the lens circle hidden). The lids are the only paint in B; the OUTSIDE is a flood fill from
 * the border over what is not lid, shrunk by a device pixel off the stroke (its anti-aliasing is not the circle's);
 * the LEAK is every pixel of that outside where A differs from B. With --shots the natural widget is saved at DPR 3.
 */
async function measureLids(browser, scheme, width) {
  const phone = width <= 480;
  const vph = phone ? 844 : 900;
  const ctx = await browser.newContext({ viewport: { width, height: vph }, deviceScaleFactor: SHOTS ? 3 : 2, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const { default: sharp } = await import('sharp');
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=${scheme}${QUERY}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await sleep(2500);
    await page.evaluate(() => {
      const root = document.querySelector('.swm-corner .fp-scale');
      const cur = getComputedStyle(root).getPropertyValue('--scale-cur').trim();
      document.querySelectorAll('.swm-corner .fp-scale__station').forEach((s) => { if (s.style.getPropertyValue('--k').trim() === cur) s.setAttribute('data-lens', ''); });
      const mk = (id, css, off) => {
        const st = document.createElement('style');
        st.id = id;
        st.textContent = css;
        document.head.append(st);
        st.disabled = off;
      };
      mk('swm-lids-iso', 'html{background:#808080 !important} body *{visibility:hidden !important} .swm-corner,.swm-corner *{visibility:visible !important} .swm-corner .fp-scale::before,.swm-corner .scheme-badge{display:none !important} .swm-corner .fp-scale__station:not([data-lens]),.swm-corner .fp-scale__station:not([data-lens]) *{visibility:hidden !important} .swm-corner .fp-scale__pointer{visibility:hidden !important}', false);
      mk('swm-lids-magenta', '.swm-corner .scheme-eye__lid{stroke:#ff00ff !important}', true);
      mk('swm-lids-hide', '.swm-corner .scheme-eye__iris,.swm-corner .scheme-eye__iris *,.swm-corner [data-lens],.swm-corner [data-lens] *{visibility:hidden !important}', true);
    });
    const toggle = (id, off) => page.evaluate(([i, o]) => { document.getElementById(i).disabled = o; }, [id, off]);
    const eye = await page.evaluate(() => { const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const cdp = phone ? await ctx.newCDPSession(page) : null;
    const grab = async (clipBox) => {
      const { data, info } = await sharp(await page.screenshot({ clip: clipBox })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data, w: info.width, h: info.height };
    };
    const analyse = (A, B) => {
      const { w, h } = B;
      const stroke = new Uint8Array(w * h);
      let lid = 0;
      const [r0, g0, b0] = [B.data[0], B.data[1], B.data[2]]; // the ground, read off B's corner (the page's own fill shows through)
      for (let p = 0; p < w * h; p++) {
        const i = p * 3;
        if (Math.max(Math.abs(B.data[i] - r0), Math.abs(B.data[i + 1] - g0), Math.abs(B.data[i + 2] - b0)) > 6) {
          stroke[p] = 1;
          lid++;
        }
      }
      const out = new Uint8Array(w * h);
      const stack = [];
      const push = (x, y) => {
        const p = y * w + x;
        if (!stroke[p] && !out[p]) {
          out[p] = 1;
          stack.push(p);
        }
      };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      while (stack.length) {
        const p = stack.pop();
        const x = p % w;
        const y = (p - x) / w;
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
      }
      let leak = 0;
      let circle = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const i = p * 3;
          const differs = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2])) > 6;
          if (differs) circle++;
          if (!differs || !out[p]) continue;
          // shrunk by one device pixel off the stroke: every pixel of the 3 x 3 around it is outside too
          let near = false;
          for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const qx = x + dx; const qy = y + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h || !out[qy * w + qx]) { near = true; break; } }
          if (!near) leak++;
        }
      }
      return { leak, circle, lid };
    };
    const cases = [];
    const tag = `${scheme}-${width}`;
    const state = async (name) => {
      const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
      const box = { x: Math.max(0, vp.w - 140), y: Math.max(0, vp.h - 200), width: Math.min(140, vp.w), height: 200 };
      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({ path: path.join(SHOTS, `lids-${tag}${QUERY ? '-k1' : ''}-${name}.png`), clip: box });
      }
      await toggle('swm-lids-magenta', false);
      const A = await grab(box);
      await toggle('swm-lids-hide', false);
      const B = await grab(box);
      await toggle('swm-lids-hide', true);
      await toggle('swm-lids-magenta', true);
      if (process.env.SWM_LIDS_DUMP) {
        for (const [k, im] of [['A', A], ['B', B]]) await sharp(im.data, { raw: { width: im.w, height: im.h, channels: 3 } }).png().toFile(`${process.env.SWM_LIDS_DUMP}-${tag}-${name}-${k}.png`);
      }
      cases.push({ name: `${scheme} ${width} ${name}`, ...analyse(A, B) });
    };
    await state('rest');
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.x, y: eye.y }] });
    else await page.mouse.move(eye.x, eye.y);
    await page.waitForFunction(() => document.querySelector('.swm-corner .fp-scale')?.hasAttribute('data-open'), null, { timeout: 8000 });
    await sleep(1400);
    await state('engaged');
    return { cases };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * The no-clip run: every frame of the entrance, the exit and a page through the stations (ArrowDown
 * twice, ArrowUp twice, on a focused circle) with the circles' boxes and effective opacities and the
 * boxes of every ancestor that clips (overflow other than visible, a mask, a clip-path).
 */
function pageFrameSampler() {
  window.__frames = [];
  const clipsOf = (el) => {
    const out = [];
    for (let e = el.parentElement; e && e !== document.body && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      const mask = cs.maskImage !== 'none' && cs.maskImage !== '' ? cs.maskImage : cs.webkitMaskImage !== 'none' && cs.webkitMaskImage ? cs.webkitMaskImage : null;
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || mask || cs.clipPath !== 'none') {
        const r = e.getBoundingClientRect();
        out.push({ name: `${e.localName}.${[...e.classList].slice(0, 2).join('.')}`, x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    return out;
  };
  let n = 0;
  const tick = () => {
    const stations = [...document.querySelectorAll('.swm-corner .fp-scale__station')];
    const circles = [];
    let clips = null;
    for (const s of stations) {
      let op = 1;
      for (let e = s; e && !e.matches('.swm-corner'); e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
      if (!(op > 0.01)) continue;
      const svg = s.querySelector('svg') ?? s;
      const r = svg.getBoundingClientRect();
      circles.push({ name: `circle k=${s.style.getPropertyValue('--k').trim()}`, op, x: r.left, y: r.top, w: r.width, h: r.height });
      clips ??= clipsOf(s);
    }
    window.__frames.push({ label: `f${n++}`, circles, clips: clips ?? [] });
    if (window.__frames.length < 900) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function measureClip(browser, scheme, width) {
  const phone = width <= 480;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(2500);
    const eye = await page.evaluate(() => { const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const cdp = phone ? await ctx.newCDPSession(page) : null;
    await page.evaluate(pageFrameSampler);
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.x, y: eye.y }] });
    else await page.mouse.move(eye.x, eye.y);
    await sleep(1200);
    await page.focus('.swm-corner .fp-scale__station').catch(() => {});
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp']) {
      await page.keyboard.press(key);
      await sleep(700);
    }
    if (phone) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    else await page.mouse.move(40, 40);
    await page.evaluate(() => document.activeElement?.blur?.());
    await sleep(1500);
    return { frames: await page.evaluate(() => window.__frames) };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * Soft navigations with motion ON (a fade is a transition, and the probe's other contexts reduce
 * motion): home to /work to a project page and back, by the nav pill on desktop and by the menu on a
 * phone. Every frame samples the widget: the identity mark stamped on the node before the first click,
 * its computed opacity and its visibility.
 */
async function measurePersist(browser, scheme, width) {
  const phone = width <= 480;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const { default: sharp } = await import('sharp');
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 90000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(3000);
    await page.evaluate(() => {
      const tag = `persisted-${Math.random()}`;
      document.querySelector('.swm-corner').dataset.probeId = tag;
      window.__persist = [];
      const sample = () => {
        const c = document.querySelector('.swm-corner');
        if (!c) window.__persist.push({ gone: true });
        else {
          const cs = getComputedStyle(c);
          const m = document.documentElement.hasAttribute('data-menu-open') || (document.querySelector('.mobile-menu') && getComputedStyle(document.querySelector('.mobile-menu')).visibility === 'visible');
          if (m) window.__menuT = performance.now();
          window.__persist.push({ same: c.dataset.probeId === tag, op: cs.opacity, vis: cs.visibility, menu: performance.now() - (window.__menuT ?? -1e9) < 700 });
        }
        requestAnimationFrame(sample);
      };
      sample();
    });
    // The badge's paint: a screenshot of its tile, counted for the pixels that are not the clip's most common
    // colour (the iris, the lids and the strips make plenty at rest; a route fill laid over it makes none).
    const tile = await page.evaluate(pageWidgetRest).then((r) => r.tile);
    const clip = { x: Math.max(0, tile.x - 2), y: Math.max(0, tile.y - 2), width: Math.ceil(tile.w) + 4, height: Math.ceil(tile.h) + 4 };
    const window_rest = { n: 0 };
    let t0 = Date.now();
    const paint = async () => {
      const buf = await page.screenshot({ clip });
      const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const key = (i) => `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
      const hist = new Map();
      for (let i = 0; i < data.length; i += 3) hist.set(key(i), (hist.get(key(i)) ?? 0) + 1);
      const modal = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map((v) => (Number(v) << 4) + 8);
      let n = 0;
      for (let i = 0; i < data.length; i += 3) if (Math.max(Math.abs(data[i] - modal[0]), Math.abs(data[i + 1] - modal[1]), Math.abs(data[i + 2] - modal[2])) > 48) n++;
      if (SHOTS && n < 0.25 * (window_rest.n || 0)) {
        fs.mkdirSync(SHOTS, { recursive: true });
        fs.writeFileSync(path.join(SHOTS, `persist-covered-${width}-${Date.now() - t0}.png`), buf);
        await page.screenshot({ path: path.join(SHOTS, `persist-covered-${width}-${Date.now() - t0}-viewport.png`) }).catch(() => {});
      }
      return n;
    };
    // The phone menu's takeover covers the badge by design (an open call): its frames, and the wipe-down after (0.35 s), are not the passage's.
    const menuUp = () => page.evaluate(() => performance.now() - (window.__menuT ?? -1e9) < 700);
    const rests = [];
    for (let i = 0; i < 3; i++) rests.push(await paint());
    const rest = rests.sort((a, b) => a - b)[1];
    window_rest.n = rest;
    const pixels = [];
    t0 = Date.now();
    let looping = true;
    const loop = (async () => {
      while (looping) {
        const menu = phone ? await menuUp().catch(() => false) : false;
        const n = await paint().catch(() => null);
        if (n != null && !menu) pixels.push({ t: Date.now() - t0, n });
      }
    })();
    const steps = [];
    const settle = async (label) => {
      await sleep(3500);
      steps.push(`${label} -> ${new URL(page.url()).pathname}`);
    };
    const menuTo = async (href) => {
      await page.evaluate(() => { window.__menuT = performance.now(); }); // the burger's click starts the takeover's wipe a frame before the latch
      await page.locator('.site-nav__burger, button[aria-label*="enu" i]').first().click({ timeout: 30000 });
      await sleep(1200);
      await page.locator(`.mobile-menu a[href="${href}"]`).first().click({ timeout: 30000 });
    };
    if (phone) await menuTo('/work');
    else await page.locator('a[href="/work"]:visible').first().click({ timeout: 30000 });
    await settle('to /work');
    const href = await page.evaluate(() => [...document.querySelectorAll('a[href^="/work/"]')].map((a) => a.getAttribute('href')).find((h) => !h.includes('directory')));
    if (href) {
      await page.evaluate((h) => document.querySelector(`a[href="${h}"]`).click(), href);
      await settle(`to ${href}`);
    }
    if (phone) await menuTo('/');
    else await page.locator('a[href="/"]:visible').first().click({ timeout: 30000 });
    await settle('to /');
    looping = false;
    await loop;
    return { samples: await page.evaluate(() => window.__persist), steps, pixels, rest };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * The badge's gap above the viewport's bottom edge on one route at one width: at rest, then at the footer's end
 * state (scrolled to the end; a wheel as well, which is what reveals the footer on home).
 */
async function measureSeat(ctx, scheme, urlPath, label) {
  const page = await ctx.newPage();
  const gapOf = async () => {
    const r = await page.evaluate(pageWidgetRest);
    return r?.tile ? { gap: r.vp.h - (r.tile.y + r.tile.h), clear: r.ref.clear } : { gap: NaN, clear: null };
  };
  try {
    await page.goto(`${BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}scheme=${scheme}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 30000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(1500);
    const out = [{ label: `${label} rest`, ...(await gapOf()) }];
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.mouse.move(200, 300);
    await page.mouse.wheel(0, 4000);
    await sleep(2200);
    out.push({ label: `${label} end`, ...(await gapOf()) });
    return out;
  } catch (e) {
    return [{ label: `${label}`, gap: NaN, error: String(e.message).split('\n')[0].slice(0, 160) }];
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * The fan gate's panel pixels (SQ-116): the engaged column settled, over a flat page with only the widget's boxes
 * painted (the art hidden), one pixel read inside each shown ring circle's own window, in the strip of padding between
 * the window's left edge and its circle. The colour under it is that circle's scheme's panel, whatever the page is.
 */
async function measureFan(browser, scheme, width) {
  const phone = width <= 480;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const { default: sharp } = await import('sharp');
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/privacy/?scheme=${scheme}${QUERY}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(2000);
    await page.addStyleTag({ content: 'html{background:#e0e0e0 !important} body *{visibility:hidden !important} .swm-corner,.swm-corner *{visibility:visible !important} .swm-corner svg,.swm-corner svg *{visibility:hidden !important}' });
    await page.evaluate(pageSeqInstall);
    const eye = await page.evaluate(() => { const r = document.querySelector('.swm-corner .scheme-eye').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    if (phone) await (await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: eye.x, y: eye.y }] });
    else await page.mouse.move(eye.x, eye.y);
    await page.waitForFunction(() => window.__seq.anims.length > 0, null, { timeout: 8000 });
    await page.evaluate(() => window.__seq.finish());
    await sleep(900);
    const settled = await page.evaluate(() => window.__seq.sample(-1));
    const panels = [];
    for (const [id, c] of Object.entries(settled.ring ?? {})) {
      if (!(c.o > 0.05) || !c.b) continue;
      const x = Math.floor(c.b.x + 0.25 * (c.cx - c.w / 2 - c.b.x));
      // on its centre line, kept inside the viewport (the circle below the lens hangs past the bottom edge at 1440 x 900)
      const y = Math.floor(Math.min(Math.max(c.cy, c.b.y + 1), c.b.y + c.b.h - 1, (phone ? 844 : 900) - 3));
      const buf = await page.screenshot({ clip: { x, y, width: 2, height: 2 } });
      const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      panels.push({ id, scheme: c.scheme, rgb: [data[0], data[1], data[2]], at: [x, y] });
    }
    return { panels };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/**
 * The strip gate's frames: only the badge painted, over a flat page; the middle column of a screenshot of its
 * tile, for the real engine (ArrowDown x3, each detent settled) and for --scale-qf set by hand (whole and
 * fractional values, the way the engine writes it per frame).
 */
async function measureStrip(browser, width) {
  const phone = width <= 480;
  const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 2, reducedMotion: 'no-preference', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const { default: sharp } = await import('sharp');
  const frames = [];
  const column = async (page) => {
    const t = await page.evaluate(() => {
      const pager = document.querySelector('.swm-corner .fp-scale');
      const b = getComputedStyle(pager, '::before');
      const px = (v) => parseFloat(v) || 0;
      const pr = pager.getBoundingClientRect();
      const k = px(b.scale) || 1;
      const w = px(b.width);
      const h = px(b.height);
      const cx = pr.left + px(b.left) + w / 2;
      const cy = pr.top + px(b.top) + h / 2;
      return { x: cx - (w * k) / 2, y: cy - (h * k) / 2, w: w * k, h: h * k };
    });
    // Inside the tile: the buffer is the tile exactly (device pixels), read down its middle column.
    const buf = await page.screenshot({ clip: { x: t.x, y: t.y, width: t.w, height: t.h } });
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const cx = Math.floor(info.width / 2);
    const col = [];
    for (let y = 1; y < info.height - 1; y++) col.push([data[(y * info.width + cx) * 3], data[(y * info.width + cx) * 3 + 1], data[(y * info.width + cx) * 3 + 2]]);
    return col;
  };
  const flat = 'html{background:#e0e0e0 !important} body *{visibility:hidden !important} .swm-corner,.swm-corner *{visibility:visible !important} .swm-corner svg,.swm-corner svg *{visibility:hidden !important}';
  const open = async () => {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/privacy/?scheme=project`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 60000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(2000);
    await page.addStyleTag({ content: flat });
    return page;
  };
  try {
    // The real engine: each ArrowDown moves the strip one detent, and a settled detent shows one panel.
    const live = await open();
    await live.focus('.swm-corner .fp-scale__station').catch(() => {});
    await sleep(1200);
    for (let i = 0; i < 3; i++) {
      await live.keyboard.press('ArrowDown');
      await sleep(1600);
      const q = await live.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.swm-corner .fp-scale')).getPropertyValue('--scale-qf')));
      frames.push({ q, col: await column(live), live: true });
    }
    await live.close();
    // The strip by hand: --scale-qf as the engine writes it each frame.
    const page = await open();
    for (const q of [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 2.75, 3, 3.5]) {
      await page.evaluate((v) => document.querySelector('.swm-corner .fp-scale').style.setProperty('--scale-qf', v), q);
      await sleep(150);
      frames.push({ q, col: await column(page) });
    }
    // SQ-125: a band is the badge plus --badge-strip-pad a side (0 on a build without it); the frames are read at DPR 2.
    const pad = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.swm-corner')).getPropertyValue('--badge-strip-pad')) || 0);
    return { frames, margin: pad * 2 };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
  }
}

// ── reporting ───────────────────────────────────────────────────────────────────────────────

let failures = 0;
let passes = 0;
let skips = 0;
const emit = (status, scheme, route, width, name, text, offenders = []) => {
  if (status === 'FAIL') failures++;
  else if (status === 'PASS') passes++;
  else skips++;
  console.log(`${status.padEnd(4)}  ${scheme.padEnd(8)} ${String(route).padEnd(10)} ${String(width).padStart(4)}  ${name.padEnd(10)} ${text}`);
  for (const o of offenders.slice(0, 15)) console.log(`        ${gate.describeOffender(o)}`);
  if (offenders.length > 15) console.log(`        … ${offenders.length - 15} more`);
};
const emitResult = (scheme, route, width, name, res, tag = '') =>
  emit(res.pass ? 'PASS' : 'FAIL', scheme, route, width, name, `${res.offenders.length} offenders${tag} — ${res.note}`, res.pass ? [] : res.offenders);

const merge = (rs) => ({ pass: rs.every((r) => r.pass), offenders: rs.flatMap((r) => r.offenders), note: rs.map((r) => r.note).join('; ') });

/** The corner widget's gates for one scheme at one width: at rest and engaged, then the soft navigations. */
async function widgetPass(ctx, browser, scheme, width, want, seatExtra = []) {
  const asked = WIDGET_GATES.filter((g) => want.has(g));
  if (!asked.length) return;
  const route = 'corner';
  if (asked.some((g) => ['badge', 'blurb', 'above', 'eyeLines', 'bounds', 'strays'].includes(g))) {
    const w = await measureWidget(ctx, scheme, width);
    if (w.error || !w.rest) emit('FAIL', scheme, route, width, 'widget', w.error ?? 'no widget measured');
    else {
      const { rest, engaged } = w;
      const run = (name, fn) => {
        if (want.has(name)) emitResult(scheme, route, width, name, fn());
      };
      // Above 768px the expected centre is the desktop seat the stylesheet declares (SQ-121: on the blurb, one height on every route); the clear gate holds it against the blurb.
      run('badge', () => gate.badge(rest.tile, rest.vp, { eye: rest.eye, rowCy: rest.ref.phone ? rest.ref.rowCy : rest.ref.seatCy, clear: rest.ref.clear }));
      run('blurb', () => gate.blurbClear(rest.tile, rest.blurb));
      run('above', () => gate.circlesAbove({ vpw: rest.vp.w, lensCy: rest.eye?.cy, circles: (engaged?.circles ?? []).map((x) => ({ ...x, op: x.eop })), blurb: rest.blurb }));
      run('eyeLines', () => gate.eyeLines(rest.strokes));
      run('bounds', () => {
        if (!engaged) return { pass: false, offenders: [{ path: '.swm-corner .fp-scale', note: 'the pager never engaged (data-open)' }], note: 'not engaged' };
        // The viewport's edge is the one hard edge the design allows: x is held to it, y is not (the circle below the lens is cut by the bottom).
        const vp = { name: 'viewport', x: 0, y: 0, w: rest.vp.w, h: rest.vp.h };
        return merge([gate.bounds(engaged.circles, engaged.window, { axis: 'x' }), gate.bounds(engaged.circles, vp, { axis: 'x' })]);
      });
      run('strays', () => {
        if (!w.strays?.length) return { pass: false, offenders: [{ path: '.fp-scale__station', note: 'the pager never engaged (data-open)' }], note: 'not engaged' };
        return merge(w.strays.map((d) => gate.strays(d)));
      });
    }
  }
  if (want.has('shift')) {
    const parts = [];
    for (const reduced of [true, false]) {
      const m = await measureShift(browser, scheme, width, { reduced });
      const label = reduced ? 'reduced' : 'motion';
      if (m.error || !m.rest || !m.engaged) emit('FAIL', scheme, route, width, 'shift', `${label}: ${m.error ?? 'nothing measured'}`);
      else {
        const e = m.engaged;
        const rest = m.rest;
        parts.push(gate.shift({ vp: { w: e.vpw }, S: m.S, reach: e.reach, exp: e.exp, rest: { eye: rest.eye, tile: rest.tile, pad: rest.pad, arrow: rest.arrow }, engaged: e }, { label }));
      }
    }
    if (parts.length) emitResult(scheme, route, width, 'shift', merge(parts));
  }
  // the sequence and the fan gates read the same seeked run: measure it once per scheme and width
  let seqRun = null;
  const seqOnce = async () => (seqRun ??= await measureSequence(browser, scheme, width));
  if (want.has('sequence')) {
    const m = await seqOnce();
    if (m.error) emit('FAIL', scheme, route, width, 'sequence', m.error);
    else emitResult(scheme, route, width, 'sequence', gate.sequence(m));
  }
  if (want.has('fan')) {
    const m = await seqOnce();
    const f = m.error ? m : await measureFan(browser, scheme, width);
    if (f.error) emit('FAIL', scheme, route, width, 'fan', f.error);
    else emitResult(scheme, route, width, 'fan', gate.fanout({ ...m, panels: f.panels }));
  }
  if (want.has('lids')) {
    const m = await measureLids(browser, scheme, width);
    if (m.error) emit('FAIL', scheme, route, width, 'lids', m.error);
    else emitResult(scheme, route, width, 'lids', gate.lids(m));
  }
  if (want.has('noClip')) {
    const c = await measureClip(browser, scheme, width);
    if (c.error) emit('FAIL', scheme, route, width, 'noClip', c.error);
    else emitResult(scheme, route, width, 'noClip', gate.noClip(c.frames));
  }
  if (want.has('jitter')) {
    if (scheme !== 'project') emit('SKIP', scheme, route, width, 'jitter', 'measured on project only (the globe strips it reads are the same in every scheme)');
    else {
      // Chromium at both pixel densities everywhere; WebKit at desktop widths (a held touch is a CDP event, Chromium only).
      const legs = width <= 480 ? [['chromium', 1], ['chromium', 2]] : [['chromium', 1], ['chromium', 2], ['webkit', 1], ['webkit', 2]];
      for (const [b, dpr] of legs) {
        let j = await measureJitter(b, dpr, width);
        // A loaded machine screenshots slowly and a slowed leg can end with under the 8 frames the gate needs: one more run.
        if (!j.error && (j.engage.length < 8 || j.release.length < 8)) j = await measureJitter(b, dpr, width);
        const where = `${route}:${b}@${dpr}x`;
        if (j.error) emit('FAIL', scheme, where, width, 'jitter', j.error);
        else {
          if (process.env.JITTER_DEBUG) console.log(JSON.stringify(j));
          emitResult(scheme, where, width, 'jitter', gate.jitter(j));
        }
      }
    }
  }
  if (want.has('strip')) {
    if (scheme !== 'project') emit('SKIP', scheme, route, width, 'strip', 'measured on project only (the strip is the same under every scheme)');
    else {
      const st = await measureStrip(browser, width);
      if (st.error) emit('FAIL', scheme, route, width, 'strip', st.error);
      else emitResult(scheme, route, width, 'strip', gate.strip(st.frames, { margin: st.margin }));
    }
  }
  if (want.has('seat')) {
    const paths = [['home', '/'], ['work', '/work/'], ['directory', '/work/directory/'], ['process', '/process/'], ['privacy', '/privacy/'], ...(seatExtra ?? [])];
    const gaps = [];
    for (const [label, urlPath] of paths) gaps.push(...(await measureSeat(ctx, scheme, urlPath, label)));
    for (const g of gaps.filter((x) => x.error)) emit('FAIL', scheme, route, width, 'seat', `${g.label}: ${g.error}`);
    emitResult(scheme, route, width, 'seat', gate.seat(gaps));
  }
  if (want.has('persist')) {
    const p = await measurePersist(browser, scheme, width);
    if (p.error) emit('FAIL', scheme, route, width, 'persist', p.error);
    else {
      const res = gate.persist(p.samples, { pixels: p.pixels, rest: p.rest });
      res.note += ` (${p.steps.join('; ')})`;
      emitResult(scheme, route, width, 'persist', res);
    }
  }
  if (want.has('menu')) {
    if (width > 480) emit('SKIP', scheme, route, width, 'menu', 'the takeover is the phone menu (768 px and below): measured at 390');
    else if (scheme !== 'project') emit('SKIP', scheme, route, width, 'menu', 'measured once, on the project run (the page loads blue itself for the pixels)');
    else {
      for (const [b, reduced] of [['chromium', false], ['webkit', false], ['chromium', true], ['webkit', true]]) {
        const where = `${route}:${b}${reduced ? '-reduced' : ''}`;
        const m = await measureMenuWipe(b, width, { reduced });
        if (m.error) emit('FAIL', scheme, where, width, 'menu', m.error);
        else {
          const res = gate.menuWipe(m.frames, m.tile, { pixels: m.pixels, reduced });
          res.note += `, ${m.slow ? 'slowed near the badge' : 'real time'}, ended on ${m.ended}`;
          emitResult(scheme, where, width, 'menu', res);
        }
      }
    }
  }
}

/**
 * The phone menu wipes OVER the badge (SQ-107 pass 8): 390 x 844, Chromium and WebKit, through four phases,
 * the menu open, a hold, the close, and a page change made from the menu. A requestAnimationFrame sampler in
 * the page records, every frame, the takeover's rendered top (the edge: its inset clip-path read off the
 * computed style, in px), the badge's opacity, visibility and inert flag, and the root stacking level of
 * each (the outermost ancestor's z-index). The wipe is steep at its launch and the badge is in the bottom
 * 50 px, so at real speed the edge crosses its box in a frame or two: while the edge is within 40 px of the
 * box the sampler slows gsap's global timeline to MENU_SLOW (the same tween and ease, only slower), so
 * several frames and screenshots land on it. The gsap module is found among the page's loaded resources
 * (the dev server's /deps/gsap.js, the one instance the site uses): a build has no such file, the run then
 * is real time and the gate says the edge was not caught. The pixel pass screenshots the badge's box (blue
 * scheme: a blue badge against the black menu) with the edge read before and after each shot.
 * `reduced`: reduced motion, the menu snaps, no slow motion and no pixels.
 */
const MENU_SLOW = 0.03;
async function measureMenuWipe(name, width, { reduced = false } = {}) {
  const browser = await (name === 'webkit' ? webkit : chromium).launch({ headless: true, ...(name === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}) });
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: true, hasTouch: true });
  await ctx.route(/stream\.mux\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const { default: sharp } = await import('sharp');
  try {
    await page.goto(`${BASE}/?popseed=1&scheme=blue`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 90000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await sleep(3000);
    const tile = (await page.evaluate(pageWidgetRest))?.tile;
    if (!tile) return { error: 'no badge rectangle' };
    await page.waitForSelector('.mobile-menu', { state: 'attached', timeout: 30000 });
    const slow = await page.evaluate(
      async ({ k, lo, hi, on }) => {
        const url = performance.getEntriesByType('resource').map((r) => r.name).find((n) => /\/deps\/gsap\.js/.test(n));
        const gsap = on && url ? (await import(url)).gsap : null;
        const level = (el) => {
          let z = null;
          for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
            const cs = getComputedStyle(n);
            if (cs.position !== 'static' && cs.zIndex !== 'auto') z = Number(cs.zIndex);
          }
          return z;
        };
        const mw = (window.__mw = { frames: [], phase: 'idle' });
        const tick = () => {
          const menu = document.querySelector('.mobile-menu');
          const badge = document.querySelector('.swm-corner');
          if (!badge) mw.frames.push({ phase: mw.phase, gone: true });
          else if (menu) {
            const ms = getComputedStyle(menu);
            const bs = getComputedStyle(badge);
            const h = menu.getBoundingClientRect().height;
            const op = Number(ms.opacity);
            const up = ms.visibility !== 'hidden' && op > 0;
            let edge = h;
            if (up) {
              const m = /inset\(\s*([-\d.]+)(%|px)/.exec(ms.clipPath);
              edge = m ? (m[2] === '%' ? (parseFloat(m[1]) / 100) * h : parseFloat(m[1])) : h * (1 - op);
            }
            mw.frames.push({ phase: mw.phase, edge, h, up, zMenu: level(menu), zBadge: level(badge), op: bs.opacity, vis: bs.visibility, inert: badge.inert });
            if (gsap) gsap.globalTimeline.timeScale(edge > lo && edge < hi ? k : 0.5);
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        return !!gsap;
      },
      { k: MENU_SLOW, lo: tile.y - 40, hi: tile.y + tile.h + 40, on: !reduced }
    );
    const phase = (p) => page.evaluate((v) => { window.__mw.phase = v; }, p);
    const last = (key) => page.evaluate((k) => window.__mw.frames.at(-1)?.[k], key);
    const waitFor = async (fn, ms, label) => {
      const t = Date.now();
      while (Date.now() - t < ms) {
        if (await fn()) return;
        await sleep(30);
      }
      throw new Error(`the menu never ${label}`);
    };
    const clip = { x: Math.floor(tile.x), y: Math.floor(tile.y), width: Math.ceil(tile.w) + 1, height: Math.ceil(tile.h) + 1 };
    // What the menu itself paints in the badge's box (its privacy link sits there too), read in the hold
    // with the menu fully up, is the reference: a row under the edge must equal it, a row above must not.
    const decode = async (buf) => {
      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data, width: info.width };
    };
    const raws = [];
    let inPhase = 'idle';
    const shoot = async () => {
      if (inPhase === 'change') return; // the destination's own menu colour: the geometry gate covers it
      const e0 = await last('edge');
      const buf = await page.screenshot({ clip });
      const e1 = await last('edge');
      raws.push({ e0, e1, ...(await decode(buf)) });
    };
    const shares = (ref) => {
      // Only the badge's own pixels: its box less one pixel of anti-aliasing all round.
      const x0 = Math.ceil(tile.x) - clip.x + 1;
      const x1 = Math.floor(tile.x + tile.w) - clip.x - 1;
      const y0 = Math.ceil(tile.y) - clip.y + 1;
      const y1 = Math.floor(tile.y + tile.h) - clip.y - 1;
      return raws.map((r) => {
        const rows = [];
        for (let y = y0; y <= y1; y++) {
          let n = 0;
          for (let x = x0; x <= x1; x++) {
            const i = (y * r.width + x) * 3;
            if (Math.max(Math.abs(r.data[i] - ref.data[i]), Math.abs(r.data[i + 1] - ref.data[i + 1]), Math.abs(r.data[i + 2] - ref.data[i + 2])) <= 40) n++;
          }
          rows.push({ y: clip.y + y, share: n / (x1 - x0 + 1) });
        }
        return { e0: r.e0, e1: r.e1, rows };
      });
    };
    const burger = () => page.locator('button[aria-label="Open menu"]').first().click({ timeout: 30000 });
    const wipe = async (until, label) => {
      const t = Date.now();
      while (Date.now() - t < 90000) {
        if (await until()) return;
        if (!reduced && slow) await shoot();
        else await sleep(30);
      }
      throw new Error(`the menu never ${label}`);
    };
    const isUp = async () => (await last('edge')) <= 1;
    const isDown = async () => (await last('up')) === false;
    const go = async (p) => {
      inPhase = p;
      await phase(p);
    };
    await go('open');
    await burger();
    await wipe(isUp, 'came up');
    await go('hold');
    await sleep(1500);
    const ref = await decode(await page.screenshot({ clip }));
    await go('close');
    await page.locator('.mobile-menu__close').first().click({ timeout: 30000 });
    await wipe(isDown, 'went down');
    await sleep(400);
    await go('change-open');
    await burger();
    await wipe(isUp, 'came up again');
    await go('change');
    await sleep(1200);
    await page.locator('.mobile-menu a[href="/work"]').first().click({ timeout: 30000 });
    await wipe(isDown, 'went down after the page change');
    await sleep(500);
    const ended = new URL(page.url()).pathname;
    const frames = await page.evaluate(() => { const f = window.__mw.frames; window.__mw.frames = []; return f; });
    return { frames, tile, pixels: reduced || !slow ? null : shares(ref), slow, ended };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** The right-edge gate: every route at 390, 1024, 1440 and 1920, at rest and engaged (once per scheme). */
async function edgePass(browser, scheme) {
  const samples = [];
  for (const width of EDGE_WIDTHS) {
    const phone = width <= 480;
    const ctx = await browser.newContext({ viewport: { width, height: phone ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', ...(phone ? { isMobile: true, hasTouch: true } : {}) });
    await installRoutes(ctx);
    for (const [key, p] of EDGE_ROUTES) {
      const m = await measureEdge(ctx, scheme, p, width);
      if (m.error || !m.rest) {
        samples.push({ label: `${key}@${width}`, right: NaN, vw: NaN });
        continue;
      }
      samples.push({ label: `${key}@${width} rest`, right: m.rest.right, vw: m.rest.vw });
      samples.push(m.engaged?.open ? { label: `${key}@${width} engaged`, right: m.engaged.right, vw: m.engaged.vw } : { label: `${key}@${width} engaged`, right: NaN, vw: NaN });
    }
    await ctx.close().catch(() => {});
  }
  emitResult(scheme, 'corner', EDGE_WIDTHS.join('/'), 'rightEdge', gate.rightEdge(samples));
}

/**
 * The bands gate's pixels (SQ-125, Nathan 11-18: "whats the thin color strip at the bottom of the rest and engaged chips"): the
 * badge alone over a flat grey page (everything else hidden; the pager's children at opacity 0, never visibility, so the hover that
 * engaged it holds), the mean colour of each pixel row of a screenshot of the tile's width, from 4 device-independent px above it to 4
 * below. `keep` leaves the isolating style on for the next read.
 */
const BAND_ISOLATE = 'html,body{background:#808080 !important} body *{visibility:hidden !important} .swm-corner,.swm-corner *{visibility:visible !important} .swm-corner .fp-scale *{opacity:0 !important}';
async function bandRows(page, tile, { keep }) {
  const { default: sharp } = await import('sharp');
  await page.evaluate((css) => {
    if (document.getElementById('swm-probe-bands')) return;
    const st = document.createElement('style');
    st.id = 'swm-probe-bands';
    st.textContent = css;
    document.head.append(st);
  }, BAND_ISOLATE);
  await sleep(250);
  const clip = { x: Math.floor(tile.x) + 3, y: Math.floor(tile.y) - 4, width: Math.max(4, Math.floor(tile.w) - 6), height: Math.ceil(tile.h) + 8 };
  const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = [];
  for (let y = 0; y < info.height; y++) {
    const sum = [0, 0, 0];
    for (let x = 0; x < info.width; x++) for (let c = 0; c < 3; c++) sum[c] += data[(y * info.width + x) * 3 + c];
    rows.push(sum.map((v) => v / info.width));
  }
  if (!keep) await page.evaluate(() => document.getElementById('swm-probe-bands')?.remove());
  return rows;
}

/** Each band's colour over that flat page: the tile's middle row with --scale-qf held at 0, 1 and 2 (glass, black, blue). */
async function bandPalette(page, tile) {
  const palette = {};
  for (const [name, q] of [['glass', 0], ['black', 1], ['blue', 2]]) {
    await page.evaluate((v) => document.querySelector('.swm-corner .fp-scale').style.setProperty('--scale-qf', v), q);
    await sleep(150);
    const rows = await bandRows(page, tile, { keep: true });
    palette[name] = rows[Math.floor(rows.length / 2)];
  }
  await page.evaluate(() => document.querySelector('.swm-corner .fp-scale').style.removeProperty('--scale-qf'));
  return palette;
}

/** The bands gate over one measureStates run: the rest badge and the engaged one. */
const bandStates = (scheme, where, m) => ['rest', 'engaged'].map((state) => ({ label: `${scheme} ${where} ${state}`, rows: m.bands[state], palette: m.bands.palette }));

/**
 * The widget at rest, then engaged and settled (a hover on a desktop, a held CDP touch on a phone), on one page of one
 * route, as pageClear measures it (SQ-121). `path` carries its own query; the scheme is appended. Motion is reduced, so
 * the engaged state is the settled one.
 */
async function measureStates(ctx, scheme, urlPath, { bands = false } = {}) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${urlPath}${urlPath.includes('?') ? '&' : '?'}scheme=${scheme}${QUERY}`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => window.__swmCommitted && window.__swmCommitted(), null, { timeout: 40000 }).catch(() => {});
    await page.waitForSelector('.swm-corner[data-ready]', { timeout: 30000 });
    if (INJECT) await page.addStyleTag({ content: INJECT });
    await page.evaluate(() => document.fonts.ready);
    await sleep(1200);
    const rest = await page.evaluate(pageClear);
    const eye = rest?.eye;
    if (!eye) return { error: 'no .scheme-eye to engage' };
    const restRows = bands && rest.tile ? await bandRows(page, rest.tile, { keep: false }) : null;
    const cx = eye.x + eye.w / 2;
    const cy = eye.y + eye.h / 2;
    if (rest.vp.w <= 480) await (await ctx.newCDPSession(page)).send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    else await page.mouse.move(cx, cy);
    await page.waitForFunction(() => document.querySelector('.swm-corner .fp-scale')?.hasAttribute('data-open'), null, { timeout: 8000 }).catch(() => {});
    await sleep(900);
    const engaged = await page.evaluate(pageClear);
    if (!bands || !engaged?.tile) return { rest, engaged };
    const engagedRows = await bandRows(page, engaged.tile, { keep: true });
    return { rest, engaged, bands: { rest: restRows, engaged: engagedRows, palette: await bandPalette(page, engaged.tile) } };
  } catch (e) {
    return { error: String(e.message).split('\n')[0].slice(0, 240) };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * The clear gate (SQ-121): on home, above 768px, at rest and engaged, nothing of the widget meets the footer blurb's
 * text or the privacy pill, and at rest the badge is wholly above the text. SQ-125: the bottom edge of the engaged column's
 * lowest visible part (the ring under the lens) is the dialed gap (4 px, ?schemeblurbgap) above the black panel's top edge, within 0.5 px, at five viewports (the
 * probe's other widgets run 1440 x 900 and 390 x 844), once per scheme whatever --width is. Phones are the phone gate's.
 */
const CLEAR_VIEWPORTS = [[1440, 900], [1024, 768], [1280, 800], [1920, 1080], [2560, 1440]];
const CLEAR_GAP = Number(arg('gap', 4)); // Nathan's number (SQ-125, 11-18: 2, then "lets bump the gap to 4 px"), the gate's own: a ?schemeblurbgap re-dial fails it unless this follows (--gap=8)
const BAND_DPR = Number(arg('dpr', 1)); // the bands gate's device pixel ratio (a hand run at 2 or 3 reads the retina rows)
async function clearPass(browser, scheme, want) {
  for (const [width, height] of CLEAR_VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: BAND_DPR, reducedMotion: 'reduce' });
    await installRoutes(ctx);
    await ctx.addInitScript(hydrationHook);
    const m = await measureStates(ctx, scheme, '/?popseed=1', { bands: true });
    await ctx.close().catch(() => {});
    const where = `${width}x${height}`;
    if (m.error || !m.rest?.tile || !m.engaged?.open) {
      for (const g of ['clear', 'bands']) if (want.has(g) || g === 'bands') emit('FAIL', scheme, 'home', where, g, m.error ?? 'the pager never engaged (data-open)');
      continue;
    }
    if (want.has('clear')) emitResult(scheme, 'home', where, 'clear', gate.clearOfBlurb(m, { gap: CLEAR_GAP }));
    emitResult(scheme, 'home', where, 'bands', gate.bandEdges(bandStates(scheme, where, m)));
  }
}

/**
 * The bands gate on a phone (SQ-125): 390 x 844 home, rest and held (the CDP touch), every scheme: the badge is its settled band to
 * the first and last pixel row. The strip's paint is the one thing the desktop seat change leaves on a phone; its rects are the phone gate's.
 */
async function bandsPhonePass(browser, scheme, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: BAND_DPR, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await installRoutes(ctx);
  await ctx.addInitScript(hydrationHook);
  const m = await measureStates(ctx, scheme, ROUTE_PATHS.home, { bands: true });
  await ctx.close().catch(() => {});
  if (m.error || !m.engaged?.open || !m.bands) emit('FAIL', scheme, 'home', width, 'bands', m.error ?? 'the pager never engaged (data-open)');
  else emitResult(scheme, 'home', width, 'bands', gate.bandEdges(bandStates(scheme, `${width}x844`, m)));
}

/**
 * The phone gate (SQ-121): every route's widget rects at 390 x 844, at rest and engaged, against a capture of the base
 * build (--capture on that build's run, --compare on this one). Nothing above 768px may move a phone's badge or rings.
 */
const PHONE_ROUTES = [['home', ROUTE_PATHS.home], ['work', ROUTE_PATHS.work], ['directory', ROUTE_PATHS.directory], ['privacy', ROUTE_PATHS.privacy], ['404', ROUTE_PATHS[404]]];
async function phonePass(browser, scheme, width, baseline, captured) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: true, hasTouch: true });
  await installRoutes(ctx);
  await ctx.addInitScript(hydrationHook);
  const now = {};
  for (const [key, p] of PHONE_ROUTES) {
    const m = await measureStates(ctx, scheme, p);
    if (m.error || !m.engaged?.open) {
      emit('FAIL', scheme, key, width, 'phone', m.error ?? 'the pager never engaged (data-open)');
      continue;
    }
    for (const state of ['rest', 'engaged']) now[`${key}:${state}`] = { tile: m[state].tile, eye: m[state].eye, parts: m[state].parts.filter((x) => x.op > 0.01) };
  }
  await ctx.close().catch(() => {});
  captured.phone[`${scheme}@${width}`] = now;
  const base = baseline?.phone?.[`${scheme}@${width}`];
  if (!baseline) emit('SKIP', scheme, 'phone*', width, 'phone', 'skipped: no --compare capture (--capture the base build with --gates=phone first)');
  else emitResult(scheme, 'phone*', width, 'phone', gate.phoneRects(base, now));
}

// ── main ────────────────────────────────────────────────────────────────────────────────────

async function main() {
  const baseline = COMPARE ? JSON.parse(fs.readFileSync(COMPARE, 'utf8')) : null;
  const core = await loadCore();
  const worlds = ROUTES.includes('detail') || SCHEME_LIST.includes('spectrum') ? await fetchWorlds() : [];
  const routeList = [];
  for (const r of ROUTES) {
    if (r !== 'detail') routeList.push({ key: r, path: ROUTE_PATHS[r] });
    else {
      const picks = DETAILS === 'all' ? worlds.map((_, i) => i) : [0, 2];
      for (const i of picks) {
        if (worlds[i]) routeList.push({ key: i === 0 ? 'detail' : `detail#${i + 1}`, path: `/work/${worlds[i].slug}/`, slug: worlds[i].slug });
      }
      if (!worlds[0]) emit('SKIP', schemeArg, 'detail', '*', 'detail', 'skipped: no /work card slug could be read');
    }
  }
  const forced = FORCE ? ' (forced: the probe set html[data-scheme], not the site)' : '';
  console.log(`scheme-probe: ${BASE}  schemes ${SCHEME_LIST.join(',')}  routes ${routeList.map((r) => r.key).join(',')}  widths ${WIDTHS.join(',')}${FORCE ? '  --force-attr' : ''}${COMPARE ? `  --compare ${COMPARE}` : ''}`);

  const wanted = (scheme) => {
    const set = new Set(GATES_ARG ?? DEFAULT_GATES[scheme]);
    if (COMPARE && !GATES_ARG) set.add('identity');
    return set;
  };
  // The shares gate needs every project's page: each page carries only its own dealt colour.
  const sharesReady = DETAILS === 'all' && ROUTES.includes('detail');
  const needShares = sharesReady && SCHEME_LIST.some((s) => wanted(s).has('shares')) && core.ok;
  const rampStops = SCHEME_LIST.some((s) => wanted(s).has('density')) ? await loadRampStops() : [];
  const captured = { meta: { base: BASE, at: new Date().toISOString(), ignore: IGNORE_SEL, forced: FORCE, schemes: SCHEME_LIST, widths: WIDTHS }, pages: {}, phone: {} };
  const launch = () => chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  let browser = await launch();
  try {
    for (const scheme of SCHEME_LIST) {
      const want = wanted(scheme);
      for (const width of WIDTHS) {
        const phone = width <= 480;
        const makeCtx = async () => {
          const c = await browser.newContext({
            viewport: { width, height: phone ? 844 : 900 },
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
            ...(phone ? { isMobile: true, hasTouch: true } : {}),
          });
          await installRoutes(c);
          await c.addInitScript(hydrationHook);
          if (FORCE) await c.addInitScript(forceAttr, scheme);
          return c;
        };
        let ctx = await makeCtx();
        const detailKeys = {};
        const detailDumps = []; // the uniform gate's pages: every detail page of this scheme and width
        const familyTotals = {};
        for (const route of routeList) {
          const key = `${scheme}:${route.key}@${width}`;
          const m = await measurePage(ctx, scheme, route.path, width, needShares && want.has('shares'));
          captured.pages[key] = m;
          if (m.refused) {
            // After a refused capture Chrome blocks WebGL for the origin ("Web page caused context loss
            // and was blocked"): every canvas page loaded later in this browser throws at renderer
            // creation and loses its debug hook (measured 11-14). Nothing is stored between pages, so
            // a fresh browser and context cost nothing but the launch.
            await ctx.close().catch(() => {});
            await browser.close().catch(() => {});
            browser = await launch();
            ctx = await makeCtx();
          }
          if (m.error) {
            emit('FAIL', scheme, route.key, width, 'load', m.error);
            continue;
          }
          const warn = [!m.committed && 'islands never reported committed', !m.settled && `dump UNSETTLED after ${m.reads} reads`, m.errors.length && `${m.errors.length} page errors (first: ${m.errors[0]})`, m.refused].filter(Boolean);
          if (warn.length) console.log(`WARN  ${scheme.padEnd(8)} ${route.key.padEnd(10)} ${String(width).padStart(4)}  ${warn.join('; ')}`);
          const run = (name, fn) => {
            if (want.has(name)) fn();
          };
          const tag = FORCE ? ' forced' : '';
          run('latch', () => emitResult(scheme, route.key, width, 'latch', gate.latch(m.attr, scheme), tag));
          run('identity', () => {
            const base = baseline?.pages?.[key];
            if (!baseline) return emit('SKIP', scheme, route.key, width, 'identity', 'skipped: no --compare capture');
            if (!base || base.error) return emit('FAIL', scheme, route.key, width, 'identity', `not in the capture (${key})`);
            emitResult(scheme, route.key, width, 'identity', gate.identity(base.els, m.els));
          });
          run('monochrome', () => emitResult(scheme, route.key, width, 'monochrome', gate.monochrome(m.els)));
          run('singleHue', () => emitResult(scheme, route.key, width, 'singleHue', gate.singleHue(m.els, '#0000ff')));
          run('contrast', () => emitResult(scheme, route.key, width, 'contrast', gate.contrast(m.els, 3)));
          run('carriers', () => {
            if (scheme === 'project') return emit('SKIP', scheme, route.key, width, 'carriers', 'skipped: project has no fixed expectation');
            if (scheme === 'spectrum' && !core.ok) return emit('SKIP', scheme, route.key, width, 'carriers', `skipped: ${core.reason}`);
            const expect = scheme === 'black' ? () => '#000000' : scheme === 'blue' ? () => '#0000ff' : (c) => (core.mod.SPECTRUM[c.spectrum] ?? core.mod.SPECTRUM.blue).fill;
            emitResult(scheme, route.key, width, 'carriers', gate.carriers(m.carriers, expect));
          });
          run('hover', () => {
            if (phone) return emit('SKIP', scheme, route.key, width, 'hover', 'skipped: touch width (hover rules sit behind hover: hover)');
            const res = gate.hover(m.hover);
            res.pass || m.hover.length ? emitResult(scheme, route.key, width, 'hover', res) : emit('SKIP', scheme, route.key, width, 'hover', `skipped: none of ${HOVER_SELECTORS.join(' ')} on this route`);
          });
          if (want.has('overlap')) {
            const o = await measureOverlap(ctx, scheme, route.path);
            if (o.error) emit('FAIL', scheme, route.key, width, 'overlap', o.error);
            else if (!o.boxes.some((b) => b.name === ANCHOR)) emit('SKIP', scheme, route.key, width, 'overlap', `skipped: no ${ANCHOR} on this route`);
            else emitResult(scheme, route.key, width, 'overlap', gate.overlap(o.boxes, { anchor: ANCHOR }));
          }
          run('density', () => emitResult(scheme, route.key, width, 'density', gate.density(m.els, { min: gate.densityMin(route.key, DENSITY), rampStops })));
          run('outline', () => {
            const name = OUTLINE_HOOK[route.key];
            if (!name) return emit('SKIP', scheme, route.key, width, 'outline', 'skipped (no canvas outline on this route)');
            if (!m.gl) return emit('SKIP', scheme, route.key, width, 'outline', 'skipped (no debug hook)');
            const spectrum = scheme === 'spectrum';
            const res = gate.outline(m.gl[name], { name, mix: spectrum ? 1 : 0, ...(spectrum && name === 'globe' ? { ring: m.ring ?? null } : {}) });
            if (res.skip) return emit('SKIP', scheme, route.key, width, 'outline', res.note);
            emitResult(scheme, route.key, width, 'outline', res);
          });
          run('gl', () => {
            if (!m.gl) return emit('SKIP', scheme, route.key, width, 'gl', 'skipped (no debug hook)');
            const bad = Object.entries(m.gl).filter(([, v]) => v && v.error).map(([k, v]) => ({ path: k, error: v.error }));
            emit(bad.length ? 'FAIL' : 'PASS', scheme, route.key, width, 'gl', `${bad.length} offenders — ${JSON.stringify(m.gl)}`, bad);
          });
          if (route.slug) {
            detailKeys[route.slug] = m.carriers.find((c) => c.spectrum)?.spectrum ?? null;
            detailDumps.push({ label: route.slug, els: m.els });
          }
          for (const [f, n] of Object.entries(m.families ?? {})) familyTotals[f] = (familyTotals[f] || 0) + n;
          if (m.families && want.has('shares')) {
            // One line per page (not a gate, not counted): which page a family's share comes from.
            const page = gate.shares(m.families);
            console.log(`INFO  ${scheme.padEnd(8)} ${String(route.key).padEnd(10)} ${String(width).padStart(4)}  ${'shares'.padEnd(10)} ${page.n} chromatic px — ${page.note}`);
          }
        }
        if (want.has('uniform')) {
          if (detailDumps.length < 2) emit('SKIP', scheme, 'detail*', width, 'uniform', `skipped: ${detailDumps.length} project page measured, it compares two or more (--routes with detail)`);
          else {
            const res = gate.uniform(detailDumps);
            console.log(`INFO  ${scheme.padEnd(8)} ${'detail*'.padEnd(10)} ${String(width).padStart(4)}  ${'uniform'.padEnd(10)} ${res.skipped} elements on one page only (skipped), ${detailDumps.length} pages: ${detailDumps.map((d) => d.label).join(', ')}`);
            emitResult(scheme, 'detail*', width, 'uniform', res);
          }
          if (ROUTES.includes('work')) console.log(`INFO  ${scheme.padEnd(8)} ${'work'.padEnd(10)} ${String(width).padStart(4)}  ${'uniform'.padEnd(10)} /work is not compared: it opens on its first card and no URL picks another (the start card comes from sessionStorage), so project pages only`);
        }
        if (want.has('shares')) {
          if (!core.ok) emit('SKIP', scheme, '*', width, 'shares', `skipped: ${core.reason}`);
          else if (!sharesReady) emit('SKIP', scheme, '*', width, 'shares', 'skipped: run with --details=all (the sample of two project pages cannot show the proportions)');
          else emitResult(scheme, '*', width, 'shares', gate.shares(familyTotals));
        }
        if (want.has('deal')) {
          if (!core.ok) emit('SKIP', scheme, '*', width, 'crossRoute', `skipped: ${core.reason}`);
          else if (!Object.keys(detailKeys).length) emit('SKIP', scheme, '*', width, 'crossRoute', 'skipped: no detail route measured');
          else emitResult(scheme, '*', width, 'crossRoute', gate.crossRoute(worlds, detailKeys));
        }
        await widgetPass(ctx, browser, scheme, width, want, routeList.filter((r) => r.slug).slice(0, 1).map((r) => [r.key, r.path]));
        if (want.has('phone')) {
          if (phone) await phonePass(browser, scheme, width, baseline, captured);
          else emit('SKIP', scheme, 'phone*', width, 'phone', 'skipped: the phone gate measures 390 (--width=390)');
        }
        if (phone && (want.has('phone') || want.has('bands'))) await bandsPhonePass(browser, scheme, width);
        await ctx.close();
      }
      if (want.has('rightEdge')) await edgePass(browser, scheme);
      if (want.has('clear') || want.has('bands')) await clearPass(browser, scheme, want);
      if (want.has('deal')) {
        if (!core.ok) emit('SKIP', scheme, '/work', '*', 'deal', `skipped: ${core.reason}`);
        else if (!worlds.length) emit('SKIP', scheme, '/work', '*', 'deal', 'skipped: no /work worlds read');
        else emitResult(scheme, '/work', '*', 'deal', gate.deal(worlds, core.mod.spectrumKeyAt));
      }
    }
  } finally {
    await browser.close();
  }
  if (CAPTURE) {
    fs.writeFileSync(CAPTURE, JSON.stringify(captured));
    console.log(`capture → ${CAPTURE} (${Object.keys(captured.pages).length} pages)`);
  }
  console.log(`scheme-probe: ${passes} PASS, ${failures} FAIL, ${skips} SKIP${forced ? forced : ''}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
