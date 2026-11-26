// "Featured Project Assets" for one project: the pieces and sets of the project as ONE list.
// A set is one draggable row (it opens its Set page); the top row is the project page's hero.
// Rank math is setRows.js, the write is useProjectRows.js; this file only draws and wires.
// Replaces the per-project @sanity/orderable-document-list, which can list one _type only.

import { Box, Card, Flex, Spinner, Stack, Text } from '@sanity/ui'
import { usePaneRouter } from 'sanity/structure'
import { ReorderList, RowText, Thumb, titleCase } from './ReorderList.jsx'
import { heroOf, planMove } from './setRows.js'
import { useProjectRows } from './useProjectRows.js'

const STRIP = 4

function ThumbStrip({ members }) {
  return (
    <Flex align="center" gap={1} style={{ flex: 'none' }}>
      {members.slice(0, STRIP).map((m) => (
        <Thumb key={m.id} piece={m} size={28} />
      ))}
      {members.length > STRIP && (
        <Text size={0} muted>
          +{members.length - STRIP}
        </Text>
      )}
    </Flex>
  )
}

function rowBody(row, heroLabel) {
  const hero = heroLabel && { text: heroLabel, tone: heroLabel === 'Hero: whole set' ? 'positive' : 'primary' }
  const hidden = row.hidden && { text: 'Hidden from site', tone: 'caution' }
  if (row.kind === 'piece') {
    const piece = row.members[0]
    return [
      <Thumb key="thumb" piece={piece} />,
      <RowText key="text" title={piece.title} subtitle={piece.mediaType} badges={[hero, hidden]} />,
    ]
  }
  const { set, members } = row
  const count = `${members.length} ${members.length === 1 ? 'piece' : 'pieces'}`
  return [
    <ThumbStrip key="strip" members={members} />,
    <RowText
      key="text"
      title={set.title}
      subtitle={`Set · ${titleCase(set.groupType)} · ${count}`}
      badges={[set.allowAsHero && { text: 'Can be the hero', tone: 'positive' }, hero, hidden]}
    />,
  ]
}

export default function ProjectAssetsPane({ options }) {
  const { projectId } = options || {}
  const { loading, error, rows, pieces, commit } = useProjectRows(projectId)
  const { ChildLink, groupIndex, routerPanesState } = usePaneRouter()
  const openId = routerPanesState[groupIndex + 1]?.[0]?.id

  if (error) {
    return (
      <Box padding={3}>
        <Card tone="critical" padding={3} radius={2}>
          <Text size={1}>Could not load this project's assets: {error.message}</Text>
        </Card>
      </Box>
    )
  }
  if (loading) {
    return (
      <Flex align="center" justify="center" style={{ height: '100%' }}>
        <Spinner />
      </Flex>
    )
  }
  if (!rows.length) {
    return (
      <Box padding={4}>
        <Text align="center" muted size={1}>
          No assets in this project.
        </Text>
      </Box>
    )
  }

  const hero = heroOf(rows)
  const items = rows.map((row) => {
    const name = row.kind === 'set' ? row.set.title : row.members[0].title
    return {
      key: row.key,
      label: name || 'untitled',
      selected: openId === row.key,
      body: rowBody(row, hero?.row === row ? hero.label : null),
      link: (children) => (
        <ChildLink childId={row.key} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          {children}
        </ChildLink>
      ),
    }
  })

  return (
    <Box padding={2} style={{ height: '100%', overflow: 'auto' }}>
      <Stack gap={2}>
        <ReorderList items={items} onMove={(from, to) => commit(planMove(rows, from, to, pieces))} />
        <Box padding={2}>
          <Text size={0} muted>
            The top row is the project page's hero. A set is one row: drag it to move all its pieces together.
          </Text>
        </Box>
      </Stack>
    </Box>
  )
}
