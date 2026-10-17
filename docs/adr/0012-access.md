# ADR 0012: School Access Is Declared Once Per Kind And Decided In Confect Middleware

## Status

Accepted. Amended on 13 October 2026 for the homeroom and guardian relations, the
actions of the school roles, and the 24-hour limit on operator visits. Amended on
14 October 2026 for the cohort member and homeroom relations, which are live, for
the period, cohort, people, invite, assignment, and promotion actions, and for
the operator visits and their transition access, which are live. Amended the same
day for the integration client: `decide` takes the subject's tenant and judges a
client principal, and the Integration role holds the roster reads (ADR 0029).
Amended on 16 October 2026 for the `document` kind of the collaborative editor
(ADR 0028): an Admin or a Teacher whose grant covers a document's scope views and
edits it, and creating one is decided on that scope, as an integration client's
creation is. Amended on 16 October 2026 for the `exam` kind of the school exam
drafts (ADR 0031): an Admin or a Teacher whose grant covers an exam's scope views
and edits it, and creating one is decided on that scope, as a document is.

## Context

Every School function must answer who may do what to which object, the same
way for the web app, the REST API, MCP, connectors, and Nina. Schools need
tenant-wide roles (Owner, Admin), unit roles in a foundation's SD or SMA,
relationships such as a classroom's teacher or a verified guardian, and
conditions such as a suspended tenant, an archived unit, or a closed exam. The
client must never choose its own authorization scope, and a handler must never
act on an object its checks did not load.

## Decision

### Kinds are declared once

A resource kind is declared once, client-safe, in its lane's `kinds.ts` with
`Kind.make(kind, table, declaration)`: the table its subjects live in, the
relations a Person can hold to them, the `source.verb` actions evaluated on
them with their rules, and its audited change schemas with the published ones.
`Kind.extend` adds actions or changes to another lane's kind; `grant.manage`
extends both the tenant and the unit, so giving a role is evaluated on the
scope the new grant covers. Ending a grant (`grant.revoke`) is decided on the
grant itself, covered through its unit, so a grant in an archived unit can
still be ended: only the grant's own status locks it. Rules, roles, and
declarations are Effect Schemas, so a misspelled role or access mode does not
compile, and the catalog test checks that every rule names only its kind's
relations, that each action of a kind is ruled once (a later entry would
silently replace an earlier rule, such as making `owner.manage` delegable),
and that every published type is a change of its kind.

`confect/access/catalog.ts` lists every lane's kinds and extensions once and
derives the rest: `ObjectRef` (a tagged union over every kind, matched by
kind), `TenantAction`, and the tolerant `TenantCapabilities`. The journal's
entry union takes each kind's changes from `Kind.changes` (ADR 0016). `Kind.actions(entries, kind)` and
`Kind.changes(entries, kind)` join one kind's actions and changes from its
declaration and every extension, so types follow from the Schemas instead of
hand-written type aliases.

Each lane implements its kinds in its `authority.ts` with
`Authority.make(kind, Authority.load(kind), { place, relations, tenantOf })`:
how a loaded row's tenant is derived, where a row sits (at most one indexed
read), and exactly its declared relations; a missing or extra relation does
not compile. The authority is the kind's whole server interface:
`authorize(action, id)`, `check(action, row)`, `allowed(row)`,
`record(actor, row, change)` (ADR 0016), and `middleware(Subject)` for its
access spec. `Authority.make` accepts only kinds in the catalog, so a kind's
actions always include every lane's extensions.

### Enforcement

Tenant functions take the route `slug` and attach the session middleware and
`RequireMember` at group level, then the access spec of every kind they name.

- `RequireMember` resolves the tenant by slug, the caller's active Person in it,
  and the Person's active grants: three indexed reads. It provides `Member`
  (`tenant`, `person`, `grants`), the principal every check of the execution
  decides on. An unknown slug, a caller with no Person, and an inactive Person
  all get `NotMember`.
- Each object kind has its own spec, such as `PersonAccess` with
  `{ action, arg }`, where `arg` names the argument holding the subject's ID.
  It loads the subject, derives its tenant from its data, decides, and provides
  the checked row as the kind's subject service (`Person`). `TenantAccess`
  takes `{ action }` and decides on the member's tenant. A missing object and
  another tenant's object both fail `AccessDenied` with reason `resource`;
  refusals by role or condition carry those reasons. Errors join every covered
  function's client error union.
- Options are typed from the catalog, so an action of another kind does not
  compile. A handler requires exactly the services its attached middleware
  provides, so reading a subject whose spec is not attached does not compile.
  The one runtime link left is `arg`; a wrong name is a defect at the first
  call, never an access decision.
