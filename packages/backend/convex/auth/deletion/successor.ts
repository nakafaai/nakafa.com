import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { tryUserCleanup } from "@repo/backend/convex/auth/cleanup/spec";
import { ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE } from "@repo/backend/convex/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/convex/auth/deletion/state";
import { Effect } from "effect";

/**
 * Scans one bounded page for an active successor. Callers persist the opaque
 * cursor and continue in another transaction instead of imposing a member cap.
 */
export const findSchoolOwnershipSuccessorPage = Effect.fn(
  "auth.deletion.findSchoolOwnershipSuccessorPage"
)(function* (
  ctx: Pick<QueryCtx, "db">,
  schoolId: Id<"schools">,
  ownerId: Id<"users">,
  cursor: string | null
) {
  const candidatePage = yield* tryUserCleanup(() =>
    ctx.db
      .query("schoolMembers")
      .withIndex("by_schoolId_and_status", (query) =>
        query.eq("schoolId", schoolId).eq("status", "active")
      )
      .filter((query) => query.neq(query.field("userId"), ownerId))
      .paginate({
        cursor,
        numItems: ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE,
      })
  );

  for (const candidate of candidatePage.page) {
    const user = yield* tryUserCleanup(() =>
      ctx.db.get("users", candidate.userId)
    );

    if (user && !isAccountDeletionPending(user)) {
      return {
        kind: "found" as const,
        successorMembership: candidate,
      };
    }
  }

  if (candidatePage.isDone) {
    return { kind: "not-found" as const };
  }

  return {
    cursor: candidatePage.continueCursor,
    kind: "continue" as const,
  };
});
