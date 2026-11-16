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

/**
 * uniform — the same element paints the same colour on every project. `pages` = [{ label, els }]
 * (the style dumps of two or more pages of one kind, one run, one width). Every element that TWO OR MORE
 * pages have is compared, property by property, against the first page that has it; an element only one
 * page has (the longest tag list's last tag) is skipped and counted in `skipped`. An offender names the
 * element, the property and both values (null = that page paints nothing there).
 *
 * An element is matched across pages by its record's `u` where it has one, else by its path. The probe
 * writes `u` for elements whose colour follows an attribute and not their sibling position (a keyword
 * word's `data-kw`, a social button's `data-platform`): two projects' n-th such sibling can be different
 * things, so nth-of-type would compare a red-slot keyword with a green-slot one and call it a per-project
 * colour. The offender's `path` is that key.
 */
export function uniform(pages) {
  const keyed = (els) => {
    const out = {};
    for (const [path, rec] of Object.entries(els)) {
      const key = rec?.u ?? path;
      if (!(key in out)) out[key] = rec;
    }
    return out;
  };
  const list = (pages ?? []).map((p, i) => ({ label: p?.label ?? `page ${i + 1}`, els: keyed(elsOf(p)) }));
  if (list.length < 2) return { ...result([], 0, 'needs two pages', { vacuous: true }), skipped: 0 };
  const all = new Set(list.flatMap((p) => Object.keys(p.els)));
  const offenders = [];
  let compared = 0;
  for (const path of all) {
    const [first, ...rest] = list.filter((p) => path in p.els);
    if (!rest.length) continue;
    compared += 1;
    const a = first.els[path].paint ?? {};
    for (const other of rest) {
      const b = other.els[path].paint ?? {};
      for (const prop of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!sameColour(a[prop], b[prop])) offenders.push({ path, prop, a: a[prop] ?? null, b: b[prop] ?? null, pages: `${first.label} vs ${other.label}` });
      }
    }
  }
  const skipped = all.size - compared;
  return { ...result(offenders, compared, `${compared} elements on two or more of ${list.length} pages`), skipped };
}

/** The six swatch families of color-ref.png a page can wear, and the two a page can carry besides. */
export const DENSITY_FAMILIES = { blue: '#1556e5', red: '#fd361a', green: '#077b3e', yellow: '#fbb702', periwinkle: '#a6bcda', navy: '#0a2577' };
const DENSITY_ALL = [...Object.keys(DENSITY_FAMILIES), 'white-ground', 'ramp'];
/** PROPOSED thresholds: how many families a page must paint, by route kind (a `detail#3` key is a detail). */
export const DENSITY_DEFAULT = 5;
export const DENSITY_MIN = { home: 5, work: 5, detail: 5, directory: 5, privacy: 3, 404: 3 };
/** The threshold of a route key; `override` replaces the 5 (privacy and 404 keep their 3). */
export function densityMin(route, override) {
  const min = DENSITY_MIN[String(route).split('#')[0]] ?? DENSITY_DEFAULT;
  return min === DENSITY_DEFAULT && override > 0 ? override : min;
}

/** The nine stops of `--swm-ramp-a` in a stylesheet's text (a `var(--x)` stop resolves to that custom property), or []. */
export function rampStopsFromCss(css) {
  const m = /--swm-ramp-a\s*:\s*([^;]+);/.exec(css ?? '');
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim()).map((s) => {
    const v = /^var\((--[\w-]+)\)$/.exec(s);
    const d = v && new RegExp(`${v[1]}\\s*:\\s*([^;]+);`).exec(css);
    return d ? d[1].trim() : s;
  });
}

/**
 * density — how much of the palette a page paints. Counts the families present among the dumped colours:
 * the six swatches (any painted property, a gradient stop included), white-ground (#ffffff as a
 * background-color or a box-shadow spread only: white text or a white hairline does not count), and
 * ramp (one element's gradient carrying at least three of `rampStops`, ramp A's nine). A colour counts
 * when it equals the family's value and its alpha is 1. Passes when the count reaches `min`; the
 * families found are on the result (`families`) and in the note either way.
 */
