# ADR 0011: Schools Are Tenants That Accounts Join Through Persons

> Superseded in part by [ADR 0037](0037-cloudflare.md) and [ADR 0036](0036-boundary.md): the hosting and framework statements of this record describe the earlier stack. Cloudflare Workers through Alchemy and the TanStack Start boundary replace them.

## Status

Accepted for the Nakafa School foundation. Amended on 13 October 2026 for the
organisation tier, the neutral concepts, the country profile above units, and
the account's home cell. Amended on 14 October 2026 for periods, cohorts,
placements, people, invites, homeroom assignments, promotions, operators, and
visits as they are built. Amended on 16 October 2026 for the rule of a removed
homeroom teacher, the write modules that own the cohort, period, and homeroom writes
that a promotion repeats, the move limit and the move check on submit, and the lease
that makes a stalled promotion run resumable.
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
claim hands the claimant the Person's standing grants, so creating an invite for
a Person that holds the Owner or Admin role needs the right to give that role,
`owner.manage` (ADR 0012). A login card never goes to such a Person (ADR 0009). A
card goes only to a Person with no account or with an account that a card made, so
an invite that claimed the Person first refuses it.

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
loses the school at once, because membership needs an active Person. Removal
keeps a homeroom row, so a removed teacher holds no slot: `assign` replaces their
row and journals `assignment.removed`, and a promotion copies no homeroom teacher
who was removed. A promotion that runs past a student's removal neither moves nor
graduates that student, who keeps the placement the removal left as history.

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

### Homeroom assignments

A homeroom teacher (wali kelas) is a teacher assigned to one cohort in one period:
a `homeroom` row of `tenantAssignments`. A cohort holds at most one, and a teacher
leads at most one cohort of a period, so each check reads one index. The teacher
must be an active Teacher of the cohort's unit, and the assignment opens that
cohort to them through the `homeroom` relation of ADR 0012. Assigning and ending
one write `assignment.created` and `assignment.removed` in the same transaction.

When `assign` refuses, the cohort is checked first: a cohort that holds an active
homeroom teacher refuses with `CohortHasHomeroom`, before a teacher who already leads
another cohort of the period is refused with `TeacherHasHomeroom`. A promotion copy
runs the same check in the same order.

A removed teacher holds no slot. Removing a Person keeps their homeroom row as the
record, and every reader of a cohort's homeroom treats that row as no homeroom
teacher. `unassign` answers `null` and keeps the row, a promotion copy skips a
removed source teacher, and the undo of a created cohort does not count the row as
a holder. The writes that need the slot replace the row first and journal
`assignment.removed`: `assign` replaces it, a promotion copy replaces it in a cohort
that holds it, and the undo of a created cohort clears it together with the cohort.
The `homeroom` relation names the active holder of the cohort (`activeHomeroomOf`), so
a removed teacher opens nothing, even if a caller of a removed Person ever reached it:
the member gate admits active Persons only.

### Promotions

A promotion moves the students of one source period into the next period of the
same unit, the kenaikan kelas of the blueprint. Its state is one of `draft`,
`submitted`, `approved`, `applied`, `opened`, or `cancelled`. The Admin plans a
`draft`: the target period, which must be planned, of the same unit, and start
after the source; a name and a grade for each new cohort; and for each source
cohort a destination, which is a cohort of the plan, `graduate`, or `stay` (the
target cohort with the same name and grade). A student may have a destination of
their own, which overrides their cohort's. A draft changes no roster row. The
Admin submits the plan, which is checked against the source period as it stands,
and every student's move is checked too: a move to a target the plan no longer has
refuses the submit with the reason `moves` (`PromotionPlanInvalid`). The principal
approves the plan (`approved`) or returns it to `draft` with a reason code. The
Admin applies an approved promotion (`applied`), and opening its target
period (`opened`) ends it. The Admin cancels a draft or a submitted promotion
(`cancelled`).

