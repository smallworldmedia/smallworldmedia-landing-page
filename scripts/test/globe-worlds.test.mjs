// Globe-worlds population modes (docs/globe-worlds-plan.md) — the pure
// pieces: buildWorldPools over the real FEATURED_WORLDS_QUERY (groq-js, the
// cms-frontend fixture idiom), worldPatterns' tape layouts, the
// PopulationDirector's assignment, texture ownership and change clock on
// fake panels, and the scheduler's shared streams on a fake video pool.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { parse, evaluate } from 'groq-js'
import { FEATURED_WORLDS_QUERY } from '../../src/lib/queries.js'
import { buildContentFlow } from '../../src/components/work/detail/buildContentFlow.js'
import buildWorldPools, { selectPool, WORLD_POOL_CAP } from '../../src/components/globe/buildWorldPools.js'
import { makePattern, makeField, PATTERNS } from '../../src/components/globe/worldPatterns.js'
import { initialBirth } from '../../src/components/globe/MeridianScroll.js'
import { assetKey } from '../../src/components/globe/TextureManager.js'
import { loadTile } from '../../src/components/globe/tileSwap.js'
import PopulationDirector from '../../src/components/globe/PopulationDirector.js'
import LivePanelScheduler from '../../src/components/globe/LivePanelScheduler.js'
import { TUNING, POP_DEFAULTS } from '../../src/components/globe/popConfig.js'
import { nameCell } from '../../src/components/globe/nameTicker.js'

/* — buildWorldPools over the real query — */
const ref = (_ref) => ({ _type: 'reference', _ref })
const image = { _type: 'image', asset: ref('image-page') }
const video = (id) => ({ _type: 'mux.video', asset: ref(id) })
const base = { _type: 'mediaAsset', client: ref('client-fixture'), project: ref('project-fixture'), sourceManifest: 'Branding' }
const media = (id, rank, fields) => ({ ...base, _id: id, orderRank: rank, title: id, ...fields })
const mux = (id, status = 'ready') => ({ _id: id, _type: 'mux.videoAsset', playbackId: `pb-${id}`, data: { status, aspect_ratio: '16:9' } })
const documents = [
  { _id: 'client-fixture', _type: 'client', name: 'Fixture', slug: { current: 'fixture' } },
  { _id: 'svc', _type: 'service', name: 'Motion Design', slug: { current: 'motion-design' } },
  { _id: 'project-fixture', _type: 'project', title: 'Studio title', slug: { current: 'fixture-branding' }, client: ref('client-fixture'), isFeatured: true, orderRank: '0|hzzzzz:' },
  { _id: 'image-page', _type: 'sanity.imageAsset', url: 'https://cdn.example/page.jpg', metadata: { dimensions: { width: 1200, height: 1500 } } },
  mux('mux-hero'), mux('mux-a'), mux('mux-b'), mux('mux-bad', 'errored'),
  media('hero', '0|a:', { mediaType: 'featured-project-reel', video: video('mux-hero'), services: [ref('svc')] }),
  media('cover', '0|b:', { mediaType: 'album-art', image }),
  media('still', '0|c:', { mediaType: 'static_4x5', image: { _type: 'image', asset: ref('image-still') } }),
  media('clip-a', '0|d:', { mediaType: 'motion_16x9', video: video('mux-a') }),
  media('clip-dup', '0|e:', { mediaType: 'motion_16x9', video: video('mux-a') }), // same stream twice
  media('clip-bad', '0|f:', { mediaType: 'motion_16x9', video: video('mux-bad') }), // not playable
  media('deck-1', '0|g:', { mediaType: 'brand-deck', image, displayGroup: 'deck', brandDeckOrder: 1 }),
  media('slide-1', '0|h:', { mediaType: 'carousel-slide', image, displayGroup: 'carousel' }),
  media('logo', '0|i:', { mediaType: 'logo', image }),
  media('bts', '0|j:', { mediaType: 'motion_16x9', video: video('mux-b'), contentRole: 'process' }),
  { _id: 'image-still', _type: 'sanity.imageAsset', url: 'https://cdn.example/still.jpg', metadata: { dimensions: { width: 800, height: 1000 } } },
]
const query = async (source, dataset = documents) => (await evaluate(parse(source), { dataset })).get()

