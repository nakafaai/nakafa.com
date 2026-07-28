import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { Effect, Option } from "effect";

const SCHOOL_SUCCESSOR_CANDIDATE_LIMIT = 100;

/**
 * Finds an active school member whose account is not already being deleted.
 * The bounded scan fails closed when no safe successor is found.
 */
export const findSchoolOwnershipSuccessor = Effect.fn(
  "auth.deletion.findSchoolOwnershipSuccessor"
)(function* (
  ctx: Pick<QueryCtx, "db">,
  schoolId: Id<"schools">,
  ownerId: Id<"users">
) {
  const candidates = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolMembers")
      .withIndex("by_schoolId_and_status", (query) =>
        query.eq("schoolId", schoolId).eq("status", "active")
      )
      .filter((query) => query.neq(query.field("userId"), ownerId))
      .take(SCHOOL_SUCCESSOR_CANDIDATE_LIMIT)
  );

  for (const candidate of candidates) {
    const user = yield* tryUserCleanup(() =>
      ctx.db.get("users", candidate.userId)
    );

    if (user && user.deletedAt === undefined) {
      return Option.some(candidate);
    }
  }

  return Option.none();
});
