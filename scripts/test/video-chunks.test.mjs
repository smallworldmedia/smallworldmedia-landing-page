// Video chunks (11-05): a video flagged splitIntoThirds splits into three adjacent,
// non-overlapping ranges, each clipped at the source (muxStream start + end).
//   node --test scripts/test/video-chunks.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { muxStream, muxPoster, chunkRanges, chunkWindow, windowLoop, CHUNK_COUNT, MUX_SEGMENT_SECONDS } from '../../src/components/work/imageConfig.js'
import { buildContentFlow, expandChunks } from '../../src/components/work/detail/buildContentFlow.js'

const D = 46.722633 // the Bedouin Knockdown Center promo's Mux duration
const video = (id, extra = {}) => ({ _id: id, title: id, mediaType: 'motion_9x16', playbackId: `pb-${id}`, videoDuration: D, ...extra })

test('muxStream: a start adds asset_start_time, the end stays last and once; no start is the old URL', () => {
  assert.equal(muxStream('abc', 15), 'https://stream.mux.com/abc.m3u8?asset_end_time=15')
  assert.equal(muxStream('abc', 5, 'min_resolution=270p'), 'https://stream.mux.com/abc.m3u8?min_resolution=270p&asset_end_time=5')
  assert.equal(muxStream('abc', 31.148, '', 15.574), 'https://stream.mux.com/abc.m3u8?asset_start_time=15.574&asset_end_time=31.148')
  assert.equal(muxStream('abc', 31.148, 'min_resolution=270p', 15.574), 'https://stream.mux.com/abc.m3u8?min_resolution=270p&asset_start_time=15.574&asset_end_time=31.148')
  assert.equal(muxPoster('abc', 700), 'https://image.mux.com/abc/thumbnail.webp?width=700&fit_mode=preserve&time=0')
  assert.equal(muxPoster('abc', 700, 15.574), 'https://image.mux.com/abc/thumbnail.webp?width=700&fit_mode=preserve&time=15.574')
})

test('chunkRanges: equal thirds that touch, never overlap, and cover [0, duration]', () => {
  for (const d of [D, 30, 20.033333, 7, 225.5]) {
    const r = chunkRanges(d)
    assert.equal(r.length, CHUNK_COUNT)
    assert.equal(r[0].start, 0)
    assert.equal(r.at(-1).end, d)
    r.forEach((c, k) => {
      assert.ok(c.end > c.start)
      if (k) assert.equal(c.start, r[k - 1].end, 'each chunk starts exactly where the last ends')
      assert.ok(Math.abs(c.end - c.start - d / 3) < 0.002, 'equal to the ms')
    })
  }
  assert.deepEqual(chunkRanges(30), [{ start: 0, end: 10 }, { start: 10, end: 20 }, { start: 20, end: 30 }])
})

test('chunkRanges: no duration, no split', () => {
  for (const d of [undefined, null, 0, -1, NaN, 'x']) assert.equal(chunkRanges(d), null)
})

test('chunkWindow: the stream starts at the segment boundary at or before the start', () => {
  assert.equal(MUX_SEGMENT_SECONDS, 5)
  const [a, b, c] = chunkRanges(D).map(chunkWindow)
  // measured 11-05: asset_start_time=15.574 begins at segment 3 (15 s), 31.148 at segment 6 (30 s)
  assert.deepEqual(a, { from: 0, to: 15.574 })
  assert.ok(Math.abs(b.from - 0.574) < 1e-9 && Math.abs(b.to - 16.148) < 1e-9)
  assert.ok(Math.abs(c.from - 1.148) < 1e-9 && Math.abs(c.to - 16.722633) < 1e-9)
  // on the asset's own clock the window is the chunk's range, whatever the segment offset
  chunkRanges(D).forEach((r, k) => {
    const base = Math.floor(r.start / 5) * 5
    const w = [a, b, c][k]
    assert.ok(Math.abs(base + w.from - r.start) < 1e-9 && Math.abs(base + w.to - r.end) < 1e-9)
  })
})

