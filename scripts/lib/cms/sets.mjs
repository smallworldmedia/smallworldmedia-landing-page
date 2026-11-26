// Set identity for manifest intake (runner.mjs), the same ids the sets migration (US-10, retired 11-25) created,
// so intake finds the sets already in the dataset. The contract: one set per (project, key); the
// key is the manifest's displayGroup, and a project's album art is `<project slug>-album-art`. A set with
// no project (a client's merch, banners or admats, 11-24) is named by its client: `mediaSet-<client slug>-<key>`.
export const ref = id => ({ _type: 'reference', _ref: id })
export const baseId = id => id.replace(/^drafts\./, '').replace(/^versions\.[^.]+\./, '')
export const setId = (projectSlug, key) => `mediaSet-${projectSlug}-${key}`
export const albumArtKey = projectSlug => `${projectSlug}-album-art`
// A key that more than one project would use is made per project instead (brand-guidelines-deck).
export const projectKey = (group, projectSlug, shared) => shared ? `${group}-${projectSlug}` : group
// "the key in words": hyphens to spaces, first letter capital.
export const keyInWords = key => { const words = key.replace(/-+/g, ' ').trim(); return words.charAt(0).toUpperCase() + words.slice(1) }
// A piece the album wall shows for its project: typed album art, with a project and no displayGroup.
export const isProjectAlbumArt = doc => !doc.displayGroup && (doc.groupType === 'album-art' || doc.mediaType === 'album-art')
export function newSet({ projectSlug, projectId, key, groupType, allowAsHero = false }) {
  return { _id: setId(projectSlug, key), _type: 'mediaSet', title: keyInWords(key), slug: { _type: 'slug', current: key }, ...(projectId ? { project: ref(projectId) } : {}), groupType, allowAsHero }
}
