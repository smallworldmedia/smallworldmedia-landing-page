import { defineType, defineField } from 'sanity'
import { StackIcon } from '@sanity/icons'

// A set of media the site shows together (Nathan, 11-16). Each member mediaAsset points here through
// its `set` field. Order inside a set, and the set's place in its project, are the members'
// orderRank, so a set has no rank of its own. Which viewer a type opens, and on which pages, is site
// code (GROUP_SURFACES in src/components/work/detail/buildContentFlow.js).
export const mediaSet = defineType({
  name: 'mediaSet',
  title: 'Set',
  type: 'document',
  icon: StackIcon,
  fields: [
    defineField({
      name: 'title',
      title: 'Name',
      type: 'string',
      description: 'What Studio calls this set, e.g. "Jampacked World Tour 2026 admats". Never shown on the site.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Key',
      type: 'slug',
      options: { source: 'title' },
      description:
        'The name the site groups this set by. Keep a key ending in -sequence, -banner, -banners or -admats as it is: the site reads those endings.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'project',
      type: 'reference',
      to: [{ type: 'project' }],
      description:
        "The project this set belongs to. Every piece in the set belongs to the same project. Leave empty for a set of pieces with no project (a client's merch, banners or tour admats): every piece in it then has no project.",
    }),
    defineField({
      name: 'groupType',
      title: 'Type',
      type: 'string',
      description:
        'Which viewer or cycler the set opens, and on which pages. Order a Merch set like with like (short sleeves together, then long sleeves, hats…). A Live Footage set leaves its hero clips out: they stay standalone pieces. A Flyer Progression set is the flyers of one event in announcement order (teaser, lineup, set times…).',
      options: {
        list: [
          { title: 'Album Art', value: 'album-art' },
          { title: 'Deck', value: 'deck' },
          { title: 'Banner', value: 'banner' },
          { title: 'Admat', value: 'admat' },
          { title: 'Carousel', value: 'carousel' },
          { title: 'Merch', value: 'merch' },
          { title: 'Visuals', value: 'visuals' },
          { title: 'Live Footage', value: 'live-footage' },
          { title: 'Mockups', value: 'mockups' },
          { title: 'Flyer Progression', value: 'flyer-progression' },
        ],
        layout: 'dropdown',
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'allowAsHero',
      title: 'Can be the hero',
      type: 'boolean',
      initialValue: false,
      description:
        "When this set is first in the project's list, the project page opens on the whole set in its own viewer. Off: the set's first piece is the hero on its own.",
    }),
  ],
  preview: {
    select: { title: 'title', type: 'groupType', project: 'project.title', client: 'project.client.name', hero: 'allowAsHero' },
    prepare: ({ title, type, project, client, hero }) => ({
      title,
      subtitle: [type, project || client, hero ? 'can be the hero' : null].filter(Boolean).join(' · '),
    }),
  },
})
