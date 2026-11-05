// The Project Directory's data: tiles (grouping, links, order, fit), the
// filter and its URL state, Client Coverage and the Client Roster, the
// images' sizes; and the player gate.
//   node --test scripts/test/directory.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDirectoryTiles,
  orderTiles,
  matchesFilter,
  tagPresence,
  fitOf,
  readFilter,
  filterSearch,
  sanitizeFilter,
  defaultFilter,
  hasFilterParams,
  sameFilter,
  sizesFor,
} from '../../src/components/work/directory/buildDirectoryTiles.js'
import { SSR_TUNE, readTune } from '../../src/components/work/directory/directoryTune.js'
import { coverageOf, toDrawerRoster } from '../../src/lib/clientCoverage.js'
import { createPlayerGate } from '../../src/components/work/directory/playerGate.js'

const img = (w, h, extra = {}) => ({
  imageUrl: `https://cdn.example.invalid/${w}x${h}.jpg`,
  imageDimensions: { width: w, height: h },
  ...extra,
})
const tag = (...slugs) => slugs.map((slug) => ({ name: slug, slug }))
let rank = 0
const asset = (id, client, fields = {}) => ({
  _id: id,
  title: id,
  mediaType: 'static_other',
  clientSlug: client,
  orderRank: `0|${String(rank++).padStart(6, '0')}:`,
  services: tag('branding'),
  ...img(1000, 1000),
  ...fields,
})
const CLIENTS = [
  { name: 'Bellaire', slug: 'bellaire', umbrellas: null },
  { name: 'DJ Tennis', slug: 'dj-tennis', umbrellas: null },
  { name: 'Munchietown', slug: 'munchietown', umbrellas: ['dj-tennis'] },
  { name: 'Annabel Englund', slug: 'annabel-englund', umbrellas: null },
  { name: 'COCO', slug: 'coco', umbrellas: null },
]
const WORLDS = [
  { projectId: 'p-munchie', slug: 'munchietown', title: 'Munchietown', collection: 'Munchietown', clientSlug: 'munchietown' },
  { projectId: 'p-coco', slug: 'coco-branding-2026', title: 'COCO Branding 2026', collection: 'COCO Branding 2026', clientSlug: 'coco' },
  // no collection: no detail page, so no links
  { projectId: 'p-orphan', slug: null, title: 'Orphan', collection: null, clientSlug: 'bellaire' },
]

function fixture() {
  rank = 0
  return [
    // featured, World 2 (COCO) — listed first to prove the World order wins
    asset('coco-1', 'coco', { projectId: 'p-coco', services: tag('branding', 'album-art') }),
    asset('coco-deck-2', 'coco', { projectId: 'p-coco', mediaType: 'brand-deck', displayGroup: 'brand-guidelines-deck', brandDeckOrder: 2, services: tag('web-design') }),
    asset('coco-deck-1', 'coco', { projectId: 'p-coco', mediaType: 'brand-deck', displayGroup: 'brand-guidelines-deck', brandDeckOrder: 1 }),
    asset('coco-bts', 'coco', { projectId: 'p-coco', contentRole: 'process' }),
    // featured, World 1 (Munchietown)
    asset('munchie-1', 'munchietown', { projectId: 'p-munchie' }),
    asset('munchie-deck-1', 'munchietown', { projectId: 'p-munchie', mediaType: 'brand-deck', displayGroup: 'brand-guidelines-deck', brandDeckOrder: 1 }),
    asset('munchie-seq-1', 'munchietown', { projectId: 'p-munchie', displayGroup: 'logo-sequence', ...img(2000, 1000) }),
    asset('munchie-solo-seq', 'munchietown', { projectId: 'p-munchie', displayGroup: 'solo-sequence' }),
    asset('munchie-seq-2', 'munchietown', { projectId: 'p-munchie', displayGroup: 'logo-sequence', ...img(2000, 1000) }),
    // not featured
    asset('bellaire-loose', 'bellaire'),
    asset('bellaire-orphan', 'bellaire', { projectId: 'p-orphan', projectRank: '0|a:' }),
    asset('annabel-1', 'annabel-englund', { services: tag('promo-video'), imageUrl: undefined, imageDimensions: undefined, playbackId: 'pb', videoAspectRatio: '16:9' }),
    asset('empty-shell', 'bellaire', { imageUrl: undefined, imageDimensions: undefined }),
  ]
}
const tiles = () => buildDirectoryTiles({ assets: fixture(), worlds: WORLDS, clients: CLIENTS })
const ids = (ts) => ts.map((t) => t._id)

