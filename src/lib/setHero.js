// Which sets can lead a project page as its hero (Nathan, 11-16). The one place the rule lives:
// the project page (work/detail) and the Studio project list (src/studio) both read it, so the
// list's "Hero" label and the page always agree. Dependency-free, because the Studio imports it.
//
// The hero is the project's first piece by orderRank. When that piece belongs to a Set document
// whose "Can be the hero" is on, and whose type the hero box can hold, the whole set leads in its
// own viewer; otherwise the piece leads on its own, as before. Banner and live-footage sets size
// themselves from their grid socket, so they can't lead yet.

export const HERO_SET_TYPES = Object.freeze([
  'album-art', 'deck', 'admat', 'carousel', 'visuals', 'mockups', 'flyer-progression', 'merch',
])

/** A Set document (or its projection): may it lead its project? */
export function setCanLead(set) {
  return !!set && set.allowAsHero === true && HERO_SET_TYPES.includes(set.groupType)
}

/**
 * Does a project's first piece lead as its whole set? `asset` is the piece as the site queries
 * project it: `setId` (its Set document, when it has one), `groupType` (the set's type first) and
 * `setAllowsHero`. `type` is the piece's group type as the caller resolves it (the site passes
 * groupTypeOf, which also infers a type for pieces without the field).
 *
 * A piece with no Set document keeps the rule from before sets were documents: only a deck leads
 * as its set. That keeps every page the same until the migration lands, and after it, because
 * deck sets start with the toggle on.
 */
export function leadsAsSet(asset, type = asset?.groupType) {
  if (!asset) return false
  if (asset.setId) return setCanLead({ groupType: type, allowAsHero: asset.setAllowsHero })
  return type === 'deck'
}
