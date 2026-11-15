#!/usr/bin/env node
/**
 * scheme-gate.mjs — the acceptance gates of scripts/scheme-probe.mjs (US-7 colour schemes), as
 * pure functions over plain data (no browser, no fs), so scripts/test/scheme-gate.test.mjs
 * imports them. Every gate returns { pass, offenders: [...], note, n } where n is the number of
 * things it measured: a gate that measured nothing FAILS as vacuous (the unitGates.mjs rule: an
 * empty run proves nothing).
 *
 * A DUMP is the probe's per-page style dump: { [path]: { paint, text?, media? } } (or
 * { els: thatMap }). `path` is the stable element path ('html > body > div.a:nth-of-type(2)',
 * a pseudo-element appends '::before' / '::after'). `paint` maps a property name to ONE colour
 * string as the browser serialises it: color, background-color, border-{top,right,bottom,left}-color,
 * outline-color, fill, stroke, stop-color, text-decoration-color, text-fill, bg-grad#i (a
 * gradient colour stop), shadow#i (a box-shadow colour). Only painted properties are dumped.
 * `text` is true when the element has visible text of its own, `media` when that text sits on
 * media (an image, a canvas, a url() background) whose colours cannot be known.
 */
import { oklch } from '../palette-measure.mjs';

const elsOf = (d) => d?.els ?? d ?? {};
const fixed = (v, n = 2) => (Number.isFinite(v) ? +v.toFixed(n) : v);

// ── colour parsing ──────────────────────────────────────────────────────────────────────────

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const enc = (v) => {
  const c = clamp01(v);
  return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
};

function oklabToRgb(L, a, b, alpha) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: alpha,
  };
}

/** A CSS colour string → { r, g, b (0..255), a (0..1) }, or null when it is not a colour we read. */
export function parseColour(input) {
  if (typeof input !== 'string') return null;
  const s = input.trim().toLowerCase();
  if (!s) return null;
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const v = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: v(0), g: v(2), b: v(4), a: h.length === 8 ? v(6) / 255 : 1 };
  }
  m = /^([a-z-]+)\((.*)\)$/.exec(s);
  if (!m) return null;
  const fn = m[1];
  let body = m[2].trim();
  let space = null;
  if (fn === 'color') {
    const sp = /^([a-z0-9-]+)\s+(.*)$/.exec(body);
    if (!sp) return null;
    space = sp[1];
    body = sp[2];
  }
  const parts = body.split('/');
  const nums = parts[0].split(/[\s,]+/).filter(Boolean);
  const num = (t, pct = 1) => (t === 'none' ? 0 : t.endsWith('%') ? (parseFloat(t) / 100) * pct : parseFloat(t));
  let alpha = 1;
  const alphaTok = parts[1]?.trim() ?? (nums.length === 4 && (fn === 'rgba' || fn === 'hsla') ? nums.pop() : null);
  if (alphaTok != null) alpha = num(alphaTok, 1);
  if (nums.length < 3) return null;
  let out = null;
  if (fn === 'rgb' || fn === 'rgba') {
    out = { r: num(nums[0], 255), g: num(nums[1], 255), b: num(nums[2], 255), a: alpha };
  } else if (fn === 'color' && space === 'srgb') {
    out = { r: num(nums[0], 1) * 255, g: num(nums[1], 1) * 255, b: num(nums[2], 1) * 255, a: alpha };
  } else if (fn === 'oklab') {
    out = oklabToRgb(num(nums[0], 1), num(nums[1], 0.4), num(nums[2], 0.4), alpha);
  } else if (fn === 'oklch') {
    const C = num(nums[1], 0.4);
    const h = (parseFloat(nums[2]) * Math.PI) / 180;
    out = oklabToRgb(num(nums[0], 1), C * Math.cos(h), C * Math.sin(h), alpha);
  }
  if (!out || [out.r, out.g, out.b, out.a].some((v) => !Number.isFinite(v))) return null;
  return out;
}

const hex2 = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
export const toHex = (c) => `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`;

/** Two colour strings paint the same colour (within half a step), or are the same text. */
export function sameColour(a, b) {
  if (a === b) return true;
  const x = parseColour(a);
  const y = parseColour(b);
  if (!x || !y) return false;
  return Math.abs(x.r - y.r) < 1 && Math.abs(x.g - y.g) < 1 && Math.abs(x.b - y.b) < 1 && Math.abs(x.a - y.a) < 0.01;
}

