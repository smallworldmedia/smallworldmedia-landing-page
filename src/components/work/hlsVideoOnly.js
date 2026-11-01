/**
 * hlsVideoOnly — the muted surfaces' audio strip (useHls's `videoOnly`;
 * Nathan, 10-09: "disable the audio download anywhere other than the
 * lightbox"). Pure and import-free, so the tests load it as is.
 */

/** The audio codec families this pattern names in a CODECS entry: AAC (mp4a),
 *  AC-3, E-AC-3, AC-4, Opus, FLAC, MP3, ALAC, DTS (dtsc, dtse, dtsh, dtsl, dtsx,
 *  dts+, dts-), MPEG-H (mha1, mha2, mhm1, mhm2), Dolby TrueHD (mlpa) and
 *  encrypted audio (enca). Not every family a CODECS entry could name; Mux
 *  emits mp4a only, so the rest is margin. The video families (avc1, hvc1,
 *  av01, vp09, …) never match. */
export const AUDIO_CODEC = /^(mp4a|ac-3|ec-3|ac-4|opus|flac|mp3|alac|dts[a-z+-]|mha[12]|mhm[12]|mlpa|enca)(\.|$)/i;

function attrList(s) {
  // KEY=value pairs; a quoted value keeps its quotes and its inner commas
  return [...s.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)].map((m) => [m[1], m[2]]);
}

/**
 * ── videoOnly: strip the audio rendition out of the master playlist ──
 * Mux HLS is demuxed: the master of an asset with sound declares one
 * #EXT-X-MEDIA TYPE=AUDIO group and every variant points at it with
 * AUDIO="..." (a silent asset's master has none). hls.js loads that group
 * even into a muted <video>, and Mux has no playback modifier that drops it.
 * So for muted surfaces useHls's playlist loader rewrites ONLY the master
 * (context.type === 'manifest'): the TYPE=AUDIO lines go, the AUDIO="..."
 * attribute goes wherever it sits, and the audio codec leaves CODECS so the
 * level hls.js builds is video-only and self-consistent. hls.js then never
 * requests the audio playlist, init or segments, and creates no audio
 * SourceBuffer.
 *  - A master with no TYPE=AUDIO line is returned untouched (same string).
 *  - A TYPE=AUDIO rendition with no URI is muxed into the variant streams, not
 *    a separate rendition: the original master is used, because dropping its
 *    codec would mis-declare the SourceBuffer.
 *  - A variant that would be left with no codec at all (an audio-only asset)
 *    aborts the rewrite and the original master is used.
 *  - Variants without an AUDIO="..." reference keep their CODECS as is: any
 *    audio codec there is muxed into the video segments, not a separate
 *    rendition, and dropping it would mis-declare the SourceBuffer.
 *  - Line endings are kept, CRLF included.
 *  - useHls's native-HLS fallback (attachNative) cannot be rewritten; it still
 *    fetches audio (see useHls.js).
 */
export function stripAudioFromMaster(text) {
  if (!text.includes('TYPE=AUDIO')) return text;
  const out = [];
  let changed = false;
  for (const raw of text.split('\n')) {
    const cr = raw.endsWith('\r') ? '\r' : '';
    const line = cr ? raw.slice(0, -1) : raw;
    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = attrList(line.slice(13));
      const type = attrs.find(([k]) => k === 'TYPE');
      if (type && type[1] === 'AUDIO') {
        if (!attrs.some(([k]) => k === 'URI')) return text; // muxed audio: leave the master alone
        changed = true;
        continue;
      }
    } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = attrList(line.slice(18));
      if (attrs.some(([k]) => k === 'AUDIO')) {
        const kept = [];
        for (const [k, v] of attrs) {
          if (k === 'AUDIO') continue;
          if (k === 'CODECS') {
            const video = v.replace(/^"|"$/g, '').split(',').map((c) => c.trim())
              .filter((c) => c && !AUDIO_CODEC.test(c));
            if (!video.length) return text; // audio-only asset: leave the master alone
            kept.push([k, `"${video.join(',')}"`]);
          } else {
            kept.push([k, v]);
          }
        }
        out.push(`#EXT-X-STREAM-INF:${kept.map(([k, v]) => `${k}=${v}`).join(',')}${cr}`);
        changed = true;
        continue;
      }
    }
    out.push(raw);
  }
  return changed ? out.join('\n') : text;
}
