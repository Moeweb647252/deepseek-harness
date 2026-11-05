/**
 * Parent-owned durable subagent catalog events and their chunked projection.
 *
 * @module @deepseek-ai/dsh-subagent/catalog
 */

import { z } from 'zod'
import { appendChunkedList, chunkedListSchema, iterateChunkedList } from '@deepseek-ai/dsh-chunked-list'
import type { ChunkedList } from '@deepseek-ai/dsh-chunked-list'
import type {
  Session,
  SessionEvent,
  SessionHeader,
  SessionId,
  SessionLogOffset,
} from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { SubagentCatalogEntry } from './projection-types.ts'

/** Catalog payload version emitted by local child creation. */
export const SUBAGENT_CATALOG_VERSION = 0

/** Catalog payload version that retires one previously listed direct child. */
export const RETIRED_SUBAGENT_CATALOG_VERSION = 3

/** Catalog payload version that replaces the display label of one listed direct child. */
export const RELABELED_SUBAGENT_CATALOG_VERSION = 4

type KnownCatalogMode =
  | { readonly mode: 'one-shot'; readonly label?: string }
  | { readonly mode: 'continuable'; readonly label: string }

/**
 * Parent catalog v0 records local modes, v1 adds unknown children, v2 records
 * external executions, v3 retires one listed identity without deleting the
 * child Session, and v4 replaces one listed identity's display label. A
 * retirement record carries only the identity it removes; a relabel record
 * carries the identity and its replacement label, and never changes the
 * child's position or mode.
 */
export type SubagentCatalogEvent =
  | (
    & {
      readonly childId: SessionId
      readonly childCreatedAt: number
    } & (
      | ({ readonly version: 0 } & KnownCatalogMode)
      | ({ readonly version: 1 } & (KnownCatalogMode | { readonly mode: 'unknown'; readonly label?: string }))
      | { readonly version: 2; readonly mode: 'external'; readonly label?: string }
    )
  )
  | {
    readonly version: typeof RETIRED_SUBAGENT_CATALOG_VERSION
    readonly childId: SessionId
    readonly mode: 'retired'
  }
  | {
    readonly version: typeof RELABELED_SUBAGENT_CATALOG_VERSION
    readonly childId: SessionId
    readonly label: string
  }

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * A direct child's identity and available discovery fields.
     * @param data - versioned parent-owned catalog entry.
     */
    'subagent/catalog': SubagentCatalogEvent
  }
}

/** Host fold state for one parent catalog. */
export interface SubagentCatalogState {
  readonly inheritedEventCount: SessionLogOffset
  readonly head?: ChunkedList<SubagentCatalogEvent> | undefined
}

const sessionIdSchema = z.string() as unknown as z.ZodType<SessionId>
const oneShotCatalogSchema = z.object({
  version: z.union([z.literal(0), z.literal(1)]),
  childId: sessionIdSchema,
  childCreatedAt: z.number().int().nonnegative(),
  mode: z.literal('one-shot'),
  label: z.string().optional(),
}).strict()
const continuableCatalogSchema = z.object({
  version: z.union([z.literal(0), z.literal(1)]),
  childId: sessionIdSchema,
  childCreatedAt: z.number().int().nonnegative(),
  mode: z.literal('continuable'),
  label: z.string(),
}).strict()
const externalCatalogSchema = oneShotCatalogSchema.extend({ version: z.literal(2), mode: z.literal('external') })
const unknownCatalogSchema = oneShotCatalogSchema.extend({ version: z.literal(1), mode: z.literal('unknown') })
const retiredCatalogSchema = z.object({
  version: z.literal(RETIRED_SUBAGENT_CATALOG_VERSION),
  childId: sessionIdSchema,
  mode: z.literal('retired'),
}).strict()
const relabeledCatalogSchema = z.object({
  version: z.literal(RELABELED_SUBAGENT_CATALOG_VERSION),
  childId: sessionIdSchema,
  label: z.string(),
}).strict()
const eventDataSchema = z.union([
  oneShotCatalogSchema,
  externalCatalogSchema,
  continuableCatalogSchema,
  unknownCatalogSchema,
  retiredCatalogSchema,
  relabeledCatalogSchema,
]) as z.ZodType<SubagentCatalogEvent>
const viewSchema = z.array(z.union([
  oneShotCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
    id: sessionIdSchema,
    createdAt: oneShotCatalogSchema.shape.childCreatedAt,
  }),
  externalCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
    id: sessionIdSchema,
    createdAt: externalCatalogSchema.shape.childCreatedAt,
  }),
  continuableCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
    id: sessionIdSchema,
    createdAt: continuableCatalogSchema.shape.childCreatedAt,
  }),
  unknownCatalogSchema.omit({ version: true, childId: true, childCreatedAt: true }).extend({
    id: sessionIdSchema,
    createdAt: unknownCatalogSchema.shape.childCreatedAt,
  }),
])) as z.ZodType<SubagentCatalogEntry[]>
const stateSchema: z.ZodType<SubagentCatalogState> = z.object({
  inheritedEventCount: z.number().int().nonnegative() as unknown as z.ZodType<SessionLogOffset>,
  head: chunkedListSchema(eventDataSchema).optional(),
}).strict()