test('buildWorldPools holds exactly the /work World media: hero, showcase Tiles, album art', async () => {
  const rows = await query(FEATURED_WORLDS_QUERY)
  const [world] = buildWorldPools(rows)
  assert.equal(world.slug, 'fixture-branding')
  assert.equal(world.clientName, 'Fixture')
  assert.deepEqual(world.services, [{ name: 'Motion Design', slug: 'motion-design' }]) // asset-tag fallback
  // Deck pages, carousels, logos, process/BTS and unplayable streams stay out;
  // a duplicate stream is one texture.
  assert.deepEqual(world.assets.map(assetKey), ['pb-mux-hero', 'https://cdn.example/page.jpg', 'https://cdn.example/still.jpg', 'pb-mux-a'])
  assert.deepEqual(world.assets.map((a) => a.kind), ['video', 'art', 'still', 'video'])
  assert.deepEqual(Object.keys(world.assets[0]), ['kind', 'playbackId', 'videoAspectRatio']) // lean props: no ids, no nulls
  // Parity with the World itself: every non-hero tile is a showcase Tile or album art.
  const flow = buildContentFlow(rows[0].assets)
  const worldKeys = new Set([...flow.showcase, ...flow.albumArt].map((a) => a.playbackId || a.imageUrl))
  for (const a of world.assets.slice(1)) assert.ok(worldKeys.has(assetKey(a)), assetKey(a))
})

test('buildWorldPools drops projects without a client/collection or any tile-able media', async () => {
  const rows = await query(FEATURED_WORLDS_QUERY)
  assert.equal(buildWorldPools([{ ...rows[0], collection: null }]).length, 0)
  assert.equal(buildWorldPools([{ ...rows[0], assets: [rows[0].assets.find((a) => a._id === 'logo')] }]).length, 0)
})

const pool = (n, kind, tag = kind) => Array.from({ length: n }, (_, i) => ({ kind, playbackId: `${tag}${i}` }))

test('selectPool caps round-robin across kinds, then restores editorial order', () => {
  const src = [...pool(30, 'video'), ...pool(4, 'still'), ...pool(2, 'art')]
  const picked = selectPool(src, { cap: 12 })
  assert.equal(picked.length, 12)
  assert.equal(picked.filter((a) => a.kind === 'still').length, 4) // never starved behind 30 videos
  assert.equal(picked.filter((a) => a.kind === 'art').length, 2)
  const order = picked.map((a) => src.indexOf(a))
  assert.deepEqual(order, [...order].sort((a, b) => a - b))
  assert.equal(selectPool(src).length, WORLD_POOL_CAP)
  // A kind filter that leaves fewer than 3 falls back to the whole pool.
  assert.equal(selectPool(src, { kinds: ['art'], cap: 40 }).length, src.length)
  assert.ok(selectPool(src, { kinds: ['still'] }).every((a) => a.kind === 'still'))
})

/* — worldPatterns — */
const LON = 12
const tape = (fn, s0 = 0, s1 = 600) => {
  const out = []
  for (let s = s0; s < s1; s++) for (let lon = 0; lon < LON; lon++) out.push(fn(lon, s))
  return out
}

test('patterns are seed-deterministic', () => {
  for (const name of PATTERNS) {
    const a = makePattern(name, { seed: 7, weights: [1, 1], lon: LON })
    const b = makePattern(name, { seed: 7, weights: [1, 1], lon: LON })
    const c = makePattern(name, { seed: 8, weights: [1, 1], lon: LON })
    assert.deepEqual(tape(a.owner, 0, 80), tape(b.owner, 0, 80), name)
    assert.notDeepEqual(tape(a.owner, 0, 80), tape(c.owner, 0, 80), name)
  }
})

test('pattern shares track the weights within ±10%', () => {
  for (const name of PATTERNS) {
    for (const weights of [[1, 1], [1, 1, 1], [3, 1]]) {
      for (const seed of [1, 2, 3]) {
        const owners = tape(makePattern(name, { seed, weights, lon: LON }).owner)
        const total = weights.reduce((x, y) => x + y, 0)
        weights.forEach((w, r) => {
          const share = owners.filter((o) => o === r).length / owners.length
          assert.ok(Math.abs(share - w / total) <= 0.1, `${name} ${weights} seed ${seed} region ${r}: ${share.toFixed(3)}`)
        })
      }
    }
  }
})

