// The list both Studio surfaces draw: the project's assets (ProjectAssetsPane) and a set's media
// (SetFormInput). Native HTML5 drag from a handle, plus Move up / Move down buttons for the
// keyboard. It only reports (from, to); the rank math and the write are setRows.js and
// useProjectRows.js.

import { useState } from 'react'
import { Badge, Button, Card, Flex, Stack, Text } from '@sanity/ui'
import { ChevronDownIcon, ChevronUpIcon, DragHandleIcon } from '@sanity/icons'

export const titleCase = (slug) =>
  String(slug || '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

/** A square thumbnail from the Sanity CDN, or Mux's poster for a clip. */
export function Thumb({ piece, size = 40 }) {
  const px = size * 2
  const url = piece.thumb
    ? `${piece.thumb}?w=${px}&h=${px}&fit=crop&auto=format`
    : piece.playbackId
      ? `https://image.mux.com/${piece.playbackId}/thumbnail.jpg?width=${px}&height=${px}&fit_mode=smartcrop`
      : null
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 2,
        overflow: 'hidden',
        background: 'var(--card-border-color)',
      }}
    >
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
    </div>
  )
}

/** A row's text: a title, a muted line under it, and badges. */
export function RowText({ title, subtitle, badges = [] }) {
  return (
    <Stack gap={2} style={{ minWidth: 0 }}>
      <Text size={1} weight="semibold" textOverflow="ellipsis">
        {title || 'Untitled'}
      </Text>
      <Flex gap={1} align="center" wrap="wrap">
        <Text size={0} muted textOverflow="ellipsis">
          {subtitle}
        </Text>
        {badges.filter(Boolean).map(({ text, tone }) => (
          <Badge key={text} tone={tone} fontSize={0} padding={1}>
            {text}
          </Badge>
        ))}
      </Flex>
    </Stack>
  )
}

/**
 * items: [{ key, label, link(children) -> node, body, selected, tone }]. `link` wraps the row's
 * body in whatever opens it; `label` names it for the buttons' accessible names.
 */
export function ReorderList({ items, onMove }) {
  const [drag, setDrag] = useState(null) // { from, over }

  const finish = () => setDrag(null)
  const startDrag = (index) => (event) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
    const card = event.currentTarget.closest('[data-reorder-row]')
    if (card) event.dataTransfer.setDragImage(card, 16, 16)
    // After the browser has taken its drag image: a re-render inside dragstart can cancel the drag.
    setTimeout(() => setDrag({ from: index, over: index }), 0)
  }
  const dragOver = (index) => (event) => {
    if (!drag) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (drag.over !== index) setDrag({ ...drag, over: index })
  }
  const drop = (index) => (event) => {
    event.preventDefault()
    const from = drag?.from
    finish()
    if (from != null && from !== index) onMove(from, index)
  }

  return (
    <Stack gap={1}>
      {items.map((item, index) => {
        const dragging = drag && drag.from === index
        const target = drag && drag.over === index && drag.from !== index
        // Dropping on a row puts the dragged row at that row's place: below it when moving down.
        const line = target ? (drag.from < index ? 'inset 0 -2px 0 0 var(--card-focus-ring-color)' : 'inset 0 2px 0 0 var(--card-focus-ring-color)') : undefined
        return (
          <div key={item.key} data-reorder-row onDragOver={dragOver(index)} onDrop={drop(index)} style={{ opacity: dragging ? 0.4 : 1 }}>
            <Card border radius={2} tone={item.tone || (item.selected ? 'primary' : 'default')} style={{ boxShadow: line }}>
              <Flex align="center" gap={1} padding={1}>
                <span
                  draggable
                  onDragStart={startDrag(index)}
                  onDragEnd={finish}
                  title="Drag to reorder"
                  aria-hidden="true"
                  style={{ display: 'flex', padding: 6, cursor: 'grab', fontSize: 20 }}
                >
                  <DragHandleIcon />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>{item.link(<Flex align="center" gap={3}>{item.body}</Flex>)}</div>
                <Button
                  icon={ChevronUpIcon}
                  mode="bleed"
                  padding={2}
                  title="Move up"
                  aria-label={`Move ${item.label} up`}
                  disabled={index === 0}
                  onClick={() => onMove(index, index - 1)}
                />
                <Button
                  icon={ChevronDownIcon}
                  mode="bleed"
                  padding={2}
                  title="Move down"
                  aria-label={`Move ${item.label} down`}
                  disabled={index === items.length - 1}
                  onClick={() => onMove(index, index + 1)}
                />
              </Flex>
            </Card>
          </div>
        )
      })}
    </Stack>
  )
}