/** OKLCH of a parsed colour (alpha ignored): { L, C, h }. */
export const oklchOf = (c) => oklch(c.r, c.g, c.b);

const lum = (c) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};

/** WCAG 2 contrast ratio of two OPAQUE colours. */
export function contrastRatio(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const over = (fg, bg) => ({
  r: fg.a * fg.r + (1 - fg.a) * bg.r,
  g: fg.a * fg.g + (1 - fg.a) * bg.g,
  b: fg.a * fg.b + (1 - fg.a) * bg.b,
  a: 1,
});

/** Every painted, parseable colour of a dump: calls fn(path, prop, str, parsed). Returns { seen, unparsed }. */
function eachColour(dump, fn) {
  let seen = 0;
  let unparsed = 0;
  for (const [path, rec] of Object.entries(elsOf(dump))) {
    for (const [prop, str] of Object.entries(rec.paint ?? {})) {
      const c = parseColour(str);
      if (!c) {
        unparsed++;
        continue;
      }
      if (c.a <= 0) continue; // paints nothing
      seen++;
      fn(path, prop, str, c);
    }
  }
  return { seen, unparsed };
}

const result = (offenders, n, note, { vacuous = n === 0 } = {}) => ({
  pass: !vacuous && offenders.length === 0,
  offenders,
  note: vacuous ? `vacuous: nothing measured${note ? ` (${note})` : ''}` : note,
  n,
});

// ── gates ───────────────────────────────────────────────────────────────────────────────────

/** latch — html[data-scheme] is the requested scheme. */
export function latch(attr, expected) {
  const offenders = attr === expected ? [] : [{ path: 'html', prop: 'data-scheme', got: attr ?? null, want: expected }];
  return result(offenders, 1, `html[data-scheme]=${attr ?? '(absent)'}`);
}

/**
 * identity — two style dumps agree on every painted property. An element present on one side
 * only is an offender too (prop '(element)'), unless its path contains an `ignore` string.
 */
export function identity(before, after, { ignore = [] } = {}) {
  const A = elsOf(before);
  const B = elsOf(after);
  const skip = (p) => ignore.some((s) => p.includes(s));
  const offenders = [];
  let n = 0;
  for (const path of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (skip(path)) continue;
    const a = A[path];
    const b = B[path];
    if (!a || !b) {
      offenders.push({ path, prop: '(element)', before: a ? 'present' : 'absent', after: b ? 'present' : 'absent' });
      continue;
    }
    n++;
    const pa = a.paint ?? {};
    const pb = b.paint ?? {};
    for (const prop of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
      if (!sameColour(pa[prop], pb[prop])) offenders.push({ path, prop, before: pa[prop] ?? null, after: pb[prop] ?? null });
    }
  }
  return result(offenders, n, `${n} elements compared`);
}

const CHROMA_MONO = 0.02;

/** monochrome — every painted colour has OKLCH chroma < 0.02 (the probe drops media before the dump). */
export function monochrome(dump) {
  const offenders = [];
  const { seen, unparsed } = eachColour(dump, (path, prop, str, c) => {
    const { C } = oklchOf(c);
    if (C >= CHROMA_MONO) offenders.push({ path, prop, value: str, chroma: fixed(C, 3) });
  });
  return result(offenders, seen, `${seen} painted colours${unparsed ? `, ${unparsed} unparsed` : ''}`);
}

const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** singleHue — every chromatic colour (chroma >= 0.02) has the hue of `hex` within 4 degrees. */
export function singleHue(dump, hex, tol = 4) {
  const ref = parseColour(hex);
  const want = ref ? oklchOf(ref).h : NaN;
  const offenders = [];
  let chromatic = 0;
  const { seen, unparsed } = eachColour(dump, (path, prop, str, c) => {
    const { C, h } = oklchOf(c);
    if (C < CHROMA_MONO) return;
    chromatic++;
    const d = hueDist(h, want);
    if (!(d <= tol)) offenders.push({ path, prop, value: str, hue: fixed(h, 1), want: fixed(want, 1) });
  });
  return result(offenders, seen, `${seen} painted colours, ${chromatic} chromatic, hue of ${hex} = ${fixed(want, 1)}${unparsed ? `, ${unparsed} unparsed` : ''}`);
}

// The nearest ancestor path: a pseudo-element's parent is its element; an element's is its DOM parent.
const parentPath = (p) => {
  const ps = /::(?:before|after)$/.exec(p);
  if (ps) return p.slice(0, ps.index);
  const i = p.lastIndexOf(' > ');
  return i < 0 ? null : p.slice(0, i);
};

const isPseudo = (p) => /::(?:before|after)$/.test(p);

/**
 * The opaque colours a path may sit on: layers walked up to the first fully opaque one, composited down.
 * An element's `backdrop` pseudo (the probe's flag: an absolute, negative-z box behind the element's own
 * content, such as the directory filter's wipe box) is a layer nearer than the element's own fill.
 */
function backgroundsOf(els, path) {
  const layers = []; // nearest first; each layer = alternatives (a gradient is one alternative per stop)
  walk: for (let p = path; p != null; p = parentPath(p)) {
    const behind = isPseudo(p) ? [] : [`${p}::after`, `${p}::before`].map((k) => els[k]).filter((r) => r?.backdrop).map((r) => r.paint);
    for (const paint of [...behind, els[p]?.paint]) {
      if (!paint) continue;
      const stops = Object.entries(paint).filter(([k]) => k.startsWith('bg-grad#')).map(([, v]) => parseColour(v)).filter((c) => c && c.a > 0);
      let opaque = false;
      if (stops.length) {
        layers.push(stops);
        opaque = stops.every((c) => c.a >= 1);
      }
      const bg = parseColour(paint['background-color']);
      if (!opaque && bg && bg.a > 0) {
        layers.push([bg]);
        opaque = bg.a >= 1;
      }
      if (opaque) break walk;
    }
  }
  let alts = [{ r: 255, g: 255, b: 255, a: 1 }]; // the canvas
  for (let i = layers.length - 1; i >= 0; i--) {
    const next = new Map();
    for (const base of alts) for (const top of layers[i]) {
      const c = over(top, base);
      next.set(`${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)}`, c);
    }
    alts = [...next.values()].slice(0, 64);
  }
  return alts;
}

/** contrast — every element with its own visible text has WCAG contrast >= min against its effective background. */
export function contrast(dump, min = 3) {
  const els = elsOf(dump);
  const offenders = [];
  let n = 0;
  let overMedia = 0;
  for (const [path, rec] of Object.entries(els)) {
    if (!rec.text) continue;
    if (rec.media) {
      overMedia++;
      continue;
    }
    const str = rec.paint?.color ?? rec.paint?.fill;
    const fg = parseColour(str);
    if (!fg || fg.a < 0.01) continue; // transparent text paints nothing
    const bgs = backgroundsOf(els, path);
    let worst = Infinity;
    let worstBg = null;
    for (const bg of bgs) {
      const r = contrastRatio(over(fg, bg), bg);
      if (r < worst) [worst, worstBg] = [r, bg];
    }
    n++;
    if (worst < min) offenders.push({ path, prop: 'color', value: str, bg: toHex(worstBg), ratio: fixed(worst, 2), min });
  }
  return result(offenders, n, `${n} text elements >= ${min}:1${overMedia ? `, ${overMedia} over media not measured` : ''}`);
}

/** carriers — each --project-color carrier's computed --project-color equals expect(carrier) (undefined = not checked). */
export function carriers(list, expect) {
  const offenders = [];
  let n = 0;
  for (const c of list ?? []) {
    const want = expect(c);
    if (want == null) continue;
    n++;
    if (!sameColour(String(c.projectColor ?? '').trim(), want)) {
      offenders.push({ path: c.path, prop: '--project-color', got: c.projectColor ?? null, want, spectrum: c.spectrum ?? null });
    }
  }
  return result(offenders, n, `${n} carriers checked of ${(list ?? []).length}`);
}

/** deal — card i's data-spectrum equals keyAt(i). cards = [{ slug, spectrum }] in /work order. */
export function deal(cards, keyAt) {
  const offenders = [];
  (cards ?? []).forEach((c, i) => {
    const want = keyAt(i);
    if ((c.spectrum ?? null) !== want) offenders.push({ slug: c.slug, index: i, got: c.spectrum ?? null, want });
  });
  return result(offenders, (cards ?? []).length, `${(cards ?? []).length} cards`);
}

const asMap = (x) => (Array.isArray(x) ? Object.fromEntries(x.map((c) => [c.slug, c.spectrum ?? null])) : (x ?? {}));

/** crossRoute — a slug carries the same key on two routes. a, b = [{ slug, spectrum }] or { slug: key }. */
export function crossRoute(a, b) {
  const A = asMap(a);
  const B = asMap(b);
  const shared = Object.keys(A).filter((s) => s in B);
  const offenders = shared.filter((s) => A[s] !== B[s]).map((slug) => ({ slug, a: A[slug], b: B[slug] }));
  return result(offenders, shared.length, `${shared.length} shared slugs`);
}

const fp = (x) => (typeof x === 'string' ? x : JSON.stringify(x));

/** hover — for each { selector, rest, hover } the two fingerprints differ in at least one painted property. */
export function hover(pairs) {
  const offenders = (pairs ?? [])
    .filter((p) => fp(p.rest) === fp(p.hover))
    .map((p) => ({ selector: p.selector, prop: '(any)', note: 'no painted property changed on hover' }));
  return result(offenders, (pairs ?? []).length, `${(pairs ?? []).length} selectors`);
}

const inter = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;

/**
 * overlap — no two named boxes ({ name, x, y, w, h, at? }) intersect. Boxes only meet when they
 * share an `at` (the scroll stop they were read at). With { anchor }, only the anchor's boxes are
 * tested against the others.
 */
export function overlap(boxes, { anchor = null } = {}) {
  const bs = (boxes ?? []).filter((b) => b.w > 0 && b.h > 0);
  const offenders = [];
  let pairs = 0;
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];
      if ((a.at ?? null) !== (b.at ?? null) || a.name === b.name) continue;
      if (anchor && (a.name === anchor) === (b.name === anchor)) continue;
      pairs++;
      if (inter(a, b)) offenders.push({ a: a.name, b: b.name, at: a.at ?? null, boxA: [a.x, a.y, a.w, a.h].map(Math.round).join(','), boxB: [b.x, b.y, b.w, b.h].map(Math.round).join(',') });
    }
  }
  return result(offenders, pairs, `${pairs} box pairs`, { vacuous: false });
}

