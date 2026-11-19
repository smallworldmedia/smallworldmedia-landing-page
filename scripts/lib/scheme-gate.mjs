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
 * badge — the badge tile at its ONE seat (SQ-107 pass 7: the flush corner and the footer ride are gone,
 * Nathan 11-16: "the slight raise off of the bottom of the viewport, sitewide"). `rect` {x, y, w, h} is
 * the tile in viewport CSS px, `vp` {w, h} the viewport. Always: a horizontal rectangle (wider than
 * tall); when `eye` {x, y, w, h} is given, the padding between it and the tile is equal on all four
 * sides (to `tol` px). Its right edge is the viewport's, with no inset (to `tol`). Vertically its
 * centre is `rowCy` above the viewport's bottom on EVERY route. Since SQ-121 the probe passes the desktop seat the stylesheet
 * declares (var(--badge-cy): the footer blurb's top plus a gap, one height on every route) above 768px, and the corner row's
 * centre on a phone; the `clear` gate holds the desktop seat against the blurb. A run that measured none fails.
 * PHONE TIER (SQ-107 pass 9, <= 768px): the corner-row rule is a desktop rule. When `clear` is a number
 * (the phone's --badge-clear, ?schemeclear) the badge's bottom edge must sit at least `clear` above the
 * viewport's bottom (to `tol`) instead, so the screen's rounded corner cannot cut it; no row is needed.
 */
export function badge(rect, vp, { tol = 0.5, eye = null, rowCy = null, clear = null } = {}) {
  const offenders = [];
  if (!rect || !vp) return result([{ path: '.swm-corner .fp-scale::before', note: 'no badge box measured' }], 0, 'no box');
  const right = rect.x + rect.w;
  const bottom = rect.y + rect.h;
  const bad = (note) => offenders.push({ path: '.swm-corner .fp-scale::before', note, rect: rectOf(rect), viewport: `${vp.w}x${vp.h}` });
  if (!(rect.w - rect.h > tol)) bad(`not a horizontal rectangle (${fixed(rect.w, 1)} x ${fixed(rect.h, 1)})`);
  if (eye) {
    const pads = [eye.x - rect.x, right - (eye.x + eye.w), eye.y - rect.y, bottom - (eye.y + eye.h)];
    if (Math.max(...pads) - Math.min(...pads) > 3 * tol) bad(`padding is not equal on four sides (left ${fixed(pads[0], 1)}, right ${fixed(pads[1], 1)}, top ${fixed(pads[2], 1)}, bottom ${fixed(pads[3], 1)})`);
  }
  if (Math.abs(vp.w - right) > tol) bad(`right edge is ${fixed(vp.w - right, 1)} from the viewport's, want 0`);
  if (Number.isFinite(clear)) {
    const gap = vp.h - bottom;
    if (gap < clear - tol) bad(`bottom edge is ${fixed(gap, 2)} above the viewport's bottom, under the phone clearance ${fixed(clear, 2)} (the screen corner cuts it)`);
  } else if (!Number.isFinite(rowCy)) bad('no corner row measured to seat against');
  else {
    const cy = vp.h - (rect.y + rect.h / 2);
    if (Math.abs(cy - rowCy) > 1) bad(`centre ${fixed(cy, 1)} above the bottom is not the corner row's ${fixed(rowCy, 1)}`);
  }
  return result(offenders, 1, Number.isFinite(clear) ? `seated: tile ${rectOf(rect)} in ${vp.w}x${vp.h}, bottom ${fixed(vp.h - bottom, 2)} above the viewport's, clearance ${fixed(clear, 2)}` : `seated: tile ${rectOf(rect)} in ${vp.w}x${vp.h}, row centre ${Number.isFinite(rowCy) ? fixed(rowCy, 1) : '?'} above the bottom`);
}

/**
 * seat — the badge's gap above the viewport's bottom edge is the SAME everywhere (SQ-107 pass 7: one seat,
 * sitewide). `samples` = [{ label, gap }], one per route, width, scroll stop (footer at rest and at its
 * end state): gap = viewport height minus the tile's bottom edge, CSS px. All within `tol` of one another
 * (0.5). A missing gap, or fewer than two samples, fails: one measurement compares to nothing.
 * PHONE TIER (pass 9): a sample may carry `clear` (the phone's --badge-clear, null above 768px); its gap
 * must then be at least that (to `tol`), so the raise cannot be lost on any route or scroll stop.
 */
export function seat(samples, { tol = 0.5 } = {}) {
  const list = samples ?? [];
  const offenders = [];
  const ok = list.filter((x) => Number.isFinite(x.gap));
  for (const x of list) if (!Number.isFinite(x.gap)) offenders.push({ path: x.label, note: 'no gap measured' });
  if (ok.length < 2) offenders.push({ path: '.swm-corner', note: `${ok.length} gap measured: nothing to compare` });
  else {
    const lo = Math.min(...ok.map((x) => x.gap));
    const hi = Math.max(...ok.map((x) => x.gap));
    if (hi - lo > tol) for (const x of ok) if (Math.abs(x.gap - lo) > tol) offenders.push({ path: x.label, gap: fixed(x.gap, 2), note: `${fixed(x.gap - lo, 2)} px off the lowest seat (${fixed(lo, 2)})` });
  }
  for (const x of ok) if (Number.isFinite(x.clear) && x.gap < x.clear - tol) offenders.push({ path: x.label, gap: fixed(x.gap, 2), clear: fixed(x.clear, 2), note: `gap ${fixed(x.gap, 2)} is under the phone clearance ${fixed(x.clear, 2)}` });
  const gaps = ok.map((x) => x.gap);
  return result(offenders, list.length, `${list.length} seats, gap ${gaps.length ? fixed(Math.min(...gaps), 2) : '?'} to ${gaps.length ? fixed(Math.max(...gaps), 2) : '?'} px`);
}

/**
 * rightEdge — the badge's right edge is the viewport's right edge, at rest and engaged, on every route
 * and width (Nathan 11-16: "all the way to the right edge of the viewport"). `samples` = [{ label, right,
 * vw }]: the badge tile's right edge and the viewport's width in CSS px, one per route, width and
 * state. Within `tol` px (0.5). No sample, or a missing number, fails: a run that measured nothing
 * proves nothing.
 */
export function rightEdge(samples, { tol = 0.5 } = {}) {
  const offenders = [];
  const list = samples ?? [];
  if (!list.length) offenders.push({ path: '.swm-corner .fp-scale::before', note: 'no right edge measured' });
  for (const x of list) {
    if (!Number.isFinite(x.right) || !Number.isFinite(x.vw)) offenders.push({ path: x.label, note: 'right edge or viewport width unreadable' });
    else if (Math.abs(x.vw - x.right) > tol) offenders.push({ path: x.label, note: `right edge ${fixed(x.right, 2)} is ${fixed(x.vw - x.right, 2)} px short of the viewport's ${fixed(x.vw, 2)}` });
  }
  return result(offenders, list.length, `${list.length} states, each within ${tol} px of the viewport's right edge`);
}

/**
 * noClip — no circle is ever cut by a straight box edge (Nathan 11-16: "weird clipping when the globe
 * is at an intermediate position"). `frames` = [{ label, circles: [{ name, op, x, y, w, h }], clips:
 * [{ name, x, y, w, h }] }]: each sampled frame of the entrance, the exit and a page through the
 * stations carries every circle's box and effective opacity, and the box of every ancestor that clips
 * (overflow other than visible, a mask, a clip-path). A circle is CUT where it is visible (`op` above
 * `minOp`), reaches into a clip box (overlap above `tol` on both axes) and leaves it by more than
 * `tol` on some side. A circle wholly outside is simply not shown, wholly inside is whole. The
 * viewport's edge is the one hard edge the design allows, and is not a clip box here. No frame fails.
 */
export function noClip(frames, { minOp = 0.03, tol = 0.75 } = {}) {
  const offenders = [];
  const list = frames ?? [];
  if (!list.length) offenders.push({ path: '.fp-scale__station', note: 'no frames sampled' });
  let circles = 0;
  const seen = new Set();
  for (const f of list) {
    for (const c of f.circles ?? []) {
      circles++;
      if (!(c.op > minOp)) continue;
      for (const k of f.clips ?? []) {
        const wide = Math.min(c.x + c.w, k.x + k.w) - Math.max(c.x, k.x);
        const high = Math.min(c.y + c.h, k.y + k.h) - Math.max(c.y, k.y);
        if (!(wide > tol && high > tol)) continue;
        const out = Math.max(k.x - c.x, c.x + c.w - (k.x + k.w), k.y - c.y, c.y + c.h - (k.y + k.h));
        const key = `${c.name}|${k.name}`;
        if (out > tol && !seen.has(key) && offenders.length < 8) {
          seen.add(key);
          offenders.push({ path: c.name, clip: k.name, frame: f.label, opacity: fixed(c.op, 2), note: `visible circle cut by ${k.name}: ${fixed(out, 1)} px outside it` });
        }
      }
    }
  }
  return result(offenders, list.length, `${list.length} frames, ${circles} circle samples`);
}

/**
 * blurbClear — the badge tile and the home footer's blurb text do not meet. `tile` and `blurb` are
 * { x, y, w, h } in viewport CSS px (the blurb is the union of its text boxes, never the element's
 * own full-width box). The blurb is one nowrap line that fills the measure down to the right edge
 * between about 1130 px and 1500 px, where a badge flush with the corner would otherwise sit over
 * its last words. A missing box fails: a run that measured no blurb proves nothing.
 */
export function blurbClear(tile, blurb) {
  const path = '.site-footer__blurb';
  if (!tile) return result([{ path, note: 'no badge box measured' }], 0, 'no tile');
  if (!blurb || !(blurb.w > 0 && blurb.h > 0)) return result([{ path, note: 'no blurb text measured' }], 0, 'no blurb');
  const wide = Math.min(tile.x + tile.w, blurb.x + blurb.w) - Math.max(tile.x, blurb.x);
  const high = Math.min(tile.y + tile.h, blurb.y + blurb.h) - Math.max(tile.y, blurb.y);
  const hit = wide > 0.5 && high > 0.5;
  const offenders = hit ? [{ path, tile: rectOf(tile), blurb: rectOf(blurb), note: `the badge covers ${fixed(wide, 1)} x ${fixed(high, 1)} px of the blurb` }] : [];
  return result(offenders, 1, `tile ${rectOf(tile)}, blurb ${rectOf(blurb)}`);
}

/**
 * circlesAbove — how many circles show above the lens once the engaged column has settled (SQ-107 pass 11, Nathan
 * 11-17: "on desktop lets have the fade on the top outer globe not show that second smaller one since it overlaps
 * with the text blurb"). `c` = { vpw, lensCy (the lens line, viewport y), circles: [{ name, op (effective opacity), x,
 * y, w, h }], blurb: { x, y, w, h } | null }. A circle SHOWS above the lens when its effective opacity is over
 * `visible` and its centre is above the lens line. Above 768px exactly ONE shows (the near one); at 768px and below
 * two (the near and the far). Above 768px no shown circle's box meets the home blurb's text box by more than `tol`,
 * with the blurb measured (a run that found none fails: it proves nothing about the overlap); at 768px and below the
 * overlap is reported on the note, not failed (the phone's pager column and the blurb are Nathan's to call there).
 * `tol` is 1.5 px, not the 0.5 of the other overlap gates: the blurb's box is the font's content area, whose bottom
 * band is descender room (about a fifth of the font size, 5 px at 1440 px) that carries ink only for g, j, p, q, y, and
 * the near circle's top tip lies 0.9 to 1.1 px inside it at 1280 and 1440 (measured). The far circle, the one this gate
 * exists for, overlaps by its whole height, and a near circle 3 px higher fails.
 */
export function circlesAbove(c, { visible = 0.01, tol = 1.5 } = {}) {
  const offenders = [];
  const circles = c?.circles ?? [];
  const vpw = c?.vpw;
  if (!circles.length || !Number.isFinite(c?.lensCy) || !Number.isFinite(vpw)) {
    return result([{ path: '.swm-corner .fp-scale__station', note: 'no engaged column measured' }], 0, 'no column');
  }
  const desktop = vpw > 768;
  const want = desktop ? 1 : 2;
  const shown = circles.filter((x) => x.op > visible);
  const above = shown.filter((x) => x.y + x.h / 2 < c.lensCy - 1);
  if (above.length !== want) {
    offenders.push({ path: '.swm-corner .fp-scale__station', note: `${above.length} circle(s) show above the lens at ${vpw} px (opacity over ${visible}), want ${want}: ${above.map((x) => `${x.name} ${fixed(x.op, 2)}`).join(', ') || 'none'}` });
  }
  const blurb = c?.blurb;
  const meets = blurb ? shown.filter((x) => Math.min(x.x + x.w, blurb.x + blurb.w) - Math.max(x.x, blurb.x) > tol && Math.min(x.y + x.h, blurb.y + blurb.h) - Math.max(x.y, blurb.y) > tol) : [];
  if (desktop && !blurb) offenders.push({ path: '.site-footer__blurb', note: 'no blurb text measured: the overlap with it is unproven' });
  if (desktop) for (const x of meets) offenders.push({ path: '.site-footer__blurb', note: `${x.name} (opacity ${fixed(x.op, 2)}) at ${rectOf(x)} meets the blurb text ${rectOf(blurb)}` });
  const note = `${above.length} above the lens (${above.map((x) => fixed(x.op, 2)).join(', ') || 'none'}), ${shown.length - above.length} at or below${blurb ? `, ${meets.length} meeting the blurb${desktop ? '' : ' (not failed on a phone)'}` : ', no blurb'}`;
  return result(offenders, shown.length, note);
}

/**
 * clearOfBlurb — the desktop seat sits ABOVE the home footer's black panel (and so its blurb), at rest and engaged (SQ-121,
 * Nathan 11-18: the engaged eyes covered the blurb's text and the privacy pill on home at rest; SQ-125, Nathan 11-18: "move the
 * eye badge up higher on desktop so that the lower badge clears the black footer blurb container with 2 px of gap", then "lets bump the gap to 4 px for engaged and footer blurb container"). `c` =
 * { rest, engaged }, each a measurement of the page in that state: { tile {x,y,w,h} (the lens badge, the pager's ::before at
 * its lifted size), blurb {x,y,w,h} (the union of the blurb's text boxes), panel {x,y,w,h} (`.site-footer--links`, the black
 * panel, as painted), pill {x,y,w,h} | null (the privacy pill), parts: [{ name, op, x, y, w, h }] (the eye, every station's
 * circle and its own badge: op is the effective opacity, rects as painted, shifted and lifted) }.
 * THE SEAT IS EXACT (SQ-125): ENGAGED the bottom edge of the LOWEST VISIBLE PART of the column (the lens badge, the eye, every
 * station circle and its own badge over `visible`: on desktop the near ring below the lens, Nathan 11-18: "why aren't i seeing
 * the black scheme below the currently selected? that one needs to be accounted for in the vertical positioning") is the option
 * `gap` (4 px, Nathan's number, not whatever ?schemeblurbgap dialed) above the panel's top edge, within `tol` (0.5 px) EITHER WAY
 * (a seat too high fails as surely as one too low). The ring below must SHOW: an engaged column with no visible part centred
 * below the lens fails (?schemedown=0 is that column, its seat 30 px too low for the ring it hides). AT REST the lowest of the
 * smaller badge and the eye (they share the lens centre) is at least `gap` above the panel's top edge (`tol`). A state with no
 * panel fails: a run that found none proves nothing.
 * AT REST the tile's bottom edge is above the blurb text's top edge (`tol` 0.5 px) and the tile does not meet the pill.
 * ENGAGED no visible part (op over `visible`), and not the lens badge, meets the blurb text or the pill by more than `tol`
 * on both axes. A state with no blurb measured fails: a run that found none proves nothing about the overlap. The pill is
 * allowed to be absent (a route or width with none), the blurb is not: this is the home page's gate.
 */
export function clearOfBlurb(c, { tol = 0.5, visible = 0.01, gap: want = 4 } = {}) {
  const offenders = [];
  const meets = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tol && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tol;
  const rest = c?.rest;
  const eng = c?.engaged;
  if (!rest?.tile || !rest?.blurb) return result([{ path: '.site-footer__blurb', note: 'no rest tile or blurb text measured' }], 0, 'no rest');
  if (!eng?.tile || !eng?.blurb) return result([{ path: '.site-footer__blurb', note: 'the pager never engaged: no engaged tile or blurb text measured' }], 0, 'no engaged');
  if (rest.tile.y + rest.tile.h > rest.blurb.y + tol) {
    offenders.push({ path: '.swm-corner .fp-scale::before', state: 'rest', tile: rectOf(rest.tile), blurb: rectOf(rest.blurb), note: `the resting badge's bottom edge (${fixed(rest.tile.y + rest.tile.h, 1)}) is ${fixed(rest.tile.y + rest.tile.h - rest.blurb.y, 1)} px below the blurb text's top edge (${fixed(rest.blurb.y, 1)})` });
  }
  if (rest.pill && meets(rest.tile, rest.pill)) offenders.push({ path: '.site-privacy', state: 'rest', tile: rectOf(rest.tile), pill: rectOf(rest.pill), note: 'the resting badge meets the privacy pill' });
  const shown = [{ name: 'lens badge', op: 1, ...eng.tile }, ...(eng.parts ?? []).filter((p) => p.op > visible)];
  for (const p of shown) {
    if (meets(p, eng.blurb)) offenders.push({ path: '.site-footer__blurb', state: 'engaged', part: p.name, rect: rectOf(p), blurb: rectOf(eng.blurb), note: `${p.name} (opacity ${fixed(p.op, 2)}) at ${rectOf(p)} meets the blurb text ${rectOf(eng.blurb)}` });
    if (eng.pill && meets(p, eng.pill)) offenders.push({ path: '.site-privacy', state: 'engaged', part: p.name, rect: rectOf(p), pill: rectOf(eng.pill), note: `${p.name} (opacity ${fixed(p.op, 2)}) at ${rectOf(p)} meets the privacy pill ${rectOf(eng.pill)}` });
  }
  if (!eng.panel || !rest.panel) {
    offenders.push({ path: '.site-footer--links', note: 'no black panel rect measured: the seat against the panel is unproven' });
  } else {
    const low = lowest(shown);
    const restLow = lowest([{ name: 'resting badge', ...rest.tile }, ...(rest.eye ? [{ name: 'eye', ...rest.eye }] : []), ...(rest.parts ?? []).filter((p) => p.op > visible)]);
    const engGap = eng.panel.y - low.bottom;
    const restGap = rest.panel.y - restLow.bottom;
    const lensCy = eng.tile.y + eng.tile.h / 2;
    const below = shown.filter((p) => p.y + p.h / 2 > lensCy + 1);
    if (!below.length) {
      offenders.push({ path: '.swm-corner .fp-scale__station', state: 'engaged', note: `no ring shows below the lens (${shown.length} visible parts, none centred under the lens badge's centre ${fixed(lensCy, 1)}): the column's lowest part is the ${low.name}, ${fixed(engGap, 2)} px above the panel, the seat sized for a ring that is hidden` });
    }
    if (Math.abs(engGap - want) > tol) {
      offenders.push({ path: '.swm-corner .fp-scale', state: 'engaged', part: low.name, panel: rectOf(eng.panel), note: `the engaged column's lowest part (${low.name}) bottom edge (${fixed(low.bottom, 1)}) is ${fixed(engGap, 2)} px above the black panel's top edge (${fixed(eng.panel.y, 1)}), want ${fixed(want, 2)} (within ${tol} px, either way)` });
    }
    if (restGap < want - tol) {
      offenders.push({ path: '.swm-corner .fp-scale::before', state: 'rest', part: restLow.name, panel: rectOf(rest.panel), note: `the resting ${restLow.name}'s bottom edge (${fixed(restLow.bottom, 1)}) is ${fixed(restGap, 2)} px above the black panel's top edge (${fixed(rest.panel.y, 1)}), want at least ${fixed(want, 2)}` });
    }
  }
  const gap = eng.blurb.y - (eng.tile.y + eng.tile.h);
  const lowOf = lowest(shown);
  const panelGap = eng.panel ? eng.panel.y - lowOf.bottom : NaN;
  return result(offenders, shown.length, `${shown.length} engaged parts, lens badge ${rectOf(eng.tile)}, lowest part ${lowOf.name} ${fixed(panelGap, 2)} px above the black panel (dialed ${fixed(want, 2)}) and the lens badge ${fixed(gap, 1)} px above the blurb text ${rectOf(eng.blurb)}${eng.pill ? `, pill ${rectOf(eng.pill)}` : ', no pill'}; resting badge ${fixed(rest.blurb.y - (rest.tile.y + rest.tile.h), 1)} px above the text`);
}

/** The part whose bottom edge is lowest on the page (the highest y + h): { name, bottom }. */
function lowest(parts) {
  let low = { name: 'nothing', bottom: -Infinity };
  for (const p of parts) if (Number.isFinite(p.y + p.h) && p.y + p.h > low.bottom) low = { name: p.name, bottom: p.y + p.h };
  return low;
}

/**
 * phoneRects — the phone's rects are the base build's, to the pixel (SQ-121: nothing at 768px and under moves). `base` and
 * `now` are { <label>: { tile, eye, parts: [{ name, op, x, y, w, h }] } } from two builds of the same routes at 390 x 844,
 * the base build's from a `--capture`. Every rect of every label must agree within `tol` (0.01 px), and neither side may be
 * empty: a comparison of nothing proves nothing.
 */
export function phoneRects(base, now, { tol = 0.01 } = {}) {
  const offenders = [];
  const labels = Object.keys(now ?? {});
  if (!labels.length || !base || !Object.keys(base).length) return result([{ path: '.swm-corner', note: 'no phone rects to compare' }], 0, 'nothing compared');
  const flat = (m) => [['tile', m?.tile], ['eye', m?.eye], ...(m?.parts ?? []).map((p) => [p.name, p])];
  let n = 0;
  for (const label of labels) {
    const a = new Map(flat(base[label]));
    const b = new Map(flat(now[label]));
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      n++;
      const r = a.get(key);
      const s = b.get(key);
      if (!r || !s) {
        offenders.push({ path: label, part: key, note: `${key} is ${r ? 'gone from' : 'new in'} the candidate` });
        continue;
      }
      const d = Math.max(Math.abs(r.x - s.x), Math.abs(r.y - s.y), Math.abs(r.w - s.w), Math.abs(r.h - s.h), 100 * Math.abs((r.op ?? 1) - (s.op ?? 1)));
      if (d > tol) offenders.push({ path: label, part: key, note: `${key} moved ${fixed(d, 3)} px: base ${rectOf(r)}, now ${rectOf(s)}` });
    }
  }
  return result(offenders, n, `${labels.length} phone states, ${n} rects, within ${tol} px of the base build`);
}

/** The strip's panels in SCHEMES order (colorScheme.js): project's glass, black, blue. */
export const STRIP_ORDER = ['glass', 'black', 'blue'];

/** The class of one badge pixel: blue (opaque brand blue), black, or glass (anything else: a veil over the page). */
export function stripClass(rgb) {
  const [r, g, b] = rgb ?? [];
  if (![r, g, b].every(Number.isFinite)) return null;
  if (b >= 200 && r <= 40 && g <= 40) return 'blue';
  if (Math.max(r, g, b) <= 40) return 'black';
  return 'glass';
}

/**
 * strip — the badge is a clipping window onto the strip of the three background panels, and the
 * strip rides the column's position (SQ-107 pass 7): ONE DETENT = ONE BADGE HEIGHT. `frames` = [{ q,
 * rows, col }]: the column position q (the engine's --scale-qf), the height of the tile in sampled rows
 * and the pixels of its middle column, top to bottom ([r, g, b] each; the art is hidden so only the
 * background shows, over a flat page). At a whole q exactly ONE class fills the badge and it is the
 * station's (q mod 3 in STRIP_ORDER). Between detents the current panel (floor(q)) is the top
 * run, the next one the bottom run, and the one straight seam sits at (1 - fraction) x the height,
 * within `tol` of it (rows, the larger of 2 and 4% of the height). Anything else is an offender: a
 * third colour, a second seam, a strip that does not move with q. No frames fails.
 * SQ-125: each band is the badge plus `margin` rows on each side (--badge-strip-pad, in device rows; 0 for a build without it): the
 * window sits that far into its band, so the seam is at (1 - fraction) x (height + 2 x margin) - margin, and a q within
 * margin / (height + 2 x margin) of a whole one still shows one band.
 */
export function strip(frames, { order = STRIP_ORDER, tol = 2, margin = 0 } = {}) {
  const offenders = [];
  const list = frames ?? [];
  const n = order.length;
  const at = (i) => order[((Math.floor(i) % n) + n) % n];
  for (const f of list) {
    const col = (f.col ?? []).map(stripClass);
    const rows = col.length || f.rows || 0;
    const path = `.swm-corner .fp-scale::before q=${fixed(f.q, 2)}`;
    if (!rows || col.some((c) => c == null)) {
      offenders.push({ path, note: 'no pixels read' });
      continue;
    }
    // Runs of one class; a one- or two-row run is the seam's anti-aliasing, not a panel.
    const runs = [];
    for (const c of col) {
      if (runs.length && runs[runs.length - 1].c === c) runs[runs.length - 1].n++;
      else runs.push({ c, n: 1 });
    }
    const real = runs.filter((r) => r.n > 2 || runs.length === 1);
    const merged = [];
    for (const r of real) {
      if (merged.length && merged[merged.length - 1].c === r.c) merged[merged.length - 1].n += r.n;
      else merged.push({ ...r });
    }
    const frac = f.q - Math.floor(f.q);
    // SQ-125: a band is the badge plus `margin` rows a side (--badge-strip-pad), so the seam is that far into the next detent's travel
    // before it enters the window: at a q this close to a whole one the window still holds one band.
    const edge = margin / (rows + 2 * margin);
    const nearUp = frac > 0.98 - edge;
    const whole = frac < 0.02 + edge || nearUp;
    const topIdx = nearUp ? Math.floor(f.q) + 1 : Math.floor(f.q);
    const seq = merged.map((r) => `${r.c} x${r.n}`).join(', ');
    if (whole) {
      if (merged.length !== 1 || merged[0].c !== at(topIdx)) offenders.push({ path, note: `want one ${at(topIdx)} panel filling the badge, got ${seq}` });
      continue;
    }
    if (merged.length !== 2 || merged[0].c !== at(topIdx) || merged[1].c !== at(topIdx + 1)) {
      offenders.push({ path, note: `want ${at(topIdx)} above ${at(topIdx + 1)}, got ${seq}` });
      continue;
    }
    const seam = merged[0].n;
    const want = (1 - frac) * (rows + 2 * margin) - margin;
    if (Math.abs(seam - want) > Math.max(tol, 0.04 * rows)) offenders.push({ path, note: `seam at row ${seam} of ${rows}, want ${fixed(want, 1)} ((1 - ${fixed(frac, 2)}) x the height${margin ? `, a band ${margin} rows wider a side` : ''})` });
  }
  return result(offenders, list.length, `${list.length} frames, one detent = one badge height`);
}

/**
 * bandEdges — at a SETTLED station the badge is ONE band (glass, black or blue) right to its first and last pixel row (SQ-125,
 * Nathan 11-18: "whats the thin color strip at the bottom of the rest and engaged chips im seeing in your screenshots?"). The
 * `strip` gate above reads the middle column and calls a one- or two-row run the seam's anti-aliasing, so a row of the NEXT
 * band's colour on the box's edge got past it. `states` = [{ label, rows, palette }]: `rows` the vertical profile of a flat-grey page
 * with only the badge painted, [r, g, b] per pixel row top to bottom (the mean across the tile's width), padded with page rows above
 * and below (the first row is the page's own colour); `palette` = { glass, black, blue }, each band's [r, g, b] at its interior, read
 * from the same tile at --scale-qf 0, 1 and 2. The tile is the run of rows that differ from the page; its own band is the palette
 * entry nearest its middle row. Each of its first and last `edge` rows is a band over the page (an edge row may be partly covered,
 * so a row is the page blended with a band at some coverage 0..1): for every band the best coverage and what is left unexplained.
 * A row FAILS when it is closer to another band than to its own: its own band leaves more than `tol` unexplained and another leaves
 * less. A blend of the own band with the page passes. No state, no palette or no tile found fails: a run that read nothing proves nothing.
 */
export function bandEdges(states, { tol = 12, edge = 2 } = {}) {
  const offenders = [];
  let n = 0;
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const explain = (row, page, band) => {
    const d = sub(band, page);
    const len = dot(d, d);
    const a = len > 0 ? Math.min(1, Math.max(0, dot(sub(row, page), d) / len)) : 0;
    const left = sub(row, page.map((v, i) => v + a * d[i]));
    return { a, res: Math.sqrt(dot(left, left)) };
  };
  for (const s of states ?? []) {
    const rows = s.rows ?? [];
    const names = Object.keys(s.palette ?? {});
    if (rows.length < 3 || names.length < 2) {
      offenders.push({ path: s.label, note: 'no pixel rows or no band palette read' });
      continue;
    }
    const page = rows[0];
    const differs = (r) => r.some((v, i) => Math.abs(v - page[i]) > 2);
    const first = rows.findIndex(differs);
    const last = rows.length - 1 - [...rows].reverse().findIndex(differs);
    if (first < 0 || last - first < 2 * edge) {
      offenders.push({ path: s.label, note: 'no badge found in the pixel rows (nothing differs from the flat page)' });
      continue;
    }
    const tile = rows.slice(first, last + 1);
    const mid = tile[Math.floor(tile.length / 2)];
    const dist = (a, b) => Math.sqrt(dot(sub(a, b), sub(a, b)));
    const own = names.reduce((best, k) => (dist(mid, s.palette[k]) < dist(mid, s.palette[best]) ? k : best), names[0]);
    const check = (side, i) => {
      n++;
      const row = tile[i];
      const mine = explain(row, page, s.palette[own]);
      if (mine.res <= tol) return;
      const rival = names.filter((k) => k !== own).map((k) => ({ k, ...explain(row, page, s.palette[k]) })).sort((x, y) => x.res - y.res)[0];
      if (rival.res < mine.res) {
        offenders.push({ path: s.label, row: `${side} row ${side === 'top' ? i : tile.length - 1 - i} of ${tile.length}`, rgb: row.map((v) => fixed(v, 0)), own, closer: rival.k, note: `the ${side} row of the ${own} badge is ${rival.k} (rgb ${row.map((v) => fixed(v, 0)).join(',')}; ${own} leaves ${fixed(mine.res, 0)} unexplained, ${rival.k} ${fixed(rival.res, 0)}): a strip of the next band on the edge of a settled badge` });
      }
    };
    for (let i = 0; i < edge; i++) check('top', i);
    for (let i = tile.length - edge; i < tile.length; i++) check('bottom', i);
  }
  return result(offenders, n, `${(states ?? []).length} settled badges, ${n} edge rows, none the colour of another band`);
}

/**
 * seamEdges — at a settled engaged station the badge ABOVE the lens and the badge BELOW it end exactly where the lens badge does (SQ-125,
 * Nathan 11-18 on the round-3 crops: "the blue badge at the top is clipping into the central badge"). Each neighbour is clipped off the
 * lens badge's window, but the lens box and the neighbour's clip each land on the device pixel grid their own way, so a neighbour could paint
 * into the lens's first or last rows (an overlap) or stop short of them (a gap the page shows through). `states` = [{ label, lens, nbs, top,
 * scale, y0, y1 }]: `lens` the vertical profile of a flat-grey page with ONLY the lens badge painted, `nbs` the same with only the
 * neighbours' badges painted, each [r, g, b] per DEVICE pixel row top to bottom (the mean across a few columns inside the neighbours'
 * width), the first row at CSS y `top` (an integer), `scale` the device pixel ratio (default 1); `y0` and `y1` the lens badge's laid-out top
 * and bottom edge in CSS px, only to say where to look. An edge is read as sub-pixel position: the full rows' end plus the coverage of the
 * partly covered rows past it (a row's coverage = how far it is from the page's colour toward the badge's, 0..1). Top seam: the neighbour
 * above ends at N0 and the lens starts at L0; bottom seam: the lens ends at L1 and the neighbour below starts at N1. A seam FAILS when the
 * two edges are more than `tol` CSS px apart: a neighbour past the lens's edge paints into its rows, one short of it leaves a gap. No state,
 * no lens or no neighbour found fails: a run that read nothing proves nothing.
 */
export function seamEdges(states, { tol = 0.25, page = [128, 128, 128] } = {}) {
  const offenders = [];
  let n = 0;
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
  const cover = (row, colour) => {
    const d = sub(colour, page);
    return Math.min(1, Math.max(0, dot(sub(row, page), d) / dot(d, d)));
  };
  const FULL = 0.97;
  for (const s of states ?? []) {
    const k = s.scale ?? 1;
    const at = (rows, y) => rows?.[Math.floor((y - s.top) * k)];
    const lensMid = at(s.lens, (s.y0 + s.y1) / 2);
    const above = at(s.nbs, s.y0 - 8);
    const below = at(s.nbs, s.y1 + 8);
    const far = (c) => !c || Math.sqrt(dot(sub(c, page), sub(c, page))) < 12;
    if (!s.lens?.length || !s.nbs?.length || !Number.isFinite(s.y0) || !Number.isFinite(s.y1) || !Number.isFinite(s.top) || far(lensMid) || far(above) || far(below)) {
      offenders.push({ path: s.label, note: 'no lens badge or no neighbour badge found in the pixel rows (nothing differs from the flat page)' });
      continue;
    }
    const y = (i) => s.top + i / k;
    const i0 = Math.floor((s.y0 - s.top) * k);
    const i1 = Math.floor((s.y1 - s.top) * k);
    const sum = (rows, colour, from, to) => { let t = 0; for (let i = from; i <= to; i++) t += rows[i] ? cover(rows[i], colour) : 0; return t / k; };
    // the lens's top: its first full row (scanning down from 4 rows above the laid-out edge) less the coverage of the 3 rows before it
    let f = i0 - 4;
    while (f < i0 + 5 && cover(s.lens[f] ?? page, lensMid) < FULL) f++;
    const L0 = y(f) - sum(s.lens, lensMid, f - 3, f - 1);
    let l = i1 + 4;
    while (l > i1 - 5 && cover(s.lens[l] ?? page, lensMid) < FULL) l--;
    const L1 = y(l + 1) + sum(s.lens, lensMid, l + 1, l + 3);
    // the neighbour above ends where its full rows end plus the coverage of the 3 rows after; the one below starts the same way from below
    let a = i0 - 4;
    while (a < i0 + 5 && cover(s.nbs[a + 1] ?? page, above) >= FULL) a++;
    const N0 = y(a + 1) + sum(s.nbs, above, a + 1, a + 3);
    let b = i1 + 4;
    while (b > i1 - 5 && cover(s.nbs[b - 1] ?? page, below) >= FULL) b--;
    const N1 = y(b) - sum(s.nbs, below, b - 3, b - 1);
    for (const [seam, over] of [['top', N0 - L0], ['bottom', L1 - N1]]) {
      n++;
      if (Math.abs(over) > tol) offenders.push({ path: s.label, seam, overlap: fixed(over, 2), lens: fixed(seam === 'top' ? L0 : L1, 2), neighbour: fixed(seam === 'top' ? N0 : N1, 2), note: `the ${seam === 'top' ? 'neighbour above ends at' : 'neighbour below starts at'} y ${fixed(seam === 'top' ? N0 : N1, 2)} but the lens badge ${seam === 'top' ? 'starts' : 'ends'} at ${fixed(seam === 'top' ? L0 : L1, 2)}: it ${over > 0 ? `paints ${fixed(over, 2)} px into the lens` : `stops ${fixed(-over, 2)} px short of it (a gap the page shows through)`}, over ${tol} px` });
    }
  }
  return result(offenders, n, `${(states ?? []).length} engaged lens badges, ${n} seams, each neighbour ends within ${tol} px of the lens's edge`);
}

/**
 * lensLayer — the lens badge reads as ONE layer of its panel: no neighbour badge paints inside its window, the station that is the lens
 * included (SQ-126 rework, the integrator on b05b8ad: the project station's own glass badge painted under the lens, two 35% veils reading
 * as one denser one, ~58% white, so ?schemeglass 35 broke). `states` = [{ label, lens, both, top, scale, y0, y1 }]: `lens` the vertical
 * profile of a flat-grey page with ONLY the lens badge painted, `both` the same with the lens AND every station's badge painted, rows and
 * coordinates as seamEdges reads them. Every device row strictly inside the lens badge (`margin` CSS px in from y0 and y1, away from the
 * seams, which seamEdges owns) must read the same in both, within `tol` levels per channel. No state or no rows inside fails.
 */
export function lensLayer(states, { tol = 4, margin = 2 } = {}) {
  const offenders = [];
  let n = 0;
  for (const s of states ?? []) {
    const k = s.scale ?? 1;
    const from = Math.ceil((s.y0 + margin - s.top) * k);
    const to = Math.floor((s.y1 - margin - s.top) * k) - 1;
    if (!s.lens?.length || !s.both?.length || !Number.isFinite(s.y0) || !Number.isFinite(s.y1) || !Number.isFinite(s.top) || to < from || !s.lens[to] || !s.both[to] || from < 0) {
      offenders.push({ path: s.label, note: 'no rows inside the lens badge to read' });
      continue;
    }
    let worst = { d: 0, i: from };
    for (let i = from; i <= to; i++) {
      n++;
      const d = Math.max(...s.lens[i].map((v, c) => Math.abs(v - s.both[i][c])));
      if (d > worst.d) worst = { d, i };
    }
    if (worst.d > tol) {
      const y = fixed(s.top + worst.i / k, 2);
      offenders.push({ path: s.label, y, delta: fixed(worst.d, 1), lens: s.lens[worst.i].map((v) => Math.round(v)), both: s.both[worst.i].map((v) => Math.round(v)), note: `inside the lens badge at y ${y} a neighbour's badge paints under it: ${s.lens[worst.i].map((v) => Math.round(v)).join(',')} alone vs ${s.both[worst.i].map((v) => Math.round(v)).join(',')} with the stations' badges (${fixed(worst.d, 1)} levels, over ${tol}): two layers, not one` });
    }
  }
  return result(offenders, n, `${(states ?? []).length} engaged lens badges, ${n} rows inside, each the lens badge's alone within ${tol} levels`);
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
 * persist — the widget is the SAME node across a soft navigation, never fades and is never COVERED
 * (SQ-107 pass 7). `samples` = [{ same, op, vis, gone? }], one per frame from the click to the
 * settle: the node's identity mark survives (`same`), its computed opacity stays 1 and its visibility
 * stays visible (a frame flagged `menu` is under the phone menu's takeover, which covers the badge by design: skipped). A fade (opacity below 1, or visibility hidden, even for one frame) or a remount
 * (`gone`, or a new node) is an offender. The computed style cannot see the route fill laid over the
 * badge (the fill is a layer above it), so `pixels` = [{ t, n }] reads the PAINT: n is the count of
 * the badge's art pixels (iris and lids against the clip's most common colour: how many depends on what shows behind the glass, so the bar is low) (red, green, yellow: the page behind and a blue or black fill
 * have none) in a screenshot of the badge at time t, and `rest` the count before the click. A frame
 * under `minShare` of rest is covered. With `pixels` given, none at all fails (nothing was seen).
 */
export function persist(samples, { pixels = null, rest = null, minShare = 0.25 } = {}) {
  const offenders = [];
  let first = null;
  let underMenu = 0;
  (samples ?? []).forEach((s, i) => {
    if (s.menu) {
      underMenu++;
      return;
    }
    const why = s.gone ? 'the widget was gone' : !s.same ? 'a different node (remounted)' : !(Number(s.op) >= 0.999) ? `opacity ${s.op}` : s.vis !== 'visible' ? `visibility ${s.vis}` : null;
    if (why) {
      first ??= i;
      if (offenders.length < 5) offenders.push({ path: '.swm-corner', frame: i, note: why });
    }
  });
  const n = (samples ?? []).length;
  let seen = '';
  if (pixels) {
    const ok = Number(rest) > 0 && pixels.length > 0;
    if (!ok) offenders.push({ path: '.swm-corner', note: 'no badge pixels read before and during the passage' });
    else {
      const covered = pixels.filter((p) => !(p.n >= minShare * rest));
      for (const p of covered.slice(0, 5)) offenders.push({ path: '.swm-corner', t: Math.round(p.t), note: `covered: ${p.n} iris pixels of ${rest} at rest` });
      seen = `, ${pixels.length} paints (${covered.length} covered)`;
    }
  }
  return result(offenders, n, `${n} frames${underMenu ? ` (${underMenu} under the phone menu's takeover, which covers the badge by design)` : ''}${first == null ? '' : `, first bad frame ${first}`}${seen}`);
}

/**
 * menuWipe — the phone menu's takeover wipes OVER the badge (SQ-107 pass 8), never hiding or fading it.
 * `frames` are one per animation frame through the four phases, each
 * { phase: open | hold | close | change-open | change, edge, up, zMenu, zBadge, op, vis, inert }:
 * `edge` is the takeover's rendered top in px (the viewport height with the menu down, 0 with it up),
 * `up` that the menu is rendered at all, `zMenu` and `zBadge` the root stacking level of each (the
 * outermost ancestor's z-index), `op` / `vis` the badge's own computed opacity and visibility, `inert`
 * its inert flag. `tile` is the badge rectangle { x, y, w, h } at rest.
 * Every frame: the badge is there at opacity 1 and visible (never hidden or faded as a whole, whatever
 * the edge does), sits BELOW the menu in paint order (so the part under the edge shows the menu and the
 * part above it the badge), and is inert while the menu is up. The edge never reverses within a wipe
 * (falls on the way in, rises on the way out), holds at the top through the hold and a page change, and
 * the run must have seen it cross the badge's box on the way in and on the way out (`minPartial` frames
 * each), or it proves nothing. `reduced`: the menu snaps, so the edge is only ever 0 or the height.
 * `pixels` (optional, slow motion): { e0, e1, rows: [{ y, share }] } per screenshot, `share` the fraction
 * of that tile row painted the menu's colour, the edge read just before (e0) and after (e1): a row below
 * both must be the menu's, a row above both must not be.
 */
export function menuWipe(frames, tile, { pixels = null, reduced = false, minPartial = 3, tol = 1 } = {}) {
  const offenders = [];
  const list = frames ?? [];
  const bad = (i, why) => {
    if (offenders.length < 8) offenders.push({ path: '.swm-corner', frame: i, phase: list[i]?.phase, note: why });
  };
  const top = tile?.y ?? 0;
  const bottom = top + (tile?.h ?? 0);
  if (!tile || !(tile.h > 0)) offenders.push({ path: '.swm-corner', note: 'no badge rectangle measured' });
  const height = Math.max(...list.map((f) => f.h ?? 0), 0);
  const wipeIn = (f) => f.phase === 'open' || f.phase === 'change-open';
  let partialIn = 0;
  let partialOut = 0;
  list.forEach((f, i) => {
    if (f.gone) return bad(i, 'the badge was gone');
    if (!(Number(f.op) >= 0.999)) bad(i, `the badge faded as a whole (opacity ${f.op}) with the edge at ${fixed(f.edge, 1)} px`);
    else if (f.vis !== 'visible') bad(i, `the badge was hidden as a whole (visibility ${f.vis}) with the edge at ${fixed(f.edge, 1)} px, its box ${fixed(top, 1)}..${fixed(bottom, 1)}`);
    if (f.up && !(f.zMenu > f.zBadge)) bad(i, `the badge paints over the menu (stacking level ${f.zBadge} against the menu's ${f.zMenu})`);
    if (f.up && !f.inert) bad(i, 'the swatches can be reached under the menu (the badge is not inert)');
    if (f.phase === 'hold' && f.edge > tol) bad(i, `the edge is at ${fixed(f.edge, 1)} px in the hold (the menu is not fully up)`);
    if (reduced && f.edge > tol && f.edge < height - tol) bad(i, `the menu was between up and down (edge ${fixed(f.edge, 1)} px): reduced motion snaps it`);
    const prev = list[i - 1];
    if (prev && prev.phase === f.phase) {
      const d = f.edge - prev.edge;
      if (wipeIn(f) && d > tol) bad(i, `the edge went back down ${fixed(d, 1)} px on the way in`);
      if ((f.phase === 'close' || f.phase === 'change') && d < -tol && prev.edge > tol) bad(i, `the edge went back up ${fixed(-d, 1)} px on the way out`);
    }
    if (f.edge > top + tol && f.edge < bottom - tol) {
      if (wipeIn(f)) partialIn++;
      else if (f.phase === 'close' || f.phase === 'change') partialOut++;
    }
  });
  if (!list.length) offenders.push({ path: '.swm-corner', note: 'no frames measured proves nothing' });
  else if (!reduced) {
    if (partialIn < minPartial) offenders.push({ path: '.swm-corner', note: `only ${partialIn} frame(s) caught the edge inside the badge's box on the way in (need ${minPartial})` });
    if (partialOut < minPartial) offenders.push({ path: '.swm-corner', note: `only ${partialOut} frame(s) caught the edge inside the badge's box on the way out (need ${minPartial})` });
  }
  let shots = '';
  if (pixels) {
    let across = 0;
    for (const p of pixels) {
      const lo = Math.min(p.e0, p.e1);
      const hi = Math.max(p.e0, p.e1);
      if ((lo > top && lo < bottom) || (hi > top && hi < bottom)) across++;
      for (const r of p.rows ?? []) {
        if (r.y >= hi + 2 && !(r.share >= 0.9)) offenders.push({ path: '.swm-corner', y: fixed(r.y, 0), note: `row below the edge (${fixed(lo, 0)}..${fixed(hi, 0)} px) paints the badge, not the menu (${fixed(r.share * 100, 0)}% menu)` });
        else if (r.y + 1 <= lo - 2 && !(r.share <= 0.5)) offenders.push({ path: '.swm-corner', y: fixed(r.y, 0), note: `row above the edge (${fixed(lo, 0)}..${fixed(hi, 0)} px) paints the menu, not the badge (${fixed(r.share * 100, 0)}% menu)` });
      }
    }
    if (across < 3) offenders.push({ path: '.swm-corner', note: `only ${across} screenshot(s) caught the edge inside the badge's box` });
    shots = `, ${pixels.length} screenshots (${across} across the badge)`;
  }
  return result(offenders.slice(0, 15), list.length, `${list.length} frames, edge across the badge ${partialIn} in / ${partialOut} out${shots}`);
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
    if (it.op != null && !(it.op > 0.03)) continue; // a circle that is not shown cannot be out of bounds
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
 * box on the eye); with the outer stations left painted the strays are 50-105 px (delta 33-74, a 5x130 box).
 */
export function strays(diff, { tol = 8 } = {}) {
  const bad = diff && diff.pixels > tol ? [{ path: '.fp-scale__station', pixels: diff.pixels, at: diff.at, maxDelta: diff.maxDelta, box: diff.box, note: 'a station outside the shown rows painted' }] : [];
  return result(bad, diff?.total ?? 0, `${diff?.pixels ?? 0} of ${diff?.total ?? 0} px differ at eye-t ${diff?.at}${diff?.pixels ? ` (max channel delta ${diff.maxDelta}, box ${diff.box})` : ''}`);
}

/**
 * jitter — the eye's globe moves along ONE smooth path from rest to engaged and back (SQ-107 pass 5,
 * Nathan: "a slight sudden left jolt that moves the iris a px or two from animation to scaled up").
 * `run` = { engage: [{x, y}...], release: [{x, y}...], settledUp: {x, y}, settledDown: {x, y} }: the
 * globe's centre (CSS px) in each frame of a REAL-TIME run (the entrance and exit slowed by their own
 * durations, never scrubbed with getAnimations), and the centre once each leg had settled. Per leg and
 * per axis: the centre is monotonic in the direction it travels (never gives back more than `rev` px
 * from its furthest point: a centroid's own noise is about 0.1), and the settled pose is within `snap`
 * px (0.5) of the last animated frame, the iris still painted then and gone at the settle, so the
 * hand-over of the rest iris to the column's lens circle is in it.
 */
export function jitter(run, { snap = 0.5, rev = 0.25 } = {}) {
  const offenders = [];
  let n = 0;
  let worstJump = 0;
  let worstBack = 0;
  const leg = (name, pts, settled) => {
    if (!Array.isArray(pts) || pts.length < 8 || !settled || !Number.isFinite(settled.x) || !Number.isFinite(settled.y)) {
      offenders.push({ path: '.swm-corner .scheme-eye', leg: name, note: 'too few samples measured' });
      return;
    }
    n += pts.length;
    for (const ax of ['x', 'y']) {
      const v = pts.map((q) => q[ax]);
      const dir = Math.sign(v[v.length - 1] - v[0]) || 1;
      let far = -Infinity;
      let back = 0;
      for (const val of v) {
        far = Math.max(far, dir * val);
        back = Math.max(back, far - dir * val);
      }
      if (back > rev) offenders.push({ path: '.swm-corner .scheme-eye', leg: name, axis: ax, note: `the centre gave back ${fixed(back, 2)} px against its direction of travel` });
      const jump = Math.abs(settled[ax] - v[v.length - 1]);
      worstJump = Math.max(worstJump, jump);
      worstBack = Math.max(worstBack, back);
      if (jump > snap) offenders.push({ path: '.swm-corner .scheme-eye', leg: name, axis: ax, note: `snap of ${fixed(jump, 2)} px at settle (last animated frame ${fixed(v[v.length - 1], 2)}, settled ${fixed(settled[ax], 2)})` });
    }
  };
  leg('engage', run?.engage, run?.settledUp);
  leg('release', run?.release, run?.settledDown);
  return result(
    offenders,
    n,
    `${run?.engage?.length ?? 0} + ${run?.release?.length ?? 0} samples, ${run?.how ?? 'pixel centroid'}, worst settle step ${fixed(worstJump, 2)} px (limit ${snap}), worst reversal ${fixed(worstBack, 2)} px (limit ${rev})`
  );
}

/**
 * shift — the engaged eye steps off the viewport's edge on /work's stagger taper (SQ-107 pass 10, Nathan
 * 11-17: "account for your thumb covering the selected eye ... the same small arrow and x position
 * offset utilized in the /work pager"). `s` = {
 *   vp: {w}, S, reach, exp,                  the viewport, the shift in px (the DEFAULT, never read back off the
 *                                            page: a page whose shift was forced to 0 must fail), /work's taper
 *   rest:    { eye: {cx, w}, tile: {x, w}, pad, arrow: {opacity} },
 *   engaged: { open, tx0, eye: {x, w}, tile: {x, w}, lensCy,
 *              circles: [{ d, cx }],          d = the circle's distance from the lens in stations, cx its centre x
 *              arrow: {x, y, w, h, opacity, dir} } }
 * Settled, motion on or reduced. A circle d stations out sits at the rest eye's centre, plus the lift's own
 * anchor drift (tx0, the pager's translate: the pass-9 geometry), minus S x (1 - d / reach) ^ exp: the lens
 * the full S, one out 0.444 S, two out 0.111 S. The badge's right edge stays the viewport's (tol), its left
 * edge is at least one padding left of the shifted eye. The arrow is visible, between the eye and the
 * viewport's edge, centred on the lens line, pointing left. At rest the arrow is entirely beyond the viewport's
 * right edge (pass 11: it slides in from there, no opacity fade) and the badge is the eye plus a padding each
 * side, flush with the edge: pass 9's rectangle.
 */
export function shift(s, { tol = 0.5, label = '' } = {}) {
  const offenders = [];
  const tag = label ? `${label} ` : '';
  const bad = (path, note, extra = {}) => offenders.push({ path: `${tag}${path}`, note, ...extra });
  const e = s?.engaged;
  const r = s?.rest;
  if (!s || !e || !e.open) return result([{ path: `${tag}.swm-corner .fp-scale`, note: 'the pager never engaged (data-open)' }], 0, 'not engaged');
  if (!r?.eye || !r?.tile) return result([{ path: `${tag}.swm-corner .fp-scale`, note: 'no rest geometry measured' }], 0, 'no rest');
  const taper = (d) => Math.pow(Math.min(1, Math.max(0, 1 - d / s.reach)), s.exp);
  const got = [];
  for (const c of e.circles ?? []) {
    if (!(c.d <= 2.001)) continue;
    const want = r.eye.cx + e.tx0 - s.S * taper(c.d);
    got.push(`d${fixed(c.d, 0)} ${fixed(r.eye.cx + e.tx0 - c.cx, 2)}`);
    if (!Number.isFinite(c.cx) || Math.abs(c.cx - want) > tol) bad(`circle ${c.name ?? `d=${c.d}`}`, `centre ${fixed(c.cx, 2)} is ${fixed(want - c.cx, 2)} px from ${fixed(want, 2)}: it should step left ${fixed(s.S * taper(c.d), 2)} px (${fixed(taper(c.d), 3)} of ${fixed(s.S, 2)})`);
  }
  if (!(e.circles ?? []).some((c) => c.d === 0)) bad('circle d=0', 'no lens circle measured');
  if (!(e.circles ?? []).some((c) => c.d === 1)) bad('circle d=1', 'no circle one station out measured');
  const right = e.tile.x + e.tile.w;
  if (!Number.isFinite(right) || Math.abs(s.vp.w - right) > tol) bad('badge', `right edge ${fixed(right, 2)} is ${fixed(s.vp.w - right, 2)} px from the viewport's ${fixed(s.vp.w, 2)}`);
  if (!(e.tile.x <= e.eye.x - r.pad + tol)) bad('badge', `left edge ${fixed(e.tile.x, 2)} is not a padding (${fixed(r.pad, 2)}) left of the shifted eye ${fixed(e.eye.x, 2)}`);
  const a = e.arrow;
  if (!a || !(a.w > 0 && a.h > 0)) bad('.fp-scale__pointer', 'the arrow has no box (not drawn)');
  else {
    if (!(a.opacity > 0.99)) bad('.fp-scale__pointer', `the arrow is at opacity ${fixed(a.opacity, 2)}, not shown`);
    if (a.dir !== 'left') bad('.fp-scale__pointer', `the arrow points ${a.dir ?? '?'}, not left`);
    if (!(a.x >= e.eye.x + e.eye.w - tol && a.x + a.w <= s.vp.w + tol)) bad('.fp-scale__pointer', `the arrow ${fixed(a.x, 1)}..${fixed(a.x + a.w, 1)} is not in the gap between the eye (right edge ${fixed(e.eye.x + e.eye.w, 1)}) and the viewport (${fixed(s.vp.w, 1)})`);
    if (Math.abs(a.y + a.h / 2 - e.lensCy) > 1) bad('.fp-scale__pointer', `the arrow's centre ${fixed(a.y + a.h / 2, 1)} is off the lens line ${fixed(e.lensCy, 1)}`);
  }
  // SQ-107 pass 11: at rest the arrow waits entirely beyond the viewport's right edge (opacity stays 1, no fade).
  if (!(r.arrow && r.arrow.x >= s.vp.w - tol)) bad('.fp-scale__pointer', `at rest the arrow is at x ${fixed(r.arrow?.x, 1)}, not entirely beyond the viewport's right edge (${fixed(s.vp.w, 1)})`);
  if (Math.abs(r.tile.w - (r.eye.w + 2 * r.pad)) > tol) bad('badge', `at rest it is ${fixed(r.tile.w, 2)} wide, not the eye ${fixed(r.eye.w, 2)} plus a padding each side (${fixed(r.eye.w + 2 * r.pad, 2)})`);
  if (Math.abs(s.vp.w - (r.tile.x + r.tile.w)) > tol) bad('badge', `at rest its right edge is ${fixed(s.vp.w - (r.tile.x + r.tile.w), 2)} px from the viewport's`);
  return result(offenders, (e.circles ?? []).length, `shift ${fixed(s.S, 2)} px, steps ${got.join(', ')}, badge ${fixed(r.tile.w, 1)} wide at rest, ${fixed(e.tile.w, 1)} engaged`);
}

/**
 * sequence — the engage and the release run as a CHOREOGRAPHY (SQ-107 pass 11, Nathan 11-17: the eye slides, THEN
 * grows, then the near circles (+-1) a beat later, then the far ones (+-2); the release backwards). `run` = {
 *   vp: {w}, S (the slide in px), step (the beat in ms, the dial's value),
 *   engage, release: [sample every 10 ms from the trigger, a SEEKED run (document.getAnimations()), never real time],
 *   taps: [{ at, samples }]    a release `at` ms into the engage, sampled from the release,
 *   settled: { a: {x}, h }     the engaged end state, read after every transition had finished,
 *   farShown                   false where the far ring (+-2) is never seen (above 768px): its own start is not checked
 * }, a sample = { t, ts, tg, tn, tf (the four registered progress numbers), h (the lens eye's height, px: its scale),
 *   n: {o, w, dist}, f: {o, w, dist} (the +-1 and +-2 circles' effective opacity, width and travel from the lens
 * circle's centre, px), a: {x, w, o} (the arrow's box and opacity) }.
 * A group's START is the first sample where its progress (its own measure, normalised between its first and last
 * value) is over 2 %. Engage: slide (ts), grow (h: the lift), +-1 (n.dist), +-2 (f.dist): in that order, the three after the
 * slide each at least step - 10 ms apart, the lift flat (0.5 px) until the slide has finished. Release: +-2, +-1,
 * the shrink, the slide back, the slide waiting for the shrink to end. The arrow waits beyond the right edge at rest,
 * is opaque wherever any of it shows, moves one way per phase and ends at its settled seat. A quick tap returns
 * everything to rest, starts moving at once, and no group stands waiting more than one step with nothing moving.
 */
const SEQ_START = 0.02;
export function sequence(run, { tol = 0.5, slack = 10 } = {}) {
  const offenders = [];
  const bad = (path, note, extra = {}) => offenders.push({ path, note, ...extra });
  const vpw = run?.vp?.w;
  const S = run?.S;
  const step = run?.step;
  const up = run?.engage ?? [];
  const down = run?.release ?? [];
  if (up.length < 20 || down.length < 20 || !Number.isFinite(S) || !Number.isFinite(step) || !Number.isFinite(vpw)) {
    return result([{ path: '.swm-corner .fp-scale', note: `too few samples measured (${up.length} engage, ${down.length} release)` }], up.length + down.length, 'no run');
  }
  const h0 = up[0].h;
  // SQ-116: a ring circle's start is its TRAVEL out from behind the lens circle (dist, px): its opacity is 1 from its
  // first frame and no longer ramps. A run without dist (older captures) reads opacity.
  const ringQ = (c) => (Number.isFinite(c?.dist) ? c.dist : c?.o);
  const quant = { s: (p) => p.ts, g: (p) => p.h, n: (p) => ringQ(p.n), f: (p) => ringQ(p.f) };
  const startOf = (series, k) => {
    const v0 = quant[k](series[0]);
    const v1 = quant[k](series[series.length - 1]);
    if (!Number.isFinite(v0) || !Number.isFinite(v1) || Math.abs(v1 - v0) < 1e-6) return null;
    for (const p of series) if ((quant[k](p) - v0) / (v1 - v0) > SEQ_START) return p.t;
    return null;
  };
  const startsOf = (series, order, phase) => {
    const st = {};
    for (const k of order) {
      st[k] = startOf(series, k);
      if (st[k] == null) bad(`group ${k}`, `${phase}: the ${GROUP_NAME[k]} never moved`);
    }
    return st;
  };
  const GROUP_NAME = { s: 'slide', g: 'grow', n: 'near circles (+-1)', f: 'far circles (+-2)' };
  const inOrder = (st, order, phase, first) => {
    if (order.some((k) => st[k] == null)) return;
    if (st[order[0]] > first) bad(`group ${order[0]}`, `${phase}: the ${GROUP_NAME[order[0]]} starts at ${st[order[0]]} ms, not at once (${first} ms)`);
    for (let i = 1; i < order.length; i++) {
      const a = order[i - 1];
      const b = order[i];
      const gap = st[b] - st[a];
      if (!(gap > 0)) bad(`group ${b}`, `${phase}: the ${GROUP_NAME[b]} starts at ${st[b]} ms, not after the ${GROUP_NAME[a]} (${st[a]} ms)`);
      // the beat sits between the eye's grow and the rings (grow, near, far; far, near, shrink): the slide's own
      // neighbour (it waits for the whole grow) is not a beat
      else if (a !== 's' && b !== 's' && gap < step - slack) bad(`group ${b}`, `${phase}: the ${GROUP_NAME[b]} starts ${gap} ms after the ${GROUP_NAME[a]}, want at least ${step - slack} (step ${step} - ${slack})`);
    }
  };
  // The far ring (+-2) is checked only where it is ever shown: above 768px one circle shows above the lens and one
  // below, so its opacity never moves and there is no start to find (run.farShown false).
  const farShown = run?.farShown !== false;
  const upOrder = farShown ? ['s', 'g', 'n', 'f'] : ['s', 'g', 'n'];
  const downOrder = farShown ? ['f', 'n', 'g', 's'] : ['n', 'g', 's'];
  const upStart = startsOf(up, upOrder, 'engage');
  inOrder(upStart, upOrder, 'engage', 20);
  const downStart = startsOf(down, downOrder, 'release');
  inOrder(downStart, downOrder, 'release', 20);
  for (const p of up) {
    if (S * (1 - p.ts) > tol && p.h - h0 > tol) {
      bad('.scheme-eye', `engage: at ${p.t} ms the lift is ${fixed(p.h - h0, 2)} px while the slide still has ${fixed(S * (1 - p.ts), 2)} px to go (the lift starts only when the slide has ended)`);
      break;
    }
  }
  for (const p of down) {
    if (p.h - h0 > tol && S * (1 - p.ts) > tol) {
      bad('.scheme-eye', `release: at ${p.t} ms the slide has begun back (${fixed(S * (1 - p.ts), 2)} px) while the eye is still ${fixed(p.h - h0, 2)} px grown (the slide back starts only when the shrink has ended)`);
      break;
    }
  }
  const arrow = (series, phase, dir) => {
    const first = series[0].a;
    const last = series[series.length - 1].a;
    let back = 0;
    for (let i = 1; i < series.length; i++) back = Math.max(back, -dir * (series[i].a.x - series[i - 1].a.x));
    if (back > 0.25) bad('.fp-scale__pointer', `${phase}: the arrow turned back (${fixed(back, 2)} px against its direction of travel)`);
    for (const p of series) {
      if (p.a.x < vpw - tol && !(p.a.o > 0.99)) {
        bad('.fp-scale__pointer', `${phase}: at ${p.t} ms the arrow shows (x ${fixed(p.a.x, 1)}) at opacity ${fixed(p.a.o, 2)}: it must be 1 wherever any of it is on screen`);
        break;
      }
    }
    return { first, last };
  };
  const ua = arrow(up, 'engage', -1);
  const da = arrow(down, 'release', 1);
  if (!(ua.first.x >= vpw - tol)) bad('.fp-scale__pointer', `at rest the arrow is at x ${fixed(ua.first.x, 1)}, not entirely beyond the viewport's right edge (${fixed(vpw, 1)})`);
  if (!(da.last.x >= vpw - tol)) bad('.fp-scale__pointer', `after the release the arrow is at x ${fixed(da.last.x, 1)}, not slid back out beyond the right edge (${fixed(vpw, 1)})`);
  if (!Number.isFinite(run?.settled?.a?.x) || Math.abs(ua.last.x - run.settled.a.x) > tol) bad('.fp-scale__pointer', `the engage ends the arrow at x ${fixed(ua.last.x, 2)}, ${fixed(ua.last.x - run?.settled?.a?.x, 2)} px from its settled seat ${fixed(run?.settled?.a?.x, 2)}`);
  if (!Number.isFinite(run?.settled?.h) || Math.abs(up[up.length - 1].h - run.settled.h) > tol) bad('.scheme-eye', `the engage ends the eye ${fixed(up[up.length - 1].h, 2)} px tall, settled ${fixed(run?.settled?.h, 2)}`);
  // the arrow stays centred on the lens line through the grow
  for (const p of up) {
    if (p.a.x < vpw - tol && Number.isFinite(p.ay) && Number.isFinite(p.ly) && Math.abs(p.ay - p.ly) > 1) {
      bad('.fp-scale__pointer', `engage: at ${p.t} ms the arrow's centre is ${fixed(p.ay - p.ly, 2)} px off the lens line`);
      break;
    }
  }
  const taps = run?.taps ?? [];
  if (!taps.length) bad('taps', 'no quick tap measured');
  const moved = (a, b) => Math.abs(a.ts - b.ts) + Math.abs(a.tg - b.tg) + Math.abs(a.tn - b.tn) + Math.abs(a.tf - b.tf) + Math.abs(a.a.x - b.a.x) / Math.max(1, S) > 1e-4;
  for (const tap of taps) {
    const s = tap.samples ?? [];
    const name = `quick tap (released at ${tap.at} ms)`;
    if (s.length < 20) {
      bad(name, `too few samples (${s.length})`);
      continue;
    }
    const e = s[s.length - 1];
    if (Math.max(e.ts, e.tg, e.tn, e.tf) > 0.002) bad(name, `did not return to rest (progress ${fixed(e.ts, 3)} / ${fixed(e.tg, 3)} / ${fixed(e.tn, 3)} / ${fixed(e.tf, 3)})`);
    if (!(e.a.x >= vpw - tol)) bad(name, `the arrow is at x ${fixed(e.a.x, 1)}, not back beyond the right edge`);
    if (e.h - h0 > tol) bad(name, `the eye is still ${fixed(e.h - h0, 2)} px grown`);
    // the intervals in which anything moved; a hold is a run of still intervals between two moving ones
    const mv = [];
    for (let i = 1; i < s.length; i++) mv.push(moved(s[i - 1], s[i]));
    const i0 = mv.indexOf(true);
    const i1 = mv.lastIndexOf(true);
    const first = i0 < 0 ? null : s[i0 + 1].t;
    let worstIdle = 0;
    for (let i = i0, run = 0; i0 >= 0 && i <= i1; i++) {
      run = mv[i] ? 0 : run + (s[i + 1].t - s[i].t);
      worstIdle = Math.max(worstIdle, run);
    }
    if (first == null) bad(name, 'nothing moved after the release');
    else if (first > 20) bad(name, `nothing moved until ${first} ms after the release (a group that has moved waited out a delay that belongs to a group that never started)`);
    if (worstIdle > step + slack) bad(name, `everything stood still ${worstIdle} ms mid-release (more than one step, ${step} ms)`);
  }
  return result(
    offenders,
    up.length + down.length + taps.reduce((n, t) => n + (t.samples?.length ?? 0), 0),
    `engage starts slide ${upStart.s} / grow ${upStart.g} / near ${upStart.n} / far ${farShown ? upStart.f : 'not shown'} ms, release starts far ${farShown ? downStart.f : 'not shown'} / near ${downStart.n} / shrink ${downStart.g} / slide back ${downStart.s} ms (step ${step}), arrow ${fixed(ua.first.x, 1)} -> ${fixed(ua.last.x, 1)}, ${taps.length} quick tap(s)`
  );
}

/** The strip panel each scheme paints (colorScheme.js SCHEMES: project is the glass, then black, then blue). */
const PANEL_OF = { project: 'glass', black: 'black', blue: 'blue' };

/**
 * fanout — every shown ring circle has a badge window of its own, and the ring fans out from behind the lens circle
 * (SQ-116, Nathan 11-17). `run` = {
 *   engage, release: [sample every 10 ms, SEEKED (see `sequence`)],  taps: [{ at, samples }],
 *   settled: the engaged end state (a sample),
 *   panels: [{ id, scheme, rgb }]   one pixel read inside each shown circle's window, off the circle, on a flat page
 * }, a sample = { t, h (the lens eye's height, px),
 *   lens: { w, cy, b: {x, y, w, h} } (the lens circle's width, centre y and badge window),
 *   ring: { u1, d1, u2, d2: { o, w, cx, cy, scheme, b: {x, y, w, h} } }   the circles one and two stations above and
 *   below: effective opacity, width, centre, scheme and the window of their own badge }.
 * A circle is SHOWN where it is at opacity over 0.05 once settled. Six checks:
 *  (a) settled, each shown circle's window exists, the circle sits inside it, and its width and height over the lens
 *      window's are within `ratio` (2 %, relative) of the circle's width over the lens circle's. Two stations out (u2,
 *      d2) the window reaches in to its inner neighbour's (Nathan 11-17, check (e)), so there the height held to the
 *      ratio is the OUTER half: from the circle's centre to the window's outer edge, over half the lens window's;
 *  (b) the pixel read inside each window is that circle's own scheme's panel (glass, black or blue);
 *  (c) through the engage and the release each shown circle is at its settled opacity from its first moving frame (a
 *      ramp is a fade), its centre stays between the lens circle's and its station (to `tol` px) and its distance
 *      from the lens moves one way (out in the engage, back in the release); a quick tap's release is held to the
 *      first two but not the direction;
 *  (d) before the grow starts (the eye still at its rest height) no shown circle that is visible (opacity over 0.01)
 *      lies outside the lens window;
 *  (e) THE SEAM (Nathan 11-17: "the eye badge farthest away from the currently selected also does not have a gap
 *      between it and the one next closest"): settled and on every engage and release frame, a shown two-out circle's
 *      window meets its inner neighbour's, u2's bottom edge on u1's top and d2's top on d1's bottom, with no gap
 *      over `tol` (an overlap is the clipped band, never painted twice);
 *  (f) STRAIGHT UP AND DOWN (Nathan 11-17: the ring eyes move "directly vertically upward and downward ... anchored
 *      to the center of the expanded central badge"): on every engage and release frame where any of a shown circle
 *      shows past the lens window's edge (over `tol`; inside the window the clip hides it), its centre's x is its
 *      settled x (to `tol`). Quick taps are not held to it (the slide back may start while a tapped ring is still on
 *      its way in).
 * A run that measured nothing fails.
 */
export function fanout(run, { ratio = 0.02, tol = 1, ids = ['u1', 'd1', 'u2', 'd2'] } = {}) {
  const offenders = [];
  const bad = (path, note) => offenders.push({ path, note });
  const up = run?.engage ?? [];
  const down = run?.release ?? [];
  const set = run?.settled;
  const shown = set?.lens ? ids.filter((id) => set.ring?.[id]?.o > 0.05) : [];
  if (!shown.length || up.length < 20 || down.length < 20) {
    return result([{ path: '.swm-corner .fp-scale__station', note: `no ring circle measured (${shown.length} shown, ${up.length} engage, ${down.length} release samples)` }], 0, 'no run');
  }
  let checks = 0;
  const name = (id) => `circle ${id}`;
  // the inner ring neighbour a two-out window reaches in to (e)
  const INNER = { u2: 'u1', d2: 'd1' };
  const gapOf = (id, ring) => {
    const b = ring?.[id]?.b;
    const n = ring?.[INNER[id]]?.b;
    if (!b || !n) return null;
    return id[0] === 'u' ? n.y - (b.y + b.h) : b.y - (n.y + n.h);
  };
  // (a)
  const lb = set.lens.b;
  for (const id of shown) {
    const c = set.ring[id];
    const b = c.b;
    checks++;
    if (!b || !(b.w > 0 && b.h > 0) || !lb) {
      bad(name(id), 'no badge window of its own');
      continue;
    }
    const cr = c.w / set.lens.w;
    const rw = b.w / lb.w / cr;
    const rh = b.h / lb.h / cr;
    if (Math.abs(rw - 1) > ratio) bad(name(id), `its window is ${fixed(b.w / lb.w, 3)} of the lens window wide, the circle is ${fixed(cr, 3)} of the lens circle (off by ${fixed((rw - 1) * 100, 1)} %)`);
    if (INNER[id]) {
      const outer = id[0] === 'u' ? c.cy - b.y : b.y + b.h - c.cy;
      const ro = outer / (lb.h / 2) / cr;
      if (Math.abs(ro - 1) > ratio) bad(name(id), `its window's outer half is ${fixed(outer / (lb.h / 2), 3)} of the lens window's half height, the circle is ${fixed(cr, 3)} of the lens circle (off by ${fixed((ro - 1) * 100, 1)} %)`);
    } else if (Math.abs(rh - 1) > ratio) bad(name(id), `its window is ${fixed(b.h / lb.h, 3)} of the lens window tall, the circle is ${fixed(cr, 3)} of the lens circle (off by ${fixed((rh - 1) * 100, 1)} %)`);
    if (!(c.cx >= b.x - tol && c.cx <= b.x + b.w + tol && c.cy >= b.y - tol && c.cy <= b.y + b.h + tol)) bad(name(id), `the circle's centre (${fixed(c.cx, 1)}, ${fixed(c.cy, 1)}) is outside its own window ${rectOf(b)}`);
  }
  // (b)
  for (const id of shown) {
    const c = set.ring[id];
    const p = (run.panels ?? []).find((x) => x.id === id);
    checks++;
    const got = stripClass(p?.rgb);
    if (got == null) bad(name(id), 'no pixel read inside its window');
    else if (got !== PANEL_OF[c.scheme]) bad(name(id), `the panel under its window is ${got}, a ${c.scheme} circle's is ${PANEL_OF[c.scheme] ?? '?'}`);
  }
  // (c) and (d)
  const rest = up[0].h;
  const through = (series, label, dir) => {
    for (const id of shown) {
      const target = set.ring[id].cy - set.lens.cy;
      let prev = null;
      let worse = 0;
      for (const p of series) {
        const c = p.ring?.[id];
        if (!c || !p.lens) {
          bad(name(id), `${label}: no measure at ${p.t} ms`);
          return;
        }
        checks++;
        const off = c.cy - p.lens.cy;
        const dist = Math.abs(off);
        if (dist > tol && Math.abs(c.o - set.ring[id].o) > 0.02) bad(name(id), `${label}: at ${p.t} ms it has moved ${fixed(dist, 1)} px at opacity ${fixed(c.o, 2)}, want its settled ${fixed(set.ring[id].o, 2)} (a fade, not a slide)`);
        if (off * target < -tol * Math.abs(target) || dist > Math.abs(target) + tol) bad(name(id), `${label}: at ${p.t} ms its centre is ${fixed(off, 1)} px from the lens circle's, not between it and its station (${fixed(target, 1)} px)`);
        if (dir && prev != null) worse = Math.max(worse, -dir * (dist - prev));
        prev = dist;
        // (d) before the grow starts
        if (p.h - rest <= 0.5 && c.o > 0.01 && p.lens.b) {
          const r = p.lens.b;
          const half = c.w / 2;
          if (c.cx - half < r.x - tol || c.cx + half > r.x + r.w + tol || c.cy - half < r.y - tol || c.cy + half > r.y + r.h + tol) bad(name(id), `${label}: at ${p.t} ms (the grow not started) the circle shows outside the lens window ${rectOf(r)}, at (${fixed(c.cx, 1)}, ${fixed(c.cy, 1)})`);
        }
      }
      if (worse > 0.25) bad(name(id), `${label}: its distance from the lens circle turned back by ${fixed(worse, 2)} px (it must only go ${dir > 0 ? 'out' : 'in'})`);
    }
  };
  through(up, 'engage', 1);
  through(down, 'release', -1);
  for (const tap of run.taps ?? []) through(tap.samples ?? [], `quick tap (released at ${tap.at} ms)`, 0);
  // (e) the seam, settled and through the engage and the release
  const seamed = shown.filter((id) => INNER[id] && shown.includes(INNER[id]));
  for (const id of seamed) {
    checks++;
    const g = gapOf(id, set.ring);
    if (g == null) bad(name(id), `settled: no window to meet circle ${INNER[id]}'s`);
    else if (g > tol) bad(name(id), `settled: a gap of ${fixed(g, 1)} px between its window and circle ${INNER[id]}'s`);
    for (const [label, series] of [['engage', up], ['release', down]]) {
      let worst = null;
      for (const p of series) {
        const gp = gapOf(id, p.ring);
        if (gp == null) continue;
        checks++;
        if (gp > tol && (worst == null || gp > worst.g)) worst = { g: gp, t: p.t };
      }
      if (worst) bad(name(id), `${label}: a gap of ${fixed(worst.g, 1)} px between its window and circle ${INNER[id]}'s at ${worst.t} ms (the worst frame)`);
    }
  }
  // (f) straight up and down, through the engage and the release
  for (const id of shown) {
    const x0 = set.ring[id].cx;
    for (const [label, series] of [['engage', up], ['release', down]]) {
      let worst = null;
      for (const p of series) {
        const c = p.ring?.[id];
        const lw = p.lens?.b;
        if (!c || !lw || (c.cy - c.w / 2 >= lw.y - tol && c.cy + c.w / 2 <= lw.y + lw.h + tol)) continue;
        checks++;
        const dx = c.cx - x0;
        if (Math.abs(dx) > tol && (worst == null || Math.abs(dx) > Math.abs(worst.dx))) worst = { dx, t: p.t, dy: c.cy - p.lens.cy };
      }
      if (worst) bad(name(id), `${label}: at ${worst.t} ms, ${fixed(worst.dy, 1)} px off the lens line, its centre is ${fixed(worst.dx, 1)} px sideways of its settled x (a slide on a slant, not straight up or down)`);
    }
  }
  return result(offenders, checks, `${shown.join(', ')} each in a window of its own, panels ${(run.panels ?? []).map((p) => `${p.id} ${stripClass(p.rgb)}`).join(', ')}${seamed.length ? `, seams ${seamed.map((id) => `${id}/${INNER[id]} ${fixed(gapOf(id, set.ring), 1)} px`).join(', ')}` : ''}, ${checks} checks across the engage, release and quick taps`);
}

/**
 * lids — the lids cover the iris (SQ-107 pass 11, Nathan 11-17: "scale up the outer eye shape just slightly so that
 * there is no upper and lower portion of the globe stroke peeking out past the outer eye shape"). `run.cases` =
 * [{ name, leak, circle, lid }]: per scheme, width and state (rest, engaged), `leak` the pixels of the iris or lens
 * circle that lie outside the lids' outer outline (a flood fill from the border over what is not lid, shrunk a device
 * pixel off the stroke), `circle` the pixels the circle painted at all, `lid` the pixels of lid stroke. Zero is the
 * bar; a case that saw no circle or no lid measured nothing and fails.
 */
export function lids(run, { max = 0, minCircle = 100, minLid = 50 } = {}) {
  const cases = run?.cases ?? [];
  const offenders = [];
  for (const c of cases) {
    if (!(c.circle >= minCircle) || !(c.lid >= minLid)) offenders.push({ path: c.name, note: `measured nothing (circle ${c.circle} px, lid ${c.lid} px)` });
    else if (c.leak > max) offenders.push({ path: c.name, note: `${c.leak} px of the circle lie outside the lids' outer outline (of ${c.circle})` });
  }
  return result(offenders, cases.length, `${cases.length} case(s), worst leak ${cases.reduce((m, c) => Math.max(m, c.leak ?? 0), 0)} px`);
}

/** Short one-line text of an offender, for the probe's report. */
export function describeOffender(o) {
  const { path, selector, slug, family, ...rest } = o;
  const head = path ?? selector ?? slug ?? family ?? '';
  return `${head} ${Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')}`.trim();
}
