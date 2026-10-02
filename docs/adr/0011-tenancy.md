# ADR 0011: Schools Are Tenants That Accounts Join Through Persons

## Status

Accepted for the Nakafa School foundation.

## Context

Nakafa School is the institution layer over the same platform: one account,
one content source, one assessment engine, and one Nina for learners and their
schools. A foundation (yayasan) often runs several schools, such as an SD, an
SMP, and an SMA, and a parent with children in two of them should need one
account. Schools control their students' data; Nakafa processes it for them.

The first School let any signed-in user create a school through a public
mutation, mapped roles to permissions in one static table, and kept member
counters on the school document that every member action rewrote. It is retired
without migration (see Retirement).

## Decision

### Tenants, units, and the route slug

A tenant is one organisation, a school or a foundation, served by the same web
and Convex deployments as every other tenant. It holds one or more units (SD,
SMP, SMA, and so on), each with its level, an optional NPSN, and a status; an
archived unit stays readable and refuses writes.

The tenant slug is the tenant's public address: the `slug.nakafa.com` label and
the `/[locale]/school/[slug]` route segment. It is the context every tenant
function receives, never an authorization claim. The member middleware resolves
the tenant and the caller's Person from it; objects named by ID derive their
tenant from data (ADR 0012). Every tenant-owned table carries `tenantId`.

`confect/tenancy/slug.ts` is the single source of slug rules. `TenantSlug` is
the stored brand: one DNS label of 2 to 63 lowercase letters and digits with
single inner hyphens, so never `xn--`. It holds only rules that never change,
because Confect decodes stored documents and a stricter brand would make
existing tenants unreadable. `reservedSlugs` lists labels that never name a
tenant: every live `*.nakafa.com` host, product and account words, the
application locales, and static segments under `/[locale]/school`.
`NewTenantSlug` is a `TenantSlug` outside that set: what operators may give a
new tenant and what the proxy routes. A new host or School route segment is
added to `reservedSlugs` first.

`tenancy/profile:get` is the tenant's public identity (slug, name, kind,
status) for the sign-in page and the not-found page; it reads no identity and
returns only those fields.

### Subdomains

`slug.nakafa.com` serves the School routes through a host rewrite in the proxy,
which never reads the database and routes only labels that are a valid
`TenantSlug` outside `reservedSlugs`. Unknown tenants render the School
not-found page from `tenancy/profile:get`. One sign-in covers nakafa.com and
every tenant host through Better Auth cross-subdomain cookies, sign-in from a
tenant host returns through nakafa.com, and tenant pages are private and
noindex. Schools' own domains come later through a domain map and a one-time
token handoff. The subdomain change records its configuration facts here.

### Persons and claims

A Person is someone in one tenant, separate from a User. A Person can exist
before any account, for example a student imported from a roster, and an
account claims it later. An account holds at most one Person per tenant, and a
Person is claimed by at most one account.

A Person document holds identity fields only: name, kind, status, and account.
Roster details such as national IDs and birth dates live in their own tables
under their own actions, because every School function loads the caller's
Person and any change reruns that caller's subscriptions. Persons of kind
`operator` exist only for audited Nakafa staff visits.

An invite names a Person and an email address. A claim binds the Person to the
account that controls the address and accepts the invite. Claims are automatic
only for verified Gmail addresses: Google never reassigns or renames a Gmail
address, so Google's verified flag proves the holder controls the mailbox now.
For any other address the flag only says the address was verified once;
Workspace administrators reissue addresses, other providers recycle them, and
the stored account email never refreshes. Those invites stay pending until the
invitee accepts with proof of current control, such as an emailed one-time
code. Claims run in a scheduled mutation after sign-up, after Better Auth
verifies an address, and after an invite is created for an existing account,
never inside the sign-in transaction. Later channels (belajar.id matches and
login card codes) extend the invite channel and claim method values.

Account deletion releases the account's Persons instead of deleting them: the
school controls its records, so each Person and its standing grants stay,
unclaimed. Deletion is never blocked by tenant ownership; an operator restores
an Owner when needed.

### Operators

Operators are Nakafa staff, listed in an `operators` table that only internal
mutations write; the first operator is granted through a production operation.
The onboarding role on `users` is a learner's self-description and never grants
privilege; an environment allowlist would match emails instead of accounts and
keep no history; the Better Auth admin plugin would move platform privilege into
the auth component's schema.

Operators provision tenants (the tenant, its units, and the first Owner invite
in one mutation), replace a tenant's unclaimed Owners as an audited break-glass,
and suspend or reactivate a tenant. A suspended tenant stays readable and
refuses every write. Operators enter a tenant only through an audited visit: a
temporary admin or auditor grant that a scheduled mutation ends (ADR 0012). The
operator directory, tenant metadata with no personal data, is the one public
read across tenants; everything inside a tenant needs a visit.

### Journal

Every privileged or record-of-truth change writes one journal entry in the same
transaction as its data (ADR 0016). The tenant audit log, `journal/audit:list`,
reads the tenant's entries newest first.

### Time

Queries never read the clock. Grant expiry and every other time-driven state is
written by a scheduled mutation, with a cron sweep as the backstop for a job
that never ran.

### Retirement of the first School

New tables and functions live beside the `school*` tables (expand). School
routes then switch to the new functions; the old ones are observed until no
deployed client calls them. A Convex backup of production is taken right before
deletion, then an internal batched mutation deletes every `school*` row, the
forum aggregates, and their files, on dev and then production, until the counts
are zero. Last, the old functions, tables, the forum viewport engine and its
tests, and the old account deletion steps are removed, and a new ADR supersedes
ADR 0005. The classroom lane owns the retirement.

## Implementation Contract

- Tables: `tenants` (`by_slug`), `tenantUnits` (`by_tenantId_and_status`),
  `tenantPeople` (`by_tenantId_and_account_userId`,
  `by_account_userId_and_kind_and_status`), `tenantInvites`
  (`by_channel_email_and_state_status`, `by_personId_and_state_status`),
  `tenantGrants` (ADR 0012), and `journalEntries` (ADR 0016).
- Public: `tenancy/profile:get`, `tenancy/viewer:get` (the School shell for one
  slug: tenant, active units, the caller's Person and grants, and the tenant
  capabilities `can`), `tenancy/memberships:list` (the caller's own active
  member Persons, identity scoped), `journal/audit:list`, and the grant
  functions of ADR 0012.
- Operators, provisioning, claims, visits, grant expiry, and the account
  deletion release step follow as one change that extends this contract.
- A tenant holds at most 24 units and at most 8 Owners.

## Consequences

- One account reaches every school it belongs to and the consumer product with
  one sign-in.
- Schools whose staff use non-Gmail addresses wait for acceptance by emailed
  code before their invites are claimed.
- A tenant whose only Owner deleted their account has no Owner until an
  operator replaces it.

## Rejected Alternatives

- The Better Auth organization plugin would move tenancy into the auth
  component's schema and its role model.
- Client-supplied tenant IDs would make the client choose its authorization
  scope.
- A deployment per tenant would multiply cost and split one account across
  schools.
- Automatic claims for every verified email would hand a school, including its
  Owner role, to whoever holds a stale or recycled address.