test('grouping: a deck per client, a sequence of two, a lone sequence member plain, role and shells out', () => {
  const ts = tiles()
  const decks = ts.filter((t) => t.mediaType === 'brand-deck')
  assert.equal(decks.length, 2, "two clients' brand-guidelines-deck stay two tiles")
  assert.equal(decks.find((t) => t.client === 'coco')._id, 'coco-deck-1', 'the deck shows its lowest brandDeckOrder page')
  assert.deepEqual(decks.find((t) => t.client === 'coco').services, ['web-design', 'branding'], "the group's services, unioned")
  const seq = ts.find((t) => t.frames)
  assert.equal(seq._id, 'sequence:munchietown:p-munchie:logo-sequence')
  assert.deepEqual(seq.frames.map((f) => f._id), ['munchie-seq-1', 'munchie-seq-2'])
  assert.equal(seq.sequenceRatio, 2)
  const solo = ts.find((t) => t._id === 'munchie-solo-seq')
  assert.ok(solo && !solo.frames, 'a one-member sequence is a plain tile')
  assert.ok(!ts.some((t) => t._id === 'coco-bts'), 'the role lane stays out')
  assert.ok(!ts.some((t) => t._id === 'empty-shell'), 'an asset with no media stays out')
  assert.ok(!ts.some((t) => 'description' in t || 'releaseInfo' in t || 'orderRank' in t), 'tiles carry the slim face only')
})

test('links: only tiles of a project with a detail page get href + label', () => {
  const ts = tiles()
  assert.equal(ts.find((t) => t._id === 'munchie-1').href, '/work/munchietown')
  assert.equal(ts.find((t) => t._id === 'coco-1').label, 'COCO Branding 2026')
  for (const id of ['bellaire-loose', 'bellaire-orphan', 'annabel-1']) {
    const t = ts.find((x) => x._id === id)
    assert.ok(!('href' in t) && !('label' in t), `${id} is media only`)
  }
})

test("order: 'project' runs World order, then clients by name; 'mix' re-deals across clients", () => {
  const ts = tiles()
  assert.deepEqual(ids(ts), [
    'munchie-1', 'munchie-deck-1', 'sequence:munchietown:p-munchie:logo-sequence', 'munchie-solo-seq',
    'coco-1', 'coco-deck-1',
    'annabel-1', 'bellaire-orphan', 'bellaire-loose',
  ])
  const mixed = orderTiles(ts, 'mix')
  assert.deepEqual([...ids(mixed)].sort(), [...ids(ts)].sort(), 'the same tiles')
  const left = (i) => new Set(mixed.slice(i).map((t) => t.client)).size
  for (let i = 1; i < mixed.length; i++) {
    if (left(i - 1) >= 2) assert.notEqual(mixed[i].client, mixed[i - 1].client, `neighbours ${i - 1}/${i}`)
  }
  assert.equal(orderTiles(ts, 'project'), ts)
})