- Confect accepts a second attachment of a spec with different options and the
  inner one would shadow the first subject, so a kind middleware dies when its
  subject service is already provided. Handlers check every further object,
  including a second object of the same kind and parent IDs such as the unit a
  grant is scoped to, with the kind's `authorize(action, id)`, which reuses
  the member's grants and returns the loaded row, or `check(action, row)` for a
  row already loaded, such as the member's tenant. `allowed(row)` lists the
  caller's actions for `can`.
- Tenant isolation lives in `decide`: `check` and `allowed` take the row's
  tenant from its data and pass it with the row, and `decide` denies a subject
  of another tenant than the principal's with reason `resource`, whichever path
  loaded the row. `allowed` therefore lists no actions on such a row. `authorize`
  is a load followed by `check`, so a missing object and a foreign one get the
  same denial on every entry point.

### Decisions

For one action on one subject, decided by `decide` (an Effect program), which
reads neither the clock nor the database except through the subject's
memoized relation checks:

1. A subject of another tenant than the principal's is refused as `resource`,
   whatever its state and whoever the principal is. A client of another school
   than the subject's is refused the same way (ADR 0029).
2. A revoked integration client is refused as `condition`, on every action. A
   client is decided by its own rule and action list (ADR 0029), never by a
   Person's roles or relations.
3. A write in a suspended tenant, or on a locked subject (ended, archived, or
   closed), is refused as `condition`, even for Owners. The system transitions
   that time or an operator starts are exempt and run in a suspended tenant,
   because they end access, keep a deadline, or restore the tenant: a visit end,
   a grant expiry, an invite expiry, an account release, the close and the
   reconciliation of an attempt at its deadline (ADR 0013), the sweeps that run
   them, and the operator's reactivation of the tenant. Member writes stay
   refused. A decision
   on a late record (ADR 0013) is an action on the attempt, not on the closed
   sitting. An attempt with undecided late records is in review and not ended,
   so this rule does not refuse the decision. A removed or suspended Person, an
   archived period, and an archived cohort are locked subjects, and an archived
   school locks its periods and cohorts too. A promotion is locked once it is
   opened, and when its school is archived. A role's write to a locked subject is
   `condition` and never `role`.
4. A roles rule allows an active grant whose scope covers the subject and whose
   role is Owner or listed.
5. Otherwise the rule's relations decide, each checked at most once per
   subject.
6. Otherwise the action is refused as `role`.

A rule's `access` is `read`, `write`, or `transition`. Only a `write` is refused
by a suspended tenant or a locked subject. A `transition` ends access or restores
a tenant, so it runs in a suspended tenant, and a visit's end is one (see
Operators inside tenants). Its roles and relations decide it like any other rule.

A rule either grants by roles, where the listed roles, every Owner, and the
listed relations allow it, or by relations only, where no role can allow it, so
a guardian's consent, a student's exam answers, and private threads stay out of
every role, Owner included. A tenant-scoped grant covers every subject. A
unit-scoped grant covers subjects placed in its unit: the unit itself, objects
inside it, and Persons who hold a grant there. Tenant-level subjects, such as
the tenant and its audit log, are never covered by unit grants, so a unit
principal cannot read the tenant's audit log.

### Roles

The built-in roles are Owner, Admin, Principal, Deputy, Teacher, Counselor,
Staff, Student, Guardian, Proctor, Auditor, and Integration. They are code and
identical in every tenant; display labels live in the UI dictionary. Owner
holds every roles-granted action of every kind and is tenant-wide and standing.
Operator Nakafa is not a built-in role. Its Persons hold only visit grants (see
Operators inside tenants). The Guardian role is shown as Orang tua.

The school roles also hold these actions:

- The Teacher manages the membership of their own classes from the school roster,
  and creates no accounts. Inviting people to the school stays with the Admin.
  The Teacher releases the grades of their own tasks and exams.
- The Principal approves report cards and promotion (kenaikan kelas). The Deputy
  holds the Principal's actions, except approving report cards and promotion,
  reading the audit journal, and seeing the quota. Both see the participant
  dashboard of every exam sitting of their school and take no proctor action.
- The Admin manages the organisation settings and the AI quota. The Admin, like
  every Owner, takes every proctor action of every exam sitting of their school,
  the decision on a late record included (ADR 0013). These actions do not let a
  role read the answers, which stay with relations only.
