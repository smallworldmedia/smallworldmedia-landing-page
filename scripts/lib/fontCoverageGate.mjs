/**
 * fontCoverageGate — does a font subset still hold every codepoint the site can render in it?
 *
 * Pure pieces, so the test and a probe share one definition:
 *   - missingCodepoints(have, required) — the required codepoints a font's cmap lacks;
 *   - rangesToCodepoints(ranges) — [[lo, hi], …] to a flat list;
 *   - nonAsciiCodepoints(text) — every non-ASCII codepoint in a string (the dist/src scan);
 *   - woff2Cmap(buffer) — a woff2 file's cmap as a Set of codepoints, in node alone (a woff2
 *     keeps cmap untransformed inside one brotli stream, so no fontTools is needed).
 *
 * SQ-148 (US-13 piece A): the Iosevka Term face the site ships is a subset of the full 1.5 MB file.
 * REQUIRED below is what the subset must keep: whole blocks the full font carries without a hole,
 * plus every non-ASCII glyph found in the built HTML and in the mono-styled src literals on
 * 11-24. A glyph outside the subset does not break a page (--font-mono falls through to Geist
 * Mono), but it changes the face, so a new character that lands in mono text belongs here and in
 * the subset together.
 */
import zlib from 'node:zlib';

/** Blocks the full Iosevka Term has with no hole (checked against its cmap on 11-24). */
export const REQUIRED_RANGES = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1 Supplement
  [0x0100, 0x017f], // Latin Extended-A
  [0x0180, 0x024f], // Latin Extended-B (names with ơ, ǎ, ș …)
  [0x0300, 0x036f], // Combining Diacritical Marks (NFD accents)
  [0x1e00, 0x1eff], // Latin Extended Additional (Vietnamese)
  [0x2190, 0x21ff], // Arrows
  [0x2200, 0x22ff], // Mathematical Operators
];

/** The one-off glyphs the site renders in mono text: the HTML and src literals of 11-24. */
export const REQUIRED_CODEPOINTS = [
  0x200b, // zero width space
  0x2013, 0x2014, // en and em dash
  0x2018, 0x2019, 0x201c, 0x201d, // curly quotes
  0x2022, // bullet
  0x2026, // ellipsis
  0x2055, // ⁕ flower punctuation
  0x2122, // ™
  0x2080, // ₀
  0x2301, 0x230a, 0x230b, 0x2316, 0x23ed, // ⌁ ⌊ ⌋ ⌖ ⏭
  0x2500, 0x2502, 0x250c, 0x2510, 0x2514, 0x2518, 0x251c, 0x2524, 0x252c, 0x2534, // box drawing
  0x2588, 0x2591, 0x2592, 0x2593, // block elements
  0x25b6, 0x25cf, // ▶ ●
  0x2661, 0x26a0, 0x2713, 0x2733, 0x2b50, // ♡ ⚠ ✓ ✳ ⭐
  0x0394, 0x03a3, 0x03b4, 0x03b5, 0x03b8, 0x03bb, 0x03c0, 0x03c4, 0x03c6, 0x03c9, // Δ Σ δ ε θ λ π τ φ ω
];

export function rangesToCodepoints(ranges) {
  const out = [];
  for (const [lo, hi] of ranges) for (let cp = lo; cp <= hi; cp++) out.push(cp);
  return out;
}

/** Every codepoint the subset must keep, ascending and unique. */
export function requiredCodepoints() {
  return [...new Set([...rangesToCodepoints(REQUIRED_RANGES), ...REQUIRED_CODEPOINTS])].sort(
    (a, b) => a - b,
  );
}

/** The required codepoints `have` (a Set or array of codepoints) does not contain, ascending. */
export function missingCodepoints(have, required) {
  const set = have instanceof Set ? have : new Set(have);
  return [...new Set(required)].filter((cp) => !set.has(cp)).sort((a, b) => a - b);
}

/** Every non-ASCII codepoint in a string, ascending and unique. */
export function nonAsciiCodepoints(text) {
  const seen = new Set();
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp > 0x7f) seen.add(cp);
  }
  return [...seen].sort((a, b) => a - b);
}

export const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`;

// --- woff2 cmap reader -------------------------------------------------------------------

// The 63 table tags a woff2 directory can name by index (W3C WOFF2 §5.1).
const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca',
  'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea',
  'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat',
  'Gloc', 'Feat', 'Sill',
];

function readBase128(buf, pos) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[pos + i];
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return [value, pos + i + 1];
  }
  throw new Error('woff2: bad UIntBase128');
}

/** The cmap table bytes of a woff2 file. */
function woff2CmapTable(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a woff2 file');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  let pos = 48;
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos++];
    const idx = flags & 0x3f;
    let tag;
    if (idx === 63) {
      tag = buf.toString('latin1', pos, pos + 4);
      pos += 4;
    } else tag = KNOWN_TAGS[idx];
    const transformVersion = flags >> 6;
    let origLength;
    [origLength, pos] = readBase128(buf, pos);
    // glyf and loca are transformed at version 0; every other table is transformed above 0.
    const transformed = tag === 'glyf' || tag === 'loca' ? transformVersion === 0 : transformVersion !== 0;
    let length = origLength;
    if (transformed) [length, pos] = readBase128(buf, pos);
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(pos, pos + compressedSize));
  let offset = 0;
  for (const t of tables) {
    if (t.tag === 'cmap') return data.subarray(offset, offset + t.length);
    offset += t.length;
  }
  throw new Error('woff2: no cmap table');
}

function addFormat4(table, out) {
  const segCount = table.readUInt16BE(6) / 2;
  const end = 14;
  const start = end + segCount * 2 + 2;
  const delta = start + segCount * 2;
  const rangeOffset = delta + segCount * 2;
  for (let s = 0; s < segCount; s++) {
    const lo = table.readUInt16BE(start + s * 2);
    const hi = table.readUInt16BE(end + s * 2);
    const d = table.readInt16BE(delta + s * 2);
    const ro = table.readUInt16BE(rangeOffset + s * 2);
    for (let cp = lo; cp <= hi && cp < 0xffff; cp++) {
      let glyph;
      if (ro === 0) glyph = (cp + d) & 0xffff;
      else {
        const at = rangeOffset + s * 2 + ro + (cp - lo) * 2;
        glyph = at + 2 <= table.length ? table.readUInt16BE(at) : 0;
        if (glyph) glyph = (glyph + d) & 0xffff;
      }
      if (glyph) out.add(cp);
    }
  }
}

function addFormat12(table, out) {
  const groups = table.readUInt32BE(12);
  for (let g = 0; g < groups; g++) {
    const at = 16 + g * 12;
    const lo = table.readUInt32BE(at);
    const hi = table.readUInt32BE(at + 4);
    const startGlyph = table.readUInt32BE(at + 8);
    for (let cp = lo; cp <= hi; cp++) if (startGlyph + (cp - lo) > 0) out.add(cp);
  }
}

/** A woff2 buffer's Unicode cmap (format 4 and 12 subtables, unioned) as a Set of codepoints. */
export function woff2Cmap(buf) {
  const cmap = woff2CmapTable(buf);
  const out = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const isUnicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!isUnicode) continue;
    const table = cmap.subarray(cmap.readUInt32BE(8 + i * 8));
    const format = table.readUInt16BE(0);
    if (format === 4) addFormat4(table, out);
    else if (format === 12) addFormat12(table, out);
  }
  return out;
}
