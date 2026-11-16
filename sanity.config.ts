import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { muxInput } from 'sanity-plugin-mux-input'
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list'
import { SortIcon, StackIcon } from '@sanity/icons'
import { schemaTypes } from './src/schemas'
import ProjectAssetsPane from './src/studio/ProjectAssetsPane.jsx'
import SetFormInput from './src/studio/SetFormInput.jsx'

/**
 * Singleton editor — prevents the globe-settings document from appearing
 * in the default "new document" list and renders it as a single form.
 */
const GLOBE_SETTINGS_ID = 'globeSettings' // deterministic _id for the singleton
const SITE_SETTINGS_ID = 'siteSettings' // ditto — site-wide copy

type FeaturedProject = { _id: string; title?: string; clientName?: string }

/** The featured projects in Nathan's order, for the per-project lists. */
const fetchFeaturedProjects = (client: {
  fetch: <T>(query: string) => Promise<T>
}): Promise<FeaturedProject[]> =>
  client.fetch<FeaturedProject[]>(
    `*[_type == "project" && isFeatured == true && !(_id in path("drafts.**"))]
      | order(orderRank asc, client->name asc) {
      _id,
      title,
      "clientName": client->name
    }`
  )

const projectLabel = (project: FeaturedProject) => project.title || project.clientName || 'Untitled'

export default defineConfig({
  name: 'swm-portfolio',
  title: 'SWM Portfolio',

  projectId: 'b60h4u7o',
  dataset: 'production',

  plugins: [
    structureTool({
      structure: (S, context) =>
        S.list()
          .title('Content')
          .items([
            // ── Globe Settings (singleton) ──
            S.listItem()
              .title('Globe Settings')
              .child(
                S.document()
                  .schemaType('globeSettings')
                  .documentId(GLOBE_SETTINGS_ID)
                  .title('Globe Settings')
              ),

            // ── Site Settings (singleton) — site-wide copy ──
            S.listItem()
              .title('Site Settings')
              .child(
                S.document()
                  .schemaType('siteSettings')
                  .documentId(SITE_SETTINGS_ID)
                  .title('Site Settings')
              ),

            S.divider(),

            // ── Featured Projects: drag-to-order projects ──
            orderableDocumentListDeskItem({
              type: 'project',
              filter: 'isFeatured == true',
              title: 'Featured Projects (drag to order)',
              S,
              context,
            }),

            // ── Per-project asset ordering ──
            // One list per project (src/studio/ProjectAssetsPane.jsx): a loose piece is a
            // row, a set is ONE row that opens its Set page (US-10, 11-16). Album art is
            // listed (11-12, Nathan): a page's hero is its lowest-ranked media of any
            // kind, so a hidden cover on a legacy rank took the hero where it couldn't be
            // dragged.
            S.listItem()
              .title('Featured Project Assets')
              .child(async () => {
                const client = context.getClient({ apiVersion: '2024-01-01' })
                const projects = await fetchFeaturedProjects(client)

                // A row opens its piece or its Set page; which one is the document's _type.
                const openRow = async (id: string) => {
                  const type = await client.fetch<string | null>(
                    `*[_id in [$id, "drafts." + $id]][0]._type`,
                    { id }
                  )
                  const doc = S.document().documentId(id)
                  return type ? doc.schemaType(type) : doc
                }

                return S.list()
                  .title('Featured Project Assets')
                  .items(
                    projects.map((project) => {
                      const id = `project-assets-${project._id}`
                      const title = `${projectLabel(project)} — Assets`
                      return S.listItem()
                        .title(title)
                        .id(id)
                        .icon(SortIcon)
                        .child(
                          // __preserveInstance and key, as the orderable list sets them: opening
                          // a row must not remount this list and reload it.
                          Object.assign(
                            S.component(ProjectAssetsPane)
                              .id(id)
                              .title(title)
                              .options({ projectId: project._id })
                              .child(openRow)
                              .serialize(),
                            { __preserveInstance: true, key: id }
                          )
                        )
                    })
                  )
              }),

            // ── Sets, by featured project (all of them are under "Sets" below) ──
            S.listItem()
              .title('Featured Project Sets')
              .child(async () => {
                const client = context.getClient({ apiVersion: '2024-01-01' })
                const projects = await fetchFeaturedProjects(client)
                return S.list()
                  .title('Featured Project Sets')
                  .items(
                    projects.map((project) =>
                      S.listItem()
                        .title(`${projectLabel(project)} — Sets`)
                        .id(`project-sets-${project._id}`)
                        .icon(StackIcon)
                        .child(
                          S.documentList()
                            .title(`${projectLabel(project)} — Sets`)
                            .id(`project-sets-${project._id}`)
                            .schemaType('mediaSet')
                            .filter('_type == "mediaSet" && project._ref == $projectId')
                            .params({ projectId: project._id })
                            .defaultOrdering([{ field: 'title', direction: 'asc' }])
                        )
                    )
                  )
              }),

            S.divider(),

            S.documentTypeListItem('project').title('All Projects'),
            S.documentTypeListItem('mediaAsset').title('Media Assets'),
            S.documentTypeListItem('mediaSet').title('Sets'),
            S.documentTypeListItem('client').title('Clients'),
            S.documentTypeListItem('serviceTag').title('Service Tags'),
          ]),
    }),
    visionTool(),
    muxInput(),
  ],

  schema: {
    types: schemaTypes,
  },

  // The Set page: a Set document's fields, then its media in order (src/studio/SetFormInput.jsx).
  form: {
    components: {
      input: SetFormInput,
    },
  },

  document: {
    // Keep both singletons out of the "new document" menu — each has one
    // deterministic _id and a pinned desk item, so a second copy is only ever
    // a mistake.
    newDocumentOptions: (prev) =>
      prev.filter(
        (item) => item.templateId !== 'globeSettings' && item.templateId !== 'siteSettings'
      ),
  },
})
