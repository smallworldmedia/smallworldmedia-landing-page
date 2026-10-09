import { defineType, defineField } from 'sanity'
import { CogIcon } from '@sanity/icons'

/**
 * siteSettings — Singleton document for site-wide copy.
 *
 * WHY A SECOND SINGLETON rather than more fields on globeSettings: that
 * document is named, titled and iconned for the homepage globe, and its one
 * field curates panel order. Site-wide prose has nothing to do with it, and a
 * "Globe Settings" form holding the footer blurb is the kind of drift that
 * makes a Studio hard to trust.
 *
 * BOTH FIELDS ARE PLAIN `text`, NOT PORTABLE TEXT. The house rich-text format
 * is a marked plain string parsed by src/lib/keywords.jsx — the same format
 * the 15 featured-project `description` fields already use in production. One
 * vocabulary, one parser, no new dependency:
 *
 *   **bold**              → --weight-medium (the Medium opening cut)
 *   [[keyword]]           → the highlight box + ink wipe
 *   [[keyword]](/href)    → a highlighted keyword that is also a link
 *   [label](/href)        → a plain underlined prose link
 *
 * THE HIGHLIGHT IS INVISIBLE WITHOUT A DRIVER. `.kw__box` rests at scaleX(0)
 * and `.kw__ink` at a fully-clipped inset, so a surface that renders markers
 * without running `kwWipe`/`kwSet` shows legible text and no highlight. Both
 * consumers of these fields drive it; a third surface would have to as well.
 */
export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  icon: CogIcon,
  fields: [
    defineField({
      name: 'title',
      type: 'string',
      initialValue: 'Site Settings',
      readOnly: true,
      hidden: true,
    }),
    defineField({
      name: 'footerBlurb',
      title: 'Footer blurb (long)',
      type: 'text',
      rows: 3,
      description:
        'The studio blurb in the globe-page footer panel and the tagline pill\'s long state. ' +
        'Markers: **bold** for the Medium cut, [[keyword]] for a highlight, ' +
        '[[keyword]](/href) for a highlighted link, [label](/href) for a plain link. ' +
        'It is sized to fill one line on desktop, so it re-measures itself when you change it — ' +
        'a longer sentence simply sets smaller.',
      validation: (Rule) => Rule.required().max(400),
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline (abbreviated)',
      type: 'text',
      rows: 2,
      description:
        'The short tagline shown everywhere the long blurb is not — the pill\'s resting state. ' +
        'Same markers as the footer blurb; **bold** carries the Medium opening weight.',
      validation: (Rule) => Rule.required().max(160),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Site Settings' }
    },
  },
})
