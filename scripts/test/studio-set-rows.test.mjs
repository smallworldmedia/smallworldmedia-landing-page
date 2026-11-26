// The Studio project list as rows (SQ-111, US-10): buildRows, planMove, planMemberMove, heroOf,
// the draft-twin patches. After every plan the patches are APPLIED to the fixture and the rows
// rebuilt, so the assertions read the order a Studio reload would show.
//   node --test scripts/test/studio-set-rows.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { LexoRank } from 'lexorank'
import {
  mergeVersions,
  buildRows,
  planMove,
  planMemberMove,
  heroOf,
  setHeroNote,
  expandPatches,
  applyPlan,
} from '../../src/studio/setRows.js'

// Irregular spacing, so a rank written between two neighbours never lands on a third piece's rank.
const rank = (n) => `0|h${String(n).padStart(5, '0')}:`

const piece = (id, n, extra = {}) => ({ id, title: id, mediaType: 'static_4x5', orderRank: rank(n), set: null, docIds: [id], ...extra })
const set = (id, groupType, allowAsHero = false) => ({ id, title: id, groupType, allowAsHero })

// In rank order: cover | d1 d2 (deck, contiguous) | n1 mid n2 (admats, NOT contiguous) | last |
// then three pieces the list leaves out or flags.
const SETS = [set('set-d', 'deck', true), set('set-n', 'admat', false)]
const fixture = () => [
  piece('cover', 100, { mediaType: 'album-art' }),
  piece('d1', 230, { mediaType: 'brand-deck', set: 'set-d' }),
  piece('d2', 310, { mediaType: 'brand-deck', set: 'set-d' }),
  piece('n1', 450, { set: 'set-n' }),
  piece('mid', 590),
  piece('n2', 670, { set: 'set-n' }),
  piece('last', 800),
  piece('bts', 910, { contentRole: 'process' }),
  piece('old-deck', 930, { mediaType: 'brand-deck' }), // a deck page with no set: not listed
  piece('hid', 970, { hideFromSite: true }),
]
const keys = (rows) => rows.map((r) => r.key)
const ORDER = ['cover', 'set-d', 'set-n', 'mid', 'last', 'hid']

/** Apply a plan to the pieces, rebuild, and return { pieces, rows }. */
const after = (pieces, plan, sets = SETS) => {
  const next = applyPlan(pieces, plan)
  return { pieces: next, rows: buildRows(next, sets) }
}
/** A set's members sit next to each other in the whole project's rank order. */
const contiguous = (pieces, setId) => {
  const sorted = [...pieces].sort((a, b) => (a.orderRank < b.orderRank ? -1 : 1))
  const at = sorted.map((p, i) => (p.set === setId ? i : -1)).filter((i) => i >= 0)
  return at.every((i, j) => j === 0 || i === at[j - 1] + 1)
}
const touched = (plan) => plan.map((p) => p.id).sort()

test('buildRows: one row per piece and per set, a set at its lowest member rank', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  assert.deepEqual(keys(rows), ORDER)
  const n = rows.find((r) => r.key === 'set-n')
  assert.equal(n.kind, 'set')
  assert.deepEqual(n.members.map((m) => m.id), ['n1', 'n2'])
  assert.equal(n.min, rank(450))
  assert.equal(n.max, rank(670))
  assert.equal(contiguous(pieces, 'set-n'), false, 'the fixture set really is split by a piece')
})

test('buildRows: set pieces appear only inside the set, and the list keeps its exclusions for pieces with no set', () => {
  const rows = buildRows(fixture(), SETS)
  const listed = rows.flatMap((r) => r.members.map((m) => m.id))
  assert.ok(!keys(rows).includes('d1') && !keys(rows).includes('n2'), 'members have no row of their own')
  // The deck pages are brand-deck pieces: listed through their set, and the set-less deck page is not.
  assert.ok(listed.includes('d1') && listed.includes('d2'))
  assert.ok(!listed.includes('old-deck'), 'a brand-deck piece with no set stays out')
  assert.ok(!listed.includes('bts'), 'a contentRole piece with no set stays out')
})

