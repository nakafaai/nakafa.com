# ADR 0011: Schools Are Tenants That Accounts Join Through Persons

## Status

Accepted for the Nakafa School foundation. Amended on 13 October 2026 for the
organisation tier, the neutral concepts, the country profile above units, and
the account's home cell. Amended on 14 October 2026 for periods, cohorts,
placements, people, and invites as they are built.
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
and nothing of it is migrated (see Retirement).

## Decision

### Tenants, units, and the route slug

An organisation is a tenant. It is a school or a foundation (yayasan), served by
the web project and the Convex deployment of its data cell (ADR 0026). The
tenant's `kind` is `school` or `foundation`. A foundation runs several schools,
each held as a unit (SD, SMP, SMA, and so on) with its level, an optional NPSN,
and a status. An archived unit stays readable and refuses writes.

The concepts are neutral and the same in every country: an organisation holds
units (schools), a unit runs periods and cohorts, a person belongs to the
organisation, and a section or an enrolment links people to classes. The words of
a country, such as `SD`, `Halbjahr`, or `KKTP`, are labels from that country's
signed profile (ADR 0032). They never appear in code names. The first profile is
Indonesia.

The tenant slug is the tenant's public address: the `slug.nakafa.com` label, under the domain of the tenant's data cell (ADR 0026). School addresses have no locale prefix, because the
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
every tenant host of its cell through Better Auth cross-subdomain cookies, sign-in from a
tenant host returns through the apex domain of the tenant's cell (`nakafa.com`
for `us`, ADR 0026), so the session cookie is set where that cell's hosts read
it, and tenant pages are private and
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
exists, the tenant is active, and the tenant's allowed email domains, one of its
policies, admit the address (an empty list admits every address). An invite claim
is the one place where an account is matched by its verified email, and ADR 0009
names it as the exception to its rule that a school account is never matched by
its email address. An invite expires 14 days after it is created if nobody has
claimed it, and an expired invite is never claimed: the school invites again.
Claims run in a scheduled mutation after sign-up, after Better Auth verifies an
address, and after an invite is created for an existing account, never inside
the sign-in transaction. The claim writes `person.claimed` with the claim method
(ADR 0016). An account that already holds a Person in the tenant, an address the
allowed email domains do not admit, and a suspended tenant leave the invite
pending for the school to resolve. The functions that create invites refuse an
address outside the list too: `open` and `tenancy/invites:invite` both do, so a
new tenant starts with an empty list and each invite is checked the same way.
A later channel extends the invite channel, a belajar.id match. A login card is
not an invite row, so this ADR's earlier plan of a card channel is withdrawn: an
invite names an email address and a card names none, so a card cannot be matched
to an account the way an invite is. A card is its own record, `loginCards`
(ADR 0009), and redeeming it binds the Person with the claim method `card`. A
claim hands the claimant the Person's standing grants, so creating an invite, or
printing a login card, for a Person that holds the Owner or Admin role needs the
right to give that role, `owner.manage` (ADR 0012). A card goes only to a Person
with no account or with an account that a card made, so an invite that claimed
the Person first refuses it.

Account deletion releases the account's Persons instead of deleting them: the
school controls its records, so each Person and its standing grants stay,
unclaimed. The release also revokes the Person's accepted invite, which then names
no account and can never be claimed again. A released Person is claimed again
only through a new invite or a new login card. Deletion is never blocked by
tenant ownership; an operator of the tenant's cell restores an Owner when needed.

The Admin creates, renames, and removes the Persons of a school. Removing a
Person runs in one transaction: each standing grant ends through the access
lane's revoke path (ADR 0012), each cohort placement ends unless it is history
(its period or its cohort is archived, and then it stays as the record of where
the Person was placed), the pending invite is revoked and journaled, and the
account is released as account deletion releases it, so the account can be
invited again. The journal records `person.released` only when the Person held an
account, then `person.removed`, and the status becomes `removed`. A removed
Person refuses every write as `condition` (ADR 0012), and a claimed account
loses the school at once, because membership needs an active Person.

The Admin invites a Person to an address that the school's allowed email
domains admit, and a Person has at most one pending invite. An invite waits 14
days from the moment it is written (`INVITE_TERM`). Its expiry is stored on the
invite and fixed when the invite is written, so a resend never moves it. A
scheduled mutation marks a still-pending invite `expired` at that moment and
journals `invite.expired`, and the claim path refuses an invite whose expiry has
passed even before that mutation runs. An hourly sweep (`tenancy/expiry:sweep`)
ends each due invite whose scheduled mutation never ran. An invite for a Person
whose last term
has ended expires that invite first and then writes a new one. An account that
already holds the address is claimed as `open` claims it, through the same
scheduled walk. A resend sends the same invite again to the same address, as a
new message. Each Person's resends pass a token bucket of one token that refills
three times an hour, through the existing rate limit component, so two resends
are at least twenty minutes apart and no hour holds more than three. A resend of
an invite that expired or is no longer pending is refused.

