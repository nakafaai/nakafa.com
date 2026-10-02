# ADR 0012: School Access Is Declared Once Per Kind And Decided In Confect Middleware

## Status

Accepted.

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
`Kind.root` (the tenant itself) or `Kind.object`: its table, its relations, the
`source.verb` actions evaluated on its subjects with their rules, and its
audited change schemas with the published ones. `Kind.extend` adds actions or
changes to another lane's kind; `grant.manage` extends both the tenant and the
unit, so it is evaluated on the scope a grant covers.

`confect/access/catalog.ts` lists every lane once and derives the rest:
`ObjectRef`, the per-kind `ActionOf`, `SubjectOf`, `IdOf`, and `ChangeOf`
types, `TenantAction` and the tolerant `TenantCapabilities`, and the journal's
`Change` and `Published` (ADR 0016). `confect/access/registry.ts` maps every
kind to its server authority, typed so a kind without an authority does not
compile. `Authority.make` takes a kind's declaration and implements it: how its
tenant is derived from a row, where a row sits (at most one indexed read), and
exactly its declared relations; a missing or extra relation does not compile.

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
  grant is scoped to, with `authorize(kind, action, id)`, which reuses the
  member's grants and returns the loaded row. `allowed(kind, row)` lists the
  caller's actions for `can`.

### Decisions

For one action on one subject, decided by `decide`, which reads neither the
clock nor the database:

1. A write in a suspended tenant, or on a locked subject (ended, archived, or
   closed), is refused as `condition`, even for Owners.
2. A roles rule allows an active grant whose scope covers the subject and whose
   role is Owner or listed.
3. Otherwise the rule's relations decide, each checked at most once per
   subject.
4. Otherwise the action is refused as `role`.

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
Assigning or ending an Owner or Admin role needs `owner.manage`, which only
Owners hold, so an Admin cannot mint Admins. The last Owner held by a claimed,
active Person cannot be revoked. Integration grants belong to integration apps,
and no person may be given one. Operator Persons hold only visit grants. A
Person holds at most 32 active grants.

Custom roles, a tenant's clones of built-in roles, add a `tenantRoles` table
and widen the stored role reference with a second member. A custom role holds
only roles-granted actions its editor already holds tenant-wide; archiving it
ends its grants.

### Operators inside tenants

An operator enters a tenant through a visit: a temporary admin or auditor grant
on a Person of kind operator, active only while the grant is. The visit's end,
by schedule, by leaving, by an Owner revoking it, or by the operator losing
their operator row, ends the grant and suspends that Person in the same
transaction, so the member middleware refuses it at once. An operator Person
never holds the `member` relation and counts only the grants an operator gave
for a visit.

### Wire contracts

Open vocabularies decode tolerantly on the client, because Convex deploys
before the web app and open tabs keep the previous bundle. `can` drops actions
the client does not know, audit entries decode an unknown change type or kind
as `unknown`, and `AccessDenied.action` is a plain string. Closed values, such
as role keys, scopes, statuses, and unit levels, change through expand, switch,
observe, and contract.

### Convex actions

No function attaches these middlewares to a Convex action yet, so they declare
`action: false`. The first lane that does switches the specs it uses to
`makeByFunctionType`: actions resolve the member and decide through internal
queries that run the same code, and every write an action makes goes through an
internal mutation that resolves and decides again in its own transaction, so a
grant revoked in between stops the write.

### Extending access in a lane

1. Give the table `tenantId`, and `unitId` when the object lives in a unit.
2. Declare the kinds in the lane's `kinds.ts` (`Kind.object`, with actions,
   rules, relations, changes, and published types) and `Kind.extend` for
   actions or changes on another lane's kind; export `{ kinds, extensions }`.
3. Declare each subject service and kind spec in the lane's client-safe
   `access.ts` (`Kind.middleware(catalog, kind)`).
4. Implement the authorities in the lane's `authority.ts` with
   `Authority.make`, and each spec with
   `MiddlewareImpl.make(schema, Spec, Authority.middleware(Subject, authority))`.
5. Add the lane object to `lanes` in `access/catalog.ts` and its authorities to
   `access/registry.ts`, one line each.
6. Provide the impl of every spec a group attaches; codegen rejects a missing
   one.
7. Write audited changes with `record` in the same mutation (ADR 0016).
8. Test that an actor from another tenant gets `NotMember` (another slug) or
   `AccessDenied` with reason `resource` (another tenant's ID) from every public
   function, every typed failure, and the lane's rules.

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

## Rejected Alternatives

- SpiceDB or OpenFGA would move decisions out of the Convex transaction: queries
  would stop reacting to permission changes and every check would add a network
  hop, while a school's graph needs two or three indexed reads per decision.
- A static role-to-permission table, as in the first School, cannot express
  relations or conditions.
- One `RequireAccess` spec with an options union and a runtime subject accessor
  let handlers re-read subjects by argument through an accessor that died on a
  miswire; typed per-kind subjects remove that class of defect.