Applying runs four steps in order: archive the source period, create the target
cohorts, place each student or graduate them, and copy the homeroom teachers the
plan names. A run does one step or one page of students and schedules the next
(`tenancy/promotion/run:run`). A step that stops on a typed failure keeps that
failure, with its step and page, on the promotion, and the next apply resumes
there. A run that finds its school archived or its tenant suspended stops with
`AccessDenied`, as a public write would be refused, and resumes once the lock
lifts. Every write of a run records `movedAt`, the time it last moved. A run that
has not moved for `PROMOTION_RUN_LEASE`, two minutes, counts as stopped. Each page is
one mutation that writes `movedAt` and schedules the next page, so a live run's silence
is one page plus the scheduler's dispatch. Two minutes is a judgment, not a measurement:
it leaves room for a slow page or a late dispatch. A run silent for longer has stopped
without a failure, such as a database defect that rolled its transaction back. Apply
resumes such a run at its step and page, and undo backs it out through the paths of a
stopped apply. A run that moved within the lease is refused with `PromotionState`. Students move in pages of 100 (`PROMOTION_PAGE_SIZE`), so no run reads
or writes more than one
page of students. The cohort and homeroom steps each run once, and the 200-cohort
limit of a period bounds them.

The plan and what applying created are rows of the promotion: its targets and
sources, and the cohorts (`created`) and homeroom assignments (`copies`) that undo
removes exactly. A student's own destination is a row of `tenantPromotionMoves`.
A student whose destination is `graduate` gets a row of `tenantGraduates` (unit
and Person), and the Person document is unchanged, so `placements.place` refuses
a graduate with `PersonGraduated`. The place step refuses a Person who already
graduated from the unit the same way, so a graduate never gets a second row or a
new placement. A graduation fits only the last grade of the
unit's level: grade 6 for SD and MI, 9 for SMP and MTs, and 12 for SMA, MA, and
SMK (`LAST_GRADE`). The other levels have no last grade. A homeroom teacher is
copied only to a cohort destination, because a graduating cohort has no class to
lead.

Undo runs the steps of an applied promotion back from the last one, one step per
request, while the target period is still planned. Each undo is the inverse of its
step: the homeroom copies, the target placements and graduate rows that apply wrote
for the source students (paged), the created cohorts, and last the source period,
which becomes active again. A placement counts as written by apply when it sits in
a cohort the promotion created, and a graduate row when it names this promotion, so
a placement made by hand in another cohort of the target period stays. A created
cohort that still holds a student, a homeroom teacher, or a class is refused
(`PromotionCohortOccupied`), and the source period is refused while another period
of the unit is active (`PeriodActive`). A stopped apply can be undone: its finished
steps are undone, and a stopped place step that had written a page first walks every
page of the source period, as the place step does, and removes the placements that
apply wrote on each page. Undoing the first
step returns the promotion to `approved`, so it can be applied again. Undo is refused
once the target period is open.

Every write is journaled in the transaction that makes it: `promotion.created`,
`promotion.planned`, `promotion.studentPlanned`, `promotion.submitted`,
`promotion.returned`, `promotion.approved`, `promotion.applied`,
`promotion.undone` (with its step), `promotion.opened`, and `promotion.cancelled`,
together with `period.archived`, `cohort.created`, `person.moved`,
`person.graduated`, `assignment.created`, and `assignment.removed`.

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

Each `operators` row holds its account, its status (`active` or `revoked`), and
the times it was granted and last changed. The journal records tenant changes
only, and a platform entry has no space to live in (ADR 0016), so the row keeps
its own change times and no second audit table exists. Staff grant and revoke
access with `operators/staff:grant` and `operators/staff:revoke`, which are
internal, so only the deployment's key runs them. A revoked operator is refused
at once in every tenant: the member middleware refuses an operator Person whose
operator row is not active, and every operator command refuses the account.

