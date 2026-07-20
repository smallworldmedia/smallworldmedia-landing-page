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
    defineField({
      name: 'projectColor',
      title: 'Project Color',
      type: 'string',
      description:
        'Optional accent color for this featured project (hex, e.g. #0000FF). Tints the /work card chip, service tags, enter_world CTA, left-pager active chip, this project\'s detail-page client band, and the page-enter fill. Leave blank for the default brand blue.',
    }),
    defineField({
      name: 'projectColorSecondary',
      title: 'Project Color (Secondary)',
      type: 'string',
      description:
        'Optional second palette color (hex, e.g. #00E0FF) for two-tone accents. Threaded through as --project-color-2; leave blank for the default brand blue.',
    }),

    // Drag-orderable rank (managed by @sanity/orderable-document-list).
    // Powers the Featured Projects experience order at /work AND the globe's
    // featured-project auto-fill ranking — set it by dragging in the Studio's
    // "Featured Projects (drag to order)" list.
    orderRankField({ type: 'project' }),
  ],
  orderings: [
    orderRankOrdering,
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
