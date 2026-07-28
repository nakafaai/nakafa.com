import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect } from "effect";

const OWNED_SCHOOL_LIMIT = 100;

/**
 * Checks that every school owned by the account has an active successor.
 * The conservative limit prevents a partial ownership check from authorizing
 * deletion for an unexpectedly large account.
 */
export const getSchoolOwnershipDeletionReadiness = Effect.fn(
  "auth.deletion.getSchoolOwnershipDeletionReadiness"
)(function* (ctx: QueryCtx, authId: string) {
  const user = yield* tryUserCleanup(() =>
    ctx.db
      .query("users")
      .withIndex("by_authId", (query) => query.eq("authId", authId))
      .unique()
  );

  if (!user) {
    return true;
  }

  const ownedSchools = yield* tryUserCleanup(() =>
    ctx.db
      .query("schools")
      .withIndex("by_createdBy", (query) => query.eq("createdBy", user._id))
      .take(OWNED_SCHOOL_LIMIT + 1)
  );

  if (ownedSchools.length > OWNED_SCHOOL_LIMIT) {
    return false;
  }

  for (const school of ownedSchools) {
    const successor = yield* tryUserCleanup(() =>
      ctx.db
        .query("schoolMembers")
        .withIndex("by_schoolId_and_status", (query) =>
          query.eq("schoolId", school._id).eq("status", "active")
        )
        .filter((query) => query.neq(query.field("userId"), user._id))
        .first()
    );

    if (!successor) {
      return false;
    }
  }

  return true;
});
