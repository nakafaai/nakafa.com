import { FunctionImpl, GroupImpl } from "@confect/server";
import type {
  TenantGrantsDoc,
  TenantPeopleDoc,
} from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Grant } from "@repo/backend/confect/access/access";
import {
  grantAccess,
  tenantAccess,
} from "@repo/backend/confect/access/authority";
import {
  assignRole,
  authorizeAssign,
  leavesOwner,
  revokeGrant,
  signedInOwners,
} from "@repo/backend/confect/access/grant";
import { change } from "@repo/backend/confect/access/grants.change";
import spec from "@repo/backend/confect/access/grants.spec";
import { activeGrants } from "@repo/backend/confect/access/policy";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personAccess } from "@repo/backend/confect/tenancy/authority";
import { namedPeople } from "@repo/backend/confect/tenancy/named";
import { Array as Arr, Effect, Layer, Number as Num, Struct } from "effect";

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The active grants of the member's school, one page at a time, or those of the people a
 * search finds by name, so a search reaches every page. The index holds active grants
 * only, so a revoked or expired grant is never read. Each row reads the Person who holds
 * the grant once, by ID, and says whether ending it leaves the school an Owner who has
 * signed in, so the list offers Revoke only where it can end.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("access.grants.list")(function* ({ paginationOpts, search }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const owners = yield* signedInOwners(tenant._id);
    const pageOptions = Struct.assign(paginationOpts, {
      numItems: Num.min(paginationOpts.numItems, PAGE_LIMIT),
    });
    const row = (grant: TenantGrantsDoc, person: TenantPeopleDoc) => ({
      id: grant._id,
      person: { id: person._id, name: person.name },
      revocable: leavesOwner(grant, owners),
      role: grant.role,
      scope: grant.scope,
    });
    if (search !== undefined) {
      const people = yield* namedPeople(tenant._id, search, pageOptions);
      const page = yield* Effect.forEach(
        people.page,
        (person) =>
          Effect.map(activeGrants(person._id), (grants) =>
            Arr.map(grants, (grant) => row(grant, person))
          ),
        { concurrency: "unbounded" }
      );
      return Struct.assign(people, { page: Arr.flatten(page) });
    }
    const grants = yield* reader
      .table("tenantGrants")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .paginate(pageOptions)
      .pipe(Effect.orDie);
    const page = yield* Effect.forEach(
      grants.page,
      (grant) =>
        reader
          .table("tenantPeople")
          .get(grant.personId)
          .pipe(
            Effect.orDie,
            Effect.map((person) => row(grant, person))
          ),
      { concurrency: "unbounded" }
    );
    return Struct.assign(grants, { page });
  })
);

const assign = FunctionImpl.make(
  databaseSchema,
  spec,
  "assign",
  Effect.fn("access.grants.assign")(function* ({ role, scope }) {
    yield* authorizeAssign(scope, role);
    return yield* assignRole(
      { id: (yield* Member).person._id, kind: "person" },
      yield* Person,
      role,
      scope
    );
  })
);

/**
 * Ending a grant is decided on the grant (`grant.revoke`), so it works in an
 * archived unit too. Ending an already ended grant is a no-op, so a retried
 * request succeeds.
 */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("access.grants.revoke")(function* () {
    const grant = yield* Grant;
    if (grant.status !== "active") {
      return null;
    }
    yield* revokeGrant(
      { id: (yield* Member).person._id, kind: "person" },
      grant,
      yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(grant.personId)
        .pipe(Effect.orDie)
    );
    return null;
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(list),
  Layer.provide(assign),
  Layer.provide(change),
  Layer.provide(revoke),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(personAccess),
  Layer.provide(grantAccess),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
