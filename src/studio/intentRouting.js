// Which pane opens a document asked for by an intent link (SQ-143, Nathan 11-24).
//
// A Set page links each member with <IntentLink intent="edit" params={{ id, type: 'mediaAsset' }}>
// (SetFormInput.jsx). The structure tool hands that intent to the first pane in the tree whose
// canHandleIntent says yes, and the opened document takes THAT pane's schema type. The orderable
// list behind "Featured Projects (drag to order)" ships canHandleIntent(() => true), so it claimed
// every intent for every type and a set member opened with the Project form. Pure: no Sanity
// imports, so node --test can load it.

/** An intent checker that only claims edit/create intents for documents of `typeName`. */
export const typeOnlyIntent = (typeName) => (intent, params) =>
  (intent === 'edit' || intent === 'create') && params?.type === typeName

/**
 * The schema type a document opened by an intent gets, given the structure's panes in the order
 * the resolver visits them ({ schemaType, canHandleIntent }). The first pane that claims the
 * intent opens it with its own schema type; when none does, the fallback editor uses params.type.
 */
export function intentSchemaType(panes, intent, params) {
  const claim = panes.find((pane) => pane.canHandleIntent?.(intent, params))
  return claim ? claim.schemaType : params.type
}