test('buildRows: hideFromSite stays listed and flagged; a set whose pieces are all hidden is hidden', () => {
  const pieces = fixture().map((p) => (p.set === 'set-d' ? { ...p, hideFromSite: true } : p))
  const rows = buildRows(pieces, SETS)
  assert.equal(rows.find((r) => r.key === 'hid').hidden, true)
  assert.equal(rows.find((r) => r.key === 'cover').hidden, false)
  assert.equal(rows.find((r) => r.key === 'set-d').hidden, true)
})

test('buildRows: a set with no pieces has no row, and a piece naming a set that is not loaded is a plain piece', () => {
  const rows = buildRows([piece('a', 100), piece('b', 200, { set: 'gone' })], [set('empty', 'deck')])
  assert.deepEqual(keys(rows), ['a', 'b'])
})

test('planMove: a piece above a set writes one rank between the neighbours', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  const plan = planMove(rows, 3, 1) // mid, above set-d
  assert.deepEqual(touched(plan), ['mid'])
  const next = after(pieces, plan)
  assert.deepEqual(keys(next.rows), ['cover', 'mid', 'set-d', 'set-n', 'last', 'hid'])
  assert.ok(plan[0].orderRank > rank(100) && plan[0].orderRank < rank(230))
})

test('planMove: a set to the top rewrites every member above the old first row, contiguous, in their old order', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  const plan = planMove(rows, 1, 0) // set-d to the top
  assert.deepEqual(touched(plan), ['d1', 'd2'])
  const next = after(pieces, plan)
  assert.deepEqual(keys(next.rows), ['set-d', 'cover', 'set-n', 'mid', 'last', 'hid'])
  const members = next.rows[0].members.map((m) => m.id)
  assert.deepEqual(members, ['d1', 'd2'], 'internal order kept')
  assert.ok(next.rows[0].max < rank(100), 'every member sits above the old first row')
  assert.ok(contiguous(next.pieces, 'set-d'))
})

test('planMove: a set between two pieces', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  const plan = planMove(rows, 1, 3) // set-d lands between mid and last
  const next = after(pieces, plan)
  assert.deepEqual(keys(next.rows), ['cover', 'set-n', 'mid', 'set-d', 'last', 'hid'])
  assert.ok(contiguous(next.pieces, 'set-d'))
})

test('planMove: a non-contiguous set is made contiguous and no other row changes rank', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  const plan = planMove(rows, 2, 1) // set-n above set-d
  assert.deepEqual(touched(plan), ['n1', 'n2'], 'only the set\'s members are written')
  const next = after(pieces, plan)
  assert.deepEqual(keys(next.rows), ['cover', 'set-n', 'set-d', 'mid', 'last', 'hid'])
  assert.ok(contiguous(next.pieces, 'set-n'))
  assert.deepEqual(next.rows[1].members.map((m) => m.id), ['n1', 'n2'], 'internal order kept')
  for (const p of pieces.filter((p) => p.set !== 'set-n')) {
    assert.equal(next.pieces.find((q) => q.id === p.id).orderRank, p.orderRank, `${p.id} untouched`)
  }
})

test('planMove: the bottom, for a piece and for a set', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  const piecePlan = planMove(rows, 0, 5) // cover to the bottom, below hid
  assert.deepEqual(keys(after(pieces, piecePlan).rows), ['set-d', 'set-n', 'mid', 'last', 'hid', 'cover'])
  const setPlan = planMove(rows, 1, 5) // set-d to the bottom
  const next = after(pieces, setPlan)
  assert.deepEqual(keys(next.rows), ['cover', 'set-n', 'mid', 'last', 'hid', 'set-d'])
  assert.ok(contiguous(next.pieces, 'set-d'))
})

test('planMove: equal ranks between the neighbours still end in the intended order', () => {
  const pieces = [piece('a', 300), piece('b', 300), piece('c', 500)]
  const rows = buildRows(pieces, [])
  assert.deepEqual(keys(rows), ['a', 'b', 'c'])
  const plan = planMove(rows, 2, 1) // c between a and b: no rank fits between 300 and 300
  const next = after(pieces, plan, [])
  assert.deepEqual(keys(next.rows), ['a', 'c', 'b'])
  assert.equal(new Set(next.pieces.map((p) => p.orderRank)).size, 3, 'every rank is distinct again')
})

