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
 * centre is `rowCy` above the viewport's bottom on EVERY route: the height of the bottom-left corner
 * row (the privacy pill's line at rest). A run that measured no row fails.
 */
export function badge(rect, vp, { tol = 0.5, eye = null, rowCy = null } = {}) {
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
  if (!Number.isFinite(rowCy)) bad('no corner row measured to seat against');
  else {
    const cy = vp.h - (rect.y + rect.h / 2);
    if (Math.abs(cy - rowCy) > 1) bad(`centre ${fixed(cy, 1)} above the bottom is not the corner row's ${fixed(rowCy, 1)}`);
  }
  return result(offenders, 1, `seated: tile ${rectOf(rect)} in ${vp.w}x${vp.h}, row centre ${Number.isFinite(rowCy) ? fixed(rowCy, 1) : '?'} above the bottom`);
}

/**
 * seat — the badge's gap above the viewport's bottom edge is the SAME everywhere (SQ-107 pass 7: one seat,
 * sitewide). `samples` = [{ label, gap }], one per route, width, scroll stop (footer at rest and at its
 * end state): gap = viewport height minus the tile's bottom edge, CSS px. All within `tol` of one another
 * (0.5). A missing gap, or fewer than two samples, fails: one measurement compares to nothing.
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
 */
export function strip(frames, { order = STRIP_ORDER, tol = 2 } = {}) {
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
    const whole = frac < 0.02 || frac > 0.98;
    const topIdx = whole && frac > 0.98 ? Math.floor(f.q) + 1 : Math.floor(f.q);
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
    const want = (1 - frac) * rows;
    if (Math.abs(seam - want) > Math.max(tol, 0.04 * rows)) offenders.push({ path, note: `seam at row ${seam} of ${rows}, want ${fixed(want, 1)} ((1 - ${fixed(frac, 2)}) x the height)` });
  }
  return result(offenders, list.length, `${list.length} frames, one detent = one badge height`);
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

/** Short one-line text of an offender, for the probe's report. */
export function describeOffender(o) {
  const { path, selector, slug, family, ...rest } = o;
  const head = path ?? selector ?? slug ?? family ?? '';
  return `${head} ${Object.entries(rest).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ')}`.trim();
}
