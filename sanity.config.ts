import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { muxInput } from 'sanity-plugin-mux-input'
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list'
import { schemaTypes } from './src/schemas'

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
            // Drag-to-order the Featured Projects (powers the /work pager order)
            orderableDocumentListDeskItem({
              type: 'project',
              filter: 'isFeatured == true',
              title: 'Featured Projects (drag to order)',
              S,
              context,
            }),
            S.documentTypeListItem('project').title('All Projects'),
            S.documentTypeListItem('mediaAsset').title('Media Assets'),
            S.documentTypeListItem('client').title('Clients'),
            S.documentTypeListItem('serviceTag').title('Service Tags'),
            S.documentTypeListItem('collaborator').title('Collaborators'),
          ]),
    }),
    visionTool(),
    muxInput(),
  ],

  schema: {
    types: schemaTypes,
  },
})
