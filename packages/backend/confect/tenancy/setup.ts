import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { BuiltinRole } from "@repo/backend/confect/access/schema";
import { Array as Arr, Effect } from "effect";

/**
 * Whether the school holds an active grant of one built-in role. One index read with a limit of one
 * answers it, because the answer is only whether a grant exists.
 */
const holdsRole = Effect.fn("tenancy.setup.holdsRole")(function* (
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
const hasPendingInvite = Effect.fn("tenancy.setup.pendingInvite")(function* (
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
 * costs the same however many grants and invites the school holds. The school home's first read
 * returns it to a viewer who manages the school, and the setup tile subscribes to it live.
 */
export const readSetup = Effect.fn("tenancy.setup.read")(function* (
  tenantId: GenericId.GenericId<"tenants">
) {
  return {
    hasPendingInvite: yield* hasPendingInvite(tenantId),
    hasStudent: yield* holdsRole(tenantId, "student"),
    hasTeacher: yield* holdsRole(tenantId, "teacher"),
  };
});
