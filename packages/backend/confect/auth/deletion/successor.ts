import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { toUserCleanupError } from "@repo/backend/confect/auth/cleanup/spec";
import { ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE } from "@repo/backend/confect/auth/deletion/constants";
import { isAccountDeletionPending } from "@repo/backend/confect/auth/deletion/state";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect } from "effect";

/**
 * Scans one bounded page for an active successor. Callers persist the opaque
 * cursor and continue in another transaction instead of imposing a member cap.
 */
export const findSchoolOwnershipSuccessorPage = Effect.fn(
  "auth.deletion.findSchoolOwnershipSuccessorPage"
)(function* (
  schoolId: Id<"schools">,
  ownerId: Id<"users">,
  cursor: string | null
) {
  const database = yield* DatabaseReader;
  const candidatePage = yield* database
    .table("schoolMembers")
    .index("by_schoolId_and_status", (query) =>
      query.eq("schoolId", schoolId).eq("status", "active")
    )
    .paginate(
      {
        cursor,
        numItems: ACCOUNT_DELETION_SUCCESSOR_PAGE_SIZE,
      },
      (query) => query.neq(query.field("userId"), ownerId)
    );
  for (const candidate of candidatePage.page) {
    const user = yield* database
      .table("users")
      .get(candidate.userId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));
    if (user && !isAccountDeletionPending(user)) {
      return {
        kind: "found" as const,
        successorMembership: candidate,
      };
    }
  }
  if (candidatePage.isDone) {
    return {
      kind: "not-found" as const,
    };
  }
  return {
    cursor: candidatePage.continueCursor,
    kind: "continue" as const,
  };
}, Effect.mapError(toUserCleanupError));
