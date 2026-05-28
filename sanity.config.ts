import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { muxInput } from 'sanity-plugin-mux-input'
import { schemaTypes } from './src/schemas'

export default defineConfig({
  name: 'swm-portfolio',
  title: 'SWM Portfolio',

  projectId: 'b60h4u7o',
  dataset: 'production',

  plugins: [
    structureTool(),
    visionTool(),
    muxInput(),
  ],

  schema: {
    types: schemaTypes,
  },
})
