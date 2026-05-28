import { defineType, defineField } from 'sanity'
import { UsersIcon } from '@sanity/icons'

export const client = defineType({
  name: 'client',
  title: 'Client',
  type: 'document',
  icon: UsersIcon,
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
      name: 'clientType',
      title: 'Client Type',
      type: 'string',
      options: {
        list: [
          { title: 'Artist (DJ / Musician / Individual)', value: 'artist' },
          { title: 'Record Label', value: 'label' },
          { title: 'Artist Management', value: 'management' },
          { title: 'Promoter / Event', value: 'promoter-event' },
        ],
        layout: 'radio',
      },
      initialValue: 'artist',
    }),
    defineField({
      name: 'description',
      type: 'text',
      title: 'Short Bio',
      rows: 3,
    }),
    defineField({
      name: 'city',
      type: 'string',
    }),
    defineField({
      name: 'country',
      type: 'string',
    }),
    defineField({
      name: 'affiliations',
      title: 'Affiliations',
      type: 'array',
      description:
        'Link to related labels, management companies, or parent entities.',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'entity',
              type: 'reference',
              to: [{ type: 'client' }],
              validation: (r) => r.required(),
            }),
            defineField({
              name: 'relationship',
              type: 'string',
              options: {
                list: [
                  { title: 'Signed to (label)', value: 'signed-to' },
                  { title: 'Label of (owns/runs)', value: 'label-of' },
                  { title: 'Managed by', value: 'managed-by' },
                ],
                layout: 'radio',
              },
            }),
          ],
          preview: {
            select: { title: 'entity.name', subtitle: 'relationship' },
          },
        },
      ],
    }),
    defineField({
      name: 'links',
      title: 'Links',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'platform',
              type: 'string',
              options: {
                list: [
                  'Website',
                  'Instagram',
                  'Spotify',
                  'SoundCloud',
                  'Apple Music',
                  'Beatport',
                  'Bandcamp',
                  'YouTube',
                  'Facebook',
                  'TikTok',
                  'Resident Advisor',
                  'Other',
                ],
              },
            }),
            defineField({
              name: 'url',
              type: 'url',
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: 'platform', subtitle: 'url' },
          },
        },
      ],
    }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'clientType' },
  },
})
