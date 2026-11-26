// The Set page: the Set document's own fields, then its media in order, draggable inside the set.
// Wired in sanity.config.ts as the form's root input, for the mediaSet document only, so it is
// one page (Nathan 11-16: "see which media assets are within a set in a single-page panel and be
// able to toggle on if we want to allow for that set to be used as a hero"). The toggle is the
// document's own "Can be the hero" field above the list. Keep all of this React out of
// src/schemas: a schema edit moves the CMS fingerprint.

import { Box, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { useFormValue } from 'sanity'
import { IntentLink } from 'sanity/router'
import { ReorderList, RowText, Thumb, titleCase } from './ReorderList.jsx'
import { planMemberMove, setHeroNote } from './setRows.js'
import { useProjectRows } from './useProjectRows.js'

function SetMedia({ setId, projectId }) {
  const { loading, error, rows, pieces, commit } = useProjectRows(projectId)

  if (error) {
    return (
      <Card tone="critical" padding={3} radius={2}>
        <Text size={1}>Could not load this set's media: {error.message}</Text>
      </Card>
    )
  }
  if (loading) {
    return (
      <Flex justify="center" padding={4}>
        <Spinner />
      </Flex>
    )
  }

  const setIndex = rows.findIndex((r) => r.kind === 'set' && r.key === setId)
  const row = rows[setIndex]
  if (!row) {
    return (
      <Card tone="transparent" border padding={3} radius={2}>
        <Text size={1} muted>
          No pieces are in this set yet. Open a piece and choose this set in its Set field to add it.
        </Text>
      </Card>
    )
  }

  const note = setHeroNote(rows, setId)
  const items = row.members.map((piece) => ({
    key: piece.id,
    label: piece.title || 'untitled',
    body: [
      <Thumb key="thumb" piece={piece} />,
      <RowText
        key="text"
        title={piece.title}
        subtitle={piece.mediaType}
        badges={[piece.hideFromSite && { text: 'Hidden from site', tone: 'caution' }]}
      />,
    ],
    link: (children) => (
      <IntentLink
        intent="edit"
        params={{ id: piece.id, type: 'mediaAsset' }}
        style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}
      >
        {children}
      </IntentLink>
    ),
  }))

  return (
    <Stack gap={3}>
      <Text size={1} weight="semibold">
        Media in this set ({row.members.length})
      </Text>
      {note && (
        <Card tone="caution" border padding={3} radius={2}>
          <Text size={1}>{note}</Text>
        </Card>
      )}
      <ReorderList items={items} onMove={(from, to) => commit(planMemberMove(rows, setIndex, from, to, pieces))} />
      <Text size={0} muted>
        {titleCase(row.set.groupType)} set. Drag a piece, or use the arrows, to reorder it inside the set; the set keeps its place in the project.
      </Text>
    </Stack>
  )
}

function SetPage(props) {
  const documentId = useFormValue(['_id'])
  const projectId = useFormValue(['project'])?._ref
  const setId = typeof documentId === 'string' ? documentId.replace(/^drafts\./, '') : null
  return (
    <Stack gap={5}>
      {props.renderDefault(props)}
      {setId && projectId ? (
        <SetMedia setId={setId} projectId={projectId} />
      ) : (
        <Box>
          <Text size={1} muted>
            Choose the project to see this set's media.
          </Text>
        </Box>
      )}
    </Stack>
  )
}

/** The form's input for every field of every document; only the root of a Set gets the media list. */
export default function SetFormInput(props) {
  const isSetRoot = props.id === 'root' && props.schemaType?.name === 'mediaSet'
  return isSetRoot ? <SetPage {...props} /> : props.renderDefault(props)
}