Every journal entry of this section holds IDs and reason codes only, never a
name, an address, or free text (ADR 0016).

### Periods, cohorts, and placements

A unit runs periods (a semester or a school year) and cohorts (its class groups,
which one period may hold several of). Both follow the unit's clock, and an
archived unit locks both, as it locks everything else in the unit.

A period has a name of one line, 1 to 80 characters, a `start` and an `end`
written as calendar dates `YYYY-MM-DD` on the unit's time zone, and a status:
`planned`, `active`, or `archived`. A date is read as midnight in the unit's
zone with `DateTime.makeZoned`, then formatted back with `DateTime.formatIsoDate`,
so a date the calendar does not have, such as 30 February, does not format back
to itself and is refused, and so is text that is not written that way. The
start must be before the end. A period may not share a day with another period
of its unit. The create check reads one index: among the periods of the unit,
the one that starts last on or before the new end is the only one that can
overlap, because no two periods of a unit overlap. At most one period of a unit
is `active`. A planned period opens to `active` while no other period of its
unit is active. Only an active period archives, and an archived period stays
readable and refuses writes, as does every cohort of it.

A cohort has a name of one line, 1 to 40 characters, unique within its period
without regard to case (`nameKey`, the lowercase name, is what the index
compares), a grade from 1 to 13, and a status of `active` or `archived`. A
period holds at most 200 cohorts, archived ones included, and every list of
cohorts reads at most that many. The cohort list carries no member count,
because a count would read every placement of the period.

A placement is one Person in one cohort of one period: the `cohortMember`
relation of ADR 0012. The Person must be a student: an active Student grant over
the cohort's unit or over the whole school. A Person holds at most one placement
per period, and a move keeps them in the same period. A move checks the cohort it
leaves as well as the one it enters, so an archived cohort at either end refuses
it as `condition`, and the placement stays where it was. The placement opens
`cohort.view` of its cohort to the Person, through the relation and nothing
else; the relation is
read from the placement table for each request and never copied onto the
Person. A Person holds at most 64 placements in all, across every period, and
`tenancy/placement.ts` derives that limit. Removal reads at most those
placements, and each one's period and cohort, in one transaction.

### Tenant settings

A tenant holds its settings on its own row: the country (the profile of ADR
0032), the contract currency, and its `policies`, which are whether students may
open forum threads, whether Nina is on, and the allowed email domains. Each
school holds its time zone and its content language. Provisioning writes every
field: the operator gives the country and the contract currency, and sets the
two switches. Only the allowed email domains have a default, an empty list, and
an empty list means no restriction. A tenant that sets domains keeps the claims
of its invites, and later its Google sign-in, on them (ADR 0009). An Owner or a
tenant-wide Admin changes the organisation's settings with `tenant.manage`, and
a school's Admin changes that school's with `unit.manage`. Each change of a
policy writes `tenant.policy.set`, a change type declared on the tenant kind,
because each authority accepts only the change types of its own kind (ADR 0016).
The change names the policy and holds no domain, because a change holds IDs,
enums, and reason codes only.

### Operators

Operators are Nakafa staff, listed in an `operators` table that only internal
mutations write. Every cell's deployment holds its own `operators` rows (ADR
0026). A staff member who serves two cells holds one account and one operator row
in each, and the first operator of a cell is granted through a production
operation on that cell's deployment. The onboarding role on `users` is a
learner's self-description and never grants privilege; an environment allowlist
would match emails instead of accounts and keep no history; the Better Auth admin
plugin would move platform privilege into the auth component's schema.

Operators provision tenants (the tenant with the journal retention that its data
processing agreement states, its settings, its units, and the first Owner
invite in one mutation), replace a tenant's unclaimed Owners as an audited
break-glass, and suspend or reactivate a tenant. A suspended tenant stays
readable and refuses every member write. The system transitions that time or
an operator starts still run in it, because they end access, keep a deadline, or
restore the tenant: a visit end, a grant expiry, an invite expiry, an account
release, the close and the reconciliation of an attempt, and the operator's
reactivation of the tenant (ADR 0012, Decisions). Operators enter a tenant only
through an audited visit: a temporary Auditor grant of at most 24 hours. A visit
grant is always the Auditor role, so approving a visit never mints an Admin. The
school's Owner or Admin approves each visit, and a scheduled mutation ends the
grant (ADR 0012). The operator directory of a cell, tenant metadata with no
personal data, lists only the tenants of that cell and is the one public read
across them; everything inside a tenant needs a visit.

