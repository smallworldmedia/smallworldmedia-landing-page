import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { muxInput } from 'sanity-plugin-mux-input'
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list'
import { schemaTypes } from './src/schemas'

/**
 * Singleton editor — prevents the globe-settings document from appearing
 * in the default "new document" list and renders it as a single form.
 */
const GLOBE_SETTINGS_ID = 'globeSettings' // deterministic _id for the singleton

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
            S.listItem()
              .title('Featured Project Assets')
              .child(async () => {
                // Fetch all featured projects to build a nested list
                const client = context.getClient({ apiVersion: '2024-01-01' })
                const projects = await client.fetch(
                  `*[_type == "project" && isFeatured == true && !(_id in path("drafts.**"))]
                    | order(orderRank asc, client->name asc) {
                    _id,
                    title,
                    "clientName": client->name
                  }`
                )

                // Each orderableDocumentListDeskItem returns a complete ListItem,
                // so use them directly as items in the nested list.
                return S.list()
                  .title('Featured Project Assets')
                  .items(
                    projects.map((project: { _id: string; title?: string; clientName?: string }) =>
                      orderableDocumentListDeskItem({
                        type: 'mediaAsset',
                        filter: `project._ref == $projectId && !(mediaType in ["brand-deck", "carousel-slide", "album-art"]) && !defined(contentRole)`,
                        params: { projectId: project._id },
                        title: `${project.title || project.clientName || 'Untitled'} — Assets`,
                        id: `project-assets-${project._id}`,
                        S,
                        context,
                      })
                    )
                  )
              }),

            S.divider(),

            S.documentTypeListItem('project').title('All Projects'),
            S.documentTypeListItem('mediaAsset').title('Media Assets'),
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

  document: {
    // Prevent creating new globeSettings documents from the "new document" menu
    newDocumentOptions: (prev) =>
      prev.filter((item) => item.templateId !== 'globeSettings'),
  },
})
