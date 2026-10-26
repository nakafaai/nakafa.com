import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Grant } from "@repo/backend/confect/access/access";
import {
  grantAccess,
  tenantAccess,
} from "@repo/backend/confect/access/authority";
import {
  assignRole,
  authorizeOwnerRole,
  leavesOwner,
  revokeGrant,
  signedInOwners,
} from "@repo/backend/confect/access/grant";
import spec from "@repo/backend/confect/access/grants.spec";
import {
  type BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import {
  personAccess,
  tenantAuthority,
  unitAuthority,
} from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer, Number as Num, Struct } from "effect";

/**
 * Giving a role needs `grant.manage` on the scope the new grant covers, so a
 * unit admin gives roles in their own unit only, and a unit named in the
 * arguments must belong to the member's tenant.
 */
const authorizeAssign = Effect.fn("access.grants.authorizeAssign")(function* (
  scope: GrantScope,
  role: BuiltinRole
) {
  const { tenant } = yield* Member;
  yield* GrantScope.match(scope, {
    tenant: () => tenantAuthority.check("grant.manage", tenant),
    unit: ({ unitId }) =>
      Effect.asVoid(unitAuthority.authorize("grant.manage", unitId)),
  });
  yield* authorizeOwnerRole(role);
});

/** The largest page one request reads. */
const PAGE_LIMIT = 100;

/**
 * The active grants of the member's school, one page at a time. The index holds
 * active grants only, so a revoked or expired grant is never read. Each row reads
 * the Person who holds the grant once, by ID, and says whether ending it leaves the
 * school an Owner who has signed in, so the list offers Revoke only where it can end.
 */
const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("access.grants.list")(function* ({ paginationOpts }) {
    const { tenant } = yield* Member;
    const reader = yield* DatabaseReader;
    const grants = yield* reader
      .table("tenantGrants")
      .index("by_tenantId_and_status", (query) =>
        query.eq("tenantId", tenant._id).eq("status", "active")
      )
      .paginate(
        Struct.assign(paginationOpts, {
          numItems: Num.min(paginationOpts.numItems, PAGE_LIMIT),
        })
      )
      .pipe(Effect.orDie);
    const owners = yield* signedInOwners(tenant._id);
    const page = yield* Effect.forEach(
      grants.page,
      (grant) =>
        reader
          .table("tenantPeople")
          .get(grant.personId)
          .pipe(
            Effect.orDie,
            Effect.map((person) => ({
              id: grant._id,
              person: { id: person._id, name: person.name },
              revocable: leavesOwner(grant, owners),
              role: grant.role,
              scope: grant.scope,
            }))
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
  Layer.provide(revoke),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(personAccess),
  Layer.provide(grantAccess),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
