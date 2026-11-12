/**
 * serviceGroups — the Project Directory's parent filter tags (SQ-67, Nathan
 * 11-12: "create a new motion/video parent service tag that contains 2D
 * animation, 3D animation, live visuals, and promo video … visible on page
 * load: when selected, the child tags are revealed").
 *
 * Code-side on purpose: the parent is no Sanity document, so there is no schema
 * change, and it is keyed by serviceTag SLUG, so the Studio can retire or
 * re-sort a child without touching this. The parent exists only in the filter;
 * detail pages, overlays and the inquiry form keep the children's full names
 * (`label` is the directory filter's abbreviation).
 *
 * The parent's slug is also its URL key, ?tag=motion-video,2d-animation. A
 * child in the URL without it (?tag=promo-video) opens the parent too
 * (withParents), so the child is never ticked behind a shut group.
 *
 * Pure, like buildDirectoryTiles.js.
 */

export const SERVICE_GROUPS = [
  {
    slug: 'motion-video',
    // Title Case like every stored tag name in this filter
    name: 'Motion/Video',
    children: [
      { slug: '2d-animation', label: '2D' },
      { slug: '3d-animation', label: '3D' },
      { slug: 'live-visuals' },
      { slug: 'promo-video' },
    ],
  },
];

const groupOf = (slug) => SERVICE_GROUPS.find((g) => g.slug === slug);

/** Whether `slug` is a group's parent tag. */
export const isGroup = (slug) => !!groupOf(slug);

/**
 * The Studio-ordered tags with each group's parent in: the parent takes the
 * earliest child's slot and the children follow it directly, in the group's
 * order, so the filter reads parent → children. A child carries `child` (its
 * parent's slug) and, where the group names one, the filter's `label` as its
 * `name`. A group none of whose children exist is left out.
 */
export function withGroups(tags) {
  const moved = new Set();
  const out = [];
  for (const t of tags) {
    if (moved.has(t.slug)) continue;
    const group = SERVICE_GROUPS.find((g) => g.children.some((c) => c.slug === t.slug));
    if (!group) {
      out.push(t);
      continue;
    }
    out.push({ name: group.name, slug: group.slug, group: true });
    for (const c of group.children) {
      const own = tags.find((x) => x.slug === c.slug);
      if (!own) continue;
      moved.add(c.slug);
      out.push({ ...own, name: c.label ?? own.name, child: group.slug });
    }
  }
  return out;
}

/** The group slugs whose parent is among the picked `slugs`. */
export const openGroups = (slugs) => SERVICE_GROUPS.map((g) => g.slug).filter((s) => slugs.includes(s));

/**
 * Picked slugs with a parent added wherever a child is (a deep link to a child
 * opens its group).
 */
export function withParents(slugs) {
  const out = new Set(slugs);
  for (const g of SERVICE_GROUPS) if (g.children.some((c) => out.has(c.slug))) out.add(g.slug);
  return out;
}

/**
 * The picked slugs after a click on `slug`: the parent off takes its children
 * with it, so a shut group holds no ticked child.
 */
export function toggleTag(picked, slug) {
  if (!picked.includes(slug)) return [...picked, slug];
  const group = groupOf(slug);
  const drop = new Set([slug, ...(group?.children.map((c) => c.slug) ?? [])]);
  return picked.filter((s) => !drop.has(s));
}

/**
 * The tag slugs a tile is matched against (matchesFilter): a parent alone
 * stands for all its children (their union), and with a child ticked it steps
 * aside so the child narrows. Anything else passes through.
 */
export function effectiveTags(tags) {
  const on = new Set(tags);
  for (const g of SERVICE_GROUPS) {
    if (!on.delete(g.slug)) continue;
    if (!g.children.some((c) => on.has(c.slug))) for (const c of g.children) on.add(c.slug);
  }
  return on;
}

/**
 * Adds each group's parent to a presence Set when any child is in it, so the
 * parent shows (and is lit) while any child has media, and hides only when all
 * of them are empty.
 */
export function addGroupPresence(set) {
  for (const g of SERVICE_GROUPS) if (g.children.some((c) => set.has(c.slug))) set.add(g.slug);
  return set;
}
