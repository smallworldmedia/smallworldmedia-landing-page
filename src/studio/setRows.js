// The Studio project list as rows: a set is ONE row, a loose piece is one row, and every move is a
// handful of orderRank writes (Nathan 11-16: "drag the set as a single row ... see which of the
// media assets are contained within it"). Pure on purpose, so scripts/test/studio-set-rows.test.mjs
// can run it without Sanity or React; the pane (ProjectAssetsPane.jsx) and the Set page
// (SetFormInput.jsx) only draw these rows and send these patches.
//
// Ordering model (story US-10, pinned 11-16):
//   - Order is the members' `orderRank` (LexoRank, one scope per project). A set has no rank.
//   - A set row sits at its LOWEST member rank; its members are listed in rank order.
//   - Moving a single piece writes ONE rank between the neighbour rows' boundaries. A set row's
//     boundary is its min (as the row below it) or its max (as the row above it).
//   - Moving a set rewrites ALL its members as one contiguous run between the neighbours'
//     boundaries, internal order kept, so a non-contiguous set becomes contiguous.
//   - Moving a member inside its set keeps the set where it is (planMemberMove).
//
// The hero rule is src/lib/setHero.js and nothing here restates it.

import { LexoRank } from 'lexorank'
import { setCanLead } from '../lib/setHero.js'

const MIN = LexoRank.min().toString()
const MAX = LexoRank.max().toString()

// Pieces without a set keep the list's old exclusions: deck pages and carousel slides are listed
// through their set now, and a contentRole piece (process, supporting) is not showcase content.
const UNLISTED_TYPES = ['brand-deck', 'carousel-slide']
const isListed = (piece) => !UNLISTED_TYPES.includes(piece.mediaType) && !piece.contentRole

// ── Versions ──────────────────────────────────────────────────────────────────

/**
 * Raw documents (published and `drafts.` twins, as a GROQ query returns them) into one item per
 * document: the draft's values over the published ones, `id` the published id every other piece
 * of the model uses, `docIds` the documents that exist, so a write patches each of them.
 */
export function mergeVersions(docs) {
  const byId = new Map()
  for (const doc of docs) {
    if (!doc?._id || doc._id.startsWith('versions.')) continue
    const id = doc._id.replace(/^drafts\./, '')
    const entry = byId.get(id) || { published: null, draft: null }
    if (doc._id.startsWith('drafts.')) entry.draft = doc
    else entry.published = doc
    byId.set(id, entry)
  }
  return [...byId].map(([id, { published, draft }]) => ({
    ...(published || {}),
    ...(draft || {}),
    id,
    docIds: [draft?._id, published?._id].filter(Boolean),
  }))
}

// ── Rows ──────────────────────────────────────────────────────────────────────