test('planMove: a list with an unranked piece is ranked again in the new order', () => {
  const pieces = [piece('a', 100), { ...piece('b', 200), orderRank: undefined }, piece('c', 300)]
  const rows = buildRows(pieces, [])
  assert.deepEqual(keys(rows), ['a', 'c', 'b'], 'unranked sorts last')
  const next = after(pieces, planMove(rows, 2, 0), [])
  assert.deepEqual(keys(next.rows), ['b', 'a', 'c'])
})

test('planMove: no move, or an index outside the list, writes nothing', () => {
  const rows = buildRows(fixture(), SETS)
  assert.deepEqual(planMove(rows, 2, 2), [])
  assert.deepEqual(planMove(rows, -1, 2), [])
  assert.deepEqual(planMove(rows, 1, 99), [])
})

test('planMemberMove: swapping two members keeps the set where it is and writes one rank', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  const plan = planMemberMove(rows, 1, 0, 1) // set-d: d1 below d2
  assert.deepEqual(touched(plan), ['d1'])
  const next = after(pieces, plan)
  assert.deepEqual(keys(next.rows), ORDER, 'the rows stay in place')
  assert.deepEqual(next.rows[1].members.map((m) => m.id), ['d2', 'd1'])
  assert.ok(plan[0].orderRank > rank(310) && plan[0].orderRank < rank(450), 'between d2 and the next row')
})

test('planMemberMove: the first member of a set that leads stays the leader of its position', () => {
  // set-d first in its project, then the rest: reordering its members never changes which row is first.
  const pieces = fixture().filter((p) => p.id !== 'cover')
  const rows = buildRows(pieces, SETS)
  assert.equal(rows[0].key, 'set-d')
  const next = after(pieces, planMemberMove(rows, 0, 1, 0))
  assert.equal(next.rows[0].key, 'set-d')
  assert.deepEqual(next.rows[0].members.map((m) => m.id), ['d2', 'd1'])
  assert.equal(heroOf(next.rows).row.key, 'set-d')
  assert.deepEqual(keys(next.rows), keys(rows))
})

test('planMemberMove: a non-contiguous set moved inside stays between its outer neighbours', () => {
  const pieces = fixture()
  const rows = buildRows(pieces, SETS)
  // n2 to the front: lands between set-d (310) and n1 (450).
  const first = after(pieces, planMemberMove(rows, 2, 1, 0))
  assert.deepEqual(keys(first.rows), ORDER)
  assert.deepEqual(first.rows[2].members.map((m) => m.id), ['n2', 'n1'])
  // n1 to the back: no rank fits between n2 (670) and the next row (590), so the set is laid down as one run.
  const plan = planMemberMove(rows, 2, 0, 1)
  const back = after(pieces, plan)
  assert.deepEqual(keys(back.rows), ORDER)
  assert.deepEqual(back.rows[2].members.map((m) => m.id), ['n2', 'n1'])
  assert.deepEqual(touched(plan), ['n1', 'n2'])
  assert.ok(contiguous(back.pieces, 'set-n'))
  assert.ok(back.rows[2].min > rank(310) && back.rows[2].max < back.rows[3].min, 'between the outer neighbours')
})

test('planMemberMove: equal member ranks are laid down again as one run', () => {
  const pieces = [piece('x', 100), piece('m1', 300, { set: 's' }), piece('m2', 300, { set: 's' }), piece('y', 500)]
  const sets = [set('s', 'deck')]
  const rows = buildRows(pieces, sets)
  const next = after(pieces, planMemberMove(rows, 1, 1, 0), sets)
  assert.deepEqual(keys(next.rows), ['x', 's', 'y'])
  assert.deepEqual(next.rows[1].members.map((m) => m.id), ['m2', 'm1'])
})

test('planMemberMove: a piece row, or a position outside the set, writes nothing', () => {
  const rows = buildRows(fixture(), SETS)
  assert.deepEqual(planMemberMove(rows, 0, 0, 1), [])
  assert.deepEqual(planMemberMove(rows, 1, 0, 5), [])
  assert.deepEqual(planMemberMove(rows, 1, 1, 1), [])
})

// No write takes a rank another piece holds (Nathan 11-25: order is the Studio list's alone).
const between = (lo, hi) => LexoRank.parse(lo).between(LexoRank.parse(hi)).toString()
const heldBy = (pieces, plan) => {
  const writing = new Set(plan.map((p) => p.id))
  const held = new Set(pieces.filter((p) => !writing.has(p.id)).map((p) => p.orderRank))
  return plan.filter((p) => held.has(p.orderRank)).map((p) => `${p.id} ${p.orderRank}`)
}

