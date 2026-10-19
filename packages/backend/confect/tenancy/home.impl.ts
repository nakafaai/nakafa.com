import type { GenericId } from "@confect/core";
import { FunctionImpl, GroupImpl } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { tenantAccess } from "@repo/backend/confect/access/authority";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import member from "@repo/backend/confect/middleware/member.impl";
import { Member } from "@repo/backend/confect/middleware/member.spec";
import session from "@repo/backend/confect/middleware/session.impl";
import spec from "@repo/backend/confect/tenancy/home.spec";
import { Array as Arr, Effect, Layer } from "effect";

/**
 * Whether the school holds an active grant of one built-in role. One index read with a limit of one
 * answers it, because the answer is only whether a grant exists.
 */
const holdsRole = Effect.fn("tenancy.home.holdsRole")(function* (
  tenantId: GenericId.GenericId<"tenants">,
  role: BuiltinRole
) {
  const grants = yield* (yield* DatabaseReader)
    .table("tenantGrants")
    .index("by_tenantId_and_role_key_and_status", (query) =>
      query.eq("tenantId", tenantId).eq("role.key", role).eq("status", "active")
    )
    .take(1)
    .pipe(Effect.orDie);
  return Arr.isReadonlyArrayNonEmpty(grants);
});

/** Whether the school holds an invite that waits to be accepted, read with a limit of one. */
const hasPendingInvite = Effect.fn("tenancy.home.pendingInvite")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  const invites = yield* (yield* DatabaseReader)
    .table("tenantInvites")
    .index("by_tenantId_and_state_status", (query) =>
      query.eq("tenantId", tenantId).eq("state.status", "pending")
    )
    .take(1)
    .pipe(Effect.orDie);
  return Arr.isReadonlyArrayNonEmpty(invites);
});

/**
 * The school's setup for its home: three bounded checks, each stopped at its first row, so the read
 * costs the same however many grants and invites the school holds.
 */
const setup = FunctionImpl.make(
  databaseSchema,
  spec,
  "setup",
  Effect.fn("tenancy.home.setup")(function* () {
    const { tenant } = yield* Member;
    return {
      hasPendingInvite: yield* hasPendingInvite(tenant._id),
      hasStudent: yield* holdsRole(tenant._id, "student"),
      hasTeacher: yield* holdsRole(tenant._id, "teacher"),
    };
  })
);

export default GroupImpl.make(databaseSchema, spec).pipe(
  Layer.provide(setup),
  Layer.provide(session),
  Layer.provide(member),
  Layer.provide(tenantAccess),
  GroupImpl.finalize
);