export function density(dump, { min = DENSITY_DEFAULT, rampStops = [] } = {}) {
  const wants = Object.entries(DENSITY_FAMILIES).map(([f, hex]) => [f, parseColour(hex)]);
  const white = parseColour('#ffffff');
  const stops = rampStops.map(parseColour).filter(Boolean);
  const found = new Set();
  const gradients = new Map(); // path -> the ramp stops its gradient carries
  const { seen } = eachColour(dump, (path, prop, str, c) => {
    if (c.a < 0.995) return;
    const is = (w) => sameColour(str, toHex(w));
    for (const [f, w] of wants) if (is(w)) found.add(f);
    if ((prop === 'background-color' || prop.startsWith('shadow#')) && is(white)) found.add('white-ground');
    if (prop.startsWith('bg-grad#')) {
      const k = stops.findIndex((s) => is(s));
      if (k >= 0) gradients.set(path, (gradients.get(path) ?? new Set()).add(k));
    }
  });
  if ([...gradients.values()].some((s) => s.size >= 3)) found.add('ramp');
  const families = DENSITY_ALL.filter((f) => found.has(f));
  const note = `${families.length}/${DENSITY_ALL.length} families (${families.join(', ') || 'none'}), need ${min}${stops.length ? '' : '; ramp A stops unread'}`;
  const offenders = families.length >= min ? [] : [{ path: '(page)', families, count: families.length, min }];
  return { ...result(offenders, seen, note), families, min };
}

export const OUTLINE_TOL = 1.5; // CSS px: the ramp's centre against the DOM ring's

/**
 * outline — the ring and the canvas agree. `hook` is one debug hook's report (`__swmSchemeDebug.globe()`
 * or `.worlds()`), `name` its name. Its `ramp.mix` must equal `mix` (1 under spectrum, 0 under any other
 * scheme). With `ring` given (the [x, y] centre of the DOM ring in CSS px, or null when it was not
 * found), `ramp.center` must sit within `tol` px of it. A hook without a `ramp` field, a missing hook or
 * an errored one is a SKIP (`skip` true), so the gate can run before the canvas tickets merge.
 */
export function outline(hook, { name = 'globe', mix = 1, ring, tol = OUTLINE_TOL } = {}) {
  const skip = (why) => ({ pass: false, offenders: [], note: `skipped (${why})`, n: 0, skip: true });
  if (!hook) return skip(`no ${name} hook`);
  if (hook.error) return skip(`${name} hook errored`);
  if (!hook.ramp || typeof hook.ramp !== 'object') return skip('hook has no ramp');
  const offenders = [];
  const parts = [];
  const got = hook.ramp.mix;
  parts.push(`${name} ramp.mix ${got}`);
  if (!(Math.abs(got - mix) <= 1e-3)) offenders.push({ path: `${name}().ramp.mix`, got: got ?? null, want: mix });
  let n = 1;
  if (ring !== undefined) {
    n++;
    const c = hook.ramp.center;
    const ok = Array.isArray(c) && c.length === 2 && c.every(Number.isFinite);
    if (!ring) offenders.push({ path: `${name}().ramp.center`, got: ok ? c.map((v) => fixed(v, 1)) : (c ?? null), want: 'ring not found' });
    else if (!ok) offenders.push({ path: `${name}().ramp.center`, got: c ?? null, want: ring.map((v) => fixed(v, 1)) });
    else {
      const dist = Math.hypot(c[0] - ring[0], c[1] - ring[1]);
      parts.push(`centre ${fixed(dist, 2)} px from the ring`);
      if (!(dist <= tol)) offenders.push({ path: `${name}().ramp.center`, got: c.map((v) => fixed(v, 1)), want: ring.map((v) => fixed(v, 1)), dist: fixed(dist, 2), tol });
    }
  }
  return result(offenders, n, parts.join(', '));
}