test('planMove: a piece dropped below an interleaved set takes a free rank (Cheetah Print, 11-20)', () => {
  // The live ranks before his drag: the mockups set's members sit among the flyer admats set's,
  // and the old midpoint between the mockups row (0|i00007:) and the admats row (0|i0000n:) was
  // Miami Teaser's own 0|i0000f:.
  const sets = [set('mockups', 'mockups'), set('admats', 'admat')]
  const pieces = [
    piece('logo-reveal', 0, { orderRank: '0|hzzzzz:' }),
    piece('highway', 0, { set: 'mockups', orderRank: '0|i00007:' }),
    piece('miami-teaser', 0, { set: 'mockups', orderRank: '0|i0000f:' }),
    piece('key-art-red', 0, { set: 'admats', orderRank: '0|i0000n:' }),
    piece('rafael', 0, { set: 'mockups', orderRank: '0|i0000v:' }),
    piece('admat-2', 0, { set: 'admats', orderRank: '0|i00013:' }),
  ]
  const rows = buildRows(pieces, sets)
  assert.deepEqual(keys(rows), ['logo-reveal', 'mockups', 'admats'])
  const plan = planMove(rows, 0, 1, pieces) // Logo Reveal below the mockups row
  assert.deepEqual(touched(plan), ['logo-reveal'])
  assert.deepEqual(heldBy(pieces, plan), [], 'no piece already holds the written rank')
  assert.deepEqual(keys(after(pieces, plan, sets).rows), ['mockups', 'logo-reveal', 'admats'], 'the list shows the drop')
})

test('planMove: a write steps over a piece the list does not show, given the project\'s pieces', () => {
  const mid = between(rank(300), rank(500))
  const pieces = [piece('a', 100), piece('b', 300), piece('bts', 0, { contentRole: 'process', orderRank: mid }), piece('c', 500)]
  const rows = buildRows(pieces, [])
  assert.deepEqual(keys(rows), ['a', 'b', 'c'])
  const plan = planMove(rows, 0, 1, pieces) // a between b and c
  assert.deepEqual(heldBy(pieces, plan), [])
  assert.deepEqual(keys(after(pieces, plan, []).rows), ['b', 'a', 'c'])
  assert.equal(planMove(rows, 0, 1)[0].orderRank, mid, 'without the pieces the list leaves out, the planner cannot see the process clip')
})

test('planMove: a renumber steps over the ranks of pieces the list does not show', () => {
  const first = LexoRank.min().genNext().genNext().toString()
  const pieces = [piece('a', 300), piece('b', 0, { orderRank: undefined }), piece('bts', 0, { contentRole: 'process', orderRank: first })]
  const rows = buildRows(pieces, [])
  const plan = planMove(rows, 1, 0, pieces) // the unranked piece to the top: everything is ranked again
  assert.deepEqual(heldBy(pieces, plan), [])
  assert.deepEqual(keys(after(pieces, plan, []).rows), ['b', 'a'])
})

test('planMemberMove: a member moved inside an interleaved set takes a free rank', () => {
  // set-d's d1 and d2 have set-e's e1 between them, exactly at their midpoint.
  const sets = [set('set-d', 'deck'), set('set-e', 'admat')]
  const pieces = [
    piece('d1', 100, { set: 'set-d' }),
    piece('e1', 0, { set: 'set-e', orderRank: between(rank(100), rank(300)) }),
    piece('d2', 300, { set: 'set-d' }),
    piece('d3', 500, { set: 'set-d' }),
  ]
  const rows = buildRows(pieces, sets)
  assert.deepEqual(keys(rows), ['set-d', 'set-e'])
  const plan = planMemberMove(rows, 0, 2, 1, pieces) // d3 between d1 and d2
  assert.deepEqual(heldBy(pieces, plan), [])
  const next = after(pieces, plan, sets)
  assert.deepEqual(next.rows[0].members.map((m) => m.id), ['d1', 'd3', 'd2'])
  assert.deepEqual(keys(next.rows), ['set-d', 'set-e'])
})

