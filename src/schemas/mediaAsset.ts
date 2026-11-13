import { defineType, defineField, defineArrayMember } from 'sanity'
import { ImageIcon } from '@sanity/icons'
import { orderRankField, orderRankOrdering } from '@sanity/orderable-document-list'

/**
 * Helper: determines if the current mediaType is a video/motion type.
 * Used to conditionally show image vs Mux video upload fields.
 */
const isVideoType = (mediaType: string | undefined): boolean =>
  Boolean(mediaType?.startsWith('motion_') || mediaType === 'featured-project-reel')

export const mediaAsset = defineType({
  name: 'mediaAsset',
  title: 'Media Asset',
  type: 'document',
  icon: ImageIcon,
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

    // ── MEDIA TYPE: Format + Layout Purpose (select first) ──
    defineField({
      name: 'mediaType',
      title: 'Media Type',
      type: 'string',
      description:
        'Select first — determines whether image or video upload appears. ' +
        'Ratio buckets are assigned by CLOSEST aspect ratio: the goal is for ' +
        'media to populate the container that best suits its native aspect ' +
        '(e.g. 25:32 → 4:5, 850:937 → 4:5).',
      options: {
        list: [
          // Layout-purpose types
          { title: 'Album Art (square)', value: 'album-art' },
          { title: 'Logo', value: 'logo' },
          {
            title: 'Featured Project Reel (sizzle/preview)',
            value: 'featured-project-reel',
          },
          { title: 'Brand Deck Page', value: 'brand-deck' },
          { title: 'Carousel Slide', value: 'carousel-slide' },
          // Static format types
          { title: 'Static — 1:1', value: 'static_1x1' },
          { title: 'Static — 3:4', value: 'static_3x4' },
          { title: 'Static — 4:5', value: 'static_4x5' },
          { title: 'Static — 9:16', value: 'static_9x16' },
          { title: 'Static — 16:9', value: 'static_16x9' },
          { title: 'Static — Other', value: 'static_other' },
          // Motion format types
          { title: 'Motion — 1:1', value: 'motion_1x1' },
          { title: 'Motion — 3:4', value: 'motion_3x4' },
          { title: 'Motion — 4:3', value: 'motion_4x3' },
          { title: 'Motion — 4:5', value: 'motion_4x5' },
          { title: 'Motion — 9:16', value: 'motion_9x16' },
          {
            title: 'Motion — 16:9 (YouTube visualizer)',
            value: 'motion_16x9',
          },
          { title: 'Motion — Other', value: 'motion_other' },
        ],
        layout: 'dropdown',
      },
      validation: (r) => r.required(),
    }),

    // ── ASSET UPLOAD (conditional on mediaType) ──
    defineField({
      name: 'image',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => isVideoType(parent?.mediaType),
    }),
    defineField({
      name: 'video',
      type: 'mux.video',
      title: 'Video (Mux)',
      hidden: ({ parent }) => !isVideoType(parent?.mediaType),
    }),
    defineField({
      name: 'splitIntoThirds',
      title: 'Split into thirds on the project page',
      type: 'boolean',
      initialValue: false,
      description:
        'Off by default. On: the project page shows this video as three tiles, each playing its own third of the video, with no overlap. Use it for a long video that deserves more room in the grid than one tile.',
      hidden: ({ parent }) => !isVideoType(parent?.mediaType),
    }),

    // ── ACCESSIBILITY + SEARCH: one pair for images and videos alike ──
    // (replaces the old image.alt subfield, which was never filled)
    defineField({
      name: 'alt',
      title: 'Alt text',
      type: 'string',
      description:
        'What the image or video shows, in one line, for screen readers and search. Name people and brands the references name; no ratio. Up to 150 characters.',
      validation: (r) => r.max(150),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description:
        'A fuller description that only screen readers read (and search indexes). Never shown on the page. Up to 300 characters.',
      validation: (r) => r.max(300),
    }),

    // ── SERVICE TAGS ──
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

    // ── RELATIONSHIPS ──
    defineField({
      name: 'client',
      type: 'reference',
      to: [{ type: 'client' }],
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'collaborators',
      title: 'Collaborators',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'reference',
          to: [{ type: 'client' }],
        }),
      ],
      description:
        "Credited artists on this piece who are not its client (a feature or a co-artist). Their Client Roster name filters the Project Directory to this piece; the piece stays the client's own. Never add a label's release artists.",
      validation: (r) => r.unique(),
    }),
    defineField({
      name: 'project',
      type: 'reference',
      to: [{ type: 'project' }],
      description: 'Optional: link to a project (scope of work)',
    }),

    // ── ALBUM ART RELEASE METADATA (conditional) ──
    defineField({
      name: 'releaseInfo',
      title: 'Release Info',
      type: 'object',
      hidden: ({ parent }) => parent?.mediaType !== 'album-art',
      fields: [
        defineField({
          name: 'releaseArtist',
          type: 'string',
          title: 'Release Artist Name',
        }),
        defineField({
          name: 'releaseTitle',
          type: 'string',
        }),
        defineField({
          name: 'catalogNumber',
          type: 'string',
        }),
        defineField({
          name: 'releaseDate',
          type: 'date',
        }),
        defineField({
          name: 'streamLinks',
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
                      'Spotify',
                      'Apple Music',
                      'Beatport',
                      'SoundCloud',
                      'Bandcamp',
                      'YouTube Music',
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
            },
          ],
        }),
      ],
    }),

    // ── BRAND DECK PAGE ORDER (conditional) ──
    defineField({
      name: 'brandDeckOrder',
      type: 'number',
      title: 'Brand Deck Page Number',
      hidden: ({ parent }) => parent?.mediaType !== 'brand-deck',
    }),

    // ── GENERAL METADATA ──
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
      description: 'Optional — leave empty for a single-year asset.',
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
      name: 'contentRole',
      title: 'Content Role',
      type: 'string',
      description:
        'Leave empty for showcase content (default). Set to "process" for BTS/screen recordings, or "supporting" for contextual assets like event photos. Non-showcase content is excluded from the main portfolio grid.',
      options: {
        list: [
          { title: 'Process (BTS / behind-the-scenes)', value: 'process' },
          { title: 'Supporting (contextual / event photos)', value: 'supporting' },
        ],
        layout: 'radio',
      },
    }),
    defineField({
      name: 'displayGroup',
      title: 'Display Group',
      type: 'string',
      description:
        'Sub-group within a featured project (e.g., "Coachella Set Promo", "Brand Guidelines"). Assets sharing a displayGroup render adjacent on the detail page. Leave empty for ungrouped assets.',
    }),
    // ── GROUP TYPE: which viewer a set opens, and where (the table is in the site code) ──
    defineField({
      name: 'groupType',
      title: 'Group Type',
      type: 'string',
      description:
        'Marks this piece as part of a set the site shows together. Each type opens its own viewer or cycler on some pages and shows as an ordinary piece elsewhere. Album Art sets are a project\'s covers; every other type also needs a Display Group naming its set. Order a Merch set like with like (short sleeves together, then long sleeves, hats…). A Live Footage set leaves its hero clips out: they stay standalone pieces. A Flyer Progression set is the flyers of one event in announcement order (teaser, lineup, set times…). Leave empty for a standalone piece.',
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
    }),
    defineField({
      name: 'sourceFolder',
      type: 'string',
      readOnly: true,
    }),
    defineField({
      name: 'sourceManifest',
      type: 'string',
      readOnly: true,
    }),
    // Drag-orderable rank (managed by @sanity/orderable-document-list).
    // Powers per-project asset ordering — set it by dragging in the
    // Studio's nested "Media Assets (drag to order)" list under each
    // Featured Project.
    orderRankField({ type: 'mediaAsset' }),
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
      subtitle: 'mediaType',
      media: 'image',
    },
    prepare({ title, subtitle, media }) {
      return {
        title,
        subtitle,
        media,
      }
    },
  },
})