// ── the corner widget: the eye in its square badge (SQ-107) ─────────────────────────────────

const rectOf = (r) => [r.x, r.y, r.w, r.h].map((v) => fixed(v, 1)).join(',');

/**
 * badge — the square tile sits where its seat says. `rect` {x, y, w, h} is the tile in viewport CSS
 * px, `vp` {w, h} the viewport. Always: square (to `tol` px) and its right edge on the viewport's.
 * `flush`: its bottom edge is on the viewport's bottom edge as well. `seat`: it is clear of that
 * edge (the eye keeps today's height above the privacy pill).
 */
export function badge(rect, vp, seat, tol = 1) {
  const offenders = [];
  if (!rect || !vp) return result([{ path: '.swm-corner::before', note: 'no badge box measured' }], 0, 'no box');
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const bad = (note) => offenders.push({ path: '.swm-corner::before', seat, note, rect: rectOf(rect), viewport: `${vp.w}x${vp.h}` });
  if (Math.abs(rect.w - rect.h) > tol) bad(`not square (${fixed(rect.w, 1)} x ${fixed(rect.h, 1)})`);
  if (Math.abs(right - vp.w) > tol) bad(`right edge ${fixed(right, 1)} is not the viewport's ${vp.w}`);
  if (seat === 'flush' && Math.abs(bottom - vp.h) > tol) bad(`bottom edge ${fixed(bottom, 1)} is not the viewport's ${vp.h}`);
  if (seat === 'seat' && !(bottom < vp.h - tol)) bad(`bottom edge ${fixed(bottom, 1)} touches the viewport's ${vp.h}`);
  if (seat !== 'flush' && seat !== 'seat') bad(`unknown seat ${seat}`);
  return result(offenders, 1, `${seat}: tile ${rectOf(rect)} in ${vp.w}x${vp.h}`);
}

/**
 * badgeColour — the tile follows the scheme. `paint` = { bg, blur }: the tile's computed background
 * colour and backdrop-filter. blue: brand blue, opaque. black: black, opaque. Any other scheme
 * (project; the parked spectrum preview): glass, i.e. a translucent veil (0 < alpha < 1) over a
 * backdrop blur.
 */
