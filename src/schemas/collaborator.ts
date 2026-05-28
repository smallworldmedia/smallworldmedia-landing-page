import { defineType, defineField } from 'sanity'
import { UserIcon } from '@sanity/icons'

export const collaborator = defineType({
  name: 'collaborator',
  title: 'Collaborator',
  type: 'document',
  icon: UserIcon,
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
    }),
    defineField({
      name: 'role',
      type: 'string',
      description: 'e.g. "Videographer", "Photographer", "3D Artist"',
    }),
    defineField({
      name: 'url',
      type: 'url',
      title: 'Portfolio / Social Link',
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'role' },
  },
})
