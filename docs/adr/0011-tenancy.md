# ADR 0011: Schools Are Tenants That Accounts Join Through Persons

## Status

Accepted for the Nakafa School foundation. Amended on 13 October 2026 for the
organisation tier, the neutral concepts, and the country profile above units.
The school subdomains and their URL tree are in ADR 0026, and the country
profile is in ADR 0032.

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

An organisation is a tenant. It is a school or a foundation (yayasan), served by
the same web and Convex deployments as every other tenant. The tenant's `kind` is
`school` or `foundation`. A foundation runs several schools, each held as a unit
(SD, SMP, SMA, and so on) with its level, an optional NPSN, and a status. An
archived unit stays readable and refuses writes.

The concepts are neutral and the same in every country: an organisation holds
units (schools), a unit runs periods and cohorts, a person belongs to the
organisation, and a section or an enrolment links people to classes. The words of
a country, such as `SD`, `Halbjahr`, or `KKTP`, are labels from that country's
signed profile (ADR 0032). They never appear in code names. The first profile is
Indonesia.

The tenant slug is the tenant's public address: the `slug.nakafa.com` label. School addresses have no locale prefix, because the
language comes from the `NEXT_LOCALE` cookie (ADR 0026). It is the context every tenant
function receives, never an authorization claim. The member middleware resolves
the tenant and the caller's Person from it; objects named by ID derive their
tenant from data (ADR 0012). Every tenant-owned table carries `tenantId`.

`confect/tenancy/slug.ts` is the single source of slug rules. `TenantSlug` is
the stored brand: one DNS label of 2 to 63 lowercase letters and digits with
single inner hyphens, so never `xn--`. It holds only rules that never change,
because Confect decodes stored documents and a stricter brand would make
existing tenants unreadable. `reservedSlugs`, an Effect `HashSet`, lists
labels that never name a tenant: every live `*.nakafa.com` host, product and account words, the
application locales, and static segments under `/[locale]/school`, which the old School retires (K11,
ADR 0026).
`NewTenantSlug` is a `TenantSlug` outside that set: what operators may give a
new tenant and what the proxy routes. A new host or School route segment is
added to `reservedSlugs` first.

`tenancy/profile:get` is the tenant's public identity (slug, name, kind,
status) for the sign-in page and the not-found page; it reads no identity and
returns only those fields.

### Subdomains

Planned. ADR 0026 lists what is live.

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
account that controls the address: an invite is claimed automatically when an
account whose Better Auth email is verified and equal to the invite address
exists. Claims run in a scheduled mutation after sign-up, after Better Auth
verifies an address, and after an invite is created for an existing account,
never inside the sign-in transaction. An account that already holds a Person in
the tenant leaves the invite pending for the school to resolve. A tenant's
allowed email domains, one of its policies, limit the addresses its invites may
name. Later channels (belajar.id matches and login card codes) extend the invite
channel and claim method values.

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
temporary admin or auditor grant of at most 24 hours. The school's Owner or Admin
approves each visit, and a scheduled mutation ends the grant (ADR 0012). The
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

Program wave 0 deletes the first School before the new School is built (K11).
The deletion is one reviewed change: every old School row, table, function,
component, redirect, image, test, and dictionary key goes, and so do the forum
viewport engine and its tests and the School branch of account deletion. It
takes no backup and no production export, because nobody uses the old School,
and its data is deleted, not kept (K11). A new ADR supersedes ADR 0005.

The removal follows the rule for public functions in
`packages/backend/AGENTS.md`: expand, switch, observe, contract.

1. Expand: the tenancy functions in `packages/backend/confect/tenancy` already
   exist on main beside the old School.
2. Switch: an earlier release removes every School route and component that
   calls an old function, so no new web build calls one.
3. Observe: after the switch release is live, production function logs show
   no call to an old School function for at least 12 hours (the Vercel skew
   window, `skewProtectionMaxAge` 43,200 seconds, read from the project API on
   12 October 2026) and across at least one later production deploy, because a
   loaded or suspended tab calls Convex directly and every deploy re-runs every
   live subscription. Measured before the switch on 13 October 2026: 2,790
   production executions between 12:57 and 14:42 UTC, spanning the deploy at
   14:36, held no call to `schools/*`, `classes/*` or the School triggers. The
   switch release deletes the web routes and components only; the old functions
   stay until this window has passed.
4. Dry run: the batched deletion's dry mode counts the old rows on dev before
   the contract release.
5. Contract: one reviewed release deletes the old functions, every writer of the
   old tables, and the rest of the code listed above, and adds the batched
   deletion. The deletion then runs on dev and production until every old count
   is zero, and a last release drops the tables and the deletion; Convex accepts
   that schema only when no row is left, which is the proof that the rows are
   gone.

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
- An invite address works like a credential: whoever holds a verified account
  with that address claims the Person, an Owner invite included. Schools invite
  only addresses they or the invitee control, and a tenant's allowed email
  domains keep its invites on the school's own domains.
- A tenant whose only Owner deleted their account has no Owner until an
  operator replaces it.

## Rejected Alternatives

- The Better Auth organization plugin would move tenancy into the auth
  component's schema and its role model.
- Client-supplied tenant IDs would make the client choose its authorization
  scope.
- A deployment per tenant would multiply cost and split one account across
  schools.
- Accepting every invite by hand, for example with an emailed one-time code,
  would add a step before each invited teacher, student, and parent reaches
  their school; automatic matching of verified addresses, limited by the
  tenant's allowed email domains, keeps joining a school to one sign-in.