- The Admin creates, opens, and archives the periods of the school
  (`period.manage`); creates, renames, and archives its cohorts, and places and
  moves people in them (`cohort.manage`); and creates, renames, and removes its
  people, invites them, and lists the pending invites (`person.manage`,
  `person.invite`, `invite.view`). The Principal, Deputy, Staff, and Auditor
  read the periods and cohorts of the school (`period.view`, `cohort.view`). A
  student placed in a cohort reads that cohort and its members through the
  `cohortMember` relation and nothing else. Only a student with an active
  student grant over the cohort's unit or the whole school may be placed.
- The Admin assigns and ends the homeroom teacher of a cohort (`cohort.manage`).
- The Admin prepares a promotion, sets its plan, submits it, and cancels it while
  it is a draft or submitted (`promotion.prepare`), and applies it and undoes its
  steps (`promotion.apply`). The Principal approves a submitted promotion or
  returns it to draft (`promotion.approve`). The Admin, Principal, Deputy, Staff,
  and Auditor read a promotion and its plan (`promotion.view`).
- The Staff (Staf TU) prepares report cards and school documents and views
  people's data. The Counselor (Guru BK) views people's data and insight. The
  Auditor reads the journal, the settings, and people's data, and changes
  nothing.
- The Guardian reaches a child only through a verified parent relation (see
  Relations).
- The Integration role belongs to an integration client, never to a Person. A
  client reads the periods, cohorts, and people of its school only for the
  actions its action list names, and the catalog opens only the roster reads to
  it (ADR 0029).

Assigning or ending an Owner or Admin role needs `owner.manage`, which only
Owners hold, so an Admin cannot mint Admins. The last Owner held by a claimed,
active Person cannot be revoked. Integration grants belong to integration apps,
and no person may be given one. Operator Persons hold only visit grants. A
Person holds at most 32 active grants.

Custom roles, a tenant's clones of built-in roles, add a `tenantRoles` table
and widen the stored role reference with a second member. A custom role holds
only roles-granted actions its editor already holds tenant-wide; archiving it
ends its grants.

### Relations

A relation links a Person to objects that a role does not reach. A rule can
grant an action through a relation alone, so no role can allow it. The relations
are:

| Relation | Connects | Opens | Status |
| --- | --- | --- | --- |
| Self | A person and their own data | Their own data and results | Live |
| Member | A person and an organisation | The home page and the school space | Live |
| Holder | A person and a role they hold | Their own role | Live |
| Homeroom teacher (wali kelas) | A teacher and one class group in one period, from the teacher's assignment to that class group | The cohort and its members (`cohort.view`); its report cards, attendance, and insight are not built yet | Live |
| Subject teacher | A teacher and one class | The grades, tasks, and posts of that class | Planned |
| Class member | A student and one class | The posts, tasks, and grades of that class | Planned |
| Cohort member (`cohortMember`) | A student and the cohort they are placed in, in one period (ADR 0011) | The cohort and its members (`cohort.view`); its announcements are not built yet | Live |
| Verified parent | A guardian and a student, once the parent relation is verified | The student's tasks, grades, report cards, and announcements, and the Insight narratives that the student shared and a teacher approved | Planned |
| Session proctor | A proctor and one exam sitting | Every proctor action of that sitting (ADR 0013): the token and the participant dashboard, lock and unlock, add minutes, change the token, allow a second device, close the sitting, and accept or reject a late record of an attempt in it | Planned |
| Exam author | A teacher and their exam | Changing and grading that exam, every proctor action of its sittings, and accepting or rejecting the late records of its attempts | Planned |
| Shared practice | A student and a practice the student shared | School Insight, per topic, revocable by the student | Planned |
| Visitor | An operator Person and its approved visit | Ending that visit (`visit.end`) | Live |

### Operators inside tenants

An operator enters a tenant through a visit: a temporary Auditor grant on a
Person of kind operator, active only while the grant is. A visit grant is always
the Auditor role, so no visit mints an Admin and approving one never needs
`owner.manage`. The school's Owner or Admin approves each visit, and the grant
lasts at most 24 hours. `access/temporary` gives a temporary grant with
`assignTemporaryRole`, and refuses an Owner or Admin role (`TEMPORARY_ROLE`), a
Person that is not an operator (`PERSON_KIND`), and an inactive Person. The
visit's end, by schedule, by the operator leaving, by the school ending it, or
by the operator's account being deleted, ends the grant and suspends that Person
in the same transaction, so the member middleware refuses it at once. Each end
is a `transition` (see Decisions), so a suspended tenant does not refuse it. The
grant change records the reason (`left` when the operator leaves or deletes its
account, `revoked` when the school ends it, `expired` at its term) and the visit
records the same reason (ADR 0016). An end writes a grant or a Person only while
it is active, so a Person that a removal ended stays removed.