Operators open tenants with `operators/tenants:open`, which runs the same Effect
as the internal `tenancy/provision:open` and journals each write under the
operator actor (ADR 0016), which a school sees as Nakafa staff. The journal
retention that the data processing agreement states is not stored yet. The
operator also suspends and reactivates a tenant, both idempotently. A suspended
tenant stays readable and refuses every write except the transitions that ADR
0012 exempts (Decisions), such as the operator's reactivation.
`operators/tenants:replaceOwner` is the audited break-glass: it refuses a
suspended school, refuses while a signed-in Owner holds the school, and otherwise
removes each unclaimed Owner
with its invite and its grant, then invites a new Owner. Its journal entries
carry the reason `break-glass`, and the ended grant the reason `replaced`.

Operators enter a tenant only through an audited visit, a temporary Auditor
grant that ends by its length of 15 to 1,440 minutes (at most 24 hours). An
operator requests a visit with a reason code (`support`, `onboarding`, or
`incident`), a note of up to 500 characters that stays out of the journal, and
a length. The school's Owner or Admin approves or declines it, through the
tenant action `visit.approve`. Approval admits the operator's Person of kind
`operator`, claimed by the operator's account with method `operator` and named
`Operator Nakafa`, and gives it the Auditor role over the whole tenant for the
length. A visit grant is always the Auditor role, so approving a visit never
mints an Admin. An operator holds at most one open visit, requested or approved,
to each tenant, and a suspended tenant refuses a request. The operator or the
school's Owner or Admin ends an approved visit at any time, and a suspended
tenant does not refuse the end (ADR 0012). A scheduled mutation ends each
approved visit at its term, and an hourly sweep ends any whose scheduled end
never ran. An operator whose account is deleted ends its approved visit as
`left`, and its Person is suspended, so no account can claim that Person again.
A request or an approval for an operator whose account is being deleted is
refused as `NotOperator`. When a school removes an operator's Person, the visit's
later end leaves the removed Person and its ended grant as they are.

The operator directory of a cell, `operators/tenants:list`, is the one public
read across tenants. It lists each tenant's name, slug, kind, status, unit count,
and the calling operator's open visit, and it reads no Person and no personal
data. Everything inside a tenant needs a visit.

### Journal

Every privileged or record-of-truth change writes one journal entry in the same
transaction as its data (ADR 0016). The tenant audit log, `journal/audit:list`,
reads the tenant's entries newest first.

### Time

Queries never read the clock. Grant expiry, invite expiry, and every other
time-driven state is written by a scheduled mutation, with a cron sweep as the
backstop for a job that never ran.

### Retirement of the first School

The first School was retired in one change, before the new School was built
(K11). That change deleted every old School row, table, function, component,
redirect, image, test, and dictionary key, together with the forum viewport
engine and the School branch of account deletion. It took no backup and no
production export, because nobody used the old School. A new ADR supersedes ADR
0005. Retired data is deleted, not kept.

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
  `by_tenantId_and_state_status`), `tenantAssignments`
  (`by_cohortId_and_kind`, `by_periodId_and_personId_and_kind`),
  `tenantPromotions` (`by_sourcePeriodId_and_state`,
  `by_targetPeriodId_and_state`), `tenantPromotionMoves`
  (`by_promotionId_and_personId`), `tenantGraduates`
  (`by_unitId_and_personId`), `tenantGrants` (ADR 0012), `journalEntries`
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
- Homeroom and promotions: `tenancy/assignments` (`assign` and `unassign`),
  `tenancy/promotion/draft` (`get`, `create`, `plan`),
  `tenancy/promotion/moves` (`setMove`, `moves`),
  `tenancy/promotion/review` (`submit`, `approve`, `returnToDraft`, `cancel`),
  `tenancy/promotion/apply` (`apply`), and `tenancy/promotion/undo` (`undo`).
  Each decides through the access lane, and the actions of each are listed in
  ADR 0012. Confect reserves `return`, so the return to draft is
  `returnToDraft`. The modules behind them live in `tenancy/promotion/`: the
  values in `schema`, `progress` (where a run starts and stops), `destination`
  and `check` (whether a plan fits its school), `row` (the stored promotion),
  `view` (its wire shape), and `find`, `schedule`, and `open`; the four steps
  are `archive`, `cohorts`, `homeroom`, and `place`, and `run` drives them.
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
  schools, the school key that ADR 0030 gives it, its first Owner as an
  unclaimed Person with the Owner role, the invite, and the journal) in one
  transaction, and starts the invitation email through `emails/invite`, since
  `emails` is the only sender. Nakafa staff run
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
- Internal: `tenancy/promotion/run:run` runs one step or one page of a promotion
  that is being applied or undone, and schedules the next run until the steps
  finish.
