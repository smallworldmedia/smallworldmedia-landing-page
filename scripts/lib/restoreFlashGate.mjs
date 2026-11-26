/**
 * restoreFlashGate — the /work return-restore's first frame (SQ-131).
 *
 * Nathan 11-20 (iPhone, row 130): Back from a project to /work "briefly shows
 * the first project begin to populate (coco) and then proceeds to load the
 * correct last fp card". The probe (scripts/history-probe.mjs, scenarios RF/RFW)
 * samples every frame from the Back until the restored card is up, plus every
 * request, and this gate judges them — kept pure so scripts/test runs it offline.
 *
 * Record: {
 *   expect: client name of the World that must be the first card shown,
 *   forbid: client name that must never show (the first World on a return to
 *           another; null when the expected World IS the first),
 *   frames: [{ cards: [client names visible that frame], covered?: bool }],
 *           (covered = the RouteFill passage cover fully up: nothing under it shows),
 *   requests: [url],
 *   forbidTokens: [media ids (Mux playback ids, Sanity asset hashes) of the
 *                  forbidden World only],
 * }
 */

// Mux playback ids and Sanity image-asset hashes, the strings a World's
// media requests carry. Walks any (deserialized) World object.
export function mediaTokens(world) {
  const out = new Set();
  const walk = (v, key) => {
    if (Array.isArray(v)) return v.forEach((x) => walk(x, key));
    if (v && typeof v === 'object') return Object.entries(v).forEach(([k, x]) => walk(x, k));
    if (typeof v !== 'string') return;
    if (key === 'playbackId' && v.length >= 10) out.add(v);
    const m = v.match(/cdn\.sanity\.io\/(?:images|files)\/[^/]+\/[^/]+\/([0-9a-f]{20,})/);
    if (m) out.add(m[1]);
  };
  walk(world);
  return [...out];
}

// Astro's island props serialization: every value is [type, value]; type 0 =
// plain (objects recurse per key), 1 = an array of [type, value] entries.
export function astroProps(v) {
  if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number') {
    if (v && typeof v === 'object' && !Array.isArray(v))
      return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, astroProps(x)]));
    return v;
  }
  const [t, val] = v;
  if (t === 1) return val.map(astroProps);
  if (t === 0 && val && typeof val === 'object') return astroProps(val);
  return val;
}

export function restoreFlashVerdict(rec) {
  const fails = [];
  const frames = (rec.frames ?? []).map((f) => (f.covered ? { ...f, cards: [] } : f));
  const shown = frames.filter((f) => f.cards?.length);
  if (!shown.length) fails.push(`no frame showed a card (expected ${rec.expect})`);
  else if (!shown[0].cards.includes(rec.expect))
    fails.push(`first card shown ${shown[0].cards.join('+')}, expected ${rec.expect}`);
  if (rec.forbid && rec.forbid !== rec.expect) {
    const bad = frames.filter((f) => f.cards?.includes(rec.forbid)).length;
    if (bad) fails.push(`${bad} frame(s) showed ${rec.forbid}`);
    const tokens = (rec.forbidTokens ?? []).filter(Boolean);
    const hits = (rec.requests ?? []).filter((u) => tokens.some((t) => u.includes(t)));
    if (hits.length) fails.push(`${hits.length} ${rec.forbid} media request(s): ${hits[0]}`);
  }
  return { pass: fails.length === 0, fails };
}