An operator whose operator row is revoked is refused at once: the member
middleware refuses its Person, so the grant stops working whatever its term.
The grant and the Person end at the visit's own end, by its schedule or by the
hourly sweep, because a revoke would otherwise read every tenant the operator
is inside (ADR 0011, Operators). An operator Person never holds the `member`
relation and counts only the grants an operator gave for a visit.

### Wire contracts

Open vocabularies decode tolerantly on the client, because Convex deploys
before the web app and open tabs keep the previous bundle. `can` drops actions
the client does not know, audit entries decode an unknown change type or kind
as `unknown`, and `AccessDenied.action` is a plain string. Closed values, such
as role keys, scopes, statuses, and unit levels, change through expand, switch,
observe, and contract.

### Convex actions

No function attaches these middlewares to a Convex action yet, so they declare
`action: false`, once for every access spec in `Kind.spec`. The first lane that
does switches the specs it uses to
`makeByFunctionType`: actions resolve the member and decide through internal
queries that run the same code, and every write an action makes goes through an
internal mutation that resolves and decides again in its own transaction, so a
grant revoked in between stops the write.

### Extending access in a lane

1. Give the table `tenantId`, and `unitId` when the object lives in a unit.
2. Declare the kinds in the lane's `kinds.ts` (`Kind.make`, with actions,
   rules, relations, changes, and published types) and `Kind.extend` for
   actions or changes on another lane's kind; export `{ kinds, extensions }`.
3. Declare each subject service and kind spec in the lane's client-safe
   `access.ts` (`Kind.middleware(entries, kind)`).
4. Implement the authorities in the lane's `authority.ts` with
   `Authority.make(kind, Authority.load(kind), { place, relations, tenantOf })`,
   and each spec with
   `MiddlewareImpl.make(schema, Spec, authority.middleware(Subject))`.
5. Spread the lane's kinds and extensions into `access/catalog.ts`, one line
   each.
6. Provide the impl of every spec a group attaches; codegen rejects a missing
   one.
7. Write audited changes with the subject's `authority.record` in the same
   mutation (ADR 0016).
8. Test that an actor from another tenant gets `NotMember` (another slug) or
   `AccessDenied` with reason `resource` (another tenant's ID) from every public
   function, every typed failure, and the lane's rules.

The first lane that reads stored `ObjectRef`s, such as the external-reference
ledger, dispatches each reference to its kind's authority with
`ObjectRef.match`, which the compiler requires to cover every kind.

### Effect-native contracts

Every data shape here is an Effect Schema with derived types, every decision
and check is an `Effect.fn` program, and expected failures are
`Schema.TaggedError` classes whose codes and messages are constructor
defaults. The only TypeScript written by hand is the generic signatures of
`Kind` and `Authority`, which keep each kind's literal names and select one
kind's entries from the catalog, and the callback signatures of an authority's
implementation, which Schema cannot describe because they are functions.

## Invariants

Every public School function is tested so that:

- identity comes only from the session (`confect/auth/session.ts`);
- every client ID is loaded, its tenant derived from data, and the caller's
  access checked, parent IDs used in writes included;
- personal data never leaves relation scope;
- work across tenants happens only in internal functions, except the operator
  directory of tenant metadata;
- operator access happens only through audited temporary grants;
- an actor from another tenant receives `NotMember` or `AccessDenied`.

## Deviation From The Blueprint

Blueprint sections 1, 7, and 12 name one `RequireAccess` middleware with
resource options that provides an `Access` service. Revision 4 ships per-kind
specs (`PersonAccess`, later `SittingAccess` with
`{ action: "sitting.proctor", arg }`) and `TenantAccess` instead, because a
typed subject service per kind lets the compiler reject a handler that reads a
subject no check loaded.

Blueprint sections 1, 7, and 10 also derive a server registry, one authority
per kind, from the declarations. No server registry exists yet, because no
code reads a stored `ObjectRef`. Until then each kind's access spec and its
`MiddlewareImpl` are what tie a kind to its authority. The first lane that
reads stored references, such as the external-reference ledger, adds the
dispatch with `ObjectRef.match`, which the compiler requires to cover every
kind, so a declared kind without an authority fails to compile from then on.

## Rejected Alternatives

- SpiceDB or OpenFGA would move decisions out of the Convex transaction: queries
  would stop reacting to permission changes and every check would add a network
  hop, while a school's graph needs two or three indexed reads per decision.
- A static role-to-permission table, as in the first School, cannot express
  relations or conditions.
- One `RequireAccess` spec with an options union and a runtime subject accessor
  let handlers re-read subjects by argument through an accessor that died on a
  miswire; typed per-kind subjects remove that class of defect.