test("order: 'shuffle' is the same tiles in a seeded new order, and leaves its input alone", () => {
  const ts = tiles()
  const before = ids(ts)
  const a = orderTiles(ts, 'shuffle', 1)
  assert.deepEqual([...ids(a)].sort(), [...before].sort(), 'the same tiles')
  assert.deepEqual(ids(ts), before, 'the input keeps its order')
  assert.deepEqual(ids(orderTiles(ts, 'shuffle', 1)), ids(a), 'one seed, one order')
  const orders = new Set([1, 2, 3, 4, 5, 6].map((seed) => ids(orderTiles(ts, 'shuffle', seed)).join()))
  assert.ok(orders.size > 1, 'other seeds deal other orders')
  assert.ok(![...orders].every((o) => o === before.join()), 'not the build order')
})

test('matchesFilter: the truth table', () => {
  const t = { client: 'munchietown', services: ['branding', 'album-art'] }
  const cases = [
    [new Set(), null, true],
    [new Set(['branding']), null, true],
    [new Set(['web-design']), null, false],
    [new Set(['web-design', 'album-art']), null, true],
    [new Set(), new Set(['munchietown']), true],
    [new Set(), new Set(['coco']), false],
    [new Set(['branding']), new Set(['dj-tennis', 'munchietown']), true],
    [new Set(['web-design']), new Set(['munchietown']), false],
    [new Set(['branding']), new Set(['coco']), false],
    [undefined, undefined, true],
  ]
  for (const [tags, coverage, want] of cases) {
    assert.equal(matchesFilter(t, { tags, coverage }), want, `${[...(tags ?? [])]} / ${coverage && [...coverage]}`)
  }
})

test('coverage: one hop down the affiliations', () => {
  assert.deepEqual([...coverageOf('dj-tennis', CLIENTS)], ['dj-tennis', 'munchietown'])
  assert.deepEqual([...coverageOf('munchietown', CLIENTS)], ['munchietown'])
  const chain = [
    { name: 'A', slug: 'a', umbrellas: ['b'] },
    { name: 'B', slug: 'b', umbrellas: ['c'] },
    { name: 'C', slug: 'c', umbrellas: [] },
  ]
  assert.deepEqual([...coverageOf('c', chain)], ['c', 'b'], 'C covers B, not A')
  assert.equal(coverageOf('nobody', CLIENTS), null)
  assert.equal(coverageOf(null, CLIENTS), null)
  assert.equal(coverageOf('', CLIENTS), null)
})

test('tagPresence: hidden where no tile has the tag, dimmed where the client would empty it', () => {
  const ts = tiles()
  const all = tagPresence(ts, null)
  assert.deepEqual([...all.any].sort(), ['album-art', 'branding', 'promo-video', 'web-design'])
  assert.deepEqual([...all.inClient].sort(), [...all.any].sort())
  const dj = tagPresence(ts, coverageOf('dj-tennis', CLIENTS))
  assert.deepEqual([...dj.inClient].sort(), ['branding'])
  assert.ok(dj.any.has('promo-video'))
})

test('fit: contain for transparency or a crop past half, else cover', () => {
  const face = (w, h, extra) => ({ mediaType: 'static_other', ...img(w, h, extra) })
  assert.equal(fitOf(face(4770, 1000)), 'contain', '4.77:1 in a 2:1 cell')
  assert.equal(fitOf(face(4000, 1000)), 'cover', '4:1 loses exactly half')
  assert.equal(fitOf(face(1000, 1000, { imageHasAlpha: true })), 'contain', 'alpha')
  assert.equal(fitOf(face(900, 1600)), 'cover', '9:16 in a 1:2 cell')
  assert.equal(fitOf(face(1000, 4000)), 'cover', '1:4 in a 1:2 cell loses exactly half')
  assert.equal(fitOf(face(1000, 5000)), 'contain', '1:5 in a 1:2 cell')
  assert.equal(fitOf({ mediaType: 'motion_16x9', playbackId: 'x' }), 'cover')
})