test('patterns have no seam at the longitude wrap', () => {
  for (const name of PATTERNS) {
    const { owner } = makePattern(name, { seed: 5, weights: [1, 1, 1], lon: LON })
    let seam = 0
    let interior = 0
    const S = 600
    for (let s = 0; s < S; s++) {
      if (owner(LON - 1, s) !== owner(0, s)) seam += 1
      for (let lon = 0; lon < LON - 1; lon++) if (owner(lon, s) !== owner(lon + 1, s)) interior += 1
    }
    const seamRate = seam / S
    const interiorRate = interior / (S * (LON - 1))
    assert.ok(seamRate <= interiorRate * 2 + 0.05, `${name}: seam ${seamRate.toFixed(3)} vs interior ${interiorRate.toFixed(3)}`)
  }
})

test('a one-region pattern owns everything; the blend field is uniform', () => {
  assert.ok(tape(makePattern('continents', { seed: 1, weights: [1], lon: LON }).owner, 0, 50).every((o) => o === 0))
  const field = makeField(3, { lon: LON, grain: 2.5 })
  const values = tape(field.value)
  for (const m of [0.25, 0.5, 0.75]) {
    const frac = values.filter((v) => v < m).length / values.length
    assert.ok(Math.abs(frac - m) <= 0.06, `field below ${m}: ${frac.toFixed(3)}`)
  }
})

/* — PopulationDirector on fake panels — */
const ROWS = 8
function fakeScene() {
  const panels = []
  for (let lon = 0; lon < LON; lon++) {
    for (let row = 0; row < ROWS; row++) {
      const phi = ((lon + 0.5) / LON) * Math.PI * 2
      const theta = ((row + 0.5) / 6) * Math.PI
      const v2 = () => ({ value: new THREE.Vector2() })
      panels.push({
        lonIndex: lon,
        row,
        tapeS: initialBirth(row, ROWS),
        panelAspect: 1,
        centerDir: new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)),
        mesh: {
          material: {
            uniforms: {
              uPower: { value: 1 },
              uBlueMix: { value: 0 },
              uHasTexA: { value: 0 },
              texA: { value: null },
              uvScaleA: v2(),
              uvOffsetA: v2(),
              texB: { value: null },
              uVideoB: { value: 0 },
              uvScaleB: v2(),
              uvOffsetB: v2(),
              uMix: { value: 0 },
            },
          },
        },
      })
    }
  }
  // Refcounting fake with the TextureManager surface loadTile/director use.
  const textureManager = {
    cache: new Map(),
    loadAsset(a) {
      const k = assetKey(a)
      const e = this.cache.get(k) || { refs: 0 }
      e.refs += 1
      this.cache.set(k, e)
      return Promise.resolve({ k })
    },
    peek: (k) => ({ k }),
    release(k) {
      const e = this.cache.get(k)
      if (!e) return
      e.refs -= 1
      if (e.refs <= 0) this.cache.delete(k)
    },
    refs() {
      let n = 0
      for (const e of this.cache.values()) n += e.refs
      return n
    },
  }
  return { panels, textureManager }
}
const worldsFixture = () =>
  ['Alpha', 'Beta', 'Gamma'].map((name, i) => ({
    slug: name.toLowerCase(),
    clientName: name,
    title: null,
    services: [],
    assets: pool(10, 'video', `${name}-`),
  }))

function assertNeighboursDiffer(panels) {
  const at = new Map(panels.map((p) => [`${p.lonIndex}:${p.tapeS}`, p]))
  for (const p of panels) {
    const right = at.get(`${(p.lonIndex + 1) % LON}:${p.tapeS}`)
    const up = at.get(`${p.lonIndex}:${p.tapeS + 1}`)
    for (const q of [right, up]) {
      if (q) assert.notEqual(assetKey(q.asset), assetKey(p.asset), `L${p.lonIndex} s${p.tapeS} vs L${q.lonIndex} s${q.tapeS}`)
    }
  }
}