- Writes: each write that a promotion step repeats is owned by one module of
  `tenancy/write/`, with its rule checks and its journal record. `cohort` holds
  `checkCohorts` and `insertCohort`, which `create` of `tenancy/cohorts` and the
  cohorts step call. `assignment` holds `checkHomeroom`, `insertHomeroom`, and
  `removeHomeroom`, which `assign` and `unassign` and the homeroom step call, and
  `clearRemovedHomeroom`, which only the undo of a created cohort calls. `period`
  holds `archivePeriod`, which `archive` of `tenancy/periods` and the archive step
  call, and `reactivatePeriod`, which only the undo of the archive step calls. The
  other writes of a cohort or a period status stay in their public module, because no
  promotion step repeats them: a cohort's rename and archive and a period's opening
  (`tenancy/cohorts` and `tenancy/periods`), and the undo's delete of a created cohort
  (`tenancy/promotion/cohorts`). The folder sits outside the modules that the table
  definitions import (`tenancy/cohort`, `tenancy/assignment`, and `tenancy/period`):
  a write needs `authority.ts`, which imports the generated schema, and that schema
  imports every table, so a write placed in one of those modules would import itself
  through the table.
- The submit check of a promotion, `checkMoves` in `tenancy/promotion/check`, reads
  the moves through `by_promotionId_and_personId` a page at a time, and checks each
  move against the cohort its student is in through `placementOf`. A promotion holds
  at most `PROMOTION_MOVE_LIMIT` moves: `setMove` refuses a new one past that with
  `PromotionPlanInvalid` and the reason `moves`. So the check reads at most that many
  moves, two database calls each, about 400 of the 4,096 that one mutation may make.
- Operators and visits are built in `operators`: the tables `operators`
  (`by_userId`) and `tenantVisits` (`by_tenantId_and_operatorId_and_state_status`,
  `by_tenantId_and_state_status`, `by_state_status_and_state_expiresAt`), the
  public functions of `operators/tenants` and `operators/visits`, and the
  internal functions of `operators/staff` and `operators/expiry`. Invite expiry
  is built in `tenancy/expiry`, and the account release in `tenancy/release.ts`,
  which account deletion and removal both call. The removal of a Person is
  `tenancy/remove.ts`, which the school and the operator's replacement of an
  Owner share.
- A tenant holds at most 24 units, at most 8 Owners, and at most 16 allowed
  email domains. A period holds at most 200 cohorts, a Person holds at most 64
  placements, and a Person's invite is sent again at most 3 times in any hour.
  A promotion moves its students in pages of 100 (`PROMOTION_PAGE_SIZE`).

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
- Nothing locks the target period of an applied promotion yet, so a placement that
  someone makes by hand in one of the cohorts the promotion created meanwhile is
  removed by the undo of the place step, together with the placements apply wrote.
  A placement made by hand in any other cohort of the target period stays, because
  apply never wrote it.
- A run that stops on an error that is not a typed failure, such as a database
  defect, rolls back its transaction and leaves the promotion marked running with
  no run scheduled. A run that has not moved for `PROMOTION_RUN_LEASE` counts as
  stopped, so apply resumes it and undo backs it out, as the Promotions section
  describes. A run that moved within the lease still refuses apply and undo.

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
