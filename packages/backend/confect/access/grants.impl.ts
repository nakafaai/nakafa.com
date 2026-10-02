import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { Grant } from "@repo/backend/confect/access/access";
import { grantAccess } from "@repo/backend/confect/access/authority";
import { authorize } from "@repo/backend/confect/access/check";
import {
  assignRole,
  endGrant,
  ensureOwnerRemains,
} from "@repo/backend/confect/access/grant";
import spec from "@repo/backend/confect/access/grants.spec";
import { activeGrants } from "@repo/backend/confect/access/policy";
import type {
  BuiltinRole,
  GrantScope,
} from "@repo/backend/confect/access/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import { Person } from "@repo/backend/confect/tenancy/access";
import { personAccess } from "@repo/backend/confect/tenancy/authority";
import { Effect, Layer } from "effect";

/**
 * Managing a grant needs `grant.manage` on the scope it covers, so a unit
 * admin manages roles in their own unit only, and a unit named in the
 * arguments must belong to the member's tenant. Owner and Admin roles also
 * need `owner.manage`, which only Owners hold.
 */
const authorizeManage = Effect.fnUntraced(function* (
  scope: GrantScope,
  role: BuiltinRole,
  tenantId: GenericId.GenericId<"tenants">
) {
  if (scope.kind === "unit") {
    yield* authorize("unit", "grant.manage", scope.unitId);
  } else {
    yield* authorize("tenant", "grant.manage", tenantId);
  }
  if (role === "owner" || role === "admin") {
    yield* authorize("tenant", "owner.manage", tenantId);
  }
});

const list = FunctionImpl.make(
  databaseSchema,
  spec,
  "list",
  Effect.fn("access.grants.list")(function* () {
    const grants = yield* activeGrants((yield* Person)._id);
    return grants.map((grant) => ({
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
    const { person: caller, tenant } = yield* Member;
    yield* authorizeManage(scope, role, tenant._id);
    return yield* assignRole({
      actor: { id: caller._id, kind: "person" },
      person: yield* Person,
      role,
      scope,
    });
  })
);

/** Ending an already ended grant is a no-op, so a retried request succeeds. */
const revoke = FunctionImpl.make(
  databaseSchema,
  spec,
  "revoke",
  Effect.fn("access.grants.revoke")(function* () {
    const { person: caller, tenant } = yield* Member;
    const grant = yield* Grant;
    if (grant.status !== "active") {
      return null;
    }
    yield* authorizeManage(grant.scope, grant.role.key, tenant._id);
    yield* ensureOwnerRemains(grant);
    yield* endGrant({
      actor: { id: caller._id, kind: "person" },
      grant,
      holder: yield* (yield* DatabaseReader)
        .table("tenantPeople")
        .get(grant.personId)
        .pipe(Effect.orDie),
      reason: "revoked",
    });
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