test('heroOf: a set with the toggle on leads whole; off, or a banner set, leads by its first piece', () => {
  const lead = (sets, ps) => heroOf(buildRows(ps, sets))
  const ps = [piece('a', 100, { set: 's' }), piece('b', 200, { set: 's' }), piece('z', 300)]

  const on = lead([set('s', 'deck', true)], ps)
  assert.equal(on.wholeSet, true)
  assert.equal(on.label, 'Hero: whole set')
  assert.equal(on.row.key, 's')

  const off = lead([set('s', 'deck', false)], ps)
  assert.equal(off.wholeSet, false)
  assert.equal(off.label, 'Hero (first piece)')

  const banner = lead([set('s', 'banner', true)], ps)
  assert.equal(banner.wholeSet, false, 'a banner set cannot lead yet, toggle or not')
  assert.equal(banner.label, 'Hero (first piece)')
  const live = lead([set('s', 'live-footage', true)], ps)
  assert.equal(live.label, 'Hero (first piece)')

  assert.equal(lead([], [piece('z', 300)]).label, 'Hero', 'a loose piece is simply the hero')
  assert.equal(heroOf([]), null)
})

test('heroOf: a top row hidden from the site is skipped, as the page skips it', () => {
  const rows = buildRows([piece('a', 100, { hideFromSite: true }), piece('b', 200)], [])
  assert.equal(heroOf(rows).row.key, 'b')
})

test('setHeroNote: why a set will not lead, and when it does', () => {
  const ps = [piece('z', 50), piece('a', 100, { set: 's' }), piece('b', 200, { set: 's' })]
  const note = (s, list = ps) => setHeroNote(buildRows(list, [s]), s.id)

  assert.match(note(set('s', 'banner', true)), /can't lead a project page yet/)
  assert.match(note(set('s', 'live-footage', false)), /can't lead a project page yet/)
  assert.match(note(set('s', 'deck', true)), /isn't first in its project/)
  assert.equal(note(set('s', 'deck', false)), null, 'nothing to add: it is not first and the toggle is off')

  const first = ps.slice(1)
  assert.match(note(set('s', 'deck', true), first), /page opens on the whole set/)
  assert.match(note(set('s', 'deck', false), first), /Can be the hero is off/)
  assert.equal(setHeroNote(buildRows(ps, [set('s', 'deck')]), 'nope'), null)
})

test('album art leads whole in Studio too, toggle or not (11-24): label and note agree with the page', () => {
  const ps = [piece('a', 100, { set: 's' }), piece('b', 200, { set: 's' }), piece('z', 300)]
  const off = heroOf(buildRows(ps, [set('s', 'album-art', false)]))
  assert.equal(off.wholeSet, true)
  assert.equal(off.label, 'Hero: whole set')
  assert.match(setHeroNote(buildRows(ps, [set('s', 'album-art', false)]), 's'), /album art always leads as its whole set/)
  // not first: no nudge to drag it up, whatever the toggle says
  const later = [piece('z', 50), ...ps.slice(0, 2)]
  assert.equal(setHeroNote(buildRows(later, [set('s', 'album-art', true)]), 's'), null)
  assert.equal(setHeroNote(buildRows(later, [set('s', 'album-art', false)]), 's'), null)
})

test('mergeVersions + expandPatches: a rank lands on the published doc and its draft twin, once each', () => {
  const docs = [
    { _id: 'both', title: 'published', orderRank: rank(100) },
    { _id: 'drafts.both', title: 'draft', orderRank: rank(100) },
    { _id: 'pub-only', orderRank: rank(200) },
    { _id: 'drafts.draft-only', orderRank: rank(300) },
    { _id: 'versions.rel.x', orderRank: rank(400) },
  ]
  const items = mergeVersions(docs)
  assert.deepEqual(items.map((i) => i.id), ['both', 'pub-only', 'draft-only'])
  assert.equal(items[0].title, 'draft', 'the draft wins')
  assert.deepEqual(items[0].docIds, ['drafts.both', 'both'])

  const plan = [
    { id: 'both', orderRank: rank(1) },
    { id: 'pub-only', orderRank: rank(2) },
    { id: 'draft-only', orderRank: rank(3) },
  ]
  assert.deepEqual(expandPatches(plan, items), [
    ['drafts.both', { set: { orderRank: rank(1) } }],
    ['both', { set: { orderRank: rank(1) } }],
    ['pub-only', { set: { orderRank: rank(2) } }],
    ['drafts.draft-only', { set: { orderRank: rank(3) } }],
  ])
})
