import { defineType, defineField, defineArrayMember } from 'sanity'
import { DocumentsIcon } from '@sanity/icons'

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: DocumentsIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'client',
      type: 'reference',
      to: [{ type: 'client' }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'description',
      type: 'text',
      rows: 4,
    }),
    defineField({
      name: 'year',
      type: 'number',
      validation: (r) => r.min(2015).max(2030),
    }),
    defineField({
      name: 'services',
      title: 'Service Tags',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'serviceTag' }],
        }),
      ],
    }),
    defineField({
      name: 'isFeatured',
      type: 'boolean',
      initialValue: false,
      description:
        'When true, this project gets a dedicated Featured Project page.',
    }),

    // ── PAGE BUILDER (for Featured Projects) ──
    defineField({
      name: 'contentBlocks',
      title: 'Page Layout',
      type: 'array',
      description:
        'Compose the Featured Project page layout. Drag blocks to reorder.',
      hidden: ({ parent }) => !parent?.isFeatured,
      of: [
        defineArrayMember({
          name: 'fullWidthMedia',
          title: 'Full Width Media',
          type: 'object',
          fields: [
            defineField({
              name: 'asset',
              type: 'reference',
              to: [{ type: 'mediaAsset' }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'caption',
              type: 'string',
            }),
          ],
          preview: {
            select: { title: 'asset.title', media: 'asset.image' },
          },
        }),
        defineArrayMember({
          name: 'splitMedia',
          title: 'Split Media (50/50)',
          type: 'object',
          fields: [
            defineField({
              name: 'left',
              type: 'reference',
              to: [{ type: 'mediaAsset' }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'right',
              type: 'reference',
              to: [{ type: 'mediaAsset' }],
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: 'left.title', subtitle: 'right.title' },
          },
        }),
        defineArrayMember({
          name: 'tripleMedia',
          title: 'Triple Media (33/33/33)',
          type: 'object',
          fields: [
            defineField({
              name: 'first',
              type: 'reference',
              to: [{ type: 'mediaAsset' }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'second',
              type: 'reference',
              to: [{ type: 'mediaAsset' }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'third',
              type: 'reference',
              to: [{ type: 'mediaAsset' }],
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: 'first.title' },
          },
        }),
        defineArrayMember({
          name: 'textBlock',
          title: 'Text Block',
          type: 'object',
          fields: [
            defineField({
              name: 'body',
              type: 'array',
              of: [{ type: 'block' }],
            }),
          ],
          preview: {
            prepare() {
              return { title: 'Text Block' }
            },
          },
        }),
      ],
    }),

    defineField({
      name: 'sortOrder',
      type: 'number',
      description: 'Lower = first in directory',
    }),
  ],
  orderings: [
    {
      title: 'Sort Order',
      name: 'sortOrder',
      by: [{ field: 'sortOrder', direction: 'asc' }],
    },
    {
      title: 'Year (Newest)',
      name: 'yearDesc',
      by: [{ field: 'year', direction: 'desc' }],
    },
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'client.name',
      featured: 'isFeatured',
    },
    prepare({ title, subtitle, featured }) {
      return {
        title: featured ? `⭐ ${title}` : title,
        subtitle,
      }
    },
  },
})