test('roster: every client by name, live when its coverage holds a tile', () => {
  const extra = [...CLIENTS, { name: 'easier said', slug: 'easier-said', umbrellas: null }, { name: '', slug: 'nameless' }]
  const roster = toDrawerRoster(extra, tiles())
  assert.deepEqual(roster.map((r) => r.name), ['Annabel Englund', 'Bellaire', 'COCO', 'DJ Tennis', 'easier said', 'Munchietown'])
  const live = Object.fromEntries(roster.map((r) => [r.slug, r.live]))
  assert.deepEqual(live, { 'annabel-englund': true, bellaire: true, coco: true, 'dj-tennis': true, 'easier-said': false, munchietown: true })
})

// ── playerGate (directory/playerGate.js): who may play ──

class FakeObserver {
  constructor(cb, opts) {
    this.cb = cb
    this.opts = opts
    this.els = new Set()
    FakeObserver.last = this
  }
  observe(el) { this.els.add(el) }
  unobserve(el) { this.els.delete(el) }
  disconnect() { this.els.clear() }
  /** `share` of a `tileH` tile in a `viewH` viewport */
  show(el, share, { tileH = 400, viewH = 900 } = {}) {
    this.cb([{ target: el, isIntersecting: share > 0, intersectionRatio: share, intersectionRect: { height: share * tileH }, rootBounds: { height: viewH } }])
  }
}

function harness(t, cap) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const gate = createPlayerGate({ cap, dwellMs: 300, Observer: FakeObserver })
  const io = FakeObserver.last
  const tile = (video = true) => {
    const el = {}
    const state = { near: false, play: false, changes: 0 }
    const unwatch = gate.watch(el, { video }, (s) => Object.assign(state, s, { changes: state.changes + 1 }))
    return { el, state, unwatch }
  }
  return { gate, io, tile }
}

test('playerGate: a video plays after the dwell; a fling past it never does', (t) => {
  const { io, tile } = harness(t, 6)
  const a = tile()
  const b = tile()
  assert.deepEqual(FakeObserver.last.opts.threshold, [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5])
  io.show(a.el, 0.6)
  t.mock.timers.tick(299)
  assert.deepEqual([a.state.near, a.state.play], [true, false], 'near at once, no play before the dwell')
  t.mock.timers.tick(1)
  assert.equal(a.state.play, true, 'plays at the dwell')
  io.show(b.el, 0.6)
  t.mock.timers.tick(150)
  io.show(b.el, 0)
  t.mock.timers.tick(1000)
  assert.equal(b.state.play, false, 'a fling past never plays')
  io.show(a.el, 0.3)
  assert.deepEqual([a.state.near, a.state.play], [true, false], 'under half: the grant goes back, the tile stays near')
})

test('playerGate: the cap, and a released grant goes to the longest-waiting tile', (t) => {
  const { gate, io, tile } = harness(t, 2)
  const [a, b, c, d] = [tile(), tile(), tile(), tile()]
  for (const x of [a, b, c, d]) io.show(x.el, 1)
  t.mock.timers.tick(300)
  assert.deepEqual([a, b, c, d].map((x) => x.state.play), [true, true, false, false])
  assert.equal(gate.held, 2)
  io.show(a.el, 0)
  assert.deepEqual([a, b, c, d].map((x) => x.state.play), [false, true, true, false], 'c waited longest')
  b.unwatch()
  assert.deepEqual([c, d].map((x) => x.state.play), [true, true], 'an unwatched tile hands its grant on too')
  io.show(c.el, 0.4)
  assert.equal(gate.held, 1, 'nobody left waiting')
})

test('playerGate: stills get near only; cap 0 (reduced motion) never plays; a tall tile plays at half the viewport', (t) => {
  const { io, tile } = harness(t, 0)
  const seq = tile(false)
  const vid = tile()
  io.show(seq.el, 0.1)
  io.show(vid.el, 1)
  t.mock.timers.tick(1000)
  assert.deepEqual([seq.state.near, seq.state.play], [true, false])
  assert.deepEqual([vid.state.near, vid.state.play], [true, false], 'cap 0: posters only')

  t.mock.timers.reset()
  const tall = harness(t, 1)
  const p = tall.tile()
  tall.io.show(p.el, 0.3, { tileH: 2000, viewH: 900 }) // 600px of a 2000px tile: under half of it, over half the view
  t.mock.timers.tick(300)
  assert.equal(p.state.play, true)
  // A tile k views tall is over half the view between shares 1/2k and 1/k: a
  // threshold must fall there, or the observer never reports it half.
  const th = tall.io.opts.threshold
  for (let k = 1; k <= 10; k += 0.25) {
    assert.ok(th.some((s) => s >= 1 / (2 * k) && s <= 1 / k), `a tile ${k} views tall`)
  }
})