test('director: clustered layout follows the pattern, no neighbour repeats, rows keep pouring in', () => {
  // names off: a strip's adjacent tiles share its texture by design (tested below)
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 42, group: 2, chaos: 0, names: 0 })
  const { panels, textureManager } = fakeScene()
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(0.8, 0, 0),
    canAnimate: () => false,
  })
  director.initialLayout(director.byProminence())
  const g = director.grouping
  assert.equal(g.members.length, 2)
  for (const p of panels) {
    assert.equal(p.asset.world, g.regionWorld[g.pattern.owner(p.lonIndex, p.tapeS)])
    assert.equal(p.mesh.material.uniforms.uHasTexA.value, 1) // warm texture bound synchronously
  }
  assertNeighboursDiffer(panels)
  // MeridianScroll's recycle, emulated: the oldest row is re-born on top.
  const rows = new Map()
  for (const p of panels) rows.set(p.row, [...(rows.get(p.row) || []), p])
  let next = ROWS
  for (let k = 0; k < 24; k++) {
    const oldest = [...rows.values()].sort((a, b) => a[0].tapeS - b[0].tapeS)[0]
    for (const p of oldest) p.tapeS = next
    next += 1
    const picks = director.assignRow(oldest)
    oldest.forEach((p, i) => loadTile(director, p, picks[i]))
    assertNeighboursDiffer(panels)
    for (const p of oldest) assert.equal(p.asset.world, g.regionWorld[g.pattern.owner(p.lonIndex, p.tapeS)])
  }
  director.dispose()
})

test('director: texture refs balance — one per tile, plus the warm set until dispose', () => {
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides', seed: 9, group: 2, chaos: 0 })
  const { panels, textureManager } = fakeScene()
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => false,
  })
  director.initialLayout(director.byProminence())
  assert.equal(textureManager.refs(), panels.length + director.warm.size)
  // ⏭ lands warm: the next grouping (relay A+B → B+C) is already held.
  assert.deepEqual(director.upcoming.members, [director.grouping.members[1], (director.grouping.members[1] + 1) % 3])
  for (const a of director.upcoming.pools.flat()) assert.ok(director.warm.has(assetKey(a)), assetKey(a))
  // A re-lay onto the next grouping (the cut path), then the cold refs drop.
  director.step += 1
  director.grouping = director.upcoming
  director.lead = director.grouping.members[0]
  const plan = director.planAll(director.byProminence())
  for (const [p, a] of plan) loadTile(director, p, a)
  director.warmGrouping()
  director.releaseCold()
  assert.equal(textureManager.refs(), panels.length + director.warm.size)
  director.dispose()
  assert.equal(textureManager.refs(), panels.length) // the tiles still own what they show
})

/* — P2: one world at a time, changing on its own clock — */
function makeDirector(tuning, opts = {}) {
  Object.assign(TUNING, POP_DEFAULTS, { mode: 'tides' }, tuning)
  const { panels, textureManager } = fakeScene()
  const director = new PopulationDirector({
    panels,
    worlds: worldsFixture(),
    textureManager,
    getScheduler: () => null,
    getRotation: () => new THREE.Euler(),
    canAnimate: () => false,
    ...opts,
  })
  director.initialLayout(director.byProminence())
  return { director, panels, textureManager }
}
const settleTicks = (ms = 0) => new Promise((r) => setTimeout(r, ms))

test('director: a world holds, then the next pours in on a tide — one full span, steep launch, no overshoot', () => {
  const seen = []
  const scroller = { span: 10, steps: [], advance(d) { this.steps.push(d) } }
  const { director } = makeDirector(
    { seed: 3, chaos: 0, hold: 2, holdJit: 0, trans: 1, transitions: ['tide'] },
    { getScroller: () => scroller, canAnimate: () => true, onWorld: (w, info) => seen.push([w.slug, info.animate]) },
  )
  assert.equal(director.grouping.members.length, 1) // one world by default (Nathan, 09-26)
  const first = director.lead
  director.update(0.1) // the entrance has landed — the first world takes its colour
  assert.deepEqual(seen, [[director.worlds[first].slug, true]])
  let frames = 1
  while (!director.tide && frames < 100) {
    director.update(0.1)
    frames += 1
  }
  assert.ok(frames >= 19 && frames <= 21, `held ${frames} frames`)
  assert.equal(director.lead, (first + 1) % 3) // chaos 0 walks the /work order
  assert.deepEqual(seen.at(-1), [director.worlds[director.lead].slug, true]) // the colour turns as the tide starts
  assert.equal(director.sample(new THREE.Euler()).phase, 'transition')
  while (director.tide) director.update(1 / 60)
  const total = scroller.steps.reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - scroller.span) < 1e-9, `rolled ${total}`) // every row re-births once
  assert.ok(scroller.steps.every((d) => d >= 0)) // never backwards — no overshoot
  assert.ok(scroller.steps[0] > scroller.steps.at(-1) * 100) // steep launch, smooth settle
  const stats = director.sample(new THREE.Euler())
  assert.equal(stats.phase, 'hold')
  assert.equal(stats.world, director.worlds[director.lead].clientName)
  assert.equal(stats.holdLeft, 2)
  director.dispose()
})

