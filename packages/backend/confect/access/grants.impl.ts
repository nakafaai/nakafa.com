import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Grant } from "@repo/backend/confect/access/access";
import { grantAccess } from "@repo/backend/confect/access/authority";
import {
  assignRole,
  endGrant,
  ensureOwnerRemains,
} from "@repo/backend/confect/access/grant";
import spec from "@repo/backend/confect/access/grants.spec";
import { activeGrants } from "@repo/backend/confect/access/policy";
import {
  type BuiltinRole,
  GrantScope,
  OwnerRole,
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
import { Array as Arr, Effect, Layer, Schema } from "effect";

/**
 * Managing a grant needs `grant.manage` on the scope it covers, so a unit
 * admin manages roles in their own unit only, and a unit named in the
 * arguments must belong to the member's tenant. Owner and Admin roles also
 * need `owner.manage`, which only Owners hold.
 */
const authorizeManage = Effect.fn("access.grants.manage")(function* (
  scope: GrantScope,
  role: BuiltinRole
) {
  const { tenant } = yield* Member;
  yield* GrantScope.match(scope, {
    tenant: () => tenantAuthority.check("grant.manage", tenant),
    unit: ({ unitId }) =>
      Effect.asVoid(unitAuthority.authorize("grant.manage", unitId)),
  });
  if (Schema.is(OwnerRole)(role)) {
    yield* tenantAuthority.check("owner.manage", tenant);
  }
});

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("access.grants.list")(function* () {
    return Arr.map(yield* activeGrants((yield* Person)._id), (grant) => ({
      id: grant._id,
      role: grant.role,
      scope: grant.scope,
      term: grant.term,
    }));
  })
);

const assign = FunctionImpl.make(
  databaseSchema,
  spec,
  "assign",
  Effect.fn("access.grants.assign")(function* ({ role, scope }) {
    yield* authorizeManage(scope, role);
    return yield* assignRole(
      { id: (yield* Member).person._id, kind: "person" },
      yield* Person,
      role,
      scope
    );
  })
);

/** Ending an already ended grant is a no-op, so a retried request succeeds. */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("access.grants.revoke")(function* () {
    const grant = yield* Grant;
    if (grant.status !== "active") {
      return null;
    }
    yield* authorizeManage(grant.scope, grant.role.key);
    yield* ensureOwnerRemains(grant);
    yield* endGrant(
      { id: (yield* Member).person._id, kind: "person" },
      grant,
      yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(grant.personId)
        .pipe(Effect.orDie),
      "revoked"
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
  GroupImpl.finalize
);