export function badgeColour(scheme, paint) {
  const c = parseColour(paint?.bg);
  const off = (note) => [{ path: '.swm-corner::before', scheme, bg: paint?.bg ?? null, blur: paint?.blur ?? null, note }];
  if (!c) return result(off('no background colour read'), 0, 'unreadable');
  const solid = { blue: [0, 0, 255], black: [0, 0, 0] }[scheme];
  if (solid) {
    const ok = c.a > 0.99 && Math.abs(c.r - solid[0]) <= 1 && Math.abs(c.g - solid[1]) <= 1 && Math.abs(c.b - solid[2]) <= 1;
    return result(ok ? [] : off(`want opaque rgb(${solid.join(', ')})`), 1, `${scheme}: ${paint.bg}`);
  }
  const glass = c.a > 0.02 && c.a < 0.98 && /blur\(/.test(paint?.blur ?? '');
  return result(glass ? [] : off('want a translucent veil over a backdrop blur'), 1, `${scheme}: glass ${paint.bg}, ${paint.blur}`);
}

/**
 * eyeLines — nothing dark outlines the eye. `shapes` = [{ path, stroke, width }]: every shape in
 * the widget's svgs (stroke = the computed colour or 'none', width in px). A stroke must be white
 * (the lids, the globe's lines); a dark one is the old outline.
 */
export function eyeLines(shapes) {
  const offenders = [];
  let stroked = 0;
  for (const s of shapes ?? []) {
    if (!s.stroke || s.stroke === 'none' || !(Number(s.width) > 0)) continue;
    stroked++;
    const c = parseColour(s.stroke);
    if (!c || c.r < 250 || c.g < 250 || c.b < 250) offenders.push({ path: s.path, stroke: s.stroke, width: s.width, note: 'a stroke that is not white' });
  }
  return result(offenders, (shapes ?? []).length, `${stroked} stroked of ${(shapes ?? []).length} shapes`);
}

/**
 * persist — the widget is the SAME node across a soft navigation and never leaves view. `samples`
 * = [{ same, op, vis, gone? }], one per frame from the click to the settle: the node's identity
 * mark survives (`same`), its computed opacity stays 1 and its visibility stays visible. A fade
 * (opacity below 1, or visibility hidden, even for one frame) or a remount (`gone`, or a new
 * node) is an offender.
 */
export function persist(samples) {
  const offenders = [];
  let first = null;
  (samples ?? []).forEach((s, i) => {
    const why = s.gone ? 'the widget was gone' : !s.same ? 'a different node (remounted)' : !(Number(s.op) >= 0.999) ? `opacity ${s.op}` : s.vis !== 'visible' ? `visibility ${s.vis}` : null;
    if (why) {
      first ??= i;
      if (offenders.length < 5) offenders.push({ path: '.swm-corner', frame: i, note: why });
    }
  });
  const n = (samples ?? []).length;
  return result(offenders, n, `${n} frames${first == null ? '' : `, first bad frame ${first}`}`);
}

/**
 * bounds — every item sits inside the box on the given axis ('x' = left and right). `items` and
 * `box` are { name, x, y, w, h }. The engaged lens circle against the window that clips it: a box
 * narrower than the circle cuts its edges.
 */
export function bounds(items, box, { axis = 'x', tol = 0.5 } = {}) {
  const offenders = [];
  const lo = axis === 'x' ? box?.x : box?.y;
  const hi = axis === 'x' ? box?.x + box?.w : box?.y + box?.h;
  for (const it of items ?? []) {
    const a = axis === 'x' ? it.x : it.y;
    const b = axis === 'x' ? it.x + it.w : it.y + it.h;
    if (a < lo - tol || b > hi + tol) offenders.push({ path: it.name, got: `${fixed(a, 1)}..${fixed(b, 1)}`, want: `${fixed(lo, 1)}..${fixed(hi, 1)}`, note: `outside the ${axis} bounds` });
  }
  return result(offenders, (items ?? []).length, `${(items ?? []).length} circles in ${box?.name ?? 'box'} ${rectOf(box ?? { x: 0, y: 0, w: 0, h: 0 })}`);
}

/**
 * strays — mid-animation, nothing paints but the stations the column is meant to show. `diff` =
 * { pixels, total, at }: the number of differing pixels between a capture of the widget and a
 * capture with every station outside the shown window hidden (scrubbed to eye-t `at`). More than
 * `tol` differing pixels is a stray instance in an outer position. The ceiling (8) is a measured
 * noise floor: hiding the outer stations demotes their compositing layers, which re-rounds a
 * pixel or three of the SHOWN eye's anti-aliasing (1-3 px of 134400, channel delta <= 19, a 2x2
 * box on the eye); with the window held open (--eye-reach forced to 1: the static edge) the strays are 50-105 px (delta 33-74, a 5x130 box).
 */
export function strays(diff, { tol = 8 } = {}) {
  const bad = diff && diff.pixels > tol ? [{ path: '.fp-scale__station', pixels: diff.pixels, at: diff.at, maxDelta: diff.maxDelta, box: diff.box, note: 'a station outside the shown rows painted' }] : [];
  return result(bad, diff?.total ?? 0, `${diff?.pixels ?? 0} of ${diff?.total ?? 0} px differ at eye-t ${diff?.at}${diff?.pixels ? ` (max channel delta ${diff.maxDelta}, box ${diff.box})` : ''}`);
}

/** Short one-line text of an offender, for the probe's report. */
export function describeOffender(o) {
  const { path, selector, slug, family, ...rest } = o;
  const head = path ?? selector ?? slug ?? family ?? '';
  return `${head} ${Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')}`.trim();
}