test('director: chaos 0 walks the /work order and the set in turn; chaos 1 never revisits a recent world', () => {
  const eight = Array.from({ length: 8 }, (_, i) => ({ slug: `w${i}`, clientName: `W${i}`, title: null, services: [], assets: pool(4, 'video', `w${i}-`) }))
  const set = ['tide', 'blink', 'cut']
  const { director } = makeDirector({ seed: 11, chaos: 0, transitions: set }, { worlds: eight })
  for (let step = 1; step <= 6; step++) {
    assert.equal(director.nextLead(step), (director.lead + 1) % 8)
    assert.equal(director.nextKind(step), set[step % 3])
  }
  TUNING.chaos = 1
  const kinds = new Set()
  for (let step = 1; step <= 60; step++) {
    const lead = director.nextLead(step)
    assert.ok(![director.lead, ...director.history].includes(lead), `step ${step}: ${lead}`)
    kinds.add(director.nextKind(step))
    director.history = [director.lead, ...director.history].slice(0, 4)
    director.lead = lead
  }
  assert.equal(kinds.size, set.length) // every transition in the set gets drawn
  director.dispose()
})

test('director: an in-place change re-lays every tile onto the next world at once (cut)', async () => {
  const seen = []
  const { director, panels, textureManager } = makeDirector({ seed: 4, chaos: 0 }, { onWorld: (w) => seen.push(w.slug) })
  director.greet(false) // reduced motion's greeting — at once
  director.next() // the screens aren't free to animate → a cut
  assert.equal(director.changing, 'cut')
  await settleTicks() // the warm textures settle, the plan lands
  for (const p of panels) assert.equal(p.asset.world, director.lead)
  assert.deepEqual(seen, [director.worlds[(director.lead + 2) % 3].slug, director.worlds[director.lead].slug])
  await settleTicks(60) // the settle (a zero-length delayedCall on the ticker)
  assert.equal(director.busy, false)
  assert.equal(textureManager.refs(), panels.length + director.warm.size)
  director.dispose()
})

/* — 10-06: client-name ticker strips — */
test('name strips: every K-th row, two runs half a globe apart, one always facing', () => {
  const L = LON
  const o = { seed: 7, L, rows: 6, count: 2, spans: [2, 3] }
  const stripRows = []
  for (let s = -8; s < 48; s++) {
    const cells = []
    for (let lon = 0; lon < L; lon++) {
      const c = nameCell(lon, s, o)
      if (c) cells.push([lon, c])
    }
    if (!cells.length) continue
    stripRows.push({ s, cells })
    const starts = [...new Set(cells.map(([, c]) => c.start))]
    assert.equal(starts.length, 2)
    assert.equal((starts[1] - starts[0] + L) % L, L / 2)
    for (const [lon, c] of cells) assert.equal((c.start + c.k) % L, lon) // tile k sits k on from the start
    for (const a of starts) {
      const run = cells.filter(([, c]) => c.start === a)
      assert.ok([2, 3].includes(run[0][1].span))
      assert.equal(run.length, run[0][1].span)
    }
  }
  // K = the face's 6 rows over 2 → a strip row every 3rd tape row.
  for (let i = 1; i < stripRows.length; i++) assert.equal(stripRows[i].s - stripRows[i - 1].s, 3)
  // Any two neighbouring strip rows leave no gap wider than 4 tiles round the globe.
  for (let i = 1; i < stripRows.length; i++) {
    const st = [...new Set([...stripRows[i - 1].cells, ...stripRows[i].cells].map(([, c]) => c.start))].sort((a, b) => a - b)
    const gaps = st.map((a, j) => (st[(j + 1) % st.length] - a + L) % L || L)
    assert.ok(Math.max(...gaps) <= 4, `s${stripRows[i].s}: starts ${st}`)
  }
  assert.equal(nameCell(0, 0, { ...o, count: 0 }), null)
})

