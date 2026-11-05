# Agent Note: Catalog row removal in the session header

Status: implemented

English | [中文](2026-10-20-catalog-row-removal.zh.md)

## Problem

The session-header catalog lists every direct child of a Session for the lifetime of that log. A parent that has delegated many one-shot tasks keeps all of them in its count, its switcher, and its workspace lineage, with no way to stop seeing one. The catalog is parent-owned durable state read by `list_agents`, the browser projection, and the workspace tree, so hiding a row in the Client alone would disagree with discovery, disappear on reload, and leave the count reporting children the tree no longer shows. Deleting the child Session instead destroys a record the user may still need to read.

## Decision

Removal retires a catalog identity instead of deleting anything. The browser calls `ctx.remote.subagents.retire` with `{ parentSessionId, childSessionId }`; the Host resolves the parent's live Agent, appends the version-3 `subagent/catalog` retirement record through `retireCatalogChild()`, and answers `{ retired: true }`. The [parent catalog](../architecture/2026-09-01-parent-owned-subagent-catalog.md) owns the fold and the projection, the [retirement format record](../../../../docs/persistence-changes/2026-10-19-subagent-catalog-retirement.md) owns the version-3 payload, and this change adds only a browser entry point to that catalog-owned operation.

The record names one identity and nothing else, and removal changes the parent's catalog listing only. The child's run, Session log, and Session record stay untouched and readable, the projection drops the identity from the count, the switcher, and the lineage, and a later establishing record for the same identity lists it again. Retiring an identity the catalog does not list changes no view and is accepted, so repeated and racing calls converge instead of failing, and a second removal of an already-removed row is not an error. The operation is synchronous because it appends one record to one parent Session.

The button is absent on `external` rows, which have no local Session to retire, and on the row the switcher currently displays, whose removal would answer a navigation control with a disappearance. It stays visible but disabled while that row's child runs: the retirement record is durable, so removing a running child would hide live work from the count, the switcher, and the workspace tree while it keeps running and keeps consuming. The Client therefore refuses to offer that removal, and the disabled control states the reason; the Host still accepts such a call from any other caller, because appending one durable record is not an invariant it can enforce against a presentation choice. A failed call renders a localized `role="alert"` notice above the tree in the menu body and keeps the menu open with the row and its control in place, so the catalog is never left claiming a removal that did not happen; an accepted call needs no client mutation, because the live projection frame drops the row.

## Alternatives considered

**Keep removed ids in a Client-local hidden set.** It needs no Host change, but the hiding would vanish on reload and on a second browser, disagree with `list_agents`, and leave the header count reporting children the switcher no longer offers.

**Delete the child Session.** Removal exists because the listing is too long, not because the record is unwanted; a Session delete is a separate destructive operation with its own confirmation, and the child's Session is what makes the lineage readable.

**Rewrite the catalog by removing the establishing event.** Session logs are append-only and projection state is derived from them, so rewriting history would change every earlier reader's answer and contradict the [released-format migration rule](../architecture/2026-08-31-released-session-format-migrations.md).

**Add a dedicated removal event type.** The version-3 retirement record already names one identity, so a second removal vocabulary would split retirement semantics across two folds.

**Refuse a running child in the Host.** The service's job is appending a durable record, and the run continues either way; refusing it would make one client's presentation decision a service invariant, and it would deny a caller that has deliberately decided the live row is unwanted.

## Consequences

A retired child disappears from `list_agents`, the header count, the switcher, and the workspace tree, while direct Session-id operations stay available: `send_message`, `interrupt_agent`, and task ownership do not consult the catalog, so a caller that still knows the child identity keeps its address. The child's run, Session log, and Session record stay untouched, so removal is presentation and never substitutes for stopping or deleting a member.

Retirement is not free storage-wise: the record stays in the parent log, and removing N children appends N records. It is also not a permanent exclusion, because the fold re-lists an identity as soon as a later establishing record names it. A prompt to a retired child is unaffected: continuation addresses the child through its own header lineage and never re-reads the parent catalog, so a retired child stays continuable if the caller still knows its identity.

The catalog owns the row title as well as its membership, so the [relabel record](../../../../docs/persistence-changes/2026-10-21-subagent-catalog-relabel.md) is the sibling this decision leaves room for: it replaces one listed row's label in place without touching membership, and the Sidebar chat tab titles itself from the same catalog label. A label is presentation, so no removal or relabel changes what a child is or whether it can be continued.