### Journal

Every privileged or record-of-truth change writes one journal entry in the same
transaction as its data (ADR 0016). The tenant audit log, `journal/audit:list`,
reads the tenant's entries newest first.

### Time

Queries never read the clock. Grant expiry, invite expiry, and every other
time-driven state is written by a scheduled mutation, with a cron sweep as the
backstop for a job that never ran.

### Retirement of the first School

Program wave 0 deletes the first School before the new School is built (K11).
The deletion removes every old School row, table, function, component, redirect,
image, test, and dictionary key, together with the forum viewport engine and its
tests and the School branch of account deletion. It takes no backup and no
production export, because nobody uses the old School, and its data is deleted,
not kept (K11). A new ADR supersedes ADR 0005.

The removal follows the rule for public functions in
`packages/backend/AGENTS.md`: expand, switch, observe, contract. Expand is done:
the tenancy functions in `packages/backend/confect/tenancy` already exist on main
beside the old School. Four steps followed, in this order, and all four are done:

1. Switch (merged in #1051): a release makes the web stop calling the old
   functions. It removes every School route and component that calls an old
   function, so no new web build calls one. The old functions stay.
2. Observe: after the switch release is live, production function logs show
   no call to an old School function for at least 12 hours (the Vercel skew
   window, `skewProtectionMaxAge` 43,200 seconds, read from the project API on
   12 October 2026) and across at least one later production deploy, because a
   loaded or suspended tab calls Convex directly and every deploy re-runs every
   live subscription. Measured before the switch on 13 October 2026: 2,790
   production executions between 12:57 and 14:42 UTC, spanning the deploy at
   14:36, held no call to `schools/*`, `classes/*` or the School triggers.
   Measured after it: 23,655 production executions between 18:21 UTC on 13
   October and 07:24 UTC on 14 October, spanning the deploys of #1058, #1026,
   #1049, #1042, #1054, #1046 and #1031, held none either. This step ships
   nothing.
3. Contract (merged in #1037): one release removes the old functions, every writer of the old
   tables, and the rest of the code listed above, and adds the batched erase
   migration in the same release. It keeps the definitions of the 16 old tables
   (the 15 `school*` tables and `accountDeletionSchoolTransfers`), because Convex
   refuses a schema that drops a table while a row still holds it. The internal
   migration `retire/school:erase` deletes every row of those tables, every stored
   file their rows name, every scheduled job that would publish a class material,
   and every forum post from the two forum aggregates, and it clears the school
   fields of `accountDeletionPreparations` and the `schoolId` of `subscriptions`,
   which the Polar webhook no longer writes. The `metadata` of a subscription is
   Polar's copy and stays whole. The migration runs dry first, which counts the
   old rows, and then for real, on dev and on production, page by page, until a
   dry pass reports zero. Run on 14 October 2026: on dev a dry pass counted
   nothing; on production a dry pass counted 26 rows in 13 tables and no file
   or scheduled job, the real pass removed the 26, and a dry pass after it
   counted 0.
4. Drop (the release after #1037): a last release deletes the tables, those fields, the two forum
   aggregates of `convex.config.ts`, and the migration. Convex accepts that schema
   only when no row is left, which is the proof that the rows are gone. The
   emptied tables and the two unmounted aggregates stay on each deployment until
   they are deleted in the Convex dashboard.

## Implementation Contract

- Tables: `tenants` (`by_slug`), `tenantUnits` (`by_tenantId_and_status`),
  `tenantPeriods` (`by_unitId_and_start`, `by_unitId_and_status`),
  `tenantCohorts` (`by_periodId_and_nameKey`,
  `by_periodId_and_grade_and_nameKey`), `tenantCohortMembers`
  (`by_periodId_and_personId`, `by_cohortId_and_personId`, `by_personId`),
  `tenantPeople` (`by_tenantId_and_account_userId`, `by_tenantId_and_status`,
  `by_account_userId_and_kind_and_status`), `tenantInvites`
  (`by_channel_email_and_state_status`, `by_personId_and_state_status`,
  `by_state_status_and_expiresAt` for the expiry sweep,
  `by_tenantId_and_state_status`), `tenantGrants` (ADR 0012), `journalEntries`
  (ADR 0016), and the school login and login card tables of ADR 0009,
  `schoolLogins` (`by_personId`, `by_tenantId_and_name`) and `loginCards`
  (`by_codeHash`, `by_personId`).
- Public: `tenancy/profile:get`, `tenancy/viewer:get` (the School shell for one
  slug: the tenant with its settings, its units with theirs, archived units
  last, the caller's Person and grants, and the tenant capabilities `can`),
  `tenancy/memberships:list` (the caller's own active member Persons, identity
  scoped), `journal/audit:list`, and the grant functions of ADR 0012. The
  period, cohort, placement, people, and invite functions are the groups
  `tenancy/periods` (`list`, `create`, `open`, `archive`), `tenancy/cohorts`
  (`list`, `members`, `create`, `rename`, `archive`), `tenancy/placements`
  (`place`, `move`), `tenancy/people` (`list`, `create`, `rename`, `remove`),
  and `tenancy/invites` (`list`, `invite`, `revoke`, `resend`). Each decides
  through the access lane, and each returns the row its list shows.
- Settings, public mutations that answer with the value now stored and that
  write and record nothing for a value already stored: `tenancy/settings`
  (`setLocale` for the country and the contract currency, `setPolicy` for one
  policy) and `tenancy/units` (`setLocale` for a school's time zone and content
  language, `archive`, and `unarchive`). Organisation settings, archiving, and
  restoring are `tenant.manage`, held by Owners and tenant-wide Admins. A
  school's own settings are `unit.manage`, so an Admin of one school changes
  that school only and an archived school refuses them. Restoring is decided on
  the tenant because an archived school refuses every write.
- Internal: `tenancy/provision:open` opens an organisation (the tenant, its
  schools, its first Owner as an unclaimed Person with the Owner role, the
  invite, and the journal) in one transaction, and starts the invitation email
  through `emails/invite`, since `emails` is the only sender. Nakafa staff run
  it with the deployment's key. `tenancy/claims:run` claims the pending invites of one
  account whose address Better Auth has verified and the tenant admits, a page
  at a time. It is scheduled by the Better Auth user triggers after sign-up and
  after verification, only when an invite waits for the address, and for an
  account that already holds the address of a new invite by
  `tenancy/holders:schedule`, which `open` starts and which pages through those
  accounts, so no number of them is assumed.
- The organisation holds `country`, `currency`, and `policies` (students may
  open threads, Nina, and the allowed email domains; an empty list admits every
  address, and a claim checks a longer one), and each unit holds `timeZone` and
  `contentLanguage`. They are required fields, because no code wrote a tenant
  before this change. Nina and student threads are stored until the School
  features they switch exist. The country is checked for its shape only, two
  uppercase letters: ADR 0032 moves the countries Nakafa serves to the signed
  country profile, so no list of countries is kept in code. A tenant's, a
  school's, and a Person's name are one line: names fill list rows, and the
  tenant's name goes in the subject of its invitation email. `tenant.provisioned`
  records the contract (plan, modules, data processing agreement version, and
  content licence version); the entitlements it grants are built later.
- Scheduled: `tenancy/expiry:invite`, one run for the moment each invite stores
  as its expiry. It is internal, and it marks a still-pending invite expired.
  `tenancy/expiry:sweep` runs every hour as the backstop for a run that never
  happened: it expires each pending invite whose expiry has passed.
- Operators, visits, and grant expiry follow as one change that extends this
  contract. Invite expiry is built in `tenancy/expiry`, and the account release
  in `tenancy/release.ts`, which account deletion and removal both call.
- A tenant holds at most 24 units, at most 8 Owners, and at most 16 allowed
  email domains. A period holds at most 200 cohorts, a Person holds at most 64
  placements, and a Person's invite is sent again at most 3 times in any hour.

## Consequences

- One account reaches every school of its home cell that it belongs to with one
  sign-in, and the consumer product lives in the `us` cell. A school in another
  cell is joined with an account of that cell (ADR 0026, Data cells).
- An invite address works like a credential: whoever holds a verified account
  with that address claims the Person, an Owner invite included, until the
  invite expires after 14 days. Schools invite only addresses they or the
  invitee control. A tenant that sets allowed email domains keeps the claims of
  its invites, and later its Google sign-in, on them, and a tenant with an empty
  list has no domain restriction.
- A tenant whose only Owner deleted their account has no Owner until an operator
  of its cell replaces it.

## Rejected Alternatives

- The Better Auth organization plugin would move tenancy into the auth
  component's schema and its role model.
- Client-supplied tenant IDs would make the client choose its authorization
  scope.
- A deployment per tenant would multiply cost and split one account across
  schools.
- Accepting every invite by hand, for example with an emailed one-time code,
  would add a step before each invited teacher, student, and parent reaches
  their school; automatic matching of verified addresses, limited to the
  tenant's allowed email domains when it sets any, keeps joining a school to one
  sign-in.