test('playerGate: unwatching mid-dwell cancels it; destroy clears every timer', (t) => {
  const { gate, io, tile } = harness(t, 3)
  const a = tile()
  io.show(a.el, 1)
  a.unwatch()
  t.mock.timers.tick(1000)
  assert.equal(a.state.play, false)
  assert.equal(gate.held, 0)
  const b = tile()
  io.show(b.el, 1)
  gate.destroy()
  t.mock.timers.tick(1000)
  assert.equal(b.state.play, false)
  assert.equal(io.els.size, 0)
})

// ── The filter's URL state and the images' sizes (DirectoryPage, DirectoryGrid) ──

test('readFilter / filterSearch: ?tag=a,b&client=slug both ways, other params kept', () => {
  assert.deepEqual(readFilter('?tag=branding,album-art&client=dj-tennis'), { tags: ['branding', 'album-art'], client: 'dj-tennis' })
  assert.deepEqual(readFilter('?tag=&client='), { tags: [], client: null })
  assert.deepEqual(readFilter('?tag=a,,a, b'), { tags: ['a', 'b'], client: null })
  assert.equal(filterSearch('?dirtune=1', ['a', 'b'], 'x'), '?dirtune=1&tag=a,b&client=x')
  assert.equal(filterSearch('?tag=a&client=x&dirorder=mix', [], null), '?tag=&dirorder=mix')
  assert.equal(filterSearch('?tag=a&client=x', [], 'x'), '?client=x', 'a client alone is explicit enough')
  assert.equal(filterSearch('?tag=a', [], null), '?tag=', 'nothing picked stays "every work", not the default')
  assert.equal(filterSearch('?tag=a&client=x&dirorder=mix', ['a'], null, true), '?dirorder=mix', 'the default keeps the URL bare')
  const round = filterSearch('', ['a', 'b'], 'x')
  assert.deepEqual(readFilter(round), { tags: ['a', 'b'], client: 'x' }, 'what it writes reads back')
})

test('the default filter: a bare URL starts on album-art, any filter key in the URL wins', () => {
  const tags = [{ slug: 'branding' }, { slug: 'album-art' }]
  const clients = [{ slug: 'munchietown' }, { slug: 'coco' }]
  const tiles = [
    { client: 'munchietown', services: ['album-art'] },
    { client: 'coco', services: ['branding'] },
  ]
  const data = { tags, clients, tiles }
  const base = defaultFilter(data)
  assert.deepEqual(base, { tags: ['album-art'], client: null })
  assert.deepEqual(defaultFilter({ ...data, tiles: [tiles[1]] }), { tags: [], client: null }, 'no album-art tiles: every work')
  assert.equal(hasFilterParams(''), false)
  assert.equal(hasFilterParams('?dirtune=1&dirorder=mix'), false, 'tunables are not a filter')
  for (const q of ['?tag=branding', '?client=coco', '?tag=', '?client=']) assert.equal(hasFilterParams(q), true, q)
  // what the page writes reads back to the same filter
  for (const next of [base, { tags: [], client: null }, { tags: ['branding'], client: null }, { tags: [], client: 'coco' }]) {
    const search = filterSearch('', next.tags, next.client, sameFilter(next, base))
    const back = hasFilterParams(search) ? readFilter(search) : base
    assert.ok(sameFilter(sanitizeFilter(data, back.tags, back.client), next), `${JSON.stringify(next)} via "${search}"`)
  }
  assert.equal(filterSearch('', ['album-art'], null, true), '', 'the default is a bare URL')
  assert.equal(filterSearch('', [], null, false), '?tag=', 'clear is "every work"')
})

