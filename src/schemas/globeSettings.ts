import { defineType, defineField, defineArrayMember } from 'sanity'
import { EarthGlobeIcon } from '@sanity/icons'

/**
 * globeSettings — Singleton document for curating the homepage globe.
 *
 * The `picks` array drives panel priority: array position 0 lands on
 * the most prominent panel, position 1 on the next, and so on. Assets
 * below the picks list auto-fill from the Featured Project hierarchy
 * (see buildAssetPool.js).
 *
 * Only video-capable mediaAssets (motion_* or featured-project-reel with
 * a Mux playback ID) should be added — the globe can't render statics.
 */
export const globeSettings = defineType({
  name: 'globeSettings',
  title: 'Globe Settings',
  type: 'document',
  icon: EarthGlobeIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      initialValue: 'Globe Settings',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'picks',
      title: 'Globe Picks (drag to reorder)',
      type: 'array',
      description:
        'Curated video assets for the homepage globe. Position 1 = most prominent panel. Drag to reorder. Auto-fill handles remaining panels.',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'mediaAsset' }],
        }),
      ],
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Globe Settings' }
    },
  },
})
