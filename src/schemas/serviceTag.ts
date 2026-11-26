import { defineType, defineField } from 'sanity'
import { TagIcon } from '@sanity/icons'

export const serviceTag = defineType({
  name: 'serviceTag',
  title: 'Service Tag',
  type: 'document',
  icon: TagIcon,
  fields: [
    defineField({
      name: 'name',
      type: 'string',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug',
      type: 'slug',
      options: { source: 'name' },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'sortOrder',
      type: 'number',
      description: 'Display order in inquiry form and filters',
    }),
  ],
  orderings: [
    {
      title: 'Sort Order',
      name: 'sortOrder',
      by: [{ field: 'sortOrder', direction: 'asc' }],
    },
  ],
  preview: {
    select: { title: 'name' },
  },
})