/**
 * Materialize the current direct-child rows from parent catalog events. A
 * retirement record removes the identity it names, a relabel record replaces a
 * listed identity's label in place, and a later establishing record for the
 * same identity lists it again in catalog event order.
 * @param state - parent catalog fold state.
 * @returns current direct-child rows in parent catalog event order.
 */
function subagentCatalogEntries(state: SubagentCatalogState): SubagentCatalogEntry[] {
  const entries = new Map<SessionId, SubagentCatalogEntry>()
  for (const data of iterateChunkedList(state.head)) {
    if (data.version === RETIRED_SUBAGENT_CATALOG_VERSION) {
      entries.delete(data.childId)
      continue
    }
    if (data.version === RELABELED_SUBAGENT_CATALOG_VERSION) {
      // A relabel names an identity that an earlier record already listed; a
      // relabel for an unlisted identity changes nothing, so it cannot invent
      // a row the catalog never established.
      const listed = entries.get(data.childId)
      if (listed !== undefined) entries.set(data.childId, { ...listed, label: data.label })
      continue
    }
    const { version: _version, childId, childCreatedAt, ...descriptor } = data
    entries.set(childId, { id: childId, createdAt: childCreatedAt, ...descriptor })
  }
  return [...entries.values()]
}

/** Parent-owned direct-child catalog projection; invalid own facts reject restoration. */
export const subagentCatalogProjectionDefinition = {
  key: 'subagentCatalog',
  stateSchema,
  init: (_header: SessionHeader, inheritedEventCount: SessionLogOffset) => ({ inheritedEventCount }),
  apply: (state, event: SessionEvent) => {
    if (event.type !== 'subagent/catalog' || event.seq < state.inheritedEventCount) return state
    return { ...state, head: appendChunkedList(state.head, eventDataSchema.parse(event.data)) }
  },
  stateVersion: 8,
  wire: { viewSchema, view: subagentCatalogEntries },
} satisfies ProjectionDefinition<'subagentCatalog', SubagentCatalogState>

/**
 * Append a complete direct-child discovery fact to its parent Session.
 * @param parent - durable direct parent receiving the discovery fact.
 * @param child - established child's immutable Session metadata.
 * @param descriptor - mode-discriminated creation label frozen with the child.
 */
export function establishCatalogChild(
  parent: Session,
  child: SessionHeader,
  descriptor: { readonly mode: 'continuable'; readonly label: string },
): void {
  parent.append('subagent/catalog', {
    version: SUBAGENT_CATALOG_VERSION,
    childId: child.id,
    childCreatedAt: child.createdAt,
    mode: descriptor.mode,
    label: descriptor.label,
  })
}

/** Catalog payload version emitted by external execution creation. */
const EXTERNAL_SUBAGENT_CATALOG_VERSION = 2

/**
 * Record an external execution without a local child Session.
 * @param parent - durable direct parent receiving the discovery fact.
 * @param childId - identity returned by the external provider.
 * @param label - display label assigned by the caller.
 */
export function establishExternalCatalogChild(parent: Session, childId: SessionId, label: string): void {
  parent.append('subagent/catalog', {
    version: EXTERNAL_SUBAGENT_CATALOG_VERSION,
    childId,
    childCreatedAt: Date.now(),
    mode: 'external',
    label,
  })
}

/**
 * Retire one listed direct child from its parent's catalog. Only the catalog
 * entry disappears: the child Session stays readable through Session tooling,
 * and a later establishing record for the same identity lists it again.
 * @param parent - durable direct parent whose catalog lists the child.
 * @param childId - durable direct-child Session identity to retire.
 */
export function retireCatalogChild(parent: Session, childId: SessionId): void {
  parent.append('subagent/catalog', {
    version: RETIRED_SUBAGENT_CATALOG_VERSION,
    childId,
    mode: 'retired',
  })
}

/**
 * Replace the display label of one listed direct child. The identity keeps its
 * position, mode, and creation time; a relabel for an identity the catalog does
 * not list changes no view, which keeps a late or repeated call convergent.
 * @param parent - durable direct parent whose catalog lists the child.
 * @param childId - durable direct-child Session identity to relabel.
 * @param label - replacement display label.
 */
export function relabelCatalogChild(parent: Session, childId: SessionId, label: string): void {
  parent.append('subagent/catalog', {
    version: RELABELED_SUBAGENT_CATALOG_VERSION,
    childId,
    label,
  })
}