/** The colour-family shares of color-ref.png (chromatic only, percent), measured 11-14. */
export const REFERENCE_SHARES = { blue: 21.4, red: 19.7, green: 17.5, navy: 11.2, yellow: 10.1, periwinkle: 8.2, cyan: 3.3, orange: 3.0, purple: 2.9, magenta: 2.7 };
const NEUTRAL = new Set(['black', 'white', 'grey']);

/** shares — chromatic area shares against the reference: blue >= red >= green, every family within tol points. */
export function shares(counts, reference = REFERENCE_SHARES, tol = 10) {
  const fams = Object.entries(counts ?? {}).filter(([k, v]) => !NEUTRAL.has(k) && v > 0);
  const total = fams.reduce((s, [, v]) => s + v, 0);
  const got = Object.fromEntries(fams.map(([k, v]) => [k, (v / (total || 1)) * 100]));
  const offenders = [];
  for (const k of new Set([...Object.keys(reference), ...Object.keys(got)])) {
    const g = got[k] ?? 0;
    const w = reference[k] ?? 0;
    if (Math.abs(g - w) > tol) offenders.push({ family: k, got: fixed(g, 1), want: w, delta: fixed(g - w, 1) });
  }
  const g = (k) => got[k] ?? 0;
  if (!(g('blue') >= g('red') && g('red') >= g('green'))) {
    offenders.push({ family: 'order', got: `blue ${fixed(g('blue'), 1)} red ${fixed(g('red'), 1)} green ${fixed(g('green'), 1)}`, want: 'blue >= red >= green' });
  }
  const line = Object.entries(got).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${fixed(v, 1)}`).join(', ');
  return result(offenders, total, line || 'no chromatic pixels');
}

/** Short one-line text of an offender, for the probe's report. */
export function describeOffender(o) {
  const { path, selector, slug, family, ...rest } = o;
  const head = path ?? selector ?? slug ?? family ?? '';
  return `${head} ${Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')}`.trim();
}