test('director: name strips share one texture per world and run as one ticker across their tiles', () => {
  const { director, panels, textureManager } = makeDirector(
    { seed: 5, names: 2, nameSpans: ['3'], nameSpeed: 1 },
    { canAnimate: () => true }
  )
  const world = director.worlds[director.lead]
  const key = `name:${world.slug}:ink`
  const strips = panels.filter((p) => p.shownAsset?.kind === 'name')
  assert.ok(strips.length >= 6) // 8 tape rows → 2–3 strip rows × 2 strips × 3 tiles
  for (const p of strips) {
    assert.equal(assetKey(p.shownAsset), key)
    assert.equal(p.shownAsset.text, world.clientName)
    assert.equal(p.shownAsset.world, director.lead)
  }
  assert.ok(director.warm.has(key)) // warmed with the grouping
  assert.equal(textureManager.cache.get(key).refs, strips.length + 1) // one shared texture, refcounted per tile
  director.update(0.5)
  const at = new Map(panels.map((p) => [`${p.lonIndex}:${p.tapeS}`, p]))
  let pairs = 0
  for (const p of strips) {
    const q = at.get(`${(p.lonIndex + 1) % LON}:${p.tapeS}`)
    if (q?.shownAsset?.kind !== 'name' || q.shownAsset.k !== p.shownAsset.k + 1) continue
    const a = p.mesh.material.uniforms
    const b = q.mesh.material.uniforms
    // tile k+1's window starts where tile k's ends (mod the strip's period)
    const d = (((b.uvOffsetA.value.x - a.uvOffsetA.value.x - a.uvScaleA.value.x) % 1) + 1) % 1
    assert.ok(d < 1e-9 || d > 1 - 1e-9, `L${p.lonIndex} s${p.tapeS}: ${d}`)
    pairs += 1
  }
  assert.ok(pairs > 0)
  const before = strips[0].mesh.material.uniforms.uvOffsetA.value.x
  director.update(0.25) // the ticker moves on its clock
  assert.notEqual(strips[0].mesh.material.uniforms.uvOffsetA.value.x, before)
  director.dispose()
})

test('scheduler: shared streams — one decode per clip lights every copy of it', async () => {
  const { panels, textureManager } = fakeScene()
  const clips = ['c0', 'c1', 'c2'].map((id) => ({ kind: 'video', playbackId: id, videoAspectRatio: '16:9' }))
  panels.forEach((p, i) => {
    p.asset = clips[i % clips.length]
    p.parked = false
  })
  const pool = {
    assigned: [],
    released: [],
    assign(slot, id) {
      this.assigned.push(id)
      return Promise.resolve({ videoWidth: 16, videoHeight: 9 })
    },
    releaseSlot(slot) {
      this.released.push(slot)
    },
  }
  const scheduler = new LivePanelScheduler({ panels, assets: clips, poolHandle: pool, textureManager, cycleThumbnails: false })
  scheduler.setShared(true)
  const rot = new THREE.Euler()
  scheduler.update(rot, 0, null)
  await settleTicks()
  assert.equal(pool.assigned.length, 2) // two new streams per update, one decode each
  scheduler.update(rot, 0.5, null)
  await settleTicks()
  assert.deepEqual([...pool.assigned].sort(), ['c0', 'c1', 'c2']) // never a second decode of a clip
  assert.ok(panels.every((p) => p.liveState === 'live')) // every copy joined
  assert.equal(scheduler.getStats().live, 3)
  scheduler.notifyContentChange(panels[0]) // a recycle: that copy leaves, the stream plays on
  assert.equal(panels[0].liveState, null)
  assert.equal(scheduler.streams.size, 3)
  scheduler.setShared(false) // back to one decode per tile: everything drops first
  assert.equal(pool.released.length, 3)
  assert.ok(panels.every((p) => !p.liveState && p.mesh.material.uniforms.uMix.value === 0))
  scheduler.dispose()
})
