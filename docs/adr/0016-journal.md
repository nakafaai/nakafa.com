# ADR 0016: One Journal Records Audited Changes For Every Data Space

## Status

Accepted. Amended on 13 October 2026: forum posts are not journaled per message,
and journal retention is set per organisation.

## Context

Schools need an audit log of privileged changes, connectors need a record of
what they did in a personal account, and notifications, webhooks, MCP, and
exports need a feed of changes to react to. Separate audit, outbox, and
connector audit tables would copy the same facts, let them drift, and each need
their own retention.

## Decision

### One table, one writer

`journalEntries` holds one immutable entry per audited change: its owner (a
`Space`, one account or one tenant), its actor (an account in its personal
space; in a tenant, a Person, an operator, or scheduled work), its subject (an
`ObjectRef`), and its change. A tenant entry takes only a `TenantActor`: a
Person, an operator, or scheduled work. The operator actor holds the internal
operator ID of Nakafa staff who act outside a visit, such as to provision or
suspend a tenant or to replace an unclaimed Owner as break-glass, and the
school's audit view shows it as Nakafa staff. Tenant grants record who gave them
the same way, so no tenant actor is an account. The subject kind's authority
writes it with `record(actor, row, change)` (ADR 0012) in the caller's
transaction, so a failed or retried mutation leaves no entry. It only inserts:
no reads, counters, or sequence documents, so concurrent mutations never
conflict on the journal.

`record` takes the subject as the loaded row, usually the one its kind's access
middleware provided, and derives the entry's reference and owner from it. No
caller passes an owner, so an entry is filed only under its subject's space.
Each kind's authority accepts only that kind's change types, so a change of
another kind does not compile.

### What is recorded

Privileged and record-of-truth changes: access, membership, claims, grades,
releases, documents, deletions, connector work, and every operator action.
High-frequency learner writes (answers, reactions, read state, presence,
drafts) are their own record and are not journaled per write. Forum posts are
not journaled per message either. A policy change, such as whether students may
open forum threads, is journaled as `tenant.policy.set`, a change type declared
on the tenant kind (ADR 0011). Change details hold IDs, enums, and reason codes
only, never names, emails, or free text, so an entry never outlives the personal
data it mentions.

Two changes carry more than a type. A claim, `person.claimed`, holds the claim
method and the claiming account, the one account ID that a tenant entry holds.
The school's audit view shows the Person and the method and never the account,
because account identities never reach a school. A grant that ends,
`grant.ended`, holds why it ended. For a visit grant the reasons are `left`,
`expired`, `revoked by the school`, and `operator removed`.

### Object references

`ObjectRef` (`{ kind, id }`) is derived from every declared kind, personal and
tenant (ADR 0012). Journal subjects, attachments, links, notifications,
evidence, and the external-reference ledger store the same union, so no stored
reference migrates when a kind is added. Reading a stored reference checks
permission through its kind. Adding a kind extends the union losslessly;
removing a kind that rows reference is a stored-data migration.

### Consumers

Consumers read published change types from the journal itself; there is no
outbox copy and no dispatcher. A kind's declaration lists which of its change
types are published. The first consumer adds an index on the owner and change
type, reads in creation order with its own cursor per subscription, re-checks
permission when it loads the subject, and proves its ordering assumption on
Convex before relying on a creation-time cursor.

### Retention

Tenant entries are kept for the journal retention of their organisation. The
retention is one period for each data type (owner decision K10), and for the
journal it is one period for each organisation: the one that its data processing
agreement states, stored on the tenant at provisioning (ADR 0011). An entry is
not deleted before that period ends. A bounded scheduled sweep over the owner
index in creation order removes expired entries, and it never passes the oldest
live consumer cursor. Offboarding is the end of the organisation's data
processing agreement. It exports the organisation's entries with proof, and then
they are deleted with its other data.

Personal entries leave with the account: the first personal writer adds the
owner index on accounts and the account deletion drain.

Account deletion leaves tenant entries alone. A tenant entry holds Person IDs and
no name, and each ID points at a Person row, which holds personal data, in the
same deployment. The IDs never outlive that data: offboarding deletes the entries
with the organisation's other data, and a move to another cell carries the
entries to the target cell and deletes the source entries with the source rows
(ADR 0026). Retention, offboarding, and a move are the only things that delete
tenant entries.

## Implementation Contract

- `journalEntries` (`by_owner_tenantId`); each authority's `record`;
  `journal/audit:list`, the tenant audit log for `audit.view`, newest first,
  at most 100 entries a page, with each Person named on a page read once and
  all of them read concurrently.
- Wire views `ChangeView` and `SubjectView` decode a change type or kind added
  after a client was built as `unknown`.

## Consequences

- One write per audited change, in the same transaction as the data.
- A change type a lane adds is one line in its kind's declaration and reaches
  the audit log and every consumer without another table.
- The audit log names Person actors and Person subjects and shows an operator as
  Nakafa staff; account identities never reach a school.

## Rejected Alternatives

- An audit table plus an outbox copy of published changes would write twice
  and need two retention policies.
- A caller-supplied owner would let a function that handled two tenants file an
  entry under the wrong one.
- Per-feature audit tables (connector audits, tenant audits) would each need
  their own readers, exports, and deletion steps.
