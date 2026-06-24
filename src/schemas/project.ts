import { defineType, defineField, defineArrayMember } from 'sanity'
import { DocumentsIcon } from '@sanity/icons'
import { orderRankField, orderRankOrdering } from '@sanity/orderable-document-list'

export const project = defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  icon: DocumentsIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      description:
        'Optional — leave empty if the project is known only by its client name.',
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
      name: 'yearStart',
      title: 'Year (Start)',
      type: 'number',
      validation: (r) => r.min(2015).max(2030),
    }),
    defineField({
      name: 'yearEnd',
      title: 'Year (End)',
      type: 'number',
      description: 'Optional — leave empty for a single-year project.',
      validation: (r) => r.min(2015).max(2030),
      hidden: ({ parent }) => !!parent?.isOngoing,
    }),
    defineField({
      name: 'isOngoing',
      title: 'Ongoing?',
      type: 'boolean',
      initialValue: false,
      description: 'When true, displays "current" instead of an end year.',
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
    // Drag-orderable rank (managed by @sanity/orderable-document-list).
    // Powers the Featured Projects experience order at /work — set it by
    // dragging in the Studio's "Featured Projects (drag to order)" list.
    orderRankField({ type: 'project' }),
  ],
  orderings: [
    orderRankOrdering,
    {
      title: 'Sort Order',
      name: 'sortOrder',
      by: [{ field: 'sortOrder', direction: 'asc' }],
    },
    {
      title: 'Year (Newest)',
      name: 'yearDesc',
      by: [{ field: 'yearStart', direction: 'desc' }],
    },
  ],
  preview: {
    select: {
      title: 'title',
      clientName: 'client.name',
      featured: 'isFeatured',
    },
    prepare({ title, clientName, featured }) {
      const label = title || clientName || 'Untitled';
      return {
        title: featured ? `⭐ ${label}` : label,
        subtitle: title ? clientName : undefined,
      }
    },
  },
})
