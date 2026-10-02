# ADR 0016: One Journal Records Audited Changes For Every Data Space

## Status

Accepted.

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
space, a Person in a tenant, or scheduled work), its subject (an `ObjectRef`),
and its change. `record` (`confect/journal/record.ts`) inserts it in the
caller's transaction, so a failed or retried mutation leaves no entry. It only
inserts: no reads, counters, or sequence documents, so concurrent mutations
never conflict on the journal.

`record` takes the subject as the loaded row, usually the one its kind's access
middleware provided, and derives the entry's reference and owner from it
through the kind's authority. No caller passes an owner, so an entry is filed
only under its subject's space. The subject's kind fixes the allowed change
types at compile time.

### What is recorded

Privileged and record-of-truth changes: access, membership, claims, grades,
releases, documents, deletions, connector work, and every operator action.
High-frequency learner writes (answers, reactions, read state, presence,
drafts) are their own record and are not journaled per write. Change details
hold IDs, enums, and reason codes only, never names, emails, or free text, so
an entry never outlives the personal data it mentions.

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

Tenant entries are kept for the tenant's retention period. The retention and
offboarding policy removes expired entries with a bounded scheduled sweep over
the owner index in creation order that never passes the oldest live consumer
cursor, and offboarding exports them with proof. Personal entries leave with
the account: the first personal writer adds the owner index on accounts and the
account deletion drain. Account deletion leaves tenant entries alone, because
they hold Person IDs, not personal data. Nothing else deletes journal rows.

## Implementation Contract

- `journalEntries` (`by_owner_tenantId`); `record`; `journal/audit:list`, the
  tenant audit log for `audit.view`, newest first, at most 100 entries a page.
- Wire views `ChangeView` and `SubjectView` decode a change type or kind added
  after a client was built as `unknown`.

## Consequences

- One write per audited change, in the same transaction as the data.
- A change type a lane adds is one line in its kind's declaration and reaches
  the audit log and every consumer without another table.
- The audit log names actors and Person subjects; account identities never
  reach a school.

## Rejected Alternatives

- An audit table plus an outbox copy of published changes would write twice
  and need two retention policies.
- A caller-supplied owner would let a function that handled two tenants file an
  entry under the wrong one.
- Per-feature audit tables (connector audits, tenant audits) would each need
  their own readers, exports, and deletion steps.