test('readTune: the order and the columns per band, from the URL over the defaults', () => {
  assert.deepEqual(
    { cols: SSR_TUNE.cols, tabletCols: SSR_TUNE.tabletCols, phoneCols: SSR_TUNE.phoneCols, order: SSR_TUNE.order },
    { cols: 5, tabletCols: 4, phoneCols: 2, order: 'project' },
    'Nathan: five wide, two on a phone'
  )
  assert.equal(readTune('', SSR_TUNE).order, 'project')
  assert.equal(readTune('?dirorder=shuffle', SSR_TUNE).order, 'shuffle')
  assert.equal(readTune('?dirorder=nonsense', SSR_TUNE).order, 'project')
  const shuffled = { ...SSR_TUNE, order: 'shuffle' }
  assert.equal(readTune('', shuffled).order, 'shuffle', 'the Studio switch sets the default')
  assert.equal(readTune('?dirorder=project', shuffled).order, 'project', 'the URL overrides it')
  const t = readTune('?dircols=6&dirtabletcols=3&dirphonecols=1', SSR_TUNE)
  assert.deepEqual([t.cols, t.tabletCols, t.phoneCols], [6, 3, 1])
  const bad = readTune('?dircols=0&dirtabletcols=2.5&dirphonecols=3', SSR_TUNE)
  assert.deepEqual([bad.cols, bad.tabletCols, bad.phoneCols], [5, 4, 2], 'garbage falls back')
})

test('sanitizeFilter: unknown, empty and plain clients drop; tags keep Studio order and need tiles in the coverage', () => {
  const tags = [{ slug: 'branding' }, { slug: 'album-art' }, { slug: 'vfx' }]
  const clients = [{ slug: 'munchietown', umbrellas: ['dj-tennis'] }, { slug: 'dj-tennis' }, { slug: 'coco' }, { slug: 'plain' }]
  const tiles = [
    { client: 'munchietown', services: ['album-art'] },
    { client: 'coco', services: ['branding'] },
  ]
  const data = { tags, clients, tiles }
  assert.deepEqual(sanitizeFilter(data, ['album-art', 'branding'], 'dj-tennis'), { tags: ['album-art'], client: 'dj-tennis' }, 'DJ Tennis covers Munchietown; no branding there')
  assert.deepEqual(sanitizeFilter(data, ['album-art', 'branding', 'vfx', 'nope'], null), { tags: ['branding', 'album-art'], client: null })
  assert.deepEqual(sanitizeFilter(data, [], 'nobody'), { tags: [], client: null })
  assert.deepEqual(sanitizeFilter(data, ['branding'], 'plain'), { tags: ['branding'], client: null }, 'a name with no tiles filters nothing')
  assert.deepEqual(sanitizeFilter(data, [], ''), { tags: [], client: null })
})

test('sizesFor: the column share at each breakpoint; a cover crop wider than its cell asks for more', () => {
  assert.equal(sizesFor('square', 1, 'cover'), '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw')
  assert.equal(sizesFor('landscape', 1.78, 'cover'), '(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 67vw')
  assert.equal(sizesFor('portrait', 0.5625, 'cover', { phone: 2 }), '(max-width: 768px) 56vw, (max-width: 1024px) 56vw, 38vw')
  assert.equal(sizesFor('portrait', 0.5625, 'contain'), '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw')
  // the directory's bands: five wide, four on a tablet, two on a phone
  const dir = { phone: 2, tablet: 4, desktop: 5 }
  assert.equal(sizesFor('square', 1, 'cover', dir), '(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 20vw')
  assert.equal(sizesFor('landscape', 1.78, 'cover', dir), '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 40vw')
})