const byRank = (a, b) => {
  const ra = a.orderRank || null
  const rb = b.orderRank || null
  if (ra !== rb) {
    if (!ra) return 1
    if (!rb) return -1
    return ra < rb ? -1 : 1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

function makeRow(kind, key, members, set) {
  const ranks = members.map((m) => m.orderRank).filter(Boolean)
  return {
    kind, // 'piece' | 'set'
    key, // the piece's id, or the set's id
    set: set || null,
    members, // in rank order; a piece row holds just its piece
    min: ranks[0] || null,
    max: ranks[ranks.length - 1] || null,
    unranked: ranks.length < members.length,
    hidden: members.every((m) => m.hideFromSite === true),
  }
}

const byRowRank = (a, b) => byRank({ orderRank: a.min, id: a.key }, { orderRank: b.min, id: b.key })

/**
 * The ordered rows of one project's list. `pieces` are mediaAsset items (id, orderRank, set =
 * the set's id or null, mediaType, contentRole, hideFromSite, ...); `sets` are mediaSet items
 * (id, groupType, allowAsHero, ...), both as mergeVersions returns them.
 *
 * A piece with a set shows only inside that set's row; a set with no pieces has no place in the
 * order, so it has no row. hideFromSite pieces stay listed (the row says so).
 */
export function buildRows(pieces, sets) {
  const setById = new Map(sets.map((s) => [s.id, s]))
  const members = new Map()
  const singles = []
  for (const piece of [...pieces].sort(byRank)) {
    const set = piece.set ? setById.get(piece.set) : null
    if (set) {
      if (!members.has(set.id)) members.set(set.id, [])
      members.get(set.id).push(piece)
    } else if (isListed(piece)) {
      singles.push(makeRow('piece', piece.id, [piece], null))
    }
  }
  const setRows = [...members].map(([id, list]) => makeRow('set', id, list, setById.get(id)))
  return [...singles, ...setRows].sort(byRowRank)
}

// ── Ranks ─────────────────────────────────────────────────────────────────────

/** n ascending ranks strictly between lo and hi, or null when lo and hi leave no room. */
function spread(lo, hi, n) {
  if (n <= 0) return []
  if (!(lo < hi)) return null
  let mid
  try {
    mid = LexoRank.parse(lo).between(LexoRank.parse(hi)).toString()
  } catch {
    return null
  }
  if (!(lo < mid && mid < hi)) return null
  const below = Math.floor((n - 1) / 2)
  const left = spread(lo, mid, below)
  const right = spread(mid, hi, n - 1 - below)
  return left && right ? [...left, mid, ...right] : null
}

/** The rank a row above a gap offers: its max, or its min when its max would cross `hi`. */
const lowerBound = (prevRow, hi) => {
  if (!prevRow) return MIN
  return prevRow.max < hi ? prevRow.max : prevRow.min
}
const upperBound = (nextRow) => (nextRow ? nextRow.min : MAX)

/** Patches for the pieces whose rank actually changes. */
const changed = (pieces, ranks) =>
  pieces.flatMap((piece, i) => (piece.orderRank === ranks[i] ? [] : [{ id: piece.id, orderRank: ranks[i] }]))

/**
 * The last resort, for duplicate ranks (no room between two neighbours) and for a list with
 * unranked pieces: rank every piece again, in row order, the way the orderable list's "Reset
 * Order" does. Only the pieces whose rank differs come back.
 */
function renumber(rowsInOrder) {
  let rank = LexoRank.min()
  const pieces = rowsInOrder.flatMap((row) => row.members)
  const ranks = pieces.map(() => {
    rank = rank.genNext().genNext()
    return rank.toString()
  })
  return changed(pieces, ranks)
}

const withMoved = (rows, from, to) => {
  const next = rows.slice()
  next.splice(to, 0, next.splice(from, 1)[0])
  return next
}

const inRange = (list, ...indexes) => indexes.every((i) => Number.isInteger(i) && i >= 0 && i < list.length)

/**
 * Move the row at `from` so it ends up at index `to`. Returns [{ id, orderRank }] for the pieces
 * to write: one for a single piece; every member, as one contiguous run, for a set.
 */
export function planMove(rows, from, to) {
  if (from === to || !inRange(rows, from, to)) return []
  const moving = rows[from]
  const rest = rows.filter((_, i) => i !== from)
  const prevRow = rest[to - 1]
  const nextRow = rest[to]
  if (rows.some((row) => row.unranked)) return renumber(withMoved(rows, from, to))

  const hi = upperBound(nextRow)
  const lo = lowerBound(prevRow, hi)
  const ranks = spread(lo, hi, moving.members.length)
  if (!ranks) return renumber(withMoved(rows, from, to))
  return changed(moving.members, ranks)
}

/**
 * Move a member inside the set row at `setIndex`, from position `from` to position `to`. The set
 * never leaves its place: the new rank sits between the member's new neighbours, and at an end
 * of the set it sits between the member beside it and the set's outer neighbour row. If that
 * leaves no room (duplicate ranks, or a set that was not contiguous), the whole set is laid
 * down again as one run between the outer neighbours.
 */
export function planMemberMove(rows, setIndex, from, to) {
  const row = rows[setIndex]
  if (!row || row.kind !== 'set') return []
  const count = row.members.length
  if (from === to || !inRange(row.members, from, to)) return []
  const order = row.members.slice()
  order.splice(to, 0, order.splice(from, 1)[0])
  if (rows.some((r) => r.unranked)) {
    return renumber(rows.map((r, i) => (i === setIndex ? { ...r, members: order } : r)))
  }

  const prevRow = rows[setIndex - 1]
  const nextRow = rows[setIndex + 1]
  const before = order[to - 1]
  const after = order[to + 1]
  const hi = after ? after.orderRank : upperBound(nextRow)
  const lo = before ? before.orderRank : lowerBound(prevRow, hi)
  const one = spread(lo, hi, 1)
  if (one) return [{ id: order[to].id, orderRank: one[0] }]

  const runHi = upperBound(nextRow)
  const run = spread(lowerBound(prevRow, runHi), runHi, count)
  if (!run) return renumber(rows.map((r, i) => (i === setIndex ? { ...r, members: order } : r)))
  return changed(order, run)
}

/** The plan as the documents to patch: each piece's published doc and its draft twin, when both exist. */
export function expandPatches(plan, pieces) {
  const docIds = new Map(pieces.map((p) => [p.id, p.docIds || [p.id]]))
  return plan.flatMap(({ id, orderRank }) => (docIds.get(id) || [id]).map((docId) => [docId, { set: { orderRank } }]))
}

/** The pieces with a plan's ranks written in, for the pane's optimistic update and the tests. */
export function applyPlan(pieces, plan) {
  const ranks = new Map(plan.map((p) => [p.id, p.orderRank]))
  return pieces.map((piece) => (ranks.has(piece.id) ? { ...piece, orderRank: ranks.get(piece.id) } : piece))
}

// ── Hero ──────────────────────────────────────────────────────────────────────

/**
 * The row the project page opens on, and whether the whole set leads. The top row, except a row
 * every piece of which is hidden from the site: the page skips those, so the hero is the next.
 * The label is what the pane prints on that row.
 */
export function heroOf(rows) {
  const row = rows.find((r) => !r.hidden)
  if (!row) return null
  const wholeSet = row.kind === 'set' && setCanLead(row.set)
  const label = wholeSet ? 'Hero: whole set' : row.kind === 'set' ? 'Hero (first piece)' : 'Hero'
  return { row, wholeSet, label }
}

/**
 * What the Set page says about the hero, or null when there is nothing to add. A set the hero
 * box can't hold yet, or one with the toggle on that isn't first in its project, reads as why
 * it will not lead.
 */
export function setHeroNote(rows, setId) {
  const row = rows.find((r) => r.kind === 'set' && r.key === setId)
  if (!row) return null
  const { set } = row
  const first = heroOf(rows)?.row === row
  if (!setCanLead({ allowAsHero: true, groupType: set.groupType })) {
    return "This type can't lead a project page yet, so the set's first piece is the hero when the set is first."
  }
  if (set.allowAsHero === true && !first) {
    return "Can be the hero is on, but this set isn't first in its project's list, so it doesn't lead the page. Drag it to the top of Featured Project Assets."
  }
  if (set.allowAsHero === true) return 'This set is first in its project and can be the hero, so the page opens on the whole set.'
  if (first) return "This set is first in its project, but Can be the hero is off, so the page opens on the set's first piece."
  return null
}