test('windowLoop: wraps to `from`, not to the stream start; seeks to `from` on metadata only when behind it', () => {
  const h = windowLoop(1.148, 16.723)
  const v = { currentTime: 16.8, play: () => Promise.resolve() }
  h.onTimeUpdate({ currentTarget: v })
  assert.equal(v.currentTime, 1.148)
  v.currentTime = 10
  h.onTimeUpdate({ currentTarget: v })
  assert.equal(v.currentTime, 10)
  v.currentTime = 0
  h.onLoadedMetadata({ currentTarget: v })
  assert.equal(v.currentTime, 1.148)
  v.currentTime = 1.148
  v.currentTime = 1.2
  h.onLoadedMetadata({ currentTarget: v })
  assert.equal(v.currentTime, 1.2)
  v.currentTime = 20
  h.onEnded({ currentTarget: v })
  assert.equal(v.currentTime, 1.148)
  const first = windowLoop(0, 15.574)
  v.currentTime = 0
  first.onLoadedMetadata({ currentTarget: v })
  assert.equal(v.currentTime, 0)
})

test('expandChunks: a flagged video becomes three tiles in place; unflagged, durationless and stills pass through', () => {
  const still = { _id: 's1', mediaType: 'static_1x1', imageUrl: 'x' }
  const plain = video('plain')
  const flagged = video('flagged', { splitIntoThirds: true, description: 'a caption' })
  const noDuration = video('nodur', { splitIntoThirds: true, videoDuration: null })
  const out = expandChunks([still, flagged, plain, noDuration])
  assert.deepEqual(out.map((a) => a._id), ['s1', 'flagged~1of3', 'flagged~2of3', 'flagged~3of3', 'plain', 'nodur'])
  assert.deepEqual(out.filter((a) => a.chunk).map((a) => [a.chunk.start, a.chunk.end]), chunkRanges(D).map((r) => [r.start, r.end]))
  assert.deepEqual(out.filter((a) => a.chunk).map((a) => a.description), ['a caption', undefined, undefined])
  assert.equal(out.find((a) => a._id === 'plain').chunk, undefined)
  assert.equal(expandChunks([plain, still]).length, 2, 'flag missing: the list is as it was')
})

test('expandChunks: the ?chunks override names an asset by id or slug tail; ?chunkgap spreads the chunks', () => {
  const a = video('mediaAsset-bedouin-brooklyn-knockdown-center-promo')
  const b = video('mediaAsset-bedouin-other')
  const c = video('mediaAsset-bedouin-third')
  for (const want of ['mediaAsset-bedouin-brooklyn-knockdown-center-promo', 'bedouin-brooklyn-knockdown-center-promo', 'brooklyn-knockdown-center-promo', 'knockdown-center-promo']) {
    assert.equal(expandChunks([a, b], { only: [want] }).length, 4, want)
  }
  assert.equal(expandChunks([a, b], { only: ['nope'] }).length, 2)
  assert.equal(expandChunks([a, b], { only: ['center-promo'] }).length, 4)
  const ids = (l) => l.map((x) => (x.chunk ? `${x.chunk.index + 1}` : x._id.slice(-5)))
  assert.deepEqual(ids(expandChunks([a, b, c], { only: ['promo'], gap: 1 })), ['1', 'other', '2', 'third', '3'])
  assert.deepEqual(ids(expandChunks([a, b, c], { only: ['promo'], gap: 0 })), ['1', '2', '3', 'other', 'third'])
  assert.deepEqual(ids(expandChunks([a], { only: ['promo'], gap: 2 })), ['1', '2', '3'], 'a short list: chunks bunch at the end')
})

test('buildContentFlow: chunks land in showcase; the hero is never split; other lanes ignore the flag', () => {
  const hero = video('hero', { splitIntoThirds: true })
  const flagged = video('flagged', { splitIntoThirds: true })
  const roleVideo = video('role', { splitIntoThirds: true, contentRole: 'process' })
  const flow = buildContentFlow([hero, flagged, roleVideo])
  assert.deepEqual(flow.showcase.map((a) => a._id), ['flagged~1of3', 'flagged~2of3', 'flagged~3of3'])
  assert.deepEqual(flow.bts.map((a) => a._id), ['role'])
  assert.equal(buildContentFlow([hero, video('x')]).showcase.length, 1, 'no flag, no split')
  assert.equal(buildContentFlow([hero, video('x')], { chunks: { only: ['x'] } }).showcase.length, 3)
})
